import assert from "node:assert/strict";

import {
  advanceDayStage,
  createNewGame,
  getPendingStorytellerActionState,
  markPublicDiscussionRound,
  resolvePendingStorytellerAction,
  runNight,
  withSeededRandom,
} from "../scripts/engine.js";
import { initializeAI, runAIDiscussion } from "../scripts/ai.js";
import {
  CANDIDATE_SEEDS,
  FLAGSHIP_REPLAY_CONFIG,
  MAIN_SEEDS,
  MAX_DAYS,
  buildDeterministicIdentity,
  evaluateActionLegality,
  evaluateCorpusJourneyCoverage,
  evaluateJourneyCoverage,
  runFlagshipReplayCorpus,
} from "../scripts/ai_flagship_replay_eval.mjs";

function drainStorytellerQueue(state, context) {
  for (let index = 0; index < 8 && !state.gameOver; index += 1) {
    const pending = getPendingStorytellerActionState(state);
    if (!pending.available) return;
    const result = resolvePendingStorytellerAction(state, { auto: true });
    assert.equal(result.ok, true, `${context}: ${pending.type} should auto-resolve`);
  }
  assert.equal(state.pendingStorytellerActions?.length ?? 0, 0, `${context}: queue should drain`);
}

function createPublicDay(seed = 260609) {
  const rng = withSeededRandom(seed);
  const state = createNewGame(
    {
      scriptId: FLAGSHIP_REPLAY_CONFIG.scriptId,
      playerCount: FLAGSHIP_REPLAY_CONFIG.playerCount,
      preferredHumanRoleId: FLAGSHIP_REPLAY_CONFIG.preferredHumanRoleId,
    },
    rng
  );
  initializeAI(state);
  const firstNight = runNight(state, rng);
  if (firstNight?.stage === "storyteller") {
    drainStorytellerQueue(state, "observer fixture first night");
  }
  initializeAI(state);
  if (state.dayStage === "private") {
    assert.equal(advanceDayStage(state, "public").ok, true);
  }
  assert.equal(markPublicDiscussionRound(state), true);
  return { state, rng };
}

function assertDeepFrozen(value, path = "root") {
  if (!value || typeof value !== "object") return;
  assert.equal(Object.isFrozen(value), true, `${path} should be frozen`);
  Object.entries(value).forEach(([key, child]) => assertDeepFrozen(child, `${path}.${key}`));
}

function assertNoForbiddenIdentityMaterial(value) {
  const serialized = JSON.stringify(value);
  [
    "text",
    "line",
    "hash",
    "timestamp",
    "createdAt",
    "updatedAt",
    "path",
    "roleId",
    "decisionRationale",
    "strategyRationale",
    "evidenceContract",
    "random",
  ].forEach((token) => {
    assert.equal(serialized.includes(`\"${token}\"`), false, `identity should exclude ${token}`);
  });
}

// Integration contract: this is the real public-discussion path, not a mocked publisher.
{
  const { state, rng } = createPublicDay();
  const observations = [];
  runAIDiscussion(state, rng, {
    onPublicSpeech(observation) {
      observations.push({ observation, appendedCount: state.events.speeches.length });
    },
  });

  assert.ok(observations.length > 0, "observer should receive real AI public speeches");
  assert.equal(observations.length, state.events.speeches.length);
  observations.forEach(({ observation, appendedCount }, index) => {
    assert.equal(appendedCount, index + 1, "observer should fire immediately after append");
    assert.equal(observation.visibleEvent.text, state.events.speeches[index].line);
    assert.equal(observation.visibleEvent.speakerId, state.events.speeches[index].playerId);
    assert.equal(observation.agentView.viewerId, observation.visibleEvent.speakerId);
    assert.equal(observation.agentView.audience, "public");
    assert.equal(
      observation.agentView.visibleSpeeches.length,
      index,
      "speaker view should be the pre-composition snapshot"
    );
    assertDeepFrozen(observation.visibleEvent, `observation[${index}].visibleEvent`);
    assertDeepFrozen(observation.agentView, `observation[${index}].agentView`);
    assert.notEqual(observation.visibleEvent, state.events.speeches[index]);
    const retainedText = state.events.speeches[index].line;
    assert.throws(() => {
      observation.visibleEvent.text = "mutation should fail";
    }, TypeError);
    assert.equal(state.events.speeches[index].line, retainedText, "observer input cannot mutate retained speech");
  });

  const beforeLegacyCall = state.events.speeches.length;
  assert.doesNotThrow(() => runAIDiscussion(state, rng));
  assert.ok(state.events.speeches.length > beforeLegacyCall, "legacy two-argument call should still publish");
}

const corpus = runFlagshipReplayCorpus();

