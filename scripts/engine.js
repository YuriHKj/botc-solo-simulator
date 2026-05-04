import { clamp, getAllRoles, getPlayerSetup, getRoleById, sample, SCRIPT_MAP, shuffle } from "./data.js";
import {
  ensureAIAgents,
  recordDeathForAgents,
  recordEvilRecognitionForAgents,
  recordNominationForAgents,
  recordPrivateInfoForAgent,
  recordPublicClaimForAgents,
  recordVoteForAgents,
} from "./ai_agents.js";
import { getOfficialNightOrderNames } from "./grimoire_reference.js";
import { createEmptyUtteranceArchive } from "./dialogue_schema.js";
import { getNightRunner, getScriptRoleActionRules, getScriptRoleDayActionRules, getScriptRuleHandlers } from "./roles/index.js";

const HUMAN_NAME = "\u4f60";

const TB = {
  WASHERWOMAN: "washerwoman",
  LIBRARIAN: "librarian",
  INVESTIGATOR: "investigator",
  CHEF: "chef",
  EMPATH: "empath",
  FORTUNE_TELLER: "fortune-teller",
  UNDERTAKER: "undertaker",
  MONK: "monk",
  RAVENKEEPER: "ravenkeeper",
  VIRGIN: "virgin",
  SLAYER: "slayer",
  SOLDIER: "soldier",
  MAYOR: "mayor",
  BUTLER: "butler",
  DRUNK: "drunk",
  RECLUSE: "recluse",
  SAINT: "saint",
  POISONER: "poisoner",
  SPY: "spy",
  SCARLET_WOMAN: "scarlet-woman",
  BARON: "baron",
  IMP: "imp",
};

const BMR = {
  GRANDMOTHER: "grandmother",
  SAILOR: "sailor",
  CHAMBERMAID: "chambermaid",
  EXORCIST: "exorcist",
  INNKEEPER: "innkeeper",
  GAMBLER: "gambler",
  GOSSIP: "gossip",
  COURTIER: "courtier",
  PROFESSOR: "professor",
  MINSTREL: "minstrel",
  TEA_LADY: "tea-lady",
  PACIFIST: "pacifist",
  FOOL: "fool",
  TINKER: "tinker",
  MOONCHILD: "moonchild",
  GOON: "goon",
  LUNATIC: "lunatic",
  GODFATHER: "godfather",
  DEVILS_ADVOCATE: "devil-s-advocate",
  ASSASSIN: "assassin",
  MASTERMIND: "mastermind",
  ZOMBUUL: "zombuul",
  PUKKA: "pukka",
  SHABALOTH: "shabaloth",
  PO: "po",
};

const SNV = {
  CLOCKMAKER: "clockmaker",
  DREAMER: "dreamer",
  SNAKE_CHARMER: "snake-charmer",
  MATHEMATICIAN: "mathematician",
  FLOWERGIRL: "flowergirl",
  TOWN_CRIER: "town-crier",
  ORACLE: "oracle",
  SAVANT: "savant",
  SEAMSTRESS: "seamstress",
  PHILOSOPHER: "philosopher",
  ARTIST: "artist",
  JUGGLER: "juggler",
  SAGE: "sage",
  MUTANT: "mutant",
  SWEETHEART: "sweetheart",
  BARBER: "barber",
  KLUTZ: "klutz",
  EVIL_TWIN: "evil-twin",
  WITCH: "witch",
  CERENOVUS: "cerenovus",
  PIT_HAG: "pit-hag",
  FANG_GU: "fang-gu",
  VIGORMORTIS: "vigormortis",
  NO_DASHII: "no-dashii",
  VORTOX: "vortox",
};

function createPlayerNames(playerCount) {
  return Array.from({ length: playerCount }, (_, idx) => (idx === 0 ? HUMAN_NAME : `${idx + 1}号`));
}

function applySeatNames(players) {
  players.forEach((player) => {
    player.name = player.isHuman ? HUMAN_NAME : `${player.seatIndex + 1}号`;
  });
}

function roleCountsFor(scriptId, playerCount) {
  const setup = getPlayerSetup(playerCount);
  if (!setup) {
    throw new Error("当前版本仅支持 5-15 人对局。");
  }
  const script = SCRIPT_MAP[scriptId];
  if (!script) {
    throw new Error("未知剧本。请选择 TB / BMR / SnV。");
  }
  return setup;
}

function drawSetupRolesStandard(scriptId, playerCount, rng = Math.random) {
  const script = SCRIPT_MAP[scriptId];
  const counts = roleCountsFor(scriptId, playerCount);

  const selectedTownsfolk = sample(script.roles.townsfolk, counts.townsfolk, rng);
  const selectedOutsiders = sample(script.roles.outsider, counts.outsider, rng);
  const selectedMinions = sample(script.roles.minion, counts.minion, rng);
  const selectedDemons = sample(script.roles.demon, counts.demon, rng);

  return {
    roleBag: [...selectedTownsfolk, ...selectedOutsiders, ...selectedMinions, ...selectedDemons],
    counts,
    baseCounts: counts,
  };
}

function drawSetupRolesTB(playerCount, rng = Math.random) {
  const script = SCRIPT_MAP.tb;
  const baseCounts = roleCountsFor("tb", playerCount);

  const selectedMinions = sample(script.roles.minion, baseCounts.minion, rng);
  const baronInPlay = selectedMinions.some((entry) => entry.id === TB.BARON);

  const adjustedTownsfolk = clamp(baseCounts.townsfolk - (baronInPlay ? 2 : 0), 0, script.roles.townsfolk.length);
  const adjustedOutsiders = clamp(baseCounts.outsider + (baronInPlay ? 2 : 0), 0, script.roles.outsider.length);

  const selectedTownsfolk = sample(script.roles.townsfolk, adjustedTownsfolk, rng);
  const selectedOutsiders = sample(script.roles.outsider, adjustedOutsiders, rng);
  const selectedDemons = sample(script.roles.demon, 1, rng);

  return {
    roleBag: [...selectedTownsfolk, ...selectedOutsiders, ...selectedMinions, ...selectedDemons],
    counts: {
      townsfolk: adjustedTownsfolk,
      outsider: adjustedOutsiders,
      minion: baseCounts.minion,
      demon: baseCounts.demon,
    },
    baseCounts,
  };
}

function makePlayerBase(playerId, name, seatIndex, isHuman) {
  return {
    id: playerId,
    name,
    seatIndex,
    isHuman,
    alive: true,
    ghostVoteAvailable: true,
    poisoned: false,
    poisonedTomorrowDay: false,
    publicClaimRoleId: null,
    roleId: null,
    roleName: null,
    roleIcon: null,
    apparentRoleId: null,
    apparentRoleName: null,
    apparentRoleIcon: null,
    apparentCategory: null,
    apparentTeam: null,
    category: null,
    team: null,
    tags: [],
    privateNotes: [],
    nominatedToday: false,
    beenNominatedToday: false,
    suspicion: {},
    speechHistory: [],
    threatScore: 0.5,
  };
}

function setRole(player, roleEntry) {
  player.roleId = roleEntry.id;
  player.roleName = roleEntry.name;
  player.roleIcon = roleEntry.icon ?? null;
  player.apparentRoleId = roleEntry.id;
  player.apparentRoleName = roleEntry.name;
  player.apparentRoleIcon = roleEntry.icon ?? null;
  player.apparentCategory = roleEntry.category;
  player.apparentTeam = roleEntry.team;
  player.category = roleEntry.category;
  player.team = roleEntry.team;
  player.tags = [...roleEntry.tags];
}

function chooseOne(list, rng = Math.random) {
  if (!list || list.length === 0) {
    return null;
  }
  return list[Math.floor(rng() * list.length)];
}

function randomInt(min, max, rng = Math.random) {
  const low = Math.ceil(min);
  const high = Math.floor(max);
  return Math.floor(rng() * (high - low + 1)) + low;
}

function getRoleNameById(state, roleId) {
  return getAllRoles(state.scriptId).find((entry) => entry.id === roleId)?.name ?? roleId;
}

function buildDemonBluffs(scriptId, roleBag, rng = Math.random) {
  const allGoodRoles = getAllRoles(scriptId).filter((entry) => entry.team === "good");
  const inPlayGoodIds = new Set(roleBag.filter((entry) => entry.team === "good").map((entry) => entry.id));
  const notInPlayGood = allGoodRoles.filter((entry) => !inPlayGoodIds.has(entry.id));
  const pool = notInPlayGood.length >= 3 ? notInPlayGood : allGoodRoles;
  return sample(pool, 3, rng);
}

function assignDrunkMask(state, rng = Math.random) {
  const script = SCRIPT_MAP[state.scriptId];
  const drunkPlayers = state.players.filter((entry) => entry.roleId === TB.DRUNK);
  if (drunkPlayers.length === 0) {
    return;
  }

  const inPlayIds = new Set(state.players.map((entry) => entry.roleId));
  const notInPlayTownsfolk = script.roles.townsfolk.filter((entry) => !inPlayIds.has(entry.id));
  const candidates = notInPlayTownsfolk.length > 0 ? notInPlayTownsfolk : script.roles.townsfolk;

  drunkPlayers.forEach((player) => {
    const maskRole = chooseOne(candidates, rng);
    if (!maskRole) {
      return;
    }
    player.apparentRoleId = maskRole.id;
    player.apparentRoleName = maskRole.name;
    player.apparentRoleIcon = maskRole.icon ?? null;
    player.apparentCategory = maskRole.category;
    player.apparentTeam = maskRole.team;
  });
}

function createTBState() {
  return {
    redHerringId: null,
    monkProtectedId: null,
    lastMonkProtectedId: null,
    poisonTargetTonightId: null,
    butlerMasterById: {},
    virginTriggeredIds: [],
    slayerUsedByIds: [],
    executionRoleByDay: {},
    executionOccurredToday: false,
    specialWinGood: false,
    specialWinEvil: false,
    specialWinReasons: [],
  };
}

