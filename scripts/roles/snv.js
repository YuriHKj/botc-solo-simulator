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

export const SNV_ROLE_ACTION_RULES = {
  [SNV.DREAMER]: {
    kind: "player-target",
    targetCount: 1,
    allowSelf: false,
    allowDead: false,
    minNight: 1,
    prompt: "Choose 1 player for Dreamer information.",
  },
  [SNV.SNAKE_CHARMER]: {
    kind: "player-target",
    targetCount: 1,
    allowSelf: false,
    allowDead: false,
    minNight: 1,
    prompt: "Choose 1 player as Snake Charmer target.",
  },
  [SNV.SEAMSTRESS]: {
    kind: "player-target",
    targetCount: 2,
    allowSelf: false,
    allowDead: false,
    minNight: 1,
    maxUses: 1,
    prompt: "Choose 2 players to compare alignment.",
  },
  [SNV.PHILOSOPHER]: {
    kind: "role-choice",
    inputType: "role",
    targetCount: 0,
    allowSelf: false,
    allowDead: false,
    roleCategories: ["townsfolk"],
    excludeRoleIds: [SNV.PHILOSOPHER],
    minNight: 1,
    maxUses: 1,
    prompt: "选择你想获得的一个镇民角色能力。",
    interaction: {
      title: "哲学家的顿悟",
      subtitle: "选择一个镇民能力。若该角色在场，原持有者会醉酒。",
      style: "divination",
      badge: "选择角色",
      helper: "这是官方能力的关键交互：不是选玩家，而是直接选择一个角色能力。",
      confirmText: "获得该能力",
      skipText: "让系统代选",
    },
  },
  [SNV.ARTIST]: {
    kind: "question",
    inputType: "question",
    targetCount: 0,
    allowSelf: false,
    allowDead: false,
    minNight: 1,
    maxUses: 1,
    prompt: "向 Storyteller 提出一个是/否问题。",
    interaction: {
      title: "艺术家的提问",
      subtitle: "写下一个是/否问题，Storyteller 会给出“是/否”答案。",
      style: "divination",
      badge: "是/否问题",
      helper: "当前版本会用本地规则粗略回答常见问题；复杂自然语言会给出保守的 Storyteller 式答案。",
      confirmText: "提交问题",
      skipText: "暂不提问",
    },
  },
  [SNV.WITCH]: {
    kind: "player-target",
    targetCount: 1,
    allowSelf: false,
    allowDead: false,
    minNight: 1,
    prompt: "Choose 1 player to curse with Witch.",
  },
  [SNV.CERENOVUS]: {
    kind: "player-target",
    inputType: "player-role",
    targetCount: 1,
    allowSelf: false,
    allowDead: false,
    minNight: 1,
    prompt: "选择 1 名玩家，并指定 ta 明天应声称的角色。",
  },
  [SNV.PIT_HAG]: {
    kind: "player-target",
    inputType: "player-role",
    targetCount: 1,
    allowSelf: false,
    allowDead: false,
    minNight: 1,
    prompt: "选择 1 名玩家，并把 ta 变成指定角色。",
  },
  [SNV.FANG_GU]: {
    kind: "player-target",
    targetCount: 1,
    allowSelf: false,
    allowDead: false,
    minNight: 2,
    prompt: "Choose 1 living player as Fang Gu night kill target.",
  },
  [SNV.VIGORMORTIS]: {
    kind: "player-target",
    targetCount: 1,
    allowSelf: false,
    allowDead: false,
    minNight: 2,
    prompt: "Choose 1 living player as Vigormortis night kill target.",
  },
  [SNV.NO_DASHII]: {
    kind: "player-target",
    targetCount: 1,
    allowSelf: false,
    allowDead: false,
    minNight: 2,
    prompt: "Choose 1 living player as No Dashii night kill target.",
  },
  [SNV.VORTOX]: {
    kind: "player-target",
    targetCount: 1,
    allowSelf: false,
    allowDead: false,
    minNight: 2,
    prompt: "Choose 1 living player as Vortox night kill target.",
  },
};

