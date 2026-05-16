import assert from "node:assert/strict";

import {
  advanceDayStage,
  beginNightPhase,
  createNewGame,
  getEffectiveRoleId,
  getHumanDayActionState,
  getHumanNightActionState,
  getPubliclyAlivePlayers,
  getPerceivedRoleId,
  getPendingStorytellerActionState,
  markPublicDiscussionRound,
  processDayDeath,
  processNightDeath,
  resolveNominationAndVote,
  resolvePendingStorytellerAction,
  runNight,
  setHumanDayActionPlan,
  setHumanNightActionPlan,
  skipDay,
} from "../scripts/engine.js";

function fixedRng() {
  let seed = 123456789;
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

function human(state) {
  return state.players.find((entry) => entry.isHuman);
}

function firstOther(state, predicate = () => true) {
  const player = state.players.find((entry) => !entry.isHuman && predicate(entry));
  assert.ok(player, "expected a non-human target");
  return player;
}

function moveToNomination(state) {
  assert.equal(advanceDayStage(state, "public").ok, true);
  markPublicDiscussionRound(state);
  assert.equal(advanceDayStage(state, "nomination").ok, true);
}

function executeHumanPlayer(state) {
  const target = human(state);
  const nominator = firstOther(state, (entry) => entry.alive);
  const result = resolveNominationAndVote(
    state,
    {
      nominatorId: nominator.id,
      nomineeId: target.id,
      humanVoteYes: true,
      decideAIVote: () => true,
    },
    fixedRng()
  );
  assert.equal(result.accepted, true, result.reason);
  assert.equal(result.passed, true, "execution vote should pass");
  assert.equal(target.alive, false, "human player should be executed");
}

function startGame(scriptId, roleId, playerCount = 9) {
  return createNewGame({ scriptId, playerCount, preferredHumanRoleId: roleId }, fixedRng());
}

function testGamblerPlayerRole() {
  const state = startGame("bmr", "gambler");
  runNight(state, fixedRng());
  beginNightPhase(state);
  const target = firstOther(state, (entry) => entry.alive && entry.roleId !== "witch");
  const action = getHumanNightActionState(state);
  assert.equal(action.inputType, "player-role");
  const result = setHumanNightActionPlan(state, { targetIds: [target.id], roleId: target.roleId });
  assert.equal(result.ok, true, result.reason);
  runNight(state, fixedRng());
  assert.equal(
    state.events.nightDeaths.some((entry) => entry.reason === "gambler-fail" && entry.victimId === human(state).id),
    false,
    "correct Gambler guess should not create a Gambler-fail death"
  );
}

function testCourtierChoosesRoleNotPlayer() {
  const state = startGame("bmr", "courtier");
  runNight(state, fixedRng());
  beginNightPhase(state);
  state.players
    .filter((entry) => ["sailor", "innkeeper"].includes(entry.roleId) || (!entry.isHuman && entry.roleId === "courtier"))
    .forEach((entry) => {
      entry.roleId = "fool";
      entry.roleName = "Fool";
    });
  human(state).poisoned = false;

  const action = getHumanNightActionState(state);
  assert.equal(action.available, true, action.reason);
  assert.equal(action.inputType, "role");
  const result = setHumanNightActionPlan(state, { roleId: "po" });
  assert.equal(result.ok, true, result.reason);
  runNight(state, fixedRng());

  assert.ok(
    Number(state.bmr.suppressedByRoleId.po ?? 0) >= state.night,
    "Courtier should suppress the selected role rather than a selected player"
  );
}

function testGodfatherBonusKillUsesHumanTarget() {
  const state = startGame("bmr", "godfather");
  runNight(state, fixedRng());
  state.bmr.lastDayOutsiderExecuted = true;
  beginNightPhase(state);

  const action = getHumanNightActionState(state);
  assert.equal(action.available, true, action.reason);
  assert.equal(action.roleId, "godfather");
  assert.equal(action.inputType, "player-target");

  const target = firstOther(state, (entry) => entry.alive && entry.category !== "demon");
  const planned = setHumanNightActionPlan(state, { targetIds: [target.id] });
  assert.equal(planned.ok, true, planned.reason);
  runNight(state, fixedRng());

  assert.ok(
    state.events.nightDeaths.some((entry) => entry.reason === "godfather-bonus-kill" && entry.playerId === target.id),
    "human Godfather bonus kill should consume the selected target"
  );
}

function testGossipDayStatementAction() {
  const state = startGame("bmr", "gossip");
  runNight(state, fixedRng());
  assert.equal(advanceDayStage(state, "public").ok, true);

  const action = getHumanDayActionState(state);
  assert.equal(action.available, true, action.reason);
  assert.equal(action.roleId, "gossip");
  assert.equal(action.inputType, "question");

  const seat = human(state).seatIndex + 1;
  const result = setHumanDayActionPlan(state, { question: `${seat}号是善良玩家` });
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.resolvedImmediately, true);
  assert.equal(state.humanDayPlan, null, "public Gossip statements should not linger as a private day plan");
  assert.ok(
    state.events.speeches.some((entry) => entry.playerId === human(state).id && entry.publicAbility && entry.abilityRoleId === "gossip"),
    "Gossip statement should be recorded as a visible public ability speech"
  );
  assert.ok(
    state.bmr.gossipStatementsByDay[state.day][human(state).id].sourceSpeechId,
    "Gossip statement should keep a link to the public speech event"
  );
  runNight(state, fixedRng());

  assert.ok(
    state.logs.some((entry) => entry.type === "day-skill" && /Gossip 声明已判定/.test(entry.message)),
    "Gossip statement should be adjudicated at end of day"
  );
}

