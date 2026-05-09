import assert from "node:assert/strict";

import { getRoleById } from "../scripts/data.js";
import {
  advanceDayStage,
  createNewGame,
  getPendingStorytellerActionState,
  markPublicDiscussionRound,
  resolveNominationAndVote,
  resolvePendingStorytellerAction,
  runNight,
  withSeededRandom,
} from "../scripts/engine.js";
import { buildUnityViewModel } from "../scripts/unity_viewmodel.js";

const PLAYER_COUNT = 9;

function rng(seed = 20260509) {
  return withSeededRandom(seed);
}

function startGame(scriptId, preferredHumanRoleId, seed = 20260509) {
  return createNewGame({ scriptId, playerCount: PLAYER_COUNT, preferredHumanRoleId }, rng(seed));
}

function human(state) {
  const player = state.players.find((entry) => entry.isHuman);
  assert.ok(player, "fixture should have a human player");
  return player;
}

function firstOther(state, predicate = () => true) {
  const player = state.players.find((entry) => !entry.isHuman && predicate(entry));
  assert.ok(player, "fixture should have a matching non-human player");
  return player;
}

function applyRole(state, player, roleId) {
  const role = getRoleById(state.scriptId, roleId);
  assert.ok(role, `${state.scriptId}/${roleId} should exist`);
  player.roleId = role.id;
  player.roleName = role.name;
  player.roleIcon = role.icon ?? null;
  player.apparentRoleId = role.id;
  player.apparentRoleName = role.name;
  player.apparentRoleIcon = role.icon ?? null;
  player.apparentCategory = role.category;
  player.apparentTeam = role.team;
  player.category = role.category;
  player.team = role.team;
  player.tags = [...role.tags];
}

function moveToNomination(state) {
  assert.equal(advanceDayStage(state, "public").ok, true);
  markPublicDiscussionRound(state);
  assert.equal(advanceDayStage(state, "nomination").ok, true);
}

function executePlayer(state, nominee) {
  const humanPlayer = human(state);
  const nominator =
    humanPlayer.alive && humanPlayer.id !== nominee.id ? humanPlayer : firstOther(state, (entry) => entry.alive && entry.id !== nominee.id);
  const result = resolveNominationAndVote(
    state,
    {
      nominatorId: nominator.id,
      nomineeId: nominee.id,
      humanVoteYes: true,
      decideAIVote: () => true,
    },
    rng(77)
  );
  assert.equal(result.accepted, true, result.reason);
  assert.equal(result.passed, true, "execution vote should pass");
  assert.equal(nominee.alive, false, "nominee should die");
}

function assertHumanInfoExport(state, expectedType) {
  const actor = human(state);
  assert.ok(actor.privateNotes.length > 0, `${expectedType} should write private notes`);
  assert.ok(state.pendingHumanInfo.length > 0, `${expectedType} should write pendingHumanInfo`);
  assert.ok(
    state.events.infoPings.some((entry) => entry.actorId === actor.id && entry.type === expectedType),
    `${expectedType} should write a typed infoPing`
  );
  const vm = buildUnityViewModel(state);
  assert.ok(vm.privateInfo.length > 0, `${expectedType} should be visible in Unity privateInfo`);
}

function assertStorytellerQueue(state, expectedType) {
  const action = getPendingStorytellerActionState(state);
  assert.equal(action.available, true, `${expectedType} should be queued`);
  assert.equal(action.type, expectedType);
  const vm = buildUnityViewModel(state);
  assert.equal(vm.pendingStorytellerAction.available, true);
  assert.equal(vm.pendingStorytellerAction.type, expectedType);
  const form = vm.actionForms.find((entry) => entry.id === "storyteller-action");
  assert.ok(form, "Unity should export the storyteller form");
  assert.equal(form.available, true);
  assert.equal(form.inputType, action.inputType);
  return action;
}

function testPassiveInfoWritesTypedDataForUnity() {
  const spyState = startGame("tb", "spy", 11);
  runNight(spyState, rng(12));
  assertHumanInfoExport(spyState, "spy");

  const grandmotherState = startGame("bmr", "grandmother", 21);
  assertHumanInfoExport(grandmotherState, "grandmother");

  const chambermaidState = startGame("bmr", "chambermaid", 31);
  runNight(chambermaidState, rng(32));
  assertHumanInfoExport(chambermaidState, "chambermaid");

  const oracleState = startGame("snv", "oracle", 41);
  runNight(oracleState, rng(42));
  const before = human(oracleState).privateNotes.length;
  runNight(oracleState, rng(43));
  assert.ok(human(oracleState).privateNotes.length > before, "Oracle should receive other-night information before demon kills");
  assertHumanInfoExport(oracleState, "oracle");
}

function testOnDeathInfoRoleDoesNotReceiveGenericPassiveClue() {
  const state = startGame("snv", "sage", 51);
  runNight(state, rng(52));
  assert.equal(
    state.events.infoPings.some((entry) => entry.actorId === human(state).id),
    false,
    "Sage should not receive generic passive night information while alive"
  );
}