export const SNV_DAY_ACTION_RULES = {
  [SNV.JUGGLER]: {
    kind: "guesses",
    inputType: "guesses",
    targetCount: 0,
    allowSelf: true,
    allowDead: true,
    minDay: 1,
    maxUses: 1,
    minGuessCount: 1,
    maxGuessCount: 5,
    allowedStages: ["public", "nomination"],
    prompt: "填写最多 5 组“玩家 + 角色”杂耍猜测。",
    interaction: {
      title: "杂耍艺人的宣告",
      subtitle: "白天公开猜测若干玩家的角色，今晚会得知猜中数量。",
      style: "divination",
      badge: "最多五组",
      helper: "每名玩家最多填写一次。提交后会在夜晚结算你的猜中数量。",
      confirmText: "公开杂耍猜测",
      skipText: "暂不杂耍",
    },
  },
};

export const SNV_ROLE_DEFINITIONS = Object.freeze({
  [SNV.CLOCKMAKER]: { id: SNV.CLOCKMAKER, scriptAgnostic: true, phaseHooks: { firstNight: "engine:simplified" } },
  [SNV.DREAMER]: { id: SNV.DREAMER, scriptAgnostic: true, action: SNV_ROLE_ACTION_RULES[SNV.DREAMER], phaseHooks: { eachNight: "engine:simplified" } },
  [SNV.SNAKE_CHARMER]: { id: SNV.SNAKE_CHARMER, scriptAgnostic: true, action: SNV_ROLE_ACTION_RULES[SNV.SNAKE_CHARMER], phaseHooks: { eachNight: "engine:simplified" } },
  [SNV.MATHEMATICIAN]: { id: SNV.MATHEMATICIAN, scriptAgnostic: true, phaseHooks: { eachNight: "engine:simplified" } },
  [SNV.FLOWERGIRL]: { id: SNV.FLOWERGIRL, scriptAgnostic: true, phaseHooks: { otherNight: "engine:simplified" } },
  [SNV.TOWN_CRIER]: { id: SNV.TOWN_CRIER, scriptAgnostic: true, phaseHooks: { otherNight: "engine:simplified" } },
  [SNV.ORACLE]: { id: SNV.ORACLE, scriptAgnostic: true, phaseHooks: { otherNight: "engine:simplified" } },
  [SNV.SAVANT]: { id: SNV.SAVANT, scriptAgnostic: true, phaseHooks: { eachDay: "engine:simplified" } },
  [SNV.SEAMSTRESS]: { id: SNV.SEAMSTRESS, scriptAgnostic: true, action: SNV_ROLE_ACTION_RULES[SNV.SEAMSTRESS], phaseHooks: { eachNight: "engine:simplified" } },
  [SNV.PHILOSOPHER]: { id: SNV.PHILOSOPHER, scriptAgnostic: true, action: SNV_ROLE_ACTION_RULES[SNV.PHILOSOPHER], phaseHooks: { eachNight: "engine:simplified" } },
  [SNV.ARTIST]: { id: SNV.ARTIST, scriptAgnostic: true, action: SNV_ROLE_ACTION_RULES[SNV.ARTIST], phaseHooks: { eachNight: "engine:simplified" } },
  [SNV.JUGGLER]: { id: SNV.JUGGLER, scriptAgnostic: true, phaseHooks: { dayAction: "engine:simplified", otherNight: "engine:simplified" } },
  [SNV.SAGE]: { id: SNV.SAGE, scriptAgnostic: true, phaseHooks: { onDeathByDemon: "engine:simplified" } },
  [SNV.MUTANT]: { id: SNV.MUTANT, scriptAgnostic: true, phaseHooks: { onPublicClaim: "engine:simplified" } },
  [SNV.SWEETHEART]: { id: SNV.SWEETHEART, scriptAgnostic: true, phaseHooks: { onDeath: "engine:simplified" } },
  [SNV.BARBER]: { id: SNV.BARBER, scriptAgnostic: true, phaseHooks: { onDeath: "engine:simplified" } },
  [SNV.KLUTZ]: { id: SNV.KLUTZ, scriptAgnostic: true, phaseHooks: { onDeath: "engine:simplified" } },
  [SNV.EVIL_TWIN]: { id: SNV.EVIL_TWIN, scriptAgnostic: true, phaseHooks: { setup: "engine:simplified", onExecution: "engine:simplified" } },
  [SNV.WITCH]: { id: SNV.WITCH, scriptAgnostic: true, action: SNV_ROLE_ACTION_RULES[SNV.WITCH], phaseHooks: { eachNight: "engine:simplified" } },
  [SNV.CERENOVUS]: { id: SNV.CERENOVUS, scriptAgnostic: true, action: SNV_ROLE_ACTION_RULES[SNV.CERENOVUS], phaseHooks: { eachNight: "engine:simplified" } },
  [SNV.PIT_HAG]: { id: SNV.PIT_HAG, scriptAgnostic: true, action: SNV_ROLE_ACTION_RULES[SNV.PIT_HAG], phaseHooks: { eachNight: "engine:simplified" } },
  [SNV.FANG_GU]: { id: SNV.FANG_GU, scriptAgnostic: true, action: SNV_ROLE_ACTION_RULES[SNV.FANG_GU], phaseHooks: { otherNight: "engine:simplified" } },
  [SNV.VIGORMORTIS]: { id: SNV.VIGORMORTIS, scriptAgnostic: true, action: SNV_ROLE_ACTION_RULES[SNV.VIGORMORTIS], phaseHooks: { otherNight: "engine:simplified" } },
  [SNV.NO_DASHII]: { id: SNV.NO_DASHII, scriptAgnostic: true, action: SNV_ROLE_ACTION_RULES[SNV.NO_DASHII], phaseHooks: { otherNight: "engine:simplified" } },
  [SNV.VORTOX]: { id: SNV.VORTOX, scriptAgnostic: true, action: SNV_ROLE_ACTION_RULES[SNV.VORTOX], phaseHooks: { otherNight: "engine:simplified" } },
});

