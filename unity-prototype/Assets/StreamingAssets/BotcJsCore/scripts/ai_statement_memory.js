import { getAllRoles } from "./data.js";
import { getPlayerById } from "./engine.js";
import { predictDialogueSignals, voteLabelToInGameStance } from "./ml_runtime.js";
import { areKnownAllies, summarizeEvidenceForDialogue } from "./ai_agents.js";
import { applySpeechBudget, shortReasonText } from "./ai_speech_renderer.js";

const QUESTION_INTENT = {
  CLAIM: "claim",
  VOTE: "vote",
  NIGHT: "night",
  PLAN: "plan",
  GENERIC: "generic",
};

function ensureStatementMemoryState(state) {
  state.aiDialogue = state.aiDialogue ?? {};
  state.aiDialogue.statementMemory = state.aiDialogue.statementMemory ?? {};
  state.aiDialogue.statementMemory.publicBySpeakerId = state.aiDialogue.statementMemory.publicBySpeakerId ?? {};
  state.aiDialogue.statementMemory.privateByPairKey = state.aiDialogue.statementMemory.privateByPairKey ?? {};
  return state.aiDialogue;
}

function roleNameById(state, roleId) {
  const role = getAllRoles(state.scriptId).find((entry) => entry.id === roleId);
  return role?.name ?? roleId;
}