function testSlayerDayActionResolvesPublicDayDeath() {
  const state = startGame("tb", "slayer");
  runNight(state, fixedRng());
  assert.equal(advanceDayStage(state, "public").ok, true);
  const demon = state.players.find((entry) => entry.category === "demon");
  assert.ok(demon, "fixture should include a demon target");

  const action = getHumanDayActionState(state);
  assert.equal(action.available, true, action.reason);
  const result = setHumanDayActionPlan(state, { targetIds: [demon.id] }, fixedRng());
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.resolvedImmediately, true);
  assert.equal(demon.alive, false, "Slayer should immediately kill a demon target");
  assert.equal(
    state.events.executions.some((entry) => entry.reason === "slayer-shot"),
    false,
    "Slayer shot is a public day death, not an execution"
  );
  assert.ok(
    state.events.dayDeaths.some((entry) => entry.reason === "slayer-shot" && entry.playerId === demon.id),
    "Slayer shot should be recorded in dayDeaths"
  );
  assert.ok(
    state.events.speeches.some((entry) => entry.playerId === human(state).id && entry.publicAbility && entry.abilityRoleId === "slayer"),
    "Slayer shot should be visible as public speech"
  );
}

function testPoChargeAndMultiKill() {
  const state = startGame("bmr", "po");
  runNight(state, fixedRng());
  beginNightPhase(state);
  let action = getHumanNightActionState(state);
  assert.equal(action.inputType, "charge-or-targets");
  let result = setHumanNightActionPlan(state, { mode: "charge" });
  assert.equal(result.ok, true, result.reason);
  runNight(state, fixedRng());
  assert.equal(state.bmr.poCharged, true, "Po charge should persist after the night");

  beginNightPhase(state);
  action = getHumanNightActionState(state);
  assert.equal(action.inputType, "charge-or-targets");
  assert.equal(action.maxTargetCount, 3);
  const targets = state.players.filter((entry) => !entry.isHuman && entry.alive).slice(0, 2);
  result = setHumanNightActionPlan(state, { mode: "kill", targetIds: targets.map((entry) => entry.id) });
  assert.equal(result.ok, true, result.reason);
  runNight(state, fixedRng());
  assert.equal(state.bmr.poCharged, false, "charged Po should reset after attacking");
  targets.forEach((target) => assert.equal(target.alive, false, "chosen Po target should die"));
}

function testLunaticUsesPerceivedDemonActionWithoutKilling() {
  const state = startGame("bmr", "lunatic");
  assert.equal(human(state).roleId, "lunatic", "human should objectively be Lunatic");
  assert.notEqual(getPerceivedRoleId(human(state)), "lunatic", "human Lunatic should perceive a demon role");

  runNight(state, fixedRng());
  beginNightPhase(state);
  const action = getHumanNightActionState(state);
  assert.equal(action.available, true, action.reason);
  assert.equal(action.roleId, getPerceivedRoleId(human(state)), "Lunatic UI should use perceived demon action");

  const targets = state.players
    .filter((entry) => !entry.isHuman && entry.alive)
    .slice(0, action.maxTargetCount ?? action.targetCount ?? 1);
  const targetIds = targets.map((entry) => entry.id);
  const planInput =
    action.inputType === "charge-or-targets"
      ? { mode: "kill", targetIds: targetIds.slice(0, Math.max(1, action.minTargetCount ?? 1)) }
      : { targetIds: targetIds.slice(0, action.targetCount ?? 1) };
  const result = setHumanNightActionPlan(state, planInput);
  assert.equal(result.ok, true, result.reason);

  const trueDemon = state.players.find((entry) => entry.category === "demon");
  if (trueDemon) {
    trueDemon.roleId = "zombuul";
    trueDemon.roleName = "Zombuul";
    state.events.executions.push({ day: state.day, nomineeId: "test", died: true });
  }
  runNight(state, fixedRng());

  const chosenIds = state.bmr.lunaticLastTargetsById[human(state).id] ?? [];
  assert.ok(chosenIds.length > 0, "Lunatic choice should be recorded for demon information");
  chosenIds.forEach((targetId) => {
    const target = state.players.find((entry) => entry.id === targetId);
    assert.equal(target?.alive, true, "Lunatic perceived attack should not kill targets");
  });
}

function testPhilosopherRoleChoice() {
  const state = startGame("snv", "philosopher");
  beginNightPhase(state);
  const action = getHumanNightActionState(state);
  assert.equal(action.inputType, "role");
  const result = setHumanNightActionPlan(state, { roleId: "dreamer" });
  assert.equal(result.ok, true, result.reason);
  runNight(state, fixedRng());
  assert.equal(human(state).roleId, "philosopher", "Philosopher should keep the Philosopher token");
  assert.equal(human(state).philosopherAbilityRoleId, "dreamer", "Philosopher should gain the chosen role ability");
  assert.equal(getEffectiveRoleId(human(state)), "dreamer", "Philosopher should act as the chosen role");
}

function testArtistQuestion() {
  const state = startGame("snv", "artist");
  beginNightPhase(state);
  const action = getHumanNightActionState(state);
  assert.equal(action.inputType, "question");
  const result = setHumanNightActionPlan(state, { question: "场上是否有恶魔？" });
  assert.equal(result.ok, true, result.reason);
  runNight(state, fixedRng());
  assert.ok(
    state.events.infoPings.some((entry) => entry.actorId === human(state).id && /得到答案/.test(entry.text)),
    "Artist should receive a yes/no answer"
  );
}

