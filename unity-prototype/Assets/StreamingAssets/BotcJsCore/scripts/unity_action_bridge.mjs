import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  acceptAIProactiveWhisper,
  chooseAINomination,
  createNominationDebate,
  declineAIProactiveWhisper,
  decideAIVote,
  getAIInsightRows,
  initializeAI,
  recordNominationDebateResponse,
  runAIConversationStep,
  runAIDiscussion,
  runAIProactiveWhispers,
  runAIToAIPrivateWhispers,
  runPrivateWhisper,
} from "./ai.js";
import { renderSpeechWithLocalLLM, resolveLLMRendererConfig } from "./ai_llm_renderer.js";
import {
  addGrimoireReminder,
  addLog,
  advanceDayStage,
  beginNightPhase,
  clearGrimoireNote,
  closeNominationWindow,
  createNewGame,
  getHumanDayActionState,
  getHumanNightActionState,
  getPendingStorytellerActionState,
  getPlayerById,
  markPublicDiscussionRound,
  openNominationWindow,
  removeGrimoireReminder,
  resolveNominationAndVote,
  resolvePendingStorytellerAction,
  runNight,
  setGrimoireMarkedRole,
  setHumanDayActionPlan,
  setHumanNightActionPlan,
  skipDay,
  tickNominationWindow,
  withSeededRandom,
} from "./engine.js";
import { buildUnityPhaseAdvance, canResolveDayIntoNight } from "./unity_phase_guard.mjs";
import { buildUnityViewModel, stringifyUnityViewModel } from "./unity_viewmodel.js";

const DEFAULT_STREAMING_ASSETS = "unity-prototype/Assets/StreamingAssets";
const DEFAULT_STATE_PATH = `${DEFAULT_STREAMING_ASSETS}/unity_state.json`;
const DEFAULT_VIEWMODEL_PATH = `${DEFAULT_STREAMING_ASSETS}/unity_viewmodel.json`;
const DEFAULT_ACTION_PATH = `${DEFAULT_STREAMING_ASSETS}/unity_action.json`;
const DEFAULT_RESULT_PATH = `${DEFAULT_STREAMING_ASSETS}/unity_action_result.json`;
const DEFAULT_REPLAY_DIR = "output/demo_replays";
const DEFAULT_LLM_DIALOGUE_TIMEOUT_MS = 1800;

function argValue(name, fallback = "") {
  const hit = process.argv.find((entry) => entry === name || entry.startsWith(`${name}=`));
  if (!hit) return fallback;
  if (hit === name) return "true";
  return hit.slice(name.length + 1);
}

function hasFlag(name) {
  return process.argv.includes(name) || process.argv.some((entry) => entry.startsWith(`${name}=`));
}

function readJson(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) return fallback;
  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  if (!raw.trim()) return fallback;
  return JSON.parse(raw);
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function replaySafeText(text) {
  return `${text ?? ""}`.replace(/\s+/g, " ").trim();
}

function replayPlayerName(state, playerId) {
  const player = getPlayerById(state, playerId);
  return player?.name ?? playerId ?? "";
}

function playerIsHuman(state, playerId) {
  return !!getPlayerById(state, playerId)?.isHuman;
}

function replayPathFor(state, options = {}) {
  if (options.replayPath) {
    return path.resolve(options.replayPath);
  }
  const dir = path.resolve(options.replayDir ?? DEFAULT_REPLAY_DIR);
  const gameId = `${state?.id ?? "unknown-game"}`.replace(/[^\w.-]+/g, "_");
  return path.join(dir, `${gameId}.json`);
}

function latestReplayPathFor(options = {}) {
  if (options.latestReplayPath) {
    return path.resolve(options.latestReplayPath);
  }
  return path.join(path.resolve(options.replayDir ?? DEFAULT_REPLAY_DIR), "latest.json");
}

function buildDialogueReplay(state, { action = null, result = null, generatedAt = new Date() } = {}) {
  const players = (state.players ?? []).slice().sort((a, b) => a.seatIndex - b.seatIndex);
  const speeches = (state.events?.speeches ?? []).map((entry, index) => ({
    index,
    day: entry.day ?? 0,
    night: entry.night ?? 0,
    private: !!entry.private,
    proactive: !!entry.proactive,
    mode: entry.private ? "private" : "public",
    playerId: entry.playerId ?? "",
    playerName: replayPlayerName(state, entry.playerId),
    viewerId: entry.viewerId ?? "",
    viewerName: replayPlayerName(state, entry.viewerId),
    targetId: entry.targetId ?? "",
    targetName: replayPlayerName(state, entry.targetId),
    focusId: entry.focusId ?? "",
    focusName: replayPlayerName(state, entry.focusId),
    debateBeat: entry.debateBeat ?? "",
    llmRender: entry.llmRender ?? null,
    line: replaySafeText(entry.line),
  }));
  const whisperPairs = (state.aiDialogue?.timeline ?? [])
    .filter((entry) => ["whisper-out", "whisper-in", "public", "ai-private"].includes(entry.mode))
    .map((entry, index) => ({
      index,
      id: entry.id ?? "",
      timestamp: entry.timestamp ?? 0,
      day: entry.day ?? 0,
      night: entry.night ?? 0,
      mode: entry.mode ?? "",
      speakerId: entry.speakerId ?? "",
      speakerName: replayPlayerName(state, entry.speakerId),
      targetId: entry.targetId ?? "",
      targetName: replayPlayerName(state, entry.targetId),
      focusId: entry.focusId ?? "",
      focusName: replayPlayerName(state, entry.focusId),
      llmRender: entry.llmRender ?? null,
      text: replaySafeText(entry.text),
    }));
  return {
    schemaVersion: 1,
    generatedAt: generatedAt.toISOString(),
    game: {
      id: state.id ?? "",
      scriptId: state.scriptId ?? "",
      scriptName: state.scriptName ?? "",
      phase: state.phase ?? "",
      day: state.day ?? 0,
      night: state.night ?? 0,
      dayStage: state.dayStage ?? "",
      gameOver: !!state.gameOver,
      winner: state.winner ?? "",
      winnerReason: replaySafeText(state.winnerReason),
      revision: state.unityBridge?.revision ?? 0,
    },
    lastAction: {
      id: action?.id ?? state.unityBridge?.lastActionId ?? "",
      type: action?.type ?? state.unityBridge?.lastActionType ?? "",
      payload: action?.payload ?? {},
      ok: !!result?.ok,
      message: replaySafeText(result?.message ?? result?.reason ?? ""),
    },
    players: players.map((player) => ({
      id: player.id,
      seat: player.seatIndex + 1,
      name: player.name,
      human: !!player.isHuman,
      alive: !!player.alive,
      ghostVoteAvailable: !!player.ghostVoteAvailable,
      publicClaimRoleId: player.publicClaimRoleId ?? "",
    })),
    debugTruth: players.map((player) => ({
      id: player.id,
      seat: player.seatIndex + 1,
      name: player.name,
      roleId: player.roleId ?? "",
      roleName: player.roleName ?? "",
      apparentRoleId: player.apparentRoleId ?? "",
      apparentRoleName: player.apparentRoleName ?? "",
      team: player.team ?? "",
      category: player.category ?? "",
      poisoned: !!player.poisoned,
      drunk: !!player.drunk,
    })),
    dialogue: {
      timeline: whisperPairs,
      speeches,
      logs: (state.logs ?? []).slice(-200).map((entry, index) => ({
        index,
        day: entry.day ?? 0,
        night: entry.night ?? 0,
        type: entry.type ?? "",
        message: replaySafeText(entry.message),
        meta: entry.meta ?? {},
      })),
    },
    ai: {
      recap: getAIInsightRows(state).map((row) => ({
        playerId: row.playerId,
        playerName: row.playerName,
        persona: row.persona,
        topSuspicion: row.targets?.[0] ?? null,
      })),
    },
  };
}