export function runSectsAndVioletsNight(ctx) {
  const { state, rng } = ctx;
  const {
    addAbilityInterference,
    addLog,
    addPrivateInfo,
    applyVigormortisNeighborPoison,
    chooseOne,
    consumeHumanNightPlan,
    getAliveDemons,
    getAlivePlayers,
    getAllRoles,
    getEffectiveRoleId,
    getPlayerById,
    getRoleById,
    getTownsfolkRoles,
    isAbilityBlocked,
    isRoleNightWindowOpen,
    nearestAliveTownsfolkByDirection,
    pickNightTargets,
    processNightDeath,
    sample,
    setRole,
    swapRolesByRoleId,
  } = ctx;
  if (!state.snv) {
    return;
  }
  const snv = state.snv;

  if (snv.sweetheartDrunkId) {
    const drunkTarget = getPlayerById(state, snv.sweetheartDrunkId);
    if (drunkTarget?.alive) {
      drunkTarget.poisoned = true;
      drunkTarget.poisonedTomorrowDay = true;
    }
  }

  const activeMinion = (entry) =>
    (entry.alive || snv.vigormortisEmpoweredMinionIds.includes(entry.id)) &&
    !isAbilityBlocked(entry, state);

  (snv.vigormortisEmpoweredMinionIds ?? []).forEach((minionId) => {
    const minion = getPlayerById(state, minionId);
    if (!minion) {
      return;
    }
    applyVigormortisNeighborPoison(state, minion);
  });

  state.players
    .filter(
      (entry) =>
        activeMinion(entry) &&
        getEffectiveRoleId(entry) === SNV.WITCH &&
        isRoleNightWindowOpen(state, SNV.WITCH, state.night)
    )
    .forEach((witch) => {
      const target = pickNightTargets(
        state,
        witch,
        1,
        { allowSelf: false, allowDead: false, preferredPool: getAlivePlayers(state).filter((entry) => entry.id !== witch.id) },
        rng
      )[0];
      if (!target) {
        return;
      }
      snv.witchCurses[target.id] = state.day + 1;
    });

  state.players
    .filter(
      (entry) =>
        activeMinion(entry) &&
        getEffectiveRoleId(entry) === SNV.CERENOVUS &&
        isRoleNightWindowOpen(state, SNV.CERENOVUS, state.night)
    )
    .forEach((cerenovus) => {
      const planned = cerenovus.isHuman
        ? consumeHumanNightPlan(state, cerenovus, { allowSelf: false, allowDead: false, minTargets: 1, maxTargets: 1 })
        : null;
      const target =
        planned?.targets?.[0] ??
        pickNightTargets(
          state,
          cerenovus,
          1,
          { allowSelf: false, allowDead: false, preferredPool: getAlivePlayers(state).filter((entry) => entry.id !== cerenovus.id) },
          rng
        )[0];
      if (!target) {
        return;
      }
      const forcedRole = planned?.role ?? chooseOne(getAllRoles(state.scriptId), rng);
      if (!forcedRole) {
        return;
      }
      snv.cerenovusForcedByPlayerId[target.id] = forcedRole.id;
      snv.cerenovusEnforceDayByPlayerId[target.id] = state.day + 1;
      if (target.isHuman) {
        addPrivateInfo(state, target, `[第${state.night}夜] 你受到 Cerenovus 影响，明天请优先声称“${forcedRole.name}”。`);
      }
    });

  state.players
    .filter(
      (entry) =>
        activeMinion(entry) &&
        getEffectiveRoleId(entry) === SNV.PIT_HAG &&
        isRoleNightWindowOpen(state, SNV.PIT_HAG, state.night)
    )
    .forEach((pitHag) => {
      const planned = pitHag.isHuman
        ? consumeHumanNightPlan(state, pitHag, { allowSelf: false, allowDead: false, minTargets: 1, maxTargets: 1 })
        : null;
      const target =
        planned?.targets?.[0] ??
        pickNightTargets(
          state,
          pitHag,
          1,
          { allowSelf: false, allowDead: false, preferredPool: getAlivePlayers(state).filter((entry) => entry.id !== pitHag.id) },
          rng
        )[0];
      if (!target) {
        return;
      }
      const pool = getAllRoles(state.scriptId).filter((role) => role.id !== target.roleId);
      const plannedRoleStillValid = planned?.role && planned.role.id !== target.roleId ? planned.role : null;
      const nextRole = plannedRoleStillValid ?? chooseOne(pool, rng);
      if (!nextRole) {
        return;
      }
      const beforeRole = target.roleName;
      setRole(target, nextRole);
      snv.pitHagTransforms.push({ night: state.night, playerId: target.id, from: beforeRole, to: target.roleName });
      addLog(state, "night-effect", "Pit-Hag 改变了一名玩家身份。", { by: pitHag.id, targetId: target.id });
    });

  const aliveDemonsAfterTransform = getAliveDemons(state);
  if (aliveDemonsAfterTransform.length > 1) {
    const survivor = chooseOne(aliveDemonsAfterTransform, rng);
    aliveDemonsAfterTransform
      .filter((entry) => survivor && entry.id !== survivor.id)
      .forEach((extraDemon) => {
        processNightDeath(
          state,
          extraDemon,
          "pit-hag-demon-overflow",
          { survivorId: survivor?.id ?? null },
          rng,
          { unstoppable: true }
        );
      });
    addLog(state, "night-effect", "Pit-Hag 造成多恶魔后，系统仅保留 1 名恶魔存活。", {
      survivorId: survivor?.id ?? null,
      demonIds: aliveDemonsAfterTransform.map((entry) => entry.id),
    });
  }

  state.players
    .filter(
      (entry) =>
        entry.alive &&
        getEffectiveRoleId(entry) === SNV.SNAKE_CHARMER &&
        isRoleNightWindowOpen(state, SNV.SNAKE_CHARMER, state.night) &&
        !isAbilityBlocked(entry, state)
    )
    .forEach((charmer) => {
      const target = pickNightTargets(
        state,
        charmer,
        1,
        { allowSelf: false, allowDead: false, preferredPool: getAlivePlayers(state).filter((entry) => entry.id !== charmer.id) },
        rng
      )[0];
      if (!target || target.category !== "demon") {
        return;
      }
      if (swapRolesByRoleId(state, charmer, target)) {
        addLog(state, "night-effect", "Snake Charmer 命中恶魔，双方身份已交换。", {
          charmerId: charmer.id,
          demonId: target.id,
        });
        if (charmer.isHuman) {
          addPrivateInfo(
            state,
            charmer,
            `[第${state.night}夜] 你作为舞蛇人选中了恶魔 ${target.name}，你们的身份已交换；你现在是 ${charmer.roleName}。`
          );
        }
        if (target.isHuman) {
          addPrivateInfo(
            state,
            target,
            `[第${state.night}夜] 舞蛇人选中了你，你们的身份已交换；你现在是 ${target.roleName}。`
          );
        }
      }
    });

  state.players
    .filter(
      (entry) =>
        entry.alive &&
        getEffectiveRoleId(entry) === SNV.PHILOSOPHER &&
        isRoleNightWindowOpen(state, SNV.PHILOSOPHER, state.night) &&
        !isAbilityBlocked(entry, state)
    )
    .forEach((philosopher) => {
      if (snv.philosopherUsedByIds.includes(philosopher.id)) {
        return;
      }
      const planned = philosopher.isHuman ? consumeHumanNightPlan(state, philosopher, { minTargets: 0, maxTargets: 0 }) : null;

      const townsfolkPool = (getTownsfolkRoles(state.scriptId) ?? []).filter((entry) => entry.id !== SNV.PHILOSOPHER);
      if (townsfolkPool.length === 0) {
        return;
      }

      snv.philosopherUsedByIds.push(philosopher.id);
      const plannedRole = planned?.role && planned.role.category === "townsfolk" && planned.role.id !== SNV.PHILOSOPHER ? planned.role : null;
      const copiedRoleId = plannedRole?.id ?? chooseOne(townsfolkPool, rng)?.id ?? null;
      const role = copiedRoleId ? getRoleById(state.scriptId, copiedRoleId) : null;
      if (!role) {
        return;
      }
      snv.philosopherCopiedById[philosopher.id] = role.id;
      setRole(philosopher, role);

      const inPlayCarrier = state.players.find((entry) => entry.id !== philosopher.id && entry.roleId === role.id);
      if (inPlayCarrier) {
        inPlayCarrier.poisoned = true;
        inPlayCarrier.poisonedTomorrowDay = true;
        addAbilityInterference(state, 1);
      }

      addLog(state, "night-effect", "Philosopher 获得了新的角色能力。", {
        philosopherId: philosopher.id,
        roleId: role.id,
        drunkTargetId: inPlayCarrier?.id ?? null,
      });
    });

  state.players
    .filter(
      (entry) =>
        entry.alive &&
        getEffectiveRoleId(entry) === SNV.NO_DASHII &&
        isRoleNightWindowOpen(state, SNV.NO_DASHII, state.night) &&
        !isAbilityBlocked(entry, state)
    )
    .forEach((demon) => {
      const left = nearestAliveTownsfolkByDirection(state, demon, -1);
      const right = nearestAliveTownsfolkByDirection(state, demon, 1);
      [left, right]
        .filter((entry, idx, arr) => entry && arr.findIndex((probe) => probe?.id === entry.id) === idx)
        .forEach((neighbor) => {
          neighbor.poisoned = true;
          neighbor.poisonedTomorrowDay = true;
          if (!snv.noDashiiPoisonedIds.includes(neighbor.id)) {
            snv.noDashiiPoisonedIds.push(neighbor.id);
          }
          addAbilityInterference(state, 1);
        });
    });

  if (snv.barberDiedToday) {
    const demon = getAliveDemons(state)[0];
    if (demon) {
      const swapTargets = sample(
        state.players.filter((entry) => entry.alive && entry.id !== demon.id),
        Math.min(2, Math.max(0, getAlivePlayers(state).length - 1)),
        rng
      );
      if (swapTargets.length === 2 && swapRolesByRoleId(state, swapTargets[0], swapTargets[1])) {
        addLog(state, "night-effect", "Barber 死亡后，恶魔交换了两名玩家身份。", {
          demonId: demon.id,
          a: swapTargets[0].id,
          b: swapTargets[1].id,
        });
      }
    }
    snv.barberDiedToday = false;
  }
}

