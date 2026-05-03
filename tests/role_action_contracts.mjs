import assert from "node:assert/strict";

import {
  advanceDayStage,
  createNewGame,
  getHumanDayActionState,
  getHumanNightActionState,
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

[
  testGamblerPlayerRole,
  testPoChargeAndMultiKill,
  testPhilosopherRoleChoice,
  testArtistQuestion,
  testCerenovusPlayerRole,
  testPitHagPlayerRole,
  testJugglerGuesses,
].forEach((test) => test());

console.log("role action contracts ok");
