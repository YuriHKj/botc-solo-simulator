import { clamp, getAllRoles, getRoleById, REASON_SNIPPETS, sample } from "./data.js";
import { addLog, consumePrivateChat, getAlivePlayers, getEffectiveRoleId, getPerceivedRoleId, getPlayerById } from "./engine.js";
import { inferSpeechActsFromIntent, recordUtteranceMVP } from "./dialogue_schema.js";
import { predictDialogueSignals, voteLabelToInGameStance } from "./ml_runtime.js";
import {
  areKnownAllies,
  clearAgentBeliefTrail,
  countAgentEvidence,
  ensureAIAgents,
  getAIAgent,
  getAgentObservations,
  getAgentEvidence,
  getEvidenceForTarget,
  getKnownAllyIds,
  getKnownBluffRoleIds,
  getSuspicionTrailForTarget,
  getVisibleClaims,
  getVisibleSpeeches,
  recordPrivateWhisperForAgents,
  recordPublicClaimForAgents,
  recordPublicSpeechForAgents,
  recordSuspicionChangeFromEvidence,
} from "./ai_agents.js";

const QUESTION_INTENT = {
  SUSPECT: "suspect",
  REASON: "reason",
  TRUST: "trust",
  CLAIM: "claim",
  VOTE: "vote",
  NIGHT: "night",
  COMPARE: "compare",
  PLAN: "plan",
  GENERIC: "generic",
};

const INTENT_KEYWORDS = {
  [QUESTION_INTENT.SUSPECT]: ["怀疑", "可疑", "谁像恶魔", "嫌疑", "刀口", "首推", "谁坏", "suspect", "suspicious"],
  [QUESTION_INTENT.REASON]: ["理由", "原因", "依据", "为什么", "证据", "怎么判断", "reason", "why", "because"],
  [QUESTION_INTENT.TRUST]: ["信任", "相信", "你可信吗", "我像好人", "你怎么看我", "trust", "safe"],
  [QUESTION_INTENT.CLAIM]: ["身份", "报身份", "你是啥", "你什么角色", "你是什么", "claim", "role", "identity"],
  [QUESTION_INTENT.VOTE]: ["投票", "赞成", "反对", "提名", "会投", "要不要票", "vote", "nominate"],
  [QUESTION_INTENT.NIGHT]: ["昨晚", "昨夜", "夜里", "夜间", "夜晚", "夜死", "night", "last night"],
  [QUESTION_INTENT.COMPARE]: ["比较", "对比", "谁更", "哪个更", "相比", "vs", "compare"],
  [QUESTION_INTENT.PLAN]: ["建议", "下一步", "怎么做", "策略", "计划", "节奏", "plan", "next step"],
};

const ACCUSE_WORDS = ["可疑", "像恶魔", "像爪牙", "该票", "该处决", "危险", "带坏节奏", "推锅", "execute", "vote out"];
const DEFEND_WORDS = ["清白", "像好人", "别投", "可信", "安全", "可以信", "不用票", "safe", "trust"];

const LOCAL_REASON_SNIPPETS = {
  bluffHit: "这名玩家的身份声称命中恶魔常用伪装位",
  duplicateClaim: "这名玩家的身份声称与他人冲突",
  antiGoodVote: "这名玩家的投票更像在保护邪恶方",
  proGoodVote: "这名玩家的投票帮助了好人推进",
  suspiciousNomination: "这名玩家发起了高风险提名",
  nightPattern: "夜间死亡节奏与这名玩家的白天行为存在关联",
  claimFlip: "这名玩家在不同天里更换了身份说法",
  humanAccuse: "私聊里这名玩家持续施压某个目标",
  humanDefend: "私聊里这名玩家明显在维护某个目标",
  privateEvasive: "这名玩家在关键问题上回避细节",
};

const PERSONA_TYPES = {
  STEADY: "steady",
  PRESSURE: "pressure",
  SHADOW: "shadow",
};

const PERSONA_LABELS = {
  [PERSONA_TYPES.STEADY]: "稳健",
  [PERSONA_TYPES.PRESSURE]: "强压",
  [PERSONA_TYPES.SHADOW]: "隐锋",
};

function ensureDialogueState(state) {
  state.aiDialogue = state.aiDialogue ?? {};
  state.aiDialogue.pairMemory = state.aiDialogue.pairMemory ?? {};
  state.aiDialogue.timeline = Array.isArray(state.aiDialogue.timeline) ? state.aiDialogue.timeline : [];
  state.aiDialogue.publicRoundByDay = state.aiDialogue.publicRoundByDay ?? {};
  state.aiDialogue.activeSpeech = state.aiDialogue.activeSpeech ?? null;
  state.aiDialogue.dailyFocusLock = state.aiDialogue.dailyFocusLock ?? {};
  state.aiDialogue.dayStanceMemory = state.aiDialogue.dayStanceMemory ?? {};
  state.aiDialogue.lastPublicFocusBySpeaker = state.aiDialogue.lastPublicFocusBySpeaker ?? {};
  state.aiDialogue.lastPublicTemplateBySpeaker = state.aiDialogue.lastPublicTemplateBySpeaker ?? {};
  state.aiDialogue.proactivePrivateByDay = state.aiDialogue.proactivePrivateByDay ?? {};
  state.aiDialogue.aiPrivateByDay = state.aiDialogue.aiPrivateByDay ?? {};
  return state.aiDialogue;
}

