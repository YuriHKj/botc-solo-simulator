import assert from "node:assert/strict";

import {
  advanceDayStage,
  beginNightPhase,
  checkWin,
  createNewGame,
  endDayAndBeginNight,
  getEffectiveRoleId,
  getHumanDayActionState,
  getHumanNightActionState,
  getPubliclyAlivePlayers,
  getPlayerById,
  getPerceivedRoleId,
  getPendingStorytellerActionState,
  markPublicDiscussionRound,
  processDayDeath,
  processNightDeath,
  registerClaim,
  resolveNominationAndVote,
  resolvePendingStorytellerAction,
  runNight,
  setHumanDayActionPlan,
  setHumanNightActionPlan,
  skipDay,
  withSeededRandom,
} from "../scripts/engine.js";
import { createNominationDebate } from "../scripts/ai.js";
import { getRoleById } from "../scripts/data.js";
import { getScriptRoleDayActionRules } from "../scripts/roles/index.js";
import { SNV_RULE_HANDLERS } from "../scripts/roles/snv.js";
import { buildUnityViewModel } from "../scripts/unity_viewmodel.js";

function fixedRng() {
  let seed = 123456789;
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

function withMockedMathRandom(value, fn) {
  const original = Math.random;
  Math.random = () => value;
  try {
    return fn();
  } finally {
    Math.random = original;
  }
}

function human(state) {
  return state.players.find((entry) => entry.isHuman);
}

function firstOther(state, predicate = () => true) {
  const player = state.players.find((entry) => !entry.isHuman && predicate(entry));
  assert.ok(player, "expected a non-human target");
  return player;
}

function applyRole(state, player, roleId) {
  const role = getRoleById(state.scriptId, roleId);
  assert.ok(role, `expected role ${roleId}`);
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
  player.tags = [...(role.tags ?? [])];
}

function roleActionPlan(action, overrides = {}) {
  const minTargets = action.minTargetCount ?? action.targetCount ?? 0;
  const maxTargets = action.maxTargetCount ?? action.targetCount ?? minTargets;
  const targetIds = (action.options ?? []).slice(0, Math.max(0, Math.min(maxTargets, Math.max(1, minTargets)))).map((entry) => entry.id);
  const roleId = action.roleOptions?.find((entry) => entry.id)?.id ?? "";

  if (action.inputType === "role") return { roleId, ...overrides };
  if (action.inputType === "player-role") return { targetIds, roleId, ...overrides };
  if (action.inputType === "question") return { question: "Seat 1 is good.", ...overrides };
  if (action.inputType === "guesses") {
    const guessCount = Math.max(1, action.minGuessCount ?? 1);
    const guesses = (action.options ?? []).slice(0, guessCount).map((entry) => ({
      playerId: entry.id,
      roleId: roleId || action.roleOptions?.[0]?.id || "",
    }));
    return { guesses, ...overrides };
  }
  return { targetIds, ...overrides };
}

function assertDayActionDescriptorComplete(scriptId, roleId, action) {
  assert.equal(action.available, true, `${scriptId}/${roleId} should expose an available day action`);
  assert.equal(action.roleId, roleId, `${scriptId}/${roleId} should preserve the action role id`);
  assert.ok(action.roleName, `${scriptId}/${roleId} should expose a role name`);
  assert.ok(action.inputType, `${scriptId}/${roleId} should expose an inputType`);
  assert.ok(action.prompt, `${scriptId}/${roleId} should expose a prompt`);
  assert.ok(action.interaction, `${scriptId}/${roleId} should expose rich interaction metadata`);
  assert.ok(action.interaction.title, `${scriptId}/${roleId} should expose an interaction title`);
  assert.ok(action.interaction.confirmText, `${scriptId}/${roleId} should expose confirm text`);
  assert.ok(action.interaction.skipText, `${scriptId}/${roleId} should expose skip text`);

  if (["player-target", "player-role", "guesses"].includes(action.inputType)) {
    assert.ok((action.options ?? []).length >= 1, `${scriptId}/${roleId} should expose player options`);
  }
  if (["role", "player-role", "guesses"].includes(action.inputType)) {
    assert.ok((action.roleOptions ?? []).length >= 1, `${scriptId}/${roleId} should expose role options`);
  }
}

function assertUnityViewModelCarriesFullDayAction(scriptId, roleId, state, action) {
  const vm = buildUnityViewModel(state);
  assert.equal(vm.humanDayAction.available, true, `${scriptId}/${roleId} viewmodel should expose the human day action`);
  assert.equal(vm.humanDayAction.roleId, action.roleId);
  assert.equal(vm.humanDayAction.inputType, action.inputType);
  assert.equal(vm.humanDayAction.options.length, (action.options ?? []).length, `${scriptId}/${roleId} humanDayAction should not drop player options`);
  assert.equal(
    vm.humanDayAction.roleOptions.length,
    (action.roleOptions ?? []).length,
    `${scriptId}/${roleId} humanDayAction should not drop role options`
  );

  const form = vm.actionForms.find((entry) => entry.id === "day-action");
  assert.ok(form, `${scriptId}/${roleId} should export a day action form`);
  assert.equal(form.available, true, `${scriptId}/${roleId} day action form should be available`);
  assert.equal(form.inputType, action.inputType);
  assert.equal(form.options.length, (action.options ?? []).length, `${scriptId}/${roleId} action form should not truncate player options`);
  assert.equal(form.roleOptions.length, (action.roleOptions ?? []).length, `${scriptId}/${roleId} action form should not truncate role options`);
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
  assert.equal(target.alive, true, "passing vote should put the target on the block before day end");
  assert.equal(skipDay(state), true, "ending the day should resolve the on-the-block execution");
  assert.equal(target.alive, false, "human player should be executed");
}

function testPassedNominationWaitsForDayEndAndCanBeOvertaken() {
  const state = startGame("tb", "washerwoman", 12);
  runNight(state, fixedRng());
  moveToNomination(state);

  const livingAis = state.players.filter((entry) => !entry.isHuman && entry.alive && entry.roleId !== "virgin");
  assert.ok(livingAis.length >= 8, "fixture needs enough living AI players");
  const firstTarget = livingAis[0];
  const secondNominator = livingAis[8];
  const secondTarget = livingAis[9];
  const firstYes = new Set(livingAis.slice(0, 6).map((entry) => entry.id));
  const secondYes = new Set(livingAis.slice(0, 8).map((entry) => entry.id));
  const decideAIVote = (voter, nominee) => (nominee.id === firstTarget.id ? firstYes.has(voter.id) : secondYes.has(voter.id));

  const first = resolveNominationAndVote(
    state,
    {
      nominatorId: human(state).id,
      nomineeId: firstTarget.id,
      humanVoteYes: true,
      decideAIVote,
    },
    fixedRng()
  );

  assert.equal(first.accepted, true, first.reason);
  assert.equal(first.passed, true);
  assert.ok(first.yesVotes >= first.threshold);
  assert.equal(first.onBlock, true);
  assert.equal(firstTarget.alive, true, "first passed vote should not kill before day end");
  assert.equal(state.dayStageMeta.executionCandidate.nomineeId, firstTarget.id);

  const second = resolveNominationAndVote(
    state,
    {
      nominatorId: secondNominator.id,
      nomineeId: secondTarget.id,
      humanVoteYes: true,
      decideAIVote,
    },
    fixedRng()
  );

  assert.equal(second.accepted, true, second.reason);
  assert.equal(second.passed, true);
  assert.ok(second.yesVotes > first.yesVotes, "second nomination should clear the existing vote count");
  assert.equal(second.replacedExecutionCandidate?.nomineeId, firstTarget.id);
  assert.equal(state.dayStageMeta.executionCandidate.nomineeId, secondTarget.id);
  assert.equal(firstTarget.alive, true, "overtaken nominee should survive day end");
  assert.equal(secondTarget.alive, true, "new on-block nominee should wait until day end");

  assert.equal(skipDay(state), true);
  assert.equal(firstTarget.alive, true, "only the final on-block nominee should be executed");
  assert.equal(secondTarget.alive, false, "day end should execute the highest-vote nominee");
  assert.ok(state.events.executions.some((entry) => entry.nomineeId === secondTarget.id && entry.reason === "vote-execution"));
}

function testSelfNominationIsRejectedWithoutSpendingNomination() {
  const state = startGame("tb", "washerwoman");
  runNight(state, fixedRng());
  moveToNomination(state);

  const player = human(state);
  const result = resolveNominationAndVote(
    state,
    {
      nominatorId: player.id,
      nomineeId: player.id,
      humanVoteYes: true,
      decideAIVote: () => true,
    },
    fixedRng()
  );

  assert.equal(result.accepted, false, "self-nomination should be rejected by the rules engine");
  assert.equal(player.nominatedToday, false, "rejected self-nomination should not spend the nominator");
  assert.equal(player.beenNominatedToday, false, "rejected self-nomination should not mark the player as nominated");
  assert.equal(state.events.votes.length, 0, "rejected self-nomination should not create a vote");
  assert.equal(state.events.nominations?.length ?? 0, 0, "rejected self-nomination should not create a nomination event");
}

function testDayEndBlocksPendingNominationDebate() {
  const state = startGame("tb", "washerwoman");
  runNight(state, fixedRng());
  moveToNomination(state);

  const nominator = human(state);
  const nominee = firstOther(state, (entry) => entry.alive);
  const debate = createNominationDebate(
    state,
    {
      nominatorId: nominator.id,
      nomineeId: nominee.id,
      reason: "contract pending debate",
      source: "contract",
    },
    fixedRng()
  );
  assert.equal(debate.ok, true, debate.reason);
  assert.equal(state.dayStageMeta.nominationDebate?.active, true, "fixture should create a pending pre-vote debate");

  assert.equal(skipDay(state, fixedRng()), false, "legacy day skip should not bypass a pending nomination vote");
  assert.equal(
    state.dayStageMeta.dayEndResolvedDay ?? null,
    null,
    "blocked skip should not mark the day as resolved"
  );
  assert.equal(state.events.votes.length, 0, "blocked skip should not fabricate or discard a vote");

  const ended = endDayAndBeginNight(state, fixedRng());
  assert.equal(ended.ok, false, "day end should stop until the pending nomination vote resolves");
  assert.equal(ended.stage, "nomination-debate");
  assert.equal(state.phase, "day");
  assert.equal(state.dayStage, "nomination");
  assert.equal(state.dayStageMeta.nominationDebate?.active, true, "blocked day end should preserve the debate");
}

function startGame(scriptId, roleId, playerCount = 9) {
  return createNewGame({ scriptId, playerCount, preferredHumanRoleId: roleId }, fixedRng());
}

function countCategories(state) {
  return state.players.reduce((counts, player) => {
    counts[player.category] = (counts[player.category] ?? 0) + 1;
    return counts;
  }, {});
}

function testPreferredBaronAppliesSetupShift() {
  const state = startGame("tb", "baron", 9);

  assert.equal(human(state).roleId, "baron", "fixture should put the preferred Baron on the human player");
  assert.deepEqual(state.baseSetupCounts, { townsfolk: 5, outsider: 2, minion: 1, demon: 1 });
  assert.deepEqual(state.setupCounts, { townsfolk: 3, outsider: 4, minion: 1, demon: 1 });
  assert.deepEqual(countCategories(state), { minion: 1, townsfolk: 3, outsider: 4, demon: 1 });
}

function testPreferredGodfatherAppliesSetupShift() {
  const state = startGame("bmr", "godfather", 7);

  assert.equal(human(state).roleId, "godfather", "fixture should put the preferred Godfather on the human player");
  assert.deepEqual(state.baseSetupCounts, { townsfolk: 5, outsider: 0, minion: 1, demon: 1 });
  assert.deepEqual(state.setupCounts, { townsfolk: 4, outsider: 1, minion: 1, demon: 1 });
  assert.deepEqual(countCategories(state), { minion: 1, townsfolk: 4, outsider: 1, demon: 1 });
  assert.equal(state.bmr.godfatherOutsiderIds.length, 1, "Godfather setup info should use the adjusted outsider set");
}

function testPreferredFangGuAppliesSetupShift() {
  const state = startGame("snv", "fang-gu", 9);

  assert.equal(human(state).roleId, "fang-gu", "fixture should put the preferred Fang Gu on the human player");
  assert.deepEqual(state.baseSetupCounts, { townsfolk: 5, outsider: 2, minion: 1, demon: 1 });
  assert.deepEqual(state.setupCounts, { townsfolk: 4, outsider: 3, minion: 1, demon: 1 });
  assert.deepEqual(countCategories(state), { demon: 1, townsfolk: 4, outsider: 3, minion: 1 });
}

function testPreferredOutsiderOutsideBaseSetupKeepsCountsHonest() {
  [
    { scriptId: "tb", roleId: "drunk" },
    { scriptId: "tb", roleId: "saint" },
    { scriptId: "bmr", roleId: "lunatic" },
    { scriptId: "snv", roleId: "barber" },
  ].forEach(({ scriptId, roleId }) => {
    const state = createNewGame({ scriptId, playerCount: 7, preferredHumanRoleId: roleId }, withSeededRandom(1));

    assert.equal(human(state).roleId, roleId, `${scriptId}/${roleId} should put the preferred Outsider on the human player`);
    assert.deepEqual(state.baseSetupCounts, { townsfolk: 5, outsider: 0, minion: 1, demon: 1 });
    assert.deepEqual(state.setupCounts, { townsfolk: 4, outsider: 1, minion: 1, demon: 1 });
    assert.deepEqual(countCategories(state), state.setupCounts, `${scriptId}/${roleId} setupCounts should match the actual dealt bag`);
    if (roleId === "drunk") {
      assert.notEqual(getPerceivedRoleId(human(state)), "drunk", "preferred Drunk should still see a Townsfolk mask");
      assert.equal(human(state).apparentCategory, "townsfolk", "preferred Drunk mask should be a Townsfolk role");
    }
  });
}

function syncSnvRoleChangeForContract(state, changedPlayerIds = []) {
  SNV_RULE_HANDLERS.onRoleChange(
    {
      state,
      addLog: (gameState, type, message, payload = {}) => {
        gameState.logs.push({ id: `contract-${gameState.logs.length + 1}`, type, message, payload });
      },
      addPrivateInfo: (gameState, player, text) => {
        player.privateNotes.push(text);
      },
      chooseOne: (list) => list?.[0] ?? null,
      getEffectiveRoleId,
      getPlayerById,
      isAbilityBlocked: () => false,
    },
    { reason: "contract-role-change", changedPlayerIds }
  );
}

function neutralizeSnvNightRoleChangers(state, excludedIds = []) {
  const excluded = new Set(excludedIds);
  state.players
    .filter((entry) => !entry.isHuman && entry.category !== "demon" && !excluded.has(entry.id))
    .forEach((entry) => applyRole(state, entry, "clockmaker"));
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

  const target = firstOther(
    state,
    (entry) => entry.alive && entry.category === "townsfolk" && !["gambler", "sailor", "fool", "tea-lady"].includes(entry.roleId)
  );
  const planned = setHumanNightActionPlan(state, { targetIds: [target.id] });
  assert.equal(planned.ok, true, planned.reason);
  runNight(state, fixedRng());

  assert.ok(
    state.events.nightDeaths.some((entry) => entry.reason === "godfather-bonus-kill" && entry.playerId === target.id),
    "human Godfather bonus kill should consume the selected target"
  );
}

function testEveryScriptDayActionHasCompleteDescriptorUnityFormAndSubmission() {
  const checked = [];
  for (const scriptId of ["tb", "bmr", "snv"]) {
    const rules = getScriptRoleDayActionRules(scriptId);
    for (const roleId of Object.keys(rules)) {
      const state = startGame(scriptId, roleId);
      runNight(state, fixedRng());
      assert.equal(advanceDayStage(state, "public").ok, true, `${scriptId}/${roleId} should enter public stage`);

      const action = getHumanDayActionState(state);
      assertDayActionDescriptorComplete(scriptId, roleId, action);
      assertUnityViewModelCarriesFullDayAction(scriptId, roleId, state, action);

      const result = setHumanDayActionPlan(state, roleActionPlan(action), fixedRng());
      assert.equal(result.ok, true, `${scriptId}/${roleId} should accept a complete legal day action: ${result.reason ?? ""}`);
      checked.push(`${scriptId}/${roleId}`);
    }
  }
  assert.deepEqual(
    checked.sort(),
    ["bmr/gossip", "snv/artist", "snv/juggler", "tb/slayer"],
    "expected to check every concrete human day action across TB/BMR/SnV"
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

function testScarletWomanTakesOverWhenDemonExecutedAtFiveAlive() {
  const state = startGame("tb", "washerwoman", 9);
  runNight(state, fixedRng());

  const imp = firstOther(state, (entry) => entry.alive);
  const scarletWoman = firstOther(state, (entry) => entry.alive && entry.id !== imp.id);
  const nominator = firstOther(state, (entry) => entry.alive && ![imp.id, scarletWoman.id].includes(entry.id));
  const extraGood = firstOther(state, (entry) => entry.alive && ![imp.id, scarletWoman.id, nominator.id].includes(entry.id));
  applyRole(state, imp, "imp");
  applyRole(state, scarletWoman, "scarlet-woman");
  applyRole(state, nominator, "chef");
  applyRole(state, extraGood, "soldier");

  const keepAlive = new Set([human(state).id, imp.id, scarletWoman.id, nominator.id, extraGood.id]);
  state.players.forEach((player) => {
    player.alive = keepAlive.has(player.id);
  });
  assert.equal(getPubliclyAlivePlayers(state).length, 5, "fixture should execute the demon from exactly five alive players");

  moveToNomination(state);
  const result = resolveNominationAndVote(
    state,
    {
      nominatorId: nominator.id,
      nomineeId: imp.id,
      humanVoteYes: true,
      decideAIVote: () => true,
    },
    fixedRng()
  );

  assert.equal(result.accepted, true, result.reason);
  assert.equal(result.passed, true);
  assert.equal(skipDay(state), true, "day end should resolve the demon execution");
  assert.equal(imp.alive, false, "the original Imp should die");
  assert.equal(scarletWoman.alive, true, "Scarlet Woman should still be alive to catch the demon");
  assert.equal(scarletWoman.roleId, "imp", "Scarlet Woman should become the new Imp at five alive");
  assert.equal(scarletWoman.category, "demon");
  assert.equal(scarletWoman.team, "evil");
  assert.equal(state.gameOver, false, "Scarlet Woman takeover should prevent an immediate good win");
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

function setupBMRAIDemonTargeting(roleId) {
  const state = startGame("bmr", "grandmother");
  runNight(state, fixedRng());
  beginNightPhase(state);

  const demon = firstOther(state, (entry) => entry.alive);
  const evilAlly = firstOther(state, (entry) => entry.alive && entry.id !== demon.id);
  const goodTargets = state.players
    .filter((entry) => !entry.isHuman && entry.alive && ![demon.id, evilAlly.id].includes(entry.id))
    .slice(0, 3);
  assert.equal(goodTargets.length, 3, "fixture needs three non-human good targets");

  applyRole(state, demon, roleId);
  applyRole(state, evilAlly, "mastermind");
  goodTargets.forEach((target) => applyRole(state, target, "gossip"));
  state.players.forEach((player) => {
    player.alive = player.isHuman || player.id === demon.id || player.id === evilAlly.id || goodTargets.some((target) => target.id === player.id);
    player.poisoned = false;
    player.poisonedTomorrowDay = false;
  });
  state.bmr.exorcisedDemonId = null;
  state.bmr.innkeeperProtectedIds = [];
  state.bmr.devilsAdvocateProtectedId = null;
  state.bmr.sailorDrunkId = null;
  state.bmr.poCharged = roleId === "po";
  return { state, demon, evilAlly, goodIds: new Set([human(state).id, ...goodTargets.map((target) => target.id)]) };
}

function testBMRAIDemonTargetsAvoidKnownEvilAllies() {
  for (const roleId of ["zombuul", "pukka", "shabaloth", "po"]) {
    const { state, demon, evilAlly, goodIds } = setupBMRAIDemonTargeting(roleId);
    const deathsBefore = state.events.nightDeaths.length;
    runNight(state, fixedRng());

    if (roleId === "pukka") {
      assert.notEqual(state.bmr.pukkaPoisonedId, evilAlly.id, "AI Pukka should not poison a known evil ally while good targets exist");
      assert.ok(goodIds.has(state.bmr.pukkaPoisonedId), "AI Pukka should poison a good target when one is available");
      continue;
    }

    const newDeaths = state.events.nightDeaths
      .slice(deathsBefore)
      .filter((entry) => entry.by === demon.id || ["demon-kill", "shabaloth-kill"].includes(entry.reason));
    assert.ok(newDeaths.length > 0, `AI ${roleId} should produce at least one night attack in the fixture`);
    assert.equal(evilAlly.alive, true, `AI ${roleId} should leave its known evil ally alive when good targets exist`);
    assert.ok(
      newDeaths.every((entry) => goodIds.has(entry.playerId)),
      `AI ${roleId} should spend automatic night attacks on good targets`
    );
  }
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
  assert.equal(getHumanNightActionState(state).available, false, "Artist should not wake as a night action");
  runNight(state, fixedRng());
  const action = getHumanDayActionState(state);
  assert.equal(action.available, true, action.reason);
  assert.equal(action.inputType, "question");
  const result = setHumanDayActionPlan(state, { question: "Is there a demon in play?" }, fixedRng());
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.resolvedImmediately, true, "Artist day question should resolve immediately");
  assert.equal(result.private, true, "Artist answer should remain private");
  /*
  const result = setHumanNightActionPlan(state, { question: "场上是否有恶魔？" });
  assert.equal(result.ok, true, result.reason);
  runNight(state, fixedRng());
  */
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
  assert.equal(state.snv.pitHagTransforms.length, 1, "Pit-Hag should record the current-night transform");
  assert.equal(state.snv.pitHagTransformHistory.length, 1, "Pit-Hag should preserve transform history for the full game");
  beginNightPhase(state);
  assert.equal(state.snv.pitHagTransforms.length, 0, "new night setup should clear only the current-night transform list");
  assert.equal(state.snv.pitHagTransformHistory.length, 1, "new night setup should preserve Pit-Hag transform history");
}

function testPitHagCreatesGoodAlignedEvilTwinPairAndBlocksNoDemonWin() {
  const state = startGame("snv", "pit-hag");
  runNight(state, fixedRng());
  beginNightPhase(state);
  const target = state.players.find((entry) => entry.id === "p4" && entry.alive && entry.team === "good" && entry.category !== "demon");
  assert.ok(target, "fixture should include a stable good Pit-Hag target");
  const planned = setHumanNightActionPlan(state, { targetIds: [target.id], roleId: "evil-twin" });
  assert.equal(planned.ok, true, planned.reason);
  runNight(state, fixedRng());

  const pair = state.snv.evilTwinPair;
  assert.equal(target.roleId, "evil-twin", "Pit-Hag should create an Evil Twin character");
  assert.equal(target.team, "good", "Pit-Hag-created Evil Twin should keep the target's original good alignment");
  assert.equal(pair?.evilTwinId, target.id, "new Evil Twin holder should own the pair");
  assert.equal(pair?.goodTwinId, target.id, "good-aligned Evil Twin holder should be the good player in the pair");
  assert.ok(pair?.opposingTwinId, "pair should record the opposing twin");
  const opposingTwin = state.players.find((entry) => entry.id === pair.opposingTwinId);
  assert.equal(opposingTwin?.team, "evil", "good-aligned Evil Twin should bind to an opposing evil player");

  state.players
    .filter((entry) => entry.alive && entry.category === "demon")
    .forEach((entry) => {
      entry.alive = false;
    });
  assert.equal(checkWin(state), null, "active living Evil Twin pair should block the ordinary no-demon good win");

  opposingTwin.alive = false;
  assert.equal(checkWin(state), "good", "once the opposing twin is dead, no living demon should give good the win");
}

function testPitHagMultiDemonQueuesStorytellerBalance() {
  const rng = withSeededRandom(1);
  const state = createNewGame({ scriptId: "snv", playerCount: 9, preferredHumanRoleId: "pit-hag" }, rng);
  runNight(state, rng);
  beginNightPhase(state);
  const target = firstOther(state, (entry) => entry.alive && entry.team === "good" && entry.category !== "demon");
  const planned = setHumanNightActionPlan(state, { targetIds: [target.id], roleId: "vortox" });
  assert.equal(planned.ok, true, planned.reason);
  runNight(state, rng);

  const action = getPendingStorytellerActionState(state);
  assert.equal(action.available, true);
  assert.equal(action.type, "pit-hag-demon-balance");
  assert.equal(state.snv.pitHagDemonBalancePending, true);
  assert.equal(state.gameOver, false, "multi-demon Pit-Hag balance should pause immediate win checks");

  const balanceTarget = action.selectedTargetIds[0] ?? action.options[0]?.id;
  assert.ok(balanceTarget, "Pit-Hag balance should suggest an extra demon to kill");
  assert.notEqual(
    balanceTarget,
    action.options[0]?.id,
    "fixture should distinguish Pit-Hag default balance target from option order"
  );
  const result = resolvePendingStorytellerAction(state, { auto: true });
  assert.equal(result.ok, true, result.reason);
  assert.equal(state.snv.pitHagDemonBalancePending, false);
  assert.ok(
    state.events.nightDeaths.some((entry) => entry.reason === "pit-hag-demon-balance" && entry.playerId === balanceTarget),
    "auto-resolving Pit-Hag balance should record the selected default demon death"
  );
}

function testPitHagBalanceRejectsResolutionLeavingMultipleDemons() {
  const rng = withSeededRandom(1);
  const state = createNewGame({ scriptId: "snv", playerCount: 9, preferredHumanRoleId: "pit-hag" }, rng);
  runNight(state, rng);
  const originalDemon = state.players.find((entry) => entry.alive && entry.category === "demon");
  const extraDemons = state.players.filter((entry) => entry.alive && !entry.isHuman && entry.category !== "demon").slice(0, 2);
  assert.ok(originalDemon, "fixture needs an original demon");
  assert.equal(extraDemons.length, 2, "fixture needs two extra demon candidates");
  applyRole(state, extraDemons[0], "vortox");
  applyRole(state, extraDemons[1], "fang-gu");
  state.snv.pitHagDemonBalancePending = true;
  state.pendingStorytellerActions = [
    {
      id: "contract-pit-hag-invalid-balance",
      type: "pit-hag-demon-balance",
      roleId: "pit-hag",
      roleName: "Pit-Hag",
      inputType: "player-target",
      balanceMode: "extra-demons",
      targetCount: 1,
      minTargetCount: 1,
      maxTargetCount: 1,
      selectedTargetIds: [extraDemons[0].id],
      options: [originalDemon, ...extraDemons].map((entry) => ({
        id: entry.id,
        label: `seat-${entry.seatIndex + 1}`,
        alive: true,
        team: entry.team,
        category: entry.category,
      })),
      prompt: "Pit-Hag demon balance.",
    },
  ];

  const result = resolvePendingStorytellerAction(state, { auto: true });

  assert.equal(result.ok, false, "Pit-Hag balance should reject a choice that leaves multiple demons alive");
  assert.equal(state.snv.pitHagDemonBalancePending, true, "invalid balance must keep the Storyteller gate pending");
  assert.equal(state.pendingStorytellerActions.length, 1, "invalid balance must not clear the Storyteller queue");
  assert.equal(extraDemons[0].alive, true, "invalid balance must not kill a selected target");
  assert.equal(extraDemons[1].alive, true, "invalid balance must not alter unselected demons");
}

function testPitHagNoDemonDefersGoodWinUntilStorytellerConfirmation() {
  const state = startGame("snv", "pit-hag");
  runNight(state, fixedRng());
  beginNightPhase(state);
  const demon = state.players.find((entry) => entry.alive && entry.category === "demon");
  assert.ok(demon, "expected an original demon");
  const planned = setHumanNightActionPlan(state, { targetIds: [demon.id], roleId: "artist" });
  assert.equal(planned.ok, true, planned.reason);
  const nightResult = runNight(state, fixedRng());
  assert.equal(nightResult?.stage, "storyteller", "runNight should report Pit-Hag balance as a Storyteller stop");

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
  assert.equal(state.humanDayPlan ?? null, null, "public Juggler guesses should not linger as a private pending day plan");
  assert.ok(result.resolvedImmediately, "Juggler guesses should resolve as an immediate public day action");
  assert.ok(result.public, "Juggler guesses should be marked public");
  assert.ok(result.speechId, "Juggler guesses should expose a public speech id");
  assert.equal(state.snv.jugglerGuessesByDay[human(state).id].sourceSpeechId, result.speechId);
  assert.ok(
    state.events.speeches.some((entry) => entry.publicAbility && entry.abilityRoleId === "juggler" && entry.abilityKind === "juggler-guesses"),
    "Juggler guesses should be recorded as a public ability speech"
  );
  assert.ok(
    state.aiDialogue.timeline.some((entry) => entry.intent === "public-ability" && entry.abilityRoleId === "juggler"),
    "Juggler guesses should be visible in the public AI timeline"
  );
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

function testProfessorCanWaitWithoutSpendingRevive() {
  const state = startGame("bmr", "professor");
  runNight(state, fixedRng());
  beginNightPhase(state);
  const deadOutsider = firstOther(state, (entry) => entry.category === "outsider");
  const deadTownsfolk = firstOther(state, (entry) => entry.category === "townsfolk");
  state.players
    .filter((entry) => entry.category === "townsfolk" && !entry.isHuman)
    .forEach((entry) => {
      entry.alive = true;
    });
  deadOutsider.alive = false;
  state.players
    .filter((entry) => entry.category === "demon")
    .forEach((entry) => {
      entry.poisoned = true;
    });

  const waitAction = getHumanNightActionState(state);
  assert.equal(waitAction.available, true, waitAction.reason);
  assert.equal(waitAction.optional, true, "Professor should expose an optional wait mode");
  const waitPlan = setHumanNightActionPlan(state, { mode: "skip" });
  assert.equal(waitPlan.ok, true, waitPlan.reason);
  runNight(state, fixedRng());
  assert.equal(
    state.bmr.professorUsedByIds.includes(human(state).id),
    false,
    "waiting should not spend the once-per-game Professor revive"
  );
  assert.equal(deadOutsider.alive, false, "waiting should not revive a non-Townsfolk target by fallback");
  assert.equal(
    state.logs.some((entry) => entry.message === "Professor 尝试复活一名死者，但没有成功。"),
    false,
    "waiting should not record a failed revive attempt"
  );

  beginNightPhase(state);
  deadTownsfolk.alive = false;
  const revivePlan = setHumanNightActionPlan(state, { targetIds: [deadTownsfolk.id] });
  assert.equal(revivePlan.ok, true, revivePlan.reason);
  runNight(state, fixedRng());
  assert.equal(deadTownsfolk.alive, true, "Professor should still revive a later dead Townsfolk after waiting");
  assert.equal(state.bmr.professorUsedByIds.includes(human(state).id), true);
}

function testOneShotNightActionsCanWaitWithoutSpendingAbility() {
  const suppressDemons = (state) => {
    state.players
      .filter((entry) => entry.category === "demon")
      .forEach((entry) => {
        entry.poisoned = true;
      });
  };

  const courtierState = startGame("bmr", "courtier");
  runNight(courtierState, fixedRng());
  beginNightPhase(courtierState);
  suppressDemons(courtierState);
  const courtierWaitAction = getHumanNightActionState(courtierState);
  assert.equal(courtierWaitAction.optional, true, "Courtier should expose an optional wait mode");
  assert.equal(setHumanNightActionPlan(courtierState, { mode: "skip" }).ok, true);
  runNight(courtierState, fixedRng());
  assert.equal(courtierState.bmr.courtierUsedByIds.includes(human(courtierState).id), false);
  assert.equal(Object.keys(courtierState.bmr.suppressedByRoleId).length, 0, "waiting Courtier should not suppress a fallback role");
  beginNightPhase(courtierState);
  suppressDemons(courtierState);
  assert.equal(getHumanNightActionState(courtierState).available, true, "Courtier should be available on a later night after waiting");
  assert.equal(setHumanNightActionPlan(courtierState, { roleId: "po" }).ok, true);
  runNight(courtierState, fixedRng());
  assert.equal(courtierState.bmr.courtierUsedByIds.includes(human(courtierState).id), true);
  assert.ok(Number(courtierState.bmr.suppressedByRoleId.po ?? 0) >= courtierState.night);

  const assassinState = startGame("bmr", "assassin");
  runNight(assassinState, fixedRng());
  beginNightPhase(assassinState);
  suppressDemons(assassinState);
  const assassinWaitAction = getHumanNightActionState(assassinState);
  assert.equal(assassinWaitAction.optional, true, "Assassin should expose an optional wait mode");
  assert.equal(setHumanNightActionPlan(assassinState, { mode: "skip" }).ok, true);
  runNight(assassinState, fixedRng());
  assert.equal(assassinState.bmr.assassinUsedByIds.includes(human(assassinState).id), false);
  assert.equal(assassinState.events.nightDeaths.some((entry) => entry.reason === "assassin-kill"), false);
  beginNightPhase(assassinState);
  suppressDemons(assassinState);
  const assassinTarget = firstOther(assassinState, (entry) => entry.alive && entry.category !== "demon");
  assert.equal(setHumanNightActionPlan(assassinState, { targetIds: [assassinTarget.id] }).ok, true);
  runNight(assassinState, fixedRng());
  assert.equal(assassinState.bmr.assassinUsedByIds.includes(human(assassinState).id), true);
  assert.ok(assassinState.events.nightDeaths.some((entry) => entry.reason === "assassin-kill" && entry.playerId === assassinTarget.id));

  const seamstressState = startGame("snv", "seamstress");
  beginNightPhase(seamstressState);
  suppressDemons(seamstressState);
  const seamstressWaitAction = getHumanNightActionState(seamstressState);
  assert.equal(seamstressWaitAction.optional, true, "Seamstress should expose an optional wait mode");
  assert.equal(setHumanNightActionPlan(seamstressState, { mode: "skip" }).ok, true);
  runNight(seamstressState, fixedRng());
  assert.equal(seamstressState.snv.seamstressUsedByIds.includes(human(seamstressState).id), false);
  assert.equal(
    seamstressState.events.infoPings.some((entry) => entry.actorId === human(seamstressState).id),
    false,
    "waiting Seamstress should not receive fallback random information"
  );
  beginNightPhase(seamstressState);
  suppressDemons(seamstressState);
  const seamstressTargets = seamstressState.players
    .filter((entry) => !entry.isHuman && entry.alive)
    .slice(0, 2)
    .map((entry) => entry.id);
  assert.equal(setHumanNightActionPlan(seamstressState, { targetIds: seamstressTargets }).ok, true);
  runNight(seamstressState, fixedRng());
  assert.equal(seamstressState.snv.seamstressUsedByIds.includes(human(seamstressState).id), true);
  assert.ok(
    seamstressState.events.infoPings.some((entry) => entry.actorId === human(seamstressState).id && (entry.targetIds ?? []).length === 2)
  );

  const philosopherState = startGame("snv", "philosopher");
  beginNightPhase(philosopherState);
  suppressDemons(philosopherState);
  const philosopherWaitAction = getHumanNightActionState(philosopherState);
  assert.equal(philosopherWaitAction.optional, true, "Philosopher should expose an optional wait mode");
  assert.equal(setHumanNightActionPlan(philosopherState, { mode: "skip" }).ok, true);
  runNight(philosopherState, fixedRng());
  assert.equal(philosopherState.snv.philosopherUsedByIds.includes(human(philosopherState).id), false);
  assert.equal(getEffectiveRoleId(human(philosopherState)), "philosopher");
  beginNightPhase(philosopherState);
  suppressDemons(philosopherState);
  assert.equal(setHumanNightActionPlan(philosopherState, { roleId: "dreamer" }).ok, true);
  runNight(philosopherState, fixedRng());
  assert.equal(philosopherState.snv.philosopherUsedByIds.includes(human(philosopherState).id), true);
  assert.equal(getEffectiveRoleId(human(philosopherState)), "dreamer");
}

function testSailorExecutionIsRecordedButDoesNotKill() {
  const state = startGame("bmr", "sailor");
  runNight(state, fixedRng());
  human(state).poisoned = false;
  human(state).poisonedTomorrowDay = false;
  state.bmr.sailorDrunkIds = state.bmr.sailorDrunkIds.filter((playerId) => playerId !== human(state).id);
  if (state.bmr.innkeeperDrunkId === human(state).id) {
    state.bmr.innkeeperDrunkId = null;
  }
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
  assert.equal(result.onBlock, true, "passed vote should put Sailor on the block");
  assert.equal(
    state.events.executions.some((entry) => entry.nomineeId === human(state).id),
    false,
    "ordinary vote should not record an execution before day end"
  );
  assert.equal(skipDay(state), true, "day end should resolve the Sailor execution");
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

function testPukkaPoisonedSailorCannotUseDeathProtectionAcrossPhaseFlags() {
  const state = startGame("bmr", "sailor");
  runNight(state, fixedRng());
  const sailor = human(state);

  sailor.poisoned = false;
  sailor.poisonedTomorrowDay = false;
  state.bmr.pukkaPoisonedId = sailor.id;

  const died = processDayDeath(state, sailor, "contract-pukka-poisoned-sailor", {}, fixedRng());
  assert.equal(died, true, "Pukka-poisoned Sailor should not prevent day death when the transient poisoned flag is false");
  assert.equal(sailor.alive, false, "Pukka-poisoned Sailor should be dead after the public day death");
  assert.equal(
    state.events.dayDeaths.some((entry) => entry.reason === "contract-pukka-poisoned-sailor" && entry.playerId === sailor.id),
    true,
    "Pukka-poisoned Sailor death should be recorded as an actual day death"
  );
}

function testBMRDrunkStateIdsBlockSailorProtectionAcrossPhaseFlags() {
  [
    { field: "sailorDrunkIds", label: "Sailor drunkenness", assign: (state, playerId) => (state.bmr.sailorDrunkIds = [playerId]) },
    { field: "innkeeperDrunkId", label: "Innkeeper drunkenness", assign: (state, playerId) => (state.bmr.innkeeperDrunkId = playerId) },
  ].forEach(({ label, assign }) => {
    const state = startGame("bmr", "sailor");
    runNight(state, fixedRng());
    const sailor = human(state);

    sailor.poisoned = false;
    sailor.poisonedTomorrowDay = false;
    assign(state, sailor.id);

    const died = processDayDeath(state, sailor, `contract-${label.toLowerCase().replaceAll(" ", "-")}`, {}, fixedRng());
    assert.equal(died, true, `${label} should block Sailor death protection when the transient poisoned flag is false`);
    assert.equal(sailor.alive, false, `${label} should let the Sailor die from public day death`);
  });
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
  assert.equal(result.onBlock, true, "passed vote should put the target on the block before protection resolves");
  assert.equal(skipDay(state), true, "day end should resolve the protected execution");
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
  assert.equal(result.onBlock, true, "passed vote should put the target on the block before Pacifist resolves");
  assert.equal(skipDay(state, () => 0), true, "day end should resolve the Pacifist execution save");
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
  applyRole(state, target, "chambermaid");
  state.bmr.innkeeperProtectedIds = [target.id];

  const died = processNightDeath(state, target, "demon-kill", {}, fixedRng());

  assert.equal(died, false, "Innkeeper protected target should not die to Demon night death");
  assert.equal(target.alive, true);
}

function testInnkeeperProtectionDoesNotBlockNonDemonNightDeath() {
  const state = startGame("bmr", "innkeeper");
  const target = firstOther(state, (entry) => entry.alive);
  applyRole(state, target, "chambermaid");
  state.bmr.innkeeperProtectedIds = [target.id];

  const died = processNightDeath(state, target, "gambler-fail", {}, fixedRng());

  assert.equal(died, true, "Innkeeper protection should not block non-Demon night deaths such as Gambler failure");
  assert.equal(target.alive, false);
  assert.ok(
    state.events.nightDeaths.some((entry) => entry.reason === "gambler-fail" && entry.playerId === target.id),
    "the non-Demon night death should be recorded"
  );
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
  assert.equal(state.gameOver, false, "Mastermind extra day should wait for day-end execution resolution");
  assert.equal(skipDay(state), true);
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

function testZombuulWakesAfterPreventedExecutionDeath() {
  const state = startGame("bmr", "zombuul");
  runNight(state, fixedRng());
  neutralizeBMRExecutionSaves(state);
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
    fixedRng()
  );

  assert.equal(result.accepted, true, result.reason);
  assert.equal(result.onBlock, true, "passed vote should put the protected target on the block before day end");
  assert.equal(skipDay(state), true, "day end should resolve the protected execution");
  assert.equal(target.alive, true, "protected execution should not create a death today");
  assert.ok(
    state.events.executions.some((entry) => entry.day === state.day && entry.nomineeId === target.id && entry.died === false),
    "protected execution should be recorded without a death"
  );

  beginNightPhase(state);

  const action = getHumanNightActionState(state);
  assert.equal(action.available, true, action.reason);
  assert.equal(action.roleId, "zombuul");
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

function testPoisonedZombuulFirstDeathDoesNotRegisterDead() {
  const state = startGame("bmr", "zombuul");
  beginNightPhase(state);
  const zombuul = human(state);
  zombuul.poisoned = true;

  const died = processNightDeath(state, zombuul, "contract-poisoned-zombuul-first-death", {}, fixedRng());

  assert.equal(died, true, "poisoned Zombuul should not survive the first death");
  assert.equal(zombuul.alive, false, "poisoned Zombuul should actually die");
  assert.equal(state.bmr.zombuulHiddenDead, false, "blocked Zombuul ability should not create hidden-dead state");
  assert.equal(state.bmr.zombuulHiddenDeadPlayerId, null);
  assert.equal(checkWin(state), "good", "killing the only demon while Zombuul is poisoned should give good the win");
  assert.equal(state.gameOver, true, "killing the only demon while Zombuul is poisoned should end the game");
  assert.equal(state.winner, "good");
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
  const demon = state.players.find((entry) => entry.category === "demon");
  assert.ok(demon, "fixture should include a demon");
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
  applyRole(state, demon, "vortox");
  const target = firstOther(state, (entry) => entry.alive && entry.id !== demon.id);
  applyRole(state, target, "witch");
  neutralizeSnvNightRoleChangers(state, [target.id]);
  beginNightPhase(state);

  const planned = setHumanNightActionPlan(state, { targetIds: [target.id] });
  assert.equal(planned.ok, true, planned.reason);
  runNight(state, fixedRng());

  const ping = state.events.infoPings.find((entry) => entry.actorId === human(state).id && entry.type === "dreamer");
  assert.ok(ping, "Dreamer should receive info");
  assert.equal(ping.polluted, true);
  assert.equal(`${ping.reported}`.includes(target.roleName), false, "Vortox Dreamer info must not include the true role");
}

function testPoisonedVortoxDoesNotForceDreamerFalseInfo() {
  const state = startGame("snv", "dreamer");
  const demon = state.players.find((entry) => entry.category === "demon");
  assert.ok(demon, "expected a demon");
  applyRole(state, demon, "vortox");
  const target = firstOther(state, (entry) => entry.alive && entry.id !== demon.id);
  applyRole(state, target, "witch");
  neutralizeSnvNightRoleChangers(state, [target.id]);
  beginNightPhase(state);
  demon.poisoned = true;

  const planned = setHumanNightActionPlan(state, { targetIds: [target.id] });
  assert.equal(planned.ok, true, planned.reason);
  runNight(state, fixedRng());

  const ping = state.events.infoPings.find((entry) => entry.actorId === human(state).id && entry.type === "dreamer");
  assert.ok(ping, "Dreamer should receive info");
  assert.equal(ping.polluted, false, "blocked Vortox should not pollute townsfolk information");
  assert.equal(`${ping.reported}`.includes(target.roleName), true, "inactive Vortox Dreamer info should include the true role");
}

function testVortoxSavantAbnormalityCountsForMathematician() {
  const state = startGame("snv", "mathematician");
  const demon = state.players.find((entry) => entry.category === "demon");
  const savant = firstOther(state, (entry) => entry.alive && entry.team === "good");
  assert.ok(demon, "expected a demon");
  applyRole(state, demon, "vortox");
  applyRole(state, savant, "savant");
  neutralizeSnvNightRoleChangers(state, [savant.id]);

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

function testPoisonedVortoxDoesNotForceSavantAllFalseInfo() {
  const state = startGame("snv", "mathematician");
  const demon = state.players.find((entry) => entry.category === "demon");
  const savant = firstOther(state, (entry) => entry.alive && entry.team === "good");
  assert.ok(demon, "expected a demon");
  applyRole(state, demon, "vortox");
  applyRole(state, savant, "savant");
  neutralizeSnvNightRoleChangers(state, [savant.id]);
  demon.poisonedTomorrowDay = true;

  runNight(state, fixedRng());

  const ping = state.events.infoPings.find((entry) => entry.actorId === savant.id && entry.type === "savant");
  assert.ok(ping, "Savant should receive daytime information");
  assert.equal(ping.polluted, false, "blocked Vortox should not pollute Savant information");
  assert.equal(ping.abnormal, false, "inactive Vortox should keep Savant at one-true/one-false information");
  assert.equal(ping.truth.includes(true), true, "Savant should keep one true statement while Vortox is inactive");
  assert.equal(ping.truth.includes(false), true, "Savant should keep one false statement while Vortox is inactive");
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

function testAINightKilledBarberSwapsSameNight() {
  const state = startGame("snv", "barber");
  runNight(state, fixedRng());

  const barber = human(state);
  const demon = state.players.find((entry) => entry.category === "demon");
  assert.ok(demon, "fixture should include an AI demon");
  applyRole(state, demon, "vortox");
  neutralizeSnvNightRoleChangers(state, [barber.id, demon.id]);
  const fillerRoles = ["clockmaker", "dreamer", "snake-charmer", "mathematician", "flowergirl", "town-crier", "oracle"];
  state.players
    .filter((entry) => !entry.isHuman && entry.category !== "demon")
    .forEach((entry, index) => {
      applyRole(state, entry, fillerRoles[index % fillerRoles.length]);
      entry.team = "evil";
      entry.apparentTeam = "evil";
    });
  barber.team = "good";
  barber.threatScore = 1;

  beginNightPhase(state);
  const beforeRoles = new Map(state.players.map((entry) => [entry.id, entry.roleId]));
  runNight(state, fixedRng());

  assert.equal(barber.alive, false, "AI demon should kill the Barber fixture at night");
  assert.equal(state.snv.barberDiedToday, false, "night-killed Barber should not leave a stale next-night swap flag");
  assert.equal(state.pendingStorytellerActions.length, 0, "AI demon Barber swap should not require a human Storyteller action");
  const swapLog = state.logs.find((entry) => entry.type === "night-effect" && entry.payload?.demonId === demon.id && entry.payload?.a && entry.payload?.b);
  assert.ok(swapLog, "AI demon should perform the Barber swap on the same night as Barber's death");
  const swappedIds = [swapLog.payload.a, swapLog.payload.b];
  swappedIds.forEach((playerId) => {
    const player = getPlayerById(state, playerId);
    assert.notEqual(player?.roleId, beforeRoles.get(playerId), "Barber swap should change each selected player's role");
  });
}

function testWitchCurseKillsNominatorWithoutBlockingNomination() {
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

  assert.equal(cursedResult.accepted, true, cursedResult.reason);
  assert.equal(cursedResult.passed, false, "fixture vote should fail without yes votes");
  assert.equal(cursedNominator.alive, false, "cursed nominator should die");
  assert.equal(cursedNominator.nominatedToday, true, "Witch-triggering nomination should still spend the nominator's nomination");
  assert.equal(cursedNominee.beenNominatedToday, true, "Witch-triggering nomination should still put the nominee through nomination");
  assert.ok(
    state.events.dayDeaths.some((entry) => entry.reason === "witch-curse" && entry.playerId === cursedNominator.id),
    "Witch curse should be recorded as a day death"
  );
  assert.equal(
    state.events.executions.some((entry) => entry.reason === "witch-curse" || entry.nomineeId === cursedNominator.id),
    false,
    "Witch curse should not consume the day's execution"
  );
  assert.ok(
    state.events.votes.some((entry) => entry.nomineeId === cursedNominee.id),
    "Witch-triggering nomination should continue into the vote record"
  );

  const secondNominee = firstOther(state, (entry) => entry.alive && entry.id !== cursedNominee.id);
  const secondNominator = firstOther(state, (entry) => entry.alive && entry.id !== secondNominee.id && !entry.nominatedToday);
  const secondResult = resolveNominationAndVote(
    state,
    {
      nominatorId: secondNominator.id,
      nomineeId: secondNominee.id,
      humanVoteYes: true,
      decideAIVote: () => true,
    },
    fixedRng()
  );
  assert.equal(secondResult.accepted, true, secondResult.reason);
}

function testWitchCurseTriggersWhenDebateStartsAndVoteStillResolves() {
  const state = startGame("snv", "witch");
  runNight(state, fixedRng());
  moveToNomination(state);

  const cursedNominator = firstOther(state, (entry) => entry.alive && entry.team === "good");
  const cursedNominee = firstOther(state, (entry) => entry.alive && entry.id !== cursedNominator.id);
  state.snv.witchCurses[cursedNominator.id] = state.day;

  const debate = createNominationDebate(
    state,
    {
      nominatorId: cursedNominator.id,
      nomineeId: cursedNominee.id,
      reason: "contract Witch debate timing",
      source: "contract",
    },
    fixedRng()
  );

  assert.equal(debate.ok, true, debate.reason);
  assert.equal(debate.debate?.active, true, "Witch curse should not skip the nomination debate");
  assert.equal(debate.debate?.nominationAccepted, true, "debate should remember the nomination was already accepted");
  assert.equal(cursedNominator.alive, false, "Witch curse should kill as soon as the nomination is made");
  assert.equal(cursedNominator.nominatedToday, true, "Witch-triggering nomination should spend the nomination before debate");
  assert.equal(cursedNominee.beenNominatedToday, true, "Witch-triggering nomination should mark the nominee before debate");
  assert.equal(state.events.votes.length, 0, "pre-vote debate should not record a vote yet");
  assert.equal(
    state.events.dayDeaths.filter((entry) => entry.reason === "witch-curse" && entry.playerId === cursedNominator.id).length,
    1,
    "Witch curse should be recorded exactly once when debate starts"
  );

  const vote = resolveNominationAndVote(
    state,
    {
      nominatorId: debate.debate.nominatorId,
      nomineeId: debate.debate.nomineeId,
      humanVoteYes: false,
      decideAIVote: () => false,
      nominationAlreadyAccepted: true,
    },
    fixedRng()
  );
  assert.equal(vote.accepted, true, vote.reason);
  assert.equal(vote.passed, false);
  assert.equal(state.events.votes.length, 1, "accepted debate nomination should still proceed to a vote");
  assert.equal(
    state.events.dayDeaths.filter((entry) => entry.reason === "witch-curse" && entry.playerId === cursedNominator.id).length,
    1,
    "resolving the vote should not trigger Witch a second time"
  );
}

function testWitchCurseGameEndStopsVoteCeremony() {
  const state = startGame("snv", "witch");
  runNight(state, fixedRng());
  moveToNomination(state);

  const demon = firstOther(state, (entry) => entry.alive && entry.category === "demon");
  const cursedNominator = firstOther(state, (entry) => entry.alive && entry.team === "good");
  const witch = human(state);
  state.players.forEach((entry) => {
    entry.alive = [witch.id, demon.id, cursedNominator.id].includes(entry.id);
  });
  state.snv.witchCurses[cursedNominator.id] = state.day;

  const result = resolveNominationAndVote(
    state,
    {
      nominatorId: cursedNominator.id,
      nomineeId: demon.id,
      humanVoteYes: true,
      decideAIVote: () => true,
    },
    fixedRng()
  );

  assert.equal(result.accepted, true, result.reason);
  assert.equal(result.special, "nomination-trigger-game-over");
  assert.equal(state.gameOver, true, "Witch curse death in final three should immediately end the game");
  assert.equal(state.winner, "evil");
  assert.equal(cursedNominator.alive, false);
  assert.equal(cursedNominator.nominatedToday, true, "game-ending Witch nomination should still spend the nomination");
  assert.equal(demon.beenNominatedToday, true, "game-ending Witch nomination should still mark the nominee");
  assert.equal(
    state.events.votes.some((entry) => entry.day === state.day && entry.nomineeId === demon.id),
    false,
    "no vote ceremony should be recorded after a nomination trigger has already ended the game"
  );
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

function testPoisonedVortoxNoExecutionDoesNotTriggerEvilWin() {
  const state = startGame("snv", "clockmaker");
  runNight(state, fixedRng());
  const vortox = state.players.find((entry) => entry.alive && entry.category === "demon");
  assert.ok(vortox, "fixture should include a living demon to become Vortox");
  applyRole(state, vortox, "vortox");
  vortox.poisoned = true;
  moveToNomination(state);

  assert.equal(skipDay(state), true);
  assert.equal(state.gameOver, false, "a poisoned Vortox should not turn no-execution into an evil win");
  assert.equal(state.winner, null);
}

function testEvilTwinPairBlocksGoodWinWhileBothTwinsLive() {
  const state = startGame("snv", "evil-twin");
  const pair = state.snv.evilTwinPair;
  assert.ok(pair?.evilTwinId, "fixture should create an evil twin pair");
  assert.ok(pair?.goodTwinId, "fixture should create a good twin pair");

  const demon = firstOther(state, (entry) => entry.category === "demon");
  demon.alive = false;

  assert.equal(checkWin(state), null, "living Evil Twin pair should block the ordinary no-demon good win");
  assert.equal(state.gameOver, false, "game should continue while both twins live");

  const goodTwin = state.players.find((entry) => entry.id === pair.goodTwinId);
  assert.ok(goodTwin, "fixture should keep the good twin");
  goodTwin.alive = false;

  assert.equal(checkWin(state), "good", "after the pair is broken, no living demon should give good the win");
  assert.equal(state.gameOver, true);
  assert.equal(state.winner, "good");
}

function testEvilTwinExecutionDoesNotAutoWinWhileDemonLives() {
  const state = startGame("snv", "evil-twin");
  runNight(state, fixedRng());
  moveToNomination(state);

  const demon = firstOther(state, (entry) => entry.alive && entry.category === "demon");
  assert.ok(demon, "fixture should keep a living demon");
  executeHumanPlayer(state);

  assert.equal(human(state).roleId, "evil-twin", "fixture should execute the human Evil Twin");
  assert.equal(human(state).alive, false);
  assert.equal(demon.alive, true, "demon should still be alive after the Evil Twin execution");
  assert.equal(state.gameOver, false, "executing the Evil Twin should only remove the twin lock, not auto-win while demon lives");
}

function testGoodTwinExecutionGivesEvilWin() {
  const state = startGame("snv", "evil-twin");
  runNight(state, fixedRng());
  moveToNomination(state);

  const pair = state.snv.evilTwinPair;
  const goodTwin = state.players.find((entry) => entry.id === pair.goodTwinId);
  assert.ok(goodTwin?.alive, "fixture should keep the Good Twin alive before execution");
  const result = resolveNominationAndVote(
    state,
    {
      nominatorId: human(state).id,
      nomineeId: goodTwin.id,
      humanVoteYes: true,
      decideAIVote: () => true,
    },
    fixedRng()
  );

  assert.equal(result.accepted, true, result.reason);
  assert.equal(result.passed, true);
  assert.equal(skipDay(state), true, "day end should resolve the Good Twin execution");
  assert.equal(goodTwin.alive, false);
  assert.equal(state.gameOver, true, "executing the Good Twin should immediately end the game");
  assert.equal(state.winner, "evil");
}

function testSnVEndOfDayPenaltiesStopAfterGameOver() {
  const state = startGame("snv", "evil-twin");
  runNight(state, fixedRng());
  moveToNomination(state);

  const pair = state.snv.evilTwinPair;
  const goodTwin = state.players.find((entry) => entry.id === pair.goodTwinId);
  const mutant = firstOther(
    state,
    (entry) => entry.alive && entry.team === "good" && entry.id !== goodTwin?.id && entry.id !== pair.evilTwinId
  );
  assert.ok(goodTwin?.alive, "fixture should keep the Good Twin alive before day-end penalties");
  goodTwin.poisoned = false;
  applyRole(state, mutant, "mutant");
  mutant.publicClaimRoleId = "klutz";
  state.snv.cerenovusForcedByPlayerId = { [goodTwin.id]: "artist" };
  state.snv.cerenovusEnforceDayByPlayerId = { [goodTwin.id]: state.day };

  const result = endDayAndBeginNight(state, () => 0.1);

  assert.equal(result.stage, "ended");
  assert.equal(state.gameOver, true);
  assert.equal(state.winner, "evil", "Cerenovus execution of the Good Twin should end the game");
  assert.equal(goodTwin.alive, false);
  assert.equal(mutant.alive, true, "later end-of-day penalties must not mutate state after game over");
  assert.equal(
    state.events.executions.filter((entry) => entry.reason === "mutant-claim-break").length,
    0,
    "Mutant punishment should not be applied after the game-ending Good Twin execution"
  );
}

function testSweetheartDrunkIdBlocksMutantClaimPenaltyAcrossPhaseFlags() {
  const state = startGame("snv", "mutant");
  runNight(state, fixedRng());
  const mutant = human(state);
  assert.equal(mutant.roleId, "mutant", "fixture should put Mutant on the human player");

  mutant.poisoned = false;
  mutant.poisonedTomorrowDay = false;
  state.snv.sweetheartDrunkId = mutant.id;

  assert.equal(
    withMockedMathRandom(0.1, () => registerClaim(state, mutant.id, "klutz")),
    true,
    "Mutant fixture should be able to register an Outsider claim"
  );
  assert.equal(mutant.alive, true, "Sweetheart-drunk Mutant should not be executed for an Outsider claim");
  assert.equal(
    state.events.executions.filter((entry) => entry.reason === "mutant-claim-break").length,
    0,
    "Sweetheart drunk state should block Mutant punishment even if the transient poisoned flag is false"
  );
}

function testSnVPersistentPoisonIdsBlockMutantClaimPenaltyAcrossPhaseFlags() {
  [
    { field: "vigormortisPoisonedIds", label: "Vigormortis" },
    { field: "noDashiiPoisonedIds", label: "No Dashii" },
  ].forEach(({ field, label }) => {
    const state = startGame("snv", "mutant");
    runNight(state, fixedRng());
    const mutant = human(state);
    assert.equal(mutant.roleId, "mutant", `${label} fixture should put Mutant on the human player`);

    mutant.poisoned = false;
    mutant.poisonedTomorrowDay = false;
    state.snv[field] = [mutant.id];

    assert.equal(
      withMockedMathRandom(0.1, () => registerClaim(state, mutant.id, "klutz")),
      true,
      `${label} poisoned Mutant fixture should be able to register an Outsider claim`
    );
    assert.equal(mutant.alive, true, `${label} poisoned Mutant should not be executed for an Outsider claim`);
    assert.equal(
      state.events.executions.filter((entry) => entry.reason === "mutant-claim-break").length,
      0,
      `${label} persistent poison state should block Mutant punishment even if the transient poisoned flag is false`
    );
  });
}

function testInactiveEvilTwinPairDoesNotBlockGoodWin() {
  const changedState = startGame("snv", "evil-twin");
  const changedPair = changedState.snv.evilTwinPair;
  const changedDemon = firstOther(changedState, (entry) => entry.category === "demon");
  const changedEvilTwin = changedState.players.find((entry) => entry.id === changedPair.evilTwinId);
  changedDemon.alive = false;

  assert.equal(checkWin(changedState), null, "active living twins should initially block the no-demon good win");
  applyRole(changedState, changedEvilTwin, "witch");
  assert.equal(checkWin(changedState), "good", "former Evil Twin should not keep blocking good win after a role change");

  const poisonedState = startGame("snv", "evil-twin");
  const poisonedPair = poisonedState.snv.evilTwinPair;
  const poisonedDemon = firstOther(poisonedState, (entry) => entry.category === "demon");
  const poisonedEvilTwin = poisonedState.players.find((entry) => entry.id === poisonedPair.evilTwinId);
  poisonedDemon.alive = false;
  poisonedEvilTwin.poisoned = true;

  assert.equal(checkWin(poisonedState), "good", "poisoned Evil Twin should not keep the good-win block active");
}

function testEvilTwinDoesNotRetargetAfterOpposingTwinDiesOnRoleChange() {
  const state = startGame("snv", "evil-twin");
  const pair = state.snv.evilTwinPair;
  assert.ok(pair?.evilTwinId, "fixture should create an Evil Twin holder");
  assert.ok(pair?.opposingTwinId, "fixture should create an opposing twin");

  const opposingTwin = state.players.find((entry) => entry.id === pair.opposingTwinId);
  const replacementCandidate = state.players.find(
    (entry) => entry.alive && entry.team === opposingTwin?.team && entry.id !== opposingTwin?.id
  );
  const unrelatedChangedPlayer = state.players.find(
    (entry) =>
      entry.alive &&
      entry.category !== "demon" &&
      entry.id !== pair.evilTwinId &&
      entry.id !== pair.opposingTwinId &&
      entry.id !== replacementCandidate?.id
  );
  assert.ok(replacementCandidate, "fixture should have a living same-team candidate that old logic might retarget");
  assert.ok(unrelatedChangedPlayer, "fixture should have an unrelated role-change target");
  opposingTwin.alive = false;
  applyRole(state, unrelatedChangedPlayer, "artist");

  syncSnvRoleChangeForContract(state, [unrelatedChangedPlayer.id]);

  assert.equal(
    state.snv.evilTwinPair.opposingTwinId,
    opposingTwin.id,
    "same Evil Twin holder must not receive a new opposing twin after the original opposing twin dies"
  );
  assert.equal(
    state.snv.evilTwinPair.goodTwinId,
    pair.goodTwinId,
    "same Evil Twin holder should preserve the original good twin id instead of retargeting"
  );

  const demon = state.players.find((entry) => entry.category === "demon");
  assert.ok(demon, "fixture should include a demon");
  demon.alive = false;
  assert.equal(checkWin(state), "good", "dead opposing twin should leave the no-demon good win unblocked");
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

function testHumanMoonchildNightDeathChoiceKillsGoodTargetImmediately() {
  const state = startGame("bmr", "moonchild");
  neutralizeBMRExecutionSaves(state);
  beginNightPhase(state);
  const moonchild = human(state);
  const target = firstOther(state, (entry) => entry.alive && entry.team === "good");

  const died = processNightDeath(state, moonchild, "contract-moonchild-night-death", {}, fixedRng());
  assert.equal(died, true, "human Moonchild should die in the night fixture");
  const action = getPendingStorytellerActionState(state);
  assert.equal(action.available, true);
  assert.equal(action.type, "moonchild-choice");

  const result = resolvePendingStorytellerAction(state, { targetIds: [target.id] });

  assert.equal(result.ok, true, result.reason);
  assert.equal(target.alive, false, "Moonchild's night-death choice should kill a good target in the same night");
  assert.equal(state.bmr.moonchildPendingById[moonchild.id], undefined, "night-death Moonchild should not defer the target to next night");
  assert.ok(
    state.events.nightDeaths.some((entry) => entry.reason === "moonchild-trigger" && entry.playerId === target.id),
    "immediate Moonchild target death should be recorded as a night death"
  );
}

function testAIMoonchildNightDeathChoiceKillsGoodTargetImmediately() {
  const state = startGame("bmr", "gambler");
  neutralizeBMRExecutionSaves(state);
  beginNightPhase(state);
  const moonchild = firstOther(state, (entry) => entry.alive && entry.team === "good");
  applyRole(state, moonchild, "moonchild");
  state.players
    .filter((entry) => entry.alive && entry.id !== moonchild.id)
    .forEach((entry) => applyRole(state, entry, "chambermaid"));

  const died = processNightDeath(state, moonchild, "contract-ai-moonchild-night-death", {}, fixedRng());

  assert.equal(died, true, "AI Moonchild should die in the night fixture");
  assert.equal(state.bmr.moonchildPendingById[moonchild.id], undefined, "AI Moonchild night death should not be deferred");
  assert.ok(
    state.events.nightDeaths.some((entry) => entry.reason === "moonchild-trigger" && entry.by === moonchild.id),
    "AI Moonchild should immediately create a same-night target death"
  );
}

function testRunNightStopsForExecutionStorytellerQueue() {
  const state = startGame("bmr", "moonchild");
  runNight(state, fixedRng());
  neutralizeBMRExecutionSaves(state);
  moveToNomination(state);

  const nominator = firstOther(state, (entry) => entry.alive);
  const vote = resolveNominationAndVote(
    state,
    {
      nominatorId: nominator.id,
      nomineeId: human(state).id,
      humanVoteYes: true,
      decideAIVote: () => true,
    },
    fixedRng()
  );
  assert.equal(vote.accepted, true, vote.reason);
  assert.equal(vote.passed, true);
  assert.equal(vote.onBlock, true);

  const paused = runNight(state, fixedRng());
  assert.equal(paused?.stage, "storyteller");
  assert.equal(state.phase, "day", "runNight should not enter night until the execution Storyteller queue is resolved");
  const pausedDay = state.day;
  const pausedNight = state.night;
  const ignored = runNight(state, fixedRng());
  assert.equal(ignored?.stage, "storyteller", "runNight should keep blocking while the execution Storyteller queue is unresolved");
  assert.equal(state.day, pausedDay, "unresolved execution Storyteller queue must not advance the day");
  assert.equal(state.night, pausedNight, "unresolved execution Storyteller queue must not advance the night");
  assert.equal(skipDay(state, fixedRng()), false, "legacy day skip should not mark day-end while Storyteller queue is unresolved");
  assert.equal(state.dayStageMeta.dayEndResolvedDay ?? null, null, "blocked day skip must not mark day-end as resolved");
  const action = getPendingStorytellerActionState(state);
  assert.equal(action.available, true);
  assert.equal(action.type, "moonchild-choice");

  const target = action.options.find((entry) => entry.team === "good");
  assert.ok(target, "Moonchild action should expose a legal target");
  assert.equal(resolvePendingStorytellerAction(state, { targetIds: [target.id] }).ok, true);

  const resumed = runNight(state, fixedRng());
  assert.equal(resumed?.ok, true);
  assert.equal(state.phase, "day", "runNight should complete the night after the queue is resolved");
  assert.equal(state.pendingStorytellerActions.length, 0);
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

function testEndOfDayStorytellerResumeDoesNotRerollMutantPenalty() {
  const state = startGame("snv", "klutz");
  runNight(state, fixedRng());
  moveToNomination(state);

  const klutz = human(state);
  const mutant = firstOther(state, (entry) => entry.alive && entry.team === "good" && entry.category !== "demon");
  applyRole(state, klutz, "klutz");
  applyRole(state, mutant, "mutant");
  mutant.publicClaimRoleId = "klutz";
  state.snv.cerenovusForcedByPlayerId = { [klutz.id]: "artist" };
  state.snv.cerenovusEnforceDayByPlayerId = { [klutz.id]: state.day };

  const values = [0.95, 0.1, 0.1];
  const rng = () => (values.length > 0 ? values.shift() : 0.1);
  const first = endDayAndBeginNight(state, rng);
  assert.equal(first.stage, "storyteller");
  assert.equal(klutz.alive, false, "Cerenovus should execute the human Klutz at day end");
  assert.equal(mutant.alive, true, "Mutant should survive the first day-end penalty roll");
  assert.equal(state.dayStageMeta.dayEndTriggersResolvedDay, state.day);

  const action = getPendingStorytellerActionState(state);
  assert.equal(action.type, "klutz-choice");
  const target = action.options.find((entry) => entry.team === "good");
  assert.ok(target, "Klutz action should expose a safe good target for this fixture");
  assert.equal(resolvePendingStorytellerAction(state, { targetIds: [target.id] }).ok, true);

  const resumed = endDayAndBeginNight(state, rng);
  assert.equal(resumed.stage, "night");
  assert.equal(mutant.alive, true, "resuming after the Storyteller queue must not reroll Mutant day-end punishment");
  assert.equal(
    state.events.executions.filter((entry) => entry.reason === "mutant-claim-break").length,
    0,
    "Mutant punishment should not be applied on the retry after a day-end Storyteller queue"
  );
}

[
  testGamblerPlayerRole,
  testPassedNominationWaitsForDayEndAndCanBeOvertaken,
  testSelfNominationIsRejectedWithoutSpendingNomination,
  testDayEndBlocksPendingNominationDebate,
  testPreferredBaronAppliesSetupShift,
  testPreferredGodfatherAppliesSetupShift,
  testPreferredFangGuAppliesSetupShift,
  testPreferredOutsiderOutsideBaseSetupKeepsCountsHonest,
  testCourtierChoosesRoleNotPlayer,
  testGodfatherBonusKillUsesHumanTarget,
  testEveryScriptDayActionHasCompleteDescriptorUnityFormAndSubmission,
  testGossipDayStatementAction,
  testSlayerDayActionResolvesPublicDayDeath,
  testScarletWomanTakesOverWhenDemonExecutedAtFiveAlive,
  testPoChargeAndMultiKill,
  testBMRAIDemonTargetsAvoidKnownEvilAllies,
  testLunaticUsesPerceivedDemonActionWithoutKilling,
  testPhilosopherRoleChoice,
  testArtistQuestion,
  testCerenovusPlayerRole,
  testPitHagPlayerRole,
  testPitHagCreatesGoodAlignedEvilTwinPairAndBlocksNoDemonWin,
  testPitHagMultiDemonQueuesStorytellerBalance,
  testPitHagBalanceRejectsResolutionLeavingMultipleDemons,
  testPitHagNoDemonDefersGoodWinUntilStorytellerConfirmation,
  testPitHagClockmakerEntryReceivesFirstNightInfo,
  testJugglerGuesses,
  testProfessorInteractionMetadata,
  testProfessorCanTargetAnyDeadPlayerButOnlyRevivesTownsfolk,
  testProfessorRevivesSelectedDeadTownsfolk,
  testProfessorCanWaitWithoutSpendingRevive,
  testOneShotNightActionsCanWaitWithoutSpendingAbility,
  testSailorExecutionIsRecordedButDoesNotKill,
  testPukkaPoisonedSailorCannotUseDeathProtectionAcrossPhaseFlags,
  testBMRDrunkStateIdsBlockSailorProtectionAcrossPhaseFlags,
  testDevilsAdvocateProtectionPreemptsPacifistWeight,
  testPacifistUsesWeightedSaveDecision,
  testInnkeeperProtectionBlocksBMRNightDeath,
  testInnkeeperProtectionDoesNotBlockNonDemonNightDeath,
  testSailorBlocksNightDeath,
  testMastermindExtraDayGoodExecutionGivesEvilWin,
  testMastermindExtraDayNoExecutionGivesGoodWin,
  testDevilsAdvocateCannotRepeatTarget,
  testExorcistCannotRepeatTarget,
  testZombuulRequiresNoDeathToday,
  testZombuulWakesAfterPreventedExecutionDeath,
  testZombuulTreatsPublicDayDeathAsDeathToday,
  testZombuulFirstDeathRegistersDeadButStaysAlive,
  testPoisonedZombuulFirstDeathDoesNotRegisterDead,
  testZombuulHiddenDeadUsesDeadVoteAndPublicThreshold,
  testProfessorTargetingHiddenDeadZombuulDoesNotRetarget,
  testPukkaSuppressedKeepsPreviousPoisonedTarget,
  testGodfatherTriggersFromOutsiderDayDeath,
  testSnakeCharmerHitGivesPrivateInfo,
  testVortoxDreamerInfoIsStrictlyFalse,
  testPoisonedVortoxDoesNotForceDreamerFalseInfo,
  testVortoxSavantAbnormalityCountsForMathematician,
  testPoisonedVortoxDoesNotForceSavantAllFalseInfo,
  testBarberSwapPreservesAlignmentAndResetsEntryRole,
  testWitchCurseKillsNominatorWithoutBlockingNomination,
  testWitchCurseTriggersWhenDebateStartsAndVoteStillResolves,
  testWitchCurseGameEndStopsVoteCeremony,
  testVortoxNoExecutionTriggersWhenNightStartsDirectly,
  testPoisonedVortoxNoExecutionDoesNotTriggerEvilWin,
  testEvilTwinPairBlocksGoodWinWhileBothTwinsLive,
  testEvilTwinExecutionDoesNotAutoWinWhileDemonLives,
  testGoodTwinExecutionGivesEvilWin,
  testSnVEndOfDayPenaltiesStopAfterGameOver,
  testSweetheartDrunkIdBlocksMutantClaimPenaltyAcrossPhaseFlags,
  testSnVPersistentPoisonIdsBlockMutantClaimPenaltyAcrossPhaseFlags,
  testInactiveEvilTwinPairDoesNotBlockGoodWin,
  testEvilTwinDoesNotRetargetAfterOpposingTwinDiesOnRoleChange,
  testSageQueuesInfoAction,
  testMoonchildQueuesStorytellerAction,
  testHumanMoonchildNightDeathChoiceKillsGoodTargetImmediately,
  testAIMoonchildNightDeathChoiceKillsGoodTargetImmediately,
  testRunNightStopsForExecutionStorytellerQueue,
  testKlutzQueuesStorytellerAction,
  testEndOfDayStorytellerResumeDoesNotRerollMutantPenalty,
  testAINightKilledBarberSwapsSameNight,
].forEach((test) => test());

console.log("role action contracts ok");