function onSetup(ctx) {
  const { state, addPrivateInfo, chooseOne } = ctx;
  if (!state.snv) {
    return;
  }
  const evilTwin = state.players.find((entry) => entry.roleId === SNV.EVIL_TWIN);
  if (!evilTwin) {
    return;
  }
  const goodCandidates = state.players.filter((entry) => entry.team === "good" && entry.id !== evilTwin.id);
  const goodTwin = chooseOne(goodCandidates);
  if (!goodTwin) {
    return;
  }
  state.snv.evilTwinPair = {
    evilTwinId: evilTwin.id,
    goodTwinId: goodTwin.id,
  };
  addPrivateInfo(state, evilTwin, `[开局] 你绑定的另一名双子是 ${goodTwin.name}。`);
  addPrivateInfo(state, goodTwin, `[开局] 你绑定的另一名双子是 ${evilTwin.name}。`);
}

function triggerSweetheartDrunk(ctx, victim) {
  const { state, addAbilityInterference, addLog, chooseRandomAliveExcluding } = ctx;
  if (!state.snv || victim.roleId !== SNV.SWEETHEART) {
    return;
  }
  const target = chooseRandomAliveExcluding(state, [victim.id]);
  if (!target) {
    return;
  }
  state.snv.sweetheartDrunkId = target.id;
  target.poisoned = true;
  target.poisonedTomorrowDay = true;
  addAbilityInterference(state, 1);
  addLog(state, "death-trigger", `${victim.name} 的 Sweetheart 效果触发，${target.name} 变为醉酒。`, {
    victimId: victim.id,
    targetId: target.id,
  });
}

