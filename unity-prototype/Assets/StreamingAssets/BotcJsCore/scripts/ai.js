import { clamp, REASON_SNIPPETS, sample } from "./data.js";
import { addLog, consumePrivateChat, getAlivePlayers, getEffectiveRoleId, getPlayerById } from "./engine.js";
import { inferSpeechActsFromIntent, recordUtteranceMVP } from "./dialogue_schema.js";
import { predictDialogueSignals, voteLabelToInGameStance } from "./ml_runtime.js";
import { createAIPrivateSocial } from "./ai_private_social.js";
import { createAIPublicDiscussion } from "./ai_public_discussion.js";
import {
  choosePublicClaimRole,
  chooseScriptAwareBluffRoleId,
  claimDisclosurePlanner,
  claimRangeForRole,
  claimRoleForContext,
  getClaimDisclosureState,
  isEarlyInfoRole,
  isLikelyEarlyInfoRole,
  maybePrivateClaim,
  maybePublicDisclosureLine,
  perceivedRoleForPlayer,
  pickClaimRole,
  publicClaimDisclosureLine,
  rememberClaimDisclosure,
  roleForPlayer,
  roleNameById,
  shouldDeadPublicClaim,
} from "./ai_claim_policy.js";
import {
  applyHumanSpeechCadence,
  applySpeechBudget,
  corpusLines,
  corpusTemplateEntry,
  differentiateRepeatedSpeech,
  joinSpeechFragments,
  personaCorpusKey,
  pickLayeredSpeech,
  pickCorpusTemplate,
  pickPersonaTemplate,
  polishConversationalText,
  renderDialogueActs as renderDialogueActsFromRenderer,
  shortReasonText,
} from "./ai_speech_renderer.js";
import {
  applyPrivateDialogueTurnTaking,
  applyPrivateStatementContinuity,
  applyPublicStatementContinuity as applyPublicStatementContinuityFromMemory,
  currentPublicStatementMemory,
  dayStanceLabel,
  publicStatementMemoryMatches,
  publicStatementMemoryPressure,
  publicStatementNominationReason,
  publicStatementVoteThresholdShift,
  rememberStatementMemory,
  stanceFromScore,
  statementTargetLabel,
  voteStanceFromText,
} from "./ai_statement_memory.js";
import {
  buildAIThoughtFrameCore,
  rememberAIThoughtFrame,
  thoughtFrameDisclosureLine,
} from "./ai_thought_frame.js";
import {
  areKnownAllies,
  addAgentObservation,
  buildAgentView,
  clearAgentBeliefTrail,
  countAgentEvidence,
  ensureAIAgents,
  getAIAgent,
  getAgentObservations,
  getAgentEvidence,
  getAgentKnowledgeGraph,
  getEvidenceForTarget,
  getKnownAllyIds,
  getKnownBluffRoleIds,
  getSuspicionTrailForTarget,
  getVisibleClaims,
  getVisibleSpeeches,
  recordPrivateChannelForAgents,
  recordPrivateWhisperForAgents,
  recordPrivateClaimForAgent,
  recordPrivateInfoClaimForAgent,
  recordPublicSpeechForAgents,
  recordSuspicionChangeFromEvidence,
  summarizeEvidenceForDialogue,
  updateAgentSourceTrustForPlayer,
} from "./ai_agents.js";

export { applyHumanSpeechCadence, applySpeechBudget } from "./ai_speech_renderer.js";
export { claimDisclosurePlanner, getClaimDisclosureState, getAIScriptPressureProfile } from "./ai_claim_policy.js";

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
  [QUESTION_INTENT.NIGHT]: [
    "昨晚",
    "昨夜",
    "夜里",
    "夜间",
    "夜晚",
    "夜死",
    "对得上",
    "能对上",
    "可验证",
    "能验证",
    "硬信息",
    "查谁",
    "看谁",
    "目标",
    "结果",
    "night",
    "last night",
  ],
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
  state.aiDialogue.pendingProactiveWhispers = Array.isArray(state.aiDialogue.pendingProactiveWhispers)
    ? state.aiDialogue.pendingProactiveWhispers
    : [];
  state.aiDialogue.statementMemory = state.aiDialogue.statementMemory ?? {};
  state.aiDialogue.statementMemory.publicBySpeakerId = state.aiDialogue.statementMemory.publicBySpeakerId ?? {};
  state.aiDialogue.statementMemory.privateByPairKey = state.aiDialogue.statementMemory.privateByPairKey ?? {};
  state.aiDialogue.thoughtFramesByAgentId = state.aiDialogue.thoughtFramesByAgentId ?? {};
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

function personaStrategyProfile(persona) {
  if (persona === PERSONA_TYPES.PRESSURE) {
    return {
      nominationShift: -0.05,
      voteShift: -0.03,
      evidenceBonus: 0.025,
      weakEvidencePenalty: 0,
      voteAbnormalWeight: 1.1,
      graphPressureWeight: 1.1,
      label: "aggressive-pressure",
    };
  }
  if (persona === PERSONA_TYPES.SHADOW) {
    return {
      nominationShift: 0.02,
      voteShift: 0.02,
      evidenceBonus: 0.04,
      weakEvidencePenalty: 0.025,
      voteAbnormalWeight: 1.35,
      graphPressureWeight: 1.25,
      label: "pattern-shadow",
    };
  }
  return {
    nominationShift: 0.015,
    voteShift: 0.02,
    evidenceBonus: 0.035,
    weakEvidencePenalty: 0.035,
    voteAbnormalWeight: 1,
    graphPressureWeight: 0.85,
    label: "evidence-steady",
  };
}

function graphRoleId(edge, direction = "to") {
  const value = direction === "from" ? edge?.from : edge?.to;
  const match = `${value ?? ""}`.match(/^role:(.+)$/);
  return match?.[1] ?? "";
}

function graphPlayerId(edge, direction = "to") {
  const value = direction === "from" ? edge?.from : edge?.to;
  const match = `${value ?? ""}`.match(/^player:(.+)$/);
  return match?.[1] ?? "";
}

function graphEdgeWeight(edge) {
  const trust = Number.isFinite(edge?.trust) ? edge.trust : 0.5;
  const risk = Number.isFinite(edge?.contaminationRisk) ? edge.contaminationRisk : 0.12;
  return clamp((0.45 + trust * 0.55) * (1 - risk * 0.75), 0.08, 1);
}

function graphPlayerLabel(state, playerId) {
  const player = getPlayerById(state, playerId);
  return player ? `${player.seatIndex + 1}号` : `${playerId ?? "未知玩家"}`;
}

function graphRoleLabel(state, roleId) {
  return roleNameById(state, roleId) || roleId || "未知身份";
}

function edgeTrustScore(edge) {
  return Number.isFinite(edge?.trust) ? edge.trust : 0.5;
}

function edgeRiskScore(edge) {
  return Number.isFinite(edge?.contaminationRisk) ? edge.contaminationRisk : 0.12;
}

function graphReasonText(reasonKey, targetName) {
  const name = targetName || "该玩家";
  return {
    falseClaim: `${name} 的身份声称和后续公开验证对不上`,
    verifiedClaim: `${name} 的身份声称被公开验证过`,
    abnormalVote: `${name} 的投票和当前公开票型压力相反`,
    validatedVote: `${name} 的投票和通过的处决方向一致`,
    nominationPressure: `${name} 曾被放进公开提名压力链`,
    nightInfo: `有夜间信息链条指向 ${name}，但需要看污染风险`,
    roleConflict: `${name} 的身份声称和别人撞车了`,
    defendedHotTarget: `${name} 在公聊里维护了当前高压目标`,
    accusedColdTarget: `${name} 在公聊里推动过低证据目标`,
    alignedPublicPressure: `${name} 的公开站队和当前压力方向一致`,
    lowSourceTrust: `${name} 作为信息来源的可信度正在下降`,
    highSourceTrust: `${name} 作为信息来源的可信度正在上升`,
  }[reasonKey] ?? `${name} 的关系图谱出现异常信号`;
}

function computeGraphPressureForTarget(stateOrView, aiPlayer, targetPlayer, options = {}) {
  if (!targetPlayer) {
    return { scoreDelta: 0, reasons: [], riskFlags: [] };
  }
  const agentView = stateOrView?.kind === "agent-view" ? stateOrView : null;
  const state = agentView?.state ?? stateOrView;
  const graph = agentView?.graphForTarget
    ? agentView.graphForTarget(targetPlayer.id)
    : getAgentKnowledgeGraph(state, aiPlayer, { targetId: targetPlayer.id });
  const fullGraph = state ? getAgentKnowledgeGraph(state, aiPlayer) : graph;
  const publicOnly = !!options.publicOnly;
  const edges = (graph.edges ?? []).filter((edge) => (publicOnly ? edge.visibility !== "private" : true));
  const fullEdges = (fullGraph.edges ?? []).filter((edge) => (publicOnly ? edge.visibility !== "private" : true));
  const claimed = edges.filter((edge) => edge.type === "claimed_role" && graphPlayerId(edge, "from") === targetPlayer.id);
  const revealed = edges.filter((edge) => edge.type === "revealed_as" && graphPlayerId(edge, "from") === targetPlayer.id);
  let scoreDelta = 0;
  const reasons = [];
  const riskFlags = [];
  const addReason = (key, delta, edge = null) => {
    scoreDelta += delta;
    const text = graphReasonText(key, targetPlayer.name);
    if (!reasons.includes(text)) {
      reasons.push(text);
    }
    if (edge?.contaminationRisk >= 0.45 && !riskFlags.includes("contaminated-edge")) {
      riskFlags.push("contaminated-edge");
    }
  };

  if (claimed.length > 0 && revealed.length > 0) {
    const revealedRoles = new Set(revealed.map((edge) => graphRoleId(edge)).filter(Boolean));
    claimed.forEach((edge) => {
      const roleId = graphRoleId(edge);
      if (!roleId || revealedRoles.size === 0) {
        return;
      }
      if (revealedRoles.has(roleId)) {
        addReason("verifiedClaim", -0.07 * graphEdgeWeight(edge), edge);
      } else {
        addReason("falseClaim", 0.13 * graphEdgeWeight(edge), edge);
      }
    });
  }

  edges
    .filter((edge) => (edge.type === "voted_no_on" || edge.type === "voted_yes_on") && graphPlayerId(edge) === targetPlayer.id)
    .forEach((edge) => {
      if (edge.type === "voted_no_on" && edge.metadata?.passed) {
        addReason("abnormalVote", 0.045 * graphEdgeWeight(edge), edge);
      } else if (edge.type === "voted_yes_on" && edge.metadata?.passed) {
        addReason("validatedVote", -0.025 * graphEdgeWeight(edge), edge);
      } else if (edge.type === "voted_yes_on" && !edge.metadata?.passed) {
        addReason("abnormalVote", 0.025 * graphEdgeWeight(edge), edge);
      }
    });

  edges
    .filter((edge) => edge.type === "nominated" && graphPlayerId(edge) === targetPlayer.id)
    .forEach((edge) => addReason("nominationPressure", 0.02 * graphEdgeWeight(edge), edge));

  claimed.forEach((edge) => {
    const roleId = graphRoleId(edge);
    if (!roleId) {
      return;
    }
    const conflictingClaimants = [
      ...new Set(
        fullEdges
          .filter((candidate) => candidate.type === "claimed_role" && graphRoleId(candidate) === roleId)
          .map((candidate) => graphPlayerId(candidate, "from"))
          .filter((playerId) => playerId && playerId !== targetPlayer.id)
      ),
    ];
    if (conflictingClaimants.length > 0) {
      addReason("roleConflict", Math.min(0.06, 0.035 + conflictingClaimants.length * 0.01) * graphEdgeWeight(edge), edge);
    }
  });

  edges
    .filter((edge) => edge.type === "public_defended" && graphPlayerId(edge, "from") === targetPlayer.id)
    .forEach((edge) => {
      const defendedId = graphPlayerId(edge);
      const defendedPressure = Number.isFinite(aiPlayer?.suspicion?.[defendedId]) ? aiPlayer.suspicion[defendedId] : 0.5;
      if (defendedPressure >= 0.62) {
        addReason("defendedHotTarget", 0.04 * graphEdgeWeight(edge), edge);
      } else if (defendedPressure <= 0.35) {
        addReason("alignedPublicPressure", -0.015 * graphEdgeWeight(edge), edge);
      }
    });

  edges
    .filter((edge) => edge.type === "public_accused" && graphPlayerId(edge, "from") === targetPlayer.id)
    .forEach((edge) => {
      const accusedId = graphPlayerId(edge);
      const accusedPressure = Number.isFinite(aiPlayer?.suspicion?.[accusedId]) ? aiPlayer.suspicion[accusedId] : 0.5;
      if (accusedPressure <= 0.35) {
        addReason("accusedColdTarget", 0.03 * graphEdgeWeight(edge), edge);
      } else if (accusedPressure >= 0.62) {
        addReason("alignedPublicPressure", -0.015 * graphEdgeWeight(edge), edge);
      }
    });

  const sourceEdges = edges.filter((edge) => edge.type === "source_of" && graphPlayerId(edge, "from") === targetPlayer.id);
  if (sourceEdges.length > 0) {
    const trusts = sourceEdges.map((edge) => edge.trust).filter(Number.isFinite);
    if (trusts.length > 0) {
      const averageTrust = trusts.reduce((sum, value) => sum + value, 0) / trusts.length;
      if (averageTrust < 0.42) {
        addReason("lowSourceTrust", 0.035 * (1 - averageTrust), sourceEdges[sourceEdges.length - 1]);
      } else if (averageTrust > 0.68) {
        addReason("highSourceTrust", -0.025 * averageTrust, sourceEdges[sourceEdges.length - 1]);
      }
    }
  }

  edges
    .filter((edge) => edge.type === "night_info_about" && graphPlayerId(edge) === targetPlayer.id)
    .forEach((edge) => {
      const weight = graphEdgeWeight(edge);
      const direction = edge.contaminationRisk >= 0.45 ? 0.015 : 0.04;
      addReason("nightInfo", direction * weight, edge);
      if (edge.contaminationRisk >= 0.35 && !riskFlags.includes("night-info-risk")) {
        riskFlags.push("night-info-risk");
      }
    });

  return {
    scoreDelta: clamp(scoreDelta, -0.14, 0.16),
    reasons: reasons.slice(0, 2),
    riskFlags,
  };
}

