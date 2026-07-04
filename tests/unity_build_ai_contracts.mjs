import assert from "node:assert/strict";

import { getRoleById } from "../unity-build/BOTC_Unity_Prototype_Data/StreamingAssets/BotcJsCore/scripts/data.js";
import {
  advanceDayStage,
  beginNightPhase,
  createNewGame,
  endDayAndBeginNight,
  getHumanNightActionState,
  markPublicDiscussionRound,
  resolveNominationAndVote,
  runNight,
  skipDay,
} from "../unity-build/BOTC_Unity_Prototype_Data/StreamingAssets/BotcJsCore/scripts/engine.js";
import {
  buildAIStrategyContext,
  buildLightweightWorldCandidates,
  chooseAINomination,
  decideAIVoteWithRationale,
  evaluateGoodDayStrategy,
  initializeAI,
  refreshAIBeliefs,
  simulateCoalitionVote,
} from "../unity-build/BOTC_Unity_Prototype_Data/StreamingAssets/BotcJsCore/scripts/ai.js";
import {
  getAIAgent,
  recordPublicClaimForAgents,
  recordVoteForAgents,
} from "../unity-build/BOTC_Unity_Prototype_Data/StreamingAssets/BotcJsCore/scripts/ai_agents.js";

function fixedRng(seed = 987654321) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function applyRoleForContract(state, player, roleId) {
  const role = getRoleById(state.scriptId, roleId);
  assert.ok(role, `expected role fixture ${roleId}`);
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
  player.philosopherAbilityRoleId = null;
  player.philosopherAbilityRoleName = null;
  player.philosopherAbilityRoleIcon = null;
}

function makeUnityBuildTBState(seed = 987654321) {
  const rng = fixedRng(seed);
  const state = createNewGame({ scriptId: "tb", playerCount: 9, preferredHumanRoleId: "washerwoman" }, rng);
  initializeAI(state);
  runNight(state, rng);
  return state;
}

function moveUnityBuildToNomination(state) {
  if (state.dayStage === "private") {
    assert.equal(advanceDayStage(state, "public").ok, true);
  }
  markPublicDiscussionRound(state);
  if (state.dayStage === "public") {
    assert.equal(advanceDayStage(state, "nomination").ok, true);
  }
}

function testUnityBuildProtectsCurrentDemonAfterFangGuJump() {
  const rng = fixedRng(2026060713);
  const state = createNewGame({ scriptId: "snv", playerCount: 9, preferredHumanRoleId: "artist" }, rng);
  const originalDemon = state.players.find((player) => !player.isHuman && player.category === "demon");
  const minion = state.players.find((player) => !player.isHuman && player.category === "minion");
  const jumpTarget = state.players.find((player) => !player.isHuman && player.team === "good");
  assert.ok(originalDemon, "expected AI demon");
  assert.ok(minion, "expected AI minion");
  assert.ok(jumpTarget, "expected AI Fang Gu jump target");

  applyRoleForContract(state, originalDemon, "fang-gu");
  applyRoleForContract(state, minion, "witch");
  applyRoleForContract(state, jumpTarget, "mutant");
  state.players.forEach((player) => {
    if (!player.isHuman && player.team === "good" && player.id !== jumpTarget.id) {
      applyRoleForContract(state, player, "artist");
    }
    player.threatScore = player.id === jumpTarget.id ? 0.95 : 0.01;
  });
  state.snv.fangGuJumpUsed = false;

  initializeAI(state);
  runNight(state, rng);
  assert.equal(advanceDayStage(state, "public").ok, true);
  markPublicDiscussionRound(state);
  assert.equal(advanceDayStage(state, "nomination").ok, true);
  assert.equal(endDayAndBeginNight(state, rng).stage, "night");
  runNight(state, rng);

  assert.equal(state.snv.fangGuJumpUsed, true, "fixture should trigger Fang Gu jump in Unity build core");
  assert.equal(jumpTarget.roleId, "fang-gu", "jump target should become current Fang Gu");
  assert.equal(getAIAgent(state, minion)?.knownDemonId, jumpTarget.id, "minion should know new current demon");

  state.phase = "day";
  state.dayStage = "nomination";
  minion.suspicion[jumpTarget.id] = 0.99;
  jumpTarget.suspicion[jumpTarget.id] = 0.99;

  const minionVote = decideAIVoteWithRationale(minion, jumpTarget, state, () => 0.01);
  assert.equal(minionVote.vote, false, "Unity build minion should not vote to execute known current demon");
  assert.ok(minionVote.voteRationale.threshold >= 1, "current demon protection should force unreachable threshold");

  const selfVote = decideAIVoteWithRationale(jumpTarget, jumpTarget, state, () => 0.01);
  assert.equal(selfVote.vote, false, "Unity build current demon should not vote to execute itself");
  assert.ok(selfVote.voteRationale.threshold >= 1, "self-protection should force unreachable threshold");

  const candidates = buildLightweightWorldCandidates(state, minion, {
    audience: "public",
    evilWorldPlan: {
      mode: "protect-ally",
      protectAllyIds: [jumpTarget.id],
      sacrificeAllyId: jumpTarget.id,
      framingTargetId: "",
      secondaryFrameTargetId: "",
    },
  });
  assert.equal(
    candidates.candidates.some((candidate) => candidate.targetId === jumpTarget.id),
    false,
    "Unity build evil world candidates should never sacrifice the current demon"
  );
}

