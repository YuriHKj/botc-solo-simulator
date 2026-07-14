import { pathToFileURL } from "node:url";

import {
  advanceDayStage,
  closeNominationWindow,
  createNewGame,
  endDayAndBeginNight,
  getPendingStorytellerActionState,
  markPublicDiscussionRound,
  openNominationWindow,
  resolveNominationAndVote,
  resolvePendingStorytellerAction,
  runNight,
  withSeededRandom,
} from "./engine.js";
import {
  chooseAINomination,
  createNominationDebate,
  decideAIVoteWithRationale,
  initializeAI,
  runAIDiscussion,
} from "./ai.js";
import { voteStanceFromText } from "./ai_statement_memory.js";

export const MAX_DAYS = 16;

// Predeclared before characterization. Main seeds are a journey-coverage subset of this finite list.
export const CANDIDATE_SEEDS = Object.freeze([260609, 260610, 260611, 260612, 260613]);
export const MAIN_SEEDS = Object.freeze([260609, 260610, 260611]);

export const FLAGSHIP_REPLAY_CONFIG = Object.freeze({
  scriptId: "tb",
  playerCount: 9,
  preferredHumanRoleId: "washerwoman",
  maxDays: MAX_DAYS,
  humanPolicy: Object.freeze({
    voteYes: true,
    nomination: "AI-only",
    publicSpeech: "none",
  }),
});

function publicSpeechKind(text, debateBeat = "") {
  if (debateBeat === "vote-intent" || /投票|上票|下票|票型|赞成|反对|不投/u.test(text)) {
    return "vote-intent";
  }
  if (debateBeat === "nomination-pressure" || /提名|上台/u.test(text)) {
    return "nomination-pressure";
  }
  if (debateBeat === "defense" || /防守|回应|自证|别锁/u.test(text)) {
    return "defense";
  }
  if (debateBeat === "challenge" || /怀疑|可疑|质疑|施压|压力/u.test(text)) {
    return "challenge";
  }
  return "discussion";
}

function publicEvidenceCategory(text) {
  if (/昨晚|夜里|夜间|信息/u.test(text)) return "night-information";
  if (/身份|角色|跳|报/u.test(text)) return "public-claim";
  if (/投票|票型|上票|下票/u.test(text)) return "public-vote";
  if (/发言|回应|口径|防守/u.test(text)) return "public-speech";
  return "table-pressure";
}

function sortedUnique(values) {
  return [...new Set(values)].sort((left, right) => left - right);
}

function compactReason(result) {
  return `${result?.reason ?? ""}`.replace(/\s+/g, " ").trim().slice(0, 180);
}

function createRecorder(seed) {
  const publicTrace = [];
  const actionChecks = [];
  const speechObservations = [];
  let traceSequence = 0;
  let actionSequence = 0;

  return {
    publicTrace,
    actionChecks,
    speechObservations,
    trace(event) {
      const retained = Object.freeze({
        sequence: ++traceSequence,
        seed,
        ...event,
      });
      publicTrace.push(retained);
      return retained;
    },
    action(state, action, accepted, result = null, details = {}) {
      const retained = Object.freeze({
        sequence: ++actionSequence,
        day: state?.day ?? 0,
        phase: state?.phase === "day" ? `day/${state.dayStage ?? ""}` : state?.phase ?? "",
        action,
        accepted: accepted === true,
        reason: accepted === true ? "" : compactReason(result),
        ...details,
      });
      actionChecks.push(retained);
      return retained;
    },
  };
}

function drainStorytellerQueue(state, recorder, context) {
  const drained = [];
  for (let index = 0; index < 8 && !state.gameOver; index += 1) {
    const pending = getPendingStorytellerActionState(state);
    if (!pending.available) {
      return drained;
    }
    const result = resolvePendingStorytellerAction(state, { auto: true });
    recorder.action(state, "resolve-storyteller-action", result.ok === true, result, {
      gateType: pending.type ?? "unknown",
      context,
    });
    if (!result.ok) {
      return drained;
    }
    drained.push(pending.type ?? "unknown");
  }
  return drained;
}