function extractGraphReasonChains(stateOrView, aiPlayer, targetPlayer, options = {}) {
  if (!targetPlayer) {
    return [];
  }
  const agentView = stateOrView?.kind === "agent-view" ? stateOrView : null;
  const state = agentView?.state ?? stateOrView;
  const targetId = targetPlayer.id;
  const graph = agentView?.graphForTarget
    ? agentView.graphForTarget(targetId)
    : getAgentKnowledgeGraph(state, aiPlayer, { targetId });
  const fullGraph = state ? getAgentKnowledgeGraph(state, aiPlayer) : graph;
  const publicOnly = !!options.publicOnly;
  const edges = (graph.edges ?? []).filter((edge) => (publicOnly ? edge.visibility !== "private" : true));
  const fullEdges = (fullGraph.edges ?? []).filter((edge) => (publicOnly ? edge.visibility !== "private" : true));
  const chains = [];
  const pushChain = (type, text, score, edgeList = [], riskFlags = []) => {
    const value = `${text ?? ""}`.trim();
    if (!value) {
      return;
    }
    chains.push({
      type,
      text: value,
      score: Number.isFinite(score) ? score : 0,
      edgeIds: edgeList.map((edge) => edge?.id).filter(Boolean),
      riskFlags,
    });
  };

  const claimed = edges.filter((edge) => edge.type === "claimed_role" && graphPlayerId(edge, "from") === targetId);
  const revealed = edges.filter((edge) => edge.type === "revealed_as" && graphPlayerId(edge, "from") === targetId);
  if (claimed.length > 0 && revealed.length > 0) {
    const reveal = revealed[revealed.length - 1];
    const revealedRoleId = graphRoleId(reveal);
    claimed.forEach((claim) => {
      const claimRoleId = graphRoleId(claim);
      if (!claimRoleId || !revealedRoleId) {
        return;
      }
      const mismatch = claimRoleId !== revealedRoleId;
      pushChain(
        mismatch ? "false-claim-chain" : "verified-claim-chain",
        mismatch
          ? `${targetPlayer.name} 声称 ${graphRoleLabel(state, claimRoleId)}，后续公开验证成 ${graphRoleLabel(state, revealedRoleId)}`
          : `${targetPlayer.name} 的 ${graphRoleLabel(state, claimRoleId)} 声称被公开验证过`,
        (mismatch ? 0.9 : 0.55) * graphEdgeWeight(claim),
        [claim, reveal]
      );
    });
  }

  claimed.forEach((claim) => {
    const roleId = graphRoleId(claim);
    if (!roleId) {
      return;
    }
    const others = [
      ...new Set(
        fullEdges
          .filter((edge) => edge.type === "claimed_role" && graphRoleId(edge) === roleId)
          .map((edge) => graphPlayerId(edge, "from"))
          .filter((playerId) => playerId && playerId !== targetId)
      ),
    ];
    if (others.length > 0) {
      pushChain(
        "role-conflict-chain",
        `${targetPlayer.name} 和 ${others.map((id) => graphPlayerLabel(state, id)).slice(0, 2).join("、")} 撞了 ${graphRoleLabel(state, roleId)} 声称`,
        0.62 + Math.min(0.18, others.length * 0.04),
        [claim]
      );
    }
  });

  edges
    .filter((edge) => edge.type === "public_defended" && graphPlayerId(edge, "from") === targetId)
    .forEach((edge) => {
      const defendedId = graphPlayerId(edge);
      const pressure = Number.isFinite(aiPlayer?.suspicion?.[defendedId]) ? aiPlayer.suspicion[defendedId] : 0.5;
      if (pressure >= 0.62) {
        pushChain(
          "public-defense-chain",
          `${targetPlayer.name} 在公聊里维护了当前高压位 ${graphPlayerLabel(state, defendedId)}`,
          0.58 + Math.min(0.24, pressure * 0.24),
          [edge]
        );
      }
    });

  edges
    .filter((edge) => edge.type === "public_accused" && graphPlayerId(edge, "from") === targetId)
    .forEach((edge) => {
      const accusedId = graphPlayerId(edge);
      const pressure = Number.isFinite(aiPlayer?.suspicion?.[accusedId]) ? aiPlayer.suspicion[accusedId] : 0.5;
      if (pressure <= 0.35) {
        pushChain(
          "public-accuse-chain",
          `${targetPlayer.name} 在公聊里推动过低证据位 ${graphPlayerLabel(state, accusedId)}`,
          0.5 + Math.min(0.2, (0.35 - pressure) * 0.5),
          [edge]
        );
      }
    });

  edges
    .filter((edge) => edge.type === "night_info_about" && graphPlayerId(edge) === targetId)
    .forEach((edge) => {
      const risk = edgeRiskScore(edge);
      pushChain(
        "night-info-chain",
        risk >= 0.45
          ? `有夜间信息指向 ${targetPlayer.name}，但这条链污染风险偏高`
          : `有夜间信息链条指向 ${targetPlayer.name}`,
        risk >= 0.45 ? 0.28 : 0.48,
        [edge],
        risk >= 0.35 ? ["night-info-risk"] : []
      );
    });

  edges
    .filter((edge) => edge.type === "source_of" && graphPlayerId(edge, "from") === targetId)
    .forEach((edge) => {
      const trust = edgeTrustScore(edge);
      if (trust < 0.42) {
        pushChain(
          "low-source-trust-chain",
          `${targetPlayer.name} 作为信息来源的可信度偏低，相关口径需要复核`,
          0.42 + (0.42 - trust),
          [edge]
        );
      }
    });

  return chains
    .sort((a, b) => b.score - a.score)
    .filter((entry, index, arr) => arr.findIndex((candidate) => candidate.text === entry.text) === index)
    .slice(0, options.limit ?? 3);
}

function personaAdjustedTargetScore(aiPlayer, state, target, baseScore) {
  const profile = personaStrategyProfile(aiPlayer.aiPersona ?? PERSONA_TYPES.STEADY);
  const evidenceCount = countAgentEvidence(getAIAgent(state, aiPlayer), target.id);
  const flags = aiPlayer.reasonFlags?.[target.id] ?? [];
  const graphPressure = computeGraphPressureForTarget(state, aiPlayer, target);
  const graphChains = extractGraphReasonChains(state, aiPlayer, target, {
    publicOnly: aiPlayer.team === "evil",
    limit: 2,
  });
  const memoryPressure = publicStatementMemoryMatches(currentPublicStatementMemory(state, aiPlayer.id), target.id)
    ? publicStatementMemoryPressure(currentPublicStatementMemory(state, aiPlayer.id))
    : 0;
  let adjusted = baseScore;
  adjusted += graphPressure.scoreDelta * profile.graphPressureWeight;
  if (aiPlayer.team === "evil" && !areKnownAllies(state, aiPlayer, target)) {
    const framingBonus = graphChains.length > 0 ? Math.min(0.055, graphChains[0].score * 0.055) : 0;
    adjusted += framingBonus;
  }
  if (evidenceCount > 0) {
    adjusted += Math.min(0.06, profile.evidenceBonus + evidenceCount * 0.006);
  } else if (memoryPressure <= 0) {
    adjusted -= profile.weakEvidencePenalty;
  }
  if (memoryPressure > 0) {
    adjusted += Math.min(0.08, memoryPressure);
  }
  if ((aiPlayer.aiPersona ?? PERSONA_TYPES.STEADY) === PERSONA_TYPES.PRESSURE) {
    if (flags.some((flag) => ["humanAccuse", "duplicateClaim", "suspiciousNomination"].includes(flag))) {
      adjusted += 0.035;
    }
  } else if ((aiPlayer.aiPersona ?? PERSONA_TYPES.STEADY) === PERSONA_TYPES.SHADOW) {
    if (flags.some((flag) => ["antiGoodVote", "claimFlip", "bluffHit"].includes(flag))) {
      adjusted += 0.045;
    }
  } else if (evidenceCount >= 2) {
    adjusted += 0.02;
  }
  return clamp(adjusted, 0.01, 0.99);
}

