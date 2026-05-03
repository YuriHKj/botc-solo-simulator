import {
  chooseAINomination,
  decideAIVote,
  getAIInsightRows,
  initializeAI,
  runAIDiscussion,
  runPrivateWhisper,
} from "./ai.js";
import { getAllRoles, SCRIPT_DEFINITIONS } from "./data.js";
import { createEmptyUtteranceArchive, ensureUtteranceArchive } from "./dialogue_schema.js";
import {
  addLog,
  getHumanNightActionState,
  getPendingStorytellerActionState,
  advanceDayStage,
  createNewGame,
  addGrimoireReminder,
  markPublicDiscussionRound,
  clearGrimoireNote,
  removeGrimoireReminder,
  resolveNominationAndVote,
  resolvePendingStorytellerAction,
  runNight,
  setHumanDayActionPlan,
  setGrimoireMarkedRole,
  setHumanNightActionPlan,
  skipDay,
  useSlayerAbility,
  withSeededRandom,
} from "./engine.js";
import { initUI, promptNightActionChoice, renderGame, showPrivateDialogue, showToast } from "./ui.js";

const SAVE_PREFIX = "botc.solo.save.slot.";
const LATEST_SAVE_KEY = "botc.solo.save.latest";
const SAVE_SLOTS = [1, 2, 3];
const SETTINGS_KEY = "botc.solo.settings.v1";
const FULLSCREEN_HINT_KEY = "botc.ui.fullscreenHint.v1";

const startDom = {};
const settingsDom = {};

const DEFAULT_SETTINGS = {
  resolution: "auto",
  uiScale: 100,
  masterVolume: 100,
  sfxVolume: 100,
};

let state = null;
let rng = Math.random;
let settingsState = { ...DEFAULT_SETTINGS };

function syncWindowModeClass() {
  const isFullscreen = !!document.fullscreenElement;
  document.body.classList.toggle("fullscreen-mode", isFullscreen);
  document.body.classList.toggle("windowed-mode", !isFullscreen);
}

function maybeSuggestFullscreen() {
  if (localStorage.getItem(FULLSCREEN_HINT_KEY) === "1") {
    return;
  }
  localStorage.setItem(FULLSCREEN_HINT_KEY, "1");
  if (!document.fullscreenEnabled || document.fullscreenElement) {
    return;
  }
  showToast("建议全屏体验：点击“设置 -> 全屏模式”，沉浸感会更好。");
}

function ensureState() {
  if (!state) {
    throw new Error("请先新开一局");
  }
}

function refresh() {
  if (!state) {
    return;
  }
  const insights = getAIInsightRows(state);
  renderGame(state, insights);
  persistLatestSave();
}

function handlePendingStorytellerActions({ onDrained = null, drainedFromQueue = false } = {}) {
  if (!state || state.gameOver) {
    refresh();
    return false;
  }
  const action = getPendingStorytellerActionState(state);
  if (!action.available) {
    refresh();
    if (drainedFromQueue) {
      onDrained?.();
    }
    return false;
  }

  refresh();
  promptNightActionChoice(action, {
    mandatory: true,
    onConfirm: (plan) => {
      const result = resolvePendingStorytellerAction(state, plan);
      if (!result.ok) {
        return { ok: false, reason: result.reason };
      }
      showToast(result.message ?? "Storyteller 操作已处理。");
      refresh();
      setTimeout(() => handlePendingStorytellerActions({ onDrained, drainedFromQueue: true }), 0);
      return { ok: true };
    },
    onSkip: () => {
      const result = resolvePendingStorytellerAction(state, { auto: true });
      showToast(result.ok ? result.message ?? "已自动处理 Storyteller 操作。" : result.reason);
      refresh();
      setTimeout(() => handlePendingStorytellerActions({ onDrained, drainedFromQueue: true }), 0);
    },
  });
  return true;
}

function clampNum(value, min, max, fallback) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, parsed));
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      settingsState = { ...DEFAULT_SETTINGS };
      return;
    }
    const parsed = JSON.parse(raw);
    settingsState = {
      resolution: ["auto", "1280x720", "1600x900", "1920x1080"].includes(parsed?.resolution)
        ? parsed.resolution
        : DEFAULT_SETTINGS.resolution,
      uiScale: clampNum(parsed?.uiScale, 80, 130, DEFAULT_SETTINGS.uiScale),
      masterVolume: clampNum(parsed?.masterVolume, 0, 100, DEFAULT_SETTINGS.masterVolume),
      sfxVolume: clampNum(parsed?.sfxVolume, 0, 100, DEFAULT_SETTINGS.sfxVolume),
    };
  } catch {
    settingsState = { ...DEFAULT_SETTINGS };
  }
}

