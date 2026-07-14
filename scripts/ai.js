import { clamp, REASON_SNIPPETS, sample } from "./data.js";
import {
  acceptNominationBeforeVote,
  addLog,
  consumePrivateChat,
  getAlivePlayers,
  getEffectiveRoleId,
  hasExecutionToday,
  getPlayerById,
  getPubliclyAlivePlayers,
  registersAsAlive,
} from "./engine.js";
import { inferSpeechActsFromIntent, recordUtteranceMVP } from "./dialogue_schema.js";
import { predictDialogueSignals, voteLabelToInGameStance } from "./ml_runtime.js";
import { createAIPrivateSocial } from "./ai_private_social.js";
import { createAIPublicDiscussion } from "./ai_public_discussion.js";
import {
  attachClaimDisclosureRationaleSpokenLine,
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
  sanitizePlayerVisibleText,
  shortReasonText,
} from "./ai_speech_renderer.js";
import {
  applyPrivateDialogueTurnTaking,
  applyPrivateStatementContinuity,
  applyPublicStatementContinuity as applyPublicStatementContinuityFromMemory,
  currentPublicStatementMemory,
  dayStanceLabel,
  getSharedInfoMemory,
  publicStatementMemoryMatches,
  publicStatementMemoryPressure,
  publicStatementNominationReason,
  publicStatementVoteThresholdShift,
  rememberSharedInfoMemory,
  rememberStatementMemory,
  summarizeSharedInfoRepeat,
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
  buildAgentStrategyView,
  buildAIStrategyContext,
  buildEvilWorldPlan,
  buildLightweightWorldCandidates,
  countPriorNoExecutionVoteDays,
  evilWorldPlanTargetBias,
  evaluateGameWindow,
  evaluateGoodDayStrategy,
  nominationIntentForCandidate,
  serializeStrategyContext,
  simulateCoalitionVote,
  voteThresholdAdjustment,
} from "./ai_strategy.js";
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
  getDialogueEvidenceForTarget,
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
export {
  buildAgentStrategyView,
  buildAIStrategyContext,
  buildEvilWorldPlan,
  buildLightweightWorldCandidates,
  evaluateGameWindow,
  evaluateGoodDayStrategy,
  simulateCoalitionVote,
} from "./ai_strategy.js";

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
  state.aiDialogue.stanceHistoryBySpeakerId = state.aiDialogue.stanceHistoryBySpeakerId ?? {};
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

function dialogueEventAnchor(state, options = {}) {
  const timestamp = Number.isFinite(Number(options.timestamp)) ? Number(options.timestamp) : Date.now();
  const speakerId = options.speakerId ?? "";
  const targetId = options.targetId ?? "";
  const eventId =
    options.eventId ??
    `${options.mode ?? "dialogue"}-${state.day ?? 0}-${speakerId || "speaker"}-${targetId || "target"}-${timestamp}`;
  return {
    eventId,
    timelineEntryId: options.timelineEntryId ?? eventId,
    mode: options.mode ?? "dialogue",
    source: options.source ?? "dialogue",
    audience: options.audience ?? "",
    speakerId,
    targetId,
    focusId: options.focusId ?? "",
    visibility: options.visibility ?? "",
    day: state.day ?? 0,
    night: state.night ?? 0,
    timestamp,
    text: options.text ?? "",
  };
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

const STANCE_HISTORY_LIMIT = 24;

function normalizedDay(value) {
  const day = Number(value ?? 0);
  return Number.isFinite(day) ? day : 0;
}

function stanceHistoryLedger(state, aiPlayer) {
  const dialogue = ensureDialogueState(state);
  dialogue.stanceHistoryBySpeakerId[aiPlayer.id] = dialogue.stanceHistoryBySpeakerId[aiPlayer.id] ?? {};
  return dialogue.stanceHistoryBySpeakerId[aiPlayer.id];
}

function findLatestPriorStance(history, currentDay) {
  if (!Array.isArray(history)) {
    return null;
  }
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const entry = history[index];
    if (normalizedDay(entry?.day) < currentDay) {
      return entry;
    }
  }
  return null;
}

function entryEvidenceCount(entry) {
  return Number.isFinite(entry?.evidenceCount) ? entry.evidenceCount : null;
}

function entryReasonSummary(entry) {
  return entry?.lastReasonSummary ?? entry?.reasonSummary ?? entry?.firstReasonSummary ?? "";
}

function entryEvidenceSnippets(entry) {
  if (Array.isArray(entry?.lastEvidenceSnippets)) {
    return entry.lastEvidenceSnippets;
  }
  return Array.isArray(entry?.evidenceSnippets) ? entry.evidenceSnippets : [];
}

function entryEvidenceAnchors(entry) {
  if (Array.isArray(entry?.lastEvidenceAnchors)) {
    return entry.lastEvidenceAnchors;
  }
  return Array.isArray(entry?.evidenceAnchors) ? entry.evidenceAnchors : [];
}

function entryEventAnchors(entry) {
  if (Array.isArray(entry?.lastEventAnchors)) {
    return entry.lastEventAnchors;
  }
  return Array.isArray(entry?.eventAnchors) ? entry.eventAnchors : [];
}

function entryScoreTrailAnchors(entry) {
  if (Array.isArray(entry?.lastScoreTrailAnchors)) {
    return entry.lastScoreTrailAnchors;
  }
  return Array.isArray(entry?.scoreTrailAnchors) ? entry.scoreTrailAnchors : [];
}

function stanceScoreValue(entry) {
  const value = Number.isFinite(entry?.lastScore) ? entry.lastScore : entry?.firstScore;
  return Number.isFinite(value) ? value : null;
}

function stancePriority(entry) {
  const stance = entry?.stance ?? "";
  if (stance === "press") return 3;
  if (stance === "watch") return 2;
  if (stance === "trust") return 1;
  return 0;
}

function stanceEntryHasPublicAnchor(entry) {
  const anchors = [...entryEvidenceAnchors(entry), ...entryEventAnchors(entry), ...entryScoreTrailAnchors(entry)];
  return anchors.some((anchor) => anchor?.visibility === "public" || anchor?.audience === "public" || anchor?.mode === "public");
}

function stanceEntryIsPublicSafe(entry) {
  const sources = Array.isArray(entry?.sources) ? entry.sources : [];
  return sources.some((source) => /public|quality-fixture/i.test(`${source ?? ""}`)) || stanceEntryHasPublicAnchor(entry);
}

function findCurrentDayStance(history, currentDay) {
  if (!Array.isArray(history)) {
    return null;
  }
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const entry = history[index];
    if (normalizedDay(entry?.day) === currentDay) {
      return entry;
    }
  }
  return null;
}

function stanceReasonSummary(details = {}) {
  const raw =
    details.reasonSummary ??
    details.evidenceSummary ??
    details.spokenText ??
    details.text ??
    "";
  const summary = shortReasonText(raw, 34);
  return summary.replace(/[。！？；\s]+$/u, "").trim();
}

function stanceEvidenceSnippets(details = {}) {
  const rawEntries = [
    ...(Array.isArray(details.evidenceSourceSnippets) ? details.evidenceSourceSnippets : []),
    ...(Array.isArray(details.evidenceSnippets) ? details.evidenceSnippets : []),
    ...(Array.isArray(details.evidenceSummaries) ? details.evidenceSummaries : []),
    ...(details.reasonSummary ? [details.reasonSummary] : []),
  ];
  return [...new Set(
    rawEntries
      .map((entry) => shortReasonText(entry, 42).replace(/[。！？；\s]+$/u, "").trim())
    .filter(Boolean)
  )].slice(0, 3);
}

function stanceEvidenceAnchors(details = {}) {
  const rawAnchors = [
    ...(Array.isArray(details.evidenceAnchors) ? details.evidenceAnchors : []),
    ...(Array.isArray(details.evidenceSourceAnchors) ? details.evidenceSourceAnchors : []),
  ];
  return rawAnchors
    .map((entry) => ({
      evidenceId: entry?.evidenceId ?? entry?.id ?? "",
      observationId: entry?.observationId ?? "",
      kind: entry?.kind ?? entry?.evidenceKind ?? "",
      source: entry?.source ?? "",
      sourceId: entry?.sourceId ?? "",
      visibility: entry?.visibility ?? "",
      day: Number.isFinite(Number(entry?.day)) ? Number(entry.day) : 0,
      night: Number.isFinite(Number(entry?.night)) ? Number(entry.night) : 0,
      timestamp: Number.isFinite(Number(entry?.timestamp)) ? Number(entry.timestamp) : 0,
      text: shortReasonText(entry?.dialogueSummary ?? entry?.text ?? "", 42),
    }))
    .filter((entry) => entry.evidenceId || entry.observationId || entry.text)
    .filter((entry, index, arr) => {
      const key = `${entry.evidenceId}:${entry.observationId}:${entry.text}`;
      return arr.findIndex((candidate) => `${candidate.evidenceId}:${candidate.observationId}:${candidate.text}` === key) === index;
    })
    .slice(0, 3);
}

function stanceEventAnchors(details = {}) {
  const rawAnchors = [
    ...(Array.isArray(details.eventAnchors) ? details.eventAnchors : []),
    ...(Array.isArray(details.sourceEventAnchors) ? details.sourceEventAnchors : []),
    details.sourceEventAnchor,
  ].filter(Boolean);
  return rawAnchors
    .map((entry) => ({
      eventId: entry?.eventId ?? entry?.id ?? "",
      timelineEntryId: entry?.timelineEntryId ?? entry?.eventId ?? entry?.id ?? "",
      mode: entry?.mode ?? "",
      source: entry?.source ?? "",
      audience: entry?.audience ?? "",
      speakerId: entry?.speakerId ?? "",
      targetId: entry?.targetId ?? "",
      focusId: entry?.focusId ?? entry?.targetId ?? "",
      visibility: entry?.visibility ?? "",
      day: Number.isFinite(Number(entry?.day)) ? Number(entry.day) : 0,
      night: Number.isFinite(Number(entry?.night)) ? Number(entry.night) : 0,
      timestamp: Number.isFinite(Number(entry?.timestamp)) ? Number(entry.timestamp) : 0,
      focusScore: Number.isFinite(Number(entry?.focusScore)) ? Number(entry.focusScore) : null,
      text: shortReasonText(entry?.text ?? entry?.dialogueSummary ?? entry?.line ?? "", 52),
    }))
    .filter((entry) => entry.eventId || entry.timelineEntryId || entry.text)
    .filter((entry, index, arr) => {
      const key = `${entry.eventId}:${entry.timelineEntryId}:${entry.timestamp}:${entry.text}`;
      return arr.findIndex((candidate) => `${candidate.eventId}:${candidate.timelineEntryId}:${candidate.timestamp}:${candidate.text}` === key) === index;
    })
    .slice(0, 3);
}

function stanceScoreTrailAnchors(details = {}) {
  const rawAnchors = [
    ...(Array.isArray(details.scoreTrailAnchors) ? details.scoreTrailAnchors : []),
    ...(Array.isArray(details.scoreMovementAnchors) ? details.scoreMovementAnchors : []),
  ];
  return rawAnchors
    .map((entry) => ({
      trailId: entry?.trailId ?? entry?.id ?? "",
      evidenceId: entry?.evidenceId ?? "",
      observationId: entry?.observationId ?? "",
      reasonKey: entry?.reasonKey ?? "",
      kind: entry?.kind ?? entry?.evidenceKind ?? "",
      source: entry?.source ?? "",
      sourceId: entry?.sourceId ?? "",
      visibility: entry?.visibility ?? "",
      day: Number.isFinite(Number(entry?.day)) ? Number(entry.day) : 0,
      night: Number.isFinite(Number(entry?.night)) ? Number(entry.night) : 0,
      timestamp: Number.isFinite(Number(entry?.timestamp)) ? Number(entry.timestamp) : 0,
      before: Number.isFinite(Number(entry?.before)) ? Number(entry.before) : null,
      after: Number.isFinite(Number(entry?.after)) ? Number(entry.after) : null,
      appliedDelta: Number.isFinite(Number(entry?.appliedDelta)) ? Number(entry.appliedDelta) : null,
      text: shortReasonText(entry?.text ?? "", 52),
    }))
    .filter((entry) => entry.trailId || entry.evidenceId || entry.observationId || entry.text)
    .filter((entry, index, arr) => {
      const key = `${entry.trailId}:${entry.evidenceId}:${entry.observationId}:${entry.timestamp}:${entry.text}`;
      return arr.findIndex(
        (candidate) => `${candidate.trailId}:${candidate.evidenceId}:${candidate.observationId}:${candidate.timestamp}:${candidate.text}` === key
      ) === index;
    })
    .slice(0, 3);
}

function fallbackStanceScoreTrailAnchors({ aiPlayer, targetId, day, previousScore, currentScore, evidenceAnchors = [], reasonSummary = "" } = {}) {
  if (!Number.isFinite(Number(currentScore))) {
    return [];
  }
  const before = Number.isFinite(Number(previousScore)) ? Number(previousScore) : Number(currentScore);
  const after = Number(currentScore);
  const appliedDelta = Math.round((after - before) * 1000) / 1000;
  return evidenceAnchors.slice(0, 3).map((anchor, index) => ({
    trailId: `stance-${aiPlayer?.id ?? "ai"}-${targetId ?? "target"}-${day ?? 0}-${index}`,
    evidenceId: anchor?.evidenceId ?? "",
    observationId: anchor?.observationId ?? "",
    reasonKey: "stance-score-anchor",
    kind: anchor?.kind ?? "",
    source: anchor?.source ?? "",
    sourceId: anchor?.sourceId ?? "",
    visibility: anchor?.visibility ?? "",
    day: Number.isFinite(Number(anchor?.day)) ? Number(anchor.day) : Number(day ?? 0),
    night: Number.isFinite(Number(anchor?.night)) ? Number(anchor.night) : 0,
    timestamp: Number.isFinite(Number(anchor?.timestamp)) ? Number(anchor.timestamp) : 0,
    before,
    after,
    appliedDelta,
    text: shortReasonText(anchor?.text || reasonSummary || "", 52),
  })).filter((anchor) => anchor.evidenceId || anchor.observationId || anchor.text);
}

function stanceScoreTrailOverlapsEvidence(scoreAnchors = [], evidenceAnchors = [], evidenceSnippets = []) {
  const evidenceText = [
    ...evidenceAnchors.map((anchor) => anchor?.text ?? ""),
    ...evidenceSnippets,
  ]
    .map((entry) => shortReasonText(entry, 32).replace(/[銆傦紒锛燂紱\s]+$/u, "").trim())
    .filter(Boolean);
  if (scoreAnchors.length === 0 || evidenceText.length === 0) {
    return false;
  }
  return scoreAnchors.some((anchor) => {
    const anchorText = shortReasonText(anchor?.text ?? "", 32);
    return evidenceText.some((entry) => {
      const anchorHead = anchorText.slice(0, Math.min(10, anchorText.length));
      const entryHead = entry.slice(0, Math.min(10, entry.length));
      return !!anchorHead && !!entryHead && (anchorText.includes(entryHead) || entry.includes(anchorHead));
    });
  });
}

function roundedEvidenceDelta(previousCount, currentCount) {
  if (!Number.isFinite(previousCount) || !Number.isFinite(currentCount)) {
    return null;
  }
  return Math.max(-9, Math.min(9, Math.round(currentCount - previousCount)));
}

function crossDayEvidenceDeltaText(evidenceDelta) {
  if (!Number.isFinite(evidenceDelta)) {
    return "";
  }
  if (evidenceDelta > 0) {
    return `比昨天多${evidenceDelta}条可见线索`;
  }
  if (evidenceDelta < 0) {
    return `比昨天少${Math.abs(evidenceDelta)}条可见线索`;
  }
  return "证据量没少";
}

function targetSwitchCurrentReasonClause(reason, currentName, fallbackText) {
  const value = `${reason ?? ""}`
    .replaceAll("…", "...")
    .replace(/^两条线索合在一起：/u, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!value) {
    return fallbackText;
  }
  if (/公开站队和台面压力/u.test(value) && /票型反着走/u.test(value)) {
    return `${currentName}的公开线和票型需要重新对账`;
  }
  if (/公开站队和台面压力/u.test(value)) {
    return `${currentName}的公开压力要重新对齐`;
  }
  if (/票型反着走/u.test(value)) {
    return `${currentName}的票型需要重新对账`;
  }
  const shortened = shortReasonText(value, 24).replace(/[。！？；\s]+$/u, "").trim();
  return /(?:\.{3,}|…)/u.test(shortened) ? fallbackText : shortened;
}

function crossDayChangeSummary(previousReason, currentReason, evidenceDelta, continuity) {
  const current = shortReasonText(currentReason, 16);
  const previous = shortReasonText(previousReason, 14);
  const deltaText = crossDayEvidenceDeltaText(evidenceDelta);
  if (continuity === "shift") {
    if (current && deltaText) {
      return `${current}，${deltaText}`;
    }
    return current || deltaText || "新信息更重";
  }
  if (current && deltaText) {
    return `${current}，${deltaText}`;
  }
  return current || deltaText || previous || "昨天线没被洗掉";
}

function rememberCrossDayStance(state, aiPlayer, targetId, score, source, stance, details = {}) {
  if (!aiPlayer?.id || !targetId) {
    return null;
  }
  const day = normalizedDay(state.day);
  const ledger = stanceHistoryLedger(state, aiPlayer);
  const history = Array.isArray(ledger[targetId]) ? ledger[targetId] : [];
  const previous = findLatestPriorStance(history, day);
  const reasonSummary = stanceReasonSummary(details);
  const evidenceSnippets = stanceEvidenceSnippets(details);
  const evidenceAnchors = stanceEvidenceAnchors(details);
  const eventAnchors = stanceEventAnchors(details);
  const scoreTrailAnchors = stanceScoreTrailAnchors(details);
  const evidenceCount = Number.isFinite(details.evidenceCount) ? details.evidenceCount : null;
  let current = history.find((entry) => normalizedDay(entry.day) === day);
  if (!current) {
    current = {
      day,
      targetId,
      stance,
      firstScore: Number.isFinite(score) ? score : null,
      lastScore: Number.isFinite(score) ? score : null,
      sources: [],
      turns: 0,
    };
    if (reasonSummary) {
      current.firstReasonSummary = reasonSummary;
    }
    history.push(current);
  }

  current.stance = stance;
  current.lastScore = Number.isFinite(score) ? score : current.lastScore;
  current.sources = [...new Set([...(current.sources ?? []), source])];
  if (reasonSummary) {
    current.reasonSummary = reasonSummary;
    current.lastReasonSummary = reasonSummary;
    current.firstReasonSummary = current.firstReasonSummary || reasonSummary;
  }
  if (evidenceCount !== null) {
    current.evidenceCount = evidenceCount;
  }
  if (evidenceSnippets.length > 0) {
    current.evidenceSnippets = evidenceSnippets;
    current.lastEvidenceSnippets = evidenceSnippets;
  }
  if (evidenceAnchors.length > 0) {
    current.evidenceAnchors = evidenceAnchors;
    current.lastEvidenceAnchors = evidenceAnchors;
  }
  if (eventAnchors.length > 0) {
    current.eventAnchors = eventAnchors;
    current.lastEventAnchors = eventAnchors;
  }
  if (scoreTrailAnchors.length > 0) {
    current.scoreTrailAnchors = scoreTrailAnchors;
    current.lastScoreTrailAnchors = scoreTrailAnchors;
  }
  current.turns = (current.turns ?? 0) + 1;
  ledger[targetId] = history.slice(-STANCE_HISTORY_LIMIT);

  if (!previous) {
    if ((current.lastScoreTrailAnchors?.length ?? 0) === 0 && evidenceAnchors.length > 0) {
      const baselineAnchors = fallbackStanceScoreTrailAnchors({
        aiPlayer,
        targetId,
        day,
        previousScore: current.firstScore,
        currentScore: Number.isFinite(score) ? score : current.lastScore,
        evidenceAnchors,
        reasonSummary,
      });
      if (baselineAnchors.length > 0) {
        current.scoreTrailAnchors = baselineAnchors;
        current.lastScoreTrailAnchors = baselineAnchors;
      }
    }
    return null;
  }
  const dayGap = Math.max(1, day - normalizedDay(previous.day));
  const previousReasonSummary = previous.lastReasonSummary ?? previous.reasonSummary ?? previous.firstReasonSummary ?? "";
  const currentReasonSummary = current.lastReasonSummary ?? current.reasonSummary ?? current.firstReasonSummary ?? "";
  const previousEvidenceCount = Number.isFinite(previous.evidenceCount) ? previous.evidenceCount : null;
  const currentEvidenceCount = Number.isFinite(current.evidenceCount) ? current.evidenceCount : null;
  const previousEvidenceSnippets = Array.isArray(previous.lastEvidenceSnippets)
    ? previous.lastEvidenceSnippets
    : Array.isArray(previous.evidenceSnippets)
    ? previous.evidenceSnippets
    : [];
  const currentEvidenceSnippets = Array.isArray(current.lastEvidenceSnippets)
    ? current.lastEvidenceSnippets
    : Array.isArray(current.evidenceSnippets)
    ? current.evidenceSnippets
    : [];
  const previousEvidenceAnchors = Array.isArray(previous.lastEvidenceAnchors)
    ? previous.lastEvidenceAnchors
    : Array.isArray(previous.evidenceAnchors)
    ? previous.evidenceAnchors
    : [];
  const currentEvidenceAnchors = Array.isArray(current.lastEvidenceAnchors)
    ? current.lastEvidenceAnchors
    : Array.isArray(current.evidenceAnchors)
    ? current.evidenceAnchors
    : [];
  const previousEventAnchors = Array.isArray(previous.lastEventAnchors)
    ? previous.lastEventAnchors
    : Array.isArray(previous.eventAnchors)
    ? previous.eventAnchors
    : [];
  const currentEventAnchors = Array.isArray(current.lastEventAnchors)
    ? current.lastEventAnchors
    : Array.isArray(current.eventAnchors)
    ? current.eventAnchors
    : [];
  const previousScoreTrailAnchors = Array.isArray(previous.lastScoreTrailAnchors)
    ? previous.lastScoreTrailAnchors
    : Array.isArray(previous.scoreTrailAnchors)
    ? previous.scoreTrailAnchors
    : [];
  let currentScoreTrailAnchors = Array.isArray(current.lastScoreTrailAnchors)
    ? current.lastScoreTrailAnchors
    : Array.isArray(current.scoreTrailAnchors)
    ? current.scoreTrailAnchors
    : [];
  const previousScoreValue = Number.isFinite(previous.lastScore) ? previous.lastScore : previous.firstScore;
  const currentScoreValue = Number.isFinite(score) ? score : current.lastScore;
  if (
    currentEvidenceAnchors.length > 0 &&
    (currentScoreTrailAnchors.length === 0 ||
      !stanceScoreTrailOverlapsEvidence(currentScoreTrailAnchors, currentEvidenceAnchors, currentEvidenceSnippets))
  ) {
    const fallbackAnchors = fallbackStanceScoreTrailAnchors({
      aiPlayer,
      targetId,
      day,
      previousScore: previousScoreValue,
      currentScore: currentScoreValue,
      evidenceAnchors: currentEvidenceAnchors,
      reasonSummary: currentReasonSummary,
    });
    currentScoreTrailAnchors = [...fallbackAnchors, ...currentScoreTrailAnchors].slice(0, 3);
    if (currentScoreTrailAnchors.length > 0) {
      current.scoreTrailAnchors = currentScoreTrailAnchors;
      current.lastScoreTrailAnchors = currentScoreTrailAnchors;
    }
  }
  const evidenceDelta = roundedEvidenceDelta(previousEvidenceCount, currentEvidenceCount);
  const continuity = previous.stance === stance ? "hold" : "shift";
  const changeSummary = crossDayChangeSummary(previousReasonSummary, currentReasonSummary, evidenceDelta, continuity);
  return {
    kind: "cross-day-stance",
    speakerId: aiPlayer.id,
    targetId,
    previousDay: normalizedDay(previous.day),
    currentDay: day,
    dayGap,
    previousStance: previous.stance,
    currentStance: stance,
    previousScore: Number.isFinite(previousScoreValue) ? previousScoreValue : null,
    currentScore: Number.isFinite(currentScoreValue) ? currentScoreValue : null,
    previousReasonSummary,
    currentReasonSummary,
    previousEvidenceCount,
    currentEvidenceCount,
    previousEvidenceSnippets,
    currentEvidenceSnippets,
    previousEvidenceAnchors,
    currentEvidenceAnchors,
    previousEventAnchors,
    currentEventAnchors,
    previousScoreTrailAnchors,
    currentScoreTrailAnchors,
    evidenceDelta,
    changeSummary,
    previousSources: previous.sources ?? [],
    currentSources: current.sources ?? [],
    continuity,
  };
}

function buildCrossDayTargetSwitchContinuity(state, aiPlayer, targetId, options = {}) {
  if (!aiPlayer?.id || !targetId) {
    return null;
  }
  if (options.stanceMemory?.crossDayStance) {
    return null;
  }
  const day = normalizedDay(state?.day);
  const ledger = stanceHistoryLedger(state, aiPlayer);
  const currentHistory = Array.isArray(ledger[targetId]) ? ledger[targetId] : [];
  const current = findCurrentDayStance(currentHistory, day);
  if (!current) {
    return null;
  }
  if (options.publicOnly && !stanceEntryIsPublicSafe(current)) {
    return null;
  }

  const candidates = Object.entries(ledger)
    .filter(([candidateTargetId]) => candidateTargetId !== targetId)
    .map(([candidateTargetId, history]) => {
      const previous = findLatestPriorStance(history, day);
      return previous ? { targetId: candidateTargetId, previous } : null;
    })
    .filter(Boolean)
    .filter(({ previous }) => !options.publicOnly || stanceEntryIsPublicSafe(previous));

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => {
    const dayDelta = normalizedDay(b.previous?.day) - normalizedDay(a.previous?.day);
    if (dayDelta !== 0) return dayDelta;
    const scoreDelta = (stanceScoreValue(b.previous) ?? 0) - (stanceScoreValue(a.previous) ?? 0);
    if (Math.abs(scoreDelta) > 0.001) return scoreDelta;
    return stancePriority(b.previous) - stancePriority(a.previous);
  });

  const { targetId: previousTargetId, previous } = candidates[0];
  const previousScore = stanceScoreValue(previous);
  const currentScore = stanceScoreValue(current);
  const previousEvidenceCount = entryEvidenceCount(previous);
  const currentEvidenceCount = entryEvidenceCount(current);
  const evidenceDelta = roundedEvidenceDelta(previousEvidenceCount, currentEvidenceCount);
  if (
    (currentEvidenceCount ?? 0) <= 0 &&
    Number.isFinite(currentScore) &&
    Number.isFinite(previousScore) &&
    currentScore < previousScore + 0.04
  ) {
    return null;
  }

  return {
    kind: "cross-day-target-switch",
    speakerId: aiPlayer.id,
    previousTargetId,
    currentTargetId: targetId,
    previousDay: normalizedDay(previous.day),
    currentDay: day,
    dayGap: Math.max(1, day - normalizedDay(previous.day)),
    previousStance: previous.stance ?? "",
    currentStance: current.stance ?? options.stanceMemory?.stance ?? (Number.isFinite(currentScore) ? stanceFromScore(currentScore) : ""),
    previousScore,
    currentScore,
    previousReasonSummary: entryReasonSummary(previous),
    currentReasonSummary: entryReasonSummary(current),
    previousEvidenceCount,
    currentEvidenceCount,
    evidenceDelta,
    previousEvidenceSnippets: entryEvidenceSnippets(previous),
    currentEvidenceSnippets: entryEvidenceSnippets(current),
    previousEvidenceAnchors: entryEvidenceAnchors(previous),
    currentEvidenceAnchors: entryEvidenceAnchors(current),
    previousEventAnchors: entryEventAnchors(previous),
    currentEventAnchors: entryEventAnchors(current),
    previousScoreTrailAnchors: entryScoreTrailAnchors(previous),
    currentScoreTrailAnchors: entryScoreTrailAnchors(current),
    previousSources: previous.sources ?? [],
    currentSources: current.sources ?? [],
  };
}

function buildDecisionTargetSwitchLine(state, targetSwitch) {
  if (!targetSwitch?.previousTargetId || !targetSwitch?.currentTargetId) {
    return "";
  }
  const previousName = statementTargetLabel(state, targetSwitch.previousTargetId);
  const currentName = statementTargetLabel(state, targetSwitch.currentTargetId);
  const dayWord = targetSwitch.dayGap === 1 ? "昨天" : `${targetSwitch.dayGap}天前`;
  const evidenceDelta = Number(targetSwitch.evidenceDelta ?? 0);
  const evidenceText =
    evidenceDelta > 0
      ? `多出 ${evidenceDelta} 条可见证据`
      : Number.isFinite(targetSwitch.currentEvidenceCount) && targetSwitch.currentEvidenceCount > 0
      ? `有 ${targetSwitch.currentEvidenceCount} 条可见证据`
      : "公开回应更需要先听";
  const currentReason = targetSwitchCurrentReasonClause(targetSwitch.currentReasonSummary ?? "", currentName, evidenceText);
  const currentClause = currentReason ? `新卡点是${currentReason}` : evidenceText;
  return `记忆连续性：${dayWord}主线在 ${previousName}，今天先转 ${currentName}，不等于放掉 ${previousName}；${currentClause}。`;
}

function rememberDayStance(state, aiPlayer, targetId, score, source = "dialogue", details = {}) {
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
      crossDayStance: rememberCrossDayStance(state, aiPlayer, targetId, score, source, nextStance, details),
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
  existing.crossDayStance = rememberCrossDayStance(state, aiPlayer, targetId, score, source, existing.stance, details);
  return existing;
}