function endDayResolvingStorytellerGates(state, rng, recorder, context) {
  const storytellerTypes = [];
  for (let index = 0; index < 6 && !state.gameOver; index += 1) {
    const result = endDayAndBeginNight(state, rng);
    recorder.action(state, "end-day", result.ok === true, result, { context });
    if (!result.ok || result.stage !== "storyteller") {
      return { result, storytellerTypes };
    }
    storytellerTypes.push(...drainStorytellerQueue(state, recorder, `${context}/storyteller`));
  }
  return {
    result: state.gameOver
      ? { ok: true, stage: "ended", winner: state.winner }
      : { ok: false, reason: "Storyteller gates exceeded the bounded drain loop." },
    storytellerTypes,
  };
}

function traceNewExecutions(state, recorder, priorCount) {
  const executions = state.events?.executions ?? [];
  executions.slice(priorCount).forEach((execution) => {
    recorder.trace({
      day: execution.day ?? state.day ?? 0,
      phase: "day/day-end",
      type: "execution",
      actorId: execution.nominatorId ?? null,
      targetId: execution.nomineeId ?? null,
      died: execution.died !== false,
      reason: execution.reason === "vote-execution" ? "vote-execution" : "public-day-resolution",
    });
  });
}

function resolveAIDebateAndVote(state, proposal, rng, recorder) {
  const debateResult = createNominationDebate(
    state,
    {
      nominatorId: proposal.nominatorId,
      nomineeId: proposal.nomineeId,
      reason: proposal.reason ?? "",
      source: "ai_flagship_replay",
    },
    rng
  );
  recorder.action(state, "create-nomination-debate", debateResult.ok === true, debateResult, {
    actorId: proposal.nominatorId,
    targetId: proposal.nomineeId,
  });

  const debate = debateResult.debate ?? null;
  if (!debateResult.ok || !debate) {
    return { debateResult, voteResult: null };
  }

  recorder.trace({
    day: state.day ?? 0,
    phase: "day/nomination",
    type: "nomination",
    actorId: debate.nominatorId,
    targetId: debate.nomineeId,
    reason: `${debate.reason ?? ""}`,
    defense: `${debate.lines?.find((line) => line.role === "nominee")?.text ?? ""}`,
  });

  const closeResult = closeNominationWindow(state, {
    status: "nomination-made",
    actorId: proposal.nominatorId,
    intent: "ai-flagship-replay",
  });
  recorder.action(state, "close-nomination-window", closeResult.ok === true, closeResult, {
    actorId: proposal.nominatorId,
  });

  const executionsBeforeVote = state.events?.executions?.length ?? 0;
  let voteResult;
  try {
    voteResult = resolveNominationAndVote(
      state,
      {
        nominatorId: debate.nominatorId,
        nomineeId: debate.nomineeId,
        humanVoteYes: FLAGSHIP_REPLAY_CONFIG.humanPolicy.voteYes,
        decideAIVote: (voter, nominee, voteState) => decideAIVoteWithRationale(voter, nominee, voteState, rng),
        nominationAlreadyAccepted: true,
      },
      rng
    );
  } finally {
    debate.active = false;
    debate.resolved = voteResult?.accepted === true;
    debate.voteResult = voteResult?.accepted
      ? {
          passed: voteResult.passed === true,
          yesVotes: voteResult.yesVotes ?? 0,
          threshold: voteResult.threshold ?? 0,
        }
      : null;
    state.dayStageMeta.nominationDebate = debate;
  }

  const executionRecordedImmediately = (state.events?.executions?.length ?? 0) !== executionsBeforeVote;
  recorder.action(state, "resolve-nomination-vote", voteResult?.accepted === true, voteResult, {
    actorId: debate.nominatorId,
    targetId: debate.nomineeId,
    nominationAlreadyAccepted: true,
    debateActiveAfter: debate.active === true,
    executionRecordedImmediately,
  });

  if (voteResult?.accepted) {
    recorder.trace({
      day: state.day ?? 0,
      phase: "day/nomination",
      type: "vote",
      actorId: debate.nominatorId,
      targetId: debate.nomineeId,
      yesVotes: voteResult.yesVotes ?? 0,
      threshold: voteResult.threshold ?? 0,
      passed: voteResult.passed === true,
      votes: (voteResult.votes ?? []).map((vote) => ({
        actorId: vote.voterId,
        vote: vote.vote === true,
        abstain: vote.abstain === true,
      })),
    });
  }
  return { debateResult, voteResult };
}

