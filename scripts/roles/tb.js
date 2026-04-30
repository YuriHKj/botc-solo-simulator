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

export const TB_ROLE_ACTION_RULES = {
  [TB.BUTLER]: {
    kind: "player-target",
    targetCount: 1,
    allowSelf: false,
    allowDead: false,
    minNight: 1,
    prompt: "选择 1 名存活玩家，作为你今晚的主人。",
    interaction: {
      title: "管家的誓言",
      subtitle: "Storyteller 递来银盘，请选择今晚必须跟随投票的主人。",
      style: "oath",
      badge: "投票约束",
      targetLabels: ["今晚的主人"],
      helper: "白天投票时，你只能在主人投票时投票。主人死亡或你死亡前，这个选择会影响你的合法投票。",
      confirmText: "立下誓言",
      skipText: "让系统代选主人",
    },
  },
  [TB.FORTUNE_TELLER]: {
    kind: "player-target",
    targetCount: 2,
    allowSelf: true,
    allowDead: true,
    minNight: 1,
    prompt: "选择 2 名玩家进行查验（可包含自己或死亡玩家）。",
    interaction: {
      title: "占卜师的水晶球",
      subtitle: "选择两枚命运刻印，Storyteller 会告诉你其中是否有恶魔信号。",
      style: "divination",
      badge: "可选死亡玩家",
      targetLabels: ["第一枚刻印", "第二枚刻印"],
      helper: "可以选择自己或死亡玩家。注意：红鲱鱼会让一个非恶魔也可能被看成恶魔。",
      confirmText: "凝视水晶球",
      skipText: "让系统代选查验",
    },
  },
  [TB.MONK]: {
    kind: "player-target",
    targetCount: 1,
    allowSelf: false,
    allowDead: false,
    minNight: 2,
    prompt: "选择 1 名存活玩家进行守护。",
    interaction: {
      title: "僧侣的守护",
      subtitle: "为一名村民画下守护圈，使其免受恶魔今晚的攻击。",
      style: "ward",
      badge: "不能保护自己",
      targetLabels: ["受守护者"],
      helper: "守护只防恶魔击杀，不阻止中毒、处决或其他非恶魔死亡来源。",
      confirmText: "点亮守护圈",
      skipText: "让系统代选守护",
    },
  },
  [TB.POISONER]: {
    kind: "player-target",
    targetCount: 1,
    allowSelf: false,
    allowDead: false,
    minNight: 1,
    prompt: "选择 1 名存活玩家施加中毒。",
    interaction: {
      title: "投毒者的药瓶",
      subtitle: "黑色药液在瓶中晃动，选择今晚要让谁的能力失准。",
      style: "venom",
      badge: "邪恶行动",
      targetLabels: ["中毒目标"],
      helper: "目标本夜到明天白天会处于中毒状态。主视角若不是全知，不会知道客观中毒结果。",
      confirmText: "倒下毒药",
      skipText: "让系统代选投毒",
    },
  },
  [TB.IMP]: {
    kind: "player-target",
    targetCount: 1,
    allowSelf: true,
    allowDead: false,
    minNight: 2,
    prompt: "选择 1 名存活玩家进行击杀（可选自己完成自杀跳刀）。",
    interaction: {
      title: "小恶魔的夜袭",
      subtitle: "钟声熄灭后选择一名存活玩家。选择自己会尝试触发跳刀。",
      style: "demon",
      badge: "可选择自己",
      targetLabels: ["今晚的死亡"],
      helper: "若你选择自己并且有存活爪牙，恶魔身份会转移给爪牙；否则按普通夜袭结算。",
      confirmText: "发动夜袭",
      skipText: "让系统代选击杀",
    },
  },
};

export const TB_DAY_ACTION_RULES = {
  [TB.SLAYER]: {
    kind: "player-target",
    targetCount: 1,
    allowSelf: false,
    allowDead: false,
    minDay: 1,
    maxUses: 1,
    allowedStages: ["public", "nomination"],
    prompt: "选择 1 名存活玩家并发动猎手能力。",
    interaction: {
      title: "猎手的银弹",
      subtitle: "白天的喧嚣短暂安静下来。选择一名玩家开枪，若目标是恶魔且你能力有效，ta 会立刻死亡。",
      style: "slayer",
      badge: "每局一次",
      targetLabels: ["开枪目标"],
      helper: "私聊阶段不能开枪。中毒或醉酒时，枪声仍会响起，但不会杀死恶魔。",
      confirmText: "扣下扳机",
      skipText: "暂不发动",
    },
  },
};

