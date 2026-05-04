import {
  getGrimoireNote,
  getHumanDayActionState,
  getHumanNightActionState,
  getNightOrderReference,
  publicRoleIcon,
  publicRoleLabel,
} from "./engine.js";
import { getOfficialReminderCatalog, getOfficialRoleReference } from "./grimoire_reference.js";
import { getAllRoles } from "./data.js";

const dom = {};
let uiHandlers = null;
const sidebarState = {
  leftCollapsed: false,
  rightCollapsed: false,
  bottomCollapsed: true,
  leftDensity: "compact",
};
const LAYOUT_MODES = ["mode-focus", "mode-dialogue", "mode-night-action", "mode-review"];
const VIEWPORT_PROFILES = ["viewport-wide", "viewport-narrow", "viewport-compact"];
const LAYOUT_DEBUG_KEY = "botc.ui.debugLayout";
let layoutDebugEnabled = false;
let currentLayoutMode = "mode-focus";

const SCRIPT_SHEET_ASSETS = {
  tb: {
    title: "暗流涌动 (Trouble Brewing)",
    image: "./assets/references/tb_sheet.png",
  },
  bmr: {
    title: "黯月初升 (Bad Moon Rising)",
    image: "./assets/references/bmr_sheet.png",
  },
  snv: {
    title: "梦殒春宵 (Sects & Violets)",
    image: "./assets/references/snv_sheet.png",
  },
};

const FALLBACK_REMINDERS = {
  tb: ["中毒", "醉酒", "保护", "失去能力", "死亡", "主人", "镇民", "外来者", "爪牙", "错误", "干扰项", "是恶魔"],
  bmr: ["中毒", "醉酒", "保护", "失去能力", "死亡", "复活", "诅咒", "充能", "今晚死亡", "明日死亡"],
  snv: ["中毒", "醉酒", "保护", "失去能力", "死亡", "诅咒", "疯狂", "强制发言", "已发动", "保留能力"],
};
const WEB_ASSET_ROOT = "./assets/reference_scraped/grimoire/assets/ext/oss.gstonegames.com/data_file/clocktower/web";
const TOKEN_BASE_ICON = `${WEB_ASSET_ROOT}/token1.png`;
const UNKNOWN_TOKEN_ICON = `${WEB_ASSET_ROOT}/vote1.png`;
const SHROUD_ICON = `${WEB_ASSET_ROOT}/shroud1.png`;
const REMINDER_BASE_ICON = `${WEB_ASSET_ROOT}/reminder1.png`;
const PLUS_ICON = `${WEB_ASSET_ROOT}/icons/plus1.png`;
const REMOVE_ICON = `${WEB_ASSET_ROOT}/icons/x.png`;
const PORTRAIT_ASSETS = [
  "./assets/reference_scraped/home/ext/oss.gstonegames.com/data_file/clocktower/home_page/center1.png",
  "./assets/reference_scraped/home/ext/oss.gstonegames.com/data_file/clocktower/home_page/center2.png",
  "./assets/reference_scraped/home/ext/oss.gstonegames.com/data_file/clocktower/home_page/center3.png",
  "./assets/reference_scraped/home/ext/oss.gstonegames.com/data_file/clocktower/home_page/center4.png",
  "./assets/reference_scraped/home/ext/oss.gstonegames.com/data_file/clocktower/home_page/center5.png",
];
const PUBLIC_PLAYBACK_SPEEDS = [
  { label: "1x", delay: 920, initialDelay: 260 },
  { label: "2x", delay: 420, initialDelay: 120 },
  { label: "4x", delay: 130, initialDelay: 40 },
];

let currentScriptId = "tb";
let sheetScriptId = "tb";
let lastRenderedState = null;
let lastRenderedAIInsights = [];
let lastStageKey = "";
let phaseShiftTimer = null;
let activeMarkPlayerId = "";
let nightModalRequest = null;
let revealPlayedForGameKey = "";
let chatDramaTargetId = "";
let selectedReviewAIId = "";
const selectedReviewTargetByAI = {};
const seenDebateIds = new Set();
const QUICK_WHISPER_PROMPT_META = [
  { text: "你是什么身份？", intentHint: "claim" },
  { text: "你愿意给身份范围吗？", intentHint: "claim" },
  { text: "你愿意和我交换身份吗？", intentHint: "claim" },
  { text: "你有没有硬信息能证明自己？", intentHint: "claim" },
  { text: "你昨晚拿到了什么信息？", intentHint: "night" },
  { text: "你的首夜信息是什么？", intentHint: "night" },
  { text: "你最怀疑谁？", intentHint: "suspect" },
  { text: "你今天会提名谁？", intentHint: "vote" },
  { text: "你今天会投谁？", intentHint: "vote" },
  { text: "你觉得我现在最该查谁？", intentHint: "plan" },
  { text: "给我两个你判断的关键理由。", intentHint: "reason" },
  { text: "你今天为什么这么站边？", intentHint: "reason" },
  { text: "你觉得谁在带坏节奏？", intentHint: "suspect" },
  { text: "你觉得谁的身份最不像？", intentHint: "suspect" },
  { text: "你对当前局势的站边是什么？", intentHint: "plan" },
];
const QUICK_WHISPER_PROMPTS = QUICK_WHISPER_PROMPT_META.map((entry) => entry.text);
const CHAT_DRAMA_PRIMARY_PROMPT_COUNT = 8;
let selectedQuickWhisperPrompt = QUICK_WHISPER_PROMPTS[0];
let selectedChatDramaPrompt = QUICK_WHISPER_PROMPTS[0];
let publicPlaybackTimer = null;
let chatDramaTypingTimer = null;
const publicPlayback = {
  key: "",
  day: 0,
  roundInDay: 0,
  visibleOrder: Number.POSITIVE_INFINITY,
  maxOrder: -1,
  speedIndex: 0,
};
const WHISPER_INTENT_LABELS = {
  suspect: "怀疑判断",
  reason: "理由依据",
  trust: "站边信任",
  claim: "身份表态",
  vote: "投票提名",
  night: "夜间信息",
  compare: "目标比较",
  plan: "行动计划",
  generic: "泛问追问",
};

function qs(id) {
  return document.getElementById(id);
}

function uniqueStrings(values) {
  return [...new Set((values ?? []).map((entry) => `${entry ?? ""}`.trim()).filter(Boolean))];
}

function seatDisplayName(player, includeYouTag = true) {
  const seat = `${player.seatIndex + 1}号`;
  if (player.isHuman) {
    return includeYouTag ? `${seat}(你)` : seat;
  }
  return seat;
}

function playerNameById(state, playerId) {
  return state.players.find((entry) => entry.id === playerId)?.name ?? playerId ?? "--";
}

function portraitAssetForSeat(seatNumber) {
  const safeSeat = Number.isFinite(seatNumber) ? Math.max(1, Math.floor(seatNumber)) : 1;
  return PORTRAIT_ASSETS[(safeSeat - 1) % PORTRAIT_ASSETS.length];
}

function compactText(text, maxLength = 22) {
  const clean = `${text ?? ""}`.replace(/\s+/g, " ").trim();
  if (clean.length <= maxLength) {
    return clean;
  }
  return `${clean.slice(0, maxLength)}…`;
}

function stopPublicPlayback() {
  if (publicPlaybackTimer) {
    clearTimeout(publicPlaybackTimer);
    publicPlaybackTimer = null;
  }
}

function publicPlaybackSpeed() {
  return PUBLIC_PLAYBACK_SPEEDS[publicPlayback.speedIndex] ?? PUBLIC_PLAYBACK_SPEEDS[0];
}

function publicPlaybackDelay(initial = false) {
  const speed = publicPlaybackSpeed();
  return initial ? speed.initialDelay : speed.delay;
}

function updateDebatePlaybackControls() {
  if (!dom.btnDebateSpeed || !dom.btnDebateSkip || !dom.debateProgressFill) {
    return;
  }
  const active = publicPlayback.key !== "" && Number.isFinite(publicPlayback.maxOrder) && publicPlayback.maxOrder >= 0;
  const complete = !active || publicPlayback.visibleOrder >= publicPlayback.maxOrder;
  const total = active ? publicPlayback.maxOrder + 1 : 1;
  const shown = active ? Math.max(0, Math.min(total, publicPlayback.visibleOrder + 1)) : 0;
  const pct = total > 0 ? Math.round((shown / total) * 100) : 0;

  dom.btnDebateSpeed.textContent = `速度 ${publicPlaybackSpeed().label}`;
  dom.btnDebateSpeed.disabled = !active;
  dom.btnDebateSkip.disabled = complete;
  dom.debateProgressFill.style.width = `${pct}%`;
  dom.debateProgressFill.classList.toggle("complete", complete && active);
}

function publicRoundItems(state) {
  if (!state?.aiDialogue?.timeline || publicPlayback.key === "") {
    return [];
  }
  return state.aiDialogue.timeline.filter(
    (entry) =>
      entry.mode === "public" &&
      entry.day === publicPlayback.day &&
      entry.roundInDay === publicPlayback.roundInDay
  );
}

function activePublicPlaybackItem(state) {
  if (publicPlayback.key === "" || !Number.isFinite(publicPlayback.visibleOrder) || publicPlayback.visibleOrder < 0) {
    return null;
  }
  return (
    publicRoundItems(state).find((entry) => entry.orderIndex === publicPlayback.visibleOrder) ??
    null
  );
}

function advancePublicPlayback() {
  publicPlayback.visibleOrder += 1;
  if (lastRenderedState) {
    renderDebateStage(lastRenderedState);
  }
  if (publicPlayback.visibleOrder < publicPlayback.maxOrder) {
    publicPlaybackTimer = setTimeout(advancePublicPlayback, publicPlaybackDelay(false));
    return;
  }
  publicPlaybackTimer = null;
  updateDebatePlaybackControls();
}

function schedulePublicPlayback(initial = false) {
  stopPublicPlayback();
  if (publicPlayback.key === "" || publicPlayback.visibleOrder >= publicPlayback.maxOrder) {
    updateDebatePlaybackControls();
    return;
  }
  publicPlaybackTimer = setTimeout(advancePublicPlayback, publicPlaybackDelay(initial));
}

function skipPublicPlayback() {
  if (publicPlayback.key === "") {
    return;
  }
  stopPublicPlayback();
  publicPlayback.visibleOrder = publicPlayback.maxOrder;
  if (lastRenderedState) {
    renderDebateStage(lastRenderedState);
  }
  updateDebatePlaybackControls();
}

function cyclePublicPlaybackSpeed() {
  publicPlayback.speedIndex = (publicPlayback.speedIndex + 1) % PUBLIC_PLAYBACK_SPEEDS.length;
  if (publicPlaybackTimer) {
    schedulePublicPlayback(false);
  }
  updateDebatePlaybackControls();
}

function loadSidebarState() {
  try {
    const leftStored = localStorage.getItem("botc.sidebar.left");
    const rightStored = localStorage.getItem("botc.sidebar.right");
    const bottomStored = localStorage.getItem("botc.sidebar.bottom");
    const leftDensityStored = localStorage.getItem("botc.sidebar.leftDensity");
    sidebarState.leftCollapsed = leftStored === null ? true : leftStored === "1";
    sidebarState.rightCollapsed = rightStored === null ? true : rightStored === "1";
    sidebarState.bottomCollapsed = bottomStored === null ? true : bottomStored === "1";
    sidebarState.leftDensity = leftDensityStored === "full" ? "full" : "compact";
  } catch {
    sidebarState.leftCollapsed = true;
    sidebarState.rightCollapsed = true;
    sidebarState.bottomCollapsed = true;
    sidebarState.leftDensity = "compact";
  }
}

function persistSidebarState() {
  try {
    localStorage.setItem("botc.sidebar.left", sidebarState.leftCollapsed ? "1" : "0");
    localStorage.setItem("botc.sidebar.right", sidebarState.rightCollapsed ? "1" : "0");
    localStorage.setItem("botc.sidebar.bottom", sidebarState.bottomCollapsed ? "1" : "0");
    localStorage.setItem("botc.sidebar.leftDensity", sidebarState.leftDensity === "full" ? "full" : "compact");
  } catch {
    // 忽略本地存储失败
  }
}

function loadLayoutDebugState() {
  try {
    layoutDebugEnabled = localStorage.getItem(LAYOUT_DEBUG_KEY) === "1";
  } catch {
    layoutDebugEnabled = false;
  }
}

function persistLayoutDebugState() {
  try {
    localStorage.setItem(LAYOUT_DEBUG_KEY, layoutDebugEnabled ? "1" : "0");
  } catch {
    // 忽略本地存储失败
  }
}

function applyLayoutDebugState() {
  document.body.classList.toggle("debug-layout", layoutDebugEnabled);
}

function applyLayoutMode(mode) {
  if (!dom.appShell) {
    return;
  }
  const safeMode = LAYOUT_MODES.includes(mode) ? mode : "mode-focus";
  LAYOUT_MODES.forEach((item) => {
    dom.appShell.classList.remove(item);
  });
  dom.appShell.classList.add(safeMode);
  currentLayoutMode = safeMode;
}

function applyViewportProfile() {
  if (!dom.appShell) {
    return;
  }
  const width = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 1);
  const height = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 1);
  const ratio = width / height;

  let profile = "viewport-wide";
  if (width < 1024) {
    profile = "viewport-compact";
  } else if (ratio < 1.68 || width < 1460) {
    profile = "viewport-narrow";
  }

  VIEWPORT_PROFILES.forEach((entry) => {
    dom.appShell.classList.remove(entry);
    document.body.classList.remove(entry);
  });
  dom.appShell.classList.add(profile);
  document.body.classList.add(profile);
}

function deriveLayoutMode(state) {
  if (!state) {
    return "mode-focus";
  }
  if (state.gameOver) {
    return "mode-review";
  }
  if (state.phase === "night") {
    return "mode-night-action";
  }
  if (state.phase === "day" && (state.dayStage === "private" || state.dayStage === "public")) {
    return "mode-dialogue";
  }
  return "mode-focus";
}

