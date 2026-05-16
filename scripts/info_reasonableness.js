const REGISTRATION_TRAITS = {
  recluse: {
    falseChance: 0.58,
    team: "evil",
    categories: ["minion", "demon"],
  },
  spy: {
    falseChance: 0.58,
    team: "good",
    categories: ["townsfolk", "outsider"],
    rolePreferencesByCategory: {
      outsider: ["drunk", "recluse", "saint", "butler"],
      townsfolk: ["washerwoman", "librarian", "investigator", "fortune-teller", "empath"],
    },
  },
};

function actualRegistration(player) {
  return {
    team: player?.team ?? null,
    category: player?.category ?? null,
  };
}

export function registrationForRole(player, rng = Math.random) {
  const actual = actualRegistration(player);
  const trait = REGISTRATION_TRAITS[player?.roleId];
  if (!trait || rng() >= trait.falseChance) {
    return actual;
  }
  return {
    team: trait.team ?? actual.team,
    category: trait.categories?.[Math.floor(rng() * trait.categories.length)] ?? actual.category,
  };
}

export function possibleRegistrationsForRole(player) {
  const actual = actualRegistration(player);
  const trait = REGISTRATION_TRAITS[player?.roleId];
  if (!trait) {
    return [actual];
  }
  return [
    actual,
    ...(trait.categories ?? []).map((category) => ({
      team: trait.team ?? actual.team,
      category,
    })),
  ];
}

export function canRegisterAsCategory(player, category) {
  return possibleRegistrationsForRole(player).some((entry) => entry.category === category);
}

export function canRegisterAsTeam(player, team) {
  return possibleRegistrationsForRole(player).some((entry) => entry.team === team);
}

export function roleRegistrationOptionsForCategory(player, category, rolePool = []) {
  if (!canRegisterAsCategory(player, category)) {
    return [];
  }
  if (player?.category === category) {
    return [player.roleId].filter(Boolean);
  }
  const trait = REGISTRATION_TRAITS[player?.roleId];
  const preferred = trait?.rolePreferencesByCategory?.[category] ?? [];
  const roleIds = new Set(rolePool.filter((entry) => entry.category === category).map((entry) => entry.id));
  return preferred.filter((roleId) => roleIds.has(roleId));
}

function apparentCategory(player) {
  return player?.apparentCategory ?? player?.category ?? null;
}

function chooseBestByScore(ctx, candidates, scoreCandidate) {
  const scored = candidates
    .map((candidate) => ({ candidate, score: scoreCandidate(candidate) }))
    .filter((entry) => Number.isFinite(entry.score));
  if (scored.length === 0) {
    return null;
  }
  const bestScore = Math.max(...scored.map((entry) => entry.score));
  const best = scored.filter((entry) => entry.score === bestScore).map((entry) => entry.candidate);
  return ctx.chooseOne(best);
}

export function scoreTwoPlayerFalseToken(profile, candidate) {
  let score = 0;
  if (profile === "townsfolk-role") {
    if (apparentCategory(candidate) === "townsfolk") score += 80;
    if (canRegisterAsCategory(candidate, "townsfolk")) score += 35;
    if (candidate?.roleId === "drunk" && apparentCategory(candidate) === "townsfolk") score += 20;
    if (candidate?.team === "evil") score -= 20;
    if (candidate?.category === "outsider" && !canRegisterAsCategory(candidate, "townsfolk")) score -= 35;
    if (candidate?.category === "minion" || candidate?.category === "demon") score -= 55;
    if (candidate?.roleId === "saint") score -= 35;
    if (candidate?.tags?.includes("info")) score -= 8;
    if (candidate?.tags?.some((tag) => ["social", "protect", "defense", "lateGame", "burst"].includes(tag))) score += 6;
    return score;
  }

  if (profile === "outsider-role") {
    if (candidate?.category === "outsider") score += 80;
    if (apparentCategory(candidate) === "outsider") score += 25;
    if (canRegisterAsCategory(candidate, "outsider")) score += 20;
    if (candidate?.team === "good") score += 12;
    if (candidate?.category === "townsfolk" && candidate?.tags?.includes("info")) score -= 12;
    if ((candidate?.category === "minion" || candidate?.category === "demon") && !canRegisterAsCategory(candidate, "outsider")) score -= 45;
    return score;
  }

  if (profile === "minion-role") {
    if (candidate?.team === "good") score += 80;
    if (canRegisterAsCategory(candidate, "minion")) score += 16;
    if (candidate?.category === "townsfolk") score += 8;
    if (candidate?.category === "minion" || candidate?.category === "demon") score -= 60;
    if (candidate?.tags?.includes("info")) score -= 8;
    return score;
  }

  return score;
}

