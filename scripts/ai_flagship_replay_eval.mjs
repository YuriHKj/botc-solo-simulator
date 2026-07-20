import { pathToFileURL } from "node:url";

import { getAllRoles, getRoleById } from "./data.js";
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

export const INFORMATION_BOUNDARY_FACT_FAMILIES = Object.freeze([
  "demon-bluff",
  "evil-recognition",
  "actual-role",
  "actual-team",
  "forbidden-marker",
]);

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.values(value).forEach((child) => deepFreeze(child));
  return Object.freeze(value);
}

// Frozen from the untouched U1 AI corpus before any runtime behavior correction.
// The one unexplained target change per seed is intentionally not grandfathered in:
// it is a categorical coherence defect and therefore locks a zero-tolerance gate.
export const FLAGSHIP_REPLAY_THRESHOLDS = deepFreeze({
  freezePoint: "untouched-u1-ai-before-runtime-correction",
  maxDays: MAX_DAYS,
  mainSeeds: [...MAIN_SEEDS],
  maximumViolations: {
    completion: 0,
    determinism: 0,
    actionLegality: 0,
    publicInformationSafety: 0,
    duplicatePublicReasons: 0,
    unexplainedCrossDayChanges: 0,
    emptyNominationReasons: 0,
    stanceVoteMismatches: 0,
  },
  minimumDenominators: {
    publicReasons: 1,
    crossDayTransitions: 1,
    nominationReasons: 1,
    voteAlignment: 1,
    boundaryObservations: 1,
  },
  formulas: {
    hardBlockers: "required invariant: observed failures must equal 0",
    repetition: "max(untouched baseline duplicate reasons=0, required invariant=0) => 0",
    continuity: "unexplained target/decisive-stance change is categorical => 0; baseline defects require correction",
    nomination: "max(untouched baseline empty reasons=0, required invariant=0) => 0",
    voteAlignment: "max(untouched baseline parsed mismatches=0, required invariant=0) => 0",
    nonVacuous: "untouched minimum denominator > 0 => locked floor of 1",
  },
  baselineRaw: [
    {
      seed: 260609,
      winner: "evil",
      days: 4,
      aiSpeeches: 32,
      aiNominations: 7,
      aiVotes: 54,
      boundaryObservations: 32,
      duplicatePublicReasons: 0,
      crossDayTransitions: 24,
      crossDayChanges: 20,
      unexplainedCrossDayChanges: 1,
      nominationReasons: 7,
      emptyNominationReasons: 0,
      visibleVoteStatements: 47,
      voteAlignmentDenominator: 45,
      stanceVoteMismatches: 0,
    },
    {
      seed: 260610,
      winner: "evil",
      days: 4,
      aiSpeeches: 32,
      aiNominations: 7,
      aiVotes: 53,
      boundaryObservations: 32,
      duplicatePublicReasons: 0,
      crossDayTransitions: 24,
      crossDayChanges: 8,
      unexplainedCrossDayChanges: 1,
      nominationReasons: 7,
      emptyNominationReasons: 0,
      visibleVoteStatements: 46,
      voteAlignmentDenominator: 38,
      stanceVoteMismatches: 0,
    },
    {
      seed: 260611,
      winner: "evil",
      days: 4,
      aiSpeeches: 32,
      aiNominations: 6,
      aiVotes: 45,
      boundaryObservations: 32,
      duplicatePublicReasons: 0,
      crossDayTransitions: 24,
      crossDayChanges: 8,
      unexplainedCrossDayChanges: 1,
      nominationReasons: 6,
      emptyNominationReasons: 0,
      visibleVoteStatements: 39,
      voteAlignmentDenominator: 32,
      stanceVoteMismatches: 0,
    },
  ],
});

const CROSS_DAY_PRIOR_REFERENCE_PATTERN = /(昨天|前天|\d+天前|记忆连续性)/iu;
const CROSS_DAY_EXPLICIT_REVISION_PATTERN =
  /(新线索|新变化|重新|转向|转到|先转|改口|改看|改投|修正|不等于放掉|because|changed|revise)/iu;
const CROSS_DAY_CONTINUITY_RELATION_PATTERN = /(仍按|继续|沿着|不换|不改)/iu;

const FORBIDDEN_PUBLIC_MARKERS = Object.freeze([
  Object.freeze({ id: "private-rationale", aliases: Object.freeze(["decisionrationale", "strategyrationale"]) }),
  Object.freeze({ id: "evidence-contract", aliases: Object.freeze(["evidencecontract"]) }),
  Object.freeze({ id: "agent-view", aliases: Object.freeze(["agentview"]) }),
  Object.freeze({ id: "backend-payload", aliases: Object.freeze(["js core", "backend payload", "modelscore"]) }),
  Object.freeze({ id: "hidden-state", aliases: Object.freeze(["hiddenroleid", "privateinfo", "内部推理状态"]) }),
]);

function normalizedVisibleText(value) {
  return `${value ?? ""}`.normalize("NFKC").replace(/\s+/g, " ").trim();
}

function hasCrossDayRevisionExplanation(value) {
  const normalized = normalizedVisibleText(value);
  if (CROSS_DAY_EXPLICIT_REVISION_PATTERN.test(normalized)) return true;
  return (
    CROSS_DAY_PRIOR_REFERENCE_PATTERN.test(normalized) &&
    CROSS_DAY_CONTINUITY_RELATION_PATTERN.test(normalized)
  );
}

function publicReasonFingerprint(value) {
  return normalizedVisibleText(value)
    .toLocaleLowerCase("zh-CN")
    .replace(/[\s\p{P}\p{S}]+/gu, "");
}