function applySidebarState() {
  dom.appShell.classList.toggle("left-collapsed", sidebarState.leftCollapsed);
  dom.appShell.classList.toggle("right-collapsed", sidebarState.rightCollapsed);
  dom.appShell.classList.toggle("bottom-collapsed", sidebarState.bottomCollapsed);
  dom.appShell.classList.toggle("left-compact", sidebarState.leftDensity === "compact");
  dom.appShell.classList.toggle("left-full", sidebarState.leftDensity === "full");

  dom.btnToggleLeft.textContent = sidebarState.leftCollapsed ? "⟩" : "⟨";
  dom.btnToggleLeft.title = sidebarState.leftCollapsed ? "展开左侧栏" : "收起左侧栏";
  dom.btnToggleLeft.setAttribute("aria-label", dom.btnToggleLeft.title);

  dom.btnToggleRight.textContent = sidebarState.rightCollapsed ? "⟨" : "⟩";
  dom.btnToggleRight.title = sidebarState.rightCollapsed ? "展开右侧栏" : "收起右侧栏";
  dom.btnToggleRight.setAttribute("aria-label", dom.btnToggleRight.title);

  if (dom.btnCollapseLeftPanel) {
    dom.btnCollapseLeftPanel.textContent = sidebarState.leftCollapsed ? "展开 ⟩" : "收起 ⟨";
  }
  if (dom.btnCollapseRightPanel) {
    dom.btnCollapseRightPanel.textContent = sidebarState.rightCollapsed ? "展开 ⟨" : "收起 ⟩";
  }
  if (dom.btnToggleLeftDensity) {
    dom.btnToggleLeftDensity.textContent = sidebarState.leftDensity === "compact" ? "详细模式" : "紧凑模式";
    dom.btnToggleLeftDensity.title = sidebarState.leftDensity === "compact" ? "切换到详细模式" : "切换到紧凑模式";
    dom.btnToggleLeftDensity.setAttribute("aria-label", dom.btnToggleLeftDensity.title);
  }
  if (dom.btnToggleBottom) {
    dom.btnToggleBottom.textContent = sidebarState.bottomCollapsed ? "展开底部" : "收起底部";
  }
  if (dom.recentEventCapsule) {
    dom.recentEventCapsule.classList.toggle("show", sidebarState.rightCollapsed);
  }
}

function toggleLeftSidebar() {
  sidebarState.leftCollapsed = !sidebarState.leftCollapsed;
  applySidebarState();
  persistSidebarState();
  fitBoardToSquare();
}

function toggleRightSidebar() {
  sidebarState.rightCollapsed = !sidebarState.rightCollapsed;
  applySidebarState();
  persistSidebarState();
  fitBoardToSquare();
}

function toggleBottomPanels() {
  sidebarState.bottomCollapsed = !sidebarState.bottomCollapsed;
  applySidebarState();
  persistSidebarState();
  fitBoardToSquare();
}

function toggleLeftDensity() {
  sidebarState.leftDensity = sidebarState.leftDensity === "compact" ? "full" : "compact";
  applySidebarState();
  persistSidebarState();
  fitBoardToSquare();
}

function fitBoardToSquare() {
  if (!dom.boardWrap || !dom.grimoire) {
    return;
  }

  const bounds = dom.boardWrap.getBoundingClientRect();
  const theaterMode =
    !!dom.appShell &&
    dom.appShell.classList.contains("left-collapsed") &&
    dom.appShell.classList.contains("right-collapsed") &&
    dom.appShell.classList.contains("bottom-collapsed");
  const stageShortSide = Math.max(280, Math.min(bounds.width, bounds.height));
  const safeWidth = Math.max(300, bounds.width * (theaterMode ? 0.985 : 0.975));
  const safeHeight = Math.max(300, bounds.height * (theaterMode ? 1.01 : 0.985));
  const minSize = stageShortSide >= 520 ? 520 : Math.floor(stageShortSide * 0.94);
  const maxSize = Math.floor(stageShortSide * (theaterMode ? 1.03 : 1));
  const candidate = Math.floor(Math.min(safeWidth, safeHeight, maxSize));
  const size = Math.max(minSize, candidate);

  dom.grimoire.style.width = `${size}px`;
  dom.grimoire.style.height = `${size}px`;
}

function tokenMetrics(playerCount, boardSize = 780) {
  const safePlayers = Math.max(5, Number.isFinite(playerCount) ? playerCount : 9);
  if (playerCount <= 8) {
    const radius = 36.8;
    const arc = (2 * Math.PI * ((boardSize * radius) / 100)) / safePlayers;
    return { size: Math.round(Math.max(62, Math.min(108, arc * 0.51))), radius };
  }
  if (playerCount <= 10) {
    const radius = 37.6;
    const arc = (2 * Math.PI * ((boardSize * radius) / 100)) / safePlayers;
    return { size: Math.round(Math.max(58, Math.min(96, arc * 0.49))), radius };
  }
  if (playerCount <= 12) {
    const radius = 38.6;
    const arc = (2 * Math.PI * ((boardSize * radius) / 100)) / safePlayers;
    return { size: Math.round(Math.max(52, Math.min(88, arc * 0.46))), radius };
  }
  const radius = 39;
  const arc = (2 * Math.PI * ((boardSize * radius) / 100)) / safePlayers;
  return { size: Math.round(Math.max(46, Math.min(80, arc * 0.42))), radius };
}

function markerDefs(state, player) {
  const defs = [];
  const poisoned = !!player.poisoned || !!player.poisonedTomorrowDay;
  const protectedByMonk = state.tb?.lastMonkProtectedId === player.id || state.tb?.monkProtectedId === player.id;
  const ghostVote = !player.alive && player.ghostVoteAvailable;

  if (state.grimoireView && poisoned) {
    defs.push({ label: "毒", className: "marker-poison", title: "中毒或醉酒" });
  }
  if (state.grimoireView && protectedByMonk) {
    defs.push({ label: "护", className: "marker-protect", title: "受到僧侣保护" });
  }
  if (ghostVote) {
    defs.push({ label: "鬼", className: "marker-ghost", title: "死亡但仍有鬼票" });
  }
  if (!player.alive && !player.ghostVoteAvailable) {
    defs.push({ label: "空", className: "marker-empty", title: "鬼票已使用" });
  }

  return defs;
}

function createMarkerLayer(state, player) {
  const layer = document.createElement("div");
  layer.className = "marker-layer";

  markerDefs(state, player).forEach((item) => {
    const node = document.createElement("div");
    node.className = `marker ${item.className}`;
    node.textContent = item.label;
    node.title = item.title;
    layer.appendChild(node);
  });

  return layer;
}

function createRoleIcon(state, player) {
  const node = document.createElement("div");
  node.className = "token-icon";
  const iconUrl = publicRoleIcon(state, player, state.grimoireView);

  if (iconUrl) {
    node.classList.add("token-icon-claimed");
    node.style.backgroundImage = `url("${iconUrl}"), url("${TOKEN_BASE_ICON}")`;
    node.style.backgroundSize = "63% 63%, cover";
    node.style.backgroundPosition = "center center, center center";
  } else {
    node.classList.add("token-icon-unclaimed");
    node.style.backgroundImage = `url("${UNKNOWN_TOKEN_ICON}")`;
  }
  return node;
}

function reminderRoleIcon(state, player) {
  const note = getGrimoireNote(state, player.id);
  const markedRoleId = `${note?.markedRoleId ?? ""}`.trim();
  if (markedRoleId) {
    return getAllRoles(state.scriptId).find((entry) => entry.id === markedRoleId)?.icon ?? null;
  }
  if (state.grimoireView) {
    return player.roleIcon ?? null;
  }
  if (player.publicClaimRoleId) {
    return getAllRoles(state.scriptId).find((entry) => entry.id === player.publicClaimRoleId)?.icon ?? null;
  }
  return null;
}

function reminderRoleName(state, player) {
  const note = getGrimoireNote(state, player.id);
  const markedRoleId = `${note?.markedRoleId ?? ""}`.trim();
  if (markedRoleId) {
    return getAllRoles(state.scriptId).find((entry) => entry.id === markedRoleId)?.name ?? "";
  }
  if (state.grimoireView) {
    return player.roleName ?? "";
  }
  if (player.publicClaimRoleId) {
    return getAllRoles(state.scriptId).find((entry) => entry.id === player.publicClaimRoleId)?.name ?? "";
  }
  return "";
}

function createReminderOrbit(state, player) {
  const layer = document.createElement("div");
  layer.className = "reminder-orbit";

  const note = getGrimoireNote(state, player.id);
  const reminders = uniqueStrings(note?.reminders ?? []);
  if (reminders.length === 0) {
    return layer;
  }

  const iconUrl = reminderRoleIcon(state, player);
  reminders.forEach((entry, idx) => {
    const badge = document.createElement("div");
    badge.className = "token-reminder-badge";
    const angle = (-125 + idx * 36) * (Math.PI / 180);
    const radiusPercent = 60;
    const x = 50 + radiusPercent * Math.cos(angle);
    const y = 50 + radiusPercent * Math.sin(angle);
    badge.style.left = `${x}%`;
    badge.style.top = `${y}%`;
    badge.title = `提醒：${entry}`;
    badge.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    const disc = document.createElement("div");
    disc.className = "token-reminder-disc";
    disc.style.backgroundImage = `url("${REMINDER_BASE_ICON}")`;

    if (iconUrl) {
      const icon = document.createElement("div");
      icon.className = "token-reminder-icon";
      icon.style.backgroundImage = `url("${iconUrl}")`;
      disc.appendChild(icon);
    }

    const text = document.createElement("div");
    text.className = "token-reminder-text";
    text.textContent = entry;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "token-reminder-remove";
    removeBtn.title = "删除该提醒";
    removeBtn.style.backgroundImage = `url("${REMOVE_ICON}")`;
    removeBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      uiHandlers?.onRemoveReminder?.({
        playerId: player.id,
        reminder: entry,
      });
    });

    badge.appendChild(disc);
    badge.appendChild(text);
    badge.appendChild(removeBtn);
    layer.appendChild(badge);
  });

  return layer;
}

function createAddReminderButton(state, player) {
  const wrapper = document.createElement("div");
  wrapper.className = "token-add-reminder-wrap";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "token-add-reminder";
  btn.title = "添加提醒";
  btn.style.backgroundImage = `url("${PLUS_ICON}")`;

  const menu = document.createElement("div");
  menu.className = "token-add-reminder-menu";
  menu.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  const options = reminderOptionsFor(state.scriptId, reminderRoleName(state, player)).slice(0, 12);
  options.forEach((entry) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "token-add-reminder-item";
    item.textContent = entry;
    item.title = `添加提醒：${entry}`;
    item.addEventListener("click", (event) => {
      event.stopPropagation();
      uiHandlers?.onAddReminder?.({
        playerId: player.id,
        reminder: entry,
      });
      menu.classList.remove("show");
    });
    menu.appendChild(item);
  });

  if (options.length === 0) {
    const empty = document.createElement("div");
    empty.className = "token-add-reminder-empty";
    empty.textContent = "无可用提醒";
    menu.appendChild(empty);
  }

  btn.addEventListener("click", (event) => {
    event.stopPropagation();
    document.querySelectorAll(".token-add-reminder-menu.show").forEach((node) => {
      if (node !== menu) {
        node.classList.remove("show");
      }
    });
    menu.classList.toggle("show");
  });

  wrapper.appendChild(btn);
  wrapper.appendChild(menu);
  return wrapper;
}

function createDeathShroud(player) {
  if (player.alive) {
    return null;
  }
  const node = document.createElement("div");
  node.className = "death-shroud";
  node.style.backgroundImage = `url("${SHROUD_ICON}")`;
  node.title = "该玩家已死亡";
  return node;
}

function makePlayerToken(
  state,
  player,
  averageSuspicion = null,
  size = 112,
  speakingText = "",
  shouldRevealFlip = false,
  highlightMode = ""
) {
  const token = document.createElement("div");
  token.className = "player-token";
  token.style.setProperty("--token-size", `${size}px`);
  token.style.setProperty("--token-label-width", `${Math.max(94, size + 10)}px`);
  token.dataset.playerId = player.id;
  const whisperable = canTokenDirectWhisper(state, player);
  if (whisperable) {
    token.classList.add("token-whisperable");
    token.title = `${seatDisplayName(player, true)} · 左键快速私聊 | 右键魔典标记`;
  } else {
    token.title = `${seatDisplayName(player, true)} · 点击打开魔典标记`;
  }
  token.addEventListener("click", (event) => {
    event.stopPropagation();
    if (event.shiftKey || event.ctrlKey || event.metaKey) {
      openTokenActionModal(player.id);
      return;
    }
    handleTokenPrimaryAction(state, player);
  });
  token.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openTokenActionModal(player.id);
  });

  if (!player.alive) {
    token.classList.add("dead");
  }
  if (player.isHuman) {
    token.classList.add("human");
  }
  if (speakingText) {
    token.classList.add("speaking");
  }
  if (highlightMode === "speaker") {
    token.classList.add("token-spotlight-speaker");
  } else if (highlightMode === "target") {
    token.classList.add("token-spotlight-target");
  }
  if (shouldRevealFlip) {
    token.classList.add("token-flip-reveal");
  }
  if (size < 74) {
    token.classList.add("compact-label");
  }

  const disc = document.createElement("div");
  disc.className = "token-disc";

  const suspicionTag = document.createElement("div");
  suspicionTag.className = "suspicion";
  if (averageSuspicion === null) {
    suspicionTag.classList.add("hidden");
  } else {
    suspicionTag.textContent = `${Math.round(averageSuspicion * 100)}%`;
  }

  if (speakingText) {
    const speechMini = document.createElement("div");
    speechMini.className = "speech-mini";
    speechMini.textContent = compactText(speakingText, 16);
    speechMini.title = speakingText;
    disc.appendChild(speechMini);
  }

  disc.appendChild(createRoleIcon(state, player));
  disc.appendChild(createMarkerLayer(state, player));
  disc.appendChild(suspicionTag);
  const shroud = createDeathShroud(player);
  if (shroud) {
    disc.appendChild(shroud);
  }

  const nameEl = document.createElement("div");
  nameEl.className = "name";
  nameEl.textContent = seatDisplayName(player, true);

  const roleEl = document.createElement("div");
  roleEl.className = "role";
  const publicRole = publicRoleLabel(state, player, state.grimoireView);
  roleEl.textContent = publicRole === "未知" ? "" : publicRole;

  const note = getGrimoireNote(state, player.id);
  const markedRole = note?.markedRoleId ? getAllRoles(state.scriptId).find((entry) => entry.id === note.markedRoleId) : null;

  const markedEl = document.createElement("div");
  markedEl.className = "mark-role";
  markedEl.textContent = markedRole ? `标记：${markedRole.name}` : "";

  const statusEl = document.createElement("div");
  statusEl.className = "status";
  const tags = [];
  if (player.alive) {
    tags.push("存活");
  } else {
    tags.push(player.ghostVoteAvailable ? "死亡(鬼票可用)" : "死亡(鬼票已用)");
  }
  if (state.grimoireView) {
    tags.push(player.team === "evil" ? "邪恶" : "善良");
  }
  statusEl.textContent = tags.join(" | ");

  const meta = document.createElement("div");
  meta.className = "token-meta";
  meta.appendChild(nameEl);
  if (roleEl.textContent) {
    meta.appendChild(roleEl);
  }
  if (markedRole) {
    meta.appendChild(markedEl);
  }
  if (player.isHuman) {
    meta.appendChild(statusEl);
  }

  token.appendChild(disc);
  token.appendChild(createAddReminderButton(state, player));
  token.appendChild(createReminderOrbit(state, player));
  token.appendChild(meta);
  return token;
}