function writeDialogueReplaySnapshot(state, options = {}) {
  if (options.disableReplayRecorder) {
    return null;
  }
  const replay = buildDialogueReplay(state, options);
  const replayPath = replayPathFor(state, options);
  const latestPath = latestReplayPathFor(options);
  writeJson(replayPath, replay);
  writeJson(latestPath, replay);
  return { replayPath, latestPath };
}

function bridgeLLMRendererEnabled(options = {}) {
  return options.llmRenderer === true || process.env.BOTC_LLM_RENDERER === "1";
}

function llmDialogueTargetName(state, entry = {}) {
  return replayPlayerName(state, entry.focusId || entry.targetId);
}

function llmDialogueRequiredTerms(state, entry = {}) {
  const target = llmDialogueTargetName(state, entry);
  return target ? [target] : [];
}

function llmDialogueAudience(entry = {}) {
  if (entry.private || `${entry.mode ?? ""}`.includes("whisper")) return "private";
  if (entry.debateBeat || `${entry.mode ?? ""}`.includes("nomination")) return "nomination";
  return "public";
}

async function renderBridgeDialogueLine(state, entry, text, options = {}) {
  const speakerId = entry.playerId || entry.speakerId;
  const llmConfig = resolveLLMRendererConfig({
    enabled: true,
    provider: options.llmProvider,
    timeoutMs: options.llmTimeoutMs ?? DEFAULT_LLM_DIALOGUE_TIMEOUT_MS,
  });
  return renderSpeechWithLocalLLM(
    {
      speakerName: replayPlayerName(state, speakerId),
      targetName: llmDialogueTargetName(state, entry),
      audience: llmDialogueAudience(entry),
      intent: entry.debateBeat ? "nomination_debate" : entry.private ? "private_reply" : "public_table_talk",
      persona: getPlayerById(state, speakerId)?.aiPersona ?? "steady",
      candidateText: text,
      evidence: entry.evidenceContract?.summaries ?? [],
      requiredTerms: llmDialogueRequiredTerms(state, entry),
      forbiddenTerms: ["PRIVATE_SECRET_MARKER", "真实身份", "恶魔伪装", "邪恶互认"],
      maxChars: entry.private ? 170 : entry.debateBeat ? 150 : 130,
    },
    {
      enabled: true,
      provider: llmConfig.provider,
      endpoint: llmConfig.endpoint,
      model: llmConfig.model,
      timeoutMs: llmConfig.timeoutMs,
    }
  );
}

async function applyLLMDialoguePostprocess(state, beforeSnapshot = {}, options = {}) {
  if (!bridgeLLMRendererEnabled(options)) {
    return { enabled: false, touched: 0, fallback: 0 };
  }
  const llmConfig = resolveLLMRendererConfig({
    enabled: true,
    provider: options.llmProvider,
    timeoutMs: options.llmTimeoutMs ?? DEFAULT_LLM_DIALOGUE_TIMEOUT_MS,
  });

  const speeches = state.events?.speeches ?? [];
  const timeline = state.aiDialogue?.timeline ?? [];
  let touched = 0;
  let fallback = 0;

  for (const speech of speeches.slice(beforeSnapshot.speechCount ?? speeches.length)) {
    if (!speech || playerIsHuman(state, speech.playerId) || !speech.line) continue;
    const result = await renderBridgeDialogueLine(state, speech, speech.line, options);
    if (result.text && result.text !== speech.line) {
      speech.llmRender = { source: result.source, fallbackUsed: result.fallbackUsed, reason: result.reason };
      speech.line = result.text;
      touched += 1;
      if (result.fallbackUsed) fallback += 1;
    }
  }

  for (const entry of timeline.slice(beforeSnapshot.timelineCount ?? timeline.length)) {
    if (
      !entry ||
      playerIsHuman(state, entry.speakerId) ||
      entry.hiddenFromHuman ||
      entry.mode === "ai-private" ||
      entry.mode === "whisper-out" ||
      !entry.text
    ) {
      continue;
    }
    const result = await renderBridgeDialogueLine(state, entry, entry.text, options);
    if (result.text && result.text !== entry.text) {
      entry.llmRender = { source: result.source, fallbackUsed: result.fallbackUsed, reason: result.reason };
      entry.text = result.text;
      if (state.aiDialogue?.activeSpeech?.id === entry.id) {
        state.aiDialogue.activeSpeech.text = result.text;
        state.aiDialogue.activeSpeech.llmRender = entry.llmRender;
      }
      touched += 1;
      if (result.fallbackUsed) fallback += 1;
    }
  }

  state.unityBridge.llmRenderer = {
    enabled: true,
    provider: llmConfig.provider,
    source: llmConfig.provider,
    model: llmConfig.model,
    touched,
    fallback,
    updatedAt: new Date().toISOString(),
  };
  return { enabled: true, touched, fallback };
}