export const TB_PASSIVE_INTERACTIONS = {
  [TB.VIRGIN]: {
    title: "贞洁者的试炼",
    subtitle: "第一次被镇民提名时，提名者会立刻被处决。",
    style: "trial",
    badge: "首次提名触发",
  },
  [TB.MAYOR]: {
    title: "镇长的最终表决",
    subtitle: "仅剩 3 人且今日无人处决时，善良方获胜；夜晚被恶魔攻击时，死亡可能转移。",
    style: "civic",
    badge: "终局条件",
  },
};

function actorsFor(ctx, roleId, { requireAlive = true, requireUnblocked = false, useEffective = true } = {}) {
  return ctx.state.players.filter((player) => {
    if (requireAlive && !player.alive) {
      return false;
    }
    const currentRoleId = useEffective ? ctx.getEffectiveRoleId(player) : player.roleId;
    if (currentRoleId !== roleId) {
      return false;
    }
    if (requireUnblocked && ctx.isAbilityBlocked(player)) {
      return false;
    }
    return true;
  });
}

function randomRoleFromCategory(ctx, category) {
  const pool = ctx.getAllRoles(ctx.state.scriptId).filter((entry) => entry.category === category);
  return ctx.chooseOne(pool)?.id ?? null;
}

function randomRoleAny(ctx) {
  return ctx.chooseOne(ctx.getAllRoles(ctx.state.scriptId))?.id ?? null;
}

function maybeDistortRoleId(ctx, roleId, category, blocked) {
  if (!blocked) {
    return roleId;
  }
  if (category) {
    return randomRoleFromCategory(ctx, category) ?? roleId;
  }
  return randomRoleAny(ctx) ?? roleId;
}

function twoPlayerPair(ctx, anchor, pool = ctx.state.players) {
  const another = ctx.chooseOne(ctx.state.players.filter((entry) => entry.id !== anchor?.id));
  return ctx.shuffle([anchor, another].filter(Boolean)).slice(0, 2);
}

function goodFalsePair(ctx) {
  const goodPlayers = ctx.state.players.filter((entry) => entry.team === "good");
  const pool = goodPlayers.length >= 2 ? goodPlayers : ctx.state.players;
  return ctx.sample(pool, Math.min(2, pool.length));
}

function minionBluffRoleId(ctx) {
  return randomRoleFromCategory(ctx, "minion") ?? TB.POISONER;
}

function sendWasherwomanInfo(ctx, player) {
  const blocked = ctx.isAbilityBlocked(player);
  const townsfolkPlayers = ctx.state.players.filter((entry) => entry.category === "townsfolk");
  if (townsfolkPlayers.length === 0 && !blocked) {
    ctx.addPrivateInfo(ctx.state, player, `[第${ctx.state.night}夜] 你未得到有效镇民线索。`);
    return;
  }

  const trueHolder = blocked ? ctx.chooseOne(ctx.state.players) : ctx.chooseOne(townsfolkPlayers);
  if (!trueHolder) {
    return;
  }
  const shownRoleId = maybeDistortRoleId(ctx, trueHolder.roleId, "townsfolk", blocked);
  const pair = twoPlayerPair(ctx, trueHolder);
  if (pair.length < 2) {
    return;
  }

  const text = `[第${ctx.state.night}夜] 你得知：${pair[0].name} 与 ${pair[1].name} 中，有一位是 ${ctx.getRoleNameById(ctx.state, shownRoleId)}。`;
  ctx.addPrivateInfo(ctx.state, player, text);
  ctx.state.events.infoPings.push({ night: ctx.state.night, actorId: player.id, type: "washerwoman", polluted: blocked, text });
}

function sendLibrarianInfo(ctx, player) {
  const blocked = ctx.isAbilityBlocked(player);
  const outsiders = ctx.state.players.filter((entry) => entry.category === "outsider");

  if (outsiders.length === 0 && !blocked) {
    const text = `[第${ctx.state.night}夜] 你得知：本局没有外来者。`;
    ctx.addPrivateInfo(ctx.state, player, text);
    ctx.state.events.infoPings.push({ night: ctx.state.night, actorId: player.id, type: "librarian", text });
    return;
  }

  const trueHolder = blocked ? ctx.chooseOne(ctx.state.players) : ctx.chooseOne(outsiders);
  if (!trueHolder) {
    return;
  }
  const shownRoleId = maybeDistortRoleId(ctx, trueHolder.roleId, "outsider", blocked);
  const pair = twoPlayerPair(ctx, trueHolder);
  if (pair.length < 2) {
    return;
  }

  const text = `[第${ctx.state.night}夜] 你得知：${pair[0].name} 与 ${pair[1].name} 中，有一位是 ${ctx.getRoleNameById(ctx.state, shownRoleId)}。`;
  ctx.addPrivateInfo(ctx.state, player, text);
  ctx.state.events.infoPings.push({ night: ctx.state.night, actorId: player.id, type: "librarian", polluted: blocked, text });
}