function triggerKlutzChoice(ctx, victim) {
  const { state, addLog, chooseRandomAliveExcluding, enqueueStorytellerAction, finalizeWinner, playerChoiceOptions } = ctx;
  if (!state.snv || victim.roleId !== SNV.KLUTZ) {
    return;
  }
  if (victim.isHuman && enqueueStorytellerAction) {
    enqueueStorytellerAction(state, {
      type: "klutz-choice",
      actorId: victim.id,
      roleId: SNV.KLUTZ,
      roleName: victim.roleName,
      roleIcon: victim.roleIcon,
      inputType: "player-target",
      targetCount: 1,
      options: playerChoiceOptions(state, { actorId: victim.id, allowDead: false, allowSelf: false }),
      prompt: "呆瓜死亡。请选择 1 名存活玩家；如果你选择邪恶玩家，善良阵营立即失败。",
      phaseLabel: `第${state.day}天`,
      interaction: {
        title: "呆瓜的最终指认",
        subtitle: "你死亡后必须公开指出一名玩家。",
        badge: "Klutz",
        targetLabels: ["指认玩家"],
        helper: "点中邪恶玩家会让善良阵营立刻失败。",
        confirmText: "确认指认",
        skipText: "自动指认",
      },
      logText: "Klutz 死亡，等待主视角指认玩家。",
    });
    return;
  }
  const target = chooseRandomAliveExcluding(state, [victim.id]);
  if (!target) {
    return;
  }
  if (target.team === "evil") {
    addLog(state, "death-trigger", `${victim.name} 触发 Klutz 并错误点中邪恶玩家，善良阵营立即失败。`, {
      victimId: victim.id,
      targetId: target.id,
    });
    finalizeWinner(state, "evil", "Klutz 点中了邪恶玩家，善良阵营失败。");
    return;
  }
  addLog(state, "death-trigger", `${victim.name} 触发 Klutz，点中了善良玩家 ${target.name}，未触发失败。`, {
    victimId: victim.id,
    targetId: target.id,
  });
}