function applySettings() {
  document.documentElement.style.setProperty("--ui-scale", `${settingsState.uiScale / 100}`);
  document.documentElement.style.setProperty("--master-volume", `${settingsState.masterVolume / 100}`);
  document.documentElement.style.setProperty("--sfx-volume", `${settingsState.sfxVolume / 100}`);

  if (settingsState.resolution === "auto") {
    document.documentElement.style.setProperty("--viewport-max-width", "100vw");
    document.documentElement.style.setProperty("--viewport-max-height", "100vh");
  } else {
    const [w, h] = settingsState.resolution.split("x");
    const width = clampNum(w, 960, 3840, 1600);
    const height = clampNum(h, 540, 2160, 900);
    document.documentElement.style.setProperty("--viewport-max-width", `${width}px`);
    document.documentElement.style.setProperty("--viewport-max-height", `${height}px`);
  }
}

function persistSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settingsState));
}

function syncSettingsControls() {
  if (!settingsDom.modal) {
    return;
  }
  settingsDom.resolution.value = settingsState.resolution;
  settingsDom.uiScale.value = `${settingsState.uiScale}`;
  settingsDom.masterVolume.value = `${settingsState.masterVolume}`;
  settingsDom.sfxVolume.value = `${settingsState.sfxVolume}`;
  settingsDom.uiScaleValue.textContent = `${Math.round(settingsState.uiScale)}%`;
  settingsDom.masterVolumeValue.textContent = `${Math.round(settingsState.masterVolume)}%`;
  settingsDom.sfxVolumeValue.textContent = `${Math.round(settingsState.sfxVolume)}%`;
}

function openSettingsModal() {
  if (!settingsDom.modal) {
    return;
  }
  syncSettingsControls();
  settingsDom.modal.classList.add("show");
}

function closeSettingsModal() {
  if (!settingsDom.modal) {
    return;
  }
  settingsDom.modal.classList.remove("show");
}

function saveSettingsFromControls() {
  settingsState = {
    resolution: settingsDom.resolution.value,
    uiScale: clampNum(settingsDom.uiScale.value, 80, 130, DEFAULT_SETTINGS.uiScale),
    masterVolume: clampNum(settingsDom.masterVolume.value, 0, 100, DEFAULT_SETTINGS.masterVolume),
    sfxVolume: clampNum(settingsDom.sfxVolume.value, 0, 100, DEFAULT_SETTINGS.sfxVolume),
  };
  persistSettings();
  applySettings();
  syncSettingsControls();
  showToast("设置已保存。");
}

function tryToggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
    return;
  }
  document.documentElement.requestFullscreen?.().catch(() => {
    showToast("当前环境不支持全屏切换。");
  });
}

function tryExitGame() {
  try {
    window.close();
  } catch {
    showToast("当前环境不允许直接关闭窗口。");
  }
}