export function buildDeterministicIdentity(seed, publicTrace) {
  const events = (publicTrace ?? []).map((event) => {
    const base = {
      sequence: event.sequence,
      day: event.day,
      phase: event.phase,
      type: event.type,
      actorId: event.actorId ?? null,
      targetId: event.targetId ?? null,
    };
    if (event.type === "speech") {
      return {
        ...base,
        speechKind: event.speechKind,
        parsedStance: event.parsedStance,
        publicEvidenceCategory: event.publicEvidenceCategory,
      };
    }
    if (event.type === "vote") {
      return {
        ...base,
        yesVotes: event.yesVotes,
        threshold: event.threshold,
        passed: event.passed,
        votes: event.votes.map((vote) => ({ ...vote })),
      };
    }
    if (event.type === "execution") {
      return { ...base, died: event.died };
    }
    if (event.type === "winner") {
      return { ...base, winner: event.winner };
    }
    return base;
  });
  return { seed, events };
}

function buildJourney(publicTrace, humanId) {
  const speeches = publicTrace.filter((event) => event.type === "speech" && event.actorId !== humanId);
  const nominations = publicTrace.filter((event) => event.type === "nomination" && event.actorId !== humanId);
  const votes = publicTrace.filter((event) => event.type === "vote");
  const aiVoteCount = votes.reduce(
    (count, event) => count + event.votes.filter((vote) => vote.actorId !== humanId && !vote.abstain).length,
    0
  );
  return {
    aiSpeechCount: speeches.length,
    aiNominationCount: nominations.length,
    aiVoteCount,
    publicDiscussionDays: sortedUnique(speeches.map((event) => event.day)),
    executionCount: publicTrace.filter((event) => event.type === "execution").length,
  };
}

function buildAIMetricEvents(publicTrace, humanId) {
  const events = [];
  publicTrace.forEach((event) => {
    if (event.type === "speech" && event.actorId !== humanId) {
      events.push({
        type: "speech",
        day: event.day,
        actorId: event.actorId,
        targetId: event.targetId,
        stance: event.parsedStance,
      });
    }
    if (event.type === "vote") {
      event.votes
        .filter((vote) => vote.actorId !== humanId && !vote.abstain)
        .forEach((vote) => {
          events.push({
            type: "vote-stance",
            day: event.day,
            actorId: vote.actorId,
            targetId: event.targetId,
            stance: vote.vote ? "support" : "oppose",
          });
        });
    }
  });
  return events;
}

