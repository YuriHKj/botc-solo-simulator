import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  PRODUCT_CAPABILITY_CI_RESULTS_SCHEMA,
  PRODUCT_CAPABILITY_CI_RESULTS_VERSION,
  PRODUCT_CAPABILITY_RESULT_SCHEMA,
  PRODUCT_CAPABILITY_RESULT_VERSION,
  evaluateCapabilityContract,
  hashCapabilityContract,
  renderCapabilityStatus,
  renderReadmeCapabilityBlock,
  validateCapabilityContract,
} from "../scripts/product_capability_contract.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const contractPath = path.join(root, "config", "product_capabilities.json");
const cliPath = path.join(root, "scripts", "product_capability_contract.mjs");
const initialContract = JSON.parse(fs.readFileSync(contractPath, "utf8"));
const expectedGateCategories = ["rules-fidelity", "player-journey", "automated-contracts", "intended-distribution"];
const flagshipReplayLabel = "Fixed-seed replay-invariant evidence";
const flagshipReplayCertifies = [
  "completion",
  "deterministic identity",
  "legality",
  "bounded v1 information safety",
  "repetition",
  "cross-day stance continuity",
  "nomination justification",
  "stance-to-vote alignment",
];
const flagshipReplayNonClaims = [
  "general natural-language quality",
  "known sentence-density or scripted-future-action warning families",
  "behavior/generalization on unseen seeds",
];

function clone(value) {
  return structuredClone(value);
}

function diagnosticCodes(contract) {
  return validateCapabilityContract(contract).map((entry) => entry.code);
}

function assertDiagnostic(contract, expectedCode) {
  const codes = diagnosticCodes(contract);
  assert.ok(codes.includes(expectedCode), `expected ${expectedCode}; got ${codes.join(", ")}`);
}

function uniqueCiCommands(contract) {
  return [
    ...new Set(
      contract.tracks.flatMap((track) =>
        track.promotionGates.flatMap((gate) =>
          gate.evidence.filter((entry) => entry.freshness.policy === "ci-run").map((entry) => entry.reference)
        )
      )
    ),
  ];
}

function passingResults(contract, revision = "revision-1") {
  const contractHash = hashCapabilityContract(contract);
  return uniqueCiCommands(contract).map((command) => ({ command, revision, contractHash, exitCode: 0 }));
}

function executionManifest(contract, revision = "revision-1", results = passingResults(contract, revision)) {
  return {
    schema: PRODUCT_CAPABILITY_CI_RESULTS_SCHEMA,
    version: PRODUCT_CAPABILITY_CI_RESULTS_VERSION,
    revision,
    contractHash: hashCapabilityContract(contract),
    results,
  };
}

function track(result, id) {
  const found = result.tracks.find((entry) => entry.id === id);
  assert.ok(found, `expected evaluated track ${id}`);
  return found;
}

function gate(result, trackId, gateId) {
  const found = result.gates.find((entry) => entry.trackId === trackId && entry.id === gateId);
  assert.ok(found, `expected evaluated gate ${trackId}/${gateId}`);
  return found;
}

function flagshipReplayEvidence(contract) {
  const flagship = contract.tracks.find((entry) => entry.id === "tb-unity-deterministic");
  const automatedContracts = flagship?.promotionGates.find((entry) => entry.id === "automated-contracts");
  return automatedContracts?.evidence.find((entry) => entry.id === "tb-ai-flagship-replay");
}

function assertFlagshipReplayBoundary(content, surface) {
  assert.match(content, new RegExp(flagshipReplayLabel, "u"), `${surface} should name the replay evidence`);
  for (const claim of [...flagshipReplayCertifies, ...flagshipReplayNonClaims]) {
    assert.ok(content.includes(claim), `${surface} should preserve the replay claim boundary: ${claim}`);
  }
}

function withAllCurrentGates(contract, trackId) {
  const copied = clone(contract);
  const selected = copied.tracks.find((entry) => entry.id === trackId);
  for (const promotionGate of selected.promotionGates) {
    promotionGate.evidence = [
      promotionGate.category === "intended-distribution"
        ? {
            id: `${promotionGate.id}-evidence`,
            reference: "README.md",
            freshness: { policy: "evergreen" },
          }
        : {
            id: `${promotionGate.id}-evidence`,
            reference: "docs/verification/CURRENT_REVIEW.md",
            freshness: { policy: "expires", observedOn: "2026-07-01", expiresOn: "2026-07-31" },
          },
    ];
  }
  return copied;
}