function testCerenovusPlayerRole() {
  const state = startGame("snv", "cerenovus");
  beginNightPhase(state);
  const target = firstOther(state, (entry) => entry.alive && entry.roleId !== "witch");
  const action = getHumanNightActionState(state);
  assert.equal(action.inputType, "player-role");
  const result = setHumanNightActionPlan(state, { targetIds: [target.id], roleId: "artist" });
  assert.equal(result.ok, true, result.reason);
  runNight(state, fixedRng());
  assert.equal(state.snv.cerenovusForcedByPlayerId[target.id], "artist");
}

function testPitHagPlayerRole() {
  const state = startGame("snv", "pit-hag");
  runNight(state, fixedRng());
  beginNightPhase(state);
  const target = firstOther(state, (entry) => entry.alive && entry.roleId !== "witch");
  target.team = "good";
  const action = getHumanNightActionState(state);
  assert.equal(action.inputType, "player-role");
  const result = setHumanNightActionPlan(state, { targetIds: [target.id], roleId: "witch" });
  assert.equal(result.ok, true, result.reason);
  runNight(state, fixedRng());
  assert.equal(target.roleId, "witch", "Pit-Hag should transform target into selected role");
  assert.equal(target.category, "minion", "Pit-Hag should apply the new role type");
  assert.equal(target.team, "good", "Pit-Hag should not force the new role's default alignment");
}

function testPitHagMultiDemonQueuesStorytellerBalance() {
  const state = startGame("snv", "pit-hag");
  runNight(state, fixedRng());
  beginNightPhase(state);
  const target = firstOther(state, (entry) => entry.alive && entry.team === "good" && entry.category !== "demon");
  const planned = setHumanNightActionPlan(state, { targetIds: [target.id], roleId: "vortox" });
  assert.equal(planned.ok, true, planned.reason);
  runNight(state, fixedRng());

  const action = getPendingStorytellerActionState(state);
  assert.equal(action.available, true);
  assert.equal(action.type, "pit-hag-demon-balance");
  assert.equal(state.snv.pitHagDemonBalancePending, true);
  assert.equal(state.gameOver, false, "multi-demon Pit-Hag balance should pause immediate win checks");

  const balanceTarget = action.selectedTargetIds[0] ?? action.options[0]?.id;
  assert.ok(balanceTarget, "Pit-Hag balance should suggest an extra demon to kill");
  const result = resolvePendingStorytellerAction(state, { targetIds: [balanceTarget] });
  assert.equal(result.ok, true, result.reason);
  assert.equal(state.snv.pitHagDemonBalancePending, false);
  assert.ok(
    state.events.nightDeaths.some((entry) => entry.reason === "pit-hag-demon-balance" && entry.playerId === balanceTarget),
    "resolving Pit-Hag balance should record the selected demon death"
  );
}

function testPitHagNoDemonDefersGoodWinUntilStorytellerConfirmation() {
  const state = startGame("snv", "pit-hag");
  runNight(state, fixedRng());
  beginNightPhase(state);
  const demon = state.players.find((entry) => entry.alive && entry.category === "demon");
  assert.ok(demon, "expected an original demon");
  const planned = setHumanNightActionPlan(state, { targetIds: [demon.id], roleId: "artist" });
  assert.equal(planned.ok, true, planned.reason);
  runNight(state, fixedRng());

  const action = getPendingStorytellerActionState(state);
  assert.equal(action.available, true);
  assert.equal(action.type, "pit-hag-demon-balance");
  assert.equal(state.snv.pitHagDemonBalancePending, true);
  assert.equal(state.gameOver, false, "no-demon Pit-Hag state should wait for Storyteller confirmation");

  const result = resolvePendingStorytellerAction(state, {});
  assert.equal(result.ok, true, result.reason);
  assert.equal(state.snv.pitHagDemonBalancePending, false);
  assert.equal(state.gameOver, true, "after confirmation, no living demons should trigger good win");
  assert.equal(state.winner, "good");
}

function testPitHagClockmakerEntryReceivesFirstNightInfo() {
  const state = startGame("snv", "pit-hag");
  runNight(state, fixedRng());
  beginNightPhase(state);
  const target = firstOther(state, (entry) => entry.alive && entry.category !== "demon");
  const planned = setHumanNightActionPlan(state, { targetIds: [target.id], roleId: "clockmaker" });
  assert.equal(planned.ok, true, planned.reason);
  runNight(state, fixedRng());

  assert.equal(target.roleId, "clockmaker");
  assert.ok(
    state.events.infoPings.some((entry) => entry.actorId === target.id && entry.type === "clockmaker" && entry.roleEntry),
    "a newly entered Clockmaker should receive first-night entry information"
  );
}

function testJugglerGuesses() {
  const state = startGame("snv", "juggler");
  runNight(state, fixedRng());
  advanceDayStage(state, "public");
  const action = getHumanDayActionState(state);
  assert.equal(action.inputType, "guesses");
  const targets = state.players.filter((entry) => !entry.isHuman).slice(0, 2);
  const result = setHumanDayActionPlan(state, {
    guesses: [
      { playerId: targets[0].id, roleId: targets[0].roleId },
      { playerId: targets[1].id, roleId: "artist" },
    ],
  });
  assert.equal(result.ok, true, result.reason);
  assert.equal(state.snv.jugglerGuessesByDay[human(state).id].guesses.length, 2);
}