function testUnityBuildEvilTwinExecutionRiskIsViewerScoped() {
  const rng = fixedRng(2026060714);
  const state = createNewGame({ scriptId: "snv", playerCount: 9, preferredHumanRoleId: "clockmaker" }, rng);
  initializeAI(state);
  runNight(state, rng);
  initializeAI(state);

  const humanPlayer = state.players.find((player) => player.isHuman);
  const goodTwin = state.players.find((player) => !player.isHuman && player.team === "good" && player.alive);
  const ordinaryGood = state.players.find(
    (player) => !player.isHuman && player.team === "good" && player.id !== goodTwin?.id && player.alive
  );
  const evilTwin = state.players.find(
    (player) =>
      !player.isHuman &&
      player.id !== goodTwin?.id &&
      player.id !== ordinaryGood?.id &&
      player.id !== humanPlayer?.id
  );
  assert.ok(humanPlayer, "fixture should include human player");
  assert.ok(goodTwin, "fixture should include good AI twin");
  assert.ok(ordinaryGood, "fixture should include unrelated good AI");
  assert.ok(evilTwin, "fixture should include Evil Twin holder");

  applyRoleForContract(state, goodTwin, "clockmaker");
  applyRoleForContract(state, ordinaryGood, "dreamer");
  applyRoleForContract(state, evilTwin, "evil-twin");
  state.snv.evilTwinPair = {
    evilTwinId: evilTwin.id,
    goodTwinId: goodTwin.id,
    opposingTwinId: goodTwin.id,
  };
  state.snv.snakeCharmerPoisonedIds = [];
  const aliveIds = new Set([humanPlayer.id, goodTwin.id, ordinaryGood.id, evilTwin.id]);
  state.players.forEach((player) => {
    player.alive = aliveIds.has(player.id);
    player.nominatedToday = false;
    player.beenNominatedToday = false;
    player.ghostVoteAvailable = false;
    player.poisoned = false;
    player.poisonedTomorrowDay = false;
  });
  initializeAI(state);

  if (state.dayStage === "private") {
    assert.equal(advanceDayStage(state, "public").ok, true);
  }
  markPublicDiscussionRound(state);
  if (state.dayStage === "public") {
    assert.equal(advanceDayStage(state, "nomination").ok, true);
  }

  goodTwin.suspicion[goodTwin.id] = 0.99;
  ordinaryGood.suspicion[goodTwin.id] = 0.99;

  const protectedContext = buildAIStrategyContext(state, goodTwin, {
    stage: "nomination",
    targetId: goodTwin.id,
  });
  assert.equal(
    protectedContext.target?.evilTwinExecutionRisk?.protectsGood,
    true,
    "Unity build Good Twin should know self-execution gives evil the win"
  );

  const hiddenContext = buildAIStrategyContext(state, ordinaryGood, {
    stage: "nomination",
    targetId: goodTwin.id,
  });
  assert.equal(
    hiddenContext.target?.evilTwinExecutionRisk,
    null,
    "Unity build unrelated good AI should not receive hidden Evil Twin pair knowledge"
  );

  const protectedVote = decideAIVoteWithRationale(goodTwin, goodTwin, state, () => 0.99);
  assert.equal(protectedVote.vote, false, "Unity build Good Twin should refuse self-execution");
  assert.ok(
    (protectedVote.voteRationale?.strategyShift ?? 0) >= 0.4,
    "Unity build Good Twin vote should expose the Evil Twin protection threshold shift"
  );

  const ordinaryVote = decideAIVoteWithRationale(ordinaryGood, goodTwin, state, () => 0.99);
  assert.equal(
    ordinaryVote.vote,
    true,
    "Unity build ordinary good voter should still follow visible suspicion"
  );

  const coalition = simulateCoalitionVote(state, evilTwin, goodTwin, {
    formalNomination: { nominatorId: evilTwin.id },
  });
  const goodTwinEstimate = coalition.voterEstimates.find((entry) => entry.voterId === goodTwin.id);
  const ordinaryEstimate = coalition.voterEstimates.find((entry) => entry.voterId === ordinaryGood.id);
  assert.ok(goodTwinEstimate?.probability <= 0.2, "Unity build coalition should project Good Twin refusing self-execution");
  assert.equal(
    goodTwinEstimate?.evilTwinExecutionRisk?.protectsGood,
    true,
    "Unity build coalition estimate should carry the Good Twin protection reason"
  );
  assert.equal(
    ordinaryEstimate?.evilTwinExecutionRisk,
    null,
    "Unity build coalition should keep Evil Twin knowledge viewer-scoped"
  );
}