export function chooseReasonableTwoPlayerInfo(ctx, { actor, trueHolder, profile }) {
  if (!trueHolder) {
    return { pair: [], falseTokenId: null };
  }
  const falseCandidates = ctx.state.players.filter((entry) => entry.id !== trueHolder.id && entry.id !== actor.id);
  const fallbackCandidates = ctx.state.players.filter((entry) => entry.id !== trueHolder.id);
  const falseToken =
    chooseBestByScore(ctx, falseCandidates, (candidate) => scoreTwoPlayerFalseToken(profile, candidate)) ??
    chooseBestByScore(ctx, fallbackCandidates, (candidate) => scoreTwoPlayerFalseToken(profile, candidate));
  const pair = falseToken ? ctx.shuffle([trueHolder, falseToken]) : ctx.shuffle([trueHolder]);
  return {
    pair,
    falseTokenId: falseToken?.id ?? null,
  };
}

function scoreRegisteredInfoHolder(profile, player, roleId, situation) {
  let score = 0;
  if (profile === "outsider-role" && roleId === "drunk") {
    score += 95;
    if (player?.roleId === "spy") score += 30;
    if (situation.pressure === "evil-under-pressure") score += 28;
    if (situation.pressure === "good-under-pressure") score -= 12;
    return score;
  }
  if (profile === "townsfolk-role") {
    score += 35;
    if (player?.roleId === "spy") score += 12;
    if (roleId && ["washerwoman", "librarian", "investigator", "fortune-teller", "empath"].includes(roleId)) score += 10;
    return score;
  }
  if (profile === "minion-role") {
    score += 35;
    if (player?.roleId === "recluse") score += 18;
    return score;
  }
  return score;
}

function actualRoleCategoryForProfile(profile) {
  if (profile === "townsfolk-role") return "townsfolk";
  if (profile === "outsider-role") return "outsider";
  if (profile === "minion-role") return "minion";
  return null;
}

export function chooseReasonableInfoSubject(ctx, { actor, actualCandidates, profile, rolePool = [], state = ctx.state }) {
  const category = actualRoleCategoryForProfile(profile);
  const situation = evaluateInfoSituation(state);
  const actualPool = actualCandidates.filter((entry) => entry.id !== actor.id);
  const actualHolder = ctx.chooseOne(actualPool.length > 0 ? actualPool : actualCandidates);
  const registered = category
    ? ctx.state.players
        .filter((entry) => entry.id !== actor.id && !actualCandidates.some((candidate) => candidate.id === entry.id))
        .flatMap((entry) =>
          roleRegistrationOptionsForCategory(entry, category, rolePool).map((roleId) => ({
            holder: entry,
            shownRoleId: roleId,
            score: scoreRegisteredInfoHolder(profile, entry, roleId, situation),
          }))
        )
        .filter((entry) => Number.isFinite(entry.score))
    : [];

  const bestRegisteredScore = registered.length > 0 ? Math.max(...registered.map((entry) => entry.score)) : Number.NEGATIVE_INFINITY;
  const bestRegistered = registered.filter((entry) => entry.score === bestRegisteredScore);
  const shouldUseRegistered =
    bestRegistered.length > 0 &&
    (situation.pressure === "evil-under-pressure" ||
      (profile === "outsider-role" && bestRegistered.some((entry) => entry.shownRoleId === "drunk" && actualCandidates.every((candidate) => candidate.roleId !== "drunk"))));

  if (shouldUseRegistered) {
    const selected = ctx.chooseOne(bestRegistered);
    return {
      holder: selected.holder,
      shownRoleId: selected.shownRoleId,
      registered: true,
      strategy: selected.shownRoleId === "drunk" ? "registered-drunk-pressure" : "registered-role-pressure",
      pressure: situation.pressure,
    };
  }

  return {
    holder: actualHolder,
    shownRoleId: actualHolder?.roleId ?? null,
    registered: false,
    strategy: "actual-role-holder",
    pressure: situation.pressure,
  };
}

