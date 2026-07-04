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

function hasDeathToday(state) {
  return (
    (state.events?.executions ?? []).some((entry) => entry.day === state.day && entry.died !== false) ||
    (state.events?.dayDeaths ?? []).some((entry) => entry.day === state.day)
  );
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function isZombuulRegisteringDead(state, player) {
  if (!state?.bmr?.zombuulHiddenDead || !player?.alive) {
    return false;
  }
  const stored = state.bmr.zombuulHiddenDeadPlayerId;
  if (stored) {
    return stored === player.id;
  }
  return player.roleId === BMR.ZOMBUUL;
}

function registersAsDeadForBMR(state, player) {
  return !!player && (!player.alive || isZombuulRegisteringDead(state, player));
}

export const BMR_ROLE_ACTION_RULES = {
  [BMR.SAILOR]: {
    kind: "player-target",
    targetCount: 1,
    allowSelf: false,
    allowDead: false,
    minNight: 1,
    prompt: "选择 1 名存活玩家一起喝酒；你们之中一人会醉酒。",
    interaction: {
      title: "水手的烈酒",
      subtitle: "挑一个还活着的人共饮。Storyteller 会决定你们之中谁醉酒。",
      style: "oath",
      badge: "每晚",
      targetLabels: ["共饮对象"],
      helper: "醉酒者的能力会失准，但本人通常不会知道。",
      confirmText: "举杯",
      skipText: "让系统代选",
    },
  },
  [BMR.CHAMBERMAID]: {
    kind: "player-target",
    targetCount: 2,
    allowSelf: false,
    allowDead: false,
    minNight: 1,
    prompt: "选择 2 名存活玩家，得知其中有几人因自身能力在夜晚醒来。",
    interaction: {
      title: "侍女的巡夜",
      subtitle: "选择两名玩家，询问他们今夜是否因自己的能力醒来。",
      style: "divination",
      badge: "选两人",
      targetLabels: ["观察对象一", "观察对象二"],
      helper: "只统计“因自身能力醒来”的玩家；邪恶互认等流程通常不计入。",
      confirmText: "记录巡夜",
      skipText: "让系统代选",
    },
  },
  [BMR.EXORCIST]: {
    kind: "player-target",
    targetCount: 1,
    allowSelf: false,
    allowDead: false,
    targetFilter: ({ state, actor, target }) => state.bmr?.exorcistLastTargetById?.[actor.id] !== target.id,
    minNight: 2,
    prompt: "选择 1 名存活玩家驱魔；如果 ta 是恶魔，今晚不会行动。",
    interaction: {
      title: "驱魔人的圣铃",
      subtitle: "选择一名玩家。如果选中恶魔，恶魔今晚不会醒来杀人。",
      style: "ward",
      badge: "不能连续同人",
      targetLabels: ["驱魔目标"],
      helper: "当前实现会避免连续选择同一目标；命中恶魔时会阻止本夜恶魔行动。",
      confirmText: "敲响圣铃",
      skipText: "让系统代选",
    },
  },
  [BMR.INNKEEPER]: {
    kind: "player-target",
    targetCount: 2,
    allowSelf: false,
    allowDead: false,
    minNight: 2,
    prompt: "选择 2 名存活玩家今晚免死，但其中一人会醉酒。",
    interaction: {
      title: "旅店老板的庇护",
      subtitle: "让两名玩家在旅店过夜。他们不会死，但其中一人会醉酒。",
      style: "ward",
      badge: "保护二人",
      targetLabels: ["住客一", "住客二"],
      helper: "醉酒对象不公开；本地规则会随机在两名住客中选择一人醉酒。",
      confirmText: "安排房间",
      skipText: "让系统代选",
    },
  },
  [BMR.GAMBLER]: {
    kind: "player-target",
    inputType: "player-role",
    targetCount: 1,
    allowSelf: false,
    allowDead: false,
    minNight: 2,
    prompt: "选择 1 名存活玩家，并声明你认为 ta 是什么角色。",
    interaction: {
      title: "赌徒的午夜下注",
      subtitle: "选择一名玩家和一个角色。若猜错，你会在夜里死亡。",
      style: "divination",
      badge: "玩家 + 角色",
      targetLabels: ["下注对象"],
      helper: "醉酒或中毒时，Storyteller 可以按失准信息结算；此处先按实际角色判定赌徒是否死亡。",
      confirmText: "确认下注",
      skipText: "让系统代为下注",
    },
  },
  [BMR.COURTIER]: {
    kind: "role-choice",
    inputType: "role",
    targetCount: 0,
    allowSelf: false,
    allowDead: false,
    minNight: 2,
    firstNight: false,
    maxUses: 1,
    optional: true,
    modes: [
      { id: "act", label: "Choose a character" },
      { id: "skip", label: "Wait for a later night" },
    ],
    prompt: "Choose 1 character. That character is drunk for 3 nights and 3 days.",
    interaction: {
      title: "侍臣的沉醉封印",
      subtitle: "选择一个角色，而不是选择一名玩家。该角色能力失效 3 夜 3 天。",
      style: "ward",
      badge: "选择角色",
      helper: "官方规则中侍臣指定的是角色名；若该角色不在场，也会消耗本次能力。",
      confirmText: "压制该角色",
      skipText: "让系统代选角色",
    },
  },
  [BMR.PROFESSOR]: {
    kind: "player-target",
    targetCount: 1,
    allowSelf: false,
    allowDead: true,
    requireDead: true,
    optional: true,
    modes: [
      { id: "act", label: "Attempt a revive" },
      { id: "skip", label: "Wait for a later night" },
    ],
    targetFilter: ({ state, target }) => registersAsDeadForBMR(state, target),
    minNight: 2,
    maxUses: 1,
    prompt: "Choose 1 dead player to attempt to revive.",
    interaction: {
      title: "教授的禁忌讲堂",
      subtitle: "选择一名死亡镇民，尝试将其复活。",
      style: "ward",
      badge: "复活尝试",
      targetLabels: ["复活对象"],
      helper: "第一版按当前引擎规则：只能选择死亡镇民，成功后恢复存活并保留鬼票状态。",
      confirmText: "尝试复活",
      skipText: "让系统代选",
    },
  },
  [BMR.DEVILS_ADVOCATE]: {
    kind: "player-target",
    targetCount: 1,
    allowSelf: false,
    allowDead: false,
    targetFilter: ({ state, actor, target }) => state.bmr?.devilsAdvocateLastTargetById?.[actor.id] !== target.id,
    minNight: 1,
    prompt: "选择 1 名存活玩家，明天若 ta 被处决则不会死亡。",
    interaction: {
      title: "魔鬼代言人的辩护",
      subtitle: "选择一名玩家获得处决保护。不能连续保护同一名玩家。",
      style: "demon",
      badge: "处决免死",
      targetLabels: ["被辩护者"],
      helper: "保护只防处决死亡，不防夜晚死亡。若成功防下处决，会在日志中记录。",
      confirmText: "签下辩护书",
      skipText: "让系统代选",
    },
  },
  [BMR.ASSASSIN]: {
    kind: "player-target",
    targetCount: 1,
    allowSelf: false,
    allowDead: false,
    minNight: 1,
    maxUses: 1,
    optional: true,
    modes: [
      { id: "act", label: "Assassinate tonight" },
      { id: "skip", label: "Wait for a later night" },
    ],
    prompt: "每局一次，选择 1 名存活玩家使其死亡，即使通常无法死亡。",
    interaction: {
      title: "刺客的暗刃",
      subtitle: "选择一名目标。刺客击杀会穿透大多数保护。",
      style: "demon",
      badge: "每局一次",
      targetLabels: ["暗杀目标"],
      helper: "当前实现以 unstoppable 处理，能绕过多数死亡防护。",
      confirmText: "出刀",
      skipText: "今晚不动手",
    },
  },
  [BMR.PUKKA]: {
    kind: "player-target",
    targetCount: 1,
    allowSelf: false,
    allowDead: false,
    minNight: 2,
    prompt: "选择 1 名存活玩家中毒；此前中毒者会死亡。",
    interaction: {
      title: "普卡的慢性毒",
      subtitle: "选择新的毒目标。上一个被普卡毒中的玩家会在今晚死亡。",
      style: "venom",
      badge: "延迟死亡",
      targetLabels: ["中毒目标"],
      helper: "这类信息不会自动公开；受害者通常不知道自己被毒。",
      confirmText: "种下毒素",
      skipText: "让系统代选",
    },
  },
  [BMR.SHABALOTH]: {
    kind: "player-target",
    targetCount: 2,
    allowSelf: false,
    allowDead: false,
    minNight: 2,
    prompt: "选择 2 名存活玩家吞食；曾被吞食者之后可能复活。",
    interaction: {
      title: "沙巴洛斯的饥饿",
      subtitle: "选择两名目标。前夜被吞食的玩家之后可能被反刍复活。",
      style: "demon",
      badge: "双杀",
      targetLabels: ["吞食对象一", "吞食对象二"],
      helper: "本地规则会记录上一夜目标，并在之后按概率复活其中一人。",
      confirmText: "吞食",
      skipText: "让系统代选",
    },
  },
  [BMR.PO]: {
    kind: "player-target",
    inputType: "charge-or-targets",
    targetCount: 1,
    minTargetCount: 1,
    maxTargetCount: 1,
    allowSelf: false,
    allowDead: false,
    minNight: 1,
    prompt: "选择今晚击杀目标，或不杀人改为蓄力。",
    modes: [
      { id: "kill", label: "今晚击杀" },
      { id: "charge", label: "今晚不杀，蓄力" },
    ],
    interaction: {
      title: "珀的蓄力",
      subtitle: "你可以今晚不杀，下一次夜晚将最多选择三名目标。",
      style: "demon",
      badge: "可蓄力",
      targetLabels: ["击杀目标"],
      helper: "若上一夜蓄力，本夜会显示最多 3 个目标栏。若选择蓄力，本夜不会造成恶魔击杀。",
      confirmText: "确认恶魔行动",
      skipText: "让系统代选",
    },
  },
  [BMR.GODFATHER]: {
    kind: "player-target",
    targetCount: 1,
    allowSelf: false,
    allowDead: false,
    minNight: 2,
    firstNight: false,
    prompt: "An Outsider died today. Choose 1 living player to kill.",
    interaction: {
      title: "教父的额外清算",
      subtitle: "今天有外来者死亡，因此今晚你会醒来选择一名玩家死亡。",
      style: "demon",
      badge: "外来者死亡触发",
      targetLabels: ["额外死亡"],
      helper: "只有当天有外来者死亡时才会出现这个行动；首夜只会获得外来者信息，不会杀人。",
      confirmText: "确认清算",
      skipText: "让系统代选",
    },
  },
  [BMR.ZOMBUUL]: {
    kind: "player-target",
    targetCount: 1,
    allowSelf: false,
    allowDead: false,
    available: ({ state }) => !hasDeathToday(state),
    minNight: 2,
    prompt: "若今天无人死亡，选择 1 名存活玩家死亡。",
    interaction: {
      title: "僵怖的潜伏",
      subtitle: "只有今天无人死亡时，僵怖才会在夜里杀人。",
      style: "demon",
      badge: "条件杀人",
      targetLabels: ["潜伏目标"],
      helper: "僵怖第一次死亡会诈死；当前实现会记录隐藏死亡状态。",
      confirmText: "发动潜伏",
      skipText: "让系统代选",
    },
  },
  [BMR.LUNATIC]: {
    kind: "player-target",
    targetCount: 1,
    allowSelf: false,
    allowDead: false,
    minNight: 2,
    prompt: "选择你以为自己作为恶魔要攻击的目标。",
    interaction: {
      title: "疯子的幻觉夜袭",
      subtitle: "你会按自己认知中的恶魔身份行动，但这些选择通常只是幻觉信息。",
      style: "demon",
      badge: "认知覆盖",
      targetLabels: ["幻觉目标"],
      helper: "真实恶魔会得知你的幻觉行动；你的选择本身不会造成恶魔击杀。",
      confirmText: "执行幻觉行动",
      skipText: "让系统代选",
    },
  },
};

export const BMR_DAY_ACTION_RULES = {
  [BMR.GOSSIP]: {
    kind: "statement",
    inputType: "question",
    targetCount: 0,
    allowSelf: true,
    allowDead: true,
    minDay: 1,
    maxUses: 1,
    usageScope: "day",
    allowedStages: ["public", "nomination"],
    prompt: "公开发表 1 条 Gossip 声明。如果声明为真，今晚会有一名玩家死亡。",
    interaction: {
      title: "流言蜚语的声明",
      subtitle: "写下一条公开声明。若 Storyteller 判定为真，今晚额外死亡一名玩家。",
      style: "divination",
      badge: "每日一次",
      helper: "当前本地裁判能识别座位+阵营/类别/角色等常见声明；复杂声明会交给 Storyteller 启发式判定。",
      confirmText: "公开声明",
      skipText: "今天不传流言",
    },
  },
};

export const BMR_ROLE_DEFINITIONS = Object.freeze({
  [BMR.GRANDMOTHER]: { id: BMR.GRANDMOTHER, scriptAgnostic: true, phaseHooks: { firstNight: "engine:simplified" } },
  [BMR.SAILOR]: { id: BMR.SAILOR, scriptAgnostic: true, action: BMR_ROLE_ACTION_RULES[BMR.SAILOR], phaseHooks: { eachNight: "engine:simplified" } },
  [BMR.CHAMBERMAID]: { id: BMR.CHAMBERMAID, scriptAgnostic: true, action: BMR_ROLE_ACTION_RULES[BMR.CHAMBERMAID], phaseHooks: { eachNight: "engine:simplified" } },
  [BMR.EXORCIST]: { id: BMR.EXORCIST, scriptAgnostic: true, action: BMR_ROLE_ACTION_RULES[BMR.EXORCIST], phaseHooks: { otherNight: "engine:simplified" } },
  [BMR.INNKEEPER]: { id: BMR.INNKEEPER, scriptAgnostic: true, action: BMR_ROLE_ACTION_RULES[BMR.INNKEEPER], phaseHooks: { otherNight: "engine:simplified" } },
  [BMR.GAMBLER]: { id: BMR.GAMBLER, scriptAgnostic: true, action: BMR_ROLE_ACTION_RULES[BMR.GAMBLER], phaseHooks: { otherNight: "engine:simplified" } },
  [BMR.GOSSIP]: { id: BMR.GOSSIP, scriptAgnostic: true, dayAction: BMR_DAY_ACTION_RULES[BMR.GOSSIP], phaseHooks: { dayAction: "engine:simplified" } },
  [BMR.COURTIER]: { id: BMR.COURTIER, scriptAgnostic: true, action: BMR_ROLE_ACTION_RULES[BMR.COURTIER], phaseHooks: { otherNight: "engine:simplified" } },
  [BMR.PROFESSOR]: { id: BMR.PROFESSOR, scriptAgnostic: true, action: BMR_ROLE_ACTION_RULES[BMR.PROFESSOR], phaseHooks: { otherNight: "engine:simplified" } },
  [BMR.MINSTREL]: { id: BMR.MINSTREL, scriptAgnostic: true, phaseHooks: { onMinionExecution: "engine:simplified" } },
  [BMR.TEA_LADY]: { id: BMR.TEA_LADY, scriptAgnostic: true, phaseHooks: { continuous: "engine:simplified" } },
  [BMR.PACIFIST]: { id: BMR.PACIFIST, scriptAgnostic: true, phaseHooks: { onExecutionDeath: "engine:simplified" } },
  [BMR.FOOL]: { id: BMR.FOOL, scriptAgnostic: true, phaseHooks: { onDeath: "engine:simplified" } },
  [BMR.TINKER]: { id: BMR.TINKER, scriptAgnostic: true, phaseHooks: { eachNight: "engine:simplified" } },
  [BMR.MOONCHILD]: { id: BMR.MOONCHILD, scriptAgnostic: true, phaseHooks: { onDeath: "engine:simplified" } },
  [BMR.GOON]: { id: BMR.GOON, scriptAgnostic: true, phaseHooks: { onTargeted: "engine:simplified" } },
  [BMR.LUNATIC]: { id: BMR.LUNATIC, scriptAgnostic: true, action: BMR_ROLE_ACTION_RULES[BMR.LUNATIC], phaseHooks: { setup: "engine:simplified", otherNight: "engine:simplified" } },
  [BMR.GODFATHER]: { id: BMR.GODFATHER, scriptAgnostic: true, action: BMR_ROLE_ACTION_RULES[BMR.GODFATHER], phaseHooks: { setup: "engine:simplified", otherNight: "engine:simplified" } },
  [BMR.DEVILS_ADVOCATE]: { id: BMR.DEVILS_ADVOCATE, scriptAgnostic: true, action: BMR_ROLE_ACTION_RULES[BMR.DEVILS_ADVOCATE], phaseHooks: { eachNight: "engine:simplified" } },
  [BMR.ASSASSIN]: { id: BMR.ASSASSIN, scriptAgnostic: true, action: BMR_ROLE_ACTION_RULES[BMR.ASSASSIN], phaseHooks: { eachNight: "engine:simplified" } },
  [BMR.MASTERMIND]: { id: BMR.MASTERMIND, scriptAgnostic: true, phaseHooks: { onDemonExecution: "engine:simplified" } },
  [BMR.ZOMBUUL]: { id: BMR.ZOMBUUL, scriptAgnostic: true, action: BMR_ROLE_ACTION_RULES[BMR.ZOMBUUL], phaseHooks: { otherNight: "engine:simplified" } },
  [BMR.PUKKA]: { id: BMR.PUKKA, scriptAgnostic: true, action: BMR_ROLE_ACTION_RULES[BMR.PUKKA], phaseHooks: { otherNight: "engine:simplified" } },
  [BMR.SHABALOTH]: { id: BMR.SHABALOTH, scriptAgnostic: true, action: BMR_ROLE_ACTION_RULES[BMR.SHABALOTH], phaseHooks: { otherNight: "engine:simplified" } },
  [BMR.PO]: { id: BMR.PO, scriptAgnostic: true, action: BMR_ROLE_ACTION_RULES[BMR.PO], phaseHooks: { eachNight: "engine:simplified" } },
});

export function runBadMoonRisingNight(ctx) {
  const { state, rng } = ctx;
  const {
    addAbilityInterference,
    addLog,
    addPrivateInfo,
    chooseOne,
    chooseRandomAliveExcluding,
    consumeHumanNightPlan,
    consumeHumanNightPlanTargets,
    getAliveDemons,
    getAlivePlayers,
    getAllRoles,
    getEffectiveRoleId,
    getNightOrderRoleIds,
    getPlayerById,
    getPubliclyAlivePlayers,
    isAbilityBlocked,
    isRoleNightWindowOpen,
    markWokeTonight,
    pickNightTargets,
    processNightDeath,
    sample,
  } = ctx;
  if (!state.bmr) {
    return;
  }
  const bmr = state.bmr;
  const livingTargets = (excludedIds = []) => {
    const blocked = new Set(Array.isArray(excludedIds) ? excludedIds : [excludedIds]);
    return getPubliclyAlivePlayers(state).filter((entry) => !blocked.has(entry.id));
  };
  const demonAttackTargets = (demonPlayer, excludedIds = []) => {
    const blocked = new Set([demonPlayer?.id, ...(Array.isArray(excludedIds) ? excludedIds : [excludedIds])].filter(Boolean));
    const targets = livingTargets([...blocked]);
    const goodTargets = targets.filter((entry) => entry.team === "good");
    return goodTargets.length > 0 ? goodTargets : targets;
  };

  Object.entries(bmr.moonchildPendingById ?? {}).forEach(([, targetId]) => {
    const target = getPlayerById(state, targetId);
    if (target?.alive && target.team === "good") {
      processNightDeath(state, target, "moonchild-trigger", {}, rng);
    }
  });
  bmr.moonchildPendingById = {};

  state.players
    .filter((entry) => entry.alive && getEffectiveRoleId(entry) === BMR.TINKER)
    .forEach((tinker) => {
      if (rng() < 0.08) {
        processNightDeath(state, tinker, "tinker-random-death", {}, rng);
      }
    });

  if (bmr.pukkaPoisonedId) {
    const delayed = getPlayerById(state, bmr.pukkaPoisonedId);
    const activePukka = state.players.find(
      (entry) => entry.alive && getEffectiveRoleId(entry) === BMR.PUKKA && !isAbilityBlocked(entry, state)
    );
    if (activePukka && delayed?.alive) {
      processNightDeath(state, delayed, "pukka-delayed-kill", {}, rng);
      bmr.pukkaPoisonedId = null;
    } else if (activePukka || !delayed?.alive) {
      bmr.pukkaPoisonedId = null;
    } else if (delayed) {
      delayed.poisoned = true;
      delayed.poisonedTomorrowDay = true;
      addAbilityInterference(state, 1);
      addLog(state, "night-effect", "Pukka 当前失效，上一名中毒者继续处于延迟毒状态。", {
        targetId: delayed.id,
      });
    }
  }

  const shabaloth = state.players.find(
    (entry) => entry.alive && getEffectiveRoleId(entry) === BMR.SHABALOTH && !isAbilityBlocked(entry, state)
  );
  if (shabaloth && Array.isArray(bmr.shabalothLastTargets) && bmr.shabalothLastTargets.length > 0 && rng() < 0.36) {
    const revivePool = bmr.shabalothLastTargets
      .map((entry) => getPlayerById(state, entry))
      .filter((entry) => entry && !entry.alive);
    const revived = chooseOne(revivePool, rng);
    if (revived) {
      revived.alive = true;
      revived.ghostVoteAvailable = true;
      addLog(state, "night-effect", "Shabaloth 反刍使一名玩家复活。", { targetId: revived.id });
    }
  }

  state.players
    .filter(
      (entry) =>
        entry.alive &&
        getEffectiveRoleId(entry) === BMR.SAILOR &&
        isRoleNightWindowOpen(state, BMR.SAILOR, state.night) &&
        !isAbilityBlocked(entry, state)
    )
    .forEach((sailor) => {
      markWokeTonight(state, sailor, "sailor");
      const target = pickNightTargets(
        state,
        sailor,
        1,
        { allowSelf: false, allowDead: false, preferredPool: livingTargets([sailor.id]) },
        rng
      )[0];
      const drunkTarget = rng() < 0.5 ? sailor : target;
      if (!drunkTarget) {
        return;
      }
      drunkTarget.poisoned = true;
      drunkTarget.poisonedTomorrowDay = true;
      bmr.sailorDrunkIds.push(drunkTarget.id);
      addAbilityInterference(state, 1);
      addLog(state, "night-effect", "Sailor 生效：一名玩家被醉酒。", {
        by: sailor.id,
        targetId: drunkTarget.id,
      });
    });

  state.players
    .filter(
      (entry) =>
        entry.alive &&
        getEffectiveRoleId(entry) === BMR.EXORCIST &&
        isRoleNightWindowOpen(state, BMR.EXORCIST, state.night) &&
        !isAbilityBlocked(entry, state)
    )
    .forEach((exorcist) => {
      markWokeTonight(state, exorcist, "exorcist");
      const previousId = bmr.exorcistLastTargetById[exorcist.id];
      const candidates = livingTargets([exorcist.id, previousId]);
      const target = pickNightTargets(
        state,
        exorcist,
        1,
        { allowSelf: false, allowDead: false, preferredPool: candidates.length > 0 ? candidates : null },
        rng
      )[0];
      if (!target) {
        return;
      }
      bmr.exorcistLastTargetById[exorcist.id] = target.id;
      if (target.category === "demon") {
        bmr.exorcisedDemonId = target.id;
        addLog(state, "night-effect", "Exorcist 压制了恶魔本夜行动。", { by: exorcist.id, targetId: target.id });
      }
    });

  state.players
    .filter(
      (entry) =>
        entry.alive &&
        getEffectiveRoleId(entry) === BMR.INNKEEPER &&
        isRoleNightWindowOpen(state, BMR.INNKEEPER, state.night) &&
        !isAbilityBlocked(entry, state)
    )
    .forEach((innkeeper) => {
      markWokeTonight(state, innkeeper, "innkeeper");
      const targets = pickNightTargets(
        state,
        innkeeper,
        2,
        { allowSelf: false, allowDead: false, preferredPool: livingTargets([innkeeper.id]) },
        rng
      );
      bmr.innkeeperProtectedIds = targets.map((entry) => entry.id);
      const drunkTarget = chooseOne(targets, rng);
      if (drunkTarget) {
        bmr.innkeeperDrunkId = drunkTarget.id;
        drunkTarget.poisoned = true;
        drunkTarget.poisonedTomorrowDay = true;
        addAbilityInterference(state, 1);
      }
    });

  state.players
    .filter(
      (entry) =>
        entry.alive &&
        getEffectiveRoleId(entry) === BMR.COURTIER &&
        isRoleNightWindowOpen(state, BMR.COURTIER, state.night) &&
        !isAbilityBlocked(entry, state)
    )
    .forEach((courtier) => {
      markWokeTonight(state, courtier, "courtier");
      if (bmr.courtierUsedByIds.includes(courtier.id)) {
        return;
      }
      const humanSelectedRoleId = courtier.isHuman
        ? state.humanNightPlan?.selectedRoleId ?? courtier.courtierPlannedRoleId ?? bmr.courtierPlannedRoleById?.[courtier.id] ?? null
        : null;
      let planned = courtier.isHuman
        ? consumeHumanNightPlan(state, courtier, { allowSelf: false, allowDead: false, minTargets: 0, maxTargets: 0 })
        : null;
      if (
        !planned &&
        courtier.isHuman &&
        state.humanNightPlan?.night === state.night &&
        state.humanNightPlan.roleId === BMR.COURTIER &&
        state.humanNightPlan.selectedRoleId
      ) {
        planned = { ...state.humanNightPlan };
        state.humanNightPlan = null;
      }
      if (planned?.skipped) {
        addLog(state, "night-effect", "Courtier waits and keeps the drunkenness choice for a later night.", { by: courtier.id, skipped: true });
        return;
      }
      const roleId =
        humanSelectedRoleId ??
        planned?.selectedRoleId ??
        chooseOne(
          state.players
            .filter((entry) => entry.id !== courtier.id)
            .map((entry) => getEffectiveRoleId(entry))
            .filter(Boolean),
          rng
        );
      if (!roleId) {
        return;
      }
      if (bmr.courtierPlannedRoleById) {
        delete bmr.courtierPlannedRoleById[courtier.id];
      }
      delete courtier.courtierPlannedRoleId;
      bmr.courtierUsedByIds.push(courtier.id);
      bmr.suppressedByRoleId[roleId] = Math.max(Number(bmr.suppressedByRoleId[roleId] ?? 0), state.night + 2);
      addAbilityInterference(state, state.players.filter((entry) => getEffectiveRoleId(entry) === roleId).length);
      addLog(state, "night-effect", `Courtier 压制了角色 ${roleId}。`, {
        by: courtier.id,
        targetRoleId: roleId,
      });
    });

  state.players
    .filter(
      (entry) =>
        entry.alive &&
        getEffectiveRoleId(entry) === BMR.GAMBLER &&
        isRoleNightWindowOpen(state, BMR.GAMBLER, state.night) &&
        !isAbilityBlocked(entry, state)
    )
    .forEach((gambler) => {
      markWokeTonight(state, gambler, "gambler");
      const planned = gambler.isHuman
        ? consumeHumanNightPlan(state, gambler, { allowSelf: false, allowDead: false, minTargets: 1, maxTargets: 1 })
        : null;
      const target =
        planned?.targets?.[0] ??
        pickNightTargets(
          state,
          gambler,
          1,
          { allowSelf: false, allowDead: false, preferredPool: livingTargets([gambler.id]) },
          rng
        )[0];
      if (!target) {
        return;
      }
      const guessedRoleId = planned?.selectedRoleId ?? target.publicClaimRoleId ?? chooseOne(getAllRoles(state.scriptId), rng)?.id ?? target.roleId;
      const correct = guessedRoleId === target.roleId;
      if (!correct) {
        processNightDeath(state, gambler, "gambler-fail", { targetId: target.id, guessedRoleId }, rng);
      }
    });

  state.players
    .filter(
      (entry) =>
        entry.alive &&
        getEffectiveRoleId(entry) === BMR.CHAMBERMAID &&
        isRoleNightWindowOpen(state, BMR.CHAMBERMAID, state.night) &&
        !isAbilityBlocked(entry, state)
    )
    .forEach((maid) => {
      markWokeTonight(state, maid, "chambermaid");
      const targets = pickNightTargets(
        state,
        maid,
        2,
        { allowSelf: false, allowDead: false, preferredPool: livingTargets([maid.id]) },
        rng
      );
      const wakingRoles = new Set(getNightOrderRoleIds("bmr", state.night));
      const count = targets.filter((entry) => {
        const roleId = getEffectiveRoleId(entry);
        if (!wakingRoles.has(roleId)) {
          return false;
        }
        if (!isRoleNightWindowOpen(state, roleId, state.night)) {
          return false;
        }
        return entry.alive || roleId === BMR.LUNATIC;
      }).length;
      const text = `[第${state.night}夜] 你选择的两名玩家中有 ${count} 人在夜间因自身能力醒来。`;
      addPrivateInfo(state, maid, text);
      state.events.infoPings.push({
        night: state.night,
        actorId: maid.id,
        type: "chambermaid",
        targetIds: targets.map((entry) => entry.id),
        count,
        text,
      });
    });

  state.players
    .filter(
      (entry) =>
        entry.alive &&
        getEffectiveRoleId(entry) === BMR.PROFESSOR &&
        isRoleNightWindowOpen(state, BMR.PROFESSOR, state.night) &&
        !isAbilityBlocked(entry, state)
    )
    .forEach((professor) => {
      markWokeTonight(state, professor, "professor");
      if (bmr.professorUsedByIds.includes(professor.id)) {
        return;
      }
      const deadPlayers = state.players.filter((entry) => registersAsDeadForBMR(state, entry));
      if (deadPlayers.length === 0) {
        return;
      }
      const deadTownsfolk = deadPlayers.filter((entry) => entry.category === "townsfolk");
      const planned = professor.isHuman
        ? consumeHumanNightPlan(state, professor, { allowSelf: false, allowDead: true, minTargets: 0, maxTargets: 1 })
        : null;
      if (planned?.skipped) {
        addLog(state, "night-effect", "Professor waits and keeps the revive for a later night.", { by: professor.id, skipped: true });
        return;
      }
      let target = planned?.targets?.[0] ?? chooseOne(deadTownsfolk.length > 0 ? deadTownsfolk : deadPlayers, rng);
      if (!target || !registersAsDeadForBMR(state, target)) {
        target = chooseOne(deadPlayers, rng);
      }
      if (!target) {
        return;
      }
      bmr.professorUsedByIds.push(professor.id);
      if (target.category !== "townsfolk") {
        addLog(state, "night-effect", "Professor 尝试复活一名死者，但没有成功。", { by: professor.id, targetId: target.id });
        return;
      }
      target.alive = true;
      target.ghostVoteAvailable = true;
      addLog(state, "night-effect", "Professor 复活了一名镇民。", { by: professor.id, targetId: target.id });
    });

  state.players
    .filter(
      (entry) =>
        entry.alive &&
        getEffectiveRoleId(entry) === BMR.DEVILS_ADVOCATE &&
        isRoleNightWindowOpen(state, BMR.DEVILS_ADVOCATE, state.night) &&
        !isAbilityBlocked(entry, state)
    )
    .forEach((advisor) => {
      markWokeTonight(state, advisor, "devils-advocate");
      const previous = bmr.devilsAdvocateLastTargetById[advisor.id];
      const candidates = livingTargets([advisor.id, previous]);
      const target = pickNightTargets(
        state,
        advisor,
        1,
        { allowSelf: false, allowDead: false, preferredPool: candidates.length > 0 ? candidates : null },
        rng
      )[0];
      if (!target) {
        return;
      }
      bmr.devilsAdvocateProtectedId = target.id;
      bmr.devilsAdvocateLastTargetById[advisor.id] = target.id;
    });

  state.players
    .filter(
      (entry) =>
        entry.alive &&
        getEffectiveRoleId(entry) === BMR.ASSASSIN &&
        isRoleNightWindowOpen(state, BMR.ASSASSIN, state.night) &&
        !isAbilityBlocked(entry, state)
    )
    .forEach((assassin) => {
      markWokeTonight(state, assassin, "assassin");
      if (bmr.assassinUsedByIds.includes(assassin.id)) {
        return;
      }
      const plannedAction = assassin.isHuman
        ? consumeHumanNightPlan(state, assassin, { allowSelf: false, allowDead: false, minTargets: 0, maxTargets: 1 })
        : null;
      if (plannedAction?.skipped) {
        addLog(state, "night-effect", "Assassin waits and keeps the once-per-game kill for a later night.", { by: assassin.id, skipped: true });
        return;
      }
      if (!plannedAction && !assassin.isHuman && rng() > 0.28) {
        return;
      }
      const target =
        plannedAction?.targets?.[0] ??
        pickNightTargets(
          state,
          assassin,
          1,
          { allowSelf: false, allowDead: false, preferredPool: livingTargets([assassin.id]) },
          rng
        )[0];
      if (!target) {
        return;
      }
      bmr.assassinUsedByIds.push(assassin.id);
      processNightDeath(state, target, "assassin-kill", { by: assassin.id }, rng, { unstoppable: true });
    });

  if (bmr.godfatherBonusKillTonight) {
    const godfathers = state.players.filter(
      (entry) => entry.alive && getEffectiveRoleId(entry) === BMR.GODFATHER && !isAbilityBlocked(entry, state)
    );
    if (godfathers.length > 0) {
      const killer = godfathers[0];
      markWokeTonight(state, killer, "godfather");
      const planned = killer.isHuman
        ? consumeHumanNightPlanTargets(state, killer, 1, { allowSelf: false, allowDead: false })
        : null;
      const target = planned?.[0] ?? chooseRandomAliveExcluding(state, [killer.id], rng);
      if (target) {
        processNightDeath(state, target, "godfather-bonus-kill", { by: killer.id }, rng);
      }
    }
    bmr.godfatherBonusKillTonight = false;
  }

  for (let idx = 0; idx < Number(bmr.gossipPendingKills ?? 0); idx += 1) {
    const target = chooseOne(getAlivePlayers(state), rng);
    if (!target) {
      break;
    }
    processNightDeath(state, target, "gossip-kill", {}, rng);
  }
  bmr.gossipPendingKills = 0;

  state.players
    .filter(
      (entry) =>
        entry.alive &&
        getEffectiveRoleId(entry) === BMR.LUNATIC &&
        isRoleNightWindowOpen(state, state.bmr.lunaticFakeDemonRoleById?.[entry.id] ?? entry.apparentRoleId ?? BMR.LUNATIC, state.night)
    )
    .forEach((lunatic) => {
      markWokeTonight(state, lunatic, "lunatic");
      const perceivedDemonRoleId = state.bmr.lunaticFakeDemonRoleById?.[lunatic.id] ?? lunatic.apparentRoleId ?? BMR.LUNATIC;
      const planned = lunatic.isHuman
        ? consumeHumanNightPlan(state, lunatic, {
            allowSelf: false,
            allowDead: false,
            minTargets: 0,
            maxTargets: perceivedDemonRoleId === BMR.SHABALOTH ? 2 : perceivedDemonRoleId === BMR.PO ? 3 : 1,
          })
        : null;
      let targets = planned?.targets ?? [];
      if (planned?.mode === "charge" || planned?.mode === "none") {
        targets = [];
      }
      if (targets.length === 0 && planned?.mode !== "charge" && planned?.mode !== "none") {
        targets = pickNightTargets(
          state,
          lunatic,
          perceivedDemonRoleId === BMR.SHABALOTH ? 2 : 1,
          { allowSelf: false, allowDead: false, preferredPool: livingTargets([lunatic.id]) },
          rng
        );
      }
      state.bmr.lunaticLastTargetsById[lunatic.id] = targets.map((entry) => entry.id);
      if (planned?.mode === "charge") {
        addPrivateInfo(state, lunatic, `[第${state.night}夜] 你选择了不攻击并“蓄力”（疯子幻觉行动）。`);
      } else if (targets.length > 0) {
        addPrivateInfo(
          state,
          lunatic,
          `[第${state.night}夜] 你尝试“攻击”了 ${targets.map((entry) => entry.name).join(" / ")}（疯子幻觉行动）。`
        );
      }
      const demonInfo = targets.length > 0
        ? `${lunatic.name} 今晚选择了 ${targets.map((entry) => entry.name).join(" / ")}。`
        : `${lunatic.name} 今晚没有选择击杀目标。`;
      state.players
        .filter((entry) => entry.category === "demon")
        .forEach((demonPlayer) => {
          addPrivateInfo(state, demonPlayer, `[第${state.night}夜] 疯子行动情报：${demonInfo}`);
        });
    });

  const demon = getAliveDemons(state)[0];
  if (!demon) {
    return;
  }
  if (bmr.exorcisedDemonId === demon.id) {
    return;
  }

  const demonRole = getEffectiveRoleId(demon);
  if (!isRoleNightWindowOpen(state, demonRole, state.night)) {
    return;
  }
  if (isAbilityBlocked(demon, state)) {
    addLog(state, "night-effect", "恶魔本夜能力失效，没有造成恶魔行动。", { demonId: demon.id, roleId: demonRole });
    return;
  }
  markWokeTonight(state, demon, "demon");

  if (demonRole === BMR.ZOMBUUL) {
    if (!hasDeathToday(state)) {
      const target = pickNightTargets(
        state,
        demon,
        1,
        { allowSelf: false, allowDead: false, preferredPool: demonAttackTargets(demon) },
        rng
      )[0];
      if (target) {
        processNightDeath(state, target, "demon-kill", { by: demon.id }, rng);
      }
    }
    return;
  }

  if (demonRole === BMR.PUKKA) {
    const target = pickNightTargets(
      state,
      demon,
      1,
      { allowSelf: false, allowDead: false, preferredPool: demonAttackTargets(demon) },
      rng
    )[0];
    if (target) {
      target.poisoned = true;
      target.poisonedTomorrowDay = true;
      bmr.pukkaPoisonedId = target.id;
      addAbilityInterference(state, 1);
      addLog(state, "night-effect", "Pukka 本夜对一名玩家施加了延迟致死毒素。", {
        by: demon.id,
        targetId: target.id,
      });
    }
    return;
  }

  if (demonRole === BMR.SHABALOTH) {
    const targets = pickNightTargets(
      state,
      demon,
      2,
      { allowSelf: false, allowDead: false, preferredPool: demonAttackTargets(demon) },
      rng
    );
    bmr.shabalothLastTargets = targets.map((entry) => entry.id);
    targets.forEach((target) => {
      processNightDeath(state, target, "shabaloth-kill", { by: demon.id }, rng);
    });
    return;
  }

  if (demonRole === BMR.PO) {
    const plannedPo = demon.isHuman
      ? consumeHumanNightPlan(state, demon, {
          allowSelf: false,
          allowDead: false,
          minTargets: 0,
          maxTargets: bmr.poCharged ? 3 : 1,
        })
      : null;
    let targets = [];
    if (plannedPo?.mode === "charge" && !bmr.poCharged) {
      bmr.poCharged = true;
      addLog(state, "night-effect", "Po 正在蓄力，下次将造成三重击杀。", { demonId: demon.id });
      return;
    }
    if (bmr.poCharged) {
      const targetsPool = demonAttackTargets(demon);
      targets =
        plannedPo?.targets ??
        sample(
          targetsPool,
          Math.min(3, targetsPool.length),
          rng
        );
      bmr.poCharged = false;
    } else if (!demon.isHuman && rng() < 0.28) {
      bmr.poCharged = true;
      addLog(state, "night-effect", "Po 正在蓄力，下次将造成三重击杀。", { demonId: demon.id });
      return;
    } else {
      targets =
        plannedPo?.targets ??
        pickNightTargets(
          state,
          demon,
          1,
          { allowSelf: false, allowDead: false, preferredPool: demonAttackTargets(demon) },
          rng
        );
    }
    targets.forEach((target) => {
      processNightDeath(state, target, "demon-kill", { by: demon.id }, rng);
    });
    return;
  }
}

function onSetup(ctx) {
  const { state, addPrivateInfo, chooseOne, getAllRoles, sample } = ctx;
  if (!state.bmr) {
    return;
  }

  const allRoles = getAllRoles(state.scriptId);
  const aliveOutsiders = state.players.filter((entry) => entry.category === "outsider");
  state.players
    .filter((entry) => entry.roleId === BMR.GODFATHER)
    .forEach((godfather) => {
      state.bmr.godfatherOutsiderIds = aliveOutsiders.map((entry) => entry.id);
      const outsiderNames = aliveOutsiders.map((entry) => entry.roleName).join(" / ") || "无";
      addPrivateInfo(state, godfather, `[开局] 你看到在场外来者信息：${outsiderNames}。`);
    });

  state.players
    .filter((entry) => entry.roleId === BMR.GRANDMOTHER)
    .forEach((grandmother) => {
      const candidates = state.players.filter((entry) => entry.id !== grandmother.id && entry.team === "good");
      const child = chooseOne(candidates);
      if (!child) {
        return;
      }
      state.bmr.grandmotherChildById[grandmother.id] = child.id;
      const text = `[开局] 你的孙子是 ${child.name}，其身份为 ${child.roleName}。`;
      addPrivateInfo(state, grandmother, text);
      state.events.infoPings.push({
        night: state.night,
        actorId: grandmother.id,
        type: "grandmother",
        targetId: child.id,
        shownRoleId: child.roleId,
        text,
      });
    });

  state.players
    .filter((entry) => entry.roleId === BMR.LUNATIC)
    .forEach((lunatic) => {
      const fakeDemons = allRoles.filter((entry) => entry.category === "demon" && entry.id !== lunatic.roleId);
      const fakeDemon = chooseOne(fakeDemons) ?? chooseOne(allRoles.filter((entry) => entry.category === "demon"));
      const fakeMinions = sample(
        state.players.filter((entry) => entry.id !== lunatic.id),
        Math.min(state.setupCounts.minion, Math.max(1, state.players.length - 1))
      );
      const fakeBluffRoles = sample(allRoles.filter((entry) => entry.category === "townsfolk"), 3);
      const fakeBluffs = fakeBluffRoles.map((entry) => entry.name).join(" / ");
      if (fakeDemon) {
        lunatic.apparentRoleId = fakeDemon.id;
        lunatic.apparentRoleName = fakeDemon.name;
        lunatic.apparentRoleIcon = fakeDemon.icon ?? null;
        lunatic.apparentCategory = fakeDemon.category;
        lunatic.apparentTeam = fakeDemon.team;
        state.bmr.lunaticFakeDemonRoleById[lunatic.id] = fakeDemon.id;
      }
      state.bmr.lunaticFakeMinionIdsById[lunatic.id] = fakeMinions.map((entry) => entry.id);
      state.bmr.lunaticFakeBluffRoleIdsById[lunatic.id] = fakeBluffRoles.map((entry) => entry.id);
      addPrivateInfo(
        state,
        lunatic,
        `[开局] 你收到幻觉信息：你是 ${fakeDemon?.name ?? "恶魔"}。你的“爪牙”是 ${fakeMinions
          .map((entry) => entry.name)
          .join(" / ")}。不在场善良角色：${fakeBluffs}。`
      );
    });

  const lunatics = state.players.filter((entry) => entry.roleId === BMR.LUNATIC);
  const lunaticSummary = lunatics
    .map((entry) => `${entry.name}（以为自己是 ${entry.apparentRoleName ?? "恶魔"}）`)
    .join(" / ");
  if (lunaticSummary) {
    state.players
      .filter((entry) => entry.category === "demon")
      .forEach((demon) => {
        addPrivateInfo(state, demon, `[开局] 你知道疯子信息：${lunaticSummary}。`);
      });
  }
}

function refreshTeaLadyProtection(ctx) {
  const { state, aliveNeighbors, getEffectiveRoleId, isAbilityBlocked } = ctx;
  if (!state.bmr) {
    return [];
  }
  const protectedIds = [];
  state.players
    .filter((entry) => entry.alive && getEffectiveRoleId(entry) === BMR.TEA_LADY && !isAbilityBlocked(entry))
    .forEach((teaLady) => {
      const neighbors = aliveNeighbors(state, teaLady);
      if (neighbors.length < 2) {
        return;
      }
      if (neighbors.every((entry) => entry.team === "good")) {
        neighbors.forEach((entry) => {
          if (!protectedIds.includes(entry.id)) {
            protectedIds.push(entry.id);
          }
        });
      }
    });
  state.bmr.teaLadyProtectedIds = protectedIds;
  return protectedIds;
}

function maybeBlockDeathByTeaLady(ctx, victim, reason, logType) {
  const { state, addLog } = ctx;
  if (!state.bmr || !victim?.alive) {
    return false;
  }
  refreshTeaLadyProtection(ctx);
  if (!state.bmr.teaLadyProtectedIds.includes(victim.id)) {
    return false;
  }
  addLog(state, logType, `${victim.name} 受到 Tea Lady 保护，免于死亡。`, {
    victimId: victim.id,
    reason,
  });
  return true;
}

function isDemonNightDeathReason(reason) {
  return reason === "demon-kill" || reason === "pukka-delayed-kill" || reason === "shabaloth-kill";
}

function maybeBlockDeathByInnkeeper(ctx, victim, reason, logType) {
  const { state, addLog } = ctx;
  if (
    !state.bmr ||
    !victim?.alive ||
    !state.bmr.innkeeperProtectedIds?.includes(victim.id) ||
    !isDemonNightDeathReason(reason)
  ) {
    return false;
  }
  addLog(state, logType, `${victim.name} 受到 Innkeeper 保护，免于死亡。`, {
    victimId: victim.id,
    reason,
  });
  return true;
}

function maybeSaveBySailor(ctx, victim, reason, logType) {
  const { state, addLog, getEffectiveRoleId, isAbilityBlocked } = ctx;
  if (!state.bmr || !victim?.alive || getEffectiveRoleId(victim) !== BMR.SAILOR) {
    return false;
  }
  if (isAbilityBlocked(victim)) {
    return false;
  }
  addLog(state, logType, `${victim.name} 受到 Sailor 免死效果保护。`, {
    victimId: victim.id,
    reason,
  });
  return true;
}

function maybeSaveByFool(ctx, victim, reason, logType) {
  const { state, addLog, isAbilityBlocked } = ctx;
  if (!state.bmr || victim.roleId !== BMR.FOOL || !victim.alive) {
    return false;
  }
  if (isAbilityBlocked(victim)) {
    return false;
  }
  if (state.bmr.foolSavedById[victim.id]) {
    return false;
  }
  state.bmr.foolSavedById[victim.id] = true;
  addLog(state, logType, `${victim.name} 触发 Fool 保命效果，抵消了本次死亡。`, {
    victimId: victim.id,
    reason,
  });
  return true;
}

function maybeSaveByZombuul(ctx, victim, reason, logType) {
  const { state, addLog, isAbilityBlocked } = ctx;
  if (!state.bmr || victim.roleId !== BMR.ZOMBUUL || state.bmr.zombuulRevived || !victim.alive) {
    return false;
  }
  if (isAbilityBlocked(victim)) {
    return false;
  }
  state.bmr.zombuulRevived = true;
  state.bmr.zombuulHiddenDead = true;
  state.bmr.zombuulHiddenDeadPlayerId = victim.id;
  addLog(state, logType, `${victim.name} 触发 Zombuul 诈死效果，暂未真正死亡。`, {
    victimId: victim.id,
    reason,
  });
  return true;
}

function pacifistSaveWeight(ctx, victim, reason) {
  const { state, getAlivePlayers } = ctx;
  const factors = [];
  let weight = 0.22;

  const push = (id, delta) => {
    if (!delta) {
      return;
    }
    weight += delta;
    factors.push({ id, delta: Number(delta.toFixed(3)) });
  };

  if (victim.category === "townsfolk") {
    push("townsfolk", 0.12);
  } else if (victim.category === "outsider") {
    push("outsider", 0.04);
  }
  if (victim.roleId === BMR.PACIFIST) {
    push("self", 0.08);
  }
  if (victim.roleId === BMR.MOONCHILD) {
    push("avoid-moonchild-chain", 0.05);
  }
  if (victim.roleId === BMR.FOOL) {
    push("fool-backup-only", -0.08);
  }
  if (reason === "virgin-trigger") {
    push("sudden-execution", 0.08);
  }
  if ((state.day ?? 0) <= 1) {
    push("early-day", 0.05);
  }

  const alive = getAlivePlayers(state);
  const aliveGood = alive.filter((entry) => entry.team === "good").length;
  if (aliveGood <= 3) {
    push("protect-low-good-count", 0.16);
  } else if (aliveGood <= 4) {
    push("protect-tight-good-count", 0.08);
  }
  if (state.bmr?.mastermindPendingDay === state.day) {
    push("mastermind-extra-day", -0.18);
  }
  if (victim.category === "outsider" && state.players.some((entry) => entry.alive && entry.roleId === BMR.GODFATHER)) {
    push("avoid-blocking-godfather-signal-too-often", -0.06);
  }

  return {
    weight: clampNumber(weight, 0.05, 0.65),
    factors,
  };
}

function maybeSaveByPacifist(ctx, victim, reason) {
  const { state, rng, addLog, getEffectiveRoleId, isAbilityBlocked } = ctx;
  if (!state.bmr || victim.team !== "good" || !victim.alive || state.bmr.pacifistSavedToday) {
    return false;
  }
  const activePacifists = state.players.filter(
    (entry) => entry.alive && getEffectiveRoleId(entry) === BMR.PACIFIST && !isAbilityBlocked(entry)
  );
  if (activePacifists.length === 0) {
    return false;
  }
  const decision = pacifistSaveWeight(ctx, victim, reason);
  const roll = rng();
  if (roll >= decision.weight) {
    return false;
  }
  state.bmr.pacifistSavedToday = true;
  addLog(state, "day-skill", `${victim.name} 受到 Pacifist 影响，免于本次处决。`, {
    victimId: victim.id,
    reason,
    weight: decision.weight,
    roll,
    factors: decision.factors,
    pacifistIds: activePacifists.map((entry) => entry.id),
  });
  return true;
}

function onBeforeExecutionDeath(ctx, { victim, reason }) {
  const { state, addLog } = ctx;
  if (!state.bmr) {
    return { prevented: false };
  }
  if (maybeSaveBySailor(ctx, victim, reason, "day-skill")) {
    return { prevented: true };
  }
  if (maybeBlockDeathByTeaLady(ctx, victim, reason, "day-skill")) {
    return { prevented: true };
  }
  if (maybeSaveByFool(ctx, victim, reason, "night-effect")) {
    return { prevented: true };
  }
  if (state.bmr.devilsAdvocateProtectedId === victim.id && victim.alive) {
    addLog(state, "day-skill", `${victim.name} 受到 Devil's Advocate 保护，免于本次处决。`, {
      victimId: victim.id,
      reason,
    });
    state.bmr.devilsAdvocateProtectedId = null;
    return { prevented: true };
  }
  if (maybeSaveByPacifist(ctx, victim, reason)) {
    return { prevented: true };
  }
  if (maybeSaveByZombuul(ctx, victim, reason, "day-skill")) {
    return { prevented: true };
  }
  return { prevented: false };
}

function onBeforeNightDeath(ctx, { victim, reason, unstoppable }) {
  if (unstoppable) {
    return { prevented: false };
  }
  if (maybeSaveBySailor(ctx, victim, reason, "night-effect")) {
    return { prevented: true };
  }
  if (maybeBlockDeathByInnkeeper(ctx, victim, reason, "night-effect")) {
    return { prevented: true };
  }
  if (maybeBlockDeathByTeaLady(ctx, victim, reason, "day-skill")) {
    return { prevented: true };
  }
  if (maybeSaveByFool(ctx, victim, reason, "night-effect")) {
    return { prevented: true };
  }
  if (maybeSaveByZombuul(ctx, victim, reason, "night-effect")) {
    return { prevented: true };
  }
  return { prevented: false };
}

function onBeforeDayDeath(ctx, { victim, reason }) {
  if (maybeSaveBySailor(ctx, victim, reason, "day-skill")) {
    return { prevented: true };
  }
  if (maybeBlockDeathByTeaLady(ctx, victim, reason, "day-skill")) {
    return { prevented: true };
  }
  if (maybeSaveByFool(ctx, victim, reason, "day-skill")) {
    return { prevented: true };
  }
  if (maybeSaveByZombuul(ctx, victim, reason, "day-skill")) {
    return { prevented: true };
  }
  return { prevented: false };
}

function triggerGrandmotherDeathIfNeeded(ctx, victim, reason, payload) {
  const { state, rng, getPlayerById, processNightDeath } = ctx;
  if (!state.bmr) {
    return;
  }
  if (!isDemonNightDeathReason(reason)) {
    return;
  }
  Object.entries(state.bmr.grandmotherChildById ?? {}).forEach(([grandmotherId, childId]) => {
    if (childId !== victim.id) {
      return;
    }
    const grandmother = getPlayerById(state, grandmotherId);
    if (!grandmother?.alive) {
      return;
    }
    processNightDeath(state, grandmother, "grandmother-grief", { by: payload?.by ?? null }, rng);
  });
}

function triggerMoonchildChoice(ctx, victim, phase) {
  const { state, addLog, chooseRandomAliveExcluding, enqueueStorytellerAction, playerChoiceOptions, processNightDeath, rng } = ctx;
  if (!state.bmr || victim.roleId !== BMR.MOONCHILD) {
    return;
  }
  if (victim.isHuman && enqueueStorytellerAction) {
    enqueueStorytellerAction(state, {
      type: "moonchild-choice",
      actorId: victim.id,
      roleId: BMR.MOONCHILD,
      roleName: victim.roleName,
      roleIcon: victim.roleIcon,
      inputType: "player-target",
      targetCount: 1,
      options: playerChoiceOptions(state, { actorId: victim.id, allowDead: false, allowSelf: false }),
      prompt: "月之子死亡。请选择 1 名存活玩家；如果该玩家为善良阵营，今晚他会死亡。",
      phaseLabel: `第${state.day}天`,
      interaction: {
        title: "月之子的遗言",
        subtitle: "你死亡后必须指定一名存活玩家。",
        badge: "Moonchild",
        targetLabels: ["指定玩家"],
        helper: "若你指定的是善良玩家，该玩家会在下一个夜晚死亡。",
        confirmText: "确认指定",
        skipText: "自动指定",
      },
      logText: "Moonchild 死亡，等待主视角指定玩家。",
    });
    return;
  }
  const target = chooseRandomAliveExcluding(state, [victim.id]);
  if (!target) {
    return;
  }
  if (phase === "night") {
    let died = false;
    if (target.team === "good") {
      died = processNightDeath(state, target, "moonchild-trigger", { by: victim.id }, rng);
    }
    addLog(state, "death-trigger", `${victim.name} 触发 Moonchild，指定了 ${target.name}。`, {
      victimId: victim.id,
      targetId: target.id,
      immediateNight: true,
      died,
    });
    return;
  }
  state.bmr.moonchildPendingById[victim.id] = target.id;
  addLog(state, "death-trigger", `${victim.name} 触发 Moonchild，指定了 ${target.name}。`, {
    victimId: victim.id,
    targetId: target.id,
  });
}

function onAfterExecutionDeath(ctx, { victim }) {
  const { state, addAbilityInterference, addLog, getAlivePlayers, getEffectiveRoleId, isAbilityBlocked } = ctx;
  if (!state.bmr) {
    return;
  }

  if (victim.category === "outsider") {
    state.bmr.lastDayOutsiderExecuted = true;
  }
  if (victim.category === "minion") {
    state.bmr.lastDayMinionExecuted = true;
    if (state.players.some((entry) => entry.alive && getEffectiveRoleId(entry) === BMR.MINSTREL && !isAbilityBlocked(entry))) {
      state.bmr.minstrelAoeDrunkUntilNight = Math.max(state.bmr.minstrelAoeDrunkUntilNight, state.night + 1);
      addAbilityInterference(state, getAlivePlayers(state).length);
    }
  }

  if (
    victim.category === "demon" &&
    state.players.some((entry) => entry.alive && getEffectiveRoleId(entry) === BMR.MASTERMIND && !isAbilityBlocked(entry))
  ) {
    state.bmr.mastermindPendingDay = state.day + 1;
    addLog(state, "day-skill", "Mastermind 生效：恶魔被处决后进入额外一天结算。", {
      day: state.day,
      pendingDay: state.bmr.mastermindPendingDay,
    });
  }
}

function onAfterExecutionOutcome(ctx, { victim }) {
  const { state, finalizeWinner, addLog } = ctx;
  if (!state.bmr || state.gameOver || state.bmr.mastermindPendingDay !== state.day) {
    return;
  }
  state.bmr.mastermindPendingDay = null;
  const winner = victim.team === "good" ? "evil" : "good";
  addLog(state, "day-skill", "Mastermind 额外日发生处决，按被处决玩家阵营结算。", {
    day: state.day,
    nomineeId: victim.id,
    nomineeTeam: victim.team,
    winner,
  });
  finalizeWinner(
    state,
    winner,
    victim.team === "good"
      ? "Mastermind 额外日处决了善良玩家，邪恶阵营获胜。"
      : "Mastermind 额外日处决了邪恶玩家，善良阵营获胜。"
  );
}

function onAfterDayDeath(ctx, { victim }) {
  const { state } = ctx;
  if (!state.bmr) {
    return;
  }
  if (victim.category === "outsider") {
    state.bmr.lastDayOutsiderExecuted = true;
  }
}

function onAfterNightDeath(ctx, { victim, reason, payload }) {
  triggerGrandmotherDeathIfNeeded(ctx, victim, reason, payload);
}

function onAfterDeath(ctx, { victim, phase }) {
  triggerMoonchildChoice(ctx, victim, phase);
}

function normalizeStatementText(text) {
  return `${text ?? ""}`.trim().toLowerCase();
}

function mentionedSeatPlayer(state, text) {
  const match = normalizeStatementText(text).match(/(?:#|seat\s*)?(\d+)\s*(?:号|號|seat)?/i);
  if (!match) {
    return null;
  }
  const seat = Number(match[1]);
  if (!Number.isFinite(seat)) {
    return null;
  }
  return state.players.find((entry) => entry.seatIndex + 1 === seat) ?? null;
}

function statementMentions(text, patterns) {
  const normalized = normalizeStatementText(text);
  return patterns.some((pattern) => normalized.includes(pattern));
}

function evaluateKnownGossipStatement(ctx, statementText) {
  const { state, getAllRoles, getEffectiveRoleId } = ctx;
  const text = normalizeStatementText(statementText);
  if (!text) {
    return null;
  }

  const target = mentionedSeatPlayer(state, text);
  if (target) {
    if (statementMentions(text, ["邪恶", "evil", "坏人"])) {
      return target.team === "evil";
    }
    if (statementMentions(text, ["善良", "good", "好人"])) {
      return target.team === "good";
    }
    if (statementMentions(text, ["恶魔", "demon"])) {
      return target.category === "demon";
    }
    if (statementMentions(text, ["爪牙", "minion"])) {
      return target.category === "minion";
    }
    if (statementMentions(text, ["外来者", "outsider"])) {
      return target.category === "outsider";
    }
    if (statementMentions(text, ["镇民", "townsfolk"])) {
      return target.category === "townsfolk";
    }
    if (statementMentions(text, ["死亡", "死了", "dead"])) {
      return !target.alive;
    }
    if (statementMentions(text, ["存活", "活着", "alive"])) {
      return target.alive;
    }

    const role = getAllRoles(state.scriptId).find((entry) => {
      const names = [entry.id, entry.name, entry.englishName].filter(Boolean).map((value) => `${value}`.toLowerCase());
      return names.some((name) => name && text.includes(name));
    });
    if (role) {
      return getEffectiveRoleId(target) === role.id;
    }
  }

  if (statementMentions(text, ["没有恶魔", "no demon"])) {
    return !state.players.some((entry) => entry.category === "demon");
  }
  if (statementMentions(text, ["有恶魔", "has demon", "there is a demon"])) {
    return state.players.some((entry) => entry.category === "demon");
  }
  if (statementMentions(text, ["没有爪牙", "no minion"])) {
    return !state.players.some((entry) => entry.category === "minion");
  }
  if (statementMentions(text, ["有爪牙", "has minion", "there is a minion"])) {
    return state.players.some((entry) => entry.category === "minion");
  }
  return null;
}

function onEndOfDay(ctx) {
  const { state, rng, addLog, getEffectiveRoleId, isAbilityBlocked } = ctx;
  if (!state.bmr) {
    return;
  }
  if (state.day <= 0) {
    return;
  }
  const statementsToday = state.bmr.gossipStatementsByDay?.[state.day] ?? {};
  const gossips = state.players.filter(
    (entry) => entry.alive && getEffectiveRoleId(entry) === BMR.GOSSIP && !isAbilityBlocked(entry)
  );
  let addedKills = 0;
  gossips.forEach((gossip) => {
    const submitted = statementsToday[gossip.id];
    if (submitted && !submitted.resolved) {
      const evaluated = evaluateKnownGossipStatement(ctx, submitted.text);
      const trueStatement = evaluated === null ? rng() < 0.5 : !!evaluated;
      submitted.resolved = true;
      submitted.trueStatement = trueStatement;
      submitted.heuristic = evaluated === null;
      if (trueStatement) {
        addedKills += 1;
      }
      addLog(state, "day-skill", `Gossip 声明已判定：${trueStatement ? "为真" : "不为真"}。`, {
        day: state.day,
        playerId: gossip.id,
        heuristic: evaluated === null,
      });
      return;
    }
    const spokeToday = state.events.speeches.some((entry) => entry.day === state.day && entry.playerId === gossip.id);
    if (!spokeToday && gossip.isHuman) {
      return;
    }
    if (rng() < 0.5) {
      addedKills += 1;
    }
  });
  if (addedKills > 0) {
    state.bmr.gossipPendingKills += addedKills;
    addLog(state, "day-skill", `Gossip 的声明中有 ${addedKills} 条被判定为真，今晚将触发额外死亡。`, {
      day: state.day,
      kills: addedKills,
    });
  }
}

function onNoExecution(ctx) {
  const { state, finalizeWinner } = ctx;
  if (state.bmr?.mastermindPendingDay === state.day) {
    state.bmr.mastermindPendingDay = null;
    finalizeWinner(state, "good", "Mastermind 额外日无人处决，善良阵营获胜。");
  }
}

export const BMR_RULE_HANDLERS = {
  onSetup,
  onBeforeExecutionDeath,
  onBeforeDayDeath,
  onBeforeNightDeath,
  onAfterExecutionDeath,
  onAfterExecutionOutcome,
  onAfterDayDeath,
  onAfterNightDeath,
  onAfterDeath,
  onEndOfDay,
  onNoExecution,
};