function normalizeText(text) {
  return `${text ?? ""}`
    .toLowerCase()
    .replace(/[，。！？、；：“”‘’（）【】]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function stanceFromScore(score) {
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

export function dayStanceLabel(stance) {
  return {
    press: "强压",
    suspect: "怀疑",
    watch: "观察",
    trust: "偏信",
    unknown: "未知",
  }[stance] ?? "观察";
}

export function voteStanceFromText(text) {
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

function statementPairKey(speakerId, viewerId) {
  return `${speakerId ?? ""}::${viewerId ?? ""}`;
}

export function statementTargetLabel(state, targetId) {
  const player = getPlayerById(state, targetId);
  if (!player) {
    return targetId ? "这个位置" : "这条线";
  }
  return player.isHuman || player.name === "你" ? `${player.seatIndex + 1}号` : player.name;
}

function getStatementMemory(state, speakerId, audience = "public", viewerId = null) {
  const dialogue = ensureStatementMemoryState(state);
  if (audience === "private") {
    return dialogue.statementMemory.privateByPairKey[statementPairKey(speakerId, viewerId)] ?? null;
  }
  return dialogue.statementMemory.publicBySpeakerId[speakerId] ?? null;
}

function statementMemoryEntryFor(state, speaker, audience, viewerId, composed, options = {}) {
  const focusId = composed?.focusId ?? null;
  const evidenceSummary =
    options.evidenceSummary ??
    (focusId
      ? summarizeEvidenceForDialogue(state, speaker, focusId, {
          limit: 1,
          publicOnly: audience === "public",
          redactPrivate: true,
        })[0] ?? ""
      : "");
  return {
    day: state.day ?? 0,
    night: state.night ?? 0,
    timestamp: Date.now(),
    speakerId: speaker?.id ?? "",
    viewerId: viewerId ?? null,
    audience,
    focusId,
    focusName: statementTargetLabel(state, focusId),
    focusScore: Number.isFinite(composed?.focusScore) ? composed.focusScore : null,
    stance: stanceFromScore(composed?.focusScore),
    intent: options.intent ?? composed?.intent ?? "",
    claimRoleId: speaker?.publicClaimRoleId ?? null,
    voteStance: voteStanceFromText(composed?.response ?? composed?.line ?? ""),
    evidenceSummary,
    source: options.source ?? "",
    roundInDay: Number.isFinite(options.roundInDay) ? options.roundInDay : null,
  };
}

function statementMemoryTurn(entry, composed) {
  const rawText = `${composed?.response ?? composed?.line ?? ""}`.replace(/\s+/g, " ").trim();
  return {
    day: entry.day,
    night: entry.night,
    focusId: entry.focusId,
    focusName: entry.focusName,
    focusScore: entry.focusScore,
    stance: entry.stance,
    intent: entry.intent,
    voteStance: entry.voteStance,
    evidenceSummary: entry.evidenceSummary,
    roundInDay: entry.roundInDay,
    textSummary: rawText.length > 90 ? `${rawText.slice(0, 89)}…` : rawText,
  };
}

export function rememberStatementMemory(state, speaker, audience, viewerId, composed, options = {}) {
  if (!speaker?.id) {
    return null;
  }
  const dialogue = ensureStatementMemoryState(state);
  const entry = statementMemoryEntryFor(state, speaker, audience, viewerId, composed, options);
  const rememberInto = (previous) => {
    const sameFocus = !!entry.focusId && previous?.focusId === entry.focusId;
    const recentTurns = [
      ...(Array.isArray(previous?.recentTurns) ? previous.recentTurns : []),
      statementMemoryTurn(entry, composed),
    ].slice(-4);
    return {
      ...entry,
      previousFocusId: previous?.focusId ?? null,
      previousEvidenceSummary: previous?.evidenceSummary ?? "",
      previousStance: previous?.stance ?? "",
      turns: (previous?.turns ?? 0) + 1,
      consecutiveFocusCount: sameFocus ? (previous?.consecutiveFocusCount ?? 1) + 1 : 1,
      recentTurns,
    };
  };
  if (audience === "private") {
    const key = statementPairKey(speaker.id, viewerId);
    const previous = dialogue.statementMemory.privateByPairKey[key] ?? null;
    dialogue.statementMemory.privateByPairKey[key] = rememberInto(previous);
    return dialogue.statementMemory.privateByPairKey[key];
  }
  const previous = dialogue.statementMemory.publicBySpeakerId[speaker.id] ?? null;
  dialogue.statementMemory.publicBySpeakerId[speaker.id] = rememberInto(previous);
  return dialogue.statementMemory.publicBySpeakerId[speaker.id];
}

function mentionedPlayerIds(analysis = {}) {
  return new Set((analysis.mentionedPlayers ?? []).map((entry) => entry.id).filter(Boolean));
}

function continuityLineForPrivateStatement(state, speaker, viewer, composed, analysis) {
  const previous = getStatementMemory(state, speaker?.id, "private", viewer?.id);
  if (!previous || previous.day !== state.day) {
    return "";
  }
  const focusId = composed?.focusId ?? null;
  if (analysis?.intent === QUESTION_INTENT.CLAIM && previous.claimRoleId && speaker?.publicClaimRoleId === previous.claimRoleId) {
    return `身份口径我不改，还是 ${roleNameById(state, previous.claimRoleId)}；上次我也是这条线，不是临时换说法。`;
  }
  if (!focusId || !previous.focusId) {
    return "";
  }
  const previousName = statementTargetLabel(state, previous.focusId);
  const currentName = statementTargetLabel(state, focusId);
  const cleanReason = (text) =>
    shortReasonText(text, 18)
      .replace(/（先复核）|（先再对一下）|（先对一下）/g, "")
      .replace(/复核/g, "再听一遍")
      .replace(/口径/g, "说法")
      .replace(/\s+/g, " ")
      .trim();
  const previousReason = cleanReason(previous.evidenceSummary || previous.previousEvidenceSummary || "");
  const currentReason = cleanReason(composed?.evidenceContract?.spokenText || composed?.evidenceContract?.text || "");
  if (previous.focusId === focusId) {
    if ((previous.consecutiveFocusCount ?? 1) >= 2) {
      return previousReason
        ? `这已经是我连续盯 ${currentName}，不是新换目标；刚才那条线还是 ${previousReason}。`
        : `这已经是我连续盯 ${currentName}，不是新换目标，还是围绕这个位置看。`;
    }
    return previousReason
      ? `刚才那条我还没撤，还是先看 ${currentName}，因为 ${previousReason}。`
      : `刚才那条我还没撤，还是先看 ${currentName}。`;
  }
  const explicit = mentionedPlayerIds(analysis).has(focusId);
  return explicit
    ? `我先把 ${previousName} 那条暂放一边，换到 ${currentName}，是因为你明确问到这个位置；不是说前面那条作废。`
    : `我从 ${previousName} 换到 ${currentName}，是因为现在这条线更集中${currentReason ? `：${currentReason}` : ""}；前面那条先暂放。`;
}

function continuityLineForPublicStatement(state, speaker, composed, roundInDay) {
  const previous = getStatementMemory(state, speaker?.id, "public");
  if (!previous || previous.day !== state.day || roundInDay <= 1) {
    return "";
  }
  const focusId = composed?.focusId ?? null;
  if (!focusId || !previous.focusId) {
    return "";
  }
  const previousName = statementTargetLabel(state, previous.focusId);
  const currentName = statementTargetLabel(state, focusId);
  const previousReason = shortReasonText(previous.evidenceSummary || previous.previousEvidenceSummary || "", 18);
  if (previous.focusId === focusId) {
    return previousReason
      ? `我的意思是，公开口径我先不换，还是围绕 ${currentName} 看；上一轮卡点也是 ${previousReason}。`
      : `我的意思是，公开口径我先不换，还是围绕 ${currentName} 看。`;
  }
  return `我的意思是，我公开从 ${previousName} 换到 ${currentName}，不是洗前面那条，是这轮压力更集中。`;
}

function prependContinuityLine(response, line) {
  const text = `${response ?? ""}`.trim();
  if (!line || !text || text.includes(line)) {
    return text;
  }
  return `${line} ${text}`;
}

function privateDialogueTurnPrefix(questionText, memory, analysis) {
  const question = `${questionText ?? ""}`;
  const intent = analysis?.intent ?? QUESTION_INTENT.GENERIC;
  if (intent === QUESTION_INTENT.CLAIM && /(对外|公开|口径|能说)/.test(question)) {
    return "可以，我先给你一个能对外站住的版本。";
  }
  if (intent === QUESTION_INTENT.VOTE) {
    return "票这块我先说清楚：";
  }
  if (/(别绕|不要绕|直接|直说|别空泛|不要空泛|打太极|别糊弄)/.test(question)) {
    return "好，我直接答。";
  }
  if (memory?.turns > 0 && /(刚才|上句|上一句|那条|继续|还是|为什么|怎么)/.test(question)) {
    return "嗯，我接着刚才那条说。";
  }
  if (intent === QUESTION_INTENT.PLAN && /(下一步|怎么办|计划|怎么打)/.test(question)) {
    return "下一步我会拆成能执行的问法。";
  }
  return "";
}

export function applyPrivateDialogueTurnTaking(state, aiPlayer, human, composed, analysis, questionText, memory, options = {}) {
  const response = `${composed?.response ?? ""}`.trim();
  if (!response) {
    return composed;
  }
  const prefix = privateDialogueTurnPrefix(questionText, memory, analysis);
  if (!prefix || response.includes(prefix)) {
    return composed;
  }
  const sameEvilTeam = !!options.sameEvilTeam;
  const nextResponse =
    analysis?.intent === QUESTION_INTENT.CLAIM
      ? response.replace(/^我直说吧。/, "")
      : response;
  return {
    ...composed,
    response: applySpeechBudget(`${prefix} ${nextResponse}`, {
      audience: "private",
      maxSentences: sameEvilTeam
        ? 5
        : [QUESTION_INTENT.CLAIM, QUESTION_INTENT.VOTE].includes(analysis?.intent)
        ? 4
        : 3,
      maxChars: sameEvilTeam
        ? 320
        : [QUESTION_INTENT.CLAIM, QUESTION_INTENT.VOTE].includes(analysis?.intent)
        ? 230
        : 200,
    }),
  };
}

export function applyPrivateStatementContinuity(state, speaker, viewer, composed, analysis) {
  if ([QUESTION_INTENT.CLAIM, QUESTION_INTENT.NIGHT].includes(analysis?.intent)) {
    const sameEvilTeam = areKnownAllies(state, speaker, viewer);
    return {
      ...composed,
      response: applySpeechBudget(composed?.response, {
        audience: "private",
        maxSentences: sameEvilTeam ? 5 : 4,
        maxChars: sameEvilTeam ? 320 : 240,
      }),
    };
  }
  if (/不换目标|先放一边|单看/.test(`${composed?.response ?? ""}`)) {
    return {
      ...composed,
      response: applySpeechBudget(composed?.response, { audience: "private", maxSentences: 3, maxChars: 190 }),
    };
  }
  const response = prependContinuityLine(
    composed?.response,
    continuityLineForPrivateStatement(state, speaker, viewer, composed, analysis)
  );
  const sameEvilTeam = areKnownAllies(state, speaker, viewer);
  return {
    ...composed,
    response: applySpeechBudget(response, {
      audience: "private",
      maxSentences: sameEvilTeam ? 5 : 3,
      maxChars: sameEvilTeam ? 320 : 190,
    }),
  };
}

export function applyPublicStatementContinuity(state, speaker, composed, roundInDay, options = {}) {
  const line = prependContinuityLine(
    composed?.line,
    continuityLineForPublicStatement(state, speaker, composed, roundInDay)
  );
  const budgeted = applySpeechBudget(line, {
    audience: "public",
    maxSentences: speaker?.alive === false ? 3 : 2,
    maxChars: speaker?.alive === false ? 190 : 135,
  });
  return {
    ...composed,
    line: options.appendPublicThoughtQuestion
      ? options.appendPublicThoughtQuestion(budgeted, composed?.thoughtFrame, speaker?.alive === false ? 210 : 190)
      : budgeted,
  };
}

export function currentPublicStatementMemory(state, speakerId) {
  const memory = getStatementMemory(state, speakerId, "public");
  return memory?.day === state.day ? memory : null;
}

export function publicStatementMemoryMatches(memory, targetId) {
  return !!memory?.focusId && memory.focusId === targetId;
}

export function publicStatementMemoryPressure(memory) {
  if (!memory) {
    return 0;
  }
  if (memory.stance === "press") {
    return 0.12;
  }
  if (memory.stance === "suspect" || Number(memory.focusScore ?? 0) >= 0.56) {
    return 0.11;
  }
  if (memory.stance === "watch") {
    return 0.03;
  }
  return 0;
}

export function publicStatementVoteThresholdShift(state, voter, nominee) {
  const memory = currentPublicStatementMemory(state, voter?.id);
  if (!publicStatementMemoryMatches(memory, nominee?.id)) {
    return 0;
  }
  const pressure = publicStatementMemoryPressure(memory);
  if (pressure <= 0) {
    return 0;
  }
  return voter?.team === "evil" ? -Math.min(0.06, pressure) : -Math.min(0.12, pressure);
}

export function publicStatementNominationReason(state, aiPlayer, targetId) {
  const memory = currentPublicStatementMemory(state, aiPlayer?.id);
  if (!publicStatementMemoryMatches(memory, targetId)) {
    return "";
  }
  const targetName = statementTargetLabel(state, targetId);
  const reason = memory.evidenceSummary
    ? shortReasonText(
        memory.evidenceSummary
          .replace(/公聊提到：.+$/, "公聊口径需要复核")
          .replace(/这条还弱：.+$/, "证据还薄，需要回应"),
        28
      )
    : "";
  return reason
    ? `刚才我已经点过 ${targetName}，理由还是 ${reason}`
    : `刚才我已经点过 ${targetName}，这轮先把回应听出来`;
}
