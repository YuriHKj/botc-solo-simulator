import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import {
  PRODUCT_CAPABILITY_CI_RESULTS_SCHEMA,
  PRODUCT_CAPABILITY_CI_RESULTS_VERSION,
  hashCapabilityContract,
  isValidIsoDate,
  runCapabilityContractCli,
} from "./product_capability_contract.mjs";

export const CI_RESULTS_SCHEMA = PRODUCT_CAPABILITY_CI_RESULTS_SCHEMA;
export const CI_RESULTS_VERSION = PRODUCT_CAPABILITY_CI_RESULTS_VERSION;
const REVIEWED_SCRIPT_DEFINITIONS = new Map([
  ["test:role-actions", "node tests/role_action_contracts.mjs"],
  ["test:full-game-loop", "node tests/full_game_loop_contracts.mjs"],
  ["test:unity-demo-acceptance", "node scripts/unity_demo_acceptance.mjs"],
  ["test:unity-viewmodel", "node tests/unity_viewmodel_contracts.mjs"],
  ["test:unity-csharp-smoke", "powershell -ExecutionPolicy Bypass -File tools/unity_csharp_compile_smoke.ps1"],
  ["test:ai-flagship-replay", "node tests/ai_flagship_replay_eval_contracts.mjs"],
  ["test:electron-build", "node tests/electron_build_contracts.cjs"],
  ["test:ai-llm-renderer", "node tests/ai_llm_renderer_contracts.mjs"],
]);
export const ALLOWED_CI_EVIDENCE_SCRIPTS = Object.freeze([...REVIEWED_SCRIPT_DEFINITIONS.keys()]);
const ALLOWED_SCRIPT_SET = new Set(ALLOWED_CI_EVIDENCE_SCRIPTS);
const DEFAULT_DIAGNOSTIC_LIMIT = 4096;
const DEFAULT_COMMAND_TIMEOUT_MS = 120_000;
const GIT_SHA_PATTERN = /^[a-f0-9]{40}$/iu;
const HOSTED_UNITY_EVIDENCE_SCRIPT = "test:unity-csharp-smoke";
const HOSTED_UNITY_REQUIRED_ENV = "BOTC_HOSTED_UNITY_EVIDENCE_REQUIRED";

function readJson(filePath, label) {
  if (!fs.existsSync(filePath)) throw new Error(`${label} not found: ${filePath}`);
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
}

export function collectCiRunCommands(contract) {
  const commands = [];
  const seen = new Set();
  const tracks = Array.isArray(contract?.tracks) ? contract.tracks : [];
  for (const track of tracks) {
    const gates = Array.isArray(track?.promotionGates) ? track.promotionGates : [];
    for (const gate of gates) {
      const evidenceEntries = Array.isArray(gate?.evidence) ? gate.evidence : [];
      for (const evidence of evidenceEntries) {
        if (evidence?.freshness?.policy !== "ci-run" || typeof evidence.reference !== "string") continue;
        if (!seen.has(evidence.reference)) {
          seen.add(evidence.reference);
          commands.push(evidence.reference);
        }
      }
    }
  }
  return commands;
}

export function validateCiRunCommands(commands, packageScripts) {
  if (!Array.isArray(commands)) throw new Error("CI evidence commands must be an array.");
  if (!packageScripts || typeof packageScripts !== "object" || Array.isArray(packageScripts)) {
    throw new Error("package.json scripts must be an object.");
  }
  return commands.map((command) => {
    const match = /^npm run ([a-z0-9][a-z0-9:_-]*)$/iu.exec(command);
    if (!match) {
      throw new Error(`Evidence command must have the exact form \"npm run <script>\": ${command}`);
    }
    const scriptName = match[1];
    if (!ALLOWED_SCRIPT_SET.has(scriptName)) {
      throw new Error(`Evidence command is not an explicitly allowed PR-safe evidence script: ${command}`);
    }
    if (!Object.hasOwn(packageScripts, scriptName)) {
      throw new Error(`Evidence script does not exist in package.json: ${scriptName}`);
    }
    const expectedDefinition = REVIEWED_SCRIPT_DEFINITIONS.get(scriptName);
    if (packageScripts[scriptName] !== expectedDefinition) {
      throw new Error(`Evidence script does not match its reviewed PR-safe definition: ${scriptName}`);
    }
    for (const lifecycleName of [`pre${scriptName}`, `post${scriptName}`]) {
      if (Object.hasOwn(packageScripts, lifecycleName)) {
        throw new Error(`Evidence script cannot declare npm lifecycle hooks: ${lifecycleName}`);
      }
    }
    return { command, scriptName };
  });
}

