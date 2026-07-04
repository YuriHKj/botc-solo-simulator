import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  acceptAIProactiveWhisper,
  chooseAINomination,
  createNominationDebate,
  declineAIProactiveWhisper,
  decideAIVoteWithRationale,
  getAIInsightRows,
  initializeAI,
  recordNominationDebateResponse,
  refreshAIBeliefs,
  runAIConversationStep,
  runAIProactiveWhispers,
  runAIToAIPrivateWhispers,
  runPrivateWhisper,
} from "./ai.js";
import { renderSpeechWithLocalLLM, resolveLLMRendererConfig } from "./ai_llm_renderer.js";
import { recordPublicSpeechForAgents } from "./ai_agents.js";
import { getRoleById } from "./data.js";
import {
  addGrimoireReminder,
  addLog,
  advanceDayStage,
  beginNightPhase,
  clearGrimoireNote,
  closeNominationWindow,
  createNewGame,
  endDayAndBeginNight,
  getHumanDayActionState,
  getHumanNightActionState,
  getPendingStorytellerActionState,
  hasExecutionToday,
  getPlayerById,
  markPublicDiscussionRound,
  openNominationWindow,
  registersAsAlive,
  registerClaim,
  removeGrimoireReminder,
  resolveNominationAndVote,
  resolvePendingStorytellerAction,
  runNight,
  setGrimoireMarkedRole,
  setHumanDayActionPlan,
  setHumanNightActionPlan,
  skipDay,
  tickNominationWindow,
} from "./engine.js";
import { buildUnityPhaseAdvance } from "./unity_phase_guard.mjs";
import { buildUnityViewModel, stringifyUnityViewModel } from "./unity_viewmodel.js";

const DEFAULT_STREAMING_ASSETS = "unity-prototype/Assets/StreamingAssets";
const DEFAULT_STATE_PATH = `${DEFAULT_STREAMING_ASSETS}/unity_state.json`;
const DEFAULT_VIEWMODEL_PATH = `${DEFAULT_STREAMING_ASSETS}/unity_viewmodel.json`;
const DEFAULT_ACTION_PATH = `${DEFAULT_STREAMING_ASSETS}/unity_action.json`;
const DEFAULT_RESULT_PATH = `${DEFAULT_STREAMING_ASSETS}/unity_action_result.json`;
const DEFAULT_REPLAY_DIR = "output/demo_replays";
const DEFAULT_LLM_DIALOGUE_TIMEOUT_MS = 1800;
const DEFAULT_LLM_DIALOGUE_MAX_LINES = 3;

function argValue(name, fallback = "") {
  const hit = process.argv.find((entry) => entry === name || entry.startsWith(`${name}=`));
  if (!hit) return fallback;
  if (hit === name) return "true";
  return unquoteArgValue(hit.slice(name.length + 1));
}

function hasFlag(name) {
  return process.argv.includes(name) || process.argv.some((entry) => entry.startsWith(`${name}=`));
}

function unquoteArgValue(value) {
  const text = `${value ?? ""}`;
  if (text.length >= 2) {
    const first = text[0];
    const last = text[text.length - 1];
    if ((first === "\"" && last === "\"") || (first === "'" && last === "'")) {
      return text.slice(1, -1);
    }
  }
  return text;
}

function readJson(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) return fallback;
  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  if (!raw.trim()) return fallback;
  return JSON.parse(raw);
}

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function isTransientFileWriteError(error) {
  return ["EBUSY", "EPERM", "EACCES"].includes(error?.code);
}

function writeTextFileAtomicWithRetry(filePath, text) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  let lastError = null;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const tempPath = `${filePath}.${process.pid}.${Date.now()}.${attempt}.tmp`;
    try {
      fs.writeFileSync(tempPath, text, "utf8");
      fs.renameSync(tempPath, filePath);
      return;
    } catch (error) {
      lastError = error;
      fs.rmSync(tempPath, { force: true });
      if (!isTransientFileWriteError(error)) {
        throw error;
      }
      sleepSync(Math.min(250, 20 + attempt * 10));
    }
  }
  throw lastError;
}

