import assert from "node:assert/strict";

import {
  advanceDayStage,
  createNewGame,
  endDayAndBeginNight,
  getPendingStorytellerActionState,
  getPubliclyAlivePlayers,
  markPublicDiscussionRound,
  openNominationWindow,
  resolveNominationAndVote,
  resolvePendingStorytellerAction,
  runNight,
  withSeededRandom,
} from "../scripts/engine.js";
import { getRoleById } from "../scripts/data.js";
import {
  chooseAINomination,
  decideAIVoteWithRationale,
  initializeAI,
} from "../scripts/ai.js";

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
  player.poisoned = false;
}

function drainStorytellerQueue(state, context) {
  const drainedTypes = [];
  for (let index = 0; index < 8 && !state.gameOver; index += 1) {
    const action = getPendingStorytellerActionState(state);
    if (!action.available) {
      return drainedTypes;
    }
    const result = resolvePendingStorytellerAction(state, { auto: true });
    assert.equal(result.ok, true, `${context}: ${action.type} should auto-resolve: ${result.reason}`);
    drainedTypes.push(action.type);
  }
  assert.equal(
    state.pendingStorytellerActions?.length ?? 0,
    0,
    `${context}: Storyteller queue should drain before the game continues`
  );
  return drainedTypes;
}

function endDayResolvingStorytellerGates(state, rng, context) {
  const storytellerTypes = [];
  for (let index = 0; index < 6 && !state.gameOver; index += 1) {
    const result = endDayAndBeginNight(state, rng);
    assert.equal(result.ok, true, `${context}: ${result.reason}`);
    if (result.stage !== "storyteller") {
      return { result, storytellerTypes };
    }
    assert.equal(state.phase, "day", `${context}: day-end Storyteller gate should pause before night begins`);
    storytellerTypes.push(...drainStorytellerQueue(state, `${context}/storyteller`));
  }
  assert.equal(state.gameOver, true, `${context}: repeated Storyteller gates should either drain or end the game`);
  return { result: { ok: true, stage: "ended" }, storytellerTypes };
}

function playAutoGame({ scriptId, preferredHumanRoleId, seed, maxDays = 16 }) {
  const rng = withSeededRandom(seed);
  const state = createNewGame({ scriptId, playerCount: 9, preferredHumanRoleId }, rng);
  const trace = [];
  const storytellerTypes = [];

  initializeAI(state);
  const firstNight = runNight(state, rng);
  if (firstNight?.stage === "storyteller") {
    storytellerTypes.push(...drainStorytellerQueue(state, `${scriptId} seed ${seed} first night`));
  }
  initializeAI(state);

  for (let dayIndex = 0; dayIndex < maxDays && !state.gameOver; dayIndex += 1) {
    assert.equal(state.phase, "day", `${scriptId} seed ${seed}: expected day phase`);
    const day = state.day;

    if (state.dayStage === "private") {
      const publicStage = advanceDayStage(state, "public");
      assert.equal(publicStage.ok, true, `${scriptId} seed ${seed}: ${publicStage.reason}`);
    }
    markPublicDiscussionRound(state);
    if (state.dayStage === "public") {
      const nominationStage = advanceDayStage(state, "nomination");
      assert.equal(nominationStage.ok, true, `${scriptId} seed ${seed}: ${nominationStage.reason}`);
    }

    let nominations = 0;
    for (let nominationIndex = 0; nominationIndex < 20 && !state.gameOver; nominationIndex += 1) {
      const proposal = chooseAINomination(state);
      if (!proposal) {
        break;
      }
      const result = resolveNominationAndVote(
        state,
        {
          nominatorId: proposal.nominatorId,
          nomineeId: proposal.nomineeId,
          humanVoteYes: true,
          decideAIVote: decideAIVoteWithRationale,
        },
        rng
      );
      assert.equal(
        result.accepted,
        true,
        `${scriptId} seed ${seed} D${day}: AI nomination should resolve as a game event, not a hard failure: ${result.reason}`
      );
      nominations += 1;
      if ((state.events.executions ?? []).some((entry) => entry.day === day)) {
        break;
      }
    }

    if (state.gameOver) {
      trace.push({
        day,
        nominations,
        stage: "ended",
        executionToday: (state.events.executions ?? []).some((entry) => entry.day === day),
        alive: getPubliclyAlivePlayers(state).length,
      });
      break;
    }

    const { result: ended, storytellerTypes: dayStorytellerTypes } = endDayResolvingStorytellerGates(
      state,
      rng,
      `${scriptId} seed ${seed} D${day}`
    );
    storytellerTypes.push(...dayStorytellerTypes);
    trace.push({
      day,
      nominations,
      stage: ended.stage,
      executionToday: !!ended.executionToday,
      storytellerTypes: dayStorytellerTypes,
      alive: getPubliclyAlivePlayers(state).length,
    });
    if (state.gameOver) {
      break;
    }
    assert.equal(ended.stage, "night", `${scriptId} seed ${seed} D${day}: expected night after any Storyteller gates resolve`);
    const nightResult = runNight(state, rng);
    if (nightResult?.stage === "storyteller") {
      storytellerTypes.push(...drainStorytellerQueue(state, `${scriptId} seed ${seed} N${state.night}`));
    }
    initializeAI(state);
  }

  assert.equal(state.gameOver, true, `${scriptId} seed ${seed}: auto game should reach a winner`);
  assert.ok(["good", "evil"].includes(state.winner), `${scriptId} seed ${seed}: winner should be set`);
  return { state, trace, storytellerTypes };
}