function testProfessorInteractionMetadata() {
  const state = startGame("bmr", "professor");
  runNight(state, fixedRng());
  beginNightPhase(state);
  const deadTownsfolk = firstOther(state, (entry) => entry.category === "townsfolk");
  deadTownsfolk.alive = false;

  const action = getHumanNightActionState(state);
  assert.equal(action.available, true, action.reason);
  assert.equal(action.roleId, "professor");
  assert.equal(action.interaction.title, "教授的禁忌讲堂");
  assert.equal(action.options.some((entry) => entry.id === deadTownsfolk.id), true);
}

function testProfessorCanTargetAnyDeadPlayerButOnlyRevivesTownsfolk() {
  const state = startGame("bmr", "professor");
  runNight(state, fixedRng());
  beginNightPhase(state);
  const deadTownsfolk = firstOther(state, (entry) => entry.category === "townsfolk");
  const deadNonTownsfolk = firstOther(state, (entry) => entry.category !== "townsfolk" && entry.category !== "demon");
  deadTownsfolk.alive = false;
  deadNonTownsfolk.alive = false;

  const action = getHumanNightActionState(state);
  assert.equal(action.available, true, action.reason);
  assert.equal(action.options.some((entry) => entry.id === deadTownsfolk.id), true);
  assert.equal(action.options.some((entry) => entry.id === deadNonTownsfolk.id), true);
  assert.equal(setHumanNightActionPlan(state, { targetIds: [deadNonTownsfolk.id] }).ok, true);
  runNight(state, fixedRng());

  assert.equal(deadNonTownsfolk.alive, false, "Professor should not revive a dead non-Townsfolk target");
  assert.equal(state.bmr.professorUsedByIds.includes(human(state).id), true, "failed Professor attempt should still use the ability");
}

function testProfessorRevivesSelectedDeadTownsfolk() {
  const state = startGame("bmr", "professor");
  runNight(state, fixedRng());
  beginNightPhase(state);
  const deadTownsfolk = firstOther(state, (entry) => entry.category === "townsfolk");
  deadTownsfolk.alive = false;

  const planned = setHumanNightActionPlan(state, { targetIds: [deadTownsfolk.id] });
  assert.equal(planned.ok, true, planned.reason);
  runNight(state, fixedRng());
  assert.ok(
    state.logs.some((entry) => entry.type === "night-effect" && entry.payload?.targetId === deadTownsfolk.id),
    "Professor should revive the selected dead townsfolk"
  );
}

function testSailorExecutionIsRecordedButDoesNotKill() {
  const state = startGame("bmr", "sailor");
  runNight(state, fixedRng());
  human(state).poisoned = false;
  human(state).poisonedTomorrowDay = false;
  moveToNomination(state);

  const nominator = firstOther(state, (entry) => entry.alive);
  const result = resolveNominationAndVote(
    state,
    {
      nominatorId: nominator.id,
      nomineeId: human(state).id,
      humanVoteYes: true,
      decideAIVote: () => true,
    },
    fixedRng()
  );

  assert.equal(result.accepted, true, result.reason);
  assert.equal(result.passed, true);
  assert.equal(human(state).alive, true, "sober Sailor should not die from execution");
  assert.equal(
    state.events.executions.some((entry) => entry.nomineeId === human(state).id && entry.died === false),
    true,
    "prevented execution should still be recorded as an execution"
  );

  const secondNominator = firstOther(state, (entry) => entry.alive && entry.id !== nominator.id && !entry.nominatedToday);
  const secondTarget = firstOther(state, (entry) => entry.alive && entry.id !== secondNominator.id && !entry.beenNominatedToday);
  const second = resolveNominationAndVote(
    state,
    {
      nominatorId: secondNominator.id,
      nomineeId: secondTarget.id,
      humanVoteYes: true,
      decideAIVote: () => true,
    },
    fixedRng()
  );
  assert.equal(second.accepted, false, "a prevented-death execution should still consume the day's execution");
}

function testDevilsAdvocateProtectionPreemptsPacifistWeight() {
  const state = startGame("bmr", "pacifist");
  runNight(state, fixedRng());
  neutralizeBMRExecutionSaves(state, { keepPacifist: true });
  moveToNomination(state);
  const target = firstOther(state, (entry) => entry.alive && entry.team === "good");
  const nominator = firstOther(state, (entry) => entry.alive && entry.id !== target.id);
  state.bmr.devilsAdvocateProtectedId = target.id;

  const result = resolveNominationAndVote(
    state,
    {
      nominatorId: nominator.id,
      nomineeId: target.id,
      humanVoteYes: true,
      decideAIVote: () => true,
    },
    () => 0
  );

  assert.equal(result.accepted, true, result.reason);
  assert.equal(target.alive, true);
  assert.equal(state.bmr.pacifistSavedToday, false, "Pacifist should not consume its optional save when DA strictly protects");
  assert.ok(
    state.logs.some((entry) => entry.message.includes("Devil's Advocate") && entry.payload?.victimId === target.id),
    "DA protection should be the logged reason"
  );
}

function testPacifistUsesWeightedSaveDecision() {
  const state = startGame("bmr", "pacifist");
  runNight(state, fixedRng());
  neutralizeBMRExecutionSaves(state, { keepPacifist: true });
  moveToNomination(state);
  const target = firstOther(state, (entry) => entry.alive && entry.team === "good" && entry.category === "townsfolk");
  const nominator = firstOther(state, (entry) => entry.alive && entry.id !== target.id);

  const result = resolveNominationAndVote(
    state,
    {
      nominatorId: nominator.id,
      nomineeId: target.id,
      humanVoteYes: true,
      decideAIVote: () => true,
    },
    () => 0
  );

  assert.equal(result.accepted, true, result.reason);
  assert.equal(target.alive, true, "low roll should trigger weighted Pacifist save");
  const log = state.logs.find((entry) => entry.message.includes("Pacifist") && entry.payload?.victimId === target.id);
  assert.ok(log, "Pacifist save should be logged");
  assert.equal(typeof log.payload.weight, "number");
  assert.equal(log.payload.roll, 0);
  assert.ok(log.payload.weight > 0.22, "townsfolk/early-day factors should raise the Pacifist weight above base");
  assert.ok(Array.isArray(log.payload.factors));
}

