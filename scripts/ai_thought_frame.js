import { clamp, getAllRoles, getRoleById, sample } from "./data.js";
import { getEffectiveRoleId, getPerceivedRoleId } from "./engine.js";
import {
  areKnownAllies,
  buildAgentView,
  countAgentEvidence,
  getAIAgent,
  summarizeEvidenceForDialogue,
} from "./ai_agents.js";

function thoughtFrameClock(state, options = {}) {
  return options.clock ?? state.dayStageMeta?.publicConversation?.clock ?? state.dayStage ?? state.phase ?? "unknown";
}

function roleForPlayer(state, player) {
  return getRoleById(state.scriptId, getEffectiveRoleId(player) ?? player?.roleId) ?? null;
}

function perceivedRoleForPlayer(state, player) {
  return getRoleById(state.scriptId, getPerceivedRoleId(player) ?? getEffectiveRoleId(player) ?? player?.roleId) ?? null;
}

function isEarlyInfoRole(role) {
  return !!role?.tags?.includes("info") && (role.tags.includes("firstNight") || role.tags.includes("recurring"));
}

function isPowerRole(role) {
  return !!role?.tags?.some((tag) => ["protect", "revive", "burst", "control", "transform", "demonBackup"].includes(tag));
}

function evilPrior(state, viewer) {
  const evilSlots = state.setupCounts.minion + state.setupCounts.demon;
  const denominator = Math.max(1, state.players.length - 1);
  if (viewer.team === "evil") {
    return clamp((evilSlots - 1) / denominator, 0.05, 0.85);
  }
  return clamp(evilSlots / denominator, 0.05, 0.85);
}

function getScriptPressureProfile(state) {
  const roleIds = new Set(getAllRoles(state.scriptId).map((role) => role.id));
  return {
    outsiderClaimsRisky: roleIds.has("godfather") || roleIds.has("fang-gu"),
    outsiderClaimsPlausible: roleIds.has("baron") || roleIds.has("drunk") || roleIds.has("fang-gu"),
  };
}

function defaultPickClaimRole(state, aiPlayer) {
  return aiPlayer?.publicClaimRoleId ?? getPerceivedRoleId(aiPlayer) ?? getEffectiveRoleId(aiPlayer) ?? aiPlayer?.roleId ?? null;
}

function thoughtFrameSelfDisclosureNeed(state, aiPlayer, options = {}) {
  if (!aiPlayer || aiPlayer.publicClaimRoleId) {
    return "none";
  }
  if (!aiPlayer.alive) {
    return "hard_claim";
  }
  const role = perceivedRoleForPlayer(state, aiPlayer) ?? roleForPlayer(state, aiPlayer);
  const profile = getScriptPressureProfile(state);
  const selfHeat = Number.isFinite(aiPlayer.suspicion?.[aiPlayer.id])
    ? aiPlayer.suspicion[aiPlayer.id]
    : evilPrior(state, aiPlayer);
  const day = Math.max(1, Number(state.day) || 1);
  const roundInDay = Number(options.roundInDay ?? state.dayStageMeta?.publicRounds ?? 1) || 1;
  const clock = thoughtFrameClock(state, options);
  const pressure = selfHeat >= 0.62 || aiPlayer.beenNominatedToday;
  if (pressure || day >= 3) {
    return "hard_claim";
  }
  if (role?.category === "outsider") {
    if (profile.outsiderClaimsRisky && day <= 1) {
      return roundInDay <= 1 ? "range" : "hard_claim";
    }
    return "hard_claim";
  }
  if (isEarlyInfoRole(role)) {
    if (day >= 2 || clock === "response" || clock === "crossfire") {
      return "hard_claim";
    }
    return "range";
  }
  if (isPowerRole(role)) {
    return day >= 2 || roundInDay >= 2 ? "range" : "none";
  }
  return day >= 2 && roundInDay >= 2 ? "range" : "none";
}

function thoughtFrameDisclosureRoleId(state, aiPlayer, selfDisclosureNeed, rng = Math.random, deps = {}) {
  if (!aiPlayer || selfDisclosureNeed === "none") {
    return null;
  }
  if (aiPlayer.publicClaimRoleId) {
    return aiPlayer.publicClaimRoleId;
  }
  if (selfDisclosureNeed === "hard_claim") {
    return (deps.pickClaimRole ?? defaultPickClaimRole)(state, aiPlayer, rng, { force: true });
  }
  const role = perceivedRoleForPlayer(state, aiPlayer) ?? roleForPlayer(state, aiPlayer);
  return role?.id ?? null;
}

function thoughtFrameSocialRisk(state, aiPlayer, selfDisclosureNeed) {
  const role = perceivedRoleForPlayer(state, aiPlayer) ?? roleForPlayer(state, aiPlayer);
  const selfHeat = Number.isFinite(aiPlayer?.suspicion?.[aiPlayer?.id])
    ? aiPlayer.suspicion[aiPlayer.id]
    : evilPrior(state, aiPlayer);
  let risk = 0.18 + selfHeat * 0.45;
  if (isPowerRole(role)) risk += 0.22;
  if (isEarlyInfoRole(role)) risk += 0.08;
  if (role?.category === "outsider") risk -= 0.06;
  if (selfDisclosureNeed === "hard_claim") risk += 0.12;
  if (!aiPlayer?.alive) risk -= 0.22;
  return clamp(risk, 0, 1);
}