export function runFlagshipReplay(seed) {
  if (!CANDIDATE_SEEDS.includes(seed)) {
    throw new Error(`Seed ${seed} is outside the predeclared flagship candidate set.`);
  }
  const rng = withSeededRandom(seed);
  const state = createNewGame(
    {
      scriptId: FLAGSHIP_REPLAY_CONFIG.scriptId,
      playerCount: FLAGSHIP_REPLAY_CONFIG.playerCount,
      preferredHumanRoleId: FLAGSHIP_REPLAY_CONFIG.preferredHumanRoleId,
    },
    rng
  );
  const recorder = createRecorder(seed);
  const human = state.players.find((player) => player.isHuman);
  let daysPlayed = 0;

  initializeAI(state);
  const firstNight = runNight(state, rng);
  recorder.action(state, "run-first-night", firstNight !== false && firstNight?.ok !== false, firstNight);
  if (firstNight?.stage === "storyteller") {
    drainStorytellerQueue(state, recorder, `seed ${seed} first-night`);
  }
  initializeAI(state);

  for (let dayIndex = 0; dayIndex < MAX_DAYS && !state.gameOver; dayIndex += 1) {
    daysPlayed = Math.max(daysPlayed, state.day ?? dayIndex + 1);
    if (state.phase !== "day") {
      recorder.action(state, "expect-day-phase", false, { reason: `Expected day, received ${state.phase}.` });
      break;
    }

    if (state.dayStage === "private") {
      const stage = advanceDayStage(state, "public");
      recorder.action(state, "advance-to-public", stage.ok === true, stage);
      if (!stage.ok) break;
    }

    const discussionRound = markPublicDiscussionRound(state);
    recorder.action(state, "mark-public-discussion", discussionRound === true, {
      reason: discussionRound ? "" : "Public discussion round was rejected.",
    });
    if (!discussionRound) break;

    runAIDiscussion(state, rng, {
      onPublicSpeech(observation) {
        const { visibleEvent, agentView } = observation;
        recorder.speechObservations.push(observation);
        recorder.trace({
          day: visibleEvent.day,
          phase: visibleEvent.phase,
          type: "speech",
          actorId: visibleEvent.speakerId,
          targetId: visibleEvent.focusId,
          text: visibleEvent.text,
          speechKind: publicSpeechKind(visibleEvent.text, visibleEvent.debateBeat),
          parsedStance: voteStanceFromText(visibleEvent.text) || "undecided",
          publicEvidenceCategory: publicEvidenceCategory(visibleEvent.text),
        });
        if (agentView?.viewerId !== visibleEvent.speakerId) {
          recorder.action(state, "observe-public-speech", false, { reason: "Observer speaker/view mismatch." });
        }
      },
    });
    recorder.action(state, "run-ai-discussion", true);

    if (state.dayStage === "public") {
      const stage = advanceDayStage(state, "nomination");
      recorder.action(state, "advance-to-nomination", stage.ok === true, stage);
      if (!stage.ok) break;
    }

    for (let nominationIndex = 0; nominationIndex < 20 && !state.gameOver; nominationIndex += 1) {
      const windowResult = openNominationWindow(state, {
        ticks: 4,
        actorId: null,
        intent: "ai-flagship-replay",
      });
      recorder.action(state, "open-nomination-window", windowResult.ok === true, windowResult);
      if (!windowResult.ok) break;

      const proposal = chooseAINomination(state);
      if (!proposal) {
        const closeResult = closeNominationWindow(state, {
          status: "passed",
          actorId: null,
          intent: "ai-flagship-replay-no-proposal",
        });
        recorder.action(state, "close-nomination-window", closeResult.ok === true, closeResult);
        break;
      }

      const { debateResult, voteResult } = resolveAIDebateAndVote(state, proposal, rng, recorder);
      if (!debateResult.ok || !debateResult.debate || !voteResult?.accepted) {
        break;
      }
    }

    if (state.gameOver) break;

    const executionsBeforeDayEnd = state.events?.executions?.length ?? 0;
    const { result: dayEnd } = endDayResolvingStorytellerGates(
      state,
      rng,
      recorder,
      `seed ${seed} day ${state.day}`
    );
    traceNewExecutions(state, recorder, executionsBeforeDayEnd);
    if (!dayEnd.ok || state.gameOver) break;
    if (dayEnd.stage !== "night") {
      recorder.action(state, "expect-night-stage", false, { reason: `Expected night, received ${dayEnd.stage}.` });
      break;
    }

    const nightResult = runNight(state, rng);
    recorder.action(state, "run-night", nightResult !== false && nightResult?.ok !== false, nightResult);
    if (nightResult?.stage === "storyteller") {
      drainStorytellerQueue(state, recorder, `seed ${seed} night ${state.night}`);
    }
    initializeAI(state);
  }

  if (state.gameOver && ["good", "evil"].includes(state.winner)) {
    recorder.trace({
      day: state.day ?? daysPlayed,
      phase: "ended",
      type: "winner",
      actorId: null,
      targetId: null,
      winner: state.winner,
    });
  }

  const journey = buildJourney(recorder.publicTrace, human?.id ?? null);
  return {
    seed,
    winner: state.winner ?? null,
    gameOver: state.gameOver === true,
    daysPlayed,
    publicTrace: recorder.publicTrace,
    deterministicIdentity: buildDeterministicIdentity(seed, recorder.publicTrace),
    actionChecks: recorder.actionChecks,
    speechObservations: recorder.speechObservations,
    pendingStorytellerActions: state.pendingStorytellerActions?.length ?? 0,
    human: {
      playerId: human?.id ?? null,
      preferredRoleId: FLAGSHIP_REPLAY_CONFIG.preferredHumanRoleId,
      policy: { ...FLAGSHIP_REPLAY_CONFIG.humanPolicy },
    },
    aiMetricEvents: buildAIMetricEvents(recorder.publicTrace, human?.id ?? null),
    journey,
  };
}