function testUnityBuildEvilTeamPlanCoordinatesNominationAcrossAllies() {
  const state = makeUnityBuildTBState(2026060717);
  assert.equal(advanceDayStage(state, "public").ok, true, "fixture should enter public discussion");
  markPublicDiscussionRound(state);
  assert.equal(advanceDayStage(state, "nomination").ok, true, "fixture should enter nomination");

  const evilPlayers = state.players.filter((player) => !player.isHuman && player.team === "evil" && player.alive);
  const seedEvil = evilPlayers[0];
  const adoptingEvil = evilPlayers[1];
  const targets = state.players.filter((player) => !player.isHuman && player.team === "good" && player.alive);
  const teamTarget = targets[0];
  const localRunnerUp = targets[1];

  assert.ok(seedEvil && adoptingEvil, "expected two evil AIs for team coordination");
  assert.ok(teamTarget && localRunnerUp, "expected two good targets");

  state.players.forEach((player) => {
    seedEvil.suspicion[player.id] = player.id === seedEvil.id ? 0.01 : 0.2;
    adoptingEvil.suspicion[player.id] = player.id === adoptingEvil.id ? 0.01 : 0.2;
    if (!player.isHuman && player.id !== adoptingEvil.id) {
      player.nominatedToday = true;
    }
    if (player.id === teamTarget.id || player.id === localRunnerUp.id) {
      player.beenNominatedToday = false;
    }
  });

  seedEvil.suspicion[teamTarget.id] = 0.74;
  seedEvil.suspicion[localRunnerUp.id] = 0.24;
  const seedContext = buildAIStrategyContext(state, seedEvil, {
    audience: "public",
    stage: "nomination",
    targetId: teamTarget.id,
  });
  assert.equal(seedContext.evilWorldPlan?.framingTargetId, teamTarget.id, "first evil AI should seed the team frame");
  assert.equal(
    state.aiDialogue?.evilTeamWorldPlan?.framingTargetId,
    teamTarget.id,
    "team plan should persist the shared frame target"
  );

  adoptingEvil.suspicion[teamTarget.id] = 0.58;
  adoptingEvil.suspicion[localRunnerUp.id] = 0.62;
  const adoptingContext = buildAIStrategyContext(state, adoptingEvil, {
    audience: "public",
    stage: "nomination",
    targetId: localRunnerUp.id,
  });
  assert.equal(
    adoptingContext.evilWorldPlan?.framingTargetId,
    teamTarget.id,
    "second evil AI should hold the shared frame when its local runner-up is only slightly higher"
  );
  assert.equal(adoptingContext.evilWorldPlan?.teamPlanAdopted, true, "second evil AI should mark the shared plan as adopted");

  const proposal = chooseAINomination(state);
  assert.ok(proposal, "expected a coordinated evil nomination");
  assert.equal(proposal.nominatorId, adoptingEvil.id, "fixture leaves only the second evil AI able to nominate");
  assert.equal(proposal.nomineeId, teamTarget.id, "evil nomination should follow the shared team frame target");
  assert.equal(proposal.evilWorldPlan?.teamPlanAdopted, true, "nomination metadata should retain team-plan adoption");
  assert.ok(
    state.aiDialogue.evilTeamWorldPlan?.sourceAgentIds?.includes(seedEvil.id) &&
      state.aiDialogue.evilTeamWorldPlan?.sourceAgentIds?.includes(adoptingEvil.id),
    "shared plan should record both participating evil agents"
  );
}