function testRavenkeeperQueuesAndResolvesNightDeathInfo() {
  const state = startGame("tb", "ravenkeeper", 61);
  runNight(state, rng(62));
  state.players
    .filter((entry) => !entry.isHuman && entry.team === "good")
    .forEach((entry) => {
      entry.alive = false;
    });
  state.players
    .filter((entry) => entry.alive && entry.category === "minion")
    .forEach((entry) => applyRole(state, entry, "baron"));
  runNight(state, rng(63));

  const action = assertStorytellerQueue(state, "ravenkeeper-info");
  const target = action.options.find((entry) => entry.id !== human(state).id);
  assert.ok(target, "Ravenkeeper should expose a legal learn target");
  const result = resolvePendingStorytellerAction(state, { targetIds: [target.id] });
  assert.equal(result.ok, true, result.reason);
  assert.equal(state.pendingStorytellerActions.length, 0);
  assertHumanInfoExport(state, "ravenkeeper");
}

function testSageQueuesDemonKillInformation() {
  const state = startGame("snv", "sage", 71);
  runNight(state, rng(72));
  state.players
    .filter((entry) => !entry.isHuman && entry.team === "good")
    .forEach((entry) => {
      entry.alive = false;
    });
  state.players
    .filter((entry) => entry.alive && entry.category === "minion")
    .forEach((entry) => applyRole(state, entry, "evil-twin"));
  runNight(state, rng(73));

  const action = assertStorytellerQueue(state, "sage-info");
  assert.equal(action.inputType, "info");
  const result = resolvePendingStorytellerAction(state, {});
  assert.equal(result.ok, true, result.reason);
  assert.equal(state.pendingStorytellerActions.length, 0);
  assertHumanInfoExport(state, "sage");
}

function testMoonchildAndKlutzQueueAfterExecutionDeath() {
  const moonchildState = startGame("bmr", "moonchild", 81);
  runNight(moonchildState, rng(82));
  moonchildState.bmr.devilsAdvocateProtectedId = null;
  moonchildState.players
    .filter((entry) => ["pacifist", "tea-lady", "fool", "devils-advocate"].includes(entry.roleId))
    .forEach((entry) => applyRole(moonchildState, entry, "sailor"));
  moveToNomination(moonchildState);
  executePlayer(moonchildState, human(moonchildState));
  const moonchildAction = assertStorytellerQueue(moonchildState, "moonchild-choice");
  const moonchildTarget = moonchildAction.options.find((entry) => entry.team === "good");
  assert.ok(moonchildTarget, "Moonchild should expose a living target");
  assert.equal(resolvePendingStorytellerAction(moonchildState, { targetIds: [moonchildTarget.id] }).ok, true);

  const klutzState = startGame("snv", "klutz", 91);
  runNight(klutzState, rng(92));
  klutzState.snv.witchCurses = {};
  klutzState.players
    .filter((entry) => entry.alive && entry.category === "minion")
    .forEach((entry) => applyRole(klutzState, entry, "evil-twin"));
  moveToNomination(klutzState);
  executePlayer(klutzState, human(klutzState));
  const klutzAction = assertStorytellerQueue(klutzState, "klutz-choice");
  const klutzTarget = klutzAction.options.find((entry) => entry.team === "good");
  assert.ok(klutzTarget, "Klutz should expose a living target");
  assert.equal(resolvePendingStorytellerAction(klutzState, { targetIds: [klutzTarget.id] }).ok, true);
}

function testBarberQueuesForHumanDemonAndSwapsRoles() {
  const state = startGame("snv", "fang-gu", 101);
  runNight(state, rng(102));
  const barber = firstOther(state, (entry) => entry.alive && entry.team === "good");
  applyRole(state, barber, "barber");

  moveToNomination(state);
  executePlayer(state, barber);
  const action = assertStorytellerQueue(state, "barber-swap");
  const targets = action.options.filter((entry) => entry.category !== "demon").slice(0, 2);
  assert.equal(targets.length, 2, "Barber should expose two swappable non-demon targets");
  const beforeRoles = targets.map((entry) => state.players.find((player) => player.id === entry.id)?.roleId);
  const result = resolvePendingStorytellerAction(state, { targetIds: targets.map((entry) => entry.id) });
  assert.equal(result.ok, true, result.reason);
  assert.equal(state.pendingStorytellerActions.length, 0);
  const afterRoles = targets.map((entry) => state.players.find((player) => player.id === entry.id)?.roleId);
  assert.deepEqual(afterRoles, beforeRoles.reverse(), "Barber resolution should swap the selected roles");
}

[
  testPassiveInfoWritesTypedDataForUnity,
  testOnDeathInfoRoleDoesNotReceiveGenericPassiveClue,
  testRavenkeeperQueuesAndResolvesNightDeathInfo,
  testSageQueuesDemonKillInformation,
  testMoonchildAndKlutzQueueAfterExecutionDeath,
  testBarberQueuesForHumanDemonAndSwapsRoles,
].forEach((test) => test());

console.log("passive info and storyteller queue contracts ok");
