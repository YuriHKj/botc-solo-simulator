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
    scripts.test.split("npm run test:product-capabilities").length - 1,
    1,
    "npm test must reach the focused capability suite exactly once"
  );

  const workflow = fs.readFileSync(path.join(root, ".github", "workflows", "ci.yml"), "utf8");
  assert.match(workflow, /pull_request:\s*\n\s*branches:\s*\[\s*(?:dev, main|main, dev)\s*\]/u);
  assert.match(workflow, /push:\s*\n\s*branches:\s*\[\s*(?:dev, main|main, dev)\s*\]/u);
  assert.match(workflow, /runs-on:\s*windows-latest/u);
  assert.match(workflow, /permissions:\s*\n\s*contents:\s*read/u);
  assert.match(workflow, /timeout-minutes:\s*20/u);
  assert.match(workflow, /uses:\s*actions\/checkout@v4/u);
  assert.match(workflow, /uses:\s*actions\/setup-node@v4/u);
  assert.match(workflow, /node-version:\s*["']?22["']?/u);
  assert.match(workflow, /run:\s*npm ci/u);
  assert.match(workflow, /\$asOf = \(Get-Date\)\.ToUniversalTime\(\)\.ToString\("yyyy-MM-dd"\)/u);
  assert.match(workflow, /npm run capabilities:verify -- --as-of \$asOf/u);
  assert.match(fs.readFileSync(path.join(root, ".gitignore"), "utf8"), /^output\/$/mu);
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
  for (const lifecycleName of ["pretest:role-actions", "posttest:role-actions"]) {
    assert.throws(
      () => validateCiRunCommands(["npm run test:role-actions"], { ...packageJson.scripts, [lifecycleName]: "npm test" }),
      /cannot declare npm lifecycle hooks/u,
      lifecycleName
    );
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
      executeScript: async ({ command, scriptName }) => {
        seen.push(scriptName);
        return { exitCode: 0, stdout: `${command}\n${longOutput}`, stderr: "" };
      },
      log: () => {},
    });
    assert.equal(passingExit, 0);
    assert.deepEqual(seen, collectCiRunCommands(contract).map((command) => command.slice("npm run ".length)));
    assert.equal(new Set(seen).size, seen.length, "each distinct evidence script must execute exactly once");

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
    assertSnapshotsEqual(snapshotFiles(tempRoot, ["output"]), before, "runner check must not write tracked fixture files");

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
await testManifestPassFailBindingsTruncationAndReadOnlyCheck();
await testAsOfDateReachesExpiringStableEvidence();
await testUnsafeContractIsAnInvocationError();

console.log("product capability CI runner ok");