function renderCircle(state, aiInsights) {
  dom.grimoire.innerHTML = "";

  const sorted = [...state.players].sort((a, b) => a.seatIndex - b.seatIndex);
  const suspicionMap = {};
  const activeSpeech = currentSpotlightSpeech(state);
  const speakingPlayerId = activeSpeech?.speakerId ?? null;
  const targetPlayerId = activeSpeech?.targetId ?? null;

  aiInsights.forEach((row) => {
    const target = state.players.find((entry) => entry.name === row.target);
    if (!target) {
      return;
    }
    const value = Number.parseInt(row.score, 10);
    if (!Number.isFinite(value)) {
      return;
    }
    suspicionMap[target.id] = suspicionMap[target.id] ?? [];
    suspicionMap[target.id].push(value / 100);
  });

  fitBoardToSquare();
  const human = sorted.find((entry) => entry.isHuman);
  const gameKey = `${state.seed ?? "seedless"}:${human?.id ?? "human"}`;
  const revealHumanRole = human && !!publicRoleIcon(state, human, false) && revealPlayedForGameKey !== gameKey;
  if (revealHumanRole) {
    revealPlayedForGameKey = gameKey;
  }

  const boardSize = Math.max(320, dom.grimoire.clientWidth || dom.grimoire.offsetWidth || 320);
  const metrics = tokenMetrics(sorted.length, boardSize);
  sorted.forEach((player, idx) => {
    const angle = (Math.PI * 2 * idx) / sorted.length - Math.PI / 2;
    const x = 50 + metrics.radius * Math.cos(angle);
    const y = 50 + metrics.radius * Math.sin(angle);
    const avg = suspicionMap[player.id]
      ? suspicionMap[player.id].reduce((sum, item) => sum + item, 0) / suspicionMap[player.id].length
      : null;

    const speakingText = player.id === speakingPlayerId ? `${activeSpeech?.text ?? ""}` : "";
    const highlightMode = player.id === speakingPlayerId ? "speaker" : player.id === targetPlayerId ? "target" : "";
    const token = makePlayerToken(
      state,
      player,
      avg,
      metrics.size,
      speakingText,
      revealHumanRole && player.isHuman,
      highlightMode
    );
    token.style.left = `${x}%`;
    token.style.top = `${y}%`;
    dom.grimoire.appendChild(token);
  });
}

function currentSpotlightSpeech(state) {
  const dialogue = state?.aiDialogue ?? null;
  if (!dialogue) {
    return null;
  }
  const playbackItem = activePublicPlaybackItem(state);
  if (playbackItem) {
    return playbackItem;
  }
  if (state.phase === "day" && state.dayStage === "public") {
    const publicTimeline = (dialogue.timeline ?? []).filter((entry) => entry.mode === "public" && entry.day === state.day);
    if (publicTimeline.length > 0) {
      return publicTimeline[publicTimeline.length - 1];
    }
  }
  return dialogue.activeSpeech ?? null;
}

function playbackProgressText() {
  if (!Number.isFinite(publicPlayback.maxOrder) || publicPlayback.maxOrder < 0) {
    return "";
  }
  const total = publicPlayback.maxOrder + 1;
  const shown = Math.max(0, Math.min(total, publicPlayback.visibleOrder + 1));
  return `${shown}/${total}`;
}

function ensurePublicPlayback(state, timeline) {
  const latestPublic = [...timeline].reverse().find((entry) => entry.mode === "public");
  if (!latestPublic || state.phase !== "day" || state.dayStage !== "public") {
    stopPublicPlayback();
    publicPlayback.key = "";
    publicPlayback.visibleOrder = Number.POSITIVE_INFINITY;
    publicPlayback.maxOrder = -1;
    return;
  }

  const roundItems = timeline.filter(
    (entry) => entry.mode === "public" && entry.day === latestPublic.day && entry.roundInDay === latestPublic.roundInDay
  );
  const maxOrder = Math.max(0, ...roundItems.map((entry) => entry.orderIndex ?? 0));
  const key = `${latestPublic.day}:${latestPublic.roundInDay}`;
  if (publicPlayback.key === key) {
    return;
  }

  stopPublicPlayback();
  publicPlayback.key = key;
  publicPlayback.day = latestPublic.day;
  publicPlayback.roundInDay = latestPublic.roundInDay;
  publicPlayback.maxOrder = maxOrder;
  publicPlayback.visibleOrder = -1;
  schedulePublicPlayback(true);
}

function shouldQueueDebateItem(item) {
  if (item.mode !== "public" || !Number.isFinite(item.orderIndex)) {
    return false;
  }
  if (publicPlayback.key === "" || publicPlayback.visibleOrder === Number.POSITIVE_INFINITY) {
    return false;
  }
  const sameRound = item.day === publicPlayback.day && item.roundInDay === publicPlayback.roundInDay;
  if (!sameRound) {
    return false;
  }
  return item.orderIndex > publicPlayback.visibleOrder;
}

function isSpeakingDebateItem(item) {
  if (item.mode !== "public" || !Number.isFinite(item.orderIndex)) {
    return false;
  }
  if (publicPlayback.key === "" || publicPlayback.visibleOrder === Number.POSITIVE_INFINITY) {
    return false;
  }
  return (
    item.day === publicPlayback.day &&
    item.roundInDay === publicPlayback.roundInDay &&
    item.orderIndex === publicPlayback.visibleOrder
  );
}

function debateOrderLabel(item) {
  if (item.mode === "public") {
    const round = Number.isFinite(item.roundInDay) ? item.roundInDay : "-";
    const order = Number.isFinite(item.orderIndex) ? item.orderIndex + 1 : "-";
    return `${round}.${order}`;
  }
  return "私聊";
}

function debateModeLabel(item) {
  if (item.mode === "public") {
    return "公聊";
  }
  if (item.mode === "whisper-out") {
    return "你发起私聊";
  }
  return "AI回复";
}

function renderDebateStage(state) {
  if (!dom.debateTimeline || !dom.debateMeta) {
    return;
  }

  dom.debateTimeline.innerHTML = "";
  const timeline = (state.aiDialogue?.timeline ?? []).slice(-12);
  ensurePublicPlayback(state, timeline);
  if (timeline.length === 0) {
    const empty = document.createElement("div");
    empty.className = "debate-empty";
    empty.textContent = "暂无对话，先进行私聊或公聊。";
    dom.debateTimeline.appendChild(empty);
    dom.debateMeta.textContent = "等待玩家行动…";
    updateDebatePlaybackControls();
    return;
  }

  const latest = timeline[timeline.length - 1];
  const spotlightSpeech = currentSpotlightSpeech(state);
  if (state.phase === "day" && state.dayStage === "private") {
    dom.debateMeta.textContent = `第${state.day}天 · 私聊阶段（建议先发起私聊）`;
  } else if (state.phase === "day" && state.dayStage === "public") {
    const rounds = state.dayStageMeta?.publicRounds ?? 0;
    const progress = playbackProgressText();
    if (progress && publicPlayback.roundInDay > 0) {
      dom.debateMeta.textContent = `第${state.day}天 · 公聊第${publicPlayback.roundInDay}轮（${progress}）`;
    } else {
      dom.debateMeta.textContent = `第${state.day}天 · 公聊阶段（已进行 ${rounds} 轮）`;
    }
  } else if (state.phase === "day" && state.dayStage === "nomination") {
    dom.debateMeta.textContent = `第${state.day}天 · 提名阶段`;
  } else {
    dom.debateMeta.textContent = `第${state.day}天 · ${debateModeLabel(latest)}`;
  }

  timeline.forEach((item, idx) => {
    const card = document.createElement("article");
    card.className = "debate-item";
    if (item.mode === "public") {
      card.classList.add("public");
    } else if (item.mode === "whisper-out") {
      card.classList.add("whisper-out");
    } else {
      card.classList.add("whisper-in");
    }
    const isNew = item.id && !seenDebateIds.has(item.id);
    if (isNew) {
      card.classList.add("just-added");
    }
    if (shouldQueueDebateItem(item)) {
      card.classList.add("queued");
      card.setAttribute("aria-hidden", "true");
    }
    if (isSpeakingDebateItem(item)) {
      card.classList.add("speaking-now");
    }
    if (spotlightSpeech && (item.id === spotlightSpeech.id || item.speakerId === spotlightSpeech.speakerId)) {
      card.classList.add("active");
    }
    const stepDelay = item.mode === "public" ? (Number.isFinite(item.orderIndex) ? item.orderIndex : idx) * 140 : idx * 70;
    card.style.animationDelay = `${stepDelay}ms`;

    const head = document.createElement("div");
    head.className = "debate-item-head";

    const order = document.createElement("span");
    order.className = "debate-order";
    order.textContent = debateOrderLabel(item);

    const speaker = document.createElement("span");
    speaker.className = "debate-speaker";
    speaker.textContent = `${playerNameById(state, item.speakerId)}：`;

    const target = document.createElement("span");
    target.className = "debate-target";
    if (item.targetId) {
      target.textContent = `-> ${playerNameById(state, item.targetId)}`;
    } else {
      target.textContent = debateModeLabel(item);
    }

    const text = document.createElement("div");
    text.className = "debate-text";
    text.textContent = `${item.text ?? ""}`;

    head.appendChild(order);
    head.appendChild(speaker);
    head.appendChild(target);
    card.appendChild(head);
    card.appendChild(text);
    dom.debateTimeline.appendChild(card);

    if (item.id) {
      seenDebateIds.add(item.id);
    }
  });
  dom.debateTimeline.scrollLeft = dom.debateTimeline.scrollWidth;

  if (seenDebateIds.size > 600) {
    seenDebateIds.clear();
    timeline.forEach((entry) => {
      if (entry.id) {
        seenDebateIds.add(entry.id);
      }
    });
  }
  updateDebatePlaybackControls();
}

function visibleLogs(state) {
  const human = state.players.find((entry) => entry.isHuman);
  return state.logs.filter((entry) => {
    const isPrivate = !!entry.payload?.private;
    if (!isPrivate || state.grimoireView) {
      if (!state.grimoireView) {
        if (entry.type === "night-effect") {
          return false;
        }
        if (/(中毒|醉酒|poison|drunk)/i.test(`${entry.message ?? ""}`)) {
          return false;
        }
      }
      return true;
    }
    return entry.payload.playerId === human?.id || entry.payload.viewerId === human?.id;
  });
}

function renderLogs(state) {
  dom.logs.innerHTML = "";
  const rows = visibleLogs(state)
    .slice(-220)
    .reverse();
  if (rows.length === 0) {
    const empty = document.createElement("div");
    empty.className = "log log-empty";
    empty.textContent = "暂无事件。";
    dom.logs.appendChild(empty);
  }
  rows.forEach((entry) => {
    const row = document.createElement("div");
    row.className = `log log-${entry.type}`;
    const marker = entry.phase === "night" ? `N${entry.night}` : `D${entry.day}`;
    row.textContent = `[${marker}] ${entry.message}`;
    dom.logs.appendChild(row);
  });
  if (dom.recentEventCapsule) {
    const latest = rows[0];
    dom.recentEventCapsule.textContent = latest
      ? `最近事件：${compactText(latest.message, 30)}`
      : "最近事件：暂无";
    dom.recentEventCapsule.title = latest ? latest.message : "暂无新事件";
  }
}