function makeInitialState({ scriptId = "tb", playerCount = 9, preferredHumanRoleId = "washerwoman", seed = 20260506 } = {}) {
  const rng = withSeededRandom(seed);
  const state = createNewGame({ scriptId, playerCount, preferredHumanRoleId }, rng);
  initializeAI(state);
  beginNightPhase(state);
  initializeAI(state);
  ensureUnityBridge(state);
  state.unityBridge.status = "ready";
  state.unityBridge.message = "Unity bridge initialized. 第一夜已开始。";
  return state;
}

function unwrapState(parsed) {
  return parsed?.state ?? parsed;
}

export function loadOrCreateUnityState(statePath, options = {}) {
  if (options.freshState) {
    const state = makeInitialState(options);
    ensureUnityBridge(state);
    return state;
  }
  const parsed = readJson(statePath, null);
  const state = parsed ? unwrapState(parsed) : makeInitialState(options);
  ensureUnityBridge(state);
  return state;
}

function ensureUnityBridge(state) {
  state.unityBridge = state.unityBridge ?? {};
  state.unityBridge.revision = Number.isFinite(state.unityBridge.revision) ? state.unityBridge.revision : 0;
  state.unityBridge.lastActionId = state.unityBridge.lastActionId ?? "";
  state.unityBridge.lastActionType = state.unityBridge.lastActionType ?? "";
  state.unityBridge.selectedPlayerId = state.unityBridge.selectedPlayerId ?? "";
  state.unityBridge.status = state.unityBridge.status ?? "idle";
  state.unityBridge.message = state.unityBridge.message ?? "";
  state.unityBridge.updatedAt = state.unityBridge.updatedAt ?? "";
  return state.unityBridge;
}

function normalizeActionType(type) {
  const normalized = `${type ?? ""}`.trim().toLowerCase();
  const aliases = {
    "private-preset": "private-chat",
    "proactive-whispers": "ai-proactive-whispers",
    "reject-proactive-whisper": "decline-proactive-whisper",
    "ai-ai-whispers": "ai-private-whispers",
    "public": "public-discussion",
    "public-step": "ai-public-step",
    "conversation-step": "ai-public-step",
    "nomination-intent": "human-nomination-intent",
    "resolve-vote": "resolve-nomination-vote",
  };
  return aliases[normalized] ?? normalized;
}

function normalizeAction(raw) {
  const action = Array.isArray(raw) ? raw[raw.length - 1] : raw;
  if (!action || typeof action !== "object") {
    return null;
  }
  const type = normalizeActionType(action.type);
  if (!type) {
    return null;
  }
  return {
    id: `${action.id ?? `${Date.now()}-${Math.floor(Math.random() * 100000)}`}`,
    type,
    payload: action.payload && typeof action.payload === "object" ? action.payload : {},
    createdAt: action.createdAt ?? new Date().toISOString(),
  };
}

function firstNonHumanPlayerId(state) {
  return state.players?.find((player) => !player.isHuman)?.id ?? "";
}

function humanPlayerId(state) {
  return state.players?.find((player) => player.isHuman)?.id ?? "";
}

function selectedOrPayloadPlayerId(state, payload) {
  return payload.playerId ?? payload.targetId ?? state.unityBridge?.selectedPlayerId ?? firstNonHumanPlayerId(state);
}

function selectedPlayerIdFromActionResult(action, payload, result) {
  if (!result?.ok) return "";
  if (action?.type === "select-token") {
    return result.selectedPlayerId ?? payload.playerId ?? payload.targetId ?? "";
  }
  if (action?.type === "accept-proactive-whisper") {
    return result.targetId ?? result.playerId ?? payload.playerId ?? payload.targetId ?? "";
  }
  return "";
}

function updateBridgeSelectionFromActionResult(state, bridge, action, payload, result) {
  const selectedPlayerId = selectedPlayerIdFromActionResult(action, payload, result);
  if (!selectedPlayerId) return;
  const player = getPlayerById(state, selectedPlayerId);
  if (player) bridge.selectedPlayerId = player.id;
}

function normalizePrivateIntentHint(intentHint) {
  const normalized = `${intentHint ?? ""}`.trim().toLowerCase();
  const aliases = {
    identity: "claim",
    role: "claim",
    "followup-range": "claim",
    "followup-claim": "claim",
    "followup-proof": "reason",
    "followup-reason": "reason",
    "followup-night": "night",
    "followup-nomination": "vote",
    "followup-vote": "vote",
    nomination: "vote",
    proposal: "vote",
    voting: "vote",
    accuse: "suspect",
    pressure: "suspect",
    proof: "reason",
    evidence: "reason",
    strategy: "plan",
  };
  return aliases[normalized] ?? normalized;
}

function privateIntentHintFromPayload(payload = {}) {
  return normalizePrivateIntentHint(payload.intentHint ?? payload.intent ?? "generic");
}