function hydrateLoadedState(loadedState) {
  if (!loadedState || !Array.isArray(loadedState.players) || loadedState.players.length < 5) {
    throw new Error("存档内容不完整，无法读取。");
  }

  loadedState.events = loadedState.events ?? {
    claims: [],
    votes: [],
    executions: [],
    nightDeaths: [],
    infoPings: [],
    speeches: [],
  };
  loadedState.logs = Array.isArray(loadedState.logs) ? loadedState.logs : [];
  loadedState.pendingHumanInfo = Array.isArray(loadedState.pendingHumanInfo) ? loadedState.pendingHumanInfo : [];
  loadedState.pendingStorytellerActions = Array.isArray(loadedState.pendingStorytellerActions)
    ? loadedState.pendingStorytellerActions
    : [];
  loadedState.dayStageMeta = loadedState.dayStageMeta ?? {
    privateUsed: 0,
    privateLimit: 0,
    publicRounds: 0,
    privateTargets: [],
  };
  loadedState.humanNightPlan = loadedState.humanNightPlan ?? null;
  loadedState.humanAbilityUsage = loadedState.humanAbilityUsage ?? {};
  loadedState.grimoireNotes = loadedState.grimoireNotes ?? {};
  loadedState.storyFlags = loadedState.storyFlags ?? {
    evilRecognitionDone: loadedState.night >= 1,
  };
  loadedState.grimoireView = !!loadedState.grimoireView;
  loadedState.aiDialogue = loadedState.aiDialogue ?? {};
  loadedState.aiDialogue.pairMemory = loadedState.aiDialogue.pairMemory ?? {};
  loadedState.aiDialogue.timeline = Array.isArray(loadedState.aiDialogue.timeline) ? loadedState.aiDialogue.timeline : [];
  loadedState.aiDialogue.publicRoundByDay = loadedState.aiDialogue.publicRoundByDay ?? {};
  loadedState.aiDialogue.dailyFocusLock = loadedState.aiDialogue.dailyFocusLock ?? {};
  loadedState.aiDialogue.activeSpeech = loadedState.aiDialogue.activeSpeech ?? null;
  loadedState.aiDialogue.lastPublicFocusBySpeaker = loadedState.aiDialogue.lastPublicFocusBySpeaker ?? {};
  loadedState.aiDialogue.lastPublicTemplateBySpeaker = loadedState.aiDialogue.lastPublicTemplateBySpeaker ?? {};
  loadedState.aiAgents = loadedState.aiAgents ?? {};
  loadedState.utteranceArchive = loadedState.utteranceArchive ?? createEmptyUtteranceArchive();
  ensureUtteranceArchive(loadedState);

  if (loadedState.scriptId === "bmr") {
    const bmrDefaults = {
      exorcisedDemonId: null,
      exorcistLastTargetById: {},
      innkeeperProtectedIds: [],
      innkeeperDrunkId: null,
      sailorDrunkIds: [],
      devilsAdvocateProtectedId: null,
      devilsAdvocateLastTargetById: {},
      assassinUsedByIds: [],
      professorUsedByIds: [],
      courtierUsedByIds: [],
      suppressedByRoleId: {},
      pukkaPoisonedId: null,
      poCharged: false,
      zombuulRevived: false,
      zombuulHiddenDead: false,
      shabalothLastTargets: [],
      grandmotherChildById: {},
      godfatherOutsiderIds: [],
      godfatherBonusKillTonight: false,
      gossipPendingKills: 0,
      moonchildPendingById: {},
      moonchildResolvedById: {},
      foolSavedById: {},
      teaLadyProtectedIds: [],
      pacifistSavedToday: false,
      goonTriggeredNight: 0,
      minstrelAoeDrunkUntilNight: 0,
      mastermindPendingDay: null,
      tinkersToAutoKill: {},
      lastDayOutsiderExecuted: false,
      lastDayMinionExecuted: false,
      wokeTonightByPlayerId: {},
      abilityInterferenceCountLastNight: 0,
    };
    loadedState.bmr = loadedState.bmr ?? {
      ...bmrDefaults,
    };
    loadedState.bmr = { ...bmrDefaults, ...loadedState.bmr };
    loadedState.bmr.suppressedByRoleId = loadedState.bmr.suppressedByRoleId ?? {};
  }
  if (loadedState.scriptId === "snv") {
    const snvDefaults = {
      witchCurses: {},
      cerenovusForcedByPlayerId: {},
      cerenovusEnforceDayByPlayerId: {},
      philosopherUsedByIds: [],
      seamstressUsedByIds: [],
      artistUsedByIds: [],
      pitHagTransforms: [],
      philosopherCopiedById: {},
      evilTwinPair: null,
      fangGuJumpUsed: false,
      vigormortisEmpoweredMinionIds: [],
      vigormortisPoisonedIds: [],
      noDashiiPoisonedIds: [],
      sweetheartDrunkId: null,
      klutzPendingById: {},
      sagePendingById: {},
      jugglerGuessesByDay: {},
      lastDayHadDemonVote: false,
      lastDayHadMinionNomination: false,
      abilityInterferenceCountLastNight: 0,
      mathematicianPreviousCount: 0,
      mutantClaimViolationByDay: {},
      savantDayByPlayerId: {},
      barberDiedToday: false,
      dayDeathsByRoleId: {},
    };
    loadedState.snv = loadedState.snv ?? {
      ...snvDefaults,
    };
    loadedState.snv = { ...snvDefaults, ...loadedState.snv };
  }

  loadedState.players.forEach((player) => {
    player.name = player.isHuman ? "你" : `${player.seatIndex + 1}号`;
    player.privateNotes = Array.isArray(player.privateNotes) ? player.privateNotes : [];
    player.speechHistory = Array.isArray(player.speechHistory) ? player.speechHistory : [];
    player.suspicion = player.suspicion ?? {};
    player.tags = Array.isArray(player.tags) ? player.tags : [];
    loadedState.grimoireNotes[player.id] = loadedState.grimoireNotes[player.id] ?? {
      markedRoleId: "",
      reminders: [],
    };
  });

  return loadedState;
}