function testInitialAuthorityAndResultShape() {
  const result = evaluateCapabilityContract(initialContract);
  assert.equal(result.valid, true, JSON.stringify(result.diagnostics));
  assert.equal(result.schema, PRODUCT_CAPABILITY_RESULT_SCHEMA);
  assert.equal(result.version, PRODUCT_CAPABILITY_RESULT_VERSION);
  assert.equal(result.schemaVersion, 1);
  assert.match(result.hash, /^sha256:[a-f0-9]{64}$/);
  assert.deepEqual(
    result.tracks.map(({ id, engineeringMaturity, default: isDefault }) => [id, engineeringMaturity, isDefault]),
    [
      ["tb-unity-deterministic", "stable", true],
      ["bmr", "laboratory", false],
      ["snv", "laboratory", false],
      ["electron-player-ui", "laboratory", false],
      ["local-llm-renderer", "laboratory", false],
    ]
  );
  for (const capability of result.tracks) {
    assert.deepEqual(
      capability.gates.map((entry) => entry.category),
      expectedGateCategories,
      `${capability.id} should declare the complete promotion gate set`
    );
  }
  for (const key of ["tracks", "gates", "compliance", "eligibility", "distribution", "provenance"]) {
    assert.ok(Object.hasOwn(result, key), `evaluated result should expose ${key}`);
  }
  assert.deepEqual(result.distribution.blockedTrackIds, initialContract.tracks.map((entry) => entry.id));
  const flagship = track(result, initialContract.defaultTrackId);
  assert.equal(flagship.name, "Unity + Trouble Brewing + deterministic AI");
  assert.equal(flagship.entryCommand, "npm run unity:demo");
  assert.ok(flagship.claimAliases.includes("暗流涌动"));

  const stableAutomatedEvidence = initialContract.tracks[0].promotionGates.find(
    (entry) => entry.id === "automated-contracts"
  ).evidence;
  assert.deepEqual(
    stableAutomatedEvidence.map((entry) => entry.reference),
    ["npm run test:unity-viewmodel", "npm run test:ai-flagship-replay"],
    "stable automated evidence order is contract-owned and deterministic"
  );
  const replayEvidence = flagshipReplayEvidence(initialContract);
  assert.ok(replayEvidence, "stable automated contracts should declare flagship replay evidence");
  assert.equal(replayEvidence.label, flagshipReplayLabel);
  assert.deepEqual(replayEvidence.certifies, flagshipReplayCertifies);
  assert.deepEqual(replayEvidence.doesNotCertify, flagshipReplayNonClaims);
}

function testStructuralFailuresAreCollected() {
  assertDiagnostic(null, "invalid-contract");

  const unsupportedSchema = clone(initialContract);
  unsupportedSchema.schemaVersion = 2;
  assertDiagnostic(unsupportedSchema, "unsupported-schema-version");

  const missingTracks = clone(initialContract);
  delete missingTracks.tracks;
  assertDiagnostic(missingTracks, "missing-tracks");

  const duplicateTrack = clone(initialContract);
  duplicateTrack.tracks.push(clone(duplicateTrack.tracks[1]));
  assertDiagnostic(duplicateTrack, "duplicate-track-id");

  const duplicateGate = clone(initialContract);
  duplicateGate.tracks[0].promotionGates[1].id = duplicateGate.tracks[0].promotionGates[0].id;
  assertDiagnostic(duplicateGate, "duplicate-gate-id");

  const missingGate = clone(initialContract);
  missingGate.tracks[0].promotionGates.pop();
  assertDiagnostic(missingGate, "missing-gate-category");

  const unknownGate = clone(initialContract);
  unknownGate.tracks[0].promotionGates[0].category = "gut-feeling";
  assertDiagnostic(unknownGate, "unknown-gate-category");

  const unknownMaturity = clone(initialContract);
  unknownMaturity.tracks[1].engineeringMaturity = "mostly-ready";
  assertDiagnostic(unknownMaturity, "unknown-maturity");

  const unknownFreshness = clone(initialContract);
  unknownFreshness.tracks[0].promotionGates[0].evidence[0].freshness.policy = "whenever";
  assertDiagnostic(unknownFreshness, "unknown-freshness-policy");

  const absoluteReference = clone(initialContract);
  absoluteReference.tracks[0].promotionGates[0].evidence[0].reference = "C:\\evidence.txt";
  assertDiagnostic(absoluteReference, "invalid-evidence-reference");

  const parentReference = clone(initialContract);
  parentReference.tracks[0].promotionGates[0].evidence[0].reference = "../evidence.txt";
  assertDiagnostic(parentReference, "invalid-evidence-reference");

  const invalidAliases = clone(initialContract);
  invalidAliases.tracks[0].claimAliases = "TB";
  assertDiagnostic(invalidAliases, "invalid-claim-aliases");

  const duplicateAlias = clone(initialContract);
  duplicateAlias.tracks[0].claimAliases.push("tb", "TB");
  assertDiagnostic(duplicateAlias, "duplicate-claim-alias");

  const missingEntryCommand = clone(initialContract);
  delete missingEntryCommand.tracks[0].entryCommand;
  assertDiagnostic(missingEntryCommand, "invalid-default-entry-command");

  const invalidEntryCommand = clone(initialContract);
  invalidEntryCommand.tracks[0].entryCommand = "powershell tools/run_unity_demo.ps1";
  assertDiagnostic(invalidEntryCommand, "invalid-default-entry-command");

  const invalidEvidenceLabel = clone(initialContract);
  flagshipReplayEvidence(invalidEvidenceLabel).label = "";
  assertDiagnostic(invalidEvidenceLabel, "invalid-evidence-label");

  const incompleteClaimBoundary = clone(initialContract);
  delete flagshipReplayEvidence(incompleteClaimBoundary).doesNotCertify;
  assertDiagnostic(incompleteClaimBoundary, "incomplete-evidence-claim-boundary");

  const labelOnlyClaimBoundary = clone(initialContract);
  delete flagshipReplayEvidence(labelOnlyClaimBoundary).certifies;
  delete flagshipReplayEvidence(labelOnlyClaimBoundary).doesNotCertify;
  assertDiagnostic(labelOnlyClaimBoundary, "incomplete-evidence-claim-boundary");

  const invalidCertifiedClaims = clone(initialContract);
  flagshipReplayEvidence(invalidCertifiedClaims).certifies = ["completion", "completion"];
  assertDiagnostic(invalidCertifiedClaims, "invalid-evidence-certifies");

  const overlappingClaimBoundary = clone(initialContract);
  flagshipReplayEvidence(overlappingClaimBoundary).doesNotCertify.push("completion");
  assertDiagnostic(overlappingClaimBoundary, "overlapping-evidence-claim-boundary");
}