function testInnkeeperProtectionBlocksBMRNightDeath() {
  const state = startGame("bmr", "innkeeper");
  const target = firstOther(state, (entry) => entry.alive);
  state.bmr.innkeeperProtectedIds = [target.id];

  const died = processNightDeath(state, target, "contract-innkeeper-protected", {}, fixedRng());

  assert.equal(died, false, "Innkeeper protected target should not die to BMR night death");
  assert.equal(target.alive, true);
}

function testSailorBlocksNightDeath() {
  const state = startGame("bmr", "sailor");
  beginNightPhase(state);
  human(state).poisoned = false;

  const died = processNightDeath(state, human(state), "contract-sailor-night-death", {}, fixedRng());

  assert.equal(died, false, "sober Sailor should not die at night");
  assert.equal(human(state).alive, true);
}

function neutralizeBMRExecutionSaves(state, { keepPacifist = false } = {}) {
  state.players.forEach((entry) => {
    if (["tea-lady", "fool", "sailor"].includes(entry.roleId) || (!keepPacifist && entry.roleId === "pacifist")) {
      entry.roleId = "chambermaid";
      entry.roleName = "Chambermaid";
      entry.category = "townsfolk";
      entry.team = "good";
    }
  });
}

function testMastermindExtraDayGoodExecutionGivesEvilWin() {
  const state = startGame("bmr", "mastermind");
  runNight(state, fixedRng());
  neutralizeBMRExecutionSaves(state);
  state.bmr.mastermindPendingDay = state.day;
  moveToNomination(state);
  const target = firstOther(state, (entry) => entry.alive && entry.team === "good");
  const nominator = firstOther(state, (entry) => entry.alive && entry.id !== target.id);

  const result = resolveNominationAndVote(
    state,
    {
      nominatorId: nominator.id,
      nomineeId: target.id,
      humanVoteYes: true,
      decideAIVote: () => true,
    },
    fixedRng()
  );

  assert.equal(result.accepted, true, result.reason);
  assert.equal(state.gameOver, true);
  assert.equal(state.winner, "evil", "executing a good player on Mastermind extra day should make good lose");
}

function testMastermindExtraDayNoExecutionGivesGoodWin() {
  const state = startGame("bmr", "mastermind");
  runNight(state, fixedRng());
  state.bmr.mastermindPendingDay = state.day;
  moveToNomination(state);

  assert.equal(skipDay(state), true);
  assert.equal(state.gameOver, true);
  assert.equal(state.winner, "good", "no execution on Mastermind extra day should make good win");
}

function testDevilsAdvocateCannotRepeatTarget() {
  const state = startGame("bmr", "devil-s-advocate");
  beginNightPhase(state);
  const repeated = firstOther(state, (entry) => entry.alive);
  state.bmr.devilsAdvocateLastTargetById[human(state).id] = repeated.id;

  const action = getHumanNightActionState(state);
  assert.equal(action.available, true, action.reason);
  assert.equal(action.options.some((entry) => entry.id === repeated.id), false);
  assert.equal(setHumanNightActionPlan(state, { targetIds: [repeated.id] }).ok, false);
}

function testExorcistCannotRepeatTarget() {
  const state = startGame("bmr", "exorcist");
  runNight(state, fixedRng());
  beginNightPhase(state);
  const repeated = firstOther(state, (entry) => entry.alive);
  state.bmr.exorcistLastTargetById[human(state).id] = repeated.id;

  const action = getHumanNightActionState(state);
  assert.equal(action.available, true, action.reason);
  assert.equal(action.options.some((entry) => entry.id === repeated.id), false);
  assert.equal(setHumanNightActionPlan(state, { targetIds: [repeated.id] }).ok, false);
}

function testZombuulRequiresNoDeathToday() {
  const state = startGame("bmr", "zombuul");
  runNight(state, fixedRng());
  state.events.executions.push({ day: state.day, nomineeId: "contract-test", roleId: "fool", reason: "contract-test" });
  beginNightPhase(state);

  const action = getHumanNightActionState(state);
  assert.equal(action.available, false, "Zombuul should not wake to kill after a daytime death");
}

function testZombuulTreatsPublicDayDeathAsDeathToday() {
  const state = startGame("bmr", "zombuul");
  runNight(state, fixedRng());
  const target = firstOther(state, (entry) => entry.alive && entry.category !== "demon");
  processDayDeath(state, target, "contract-public-day-death", {}, fixedRng());
  beginNightPhase(state);

  const action = getHumanNightActionState(state);
  assert.equal(action.available, false, "Zombuul should not wake after any public day death, not only executions");
}

function testZombuulFirstDeathRegistersDeadButStaysAlive() {
  const state = startGame("bmr", "zombuul");
  beginNightPhase(state);
  const zombuul = human(state);

  const died = processNightDeath(state, zombuul, "contract-zombuul-first-death", {}, fixedRng());

  assert.equal(died, false, "Zombuul first death should not actually kill the player");
  assert.equal(zombuul.alive, true, "Zombuul should remain actually alive after the first death");
  assert.equal(state.bmr.zombuulHiddenDead, true);
  assert.equal(state.bmr.zombuulHiddenDeadPlayerId, zombuul.id);
  assert.equal(
    getPubliclyAlivePlayers(state).some((entry) => entry.id === zombuul.id),
    false,
    "Zombuul should be excluded from public alive counts after the first death"
  );
}