function testUnityBuildEvilTeamPlanPivotsAfterFailedVoteResult() {
  const state = makeUnityBuildTBState(2026060718);
  assert.equal(advanceDayStage(state, "public").ok, true, "fixture should enter public discussion");
  markPublicDiscussionRound(state);
  assert.equal(advanceDayStage(state, "nomination").ok, true, "fixture should enter nomination");

  const evilPlayers = state.players.filter((player) => !player.isHuman && player.team === "evil" && player.alive);
  const seedEvil = evilPlayers[0];
  const adoptingEvil = evilPlayers[1];
  const targets = state.players.filter((player) => !player.isHuman && player.team === "good" && player.alive);
  const failedTeamTarget = targets[0];
  const newTarget = targets[1];
  const conflictingClaimant = targets[2];

  assert.ok(seedEvil && adoptingEvil, "expected two evil AIs for team feedback");
  assert.ok(failedTeamTarget && newTarget, "expected two good targets");
  assert.ok(conflictingClaimant, "expected a second public claimant to create durable pressure");

  state.players.forEach((player) => {
    seedEvil.suspicion[player.id] = player.id === seedEvil.id ? 0.01 : 0.2;
    adoptingEvil.suspicion[player.id] = player.id === adoptingEvil.id ? 0.01 : 0.2;
  });
  seedEvil.suspicion[failedTeamTarget.id] = 0.76;
  buildAIStrategyContext(state, seedEvil, {
    audience: "public",
    stage: "nomination",
    targetId: failedTeamTarget.id,
  });
  adoptingEvil.suspicion[failedTeamTarget.id] = 0.6;
  adoptingEvil.suspicion[newTarget.id] = 0.63;
  const held = buildAIStrategyContext(state, adoptingEvil, {
    audience: "public",
    stage: "nomination",
    targetId: newTarget.id,
  });
  assert.equal(held.evilWorldPlan?.framingTargetId, failedTeamTarget.id, "fixture should start from a shared team line");

  const failedVote = {
    day: state.day,
    nominatorId: seedEvil.id,
    nomineeId: failedTeamTarget.id,
    yesVotes: 1,
    threshold: 5,
    votes: [],
    passed: false,
  };
  state.events.votes.push(failedVote);
  recordVoteForAgents(state, failedVote);
  state.day += 1;
  state.dayStage = "nomination";
  state.dayStageMeta.publicRounds = 1;
  state.players.forEach((player) => {
    player.nominatedToday = !player.isHuman && player.id !== adoptingEvil.id;
    player.beenNominatedToday = false;
  });
  adoptingEvil.dialogueBias = adoptingEvil.dialogueBias ?? {};
  adoptingEvil.dialogueBias[failedTeamTarget.id] = -0.18;
  adoptingEvil.dialogueBias[newTarget.id] = 0.55;
  [newTarget, conflictingClaimant].forEach((player) => {
    const claim = {
      day: state.day,
      playerId: player.id,
      roleId: "washerwoman",
      private: false,
    };
    state.events.claims.push(claim);
    recordPublicClaimForAgents(state, claim);
  });
  refreshAIBeliefs(state);

  const pivot = buildAIStrategyContext(state, adoptingEvil, {
    audience: "public",
    stage: "nomination",
    targetId: newTarget.id,
  });
  assert.equal(pivot.evilWorldPlan?.framingTargetId, newTarget.id, "failed team vote should release the stale shared frame");
  assert.equal(
    pivot.evilWorldPlan?.staleFramingTargetId,
    failedTeamTarget.id,
    "pivot should retain the failed target as feedback context"
  );
  assert.equal(
    pivot.evilWorldPlan?.staleReason,
    "failed-vote-release",
    "pivot should explain why the old team plan was released"
  );

  const proposal = chooseAINomination(state);
  assert.ok(proposal, "expected an evil nomination after failed vote feedback");
  assert.equal(proposal.nominatorId, adoptingEvil.id, "fixture leaves only the adopting evil AI able to nominate");
  assert.equal(proposal.nomineeId, newTarget.id, "evil nomination should pivot to the stronger new target after a failed vote");
}