function defaultPrivateQuestion(payload) {
  if (payload.text) return payload.text;
  if (privateIntentHintFromPayload(payload) === "claim") return "你是什么身份？";
  if (privateIntentHintFromPayload(payload) === "night") return "你昨晚拿到了什么信息？";
  if (privateIntentHintFromPayload(payload) === "trust") return "你现在最信谁？";
  if (privateIntentHintFromPayload(payload) === "suspect") return "你现在最怀疑谁？";
  if (privateIntentHintFromPayload(payload) === "vote") return "你今天想提名谁，或者会投谁？";
  if (privateIntentHintFromPayload(payload) === "reason") return "给我两个你判断的关键理由。";
  if (privateIntentHintFromPayload(payload) === "plan") return "你觉得我们下一步应该怎么推进？";
  return "我想确认一下你的信息和站边。";
}

function normalizePrivateDeception(payload = {}) {
  if (payload.deception && typeof payload.deception === "object") {
    return payload.deception;
  }
  const deception = {};
  if (payload.claimRoleId || payload.roleId) deception.claimRoleId = payload.claimRoleId ?? payload.roleId;
  if (payload.nightInfo) deception.nightInfo = payload.nightInfo;
  if (payload.askSecret === true || payload.askSecret === "true") deception.askSecret = true;
  return deception;
}

function maybeEnterPublicStage(state) {
  if (state.phase !== "day" || state.gameOver) {
    return { ok: false, reason: "当前不在白天流程，无法进入公聊。" };
  }
  if (state.dayStage === "private") {
    return advanceDayStage(state, "public");
  }
  if (state.dayStage === "public") {
    return { ok: true, stage: "public" };
  }
  return { ok: false, reason: "当前已经不在公聊前置阶段。" };
}

function maybeEnterNominationStage(state, rng) {
  if (state.phase !== "day" || state.gameOver) {
    return { ok: false, reason: "当前不在白天流程，无法进入提名。" };
  }
  if (state.dayStage === "private") {
    const publicResult = advanceDayStage(state, "public");
    if (!publicResult.ok) return publicResult;
    runAIDiscussion(state, rng);
    markPublicDiscussionRound(state);
  }
  if (state.dayStage === "public") {
    if ((state.dayStageMeta?.publicRounds ?? 0) <= 0) {
      runAIDiscussion(state, rng);
      markPublicDiscussionRound(state);
    }
    return advanceDayStage(state, "nomination");
  }
  if (state.dayStage === "nomination") {
    return { ok: true, stage: "nomination" };
  }
  return { ok: false, reason: "无法进入提名阶段。" };
}

function applyPhaseAction(state, payload, rng) {
  const stage = `${payload.stage ?? payload.dayStage ?? ""}`.trim();
  const confirmed = payload.confirmed === true || payload.force === true || payload.mode === "confirm";
  const guard = buildUnityPhaseAdvance(state, { targetStage: stage, confirmed });
  if (guard.blocked || guard.requiresConfirm) {
    return {
      ok: false,
      reason: guard.reason,
      requiresConfirm: guard.requiresConfirm,
      phaseAdvance: guard,
    };
  }
  if (stage === "public") {
    const result = maybeEnterPublicStage(state);
    if (result.ok) {
      runAIDiscussion(state, rng);
      markPublicDiscussionRound(state);
      addLog(state, "unity-action", "Unity 发起了一轮公聊。", { source: "unity" });
    }
    return result;
  }
  if (stage === "nomination") {
    if (state.phase !== "day" || state.dayStage !== "public") {
      return { ok: false, reason: "请先按顺序进入公聊，并完成至少一轮公聊。" };
    }
    return advanceDayStage(state, "nomination");
  }
  if (stage === "day" && state.phase === "night") {
    runNight(state, rng);
    return { ok: true, stage: "day", message: "夜晚已结算，进入白天。" };
  }
  if (stage === "night") {
    if (state.phase === "day" && !state.gameOver) {
      if (!canResolveDayIntoNight(state) && !skipDay(state)) {
        return { ok: false, reason: "当前无法结束白天；请先进入提名阶段。" };
      }
      runNight(state, rng);
      return { ok: true, stage: "night", message: "白天已结束，夜晚结算完成。" };
    }
    return { ok: false, reason: "当前无法切入夜晚。" };
  }
  return advanceDayStage(state, stage || null);
}

function firstActionTargetIds(action, count = 1) {
  return (action.options ?? []).slice(0, Math.max(0, count)).map((entry) => entry.id).filter(Boolean);
}

function firstActionRoleId(action) {
  return action.roleOptions?.find((entry) => entry.id)?.id ?? "";
}

function completeRoleActionInput(action, payload = {}) {
  const inputType = action?.inputType ?? "player-target";
  const minTargets = action?.minTargetCount ?? action?.targetCount ?? 1;
  const maxTargets = action?.maxTargetCount ?? action?.targetCount ?? minTargets;
  const targetIds = Array.isArray(payload.targetIds)
    ? payload.targetIds
    : [payload.targetId ?? payload.playerId].filter(Boolean);
  const roleId = payload.roleId ?? payload.selectedRoleId ?? firstActionRoleId(action);

  if (inputType === "role") {
    return { roleId };
  }
  if (inputType === "player-role") {
    return {
      targetIds: targetIds.length > 0 ? targetIds.slice(0, maxTargets) : firstActionTargetIds(action, minTargets),
      roleId,
    };
  }
  if (inputType === "question") {
    return { question: payload.question ?? payload.text ?? "Is there a demon in play?" };
  }
  if (inputType === "info") {
    return {};
  }
  if (inputType === "guesses") {
    const guesses = Array.isArray(payload.guesses) ? payload.guesses : [];
    if (guesses.length > 0) return { guesses };
    const players = firstActionTargetIds(action, Math.max(1, action.minGuessCount ?? 1));
    return {
      guesses: players.map((playerId) => ({ playerId, roleId: firstActionRoleId(action) })),
    };
  }
  if (inputType === "charge-or-targets") {
    const mode = payload.mode ?? action.modes?.find((entry) => entry.id === "kill")?.id ?? action.modes?.[0]?.id ?? "kill";
    if (mode === "charge" || mode === "none") {
      return { mode };
    }
    return {
      mode,
      targetIds: targetIds.length > 0 ? targetIds.slice(0, maxTargets) : firstActionTargetIds(action, minTargets),
    };
  }
  return {
    targetIds: targetIds.length > 0 ? targetIds.slice(0, maxTargets) : firstActionTargetIds(action, minTargets),
  };
}