function testMissingUnverifiedAndStableNoncomplianceDoNotChangeClassification() {
  const before = clone(initialContract);
  const result = evaluateCapabilityContract(initialContract);
  const flagship = track(result, "tb-unity-deterministic");
  assert.equal(gate(result, flagship.id, "rules-fidelity").state, "unverified");
  assert.equal(gate(result, "bmr", "rules-fidelity").state, "missing");
  assert.equal(flagship.compliance.engineeringCompliant, false);
  assert.equal(flagship.engineeringMaturity, "stable", "current evidence failure must not demote a stable track");
  assert.deepEqual(result.compliance.noncompliantStableTrackIds, [flagship.id]);
  assert.equal(flagship.distribution.publicDistribution, "blocked");
  assert.equal(result.valid, true, "a blocked distribution posture must not invalidate a stable engineering classification");
  assert.deepEqual(initialContract, before, "evaluation must not mutate or auto-edit the authoritative contract");
}

function testExecutedEvidenceMustMatchRevisionAndContractHash() {
  const revision = "abc123";
  const results = passingResults(initialContract, revision);
  const passed = evaluateCapabilityContract(initialContract, { revision, executionResults: results });
  assert.equal(gate(passed, "tb-unity-deterministic", "rules-fidelity").state, "passed");
  assert.equal(track(passed, "tb-unity-deterministic").compliance.engineeringCompliant, true);
  assert.equal(gate(passed, "tb-unity-deterministic", "automated-contracts").state, "passed");
  assert.equal(
    gate(passed, "tb-unity-deterministic", "automated-contracts").evidence.find(
      (entry) => entry.id === "tb-ai-flagship-replay"
    ).state,
    "passed"
  );
  assert.equal(track(passed, "tb-unity-deterministic").engineeringMaturity, "stable");
  assert.equal(track(passed, "tb-unity-deterministic").default, true);
  assert.equal(track(passed, "tb-unity-deterministic").distribution.publicDistribution, "blocked");
  assert.equal(track(passed, "tb-unity-deterministic").distribution.intendedClass, "private-development");
  assert.equal(passed.compliance.currentVerificationCompliant, true);

  const failedResults = clone(results);
  failedResults.find((entry) => entry.command === "npm run test:role-actions").exitCode = 9;
  const failed = evaluateCapabilityContract(initialContract, { revision, executionResults: failedResults });
  assert.equal(gate(failed, "tb-unity-deterministic", "rules-fidelity").state, "failed");

  const wrongRevision = evaluateCapabilityContract(initialContract, { revision: "other-revision", executionResults: results });
  assert.equal(gate(wrongRevision, "tb-unity-deterministic", "rules-fidelity").state, "rejected");

  const wrongHashResults = clone(results);
  wrongHashResults.forEach((entry) => {
    entry.contractHash = `sha256:${"0".repeat(64)}`;
  });
  const wrongHash = evaluateCapabilityContract(initialContract, { revision, executionResults: wrongHashResults });
  assert.equal(gate(wrongHash, "tb-unity-deterministic", "rules-fidelity").state, "rejected");
}