function sendInvestigatorInfo(ctx, player) {
  const blocked = ctx.isAbilityBlocked(player);
  const minions = ctx.state.players.filter((entry) => entry.category === "minion");
  let pair;
  let shownRoleId;
  let truthHolderId = null;

  if (blocked) {
    pair = goodFalsePair(ctx);
    shownRoleId = minionBluffRoleId(ctx);
  } else {
    const trueHolder = minions.length > 0 ? ctx.chooseOne(minions) : ctx.chooseOne(ctx.state.players);
    if (!trueHolder) {
      return;
    }
    truthHolderId = trueHolder.id;
    shownRoleId = trueHolder.roleId;
    pair = twoPlayerPair(ctx, trueHolder);
  }

  if (!pair || pair.length < 2) {
    return;
  }

  const text = `[第${ctx.state.night}夜] 你得知：${pair[0].name} 与 ${pair[1].name} 中，有一位是 ${ctx.getRoleNameById(ctx.state, shownRoleId)}。`;
  ctx.addPrivateInfo(ctx.state, player, text);
  ctx.state.events.infoPings.push({
    night: ctx.state.night,
    actorId: player.id,
    type: "investigator",
    targetIds: pair.map((entry) => entry.id),
    truthHolderId,
    shownRoleId,
    polluted: blocked,
    text,
  });
}

function countAdjacentEvilPairs(ctx) {
  const seated = ctx.getSortedBySeat(ctx.state.players);
  if (seated.length < 2) {
    return 0;
  }

  let pairs = 0;
  for (let idx = 0; idx < seated.length; idx += 1) {
    const a = seated[idx];
    const b = seated[(idx + 1) % seated.length];
    if (ctx.registersAsTeam(a, "evil") && ctx.registersAsTeam(b, "evil")) {
      pairs += 1;
    }
  }
  return pairs;
}

function sendChefInfo(ctx, player) {
  const blocked = ctx.isAbilityBlocked(player);
  const truth = countAdjacentEvilPairs(ctx);
  const shown = blocked ? ctx.randomInt(0, 3) : truth;
  const text = `[第${ctx.state.night}夜] 你得知：邪恶相邻对数为 ${shown}。`;
  ctx.addPrivateInfo(ctx.state, player, text);
  ctx.state.events.infoPings.push({ night: ctx.state.night, actorId: player.id, type: "chef", truth, shown, polluted: blocked, text });
}

function sendEmpathInfo(ctx, player) {
  const blocked = ctx.isAbilityBlocked(player);
  const neighbors = ctx.aliveNeighbors(ctx.state, player);
  const truth = neighbors.reduce((sum, entry) => sum + (ctx.registersAsTeam(entry, "evil") ? 1 : 0), 0);
  const shown = blocked ? ctx.randomInt(0, 2) : truth;
  const text = `[第${ctx.state.night}夜] 你得知：你的两侧存活邻居中有 ${shown} 位邪恶。`;
  ctx.addPrivateInfo(ctx.state, player, text);
  ctx.state.events.infoPings.push({ night: ctx.state.night, actorId: player.id, type: "empath", truth, shown, polluted: blocked, text });
}

function chooseFortuneTellerTargets(ctx, fortuneTeller, plannedTargets = null) {
  if (plannedTargets && plannedTargets.length >= 2) {
    return plannedTargets.slice(0, 2);
  }
  const candidates = ctx.state.players.filter((entry) => entry.id !== fortuneTeller.id && entry.alive);
  if (candidates.length <= 2) {
    return candidates;
  }
  return ctx.sample(candidates, 2);
}