function applyHumanNightAction(state, payload) {
  const action = getHumanNightActionState(state);
  if (!action.available) {
    return { ok: false, reason: action.reason };
  }
  const plan = completeRoleActionInput(action, payload);
  const result = setHumanNightActionPlan(state, plan);
  return result.ok
    ? { ...result, message: `夜间行动已预设：${result.roleName} -> ${result.targetNames ?? "无"}` }
    : result;
}

function applyHumanDayAction(state, payload) {
  const action = getHumanDayActionState(state);
  if (!action.available) {
    return { ok: false, reason: action.reason };
  }
  const plan = completeRoleActionInput(action, payload);
  const result = setHumanDayActionPlan(state, plan);
  return result.ok
    ? { ...result, message: `白天行动已预设：${result.roleName} -> ${result.targetNames ?? "无"}` }
    : result;
}

function applyStorytellerAction(state, payload) {
  const action = getPendingStorytellerActionState(state);
  if (!action.available) {
    return { ok: false, reason: action.reason ?? "当前没有待处理的说书人行动。" };
  }
  const input = completeRoleActionInput(action, payload);
  const result = resolvePendingStorytellerAction(state, input);
  return result.ok
    ? { ...result, message: "说书人行动已处理。" }
    : result;
}

function applyReminderAction(state, payload) {
  const playerId = payload.playerId ?? payload.targetId ?? state.unityBridge?.selectedPlayerId ?? "";
  const reminder = `${payload.reminder ?? payload.text ?? "守护"}`.trim();
  if (!playerId) {
    return { ok: false, reason: "请先选择一个 token。" };
  }
  if (payload.mode === "remove" || payload.remove === true) {
    return removeGrimoireReminder(state, { playerId, reminder });
  }
  if (payload.mode === "clear") {
    return clearGrimoireNote(state, { playerId });
  }
  return addGrimoireReminder(state, { playerId, reminder });
}

function applyMarkedRoleAction(state, payload) {
  const playerId = payload.playerId ?? payload.targetId ?? state.unityBridge?.selectedPlayerId ?? "";
  if (!playerId) {
    return { ok: false, reason: "请先选择一个 token。" };
  }
  return setGrimoireMarkedRole(state, { playerId, roleId: payload.roleId ?? "" });
}

function applyNominationAction(state, payload, rng) {
  if (state.phase !== "day" || state.dayStage !== "nomination") {
    return {
      ok: false,
      reason: "尚未进入提名阶段。请先完成公聊，再推进到提名。",
      phaseAdvance: buildUnityPhaseAdvance(state, { targetStage: "nomination" }),
    };
  }
  const nominatorId = payload.nominatorId ?? humanPlayerId(state);
  const nomineeId = payload.nomineeId ?? payload.targetId ?? state.unityBridge?.selectedPlayerId ?? "";
  if (!nomineeId) {
    return { ok: true, message: "已进入提名阶段。接下来请选择被提名者 token。", stage: "nomination" };
  }
  const result = resolveNominationAndVote(
    state,
    {
      nominatorId,
      nomineeId,
      humanVoteYes: payload.humanVoteYes ?? true,
      decideAIVote,
    },
    rng
  );
  return {
    ok: !!result.accepted,
    message: result.accepted
      ? `提名已结算：${getPlayerById(state, nominatorId)?.name ?? nominatorId} -> ${getPlayerById(state, nomineeId)?.name ?? nomineeId}`
      : result.reason,
    result,
  };
}

function ensureNominationStageForWindow(state) {
  if (state.phase !== "day" || state.gameOver) {
    return { ok: false, reason: "当前不在白天流程，无法开启提名窗口。" };
  }
  if (state.dayStage === "private") {
    return { ok: false, reason: "请先进入公聊，再开启提名窗口。" };
  }
  if (state.dayStage === "public") {
    const result = advanceDayStage(state, "nomination");
    if (!result.ok) return result;
  }
  if (state.dayStage !== "nomination") {
    return { ok: false, reason: "当前无法开启提名窗口。" };
  }
  return { ok: true };
}

function applyPublicConversationStepAction(state, payload, rng) {
  const publicResult = maybeEnterPublicStage(state);
  if (!publicResult.ok) {
    return publicResult;
  }
  const result = runAIConversationStep(state, rng);
  return result.ok
    ? { ...result, message: result.message ?? "公聊推进一步。" }
    : result;
}

function applyOpenNominationWindowAction(state, payload) {
  const stageResult = ensureNominationStageForWindow(state);
  if (!stageResult.ok) return stageResult;
  return openNominationWindow(state, {
    ticks: payload.ticks ?? payload.budget ?? 4,
    actorId: humanPlayerId(state),
    intent: "open",
  });
}

function proposalToDebate(state, proposal, rng) {
  if (!proposal) {
    return null;
  }
  return createNominationDebate(
    state,
    {
      nominatorId: proposal.nominatorId,
      nomineeId: proposal.nomineeId,
      reason: proposal.reason,
      source: "ai",
    },
    rng
  );
}

function applyAINominationStepAction(state, payload, rng) {
  const stageResult = ensureNominationStageForWindow(state);
  if (!stageResult.ok) return stageResult;
  if (!state.dayStageMeta?.nominationClock?.active) {
    openNominationWindow(state, { ticks: payload.ticks ?? payload.budget ?? 4, actorId: null, intent: "auto-open" });
  }
  if (state.dayStageMeta?.nominationDebate?.active) {
    return { ok: true, message: "已有待处理的提名互辩。", debate: state.dayStageMeta.nominationDebate };
  }
  const proposal = chooseAINomination(state);
  if (proposal) {
    closeNominationWindow(state, { status: "nomination-made", actorId: proposal.nominatorId, intent: "ai-nomination" });
    return proposalToDebate(state, proposal, rng);
  }
  const tick = tickNominationWindow(state, { actorId: null, intent: "ai-hesitated" });
  return {
    ok: true,
    message: tick.nominationClock?.status === "expired" ? "AI 未发起提名，提名窗口已耗尽。" : "AI 暂未提名，提名窗口推进一步。",
    nominationClock: tick.nominationClock,
  };
}

