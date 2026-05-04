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

export const BMR_ROLE_ACTION_RULES = {
  [BMR.SAILOR]: {
    kind: "player-target",
    targetCount: 1,
    allowSelf: false,
    allowDead: false,
    minNight: 1,
    prompt: "Choose 1 living player as tonight's Sailor drink target.",
  },
  [BMR.CHAMBERMAID]: {
    kind: "player-target",
    targetCount: 2,
    allowSelf: false,
    allowDead: false,
    minNight: 1,
    prompt: "Choose 2 living players to check whether they woke tonight due to their own ability.",
  },
  [BMR.EXORCIST]: {
    kind: "player-target",
    targetCount: 1,
    allowSelf: false,
    allowDead: false,
    minNight: 2,
    prompt: "Choose 1 living player to exorcise.",
  },
  [BMR.INNKEEPER]: {
    kind: "player-target",
    targetCount: 2,
    allowSelf: false,
    allowDead: false,
    minNight: 2,
    prompt: "Choose 2 living players to protect tonight.",
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
    minNight: 1,
    prompt: "Choose 1 living player to protect with Devil's Advocate.",
  },
  [BMR.ASSASSIN]: {
    kind: "player-target",
    targetCount: 1,
    allowSelf: false,
    allowDead: false,
    minNight: 1,
    maxUses: 1,
    prompt: "Choose 1 living player as the Assassin target.",
  },
  [BMR.PUKKA]: {
    kind: "player-target",
    targetCount: 1,
    allowSelf: false,
    allowDead: false,
    minNight: 2,
    prompt: "Choose 1 living player to poison with Pukka.",
  },
  [BMR.SHABALOTH]: {
    kind: "player-target",
    targetCount: 2,
    allowSelf: false,
    allowDead: false,
    minNight: 2,
    prompt: "Choose 2 living players as Shabaloth targets.",
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
    minNight: 2,
    prompt: "Choose 1 living player as Zombuul target when no one died today.",
  },
  [BMR.LUNATIC]: {
    kind: "player-target",
    targetCount: 1,
    allowSelf: false,
    allowDead: false,
    minNight: 2,
    prompt: "Choose 1 living player as your Lunatic demon target.",
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
    if (delayed?.alive) {
      processNightDeath(state, delayed, "pukka-delayed-kill", {}, rng);
    }
    bmr.pukkaPoisonedId = null;
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
        { allowSelf: false, allowDead: false, preferredPool: getAlivePlayers(state).filter((entry) => entry.id !== sailor.id) },
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
      const candidates = getAlivePlayers(state).filter((entry) => entry.id !== exorcist.id && entry.id !== previousId);
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
        { allowSelf: false, allowDead: false, preferredPool: getAlivePlayers(state).filter((entry) => entry.id !== innkeeper.id) },
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
          { allowSelf: false, allowDead: false, preferredPool: getAlivePlayers(state).filter((entry) => entry.id !== gambler.id) },
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
        { allowSelf: false, allowDead: false, preferredPool: getAlivePlayers(state).filter((entry) => entry.id !== maid.id) },
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
      addPrivateInfo(state, maid, `[第${state.night}夜] 你选择的两名玩家中有 ${count} 人在夜间因自身能力醒来。`);
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
      const deadTownsfolk = state.players.filter((entry) => !entry.alive && entry.category === "townsfolk");
      if (deadTownsfolk.length === 0) {
        return;
      }
      const planned = professor.isHuman
        ? consumeHumanNightPlanTargets(state, professor, 1, { allowSelf: false, allowDead: true })
        : null;
      let target = planned?.[0] ?? chooseOne(deadTownsfolk, rng);
      if (!target || target.alive || target.category !== "townsfolk") {
        target = chooseOne(deadTownsfolk, rng);
      }
      if (!target) {
        return;
      }
      bmr.professorUsedByIds.push(professor.id);
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
      const candidates = getAlivePlayers(state).filter((entry) => entry.id !== advisor.id && entry.id !== previous);
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
      const planned = assassin.isHuman
        ? consumeHumanNightPlanTargets(state, assassin, 1, { allowSelf: false, allowDead: false })
        : null;
      if (!planned && !assassin.isHuman && rng() > 0.28) {
        return;
      }
      const target =
        planned?.[0] ??
        pickNightTargets(
          state,
          assassin,
          1,
          { allowSelf: false, allowDead: false, preferredPool: getAlivePlayers(state).filter((entry) => entry.id !== assassin.id) },
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
          { allowSelf: false, allowDead: false, preferredPool: getAlivePlayers(state).filter((entry) => entry.id !== lunatic.id) },
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
  markWokeTonight(state, demon, "demon");

  if (demonRole === BMR.ZOMBUUL) {
    const hadExecutionToday = state.events.executions.some((entry) => entry.day === state.day);
    if (!hadExecutionToday) {
      const target = pickNightTargets(
        state,
        demon,
        1,
        { allowSelf: false, allowDead: false, preferredPool: getAlivePlayers(state).filter((entry) => entry.id !== demon.id) },
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
      { allowSelf: false, allowDead: false, preferredPool: getAlivePlayers(state).filter((entry) => entry.id !== demon.id) },
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
      { allowSelf: false, allowDead: false, preferredPool: getAlivePlayers(state).filter((entry) => entry.id !== demon.id) },
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
      targets =
        plannedPo?.targets ??
        sample(
          getAlivePlayers(state).filter((entry) => entry.id !== demon.id),
          Math.min(3, Math.max(0, getAlivePlayers(state).length - 1)),
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
          { allowSelf: false, allowDead: false, preferredPool: getAlivePlayers(state).filter((entry) => entry.id !== demon.id) },
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
      addPrivateInfo(state, grandmother, `[开局] 你的孙子是 ${child.name}，其身份为 ${child.roleName}。`);
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
  const { state, addLog } = ctx;
  if (!state.bmr || victim.roleId !== BMR.ZOMBUUL || state.bmr.zombuulRevived || !victim.alive) {
    return false;
  }
  state.bmr.zombuulRevived = true;
  state.bmr.zombuulHiddenDead = true;
  addLog(state, logType, `${victim.name} 触发 Zombuul 诈死效果，暂未真正死亡。`, {
    victimId: victim.id,
    reason,
  });
  return true;
}

function onBeforeExecutionDeath(ctx, { victim, reason }) {
  const { state, rng, addAbilityInterference, addLog, getAlivePlayers, getEffectiveRoleId, isAbilityBlocked } = ctx;
  if (!state.bmr) {
    return { prevented: false };
  }
  if (maybeBlockDeathByTeaLady(ctx, victim, reason, "day-skill")) {
    return { prevented: true };
  }
  if (maybeSaveByFool(ctx, victim, reason, "night-effect")) {
    return { prevented: true };
  }
  if (
    victim.team === "good" &&
    victim.alive &&
    !state.bmr.pacifistSavedToday &&
    state.players.some((entry) => entry.alive && getEffectiveRoleId(entry) === BMR.PACIFIST && !isAbilityBlocked(entry)) &&
    rng() < 0.33
  ) {
    state.bmr.pacifistSavedToday = true;
    addLog(state, "day-skill", `${victim.name} 受到 Pacifist 影响，免于本次处决。`, {
      victimId: victim.id,
      reason,
    });
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
  if (maybeSaveByZombuul(ctx, victim, reason, "day-skill")) {
    return { prevented: true };
  }
  return { prevented: false };
}

function onBeforeNightDeath(ctx, { victim, reason, unstoppable }) {
  if (unstoppable) {
    return { prevented: false };
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

function triggerGrandmotherDeathIfNeeded(ctx, victim, reason, payload) {
  const { state, rng, getPlayerById, processNightDeath } = ctx;
  if (!state.bmr) {
    return;
  }
  const demonCaused = reason === "demon-kill" || reason === "pukka-delayed-kill" || reason === "shabaloth-kill";
  if (!demonCaused) {
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

function triggerMoonchildChoice(ctx, victim) {
  const { state, addLog, chooseRandomAliveExcluding, enqueueStorytellerAction, playerChoiceOptions } = ctx;
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

  if (state.bmr.mastermindPendingDay === state.day && victim.category !== "demon") {
    state.bmr.mastermindPendingDay = null;
    addLog(state, "day-skill", "Mastermind 额外日出现处决，延迟结算结束。", { day: state.day });
  }

  if (victim.category === "outsider") {
    state.bmr.lastDayOutsiderExecuted = true;
  }
  if (victim.category === "minion") {
    state.bmr.lastDayMinionExecuted = true;
    if (state.players.some((entry) => entry.alive && getEffectiveRoleId(entry) === BMR.MINSTREL)) {
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

function onAfterNightDeath(ctx, { victim, reason, payload }) {
  triggerGrandmotherDeathIfNeeded(ctx, victim, reason, payload);
}

function onAfterDeath(ctx, { victim }) {
  triggerMoonchildChoice(ctx, victim);
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
    finalizeWinner(state, "evil", "Mastermind 额外日无人处决，邪恶阵营获胜。");
  }
}

export const BMR_RULE_HANDLERS = {
  onSetup,
  onBeforeExecutionDeath,
  onBeforeNightDeath,
  onAfterExecutionDeath,
  onAfterNightDeath,
  onAfterDeath,
  onEndOfDay,
  onNoExecution,
};
