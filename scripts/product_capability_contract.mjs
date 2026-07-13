import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

export const PRODUCT_CAPABILITY_SCHEMA_VERSION = 1;
export const PRODUCT_CAPABILITY_RESULT_SCHEMA = "botc-product-capability-evaluation";
export const PRODUCT_CAPABILITY_RESULT_VERSION = 1;
export const PRODUCT_CAPABILITY_CI_RESULTS_SCHEMA = "botc-product-capability-ci-results";
export const PRODUCT_CAPABILITY_CI_RESULTS_VERSION = 1;

const MATURITY_STATES = new Set(["stable", "laboratory"]);
const DISTRIBUTION_STATES = new Set(["blocked", "eligible-for-review"]);
const FRESHNESS_POLICIES = new Set(["ci-run", "expires", "evergreen"]);
const GATE_PRESENTATION = {
  "rules-fidelity": {
    label: "Rules fidelity",
    meaning: "The implemented rules match the declared script behavior and known edge cases.",
  },
  "player-journey": {
    label: "Player journey",
    meaning: "A player can complete the intended entry-to-outcome flow for this track.",
  },
  "automated-contracts": {
    label: "Automated contracts",
    meaning: "Machine-checkable boundaries protect the track from regressions.",
  },
  "intended-distribution": {
    label: "Intended distribution",
    meaning: "The declared use and release posture has explicit evidence; it is not inferred from engineering maturity.",
  },
};
const REQUIRED_GATE_CATEGORIES = Object.freeze(Object.keys(GATE_PRESENTATION));
const EVIDENCE_STATE_PRIORITY = ["failed", "rejected", "stale", "missing", "unverified", "passed"];
const IDENTIFIER_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const NPM_REFERENCE_PATTERN = /^npm run [a-zA-Z0-9:_-]+$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CAPABILITY_STATUS_PATH = "docs/CAPABILITY_STATUS.md";
const README_PATH = "README.md";
const README_BLOCK_START = "<!-- product-capabilities:start -->";
const README_BLOCK_END = "<!-- product-capabilities:end -->";
const MAINTAINED_CAPABILITY_SURFACES = [
  { relativePath: README_PATH, requireStatusLink: false, auditClaims: true },
  { relativePath: "unity-prototype/README.md", requireStatusLink: true, auditClaims: true },
  { relativePath: "docs/INDEX.md", requireStatusLink: true, auditClaims: true },
  { relativePath: "docs/PROJECT_STATUS_AND_OPEN_REQUIREMENTS.md", requireStatusLink: true, auditClaims: true },
  { relativePath: "docs/PUBLIC_RELEASE_READINESS_2026-05-10.md", requireStatusLink: true, auditClaims: true },
  { relativePath: "docs/packaging/WINDOWS_EXE.md", requireStatusLink: true, auditClaims: true },
  { relativePath: "docs/packaging/AI_POLISHED_UNITY_RELEASE.md", requireStatusLink: true, auditClaims: true },
  { relativePath: "docs/PROGRESS_BASELINE_2026-06-01.md", requireStatusLink: true, auditClaims: true },
  // This append-only request log preserves historical states; it is not a maintained current-status surface.
  { relativePath: "docs/requirements/CHANGE_REQUESTS.md", requireStatusLink: false, auditClaims: false },
];

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function diagnostic(code, fieldPath, message) {
  return { code, path: fieldPath, message };
}