assert.equal(MAX_DAYS, 16);
assert.ok(CANDIDATE_SEEDS.length >= 3 && CANDIDATE_SEEDS.length <= 5);
assert.equal(new Set(CANDIDATE_SEEDS).size, CANDIDATE_SEEDS.length);
assert.equal(MAIN_SEEDS.length, 3);
assert.equal(new Set(MAIN_SEEDS).size, 3);
assert.ok(MAIN_SEEDS.every((seed) => CANDIDATE_SEEDS.includes(seed)));
assert.equal(corpus.pairs.length, 3, "main corpus should contain exactly three paired games");
assert.ok(corpus.elapsedMs < 120_000, `six-run corpus should fit 120 seconds, got ${corpus.elapsedMs}ms`);

corpus.pairs.forEach((pair) => {
  assert.equal(pair.identityMatches, true, `seed ${pair.seed}: deterministic identity should match`);
  assert.equal(pair.winnerMatches, true, `seed ${pair.seed}: winner should match`);
  assert.deepEqual(pair.primary.deterministicIdentity, pair.comparison.deterministicIdentity);
  assert.equal(pair.primary.winner, pair.comparison.winner);

  [pair.primary, pair.comparison].forEach((game) => {
    assert.ok(["good", "evil"].includes(game.winner));
    assert.ok(game.daysPlayed <= MAX_DAYS);
    assert.equal(game.pendingStorytellerActions, 0);
    assert.equal(evaluateActionLegality(game.actionChecks).length, 0);
    assert.equal(evaluateJourneyCoverage(game).length, 0);
    assert.ok(game.journey.aiSpeechCount > 0);
    assert.ok(game.journey.aiNominationCount > 0);
    assert.ok(game.journey.aiVoteCount > 0);
    assert.ok(game.publicTrace.some((event) => event.type === "winner"));
    assert.ok(game.publicTrace.some((event) => event.type === "execution"));
    assertNoForbiddenIdentityMaterial(game.deterministicIdentity);

    const speechIdentities = game.deterministicIdentity.events.filter((event) => event.type === "speech");
    assert.ok(speechIdentities.length > 0);
    speechIdentities.forEach((event) => {
      assert.deepEqual(Object.keys(event).sort(), [
        "actorId",
        "day",
        "parsedStance",
        "phase",
        "publicEvidenceCategory",
        "sequence",
        "speechKind",
        "targetId",
        "type",
      ]);
    });

    const humanId = game.human.playerId;
    assert.ok(humanId);
    assert.equal(game.human.policy.voteYes, true);
    assert.ok(game.aiMetricEvents.every((event) => event.actorId !== humanId));

    const executionEvents = game.publicTrace.filter((event) => event.type === "execution");
    executionEvents.forEach((execution) => {
      const priorPassedVote = game.publicTrace.find(
        (event) =>
          event.type === "vote" &&
          event.day === execution.day &&
          event.targetId === execution.targetId &&
          event.passed &&
          event.sequence < execution.sequence
      );
      assert.ok(priorPassedVote, "execution should only appear after its passed vote and day-end resolution");
    });

    game.actionChecks
      .filter((check) => check.action === "resolve-nomination-vote")
      .forEach((check) => {
        assert.equal(check.nominationAlreadyAccepted, true);
        assert.equal(check.debateActiveAfter, false);
        assert.equal(check.executionRecordedImmediately, false);
      });
  });
});

assert.deepEqual(evaluateCorpusJourneyCoverage(corpus), []);
assert.ok(
  corpus.pairs.some((pair) => pair.primary.journey.publicDiscussionDays.length >= 2),
  "at least one locked game should have two public discussion days"
);

{
  const trace = structuredClone(corpus.pairs[0].primary.publicTrace);
  const speech = trace.find((event) => event.type === "speech");
  assert.ok(speech);
  speech.text = `换一种无害措辞：${speech.text}`;
  assert.notDeepEqual(trace, corpus.pairs[0].primary.publicTrace);
  assert.deepEqual(
    buildDeterministicIdentity(corpus.pairs[0].seed, trace),
    corpus.pairs[0].primary.deterministicIdentity,
    "harmless rendered rewording should not change deterministic identity"
  );
}

{
  const rejected = {
    sequence: 99,
    day: 1,
    phase: "day/nomination",
    action: "resolve-nomination-vote",
    accepted: false,
    reason: "fixture rejection",
  };
  const failures = evaluateActionLegality([rejected]);
  assert.equal(failures.length, 1);
  assert.equal(failures[0].category, "action-legality");
  assert.equal(failures[0].action, rejected.action);
}

{
  const noCrossDay = structuredClone(corpus.pairs[0].primary);
  const firstSpeechDay = noCrossDay.journey.publicDiscussionDays[0];
  noCrossDay.publicTrace = noCrossDay.publicTrace.filter(
    (event) => event.type !== "speech" || event.day === firstSpeechDay
  );
  noCrossDay.journey.publicDiscussionDays = [firstSpeechDay];
  const failures = evaluateJourneyCoverage(noCrossDay, { requireCrossDay: true });
  assert.ok(failures.some((failure) => failure.category === "cross-day-coverage"));
}

console.log(
  `AI flagship replay U1 contracts passed (${corpus.pairs.length} seeds, ${corpus.pairs.length * 2} fresh runs, ${corpus.elapsedMs}ms).`
);