function runNightWithStorytellerPrompt() {
  if (!state || state.gameOver) {
    return;
  }

  const action = getHumanNightActionState(state);
  if (!action.available) {
    state.pendingHumanInfo = [];
    runNight(state, rng);
    handlePendingStorytellerActions();
    return;
  }

  promptNightActionChoice(action, {
    mandatory: true,
    onConfirm: (plan) => {
      const result = setHumanNightActionPlan(state, plan);
      if (!result.ok) {
        return { ok: false, reason: result.reason };
      }
      showToast(`已确认夜间行动：${result.targetNames}`);
      state.pendingHumanInfo = [];
      runNight(state, rng);
      handlePendingStorytellerActions();
      return { ok: true };
    },
    onSkip: () => {
      showToast("本夜未手动选择目标，系统将按默认逻辑结算。");
      state.pendingHumanInfo = [];
      runNight(state, rng);
      handlePendingStorytellerActions();
    },
  });
}

function beginGame({ scriptId, playerCount, preferredHumanRoleId = "" }) {
  try {
    const parsed = Number.isFinite(playerCount) ? playerCount : Number.parseInt(playerCount, 10);
    const safeCount = Number.isFinite(parsed) ? parsed : 9;
    const normalizedCount = Math.max(5, Math.min(15, Math.floor(safeCount)));
    const seed = Date.now();

    rng = withSeededRandom(seed);
    state = createNewGame({ scriptId, playerCount: normalizedCount, preferredHumanRoleId }, rng);
    state.seed = seed;

    initializeAI(state);
    closeSettingsModal();
    document.getElementById("btnCloseScriptSheet")?.click();
    hideStartMenu();
    syncStartInputsFromCurrentGame();
    runNightWithStorytellerPrompt();
    addLog(state, "hint", "引导：夜晚若有主动技能，会先弹出 Storyteller 选择框。", {});

    refresh();
    renderSaveSlots();
    showToast(`新局已开始：${state.scriptName}`);
    setTimeout(() => {
      maybeSuggestFullscreen();
    }, 420);
  } catch (error) {
    const text = error instanceof Error ? error.message : "创建新局失败。";
    showToast(text);
  }
}

function doWhisper({ targetId, message, intentHint = "generic" }) {
  try {
    ensureState();
    const result = runPrivateWhisper(state, { targetId, humanLine: message, intentHint }, rng);
    if (!result.ok) {
      showToast(result.reason);
      refresh();
      return;
    }

    showPrivateDialogue({
      targetId: result.targetId,
      targetName: result.targetName,
      targetSeat: result.targetSeat,
      personaLabel: result.personaLabel,
      question: result.question,
      response: result.response,
      keepPrompt: true,
    });
    showToast(`私聊完成：${result.targetName}（剩余 ${result.remaining}/${result.limit}）`);
    refresh();
  } catch (error) {
    const text = error instanceof Error ? error.message : "私聊失败。";
    showToast(text);
  }
}

function moveToPublic() {
  try {
    ensureState();
    const result = advanceDayStage(state, "public");
    if (!result.ok) {
      showToast(result.reason);
      refresh();
      return;
    }
    showToast("已进入公聊阶段。");
    refresh();
  } catch (error) {
    const text = error instanceof Error ? error.message : "阶段切换失败。";
    showToast(text);
  }
}

function runDiscussion() {
  try {
    ensureState();
    if (state.phase !== "day") {
      showToast("当前不是白天阶段。");
      return;
    }
    if (state.dayStage !== "public") {
      showToast("请先进入公聊阶段。\n流程：私聊 -> 公聊 -> 提名");
      return;
    }

    runAIDiscussion(state, rng);
    markPublicDiscussionRound(state);
    showToast("已进行一轮公聊。");
    refresh();
  } catch (error) {
    const text = error instanceof Error ? error.message : "AI 公聊失败。";
    showToast(text);
  }
}

function moveToNomination() {
  try {
    ensureState();
    const result = advanceDayStage(state, "nomination");
    if (!result.ok) {
      showToast(result.reason);
      refresh();
      return;
    }
    showToast("已进入提名阶段。");
    refresh();
  } catch (error) {
    const text = error instanceof Error ? error.message : "阶段切换失败。";
    showToast(text);
  }
}

function executeNomination({ nominatorId, nomineeId, humanVoteYes }) {
  try {
    ensureState();

    const result = resolveNominationAndVote(
      state,
      {
        nominatorId,
        nomineeId,
        humanVoteYes,
        decideAIVote: (voter, nominee, currentState) => decideAIVote(voter, nominee, currentState, rng),
      },
      rng
    );

    if (!result.accepted) {
      showToast(result.reason);
      refresh();
      return;
    }

    if (!state.gameOver) {
      if (handlePendingStorytellerActions({ onDrained: runNightWithStorytellerPrompt })) {
        return;
      }
      runNightWithStorytellerPrompt();
      return;
    }
    refresh();
  } catch (error) {
    const text = error instanceof Error ? error.message : "提名执行失败。";
    showToast(text);
  }
}

