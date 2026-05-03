import assert from "node:assert/strict";

import {
  advanceDayStage,
  createNewGame,
  markPublicDiscussionRound,
  resolveNominationAndVote,
  runNight,
} from "../scripts/engine.js";
import {
  getAIInsightRows,
  initializeAI,
  refreshAIBeliefs,
  runAIDiscussion,
  runPrivateWhisper,
} from "../scripts/ai.js";
import { addAgentObservation, getAIAgent, getKnownBluffRoleIds, getVisibleClaims } from "../scripts/ai_agents.js";

function fixedRng(seed = 987654321) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function makeTBState() {
  const rng = fixedRng();
  const state = createNewGame({ scriptId: "tb", playerCount: 9, preferredHumanRoleId: "washerwoman" }, rng);
  initializeAI(state);
  runNight(state, rng);
  return state;
}

function testEvilRecognitionIsAgentScoped() {
  const state = makeTBState();
  const demon = state.players.find((player) => !player.isHuman && player.category === "demon");
  const minion = state.players.find((player) => !player.isHuman && player.category === "minion");
  const good = state.players.find((player) => !player.isHuman && player.team === "good");

  assert.ok(demon, "expected AI demon when human is forced good");
  assert.ok(minion, "expected AI minion when human is forced good");
  assert.ok(good, "expected at least one good AI");

  const demonAgent = getAIAgent(state, demon);
  const minionAgent = getAIAgent(state, minion);
  const goodAgent = getAIAgent(state, good);

  assert.ok(demonAgent.knownAllyIds.includes(minion.id), "demon should know minion seat after N1 recognition");
  assert.equal(minionAgent.knownDemonId, demon.id, "minion should know demon seat after N1 recognition");
  assert.equal(getKnownBluffRoleIds(state, demon).length, 3, "demon should know three bluffs");
  assert.equal(getKnownBluffRoleIds(state, minion).length, 0, "minion should not automatically know demon bluffs");
  assert.equal(getKnownBluffRoleIds(state, good).length, 0, "good AI should not know demon bluffs");
  assert.equal(goodAgent.knownAllyIds.length, 0, "good AI should not receive evil-team ally data");
}

function testPrivateClaimsAreNotGlobal() {
  const state = makeTBState();
  const human = state.players.find((player) => player.isHuman);
  const viewer = state.players.find((player) => !player.isHuman);
  const outsider = state.players.find((player) => !player.isHuman && player.id !== viewer.id);

  state.events.claims.push({
    day: state.day,
    playerId: human.id,
    roleId: "washerwoman",
    private: true,
    viewerId: viewer.id,
  });

  assert.equal(getVisibleClaims(state, viewer).length, 1, "private claim should be visible to its viewer");
  assert.equal(getVisibleClaims(state, outsider).length, 0, "private claim should not leak to unrelated AIs");
}

function testInsightRowsDoNotMutatePlayerBeliefs() {
  const state = makeTBState();
  const before = JSON.stringify(
    state.players
      .filter((player) => !player.isHuman)
      .map((player) => ({ id: player.id, suspicion: player.suspicion, reasonFlags: player.reasonFlags }))
  );

  const rows = getAIInsightRows(state);
  assert.ok(rows.length > 0, "insight rows should still render");

  const after = JSON.stringify(
    state.players
      .filter((player) => !player.isHuman)
      .map((player) => ({ id: player.id, suspicion: player.suspicion, reasonFlags: player.reasonFlags }))
  );
  assert.equal(after, before, "rendering AI insight rows should not mutate player belief fields");
}

function observationKinds(agent, kind) {
  return (agent.observations ?? []).filter((entry) => entry.kind === kind);
}

function testNightInfoBecomesPrivateObservation() {
  const state = makeTBState();
  const evilAI = state.players.find((player) => !player.isHuman && player.team === "evil");
  const goodAI = state.players.find((player) => !player.isHuman && player.team === "good");

  assert.ok(evilAI, "expected an evil AI");
  assert.ok(goodAI, "expected a good AI");
  assert.ok(
    observationKinds(getAIAgent(state, evilAI), "night-info").length > 0,
    "evil first-night info should be stored as private night-info observations"
  );
  assert.equal(
    observationKinds(getAIAgent(state, goodAI), "evil-recognition").length,
    0,
    "good AI should not observe evil recognition"
  );
}