export function selectEvidenceRevision({ explicitRevision = null, githubSha = null, head = null, dirty = false } = {}) {
  if (githubSha) {
    if (!GIT_SHA_PATTERN.test(githubSha)) throw new Error("GITHUB_SHA must be a 40-character Git SHA.");
    return githubSha.toLowerCase();
  }
  if (explicitRevision !== null && explicitRevision !== undefined) {
    if (typeof explicitRevision !== "string" || explicitRevision.trim() === "" || /[\r\n]/u.test(explicitRevision)) {
      throw new Error("Explicit revision must be a non-empty single-line value.");
    }
    return explicitRevision;
  }
  if (typeof head !== "string" || !GIT_SHA_PATTERN.test(head)) {
    throw new Error("A local Git HEAD revision is required when GITHUB_SHA is unavailable.");
  }
  return `worktree:${head.toLowerCase()}${dirty ? ":dirty" : ""}`;
}

function inspectLocalRevision(root) {
  const headResult = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
    shell: false,
    windowsHide: true,
  });
  if (headResult.status !== 0) {
    throw new Error("Unable to read the local Git HEAD revision.");
  }
  const statusResult = spawnSync("git", ["status", "--porcelain", "--untracked-files=normal"], {
    cwd: root,
    encoding: "utf8",
    shell: false,
    windowsHide: true,
  });
  if (statusResult.status !== 0) {
    throw new Error("Unable to determine whether the local worktree is dirty.");
  }
  return { head: headResult.stdout.trim(), dirty: statusResult.stdout.length > 0 };
}

function appendBounded(current, chunk, limit) {
  if (current.length >= limit) return { text: current, truncated: chunk.length > 0 };
  const remaining = limit - current.length;
  return {
    text: `${current}${chunk.slice(0, remaining)}`,
    truncated: chunk.length > remaining,
  };
}

function boundedDiagnostics(stdout, stderr, limit = DEFAULT_DIAGNOSTIC_LIMIT) {
  const boundedStdout = appendBounded("", String(stdout ?? ""), limit);
  const boundedStderr = appendBounded("", String(stderr ?? ""), limit);
  return {
    stdout: boundedStdout.text,
    stderr: boundedStderr.text,
    stdoutTruncated: boundedStdout.truncated,
    stderrTruncated: boundedStderr.truncated,
  };
}

function defaultLog(message, stream = "stdout") {
  const target = stream === "stderr" ? process.stderr : process.stdout;
  target.write(String(message));
}

export function buildNpmInvocation(
  scriptName,
  {
    platform = process.platform,
    npmExecPath = process.env.npm_execpath ?? null,
    nodeExecPath = process.execPath,
    comSpec = process.env.ComSpec ?? "cmd.exe",
  } = {}
) {
  if (!ALLOWED_SCRIPT_SET.has(scriptName)) {
    throw new Error(`Cannot build an invocation for a non-allowlisted evidence script: ${scriptName}`);
  }
  if (platform === "win32") {
    if (typeof npmExecPath === "string" && path.basename(npmExecPath).toLowerCase() === "npm-cli.js") {
      return {
        executable: nodeExecPath,
        args: [npmExecPath, "run", scriptName],
        shell: false,
      };
    }
    // Windows cannot CreateProcess npm.cmd directly with shell:false (spawn EINVAL).
    // ComSpec is only a transport for the fixed npm.cmd token and the already allowlisted script name.
    return {
      executable: comSpec,
      args: ["/d", "/s", "/c", "npm.cmd", "run", scriptName],
      shell: false,
    };
  }
  return { executable: "npm", args: ["run", scriptName], shell: false };
}