function playShortestNoExecutionPath({ scriptId, preferredHumanRoleId, seed, maxDays = 12 }) {
  const rng = withSeededRandom(seed);
  const state = createNewGame({ scriptId, playerCount: 9, preferredHumanRoleId }, rng);
  const trace = [];
  const storytellerTypes = [];

  initializeAI(state);
  const firstNight = runNight(state, rng);
  if (firstNight?.stage === "storyteller") {
    storytellerTypes.push(...drainStorytellerQueue(state, `${scriptId} ${preferredHumanRoleId} shortest N${state.night}`));
  }
  initializeAI(state);

  for (let dayIndex = 0; dayIndex < maxDays && !state.gameOver; dayIndex += 1) {
    assert.equal(state.phase, "day", `${scriptId} ${preferredHumanRoleId}: shortest path should reach day phase`);
    const day = state.day;
    if (state.dayStage === "private") {
      const publicStage = advanceDayStage(state, "public");
      assert.equal(publicStage.ok, true, `${scriptId} ${preferredHumanRoleId} D${day}: ${publicStage.reason}`);
    }
    markPublicDiscussionRound(state);
    if (state.dayStage === "public") {
      const nominationStage = advanceDayStage(state, "nomination");
      assert.equal(nominationStage.ok, true, `${scriptId} ${preferredHumanRoleId} D${day}: ${nominationStage.reason}`);
    }

    const { result: ended, storytellerTypes: dayStorytellerTypes } = endDayResolvingStorytellerGates(
      state,
      rng,
      `${scriptId} ${preferredHumanRoleId} shortest D${day}`
    );
    storytellerTypes.push(...dayStorytellerTypes);
    trace.push({
      day,
      stage: ended.stage,
      executionToday: !!ended.executionToday,
      alive: getPubliclyAlivePlayers(state).length,
      storytellerTypes: dayStorytellerTypes,
    });
    if (state.gameOver) {
      break;
    }
    assert.equal(ended.stage, "night", `${scriptId} ${preferredHumanRoleId} D${day}: shortest path should enter night`);
    const nightResult = runNight(state, rng);
    if (nightResult?.stage === "storyteller") {
      storytellerTypes.push(...drainStorytellerQueue(state, `${scriptId} ${preferredHumanRoleId} shortest N${state.night}`));
    }
    initializeAI(state);
  }

  assert.equal(state.gameOver, true, `${scriptId} ${preferredHumanRoleId}: shortest no-execution path should reach endgame`);
  assert.ok(["good", "evil"].includes(state.winner), `${scriptId} ${preferredHumanRoleId}: shortest path winner should be set`);
  assert.ok(trace.length > 0, `${scriptId} ${preferredHumanRoleId}: shortest path should exercise at least one day`);
  return { state, trace, storytellerTypes };
}

function testTBAutoGameReachesEndgame() {
  const { state, trace } = playAutoGame({
    scriptId: "tb",
    preferredHumanRoleId: "washerwoman",
    seed: 260609,
  });

  assert.equal(state.winner, "evil");
  assert.ok(trace.length >= 3, "TB auto game should exercise multiple day/night loops");
  assert.ok(trace.some((entry) => entry.executionToday), "TB auto game should include a deferred execution");
}

function testShortestNoExecutionPathsReachEndgame() {
  const scenarios = [
    ["tb", "washerwoman"],
    ["bmr", "grandmother"],
    ["bmr", "zombuul"],
    ["snv", "clockmaker"],
    ["snv", "pit-hag"],
    ["snv", "fang-gu"],
  ];

  scenarios.forEach(([scriptId, preferredHumanRoleId]) => {
    const { trace } = playShortestNoExecutionPath({
      scriptId,
      preferredHumanRoleId,
      seed: 270001,
    });
    assert.ok(
      trace.every((entry) => entry.stage === "night" || entry.stage === "ended"),
      `${scriptId} ${preferredHumanRoleId}: shortest path should only stop at night/endgame`
    );
  });
}