export function crossDayStanceContinuityLine(state, aiPlayer, targetId, stanceMemory, options = {}) {
  const crossDay = stanceMemory?.crossDayStance;
  if (!crossDay || !Number.isFinite(crossDay.previousDay) || !targetId || crossDay.targetId !== targetId) {
    return "";
  }
  const targetName = options.targetName || statementTargetLabel(state, targetId);
  const currentLabel = dayStanceLabel(crossDay.currentStance ?? stanceMemory.stance);
  const previousLabel = dayStanceLabel(crossDay.previousStance);
  const dayWord = crossDay.dayGap === 1 ? "昨天" : `${crossDay.dayGap}天前`;
  const deltaClause =
    crossDayEvidenceDeltaText(Number(crossDay.evidenceDelta)) ||
    (crossDay.continuity === "shift" ? "新信息更重" : "旧线没被洗掉");
  if (options.compact) {
    return crossDay.continuity === "hold"
      ? `${dayWord}也盯 ${targetName}，今天${deltaClause}。`
      : `${dayWord}对 ${targetName} 是“${previousLabel}”，今天转“${currentLabel}”，因为${deltaClause}。`;
  }
  if (crossDay.continuity === "hold") {
    return `这条不是今天新起的，${dayWord}我也把 ${targetName} 放在“${currentLabel}”，今天${deltaClause}。`;
  }
  return `${dayWord}我对 ${targetName} 还是“${previousLabel}”，今天改成“${currentLabel}”，因为${deltaClause}。`;
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
  aiPlayer.dialogueBiasMeta = aiPlayer.dialogueBiasMeta ?? {};
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
  const evidenceTextById = state
    ? new Map(getAgentEvidence(state, aiPlayer).map((entry) => [entry.id, `${entry.text ?? ""}`]))
    : new Map();
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
      const edgeText = evidenceTextById.get(edge.evidenceId) ?? "";
      const explicitlyDefendsHotTarget = /维护.*高压|高压目标|高压位|帮.*卸压/.test(edgeText);
      if (defendedPressure >= 0.62 || explicitlyDefendsHotTarget) {
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
  const evidenceTextById = state
    ? new Map(getAgentEvidence(state, aiPlayer).map((entry) => [entry.id, `${entry.text ?? ""}`]))
    : new Map();
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
      const edgeText = evidenceTextById.get(edge.evidenceId) ?? "";
      const explicitlyDefendsHotTarget = /维护.*高压|高压目标|高压位|帮.*卸压/.test(edgeText);
      if (pressure >= 0.62 || explicitlyDefendsHotTarget) {
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

function targetEvidenceCountForScoring(state, aiPlayer, target, options = {}) {
  if (!target?.id) {
    return 0;
  }
  if (options.publicOnly || options.audience === "public") {
    return getDialogueEvidenceForTarget(state, aiPlayer, target.id, { publicOnly: true, includePrivate: false }).length;
  }
  return countAgentEvidence(getAIAgent(state, aiPlayer), target.id);
}

function initialSuspicionForScoring(state, aiPlayer, target) {
  if (!target?.id || target.id === aiPlayer?.id) {
    return 0.01;
  }
  if (areKnownAllies(state, aiPlayer, target)) {
    return 0.08;
  }
  return evilPrior(state, aiPlayer);
}

function publicMechanicTargetScore(state, aiPlayer, target) {
  if (state?.scriptId !== "snv" || !aiPlayer?.id || !target?.id) {
    return null;
  }
  const pair = state.snv?.evilTwinPair;
  if (!pair?.evilTwinId || !pair?.goodTwinId || aiPlayer.id !== pair.goodTwinId) {
    return null;
  }
  const evilTwin = getPlayerById(state, pair.evilTwinId);
  const opposingTwinId = pair.opposingTwinId ?? pair.evilTwinId;
  const blockedEvilTwin =
    !!evilTwin?.poisoned ||
    (state.snv?.snakeCharmerPoisonedIds ?? []).includes(evilTwin?.id);
  if (!evilTwin?.alive || blockedEvilTwin || getEffectiveRoleId(evilTwin) !== "evil-twin") {
    return null;
  }
  const mechanicTargetId = pair.goodTwinId === pair.evilTwinId ? opposingTwinId : pair.evilTwinId;
  return target.id === mechanicTargetId ? 0.86 : null;
}

function publicBaseTargetScore(state, aiPlayer, target) {
  if (!target?.id) {
    return 0.5;
  }
  let score = initialSuspicionForScoring(state, aiPlayer, target);
  const mechanicScore = publicMechanicTargetScore(state, aiPlayer, target);
  if (Number.isFinite(mechanicScore)) {
    score = Math.max(score, mechanicScore);
  }
  getSuspicionTrailForTarget(state, aiPlayer, target.id)
    .filter((entry) => entry.visibility === "public")
    .forEach((entry) => {
      score = clamp(score + (Number(entry.appliedDelta) || 0), 0.01, 0.99);
    });
  const biasMeta = aiPlayer.dialogueBiasMeta?.[target.id] ?? null;
  if (!biasMeta || ["public", "mechanic"].includes(biasMeta.visibility)) {
    score = clamp(score + (Number(aiPlayer.dialogueBias?.[target.id]) || 0) * 0.6, 0.01, 0.99);
  }
  return target.id === aiPlayer?.id ? 0.01 : clamp(score, 0.08, 0.88);
}

function reasonFlagsForScoring(state, aiPlayer, target, options = {}) {
  if (!target?.id) {
    return [];
  }
  if (options.publicOnly || options.audience === "public") {
    return [
      ...new Set(
        getSuspicionTrailForTarget(state, aiPlayer, target.id)
          .filter((entry) => entry.visibility === "public" && entry.reasonKey)
          .map((entry) => entry.reasonKey)
      ),
    ];
  }
  return aiPlayer.reasonFlags?.[target.id] ?? [];
}

function earlyHumanTrialRunNominationPenalty(state, aiPlayer, target, options = {}) {
  if (options.audience !== "nomination" || !options.publicOnly || !target?.isHuman || target.id === aiPlayer?.id) {
    return 0;
  }
  const window = evaluateGameWindow(state, aiPlayer, { stage: "nomination" });
  if (window.mustExecute || window.lateGame || window.day >= 3 || currentExecutionCandidateContext(state)?.active) {
    return 0;
  }
  const evidenceCount = Number(options.evidenceCount ?? 0) || 0;
  const memoryPressure = Number(options.memoryPressure ?? 0) || 0;
  const graphDelta = Number(options.graphPressure?.scoreDelta ?? 0) || 0;
  const flags = Array.isArray(options.flags) ? options.flags : [];
  if (evidenceCount > 0 || memoryPressure > 0.02 || graphDelta > 0.05 || flags.length > 0) {
    return 0;
  }
  return window.day <= 1 ? 0.18 : 0.12;
}

function personaAdjustedTargetScore(aiPlayer, state, target, baseScore, options = {}) {
  const profile = personaStrategyProfile(aiPlayer.aiPersona ?? PERSONA_TYPES.STEADY);
  const publicOnly = !!options.publicOnly || options.audience === "public";
  const evidenceCount = targetEvidenceCountForScoring(state, aiPlayer, target, { publicOnly });
  const flags = reasonFlagsForScoring(state, aiPlayer, target, { publicOnly });
  const graphPressure = computeGraphPressureForTarget(state, aiPlayer, target, { publicOnly });
  const graphChains = extractGraphReasonChains(state, aiPlayer, target, {
    publicOnly: publicOnly || aiPlayer.team === "evil",
    limit: 2,
  });
  const memoryPressure = publicStatementMemoryMatches(currentPublicStatementMemory(state, aiPlayer.id), target.id)
    ? publicStatementMemoryPressure(currentPublicStatementMemory(state, aiPlayer.id))
    : 0;
  const strategyContext = buildAIStrategyContext(state, aiPlayer, { audience: "public", targetId: target.id });
  const evilPlan = strategyContext.evilWorldPlan;
  let adjusted = baseScore;
  adjusted += graphPressure.scoreDelta * profile.graphPressureWeight;
  if (aiPlayer.team === "evil" && !areKnownAllies(state, aiPlayer, target)) {
    const framingBonus = graphChains.length > 0 ? Math.min(0.055, graphChains[0].score * 0.055) : 0;
    adjusted += framingBonus;
  }
  adjusted += evilWorldPlanTargetBias(evilPlan, target.id, {
    isKnownAlly: areKnownAllies(state, aiPlayer, target),
  });
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
  adjusted -= earlyHumanTrialRunNominationPenalty(state, aiPlayer, target, {
    ...options,
    publicOnly,
    evidenceCount,
    memoryPressure,
    graphPressure,
    flags,
  });
  adjusted -= recentSurvivedExecutionPenalty(state, target);
  return clamp(adjusted, 0.01, 0.99);
}

const RECENT_SURVIVED_EXECUTION_COOLDOWN_DAYS = 2;

function recentSurvivedExecutionForTarget(state, target, maxAgeDays = RECENT_SURVIVED_EXECUTION_COOLDOWN_DAYS) {
  if (state?.scriptId !== "bmr" || !target?.id || !registersAsAlive(state, target)) {
    return null;
  }
  const currentDay = Number(state.day ?? 0);
  if (!Number.isFinite(currentDay) || currentDay <= 0) {
    return null;
  }
  return (state.events?.executions ?? [])
    .filter((entry) => entry?.nomineeId === target.id && entry.died === false)
    .map((entry) => ({
      ...entry,
      ageDays: currentDay - (Number(entry.day ?? 0) || 0),
    }))
    .filter((entry) => entry.ageDays >= 1 && entry.ageDays <= maxAgeDays)
    .sort((a, b) => a.ageDays - b.ageDays)[0] ?? null;
}

function recentSurvivedExecutionPenalty(state, target) {
  const recent = recentSurvivedExecutionForTarget(state, target);
  if (!recent) {
    return 0;
  }
  return recent.ageDays <= 1 ? 0.32 : 0.22;
}

function shouldAvoidRecentSurvivedExecutionNomination(state, rankedTarget) {
  return !!recentSurvivedExecutionForTarget(state, rankedTarget?.player);
}

function preferFreshExecutionTargets(state, rankedTargets) {
  const targets = Array.isArray(rankedTargets) ? rankedTargets : [];
  const freshTargets = targets.filter((entry) => !shouldAvoidRecentSurvivedExecutionNomination(state, entry));
  return freshTargets.length > 0 ? freshTargets : targets;
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

function setBias(aiPlayer, targetId, delta, reasonKey = null, options = {}) {
  ensureAIFields(aiPlayer);
  const current = aiPlayer.dialogueBias[targetId] ?? 0;
  aiPlayer.dialogueBias[targetId] = clamp(current + delta, -0.35, 0.35);
  aiPlayer.dialogueBiasMeta[targetId] = {
    visibility: options.visibility ?? (reasonKey?.startsWith("evilTwin") ? "mechanic" : "private"),
    reasonKey: reasonKey ?? "",
  };
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

function executionVoteFor(state, execution) {
  if (!execution?.nomineeId) {
    return null;
  }
  return ((state.events?.votes ?? [])
    .filter((entry) => entry?.nomineeId === execution.nomineeId && entry.day === execution.day && entry.passed)
    .at(-1)) ?? null;
}

function executionEvidenceFor(state, aiPlayer, execution) {
  if (!execution?.nomineeId) {
    return null;
  }
  return getAgentEvidence(state, aiPlayer, { kind: "execution" }).find((entry) => {
    const payload = entry.payload ?? {};
    return (payload.playerId ?? payload.nomineeId) === execution.nomineeId && entry.day === execution.day;
  }) ?? null;
}

function applyExecutionActorSignal(state, aiPlayer, actorId, delta, reasonKey, evidence, metadata = {}) {
  if (!actorId || actorId === aiPlayer.id) {
    return;
  }
  const actor = getPlayerById(state, actorId);
  if (!actor || areKnownAllies(state, aiPlayer, actor)) {
    return;
  }
  bumpFromEvidence(state, aiPlayer, actorId, delta, reasonKey, evidence);
  updateAgentSourceTrustForPlayer(state, aiPlayer, actorId, {
    delta: delta > 0 ? -Math.min(0.09, Math.abs(delta) * 0.72) : Math.min(0.07, Math.abs(delta) * 0.62),
    reason: reasonKey,
    source: "public-procedure",
    evidenceId: evidence?.id ?? "",
    eventKey: `execution-outcome:${aiPlayer.id}:${actorId}:${reasonKey}:${metadata.executionDay ?? ""}:${metadata.executedPlayerId ?? ""}`,
    metadata,
  });
}

function applyExecutionOutcomeSignals(state, aiPlayer) {
  (state.events?.executions ?? [])
    .filter((entry) => entry?.nomineeId && entry.died !== false)
    .forEach((execution) => {
      const executed = getPlayerById(state, execution.nomineeId);
      if (!executed?.team) {
        return;
      }
      const vote = executionVoteFor(state, execution);
      const evidence = executionEvidenceFor(state, aiPlayer, execution);
      const metadata = {
        executionDay: execution.day,
        executedPlayerId: executed.id,
        executedTeam: executed.team,
        executedRoleId: execution.roleId ?? executed.roleId ?? "",
        yesVotes: vote?.yesVotes ?? null,
        threshold: vote?.threshold ?? null,
      };
      const votes = (vote?.votes ?? []).filter((detail) => detail?.voterId && !detail.abstain);
      const nominatorId = vote?.nominatorId ?? execution.nominatorId ?? "";

      if (executed.team === "good") {
        applyExecutionActorSignal(state, aiPlayer, nominatorId, 0.11, "misexecutionNomination", evidence, metadata);
        votes.forEach((detail) => {
          applyExecutionActorSignal(
            state,
            aiPlayer,
            detail.voterId,
            detail.vote ? 0.07 : -0.035,
            detail.vote ? "misexecutionVote" : "resistedMisexecution",
            evidence,
            metadata
          );
        });
      } else if (executed.team === "evil") {
        applyExecutionActorSignal(state, aiPlayer, nominatorId, -0.075, "foundEvilNomination", evidence, metadata);
        votes.forEach((detail) => {
          applyExecutionActorSignal(
            state,
            aiPlayer,
            detail.voterId,
            detail.vote ? -0.055 : 0.05,
            detail.vote ? "foundEvilVote" : "shieldedEvilExecution",
            evidence,
            metadata
          );
        });
      }
    });
}

function applyEvilTwinSignals(state, aiPlayer) {
  const pair = state.snv?.evilTwinPair;
  if (state.scriptId !== "snv" || !pair?.evilTwinId || !pair?.goodTwinId) {
    return;
  }
  const evilTwin = getPlayerById(state, pair.evilTwinId);
  const goodTwin = getPlayerById(state, pair.goodTwinId);
  const holderOpposite = getPlayerById(state, pair.opposingTwinId ?? pair.goodTwinId);
  const blockedEvilTwin =
    !!evilTwin?.poisoned ||
    (state.snv?.snakeCharmerPoisonedIds ?? []).includes(evilTwin?.id);
  if (!evilTwin?.alive || !goodTwin?.alive || !holderOpposite?.alive || getEffectiveRoleId(evilTwin) !== "evil-twin" || blockedEvilTwin) {
    return;
  }

  if (aiPlayer.id === pair.goodTwinId) {
    const targetId = pair.goodTwinId === pair.evilTwinId ? holderOpposite.id : pair.evilTwinId;
    bump(aiPlayer, targetId, 0.74, "evilTwinPair");
    setBias(aiPlayer, targetId, 0.18, "evilTwinPair");
    return;
  }

  const knowsEvilTwin = aiPlayer.id === pair.evilTwinId || getKnownAllyIds(state, aiPlayer).includes(pair.evilTwinId);
  if (knowsEvilTwin && aiPlayer.team === "evil") {
    bump(aiPlayer, pair.goodTwinId, 0.58, "evilTwinFrame");
    setBias(aiPlayer, pair.goodTwinId, 0.14, "evilTwinFrame");
  }
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
      const attitude =
        observation.polarity === "accuse" || observation.polarity === "pressure"
          ? "accuse"
          : observation.polarity === "defend"
          ? "defend"
          : inferAttitude(observation.text ?? "");
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

function rankTargets(aiPlayer, state, limit = 3, options = {}) {
  const publicOnly = !!options.publicOnly || options.audience === "public";
  return state.players
    .filter((entry) => registersAsAlive(state, entry) && entry.id !== aiPlayer.id)
    .map((entry) => {
      const baseScore = publicOnly ? publicBaseTargetScore(state, aiPlayer, entry) : aiPlayer.suspicion?.[entry.id] ?? 0.5;
      return {
        player: entry,
        score: personaAdjustedTargetScore(aiPlayer, state, entry, baseScore, options),
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
    evaluateGoodDayStrategy,
  });
}
function reasonSnippet(key) {
  return LOCAL_REASON_SNIPPETS[key] ?? REASON_SNIPPETS[key] ?? key;
}

function summarizeReason(aiPlayer, targetId) {
  const flags = aiPlayer.reasonFlags?.[targetId] ?? [];
  if (flags.length === 0) {
    return "前面发言和站边还没讲顺";
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
      lines.push("台面身份先报成低信息身份，等有人追问再补细节。");
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

function evidenceAnchorFromDialogueEvidence(entry) {
  return {
    evidenceId: entry?.id ?? "",
    observationId: entry?.observationId ?? "",
    kind: entry?.kind ?? entry?.evidenceType ?? "",
    source: entry?.source ?? "",
    sourceId: entry?.sourceId ?? "",
    visibility: entry?.visibility ?? "",
    day: Number.isFinite(Number(entry?.day)) ? Number(entry.day) : 0,
    night: Number.isFinite(Number(entry?.night)) ? Number(entry.night) : 0,
    timestamp: Number.isFinite(Number(entry?.timestamp)) ? Number(entry.timestamp) : 0,
    text: shortReasonText(entry?.dialogueSummary ?? "", 42),
  };
}

function collectEvidenceAnchors(stateOrView, aiPlayer, focusPlayer, options = {}) {
  if (!focusPlayer?.id) {
    return [];
  }
  const agentView = stateOrView?.kind === "agent-view" ? stateOrView : null;
  const state = agentView?.state ?? stateOrView;
  const evidence = agentView
    ? agentView.evidenceForTarget(focusPlayer.id, {
        maxEvidence: options.limit ?? 3,
        publicOnly: !!options.publicOnly,
        includePrivate: !options.publicOnly,
      })
    : getDialogueEvidenceForTarget(state, aiPlayer, focusPlayer.id, {
        maxEvidence: options.limit ?? 3,
        publicOnly: !!options.publicOnly,
        includePrivate: !options.publicOnly,
      });
  return evidence
    .map(evidenceAnchorFromDialogueEvidence)
    .filter((entry) => entry.evidenceId || entry.observationId || entry.text)
    .slice(0, options.limit ?? 3);
}

function scoreTrailAnchorFromBeliefTrail(row, evidence = null) {
  return {
    trailId: row?.id ?? "",
    evidenceId: row?.evidenceId ?? evidence?.id ?? "",
    observationId: row?.observationId ?? evidence?.observationId ?? "",
    reasonKey: row?.reasonKey ?? "",
    kind: row?.evidenceKind || evidence?.kind || evidence?.evidenceType || "",
    source: row?.source || evidence?.source || "",
    sourceId: row?.sourceId || evidence?.sourceId || "",
    visibility: row?.visibility || evidence?.visibility || "",
    day: Number.isFinite(Number(row?.day ?? evidence?.day)) ? Number(row?.day ?? evidence?.day) : 0,
    night: Number.isFinite(Number(row?.night ?? evidence?.night)) ? Number(row?.night ?? evidence?.night) : 0,
    timestamp: Number.isFinite(Number(row?.timestamp ?? evidence?.timestamp)) ? Number(row?.timestamp ?? evidence?.timestamp) : 0,
    before: Number.isFinite(Number(row?.before)) ? Number(row.before) : null,
    after: Number.isFinite(Number(row?.after)) ? Number(row.after) : null,
    appliedDelta: Number.isFinite(Number(row?.appliedDelta)) ? Number(row.appliedDelta) : null,
    text: shortReasonText(row?.text || evidence?.dialogueSummary || evidence?.text || "", 52),
  };
}

function collectScoreTrailAnchors(stateOrView, aiPlayer, focusPlayer, options = {}) {
  if (!focusPlayer?.id) {
    return [];
  }
  const agentView = stateOrView?.kind === "agent-view" ? stateOrView : null;
  const state = agentView?.state ?? stateOrView;
  const agent = getAIAgent(state, aiPlayer);
  if (!agent) {
    return [];
  }
  const evidenceById = new Map((agent.evidenceBook ?? []).map((entry) => [entry.id, entry]));
  return (agent.beliefTrailByPlayerId?.[focusPlayer.id] ?? [])
    .filter((row) => !options.publicOnly || row?.visibility === "public")
    .sort((a, b) => Number(b?.timestamp ?? 0) - Number(a?.timestamp ?? 0))
    .slice(0, options.limit ?? 3)
    .map((row) => scoreTrailAnchorFromBeliefTrail(row, evidenceById.get(row?.evidenceId)))
    .filter((entry) => entry.trailId || entry.evidenceId || entry.observationId || entry.text);
}

function dialogueEvidenceSummaryFamilyKey(text) {
  const value = `${text ?? ""}`.replace(/\s+/g, "").trim();
  if (!value) {
    return "";
  }
  if (/维护.*高压(?:位|目标)|高压(?:位|目标).*维护|帮.*卸压/.test(value)) {
    return "public-hot-defense";
  }
  return value;
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
    .filter((entry, index, arr) => {
      const key = dialogueEvidenceSummaryFamilyKey(entry);
      return arr.findIndex((candidate) => dialogueEvidenceSummaryFamilyKey(candidate) === key) === index;
    })
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
    evidenceAnchors: collectEvidenceAnchors(stateOrView, aiPlayer, focusPlayer, {
      publicOnly: !!options.publicOnly,
      limit: options.anchorLimit ?? 3,
    }),
    scoreTrailAnchors: collectScoreTrailAnchors(stateOrView, aiPlayer, focusPlayer, {
      publicOnly: !!options.publicOnly,
      limit: options.scoreTrailLimit ?? 3,
    }),
    hasEvidence,
    lowEvidence: !hasEvidence,
    publicOnly: !!options.publicOnly,
    graphPressure,
    graphChains,
  };
}

function evidenceCountForReasoning(stateOrView, aiPlayer, targetId, options = {}) {
  if (!targetId) {
    return 0;
  }
  const agentView = stateOrView?.kind === "agent-view" ? stateOrView : null;
  if (agentView?.evidenceCountForTarget) {
    return agentView.evidenceCountForTarget(targetId, {
      publicOnly: !!options.publicOnly,
      includePrivate: !options.publicOnly,
    });
  }
  return getDialogueEvidenceForTarget(stateOrView, aiPlayer, targetId, {
    publicOnly: !!options.publicOnly,
    includePrivate: !options.publicOnly,
  }).length;
}

function buildDecisionComparisonSide(stateOrView, aiPlayer, targetPlayer, options = {}) {
  if (!targetPlayer?.id) {
    return {
      reason: "暂无第二候选",
      evidenceSummary: "",
    };
  }
  const targetName = statementTargetLabel(stateOrView?.state ?? stateOrView, targetPlayer.id);
  const evidenceSummaries = collectEvidence(stateOrView, aiPlayer, targetPlayer, {
    publicOnly: !!options.publicOnly,
  })
    .map((entry) => normalizeSurfaceEvidence(entry, targetName))
    .map((entry) => shortReasonText(entry, 36))
    .filter(Boolean);
  const evidenceSummary = evidenceSummaries[0] ?? "";
  return {
    reason: evidenceSummary
      ? playerStyleEvidenceSummary([evidenceSummary], { fallback: "证据待补" })
      : "证据待补",
    evidenceSummary,
  };
}

function buildDecisionComparisonTrace(stateOrView, aiPlayer, focus, second, metrics = {}, options = {}) {
  if (!focus?.player) {
    return null;
  }
  const hasRunnerUp = !!second?.player && focus.player.id !== second.player.id;
  const roundScore = (value) => (Number.isFinite(value) ? Math.round(value * 1000) / 1000 : 0);
  const focusSide = buildDecisionComparisonSide(stateOrView, aiPlayer, focus.player, options);
  const runnerUpSide = hasRunnerUp
    ? buildDecisionComparisonSide(stateOrView, aiPlayer, second.player, options)
    : { reason: "暂无第二候选", evidenceSummary: "" };
  const focusName = metrics.focusName ?? statementTargetLabel(stateOrView?.state ?? stateOrView, focus.player.id);
  const runnerUpName = hasRunnerUp
    ? metrics.runnerUpName ?? statementTargetLabel(stateOrView?.state ?? stateOrView, second.player.id)
    : "";
  const runnerLine = hasRunnerUp ? `${runnerUpName}：${runnerUpSide.reason}` : "第二候选：暂无";
  return {
    kind: "target-comparison-trace",
    publicOnly: !!options.publicOnly,
    focusId: focus.player.id,
    focusName,
    focusScore: roundScore(metrics.focusScore),
    focusEvidenceCount: metrics.focusEvidenceCount ?? 0,
    focusReason: focusSide.reason,
    focusEvidenceSummary: focusSide.evidenceSummary,
    runnerUpId: hasRunnerUp ? second.player.id : "",
    runnerUpName,
    runnerUpScore: hasRunnerUp ? roundScore(metrics.runnerUpScore) : null,
    runnerUpEvidenceCount: hasRunnerUp ? metrics.runnerUpEvidenceCount ?? 0 : 0,
    runnerUpReason: runnerUpSide.reason,
    runnerUpEvidenceSummary: runnerUpSide.evidenceSummary,
    scoreGap: roundScore(metrics.scoreGap),
    reasonKey: metrics.reasonKey ?? "",
    confidenceBand: metrics.confidenceBand ?? "",
    summary: `${focusName}：${focusSide.reason}；${runnerLine}`,
  };
}

function buildDecisionReconsiderationLine({ focusName = "", runnerUpName = "", reasonKey = "", publicOnly = false } = {}) {
  const focusLabel = focusName || "这个位置";
  const runnerLabel = runnerUpName || "第二候选";
  const publicChain = publicOnly ? "公开身份链和票型" : "身份、夜里信息和公开口径";
  if (reasonKey === "only-eligible-target") {
    return `如果 ${focusLabel} 能补出可复核信息，我会先降级，不锁死。`;
  }
  if (reasonKey === "close-call") {
    return `这不是锁死；${focusLabel} 回应能对上，或 ${runnerLabel} 补出硬线，我会重排。`;
  }
  if (reasonKey === "higher-pressure") {
    return `如果 ${focusLabel} 能把压力来源解释开，我会重新比较 ${runnerLabel}。`;
  }
  if (reasonKey === "more-visible-evidence") {
    return `如果 ${focusLabel} 能把${publicChain}补上，我会降级这条。`;
  }
  if (reasonKey === "numeric-score") {
    return `分数只是当前排序；${focusLabel} 补上可验链条，我会降压。`;
  }
  return `如果 ${focusLabel} 的解释能对上证据链，我会把这条从主线降级。`;
}

function buildDecisionConfidenceLine({ focusName = "", runnerUpName = "", confidenceBand = "", reasonKey = "" } = {}) {
  const focusLabel = focusName || "这个位置";
  const runnerLabel = runnerUpName || "第二候选";
  if (reasonKey === "only-eligible-target") {
    return `没有稳定第二候选，${focusLabel} 先当可验证入口。`;
  }
  if (confidenceBand === "clear") {
    return `${focusLabel} 现在是强压位，但仍按回应校准。`;
  }
  if (confidenceBand === "lean") {
    return `${focusLabel} 只是当前偏前，不是铁证。`;
  }
  if (confidenceBand === "close") {
    return `${focusLabel} 和 ${runnerLabel} 接近，这轮先当验证压力。`;
  }
  return `${focusLabel} 先当验证压力，不锁死。`;
}

function decisionEvidenceModeVerificationTail({ focusName = "", evidenceMode = "" } = {}) {
  const focusLabel = focusName || "这个位置";
  if (evidenceMode === "private-rumor") {
    return `重点是把 ${focusLabel} 的私聊线索转成公开可复核问题。`;
  }
  if (evidenceMode === "night-info") {
    return `重点核 ${focusLabel} 的昨晚信息、死亡/保护链和身份口径。`;
  }
  if (evidenceMode === "vote-shape") {
    return `重点核 ${focusLabel} 的投票、提名和票型理由。`;
  }
  if (evidenceMode === "claim-chain") {
    return `重点核 ${focusLabel} 前后身份口径和角色说法。`;
  }
  if (evidenceMode === "evidence-count") {
    return `重点让 ${focusLabel} 逐条回应个人证据，并说明哪些可能被污染。`;
  }
  if (evidenceMode === "public-speech") {
    return `重点听 ${focusLabel} 的公开发言节奏、站边和回应是否连得上。`;
  }
  if (evidenceMode === "low-evidence") {
    return `重点先让 ${focusLabel} 补可复核身份或票型，不够就只当观察。`;
  }
  return `重点让 ${focusLabel} 把身份、票型和发言链串起来。`;
}

function buildDecisionVerificationLine({ focusName = "", runnerUpName = "", reasonKey = "", publicOnly = false, evidenceMode = "" } = {}) {
  const focusLabel = focusName || "这个位置";
  const runnerLabel = runnerUpName || "第二候选";
  const chainLabel = publicOnly ? "公开身份链和票型" : "身份、夜里信息和票型";
  const withEvidenceMode = (line) => {
    const tail = decisionEvidenceModeVerificationTail({ focusName, evidenceMode });
    return tail && !line.includes(tail) ? `${line} ${tail}` : line;
  };
  if (reasonKey === "only-eligible-target") {
    return withEvidenceMode(`先让 ${focusLabel} 补一条能复核的${chainLabel}。`);
  }
  if (reasonKey === "close-call") {
    return withEvidenceMode(`验证点是让 ${focusLabel} 说明为什么比 ${runnerLabel} 更该先处理，再补身份和昨晚信息。`);
  }
  if (reasonKey === "higher-pressure") {
    return withEvidenceMode(`先问 ${focusLabel} 压力来源：身份、票型还是发言哪里对不上。`);
  }
  if (reasonKey === "more-visible-evidence") {
    return withEvidenceMode(`验证点是让 ${focusLabel} 把现有线索逐条对上，再补身份和昨晚信息。`);
  }
  if (reasonKey === "numeric-score") {
    return withEvidenceMode(`先让 ${focusLabel} 把分数背后的可验链条说出来。`);
  }
  return withEvidenceMode(`先问 ${focusLabel} 哪条证据能公开对上，再补身份和昨晚信息。`);
}

function buildDecisionEvidenceBoundaryLine({ focusName = "", runnerUpName = "", riskFlags = [], publicOnly = false } = {}) {
  const focusLabel = focusName || "这个位置";
  const runnerLabel = runnerUpName || "第二候选";
  const flags = new Set(riskFlags ?? []);
  if (flags.has("runner-up-evidence-lead")) {
    return `边界是 ${runnerLabel} 的线索并不弱，${focusLabel} 需要把排序差距说清。`;
  }
  if (flags.has("close-score-gap")) {
    return `边界是 ${focusLabel} 和 ${runnerLabel} 分差贴线，先别当铁证。`;
  }
  if (flags.has("low-evidence")) {
    return `边界是 ${focusLabel} 现在证据薄，只能先听回应和票型。`;
  }
  if (flags.has("no-runner-up")) {
    return `边界是缺稳定第二候选，${focusLabel} 只是当前入口。`;
  }
  if (publicOnly || flags.has("public-only")) {
    return `边界是我只能用台面公开信息看 ${focusLabel}，不拿私下结论压人。`;
  }
  return `边界是 ${focusLabel} 这条还要继续复核，不能只靠单点结论。`;
}

function buildDecisionRunnerUpWatchLine({ focusName = "", runnerUpName = "", reasonKey = "", hasRunnerUp = false } = {}) {
  const focusLabel = focusName || "这个位置";
  const runnerLabel = runnerUpName || "第二候选";
  if (!hasRunnerUp || !runnerUpName) {
    return `暂时没有稳定第二候选，我先不扩散火力。`;
  }
  if (reasonKey === "close-call") {
    return `${runnerLabel} 保留第二压力位，${focusLabel} 回应过关就立刻回看。`;
  }
  if (reasonKey === "higher-pressure") {
    return `${runnerLabel} 的线索先不丢，${focusLabel} 解释开后我会回看。`;
  }
  if (reasonKey === "more-visible-evidence") {
    return `${runnerLabel} 先排第二，不因为线索少就直接放过。`;
  }
  if (reasonKey === "numeric-score") {
    return `${runnerLabel} 先排第二，新证据或票型变化会重排。`;
  }
  return `${runnerLabel} 先排第二，等新票型或身份信息再回看。`;
}

function buildDecisionResponsePlanLine({
  focusName = "",
  runnerUpName = "",
  reasonKey = "",
  confidenceBand = "",
  hasRunnerUp = false,
} = {}) {
  const focusLabel = focusName || "这个位置";
  const runnerLabel = runnerUpName || "第二候选";
  if (reasonKey === "only-eligible-target" || !hasRunnerUp) {
    return `回应能补出可复核链条，我先降压；如果 ${focusLabel} 继续只给态度，就推进到提名前复核。`;
  }
  if (reasonKey === "close-call" || confidenceBand === "close") {
    return `如果 ${focusLabel} 回应能对上，我会把 ${runnerLabel} 拉回同级复核；如果回避，就把 ${focusLabel} 推成主压力。`;
  }
  if (reasonKey === "higher-pressure") {
    return `如果 ${focusLabel} 解释开压力来源，我回看 ${runnerLabel}；如果解释不连贯，就继续加压 ${focusLabel}。`;
  }
  if (reasonKey === "more-visible-evidence") {
    return `如果 ${focusLabel} 能逐条对上证据，我先降压；如果只回避身份或票型，就进入提名压力。`;
  }
  if (reasonKey === "numeric-score") {
    return `如果 ${focusLabel} 补出新证据就重算；如果没有新链条，就按当前排序继续压。`;
  }
  return `如果 ${focusLabel} 回应能接上证据就降压，回应断开就继续压；${runnerLabel} 有新线再重排。`;
}

function buildDecisionResponseCriteriaLine({
  focusName = "",
  runnerUpName = "",
  reasonKey = "",
  evidenceMode = "",
  hasRunnerUp = false,
} = {}) {
  const focusLabel = focusName || "这个位置";
  const runnerLabel = runnerUpName || "第二候选";
  if (evidenceMode === "private-rumor") {
    return `判定标准：${focusLabel} 能把传话落到公开可核身份或票型就降压；只说“别人告诉我”就继续加压。`;
  }
  if (evidenceMode === "night-info") {
    return `判定标准：${focusLabel} 的昨晚信息能对上死亡、保护和身份时间线就降压；时间线断开就继续压。`;
  }
  if (evidenceMode === "vote-shape") {
    return `判定标准：${focusLabel} 能讲清上票、跟票或提名动机就降压；只说自保但不给理由就加压。`;
  }
  if (evidenceMode === "claim-chain") {
    return `判定标准：${focusLabel} 前后身份口径能连上就降压；身份越说越散就继续压。`;
  }
  if (evidenceMode === "evidence-count") {
    return `判定标准：${focusLabel} 能逐条回应证据来源就降压；只挑一条回避其余就加压。`;
  }
  if (evidenceMode === "public-speech") {
    return `判定标准：${focusLabel} 能把公开发言、站边和回应顺序讲完整就降压；节奏继续断开就加压。`;
  }
  if (evidenceMode === "low-evidence") {
    return `判定标准：${focusLabel} 补出可复核身份或票型才升级判断；补不出就只按观察位处理。`;
  }
  if (reasonKey === "only-eligible-target" || !hasRunnerUp) {
    return `判定标准：${focusLabel} 补出可复核链条就降压；没有链条就只保留为当前入口。`;
  }
  if (reasonKey === "close-call") {
    return `判定标准：${focusLabel} 回应比 ${runnerLabel} 更完整就保留主线；${runnerLabel} 补出硬线就换顺位。`;
  }
  if (reasonKey === "higher-pressure") {
    return `判定标准：${focusLabel} 能拆开压力来源就降压；拆不开就继续排在 ${runnerLabel} 前面。`;
  }
  if (reasonKey === "more-visible-evidence") {
    return `判定标准：${focusLabel} 能逐条对上更多线索就降压；只回避重点就进入提名压力。`;
  }
  if (reasonKey === "numeric-score") {
    return `判定标准：${focusLabel} 给出新证据就重算；没有新链条就按当前分数继续压。`;
  }
  return `判定标准：${focusLabel} 解释能接上身份、票型和发言链就降压；接不上就继续压。`;
}

function buildDecisionEvidenceInteractionLine({
  focusName = "",
  runnerUpName = "",
  reasonKey = "",
  evidenceMode = "",
  riskFlags = [],
  hasRunnerUp = false,
} = {}) {
  const focusLabel = focusName || "这个位置";
  const runnerLabel = runnerUpName || "第二候选";
  const flags = new Set(riskFlags ?? []);
  if (flags.has("low-evidence")) {
    return `证据联动：${focusLabel} 还没有互相托住的线，补出身份或票型前只当观察位。`;
  }
  if (flags.has("runner-up-evidence-lead")) {
    return `证据联动：${runnerLabel} 线索数量更高，${focusLabel} 必须把身份和票型接上才不会被重排。`;
  }
  if (evidenceMode === "private-rumor") {
    return `证据联动：私聊线索只当入口，必须接上 ${focusLabel} 的公开身份或票型才升级。`;
  }
  if (evidenceMode === "night-info") {
    return `证据联动：夜里信息要和 ${focusLabel} 的身份时间线互相托住；断开就会并入发言和票型并继续加压。`;
  }
  if (evidenceMode === "vote-shape") {
    return `证据联动：${focusLabel} 的票型不是铁证，要和身份口径或发言节奏同向才升级。`;
  }
  if (evidenceMode === "claim-chain") {
    return `证据联动：${focusLabel} 身份口径连上后票型只算弱压；连不上就把票型和发言一起并入压力。`;
  }
  if (evidenceMode === "evidence-count") {
    return `证据联动：${focusLabel} 的多条线先去重，重复来源降权；身份、票型和发言独立成立才升级。`;
  }
  if (evidenceMode === "public-speech") {
    return `证据联动：${focusLabel} 的发言节奏只是入口，要和票型或身份口径互相顶住才升级。`;
  }
  if (reasonKey === "close-call" && hasRunnerUp) {
    return `证据联动：${focusLabel} 和 ${runnerLabel} 差距靠新证据打开，谁的身份或票型先断谁先上压。`;
  }
  if (reasonKey === "higher-pressure" && hasRunnerUp) {
    return `证据联动：${focusLabel} 压力更高但不能单看分数；解释拆开后要回看 ${runnerLabel} 的身份和票型。`;
  }
  if (reasonKey === "only-eligible-target" || !hasRunnerUp) {
    return `证据联动：${focusLabel} 只是当前入口，身份、票型或发言补出第二条线后才升级。`;
  }
  return `证据联动：${focusLabel} 要把身份、票型和发言链互相接上；接不上才把多条线合并加压。`;
}

function buildDecisionPressureStageLine({
  focusName = "",
  runnerUpName = "",
  reasonKey = "",
  confidenceBand = "",
  focusScore = 0,
  focusEvidenceCount = 0,
  riskFlags = [],
  hasRunnerUp = false,
} = {}) {
  const focusLabel = focusName || "这个位置";
  const runnerLabel = runnerUpName || "第二候选";
  const flags = new Set(riskFlags ?? []);
  if (flags.has("low-evidence")) {
    return `压力档位：${focusLabel} 还是观察位，先补公开可复核线，不进提名前压。`;
  }
  if (!hasRunnerUp || reasonKey === "only-eligible-target") {
    return `压力档位：${focusLabel} 是验证入口，先追问身份和票型，不直接提名。`;
  }
  if (reasonKey === "close-call" || confidenceBand === "close") {
    return `压力档位：${focusLabel} 和 ${runnerLabel} 仍在对比档，先问清再决定谁进提名池。`;
  }
  if (confidenceBand === "clear" || focusScore >= 0.74 || focusEvidenceCount >= 3) {
    return `压力档位：${focusLabel} 已到提名前复核档，先问 ${focusLabel} 身份和票型；回应断开就可以转提名压力。`;
  }
  if (reasonKey === "more-visible-evidence") {
    return `压力档位：${focusLabel} 是主压力位，先追问 ${focusLabel} 身份和票型；回应空就进提名池。`;
  }
  if (reasonKey === "higher-pressure") {
    return `压力档位：${focusLabel} 先压在 ${runnerLabel} 前面，但仍是验证压，不是闭眼提名。`;
  }
  if (reasonKey === "numeric-score") {
    return `压力档位：${focusLabel} 是分数前排位，先复核分数来源，再决定是否提名。`;
  }
  return `压力档位：${focusLabel} 先放验证压，回应和新票型决定是否升级到提名压力。`;
}

function buildDecisionCounterEvidenceLine({
  focusName = "",
  runnerUpName = "",
  reasonKey = "",
  evidenceMode = "",
  riskFlags = [],
} = {}) {
  const focusLabel = focusName || "这个位置";
  const runnerLabel = runnerUpName || "第二候选";
  const flags = new Set(riskFlags ?? []);
  if (flags.has("low-evidence")) {
    return `反证是 ${focusLabel} 证据还薄，也可能只是发言位置不好；先只作观察，不直接拍死。`;
  }
  if (flags.has("runner-up-evidence-lead")) {
    return `反证是 ${runnerLabel} 的线索数量更高，${focusLabel} 只有排序压力；两边解释要一起重算。`;
  }
  if (evidenceMode === "private-rumor") {
    return `反证是私聊线索可能转述失真，${focusLabel} 如果能给公开可核说法，就不能只按传话定性。`;
  }
  if (evidenceMode === "night-info") {
    return `反证是夜里信息可能被死亡、保护或身份口径污染，${focusLabel} 对上时间线前不能锁死。`;
  }
  if (evidenceMode === "vote-shape") {
    return `反证是 ${focusLabel} 的票型可能只是自保或跟票，先听投票理由再定是不是狼线。`;
  }
  if (evidenceMode === "claim-chain") {
    return `反证是 ${focusLabel} 可能只是临场改口自保，不等于直接成狼；先核前后身份能不能连上。`;
  }
  if (evidenceMode === "evidence-count") {
    return `反证是多条线索可能互相重复或被污染，${focusLabel} 逐条能对上就要降压。`;
  }
  if (evidenceMode === "public-speech") {
    return `反证是 ${focusLabel} 可能只是表达乱，不一定是身份坏；先听解释，复核后续公开回应能不能补完整。`;
  }
  if (reasonKey === "only-eligible-target") {
    return `反证是 ${focusLabel} 只是当前唯一入口；补出可复核链条，我会先降压。`;
  }
  if (reasonKey === "close-call") {
    return `反证是 ${focusLabel} 和 ${runnerLabel} 差距很小，一句解释就可能换顺位。`;
  }
  if (reasonKey === "higher-pressure") {
    return `反证是 ${focusLabel} 的压力可能来自站边误读；解释能拆开，我会回看 ${runnerLabel}。`;
  }
  if (reasonKey === "more-visible-evidence") {
    return `反证是 ${focusLabel} 只是线索更多，不代表每条都有效；能逐条对上就降级。`;
  }
  if (reasonKey === "numeric-score") {
    return `反证是 ${focusLabel} 只是当前分数靠前；有新证据或反向票型就重算。`;
  }
  return `反证是 ${focusLabel} 这条仍可能是误伤，先听解释，再决定是否继续压。`;
}

function buildDecisionTableRiskLine({
  focusName = "",
  runnerUpName = "",
  reasonKey = "",
  evidenceMode = "",
  confidenceBand = "",
  focusScore = 0,
  riskFlags = [],
  hasRunnerUp = false,
  publicOnly = false,
} = {}) {
  const focusLabel = focusName || "这个位置";
  const runnerLabel = runnerUpName || "第二候选";
  const flags = new Set(riskFlags ?? []);
  if (flags.has("low-evidence")) {
    return `桌面风险：${focusLabel} 证据还薄，过早提名会浪费处决压力，先只问可公开复核线。`;
  }
  if (publicOnly || flags.has("public-only")) {
    return `桌面风险：公开场上只能压 ${focusLabel} 的可见身份、票型和发言，不能把私下判断当结论带票。`;
  }
  if (evidenceMode === "private-rumor") {
    return `桌面风险：${focusLabel} 的私聊线索容易带偏桌面，必须转成公开问题，不能直接当定性。`;
  }
  if (flags.has("runner-up-evidence-lead") && hasRunnerUp) {
    return `桌面风险：${runnerLabel} 线索不弱，单压 ${focusLabel} 容易隧道化，要保留第二压力位。`;
  }
  if ((reasonKey === "close-call" || flags.has("close-score-gap")) && hasRunnerUp) {
    return `桌面风险：${focusLabel} 和 ${runnerLabel} 分差贴线，过早定主线会分散票型，先做对比追问。`;
  }
  if (evidenceMode === "vote-shape") {
    return `桌面风险：票型压力容易带动跟票，压 ${focusLabel} 前要先区分自保票和狼线，再听身份/票型回应。`;
  }
  if (evidenceMode === "night-info") {
    return `桌面风险：夜里信息如果说不清会带偏桌面，先核 ${focusLabel} 时间线再决定是否提名。`;
  }
  if (confidenceBand === "clear" || focusScore >= 0.74 || reasonKey === "more-visible-evidence") {
    return `桌面风险：${focusLabel} 压力高，但提名前仍要给身份/票型回应窗口，避免闭眼带票。`;
  }
  if (reasonKey === "only-eligible-target" || !hasRunnerUp) {
    return `桌面风险：${focusLabel} 只是当前入口，直接提名会压窄桌面，先补公开复核线。`;
  }
  if (reasonKey === "numeric-score") {
    return `桌面风险：${focusLabel} 只是分数靠前，先复核分数来源，不能只按数值提名。`;
  }
  return `桌面风险：压 ${focusLabel} 不能只靠单条线，先把身份、票型和发言问清再带票。`;
}

function buildDecisionInformationGainLine({
  focusName = "",
  runnerUpName = "",
  reasonKey = "",
  evidenceMode = "",
  confidenceBand = "",
  riskFlags = [],
  hasRunnerUp = false,
  publicOnly = false,
} = {}) {
  const focusLabel = focusName || "这个位置";
  const runnerLabel = runnerUpName || "第二候选";
  const flags = new Set(riskFlags ?? []);
  if (evidenceMode === "private-rumor" || publicOnly || flags.has("public-only")) {
    return `信息收益：问 ${focusLabel} 的公开身份、票型和发言链，可以把私下入口转成可复核桌面线，分清传话误差还是回避。`;
  }
  if (evidenceMode === "night-info") {
    return `信息收益：核 ${focusLabel} 的时间线，可以分清夜里信息污染、身份口径断裂，还是能降压的解释。`;
  }
  if (evidenceMode === "vote-shape") {
    return `信息收益：追问 ${focusLabel} 的上票和跟票动机，可以分清自保票、被动跟票，还是主动推人。`;
  }
  if (evidenceMode === "claim-chain") {
    return `信息收益：核 ${focusLabel} 前后身份口径，可以分清临场自保、身份断裂，还是能接上的信息链。`;
  }
  if (flags.has("low-evidence") || evidenceMode === "low-evidence") {
    return `信息收益：让 ${focusLabel} 补公开身份或票型，是为了分清继续观察，还是升级成可压线索。`;
  }
  if (flags.has("runner-up-evidence-lead") && hasRunnerUp) {
    return `信息收益：先听 ${focusLabel} 解释，可以判断主线是否要被 ${runnerLabel} 反超，而不是两边一起糊。`;
  }
  if ((reasonKey === "close-call" || flags.has("close-score-gap")) && hasRunnerUp) {
    return `信息收益：对比问 ${focusLabel} 和 ${runnerLabel}，可以分清谁先补出独立证据，谁先进入提名池。`;
  }
  if (confidenceBand === "clear" || reasonKey === "more-visible-evidence") {
    return `信息收益：先听 ${focusLabel} 回应，可以分清可降压解释和提名前最后复核，而不是直接锁票。`;
  }
  if (reasonKey === "only-eligible-target" || !hasRunnerUp) {
    return `信息收益：问 ${focusLabel} 是为了找第一条可复核桌面线，分清入口线索还是可升级压力。`;
  }
  return `信息收益：问 ${focusLabel} 身份、票型和发言链，可以分清解释不足、可复核补线，还是继续加压。`;
}

function buildDecisionTableReactionLine({
  focusName = "",
  runnerUpName = "",
  reasonKey = "",
  evidenceMode = "",
  confidenceBand = "",
  riskFlags = [],
  hasRunnerUp = false,
  publicOnly = false,
} = {}) {
  const focusLabel = focusName || "这个位置";
  const runnerLabel = runnerUpName || "第二候选";
  const flags = new Set(riskFlags ?? []);
  if (evidenceMode === "private-rumor" || publicOnly || flags.has("public-only")) {
    return `桌面反应：压 ${focusLabel} 后看谁把私下入口当结论带票，谁能转成公开复核问题。`;
  }
  if (evidenceMode === "vote-shape") {
    return `桌面反应：压 ${focusLabel} 后看谁跟票或带票，谁能解释上票动机，跟压不给理由要记。`;
  }
  if (evidenceMode === "claim-chain") {
    return `桌面反应：压 ${focusLabel} 后看谁帮补身份口径，谁只护人不补链，护人无解释要进观察。`;
  }
  if (evidenceMode === "night-info") {
    return `桌面反应：核 ${focusLabel} 时间线时看谁能接公开信息，谁用模糊夜里说法转移压力。`;
  }
  if (flags.has("low-evidence") || evidenceMode === "low-evidence") {
    return `桌面反应：轻压 ${focusLabel} 后看谁急着放大或洗白，理由能否接上公开发言比当前结论更有用。`;
  }
  if (flags.has("runner-up-evidence-lead") && hasRunnerUp) {
    return `桌面反应：同时盯 ${runnerLabel}，如果桌面绕开第二压力位只跟压 ${focusLabel}，要警惕带偏。`;
  }
  if ((reasonKey === "close-call" || flags.has("close-score-gap")) && hasRunnerUp) {
    return `桌面反应：看谁在 ${focusLabel} 和 ${runnerLabel} 之间选择性站边，理由要能接上身份和票型。`;
  }
  if (confidenceBand === "clear" || reasonKey === "more-visible-evidence") {
    return `桌面反应：强压 ${focusLabel} 后看谁无理由跟压、谁急着护人，提名前要把站边记清。`;
  }
  if (reasonKey === "only-eligible-target" || !hasRunnerUp) {
    return `桌面反应：问 ${focusLabel} 后先看谁补证、谁转移发言，桌面反应决定是否升级压力。`;
  }
  return `桌面反应：压 ${focusLabel} 后看跟压、护人和转移发言，谁的理由接不上票型就记成新线索。`;
}

function buildDecisionTimingWindowLine({
  focusName = "",
  runnerUpName = "",
  reasonKey = "",
  confidenceBand = "",
  focusScore = 0,
  day = 0,
  dayStage = "",
  publicRounds = 0,
  debateBeat = "",
  audience = "",
  nominationClock = null,
  hasRunnerUp = false,
  riskFlags = [],
} = {}) {
  const focusLabel = focusName || "这个位置";
  const runnerLabel = runnerUpName || "第二候选";
  const safeDay = Math.max(1, Number(day) || 1);
  const safePublicRounds = Math.max(0, Number(publicRounds) || 0);
  const flags = new Set(riskFlags ?? []);
  const clockStatus = nominationClock?.status ?? "";
  if (audience === "nomination" || dayStage === "nomination" || debateBeat === "nomination-pressure") {
    return `时机窗口：现在靠近提名/投票，压 ${focusLabel} 要先落身份和票型回应，再决定是否进提名池。`;
  }
  if (debateBeat === "vote-intent" || clockStatus === "vote-open") {
    return `时机窗口：票前只剩短回应窗口，${focusLabel} 如果补不出身份和票型，就把压力转成票意。`;
  }
  if (dayStage === "public" && safePublicRounds <= 1) {
    return `时机窗口：第${safeDay}天公聊早段先轻压 ${focusLabel}，重点收回应和站边，不急着锁提名。`;
  }
  if (dayStage === "public") {
    return `时机窗口：第${safeDay}天公聊已过一轮，${focusLabel} 如果仍回避，就从追问推进到提名前复核。`;
  }
  if (dayStage === "private") {
    return `时机窗口：私聊阶段先把 ${focusLabel} 的身份、票型和发言线问清，公开时只带可复核部分。`;
  }
  if (flags.has("low-evidence")) {
    return `时机窗口：${focusLabel} 还只是低证据入口，当前只适合观察和复核，不急进提名。`;
  }
  if ((reasonKey === "close-call" || flags.has("close-score-gap")) && hasRunnerUp) {
    return `时机窗口：${focusLabel} 和 ${runnerLabel} 仍贴线，先用一轮对比回应决定谁进提名池。`;
  }
  if (confidenceBand === "clear" || focusScore >= 0.74) {
    return `时机窗口：${focusLabel} 已接近提名前复核，但仍要留最后回应窗口，避免直接锁票。`;
  }
  return `时机窗口：当前先压 ${focusLabel} 的回应质量，等票型和发言变化后再决定是否升级提名。`;
}

function buildDecisionWorldBranchLine({
  focusName = "",
  runnerUpName = "",
  reasonKey = "",
  evidenceMode = "",
  riskFlags = [],
  hasRunnerUp = false,
  publicOnly = false,
} = {}) {
  const focusLabel = focusName || "这个位置";
  const runnerLabel = runnerUpName || "第二候选";
  const flags = new Set(riskFlags ?? []);
  if (evidenceMode === "private-rumor" || publicOnly || flags.has("public-only")) {
    return `世界分支：如果 ${focusLabel} 公开解释成立，私下入口先降级；如果解释断开，只把可见身份、票型和发言纳入坏身份线。`;
  }
  if (evidenceMode === "night-info") {
    return `世界分支：如果 ${focusLabel} 时间线成立，夜里信息分支降压；如果断开，就把身份口径和死亡信息并入坏身份线。`;
  }
  if (evidenceMode === "vote-shape") {
    return `世界分支：如果 ${focusLabel} 票型只是自保，好身份分支保留；如果上票动机断开，就把跟票和推人并入坏身份线。`;
  }
  if (evidenceMode === "claim-chain") {
    return `世界分支：如果 ${focusLabel} 身份口径能接上，好身份分支成立；如果越解释越散，就改看坏身份分支。`;
  }
  if (flags.has("runner-up-evidence-lead") && hasRunnerUp) {
    return `世界分支：如果 ${focusLabel} 解释成立，主线要回到 ${runnerLabel}；如果解释断开，两边同时保留压力。`;
  }
  if ((reasonKey === "close-call" || flags.has("close-score-gap")) && hasRunnerUp) {
    return `世界分支：${focusLabel} 和 ${runnerLabel} 是两条贴线世界，谁的身份、票型先断开，谁先进入提名池。`;
  }
  if (flags.has("low-evidence") || evidenceMode === "low-evidence") {
    return `世界分支：如果 ${focusLabel} 是好身份，这条只是低证据误伤；如果补不出公开线，再升级坏身份分支。`;
  }
  if (reasonKey === "more-visible-evidence") {
    return `世界分支：如果 ${focusLabel} 逐条解释成立，就重排压力；如果多条线仍断开，坏身份分支继续领先。`;
  }
  if (reasonKey === "only-eligible-target" || !hasRunnerUp) {
    return `世界分支：如果 ${focusLabel} 补出公开证据，好身份分支回升；如果没有新线，只作为当前坏身份入口。`;
  }
  return `世界分支：如果 ${focusLabel} 的身份、票型和发言能互相接上就降压；接不上就保留坏身份分支。`;
}

function buildDecisionVoteCoalitionLine({
  focusName = "",
  runnerUpName = "",
  reasonKey = "",
  evidenceMode = "",
  confidenceBand = "",
  focusScore = 0,
  riskFlags = [],
  hasRunnerUp = false,
  dayStage = "",
  debateBeat = "",
  audience = "",
  publicOnly = false,
} = {}) {
  const focusLabel = focusName || "这个位置";
  const runnerLabel = runnerUpName || "第二候选";
  const flags = new Set(riskFlags ?? []);
  if (evidenceMode === "private-rumor" || publicOnly || flags.has("public-only")) {
    return `票面联盟：公开场上只用 ${focusLabel} 的可见身份、票型和发言凑共识，不能拿私下判断要票。`;
  }
  if (flags.has("low-evidence") || evidenceMode === "low-evidence") {
    return `票面联盟：${focusLabel} 证据薄时不该先凑处决票，只记录谁愿意轻跟，等公开线补足理由再谈上票。`;
  }
  if (flags.has("runner-up-evidence-lead") && hasRunnerUp) {
    return `票面联盟：${runnerLabel} 仍要留第二票面，压 ${focusLabel} 时不能把票都挤到单一路径，避免分票后没人负责。`;
  }
  if ((reasonKey === "close-call" || flags.has("close-score-gap")) && hasRunnerUp) {
    return `票面联盟：${focusLabel} 和 ${runnerLabel} 票面容易分散，先让两边支持者给理由，再决定主票线。`;
  }
  if (audience === "nomination" || dayStage === "nomination" || debateBeat === "nomination-pressure") {
    return `票面联盟：提 ${focusLabel} 前要看愿意跟票的人能否说清理由，票数不够就先当压力台而不是硬处决。`;
  }
  if (debateBeat === "vote-intent") {
    return `票面联盟：票前看 ${focusLabel} 的解释质量和跟票理由，只有回应断开才把压力转成处决票。`;
  }
  if (confidenceBand === "clear" || focusScore >= 0.74 || reasonKey === "more-visible-evidence") {
    return `票面联盟：${focusLabel} 压力高也要确认票面来源，不能让无理由跟票把处决票带歪。`;
  }
  if (reasonKey === "only-eligible-target" || !hasRunnerUp) {
    return `票面联盟：${focusLabel} 只是当前入口，先试能否形成公开共识，票面不足就继续收线。`;
  }
  return `票面联盟：压 ${focusLabel} 时先看谁愿意给理由跟票，能成共识再谈提名，不能成就回到第二压力位。`;
}

function buildDecisionSourceReliabilityLine({
  focusName = "",
  runnerUpName = "",
  reasonKey = "",
  evidenceMode = "",
  focusEvidenceCount = 0,
  riskFlags = [],
  hasRunnerUp = false,
  publicOnly = false,
} = {}) {
  const focusLabel = focusName || "这个位置";
  const runnerLabel = runnerUpName || "第二候选";
  const flags = new Set(riskFlags ?? []);
  if (evidenceMode === "private-rumor" || publicOnly || flags.has("public-only")) {
    return `来源可靠度：${focusLabel} 这条含私下入口，公开只算可复核问题；没接上公开身份、票型或发言前先降权。`;
  }
  if (flags.has("low-evidence") || evidenceMode === "low-evidence" || focusEvidenceCount <= 0) {
    return `来源可靠度：${focusLabel} 目前只有单点证据，先等第二独立来源或公开回应，再决定是否升级。`;
  }
  if (flags.has("runner-up-evidence-lead") && hasRunnerUp) {
    return `来源可靠度：${runnerLabel} 的来源更多，${focusLabel} 先按可复核回应排前，后续证据要能独立托住才不重排。`;
  }
  if ((reasonKey === "close-call" || flags.has("close-score-gap")) && hasRunnerUp) {
    return `来源可靠度：${focusLabel} 和 ${runnerLabel} 贴线时先看谁有独立来源；如果只是同源回声就降权重排。`;
  }
  if (evidenceMode === "night-info") {
    return `来源可靠度：${focusLabel} 的夜里信息要接上死亡、保护或身份时间线，接不上就按污染风险降权。`;
  }
  if (evidenceMode === "vote-shape") {
    return `来源可靠度：${focusLabel} 的票型证据要区分自保、跟票和主动推人，同源跟票不能当第二来源。`;
  }
  if (evidenceMode === "claim-chain") {
    return `来源可靠度：${focusLabel} 的身份口径要前后可复核；只重复身份名不算独立来源。`;
  }
  if (evidenceMode === "evidence-count" || reasonKey === "more-visible-evidence") {
    return `来源可靠度：${focusLabel} 有多条证据时要先去同源回声，保留能互相独立复核的来源。`;
  }
  if (evidenceMode === "public-speech") {
    return `来源可靠度：${focusLabel} 的公开发言只能算节奏来源，必须接上身份、票型或回应细节才升权。`;
  }
  return `来源可靠度：${focusLabel} 的混合证据先按可复核来源排序，身份、票型和发言彼此独立时才加权。`;
}

function buildDecisionTimelineConsistencyLine({
  focusName = "",
  runnerUpName = "",
  reasonKey = "",
  evidenceMode = "",
  riskFlags = [],
  hasRunnerUp = false,
  day = 0,
  dayStage = "",
  publicRounds = 0,
  debateBeat = "",
  audience = "",
  publicOnly = false,
} = {}) {
  const focusLabel = focusName || "这个位置";
  const runnerLabel = runnerUpName || "第二候选";
  const flags = new Set(riskFlags ?? []);
  const latePublic = publicRounds > 1 || debateBeat === "nomination-pressure" || debateBeat === "vote-intent";
  if (evidenceMode === "private-rumor" || publicOnly || flags.has("public-only")) {
    return `时间线一致性：${focusLabel} 先按公开时间线核，私下入口只能变成问题；公开身份、票型和发言顺序接不上才升级。`;
  }
  if (flags.has("low-evidence") || evidenceMode === "low-evidence") {
    return `时间线一致性：${focusLabel} 目前时间节点太少，先补一条更早的发言、票型或身份节点，再判断是不是临场改口。`;
  }
  if (flags.has("runner-up-evidence-lead") && hasRunnerUp) {
    return `时间线一致性：${runnerLabel} 的时间线更完整；${focusLabel} 要能解释先后顺序，否则主线回到第二压力位。`;
  }
  if ((reasonKey === "close-call" || flags.has("close-score-gap")) && hasRunnerUp) {
    return `时间线一致性：${focusLabel} 和 ${runnerLabel} 贴线时，先看谁的身份、票型、回应先后更自洽，再决定主压谁。`;
  }
  if (evidenceMode === "night-info") {
    return `时间线一致性：${focusLabel} 的夜里信息要对上死亡、保护或身份公开的先后顺序；顺序断了先按污染线降权。`;
  }
  if (evidenceMode === "vote-shape") {
    return `时间线一致性：${focusLabel} 的投票要看是在解释前还是解释后；先上票后补理由比先给理由再上票更吃压力。`;
  }
  if (evidenceMode === "claim-chain") {
    return `时间线一致性：${focusLabel} 的身份口径要分清先报、被压后改口和事后补细节；越晚补越需要公开复核。`;
  }
  if (evidenceMode === "evidence-count" || reasonKey === "more-visible-evidence") {
    return `时间线一致性：${focusLabel} 的多条证据要按发生顺序排，早期独立节点比事后跟风节点更能加权。`;
  }
  if (evidenceMode === "public-speech") {
    return `时间线一致性：${focusLabel} 的公开发言要看从质疑、回避到补证是否连续；中间断层就是继续追问点。`;
  }
  if (dayStage === "nomination" || audience === "nomination") {
    return `时间线一致性：提 ${focusLabel} 前先核身份、票型和回应顺序，不能只拿最后一句临场表态当完整证据。`;
  }
  if (latePublic || day > 1) {
    return `时间线一致性：${focusLabel} 到后段要能把早前发言、当前回应和票型连起来；连不上就不直接锁死。`;
  }
  return `时间线一致性：${focusLabel} 的身份、票型和发言要按先后顺序互相接住，顺序越断越先降权复核。`;
}

function buildDecisionIncentiveAlignmentLine({
  focusName = "",
  runnerUpName = "",
  reasonKey = "",
  evidenceMode = "",
  confidenceBand = "",
  riskFlags = [],
  hasRunnerUp = false,
  publicOnly = false,
} = {}) {
  const focusLabel = focusName || "这个位置";
  const runnerLabel = runnerUpName || "第二候选";
  const flags = new Set(riskFlags ?? []);
  if (evidenceMode === "private-rumor" || publicOnly || flags.has("public-only")) {
    return `动机归因：${focusLabel} 这条只能按公开行为看，先分清是在解桌、保自己还是转移压力，不能拿私下动机定性。`;
  }
  if (flags.has("low-evidence") || evidenceMode === "low-evidence") {
    return `动机归因：${focusLabel} 目前行为收益不清，先问这句话是在补信息还是保位置；动机不明就只轻压。`;
  }
  if (flags.has("runner-up-evidence-lead") && hasRunnerUp) {
    return `动机归因：${runnerLabel} 也有收益解释；${focusLabel} 要说明这条行为不是单纯自保或把压力转走。`;
  }
  if ((reasonKey === "close-call" || flags.has("close-score-gap")) && hasRunnerUp) {
    return `动机归因：${focusLabel} 和 ${runnerLabel} 贴线时，谁更像解桌、谁更像护人或转移压力，是主压分水岭。`;
  }
  if (evidenceMode === "night-info") {
    return `动机归因：${focusLabel} 如果拿夜里信息挡压，要看是在补公开解法，还是借模糊信息保护自己或带偏票型。`;
  }
  if (evidenceMode === "vote-shape") {
    return `动机归因：${focusLabel} 的票型要拆成自保、跟风和主动推人；谁从这票受益，决定压力方向。`;
  }
  if (evidenceMode === "claim-chain") {
    return `动机归因：${focusLabel} 的身份口径要看是在主动解桌还是被压后补防线；只保自己不补公共信息就加压。`;
  }
  if (evidenceMode === "evidence-count" || reasonKey === "more-visible-evidence") {
    return `动机归因：${focusLabel} 多条证据合并后要看共同收益指向谁；如果都在帮同一人脱压，就按护人线处理。`;
  }
  if (evidenceMode === "public-speech") {
    return `动机归因：${focusLabel} 的公开发言要看是在贡献可检验信息，还是只把话题从自己或盟友身上移走。`;
  }
  if (confidenceBand === "clear") {
    return `动机归因：${focusLabel} 压力高时更要看收益链，谁跟着这条线获利、谁被挡在压力外，都要记下来。`;
  }
  return `动机归因：${focusLabel} 的身份、票型和发言先拆收益：解桌加可信，自保降一点，护人或转移压力继续追。`;
}

function buildDecisionBurdenOfProofLine({
  focusName = "",
  runnerUpName = "",
  reasonKey = "",
  evidenceMode = "",
  confidenceBand = "",
  riskFlags = [],
  hasRunnerUp = false,
  audience = "",
  publicOnly = false,
} = {}) {
  const focusLabel = focusName || "这个位置";
  const runnerLabel = runnerUpName || "第二候选";
  const flags = new Set(riskFlags ?? []);
  if (evidenceMode === "private-rumor" || publicOnly || flags.has("public-only")) {
    return `举证责任：公开场上先让 ${focusLabel} 解释身份、票型和发言；私下入口不能替他定性，只能变成公开追问。`;
  }
  if (flags.has("low-evidence") || evidenceMode === "low-evidence") {
    return `举证责任：${focusLabel} 目前只需要补第一条可复核理由，桌面不能把低证据入口直接当处决结论。`;
  }
  if (flags.has("runner-up-evidence-lead") && hasRunnerUp) {
    return `举证责任：${focusLabel} 要先回答当前疑点，${runnerLabel} 的支持者也要给公开理由，不能只靠排序把第二压力位放掉。`;
  }
  if ((reasonKey === "close-call" || flags.has("close-score-gap")) && hasRunnerUp) {
    return `举证责任：${focusLabel} 和 ${runnerLabel} 贴线时，两边支持者都要说清身份、票型或发言理由，再决定主压。`;
  }
  if (evidenceMode === "night-info") {
    return `举证责任：${focusLabel} 如果引用夜里信息，就要说明能公开复核的死亡、保护或身份链；说不清就不能让桌面替他补。`;
  }
  if (evidenceMode === "vote-shape") {
    return `举证责任：${focusLabel} 的投票理由要由本人讲清；跟票者也要说为什么跟，没人给理由就先降权。`;
  }
  if (evidenceMode === "claim-chain") {
    return `举证责任：${focusLabel} 的身份口径由本人承担，护他的人要补公开链；只说相信他不算理由。`;
  }
  if (evidenceMode === "evidence-count" || reasonKey === "more-visible-evidence") {
    return `举证责任：${focusLabel} 面对多条证据要逐条回应，支持者也要解释哪条证据可被推翻，而不是只喊别推。`;
  }
  if (evidenceMode === "public-speech") {
    return `举证责任：${focusLabel} 的公开发言要能落到身份、票型或可复核信息；只给态度不给理由就继续追。`;
  }
  if (audience === "nomination" || confidenceBand === "clear") {
    return `举证责任：${focusLabel} 进提名压力前必须给清楚回应，愿意上票的人也要给公开理由，避免空理由带票。`;
  }
  return `举证责任：先让 ${focusLabel} 把身份、票型和发言理由讲完整；谁替他护航，谁也要补可复核理由。`;
}

function buildDecisionQuestionPriorityLine({
  focusName = "",
  runnerUpName = "",
  reasonKey = "",
  evidenceMode = "",
  confidenceBand = "",
  riskFlags = [],
  hasRunnerUp = false,
  audience = "",
  publicOnly = false,
} = {}) {
  const focusLabel = focusName || "这个位置";
  const runnerLabel = runnerUpName || "第二候选";
  const flags = new Set(riskFlags ?? []);
  if (evidenceMode === "private-rumor" || publicOnly || flags.has("public-only")) {
    return `追问顺序：下一句我会这样追问 ${focusLabel}，先把公开身份、票型和发言问完，再把私下入口转成可复核问题。`;
  }
  if (flags.has("low-evidence") || evidenceMode === "low-evidence") {
    return `追问顺序：下一句我会这样追问 ${focusLabel}，先问一条可复核理由，再听票型；没有回应前不急着追第二轮。`;
  }
  if (flags.has("runner-up-evidence-lead") && hasRunnerUp) {
    return `追问顺序：下一句我会这样追问 ${focusLabel}，先让他回答当前主疑点，再立刻回看 ${runnerLabel} 的独立线索。`;
  }
  if ((reasonKey === "close-call" || flags.has("close-score-gap")) && hasRunnerUp) {
    return `追问顺序：下一句我会这样追问 ${focusLabel}，再问 ${runnerLabel} 一条身份或票型理由，按谁回答断开决定主压。`;
  }
  if (evidenceMode === "night-info") {
    return `追问顺序：下一句我会这样追问 ${focusLabel}，先核死亡、保护或身份时间线，再问票型和公开发言能否接上。`;
  }
  if (evidenceMode === "vote-shape") {
    return `追问顺序：下一句我会这样追问 ${focusLabel}，先问为什么上票，再问跟票者理由，最后看这票是否能进提名压力。`;
  }
  if (evidenceMode === "claim-chain") {
    return `追问顺序：下一句我会这样追问 ${focusLabel}，先问身份口径前后，再核谁替他背书，最后看票型是否配合。`;
  }
  if (evidenceMode === "evidence-count" || reasonKey === "more-visible-evidence") {
    return `追问顺序：下一句我会这样追问 ${focusLabel}，先让他逐条回应最强证据，再挑一条让支持者解释，答不上就升压。`;
  }
  if (evidenceMode === "public-speech") {
    return `追问顺序：下一句我会这样追问 ${focusLabel}，先问发言里最可复核的一点，再看态度是否落到身份或票型。`;
  }
  if (audience === "nomination" || confidenceBand === "clear") {
    return `追问顺序：下一句我会这样追问 ${focusLabel}，先给最后一轮公开回应，再听愿意上票的人理由，回应断开才转处决票。`;
  }
  return `追问顺序：下一句我会这样追问 ${focusLabel}，先问身份、票型和发言链，再根据回应质量决定是否回看 ${runnerLabel}。`;
}

function buildDecisionActionThresholdLine({
  focusName = "",
  runnerUpName = "",
  reasonKey = "",
  evidenceMode = "",
  confidenceBand = "",
  focusScore = 0,
  riskFlags = [],
  hasRunnerUp = false,
  dayStage = "",
  audience = "",
  publicOnly = false,
} = {}) {
  const focusLabel = focusName || "这个位置";
  const runnerLabel = runnerUpName || "第二候选";
  const flags = new Set(riskFlags ?? []);
  if (flags.has("low-evidence") || evidenceMode === "low-evidence") {
    return `行动门槛：${focusLabel} 现在只到观察追问，不到提名或处决票；先补一条可复核证据再升级。`;
  }
  if (evidenceMode === "private-rumor" || publicOnly || flags.has("public-only")) {
    return `行动门槛：${focusLabel} 只能按公开回应推进，私下线索不直接上票；公开身份、票型或发言断开才升级。`;
  }
  if ((reasonKey === "close-call" || flags.has("close-score-gap")) && hasRunnerUp) {
    return `行动门槛：${focusLabel} 和 ${runnerLabel} 贴线时先不锁票，谁的回应先断开，谁才进提名压力。`;
  }
  if (flags.has("runner-up-evidence-lead") && hasRunnerUp) {
    return `行动门槛：${focusLabel} 要先过当前回应门槛；如果 ${runnerLabel} 的独立证据更硬，主压就回切。`;
  }
  if (audience === "nomination" || dayStage === "nomination") {
    return `行动门槛：${focusLabel} 已经进入提名审查，回应接不上就可以要票，回应能接上就降回压力台。`;
  }
  if (confidenceBand === "clear" || focusScore >= 0.74) {
    return `行动门槛：${focusLabel} 已到主压力位，但处决票还要看公开回应和跟票理由；断开才锁票。`;
  }
  if (evidenceMode === "vote-shape") {
    return `行动门槛：${focusLabel} 的票型能解释就停在压力台，解释不了才从追问转提名。`;
  }
  if (evidenceMode === "claim-chain") {
    return `行动门槛：${focusLabel} 的身份链接不上才升级提名；能补出可复核身份就先降压。`;
  }
  if (evidenceMode === "night-info") {
    return `行动门槛：${focusLabel} 的夜里信息要接上死亡、保护或身份时间线；接不上才进入提名池。`;
  }
  if (reasonKey === "more-visible-evidence" || evidenceMode === "evidence-count") {
    return `行动门槛：${focusLabel} 证据更多但还要看回应质量；逐条答不上才从主压转成处决票。`;
  }
  return `行动门槛：${focusLabel} 先停在可加压观察位，等身份、票型或发言有一条断开再升级。`;
}

function buildDecisionMemoryContinuityLine({
  state = null,
  focusName = "",
  evidenceMode = "",
  reasonKey = "",
  focusEvidenceCount = 0,
  stanceMemory = null,
  targetSwitchContinuity = null,
} = {}) {
  const focusLabel = focusName || "这个位置";
  const crossDay = stanceMemory?.crossDayStance ?? null;
  const dayWord = crossDay?.dayGap === 1 ? "昨天" : Number.isFinite(crossDay?.dayGap) ? `${crossDay.dayGap}天前` : "";
  const previousLabel = dayStanceLabel(crossDay?.previousStance);
  const currentLabel = dayStanceLabel(crossDay?.currentStance ?? stanceMemory?.stance);
  const evidenceDelta = Number(crossDay?.evidenceDelta ?? 0);
  const deltaText =
    evidenceDelta > 0
      ? `比之前多 ${evidenceDelta} 条可见证据`
      : evidenceDelta < 0
      ? `比之前少 ${Math.abs(evidenceDelta)} 条可见证据`
      : "证据量和之前持平";
  if (crossDay && Number.isFinite(crossDay.previousDay)) {
    if (crossDay.continuity === "hold") {
      return `记忆连续性：${focusLabel} 不是新起线，${dayWord}也是“${currentLabel}”；${deltaText}，所以继续按同一主线复核。`;
    }
    return `记忆连续性：${focusLabel} 从${dayWord}的“${previousLabel}”转成“${currentLabel}”；${deltaText}，这次改看法不是单轮重算。`;
  }
  const targetSwitchLine = buildDecisionTargetSwitchLine(state, targetSwitchContinuity);
  if (targetSwitchLine) {
    return targetSwitchLine;
  }
  if ((stanceMemory?.turns ?? 0) > 1) {
    return `记忆连续性：本日第 ${stanceMemory.turns} 次看 ${focusLabel}，这条是同一目标延续；新回应只调整压力，不重置读法。`;
  }
  if (focusEvidenceCount > 0 || reasonKey === "more-visible-evidence") {
    return `记忆连续性：${focusLabel} 先按本轮 ${focusEvidenceCount} 条可见证据建档，后续发言会和这条记录对照。`;
  }
  if (evidenceMode === "low-evidence") {
    return `记忆连续性：${focusLabel} 现在只是低证据入口，先记观察档，等新身份、票型或发言再改看法。`;
  }
  return `记忆连续性：${focusLabel} 先按本轮公开线索建档，后续若转向要能说清是哪条证据改变了读法。`;
}

function buildDecisionExpressionDisciplineLine({
  focusName = "",
  runnerUpName = "",
  reasonKey = "",
  evidenceMode = "",
  confidenceBand = "",
  riskFlags = [],
  hasRunnerUp = false,
  publicOnly = false,
} = {}) {
  const focusLabel = focusName || "这个位置";
  const runnerLabel = runnerUpName || "第二候选";
  const flags = new Set(riskFlags ?? []);
  if (evidenceMode === "private-rumor") {
    return `表达纪律：${focusLabel} 这条先转成公开追问，不把私下入口说成结论；句子只落在身份、票型和发言复核上。`;
  }
  if (publicOnly || flags.has("public-only")) {
    return `表达纪律：公开说法只说 ${focusLabel} 需要解释身份、票型和发言，不把听感说成结论。`;
  }
  if (flags.has("low-evidence") || evidenceMode === "low-evidence") {
    return `表达纪律：${focusLabel} 先用追问口吻，不说定性；句子要落在请补可复核理由。`;
  }
  if ((reasonKey === "close-call" || flags.has("close-score-gap")) && hasRunnerUp) {
    return `表达纪律：${focusLabel} 和 ${runnerLabel} 贴线时先说对比，不说锁死；把分歧留给回应质量。`;
  }
  if (evidenceMode === "vote-shape") {
    return `表达纪律：谈 ${focusLabel} 的票型时只说上票理由和跟票解释，不把跟票直接说成坏身份。`;
  }
  if (evidenceMode === "claim-chain") {
    return `表达纪律：压 ${focusLabel} 的身份口径时先说前后是否接上，不用锁死词；结论跟公开回应走。`;
  }
  if (evidenceMode === "night-info") {
    return `表达纪律：夜里信息只说 ${focusLabel} 能公开接上的死亡、保护或身份时间线，不替私有信息背书。`;
  }
  if (confidenceBand === "clear") {
    return `表达纪律：${focusLabel} 即使是主压力，也先说回应断开才升级，不把强压说成无条件处决。`;
  }
  return `表达纪律：${focusLabel} 这条先用问题和条件句表达，结论跟着公开回应走。`;
}

function buildDecisionUncertaintyResolutionLine({
  focusName = "",
  runnerUpName = "",
  reasonKey = "",
  evidenceMode = "",
  confidenceBand = "",
  riskFlags = [],
  hasRunnerUp = false,
  publicOnly = false,
} = {}) {
  const focusLabel = focusName || "这个位置";
  const runnerLabel = runnerUpName || "第二候选";
  const flags = new Set(riskFlags ?? []);
  if (evidenceMode === "private-rumor" || publicOnly || flags.has("public-only")) {
    return `不确定性：${focusLabel} 的非公开入口还不能公开定性；只能靠公开身份、票型和发言回应消解。`;
  }
  if (flags.has("low-evidence") || evidenceMode === "low-evidence") {
    return `不确定性：${focusLabel} 还缺第一条公开可复核证据；先补身份、票型或发言锚点，再决定是否加压。`;
  }
  if ((reasonKey === "close-call" || flags.has("close-score-gap")) && hasRunnerUp) {
    return `不确定性：${focusLabel} 和 ${runnerLabel} 的差异还没拉开；谁先在公开身份、票型或回应上断开，谁升级压力。`;
  }
  if (flags.has("runner-up-evidence-lead") && hasRunnerUp) {
    return `不确定性：${focusLabel} 领先但 ${runnerLabel} 证据不弱；要用公开回应质量决定是否回切主压。`;
  }
  if (evidenceMode === "night-info") {
    return `不确定性：${focusLabel} 的夜里信息还要接上公开死亡、保护或身份时间线；接不上前只当待验证压力。`;
  }
  if (evidenceMode === "vote-shape") {
    return `不确定性：${focusLabel} 的票型还要分清自保、跟票还是主动推人；公开理由补不出才升级。`;
  }
  if (evidenceMode === "claim-chain") {
    return `不确定性：${focusLabel} 的身份线还差前后口径和公开背书；接上就降压，断开才进提名压力。`;
  }
  if (evidenceMode === "evidence-count" || reasonKey === "more-visible-evidence") {
    return `不确定性：${focusLabel} 证据多但还要看是否同源；需要一条独立公开回应来消解。`;
  }
  if (evidenceMode === "public-speech") {
    return `不确定性：${focusLabel} 的发言压力还缺可复核落点；下一轮看身份、票型或信息是否落地。`;
  }
  if (confidenceBand === "clear") {
    return `不确定性：${focusLabel} 压力高但还剩回应质量这一关；公开回答断开才从主压变成处决理由。`;
  }
  return `不确定性：${focusLabel} 还要靠公开身份、票型和发言回应消解；没新证据前先保留压力。`;
}

function buildDecisionEvidenceFreshnessLine({
  focusName = "",
  reasonKey = "",
  evidenceMode = "",
  confidenceBand = "",
  focusEvidenceCount = 0,
  riskFlags = [],
  stanceMemory = null,
  publicOnly = false,
} = {}) {
  const focusLabel = focusName || "这个位置";
  const flags = new Set(riskFlags ?? []);
  const crossDay = stanceMemory?.crossDayStance ?? null;
  if (crossDay?.continuity === "shift") {
    return `证据新鲜度：${focusLabel} 今天有新可见证据改变读法，先用当前公开回应校验，不把旧印象直接搬过来。`;
  }
  if (crossDay?.continuity === "hold") {
    return `证据新鲜度：${focusLabel} 是跨日延续线，但今天仍要看当前回应；旧线索不单独当新结论。`;
  }
  if ((stanceMemory?.turns ?? 0) > 1) {
    return `证据新鲜度：本日第 ${stanceMemory.turns} 次看 ${focusLabel}，这次只根据新回应刷新压力，不重复消费旧理由。`;
  }
  if (flags.has("low-evidence") || evidenceMode === "low-evidence") {
    return `证据新鲜度：${focusLabel} 还没有新鲜硬证据，先记观察位；等本轮身份、票型或发言补点再刷新。`;
  }
  if (evidenceMode === "private-rumor" || publicOnly || flags.has("public-only")) {
    return `证据新鲜度：${focusLabel} 的私下或旧线索要转成当前公开回应，不能把旧入口直接当新证据。`;
  }
  if (evidenceMode === "vote-shape") {
    return `证据新鲜度：${focusLabel} 的票型要看是本轮新动作还是旧跟票；旧票型只做背景，新回应才决定升压。`;
  }
  if (evidenceMode === "claim-chain") {
    return `证据新鲜度：${focusLabel} 的身份口径要看最新一次公开说法；旧口径只和当前回应对照，不单独锁死。`;
  }
  if (evidenceMode === "night-info") {
    return `证据新鲜度：${focusLabel} 的夜里信息要接上今天公开的死亡、保护或身份时间线；过夜旧线要重新校验。`;
  }
  if (evidenceMode === "evidence-count" || reasonKey === "more-visible-evidence" || focusEvidenceCount > 1) {
    return `证据新鲜度：${focusLabel} 多条证据里要先分新旧和同源；新独立回应比重复旧线索更能决定压力。`;
  }
  if (confidenceBand === "clear") {
    return `证据新鲜度：${focusLabel} 即使是强压，也要用当前回应刷新判断；旧理由不能替代今天的公开解释。`;
  }
  return `证据新鲜度：${focusLabel} 先按本轮线索建档，下一次只用新回应或新证据刷新这条读法。`;
}

function buildDecisionFalsificationCheckLine({
  focusName = "",
  runnerUpName = "",
  reasonKey = "",
  evidenceMode = "",
  confidenceBand = "",
  riskFlags = [],
  hasRunnerUp = false,
  publicOnly = false,
} = {}) {
  const focusLabel = focusName || "这个位置";
  const runnerLabel = runnerUpName || "第二候选";
  const flags = new Set(riskFlags ?? []);
  if (publicOnly || flags.has("public-only")) {
    return `证伪检查：如果 ${focusLabel} 的公开身份、票型和发言能自洽，这条公开压力就要降级。`;
  }
  if (evidenceMode === "private-rumor") {
    return `证伪检查：如果 ${focusLabel} 的公开身份、票型和发言能自洽，私下入口就不能继续当主压理由。`;
  }
  if (flags.has("low-evidence") || evidenceMode === "low-evidence") {
    return `证伪检查：如果 ${focusLabel} 能补出一条可复核身份、票型或发言理由，这条低证据读法就先降级。`;
  }
  if ((reasonKey === "close-call" || flags.has("close-score-gap")) && hasRunnerUp) {
    return `证伪检查：如果 ${focusLabel} 回应接上而 ${runnerLabel} 先断开，主压必须回切，不能靠旧排序硬压。`;
  }
  if (flags.has("runner-up-evidence-lead") && hasRunnerUp) {
    return `证伪检查：如果 ${runnerLabel} 的独立证据更硬且 ${focusLabel} 回应接上，就把主压力交还第二线。`;
  }
  if (evidenceMode === "night-info") {
    return `证伪检查：如果 ${focusLabel} 的夜里信息能接上死亡、保护或身份时间线，这条夜信压力就要降级。`;
  }
  if (evidenceMode === "vote-shape") {
    return `证伪检查：如果 ${focusLabel} 能说清自保、跟票或上票理由，票型就只留背景，不能单独定性。`;
  }
  if (evidenceMode === "claim-chain") {
    return `证伪检查：如果 ${focusLabel} 的身份口径前后接上并有人给公开背书，这条身份压力就要降级。`;
  }
  if (evidenceMode === "evidence-count" || reasonKey === "more-visible-evidence") {
    return `证伪检查：如果 ${focusLabel} 能逐条解释多条证据且没有同源回声，压力要从处决线降回复核线。`;
  }
  if (evidenceMode === "public-speech") {
    return `证伪检查：如果 ${focusLabel} 下一轮公开发言能落到身份、票型或可验证信息，这条发言压力就先降级。`;
  }
  if (confidenceBand === "clear") {
    return `证伪检查：即使 ${focusLabel} 是强压位，只要公开回应把断点补齐，就不能继续按强压结论推进。`;
  }
  return `证伪检查：如果 ${focusLabel} 能用公开身份、票型或发言补齐断点，这条读法就先降级再观察。`;
}

function buildDecisionCausalChainLine({
  focusName = "",
  runnerUpName = "",
  reasonKey = "",
  evidenceMode = "",
  confidenceBand = "",
  riskFlags = [],
  hasRunnerUp = false,
  publicOnly = false,
} = {}) {
  const focusLabel = focusName || "这个位置";
  const runnerLabel = runnerUpName || "第二候选";
  const flags = new Set(riskFlags ?? []);
  if (publicOnly || flags.has("public-only")) {
    return `因果链：${focusLabel} 的公开身份、票型或发言如果接不上，就会让台面少一条可复核解释，所以压力来自公开链条断点。`;
  }
  if (evidenceMode === "private-rumor") {
    return `因果链：私下入口只能先提示 ${focusLabel} 有断点；它必须转成公开身份、票型或发言矛盾，才会真正推动压力。`;
  }
  if (flags.has("low-evidence") || evidenceMode === "low-evidence") {
    return `因果链：${focusLabel} 现在缺可复核动作，所以只能先制造追问；如果追问没有产出证据，压力不能自然升级。`;
  }
  if ((reasonKey === "close-call" || flags.has("close-score-gap")) && hasRunnerUp) {
    return `因果链：${focusLabel} 和 ${runnerLabel} 贴线时，谁的公开回应先断开，谁就更会吸走桌面压力。`;
  }
  if (flags.has("runner-up-evidence-lead") && hasRunnerUp) {
    return `因果链：${runnerLabel} 证据不弱，所以 ${focusLabel} 必须用更清楚的公开回应解释压力差，否则主线会回到第二压力位。`;
  }
  if (evidenceMode === "night-info") {
    return `因果链：${focusLabel} 的夜里信息如果接不上死亡、保护或身份时间线，就会污染判断；接上才会变成有效压力。`;
  }
  if (evidenceMode === "vote-shape") {
    return `因果链：${focusLabel} 的上票或跟票会改变处决窗口；说不清理由时，票型才从背景变成压力来源。`;
  }
  if (evidenceMode === "claim-chain") {
    return `因果链：${focusLabel} 的身份口径如果前后断开，其他证据就会一起变重；口径接上则票型和发言先降权。`;
  }
  if (evidenceMode === "evidence-count" || reasonKey === "more-visible-evidence") {
    return `因果链：${focusLabel} 多条证据合流会压缩解释空间；只要逐条解释能接上，压力就不该直接变成处决。`;
  }
  if (evidenceMode === "public-speech") {
    return `因果链：${focusLabel} 的公开发言如果只转移话题，会让身份、票型和信息链继续空着，所以先形成追问压力。`;
  }
  if (confidenceBand === "clear") {
    return `因果链：${focusLabel} 压力高是因为断点会连续影响身份、票型和回应；只要断点补齐，强压就要回落。`;
  }
  return `因果链：${focusLabel} 的行为先影响公开解释空间，再影响桌面压力；下一步要看回应能不能把链条接住。`;
}

function buildDecisionAssumptionAuditLine({
  focusName = "",
  runnerUpName = "",
  reasonKey = "",
  evidenceMode = "",
  confidenceBand = "",
  riskFlags = [],
  hasRunnerUp = false,
  publicOnly = false,
} = {}) {
  const focusLabel = focusName || "这个位置";
  const runnerLabel = runnerUpName || "第二候选";
  const flags = new Set(riskFlags ?? []);
  if (publicOnly || flags.has("public-only")) {
    return `前提审计：这条读法只假设 ${focusLabel} 的公开身份、票型和发言应当能自洽；不能假设私下信息已经成立。`;
  }
  if (evidenceMode === "private-rumor") {
    return `前提审计：这条读法依赖 ${focusLabel} 的私下入口能转成公开矛盾；转不出来就不能当硬证据。`;
  }
  if (flags.has("low-evidence") || evidenceMode === "low-evidence") {
    return `前提审计：这条读法只假设 ${focusLabel} 需要补公开理由，不假设他已经是坏身份；证据薄就先停在追问。`;
  }
  if ((reasonKey === "close-call" || flags.has("close-score-gap")) && hasRunnerUp) {
    return `前提审计：${focusLabel} 领先的前提是回应质量会比 ${runnerLabel} 更差；如果没有拉开，就继续并排比较。`;
  }
  if (flags.has("runner-up-evidence-lead") && hasRunnerUp) {
    return `前提审计：压 ${focusLabel} 的前提是当前压力比 ${runnerLabel} 更能产出解释；否则第二压力位不能被放掉。`;
  }
  if (evidenceMode === "night-info") {
    return `前提审计：这条读法依赖 ${focusLabel} 的夜里信息能和死亡、保护或身份时间线同向；醉毒或污染时要降权。`;
  }
  if (evidenceMode === "vote-shape") {
    return `前提审计：这条读法依赖 ${focusLabel} 的票型不是单纯自保或跟票；如果能解释动机，票型压力要降。`;
  }
  if (evidenceMode === "claim-chain") {
    return `前提审计：这条读法依赖 ${focusLabel} 的身份口径应该前后可复核；如果有人公开背书，身份压力先降权。`;
  }
  if (evidenceMode === "evidence-count" || reasonKey === "more-visible-evidence") {
    return `前提审计：这条读法依赖 ${focusLabel} 的多条证据彼此独立；如果只是同源回声，不能按多证据加压。`;
  }
  if (evidenceMode === "public-speech") {
    return `前提审计：这条读法依赖 ${focusLabel} 的发言回避了可验证信息；如果下一轮补出身份或票型，读法要改。`;
  }
  if (confidenceBand === "clear") {
    return `前提审计：强压 ${focusLabel} 的前提是公开断点连续存在；只要断点被补齐，就不能继续用强压假设。`;
  }
  return `前提审计：这条读法依赖 ${focusLabel} 的公开解释还没接上；如果身份、票型或发言能自洽，就先改判。`;
}

function buildDecisionMechanicSensitivityLine({
  focusName = "",
  runnerUpName = "",
  reasonKey = "",
  evidenceMode = "",
  confidenceBand = "",
  riskFlags = [],
  hasRunnerUp = false,
  publicOnly = false,
} = {}) {
  const focusLabel = focusName || "这个位置";
  const runnerLabel = runnerUpName || "第二候选";
  const flags = new Set(riskFlags ?? []);
  if (publicOnly || flags.has("public-only")) {
    return `机制敏感性：这里只按 ${focusLabel} 的公开身份、票型和发言机制判断，不把私下视角或隐藏信息当规则结论。`;
  }
  if (evidenceMode === "private-rumor") {
    return `机制敏感性：私下线索必须转成 ${focusLabel} 的公开身份、票型或发言机制冲突；否则只算信息入口。`;
  }
  if (flags.has("low-evidence") || evidenceMode === "low-evidence") {
    return `机制敏感性：${focusLabel} 证据薄时先查公开机制链，不用通用听感替代身份、票型或能力信息。`;
  }
  if ((reasonKey === "close-call" || flags.has("close-score-gap")) && hasRunnerUp) {
    return `机制敏感性：${focusLabel} 和 ${runnerLabel} 贴线时，优先看谁的身份机制、票型窗口或死亡保护链先断开。`;
  }
  if (flags.has("runner-up-evidence-lead") && hasRunnerUp) {
    return `机制敏感性：${runnerLabel} 证据不弱，${focusLabel} 只有在公开机制链更断时才该继续主压。`;
  }
  if (evidenceMode === "night-info") {
    return `机制敏感性：${focusLabel} 的夜里信息要先排醉毒、死亡、保护和身份登记影响，再决定能不能当压力。`;
  }
  if (evidenceMode === "vote-shape") {
    return `机制敏感性：${focusLabel} 的票型要放进提名、处决门槛和自保机制里看，不能只按跟票定性。`;
  }
  if (evidenceMode === "claim-chain") {
    return `机制敏感性：${focusLabel} 的身份口径要考虑登记、伪装、死亡触发和公开背书，先核机制再压身份。`;
  }
  if (evidenceMode === "evidence-count" || reasonKey === "more-visible-evidence") {
    return `机制敏感性：${focusLabel} 的多条证据要先分机制来源，夜里信息、票型和身份口径不能当同一种证据累加。`;
  }
  if (evidenceMode === "public-speech") {
    return `机制敏感性：${focusLabel} 的发言压力必须落回身份、票型或能力信息机制，不能只靠节奏感升级。`;
  }
  if (confidenceBand === "clear") {
    return `机制敏感性：即使 ${focusLabel} 是强压位，也要先确认没有醉毒、登记或保护死亡链能解释断点。`;
  }
  return `机制敏感性：${focusLabel} 这条先回到身份、票型、夜里信息和死亡保护链复核，再决定是否升级。`;
}

function buildDecisionRoleHypothesisLine({
  focusName = "",
  runnerUpName = "",
  reasonKey = "",
  evidenceMode = "",
  confidenceBand = "",
  riskFlags = [],
  hasRunnerUp = false,
  publicOnly = false,
} = {}) {
  const focusLabel = focusName || "这个位置";
  const runnerLabel = runnerUpName || "第二候选";
  const flags = new Set(riskFlags ?? []);
  if (publicOnly || flags.has("public-only")) {
    return `角色假说：公开只能把 ${focusLabel} 拆成好身份自洽线和坏身份伪装线，先看身份、票型和发言能否对上。`;
  }
  if (evidenceMode === "private-rumor") {
    return `角色假说：私下入口只提示 ${focusLabel} 可能有伪装或传话误差；要等公开身份线断开才偏坏身份。`;
  }
  if (flags.has("low-evidence") || evidenceMode === "low-evidence") {
    return `角色假说：${focusLabel} 现在更像待验身份位；好人世界要补能力或票型，坏人世界才看伪装和躲压。`;
  }
  if ((reasonKey === "close-call" || flags.has("close-score-gap")) && hasRunnerUp) {
    return `角色假说：${focusLabel} 和 ${runnerLabel} 贴线时，先比较谁的好身份解释更完整，坏身份伪装线更露断点。`;
  }
  if (flags.has("runner-up-evidence-lead") && hasRunnerUp) {
    return `角色假说：${runnerLabel} 仍有坏身份分支，${focusLabel} 只有在好身份解释更弱时才该继续主压。`;
  }
  if (evidenceMode === "night-info") {
    return `角色假说：${focusLabel} 若是好身份，夜里信息要能接角色能力和时间线；接不上才更像坏身份伪装。`;
  }
  if (evidenceMode === "vote-shape") {
    return `角色假说：${focusLabel} 的票型先拆自保好人、跟风好人和坏身份带票；说不清动机才偏坏。`;
  }
  if (evidenceMode === "claim-chain") {
    return `角色假说：${focusLabel} 的好身份线要前后口径和能力信息自洽；坏身份线更像临场伪装或补口径。`;
  }
  if (evidenceMode === "evidence-count" || reasonKey === "more-visible-evidence") {
    return `角色假说：${focusLabel} 多证据不等于锁坏；先看好身份能否逐条解释，再看坏身份伪装是否同时覆盖多处断点。`;
  }
  if (evidenceMode === "public-speech") {
    return `角色假说：${focusLabel} 的发言如果能回到身份和能力链就留好身份分支，只转移压力才偏坏身份。`;
  }
  if (confidenceBand === "clear") {
    return `角色假说：${focusLabel} 是强压位，但仍要保留可自证好身份分支；公开断点持续存在才转坏身份主线。`;
  }
  return `角色假说：${focusLabel} 先并排保留好身份解释和坏身份伪装解释，等身份、票型或发言断点拉开。`;
}

function classifyDecisionEvidenceMode(summaries = []) {
  const text = summaries.map((entry) => `${entry ?? ""}`).join(" ");
  if (!text.trim()) {
    return "low-evidence";
  }
  if (/私聊|私下|密聊|耳语|private|whisper/i.test(text)) {
    return "private-rumor";
  }
  if (/夜|昨晚|夜里|夜间|死亡|死者|保护|中毒|醉|洗衣妇|图书管理员|调查|能力信息/.test(text)) {
    return "night-info";
  }
  if (/票|投票|票型|提名|处决|上票|跟票|抬票/.test(text)) {
    return "vote-shape";
  }
  if (/身份|口径|报过身份|角色|公开身份|claim|跳/i.test(text)) {
    return "claim-chain";
  }
  if (/个人证据|证据\s*\d|污染/.test(text)) {
    return "evidence-count";
  }
  if (/公聊|发言|公开|回应|节奏|站边|质疑|重点|态度/.test(text)) {
    return "public-speech";
  }
  return "mixed-evidence";
}

function buildDecisionEvidenceModeLine({ focusName = "", evidenceMode = "" } = {}) {
  const focusLabel = focusName || "这个位置";
  if (evidenceMode === "private-rumor") {
    return `主依据含私聊线索，公开时我只会转成 ${focusLabel} 的可复核问题。`;
  }
  if (evidenceMode === "night-info") {
    return `主依据偏夜里信息链，先核 ${focusLabel} 的身份口径和昨晚信息能不能接上。`;
  }
  if (evidenceMode === "vote-shape") {
    return `主依据偏票型和提名位置，先看 ${focusLabel} 的投票理由能不能自洽。`;
  }
  if (evidenceMode === "claim-chain") {
    return `主依据偏身份口径链，先核 ${focusLabel} 前后身份说法能不能接上。`;
  }
  if (evidenceMode === "evidence-count") {
    return `主依据是多条个人证据的累积，${focusLabel} 需要逐条回应而不是只给态度。`;
  }
  if (evidenceMode === "public-speech") {
    return `主依据偏公开发言节奏，先听 ${focusLabel} 是否能把公开线索讲完整。`;
  }
  if (evidenceMode === "low-evidence") {
    return `${focusLabel} 这条主要还是发言节奏和场上位置，不是硬信息。`;
  }
  return `主依据是混合线索，${focusLabel} 先把身份、票型和发言链串起来。`;
}

function buildDecisionRationale(stateOrView, aiPlayer, focus, second, options = {}) {
  if (!focus?.player) {
    return null;
  }
  const sourceState = stateOrView?.state ?? stateOrView;
  const publicOnly = !!options.publicOnly;
  const hasRunnerUp = !!second?.player && focus.player.id !== second.player.id;
  const focusScore = Number.isFinite(focus.score) ? focus.score : aiPlayer?.suspicion?.[focus.player.id] ?? 0.5;
  const runnerUpScore = hasRunnerUp
    ? Number.isFinite(second.score) ? second.score : aiPlayer?.suspicion?.[second.player.id] ?? 0.5
    : null;
  const scoreGap = hasRunnerUp ? focusScore - runnerUpScore : 0;
  const focusEvidenceCount = evidenceCountForReasoning(stateOrView, aiPlayer, focus.player.id, options);
  const runnerUpEvidenceCount = hasRunnerUp
    ? evidenceCountForReasoning(stateOrView, aiPlayer, second.player.id, options)
    : 0;
  const absGap = Math.abs(scoreGap);
  const riskFlags = [];

  if (!hasRunnerUp) {
    riskFlags.push("no-runner-up");
  }
  if (hasRunnerUp && runnerUpEvidenceCount > focusEvidenceCount) {
    riskFlags.push("runner-up-evidence-lead");
  }
  if (hasRunnerUp && absGap < 0.06) {
    riskFlags.push("close-score-gap");
  }
  if (focusEvidenceCount + runnerUpEvidenceCount === 0) {
    riskFlags.push("low-evidence");
  }
  if (publicOnly) {
    riskFlags.push("public-only");
  }

  const reasonKey = options.numericMode
    ? "numeric-score"
    : !hasRunnerUp
    ? "only-eligible-target"
    : focusEvidenceCount > runnerUpEvidenceCount
    ? "more-visible-evidence"
    : runnerUpEvidenceCount > focusEvidenceCount && scoreGap >= 0.08
    ? "higher-pressure"
    : absGap < 0.06
    ? "close-call"
    : "score-order";
  const confidenceBand =
    scoreGap >= 0.16 || focusScore >= 0.74
      ? "clear"
      : scoreGap >= 0.06 || focusScore >= 0.58
      ? "lean"
      : "close";
  const focusName = statementTargetLabel(sourceState, focus.player.id);
  const runnerUpName = hasRunnerUp ? statementTargetLabel(sourceState, second.player.id) : "";
  const focusEvidenceSummaries = collectEvidence(stateOrView, aiPlayer, focus.player, { publicOnly });
  const evidenceMode = classifyDecisionEvidenceMode(focusEvidenceSummaries);
  const evidenceModeLine = buildDecisionEvidenceModeLine({ focusName, evidenceMode });
  const roundScore = (value) => (Number.isFinite(value) ? Math.round(value * 1000) / 1000 : 0);
  const line = hasRunnerUp
    ? buildReasoningContrastLine(stateOrView, aiPlayer, focus, second, {
        ...options,
        evidenceMode,
        evidenceSummaryKey: focusEvidenceSummaries.join("|"),
      })
    : `${focusName} 是当前最可处理的位置，先让他把公开信息讲清楚。`;
  const reconsiderationLine = buildDecisionReconsiderationLine({
    focusName,
    runnerUpName,
    reasonKey,
    publicOnly,
  });
  const confidenceLine = buildDecisionConfidenceLine({
    focusName,
    runnerUpName,
    confidenceBand,
    reasonKey,
  });
  const verificationLine = buildDecisionVerificationLine({
    focusName,
    runnerUpName,
    reasonKey,
    publicOnly,
    evidenceMode,
  });
  const evidenceBoundaryLine = buildDecisionEvidenceBoundaryLine({
    focusName,
    runnerUpName,
    riskFlags,
    publicOnly,
  });
  const runnerUpWatchLine = buildDecisionRunnerUpWatchLine({
    focusName,
    runnerUpName,
    reasonKey,
    hasRunnerUp,
  });
  const responsePlanLine = buildDecisionResponsePlanLine({
    focusName,
    runnerUpName,
    reasonKey,
    confidenceBand,
    hasRunnerUp,
  });
  const responseCriteriaLine = buildDecisionResponseCriteriaLine({
    focusName,
    runnerUpName,
    reasonKey,
    evidenceMode,
    hasRunnerUp,
  });
  const evidenceInteractionLine = buildDecisionEvidenceInteractionLine({
    focusName,
    runnerUpName,
    reasonKey,
    evidenceMode,
    riskFlags,
    hasRunnerUp,
  });
  const pressureStageLine = buildDecisionPressureStageLine({
    focusName,
    runnerUpName,
    reasonKey,
    confidenceBand,
    focusScore,
    focusEvidenceCount,
    riskFlags,
    hasRunnerUp,
  });
  const counterEvidenceLine = buildDecisionCounterEvidenceLine({
    focusName,
    runnerUpName,
    reasonKey,
    evidenceMode,
    riskFlags,
  });
  const tableRiskLine = buildDecisionTableRiskLine({
    focusName,
    runnerUpName,
    reasonKey,
    evidenceMode,
    confidenceBand,
    focusScore,
    riskFlags,
    hasRunnerUp,
    publicOnly,
  });
  const informationGainLine = buildDecisionInformationGainLine({
    focusName,
    runnerUpName,
    reasonKey,
    evidenceMode,
    confidenceBand,
    riskFlags,
    hasRunnerUp,
    publicOnly,
  });
  const tableReactionLine = buildDecisionTableReactionLine({
    focusName,
    runnerUpName,
    reasonKey,
    evidenceMode,
    confidenceBand,
    riskFlags,
    hasRunnerUp,
    publicOnly,
  });
  const timingWindowLine = buildDecisionTimingWindowLine({
    focusName,
    runnerUpName,
    reasonKey,
    confidenceBand,
    focusScore,
    day: sourceState?.day ?? 0,
    dayStage: sourceState?.dayStage ?? "",
    publicRounds: sourceState?.dayStageMeta?.publicRounds ?? 0,
    debateBeat: options.debateBeat ?? "",
    audience: options.audience ?? (publicOnly ? "public" : "private"),
    nominationClock: sourceState?.dayStageMeta?.nominationClock ?? null,
    hasRunnerUp,
    riskFlags,
  });
  const worldBranchLine = buildDecisionWorldBranchLine({
    focusName,
    runnerUpName,
    reasonKey,
    evidenceMode,
    riskFlags,
    hasRunnerUp,
    publicOnly,
  });
  const voteCoalitionLine = buildDecisionVoteCoalitionLine({
    focusName,
    runnerUpName,
    reasonKey,
    evidenceMode,
    confidenceBand,
    focusScore,
    riskFlags,
    hasRunnerUp,
    dayStage: sourceState?.dayStage ?? "",
    debateBeat: options.debateBeat ?? "",
    audience: options.audience ?? (publicOnly ? "public" : "private"),
    publicOnly,
  });
  const sourceReliabilityLine = buildDecisionSourceReliabilityLine({
    focusName,
    runnerUpName,
    reasonKey,
    evidenceMode,
    focusEvidenceCount,
    riskFlags,
    hasRunnerUp,
    publicOnly,
  });
  const timelineConsistencyLine = buildDecisionTimelineConsistencyLine({
    focusName,
    runnerUpName,
    reasonKey,
    evidenceMode,
    riskFlags,
    hasRunnerUp,
    day: sourceState?.day ?? 0,
    dayStage: sourceState?.dayStage ?? "",
    publicRounds: sourceState?.dayStageMeta?.publicRounds ?? 0,
    debateBeat: options.debateBeat ?? "",
    audience: options.audience ?? (publicOnly ? "public" : "private"),
    publicOnly,
  });
  const incentiveAlignmentLine = buildDecisionIncentiveAlignmentLine({
    focusName,
    runnerUpName,
    reasonKey,
    evidenceMode,
    confidenceBand,
    riskFlags,
    hasRunnerUp,
    publicOnly,
  });
  const burdenOfProofLine = buildDecisionBurdenOfProofLine({
    focusName,
    runnerUpName,
    reasonKey,
    evidenceMode,
    confidenceBand,
    riskFlags,
    hasRunnerUp,
    audience: options.audience ?? (publicOnly ? "public" : "private"),
    publicOnly,
  });
  const questionPriorityLine = buildDecisionQuestionPriorityLine({
    focusName,
    runnerUpName,
    reasonKey,
    evidenceMode,
    confidenceBand,
    riskFlags,
    hasRunnerUp,
    audience: options.audience ?? (publicOnly ? "public" : "private"),
    publicOnly,
  });
  const actionThresholdLine = buildDecisionActionThresholdLine({
    focusName,
    runnerUpName,
    reasonKey,
    evidenceMode,
    confidenceBand,
    focusScore,
    riskFlags,
    hasRunnerUp,
    dayStage: sourceState?.dayStage ?? "",
    audience: options.audience ?? (publicOnly ? "public" : "private"),
    publicOnly,
  });
  const targetSwitchContinuity = buildCrossDayTargetSwitchContinuity(sourceState, aiPlayer, focus.player.id, {
    publicOnly,
    stanceMemory: options.stanceMemory ?? null,
  });
  const targetSwitchLine = buildDecisionTargetSwitchLine(sourceState, targetSwitchContinuity);
  const memoryContinuityLine = buildDecisionMemoryContinuityLine({
    state: sourceState,
    focusName,
    evidenceMode,
    reasonKey,
    focusEvidenceCount,
    stanceMemory: options.stanceMemory ?? null,
    targetSwitchContinuity,
  });
  const expressionDisciplineLine = buildDecisionExpressionDisciplineLine({
    focusName,
    runnerUpName,
    reasonKey,
    evidenceMode,
    confidenceBand,
    riskFlags,
    hasRunnerUp,
    publicOnly,
  });
  const uncertaintyResolutionLine = buildDecisionUncertaintyResolutionLine({
    focusName,
    runnerUpName,
    reasonKey,
    evidenceMode,
    confidenceBand,
    riskFlags,
    hasRunnerUp,
    publicOnly,
  });
  const evidenceFreshnessLine = buildDecisionEvidenceFreshnessLine({
    focusName,
    reasonKey,
    evidenceMode,
    confidenceBand,
    focusEvidenceCount,
    riskFlags,
    stanceMemory: options.stanceMemory ?? null,
    publicOnly,
  });
  const falsificationCheckLine = buildDecisionFalsificationCheckLine({
    focusName,
    runnerUpName,
    reasonKey,
    evidenceMode,
    confidenceBand,
    riskFlags,
    hasRunnerUp,
    publicOnly,
  });
  const causalChainLine = buildDecisionCausalChainLine({
    focusName,
    runnerUpName,
    reasonKey,
    evidenceMode,
    confidenceBand,
    riskFlags,
    hasRunnerUp,
    publicOnly,
  });
  const assumptionAuditLine = buildDecisionAssumptionAuditLine({
    focusName,
    runnerUpName,
    reasonKey,
    evidenceMode,
    confidenceBand,
    riskFlags,
    hasRunnerUp,
    publicOnly,
  });
  const mechanicSensitivityLine = buildDecisionMechanicSensitivityLine({
    focusName,
    runnerUpName,
    reasonKey,
    evidenceMode,
    confidenceBand,
    riskFlags,
    hasRunnerUp,
    publicOnly,
  });
  const roleHypothesisLine = buildDecisionRoleHypothesisLine({
    focusName,
    runnerUpName,
    reasonKey,
    evidenceMode,
    confidenceBand,
    riskFlags,
    hasRunnerUp,
    publicOnly,
  });
  const comparisonTrace = buildDecisionComparisonTrace(
    stateOrView,
    aiPlayer,
    focus,
    second,
    {
      focusScore,
      runnerUpScore,
      focusEvidenceCount,
      runnerUpEvidenceCount,
      scoreGap,
      reasonKey,
      confidenceBand,
      focusName,
      runnerUpName,
    },
    options
  );

  return {
    kind: "decision-rationale",
    audience: options.audience ?? (publicOnly ? "public" : "private"),
    publicOnly,
    focusId: focus.player.id,
    focusName,
    focusScore: roundScore(focusScore),
    focusEvidenceCount,
    runnerUpId: hasRunnerUp ? second.player.id : "",
    runnerUpName,
    runnerUpScore: hasRunnerUp ? roundScore(runnerUpScore) : null,
    runnerUpEvidenceCount,
    scoreGap: roundScore(scoreGap),
    reasonKey,
    confidenceBand,
    riskFlags,
    evidenceMode,
    evidenceModeLine,
    verificationQuestion: publicOnly
      ? `Ask ${focusName} to restate their role claim and public evidence chain.`
      : `Ask ${focusName} to explain role, night info, and why their public line fits.`,
    verificationLine,
    responsePlanLine,
    responseCriteriaLine,
    evidenceInteractionLine,
    pressureStageLine,
    counterEvidenceLine,
    tableRiskLine,
    informationGainLine,
    tableReactionLine,
    timingWindowLine,
    worldBranchLine,
    voteCoalitionLine,
    sourceReliabilityLine,
    timelineConsistencyLine,
    incentiveAlignmentLine,
    burdenOfProofLine,
    questionPriorityLine,
    actionThresholdLine,
    targetSwitchContinuity,
    targetSwitchLine,
    memoryContinuityLine,
    expressionDisciplineLine,
    uncertaintyResolutionLine,
    evidenceFreshnessLine,
    falsificationCheckLine,
    causalChainLine,
    assumptionAuditLine,
    mechanicSensitivityLine,
    roleHypothesisLine,
    evidenceBoundaryLine,
    runnerUpWatchLine,
    confidenceLine,
    reconsiderationKey: reasonKey,
    reconsiderationLine,
    comparisonTrace,
    line,
  };
}

function rationaleSentences(text) {
  const value = `${text ?? ""}`.replace(/\s+/g, " ").trim();
  if (!value) {
    return [];
  }
  const sentences = value.match(/[^。！？；]+[。！？；]?/gu)?.map((entry) => entry.trim()).filter(Boolean) ?? [];
  return sentences.length > 0 ? sentences : [value];
}

function compactRationaleText(text) {
  return `${text ?? ""}`
    .replaceAll("…", "...")
    .replace(/[，。！？；：、,.!?;:\s]/gu, "")
    .trim();
}

function selectDecisionRationaleSpokenLine(decisionRationale, spokenText) {
  const sentences = rationaleSentences(spokenText);
  if (sentences.length === 0) {
    return "";
  }
  const preferredLines = [decisionRationale?.spokenLine, decisionRationale?.line]
    .map((entry) => `${entry ?? ""}`.trim())
    .filter(Boolean);
  for (const preferred of preferredLines) {
    const compactPreferred = compactRationaleText(preferred);
    const match = sentences.find((sentence) => {
      const compactSentence = compactRationaleText(sentence);
      return compactSentence.includes(compactPreferred) || compactPreferred.includes(compactSentence);
    });
    if (match) {
      return match;
    }
  }

  const focusName = compactRationaleText(decisionRationale?.focusName);
  const runnerUpName = compactRationaleText(decisionRationale?.runnerUpName);
  if (focusName && runnerUpName) {
    const comparison = sentences.find((sentence) => {
      const compactSentence = compactRationaleText(sentence);
      return compactSentence.includes(focusName) && compactSentence.includes(runnerUpName);
    });
    if (comparison) {
      return comparison;
    }
  }
  if (focusName) {
    const focused = sentences.find((sentence) => compactRationaleText(sentence).includes(focusName));
    if (focused) {
      return focused;
    }
  }
  return sentences[0];
}

function attachDecisionRationaleSpokenLine(decisionRationale, spokenText) {
  if (!decisionRationale) {
    return null;
  }
  return {
    ...decisionRationale,
    spokenLine:
      selectDecisionRationaleSpokenLine(decisionRationale, spokenText) ||
      decisionRationale.spokenLine ||
      decisionRationale.line ||
      "",
  };
}

function buildReasoningContrastLine(stateOrView, aiPlayer, focus, second, options = {}) {
  if (!focus?.player || !second?.player || focus.player.id === second.player.id) {
    return "";
  }
  const focusName = statementTargetLabel(stateOrView?.state ?? stateOrView, focus.player.id);
  const secondName = statementTargetLabel(stateOrView?.state ?? stateOrView, second.player.id);
  const focusScore = Number.isFinite(focus.score) ? focus.score : aiPlayer?.suspicion?.[focus.player.id] ?? 0.5;
  const secondScore = Number.isFinite(second.score) ? second.score : aiPlayer?.suspicion?.[second.player.id] ?? 0.5;
  const scoreGap = focusScore - secondScore;
  const focusEvidence = evidenceCountForReasoning(stateOrView, aiPlayer, focus.player.id, options);
  const secondEvidence = evidenceCountForReasoning(stateOrView, aiPlayer, second.player.id, options);
  const publicOnly = !!options.publicOnly;
  const contrastSalt = [
    focusName,
    secondName,
    focusEvidence,
    secondEvidence,
    Math.round(scoreGap * 100),
    options.evidenceMode ?? "",
    `${options.evidenceSummaryKey ?? ""}`.slice(0, 120),
    publicOnly ? "public" : "private",
  ].join(":");
  const chooseContrastVariant = (variants) =>
    variants[privateReasonVariantIndex(contrastSalt, variants.length)] ?? variants[0];

  if (options.numericMode) {
    return `${focusName} 先级更高，大概 ${Math.round(focusScore * 100)}% 对 ${Math.round(secondScore * 100)}%；${secondName} 暂时排第二。`;
  }
  if (focusEvidence > secondEvidence) {
    const scope = publicOnly ? "公开" : "我可见的";
    return chooseContrastVariant([
      `我先排 ${focusName}，不是放过 ${secondName}：${focusName} 这边${scope}线索更多。`,
      `${secondName} 不是放掉，只是 ${focusName} 这边${scope}证据更成组，先排前面。`,
      `${focusName} 先放主线，${secondName} 留在第二层：现在${scope}线索更多压在 ${focusName}。`,
      `先处理 ${focusName}，不是清掉 ${secondName}；${focusName} 这边${scope}证据更集中。`,
    ]);
  }
  if (secondEvidence > focusEvidence && scoreGap >= 0.08) {
    return chooseContrastVariant([
      `和 ${secondName} 比，${focusName} 现在压力更集中；${secondName} 有线索但先排第二。`,
      `${secondName} 线索不少，但 ${focusName} 的压力更贴当前桌面，先放前面。`,
      `我不是忽略 ${secondName}，只是 ${focusName} 的分数已经拉开，先验 ${focusName}。`,
    ]);
  }
  if (Math.abs(scoreGap) < 0.06) {
    return chooseContrastVariant([
      `${focusName} 和 ${secondName} 差距不大，我先处理更容易被追问验证的 ${focusName}。`,
      `${focusName} 和 ${secondName} 贴得很近，先问 ${focusName} 是因为这条更快能被回应验证。`,
      `${secondName} 还在视野里，但 ${focusName} 这条更适合先拿来校验。`,
    ]);
  }
  return chooseContrastVariant([
    `和 ${secondName} 比，我先把 ${focusName} 放前面；${secondName} 暂时排第二。`,
    `${focusName} 先排前面，${secondName} 不出视野，等 ${focusName} 回应后再重排。`,
    `我先看 ${focusName}，${secondName} 先记在后手位；这轮先验证更靠前的压力点。`,
  ]);
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
      add("前面发言没讲清楚");
    } else if (/个人证据/.test(text)) {
      add("手里有线索");
    } else {
      add(shortReasonText(text, 12));
    }
  });
  if (compact.length === 0) {
    return shortReasonText(options.fallback ?? "低证据，先问反应", 18);
  }
  const selected = compact.slice(0, 2);
  const joined = selected.join("、");
  const synthesis = evidenceFamilySynthesis(selected);
  return selected.length >= 2
    ? `两条线索合在一起：${synthesis ? `${synthesis}，` : ""}${joined}`
    : joined;
}

function evidenceFamilySynthesis(labels = []) {
  const hasIdentityMismatch = labels.includes("身份对不上") || labels.includes("身份撞车");
  const hasLowEvidencePush = labels.includes("在推低证据位");
  const hasVoteConflict = labels.includes("票型反着走");
  const hasNightInfo = labels.includes("夜信牵到这里") || labels.includes("夜信可能脏");
  const hasProtectedPressure = labels.includes("在保高压位");
  const hasUnstableSource = labels.includes("来源不稳");
  if (hasLowEvidencePush && hasIdentityMismatch) {
    return "低证据推人和身份口径对不上卡在一起";
  }
  if (hasVoteConflict && hasIdentityMismatch) {
    return "票型和身份口径同时咬住";
  }
  if (hasNightInfo && hasIdentityMismatch) {
    return "夜信链和身份口径需要互相对上";
  }
  if (hasProtectedPressure && hasVoteConflict) {
    return "保高压位和票型反向互相顶住";
  }
  if (hasUnstableSource && hasIdentityMismatch) {
    return "来源链和身份口径卡在一起";
  }
  return "";
}

function privateEvidenceSynthesisVerificationLine(focusName = "", evidenceContract = null) {
  const focusLabel = focusName || "这个位置";
  const text = [
    evidenceContract?.spokenText,
    evidenceContract?.text,
    ...(evidenceContract?.summaries ?? []),
    ...(evidenceContract?.graphChains ?? []).map((chain) => chain?.text),
  ]
    .map((entry) => `${entry ?? ""}`)
    .join(" ");
  const hasIdentityMismatch = /身份.*对不上|声称.*验证|公开验证|后续公开验证成|撞身份|撞了/.test(text);
  const hasLowEvidencePush = /推低证据|低证据位|低证据目标/.test(text);
  const hasVoteConflict = /投票.*相反|票型.*反|反票|票型压力相反/.test(text);
  const hasNightInfo = /夜间信息|夜信|夜里.*信息/.test(text);
  const hasProtectedPressure = /维护.*高压|保高压|高压目标|高压位|帮.*卸压/.test(text);
  const hasUnstableSource = /来源不稳|可信度.*偏低|可信度.*下降|来源.*复核|信息来源.*复核/.test(text);
  if (hasUnstableSource && hasIdentityMismatch) {
    return `验证点是先问 ${focusLabel} 哪条来源能被别人复核，再把身份口径和公开验证对齐。`;
  }
  if (hasProtectedPressure && hasVoteConflict) {
    return `验证点是先问 ${focusLabel} 为什么维护高压位，再解释反票理由和票型压力。`;
  }
  if (hasNightInfo && hasIdentityMismatch) {
    return `验证点是先问 ${focusLabel} 夜信来源能不能复核，再把身份口径和公开验证对上。`;
  }
  if (hasVoteConflict && hasIdentityMismatch) {
    return `验证点是先问 ${focusLabel} 身份口径哪里断开，再说明投票为什么和压力相反。`;
  }
  if (hasLowEvidencePush && hasIdentityMismatch) {
    return `验证点是先问 ${focusLabel} 为什么推低证据位，再把身份口径和公开验证对上。`;
  }
  return "";
}

function mergePrivateEvidenceVerificationLine(synthesisLine = "", fallbackLine = "") {
  const specific = `${synthesisLine ?? ""}`.trim();
  if (!specific) {
    return `${fallbackLine ?? ""}`.trim();
  }
  const modeTail = `${fallbackLine ?? ""}`.match(/重点[^。！？]+[。！？]?/u)?.[0]?.trim() ?? "";
  if (!modeTail || specific.includes(modeTail.replace(/[。！？]$/u, ""))) {
    return specific;
  }
  return `${specific.replace(/[。！？]+$/u, "")}。 ${modeTail}`;
}

function ensurePrivateSynthesisVerificationInText(text, decisionRationale = null, evidenceContract = null) {
  const value = `${text ?? ""}`.trim();
  const line = polishConversationalText(surfacePrivateVerificationSentence(
    privateEvidenceSynthesisVerificationLine(decisionRationale?.focusName ?? "", evidenceContract)
  ));
  if (!value || !line) {
    return value;
  }
  const compact = (entry) => `${entry ?? ""}`.replace(/[，。！？；：、,.!?;:\s]/gu, "");
  if (compact(value).includes(compact(line))) {
    return value;
  }
  return joinSpeechFragments([value, line]).replace(/([。！？；])\s+(?=\S)/gu, "$1");
}

function naturalizedPrivateDeepRationaleLine(line = "") {
  return surfaceRationaleSentence(line)
    .replace(/(\d+号)\s+和\s+(\d+号)/gu, "$1和$2")
    .replace(/(\d+号和\d+号)\s+/gu, "$1")
    .replace(/(\d+号)\s+的/gu, "$1的");
}

function polishChineseSeatSpacing(text = "") {
  const value = `${text ?? ""}`
    .replace(/([0-9]+)\s+号/gu, "$1号")
    .replace(/(刚才|如果|昨天|今天|明天|前面)\s+([0-9]+号)/gu, "$1$2")
    .replace(/([与和及])\s+([0-9]+号)/gu, "$1$2")
    .replace(/(是|还是|为|按|报|跳|主线在|转到|转向|恶魔位|恶魔)\s+([0-9]+号)/gu, "$1$2")
    .replace(/(点过|给|放下|放回|放低|丢给|交给)\s+([0-9]+号)/gu, "$1$2")
    .replace(/(是|还是|为|按|报|跳)\s+([\u4e00-\u9fff]{1,12})(?=[，。；！？：、\s]|$)/gu, "$1$2")
    .replace(/(爪牙同伴|其他爪牙)\s+(暂无)/gu, "$1$2")
    .replace(/理由还是\s*可见记录：/gu, "理由还是这条可见记录：")
    .replace(/卡在\s+在/gu, "卡在")
    .replace(/卡在\s+(?=前面|推低|身份|公开|两条|[0-9]+号)/gu, "卡在")
    .replace(/换线\s+台面理由/gu, "换线。台面理由")
    .replace(/((?:我|你|大家|今天|这轮|票前)?(?:会|先|暂时|直接|继续|不)?(?:让|问|看|盯|对|排|压|转到|转|沿着|把|放过|放掉|清掉|处理|验|提|举|投|跟|出|在))\s+([0-9]+号)/gu, "$1$2")
    .replace(/([0-9]+号)\s+(?=[\u4e00-\u9fff])/gu, "$1")
    .replace(/\s+([，。；！？：、])/gu, "$1")
    .replace(/([。！？；])\s+(?=\S)/gu, "$1")
    .replace(/\s+/g, " ")
    .trim();
  return sanitizePlayerVisibleText(value);
}

function privateReasonVariantIndex(seedLabel = "", variantCount = 1) {
  const seatNumber = Number.parseInt(`${seedLabel}`.replace(/\D/gu, ""), 10);
  if (!Number.isFinite(seatNumber) || variantCount <= 1) {
    return 0;
  }
  return Math.abs(seatNumber - 1) % variantCount;
}

function privateReasonTextVariantIndex(seedLabel = "", variantCount = 1) {
  if (variantCount <= 1) {
    return 0;
  }
  const text = `${seedLabel ?? ""}`;
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) % 9973;
  }
  return Math.abs(hash) % variantCount;
}

function privateSourceTimelineCompressionLine(targetLabel = "", mode = "pair") {
  const label = targetLabel || "这条线";
  const variants =
    mode === "vote"
      ? [
          `${label}的来源和节奏合起来：先看反票是不是独立动作，回应先后也要对，同源跟票降权。`,
          `${label}这票先拆来源：先看这票是不是独立动作，解释先后再对，同源跟票先降权。`,
          `${label}这边先看投票先后：解释和跟票来源拆开，同源票不当第二来源。`,
          `${label}先分票源和节奏：独立上票才加权，跟着补理由的票先降权。`,
          `${label}这票先看谁先动手：先有理由再上票更可信，事后跟票先拆开算。`,
        ]
      : [
          `${label}的来源和节奏合起来：独立来源优先，回应先后再看，同源回声降权。`,
          `${label}这条线先拆来源：先拆独立来源，回应顺序也要接上，同源回声先降权。`,
          `${label}这边先看回应先后：谁能自洽先降压，同源回声降权。`,
          `${label}先分来源再看节奏：能单独对上的先加权，互相复述的先压低。`,
          `${label}这条先按来源拆开：谁先给出独立信息，谁只是跟着补话，要分开算。`,
          `${label}先对来源独立性：回应能彼此托住才升权，只互相借力就降权。`,
        ];
  return variants[privateReasonTextVariantIndex(`${mode}:${label}`, variants.length)] ?? variants[0];
}

function privateIncentiveBurdenCompressionLine(targetLabel = "", mode = "pair") {
  const label = targetLabel || "这条线";
  const variants =
    mode === "vote"
        ? [
          `${label}的动机和理由合起来：这票先分自保、跟风或主动推人，本人和跟票者给理由。`,
          `${label}再看票的收益：先拆自保、跟风或主动推人，跟票者不能空跟。`,
          `${label}最后看谁该说明：看自保、跟风还是主动推人，本人和跟票者都说清理由。`,
          `${label}的票面动机要拆开：本人先解释收益，跟票的人也要交理由。`,
          `${label}再看举证负担：这票是谁受益、谁跟风，不能只把理由推给别人。`,
        ]
      : [
          `${label}的动机和理由合起来：谁解桌、谁护人或转移压力，支持者要给理由。`,
          `${label}再看收益和举证：先分解桌、护人和转移压力，支持者说不清就加压。`,
          `${label}最后看谁该说明：看谁在解桌或转移压力，支持者也要说清理由。`,
          `${label}的收益线要拆开：谁因为这轮压力变轻，谁就要补公开理由。`,
          `${label}再分动机和举证：护人、转压、解桌各自讲清，不能只靠站队。`,
          `${label}最后落到责任：本人要回主疑点，帮他说话的人也要给能对上的理由。`,
        ];
  const line = variants[privateReasonTextVariantIndex(`${mode}:${label}`, variants.length)] ?? variants[0];
  return line
    .replace(`${label}的动机和理由合起来：`, "动机和理由合起来：")
    .replace(`${label}的票面动机要拆开：`, "票面动机要拆开：")
    .replace(`${label}再看票的收益：`, "再看票的收益：")
    .replace(`${label}再看举证负担：`, "再看举证负担：")
    .replace(`${label}再看收益和举证：`, "再看收益和举证：")
    .replace(`${label}的收益线要拆开：`, "收益线要拆开：")
    .replace(`${label}再分动机和举证：`, "再分动机和举证：")
    .replace(`${label}最后看谁该说明：`, "最后看谁该说明：")
    .replace(`${label}最后落到责任：`, "最后落到责任：");
}

function privateReasonOpeningBridgeForSeat(seatLabel = "", salt = "") {
  const variants = [
    "我先不把话说死，先说排序。",
    "这条我先看，但不锁死。",
    "我先点这条，先别当铁证。",
    "我暂时不换目标，先放主线。",
    "先把排序说清，但不拍死。",
    "我先按主线排，不当铁证。",
    "先给你一个暂定排序。",
    "这条先当主线，不急着拍死。",
  ];
  const seed = salt ? `${seatLabel}:${salt}` : seatLabel;
  const index = salt ? privateReasonTextVariantIndex(seed, variants.length) : privateReasonVariantIndex(seed, variants.length);
  return variants[index];
}

function polishPrivateReasonOpeningRedundancy(text = "") {
  return `${text ?? ""}`.replace(
    /^我先看\s*(\d+号)。(?=[\s\S]{0,120}(?:我先排\s*\1|\1\s*是当前最可处理的位置|\1这边|\1\s*先放主线|先处理\s*\1|\1\s*先排前面))/u,
    (match, seatLabel) => privateReasonOpeningBridgeForSeat(seatLabel, `${text ?? ""}`.slice(match.length, 220))
  );
}

function ensurePrivateDeepReasoningInText(text, decisionRationale = null, intent = "") {
  const value = `${text ?? ""}`.trim();
  let sourceLine = naturalizedPrivateDeepRationaleLine(decisionRationale?.sourceReliabilityLine ?? "");
  let timelineLine = naturalizedPrivateDeepRationaleLine(decisionRationale?.timelineConsistencyLine ?? "");
  let incentiveLine = naturalizedPrivateDeepRationaleLine(decisionRationale?.incentiveAlignmentLine ?? "");
  let burdenLine = naturalizedPrivateDeepRationaleLine(decisionRationale?.burdenOfProofLine ?? "");
  const sourcePair = sourceLine.match(/^(\d+号和\d+号)贴线时/u)?.[1] ?? "";
  if (sourcePair && timelineLine.startsWith(`${sourcePair}贴线时`)) {
    timelineLine = timelineLine.replace(/^(\d+号和\d+号)贴线时，?先看/u, "再看");
  }
  if (sourcePair && timelineLine.startsWith("再看")) {
    sourceLine = privateSourceTimelineCompressionLine(sourcePair, "pair");
    timelineLine = "";
  }
  const voteSourceSeat = sourceLine.match(/^(\d+号)的票型证据要区分/u)?.[1] ?? "";
  const voteTimelineSeat = timelineLine.match(/^(\d+号)的投票要看/u)?.[1] ?? "";
  if (voteSourceSeat && voteSourceSeat === voteTimelineSeat) {
    sourceLine = privateSourceTimelineCompressionLine(voteSourceSeat, "vote");
    timelineLine = "";
  }
  const sourceSeat = sourceLine.match(/^(\d+号)/u)?.[1] ?? "";
  const timelineSeat = timelineLine.match(/^(\d+号)/u)?.[1] ?? "";
  if (sourceSeat && sourceSeat === timelineSeat) {
    sourceLine = privateSourceTimelineCompressionLine(sourceSeat);
    timelineLine = "";
  }
  if (sourcePair && incentiveLine.startsWith(`${sourcePair}贴线时`)) {
    incentiveLine = incentiveLine.replace(/^(\d+号和\d+号)贴线时，?/u, "动机上再分");
  }
  if (sourcePair && burdenLine.startsWith(`${sourcePair}贴线时`)) {
    burdenLine = burdenLine.replace(/^(\d+号和\d+号)贴线时，?/u, "举证上");
  }
  if (sourcePair && incentiveLine.startsWith("动机上再分") && burdenLine.startsWith("举证上")) {
    incentiveLine = privateIncentiveBurdenCompressionLine(sourcePair, "pair");
    burdenLine = "";
  }
  const voteIncentiveSeat = incentiveLine.match(/^(\d+号)的票型要拆成/u)?.[1] ?? "";
  const voteBurdenSeat = burdenLine.match(/^(\d+号)的投票理由要由本人讲清/u)?.[1] ?? "";
  if (voteIncentiveSeat && voteIncentiveSeat === voteBurdenSeat) {
    incentiveLine = privateIncentiveBurdenCompressionLine(voteIncentiveSeat, "vote");
    burdenLine = "";
  }
  const incentiveSeat = incentiveLine.match(/^(\d+号)/u)?.[1] ?? "";
  const burdenSeat = burdenLine.match(/^(\d+号)/u)?.[1] ?? "";
  if (incentiveSeat && incentiveSeat === burdenSeat) {
    incentiveLine = privateIncentiveBurdenCompressionLine(incentiveSeat);
    burdenLine = "";
  }
  const lines = [
    sourceLine,
    timelineLine,
    incentiveLine,
    burdenLine,
  ].filter(Boolean);
  if (!value || lines.length === 0 || intent !== QUESTION_INTENT.REASON) {
    return value;
  }
  const compact = (entry) => `${entry ?? ""}`.replace(/[，。！？；：、,.!?;:\s]/gu, "");
  const missingLines = lines.filter((line) => !compact(value).includes(compact(line)));
  if (missingLines.length === 0) {
    return polishChineseSeatSpacing(polishPrivateReasonOpeningRedundancy(value));
  }
  const missingLine = missingLines.join(" ");
  return polishChineseSeatSpacing(
    polishPrivateReasonOpeningRedundancy(
      joinSpeechFragments([value, missingLine]).replace(/([。！？；])\s+(?=\S)/gu, "$1")
    )
  );
}

function ensurePrivateSynthesisVerificationInComposedResponse(composed) {
  if (!composed?.response || !composed?.decisionRationale || !composed?.evidenceContract) {
    return composed;
  }
  const response = ensurePrivateSynthesisVerificationInText(
    composed.response,
    composed.decisionRationale,
    composed.evidenceContract
  );
  return response === composed.response ? composed : { ...composed, response };
}

function ensurePrivateDeepReasoningInComposedResponse(composed, intent = "") {
  if (!composed?.response || !composed?.decisionRationale) {
    return composed;
  }
  const response = ensurePrivateDeepReasoningInText(composed.response, composed.decisionRationale, intent);
  return response === composed.response ? composed : { ...composed, response };
}

function ensureEvidenceContractInText(text, evidenceContract, options = {}) {
  const value = `${text ?? ""}`.trim();
  if (!evidenceContract?.text) {
    return value;
  }
  const quoted = evidenceContract.summaries.length > 0 ? evidenceContract.summaries : [evidenceContract.text];
  const spoken = evidenceContract.spokenText ?? "";
  const compact = (entry) => `${entry ?? ""}`.replace(/\s+/g, "");
  const compactValue = compact(value);
  if (
    quoted.some((entry) => entry && (value.includes(entry) || compactValue.includes(compact(entry)))) ||
    (spoken && (value.includes(spoken) || compactValue.includes(compact(spoken))))
  ) {
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
      return `你问到 ${focusText}，我就先看 ${focusText}。`;
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
      return /因为|理由|主要|证据|对不上|提到|卡点|这条|站队|站边|发言|信息|公开/;
    case QUESTION_INTENT.TRUST:
      return /你在我这里|信任|相信|放下|风险|偏好|中间位|不信/;
    case QUESTION_INTENT.CLAIM:
      return /身份|我是|口径|范围|私下报|真实身份|台面上|不把身份/;
    case QUESTION_INTENT.VOTE:
      return /如果提|跟票|赞成|反对|回应补不上/;
    case QUESTION_INTENT.NIGHT:
      return /昨晚|昨夜|夜里|夜间|夜晚|信息|没有能.*信息|能安全说/;
    case QUESTION_INTENT.COMPARE:
      return /更|比|先追|放第二|两者里|相比|暂放一边|单看|明确问到/;
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
    evidenceContract?.spokenText || evidenceContract?.summaries?.[0] || evidenceContract?.text || context.evidenceText,
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
    reasoningLine: context.reasoningLine ?? "",
    verificationLine: context.verificationLine ?? "",
    evidenceModeLine: context.evidenceModeLine ?? "",
    responsePlanLine: context.responsePlanLine ?? "",
    responseCriteriaLine: context.responseCriteriaLine ?? "",
    evidenceInteractionLine: context.evidenceInteractionLine ?? "",
    pressureStageLine: context.pressureStageLine ?? "",
    counterEvidenceLine: context.counterEvidenceLine ?? "",
    tableRiskLine: context.tableRiskLine ?? "",
    informationGainLine: context.informationGainLine ?? "",
    tableReactionLine: context.tableReactionLine ?? "",
    timingWindowLine: context.timingWindowLine ?? "",
    worldBranchLine: context.worldBranchLine ?? "",
    voteCoalitionLine: context.voteCoalitionLine ?? "",
    sourceReliabilityLine: context.sourceReliabilityLine ?? "",
    timelineConsistencyLine: context.timelineConsistencyLine ?? "",
    incentiveAlignmentLine: context.incentiveAlignmentLine ?? "",
    burdenOfProofLine: context.burdenOfProofLine ?? "",
    questionPriorityLine: context.questionPriorityLine ?? "",
    actionThresholdLine: context.actionThresholdLine ?? "",
    memoryContinuityLine: context.memoryContinuityLine ?? "",
    expressionDisciplineLine: context.expressionDisciplineLine ?? "",
    uncertaintyResolutionLine: context.uncertaintyResolutionLine ?? "",
    evidenceFreshnessLine: context.evidenceFreshnessLine ?? "",
    falsificationCheckLine: context.falsificationCheckLine ?? "",
    causalChainLine: context.causalChainLine ?? "",
    assumptionAuditLine: context.assumptionAuditLine ?? "",
    mechanicSensitivityLine: context.mechanicSensitivityLine ?? "",
    roleHypothesisLine: context.roleHypothesisLine ?? "",
    evidenceBoundaryLine: context.evidenceBoundaryLine ?? "",
    runnerUpWatchLine: context.runnerUpWatchLine ?? "",
    confidenceLine: context.confidenceLine ?? "",
    reconsiderationLine: context.reconsiderationLine ?? "",
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

const RATIONALE_SPEECH_LABEL_PATTERN =
  /^(验证点|判定标准|证据联动|压力档位|反证|桌面风险|信息收益|桌面反应|时机窗口|世界分支|票面联盟|来源可靠度|时间线一致性|动机归因|举证责任|追问顺序|行动门槛|记忆连续性|表达纪律|不确定性|证据新鲜度|证伪检查|因果链|前提审计|机制敏感性|角色假说)\s*[：:]\s*/u;

function surfaceRationaleSentence(text) {
  const value = surfaceSentence(text).replace(RATIONALE_SPEECH_LABEL_PATTERN, "").trim();
  return value && !/[。！？]$/.test(value) ? `${value}。` : value;
}

function surfacePrivateVerificationSentence(text) {
  return surfaceRationaleSentence(text)
    .replace(/^验证点是让\s*([0-9]+号|这个位置)\s*说明为什么比\s*([0-9]+号|这个位置)\s*更该先处理，再补身份和昨晚信息。/u, "先听$1说明为什么比$2更该先处理，再补身份和昨晚信息。")
    .replace(/^验证点是让\s*([0-9]+号|这个位置)\s*把现有线索逐条对上，再补身份和昨晚信息。/u, "这条先让$1把现有线索逐条对上，再补身份和昨晚信息。")
    .replace(/^验证点是先问\s*([0-9]+号|这个位置)\s*哪条来源能被别人复核，再把身份口径和公开验证对齐。/u, "先核$1哪条来源能被别人复核，再把身份口径和公开验证对齐。")
    .replace(/^验证点是先问\s*([0-9]+号|这个位置)\s*为什么维护高压位，再解释反票理由和票型压力。/u, "先听$1为什么维护高压位，再解释反票理由和票型压力。")
    .replace(/^验证点是先问\s*([0-9]+号|这个位置)\s*夜信来源能不能复核，再把身份口径和公开验证对上。/u, "先核$1夜信来源能不能复核，再把身份口径和公开验证对上。")
    .replace(/^验证点是先问\s*([0-9]+号|这个位置)\s*身份口径哪里断开，再说明投票为什么和压力相反。/u, "这条先问$1身份口径哪里断开，再说明投票为什么和压力相反。")
    .replace(/^验证点是先问\s*([0-9]+号|这个位置)\s*为什么推低证据位，再把身份口径和公开验证对上。/u, "先听$1为什么推低证据位，再把身份口径和公开验证对上。")
    .replace(/^验证点是/u, "先核");
}

function uniqueSpeechFragments(fragments = []) {
  const seen = new Set();
  return fragments.filter((entry) => {
    const value = `${entry ?? ""}`.trim();
    if (!value) return false;
    const key = value.replace(/[，。！？；：、,.!?;:\s]/gu, "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isTargetSwitchMemoryLine(line) {
  return /昨天主线|天前主线|先转|不等于放掉|旧线|回看/.test(`${line ?? ""}`);
}

function selectPrivateSupportFragmentsForIntent(act, fragments = {}) {
  const {
    followUpLine,
    evidenceModeLine,
    responsePlanLine,
    responseCriteriaLine,
    evidenceInteractionLine,
    causalChainLine,
    assumptionAuditLine,
    mechanicSensitivityLine,
    roleHypothesisLine,
    pressureStageLine,
    voteCoalitionLine,
    actionThresholdLine,
    questionPriorityLine,
    memoryContinuityLine,
    expressionDisciplineLine,
    uncertaintyResolutionLine,
    falsificationCheckLine,
    evidenceBoundaryLine,
    counterEvidenceLine,
    runnerUpWatchLine,
    confidenceLine,
    reconsiderationLine,
  } = fragments;
  const targetSwitchMemoryLine = isTargetSwitchMemoryLine(memoryContinuityLine) ? memoryContinuityLine : "";
  const byIntent = {
    [QUESTION_INTENT.VOTE]: [targetSwitchMemoryLine, responsePlanLine, actionThresholdLine, voteCoalitionLine, falsificationCheckLine],
    [QUESTION_INTENT.PLAN]: [targetSwitchMemoryLine, followUpLine, responsePlanLine, questionPriorityLine, actionThresholdLine],
    [QUESTION_INTENT.REASON]: [targetSwitchMemoryLine, followUpLine, roleHypothesisLine, causalChainLine, falsificationCheckLine],
    [QUESTION_INTENT.SUSPECT]: [targetSwitchMemoryLine, followUpLine, roleHypothesisLine, counterEvidenceLine, falsificationCheckLine],
    [QUESTION_INTENT.GENERIC]: [targetSwitchMemoryLine, evidenceModeLine, followUpLine, roleHypothesisLine, evidenceBoundaryLine],
  };
  const fallback = [
    evidenceModeLine,
    responseCriteriaLine,
    evidenceInteractionLine,
    assumptionAuditLine,
    mechanicSensitivityLine,
    pressureStageLine,
    expressionDisciplineLine,
    uncertaintyResolutionLine,
    runnerUpWatchLine,
    confidenceLine,
  ];
  return uniqueSpeechFragments([...(byIntent[act.intent] ?? []), ...fallback]).slice(0, act.intent === QUESTION_INTENT.PLAN ? 3 : 2);
}

function inlineReasoningLine(sentence, reasoningLine) {
  const value = `${sentence ?? ""}`.trim();
  const reasoning = `${reasoningLine ?? ""}`.replace(/[。！？；]+$/u, "").trim();
  if (!value || !reasoning || value.includes(reasoning)) {
    return value;
  }
  return `${value.replace(/[。！？；]+$/u, "")}，${reasoning}。`;
}

function renderPrivateSurfaceAct(act, rng = Math.random) {
  if (!act || act.claimAsked || act.intent === QUESTION_INTENT.NIGHT) {
    return "";
  }
  const targetName = act.targetName;
  const evidence = act.evidenceText;
  const followUp = surfaceFollowUpForAct(act);
  const verificationFollowUp =
    [QUESTION_INTENT.REASON, QUESTION_INTENT.SUSPECT, QUESTION_INTENT.GENERIC, QUESTION_INTENT.PLAN, QUESTION_INTENT.VOTE].includes(act.intent)
      ? surfacePrivateVerificationSentence(act.verificationLine)
      : "";
  const thoughtFollowUp = act.questionToAsk ? `下一句我会问${compactThoughtQuestionText(act.questionToAsk)}。` : "";
  const followUpLine = verificationFollowUp || surfaceSentence(thoughtFollowUp || act.followUpText || followUp);
  const evidenceBoundaryLine =
    [QUESTION_INTENT.REASON, QUESTION_INTENT.SUSPECT, QUESTION_INTENT.GENERIC, QUESTION_INTENT.PLAN, QUESTION_INTENT.VOTE].includes(act.intent)
      ? surfaceRationaleSentence(act.evidenceBoundaryLine)
      : "";
  const counterEvidenceLine =
    [QUESTION_INTENT.REASON, QUESTION_INTENT.SUSPECT, QUESTION_INTENT.GENERIC, QUESTION_INTENT.PLAN, QUESTION_INTENT.VOTE].includes(act.intent)
      ? surfaceRationaleSentence(act.counterEvidenceLine)
      : "";
  const responsePlanLine =
    [QUESTION_INTENT.REASON, QUESTION_INTENT.SUSPECT, QUESTION_INTENT.GENERIC, QUESTION_INTENT.PLAN, QUESTION_INTENT.VOTE].includes(act.intent)
      ? surfaceRationaleSentence(act.responsePlanLine)
      : "";
  const responseCriteriaLine =
    [QUESTION_INTENT.REASON, QUESTION_INTENT.SUSPECT, QUESTION_INTENT.GENERIC, QUESTION_INTENT.PLAN, QUESTION_INTENT.VOTE].includes(act.intent)
      ? surfaceRationaleSentence(act.responseCriteriaLine)
      : "";
  const evidenceInteractionLine =
    [QUESTION_INTENT.REASON, QUESTION_INTENT.SUSPECT, QUESTION_INTENT.GENERIC, QUESTION_INTENT.PLAN, QUESTION_INTENT.VOTE].includes(act.intent)
      ? surfaceRationaleSentence(act.evidenceInteractionLine)
      : "";
  const pressureStageLine =
    [QUESTION_INTENT.REASON, QUESTION_INTENT.SUSPECT, QUESTION_INTENT.GENERIC, QUESTION_INTENT.PLAN, QUESTION_INTENT.VOTE].includes(act.intent)
      ? surfaceRationaleSentence(act.pressureStageLine)
      : "";
  const tableRiskLine =
    [QUESTION_INTENT.REASON, QUESTION_INTENT.SUSPECT, QUESTION_INTENT.GENERIC, QUESTION_INTENT.PLAN, QUESTION_INTENT.VOTE].includes(act.intent)
      ? surfaceRationaleSentence(act.tableRiskLine)
      : "";
  const informationGainLine =
    [QUESTION_INTENT.REASON, QUESTION_INTENT.SUSPECT, QUESTION_INTENT.GENERIC, QUESTION_INTENT.PLAN, QUESTION_INTENT.VOTE].includes(act.intent)
      ? surfaceRationaleSentence(act.informationGainLine)
      : "";
  const tableReactionLine =
    [QUESTION_INTENT.REASON, QUESTION_INTENT.SUSPECT, QUESTION_INTENT.GENERIC, QUESTION_INTENT.PLAN, QUESTION_INTENT.VOTE].includes(act.intent)
      ? surfaceRationaleSentence(act.tableReactionLine)
      : "";
  const timingWindowLine =
    [QUESTION_INTENT.REASON, QUESTION_INTENT.SUSPECT, QUESTION_INTENT.GENERIC, QUESTION_INTENT.PLAN, QUESTION_INTENT.VOTE].includes(act.intent)
      ? surfaceRationaleSentence(act.timingWindowLine)
      : "";
  const worldBranchLine =
    [QUESTION_INTENT.REASON, QUESTION_INTENT.SUSPECT, QUESTION_INTENT.GENERIC, QUESTION_INTENT.PLAN, QUESTION_INTENT.VOTE].includes(act.intent)
      ? surfaceRationaleSentence(act.worldBranchLine)
      : "";
  const voteCoalitionLine =
    [QUESTION_INTENT.REASON, QUESTION_INTENT.SUSPECT, QUESTION_INTENT.GENERIC, QUESTION_INTENT.PLAN, QUESTION_INTENT.VOTE].includes(act.intent)
      ? surfaceRationaleSentence(act.voteCoalitionLine)
      : "";
  const sourceReliabilityLine =
    [QUESTION_INTENT.REASON, QUESTION_INTENT.SUSPECT, QUESTION_INTENT.GENERIC, QUESTION_INTENT.PLAN, QUESTION_INTENT.VOTE].includes(act.intent)
      ? surfaceRationaleSentence(act.sourceReliabilityLine)
      : "";
  const timelineConsistencyLine =
    [QUESTION_INTENT.REASON, QUESTION_INTENT.SUSPECT, QUESTION_INTENT.GENERIC, QUESTION_INTENT.PLAN, QUESTION_INTENT.VOTE].includes(act.intent)
      ? surfaceRationaleSentence(act.timelineConsistencyLine)
      : "";
  const incentiveAlignmentLine =
    [QUESTION_INTENT.REASON, QUESTION_INTENT.SUSPECT, QUESTION_INTENT.GENERIC, QUESTION_INTENT.PLAN, QUESTION_INTENT.VOTE].includes(act.intent)
      ? surfaceRationaleSentence(act.incentiveAlignmentLine)
      : "";
  const burdenOfProofLine =
    [QUESTION_INTENT.REASON, QUESTION_INTENT.SUSPECT, QUESTION_INTENT.GENERIC, QUESTION_INTENT.PLAN, QUESTION_INTENT.VOTE].includes(act.intent)
      ? surfaceRationaleSentence(act.burdenOfProofLine)
      : "";
  const questionPriorityLine =
    [QUESTION_INTENT.REASON, QUESTION_INTENT.SUSPECT, QUESTION_INTENT.GENERIC, QUESTION_INTENT.PLAN, QUESTION_INTENT.VOTE].includes(act.intent)
      ? surfaceRationaleSentence(act.questionPriorityLine)
      : "";
  const actionThresholdLine =
    [QUESTION_INTENT.REASON, QUESTION_INTENT.SUSPECT, QUESTION_INTENT.GENERIC, QUESTION_INTENT.PLAN, QUESTION_INTENT.VOTE].includes(act.intent)
      ? surfaceRationaleSentence(act.actionThresholdLine)
      : "";
  const memoryContinuityLine =
    [QUESTION_INTENT.REASON, QUESTION_INTENT.SUSPECT, QUESTION_INTENT.GENERIC, QUESTION_INTENT.PLAN, QUESTION_INTENT.VOTE].includes(act.intent)
      ? surfaceRationaleSentence(act.memoryContinuityLine)
      : "";
  const expressionDisciplineLine =
    [QUESTION_INTENT.REASON, QUESTION_INTENT.SUSPECT, QUESTION_INTENT.GENERIC, QUESTION_INTENT.PLAN, QUESTION_INTENT.VOTE].includes(act.intent)
      ? surfaceRationaleSentence(act.expressionDisciplineLine)
      : "";
  const uncertaintyResolutionLine =
    [QUESTION_INTENT.REASON, QUESTION_INTENT.SUSPECT, QUESTION_INTENT.GENERIC, QUESTION_INTENT.PLAN, QUESTION_INTENT.VOTE].includes(act.intent)
      ? surfaceRationaleSentence(act.uncertaintyResolutionLine)
      : "";
  const evidenceFreshnessLine =
    [QUESTION_INTENT.REASON, QUESTION_INTENT.SUSPECT, QUESTION_INTENT.GENERIC, QUESTION_INTENT.PLAN, QUESTION_INTENT.VOTE].includes(act.intent)
      ? surfaceRationaleSentence(act.evidenceFreshnessLine)
      : "";
  const falsificationCheckLine =
    [QUESTION_INTENT.REASON, QUESTION_INTENT.SUSPECT, QUESTION_INTENT.GENERIC, QUESTION_INTENT.PLAN, QUESTION_INTENT.VOTE].includes(act.intent)
      ? surfaceRationaleSentence(act.falsificationCheckLine)
      : "";
  const causalChainLine =
    [QUESTION_INTENT.REASON, QUESTION_INTENT.SUSPECT, QUESTION_INTENT.GENERIC, QUESTION_INTENT.PLAN, QUESTION_INTENT.VOTE].includes(act.intent)
      ? surfaceRationaleSentence(act.causalChainLine)
      : "";
  const assumptionAuditLine =
    [QUESTION_INTENT.REASON, QUESTION_INTENT.SUSPECT, QUESTION_INTENT.GENERIC, QUESTION_INTENT.PLAN, QUESTION_INTENT.VOTE].includes(act.intent)
      ? surfaceRationaleSentence(act.assumptionAuditLine)
      : "";
  const mechanicSensitivityLine =
    [QUESTION_INTENT.REASON, QUESTION_INTENT.SUSPECT, QUESTION_INTENT.GENERIC, QUESTION_INTENT.PLAN, QUESTION_INTENT.VOTE].includes(act.intent)
      ? surfaceRationaleSentence(act.mechanicSensitivityLine)
      : "";
  const roleHypothesisLine =
    [QUESTION_INTENT.REASON, QUESTION_INTENT.SUSPECT, QUESTION_INTENT.GENERIC, QUESTION_INTENT.PLAN, QUESTION_INTENT.VOTE].includes(act.intent)
      ? surfaceRationaleSentence(act.roleHypothesisLine)
      : "";
  const evidenceModeLine =
    [QUESTION_INTENT.REASON, QUESTION_INTENT.SUSPECT, QUESTION_INTENT.GENERIC, QUESTION_INTENT.PLAN, QUESTION_INTENT.VOTE].includes(act.intent)
      ? surfaceRationaleSentence(act.evidenceModeLine)
      : "";
  const runnerUpWatchLine =
    [QUESTION_INTENT.REASON, QUESTION_INTENT.SUSPECT, QUESTION_INTENT.GENERIC, QUESTION_INTENT.PLAN, QUESTION_INTENT.VOTE].includes(act.intent)
      ? surfaceRationaleSentence(act.runnerUpWatchLine)
      : "";
  const confidenceLine =
    [QUESTION_INTENT.REASON, QUESTION_INTENT.SUSPECT, QUESTION_INTENT.GENERIC, QUESTION_INTENT.PLAN, QUESTION_INTENT.VOTE].includes(act.intent)
      ? surfaceRationaleSentence(act.confidenceLine)
      : "";
  const reconsiderationLine =
    [QUESTION_INTENT.REASON, QUESTION_INTENT.SUSPECT, QUESTION_INTENT.GENERIC, QUESTION_INTENT.PLAN, QUESTION_INTENT.VOTE].includes(act.intent)
      ? surfaceRationaleSentence(act.reconsiderationLine)
      : "";
  const supportLine = joinSpeechFragments(selectPrivateSupportFragmentsForIntent(act, {
    followUpLine,
    evidenceModeLine,
    responsePlanLine,
    responseCriteriaLine,
    evidenceInteractionLine,
    causalChainLine,
    assumptionAuditLine,
    mechanicSensitivityLine,
    roleHypothesisLine,
    pressureStageLine,
    tableRiskLine,
    informationGainLine,
    tableReactionLine,
    timingWindowLine,
    worldBranchLine,
    voteCoalitionLine,
    sourceReliabilityLine,
    timelineConsistencyLine,
    incentiveAlignmentLine,
    burdenOfProofLine,
    questionPriorityLine,
    actionThresholdLine,
    memoryContinuityLine,
    expressionDisciplineLine,
    uncertaintyResolutionLine,
    evidenceFreshnessLine,
    falsificationCheckLine,
    evidenceBoundaryLine,
    counterEvidenceLine,
    runnerUpWatchLine,
    confidenceLine,
    reconsiderationLine,
  }));
  const opener = act.explicitSwitch
    ? `${act.previousFocusName} 那条暂放一边，你明确问到 ${targetName}，我就单看 ${targetName}。`
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
    return joinSpeechFragments([inlineReasoningLine(`如果提 ${targetName}，我会先看回应。${evidence}。`, act.reasoningLine), supportLine]);
  }
  if (act.intent === QUESTION_INTENT.PLAN) {
    return joinSpeechFragments([inlineReasoningLine(`下一步先问 ${targetName}。${evidence}。`, act.reasoningLine), supportLine]);
  }
  if (act.intent === QUESTION_INTENT.COMPARE) {
    const second = act.secondName ? `${act.secondName} 先排后面。` : "另一条线先排后面。";
    return joinSpeechFragments([inlineReasoningLine(`${targetName} 先级更高。${evidence}。`, act.reasoningLine), second]);
  }
  if (act.evidenceKind === "night-info") {
    return joinSpeechFragments([inlineReasoningLine(`${opener}${evidence}，但这条不能单独定死。`, act.reasoningLine), supportLine]);
  }
  if (act.lowEvidence && rng() < 0.5) {
    return joinSpeechFragments([inlineReasoningLine(`${opener}${evidence}，还不够拍死。`, act.reasoningLine), supportLine]);
  }
  return joinSpeechFragments([inlineReasoningLine(`${opener}${evidence}。`, act.reasoningLine), supportLine]);
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
    evidenceContract?.spokenText || evidenceContract?.summaries?.[0] || evidenceContract?.text || context.reasonText,
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
    reasoningLine: context.reasoningLine ?? "",
    verificationLine: context.verificationLine ?? "",
    evidenceModeLine: context.evidenceModeLine ?? "",
    responsePlanLine: context.responsePlanLine ?? "",
    responseCriteriaLine: context.responseCriteriaLine ?? "",
    evidenceInteractionLine: context.evidenceInteractionLine ?? "",
    pressureStageLine: context.pressureStageLine ?? "",
    counterEvidenceLine: context.counterEvidenceLine ?? "",
    tableRiskLine: context.tableRiskLine ?? "",
    informationGainLine: context.informationGainLine ?? "",
    tableReactionLine: context.tableReactionLine ?? "",
    timingWindowLine: context.timingWindowLine ?? "",
    worldBranchLine: context.worldBranchLine ?? "",
    voteCoalitionLine: context.voteCoalitionLine ?? "",
    sourceReliabilityLine: context.sourceReliabilityLine ?? "",
    timelineConsistencyLine: context.timelineConsistencyLine ?? "",
    incentiveAlignmentLine: context.incentiveAlignmentLine ?? "",
    burdenOfProofLine: context.burdenOfProofLine ?? "",
    questionPriorityLine: context.questionPriorityLine ?? "",
    actionThresholdLine: context.actionThresholdLine ?? "",
    memoryContinuityLine: context.memoryContinuityLine ?? "",
    expressionDisciplineLine: context.expressionDisciplineLine ?? "",
    uncertaintyResolutionLine: context.uncertaintyResolutionLine ?? "",
    evidenceFreshnessLine: context.evidenceFreshnessLine ?? "",
    falsificationCheckLine: context.falsificationCheckLine ?? "",
    causalChainLine: context.causalChainLine ?? "",
    assumptionAuditLine: context.assumptionAuditLine ?? "",
    mechanicSensitivityLine: context.mechanicSensitivityLine ?? "",
    roleHypothesisLine: context.roleHypothesisLine ?? "",
    evidenceBoundaryLine: context.evidenceBoundaryLine ?? "",
    runnerUpWatchLine: context.runnerUpWatchLine ?? "",
    confidenceLine: context.confidenceLine ?? "",
    reconsiderationLine: context.reconsiderationLine ?? "",
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
  return joinSpeechFragments([intro, inlineReasoningLine(main, act.reasoningLine), second]);
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
    .replace(/^两条线索合在一起：/u, "这两点合着看：")
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
    main = `${targetName} 可以进提名池，卡在${evidence}。`;
  } else if (intro && act.debateBeat === "vote-intent") {
    main = `如果今天提 ${targetName}，我会看解释和票型，卡在${evidence}。`;
  } else if (intro && act.actKind === "public-claim") {
    main = act.lowEvidence
      ? `${act.targetName} 这条先当观察位，公开信息还不够。`
      : `${act.targetName} 这条先留桌面上，卡在${evidence}。`;
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
  main = inlineReasoningLine(main, act.reasoningLine);
  if (act.confidenceLine && main.length < 130 && !main.includes(act.confidenceLine)) {
    main = joinSpeechFragments([main, act.confidenceLine]);
  }
  if (act.responseCriteriaLine && main.length < 130 && !main.includes(act.responseCriteriaLine)) {
    main = joinSpeechFragments([main, act.responseCriteriaLine]);
  }
  if (act.evidenceInteractionLine && main.length < 130 && !main.includes(act.evidenceInteractionLine)) {
    main = joinSpeechFragments([main, act.evidenceInteractionLine]);
  }
  if (act.causalChainLine && main.length < 130 && !main.includes(act.causalChainLine)) {
    main = joinSpeechFragments([main, act.causalChainLine]);
  }
  if (act.assumptionAuditLine && main.length < 130 && !main.includes(act.assumptionAuditLine)) {
    main = joinSpeechFragments([main, act.assumptionAuditLine]);
  }
  if (act.mechanicSensitivityLine && main.length < 130 && !main.includes(act.mechanicSensitivityLine)) {
    main = joinSpeechFragments([main, act.mechanicSensitivityLine]);
  }
  if (act.roleHypothesisLine && main.length < 130 && !main.includes(act.roleHypothesisLine)) {
    main = joinSpeechFragments([main, act.roleHypothesisLine]);
  }
  if (act.sourceReliabilityLine && main.length < 130 && !main.includes(act.sourceReliabilityLine)) {
    main = joinSpeechFragments([main, act.sourceReliabilityLine]);
  }
  if (act.timelineConsistencyLine && main.length < 130 && !main.includes(act.timelineConsistencyLine)) {
    main = joinSpeechFragments([main, act.timelineConsistencyLine]);
  }
  if (act.incentiveAlignmentLine && main.length < 130 && !main.includes(act.incentiveAlignmentLine)) {
    main = joinSpeechFragments([main, act.incentiveAlignmentLine]);
  }
  if (act.burdenOfProofLine && main.length < 130 && !main.includes(act.burdenOfProofLine)) {
    main = joinSpeechFragments([main, act.burdenOfProofLine]);
  }
  if (act.questionPriorityLine && main.length < 130 && !main.includes(act.questionPriorityLine)) {
    main = joinSpeechFragments([main, act.questionPriorityLine]);
  }
  if (act.actionThresholdLine && main.length < 130 && !main.includes(act.actionThresholdLine)) {
    main = joinSpeechFragments([main, act.actionThresholdLine]);
  }
  if (act.memoryContinuityLine && main.length < 130 && !main.includes(act.memoryContinuityLine)) {
    main = joinSpeechFragments([main, act.memoryContinuityLine]);
  }
  if (act.expressionDisciplineLine && main.length < 130 && !main.includes(act.expressionDisciplineLine)) {
    main = joinSpeechFragments([main, act.expressionDisciplineLine]);
  }
  if (act.uncertaintyResolutionLine && main.length < 130 && !main.includes(act.uncertaintyResolutionLine)) {
    main = joinSpeechFragments([main, act.uncertaintyResolutionLine]);
  }
  if (act.evidenceFreshnessLine && main.length < 130 && !main.includes(act.evidenceFreshnessLine)) {
    main = joinSpeechFragments([main, act.evidenceFreshnessLine]);
  }
  if (act.falsificationCheckLine && main.length < 130 && !main.includes(act.falsificationCheckLine)) {
    main = joinSpeechFragments([main, act.falsificationCheckLine]);
  }
  if (act.pressureStageLine && main.length < 130 && !main.includes(act.pressureStageLine)) {
    main = joinSpeechFragments([main, act.pressureStageLine]);
  }
  if (act.voteCoalitionLine && main.length < 130 && !main.includes(act.voteCoalitionLine)) {
    main = joinSpeechFragments([main, act.voteCoalitionLine]);
  }
  if (act.counterEvidenceLine && main.length < 135 && !main.includes(act.counterEvidenceLine)) {
    main = joinSpeechFragments([main, act.counterEvidenceLine]);
  }
  if (act.reconsiderationLine && main.length < 145 && !main.includes(act.reconsiderationLine)) {
    main = joinSpeechFragments([main, act.reconsiderationLine]);
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
    alive: registersAsAlive(state, aiPlayer),
    persona: aiPlayer?.aiPersona ?? PERSONA_TYPES.STEADY,
    team: aiPlayer?.team ?? "",
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
    const focusName = ctx.focusId ? statementTargetLabel(state, ctx.focusId) : "这条";
    if (ctx.audience === "public" && ctx.team === "evil") {
      return ctx.persona === PERSONA_TYPES.PRESSURE
        ? `台面上我先压 ${focusName}，需要马上听回应。`
        : `台面上我先看 ${focusName}，需要马上听回应。`;
    }
    if (ctx.audience === "public" && ctx.persona === PERSONA_TYPES.PRESSURE) {
      return `我先压 ${focusName}，需要马上听回应。`;
    }
    if (ctx.audience === "public" && ctx.persona === PERSONA_TYPES.SHADOW) {
      return `${focusName} 我先暗记成主线，需要听回应。`;
    }
    return ctx.audience === "public"
      ? `我先看 ${focusName}，需要马上听回应。`
      : "这条我不是轻轻记一笔了，是需要马上听回应。";
  }
  if (ctx.lowEvidence) {
    return "这条还只是追问入口，我先不定死。";
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

function privateScriptClaimDeflectLine(state, role) {
  const scriptId = `${state?.scriptId ?? ""}`.toLowerCase();
  if (scriptId === "bmr") {
    return "BMR里死亡、保护和复活会搅身份价值，我先不把具体身份摊开；如果到提名前还活着，我会给能验证的信息。";
  }
  if (scriptId === "snv") {
    return "SnV里身份口径和疯狂压力要分开听，我先不裸身份；真推到我身上，我会给能验证的说法。";
  }
  if (role?.category === "outsider") {
    return "外来者身份太早摊开容易被当免费压力位，我先给可验证说法，不急着裸身份。";
  }
  return "";
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
  const pressured = selfHeat >= 0.62 || askedCount >= 2 || day >= 3 || !registersAsAlive(state, aiPlayer);
  const disclosurePlan = claimDisclosurePlanner(state, aiPlayer, human, rng, {
    private: true,
    audience: "private",
    intent: "claim",
    askedCount,
    trustScore: humanRisk,
  });

  if (!registersAsAlive(state, aiPlayer)) {
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
        : [`身份我先不说满，对外先按${roleName}这个方向聊。先别替我公开。`],
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

  if (day <= 1) {
    const scriptDeflect = privateScriptClaimDeflectLine(state, perceivedRole);
    if (scriptDeflect) {
      return scriptDeflect;
    }
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
  const previousDisclosure = getClaimDisclosureState(state, aiPlayer, human, { private: true, audience: "private" });
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
  const response = joinSpeechFragments([continuity, claimSentence, follow]);
  const plan = claimDisclosurePlanner(state, aiPlayer, human, rng, {
    private: true,
    audience: "private",
    intent: "claim",
    askedCount: memory.claimAskedCount,
    trustScore: aiPlayer.suspicion?.[human.id],
    previousDisclosure,
  });
  const claimDisclosureRationale = attachClaimDisclosureRationaleSpokenLine(plan.claimDisclosureRationale, response);
  rememberClaimDisclosure(
    state,
    aiPlayer,
    { ...plan, claimDisclosureRationale },
    human,
    { private: true, audience: "private" }
  );
  return {
    response,
    claimDisclosureRationale,
  };
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

function claimDisclosureResult(text, plan = null) {
  return {
    text,
    plan,
    claimDisclosureRationale: attachClaimDisclosureRationaleSpokenLine(plan?.claimDisclosureRationale, text),
  };
}

function composeNightInfoDisclosure(state, aiPlayer, audience, rng = Math.random, options = {}) {
  const ping = latestInfoPingForPlayer(state, aiPlayer);
  const notes = summarizeShareablePrivateNotes(aiPlayer, 2, { state, audience });
  const note = ping?.text ?? notes.at(-1) ?? "";
  if (!ping && note) {
    return claimDisclosureResult(exactPrivateNightInfoLine(note), null);
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
    return claimDisclosureResult(
      joinSpeechFragments([
        `身份直接摊：${roleName}。`,
        exact ? `昨晚信息：${exact}。` : "昨晚信息现在可以摊开聊。",
        ping?.polluted ? "但这条可能被醉酒或中毒影响，先别当铁证。" : "这条可以先拿来复核，但别只凭这一条定死。",
      ]),
      plan
    );
  }

  if (forceExact) {
    const exactText = exactNightInfoFormatLine(state, aiPlayer, note, plan, ping);
    if (exactText) {
      return claimDisclosureResult(exactText, plan);
    }
  }

  if (formatRequested && plan.shouldUseRange) {
    return claimDisclosureResult(formatOnlyNightInfoLine(state, aiPlayer, plan, ping), plan);
  }

  if (plan.shouldUseRange) {
    return claimDisclosureResult(rangeNightInfoLine(plan, ping), plan);
  }

  return claimDisclosureResult(vagueNightInfoLine(plan, ping), plan);
}

function composePrivateNightAnswer(state, aiPlayer, human, memory = {}, rng = Math.random, options = {}) {
  const sharedSummary = summarizeShareablePrivateNotes(aiPlayer, 2, { state, audience: human })
    .map(humanizeSharedPrivateNote)
    .filter(Boolean)
    .join(" / ");
  const repeatInfo = summarizeSharedInfoRepeat(state, aiPlayer, human, sharedSummary);
  if (
    repeatInfo.line &&
    !shouldForceExactNightInfo(options.questionText, memory.nightAskedCount ?? 0) &&
    !privateQuestionAsksForInfoFormat(options.questionText)
  ) {
    return { response: repeatInfo.line, claimDisclosureRationale: null };
  }
  const disclosure = composeNightInfoDisclosure(state, aiPlayer, human, rng, {
    askedCount: memory.nightAskedCount ?? 0,
    trustScore: aiPlayer.suspicion?.[human.id],
    questionText: options.questionText,
    formatRequested: options.formatRequested,
  });
  if (disclosure.text) {
    return {
      response: disclosure.text,
      claimDisclosureRationale: disclosure.claimDisclosureRationale ?? null,
    };
  }
  const notes = summarizeShareablePrivateNotes(aiPlayer, 2, { state, audience: human }).map(humanizeSharedPrivateNote);
  if (notes.length > 0) {
    return {
      response: `我昨晚能安全说的是：${notes.join("；")}。这条先当线索，别直接定死。`,
      claimDisclosureRationale: null,
    };
  }
  const perceivedRole = perceivedRoleForPlayer(state, aiPlayer) ?? roleForPlayer(state, aiPlayer);
  if (isLikelyEarlyInfoRole(perceivedRole)) {
    return {
      response: "我昨晚没有能直接摊开的新信息；如果要聊，我只能先给可复核的结论，身份细节另说。",
      claimDisclosureRationale: null,
    };
  }
  return {
    response: "我昨晚没有能分享的新信息。今天主要看白天口径、投票和谁在回避追问。",
    claimDisclosureRationale: null,
  };
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
    const nightAnswer = composePrivateNightAnswer(state, aiPlayer, human, memory, rng, {
      questionText,
      formatRequested: privateQuestionAsksForInfoFormat(questionText),
    });
    return {
      response: nightAnswer.response,
      focusId: null,
      focusScore: null,
      evidenceContract: null,
      followUpPrompts: [],
      directIntent: QUESTION_INTENT.NIGHT,
      claimDisclosureRationale: nightAnswer.claimDisclosureRationale ?? null,
    };
  }

  if (analysis.intent === QUESTION_INTENT.CLAIM) {
    const claimAnswer = composePrivateClaimAnswer(state, aiPlayer, human, memory, rng);
    return {
      response: claimAnswer.response,
      focusId: null,
      focusScore: null,
      evidenceContract: null,
      followUpPrompts: [],
      directIntent: QUESTION_INTENT.CLAIM,
      claimDisclosureRationale: claimAnswer.claimDisclosureRationale ?? null,
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
  const stanceMemory = rememberDayStance(state, aiPlayer, focus.player.id, focus.score, "private", {
    reasonSummary: evidenceText,
    evidenceCount: evidence.length,
    evidenceSummaries: evidence,
    evidenceAnchors: evidenceContract.evidenceAnchors,
    scoreTrailAnchors: evidenceContract.scoreTrailAnchors,
    eventAnchors: options.sourceEventAnchor
      ? [
          {
            ...options.sourceEventAnchor,
            targetId: human.id,
            focusId: focus.player.id,
            focusScore: focus.score,
            text: evidenceText,
          },
        ]
      : [],
  });
  const baseDecisionRationale = buildDecisionRationale(agentView ?? state, aiPlayer, focus, second, {
    publicOnly: false,
    audience: "private",
    numericMode,
    stanceMemory,
  });
  const synthesisVerificationLine = privateEvidenceSynthesisVerificationLine(focus.player.name, evidenceContract);
  const mergedVerificationLine = mergePrivateEvidenceVerificationLine(
    synthesisVerificationLine,
    baseDecisionRationale?.verificationLine ?? ""
  );
  const decisionRationale =
    baseDecisionRationale && synthesisVerificationLine
      ? { ...baseDecisionRationale, verificationLine: mergedVerificationLine }
      : baseDecisionRationale;
  const reasoningContrastLine = decisionRationale?.line ?? "";
  const privateReasoningLine = decisionRationale?.targetSwitchLine
    ? surfaceRationaleSentence(decisionRationale.targetSwitchLine)
    : reasoningContrastLine;
  const crossDayStanceLine = crossDayStanceContinuityLine(state, aiPlayer, focus.player.id, stanceMemory, {
    targetName: statementTargetLabel(state, focus.player.id),
    compact: true,
  });
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
    reasoningLine: privateReasoningLine,
    verificationLine: decisionRationale?.verificationLine ?? "",
    evidenceModeLine: decisionRationale?.evidenceModeLine ?? "",
    responsePlanLine: decisionRationale?.responsePlanLine ?? "",
    responseCriteriaLine: decisionRationale?.responseCriteriaLine ?? "",
    evidenceInteractionLine: decisionRationale?.evidenceInteractionLine ?? "",
    pressureStageLine: decisionRationale?.pressureStageLine ?? "",
    counterEvidenceLine: decisionRationale?.counterEvidenceLine ?? "",
    tableRiskLine: decisionRationale?.tableRiskLine ?? "",
    informationGainLine: decisionRationale?.informationGainLine ?? "",
    tableReactionLine: decisionRationale?.tableReactionLine ?? "",
    timingWindowLine: decisionRationale?.timingWindowLine ?? "",
    worldBranchLine: decisionRationale?.worldBranchLine ?? "",
    voteCoalitionLine: decisionRationale?.voteCoalitionLine ?? "",
    sourceReliabilityLine: decisionRationale?.sourceReliabilityLine ?? "",
    timelineConsistencyLine: decisionRationale?.timelineConsistencyLine ?? "",
    incentiveAlignmentLine: decisionRationale?.incentiveAlignmentLine ?? "",
    burdenOfProofLine: decisionRationale?.burdenOfProofLine ?? "",
    questionPriorityLine: decisionRationale?.questionPriorityLine ?? "",
    actionThresholdLine: decisionRationale?.actionThresholdLine ?? "",
    memoryContinuityLine: decisionRationale?.memoryContinuityLine ?? "",
    expressionDisciplineLine: decisionRationale?.expressionDisciplineLine ?? "",
    uncertaintyResolutionLine: decisionRationale?.uncertaintyResolutionLine ?? "",
    evidenceFreshnessLine: decisionRationale?.evidenceFreshnessLine ?? "",
    falsificationCheckLine: decisionRationale?.falsificationCheckLine ?? "",
    causalChainLine: decisionRationale?.causalChainLine ?? "",
    assumptionAuditLine: decisionRationale?.assumptionAuditLine ?? "",
    mechanicSensitivityLine: decisionRationale?.mechanicSensitivityLine ?? "",
    roleHypothesisLine: decisionRationale?.roleHypothesisLine ?? "",
    evidenceBoundaryLine: decisionRationale?.evidenceBoundaryLine ?? "",
    runnerUpWatchLine: decisionRationale?.runnerUpWatchLine ?? "",
    confidenceLine: decisionRationale?.confidenceLine ?? "",
    reconsiderationLine: decisionRationale?.reconsiderationLine ?? "",
  });
  const surfaceResponse = renderPrivateSurfaceAct(surfaceAct, rng);
  if (surfaceResponse) {
    const surfaceWithContinuity = crossDayStanceLine
      ? joinSpeechFragments([crossDayStanceLine, surfaceResponse])
      : surfaceResponse;
    const pragmaticText = applyInGamePragmatics(state, aiPlayer, surfaceWithContinuity, {
      audience: "private",
      intent: analysis.intent,
      focusId: focus.player.id,
      focusScore: focus.score,
      lowEvidence: evidenceContract.lowEvidence,
    });
    const spokenWithSynthesisVerification = ensurePrivateSynthesisVerificationInText(
      pragmaticText,
      decisionRationale,
      evidenceContract
    );
    const spokenWithDeepReasoning = ensurePrivateDeepReasoningInText(
      spokenWithSynthesisVerification,
      decisionRationale,
      analysis.intent
    );
    return {
      response: polishChineseSeatSpacing(ensureEvidenceContractInText(spokenWithDeepReasoning, evidenceContract)),
      focusId: focus.player.id,
      focusScore: focus.score,
      evidenceContract,
      followUpPrompts,
      thoughtFrame: focusedThoughtFrame,
      decisionRationale,
      reasoningContrastLine,
      surfaceRendered: true,
      crossDayStance: stanceMemory?.crossDayStance ?? null,
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

  if (!registersAsAlive(state, aiPlayer) && [QUESTION_INTENT.REASON, QUESTION_INTENT.PLAN, QUESTION_INTENT.GENERIC, QUESTION_INTENT.SUSPECT].includes(analysis.intent)) {
    lines.push(
      renderDialogueActs(state, aiPlayer, "deadPrivate", dialogueValues, rng, [
        `我已经死了，所以这段你可以当遗言看。${focus.player.name} 先问 ${followUpText}。`,
      ])
    );
  }

  if (crossDayStanceLine) {
    lines.push(crossDayStanceLine);
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
  if (
    decisionRationale?.verificationLine &&
    [QUESTION_INTENT.REASON, QUESTION_INTENT.PLAN, QUESTION_INTENT.GENERIC, QUESTION_INTENT.SUSPECT, QUESTION_INTENT.VOTE].includes(analysis.intent)
  ) {
    lines.push(decisionRationale.verificationLine);
  }
  if (
    decisionRationale?.evidenceModeLine &&
    [QUESTION_INTENT.REASON, QUESTION_INTENT.PLAN, QUESTION_INTENT.GENERIC, QUESTION_INTENT.SUSPECT, QUESTION_INTENT.VOTE].includes(analysis.intent)
  ) {
    lines.push(decisionRationale.evidenceModeLine);
  }
  if (
    decisionRationale?.responsePlanLine &&
    [QUESTION_INTENT.REASON, QUESTION_INTENT.PLAN, QUESTION_INTENT.GENERIC, QUESTION_INTENT.SUSPECT, QUESTION_INTENT.VOTE].includes(analysis.intent)
  ) {
    lines.push(decisionRationale.responsePlanLine);
  }
  if (
    decisionRationale?.responseCriteriaLine &&
    [QUESTION_INTENT.REASON, QUESTION_INTENT.PLAN, QUESTION_INTENT.GENERIC, QUESTION_INTENT.SUSPECT, QUESTION_INTENT.VOTE].includes(analysis.intent)
  ) {
    lines.push(decisionRationale.responseCriteriaLine);
  }
  if (
    decisionRationale?.evidenceInteractionLine &&
    [QUESTION_INTENT.REASON, QUESTION_INTENT.PLAN, QUESTION_INTENT.GENERIC, QUESTION_INTENT.SUSPECT, QUESTION_INTENT.VOTE].includes(analysis.intent)
  ) {
    lines.push(decisionRationale.evidenceInteractionLine);
  }
  if (
    decisionRationale?.pressureStageLine &&
    [QUESTION_INTENT.REASON, QUESTION_INTENT.PLAN, QUESTION_INTENT.GENERIC, QUESTION_INTENT.SUSPECT, QUESTION_INTENT.VOTE].includes(analysis.intent)
  ) {
    lines.push(decisionRationale.pressureStageLine);
  }
  if (
    decisionRationale?.counterEvidenceLine &&
    [QUESTION_INTENT.REASON, QUESTION_INTENT.PLAN, QUESTION_INTENT.GENERIC, QUESTION_INTENT.SUSPECT, QUESTION_INTENT.VOTE].includes(analysis.intent)
  ) {
    lines.push(decisionRationale.counterEvidenceLine);
  }
  if (
    decisionRationale?.evidenceBoundaryLine &&
    [QUESTION_INTENT.REASON, QUESTION_INTENT.PLAN, QUESTION_INTENT.GENERIC, QUESTION_INTENT.SUSPECT, QUESTION_INTENT.VOTE].includes(analysis.intent)
  ) {
    lines.push(decisionRationale.evidenceBoundaryLine);
  }
  if (
    decisionRationale?.runnerUpWatchLine &&
    [QUESTION_INTENT.REASON, QUESTION_INTENT.PLAN, QUESTION_INTENT.GENERIC, QUESTION_INTENT.SUSPECT, QUESTION_INTENT.VOTE].includes(analysis.intent)
  ) {
    lines.push(decisionRationale.runnerUpWatchLine);
  }
  if (
    decisionRationale?.questionPriorityLine &&
    [QUESTION_INTENT.REASON, QUESTION_INTENT.PLAN, QUESTION_INTENT.GENERIC, QUESTION_INTENT.SUSPECT, QUESTION_INTENT.VOTE].includes(analysis.intent)
  ) {
    lines.push(decisionRationale.questionPriorityLine);
  }
  if (
    decisionRationale?.actionThresholdLine &&
    [QUESTION_INTENT.REASON, QUESTION_INTENT.PLAN, QUESTION_INTENT.GENERIC, QUESTION_INTENT.SUSPECT, QUESTION_INTENT.VOTE].includes(analysis.intent)
  ) {
    lines.push(decisionRationale.actionThresholdLine);
  }
  if (
    decisionRationale?.memoryContinuityLine &&
    [QUESTION_INTENT.REASON, QUESTION_INTENT.PLAN, QUESTION_INTENT.GENERIC, QUESTION_INTENT.SUSPECT, QUESTION_INTENT.VOTE].includes(analysis.intent)
  ) {
    lines.push(decisionRationale.memoryContinuityLine);
  }
  if (
    decisionRationale?.expressionDisciplineLine &&
    [QUESTION_INTENT.REASON, QUESTION_INTENT.PLAN, QUESTION_INTENT.GENERIC, QUESTION_INTENT.SUSPECT, QUESTION_INTENT.VOTE].includes(analysis.intent)
  ) {
    lines.push(decisionRationale.expressionDisciplineLine);
  }
  if (
    decisionRationale?.uncertaintyResolutionLine &&
    [QUESTION_INTENT.REASON, QUESTION_INTENT.PLAN, QUESTION_INTENT.GENERIC, QUESTION_INTENT.SUSPECT, QUESTION_INTENT.VOTE].includes(analysis.intent)
  ) {
    lines.push(decisionRationale.uncertaintyResolutionLine);
  }
  if (
    decisionRationale?.evidenceFreshnessLine &&
    [QUESTION_INTENT.REASON, QUESTION_INTENT.PLAN, QUESTION_INTENT.GENERIC, QUESTION_INTENT.SUSPECT, QUESTION_INTENT.VOTE].includes(analysis.intent)
  ) {
    lines.push(decisionRationale.evidenceFreshnessLine);
  }
  if (
    decisionRationale?.falsificationCheckLine &&
    [QUESTION_INTENT.REASON, QUESTION_INTENT.PLAN, QUESTION_INTENT.GENERIC, QUESTION_INTENT.SUSPECT, QUESTION_INTENT.VOTE].includes(analysis.intent)
  ) {
    lines.push(decisionRationale.falsificationCheckLine);
  }
  if (
    decisionRationale?.causalChainLine &&
    [QUESTION_INTENT.REASON, QUESTION_INTENT.PLAN, QUESTION_INTENT.GENERIC, QUESTION_INTENT.SUSPECT, QUESTION_INTENT.VOTE].includes(analysis.intent)
  ) {
    lines.push(decisionRationale.causalChainLine);
  }
  if (
    decisionRationale?.assumptionAuditLine &&
    [QUESTION_INTENT.REASON, QUESTION_INTENT.PLAN, QUESTION_INTENT.GENERIC, QUESTION_INTENT.SUSPECT, QUESTION_INTENT.VOTE].includes(analysis.intent)
  ) {
    lines.push(decisionRationale.assumptionAuditLine);
  }
  if (
    decisionRationale?.mechanicSensitivityLine &&
    [QUESTION_INTENT.REASON, QUESTION_INTENT.PLAN, QUESTION_INTENT.GENERIC, QUESTION_INTENT.SUSPECT, QUESTION_INTENT.VOTE].includes(analysis.intent)
  ) {
    lines.push(decisionRationale.mechanicSensitivityLine);
  }
  if (
    decisionRationale?.roleHypothesisLine &&
    [QUESTION_INTENT.REASON, QUESTION_INTENT.PLAN, QUESTION_INTENT.GENERIC, QUESTION_INTENT.SUSPECT, QUESTION_INTENT.VOTE].includes(analysis.intent)
  ) {
    lines.push(decisionRationale.roleHypothesisLine);
  }
  if (
    decisionRationale?.confidenceLine &&
    [QUESTION_INTENT.REASON, QUESTION_INTENT.PLAN, QUESTION_INTENT.GENERIC, QUESTION_INTENT.SUSPECT, QUESTION_INTENT.VOTE].includes(analysis.intent)
  ) {
    lines.push(decisionRationale.confidenceLine);
  }
  if (
    decisionRationale?.reconsiderationLine &&
    [QUESTION_INTENT.REASON, QUESTION_INTENT.PLAN, QUESTION_INTENT.GENERIC, QUESTION_INTENT.SUSPECT, QUESTION_INTENT.VOTE].includes(analysis.intent)
  ) {
    lines.push(decisionRationale.reconsiderationLine);
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
  const spokenWithDeepReasoning = ensurePrivateDeepReasoningInText(pragmaticText, decisionRationale, analysis.intent);

  return {
    response: polishChineseSeatSpacing(ensureEvidenceContractInText(spokenWithDeepReasoning, evidenceContract)),
    focusId: focus.player.id,
    focusScore: focus.score,
    evidenceContract,
    followUpPrompts,
    thoughtFrame: focusedThoughtFrame,
    decisionRationale,
    reasoningContrastLine,
    crossDayStance: stanceMemory?.crossDayStance ?? null,
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

function evilAllianceOtherMinionText(players, variantIndex = 0) {
  if (Array.isArray(players) && players.length > 0) {
    return humanSeatList(players, "暂无");
  }
  return [
    "其他爪牙暂无",
    "暂时没有别的爪牙",
    "旁边爪牙先记空",
    "其他爪牙先不算",
    "爪牙同伴暂时没看到",
  ][Math.abs(variantIndex) % 5];
}

function evilAllianceTeamInfoLine(aiPlayer, demon, minions = [], salt = "") {
  const seed = `${aiPlayer?.id ?? ""}:${demon?.id ?? ""}:${(minions ?? []).map((entry) => entry?.id ?? "").join(",")}:${salt}`;
  if (aiPlayer?.category === "demon") {
    const variants = [
      () => `队伍先对齐：我这边看到的爪牙是${humanSeatList(minions, "没有爪牙位")}。`,
      () => `先把队伍信息放清：爪牙位${humanSeatList(minions, "暂时没有爪牙位")}。`,
      () => `邪恶视角先对底，爪牙位是${humanSeatList(minions, "先记空")}。`,
      () => `我这边的队伍牌面：爪牙${humanSeatList(minions, "暂时没看到")}。`,
    ];
    const index = privateReasonTextVariantIndex(seed, variants.length);
    return variants[index]();
  }
  const otherMinions = (minions ?? []).filter((entry) => entry?.id !== aiPlayer?.id);
  const demonSeat = demon ? `${demon.seatIndex + 1}号` : "未知";
  const variants = [
    (index) => `队伍先对齐：恶魔位${demonSeat}，${evilAllianceOtherMinionText(otherMinions, index)}。`,
    (index) => `我这边知道的底牌：恶魔是${demonSeat}，${evilAllianceOtherMinionText(otherMinions, index)}。`,
    (index) => `先把队伍信息说清，恶魔${demonSeat}，${evilAllianceOtherMinionText(otherMinions, index)}。`,
    (index) => `邪恶视角先对底：恶魔位${demonSeat}，${evilAllianceOtherMinionText(otherMinions, index)}。`,
    (index) => `我这边的队伍牌面：恶魔${demonSeat}，${evilAllianceOtherMinionText(otherMinions, index)}。`,
  ];
  const index = privateReasonTextVariantIndex(seed, variants.length);
  return variants[index](index);
}

function evilAllianceNoBluffCoverPlanLine(focusName = "", salt = "") {
  const target = `${focusName ?? ""}`.trim();
  if (!target) {
    return "";
  }
  const variants = [
    `台面安排：伪装先不锁死，今天把${target}放到火力点，先问身份和夜里信息。`,
    `台面上我先不定死伪装，今天把${target}放到火力点，问身份和夜里信息。`,
    `伪装先留活口，白天先压${target}的身份和夜里信息。`,
    `台面身份边走边补，今天先把${target}放到讨论中心，问身份和夜里信息。`,
    `低信息好人方向先留着，今天把${target}放到火力点。`,
  ];
  return variants[privateReasonTextVariantIndex(`${target}:${salt}`, variants.length)] ?? variants[0];
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
  const runnerUp =
    (focus
      ? ranked.find((entry) => entry.player.id !== focus.player.id && !knownAllyIds.has(entry.player.id)) ??
        ranked.find((entry) => entry.player.id !== focus.player.id)
      : null) ?? null;
  const focusPlayer = focus?.player ?? null;
  const evidence = focusPlayer ? collectEvidence(state, aiPlayer, focusPlayer) : [];
  const focusName = focusPlayer ? statementTargetLabel(state, focusPlayer.id) : "";
  const decisionRationale = focus && buildDecisionRationale
    ? buildDecisionRationale(state, aiPlayer, focus, runnerUp, {
        audience: "private",
        publicOnly: false,
      })
    : null;
  const actualRoleName = roleLabelForSpeech(state, getEffectiveRoleId(aiPlayer) ?? aiPlayer.roleId);
  const bluffRoleId = aiPlayer.publicClaimRoleId || chooseScriptAwareBluffRoleId(state, getKnownBluffRoleIds(state, aiPlayer), rng);
  const bluffName = roleLabelForSpeech(state, bluffRoleId);

  const lines = [
    pickCorpusTemplate("private.evilAlliance.openers", {}, rng, ["自己人，我直接说。"]),
  ];

  lines.push(evilAllianceTeamInfoLine(aiPlayer, demon, minions, `${state.scriptId ?? ""}:${human?.id ?? ""}:${analysis.intent}`));

  if (analysis.intent === QUESTION_INTENT.CLAIM) {
    if (actualRoleName) {
      lines.push(`我真实身份是 ${actualRoleName}。`);
    }
    if (bluffName) {
      aiPlayer.publicClaimRoleId = aiPlayer.publicClaimRoleId || bluffRoleId;
      lines.push(
        focusName
          ? `台面安排：我先往 ${bluffName} 这个方向装，今天把${focusName}放到火力点，你别第一时间替我背书。`
          : pickCorpusTemplate(
              "private.evilAlliance.bluffCover",
              { bluffName },
              rng,
              ["台面上我先往 {bluffName} 这个方向装，你别第一时间替我背书。"]
            )
      );
    } else {
      lines.push(
        focusName
          ? evilAllianceNoBluffCoverPlanLine(focusName, `${state.scriptId ?? ""}:${aiPlayer.id}:${analysis.intent}`)
          : pickCorpusTemplate(
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
    const coverAlreadyNamesPressure =
      analysis.intent === QUESTION_INTENT.CLAIM &&
      focusName &&
      lines.some((line) => `${line ?? ""}`.includes(focusName) && /火力点|先问身份和夜里信息|放到讨论中心|先压/u.test(line));
    lines.push(
      coverAlreadyNamesPressure
        ? `后续看${focusName}能不能接上口径，接不住再决定要不要提。`
        : pickCorpusTemplate(
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

  const response = applySpeechBudget(
    sanitizePrivateDialogueText(lines.filter(Boolean).join(" "), focusPlayer ? statementTargetLabel(state, focusPlayer.id) : ""),
    { audience: "private", maxSentences: 6, maxChars: 360 }
  );
  return {
    ...original,
    response: cleanEvilPrivateCoordinationText(response),
    decisionRationale: decisionRationale ?? original?.decisionRationale ?? null,
  };
}

function cleanEvilPrivateCoordinationText(text) {
  let value = `${text ?? ""}`
    .replace(/^我直接说，(?=.*我直接说。)/u, "")
    .replace(/([0-9]+号)\s+(是个不错的火力点)/gu, "$1$2")
    .replace(/把\s*([0-9]+号)\s*放到/gu, "把$1放到")
    .trim();
  const openQuoteCount = (value.match(/“/gu) ?? []).length;
  const closeQuoteCount = (value.match(/”/gu) ?? []).length;
  if (openQuoteCount > closeQuoteCount) {
    value = `${value.replace(/[。！？；]?$/u, "")}”。`;
  }
  return value;
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
  const response = applyHumanSpeechCadence(state, aiPlayer, composed.response, rng, {
    audience: "private",
    intent: analysis.intent,
    focusId: composed.focusId,
    focusScore: composed.focusScore,
    force: options.sameEvilTeam ? false : undefined,
    maxSentences: options.sameEvilTeam ? 6 : undefined,
    maxChars: options.sameEvilTeam ? 360 : undefined,
  });
  return {
    ...composed,
    response: options.sameEvilTeam ? cleanEvilPrivateCoordinationText(response) : response,
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
      applyExecutionOutcomeSignals(state, aiPlayer);
      applyEvilTwinSignals(state, aiPlayer);
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
  getAIAgent,
  buildAIStrategyContext,
  buildAIThoughtFrame,
  rankTargets,
  resolveStableFocus,
  rememberDayStance,
  crossDayStanceContinuityLine,
  personaThresholdShift,
  buildDialogueEvidenceContract,
  claimDisclosurePlanner,
  publicClaimDisclosureLine,
  attachClaimDisclosureRationaleSpokenLine,
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
  statementTargetLabel,
  buildDecisionRationale,
  buildReasoningContrastLine,
  attachDecisionRationaleSpokenLine,
  renderPublicSurfaceActReadable,
  buildPublicSurfaceAct,
  ensureEvidenceContractInText,
  applyInGamePragmatics,
  applyHumanSpeechCadence,
  applySpeechBudget,
  sanitizePlayerVisibleText,
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
  buildAIStrategyContext,
  buildAgentView,
  buildDialogueEvidenceContract,
  buildDecisionRationale,
  attachDecisionRationaleSpokenLine,
  attachClaimDisclosureRationaleSpokenLine,
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
  crossDayStanceContinuityLine,
  getSharedInfoMemory,
  collectEvidence,
  evidenceReasonText,
  statementTargetLabel,
  dayStanceLabel,
  applyHumanSpeechCadence,
  applySpeechBudget,
  sanitizePrivateDialogueText,
  joinSpeechFragments,
  perceivedRoleForPlayer,
  roleForPlayer,
  isEarlyInfoRole,
  getPlayerById,
  addLog,
  consumePrivateChat,
  predictDialogueSignals,
  recordPrivateWhisperForAgents,
  rememberSharedInfoMemory,
  rememberStatementMemory,
  summarizeSharedInfoRepeat,
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
  const responseEventAnchor = dialogueEventAnchor(state, {
    mode: "whisper-in",
    source: "ai_private_whisper",
    audience: "private",
    speakerId: target.id,
    targetId: human.id,
    visibility: "private",
  });
  const rawComposed = sameEvilTeam
    ? composeEvilAllianceResponse(state, target, human, analysis, rng)
    : composePrivateResponse(state, target, human, analysis, question, memory, rng, {
        agentView: targetView,
        sourceEventAnchor: responseEventAnchor,
      });
  let composed = humanizePrivateComposedResponse(state, target, human, analysis, rawComposed, rng, { sameEvilTeam });
  composed = applyPrivateStatementContinuity(state, target, human, composed, analysis);
  composed = applyPrivateDialogueTurnTaking(state, target, human, composed, analysis, question, memory, { sameEvilTeam });
  composed = ensurePrivateAnswerAlignment(state, target, human, analysis, composed);
  composed = ensurePrivateSynthesisVerificationInComposedResponse(composed);
  composed = ensurePrivateDeepReasoningInComposedResponse(composed, analysis.intent);
  if (composed.decisionRationale) {
    composed = {
      ...composed,
      decisionRationale: attachDecisionRationaleSpokenLine(composed.decisionRationale, composed.response),
    };
  }
  if (composed.claimDisclosureRationale) {
    composed = {
      ...composed,
      claimDisclosureRationale: attachClaimDisclosureRationaleSpokenLine(composed.claimDisclosureRationale, composed.response),
    };
  }
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
    claimDisclosureRationale: composed.claimDisclosureRationale ?? null,
    crossDayStance: composed.crossDayStance ?? null,
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
  if (analysis.intent === QUESTION_INTENT.NIGHT || analysis.intent === QUESTION_INTENT.CLAIM || target.publicClaimRoleId) {
    const infoSummary = summarizeShareablePrivateNotes(target, 2, { state, audience: human })
      .map(humanizeSharedPrivateNote)
      .filter(Boolean)
      .join(" / ");
    rememberSharedInfoMemory(state, target, human, {
      infoSummary,
      claimRoleId: target.publicClaimRoleId ?? "",
      source: "ai_private_whisper",
    });
  }

  pushTimeline(state, {
    mode: "whisper-out",
    speakerId: human.id,
    targetId: target.id,
    text: question,
    intent: analysis.intent,
  });

  pushTimeline(state, {
    id: responseEventAnchor.eventId,
    timestamp: responseEventAnchor.timestamp,
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
    decisionRationale: composed.decisionRationale ?? null,
    claimDisclosureRationale: composed.claimDisclosureRationale ?? null,
    crossDayStance: composed.crossDayStance ?? null,
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
      decisionRationale: composed.decisionRationale ?? null,
      claimDisclosureRationale: composed.claimDisclosureRationale ?? null,
      crossDayStance: composed.crossDayStance ?? null,
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
    decisionRationale: composed.decisionRationale ?? null,
    claimDisclosureRationale: composed.claimDisclosureRationale ?? null,
    crossDayStance: composed.crossDayStance ?? null,
    reasoningContrastLine: composed.reasoningContrastLine ?? "",
    followUp: !!slot.followUp,
    followUpUsed: slot.followUpUsed ?? 0,
    followUpLimit: slot.followUpLimit ?? 2,
    used: slot.used,
    limit: slot.limit,
    remaining: slot.remaining,
  };
}

function roundVoteScore(value) {
  return Number.isFinite(value) ? Math.round(value * 1000) / 1000 : 0;
}

function voteConfidenceBand(vote, margin) {
  if (vote && margin >= 0.12) return "clear-yes";
  if (vote) return "lean-yes";
  if (!vote && margin <= -0.12) return "clear-no";
  return "lean-no";
}

function voteDecisionReasonKey({ vote, canVote, voterPubliclyAlive, evidenceCount, margin, publicReasonMode }) {
  if (!canVote) return "cannot-vote";
  if (!voterPubliclyAlive) return vote ? "ghost-vote-pressure" : "dead-no-ghost-pressure";
  if (publicReasonMode) return publicReasonMode;
  if (vote && evidenceCount > 0) return "evidence-backed-yes";
  if (vote) return "pressure-threshold-yes";
  if (evidenceCount > 0 && margin < 0) return "evidence-below-threshold";
  return "pressure-below-threshold";
}

function voteLineVariantIndex({ voter, nominee, reasonKey, evidenceCount, margin, scriptId = "" }, variantCount) {
  if (!Number.isFinite(variantCount) || variantCount <= 1) {
    return 0;
  }
  const seedText = [
    voter?.id ?? "",
    nominee?.id ?? "",
    voter?.aiPersona ?? PERSONA_TYPES.STEADY,
    reasonKey ?? "",
    scriptId,
    Number.isFinite(evidenceCount) ? evidenceCount : 0,
    Number.isFinite(margin) ? Math.round(margin * 1000) : 0,
  ].join("|");
  let hash = Number.isFinite(voter?.seatIndex) ? voter.seatIndex + 1 : 0;
  for (let index = 0; index < seedText.length; index += 1) {
    hash = (hash * 31 + seedText.charCodeAt(index)) >>> 0;
  }
  return hash % variantCount;
}

function voteLinePerspectivePrefix({ voter } = {}) {
  const publicSeatNumber = Number.isFinite(voter?.seatIndex) ? voter.seatIndex + 1 : Number.parseInt(`${voter?.name ?? ""}`, 10);
  const variants = ["我先", "我这边先", "我这里先"];
  if (Number.isFinite(publicSeatNumber)) {
    return variants[publicSeatNumber % variants.length] ?? variants[0];
  }
  return variants[0];
}

function chooseVoteLineVariant(variants, context) {
  if (!Array.isArray(variants) || variants.length === 0) {
    return "";
  }
  const variant = variants[voteLineVariantIndex(context, variants.length)] ?? variants[0];
  return typeof variant === "function" ? variant(context.nomineeName, context) : `${variant ?? ""}`;
}

function chooseVoteLineVariantByVoterSeat(variants, context, offset = 0) {
  if (!Array.isArray(variants) || variants.length === 0) {
    return "";
  }
  const publicSeatNumber = Number.isFinite(context?.voter?.seatIndex)
    ? context.voter.seatIndex + 1
    : Number.parseInt(`${context?.voter?.name ?? ""}`, 10);
  const index = Number.isFinite(publicSeatNumber)
    ? Math.abs(publicSeatNumber + offset) % variants.length
    : voteLineVariantIndex(context, variants.length);
  const variant = variants[index] ?? variants[0];
  return typeof variant === "function" ? variant(context.nomineeName, context) : `${variant ?? ""}`;
}

function isNearVoteMargin(margin) {
  return Number.isFinite(margin) && Math.abs(margin) <= 0.04;
}

function buildVoteRationaleLine({ voter, nominee, vote, canVote, evidenceCount, margin, reasonKey, scriptId = "" }) {
  const nomineeName = nominee?.name ?? "这个提名";
  const context = { voter, nominee, nomineeName, reasonKey, evidenceCount, margin, scriptId };
  if (reasonKey === "ghost-vote-pressure") {
    return chooseVoteLineVariant(
      [
        (name) => `我用鬼票投 ${name}，这张投票要换处决信息。`,
        (name) => `这张鬼票我给 ${name}，票型需要把压力落到公开处决线。`,
        (name) => `我剩这张鬼票就投 ${name}，票型也该给答案。`,
      ],
      context
    );
  }
  if (reasonKey === "table-balance-no") {
    return chooseVoteLineVariant(
      [
        (name) => `我先不投 ${name}，台面票型别只堆一处，先把第二压力位也讲清。`,
        (name) => `这票我先放下 ${name}，现在更需要看旁边压力和公开回应怎么动。`,
        (name) => `我不跟 ${name} 这票，先让桌面把第二压力位和票型理由讲清楚。`,
      ],
      context
    );
  }
  if (reasonKey === "execution-window-yes") {
    return chooseVoteLineVariant(
      [
        (name) => `我会投 ${name}，现在到了执行窗口，票型得给答案。`,
        (name) => `这票我跟 ${name}，不是空压，是看谁愿意把投票流程推到底。`,
        (name) => `我举 ${name}，到这个投票窗口不能只留压力不落票。`,
      ],
      context
    );
  }
  if (canVote && vote && evidenceCount > 0 && isNearVoteMargin(margin)) {
    return chooseVoteLineVariant(
      [
        (name) => `我会投 ${name}，证据刚好过线，但这是贴线票，不是锁死。`,
        (name) => `这票我勉强跟 ${name}，线索够落票，但只刚过我的线。`,
        (name) => `我先举 ${name}，公开证据压过一点点，防守补得上我会回看。`,
      ],
      context
    );
  }
  if (canVote && !vote && evidenceCount > 0 && isNearVoteMargin(margin)) {
    return chooseVoteLineVariant(
      [
        (name) => `我先不投 ${name}，线索差一点过线，还缺能落票的公开证据。`,
        (name) => `这票我先压住，${name}证据几乎到线，但还没够处决。`,
        (name) => `我暂时不举 ${name}，证据牵到了，还差一句能落票的解释。`,
      ],
      context
    );
  }
  if (canVote && vote && isNearVoteMargin(margin)) {
    return chooseVoteLineVariant(
      [
        (name) => `我会投票给 ${name}，但这是贴线票，不是锁死。`,
        (name) => `这票我勉强跟 ${name}，刚过我的线，主要看票型怎么站。`,
        (name) => `我先举 ${name}，但这票很贴线，防守回应补得上我会回看。`,
      ],
      context
    );
  }
  if (canVote && !vote && isNearVoteMargin(margin)) {
    return chooseVoteLineVariant(
      [
        (name) => `我先不投票给 ${name}，差一点过线，先听最后一轮解释。`,
        (name) => `这票我先压住，${name}票型几乎到线，但还没够。`,
        (name) => `我暂时不举 ${name}，这票型很贴线，还差一句能落票的公开解释。`,
      ],
      context
    );
  }
  if (!canVote) {
    return chooseVoteLineVariant(
      [
        (name) => `我这轮不能投票，${name}先按弃权处理。`,
        (name) => `我现在没有可用投票，${name}这票不计我。`,
        (name) => `这轮我举不了手，${name}这票先让能投票的人表态。`,
      ],
      context
    );
  }
  if (vote && evidenceCount >= 2) {
    return chooseVoteLineVariant(
      [
        (name) => `我会投 ${name}，身份和票型两条线都压到了处决线。`,
        (name) => `这票我跟 ${name}，不止一条公开线索指过去，够落票。`,
        (name) => `我举 ${name}，多条证据合在一起，今天不能只停在讨论。`,
      ],
      context
    );
  }
  if (!vote && evidenceCount >= 2) {
    if (evidenceCount >= 5) {
      return chooseVoteLineVariantByVoterSeat(
        [
          (name) => `${name}这边线索不少，我会继续压，但还差能落处决的闭环。`,
          (name) => `我先不举 ${name}，多条证据够追问，处决闭环还没补齐。`,
          (name) => `${name}不是被放过，是证据还停在压力位，先别急着落死票。`,
          (name) => `我把 ${name} 留在主压力位，但现在只够追问，不够处决。`,
          (name) => `${name}有多条线索要解释，我先留票，等防守补闭环。`,
          (name) => `这轮先不出 ${name}，证据多但还没连成能落票的结论。`,
          (name) => `我继续压 ${name}，但这票先不落，缺的是最后一段公开解释。`,
          (name) => `${name}还在压力位，不是处决位；多条线索先换回应。`,
        ],
        context
      );
    }
    return chooseVoteLineVariant(
      [
        (name) => `我先不投 ${name}，两条线索够讨论，但还没合成处决票。`,
        (name) => `这票我先放下 ${name}，公开证据不止一条，强度还差一点。`,
        (name) => `我不举 ${name}，多条证据能进压力位，还没够落票。`,
        (name) => `${name}这边多条证据我会继续压，但这轮先不把票落死。`,
        (name, variantContext) => `${voteLinePerspectivePrefix(variantContext)}压住这票，${name}有多条证据线要解释，还没到处决线。`,
        (name) => `我不跟 ${name} 这票，多条证据能问出东西，但还差落票强度。`,
        (name) => `这轮先不出 ${name}，两条线索先放台面问清。`,
      ],
      context
    );
  }
  if (vote && evidenceCount > 0) {
    if (scriptId === "bmr") {
      return chooseVoteLineVariant(
        [
          (name) => `我会投 ${name}，BMR里死亡和保护链也要靠票型验清。`,
          (name) => `${name}这票我会举，死亡/保护口径和公开证据已经压到一起。`,
          (name) => `我跟 ${name}，这局死亡、保护和票型都需要给处决信息。`,
        ],
        context
      );
    }
    if (scriptId === "snv") {
      return chooseVoteLineVariant(
        [
          (name) => `我会投 ${name}，SnV里身份线和疯狂压力已经压到公开证据上。`,
          (name) => `${name}这票我会举，身份口径、疯狂压力和票型要一起验。`,
          (name) => `我跟 ${name}，这局不能让身份线和疯狂压力只停在口头解释。`,
        ],
        context
      );
    }
    return chooseVoteLineVariant(
      [
        (name) => `我会投 ${name}，证据和票面已经压过我的线。`,
        (name) => `这票我跟，${name} 的线索够进处决。`,
        (name) => `我举 ${name}，现在不是空压，证据已经够落票。`,
        (name) => `${name}这轮我会投，公开压力和证据都到位了。`,
      ],
      context
    );
  }
  if (vote) {
    return chooseVoteLineVariant(
      [
        (name) => `我会投 ${name}，先用这票把处决信息打出来。`,
        (name) => `这票我跟 ${name}，今天需要有人进处决压力。`,
        (name) => `我举 ${name}，先让票型给我们更多信息。`,
      ],
      context
    );
  }
  if (evidenceCount > 0) {
    return chooseVoteLineVariant(
      [
        (name) => `我先不投 ${name}，证据够进讨论，还没够到处决。`,
        (name) => `这票我先放下，${name}有压力，但还差一层能落票的公开证据。`,
        (name) => `我不跟这票，${name}要解释，但现在不是处决点。`,
        (name) => `我先不举 ${name}，线索牵到了，但防守还得再听一轮。`,
        (name) => `我暂时不投 ${name}，这更像压力位，还没到出人的线。`,
      ],
      context
    );
  }
  return chooseVoteLineVariant(
    [
      (name) => `我先不投 ${name}，现在压力还没到必须处决。`,
      (name) => `这票我先放过 ${name}，台面证据还不够。`,
      (name) => `我不举 ${name}，现在更该继续问信息。`,
    ],
    context
  );
}

function currentNominationDefenseVoteContext(state, nominee) {
  if (!state || !nominee?.id) {
    return null;
  }
  const activeDebate = state.dayStageMeta?.nominationDebate;
  const debates = [activeDebate, ...(state.events?.nominationDebates ?? []).slice().reverse()].filter(Boolean);
  const debate = debates.find((entry) => entry?.nomineeId === nominee.id && (entry.day ?? state.day ?? 0) === (state.day ?? 0));
  const nomineeLine = debate?.lines?.find((line) => line.role === "nominee") ?? null;
  const defenseText = nomineeLine?.pending ? "" : nomineeLine?.text ?? "";
  const reasonText = debate?.reason ?? debate?.lines?.find((line) => line.role === "nominator")?.text ?? "";
  if (!defenseText) {
    return null;
  }
  return {
    kind: "nomination-defense-vote-context",
    nomineeId: nominee.id,
    line: shortReasonText(defenseText, 56),
    reasonLine: reasonText ? nominationReasonVoteAnchorFragment(reasonText) : "",
    humanNominee: !!nominee.isHuman,
    hasVoteThreshold: /补不上|对不上|验不上|接不上|锁票|上票|降压/.test(defenseText),
    counterPressure: /反看|只推票|只催落票|直接催票|这条也要记|推进也要记|提名者/.test(defenseText),
  };
}

function nominationDefenseThresholdShift(nominationDefenseContext, strategyContext = null) {
  if (!nominationDefenseContext?.humanNominee) {
    return 0;
  }
  if (strategyContext?.window?.mustExecute) {
    return 0.035;
  }
  return nominationDefenseContext.hasVoteThreshold ? 0.045 : 0.08;
}

function publicCaseEvidenceCountForVotePressure(state, voter, nominee) {
  const currentDay = state?.day ?? 0;
  return getDialogueEvidenceForTarget(state, voter, nominee.id, { publicOnly: true, includePrivate: false })
    .filter((entry) => (entry.day ?? currentDay) === currentDay)
    .filter((entry) => !["nomination", "vote"].includes(entry.kind))
    .length;
}

function currentNominationProcedurePressure(state, voter, nominee) {
  if (!state || !voter?.id || !nominee?.id || voter.id === nominee.id) {
    return { active: false, suspicionBoost: 0, evidenceCount: 0 };
  }
  const currentDay = state.day ?? 0;
  const nominationEvidence = getAgentEvidence(state, voter, { kind: "nomination", targetId: nominee.id })
    .filter((entry) => (entry.day ?? currentDay) === currentDay && entry.payload?.nomineeId === nominee.id)
    .at(-1);
  if (!nominationEvidence) {
    return { active: false, suspicionBoost: 0, evidenceCount: 0 };
  }

  const nominatorId = nominationEvidence.payload?.nominatorId ?? "";
  const nominator = getPlayerById(state, nominatorId);
  const aliveCount = getPubliclyAlivePlayers(state).length;
  const gameWindow = evaluateGameWindow(state, voter, { stage: "nomination" });
  const priorNoExecutionVoteDays = Number(
    gameWindow?.priorNoExecutionVoteDays ?? countPriorNoExecutionVoteDays(state, currentDay)
  ) || 0;
  const failedVotesToday = currentDayVoteState(state).failedVotes;
  const publicCaseEvidenceCount = nominator?.isHuman
    ? publicCaseEvidenceCountForVotePressure(state, voter, nominee)
    : 0;
  let suspicionBoost = 0.08;
  if (nominator?.isHuman) {
    suspicionBoost += 0.06;
    if (publicCaseEvidenceCount > 0) {
      suspicionBoost += Math.min(0.2, 0.11 + publicCaseEvidenceCount * 0.09);
    }
  }
  if (aliveCount <= 5) suspicionBoost += 0.15;
  if (aliveCount <= 3) suspicionBoost += 0.06;
  if ((state.day ?? 0) >= 3) suspicionBoost += 0.04;
  if (gameWindow?.mustExecute && priorNoExecutionVoteDays >= 2) {
    suspicionBoost += Math.min(0.12, priorNoExecutionVoteDays * 0.035);
  }
  if ((state.scriptId === "snv" || gameWindow?.mustExecute) && failedVotesToday >= 2) {
    suspicionBoost += Math.min(0.12, failedVotesToday * 0.035);
  }
  const executionCandidate = currentExecutionCandidateContext(state);
  if (executionCandidate?.active && executionCandidate.nomineeId !== nominee.id) suspicionBoost += 0.08;
  if (areKnownAllies(state, voter, nominee)) suspicionBoost *= 0.25;

  return {
    active: true,
    kind: "nomination-procedure-pressure",
    nomineeId: nominee.id,
    nominatorId,
    humanNominator: !!nominator?.isHuman,
    aliveCount,
    failedVotesToday,
    publicCaseEvidenceCount,
    suspicionBoost: clamp(suspicionBoost, 0.02, 0.36),
    evidenceCount: 1,
    evidenceId: nominationEvidence.id ?? "",
  };
}

function nominationDefenseVoteVariantIndex({ voter, nominee, vote, nominationDefenseContext, reasonKey, evidenceCount, margin, scriptId = "" }, variantCount) {
  if (!Number.isFinite(variantCount) || variantCount <= 1) {
    return 0;
  }
  const publicSeatNumber = Number.isFinite(nominee?.seatIndex) ? nominee.seatIndex + 1 : Number.parseInt(`${nominee?.name ?? ""}`, 10);
  if (Number.isFinite(publicSeatNumber)) {
    const scriptOffset = scriptId === "snv" ? 2 : scriptId === "bmr" ? 1 : 0;
    return (publicSeatNumber + (vote ? 0 : 1) + scriptOffset) % variantCount;
  }
  const seedText = [
    voter?.id ?? "",
    nominee?.id ?? "",
    nominee?.aiPersona ?? PERSONA_TYPES.STEADY,
    vote ? "yes" : "no",
    reasonKey ?? "",
    scriptId,
    nominationDefenseContext?.reasonLine ?? "",
    Number.isFinite(evidenceCount) ? evidenceCount : 0,
    Number.isFinite(margin) ? Math.round(margin * 1000) : 0,
  ].join("|");
  let hash = Number.isFinite(nominee?.seatIndex) ? nominee.seatIndex + 7 : 3;
  for (let index = 0; index < seedText.length; index += 1) {
    hash = (hash * 33 + seedText.charCodeAt(index)) >>> 0;
  }
  return hash % variantCount;
}

function chooseNominationDefenseVoteVariant(variants, context) {
  if (!Array.isArray(variants) || variants.length === 0) {
    return "";
  }
  const variant = variants[nominationDefenseVoteVariantIndex(context, variants.length)] ?? variants[0];
  return typeof variant === "function" ? variant(context) : `${variant ?? ""}`;
}

function buildNominationDefenseAwareVoteLine(
  baseLine,
  { voter, nominee, vote, nominationDefenseContext = null, reasonKey, evidenceCount, margin, scriptId = "" } = {}
) {
  if (!nominationDefenseContext?.line) {
    return baseLine;
  }
  const nomineeName = nominee?.name ?? "这个提名";
  const reasonLine = nominationDefenseContext.reasonLine ?? "";
  if (!reasonLine) {
    const fallbackDefenseRead = vote
      ? `刚才 ${nomineeName} 的防守还没把身份、信息或票型对上，所以这票继续落。`
      : `刚才 ${nomineeName} 的防守给了可复核方向，我先降压不落票。`;
    return baseLine.includes(fallbackDefenseRead) ? baseLine : `${fallbackDefenseRead} ${baseLine}`;
  }
  const context = { voter, nominee, nomineeName, vote, nominationDefenseContext, reasonLine, reasonKey, evidenceCount, margin, scriptId };
  const noVoteDefenseVariants = scriptId === "snv"
    ? [
      ({ nomineeName: name, reasonLine: reason }) =>
        `SnV里先回到提名理由「${reason}」；刚才 ${name} 的防守给了可复核方向，我先降压不落票，继续看身份线和疯狂压力能不能对上。`,
      ({ nomineeName: name, reasonLine: reason }) =>
        `这票按提名理由「${reason}」先降压；刚才 ${name} 的防守给了可复核方向，SnV里还要把身份口径和疯狂压力拆开验。`,
      ({ nomineeName: name, reasonLine: reason }) =>
        `我先不把 SnV 这票落死，提名理由「${reason}」还要验；刚才 ${name} 的防守给了可复核方向，先降压不落票。`,
    ]
    : scriptId === "bmr"
    ? [
      ({ nomineeName: name, reasonLine: reason }) =>
        `BMR里先回到提名理由「${reason}」；刚才 ${name} 的防守给了可复核方向，我先降压不落票，等死亡和保护链再补一层。`,
      ({ nomineeName: name, reasonLine: reason }) =>
        `这票按提名理由「${reason}」先降压；刚才 ${name} 的防守给了可复核方向，BMR里还要看死亡/保护口径能不能接上。`,
      ({ nomineeName: name, reasonLine: reason }) =>
        `我先不把 BMR 这票落死，提名理由「${reason}」还要验；刚才 ${name} 的防守给了可复核方向，先降压不落票。`,
    ]
    : [
      ({ nomineeName: name, reasonLine: reason }) =>
        `提名理由点的是「${reason}」；刚才 ${name} 的防守给了可复核方向，我先降压不落票。`,
      ({ nomineeName: name, reasonLine: reason }) =>
        `先回到提名理由「${reason}」；刚才 ${name} 的防守给了可复核方向，我先降压不落票。`,
      ({ nomineeName: name, reasonLine: reason }) =>
        `这轮我对照提名理由「${reason}」；刚才 ${name} 的防守给了可复核方向，先降压不落票。`,
    ];
  const defenseRead = vote
    ? chooseNominationDefenseVoteVariant(
        [
          ({ nomineeName: name, reasonLine: reason }) =>
            `提名理由点的是「${reason}」；刚才 ${name} 的防守还没把身份、信息或票型对上，所以这票继续落。`,
          ({ nomineeName: name, reasonLine: reason }) =>
            `这票先回到提名理由「${reason}」；刚才 ${name} 的防守没把身份、信息或票型对上，所以这票继续落。`,
          ({ nomineeName: name, reasonLine: reason }) =>
            `我按提名理由「${reason}」看；刚才 ${name} 的防守还没把身份、信息或票型对上，这票继续落。`,
        ],
        context
      )
    : chooseNominationDefenseVoteVariant(noVoteDefenseVariants, context);
  if (baseLine.includes(defenseRead)) {
    return baseLine;
  }
  return `${defenseRead} ${baseLine}`;
}

function buildVoteRationale({
  voter,
  nominee,
  vote,
  canVote,
  voterPubliclyAlive,
  suspicion,
  threshold,
  evidenceCount,
  memoryShift,
  strategyShift,
  publicReasonMode,
  nominationDefenseContext = null,
  nominationProcedurePressure = null,
  scriptId = "",
}) {
  const margin = roundVoteScore((Number.isFinite(suspicion) ? suspicion : 0) - (Number.isFinite(threshold) ? threshold : 0));
  const reasonKey = voteDecisionReasonKey({ vote, canVote, voterPubliclyAlive, evidenceCount, margin, publicReasonMode });
  const line = buildNominationDefenseAwareVoteLine(
    buildVoteRationaleLine({ voter, nominee, vote, canVote, evidenceCount, margin, reasonKey, scriptId }),
    { voter, nominee, vote, nominationDefenseContext, reasonKey, evidenceCount, margin, scriptId }
  );
  const polishedLine = polishChineseSeatSpacing(line);
  return {
    kind: "vote-rationale",
    audience: "vote",
    publicOnly: true,
    voterId: voter?.id ?? "",
    voterName: voter?.name ?? "",
    nomineeId: nominee?.id ?? "",
    nomineeName: nominee?.name ?? "",
    vote: !!vote,
    canVote: !!canVote,
    suspicion: roundVoteScore(suspicion),
    threshold: roundVoteScore(threshold),
    margin,
    evidenceCount: Number.isFinite(evidenceCount) ? evidenceCount : 0,
    memoryShift: roundVoteScore(memoryShift),
    strategyShift: roundVoteScore(strategyShift),
    reasonKey,
    confidenceBand: voteConfidenceBand(vote, margin),
    nominationDefenseContext,
    nominationProcedurePressure,
    line: polishedLine,
  };
}

function protectsKnownCurrentDemon(state, voter, nominee) {
  if (!state || !voter || !nominee || nominee.alive === false || nominee.category !== "demon") {
    return false;
  }
  if (voter.id === nominee.id && voter.team === "evil") {
    return true;
  }
  const agent = getAIAgent(state, voter);
  return agent?.knownDemonId === nominee.id;
}

function canEvilNominateTarget(state, aiPlayer, target, strategyContext) {
  if (protectsKnownCurrentDemon(state, aiPlayer, target)) {
    return false;
  }
  if (!areKnownAllies(state, aiPlayer, target)) {
    return true;
  }
  return strategyContext?.evilWorldPlan?.sacrificeAllyId === target?.id;
}

function publicVoteEvidenceCount(state, voter, nominee, strategyContext = null) {
  if (!nominee?.id) {
    return 0;
  }
  const targetContext = strategyContext?.target ?? null;
  if (Number.isFinite(targetContext?.publicEvidenceCount)) {
    return targetContext.publicEvidenceCount;
  }
  if (Number.isFinite(targetContext?.totalEvidenceCount)) {
    return targetContext.totalEvidenceCount;
  }
  const agentView = buildAgentView(state, voter, { audience: "public", targetId: nominee.id });
  if (agentView?.evidenceCountForTarget) {
    return agentView.evidenceCountForTarget(nominee.id, { publicOnly: true, includePrivate: false });
  }
  return getDialogueEvidenceForTarget(state, voter, nominee.id, { publicOnly: true, includePrivate: false }).length;
}

function publicVoteSuspicionForScoring(state, voter, nominee) {
  if (!nominee?.id) {
    return 0.5;
  }
  const rawSuspicion = Number(voter?.suspicion?.[nominee.id]);
  const trail = getSuspicionTrailForTarget(state, voter, nominee.id);
  const hasAuditedPublicInputs = trail.length > 0 || !!voter?.dialogueBiasMeta?.[nominee.id];
  if (!hasAuditedPublicInputs && Number.isFinite(rawSuspicion)) {
    return nominee.id === voter?.id ? 0.01 : clamp(rawSuspicion, 0.08, 0.88);
  }
  return publicBaseTargetScore(state, voter, nominee);
}

export function decideAIVoteWithRationale(voter, nominee, state, rng = Math.random) {
  if (!voter || !nominee) {
    return { vote: false, voteRationale: buildVoteRationale({ voter, nominee, vote: false, canVote: false }) };
  }

  const suspicion = publicVoteSuspicionForScoring(state, voter, nominee);
  const scriptId = `${state?.scriptId ?? ""}`;
  const strategyContext = buildAIStrategyContext(state, voter, {
    audience: "public",
    stage: "nomination",
    targetId: nominee.id,
  });
  const nominationDefenseContext = currentNominationDefenseVoteContext(state, nominee);
  const nominationProcedurePressure = currentNominationProcedurePressure(state, voter, nominee);
  const basePublicEvidenceCount = publicVoteEvidenceCount(state, voter, nominee, strategyContext);
  const voteSuspicion = clamp(suspicion + (nominationProcedurePressure.suspicionBoost ?? 0), 0.01, 0.99);
  const voterPubliclyAlive = registersAsAlive(state, voter);
  if (!voterPubliclyAlive && !voter.ghostVoteAvailable) {
    return {
      vote: false,
      voteRationale: buildVoteRationale({
        voter,
        nominee,
        vote: false,
        canVote: false,
        voterPubliclyAlive,
        suspicion,
        threshold: 1,
        evidenceCount: 0,
        memoryShift: 0,
        strategyShift: 0,
        nominationDefenseContext,
        nominationProcedurePressure,
        scriptId,
      }),
    };
  }

  if (voter.team === "evil") {
    if (protectsKnownCurrentDemon(state, voter, nominee)) {
      return {
        vote: false,
        voteRationale: buildVoteRationale({
          voter,
          nominee,
          vote: false,
          canVote: true,
          voterPubliclyAlive,
          suspicion: voteSuspicion,
          threshold: voterPubliclyAlive ? 1 : 1.1,
          evidenceCount: 0,
          memoryShift: 0,
          strategyShift: 0,
          publicReasonMode: "table-balance-no",
          nominationDefenseContext,
          nominationProcedurePressure,
          scriptId,
        }),
      };
    }
    if (areKnownAllies(state, voter, nominee)) {
      const threshold = voterPubliclyAlive ? 0.9 : 0.98;
      const vote = voteSuspicion > 0.9 && rng() < 0.08;
      return {
        vote,
        voteRationale: buildVoteRationale({
          voter,
          nominee,
          vote,
          canVote: true,
          voterPubliclyAlive,
          suspicion: voteSuspicion,
          threshold,
          evidenceCount: 0,
          memoryShift: 0,
          strategyShift: 0,
          publicReasonMode: vote ? "execution-window-yes" : "table-balance-no",
          nominationDefenseContext,
          nominationProcedurePressure,
          scriptId,
        }),
      };
    }
    const persona = voter.aiPersona ?? PERSONA_TYPES.STEADY;
    const shift = personaThresholdShift(persona) + personaStrategyProfile(persona).voteShift;
    const memoryShift = publicStatementVoteThresholdShift(state, voter, nominee);
    const evidenceCount = basePublicEvidenceCount + (nominationProcedurePressure.evidenceCount ?? 0);
    const strategyShift = voteThresholdAdjustment(strategyContext, {
      suspicion: voteSuspicion,
      evidenceCount,
      isKnownAlly: false,
      voterPubliclyAlive,
      currentDayFailedVotes: currentDayVoteState(state).failedVotes,
    });
    const threshold = voterPubliclyAlive ? 0.43 + shift + memoryShift + strategyShift : 0.56 + shift + memoryShift + strategyShift;
    const vote = voteSuspicion >= threshold;
    return {
      vote,
      voteRationale: buildVoteRationale({
        voter,
        nominee,
        vote,
        canVote: true,
        voterPubliclyAlive,
        suspicion: voteSuspicion,
        threshold,
        evidenceCount,
        memoryShift,
        strategyShift,
        nominationDefenseContext,
        nominationProcedurePressure,
        scriptId,
      }),
    };
  }

  const persona = voter.aiPersona ?? PERSONA_TYPES.STEADY;
  const evidenceCount = basePublicEvidenceCount;
  const voteEvidenceCount = evidenceCount + (nominationProcedurePressure.evidenceCount ?? 0);
  const strategicShift =
    personaStrategyProfile(persona).voteShift -
    (voteEvidenceCount > 0 && persona === PERSONA_TYPES.PRESSURE ? 0.025 : 0);
  const shift = personaThresholdShift(persona) + strategicShift;
  const memoryShift = publicStatementVoteThresholdShift(state, voter, nominee);
  const strategyShift = voteThresholdAdjustment(strategyContext, {
    suspicion: voteSuspicion,
    evidenceCount: voteEvidenceCount,
    voterPubliclyAlive,
    currentDayFailedVotes: currentDayVoteState(state).failedVotes,
  });
  const defenseShift = nominationDefenseThresholdShift(nominationDefenseContext, strategyContext);
  const threshold = voterPubliclyAlive
    ? 0.58 + shift + memoryShift + strategyShift + defenseShift
    : 0.69 + shift + memoryShift + strategyShift + defenseShift;
  const vote = voteSuspicion >= threshold;
  return {
    vote,
    voteRationale: buildVoteRationale({
      voter,
      nominee,
      vote,
      canVote: true,
      voterPubliclyAlive,
      suspicion: voteSuspicion,
      threshold,
      evidenceCount: voteEvidenceCount,
      memoryShift,
      strategyShift: strategyShift + defenseShift,
      nominationDefenseContext,
      nominationProcedurePressure,
      scriptId,
    }),
  };
}

export function decideAIVote(voter, nominee, state, rng = Math.random) {
  return !!decideAIVoteWithRationale(voter, nominee, state, rng).vote;
}

function expectedSupportFor(state, nomineeId) {
  const nominee = getPlayerById(state, nomineeId);
  if (!nominee) {
    return 0;
  }
  return getPubliclyAlivePlayers(state)
    .filter((voter) => !voter.isHuman)
    .reduce((sum, voter) => {
    if (decideAIVote(voter, nominee, state, () => 0.4)) {
      return sum + 1;
    }
    return sum;
    }, 0);
}

function currentExecutionCandidateContext(state) {
  const candidate = state?.dayStageMeta?.executionCandidate ?? null;
  if (!candidate || candidate.day !== (state?.day ?? 0) || !candidate.nomineeId) {
    return null;
  }
  const nominee = getPlayerById(state, candidate.nomineeId);
  if (!nominee || !registersAsAlive(state, nominee)) {
    return null;
  }
  const yesVotes = Number(candidate.yesVotes ?? 0) || 0;
  return {
    active: true,
    nomineeId: candidate.nomineeId,
    nomineeName: nominee.name ?? candidate.nomineeId,
    yesVotes,
    threshold: Number(candidate.threshold ?? 0) || 0,
    requiredYesVotes: yesVotes + 1,
  };
}

function eligibleVoteCountForNomination(state) {
  return (state?.players ?? []).reduce((sum, voter) => {
    if (registersAsAlive(state, voter) || voter.ghostVoteAvailable) {
      return sum + 1;
    }
    return sum;
  }, 0);
}

function shouldHoldStrongExecutionCandidate(state) {
  const context = currentExecutionCandidateContext(state);
  if (!context?.active) {
    return false;
  }
  const eligibleVoteCount = eligibleVoteCountForNomination(state);
  if (eligibleVoteCount <= 0) {
    return true;
  }
  const strongVoteLine = Math.max(context.threshold + 2, eligibleVoteCount - 3);
  return context.yesVotes >= strongVoteLine;
}

function proposalWithOvertakePlan(state, proposal) {
  const context = currentExecutionCandidateContext(state);
  if (!proposal || !context) {
    return proposal ? { ...proposal, overtakePlan: { active: false } } : proposal;
  }
  const projectedYesVotes = estimateFormalNominationYesVotes(state, proposal);
  const projectedExpectedYesVotes = Number(
    proposal.coalition?.expectedYesVotes ?? proposal.expectedSupport ?? projectedYesVotes
  ) || 0;
  const eligibleVoteCount = eligibleVoteCountForNomination(state);
  const requiresStrongConsensusOvertake = eligibleVoteCount >= 7 && context.requiredYesVotes >= eligibleVoteCount - 2;
  const canOvertake =
    proposal.nomineeId !== context.nomineeId &&
    projectedYesVotes >= context.requiredYesVotes &&
    (!requiresStrongConsensusOvertake || projectedExpectedYesVotes >= context.requiredYesVotes);
  const margin = projectedYesVotes - context.yesVotes;
  return {
    ...proposal,
    overtakePlan: {
      active: true,
      currentNomineeId: context.nomineeId,
      currentNomineeName: context.nomineeName,
      currentYesVotes: context.yesVotes,
      requiredYesVotes: context.requiredYesVotes,
      eligibleVoteCount,
      requiresStrongConsensusOvertake,
      projectedYesVotes: Math.round(projectedYesVotes * 10) / 10,
      projectedExpectedYesVotes: Math.round(projectedExpectedYesVotes * 10) / 10,
      canOvertake,
      margin: Math.round(margin * 10) / 10,
    },
  };
}

function nominationProposalCanMatter(state, proposal) {
  const overtakePlan = proposal?.overtakePlan ?? proposalWithOvertakePlan(state, proposal)?.overtakePlan;
  if (!overtakePlan?.active) {
    return true;
  }
  return !!overtakePlan.canOvertake;
}

function currentDayVoteState(state) {
  const day = state?.day ?? 0;
  const votes = (state?.events?.votes ?? []).filter((entry) => entry.day === day);
  return {
    votes,
    failedVotes: votes.filter((entry) => !entry.passed).length,
    passedVotes: votes.filter((entry) => !!entry.passed).length,
    executionCandidate: currentExecutionCandidateContext(state),
  };
}

function proposalLikelyExecutes(proposal) {
  const threshold = Number(proposal?.coalition?.threshold ?? proposal?.gameWindow?.voteThreshold ?? 0) || 0;
  const expectedSupport = Number(proposal?.coalition?.expectedYesVotes ?? proposal?.expectedSupport ?? proposal?.support ?? 0) || 0;
  return !!proposal?.coalition?.likelyPasses || (threshold > 0 && expectedSupport >= threshold);
}

function failedPressureNominationBudget(state) {
  const day = state?.day ?? 1;
  if (state?.scriptId === "bmr") {
    return day <= 1 ? 4 : 2;
  }
  return day <= 1 ? 4 : 3;
}

function proposalHasUrgentExecutableWindow(state, proposal) {
  const window = proposal?.gameWindow ?? proposal?.strategyContext?.window ?? null;
  const noExecutionRisk = Number(proposal?.strategyContext?.goodDayStrategy?.noExecutionRisk ?? 0) || 0;
  const intent = proposal?.strategyIntent ?? "";
  const threshold = Number(proposal?.coalition?.threshold ?? proposal?.gameWindow?.voteThreshold ?? 0) || 0;
  const projectedFormalYesVotes = threshold > 0 ? estimateFormalNominationYesVotes(state, proposal) : 0;
  const urgent =
    !!window?.mustExecute ||
    noExecutionRisk >= 0.36 ||
    intent === "execution-push" ||
    intent === "good-avoid-no-execution";
  return urgent && (proposalLikelyExecutes(proposal) || (threshold > 0 && projectedFormalYesVotes >= threshold));
}

function shouldSpendNominationAfterFailedPressure(state, proposal) {
  if (!proposal) {
    return false;
  }
  const voteState = currentDayVoteState(state);
  const failedPressureBudget = failedPressureNominationBudget(state);
  if (voteState.executionCandidate?.active || voteState.passedVotes > 0 || voteState.failedVotes < failedPressureBudget) {
    return true;
  }
  if (proposal.overtakePlan?.canOvertake || proposal.evilDeflectionPlan?.active) {
    return true;
  }
  if (state?.scriptId !== "bmr" && proposalHasUrgentExecutableWindow(state, proposal)) {
    return true;
  }
  return false;
}

function currentOnBlockEvilAllyThreat(state, aiPlayer) {
  if (!state || !aiPlayer || aiPlayer.team !== "evil") {
    return null;
  }
  const context = currentExecutionCandidateContext(state);
  if (!context?.active) {
    return null;
  }
  const nominee = getPlayerById(state, context.nomineeId);
  if (!nominee) {
    return null;
  }
  const protectsSelf = nominee.id === aiPlayer.id;
  const protectsKnownAlly = areKnownAllies(state, aiPlayer, nominee);
  if (!protectsSelf && !protectsKnownAlly) {
    return null;
  }
  return {
    ...context,
    protectedNomineeId: nominee.id,
    protectedNomineeName: nominee.name,
    protectedCategory: nominee.category,
    protectedRoleId: nominee.roleId,
    protectsSelf,
    critical: nominee.category === "demon" || getPubliclyAlivePlayers(state).length <= 5,
  };
}

function estimateFormalNominationYesVotes(state, proposal) {
  if (!state || !proposal?.nomineeId) {
    return 0;
  }
  const projectedState = typeof structuredClone === "function"
    ? structuredClone(state)
    : JSON.parse(JSON.stringify(state));
  const nominee = getPlayerById(projectedState, proposal.nomineeId);
  if (!nominee) {
    return 0;
  }
  projectedState.players
    .filter((player) => !player.isHuman)
    .forEach((viewer) => {
      addAgentObservation(projectedState, viewer.id, {
        kind: "nomination",
        source: "public-procedure",
        private: false,
        text: `${proposal.nominatorId} nominated ${proposal.nomineeId}.`,
        payload: {
          nominatorId: proposal.nominatorId,
          nomineeId: proposal.nomineeId,
          targetId: proposal.nomineeId,
        },
      });
    });

  return projectedState.players.reduce((sum, voter) => {
    const publiclyAlive = registersAsAlive(projectedState, voter);
    const canVote = publiclyAlive || voter.ghostVoteAvailable;
    if (!canVote) {
      return sum;
    }
    if (voter.isHuman) {
      return sum + 1;
    }
    if (voter.id === proposal.nominatorId) {
      return sum + 1;
    }
    return sum + (decideAIVoteWithRationale(voter, nominee, projectedState, () => 0.4).vote ? 1 : 0);
  }, 0);
}

function nominationThreshold(state) {
  const aliveCount = getPubliclyAlivePlayers(state).length;
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
  const targetName = target?.isHuman || target?.name === "你" ? `${(target?.seatIndex ?? 0) + 1}号` : target?.name ?? "这个位置";
  if (evidenceSummary) {
    return `我先提 ${targetName}。不是说现在一定出，我过不去的是 ${evidenceSummary}。先听他把身份和信息讲完，再看票。`;
  }
  if (evidenceCount > 0) {
    return `我先提 ${targetName}。我这里有线索牵到他，但公开信息还不够硬，先让他上台讲清楚。`;
  }
  if (support > 0) {
    return `我先提 ${targetName}。这不是铁证，是想看他怎么防、别人怎么站票。`;
  }
  return `我先提 ${targetName}。白天不能只绕着感觉聊，先让这个位置把身份、信息和票型讲清楚。`;
}

function nominationDecisionRationaleLine(decisionRationale) {
  if (!decisionRationale?.focusName || !decisionRationale?.runnerUpName) {
    return "";
  }
  const focusName = decisionRationale.focusName;
  const runnerUpName = decisionRationale.runnerUpName;
  if (decisionRationale.reasonKey === "more-visible-evidence") {
    return `不是放过 ${runnerUpName}，是 ${focusName} 这边公开线索更多，先上台更好验。`;
  }
  if (decisionRationale.reasonKey === "higher-pressure") {
    return `和 ${runnerUpName} 比，${focusName} 现在压力更集中，先听防守更有信息。`;
  }
  if (decisionRationale.reasonKey === "close-call") {
    return `${focusName} 和 ${runnerUpName} 差距不大，我先提更容易被追问验证的 ${focusName}。`;
  }
  if (decisionRationale.reasonKey === "numeric-score") {
    return `${focusName} 目前排在 ${runnerUpName} 前面，但这票先当验证，不当锁死。`;
  }
  return `我把 ${focusName} 放在 ${runnerUpName} 前面，先用提名把这条线摊开。`;
}

function formatVoteEstimate(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "0";
  }
  return Number.isInteger(numeric) ? `${numeric}` : `${Math.round(numeric * 10) / 10}`;
}

export function buildNominationStrategyRationale(options = {}) {
  const intent = `${options.strategyIntent ?? ""}`.trim();
  const coalition = options.coalition ?? null;
  const expectedSupport = Number(coalition?.expectedYesVotes ?? options.expectedSupport ?? 0);
  const threshold = Number(coalition?.threshold ?? options.threshold ?? 0);
  const margin = Number.isFinite(Number(coalition?.margin))
    ? Number(coalition.margin)
    : threshold > 0
    ? expectedSupport - threshold
    : 0;
  const likelyPasses = !!coalition?.likelyPasses || (threshold > 0 && expectedSupport >= threshold);
  const voteText = threshold > 0
    ? `票面约 ${formatVoteEstimate(expectedSupport)}/${formatVoteEstimate(threshold)}`
    : "";
  let displayIntent = "information-check";
  let line = "";

  if (intent === "pressure-test") {
    displayIntent = "pressure-test";
    line = voteText
      ? `这票不是空过，先当压力测试，${voteText}，重点看回应、站边和票型。`
      : "这票不是空过，先当压力测试，重点看回应、站边和票型。";
  } else if (intent === "coalition-check") {
    displayIntent = "coalition-check";
    line = voteText
      ? `不是空过，票面接近门槛，${voteText}，用它验桌面能不能成形。`
      : "这票不是空过，是检查桌面联盟，用它验票面能不能成形。";
  } else if (intent === "execution-push") {
    displayIntent = "execution-push";
    line = voteText
      ? `票面有机会过，${voteText}，所以现在该推进而不是空过。`
      : "票面有机会过，所以现在该推进而不是空过。";
  } else if (intent === "good-avoid-no-execution") {
    displayIntent = "avoid-no-execution";
    line = voteText
      ? `今天空过风险高，${voteText}，先保住处决窗口。`
      : "今天空过风险高，先保住处决窗口。";
  } else if (intent === "good-execution-info") {
    displayIntent = "execution-info";
    line = voteText
      ? `这票不是空过，是换防守质量，${voteText}，先看能不能补上。`
      : "这票不是空过，是换防守质量，先看能不能补上。";
  } else if (["evil-framing", "protective-deflection", "evil-sacrifice"].includes(intent)) {
    displayIntent = "public-reason-flow";
    line = voteText
      ? `台面上不是空过，按公开理由推进，${voteText}，留下可验证的流程压力。`
      : "台面上不是空过，按公开理由推进，留下可验证的流程压力。";
  } else if (voteText) {
    line = `这票不是空过，是先换信息，${voteText}，不够也能看清站边。`;
  } else {
    line = "这票不是空过，是先换信息，不急着锁死，重点看防守和跟票。";
  }
  return {
    kind: "nomination-strategy-rationale",
    displayIntent,
    line,
    expectedSupport: Number.isFinite(expectedSupport) ? Math.round(expectedSupport * 10) / 10 : 0,
    threshold: Number.isFinite(threshold) ? Math.round(threshold * 10) / 10 : 0,
    margin: Number.isFinite(margin) ? Math.round(margin * 10) / 10 : 0,
    likelyPasses,
    voteText,
  };
}

function nominationStrategyRationaleLine(options = {}) {
  return buildNominationStrategyRationale(options).line;
}

function nominationReasonLine(state, aiPlayer, target, evidenceContract, options = {}) {
  const targetName = statementTargetLabel(state, target?.id);
  const publicReason = evidenceContract?.spokenText || evidenceContract?.text || "";
  const shortReason = shortReasonText(publicReason);
  const highConfidence = !!options.highConfidence;
  const forcePressure = !!options.forcePressure;
  const framing = !!options.framing;
  if (framing) {
    return publicReason
      ? `台面理由我说清楚：我提 ${targetName}，主要卡在 ${publicReason}。先让他上台讲完，再看票。`
      : `台面理由先放这：我提 ${targetName}。先让他上台讲清楚，票型也会给信息。`;
  }
  if (evidenceContract?.hasEvidence) {
    if (highConfidence && !forcePressure) {
      return `我提 ${targetName}。核心不是赶票，是 ${publicReason}。他要把这点解释清楚。`;
    }
    return `我先提 ${targetName}。这条还没到拍死，但${shortReason}，这点过不去，先听防守。`;
  }
  return `我先提 ${targetName}。${publicReason}，不是闭眼冲。`;
}

function buildNominationProposal(state, aiPlayer, candidate, threshold, rankIndex, options = {}) {
  const agentView =
    options.agentView ?? buildAgentView(state, aiPlayer, { audience: "public", targetId: candidate.player.id });
  const strategyContext = options.strategyContext ?? buildAIStrategyContext(state, aiPlayer, {
    agentView,
    audience: "public",
    stage: "nomination",
    targetId: candidate.player.id,
  });
  const thoughtFrame = options.thoughtFrame ?? buildAIThoughtFrame(state, aiPlayer, {
    agentView,
    audience: "public",
    stage: "nomination",
  });
  const evidenceCount = agentView
    ? agentView.evidenceCountForTarget(candidate.player.id, { publicOnly: true, includePrivate: false })
    : countAgentEvidence(getAIAgent(state, aiPlayer), candidate.player.id);
  const publicMemory = currentPublicStatementMemory(state, aiPlayer.id);
  const statementReason =
    publicStatementMemoryPressure(publicMemory) > 0
      ? publicStatementNominationReason(state, aiPlayer, candidate.player.id)
      : "";
  const evidenceContract = buildDialogueEvidenceContract(agentView ?? state, aiPlayer, candidate.player, {
    limit: 1,
    publicOnly: true,
    fallback: "公开证据还不够，先用提名看回应和票型",
  });
  const rankedForRationale =
    options.rankedTargets ?? rankTargets(aiPlayer, state, state.players.length, { publicOnly: true, audience: "nomination" });
  const runnerUp = rankedForRationale.find(
    (entry) =>
      entry?.player?.id &&
      entry.player.id !== candidate.player.id &&
      entry.player.id !== aiPlayer.id &&
      registersAsAlive(state, entry.player) &&
      !entry.player.beenNominatedToday
  ) ?? null;
  const decisionRationale = buildDecisionRationale(agentView ?? state, aiPlayer, candidate, runnerUp, {
    publicOnly: true,
    audience: "nomination",
  });
  const decisionRationaleSpokenLine = polishConversationalText(nominationDecisionRationaleLine(decisionRationale));
  const nominationDecisionRationale = decisionRationale
    ? {
      ...decisionRationale,
      spokenLine: decisionRationaleSpokenLine || decisionRationale.line || "",
    }
    : null;
  const evidenceSummary = evidenceContract.hasEvidence ? evidenceContract.text : "";
  const framing = aiPlayer.team === "evil" && !areKnownAllies(state, aiPlayer, candidate.player) && (evidenceContract.graphChains?.length ?? 0) > 0;
  const support = expectedSupportFor(state, candidate.player.id);
  const coalition = simulateCoalitionVote(state, aiPlayer, candidate.player, {
    strategyContext,
    formalNomination: { nominatorId: aiPlayer.id },
  });
  const expectedSupport = Math.max(support, coalition.expectedYesVotes ?? 0);
  const highConfidence = candidate.score >= 0.56 && !options.forcePressure;
  const strategyIntent = nominationIntentForCandidate(strategyContext, {
    targetId: candidate.player.id,
    candidateScore: candidate.score,
    evidenceCount,
    support: expectedSupport,
    threshold: coalition.threshold,
    likelyPasses: coalition.likelyPasses,
    highConfidence,
    forcePressure: options.forcePressure,
    framing,
  });
  const strategyRationale = buildNominationStrategyRationale({ strategyIntent, coalition, expectedSupport });
  const proposalReasonBase = statementReason
    ? `我提 ${statementTargetLabel(state, candidate.player.id)}。${statementReason}。`
    : ensureEvidenceContractInText(
      highConfidence
      ? evidenceSummary
        ? nominationReasonLine(state, aiPlayer, candidate.player, evidenceContract, { highConfidence, framing })
        : nominationReasonLine(state, aiPlayer, candidate.player, evidenceContract, { highConfidence, framing })
      : evidenceSummary
      ? nominationReasonLine(state, aiPlayer, candidate.player, evidenceContract, { highConfidence, forcePressure: options.forcePressure, framing })
      : nominationReasonLine(state, aiPlayer, candidate.player, evidenceContract, { forcePressure: true, framing }),
    evidenceContract
  );
  const strategicLead = strategyContext.evilPlanContextLine && aiPlayer.team === "evil"
    ? strategyContext.evilPlanContextLine
    : "";
  const proposalReasonWithRationale = joinSpeechFragments([
    proposalReasonBase,
    nominationDecisionRationale?.spokenLine,
    strategyRationale.line,
  ]);
  const rawProposalReason = strategicLead
    ? joinSpeechFragments([strategicLead, proposalReasonWithRationale])
    : proposalReasonWithRationale;
  const proposalReason = polishChineseSeatSpacing(applySpeechBudget(polishConversationalText(rawProposalReason), {
    audience: "nomination",
    maxSentences: 4,
    maxChars: 260,
  }));
  return {
    nominatorId: aiPlayer.id,
    nomineeId: candidate.player.id,
    confidence: candidate.score,
    support,
    expectedSupport,
    coalition,
    evidenceCount,
    pressure: !highConfidence,
    threshold,
    rankIndex,
    evidenceSummary,
    evidenceContract,
    decisionRationale: nominationDecisionRationale,
    strategyRationale,
    statementMemoryFocus: !!statementReason,
    framing,
    strategyIntent,
    gameWindow: strategyContext.window,
    strategyContext: serializeStrategyContext(strategyContext),
    worldCandidates: strategyContext.worldCandidates,
    evilPlanContextLine: strategyContext.evilPlanContextLine,
    evilWorldPlan: strategyContext.evilWorldPlan,
    thoughtFrame,
    thoughtFrameFocus: thoughtFrame.primaryConcernId === candidate.player.id,
    reason: proposalReason,
  };
}

function buildEvilOnBlockDeflectionProposal(state, aiPlayer, threshold) {
  const threat = currentOnBlockEvilAllyThreat(state, aiPlayer);
  if (!threat?.critical) {
    return null;
  }

  const agentView = buildAgentView(state, aiPlayer, { audience: "public" });
  const strategyContext = buildAIStrategyContext(state, aiPlayer, {
    agentView,
    audience: "public",
    stage: "nomination",
  });
  const thoughtFrame = buildAIThoughtFrame(state, aiPlayer, {
    agentView,
    audience: "public",
    stage: "nomination",
  });
  const rescueThreshold = clamp(Math.min(Number(threshold) || 0.48, 0.32), 0.18, 0.42);
  const candidates = rankTargets(aiPlayer, state, state.players.length, { publicOnly: true, audience: "nomination" })
    .filter((entry) => registersAsAlive(state, entry.player))
    .filter((entry) => !entry.player.beenNominatedToday)
    .filter((entry) => entry.player.id !== aiPlayer.id)
    .filter((entry) => !areKnownAllies(state, aiPlayer, entry.player));
  const proposals = [];

  candidates.forEach((candidate, rankIndex) => {
    const targetStrategyContext = buildAIStrategyContext(state, aiPlayer, {
      agentView,
      audience: "public",
      stage: "nomination",
      targetId: candidate.player.id,
    });
    const proposal = proposalWithOvertakePlan(
      state,
      buildNominationProposal(state, aiPlayer, candidate, rescueThreshold, rankIndex, {
        agentView,
        strategyContext: targetStrategyContext,
        thoughtFrame,
        forcePressure: true,
      })
    );
    if (!nominationProposalCanMatter(state, proposal)) {
      return;
    }
    proposals.push({
      ...proposal,
      evilDeflectionPlan: {
        active: true,
        protectedNomineeId: threat.protectedNomineeId,
        protectedNomineeName: threat.protectedNomineeName,
        protectedCategory: threat.protectedCategory,
        currentYesVotes: threat.yesVotes,
        requiredYesVotes: threat.requiredYesVotes,
        reasonKey: threat.protectedCategory === "demon" ? "save-demon-on-block" : "save-evil-ally-on-block",
      },
    });
  });

  if (proposals.length === 0) {
    return null;
  }
  return sortNominationProposals(proposals)[0];
}

function sortNominationProposals(proposals) {
  proposals.sort((a, b) => {
    const aOvertake = a.overtakePlan?.active ? a.overtakePlan : null;
    const bOvertake = b.overtakePlan?.active ? b.overtakePlan : null;
    if (aOvertake || bOvertake) {
      if (!!aOvertake?.canOvertake !== !!bOvertake?.canOvertake) {
        return aOvertake?.canOvertake ? -1 : 1;
      }
      if (!!a.evilDeflectionPlan?.active !== !!b.evilDeflectionPlan?.active) {
        return a.evilDeflectionPlan?.active ? -1 : 1;
      }
      const marginDiff = (bOvertake?.margin ?? -Infinity) - (aOvertake?.margin ?? -Infinity);
      if (marginDiff !== 0) {
        return marginDiff;
      }
    }
    const aMustExecute = !!(a.gameWindow?.mustExecute || a.strategyContext?.window?.mustExecute);
    const bMustExecute = !!(b.gameWindow?.mustExecute || b.strategyContext?.window?.mustExecute);
    if (aMustExecute || bMustExecute) {
      const thresholdA = Number(a.coalition?.threshold ?? a.gameWindow?.voteThreshold ?? 0) || 0;
      const thresholdB = Number(b.coalition?.threshold ?? b.gameWindow?.voteThreshold ?? 0) || 0;
      const expectedA = Number(a.coalition?.expectedYesVotes ?? a.expectedSupport ?? a.support ?? 0) || 0;
      const expectedB = Number(b.coalition?.expectedYesVotes ?? b.expectedSupport ?? b.support ?? 0) || 0;
      const likelyPassesA = !!a.coalition?.likelyPasses || (thresholdA > 0 && expectedA >= thresholdA);
      const likelyPassesB = !!b.coalition?.likelyPasses || (thresholdB > 0 && expectedB >= thresholdB);
      if (likelyPassesA !== likelyPassesB) {
        return likelyPassesA ? -1 : 1;
      }
      if (likelyPassesA && likelyPassesB) {
        const marginDiff = (expectedB - thresholdB) - (expectedA - thresholdA);
        if (marginDiff !== 0) {
          return marginDiff;
        }
      }
    }
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
    const supportA = a.expectedSupport ?? a.support;
    const supportB = b.expectedSupport ?? b.support;
    if (supportB !== supportA) {
      return supportB - supportA;
    }
    if (b.evidenceCount !== a.evidenceCount) {
      return b.evidenceCount - a.evidenceCount;
    }
    return b.confidence - a.confidence;
  });
  return proposals;
}

function goodNoExecutionWinStrategyActive(strategyContext) {
  const goodDayStrategy = strategyContext?.goodDayStrategy;
  return !!(goodDayStrategy?.mayorNoExecutionWin || goodDayStrategy?.mastermindNoExecutionWin);
}

function choosePressureFallbackNomination(state, candidates, threshold) {
  const aliveCount = getPubliclyAlivePlayers(state).length;
  const day = state.day ?? 1;
  const publicRounds = state.dayStageMeta?.publicRounds ?? 0;
  const shouldForcePressure = day <= 1 || publicRounds >= 1 || aliveCount <= 5;
  const fallbackFloor = aliveCount <= 5 ? 0.34 : day <= 1 ? 0.2 : 0.42;
  const fallbackProposals = [];

  candidates.forEach((aiPlayer) => {
    const agentView = buildAgentView(state, aiPlayer, { audience: "public" });
    const strategyContext = buildAIStrategyContext(state, aiPlayer, {
      agentView,
      audience: "public",
      stage: "nomination",
    });
    if (goodNoExecutionWinStrategyActive(strategyContext)) {
      return;
    }
    const thoughtFrame = buildAIThoughtFrame(state, aiPlayer, {
      agentView,
      audience: "public",
      stage: "nomination",
    });
    const persona = aiPlayer.aiPersona ?? PERSONA_TYPES.STEADY;
    const frameShift = thoughtFrame.nominationReadiness >= 0.68 ? -0.06 : thoughtFrame.nominationReadiness >= 0.55 ? -0.03 : 0;
    const goodDayShift = -(strategyContext.goodDayStrategy?.nominationBias ?? 0);
    const effectiveThreshold = clamp(threshold + personaStrategyProfile(persona).nominationShift + frameShift + goodDayShift, 0.28, 0.62);
    const rankedTargets = rankTargets(aiPlayer, state, state.players.length, { publicOnly: true, audience: "nomination" })
      .filter((entry) => registersAsAlive(state, entry.player) && !entry.player.beenNominatedToday)
      .filter((entry) => canEvilNominateTarget(state, aiPlayer, entry.player, strategyContext));
    const candidate = preferFreshExecutionTargets(state, rankedTargets)
      .find((entry) => shouldForcePressure || entry.score >= fallbackFloor);

    if (!candidate || (!shouldForcePressure && candidate.score < fallbackFloor)) {
      return;
    }

    const proposal = proposalWithOvertakePlan(
      state,
      buildNominationProposal(state, aiPlayer, candidate, Math.min(effectiveThreshold, fallbackFloor), 0, {
        agentView,
        strategyContext: buildAIStrategyContext(state, aiPlayer, {
          agentView,
          audience: "public",
          stage: "nomination",
          targetId: candidate.player.id,
        }),
        thoughtFrame,
        forcePressure: true,
      })
    );
    if (nominationProposalCanMatter(state, proposal)) {
      fallbackProposals.push(proposal);
    }
  });

  if (fallbackProposals.length === 0) {
    return null;
  }

  const proposal = sortNominationProposals(fallbackProposals)[0];
  return shouldSpendNominationAfterFailedPressure(state, proposal) ? proposal : null;
}

function chooseStrongExecutionCandidateRescueNomination(state, candidates, threshold) {
  const proposals = [];
  candidates.forEach((aiPlayer) => {
    const proposal = buildEvilOnBlockDeflectionProposal(state, aiPlayer, threshold);
    if (proposal) {
      proposals.push(proposal);
    }
  });
  if (proposals.length === 0) {
    return null;
  }
  return sortNominationProposals(proposals)[0];
}

export function chooseAINomination(state) {
  if (state.phase !== "day" || state.gameOver) {
    return null;
  }
  if (hasExecutionToday(state)) {
    return null;
  }

  refreshAIBeliefs(state);
  const threshold = nominationThreshold(state);
  const candidates = state.players.filter((entry) => registersAsAlive(state, entry) && !entry.isHuman && !entry.nominatedToday);
  if (shouldHoldStrongExecutionCandidate(state)) {
    return chooseStrongExecutionCandidateRescueNomination(state, candidates, threshold);
  }
  const proposals = [];

  candidates.forEach((aiPlayer) => {
    const agentView = buildAgentView(state, aiPlayer, { audience: "public" });
    const strategyContext = buildAIStrategyContext(state, aiPlayer, {
      agentView,
      audience: "public",
      stage: "nomination",
    });
    if (goodNoExecutionWinStrategyActive(strategyContext)) {
      return;
    }
    const thoughtFrame = buildAIThoughtFrame(state, aiPlayer, {
      agentView,
      audience: "public",
      stage: "nomination",
    });
    const persona = aiPlayer.aiPersona ?? PERSONA_TYPES.STEADY;
    const frameShift = thoughtFrame.nominationReadiness >= 0.68 ? -0.06 : thoughtFrame.nominationReadiness >= 0.55 ? -0.03 : 0;
    const goodDayShift = -(strategyContext.goodDayStrategy?.nominationBias ?? 0);
    const effectiveThreshold = clamp(threshold + personaStrategyProfile(persona).nominationShift + frameShift + goodDayShift, 0.28, 0.62);
    const deflectionProposal = buildEvilOnBlockDeflectionProposal(state, aiPlayer, effectiveThreshold);
    if (deflectionProposal) {
      proposals.push(deflectionProposal);
    }
    const eligibleTargets = rankTargets(aiPlayer, state, state.players.length, { publicOnly: true, audience: "nomination" })
      .filter((entry) => registersAsAlive(state, entry.player) && !entry.player.beenNominatedToday)
      .filter((entry) => canEvilNominateTarget(state, aiPlayer, entry.player, strategyContext));
    const rankedTargets = preferFreshExecutionTargets(state, eligibleTargets);
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
        const evidenceCount = agentView
          ? agentView.evidenceCountForTarget(candidate.player.id, { publicOnly: true, includePrivate: false })
          : countAgentEvidence(getAIAgent(state, aiPlayer), candidate.player.id);
        const support = expectedSupportFor(state, candidate.player.id);
        const hasEvidence = evidenceCount > 0 || support > 0;
        const hasPublicMemory =
          publicStatementMemoryMatches(publicMemory, candidate.player.id) &&
          publicStatementMemoryPressure(publicMemory) > 0;
        const highConfidence = candidate.score >= 0.56;
        const pressureEligible =
          (candidate.score >= effectiveThreshold && (hasEvidence || state.day <= 1 || getPubliclyAlivePlayers(state).length <= 5)) ||
      (hasPublicMemory && candidate.score >= Math.max(0.24, effectiveThreshold - 0.24));
        if (!highConfidence && !pressureEligible) {
          return;
        }
        const proposal = proposalWithOvertakePlan(
          state,
          buildNominationProposal(state, aiPlayer, candidate, effectiveThreshold, rankIndex, {
            agentView,
            strategyContext: buildAIStrategyContext(state, aiPlayer, {
              agentView,
              audience: "public",
              stage: "nomination",
              targetId: candidate.player.id,
            }),
            thoughtFrame,
          })
        );
        if (nominationProposalCanMatter(state, proposal)) {
          proposals.push(proposal);
        }
      });
  });

  if (proposals.length === 0) {
    return choosePressureFallbackNomination(state, candidates, threshold);
  }

  const proposal = sortNominationProposals(proposals)[0];
  return shouldSpendNominationAfterFailedPressure(state, proposal) ? proposal : null;
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

function nominationDefenseVariantIndex({ state, nominee, nominator, reasonText = "", pressure = 0.5, salt = "" } = {}, variantCount = 1) {
  if (!Number.isFinite(variantCount) || variantCount <= 1) {
    return 0;
  }
  const publicSeatNumber = Number.isFinite(nominee?.seatIndex) ? nominee.seatIndex + 1 : Number.parseInt(`${nominee?.name ?? ""}`, 10);
  const pressureBand = pressure >= 0.6 ? "high" : "low";
  const seedText = [
    state?.scriptId ?? "",
    nominee?.id ?? nominee?.name ?? "",
    nominator?.id ?? nominator?.name ?? "",
    nominee?.aiPersona ?? "",
    pressureBand,
    reasonText,
    salt,
  ].join("|");
  let hash = Number.isFinite(publicSeatNumber) ? publicSeatNumber + (pressureBand === "high" ? 23 : 7) : 2166136261;
  for (let index = 0; index < seedText.length; index += 1) {
    hash ^= seedText.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash % variantCount;
}

function nominationDefenseClaimText(state, player, { nominator, reasonText = "", pressure = 0.5 } = {}) {
  if (player?.publicClaimRoleId) {
    return `我公开报的是 ${roleNameById(state, player.publicClaimRoleId)}`;
  }
  const variants = [
    "身份我先不一次拍死，但昨晚信息和投票理由会讲清楚",
    "身份不急着一口咬死，但昨晚信息和投票理由我会摊开",
    "具体身份先留半步，关键口径和投票理由我会讲明白",
    "我不靠裸身份硬扛，先把能核的口径和投票理由补出来",
    "身份线我先不硬拍，但可验的信息点和票型理由会补齐",
  ];
  const index = nominationDefenseVariantIndex({ state, nominee: player, nominator, reasonText, pressure, salt: "claim" }, variants.length);
  const selected = variants[index] ?? variants[0];
  return reasonText.includes("昨晚信息") ? selected.replace(/昨晚信息/gu, "关键口径") : selected;
}

function nominationReasonVoteAnchorFragment(reason) {
  const sentences = `${reason ?? ""}`
    .replace(/\s+/g, " ")
    .split(/[。！？；]/u)
    .map((entry) => entry.replace(/^我(?:先)?提\s*/u, "").trim())
    .filter(Boolean);
  const reasonSentence =
    sentences.find((entry) => /身份|信息|票型|防守|证据|压力|解释|对上|昨晚|发言|投票|处决|验|跳|报/.test(entry)) ??
    sentences.find((entry) => entry.length > 8) ??
    sentences[0] ??
    "";
  const cleaned = reasonSentence.replace(/[。！？；\s]+$/u, "").trim();
  return cleaned.length > 52 ? `${cleaned.slice(0, 52)}...` : cleaned;
}

function nominationDefenseReasonFragment(reason) {
  const cleaned = nominationReasonVoteAnchorFragment(reason)
    .replace(/[。！？；\s]+$/u, "")
    .trim();
  return cleaned || "这条提名理由";
}

function nominationDefenseLine(state, nominee, nominator, reason, rng = Math.random) {
  if (!nominee) {
    return "";
  }
  if (nominee.isHuman) {
    return "等你回应。你可以先说身份和昨晚信息，再决定要不要拉票。";
  }
  const pressure = nominee.suspicion?.[nominator?.id] ?? 0.5;
  const reasonText = nominationDefenseReasonFragment(reason);
  const claimText = nominationDefenseClaimText(state, nominee, { nominator, reasonText, pressure });
  const lowPressureOptions = [
    `这票可以验，但别跳过防守。被点的是：${reasonText}。${claimText}，我先把被点的理由和公开口径对上；对不上再票我。`,
    `先别只看票数，防守要落到点上。被点的是：${reasonText}。${claimText}，我先把被点的理由和公开口径对上；先验我说的点，验不上再票我。`,
    `这轮可以拿我验，但先听完整防守。提名卡的是：${reasonText}。${claimText}，我把公开口径接上；接不上再票我。`,
  ];
  const highPressureOptions = [
    `我先回应提名理由：${reasonText}。${claimText}，我会把身份口径和票型补清楚；补不上再上票，补得上就先降压。`,
    `先把提名理由拆开：${reasonText}。${claimText}，我把身份线和票型补给桌面；补不上再上票，补得上就先降压。`,
    `别只催票，先听我接这条：${reasonText}。${claimText}，我把公开口径和票型补齐；补不上再上票，补得上就先降压。`,
    `我先防一下：提名理由「${reasonText}」要拆开听，别只听结论。${claimText}，先验我的身份线和票型，补不上再锁票。`,
  ];
  const options = pressure >= 0.6 ? highPressureOptions : lowPressureOptions;
  const selected = options[nominationDefenseVariantIndex({ state, nominee, nominator, reasonText, pressure, salt: "response" }, options.length)] ?? options[0];
  if (pressure >= 0.6) {
    const nominatorName = nominator?.name ?? "提名者";
    const counterPressureOptions = [
      `如果 ${nominatorName} 只推票不听我补信息，这条也要记。`,
      `如果 ${nominatorName} 只催落票、不听我补口径，桌面也要反看。`,
      `如果 ${nominatorName} 跳过我的防守直接催票，这个推进也要记。`,
    ];
    const counterPressureLine =
      counterPressureOptions[nominationDefenseVariantIndex({ state, nominee, nominator, reasonText, pressure, salt: "counter-pressure" }, counterPressureOptions.length)] ??
      counterPressureOptions[0];
    return polishChineseSeatSpacing(selected.includes("只推票不听我补信息") ? selected : `${selected} ${counterPressureLine}`);
  }
  return polishChineseSeatSpacing(selected);
}

function defaultHumanNominationDebateResponse(state, speaker, debate) {
  const speakerRole = speaker?.id === debate?.nomineeId ? "nominee" : "nominator";
  if (speakerRole === "nominee") {
    return "我先回应这票：别急着锁。我会把身份和昨晚信息讲清楚，大家听完再决定。";
  }
  return "我补一句：我提这个人不是为了赶票，是想先把他的解释放到台面上。";
}

function sanitizeNominationDebateResponse(text) {
  return polishChineseSeatSpacing(`${text ?? ""}`.replace(/\s+/g, " ").trim()).slice(0, 160);
}

export function createNominationDebate(state, { nominatorId, nomineeId, reason = "", source = "manual", decisionRationale = null, strategyRationale = null } = {}, rng = Math.random) {
  if (state.phase !== "day" || state.dayStage !== "nomination" || state.gameOver) {
    return { ok: false, reason: "当前不在提名阶段。" };
  }
  state.dayStageMeta = state.dayStageMeta ?? {};
  if (state.dayStageMeta.nominationDebate?.active) {
    return { ok: true, debate: state.dayStageMeta.nominationDebate, message: "已有待处理的提名互辩。" };
  }
  const nominator = getPlayerById(state, nominatorId);
  const nominee = getPlayerById(state, nomineeId);
  if (nominator?.id && nominee?.id && nominator.id === nominee.id) {
    return { ok: false, reason: "不能提名自己。" };
  }
  if (!nominator || !nominee) {
    return { ok: false, reason: "提名者或被提名者不存在。" };
  }
  if (!registersAsAlive(state, nominator)) {
    return { ok: false, reason: "死亡玩家无法发起提名。" };
  }
  if (nominator.nominatedToday) {
    return { ok: false, reason: `${nominator.name} 今天已提名过。` };
  }
  if (nominee.beenNominatedToday) {
    return { ok: false, reason: `${nominee.name} 今天已被提名过。` };
  }
  const acceptedNomination = acceptNominationBeforeVote(state, { nominatorId, nomineeId }, rng);
  if (!acceptedNomination.accepted) {
    return { ok: false, reason: acceptedNomination.reason };
  }
  if (acceptedNomination.terminal) {
    return {
      ok: true,
      immediateResolution: true,
      result: acceptedNomination,
      message: "Nomination triggered an immediate rule and resolved without a debate.",
    };
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
    nominationAccepted: true,
    nominationTrigger: acceptedNomination.nominationTrigger ?? null,
    source,
    reason: nominationReason,
    decisionRationale: decisionRationale ?? null,
    strategyRationale: strategyRationale ?? null,
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
    decisionRationale: debate.decisionRationale,
    strategyRationale: debate.strategyRationale,
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
  const focusId = role === "nominator" ? debate.nomineeId : speaker.id;
  recordPublicSpeechForAgents(state, {
    speakerId: speaker.id,
    text: responseText,
    focusId,
    roundInDay: state.dayStageMeta?.publicRounds ?? 0,
    orderIndex: state.events.speeches?.length ?? 0,
    polarity: role === "nominator" ? "accuse" : "defend",
  });
  state.events.speeches = state.events.speeches ?? [];
  state.events.speeches.push({
    day: state.day ?? 0,
    playerId: speaker.id,
    line: responseText,
    focusId,
    private: false,
    source: "nomination-debate-response",
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
      dialogueBiasMeta: structuredClone(player.dialogueBiasMeta ?? {}),
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
    player.dialogueBiasMeta = entry.dialogueBiasMeta ?? {};
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