function testUnityBuildGoodAIProtectsPublicMayorFinalThreeNoExecutionWin() {
  const rng = fixedRng(2026060715);
  const state = createNewGame({ scriptId: "tb", playerCount: 9, preferredHumanRoleId: "washerwoman" }, rng);
  initializeAI(state);
  runNight(state, rng);
  initializeAI(state);

  const humanPlayer = state.players.find((player) => player.isHuman);
  const mayor = state.players.find(
    (player) => !player.isHuman && player.team === "good" && player.apparentTeam !== "evil" && player.alive
  );
  const demon = state.players.find((player) => !player.isHuman && player.category === "demon" && player.alive);
  assert.ok(humanPlayer, "fixture should include human player");
  assert.ok(mayor, "fixture should include good AI Mayor candidate");
  assert.ok(demon, "fixture should include evil demon");

  applyRoleForContract(state, mayor, "mayor");
  applyRoleForContract(state, demon, "imp");
  state.players.forEach((player) => {
    player.alive = [humanPlayer.id, mayor.id, demon.id].includes(player.id);
    player.nominatedToday = false;
    player.beenNominatedToday = false;
  });
  initializeAI(state);

  mayor.publicClaimRoleId = "mayor";
  mayor.publicClaimRoleName = mayor.roleName;
  const claim = {
    day: state.day,
    playerId: mayor.id,
    roleId: "mayor",
    private: false,
  };
  state.events.claims.push(claim);
  recordPublicClaimForAgents(state, claim);

  if (state.dayStage === "private") {
    assert.equal(advanceDayStage(state, "public").ok, true);
  }
  markPublicDiscussionRound(state);
  if (state.dayStage === "public") {
    assert.equal(advanceDayStage(state, "nomination").ok, true);
  }
  state.players
    .filter((player) => !player.isHuman && player.id !== mayor.id)
    .forEach((player) => {
      player.nominatedToday = true;
    });

  const strategy = evaluateGoodDayStrategy(state, mayor, { stage: "nomination" });
  assert.equal(strategy.mayorNoExecutionWin, true, "Unity build should recognize final-three Mayor no-execution win");
  assert.equal(strategy.recommendedPublicAct, "hold-for-mayor-win");
  assert.equal(chooseAINomination(state), null, "Unity build good AI should not nominate away a Mayor win");

  demon.nominatedToday = false;
  const result = resolveNominationAndVote(
    state,
    {
      nominatorId: demon.id,
      nomineeId: mayor.id,
      humanVoteYes: false,
      decideAIVote: decideAIVoteWithRationale,
    },
    rng
  );
  assert.equal(result.accepted, true, result.reason);
  const mayorVote = result.votes.find((entry) => entry.voterId === mayor.id);
  assert.equal(mayorVote?.vote, false, "Unity build Mayor should vote no to preserve no-execution win");
  assert.ok((mayorVote?.voteRationale?.strategyShift ?? 0) >= 0.1, "Mayor vote should expose conservative shift");
  assert.equal(result.passed, false, "evil nomination should fail when Mayor no-execution is preserved");
  assert.equal(skipDay(state, rng), true, "day end should resolve no-execution");
  assert.equal(state.gameOver, true, "Mayor no-execution should end the Unity build game");
  assert.equal(state.winner, "good", "Unity build Mayor no-execution should give good the win");
}