function sendFortuneTellerInfo(ctx, player) {
  const blocked = ctx.isAbilityBlocked(player);
  const plannedTargets = ctx.consumeHumanNightPlanTargets(ctx.state, player, 2, {
    allowSelf: true,
    allowDead: true,
  });
  const targets = chooseFortuneTellerTargets(ctx, player, plannedTargets);
  if (targets.length < 2) {
    return;
  }

  const truth = targets.some((entry) => ctx.registersAsDemonForFortuneTeller(ctx.state, player, entry));
  const shown = blocked ? ctx.rng() < 0.5 : truth;
  const text = `[第${ctx.state.night}夜] 你查验 ${targets[0].name} 与 ${targets[1].name}，结果：${shown ? "是" : "否"}。`;
  ctx.addPrivateInfo(ctx.state, player, text);
  ctx.state.events.infoPings.push({
    night: ctx.state.night,
    actorId: player.id,
    type: "fortune-teller",
    targetIds: targets.map((entry) => entry.id),
    truth,
    shown,
    polluted: blocked,
    text,
  });
}

function sendUndertakerInfo(ctx, player) {
  if (ctx.state.day <= 0) {
    return;
  }

  const roleId = ctx.state.tb.executionRoleByDay[ctx.state.day];
  if (!roleId) {
    const text = `[第${ctx.state.night}夜] 今天没有人被处决。`;
    ctx.addPrivateInfo(ctx.state, player, text);
    ctx.state.events.infoPings.push({ night: ctx.state.night, actorId: player.id, type: "undertaker", text });
    return;
  }

  const blocked = ctx.isAbilityBlocked(player);
  const shownRoleId = maybeDistortRoleId(ctx, roleId, null, blocked) ?? roleId;
  const text = `[第${ctx.state.night}夜] 你得知：今天被处决者的身份是 ${ctx.getRoleNameById(ctx.state, shownRoleId)}。`;
  ctx.addPrivateInfo(ctx.state, player, text);
  ctx.state.events.infoPings.push({
    night: ctx.state.night,
    actorId: player.id,
    type: "undertaker",
    roleId,
    shownRoleId,
    polluted: blocked,
    text,
  });
}

function choosePoisonTarget(ctx, poisoner) {
  const candidates = ctx.state.players.filter((entry) => entry.alive && entry.id !== poisoner.id);
  if (candidates.length === 0) {
    return null;
  }
  const priority = candidates.filter(
    (entry) => entry.tags.includes("info") || entry.roleId === TB.SLAYER || entry.roleId === TB.MONK
  );
  return ctx.chooseOne(priority.length > 0 ? priority : candidates);
}

function runPoisoner(ctx, poisoner) {
  if (ctx.isAbilityBlocked(poisoner)) {
    return;
  }
  const planned = ctx.consumeHumanNightPlanTargets(ctx.state, poisoner, 1, {
    allowSelf: false,
    allowDead: false,
  });
  const target = planned?.[0] ?? choosePoisonTarget(ctx, poisoner);
  if (!target) {
    return;
  }
  target.poisoned = true;
  target.poisonedTomorrowDay = true;
  ctx.state.tb.poisonTargetTonightId = target.id;
  ctx.addLog(ctx.state, "night-effect", "Poisoner 在夜间施加了中毒。", { by: poisoner.id, targetId: target.id });
}

function runButler(ctx, butler) {
  if (ctx.isAbilityBlocked(butler)) {
    ctx.state.tb.butlerMasterById[butler.id] = null;
    return;
  }
  const candidates = ctx.state.players.filter((entry) => entry.alive && entry.id !== butler.id);
  const planned = ctx.consumeHumanNightPlanTargets(ctx.state, butler, 1, {
    allowSelf: false,
    allowDead: false,
  });
  const master = planned?.[0] ?? ctx.chooseOne(candidates);
  ctx.state.tb.butlerMasterById[butler.id] = master?.id ?? null;
  if (butler.isHuman && master) {
    ctx.addPrivateInfo(ctx.state, butler, `[第${ctx.state.night}夜] 你选择 ${master.name} 作为你的主人。`);
  }
}

function chooseMonkProtectTarget(ctx, monk) {
  const candidates = ctx.state.players.filter((entry) => entry.alive && entry.id !== monk.id);
  if (candidates.length === 0) {
    return null;
  }
  const goodPriority = candidates.filter((entry) => entry.team === "good");
  return ctx.chooseOne(goodPriority.length > 0 ? goodPriority : candidates);
}