function aiNomination({ humanVoteYes }) {
  try {
    ensureState();
    if (state.phase !== "day" || state.dayStage !== "nomination") {
      showToast("请先推进到提名阶段。\n流程：私聊 -> 公聊 -> 提名");
      refresh();
      return;
    }

    const proposal = chooseAINomination(state);
    if (!proposal) {
      showToast("AI 暂未形成足够把握的提名。你可以手动提名或跳过本日。");
      refresh();
      return;
    }

    executeNomination({
      nominatorId: proposal.nominatorId,
      nomineeId: proposal.nomineeId,
      humanVoteYes,
    });
  } catch (error) {
    const text = error instanceof Error ? error.message : "AI 自动提名失败。";
    showToast(text);
  }
}

function passDay() {
  try {
    ensureState();
    if (state.phase !== "day" || state.dayStage !== "nomination") {
      showToast("跳过白天只在提名阶段可用。");
      return;
    }
    if (!skipDay(state)) {
      showToast("当前无法跳过白天。");
      return;
    }

    if (!state.gameOver) {
      if (handlePendingStorytellerActions({ onDrained: runNightWithStorytellerPrompt })) {
        return;
      }
      runNightWithStorytellerPrompt();
      return;
    }
    refresh();
  } catch (error) {
    const text = error instanceof Error ? error.message : "跳过白天失败。";
    showToast(text);
  }
}

function runSlayer({ targetId }) {
  try {
    ensureState();
    const human = state.players.find((entry) => entry.isHuman);
    if (!human) {
      showToast("未找到主视角玩家。");
      return;
    }

    const result = useSlayerAbility(state, { shooterId: human.id, targetId }, rng);
    if (!result.ok) {
      showToast(result.reason);
      refresh();
      return;
    }

    if (result.hit) {
      showToast("Slayer 命中！");
    } else {
      showToast("Slayer 发动完成。");
    }

    handlePendingStorytellerActions();
  } catch (error) {
    const text = error instanceof Error ? error.message : "Slayer 发动失败。";
    showToast(text);
  }
}

function setNightAction(plan) {
  try {
    ensureState();
    const result = setHumanNightActionPlan(state, plan);
    if (!result.ok) {
      showToast(result.reason);
      refresh();
      return;
    }

    showToast(`已预设第${result.nightNumber}夜行动：${result.targetNames}`);
    refresh();
  } catch (error) {
    const text = error instanceof Error ? error.message : "夜间行动预设失败。";
    showToast(text);
  }
}

function setDayAction(plan) {
  try {
    ensureState();
    const result = setHumanDayActionPlan(state, plan);
    if (!result.ok) {
      showToast(result.reason);
      refresh();
      return result;
    }
    showToast(`已执行白天行动：${result.targetNames}`);
    refresh();
    return result;
  } catch (error) {
    const text = error instanceof Error ? error.message : "白天行动失败。";
    showToast(text);
    return { ok: false, reason: text };
  }
}

function setMarkedRole({ playerId, roleId }) {
  try {
    ensureState();
    const result = setGrimoireMarkedRole(state, { playerId, roleId });
    if (!result.ok) {
      showToast(result.reason);
      refresh();
      return;
    }
    showToast(roleId ? "已更新角色标记。" : "已清除角色标记。");
    refresh();
  } catch (error) {
    const text = error instanceof Error ? error.message : "设置角色标记失败。";
    showToast(text);
  }
}

function addReminder({ playerId, reminder }) {
  try {
    ensureState();
    const result = addGrimoireReminder(state, { playerId, reminder });
    if (!result.ok) {
      showToast(result.reason);
      refresh();
      return;
    }
    showToast("已添加提醒标记。");
    refresh();
  } catch (error) {
    const text = error instanceof Error ? error.message : "添加提醒失败。";
    showToast(text);
  }
}

function removeReminder({ playerId, reminder }) {
  try {
    ensureState();
    const result = removeGrimoireReminder(state, { playerId, reminder });
    if (!result.ok) {
      showToast(result.reason);
      refresh();
      return;
    }
    showToast("已移除提醒标记。");
    refresh();
  } catch (error) {
    const text = error instanceof Error ? error.message : "移除提醒失败。";
    showToast(text);
  }
}

function clearMark({ playerId }) {
  try {
    ensureState();
    const result = clearGrimoireNote(state, { playerId });
    if (!result.ok) {
      showToast(result.reason);
      refresh();
      return;
    }
    showToast("已清空该玩家全部标记。");
    refresh();
  } catch (error) {
    const text = error instanceof Error ? error.message : "清空标记失败。";
    showToast(text);
  }
}

