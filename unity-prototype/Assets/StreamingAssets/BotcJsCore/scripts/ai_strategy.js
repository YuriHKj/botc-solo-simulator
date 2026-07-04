import { clamp, getAllRoles } from "./data.js";
import { getAlivePlayers, getEffectiveRoleId, getPlayerById } from "./engine.js";
import {
  areKnownAllies,
  buildAgentView,
  countAgentEvidence,
  getAIAgent,
  getDialogueEvidenceForTarget,
  getKnownAllyIds,
  getSuspicionTrailForTarget,
} from "./ai_agents.js";

const MAX_EVIL_PLAN_HISTORY = 6;
const MAX_NARRATIVE_ANCHORS = 5;
const MAX_WORLD_CANDIDATES = 4;
const MAX_EVIL_TEAM_PLAN_HISTORY = 6;
const SNV_EVIL_TWIN = "evil-twin";

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function knownSelfTeam(state, aiPlayer) {
  const agent = state && aiPlayer ? getAIAgent(state, aiPlayer) : null;
  return agent?.knownSelfTeam ?? aiPlayer?.team ?? "";
}

function isKnownCurrentDemon(state, aiPlayer, player) {
  if (!state || !aiPlayer || !player || player.alive === false || player.category !== "demon") {
    return false;
  }
  if (aiPlayer.id === player.id && aiPlayer.team === "evil") {
    return true;
  }
  const agent = getAIAgent(state, aiPlayer);
  return agent?.knownDemonId === player.id;
}

