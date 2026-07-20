import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ALLOWED_CI_EVIDENCE_SCRIPTS,
  CI_RESULTS_SCHEMA,
  CI_RESULTS_VERSION,
  buildNpmInvocation,
  collectCiRunCommands,
  runProductCapabilityCi,
  selectEvidenceRevision,
  validateCiRunCommands,
} from "../scripts/run_product_capability_ci.mjs";
import {
  evaluateCapabilityContract,
  hashCapabilityContract,
  runCapabilityContractCli,
} from "../scripts/product_capability_contract.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const contractPath = path.join(root, "config", "product_capabilities.json");
const contract = JSON.parse(fs.readFileSync(contractPath, "utf8"));
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const unitySmokePath = path.join(root, "tools", "unity_csharp_compile_smoke.ps1");

function runUnitySmoke(args = [], env = {}) {
  return spawnSync(
    "powershell",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", unitySmokePath, ...args],
    {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, ...env },
      shell: false,
      windowsHide: true,
    }
  );
}

function hostedIdentity(receiptPath) {
  return {
    GITHUB_ACTIONS: "true",
    GITHUB_SHA: "a".repeat(40),
    GITHUB_RUN_ID: "123456789",
    GITHUB_RUN_ATTEMPT: "2",
    GITHUB_REPOSITORY: "YuriHKj/botc-solo-simulator",
    GITHUB_WORKFLOW: "Capability contract CI",
    RUNNER_ENVIRONMENT: "github-hosted",
    RUNNER_OS: "Linux",
    BOTC_HOSTED_UNITY_EVIDENCE_PATH: receiptPath,
    BOTC_HOSTED_UNITY_SOURCE_REVISION: "b".repeat(40),
  };
}

function passingHostedWriterEnvironment(receiptPath) {
  return {
    ...hostedIdentity(receiptPath),
    BOTC_HOSTED_UNITY_STATUS: "pass",
    BOTC_HOSTED_UNITY_LICENSE_READY: "true",
    BOTC_HOSTED_UNITY_LICENSE_MODE: "personal",
    BOTC_HOSTED_UNITY_ACTIVATION_OUTCOME: "success",
    BOTC_HOSTED_UNITY_ACTION_OUTCOME: "success",
    BOTC_HOSTED_UNITY_ENGINE_EXIT_CODE: "0",
    BOTC_HOSTED_UNITY_CLEAN_INPUTS: "true",
    BOTC_HOSTED_UNITY_CACHE_USED: "false",
    BOTC_HOSTED_UNITY_FAILURE_KIND: "",
  };
}

function snapshotFiles(directory, ignoredPrefixes = []) {
  const snapshot = new Map();
  function visit(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      const relativePath = path.relative(directory, fullPath).replaceAll(path.sep, "/");
      if (ignoredPrefixes.some((prefix) => relativePath === prefix || relativePath.startsWith(`${prefix}/`))) continue;
      if (entry.isDirectory()) visit(fullPath);
      else snapshot.set(relativePath, fs.readFileSync(fullPath));
    }
  }
  visit(directory);
  return snapshot;
}

function assertSnapshotsEqual(actual, expected, message) {
  assert.deepEqual([...actual.keys()].sort(), [...expected.keys()].sort(), message);
  for (const [relativePath, expectedContent] of expected) {
    assert.deepEqual(actual.get(relativePath), expectedContent, `${message}: ${relativePath}`);
  }
}

function writeFixture(tempRoot, fixtureContract = contract) {
  const fixtureContractPath = path.join(tempRoot, "config", "product_capabilities.json");
  fs.mkdirSync(path.dirname(fixtureContractPath), { recursive: true });
  fs.writeFileSync(fixtureContractPath, `${JSON.stringify(fixtureContract, null, 2)}\n`);
  fs.writeFileSync(path.join(tempRoot, "README.md"), "fixture readme\n");
  const scripts = Object.fromEntries(
    [...ALLOWED_CI_EVIDENCE_SCRIPTS].map((scriptName) => [scriptName, packageJson.scripts[scriptName]])
  );
  fs.writeFileSync(path.join(tempRoot, "package.json"), `${JSON.stringify({ type: "module", scripts }, null, 2)}\n`);
  const writeExit = runCapabilityContractCli([
    "write",
    "--root",
    tempRoot,
    "--contract",
    fixtureContractPath,
  ]);
  assert.equal(writeExit, 0, "fixture generated docs should be writable");
  return fixtureContractPath;
}