function parsedPublicVoteStance(value) {
  const text = normalizedVisibleText(value);
  if (
    /(不落票|先不落|不举|留票|不投|不跟|不出|放下|不够处决|别[^。；]{0,12}落死票|反对|弃票|不能投)/u.test(
      text
    )
  ) {
    return "oppose";
  }
  if (/(会投|继续落|这票[^。；]{0,20}(?:落|给|投)|落票|推进处决|赞成|支持|鬼票[^。；]{0,12}投)/u.test(text)) {
    return "support";
  }
  return "undecided";
}

function parsedPublicDiscussionStance(value) {
  const voteStance = parsedPublicVoteStance(value);
  if (voteStance !== "undecided") return voteStance;
  const text = normalizedVisibleText(value);
  if (/(赞成|会投|支持|提名|推进|上票|落票)/u.test(text)) return "support";
  if (/(反对|不投|弃票|反处决)/u.test(text)) return "oppose";
  return "undecided";
}

function safePublicEvent(event = null) {
  if (!event) return { type: "none", reason: "before-first-public-event" };
  return {
    type: event.type ?? "unknown",
    sequence: Number.isFinite(event.sequence) ? event.sequence : null,
    actorId: event.actorId ?? event.speakerId ?? null,
    targetId: event.targetId ?? event.focusId ?? null,
  };
}

function nearestPublicEvent(game, event = null, day = null) {
  if (event) return safePublicEvent(event);
  const trace = game?.publicTrace ?? [];
  const eligible = Number.isFinite(day) ? trace.filter((entry) => (entry.day ?? 0) <= day) : trace;
  return safePublicEvent(eligible.at(-1) ?? null);
}

function gateFailure(game, category, reason, event = null, overrides = {}) {
  const day = overrides.day ?? event?.day ?? game?.daysPlayed ?? 0;
  const phase = overrides.phase ?? event?.phase ?? (day === 0 ? "initialization" : "unknown");
  return {
    seed: overrides.seed ?? game?.seed ?? null,
    day,
    phase,
    category,
    reason,
    nearestPublicEvent: overrides.nearestPublicEvent ?? nearestPublicEvent(game, event, day),
    ...(overrides.factFamily ? { factFamily: overrides.factFamily } : {}),
    ...(overrides.diagnostic ? { diagnostic: overrides.diagnostic } : {}),
  };
}

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

const SAFE_HARNESS_ERROR_TYPES = new Set([
  "Error",
  "TypeError",
  "RangeError",
  "ReferenceError",
  "SyntaxError",
  "EvalError",
  "URIError",
  "AggregateError",
]);

function safeHarnessDiagnostic(error, failureContext) {
  const errorType = `${error?.name ?? "Error"}`.trim();
  return Object.freeze({
    errorType: SAFE_HARNESS_ERROR_TYPES.has(errorType) ? errorType : "Error",
    lastAction: failureContext?.actionChecks?.at(-1)?.action ?? "none",
  });
}

function roleAliases(role) {
  return [role?.id, role?.name, role?.englishName]
    .map((value) => normalizedVisibleText(value).toLocaleLowerCase("zh-CN"))
    .filter(Boolean);
}

function rolesNamedInText(text, scriptId) {
  const normalized = normalizedVisibleText(text).toLocaleLowerCase("zh-CN");
  return getAllRoles(scriptId).filter((role) => roleAliases(role).some((alias) => normalized.includes(alias)));
}

function agentTargets(agentView) {
  const targets = Array.isArray(agentView?.targets) ? agentView.targets : Object.values(agentView?.targetById ?? {});
  const unique = new Map();
  targets.forEach((target) => {
    if (target?.id && !unique.has(target.id)) unique.set(target.id, target);
  });
  return [...unique.values()];
}

function playerAliases(target) {
  const seat = Number.isFinite(target?.seatIndex) ? target.seatIndex + 1 : null;
  return [target?.id, target?.name, seat ? `${seat}号` : "", seat ? `#${seat}` : ""]
    .map((value) => normalizedVisibleText(value).toLocaleLowerCase("zh-CN"))
    .filter(Boolean);
}

function playersNamedInText(text, agentView) {
  const normalized = normalizedVisibleText(text).toLocaleLowerCase("zh-CN");
  return agentTargets(agentView).filter((target) => playerAliases(target).some((alias) => normalized.includes(alias)));
}

function publicRoleRevealMap(agentView) {
  const reveals = new Map();
  (agentView?.visibleClaims ?? []).forEach((claim) => {
    if (claim?.private !== true && claim?.playerId && claim?.roleId) reveals.set(claim.playerId, claim.roleId);
  });
  agentTargets(agentView).forEach((target) => {
    if (target?.id && target?.publicClaimRoleId) reveals.set(target.id, target.publicClaimRoleId);
  });
  return reveals;
}

function boundaryKnowledge(observation) {
  const agentView = observation?.agentView ?? {};
  const legalKnowledge = observation?.legalKnowledge ?? null;
  const hasLegalKnowledge = !!legalKnowledge && typeof legalKnowledge === "object";
  const knownDemonIds = [hasLegalKnowledge ? legalKnowledge.knownDemonId : agentView?.knownDemonId].filter(Boolean);
  const knownMinionIds = [
    ...(hasLegalKnowledge ? legalKnowledge.knownMinionIds ?? [] : agentView?.knownMinionIds ?? []),
  ].filter(Boolean);
  const knownAllyIds = [
    ...(hasLegalKnowledge ? legalKnowledge.knownAllyIds ?? [] : agentView?.knownAllies ?? []),
  ].filter(Boolean);
  const publicRoleReveals = publicRoleRevealMap(agentView);
  (legalKnowledge?.publicRoleReveals ?? []).forEach((reveal) => {
    if (reveal?.playerId && reveal?.roleId) publicRoleReveals.set(reveal.playerId, reveal.roleId);
  });
  return {
    selfId: legalKnowledge?.viewerId ?? agentView?.self?.id ?? agentView?.viewerId ?? null,
    selfRoleId:
      legalKnowledge?.self?.roleId ?? agentView?.self?.roleKnownToSelf ?? agentView?.self?.perceivedRoleId ?? null,
    selfTeam: legalKnowledge?.self?.team ?? agentView?.self?.teamKnownToSelf ?? null,
    knownEvilIds: new Set([...knownDemonIds, ...knownMinionIds, ...knownAllyIds]),
    knownBluffRoleIds: new Set(
      hasLegalKnowledge ? legalKnowledge.knownBluffRoleIds ?? [] : agentView?.knownBluffRoleIds ?? []
    ),
    publicRoleReveals,
  };
}