function testSnVAutoGameSurvivesWitchCurseNomination() {
  const { state, trace } = playAutoGame({
    scriptId: "snv",
    preferredHumanRoleId: "clockmaker",
    seed: 260612,
  });

  assert.ok(state.gameOver, "SnV Witch seed should still reach endgame");
  assert.ok(
    state.events.dayDeaths.some((entry) => entry.reason === "witch-curse"),
    "SnV seed should exercise a Witch curse day death"
  );
  assert.ok(trace.length >= 1, "SnV auto game should advance at least one day loop");
}

function testSnVPitHagAutoGameReachesEndgameAfterLateGameNominations() {
  const { state, trace } = playAutoGame({
    scriptId: "snv",
    preferredHumanRoleId: "pit-hag",
    seed: 260609,
  });

  assert.equal(state.gameOver, true, "SnV Pit-Hag seed should reach endgame instead of failing day-end");
  assert.ok(["good", "evil"].includes(state.winner), "SnV Pit-Hag seed should resolve to a concrete winner");
  assert.ok(
    trace.some((entry) => entry.nominations > 0),
    "SnV Pit-Hag auto game should exercise AI nomination loops"
  );
  assert.ok(
    (state.events.executions ?? []).length > 0,
    "SnV Pit-Hag auto game should include at least one execution"
  );
  assert.ok(
    ["ended", "night"].includes(trace.at(-1)?.stage),
    "auto loop should stop cleanly once the game ends"
  );
}

function testSnVKlutzAutoGameResumesAfterEndOfDayStorytellerGate() {
  const { state, storytellerTypes } = playAutoGame({
    scriptId: "snv",
    preferredHumanRoleId: "klutz",
    seed: 260609,
  });

  assert.equal(state.gameOver, true, "SnV Klutz seed should reach endgame after the Storyteller gate resolves");
  assert.ok(storytellerTypes.includes("klutz-choice"), "SnV Klutz seed should exercise the Klutz Storyteller gate");
}

function testVirginImmediateExecutionStopsFurtherNominations() {
  const rng = withSeededRandom(260610);
  const state = createNewGame({ scriptId: "tb", playerCount: 9, preferredHumanRoleId: "washerwoman" }, rng);
  initializeAI(state);
  runNight(state, rng);
  initializeAI(state);

  assert.equal(advanceDayStage(state, "public").ok, true);
  markPublicDiscussionRound(state);
  assert.equal(advanceDayStage(state, "nomination").ok, true);
  assert.equal(openNominationWindow(state, { ticks: 4, intent: "contract" }).ok, true);

  const virgin = state.players.find((entry) => !entry.isHuman && entry.alive);
  const nominator = state.players.find((entry) => !entry.isHuman && entry.alive && entry.id !== virgin?.id);
  assert.ok(virgin, "fixture needs a Virgin target");
  assert.ok(nominator, "fixture needs a living AI townsfolk nominator");
  applyRole(state, virgin, "virgin");
  applyRole(state, nominator, "chef");

  const result = resolveNominationAndVote(
    state,
    {
      nominatorId: nominator.id,
      nomineeId: virgin.id,
      humanVoteYes: true,
      decideAIVote: () => true,
    },
    rng
  );
  assert.equal(result.accepted, true, result.reason);
  assert.equal(result.special, "virgin");
  assert.equal(
    state.events.executions.some((entry) => entry.day === state.day && entry.nomineeId === nominator.id && entry.reason === "virgin-trigger"),
    true,
    "Virgin should immediately execute the nominator"
  );
  assert.equal(state.dayStageMeta.nominationClock.active, false, "immediate execution should close the nomination window");
  assert.equal(state.dayStageMeta.nominationClock.status, "execution-resolved");
  assert.equal(chooseAINomination(state), null, "AI should stop proposing nominations after a same-day execution");

  const secondNominator = state.players.find((entry) => !entry.isHuman && entry.alive && !entry.nominatedToday);
  const secondNominee = state.players.find((entry) => !entry.isHuman && entry.alive && !entry.beenNominatedToday && entry.id !== secondNominator?.id);
  assert.ok(secondNominator, "fixture needs a second possible nominator");
  assert.ok(secondNominee, "fixture needs a second possible nominee");
  const second = resolveNominationAndVote(
    state,
    {
      nominatorId: secondNominator.id,
      nomineeId: secondNominee.id,
      humanVoteYes: true,
      decideAIVote: () => true,
    },
    rng
  );
  assert.equal(second.accepted, false, "engine should reject any second nomination after an immediate execution");
}

[
  testTBAutoGameReachesEndgame,
  testShortestNoExecutionPathsReachEndgame,
  testSnVAutoGameSurvivesWitchCurseNomination,
  testSnVPitHagAutoGameReachesEndgameAfterLateGameNominations,
  testSnVKlutzAutoGameResumesAfterEndOfDayStorytellerGate,
  testVirginImmediateExecutionStopsFurtherNominations,
].forEach((test) => test());

console.log("full game loop contracts ok");
