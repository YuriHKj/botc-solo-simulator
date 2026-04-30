import { getRoleById } from "./data.js";

const MAX_UTTERANCE_RECORDS = 1400;
export const UTTERANCE_SCHEMA_VERSION = "botc-label-schema-mvp-v1";

export const SPEECH_ACT_ENUM = Object.freeze([
  "hard_claim",
  "soft_claim",
  "role_explain",
  "info_dump",
  "withhold_info",
  "partial_reveal",
  "mechanical_check",
  "probe",
  "cross_check",
  "trap_question",
  "consistency_check",
  "private_pull",
  "accuse",
  "defend",
  "pressure",
  "coordinate_vote",
  "anti_execute",
  "nominate",
  "second_push",
  "fake_claim",
  "bait",
  "frame",
  "distance",
  "pocket",
  "hedge",
  "mad_play",
]);

function uniqueStrings(values) {
  return [...new Set((values ?? []).map((entry) => `${entry ?? ""}`.trim()).filter(Boolean))];
}

function seatTag(player) {
  if (!player || !Number.isFinite(player.seatIndex)) {
    return "";
  }
  return `P${player.seatIndex + 1}`;
}

function normalizeAudience(audience) {
  return `${audience ?? ""}`.trim().toLowerCase() === "private" ? "private" : "public";
}

function resolvePublicClaim(state, speaker) {
  if (!speaker?.publicClaimRoleId) {
    return "";
  }
  const role = getRoleById(state.scriptId, speaker.publicClaimRoleId);
  return role?.name ?? speaker.publicClaimRoleId;
}

function resolveSpeakerState(speaker) {
  if (!speaker) {
    return {
      alive_dead: "unknown",
      sober_drunk: "unknown",
      healthy_poisoned: "unknown",
      sane_mad: "unknown",
    };
  }
  const isDrunkRole = `${speaker.roleId ?? ""}`.trim() === "drunk";
  return {
    alive_dead: speaker.alive ? "alive" : "dead",
    sober_drunk: isDrunkRole ? "drunk" : "sober",
    healthy_poisoned: speaker.poisoned ? "poisoned" : "healthy",
    sane_mad: "unknown",
  };
}

function mapTargets(state, rawTargets = []) {
  const normalized = Array.isArray(rawTargets) ? rawTargets : [rawTargets];
  return uniqueStrings(
    normalized.map((entry) => {
      if (typeof entry === "string") {
        const trimmed = entry.trim();
        if (!trimmed) {
          return "";
        }
        if (/^P\d+$/i.test(trimmed)) {
          return trimmed.toUpperCase();
        }
        const byId = state.players?.find((player) => player.id === trimmed);
        return byId ? seatTag(byId) : trimmed;
      }
      if (entry && typeof entry === "object") {
        if (typeof entry.id === "string") {
          const byId = state.players?.find((player) => player.id === entry.id);
          return byId ? seatTag(byId) : entry.id;
        }
        if (Number.isFinite(entry.seatIndex)) {
          return `P${entry.seatIndex + 1}`;
        }
      }
      return "";
    })
  );
}

function inferSpeakerLabel(state, speakerId) {
  const speaker = state.players?.find((entry) => entry.id === speakerId) ?? null;
  if (speaker) {
    return seatTag(speaker);
  }
  return `${speakerId ?? ""}`.trim();
}

export function createEmptyUtteranceArchive() {
  return {
    schemaVersion: UTTERANCE_SCHEMA_VERSION,
    nextIndex: 1,
    all: [],
    public: [],
    private: [],
  };
}

export function ensureUtteranceArchive(state) {
  state.utteranceArchive = state.utteranceArchive ?? createEmptyUtteranceArchive();
  state.utteranceArchive.schemaVersion = UTTERANCE_SCHEMA_VERSION;
  state.utteranceArchive.nextIndex = Math.max(1, Number.parseInt(state.utteranceArchive.nextIndex ?? 1, 10) || 1);
  state.utteranceArchive.all = Array.isArray(state.utteranceArchive.all) ? state.utteranceArchive.all : [];
  state.utteranceArchive.public = Array.isArray(state.utteranceArchive.public) ? state.utteranceArchive.public : [];
  state.utteranceArchive.private = Array.isArray(state.utteranceArchive.private) ? state.utteranceArchive.private : [];
  return state.utteranceArchive;
}