function applyHumanNominationIntentAction(state, payload, rng) {
  const stageResult = ensureNominationStageForWindow(state);
  if (!stageResult.ok) return stageResult;
  if (state.dayStageMeta?.nominationDebate?.active) {
    return { ok: true, message: "已有待处理的提名互辩。", debate: state.dayStageMeta.nominationDebate };
  }
  const nominatorId = payload.nominatorId ?? humanPlayerId(state);
  const nomineeId = payload.nomineeId ?? payload.targetId ?? state.unityBridge?.selectedPlayerId ?? "";
  if (!nomineeId) {
    return { ok: false, reason: "请选择被提名者。" };
  }
  closeNominationWindow(state, { status: "nomination-made", actorId: nominatorId, intent: "human-nomination" });
  return createNominationDebate(
    state,
    {
      nominatorId,
      nomineeId,
      reason: payload.reason ?? `我提 ${getPlayerById(state, nomineeId)?.name ?? nomineeId}。先上台听完整回应，再看票型。`,
      source: "human",
    },
    rng
  );
}

function applyResolveNominationVoteAction(state, payload, rng) {
  const debate = state.dayStageMeta?.nominationDebate;
  if (!debate?.active) {
    return { ok: false, reason: "当前没有待结算的提名互辩。" };
  }
  const result = resolveNominationAndVote(
    state,
    {
      nominatorId: debate.nominatorId,
      nomineeId: debate.nomineeId,
      humanVoteYes: payload.humanVoteYes ?? true,
      decideAIVote,
    },
    rng
  );
  debate.active = false;
  debate.resolved = !!result.accepted;
  debate.voteResult = result.accepted
    ? {
        passed: !!result.passed,
        yesVotes: result.yesVotes ?? 0,
        threshold: result.threshold ?? 0,
      }
    : null;
  state.dayStageMeta.nominationDebate = debate;
  return {
    ok: !!result.accepted,
    message: result.accepted ? "提名互辩结束，投票已结算。" : result.reason,
    result,
  };
}

function applyNominationDebateResponseAction(state, payload) {
  return recordNominationDebateResponse(state, {
    speakerId: payload.speakerId ?? payload.playerId ?? humanPlayerId(state),
    text: payload.text ?? "",
  });
}

function applyPassNominationWindowAction(state, payload, rng) {
  const stageResult = ensureNominationStageForWindow(state);
  if (!stageResult.ok) return stageResult;
  closeNominationWindow(state, { status: "passed", actorId: humanPlayerId(state), intent: "pass" });
  const skipped = skipDay(state);
  if (payload.toNight === false) {
    return { ok: skipped, message: skipped ? "提名窗口耗尽，今天无人处决。" : "当前无法空过白天。" };
  }
  if (skipped && !state.gameOver) {
    beginNightPhase(state);
    return { ok: true, stage: "night", message: "提名窗口耗尽，今天无人处决，进入夜晚。" };
  }
  return { ok: skipped, message: skipped ? "提名窗口耗尽，今天无人处决。" : "当前无法空过白天。" };
}

function applyAIProactiveWhisperAction(state, payload, rng) {
  const offers = runAIProactiveWhispers(state, rng, { queueOnly: true });
  return {
    ok: true,
    message:
      offers.length > 0
        ? `AI 主动私聊邀请：${offers.length} 条。玩家可选择接受或拒绝。`
        : "当前没有新的 AI 主动私聊邀请。",
    offers,
  };
}

function applyAcceptProactiveWhisperAction(state, payload, rng) {
  const offerId = payload.offerId ?? payload.id ?? state.aiDialogue?.pendingProactiveWhispers?.[0]?.id ?? "";
  if (!offerId) {
    return { ok: false, reason: "当前没有可接受的主动私聊邀请。" };
  }
  return acceptAIProactiveWhisper(state, offerId, rng);
}

function applyDeclineProactiveWhisperAction(state, payload) {
  const offerId = payload.offerId ?? payload.id ?? state.aiDialogue?.pendingProactiveWhispers?.[0]?.id ?? "";
  if (!offerId) {
    return { ok: false, reason: "当前没有可拒绝的主动私聊邀请。" };
  }
  return declineAIProactiveWhisper(state, offerId);
}

function applyAIPrivateWhisperAction(state, rng) {
  const messages = runAIToAIPrivateWhispers(state, rng);
  return {
    ok: true,
    message: messages.length > 0 ? `AI 之间完成 ${messages.length} 组私聊。内容不进入玩家日志。` : "当前没有 AI-AI 私聊。",
    count: messages.length,
  };
}