function toggleGrimoire(enabled) {
  try {
    ensureState();
    state.grimoireView = !!enabled;
    refresh();
  } catch {
    // 未开局时忽略。
  }
}

function readSavePayload(raw) {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !parsed.state) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveTitleFromState(savedState) {
  const alive = Array.isArray(savedState?.players) ? savedState.players.filter((entry) => entry.alive).length : 0;
  return `${savedState?.scriptName ?? "未知剧本"} · Day ${savedState?.day ?? "?"} / Night ${savedState?.night ?? "?"} · 存活 ${alive}`;
}

function formatSaveTime(ts) {
  if (!Number.isFinite(ts)) {
    return "未知时间";
  }
  const date = new Date(ts);
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  const hh = `${date.getHours()}`.padStart(2, "0");
  const mm = `${date.getMinutes()}`.padStart(2, "0");
  return `${y}-${m}-${d} ${hh}:${mm}`;
}

function persistLatestSave() {
  if (!state) {
    return;
  }
  const payload = {
    version: 1,
    savedAt: Date.now(),
    label: "latest",
    state,
  };
  localStorage.setItem(LATEST_SAVE_KEY, JSON.stringify(payload));
}

function saveToSlot(slotId) {
  if (!state) {
    showToast("当前没有可保存的对局。");
    return;
  }
  const payload = {
    version: 1,
    savedAt: Date.now(),
    label: `slot-${slotId}`,
    state,
  };
  localStorage.setItem(`${SAVE_PREFIX}${slotId}`, JSON.stringify(payload));
  persistLatestSave();
  renderSaveSlots();
  showToast(`已保存到槽位 ${slotId}。`);
}

function loadFromPayload(payload, sourceLabel) {
  try {
    const loaded = hydrateLoadedState(payload.state);
    state = loaded;
    state.seed = state.seed ?? Date.now();
    rng = withSeededRandom(state.seed);
    initializeAI(state);
    addLog(state, "setup", `已读取存档：${sourceLabel}。`, {});
    syncStartInputsFromCurrentGame();
    hideStartMenu();
    refresh();
    showToast(`已读取存档：${sourceLabel}`);
    handlePendingStorytellerActions();
    setTimeout(() => {
      maybeSuggestFullscreen();
    }, 420);
  } catch (error) {
    showToast(error instanceof Error ? error.message : "读取存档失败。");
  }
}

function loadLatestSave() {
  const payload = readSavePayload(localStorage.getItem(LATEST_SAVE_KEY));
  if (!payload) {
    showToast("未找到最近存档。");
    return;
  }
  loadFromPayload(payload, "最近存档");
}

function loadSlot(slotId) {
  const payload = readSavePayload(localStorage.getItem(`${SAVE_PREFIX}${slotId}`));
  if (!payload) {
    showToast(`槽位 ${slotId} 没有存档。`);
    return;
  }
  loadFromPayload(payload, `槽位 ${slotId}`);
}

function deleteSlot(slotId) {
  localStorage.removeItem(`${SAVE_PREFIX}${slotId}`);
  renderSaveSlots();
  showToast(`已清空槽位 ${slotId}。`);
}

function renderSaveSlots() {
  if (!startDom.saveSlots) {
    return;
  }

  startDom.saveSlots.innerHTML = "";
  SAVE_SLOTS.forEach((slotId) => {
    const payload = readSavePayload(localStorage.getItem(`${SAVE_PREFIX}${slotId}`));

    const root = document.createElement("div");
    root.className = "save-slot";

    const row = document.createElement("div");
    row.className = "save-slot-row";

    const title = document.createElement("div");
    title.className = "save-slot-title";
    title.textContent = payload ? `槽位 ${slotId} · ${saveTitleFromState(payload.state)}` : `槽位 ${slotId} · 空`;

    const actions = document.createElement("div");
    actions.className = "save-slot-actions";

    const btnSave = document.createElement("button");
    btnSave.type = "button";
    btnSave.textContent = "保存";
    btnSave.disabled = !state;
    btnSave.addEventListener("click", () => saveToSlot(slotId));

    const btnLoad = document.createElement("button");
    btnLoad.type = "button";
    btnLoad.textContent = "读取";
    btnLoad.disabled = !payload;
    btnLoad.addEventListener("click", () => loadSlot(slotId));

    const btnDelete = document.createElement("button");
    btnDelete.type = "button";
    btnDelete.textContent = "删除";
    btnDelete.disabled = !payload;
    btnDelete.addEventListener("click", () => deleteSlot(slotId));

    actions.appendChild(btnSave);
    actions.appendChild(btnLoad);
    actions.appendChild(btnDelete);

    row.appendChild(title);
    row.appendChild(actions);
    root.appendChild(row);

    const meta = document.createElement("div");
    meta.className = "save-slot-meta";
    meta.textContent = payload ? `保存时间：${formatSaveTime(payload.savedAt)}` : "尚未保存";
    root.appendChild(meta);

    startDom.saveSlots.appendChild(root);
  });

  startDom.btnCloseStartMenu.disabled = !state;
}