function testExpiringEvidenceUsesOnlyInjectedAsOfDate() {
  const contract = clone(initialContract);
  contract.tracks[0].promotionGates[0].evidence = [
    {
      id: "dated-rules-review",
      reference: "docs/verification/TB_ROLE_FIDELITY.md",
      freshness: { policy: "expires", observedOn: "2026-07-01", expiresOn: "2026-07-31" },
    },
  ];
  assert.equal(gate(evaluateCapabilityContract(contract), "tb-unity-deterministic", "rules-fidelity").state, "unverified");
  assert.equal(
    gate(evaluateCapabilityContract(contract, { asOf: "2026-06-30" }), "tb-unity-deterministic", "rules-fidelity").state,
    "unverified"
  );
  assert.equal(
    gate(evaluateCapabilityContract(contract, { asOf: "2026-07-01" }), "tb-unity-deterministic", "rules-fidelity").state,
    "passed"
  );
  assert.equal(
    gate(evaluateCapabilityContract(contract, { asOf: "2026-07-31" }), "tb-unity-deterministic", "rules-fidelity").state,
    "passed"
  );
  assert.equal(
    gate(evaluateCapabilityContract(contract, { asOf: "2026-08-01" }), "tb-unity-deterministic", "rules-fidelity").state,
    "stale"
  );
}

function testUnavailableReferenceIsMissing() {
  const availability = new Map([["README.md", false]]);
  const result = evaluateCapabilityContract(initialContract, { referenceAvailability: availability });
  assert.equal(gate(result, "tb-unity-deterministic", "intended-distribution").state, "missing");
}

function testEligibilityRequiresAllGatesButNeverPromotes() {
  const contract = withAllCurrentGates(initialContract, "bmr");
  const before = clone(contract);
  const result = evaluateCapabilityContract(contract, { asOf: "2026-07-13" });
  const bmr = track(result, "bmr");
  assert.equal(bmr.compliance.engineeringCompliant, true);
  assert.equal(bmr.eligibility.promotionReview, true);
  assert.equal(bmr.eligibility.automaticPromotion, false);
  assert.equal(bmr.engineeringMaturity, "laboratory");
  assert.deepEqual(result.eligibility.promotionReviewTrackIds, ["bmr"]);
  assert.deepEqual(contract, before);
}

function testEvergreenEvidenceCannotAloneSatisfyTimeSensitiveGate() {
  const contract = clone(initialContract);
  contract.tracks[0].promotionGates[0].evidence = [
    {
      id: "structural-rules-note",
      reference: "README.md",
      freshness: { policy: "evergreen" },
    },
  ];
  const result = evaluateCapabilityContract(contract);
  const rulesGate = gate(result, "tb-unity-deterministic", "rules-fidelity");
  assert.equal(rulesGate.evidence[0].state, "passed");
  assert.equal(rulesGate.state, "unverified");
  assert.match(rulesGate.reason, /cannot satisfy a time-sensitive/);
}

function testRenderedDistributionSummaryComesFromEvaluation() {
  const contract = clone(initialContract);
  contract.tracks.find((entry) => entry.id === "bmr").distribution.publicDistribution = "eligible-for-review";
  const result = evaluateCapabilityContract(contract);
  const bmr = track(result, "bmr");
  assert.equal(bmr.distribution.declaredPublicDistribution, "eligible-for-review");
  assert.equal(bmr.distribution.intendedDistributionGateState, "passed");
  assert.equal(bmr.distribution.publicReleaseReviewEligible, true);
  const rendered = renderCapabilityStatus(contract, result);
  assert.match(rendered, /Current evaluated distribution summary: 4 blocked; 1 eligible for public-release review\./);
  assert.match(rendered, /Bad Moon Rising.*\*\*eligible-for-review\*\*/s);

  const missingEvidence = clone(contract);
  missingEvidence.tracks.find((entry) => entry.id === "bmr").promotionGates.find(
    (entry) => entry.category === "intended-distribution"
  ).evidence = [];
  const missingResult = evaluateCapabilityContract(missingEvidence);
  assert.equal(track(missingResult, "bmr").distribution.declaredPublicDistribution, "eligible-for-review");
  assert.equal(track(missingResult, "bmr").distribution.publicDistribution, "blocked");
  assert.equal(track(missingResult, "bmr").distribution.publicReleaseReviewEligible, false);

  const staleEvidence = clone(contract);
  staleEvidence.tracks.find((entry) => entry.id === "bmr").promotionGates.find(
    (entry) => entry.category === "intended-distribution"
  ).evidence = [
    {
      id: "distribution-review",
      reference: "docs/verification/CURRENT_REVIEW.md",
      freshness: { policy: "expires", observedOn: "2026-07-01", expiresOn: "2026-07-12" },
    },
  ];
  assert.equal(
    track(evaluateCapabilityContract(staleEvidence, { asOf: "2026-07-13" }), "bmr").distribution.publicDistribution,
    "blocked"
  );
}