function testPackageScriptsAndWorkflow() {
  const scripts = packageJson.scripts;
  assert.equal(scripts["capabilities:inspect"], "node scripts/product_capability_contract.mjs inspect --json");
  assert.equal(scripts["capabilities:write"], "node scripts/product_capability_contract.mjs write");
  assert.equal(scripts["capabilities:check"], "node scripts/product_capability_contract.mjs check");
  assert.equal(scripts["capabilities:verify"], "node scripts/run_product_capability_ci.mjs");
  assert.equal(
    scripts["test:product-capabilities"],
    "node tests/product_capability_contracts.mjs && node tests/product_capability_ci_runner.mjs"
  );
  assert.equal(
    scripts["test:ai-flagship-replay"],
    "node tests/ai_flagship_replay_eval_contracts.mjs",
    "the replay evidence script body is part of the reviewed contract"
  );
  assert.equal(
    scripts.test.split("npm run test:product-capabilities").length - 1,
    1,
    "npm test must reach the focused capability suite exactly once"
  );
  assert.equal(
    scripts.test.split("npm run test:ai-flagship-replay").length - 1,
    1,
    "npm test must reach the flagship replay gate exactly once"
  );

  const workflow = fs.readFileSync(path.join(root, ".github", "workflows", "ci.yml"), "utf8");
  assert.match(workflow, /pull_request:\s*\n\s*branches:\s*\[\s*(?:dev, main|main, dev)\s*\]/u);
  assert.match(workflow, /push:\s*\n\s*branches:\s*\[\s*(?:dev, main|main, dev)\s*\]/u);
  assert.doesNotMatch(workflow, /pull_request_target/u);
  assert.doesNotMatch(workflow, /^\s+paths(?:-ignore)?:/mu, "path awareness must stay inside the always-present workflow");
  assert.match(workflow, /permissions:\s*\n\s*contents:\s*read/u);
  assert.match(workflow, /name:\s*capability-contract/u);
  assert.match(workflow, /needs:\s*\[route_hosted_unity, hosted_unity\]/u);
  assert.match(workflow, /if:\s*\$\{\{ always\(\) \}\}/u);
  assert.match(workflow, /runs-on:\s*windows-latest/u);
  assert.match(workflow, /runs-on:\s*ubuntu-latest/u);
  assert.match(workflow, /uses:\s*actions\/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5\s*#\s*v4/u);
  assert.match(workflow, /uses:\s*actions\/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020\s*#\s*v4/u);
  assert.match(workflow, /uses:\s*actions\/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02\s*#\s*v4/u);
  assert.match(workflow, /uses:\s*actions\/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093\s*#\s*v4/u);
  assert.doesNotMatch(workflow, /uses:\s*game-ci\/unity-activate@/u);
  assert.match(workflow, /uses:\s*game-ci\/unity-builder@1d4ee0697f193f54668e98961d79907911f4b4f2\s*#\s*v4/u);
  assert.match(workflow, /node-version:\s*["']?22["']?/u);
  assert.match(workflow, /run:\s*npm ci/u);
  assert.equal(
    workflow.match(/git diff --no-renames --name-only -z/gu)?.length,
    2,
    "both PR and push routing must use NUL-delimited Git paths"
  );
  assert.match(workflow, /while IFS= read -r -d '' changed_path/u);
  assert.match(
    workflow,
    /Git pathnames can contain newlines and non-ASCII bytes; NUL transport preserves them losslessly\./u,
    "the raw NUL transport rationale must remain reviewable"
  );
  assert.match(workflow, /hosted_required=true/u);
  assert.match(workflow, /\.github\/workflows\/\*/u);
  assert.match(workflow, /unity-prototype\/Assets\/\*\.cs/u);
  assert.match(workflow, /unity-prototype\/Assets\/\*\.asmdef/u);
  assert.match(workflow, /unity-prototype\/Assets\/\*\.asmref/u);
  assert.match(workflow, /unity-prototype\/Assets\/\*\.rsp/u);
  assert.match(workflow, /unity-prototype\/Assets\/\*\.dll/u);
  assert.match(workflow, /unity-prototype\/Packages\/\*/u);
  assert.match(workflow, /unity-prototype\/ProjectSettings\/\*/u);
  assert.match(workflow, /config\/product_capabilities\.json/u);
  assert.match(workflow, /tests\/product_capability_ci_runner\.mjs/u);
  assert.doesNotMatch(workflow, /unity-prototype\/Assets\/\*\*|unity-prototype\/Assets\/\*\)/u);
  assert.match(workflow, /unityVersion:\s*2022\.3\.62f3/u);
  assert.match(workflow, /projectPath:\s*unity-prototype/u);
  assert.match(workflow, /targetPlatform:\s*StandaloneLinux64/u);
  assert.match(workflow, /environment:\s*hosted-unity-compile/u);
  assert.match(workflow, /UNITY_LICENSE:\s*\$\{\{ secrets\.UNITY_LICENSE \}\}/u);
  assert.match(workflow, /UNITY_SERIAL:\s*\$\{\{ secrets\.UNITY_SERIAL \}\}/u);
  assert.match(workflow, /UNITY_EMAIL:\s*\$\{\{ secrets\.UNITY_EMAIL \}\}/u);
  assert.match(workflow, /UNITY_PASSWORD:\s*\$\{\{ secrets\.UNITY_PASSWORD \}\}/u);
  assert.match(workflow, /elif \[\[ -n "\$UNITY_LICENSE" \]\]; then/u);
  assert.doesNotMatch(
    workflow,
    /elif \[\[ -n "\$UNITY_LICENSE" && -n "\$UNITY_EMAIL" && -n "\$UNITY_PASSWORD" \]\]; then/u,
    "a GameCI personal license is complete when UNITY_LICENSE alone is present"
  );
  assert.match(workflow, /licensing-unavailable/u);
  assert.match(workflow, /unity-activation-or-execution-failed/u);
  assert.doesNotMatch(workflow, /licensing-activation-failed|unity-execution-failed-after-activation/u);
  assert.equal(
    workflow.match(/RUNNER_ENVIRONMENT:\s*\$\{\{ runner\.environment \}\}/gu)?.length,
    2,
    "runner context must be evaluated only on the receipt writer and hosted verifier steps"
  );
  assert.match(workflow, /name:\s*Write revision-bound hosted receipt[\s\S]*?env:\s*\n\s*RUNNER_ENVIRONMENT:/u);
  assert.match(workflow, /name:\s*Verify current hosted capability evidence[\s\S]*?env:\s*\n\s*RUNNER_ENVIRONMENT:/u);
  assert.match(workflow, /-WriteHostedEvidence/u);
  assert.match(workflow, /hosted-unity-csharp-evidence/u);
  assert.match(workflow, /retention-days:\s*7/u);
  assert.doesNotMatch(workflow, /uses:\s*actions\/cache@/u);
  assert.doesNotMatch(workflow, /skipActivation:\s*true/u);
  assert.match(workflow, /npm run capabilities:check/u);
  assert.match(workflow, /\$asOf = \(Get-Date\)\.ToUniversalTime\(\)\.ToString\("yyyy-MM-dd"\)/u);
  assert.match(workflow, /npm run capabilities:verify -- --as-of \$asOf/u);
  assert.match(workflow, /needs\.hosted_unity\.result/u);
  assert.match(workflow, /steps\.download\.outcome/u);
  assert.match(workflow, /steps\.verify_hosted\.outcome/u);
  assert.match(fs.readFileSync(path.join(root, ".gitignore"), "utf8"), /^output\/$/mu);

  const hostedVerification = fs.readFileSync(
    path.join(root, "docs", "verification", "HOSTED_UNITY_CSHARP_2026-07-20.md"),
    "utf8"
  );
  assert.match(hostedVerification, /environment secrets/u);
  assert.match(hostedVerification, /required trusted reviewers/u);
  assert.match(hostedVerification, /self-review disabled/u);
  assert.match(hostedVerification, /external repository configuration remains a blocker/u);
}

function testBareInspectPackageScript() {
  const args = ["--silent", "run", "capabilities:inspect"];
  const invocation = process.env.npm_execpath
    ? { executable: process.execPath, args: [process.env.npm_execpath, ...args] }
    : process.platform === "win32"
      ? { executable: process.env.ComSpec ?? "cmd.exe", args: ["/d", "/s", "/c", "npm.cmd", ...args] }
      : { executable: "npm", args };
  const inspected = spawnSync(invocation.executable, invocation.args, {
    cwd: root,
    encoding: "utf8",
    shell: false,
    windowsHide: true,
  });
  assert.equal(inspected.status, 0, inspected.stderr);
  assert.equal(JSON.parse(inspected.stdout).valid, true);
}

function testDistinctCollectionAndFailClosedSafety() {
  const commands = collectCiRunCommands(contract);
  const reviewedDefinitions = {
    "test:role-actions": "node tests/role_action_contracts.mjs",
    "test:full-game-loop": "node tests/full_game_loop_contracts.mjs",
    "test:unity-demo-acceptance": "node scripts/unity_demo_acceptance.mjs",
    "test:unity-viewmodel": "node tests/unity_viewmodel_contracts.mjs",
    "test:unity-csharp-smoke": "powershell -ExecutionPolicy Bypass -File tools/unity_csharp_compile_smoke.ps1",
    "test:ai-flagship-replay": "node tests/ai_flagship_replay_eval_contracts.mjs",
    "test:electron-build": "node tests/electron_build_contracts.cjs",
    "test:ai-llm-renderer": "node tests/ai_llm_renderer_contracts.mjs",
  };
  assert.deepEqual(
    Object.fromEntries(ALLOWED_CI_EVIDENCE_SCRIPTS.map((scriptName) => [scriptName, packageJson.scripts[scriptName]])),
    reviewedDefinitions,
    "all allowlisted script bodies must remain pinned to their reviewed definitions"
  );
  assert.deepEqual(commands, [
    "npm run test:role-actions",
    "npm run test:unity-demo-acceptance",
    "npm run test:unity-viewmodel",
    "npm run test:unity-csharp-smoke",
    "npm run test:ai-flagship-replay",
    "npm run test:full-game-loop",
    "npm run test:electron-build",
    "npm run test:ai-llm-renderer",
  ]);
  assert.equal(commands.filter((command) => command === "npm run test:role-actions").length, 1);
  assert.deepEqual(
    validateCiRunCommands(commands, packageJson.scripts).map((entry) => entry.scriptName),
    commands.map((command) => command.slice("npm run ".length))
  );

  for (const rejected of [
    "npm test",
    "npm run capabilities:verify",
    "npm run capabilities:write",
    "npm run package:unity-ai",
    "npm run release:unity-ai:verified",
    "npm run prepare:local-llm",
    "npm run ai:llm-dialogue-eval:live",
    "npm run test:unity-playable-flow",
    "npm run test:not-declared-safe",
    "npm run test:role-actions && npm test",
  ]) {
    assert.throws(
      () => validateCiRunCommands([rejected], { ...packageJson.scripts, "test:not-declared-safe": "node -e \"\"" }),
      /not an explicitly allowed PR-safe evidence script|must have the exact form/u,
      rejected
    );
  }
  assert.throws(
    () => validateCiRunCommands(["npm run test:role-actions"], {}),
    /does not exist in package.json/u
  );
  assert.throws(
    () => validateCiRunCommands(["npm run test:role-actions"], { "test:role-actions": "npm test" }),
    /does not match its reviewed PR-safe definition/u
  );
  for (const scriptName of ["test:role-actions", "test:ai-flagship-replay"]) {
    for (const lifecycleName of [`pre${scriptName}`, `post${scriptName}`]) {
      assert.throws(
        () => validateCiRunCommands([`npm run ${scriptName}`], { ...packageJson.scripts, [lifecycleName]: "npm test" }),
        /cannot declare npm lifecycle hooks/u,
        lifecycleName
      );
    }
  }
  assert.deepEqual(collectCiRunCommands({ tracks: 42 }), []);
}

function testShellFreeNpmInvocation() {
  const scriptName = "test:role-actions";
  const npmCli = "C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js";
  const node = "C:\\Program Files\\nodejs\\node.exe";
  assert.deepEqual(
    buildNpmInvocation(scriptName, {
      platform: "win32",
      npmExecPath: npmCli,
      nodeExecPath: node,
      comSpec: "C:\\Windows\\System32\\cmd.exe",
    }),
    { executable: node, args: [npmCli, "run", scriptName], shell: false }
  );
  assert.deepEqual(
    buildNpmInvocation(scriptName, {
      platform: "win32",
      npmExecPath: null,
      nodeExecPath: node,
      comSpec: "C:\\Windows\\System32\\cmd.exe",
    }),
    {
      executable: "C:\\Windows\\System32\\cmd.exe",
      args: ["/d", "/s", "/c", "npm.cmd", "run", scriptName],
      shell: false,
    }
  );
  assert.deepEqual(buildNpmInvocation(scriptName, { platform: "linux" }), {
    executable: "npm",
    args: ["run", scriptName],
    shell: false,
  });
  assert.throws(
    () => buildNpmInvocation("test:role-actions && npm test", { platform: "win32", npmExecPath: null }),
    /non-allowlisted/u
  );
}

function testRevisionSelection() {
  const sha = "a".repeat(40);
  assert.equal(selectEvidenceRevision({ explicitRevision: "fixture-revision", head: sha, dirty: false }), "fixture-revision");
  assert.equal(selectEvidenceRevision({ explicitRevision: "fixture-revision", githubSha: sha, head: "b".repeat(40), dirty: true }), sha);
  assert.equal(selectEvidenceRevision({ githubSha: sha, head: "b".repeat(40), dirty: true }), sha);
  assert.equal(selectEvidenceRevision({ head: sha, dirty: false }), `worktree:${sha}`);
  assert.equal(selectEvidenceRevision({ head: sha, dirty: true }), `worktree:${sha}:dirty`);
  assert.throws(() => selectEvidenceRevision({ githubSha: "main", head: sha, dirty: false }), /GITHUB_SHA/u);
  assert.throws(() => selectEvidenceRevision({ head: "", dirty: false }), /HEAD revision/u);
}

function testHostedUnityReceiptWriterAndValidator() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "botc-hosted-unity-receipt-"));
  try {
    const receiptPath = path.join(tempRoot, "hosted-unity-csharp.json");
    const writerEnvironment = passingHostedWriterEnvironment(receiptPath);
    const written = runUnitySmoke(["-WriteHostedEvidence"], writerEnvironment);
    assert.equal(written.status, 0, `${written.stdout}\n${written.stderr}`);

    const receipt = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
    assert.equal(receipt.schema, "botc-hosted-unity-csharp-evidence");
    assert.equal(receipt.version, 1);
    assert.equal(receipt.status, "pass");
    assert.equal(receipt.testedRevision, writerEnvironment.GITHUB_SHA);
    assert.equal(receipt.sourceRevision, writerEnvironment.BOTC_HOSTED_UNITY_SOURCE_REVISION);
    assert.equal(receipt.runId, writerEnvironment.GITHUB_RUN_ID);
    assert.equal(receipt.runAttempt, 2);
    assert.equal(receipt.runnerEnvironment, "github-hosted");
    assert.equal(receipt.runnerOs, "Linux");
    assert.equal(receipt.unityVersion, "2022.3.62f3");
    assert.equal(receipt.projectVersionRevision, "96770f904ca7");
    assert.equal(receipt.licenseReady, true);
    assert.equal(receipt.licenseMode, "personal");
    assert.equal(receipt.activationOutcome, "success");
    assert.equal(receipt.unityOutcome, "success");
    assert.equal(receipt.engineExitCode, 0);
    assert.equal(receipt.cleanInputs, true);
    assert.equal(receipt.cacheUsed, false);
    assert.equal(receipt.failureKind, null);
    assert.match(receipt.generatedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/u);

    const validationEnvironment = {
      ...hostedIdentity(receiptPath),
      BOTC_HOSTED_UNITY_EVIDENCE_REQUIRED: "1",
    };
    const validated = runUnitySmoke([], validationEnvironment);
    assert.equal(validated.status, 0, `${validated.stdout}\n${validated.stderr}`);
    assert.match(validated.stdout, /HOSTED_UNITY_EVIDENCE=pass/u);

    const failReceiptPath = path.join(tempRoot, "hosted-unity-csharp-fail.json");
    const failureWritten = runUnitySmoke(["-WriteHostedEvidence"], {
      ...hostedIdentity(failReceiptPath),
      BOTC_HOSTED_UNITY_STATUS: "fail",
      BOTC_HOSTED_UNITY_LICENSE_READY: "false",
      BOTC_HOSTED_UNITY_LICENSE_MODE: "none",
      BOTC_HOSTED_UNITY_ACTIVATION_OUTCOME: "not-run",
      BOTC_HOSTED_UNITY_ACTION_OUTCOME: "not-run",
      BOTC_HOSTED_UNITY_ENGINE_EXIT_CODE: "",
      BOTC_HOSTED_UNITY_CLEAN_INPUTS: "true",
      BOTC_HOSTED_UNITY_CACHE_USED: "false",
      BOTC_HOSTED_UNITY_FAILURE_KIND: "licensing-unavailable",
    });
    assert.equal(failureWritten.status, 0, `${failureWritten.stdout}\n${failureWritten.stderr}`);
    const failureReceipt = JSON.parse(fs.readFileSync(failReceiptPath, "utf8"));
    assert.equal(failureReceipt.status, "fail");
    assert.equal(failureReceipt.failureKind, "licensing-unavailable");
    assert.equal(failureReceipt.engineExitCode, null);
    const rejectedFailure = runUnitySmoke([], {
      ...hostedIdentity(failReceiptPath),
      BOTC_HOSTED_UNITY_EVIDENCE_REQUIRED: "1",
    });
    assert.notEqual(rejectedFailure.status, 0, "a machine-readable failure receipt must fail certification");

    const combinedFailureWritten = runUnitySmoke(["-WriteHostedEvidence"], {
      ...hostedIdentity(failReceiptPath),
      BOTC_HOSTED_UNITY_STATUS: "fail",
      BOTC_HOSTED_UNITY_LICENSE_READY: "true",
      BOTC_HOSTED_UNITY_LICENSE_MODE: "personal",
      BOTC_HOSTED_UNITY_ACTIVATION_OUTCOME: "unknown",
      BOTC_HOSTED_UNITY_ACTION_OUTCOME: "unknown",
      BOTC_HOSTED_UNITY_ENGINE_EXIT_CODE: "",
      BOTC_HOSTED_UNITY_CLEAN_INPUTS: "true",
      BOTC_HOSTED_UNITY_CACHE_USED: "false",
      BOTC_HOSTED_UNITY_FAILURE_KIND: "unity-activation-or-execution-failed",
    });
    assert.equal(combinedFailureWritten.status, 0, `${combinedFailureWritten.stdout}\n${combinedFailureWritten.stderr}`);
    const combinedFailureReceipt = JSON.parse(fs.readFileSync(failReceiptPath, "utf8"));
    assert.equal(combinedFailureReceipt.failureKind, "unity-activation-or-execution-failed");
    assert.equal(combinedFailureReceipt.activationOutcome, "unknown");
    assert.equal(combinedFailureReceipt.unityOutcome, "unknown");
    assert.equal(combinedFailureReceipt.engineExitCode, null);
    const rejectedCombinedFailure = runUnitySmoke([], {
      ...hostedIdentity(failReceiptPath),
      BOTC_HOSTED_UNITY_EVIDENCE_REQUIRED: "1",
    });
    assert.notEqual(rejectedCombinedFailure.status, 0, "an ambiguous Builder failure receipt must fail certification");

    const validReceipt = structuredClone(receipt);
    const mutations = [
      ["schema", "other-schema"],
      ["version", 2],
      ["status", "fail"],
      ["testedRevision", "c".repeat(40)],
      ["sourceRevision", "c".repeat(40)],
      ["repository", "other/repository"],
      ["workflow", "Other workflow"],
      ["runId", "987654321"],
      ["runAttempt", 3],
      ["runnerEnvironment", "self-hosted"],
      ["runnerOs", "Windows"],
      ["unityVersion", "2022.3.61f1"],
      ["projectVersionRevision", "deadbeef"],
      ["licenseReady", false],
      ["licenseMode", "none"],
      ["activationOutcome", "unknown"],
      ["unityOutcome", "unknown"],
      ["engineExitCode", 1],
      ["cleanInputs", false],
      ["cacheUsed", true],
      ["failureKind", "unity-activation-or-execution-failed"],
    ];
    for (const [field, value] of mutations) {
      fs.writeFileSync(receiptPath, `${JSON.stringify({ ...validReceipt, [field]: value }, null, 2)}\n`);
      const rejected = runUnitySmoke([], validationEnvironment);
      assert.notEqual(rejected.status, 0, `validator must reject mismatched ${field}`);
    }

    fs.writeFileSync(receiptPath, "{ malformed\n");
    assert.notEqual(runUnitySmoke([], validationEnvironment).status, 0, "malformed JSON must fail closed");
    fs.rmSync(receiptPath);
    assert.notEqual(runUnitySmoke([], validationEnvironment).status, 0, "missing receipt must fail closed");

    const nonHosted = runUnitySmoke([], {
      ...validationEnvironment,
      GITHUB_ACTIONS: "false",
    });
    assert.notEqual(nonHosted.status, 0, "hosted certification must reject a non-Actions environment");

    const noLocalFallback = runUnitySmoke(
      ["-UnityEditor", path.join(tempRoot, "does-not-exist"), "-Dotnet", path.join(tempRoot, "also-missing")],
      validationEnvironment
    );
    assert.notEqual(noLocalFallback.status, 0);
    assert.doesNotMatch(
      `${noLocalFallback.stdout}\n${noLocalFallback.stderr}`,
      /Unity editor .* not found|dotnet|Roslyn/u,
      "hosted-required mode must reject evidence before any local compiler discovery"
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

async function testManifestPassFailBindingsTruncationAndReadOnlyCheck() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "botc-capability-ci-"));
  try {
    const fixtureContractPath = writeFixture(tempRoot);
    const resultsPath = path.join(tempRoot, "output", "capability-results.json");
    const before = snapshotFiles(tempRoot, ["output"]);
    const seen = [];
    const longOutput = "diagnostic-".repeat(1000);
    const passingExit = await runProductCapabilityCi({
      root: tempRoot,
      contractPath: fixtureContractPath,
      resultsPath,
      revision: "fixture-pass",
      githubSha: null,
      executeScript: async ({ command, scriptName, environment }) => {
        seen.push({ scriptName, environment });
        return { exitCode: 0, stdout: `${command}\n${longOutput}`, stderr: "" };
      },
      log: () => {},
    });
    assert.equal(passingExit, 0);
    assert.deepEqual(
      seen.map((entry) => entry.scriptName),
      collectCiRunCommands(contract).map((command) => command.slice("npm run ".length))
    );
    assert.equal(new Set(seen.map((entry) => entry.scriptName)).size, seen.length, "each distinct evidence script must execute exactly once");
    for (const entry of seen) {
      if (entry.scriptName === "test:unity-csharp-smoke") {
        assert.deepEqual(entry.environment, { BOTC_HOSTED_UNITY_EVIDENCE_REQUIRED: "1" });
      } else {
        assert.deepEqual(entry.environment, {}, `${entry.scriptName} must not inherit hosted-required mode`);
      }
    }

    const passingManifest = JSON.parse(fs.readFileSync(resultsPath, "utf8"));
    assert.equal(passingManifest.schema, CI_RESULTS_SCHEMA);
    assert.equal(passingManifest.version, CI_RESULTS_VERSION);
    assert.equal(passingManifest.revision, "fixture-pass");
    assert.equal(passingManifest.contractHash, hashCapabilityContract(contract));
    assert.equal(passingManifest.results.length, seen.length);
    for (const result of passingManifest.results) {
      assert.equal(result.revision, passingManifest.revision);
      assert.equal(result.contractHash, passingManifest.contractHash);
      assert.equal(result.exitCode, 0);
      assert.ok(result.diagnostics.stdout.length <= 4096, "diagnostics must be bounded");
      assert.equal(result.diagnostics.stdoutTruncated, true);
    }
    const evaluated = evaluateCapabilityContract(contract, {
      revision: passingManifest.revision,
      executionResults: passingManifest.results,
    });
    assert.equal(evaluated.compliance.currentVerificationCompliant, true);
    const passingFlagship = evaluated.tracks.find((entry) => entry.id === "tb-unity-deterministic");
    assert.equal(passingFlagship.engineeringMaturity, "stable");
    assert.equal(passingFlagship.default, true);
    assert.equal(passingFlagship.distribution.intendedClass, "private-development");
    assert.equal(passingFlagship.distribution.publicDistribution, "blocked");
    assert.equal(
      passingFlagship.gates
        .find((entry) => entry.id === "automated-contracts")
        .evidence.find((entry) => entry.id === "tb-ai-flagship-replay").state,
      "passed"
    );
    assert.equal(
      passingFlagship.gates
        .find((entry) => entry.id === "automated-contracts")
        .evidence.find((entry) => entry.id === "tb-hosted-unity-csharp-compile").state,
      "passed"
    );
    assertSnapshotsEqual(snapshotFiles(tempRoot, ["output"]), before, "runner check must not write tracked fixture files");

    const replayFailureRevision = "fixture-replay-fail";
    const replaySeen = [];
    const replayFailureExit = await runProductCapabilityCi({
      root: tempRoot,
      contractPath: fixtureContractPath,
      resultsPath,
      revision: replayFailureRevision,
      githubSha: null,
      executeScript: async ({ command, scriptName }) => {
        replaySeen.push(command);
        return {
          exitCode: scriptName === "test:ai-flagship-replay" ? 23 : 0,
          stdout: command,
          stderr: scriptName === "test:ai-flagship-replay" ? "injected replay failure" : "",
        };
      },
      log: () => {},
    });
    assert.equal(replayFailureExit, 1, "replay evidence failure must fail strict verification");
    assert.deepEqual(replaySeen, collectCiRunCommands(contract), "replay failure must not stop later evidence");
    const replayFailureManifest = JSON.parse(fs.readFileSync(resultsPath, "utf8"));
    const replayIndex = replayFailureManifest.results.findIndex(
      (entry) => entry.command === "npm run test:ai-flagship-replay"
    );
    assert.ok(replayIndex >= 0, "replay result must be recorded");
    const replayFailure = replayFailureManifest.results[replayIndex];
    assert.equal(replayFailure.exitCode, 23);
    assert.equal(replayFailure.revision, replayFailureRevision);
    assert.equal(replayFailure.contractHash, hashCapabilityContract(contract));
    assert.ok(
      replayFailureManifest.results.slice(replayIndex + 1).every((entry) => entry.exitCode === 0),
      "all evidence after the replay gate must still execute"
    );
    const replayFailedEvaluation = evaluateCapabilityContract(contract, {
      revision: replayFailureRevision,
      executionResults: replayFailureManifest.results,
    });
    const replayFailedFlagship = replayFailedEvaluation.tracks.find(
      (entry) => entry.id === "tb-unity-deterministic"
    );
    assert.equal(replayFailedFlagship.gates.find((entry) => entry.id === "automated-contracts").state, "failed");
    assert.equal(replayFailedFlagship.engineeringMaturity, "stable");
    assert.equal(replayFailedFlagship.default, true);
    assert.equal(replayFailedFlagship.distribution.intendedClass, "private-development");
    assert.equal(replayFailedFlagship.distribution.publicDistribution, "blocked");

    const unityFailureRevision = "fixture-hosted-unity-fail";
    const unitySeen = [];
    const unityFailureExit = await runProductCapabilityCi({
      root: tempRoot,
      contractPath: fixtureContractPath,
      resultsPath,
      revision: unityFailureRevision,
      githubSha: null,
      executeScript: async ({ command, scriptName, environment }) => {
        unitySeen.push({ command, scriptName, environment });
        return {
          exitCode: scriptName === "test:unity-csharp-smoke" ? 31 : 0,
          stdout: command,
          stderr: scriptName === "test:unity-csharp-smoke" ? "injected hosted Unity evidence failure" : "",
        };
      },
      log: () => {},
    });
    assert.equal(unityFailureExit, 1, "hosted Unity validation failure must fail strict verification");
    assert.deepEqual(
      unitySeen.map((entry) => entry.command),
      collectCiRunCommands(contract),
      "hosted Unity failure must not stop later evidence"
    );
    const unityFailureManifest = JSON.parse(fs.readFileSync(resultsPath, "utf8"));
    const unityResult = unityFailureManifest.results.find(
      (entry) => entry.command === "npm run test:unity-csharp-smoke"
    );
    assert.equal(unityResult.exitCode, 31);
    assert.equal(unityResult.revision, unityFailureRevision);
    assert.equal(unityResult.contractHash, hashCapabilityContract(contract));
    const unityFailedEvaluation = evaluateCapabilityContract(contract, {
      revision: unityFailureRevision,
      executionResults: unityFailureManifest.results,
    });
    const unityFailedFlagship = unityFailedEvaluation.tracks.find(
      (entry) => entry.id === "tb-unity-deterministic"
    );
    assert.equal(unityFailedFlagship.gates.find((entry) => entry.id === "automated-contracts").state, "failed");
    assert.equal(unityFailedFlagship.engineeringMaturity, "stable");
    assert.equal(unityFailedFlagship.default, true);
    assert.equal(unityFailedFlagship.distribution.intendedClass, "private-development");
    assert.equal(unityFailedFlagship.distribution.publicDistribution, "blocked");

    let call = 0;
    const failingExit = await runProductCapabilityCi({
      root: tempRoot,
      contractPath: fixtureContractPath,
      resultsPath,
      revision: "fixture-fail",
      githubSha: null,
      executeScript: async ({ command }) => {
        const currentCall = call++;
        if (currentCall === 1) throw new Error("injected spawn failure");
        return {
          exitCode: currentCall === 0 ? 7 : 0,
          stdout: command,
          stderr: currentCall === 0 ? "bounded failure" : "",
        };
      },
      log: () => {},
    });
    assert.equal(failingExit, 1, "failed evidence must fail strict verification");
    const failingManifest = JSON.parse(fs.readFileSync(resultsPath, "utf8"));
    assert.equal(failingManifest.results.length, seen.length, "a failed command must not stop later evidence execution");
    assert.equal(failingManifest.results[0].exitCode, 7);
    assert.equal(failingManifest.results[1].exitCode, 127, "executor errors must be recorded as bounded failures");
    assert.match(failingManifest.results[1].diagnostics.stderr, /injected spawn failure/u);
    assert.ok(failingManifest.results.slice(2).every((entry) => entry.exitCode === 0));

    const timeoutSeen = [];
    const timeoutExit = await runProductCapabilityCi({
      root: tempRoot,
      contractPath: fixtureContractPath,
      resultsPath,
      revision: "fixture-timeout",
      githubSha: null,
      commandTimeoutMs: 20,
      executeScript: async ({ scriptName }) => {
        timeoutSeen.push(scriptName);
        if (timeoutSeen.length === 1) return await new Promise(() => {});
        return { exitCode: 0, stdout: scriptName, stderr: "" };
      },
      log: () => {},
    });
    assert.equal(timeoutExit, 1);
    assert.equal(timeoutSeen.length, seen.length, "a timed-out command must not block later evidence commands");
    const timeoutManifest = JSON.parse(fs.readFileSync(resultsPath, "utf8"));
    assert.equal(timeoutManifest.results[0].exitCode, 124);
    assert.match(timeoutManifest.results[0].diagnostics.stderr, /exceeded 20 ms/u);
    assert.ok(timeoutManifest.results.slice(1).every((entry) => entry.exitCode === 0));

    const laboratoryFailureExit = await runProductCapabilityCi({
      root: tempRoot,
      contractPath: fixtureContractPath,
      resultsPath,
      revision: "fixture-laboratory-fail",
      githubSha: null,
      executeScript: async ({ scriptName }) => ({
        exitCode: scriptName === "test:ai-llm-renderer" ? 5 : 0,
        stdout: scriptName,
        stderr: "",
      }),
      log: () => {},
    });
    assert.equal(laboratoryFailureExit, 1, "any declared evidence failure must fail the CI runner");

    const wrongRevision = evaluateCapabilityContract(contract, {
      revision: "different-revision",
      executionResults: passingManifest.results,
    });
    assert.equal(wrongRevision.compliance.currentVerificationCompliant, false);
    const wrongHashResults = structuredClone(passingManifest.results);
    for (const result of wrongHashResults) result.contractHash = `sha256:${"0".repeat(64)}`;
    const wrongHash = evaluateCapabilityContract(contract, {
      revision: passingManifest.revision,
      executionResults: wrongHashResults,
    });
    assert.equal(wrongHash.compliance.currentVerificationCompliant, false);
    assertSnapshotsEqual(snapshotFiles(tempRoot, ["output"]), before, "failed runner check must remain read-only");
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

async function testAsOfDateReachesExpiringStableEvidence() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "botc-capability-ci-as-of-"));
  try {
    const datedContract = structuredClone(contract);
    const intendedDistribution = datedContract.tracks[0].promotionGates.find(
      (gate) => gate.category === "intended-distribution"
    );
    intendedDistribution.evidence = [
      {
        id: "dated-private-development-posture",
        reference: "README.md",
        freshness: { policy: "expires", observedOn: "2026-07-01", expiresOn: "2026-07-31" },
      },
    ];
    const fixtureContractPath = writeFixture(tempRoot, datedContract);
    const resultsPath = path.join(tempRoot, "output", "dated-results.json");
    const executeScript = async ({ scriptName }) => ({ exitCode: 0, stdout: scriptName, stderr: "" });
    const withoutAsOf = await runProductCapabilityCi({
      root: tempRoot,
      contractPath: fixtureContractPath,
      resultsPath,
      revision: "fixture-no-as-of",
      githubSha: null,
      executeScript,
      log: () => {},
    });
    assert.equal(withoutAsOf, 1, "expiring stable evidence must remain unverified without an explicit date");

    const withAsOf = await runProductCapabilityCi({
      root: tempRoot,
      contractPath: fixtureContractPath,
      resultsPath,
      revision: "fixture-with-as-of",
      githubSha: null,
      asOf: "2026-07-13",
      executeScript,
      log: () => {},
    });
    assert.equal(withAsOf, 0, "the runner must forward its explicit date to strict verification");

    let executed = false;
    const invalidAsOf = await runProductCapabilityCi({
      root: tempRoot,
      contractPath: fixtureContractPath,
      resultsPath,
      revision: "fixture-invalid-as-of",
      githubSha: null,
      asOf: "2026-02-30",
      executeScript: async () => {
        executed = true;
        return { exitCode: 0, stdout: "", stderr: "" };
      },
      log: () => {},
    });
    assert.equal(invalidAsOf, 2);
    assert.equal(executed, false, "an invalid as-of date must fail before evidence execution");
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

async function testUnsafeContractIsAnInvocationError() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "botc-capability-ci-unsafe-"));
  try {
    const fixtureContractPath = writeFixture(tempRoot);
    const unsafeContract = structuredClone(contract);
    unsafeContract.tracks[0].promotionGates[0].evidence[0].reference = "npm run capabilities:verify";
    fs.writeFileSync(fixtureContractPath, `${JSON.stringify(unsafeContract, null, 2)}\n`);
    const unsafeResultsPath = path.join(tempRoot, "output", "unsafe-results.json");
    const exitCode = await runProductCapabilityCi({
      root: tempRoot,
      contractPath: fixtureContractPath,
      resultsPath: unsafeResultsPath,
      revision: "fixture-unsafe",
      githubSha: null,
      executeScript: async () => {
        assert.fail("unsafe evidence must never execute");
      },
      log: () => {},
    });
    assert.equal(exitCode, 2);
    assert.equal(fs.existsSync(unsafeResultsPath), false, "an unsafe invocation must not fabricate evidence results");
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

testPackageScriptsAndWorkflow();
testBareInspectPackageScript();
testDistinctCollectionAndFailClosedSafety();
testShellFreeNpmInvocation();
testRevisionSelection();
testHostedUnityReceiptWriterAndValidator();
await testManifestPassFailBindingsTruncationAndReadOnlyCheck();
await testAsOfDateReachesExpiringStableEvidence();
await testUnsafeContractIsAnInvocationError();

console.log("product capability CI runner ok");