export function applyUnityAction(state, rawAction, rng = Math.random) {
  const action = normalizeAction(rawAction);
  if (!action) {
    return { ok: false, skipped: true, reason: "No valid Unity action." };
  }

  let bridge = ensureUnityBridge(state);
  if (bridge.lastActionId === action.id) {
    return { ok: true, skipped: true, reason: "Action already processed.", action };
  }

  initializeAI(state);
  let result = { ok: true };
  const payload = action.payload ?? {};

  try {
    if (action.type === "new-game") {
      const next = makeInitialState({
        scriptId: payload.scriptId ?? state.scriptId ?? "tb",
        playerCount: Number(payload.playerCount ?? state.players?.length ?? 9) || 9,
        preferredHumanRoleId: payload.preferredHumanRoleId ?? payload.roleId ?? "",
        seed: Number(payload.seed ?? Date.now()) || Date.now(),
      });
      Object.keys(state).forEach((key) => delete state[key]);
      Object.assign(state, next);
      bridge = ensureUnityBridge(state);
      result = { ok: true, message: "新局已创建。" };
    } else if (action.type === "select-token") {
      const playerId = selectedOrPayloadPlayerId(state, payload);
      const player = getPlayerById(state, playerId);
      if (!player) {
        result = { ok: false, reason: "选中的玩家不存在。" };
      } else {
        result = { ok: true, message: `已选中 ${player.name}。`, selectedPlayerId: player.id };
      }
    } else if (action.type === "private-chat") {
      const targetId = selectedOrPayloadPlayerId(state, payload);
      const text = defaultPrivateQuestion(payload);
      result = runPrivateWhisper(
        state,
        {
          targetId,
          humanLine: text,
          intentHint: privateIntentHintFromPayload(payload),
          deception: normalizePrivateDeception(payload),
        },
        rng
      );
    } else if (action.type === "ai-proactive-whispers") {
      result = applyAIProactiveWhisperAction(state, payload, rng);
    } else if (action.type === "accept-proactive-whisper") {
      result = applyAcceptProactiveWhisperAction(state, payload, rng);
    } else if (action.type === "decline-proactive-whisper") {
      result = applyDeclineProactiveWhisperAction(state, payload);
    } else if (action.type === "ai-private-whispers") {
      result = applyAIPrivateWhisperAction(state, rng);
    } else if (action.type === "ai-public-step") {
      result = applyPublicConversationStepAction(state, payload, rng);
    } else if (action.type === "open-nomination-window") {
      result = applyOpenNominationWindowAction(state, payload);
    } else if (action.type === "ai-nomination-step") {
      result = applyAINominationStepAction(state, payload, rng);
    } else if (action.type === "human-nomination-intent") {
      result = applyHumanNominationIntentAction(state, payload, rng);
    } else if (action.type === "nomination-debate-response") {
      result = applyNominationDebateResponseAction(state, payload);
    } else if (action.type === "resolve-nomination-vote") {
      result = applyResolveNominationVoteAction(state, payload, rng);
    } else if (action.type === "pass-nomination-window") {
      result = applyPassNominationWindowAction(state, payload, rng);
    } else if (action.type === "public-discussion" || action.type === "phase") {
      result = applyPhaseAction(state, { stage: action.type === "phase" ? payload.stage : "public", ...payload }, rng);
    } else if (action.type === "nomination") {
      result = applyNominationAction(state, payload, rng);
    } else if (action.type === "night-action") {
      result = applyHumanNightAction(state, payload);
    } else if (action.type === "day-action") {
      result = applyHumanDayAction(state, payload);
    } else if (action.type === "storyteller-action") {
      result = applyStorytellerAction(state, payload);
    } else if (action.type === "grimoire-reminder") {
      result = applyReminderAction(state, payload);
    } else if (action.type === "grimoire-mark-role") {
      result = applyMarkedRoleAction(state, payload);
    } else if (action.type === "script-handbook") {
      bridge.scriptHandbookOpen = payload.mode === "open" ? true : typeof payload.open === "boolean" ? payload.open : !bridge.scriptHandbookOpen;
      bridge.scriptHandbookTab = payload.tab ?? bridge.scriptHandbookTab ?? "roles";
      result = { ok: true, message: bridge.scriptHandbookOpen ? "剧本手册已打开。" : "剧本手册已关闭。" };
    } else if (action.type === "ai-nomination") {
      const proposal = chooseAINomination(state);
      result = proposal
        ? applyNominationAction(state, { nominatorId: proposal.nominatorId, nomineeId: proposal.nomineeId, humanVoteYes: true }, rng)
        : { ok: false, reason: "AI 暂无提名目标。" };
    } else if (action.type === "toggle-grimoire") {
      state.grimoireView = typeof payload.value === "boolean" ? payload.value : !state.grimoireView;
      result = { ok: true, message: state.grimoireView ? "魔典全知视角已开启。" : "魔典全知视角已关闭。" };
    } else {
      result = { ok: false, reason: `未知 Unity 行动类型：${action.type}` };
    }
  } catch (error) {
    result = { ok: false, reason: error?.message ?? `${error}` };
  }

  bridge.revision += 1;
  bridge.lastActionId = action.id;
  bridge.lastActionType = action.type;
  bridge.status = result.ok ? "ok" : "error";
  bridge.message = result.message ?? result.reason ?? "";
  bridge.updatedAt = new Date().toISOString();
  updateBridgeSelectionFromActionResult(state, bridge, action, payload, result);
  initializeAI(state);
  return { ...result, action };
}

export function writeUnityBridgeOutputs({ state, statePath, viewModelPath, resultPath, action, result, replayDir, replayPath, latestReplayPath, disableReplayRecorder }) {
  ensureUnityBridge(state);
  const aiInsights = getAIInsightRows(state);
  const viewModel = buildUnityViewModel(state, { aiInsights });
  writeJson(statePath, { state });
  fs.mkdirSync(path.dirname(viewModelPath), { recursive: true });
  fs.writeFileSync(viewModelPath, stringifyUnityViewModel(viewModel), "utf8");
  const replayPaths = writeDialogueReplaySnapshot(state, { action, result, replayDir, replayPath, latestReplayPath, disableReplayRecorder });
  if (resultPath) {
    writeJson(resultPath, {
      actionId: action?.id ?? "",
      actionType: action?.type ?? "",
      ok: !!result?.ok,
      skipped: !!result?.skipped,
      message: result?.message ?? result?.reason ?? "",
      llmRenderer: result?.llmRenderer ?? null,
      revision: state.unityBridge.revision,
      updatedAt: state.unityBridge.updatedAt ?? new Date().toISOString(),
      replayPath: replayPaths?.replayPath ?? "",
      latestReplayPath: replayPaths?.latestPath ?? "",
    });
  }
  return viewModel;
}