function thoughtFrameIntendedAct(state, primary, selfDisclosureNeed, nominationReadiness, options = {}) {
  const stage = options.stage ?? state.dayStage ?? "";
  const clock = thoughtFrameClock(state, options);
  if (stage === "private") {
    return "whisper";
  }
  if (stage === "nomination" && nominationReadiness >= 0.62) {
    return "nominate";
  }
  if (selfDisclosureNeed === "hard_claim") {
    return "claim";
  }
  if (selfDisclosureNeed === "range") {
    return "claim_range";
  }
  if ((primary?.score ?? 0) >= 0.6 || clock === "crossfire") {
    return "pressure";
  }
  if ((primary?.score ?? 0) >= 0.42) {
    return "probe";
  }
  return "hold";
}

export function rememberAIThoughtFrame(state, frame) {
  if (!frame?.agentId) {
    return frame;
  }
  state.aiDialogue = state.aiDialogue ?? {};
  state.aiDialogue.thoughtFramesByAgentId = state.aiDialogue.thoughtFramesByAgentId ?? {};
  state.aiDialogue.thoughtFramesByAgentId[frame.agentId] = frame;
  return frame;
}

export function buildAIThoughtFrameCore(state, aiPlayer, options = {}, deps = {}) {
  state.aiDialogue = state.aiDialogue ?? {};
  state.aiDialogue.thoughtFramesByAgentId = state.aiDialogue.thoughtFramesByAgentId ?? {};
  const agentView = options.agentView ?? buildAgentView(state, aiPlayer, {
    audience: options.audience ?? "public",
  });
  const rankTargets = deps.rankTargets ?? (() => []);
  const expectedSupportFor = deps.expectedSupportFor ?? (() => 0);
  const excludeConcernIds = new Set(options.excludeConcernIds ?? []);
  const ranked = rankTargets(aiPlayer, state, Math.min(4, state.players.length))
    .filter((entry) => entry.player.alive && !excludeConcernIds.has(entry.player.id) && !areKnownAllies(state, aiPlayer, entry.player));
  const primary = ranked[0] ?? null;
  const secondary = ranked.find((entry) => entry.player.id !== primary?.player.id) ?? null;
  const evidenceReasons = primary
    ? summarizeEvidenceForDialogue(agentView ?? state, aiPlayer, primary.player.id, {
        limit: 2,
        publicOnly: options.audience === "public",
        redactPrivate: options.audience === "public",
      })
    : [];
  const evidenceCount = primary
    ? agentView?.evidenceCountForTarget?.(primary.player.id) ?? countAgentEvidence(getAIAgent(state, aiPlayer), primary.player.id)
    : 0;
  const support = primary ? expectedSupportFor(state, primary.player.id) : 0;
  const nominationReadiness = primary
    ? clamp((primary.score ?? 0) * 0.75 + Math.min(0.18, evidenceCount * 0.045) + Math.min(0.12, support * 0.03), 0, 1)
    : 0;
  const selfDisclosureNeed = thoughtFrameSelfDisclosureNeed(state, aiPlayer, options);
  const suggestedClaimRoleId = thoughtFrameDisclosureRoleId(state, aiPlayer, selfDisclosureNeed, options.rng ?? Math.random, deps);
  const socialRisk = thoughtFrameSocialRisk(state, aiPlayer, selfDisclosureNeed);
  const intendedAct = thoughtFrameIntendedAct(state, primary, selfDisclosureNeed, nominationReadiness, options);
  const frame = {
    agentId: aiPlayer?.id ?? "",
    day: state.day ?? 0,
    night: state.night ?? 0,
    phase: state.phase ?? "",
    dayStage: state.dayStage ?? "",
    clock: thoughtFrameClock(state, options),
    primaryConcernId: primary?.player.id ?? null,
    primaryConcernName: primary?.player.name ?? "",
    primaryScore: primary?.score ?? 0,
    secondaryConcernId: secondary?.player.id ?? null,
    secondaryConcernName: secondary?.player.name ?? "",
    selfDisclosureNeed,
    suggestedClaimRoleId,
    socialRisk,
    nominationReadiness,
    questionToAsk: primary ? `让 ${primary.player.name} 把身份和昨晚信息说清楚` : "",
    evidenceReasons,
    intendedAct,
  };
  return rememberAIThoughtFrame(state, frame);
}

export function thoughtFrameDisclosureLine(state, aiPlayer, thoughtFrame, rng = Math.random) {
  if (!thoughtFrame || thoughtFrame.selfDisclosureNeed !== "range") {
    return "";
  }
  const role = getRoleById(state.scriptId, thoughtFrame.suggestedClaimRoleId)
    ?? perceivedRoleForPlayer(state, aiPlayer)
    ?? roleForPlayer(state, aiPlayer);
  if (!role) {
    return "";
  }
  if (role.category === "outsider") {
    return sample(
      [
        "我先给范围：我偏外来者，不是强信息位。",
        "身份先不说死，但我这边更像外来者范围。",
      ],
      1,
      rng
    )[0] ?? "";
  }
  if (isEarlyInfoRole(role)) {
    return sample(
      [
        "我先给范围：我有早期信息，但第一轮不想全部倒出来。",
        "我不是空白位，昨晚信息可以被追问，但先别逼我一次说满。",
      ],
      1,
      rng
    )[0] ?? "";
  }
  if (isPowerRole(role)) {
    return sample(
      [
        "我先给范围：我不是低信息位，技能细节先保留一点。",
        "我这边偏功能位，今天先别把细节一次逼干净。",
      ],
      1,
      rng
    )[0] ?? "";
  }
  return "我先给范围：我不是完全空白的位置。";
}
