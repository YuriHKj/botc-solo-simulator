import assert from "node:assert/strict";

import {
  advanceDayStage,
  createNewGame,
  getHumanDayActionState,
  getHumanNightActionState,
  getPerceivedRoleId,
  getPendingStorytellerActionState,
  markPublicDiscussionRound,
  resolveNominationAndVote,
  resolvePendingStorytellerAction,
  runNight,
  setHumanDayActionPlan,
  setHumanNightActionPlan,
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
  const target = firstOther(state, (entry) => entry.alive);
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
  runNight(state, fixedRng());

  assert.ok(
    state.logs.some((entry) => entry.type === "day-skill" && /Gossip 声明已判定/.test(entry.message)),
    "Gossip statement should be adjudicated at end of day"
  );
}

function testPoChargeAndMultiKill() {
  const state = startGame("bmr", "po");
  runNight(state, fixedRng());
  let action = getHumanNightActionState(state);
  assert.equal(action.inputType, "charge-or-targets");
  let result = setHumanNightActionPlan(state, { mode: "charge" });
  assert.equal(result.ok, true, result.reason);
  runNight(state, fixedRng());
  assert.equal(state.bmr.poCharged, true, "Po charge should persist after the night");

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
  const action = getHumanNightActionState(state);
  assert.equal(action.inputType, "role");
  const result = setHumanNightActionPlan(state, { roleId: "dreamer" });
  assert.equal(result.ok, true, result.reason);
  runNight(state, fixedRng());
  assert.equal(human(state).roleId, "dreamer", "Philosopher should gain the chosen role");
}

function testArtistQuestion() {
  const state = startGame("snv", "artist");
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
  const target = firstOther(state, (entry) => entry.alive);
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
  const target = firstOther(state, (entry) => entry.alive);
  const action = getHumanNightActionState(state);
  assert.equal(action.inputType, "player-role");
  const result = setHumanNightActionPlan(state, { targetIds: [target.id], roleId: "mutant" });
  assert.equal(result.ok, true, result.reason);
  runNight(state, fixedRng());
  assert.equal(target.roleId, "mutant", "Pit-Hag should transform target into selected role");
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
  const deadTownsfolk = firstOther(state, (entry) => entry.category === "townsfolk");
  deadTownsfolk.alive = false;

  const action = getHumanNightActionState(state);
  assert.equal(action.available, true, action.reason);
  assert.equal(action.roleId, "professor");
  assert.equal(action.interaction.title, "教授的禁忌讲堂");
  assert.equal(action.options.some((entry) => entry.id === deadTownsfolk.id), true);
}

function testSnakeCharmerHitGivesPrivateInfo() {
  const state = startGame("snv", "snake-charmer");
  const demon = state.players.find((entry) => entry.category === "demon");
  assert.ok(demon, "expected a demon target");

  const action = getHumanNightActionState(state);
  assert.equal(action.available, true, action.reason);
  const planned = setHumanNightActionPlan(state, { targetIds: [demon.id] });
  assert.equal(planned.ok, true, planned.reason);
  runNight(state, fixedRng());

  assert.equal(human(state).category, "demon", "Snake Charmer should become the demon after hitting a demon");
  assert.equal(
    human(state).privateNotes.some((entry) => entry.includes("舞蛇人") && entry.includes("身份已交换")),
    true,
    "human Snake Charmer should receive explicit swap information"
  );
}

function testSageQueuesInfoAction() {
  const state = startGame("snv", "sage");
  runNight(state, fixedRng());

  state.players
    .filter((entry) => !entry.isHuman && entry.team === "good")
    .forEach((entry) => {
      entry.alive = false;
    });
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
  testPoChargeAndMultiKill,
  testLunaticUsesPerceivedDemonActionWithoutKilling,
  testPhilosopherRoleChoice,
  testArtistQuestion,
  testCerenovusPlayerRole,
  testPitHagPlayerRole,
  testJugglerGuesses,
  testProfessorInteractionMetadata,
  testSnakeCharmerHitGivesPrivateInfo,
  testSageQueuesInfoAction,
  testMoonchildQueuesStorytellerAction,
  testKlutzQueuesStorytellerAction,
].forEach((test) => test());

console.log("role action contracts ok");
