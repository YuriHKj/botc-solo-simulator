import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  chooseAINomination,
  decideAIVote,
  getAIInsightRows,
  initializeAI,
  runAIDiscussion,
  runPrivateWhisper,
} from "./ai.js";
import {
  addGrimoireReminder,
  addLog,
  advanceDayStage,
  clearGrimoireNote,
  createNewGame,
  getHumanDayActionState,
  getHumanNightActionState,
  getPendingStorytellerActionState,
  getPlayerById,
  markPublicDiscussionRound,
  removeGrimoireReminder,
  resolveNominationAndVote,
  resolvePendingStorytellerAction,
  runNight,
  setGrimoireMarkedRole,
  setHumanDayActionPlan,
  setHumanNightActionPlan,
  skipDay,
  withSeededRandom,
} from "./engine.js";
import { buildUnityPhaseAdvance, canResolveDayIntoNight } from "./unity_phase_guard.mjs";
import { buildUnityViewModel, stringifyUnityViewModel } from "./unity_viewmodel.js";

const DEFAULT_STREAMING_ASSETS = "unity-prototype/Assets/StreamingAssets";
const DEFAULT_STATE_PATH = `${DEFAULT_STREAMING_ASSETS}/unity_state.json`;
const DEFAULT_VIEWMODEL_PATH = `${DEFAULT_STREAMING_ASSETS}/unity_viewmodel.json`;
const DEFAULT_ACTION_PATH = `${DEFAULT_STREAMING_ASSETS}/unity_action.json`;
const DEFAULT_RESULT_PATH = `${DEFAULT_STREAMING_ASSETS}/unity_action_result.json`;

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

function makeInitialState({ scriptId = "tb", playerCount = 9, preferredHumanRoleId = "washerwoman", seed = 20260506 } = {}) {
  const rng = withSeededRandom(seed);
  const state = createNewGame({ scriptId, playerCount, preferredHumanRoleId }, rng);
  initializeAI(state);
  state.phase = "night";
  runNight(state, rng);
  initializeAI(state);
  ensureUnityBridge(state);
  state.unityBridge.status = "ready";
  state.unityBridge.message = "Unity bridge initialized.";
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

function normalizeAction(raw) {
  const action = Array.isArray(raw) ? raw[raw.length - 1] : raw;
  if (!action || typeof action !== "object") {
    return null;
  }
  const type = `${action.type ?? ""}`.trim();
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

function defaultPrivateQuestion(payload) {
  if (payload.text) return payload.text;
  if (payload.intent === "claim") return "你是什么身份？";
  if (payload.intent === "night") return "你昨晚拿到了什么信息？";
  if (payload.intent === "trust") return "你现在最信谁？";
  if (payload.intent === "suspect") return "你现在最怀疑谁？";
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
        bridge.selectedPlayerId = player.id;
        result = { ok: true, message: `已选中 ${player.name}。`, selectedPlayerId: player.id };
      }
    } else if (action.type === "private-chat" || action.type === "private-preset") {
      const targetId = selectedOrPayloadPlayerId(state, payload);
      const text = defaultPrivateQuestion(payload);
      result = runPrivateWhisper(
        state,
        {
          targetId,
          humanLine: text,
          intentHint: payload.intentHint ?? payload.intent ?? "generic",
          deception: normalizePrivateDeception(payload),
        },
        rng
      );
    } else if (action.type === "public-discussion" || action.type === "public" || action.type === "phase") {
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
  initializeAI(state);
  return { ...result, action };
}

export function writeUnityBridgeOutputs({ state, statePath, viewModelPath, resultPath, action, result }) {
  ensureUnityBridge(state);
  const aiInsights = getAIInsightRows(state);
  const viewModel = buildUnityViewModel(state, { aiInsights });
  writeJson(statePath, { state });
  fs.mkdirSync(path.dirname(viewModelPath), { recursive: true });
  fs.writeFileSync(viewModelPath, stringifyUnityViewModel(viewModel), "utf8");
  if (resultPath) {
    writeJson(resultPath, {
      actionId: action?.id ?? "",
      actionType: action?.type ?? "",
      ok: !!result?.ok,
      skipped: !!result?.skipped,
      message: result?.message ?? result?.reason ?? "",
      revision: state.unityBridge.revision,
      updatedAt: state.unityBridge.updatedAt ?? new Date().toISOString(),
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
  const viewModel = writeUnityBridgeOutputs({ state, statePath, viewModelPath, resultPath, action, result });
  return { state, action, result, viewModel, paths: { statePath, viewModelPath, actionPath, resultPath } };
}

async function watchUnityActions(options = {}) {
  const actionPath = path.resolve(options.actionPath ?? DEFAULT_ACTION_PATH);
  const pollMs = Number(options.pollMs ?? 350) || 350;
  let lastMtime = 0;
  console.log(`Watching Unity actions: ${actionPath}`);
  console.log("Press Ctrl+C to stop.");
  try {
    const { result, paths } = processUnityActionFile(options);
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
        const { result, paths } = processUnityActionFile(options);
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
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const options = cliOptions();
  if (hasFlag("--watch")) {
    await watchUnityActions(options);
  } else {
    const { result, paths } = processUnityActionFile(options);
    console.log(`${result.ok ? "Processed" : "Failed"} Unity action -> ${paths.viewModelPath}`);
    if (result.message || result.reason) {
      console.log(result.message ?? result.reason);
    }
    process.exit(result.ok ? 0 : 1);
  }
}