function playerPriorityScore(profile, player) {
  let score = 0;
  if (profile === "red-herring") {
    if (player?.team !== "good" || player?.category === "demon") return Number.NEGATIVE_INFINITY;
    if (canRegisterAsCategory(player, "demon")) score += 70;
    if (player?.category === "outsider") score += 18;
    if (player?.roleId === "saint") score += 8;
    if (player?.tags?.includes("info")) score -= 14;
    if (player?.tags?.some((tag) => ["defense", "social", "lateGame", "risk"].includes(tag))) score += 6;
    return score;
  }

  return score;
}

export function chooseFortuneTellerRedHerring(players, chooseOne) {
  const pool = players.filter((entry) => entry.team === "good" && entry.category !== "demon");
  if (pool.length === 0) {
    return null;
  }
  const scored = pool.map((player) => ({ player, score: playerPriorityScore("red-herring", player) }));
  const bestScore = Math.max(...scored.map((entry) => entry.score));
  const best = scored.filter((entry) => entry.score === bestScore).map((entry) => entry.player);
  return chooseOne(best);
}

export function chooseFalseRoleForInfo(rolePool, actualRoleId, profile, chooseOne) {
  const candidates = rolePool.filter((entry) => entry.id !== actualRoleId);
  if (candidates.length === 0) {
    return null;
  }
  const actualRole = rolePool.find((entry) => entry.id === actualRoleId) ?? null;
  const scored = candidates.map((role) => {
    let score = 0;
    if (profile === "identity-check") {
      if (actualRole?.team === "good" && role.team === "evil") score += 55;
      if (actualRole?.team === "evil" && role.team === "good") score += 55;
      if (actualRole?.category === role.category) score += 18;
      if (actualRole?.tags?.some((tag) => role.tags?.includes(tag))) score += 8;
      if (role.tags?.includes("info")) score += 6;
      if (actualRole?.id === "saint" && role.team === "good") score += 8;
      if (role.id === actualRole?.id) score -= 100;
    }
    return { role, score };
  });
  const bestScore = Math.max(...scored.map((entry) => entry.score));
  const best = scored.filter((entry) => entry.score === bestScore).map((entry) => entry.role);
  return chooseOne(best);
}

export function evaluateInfoSituation(state = {}) {
  const players = state.players ?? [];
  const alive = players.filter((entry) => entry.alive);
  const dead = players.filter((entry) => !entry.alive);
  const aliveGood = alive.filter((entry) => entry.team === "good").length;
  const aliveEvil = alive.filter((entry) => entry.team === "evil").length;
  const aliveMinions = alive.filter((entry) => entry.category === "minion").length;
  const aliveDemons = alive.filter((entry) => entry.category === "demon").length;
  const deadGood = dead.filter((entry) => entry.team === "good").length;
  const deadEvil = dead.filter((entry) => entry.team === "evil").length;

  const evilPressure =
    deadEvil * 2 +
    (aliveMinions === 0 ? 1 : 0) +
    (aliveDemons <= 1 && alive.length <= 5 ? 1 : 0) +
    (state.day >= 3 ? 1 : 0);
  const goodPressure =
    Math.max(0, deadGood - deadEvil) +
    (aliveGood <= aliveEvil + 2 ? 2 : 0) +
    (alive.length <= 4 && aliveDemons > 0 ? 1 : 0);

  let pressure = "balanced";
  if (evilPressure >= goodPressure + 1) {
    pressure = "evil-under-pressure";
  } else if (goodPressure >= evilPressure + 2) {
    pressure = "good-under-pressure";
  }

  return {
    pressure,
    aliveGood,
    aliveEvil,
    aliveDemons,
    aliveMinions,
    deadGood,
    deadEvil,
    evilPressure,
    goodPressure,
  };
}

