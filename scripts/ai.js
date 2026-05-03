import { clamp, getAllRoles, REASON_SNIPPETS, sample } from "./data.js";
import { addLog, consumePrivateChat, getAlivePlayers, getEffectiveRoleId, getPlayerById } from "./engine.js";
import { inferSpeechActsFromIntent, recordUtteranceMVP } from "./dialogue_schema.js";
import { predictDialogueSignals, voteLabelToInGameStance } from "./ml_runtime.js";
import {
  areKnownAllies,
  countAgentEvidence,
  ensureAIAgents,
  getAIAgent,
  getAgentObservations,
  getKnownAllyIds,
  getKnownBluffRoleIds,
  getVisibleClaims,
  getVisibleSpeeches,
  recordPrivateWhisperForAgents,
  recordPublicClaimForAgents,
  recordPublicSpeechForAgents,
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
  state.aiDialogue.lastPublicFocusBySpeaker = state.aiDialogue.lastPublicFocusBySpeaker ?? {};
  state.aiDialogue.lastPublicTemplateBySpeaker = state.aiDialogue.lastPublicTemplateBySpeaker ?? {};
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

function applyClaimSignals(state, aiPlayer) {
  const claims = getAgentObservations(state, aiPlayer, "claim").map((observation) => ({
    playerId: observation.payload?.playerId,
    roleId: observation.payload?.roleId,
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
        bump(aiPlayer, playerId, 0.1, "duplicateClaim");
      });
    }
  });

  Object.entries(byPlayer).forEach(([playerId, roleIds]) => {
    const uniqueRoles = [...new Set(roleIds)];
    if (uniqueRoles.length > 1) {
      bump(aiPlayer, playerId, 0.12, "claimFlip");
    }
  });

  const bluffIds = new Set(getKnownBluffRoleIds(state, aiPlayer));
  claims.forEach((claim) => {
    if (bluffIds.has(claim.roleId)) {
      bump(aiPlayer, claim.playerId, 0.06, "bluffHit");
    }
  });
}

function applyNominationSignals(state, aiPlayer) {
  getAgentObservations(state, aiPlayer, "nomination").forEach((entry) => {
    const nominatorId = entry.payload?.nominatorId;
    const nomineeId = entry.payload?.nomineeId;
    if (!nominatorId || !nomineeId) {
      return;
    }
    const nomineeHeat = aiPlayer.suspicion?.[nomineeId] ?? 0.5;
    if (nomineeHeat < 0.45) {
      bump(aiPlayer, nominatorId, 0.04, "suspiciousNomination");
    }
    if (nomineeHeat > 0.68) {
      bump(aiPlayer, nominatorId, -0.03, "proGoodVote");
    }
  });
}

function applyVoteSignals(state, aiPlayer) {
  getAgentObservations(state, aiPlayer, "vote").forEach((event) => {
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
        bump(aiPlayer, detail.voterId, -0.03, "proGoodVote");
      }
      if (nomineeHeat >= 0.62 && !detail.vote) {
        bump(aiPlayer, detail.voterId, 0.05, "antiGoodVote");
      }
      if (nomineeHeat <= 0.4 && detail.vote) {
        bump(aiPlayer, detail.voterId, 0.05, "antiGoodVote");
      }
    });
  });
}

function applyObservedSpeechSignals(state, aiPlayer) {
  getAgentObservations(state, aiPlayer, "public-speech").forEach((observation) => {
    const speakerId = observation.payload?.speakerId;
    const focusId = observation.payload?.focusId;
    if (!speakerId || speakerId === aiPlayer.id) {
      return;
    }
    const text = normalizeText(observation.text ?? "");
    if (focusId && focusId !== aiPlayer.id) {
      const attitude = inferAttitude(observation.text ?? "");
      if (attitude === "accuse") {
        bump(aiPlayer, focusId, 0.025, "humanAccuse");
      } else if (attitude === "defend") {
        bump(aiPlayer, focusId, -0.02, "humanDefend");
      }
    }
    if (hasAny(text, ACCUSE_WORDS) && !focusId) {
      bump(aiPlayer, speakerId, 0.015, "privateEvasive");
    }
  });
}

function applyObservedPrivateSignals(state, aiPlayer) {
  getAgentObservations(state, aiPlayer, "private-whisper").forEach((observation) => {
    const speakerId = observation.payload?.speakerId;
    const focusId = observation.payload?.focusId;
    if (!speakerId || speakerId === aiPlayer.id || !focusId || focusId === aiPlayer.id) {
      return;
    }
    const attitude = inferAttitude(observation.text ?? "");
    if (attitude === "accuse") {
      bump(aiPlayer, focusId, 0.04, "humanAccuse");
    } else if (attitude === "defend") {
      bump(aiPlayer, focusId, -0.035, "humanDefend");
    }
  });
}