export function inferSpeechActsFromIntent(intent, { audience = "public", isQuestion = false } = {}) {
  const normalized = `${intent ?? ""}`.trim().toLowerCase();
  const acts = [];

  if (normalizeAudience(audience) === "private") {
    acts.push("private_pull");
  }
  if (isQuestion) {
    acts.push("probe");
  }

  switch (normalized) {
    case "suspect":
      acts.push("accuse");
      break;
    case "reason":
      acts.push("mechanical_check");
      break;
    case "trust":
      acts.push("defend");
      break;
    case "claim":
      acts.push(isQuestion ? "pressure" : "soft_claim");
      break;
    case "vote":
      acts.push("coordinate_vote");
      break;
    case "night":
      acts.push("info_dump");
      break;
    case "compare":
      acts.push("cross_check");
      break;
    case "plan":
      acts.push("pressure");
      break;
    default:
      acts.push("hedge");
      break;
  }
  return uniqueStrings(acts).filter((entry) => SPEECH_ACT_ENUM.includes(entry));
}

export function recordUtteranceMVP(
  state,
  {
    speakerId,
    audience = "public",
    text = "",
    speechActs = [],
    targets = [],
    intent = "",
    voteStance = "",
    evidenceSource = "",
    epistemicStrength = null,
    nominationRelated = false,
    truthStatusObjective = "",
    truthStatusSubjective = "",
    deceptionType = "",
    metadata = {},
  }
) {
  const archive = ensureUtteranceArchive(state);
  const speaker = state.players?.find((entry) => entry.id === speakerId) ?? null;
  const normalizedAudience = normalizeAudience(audience);
  const utteranceId = `d${Number.isFinite(state.day) ? state.day : 0}_u${archive.nextIndex}`;
  archive.nextIndex += 1;

  const record = {
    game_id: state.id ?? "",
    script: state.scriptName ?? state.scriptId ?? "",
    phase: state.phase ?? "",
    day_index: Number.isFinite(state.day) ? state.day : 0,
    utterance_id: utteranceId,
    speaker: inferSpeakerLabel(state, speakerId),
    audience: normalizedAudience,
    speaker_alive: !!speaker?.alive,
    speaker_private_role: speaker?.roleName ?? "",
    speaker_alignment: speaker?.team ?? "",
    speaker_public_claim: resolvePublicClaim(state, speaker),
    speaker_state: resolveSpeakerState(speaker),
    text: `${text ?? ""}`.replace(/\s+/g, " ").trim(),
    speech_acts: uniqueStrings(speechActs).filter((entry) => SPEECH_ACT_ENUM.includes(entry)),
    targets: mapTargets(state, targets),
    vote_stance: `${voteStance ?? ""}`.trim(),
    intent: `${intent ?? ""}`.trim(),
    evidence_source: `${evidenceSource ?? ""}`.trim(),
    epistemic_strength: Number.isFinite(epistemicStrength) ? Math.max(0, Math.min(3, Math.round(epistemicStrength))) : null,
    nomination_related: !!nominationRelated,
    truth_status_objective: `${truthStatusObjective ?? ""}`.trim(),
    truth_status_subjective: `${truthStatusSubjective ?? ""}`.trim(),
    deception_type: `${deceptionType ?? ""}`.trim(),
    timestamp: Date.now(),
    metadata: metadata && typeof metadata === "object" ? metadata : {},
  };

  archive.all.push(record);
  if (normalizedAudience === "private") {
    archive.private.push(record);
  } else {
    archive.public.push(record);
  }

  if (archive.all.length > MAX_UTTERANCE_RECORDS) {
    archive.all.splice(0, archive.all.length - MAX_UTTERANCE_RECORDS);
  }
  if (archive.public.length > MAX_UTTERANCE_RECORDS) {
    archive.public.splice(0, archive.public.length - MAX_UTTERANCE_RECORDS);
  }
  if (archive.private.length > MAX_UTTERANCE_RECORDS) {
    archive.private.splice(0, archive.private.length - MAX_UTTERANCE_RECORDS);
  }

  return record;
}