function testZombuulHiddenDeadUsesDeadVoteAndPublicThreshold() {
  const state = startGame("bmr", "zombuul");
  beginNightPhase(state);
  const zombuul = human(state);
  processNightDeath(state, zombuul, "contract-zombuul-first-death", {}, fixedRng());
  state.phase = "day";
  state.day = 1;
  state.dayStage = "private";
  moveToNomination(state);

  const target = firstOther(state, (entry) => entry.alive && entry.team === "good");
  const nominator = firstOther(state, (entry) => entry.alive && entry.id !== target.id);
  const result = resolveNominationAndVote(
    state,
    {
      nominatorId: nominator.id,
      nomineeId: target.id,
      humanVoteYes: true,
      decideAIVote: () => false,
    },
    fixedRng()
  );

  assert.equal(result.accepted, true, result.reason);
  assert.equal(result.threshold, Math.ceil(getPubliclyAlivePlayers(state).length / 2));
  assert.equal(zombuul.ghostVoteAvailable, false, "hidden-dead Zombuul should spend a ghost vote when voting");
}

function testProfessorTargetingHiddenDeadZombuulDoesNotRetarget() {
  const state = startGame("bmr", "professor");
  runNight(state, fixedRng());
  beginNightPhase(state);
  const demon = firstOther(state, (entry) => entry.category === "demon");
  demon.roleId = "zombuul";
  demon.roleName = "Zombuul";
  state.bmr.zombuulRevived = true;
  state.bmr.zombuulHiddenDead = true;
  state.bmr.zombuulHiddenDeadPlayerId = demon.id;

  const action = getHumanNightActionState(state);
  assert.equal(action.available, true, action.reason);
  assert.equal(action.options.some((entry) => entry.id === demon.id && entry.alive === false), true);
  assert.equal(setHumanNightActionPlan(state, { targetIds: [demon.id] }).ok, true);
  runNight(state, fixedRng());

  assert.equal(demon.alive, true, "Professor should not actually kill or retarget hidden-dead Zombuul");
  assert.equal(state.bmr.professorUsedByIds.includes(human(state).id), true);
  assert.ok(
    state.logs.some((entry) => entry.type === "night-effect" && entry.payload?.targetId === demon.id && /没有成功/.test(entry.message)),
    "Professor should resolve the chosen hidden-dead Zombuul as a failed revive"
  );
}

function testPukkaSuppressedKeepsPreviousPoisonedTarget() {
  const state = startGame("bmr", "pukka");
  beginNightPhase(state);
  const pukka = human(state);
  const target = firstOther(state, (entry) => entry.alive && entry.team === "good");
  state.bmr.pukkaPoisonedId = target.id;
  pukka.poisoned = true;

  runNight(state, fixedRng());

  assert.equal(target.alive, true, "suppressed Pukka should not kill the previously poisoned target");
  assert.equal(state.bmr.pukkaPoisonedId, target.id, "previous Pukka poison should remain pending while Pukka is suppressed");
  assert.equal(target.poisoned, true, "previous Pukka target should remain poisoned through the following day");
}

function testGodfatherTriggersFromOutsiderDayDeath() {
  const state = startGame("bmr", "godfather");
  runNight(state, fixedRng());
  const outsider = firstOther(state, (entry) => entry.alive && entry.category === "outsider");
  processDayDeath(state, outsider, "contract-outsider-day-death", {}, fixedRng());
  beginNightPhase(state);

  const action = getHumanNightActionState(state);
  assert.equal(action.available, true, action.reason);
  assert.equal(action.roleId, "godfather");
}

function testSnakeCharmerHitGivesPrivateInfo() {
  const state = startGame("snv", "snake-charmer");
  beginNightPhase(state);
  const demon = state.players.find((entry) => entry.category === "demon");
  assert.ok(demon, "expected a demon target");
  demon.roleId = "fang-gu";
  demon.roleName = "Fang Gu";

  const action = getHumanNightActionState(state);
  assert.equal(action.available, true, action.reason);
  const planned = setHumanNightActionPlan(state, { targetIds: [demon.id] });
  assert.equal(planned.ok, true, planned.reason);
  runNight(state, fixedRng());

  assert.equal(human(state).category, "demon", "Snake Charmer should become the demon after hitting a demon");
  assert.equal(demon.roleId, "snake-charmer", "the old demon should become the Snake Charmer");
  assert.equal(demon.poisoned, true, "the old demon should be poisoned immediately after the swap");
  assert.equal(
    state.snv.snakeCharmerPoisonedIds.includes(demon.id),
    true,
    "the old demon should remain tracked as the poisoned Snake Charmer"
  );
  assert.equal(
    Number(state.snv.abilityInterferenceCountLastNight ?? 0),
    0,
    "old demon poison from Snake Charmer should not count for Mathematician by itself"
  );
  assert.equal(
    human(state).privateNotes.some((entry) => entry.includes("舞蛇人") && entry.includes("身份已交换")),
    true,
    "human Snake Charmer should receive explicit swap information"
  );
}