function personaPrefixPool(aiPlayer, intent) {
  const persona = aiPlayer.aiPersona ?? PERSONA_TYPES.STEADY;
  if (persona === PERSONA_TYPES.PRESSURE) {
    return intent === QUESTION_INTENT.PLAN
      ? corpusLines("persona.pressure.privateOpeners", ["我给你一条直接可执行线。", "我们别拖节奏，先压再验。", "先控场，再验人。"])
      : corpusLines("persona.pressure.privateOpeners", ["先给结论：我会直接压重点位。", "我不绕，先说最危险的人。", "我先落锤，再讲依据。"]);
  }
  if (persona === PERSONA_TYPES.SHADOW) {
    return intent === QUESTION_INTENT.CLAIM
      ? corpusLines("persona.shadow.privateOpeners", ["我先给你台面上可验证的部分。", "先说可公开信息。", "我先讲结论，不急着暴露细节。"])
      : corpusLines("persona.shadow.privateOpeners", ["我先说可交叉验证的点。", "我更重视票型和行为链。", "先给你稳妥信息，再给倾向。"]);
  }
  return corpusLines("persona.steady.privateOpeners", ["我按证据顺序说。", "我先给你短结论。", "我把当前信息压缩一下。"]);
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

function revealedRoleByPlayerId(state) {
  const map = {};
  (state.events?.nightDeaths ?? []).forEach((entry) => {
    const playerId = entry.playerId ?? entry.victimId;
    if (playerId && entry.roleId) {
      map[playerId] = { roleId: entry.roleId, day: entry.day, night: entry.night, phase: "night" };
    }
  });
  (state.events?.executions ?? []).forEach((entry) => {
    const playerId = entry.playerId ?? entry.nomineeId;
    if (playerId && entry.roleId) {
      map[playerId] = { roleId: entry.roleId, day: entry.day, night: entry.night, phase: "day" };
    }
  });
  return map;
}

function applyClaimTrustSignals(state, aiPlayer) {
  const revealed = revealedRoleByPlayerId(state);
  getVisibleClaims(state, aiPlayer).forEach((claim) => {
    const actual = revealed[claim.playerId];
    if (!actual?.roleId || !claim.roleId) {
      return;
    }
    const verified = claim.roleId === actual.roleId;
    updateAgentSourceTrustForPlayer(state, aiPlayer, claim.playerId, {
      delta: verified ? 0.08 : -0.16,
      reason: verified ? "verified-claim" : "false-claim",
      source: claim.private ? "private-chat" : "public-chat",
      eventKey: `claim-trust:${aiPlayer.id}:${claim.playerId}:${claim.roleId}:${actual.roleId}:${actual.phase}:${actual.day ?? ""}:${actual.night ?? ""}`,
      metadata: {
        claimedRoleId: claim.roleId,
        actualRoleId: actual.roleId,
        private: !!claim.private,
      },
    });
  });
}

function applyVoteTrustSignals(state, aiPlayer) {
  const profile = personaStrategyProfile(aiPlayer.aiPersona ?? PERSONA_TYPES.STEADY);
  getAgentEvidence(state, aiPlayer, { kind: "vote" }).forEach((event) => {
    const payload = event.payload ?? {};
    if (!payload.nomineeId || !Array.isArray(payload.votes)) {
      return;
    }
    const nomineeHeat = aiPlayer.suspicion?.[payload.nomineeId] ?? 0.5;
    payload.votes.forEach((detail) => {
      if (!detail?.voterId || detail.voterId === aiPlayer.id || detail.abstain) {
        return;
      }
      let delta = 0;
      let reason = "";
      if (payload.passed && detail.vote) {
        delta = 0.025;
        reason = "validated-vote";
      } else if (payload.passed && !detail.vote) {
        delta = -0.04;
        reason = "abnormal-vote";
      } else if (!payload.passed && detail.vote && nomineeHeat <= 0.4) {
        delta = -0.035;
        reason = "abnormal-vote";
      } else if (!payload.passed && !detail.vote && nomineeHeat >= 0.62) {
        delta = -0.03;
        reason = "abnormal-vote";
      }
      if (!delta) {
        return;
      }
      updateAgentSourceTrustForPlayer(state, aiPlayer, detail.voterId, {
        delta: delta * profile.voteAbnormalWeight,
        reason,
        source: "public-procedure",
        evidenceId: event.id,
        eventKey: `vote-trust:${aiPlayer.id}:${event.id}:${detail.voterId}:${reason}`,
        metadata: {
          nomineeId: payload.nomineeId,
          passed: !!payload.passed,
          vote: !!detail.vote,
          nomineeHeat,
          persona: profile.label,
        },
      });
    });
  });
}

function applyDynamicTrustSignals(state, aiPlayer) {
  applyClaimTrustSignals(state, aiPlayer);
  applyVoteTrustSignals(state, aiPlayer);
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
    .map((entry) => {
      const baseScore = aiPlayer.suspicion?.[entry.id] ?? 0.5;
      return {
        player: entry,
        score: personaAdjustedTargetScore(aiPlayer, state, entry, baseScore),
        rawScore: baseScore,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function getTopTarget(aiPlayer, state) {
  return rankTargets(aiPlayer, state, 1)[0] ?? null;
}

export function buildAIThoughtFrame(state, aiPlayer, options = {}) {
  return buildAIThoughtFrameCore(state, aiPlayer, options, {
    rankTargets,
    expectedSupportFor,
    pickClaimRole,
  });
}
function reasonSnippet(key) {
  return LOCAL_REASON_SNIPPETS[key] ?? REASON_SNIPPETS[key] ?? key;
}

function summarizeReason(aiPlayer, targetId) {
  const flags = aiPlayer.reasonFlags?.[targetId] ?? [];
  if (flags.length === 0) {
    return "这条行为和我手里的信息对不上";
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
    return `${player.name}`;
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
    const goodFocusName = statementTargetLabel(state, goodFocus.player.id);
    lines.push(`今天可以先把火力推到 ${goodFocusName} 身上。`);
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

function collectEvidence(stateOrView, aiPlayer, focusPlayer, options = {}) {
  const agentView = stateOrView?.kind === "agent-view" ? stateOrView : null;
  const state = agentView?.state ?? stateOrView;
  const safeEvidence = agentView
    ? agentView.summariesForTarget(focusPlayer.id, {
        limit: 2,
        publicOnly: !!options.publicOnly,
        includePrivate: !options.publicOnly,
      })
    : summarizeEvidenceForDialogue(state, aiPlayer, focusPlayer.id, {
        limit: 2,
        publicOnly: !!options.publicOnly,
        includePrivate: !options.publicOnly,
      });
  if (safeEvidence.length > 0) {
    return safeEvidence;
  }

  if (options.publicOnly) {
    return [];
  }

  const snippets = [];
  const reason = summarizeReason(aiPlayer, focusPlayer.id);
  if (reason) {
    snippets.push(reason);
  }

  const visibleClaims = agentView?.visibleClaims ?? getVisibleClaims(state, aiPlayer);
  const latestClaim = visibleClaims.filter((entry) => entry.playerId === focusPlayer.id).slice(-1)[0];
  if (latestClaim) {
    snippets.push(`该玩家最近报过身份：${roleNameById(state, latestClaim.roleId)}`);
  }

  const visibleSpeeches = agentView?.visibleSpeeches ?? getVisibleSpeeches(state, aiPlayer);
  const latestSpeech = visibleSpeeches
    .filter((entry) => entry.playerId === focusPlayer.id)
    .slice(-1)[0];
  if (latestSpeech?.line) {
    const concise = latestSpeech.line.length > 26 ? `${latestSpeech.line.slice(0, 26)}...` : latestSpeech.line;
    snippets.push(`该玩家最近公聊重点：${concise}`);
  }

  const targetEvidence = agentView
    ? agentView.evidenceForTarget(focusPlayer.id, {
        includePrivate: !options.publicOnly,
        publicOnly: !!options.publicOnly,
      })
    : getEvidenceForTarget(state, aiPlayer, focusPlayer.id);
  const agentEvidenceCount = agentView
    ? agentView.evidenceCountForTarget(focusPlayer.id)
    : countAgentEvidence(getAIAgent(state, aiPlayer), focusPlayer.id);
  if (agentEvidenceCount > 0) {
    const risky = targetEvidence.filter((entry) => entry.canBeFalse || entry.contaminationRisk >= 0.15).length;
    snippets.push(risky > 0 ? `个人证据 ${agentEvidenceCount} 条，其中 ${risky} 条可能被污染` : `个人证据 ${agentEvidenceCount} 条`);
  }

  return [...new Set(snippets)].slice(0, 2);
}

function buildDialogueEvidenceContract(stateOrView, aiPlayer, focusPlayer, options = {}) {
  const graphPressure = computeGraphPressureForTarget(stateOrView, aiPlayer, focusPlayer, {
    publicOnly: !!options.publicOnly,
  });
  const graphChains = extractGraphReasonChains(stateOrView, aiPlayer, focusPlayer, {
    publicOnly: !!options.publicOnly,
    limit: options.chainLimit ?? 2,
  });
  const summaries = [
    ...graphChains.map((entry) => entry.text),
    ...graphPressure.reasons,
    ...collectEvidence(stateOrView, aiPlayer, focusPlayer, {
    publicOnly: !!options.publicOnly,
    }),
  ]
    .map((entry) => `${entry ?? ""}`.trim())
    .filter(Boolean)
    .filter((entry, index, arr) => arr.indexOf(entry) === index)
    .slice(0, options.limit ?? 2);
  const hasEvidence = summaries.length > 0;
  const fallback =
    options.fallback ??
    (options.publicOnly
      ? "低证据判断：目前只有公开发言节奏和场上位置，没有可公开引用的硬证据"
      : "低证据判断：目前主要是发言姿态和场上位置，还没有硬证据");
  const text = hasEvidence ? summaries.join("；") : fallback;
  const spokenText = hasEvidence ? playerStyleEvidenceSummary(summaries, { fallback }) : "公开信息还不够，先听回应和票型";
  return {
    summaries,
    text,
    spokenText,
    hasEvidence,
    lowEvidence: !hasEvidence,
    publicOnly: !!options.publicOnly,
    graphPressure,
    graphChains,
  };
}

function playerStyleEvidenceSummary(summaries = [], options = {}) {
  const compact = [];
  const add = (value) => {
    const text = `${value ?? ""}`.trim();
    if (text && !compact.includes(text)) {
      compact.push(text);
    }
  };
  (summaries ?? []).forEach((summary) => {
    const text = `${summary ?? ""}`;
    if (/撞车|撞了|多人.*声称|同一角色/.test(text)) {
      add("身份撞车");
    } else if (/对不上|验证成|声称.*验证/.test(text)) {
      add("身份对不上");
    } else if (/被公开验证|验证过/.test(text)) {
      add("身份被验过");
    } else if (/维护.*高压|高压目标|帮.*卸压/.test(text)) {
      add("在保高压位");
    } else if (/推动.*低证据|低证据位/.test(text)) {
      add("在推低证据位");
    } else if (/投票.*相反|票型.*反|反票/.test(text)) {
      add("票型反着走");
    } else if (/夜间信息|夜信|污染/.test(text)) {
      add(/污染|风险|可能/.test(text) ? "夜信可能脏" : "夜信牵到这里");
    } else if (/可信度.*下降|可信度偏低|来源.*复核/.test(text)) {
      add("来源不稳");
    } else if (/公开身份口径|私聊身份口径|报过身份/.test(text)) {
      add("身份要对");
    } else if (/提名记录|提名压力/.test(text)) {
      add("被推上台面");
    } else if (/公聊|发言/.test(text)) {
      add("发言要回看");
    } else if (/个人证据/.test(text)) {
      add("手里有线索");
    } else {
      add(shortReasonText(text, 12));
    }
  });
  if (compact.length === 0) {
    return shortReasonText(options.fallback ?? "低证据，先问反应", 18);
  }
  return compact.slice(0, 2).join("、");
}

function ensureEvidenceContractInText(text, evidenceContract, options = {}) {
  const value = `${text ?? ""}`.trim();
  if (!evidenceContract?.text) {
    return value;
  }
  const quoted = evidenceContract.summaries.length > 0 ? evidenceContract.summaries : [evidenceContract.text];
  const spoken = evidenceContract.spokenText ?? "";
  if (quoted.some((entry) => entry && value.includes(entry)) || (spoken && value.includes(spoken))) {
    return value;
  }
  const label = options.label ?? (evidenceContract.lowEvidence ? "这条还弱" : "我现在抓的点");
  const evidenceText = options.useFullText ? evidenceContract.text : spoken || evidenceContract.text;
  return `${value} ${label}：${evidenceText}。`;
}

function buildGraphFollowUpPrompts(state, aiPlayer, focusPlayer, evidenceContract, options = {}) {
  if (!focusPlayer) {
    return [];
  }
  const chains = evidenceContract?.graphChains ?? [];
  const prompts = [];
  chains.forEach((chain) => {
    if (chain.type === "false-claim-chain" || chain.type === "verified-claim-chain") {
      prompts.push(`追问 ${focusPlayer.name}：为什么身份口径和后续验证链能对上/对不上？`);
    } else if (chain.type === "role-conflict-chain") {
      prompts.push(`追问 ${focusPlayer.name}：撞身份时谁先报、谁补口径、谁愿意接受验证？`);
    } else if (chain.type === "public-defense-chain") {
      prompts.push(`追问 ${focusPlayer.name}：为什么要维护那条高压位，依据来自哪条公开信息？`);
    } else if (chain.type === "public-accuse-chain") {
      prompts.push(`追问 ${focusPlayer.name}：为什么要推动低证据位，是信息判断还是转移焦点？`);
    } else if (chain.type === "night-info-chain") {
      prompts.push(`追问 ${focusPlayer.name}：这条夜间信息链能不能和公开身份口径互相验证？`);
    } else if (chain.type === "low-source-trust-chain") {
      prompts.push(`追问 ${focusPlayer.name}：之前哪条口径可以被其他人复核？`);
    }
  });

  if (prompts.length === 0 && evidenceContract?.lowEvidence) {
    prompts.push(`追问 ${focusPlayer.name}：先给身份范围，再给一条能被别人复核的信息。`);
  }

  const limit = options.limit ?? 2;
  return [...new Set(prompts)].slice(0, limit);
}

function directAnswerForPrivateQuestion(state, aiPlayer, human, analysis, context = {}) {
  const focus = context.focus;
  const focusPlayer = focus?.player ?? null;
  const focusText = context.focusText ?? (focusPlayer ? formatFocus(focusPlayer, focus.score, false) : "这条线");
  const shortReason = context.shortReason ?? "证据还不硬";
  const trustLine = context.trustLine ?? "";
  const followUp = context.followUpText ?? "把身份和信息说完整";
  const numericMode = !!context.numericMode;

  switch (analysis?.intent) {
    case QUESTION_INTENT.REASON:
      return `先给结论：我现在更盯 ${focusText}，主要因为 ${shortReason}。`;
    case QUESTION_INTENT.TRUST:
      return `先说你这边：${trustLine || "你在我这里还没定性"} 我不会只凭一句话定你。`;
    case QUESTION_INTENT.CLAIM:
      return "身份可以聊，但现在先不一次说满。";
    case QUESTION_INTENT.VOTE:
      return focusPlayer
        ? `如果提 ${focusPlayer.name}，我会认真考虑跟票，但先听回应。`
        : "现在还没到闭眼投票，我会先看提名对象的回应。";
    case QUESTION_INTENT.NIGHT:
      return focusPlayer
        ? `夜里信息不能单独盘，我会和白天的 ${focusPlayer.name} 这条线合起来看。`
        : "夜里信息只能当线索，不能直接当结论。";
    case QUESTION_INTENT.COMPARE: {
      const compared = (analysis.mentionedPlayers ?? [])
        .filter((entry) => entry.id !== human?.id && entry.id !== aiPlayer?.id)
        .slice(0, 2);
      if (compared.length >= 2) {
        const a = compared[0];
        const b = compared[1];
        const aScore = aiPlayer?.suspicion?.[a.id] ?? 0.5;
        const bScore = aiPlayer?.suspicion?.[b.id] ?? 0.5;
        const high = aScore >= bScore ? a : b;
        const low = aScore >= bScore ? b : a;
        return numericMode
          ? `两者里我先追 ${high.name}，风险大概 ${Math.round(Math.max(aScore, bScore) * 100)}%，${low.name} 放第二。`
          : `两者里我先追 ${high.name}，${low.name} 暂时放第二。`;
      }
      return `我现在第一关注还是 ${focusText}。`;
    }
    case QUESTION_INTENT.PLAN:
      return focusPlayer
        ? `下一步先问 ${focusPlayer.name}，重点问 ${followUp}。`
        : "下一步先逼明确口径，再看要不要进提名。";
    case QUESTION_INTENT.SUSPECT:
    case QUESTION_INTENT.GENERIC:
    default:
      return `我当前第一关注是 ${focusText}，但这还不是铁证。`;
  }
}

function privateAnswerAlignmentPattern(intent) {
  switch (intent) {
    case QUESTION_INTENT.REASON:
      return /因为|理由|主要|证据|对不上|提到|卡点|这条|站队|信息|公开/;
    case QUESTION_INTENT.TRUST:
      return /你在我这里|信任|相信|放下|风险|偏好|中间位|不信/;
    case QUESTION_INTENT.CLAIM:
      return /身份|我是|口径|范围|私下报|真实身份|台面上|不把身份/;
    case QUESTION_INTENT.VOTE:
      return /如果提|跟票|赞成|反对|回应补不上/;
    case QUESTION_INTENT.NIGHT:
      return /昨晚|昨夜|夜里|夜间|夜晚|信息|没有能.*信息|能安全说/;
    case QUESTION_INTENT.COMPARE:
      return /更|比|先追|放第二|两者里|相比/;
    case QUESTION_INTENT.PLAN:
      return /下一步|建议|计划|先问|先把|今天|公聊|提名/;
    case QUESTION_INTENT.SUSPECT:
      return /怀疑|可疑|最想追|第一关注|先看|先盯|盯/;
    default:
      return null;
  }
}

function privateAnswerAlignmentContext(state, aiPlayer, human, analysis, composed) {
  const focusPlayer = composed?.focusId ? getPlayerById(state, composed.focusId) : null;
  const focusScore = Number.isFinite(composed?.focusScore) ? composed.focusScore : aiPlayer?.suspicion?.[focusPlayer?.id] ?? 0.5;
  const focus = focusPlayer ? { player: focusPlayer, score: focusScore } : null;
  const trustScore = aiPlayer?.suspicion?.[human?.id] ?? 0.5;
  const trustLine =
    trustScore >= 0.62
      ? "你在我这里还不能完全放下。"
      : trustScore <= 0.35
      ? "你在我这里暂时偏好。"
      : "你在我这里是中间位。";
  return {
    focus,
    focusText: focusPlayer ? formatFocus(focusPlayer, focusScore, false) : "这条线",
    shortReason: shortReasonText(composed?.evidenceContract?.spokenText || composed?.evidenceContract?.text || ""),
    trustLine,
    followUpText: composed?.followUpPrompts?.[0]?.replace(/^追问\s+[^：]+：/, "") || "把身份和信息说完整",
    numericMode: false,
  };
}

function ensurePrivateAnswerAlignment(state, aiPlayer, human, analysis, composed) {
  const response = `${composed?.response ?? ""}`.trim();
  if (!response) {
    return composed;
  }
  const intent = analysis?.intent ?? QUESTION_INTENT.GENERIC;
  const pattern = privateAnswerAlignmentPattern(intent);
  if (!pattern || pattern.test(response)) {
    return composed;
  }
  const direct = directAnswerForPrivateQuestion(
    state,
    aiPlayer,
    human,
    analysis,
    privateAnswerAlignmentContext(state, aiPlayer, human, analysis, composed)
  );
  if (!direct || response.includes(direct)) {
    return composed;
  }
  const sameEvilTeam = areKnownAllies(state, aiPlayer, human);
  return {
    ...composed,
    response: applySpeechBudget(joinSpeechFragments([direct, response]), {
      audience: "private",
      maxSentences: sameEvilTeam ? 5 : [QUESTION_INTENT.CLAIM, QUESTION_INTENT.VOTE, QUESTION_INTENT.REASON, QUESTION_INTENT.PLAN].includes(intent) ? 4 : 3,
      maxChars: sameEvilTeam ? 320 : [QUESTION_INTENT.CLAIM, QUESTION_INTENT.VOTE, QUESTION_INTENT.REASON, QUESTION_INTENT.PLAN].includes(intent) ? 240 : 200,
    }),
  };
}

function followUpQuestionForPrivateAnswer(analysis, context = {}) {
  const targetName = context.focus?.player?.name ?? "这个位置";
  const followUp = context.followUpText ?? "把身份和信息说完整";
  if ([QUESTION_INTENT.REASON, QUESTION_INTENT.SUSPECT, QUESTION_INTENT.GENERIC].includes(analysis?.intent)) {
    return `我会反问一句：${targetName}，你能把 ${followUp} 讲清楚吗？`;
  }
  if (analysis?.intent === QUESTION_INTENT.PLAN) {
    return `我下一问会很具体：${targetName}，${followUp}。`;
  }
  if (analysis?.intent === QUESTION_INTENT.VOTE) {
    return `票前我会问：${targetName} 的回应有没有补上这个缺口？`;
  }
  return "";
}

function normalizeSurfaceEvidence(text, targetName = "这个位置") {
  let value = `${text ?? ""}`.replace(/\s+/g, " ").trim();
  if (!value) {
    return "这条还只是追问入口";
  }
  value = value
    .replace(/该玩家/g, targetName)
    .replace(/我自己的夜间信息牵到\s*([0-9]+)\s*号/g, "夜里那条信息让我先看 $1号")
    .replace(/我自己的夜间信息指向\s*([0-9]+)\s*号/g, "夜里那条信息让我先看 $1号")
    .replace(/让他把身份和信息讲完整/g, "身份和信息能不能连起来")
    .replace(/可信度有限，需要复核/g, "先复核")
    .replace(/可信度较低，可能被醉酒\/中毒或私聊口径污染/g, "先打折听")
    .replace(/\s+。/g, "。")
    .trim();
  return value;
}

function surfaceFollowUpForAct(act) {
  const targetName = act.targetName ?? "这个位置";
  if (act.evidenceKind === "night-info") {
    return `我会让 ${targetName} 把身份和信息连起来说。`;
  }
  if (act.evidenceKind === "private-rumor") {
    return `先让 ${targetName} 把自己的口径补完整。`;
  }
  if (act.intent === QUESTION_INTENT.VOTE) {
    return `${targetName} 回应补不上，我才会认真考虑跟票。`;
  }
  return `你可以先让 ${targetName} 把身份范围和信息来源说清楚。`;
}

function evidenceKindForSurface(evidenceContract) {
  const text = `${evidenceContract?.text ?? ""} ${evidenceContract?.spokenText ?? ""}`;
  if (/夜间信息|夜信|夜里那条信息|夜里/.test(text)) {
    return "night-info";
  }
  if (/私下|私聊|有人私下/.test(text)) {
    return "private-rumor";
  }
  if (/公聊|发言/.test(text)) {
    return "public-talk";
  }
  if (/身份|口径/.test(text)) {
    return "claim";
  }
  return "generic";
}

function buildPrivateSurfaceAct(state, aiPlayer, analysis, context = {}) {
  const focus = context.focus;
  if (!focus?.player) {
    return null;
  }
  const evidenceContract = context.evidenceContract ?? null;
  const publicName = `${focus.player.name ?? ""}`.trim();
  const targetName =
    focus.player.isHuman || publicName === "你" ? `${focus.player.seatIndex + 1}号` : publicName || "这个位置";
  const evidenceText = normalizeSurfaceEvidence(
    evidenceContract?.summaries?.[0] || evidenceContract?.spokenText || evidenceContract?.text || context.evidenceText,
    targetName
  );
  const previousFocusName = context.memory?.lastFocusId
    ? statementTargetLabel(state, context.memory.lastFocusId)
    : "";
  const sameFocus = !!context.memory?.lastFocusId && context.memory.lastFocusId === focus.player.id;
  const explicitSwitch = !!context.explicitMention && !!previousFocusName && previousFocusName !== targetName;
  return {
    audience: "private",
    actKind: privateSurfaceActKind(analysis?.intent ?? QUESTION_INTENT.GENERIC),
    intent: analysis?.intent ?? QUESTION_INTENT.GENERIC,
    persona: aiPlayer?.aiPersona ?? PERSONA_TYPES.STEADY,
    targetName,
    secondName: context.second?.player ? statementTargetLabel(state, context.second.player.id) : "",
    previousFocusName,
    sameFocus,
    explicitSwitch,
    evidenceText,
    evidenceKind: evidenceKindForSurface(evidenceContract),
    questionToAsk: context.thoughtFrame?.questionToAsk ?? "",
    followUpText: context.followUpText ?? "",
    trustLine: context.trustLine ?? "",
    lowEvidence: !!evidenceContract?.lowEvidence,
    focusScore: focus.score ?? 0.5,
    claimAsked: analysis?.intent === QUESTION_INTENT.CLAIM,
  };
}

function privateSurfaceActKind(intent) {
  if (intent === QUESTION_INTENT.TRUST) {
    return "trust-check";
  }
  if (intent === QUESTION_INTENT.VOTE) {
    return "vote-stance";
  }
  if (intent === QUESTION_INTENT.PLAN) {
    return "action-plan";
  }
  if (intent === QUESTION_INTENT.COMPARE) {
    return "compare-targets";
  }
  if (intent === QUESTION_INTENT.REASON || intent === QUESTION_INTENT.SUSPECT) {
    return "explain-pressure";
  }
  return "table-read";
}

function surfaceSentence(text) {
  const value = `${text ?? ""}`.trim();
  if (!value) {
    return "";
  }
  return /[。！？]$/.test(value) ? value : `${value}。`;
}

function renderPrivateSurfaceAct(act, rng = Math.random) {
  if (!act || act.claimAsked || act.intent === QUESTION_INTENT.NIGHT) {
    return "";
  }
  const targetName = act.targetName;
  const evidence = act.evidenceText;
  const followUp = surfaceFollowUpForAct(act);
  const thoughtFollowUp = act.questionToAsk ? `下一句我会问${compactThoughtQuestionText(act.questionToAsk)}。` : "";
  const followUpLine = surfaceSentence(thoughtFollowUp || act.followUpText || followUp);
  const opener = act.explicitSwitch
    ? `${act.previousFocusName} 那条暂放一边，你问到 ${targetName}，我就单看 ${targetName}。`
    : act.sameFocus
    ? `我暂时不换目标，还是先看 ${targetName}。`
    : act.persona === PERSONA_TYPES.PRESSURE
    ? `我先直接压 ${targetName}。`
    : act.persona === PERSONA_TYPES.SHADOW
    ? `${targetName} 我先暗记一笔。`
    : `我先不把话说死，先看 ${targetName}。`;

  if (act.actKind === "trust-check") {
    const trust = act.trustLine || "你这边我先放中间。";
    return `${trust} 但桌上更该先问 ${targetName}：${evidence}。${followUpLine}`;
  }
  if (act.intent === QUESTION_INTENT.VOTE) {
    return `如果提 ${targetName}，我会先看回应。${evidence}。${followUpLine}`;
  }
  if (act.intent === QUESTION_INTENT.PLAN) {
    return `下一步先问 ${targetName}。${evidence}。${followUpLine}`;
  }
  if (act.intent === QUESTION_INTENT.COMPARE) {
    const second = act.secondName ? `${act.secondName} 先排后面。` : "另一条线先排后面。";
    return `${targetName} 先级更高。${evidence}。${second}`;
  }
  if (act.evidenceKind === "night-info") {
    return `${opener}${evidence}，但这条不能单独定死。${followUpLine}`;
  }
  if (act.lowEvidence && rng() < 0.5) {
    return `${opener}${evidence}，还不够拍死。${followUpLine}`;
  }
  return `${opener}${evidence}。${followUpLine}`;
}

function buildPublicSurfaceAct(state, aiPlayer, context = {}) {
  const focus = context.focus;
  if (!focus?.player) {
    return null;
  }
  const evidenceContract = context.evidenceContract ?? null;
  const publicName = `${focus.player.name ?? ""}`.trim();
  const targetName =
    focus.player.isHuman || publicName === "你" ? `${focus.player.seatIndex + 1}号` : publicName || "这个位置";
  const evidenceText = normalizeSurfaceEvidence(
    evidenceContract?.summaries?.[0] || evidenceContract?.spokenText || evidenceContract?.text || context.reasonText,
    targetName
  );
  return {
    audience: "public",
    actKind: publicSurfaceActKind(context.debateBeat ?? "opening", context.thoughtFrame?.intendedAct ?? "", !!context.disclosureLine),
    persona: aiPlayer?.aiPersona ?? PERSONA_TYPES.STEADY,
    team: aiPlayer?.team ?? "",
    targetName,
    secondName: context.second?.player?.name ?? "",
    debateBeat: context.debateBeat ?? "opening",
    evidenceText,
    evidenceKind: evidenceKindForSurface(evidenceContract),
    questionToAsk: context.thoughtFrame?.questionToAsk ?? "",
    lowEvidence: !!evidenceContract?.lowEvidence,
    focusScore: focus.score ?? 0.5,
    hardPress: !!context.hardPress,
    disclosureLine: context.disclosureLine ?? "",
    deadClaimLine: context.deadClaimLine ?? "",
  };
}

function publicSurfaceActKind(debateBeat, intendedAct, hasDisclosure) {
  if (hasDisclosure || intendedAct === "claim" || intendedAct === "claim_range") {
    return "public-claim";
  }
  if (debateBeat === "defense") {
    return "reply";
  }
  if (debateBeat === "nomination-pressure" || intendedAct === "nominate") {
    return "nomination-pressure";
  }
  if (debateBeat === "vote-intent") {
    return "vote-stance";
  }
  if (intendedAct === "pressure") {
    return "pressure";
  }
  if (intendedAct === "probe") {
    return "probe";
  }
  return "table-read";
}

function compactThoughtQuestionText(questionToAsk) {
  const raw = `${questionToAsk ?? ""}`.replace(/\s+/g, " ").trim();
  const match = raw.match(/^让\s+(.+?)\s*把身份和昨晚信息说清楚$/);
  if (match) {
    return `${match[1].trim()}：身份和昨晚信息`;
  }
  if (/^你\s*把身份和昨晚信息说清楚$/.test(raw)) {
    return "你：身份和昨晚信息";
  }
  return raw.replace(/^问\s+/, "").trim();
}

function compactSentenceCount(text) {
  return `${text ?? ""}`.match(/[^。！？；]+[。！？；]?/gu)?.filter((entry) => entry.trim()).length ?? 0;
}

function appendPublicThoughtQuestion(line, thoughtFrame, maxChars = 190) {
  const compactQuestion = compactThoughtQuestionText(thoughtFrame?.questionToAsk);
  if (!compactQuestion || `${line ?? ""}`.includes(compactQuestion) || `${line ?? ""}`.includes("接下来先问")) {
    return `${line ?? ""}`.trim();
  }
  if (
    !["pressure", "probe", "hold", "nominate"].includes(thoughtFrame?.intendedAct ?? "") ||
    (compactSentenceCount(line) >= 2 && `${line ?? ""}`.length > 105)
  ) {
    return `${line ?? ""}`.trim();
  }
  const suffix = `接下来先问${compactQuestion}。`;
  const value = `${line ?? ""}`.trim();
  if (!value) {
    return suffix.trim();
  }
  if (value.length + suffix.length <= maxChars) {
    return /[。！？]$/.test(value)
      ? value.replace(/[。！？]$/, `，${suffix}`)
      : `${value}，${suffix}`;
  }
  const head = value.slice(0, Math.max(0, maxChars - suffix.length - 2)).replace(/[。！？；，、\s]+$/u, "").trim();
  return `${head}，${suffix}`;
}

function renderPublicSurfaceAct(act, rng = Math.random) {
  if (!act) {
    return "";
  }
  const targetName = act.targetName;
  const evidence = act.evidenceText;
  const intro = act.deadClaimLine || act.disclosureLine || "";
  let main = "";
  if (act.debateBeat === "defense") {
    main = `我先回应一下：不是要带节奏，我只是觉得 ${targetName} 这边还缺解释。${evidence}。`;
  } else if (act.debateBeat === "nomination-pressure") {
    main = `${targetName} 可以进提名池，但我先听一句回应。${evidence}。`;
  } else if (act.debateBeat === "vote-intent") {
    main = `如果今天提 ${targetName}，我会看他的解释质量，不是闭眼跟。${evidence}。`;
  } else if (act.hardPress || act.persona === PERSONA_TYPES.PRESSURE) {
    main = `我先压 ${targetName}。${evidence}，先听回应。`;
  } else if (act.persona === PERSONA_TYPES.SHADOW) {
    main = `${targetName} 我先记一笔。${evidence}，还没到拍死。`;
  } else if (act.lowEvidence) {
    main = `${targetName} 这条先当追问入口，不当定罪。${evidence}。`;
  } else {
    main = `我先看 ${targetName}。${evidence}。`;
  }
  const second = act.secondName && act.debateBeat !== "vote-intent" ? `${act.secondName} 先排第二。` : "";
  return joinSpeechFragments([intro, main, second]);
}

function sanitizePublicSurfaceEvidence(text, targetName) {
  return `${text ?? ""}`
    .replace(/\.{3,}/g, "…")
    .replace(/我接一下前面的发言：我先回应一下：不是要带节奏，我只是觉得\s*([0-9]+号|[^，。；！？\s]+)\s*这边还缺解释/g, "$1 这边还缺解释")
    .replace(/我接一下前面的发言：如果今天提/g, "如果今天提")
    .replace(/我接一下前面的发言：/g, "")
    .replace(/接前面一句：/g, "")
    .replace(/先回应前面的质疑/g, "先回应这点")
    .replace(/我先回应一下：不是要带节奏，我只是觉得\s*/g, "")
    .replace(/低证据判断：目前只有公开发言节奏和场上位置，没有可公开引用的硬证据/g, "公开信息还不够，先听回应和票型")
    .replace(/低证据判断：目前主要是发言姿态和场上位置，还没有硬证据/g, "公开信息还不够，先听回应和票型")
    .replace(/这条还弱：低证…（先复核）/g, "公开信息还不够，先听回应")
    .replace(/这条还弱：低…（先复核）/g, "公开信息还不够，先听回应")
    .replace(/\b你\s+(?=可以|这边|这条|我先|的解释)/g, `${targetName} `)
    .replace(/围着\s+你\s+/g, `围着 ${targetName} `)
    .replace(/看\s+你\s+的解释/g, `看 ${targetName} 的解释`)
    .trim();
}

function renderPublicSurfaceActReadable(act) {
  if (!act) {
    return "";
  }
  const targetName = act.targetName;
  const evidence = sanitizePublicSurfaceEvidence(act.evidenceText, targetName);
  const intro = act.deadClaimLine || act.disclosureLine || "";
  const compactQuestion = compactThoughtQuestionText(act.questionToAsk);
  const thoughtQuestion = compactQuestion ? `我会问${compactQuestion}` : "";
  let main = "";
  if (intro && act.debateBeat === "nomination-pressure") {
    main = `${targetName} 可以进提名池，卡在 ${evidence}。`;
  } else if (intro && act.debateBeat === "vote-intent") {
    main = `如果今天提 ${targetName}，我会看解释和票型，卡在 ${evidence}。`;
  } else if (intro && act.actKind === "public-claim") {
    main = act.lowEvidence
      ? `${act.targetName} 这条先当观察位，公开信息还不够。`
      : `${act.targetName} 这条先留桌面上，卡在 ${evidence}。`;
  } else if (act.team === "evil" && act.debateBeat === "nomination-pressure") {
    main = `台面上我先把 ${targetName} 放进提名前复核。${evidence}，先听回应。`;
  } else if (act.team === "evil" && act.debateBeat === "vote-intent") {
    main = `公开说，如果今天提 ${targetName}，我看解释和票型再跟。${evidence}。`;
  } else if (act.team === "evil" && act.debateBeat !== "defense") {
    main = `台面上我先看 ${targetName}。${evidence}，先别闭眼冲。`;
  } else if (act.actKind === "reply") {
    main = `${targetName} 这边还缺解释，先回应这点。${evidence}。`;
  } else if (act.actKind === "nomination-pressure") {
    main = `${targetName} 可以进提名池，但我先听一句回应。${evidence}。`;
  } else if (act.actKind === "vote-stance") {
    main = `如果今天提 ${targetName}，我会看他的解释质量，不是闭眼跟。${evidence}。`;
  } else if (act.actKind === "pressure" || act.hardPress || act.persona === PERSONA_TYPES.PRESSURE) {
    main = `我先压 ${targetName}。${evidence}，先听回应。`;
  } else if (act.actKind === "probe" && act.persona === PERSONA_TYPES.SHADOW) {
    main = `${targetName} 我先暗记一笔。${evidence}，还没到拍死。`;
  } else if (act.lowEvidence) {
    main = `${targetName} 这条先当追问入口，不当定罪。${evidence}。`;
  } else {
    main = `我先看 ${targetName}。${evidence}。`;
  }
  const shouldInlineQuestion =
    thoughtQuestion &&
    ["opening", "defense", "nomination-pressure", "vote-intent"].includes(act.debateBeat) &&
    main.length < 130;
  if (shouldInlineQuestion) {
    main = /[。！？]$/.test(main)
      ? main.replace(/[。！？]$/, `，${thoughtQuestion}。`)
      : `${main}，${thoughtQuestion}。`;
  }
  const second =
    !shouldInlineQuestion && act.secondName && act.debateBeat !== "vote-intent"
      ? `${act.secondName} 先排第二。`
      : "";
  return joinSpeechFragments([intro, main, second]);
}

function pragmaticPressureContext(state, aiPlayer, options = {}) {
  const focusScore = Number.isFinite(options.focusScore) ? options.focusScore : 0.5;
  const selfHeat = Number.isFinite(aiPlayer?.suspicion?.[aiPlayer.id]) ? aiPlayer.suspicion[aiPlayer.id] : 0.01;
  return {
    audience: options.audience ?? "private",
    intent: options.intent ?? "",
    focusId: options.focusId ?? null,
    focusScore,
    selfHeat,
    lowEvidence: !!options.lowEvidence,
    dayStage: state?.dayStage ?? "",
    day: Math.max(1, Number(state?.day) || 1),
    alive: aiPlayer?.alive !== false,
    selfNominated: !!aiPlayer?.beenNominatedToday,
    hasNominated: !!aiPlayer?.nominatedToday,
  };
}

function pragmaticLineForSpeech(state, aiPlayer, options = {}) {
  const ctx = pragmaticPressureContext(state, aiPlayer, options);
  if (!aiPlayer) {
    return "";
  }
  if (!ctx.alive) {
    return ctx.audience === "public"
      ? "我已经死了，发言会短一点；别把这句当硬证，只当线索。"
      : "我已经出局了，所以这句你当遗言线索听，别当铁证。";
  }
  if (ctx.selfNominated) {
    return "我现在在台上，先不绕：我会把能验证的部分说清，票型你们自己看。";
  }
  if (ctx.selfHeat >= 0.62) {
    return ctx.audience === "public"
      ? "我知道我自己也有压力，所以先把逻辑摆出来，不靠情绪硬带。"
      : "我知道你可能也在审我，所以我先给能被复核的说法。";
  }
  if (ctx.dayStage === "nomination") {
    return "已经到提名段了，我会说可执行版本，不再铺太长。";
  }
  if (ctx.day >= 3 && ctx.audience === "public") {
    return "到这个天数就别只留感觉了，我说结论，也留可验点。";
  }
  if (ctx.focusScore >= 0.72) {
    return "这条我不是轻轻记一笔了，是需要马上听回应。";
  }
  if (ctx.lowEvidence) {
    return "这条证据还弱，我先当追问入口，不当定罪。";
  }
  return "";
}

function applyInGamePragmatics(state, aiPlayer, text, options = {}) {
  const value = `${text ?? ""}`.trim();
  if (!value) {
    return value;
  }
  const line = pragmaticLineForSpeech(state, aiPlayer, options);
  if (!line || value.includes(line)) {
    return value;
  }
  return `${line} ${value}`;
}

function composePrivateClaimPolicy(state, aiPlayer, human, memory, rng = Math.random) {
  ensureAIFields(aiPlayer);
  const perceivedRole = perceivedRoleForPlayer(state, aiPlayer) ?? roleForPlayer(state, aiPlayer);
  const actualRole = roleForPlayer(state, aiPlayer);
  const persona = aiPlayer.aiPersona ?? PERSONA_TYPES.STEADY;
  const day = Math.max(1, Number(state.day) || 1);
  const askedCount = Number(memory.claimAskedCount ?? 0);
  const humanRisk = aiPlayer.suspicion?.[human.id] ?? 0.5;
  const selfHeat = aiPlayer.suspicion?.[aiPlayer.id] ?? 0.5;
  const pressured = selfHeat >= 0.62 || askedCount >= 2 || day >= 3 || !aiPlayer.alive;
  const disclosurePlan = claimDisclosurePlanner(state, aiPlayer, human, rng, {
    private: true,
    audience: "private",
    intent: "claim",
    askedCount,
    trustScore: humanRisk,
  });

  if (!aiPlayer.alive) {
    const roleId = claimRoleForContext(state, aiPlayer, human, rng, { private: true, force: true });
    const roleName = roleNameById(state, roleId || perceivedRole?.id || actualRole?.id);
    return `我已经死了，继续藏身份收益不高。我私下先报：我是 ${roleName}。`;
  }

  if (aiPlayer.team === "evil") {
    const roleId = claimRoleForContext(state, aiPlayer, human, rng, { private: true, force: pressured || day >= 2 });
    const roleName = roleNameById(state, roleId || aiPlayer.publicClaimRoleId || perceivedRole?.id);
    return renderDialogueActs(
      state,
      aiPlayer,
      pressured ? "claimCoverPressured" : "claimCover",
      { roleName },
      rng,
      pressured
        ? [`你既然追到身份，我给完整口径：我是 ${roleName}。这条先别急着公开，让我看一圈反应。`]
        : [`身份我先不给死，只给你口径范围：我会往 ${roleName} 这类好人位上靠。先别替我公开。`],
      { audience: "private", evilPerformance: true }
    );
  }

  if (pressured) {
    const roleId = claimRoleForContext(state, aiPlayer, human, rng, { private: true, force: true, roleId: perceivedRole?.id });
    const roleName = roleNameById(state, roleId || perceivedRole?.id || actualRole?.id);
    return `压力到这个份上我不躲了：我私下报 ${roleName}。如果你要带出去，最好连我的信息链一起带。`;
  }

  if (disclosurePlan.previousLevel === "range" || disclosurePlan.level === "range") {
    rememberClaimDisclosure(state, aiPlayer, disclosurePlan, human, { private: true, audience: "private" });
    const lead = disclosurePlan.previousLevel === "range" ? "刚才已经给过范围：" : "我先给范围：";
    return `${lead}${disclosurePlan.rangeText} 具体身份先不摊死，除非今天真的推到这个位置。`;
  }

  if (disclosurePlan.previousLevel === "hard" || disclosurePlan.level === "hard") {
    const roleId = claimRoleForContext(state, aiPlayer, human, rng, { private: true, force: true, roleId: disclosurePlan.roleId || perceivedRole?.id });
    const roleName = roleNameById(state, roleId || disclosurePlan.roleId || perceivedRole?.id || actualRole?.id);
    return `这条我不改：我是 ${roleName}。你可以按这个身份继续问我的信息。`;
  }

  if (humanRisk >= 0.66 && day <= 2) {
    return "你在我这里还没完全放下，我现在不把身份交死。可以先记：我不是想混水的空白位。";
  }

  if (day <= 1 && isLikelyEarlyInfoRole(perceivedRole)) {
    return pickPersonaTemplate(persona, "claimDeflect", {}, rng, [
      `${claimRangeForRole(perceivedRole)}我可以先聊信息结论，身份先不裸。`,
    ]);
  }

  if (day <= 1 && rng() < 0.55) {
    return pickPersonaTemplate(persona, "claimDeflect", {}, rng, [claimRangeForRole(perceivedRole)]);
  }

  const roleId = claimRoleForContext(state, aiPlayer, human, rng, { private: true, force: true, roleId: perceivedRole?.id });
  const roleName = roleNameById(state, roleId || perceivedRole?.id || actualRole?.id);
  return `我可以私下跟你说，我是 ${roleName}。先别替我在公聊里摊开。`;
}

function composePrivateClaimAnswer(state, aiPlayer, human, memory, rng = Math.random) {
  memory.claimAskedCount = Number(memory.claimAskedCount ?? 0) + 1;
  const continuity =
    memory.turns > 0 && aiPlayer.publicClaimRoleId
      ? `身份口径我不改，还是 ${roleNameById(state, aiPlayer.publicClaimRoleId)}。`
      : "";
  const claimSentence =
    composePrivateClaimPolicy(state, aiPlayer, human, memory, rng) ||
    maybePrivateClaim(state, aiPlayer, human, rng) ||
    "身份我现在不想直接裸跳。你可以先记我不是空白位；如果今天真的要推我，我会补完整口径。";
  const follow =
    aiPlayer.publicClaimRoleId
      ? `这局我目前的身份说法先按 ${roleNameById(state, aiPlayer.publicClaimRoleId)} 记，不会无理由改口。`
      : "这条先当私下口径，别直接替我公开。";
  return joinSpeechFragments([continuity, claimSentence, follow]);
}

function latestInfoPingForPlayer(state, aiPlayer) {
  return (state.events?.infoPings ?? [])
    .filter((entry) => entry.actorId === aiPlayer?.id)
    .slice(-1)[0] ?? null;
}

function exactPrivateNightInfoLine(note) {
  const text = humanizeSharedPrivateNote(note);
  return text ? `我昨晚能说的是：${text}。` : "";
}

function compactNightInfoText(note) {
  return humanizeSharedPrivateNote(note)
    .replace(/^我(?=昨晚|夜里|查验|得知|看到|获得|临终)/, "")
    .trim();
}

function privateQuestionAsksForInfoFormat(text) {
  return /(对得上|能对上|可验证|能验证|硬信息|查谁|看谁|目标|结果|昨晚.*信息|夜里.*信息|夜间.*信息|拿到.*信息)/.test(
    `${text ?? ""}`
  );
}

function privateQuestionAsksIdentityOnly(text) {
  return /(身份|角色|你是|报身份|跳身份|claim|role|identity)/i.test(`${text ?? ""}`) && !privateQuestionAsksForInfoFormat(text);
}

function shouldRoutePrivateQuestionToNightInfo(analysis, questionText) {
  if (analysis?.intent === QUESTION_INTENT.NIGHT) {
    return true;
  }
  if (privateQuestionAsksIdentityOnly(questionText)) {
    return false;
  }
  return privateQuestionAsksForInfoFormat(questionText);
}

function shouldForceExactNightInfo(questionText, askedCount) {
  return (
    Number(askedCount ?? 0) >= 2 ||
    /(具体|全报|摊开|查谁|看谁|目标|结果|直接说|别绕|不要绕)/.test(`${questionText ?? ""}`)
  );
}

function nightInfoFormatHintForPlan(plan, role) {
  const roleId = role?.id ?? plan?.roleId ?? "";
  const family = plan?.family ?? "";
  if (roleId === "fortune-teller" || family === "demon-check") {
    return "每晚看两个人，得到一个“是/否”结果。";
  }
  if (["washerwoman", "librarian", "investigator"].includes(roleId) || family === "two-player-role") {
    return "两个人里有一个对应某个身份或类型。";
  }
  if (roleId === "empath" || family === "adjacent-info") {
    return "看左右两侧存活邻居里有几个邪恶。";
  }
  if (roleId === "chef" || family === "adjacent-pair-count") {
    return "看场上有几对相邻邪恶玩家。";
  }
  if (roleId === "undertaker" || family === "execution-reveal") {
    return "看当天被处决玩家的身份。";
  }
  if (roleId === "ravenkeeper" || family === "death-check") {
    return "我死亡后可以查一个人的身份。";
  }
  if (roleId === "dreamer" || family === "two-role-check") {
    return "每天看一个人，得到两个可能身份。";
  }
  if (roleId === "savant" || family === "statement-info") {
    return "每天拿两条说法，一真一假。";
  }
  if (roleId === "clockmaker" || family === "distance-info") {
    return "看恶魔和爪牙之间隔了几步。";
  }
  return "";
}

function formatOnlyNightInfoLine(state, aiPlayer, plan, ping) {
  const role = perceivedRoleForPlayer(state, aiPlayer) ?? roleForPlayer(state, aiPlayer);
  const hint = nightInfoFormatHintForPlan(plan, role);
  const polluted = ping?.polluted ? "这条可能有醉酒或中毒风险，先打折听。" : "这能给别人复核，但先别只凭这一条定死。";
  if (!hint) {
    return rangeNightInfoLine(plan, ping);
  }
  return joinSpeechFragments([
    plan?.rangeText ?? claimRangeForRole(role),
    `如果只说格式：${hint}`,
    polluted,
  ]);
}

function exactNightInfoFormatLine(state, aiPlayer, note, plan, ping) {
  const role = perceivedRoleForPlayer(state, aiPlayer) ?? roleForPlayer(state, aiPlayer);
  const exact = compactNightInfoText(note);
  const hint = nightInfoFormatHintForPlan(plan, role);
  const polluted = ping?.polluted ? "但这条可能被醉酒或中毒影响，先打折听。" : "这条可以拿去和目标的身份、发言互相复核。";
  if (exact) {
    return joinSpeechFragments([
      `你追到具体信息了，我按格式说：${exact}。`,
      polluted,
    ]);
  }
  if (hint) {
    return joinSpeechFragments([
      `我这类信息的格式是：${hint}`,
      "但现在没有更完整的可复述结果。",
    ]);
  }
  return "";
}

function rangeNightInfoLine(plan, ping) {
  const polluted = ping?.polluted ? "这条可能有醉酒或中毒风险，先打折听。" : "这条先当方向，不要直接当铁证。";
  if (plan.family === "adjacent-info") {
    return `${plan.rangeText} 我先不直接报具体数字，因为那基本等于把身份交出来。${polluted}`;
  }
  if (plan.family === "adjacent-pair-count") {
    return `${plan.rangeText} 我先给结论方向，不把完整格式直接摊完。${polluted}`;
  }
  if (plan.family === "two-player-role") {
    return `${plan.rangeText} 我可以后面补具体两个人，但现在先别把我身份锁死。${polluted}`;
  }
  if (plan.family === "demon-check") {
    return `${plan.rangeText} 我会看公聊反应再决定要不要把目标和结果全报。${polluted}`;
  }
  if (plan.family === "execution-reveal") {
    return `${plan.rangeText} 这条信息适合和处决结果一起公开复核。${polluted}`;
  }
  return `${plan.rangeText} ${polluted}`;
}

function vagueNightInfoLine(plan, ping) {
  const risk = ping?.polluted ? "而且这条可能被污染，" : "";
  if (plan.level === "withhold") {
    return `我有夜间信息，但现在能安全说的只有：我先不把格式交出来。${risk}等公聊反应出来再说。`;
  }
  return `我有一条夜间信息，但现在能安全说的只有：说清格式基本就等于暴露身份。${risk}先只记我不是空白位。`;
}

function composeNightInfoDisclosure(state, aiPlayer, audience, rng = Math.random, options = {}) {
  const ping = latestInfoPingForPlayer(state, aiPlayer);
  const notes = summarizeShareablePrivateNotes(aiPlayer, 2, { state, audience });
  const note = ping?.text ?? notes.at(-1) ?? "";
  if (!ping && note) {
    return {
      text: exactPrivateNightInfoLine(note),
      plan: null,
    };
  }
  const plan = claimDisclosurePlanner(state, aiPlayer, audience, rng, {
    private: true,
    audience: "private",
    intent: "night",
    infoPing: ping,
    askedCount: options.askedCount ?? 0,
    trustScore: options.trustScore,
  });
  rememberClaimDisclosure(state, aiPlayer, plan, audience, { private: true, audience: "private" });
  const forceExact = shouldForceExactNightInfo(options.questionText, options.askedCount);
  const formatRequested = !!options.formatRequested || privateQuestionAsksForInfoFormat(options.questionText);

  if (plan.shouldClaimRole) {
    const roleId = claimRoleForContext(state, aiPlayer, audience, rng, {
      private: true,
      force: true,
      roleId: plan.roleId,
    });
    const roleName = roleNameById(state, roleId || plan.roleId);
    const exact = compactNightInfoText(note);
    return {
      text: joinSpeechFragments([
        `身份直接摊：${roleName}。`,
        exact ? `昨晚信息：${exact}。` : "昨晚信息现在可以摊开聊。",
        ping?.polluted ? "但这条可能被醉酒或中毒影响，先别当铁证。" : "这条可以先拿来复核，但别只凭这一条定死。",
      ]),
      plan,
    };
  }

  if (forceExact) {
    const exactText = exactNightInfoFormatLine(state, aiPlayer, note, plan, ping);
    if (exactText) {
      return {
        text: exactText,
        plan,
      };
    }
  }

  if (formatRequested && plan.shouldUseRange) {
    return {
      text: formatOnlyNightInfoLine(state, aiPlayer, plan, ping),
      plan,
    };
  }

  if (plan.shouldUseRange) {
    return {
      text: rangeNightInfoLine(plan, ping),
      plan,
    };
  }

  return {
    text: vagueNightInfoLine(plan, ping),
    plan,
  };
}

function composePrivateNightAnswer(state, aiPlayer, human, memory = {}, rng = Math.random, options = {}) {
  const disclosure = composeNightInfoDisclosure(state, aiPlayer, human, rng, {
    askedCount: memory.nightAskedCount ?? 0,
    trustScore: aiPlayer.suspicion?.[human.id],
    questionText: options.questionText,
    formatRequested: options.formatRequested,
  });
  if (disclosure.text) {
    return disclosure.text;
  }
  const notes = summarizeShareablePrivateNotes(aiPlayer, 2, { state, audience: human }).map(humanizeSharedPrivateNote);
  if (notes.length > 0) {
    return `我昨晚能安全说的是：${notes.join("；")}。这条先当线索，别直接定死。`;
  }
  const perceivedRole = perceivedRoleForPlayer(state, aiPlayer) ?? roleForPlayer(state, aiPlayer);
  if (isLikelyEarlyInfoRole(perceivedRole)) {
    return "我昨晚没有能直接摊开的新信息；如果要聊，我只能先给可复核的结论，身份细节另说。";
  }
  return "我昨晚没有能分享的新信息。今天主要看白天口径、投票和谁在回避追问。";
}

function composePrivateResponse(state, aiPlayer, human, analysis, questionText, memory, rng = Math.random, options = {}) {
  const agentView =
    options.agentView ?? buildAgentView(state, aiPlayer, { audience: "private", targetId: human?.id ?? null });
  const thoughtFrame =
    options.thoughtFrame ?? buildAIThoughtFrame(state, aiPlayer, {
      agentView,
      audience: "private",
      stage: "private",
      excludeConcernIds: [human?.id].filter(Boolean),
      rng,
    });
  const ranked = rankTargets(aiPlayer, state, state.players.length)
    .filter((entry) => entry.player.id !== human.id)
    .slice(0, 3);
  const top =
    (thoughtFrame.primaryConcernId
      ? ranked.find((entry) => entry.player.id === thoughtFrame.primaryConcernId)
      : null) ??
    ranked[0] ??
    null;
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

  const routeToNightInfo = shouldRoutePrivateQuestionToNightInfo(analysis, questionText);
  if (routeToNightInfo) {
    memory.nightAskedCount = Number(memory.nightAskedCount ?? 0) + 1;
    return {
      response: composePrivateNightAnswer(state, aiPlayer, human, memory, rng, {
        questionText,
        formatRequested: privateQuestionAsksForInfoFormat(questionText),
      }),
      focusId: null,
      focusScore: null,
      evidenceContract: null,
      followUpPrompts: [],
      directIntent: QUESTION_INTENT.NIGHT,
    };
  }

  if (analysis.intent === QUESTION_INTENT.CLAIM) {
    return {
      response: composePrivateClaimAnswer(state, aiPlayer, human, memory, rng),
      focusId: null,
      focusScore: null,
      evidenceContract: null,
      followUpPrompts: [],
      directIntent: QUESTION_INTENT.CLAIM,
    };
  }

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
  const focusedThoughtFrame =
    thoughtFrame.primaryConcernId === focus.player.id && thoughtFrame.questionToAsk
      ? thoughtFrame
      : rememberAIThoughtFrame(state, {
          ...thoughtFrame,
          primaryConcernId: focus.player.id,
          primaryConcernName: focus.player.name,
          questionToAsk: `让 ${focus.player.name} 把身份和昨晚信息说清楚`,
        });
  const evidenceContract = buildDialogueEvidenceContract(agentView ?? state, aiPlayer, focus.player);
  const followUpPrompts = buildGraphFollowUpPrompts(state, aiPlayer, focus.player, evidenceContract);
  if (focusedThoughtFrame.questionToAsk && !followUpPrompts.includes(focusedThoughtFrame.questionToAsk)) {
    followUpPrompts.unshift(focusedThoughtFrame.questionToAsk);
  }
  const evidence = evidenceContract.summaries;
  const evidenceText = evidenceContract.spokenText || evidenceContract.text;
  const focusText = formatFocus(focus.player, focus.score, numericMode);
  const stanceMemory = rememberDayStance(state, aiPlayer, focus.player.id, focus.score, "private");
  const followUpText = followUpPrompts[0]?.replace(/^追问\s+[^：]+：/, "") || "让他把身份和信息讲完整";
  const dialogueValues = {
    targetName: focus.player.name,
    focusText,
    evidenceText,
    shortReason: shortReasonText(evidenceText),
    trustLine,
    followUp: followUpText,
  };

  const surfaceAct = buildPrivateSurfaceAct(state, aiPlayer, analysis, {
    focus,
    second,
    evidenceContract,
    evidenceText,
    memory,
    explicitMention: !!mentionFocus,
    thoughtFrame: focusedThoughtFrame,
    followUpText,
    trustLine,
  });
  const surfaceResponse = renderPrivateSurfaceAct(surfaceAct, rng);
  if (surfaceResponse) {
    const pragmaticText = applyInGamePragmatics(state, aiPlayer, surfaceResponse, {
      audience: "private",
      intent: analysis.intent,
      focusId: focus.player.id,
      focusScore: focus.score,
      lowEvidence: evidenceContract.lowEvidence,
    });
    return {
      response: ensureEvidenceContractInText(pragmaticText, evidenceContract),
      focusId: focus.player.id,
      focusScore: focus.score,
      evidenceContract,
      followUpPrompts,
      thoughtFrame: focusedThoughtFrame,
      surfaceRendered: true,
    };
  }

  lines.push(
    directAnswerForPrivateQuestion(state, aiPlayer, human, analysis, {
      focus,
      focusText,
      shortReason: shortReasonText(evidenceText),
      trustLine,
      followUpText,
      numericMode,
    }) || sample(openerPool, 1, rng)[0]
  );

  if (!aiPlayer.alive && [QUESTION_INTENT.REASON, QUESTION_INTENT.PLAN, QUESTION_INTENT.GENERIC, QUESTION_INTENT.SUSPECT].includes(analysis.intent)) {
    lines.push(
      renderDialogueActs(state, aiPlayer, "deadPrivate", dialogueValues, rng, [
        `我已经死了，所以这段你可以当遗言看。${focus.player.name} 先问 ${followUpText}。`,
      ])
    );
  }

  switch (analysis.intent) {
    case QUESTION_INTENT.REASON:
      lines.push(
        renderDialogueActs(state, aiPlayer, "reason", dialogueValues, rng, [
          `我现在主要想追 ${focusText}。理由不是单点爆炸，而是这几件事凑在一起很别扭：${evidenceText}。`,
        ])
      );
      break;
    case QUESTION_INTENT.TRUST:
      lines.push(`${trustLine} 但我不想把话说死。今天更值得逼反应的是 ${focus.player.name}，因为${evidenceText}。`);
      break;
    case QUESTION_INTENT.CLAIM: {
      memory.claimAskedCount = Number(memory.claimAskedCount ?? 0) + 1;
      const claimSentence = composePrivateClaimPolicy(state, aiPlayer, human, memory, rng) || maybePrivateClaim(state, aiPlayer, human, rng);
      lines.push(claimSentence || "身份我现在不想直接裸跳。你可以先记我不是空白位；如果今天真的要推我，我会补完整口径。");
      lines.push(`但别只盯身份，眼下我更想听 ${focusText} 怎么解释。`);
      break;
    }
    case QUESTION_INTENT.VOTE:
      lines.push(
        renderDialogueActs(state, aiPlayer, "vote", dialogueValues, rng, [
          `如果现在有人提 ${focus.player.name}，我大概率会跟票。原因很简单：${evidenceText}。`,
        ])
      );
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
      lines.push(
        renderDialogueActs(state, aiPlayer, "plan", dialogueValues, rng, [
          `${trustLine} 今天别空过，我建议先把压力给到 ${focus.player.name}。先让他解释${evidence.length > 0 ? "这条线" : "自己的信息和投票态度"}；如果还在绕，再进提名。`,
        ])
      );
      break;
    case QUESTION_INTENT.SUSPECT:
    case QUESTION_INTENT.GENERIC:
    default:
      lines.push(
        renderDialogueActs(state, aiPlayer, "generic", dialogueValues, rng, [
          `我现在最想追的是 ${focusText}。不是说他一定是恶，但${evidenceText}，这条线得有人回答。`,
        ])
      );
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
  if (followUpPrompts.length > 0 && [QUESTION_INTENT.REASON, QUESTION_INTENT.PLAN, QUESTION_INTENT.GENERIC, QUESTION_INTENT.SUSPECT].includes(analysis.intent)) {
    lines.push(`下一句我会这样追：${followUpPrompts[0]}`);
  }
  const qaFollowUp = followUpQuestionForPrivateAnswer(analysis, { focus, followUpText });
  if (qaFollowUp) {
    lines.push(qaFollowUp);
  }
  const pragmaticText = applyInGamePragmatics(state, aiPlayer, lines.join(" "), {
    audience: "private",
    intent: analysis.intent,
    focusId: focus.player.id,
    focusScore: focus.score,
    lowEvidence: evidenceContract.lowEvidence,
  });

  return {
    response: ensureEvidenceContractInText(pragmaticText, evidenceContract),
    focusId: focus.player.id,
    focusScore: focus.score,
    evidenceContract,
    followUpPrompts,
    thoughtFrame: focusedThoughtFrame,
  };
}

function renderDialogueActs(state, aiPlayer, act, values = {}, rng = Math.random, fallback = [], options = {}) {
  const audience = options.audience ?? "private";
  return renderDialogueActsFromRenderer(state, aiPlayer, act, values, rng, fallback, {
    ...options,
    evilPerformance:
      options.evilPerformance ??
      ((audience === "public" || audience === "private") && isEvilPerspective(state, aiPlayer)),
  });
}
function evidenceReasonText(evidence, fallback = "发言节奏和场上位置还没有对齐") {
  const clean = (evidence ?? [])
    .map((entry) => `${entry ?? ""}`.trim())
    .filter(Boolean)
    .slice(0, 2);
  return clean.length > 0 ? clean.join("；") : fallback;
}

function humanSeatList(players, emptyText = "暂时没看到") {
  if (!Array.isArray(players) || players.length === 0) {
    return emptyText;
  }
  return players
    .slice()
    .sort((a, b) => a.seatIndex - b.seatIndex)
    .map((entry) => `${entry.seatIndex + 1}号`)
    .join("、");
}

function roleLabelForSpeech(state, roleId) {
  return roleId ? roleNameById(state, roleId) : "";
}

function evidenceToHumanLine(evidence) {
  const clean = (evidence ?? [])
    .map((entry) => `${entry ?? ""}`.trim())
    .filter(Boolean)
    .slice(0, 2);
  if (clean.length === 0) {
    return "我手里没有硬证据，主要是站边和发言节奏不太对";
  }
  return clean.join("；");
}

function buildPrivateDeceptionLines(state, human, deception = {}) {
  const lines = [];
  const claimRoleId = `${deception.claimRoleId ?? ""}`.trim();
  if (claimRoleId) {
    const roleName = roleNameById(state, claimRoleId);
    lines.push(`我私下告诉你：我声称自己是 ${roleName || claimRoleId}。`);
  }
  const nightInfo = `${deception.nightInfo ?? ""}`.trim();
  if (nightInfo) {
    lines.push(`我说我昨晚得到的信息是：${nightInfo}`);
  }
  if (deception.askSecret) {
    lines.push("这段先别公开，至少今天先只当我们之间的信息。");
  }
  return lines;
}

function humanizeSharedPrivateNote(note) {
  const value = `${note ?? ""}`.replace(/\s+/g, " ").trim();
  const evilPairs = value.match(/邪恶相邻对数为\s*([0-9]+)/);
  if (evilPairs) {
    return `我夜里拿到的相邻邪恶数是 ${evilPairs[1]}`;
  }
  return value
    .replace(/^\[第[0-9]+夜\]\s*/, "")
    .replace(/^你得知：/, "")
    .replace(/^你(?=查验|临终查验|作为|获得|知道|看到|选择|今晚|昨晚|的)/, "我")
    .replace(/[。；]\s*$/, "")
    .trim();
}

function sanitizePrivateDialogueText(text, fallbackTargetName = "") {
  const targetName = fallbackTargetName || "这个位置";
  const value = `${text ?? ""}`
    .replace(/我的信息链是：/g, "我这边拿到的是：")
    .replace(/信息链是：/g, "我这边拿到的是：")
    .replace(/白天话术可以围着\s+你\s+打一圈，压力给到就行。/g, `白天先问 ${targetName}，别急着冲票，先看回应。`)
    .replace(/我会先围绕\s+你\s+追问/g, `我会先问 ${targetName}`)
    .replace(/我会先围绕\s+([0-9]+号)\s+追问/g, "我会先问 $1")
    .replace(/你\s+这边先放进观察位/g, `${targetName} 先放进观察位`)
    .replace(/([0-9]+号)\s+这边先放进观察位/g, "$1 先放进观察位")
    .replace(/\bta\b/g, "他")
    .trim();
  return polishConversationalText(value);
}

function deceptionSpeechActs(deception = {}) {
  const acts = [];
  if (deception.claimRoleId) {
    acts.push("hard_claim", "fake_claim");
  }
  if (`${deception.nightInfo ?? ""}`.trim()) {
    acts.push("info_dump", "fake_claim");
  }
  if (deception.askSecret) {
    acts.push("withhold_info", "private_pull");
  }
  return acts;
}

function recordHumanPrivateDeception(state, human, target, deception = {}) {
  if (!human || !target || !deception) {
    return;
  }
  const claimRoleId = `${deception.claimRoleId ?? ""}`.trim();
  if (claimRoleId) {
    recordPrivateClaimForAgent(state, target.id, {
      playerId: human.id,
      roleId: claimRoleId,
      claimStyle: "hard_claim",
      deceptionType: claimRoleId === human.roleId ? "truthful_private_claim" : "fake_claim",
    });
  }
  const nightInfo = `${deception.nightInfo ?? ""}`.trim();
  if (nightInfo) {
    const infoAnalysis = detectIntent(state, nightInfo, QUESTION_INTENT.NIGHT);
    recordPrivateInfoClaimForAgent(state, target.id, {
      speakerId: human.id,
      text: nightInfo,
      targetIds: infoAnalysis.mentionedPlayers.map((entry) => entry.id),
      deceptionType: "fabricated_night_info",
    });
  }
  if (deception.askSecret) {
    addAgentObservation(state, target.id, {
      kind: "social",
      source: "private-chat",
      private: true,
      reliability: "claimed",
      text: `${human.id} asked me to keep this private.`,
      payload: {
        speakerId: human.id,
        targetId: target.id,
        request: "keep_secret",
        deceptionType: claimRoleId || nightInfo ? "secret_deception_payload" : "secret_request",
      },
    });
  }
}

function composeHumanizedEvilAllianceResponse(state, aiPlayer, human, analysis, original, rng = Math.random) {
  const agent = getAIAgent(state, aiPlayer);
  const knownAllyIds = new Set(agent?.knownAllyIds ?? []);
  const demon = agent?.knownDemonId ? getPlayerById(state, agent.knownDemonId) : null;
  const minions = (agent?.knownMinionIds ?? []).map((id) => getPlayerById(state, id)).filter(Boolean);
  const ranked = rankTargets(aiPlayer, state, 5);
  const focus =
    (original?.focusId ? ranked.find((entry) => entry.player.id === original.focusId) : null) ??
    ranked.find((entry) => !knownAllyIds.has(entry.player.id)) ??
    ranked[0] ??
    null;
  const focusPlayer = focus?.player ?? null;
  const evidence = focusPlayer ? collectEvidence(state, aiPlayer, focusPlayer) : [];
  const actualRoleName = roleLabelForSpeech(state, getEffectiveRoleId(aiPlayer) ?? aiPlayer.roleId);
  const bluffRoleId = aiPlayer.publicClaimRoleId || chooseScriptAwareBluffRoleId(state, getKnownBluffRoleIds(state, aiPlayer), rng);
  const bluffName = roleLabelForSpeech(state, bluffRoleId);

  const lines = [
    pickCorpusTemplate("private.evilAlliance.openers", {}, rng, ["自己人，我直接说。"]),
  ];

  if (aiPlayer.category === "demon") {
    lines.push(
      pickCorpusTemplate(
        "private.evilAlliance.demonMinionInfo",
        { minions: humanSeatList(minions, "没有爪牙位") },
        rng,
        ["我看到的爪牙是 {minions}。"]
      )
    );
  } else {
    const otherMinions = minions.filter((entry) => entry.id !== aiPlayer.id);
    lines.push(
      pickCorpusTemplate(
        "private.evilAlliance.minionTeamInfo",
        {
          demonSeat: demon ? `${demon.seatIndex + 1}号` : "未知",
          otherMinions: humanSeatList(otherMinions, "暂无"),
        },
        rng,
        ["我知道的恶魔是 {demonSeat}；其他爪牙 {otherMinions}。"]
      )
    );
  }

  if (analysis.intent === QUESTION_INTENT.CLAIM) {
    if (actualRoleName) {
      lines.push(`我真实身份是 ${actualRoleName}。`);
    }
    if (bluffName) {
      aiPlayer.publicClaimRoleId = aiPlayer.publicClaimRoleId || bluffRoleId;
      lines.push(
        pickCorpusTemplate(
          "private.evilAlliance.bluffCover",
          { bluffName },
          rng,
          ["台面上我先往 {bluffName} 这个方向装，你别第一时间替我背书。"]
        )
      );
    } else {
      lines.push(
        pickCorpusTemplate(
          "private.evilAlliance.noBluffCover",
          {},
          rng,
          ["台面上我先不报真实身份，伪装会看公聊里缺什么再补。"]
        )
      );
    }
  }

  if (focusPlayer) {
    const reasonText = evidenceToHumanLine(evidence);
    const focusName = statementTargetLabel(state, focusPlayer.id);
    lines.push(
      pickCorpusTemplate(
        "private.evilAlliance.targetPressure",
        { targetName: focusName },
        rng,
        ["今天我们可以先把 {targetName} 放到讨论中心，不一定马上出，但要让 ta 多说。"]
      )
    );
    lines.push(
      pickCorpusTemplate(
        "private.evilAlliance.targetReason",
        { reasonText },
        rng,
        ["能说出口的理由就用这个：{reasonText}。"]
      )
    );
  } else {
    lines.push(
      pickCorpusTemplate(
        "private.evilAlliance.noTarget",
        {},
        rng,
        ["目前没有特别顺手的好人目标，先听公聊里谁先露破绽。"]
      )
    );
  }

  if (rng() < 0.75) {
    lines.push(
      pickCorpusTemplate("private.evilAlliance.closers", {}, rng, [
        "先这样，等今天公聊跑一轮再决定要不要提名。",
      ])
    );
  }

  return {
    ...original,
    response: applySpeechBudget(
      sanitizePrivateDialogueText(lines.filter(Boolean).join(" "), focusPlayer ? statementTargetLabel(state, focusPlayer.id) : ""),
      { audience: "private", maxSentences: 4, maxChars: 270 }
    ),
  };
}

function lightlyHumanizePrivateResponse(state, aiPlayer, human, analysis, original, rng = Math.random) {
  const text = `${original?.response ?? ""}`.trim();
  if (!text) {
    return original;
  }
  const persona = aiPlayer.aiPersona ?? PERSONA_TYPES.STEADY;
  const opener =
    rng() < 0.65
      ? pickPersonaTemplate(persona, "privateOpeners", {}, rng, ["我先说人话版。"])
      : pickCorpusTemplate("private.generic.openers", {}, rng, ["我先说人话版。"]);
  const closer =
    rng() < 0.35
      ? pickCorpusTemplate("private.generic.closers", {}, rng, [
          "你要是愿意，我们可以继续顺着这条线追两问。",
        ])
      : "";
  const cleaned = text
    .replace(/^(这个问题我明白了。?|我按证据顺序说。?|我先给你短结论。?|我把当前信息压缩一下。?)\s*/u, "")
    .replace(/^(我先说人话版。|简单讲，我现在是这么看。|别急，我给你一个能落地的判断。|我不把话说死，但目前倾向是这样。|先给结论，细节你可以继续追问。|我尽量不绕，先把我的判断摊开。|这事我有点想法，但先别当铁证听。)\s*/u, "")
    .replace(/^(嗯，我现在是这么看的。|先别急，我把我的感觉说清楚。|我不装谜语人，直接说。)\s*/u, "");
  if (cleaned.startsWith(opener)) {
    return { ...original, response: cleaned };
  }
  const response = `${opener} ${cleaned}${closer ? ` ${closer}` : ""}`;
  return {
    ...original,
    response,
  };
}

function humanizePrivateComposedResponse(state, aiPlayer, human, analysis, original, rng = Math.random, options = {}) {
  if ([QUESTION_INTENT.CLAIM, QUESTION_INTENT.NIGHT].includes(original?.directIntent)) {
    return {
      ...original,
      response: applyHumanSpeechCadence(state, aiPlayer, original.response, rng, {
        audience: "private",
        intent: analysis.intent,
        focusId: original.focusId,
        focusScore: original.focusScore,
        maxSentences: 4,
        maxChars: 240,
      }),
    };
  }
  if (original?.surfaceRendered) {
    const polished = polishConversationalText(original.response);
    return {
      ...original,
      response: applySpeechBudget(differentiateRepeatedSpeech(polished, aiPlayer, rng, { audience: "private" }), {
        audience: "private",
        maxSentences: 3,
        maxChars: 190,
      }),
    };
  }
  const composed = options.sameEvilTeam
    ? composeHumanizedEvilAllianceResponse(state, aiPlayer, human, analysis, original, rng)
    : lightlyHumanizePrivateResponse(state, aiPlayer, human, analysis, original, rng);
  return {
    ...composed,
    response: applyHumanSpeechCadence(state, aiPlayer, composed.response, rng, {
      audience: "private",
      intent: analysis.intent,
      focusId: composed.focusId,
      focusScore: composed.focusScore,
      force: options.sameEvilTeam ? false : undefined,
      maxSentences: options.sameEvilTeam ? 4 : undefined,
      maxChars: options.sameEvilTeam ? 270 : undefined,
    }),
  };
}

function isSensitivePrivateNote(note) {
  return /(邪恶互认|恶魔伪装|你的爪牙|恶魔是|其他爪牙|当前可用伪装|不在场|魔典|间谍|Known minions|Known demon|bluff|demon bluff|grimoire)/i.test(
    `${note ?? ""}`
  );
}

function isEvilPerspective(state, player) {
  const agent = state ? getAIAgent(state, player) : null;
  return player?.team === "evil" || agent?.knownSelfTeam === "evil";
}

function canSharePrivateNote(state, speaker, audience, note) {
  if (state && audience && areKnownAllies(state, speaker, audience)) {
    return true;
  }
  if (isSensitivePrivateNote(note)) {
    return false;
  }
  if (isEvilPerspective(state, speaker)) {
    // Evil players should bluff to outsiders instead of leaking real night/spy knowledge.
    return false;
  }
  return true;
}

function summarizeShareablePrivateNotes(aiPlayer, limit = 2, options = {}) {
  const state = options.state ?? null;
  const audience = options.audience ?? null;
  return (aiPlayer.privateNotes ?? [])
    .map((note) => `${note ?? ""}`.trim())
    .filter(Boolean)
    .filter((note) => canSharePrivateNote(state, aiPlayer, audience, note))
    .slice(-limit);
}

const DEBATE_BEATS = ["opening", "challenge", "defense", "nomination-pressure", "vote-intent"];


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
      applyDynamicTrustSignals(state, aiPlayer);
      applyNightPatternSignals(state, aiPlayer);
      applyDialogueBias(aiPlayer);
      enforceEvilCoordination(state, aiPlayer);
      normalizeSuspicion(aiPlayer);
    });
}

const publicDiscussion = createAIPublicDiscussion({
  QUESTION_INTENT,
  PERSONA_TYPES,
  DEBATE_BEATS,
  ensureDialogueState,
  refreshAIBeliefs,
  buildAgentView,
  buildAIThoughtFrame,
  rankTargets,
  resolveStableFocus,
  rememberDayStance,
  personaThresholdShift,
  buildDialogueEvidenceContract,
  publicClaimDisclosureLine,
  thoughtFrameDisclosureLine,
  maybePublicDisclosureLine,
  shortReasonText,
  renderDialogueActs,
  corpusTemplateEntry,
  personaCorpusKey,
  pickCorpusTemplate,
  pickPersonaTemplate,
  pickLayeredSpeech,
  sample,
  dayStanceLabel,
  roleNameById,
  summarizeShareablePrivateNotes,
  joinSpeechFragments,
  renderPublicSurfaceActReadable,
  buildPublicSurfaceAct,
  ensureEvidenceContractInText,
  applyInGamePragmatics,
  applyHumanSpeechCadence,
  appendPublicThoughtQuestion,
  shouldDeadPublicClaim,
  pickClaimRole,
  choosePublicClaimRole,
  claimRoleForContext,
  applyPublicStatementContinuityFromMemory,
  rememberStatementMemory,
  recordPublicSpeechForAgents,
  addLog,
  pushTimeline,
  predictDialogueSignals,
  recordUtteranceMVP,
  inferPublicSpeechActs,
  voteStanceFromText,
  clamp,
});

export const runAIConversationStep = (...args) => publicDiscussion.runAIConversationStep(...args);
export const runAIDiscussion = (...args) => publicDiscussion.runAIDiscussion(...args);
const privateSocial = createAIPrivateSocial({
  QUESTION_INTENT,
  PERSONA_TYPES,
  PERSONA_LABELS,
  ensureDialogueState,
  refreshAIBeliefs,
  buildAIThoughtFrame,
  areKnownAllies,
  composeEvilAllianceResponse,
  composeHumanizedEvilAllianceResponse,
  rankTargets,
  getTopTarget,
  summarizeShareablePrivateNotes,
  pickCorpusTemplate,
  pickPersonaTemplate,
  pickLayeredSpeech,
  claimRoleForContext,
  roleNameById,
  humanizeSharedPrivateNote,
  composeNightInfoDisclosure,
  rememberDayStance,
  collectEvidence,
  evidenceReasonText,
  statementTargetLabel,
  dayStanceLabel,
  applySpeechBudget,
  sanitizePrivateDialogueText,
  joinSpeechFragments,
  perceivedRoleForPlayer,
  roleForPlayer,
  isEarlyInfoRole,
  getPlayerById,
  addLog,
  predictDialogueSignals,
  recordPrivateWhisperForAgents,
  rememberStatementMemory,
  pushTimeline,
  recordUtteranceMVP,
  inferSpeechActsFromIntent,
  voteStanceFromText,
  applyPrivateStatementContinuity,
  recordPrivateChannelForAgents,
  clamp,
});

export const runAIToAIPrivateWhispers = (...args) => privateSocial.runAIToAIPrivateWhispers(...args);
export const runAIProactiveWhispers = (...args) => privateSocial.runAIProactiveWhispers(...args);
export const acceptAIProactiveWhisper = (...args) => privateSocial.acceptAIProactiveWhisper(...args);
export const declineAIProactiveWhisper = (...args) => privateSocial.declineAIProactiveWhisper(...args);
export function runPrivateWhisper(
  state,
  { targetId, humanLine, intentHint = QUESTION_INTENT.GENERIC, deception = {} },
  rng = Math.random
) {
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

  const deceptionLines = buildPrivateDeceptionLines(state, human, deception);
  const cleaned = [`${humanLine ?? ""}`.trim(), ...deceptionLines].filter(Boolean).join(" ");
  const question = cleaned.length > 0 ? cleaned.slice(0, 260) : "你现在最怀疑谁？";
  const analysis = detectIntent(state, question, intentHint);
  const questionSignals = predictDialogueSignals(question);

  applyPrivateChatSignals(target, human, analysis.mentionedPlayers, question);
  recordHumanPrivateDeception(state, human, target, deception);
  refreshAIBeliefs(state);

  const memory = ensurePairMemory(state, target.id, human.id);
  const sameEvilTeam = areKnownAllies(state, target, human);
  const targetView = buildAgentView(state, target, { audience: "private", targetId: human.id });
  const rawComposed = sameEvilTeam
    ? composeEvilAllianceResponse(state, target, human, analysis, rng)
    : composePrivateResponse(state, target, human, analysis, question, memory, rng, { agentView: targetView });
  let composed = humanizePrivateComposedResponse(state, target, human, analysis, rawComposed, rng, { sameEvilTeam });
  composed = applyPrivateStatementContinuity(state, target, human, composed, analysis);
  composed = applyPrivateDialogueTurnTaking(state, target, human, composed, analysis, question, memory, { sameEvilTeam });
  composed = ensurePrivateAnswerAlignment(state, target, human, analysis, composed);
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
  rememberStatementMemory(state, target, "private", human.id, composed, {
    source: "ai_private_whisper",
    intent: analysis.intent,
  });

  pushTimeline(state, {
    mode: "whisper-out",
    speakerId: human.id,
    targetId: target.id,
    text: question,
    intent: analysis.intent,
  });

  pushTimeline(state, {
    mode: "whisper-in",
    speakerId: target.id,
    targetId: human.id,
    text: composed.response,
    intent: analysis.intent,
    focusId: composed.focusId ?? "",
    evidenceSummary: composed.evidenceContract?.spokenText || composed.evidenceContract?.text || "",
    evidenceKind: evidenceKindForSurface(composed.evidenceContract),
    questionToAsk: composed.thoughtFrame?.questionToAsk ?? "",
    followUpPrompts: composed.followUpPrompts ?? [],
  });

  recordUtteranceMVP(state, {
    speakerId: human.id,
    audience: "private",
    text: question,
    speechActs: [
      ...new Set([
        ...inferSpeechActsFromIntent(analysis.intent, { audience: "private", isQuestion: true }),
        ...deceptionSpeechActs(deception),
        ...(questionSignals.speechActs ?? []),
      ]),
    ],
    targets: analysis.mentionedPlayers.length > 0 ? analysis.mentionedPlayers.map((entry) => entry.id) : [target.id],
    intent: analysis.intent,
    voteStance: voteStanceFromText(question),
    evidenceSource: "private_chat",
    epistemicStrength: analysis.confidence >= 2.2 ? 3 : analysis.confidence >= 1.15 ? 2 : 1,
    nominationRelated: /提名|nominate/i.test(question),
    deceptionType: deception?.claimRoleId || deception?.nightInfo ? "human_private_deception" : "",
    metadata: {
      source: "human_private_whisper",
      targetId: target.id,
      direction: "out",
      intentHint: analysis.hint,
      deception: {
        hasPrivateClaim: !!deception?.claimRoleId,
        hasNightInfo: !!`${deception?.nightInfo ?? ""}`.trim(),
        askSecret: !!deception?.askSecret,
      },
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
    focusId: composed.focusId ?? null,
    focusScore: composed.focusScore ?? null,
    evidenceContract: composed.evidenceContract ?? null,
    followUpPrompts: composed.followUpPrompts ?? [],
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
    const persona = voter.aiPersona ?? PERSONA_TYPES.STEADY;
    const shift = personaThresholdShift(persona) + personaStrategyProfile(persona).voteShift;
    const memoryShift = publicStatementVoteThresholdShift(state, voter, nominee);
    return suspicion >= (voter.alive ? 0.43 + shift + memoryShift : 0.56 + shift + memoryShift);
  }

  const persona = voter.aiPersona ?? PERSONA_TYPES.STEADY;
  const evidenceCount = countAgentEvidence(getAIAgent(state, voter), nominee.id);
  const strategicShift =
    personaStrategyProfile(persona).voteShift -
    (evidenceCount > 0 && persona === PERSONA_TYPES.PRESSURE ? 0.025 : 0);
  const shift = personaThresholdShift(persona) + strategicShift;
  const memoryShift = publicStatementVoteThresholdShift(state, voter, nominee);
  const threshold = voter.alive ? 0.58 + shift + memoryShift : 0.69 + shift + memoryShift;
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

function pressureReasonFor(aiPlayer, target, support, evidenceCount, threshold, evidenceSummary = "") {
  if (evidenceSummary) {
    return `我先把 ${target.name} 放上台：${evidenceSummary}。先听回应，再看票型。`;
  }
  if (evidenceCount > 0) {
    return `我先提 ${target.name}。手里已经有 ${evidenceCount} 条线，不想让这边轻轻滑过去。`;
  }
  if (support > 0) {
    return `我先提 ${target.name}。证据还不硬，但这轮需要看大家怎么站票。`;
  }
  return `我先提 ${target.name}。继续空过收益太低，至少让这个位置正面回应。`;
}

function buildNominationProposal(state, aiPlayer, candidate, threshold, rankIndex, options = {}) {
  const agentView =
    options.agentView ?? buildAgentView(state, aiPlayer, { audience: "public", targetId: candidate.player.id });
  const thoughtFrame = options.thoughtFrame ?? buildAIThoughtFrame(state, aiPlayer, {
    agentView,
    audience: "public",
    stage: "nomination",
  });
  const evidenceCount = agentView
    ? agentView.evidenceCountForTarget(candidate.player.id)
    : countAgentEvidence(getAIAgent(state, aiPlayer), candidate.player.id);
  const statementReason = publicStatementNominationReason(state, aiPlayer, candidate.player.id);
  const evidenceContract = buildDialogueEvidenceContract(agentView ?? state, aiPlayer, candidate.player, {
    limit: 1,
    publicOnly: true,
    fallback: "公开证据还不够，先用提名看回应和票型",
  });
  const evidenceSummary = evidenceContract.hasEvidence ? evidenceContract.text : "";
  const framing = aiPlayer.team === "evil" && !areKnownAllies(state, aiPlayer, candidate.player) && (evidenceContract.graphChains?.length ?? 0) > 0;
  const support = expectedSupportFor(state, candidate.player.id);
  const highConfidence = candidate.score >= 0.56 && !options.forcePressure;
  const nominationLabel = highConfidence ? "正式提名" : "先提上台";
  const nominationTargetName = statementTargetLabel(state, candidate.player.id);
  const nominationAct = renderDialogueActs(
    state,
    aiPlayer,
    "nomination",
    {
      targetName: nominationTargetName,
      reasonText: evidenceContract.spokenText || evidenceContract.text,
      shortReason: shortReasonText(evidenceContract.spokenText || evidenceContract.text),
      nominationLabel,
    },
    () => 0.37,
    [`${nominationLabel}：${nominationTargetName} 这边需要正面回应，理由是 ${evidenceContract.spokenText || evidenceContract.text}。`],
    { audience: "public" }
  );
  const rawProposalReason = statementReason
    ? `${nominationLabel}：${statementReason}。`
    : ensureEvidenceContractInText(
      highConfidence
      ? evidenceSummary
        ? nominationAct
        : `${nominationLabel}：${nominationTargetName} 这边需要正面回应，${evidenceContract.text}。`
      : evidenceSummary
      ? nominationAct
      : pressureReasonFor(aiPlayer, candidate.player, support, evidenceCount, threshold, evidenceSummary),
    evidenceContract
  );
  const proposalReason = applySpeechBudget(polishConversationalText(rawProposalReason), { audience: "nomination" });
  return {
    nominatorId: aiPlayer.id,
    nomineeId: candidate.player.id,
    confidence: candidate.score,
    support,
    evidenceCount,
    pressure: !highConfidence,
    threshold,
    rankIndex,
    evidenceSummary,
    evidenceContract,
    statementMemoryFocus: !!statementReason,
    framing,
    thoughtFrame,
    thoughtFrameFocus: thoughtFrame.primaryConcernId === candidate.player.id,
    reason: proposalReason,
  };
}

function sortNominationProposals(proposals) {
  proposals.sort((a, b) => {
    if (a.pressure !== b.pressure) {
      return a.pressure ? 1 : -1;
    }
    if (!!a.statementMemoryFocus !== !!b.statementMemoryFocus) {
      return a.statementMemoryFocus ? -1 : 1;
    }
    if (!!a.framing !== !!b.framing) {
      return a.framing ? -1 : 1;
    }
    if (!!a.thoughtFrameFocus !== !!b.thoughtFrameFocus) {
      return a.thoughtFrameFocus ? -1 : 1;
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
    const agentView = buildAgentView(state, aiPlayer, { audience: "public" });
    const thoughtFrame = buildAIThoughtFrame(state, aiPlayer, {
      agentView,
      audience: "public",
      stage: "nomination",
    });
    const persona = aiPlayer.aiPersona ?? PERSONA_TYPES.STEADY;
    const frameShift = thoughtFrame.nominationReadiness >= 0.68 ? -0.06 : thoughtFrame.nominationReadiness >= 0.55 ? -0.03 : 0;
    const effectiveThreshold = clamp(threshold + personaStrategyProfile(persona).nominationShift + frameShift, 0.28, 0.62);
    const candidate = rankTargets(aiPlayer, state, state.players.length)
      .filter((entry) => entry.player.alive && !entry.player.beenNominatedToday)
      .filter((entry) => !areKnownAllies(state, aiPlayer, entry.player))
      .find((entry) => shouldForcePressure || entry.score >= fallbackFloor);

    if (!candidate || (!shouldForcePressure && candidate.score < fallbackFloor)) {
      return;
    }

    fallbackProposals.push(
      buildNominationProposal(state, aiPlayer, candidate, Math.min(effectiveThreshold, fallbackFloor), 0, {
        agentView,
        thoughtFrame,
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
    const agentView = buildAgentView(state, aiPlayer, { audience: "public" });
    const thoughtFrame = buildAIThoughtFrame(state, aiPlayer, {
      agentView,
      audience: "public",
      stage: "nomination",
    });
    const persona = aiPlayer.aiPersona ?? PERSONA_TYPES.STEADY;
    const frameShift = thoughtFrame.nominationReadiness >= 0.68 ? -0.06 : thoughtFrame.nominationReadiness >= 0.55 ? -0.03 : 0;
    const effectiveThreshold = clamp(threshold + personaStrategyProfile(persona).nominationShift + frameShift, 0.28, 0.62);
    const rankedTargets = rankTargets(aiPlayer, state, state.players.length)
      .filter((entry) => entry.player.alive && !entry.player.beenNominatedToday)
      .filter((entry) => !areKnownAllies(state, aiPlayer, entry.player));
    const publicMemory = currentPublicStatementMemory(state, aiPlayer.id);
    const primaryTargets = rankedTargets.slice(0, 3);
    const memoryTarget = rankedTargets.find((entry) => entry.player.id === publicMemory?.focusId);
    const thoughtTarget = rankedTargets.find((entry) => entry.player.id === thoughtFrame.primaryConcernId);
    const targetsToConsider =
      memoryTarget && !primaryTargets.some((entry) => entry.player.id === memoryTarget.player.id)
        ? [...primaryTargets, memoryTarget]
        : [...primaryTargets];
    if (thoughtTarget && !targetsToConsider.some((entry) => entry.player.id === thoughtTarget.player.id)) {
      targetsToConsider.push(thoughtTarget);
    }

    targetsToConsider.forEach((candidate, rankIndex) => {
        const evidenceCount = countAgentEvidence(getAIAgent(state, aiPlayer), candidate.player.id);
        const support = expectedSupportFor(state, candidate.player.id);
        const hasEvidence = evidenceCount > 0 || support > 0;
        const hasPublicMemory =
          publicStatementMemoryMatches(publicMemory, candidate.player.id) &&
          publicStatementMemoryPressure(publicMemory) > 0;
        const highConfidence = candidate.score >= 0.56;
        const pressureEligible =
          (candidate.score >= effectiveThreshold && (hasEvidence || state.day <= 1 || getAlivePlayers(state).length <= 5)) ||
      (hasPublicMemory && candidate.score >= Math.max(0.24, effectiveThreshold - 0.24));
        if (!highConfidence && !pressureEligible) {
          return;
        }
        proposals.push(buildNominationProposal(state, aiPlayer, candidate, effectiveThreshold, rankIndex, { agentView, thoughtFrame }));
      });
  });

  if (proposals.length === 0) {
    return choosePressureFallbackNomination(state, candidates, threshold);
  }

  return sortNominationProposals(proposals)[0];
}

function nextNominationDebateId(state) {
  const existing = state.events?.nominationDebates?.length ?? 0;
  return `nomination-debate-${state.day ?? 0}-${existing + 1}`;
}

function publicRoleClaimText(state, player) {
  if (!player?.publicClaimRoleId) {
    return "我先不把身份一次说死，但会把昨晚信息和投票理由讲清楚";
  }
  return `我公开报的是 ${roleNameById(state, player.publicClaimRoleId)}`;
}

function nominationDefenseLine(state, nominee, nominator, reason, rng = Math.random) {
  if (!nominee) {
    return "";
  }
  if (nominee.isHuman) {
    return "等你回应。你可以先说身份和昨晚信息，再决定要不要拉票。";
  }
  const pressure = nominee.suspicion?.[nominator?.id] ?? 0.5;
  const claimText = publicRoleClaimText(state, nominee);
  const options = [
    `我不认这个票。${claimText}，先让我把信息讲完，再决定要不要上票。`,
    `这个提名太急了。${claimText}，我可以解释，但别在我没说完前锁票。`,
    `我先防一下：${claimText}。如果要票我，至少把刚才那条理由重新摊开听一遍。`,
  ];
  if (pressure >= 0.6) {
    options.push(`我反过来看 ${nominator?.name ?? "提名者"} 这边也不稳。${claimText}，这票别闭眼跟。`);
  }
  return sample(options, 1, rng)[0];
}

function defaultHumanNominationDebateResponse(state, speaker, debate) {
  const speakerRole = speaker?.id === debate?.nomineeId ? "nominee" : "nominator";
  if (speakerRole === "nominee") {
    return "我先回应这票：别急着锁。我会把身份和昨晚信息讲清楚，大家听完再决定。";
  }
  return "我补一句：我提这个人不是为了赶票，是想先把他的解释放到台面上。";
}

function sanitizeNominationDebateResponse(text) {
  return `${text ?? ""}`.replace(/\s+/g, " ").trim().slice(0, 160);
}

export function createNominationDebate(state, { nominatorId, nomineeId, reason = "", source = "manual" } = {}, rng = Math.random) {
  if (state.phase !== "day" || state.dayStage !== "nomination" || state.gameOver) {
    return { ok: false, reason: "当前不在提名阶段。" };
  }
  state.dayStageMeta = state.dayStageMeta ?? {};
  if (state.dayStageMeta.nominationDebate?.active) {
    return { ok: true, debate: state.dayStageMeta.nominationDebate, message: "已有待处理的提名互辩。" };
  }
  const nominator = getPlayerById(state, nominatorId);
  const nominee = getPlayerById(state, nomineeId);
  if (!nominator || !nominee) {
    return { ok: false, reason: "提名者或被提名者不存在。" };
  }
  if (!nominator.alive) {
    return { ok: false, reason: "死亡玩家无法发起提名。" };
  }
  if (nominator.nominatedToday) {
    return { ok: false, reason: `${nominator.name} 今天已提名过。` };
  }
  if (nominee.beenNominatedToday) {
    return { ok: false, reason: `${nominee.name} 今天已被提名过。` };
  }
  const nominationReason = `${reason ?? ""}`.trim() || `我提 ${nominee.name}。先把这个位置放上台，听完整回应再看票。`;
  const lines = [
    {
      speakerId: nominator.id,
      role: "nominator",
      text: nominationReason,
    },
    {
      speakerId: nominee.id,
      role: "nominee",
      text: nominationDefenseLine(state, nominee, nominator, nominationReason, rng),
      pending: !!nominee.isHuman,
    },
  ];
  const debate = {
    active: true,
    nominationId: nextNominationDebateId(state),
    day: state.day ?? 0,
    nominatorId: nominator.id,
    nomineeId: nominee.id,
    source,
    reason: nominationReason,
    lines,
    nextAction: "vote",
    createdAt: Date.now(),
  };
  state.dayStageMeta.nominationDebate = debate;
  state.events.nominationDebates = state.events.nominationDebates ?? [];
  state.events.nominationDebates.push(debate);
  addLog(state, "nomination-debate", `${nominator.name} 提名 ${nominee.name}，进入互辩。`, {
    nominationId: debate.nominationId,
    nominatorId: nominator.id,
    nomineeId: nominee.id,
  });
  pushTimeline(state, {
    mode: "nomination-debate",
    speakerId: nominator.id,
    targetId: nominee.id,
    text: `${nominator.name} 提名 ${nominee.name}，先互辩再投票。`,
    nominationId: debate.nominationId,
  });
  return { ok: true, debate, message: `${nominator.name} 提名 ${nominee.name}，进入互辩。` };
}

export function recordNominationDebateResponse(state, { speakerId = "", text = "" } = {}) {
  const debate = state.dayStageMeta?.nominationDebate;
  if (!debate?.active) {
    return { ok: false, reason: "当前没有待回应的提名互辩。" };
  }
  const human = state.players?.find((player) => player.isHuman);
  const speaker = getPlayerById(state, speakerId || human?.id);
  if (!speaker) {
    return { ok: false, reason: "回应者不存在。" };
  }
  if (speaker.id !== debate.nominatorId && speaker.id !== debate.nomineeId) {
    return { ok: false, reason: "只有提名者和被提名者可以在互辩中发言。" };
  }
  const role = speaker.id === debate.nominatorId ? "nominator" : "nominee";
  const responseText = sanitizeNominationDebateResponse(text) || defaultHumanNominationDebateResponse(state, speaker, debate);
  const existing = debate.lines?.find((line) => line.speakerId === speaker.id && line.role === role);
  if (existing?.pending) {
    existing.text = responseText;
    existing.pending = false;
  } else {
    debate.lines = debate.lines ?? [];
    debate.lines.push({
      speakerId: speaker.id,
      role,
      text: responseText,
      pending: false,
    });
  }
  debate.updatedAt = Date.now();
  state.events.nominationDebateResponses = state.events.nominationDebateResponses ?? [];
  state.events.nominationDebateResponses.push({
    day: state.day ?? 0,
    nominationId: debate.nominationId,
    speakerId: speaker.id,
    role,
    text: responseText,
  });
  pushTimeline(state, {
    mode: "nomination-debate-response",
    speakerId: speaker.id,
    targetId: role === "nominator" ? debate.nomineeId : debate.nominatorId,
    text: `${speaker.name} 回应提名：${responseText}`,
    nominationId: debate.nominationId,
  });
  return { ok: true, debate, message: `${speaker.name} 已回应这次提名。` };
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
  const hadStatementMemory = !!state.aiDialogue?.statementMemory;
  const statementMemorySnapshot = hadStatementMemory
    ? structuredClone(state.aiDialogue.statementMemory)
    : null;
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
  if (state.aiDialogue) {
    if (hadStatementMemory) {
      state.aiDialogue.statementMemory = statementMemorySnapshot;
    } else {
      delete state.aiDialogue.statementMemory;
    }
  }
  return rows;
}