function renderAIInsights(aiInsights, state) {
  const showInsights = !!state?.gameOver && !sidebarState.rightCollapsed;
  if (dom.aiInsightSection) {
    dom.aiInsightSection.classList.toggle("hidden", !showInsights);
  }
  if (!showInsights) {
    dom.aiInsights.innerHTML = "";
    return;
  }

  dom.aiInsights.innerHTML = "";
  if (aiInsights.length === 0) {
    const empty = document.createElement("div");
    empty.className = "ai-review-empty";
    empty.textContent = "暂无 AI 推理记录。";
    dom.aiInsights.appendChild(empty);
    return;
  }

  if (!selectedReviewAIId || !aiInsights.some((entry) => entry.id === selectedReviewAIId)) {
    selectedReviewAIId = aiInsights[0]?.id ?? "";
  }

  const selectedRow = aiInsights.find((entry) => entry.id === selectedReviewAIId) ?? aiInsights[0];
  const selectedTargetId =
    selectedReviewTargetByAI[selectedRow.id] ??
    selectedRow.targetId ??
    selectedRow.targets?.[0]?.id ??
    "";
  selectedReviewTargetByAI[selectedRow.id] = selectedTargetId;

  const summaryList = document.createElement("div");
  summaryList.className = "ai-review-summary-list";

  aiInsights.forEach((entry) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = `ai-row ai-review-row${entry.id === selectedReviewAIId ? " active" : ""}`;
    row.addEventListener("click", () => {
      selectedReviewAIId = entry.id;
      renderAIInsights(aiInsights, state);
    });

    const head = document.createElement("div");
    head.className = "ai-row-head";
    head.textContent = `${entry.name} -> ${entry.target} (${entry.score})`;

    const body = document.createElement("div");
    body.className = "ai-row-body";
    body.textContent = entry.reason;

    row.appendChild(head);
    row.appendChild(body);
    summaryList.appendChild(row);
  });

  dom.aiInsights.appendChild(summaryList);
  dom.aiInsights.appendChild(renderEvidenceTrailPanel(selectedRow));
}

function formatTrailDelta(value) {
  if (!Number.isFinite(value)) {
    return "--";
  }
  const pct = Math.round(value * 1000) / 10;
  return `${pct > 0 ? "+" : ""}${pct}%`;
}

function formatTrailScore(value) {
  if (!Number.isFinite(value)) {
    return "--";
  }
  return `${Math.round(value * 100)}%`;
}

function trailSourceLabel(entry) {
  const sourceMap = {
    storyteller: "说书人",
    "public-procedure": "公开流程",
    "public-chat": "公聊",
    "private-chat": "私聊",
    public: "公开声明",
  };
  return sourceMap[entry.source] ?? entry.source ?? "未知来源";
}

function renderEvidenceTrailPanel(aiRow) {
  const panel = document.createElement("section");
  panel.className = "ai-trail-panel";

  const head = document.createElement("div");
  head.className = "ai-trail-head";

  const title = document.createElement("div");
  title.className = "ai-trail-title";
  title.textContent = "怀疑变化证据链";

  const targetSelect = document.createElement("select");
  targetSelect.className = "ai-trail-target-select";
  targetSelect.setAttribute("aria-label", "选择复盘目标");

  const targets = aiRow.targets ?? [];
  targets.forEach((target) => {
    const option = document.createElement("option");
    option.value = target.id;
    option.textContent = `${target.name} · ${target.score}`;
    if ((selectedReviewTargetByAI[aiRow.id] ?? aiRow.targetId) === target.id) {
      option.selected = true;
    }
    targetSelect.appendChild(option);
  });
  head.appendChild(title);
  head.appendChild(targetSelect);
  panel.appendChild(head);

  targetSelect.addEventListener("change", () => {
    selectedReviewTargetByAI[aiRow.id] = targetSelect.value;
    // Re-render from the cached game state on next full render; locally update the panel immediately.
    if (lastRenderedState) {
      renderGame(lastRenderedState, lastRenderedAIInsights);
    }
  });

  const selectedTargetId = selectedReviewTargetByAI[aiRow.id] ?? aiRow.targetId ?? targets[0]?.id ?? "";
  const selectedTarget = targets.find((target) => target.id === selectedTargetId) ?? targets[0] ?? null;
  if (!selectedTarget) {
    const empty = document.createElement("div");
    empty.className = "ai-review-empty";
    empty.textContent = "暂无可复盘目标。";
    panel.appendChild(empty);
    return panel;
  }

  const meta = document.createElement("div");
  meta.className = "ai-trail-meta";
  meta.textContent = `${aiRow.name} 对 ${selectedTarget.name} 的当前怀疑：${selectedTarget.score}。${selectedTarget.reason}`;
  panel.appendChild(meta);

  const list = document.createElement("div");
  list.className = "ai-trail-list";
  const trail = selectedTarget.trail ?? [];
  if (trail.length === 0) {
    const empty = document.createElement("div");
    empty.className = "ai-review-empty";
    empty.textContent = "这条怀疑目前没有可追踪的 evidence 变化，可能只来自基础先验或邪恶互认保护。";
    list.appendChild(empty);
  } else {
    trail.slice().reverse().forEach((entry) => {
      const item = document.createElement("article");
      const directionClass = (entry.appliedDelta ?? 0) >= 0 ? "up" : "down";
      item.className = `ai-trail-item ${directionClass}`;

      const delta = document.createElement("div");
      delta.className = "ai-trail-delta";
      delta.textContent = formatTrailDelta(entry.appliedDelta);

      const body = document.createElement("div");
      body.className = "ai-trail-item-body";

      const line = document.createElement("div");
      line.className = "ai-trail-line";
      line.textContent = `${formatTrailScore(entry.before)} → ${formatTrailScore(entry.after)} · ${entry.reasonKey || "未知原因"}`;

      const source = document.createElement("div");
      source.className = "ai-trail-source";
      const reliability = Number.isFinite(entry.reliabilityScore) ? `${Math.round(entry.reliabilityScore * 100)}%` : "--";
      const risk = Number.isFinite(entry.contaminationRisk) ? `${Math.round(entry.contaminationRisk * 100)}%` : "--";
      source.textContent = `${trailSourceLabel(entry)} / ${entry.evidenceKind || "evidence"} · 可信 ${reliability} · 污染风险 ${risk}`;

      const text = document.createElement("div");
      text.className = "ai-trail-text";
      text.textContent = entry.text ? compactText(entry.text, 64) : "无原文。";

      body.appendChild(line);
      body.appendChild(source);
      body.appendChild(text);
      item.appendChild(delta);
      item.appendChild(body);
      list.appendChild(item);
    });
  }
  panel.appendChild(list);
  return panel;
}

function fillSelect(selectEl, options, selectedId = null, emptyLabel = "--") {
  selectEl.innerHTML = "";
  if (!options || options.length === 0) {
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = emptyLabel;
    empty.selected = true;
    empty.disabled = true;
    selectEl.appendChild(empty);
    return;
  }

  options.forEach((entry) => {
    const option = document.createElement("option");
    option.value = entry.id;
    option.textContent = entry.label;
    if (selectedId !== null && selectedId === entry.id) {
      option.selected = true;
    }
    selectEl.appendChild(option);
  });
}

function selectedPlanValue(action, key, fallback = "") {
  const plan = action.selectedPlan ?? {};
  if (key === "roleId") {
    return plan.selectedRoleId ?? plan.roleId ?? fallback;
  }
  return plan[key] ?? fallback;
}

function hideModalPlayerTargets() {
  dom.nightModalTargetRowB.classList.add("hidden");
  dom.nightModalTargetA.closest("label")?.classList.add("hidden");
  fillSelect(dom.nightModalTargetA, [], "", "无目标");
  fillSelect(dom.nightModalTargetB, [], "", "无目标");
}

function showModalPlayerTargets(action) {
  const targetLabels = action.interaction?.targetLabels ?? [];
  dom.nightModalTargetA.closest("label")?.classList.remove("hidden");
  const selectedA = action.selectedTargetIds?.[0] || action.options?.[0]?.id || "";
  dom.nightModalTargetALabel.textContent = targetLabels[0] || "目标一";
  fillSelect(dom.nightModalTargetA, action.options ?? [], selectedA, "无目标");

  if (action.targetCount > 1) {
    dom.nightModalTargetRowB.classList.remove("hidden");
    const fallbackB = action.options?.find((entry) => entry.id !== selectedA)?.id || action.options?.[0]?.id || "";
    const selectedB = action.selectedTargetIds?.[1] || fallbackB;
    dom.nightModalTargetBLabel.textContent = targetLabels[1] || "目标二";
    fillSelect(dom.nightModalTargetB, action.options ?? [], selectedB, "无目标");
  } else {
    dom.nightModalTargetRowB.classList.add("hidden");
    fillSelect(dom.nightModalTargetB, [], "", "无目标");
  }
}

function appendSelectField(container, { label, className, datasetKey, options, selected, emptyLabel = "--" }) {
  const wrapper = document.createElement("label");
  wrapper.className = className ?? "";
  const span = document.createElement("span");
  span.textContent = label;
  const select = document.createElement("select");
  select.dataset.nightField = datasetKey;
  fillSelect(select, options ?? [], selected, emptyLabel);
  wrapper.append(span, select);
  container.appendChild(wrapper);
  return select;
}

function renderNightActionDynamicFields(action) {
  const container = dom.nightActionDynamicFields;
  if (!container) {
    return;
  }
  container.innerHTML = "";
  const inputType = action.inputType ?? "player-target";

  if (inputType === "info") {
    hideModalPlayerTargets();
    if (action.informationText) {
      const info = document.createElement("div");
      info.className = "storyteller-info-card";
      info.textContent = action.informationText;
      container.appendChild(info);
    }
    return;
  }

  if (inputType === "player-target") {
    showModalPlayerTargets(action);
    return;
  }

  hideModalPlayerTargets();

  if (inputType === "role") {
    appendSelectField(container, {
      label: "选择角色",
      datasetKey: "roleId",
      options: action.roleOptions ?? [],
      selected: selectedPlanValue(action, "roleId", action.roleOptions?.[0]?.id ?? ""),
      emptyLabel: "无可选角色",
    });
    return;
  }

  if (inputType === "player-role") {
    appendSelectField(container, {
      label: action.interaction?.targetLabels?.[0] || "选择玩家",
      datasetKey: "targetId",
      options: action.options ?? [],
      selected: action.selectedTargetIds?.[0] || action.options?.[0]?.id || "",
      emptyLabel: "无可选玩家",
    });
    appendSelectField(container, {
      label: "声明/指定角色",
      datasetKey: "roleId",
      options: action.roleOptions ?? [],
      selected: selectedPlanValue(action, "roleId", action.roleOptions?.[0]?.id ?? ""),
      emptyLabel: "无可选角色",
    });
    return;
  }

  if (inputType === "question") {
    const label = document.createElement("label");
    label.className = "night-question-field";
    const span = document.createElement("span");
    span.textContent = "你的问题";
    const textarea = document.createElement("textarea");
    textarea.dataset.nightField = "question";
    textarea.rows = 4;
    textarea.maxLength = 220;
    textarea.placeholder = "例如：场上是否还有两个以上邪恶玩家？";
    textarea.value = selectedPlanValue(action, "question", "");
    label.append(span, textarea);
    container.appendChild(label);
    return;
  }

  if (inputType === "guesses") {
    const max = Number.isFinite(action.maxGuessCount) ? action.maxGuessCount : 5;
    const selectedGuesses = Array.isArray(action.selectedPlan?.guesses) ? action.selectedPlan.guesses : [];
    for (let index = 0; index < max; index += 1) {
      const row = document.createElement("div");
      row.className = "night-guess-row";
      row.dataset.guessRow = `${index}`;
      appendSelectField(row, {
        label: `猜测 ${index + 1}：玩家`,
        datasetKey: "guessPlayer",
        options: [{ id: "", label: "不填写" }, ...(action.options ?? [])],
        selected: selectedGuesses[index]?.playerId ?? (index === 0 ? action.options?.[0]?.id ?? "" : ""),
      });
      appendSelectField(row, {
        label: "角色",
        datasetKey: "guessRole",
        options: [{ id: "", label: "不填写" }, ...(action.roleOptions ?? [])],
        selected: selectedGuesses[index]?.roleId ?? (index === 0 ? action.roleOptions?.[0]?.id ?? "" : ""),
      });
      container.appendChild(row);
    }
    return;
  }

  if (inputType === "charge-or-targets") {
    const modeSelect = appendSelectField(container, {
      label: "行动方式",
      datasetKey: "mode",
      options: action.modes ?? [],
      selected: selectedPlanValue(action, "mode", action.modes?.[0]?.id ?? "kill"),
      emptyLabel: "选择行动方式",
    });
    const targetBox = document.createElement("div");
    targetBox.className = "night-dynamic-targets";
    const maxTargets = Math.max(1, Number.isFinite(action.maxTargetCount) ? action.maxTargetCount : action.targetCount ?? 1);
    for (let index = 0; index < maxTargets; index += 1) {
      appendSelectField(targetBox, {
        label: maxTargets > 1 ? `击杀目标 ${index + 1}` : "击杀目标",
        datasetKey: "targetId",
        options: [{ id: "", label: index === 0 ? "不选择" : "空位" }, ...(action.options ?? [])],
        selected: action.selectedTargetIds?.[index] ?? (index === 0 ? action.options?.[0]?.id ?? "" : ""),
      });
    }
    const syncTargetVisibility = () => {
      targetBox.classList.toggle("hidden", modeSelect.value === "charge" || modeSelect.value === "none");
    };
    modeSelect.addEventListener("change", syncTargetVisibility);
    syncTargetVisibility();
    container.appendChild(targetBox);
  }
}

function collectNightActionPlan(action) {
  const inputType = action.inputType ?? "player-target";
  if (inputType === "info") {
    return {};
  }
  if (inputType === "player-target") {
    const targetIds = [dom.nightModalTargetA.value];
    if (!dom.nightModalTargetRowB.classList.contains("hidden")) {
      targetIds.push(dom.nightModalTargetB.value);
    }
    return { targetIds };
  }

  const fields = dom.nightActionDynamicFields ?? document.createElement("div");
  if (inputType === "role") {
    return { roleId: fields.querySelector('[data-night-field="roleId"]')?.value ?? "" };
  }
  if (inputType === "player-role") {
    return {
      targetIds: [fields.querySelector('[data-night-field="targetId"]')?.value ?? ""],
      roleId: fields.querySelector('[data-night-field="roleId"]')?.value ?? "",
    };
  }
  if (inputType === "question") {
    return { question: fields.querySelector('[data-night-field="question"]')?.value ?? "" };
  }
  if (inputType === "guesses") {
    const guesses = [...fields.querySelectorAll(".night-guess-row")].map((row) => ({
      playerId: row.querySelector('[data-night-field="guessPlayer"]')?.value ?? "",
      roleId: row.querySelector('[data-night-field="guessRole"]')?.value ?? "",
    }));
    return { guesses };
  }
  if (inputType === "charge-or-targets") {
    return {
      mode: fields.querySelector('[data-night-field="mode"]')?.value ?? "",
      targetIds: [...fields.querySelectorAll('[data-night-field="targetId"]')]
        .map((select) => select.value)
        .filter(Boolean),
    };
  }
  return {};
}