export function addLog(state, type, message, payload = {}) {
  state.logs.push({
    id: `${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    day: state.day,
    night: state.night,
    phase: state.phase,
    type,
    message,
    payload,
    timestamp: Date.now(),
  });
  if (state.logs.length > 700) {
    state.logs.shift();
  }
}

function addPrivateInfo(state, player, text) {
  player.privateNotes.push(text);
  recordPrivateInfoForAgent(state, player, text);
  if (player.isHuman) {
    state.pendingHumanInfo.push(text);
  }
  addLog(state, "private-info", text, {
    private: true,
    playerId: player.id,
    noteSource: "night-or-setup-info",
  });
}

function ensureStorytellerActionQueue(state) {
  state.pendingStorytellerActions = Array.isArray(state.pendingStorytellerActions) ? state.pendingStorytellerActions : [];
  return state.pendingStorytellerActions;
}

function playerChoiceOptions(state, { actorId = "", allowSelf = false, allowDead = false, excludeIds = [], filter = null } = {}) {
  const excluded = new Set(excludeIds.filter(Boolean));
  return state.players
    .filter((player) => (allowDead ? true : player.alive))
    .filter((player) => (allowSelf ? true : player.id !== actorId))
    .filter((player) => !excluded.has(player.id))
    .filter((player) => (typeof filter === "function" ? filter(player) : true))
    .map((player) => ({
      id: player.id,
      label: `${player.seatIndex + 1}号${player.isHuman ? "（你）" : ""}`,
      alive: player.alive,
      team: player.team,
      category: player.category,
    }));
}

function enqueueStorytellerAction(state, action) {
  if (!state || !action?.type) {
    return null;
  }
  const queue = ensureStorytellerActionQueue(state);
  const id = action.id ?? `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  if (queue.some((entry) => entry.id === id)) {
    return id;
  }
  queue.push({
    id,
    createdDay: state.day,
    createdNight: state.night,
    createdPhase: state.phase,
    ...action,
  });
  addLog(state, "storyteller-action", action.logText ?? "Storyteller 正等待玩家选择。", {
    private: true,
    actionId: id,
    type: action.type,
    actorId: action.actorId ?? null,
  });
  return id;
}

export function getPendingStorytellerActionState(state) {
  const action = ensureStorytellerActionQueue(state)[0] ?? null;
  if (!action) {
    return { available: false, reason: "当前没有等待处理的 Storyteller 操作。" };
  }
  return {
    available: true,
    id: action.id,
    type: action.type,
    roleId: action.roleId ?? "",
    roleName: action.roleName ?? "Storyteller",
    roleIcon: action.roleIcon ?? null,
    inputType: action.inputType ?? "player-target",
    informationText: action.informationText ?? "",
    targetCount: action.targetCount ?? 1,
    minTargetCount: action.minTargetCount ?? action.targetCount ?? 1,
    maxTargetCount: action.maxTargetCount ?? action.targetCount ?? 1,
    options: action.options ?? [],
    selectedTargetIds: action.selectedTargetIds ?? [],
    prompt: action.prompt ?? "请选择目标。",
    phaseLabel: action.phaseLabel ?? `D${state.day}/N${state.night}`,
    interaction: action.interaction ?? {
      title: "Storyteller 操作",
      subtitle: "流程暂停，等待你的选择。",
      badge: "Storyteller",
      confirmText: "确认选择",
      skipText: "自动处理",
    },
  };
}

function removePendingStorytellerAction(state, actionId) {
  const queue = ensureStorytellerActionQueue(state);
  const index = queue.findIndex((entry) => entry.id === actionId);
  if (index >= 0) {
    queue.splice(index, 1);
  }
}

function firstAvailableTargets(action, count) {
  return (action.options ?? []).slice(0, count).map((entry) => entry.id).filter(Boolean);
}

function normalizeStorytellerTargetIds(action, input = {}) {
  const targetCount = Number.isFinite(action.targetCount) ? action.targetCount : 1;
  const min = Number.isFinite(action.minTargetCount) ? action.minTargetCount : targetCount;
  const max = Number.isFinite(action.maxTargetCount) ? action.maxTargetCount : targetCount;
  const raw = input.auto ? firstAvailableTargets(action, max) : input.targetIds ?? [];
  const unique = uniqueStrings(raw);
  if (unique.length < min) {
    return { ok: false, reason: min <= 1 ? "请选择 1 名目标。" : `请至少选择 ${min} 名目标。` };
  }
  if (unique.length > max) {
    return { ok: false, reason: `最多只能选择 ${max} 名目标。` };
  }
  const allowed = new Set((action.options ?? []).map((entry) => entry.id));
  if (unique.some((targetId) => !allowed.has(targetId))) {
    return { ok: false, reason: "所选目标不符合当前 Storyteller 操作。" };
  }
  return { ok: true, targetIds: unique };
}

function resolveRavenkeeperAction(state, action, targetIds) {
  const actor = getPlayerById(state, action.actorId);
  const target = getPlayerById(state, targetIds[0]);
  if (!actor || !target) {
    return { ok: false, reason: "守鸦人目标无效。" };
  }
  const shownRoleId = isAbilityBlocked(actor, state) ? chooseOne(getAllRoles(state.scriptId))?.id ?? target.roleId : target.roleId;
  const text = `[第${action.createdNight}夜] 你临终查验 ${target.name}，其身份为 ${getRoleNameById(state, shownRoleId)}。`;
  addPrivateInfo(state, actor, text);
  state.events.infoPings.push({
    night: action.createdNight,
    actorId: actor.id,
    type: "ravenkeeper",
    targetId: target.id,
    shownRoleId,
    text,
  });
  return { ok: true, message: `守鸦人查验了 ${target.name}。` };
}

function resolveMoonchildAction(state, action, targetIds) {
  const actor = getPlayerById(state, action.actorId);
  const target = getPlayerById(state, targetIds[0]);
  if (!actor || !target || !state.bmr) {
    return { ok: false, reason: "月之子目标无效。" };
  }
  state.bmr.moonchildPendingById[actor.id] = target.id;
  addLog(state, "death-trigger", `${actor.name} 触发 Moonchild，指定了 ${target.name}。`, {
    victimId: actor.id,
    targetId: target.id,
  });
  return { ok: true, message: `月之子指定了 ${target.name}。` };
}

function resolveKlutzAction(state, action, targetIds) {
  const actor = getPlayerById(state, action.actorId);
  const target = getPlayerById(state, targetIds[0]);
  if (!actor || !target || !state.snv) {
    return { ok: false, reason: "呆瓜目标无效。" };
  }
  if (target.team === "evil") {
    addLog(state, "death-trigger", `${actor.name} 触发 Klutz 并点中邪恶玩家，善良阵营立即失败。`, {
      victimId: actor.id,
      targetId: target.id,
    });
    finalizeWinner(state, "evil", "Klutz 点中了邪恶玩家，善良阵营失败。");
    return { ok: true, message: `呆瓜点中了 ${target.name}。` };
  }
  addLog(state, "death-trigger", `${actor.name} 触发 Klutz，点中了善良玩家 ${target.name}，未触发失败。`, {
    victimId: actor.id,
    targetId: target.id,
  });
  return { ok: true, message: `呆瓜点中了 ${target.name}。` };
}

function resolveBarberAction(state, action, targetIds) {
  if (!state.snv) {
    return { ok: false, reason: "当前没有 Barber 状态。" };
  }
  const [a, b] = targetIds.map((targetId) => getPlayerById(state, targetId));
  if (!a || !b || a.id === b.id) {
    return { ok: false, reason: "请选择两名不同玩家。" };
  }
  const swapped = swapRolesByRoleId(state, a, b);
  if (!swapped) {
    return { ok: false, reason: "角色交换失败。" };
  }
  state.snv.barberDiedToday = false;
  addLog(state, "death-trigger", `Barber 触发：恶魔选择交换 ${a.name} 与 ${b.name} 的角色。`, {
    barberId: action.actorId,
    targetIds,
  });
  return { ok: true, message: `已交换 ${a.name} 与 ${b.name} 的角色。` };
}

function resolveSageInfoAction(state, action) {
  const actor = getPlayerById(state, action.actorId);
  if (!actor || !state.snv) {
    return { ok: false, reason: "贤者信息目标无效。" };
  }
  const text = action.informationText || "你作为贤者获得了一条恶魔相关信息。";
  addPrivateInfo(state, actor, text);
  state.events.infoPings.push({
    night: action.createdNight,
    actorId: actor.id,
    type: "sage",
    targetIds: action.targetIds ?? [],
    text,
  });
  return { ok: true, message: "贤者信息已记录。" };
}

export function resolvePendingStorytellerAction(state, input = {}) {
  const action = ensureStorytellerActionQueue(state)[0] ?? null;
  if (!action) {
    return { ok: false, reason: "当前没有等待处理的 Storyteller 操作。" };
  }
  const targets = normalizeStorytellerTargetIds(action, input);
  if (!targets.ok) {
    return targets;
  }

  const handlers = {
    "ravenkeeper-info": resolveRavenkeeperAction,
    "moonchild-choice": resolveMoonchildAction,
    "klutz-choice": resolveKlutzAction,
    "barber-swap": resolveBarberAction,
    "sage-info": resolveSageInfoAction,
  };
  const handler = handlers[action.type];
  if (!handler) {
    return { ok: false, reason: `未知 Storyteller 操作：${action.type}` };
  }
  const result = handler(state, action, targets.targetIds);
  if (!result.ok) {
    return result;
  }
  removePendingStorytellerAction(state, action.id);
  checkWin(state);
  return result;
}

function seatName(player) {
  if (!player) {
    return "--";
  }
  return `${player.seatIndex + 1}号`;
}

function seatList(players) {
  if (!players || players.length === 0) {
    return "无";
  }
  return players
    .map((entry) => seatName(entry))
    .join("、");
}

function deliverEvilRecognitionFirstNight(state) {
  state.storyFlags = state.storyFlags ?? { evilRecognitionDone: false };
  if (state.storyFlags.evilRecognitionDone || state.night !== 1) {
    return;
  }
  ensureAIAgents(state);

  const evilPlayers = state.players.filter((entry) => entry.team === "evil");
  if (evilPlayers.length === 0) {
    state.storyFlags.evilRecognitionDone = true;
    return;
  }

  const demon = evilPlayers.find((entry) => entry.category === "demon") ?? null;
  const minions = evilPlayers.filter((entry) => entry.category === "minion");
  const bluffText = (state.demonBluffs ?? []).map((entry) => entry.name).filter(Boolean).join(" / ");

  evilPlayers.forEach((player) => {
    if (player.category === "demon") {
      addPrivateInfo(state, player, `[第1夜] 邪恶互认：你的爪牙是 ${seatList(minions)}。`);
      if (bluffText) {
        addPrivateInfo(state, player, `[第1夜] 恶魔伪装（不在场）：${bluffText}。`);
      }
      return;
    }

    if (player.category === "minion") {
      const others = minions.filter((entry) => entry.id !== player.id);
      addPrivateInfo(
        state,
        player,
        `[第1夜] 邪恶互认：恶魔是 ${demon ? seatName(demon) : "未知"}；其他爪牙是 ${seatList(others)}。`
      );
    }
  });

  addLog(state, "night-info", "第1夜已完成邪恶互认阶段。", { private: true, team: "evil" });
  recordEvilRecognitionForAgents(state);
  state.storyFlags.evilRecognitionDone = true;
}

export function getAlivePlayers(state) {
  return state.players.filter((player) => player.alive);
}

export function getAliveDemons(state) {
  return state.players.filter((player) => player.alive && player.category === "demon");
}

export function getPlayerById(state, playerId) {
  return state.players.find((player) => player.id === playerId) ?? null;
}

export function getEffectiveRoleId(player) {
  if (!player) {
    return null;
  }
  return player.roleId === TB.DRUNK ? player.apparentRoleId : player.roleId;
}

export function getPerceivedRoleId(player) {
  if (!player) {
    return null;
  }
  return player.apparentRoleId ?? player.roleId;
}

export function getEffectiveRoleName(player) {
  if (!player) {
    return null;
  }
  return player.roleId === TB.DRUNK ? player.apparentRoleName : player.roleName;
}

export function getPerceivedRoleName(player) {
  if (!player) {
    return null;
  }
  return player.apparentRoleName ?? player.roleName;
}



function getEffectiveRoleIcon(player) {
  if (!player) {
    return null;
  }
  return player.roleId === TB.DRUNK ? player.apparentRoleIcon : player.roleIcon;
}

function getPerceivedRoleIcon(player) {
  if (!player) {
    return null;
  }
  return player.apparentRoleIcon ?? player.roleIcon;
}

export function publicRoleIcon(state, player, grimoireView) {
  if (!player) {
    return null;
  }
  if (grimoireView) {
    return player.roleIcon;
  }
  if (player.isHuman) {
    return getPerceivedRoleIcon(player);
  }
  if (player.publicClaimRoleId) {
    const role = getRoleById(state.scriptId, player.publicClaimRoleId);
    return role?.icon ?? null;
  }
  return null;
}

const HUMAN_NIGHT_RULES_BY_SCRIPT = {
  tb: getScriptRoleActionRules("tb"),
  bmr: getScriptRoleActionRules("bmr"),
  snv: getScriptRoleActionRules("snv"),
};

const HUMAN_DAY_RULES_BY_SCRIPT = {
  tb: getScriptRoleDayActionRules("tb"),
  bmr: getScriptRoleDayActionRules("bmr"),
  snv: getScriptRoleDayActionRules("snv"),
};

const PASSIVE_INFO_MIN_NIGHT = {
  [TB.UNDERTAKER]: 2,
  [SNV.FLOWERGIRL]: 2,
  [SNV.TOWN_CRIER]: 2,
  [SNV.ORACLE]: 2,
};

const NIGHT_ORDER_FALLBACK = {
  tb: {
    firstNight: [
      TB.POISONER,
      TB.WASHERWOMAN,
      TB.LIBRARIAN,
      TB.INVESTIGATOR,
      TB.CHEF,
      TB.EMPATH,
      TB.FORTUNE_TELLER,
      TB.BUTLER,
      TB.SPY,
    ],
    otherNight: [TB.POISONER, TB.MONK, TB.IMP, TB.RAVENKEEPER, TB.EMPATH, TB.FORTUNE_TELLER, TB.UNDERTAKER, TB.BUTLER, TB.SPY],
  },
  bmr: {
    firstNight: [BMR.GRANDMOTHER, BMR.SAILOR, BMR.CHAMBERMAID, BMR.GODFATHER, BMR.DEVILS_ADVOCATE],
    otherNight: [
      BMR.SAILOR,
      BMR.EXORCIST,
      BMR.INNKEEPER,
      BMR.GAMBLER,
      BMR.COURTIER,
      BMR.CHAMBERMAID,
      BMR.PROFESSOR,
      BMR.DEVILS_ADVOCATE,
      BMR.ASSASSIN,
      BMR.GODFATHER,
      BMR.LUNATIC,
      BMR.ZOMBUUL,
      BMR.PUKKA,
      BMR.SHABALOTH,
      BMR.PO,
    ],
  },
  snv: {
    firstNight: [SNV.SNAKE_CHARMER, SNV.PHILOSOPHER, SNV.DREAMER, SNV.MATHEMATICIAN, SNV.WITCH, SNV.CERENOVUS],
    otherNight: [
      SNV.SNAKE_CHARMER,
      SNV.PHILOSOPHER,
      SNV.DREAMER,
      SNV.MATHEMATICIAN,
      SNV.FLOWERGIRL,
      SNV.TOWN_CRIER,
      SNV.ORACLE,
      SNV.SEAMSTRESS,
      SNV.WITCH,
      SNV.CERENOVUS,
      SNV.PIT_HAG,
      SNV.FANG_GU,
      SNV.VIGORMORTIS,
      SNV.NO_DASHII,
      SNV.VORTOX,
    ],
  },
};

function resolveRoleIdByLocalizedName(scriptId, roleName) {
  if (!roleName) {
    return null;
  }
  return getAllRoles(scriptId).find((entry) => entry.name === roleName || entry.englishName === roleName)?.id ?? null;
}

function buildOrderedRoleIdsFromReference(scriptId, phaseKey, fallbackRoleIds = []) {
  const officialNames = getOfficialNightOrderNames(scriptId, phaseKey);
  if (!officialNames || officialNames.length === 0) {
    return fallbackRoleIds;
  }
  const resolved = officialNames.map((name) => resolveRoleIdByLocalizedName(scriptId, name)).filter(Boolean);
  if (resolved.length === 0) {
    return fallbackRoleIds;
  }
  return [...new Set(resolved)];
}

const NIGHT_ORDER_BY_SCRIPT = {
  tb: {
    firstNight: buildOrderedRoleIdsFromReference("tb", "firstNight", NIGHT_ORDER_FALLBACK.tb.firstNight),
    otherNight: buildOrderedRoleIdsFromReference("tb", "otherNight", NIGHT_ORDER_FALLBACK.tb.otherNight),
  },
  bmr: {
    firstNight: buildOrderedRoleIdsFromReference("bmr", "firstNight", NIGHT_ORDER_FALLBACK.bmr.firstNight),
    otherNight: buildOrderedRoleIdsFromReference("bmr", "otherNight", NIGHT_ORDER_FALLBACK.bmr.otherNight),
  },
  snv: {
    firstNight: buildOrderedRoleIdsFromReference("snv", "firstNight", NIGHT_ORDER_FALLBACK.snv.firstNight),
    otherNight: buildOrderedRoleIdsFromReference("snv", "otherNight", NIGHT_ORDER_FALLBACK.snv.otherNight),
  },
};

function getNightOrderConfig(scriptId) {
  return NIGHT_ORDER_BY_SCRIPT[scriptId] ?? null;
}

function getNightOrderRoleIds(scriptId, nightNumber) {
  const order = getNightOrderConfig(scriptId);
  if (!order) {
    return [];
  }
  return nightNumber <= 1 ? order.firstNight : order.otherNight;
}

export function getNightOrderReference(scriptId) {
  const toNamedList = (roleIds) =>
    roleIds.map((roleId) => getRoleById(scriptId, roleId)?.name ?? roleId);

  const order = getNightOrderConfig(scriptId);
  if (!order) {
    return {
      firstNight: [],
      otherNight: [],
    };
  }
  return {
    firstNight: toNamedList(order.firstNight),
    otherNight: toNamedList(order.otherNight),
  };
}

function getNightOrderIndex(state, roleId, nightNumber = state.night) {
  const order = getNightOrderRoleIds(state.scriptId, nightNumber);
  const index = order.indexOf(roleId);
  return index >= 0 ? index : Number.POSITIVE_INFINITY;
}

function getHumanPlayer(state) {
  return state.players.find((entry) => entry.isHuman) ?? null;
}

function nextNightNumber(state) {
  return state.phase === "night" ? state.night : state.night + 1;
}

function getHumanNightRule(state, roleId, nightNumber) {
  const scriptRules = HUMAN_NIGHT_RULES_BY_SCRIPT[state.scriptId];
  if (!scriptRules) {
    return null;
  }
  const rule = scriptRules[roleId];
  if (!rule) {
    return null;
  }
  if (nightNumber <= 1 && rule.firstNight === false) {
    return null;
  }
  if (nightNumber > 1 && rule.otherNight === false) {
    return null;
  }
  if (
    state.scriptId === "bmr" &&
    roleId === BMR.GODFATHER &&
    !state.bmr?.godfatherBonusKillTonight &&
    !(state.phase !== "night" && state.bmr?.lastDayOutsiderExecuted)
  ) {
    return null;
  }
  const firstNightOrder = getNightOrderRoleIds(state.scriptId, 1);
  const otherNightOrder = getNightOrderRoleIds(state.scriptId, 2);
  const appearsFirstNight = firstNightOrder.includes(roleId);
  const appearsOtherNight = otherNightOrder.includes(roleId);

  let minNight = rule.minNight ?? 1;
  if (!appearsFirstNight && appearsOtherNight) {
    minNight = Math.max(minNight, 2);
  } else if (appearsFirstNight && rule.firstNight !== false) {
    minNight = Math.min(minNight, 1);
  }

  if (nightNumber < minNight) {
    return null;
  }
  const maxNight = rule.maxNight ?? Number.POSITIVE_INFINITY;
  if (nightNumber > maxNight) {
    return null;
  }
  return rule;
}

function isRoleNightWindowOpen(state, roleId, nightNumber = state.night) {
  const scriptRules = HUMAN_NIGHT_RULES_BY_SCRIPT[state.scriptId] ?? {};
  const rule = scriptRules[roleId];
  if (!rule) {
    return true;
  }
  if (nightNumber <= 1 && rule.firstNight === false) {
    return false;
  }
  if (nightNumber > 1 && rule.otherNight === false) {
    return false;
  }
  if (
    state.scriptId === "bmr" &&
    roleId === BMR.GODFATHER &&
    !state.bmr?.godfatherBonusKillTonight &&
    !(state.phase !== "night" && state.bmr?.lastDayOutsiderExecuted)
  ) {
    return false;
  }
  const firstNightOrder = getNightOrderRoleIds(state.scriptId, 1);
  const otherNightOrder = getNightOrderRoleIds(state.scriptId, 2);
  const appearsFirstNight = firstNightOrder.includes(roleId);
  const appearsOtherNight = otherNightOrder.includes(roleId);

  let minNight = rule.minNight ?? 1;
  if (!appearsFirstNight && appearsOtherNight) {
    minNight = Math.max(minNight, 2);
  } else if (appearsFirstNight && rule.firstNight !== false) {
    minNight = Math.min(minNight, 1);
  }

  const maxNight = rule.maxNight ?? Number.POSITIVE_INFINITY;
  return nightNumber >= minNight && nightNumber <= maxNight;
}

function getHumanAbilityUsageCount(state, roleId) {
  if (!state?.humanAbilityUsage || !roleId) {
    return 0;
  }
  return Number(state.humanAbilityUsage[roleId] ?? 0);
}

function markHumanAbilityUsed(state, roleId) {
  if (!state || !roleId) {
    return;
  }
  state.humanAbilityUsage = state.humanAbilityUsage ?? {};
  state.humanAbilityUsage[roleId] = getHumanAbilityUsageCount(state, roleId) + 1;
}

function humanActionUsageKey(state, roleId, rule, actionKind) {
  if (rule?.usageScope === "day") {
    return `${roleId}:day:${state.day}`;
  }
  if (rule?.usageScope === "night") {
    return `${roleId}:night:${nextNightNumber(state)}`;
  }
  return roleId;
}

function playerTargetOptions(state, human, rule) {
  return state.players
    .filter((entry) => (rule.allowDead || entry.alive) && (rule.allowSelf || entry.id !== human.id))
    .filter((entry) => (!rule.requireDead ? true : !entry.alive))
    .map((entry) => ({
      id: entry.id,
      label: `${entry.seatIndex + 1}号${entry.isHuman ? "（你）" : ""}${entry.alive ? "" : "（死亡）"}`,
      seat: entry.seatIndex + 1,
      alive: entry.alive,
      isHuman: entry.isHuman,
    }));
}

function actionInputType(rule) {
  if (!rule) {
    return "player-target";
  }
  if (rule.inputType) {
    return rule.inputType;
  }
  return rule.kind === "player-target" ? "player-target" : rule.kind ?? "player-target";
}

function actionNeedsPlayerOptions(inputType) {
  return ["player-target", "player-role", "guesses", "charge-or-targets"].includes(inputType);
}

function roleTargetOptions(state, rule = {}) {
  const categories = Array.isArray(rule.roleCategories) && rule.roleCategories.length > 0 ? new Set(rule.roleCategories) : null;
  const teams = Array.isArray(rule.roleTeams) && rule.roleTeams.length > 0 ? new Set(rule.roleTeams) : null;
  return getAllRoles(state.scriptId)
    .filter((role) => (categories ? categories.has(role.category) : true))
    .filter((role) => (teams ? teams.has(role.team) : true))
    .filter((role) => (rule.excludeRoleIds ?? []).includes(role.id) === false)
    .map((role) => ({
      id: role.id,
      label: `${role.name}${role.englishName ? ` (${role.englishName})` : ""}`,
      category: role.category,
      team: role.team,
      icon: role.icon ?? null,
    }));
}

function normalizeActionRuleForState(state, roleId, rule) {
  if (!rule) {
    return null;
  }
  const normalized = { ...rule };
  if (state.scriptId === "bmr" && roleId === BMR.PO) {
    const charged = !!state.bmr?.poCharged;
    normalized.inputType = "charge-or-targets";
    normalized.targetCount = charged ? 3 : 1;
    normalized.minTargetCount = charged ? 1 : 1;
    normalized.maxTargetCount = charged ? 3 : 1;
    normalized.modes = charged
      ? [{ id: "kill", label: "释放蓄力，选择最多 3 名玩家" }]
      : [
          { id: "kill", label: "今晚击杀 1 名玩家" },
          { id: "charge", label: "今晚不杀，改为蓄力" },
        ];
  }
  return normalized;
}

function currentHumanPlanForAction(state, actionKind, actionKey, roleId) {
  const plan = actionKind === "day" ? state.humanDayPlan : state.humanNightPlan;
  if (!plan || plan.roleId !== roleId) {
    return null;
  }
  if (actionKind === "day") {
    return plan.day === actionKey ? plan : null;
  }
  return plan.night === actionKey ? plan : null;
}

function humanActionPayload(state, human, roleId, roleName, rule, options, selectedTargetIds = [], extra = {}) {
  const role = getRoleById(state.scriptId, roleId);
  const actionKind = extra.dayNumber ? "day" : "night";
  const usageKey = humanActionUsageKey(state, roleId, rule, actionKind);
  const usedCount = getHumanAbilityUsageCount(state, usageKey);
  const maxUses = Number.isFinite(rule.maxUses) ? rule.maxUses : null;
  const inputType = actionInputType(rule);
  return {
    available: true,
    roleId,
    roleName,
    roleIcon: role?.icon ?? null,
    inputType,
    targetCount: rule.targetCount,
    minTargetCount: Number.isFinite(rule.minTargetCount) ? rule.minTargetCount : rule.targetCount,
    maxTargetCount: Number.isFinite(rule.maxTargetCount) ? rule.maxTargetCount : rule.targetCount,
    allowSelf: rule.allowSelf,
    allowDead: rule.allowDead,
    prompt: rule.prompt,
    interaction: rule.interaction ?? null,
    usageKey,
    usedCount,
    maxUses,
    options,
    roleOptions: roleTargetOptions(state, rule),
    modes: rule.modes ?? [],
    selectedTargetIds,
    ...extra,
  };
}

export function getHumanNightActionState(state) {
  const human = getHumanPlayer(state);
  if (!human) {
    return { available: false, reason: "未找到主视角玩家。" };
  }
  if (state.gameOver || state.phase === "ended") {
    return { available: false, reason: "对局已结束。" };
  }
  if (!human.alive) {
    return { available: false, reason: "你已死亡，无法进行夜间主动选择。" };
  }

  const nightNumber = nextNightNumber(state);
  const roleId = getPerceivedRoleId(human);
  const roleName = getPerceivedRoleName(human) ?? human.roleName;
  const rule = normalizeActionRuleForState(state, roleId, getHumanNightRule(state, roleId, nightNumber));
  if (!rule) {
    return { available: false, reason: `第${nightNumber}夜你没有可选的主动夜间操作。` };
  }
  const usageKey = humanActionUsageKey(state, roleId, rule, "night");
  const usedCount = getHumanAbilityUsageCount(state, usageKey);
  const maxUses = Number.isFinite(rule.maxUses) ? rule.maxUses : null;
  if (maxUses !== null && usedCount >= maxUses) {
    return { available: false, reason: `${roleName} 的主动技能已用尽（${usedCount}/${maxUses}）。` };
  }
  if (state.scriptId === "tb" && roleId === TB.SLAYER && state.tb?.slayerUsedByIds?.includes(human.id)) {
    return { available: false, reason: "猎手每局只能开枪一次。" };
  }

  const options = playerTargetOptions(state, human, rule);
  const inputType = actionInputType(rule);

  if (actionNeedsPlayerOptions(inputType) && options.length === 0 && !(inputType === "charge-or-targets" && rule.modes?.some((entry) => entry.id === "charge"))) {
    return { available: false, reason: "当前没有可选择的目标。" };
  }

  const selectedPlan = currentHumanPlanForAction(state, "night", nightNumber, roleId);
  const selected = selectedPlan ? [...(selectedPlan.targetIds ?? [])] : [];

  return humanActionPayload(state, human, roleId, roleName, rule, options, selected, {
    nightNumber,
    phaseLabel: `第${nightNumber}夜`,
    selectedPlan,
  });
}

export function getHumanDayActionState(state) {
  const human = getHumanPlayer(state);
  if (!human) {
    return { available: false, reason: "未找到主视角玩家。" };
  }
  if (state.gameOver || state.phase === "ended") {
    return { available: false, reason: "对局已结束。" };
  }
  if (state.phase !== "day") {
    return { available: false, reason: "当前不是白天阶段。" };
  }
  if (!human.alive) {
    return { available: false, reason: "你已死亡，无法发动白天主动技能。" };
  }

  const roleId = getPerceivedRoleId(human);
  const roleName = getPerceivedRoleName(human) ?? human.roleName;
  const rule = normalizeActionRuleForState(state, roleId, HUMAN_DAY_RULES_BY_SCRIPT[state.scriptId]?.[roleId]);
  if (!rule) {
    return { available: false, reason: "你的角色当前没有白天主动技能。" };
  }
  const allowedStages = rule.allowedStages ?? ["private", "public", "nomination"];
  if (!allowedStages.includes(state.dayStage)) {
    return { available: false, reason: "当前阶段不能发动该白天技能。" };
  }
  const usageKey = humanActionUsageKey(state, roleId, rule, "day");
  const usedCount = getHumanAbilityUsageCount(state, usageKey);
  const maxUses = Number.isFinite(rule.maxUses) ? rule.maxUses : null;
  if (maxUses !== null && usedCount >= maxUses) {
    return { available: false, reason: `${roleName} 的主动技能已用尽（${usedCount}/${maxUses}）。` };
  }

  const options = playerTargetOptions(state, human, rule);
  const inputType = actionInputType(rule);
  if (actionNeedsPlayerOptions(inputType) && options.length === 0) {
    return { available: false, reason: "当前没有可选择的目标。" };
  }
  const selectedPlan = currentHumanPlanForAction(state, "day", state.day, roleId);

  return humanActionPayload(state, human, roleId, roleName, rule, options, [], {
    dayNumber: state.day,
    dayStage: state.dayStage,
    phaseLabel: `第${state.day}天`,
    selectedPlan,
  });
}

function createBMRState() {
  return {
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
    courtierPlannedRoleById: {},
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
    gossipStatementsByDay: {},
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
    lunaticFakeDemonRoleById: {},
    lunaticFakeMinionIdsById: {},
    lunaticFakeBluffRoleIdsById: {},
    lunaticLastTargetsById: {},
    abilityInterferenceCountLastNight: 0,
  };
}

function createSNVState() {
  return {
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
}

function uniqueStrings(list) {
  const unique = [];
  (Array.isArray(list) ? list : []).forEach((value) => {
    const safe = `${value ?? ""}`.trim();
    if (safe && !unique.includes(safe)) {
      unique.push(safe);
    }
  });
  return unique;
}

function validateTargetsForAction(action, targetIds, { exact = true } = {}) {
  const unique = uniqueStrings(targetIds);
  const min = Number.isFinite(action.minTargetCount) ? action.minTargetCount : action.targetCount ?? 0;
  const max = Number.isFinite(action.maxTargetCount) ? action.maxTargetCount : action.targetCount ?? min;
  if (exact && Number.isFinite(action.targetCount) && unique.length !== action.targetCount) {
    return {
      ok: false,
      reason: action.targetCount === 1 ? "请至少选择 1 名目标。" : `请恰好选择 ${action.targetCount} 名目标。`,
    };
  }
  if (!exact && unique.length < min) {
    return { ok: false, reason: min <= 0 ? "请选择行动方式。" : `请至少选择 ${min} 名目标。` };
  }
  if (!exact && unique.length > max) {
    return { ok: false, reason: `最多只能选择 ${max} 名目标。` };
  }
  const allowed = new Set(action.options.map((entry) => entry.id));
  if (unique.some((entry) => !allowed.has(entry))) {
    return { ok: false, reason: "所选目标不符合当前行动规则。" };
  }
  return { ok: true, targetIds: unique };
}

function validateRoleForAction(action, roleId) {
  const safeRoleId = `${roleId ?? ""}`.trim();
  const allowed = new Set((action.roleOptions ?? []).map((entry) => entry.id));
  if (!safeRoleId || !allowed.has(safeRoleId)) {
    return { ok: false, reason: "请选择一个符合当前规则的角色。" };
  }
  return { ok: true, roleId: safeRoleId };
}

function normalizeHumanActionPlan(action, input = {}) {
  const inputType = action.inputType ?? "player-target";
  const mode = `${input.mode ?? ""}`.trim() || (action.modes?.[0]?.id ?? "");
  const plan = {
    inputType,
    mode,
    targetIds: [],
    roleId: "",
    question: "",
    guesses: [],
  };

  if (inputType === "role") {
    const role = validateRoleForAction(action, input.roleId);
    if (!role.ok) {
      return role;
    }
    plan.roleId = role.roleId;
    return { ok: true, plan };
  }

  if (inputType === "player-role") {
    const targets = validateTargetsForAction(action, input.targetIds, { exact: true });
    if (!targets.ok) {
      return targets;
    }
    const role = validateRoleForAction(action, input.roleId);
    if (!role.ok) {
      return role;
    }
    plan.targetIds = targets.targetIds;
    plan.roleId = role.roleId;
    return { ok: true, plan };
  }

  if (inputType === "question") {
    const question = `${input.question ?? ""}`.trim();
    if (question.length < 2) {
      return { ok: false, reason: "请输入要询问 Storyteller 的是/否问题。" };
    }
    plan.question = question.slice(0, 220);
    return { ok: true, plan };
  }

  if (inputType === "guesses") {
    const guesses = (Array.isArray(input.guesses) ? input.guesses : [])
      .map((entry) => ({
        playerId: `${entry?.playerId ?? ""}`.trim(),
        roleId: `${entry?.roleId ?? ""}`.trim(),
      }))
      .filter((entry) => entry.playerId && entry.roleId);
    const min = Number.isFinite(action.minGuessCount) ? action.minGuessCount : 1;
    const max = Number.isFinite(action.maxGuessCount) ? action.maxGuessCount : 5;
    if (guesses.length < min) {
      return { ok: false, reason: `请至少填写 ${min} 组猜测。` };
    }
    if (guesses.length > max) {
      return { ok: false, reason: `最多只能填写 ${max} 组猜测。` };
    }
    const allowedPlayers = new Set(action.options.map((entry) => entry.id));
    const allowedRoles = new Set((action.roleOptions ?? []).map((entry) => entry.id));
    if (guesses.some((entry) => !allowedPlayers.has(entry.playerId) || !allowedRoles.has(entry.roleId))) {
      return { ok: false, reason: "猜测中包含不符合规则的玩家或角色。" };
    }
    if (new Set(guesses.map((entry) => entry.playerId)).size !== guesses.length) {
      return { ok: false, reason: "多组猜测中不要重复选择同一名玩家。" };
    }
    plan.guesses = guesses;
    return { ok: true, plan };
  }

  if (inputType === "charge-or-targets") {
    const modeIds = new Set((action.modes ?? []).map((entry) => entry.id));
    if (!mode || !modeIds.has(mode)) {
      return { ok: false, reason: "请选择今晚是行动还是蓄力。" };
    }
    plan.mode = mode;
    if (mode === "charge" || mode === "none") {
      plan.targetIds = [];
      return { ok: true, plan };
    }
    const targets = validateTargetsForAction(action, input.targetIds, { exact: false });
    if (!targets.ok) {
      return targets;
    }
    plan.targetIds = targets.targetIds;
    return { ok: true, plan };
  }

  const targets = validateTargetsForAction(action, input.targetIds, { exact: true });
  if (!targets.ok) {
    return targets;
  }
  plan.targetIds = targets.targetIds;
  return { ok: true, plan };
}

function describeActionPlan(state, action, plan) {
  const targetNames = (plan.targetIds ?? [])
    .map((targetId) => getPlayerById(state, targetId)?.name ?? targetId)
    .join(" / ");
  const roleName = plan.roleId ? getRoleById(state.scriptId, plan.roleId)?.name ?? plan.roleId : "";
  if (action.inputType === "role") {
    return roleName;
  }
  if (action.inputType === "player-role") {
    return `${targetNames} / ${roleName}`;
  }
  if (action.inputType === "question") {
    return `问题：“${plan.question}”`;
  }
  if (action.inputType === "guesses") {
    return `${plan.guesses.length} 组猜测`;
  }
  if (action.inputType === "charge-or-targets" && (plan.mode === "charge" || plan.mode === "none")) {
    return "不击杀，蓄力";
  }
  return targetNames || "无目标";
}

export function setHumanNightActionPlan(state, input = {}) {
  const action = getHumanNightActionState(state);
  if (!action.available) {
    return { ok: false, reason: action.reason };
  }

  const normalized = normalizeHumanActionPlan(action, input);
  if (!normalized.ok) {
    return normalized;
  }
  const plan = normalized.plan;

  state.humanNightPlan = {
    night: action.nightNumber,
    ...plan,
    roleId: action.roleId,
    selectedRoleId: plan.roleId,
  };

  const targetNames = describeActionPlan(state, action, plan);
  const human = getHumanPlayer(state);
  if (state.scriptId === "bmr" && action.roleId === BMR.COURTIER && plan.roleId) {
    state.bmr = state.bmr ?? createBMRState();
    state.bmr.courtierPlannedRoleById = state.bmr.courtierPlannedRoleById ?? {};
    state.bmr.courtierPlannedRoleById[human?.id] = plan.roleId;
    if (human) {
      human.courtierPlannedRoleId = plan.roleId;
    }
  }
  addLog(state, "night-plan", `[夜间预设] 第${action.nightNumber}夜 ${action.roleName} -> ${targetNames}`, {
    private: true,
    playerId: human?.id,
  });

  return {
    ok: true,
    nightNumber: action.nightNumber,
    roleName: action.roleName,
    targetIds: plan.targetIds,
    plan,
    targetNames,
  };
}

export function setHumanDayActionPlan(state, input = {}) {
  const action = getHumanDayActionState(state);
  if (!action.available) {
    return { ok: false, reason: action.reason };
  }
  const normalized = normalizeHumanActionPlan(action, input);
  if (!normalized.ok) {
    return normalized;
  }
  const plan = normalized.plan;
  state.humanDayPlan = {
    day: action.dayNumber,
    ...plan,
    roleId: action.roleId,
    selectedRoleId: plan.roleId,
  };
  const human = getHumanPlayer(state);
  if (state.scriptId === "snv" && action.roleId === SNV.JUGGLER) {
    state.snv = state.snv ?? createSNVState();
    state.snv.jugglerGuessesByDay[human.id] = {
      day: action.dayNumber,
      resolved: false,
      guesses: [...(plan.guesses ?? [])],
    };
    markHumanAbilityUsed(state, action.usageKey ?? action.roleId);
  } else if (state.scriptId === "bmr" && action.roleId === BMR.GOSSIP) {
    state.bmr = state.bmr ?? createBMRState();
    state.bmr.gossipStatementsByDay = state.bmr.gossipStatementsByDay ?? {};
    state.bmr.gossipStatementsByDay[action.dayNumber] = state.bmr.gossipStatementsByDay[action.dayNumber] ?? {};
    state.bmr.gossipStatementsByDay[action.dayNumber][human.id] = {
      day: action.dayNumber,
      text: plan.question,
      resolved: false,
    };
    markHumanAbilityUsed(state, action.usageKey ?? action.roleId);
  }
  const summary = describeActionPlan(state, action, plan);
  addLog(state, "day-plan", `[白天行动] 第${action.dayNumber}天 ${action.roleName} -> ${summary}`, {
    private: true,
    playerId: human?.id,
  });
  return {
    ok: true,
    dayNumber: action.dayNumber,
    roleName: action.roleName,
    targetIds: plan.targetIds,
    plan,
    targetNames: summary,
  };
}

function ensureGrimoireNotes(state) {
  state.grimoireNotes = state.grimoireNotes ?? {};
  state.players.forEach((player) => {
    state.grimoireNotes[player.id] = state.grimoireNotes[player.id] ?? {
      markedRoleId: "",
      reminders: [],
    };
  });
}

export function getGrimoireNote(state, playerId) {
  if (!state || !playerId) {
    return null;
  }
  ensureGrimoireNotes(state);
  return state.grimoireNotes[playerId] ?? null;
}

export function setGrimoireMarkedRole(state, { playerId, roleId }) {
  const player = getPlayerById(state, playerId);
  if (!player) {
    return { ok: false, reason: "目标玩家不存在。" };
  }
  ensureGrimoireNotes(state);
  const safeRoleId = roleId ? `${roleId}` : "";
  if (safeRoleId && !getRoleById(state.scriptId, safeRoleId)) {
    return { ok: false, reason: "标记角色不属于当前剧本。" };
  }
  const note = state.grimoireNotes[player.id];
  note.markedRoleId = safeRoleId;
  return { ok: true, markedRoleId: note.markedRoleId };
}

export function addGrimoireReminder(state, { playerId, reminder }) {
  const player = getPlayerById(state, playerId);
  if (!player) {
    return { ok: false, reason: "目标玩家不存在。" };
  }
  const text = `${reminder ?? ""}`.trim();
  if (!text) {
    return { ok: false, reason: "提醒内容不能为空。" };
  }
  ensureGrimoireNotes(state);
  const note = state.grimoireNotes[player.id];
  note.reminders = Array.isArray(note.reminders) ? note.reminders : [];
  if (!note.reminders.includes(text)) {
    note.reminders.push(text);
  }
  return { ok: true, reminders: [...note.reminders] };
}

export function removeGrimoireReminder(state, { playerId, reminder }) {
  const player = getPlayerById(state, playerId);
  if (!player) {
    return { ok: false, reason: "目标玩家不存在。" };
  }
  const text = `${reminder ?? ""}`.trim();
  ensureGrimoireNotes(state);
  const note = state.grimoireNotes[player.id];
  note.reminders = (note.reminders ?? []).filter((entry) => entry !== text);
  return { ok: true, reminders: [...note.reminders] };
}

export function clearGrimoireNote(state, { playerId }) {
  const player = getPlayerById(state, playerId);
  if (!player) {
    return { ok: false, reason: "目标玩家不存在。" };
  }
  ensureGrimoireNotes(state);
  state.grimoireNotes[player.id] = {
    markedRoleId: "",
    reminders: [],
  };
  return { ok: true };
}

function consumeHumanNightPlan(state, actor, { allowSelf = false, allowDead = false, minTargets = null, maxTargets = null } = {}) {
  if (!actor?.isHuman) {
    return null;
  }
  const plan = state.humanNightPlan;
  if (!plan) {
    return null;
  }
  const validRoleIds = new Set([getEffectiveRoleId(actor), getPerceivedRoleId(actor)].filter(Boolean));
  if (plan.night !== state.night || !validRoleIds.has(plan.roleId)) {
    return null;
  }

  const unique = uniqueStrings(plan.targetIds);
  const min = minTargets === null ? unique.length : minTargets;
  const max = maxTargets === null ? unique.length : maxTargets;
  if (unique.length < min || unique.length > max) {
    return null;
  }

  const resolved = unique.map((targetId) => getPlayerById(state, targetId));
  if (resolved.some((entry) => !entry)) {
    return null;
  }

  const valid = resolved.every((entry) => {
    if (!allowSelf && entry.id === actor.id) {
      return false;
    }
    if (!allowDead && !entry.alive) {
      return false;
    }
    return true;
  });

  if (!valid) {
    return null;
  }

  markHumanAbilityUsed(state, plan.roleId);
  state.humanNightPlan = null;
  return {
    ...plan,
    targetIds: unique,
    targets: resolved,
    role: plan.selectedRoleId ? getRoleById(state.scriptId, plan.selectedRoleId) : null,
  };
}

function consumeHumanNightPlanTargets(state, actor, targetCount, { allowSelf = false, allowDead = false } = {}) {
  const plan = consumeHumanNightPlan(state, actor, {
    allowSelf,
    allowDead,
    minTargets: targetCount,
    maxTargets: targetCount,
  });
  return plan?.targets ?? null;
}

function isAbilityBlocked(player, state = null) {
  if (!player) {
    return true;
  }
  if (player.roleId === TB.DRUNK || player.poisoned) {
    return true;
  }
  if (state?.bmr) {
    const roleId = getEffectiveRoleId(player);
    const untilNight = Number(state.bmr.suppressedByRoleId?.[roleId] ?? 0);
    if (untilNight >= state.night) {
      return true;
    }
    if (player.alive && state.bmr.minstrelAoeDrunkUntilNight >= state.night && roleId !== BMR.MINSTREL) {
      return true;
    }
  }
  return false;
}

function getSortedBySeat(players) {
  return [...players].sort((a, b) => a.seatIndex - b.seatIndex);
}

function registrationFor(target, rng = Math.random) {
  const result = {
    team: target.team,
    category: target.category,
  };

  if (target.roleId === TB.RECLUSE && rng() < 0.58) {
    result.team = "evil";
    result.category = rng() < 0.5 ? "minion" : "demon";
  }

  if (target.roleId === TB.SPY && rng() < 0.58) {
    result.team = "good";
    result.category = rng() < 0.5 ? "townsfolk" : "outsider";
  }

  return result;
}

function registersAsTeam(target, team, rng = Math.random) {
  return registrationFor(target, rng).team === team;
}

function registersAsCategory(target, category, rng = Math.random) {
  return registrationFor(target, rng).category === category;
}

function registersAsDemonForFortuneTeller(state, fortuneTeller, target, rng = Math.random) {
  if (!fortuneTeller || !target) {
    return false;
  }
  if (target.id === state.tb?.redHerringId && target.team === "good") {
    return true;
  }
  if (registersAsCategory(target, "demon", rng)) {
    return true;
  }
  return target.category === "demon";
}

function publicRoleLabelForGrimoire(player) {
  if (player.roleId === TB.DRUNK) {
    return `${player.roleName} -> ${player.apparentRoleName}`;
  }
  return player.roleName;
}

export function publicRoleLabel(state, player, grimoireView) {
  if (grimoireView) {
    return publicRoleLabelForGrimoire(player);
  }
  if (player.isHuman) {
    return getPerceivedRoleName(player) ?? player.roleName;
  }
  if (player.publicClaimRoleId) {
    const role = getAllRoles(state.scriptId).find((entry) => entry.id === player.publicClaimRoleId);
    return role ? `${role.name} (声明)` : "未知声明";
  }
  return "未知";
}

function applyThreatHeuristic(state) {
  state.players.forEach((player) => {
    let score = 0.5;
    if (player.tags.includes("info")) {
      score += 0.15;
    }
    if (player.roleId === TB.SLAYER || player.roleId === TB.MONK || player.roleId === TB.UNDERTAKER) {
      score += 0.08;
    }
    if (player.team === "evil") {
      score -= 0.14;
    }
    if (!player.alive) {
      score = 0;
    }
    player.threatScore = clamp(score, 0, 1);
  });
}

function initializeScriptSpecificSetupState(state, rng = Math.random) {
  if (state.scriptId === "bmr") {
    getScriptRuleHandlers("bmr").onSetup?.(createBMRRoleContext(state, rng));
  }
  if (state.scriptId === "snv") {
    getScriptRuleHandlers("snv").onSetup?.(createSNVRoleContext(state, rng));
  }
}

function fitPreferredRoleIntoBag(scriptId, roleBag, preferredHumanRoleId) {
  const requestedRoleId = `${preferredHumanRoleId ?? ""}`.trim();
  if (!requestedRoleId) {
    return roleBag;
  }

  const preferredRole = getRoleById(scriptId, requestedRoleId);
  if (!preferredRole) {
    return roleBag;
  }

  if (roleBag.some((entry) => entry.id === preferredRole.id)) {
    return roleBag;
  }

  const cloned = [...roleBag];
  let replaceIndex = cloned.findIndex((entry) => entry.category === preferredRole.category && entry.team === preferredRole.team);
  if (replaceIndex < 0) {
    replaceIndex = cloned.findIndex((entry) => entry.team === preferredRole.team);
  }
  if (replaceIndex < 0) {
    replaceIndex = 0;
  }
  cloned[replaceIndex] = preferredRole;
  return cloned;
}

function swapHumanToPreferredRole(players, preferredHumanRoleId) {
  const requestedRoleId = `${preferredHumanRoleId ?? ""}`.trim();
  if (!requestedRoleId) {
    return false;
  }
  const human = players.find((entry) => entry.isHuman);
  const holder = players.find((entry) => entry.roleId === requestedRoleId);
  if (!human || !holder) {
    return false;
  }
  if (human.id === holder.id) {
    return true;
  }

  const humanSnapshot = {
    roleId: human.roleId,
    roleName: human.roleName,
    roleIcon: human.roleIcon,
    apparentRoleId: human.apparentRoleId,
    apparentRoleName: human.apparentRoleName,
    apparentRoleIcon: human.apparentRoleIcon,
    apparentCategory: human.apparentCategory,
    apparentTeam: human.apparentTeam,
    category: human.category,
    team: human.team,
    tags: [...(human.tags ?? [])],
  };

  human.roleId = holder.roleId;
  human.roleName = holder.roleName;
  human.roleIcon = holder.roleIcon;
  human.apparentRoleId = holder.apparentRoleId;
  human.apparentRoleName = holder.apparentRoleName;
  human.apparentRoleIcon = holder.apparentRoleIcon;
  human.apparentCategory = holder.apparentCategory;
  human.apparentTeam = holder.apparentTeam;
  human.category = holder.category;
  human.team = holder.team;
  human.tags = [...(holder.tags ?? [])];

  holder.roleId = humanSnapshot.roleId;
  holder.roleName = humanSnapshot.roleName;
  holder.roleIcon = humanSnapshot.roleIcon;
  holder.apparentRoleId = humanSnapshot.apparentRoleId;
  holder.apparentRoleName = humanSnapshot.apparentRoleName;
  holder.apparentRoleIcon = humanSnapshot.apparentRoleIcon;
  holder.apparentCategory = humanSnapshot.apparentCategory;
  holder.apparentTeam = humanSnapshot.apparentTeam;
  holder.category = humanSnapshot.category;
  holder.team = humanSnapshot.team;
  holder.tags = [...(humanSnapshot.tags ?? [])];
  return true;
}

export function createNewGame({ scriptId, playerCount, preferredHumanRoleId = "" }, rng = Math.random) {
  const script = SCRIPT_MAP[scriptId];
  if (!script) {
    throw new Error("scriptId 无效");
  }

  const names = createPlayerNames(playerCount);
  const seats = shuffle(Array.from({ length: playerCount }, (_, idx) => idx), rng);
  const players = names.map((name, idx) => makePlayerBase(`p${idx + 1}`, name, seats[idx], idx === 0));
  applySeatNames(players);

  const setupResult = scriptId === "tb" ? drawSetupRolesTB(playerCount, rng) : drawSetupRolesStandard(scriptId, playerCount, rng);
  const fittedRoleBag = fitPreferredRoleIntoBag(scriptId, setupResult.roleBag, preferredHumanRoleId);
  const shuffledRoles = shuffle(fittedRoleBag, rng);
  players.forEach((player, idx) => {
    setRole(player, shuffledRoles[idx]);
  });
  const preferredApplied = swapHumanToPreferredRole(players, preferredHumanRoleId);

  const state = {
    id: `game-${Date.now()}`,
    scriptId,
    scriptName: script.name,
    scriptDescription: script.description,
    setupCounts: setupResult.counts,
    baseSetupCounts: setupResult.baseCounts,
    phase: "setup",
    day: 0,
    night: 0,
    players,
    logs: [],
    events: {
      claims: [],
      votes: [],
      executions: [],
      nightDeaths: [],
      infoPings: [],
      speeches: [],
    },
    aiAgents: {},
    utteranceArchive: createEmptyUtteranceArchive(),
    demonBluffs: [],
    gameOver: false,
    winner: null,
    winnerReason: null,
    grimoireView: false,
    dayStage: "none",
    dayStageMeta: {
      privateUsed: 0,
      privateLimit: 0,
      privateFollowUpUsed: 0,
      privateFollowUpLimit: 2,
      activePrivateTargetId: null,
      publicRounds: 0,
      privateTargets: [],
    },
    pendingHumanInfo: [],
    pendingStorytellerActions: [],
    humanNightPlan: null,
    humanAbilityUsage: {},
    grimoireNotes: {},
    narration: "",
    storyFlags: {
      evilRecognitionDone: false,
    },
    ruleMode: scriptId === "tb" ? "tb-full" : "simplified",
    tb: scriptId === "tb" ? createTBState() : null,
    bmr: scriptId === "bmr" ? createBMRState() : null,
    snv: scriptId === "snv" ? createSNVState() : null,
  };

  if (scriptId === "tb") {
    assignDrunkMask(state, rng);
  }
  ensureGrimoireNotes(state);

  state.demonBluffs = buildDemonBluffs(scriptId, shuffledRoles, rng);
  initializeScriptSpecificSetupState(state, rng);
  applyThreatHeuristic(state);

  const human = players.find((entry) => entry.isHuman);
  addLog(
    state,
    "setup",
    `新局已创建：${script.name}，${playerCount} 人。当前配置 ${state.setupCounts.townsfolk}/${state.setupCounts.outsider}/${state.setupCounts.minion}/${state.setupCounts.demon}。`
  );

  if (human) {
    const shownRole = getPerceivedRoleName(human) ?? getEffectiveRoleName(human) ?? human.roleName;
    addLog(state, "setup", `你的身份是 ${shownRole}。`, { private: true, playerId: human.id });
  }
  if (preferredHumanRoleId) {
    addLog(
      state,
      "setup",
      preferredApplied
        ? `测试模式：已指定你的身份为 ${getPerceivedRoleName(human) ?? getEffectiveRoleName(human) ?? human?.roleName ?? preferredHumanRoleId}。`
        : "测试模式：自选身份未命中，已回退随机发牌。",
      { private: true, playerId: human?.id }
    );
  }
  return state;
}

function finalizeWinner(state, winner, reason) {
  if (state.gameOver) {
    return state.winner;
  }
  state.gameOver = true;
  state.winner = winner;
  state.winnerReason = reason;
  state.phase = "ended";
  addLog(state, "game-end", `${winner === "good" ? "善良" : "邪恶"}阵营胜利：${reason}`);
  return state.winner;
}

function evaluateSpecialWins(state) {
  if (!state.tb) {
    return null;
  }
  const goodSpecial = state.tb.specialWinGood;
  const evilSpecial = state.tb.specialWinEvil;
  if (goodSpecial && evilSpecial) {
    return { winner: "good", reason: "特殊胜利条件同时触发，按规则善良优先。" };
  }
  if (goodSpecial) {
    return { winner: "good", reason: state.tb.specialWinReasons.join("；") || "触发善良特殊胜利。" };
  }
  if (evilSpecial) {
    return { winner: "evil", reason: state.tb.specialWinReasons.join("；") || "触发邪恶特殊胜利。" };
  }
  return null;
}

export function checkWin(state) {
  if (state.gameOver) {
    return state.winner;
  }

  const special = evaluateSpecialWins(state);
  if (special) {
    return finalizeWinner(state, special.winner, special.reason);
  }

  const alive = getAlivePlayers(state);
  const aliveDemons = alive.filter((entry) => entry.category === "demon");

  if (state.bmr?.mastermindPendingDay) {
    if (state.day < state.bmr.mastermindPendingDay) {
      return null;
    }
    if (state.day === state.bmr.mastermindPendingDay) {
      const hasExecutionToday = state.events.executions.some((entry) => entry.day === state.day);
      if (!hasExecutionToday) {
        return null;
      }
    }
  }

  if (aliveDemons.length === 0) {
    return finalizeWinner(state, "good", "恶魔已死亡。");
  }
  if (alive.length <= 2) {
    return finalizeWinner(state, "evil", "场上仅剩两名存活且善良未先获胜。");
  }
  return null;
}

function resetDayFlags(state) {
  state.players.forEach((player) => {
    player.nominatedToday = false;
    player.beenNominatedToday = false;
  });
  if (state.tb) {
    state.tb.executionOccurredToday = false;
  }
}

function markNightDeath(state, victim, reason, payload = {}) {
  if (!victim.alive) {
    return false;
  }
  victim.alive = false;
  state.events.nightDeaths.push({
    day: state.day,
    night: state.night,
    playerId: victim.id,
    roleId: victim.roleId,
    reason,
    ...payload,
  });
  recordDeathForAgents(state, {
    playerId: victim.id,
    roleId: victim.roleId,
    reason,
    phase: "night",
    payload,
  });
  addLog(state, "death", `${victim.name} 在夜晚死亡。`, { victimId: victim.id, reason });
  return true;
}

function markExecutionDeath(state, victim, reason, payload = {}) {
  if (!victim.alive) {
    return false;
  }
  victim.alive = false;
  state.events.executions.push({
    day: state.day,
    nomineeId: victim.id,
    roleId: victim.roleId,
    reason,
    ...payload,
  });
  recordDeathForAgents(state, {
    playerId: victim.id,
    roleId: victim.roleId,
    reason,
    phase: "day",
    payload,
  });
  addLog(state, "execution", `${victim.name} 被处决。`, { nomineeId: victim.id, reason });
  if (state.tb) {
    state.tb.executionOccurredToday = true;
    state.tb.executionRoleByDay[state.day] = victim.roleId;
  }
  return true;
}

function handleDemonDeath(state, demon, source, rng = Math.random) {
  if (state.tb) {
    getScriptRuleHandlers("tb").onDemonDeath?.(createTBRoleContext(state, rng), { demon, source });
    return;
  }
}

function maybeTriggerSaintLoss(state, player) {
  if (!state.tb) {
    return;
  }
  getScriptRuleHandlers("tb").onExecutionDeath?.(createTBRoleContext(state), { victim: player });
}

function chooseRandomAliveExcluding(state, excludedIds, rng = Math.random) {
  const blocked = new Set(Array.isArray(excludedIds) ? excludedIds : []);
  const pool = getAlivePlayers(state).filter((entry) => !blocked.has(entry.id));
  return chooseOne(pool, rng);
}

function processExecutionDeath(state, victim, reason, payload = {}, rng = Math.random) {
  const bmrPrevention = getScriptRuleHandlers("bmr").onBeforeExecutionDeath?.(createBMRRoleContext(state, rng), {
    victim,
    reason,
    payload,
  });
  if (bmrPrevention?.prevented) {
    return false;
  }

  if (!markExecutionDeath(state, victim, reason, payload)) {
    return false;
  }

  getScriptRuleHandlers("bmr").onAfterExecutionDeath?.(createBMRRoleContext(state, rng), { victim, reason, payload });
  getScriptRuleHandlers("snv").onAfterExecutionDeath?.(createSNVRoleContext(state, rng), { victim, reason, payload });

  if (victim.category === "demon") {
    handleDemonDeath(state, victim, reason, rng);
  }
  getScriptRuleHandlers("snv").onAfterDeath?.(createSNVRoleContext(state, rng), { victim, reason, payload, phase: "day" });
  getScriptRuleHandlers("bmr").onAfterDeath?.(createBMRRoleContext(state, rng), { victim, reason, payload, phase: "day" });
  getScriptRuleHandlers("snv").onAfterExecutionOutcome?.(createSNVRoleContext(state, rng), { victim, reason, payload });
  maybeTriggerSaintLoss(state, victim);
  return true;
}

function processNightDeath(state, victim, reason, payload = {}, rng = Math.random, options = {}) {
  const unstoppable = !!options.unstoppable;
  const bmrPrevention = getScriptRuleHandlers("bmr").onBeforeNightDeath?.(createBMRRoleContext(state, rng), {
    victim,
    reason,
    payload,
    unstoppable,
  });
  if (bmrPrevention?.prevented) {
    return false;
  }

  if (!markNightDeath(state, victim, reason, payload)) {
    return false;
  }
  getScriptRuleHandlers("bmr").onAfterNightDeath?.(createBMRRoleContext(state, rng), { victim, reason, payload });
  getScriptRuleHandlers("snv").onAfterNightDeath?.(createSNVRoleContext(state, rng), { victim, reason, payload });
  getScriptRuleHandlers("snv").onAfterDeath?.(createSNVRoleContext(state, rng), { victim, reason, payload, phase: "night" });
  getScriptRuleHandlers("bmr").onAfterDeath?.(createBMRRoleContext(state, rng), { victim, reason, payload, phase: "night" });
  if (victim.category === "demon") {
    handleDemonDeath(state, victim, reason, rng);
  }
  return true;
}

function startNightPhase(state) {
  state.phase = "night";
  state.dayStage = "none";
  state.dayStageMeta.privateUsed = 0;
  state.dayStageMeta.privateLimit = 0;
  state.dayStageMeta.privateFollowUpUsed = 0;
  state.dayStageMeta.privateFollowUpLimit = 2;
  state.dayStageMeta.activePrivateTargetId = null;
  state.dayStageMeta.publicRounds = 0;
  state.dayStageMeta.privateTargets = [];
  state.night += 1;
  state.narration = `第${state.night}夜降临。`;
  addLog(state, "night-start", state.narration);
  deliverEvilRecognitionFirstNight(state);

  if (state.humanNightPlan && state.humanNightPlan.night < state.night) {
    state.humanNightPlan = null;
  }

  state.players.forEach((player) => {
    player.poisoned = false;
  });

  if (state.tb) {
    state.tb.monkProtectedId = null;
    state.tb.poisonTargetTonightId = null;
  }
  if (state.bmr) {
    state.bmr.exorcisedDemonId = null;
    state.bmr.exorcistLastTargetById = state.bmr.exorcistLastTargetById ?? {};
    state.bmr.innkeeperProtectedIds = [];
    state.bmr.innkeeperDrunkId = null;
    state.bmr.sailorDrunkIds = [];
    state.bmr.devilsAdvocateProtectedId = null;
    state.bmr.teaLadyProtectedIds = [];
    state.bmr.pacifistSavedToday = false;
    state.bmr.godfatherBonusKillTonight = !!state.bmr.lastDayOutsiderExecuted;
    state.bmr.lastDayOutsiderExecuted = false;
    state.bmr.lastDayMinionExecuted = false;
    state.bmr.wokeTonightByPlayerId = {};
    state.bmr.abilityInterferenceCountLastNight = 0;
  }
  if (state.snv) {
    state.snv.witchCurses = {};
    state.snv.cerenovusForcedByPlayerId = {};
    state.snv.cerenovusEnforceDayByPlayerId = {};
    state.snv.pitHagTransforms = [];
    state.snv.vigormortisPoisonedIds = [];
    state.snv.noDashiiPoisonedIds = [];
    state.snv.abilityInterferenceCountLastNight = 0;
  }
}

export function privateChatLimitForDay(day, aliveCount) {
  const safeDay = Math.max(1, Number(day) || 1);
  return clamp(6 - safeDay, 1, 5);
}

function initDayStage(state) {
  const aliveCount = getAlivePlayers(state).length;
  const privateLimit = privateChatLimitForDay(state.day, aliveCount);
  state.dayStage = "private";
  state.dayStageMeta.privateUsed = 0;
  state.dayStageMeta.privateLimit = privateLimit;
  state.dayStageMeta.privateFollowUpUsed = 0;
  state.dayStageMeta.privateFollowUpLimit = 2;
  state.dayStageMeta.activePrivateTargetId = null;
  state.dayStageMeta.publicRounds = 0;
  state.dayStageMeta.privateTargets = [];
  addLog(state, "hint", `白天流程：先私聊（${privateLimit}次）-> 再公聊 -> 最后提名。`, {});
}

function emitSavantInfoForDay(state, rng = Math.random) {
  if (state.scriptId !== "snv") {
    return;
  }
  const vortoxAlive = state.players.some((entry) => entry.alive && getEffectiveRoleId(entry) === SNV.VORTOX);
  state.players
    .filter((entry) => entry.alive && getEffectiveRoleId(entry) === SNV.SAVANT)
    .forEach((savant) => {
      if (isAbilityBlocked(savant, state)) {
        return;
      }
      const aliveGood = state.players.filter((entry) => entry.alive && entry.team === "good").length;
      const aliveEvil = state.players.filter((entry) => entry.alive && entry.team === "evil").length;
      const statements = [
        {
          text: `当前存活善良人数是 ${aliveGood}。`,
          truth: true,
        },
        {
          text: `当前存活邪恶人数是 ${aliveEvil + 1}。`,
          truth: false,
        },
      ];
      let pair = shuffle(statements, rng).slice(0, 2);
      if (vortoxAlive) {
        pair = pair.map((entry, idx) => ({
          text: idx === 0 ? `当前存活善良人数是 ${aliveGood + 1}。` : `当前存活邪恶人数是 ${Math.max(0, aliveEvil - 1)}。`,
          truth: false,
        }));
      }
      addPrivateInfo(
        state,
        savant,
        `[第${state.day}天] Savant 信息：1) ${pair[0].text} 2) ${pair[1].text}（系统保证恰有一真一假，若涡流在场则可能全假）`
      );
    });
}

function transitionToDayPhase(state) {
  state.phase = "day";
  state.day += 1;
  state.narration = `天亮了。第 ${state.day} 天开始。`;

  state.players.forEach((player) => {
    player.poisoned = !!player.poisonedTomorrowDay;
    player.poisonedTomorrowDay = false;
  });

  resetDayFlags(state);
  initDayStage(state);
  addLog(state, "day-start", state.narration);
  emitSavantInfoForDay(state);
  if (state.snv) {
    state.snv.lastDayHadDemonVote = false;
    state.snv.lastDayHadMinionNomination = false;
    state.snv.dayDeathsByRoleId = {};
  }
}

export function consumePrivateChat(state, targetId) {
  if (state.phase !== "day" || state.dayStage !== "private" || state.gameOver) {
    return { ok: false, reason: "当前不在私聊阶段。" };
  }

  state.dayStageMeta.privateFollowUpLimit = state.dayStageMeta.privateFollowUpLimit ?? 2;
  state.dayStageMeta.privateFollowUpUsed = state.dayStageMeta.privateFollowUpUsed ?? 0;
  const activeTargetId = state.dayStageMeta.activePrivateTargetId ?? null;
  const isFollowUp = !!targetId && activeTargetId === targetId;
  if (isFollowUp) {
    const followUpLimit = state.dayStageMeta.privateFollowUpLimit ?? 2;
    const followUpUsed = state.dayStageMeta.privateFollowUpUsed ?? 0;
    if (followUpUsed >= followUpLimit) {
      return { ok: false, reason: `本轮私聊追问次数已用完（${followUpUsed}/${followUpLimit}）。` };
    }
    state.dayStageMeta.privateFollowUpUsed += 1;
    return {
      ok: true,
      followUp: true,
      followUpUsed: state.dayStageMeta.privateFollowUpUsed,
      followUpLimit,
      used: state.dayStageMeta.privateUsed ?? 0,
      limit: state.dayStageMeta.privateLimit ?? 0,
      remaining: Math.max(0, (state.dayStageMeta.privateLimit ?? 0) - (state.dayStageMeta.privateUsed ?? 0)),
    };
  }

  const limit = state.dayStageMeta.privateLimit ?? 0;
  const used = state.dayStageMeta.privateUsed ?? 0;
  if (used >= limit) {
    return { ok: false, reason: `今日私聊次数已用完（${used}/${limit}）。` };
  }

  state.dayStageMeta.privateUsed += 1;
  state.dayStageMeta.activePrivateTargetId = targetId ?? null;
  state.dayStageMeta.privateFollowUpUsed = 0;
  if (targetId) {
    state.dayStageMeta.privateTargets = state.dayStageMeta.privateTargets ?? [];
    state.dayStageMeta.privateTargets.push(targetId);
  }

  return {
    ok: true,
    followUp: false,
    followUpUsed: 0,
    followUpLimit: state.dayStageMeta.privateFollowUpLimit ?? 2,
    used: state.dayStageMeta.privateUsed,
    limit,
    remaining: Math.max(0, limit - state.dayStageMeta.privateUsed),
  };
}

export function markPublicDiscussionRound(state) {
  if (state.phase !== "day" || state.dayStage !== "public" || state.gameOver) {
    return false;
  }
  state.dayStageMeta.publicRounds = (state.dayStageMeta.publicRounds ?? 0) + 1;
  return true;
}

export function advanceDayStage(state, targetStage = null) {
  if (state.phase !== "day" || state.gameOver) {
    return { ok: false, reason: "当前不在白天流程。" };
  }

  const order = ["private", "public", "nomination"];
  const current = order.includes(state.dayStage) ? state.dayStage : "private";
  const currentIdx = order.indexOf(current);
  const next = targetStage ?? order[Math.min(currentIdx + 1, order.length - 1)];
  const nextIdx = order.indexOf(next);

  if (nextIdx < 0) {
    return { ok: false, reason: "目标阶段无效。" };
  }
  if (nextIdx <= currentIdx) {
    return { ok: false, reason: "无法回退或重复进入当前阶段。" };
  }
  if (nextIdx - currentIdx > 1) {
    return { ok: false, reason: "请按顺序推进：私聊 -> 公聊 -> 提名。" };
  }
  if (current === "public" && next === "nomination" && (state.dayStageMeta.publicRounds ?? 0) <= 0) {
    return { ok: false, reason: "请至少进行一轮公聊，再进入提名。" };
  }

  state.dayStage = next;
  if (next === "public") {
    addLog(state, "phase", "私聊阶段结束，进入公聊阶段。", {});
  } else if (next === "nomination") {
    addLog(state, "phase", "公聊阶段结束，进入提名阶段。", {});
  }
  return { ok: true, stage: next };
}

function aliveNeighbors(state, player) {
  const alive = getSortedBySeat(getAlivePlayers(state));
  if (alive.length <= 1) {
    return [];
  }
  const idx = alive.findIndex((entry) => entry.id === player.id);
  if (idx === -1) {
    return [];
  }
  const left = alive[(idx - 1 + alive.length) % alive.length];
  const right = alive[(idx + 1) % alive.length];
  return [left, right];
}

function seatNeighbors(state, player, aliveOnly = false) {
  const pool = aliveOnly ? getAlivePlayers(state) : state.players;
  const sorted = getSortedBySeat(pool);
  if (sorted.length <= 1) {
    return [];
  }
  const idx = sorted.findIndex((entry) => entry.id === player.id);
  if (idx < 0) {
    return [];
  }
  const left = sorted[(idx - 1 + sorted.length) % sorted.length];
  const right = sorted[(idx + 1) % sorted.length];
  return [left, right];
}

function nearestAliveTownsfolkByDirection(state, source, direction = 1) {
  const sorted = getSortedBySeat(state.players);
  if (!source || sorted.length <= 1) {
    return null;
  }
  const start = sorted.findIndex((entry) => entry.id === source.id);
  if (start < 0) {
    return null;
  }
  let cursor = start;
  for (let step = 0; step < sorted.length - 1; step += 1) {
    cursor = (cursor + direction + sorted.length) % sorted.length;
    const candidate = sorted[cursor];
    if (candidate.id === source.id) {
      break;
    }
    if (candidate.alive && candidate.category === "townsfolk") {
      return candidate;
    }
  }
  return null;
}

function applyVigormortisNeighborPoison(state, minion, demonId = null) {
  if (!state.snv || !minion) {
    return [];
  }
  const neighbors = seatNeighbors(state, minion, false).filter(
    (entry, idx, arr) => entry.alive && entry.category === "townsfolk" && arr.findIndex((probe) => probe.id === entry.id) === idx
  );
  neighbors.forEach((neighbor) => {
    neighbor.poisoned = true;
    neighbor.poisonedTomorrowDay = true;
    if (!state.snv.vigormortisPoisonedIds.includes(neighbor.id)) {
      state.snv.vigormortisPoisonedIds.push(neighbor.id);
    }
    addAbilityInterference(state, 1);
  });
  if (neighbors.length > 0) {
    addLog(state, "night-effect", "Vigormortis 使被击杀爪牙的邻近镇民中毒。", {
      demonId,
      minionId: minion.id,
      targetIds: neighbors.map((entry) => entry.id),
    });
  }
  return neighbors;
}

function addAbilityInterference(state, amount = 1) {
  const delta = Math.max(0, Number(amount) || 0);
  if (delta <= 0) {
    return;
  }
  if (state.bmr) {
    state.bmr.abilityInterferenceCountLastNight =
      Number(state.bmr.abilityInterferenceCountLastNight ?? 0) + delta;
  }
  if (state.snv) {
    state.snv.abilityInterferenceCountLastNight =
      Number(state.snv.abilityInterferenceCountLastNight ?? 0) + delta;
  }
}

function markWokeTonight(state, player, reason = "ability") {
  if (!state?.bmr || !player?.id) {
    return;
  }
  state.bmr.wokeTonightByPlayerId[player.id] = reason;
}

function randomRoleFromCategory(state, category, rng = Math.random) {
  const script = SCRIPT_MAP[state.scriptId];
  const pool = script.roles[category] ?? [];
  return chooseOne(pool, rng)?.id ?? null;
}

function randomRoleAny(state, rng = Math.random) {
  return chooseOne(getAllRoles(state.scriptId), rng)?.id ?? null;
}

function maybeDistortRoleId(state, roleId, category, blocked, rng = Math.random) {
  if (!blocked) {
    return roleId;
  }
  if (category) {
    return randomRoleFromCategory(state, category, rng) ?? roleId;
  }
  return randomRoleAny(state, rng) ?? roleId;
}

function createTBRoleContext(state, rng = Math.random) {
  return {
    state,
    rng,
    addLog,
    addPrivateInfo,
    aliveNeighbors,
    applyThreatHeuristic,
    checkWin,
    chooseOne: (list) => chooseOne(list, rng),
    clamp,
    consumeHumanNightPlan,
    consumeHumanNightPlanTargets,
    enqueueStorytellerAction,
    playerChoiceOptions,
    getAlivePlayers,
    getAllRoles,
    getEffectiveRoleId,
    getPlayerById,
    getRoleById,
    getRoleNameById,
    getSortedBySeat,
    isAbilityBlocked: (player) => isAbilityBlocked(player, state),
    processExecutionDeath,
    processNightDeath,
    randomInt: (min, max) => randomInt(min, max, rng),
    registersAsDemonForFortuneTeller: (gameState, fortuneTeller, target) =>
      registersAsDemonForFortuneTeller(gameState, fortuneTeller, target, rng),
    registersAsCategory: (target, category) => registersAsCategory(target, category, rng),
    registersAsTeam: (target, team) => registersAsTeam(target, team, rng),
    sample: (list, amount) => sample(list, amount, rng),
    setRole,
    shuffle: (list) => shuffle(list, rng),
    startNightPhase,
    transitionToDayPhase,
  };
}

function createBMRRoleContext(state, rng = Math.random) {
  return {
    state,
    rng,
    addAbilityInterference,
    addLog,
    addPrivateInfo,
    aliveNeighbors,
    chooseOne: (list) => chooseOne(list, rng),
    chooseRandomAliveExcluding: (gameState, excludedIds) => chooseRandomAliveExcluding(gameState, excludedIds, rng),
    consumeHumanNightPlan,
    consumeHumanNightPlanTargets,
    enqueueStorytellerAction,
    finalizeWinner,
    getAliveDemons,
    getAlivePlayers,
    getAllRoles,
    getEffectiveRoleId,
    getNightOrderRoleIds,
    getPlayerById,
    getRoleById,
    playerChoiceOptions,
    isAbilityBlocked: (player) => isAbilityBlocked(player, state),
    isRoleNightWindowOpen,
    markWokeTonight,
    pickNightTargets: (gameState, actor, targetCount, options = {}) =>
      pickNightTargets(gameState, actor, targetCount, options, rng),
    processNightDeath,
    sample: (list, amount) => sample(list, amount, rng),
  };
}

function createSNVRoleContext(state, rng = Math.random) {
  return {
    state,
    rng,
    addAbilityInterference,
    addLog,
    addPrivateInfo,
    applyVigormortisNeighborPoison,
    checkWin,
    chooseOne: (list) => chooseOne(list, rng),
    chooseRandomAliveExcluding: (gameState, excludedIds) => chooseRandomAliveExcluding(gameState, excludedIds, rng),
    consumeHumanNightPlan,
    enqueueStorytellerAction,
    finalizeWinner,
    getAliveDemons,
    getAlivePlayers,
    getAllRoles,
    getEffectiveRoleId,
    getPlayerById,
    getRoleById,
    playerChoiceOptions,
    getTownsfolkRoles: (scriptId) => SCRIPT_MAP[scriptId]?.roles?.townsfolk ?? [],
    isAbilityBlocked: (player) => isAbilityBlocked(player, state),
    isRoleNightWindowOpen,
    nearestAliveTownsfolkByDirection,
    pickNightTargets: (gameState, actor, targetCount, options = {}) =>
      pickNightTargets(gameState, actor, targetCount, options, rng),
    processExecutionDeath,
    processNightDeath,
    sample: (list, amount) => sample(list, amount, rng),
    setRole,
    shuffle: (list) => shuffle(list, rng),
    swapRolesByRoleId,
  };
}

function runNightTB(state, rng = Math.random) {
  const runner = getNightRunner("tb");
  if (!runner) {
    throw new Error("TB 夜晚角色模块未注册。");
  }
  runner(createTBRoleContext(state, rng));
}

function applyGoonReaction(state, actor, target) {
  if (!state.bmr || !actor || !target || !target.alive) {
    return;
  }
  if (getEffectiveRoleId(target) !== BMR.GOON) {
    return;
  }
  if (state.bmr.goonTriggeredNight === state.night) {
    return;
  }
  if (actor.id === target.id) {
    return;
  }
  state.bmr.goonTriggeredNight = state.night;
  target.team = actor.team;
  actor.poisoned = true;
  actor.poisonedTomorrowDay = true;
  addAbilityInterference(state, 1);
  if (actor.category === "demon") {
    state.bmr.exorcisedDemonId = actor.id;
  }
  addLog(state, "night-effect", `Goon 被 ${actor.name} 选中后转换了阵营，并使其能力失效。`, {
    actorId: actor.id,
    goonId: target.id,
    team: target.team,
  });
}

function pickNightTargets(
  state,
  actor,
  targetCount,
  { allowSelf = false, allowDead = false, preferredPool = null } = {},
  rng = Math.random
) {
  if (!actor || targetCount <= 0) {
    return [];
  }

  if (actor.isHuman) {
    const planned = consumeHumanNightPlanTargets(state, actor, targetCount, {
      allowSelf,
      allowDead,
    });
    if (planned && planned.length > 0) {
      return planned;
    }
  }

  const basePool = Array.isArray(preferredPool)
    ? preferredPool
    : state.players.filter((entry) => (allowDead || entry.alive) && (allowSelf || entry.id !== actor.id));
  if (basePool.length === 0) {
    return [];
  }
  const selected = sample(basePool, Math.min(targetCount, basePool.length), rng);
  selected.forEach((target) => applyGoonReaction(state, actor, target));
  return selected;
}

function runBMRNightActionsSimplified(state, rng = Math.random) {
  const runner = getNightRunner("bmr");
  if (!runner) {
    throw new Error("BMR 夜晚角色模块未注册。");
  }
  runner(createBMRRoleContext(state, rng));
}

function swapRolesByRoleId(state, a, b) {
  if (!a || !b) {
    return false;
  }
  const roleA = getRoleById(state.scriptId, a.roleId);
  const roleB = getRoleById(state.scriptId, b.roleId);
  if (!roleA || !roleB) {
    return false;
  }
  setRole(a, roleB);
  setRole(b, roleA);
  return true;
}

function runSNVNightActionsSimplified(state, rng = Math.random) {
  const runner = getNightRunner("snv");
  if (!runner) {
    throw new Error("SnV night role module is not registered.");
  }
  runner(createSNVRoleContext(state, rng));
}

function choosePoisonTargetsSimplified(state, rng = Math.random) {
  const poisoners = state.players.filter(
    (entry) =>
      entry.alive &&
      entry.tags.includes("poisonSource") &&
      entry.team === "evil" &&
      entry.category !== "demon" &&
      !isAbilityBlocked(entry, state)
  );

  poisoners.forEach((poisoner) => {
    const options = state.players.filter((entry) => entry.id !== poisoner.id && entry.alive);
    if (options.length === 0) {
      return;
    }

    const planned = consumeHumanNightPlanTargets(state, poisoner, 1, {
      allowSelf: false,
      allowDead: false,
    });
    const target = planned?.[0] ?? sample(options, 1, rng)[0];
    if (!target) {
      return;
    }

    target.poisoned = true;
    target.poisonedTomorrowDay = true;
    addLog(state, "night-effect", "夜间出现中毒干扰（目标未公开）。", {
      by: poisoner.id,
      targetId: target.id,
    });
  });
}

function chooseDemonVictimsSimplified(state, rng = Math.random) {
  const aliveDemons = getAliveDemons(state);
  if (aliveDemons.length === 0) {
    return { demon: null, victims: [] };
  }

  const demon = aliveDemons[0];
  if (state.scriptId === "bmr") {
    return { demon, victims: [] };
  }

  if (state.bmr?.exorcisedDemonId && state.bmr.exorcisedDemonId === demon.id) {
    return { demon, victims: [] };
  }

  const killCount = 1;

  const planned = consumeHumanNightPlanTargets(state, demon, killCount, {
    allowSelf: false,
    allowDead: false,
  });
  if (planned?.length) {
    return { demon, victims: planned.slice(0, killCount) };
  }

  const demonRole = getEffectiveRoleId(demon);
  if (!isRoleNightWindowOpen(state, demonRole, state.night)) {
    return { demon, victims: [] };
  }
  const fallback = state.players.filter((entry) => entry.alive && entry.id !== demon.id);
  let victims = state.players.filter((entry) => entry.alive && entry.team === "good");
  if (demonRole === SNV.VIGORMORTIS) {
    victims = fallback;
  } else if (demonRole === SNV.FANG_GU && !state.snv?.fangGuJumpUsed) {
    const outsiders = fallback.filter((entry) => entry.category === "outsider" && entry.team === "good");
    if (outsiders.length > 0) {
      victims = outsiders;
    } else if (victims.length === 0) {
      victims = fallback;
    }
  } else if (victims.length === 0) {
    victims = fallback;
  }
  if (victims.length === 0) {
    return { demon, victims: [] };
  }

  const weighted = victims
    .map((entry) => ({ player: entry, weight: clamp(0.25 + (entry.threatScore ?? 0.5), 0.1, 1.2) }))
    .sort((a, b) => b.weight - a.weight);

  const pickTopHalf = weighted.slice(0, Math.max(1, Math.ceil(weighted.length / 2)));
  return { demon, victims: sample(pickTopHalf.map((entry) => entry.player), killCount, rng) };
}

function applyProtectionSimplified(state, victim, rng = Math.random) {
  if (state.bmr?.innkeeperProtectedIds?.includes(victim.id)) {
    return true;
  }
  return false;
}

function distortNumericInfo(truth, min, max, shouldDistort, rng = Math.random) {
  const boundedTruth = clamp(Math.round(truth), min, max);
  if (!shouldDistort) {
    return boundedTruth;
  }
  const choices = [];
  for (let idx = min; idx <= max; idx += 1) {
    if (idx !== boundedTruth) {
      choices.push(idx);
    }
  }
  return chooseOne(choices, rng) ?? boundedTruth;
}

function generateInfoClueSimplified(state, actor, forcedTargets = null, rng = Math.random, forcedPlan = null) {
  const candidates = state.players.filter((entry) => entry.id !== actor.id);
  if (candidates.length === 0) {
    return null;
  }

  const targets = Array.isArray(forcedTargets) && forcedTargets.length > 0 ? forcedTargets : [sample(candidates, 1, rng)[0]];
  const target = targets[0];
  if (!target) {
    return null;
  }

  const blocked = isAbilityBlocked(actor, state);
  const roleId = getEffectiveRoleId(actor);
  const vortoxActive =
    state.scriptId === "snv" &&
    state.players.some((entry) => entry.alive && getEffectiveRoleId(entry) === SNV.VORTOX);

  if (state.scriptId === "bmr" && (roleId === BMR.GRANDMOTHER || roleId === BMR.CHAMBERMAID)) {
    return null;
  }

  if (state.scriptId === "snv" && roleId === SNV.CLOCKMAKER) {
    const demons = state.players.filter((entry) => entry.category === "demon");
    const minions = state.players.filter((entry) => entry.category === "minion");
    if (demons.length === 0 || minions.length === 0) {
      return null;
    }
    let shortest = state.players.length;
    demons.forEach((demon) => {
      minions.forEach((minion) => {
        const diff = Math.abs(demon.seatIndex - minion.seatIndex);
        const distance = Math.min(diff, state.players.length - diff);
        shortest = Math.min(shortest, distance);
      });
    });
    const reported = distortNumericInfo(shortest, 0, state.players.length, blocked || vortoxActive, rng);
    return {
      actorId: actor.id,
      truth: shortest,
      reported,
      polluted: blocked || vortoxActive,
      text: `你看到的恶魔与爪牙最短距离为 ${reported}。`,
    };
  }

  if (state.scriptId === "snv" && roleId === SNV.MATHEMATICIAN) {
    const truth = Number(state.snv?.abilityInterferenceCountLastNight ?? 0);
    const reported = distortNumericInfo(truth, 0, state.players.length, blocked || vortoxActive, rng);
    state.snv.mathematicianPreviousCount = truth;
    return {
      actorId: actor.id,
      truth,
      reported,
      polluted: blocked || vortoxActive,
      text: `从上一个黎明到现在，共有 ${reported} 次能力受外部影响而失效。`,
    };
  }

  if (state.scriptId === "snv" && roleId === SNV.FLOWERGIRL) {
    const truth = !!state.snv?.lastDayHadDemonVote;
    const reported = blocked || vortoxActive ? !truth : truth;
    return {
      actorId: actor.id,
      truth,
      reported,
      polluted: blocked || vortoxActive,
      text: `今天白天恶魔${reported ? "投过票" : "没有投票"}。`,
    };
  }

  if (state.scriptId === "snv" && roleId === SNV.TOWN_CRIER) {
    const truth = !!state.snv?.lastDayHadMinionNomination;
    const reported = blocked || vortoxActive ? !truth : truth;
    return {
      actorId: actor.id,
      truth,
      reported,
      polluted: blocked || vortoxActive,
      text: `今天白天爪牙${reported ? "发起过提名" : "没有发起提名"}。`,
    };
  }

  if (state.scriptId === "snv" && roleId === SNV.ORACLE) {
    const deadEvil = state.players.filter((entry) => !entry.alive && entry.team === "evil").length;
    const reported = distortNumericInfo(deadEvil, 0, state.players.length, blocked || vortoxActive, rng);
    return {
      actorId: actor.id,
      truth: deadEvil,
      reported,
      polluted: blocked || vortoxActive,
      text: `你看到当前死亡玩家中有 ${reported} 人属于邪恶阵营。`,
    };
  }

  if (state.scriptId === "snv" && roleId === SNV.SAVANT) {
    return null;
  }

  if (state.scriptId === "snv" && roleId === SNV.JUGGLER) {
    const guessState = state.snv?.jugglerGuessesByDay?.[actor.id];
    if (!guessState || guessState.resolved || state.night < 2) {
      return null;
    }
    const truth = (guessState.guesses ?? []).filter((entry) => {
      const player = getPlayerById(state, entry.playerId);
      return player && player.roleId === entry.roleId;
    }).length;
    const reported = distortNumericInfo(truth, 0, 5, blocked || vortoxActive, rng);
    guessState.resolved = true;
    return {
      actorId: actor.id,
      truth,
      reported,
      polluted: blocked || vortoxActive,
      text: `你的 Juggler 猜测中，正确数量为 ${reported}。`,
    };
  }

  if (state.scriptId === "snv" && roleId === SNV.DREAMER) {
    const truthRole = getRoleNameById(state, target.roleId);
    const oppositePool = getAllRoles(state.scriptId).filter((entry) =>
      target.team === "evil" ? entry.team === "good" : entry.team === "evil"
    );
    const fakeRole = chooseOne(oppositePool, rng)?.name ?? "未知";
    const pair = shuffle([truthRole, fakeRole], rng);
    let left = pair[0];
    let right = pair[1];
    if (blocked || vortoxActive) {
      const noisyA = chooseOne(getAllRoles(state.scriptId), rng)?.name ?? left;
      const noisyB = chooseOne(getAllRoles(state.scriptId), rng)?.name ?? right;
      left = noisyA;
      right = noisyB;
    }
    return {
      actorId: actor.id,
      targetId: target.id,
      truth: truthRole,
      reported: `${left}/${right}`,
      polluted: blocked || vortoxActive,
      text: `${target.name} 在你的梦境中对应两个身份：${left} / ${right}。`,
    };
  }

  if (state.scriptId === "snv" && roleId === SNV.SEAMSTRESS && targets.length >= 2) {
    if (state.snv?.seamstressUsedByIds?.includes(actor.id)) {
      return null;
    }
    const truth = targets[0].team === targets[1].team;
    let report = truth;
    if (blocked || vortoxActive) {
      report = !truth;
    }
    state.snv.seamstressUsedByIds.push(actor.id);
    return {
      actorId: actor.id,
      targetId: target.id,
      targetIds: targets.map((entry) => entry.id),
      truth,
      reported: report,
      polluted: blocked || vortoxActive,
      text: `${targets[0].name} 与 ${targets[1].name} 在你的线索中${report ? "同阵营" : "不同阵营"}。`,
    };
  }

  if (state.scriptId === "snv" && roleId === SNV.ARTIST) {
    if (state.snv?.artistUsedByIds?.includes(actor.id)) {
      return null;
    }
    const question = `${forcedPlan?.question ?? ""}`.trim();
    const lowerQuestion = question.toLowerCase();
    let truth = target.team === "evil";
    if (/(恶魔|demon)/i.test(question)) {
      truth = state.players.some((entry) => lowerQuestion.includes(`${entry.seatIndex + 1}`) && entry.category === "demon");
    } else if (/(爪牙|minion)/i.test(question)) {
      truth = state.players.some((entry) => lowerQuestion.includes(`${entry.seatIndex + 1}`) && entry.category === "minion");
    } else if (/(邪恶|evil|坏人)/i.test(question)) {
      truth = state.players.some((entry) => lowerQuestion.includes(`${entry.seatIndex + 1}`) && entry.team === "evil");
    } else if (/(存活|活着|alive)/i.test(question)) {
      truth = state.players.some((entry) => lowerQuestion.includes(`${entry.seatIndex + 1}`) && entry.alive);
    }
    let report = truth;
    if (blocked || vortoxActive) {
      report = !truth;
    }
    state.snv.artistUsedByIds.push(actor.id);
    return {
      actorId: actor.id,
      targetId: target.id,
      truth,
      reported: report,
      polluted: blocked || vortoxActive,
      text: question
        ? `你询问“${question}”，得到答案：${report ? "是" : "否"}。`
        : `你的问题得到答案：${report ? "是" : "否"}。`,
    };
  }

  if (targets.length >= 2) {
    const truth = targets[0].team === targets[1].team;
    let report = blocked ? (rng() < 0.72 ? !truth : truth) : (rng() < 0.86 ? truth : !truth);
    if (vortoxActive && actor.team === "good") {
      report = !report;
    }
    return {
      actorId: actor.id,
      targetId: target.id,
      targetIds: targets.map((entry) => entry.id),
      truth,
      reported: report,
      polluted: blocked,
      text: `${targets[0].name} 与 ${targets[1].name} 在你的视角中看起来${report ? "同阵营" : "不同阵营"}。`,
    };
  }

  const truth = target.team === "evil";
  let report = blocked ? (rng() < 0.75 ? !truth : truth) : (rng() < 0.85 ? truth : !truth);
  if (vortoxActive && actor.team === "good") {
    report = !report;
  }
  return {
    actorId: actor.id,
    targetId: target.id,
    truth,
    reported: report,
    polluted: blocked,
    text: `${target.name} 在你的视角中看起来更像${report ? "邪恶" : "善良"}。`,
  };
}

function resolveEndOfDayBMRTriggers(state, rng = Math.random) {
  getScriptRuleHandlers("bmr").onEndOfDay?.(createBMRRoleContext(state, rng));
}

function resolveEndOfDaySnVPenalties(state, rng = Math.random) {
  getScriptRuleHandlers("snv").onEndOfDay?.(createSNVRoleContext(state, rng));
}

function runNightSimplified(state, rng = Math.random) {
  if (state.gameOver) {
    return;
  }

  resolveEndOfDayBMRTriggers(state, rng);
  resolveEndOfDaySnVPenalties(state, rng);
  checkWin(state);
  if (state.gameOver) {
    return;
  }

  startNightPhase(state);
  runBMRNightActionsSimplified(state, rng);
  runSNVNightActionsSimplified(state, rng);
  choosePoisonTargetsSimplified(state, rng);
  const deathsBeforeDemon = state.events.nightDeaths.length;

  const { demon, victims } = chooseDemonVictimsSimplified(state, rng);
  const demonRole = demon ? getEffectiveRoleId(demon) : null;
  if (victims.length > 0) {
    victims.forEach((victim) => {
      if (!victim?.alive) {
        return;
      }

      if (
        state.snv &&
        demon &&
        demonRole === SNV.FANG_GU &&
        !state.snv.fangGuJumpUsed &&
        victim.category === "outsider" &&
        victim.team === "good"
      ) {
        const fangGuRole = getRoleById("snv", SNV.FANG_GU);
        if (fangGuRole) {
          setRole(victim, fangGuRole);
          state.snv.fangGuJumpUsed = true;
          processNightDeath(state, demon, "fang-gu-jump", { by: victim.id }, rng);
          addLog(state, "night-effect", "Fang Gu 命中外来者并完成跳转。", {
            from: demon.id,
            to: victim.id,
          });
          return;
        }
      }

      const blocked = applyProtectionSimplified(state, victim, rng);
      if (!blocked) {
        const died = processNightDeath(state, victim, "demon-kill", { by: demon?.id ?? null }, rng);
        if (
          died &&
          state.snv &&
          demon &&
          demonRole === SNV.VIGORMORTIS &&
          victim.category === "minion"
        ) {
          if (!state.snv.vigormortisEmpoweredMinionIds.includes(victim.id)) {
            state.snv.vigormortisEmpoweredMinionIds.push(victim.id);
          }
          applyVigormortisNeighborPoison(state, victim, demon.id);
        }
      } else {
        addLog(state, "night-effect", "夜间似乎发生了保护效果，无人死亡。", { protectedId: victim.id });
      }
    });
  }
  if (state.events.nightDeaths.length === deathsBeforeDemon) {
    addLog(state, "night-effect", "夜晚没有发生可见死亡。", {});
  }

  const infoActors = state.players
    .filter((entry) => entry.alive && entry.tags.includes("info") && entry.team === "good")
    .sort((a, b) => {
      const aRole = getEffectiveRoleId(a);
      const bRole = getEffectiveRoleId(b);
      const aOrder = getNightOrderIndex(state, aRole, state.night);
      const bOrder = getNightOrderIndex(state, bRole, state.night);
      const aInOrder = Number.isFinite(aOrder);
      const bInOrder = Number.isFinite(bOrder);
      if (aInOrder && bInOrder && aOrder !== bOrder) {
        return aOrder - bOrder;
      }
      if (aInOrder && !bInOrder) {
        return -1;
      }
      if (!aInOrder && bInOrder) {
        return 1;
      }
      return a.seatIndex - b.seatIndex;
    });
  infoActors.forEach((actor) => {
    const roleId = getEffectiveRoleId(actor);
    const minInfoNight = PASSIVE_INFO_MIN_NIGHT[roleId] ?? 1;
    if (state.night < minInfoNight) {
      return;
    }
    const firstNightOnly = actor.tags.includes("firstNight") && state.night > 1;
    if (firstNightOnly) {
      return;
    }
    const recurring = actor.tags.includes("recurring");
    const oneShotNightFlexible =
      state.scriptId === "snv" &&
      (roleId === SNV.SEAMSTRESS || roleId === SNV.ARTIST || roleId === SNV.JUGGLER);
    if (!recurring && state.night > 1 && !oneShotNightFlexible) {
      return;
    }

    const rule = getHumanNightRule(state, roleId, state.night);
    let plannedTargets = null;
    let plannedPlan = null;
    if (actor.isHuman && rule) {
      const inputType = actionInputType(rule);
      if (inputType === "question" || inputType === "role") {
        plannedPlan = consumeHumanNightPlan(state, actor, {
          allowSelf: !!rule.allowSelf,
          allowDead: !!rule.allowDead,
          minTargets: 0,
          maxTargets: 0,
        });
        plannedTargets = plannedPlan?.targets ?? null;
      } else {
        plannedTargets = consumeHumanNightPlanTargets(state, actor, rule.targetCount, {
          allowSelf: !!rule.allowSelf,
          allowDead: !!rule.allowDead,
        });
      }
    }
    if (!plannedTargets && rule && rule.targetCount > 1) {
      plannedTargets = sample(
        state.players.filter((entry) => (rule.allowDead || entry.alive) && (rule.allowSelf || entry.id !== actor.id)),
        rule.targetCount,
        rng
      );
    }

    const clue = generateInfoClueSimplified(state, actor, plannedTargets, rng, plannedPlan);
    if (!clue) {
      return;
    }

    state.events.infoPings.push({ ...clue, night: state.night });
    addPrivateInfo(state, actor, `[第${state.night}夜] ${clue.text}`);
  });

  const human = getHumanPlayer(state);
  if (human && state.humanNightPlan?.night === state.night) {
    const targetNames = (state.humanNightPlan.targetIds ?? [])
      .map((entry) => getPlayerById(state, entry)?.name ?? entry)
      .join(" / ");
    addPrivateInfo(
      state,
      human,
      `[第${state.night}夜] 你的目标预设已记录（简化模式）：${targetNames || "无"}。`
    );
    state.humanNightPlan = null;
  }

  applyThreatHeuristic(state);
  checkWin(state);
  if (state.gameOver) {
    return;
  }
  transitionToDayPhase(state);
}
export function runNight(state, rng = Math.random) {
  if (state.ruleMode === "tb-full") {
    runNightTB(state, rng);
    return;
  }
  runNightSimplified(state, rng);
}

export function registerClaim(state, playerId, roleId) {
  const player = getPlayerById(state, playerId);
  if (!player) {
    return false;
  }
  player.publicClaimRoleId = roleId;
  const roleName = getRoleNameById(state, roleId);
  const claim = { day: state.day, playerId, roleId, private: false };
  state.events.claims.push(claim);
  recordPublicClaimForAgents(state, claim);
  addLog(state, "claim", `${player.name} 声称自己是 ${roleName}。`, { playerId, roleId });

  getScriptRuleHandlers("snv").onRegisterClaim?.(createSNVRoleContext(state, Math.random), { player, roleId });
  return true;
}

function isVirginTrigger(state, nominator, nominee, rng = Math.random) {
  if (!state.tb) {
    return false;
  }
  return !!getScriptRuleHandlers("tb").onNomination?.(createTBRoleContext(state, rng), { nominator, nominee })?.triggered;
}

function canButlerVote(state, player, intendedVote, allVotes) {
  if (!state.tb || !intendedVote) {
    return intendedVote;
  }
  return getScriptRuleHandlers("tb").restrictButlerVote?.(createTBRoleContext(state), {
    player,
    intendedVote,
    allVotes,
  }) ?? intendedVote;
}

export function resolveNominationAndVote(
  state,
  {
    nominatorId,
    nomineeId,
    humanVoteYes,
    decideAIVote,
  },
  rng = Math.random
) {
  if (state.phase !== "day" || state.gameOver) {
    return { accepted: false, reason: "当前不在白天流程。" };
  }

  if (state.dayStage && state.dayStage !== "nomination") {
    return { accepted: false, reason: "当前尚未进入提名阶段，请先完成私聊与公聊。" };
  }

  const nominator = getPlayerById(state, nominatorId);
  const nominee = getPlayerById(state, nomineeId);

  if (!nominator || !nominee) {
    return { accepted: false, reason: "提名者或被提名玩家不存在。" };
  }
  if (!nominator.alive) {
    return { accepted: false, reason: "死亡玩家无法发起提名。" };
  }
  if (nominator.nominatedToday) {
    return { accepted: false, reason: `${nominator.name} 今天已提名过。` };
  }
  if (nominee.beenNominatedToday) {
    return { accepted: false, reason: `${nominee.name} 今天已被提名过。` };
  }

  const snvNomination = getScriptRuleHandlers("snv").onNomination?.(createSNVRoleContext(state, rng), {
    nominator,
    nominee,
  });
  if (snvNomination?.blocked) {
    return { accepted: false, reason: snvNomination.reason };
  }

  nominator.nominatedToday = true;
  nominee.beenNominatedToday = true;

  getScriptRuleHandlers("snv").onNominationAccepted?.(createSNVRoleContext(state, rng), { nominator, nominee });

  addLog(state, "nomination", `${nominator.name} 提名了 ${nominee.name}。`, { nominatorId, nomineeId });
  recordNominationForAgents(state, { nominatorId, nomineeId });

  if (isVirginTrigger(state, nominator, nominee, rng)) {
    processExecutionDeath(state, nominator, "virgin-trigger", { nomineeId: nominee.id }, rng);
    addLog(state, "day-skill", "Virgin 触发：提名者被立即处决。", {
      nominatorId: nominator.id,
      nomineeId: nominee.id,
    });
    checkWin(state);
    return {
      accepted: true,
      passed: true,
      special: "virgin",
      nominee,
      yesVotes: 0,
      threshold: Math.ceil(getAlivePlayers(state).length / 2),
      votes: [],
    };
  }

  const aliveCount = getAlivePlayers(state).length;
  const threshold = Math.ceil(aliveCount / 2);

  const votes = [];
  state.players.forEach((player) => {
    const canVote = player.alive || player.ghostVoteAvailable;
    if (!canVote) {
      votes.push({ voterId: player.id, vote: false, abstain: true });
      return;
    }
    let vote;
    if (player.isHuman) {
      vote = !!humanVoteYes;
    } else {
      vote = !!decideAIVote(player, nominee, state);
    }
    votes.push({ voterId: player.id, vote, abstain: false });
  });

  for (let pass = 0; pass < 2; pass += 1) {
    votes.forEach((entry) => {
      if (entry.abstain || !entry.vote) {
        return;
      }
      const voter = getPlayerById(state, entry.voterId);
      if (!voter) {
        entry.vote = false;
        return;
      }
      entry.vote = canButlerVote(state, voter, entry.vote, votes);
    });
  }

  votes.forEach((entry) => {
    if (!entry.vote) {
      return;
    }
    const voter = getPlayerById(state, entry.voterId);
    if (!voter) {
      return;
    }
    if (!voter.alive && voter.ghostVoteAvailable) {
      voter.ghostVoteAvailable = false;
    }
  });

  const yesVotes = votes.filter((entry) => entry.vote).length;
  const passed = yesVotes >= threshold;

  getScriptRuleHandlers("snv").onVotesTallied?.(createSNVRoleContext(state, rng), { votes, nominee });

  const voteEvent = {
    day: state.day,
    nominatorId,
    nomineeId,
    yesVotes,
    threshold,
    votes,
    passed,
  };
  state.events.votes.push(voteEvent);
  recordVoteForAgents(state, voteEvent);

  addLog(
    state,
    "vote",
    `投票结果：${yesVotes} 票赞成（阈值 ${threshold}）。${passed ? "提名通过" : "提名未通过"}。`,
    { nomineeId, yesVotes, threshold, passed }
  );

  if (passed && nominee.alive) {
    processExecutionDeath(state, nominee, "vote-execution", { nominatorId }, rng);
  } else if (!passed) {
    evaluateNoExecutionOutcomes(state);
  }

  checkWin(state);
  return {
    accepted: true,
    passed,
    yesVotes,
    threshold,
    nominee,
    votes,
  };
}

export function useSlayerAbility(state, { shooterId, targetId }, rng = Math.random) {
  if (state.phase !== "day" || state.gameOver) {
    return { ok: false, reason: "当前不能发动 Slayer 技能。" };
  }

  if (state.dayStage === "private") {
    return { ok: false, reason: "私聊阶段不能发动 Slayer，请先进入公聊或提名阶段。" };
  }

  const shooter = getPlayerById(state, shooterId);
  const target = getPlayerById(state, targetId);
  if (!shooter || !target) {
    return { ok: false, reason: "目标不存在。" };
  }
  if (!state.tb) {
    return { ok: false, reason: "当前剧本没有 Slayer 技能。" };
  }
  const result =
    getScriptRuleHandlers("tb").useSlayerAbility?.(createTBRoleContext(state, rng), { shooter, target }) ?? {
      ok: false,
      reason: "Slayer 技能模块未注册。",
    };
  if (result.ok && shooter.isHuman) {
    markHumanAbilityUsed(state, getEffectiveRoleId(shooter));
  }
  return result;
}

function evaluateMayorNoExecution(state) {
  if (!state.tb) {
    return;
  }
  getScriptRuleHandlers("tb").onNoExecution?.(createTBRoleContext(state));
}

function evaluateNoExecutionOutcomes(state) {
  evaluateMayorNoExecution(state);
  getScriptRuleHandlers("bmr").onNoExecution?.(createBMRRoleContext(state));
  if (state.gameOver) {
    return;
  }
  getScriptRuleHandlers("snv").onNoExecution?.(createSNVRoleContext(state));
}

export function skipDay(state) {
  if (state.phase !== "day" || state.gameOver) {
    return false;
  }
  if (state.dayStage && state.dayStage !== "nomination") {
    return false;
  }
  addLog(state, "day-skip", "今天无人处决，进入夜晚。", {});
  evaluateNoExecutionOutcomes(state);
  checkWin(state);
  return true;
}

export function summarizeRoleBag(state) {
  const roleNames = state.players
    .map((entry) => entry.roleName)
    .sort((a, b) => a.localeCompare(b, "en"));
  return roleNames.join(", ");
}

export function withSeededRandom(seedInput) {
  let seed = Number(seedInput) || Date.now();
  return () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}