function writeJson(filePath, value) {
  writeTextFileAtomicWithRetry(filePath, `${JSON.stringify(value, null, 2)}\n`);
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

function bridgeLLMMaxLines(options = {}) {
  const raw = Number(options.llmMaxLines ?? process.env.BOTC_LLM_MAX_LINES_PER_ACTION ?? DEFAULT_LLM_DIALOGUE_MAX_LINES);
  if (!Number.isFinite(raw)) return DEFAULT_LLM_DIALOGUE_MAX_LINES;
  return Math.max(0, Math.floor(raw));
}

function llmDialogueTargetName(state, entry = {}) {
  return replayPlayerName(state, entry.focusId || entry.targetId);
}

function llmDialogueRequiredTerms(state, entry = {}) {
  const target = llmDialogueTargetName(state, entry);
  if (llmDialogueAudience(entry) === "private" && target === "你") return [];
  return target ? [target] : [];
}

function llmDialogueAudience(entry = {}) {
  if (entry.private || `${entry.mode ?? ""}`.includes("whisper")) return "private";
  if (entry.debateBeat || `${entry.mode ?? ""}`.includes("nomination")) return "nomination";
  return "public";
}

async function renderBridgeDialogueLine(state, entry, text, options = {}) {
  const speakerId = entry.playerId || entry.speakerId;
  const audience = llmDialogueAudience(entry);
  const llmConfig = resolveLLMRendererConfig({
    enabled: true,
    provider: options.llmProvider,
    timeoutMs: options.llmTimeoutMs ?? DEFAULT_LLM_DIALOGUE_TIMEOUT_MS,
  });
  return renderSpeechWithLocalLLM(
    {
      speakerName: replayPlayerName(state, speakerId),
      targetName: llmDialogueTargetName(state, entry),
      audience,
      intent: entry.debateBeat ? "nomination_debate" : audience === "private" ? (entry.intent || "private_reply") : "public_table_talk",
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
      transport: options.llmTransport,
    }
  );
}

export async function applyLLMDialoguePostprocess(state, beforeSnapshot = {}, options = {}) {
  if (!bridgeLLMRendererEnabled(options)) {
    return { enabled: false, touched: 0, fallback: 0 };
  }
  state.unityBridge = state.unityBridge ?? {};
  const llmConfig = resolveLLMRendererConfig({
    enabled: true,
    provider: options.llmProvider,
    timeoutMs: options.llmTimeoutMs ?? DEFAULT_LLM_DIALOGUE_TIMEOUT_MS,
  });

  const timeline = state.aiDialogue?.timeline ?? [];
  let touched = 0;
  let fallback = 0;
  const maxLines = bridgeLLMMaxLines(options);
  const newTimelineEntries = timeline.slice(beforeSnapshot.timelineCount ?? timeline.length);
  const renderQueue = [];
  for (const entry of newTimelineEntries) {
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
    renderQueue.push(entry);
  }

  const selectedEntries = maxLines <= 0 ? [] : renderQueue.slice(0, maxLines);
  for (const entry of selectedEntries) {
    const originalText = entry.text;
    const result = await renderBridgeDialogueLine(state, entry, entry.text, options);
    if (result.text) {
      entry.llmRender = {
        source: result.source,
        fallbackUsed: result.fallbackUsed,
        reason: result.reason,
        deterministicDraft: originalText,
        finalText: result.text,
      };
    }
    if (result.text && result.text !== entry.text) {
      entry.text = result.text;
      updateMatchingSpeechAfterTimelineRender(state, entry, originalText, result.text, entry.llmRender, beforeSnapshot);
      if (state.aiDialogue?.activeSpeech?.id === entry.id) {
        state.aiDialogue.activeSpeech.text = result.text;
        state.aiDialogue.activeSpeech.llmRender = entry.llmRender;
      }
    }
    if (result.text) touched += 1;
    if (result.text && result.fallbackUsed) fallback += 1;
  }

  state.unityBridge.llmRenderer = {
    enabled: true,
    provider: llmConfig.provider,
    source: llmConfig.provider,
    model: llmConfig.model,
    touched,
    fallback,
    skipped: Math.max(0, renderQueue.length - selectedEntries.length),
    maxLines,
    updatedAt: new Date().toISOString(),
  };
  return { enabled: true, touched, fallback, skipped: Math.max(0, renderQueue.length - selectedEntries.length), maxLines };
}

function updateMatchingSpeechAfterTimelineRender(state, timelineEntry, originalText, renderedText, llmRender, beforeSnapshot = {}) {
  const speeches = state.events?.speeches ?? [];
  const speakerId = timelineEntry.speakerId || timelineEntry.playerId;
  const isPrivateTimeline = timelineEntry.private === true || `${timelineEntry.mode ?? ""}`.includes("whisper");
  for (const speech of speeches.slice(beforeSnapshot.speechCount ?? speeches.length)) {
    if (!speech || speech.playerId !== speakerId || speech.line !== originalText) continue;
    if (!!speech.private !== !!isPrivateTimeline) continue;
    speech.line = renderedText;
    speech.llmRender = llmRender;
  }
}

const UNITY_BRIDGE_RNG_MODULUS = 233280;
const UNITY_BRIDGE_RNG_MULTIPLIER = 9301;
const UNITY_BRIDGE_RNG_INCREMENT = 49297;
const DEFAULT_UNITY_BRIDGE_SEED = 20260506;

function normalizeUnityBridgeInitialSeed(seedInput, fallback = DEFAULT_UNITY_BRIDGE_SEED) {
  const numeric = Number(seedInput);
  return Number.isFinite(numeric) && numeric !== 0 ? Math.trunc(numeric) : fallback;
}

function normalizeUnityBridgeRngState(seedInput, fallback = DEFAULT_UNITY_BRIDGE_SEED) {
  const numeric = Number(seedInput);
  return Number.isFinite(numeric) ? Math.trunc(numeric) : fallback;
}

function nextUnityBridgeRngState(seedInput) {
  const next = (normalizeUnityBridgeRngState(seedInput) * UNITY_BRIDGE_RNG_MULTIPLIER + UNITY_BRIDGE_RNG_INCREMENT) % UNITY_BRIDGE_RNG_MODULUS;
  return next < 0 ? next + UNITY_BRIDGE_RNG_MODULUS : next;
}

function createTrackedUnityBridgeRandom(seedInput) {
  const initialSeed = normalizeUnityBridgeInitialSeed(seedInput);
  let rngState = initialSeed;
  return {
    initialSeed,
    get rngState() {
      return rngState;
    },
    rng() {
      rngState = nextUnityBridgeRngState(rngState);
      return rngState / UNITY_BRIDGE_RNG_MODULUS;
    },
  };
}

function createUnityBridgeRng(state, seedInput = DEFAULT_UNITY_BRIDGE_SEED) {
  const bridge = ensureUnityBridge(state);
  const initialSeed = normalizeUnityBridgeInitialSeed(bridge.rngSeed ?? seedInput);
  bridge.rngSeed = initialSeed;
  bridge.rngState = normalizeUnityBridgeRngState(bridge.rngState, initialSeed);
  return () => {
    bridge.rngState = nextUnityBridgeRngState(bridge.rngState);
    return bridge.rngState / UNITY_BRIDGE_RNG_MODULUS;
  };
}

function makeInitialState({ scriptId = "tb", playerCount = 9, preferredHumanRoleId = "washerwoman", seed = DEFAULT_UNITY_BRIDGE_SEED } = {}) {
  const trackedRng = createTrackedUnityBridgeRandom(seed);
  const rng = trackedRng.rng;
  const state = createNewGame({ scriptId, playerCount, preferredHumanRoleId }, rng);
  initializeAI(state);
  beginNightPhase(state);
  initializeAI(state);
  ensureUnityBridge(state);
  state.unityBridge.rngSeed = trackedRng.initialSeed;
  state.unityBridge.rngState = trackedRng.rngState;
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
  state.unityBridge.resolvedImmediately = !!state.unityBridge.resolvedImmediately;
  state.unityBridge.publicAction = !!state.unityBridge.publicAction;
  state.unityBridge.speechId = state.unityBridge.speechId ?? "";
  state.unityBridge.autoAdvance = state.unityBridge.autoAdvance ?? null;
  state.unityBridge.updatedAt = state.unityBridge.updatedAt ?? "";
  if (!Number.isFinite(Number(state.unityBridge.rngSeed))) state.unityBridge.rngSeed = null;
  if (!Number.isFinite(Number(state.unityBridge.rngState))) state.unityBridge.rngState = null;
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
    "public-speech": "human-public-speech",
    "human-public": "human-public-speech",
    "public-step": "ai-public-step",
    "conversation-step": "ai-public-step",
    "nomination-intent": "human-nomination-intent",
    "resolve-vote": "resolve-nomination-vote",
    "auto-step": "auto-advance",
    "continue": "auto-advance",
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

function humanPlayer(state) {
  return state.players?.find((player) => player.isHuman) ?? null;
}

function defaultHumanVoteYes(state, nomineeId = "") {
  const human = humanPlayer(state);
  if (!human || !registersAsAlive(state, human)) {
    return false;
  }

  const activeNomineeId = nomineeId || state.dayStageMeta?.nominationDebate?.nomineeId || "";
  const nominee = activeNomineeId ? getPlayerById(state, activeNomineeId) : null;
  if (nominee?.id === human.id) {
    return false;
  }
  if (human.team === "evil" && nominee?.team === "evil") {
    return false;
  }
  return true;
}

function humanVoteYesFromPayload(state, payload = {}, nomineeId = "") {
  if (Object.prototype.hasOwnProperty.call(payload, "humanVoteYes")) {
    return !!payload.humanVoteYes;
  }
  return defaultHumanVoteYes(state, nomineeId);
}

function selectedOrPayloadPlayerId(state, payload) {
  return payload.playerId ?? payload.targetId ?? state.unityBridge?.selectedPlayerId ?? firstNonHumanPlayerId(state);
}

function trimUnityText(text, fallback = "", maxChars = 260) {
  const cleaned = `${text ?? ""}`.replace(/\s+/g, " ").trim();
  return (cleaned || fallback).slice(0, maxChars).trim();
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
    const result = advanceDayStage(state, "public");
    if (result.ok) {
      clearPrivateStageQueues(state);
    }
    return result;
  }
  if (state.dayStage === "public") {
    return { ok: true, stage: "public" };
  }
  return { ok: false, reason: "当前已经不在公聊前置阶段。" };
}

function clearPrivateStageQueues(state) {
  state.dayStageMeta = state.dayStageMeta ?? {};
  state.dayStageMeta.activePrivateTargetId = null;
  state.dayStageMeta.privateFollowUpUsed = 0;
  state.aiDialogue = state.aiDialogue ?? {};
  state.aiDialogue.pendingProactiveWhispers = Array.isArray(state.aiDialogue.pendingProactiveWhispers)
    ? state.aiDialogue.pendingProactiveWhispers.filter((entry) => entry.day !== (state.day ?? 0))
    : [];
}

function pushHumanPublicTimeline(state, entry) {
  state.aiDialogue = state.aiDialogue ?? {};
  state.aiDialogue.timeline = Array.isArray(state.aiDialogue.timeline) ? state.aiDialogue.timeline : [];
  const record = {
    id: `human-public-${state.day ?? 0}-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    timestamp: Date.now(),
    day: state.day,
    night: state.night,
    mode: "public",
    roundInDay: Math.max(1, state.dayStageMeta?.publicRounds ?? 1),
    orderIndex: 0,
    ...entry,
  };
  state.aiDialogue.timeline.push(record);
  if (state.aiDialogue.timeline.length > 80) {
    state.aiDialogue.timeline.splice(0, state.aiDialogue.timeline.length - 80);
  }
  state.aiDialogue.activeSpeech = record;
  return record;
}

function currentHumanCerenovusForcedRoleId(state, human) {
  if (!human || state.scriptId !== "snv") {
    return "";
  }
  const forcedRoleId = `${state.snv?.cerenovusForcedByPlayerId?.[human.id] ?? ""}`.trim();
  const enforceDay = Number(state.snv?.cerenovusEnforceDayByPlayerId?.[human.id]);
  if (!forcedRoleId || !Number.isFinite(enforceDay) || enforceDay !== Number(state.day ?? 0)) {
    return "";
  }
  return getRoleById(state.scriptId, forcedRoleId)?.id ?? "";
}

function humanPublicOpeningRoleId(state, human, payload = {}) {
  const explicitRoleId = `${payload.claimRoleId ?? payload.roleId ?? ""}`.trim();
  if (explicitRoleId) {
    return { roleId: explicitRoleId, reason: "explicit" };
  }
  const forcedRoleId = currentHumanCerenovusForcedRoleId(state, human);
  if (forcedRoleId) {
    return { roleId: forcedRoleId, reason: "cerenovus" };
  }
  if (human.publicClaimRoleId) {
    return { roleId: "", reason: "already-claimed" };
  }
  return { roleId: `${human.apparentRoleId ?? human.roleId ?? ""}`.trim(), reason: "opening" };
}

function ensureHumanPublicOpening(state, payload = {}) {
  const human = humanPlayer(state);
  if (!human) {
    return { claimed: false };
  }
  const opening = humanPublicOpeningRoleId(state, human, payload);
  const roleId = opening.roleId;
  if (!roleId) {
    return { claimed: false };
  }
  const alreadyClaimedToday = (state.events?.claims ?? []).some(
    (entry) => entry.day === state.day && entry.playerId === human.id && entry.roleId === roleId && entry.private === false
  );
  if (human.publicClaimRoleId === roleId && alreadyClaimedToday) {
    return { claimed: false, roleId };
  }
  const ok = registerClaim(state, human.id, roleId);
  if (!ok) {
    return { claimed: false };
  }

  const roleName = getRoleById(state.scriptId, roleId)?.name ??
    (roleId === human.apparentRoleId ? human.apparentRoleName : roleId === human.roleId ? human.roleName : roleId);
  state.aiDialogue = state.aiDialogue ?? {};
  state.aiDialogue.timeline = Array.isArray(state.aiDialogue.timeline) ? state.aiDialogue.timeline : [];
  const roundInDay = Math.max(1, (state.dayStageMeta?.publicRounds ?? 0) + 1);
  const text = opening.reason === "cerenovus"
    ? `公开身份：${roleName || roleId}。我今天继续维持这个身份口径。`
    : `公开身份：${roleName || roleId}。我先把自己的口径放上桌。`;
  const record = {
    id: `human-public-claim-${state.day ?? 0}-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    timestamp: Date.now(),
    day: state.day,
    night: state.night,
    mode: "public",
    roundInDay,
    orderIndex: -1,
    speakerId: human.id,
    targetId: "",
    text,
    intent: "public-claim",
  };
  record.claimReason = opening.reason;
  state.aiDialogue.timeline.push(record);
  if (state.aiDialogue.timeline.length > 80) {
    state.aiDialogue.timeline.splice(0, state.aiDialogue.timeline.length - 80);
  }
  state.aiDialogue.activeSpeech = record;
  return { claimed: true, roleId };
}

function applyHumanPublicSpeechAction(state, payload = {}) {
  if (state.phase !== "day" || state.dayStage !== "public" || state.gameOver) {
    return { ok: false, reason: "当前不在公聊阶段，无法公开发言。" };
  }
  const human = humanPlayer(state);
  if (!human) {
    return { ok: false, reason: "未找到主视角玩家。" };
  }
  const text = trimUnityText(payload.text ?? payload.line ?? payload.message, "", 280);
  if (!text) {
    return { ok: false, reason: "请输入要公开发言的内容。" };
  }

  const claimRoleId = `${payload.claimRoleId ?? payload.roleId ?? ""}`.trim();
  if (claimRoleId && human.publicClaimRoleId !== claimRoleId) {
    registerClaim(state, human.id, claimRoleId);
  }
  const focusId = `${payload.focusId ?? payload.targetId ?? payload.playerId ?? state.unityBridge?.selectedPlayerId ?? ""}`.trim();
  const intent = trimUnityText(payload.intent, claimRoleId ? "public-claim" : "human-public-speech", 80);
  const record = pushHumanPublicTimeline(state, {
    speakerId: human.id,
    targetId: "",
    focusId,
    text,
    intent,
  });
  state.events.speeches.push({
    day: state.day,
    playerId: human.id,
    line: text,
    focusId,
    private: false,
  });
  recordPublicSpeechForAgents(state, {
    speakerId: human.id,
    text,
    focusId,
    roundInDay: record.roundInDay,
    orderIndex: record.orderIndex,
    polarity: "human",
  });
  addLog(state, "speech", `${human.name}：${text}`, {
    private: false,
    playerId: human.id,
    focusId,
    source: "human-public-speech",
  });
  return { ok: true, message: "主视角公开发言已记录。", speech: record };
}

function maybeEnterNominationStage(state, rng) {
  if (state.phase !== "day" || state.gameOver) {
    return { ok: false, reason: "当前不在白天流程，无法进入提名。" };
  }
  if (state.dayStage === "private") {
    const publicResult = advanceDayStage(state, "public");
    if (!publicResult.ok) return publicResult;
    ensureHumanPublicOpening(state);
    const stepResult = runAIConversationStep(state, rng);
    if (!stepResult.ok) return stepResult;
  }
  if (state.dayStage === "public") {
    if ((state.dayStageMeta?.publicRounds ?? 0) <= 0) {
      ensureHumanPublicOpening(state);
      const stepResult = runAIConversationStep(state, rng);
      if (!stepResult.ok) return stepResult;
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
      ensureHumanPublicOpening(state, payload);
      const stepResult = runAIConversationStep(state, rng);
      if (!stepResult.ok) return stepResult;
      addLog(state, "unity-action", "Unity 发起了一步公聊。", { source: "unity" });
      return { ...stepResult, stage: "public", message: stepResult.message ?? "公聊推进一步。" };
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
    const result = runNight(state, rng);
    if (state.gameOver || result.stage === "ended") {
      return { ok: true, stage: "ended", message: "Night resolved; the game has ended.", result };
    }
    if ((state.pendingStorytellerActions ?? []).length > 0 || result.stage === "storyteller") {
      return {
        ok: true,
        stage: "storyteller",
        message: "Night resolution paused for a Storyteller action.",
        pendingStorytellerActions: state.pendingStorytellerActions.length,
        result,
      };
    }
    return { ok: true, stage: "day", message: "夜晚已结算，进入白天。" };
  }
  if (stage === "night") {
    if (state.phase === "day" && !state.gameOver) {
      const result = endDayAndBeginNight(state, rng);
      if (result.ok && result.stage === "storyteller") {
        return { ok: true, stage: "storyteller", message: "白天处决已结算，请先处理 Storyteller 队列。", result };
      }
      if (!result.ok) {
        return { ok: false, reason: result.reason ?? "当前无法结束白天；请先进入提名阶段。" };
      }
      return state.gameOver
        ? { ok: true, stage: "ended", message: "白天已结算，本局结束。", result }
        : { ok: true, stage: "night", message: "白天已结束，进入夜晚。", result };
    }
    return { ok: false, reason: "当前无法切入夜晚。" };
  }
  return advanceDayStage(state, stage || null);
}

function firstActionTargetIds(action, count = 1) {
  const defaults = Array.isArray(action?.selectedTargetIds) && action.selectedTargetIds.length > 0
    ? action.selectedTargetIds
    : (action.options ?? []).map((entry) => entry.id);
  return defaults.slice(0, Math.max(0, count)).filter(Boolean);
}

function firstActionRoleId(action) {
  return action.roleOptions?.find((entry) => entry.id)?.id ?? "";
}

function shouldUseDefaultRoleActionInput(payload = {}) {
  return payload.auto === true || payload.useDefaultTargets === true || payload.useDefaultInput === true;
}

function completeRoleActionInput(action, payload = {}, state = null) {
  const inputType = action?.inputType ?? "player-target";
  const minTargets = action?.minTargetCount ?? action?.targetCount ?? 1;
  const maxTargets = action?.maxTargetCount ?? action?.targetCount ?? minTargets;
  const useDefaults = shouldUseDefaultRoleActionInput(payload);
  const targetIds = Array.isArray(payload.targetIds)
    ? payload.targetIds
    : [payload.targetId ?? payload.playerId].filter(Boolean);
  const roleId = payload.roleId ?? payload.selectedRoleId ?? firstActionRoleId(action);
  const payloadMode = `${payload.mode ?? ""}`.trim().toLowerCase();

  if (action?.optional && (payload.skip === true || payloadMode === "skip" || payloadMode === "none")) {
    return { mode: "skip" };
  }

  if (
    state?.scriptId === "bmr" &&
    action?.roleId === "professor" &&
    action?.inputType === "player-target" &&
    targetIds.length === 0
  ) {
    const playersById = new Map((state.players ?? []).map((player) => [player.id, player]));
    const optionOrder = new Map((action.options ?? []).map((entry, index) => [entry.id, index]));
    const target = (action.options ?? [])
      .map((entry) => playersById.get(entry.id))
      .filter((player) => player && player.isHuman !== true && player.alive === false && player.category === "townsfolk")
      .sort((a, b) => (optionOrder.get(a.id) ?? 0) - (optionOrder.get(b.id) ?? 0))[0];
    return target ? { targetIds: [target.id] } : { mode: "skip" };
  }

  if (inputType === "role") {
    return { roleId };
  }
  if (inputType === "player-role") {
    return {
      targetIds: targetIds.length > 0 ? targetIds.slice(0, maxTargets) : useDefaults ? firstActionTargetIds(action, minTargets) : [],
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
    const players = useDefaults ? firstActionTargetIds(action, Math.max(1, action.minGuessCount ?? 1)) : [];
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
      targetIds: targetIds.length > 0 ? targetIds.slice(0, maxTargets) : useDefaults ? firstActionTargetIds(action, minTargets) : [],
    };
  }
  return {
    targetIds: targetIds.length > 0 ? targetIds.slice(0, maxTargets) : useDefaults ? firstActionTargetIds(action, minTargets) : [],
  };
}

function shouldResumeNightAfterHumanAction(payload = {}) {
  const mode = `${payload.mode ?? payload.intent ?? ""}`.trim().toLowerCase();
  if (payload.resolve === false || payload.resume === false || payload.deferResolution === true) return false;
  return !["plan-only", "defer", "deferred"].includes(mode);
}

function applyHumanNightAction(state, payload, rng) {
  const action = getHumanNightActionState(state);
  if (!action.available) {
    return { ok: false, reason: action.reason };
  }
  const plan = completeRoleActionInput(action, payload, state);
  const result = setHumanNightActionPlan(state, plan);
  if (result.ok && shouldResumeNightAfterHumanAction(payload)) {
    const nightResult = runNight(state, rng);
    if (!nightResult.ok) {
      return {
        ...result,
        ok: false,
        nightResult,
        reason: nightResult.reason ?? result.reason ?? "Night action was planned, but night resolution failed.",
      };
    }
    const base = {
      ...result,
      nightResult,
      stage: nightResult.stage,
    };
    if (state.gameOver || nightResult.stage === "ended") {
      return {
        ...base,
        message: "Human night action resolved; the game has ended.",
      };
    }
    if ((state.pendingStorytellerActions ?? []).length > 0 || nightResult.stage === "storyteller") {
      return {
        ...base,
        stage: "storyteller",
        pendingStorytellerActions: state.pendingStorytellerActions?.length ?? 0,
        message: "Human night action resolved; a Storyteller action is waiting.",
      };
    }
    if (state.phase === "day") {
      return {
        ...base,
        stage: "day",
        message: "Human night action resolved; day has begun.",
      };
    }
    return base;
  }
  return result.ok
    ? { ...result, message: `夜间行动已预设：${result.roleName} -> ${result.targetNames ?? "无"}` }
    : result;
}

function applyHumanDayAction(state, payload, rng) {
  const action = getHumanDayActionState(state);
  if (!action.available) {
    return { ok: false, reason: action.reason };
  }
  const plan = completeRoleActionInput(action, payload, state);
  const result = setHumanDayActionPlan(state, plan, rng);
  if (!result.ok) {
    return result;
  }
  const verb = result.resolvedImmediately ? "已执行" : "已预设";
  return { ...result, message: `${verb}白天行动：${result.roleName} -> ${result.targetNames ?? "无"}` };
}

function applyStorytellerAction(state, payload) {
  const action = getPendingStorytellerActionState(state);
  if (!action.available) {
    return { ok: false, reason: action.reason ?? "当前没有待处理的说书人行动。" };
  }
  const input = completeRoleActionInput(action, { auto: true, ...payload });
  const result = resolvePendingStorytellerAction(state, input);
  return result.ok
    ? { ...result, message: "说书人行动已处理。" }
    : result;
}

function applyStorytellerActionAndResume(state, payload, rng = Math.random) {
  const queuedAction = state.pendingStorytellerActions?.[0] ?? null;
  const shouldResumeDayEnd =
    queuedAction?.createdPhase === "day" &&
    state.phase === "day" &&
    state.dayStage === "nomination";
  const result = applyStorytellerAction(state, payload);
  if (!result.ok) {
    return result;
  }
  const remainingStorytellerActions = state.pendingStorytellerActions?.length ?? 0;
  if (remainingStorytellerActions > 0) {
    return {
      ...result,
      stage: "storyteller",
      pendingStorytellerActions: remainingStorytellerActions,
      message: "Storyteller action resolved; another Storyteller action is waiting.",
    };
  }
  if (state.gameOver) {
    return {
      ...result,
      stage: "ended",
      message: "Storyteller action resolved; the game has ended.",
    };
  }
  if (queuedAction?.createdPhase === "night") {
    return {
      ...result,
      stage: state.phase === "day" ? "day" : state.phase === "night" ? "night" : undefined,
      message:
        state.phase === "day"
          ? "Storyteller action resolved; day has begun."
          : state.phase === "night"
            ? "Storyteller action resolved; night is ready to continue."
            : result.message,
    };
  }
  if (!shouldResumeDayEnd) {
    return result;
  }

  const flowAdvance = endDayAndBeginNight(state, rng);
  if (!flowAdvance.ok) {
    return {
      ...result,
      flowAdvance,
      message: flowAdvance.reason ?? result.message,
    };
  }
  if (flowAdvance.stage === "storyteller") {
    return {
      ...result,
      flowAdvance,
      stage: "storyteller",
      message: "Storyteller action resolved; another Storyteller action is waiting.",
    };
  }
  if (flowAdvance.stage === "ended" || state.gameOver) {
    return {
      ...result,
      flowAdvance,
      stage: "ended",
      message: "Storyteller action resolved; the game has ended.",
    };
  }
  return {
    ...result,
    flowAdvance,
    stage: "night",
    message: "Storyteller action resolved; night has begun.",
  };
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
  const activeDebate = state.dayStageMeta?.nominationDebate;
  if (activeDebate?.active) {
    if (activeDebate.nomineeId !== nomineeId) {
      return { ok: false, reason: "请先结算当前提名互辩，不能切换到新的被提名者。", debate: activeDebate };
    }
    return applyResolveNominationVoteAction(state, payload, rng);
  }
  refreshAIBeliefs(state);
  const result = resolveNominationAndVote(
    state,
    {
      nominatorId,
      nomineeId,
      humanVoteYes: humanVoteYesFromPayload(state, payload, nomineeId),
      decideAIVote: decideAIVoteWithRationale,
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
  if (hasExecutionToday(state)) {
    return { ok: false, reason: "今天已经发生过处决，不能再次开启提名窗口。" };
  }
  return { ok: true };
}

function applyPublicConversationStepAction(state, payload, rng) {
  const publicResult = maybeEnterPublicStage(state);
  if (!publicResult.ok) {
    return publicResult;
  }
  const result = runAIConversationStep(state, rng);
  if (result.ok) {
    markPublicDiscussionRound(state);
  }
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
      decisionRationale: proposal.decisionRationale ?? null,
      strategyRationale: proposal.strategyRationale ?? null,
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
    const debate = proposalToDebate(state, proposal, rng);
    if (debate.ok && debate.debate?.active) {
      closeNominationWindow(state, { status: "nomination-made", actorId: proposal.nominatorId, intent: "ai-nomination" });
    }
    return debate;
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
  const suppliedReason = trimUnityText(payload.reason ?? payload.text ?? payload.message, "", 260);
  payload = { ...payload, reason: suppliedReason || payload.reason };
  const debate = createNominationDebate(
    state,
    {
      nominatorId,
      nomineeId,
      reason: payload.reason ?? `我提 ${getPlayerById(state, nomineeId)?.name ?? nomineeId}。先上台听完整回应，再看票型。`,
      source: "human",
    },
    rng
  );
  if (debate.ok && debate.debate?.active) {
    if (suppliedReason) {
      const human = getPlayerById(state, nominatorId);
      const record = pushHumanPublicTimeline(state, {
        speakerId: nominatorId,
        targetId: nomineeId,
        focusId: nomineeId,
        text: suppliedReason,
        intent: "human-nomination-reason",
      });
      state.events.speeches.push({
        day: state.day,
        playerId: nominatorId,
        line: suppliedReason,
        focusId: nomineeId,
        private: false,
      });
      recordPublicSpeechForAgents(state, {
        speakerId: nominatorId,
        text: suppliedReason,
        focusId: nomineeId,
        roundInDay: record.roundInDay,
        orderIndex: record.orderIndex,
        polarity: "accuse",
      });
      addLog(state, "speech", `${human?.name ?? nominatorId}: ${suppliedReason}`, {
        private: false,
        playerId: nominatorId,
        focusId: nomineeId,
        source: "human-nomination-reason",
      });
    }
    closeNominationWindow(state, { status: "nomination-made", actorId: nominatorId, intent: "human-nomination" });
  }
  return debate;
}

function applyResolveNominationVoteAction(state, payload, rng) {
  const debate = state.dayStageMeta?.nominationDebate;
  if (!debate?.active) {
    return { ok: false, reason: "当前没有待结算的提名互辩。" };
  }
  refreshAIBeliefs(state);
  const result = resolveNominationAndVote(
    state,
    {
      nominatorId: debate.nominatorId,
      nomineeId: debate.nomineeId,
      humanVoteYes: humanVoteYesFromPayload(state, payload, debate.nomineeId),
      decideAIVote: decideAIVoteWithRationale,
      nominationAlreadyAccepted: !!debate.nominationAccepted,
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
  if (state.phase !== "day" || state.gameOver) {
    return { ok: false, reason: "Cannot end nominations outside an active day." };
  }
  if (state.dayStage === "private") {
    return { ok: false, reason: "Enter public discussion before ending nominations." };
  }
  if (state.dayStage === "public") {
    const result = advanceDayStage(state, "nomination");
    if (!result.ok) return result;
  }
  if (state.dayStage !== "nomination") {
    return { ok: false, reason: "Current day stage cannot end nominations." };
  }
  if (state.dayStageMeta?.nominationDebate?.active) {
    return { ok: false, reason: "请先结算当前提名投票，再结束提名窗口。" };
  }
  closeNominationWindow(state, {
    status: hasExecutionToday(state) ? "execution-resolved" : "passed",
    actorId: humanPlayerId(state),
    intent: "pass",
  });
  if (payload.toNight === false) {
    const skipped = skipDay(state, rng);
    return { ok: skipped, message: skipped ? "提名窗口耗尽，今天无人处决。" : "当前无法空过白天。" };
  }
  const result = endDayAndBeginNight(state, rng);
  if (result.ok && result.stage === "storyteller") {
    return { ok: true, stage: "storyteller", message: "处决已结算，请先处理 Storyteller 队列。", result };
  }
  if (!result.ok) {
    return { ok: false, reason: result.reason ?? "当前无法空过白天。" };
  }
  return state.gameOver
    ? { ok: true, stage: "ended", message: "提名窗口耗尽，白天已结算，本局结束。", result }
    : { ok: true, stage: "night", message: "提名窗口耗尽，今天无人处决，进入夜晚。", result };
}

function boundedInt(value, fallback, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.trunc(numeric)));
}

function autoAdvanceStage(state) {
  if ((state.pendingStorytellerActions ?? []).length > 0) return "storyteller";
  if (state.gameOver || state.phase === "ended") return "ended";
  if (state.phase === "night") return "night";
  if (state.phase === "day") return state.dayStage ?? "day";
  return state.phase ?? "";
}

function autoAdvanceStop(state, steps, stoppedAt, message, extra = {}) {
  return {
    ok: true,
    stage: extra.stage ?? autoAdvanceStage(state),
    message,
    autoAdvance: {
      stoppedAt,
      steps,
      stepCount: steps.length,
      gameOver: !!state.gameOver,
      phase: state.phase ?? "",
      dayStage: state.dayStage ?? "",
      pendingStorytellerActions: state.pendingStorytellerActions?.length ?? 0,
      ...extra.autoAdvance,
    },
    ...extra.resultFields,
  };
}

function pushAutoStep(steps, type, result = {}) {
  steps.push({
    type,
    ok: result.ok !== false,
    stage: result.stage ?? "",
    message: result.message ?? result.reason ?? "",
  });
}

function applyAutoAdvanceAction(state, payload = {}, rng = Math.random) {
  const steps = [];
  const mode = `${payload.mode ?? payload.intent ?? ""}`.trim().toLowerCase();
  const decisionMode = ["decision", "next-decision", "until-decision", "playable", "flow"].includes(mode);
  const fullAutoMode = ["full-auto", "autoplay", "endgame"].includes(mode);
  const fullAuto = payload.fullAuto === true || fullAutoMode;
  const maxSteps = boundedInt(payload.maxSteps ?? payload.steps, fullAuto ? 192 : 24, 1, fullAuto ? 512 : 96);
  const publicSteps = boundedInt(payload.publicSteps ?? payload.aiPublicSteps, 1, 0, 8);
  const nominationTicks = boundedInt(payload.nominationTicks ?? payload.ticks ?? payload.budget, 4, 1, 8);
  const skipPrivate = payload.skipPrivate !== false;
  const skipDayActions = payload.skipDayActions === true || fullAuto;
  const resolveDebates = payload.resolveDebates === true || payload.resolveVotes === true || fullAuto;
  const resolveStoryteller = payload.resolveStoryteller === true || fullAuto;
  const openNominationAfterPublic =
    payload.openNominationAfterPublic === true ||
    payload.toNomination === true ||
    decisionMode ||
    fullAuto;
  let publicStepsUsed = 0;
  let publicStepDay = null;

  for (let index = 0; index < maxSteps; index += 1) {
    if ((state.pendingStorytellerActions ?? []).length > 0) {
      if (!resolveStoryteller) {
        return autoAdvanceStop(state, steps, "storyteller-action", "Auto-advance paused for a Storyteller action.");
      }
      const result = applyStorytellerActionAndResume(state, payload.storytellerPayload ?? {}, rng);
      pushAutoStep(steps, "storyteller-action", result);
      if (!result.ok) return result;
      continue;
    }

    if (state.gameOver || state.phase === "ended") {
      return autoAdvanceStop(state, steps, "ended", "Auto-advance stopped at endgame.", { stage: "ended" });
    }

    if (state.phase === "night") {
      const nightAction = getHumanNightActionState(state);
      if (nightAction.available) {
        if (fullAuto) {
          const result = applyHumanNightAction(
            state,
            { auto: true, ...(payload.nightActionPayload ?? payload.humanNightActionPayload ?? {}) },
            rng
          );
          pushAutoStep(steps, "human-night-action", result);
          if (!result.ok) return result;
          continue;
        }
        return autoAdvanceStop(state, steps, "human-night-action", "Auto-advance paused for the human night action.", {
          resultFields: { nightAction },
        });
      }
      const result = runNight(state, rng);
      pushAutoStep(steps, "night", result);
      continue;
    }

    if (state.phase !== "day") {
      return autoAdvanceStop(state, steps, "unsupported-phase", "Auto-advance paused outside the day/night loop.");
    }

    const dayAction = getHumanDayActionState(state);
    if (dayAction.available && !skipDayActions) {
      return autoAdvanceStop(state, steps, "human-day-action", "Auto-advance paused for the human day action.", {
        resultFields: { dayAction },
      });
    }

    if (state.dayStage === "private") {
      if (!skipPrivate) {
        return autoAdvanceStop(state, steps, "private-chat", "Auto-advance paused in private chat stage.");
      }
      const result = maybeEnterPublicStage(state);
      pushAutoStep(steps, "enter-public", result);
      if (!result.ok) return result;
      ensureHumanPublicOpening(state, payload);
      publicStepsUsed = 0;
      publicStepDay = state.day ?? null;
      continue;
    }

    if (state.dayStage === "public") {
      if (publicStepDay !== (state.day ?? null)) {
        publicStepsUsed = 0;
        publicStepDay = state.day ?? null;
      }
      if (publicStepsUsed < publicSteps) {
        ensureHumanPublicOpening(state, payload);
        const result = runAIConversationStep(state, rng);
        pushAutoStep(steps, "ai-public-step", result);
        if (!result.ok) return result;
        markPublicDiscussionRound(state);
        publicStepsUsed += 1;
        if (!openNominationAfterPublic) {
          return autoAdvanceStop(state, steps, "public-discussion", "Auto-advance paused after a public discussion step.");
        }
        continue;
      }
      if (!openNominationAfterPublic) {
        return autoAdvanceStop(state, steps, "public-discussion", "Auto-advance paused in public discussion.");
      }
      const result = advanceDayStage(state, "nomination");
      pushAutoStep(steps, "enter-nomination", result);
      if (!result.ok) return result;
      continue;
    }

    if (state.dayStage !== "nomination") {
      return autoAdvanceStop(state, steps, "unknown-day-stage", "Auto-advance paused at an unknown day stage.");
    }

    if (state.dayStageMeta?.nominationDebate?.active) {
      if (!resolveDebates) {
        return autoAdvanceStop(state, steps, "nomination-debate", "Auto-advance paused for nomination debate/vote.");
      }
      const result = applyResolveNominationVoteAction(state, payload, rng);
      pushAutoStep(steps, "resolve-nomination-vote", result);
      if (!result.ok) return result;
      continue;
    }

    const clock = state.dayStageMeta?.nominationClock;
    if (hasExecutionToday(state) || clock?.status === "expired" || clock?.status === "passed") {
      const result = endDayAndBeginNight(state, rng);
      pushAutoStep(steps, "end-day", result);
      if (!result.ok) return result;
      continue;
    }

    if (!clock?.active || clock.status !== "open") {
      const result = openNominationWindow(state, { ticks: nominationTicks, actorId: null, intent: "auto-advance" });
      pushAutoStep(steps, "open-nomination-window", result);
      if (!result.ok) return result;
      continue;
    }

    const proposal = chooseAINomination(state);
    if (proposal) {
      const debate = proposalToDebate(state, proposal, rng);
      pushAutoStep(steps, "ai-nomination-step", debate);
      if (!debate.ok) return debate;
      if (debate.debate?.active) {
        closeNominationWindow(state, { status: "nomination-made", actorId: proposal.nominatorId, intent: "auto-advance" });
      }
      if (!resolveDebates && debate.debate?.active) {
        return autoAdvanceStop(state, steps, "nomination-debate", "Auto-advance paused for nomination debate/vote.", {
          resultFields: { debate },
        });
      }
      continue;
    }

    const tick = tickNominationWindow(state, { actorId: null, intent: "auto-advance" });
    pushAutoStep(steps, "nomination-tick", tick);
    if (!tick.ok) return tick;
  }

  return autoAdvanceStop(state, steps, "max-steps", "Auto-advance paused after reaching its step limit.");
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
  const offerId = `${payload.offerId ?? payload.id ?? ""}`.trim();
  if (!offerId) {
    return { ok: false, reason: "接受主动私聊必须指定邀请编号。" };
  }
  return acceptAIProactiveWhisper(state, offerId, rng);
}

function applyDeclineProactiveWhisperAction(state, payload) {
  const offerId = `${payload.offerId ?? payload.id ?? ""}`.trim();
  if (!offerId) {
    return { ok: false, reason: "拒绝主动私聊必须指定邀请编号。" };
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
    } else if (action.type === "auto-advance") {
      result = applyAutoAdvanceAction(state, payload, rng);
    } else if (action.type === "human-public-speech") {
      result = applyHumanPublicSpeechAction(state, payload);
      if (result.ok) {
        const focusId = `${payload.focusId ?? payload.targetId ?? payload.playerId ?? state.unityBridge?.selectedPlayerId ?? ""}`.trim();
        state.dayStageMeta = state.dayStageMeta ?? {};
        const conversation = state.dayStageMeta.publicConversation ?? {};
        state.dayStageMeta.publicConversation = {
          ...conversation,
          active: true,
          clock: "response",
          pendingResponseSpeakerId: focusId || conversation.activeSpeakerId || null,
          pendingResponseFocusId: focusId || conversation.focusId || null,
          pendingQuestionText: trimUnityText(payload.text ?? payload.line ?? payload.message, "", 280),
          suggestedActions: ["ask-addressed-ai", "continue-public", "open-nomination-window"],
          lastUpdatedDay: state.day ?? 0,
        };
      }
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
      result = applyHumanNightAction(state, payload, rng);
    } else if (action.type === "day-action") {
      result = applyHumanDayAction(state, payload, rng);
    } else if (action.type === "storyteller-action") {
      result = applyStorytellerActionAndResume(state, payload, rng);
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
        ? applyNominationAction(state, { nominatorId: proposal.nominatorId, nomineeId: proposal.nomineeId }, rng)
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
  bridge.resolvedImmediately = !!result.resolvedImmediately;
  bridge.publicAction = !!result.public;
  bridge.speechId = result.speechId ?? result.speech?.id ?? "";
  bridge.autoAdvance = result.autoAdvance ?? null;
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
  writeTextFileAtomicWithRetry(viewModelPath, stringifyUnityViewModel(viewModel));
  const replayPaths = writeDialogueReplaySnapshot(state, { action, result, replayDir, replayPath, latestReplayPath, disableReplayRecorder });
  if (resultPath) {
    writeJson(resultPath, {
      actionId: action?.id ?? "",
      actionType: action?.type ?? "",
      ok: !!result?.ok,
      skipped: !!result?.skipped,
      message: result?.message ?? result?.reason ?? "",
      resolvedImmediately: !!result?.resolvedImmediately,
      publicAction: !!result?.public,
      speechId: result?.speechId ?? result?.speech?.id ?? "",
      autoAdvance: result?.autoAdvance ?? null,
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
  const seed = normalizeUnityBridgeInitialSeed(options.seed);

  const state = loadOrCreateUnityState(statePath, options);
  const action = normalizeAction(readJson(actionPath, null));
  const rng = action ? createUnityBridgeRng(state, seed) : Math.random;
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
  const seed = normalizeUnityBridgeInitialSeed(options.seed);

  const state = loadOrCreateUnityState(statePath, options);
  const action = normalizeAction(readJson(actionPath, null));
  const rng = action ? createUnityBridgeRng(state, seed) : Math.random;
  const beforeSnapshot = {
    speechCount: state.events?.speeches?.length ?? 0,
    timelineCount: state.aiDialogue?.timeline?.length ?? 0,
  };
  const result = action ? applyUnityAction(state, action, rng) : { ok: true, skipped: true, reason: "No action file." };
  if (action && result.ok) {
    const llmResult = await applyLLMDialoguePostprocess(state, beforeSnapshot, options);
    if (llmResult.enabled) {
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
  let lastActionId = "";
  console.log(`Watching Unity actions: ${actionPath}`);
  console.log("Press Ctrl+C to stop.");
  try {
    const { action, result, paths } = await processUnityActionFileAsync(options);
    const stat = fs.existsSync(actionPath) ? fs.statSync(actionPath) : null;
    lastMtime = stat?.mtimeMs ?? 0;
    lastActionId = action?.id ?? "";
    console.log(`[${new Date().toLocaleTimeString()}] init ${result.ok ? "ok" : "error"} -> ${paths.viewModelPath}`);
  } catch (error) {
    console.error(`Unity action bridge init error: ${error?.stack ?? error}`);
  }
  for (;;) {
    try {
      const stat = fs.existsSync(actionPath) ? fs.statSync(actionPath) : null;
      const mtime = stat?.mtimeMs ?? 0;
      const action = mtime > 0 ? normalizeAction(readJson(actionPath, null)) : null;
      const actionId = action?.id ?? "";
      if (mtime > 0 && (mtime !== lastMtime || (actionId && actionId !== lastActionId))) {
        lastMtime = mtime;
        lastActionId = actionId;
        const { action: processedAction, result, paths } = await processUnityActionFileAsync(options);
        lastActionId = processedAction?.id ?? actionId;
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
    llmMaxLines: Number(argValue("--llm-max-lines", process.env.BOTC_LLM_MAX_LINES_PER_ACTION || `${DEFAULT_LLM_DIALOGUE_MAX_LINES}`)) || DEFAULT_LLM_DIALOGUE_MAX_LINES,
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