function testNondefaultStableTracksRemainVisible() {
  const contract = clone(initialContract);
  contract.tracks.find((entry) => entry.id === "bmr").engineeringMaturity = "stable";
  const result = evaluateCapabilityContract(contract);
  assert.deepEqual(result.compliance.stableTrackIds, ["tb-unity-deterministic", "bmr"]);
  assert.match(renderCapabilityStatus(contract, result), /## Other stable tracks[\s\S]*Bad Moon Rising/);
  assert.match(renderReadmeCapabilityBlock(contract, result), /Bad Moon Rising.*stable track; not the default flagship/);
}

function testFlagshipReplayClaimBoundaryRendering() {
  const result = evaluateCapabilityContract(initialContract);
  assertFlagshipReplayBoundary(renderCapabilityStatus(initialContract, result), "capability status");
  assertFlagshipReplayBoundary(renderReadmeCapabilityBlock(initialContract, result), "README capability block");
}

function writeCliFixture(tempRoot, contract = initialContract) {
  const tempContractPath = path.join(tempRoot, "config", "product_capabilities.json");
  fs.mkdirSync(path.dirname(tempContractPath), { recursive: true });
  fs.writeFileSync(tempContractPath, `${JSON.stringify(contract, null, 2)}\n`);
  const scripts = Object.fromEntries(uniqueCiCommands(contract).map((command) => [command.slice("npm run ".length), "node -e \"\""]));
  fs.writeFileSync(path.join(tempRoot, "package.json"), `${JSON.stringify({ type: "module", scripts }, null, 2)}\n`);
  fs.writeFileSync(path.join(tempRoot, "README.md"), "fixture evidence\n");
  return tempContractPath;
}

function snapshotTree(directory) {
  const snapshot = new Map();
  function visit(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) visit(fullPath);
      else snapshot.set(path.relative(directory, fullPath).replaceAll(path.sep, "/"), fs.readFileSync(fullPath, "utf8"));
    }
  }
  visit(directory);
  return snapshot;
}

function runCli(tempRoot, args) {
  return spawnSync(process.execPath, [cliPath, ...args], { cwd: tempRoot, encoding: "utf8" });
}