function triggerBarberChoice(ctx, victim) {
  const { state, enqueueStorytellerAction, getAliveDemons, playerChoiceOptions } = ctx;
  if (!state.snv || victim.roleId !== SNV.BARBER) {
    return;
  }
  const humanDemon = getAliveDemons(state).find((entry) => entry.isHuman);
  if (!humanDemon || !enqueueStorytellerAction) {
    return;
  }
  enqueueStorytellerAction(state, {
    type: "barber-swap",
    actorId: victim.id,
    controllerId: humanDemon.id,
    roleId: SNV.BARBER,
    roleName: victim.roleName,
    roleIcon: victim.roleIcon,
    inputType: "player-target",
    targetCount: 2,
    options: playerChoiceOptions(state, {
      actorId: humanDemon.id,
      allowDead: false,
      allowSelf: true,
      filter: (player) => player.category !== "demon",
    }),
    prompt: "理发师死亡。作为恶魔，你可以选择 2 名非恶魔玩家交换角色。",
    phaseLabel: `第${state.day}天 / 第${state.night}夜`,
    interaction: {
      title: "理发师死亡",
      subtitle: "恶魔醒来，可以交换两名玩家的角色。",
      badge: "Barber",
      targetLabels: ["交换对象一", "交换对象二"],
      helper: "第一版实现限制为两名存活非恶魔玩家。",
      confirmText: "确认交换",
      skipText: "自动交换",
    },
    logText: "Barber 死亡，等待主视角恶魔选择交换目标。",
  });
}