function terminateProcessTree(child) {
  if (!Number.isInteger(child.pid)) return;
  if (process.platform === "win32") {
    const terminated = spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
      shell: false,
      stdio: "ignore",
      timeout: 5_000,
      windowsHide: true,
    });
    if (terminated.status === 0) return;
  } else {
    try {
      process.kill(-child.pid, "SIGKILL");
      return;
    } catch {
      // Fall back to terminating the direct child below.
    }
  }
  try {
    child.kill("SIGKILL");
  } catch {
    // The process may have exited between the timeout and termination request.
  }
}

async function executeWithTimeout(executeScript, executionOptions, timeoutMs) {
  const controller = new AbortController();
  let timer;
  const timedOut = new Promise((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve({
        exitCode: 124,
        stdout: "",
        stderr: `Evidence command exceeded ${timeoutMs} ms.`,
      });
    }, timeoutMs);
  });
  try {
    return await Promise.race([
      Promise.resolve().then(() => executeScript({ ...executionOptions, signal: controller.signal })),
      timedOut,
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function executeNpmScript({ root, command, scriptName, environment = {}, log, diagnosticLimit, signal: abortSignal }) {
  const invocation = buildNpmInvocation(scriptName);
  return await new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let stdoutTruncated = false;
    let stderrTruncated = false;
    let spawnError = null;
    const childEnvironment = { ...process.env };
    delete childEnvironment[HOSTED_UNITY_REQUIRED_ENV];
    Object.assign(childEnvironment, environment);
    const child = spawn(invocation.executable, invocation.args, {
      cwd: root,
      env: childEnvironment,
      shell: invocation.shell,
      detached: process.platform !== "win32",
      windowsHide: true,
    });
    const abortHandler = () => terminateProcessTree(child);
    if (abortSignal?.aborted) abortHandler();
    else abortSignal?.addEventListener("abort", abortHandler, { once: true });

    child.stdout.on("data", (data) => {
      const chunk = data.toString();
      log(chunk, "stdout");
      const bounded = appendBounded(stdout, chunk, diagnosticLimit);
      stdout = bounded.text;
      stdoutTruncated ||= bounded.truncated;
    });
    child.stderr.on("data", (data) => {
      const chunk = data.toString();
      log(chunk, "stderr");
      const bounded = appendBounded(stderr, chunk, diagnosticLimit);
      stderr = bounded.text;
      stderrTruncated ||= bounded.truncated;
    });
    child.on("error", (error) => {
      spawnError = error;
      const chunk = `Unable to start ${command}: ${error.message}\n`;
      log(chunk, "stderr");
      const bounded = appendBounded(stderr, chunk, diagnosticLimit);
      stderr = bounded.text;
      stderrTruncated ||= bounded.truncated;
    });
    child.on("close", (exitCode, terminationSignal) => {
      abortSignal?.removeEventListener("abort", abortHandler);
      if (terminationSignal) {
        const chunk = `Process terminated by signal ${terminationSignal}.\n`;
        const bounded = appendBounded(stderr, chunk, diagnosticLimit);
        stderr = bounded.text;
        stderrTruncated ||= bounded.truncated;
      }
      let normalizedExitCode = 1;
      if (Number.isInteger(exitCode)) normalizedExitCode = exitCode;
      else if (spawnError) normalizedExitCode = 127;
      resolve({
        exitCode: normalizedExitCode,
        stdout,
        stderr,
        stdoutTruncated,
        stderrTruncated,
      });
    });
  });
}

function writeManifest(resultsPath, manifest) {
  fs.mkdirSync(path.dirname(resultsPath), { recursive: true });
  fs.writeFileSync(resultsPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

export async function runProductCapabilityCi(options = {}) {
  const log = typeof options.log === "function" ? options.log : defaultLog;
  try {
    const root = path.resolve(options.root ?? process.cwd());
    const contractPath = path.resolve(options.contractPath ?? path.join(root, "config", "product_capabilities.json"));
    const resultsPath = path.resolve(
      options.resultsPath ?? path.join(root, "output", "product-capability-ci-results.json")
    );
    const asOf = options.asOf ?? null;
    if (asOf && !isValidIsoDate(asOf)) throw new Error("--as-of must be a valid YYYY-MM-DD date.");
    const commandTimeoutMs = options.commandTimeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS;
    if (!Number.isInteger(commandTimeoutMs) || commandTimeoutMs <= 0) {
      throw new Error("commandTimeoutMs must be a positive integer.");
    }
    const contract = readJson(contractPath, "Capability contract");
    const packageJson = readJson(path.join(root, "package.json"), "package.json");
    const evidenceCommands = validateCiRunCommands(collectCiRunCommands(contract), packageJson.scripts);
    const githubSha = Object.hasOwn(options, "githubSha") ? options.githubSha : process.env.GITHUB_SHA ?? null;
    const localRevision = githubSha || options.revision ? {} : inspectLocalRevision(root);
    const revision = selectEvidenceRevision({
      explicitRevision: options.revision,
      githubSha,
      ...localRevision,
    });
    const contractHash = hashCapabilityContract(contract);
    const executeScript = typeof options.executeScript === "function" ? options.executeScript : executeNpmScript;
    const diagnosticLimit = options.diagnosticLimit ?? DEFAULT_DIAGNOSTIC_LIMIT;
    const results = [];
    const manifest = {
      schema: CI_RESULTS_SCHEMA,
      version: CI_RESULTS_VERSION,
      revision,
      contractHash,
      results,
    };

    for (const [index, evidence] of evidenceCommands.entries()) {
      log(`\n[capabilities] (${index + 1}/${evidenceCommands.length}) ${evidence.command}\n`, "stdout");
      const environment =
        evidence.scriptName === HOSTED_UNITY_EVIDENCE_SCRIPT ? { [HOSTED_UNITY_REQUIRED_ENV]: "1" } : {};
      let executed;
      try {
        executed = await executeWithTimeout(
          executeScript,
          {
            root,
            command: evidence.command,
            scriptName: evidence.scriptName,
            environment,
            log,
            diagnosticLimit,
          },
          commandTimeoutMs
        );
      } catch (error) {
        executed = { exitCode: 127, stdout: "", stderr: `Evidence runner error: ${error.message}` };
      }
      const diagnostics = boundedDiagnostics(executed.stdout, executed.stderr, diagnosticLimit);
      diagnostics.stdoutTruncated ||= Boolean(executed.stdoutTruncated);
      diagnostics.stderrTruncated ||= Boolean(executed.stderrTruncated);
      const exitCode = Number.isInteger(executed.exitCode) ? executed.exitCode : 127;
      results.push({
        command: evidence.command,
        revision,
        contractHash,
        exitCode,
        diagnostics,
      });
      writeManifest(resultsPath, manifest);
      log(`[capabilities] ${evidence.command} -> exit ${exitCode}\n`, exitCode === 0 ? "stdout" : "stderr");
    }

    if (results.length === 0) writeManifest(resultsPath, manifest);
    const verificationArgs = [
      "check",
      "--require-current",
      "--root",
      root,
      "--contract",
      contractPath,
      "--results",
      resultsPath,
      "--revision",
      revision,
    ];
    if (asOf) verificationArgs.push("--as-of", asOf);
    const verificationExit = runCapabilityContractCli(verificationArgs);
    if (verificationExit === 2) return 2;
    return verificationExit === 1 || results.some((result) => result.exitCode !== 0) ? 1 : 0;
  } catch (error) {
    log(`[capabilities] ${error.message}\n`, "stderr");
    return 2;
  }
}

function parseCliArgs(argv) {
  const { values } = parseArgs({
    args: argv,
    allowPositionals: false,
    strict: true,
    options: {
      root: { type: "string" },
      contract: { type: "string" },
      results: { type: "string" },
      revision: { type: "string" },
      "as-of": { type: "string" },
    },
  });
  return {
    ...(values.root ? { root: values.root } : {}),
    ...(values.contract ? { contractPath: values.contract } : {}),
    ...(values.results ? { resultsPath: values.results } : {}),
    ...(values.revision ? { revision: values.revision } : {}),
    ...(values["as-of"] ? { asOf: values["as-of"] } : {}),
  };
}

export async function runProductCapabilityCiCli(argv = process.argv.slice(2)) {
  try {
    return await runProductCapabilityCi(parseCliArgs(argv));
  } catch (error) {
    console.error(`[capabilities] ${error.message}`);
    return 2;
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  process.exitCode = await runProductCapabilityCiCli();
}