function showStartMenu() {
  closeSettingsModal();
  document.getElementById("btnCloseScriptSheet")?.click();
  startDom.screen.classList.add("show");
  document.body.classList.add("menu-open");
  renderSaveSlots();
}

function hideStartMenu() {
  startDom.screen.classList.remove("show");
  document.body.classList.remove("menu-open");
}

function syncStartInputsFromCurrentGame() {
  if (!state) {
    return;
  }
  const currentCount = state.players.length;
  const human = state.players.find((entry) => entry.isHuman);
  const humanRoleId = human?.roleId ?? "";
  if (startDom.startScript) {
    startDom.startScript.value = state.scriptId;
    populateRoleSelect(startDom.startRole, state.scriptId, humanRoleId);
  }
  if (startDom.startPlayerCount) {
    startDom.startPlayerCount.value = `${currentCount}`;
  }
  const sidebarScript = document.getElementById("scriptSelect");
  const sidebarCount = document.getElementById("playerCount");
  if (sidebarScript) {
    sidebarScript.value = state.scriptId;
  }
  if (sidebarCount) {
    sidebarCount.value = `${currentCount}`;
  }
  populateRoleSelect(document.getElementById("roleSelect"), state.scriptId, humanRoleId);
}

function roleCategoryLabel(category) {
  const map = {
    townsfolk: "镇民",
    outsider: "外来者",
    minion: "爪牙",
    demon: "恶魔",
  };
  return map[category] ?? category;
}

function populateRoleSelect(selectEl, scriptId, selectedValue = "") {
  if (!selectEl) {
    return;
  }
  const roles = getAllRoles(scriptId);
  selectEl.innerHTML = "";

  const randomOption = document.createElement("option");
  randomOption.value = "";
  randomOption.textContent = "随机（默认）";
  selectEl.appendChild(randomOption);

  roles.forEach((role) => {
    const option = document.createElement("option");
    option.value = role.id;
    option.textContent = `[${roleCategoryLabel(role.category)}] ${role.name}`;
    if (selectedValue && selectedValue === role.id) {
      option.selected = true;
    }
    selectEl.appendChild(option);
  });

  if (!selectedValue) {
    randomOption.selected = true;
  }
}

function initDefaults() {
  const scriptSelect = document.getElementById("scriptSelect");
  const roleSelect = document.getElementById("roleSelect");
  const startScriptSelect = document.getElementById("startScriptSelect");
  const startRoleSelect = document.getElementById("startRoleSelect");
  scriptSelect.innerHTML = "";
  startScriptSelect.innerHTML = "";

  SCRIPT_DEFINITIONS.forEach((script) => {
    const optionA = document.createElement("option");
    optionA.value = script.id;
    optionA.textContent = script.name;
    scriptSelect.appendChild(optionA);

    const optionB = document.createElement("option");
    optionB.value = script.id;
    optionB.textContent = script.name;
    startScriptSelect.appendChild(optionB);
  });

  document.getElementById("playerCount").value = "9";
  document.getElementById("startPlayerCount").value = "9";

  populateRoleSelect(roleSelect, scriptSelect.value || SCRIPT_DEFINITIONS[0].id, "");
  populateRoleSelect(startRoleSelect, startScriptSelect.value || SCRIPT_DEFINITIONS[0].id, "");

  scriptSelect.addEventListener("change", () => {
    populateRoleSelect(roleSelect, scriptSelect.value, roleSelect.value);
  });
  startScriptSelect.addEventListener("change", () => {
    populateRoleSelect(startRoleSelect, startScriptSelect.value, startRoleSelect.value);
  });
}