function testVortoxDreamerInfoIsStrictlyFalse() {
  const state = startGame("snv", "dreamer");
  const demon = state.players.find((entry) => entry.category === "demon");
  assert.ok(demon, "expected a demon");
  demon.roleId = "vortox";
  demon.roleName = "Vortox";
  demon.roleIcon = "";
  beginNightPhase(state);

  const target = firstOther(state, (entry) => entry.alive && entry.id !== demon.id);
  const planned = setHumanNightActionPlan(state, { targetIds: [target.id] });
  assert.equal(planned.ok, true, planned.reason);
  runNight(state, fixedRng());

  const ping = state.events.infoPings.find((entry) => entry.actorId === human(state).id && entry.type === "dreamer");
  assert.ok(ping, "Dreamer should receive info");
  assert.equal(`${ping.reported}`.includes(target.roleName), false, "Vortox Dreamer info must not include the true role");
}

function testVortoxSavantAbnormalityCountsForMathematician() {
  const state = startGame("snv", "mathematician");
  const demon = state.players.find((entry) => entry.category === "demon");
  const savant = firstOther(state, (entry) => entry.alive && entry.team === "good");
  assert.ok(demon, "expected a demon");
  demon.roleId = "vortox";
  demon.roleName = "Vortox";
  demon.category = "demon";
  demon.team = "evil";
  savant.roleId = "savant";
  savant.roleName = "Savant";
  savant.category = "townsfolk";
  savant.team = "good";

  runNight(state, fixedRng());
  assert.ok(
    state.events.infoPings.some((entry) => entry.actorId === savant.id && entry.type === "savant" && entry.abnormal),
    "Vortox Savant should receive all-false information"
  );
  assert.ok(
    Number(state.snv.abilityInterferenceCountLastNight ?? 0) >= 1,
    "Vortox Savant abnormal info should count toward the next Mathematician window"
  );

  state.events.executions.push({ day: state.day, nomineeId: "contract-prior-execution", died: true });
  runNight(state, fixedRng());
  const mathPing = [...state.events.infoPings].reverse().find((entry) => entry.actorId === human(state).id && entry.type === "mathematician");
  assert.ok(mathPing, "Mathematician should receive information on the next night");
  assert.ok(Number(mathPing.truth ?? 0) >= 1, "Mathematician truth should include the prior daytime Savant abnormality");
}

function testBarberSwapPreservesAlignmentAndResetsEntryRole() {
  const state = startGame("snv", "vortox");
  runNight(state, fixedRng());

  const barber = firstOther(state, (entry) => entry.alive && entry.team === "good");
  barber.roleId = "barber";
  barber.roleName = "Barber";
  barber.category = "outsider";
  barber.team = "good";
  const goodTarget = firstOther(state, (entry) => entry.alive && entry.id !== barber.id && entry.team === "good");
  const evilTarget = firstOther(state, (entry) => entry.alive && entry.team === "evil" && entry.category !== "demon");
  goodTarget.roleId = "seamstress";
  goodTarget.roleName = "Seamstress";
  goodTarget.category = "townsfolk";
  goodTarget.team = "good";
  evilTarget.roleId = "witch";
  evilTarget.roleName = "Witch";
  evilTarget.category = "minion";
  evilTarget.team = "evil";
  state.snv.seamstressUsedByIds.push(evilTarget.id);

  processDayDeath(state, barber, "contract-barber-death", {}, fixedRng());
  const action = getPendingStorytellerActionState(state);
  assert.equal(action.available, true);
  assert.equal(action.type, "barber-swap");
  const result = resolvePendingStorytellerAction(state, { targetIds: [goodTarget.id, evilTarget.id] });
  assert.equal(result.ok, true, result.reason);

  assert.equal(goodTarget.roleId, "witch");
  assert.equal(goodTarget.category, "minion");
  assert.equal(goodTarget.team, "good", "Barber swap should preserve player alignment");
  assert.equal(evilTarget.roleId, "seamstress");
  assert.equal(evilTarget.category, "townsfolk");
  assert.equal(evilTarget.team, "evil", "Barber swap should allow evil Townsfolk");
  assert.equal(
    state.snv.seamstressUsedByIds.includes(evilTarget.id),
    false,
    "role re-entry should reset once-per-game state for the entered role"
  );
}

function testWitchCurseCreatesDayDeathNotExecution() {
  const state = startGame("snv", "witch");
  runNight(state, fixedRng());
  moveToNomination(state);

  const cursedNominator = firstOther(state, (entry) => entry.alive && entry.team === "good");
  const cursedNominee = firstOther(state, (entry) => entry.alive && entry.id !== cursedNominator.id);
  state.snv.witchCurses[cursedNominator.id] = state.day;

  const cursedResult = resolveNominationAndVote(
    state,
    {
      nominatorId: cursedNominator.id,
      nomineeId: cursedNominee.id,
      humanVoteYes: false,
      decideAIVote: () => false,
    },
    fixedRng()
  );

  assert.equal(cursedResult.accepted, false, "Witch curse should block the nomination");
  assert.equal(cursedNominator.alive, false, "cursed nominator should die");
  assert.ok(
    state.events.dayDeaths.some((entry) => entry.reason === "witch-curse" && entry.playerId === cursedNominator.id),
    "Witch curse should be recorded as a day death"
  );
  assert.equal(
    state.events.executions.some((entry) => entry.reason === "witch-curse" || entry.nomineeId === cursedNominator.id),
    false,
    "Witch curse should not consume the day's execution"
  );

  const secondNominator = firstOther(state, (entry) => entry.alive && entry.id !== cursedNominee.id);
  const secondResult = resolveNominationAndVote(
    state,
    {
      nominatorId: secondNominator.id,
      nomineeId: cursedNominee.id,
      humanVoteYes: true,
      decideAIVote: () => true,
    },
    fixedRng()
  );
  assert.equal(secondResult.accepted, true, secondResult.reason);
}