function triggerSageInfo(ctx, victim, killerDemonId) {
  const { state, addPrivateInfo, chooseOne, enqueueStorytellerAction, getPlayerById, shuffle } = ctx;
  if (!state.snv || victim.roleId !== SNV.SAGE) {
    return;
  }
  const demon = getPlayerById(state, killerDemonId);
  const others = state.players.filter((entry) => entry.id !== victim.id && entry.id !== killerDemonId);
  const randomOther = chooseOne(others);
  const pair = [demon, randomOther].filter(Boolean);
  if (pair.length < 2) {
    return;
  }
  const shuffled = shuffle(pair);
  const informationText = `[第${state.night}夜] 你作为贤者看见两人中有一名恶魔：${shuffled[0].name} / ${shuffled[1].name}。`;
  if (victim.isHuman && enqueueStorytellerAction) {
    enqueueStorytellerAction(state, {
      type: "sage-info",
      actorId: victim.id,
      roleId: SNV.SAGE,
      roleName: victim.roleName,
      roleIcon: victim.roleIcon,
      inputType: "info",
      targetCount: 0,
      minTargetCount: 0,
      maxTargetCount: 0,
      targetIds: shuffled.map((entry) => entry.id),
      informationText,
      prompt: "贤者被恶魔杀死。Storyteller 会告诉你两名玩家，其中一名是恶魔。",
      phaseLabel: `第${state.night}夜`,
      interaction: {
        title: "贤者的最后启示",
        subtitle: "你被恶魔杀死，Storyteller 低声告诉你一条临终信息。",
        style: "divination",
        badge: "死亡信息",
        helper: "这条信息会进入你的私人夜间信息和事件日志；其他玩家不会自动知道。",
        confirmText: "记住这条信息",
        skipText: "直接记录",
      },
      logText: "Sage 被恶魔杀死，等待主视角确认贤者信息。",
    });
    return;
  }
  addPrivateInfo(state, victim, informationText);
}

function triggerEvilTwinExecutionOutcome(ctx, victim) {
  const { state, finalizeWinner } = ctx;
  if (!state.snv?.evilTwinPair || !victim) {
    return;
  }
  if (victim.id === state.snv.evilTwinPair.goodTwinId) {
    finalizeWinner(state, "evil", "好双子被处决，邪恶阵营获胜。");
    return;
  }
  if (victim.id === state.snv.evilTwinPair.evilTwinId) {
    finalizeWinner(state, "good", "邪恶双子被处决，善良阵营获胜。");
  }
}

function onAfterExecutionDeath(ctx, { victim }) {
  const { state } = ctx;
  if (!state.snv) {
    return;
  }
  state.snv.dayDeathsByRoleId[victim.roleId] = (state.snv.dayDeathsByRoleId[victim.roleId] ?? 0) + 1;
  if (victim.roleId === SNV.BARBER) {
    state.snv.barberDiedToday = true;
  }
}

function onAfterNightDeath(ctx, { victim, reason, payload }) {
  const { state } = ctx;
  if (!state.snv) {
    return;
  }
  if (reason === "demon-kill") {
    state.snv.dayDeathsByRoleId[victim.roleId] = (state.snv.dayDeathsByRoleId[victim.roleId] ?? 0) + 1;
  }
  if (victim.roleId === SNV.SAGE && reason === "demon-kill") {
    triggerSageInfo(ctx, victim, payload?.by);
  }
}

function onAfterDeath(ctx, { victim }) {
  triggerSweetheartDrunk(ctx, victim);
  triggerKlutzChoice(ctx, victim);
  triggerBarberChoice(ctx, victim);
}

function onAfterExecutionOutcome(ctx, { victim }) {
  triggerEvilTwinExecutionOutcome(ctx, victim);
}