export function evaluateActionLegality(actionChecks) {
  return (actionChecks ?? [])
    .filter((check) => check.accepted !== true)
    .map((check) => ({
      category: "action-legality",
      sequence: check.sequence ?? null,
      day: check.day ?? null,
      phase: check.phase ?? "",
      action: check.action ?? "unknown",
      reason: check.reason ?? "rejected",
    }));
}

export function evaluateJourneyCoverage(game, { requireCrossDay = false } = {}) {
  const failures = [];
  if (!game?.gameOver || !["good", "evil"].includes(game?.winner)) {
    failures.push({ category: "completion", seed: game?.seed ?? null });
  }
  if ((game?.daysPlayed ?? MAX_DAYS + 1) > MAX_DAYS) {
    failures.push({ category: "day-bound", seed: game?.seed ?? null });
  }
  if ((game?.journey?.aiSpeechCount ?? 0) <= 0) {
    failures.push({ category: "ai-speech-coverage", seed: game?.seed ?? null });
  }
  if ((game?.journey?.aiNominationCount ?? 0) <= 0) {
    failures.push({ category: "ai-nomination-coverage", seed: game?.seed ?? null });
  }
  if ((game?.journey?.aiVoteCount ?? 0) <= 0) {
    failures.push({ category: "ai-vote-coverage", seed: game?.seed ?? null });
  }
  if ((game?.pendingStorytellerActions ?? 0) > 0) {
    failures.push({ category: "storyteller-gate", seed: game?.seed ?? null });
  }
  if (requireCrossDay && (game?.journey?.publicDiscussionDays?.length ?? 0) < 2) {
    failures.push({ category: "cross-day-coverage", seed: game?.seed ?? null });
  }
  return [...failures, ...evaluateActionLegality(game?.actionChecks)];
}

export function evaluateCorpusJourneyCoverage(corpus) {
  const failures = [];
  if ((corpus?.pairs?.length ?? 0) !== 3) {
    failures.push({ category: "corpus-size", expected: 3, actual: corpus?.pairs?.length ?? 0 });
  }
  (corpus?.pairs ?? []).forEach((pair) => {
    failures.push(...evaluateJourneyCoverage(pair.primary));
    if (!pair.identityMatches) failures.push({ category: "determinism", seed: pair.seed });
    if (!pair.winnerMatches) failures.push({ category: "winner-determinism", seed: pair.seed });
  });
  if (!(corpus?.pairs ?? []).some((pair) => pair.primary.journey.publicDiscussionDays.length >= 2)) {
    failures.push({ category: "cross-day-coverage", seed: null });
  }
  return failures;
}

export function runFlagshipReplayCorpus() {
  const startedAt = Date.now();
  const pairs = MAIN_SEEDS.map((seed) => {
    const primary = runFlagshipReplay(seed);
    const comparison = runFlagshipReplay(seed);
    return {
      seed,
      primary,
      comparison,
      identityMatches:
        JSON.stringify(primary.deterministicIdentity) === JSON.stringify(comparison.deterministicIdentity),
      winnerMatches: primary.winner === comparison.winner,
    };
  });
  const corpus = {
    config: {
      ...FLAGSHIP_REPLAY_CONFIG,
      candidateSeeds: [...CANDIDATE_SEEDS],
      mainSeeds: [...MAIN_SEEDS],
    },
    pairs,
    elapsedMs: Date.now() - startedAt,
  };
  return { ...corpus, failures: evaluateCorpusJourneyCoverage(corpus) };
}

function compactCliSummary(corpus) {
  return {
    ok: corpus.failures.length === 0,
    seeds: corpus.pairs.map((pair) => ({
      seed: pair.seed,
      winner: pair.primary.winner,
      days: pair.primary.daysPlayed,
      speeches: pair.primary.journey.aiSpeechCount,
      nominations: pair.primary.journey.aiNominationCount,
      votes: pair.primary.journey.aiVoteCount,
      deterministic: pair.identityMatches && pair.winnerMatches,
    })),
    elapsedMs: corpus.elapsedMs,
    failures: corpus.failures,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const corpus = runFlagshipReplayCorpus();
  console.log(JSON.stringify(compactCliSummary(corpus)));
  if (corpus.failures.length > 0) process.exitCode = 1;
}
