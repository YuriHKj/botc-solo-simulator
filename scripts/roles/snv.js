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
    kind: "player-target",
    targetCount: 1,
    allowSelf: false,
    allowDead: false,
    minNight: 1,
    maxUses: 1,
    prompt: "Choose 1 player as Philosopher reference target.",
  },
  [SNV.ARTIST]: {
    kind: "player-target",
    targetCount: 1,
    allowSelf: false,
    allowDead: false,
    minNight: 1,
    maxUses: 1,
    prompt: "Choose 1 player as Artist question target.",
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
    targetCount: 1,
    allowSelf: false,
    allowDead: false,
    minNight: 1,
    prompt: "Choose 1 player as Cerenovus madness target.",
  },
  [SNV.PIT_HAG]: {
    kind: "player-target",
    targetCount: 1,
    allowSelf: false,
    allowDead: false,
    minNight: 1,
    prompt: "Choose 1 player as Pit-Hag transform target.",
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
      const target = pickNightTargets(
        state,
        cerenovus,
        1,
        { allowSelf: false, allowDead: false, preferredPool: getAlivePlayers(state).filter((entry) => entry.id !== cerenovus.id) },
        rng
      )[0];
      if (!target) {
        return;
      }
      const forcedRole = chooseOne(getAllRoles(state.scriptId), rng);
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
      const target = pickNightTargets(
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
      const nextRole = chooseOne(pool, rng);
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
      const target = pickNightTargets(
        state,
        philosopher,
        1,
        { allowSelf: false, allowDead: false, preferredPool: getAlivePlayers(state).filter((entry) => entry.id !== philosopher.id) },
        rng
      )[0];

      const townsfolkPool = (getTownsfolkRoles(state.scriptId) ?? []).filter((entry) => entry.id !== SNV.PHILOSOPHER);
      if (townsfolkPool.length === 0) {
        return;
      }

      snv.philosopherUsedByIds.push(philosopher.id);
      let copiedRoleId = null;
      if (target?.category === "townsfolk") {
        copiedRoleId = target.roleId;
      } else {
        copiedRoleId = chooseOne(townsfolkPool, rng)?.id ?? null;
      }
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
  const { state, addLog, chooseRandomAliveExcluding, finalizeWinner } = ctx;
  if (!state.snv || victim.roleId !== SNV.KLUTZ) {
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

function triggerSageInfo(ctx, victim, killerDemonId) {
  const { state, addPrivateInfo, chooseOne, getPlayerById, shuffle } = ctx;
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
  addPrivateInfo(state, victim, `[第${state.night}夜] 你作为贤者看见两人中有一名恶魔：${shuffled[0].name} / ${shuffled[1].name}。`);
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