function onEndOfDay(ctx) {
  const {
    state,
    rng,
    addLog,
    chooseOne,
    getAllRoles,
    getEffectiveRoleId,
    getPlayerById,
    getRoleById,
    isAbilityBlocked,
    processExecutionDeath,
    sample,
  } = ctx;
  if (!state.snv) {
    return;
  }
  const snv = state.snv;
  Object.entries(snv.cerenovusEnforceDayByPlayerId ?? {}).forEach(([playerId, day]) => {
    if (Number(day) !== state.day) {
      return;
    }
    const player = getPlayerById(state, playerId);
    if (!player?.alive || isAbilityBlocked(player)) {
      return;
    }
    const forcedRoleId = snv.cerenovusForcedByPlayerId[playerId];
    if (!forcedRoleId) {
      return;
    }
    if (player.publicClaimRoleId !== forcedRoleId) {
      processExecutionDeath(state, player, "cerenovus-break", { forcedRoleId }, rng);
      addLog(state, "day-skill", "Cerenovus 惩罚触发：目标未按要求发言而死亡。", {
        playerId,
        forcedRoleId,
      });
    }
    delete snv.cerenovusForcedByPlayerId[playerId];
    delete snv.cerenovusEnforceDayByPlayerId[playerId];
  });

  state.players
    .filter((entry) => entry.alive && getEffectiveRoleId(entry) === SNV.MUTANT && !isAbilityBlocked(entry))
    .forEach((mutant) => {
      if (!mutant.publicClaimRoleId) {
        return;
      }
      const claimedRole = getRoleById(state.scriptId, mutant.publicClaimRoleId);
      if (!claimedRole || claimedRole.category !== "outsider") {
        return;
      }
      if (rng() < 0.7) {
        processExecutionDeath(state, mutant, "mutant-claim-break", { roleId: claimedRole.id }, rng);
        addLog(state, "day-skill", "Mutant 公开声称外来者，触发即时处决。", {
          playerId: mutant.id,
          roleId: claimedRole.id,
        });
      }
    });

  if (state.day === 1) {
    state.players
      .filter((entry) => entry.alive && getEffectiveRoleId(entry) === SNV.JUGGLER && !snv.jugglerGuessesByDay[entry.id])
      .forEach((juggler) => {
        const candidates = sample(
          state.players.filter((entry) => entry.id !== juggler.id),
          Math.min(5, Math.max(0, state.players.length - 1))
        );
        const guesses = candidates.map((entry) => ({
          playerId: entry.id,
          roleId: entry.publicClaimRoleId ?? chooseOne(getAllRoles(state.scriptId))?.id ?? entry.roleId,
        }));
        snv.jugglerGuessesByDay[juggler.id] = {
          day: state.day,
          resolved: false,
          guesses,
        };
      });
  }
}

function onRegisterClaim(ctx, { player, roleId }) {
  const { state, addLog, checkWin, getEffectiveRoleId, getRoleById, isAbilityBlocked, processExecutionDeath } = ctx;
  if (state.scriptId !== "snv" || getEffectiveRoleId(player) !== SNV.MUTANT || !player.alive) {
    return;
  }
  const claimedRole = getRoleById(state.scriptId, roleId);
  if (claimedRole?.category === "outsider" && !isAbilityBlocked(player) && Math.random() < 0.7) {
    processExecutionDeath(state, player, "mutant-claim-break", { roleId }, Math.random);
    addLog(state, "day-skill", "Mutant 公开声称外来者后被判定违规处决。", {
      playerId: player.id,
      roleId,
    });
    checkWin(state);
  }
}

function onNomination(ctx, { nominator, nominee }) {
  const { state, addLog, checkWin, processExecutionDeath, rng } = ctx;
  if (state.snv?.witchCurses?.[nominator.id] !== state.day) {
    return { blocked: false };
  }
  delete state.snv.witchCurses[nominator.id];
  processExecutionDeath(state, nominator, "witch-curse", { nomineeId: nominee.id }, rng);
  addLog(state, "day-skill", "Witch 诅咒触发：提名者因行动而死亡。", {
    nominatorId: nominator.id,
    nomineeId: nominee.id,
  });
  checkWin(state);
  return { blocked: true, reason: `${nominator.name} 触发了 Witch 诅咒。` };
}

function onNominationAccepted(ctx, { nominator }) {
  const { state } = ctx;
  if (state.snv && nominator.category === "minion") {
    state.snv.lastDayHadMinionNomination = true;
  }
}

function onVotesTallied(ctx, { votes }) {
  const { state, getPlayerById } = ctx;
  if (!state.snv) {
    return;
  }
  const demonVoted = votes.some((entry) => {
    if (!entry.vote) {
      return false;
    }
    const voter = getPlayerById(state, entry.voterId);
    return voter?.category === "demon";
  });
  if (demonVoted) {
    state.snv.lastDayHadDemonVote = true;
  }
}

function onNoExecution(ctx) {
  const { state, finalizeWinner, getEffectiveRoleId } = ctx;
  if (state.scriptId !== "snv") {
    return;
  }
  const vortoxAlive = state.players.some((entry) => entry.alive && getEffectiveRoleId(entry) === SNV.VORTOX);
  if (vortoxAlive) {
    finalizeWinner(state, "evil", "Vortox 在无人处决的白天触发了邪恶胜利。");
  }
}

export const SNV_RULE_HANDLERS = {
  onSetup,
  onAfterExecutionDeath,
  onAfterNightDeath,
  onAfterDeath,
  onAfterExecutionOutcome,
  onEndOfDay,
  onRegisterClaim,
  onNomination,
  onNominationAccepted,
  onVotesTallied,
  onNoExecution,
};