function chooseSituationAwareCount(possibleCounts, actual, situation, chooseOne = null) {
  const bounded = [...new Set(possibleCounts)].sort((a, b) => a - b);
  if (bounded.length === 0) {
    return { value: actual, strategy: "actual-only", pressure: situation.pressure };
  }
  const min = bounded[0];
  const max = bounded[bounded.length - 1];
  if (situation.pressure === "evil-under-pressure" && actual > min) {
    return { value: min, strategy: "hide-evil-pressure", pressure: situation.pressure };
  }
  if (actual <= min && max > actual) {
    return { value: max, strategy: "frame-good-pressure", pressure: situation.pressure };
  }
  if (situation.pressure === "good-under-pressure" && max > actual) {
    return { value: max, strategy: "frame-good-pressure", pressure: situation.pressure };
  }
  if (max > actual) {
    return { value: max, strategy: "create-false-pressure", pressure: situation.pressure };
  }
  if (actual > min) {
    return { value: min, strategy: "hide-evil-line", pressure: situation.pressure };
  }
  const value = chooseOne ? chooseOne(bounded) : actual;
  return { value, strategy: "fallback-registered-count", pressure: situation.pressure };
}

function possibleRegisteredTeamCounts(players, team, max = players.length) {
  const actual = players.reduce((sum, player) => sum + (player.team === team ? 1 : 0), 0);
  const possibleCounts = new Set([actual]);
  players.forEach((player, idx) => {
    if (canRegisterAsTeam(player, team) && player.team !== team) {
      possibleCounts.add(actual + 1);
    }
    if (player.team === team && canRegisterAsTeam(player, team === "evil" ? "good" : "evil")) {
      possibleCounts.add(Math.max(0, actual - 1));
    }
    players.slice(idx + 1).forEach((other) => {
      let count = actual;
      if (canRegisterAsTeam(player, team) && player.team !== team) count += 1;
      if (canRegisterAsTeam(other, team) && other.team !== team) count += 1;
      if (player.team === team && canRegisterAsTeam(player, team === "evil" ? "good" : "evil")) count -= 1;
      if (other.team === team && canRegisterAsTeam(other, team === "evil" ? "good" : "evil")) count -= 1;
      possibleCounts.add(Math.max(0, Math.min(max, count)));
    });
  });
  const bounded = [...possibleCounts].filter((entry) => entry >= 0 && entry <= max);
  return { actual, bounded };
}

export function chooseRegisteredTeamCount(players, team, { mode = "actual", max = players.length } = {}, chooseOne = null) {
  const { actual, bounded } = possibleRegisteredTeamCounts(players, team, max);
  if (mode === "actual") {
    return actual;
  }
  if (bounded.length === 0) {
    return actual;
  }
  if (mode === "mislead-high") {
    return Math.max(...bounded);
  }
  if (mode === "mislead-low") {
    return Math.min(...bounded);
  }
  return chooseOne ? chooseOne(bounded) : bounded[0];
}

export function chooseSituationAwareRegisteredTeamCount(players, team, state, { max = players.length } = {}, chooseOne = null) {
  const { actual, bounded } = possibleRegisteredTeamCounts(players, team, max);
  return chooseSituationAwareCount(bounded, actual, evaluateInfoSituation(state), chooseOne);
}