function renderNominationOptions(state) {
  const alive = state.players.filter((entry) => entry.alive);
  const nominators = alive
    .filter((entry) => !entry.nominatedToday)
    .map((entry) => ({ id: entry.id, label: seatDisplayName(entry, true) }));
  const nominees = state.players
    .filter((entry) => entry.alive && !entry.beenNominatedToday)
    .map((entry) => ({ id: entry.id, label: seatDisplayName(entry, true) }));

  const currentNominator = dom.nominator.value || alive.find((entry) => entry.isHuman)?.id || nominators[0]?.id;
  const currentNominee = dom.nominee.value || nominees[0]?.id;

  fillSelect(dom.nominator, nominators, currentNominator);
  fillSelect(dom.nominee, nominees, currentNominee);
}

function renderWhisperTargets(state) {
  const candidates = state.players
    .filter((entry) => !entry.isHuman)
    .map((entry) => ({
      id: entry.id,
      label: `${seatDisplayName(entry, false)}${entry.alive ? "" : "（死亡）"}`,
    }));

  fillSelect(dom.whisperTarget, candidates, dom.whisperTarget.value || candidates[0]?.id);
}

function renderWhisperQuickButtons() {
  if (!dom.whisperQuickGrid) {
    return;
  }
  dom.whisperQuickGrid.innerHTML = "";

  QUICK_WHISPER_PROMPTS.forEach((prompt) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "quick-ask-btn";
    if (prompt === selectedQuickWhisperPrompt) {
      btn.classList.add("active");
    }
    btn.textContent = prompt;
    btn.addEventListener("click", () => {
      selectedQuickWhisperPrompt = prompt;
      renderWhisperQuickButtons();
      updateWhisperIntentPreview();
      if (dom.whisperInput) {
        dom.whisperInput.focus();
      }
    });
    dom.whisperQuickGrid.appendChild(btn);
  });
}

function renderChatDramaQuickButtons() {
  if (!dom.chatDramaQuickGrid) {
    return;
  }
  dom.chatDramaQuickGrid.innerHTML = "";

  const primaryPrompts = QUICK_WHISPER_PROMPTS.slice(0, CHAT_DRAMA_PRIMARY_PROMPT_COUNT);
  const prompts = primaryPrompts.includes(selectedChatDramaPrompt)
    ? primaryPrompts
    : [...primaryPrompts, selectedChatDramaPrompt].filter(Boolean);

  prompts.forEach((prompt) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "quick-ask-btn chat-drama-quick-btn";
    if (prompt === selectedChatDramaPrompt) {
      btn.classList.add("active");
    }
    btn.textContent = prompt;
    btn.addEventListener("click", () => {
      selectedChatDramaPrompt = prompt;
      renderChatDramaQuickButtons();
      updateChatDramaIntentPreview();
      dom.chatDramaInput?.focus();
    });
    dom.chatDramaQuickGrid.appendChild(btn);
  });
}

function composeWhisperMessage(selectedPrompt, extraInput) {
  const selected = `${selectedPrompt ?? ""}`.trim();
  const extra = `${extraInput ?? ""}`.trim();
  if (selected && extra) {
    return `${selected} 补充：${extra}`;
  }
  if (selected) {
    return selected;
  }
  return extra;
}

function whisperComposerPayloadFromTarget(state, target, prefillExtra = "") {
  const questionPreview = composeWhisperMessage(selectedChatDramaPrompt, prefillExtra);
  return {
    targetId: target.id,
    targetSeat: target.seatIndex + 1,
    targetName: target.name,
    personaLabel: "",
    question: questionPreview || selectedChatDramaPrompt,
    response: "点击“继续私聊”后，对方会给出正式回复。",
    prefillExtra,
    keepPrompt: true,
  };
}

function openWhisperComposer(state, targetId, options = {}) {
  if (!state) {
    showToast("当前还没有对局。");
    return false;
  }
  if (state.phase !== "day" || state.dayStage !== "private" || state.gameOver) {
    showToast("当前不在私聊阶段。");
    return false;
  }

  const preferredTargetId = `${targetId ?? ""}`.trim();
  const fallbackTargetId = `${dom.whisperTarget?.value ?? ""}`.trim();
  const resolvedTargetId = preferredTargetId || fallbackTargetId;
  const target = state.players.find((entry) => entry.id === resolvedTargetId);
  if (!target || target.isHuman) {
    showToast("私聊目标无效。");
    return false;
  }

  syncWhisperTargetSelection(target.id);
  selectedChatDramaPrompt = options.selectedPrompt ?? selectedQuickWhisperPrompt;
  const prefillExtra = `${options.prefillExtra ?? ""}`.trim();
  openChatDramaModal(whisperComposerPayloadFromTarget(state, target, prefillExtra));
  return true;
}

function quickPromptIntentHint(promptText) {
  const matched = QUICK_WHISPER_PROMPT_META.find((entry) => entry.text === `${promptText ?? ""}`.trim());
  return matched?.intentHint ?? "generic";
}

function inferHintFromExtraInput(extraInput) {
  const text = `${extraInput ?? ""}`.trim();
  if (!text) {
    return "generic";
  }
  if (/(身份|角色|报身份|你是啥|你什么角色)/.test(text)) {
    return "claim";
  }
  if (/(提名|投票|票型|赞成|反对|会投)/.test(text)) {
    return "vote";
  }
  if (/(昨晚|昨夜|夜里|夜间|夜晚)/.test(text)) {
    return "night";
  }
  if (/(比较|对比|谁更|哪个更|相比)/.test(text)) {
    return "compare";
  }
  if (/(理由|依据|为什么|证据)/.test(text)) {
    return "reason";
  }
  if (/(建议|下一步|怎么做|策略|计划|节奏)/.test(text)) {
    return "plan";
  }
  if (/(信任|相信|可信吗|站边)/.test(text)) {
    return "trust";
  }
  if (/(怀疑|可疑|恶魔|爪牙|嫌疑|刀口|坏)/.test(text)) {
    return "suspect";
  }
  return "generic";
}

function resolveIntentHint(selectedPrompt, extraInput) {
  const byPrompt = quickPromptIntentHint(selectedPrompt);
  const byExtra = inferHintFromExtraInput(extraInput);
  return byExtra === "generic" ? byPrompt : byExtra;
}

function intentHintLabel(intentHint) {
  return WHISPER_INTENT_LABELS[intentHint] ?? WHISPER_INTENT_LABELS.generic;
}

function updateWhisperIntentPreview() {
  if (!dom.whisperIntentPreview) {
    return;
  }
  const hint = resolveIntentHint(selectedQuickWhisperPrompt, dom.whisperInput?.value ?? "");
  const extra = `${dom.whisperInput?.value ?? ""}`.trim();
  const suffix = extra ? " + 补充问法" : "（主路径）";
  dom.whisperIntentPreview.textContent = `解析：${intentHintLabel(hint)}${suffix}`;
}

function updateChatDramaIntentPreview() {
  if (!dom.chatDramaIntentPreview) {
    return;
  }
  const hint = resolveIntentHint(selectedChatDramaPrompt, dom.chatDramaInput?.value ?? "");
  const extra = `${dom.chatDramaInput?.value ?? ""}`.trim();
  const suffix = extra ? " + 补充问法" : "（主路径）";
  dom.chatDramaIntentPreview.textContent = `解析：${intentHintLabel(hint)}${suffix}`;
}

function triggerWhisper(handlers, options = {}) {
  const targetId = `${options.targetId ?? dom.whisperTarget.value ?? ""}`.trim();
  const selectedPrompt = options.selectedPrompt ?? selectedQuickWhisperPrompt;
  const extraInput = options.extraInput ?? `${dom.whisperInput?.value ?? ""}`;
  const intentHint = `${options.intentHint ?? resolveIntentHint(selectedPrompt, extraInput)}`.trim();
  handlers.onWhisper({
    targetId,
    message: composeWhisperMessage(selectedPrompt, extraInput),
    intentHint,
  });
}

function syncWhisperTargetSelection(targetId) {
  const safeTargetId = `${targetId ?? ""}`.trim();
  if (!safeTargetId) {
    return;
  }
  if (dom.whisperTarget) {
    dom.whisperTarget.value = safeTargetId;
  }
}

function canTokenDirectWhisper(state, player) {
  return !!state && state.phase === "day" && state.dayStage === "private" && !state.gameOver && !player.isHuman;
}

function handleTokenPrimaryAction(state, player) {
  if (canTokenDirectWhisper(state, player) && uiHandlers?.onWhisper) {
    openWhisperComposer(state, player.id, {
      selectedPrompt: selectedQuickWhisperPrompt,
      prefillExtra: "",
    });
    return;
  }
  openTokenActionModal(player.id);
}

function triggerChatDramaWhisper(handlers) {
  const targetId = `${chatDramaTargetId ?? ""}`.trim();
  if (!targetId) {
    showToast("当前没有可私聊目标。");
    return;
  }
  triggerWhisper(handlers, {
    targetId,
    selectedPrompt: selectedChatDramaPrompt,
    extraInput: `${dom.chatDramaInput?.value ?? ""}`,
    intentHint: resolveIntentHint(selectedChatDramaPrompt, `${dom.chatDramaInput?.value ?? ""}`),
  });
}

function renderSlayerTargets(state) {
  const action = getHumanDayActionState(state);
  const aliveTargets = action.available
    ? action.options
    : state.players
        .filter((entry) => entry.alive && !entry.isHuman)
        .map((entry) => ({ id: entry.id, label: seatDisplayName(entry, false) }));

  fillSelect(dom.slayerTarget, aliveTargets, dom.slayerTarget.value || aliveTargets[0]?.id);
}

function renderNightAction(state) {
  const action = getHumanNightActionState(state);
  const usageHint =
    action.available && Number.isFinite(action.maxUses) ? `（已用${action.usedCount}/${action.maxUses}）` : "";

  dom.nightActionSummary.textContent = action.available
    ? `第${action.nightNumber}夜 · ${action.roleName}${usageHint}：${action.prompt}`
    : action.reason;

  if (!action.available) {
    fillSelect(dom.nightTargetA, []);
    fillSelect(dom.nightTargetB, []);
    dom.nightTargetRowB.classList.add("hidden");
    dom.btnSaveNightAction.disabled = true;
    dom.nightTargetA.disabled = true;
    dom.nightTargetB.disabled = true;
    return;
  }

  const selectedA = action.selectedTargetIds[0] || dom.nightTargetA.value || action.options[0]?.id;
  fillSelect(dom.nightTargetA, action.options, selectedA);

  if (action.targetCount > 1) {
    dom.nightTargetRowB.classList.remove("hidden");
    const selectedB =
      action.selectedTargetIds[1] ||
      dom.nightTargetB.value ||
      action.options.find((entry) => entry.id !== selectedA)?.id ||
      action.options[0]?.id;
    fillSelect(dom.nightTargetB, action.options, selectedB);
    dom.nightTargetB.disabled = false;
  } else {
    dom.nightTargetRowB.classList.add("hidden");
    fillSelect(dom.nightTargetB, []);
    dom.nightTargetB.disabled = true;
  }

  dom.nightTargetA.disabled = false;
  dom.btnSaveNightAction.disabled = false;
}

function renderPrivateInfo(state) {
  const pending = state.pendingHumanInfo ?? [];
  if (pending.length === 0) {
    dom.privateInfo.textContent = "昨夜没有新的私有信息。";
    return;
  }
  dom.privateInfo.innerHTML = pending.map((item) => `<div>• ${item}</div>`).join("");
}

function stageLabel(state) {
  if (state.phase === "night") {
    return "夜晚结算中";
  }
  if (state.phase === "ended") {
    return "对局已结束";
  }
  const map = {
    private: "白天私聊阶段",
    public: "白天公聊阶段",
    nomination: "白天提名阶段",
  };
  return map[state.dayStage] ?? "白天流程";
}

function applySceneTheme(state) {
  const isNight = state.phase === "night";
  document.body.classList.toggle("theme-night", isNight);
  document.body.classList.toggle("theme-day", !isNight);
}