function runMonk(ctx, monk) {
  if (ctx.isAbilityBlocked(monk)) {
    return;
  }
  const planned = ctx.consumeHumanNightPlanTargets(ctx.state, monk, 1, {
    allowSelf: false,
    allowDead: false,
  });
  const target = planned?.[0] ?? chooseMonkProtectTarget(ctx, monk);
  ctx.state.tb.monkProtectedId = target?.id ?? null;
  ctx.state.tb.lastMonkProtectedId = target?.id ?? null;
  if (target) {
    ctx.addLog(ctx.state, "night-effect", "Monk 已选择一名玩家进行守护。", { by: monk.id, targetId: target.id });
    if (monk.isHuman) {
      ctx.addPrivateInfo(ctx.state, monk, `[第${ctx.state.night}夜] 你守护了 ${target.name}。`);
    }
  }
}

function chooseImpTarget(ctx, imp) {
  const aliveOthers = ctx.state.players.filter((entry) => entry.alive && entry.id !== imp.id);
  if (aliveOthers.length === 0) {
    return null;
  }

  const aliveMinions = ctx.state.players.filter((entry) => entry.alive && entry.category === "minion");
  const shouldStarpass = aliveMinions.length > 0 && ctx.getAlivePlayers(ctx.state).length > 5 && ctx.rng() < 0.07;
  if (shouldStarpass) {
    return imp;
  }

  const goodTargets = aliveOthers.filter((entry) => entry.team === "good");
  const preferred = goodTargets.length > 0 ? goodTargets : aliveOthers;
  const weighted = preferred
    .map((entry) => ({
      player: entry,
      weight: ctx.clamp(0.2 + (entry.threatScore ?? 0.5), 0.1, 1.2),
    }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, Math.max(1, Math.ceil(preferred.length / 2)));

  return ctx.chooseOne(weighted.map((entry) => entry.player));
}

function isProtectedFromImp(ctx, target) {
  if (!target.alive) {
    return true;
  }
  if (ctx.state.tb.monkProtectedId && ctx.state.tb.monkProtectedId === target.id) {
    return true;
  }
  if (target.roleId === TB.SOLDIER && !ctx.isAbilityBlocked(target)) {
    return true;
  }
  return false;
}

function runImp(ctx, imp) {
  if (ctx.state.night === 1) {
    return;
  }
  const planned = ctx.consumeHumanNightPlanTargets(ctx.state, imp, 1, {
    allowSelf: true,
    allowDead: false,
  });
  const target = planned?.[0] ?? chooseImpTarget(ctx, imp);
  if (!target) {
    return;
  }

  if (target.id === imp.id) {
    ctx.processNightDeath(ctx.state, imp, "imp-self-kill", { by: imp.id }, ctx.rng);
    return;
  }

  if (isProtectedFromImp(ctx, target)) {
    ctx.addLog(ctx.state, "night-effect", "恶魔击杀被防护技能抵消。", { targetId: target.id });
    return;
  }

  if (target.roleId === TB.MAYOR && !ctx.isAbilityBlocked(target) && ctx.rng() < 0.62) {
    const bouncePool = ctx.state.players.filter((entry) => entry.alive && entry.id !== target.id && entry.id !== imp.id);
    const replacement = ctx.chooseOne(bouncePool);
    if (replacement) {
      ctx.processNightDeath(ctx.state, replacement, "mayor-bounce", { by: imp.id, original: target.id }, ctx.rng);
      ctx.addLog(ctx.state, "night-effect", "Mayor 夜晚遇袭，死亡被转移。", {
        mayorId: target.id,
        replacementId: replacement.id,
      });
      return;
    }
  }

  ctx.processNightDeath(ctx.state, target, "demon-kill", { by: imp.id }, ctx.rng);
}

function triggerRavenkeeperInfo(ctx, ravenkeeper) {
  if (ctx.isAbilityBlocked(ravenkeeper)) {
    return;
  }
  const candidates = ctx.state.players.filter((entry) => entry.id !== ravenkeeper.id);
  const chosen = ctx.chooseOne(candidates);
  if (!chosen) {
    return;
  }

  const shownRoleId = maybeDistortRoleId(ctx, chosen.roleId, null, ctx.isAbilityBlocked(ravenkeeper)) ?? chosen.roleId;
  const text = `[第${ctx.state.night}夜] 你临终查验 ${chosen.name}，其身份为 ${ctx.getRoleNameById(ctx.state, shownRoleId)}。`;
  ctx.addPrivateInfo(ctx.state, ravenkeeper, text);
  ctx.state.events.infoPings.push({
    night: ctx.state.night,
    actorId: ravenkeeper.id,
    type: "ravenkeeper",
    targetId: chosen.id,
    shownRoleId,
    text,
  });
}

function deliverSpyPeek(ctx, spy) {
  if (ctx.isAbilityBlocked(spy)) {
    return;
  }
  const reveal = ctx.shuffle(ctx.state.players)
    .map((entry) => `${entry.name}:${entry.roleName}${entry.alive ? "" : "(死亡)"}`)
    .join(" | ");
  ctx.addPrivateInfo(ctx.state, spy, `[第${ctx.state.night}夜] 你看到了魔典：${reveal}`);
}

export const TB_ROLE_DEFINITIONS = {
  [TB.WASHERWOMAN]: {
    id: TB.WASHERWOMAN,
    scriptAgnostic: true,
    phaseHooks: { firstNight: sendWasherwomanInfo },
  },
  [TB.LIBRARIAN]: {
    id: TB.LIBRARIAN,
    scriptAgnostic: true,
    phaseHooks: { firstNight: sendLibrarianInfo },
  },
  [TB.INVESTIGATOR]: {
    id: TB.INVESTIGATOR,
    scriptAgnostic: true,
    misinformationProfile: "poisoned/drunk often receives two good players plus a minion role claim",
    phaseHooks: { firstNight: sendInvestigatorInfo },
  },
  [TB.CHEF]: {
    id: TB.CHEF,
    scriptAgnostic: true,
    phaseHooks: { firstNight: sendChefInfo },
  },
  [TB.EMPATH]: {
    id: TB.EMPATH,
    scriptAgnostic: true,
    phaseHooks: { eachNight: sendEmpathInfo },
  },
  [TB.FORTUNE_TELLER]: {
    id: TB.FORTUNE_TELLER,
    scriptAgnostic: true,
    action: TB_ROLE_ACTION_RULES[TB.FORTUNE_TELLER],
    phaseHooks: { eachNight: sendFortuneTellerInfo },
  },
  [TB.UNDERTAKER]: {
    id: TB.UNDERTAKER,
    scriptAgnostic: true,
    phaseHooks: { otherNight: sendUndertakerInfo },
  },
  [TB.MONK]: {
    id: TB.MONK,
    scriptAgnostic: true,
    action: TB_ROLE_ACTION_RULES[TB.MONK],
    phaseHooks: { otherNight: runMonk },
  },
  [TB.RAVENKEEPER]: {
    id: TB.RAVENKEEPER,
    scriptAgnostic: true,
    phaseHooks: { afterNightDeaths: triggerRavenkeeperInfo },
  },
  [TB.VIRGIN]: {
    id: TB.VIRGIN,
    scriptAgnostic: true,
    passiveInteraction: TB_PASSIVE_INTERACTIONS[TB.VIRGIN],
    phaseHooks: { onNomination: "ruleHandler:onNomination" },
  },
  [TB.SLAYER]: {
    id: TB.SLAYER,
    scriptAgnostic: true,
    dayAction: TB_DAY_ACTION_RULES[TB.SLAYER],
    phaseHooks: { dayAction: "ruleHandler:useSlayerAbility" },
  },
  [TB.SOLDIER]: {
    id: TB.SOLDIER,
    scriptAgnostic: true,
    phaseHooks: { onDemonAttack: "handledByImpProtection" },
  },
  [TB.MAYOR]: {
    id: TB.MAYOR,
    scriptAgnostic: true,
    passiveInteraction: TB_PASSIVE_INTERACTIONS[TB.MAYOR],
    phaseHooks: { onNoExecution: "ruleHandler:onNoExecution" },
  },
  [TB.BUTLER]: {
    id: TB.BUTLER,
    scriptAgnostic: true,
    action: TB_ROLE_ACTION_RULES[TB.BUTLER],
    phaseHooks: { eachNight: runButler, onVote: "ruleHandler:restrictButlerVote" },
  },
  [TB.SAINT]: {
    id: TB.SAINT,
    scriptAgnostic: true,
    phaseHooks: { onExecutionDeath: "ruleHandler:onExecutionDeath" },
  },
  [TB.POISONER]: {
    id: TB.POISONER,
    scriptAgnostic: true,
    action: TB_ROLE_ACTION_RULES[TB.POISONER],
    phaseHooks: { eachNight: runPoisoner },
  },
  [TB.SPY]: {
    id: TB.SPY,
    scriptAgnostic: true,
    phaseHooks: { eachNight: deliverSpyPeek },
  },
  [TB.IMP]: {
    id: TB.IMP,
    scriptAgnostic: true,
    action: TB_ROLE_ACTION_RULES[TB.IMP],
    phaseHooks: { otherNight: runImp, onDemonDeath: "ruleHandler:onDemonDeath" },
  },
  [TB.SCARLET_WOMAN]: {
    id: TB.SCARLET_WOMAN,
    scriptAgnostic: true,
    phaseHooks: { onDemonDeath: "ruleHandler:onDemonDeath" },
  },
  [TB.BARON]: {
    id: TB.BARON,
    scriptAgnostic: true,
    phaseHooks: { setup: "handledBySetupRoleDraw" },
  },
};

function convertToImp(ctx, player) {
  const imp = ctx.getRoleById("tb", TB.IMP);
  if (!imp) {
    return;
  }
  ctx.setRole(player, imp);
  ctx.addLog(ctx.state, "night-effect", `${player.name} 成为了新的 Imp。`, { playerId: player.id });
}

function tryScarletWomanTakeover(ctx) {
  const aliveCount = ctx.getAlivePlayers(ctx.state).length;
  if (aliveCount < 5) {
    return false;
  }

  const candidate = ctx.state.players.find(
    (entry) => entry.alive && entry.roleId === TB.SCARLET_WOMAN && !ctx.isAbilityBlocked(entry)
  );
  if (!candidate) {
    return false;
  }

  convertToImp(ctx, candidate);
  ctx.addLog(ctx.state, "night-effect", "Scarlet Woman 接任恶魔。", { playerId: candidate.id });
  return true;
}

function onDemonDeath(ctx, { demon, source }) {
  if (source === "imp-self-kill") {
    const minions = ctx.state.players.filter(
      (entry) => entry.alive && entry.category === "minion" && entry.id !== demon.id
    );
    if (minions.length > 0) {
      const nextImp = ctx.chooseOne(minions);
      if (nextImp) {
        convertToImp(ctx, nextImp);
        ctx.addLog(ctx.state, "night-effect", "Imp 通过自杀完成传位。", { from: demon.id, to: nextImp.id });
      }
    }
    return true;
  }

  return tryScarletWomanTakeover(ctx);
}

function onExecutionDeath(ctx, { victim }) {
  if (victim.roleId !== TB.SAINT) {
    return false;
  }
  if (ctx.isAbilityBlocked(victim)) {
    return false;
  }

  ctx.state.tb.specialWinEvil = true;
  ctx.state.tb.specialWinReasons.push("Saint 被处决，善良阵营立即失败。");
  return true;
}

function onNomination(ctx, { nominator, nominee }) {
  if (ctx.getEffectiveRoleId(nominee) !== TB.VIRGIN) {
    return { triggered: false };
  }
  if (ctx.state.tb.virginTriggeredIds.includes(nominee.id)) {
    return { triggered: false };
  }
  if (ctx.isAbilityBlocked(nominee)) {
    return { triggered: false };
  }
  if (!ctx.registersAsCategory(nominator, "townsfolk")) {
    return { triggered: false };
  }
  ctx.state.tb.virginTriggeredIds.push(nominee.id);
  return { triggered: true };
}

function restrictButlerVote(ctx, { player, intendedVote, allVotes }) {
  if (!intendedVote) {
    return intendedVote;
  }
  if (ctx.getEffectiveRoleId(player) !== TB.BUTLER) {
    return intendedVote;
  }
  if (ctx.isAbilityBlocked(player)) {
    return intendedVote;
  }
  const masterId = ctx.state.tb.butlerMasterById[player.id];
  if (!masterId) {
    return false;
  }
  const masterVote = allVotes.find((entry) => entry.voterId === masterId);
  if (!masterVote || !masterVote.vote) {
    return false;
  }
  return intendedVote;
}

function useSlayerAbility(ctx, { shooter, target }) {
  if (!shooter?.alive) {
    return { ok: false, reason: "死亡玩家不能发动 Slayer。" };
  }
  if (ctx.getEffectiveRoleId(shooter) !== TB.SLAYER) {
    return { ok: false, reason: "你不是 Slayer。" };
  }
  if (ctx.state.tb.slayerUsedByIds.includes(shooter.id)) {
    return { ok: false, reason: "Slayer 每局只能使用一次。" };
  }

  ctx.state.tb.slayerUsedByIds.push(shooter.id);
  ctx.addLog(ctx.state, "day-skill", `${shooter.name} 发动了 Slayer 对 ${target.name} 开枪。`, {
    shooterId: shooter.id,
    targetId: target.id,
  });

  if (ctx.isAbilityBlocked(shooter)) {
    ctx.addLog(ctx.state, "day-skill", "但由于醉酒或中毒，Slayer 技能未生效。", {
      shooterId: shooter.id,
      targetId: target.id,
    });
    return { ok: true, hit: false, targetDead: false };
  }

  const demonLike = target.category === "demon" || ctx.registersAsCategory(target, "demon");
  if (!demonLike) {
    ctx.addLog(ctx.state, "day-skill", "Slayer 命中失败。", {
      shooterId: shooter.id,
      targetId: target.id,
    });
    return { ok: true, hit: false, targetDead: false };
  }

  ctx.processExecutionDeath(ctx.state, target, "slayer-shot", { shooterId: shooter.id }, ctx.rng);
  ctx.checkWin(ctx.state);
  return { ok: true, hit: true, targetDead: true };
}

function onNoExecution(ctx) {
  const alive = ctx.getAlivePlayers(ctx.state);
  if (alive.length !== 3) {
    return false;
  }
  const mayor = alive.find((entry) => entry.roleId === TB.MAYOR);
  if (!mayor) {
    return false;
  }
  if (ctx.isAbilityBlocked(mayor)) {
    return false;
  }
  ctx.state.tb.specialWinGood = true;
  ctx.state.tb.specialWinReasons.push("仅剩 3 人且无人处决，Mayor 触发善良胜利。");
  return true;
}

export const TB_RULE_HANDLERS = {
  onDemonDeath,
  onExecutionDeath,
  onNomination,
  restrictButlerVote,
  useSlayerAbility,
  onNoExecution,
};

function runHookForRole(ctx, roleId, hookName, options = {}) {
  const hook = TB_ROLE_DEFINITIONS[roleId]?.phaseHooks?.[hookName];
  if (!hook) {
    return;
  }
  actorsFor(ctx, roleId, options).forEach((actor) => hook(ctx, actor));
}

function ensureFortuneTellerRedHerring(ctx) {
  if (ctx.state.tb.redHerringId) {
    return;
  }
  const fortuneTellers = actorsFor(ctx, TB.FORTUNE_TELLER, { requireAlive: false });
  if (fortuneTellers.length === 0) {
    return;
  }
  const pool = ctx.state.players.filter((entry) => entry.team === "good" && entry.category !== "demon");
  ctx.state.tb.redHerringId = ctx.chooseOne(pool)?.id ?? null;
}

function runRavenkeeperDeathHooks(ctx) {
  const deaths = ctx.state.events.nightDeaths.filter((entry) => entry.night === ctx.state.night);
  deaths.forEach((event) => {
    const player = ctx.getPlayerById(ctx.state, event.playerId);
    if (!player || ctx.getEffectiveRoleId(player) !== TB.RAVENKEEPER) {
      return;
    }
    TB_ROLE_DEFINITIONS[TB.RAVENKEEPER].phaseHooks.afterNightDeaths(ctx, player);
  });
}

export function runTroubleBrewingNight(ctx) {
  if (ctx.state.gameOver) {
    return;
  }

  ctx.startNightPhase(ctx.state);
  ensureFortuneTellerRedHerring(ctx);

  runHookForRole(ctx, TB.POISONER, "eachNight", { requireUnblocked: false, useEffective: false });
  runHookForRole(ctx, TB.BUTLER, "eachNight");
  if (ctx.state.night > 1) {
    runHookForRole(ctx, TB.MONK, "otherNight", { requireUnblocked: false, useEffective: false });
  } else {
    ctx.state.tb.monkProtectedId = null;
    ctx.state.tb.lastMonkProtectedId = null;
  }

  if (ctx.state.night === 1) {
    [TB.WASHERWOMAN, TB.LIBRARIAN, TB.INVESTIGATOR, TB.CHEF].forEach((roleId) => {
      runHookForRole(ctx, roleId, "firstNight");
    });
  }

  runHookForRole(ctx, TB.EMPATH, "eachNight");
  runHookForRole(ctx, TB.FORTUNE_TELLER, "eachNight");
  if (ctx.state.night > 1) {
    runHookForRole(ctx, TB.UNDERTAKER, "otherNight");
  }

  runHookForRole(ctx, TB.IMP, "otherNight", { requireUnblocked: false, useEffective: false });
  runRavenkeeperDeathHooks(ctx);
  runHookForRole(ctx, TB.SPY, "eachNight", { requireUnblocked: false, useEffective: false });

  ctx.applyThreatHeuristic(ctx.state);
  ctx.checkWin(ctx.state);
  if (ctx.state.gameOver) {
    return;
  }
  ctx.transitionToDayPhase(ctx.state);
}