function pushTimeline(state, entry) {
  const dialogue = ensureDialogueState(state);
  const record = {
    id: `${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    timestamp: Date.now(),
    day: state.day,
    night: state.night,
    ...entry,
  };
  dialogue.timeline.push(record);
  if (dialogue.timeline.length > 80) {
    dialogue.timeline.splice(0, dialogue.timeline.length - 80);
  }
  dialogue.activeSpeech = record;
}

function dailyFocusKey(day, aiId) {
  return `${day}:${aiId}`;
}

function stanceMemoryBucket(state) {
  const dialogue = ensureDialogueState(state);
  const dayKey = `${state.day ?? 0}`;
  dialogue.dayStanceMemory[dayKey] = dialogue.dayStanceMemory[dayKey] ?? {};
  return dialogue.dayStanceMemory[dayKey];
}

function stanceFromScore(score) {
  if (!Number.isFinite(score)) {
    return "unknown";
  }
  if (score >= 0.68) {
    return "press";
  }
  if (score >= 0.56) {
    return "suspect";
  }
  if (score <= 0.34) {
    return "trust";
  }
  return "watch";
}

function rememberDayStance(state, aiPlayer, targetId, score, source = "dialogue") {
  if (!aiPlayer?.id || !targetId) {
    return null;
  }
  const bucket = stanceMemoryBucket(state);
  const aiBucket = (bucket[aiPlayer.id] = bucket[aiPlayer.id] ?? {});
  const nextStance = stanceFromScore(score);
  const existing = aiBucket[targetId] ?? null;
  if (!existing) {
    aiBucket[targetId] = {
      targetId,
      stance: nextStance,
      firstScore: Number.isFinite(score) ? score : null,
      lastScore: Number.isFinite(score) ? score : null,
      sources: [source],
      turns: 1,
    };
    return aiBucket[targetId];
  }

  const previousScore = Number.isFinite(existing.lastScore) ? existing.lastScore : existing.firstScore;
  const canChange =
    nextStance !== existing.stance &&
    Number.isFinite(score) &&
    (!Number.isFinite(previousScore) || Math.abs(score - previousScore) >= 0.18 || nextStance === "press");

  if (canChange) {
    existing.previousStance = existing.stance;
    existing.stance = nextStance;
  }
  existing.lastScore = Number.isFinite(score) ? score : existing.lastScore;
  existing.sources = [...new Set([...(existing.sources ?? []), source])];
  existing.turns = (existing.turns ?? 0) + 1;
  return existing;
}

function dayStanceLabel(stance) {
  return {
    press: "强压",
    suspect: "怀疑",
    watch: "观察",
    trust: "偏信",
    unknown: "未知",
  }[stance] ?? "观察";
}

function getDailyFocusLock(state, aiPlayer) {
  const dialogue = ensureDialogueState(state);
  return dialogue.dailyFocusLock[dailyFocusKey(state.day, aiPlayer.id)] ?? null;
}

function setDailyFocusLock(state, aiPlayer, focus) {
  if (!focus?.player?.id) {
    return;
  }
  const dialogue = ensureDialogueState(state);
  dialogue.dailyFocusLock[dailyFocusKey(state.day, aiPlayer.id)] = {
    focusId: focus.player.id,
    focusScore: focus.score,
    updatedAt: Date.now(),
  };
}

function resolveStableFocus(state, aiPlayer, proposedFocus, ranked, options = {}) {
  const explicitMention = !!options.explicitMention;
  if (!proposedFocus) {
    return { focus: null, lockRetained: false };
  }
  if (explicitMention) {
    return { focus: proposedFocus, lockRetained: false };
  }

  const existing = getDailyFocusLock(state, aiPlayer);
  if (!existing) {
    setDailyFocusLock(state, aiPlayer, proposedFocus);
    return { focus: proposedFocus, lockRetained: false };
  }

  if (existing.focusId === proposedFocus.player.id) {
    setDailyFocusLock(state, aiPlayer, proposedFocus);
    return { focus: proposedFocus, lockRetained: false };
  }

  const locked = ranked.find((entry) => entry.player.id === existing.focusId);
  if (!locked) {
    setDailyFocusLock(state, aiPlayer, proposedFocus);
    return { focus: proposedFocus, lockRetained: false };
  }

  const leadDelta = proposedFocus.score - locked.score;
  if (leadDelta >= 0.12) {
    setDailyFocusLock(state, aiPlayer, proposedFocus);
    return { focus: proposedFocus, lockRetained: false };
  }

  return { focus: locked, lockRetained: true };
}

function pairMemoryKey(aiId, humanId) {
  return `${aiId}::${humanId}`;
}

function ensurePairMemory(state, aiId, humanId) {
  const dialogue = ensureDialogueState(state);
  const key = pairMemoryKey(aiId, humanId);
  dialogue.pairMemory[key] = dialogue.pairMemory[key] ?? {
    turns: 0,
    lastDay: 0,
    lastIntent: QUESTION_INTENT.GENERIC,
    pressure: 0,
    cooperation: 0,
    lastFocusId: null,
    lastFocusScore: null,
    lastQuestion: "",
    lastResponse: "",
  };
  return dialogue.pairMemory[key];
}

function ensureAIFields(aiPlayer) {
  aiPlayer.reasonFlags = aiPlayer.reasonFlags ?? {};
  aiPlayer.dialogueBias = aiPlayer.dialogueBias ?? {};
  if (!aiPlayer.aiPersona) {
    aiPlayer.aiPersona = PERSONA_TYPES.STEADY;
  }
  Object.keys(aiPlayer.reasonFlags).forEach((targetId) => {
    if (!Array.isArray(aiPlayer.reasonFlags[targetId])) {
      aiPlayer.reasonFlags[targetId] = [];
    }
  });
}

function pickPersonaBySeat(seatIndex) {
  const rotation = [PERSONA_TYPES.STEADY, PERSONA_TYPES.PRESSURE, PERSONA_TYPES.SHADOW];
  return rotation[seatIndex % rotation.length];
}

function personaThresholdShift(persona) {
  if (persona === PERSONA_TYPES.PRESSURE) {
    return -0.04;
  }
  if (persona === PERSONA_TYPES.SHADOW) {
    return 0.03;
  }
  return 0;
}

function personaPrefixPool(aiPlayer, intent) {
  const persona = aiPlayer.aiPersona ?? PERSONA_TYPES.STEADY;
  if (persona === PERSONA_TYPES.PRESSURE) {
    return intent === QUESTION_INTENT.PLAN
      ? ["我给你一条直接可执行线。", "我们别拖节奏，先压再验。", "先控场，再验人。"]
      : ["先给结论：我会直接压重点位。", "我不绕，先说最危险的人。", "我先落锤，再讲依据。"];
  }
  if (persona === PERSONA_TYPES.SHADOW) {
    return intent === QUESTION_INTENT.CLAIM
      ? ["我先给你台面上可验证的部分。", "先说可公开信息。", "我先讲结论，不急着暴露细节。"]
      : ["我先说可交叉验证的点。", "我更重视票型和行为链。", "先给你稳妥信息，再给倾向。"];
  }
  return ["我按证据顺序说。", "我先给你短结论。", "我把当前信息压缩一下。"];
}

function addReasonFlag(aiPlayer, targetId, reasonKey) {
  ensureAIFields(aiPlayer);
  aiPlayer.reasonFlags[targetId] = aiPlayer.reasonFlags[targetId] ?? [];
  if (!aiPlayer.reasonFlags[targetId].includes(reasonKey)) {
    aiPlayer.reasonFlags[targetId].push(reasonKey);
  }
}

function setBias(aiPlayer, targetId, delta, reasonKey = null) {
  ensureAIFields(aiPlayer);
  const current = aiPlayer.dialogueBias[targetId] ?? 0;
  aiPlayer.dialogueBias[targetId] = clamp(current + delta, -0.35, 0.35);
  if (reasonKey) {
    addReasonFlag(aiPlayer, targetId, reasonKey);
  }
}

function evilPrior(state, viewer) {
  const evilSlots = state.setupCounts.minion + state.setupCounts.demon;
  const denominator = Math.max(1, state.players.length - 1);
  if (viewer.team === "evil") {
    return clamp((evilSlots - 1) / denominator, 0.05, 0.85);
  }
  return clamp(evilSlots / denominator, 0.05, 0.85);
}

function initSuspicionForAI(state, aiPlayer) {
  ensureAIFields(aiPlayer);
  const prior = evilPrior(state, aiPlayer);
  const map = {};

  state.players.forEach((target) => {
    if (target.id === aiPlayer.id) {
      map[target.id] = 0.01;
      return;
    }
    map[target.id] = prior;
  });

  getKnownAllyIds(state, aiPlayer).forEach((allyId) => {
    if (typeof map[allyId] === "number") {
      map[allyId] = 0.08;
    }
  });

  aiPlayer.suspicion = map;
}

function bump(aiPlayer, targetId, delta, reasonKey = null) {
  if (!aiPlayer.suspicion || typeof aiPlayer.suspicion[targetId] !== "number") {
    return;
  }
  aiPlayer.suspicion[targetId] = clamp(aiPlayer.suspicion[targetId] + delta, 0.01, 0.99);
  if (reasonKey) {
    addReasonFlag(aiPlayer, targetId, reasonKey);
  }
}

function evidenceWeight(evidence, base = 1) {
  if (!evidence) {
    return base;
  }
  const reliability = Number.isFinite(evidence.reliabilityScore) ? evidence.reliabilityScore : 0.5;
  const sourceTrust = Number.isFinite(evidence.sourceTrust) ? evidence.sourceTrust : reliability;
  const contaminationRisk = Number.isFinite(evidence.contaminationRisk) ? evidence.contaminationRisk : 0.25;
  return clamp(base * (0.62 * reliability + 0.38 * sourceTrust) * (1 - contaminationRisk * 0.72), 0.12, 1.05);
}

function bumpFromEvidence(state, aiPlayer, targetId, delta, reasonKey, evidence, base = 1) {
  const before = aiPlayer.suspicion?.[targetId] ?? null;
  const weight = evidenceWeight(evidence, base);
  const appliedDelta = delta * weight;
  bump(aiPlayer, targetId, appliedDelta, reasonKey);
  const after = aiPlayer.suspicion?.[targetId] ?? null;
  if (before !== null && after !== null && before !== after) {
    recordSuspicionChangeFromEvidence(state, aiPlayer, {
      targetId,
      reasonKey,
      evidence,
      before,
      after,
      rawDelta: delta,
      appliedDelta,
      weight,
    });
  }
}

function normalizeSuspicion(aiPlayer) {
  const entries = Object.entries(aiPlayer.suspicion ?? {}).filter(([targetId]) => targetId !== aiPlayer.id);
  if (entries.length === 0) {
    return;
  }
  entries.forEach(([targetId, score]) => {
    aiPlayer.suspicion[targetId] = clamp(score, 0.08, 0.88);
  });
  aiPlayer.suspicion[aiPlayer.id] = 0.01;
}

function roleNameById(state, roleId) {
  const role = getAllRoles(state.scriptId).find((entry) => entry.id === roleId);
  return role?.name ?? roleId;
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

function isSafeLowInfoRole(role) {
  return !!role && role.team === "good" && (role.category === "outsider" || role.tags.includes("social") || role.tags.includes("defense"));
}

export function getAIScriptPressureProfile(state) {
  const roleIds = new Set(getAllRoles(state.scriptId).map((role) => role.id));
  return {
    hasGodfather: roleIds.has("godfather"),
    hasFangGu: roleIds.has("fang-gu"),
    hasBaron: roleIds.has("baron"),
    hasDrunk: roleIds.has("drunk"),
    hasRecluse: roleIds.has("recluse"),
    outsiderClaimsRisky: roleIds.has("godfather") || roleIds.has("fang-gu"),
    outsiderClaimsPlausible: roleIds.has("baron") || roleIds.has("drunk") || roleIds.has("fang-gu"),
    outsiderBluffsValuable: roleIds.has("godfather") || roleIds.has("fang-gu") || roleIds.has("baron"),
    cognitiveCoverPlausible: roleIds.has("drunk") || roleIds.has("lunatic"),
    misregistrationPlausible: roleIds.has("recluse") || roleIds.has("spy"),
  };
}

function bluffRoleScore(state, role) {
  if (!role) {
    return 0;
  }
  const profile = getAIScriptPressureProfile(state);
  let score = 0;
  if (role.category === "outsider") {
    score += profile.outsiderBluffsValuable ? 0.42 : 0.08;
    if (profile.hasGodfather && role.tags.includes("risk")) {
      score += 0.08;
    }
    if (profile.hasFangGu) {
      score += 0.12;
    }
  }
  if (role.tags.includes("info") && !role.tags.includes("recurring")) {
    score += profile.cognitiveCoverPlausible ? 0.18 : 0.08;
  }
  if (role.tags.includes("social") || role.tags.includes("defense")) {
    score += 0.12;
  }
  if (role.tags.includes("lateGame") || role.tags.includes("protect") || role.tags.includes("revive")) {
    score -= 0.12;
  }
  return score;
}

function chooseScriptAwareBluffRoleId(state, bluffPool, rng = Math.random) {
  const candidates = (bluffPool ?? [])
    .map((roleId) => getRoleById(state.scriptId, roleId))
    .filter(Boolean)
    .map((role) => ({ role, score: bluffRoleScore(state, role) + rng() * 0.08 }))
    .sort((a, b) => b.score - a.score);
  return candidates[0]?.role?.id ?? sample(bluffPool, 1, rng)[0] ?? null;
}

function applyClaimSignals(state, aiPlayer) {
  const claimEvidence = getAgentEvidence(state, aiPlayer, { kind: "claim" });
  const claims = claimEvidence.map((evidence) => ({
    playerId: evidence.payload?.playerId,
    roleId: evidence.payload?.roleId,
    evidence,
  }));
  if (claims.length === 0) {
    return;
  }

  const byRole = {};
  const byPlayer = {};
  claims.forEach((claim) => {
    byRole[claim.roleId] = byRole[claim.roleId] ?? [];
    byRole[claim.roleId].push(claim.playerId);

    byPlayer[claim.playerId] = byPlayer[claim.playerId] ?? [];
    byPlayer[claim.playerId].push(claim.roleId);
  });

  Object.values(byRole).forEach((playerIds) => {
    if (playerIds.length > 1) {
      playerIds.forEach((playerId) => {
        const evidence = claims.find((claim) => claim.playerId === playerId)?.evidence;
        bumpFromEvidence(state, aiPlayer, playerId, 0.1, "duplicateClaim", evidence);
      });
    }
  });

  Object.entries(byPlayer).forEach(([playerId, roleIds]) => {
    const uniqueRoles = [...new Set(roleIds)];
    if (uniqueRoles.length > 1) {
      const evidence = claims.find((claim) => claim.playerId === playerId)?.evidence;
      bumpFromEvidence(state, aiPlayer, playerId, 0.12, "claimFlip", evidence);
    }
  });

  const bluffIds = new Set(getKnownBluffRoleIds(state, aiPlayer));
  claims.forEach((claim) => {
    if (bluffIds.has(claim.roleId)) {
      bumpFromEvidence(state, aiPlayer, claim.playerId, 0.06, "bluffHit", claim.evidence);
    }
  });
}

function applyNominationSignals(state, aiPlayer) {
  getAgentEvidence(state, aiPlayer, { kind: "nomination" }).forEach((entry) => {
    const nominatorId = entry.payload?.nominatorId;
    const nomineeId = entry.payload?.nomineeId;
    if (!nominatorId || !nomineeId) {
      return;
    }
    const nomineeHeat = aiPlayer.suspicion?.[nomineeId] ?? 0.5;
    if (nomineeHeat < 0.45) {
      bumpFromEvidence(state, aiPlayer, nominatorId, 0.04, "suspiciousNomination", entry);
    }
    if (nomineeHeat > 0.68) {
      bumpFromEvidence(state, aiPlayer, nominatorId, -0.03, "proGoodVote", entry);
    }
  });
}

function applyVoteSignals(state, aiPlayer) {
  getAgentEvidence(state, aiPlayer, { kind: "vote" }).forEach((event) => {
    const payload = event.payload ?? {};
    if (!payload.nomineeId) {
      return;
    }
    const nomineeHeat = aiPlayer.suspicion?.[payload.nomineeId] ?? 0.5;
    (payload.votes ?? []).forEach((detail) => {
      if (detail.abstain) {
        return;
      }
      if (nomineeHeat >= 0.62 && detail.vote) {
        bumpFromEvidence(state, aiPlayer, detail.voterId, -0.03, "proGoodVote", event);
      }
      if (nomineeHeat >= 0.62 && !detail.vote) {
        bumpFromEvidence(state, aiPlayer, detail.voterId, 0.05, "antiGoodVote", event);
      }
      if (nomineeHeat <= 0.4 && detail.vote) {
        bumpFromEvidence(state, aiPlayer, detail.voterId, 0.05, "antiGoodVote", event);
      }
    });
  });
}

function applyObservedSpeechSignals(state, aiPlayer) {
  getAgentEvidence(state, aiPlayer, { kind: "public-speech" }).forEach((observation) => {
    const speakerId = observation.payload?.speakerId;
    const focusId = observation.payload?.focusId;
    if (!speakerId || speakerId === aiPlayer.id) {
      return;
    }
    const text = normalizeText(observation.text ?? "");
    if (focusId && focusId !== aiPlayer.id) {
      const attitude = inferAttitude(observation.text ?? "");
      if (attitude === "accuse") {
        bumpFromEvidence(state, aiPlayer, focusId, 0.025, "humanAccuse", observation);
      } else if (attitude === "defend") {
        bumpFromEvidence(state, aiPlayer, focusId, -0.02, "humanDefend", observation);
      }
    }
    if (hasAny(text, ACCUSE_WORDS) && !focusId) {
      bumpFromEvidence(state, aiPlayer, speakerId, 0.015, "privateEvasive", observation);
    }
  });
}

function applyObservedPrivateSignals(state, aiPlayer) {
  getAgentEvidence(state, aiPlayer, { kind: "private-whisper" }).forEach((observation) => {
    const speakerId = observation.payload?.speakerId;
    const focusId = observation.payload?.focusId;
    if (!speakerId || speakerId === aiPlayer.id || !focusId || focusId === aiPlayer.id) {
      return;
    }
    const attitude = inferAttitude(observation.text ?? "");
    if (attitude === "accuse") {
      bumpFromEvidence(state, aiPlayer, focusId, 0.04, "humanAccuse", observation);
    } else if (attitude === "defend") {
      bumpFromEvidence(state, aiPlayer, focusId, -0.035, "humanDefend", observation);
    }
  });
}

function applyNightPatternSignals(state, aiPlayer) {
  getAgentEvidence(state, aiPlayer, { kind: "night-death" }).forEach((death) => {
    const deathPlayerId = death.payload?.playerId;
    if (!deathPlayerId) {
      return;
    }
    const before = getAgentObservations(state, aiPlayer, "public-speech")
      .filter((speech) => speech.payload?.speakerId === deathPlayerId)
      .slice(-1)[0];
    if (before?.payload?.focusId) {
      bumpFromEvidence(state, aiPlayer, before.payload.focusId, 0.06, "nightPattern", death);
    }
  });
}

function applyDialogueBias(aiPlayer) {
  const biasEntries = Object.entries(aiPlayer.dialogueBias ?? {});
  biasEntries.forEach(([targetId, bias]) => {
    if (!Number.isFinite(bias)) {
      return;
    }
    bump(aiPlayer, targetId, bias * 0.6);
  });
}

function enforceEvilCoordination(state, aiPlayer) {
  const knownAllyIds = getKnownAllyIds(state, aiPlayer);
  if (knownAllyIds.length === 0) {
    return;
  }
  state.players
    .filter((entry) => entry.id !== aiPlayer.id && knownAllyIds.includes(entry.id))
    .forEach((ally) => {
      if (typeof aiPlayer.suspicion?.[ally.id] === "number") {
        aiPlayer.suspicion[ally.id] = Math.min(aiPlayer.suspicion[ally.id], 0.04);
      }
      if (aiPlayer.reasonFlags?.[ally.id]) {
        aiPlayer.reasonFlags[ally.id] = [];
      }
      if (typeof aiPlayer.dialogueBias?.[ally.id] === "number") {
        aiPlayer.dialogueBias[ally.id] = Math.min(aiPlayer.dialogueBias[ally.id], -0.04);
      }
    });
}

function rankTargets(aiPlayer, state, limit = 3) {
  return state.players
    .filter((entry) => entry.alive && entry.id !== aiPlayer.id)
    .map((entry) => ({ player: entry, score: aiPlayer.suspicion?.[entry.id] ?? 0.5 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function getTopTarget(aiPlayer, state) {
  return rankTargets(aiPlayer, state, 1)[0] ?? null;
}

function reasonSnippet(key) {
  return LOCAL_REASON_SNIPPETS[key] ?? REASON_SNIPPETS[key] ?? key;
}

function summarizeReason(aiPlayer, targetId) {
  const flags = aiPlayer.reasonFlags?.[targetId] ?? [];
  if (flags.length === 0) {
    return "该玩家的行为与我掌握的信息不一致";
  }
  return flags.slice(0, 2).map((key) => reasonSnippet(key)).join("；");
}

function normalizeText(text) {
  return `${text ?? ""}`
    .toLowerCase()
    .replace(/[，。！？、；：“”‘’（）【】]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAny(text, keywords) {
  return keywords.some((entry) => text.includes(entry));
}

function normalizeIntentHint(intentHint) {
  const normalized = `${intentHint ?? ""}`.trim().toLowerCase();
  return Object.values(QUESTION_INTENT).includes(normalized) ? normalized : QUESTION_INTENT.GENERIC;
}

function extractMentionedPlayers(state, text) {
  const raw = `${text ?? ""}`;
  const set = new Set();

  state.players.forEach((player) => {
    if (raw.includes(player.name)) {
      set.add(player.id);
    }
  });

  const regex = /(^|[^\d])(1[0-5]|[1-9])\s*号/g;
  let match = regex.exec(raw);
  while (match) {
    const seat = Number.parseInt(match[2], 10);
    const found = state.players.find((entry) => entry.seatIndex + 1 === seat);
    if (found) {
      set.add(found.id);
    }
    match = regex.exec(raw);
  }

  return [...set].map((id) => getPlayerById(state, id)).filter(Boolean);
}

function detectIntent(state, text, intentHint = QUESTION_INTENT.GENERIC) {
  const normalized = normalizeText(text);
  const mentionedPlayers = extractMentionedPlayers(state, text);
  const hint = normalizeIntentHint(intentHint);
  const modelSignals = predictDialogueSignals(text);
  const score = {
    [QUESTION_INTENT.SUSPECT]: 0,
    [QUESTION_INTENT.REASON]: 0,
    [QUESTION_INTENT.TRUST]: 0,
    [QUESTION_INTENT.CLAIM]: 0,
    [QUESTION_INTENT.VOTE]: 0,
    [QUESTION_INTENT.NIGHT]: 0,
    [QUESTION_INTENT.COMPARE]: 0,
    [QUESTION_INTENT.PLAN]: 0,
    [QUESTION_INTENT.GENERIC]: 0.15,
  };

  if (hint !== QUESTION_INTENT.GENERIC) {
    score[hint] += 1.2;
  }

  Object.entries(INTENT_KEYWORDS).forEach(([intent, keywords]) => {
    keywords.forEach((keyword) => {
      if (normalized.includes(keyword)) {
        score[intent] += keyword.length >= 3 ? 1.2 : 0.8;
      }
    });
  });

  if (mentionedPlayers.length >= 2 && hasAny(normalized, INTENT_KEYWORDS[QUESTION_INTENT.COMPARE])) {
    score[QUESTION_INTENT.COMPARE] += 1.4;
  }
  if (/你.*身份|你.*角色|报.*身份/.test(normalized)) {
    score[QUESTION_INTENT.CLAIM] += 1.2;
  }
  if (/会.*投|要.*投|该不该票/.test(normalized)) {
    score[QUESTION_INTENT.VOTE] += 1.0;
  }
  if (/(不|别|并非|不是).{0,4}(可疑|怀疑|恶魔|爪牙)/.test(normalized)) {
    score[QUESTION_INTENT.SUSPECT] -= 1.1;
    score[QUESTION_INTENT.REASON] += 0.45;
  }
  if (/(不是|先不|不想).{0,6}(报身份|身份|角色)/.test(normalized)) {
    score[QUESTION_INTENT.CLAIM] -= 1.0;
  }
  if (/(不是|先不|不用).{0,6}(提名|投票|票型)/.test(normalized)) {
    score[QUESTION_INTENT.VOTE] -= 0.95;
    score[QUESTION_INTENT.PLAN] += 0.5;
  }

  if (modelSignals.available) {
    if (modelSignals.speechActs.includes("hard_claim")) {
      score[QUESTION_INTENT.CLAIM] += 0.95;
    }
    if (modelSignals.speechActs.includes("soft_claim")) {
      score[QUESTION_INTENT.CLAIM] += 0.7;
    }
    if (modelSignals.speechActs.includes("coordinate_vote")) {
      score[QUESTION_INTENT.VOTE] += 0.8;
      score[QUESTION_INTENT.PLAN] += 0.35;
    }
    if (modelSignals.speechActs.includes("accuse")) {
      score[QUESTION_INTENT.SUSPECT] += 0.9;
    }
    if (modelSignals.speechActs.includes("defend")) {
      score[QUESTION_INTENT.TRUST] += 0.85;
    }
    if (modelSignals.speechActs.includes("probe")) {
      score[QUESTION_INTENT.REASON] += 0.7;
    }
    if (modelSignals.speechActs.includes("withhold_info")) {
      score[QUESTION_INTENT.CLAIM] += 0.4;
      score[QUESTION_INTENT.REASON] += 0.2;
    }

    const voteSignal = voteLabelToInGameStance(modelSignals.voteLabel);
    if (voteSignal === "support") {
      score[QUESTION_INTENT.VOTE] += 0.55 * Math.max(0.4, modelSignals.voteConfidence);
    } else if (voteSignal === "oppose") {
      score[QUESTION_INTENT.VOTE] += 0.35 * Math.max(0.35, modelSignals.voteConfidence);
      score[QUESTION_INTENT.PLAN] += 0.2;
    } else if (voteSignal === "abstain_signal") {
      score[QUESTION_INTENT.PLAN] += 0.22;
    }
  }

  const rankedIntents = Object.entries(score).sort((a, b) => b[1] - a[1]);
  const winner = rankedIntents[0];
  const runnerUp = rankedIntents[1] ?? null;
  const secondaryEligible =
    !!runnerUp &&
    runnerUp[0] !== winner?.[0] &&
    runnerUp[1] >= 0.72 &&
    Math.abs((winner?.[1] ?? 0) - runnerUp[1]) <= 0.95;
  return {
    intent: winner?.[0] ?? QUESTION_INTENT.GENERIC,
    confidence: winner?.[1] ?? 0,
    secondaryIntent: secondaryEligible ? runnerUp[0] : null,
    secondaryConfidence: secondaryEligible ? runnerUp[1] : 0,
    mentionedPlayers,
    hint,
    mlSignals: {
      available: !!modelSignals.available,
      speechActs: modelSignals.speechActs ?? [],
      voteLabel: modelSignals.voteLabel ?? "undecided",
      voteConfidence: modelSignals.voteConfidence ?? 0,
      tokenHits: modelSignals.tokenHits ?? 0,
    },
  };
}

function inferAttitude(questionText) {
  const modelSignals = predictDialogueSignals(questionText);
  if (modelSignals.available) {
    if (
      modelSignals.speechActs.includes("accuse") ||
      voteLabelToInGameStance(modelSignals.voteLabel) === "support"
    ) {
      return "accuse";
    }
    if (
      modelSignals.speechActs.includes("defend") ||
      voteLabelToInGameStance(modelSignals.voteLabel) === "oppose"
    ) {
      return "defend";
    }
  }

  const normalized = normalizeText(questionText);
  const accuse = hasAny(normalized, ACCUSE_WORDS);
  const defend = hasAny(normalized, DEFEND_WORDS);
  if (accuse && !defend) {
    return "accuse";
  }
  if (defend && !accuse) {
    return "defend";
  }
  return "neutral";
}

function voteStanceFromText(text) {
  const modelSignals = predictDialogueSignals(text);
  const predicted = voteLabelToInGameStance(modelSignals.voteLabel);
  if (predicted && modelSignals.voteConfidence >= 0.38) {
    return predicted;
  }

  const normalized = normalizeText(text);
  if (/(反对|不投|弃票|反处决|oppose)/.test(normalized)) {
    return "oppose";
  }
  if (/(赞成|会投|支持|提名|推进|support)/.test(normalized)) {
    return "support";
  }
  return "";
}

function inferPublicSpeechActs(composed) {
  const text = normalizeText(composed?.line ?? "");
  const acts = [];
  const modelSignals = predictDialogueSignals(composed?.line ?? "");
  acts.push(composed?.score >= 0.6 ? "accuse" : "probe");

  if (/(提名|推进处决|推进)/.test(text)) {
    acts.push("nominate");
    acts.push("coordinate_vote");
  }
  if (/(依据|理由|票型|核验)/.test(text)) {
    acts.push("mechanical_check");
  }
  if (/(观察|再看|不急)/.test(text)) {
    acts.push("hedge");
  }
  if (/(建议|先)/.test(text)) {
    acts.push("pressure");
  }

  if (modelSignals.available && Array.isArray(modelSignals.speechActs)) {
    acts.push(...modelSignals.speechActs);
  }

  return [...new Set(acts)];
}

function applyPrivateChatSignals(targetAI, human, mentionedPlayers, questionText) {
  const attitude = inferAttitude(questionText);
  if (mentionedPlayers.length === 0 || attitude === "neutral") {
    return;
  }

  const focusTargets = mentionedPlayers.filter((entry) => entry.id !== targetAI.id && entry.id !== human.id);
  focusTargets.forEach((entry) => {
    if (attitude === "accuse") {
      setBias(targetAI, entry.id, 0.07, "humanAccuse");
      return;
    }
    setBias(targetAI, entry.id, -0.06, "humanDefend");
  });

  if (focusTargets.length === 0 && attitude === "accuse") {
    setBias(targetAI, human.id, 0.03, "privateEvasive");
  }
}

function suspicionTone(score) {
  if (score >= 0.76) {
    return "高度可疑";
  }
  if (score >= 0.6) {
    return "偏可疑";
  }
  if (score <= 0.32) {
    return "暂时偏清白";
  }
  return "信息不足";
}

function formatFocus(player, score, withPercent = true) {
  if (!withPercent) {
    return `${player.name}（${suspicionTone(score)}）`;
  }
  return `${player.name}（${suspicionTone(score)}，约 ${Math.round(score * 100)}%）`;
}

function seatText(player) {
  return `${(player?.seatIndex ?? 0) + 1}号`;
}

function seatTextList(players) {
  if (!Array.isArray(players) || players.length === 0) {
    return "无";
  }
  return players
    .slice()
    .sort((a, b) => a.seatIndex - b.seatIndex)
    .map((entry) => seatText(entry))
    .join("、");
}

function composeEvilAllianceResponse(state, aiPlayer, human, analysis, rng = Math.random) {
  const agent = getAIAgent(state, aiPlayer);
  const knownAllyIds = new Set(agent?.knownAllyIds ?? []);
  const demon = agent?.knownDemonId ? getPlayerById(state, agent.knownDemonId) : null;
  const minions = (agent?.knownMinionIds ?? []).map((id) => getPlayerById(state, id)).filter(Boolean);
  const ranked = rankTargets(aiPlayer, state, 5);
  const goodFocus = ranked.find((entry) => !knownAllyIds.has(entry.player.id)) ?? ranked[0] ?? null;
  const knownBluffIds = new Set(getKnownBluffRoleIds(state, aiPlayer));
  const bluffText = (state.demonBluffs ?? [])
    .filter((entry) => knownBluffIds.has(entry.id))
    .map((entry) => entry.name)
    .filter(Boolean)
    .join(" / ");

  const actualRoleName = roleNameById(state, getEffectiveRoleId(aiPlayer) ?? aiPlayer.roleId);
  const plannedBluffRoleId = aiPlayer.publicClaimRoleId || chooseScriptAwareBluffRoleId(state, getKnownBluffRoleIds(state, aiPlayer), rng);
  const plannedBluffName = plannedBluffRoleId ? roleNameById(state, plannedBluffRoleId) : "";
  const lines = ["自己人，我不绕弯。"];
  if (aiPlayer.category === "demon") {
    lines.push(`我确认的爪牙位：${seatTextList(minions)}。`);
  } else {
    const others = minions.filter((entry) => entry.id !== aiPlayer.id);
    lines.push(`我确认的恶魔位：${demon ? seatText(demon) : "未知"}；其他爪牙：${seatTextList(others)}。`);
  }

  if (bluffText) {
    lines.push(`当前可用伪装：${bluffText}。`);
  }

  if (analysis.intent === QUESTION_INTENT.CLAIM) {
    lines.push(`我的真实身份是 ${actualRoleName}。`);
    if (plannedBluffName) {
      aiPlayer.publicClaimRoleId = aiPlayer.publicClaimRoleId || plannedBluffRoleId;
      lines.push(`台面上我准备先装 ${plannedBluffName}，你公开场合别把我的真实身份带出来。`);
    } else {
      lines.push("台面身份我先用低信息好人位糊住，等有人追问再补细节。");
    }
    if (human.category === "demon") {
      lines.push("你作为恶魔位，白天尽量别主动保我，容易把我们俩绑死。");
    } else {
      lines.push("如果你被问到我，先说我像低信息好人，不要给过硬担保。");
    }
  }

  if (goodFocus) {
    const evidence = collectEvidence(state, aiPlayer, goodFocus.player);
    lines.push(`今天可以先把火力推到 ${goodFocus.player.name} 身上。`);
    if (evidence.length > 0) {
      lines.push(`能拿来当话术的理由：${evidence.join("；")}。`);
    }
  } else {
    lines.push("现在还没有特别好推的好人目标，先等公聊里谁露破绽。");
  }

  return {
    response: lines.join(" "),
    focusId: goodFocus?.player?.id ?? null,
    focusScore: goodFocus?.score ?? null,
  };
}

function buildNightSummary(state) {
  const lastNight = Math.max(0, ...(state.events.nightDeaths ?? []).map((entry) => entry.night ?? 0));
  const victims = (state.events.nightDeaths ?? [])
    .filter((entry) => entry.night === lastNight)
    .map((entry) => getPlayerById(state, entry.playerId)?.name ?? entry.playerId);

  if (victims.length === 0) {
    return "昨夜没有可见死亡，通常意味着保护或能力干扰生效。";
  }
  if (victims.length === 1) {
    return `昨夜仅有 ${victims[0]} 死亡，我会优先追该玩家的白天互动链。`;
  }
  return `昨夜死亡为 ${victims.join("、")}，这是高波动夜晚，建议结合恶魔技能做逆推。`;
}

function collectEvidence(state, aiPlayer, focusPlayer) {
  const snippets = [];
  const reason = summarizeReason(aiPlayer, focusPlayer.id);
  if (reason) {
    snippets.push(reason);
  }

  const latestClaim = getVisibleClaims(state, aiPlayer).filter((entry) => entry.playerId === focusPlayer.id).slice(-1)[0];
  if (latestClaim) {
    snippets.push(`该玩家最近报过身份：${roleNameById(state, latestClaim.roleId)}`);
  }

  const latestSpeech = getVisibleSpeeches(state, aiPlayer)
    .filter((entry) => entry.playerId === focusPlayer.id)
    .slice(-1)[0];
  if (latestSpeech?.line) {
    const concise = latestSpeech.line.length > 26 ? `${latestSpeech.line.slice(0, 26)}...` : latestSpeech.line;
    snippets.push(`该玩家最近公聊重点：${concise}`);
  }

  const targetEvidence = getEvidenceForTarget(state, aiPlayer, focusPlayer.id);
  const agentEvidenceCount = countAgentEvidence(getAIAgent(state, aiPlayer), focusPlayer.id);
  if (agentEvidenceCount > 0) {
    const risky = targetEvidence.filter((entry) => entry.canBeFalse || entry.contaminationRisk >= 0.15).length;
    snippets.push(risky > 0 ? `个人证据 ${agentEvidenceCount} 条，其中 ${risky} 条可能被污染` : `个人证据 ${agentEvidenceCount} 条`);
  }

  return [...new Set(snippets)].slice(0, 2);
}

function pickClaimRole(state, aiPlayer, rng = Math.random, options = {}) {
  if (aiPlayer.publicClaimRoleId) {
    return null;
  }
  const force = !!options.force;
  if (!force && state.day > 1 && rng() > 0.35) {
    return null;
  }

  const agent = getAIAgent(state, aiPlayer);
  const believesEvil = aiPlayer.team === "evil" || agent?.knownSelfTeam === "evil";
  if (believesEvil) {
    let bluffPool = getKnownBluffRoleIds(state, aiPlayer);
    if (bluffPool.length === 0) {
      bluffPool = getAllRoles(state.scriptId)
        .filter((role) => role.team === "good")
        .map((role) => role.id);
    }
    if (bluffPool.length > 0) {
      const unused = bluffPool.filter((roleId) => !state.players.some((entry) => entry.publicClaimRoleId === roleId));
      const pool = unused.length > 0 ? unused : bluffPool;
      return chooseScriptAwareBluffRoleId(state, pool, rng);
    }
  }

  const perceived = getPerceivedRoleId(aiPlayer) ?? getEffectiveRoleId(aiPlayer) ?? aiPlayer.roleId;
  return perceived ?? null;
}

function claimRoleForContext(state, aiPlayer, human = null, rng = Math.random, options = {}) {
  const roleId = options.roleId ?? pickClaimRole(state, aiPlayer, rng, options);
  if (!roleId) {
    return null;
  }

  aiPlayer.publicClaimRoleId = roleId;
  const claim = {
    day: state.day,
    playerId: aiPlayer.id,
    roleId,
    private: !!options.private,
    viewerId: options.private ? human?.id ?? null : undefined,
  };
  state.events.claims = state.events.claims ?? [];
  state.events.claims.push(claim);

  if (!options.private) {
    recordPublicClaimForAgents(state, claim);
  }

  addLog(
    state,
    "claim",
    options.private
      ? `${aiPlayer.name} 在私聊中报身份为 ${roleNameById(state, roleId)}。`
      : `${aiPlayer.name} 声称自己是 ${roleNameById(state, roleId)}。`,
    {
      playerId: aiPlayer.id,
      viewerId: options.private ? human?.id ?? null : undefined,
      roleId,
      private: !!options.private,
    }
  );

  return roleId;
}

function choosePublicClaimRole(state, aiPlayer, roundInDay, rng = Math.random) {
  if (aiPlayer.publicClaimRoleId) {
    return null;
  }

  const actualRole = roleForPlayer(state, aiPlayer);
  const perceivedRole = perceivedRoleForPlayer(state, aiPlayer) ?? actualRole;
  const profile = getAIScriptPressureProfile(state);
  const suspicion = aiPlayer.suspicion?.[aiPlayer.id] ?? evilPrior(state, aiPlayer);
  const day = state.day ?? 1;
  const pressure = suspicion >= 0.62;
  const forcedLate = day >= 2 && (roundInDay >= 2 || suspicion >= 0.52);

  let chance = 0.08;
  if (perceivedRole?.category === "outsider") {
    chance += day === 1 ? 0.28 : 0.18;
    if (profile.outsiderClaimsRisky) {
      chance -= day === 1 ? 0.13 : 0.06;
    }
    if (profile.outsiderClaimsPlausible) {
      chance += 0.06;
    }
  }
  if (isEarlyInfoRole(perceivedRole)) {
    chance += day === 1 ? 0.12 : 0.2;
    if (profile.hasDrunk && day === 1) {
      chance -= 0.04;
    }
  }
  if (isPowerRole(perceivedRole)) {
    chance -= day === 1 ? 0.22 : 0.1;
  }
  if (pressure) {
    chance += 0.32;
  }
  if (forcedLate) {
    chance += 0.18;
  }
  if (!aiPlayer.alive) {
    chance += day === 1 ? 0.32 : 0.42;
  }
  const agent = getAIAgent(state, aiPlayer);
  const believesEvil = aiPlayer.team === "evil" || agent?.knownSelfTeam === "evil";
  if (believesEvil) {
    const bluffRoles = getKnownBluffRoleIds(state, aiPlayer)
      .map((roleId) => getRoleById(state.scriptId, roleId))
      .filter(Boolean);
    if (bluffRoles.some(isSafeLowInfoRole)) {
      chance += 0.08;
    } else {
      chance -= 0.1;
    }
  }

  chance = clamp(chance, 0.02, day === 1 ? 0.48 : 0.72);
  if (rng() > chance) {
    return null;
  }

  return pickClaimRole(state, aiPlayer, rng);
}

function shouldDeadPublicClaim(state, aiPlayer, roundInDay, rng = Math.random) {
  if (aiPlayer.alive || aiPlayer.publicClaimRoleId) {
    return false;
  }
  const day = state.day ?? 1;
  let chance = day <= 1 ? 0.72 : 0.9;
  if (roundInDay >= 2) {
    chance += 0.08;
  }
  if (!state.players.find((entry) => entry.isHuman)?.alive) {
    chance += 0.04;
  }
  return rng() < clamp(chance, 0.05, 0.98);
}

function maybePublicDisclosureLine(state, aiPlayer, roundInDay, rng = Math.random) {
  if (aiPlayer.publicClaimRoleId || roundInDay > 2) {
    return "";
  }
  const role = perceivedRoleForPlayer(state, aiPlayer) ?? roleForPlayer(state, aiPlayer);
  const profile = getAIScriptPressureProfile(state);
  if (roundInDay > 1 && rng() > 0.42) {
    return "";
  }
  if (role?.category === "outsider") {
    const lines = profile.outsiderClaimsRisky
      ? [
          "我这边偏外来者/低信息量，但有教父或方古这类收益点时，我先不给具体身份。",
          "我可以承认自己偏外来者范围，不过今天不建议把外来者当成免费处决位。",
          "外来者信息在这个剧本里会被邪恶方利用，我先给范围，具体身份等需要时再补。",
        ]
      : [
      "我这边偏低信息量位置，今天可以给范围，但不急着把具体风险说死。",
      "我是偏外来者/低信息位的口径，今天不建议逼所有功能位全跳。",
      "我这边不是强信息位，如果今天要处决我可以再补更具体身份。",
      ];
    return sample(lines, 1, rng)[0] ?? "";
  }
  if (isEarlyInfoRole(role)) {
    const lines = [
      "我有一点早期信息，但第一天先不完整报身份。",
      "我手里有可交叉验证的信息，先看大家口径再决定是否摊开。",
      "我不是空白位，但现在全跳身份会让夜里太好刀。",
    ];
    return sample(lines, 1, rng)[0] ?? "";
  }
  if (isPowerRole(role)) {
    const lines = [
      "我不建议今天逼强功能位交全身份，先用信息和票型压人。",
      "我暂时不摊身份，今天先看谁在逼信息位裸跳。",
      "我会保留身份细节，必要时到提名前再补。",
    ];
    return sample(lines, 1, rng)[0] ?? "";
  }
  return "";
}

function maybePrivateClaim(state, aiPlayer, human, rng = Math.random) {
  if (aiPlayer.publicClaimRoleId || rng() >= 0.35) {
    return "";
  }

  const roleId = claimRoleForContext(state, aiPlayer, human, rng, { private: true });
  if (!roleId) {
    return "";
  }

  return `补充一句：我先报身份，${roleNameById(state, roleId)}。`;
}

function composePrivateResponse(state, aiPlayer, human, analysis, questionText, memory, rng = Math.random) {
  const ranked = rankTargets(aiPlayer, state, state.players.length)
    .filter((entry) => entry.player.id !== human.id)
    .slice(0, 3);
  const top = ranked[0] ?? null;
  const second = ranked[1] ?? null;
  const trustScore = aiPlayer.suspicion?.[human.id] ?? 0.5;
  const numericMode = /(%|百分比|概率|几成|几率|量化|数字|percent|chance)/i.test(`${questionText ?? ""}`);
  const trustLine =
    trustScore >= 0.62
      ? numericMode
        ? `你在我这里风险约 ${Math.round(trustScore * 100)}%。`
        : "你这边我还不能完全放下。"
      : trustScore <= 0.35
      ? numericMode
        ? `你在我这里风险约 ${Math.round(trustScore * 100)}%，暂时偏低。`
        : "你目前在我这里偏好。"
      : "你在我这里是中间位，还要看票型。";

  const lines = [];
  const openerPool = [
    "我先说人话版。",
    "嗯，我现在是这么看的。",
    "先别急，我把我的感觉说清楚。",
    "我不装谜语人，直接说。",
  ];

  if (!top) {
    lines.push(sample(openerPool, 1, rng)[0]);
    lines.push("我现在没有稳定外置目标，先听一轮公聊再定提名更稳。");
    return {
      response: lines.join(" "),
      focusId: null,
      focusScore: null,
    };
  }

  const mentionFocus = analysis.mentionedPlayers
    .filter((entry) => entry.id !== aiPlayer.id && entry.id !== human.id)
    .map((entry) => ({ player: entry, score: aiPlayer.suspicion?.[entry.id] ?? 0.5 }))
    .sort((a, b) => b.score - a.score)[0];

  const stabilized = resolveStableFocus(state, aiPlayer, mentionFocus ?? top, ranked, {
    explicitMention: !!mentionFocus,
  });
  const focus = stabilized.focus;
  const evidence = collectEvidence(state, aiPlayer, focus.player);
  const evidenceText = evidence.length > 0 ? evidence.join("；") : "目前主要是发言姿态和场上位置不舒服";
  const focusText = formatFocus(focus.player, focus.score, numericMode);
  const stanceMemory = rememberDayStance(state, aiPlayer, focus.player.id, focus.score, "private");

  lines.push(sample(openerPool, 1, rng)[0]);

  switch (analysis.intent) {
    case QUESTION_INTENT.REASON:
      lines.push(`我现在主要想追 ${focusText}。理由不是单点爆炸，而是这几件事凑在一起很别扭：${evidenceText}。`);
      break;
    case QUESTION_INTENT.TRUST:
      lines.push(`${trustLine} 但我不想把话说死。今天更值得逼反应的是 ${focus.player.name}，因为${evidenceText}。`);
      break;
    case QUESTION_INTENT.CLAIM: {
      const claimSentence = maybePrivateClaim(state, aiPlayer, human, rng);
      lines.push(claimSentence || "身份我现在不想直接裸跳。你可以先记我不是空白位；如果今天真的要推我，我会补完整口径。");
      lines.push(`但别只盯身份，眼下我更想听 ${focusText} 怎么解释。`);
      break;
    }
    case QUESTION_INTENT.VOTE:
      lines.push(`如果现在有人提 ${focus.player.name}，我大概率会跟票。`);
      lines.push(`原因很简单：${evidenceText}。`);
      break;
    case QUESTION_INTENT.NIGHT:
      lines.push(buildNightSummary(state));
      lines.push(`但夜死不能单独盘，配合白天发言我会先盯 ${focus.player.name}。`);
      break;
    case QUESTION_INTENT.COMPARE: {
      const compared = analysis.mentionedPlayers.filter((entry) => entry.id !== human.id && entry.id !== aiPlayer.id).slice(0, 2);
      if (compared.length >= 2) {
        const a = compared[0];
        const b = compared[1];
        const aScore = aiPlayer.suspicion?.[a.id] ?? 0.5;
        const bScore = aiPlayer.suspicion?.[b.id] ?? 0.5;
        const high = aScore >= bScore ? a : b;
        const low = aScore >= bScore ? b : a;
        lines.push(numericMode
          ? `${high.name} 比 ${low.name} 更值得追（${Math.round(Math.max(aScore, bScore) * 100)}% vs ${Math.round(Math.min(aScore, bScore) * 100)}%）。`
          : `我会先追 ${high.name}，${low.name} 先放第二位。`);
      } else {
        lines.push(`我现在的第一关注位是 ${focusText}。`);
      }
      break;
    }
    case QUESTION_INTENT.PLAN:
      lines.push(`${trustLine} 今天别空过，我建议先把压力给到 ${focus.player.name}。`);
      lines.push(`先让他解释${evidence.length > 0 ? "这条线" : "自己的信息和投票态度"}；如果还在绕，再进提名。`);
      break;
    case QUESTION_INTENT.SUSPECT:
    case QUESTION_INTENT.GENERIC:
    default:
      lines.push(`我现在最想追的是 ${focusText}。`);
      lines.push(`不是说他一定是恶，但${evidenceText}，这条线得有人回答。`);
      if (second && second.player.id !== focus.player.id && rng() < 0.45) {
        lines.push(`第二关注位是 ${formatFocus(second.player, second.score, numericMode)}。`);
      }
      break;
  }

  if (memory.turns > 0 && memory.lastFocusId === focus.player.id && Number.isFinite(memory.lastFocusScore)) {
    const delta = focus.score - memory.lastFocusScore;
    if (Math.abs(delta) >= 0.05) {
      lines.push(`和刚才比，我对 ${focus.player.name} 的判断${delta > 0 ? "更重了" : "稍微放轻了"}。`);
    }
  }

  if (analysis.secondaryIntent === QUESTION_INTENT.CLAIM && analysis.intent !== QUESTION_INTENT.CLAIM && !aiPlayer.publicClaimRoleId) {
    lines.push("身份线我先不展开；你要追身份，我可以下一句单独说。");
  }
  if (stabilized.lockRetained && !mentionFocus && rng() < 0.35) {
    lines.push(`今天我的主线暂时不换，还是围绕 ${focus.player.name} 打信息。`);
  }
  if (stanceMemory?.turns > 1 && rng() < 0.5) {
    lines.push(`我今天对 ${focus.player.name} 的口径先保持“${dayStanceLabel(stanceMemory.stance)}”，除非有新硬信息再改。`);
  }

  return {
    response: lines.join(" "),
    focusId: focus.player.id,
    focusScore: focus.score,
  };
}

function nextPublicRound(state) {
  const dialogue = ensureDialogueState(state);
  const dayKey = `${state.day}`;
  dialogue.publicRoundByDay[dayKey] = (dialogue.publicRoundByDay[dayKey] ?? 0) + 1;
  return dialogue.publicRoundByDay[dayKey];
}

function summarizeShareablePrivateNotes(aiPlayer, limit = 2) {
  return (aiPlayer.privateNotes ?? [])
    .map((note) => `${note ?? ""}`.trim())
    .filter(Boolean)
    .slice(-limit);
}

function composePublicLine(state, aiPlayer, roundInDay, rng = Math.random) {
  const ranked = rankTargets(aiPlayer, state, 3);
  const topCandidate = ranked[0] ?? null;
  if (!topCandidate) {
    if (!aiPlayer.alive && aiPlayer.publicClaimRoleId) {
      const notes = summarizeShareablePrivateNotes(aiPlayer, 2);
      const infoText = notes.length > 0 ? `我手里信息是：${notes.join("；")}。` : "我没有更多可验证信息，但至少把身份链放出来。";
      return {
        templateId: "dead-claim-no-target",
        line: `我已经死了，先把口径交出来：我是 ${roleNameById(state, aiPlayer.publicClaimRoleId)}。${infoText}`,
        focusId: null,
        score: 0.5,
      };
    }
    return {
      templateId: "no-target",
      line: "这一轮我信息不足，先听其他人发言。",
      focusId: null,
      score: 0.5,
    };
  }
  const stabilized = resolveStableFocus(state, aiPlayer, topCandidate, ranked, { explicitMention: false });
  const top = stabilized.focus;
  const second = ranked.find((entry) => entry.player.id !== top.player.id) ?? null;
  const stanceMemory = rememberDayStance(state, aiPlayer, top.player.id, top.score, "public");

  const evidence = collectEvidence(state, aiPlayer, top.player);
  const scorePct = Math.round(top.score * 100);
  const disclosureLine = maybePublicDisclosureLine(state, aiPlayer, roundInDay, rng);

  const persona = aiPlayer.aiPersona ?? PERSONA_TYPES.STEADY;
  const hardPressThreshold = 0.58 + personaThresholdShift(persona);
  const templates = top.score >= hardPressThreshold
    ? [
        { id: "press", text: `我这轮想先把 ${top.player.name} 按住问，危险度大概 ${scorePct}%。主要别扭点是：${evidence.join("；")}。` },
        { id: "risk", text: `我现在最放不下 ${top.player.name}（${scorePct}%）。不是单凭感觉，理由是：${evidence.join("；")}。` },
        { id: "nominate-ready", text: `如果今天要动手，我会先考虑提 ${top.player.name}。这个位置已经不太适合继续免费放过了。` },
      ]
    : [
        { id: "probe", text: `${top.player.name} 我先记一笔，危险度约 ${scorePct}%，还不到铁推，但需要解释。` },
        { id: "soft", text: `我对 ${top.player.name} 有点不舒服（${scorePct}%）。先别急着砍，先让他说完整。` },
        { id: "watch", text: `我这一轮会盯 ${top.player.name} 的回答。要是继续含糊，下一轮就可以加压。` },
      ];

  const personaTail =
    persona === PERSONA_TYPES.PRESSURE
      ? "我想先把压力打出来，看他会不会变形。"
      : persona === PERSONA_TYPES.SHADOW
      ? "我先收口风和票型，不急着把刀递出去。"
      : "先问，问完再决定要不要落锤。";
  const stanceTail =
    stanceMemory?.turns > 1
      ? `我今天对 ${top.player.name} 的口径仍是“${dayStanceLabel(stanceMemory.stance)}”，暂时不换主线。`
      : "";

  const tails = [
    second ? `次级关注是 ${second.player.name}。` : "次级关注位暂不明确。",
    `这是今天第 ${roundInDay} 轮公聊。`,
    top.score >= 0.68 ? "这个位置今天已经可以进提名池。" : "我还没说必出，但不能让他舒服过白天。",
    personaTail,
    stanceTail,
  ].filter(Boolean);

  const chosen = sample(templates, 1, rng)[0];
  const tail = sample(tails, 1, rng)[0];
  let prefix = disclosureLine ? `${disclosureLine} ` : "";
  if (!aiPlayer.alive && aiPlayer.publicClaimRoleId) {
    const notes = summarizeShareablePrivateNotes(aiPlayer, 2);
    const infoText = notes.length > 0 ? `信息是：${notes.join("；")}。` : "可验证信息不多，但身份链先给出来。";
    prefix = `我已经死了，先报身份：我是 ${roleNameById(state, aiPlayer.publicClaimRoleId)}。${infoText} ${prefix}`;
  }

  return {
    templateId: chosen.id,
    line: `${prefix}${chosen.text} ${tail}`,
    focusId: top.player.id,
    score: top.score,
  };
}

function rotateBy(arr, shift) {
  if (arr.length === 0) {
    return [];
  }
  const n = shift % arr.length;
  return [...arr.slice(n), ...arr.slice(0, n)];
}

export function initializeAI(state) {
  ensureDialogueState(state);
  ensureAIAgents(state);
  state.events.speeches = state.events.speeches ?? [];
  state.players
    .filter((player) => !player.isHuman)
    .forEach((aiPlayer) => {
      ensureAIFields(aiPlayer);
      aiPlayer.aiPersona = aiPlayer.aiPersona ?? pickPersonaBySeat(aiPlayer.seatIndex);
      initSuspicionForAI(state, aiPlayer);
    });
}

export function refreshAIBeliefs(state) {
  ensureDialogueState(state);
  ensureAIAgents(state);
  state.players
    .filter((player) => !player.isHuman)
    .forEach((aiPlayer) => {
      initSuspicionForAI(state, aiPlayer);
      clearAgentBeliefTrail(state, aiPlayer);
      applyClaimSignals(state, aiPlayer);
      applyObservedSpeechSignals(state, aiPlayer);
      applyObservedPrivateSignals(state, aiPlayer);
      applyNominationSignals(state, aiPlayer);
      applyVoteSignals(state, aiPlayer);
      applyNightPatternSignals(state, aiPlayer);
      applyDialogueBias(aiPlayer);
      enforceEvilCoordination(state, aiPlayer);
      normalizeSuspicion(aiPlayer);
    });
}

export function runAIDiscussion(state, rng = Math.random) {
  if (state.phase !== "day" || state.gameOver) {
    return;
  }

  refreshAIBeliefs(state);
  const dialogue = ensureDialogueState(state);
  const roundInDay = nextPublicRound(state);

  const speakingAIs = state.players
    .filter((entry) => !entry.isHuman)
    .sort((a, b) => a.seatIndex - b.seatIndex);
  const speakers = rotateBy(speakingAIs, Math.max(0, roundInDay - 1));

  speakers.forEach((aiPlayer, orderIndex) => {
    const claimRoleId = shouldDeadPublicClaim(state, aiPlayer, roundInDay, rng)
      ? pickClaimRole(state, aiPlayer, rng, { force: true })
      : choosePublicClaimRole(state, aiPlayer, roundInDay, rng);
    if (claimRoleId) {
      claimRoleForContext(state, aiPlayer, null, rng, { force: true, private: false, roleId: claimRoleId });
    }

    const composed = composePublicLine(state, aiPlayer, roundInDay, rng);

    dialogue.lastPublicFocusBySpeaker[aiPlayer.id] = composed.focusId ?? null;
    dialogue.lastPublicTemplateBySpeaker[aiPlayer.id] = composed.templateId;

    aiPlayer.speechHistory.push({ day: state.day, line: composed.line, focusId: composed.focusId });
    state.events.speeches.push({ day: state.day, playerId: aiPlayer.id, line: composed.line, focusId: composed.focusId, private: false });
    recordPublicSpeechForAgents(state, {
      speakerId: aiPlayer.id,
      text: composed.line,
      focusId: composed.focusId,
      roundInDay,
      orderIndex,
    });

    addLog(state, "speech", `${aiPlayer.name}：${composed.line}`, {
      playerId: aiPlayer.id,
      focusId: composed.focusId,
      score: composed.score,
      roundInDay,
      orderIndex,
      private: false,
    });

    pushTimeline(state, {
      mode: "public",
      roundInDay,
      orderIndex,
      speakerId: aiPlayer.id,
      targetId: composed.focusId,
      text: composed.line,
    });
    const publicSignals = predictDialogueSignals(composed.line);

    recordUtteranceMVP(state, {
      speakerId: aiPlayer.id,
      audience: "public",
      text: composed.line,
      speechActs: inferPublicSpeechActs(composed),
      targets: composed.focusId ? [composed.focusId] : [],
      intent: composed.score >= 0.62 ? "suspect" : "plan",
      voteStance: voteStanceFromText(composed.line),
      evidenceSource: "social_read",
      epistemicStrength: composed.score >= 0.74 ? 3 : composed.score >= 0.58 ? 2 : 1,
      nominationRelated: /提名|nominate/i.test(composed.line),
      metadata: {
        source: "ai_public_discussion",
        roundInDay,
        orderIndex,
        templateId: composed.templateId ?? "",
        focusScore: composed.score ?? null,
        mlVoteLabel: publicSignals.voteLabel ?? "undecided",
        mlVoteConfidence: publicSignals.voteConfidence ?? 0,
        mlSpeechActs: publicSignals.speechActs ?? [],
        mlTokenHits: publicSignals.tokenHits ?? 0,
      },
    });
  });
}

function proactiveWhisperDayRecord(state) {
  const dialogue = ensureDialogueState(state);
  const dayKey = `${state.day ?? 0}`;
  dialogue.proactivePrivateByDay[dayKey] = dialogue.proactivePrivateByDay[dayKey] ?? {
    sentIds: [],
  };
  return dialogue.proactivePrivateByDay[dayKey];
}

function aiPrivateDayRecord(state) {
  const dialogue = ensureDialogueState(state);
  const dayKey = `${state.day ?? 0}`;
  dialogue.aiPrivateByDay[dayKey] = dialogue.aiPrivateByDay[dayKey] ?? {
    pairKeys: [],
  };
  return dialogue.aiPrivateByDay[dayKey];
}

function aiPrivatePairLimitForDay(day) {
  return clamp(5 - Math.max(1, Number(day) || 1), 1, 4);
}

function scoreProactiveWhisperCandidate(state, aiPlayer, human) {
  const perceivedRole = perceivedRoleForPlayer(state, aiPlayer) ?? roleForPlayer(state, aiPlayer);
  const notes = summarizeShareablePrivateNotes(aiPlayer, 2);
  const top = getTopTarget(aiPlayer, state);
  const humanRisk = aiPlayer.suspicion?.[human.id] ?? 0.5;
  let score = 0;

  if (!aiPlayer.alive && !aiPlayer.publicClaimRoleId) {
    score += 7;
  } else if (!aiPlayer.alive) {
    score += 3;
  }
  if (notes.length > 0) {
    score += Math.min(4, notes.length * 2);
  }
  if (isEarlyInfoRole(perceivedRole)) {
    score += state.day <= 1 ? 3 : 1.5;
  }
  if (perceivedRole?.category === "outsider") {
    score += state.day <= 2 ? 1.5 : 0.5;
  }
  if (top?.score >= 0.58) {
    score += 1.5;
  }
  if (humanRisk >= 0.58) {
    score += 1;
  }
  if (areKnownAllies(state, aiPlayer, human)) {
    score += 6;
  }

  return score;
}

function composeProactiveWhisper(state, aiPlayer, human, rng = Math.random) {
  const sameEvilTeam = areKnownAllies(state, aiPlayer, human);
  if (sameEvilTeam) {
    return {
      ...composeEvilAllianceResponse(state, aiPlayer, human, {
        intent: QUESTION_INTENT.PLAN,
        mentionedPlayers: [],
        secondaryIntent: null,
      }, rng),
      intent: QUESTION_INTENT.PLAN,
    };
  }

  const ranked = rankTargets(aiPlayer, state, 3).filter((entry) => entry.player.id !== human.id);
  const focus = ranked[0] ?? null;
  const notes = summarizeShareablePrivateNotes(aiPlayer, 2);
  const lines = [];
  let intent = QUESTION_INTENT.PLAN;

  if (!aiPlayer.alive) {
    lines.push("我已经死了，继续藏身份收益很低，我主动来把链条交给你。");
    if (!aiPlayer.publicClaimRoleId) {
      const roleId = claimRoleForContext(state, aiPlayer, human, rng, { private: true, force: true });
      if (roleId) {
        lines.push(`我的身份口径是 ${roleNameById(state, roleId)}。`);
        intent = QUESTION_INTENT.CLAIM;
      }
    } else {
      lines.push(`我的身份口径是 ${roleNameById(state, aiPlayer.publicClaimRoleId)}。`);
      intent = QUESTION_INTENT.CLAIM;
    }
  } else if (notes.length > 0) {
    lines.push("我主动找你一下，我手里有信息，不想等到公聊里被噪音盖过去。");
    intent = QUESTION_INTENT.NIGHT;
  } else {
    lines.push(sample([
      "我主动找你同步一下思路。",
      "我想先和你对一条线，免得公聊里被带节奏。",
      "我这里有个判断，先私下给你听。",
    ], 1, rng)[0]);
  }

  if (notes.length > 0) {
    lines.push(`我目前能交代的是：${notes.join("；")}。`);
  }

  if (focus) {
    const stanceMemory = rememberDayStance(state, aiPlayer, focus.player.id, focus.score, "proactive-private");
    const evidence = collectEvidence(state, aiPlayer, focus.player);
    const evidenceText = evidence.length > 0 ? `依据是：${evidence.join("；")}。` : "理由主要来自发言姿态和场上位置。";
    lines.push(`我现在更想推进 ${focus.player.name}（${Math.round(focus.score * 100)}%）。${evidenceText}`);
    if (stanceMemory?.turns > 1) {
      lines.push(`这和我今天前面的判断一致：先按“${dayStanceLabel(stanceMemory.stance)}”处理。`);
    }
  } else {
    lines.push("如果今天没人给新信息，我建议至少逼一个明确口径，不要直接空过。");
  }

  if (state.day >= 3 && !aiPlayer.alive) {
    lines.push("如果我白天没有机会发言，你可以把这段作为我的遗言来盘。");
  }

  return {
    response: lines.join(" "),
    focusId: focus?.player?.id ?? null,
    focusScore: focus?.score ?? null,
    intent,
  };
}

function scoreAIToAIWhisperPair(state, speaker, target) {
  const perceivedRole = perceivedRoleForPlayer(state, speaker) ?? roleForPlayer(state, speaker);
  const notes = summarizeShareablePrivateNotes(speaker, 2);
  const top = getTopTarget(speaker, state);
  const targetRisk = speaker.suspicion?.[target.id] ?? 0.5;
  let score = 0;

  if (areKnownAllies(state, speaker, target)) {
    score += 7;
  }
  if (!speaker.alive && !speaker.publicClaimRoleId) {
    score += 4;
  } else if (!speaker.alive) {
    score += 2;
  }
  if (notes.length > 0) {
    score += Math.min(4, notes.length * 2);
  }
  if (isEarlyInfoRole(perceivedRole)) {
    score += state.day <= 1 ? 2.5 : 1;
  }
  if (targetRisk <= 0.4) {
    score += 1.2;
  }
  if (top?.player?.id === target.id && top.score >= 0.58) {
    score += 1.2;
  }

  return score;
}

function composeAIToAIWhisper(state, speaker, target, rng = Math.random) {
  if (areKnownAllies(state, speaker, target)) {
    return {
      ...composeEvilAllianceResponse(
        state,
        speaker,
        target,
        {
          intent: QUESTION_INTENT.PLAN,
          mentionedPlayers: [],
          secondaryIntent: null,
        },
        rng
      ),
      intent: QUESTION_INTENT.PLAN,
    };
  }

  const ranked = rankTargets(speaker, state, 3).filter((entry) => entry.player.id !== target.id);
  const focus = ranked[0] ?? null;
  const notes = summarizeShareablePrivateNotes(speaker, 2);
  const lines = [];
  let intent = QUESTION_INTENT.PLAN;

  if (!speaker.alive) {
    lines.push("我已经死了，白天如果再藏信息只会拖节奏。我先把我这边的线索交给你。");
    if (!speaker.publicClaimRoleId) {
      const roleId = claimRoleForContext(state, speaker, target, rng, { private: true, force: true });
      if (roleId) {
        lines.push(`我的身份口径是 ${roleNameById(state, roleId)}。`);
        intent = QUESTION_INTENT.CLAIM;
      }
    } else {
      lines.push(`我的身份口径是 ${roleNameById(state, speaker.publicClaimRoleId)}。`);
      intent = QUESTION_INTENT.CLAIM;
    }
  } else if (notes.length > 0) {
    lines.push("我私下先给你一条线，公聊里我不一定马上全摊。");
    intent = QUESTION_INTENT.NIGHT;
  } else {
    lines.push(
      sample(
        [
          "我想先和你对一下场上的节奏。",
          "公聊前先同步一下，我不想被第一轮发言带偏。",
          "我这里有个初步判断，先私下跟你校准。",
        ],
        1,
        rng
      )[0]
    );
  }

  if (notes.length > 0) {
    lines.push(`我目前能说的是：${notes.join("；")}。`);
  }

  if (focus) {
    const stanceMemory = rememberDayStance(state, speaker, focus.player.id, focus.score, "ai-private");
    const evidence = collectEvidence(state, speaker, focus.player);
    const evidenceText =
      evidence.length > 0 ? `依据是：${evidence.join("；")}。` : "主要是发言姿态和场上位置还不顺。";
    lines.push(`我更想盯 ${focus.player.name}（${Math.round(focus.score * 100)}%）。${evidenceText}`);
    if (stanceMemory?.turns > 1) {
      lines.push(`我今天对他的口径还是“${dayStanceLabel(stanceMemory.stance)}”，先不乱跳线。`);
    }
  } else {
    lines.push("如果今天没有新信息，至少要逼一个明确口径，不要直接空过。");
  }

  return {
    response: lines.join(" "),
    focusId: focus?.player?.id ?? null,
    focusScore: focus?.score ?? null,
    intent,
  };
}

export function runAIToAIPrivateWhispers(state, rng = Math.random) {
  if (state.phase !== "day" || state.dayStage !== "private" || state.gameOver) {
    return [];
  }

  ensureDialogueState(state);
  state.events.speeches = state.events.speeches ?? [];
  refreshAIBeliefs(state);

  const dayRecord = aiPrivateDayRecord(state);
  const usedPairs = new Set(dayRecord.pairKeys ?? []);
  const aiPlayers = state.players.filter((entry) => !entry.isHuman);
  const maxPairs = aiPrivatePairLimitForDay(state.day);
  const remainingPairs = Math.max(0, maxPairs - usedPairs.size);
  if (remainingPairs === 0 || aiPlayers.length < 2) {
    return [];
  }

  const candidates = [];
  aiPlayers.forEach((speaker) => {
    aiPlayers
      .filter((target) => target.id !== speaker.id)
      .forEach((target) => {
        const pairKey = [speaker.id, target.id].sort().join("::");
        if (usedPairs.has(pairKey)) {
          return;
        }
        candidates.push({
          speaker,
          target,
          pairKey,
          score: scoreAIToAIWhisperPair(state, speaker, target),
          tie: rng(),
        });
      });
  });

  const selected = candidates
    .filter((entry) => entry.score >= 3)
    .sort((a, b) => b.score - a.score || a.tie - b.tie)
    .slice(0, remainingPairs);

  const messages = [];
  selected.forEach(({ speaker, target, pairKey }) => {
    const composed = composeAIToAIWhisper(state, speaker, target, rng);
    const responseSignals = predictDialogueSignals(composed.response);

    state.events.speeches.push({
      day: state.day,
      playerId: speaker.id,
      line: composed.response,
      focusId: composed.focusId,
      private: true,
      viewerIds: [speaker.id, target.id],
      targetId: target.id,
      aiToAi: true,
      hiddenFromHuman: true,
    });

    recordPrivateWhisperForAgents(state, {
      speakerId: speaker.id,
      targetId: target.id,
      text: composed.response,
      intent: composed.intent,
      focusId: composed.focusId,
    });

    recordUtteranceMVP(state, {
      speakerId: speaker.id,
      audience: "private",
      text: composed.response,
      speechActs: [
        ...new Set([
          ...inferSpeechActsFromIntent(composed.intent, { audience: "private", isQuestion: false }),
          ...(responseSignals.speechActs ?? []),
        ]),
      ],
      targets: composed.focusId ? [composed.focusId] : [target.id],
      intent: composed.intent,
      voteStance: voteStanceFromText(composed.response),
      evidenceSource: areKnownAllies(state, speaker, target) ? "storyteller_signal" : "private_chat",
      epistemicStrength: composed.focusScore >= 0.72 ? 3 : composed.focusScore >= 0.56 ? 2 : 1,
      nominationRelated: /提名|nominate/i.test(composed.response),
      metadata: {
        source: "ai_to_ai_private_whisper",
        targetId: target.id,
        aiToAi: true,
        hiddenFromHuman: true,
        mlVoteLabel: responseSignals.voteLabel ?? "undecided",
        mlVoteConfidence: responseSignals.voteConfidence ?? 0,
        mlSpeechActs: responseSignals.speechActs ?? [],
        mlTokenHits: responseSignals.tokenHits ?? 0,
      },
    });

    addLog(state, "whisper", `${speaker.name} 与 ${target.name} 进行了私聊。`, {
      private: false,
      redacted: true,
      aiToAi: true,
      sourceId: speaker.id,
      targetId: target.id,
    });

    usedPairs.add(pairKey);
    messages.push({
      speakerId: speaker.id,
      speakerName: speaker.name,
      targetId: target.id,
      targetName: target.name,
      response: composed.response,
      focusId: composed.focusId,
      intent: composed.intent,
    });
  });

  dayRecord.pairKeys = [...usedPairs];
  if (messages.length > 0) {
    refreshAIBeliefs(state);
  }
  return messages;
}

export function runAIProactiveWhispers(state, rng = Math.random) {
  if (state.phase !== "day" || state.dayStage !== "private" || state.gameOver) {
    return [];
  }

  const human = state.players.find((entry) => entry.isHuman);
  if (!human) {
    return [];
  }

  refreshAIBeliefs(state);
  const dayRecord = proactiveWhisperDayRecord(state);
  const sentIds = new Set(dayRecord.sentIds ?? []);
  const maxMessages = state.day <= 1 || !human.alive ? 2 : 1;
  const remainingDailySlots = Math.max(0, maxMessages - sentIds.size);
  if (remainingDailySlots === 0) {
    return [];
  }

  const candidates = state.players
    .filter((entry) => !entry.isHuman && !sentIds.has(entry.id))
    .map((entry) => ({
      player: entry,
      score: scoreProactiveWhisperCandidate(state, entry, human),
      tie: rng(),
    }))
    .filter((entry) => entry.score >= 2.2)
    .sort((a, b) => b.score - a.score || a.tie - b.tie)
    .slice(0, remainingDailySlots);

  const messages = [];
  candidates.forEach(({ player: aiPlayer }) => {
    const composed = composeProactiveWhisper(state, aiPlayer, human, rng);
    const responseSignals = predictDialogueSignals(composed.response);

    addLog(state, "whisper", `${aiPlayer.name} -> 你：${composed.response}`, {
      private: true,
      viewerId: human.id,
      sourceId: aiPlayer.id,
      direction: "in",
      intent: composed.intent,
      proactive: true,
    });

    state.events.speeches.push({
      day: state.day,
      playerId: aiPlayer.id,
      line: composed.response,
      focusId: composed.focusId,
      private: true,
      viewerId: human.id,
      targetId: human.id,
      proactive: true,
    });

    recordPrivateWhisperForAgents(state, {
      speakerId: aiPlayer.id,
      targetId: human.id,
      text: composed.response,
      intent: composed.intent,
      focusId: composed.focusId,
    });

    pushTimeline(state, {
      mode: "whisper-in",
      speakerId: aiPlayer.id,
      targetId: human.id,
      text: composed.response,
      proactive: true,
    });

    recordUtteranceMVP(state, {
      speakerId: aiPlayer.id,
      audience: "private",
      text: composed.response,
      speechActs: [
        ...new Set([
          ...inferSpeechActsFromIntent(composed.intent, { audience: "private", isQuestion: false }),
          ...(responseSignals.speechActs ?? []),
        ]),
      ],
      targets: composed.focusId ? [composed.focusId] : [human.id],
      intent: composed.intent,
      voteStance: voteStanceFromText(composed.response),
      evidenceSource: areKnownAllies(state, aiPlayer, human) ? "storyteller_signal" : "private_chat",
      epistemicStrength: composed.focusScore >= 0.72 ? 3 : composed.focusScore >= 0.56 ? 2 : 1,
      nominationRelated: /提名|nominate/i.test(composed.response),
      metadata: {
        source: "ai_proactive_private_whisper",
        viewerId: human.id,
        direction: "in",
        proactive: true,
        mlVoteLabel: responseSignals.voteLabel ?? "undecided",
        mlVoteConfidence: responseSignals.voteConfidence ?? 0,
        mlSpeechActs: responseSignals.speechActs ?? [],
        mlTokenHits: responseSignals.tokenHits ?? 0,
      },
    });

    sentIds.add(aiPlayer.id);
    messages.push({
      targetId: aiPlayer.id,
      targetName: aiPlayer.name,
      targetSeat: aiPlayer.seatIndex + 1,
      personaLabel: PERSONA_LABELS[aiPlayer.aiPersona ?? PERSONA_TYPES.STEADY] ?? "稳健",
      question: "主动来访",
      response: composed.response,
      focusId: composed.focusId,
    });
  });

  dayRecord.sentIds = [...sentIds];
  return messages;
}

export function runPrivateWhisper(state, { targetId, humanLine, intentHint = QUESTION_INTENT.GENERIC }, rng = Math.random) {
  if (state.phase !== "day" || state.gameOver) {
    return { ok: false, reason: "当前不在白天流程。" };
  }
  if (state.dayStage !== "private") {
    return { ok: false, reason: "当前不是私聊阶段。" };
  }

  const human = state.players.find((entry) => entry.isHuman);
  const target = getPlayerById(state, targetId);
  if (!human || !target || target.isHuman) {
    return { ok: false, reason: "私聊目标无效。" };
  }
  const slot = consumePrivateChat(state, target.id);
  if (!slot.ok) {
    return { ok: false, reason: slot.reason };
  }

  refreshAIBeliefs(state);

  const cleaned = `${humanLine ?? ""}`.trim();
  const question = cleaned.length > 0 ? cleaned.slice(0, 120) : "你现在最怀疑谁？";
  const analysis = detectIntent(state, question, intentHint);
  const questionSignals = predictDialogueSignals(question);

  applyPrivateChatSignals(target, human, analysis.mentionedPlayers, question);
  refreshAIBeliefs(state);

  const memory = ensurePairMemory(state, target.id, human.id);
  const sameEvilTeam = areKnownAllies(state, target, human);
  const composed = sameEvilTeam
    ? composeEvilAllianceResponse(state, target, human, analysis, rng)
    : composePrivateResponse(state, target, human, analysis, question, memory, rng);
  const responseSignals = predictDialogueSignals(composed.response);

  addLog(state, "whisper", `你 -> ${target.name}：${question}`, {
    private: true,
    playerId: human.id,
    targetId: target.id,
    direction: "out",
    intent: analysis.intent,
  });

  addLog(state, "whisper", `${target.name} -> 你：${composed.response}`, {
    private: true,
    viewerId: human.id,
    sourceId: target.id,
    direction: "in",
    intent: analysis.intent,
  });

  state.events.speeches.push({
    day: state.day,
    playerId: target.id,
    line: composed.response,
    focusId: composed.focusId,
    private: true,
    viewerId: human.id,
    targetId: human.id,
  });
  recordPrivateWhisperForAgents(state, {
    speakerId: human.id,
    targetId: target.id,
    text: question,
    intent: analysis.intent,
  });
  recordPrivateWhisperForAgents(state, {
    speakerId: target.id,
    targetId: human.id,
    text: composed.response,
    intent: analysis.intent,
    focusId: composed.focusId,
  });

  pushTimeline(state, {
    mode: "whisper-out",
    speakerId: human.id,
    targetId: target.id,
    text: question,
  });

  pushTimeline(state, {
    mode: "whisper-in",
    speakerId: target.id,
    targetId: human.id,
    text: composed.response,
  });

  recordUtteranceMVP(state, {
    speakerId: human.id,
    audience: "private",
    text: question,
    speechActs: [
      ...new Set([
        ...inferSpeechActsFromIntent(analysis.intent, { audience: "private", isQuestion: true }),
        ...(questionSignals.speechActs ?? []),
      ]),
    ],
    targets: analysis.mentionedPlayers.length > 0 ? analysis.mentionedPlayers.map((entry) => entry.id) : [target.id],
    intent: analysis.intent,
    voteStance: voteStanceFromText(question),
    evidenceSource: "private_chat",
    epistemicStrength: analysis.confidence >= 2.2 ? 3 : analysis.confidence >= 1.15 ? 2 : 1,
    nominationRelated: /提名|nominate/i.test(question),
    metadata: {
      source: "human_private_whisper",
      targetId: target.id,
      direction: "out",
      intentHint: analysis.hint,
      secondaryIntent: analysis.secondaryIntent ?? null,
      mlVoteLabel: questionSignals.voteLabel ?? "undecided",
      mlVoteConfidence: questionSignals.voteConfidence ?? 0,
      mlSpeechActs: questionSignals.speechActs ?? [],
      mlTokenHits: questionSignals.tokenHits ?? 0,
    },
  });

  recordUtteranceMVP(state, {
    speakerId: target.id,
    audience: "private",
    text: composed.response,
    speechActs: [
      ...new Set([
        ...inferSpeechActsFromIntent(analysis.intent, { audience: "private", isQuestion: false }),
        ...(responseSignals.speechActs ?? []),
      ]),
    ],
    targets: composed.focusId ? [composed.focusId] : [human.id],
    intent: analysis.intent,
    voteStance: voteStanceFromText(composed.response),
    evidenceSource: sameEvilTeam ? "storyteller_signal" : "private_chat",
    epistemicStrength: composed.focusScore >= 0.72 ? 3 : composed.focusScore >= 0.56 ? 2 : 1,
    nominationRelated: /提名|nominate/i.test(composed.response),
    metadata: {
      source: "ai_private_whisper",
      viewerId: human.id,
      direction: "in",
      sameEvilTeam,
      secondaryIntent: analysis.secondaryIntent ?? null,
      mlVoteLabel: responseSignals.voteLabel ?? "undecided",
      mlVoteConfidence: responseSignals.voteConfidence ?? 0,
      mlSpeechActs: responseSignals.speechActs ?? [],
      mlTokenHits: responseSignals.tokenHits ?? 0,
    },
  });

  memory.turns += 1;
  memory.lastDay = state.day;
  memory.lastIntent = analysis.intent;
  memory.lastFocusId = composed.focusId ?? memory.lastFocusId;
  memory.lastFocusScore = Number.isFinite(composed.focusScore) ? composed.focusScore : memory.lastFocusScore;
  memory.lastQuestion = question;
  memory.lastResponse = composed.response;

  const attitude = inferAttitude(question);
  if (attitude === "accuse") {
    memory.pressure += 1;
  } else if (attitude === "defend") {
    memory.cooperation += 1;
  }

  if (slot.remaining === 0) {
    addLog(state, "hint", "今日私聊次数已用完，你可以进入公聊阶段。", {});
  }

  return {
    ok: true,
    targetId: target.id,
    targetName: target.name,
    targetSeat: target.seatIndex + 1,
    personaLabel: PERSONA_LABELS[target.aiPersona ?? PERSONA_TYPES.STEADY] ?? "稳健",
    question,
    response: composed.response,
    followUp: !!slot.followUp,
    followUpUsed: slot.followUpUsed ?? 0,
    followUpLimit: slot.followUpLimit ?? 2,
    used: slot.used,
    limit: slot.limit,
    remaining: slot.remaining,
  };
}

export function decideAIVote(voter, nominee, state, rng = Math.random) {
  if (!voter || !nominee) {
    return false;
  }

  const suspicion = voter.suspicion?.[nominee.id] ?? 0.5;
  if (!voter.alive && !voter.ghostVoteAvailable) {
    return false;
  }

  if (voter.team === "evil") {
    if (areKnownAllies(state, voter, nominee)) {
      return suspicion > 0.9 && rng() < 0.08;
    }
    const shift = personaThresholdShift(voter.aiPersona ?? PERSONA_TYPES.STEADY);
    return suspicion >= (voter.alive ? 0.43 + shift : 0.56 + shift);
  }

  const shift = personaThresholdShift(voter.aiPersona ?? PERSONA_TYPES.STEADY);
  const threshold = voter.alive ? 0.58 + shift : 0.69 + shift;
  return suspicion >= threshold;
}

function expectedSupportFor(state, nomineeId) {
  const nominee = getPlayerById(state, nomineeId);
  if (!nominee) {
    return 0;
  }
  return getAlivePlayers(state)
    .filter((voter) => !voter.isHuman)
    .reduce((sum, voter) => {
    if (decideAIVote(voter, nominee, state, () => 0.4)) {
      return sum + 1;
    }
    return sum;
    }, 0);
}

function nominationThreshold(state) {
  const aliveCount = getAlivePlayers(state).length;
  const day = state.day ?? 1;
  const publicRounds = state.dayStageMeta?.publicRounds ?? 0;
  let threshold = day <= 1 ? 0.48 : 0.52;
  if (publicRounds >= 2) {
    threshold -= 0.03;
  }
  if (aliveCount <= 5) {
    threshold -= 0.06;
  } else if (aliveCount <= 7) {
    threshold -= 0.03;
  }
  return clamp(threshold, 0.38, 0.58);
}

function pressureReasonFor(aiPlayer, target, support, evidenceCount, threshold) {
  const score = aiPlayer.suspicion?.[target.id] ?? 0.5;
  if (evidenceCount > 0) {
    return `压力提名：已有 ${evidenceCount} 条个人证据，怀疑 ${Math.round(score * 100)}%，达到 ${Math.round(threshold * 100)}% 的行动线。`;
  }
  if (support > 0) {
    return `压力提名：硬证据不足，但预计有 ${support} 个 AI 倾向支持，先看票型和反应。`;
  }
  return `压力提名：硬证据不足，但连续空过收益太低，先把最高疑点位放上台。`;
}

function buildNominationProposal(state, aiPlayer, candidate, threshold, rankIndex, options = {}) {
  const evidenceCount = countAgentEvidence(getAIAgent(state, aiPlayer), candidate.player.id);
  const support = expectedSupportFor(state, candidate.player.id);
  const highConfidence = candidate.score >= 0.56 && !options.forcePressure;
  return {
    nominatorId: aiPlayer.id,
    nomineeId: candidate.player.id,
    confidence: candidate.score,
    support,
    evidenceCount,
    pressure: !highConfidence,
    threshold,
    rankIndex,
    reason: highConfidence
      ? `自动提名：怀疑度 ${Math.round(candidate.score * 100)}%，已达到常规提名线。`
      : pressureReasonFor(aiPlayer, candidate.player, support, evidenceCount, threshold),
  };
}

function sortNominationProposals(proposals) {
  proposals.sort((a, b) => {
    if (a.pressure !== b.pressure) {
      return a.pressure ? 1 : -1;
    }
    if (b.support !== a.support) {
      return b.support - a.support;
    }
    if (b.evidenceCount !== a.evidenceCount) {
      return b.evidenceCount - a.evidenceCount;
    }
    return b.confidence - a.confidence;
  });
  return proposals;
}

function choosePressureFallbackNomination(state, candidates, threshold) {
  const aliveCount = getAlivePlayers(state).length;
  const day = state.day ?? 1;
  const publicRounds = state.dayStageMeta?.publicRounds ?? 0;
  const shouldForcePressure = day <= 1 || publicRounds >= 1 || aliveCount <= 5;
  const fallbackFloor = aliveCount <= 5 ? 0.34 : day <= 1 ? 0.2 : 0.42;
  const fallbackProposals = [];

  candidates.forEach((aiPlayer) => {
    const candidate = rankTargets(aiPlayer, state, state.players.length)
      .filter((entry) => entry.player.alive && !entry.player.beenNominatedToday)
      .filter((entry) => !areKnownAllies(state, aiPlayer, entry.player))
      .find((entry) => shouldForcePressure || entry.score >= fallbackFloor);

    if (!candidate || (!shouldForcePressure && candidate.score < fallbackFloor)) {
      return;
    }

    fallbackProposals.push(
      buildNominationProposal(state, aiPlayer, candidate, Math.min(threshold, fallbackFloor), 0, {
        forcePressure: true,
      })
    );
  });

  if (fallbackProposals.length === 0) {
    return null;
  }

  return sortNominationProposals(fallbackProposals)[0];
}

export function chooseAINomination(state) {
  if (state.phase !== "day" || state.gameOver) {
    return null;
  }

  refreshAIBeliefs(state);
  const threshold = nominationThreshold(state);
  const candidates = state.players.filter((entry) => entry.alive && !entry.isHuman && !entry.nominatedToday);
  const proposals = [];

  candidates.forEach((aiPlayer) => {
    rankTargets(aiPlayer, state, state.players.length)
      .filter((entry) => entry.player.alive && !entry.player.beenNominatedToday)
      .filter((entry) => !areKnownAllies(state, aiPlayer, entry.player))
      .slice(0, 3)
      .forEach((candidate, rankIndex) => {
        const evidenceCount = countAgentEvidence(getAIAgent(state, aiPlayer), candidate.player.id);
        const support = expectedSupportFor(state, candidate.player.id);
        const hasEvidence = evidenceCount > 0 || support > 0;
        const highConfidence = candidate.score >= 0.56;
        const pressureEligible = candidate.score >= threshold && (hasEvidence || state.day <= 1 || getAlivePlayers(state).length <= 5);
        if (!highConfidence && !pressureEligible) {
          return;
        }
        proposals.push(buildNominationProposal(state, aiPlayer, candidate, threshold, rankIndex));
      });
  });

  if (proposals.length === 0) {
    return choosePressureFallbackNomination(state, candidates, threshold);
  }

  return sortNominationProposals(proposals)[0];
}

function snapshotAIBeliefFields(state) {
  return state.players
    .filter((entry) => !entry.isHuman)
    .map((player) => ({
      id: player.id,
      suspicion: structuredClone(player.suspicion ?? {}),
      reasonFlags: structuredClone(player.reasonFlags ?? {}),
      dialogueBias: structuredClone(player.dialogueBias ?? {}),
      beliefTrailByPlayerId: structuredClone(getAIAgent(state, player)?.beliefTrailByPlayerId ?? {}),
    }));
}

function restoreAIBeliefFields(state, snapshot) {
  snapshot.forEach((entry) => {
    const player = getPlayerById(state, entry.id);
    if (!player) {
      return;
    }
    player.suspicion = entry.suspicion;
    player.reasonFlags = entry.reasonFlags;
    player.dialogueBias = entry.dialogueBias;
    const agent = getAIAgent(state, player);
    if (agent) {
      agent.beliefTrailByPlayerId = entry.beliefTrailByPlayerId ?? {};
    }
  });
}

export function getAIInsightRows(state) {
  const snapshot = snapshotAIBeliefFields(state);
  refreshAIBeliefs(state);
  const rows = state.players
    .filter((entry) => !entry.isHuman)
    .map((aiPlayer) => {
      const top = getTopTarget(aiPlayer, state);
      const personaTag = PERSONA_LABELS[aiPlayer.aiPersona ?? PERSONA_TYPES.STEADY] ?? "稳健";
      const targets = rankTargets(aiPlayer, state, Math.min(8, state.players.length))
        .filter((entry) => entry.player.id !== aiPlayer.id)
        .map((entry) => ({
          id: entry.player.id,
          name: entry.player.name,
          score: `${Math.round(entry.score * 100)}%`,
          scoreValue: entry.score,
          reason: summarizeReason(aiPlayer, entry.player.id) || "暂无明确理由",
          trail: getSuspicionTrailForTarget(state, aiPlayer, entry.player.id).slice(-12),
        }));
      return {
        id: aiPlayer.id,
        name: `${aiPlayer.name}${personaTag}`,
        targetId: top?.player?.id ?? null,
        target: top?.player?.name ?? "--",
        score: top ? `${Math.round(top.score * 100)}%` : "--",
        reason: top ? summarizeReason(aiPlayer, top.player.id) : "暂无线索",
        targets,
      };
    });
  restoreAIBeliefFields(state, snapshot);
  return rows;
}