function detectBoundaryAssertions(observation, scriptId) {
  const visibleEvent = observation?.visibleEvent ?? {};
  const agentView = observation?.agentView ?? {};
  const text = normalizedVisibleText(visibleEvent.text);
  const lower = text.toLocaleLowerCase("zh-CN");
  const roles = rolesNamedInText(text, scriptId);
  const players = playersNamedInText(text, agentView);
  const assertions = [];

  if (/(恶魔(?:的)?(?:伪装|诈身份|假身份)|恶魔收到的伪装|demon\s+bluff)/iu.test(text)) {
    if (roles.length === 1) assertions.push({ family: "demon-bluff", roleId: roles[0].id });
  }

  if (/(认出的|已知的?|首夜认出|recognition)[^。；]{0,24}(恶魔|爪牙|邪恶同伴|evil\s+ally|demon|minion)/iu.test(text)) {
    if (players.length === 1) assertions.push({ family: "evil-recognition", playerId: players[0].id });
  }

  if (/(真实角色|真正身份|实际身份|actual\s+role|true\s+role)/iu.test(text)) {
    if (players.length === 1 && roles.length === 1) {
      assertions.push({ family: "actual-role", playerId: players[0].id, roleId: roles[0].id });
    }
  }

  if (/(真实阵营|真正阵营|实际阵营|actual\s+team|true\s+team)/iu.test(text)) {
    const teams = new Set();
    if (/(邪恶|evil)/iu.test(text)) teams.add("evil");
    if (/(善良|好人|good)/iu.test(text)) teams.add("good");
    if (players.length === 1 && teams.size === 1) {
      assertions.push({ family: "actual-team", playerId: players[0].id, team: [...teams][0] });
    }
  }

  FORBIDDEN_PUBLIC_MARKERS.forEach((marker) => {
    if (marker.aliases.some((alias) => lower.includes(alias))) {
      assertions.push({ family: "forbidden-marker", markerId: marker.id });
    }
  });

  const unique = new Map();
  assertions.forEach((assertion) => {
    const key = `${assertion.family}:${assertion.playerId ?? ""}:${assertion.roleId ?? ""}:${assertion.team ?? ""}:${
      assertion.markerId ?? ""
    }`;
    if (!unique.has(key)) unique.set(key, assertion);
  });
  return [...unique.values()];
}

function boundaryAssertionAuthorized(assertion, observation, scriptId) {
  const knowledge = boundaryKnowledge(observation);
  if (assertion.family === "demon-bluff") {
    return knowledge.knownBluffRoleIds.has(assertion.roleId);
  }
  if (assertion.family === "evil-recognition") {
    return assertion.playerId === knowledge.selfId || knowledge.knownEvilIds.has(assertion.playerId);
  }
  if (assertion.family === "actual-role") {
    if (assertion.playerId === knowledge.selfId && assertion.roleId === knowledge.selfRoleId) return true;
    return knowledge.publicRoleReveals.get(assertion.playerId) === assertion.roleId;
  }
  if (assertion.family === "actual-team") {
    if (assertion.playerId === knowledge.selfId && assertion.team === knowledge.selfTeam) return true;
    if (assertion.team === "evil" && knowledge.knownEvilIds.has(assertion.playerId)) return true;
    const publicRoleId = knowledge.publicRoleReveals.get(assertion.playerId);
    return !!publicRoleId && getRoleById(scriptId, publicRoleId)?.team === assertion.team;
  }
  return false;
}

export function evaluateInformationBoundaryObservation(observation, { seed = null, scriptId = "tb" } = {}) {
  const assertions = detectBoundaryAssertions(observation, scriptId);
  const familyCounts = Object.fromEntries(INFORMATION_BOUNDARY_FACT_FAMILIES.map((family) => [family, 0]));
  const visibleEvent = observation?.visibleEvent ?? {};
  const safeGame = { seed, daysPlayed: visibleEvent.day ?? 0, publicTrace: [] };
  const safeEvent = {
    type: "speech",
    sequence: visibleEvent.sequence ?? null,
    day: visibleEvent.day ?? 0,
    phase: visibleEvent.phase ?? "day/public",
    actorId: visibleEvent.speakerId ?? null,
    targetId: visibleEvent.focusId ?? null,
  };
  const failures = [];
  assertions.forEach((assertion) => {
    familyCounts[assertion.family] += 1;
    if (!boundaryAssertionAuthorized(assertion, observation, scriptId)) {
      failures.push(
        gateFailure(safeGame, "public-information-safety", "unknown-fact", safeEvent, {
          seed,
          factFamily: assertion.family,
        })
      );
    }
  });
  return {
    checkedCount: assertions.length,
    familyCounts,
    failures,
  };
}

function rememberReplayProgress(failureContext, day, phase) {
  if (!failureContext) return;
  if (Number.isFinite(day)) failureContext.daysPlayed = Math.max(failureContext.daysPlayed ?? 0, day);
  if (phase) failureContext.lastObservedPhase = phase;
}