function testPublicDiscussionBecomesPublicObservations() {
  const state = makeTBState();
  const result = advanceDayStage(state, "public");
  assert.equal(result.ok, true, result.reason);
  runAIDiscussion(state, fixedRng(111));

  state.players
    .filter((player) => !player.isHuman)
    .forEach((player) => {
      assert.ok(
        observationKinds(getAIAgent(state, player), "public-speech").length > 0,
        `${player.name} should observe public discussion`
      );
    });
}

function testPrivateWhisperBecomesPrivateObservationOnlyForParticipant() {
  const state = makeTBState();
  const target = state.players.find((player) => !player.isHuman && player.alive);
  const outsider = state.players.find((player) => !player.isHuman && player.alive && player.id !== target.id);
  assert.ok(target, "expected whisper target");
  assert.ok(outsider, "expected unrelated AI");

  const result = runPrivateWhisper(
    state,
    { targetId: target.id, humanLine: "你最怀疑谁？", intentHint: "suspect" },
    fixedRng(222)
  );
  assert.equal(result.ok, true, result.reason);

  assert.ok(
    observationKinds(getAIAgent(state, target), "private-whisper").length > 0,
    "whisper target should receive private-whisper observations"
  );
  assert.equal(
    observationKinds(getAIAgent(state, outsider), "private-whisper").length,
    0,
    "unrelated AI should not receive private-whisper observations"
  );
}

function testNominationAndVoteBecomePublicObservations() {
  const state = makeTBState();
  advanceDayStage(state, "public");
  runAIDiscussion(state, fixedRng(333));
  markPublicDiscussionRound(state);
  advanceDayStage(state, "nomination");

  const nominator = state.players.find((player) => !player.isHuman && player.alive);
  const nominee = state.players.find((player) => player.alive && player.id !== nominator.id && player.roleId !== "virgin");
  assert.ok(nominator, "expected nominator");
  assert.ok(nominee, "expected non-virgin nominee");

  const result = resolveNominationAndVote(
    state,
    {
      nominatorId: nominator.id,
      nomineeId: nominee.id,
      humanVoteYes: true,
      decideAIVote: () => true,
    },
    fixedRng(333)
  );
  assert.equal(result.accepted, true, result.reason);
  assert.equal(result.passed, true, "forced yes votes should execute the nominee");

  state.players
    .filter((player) => !player.isHuman)
    .forEach((player) => {
      const agent = getAIAgent(state, player);
      assert.ok(observationKinds(agent, "nomination").length > 0, `${player.name} should observe nomination`);
      assert.ok(observationKinds(agent, "vote").length > 0, `${player.name} should observe vote`);
      assert.ok(observationKinds(agent, "execution").length > 0, `${player.name} should observe execution outcome`);
    });
}

function testBeliefRefreshConsumesAgentObservations() {
  const state = makeTBState();
  const observer = state.players.find((player) => !player.isHuman && player.team === "good");
  const speaker = state.players.find((player) => !player.isHuman && player.id !== observer.id);
  const target = state.players.find(
    (player) => player.id !== observer.id && player.id !== speaker.id && player.alive
  );

  assert.ok(observer, "expected observer AI");
  assert.ok(speaker, "expected public speaker AI");
  assert.ok(target, "expected focused target");

  addAgentObservation(state, observer.id, {
    kind: "public-speech",
    day: state.day,
    phase: state.phase,
    actorId: speaker.id,
    text: "I would execute this player.",
    payload: {
      speakerId: speaker.id,
      focusId: target.id,
    },
  });

  refreshAIBeliefs(state);

  assert.ok(
    observer.reasonFlags?.[target.id]?.includes("humanAccuse"),
    "belief refresh should turn observed public accusation into local suspicion evidence"
  );
}

[
  testEvilRecognitionIsAgentScoped,
  testPrivateClaimsAreNotGlobal,
  testInsightRowsDoNotMutatePlayerBeliefs,
  testNightInfoBecomesPrivateObservation,
  testPublicDiscussionBecomesPublicObservations,
  testPrivateWhisperBecomesPrivateObservationOnlyForParticipant,
  testNominationAndVoteBecomePublicObservations,
  testBeliefRefreshConsumesAgentObservations,
].forEach((test) => test());

console.log("ai agent contracts ok");