function testVortoxNoExecutionTriggersWhenNightStartsDirectly() {
  const state = startGame("snv", "vortox");
  runNight(state, fixedRng());

  assert.equal(state.phase, "day", "first night should advance into day");
  assert.equal(state.gameOver, false, "game should still be live before the no-execution day closes");
  runNight(state, fixedRng());

  assert.equal(state.gameOver, true, "Vortox should resolve no-execution when day is closed by runNight");
  assert.equal(state.winner, "evil");
}

function testSageQueuesInfoAction() {
  const state = startGame("snv", "sage");
  runNight(state, fixedRng());

  state.players
    .filter((entry) => !entry.isHuman && entry.team === "good")
    .forEach((entry) => {
      entry.alive = false;
    });
  state.events.executions.push({ day: state.day, nomineeId: "contract-prior-execution", died: true });
  runNight(state, fixedRng());

  const action = getPendingStorytellerActionState(state);
  assert.equal(action.available, true);
  assert.equal(action.type, "sage-info");
  assert.equal(action.inputType, "info");
  assert.ok(action.informationText.includes("贤者"));

  const result = resolvePendingStorytellerAction(state, {});
  assert.equal(result.ok, true, result.reason);
  assert.equal(state.pendingStorytellerActions.length, 0);
  assert.equal(
    human(state).privateNotes.some((entry) => entry.includes("贤者") && entry.includes("恶魔")),
    true,
    "resolved Sage info should be written to human private notes"
  );
}

function testMoonchildQueuesStorytellerAction() {
  const state = startGame("bmr", "moonchild");
  runNight(state, fixedRng());
  moveToNomination(state);
  executeHumanPlayer(state);

  const action = getPendingStorytellerActionState(state);
  assert.equal(action.available, true);
  assert.equal(action.type, "moonchild-choice");
  const target = action.options.find((entry) => entry.team === "good");
  assert.ok(target, "Moonchild action should expose legal living targets");

  const result = resolvePendingStorytellerAction(state, { targetIds: [target.id] });
  assert.equal(result.ok, true, result.reason);
  assert.equal(state.pendingStorytellerActions.length, 0);
  assert.equal(state.bmr.moonchildPendingById[human(state).id], target.id);
}

function testKlutzQueuesStorytellerAction() {
  const state = startGame("snv", "klutz");
  runNight(state, fixedRng());
  moveToNomination(state);
  executeHumanPlayer(state);

  const action = getPendingStorytellerActionState(state);
  assert.equal(action.available, true);
  assert.equal(action.type, "klutz-choice");
  const target = action.options.find((entry) => entry.team === "good");
  assert.ok(target, "Klutz action should expose legal living targets");

  const result = resolvePendingStorytellerAction(state, { targetIds: [target.id] });
  assert.equal(result.ok, true, result.reason);
  assert.equal(state.pendingStorytellerActions.length, 0);
  assert.equal(state.gameOver, false, "choosing a good player should not end the game");
}

[
  testGamblerPlayerRole,
  testCourtierChoosesRoleNotPlayer,
  testGodfatherBonusKillUsesHumanTarget,
  testGossipDayStatementAction,
  testSlayerDayActionResolvesPublicDayDeath,
  testPoChargeAndMultiKill,
  testLunaticUsesPerceivedDemonActionWithoutKilling,
  testPhilosopherRoleChoice,
  testArtistQuestion,
  testCerenovusPlayerRole,
  testPitHagPlayerRole,
  testPitHagMultiDemonQueuesStorytellerBalance,
  testPitHagNoDemonDefersGoodWinUntilStorytellerConfirmation,
  testPitHagClockmakerEntryReceivesFirstNightInfo,
  testJugglerGuesses,
  testProfessorInteractionMetadata,
  testProfessorCanTargetAnyDeadPlayerButOnlyRevivesTownsfolk,
  testProfessorRevivesSelectedDeadTownsfolk,
  testSailorExecutionIsRecordedButDoesNotKill,
  testDevilsAdvocateProtectionPreemptsPacifistWeight,
  testPacifistUsesWeightedSaveDecision,
  testInnkeeperProtectionBlocksBMRNightDeath,
  testSailorBlocksNightDeath,
  testMastermindExtraDayGoodExecutionGivesEvilWin,
  testMastermindExtraDayNoExecutionGivesGoodWin,
  testDevilsAdvocateCannotRepeatTarget,
  testExorcistCannotRepeatTarget,
  testZombuulRequiresNoDeathToday,
  testZombuulTreatsPublicDayDeathAsDeathToday,
  testZombuulFirstDeathRegistersDeadButStaysAlive,
  testZombuulHiddenDeadUsesDeadVoteAndPublicThreshold,
  testProfessorTargetingHiddenDeadZombuulDoesNotRetarget,
  testPukkaSuppressedKeepsPreviousPoisonedTarget,
  testGodfatherTriggersFromOutsiderDayDeath,
  testSnakeCharmerHitGivesPrivateInfo,
  testVortoxDreamerInfoIsStrictlyFalse,
  testVortoxSavantAbnormalityCountsForMathematician,
  testBarberSwapPreservesAlignmentAndResetsEntryRole,
  testWitchCurseCreatesDayDeathNotExecution,
  testVortoxNoExecutionTriggersWhenNightStartsDirectly,
  testSageQueuesInfoAction,
  testMoonchildQueuesStorytellerAction,
  testKlutzQueuesStorytellerAction,
].forEach((test) => test());

console.log("role action contracts ok");