function renderHud(state) {
  currentScriptId = state.scriptId;

  const counts = state.setupCounts;
  dom.setupLine.innerHTML =
    `<span class="town"><em>民</em>${counts.townsfolk}</span>` +
    `<span class="outsider"><em>外</em>${counts.outsider}</span>` +
    `<span class="minion"><em>爪</em>${counts.minion}</span>` +
    `<span class="demon"><em>恶</em>${counts.demon}</span>`;

  const alive = state.players.filter((entry) => entry.alive).length;
  const dead = state.players.length - alive;
  dom.aliveLine.textContent = `存活 ${alive} ｜ 死亡 ${dead}`;

  const compactPhase =
    state.phase === "night"
      ? "夜晚"
      : state.phase === "ended"
        ? "结算"
        : state.dayStage === "private"
          ? "私聊"
          : state.dayStage === "public"
            ? "公聊"
            : "提名";
  const winnerLabel = state.winner === "good" ? "好人胜" : state.winner === "evil" ? "邪恶胜" : "进行中";
  dom.status.textContent = `${state.scriptName.replace(/\(.+\)/, "").trim()} · D${state.day}/N${state.night} · ${compactPhase} · ${winnerLabel}`;
  dom.scriptBadge.textContent = state.scriptName.replace(/\(.+\)/, "").trim();

  const used = state.dayStageMeta?.privateUsed ?? 0;
  const limit = state.dayStageMeta?.privateLimit ?? 0;
  const followUsed = state.dayStageMeta?.privateFollowUpUsed ?? 0;
  const followLimit = state.dayStageMeta?.privateFollowUpLimit ?? 2;
  const followText = state.dayStageMeta?.activePrivateTargetId ? ` · 追问 ${followUsed}/${followLimit}` : "";
  dom.stageChip.textContent =
    state.phase === "day" && state.dayStage === "private" ? `私聊 ${used}/${limit}${followText}` : stageLabel(state);

  if (dom.officialScriptLine && dom.officialSetupLine && dom.officialStateLine) {
    const scriptCoreName = state.scriptName.replace(/\(.+\)/, "").trim();
    const ghostVoteAvailable = state.players.filter((entry) => !entry.alive && entry.ghostVoteAvailable).length;
    const stageText = state.phase === "day" && state.dayStage === "private" ? `私聊 ${used}/${limit}${followText}` : compactPhase;

    dom.officialScriptLine.textContent = `${scriptCoreName} by The Pandemonium Institute`;
    dom.officialSetupLine.innerHTML =
      `<span class="town">${counts.townsfolk}民</span> ` +
      `<span class="outsider">${counts.outsider}外</span> ` +
      `<span class="minion">${counts.minion}爪</span> ` +
      `<span class="demon">${counts.demon}恶</span>`;
    dom.officialStateLine.innerHTML =
      `<span class="state-chip"><i class="state-icon players"></i>${state.players.length}</span>` +
      `<span class="state-chip"><i class="state-icon alive"></i>${alive}</span>` +
      `<span class="state-chip"><i class="state-icon ghost"></i>${ghostVoteAvailable}</span>` +
      `<span class="state-chip"><i class="state-icon stage"></i>${stageText}</span>`;
  }
}

function renderBluffs(state) {
  const human = state.players.find((entry) => entry.isHuman);
  const canReveal = state.grimoireView || human?.category === "demon";
  dom.bluffList.innerHTML = "";

  const bluffs = canReveal
    ? state.demonBluffs
    : [
        { name: "未知", icon: null },
        { name: "未知", icon: null },
        { name: "未知", icon: null },
      ];

  bluffs.forEach((entry) => {
    const node = document.createElement("div");
    node.className = "bluff-token";

    const icon = document.createElement("div");
    icon.className = "bluff-icon";
    if (entry.icon) {
      icon.style.backgroundImage = `url("${entry.icon}")`;
    } else {
      icon.classList.add("bluff-icon-hidden");
    }

    const text = document.createElement("div");
    text.className = "bluff-name";
    text.textContent = entry.name;

    node.appendChild(icon);
    node.appendChild(text);
    dom.bluffList.appendChild(node);
  });
}

function renderGuide(state) {
  const steps = [];
  let title = "回合引导";
  let hint = "";

  if (state.gameOver) {
    title = "对局结束";
    hint = state.winnerReason || "本局已结束，可以点击“新开一局”重新开始。";
    steps.push({ label: "查看事件日志复盘信息", status: "current" });
    steps.push({ label: "点击“新开一局”开始下一局", status: "todo" });
  } else if (state.phase === "night") {
    title = `第${state.night}夜`;
    hint = "夜晚由系统自动结算，你将直接进入下一天。";
    steps.push({ label: "系统处理夜间角色技能", status: "current" });
    steps.push({ label: "等待天亮读取公开与私有信息", status: "todo" });
  } else {
    title = `第${state.day}天`;
    if (state.dayStage === "private") {
      hint = "先完成有限次私聊，再进入公聊。";
      steps.push({ label: "和其他玩家私聊收集线索", status: "current" });
      steps.push({ label: "点击“进入公聊阶段”", status: "todo" });
      steps.push({ label: "公聊后进入提名并投票", status: "todo" });
    } else if (state.dayStage === "public") {
      hint = "建议至少进行一轮公聊，形成公开信息后再提名。";
      steps.push({ label: "私聊阶段", status: "done" });
      steps.push({ label: "进行公聊（可多轮）", status: "current" });
      steps.push({ label: "进入提名阶段", status: "todo" });
    } else {
      hint = "现在可以提名并投票，或选择今日无人处决。";
      steps.push({ label: "私聊阶段", status: "done" });
      steps.push({ label: "公聊阶段", status: "done" });
      steps.push({ label: "提名与投票", status: "current" });
    }
  }

  dom.guideTitle.textContent = title;
  dom.guideHint.textContent = hint;
  dom.guideList.innerHTML = "";
  steps.forEach((step) => {
    const item = document.createElement("li");
    item.className = `guide-item guide-${step.status}`;
    item.textContent = step.label;
    dom.guideList.appendChild(item);
  });
}

function fillOrderList(listEl, rows) {
  listEl.innerHTML = "";
  rows.forEach((text) => {
    const item = document.createElement("li");
    item.textContent = text;
    listEl.appendChild(item);
  });
}

function renderScriptSheet(scriptId) {
  const config = SCRIPT_SHEET_ASSETS[scriptId] ?? SCRIPT_SHEET_ASSETS.tb;
  sheetScriptId = scriptId in SCRIPT_SHEET_ASSETS ? scriptId : "tb";

  dom.sheetModalTitle.textContent = `${config.title} · 剧本与夜间顺序`;
  dom.sheetImage.src = config.image;
  dom.sheetImage.alt = `${config.title} 官方剧本总览`;

  const reference = getNightOrderReference(sheetScriptId);
  fillOrderList(dom.sheetFirstNightList, reference.firstNight);
  fillOrderList(dom.sheetOtherNightList, reference.otherNight);

  dom.sheetTabTB.classList.toggle("active", sheetScriptId === "tb");
  dom.sheetTabBMR.classList.toggle("active", sheetScriptId === "bmr");
  dom.sheetTabSNV.classList.toggle("active", sheetScriptId === "snv");
}

function openScriptSheet(scriptId = currentScriptId) {
  renderScriptSheet(scriptId);
  dom.scriptSheetModal.classList.add("show");
}

function closeScriptSheet() {
  dom.scriptSheetModal.classList.remove("show");
}

function openTokenActionModal(playerId = "") {
  if (!dom.tokenActionModal || !lastRenderedState) {
    return;
  }
  if (playerId) {
    activeMarkPlayerId = playerId;
  }
  renderMarkPanel(lastRenderedState);
  dom.tokenActionModal.classList.add("show");
}

function closeTokenActionModal() {
  if (!dom.tokenActionModal) {
    return;
  }
  dom.tokenActionModal.classList.remove("show");
}

function openNightActionModal(action, request = {}) {
  if (!dom.nightActionModal) {
    return;
  }

  nightModalRequest = {
    action,
    onConfirm: request.onConfirm ?? null,
    onSkip: request.onSkip ?? null,
    mandatory: !!request.mandatory,
    preventDismiss: request.preventDismiss ?? request.variant === "storyteller",
  };

  const interaction = action.interaction ?? {};
  const styleName = interaction.style ? `${interaction.style}`.replace(/[^a-z0-9_-]/gi, "") : "default";
  const modalCard = dom.nightActionModal.querySelector(".sheet-modal-card");
  const modalVariant = request.variant === "storyteller" ? "storyteller" : "standard";

  modalCard?.classList.forEach((className) => {
    if (className.startsWith("night-style-")) {
      modalCard.classList.remove(className);
    }
  });
  modalCard?.classList.remove("storyteller-action-card", "standard-action-card");
  dom.nightActionModal.classList.remove("storyteller-modal", "standard-action-modal");
  modalCard?.classList.add("night-action-card", `night-style-${styleName}`, `${modalVariant}-action-card`);
  dom.nightActionModal.classList.add(`${modalVariant}-action-modal`);

  if (dom.nightActionModalKicker) {
    dom.nightActionModalKicker.textContent = modalVariant === "storyteller" ? "Storyteller Action" : "Role Action";
  }
  if (dom.nightActionWakeLine) {
    dom.nightActionWakeLine.classList.toggle("hidden", modalVariant !== "storyteller");
  }
  dom.btnCloseNightActionModal?.classList.toggle("hidden", modalVariant === "storyteller");
  dom.nightActionModalTitle.textContent =
    interaction.title || (modalVariant === "storyteller" ? `Storyteller：${action.roleName}` : `夜间行动：${action.roleName}`);
  dom.nightActionRoleBadge.textContent = interaction.badge || "Storyteller";
  dom.nightActionRoleSubtitle.textContent =
    interaction.subtitle ||
    (modalVariant === "storyteller" ? "Storyteller 叫醒你处理一个即时触发。" : "夜幕落下，Storyteller 等待你的选择。");
  const phaseLabel = action.phaseLabel || (action.nightNumber ? `第${action.nightNumber}夜` : "当前阶段");
  dom.nightActionModalPrompt.textContent = `${phaseLabel} · ${action.prompt}`;
  dom.nightActionModalHelper.textContent = interaction.helper || "";
  dom.nightActionModalHelper.classList.toggle("hidden", !interaction.helper);

  if (dom.nightActionRoleIcon) {
    dom.nightActionRoleIcon.style.backgroundImage = action.roleIcon ? `url("${action.roleIcon}")` : "";
    dom.nightActionRoleIcon.classList.toggle("no-icon", !action.roleIcon);
    dom.nightActionRoleIcon.textContent = action.roleIcon ? "" : action.roleName?.slice(0, 1) || "夜";
  }

  renderNightActionDynamicFields(action);

  dom.btnConfirmNightActionModal.textContent = interaction.confirmText || "确认并进入夜晚";
  dom.btnSkipNightActionModal.textContent = interaction.skipText || "今晚跳过选择（系统自动）";
  dom.nightActionModal.classList.add("show");
}

function closeNightActionModal() {
  if (!dom.nightActionModal) {
    return;
  }
  dom.nightActionModal.classList.remove("show");
  dom.nightActionModal.classList.remove("storyteller-modal", "standard-action-modal");
  nightModalRequest = null;
}

function closeChatDramaModal() {
  if (!dom.chatDramaModal) {
    return;
  }
  chatDramaTargetId = "";
  if (chatDramaTypingTimer) {
    clearInterval(chatDramaTypingTimer);
    chatDramaTypingTimer = null;
  }
  dom.chatDramaModal.classList.remove("typing");
  dom.chatDramaModal.classList.remove("show");
}

function updateChatDramaComposerState(canWhisper = false) {
  const hasTarget = !!chatDramaTargetId;
  const isActiveThread = lastRenderedState?.dayStageMeta?.activePrivateTargetId === chatDramaTargetId;
  const followUsed = lastRenderedState?.dayStageMeta?.privateFollowUpUsed ?? 0;
  const followLimit = lastRenderedState?.dayStageMeta?.privateFollowUpLimit ?? 2;
  const followUpsExhausted = isActiveThread && followUsed >= followLimit;
  const enabled = canWhisper && hasTarget && !followUpsExhausted;
  if (dom.btnChatDramaSend) {
    dom.btnChatDramaSend.disabled = !enabled;
  }
  if (dom.chatDramaInput) {
    dom.chatDramaInput.disabled = !enabled;
  }
  if (dom.chatDramaQuickGrid) {
    dom.chatDramaQuickGrid.querySelectorAll("button").forEach((btn) => {
      btn.disabled = !enabled;
    });
  }

  if (dom.chatDramaHint) {
    if (!hasTarget) {
      dom.chatDramaHint.textContent = "当前没有可继续追问的私聊对象。";
    } else if (dom.chatDramaModal?.classList.contains("typing")) {
      dom.chatDramaHint.textContent = "对方正在组织语言，等他说完再继续追问。";
    } else if (followUpsExhausted) {
      dom.chatDramaHint.textContent = "本轮私聊追问次数已用完，可换人或进入公聊。";
    } else if (!canWhisper) {
      dom.chatDramaHint.textContent = "当前不在私聊阶段，无法继续追问。";
    } else {
      const suffix = `可继续追问（${followUsed}/${followLimit}）。`;
      dom.chatDramaHint.textContent = `你正在和 ${dom.chatDramaSpeaker?.textContent ?? "--"} 私聊，${suffix}`;
    }
  }
  if (dom.chatDramaContext && lastRenderedState) {
    const used = lastRenderedState.dayStageMeta?.privateUsed ?? 0;
    const limit = lastRenderedState.dayStageMeta?.privateLimit ?? 0;
    const followUsed = lastRenderedState.dayStageMeta?.privateFollowUpUsed ?? 0;
    const followLimit = lastRenderedState.dayStageMeta?.privateFollowUpLimit ?? 2;
    dom.chatDramaContext.textContent =
      lastRenderedState.phase === "day" && lastRenderedState.dayStage === "private"
        ? `第${lastRenderedState.day}天私聊 · 今日 ${used}/${limit} · 追问 ${followUsed}/${followLimit} · 内容不会进入公聊`
        : "当前不在私聊阶段，这段对话仅作回顾。";
  }
}

function playChatDramaResponse(response, { animated = true } = {}) {
  if (!dom.chatDramaResponse) {
    return;
  }
  if (chatDramaTypingTimer) {
    clearInterval(chatDramaTypingTimer);
    chatDramaTypingTimer = null;
  }

  const fullText = `${response ?? "我再想想。"}`
    .replace(/\s+/g, " ")
    .trim();
  if (!animated || fullText.length <= 8) {
    dom.chatDramaResponse.textContent = fullText;
    dom.chatDramaModal?.classList.remove("typing");
    updateChatDramaComposerState(
      !!lastRenderedState && lastRenderedState.phase === "day" && lastRenderedState.dayStage === "private" && !lastRenderedState.gameOver
    );
    return;
  }

  dom.chatDramaResponse.textContent = "";
  dom.chatDramaModal?.classList.add("typing");
  updateChatDramaComposerState(false);
  let cursor = 0;
  const step = Math.max(1, Math.ceil(fullText.length / 48));
  chatDramaTypingTimer = setInterval(() => {
    cursor = Math.min(fullText.length, cursor + step);
    dom.chatDramaResponse.textContent = fullText.slice(0, cursor);
    if (cursor >= fullText.length) {
      clearInterval(chatDramaTypingTimer);
      chatDramaTypingTimer = null;
      dom.chatDramaModal?.classList.remove("typing");
      updateChatDramaComposerState(
        !!lastRenderedState && lastRenderedState.phase === "day" && lastRenderedState.dayStage === "private" && !lastRenderedState.gameOver
      );
    }
  }, 28);
}