export function isValidIsoDate(value) {
  if (typeof value !== "string" || !ISO_DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function isRepositoryRelativeReference(reference) {
  if (typeof reference !== "string" || reference.length === 0) return false;
  if (reference.includes("\\") || path.posix.isAbsolute(reference) || /^[a-zA-Z]:/.test(reference)) return false;
  const parts = reference.split("/");
  return parts.every((part) => part.length > 0 && part !== "." && part !== "..");
}

function validateEvidence(evidence, evidencePath, diagnostics, evidenceIds) {
  if (!isPlainObject(evidence)) {
    diagnostics.push(diagnostic("invalid-evidence", evidencePath, "Evidence must be an object."));
    return;
  }

  if (typeof evidence.id !== "string" || !IDENTIFIER_PATTERN.test(evidence.id)) {
    diagnostics.push(diagnostic("invalid-evidence-id", `${evidencePath}.id`, "Evidence id must be a kebab-case identifier."));
  } else if (evidenceIds.has(evidence.id)) {
    diagnostics.push(diagnostic("duplicate-evidence-id", `${evidencePath}.id`, `Duplicate evidence id: ${evidence.id}`));
  } else {
    evidenceIds.add(evidence.id);
  }

  const isNpmReference = typeof evidence.reference === "string" && NPM_REFERENCE_PATTERN.test(evidence.reference);
  const isRepoReference = isRepositoryRelativeReference(evidence.reference);
  if (!isNpmReference && !isRepoReference) {
    diagnostics.push(
      diagnostic(
        "invalid-evidence-reference",
        `${evidencePath}.reference`,
        "Evidence reference must be a repository-relative path or an 'npm run <script>' command."
      )
    );
  }

  if (!isPlainObject(evidence.freshness)) {
    diagnostics.push(diagnostic("missing-freshness", `${evidencePath}.freshness`, "Evidence freshness is required."));
    return;
  }

  const policy = evidence.freshness.policy;
  if (!FRESHNESS_POLICIES.has(policy)) {
    diagnostics.push(diagnostic("unknown-freshness-policy", `${evidencePath}.freshness.policy`, `Unknown freshness policy: ${String(policy)}`));
    return;
  }

  if (policy === "ci-run" && !isNpmReference) {
    diagnostics.push(
      diagnostic("invalid-ci-run-reference", `${evidencePath}.reference`, "ci-run evidence must reference an npm script command.")
    );
  }

  if (policy === "expires") {
    if (!isValidIsoDate(evidence.freshness.observedOn)) {
      diagnostics.push(
        diagnostic("invalid-observed-date", `${evidencePath}.freshness.observedOn`, "expires evidence requires a valid observedOn date.")
      );
    }
    if (!isValidIsoDate(evidence.freshness.expiresOn)) {
      diagnostics.push(
        diagnostic("invalid-expiry-date", `${evidencePath}.freshness.expiresOn`, "expires evidence requires a valid expiresOn date.")
      );
    }
    if (
      isValidIsoDate(evidence.freshness.observedOn) &&
      isValidIsoDate(evidence.freshness.expiresOn) &&
      evidence.freshness.expiresOn < evidence.freshness.observedOn
    ) {
      diagnostics.push(
        diagnostic("expiry-before-observation", `${evidencePath}.freshness.expiresOn`, "expiresOn cannot precede observedOn.")
      );
    }
  }
}

export function validateCapabilityContract(contract) {
  const diagnostics = [];
  if (!isPlainObject(contract)) {
    return [diagnostic("invalid-contract", "$", "Capability contract must be a JSON object.")];
  }

  if (contract.schemaVersion !== PRODUCT_CAPABILITY_SCHEMA_VERSION) {
    diagnostics.push(
      diagnostic(
        "unsupported-schema-version",
        "schemaVersion",
        `Expected schemaVersion ${PRODUCT_CAPABILITY_SCHEMA_VERSION}; received ${String(contract.schemaVersion)}.`
      )
    );
  }
  if (typeof contract.product !== "string" || contract.product.length === 0) {
    diagnostics.push(diagnostic("missing-product", "product", "Product id is required."));
  }
  if (typeof contract.defaultTrackId !== "string" || contract.defaultTrackId.length === 0) {
    diagnostics.push(diagnostic("missing-default-track", "defaultTrackId", "defaultTrackId is required."));
  }
  if (!Array.isArray(contract.tracks) || contract.tracks.length === 0) {
    diagnostics.push(diagnostic("missing-tracks", "tracks", "At least one capability track is required."));
    return diagnostics;
  }

  const trackIds = new Set();
  const claimAliasOwners = new Map();
  let defaultCount = 0;
  for (const [trackIndex, track] of contract.tracks.entries()) {
    const trackPath = `tracks[${trackIndex}]`;
    if (!isPlainObject(track)) {
      diagnostics.push(diagnostic("invalid-track", trackPath, "Track must be an object."));
      continue;
    }

    if (typeof track.id !== "string" || !IDENTIFIER_PATTERN.test(track.id)) {
      diagnostics.push(diagnostic("invalid-track-id", `${trackPath}.id`, "Track id must be a kebab-case identifier."));
    } else if (trackIds.has(track.id)) {
      diagnostics.push(diagnostic("duplicate-track-id", `${trackPath}.id`, `Duplicate track id: ${track.id}`));
    } else {
      trackIds.add(track.id);
    }
    if (typeof track.name !== "string" || track.name.length === 0) {
      diagnostics.push(diagnostic("missing-track-name", `${trackPath}.name`, "Track name is required."));
    }
    if (track.claimAliases !== undefined && !Array.isArray(track.claimAliases)) {
      diagnostics.push(diagnostic("invalid-claim-aliases", `${trackPath}.claimAliases`, "claimAliases must be an array when supplied."));
    } else {
      const localAliases = new Set(
        [track.id, track.name]
          .filter((alias) => typeof alias === "string" && alias.trim().length > 0)
          .map((alias) => alias.trim().toLocaleLowerCase("en-US"))
      );
      for (const [aliasIndex, alias] of (track.claimAliases ?? []).entries()) {
        const aliasPath = `${trackPath}.claimAliases[${aliasIndex}]`;
        if (typeof alias !== "string" || alias.trim().length === 0) {
          diagnostics.push(diagnostic("invalid-claim-alias", aliasPath, "Claim aliases must be non-empty strings."));
          continue;
        }
        const normalized = alias.trim().toLocaleLowerCase("en-US");
        if (localAliases.has(normalized)) {
          diagnostics.push(diagnostic("duplicate-claim-alias", aliasPath, `Duplicate claim alias: ${alias}`));
          continue;
        }
        localAliases.add(normalized);
      }
    }
    for (const alias of [track.id, track.name, ...(Array.isArray(track.claimAliases) ? track.claimAliases : [])]) {
      if (typeof alias !== "string" || alias.trim().length === 0) continue;
      const normalized = alias.trim().toLocaleLowerCase("en-US");
      const owner = claimAliasOwners.get(normalized);
      if (owner && owner !== track.id) {
        diagnostics.push(diagnostic("ambiguous-claim-alias", `${trackPath}.claimAliases`, `Claim alias '${alias}' is already owned by ${owner}.`));
      } else if (typeof track.id === "string") {
        claimAliasOwners.set(normalized, track.id);
      }
    }
    if (!MATURITY_STATES.has(track.engineeringMaturity)) {
      diagnostics.push(
        diagnostic(
          "unknown-maturity",
          `${trackPath}.engineeringMaturity`,
          `Unknown engineering maturity: ${String(track.engineeringMaturity)}`
        )
      );
    }
    if (typeof track.default !== "boolean") {
      diagnostics.push(diagnostic("invalid-default-flag", `${trackPath}.default`, "Track default must be a boolean."));
    } else if (track.default) {
      defaultCount += 1;
      if (track.id !== contract.defaultTrackId) {
        diagnostics.push(
          diagnostic("default-track-mismatch", `${trackPath}.default`, "The default flag must match defaultTrackId.")
        );
      }
      if (track.engineeringMaturity !== "stable") {
        diagnostics.push(diagnostic("default-track-not-stable", `${trackPath}.engineeringMaturity`, "The default track must be stable."));
      }
    }
    if (track.default && (typeof track.entryCommand !== "string" || !NPM_REFERENCE_PATTERN.test(track.entryCommand))) {
      diagnostics.push(diagnostic("invalid-default-entry-command", `${trackPath}.entryCommand`, "The default track requires an 'npm run <script>' entry command."));
    } else if (track.entryCommand !== undefined && (typeof track.entryCommand !== "string" || !NPM_REFERENCE_PATTERN.test(track.entryCommand))) {
      diagnostics.push(diagnostic("invalid-entry-command", `${trackPath}.entryCommand`, "entryCommand must have the form 'npm run <script>'."));
    }

    if (!isPlainObject(track.distribution)) {
      diagnostics.push(diagnostic("missing-distribution", `${trackPath}.distribution`, "Distribution posture is required."));
    } else {
      if (typeof track.distribution.intendedClass !== "string" || track.distribution.intendedClass.length === 0) {
        diagnostics.push(
          diagnostic("missing-intended-distribution", `${trackPath}.distribution.intendedClass`, "intendedClass is required.")
        );
      }
      if (!DISTRIBUTION_STATES.has(track.distribution.publicDistribution)) {
        diagnostics.push(
          diagnostic(
            "unknown-public-distribution",
            `${trackPath}.distribution.publicDistribution`,
            `Unknown public distribution state: ${String(track.distribution.publicDistribution)}`
          )
        );
      }
      if (typeof track.distribution.reason !== "string" || track.distribution.reason.length === 0) {
        diagnostics.push(diagnostic("missing-distribution-reason", `${trackPath}.distribution.reason`, "A distribution reason is required."));
      }
    }

    if (!Array.isArray(track.promotionGates)) {
      diagnostics.push(diagnostic("missing-promotion-gates", `${trackPath}.promotionGates`, "promotionGates must be an array."));
      continue;
    }

    const gateIds = new Set();
    const categories = new Set();
    for (const [gateIndex, gate] of track.promotionGates.entries()) {
      const gatePath = `${trackPath}.promotionGates[${gateIndex}]`;
      if (!isPlainObject(gate)) {
        diagnostics.push(diagnostic("invalid-gate", gatePath, "Promotion gate must be an object."));
        continue;
      }
      if (typeof gate.id !== "string" || !IDENTIFIER_PATTERN.test(gate.id)) {
        diagnostics.push(diagnostic("invalid-gate-id", `${gatePath}.id`, "Gate id must be a kebab-case identifier."));
      } else if (gateIds.has(gate.id)) {
        diagnostics.push(diagnostic("duplicate-gate-id", `${gatePath}.id`, `Duplicate gate id: ${gate.id}`));
      } else {
        gateIds.add(gate.id);
      }
      if (!REQUIRED_GATE_CATEGORIES.includes(gate.category)) {
        diagnostics.push(
          diagnostic("unknown-gate-category", `${gatePath}.category`, `Unknown promotion gate category: ${String(gate.category)}`)
        );
      } else if (categories.has(gate.category)) {
        diagnostics.push(
          diagnostic("duplicate-gate-category", `${gatePath}.category`, `Duplicate promotion gate category: ${gate.category}`)
        );
      } else {
        categories.add(gate.category);
      }
      if (!Array.isArray(gate.evidence)) {
        diagnostics.push(diagnostic("missing-gate-evidence", `${gatePath}.evidence`, "Gate evidence must be an array."));
        continue;
      }
      const evidenceIds = new Set();
      gate.evidence.forEach((evidence, evidenceIndex) =>
        validateEvidence(evidence, `${gatePath}.evidence[${evidenceIndex}]`, diagnostics, evidenceIds)
      );
    }
    for (const category of REQUIRED_GATE_CATEGORIES) {
      if (!categories.has(category)) {
        diagnostics.push(
          diagnostic("missing-gate-category", `${trackPath}.promotionGates`, `Missing promotion gate category: ${category}`)
        );
      }
    }
  }

  if (defaultCount !== 1) {
    diagnostics.push(diagnostic("invalid-default-count", "tracks", `Expected exactly one default track; found ${defaultCount}.`));
  }
  if (!trackIds.has(contract.defaultTrackId)) {
    diagnostics.push(
      diagnostic("unknown-default-track", "defaultTrackId", `defaultTrackId does not name a track: ${String(contract.defaultTrackId)}`)
    );
  }
  return diagnostics;
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!isPlainObject(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
}

export function hashCapabilityContract(contract) {
  const canonicalJson = JSON.stringify(stableValue(contract)) ?? "null";
  return `sha256:${crypto.createHash("sha256").update(canonicalJson).digest("hex")}`;
}

function referenceAvailable(reference, referenceAvailability) {
  if (referenceAvailability === undefined || referenceAvailability === null) return true;
  if (referenceAvailability instanceof Map) return referenceAvailability.get(reference) !== false;
  if (referenceAvailability instanceof Set) return referenceAvailability.has(reference);
  return referenceAvailability[reference] !== false;
}

function evaluateCiRunEvidence(evidence, options, contractHash) {
  const results = Array.isArray(options.executionResults) ? options.executionResults : [];
  const candidates = results.filter((result) => result && result.command === evidence.reference);
  if (candidates.length === 0) {
    return { state: "unverified", reason: "No supplied execution result matches this command.", result: null };
  }

  const matching = candidates.filter(
    (result) =>
      typeof options.revision === "string" &&
      options.revision.length > 0 &&
      result.revision === options.revision &&
      result.contractHash === contractHash
  );
  if (matching.length === 0) {
    const wrongRevision = candidates.some((result) => result.revision !== options.revision);
    const wrongHash = candidates.some((result) => result.contractHash !== contractHash);
    const reasons = [];
    if (!options.revision) reasons.push("expected revision was not supplied");
    if (wrongRevision) reasons.push("revision does not match");
    if (wrongHash) reasons.push("contract hash does not match");
    return { state: "rejected", reason: `Supplied execution result rejected: ${reasons.join("; ") || "binding does not match"}.`, result: null };
  }

  const selected = matching.at(-1);
  if (!Number.isInteger(selected.exitCode) || selected.exitCode < 0) {
    return { state: "rejected", reason: "Supplied execution result has an invalid exitCode.", result: null };
  }
  if (selected.exitCode !== 0) {
    return { state: "failed", reason: `Executed command failed with exit code ${selected.exitCode}.`, result: selected };
  }
  return { state: "passed", reason: "A revision- and contract-bound execution result passed.", result: selected };
}

function evaluateEvidence(evidence, options, contractHash) {
  const policy = evidence.freshness.policy;
  if (!referenceAvailable(evidence.reference, options.referenceAvailability)) {
    return {
      id: evidence.id,
      reference: evidence.reference,
      policy,
      state: "missing",
      satisfied: false,
      reason: "The declared evidence reference is unavailable.",
      result: null,
    };
  }

  if (policy === "ci-run") {
    const evaluated = evaluateCiRunEvidence(evidence, options, contractHash);
    return {
      id: evidence.id,
      reference: evidence.reference,
      policy,
      state: evaluated.state,
      satisfied: evaluated.state === "passed",
      reason: evaluated.reason,
      result: evaluated.result
        ? {
            revision: evaluated.result.revision,
            contractHash: evaluated.result.contractHash,
            exitCode: evaluated.result.exitCode,
          }
        : null,
    };
  }

  if (policy === "expires") {
    if (!options.asOf) {
      return {
        id: evidence.id,
        reference: evidence.reference,
        policy,
        state: "unverified",
        satisfied: false,
        reason: "An as-of date is required to evaluate expiring evidence.",
        result: null,
      };
    }
    if (options.asOf < evidence.freshness.observedOn) {
      return {
        id: evidence.id,
        reference: evidence.reference,
        policy,
        state: "unverified",
        satisfied: false,
        reason: `Evidence is not observed until ${evidence.freshness.observedOn}.`,
        result: null,
      };
    }
    const stale = options.asOf > evidence.freshness.expiresOn;
    return {
      id: evidence.id,
      reference: evidence.reference,
      policy,
      state: stale ? "stale" : "passed",
      satisfied: !stale,
      reason: stale
        ? `Evidence expired on ${evidence.freshness.expiresOn}.`
        : `Evidence is current through ${evidence.freshness.expiresOn}.`,
      result: null,
    };
  }

  return {
    id: evidence.id,
    reference: evidence.reference,
    policy,
    state: "passed",
    satisfied: true,
    reason: "Evergreen evidence is structurally present.",
    result: null,
  };
}

function aggregateEvidenceState(evidence) {
  if (evidence.length === 0) return "missing";
  return EVIDENCE_STATE_PRIORITY.find((state) => evidence.some((entry) => entry.state === state)) ?? "unverified";
}

function emptyEvaluation(contract, contractHash, diagnostics, options) {
  return {
    schema: PRODUCT_CAPABILITY_RESULT_SCHEMA,
    version: PRODUCT_CAPABILITY_RESULT_VERSION,
    schemaVersion: contract?.schemaVersion ?? null,
    hash: contractHash,
    valid: false,
    diagnostics,
    tracks: [],
    gates: [],
    compliance: {
      currentVerificationCompliant: false,
      referencesResolved: false,
      unresolvedEvidenceReferences: [],
      stableTrackIds: [],
      noncompliantStableTrackIds: [],
    },
    eligibility: { promotionReviewTrackIds: [] },
    distribution: { blockedTrackIds: [], eligibleForReviewTrackIds: [] },
    provenance: {
      revision: options.revision ?? null,
      asOf: options.asOf ?? null,
      suppliedExecutionResultCount: Array.isArray(options.executionResults) ? options.executionResults.length : 0,
    },
  };
}

export function evaluateCapabilityContract(contract, options = {}) {
  const contractHash = hashCapabilityContract(contract);
  const diagnostics = validateCapabilityContract(contract);
  if (diagnostics.length > 0) return emptyEvaluation(contract, contractHash, diagnostics, options);

  const tracks = contract.tracks.map((track) => {
    const evaluatedGates = track.promotionGates.map((gate) => {
      const evidence = gate.evidence.map((entry) => evaluateEvidence(entry, options, contractHash));
      const evergreenOnlyForTimeSensitiveGate =
        gate.category !== "intended-distribution" &&
        evidence.length > 0 &&
        evidence.every((entry) => entry.policy === "evergreen" && entry.satisfied);
      const state = evergreenOnlyForTimeSensitiveGate ? "unverified" : aggregateEvidenceState(evidence);
      const evaluated = {
        trackId: track.id,
        id: gate.id,
        category: gate.category,
        state,
        satisfied: state === "passed",
        reason: evergreenOnlyForTimeSensitiveGate
          ? "Evergreen evidence alone cannot satisfy a time-sensitive promotion gate."
          : null,
        evidence,
      };
      return evaluated;
    });
    const unmetGateIds = evaluatedGates.filter((gate) => !gate.satisfied).map((gate) => gate.id);
    const engineeringCompliant = unmetGateIds.length === 0;
    const promotionEligible = track.engineeringMaturity === "laboratory" && engineeringCompliant;
    const intendedDistributionGate = evaluatedGates.find((gate) => gate.category === "intended-distribution");
    const declaredPublicDistribution = track.distribution.publicDistribution;
    const publicReleaseReviewEligible =
      declaredPublicDistribution === "eligible-for-review" && intendedDistributionGate?.satisfied === true;
    const publicDistribution = publicReleaseReviewEligible ? "eligible-for-review" : "blocked";
    const distributionReason =
      declaredPublicDistribution === "eligible-for-review" && !publicReleaseReviewEligible
        ? `Declared eligible for review, but intended-distribution evidence is ${intendedDistributionGate?.state ?? "missing"}.`
        : track.distribution.reason;
    let promotionState = "not-applicable";
    if (track.engineeringMaturity === "laboratory") {
      promotionState = promotionEligible ? "eligible-for-review" : "not-eligible";
    }
    return {
      id: track.id,
      name: track.name,
      claimAliases: track.claimAliases ?? [],
      entryCommand: track.entryCommand ?? null,
      engineeringMaturity: track.engineeringMaturity,
      default: track.default,
      gates: evaluatedGates,
      compliance: {
        engineeringCompliant,
        state: engineeringCompliant ? "compliant" : "noncompliant",
        unmetGateIds,
      },
      eligibility: {
        promotionReview: promotionEligible,
        state: promotionState,
        automaticPromotion: false,
      },
      distribution: {
        intendedClass: track.distribution.intendedClass,
        declaredPublicDistribution,
        declaredReason: track.distribution.reason,
        publicDistribution,
        reason: distributionReason,
        engineeringMaturityIndependent: true,
        publicReleaseReviewEligible,
        intendedDistributionGateState: intendedDistributionGate?.state ?? "missing",
      },
    };
  });
  const gates = tracks.flatMap((track) => track.gates);

  const stableTracks = tracks.filter((track) => track.engineeringMaturity === "stable");
  const noncompliantStableTracks = stableTracks.filter((track) => !track.compliance.engineeringCompliant);
  const unresolvedEvidenceReferences = gates.flatMap((gate) =>
    gate.evidence
      .filter((evidence) => evidence.state === "missing")
      .map((evidence) => ({ trackId: gate.trackId, gateId: gate.id, evidenceId: evidence.id, reference: evidence.reference }))
  );
  return {
    schema: PRODUCT_CAPABILITY_RESULT_SCHEMA,
    version: PRODUCT_CAPABILITY_RESULT_VERSION,
    schemaVersion: contract.schemaVersion,
    hash: contractHash,
    valid: true,
    diagnostics: [],
    tracks,
    gates,
    compliance: {
      currentVerificationCompliant: noncompliantStableTracks.length === 0,
      referencesResolved: unresolvedEvidenceReferences.length === 0,
      unresolvedEvidenceReferences,
      stableTrackIds: stableTracks.map((track) => track.id),
      noncompliantStableTrackIds: noncompliantStableTracks.map((track) => track.id),
    },
    eligibility: {
      promotionReviewTrackIds: tracks.filter((track) => track.eligibility.promotionReview).map((track) => track.id),
    },
    distribution: {
      blockedTrackIds: tracks
        .filter((track) => track.distribution.publicDistribution === "blocked")
        .map((track) => track.id),
      eligibleForReviewTrackIds: tracks
        .filter((track) => track.distribution.publicDistribution === "eligible-for-review")
        .map((track) => track.id),
    },
    provenance: {
      revision: options.revision ?? null,
      asOf: options.asOf ?? null,
      suppliedExecutionResultCount: Array.isArray(options.executionResults) ? options.executionResults.length : 0,
    },
  };
}

function markdownCell(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
}

function evidenceSummary(gate) {
  if (gate.evidence.length === 0) return "No evidence declared";
  return gate.evidence
    .map((entry) => `\`${markdownCell(entry.reference)}\` (${entry.policy}: **${entry.state}**)`)
    .join("<br>");
}

function nextGateAction(gate) {
  if (gate.evidence.length === 0) return "Declare reviewable evidence in the capability contract.";
  if (gate.state === "passed") return "Keep the declared evidence current.";
  if (gate.state === "missing") return "Restore or correct the missing evidence reference.";
  if (gate.state === "failed") return "Fix the failing behavior, then rerun the declared command.";
  if (gate.state === "rejected") return "Rerun evidence with the current revision and contract hash.";
  if (gate.state === "stale") return "Refresh the dated evidence and its explicit expiry.";
  if (gate.evidence.some((entry) => entry.policy === "ci-run")) {
    return "Run the declared command in CI and supply its revision- and contract-bound result.";
  }
  if (gate.evidence.some((entry) => entry.policy === "expires")) {
    return "Evaluate with an explicit as-of date or refresh the dated evidence.";
  }
  return "Add current, reviewable evidence for this gate.";
}

export function renderCapabilityStatus(contract, result) {
  if (!result.valid) throw new Error("Cannot render capability status from an invalid contract.");
  const defaultTrack = result.tracks.find((track) => track.id === contract.defaultTrackId);
  const otherStableTracks = result.tracks.filter((track) => track.engineeringMaturity === "stable" && !track.default);
  const laboratoryTracks = result.tracks.filter((track) => track.engineeringMaturity === "laboratory");
  const distributionSummary = [
    `${result.distribution.blockedTrackIds.length} blocked`,
    `${result.distribution.eligibleForReviewTrackIds.length} eligible for public-release review`,
  ].join("; ");
  const lines = [
    "# Product Capability Status",
    "",
    "<!-- Generated by scripts/product_capability_contract.mjs. Edit config/product_capabilities.json, then run write. -->",
    "",
    "This page is the maintained product-capability view generated from `config/product_capabilities.json`. It reports declared engineering maturity and evidence state; it does not grant distribution permission.",
    "",
    "## Default stable flagship",
    "",
    `**${defaultTrack.name}** (\`${defaultTrack.id}\`) is the single default stable flagship.`,
    "",
    `- Entry command: \`${defaultTrack.entryCommand}\``,
    `- Engineering maturity: **${defaultTrack.engineeringMaturity}**`,
    `- Current evidence compliance: **${defaultTrack.compliance.state}**`,
    `- Intended class: **${defaultTrack.distribution.intendedClass}**`,
    `- Public distribution: **${defaultTrack.distribution.publicDistribution}** - ${defaultTrack.distribution.reason}`,
    "",
    ...(otherStableTracks.length === 0
      ? []
      : [
          "## Other stable tracks",
          "",
          "| Track | Engineering maturity | Current evidence | Public distribution |",
          "| --- | --- | --- | --- |",
          ...otherStableTracks.map(
            (track) => `| ${markdownCell(track.name)} (\`${track.id}\`) | **stable** | **${track.compliance.state}** | **${track.distribution.publicDistribution}** |`
          ),
          "",
        ]),
    "## Laboratory tracks",
    "",
    "| Track | Engineering maturity | Current evidence | Public distribution | Next action |",
    "| --- | --- | --- | --- | --- |",
    ...laboratoryTracks.map((track) => {
      const nextAction = track.compliance.engineeringCompliant
        ? "Request a human promotion review; promotion is never automatic."
        : `Close the unmet gates: ${track.compliance.unmetGateIds.map((id) => `\`${id}\``).join(", ")}.`;
      return `| ${markdownCell(track.name)} (\`${track.id}\`) | **${track.engineeringMaturity}** | **${track.compliance.state}** | **${track.distribution.publicDistribution}** | ${nextAction} |`;
    }),
    "",
    "## Promotion gate status",
    "",
    "Each track is evaluated against the same four gate categories. A laboratory track with all gates satisfied is only eligible for human promotion review; the generator never changes its classification.",
    "",
  ];

  for (const track of result.tracks) {
    lines.push(
      `### ${track.name} (\`${track.id}\`)`,
      "",
      "| Gate | Meaning | State | Evidence | Next action |",
      "| --- | --- | --- | --- | --- |",
      ...track.gates.map((gate) => {
        const presentation = GATE_PRESENTATION[gate.category];
        return `| ${presentation.label} | ${presentation.meaning} | **${gate.state}** | ${evidenceSummary(gate)} | ${nextGateAction(gate)} |`;
      }),
      ""
    );
  }

  lines.push(
    "## Engineering maturity and distribution",
    "",
    `Engineering maturity is independent of public distribution permission. \`stable\` means the project maintains that engineering path; the separate \`default\` flag selects the flagship. Neither state means a binary or third-party asset is cleared for release. Current evaluated distribution summary: ${distributionSummary}.`,
    "",
    "The repository's MIT license does not by itself relicense third-party names, rules, trademarks, visual assets, fonts, audio, models, or datasets.",
    "",
    "## Provenance",
    "",
    `- Contract hash: \`${result.hash}\``,
    "- Classification authority: `config/product_capabilities.json`",
    "- Generated by `scripts/product_capability_contract.mjs`",
    `- Generator schema: \`${result.schema}@${result.version}\``,
    "- Evidence freshness: `ci-run` requires an ephemeral result bound to the current revision and contract hash; `expires` requires an explicit as-of date; `evergreen` proves only structural presence.",
    "- Tracked status is rendered without ephemeral CI results or local clock/mtime input, so missing runtime evidence is shown deterministically as `unverified` or `missing`.",
    ""
  );
  return `${lines.join("\n").replace(/\n+$/u, "")}\n`;
}

export function renderReadmeCapabilityBlock(contract, result) {
  if (!result.valid) throw new Error("Cannot render the README capability block from an invalid contract.");
  const defaultTrack = result.tracks.find((track) => track.id === contract.defaultTrackId);
  const otherStableTracks = result.tracks.filter((track) => track.engineeringMaturity === "stable" && !track.default);
  const laboratoryTracks = result.tracks.filter((track) => track.engineeringMaturity === "laboratory");
  const lines = [
    README_BLOCK_START,
    "## Current product capabilities (generated)",
    "",
    "> Classification comes only from `config/product_capabilities.json`; see `docs/CAPABILITY_STATUS.md` for gates, evidence state, and distribution boundaries.",
    "",
    `- **${defaultTrack.name}**: stable default flagship; start development with \`${defaultTrack.entryCommand}\`.`,
    ...otherStableTracks.map((track) => `- **${track.name}** (\`${track.id}\`): stable track; not the default flagship.`),
    ...laboratoryTracks.map(
      (track) => `- **${track.name}** (\`${track.id}\`): laboratory track.`
    ),
    "- Engineering maturity does not grant public distribution permission. See the status page for each track's current distribution posture.",
    "",
    README_BLOCK_END,
  ];
  return `${lines.join("\n")}\n`;
}

function readTextFile(filePath, label) {
  if (!fs.existsSync(filePath)) throw new Error(`${label} not found: ${filePath}`);
  return fs.readFileSync(filePath, "utf8");
}

function replaceReadmeCapabilityBlock(readme, generatedBlock) {
  const startIndex = readme.indexOf(README_BLOCK_START);
  const endIndex = readme.indexOf(README_BLOCK_END);
  const repeatedStart = startIndex >= 0 && readme.indexOf(README_BLOCK_START, startIndex + README_BLOCK_START.length) >= 0;
  const repeatedEnd = endIndex >= 0 && readme.indexOf(README_BLOCK_END, endIndex + README_BLOCK_END.length) >= 0;
  if ((startIndex >= 0) !== (endIndex >= 0) || repeatedStart || repeatedEnd || (startIndex >= 0 && endIndex < startIndex)) {
    throw new Error("README capability sentinels must appear exactly once and in start/end order.");
  }

  const eol = readme.includes("\r\n") ? "\r\n" : "\n";
  const block = generatedBlock.replaceAll("\n", eol);
  if (startIndex >= 0) {
    const afterEnd = endIndex + README_BLOCK_END.length;
    let suffixStart = afterEnd;
    if (readme.startsWith("\r\n", afterEnd)) suffixStart += 2;
    else if (readme.startsWith("\n", afterEnd)) suffixStart += 1;
    return `${readme.slice(0, startIndex)}${block}${readme.slice(suffixStart)}`;
  }

  const headingMatch = /\r?\n## [^\r\n]+\r?\n/u.exec(readme);
  if (headingMatch) {
    const insertionIndex = headingMatch.index + eol.length;
    return `${readme.slice(0, insertionIndex)}${block}${eol}${readme.slice(insertionIndex)}`;
  }
  const prefix = readme.endsWith("\r\n") || readme.endsWith("\n") ? readme : `${readme}${eol}`;
  return `${prefix}${eol}${block}`;
}

function expectedGeneratedArtifacts(contract, documentationResult, root) {
  const readmePath = path.join(root, README_PATH);
  const readme = readTextFile(readmePath, "README");
  return new Map([
    [CAPABILITY_STATUS_PATH, renderCapabilityStatus(contract, documentationResult)],
    [README_PATH, replaceReadmeCapabilityBlock(readme, renderReadmeCapabilityBlock(contract, documentationResult))],
  ]);
}

function generatedArtifactDrift(expectedArtifacts, root) {
  const drift = [];
  for (const [relativePath, expected] of expectedArtifacts) {
    const filePath = path.join(root, relativePath);
    const actual = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : null;
    if (actual !== expected) drift.push(relativePath);
  }
  return drift;
}

function writeGeneratedArtifacts(expectedArtifacts, root) {
  for (const [relativePath, expected] of expectedArtifacts) {
    const filePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    if (!fs.existsSync(filePath) || fs.readFileSync(filePath, "utf8") !== expected) {
      fs.writeFileSync(filePath, expected, "utf8");
    }
  }
}

function classificationAliases(track) {
  return [track.id, track.name, ...(track.claimAliases ?? [])].map((alias) => alias.trim().toLocaleLowerCase("en-US"));
}

function auditMaintainedCapabilitySurfaces(contract, root) {
  const findings = [];
  const maturityClaim = /\b(?:(?:engineering|product)\s+maturity\s*(?::|=|-|\bis\b)\s*(?:stable|laboratory)|is\s+(?:an?\s+)?(?:stable|laboratory)(?:\s+(?:(?:default|non-default)\s+)?(?:flagship|track|version))?|(?:stable|laboratory)\s+(?:(?:default|non-default)\s+)?(?:flagship|track|version))\b|(?:工程|产品)?成熟度\s*(?:[:：=]|是)\s*(?:稳定|实验室)(?:旗舰|轨道|版本)?|是(?:默认|非默认)?稳定(?:旗舰|轨道|版本)|(?:属于|是)(?:实验室|实验性)(?:轨道|版本)|实验性轨道/iu;
  const aliases = contract.tracks.map((track) => ({ trackId: track.id, aliases: classificationAliases(track) }));
  for (const { relativePath, requireStatusLink, auditClaims } of MAINTAINED_CAPABILITY_SURFACES) {
    const filePath = path.join(root, relativePath);
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath, "utf8");
    if (requireStatusLink && !content.includes(CAPABILITY_STATUS_PATH)) {
      findings.push({ kind: "missing-status-link", relativePath, line: null, trackId: null });
    }
    if (!auditClaims) continue;
    const lines = content.split(/\r?\n/u);
    let insideManagedBlock = false;
    let headingTrack = null;
    for (const [index, line] of lines.entries()) {
      if (relativePath === README_PATH && line.includes(README_BLOCK_START)) {
        insideManagedBlock = true;
        headingTrack = null;
        continue;
      }
      if (relativePath === README_PATH && line.includes(README_BLOCK_END)) {
        insideManagedBlock = false;
        headingTrack = null;
        continue;
      }
      if (insideManagedBlock) continue;
      const lowerLine = line.toLocaleLowerCase("en-US");
      const lineTrack = aliases.find((entry) => entry.aliases.some((alias) => lowerLine.includes(alias)));
      if (/^#{1,6}\s+/u.test(line)) headingTrack = lineTrack;
      if (!maturityClaim.test(line)) continue;
      const matchedTrack = lineTrack ?? headingTrack;
      if (matchedTrack) {
        findings.push({ kind: "parallel-classification", relativePath, line: index + 1, trackId: matchedTrack.trackId });
      }
    }
  }
  return findings;
}

function parseCliArgs(argv) {
  const [mode, ...args] = argv;
  if (!new Set(["inspect", "check", "write"]).has(mode)) {
    throw new Error("Mode must be one of: inspect, check, write.");
  }
  const { values } = parseArgs({
    args,
    allowPositionals: false,
    strict: true,
    options: {
      json: { type: "boolean", default: false },
      "require-current": { type: "boolean", default: false },
      contract: { type: "string" },
      root: { type: "string" },
      results: { type: "string" },
      revision: { type: "string" },
      "as-of": { type: "string" },
    },
  });
  const root = path.resolve(values.root ?? process.cwd());
  const options = {
    mode,
    json: values.json,
    requireCurrent: values["require-current"],
    contractPath: path.resolve(values.contract ?? path.join(root, "config", "product_capabilities.json")),
    root,
    resultsPath: values.results ? path.resolve(values.results) : null,
    revision: values.revision ?? null,
    asOf: values["as-of"] ?? null,
  };
  if (mode === "inspect" && !options.json) throw new Error("inspect requires --json.");
  if (mode !== "inspect" && options.json) throw new Error("--json is only valid with inspect.");
  if (mode !== "check" && options.requireCurrent) throw new Error("--require-current is only valid with check.");
  if (options.asOf && !isValidIsoDate(options.asOf)) throw new Error("--as-of must be a valid YYYY-MM-DD date.");
  if (options.resultsPath && !options.revision) throw new Error("--revision is required when --results is supplied.");
  return options;
}

function readJsonFile(filePath, label) {
  return JSON.parse(readTextFile(filePath, label));
}

function normalizeExecutionResults(value, { revision, contractHash }) {
  if (!isPlainObject(value)) throw new Error("Execution results JSON must be a versioned result manifest object.");
  if (value.schema !== PRODUCT_CAPABILITY_CI_RESULTS_SCHEMA) {
    throw new Error(`Execution results schema must be ${PRODUCT_CAPABILITY_CI_RESULTS_SCHEMA}.`);
  }
  if (value.version !== PRODUCT_CAPABILITY_CI_RESULTS_VERSION) {
    throw new Error(`Execution results version must be ${PRODUCT_CAPABILITY_CI_RESULTS_VERSION}.`);
  }
  if (value.revision !== revision) throw new Error("Execution results manifest revision does not match --revision.");
  if (value.contractHash !== contractHash) throw new Error("Execution results manifest contractHash does not match the contract.");
  if (!Array.isArray(value.results)) throw new Error("Execution results manifest requires a results array.");
  return value.results;
}

function collectReferenceAvailability(contract, root) {
  let packageScripts = {};
  const packagePath = path.join(root, "package.json");
  if (fs.existsSync(packagePath)) {
    try {
      packageScripts = JSON.parse(fs.readFileSync(packagePath, "utf8")).scripts ?? {};
    } catch {
      packageScripts = {};
    }
  }
  const availability = new Map();
  const tracks = Array.isArray(contract?.tracks) ? contract.tracks : [];
  for (const track of tracks) {
    const gates = Array.isArray(track?.promotionGates) ? track.promotionGates : [];
    for (const gate of gates) {
      const evidenceEntries = Array.isArray(gate?.evidence) ? gate.evidence : [];
      for (const evidence of evidenceEntries) {
        const reference = evidence?.reference;
        if (typeof reference !== "string") continue;
        const npmMatch = /^npm run (.+)$/.exec(reference);
        availability.set(reference, npmMatch ? Object.hasOwn(packageScripts, npmMatch[1]) : fs.existsSync(path.join(root, reference)));
      }
    }
  }
  return availability;
}

function printDiagnostics(diagnostics) {
  for (const entry of diagnostics) console.error(`${entry.code} at ${entry.path}: ${entry.message}`);
}

export function runCapabilityContractCli(argv = process.argv.slice(2)) {
  let cli;
  try {
    cli = parseCliArgs(argv);
  } catch (error) {
    console.error(error.message);
    return 2;
  }

  let contract;
  try {
    contract = readJsonFile(cli.contractPath, "Capability contract");
  } catch (error) {
    if (cli.mode === "inspect" && error instanceof SyntaxError) {
      console.log(
        JSON.stringify(
          emptyEvaluation(null, null, [diagnostic("invalid-json", "$", error.message)], {
            revision: cli.revision,
            asOf: cli.asOf,
          }),
          null,
          2
        )
      );
      return 1;
    }
    console.error(error.message);
    return error instanceof SyntaxError ? 1 : 2;
  }

  let executionResults = [];
  try {
    if (cli.resultsPath) {
      executionResults = normalizeExecutionResults(readJsonFile(cli.resultsPath, "Execution results"), {
        revision: cli.revision,
        contractHash: hashCapabilityContract(contract),
      });
    }
  } catch (error) {
    console.error(error.message);
    return 2;
  }

  const referenceAvailability = collectReferenceAvailability(contract, cli.root);
  const result = evaluateCapabilityContract(contract, {
    asOf: cli.asOf,
    revision: cli.revision,
    executionResults,
    referenceAvailability,
  });

  if (cli.mode === "inspect") {
    console.log(JSON.stringify(result, null, 2));
    return result.valid ? 0 : 1;
  }

  if (!result.valid) {
    printDiagnostics(result.diagnostics);
    return 1;
  }
  if (!result.compliance.referencesResolved) {
    for (const entry of result.compliance.unresolvedEvidenceReferences) {
      console.error(
        `missing-evidence-reference: ${entry.trackId}/${entry.gateId}/${entry.evidenceId} (${entry.reference})`
      );
    }
    return 1;
  }

  const documentationResult = evaluateCapabilityContract(contract, { referenceAvailability });
  let expectedArtifacts;
  try {
    expectedArtifacts = expectedGeneratedArtifacts(contract, documentationResult, cli.root);
  } catch (error) {
    console.error(`generated-capability-readme: ${error.message}`);
    return fs.existsSync(path.join(cli.root, README_PATH)) ? 1 : 2;
  }

  const parallelClassifications = auditMaintainedCapabilitySurfaces(contract, cli.root);
  if (parallelClassifications.length > 0) {
    for (const finding of parallelClassifications) {
      if (finding.kind === "missing-status-link") {
        console.error(`missing-capability-status-link: ${finding.relativePath}; link to ${CAPABILITY_STATUS_PATH}`);
      } else {
        console.error(
          `parallel-capability-classification: ${finding.relativePath}:${finding.line} (${finding.trackId}); use ${CAPABILITY_STATUS_PATH}`
        );
      }
    }
    return 1;
  }

  if (cli.mode === "write") {
    writeGeneratedArtifacts(expectedArtifacts, cli.root);
    console.log(`Wrote product capability status to ${CAPABILITY_STATUS_PATH} and refreshed the ${README_PATH} managed block.`);
    return 0;
  }

  const drift = generatedArtifactDrift(expectedArtifacts, cli.root);
  if (drift.length > 0) {
    for (const relativePath of drift) console.error(`generated-capability-drift: ${relativePath}`);
    return 1;
  }
  if (cli.requireCurrent && !result.compliance.currentVerificationCompliant) {
    for (const trackId of result.compliance.noncompliantStableTrackIds) {
      const track = result.tracks.find((entry) => entry.id === trackId);
      console.error(`noncompliant-stable-track: ${trackId} (${track.compliance.unmetGateIds.join(", ")})`);
    }
    return 1;
  }
  console.log(
    cli.requireCurrent
      ? "Product capability contract, generated capability docs, and current stable evidence are compliant."
      : "Product capability contract is structurally valid and generated capability docs are current."
  );
  return 0;
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  process.exitCode = runCapabilityContractCli();
}