function applyNightPatternSignals(state, aiPlayer) {
  getAgentObservations(state, aiPlayer, "night-death").forEach((death) => {
    const deathPlayerId = death.payload?.playerId;
    if (!deathPlayerId) {
      return;
    }
    const before = getAgentObservations(state, aiPlayer, "public-speech")
      .filter((speech) => speech.payload?.speakerId === deathPlayerId)
      .slice(-1)[0];
    if (before?.payload?.focusId) {
      bump(aiPlayer, before.payload.focusId, 0.06, "nightPattern");
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

function composeEvilAllianceResponse(state, aiPlayer, human, analysis) {
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

  const lines = ["我们是同阵营，我按互认信息直说。"];
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
    lines.push("对白天发言我会保留伪装口径，不会在台面直接报邪恶身份。");
  }

  if (goodFocus) {
    const evidence = collectEvidence(state, aiPlayer, goodFocus.player);
    lines.push(`我建议推进 ${goodFocus.player.name}（${Math.round(goodFocus.score * 100)}%）。`);
    if (evidence.length > 0) {
      lines.push(`依据：${evidence.join("；")}。`);
    }
  } else {
    lines.push("暂时没有稳定的好人目标，先看下一轮公聊。");
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

  const agentEvidenceCount = countAgentEvidence(getAIAgent(state, aiPlayer), focusPlayer.id);
  if (agentEvidenceCount > 0) {
    snippets.push(`个人视角记录 ${agentEvidenceCount} 条`);
  }

  return [...new Set(snippets)].slice(0, 2);
}

function pickClaimRole(state, aiPlayer, rng = Math.random) {
  if (aiPlayer.publicClaimRoleId) {
    return null;
  }
  if (state.day > 1 && rng() > 0.35) {
    return null;
  }

  if (aiPlayer.team === "evil") {
    let bluffPool = getKnownBluffRoleIds(state, aiPlayer);
    if (bluffPool.length === 0) {
      bluffPool = getAllRoles(state.scriptId)
        .filter((role) => role.team === "good")
        .map((role) => role.id);
    }
    if (bluffPool.length > 0) {
      const unused = bluffPool.filter((roleId) => !state.players.some((entry) => entry.publicClaimRoleId === roleId));
      const pool = unused.length > 0 ? unused : bluffPool;
      return sample(pool, 1, rng)[0] ?? null;
    }
  }

  const perceived = getEffectiveRoleId(aiPlayer) ?? aiPlayer.roleId;
  return perceived ?? null;
}

function maybePrivateClaim(state, aiPlayer, human, rng = Math.random) {
  if (aiPlayer.publicClaimRoleId || rng() >= 0.35) {
    return "";
  }

  const roleId = pickClaimRole(state, aiPlayer, rng);
  if (!roleId) {
    return "";
  }

  aiPlayer.publicClaimRoleId = roleId;
  state.events.claims.push({ day: state.day, playerId: aiPlayer.id, roleId, private: true, viewerId: human.id });
  addLog(state, "claim", `${aiPlayer.name} 在私聊中报身份为 ${roleNameById(state, roleId)}。`, {
    playerId: aiPlayer.id,
    viewerId: human.id,
    roleId,
    private: true,
  });

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
    "我先给短结论。",
    "我按现在的盘面说。",
    "先不绕，直接说重点。",
    "这题我分两层看。",
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

  lines.push(sample(openerPool, 1, rng)[0]);

  switch (analysis.intent) {
    case QUESTION_INTENT.REASON:
      lines.push(`我现在主要压 ${focusText}，理由是：${evidenceText}。`);
      break;
    case QUESTION_INTENT.TRUST:
      lines.push(`${trustLine} 但今天我更想看 ${focus.player.name} 的反应，因为${evidenceText}。`);
      break;
    case QUESTION_INTENT.CLAIM: {
      const claimSentence = maybePrivateClaim(state, aiPlayer, human, rng);
      lines.push(claimSentence || "身份我先不急着摊开；如果到提名前我还活着，我会给可验证口径。");
      lines.push(`同时我当前更关注 ${focusText}。`);
      break;
    }
    case QUESTION_INTENT.VOTE:
      lines.push(`如果现在提名 ${focus.player.name}，我倾向赞成。`);
      lines.push(`我的理由是：${evidenceText}。`);
      break;
    case QUESTION_INTENT.NIGHT:
      lines.push(buildNightSummary(state));
      lines.push(`结合白天线，我会先盯 ${focus.player.name}。`);
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
      lines.push(`${trustLine} 今天的执行线我建议放在 ${focus.player.name} 身上。`);
      lines.push(`先让他解释${evidence.length > 0 ? "这条线" : "自己的信息和投票态度"}；如果回答继续含糊，再考虑提名。`);
      break;
    case QUESTION_INTENT.SUSPECT:
    case QUESTION_INTENT.GENERIC:
    default:
      lines.push(`我现在最想追的是 ${focusText}。`);
      lines.push(`关键点是：${evidenceText}。`);
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

function composePublicLine(state, aiPlayer, roundInDay, rng = Math.random) {
  const ranked = rankTargets(aiPlayer, state, 3);
  const topCandidate = ranked[0] ?? null;
  if (!topCandidate) {
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

  const evidence = collectEvidence(state, aiPlayer, top.player);
  const scorePct = Math.round(top.score * 100);

  const persona = aiPlayer.aiPersona ?? PERSONA_TYPES.STEADY;
  const hardPressThreshold = 0.58 + personaThresholdShift(persona);
  const templates = top.score >= hardPressThreshold
    ? [
        { id: "press", text: `我这一轮优先压 ${top.player.name}（${scorePct}%），核心依据：${evidence.join("；")}。` },
        { id: "risk", text: `当前最危险的是 ${top.player.name}（${scorePct}%），理由是：${evidence.join("；")}。` },
        { id: "nominate-ready", text: `如果要推进提名，我会先提 ${top.player.name}（${scorePct}%）。` },
      ]
    : [
        { id: "probe", text: `我先把 ${top.player.name} 放在观察前位（${scorePct}%），但还没到必处决。` },
        { id: "soft", text: `${top.player.name} 目前是我的轻压位（${scorePct}%），再看一轮回答。` },
        { id: "watch", text: `我优先盯 ${top.player.name}（${scorePct}%），建议继续追问。` },
      ];

  const personaTail =
    persona === PERSONA_TYPES.PRESSURE
      ? "我更倾向先压出真实反应。"
      : persona === PERSONA_TYPES.SHADOW
      ? "我更倾向先收票型信息，再决定是否落锤。"
      : "我会保持节奏，先压后验。";

  const tails = [
    second ? `次级关注是 ${second.player.name}。` : "次级关注位暂不明确。",
    `这是今天第 ${roundInDay} 轮公聊。`,
    top.score >= 0.68 ? "这个目标已接近可执行提名阈值。" : "当前更适合持续施压，不急着立即处决。",
    personaTail,
  ];

  const chosen = sample(templates, 1, rng)[0];
  const tail = sample(tails, 1, rng)[0];

  return {
    templateId: chosen.id,
    line: `${chosen.text} ${tail}`,
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

  const aliveAIs = getAlivePlayers(state)
    .filter((entry) => !entry.isHuman)
    .sort((a, b) => a.seatIndex - b.seatIndex);
  const speakers = rotateBy(aliveAIs, Math.max(0, roundInDay - 1));

  speakers.forEach((aiPlayer, orderIndex) => {
    const claimRoleId = pickClaimRole(state, aiPlayer, rng);
    if (claimRoleId) {
      aiPlayer.publicClaimRoleId = claimRoleId;
      const claim = { day: state.day, playerId: aiPlayer.id, roleId: claimRoleId, private: false };
      state.events.claims.push(claim);
      recordPublicClaimForAgents(state, claim);
      addLog(state, "claim", `${aiPlayer.name} 声称自己是 ${roleNameById(state, claimRoleId)}。`, {
        playerId: aiPlayer.id,
        roleId: claimRoleId,
      });
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
  if (!target.alive) {
    return { ok: false, reason: "目标已死亡，无法私聊。" };
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
    ? composeEvilAllianceResponse(state, target, human, analysis)
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

export function chooseAINomination(state) {
  if (state.phase !== "day" || state.gameOver) {
    return null;
  }

  refreshAIBeliefs(state);
  const candidates = state.players.filter((entry) => entry.alive && !entry.isHuman && !entry.nominatedToday);
  const proposals = [];

  candidates.forEach((aiPlayer) => {
    const top = getTopTarget(aiPlayer, state);
    if (!top || top.score < 0.56 || top.player.beenNominatedToday) {
      return;
    }

    const support = expectedSupportFor(state, top.player.id);
    proposals.push({
      nominatorId: aiPlayer.id,
      nomineeId: top.player.id,
      confidence: top.score,
      support,
    });
  });

  if (proposals.length === 0) {
    return null;
  }

  proposals.sort((a, b) => {
    if (b.support !== a.support) {
      return b.support - a.support;
    }
    return b.confidence - a.confidence;
  });

  return proposals[0];
}

function snapshotAIBeliefFields(state) {
  return state.players
    .filter((entry) => !entry.isHuman)
    .map((player) => ({
      id: player.id,
      suspicion: structuredClone(player.suspicion ?? {}),
      reasonFlags: structuredClone(player.reasonFlags ?? {}),
      dialogueBias: structuredClone(player.dialogueBias ?? {}),
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
      return {
        id: aiPlayer.id,
        name: `${aiPlayer.name}${personaTag}`,
        target: top?.player?.name ?? "--",
        score: top ? `${Math.round(top.score * 100)}%` : "--",
        reason: top ? summarizeReason(aiPlayer, top.player.id) : "暂无线索",
      };
    });
  restoreAIBeliefFields(state, snapshot);
  return rows;
}
