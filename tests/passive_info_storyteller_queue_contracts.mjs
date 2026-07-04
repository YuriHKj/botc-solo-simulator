import assert from "node:assert/strict";

import { getRoleById } from "../scripts/data.js";
import {
  canRegisterAsCategory,
  chooseFalseRoleForInfo,
  chooseFortuneTellerRedHerring,
  chooseRegisteredAdjacentTeamPairs,
  chooseRegisteredTeamCount,
  chooseSituationAwareFalseRoleForInfo,
  chooseSituationAwareRegisteredAdjacentTeamPairs,
  chooseSituationAwareRegisteredTeamCount,
  scoreTwoPlayerFalseToken,
} from "../scripts/info_reasonableness.js";
import {
  advanceDayStage,
  createNewGame,
  endDayAndBeginNight,
  getPendingStorytellerActionState,
  markPublicDiscussionRound,
  resolveNominationAndVote,
  resolvePendingStorytellerAction,
  runNight,
  skipDay,
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
  assert.equal(nominee.alive, true, "passed vote should wait on the block before day end");
  assert.equal(skipDay(state, rng(78)), true, "day end should resolve the execution");
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

function playerById(state, playerId) {
  const player = state.players.find((entry) => entry.id === playerId);
  assert.ok(player, `expected player ${playerId}`);
  return player;
}

function applyRolesInSeatOrder(state, roleIds) {
  state.players
    .filter((entry) => !entry.isHuman)
    .forEach((player, idx) => {
      applyRole(state, player, roleIds[idx]);
    });
}

function latestHumanInfoPing(state, type) {
  const actor = human(state);
  const ping = state.events.infoPings.findLast?.((entry) => entry.actorId === actor.id && entry.type === type);
  assert.ok(ping, `expected a ${type} info ping`);
  return ping;
}

function testTbTwoPlayerInfoUsesReasonableFalseTokens() {
  const washerwomanState = startGame("tb", "washerwoman", 121);
  applyRolesInSeatOrder(washerwomanState, [
    "fortune-teller",
    "saint",
    "empath",
    "virgin",
    "soldier",
    "butler",
    "baron",
    "imp",
  ]);
  runNight(washerwomanState, rng(122));
  const washerwomanPing = latestHumanInfoPing(washerwomanState, "washerwoman");
  const washerwomanFalse = playerById(washerwomanState, washerwomanPing.falseTokenId);
  assert.equal(washerwomanPing.selectionProfile, "reasonable-two-player-info:v1");
  assert.equal(washerwomanPing.targetIds.includes(human(washerwomanState).id), false, "Washerwoman info should avoid self when alternatives exist");
  assert.notEqual(washerwomanFalse.roleId, "saint", "Washerwoman false token should avoid a hard outsider confirmation when townsfolk alternatives exist");
  assert.equal(
    washerwomanFalse.apparentCategory ?? washerwomanFalse.category,
    "townsfolk",
    "Washerwoman false token should prefer a player who can plausibly sit in a townsfolk pair"
  );

  const librarianState = startGame("tb", "librarian", 131);
  applyRolesInSeatOrder(librarianState, [
    "saint",
    "butler",
    "fortune-teller",
    "chef",
    "empath",
    "baron",
    "imp",
    "soldier",
  ]);
  runNight(librarianState, rng(132));
  const librarianPing = latestHumanInfoPing(librarianState, "librarian");
  const librarianFalse = playerById(librarianState, librarianPing.falseTokenId);
  assert.equal(librarianPing.selectionProfile, "reasonable-two-player-info:v1");
  assert.equal(librarianFalse.category, "outsider", "Librarian false token should prefer another outsider when one is available");

  const investigatorState = startGame("tb", "investigator", 141);
  applyRolesInSeatOrder(investigatorState, [
    "baron",
    "imp",
    "saint",
    "empath",
    "soldier",
    "virgin",
    "butler",
    "ravenkeeper",
  ]);
  runNight(investigatorState, rng(142));
  const investigatorPing = latestHumanInfoPing(investigatorState, "investigator");
  const investigatorFalse = playerById(investigatorState, investigatorPing.falseTokenId);
  assert.equal(investigatorPing.selectionProfile, "reasonable-two-player-info:v1");
  assert.equal(investigatorPing.shownRoleId, "baron");
  assert.equal(investigatorFalse.team, "good", "Investigator false token should prefer a good scapegoat over another evil player");
}

function testRoleBoundMisregistrationAffectsInformationWeights() {
  const spy = { roleId: "spy", category: "minion", team: "evil", tags: ["intel", "misregister"] };
  const baron = { roleId: "baron", category: "minion", team: "evil", tags: ["setupShift"] };
  const saint = { roleId: "saint", category: "outsider", team: "good", tags: ["outsider", "risk"] };
  const recluse = { roleId: "recluse", category: "outsider", team: "good", tags: ["outsider", "misregister"] };

  assert.equal(canRegisterAsCategory(spy, "townsfolk"), true, "Spy should carry townsfolk misregistration outside TB-specific code");
  assert.equal(canRegisterAsCategory(spy, "outsider"), true, "Spy should carry outsider misregistration outside TB-specific code");
  assert.equal(canRegisterAsCategory(recluse, "minion"), true, "Recluse should carry minion misregistration outside TB-specific code");

  assert.ok(
    scoreTwoPlayerFalseToken("outsider-role", spy) > scoreTwoPlayerFalseToken("outsider-role", baron),
    "Spy should be a more plausible false token than a normal minion for outsider information"
  );
  assert.ok(
    scoreTwoPlayerFalseToken("townsfolk-role", spy) > scoreTwoPlayerFalseToken("townsfolk-role", saint),
    "Spy's good registration should matter for townsfolk information even when it is objectively a minion"
  );
  assert.ok(
    scoreTwoPlayerFalseToken("minion-role", recluse) > scoreTwoPlayerFalseToken("minion-role", saint),
    "Recluse should be weighted as a stronger investigator false token than a normal outsider"
  );
}

function testTbOtherInfoRolesUseRoleBoundReasonableness() {
  const recluse = { id: "recluse", roleId: "recluse", category: "outsider", team: "good", seatIndex: 0, tags: ["outsider", "misregister"] };
  const spy = { id: "spy", roleId: "spy", category: "minion", team: "evil", seatIndex: 1, tags: ["intel", "misregister"] };
  const imp = { id: "imp", roleId: "imp", category: "demon", team: "evil", seatIndex: 2, tags: ["demon"] };
  const saint = { id: "saint", roleId: "saint", category: "outsider", team: "good", seatIndex: 3, tags: ["outsider", "risk"] };
  const fortuneTeller = { id: "ft", roleId: "fortune-teller", category: "townsfolk", team: "good", seatIndex: 4, tags: ["info"] };

  assert.equal(
    chooseRegisteredTeamCount([recluse, saint], "evil", { mode: "mislead-high", max: 2 }),
    1,
    "Empath-style counts should be able to treat Recluse as evil when that is the chosen registration"
  );
  assert.equal(
    chooseRegisteredAdjacentTeamPairs([recluse, spy, imp, saint, fortuneTeller], "evil", { mode: "mislead-high" }),
    2,
    "Chef-style counts should include role-bound false registration options"
  );
  assert.equal(
    chooseFortuneTellerRedHerring([saint, recluse, fortuneTeller], (options) => options[0])?.roleId,
    "recluse",
    "Fortune Teller red herring should prefer a good player who can register demon"
  );

  const roles = [
    { id: "saint", category: "outsider", team: "good", tags: ["outsider", "risk"] },
    { id: "baron", category: "minion", team: "evil", tags: ["setupShift"] },
    { id: "imp", category: "demon", team: "evil", tags: ["demon"] },
    { id: "butler", category: "outsider", team: "good", tags: ["outsider"] },
  ];
  assert.equal(
    chooseFalseRoleForInfo(roles, "saint", "identity-check", (options) => options[0])?.team,
    "evil",
    "Blocked Undertaker/Ravenkeeper identity checks should prefer harmful but plausible false teams"
  );
}

function testSituationAwareInformationChoosesMisleadDirection() {
  const recluse = { id: "recluse", roleId: "recluse", category: "outsider", team: "good", seatIndex: 0, alive: true, tags: ["outsider", "misregister"] };
  const saint = { id: "saint", roleId: "saint", category: "outsider", team: "good", seatIndex: 1, alive: true, tags: ["outsider", "risk"] };
  const imp = { id: "imp", roleId: "imp", category: "demon", team: "evil", seatIndex: 2, alive: true, tags: ["demon"] };
  const deadGoodA = { id: "dead-good-a", roleId: "soldier", category: "townsfolk", team: "good", seatIndex: 3, alive: false, tags: ["defense"] };
  const deadGoodB = { id: "dead-good-b", roleId: "virgin", category: "townsfolk", team: "good", seatIndex: 4, alive: false, tags: ["social"] };
  const goodUnderPressure = { day: 2, players: [recluse, saint, imp, deadGoodA, deadGoodB] };
  const empathDecision = chooseSituationAwareRegisteredTeamCount([recluse, saint], "evil", goodUnderPressure, { max: 2 });
  assert.equal(empathDecision.value, 1, "Good-under-pressure misinformation should frame a plausible good neighbor when actual evil count is low");
  assert.equal(empathDecision.strategy, "frame-good-pressure");

  const spy = { id: "spy", roleId: "spy", category: "minion", team: "evil", seatIndex: 0, alive: true, tags: ["intel", "misregister"] };
  const aliveImp = { ...imp, seatIndex: 1 };
  const aliveSaint = { ...saint, seatIndex: 2 };
  const deadBaron = { id: "dead-baron", roleId: "baron", category: "minion", team: "evil", seatIndex: 3, alive: false, tags: ["setupShift"] };
  const evilUnderPressure = { day: 3, players: [spy, aliveImp, aliveSaint, deadBaron] };
  const chefDecision = chooseSituationAwareRegisteredAdjacentTeamPairs([spy, aliveImp, aliveSaint], "evil", evilUnderPressure);
  assert.equal(chefDecision.value, 0, "Evil-under-pressure misinformation should hide a real adjacent evil line when Spy can register good");
  assert.equal(chefDecision.strategy, "hide-evil-pressure");

  const roles = [
    { id: "baron", category: "minion", team: "evil", tags: ["setupShift"] },
    { id: "imp", category: "demon", team: "evil", tags: ["demon"] },
    { id: "soldier", category: "townsfolk", team: "good", tags: ["defense"] },
    { id: "saint", category: "outsider", team: "good", tags: ["outsider", "risk"] },
  ];
  const falseRole = chooseSituationAwareFalseRoleForInfo(roles, "baron", evilUnderPressure, "identity-check", (options) => options[0]);
  assert.equal(falseRole.role.team, "good", "When evil is under pressure, false identity checks should hide confirmed evil");
  assert.equal(falseRole.strategy, "hide-confirmed-evil");
}

function testLibrarianCanSeeSpyAsRegisteredDrunk() {
  const state = startGame("tb", "librarian", 151);
  applyRolesInSeatOrder(state, [
    "spy",
    "saint",
    "fortune-teller",
    "chef",
    "empath",
    "baron",
    "imp",
    "soldier",
  ]);
  runNight(state, rng(152));

  const ping = latestHumanInfoPing(state, "librarian");
  const spy = state.players.find((entry) => entry.roleId === "spy");
  assert.ok(spy, "fixture should include a Spy");
  assert.equal(ping.registeredHolderId, spy.id, "Librarian should be able to use Spy as the registered outsider holder");
  assert.equal(ping.truthHolderId, null, "Registered Spy-as-outsider information should not be marked as an actual outsider holder");
  assert.equal(ping.shownRoleId, "drunk", "Spy should be able to register as the Drunk for disruptive Librarian information");
  assert.equal(ping.situationStrategy, "registered-drunk-pressure");
  assert.ok(ping.targetIds.includes(spy.id), "Librarian pair should include the Spy registered as Drunk");
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

function testTbRunNightReportsNonTerminalRavenkeeperQueue() {
  const random = rng(3);
  const state = createNewGame({ scriptId: "tb", playerCount: PLAYER_COUNT, preferredHumanRoleId: "ravenkeeper" }, random);
  runNight(state, random);
  const result = runNight(state, random);

  assert.equal(state.gameOver, false, "fixture should remain playable after the Ravenkeeper dies");
  assert.equal(result.stage, "storyteller");
  assert.equal(result.pendingStorytellerActions, 1);
  assertStorytellerQueue(state, "ravenkeeper-info");

  const blockedDay = state.day;
  const blockedNight = state.night;
  const ignoredRunNight = runNight(state, random);
  assert.equal(ignoredRunNight.stage, "storyteller", "unresolved Ravenkeeper queue should keep blocking runNight");
  assert.equal(state.day, blockedDay, "runNight must not advance the day while a Storyteller queue is pending");
  assert.equal(state.night, blockedNight, "runNight must not advance the night while a Storyteller queue is pending");

  const ignoredDayEnd = endDayAndBeginNight(state, random);
  assert.equal(ignoredDayEnd.stage, "storyteller", "unresolved Ravenkeeper queue should block day-end advancement");
  assert.equal(state.day, blockedDay, "day-end must not advance while a Storyteller queue is pending");
  assert.equal(state.night, blockedNight, "day-end must not advance while a Storyteller queue is pending");
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
  testTbTwoPlayerInfoUsesReasonableFalseTokens,
  testRoleBoundMisregistrationAffectsInformationWeights,
  testTbOtherInfoRolesUseRoleBoundReasonableness,
  testSituationAwareInformationChoosesMisleadDirection,
  testLibrarianCanSeeSpyAsRegisteredDrunk,
  testPassiveInfoWritesTypedDataForUnity,
  testOnDeathInfoRoleDoesNotReceiveGenericPassiveClue,
  testTbRunNightReportsNonTerminalRavenkeeperQueue,
  testRavenkeeperQueuesAndResolvesNightDeathInfo,
  testSageQueuesDemonKillInformation,
  testMoonchildAndKlutzQueueAfterExecutionDeath,
  testBarberQueuesForHumanDemonAndSwapsRoles,
].forEach((test) => test());

console.log("passive info and storyteller queue contracts ok");