function bindStartMenuEvents() {
  startDom.screen = document.getElementById("startScreen");
  startDom.startScript = document.getElementById("startScriptSelect");
  startDom.startPlayerCount = document.getElementById("startPlayerCount");
  startDom.startRole = document.getElementById("startRoleSelect");
  startDom.btnStartFromMenu = document.getElementById("btnStartFromMenu");
  startDom.btnLoadLatestSave = document.getElementById("btnLoadLatestSave");
  startDom.saveSlots = document.getElementById("startSaveSlots");
  startDom.btnCloseStartMenu = document.getElementById("btnCloseStartMenu");
  startDom.btnOpenStartMenu = document.getElementById("btnOpenStartMenu");
  startDom.btnOpenSheetFromStart = document.getElementById("btnOpenSheetFromStart");
  startDom.btnOpenSettingsFromStart = document.getElementById("btnOpenSettingsFromStart");
  startDom.btnOpenSettings = document.getElementById("btnOpenSettings");
  startDom.btnExitGame = document.getElementById("btnExitGame");

  startDom.btnStartFromMenu.addEventListener("click", () => {
    beginGame({
      scriptId: startDom.startScript.value,
      playerCount: Number.parseInt(startDom.startPlayerCount.value, 10),
      preferredHumanRoleId: startDom.startRole?.value || "",
    });
  });

  startDom.btnLoadLatestSave.addEventListener("click", () => {
    loadLatestSave();
  });

  startDom.btnCloseStartMenu.addEventListener("click", () => {
    hideStartMenu();
  });

  startDom.btnOpenStartMenu.addEventListener("click", () => {
    showStartMenu();
  });

  startDom.btnOpenSettingsFromStart?.addEventListener("click", () => {
    openSettingsModal();
  });
  startDom.btnOpenSheetFromStart?.addEventListener("click", () => {
    document.getElementById("btnOpenScriptSheet")?.click();
  });
  startDom.btnOpenSettings?.addEventListener("click", () => {
    openSettingsModal();
  });
  startDom.btnExitGame?.addEventListener("click", () => {
    tryExitGame();
  });
}

function bindSettingsEvents() {
  settingsDom.modal = document.getElementById("settingsModal");
  settingsDom.btnClose = document.getElementById("btnCloseSettingsModal");
  settingsDom.btnSave = document.getElementById("btnSaveSettings");
  settingsDom.btnFullscreen = document.getElementById("btnToggleFullscreen");
  settingsDom.resolution = document.getElementById("settingResolutionSelect");
  settingsDom.uiScale = document.getElementById("settingUIScaleRange");
  settingsDom.masterVolume = document.getElementById("settingMasterVolumeRange");
  settingsDom.sfxVolume = document.getElementById("settingSfxVolumeRange");
  settingsDom.uiScaleValue = document.getElementById("settingUIScaleValue");
  settingsDom.masterVolumeValue = document.getElementById("settingMasterVolumeValue");
  settingsDom.sfxVolumeValue = document.getElementById("settingSfxVolumeValue");

  settingsDom.btnClose.addEventListener("click", () => closeSettingsModal());
  settingsDom.btnSave.addEventListener("click", () => saveSettingsFromControls());
  settingsDom.btnFullscreen.addEventListener("click", () => tryToggleFullscreen());

  settingsDom.uiScale.addEventListener("input", () => {
    settingsDom.uiScaleValue.textContent = `${settingsDom.uiScale.value}%`;
  });
  settingsDom.masterVolume.addEventListener("input", () => {
    settingsDom.masterVolumeValue.textContent = `${settingsDom.masterVolume.value}%`;
  });
  settingsDom.sfxVolume.addEventListener("input", () => {
    settingsDom.sfxVolumeValue.textContent = `${settingsDom.sfxVolume.value}%`;
  });

  settingsDom.modal.addEventListener("click", (event) => {
    if (event.target === settingsDom.modal) {
      closeSettingsModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && settingsDom.modal.classList.contains("show")) {
      closeSettingsModal();
    }
  });
  document.addEventListener("fullscreenchange", () => {
    syncWindowModeClass();
  });
}

function boot() {
  loadSettings();
  applySettings();
  initDefaults();

  initUI({
    onNewGame: beginGame,
    onWhisper: doWhisper,
    onToPublic: moveToPublic,
    onAIDiscuss: runDiscussion,
    onToNomination: moveToNomination,
    onNominate: executeNomination,
    onAINominate: aiNomination,
    onSkipDay: passDay,
    onSlayer: runSlayer,
    onSetNightAction: setNightAction,
    onSetDayAction: setDayAction,
    onSetMarkedRole: setMarkedRole,
    onAddReminder: addReminder,
    onRemoveReminder: removeReminder,
    onClearMark: clearMark,
    onToggleGrimoire: toggleGrimoire,
  });

  bindStartMenuEvents();
  bindSettingsEvents();
  syncSettingsControls();

  const status = document.getElementById("statusLine");
  if (status) {
    status.textContent = "请选择新游戏或读取存档。";
  }

  syncWindowModeClass();
  showStartMenu();
}

try {
  boot();
} catch (error) {
  const status = document.getElementById("statusLine");
  if (status) {
    status.textContent = `启动失败：${error instanceof Error ? error.message : "未知错误"}`;
  }
  // eslint-disable-next-line no-console
  console.error(error);
}