function openChatDramaModal(payload) {
  if (!dom.chatDramaModal) {
    return;
  }
  chatDramaTargetId = `${payload?.targetId ?? ""}`.trim();
  const seat = Number.isFinite(payload?.targetSeat) ? `${payload.targetSeat}号` : "--号";
  const speakerName = `${payload?.targetName ?? seat}`;
  const personaText = payload?.personaLabel ? `${payload.personaLabel}风格` : "普通风格";
  const question = `${payload?.question ?? "你最怀疑谁？"}`.trim();
  const response = `${payload?.response ?? "我再想想。"}`;

  const hue = ((Number(payload?.targetSeat ?? 1) * 37) % 360 + 360) % 360;
  dom.chatPortrait.style.setProperty("--portrait-hue", `${hue}`);
  dom.chatPortrait.classList.remove("persona-steady", "persona-pressure", "persona-shadow");
  const personaRaw = `${payload?.personaLabel ?? ""}`;
  if (/强压|pressure/i.test(personaRaw)) {
    dom.chatPortrait.classList.add("persona-pressure");
  } else if (/隐锐|shadow/i.test(personaRaw)) {
    dom.chatPortrait.classList.add("persona-shadow");
  } else {
    dom.chatPortrait.classList.add("persona-steady");
  }
  if (dom.chatPortraitArt) {
    dom.chatPortraitArt.style.backgroundImage = `url("${portraitAssetForSeat(Number(payload?.targetSeat ?? 1))}")`;
  }
  dom.chatPortraitSeat.textContent = seat;
  dom.chatPortraitName.textContent = speakerName;
  dom.chatPortraitPersona.textContent = personaText;
  dom.chatDramaTitle.textContent = `私聊 · ${speakerName}`;
  dom.chatDramaSpeaker.textContent = speakerName;
  dom.chatDramaQuestion.textContent = question;
  dom.chatDramaResponse.textContent = "";
  if (dom.chatDramaInput) {
    dom.chatDramaInput.value = `${payload?.prefillExtra ?? ""}`.trim();
  }
  if (!payload?.keepPrompt) {
    selectedChatDramaPrompt = selectedQuickWhisperPrompt;
  }
  renderChatDramaQuickButtons();
  updateChatDramaIntentPreview();
  updateChatDramaComposerState(
    !!lastRenderedState && lastRenderedState.phase === "day" && lastRenderedState.dayStage === "private" && !lastRenderedState.gameOver
  );

  dom.chatDramaModal.classList.remove("chat-refresh");
  void dom.chatDramaModal.offsetWidth;
  dom.chatDramaModal.classList.add("chat-refresh");
  dom.chatDramaModal.classList.add("show");
  playChatDramaResponse(response, { animated: payload?.response !== undefined });
}

function handleNightActionDismiss() {
  if (nightModalRequest?.preventDismiss) {
    showToast("请先确认选择，或点击“自动处理”。");
    return;
  }
  if (nightModalRequest?.mandatory) {
    nightModalRequest.onSkip?.();
  }
  closeNightActionModal();
}

function reminderOptionsFor(scriptId, selectedRoleName) {
  const officialCatalog = getOfficialReminderCatalog(scriptId) ?? [];
  const roleRef = selectedRoleName ? getOfficialRoleReference(scriptId, selectedRoleName) : null;
  const roleSpecific = [...(roleRef?.reminders ?? []), ...(roleRef?.remindersGlobal ?? [])];
  const official = uniqueStrings([...roleSpecific, ...officialCatalog]).filter(
    (entry) => entry.length <= 12 && !/[\uFFFD?]/.test(entry)
  );
  const fallback = FALLBACK_REMINDERS[scriptId] ?? [];
  return uniqueStrings([...official, ...fallback]);
}

function renderMarkPanel(state) {
  if (!dom.markPlayer || !dom.markRole || !dom.markReminder || !dom.markCurrentReminder) {
    return;
  }

  const playerOptions = state.players
    .slice()
    .sort((a, b) => a.seatIndex - b.seatIndex)
    .map((player) => ({ id: player.id, label: seatDisplayName(player, true) }));

  const selectedPlayerId =
    activeMarkPlayerId ||
    dom.markPlayer.value ||
    playerOptions.find((entry) => state.players.find((p) => p.id === entry.id)?.isHuman)?.id ||
    playerOptions[0]?.id;
  activeMarkPlayerId = selectedPlayerId || "";
  fillSelect(dom.markPlayer, playerOptions, selectedPlayerId, "无玩家");

  const selectedPlayer = state.players.find((entry) => entry.id === selectedPlayerId);
  const note = selectedPlayer ? getGrimoireNote(state, selectedPlayer.id) : null;
  if (dom.tokenActionTitle) {
    dom.tokenActionTitle.textContent = selectedPlayer
      ? `魔典标记：${seatDisplayName(selectedPlayer, true)}`
      : "魔典标记";
  }

  const roleOptions = [
    { id: "", label: "(清空角色标记)" },
    ...getAllRoles(state.scriptId).map((role) => ({ id: role.id, label: role.name })),
  ];

  const selectedRoleId = note?.markedRoleId ?? dom.markRole.value ?? "";
  fillSelect(dom.markRole, roleOptions, selectedRoleId, "无角色");

  const selectedRole = getAllRoles(state.scriptId).find((entry) => entry.id === selectedRoleId);
  const reminderValues = reminderOptionsFor(state.scriptId, selectedRole?.name);
  fillSelect(
    dom.markReminder,
    reminderValues.map((entry) => ({ id: entry, label: entry })),
    dom.markReminder.value || reminderValues[0] || "",
    "无提醒"
  );

  const currentReminders = uniqueStrings(note?.reminders ?? []);
  fillSelect(
    dom.markCurrentReminder,
    currentReminders.map((entry) => ({ id: entry, label: entry })),
    dom.markCurrentReminder.value || currentReminders[0] || "",
    "当前无提醒"
  );

  const disabled = !selectedPlayer;
  dom.btnApplyMarkedRole.disabled = disabled;
  dom.btnAddReminder.disabled = disabled || reminderValues.length === 0;
  dom.btnRemoveReminder.disabled = disabled || currentReminders.length === 0;
  dom.btnClearMark.disabled = disabled;
}

function setButtonState(state) {
  const inDay = state.phase === "day";
  const disabled = state.gameOver;
  const stage = state.dayStage;

  const canWhisper = inDay && stage === "private" && !disabled;
  const canPublic = inDay && stage === "public" && !disabled;
  const canNomination = inDay && stage === "nomination" && !disabled;

  dom.btnWhisper.disabled = !canWhisper;
  dom.whisperTarget.disabled = !canWhisper;
  dom.whisperInput.disabled = !canWhisper;
  if (dom.whisperQuickGrid) {
    dom.whisperQuickGrid.querySelectorAll("button").forEach((btn) => {
      btn.disabled = !canWhisper;
    });
  }
  updateChatDramaComposerState(canWhisper);
  dom.btnToPublic.disabled = !(inDay && stage === "private" && !disabled);

  dom.btnDiscuss.disabled = !canPublic;
  dom.btnToNomination.disabled = !canPublic;

  dom.btnNominate.disabled = !canNomination;
  dom.btnAINominate.disabled = !canNomination;
  dom.btnSkipDay.disabled = !canNomination;

  dom.nominator.disabled = !canNomination;
  dom.nominee.disabled = !canNomination;
  dom.humanVote.disabled = !canNomination;

  const dayAction = getHumanDayActionState(state);
  const canDayAction = dayAction.available && !disabled;
  dom.btnSlayer.disabled = !canDayAction;
  dom.btnSlayer.textContent = dayAction.available && dayAction.roleId !== "slayer" ? `执行 ${dayAction.roleName}` : "发动 Slayer";
  dom.slayerTarget.disabled = !canDayAction;

  const action = getHumanNightActionState(state);
  const canSetNightAction = action.available && !disabled;
  if (dom.btnOpenNightActionModal) {
    dom.btnOpenNightActionModal.disabled = !canSetNightAction;
  }
  dom.btnSaveNightAction.disabled = !canSetNightAction;
  dom.nightTargetA.disabled = !canSetNightAction;
  dom.nightTargetB.disabled = !canSetNightAction || action.targetCount < 2;
}

function stageKey(state) {
  return `${state.phase}|${state.dayStage}|${state.day}|${state.night}|${state.gameOver ? "1" : "0"}`;
}

function triggerPhaseShift(state) {
  const nextKey = stageKey(state);
  if (!dom.appShell) {
    lastStageKey = nextKey;
    return;
  }
  if (!lastStageKey) {
    lastStageKey = nextKey;
    return;
  }
  if (lastStageKey === nextKey) {
    return;
  }
  lastStageKey = nextKey;

  dom.appShell.classList.remove("phase-shift");
  void dom.appShell.offsetWidth;
  dom.appShell.classList.add("phase-shift");
  if (phaseShiftTimer) {
    clearTimeout(phaseShiftTimer);
  }
  phaseShiftTimer = setTimeout(() => {
    dom.appShell.classList.remove("phase-shift");
    phaseShiftTimer = null;
  }, 460);
}

function refreshMarkPanelFromCachedState() {
  if (!lastRenderedState) {
    return;
  }
  renderMarkPanel(lastRenderedState);
}

function closeAllReminderMenus() {
  document.querySelectorAll(".token-add-reminder-menu.show").forEach((node) => {
    node.classList.remove("show");
  });
}