function testUnityBuildGoodAIProtectsMastermindExtraDayNoExecutionWin() {
  const rng = fixedRng(2026060716);
  const state = createNewGame({ scriptId: "bmr", playerCount: 9, preferredHumanRoleId: "grandmother" }, rng);
  initializeAI(state);
  runNight(state, rng);
  initializeAI(state);

  const humanPlayer = state.players.find((player) => player.isHuman);
  const goodAI = state.players.find(
    (player) => !player.isHuman && player.team === "good" && player.apparentTeam !== "evil" && player.alive
  );
  const mastermind = state.players.find((player) => !player.isHuman && player.id !== goodAI?.id && player.id !== humanPlayer?.id);
  const deadDemon = state.players.find(
    (player) => !player.isHuman && player.id !== goodAI?.id && player.id !== humanPlayer?.id && player.id !== mastermind?.id
  );
  assert.ok(humanPlayer, "fixture should include human player");
  assert.ok(goodAI, "fixture should include good AI");
  assert.ok(mastermind, "fixture should include Mastermind");
  assert.ok(deadDemon, "fixture should include dead demon fixture");

  applyRoleForContract(state, mastermind, "mastermind");
  applyRoleForContract(state, deadDemon, "pukka");
  state.players.forEach((player) => {
    player.alive = [humanPlayer.id, goodAI.id, mastermind.id].includes(player.id);
    player.nominatedToday = false;
    player.beenNominatedToday = false;
    player.ghostVoteAvailable = false;
    player.suspicion = player.suspicion ?? {};
    player.suspicion[goodAI.id] = 0.12;
  });
  state.bmr.mastermindPendingDay = state.day;
  state.bmr.zombuulHiddenDead = false;
  state.bmr.zombuulHiddenDeadPlayerId = null;
  initializeAI(state);

  if (state.dayStage === "private") {
    assert.equal(advanceDayStage(state, "public").ok, true);
  }
  markPublicDiscussionRound(state);
  if (state.dayStage === "public") {
    assert.equal(advanceDayStage(state, "nomination").ok, true);
  }
  state.players
    .filter((player) => !player.isHuman && player.id !== goodAI.id)
    .forEach((player) => {
      player.nominatedToday = true;
    });

  const strategy = evaluateGoodDayStrategy(state, goodAI, { stage: "nomination" });
  assert.equal(strategy.mastermindNoExecutionWin, true, "Unity build should recognize Mastermind no-execution win");
  assert.equal(strategy.recommendedPublicAct, "hold-for-mastermind-win");
  assert.ok(
    strategy.reasons.includes("mastermind-extra-day-no-execution-win"),
    "strategy should explain the Mastermind no-execution incentive"
  );
  assert.equal(chooseAINomination(state), null, "Unity build good AI should not nominate away a Mastermind win");

  mastermind.nominatedToday = false;
  const result = resolveNominationAndVote(
    state,
    {
      nominatorId: mastermind.id,
      nomineeId: goodAI.id,
      humanVoteYes: false,
      decideAIVote: decideAIVoteWithRationale,
    },
    rng
  );
  assert.equal(result.accepted, true, result.reason);
  const goodVote = result.votes.find((entry) => entry.voterId === goodAI.id);
  assert.equal(goodVote?.vote, false, "Unity build good AI should vote no to preserve Mastermind win");
  assert.ok((goodVote?.voteRationale?.strategyShift ?? 0) >= 0.1, "Mastermind vote should expose conservative shift");
  assert.equal(result.passed, false, "evil nomination should fail when Mastermind no-execution is preserved");
  assert.equal(skipDay(state, rng), true, "day end should resolve Mastermind no-execution");
  assert.equal(state.gameOver, true, "Mastermind no-execution should end the Unity build game");
  assert.equal(state.winner, "good", "Unity build Mastermind no-execution should give good the win");
}

function testUnityBuildZombuulWakesAfterPreventedExecutionDeath() {
  const rng = fixedRng(2026060811);
  const state = createNewGame({ scriptId: "bmr", playerCount: 9, preferredHumanRoleId: "zombuul" }, rng);
  initializeAI(state);
  runNight(state, rng);
  moveUnityBuildToNomination(state);

  const target = state.players.find((player) => !player.isHuman && player.alive && player.team === "good");
  const nominator = state.players.find((player) => !player.isHuman && player.alive && player.id !== target?.id);
  assert.ok(target, "fixture should include a protected execution target");
  assert.ok(nominator, "fixture should include a nominator");
  state.bmr.devilsAdvocateProtectedId = target.id;

  const result = resolveNominationAndVote(
    state,
    {
      nominatorId: nominator.id,
      nomineeId: target.id,
      humanVoteYes: true,
      decideAIVote: () => true,
    },
    rng
  );

  assert.equal(result.accepted, true, result.reason);
  assert.equal(result.onBlock, true, "Unity build fixture should put the protected target on the block");
  assert.equal(skipDay(state, rng), true, "Unity build day end should resolve the protected execution");
  assert.equal(target.alive, true, "protected execution should not kill the target");
  assert.ok(
    state.events.executions.some((entry) => entry.day === state.day && entry.nomineeId === target.id && entry.died === false),
    "protected execution should be recorded without becoming a death today"
  );

  beginNightPhase(state);
  const action = getHumanNightActionState(state);
  assert.equal(action.available, true, action.reason);
  assert.equal(action.roleId, "zombuul", "Unity build Zombuul should wake after a day with no actual deaths");
}

testUnityBuildProtectsCurrentDemonAfterFangGuJump();
testUnityBuildEvilTwinExecutionRiskIsViewerScoped();
testUnityBuildEvilTeamPlanCoordinatesNominationAcrossAllies();
testUnityBuildEvilTeamPlanPivotsAfterFailedVoteResult();
testUnityBuildGoodAIProtectsPublicMayorFinalThreeNoExecutionWin();
testUnityBuildGoodAIProtectsMastermindExtraDayNoExecutionWin();
testUnityBuildZombuulWakesAfterPreventedExecutionDeath();

console.log("unity build ai contracts ok");
