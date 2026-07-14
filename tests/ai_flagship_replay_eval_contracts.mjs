import assert from "node:assert/strict";

import { getRoleById } from "../scripts/data.js";
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
import { getAIAgent } from "../scripts/ai_agents.js";
import {
  CANDIDATE_SEEDS,
  FLAGSHIP_REPLAY_CONFIG,
  FLAGSHIP_REPLAY_THRESHOLDS,
  INFORMATION_BOUNDARY_FACT_FAMILIES,
  MAIN_SEEDS,
  MAX_DAYS,
  buildDeterministicIdentity,
  compactReplayEvaluationSummary,
  evaluateActionLegality,
  evaluateCorpusJourneyCoverage,
  evaluateInformationBoundaryObservation,
  evaluateJourneyCoverage,
  evaluateReplayCorpus,
  evaluateReplayGame,
  replayEvaluationExitCode,
  runFlagshipReplayCorpus,
  runFlagshipReplayEvaluation,
  runFlagshipReplaySensitivity,
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

  const demon = state.players.find((player) => !player.isHuman && player.category === "demon");
  const good = state.players.find((player) => !player.isHuman && player.team === "good");
  assert.ok(demon, "locked TB observer fixture should contain an AI demon");
  assert.ok(good, "locked TB observer fixture should contain a good AI");
  const demonObservation = observations.find(({ observation }) => observation.visibleEvent.speakerId === demon.id)?.observation;
  const goodObservation = observations.find(({ observation }) => observation.visibleEvent.speakerId === good.id)?.observation;
  assert.ok(demonObservation?.legalKnowledge, "observer should expose a separate legal-knowledge sidecar");
  assert.ok(goodObservation?.legalKnowledge, "every observed speaker should receive a legal-knowledge sidecar");
  assertDeepFrozen(demonObservation.legalKnowledge, "demonObservation.legalKnowledge");
  assert.notEqual(demonObservation.legalKnowledge, demonObservation.agentView);
  assert.equal("legalKnowledge" in demonObservation.visibleEvent, false, "sidecar must not enter visibleEvent");
  assert.equal(JSON.stringify(state.events.speeches).includes("legalKnowledge"), false, "sidecar must not enter public trace");

  const demonAgent = getAIAgent(state, demon);
  assert.deepEqual(demonObservation.legalKnowledge.knownBluffRoleIds, demonAgent.knownBluffRoleIds);
  assert.equal(demonObservation.legalKnowledge.self.roleId, demonAgent.knownSelfRoleId);
  assert.equal(demonObservation.legalKnowledge.self.team, demonAgent.knownSelfTeam);
  assert.deepEqual(demonObservation.legalKnowledge.knownAllyIds, demonAgent.knownAllyIds);
  const knownBluffRoleId = demonObservation.legalKnowledge.knownBluffRoleIds[0];
  const knownBluffRoleName = getRoleById("tb", knownBluffRoleId)?.name;
  assert.ok(knownBluffRoleId && knownBluffRoleName, "real demon should carry a known bluff into the audit sidecar");

  const authorized = evaluateInformationBoundaryObservation({
    ...demonObservation,
    visibleEvent: {
      ...demonObservation.visibleEvent,
      text: `我明确知道的恶魔伪装身份是${knownBluffRoleName}。`,
    },
  });
  assert.equal(authorized.checkedCount, 1);
  assert.deepEqual(authorized.failures, [], "real demon's utterance-time known bluff should be authorized");

  const rejected = evaluateInformationBoundaryObservation({
    ...goodObservation,
    visibleEvent: {
      ...goodObservation.visibleEvent,
      text: `我明确知道的恶魔伪装身份是${knownBluffRoleName}。`,
    },
  });
  assert.equal(rejected.checkedCount, 1);
  assert.equal(rejected.failures.length, 1, "good speaker should not inherit demon bluff knowledge");
  const rejectedDiagnostic = JSON.stringify(rejected.failures[0]);
  assert.equal(rejectedDiagnostic.includes(knownBluffRoleId), false);
  assert.equal(rejectedDiagnostic.includes(knownBluffRoleName), false);

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
  const originalTrace = corpus.pairs[0].primary.publicTrace;
  const originalVoteStatement = originalTrace.find((event) => event.type === "vote-statement");
  assert.ok(originalVoteStatement, "identity contract needs a visible vote statement");

  const textOnly = structuredClone(originalTrace);
  const textOnlyStatement = textOnly.find((event) => event.sequence === originalVoteStatement.sequence);
  textOnlyStatement.text = `同一票态，换一种公开措辞：${textOnlyStatement.text}`;
  assert.deepEqual(
    buildDeterministicIdentity(corpus.pairs[0].seed, textOnly),
    corpus.pairs[0].primary.deterministicIdentity,
    "vote-statement wording alone must not affect deterministic identity"
  );

  const stanceChanged = structuredClone(originalTrace);
  const stanceChangedStatement = stanceChanged.find((event) => event.sequence === originalVoteStatement.sequence);
  stanceChangedStatement.parsedStance = originalVoteStatement.parsedStance === "support" ? "oppose" : "support";
  assert.notDeepEqual(
    buildDeterministicIdentity(corpus.pairs[0].seed, stanceChanged),
    corpus.pairs[0].primary.deterministicIdentity,
    "vote-statement semantic stance must participate in deterministic identity"
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

// U2 gate contract: thresholds are explicit, frozen before any runtime AI correction,
// and every social gate consumes only the visible replay projection.
assert.equal(FLAGSHIP_REPLAY_THRESHOLDS.freezePoint, "untouched-u1-ai-before-runtime-correction");
assert.equal(FLAGSHIP_REPLAY_THRESHOLDS.maxDays, MAX_DAYS);
assert.deepEqual(
  [...INFORMATION_BOUNDARY_FACT_FAMILIES],
  ["demon-bluff", "evil-recognition", "actual-role", "actual-team", "forbidden-marker"]
);
assertDeepFrozen(FLAGSHIP_REPLAY_THRESHOLDS, "FLAGSHIP_REPLAY_THRESHOLDS");
assertDeepFrozen(INFORMATION_BOUNDARY_FACT_FAMILIES, "INFORMATION_BOUNDARY_FACT_FAMILIES");
Object.values(FLAGSHIP_REPLAY_THRESHOLDS.maximumViolations).forEach((value) => assert.equal(value, 0));
Object.values(FLAGSHIP_REPLAY_THRESHOLDS.minimumDenominators).forEach((value) => assert.equal(value, 1));
Object.values(FLAGSHIP_REPLAY_THRESHOLDS.formulas).forEach((value) => assert.ok(`${value}`.trim()));

function boundaryObservation(text, overrides = {}) {
  const targets = [
    { id: "p1", name: "1号", seatIndex: 0, publicClaimRoleId: null },
    { id: "p2", name: "2号", seatIndex: 1, publicClaimRoleId: null },
    { id: "p3", name: "3号", seatIndex: 2, publicClaimRoleId: null },
    { id: "p4", name: "4号", seatIndex: 3, publicClaimRoleId: "empath" },
    { id: "p5", name: "5号", seatIndex: 4, publicClaimRoleId: null },
    { id: "p6", name: "6号", seatIndex: 5, publicClaimRoleId: null },
  ];
  return {
    visibleEvent: {
      day: 2,
      phase: "day/public",
      speakerId: "p1",
      focusId: "p6",
      text,
    },
    agentView: {
      viewerId: "p1",
      self: {
        id: "p1",
        roleKnownToSelf: "washerwoman",
        perceivedRoleId: "washerwoman",
        teamKnownToSelf: "good",
      },
      knownAllies: ["p2", "p3"],
      knownDemonId: null,
      knownMinionIds: [],
      knownBluffRoleIds: [],
      visibleClaims: [{ day: 1, playerId: "p4", roleId: "empath", private: false }],
      targets,
      targetById: Object.fromEntries(targets.map((target) => [target.id, target])),
      ...overrides,
    },
    legalKnowledge: {
      viewerId: "p1",
      self: { roleId: "washerwoman", team: "good" },
      knownAllyIds: ["p2", "p3"],
      knownDemonId: "p2",
      knownMinionIds: ["p3"],
      knownBluffRoleIds: ["chef"],
      publicRoleReveals: [{ playerId: "p4", roleId: "empath" }],
    },
  };
}

const authorizedBoundaryExamples = [
  ["demon-bluff", "我明确知道的恶魔伪装身份是厨师。"],
  ["evil-recognition", "我在首夜认出的恶魔是2号。"],
  ["actual-role", "4号的真实角色是共情者。"],
  ["actual-team", "2号的真实阵营是邪恶。"],
];
authorizedBoundaryExamples.forEach(([family, text]) => {
  const result = evaluateInformationBoundaryObservation(boundaryObservation(text));
  assert.equal(result.checkedCount, 1, `${family}: authorized assertion should be recognized`);
  assert.deepEqual(result.failures, [], `${family}: known fact should be authorized`);
  assert.equal(result.familyCounts[family], 1);
});

const unknownBoundaryExamples = [
  ["demon-bluff", "我明确知道的恶魔伪装身份是调查员。", ["investigator", "调查员"]],
  ["evil-recognition", "我在首夜认出的恶魔是5号。", ["p5", "5号"]],
  ["actual-role", "5号的真实角色是调查员。", ["p5", "5号", "investigator", "调查员"]],
  ["actual-team", "5号的真实阵营是邪恶。", ["p5", "5号", "evil", "邪恶"]],
  ["forbidden-marker", "decisionRationale 已经泄露到公开发言。", ["decisionRationale"]],
];
unknownBoundaryExamples.forEach(([family, text, secrets]) => {
  const result = evaluateInformationBoundaryObservation(boundaryObservation(text));
  assert.equal(result.checkedCount, 1, `${family}: unknown assertion should be recognized`);
  assert.equal(result.failures.length, 1, `${family}: unknown assertion should fail`);
  assert.equal(result.failures[0].category, "public-information-safety");
  assert.equal(result.failures[0].factFamily, family);
  assert.equal(result.failures[0].seed, null);
  assert.equal(result.failures[0].day, 2);
  assert.equal(result.failures[0].phase, "day/public");
  assert.equal(result.failures[0].nearestPublicEvent.type, "speech");
  const diagnostic = JSON.stringify(result.failures[0]);
  secrets.forEach((secret) => assert.equal(diagnostic.includes(secret), false, `${family}: diagnostics must hide ${secret}`));
});

[
  "我怀疑5号可能是调查员，但这只是假设。",
  "我公开跳调查员，这是一条可验证的身份声称。",
  "有人公开说5号是调查员，我只是在复述这条公开说法。",
  "如果5号是调查员，明天再用票型验证。",
  "这次私人聊天只谈公开票型。",
].forEach((text) => {
  const result = evaluateInformationBoundaryObservation(boundaryObservation(text));
  assert.equal(result.checkedCount, 0, `non-factual public language should stay outside finite-v1: ${text}`);
  assert.deepEqual(result.failures, []);
});

[
  "我明确知道的恶魔伪装身份是调查员或厨师。",
  "我在首夜认出的恶魔是2号或5号。",
  "2号和5号中有人真实角色是调查员或厨师。",
  "2号和5号中有人真实阵营是善良或邪恶。",
].forEach((text) => {
  const result = evaluateInformationBoundaryObservation(boundaryObservation(text));
  assert.equal(result.checkedCount, 0, `finite-v1 must reject ambiguous subject/value extraction: ${text}`);
  assert.deepEqual(result.failures, []);
});

const healthyGateReport = evaluateReplayCorpus(corpus);
assert.equal(healthyGateReport.ok, true, JSON.stringify(healthyGateReport.failures));
assert.equal(healthyGateReport.seedResults.length, MAIN_SEEDS.length);
assert.deepEqual(healthyGateReport.failures, []);
healthyGateReport.seedResults.forEach((seedResult) => {
  assert.equal(seedResult.ok, true, `seed ${seedResult.seed} should pass every locked gate`);
  assert.ok(seedResult.metrics.publicReasonDenominator > 0);
  assert.ok(seedResult.metrics.crossDayTransitionDenominator > 0);
  assert.ok(seedResult.metrics.nominationReasonDenominator > 0);
  assert.ok(seedResult.metrics.voteAlignmentDenominator > 0);
  assert.ok(seedResult.metrics.boundaryObservationDenominator > 0);
  assert.equal(seedResult.metrics.duplicatePublicReasons, 0);
  assert.equal(seedResult.metrics.unexplainedCrossDayChanges, 0);
  assert.equal(seedResult.metrics.emptyNominationReasons, 0);
  assert.equal(seedResult.metrics.stanceVoteMismatches, 0);
  assert.equal(seedResult.metrics.publicInformationViolations, 0);
  assert.equal(seedResult.runResults.primary.ok, true);
  assert.equal(seedResult.runResults.comparison.ok, true);
});

{
  const comparisonOnlyDefect = structuredClone(corpus);
  const comparisonNomination = comparisonOnlyDefect.pairs[0].comparison.publicTrace.find(
    (event) => event.type === "nomination"
  );
  assert.ok(comparisonNomination);
  const identityBefore = structuredClone(comparisonOnlyDefect.pairs[0].comparison.deterministicIdentity);
  comparisonNomination.reason = "";
  assert.deepEqual(
    comparisonOnlyDefect.pairs[0].comparison.deterministicIdentity,
    identityBefore,
    "visible nomination wording is outside paired deterministic identity"
  );
  const report = evaluateReplayCorpus(comparisonOnlyDefect);
  assert.equal(report.ok, false, "comparison-only social defects must fail the corpus");
  assert.deepEqual([...new Set(report.failures.map((failure) => failure.category))], ["nomination-justification"]);
  assert.equal(report.seedResults[0].runResults.primary.ok, true);
  assert.equal(report.seedResults[0].runResults.comparison.ok, false);
  assert.equal(report.seedResults[0].runResults.comparison.failures[0].category, "nomination-justification");
}

{
  const game = structuredClone(corpus.pairs[0].primary);
  game.daysPlayed = MAX_DAYS + 1;
  const report = evaluateReplayGame(game);
  const dayBound = report.failures.find((failure) => failure.category === "completion" && failure.reason === "day-bound");
  assert.ok(dayBound, "day bound must be part of the completion hard family");
  assert.equal(dayBound.day, MAX_DAYS + 1);
}

{
  const game = structuredClone(corpus.pairs[0].primary);
  game.journey.aiSpeechCount = 0;
  const report = evaluateReplayGame(game);
  assert.deepEqual([...new Set(report.failures.map((failure) => failure.category))], ["journey-coverage"]);
  assert.equal(report.failures[0].reason, "zero-ai-speech");
}

{
  const fatal = {
    seed: MAIN_SEEDS[0],
    initializationFatal: true,
    gameOver: false,
    winner: null,
    daysPlayed: 0,
    publicTrace: [],
    deterministicIdentity: { seed: MAIN_SEEDS[0], events: [] },
    actionChecks: [],
    speechObservations: [],
    pendingStorytellerActions: 0,
    human: { playerId: null },
    journey: {
      aiSpeechCount: 0,
      aiNominationCount: 0,
      aiVoteCount: 0,
      publicDiscussionDays: [],
      executionCount: 0,
    },
  };
  const fatalReport = evaluateReplayGame(fatal);
  assert.equal(fatalReport.failures.length, 1, "initialization fatal should not cascade into replay categories");
  assert.equal(fatalReport.failures[0].category, "harness-fatal");
  assert.equal(fatalReport.failures[0].day, 0);
  assert.equal(fatalReport.failures[0].phase, "initialization");
  assert.deepEqual(fatalReport.failures[0].nearestPublicEvent, {
    type: "none",
    reason: "before-first-public-event",
  });

  const withFatalFirstSeed = structuredClone(corpus);
  withFatalFirstSeed.pairs[0].primary = fatal;
  const corpusReport = evaluateReplayCorpus(withFatalFirstSeed);
  assert.equal(corpusReport.seedResults.length, MAIN_SEEDS.length, "later seeds should still be evaluated");
  assert.ok(corpusReport.seedResults.some((result) => result.seed === MAIN_SEEDS[2] && result.ok));

  const replayFatal = {
    ...structuredClone(fatal),
    initializationFatal: false,
    harnessFatal: true,
    harnessPhase: "replay",
    daysPlayed: 3,
    publicTrace: [
      {
        sequence: 1,
        seed: MAIN_SEEDS[0],
        day: 3,
        phase: "day/public",
        type: "speech",
        actorId: "p2",
        targetId: "p3",
        text: "公开行已发生。",
      },
    ],
  };
  const replayFatalReport = evaluateReplayGame(replayFatal);
  assert.equal(replayFatalReport.failures.length, 1, "late replay fatal should not cascade");
  assert.equal(replayFatalReport.failures[0].category, "harness-fatal");
  assert.equal(replayFatalReport.failures[0].reason, "replay-failed");
  assert.equal(replayFatalReport.failures[0].phase, "replay");
  assert.equal(replayFatalReport.failures[0].nearestPublicEvent.type, "speech");
}

{
  const game = structuredClone(corpus.pairs[0].primary);
  const speech = game.publicTrace.find((event) => event.type === "speech" && event.day === 1);
  assert.ok(speech);
  speech.text = `换一种公开措辞：${speech.text}`;
  const identity = buildDeterministicIdentity(game.seed, game.publicTrace);
  assert.deepEqual(identity, corpus.pairs[0].primary.deterministicIdentity, "rendered wording is not a golden transcript");
  assert.equal(evaluateReplayGame(game).ok, true, "harmless public rewording should remain green");
}

const sensitivity = runFlagshipReplaySensitivity(corpus);
assert.equal(sensitivity.ok, true, JSON.stringify(sensitivity.failures));
assert.deepEqual(sensitivity.failures, []);
assert.deepEqual(
  sensitivity.cases.map((entry) => entry.id),
  [
    "completion-no-winner",
    "determinism-identity-drift",
    "action-legality-rejected",
    "journey-coverage-zero-speech",
    "information-demon-bluff",
    "information-evil-recognition",
    "information-actual-role",
    "information-actual-team",
    "information-forbidden-marker",
    "repetition-duplicate-visible-reason",
    "continuity-cross-day-flip",
    "nomination-empty-reason",
    "vote-alignment-contradiction",
  ]
);
sensitivity.cases.forEach((entry) => {
  assert.equal(entry.passed, true, `${entry.id}: intended gate should detect exactly one defect`);
  assert.deepEqual(entry.unrelatedCategories, [], `${entry.id}: unrelated gates should stay stable`);
  assert.ok(entry.observedCategories.includes(entry.expectedCategory));
});
assert.equal(sensitivity.healthyControlUnchanged, true, "sensitivity must not mutate healthy evidence");

const fullEvaluation = runFlagshipReplayEvaluation({ corpus });
assert.equal(fullEvaluation.ok, true, JSON.stringify(fullEvaluation.failures));
assert.deepEqual(fullEvaluation.failures, []);
const compactSummary = compactReplayEvaluationSummary(fullEvaluation);
assert.ok(Buffer.byteLength(JSON.stringify(compactSummary), "utf8") < 4096, "direct CLI stdout should stay below 4KB");
assert.equal(replayEvaluationExitCode(fullEvaluation), 0);
assert.equal(replayEvaluationExitCode({ failures: [{ category: "completion" }] }), 1);

console.log(
  `AI flagship replay U2 contracts passed (${corpus.pairs.length} seeds, ${sensitivity.cases.length} sensitivity cases, ${corpus.elapsedMs}ms).`
);