export function initUI(handlers) {
  uiHandlers = handlers;
  dom.appShell = qs("appShell");
  dom.leftPanel = qs("leftPanel");
  dom.rightPanel = qs("rightPanel");
  dom.boardWrap = qs("boardWrap");
  dom.btnToggleLeft = qs("btnToggleLeft");
  dom.btnToggleRight = qs("btnToggleRight");
  dom.btnToggleBottom = qs("btnToggleBottom");
  dom.btnCollapseLeftPanel = qs("btnCollapseLeftPanel");
  dom.btnCollapseRightPanel = qs("btnCollapseRightPanel");
  dom.btnToggleLeftDensity = qs("btnToggleLeftDensity");
  dom.btnOpenScriptSheet = qs("btnOpenScriptSheet");

  dom.script = qs("scriptSelect");
  dom.roleSelect = qs("roleSelect");
  dom.playerCount = qs("playerCount");
  dom.btnNewGame = qs("btnNewGame");
  dom.toggleGrimoire = qs("toggleGrimoire");

  dom.whisperTarget = qs("whisperTargetSelect");
  dom.whisperQuickGrid = qs("whisperQuickGrid");
  dom.whisperInput = qs("whisperInput");
  dom.whisperIntentPreview = qs("whisperIntentPreview");
  dom.btnWhisper = qs("btnWhisper");
  dom.btnToPublic = qs("btnToPublic");

  dom.btnDiscuss = qs("btnDiscuss");
  dom.btnToNomination = qs("btnToNomination");

  dom.btnNominate = qs("btnNominate");
  dom.btnAINominate = qs("btnAINominate");
  dom.btnSkipDay = qs("btnSkipDay");
  dom.btnSlayer = qs("btnSlayer");
  dom.btnOpenNightActionModal = qs("btnOpenNightActionModal");
  dom.btnSaveNightAction = qs("btnSaveNightAction");

  dom.nominator = qs("nominatorSelect");
  dom.nominee = qs("nomineeSelect");
  dom.humanVote = qs("humanVoteSelect");
  dom.slayerTarget = qs("slayerTargetSelect");
  dom.nightTargetA = qs("nightTargetASelect");
  dom.nightTargetB = qs("nightTargetBSelect");
  dom.nightTargetRowB = qs("nightTargetRowB");
  dom.nightActionSummary = qs("nightActionSummary");
  dom.nightActionModal = qs("nightActionModal");
  dom.nightActionModalCard = qs("nightActionModalCard");
  dom.nightActionModalKicker = qs("nightActionModalKicker");
  dom.nightActionModalTitle = qs("nightActionModalTitle");
  dom.nightActionModalPrompt = qs("nightActionModalPrompt");
  dom.nightActionWakeLine = qs("nightActionWakeLine");
  dom.nightActionRoleCard = qs("nightActionRoleCard");
  dom.nightActionRoleIcon = qs("nightActionRoleIcon");
  dom.nightActionRoleBadge = qs("nightActionRoleBadge");
  dom.nightActionRoleSubtitle = qs("nightActionRoleSubtitle");
  dom.nightActionModalHelper = qs("nightActionModalHelper");
  dom.nightModalTargetA = qs("nightModalTargetASelect");
  dom.nightModalTargetB = qs("nightModalTargetBSelect");
  dom.nightModalTargetRowB = qs("nightModalTargetRowB");
  dom.nightModalTargetALabel = qs("nightModalTargetALabel");
  dom.nightModalTargetBLabel = qs("nightModalTargetBLabel");
  dom.nightActionDynamicFields = qs("nightActionDynamicFields");
  dom.btnCloseNightActionModal = qs("btnCloseNightActionModal");
  dom.btnConfirmNightActionModal = qs("btnConfirmNightActionModal");
  dom.btnSkipNightActionModal = qs("btnSkipNightActionModal");

  dom.markPlayer = qs("markPlayerSelect");
  dom.markRole = qs("markRoleSelect");
  dom.markReminder = qs("markReminderSelect");
  dom.markCurrentReminder = qs("markCurrentReminderSelect");
  dom.btnApplyMarkedRole = qs("btnApplyMarkedRole");
  dom.btnAddReminder = qs("btnAddReminder");
  dom.btnRemoveReminder = qs("btnRemoveReminder");
  dom.btnClearMark = qs("btnClearMark");
  dom.tokenActionModal = qs("tokenActionModal");
  dom.tokenActionTitle = qs("tokenActionTitle");
  dom.btnCloseTokenAction = qs("btnCloseTokenAction");

  dom.grimoire = qs("grimoireBoard");
  dom.logs = qs("logList");
  dom.aiInsights = qs("aiInsights");
  dom.aiInsightSection = qs("aiInsightSection");
  dom.privateInfo = qs("privateInfo");
  dom.status = qs("statusLine");
  dom.setupLine = qs("setupLine");
  dom.aliveLine = qs("aliveLine");
  dom.stageChip = qs("stageChip");
  dom.bluffList = qs("bluffList");
  dom.scriptBadge = qs("scriptBadge");
  dom.recentEventCapsule = qs("recentEventCapsule");
  dom.officialScriptLine = qs("officialScriptLine");
  dom.officialSetupLine = qs("officialSetupLine");
  dom.officialStateLine = qs("officialStateLine");

  dom.guideTitle = qs("guideTitle");
  dom.guideList = qs("guideList");
  dom.guideHint = qs("guideHint");
  dom.debateTimeline = qs("debateTimeline");
  dom.debateMeta = qs("debateMeta");
  dom.btnDebateSpeed = qs("btnDebateSpeed");
  dom.btnDebateSkip = qs("btnDebateSkip");
  dom.debateProgressFill = qs("debateProgressFill");

  dom.scriptSheetModal = qs("scriptSheetModal");
  dom.sheetModalTitle = qs("sheetModalTitle");
  dom.btnCloseScriptSheet = qs("btnCloseScriptSheet");
  dom.sheetImage = qs("sheetImage");
  dom.sheetTabTB = qs("sheetTabTB");
  dom.sheetTabBMR = qs("sheetTabBMR");
  dom.sheetTabSNV = qs("sheetTabSNV");
  dom.sheetFirstNightList = qs("sheetFirstNightList");
  dom.sheetOtherNightList = qs("sheetOtherNightList");

  dom.chatDramaModal = qs("chatDramaModal");
  dom.btnCloseChatDrama = qs("btnCloseChatDrama");
  dom.chatDramaTitle = qs("chatDramaTitle");
  dom.chatDramaSpeaker = qs("chatDramaSpeaker");
  dom.chatDramaQuestion = qs("chatDramaQuestion");
  dom.chatDramaResponse = qs("chatDramaResponse");
  dom.chatDramaContext = qs("chatDramaContext");
  dom.chatDramaQuickGrid = qs("chatDramaQuickGrid");
  dom.chatDramaInput = qs("chatDramaInput");
  dom.chatDramaIntentPreview = qs("chatDramaIntentPreview");
  dom.btnChatDramaSend = qs("btnChatDramaSend");
  dom.chatDramaHint = qs("chatDramaHint");
  dom.chatPortrait = qs("chatPortrait");
  dom.chatPortraitArt = qs("chatPortraitArt");
  dom.chatPortraitSeat = qs("chatPortraitSeat");
  dom.chatPortraitName = qs("chatPortraitName");
  dom.chatPortraitPersona = qs("chatPortraitPersona");

  loadSidebarState();
  loadLayoutDebugState();
  applySidebarState();
  applyLayoutDebugState();
  applyLayoutMode("mode-focus");
  applyViewportProfile();
  fitBoardToSquare();

  dom.btnToggleLeft.addEventListener("click", () => toggleLeftSidebar());
  dom.btnToggleRight.addEventListener("click", () => toggleRightSidebar());
  dom.btnToggleBottom?.addEventListener("click", () => toggleBottomPanels());
  dom.btnDebateSpeed?.addEventListener("click", () => cyclePublicPlaybackSpeed());
  dom.btnDebateSkip?.addEventListener("click", () => skipPublicPlayback());
  dom.btnCollapseLeftPanel?.addEventListener("click", () => toggleLeftSidebar());
  dom.btnCollapseRightPanel?.addEventListener("click", () => toggleRightSidebar());
  dom.btnToggleLeftDensity?.addEventListener("click", () => toggleLeftDensity());
  dom.recentEventCapsule?.addEventListener("click", () => {
    if (sidebarState.rightCollapsed) {
      toggleRightSidebar();
    }
  });

  window.addEventListener("resize", () => {
    applyViewportProfile();
    fitBoardToSquare();
  });

  dom.btnOpenScriptSheet.addEventListener("click", () => {
    const fallbackScript = dom.script?.value || currentScriptId || "tb";
    openScriptSheet(fallbackScript);
  });

  dom.btnCloseScriptSheet.addEventListener("click", () => closeScriptSheet());

  dom.scriptSheetModal.addEventListener("click", (event) => {
    if (event.target === dom.scriptSheetModal) {
      closeScriptSheet();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "d") {
      event.preventDefault();
      layoutDebugEnabled = !layoutDebugEnabled;
      persistLayoutDebugState();
      applyLayoutDebugState();
      showToast(layoutDebugEnabled ? "布局调试模式：已开启" : "布局调试模式：已关闭");
      return;
    }
    if (event.key !== "Escape") {
      return;
    }
    closeAllReminderMenus();
    if (dom.chatDramaModal?.classList.contains("show")) {
      closeChatDramaModal();
      return;
    }
    if (dom.nightActionModal.classList.contains("show")) {
      handleNightActionDismiss();
      return;
    }
    if (dom.tokenActionModal.classList.contains("show")) {
      closeTokenActionModal();
      return;
    }
    if (dom.scriptSheetModal.classList.contains("show")) {
      closeScriptSheet();
    }
  });

  document.addEventListener("click", () => {
    closeAllReminderMenus();
  });

  dom.sheetTabTB.addEventListener("click", () => renderScriptSheet("tb"));
  dom.sheetTabBMR.addEventListener("click", () => renderScriptSheet("bmr"));
  dom.sheetTabSNV.addEventListener("click", () => renderScriptSheet("snv"));

  dom.script.addEventListener("change", () => {
    if (dom.scriptSheetModal.classList.contains("show")) {
      renderScriptSheet(dom.script.value);
    }
  });

  dom.btnNewGame.addEventListener("click", () => {
    handlers.onNewGame({
      scriptId: dom.script.value,
      playerCount: Number.parseInt(dom.playerCount.value, 10),
      preferredHumanRoleId: dom.roleSelect?.value || "",
    });
  });

  dom.toggleGrimoire.addEventListener("change", () => {
    handlers.onToggleGrimoire(dom.toggleGrimoire.checked);
  });

  renderWhisperQuickButtons();
  renderChatDramaQuickButtons();
  updateWhisperIntentPreview();
  updateChatDramaIntentPreview();
  updateChatDramaComposerState(false);

  dom.btnWhisper.addEventListener("click", () => {
    openWhisperComposer(lastRenderedState, dom.whisperTarget?.value, {
      selectedPrompt: selectedQuickWhisperPrompt,
      prefillExtra: `${dom.whisperInput?.value ?? ""}`,
    });
  });

  dom.whisperInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    openWhisperComposer(lastRenderedState, dom.whisperTarget?.value, {
      selectedPrompt: selectedQuickWhisperPrompt,
      prefillExtra: `${dom.whisperInput?.value ?? ""}`,
    });
  });
  dom.whisperInput.addEventListener("input", () => {
    updateWhisperIntentPreview();
  });
  dom.whisperTarget.addEventListener("change", () => {
    updateWhisperIntentPreview();
  });
  dom.btnChatDramaSend?.addEventListener("click", () => {
    triggerChatDramaWhisper(handlers);
  });
  dom.chatDramaInput?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    triggerChatDramaWhisper(handlers);
  });
  dom.chatDramaInput?.addEventListener("input", () => {
    updateChatDramaIntentPreview();
  });

  dom.btnToPublic.addEventListener("click", () => handlers.onToPublic());
  dom.btnDiscuss.addEventListener("click", () => handlers.onAIDiscuss());
  dom.btnToNomination.addEventListener("click", () => handlers.onToNomination());

  dom.btnNominate.addEventListener("click", () => {
    handlers.onNominate({
      nominatorId: dom.nominator.value,
      nomineeId: dom.nominee.value,
      humanVoteYes: dom.humanVote.value === "yes",
    });
  });

  dom.btnAINominate.addEventListener("click", () => {
    handlers.onAINominate({ humanVoteYes: dom.humanVote.value === "yes" });
  });

  dom.btnSkipDay.addEventListener("click", () => handlers.onSkipDay());

  dom.btnSlayer.addEventListener("click", () => {
    if (!lastRenderedState) {
      return;
    }
    const action = getHumanDayActionState(lastRenderedState);
    if (!action.available) {
      showToast(action.reason);
      return;
    }
    openNightActionModal(action, {
      onConfirm: (plan) => {
        if (action.roleId === "slayer") {
          handlers.onSlayer({ targetId: plan.targetIds?.[0] });
          return { ok: true };
        }
        return handlers.onSetDayAction?.(plan) ?? { ok: false, reason: "当前白天行动尚未接入处理器。" };
      },
      onSkip: () => {},
    });
  });

  dom.btnSaveNightAction.addEventListener("click", () => {
    const targetIds = [dom.nightTargetA.value];
    if (!dom.nightTargetRowB.classList.contains("hidden")) {
      targetIds.push(dom.nightTargetB.value);
    }
    handlers.onSetNightAction({ targetIds });
  });

  dom.btnOpenNightActionModal.addEventListener("click", () => {
    if (!lastRenderedState) {
      return;
    }
    const action = getHumanNightActionState(lastRenderedState);
    if (!action.available) {
      showToast(action.reason);
      return;
    }
    openNightActionModal(action, {
      onConfirm: (plan) => {
        handlers.onSetNightAction(plan);
        return { ok: true };
      },
      onSkip: () => {},
    });
  });

  dom.nightActionModal.addEventListener("click", (event) => {
    if (event.target === dom.nightActionModal) {
      handleNightActionDismiss();
    }
  });

  dom.btnCloseNightActionModal.addEventListener("click", () => handleNightActionDismiss());

  dom.btnConfirmNightActionModal.addEventListener("click", () => {
    if (!nightModalRequest?.action) {
      closeNightActionModal();
      return;
    }
    const plan = collectNightActionPlan(nightModalRequest.action);
    const result = nightModalRequest.onConfirm?.({ ...plan, action: nightModalRequest.action }) ?? { ok: true };
    if (result?.ok === false) {
      if (result.reason) {
        showToast(result.reason);
      }
      return;
    }
    closeNightActionModal();
  });

  dom.btnSkipNightActionModal.addEventListener("click", () => {
    nightModalRequest?.onSkip?.();
    closeNightActionModal();
  });

  dom.tokenActionModal.addEventListener("click", (event) => {
    if (event.target === dom.tokenActionModal) {
      closeTokenActionModal();
    }
  });

  dom.btnCloseTokenAction.addEventListener("click", () => closeTokenActionModal());

  dom.chatDramaModal?.addEventListener("click", (event) => {
    if (event.target === dom.chatDramaModal) {
      closeChatDramaModal();
    }
  });
  dom.btnCloseChatDrama?.addEventListener("click", () => closeChatDramaModal());

  dom.markPlayer.addEventListener("change", () => {
    activeMarkPlayerId = dom.markPlayer.value || "";
    refreshMarkPanelFromCachedState();
  });
  dom.markRole.addEventListener("change", () => refreshMarkPanelFromCachedState());

  dom.btnApplyMarkedRole.addEventListener("click", () => {
    handlers.onSetMarkedRole({
      playerId: dom.markPlayer.value,
      roleId: dom.markRole.value,
    });
  });

  dom.btnAddReminder.addEventListener("click", () => {
    handlers.onAddReminder({
      playerId: dom.markPlayer.value,
      reminder: dom.markReminder.value,
    });
  });

  dom.btnRemoveReminder.addEventListener("click", () => {
    handlers.onRemoveReminder({
      playerId: dom.markPlayer.value,
      reminder: dom.markCurrentReminder.value,
    });
  });

  dom.btnClearMark.addEventListener("click", () => {
    handlers.onClearMark({ playerId: dom.markPlayer.value });
  });
}

export function renderGame(state, aiInsights) {
  if (!state) {
    return;
  }

  applyLayoutMode(deriveLayoutMode(state));
  triggerPhaseShift(state);
  applySceneTheme(state);
  lastRenderedState = state;
  lastRenderedAIInsights = aiInsights ?? [];
  renderCircle(state, aiInsights);
  renderDebateStage(state);
  renderNominationOptions(state);
  renderWhisperTargets(state);
  updateWhisperIntentPreview();
  updateChatDramaIntentPreview();
  renderSlayerTargets(state);
  renderNightAction(state);
  renderLogs(state);
  renderAIInsights(aiInsights, state);
  renderPrivateInfo(state);
  renderHud(state);
  renderBluffs(state);
  renderGuide(state);
  renderMarkPanel(state);

  if (dom.scriptSheetModal.classList.contains("show")) {
    renderScriptSheet(state.scriptId);
  }

  dom.toggleGrimoire.checked = state.grimoireView;
  setButtonState(state);
}

export function promptNightActionChoice(action, request = {}) {
  openNightActionModal(action, request);
}

export function showPrivateDialogue(payload) {
  openChatDramaModal(payload ?? {});
}

export function showToast(message) {
  const bar = document.createElement("div");
  bar.className = "toast";
  bar.textContent = message;
  document.body.appendChild(bar);

  requestAnimationFrame(() => {
    bar.classList.add("show");
  });

  setTimeout(() => {
    bar.classList.remove("show");
    setTimeout(() => {
      bar.remove();
    }, 220);
  }, 2600);
}