function adjacentPairs(players) {
  const seated = [...players].sort((a, b) => a.seatIndex - b.seatIndex);
  if (seated.length < 2) {
    return [];
  }
  return seated.map((player, idx) => [player, seated[(idx + 1) % seated.length]]);
}

function countAdjacentPairsWithTeam(pairs, team, overriddenTeams = {}) {
  return pairs.reduce((sum, [a, b]) => {
    const aTeam = overriddenTeams[a.id] ?? a.team;
    const bTeam = overriddenTeams[b.id] ?? b.team;
    return sum + (aTeam === team && bTeam === team ? 1 : 0);
  }, 0);
}

function possibleRegisteredAdjacentTeamPairCounts(players, team) {
  const pairs = adjacentPairs(players);
  const actual = countAdjacentPairsWithTeam(pairs, team);
  const possibleCounts = new Set([actual]);
  const oppositeTeam = team === "evil" ? "good" : "evil";
  const ambiguous = players.filter(
    (player) => (player.team !== team && canRegisterAsTeam(player, team)) || (player.team === team && canRegisterAsTeam(player, oppositeTeam))
  );
  ambiguous.forEach((player) => {
    const registeredTeam = player.team === team ? oppositeTeam : team;
    possibleCounts.add(countAdjacentPairsWithTeam(pairs, team, { [player.id]: registeredTeam }));
  });
  ambiguous.forEach((player, idx) => {
    ambiguous.slice(idx + 1).forEach((other) => {
      possibleCounts.add(
        countAdjacentPairsWithTeam(pairs, team, {
          [player.id]: player.team === team ? oppositeTeam : team,
          [other.id]: other.team === team ? oppositeTeam : team,
        })
      );
    });
  });
  const bounded = [...possibleCounts].filter((entry) => entry >= 0 && entry <= pairs.length);
  return { actual, bounded, pairs };
}

export function chooseRegisteredAdjacentTeamPairs(players, team, { mode = "actual" } = {}, chooseOne = null) {
  const { actual, bounded, pairs } = possibleRegisteredAdjacentTeamPairCounts(players, team);
  if (mode === "actual") {
    return actual;
  }
  if (bounded.length === 0) {
    return actual;
  }
  if (mode === "mislead-high") {
    return Math.max(...bounded);
  }
  if (mode === "mislead-low") {
    return Math.min(...bounded);
  }
  return chooseOne ? chooseOne(bounded) : bounded[0];
}

export function chooseSituationAwareRegisteredAdjacentTeamPairs(players, team, state, chooseOne = null) {
  const { actual, bounded } = possibleRegisteredAdjacentTeamPairCounts(players, team);
  return chooseSituationAwareCount(bounded, actual, evaluateInfoSituation(state), chooseOne);
}

export function chooseSituationAwareFalseRoleForInfo(rolePool, actualRoleId, state, profile, chooseOne) {
  const situation = evaluateInfoSituation(state);
  const actualRole = rolePool.find((entry) => entry.id === actualRoleId) ?? null;
  const candidates = rolePool.filter((entry) => entry.id !== actualRoleId);
  if (!actualRole || candidates.length === 0) {
    return { role: chooseFalseRoleForInfo(rolePool, actualRoleId, profile, chooseOne), strategy: "fallback-false-role", pressure: situation.pressure };
  }
  const preferredTeam =
    actualRole.team === "evil" && situation.pressure === "evil-under-pressure"
      ? "good"
      : actualRole.team === "good"
        ? "evil"
        : null;
  const preferred = preferredTeam ? candidates.filter((entry) => entry.team === preferredTeam) : [];
  const role = chooseFalseRoleForInfo(preferred.length > 0 ? [actualRole, ...preferred] : rolePool, actualRoleId, profile, chooseOne);
  return {
    role,
    strategy:
      actualRole.team === "evil" && preferredTeam === "good"
        ? "hide-confirmed-evil"
        : actualRole.team === "good" && preferredTeam === "evil"
          ? "frame-good-as-evil"
          : "fallback-false-role",
    pressure: situation.pressure,
  };
}