function testCliJsonChannelsExitCodesAndNoWrite() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "botc-capability-contract-"));
  try {
    const tempContractPath = writeCliFixture(tempRoot);
    const before = snapshotTree(tempRoot);

    const inspect = runCli(tempRoot, ["inspect", "--json", "--contract", tempContractPath, "--root", tempRoot]);
    assert.equal(inspect.status, 0, inspect.stderr);
    assert.equal(inspect.stderr, "", "valid JSON inspection must reserve stderr for invocation diagnostics");
    const inspected = JSON.parse(inspect.stdout);
    assert.equal(track(inspected, "bmr").engineeringMaturity, "laboratory");
    assert.equal(track(inspected, "bmr").eligibility.promotionReview, false, "unmet laboratory gates are a valid exit-0 state");
    assert.deepEqual(snapshotTree(tempRoot), before, "inspect --json must not write files");

    const missingGeneratedCheck = runCli(tempRoot, ["check", "--contract", tempContractPath, "--root", tempRoot]);
    assert.equal(missingGeneratedCheck.status, 1, "check must reject missing generated capability docs");
    assert.equal(missingGeneratedCheck.stdout, "");
    assert.match(missingGeneratedCheck.stderr, /generated-capability-drift/);
    assert.deepEqual(snapshotTree(tempRoot), before, "failed generated-doc check must not write files");

    const write = runCli(tempRoot, ["write", "--contract", tempContractPath, "--root", tempRoot]);
    assert.equal(write.status, 0, write.stderr);
    assert.equal(write.stderr, "");
    assert.match(write.stdout, /Wrote product capability status/);
    const afterWrite = snapshotTree(tempRoot);
    assert.deepEqual(
      [...afterWrite.keys()].sort(),
      [...before.keys(), "docs/CAPABILITY_STATUS.md"].sort(),
      "write may only add the generated status page and update README"
    );
    for (const [relativePath, content] of before) {
      if (relativePath !== "README.md") {
        assert.equal(afterWrite.get(relativePath), content, `write must not modify ${relativePath}`);
      }
    }
    const generatedStatus = afterWrite.get("docs/CAPABILITY_STATUS.md");
    const generatedReadme = afterWrite.get("README.md");
    assert.ok(generatedReadme.startsWith("fixture evidence\n\n"), "write must preserve README text outside the managed block");
    assert.match(generatedStatus, /^# Product Capability Status/m);
    assert.match(generatedStatus, /Default stable flagship/);
    assert.match(generatedStatus, /npm run unity:demo/);
    assert.match(generatedStatus, /Laboratory tracks/);
    assert.match(generatedStatus, /Rules fidelity/);
    assert.match(generatedStatus, /Player journey/);
    assert.match(generatedStatus, /Automated contracts/);
    assert.match(generatedStatus, /Intended distribution/);
    assert.match(generatedStatus, /Engineering maturity is independent of public distribution permission/);
    assert.match(generatedStatus, /sha256:[a-f0-9]{64}/);
    assert.match(generatedStatus, /Generated by `scripts\/product_capability_contract\.mjs`/);
    assert.match(generatedReadme, /<!-- product-capabilities:start -->/);
    assert.match(generatedReadme, /Unity \+ Trouble Brewing \+ deterministic AI/);
    assert.match(generatedReadme, /Bad Moon Rising.*laboratory/s);
    assert.match(generatedReadme, /Sects & Violets.*laboratory/s);
    assert.match(generatedReadme, /Electron player UI.*laboratory/s);
    assert.match(generatedReadme, /LocalLLM dialogue renderer.*laboratory/s);
    assertFlagshipReplayBoundary(generatedStatus, "generated capability status");
    assertFlagshipReplayBoundary(generatedReadme, "generated README");
    const statusMtimeAfterWrite = fs.statSync(path.join(tempRoot, "docs", "CAPABILITY_STATUS.md")).mtimeMs;
    const readmeMtimeAfterWrite = fs.statSync(path.join(tempRoot, "README.md")).mtimeMs;

    const secondWrite = runCli(tempRoot, ["write", "--contract", tempContractPath, "--root", tempRoot]);
    assert.equal(secondWrite.status, 0, secondWrite.stderr);
    assert.deepEqual(snapshotTree(tempRoot), afterWrite, "a second write with identical input must be byte-stable");
    assert.equal(fs.statSync(path.join(tempRoot, "docs", "CAPABILITY_STATUS.md")).mtimeMs, statusMtimeAfterWrite);
    assert.equal(fs.statSync(path.join(tempRoot, "README.md")).mtimeMs, readmeMtimeAfterWrite);

    const staticCheck = runCli(tempRoot, ["check", "--contract", tempContractPath, "--root", tempRoot]);
    assert.equal(staticCheck.status, 0, staticCheck.stderr);
    assert.match(staticCheck.stdout, /generated capability docs are current/);
    assert.equal(staticCheck.stderr, "");
    assert.deepEqual(snapshotTree(tempRoot), afterWrite, "static check must not write files");
    assert.equal(fs.statSync(path.join(tempRoot, "docs", "CAPABILITY_STATUS.md")).mtimeMs, statusMtimeAfterWrite);
    assert.equal(fs.statSync(path.join(tempRoot, "README.md")).mtimeMs, readmeMtimeAfterWrite);

    const currentCheck = runCli(tempRoot, [
      "check",
      "--require-current",
      "--contract",
      tempContractPath,
      "--root",
      tempRoot,
    ]);
    assert.equal(currentCheck.status, 1, "unverified stable evidence should fail current verification");
    assert.equal(currentCheck.stdout, "");
    assert.match(currentCheck.stderr, /noncompliant-stable-track/);
    assert.deepEqual(snapshotTree(tempRoot), afterWrite, "failed current check must not write files");

    const resultsPath = path.join(tempRoot, "results.json");
    const revision = "cli-revision";
    fs.writeFileSync(resultsPath, `${JSON.stringify(executionManifest(initialContract, revision), null, 2)}\n`);
    const verified = runCli(tempRoot, [
      "check",
      "--require-current",
      "--contract",
      tempContractPath,
      "--root",
      tempRoot,
      "--results",
      resultsPath,
      "--revision",
      revision,
    ]);
    assert.equal(verified.status, 0, verified.stderr);
    assert.match(verified.stdout, /current stable evidence are compliant/);

    const inspectRequireCurrent = runCli(tempRoot, ["inspect", "--json", "--require-current"]);
    assert.equal(inspectRequireCurrent.status, 2);
    assert.match(inspectRequireCurrent.stderr, /--require-current is only valid with check/);
    const writeRequireCurrent = runCli(tempRoot, ["write", "--require-current"]);
    assert.equal(writeRequireCurrent.status, 2);
    assert.match(writeRequireCurrent.stderr, /--require-current is only valid with check/);

    const unknownArgument = runCli(tempRoot, ["inspect", "--json", "--wat"]);
    assert.equal(unknownArgument.status, 2);
    assert.equal(unknownArgument.stdout, "");
    assert.match(unknownArgument.stderr, /Unknown option/);

    const validManifest = executionManifest(initialContract, revision);
    for (const [label, invalidManifest, expected] of [
      ["bare array", validManifest.results, /versioned result manifest object/],
      ["wrong schema", { ...validManifest, schema: "other-results" }, /Execution results schema/],
      ["wrong version", { ...validManifest, version: 999 }, /Execution results version/],
      ["wrong revision", { ...validManifest, revision: "other" }, /manifest revision/],
      ["wrong hash", { ...validManifest, contractHash: `sha256:${"0".repeat(64)}` }, /manifest contractHash/],
    ]) {
      fs.writeFileSync(resultsPath, `${JSON.stringify(invalidManifest, null, 2)}\n`);
      const rejectedManifest = runCli(tempRoot, [
        "check",
        "--require-current",
        "--contract",
        tempContractPath,
        "--root",
        tempRoot,
        "--results",
        resultsPath,
        "--revision",
        revision,
      ]);
      assert.equal(rejectedManifest.status, 2, label);
      assert.equal(rejectedManifest.stdout, "", label);
      assert.match(rejectedManifest.stderr, expected, label);
    }

    fs.appendFileSync(path.join(tempRoot, "docs", "CAPABILITY_STATUS.md"), "drift\n");
    const beforeDriftCheck = snapshotTree(tempRoot);
    const driftedStatus = runCli(tempRoot, ["check", "--contract", tempContractPath, "--root", tempRoot]);
    assert.equal(driftedStatus.status, 1);
    assert.equal(driftedStatus.stdout, "");
    assert.match(driftedStatus.stderr, /generated-capability-drift: docs\/CAPABILITY_STATUS\.md/);
    assert.deepEqual(snapshotTree(tempRoot), beforeDriftCheck, "drift check must remain read-only");
    assert.equal(runCli(tempRoot, ["write", "--contract", tempContractPath, "--root", tempRoot]).status, 0);

    const currentReadme = fs.readFileSync(path.join(tempRoot, "README.md"), "utf8");
    fs.writeFileSync(
      path.join(tempRoot, "README.md"),
      currentReadme.replace("stable default flagship", "stable default flagship DRIFT")
    );
    const beforeReadmeDriftCheck = snapshotTree(tempRoot);
    const driftedReadme = runCli(tempRoot, ["check", "--contract", tempContractPath, "--root", tempRoot]);
    assert.equal(driftedReadme.status, 1);
    assert.match(driftedReadme.stderr, /generated-capability-drift: README\.md/);
    assert.deepEqual(snapshotTree(tempRoot), beforeReadmeDriftCheck, "README drift check must remain read-only");
    assert.equal(runCli(tempRoot, ["write", "--contract", tempContractPath, "--root", tempRoot]).status, 0);
    assert.equal(fs.readFileSync(path.join(tempRoot, "README.md"), "utf8"), currentReadme);

    fs.mkdirSync(path.join(tempRoot, "unity-prototype"), { recursive: true });
    fs.writeFileSync(path.join(tempRoot, "unity-prototype", "README.md"), "Bad Moon Rising (BMR) is stable.\n");
    const beforeContradictionCheck = snapshotTree(tempRoot);
    const contradiction = runCli(tempRoot, ["check", "--contract", tempContractPath, "--root", tempRoot]);
    assert.equal(contradiction.status, 1);
    assert.equal(contradiction.stdout, "");
    assert.match(contradiction.stderr, /parallel-capability-classification: unity-prototype\/README\.md:1/);
    assert.deepEqual(snapshotTree(tempRoot), beforeContradictionCheck, "contradiction check must remain read-only");
    fs.writeFileSync(
      path.join(tempRoot, "unity-prototype", "README.md"),
      "See docs/CAPABILITY_STATUS.md.\nBMR \u662f\u7a33\u5b9a\u8f68\u9053.\n"
    );
    const chineseContradiction = runCli(tempRoot, ["check", "--contract", tempContractPath, "--root", tempRoot]);
    assert.equal(chineseContradiction.status, 1);
    assert.match(chineseContradiction.stderr, /parallel-capability-classification: unity-prototype\/README\.md:2/);
    fs.writeFileSync(
      path.join(tempRoot, "unity-prototype", "README.md"),
      "# Bad Moon Rising\n\nEngineering maturity: stable\n\nSee docs/CAPABILITY_STATUS.md.\n"
    );
    const multilineContradiction = runCli(tempRoot, ["check", "--contract", tempContractPath, "--root", tempRoot]);
    assert.equal(multilineContradiction.status, 1);
    assert.match(multilineContradiction.stderr, /parallel-capability-classification: unity-prototype\/README\.md:3/);
    fs.writeFileSync(
      path.join(tempRoot, "unity-prototype", "README.md"),
      "# 黯月初升\n\n工程成熟度：稳定轨道\n\nSee docs/CAPABILITY_STATUS.md.\n"
    );
    const chineseMultiline = runCli(tempRoot, ["check", "--contract", tempContractPath, "--root", tempRoot]);
    assert.equal(chineseMultiline.status, 1);
    assert.match(chineseMultiline.stderr, /parallel-capability-classification: unity-prototype\/README\.md:3/);
    fs.writeFileSync(
      path.join(tempRoot, "unity-prototype", "README.md"),
      "# Bad Moon Rising\n\nThe serialized identifier stays stable across runs.\n\nSee docs/CAPABILITY_STATUS.md.\n"
    );
    const genericStability = runCli(tempRoot, ["check", "--contract", tempContractPath, "--root", tempRoot]);
    assert.equal(genericStability.status, 0, genericStability.stderr);
    fs.writeFileSync(
      path.join(tempRoot, "unity-prototype", "README.md"),
      "See ../docs/CAPABILITY_STATUS.md for the current capability classification.\n"
    );

    fs.mkdirSync(path.join(tempRoot, "docs", "packaging"), { recursive: true });
    const registeredSurface = path.join(tempRoot, "docs", "packaging", "WINDOWS_EXE.md");
    fs.writeFileSync(registeredSurface, "# Packaging\n\nElectron developer package notes.\n");
    const beforeMissingLinkCheck = snapshotTree(tempRoot);
    const missingStatusLink = runCli(tempRoot, ["check", "--contract", tempContractPath, "--root", tempRoot]);
    assert.equal(missingStatusLink.status, 1);
    assert.equal(missingStatusLink.stdout, "");
    assert.match(missingStatusLink.stderr, /missing-capability-status-link: docs\/packaging\/WINDOWS_EXE\.md/);
    assert.deepEqual(snapshotTree(tempRoot), beforeMissingLinkCheck, "registered-surface check must remain read-only");
    fs.writeFileSync(registeredSurface, "# Packaging\n\nSee docs/CAPABILITY_STATUS.md for current product status.\n");

    const progressBaseline = path.join(tempRoot, "docs", "PROGRESS_BASELINE_2026-06-01.md");
    fs.writeFileSync(progressBaseline, "# Dated progress baseline\n");
    const missingBaselineLink = runCli(tempRoot, ["check", "--contract", tempContractPath, "--root", tempRoot]);
    assert.equal(missingBaselineLink.status, 1);
    assert.match(missingBaselineLink.stderr, /missing-capability-status-link: docs\/PROGRESS_BASELINE_2026-06-01\.md/);
    fs.writeFileSync(progressBaseline, "# Dated progress baseline\n\nSee docs/CAPABILITY_STATUS.md for current status.\n");

    fs.rmSync(path.join(tempRoot, "README.md"));
    const missingReference = runCli(tempRoot, ["check", "--contract", tempContractPath, "--root", tempRoot]);
    assert.equal(missingReference.status, 1);
    assert.equal(missingReference.stdout, "");
    assert.match(missingReference.stderr, /missing-evidence-reference/);
    fs.writeFileSync(path.join(tempRoot, "README.md"), "fixture evidence\n");

    const invalidContract = clone(initialContract);
    invalidContract.schemaVersion = 999;
    fs.writeFileSync(tempContractPath, `${JSON.stringify(invalidContract, null, 2)}\n`);
    const invalidInspect = runCli(tempRoot, ["inspect", "--json", "--contract", tempContractPath, "--root", tempRoot]);
    assert.equal(invalidInspect.status, 1);
    assert.equal(invalidInspect.stderr, "");
    assert.equal(JSON.parse(invalidInspect.stdout).valid, false);

    fs.writeFileSync(tempContractPath, "{ invalid json\n");
    const invalidJsonInspect = runCli(tempRoot, ["inspect", "--json", "--contract", tempContractPath, "--root", tempRoot]);
    assert.equal(invalidJsonInspect.status, 1);
    assert.equal(invalidJsonInspect.stderr, "");
    const invalidJsonResult = JSON.parse(invalidJsonInspect.stdout);
    assert.equal(invalidJsonResult.schema, PRODUCT_CAPABILITY_RESULT_SCHEMA);
    assert.equal(invalidJsonResult.version, PRODUCT_CAPABILITY_RESULT_VERSION);
    assert.equal(invalidJsonResult.valid, false);

    for (const [label, malformed] of [
      ["numeric tracks", { ...clone(initialContract), tracks: 42 }],
      [
        "numeric promotion gates",
        (() => {
          const value = clone(initialContract);
          value.tracks[0].promotionGates = 42;
          return value;
        })(),
      ],
      [
        "numeric evidence",
        (() => {
          const value = clone(initialContract);
          value.tracks[0].promotionGates[0].evidence = 42;
          return value;
        })(),
      ],
    ]) {
      fs.writeFileSync(tempContractPath, `${JSON.stringify(malformed, null, 2)}\n`);
      const malformedInspect = runCli(tempRoot, ["inspect", "--json", "--contract", tempContractPath, "--root", tempRoot]);
      assert.equal(malformedInspect.status, 1, label);
      assert.equal(malformedInspect.stderr, "", label);
      assert.equal(JSON.parse(malformedInspect.stdout).valid, false, label);
    }
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

testInitialAuthorityAndResultShape();
testStructuralFailuresAreCollected();
testMissingUnverifiedAndStableNoncomplianceDoNotChangeClassification();
testExecutedEvidenceMustMatchRevisionAndContractHash();
testExpiringEvidenceUsesOnlyInjectedAsOfDate();
testUnavailableReferenceIsMissing();
testEligibilityRequiresAllGatesButNeverPromotes();
testEvergreenEvidenceCannotAloneSatisfyTimeSensitiveGate();
testRenderedDistributionSummaryComesFromEvaluation();
testNondefaultStableTracksRemainVisible();
testFlagshipReplayClaimBoundaryRendering();
testCliJsonChannelsExitCodesAndNoWrite();

console.log("product capability contracts ok");