export function processUnityActionFile(options = {}) {
  const statePath = path.resolve(options.statePath ?? DEFAULT_STATE_PATH);
  const viewModelPath = path.resolve(options.viewModelPath ?? DEFAULT_VIEWMODEL_PATH);
  const actionPath = path.resolve(options.actionPath ?? DEFAULT_ACTION_PATH);
  const resultPath = path.resolve(options.resultPath ?? DEFAULT_RESULT_PATH);
  const seed = Number(options.seed ?? 20260506) || 20260506;
  const rng = withSeededRandom(seed + Date.now());

  const state = loadOrCreateUnityState(statePath, options);
  const action = normalizeAction(readJson(actionPath, null));
  const result = action ? applyUnityAction(state, action, rng) : { ok: true, skipped: true, reason: "No action file." };
  const viewModel = writeUnityBridgeOutputs({
    state,
    statePath,
    viewModelPath,
    resultPath,
    action,
    result,
    replayDir: options.replayDir,
    replayPath: options.replayPath,
    latestReplayPath: options.latestReplayPath,
    disableReplayRecorder: options.disableReplayRecorder,
  });
  return { state, action, result, viewModel, paths: { statePath, viewModelPath, actionPath, resultPath } };
}

export async function processUnityActionFileAsync(options = {}) {
  const statePath = path.resolve(options.statePath ?? DEFAULT_STATE_PATH);
  const viewModelPath = path.resolve(options.viewModelPath ?? DEFAULT_VIEWMODEL_PATH);
  const actionPath = path.resolve(options.actionPath ?? DEFAULT_ACTION_PATH);
  const resultPath = path.resolve(options.resultPath ?? DEFAULT_RESULT_PATH);
  const seed = Number(options.seed ?? 20260506) || 20260506;
  const rng = withSeededRandom(seed + Date.now());

  const state = loadOrCreateUnityState(statePath, options);
  const action = normalizeAction(readJson(actionPath, null));
  const beforeSnapshot = {
    speechCount: state.events?.speeches?.length ?? 0,
    timelineCount: state.aiDialogue?.timeline?.length ?? 0,
  };
  const result = action ? applyUnityAction(state, action, rng) : { ok: true, skipped: true, reason: "No action file." };
  if (action && result.ok) {
    const llmResult = await applyLLMDialoguePostprocess(state, beforeSnapshot, options);
    if (llmResult.enabled && llmResult.touched > 0) {
      result.llmRenderer = llmResult;
    }
  }
  const viewModel = writeUnityBridgeOutputs({
    state,
    statePath,
    viewModelPath,
    resultPath,
    action,
    result,
    replayDir: options.replayDir,
    replayPath: options.replayPath,
    latestReplayPath: options.latestReplayPath,
    disableReplayRecorder: options.disableReplayRecorder,
  });
  return { state, action, result, viewModel, paths: { statePath, viewModelPath, actionPath, resultPath } };
}

async function watchUnityActions(options = {}) {
  const actionPath = path.resolve(options.actionPath ?? DEFAULT_ACTION_PATH);
  const pollMs = Number(options.pollMs ?? 350) || 350;
  let lastMtime = 0;
  console.log(`Watching Unity actions: ${actionPath}`);
  console.log("Press Ctrl+C to stop.");
  try {
    const { result, paths } = await processUnityActionFileAsync(options);
    const stat = fs.existsSync(actionPath) ? fs.statSync(actionPath) : null;
    lastMtime = stat?.mtimeMs ?? 0;
    console.log(`[${new Date().toLocaleTimeString()}] init ${result.ok ? "ok" : "error"} -> ${paths.viewModelPath}`);
  } catch (error) {
    console.error(`Unity action bridge init error: ${error?.stack ?? error}`);
  }
  for (;;) {
    try {
      const stat = fs.existsSync(actionPath) ? fs.statSync(actionPath) : null;
      const mtime = stat?.mtimeMs ?? 0;
      if (mtime > 0 && mtime !== lastMtime) {
        lastMtime = mtime;
        const { result, paths } = await processUnityActionFileAsync(options);
        console.log(`[${new Date().toLocaleTimeString()}] ${result.ok ? "ok" : "error"} r=${readJson(paths.statePath)?.state?.unityBridge?.revision ?? "?"} ${result.message ?? result.reason ?? ""}`);
      }
    } catch (error) {
      console.error(`Unity action bridge error: ${error?.stack ?? error}`);
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}

function cliOptions() {
  return {
    statePath: argValue("--state", DEFAULT_STATE_PATH),
    viewModelPath: argValue("--out", argValue("--viewmodel", DEFAULT_VIEWMODEL_PATH)),
    actionPath: argValue("--action", DEFAULT_ACTION_PATH),
    resultPath: argValue("--result", DEFAULT_RESULT_PATH),
    scriptId: argValue("--script", "tb"),
    playerCount: Number(argValue("--players", "9")) || 9,
    preferredHumanRoleId: argValue("--role", "washerwoman"),
    seed: Number(argValue("--seed", "20260506")) || 20260506,
    pollMs: Number(argValue("--poll", "350")) || 350,
    freshState: hasFlag("--fresh") || hasFlag("--reset-state"),
    replayDir: argValue("--replay-dir", DEFAULT_REPLAY_DIR),
    replayPath: argValue("--replay", ""),
    latestReplayPath: argValue("--latest-replay", ""),
    disableReplayRecorder: hasFlag("--no-replay"),
    llmRenderer: hasFlag("--llm-renderer"),
    llmProvider: argValue("--llm-provider", process.env.BOTC_LLM_PROVIDER || ""),
    llmTimeoutMs: Number(argValue("--llm-timeout", process.env.BOTC_LLM_TIMEOUT_MS || `${DEFAULT_LLM_DIALOGUE_TIMEOUT_MS}`)) || DEFAULT_LLM_DIALOGUE_TIMEOUT_MS,
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const options = cliOptions();
  if (hasFlag("--watch")) {
    await watchUnityActions(options);
  } else {
    const { result, paths } = await processUnityActionFileAsync(options);
    console.log(`${result.ok ? "Processed" : "Failed"} Unity action -> ${paths.viewModelPath}`);
    if (result.message || result.reason) {
      console.log(result.message ?? result.reason);
    }
    process.exit(result.ok ? 0 : 1);
  }
}