function round2(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function voteThresholdForAlive(aliveCount) {
  return Math.ceil(Math.max(0, Number(aliveCount) || 0) / 2);
}

export function countPriorNoExecutionVoteDays(state, currentDay = Number(state?.day) || 0) {
  if (!state || !Number.isFinite(Number(currentDay))) {
    return 0;
  }
  const executionDays = new Set(
    safeArray(state.events?.executions)
      .filter((entry) => Number(entry?.day ?? 0) > 0 && Number(entry.day) < currentDay)
      .map((entry) => Number(entry.day))
  );
  const voteDays = new Set(
    safeArray(state.events?.votes)
      .filter((entry) => Number(entry?.day ?? 0) > 0 && Number(entry.day) < currentDay)
      .map((entry) => Number(entry.day))
  );
  let count = 0;
  voteDays.forEach((day) => {
    if (!executionDays.has(day)) {
      count += 1;
    }
  });
  return count;
}

function noExecutionWinWindowStillOpen(state) {
  if ((state?.events?.executions ?? []).some((entry) => entry.day === state.day)) {
    return false;
  }
  const currentExecutionCandidate = state?.dayStageMeta?.executionCandidate ?? null;
  return !(currentExecutionCandidate?.day === state?.day && currentExecutionCandidate.nomineeId);
}

function publicMayorNoExecutionWinCandidate(state, aiPlayer, window) {
  if (state?.scriptId !== "tb" || window?.aliveCount !== 3) {
    return null;
  }
  if (!noExecutionWinWindowStillOpen(state)) {
    return null;
  }
  const agent = state && aiPlayer ? getAIAgent(state, aiPlayer) : null;
  return getAlivePlayers(state).find((player) => {
    if (player.publicClaimRoleId === "mayor") {
      return true;
    }
    if (player.id !== aiPlayer?.id) {
      return false;
    }
    return [agent?.knownSelfRoleId, player.apparentRoleId, player.roleId].includes("mayor");
  }) ?? null;
}

function activeEvilTwinPairForStrategy(state) {
  const pair = state?.snv?.evilTwinPair;
  if (state?.scriptId !== "snv" || !pair?.evilTwinId || !pair?.goodTwinId) {
    return null;
  }
  const evilTwin = getPlayerById(state, pair.evilTwinId);
  const goodTwin = getPlayerById(state, pair.goodTwinId);
  const opposingTwin = getPlayerById(state, pair.opposingTwinId ?? pair.goodTwinId);
  const blocked =
    !!evilTwin?.poisoned ||
    (state.snv?.snakeCharmerPoisonedIds ?? []).includes(evilTwin?.id);
  if (!evilTwin?.alive || !goodTwin?.alive || !opposingTwin?.alive || blocked) {
    return null;
  }
  if (getEffectiveRoleId(evilTwin) !== SNV_EVIL_TWIN) {
    return null;
  }
  return {
    evilTwinId: pair.evilTwinId,
    goodTwinId: pair.goodTwinId,
    opposingTwinId: pair.opposingTwinId ?? pair.goodTwinId,
  };
}

function viewerKnowsEvilTwinPair(state, aiPlayer, pair) {
  if (!aiPlayer?.id || !pair?.evilTwinId || !pair?.goodTwinId) {
    return false;
  }
  const participantIds = new Set([pair.evilTwinId, pair.goodTwinId, pair.opposingTwinId].filter(Boolean));
  if (participantIds.has(aiPlayer.id)) {
    return true;
  }
  return knownSelfTeam(state, aiPlayer) === "evil" && getKnownAllyIds(state, aiPlayer).includes(pair.evilTwinId);
}

export function evilTwinExecutionRiskForTarget(state, aiPlayer, targetPlayer) {
  if (!targetPlayer?.id) {
    return null;
  }
  const pair = activeEvilTwinPairForStrategy(state);
  if (!pair || targetPlayer.id !== pair.goodTwinId || !viewerKnowsEvilTwinPair(state, aiPlayer, pair)) {
    return null;
  }
  const viewerTeam = knownSelfTeam(state, aiPlayer);
  return {
    kind: "evil-twin-execution-risk",
    active: true,
    knownByViewer: true,
    viewerTeam,
    targetId: targetPlayer.id,
    evilTwinId: pair.evilTwinId,
    goodTwinId: pair.goodTwinId,
    opposingTwinId: pair.opposingTwinId,
    protectsGood: viewerTeam === "good",
    evilExecutionWin: viewerTeam === "evil",
    reason: "good-twin-execution-evil-win",
  };
}

function mastermindNoExecutionWinWindow(state) {
  if (state?.scriptId !== "bmr" || state?.bmr?.mastermindPendingDay !== state?.day) {
    return false;
  }
  return noExecutionWinWindowStillOpen(state);
}

export function evaluateGameWindow(state, actor = null, options = {}) {
  const alivePlayers = getAlivePlayers(state);
  const aliveCount = alivePlayers.length;
  const day = Math.max(1, Number(state?.day) || 1);
  const publicRounds = Number(state?.dayStageMeta?.publicRounds ?? 0) || 0;
  const stage = options.stage ?? state?.dayStage ?? state?.phase ?? "";
  const voteThreshold = voteThresholdForAlive(aliveCount);
  const nomineesRemaining = alivePlayers.filter((player) => !player.beenNominatedToday).length;
  const nominatorsRemaining = alivePlayers.filter((player) => !player.nominatedToday).length;
  const nominationScarcity = aliveCount > 0 ? 1 - nomineesRemaining / aliveCount : 1;
  const priorNoExecutionVoteDays = countPriorNoExecutionVoteDays(state, day);
  const lateGame = aliveCount <= 5;
  const midGame = aliveCount <= 7;
  const mustExecute = lateGame || day >= 3 || nominationScarcity >= 0.65;
  const urgency = clamp(
    (day >= 3 ? 0.28 : day >= 2 ? 0.16 : 0.06) +
      (lateGame ? 0.34 : midGame ? 0.2 : 0.06) +
      Math.min(0.18, publicRounds * 0.06) +
      (stage === "nomination" ? 0.08 : 0) +
      nominationScarcity * 0.16,
    0,
    1
  );
  const pressureNominationAllowed = day <= 1 || publicRounds >= 1 || urgency >= 0.45 || mustExecute;
  const noExecutionTolerance = clamp(0.72 - urgency * 0.72 - (mustExecute ? 0.18 : 0), 0.05, 0.8);

  return {
    day,
    stage,
    aliveCount,
    voteThreshold,
    nomineesRemaining,
    nominatorsRemaining,
    nominationScarcity,
    priorNoExecutionVoteDays,
    lateGame,
    midGame,
    mustExecute,
    urgency,
    pressureNominationAllowed,
    noExecutionTolerance,
    actorId: actor?.id ?? "",
  };
}

export function evaluateGoodDayStrategy(state, aiPlayer, options = {}) {
  const window = options.window ?? evaluateGameWindow(state, aiPlayer, options);
  const selfTeam = knownSelfTeam(state, aiPlayer);
  const roles = getAllRoles(state?.scriptId ?? "tb");
  const roleIds = new Set(roles.map((role) => role.id));
  const selfRole = roles.find((role) => role.id === (aiPlayer?.publicClaimRoleId || aiPlayer?.roleId)) ?? null;
  const hasUndertaker = roleIds.has("undertaker");
  const hasVirgin = roleIds.has("virgin");
  const hasVortox = roleIds.has("vortox");
  const mayorWinCandidate = publicMayorNoExecutionWinCandidate(state, aiPlayer, window);
  const mastermindNoExecutionWin = mastermindNoExecutionWinWindow(state);
  const lowInfoRole =
    !selfRole ||
    (!selfRole.tags?.includes("info") && !selfRole.tags?.includes("recurring") && !selfRole.tags?.includes("firstNight"));
  const isTownsfolk = selfRole?.category === "townsfolk" || aiPlayer?.category === "townsfolk";
  const reasons = [];

  if (selfTeam !== "good") {
    return {
      kind: "good-day-strategy",
      active: false,
      executionValue: 0,
      noExecutionRisk: 0,
      verificationValue: 0,
      selfDisclosureBias: 0,
      nominationBias: 0,
      voteBias: 0,
      mayorNoExecutionWin: false,
      mastermindNoExecutionWin: false,
      mayorCandidateId: "",
      recommendedPublicAct: "none",
      reasons,
    };
  }

  let executionValue = 0.08 + window.urgency * 0.18;
  let noExecutionRisk = window.mustExecute ? 0.26 : 0.08;
  let verificationValue = 0;
  if (hasUndertaker) {
    executionValue += 0.18;
    reasons.push("undertaker-can-convert-execution-to-info");
  }
  if (hasVortox) {
    noExecutionRisk += 0.36;
    executionValue += 0.12;
    reasons.push("vortox-script-punishes-no-execution");
  }
  if (hasVirgin && isTownsfolk && aiPlayer?.alive !== false && !aiPlayer?.nominatedToday) {
    verificationValue += lowInfoRole ? 0.22 : 0.12;
    reasons.push("virgin-can-publicly-verify-townfolk-nomination");
  }
  if (lowInfoRole) {
    reasons.push("low-info-role-can-spend-social-capital");
  }
  if (mayorWinCandidate) {
    executionValue = Math.max(0, executionValue - 0.34);
    noExecutionRisk = Math.max(0, noExecutionRisk - 0.42);
    verificationValue = Math.max(0, verificationValue - 0.12);
    reasons.push("mayor-final-three-no-execution-win");
  }
  if (mastermindNoExecutionWin) {
    executionValue = Math.max(0, executionValue - 0.42);
    noExecutionRisk = 0;
    verificationValue = Math.max(0, verificationValue - 0.12);
    reasons.push("mastermind-extra-day-no-execution-win");
  }

  const selfDisclosureBias = clamp(
    (lowInfoRole ? 0.08 : 0) +
      verificationValue * 0.46 +
      (window.day >= 2 ? 0.05 : 0) +
      (noExecutionRisk >= 0.36 ? 0.04 : 0),
    0,
    0.34
  );
  const nominationBias = clamp(executionValue * 0.24 + noExecutionRisk * 0.2 + verificationValue * 0.18, 0, 0.22);
  const voteBias = clamp(executionValue * 0.12 + noExecutionRisk * 0.18, 0, 0.16);
  let recommendedPublicAct = "hold";
  if (mayorWinCandidate) {
    recommendedPublicAct = "hold-for-mayor-win";
  } else if (mastermindNoExecutionWin) {
    recommendedPublicAct = "hold-for-mastermind-win";
  } else if (hasVirgin && isTownsfolk && lowInfoRole && verificationValue >= 0.2) {
    recommendedPublicAct = "offer-virgin-check";
  } else if (hasVortox && noExecutionRisk >= 0.36) {
    recommendedPublicAct = "avoid-no-execution";
  } else if (hasUndertaker && executionValue >= 0.22) {
    recommendedPublicAct = "execution-for-info";
  } else if (selfDisclosureBias >= 0.14) {
    recommendedPublicAct = "low-info-claim";
  }

  return {
    kind: "good-day-strategy",
    active: true,
    executionValue: round2(clamp(executionValue, 0, 1)),
    noExecutionRisk: round2(clamp(noExecutionRisk, 0, 1)),
    verificationValue: round2(clamp(verificationValue, 0, 1)),
    selfDisclosureBias: round2(selfDisclosureBias),
    nominationBias: round2(nominationBias),
    voteBias: round2(voteBias),
    mayorNoExecutionWin: !!mayorWinCandidate,
    mastermindNoExecutionWin,
    mayorCandidateId: mayorWinCandidate?.id ?? "",
    mayorCandidateName: mayorWinCandidate?.name ?? "",
    recommendedPublicAct,
    reasons,
  };
}

function targetEvidenceCount(agentView, agent, targetId, options = {}) {
  if (!targetId) {
    return 0;
  }
  if (agentView?.evidenceCountForTarget) {
    const forcePublicOnly = !!options.publicOnly || agentView.audience === "public";
    return agentView.evidenceCountForTarget(targetId, {
      publicOnly: forcePublicOnly,
      includePrivate: !forcePublicOnly,
    });
  }
  return countAgentEvidence(agent, targetId);
}

function evilPriorForViewer(state, viewer) {
  const evilSlots = Number(state?.setupCounts?.minion ?? 0) + Number(state?.setupCounts?.demon ?? 0);
  const denominator = Math.max(1, (state?.players?.length ?? 0) - 1);
  if (knownSelfTeam(state, viewer) === "evil") {
    return clamp((evilSlots - 1) / denominator, 0.05, 0.85);
  }
  return clamp(evilSlots / denominator, 0.05, 0.85);
}

function publicSuspicionBaseline(state, viewer, target) {
  if (!target?.id || target.id === viewer?.id) {
    return 0.01;
  }
  if (areKnownAllies(state, viewer, target)) {
    return 0.08;
  }
  return evilPriorForViewer(state, viewer);
}

function publicSuspicionForTarget(state, viewer, target) {
  if (!target?.id) {
    return 0.5;
  }
  const rawSuspicion = Number(viewer?.suspicion?.[target.id]);
  const fallback = Number.isFinite(rawSuspicion)
    ? rawSuspicion
    : publicSuspicionBaseline(state, viewer, target);
  const trail = getSuspicionTrailForTarget(state, viewer, target.id);
  const biasMeta = viewer?.dialogueBiasMeta?.[target.id] ?? null;

  if (trail.length === 0 && !biasMeta) {
    return target.id === viewer?.id ? 0.01 : clamp(fallback, 0.08, 0.88);
  }

  let score = publicSuspicionBaseline(state, viewer, target);
  trail
    .filter((entry) => entry.visibility === "public")
    .forEach((entry) => {
      score = clamp(score + (Number(entry.appliedDelta) || 0), 0.01, 0.99);
    });

  if (!biasMeta || ["public", "mechanic"].includes(biasMeta.visibility)) {
    score = clamp(score + (Number(viewer?.dialogueBias?.[target.id]) || 0) * 0.6, 0.01, 0.99);
  }

  return target.id === viewer?.id ? 0.01 : clamp(score, 0.08, 0.88);
}

function suspicionForStrategyAudience(state, viewer, target, audience = "public") {
  if (audience === "public") {
    return publicSuspicionForTarget(state, viewer, target);
  }
  const rawSuspicion = Number(viewer?.suspicion?.[target?.id]);
  return Number.isFinite(rawSuspicion) ? rawSuspicion : publicSuspicionBaseline(state, viewer, target);
}

function playerName(player) {
  return player?.name ?? (player?.seatIndex != null ? `${player.seatIndex + 1}号` : "未知玩家");
}

function uniquePushCandidate(candidates, entry) {
  if (!entry?.targetId || candidates.some((candidate) => candidate.targetId === entry.targetId)) {
    return;
  }
  candidates.push(entry);
}

function candidateReasons({ suspicion, publicEvidenceCount, totalEvidenceCount, planKind, window }) {
  const reasons = [];
  if (suspicion >= 0.66) reasons.push("high-visible-suspicion");
  if (publicEvidenceCount > 0) reasons.push("public-evidence");
  if (totalEvidenceCount > publicEvidenceCount) reasons.push("private-visible-evidence");
  if (planKind) reasons.push(planKind);
  if (window?.mustExecute) reasons.push("execution-window");
  if (reasons.length === 0) reasons.push("low-evidence-attention");
  return reasons;
}

function candidateRiskFlags({ publicEvidenceCount, totalEvidenceCount, isKnownAlly, selfTeam, planKind, evilTwinRisk = null }) {
  const flags = [];
  if (publicEvidenceCount <= 0) flags.push("weak-public-evidence");
  if (totalEvidenceCount > publicEvidenceCount) flags.push("has-private-context");
  if (isKnownAlly) flags.push("known-ally");
  if (selfTeam === "evil" && planKind) flags.push("evil-plan-internal");
  if (evilTwinRisk?.protectsGood) flags.push("evil-twin-good-execution-loss");
  if (evilTwinRisk?.evilExecutionWin) flags.push("evil-twin-win-target");
  return flags;
}

function allyPressureScore(state, aiPlayer, ally, agentView) {
  if (!ally) {
    return 0;
  }
  const publicEvidence = targetEvidenceCount(agentView, getAIAgent(state, aiPlayer), ally.id, { publicOnly: true });
  return clamp(
    (ally.beenNominatedToday ? 0.42 : 0) +
      (ally.nominatedToday ? 0.08 : 0) +
      Math.min(0.22, publicEvidence * 0.045),
    0,
    1
  );
}

function candidateFrameScore(state, aiPlayer, candidate, agentView, previousTargetId = "") {
  const agent = getAIAgent(state, aiPlayer);
  const suspicion = aiPlayer?.suspicion?.[candidate.id] ?? 0.5;
  const publicEvidence = targetEvidenceCount(agentView, agent, candidate.id, { publicOnly: true });
  return clamp(
    suspicion +
      Math.min(0.18, publicEvidence * 0.035) +
      (candidate.beenNominatedToday ? 0.035 : 0) +
      (candidate.id === previousTargetId ? 0.04 : 0),
    0,
    1
  );
}

function aliveNonAllyById(state, aiPlayer, playerId) {
  const player = getPlayerById(state, playerId);
  return !!player?.alive && !areKnownAllies(state, aiPlayer, player);
}

function chooseFlexibleFramingTarget(sortedTargets, previous, window, alliesUnderPressure) {
  const top = sortedTargets[0] ?? null;
  if (!top) {
    return {
      target: null,
      secondary: null,
      continuity: previous?.framingTargetId ? "reset" : "new",
      pivotReason: previous?.framingTargetId ? "target-invalid" : "",
    };
  }

  const previousEntry = previous?.framingTargetId
    ? sortedTargets.find((entry) => entry.player.id === previous.framingTargetId)
    : null;
  const pivotMargin = clamp(0.18 - (window?.urgency ?? 0) * 0.08 - alliesUnderPressure.length * 0.025, 0.07, 0.18);
  const previousCanHold =
    !!previousEntry &&
    !previousEntry.player.beenNominatedToday &&
    previousEntry.score + pivotMargin >= top.score;
  const selected = previousCanHold ? previousEntry : top;
  const secondary = sortedTargets.find((entry) => entry.player.id !== selected.player.id) ?? null;

  let pivotReason = "";
  let continuity = previousCanHold ? "hold" : previous?.framingTargetId ? "soft-pivot" : "new";
  if (!previous?.framingTargetId) {
    pivotReason = "";
  } else if (!previousEntry) {
    pivotReason = "target-invalid";
  } else if (previousCanHold) {
    pivotReason = "";
  } else if (alliesUnderPressure.length > 0) {
    pivotReason = "protect-ally";
  } else if (window?.lateGame || window?.mustExecute) {
    pivotReason = "late-window";
  } else {
    pivotReason = "new-public-pressure";
  }

  return {
    target: selected.player,
    secondary: secondary?.player ?? null,
    continuity,
    pivotReason,
  };
}

function pushPlanHistory(previous, snapshot) {
  const history = safeArray(previous?.history).slice(-MAX_EVIL_PLAN_HISTORY + 1);
  const key = [
    snapshot.day,
    snapshot.mode,
    snapshot.framingTargetId,
    snapshot.secondaryFrameTargetId,
    snapshot.protectAllyIds.join(","),
    snapshot.pivotReason,
  ].join(":");
  const last = history.at(-1);
  if (last?.key !== key) {
    history.push({ ...snapshot, key });
  }
  return history;
}

function uniqueStrings(values) {
  return [...new Set(safeArray(values).filter((value) => typeof value === "string" && value.trim()))];
}

function sharedEvilPlanTargetIsValid(state, aiPlayer, plan) {
  if (!plan?.framingTargetId) {
    return false;
  }
  const target = getPlayerById(state, plan.framingTargetId);
  return !!target?.alive && target.id !== aiPlayer?.id && !areKnownAllies(state, aiPlayer, target);
}

function latestVoteForTarget(state, targetId, sinceDay = 0) {
  if (!targetId) {
    return null;
  }
  return safeArray(state?.events?.votes)
    .filter((entry) => entry?.nomineeId === targetId && Number(entry.day ?? 0) >= sinceDay)
    .at(-1) ?? null;
}

function planTargetOutcome(state, plan) {
  if (!plan?.framingTargetId) {
    return null;
  }
  const vote = latestVoteForTarget(state, plan.framingTargetId, Number(plan.day ?? 0) || 0);
  if (!vote) {
    return null;
  }
  const yesVotes = Number(vote.yesVotes ?? 0) || 0;
  const threshold = Number(vote.threshold ?? 0) || 0;
  const margin = yesVotes - threshold;
  if (vote.passed) {
    return {
      kind: "vote-passed",
      release: false,
      commitmentDelta: 0.04,
      margin,
    };
  }
  if (margin <= -2) {
    return {
      kind: "failed-vote-release",
      release: true,
      commitmentDelta: -0.24,
      margin,
    };
  }
  return {
    kind: "failed-vote-soften",
    release: false,
    commitmentDelta: -0.08,
    margin,
  };
}

function currentSharedEvilTeamPlan(state, aiPlayer) {
  const plan = state?.aiDialogue?.evilTeamWorldPlan ?? null;
  if (!sharedEvilPlanTargetIsValid(state, aiPlayer, plan)) {
    return null;
  }
  const outcome = planTargetOutcome(state, plan);
  if (outcome?.release) {
    return null;
  }
  if (outcome) {
    return {
      ...plan,
      commitment: clamp((Number(plan.commitment) || 0.34) + outcome.commitmentDelta, 0.16, 0.86),
      outcome,
    };
  }
  return plan;
}

function previousPlanWithSharedTeamTarget(previous, sharedPlan) {
  if (!sharedPlan?.framingTargetId) {
    return previous ?? null;
  }
  const sharedCommitment = Number(sharedPlan.commitment) || 0.36;
  if (!previous) {
    return {
      framingTargetId: sharedPlan.framingTargetId,
      commitment: clamp(sharedCommitment - 0.02, 0.22, 0.82),
      teamPlanSourceAgentIds: safeArray(sharedPlan.sourceAgentIds),
    };
  }
  if (previous.framingTargetId === sharedPlan.framingTargetId) {
    return {
      ...previous,
      commitment: Math.max(Number(previous.commitment) || 0, sharedCommitment),
      teamPlanSourceAgentIds: safeArray(sharedPlan.sourceAgentIds),
    };
  }
  return {
    ...previous,
    localPreviousFramingTargetId: previous.framingTargetId ?? "",
    framingTargetId: sharedPlan.framingTargetId,
    commitment: clamp(Math.max(Number(previous.commitment) || 0.28, sharedCommitment), 0.22, 0.82),
    teamPlanSourceAgentIds: safeArray(sharedPlan.sourceAgentIds),
  };
}

function pushTeamPlanHistory(previous, snapshot) {
  const history = safeArray(previous?.history).slice(-MAX_EVIL_TEAM_PLAN_HISTORY + 1);
  const key = [
    snapshot.day,
    snapshot.framingTargetId,
    snapshot.secondaryFrameTargetId,
    snapshot.protectAllyIds.join(","),
    snapshot.continuity,
    snapshot.pivotReason,
  ].join(":");
  const last = history.at(-1);
  if (last?.key !== key) {
    history.push({ ...snapshot, key });
  }
  return history;
}

function writeSharedEvilTeamPlan(state, aiPlayer, plan, previousSharedPlan) {
  if (!state || !aiPlayer || !plan?.framingTargetId) {
    return null;
  }
  state.aiDialogue = state.aiDialogue ?? {};
  const sameTarget = previousSharedPlan?.framingTargetId === plan.framingTargetId;
  const protectAllyIds = sameTarget
    ? uniqueStrings([...(previousSharedPlan?.protectAllyIds ?? []), ...(plan.protectAllyIds ?? [])]).slice(0, 3)
    : safeArray(plan.protectAllyIds).slice(0, 3);
  const sourceAgentIds = uniqueStrings([...(sameTarget ? previousSharedPlan?.sourceAgentIds ?? [] : []), aiPlayer.id]).slice(-4);
  const teamPlan = {
    version: 1,
    day: state.day ?? 0,
    framingTargetId: plan.framingTargetId,
    secondaryFrameTargetId: plan.secondaryFrameTargetId ?? "",
    protectAllyIds,
    sacrificeAllyId: plan.sacrificeAllyId ?? "",
    commitment: clamp(
      Math.max(Number(plan.commitment) || 0.34, sameTarget ? (Number(previousSharedPlan?.commitment) || 0.34) + 0.03 : 0.34),
      0.22,
      0.86
    ),
    sourceAgentIds,
    lastUpdatedBy: aiPlayer.id,
    continuity: sameTarget ? "team-hold" : previousSharedPlan?.framingTargetId ? "team-pivot" : "seed",
    pivotReason: plan.pivotReason ?? "",
    history: pushTeamPlanHistory(previousSharedPlan, {
      day: state.day ?? 0,
      framingTargetId: plan.framingTargetId,
      secondaryFrameTargetId: plan.secondaryFrameTargetId ?? "",
      protectAllyIds,
      continuity: plan.continuity ?? "",
      pivotReason: plan.pivotReason ?? "",
    }),
  };
  state.aiDialogue.evilTeamWorldPlan = teamPlan;
  return teamPlan;
}

function buildNarrativeAnchors(planDraft) {
  const anchors = [];
  if (planDraft.bluffRoleId) {
    anchors.push({
      type: "cover-claim",
      roleId: planDraft.bluffRoleId,
      weight: 0.48,
      label: "keep-claim-consistent",
    });
  }
  if (planDraft.framingTargetId) {
    anchors.push({
      type: "frame-target",
      playerId: planDraft.framingTargetId,
      weight: clamp(0.45 + (planDraft.commitment ?? 0) * 0.35, 0.45, 0.78),
      label: planDraft.continuity === "hold" ? "continue-pressure" : "fresh-pressure",
    });
  }
  if (planDraft.secondaryFrameTargetId) {
    anchors.push({
      type: "backup-frame",
      playerId: planDraft.secondaryFrameTargetId,
      weight: 0.28,
      label: "backup-pressure",
    });
  }
  safeArray(planDraft.protectAllyIds).slice(0, 2).forEach((playerId) => {
    anchors.push({
      type: "protect-ally",
      playerId,
      weight: 0.52,
      label: "deflect-heat",
    });
  });
  if (planDraft.pivotReason) {
    anchors.push({
      type: "pivot-reason",
      reason: planDraft.pivotReason,
      weight: 0.36,
      label: "explainable-pivot",
    });
  }
  return anchors.slice(0, MAX_NARRATIVE_ANCHORS);
}

export function buildEvilWorldPlan(state, aiPlayer, options = {}) {
  if (!state || !aiPlayer || knownSelfTeam(state, aiPlayer) !== "evil") {
    return null;
  }
  state.aiDialogue = state.aiDialogue ?? {};
  state.aiDialogue.evilWorldPlansByAgentId = state.aiDialogue.evilWorldPlansByAgentId ?? {};
  const previousRaw = state.aiDialogue.evilWorldPlansByAgentId[aiPlayer.id] ?? null;
  const previousOutcome = planTargetOutcome(state, previousRaw);
  const previous = previousOutcome?.release
    ? {
        ...previousRaw,
        framingTargetId: "",
        staleFramingTargetId: previousRaw?.framingTargetId ?? "",
        staleReason: previousOutcome.kind,
        commitment: 0.22,
      }
    : previousRaw;
  const sharedTeamPlan = currentSharedEvilTeamPlan(state, aiPlayer);
  const coordinationPrevious = previousPlanWithSharedTeamTarget(previous, sharedTeamPlan);
  const agentView = options.agentView ?? buildAgentView(state, aiPlayer, { audience: "public" });
  const window = options.window ?? evaluateGameWindow(state, aiPlayer, options);
  const allyIds = getKnownAllyIds(state, aiPlayer).filter((id) => id !== aiPlayer.id);
  const allies = allyIds.map((id) => getPlayerById(state, id)).filter((player) => player?.alive);
  const alliesUnderPressure = allies
    .map((ally) => ({
      playerId: ally.id,
      score: allyPressureScore(state, aiPlayer, ally, agentView),
    }))
    .filter((entry) => entry.score >= 0.32)
    .sort((a, b) => b.score - a.score);
  const nonAllies = getAlivePlayers(state).filter(
    (candidate) => candidate.id !== aiPlayer.id && !areKnownAllies(state, aiPlayer, candidate)
  );
  const previousTargetValid = coordinationPrevious?.framingTargetId
    ? nonAllies.some((candidate) => candidate.id === coordinationPrevious.framingTargetId)
    : false;
  const sortedTargets = nonAllies
    .map((candidate) => ({
      player: candidate,
      score: candidateFrameScore(
        state,
        aiPlayer,
        candidate,
        agentView,
        previousTargetValid ? coordinationPrevious.framingTargetId : ""
      ),
    }))
    .sort((a, b) => b.score - a.score);
  const flexibleTarget = chooseFlexibleFramingTarget(sortedTargets, coordinationPrevious, window, alliesUnderPressure);
  const framingTarget = flexibleTarget.target;
  const secondaryFrameTarget = flexibleTarget.secondary;
  const sacrificePool = alliesUnderPressure.filter((entry) => {
    const ally = allies.find((candidate) => candidate.id === entry.playerId);
    return ally && !isKnownCurrentDemon(state, aiPlayer, ally);
  });
  const sacrificeCandidate = sacrificePool[0]?.score >= 0.78 && window.lateGame
    ? allies.find((ally) => ally.id === sacrificePool[0].playerId)
    : null;
  const commitment = clamp(
    flexibleTarget.continuity === "hold"
      ? (Number(coordinationPrevious?.commitment) || 0.34) + 0.1
      : coordinationPrevious
        ? (Number(coordinationPrevious.commitment) || 0.36) - 0.06 + (alliesUnderPressure.length > 0 ? 0.08 : 0)
        : 0.36,
    0.22,
    0.82
  );
  const draft = {
    version: 2,
    day: state.day ?? 0,
    agentId: aiPlayer.id,
    mode: alliesUnderPressure.length > 0 ? "protect-ally" : "frame-target",
    bluffRoleId: aiPlayer.publicClaimRoleId ?? previous?.bluffRoleId ?? "",
    framingTargetId: framingTarget?.id ?? "",
    secondaryFrameTargetId: secondaryFrameTarget?.id ?? "",
    previousFramingTargetId: previousTargetValid ? coordinationPrevious?.framingTargetId ?? "" : "",
    localPreviousFramingTargetId: previous?.framingTargetId ?? "",
    staleFramingTargetId: previous?.staleFramingTargetId ?? "",
    staleReason: previous?.staleReason ?? sharedTeamPlan?.outcome?.kind ?? "",
    protectAllyIds: alliesUnderPressure.map((entry) => entry.playerId),
    sacrificeAllyId: sacrificeCandidate?.id ?? "",
    continuity: flexibleTarget.continuity,
    pivotReason: flexibleTarget.pivotReason,
    commitment,
    flexible: true,
    riskBudget: clamp(0.26 + window.urgency * 0.42 + alliesUnderPressure.length * 0.08, 0, 1),
    publicReason: framingTarget
      ? "use-public-pressure-chain"
      : alliesUnderPressure.length > 0
        ? "reduce-ally-heat"
        : "hold-cover",
  };
  const basePlan = {
    ...draft,
    narrativeAnchors: buildNarrativeAnchors(draft),
    history: pushPlanHistory(previous, {
      day: draft.day,
      mode: draft.mode,
      framingTargetId: draft.framingTargetId,
      secondaryFrameTargetId: draft.secondaryFrameTargetId,
      protectAllyIds: draft.protectAllyIds,
      pivotReason: draft.pivotReason,
      continuity: draft.continuity,
    }),
  };
  const teamPlan = writeSharedEvilTeamPlan(state, aiPlayer, basePlan, sharedTeamPlan);
  const plan = {
    ...basePlan,
    teamPlanTargetId: teamPlan?.framingTargetId ?? "",
    teamPlanAdopted: !!sharedTeamPlan?.framingTargetId && basePlan.framingTargetId === sharedTeamPlan.framingTargetId,
    teamPlanSourceAgentIds: safeArray(teamPlan?.sourceAgentIds),
    coordinationMode: teamPlan?.continuity ?? (sharedTeamPlan ? "team-pivot" : "seed"),
    teamPlanOutcome: sharedTeamPlan?.outcome ?? null,
  };
  state.aiDialogue.evilWorldPlansByAgentId[aiPlayer.id] = plan;
  return plan;
}

export function evilWorldPlanTargetBias(plan, targetId, options = {}) {
  if (!plan || !targetId) {
    return 0;
  }
  const isKnownAlly = !!options.isKnownAlly;
  if (plan.sacrificeAllyId && plan.sacrificeAllyId === targetId) {
    return 0.04;
  }
  if (isKnownAlly || safeArray(plan.protectAllyIds).includes(targetId)) {
    return -0.1;
  }
  if (plan.framingTargetId === targetId) {
    return clamp(0.026 + (Number(plan.commitment) || 0.34) * 0.05, 0.03, 0.07);
  }
  if (plan.secondaryFrameTargetId === targetId) {
    return 0.018;
  }
  return 0;
}

export function evilWorldPlanContextLine(state, plan, targetId = "") {
  if (!plan || !targetId) {
    return "";
  }
  const target = getPlayerById(state, targetId);
  const targetName = target?.name ?? "这个位置";
  if (plan.framingTargetId === targetId && plan.continuity === "hold") {
    return `还是沿着 ${targetName} 这条看，不急着换线`;
  }
  if (plan.framingTargetId === targetId && plan.pivotReason) {
    return `这轮先转到 ${targetName}，因为台面压力有了新变化`;
  }
  if (plan.secondaryFrameTargetId === targetId) {
    return `${targetName} 先当备选压力位`;
  }
  if (plan.framingTargetId === targetId) {
    return `先看 ${targetName} 这条，台面上说得通`;
  }
  return "";
}

export function buildLightweightWorldCandidates(state, aiPlayer, options = {}) {
  if (!state || !aiPlayer) {
    return {
      kind: "lightweight-world-candidates",
      agentId: aiPlayer?.id ?? "",
      audience: options.audience ?? "public",
      candidates: [],
      topCandidateId: "",
    };
  }

  const audience = options.audience ?? "public";
  const agentView = options.agentView ?? buildAgentView(state, aiPlayer, {
    audience,
    targetId: options.targetId,
  });
  const agent = getAIAgent(state, aiPlayer);
  const window = options.window ?? evaluateGameWindow(state, aiPlayer, options);
  const selfTeam = knownSelfTeam(state, aiPlayer);
  const evilWorldPlan = options.evilWorldPlan ?? (selfTeam === "evil"
    ? buildEvilWorldPlan(state, aiPlayer, { ...options, agentView, window })
    : null);
  const candidates = [];

  getAlivePlayers(state)
    .filter((candidate) => candidate.id !== aiPlayer.id)
    .forEach((candidate) => {
      const isKnownAlly = areKnownAllies(state, aiPlayer, candidate);
      if (isKnownCurrentDemon(state, aiPlayer, candidate)) {
        return;
      }
      if (isKnownAlly && evilWorldPlan?.sacrificeAllyId !== candidate.id) {
        return;
      }

      const suspicion = suspicionForStrategyAudience(state, aiPlayer, candidate, audience);
      const publicEvidenceCount = targetEvidenceCount(agentView, agent, candidate.id, { publicOnly: true });
      const totalEvidenceCount = targetEvidenceCount(agentView, agent, candidate.id, { publicOnly: false });
      let planKind = "";
      if (evilWorldPlan?.framingTargetId === candidate.id) planKind = "evil-frame-line";
      else if (evilWorldPlan?.secondaryFrameTargetId === candidate.id) planKind = "evil-backup-line";
      else if (evilWorldPlan?.sacrificeAllyId === candidate.id) planKind = "evil-sacrifice-window";
      const evilTwinRisk = evilTwinExecutionRiskForTarget(state, aiPlayer, candidate);
      if (evilTwinRisk?.evilExecutionWin) planKind = "evil-twin-win-target";
      else if (evilTwinRisk?.protectsGood) planKind = "evil-twin-do-not-execute";
      const planBias = selfTeam === "evil"
        ? evilWorldPlanTargetBias(evilWorldPlan, candidate.id, { isKnownAlly })
        : 0;
      const evilTwinBias = evilTwinRisk?.evilExecutionWin ? 0.12 : evilTwinRisk?.protectsGood ? -0.5 : 0;
      const score = clamp(
        suspicion +
          Math.min(0.16, publicEvidenceCount * 0.04) +
          Math.min(0.1, Math.max(0, totalEvidenceCount - publicEvidenceCount) * 0.025) +
          (window.mustExecute ? 0.025 : 0) +
          planBias +
          evilTwinBias,
        0,
        1
      );

      uniquePushCandidate(candidates, {
        targetId: candidate.id,
        targetName: playerName(candidate),
        kind: planKind || (publicEvidenceCount > 0 ? "evidence-pressure-world" : "suspicion-world"),
        score: round2(score),
        weight: round2(clamp(0.22 + score * 0.68, 0.05, 0.95)),
        suspicion: round2(suspicion),
        publicEvidenceCount,
        totalEvidenceCount,
        reasons: candidateReasons({ suspicion, publicEvidenceCount, totalEvidenceCount, planKind, window }),
        riskFlags: candidateRiskFlags({ publicEvidenceCount, totalEvidenceCount, isKnownAlly, selfTeam, planKind, evilTwinRisk }),
        evilTwinExecutionRisk: evilTwinRisk,
      });
    });

  const sorted = candidates
    .sort((a, b) => b.score - a.score || b.publicEvidenceCount - a.publicEvidenceCount)
    .slice(0, MAX_WORLD_CANDIDATES);

  return {
    kind: "lightweight-world-candidates",
    agentId: aiPlayer.id,
    audience,
    candidates: sorted,
    topCandidateId: sorted[0]?.targetId ?? "",
  };
}

export function buildAIStrategyContext(state, aiPlayer, options = {}) {
  const audience = options.audience ?? "public";
  const agentView = options.agentView ?? buildAgentView(state, aiPlayer, {
    audience,
    targetId: options.targetId,
  });
  const agent = getAIAgent(state, aiPlayer);
  const window = options.window ?? evaluateGameWindow(state, aiPlayer, options);
  const selfTeam = knownSelfTeam(state, aiPlayer);
  const goodDayStrategy = evaluateGoodDayStrategy(state, aiPlayer, { ...options, window });
  const target = options.targetId ? getPlayerById(state, options.targetId) : null;
  const publicEvidenceCount = target ? targetEvidenceCount(agentView, agent, target.id, { publicOnly: true }) : 0;
  const totalEvidenceCount = target ? targetEvidenceCount(agentView, agent, target.id, { publicOnly: false }) : 0;
  const evilTwinExecutionRisk = target ? evilTwinExecutionRiskForTarget(state, aiPlayer, target) : null;
  const evilWorldPlan = selfTeam === "evil"
    ? buildEvilWorldPlan(state, aiPlayer, { ...options, agentView, window })
    : null;
  const worldCandidates = buildLightweightWorldCandidates(state, aiPlayer, {
    ...options,
    agentView,
    window,
    evilWorldPlan,
  });

  const socialRiskForAction = (action, actionTarget = target) => {
    const evidenceCount = actionTarget ? targetEvidenceCount(agentView, agent, actionTarget.id, { publicOnly: true }) : 0;
    let risk = 0.12 + window.urgency * 0.12;
    if (action === "nominate") risk += 0.18;
    if (action === "vote") risk += 0.08;
    if (aiPlayer?.beenNominatedToday) risk += 0.12;
    if (evidenceCount === 0 && actionTarget) risk += 0.08;
    if (selfTeam === "evil" && evilWorldPlan?.framingTargetId === actionTarget?.id) risk -= 0.04;
    return clamp(risk, 0, 1);
  };

  return {
    kind: "ai-strategy-context",
    agentId: aiPlayer?.id ?? "",
    audience,
    window,
    agentView,
    self: {
      team: selfTeam,
      alive: !!aiPlayer?.alive,
      nominatedToday: !!aiPlayer?.nominatedToday,
      beenNominatedToday: !!aiPlayer?.beenNominatedToday,
      persona: aiPlayer?.aiPersona ?? "steady",
    },
    target: target
      ? {
          id: target.id,
          name: target.name,
          alive: !!target.alive,
          suspicion: suspicionForStrategyAudience(state, aiPlayer, target, audience),
          publicEvidenceCount,
          totalEvidenceCount,
          isKnownAlly: areKnownAllies(state, aiPlayer, target),
          evilTwinGoodExecutionRisk: !!evilTwinExecutionRisk,
          evilTwinExecutionRisk,
        }
      : null,
    evilWorldPlan,
    evilPlanContextLine: evilWorldPlanContextLine(state, evilWorldPlan, target?.id ?? ""),
    goodDayStrategy,
    worldCandidates,
    socialRiskForAction,
  };
}

function personaVoteThresholdShift(persona) {
  if (persona === "pressure") return -0.04;
  if (persona === "shadow") return 0.01;
  if (persona === "steady") return 0.02;
  return 0;
}

function voteProbabilityFromSuspicion(suspicion, threshold) {
  return clamp(0.5 + (suspicion - threshold) * 3.1, 0.05, 0.95);
}

function publicCaseEvidenceCountForVotePressure(state, voter, nominee) {
  const currentDay = state?.day ?? 0;
  return getDialogueEvidenceForTarget(state, voter, nominee.id, { publicOnly: true, includePrivate: false })
    .filter((entry) => (entry.day ?? currentDay) === currentDay)
    .filter((entry) => !["nomination", "vote"].includes(entry.kind))
    .length;
}

function formalNominationPressureBoost(state, voter, nominee, options = {}) {
  if (!state || !voter?.id || !nominee?.id || voter.id === nominee.id) {
    return 0;
  }
  const nomination = options.formalNomination ?? null;
  if (!nomination) {
    return 0;
  }
  const aliveCount = getAlivePlayers(state).length;
  const window = options.window ?? options.strategyContext?.window ?? evaluateGameWindow(state, voter, {
    stage: "nomination",
  });
  const priorNoExecutionVoteDays = Number(window?.priorNoExecutionVoteDays ?? 0) || 0;
  const currentDayFailedVotes = safeArray(state.events?.votes)
    .filter((entry) => entry?.day === state.day && !entry.passed).length;
  const sameDayExecutionPressure =
    voter.alive !== false &&
    !options.strategyContext?.goodDayStrategy?.mayorNoExecutionWin &&
    !options.strategyContext?.goodDayStrategy?.mastermindNoExecutionWin &&
    (window?.mustExecute || Number(options.strategyContext?.goodDayStrategy?.noExecutionRisk ?? 0) >= 0.36) &&
    currentDayFailedVotes >= 2;
  let boost = 0.08;
  if (nomination.nominatorId) {
    const nominator = getPlayerById(state, nomination.nominatorId);
    if (nominator?.isHuman) {
      boost += 0.06;
      const publicCaseEvidenceCount = publicCaseEvidenceCountForVotePressure(state, voter, nominee);
      if (publicCaseEvidenceCount > 0) {
        boost += Math.min(0.2, 0.11 + publicCaseEvidenceCount * 0.09);
      }
    }
  }
  if (aliveCount <= 5) boost += 0.15;
  if (aliveCount <= 3) boost += 0.06;
  if ((state.day ?? 0) >= 3) boost += 0.04;
  if (window?.mustExecute && priorNoExecutionVoteDays >= 2) {
    boost += Math.min(0.12, priorNoExecutionVoteDays * 0.035);
  }
  if (sameDayExecutionPressure) {
    boost += Math.min(0.12, currentDayFailedVotes * 0.035);
  }
  const current = state.dayStageMeta?.executionCandidate ?? null;
  if (current?.day === state.day && current.nomineeId && current.nomineeId !== nominee.id) {
    boost += 0.08;
  }
  if (areKnownAllies(state, voter, nominee)) {
    boost *= 0.25;
  }
  return clamp(boost, 0, 0.36);
}

export function simulateCoalitionVote(state, actor, nominee, options = {}) {
  if (!state || !nominee) {
    return {
      kind: "coalition-vote-simulation",
      actorId: actor?.id ?? "",
      nomineeId: nominee?.id ?? "",
      threshold: 0,
      expectedYesVotes: 0,
      likelyPasses: false,
      margin: 0,
      voterEstimates: [],
    };
  }

  const window = options.window ?? options.strategyContext?.window ?? evaluateGameWindow(state, actor, {
    stage: "nomination",
  });
  const threshold = Number(window.voteThreshold) || voteThresholdForAlive(getAlivePlayers(state).length);
  const currentDayFailedVotes = safeArray(state.events?.votes)
    .filter((entry) => entry?.day === state.day && !entry.passed).length;
  const estimates = getAlivePlayers(state).map((voter) => {
    const selfTeam = knownSelfTeam(state, voter);
    const isKnownAlly = areKnownAllies(state, voter, nominee);
    const baseSuspicion = publicSuspicionForTarget(state, voter, nominee);
    const nominationPressure = formalNominationPressureBoost(state, voter, nominee, { ...options, window });
    const suspicion = clamp(baseSuspicion + nominationPressure, 0.01, 0.99);
    const agentView = buildAgentView(state, voter, { audience: "public", targetId: nominee.id });
    const strategyContext = buildAIStrategyContext(state, voter, {
      agentView,
      audience: "public",
      stage: "nomination",
      targetId: nominee.id,
      window,
    });
    const evidenceCount = targetEvidenceCount(agentView, getAIAgent(state, voter), nominee.id, { publicOnly: true });
    let voteThreshold = selfTeam === "evil" && !isKnownAlly ? 0.44 : 0.58;
    voteThreshold += personaVoteThresholdShift(voter.aiPersona);
    voteThreshold += voteThresholdAdjustment(strategyContext, {
      suspicion,
      evidenceCount,
      isKnownAlly,
      voterPubliclyAlive: true,
      currentDayFailedVotes,
    });
    if (window.mustExecute) voteThreshold -= 0.025;
    if (voter.id === actor?.id) voteThreshold -= 0.02;
    if (isKnownAlly) voteThreshold += 0.28;
    const evilTwinRisk = strategyContext?.target?.evilTwinExecutionRisk ?? null;
    if (evilTwinRisk?.protectsGood) voteThreshold = Math.max(voteThreshold, 1.12);
    if (evilTwinRisk?.evilExecutionWin) voteThreshold = Math.min(voteThreshold, 0.26);

    const probabilityThreshold = evilTwinRisk?.protectsGood
      ? clamp(voteThreshold, 0.18, 1.12)
      : clamp(voteThreshold, 0.18, 0.92);
    const probability = voteProbabilityFromSuspicion(suspicion, probabilityThreshold);
    return {
      voterId: voter.id,
      voterName: playerName(voter),
      probability: round2(probability),
      projectedYes: probability >= 0.5,
      suspicion: round2(suspicion),
      baseSuspicion: round2(baseSuspicion),
      nominationPressure: round2(nominationPressure),
      threshold: round2(voteThreshold),
      isKnownAlly,
      evilTwinExecutionRisk: evilTwinRisk,
    };
  });
  const expectedYesVotes = round2(estimates.reduce((sum, entry) => sum + entry.probability, 0));
  const margin = round2(expectedYesVotes - threshold);

  return {
    kind: "coalition-vote-simulation",
    actorId: actor?.id ?? "",
    nomineeId: nominee.id,
    threshold,
    expectedYesVotes,
    likelyPasses: expectedYesVotes >= threshold,
    margin,
    voterEstimates: estimates,
  };
}

export function buildAgentStrategyView(state, aiPlayer, options = {}) {
  const context = buildAIStrategyContext(state, aiPlayer, options);
  return {
    ...context,
    kind: "agent-strategy-view",
    baseKind: context.kind,
    visibility: {
      audience: context.audience,
      usesAgentView: true,
      allowsKnownAllies: context.self?.team === "evil",
    },
  };
}

export function voteThresholdAdjustment(strategyContext, details = {}) {
  const window = strategyContext?.window ?? {};
  const target = strategyContext?.target ?? {};
  const evidenceCount = Number(details.evidenceCount ?? target.totalEvidenceCount ?? 0) || 0;
  const publicEvidenceCount = Number(target.publicEvidenceCount ?? 0) || 0;
  const suspicion = Number(details.suspicion ?? target.suspicion ?? 0.5);
  const isKnownAlly = !!(details.isKnownAlly ?? target.isKnownAlly);
  const evilTwinRisk = target.evilTwinExecutionRisk ?? null;
  const voterPubliclyAlive = details.voterPubliclyAlive !== false;
  const protectedNoExecutionWin =
    !!strategyContext?.goodDayStrategy?.mayorNoExecutionWin ||
    !!strategyContext?.goodDayStrategy?.mastermindNoExecutionWin;
  const priorNoExecutionVoteDays = Number(window.priorNoExecutionVoteDays ?? 0) || 0;
  const currentDayFailedVotes = Number(details.currentDayFailedVotes ?? 0) || 0;
  const repeatedNoExecutionVotePressure =
    voterPubliclyAlive && window.mustExecute && !protectedNoExecutionWin && priorNoExecutionVoteDays >= 2;
  const sameDayExecutionPressure =
    voterPubliclyAlive &&
    !protectedNoExecutionWin &&
    (window.mustExecute || Number(strategyContext?.goodDayStrategy?.noExecutionRisk ?? 0) >= 0.36) &&
    currentDayFailedVotes >= 2;
  let adjustment = 0;

  if (isKnownAlly) {
    return 0.45;
  }
  if (evilTwinRisk?.protectsGood) {
    return 0.45;
  }
  if (evilTwinRisk?.evilExecutionWin) {
    return -0.08;
  }
  if (window.mustExecute) adjustment -= 0.035;
  if (repeatedNoExecutionVotePressure) {
    adjustment -= Math.min(0.09, priorNoExecutionVoteDays * 0.03);
  }
  if (sameDayExecutionPressure) {
    adjustment -= Math.min(0.12, currentDayFailedVotes * 0.035);
  }
  if (window.mustExecute && voterPubliclyAlive && !protectedNoExecutionWin && (window.day ?? 0) >= 4 && evidenceCount > 0) {
    adjustment -= 0.025;
  }
  if (window.lateGame) adjustment -= 0.02;
  if (window.urgency >= 0.62 && evidenceCount > 0) adjustment -= 0.015;
  if (strategyContext?.goodDayStrategy?.active) {
    adjustment -= Number(strategyContext.goodDayStrategy.voteBias ?? 0) * 0.28;
  }
  if (strategyContext?.goodDayStrategy?.mayorNoExecutionWin || strategyContext?.goodDayStrategy?.mastermindNoExecutionWin) {
    adjustment += 0.22;
  }
  if (evidenceCount <= 0 && suspicion < 0.6) adjustment += window.day <= 1 ? 0.035 : 0.02;
  if (publicEvidenceCount <= 0 && suspicion < 0.56 && !window.mustExecute) adjustment += 0.015;
  if (strategyContext?.self?.beenNominatedToday) adjustment += 0.018;

  const plan = strategyContext?.evilWorldPlan;
  if (plan?.framingTargetId && plan.framingTargetId === target.id) {
    adjustment -= plan.mode === "protect-ally" ? 0.03 : 0.02;
  } else if (plan?.protectAllyIds?.length && !isKnownAlly) {
    adjustment -= 0.012;
  }
  return clamp(adjustment, repeatedNoExecutionVotePressure || sameDayExecutionPressure ? -0.2 : -0.08, 0.12);
}

export function nominationIntentForCandidate(strategyContext, details = {}) {
  const window = strategyContext?.window ?? {};
  const targetId = details.targetId ?? strategyContext?.target?.id ?? "";
  const plan = strategyContext?.evilWorldPlan;
  if (plan?.sacrificeAllyId && plan.sacrificeAllyId === targetId) {
    return "evil-sacrifice";
  }
  if (plan?.framingTargetId && plan.framingTargetId === targetId) {
    return plan.protectAllyIds?.length ? "protective-deflection" : "evil-framing";
  }
  if (details.framing) {
    return "evil-framing";
  }
  const evidenceCount = Number(details.evidenceCount ?? 0) || 0;
  const candidateScore = Number(details.candidateScore ?? 0) || 0;
  const threshold = Number(details.threshold ?? window.voteThreshold ?? 0) || 0;
  const support = Number(details.support ?? 0) || 0;
  if (details.likelyPasses && window.mustExecute) {
    return "execution-push";
  }
  if (details.likelyPasses && support >= Math.max(1, threshold - 1)) {
    return "coalition-check";
  }
  if (details.forcePressure || (details.evidenceCount ?? 0) <= 0) {
    return "pressure-test";
  }
  if (!details.highConfidence && candidateScore < 0.56) {
    return "pressure-test";
  }
  if (strategyContext?.goodDayStrategy?.active && strategyContext.goodDayStrategy.noExecutionRisk >= 0.36) {
    return "good-avoid-no-execution";
  }
  if (strategyContext?.goodDayStrategy?.active && strategyContext.goodDayStrategy.executionValue >= 0.28) {
    return "good-execution-info";
  }
  if (details.highConfidence && (window.mustExecute || (details.candidateScore ?? 0) >= 0.62)) {
    return "execution-push";
  }
  if (support >= Math.max(1, (window.voteThreshold ?? 0) - 1) && evidenceCount > 0) {
    return "coalition-check";
  }
  return "information-pressure";
}

export function serializeStrategyContext(strategyContext) {
  if (!strategyContext) {
    return null;
  }
  return {
    kind: strategyContext.kind,
    agentId: strategyContext.agentId,
    audience: strategyContext.audience,
    self: strategyContext.self,
    target: strategyContext.target,
    window: strategyContext.window,
    evilWorldPlan: strategyContext.evilWorldPlan,
    evilPlanContextLine: strategyContext.evilPlanContextLine,
    goodDayStrategy: strategyContext.goodDayStrategy,
    worldCandidates: strategyContext.worldCandidates,
  };
}