function createRecorder(seed, failureContext = null) {
  const publicTrace = failureContext?.publicTrace ?? [];
  const actionChecks = failureContext?.actionChecks ?? [];
  const speechObservations = failureContext?.speechObservations ?? [];
  let traceSequence = 0;
  let actionSequence = 0;

  if (failureContext) {
    failureContext.publicTrace = publicTrace;
    failureContext.actionChecks = actionChecks;
    failureContext.speechObservations = speechObservations;
  }

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
      rememberReplayProgress(failureContext, retained.day, retained.phase);
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
      rememberReplayProgress(failureContext, retained.day, retained.phase);
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
    (voteResult.votes ?? [])
      .filter((vote) => !vote.abstain && `${vote.voteRationale?.line ?? ""}`.trim())
      .forEach((vote) => {
        const text = `${vote.voteRationale.line}`.replace(/\s+/g, " ").trim();
        recorder.trace({
          day: state.day ?? 0,
          phase: "day/nomination",
          type: "vote-statement",
          actorId: vote.voterId,
          targetId: debate.nomineeId,
          text,
          parsedStance: parsedPublicVoteStance(text),
        });
      });
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
    if (event.type === "vote-statement") {
      return {
        ...base,
        parsedStance: event.parsedStance,
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

export function runFlagshipReplay(seed, { failureContext = null } = {}) {
  if (!CANDIDATE_SEEDS.includes(seed)) {
    throw new Error(`Seed ${seed} is outside the predeclared flagship candidate set.`);
  }
  const recorder = createRecorder(seed, failureContext);
  const rng = withSeededRandom(seed);
  const state = createNewGame(
    {
      scriptId: FLAGSHIP_REPLAY_CONFIG.scriptId,
      playerCount: FLAGSHIP_REPLAY_CONFIG.playerCount,
      preferredHumanRoleId: FLAGSHIP_REPLAY_CONFIG.preferredHumanRoleId,
    },
    rng
  );
  const human = state.players.find((player) => player.isHuman);
  let daysPlayed = 0;

  initializeAI(state);
  const firstNight = runNight(state, rng);
  recorder.action(state, "run-first-night", firstNight !== false && firstNight?.ok !== false, firstNight);
  if (firstNight?.stage === "storyteller") {
    drainStorytellerQueue(state, recorder, `seed ${seed} first-night`);
  }
  initializeAI(state);
  if (failureContext) failureContext.harnessPhase = "replay";

  for (let dayIndex = 0; dayIndex < MAX_DAYS && !state.gameOver; dayIndex += 1) {
    daysPlayed = Math.max(daysPlayed, state.day ?? dayIndex + 1);
    rememberReplayProgress(failureContext, daysPlayed, state.phase === "day" ? `day/${state.dayStage ?? ""}` : state.phase);
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

function replayInitializationFatal(seed) {
  return {
    seed,
    initializationFatal: true,
    winner: null,
    gameOver: false,
    daysPlayed: 0,
    publicTrace: [],
    deterministicIdentity: { seed, events: [] },
    actionChecks: [],
    speechObservations: [],
    pendingStorytellerActions: 0,
    human: { playerId: null, preferredRoleId: FLAGSHIP_REPLAY_CONFIG.preferredHumanRoleId, policy: {} },
    journey: {
      aiSpeechCount: 0,
      aiNominationCount: 0,
      aiVoteCount: 0,
      publicDiscussionDays: [],
      executionCount: 0,
    },
  };
}

function replayHarnessFatal(seed, phase = "replay", failureContext = null, error = null) {
  const base = replayInitializationFatal(seed);
  const publicTrace = [...(failureContext?.publicTrace ?? [])];
  return {
    ...base,
    initializationFatal: false,
    harnessFatal: true,
    harnessPhase: phase,
    daysPlayed: failureContext?.daysPlayed ?? 0,
    publicTrace,
    actionChecks: [...(failureContext?.actionChecks ?? [])],
    deterministicIdentity: buildDeterministicIdentity(seed, publicTrace),
    lastObservedPhase: failureContext?.lastObservedPhase ?? null,
    ...(error ? { harnessDiagnostic: safeHarnessDiagnostic(error, failureContext) } : {}),
  };
}

function failureForEvent(game, category, reason, event) {
  return gateFailure(game, category, reason, event, {
    day: event?.day ?? game?.daysPlayed ?? 0,
    phase: event?.phase ?? "unknown",
  });
}

function replayVoteResultByActor(game) {
  const results = new Map();
  (game?.publicTrace ?? [])
    .filter((event) => event.type === "vote")
    .forEach((event) => {
      (event.votes ?? []).forEach((vote) => {
        results.set(`${event.day}::${vote.actorId}::${event.targetId}`, vote.vote === true);
      });
    });
  return results;
}

function sumMetrics(seedResults) {
  const aggregate = {};
  seedResults.forEach((result) => {
    Object.entries(result.metrics ?? {}).forEach(([key, value]) => {
      if (Number.isFinite(value)) aggregate[key] = (aggregate[key] ?? 0) + value;
    });
  });
  return aggregate;
}

function compareReplayRuns(primary, comparison) {
  return {
    identityMatches:
      JSON.stringify(primary.deterministicIdentity) === JSON.stringify(comparison.deterministicIdentity),
    winnerMatches: primary.winner === comparison.winner,
  };
}

export function evaluateReplayGame(game) {
  if (game?.initializationFatal) {
    const failure = gateFailure(game, "harness-fatal", "initialization-failed", null, {
      day: 0,
      phase: "initialization",
      nearestPublicEvent: { type: "none", reason: "before-first-public-event" },
    });
    return { ok: false, seed: game?.seed ?? null, metrics: {}, failures: [failure] };
  }
  if (game?.harnessFatal) {
    const phase = game?.harnessPhase === "initialization" ? "initialization" : "replay";
    const observedPhase = phase === "initialization" ? "initialization" : game?.lastObservedPhase ?? "replay";
    const failure = gateFailure(game, "harness-fatal", phase === "initialization" ? "initialization-failed" : "replay-failed", null, {
      day: phase === "initialization" ? 0 : game?.daysPlayed ?? 0,
      phase: observedPhase,
      nearestPublicEvent:
        phase === "initialization"
          ? { type: "none", reason: "before-first-public-event" }
          : nearestPublicEvent(game),
      diagnostic: game?.harnessDiagnostic ?? null,
    });
    return { ok: false, seed: game?.seed ?? null, metrics: {}, failures: [failure] };
  }

  const failures = [];
  const humanId = game?.human?.playerId ?? null;
  const trace = [...(game?.publicTrace ?? [])].sort(
    (left, right) => (left.sequence ?? Number.MAX_SAFE_INTEGER) - (right.sequence ?? Number.MAX_SAFE_INTEGER)
  );
  const aiSpeeches = trace.filter((event) => event.type === "speech" && event.actorId !== humanId);
  const aiNominations = trace.filter((event) => event.type === "nomination" && event.actorId !== humanId);
  const voteStatements = trace.filter((event) => event.type === "vote-statement" && event.actorId !== humanId);
  const speechObservations = game?.speechObservations ?? [];

  const metrics = {
    completionFailures: 0,
    actionLegalityFailures: 0,
    journeyCoverageFailures: 0,
    publicReasonDenominator: aiSpeeches.length,
    duplicatePublicReasons: 0,
    crossDayTransitionDenominator: 0,
    crossDayChangedPositions: 0,
    unexplainedCrossDayChanges: 0,
    nominationReasonDenominator: aiNominations.length,
    emptyNominationReasons: 0,
    voteStatementCount: voteStatements.length,
    voteAlignmentDenominator: 0,
    stanceVoteMismatches: 0,
    boundaryObservationDenominator: speechObservations.length,
    publicInformationAssertions: 0,
    publicInformationViolations: 0,
  };

  if (!game?.gameOver || !["good", "evil"].includes(game?.winner)) {
    metrics.completionFailures += 1;
    if (metrics.completionFailures > FLAGSHIP_REPLAY_THRESHOLDS.maximumViolations.completion) {
      failures.push(gateFailure(game, "completion", "no-declared-winner"));
    }
  }
  if ((game?.daysPlayed ?? MAX_DAYS + 1) > FLAGSHIP_REPLAY_THRESHOLDS.maxDays) {
    metrics.completionFailures += 1;
    if (metrics.completionFailures > FLAGSHIP_REPLAY_THRESHOLDS.maximumViolations.completion) {
      failures.push(
        gateFailure(game, "completion", "day-bound", null, {
          day: game.daysPlayed,
          phase: "day-bound",
        })
      );
    }
  }

  (game?.actionChecks ?? []).forEach((check) => {
    if (check.accepted === true) return;
    metrics.actionLegalityFailures += 1;
    if (metrics.actionLegalityFailures > FLAGSHIP_REPLAY_THRESHOLDS.maximumViolations.actionLegality) {
      failures.push(
        gateFailure(game, "action-legality", "rejected-action", null, {
          day: check.day ?? 0,
          phase: check.phase ?? "unknown",
        })
      );
    }
  });

  const journeyChecks = [
    [game?.journey?.aiSpeechCount, "zero-ai-speech"],
    [game?.journey?.aiNominationCount, "zero-ai-nomination"],
    [game?.journey?.aiVoteCount, "zero-ai-vote"],
    [game?.journey?.publicDiscussionDays?.length, "zero-public-discussion-days"],
  ];
  journeyChecks.forEach(([value, reason]) => {
    if ((value ?? 0) > 0) return;
    metrics.journeyCoverageFailures += 1;
    failures.push(gateFailure(game, "journey-coverage", reason));
  });
  if ((game?.pendingStorytellerActions ?? 0) > 0) {
    metrics.journeyCoverageFailures += 1;
    failures.push(gateFailure(game, "journey-coverage", "pending-storyteller-actions"));
  }

  speechObservations.forEach((observation) => {
    const result = evaluateInformationBoundaryObservation(observation, {
      seed: game?.seed ?? null,
      scriptId: FLAGSHIP_REPLAY_CONFIG.scriptId,
    });
    metrics.publicInformationAssertions += result.checkedCount;
    result.failures.forEach((failure) => {
      metrics.publicInformationViolations += 1;
      if (
        metrics.publicInformationViolations >
        FLAGSHIP_REPLAY_THRESHOLDS.maximumViolations.publicInformationSafety
      ) {
        failures.push(failure);
      }
    });
  });
  if (metrics.boundaryObservationDenominator < FLAGSHIP_REPLAY_THRESHOLDS.minimumDenominators.boundaryObservations) {
    failures.push(gateFailure(game, "public-information-safety", "zero-denominator"));
  }

  if (metrics.publicReasonDenominator < FLAGSHIP_REPLAY_THRESHOLDS.minimumDenominators.publicReasons) {
    failures.push(gateFailure(game, "repeated-public-reasoning", "zero-denominator"));
  } else {
    const seenReasons = new Map();
    aiSpeeches.forEach((event) => {
      const fingerprint = publicReasonFingerprint(event.text);
      if (!fingerprint) return;
      const key = `${event.actorId}::${fingerprint}`;
      if (seenReasons.has(key)) {
        metrics.duplicatePublicReasons += 1;
        if (
          metrics.duplicatePublicReasons > FLAGSHIP_REPLAY_THRESHOLDS.maximumViolations.duplicatePublicReasons
        ) {
          failures.push(failureForEvent(game, "repeated-public-reasoning", "duplicate-visible-reason", event));
        }
      } else {
        seenReasons.set(key, event);
      }
    });
  }

  const priorSpeechByActor = new Map();
  aiSpeeches.forEach((event) => {
    const prior = priorSpeechByActor.get(event.actorId);
    if (prior && prior.day !== event.day) {
      metrics.crossDayTransitionDenominator += 1;
      const priorVisibleStance = parsedPublicDiscussionStance(prior.text);
      const currentVisibleStance = parsedPublicDiscussionStance(event.text);
      const decisiveStanceChanged =
        ["support", "oppose"].includes(priorVisibleStance) &&
        ["support", "oppose"].includes(currentVisibleStance) &&
        priorVisibleStance !== currentVisibleStance;
      const targetChanged = prior.targetId !== event.targetId;
      if (targetChanged || decisiveStanceChanged) {
        metrics.crossDayChangedPositions += 1;
        if (!hasCrossDayRevisionExplanation(event.text)) {
          metrics.unexplainedCrossDayChanges += 1;
          if (
            metrics.unexplainedCrossDayChanges >
            FLAGSHIP_REPLAY_THRESHOLDS.maximumViolations.unexplainedCrossDayChanges
          ) {
            failures.push(failureForEvent(game, "cross-day-continuity", "unexplained-position-change", event));
          }
        }
      }
    }
    priorSpeechByActor.set(event.actorId, event);
  });
  if (metrics.crossDayTransitionDenominator < FLAGSHIP_REPLAY_THRESHOLDS.minimumDenominators.crossDayTransitions) {
    failures.push(gateFailure(game, "cross-day-continuity", "zero-denominator"));
  }

  aiNominations.forEach((event) => {
    if (normalizedVisibleText(event.reason)) return;
    metrics.emptyNominationReasons += 1;
    if (metrics.emptyNominationReasons > FLAGSHIP_REPLAY_THRESHOLDS.maximumViolations.emptyNominationReasons) {
      failures.push(failureForEvent(game, "nomination-justification", "empty-visible-reason", event));
    }
  });
  if (metrics.nominationReasonDenominator < FLAGSHIP_REPLAY_THRESHOLDS.minimumDenominators.nominationReasons) {
    failures.push(gateFailure(game, "nomination-justification", "zero-denominator"));
  }

  const voteResults = replayVoteResultByActor(game);
  voteStatements.forEach((event) => {
    const stance = parsedPublicVoteStance(event.text);
    if (!["support", "oppose"].includes(stance)) return;
    metrics.voteAlignmentDenominator += 1;
    const vote = voteResults.get(`${event.day}::${event.actorId}::${event.targetId}`);
    if (typeof vote !== "boolean" || vote !== (stance === "support")) {
      metrics.stanceVoteMismatches += 1;
      if (metrics.stanceVoteMismatches > FLAGSHIP_REPLAY_THRESHOLDS.maximumViolations.stanceVoteMismatches) {
        failures.push(failureForEvent(game, "stance-vote-alignment", "public-stance-vote-contradiction", event));
      }
    }
  });
  if (metrics.voteAlignmentDenominator < FLAGSHIP_REPLAY_THRESHOLDS.minimumDenominators.voteAlignment) {
    failures.push(gateFailure(game, "stance-vote-alignment", "zero-denominator"));
  }

  return {
    ok: failures.length === 0,
    seed: game?.seed ?? null,
    metrics,
    failures,
  };
}

export function evaluateReplayCorpus(corpus) {
  const seedResults = [];
  const failures = [];
  if ((corpus?.pairs?.length ?? 0) !== MAIN_SEEDS.length) {
    failures.push(
      gateFailure(null, "journey-coverage", "corpus-size", null, {
        seed: null,
        day: 0,
        phase: "corpus",
        nearestPublicEvent: { type: "none", reason: "before-first-public-event" },
      })
    );
  }

  (corpus?.pairs ?? []).forEach((pair) => {
    const primary = pair?.primary ?? replayInitializationFatal(pair?.seed ?? null);
    const primaryResult = evaluateReplayGame(primary);
    const pairFailures = [...primaryResult.failures];
    const comparison = pair?.comparison ?? replayInitializationFatal(pair?.seed ?? null);
    const comparisonResult = evaluateReplayGame(comparison);
    pairFailures.push(...comparisonResult.failures);
    if (!comparison.initializationFatal && !comparison.harnessFatal && !primary.initializationFatal && !primary.harnessFatal) {
      const { identityMatches, winnerMatches } = compareReplayRuns(primary, comparison);
      if (!identityMatches || !winnerMatches) {
        pairFailures.push(
          gateFailure(primary, "determinism", identityMatches ? "winner-drift" : "identity-drift", null, {
            day: 0,
            phase: "paired-replay",
            nearestPublicEvent: { type: "none", reason: "before-first-public-event" },
          })
        );
      }
    }
    failures.push(...pairFailures);
    seedResults.push({
      ...primaryResult,
      ok: pairFailures.length === 0,
      failures: pairFailures,
      runResults: {
        primary: primaryResult,
        comparison: comparisonResult,
      },
    });
  });

  return {
    ok: failures.length === 0,
    seedResults,
    aggregateMetrics: sumMetrics(seedResults),
    failures,
  };
}

function safeRunFlagshipReplay(seed, runReplay = runFlagshipReplay) {
  const failureContext = {
    seed,
    harnessPhase: "initialization",
    daysPlayed: 0,
    lastObservedPhase: "initialization",
    publicTrace: [],
    actionChecks: [],
    speechObservations: [],
  };
  try {
    return runReplay(seed, { failureContext });
  } catch (error) {
    return replayHarnessFatal(seed, failureContext.harnessPhase, failureContext, error);
  }
}

export function runFlagshipReplayCorpus({ runReplay = runFlagshipReplay } = {}) {
  const startedAt = Date.now();
  const pairs = MAIN_SEEDS.map((seed) => {
    const primary = safeRunFlagshipReplay(seed, runReplay);
    const comparison = safeRunFlagshipReplay(seed, runReplay);
    return {
      seed,
      primary,
      comparison,
      ...compareReplayRuns(primary, comparison),
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

function categoryCounts(failures) {
  const counts = new Map();
  (failures ?? []).forEach((failure) => {
    counts.set(failure.category, (counts.get(failure.category) ?? 0) + 1);
  });
  return counts;
}

function introducedCategories(controlFailures, mutatedFailures) {
  const control = categoryCounts(controlFailures);
  const mutated = categoryCounts(mutatedFailures);
  return [...mutated.entries()]
    .filter(([category, count]) => count > (control.get(category) ?? 0))
    .map(([category]) => category)
    .sort();
}

function mutationCaseResult({ id, expectedCategory, controlFailures, mutatedFailures }) {
  const observedCategories = introducedCategories(controlFailures, mutatedFailures);
  const unrelatedCategories = observedCategories.filter((category) => category !== expectedCategory);
  return {
    id,
    expectedCategory,
    observedCategories,
    unrelatedCategories,
    passed: observedCategories.includes(expectedCategory) && unrelatedCategories.length === 0,
  };
}

function unknownBoundaryMutation(family) {
  const targets = [
    { id: "p1", name: "1号", seatIndex: 0, publicClaimRoleId: null },
    { id: "p5", name: "5号", seatIndex: 4, publicClaimRoleId: null },
    { id: "p6", name: "6号", seatIndex: 5, publicClaimRoleId: null },
  ];
  const textByFamily = {
    "demon-bluff": "我明确知道的恶魔伪装身份是调查员。",
    "evil-recognition": "我在首夜认出的恶魔是5号。",
    "actual-role": "5号的真实角色是调查员。",
    "actual-team": "5号的真实阵营是邪恶。",
    "forbidden-marker": "decisionRationale 已经泄露到公开发言。",
  };
  return {
    visibleEvent: {
      day: 2,
      phase: "day/public",
      speakerId: "p1",
      focusId: "p6",
      text: textByFamily[family],
    },
    agentView: {
      viewerId: "p1",
      self: {
        id: "p1",
        roleKnownToSelf: "washerwoman",
        perceivedRoleId: "washerwoman",
        teamKnownToSelf: "good",
      },
      knownAllies: [],
      knownDemonId: null,
      knownMinionIds: [],
      knownBluffRoleIds: [],
      visibleClaims: [],
      targets,
      targetById: Object.fromEntries(targets.map((target) => [target.id, target])),
    },
    legalKnowledge: {
      viewerId: "p1",
      self: { roleId: "washerwoman", team: "good" },
      knownAllyIds: [],
      knownDemonId: null,
      knownMinionIds: [],
      knownBluffRoleIds: [],
      publicRoleReveals: [],
    },
  };
}

function evaluateGameMutation(controlGame, id, expectedCategory, mutate) {
  const control = structuredClone(controlGame);
  const mutated = structuredClone(controlGame);
  mutate(mutated);
  return mutationCaseResult({
    id,
    expectedCategory,
    controlFailures: evaluateReplayGame(control).failures,
    mutatedFailures: evaluateReplayGame(mutated).failures,
  });
}

export function runFlagshipReplaySensitivity(corpus) {
  const healthySnapshot = JSON.stringify(corpus);
  const controlGame = corpus?.pairs?.[0]?.primary;
  if (!controlGame) {
    return {
      ok: false,
      healthyControlUnchanged: true,
      cases: [],
      failures: [
        gateFailure(null, "sensitivity", "missing-healthy-control", null, {
          day: 0,
          phase: "sensitivity",
          nearestPublicEvent: { type: "none", reason: "before-first-public-event" },
        }),
      ],
    };
  }

  const cases = [];
  cases.push(
    evaluateGameMutation(controlGame, "completion-no-winner", "completion", (game) => {
      game.gameOver = false;
      game.winner = null;
    })
  );

  {
    const mutatedCorpus = structuredClone(corpus);
    const firstIdentityEvent = mutatedCorpus.pairs[0].comparison?.deterministicIdentity?.events?.[0];
    if (firstIdentityEvent) firstIdentityEvent.actorId = "opaque-drift";
    cases.push(
      mutationCaseResult({
        id: "determinism-identity-drift",
        expectedCategory: "determinism",
        controlFailures: evaluateReplayCorpus(corpus).failures,
        mutatedFailures: evaluateReplayCorpus(mutatedCorpus).failures,
      })
    );
  }

  cases.push(
    evaluateGameMutation(controlGame, "action-legality-rejected", "action-legality", (game) => {
      game.actionChecks.push({
        sequence: (game.actionChecks.at(-1)?.sequence ?? 0) + 1,
        day: 1,
        phase: "day/nomination",
        action: "controlled-rejection",
        accepted: false,
        reason: "controlled",
      });
    })
  );
  cases.push(
    evaluateGameMutation(controlGame, "journey-coverage-zero-speech", "journey-coverage", (game) => {
      game.journey.aiSpeechCount = 0;
    })
  );

  INFORMATION_BOUNDARY_FACT_FAMILIES.forEach((family) => {
    cases.push(
      evaluateGameMutation(controlGame, `information-${family}`, "public-information-safety", (game) => {
        game.speechObservations.push(unknownBoundaryMutation(family));
      })
    );
  });

  cases.push(
    evaluateGameMutation(
      controlGame,
      "repetition-duplicate-visible-reason",
      "repeated-public-reasoning",
      (game) => {
        const source = game.publicTrace.find((event) => event.type === "speech" && event.actorId !== game.human.playerId);
        if (!source) return;
        game.publicTrace.push({ ...source, sequence: (source.sequence ?? 0) + 0.25 });
      }
    )
  );

  cases.push(
    evaluateGameMutation(controlGame, "continuity-cross-day-flip", "cross-day-continuity", (game) => {
      const speeches = game.publicTrace
        .filter((event) => event.type === "speech" && event.actorId !== game.human.playerId)
        .sort((left, right) => left.sequence - right.sequence);
      const firstByActor = new Map();
      const current = speeches.find((event) => {
        const prior = firstByActor.get(event.actorId);
        if (!prior) {
          firstByActor.set(event.actorId, event);
          return false;
        }
        return event.day > prior.day;
      });
      if (!current) return;
      const prior = firstByActor.get(current.actorId);
      const targetIds = [...new Set(game.publicTrace.flatMap((event) => [event.actorId, event.targetId]).filter(Boolean))];
      current.targetId = targetIds.find(
        (targetId) => targetId !== prior.targetId && targetId !== current.targetId && targetId !== current.actorId
      );
      current.text = "今天只核这个公开目标和票型。";
      current.parsedStance = "undecided";
    })
  );

  cases.push(
    evaluateGameMutation(controlGame, "nomination-empty-reason", "nomination-justification", (game) => {
      const nomination = game.publicTrace.find(
        (event) => event.type === "nomination" && event.actorId !== game.human.playerId
      );
      if (nomination) nomination.reason = "";
    })
  );

  cases.push(
    evaluateGameMutation(controlGame, "vote-alignment-contradiction", "stance-vote-alignment", (game) => {
      const voteResults = replayVoteResultByActor(game);
      const statement = game.publicTrace.find((event) => {
        if (event.type !== "vote-statement" || event.actorId === game.human.playerId) return false;
        const vote = voteResults.get(`${event.day}::${event.actorId}::${event.targetId}`);
        return typeof vote === "boolean" && ["support", "oppose"].includes(parsedPublicVoteStance(event.text));
      });
      if (!statement) return;
      const vote = voteResults.get(`${statement.day}::${statement.actorId}::${statement.targetId}`);
      statement.text = vote
        ? "这票我先不投，公开理由还不够。"
        : "这票我会投，按公开理由推进处决。";
    })
  );

  const healthyControlUnchanged = JSON.stringify(corpus) === healthySnapshot;
  const healthyControlPasses = evaluateReplayCorpus(corpus).ok;
  const failedCases = cases.filter((entry) => !entry.passed);
  const failures = failedCases.map((entry) => ({
    seed: null,
    day: 0,
    phase: "sensitivity",
    category: "sensitivity",
    reason: "case-did-not-isolate",
    caseId: entry.id,
    nearestPublicEvent: { type: "none", reason: "before-first-public-event" },
  }));
  if (!healthyControlPasses) {
    failures.push({
      seed: null,
      day: 0,
      phase: "sensitivity",
      category: "sensitivity",
      reason: "healthy-control-failed",
      nearestPublicEvent: { type: "none", reason: "before-first-public-event" },
    });
  }
  if (!healthyControlUnchanged) {
    failures.push({
      seed: null,
      day: 0,
      phase: "sensitivity",
      category: "sensitivity",
      reason: "healthy-control-mutated",
      nearestPublicEvent: { type: "none", reason: "before-first-public-event" },
    });
  }
  return {
    ok: failures.length === 0,
    healthyControlUnchanged,
    cases,
    failures,
  };
}

export function runFlagshipReplayEvaluation({ corpus = null } = {}) {
  const replayCorpus = corpus ?? runFlagshipReplayCorpus();
  const evaluation = evaluateReplayCorpus(replayCorpus);
  const sensitivity = runFlagshipReplaySensitivity(replayCorpus);
  const failures = [...evaluation.failures, ...sensitivity.failures];
  return {
    ok: failures.length === 0,
    corpus: replayCorpus,
    evaluation,
    sensitivity,
    failures,
  };
}

export function compactReplayEvaluationSummary(report) {
  return {
    ok: report?.ok === true,
    seeds: (report?.evaluation?.seedResults ?? []).map((result) => {
      const pair = report?.corpus?.pairs?.find((entry) => entry.seed === result.seed);
      return {
        seed: result.seed,
        winner: pair?.primary?.winner ?? null,
        days: pair?.primary?.daysPlayed ?? 0,
        ok: result.ok,
        comparisonOk: result.runResults?.comparison?.ok === true,
        publicReasons: result.metrics?.publicReasonDenominator ?? 0,
        crossDayTransitions: result.metrics?.crossDayTransitionDenominator ?? 0,
        nominations: result.metrics?.nominationReasonDenominator ?? 0,
        voteComparisons: result.metrics?.voteAlignmentDenominator ?? 0,
        boundaryObservations: result.metrics?.boundaryObservationDenominator ?? 0,
      };
    }),
    sensitivity: {
      ok: report?.sensitivity?.ok === true,
      passed: (report?.sensitivity?.cases ?? []).filter((entry) => entry.passed).length,
      total: report?.sensitivity?.cases?.length ?? 0,
    },
    elapsedMs: report?.corpus?.elapsedMs ?? 0,
    failures: (report?.failures ?? []).slice(0, 24),
  };
}

export function replayEvaluationExitCode(report) {
  return (report?.failures?.length ?? 1) === 0 ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = runFlagshipReplayEvaluation();
  console.log(JSON.stringify(compactReplayEvaluationSummary(report)));
  process.exitCode = replayEvaluationExitCode(report);
}
