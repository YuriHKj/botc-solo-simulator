import assert from "node:assert/strict";

import { getRoleById } from "../scripts/data.js";
import {
  advanceDayStage,
  createNewGame,
  endDayAndBeginNight,
  getPendingStorytellerActionState,
  markPublicDiscussionRound,
  openNominationWindow,
  privateChatLimitForDay,
  processDayDeath,
  resolveNominationAndVote,
  resolvePendingStorytellerAction,
  runNight,
  skipDay,
} from "../scripts/engine.js";
import {
  applyHumanSpeechCadence,
  applySpeechBudget,
  acceptAIProactiveWhisper,
  buildAgentStrategyView,
  buildAIStrategyContext,
  buildAIThoughtFrame,
  buildLightweightWorldCandidates,
  chooseAINomination,
  claimDisclosurePlanner,
  createNominationDebate,
  declineAIProactiveWhisper,
  decideAIVote,
  decideAIVoteWithRationale,
  evaluateGameWindow,
  evaluateGoodDayStrategy,
  getAIScriptPressureProfile,
  getClaimDisclosureState,
  getAIInsightRows,
  initializeAI,
  recordNominationDebateResponse,
  refreshAIBeliefs,
  runAIConversationStep,
  runAIDiscussion,
  runAIToAIPrivateWhispers,
  runAIProactiveWhispers,
  runPrivateWhisper,
  simulateCoalitionVote,
} from "../scripts/ai.js";
import {
  addAgentObservation,
  assertNoHiddenInfoLeakForDialogue,
  buildAgentView,
  getAgentEvidence,
  getAgentKnowledgeGraph,
  getAgentSourceTrustForPlayer,
  getAIAgent,
  getDialogueEvidenceForTarget,
  getKnownBluffRoleIds,
  getSuspicionTrailForTarget,
  getVisibleClaims,
  recordPublicSpeechForAgents,
  recordPrivateInfoForAgent,
  recordPublicClaimForAgents,
  recordVoteForAgents,
  summarizeEvidenceForDialogue,
} from "../scripts/ai_agents.js";
import {
  PLAYER_VISIBLE_FORBIDDEN_TERMS,
  layeredCorpusPaths,
  pickLayeredSpeech,
} from "../scripts/ai_speech_renderer.js";
import { rememberClaimDisclosure } from "../scripts/ai_claim_policy.js";
import {
  evilWorldPlanTargetBias,
} from "../scripts/ai_strategy.js";
import { ensureCrossDayTargetSwitchExplanation } from "../scripts/ai_public_discussion.js";

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

function testLayeredSpeechCorpusResolvesByTeamPersonaAndAct() {
  const evilPressure = pickLayeredSpeech(
    {
      layer: "publicDiscussion",
      audience: "public",
      team: "evil",
      persona: "pressure",
      act: "pressure",
    },
    { targetName: "5号", shortReason: "票型反着走", reasonText: "票型反着走" },
    fixedRng(2026051301),
    ["fallback"]
  );
  assert.notEqual(evilPressure, "fallback", "layered speech should resolve evil public pressure text");
  assert.match(evilPressure, /5号|票型反着走/, "layered speech should interpolate values");

  const privateShadow = pickLayeredSpeech(
    {
      layer: "privateSocial",
      audience: "private",
      persona: "shadow",
      act: "syncOpener",
    },
    {},
    fixedRng(2026051302),
    ["fallback"]
  );
  assert.notEqual(privateShadow, "fallback", "layered speech should resolve persona private opener");

  const paths = layeredCorpusPaths({
    layer: "claimPolicy",
    audience: "public",
    team: "evil",
    persona: "pressure",
    act: "publicClaim",
  });
  assert.equal(paths[0], "layers.claimPolicy.public.team.evil.pressure.publicClaim");
  assert.ok(paths.includes("layers.claimPolicy.public.team.evil.default.publicClaim"));
  assert.ok(paths.includes("layers.claimPolicy.public.act.publicClaim"));
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

function testFangGuJumpRefreshesAIEvilRecognition() {
  const rng = fixedRng(2026060601);
  const state = createNewGame({ scriptId: "snv", playerCount: 9, preferredHumanRoleId: "clockmaker" }, rng);
  const demon = state.players.find((player) => !player.isHuman && player.category === "demon");
  const minion = state.players.find((player) => !player.isHuman && player.category === "minion");
  const jumpTarget = state.players.find((player) => !player.isHuman && player.team === "good");

  assert.ok(demon, "expected AI demon when human is forced good");
  assert.ok(minion, "expected AI minion when human is forced good");
  assert.ok(jumpTarget, "expected good AI Fang Gu jump target");

  applyRoleForContract(state, demon, "fang-gu");
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
  const nightOne = runNight(state, rng);
  assert.equal(nightOne?.stage, "day", "night one should dawn without Fang Gu killing");
  assert.equal(state.day, 1, "fixture should be on day one after first night");
  assert.equal(demon.alive, true, "Fang Gu should not kill on night one");
  assert.equal(getAIAgent(state, minion).knownDemonId, demon.id, "minion should initially know the original demon");

  assert.equal(advanceDayStage(state, "public").ok, true, "fixture should enter public discussion");
  markPublicDiscussionRound(state);
  assert.equal(advanceDayStage(state, "nomination").ok, true, "fixture should enter nomination");
  const nightTwo = endDayAndBeginNight(state, rng);
  assert.equal(nightTwo.stage, "night", nightTwo.reason);
  runNight(state, rng);

  assert.equal(state.snv.fangGuJumpUsed, true, "Fang Gu should consume the outsider jump");
  assert.equal(demon.alive, false, "original Fang Gu should die after jumping");
  assert.equal(jumpTarget.alive, true, "outsider target should survive as the new demon");
  assert.equal(jumpTarget.roleId, "fang-gu", "outsider should become Fang Gu");
  assert.equal(jumpTarget.category, "demon", "outsider should become the demon category");
  assert.equal(jumpTarget.team, "evil", "outsider should become evil");

  const newDemonAgent = getAIAgent(state, jumpTarget);
  const minionAgent = getAIAgent(state, minion);
  assert.equal(newDemonAgent.knownSelfRoleId, "fang-gu", "new Fang Gu AI should know its new role");
  assert.equal(newDemonAgent.knownSelfTeam, "evil", "new Fang Gu AI should know its new team");
  assert.equal(newDemonAgent.knownDemonId, jumpTarget.id, "new Fang Gu AI should recognize itself as current demon");
  assert.ok(newDemonAgent.knownAllyIds.includes(minion.id), "new Fang Gu AI should know the current minion");
  assert.equal(newDemonAgent.knownAllyIds.includes(demon.id), false, "new Fang Gu AI should not coordinate around the dead old demon");
  assert.equal(newDemonAgent.knownBluffRoleIds.length, 3, "new Fang Gu AI should inherit demon bluff knowledge");

  assert.equal(minionAgent.knownDemonId, jumpTarget.id, "minion should retarget evil coordination to the new demon");
  assert.ok(minionAgent.knownAllyIds.includes(jumpTarget.id), "minion should know the new demon as an evil ally");
  assert.equal(minionAgent.knownAllyIds.includes(demon.id), false, "minion should drop the dead old demon from live evil allies");
  assert.equal(minionAgent.knownBluffRoleIds.length, 0, "minion should still not receive demon bluffs");
}

function testEvilAIVoteProtectsCurrentDemonAfterFangGuJump() {
  const rng = fixedRng(2026060603);
  const state = createNewGame({ scriptId: "snv", playerCount: 9, preferredHumanRoleId: "clockmaker" }, rng);
  const originalDemon = state.players.find((player) => !player.isHuman && player.category === "demon");
  const minion = state.players.find((player) => !player.isHuman && player.category === "minion");
  const jumpTarget = state.players.find((player) => !player.isHuman && player.team === "good");

  assert.ok(originalDemon, "expected AI demon when human is forced good");
  assert.ok(minion, "expected AI minion");
  assert.ok(jumpTarget, "expected good AI Fang Gu jump target");

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

  assert.equal(state.snv.fangGuJumpUsed, true, "fixture should trigger the Fang Gu jump");
  assert.equal(jumpTarget.roleId, "fang-gu", "jump target should become the new Fang Gu");
  assert.equal(jumpTarget.alive, true, "new Fang Gu should be alive before the vote");
  assert.equal(getAIAgent(state, minion)?.knownDemonId, jumpTarget.id, "minion should know the new current demon");

  state.phase = "day";
  state.dayStage = "nomination";
  minion.suspicion[jumpTarget.id] = 0.99;
  jumpTarget.suspicion[jumpTarget.id] = 0.99;

  const minionVote = decideAIVoteWithRationale(minion, jumpTarget, state, () => 0.01);
  assert.equal(minionVote.vote, false, "evil minion should not vote to execute the known current demon even under extreme public pressure");
  assert.ok(minionVote.voteRationale.threshold >= 1, "current demon protection should force an unreachable vote threshold");

  const selfVote = decideAIVoteWithRationale(jumpTarget, jumpTarget, state, () => 0.01);
  assert.equal(selfVote.vote, false, "current demon AI should not vote to execute itself under public pressure");
  assert.ok(selfVote.voteRationale.threshold >= 1, "self-protection should force an unreachable vote threshold");
}

function testEvilWorldCandidatesNeverSacrificeCurrentDemon() {
  const state = makeTBState();
  const minion = state.players.find((player) => !player.isHuman && player.category === "minion" && player.alive);
  const demon = state.players.find((player) => !player.isHuman && player.category === "demon" && player.alive);
  assert.ok(minion, "fixture needs an evil minion");
  assert.ok(demon, "fixture needs a current demon");
  assert.equal(getAIAgent(state, minion)?.knownDemonId, demon.id, "minion should know the current demon");

  minion.suspicion[demon.id] = 0.99;
  demon.beenNominatedToday = true;
  const candidates = buildLightweightWorldCandidates(state, minion, {
    audience: "public",
    evilWorldPlan: {
      mode: "protect-ally",
      protectAllyIds: [demon.id],
      sacrificeAllyId: demon.id,
      framingTargetId: "",
      secondaryFrameTargetId: "",
    },
  });

  assert.equal(
    candidates.candidates.some((candidate) => candidate.targetId === demon.id),
    false,
    "current demon should not enter evil world candidates even if a stale plan marks it as sacrificeAllyId"
  );
}

function testBarberSwapRefreshesAIAgentRoleAndEvilRecognition() {
  const rng = fixedRng(2026060602);
  const state = createNewGame({ scriptId: "snv", playerCount: 9, preferredHumanRoleId: "fang-gu" }, rng);
  const humanDemon = state.players.find((player) => player.isHuman);
  const barber = state.players.find((player) => !player.isHuman && player.team === "good");
  const goodTarget = state.players.find((player) => !player.isHuman && player.team === "good" && player.id !== barber?.id);
  const evilTarget = state.players.find((player) => !player.isHuman && player.team === "evil" && player.category !== "demon");

  assert.ok(humanDemon, "fixture should have a human demon");
  assert.ok(barber, "fixture should have a Barber candidate");
  assert.ok(goodTarget, "fixture should have a good swap target");
  assert.ok(evilTarget, "fixture should have an evil non-demon swap target");

  state.players
    .filter((player) => !player.isHuman && player.roleId === "snake-charmer")
    .forEach((player) => applyRoleForContract(state, player, "artist"));
  initializeAI(state);
  runNight(state, rng);
  applyRoleForContract(state, barber, "barber");
  applyRoleForContract(state, goodTarget, "artist");
  applyRoleForContract(state, evilTarget, "witch");
  initializeAI(state);
  assert.equal(getAIAgent(state, evilTarget).knownSelfRoleId, "witch", "evil target starts as Witch");
  assert.equal(getAIAgent(state, evilTarget).knownDemonId, humanDemon.id, "evil target initially knows the demon");

  processDayDeath(state, barber, "contract-barber-death", {}, rng);
  const action = getPendingStorytellerActionState(state);
  assert.equal(action.available, true, "human demon should receive Barber swap gate");
  assert.equal(action.type, "barber-swap");
  const result = resolvePendingStorytellerAction(state, { targetIds: [goodTarget.id, evilTarget.id] });
  assert.equal(result.ok, true, result.reason);

  assert.equal(goodTarget.roleId, "witch", "good target should receive the Witch character");
  assert.equal(goodTarget.team, "good", "Barber swap should preserve good alignment");
  assert.equal(evilTarget.roleId, "artist", "evil target should receive the Artist character");
  assert.equal(evilTarget.team, "evil", "Barber swap should preserve evil alignment");

  const goodAgent = getAIAgent(state, goodTarget);
  const evilAgent = getAIAgent(state, evilTarget);
  assert.equal(goodAgent.knownSelfRoleId, "witch", "good AI should know its new Barber-swapped character");
  assert.equal(goodAgent.knownSelfTeam, "good", "good AI should not infer evil alignment from the Witch character");
  assert.equal(goodAgent.knownDemonId, null, "good AI with a minion character should not receive demon knowledge");
  assert.equal(goodAgent.knownAllyIds.length, 0, "good AI should not retain evil allies after Barber swap");

  assert.equal(evilAgent.knownSelfRoleId, "artist", "evil AI should know its new Barber-swapped character");
  assert.equal(evilAgent.knownSelfTeam, "evil", "evil AI should keep its true alignment after Barber swap");
  assert.equal(evilAgent.knownDemonId, humanDemon.id, "evil AI should still coordinate around the current demon");
  assert.ok(evilAgent.knownAllyIds.includes(humanDemon.id), "evil AI should know the current demon as an ally");
  assert.equal(evilAgent.knownMinionIds.includes(evilTarget.id), false, "evil Artist should not remain classified as a minion");
  assert.equal(evilAgent.knownBluffRoleIds.length, 0, "non-demon evil AI should not receive demon bluffs after Barber swap");
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
      .map((player) => ({
        id: player.id,
        suspicion: player.suspicion,
        reasonFlags: player.reasonFlags,
        trail: getAIAgent(state, player)?.beliefTrailByPlayerId ?? {},
      }))
  );

  const rows = getAIInsightRows(state);
  assert.ok(rows.length > 0, "insight rows should still render");

  const after = JSON.stringify(
    state.players
      .filter((player) => !player.isHuman)
      .map((player) => ({
        id: player.id,
        suspicion: player.suspicion,
        reasonFlags: player.reasonFlags,
        trail: getAIAgent(state, player)?.beliefTrailByPlayerId ?? {},
      }))
  );
  assert.equal(after, before, "rendering AI insight rows should not mutate player belief fields");
}

function observationKinds(agent, kind) {
  return (agent.observations ?? []).filter((entry) => entry.kind === kind);
}

function evidenceKinds(state, player, kind) {
  return getAgentEvidence(state, player, { kind });
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
  assert.ok(
    evidenceKinds(state, evilAI, "night-info").every((entry) => entry.visibility === "private"),
    "night info should also become private evidence"
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
      assert.ok(
        evidenceKinds(state, player, "public-speech").every((entry) => entry.visibility === "public"),
        `${player.name} should store public discussion as public evidence`
      );
    });
}

function testConversationClockStepUsesSoftClock() {
  const state = makeTBState();
  const result = advanceDayStage(state, "public");
  assert.equal(result.ok, true, result.reason);

  const step = runAIConversationStep(state, fixedRng(20260529));
  assert.equal(step.ok, true, step.reason);
  assert.ok(["opening", "response", "crossfire", "nomination-ready", "cooldown"].includes(step.publicConversation.clock));
  assert.equal(state.dayStageMeta.publicConversation.step, 1);
  assert.ok(state.dayStageMeta.publicRounds >= 1, "conversation step should still satisfy legacy phase guards");
  assert.ok(
    state.events.speeches.some((entry) => !entry.private && entry.playerId === step.speakerId),
    "conversation step should emit one public speech"
  );
}

function assertNoPlayerVisibleForbiddenTerms(text, context) {
  const value = `${text ?? ""}`;
  for (const term of PLAYER_VISIBLE_FORBIDDEN_TERMS) {
    assert.equal(value.includes(term), false, `${context} should not expose internal analysis term "${term}": ${value}`);
  }
}

function testPublicConversationStepsExposeProgressionWithoutInternalTerms() {
  const state = makeTBState();
  const result = advanceDayStage(state, "public");
  assert.equal(result.ok, true, result.reason);

  const steps = [1, 2, 3].map((index) => {
    const step = runAIConversationStep(state, fixedRng(2026061300 + index));
    assert.equal(step.ok, true, step.reason);
    return step;
  });

  steps.forEach((step, index) => {
    const lastStep = step.publicConversation?.lastStep;
    assert.ok(lastStep, `public conversation step ${index + 1} should expose structured progression`);
    assert.ok(lastStep.speakerId, "progression should identify the speaker");
    assert.ok(lastStep.targetId, "progression should identify a target");
    assert.ok(lastStep.stance, "progression should identify a stance");
    assert.ok(lastStep.question, "progression should include a question");
    assert.ok(lastStep.reason, "progression should include a reason");
    assert.ok(lastStep.followUp || lastStep.nominationTendency, "progression should include a follow-up or nomination tendency");
    [lastStep.line, lastStep.reason, lastStep.question, lastStep.followUp].forEach((text, textIndex) => {
      assertNoPlayerVisibleForbiddenTerms(text, `public progression ${index + 1}.${textIndex + 1}`);
    });
  });

  assert.equal(state.dayStageMeta.publicConversation.step, 3);
  assert.equal(state.dayStageMeta.publicRounds >= 3, true, "three public steps should count as three public rounds");
  assert.ok(
    steps[2].publicConversation.suggestedActions.includes("open-nomination-window"),
    "third public step should expose a route into nomination"
  );
  const nominationStage = advanceDayStage(state, "nomination");
  assert.equal(nominationStage.ok, true, nominationStage.reason);
}

function testPublicQuestionRoutesNextAIStepToAddressedTarget() {
  const state = makeTBState();
  const result = advanceDayStage(state, "public");
  assert.equal(result.ok, true, result.reason);
  const human = state.players.find((player) => player.isHuman);
  const target = state.players.find((player) => !player.isHuman && player.alive);
  assert.ok(human && target, "fixture should have human and target AI");

  state.events.speeches.push({
    day: state.day,
    playerId: human.id,
    line: `${target.name}，你昨天那条信息能公开说清楚吗？`,
    focusId: target.id,
    private: false,
  });
  state.dayStageMeta.publicConversation = {
    active: true,
    step: 1,
    clock: "response",
    pendingResponseSpeakerId: target.id,
    pendingResponseFocusId: target.id,
    pendingQuestionText: "public question fixture",
  };

  const step = runAIConversationStep(state, fixedRng(2026051601));
  assert.equal(step.ok, true, step.reason);
  assert.equal(step.speakerId, target.id, "addressed AI should answer the next public step");
  assert.equal(state.dayStageMeta.publicConversation.pendingResponseSpeakerId, null, "pending response should be consumed");
}

function testNominationDebateIsCreatedBeforeVote() {
  const state = makeTBState();
  advanceDayStage(state, "public");
  runAIConversationStep(state, fixedRng(20260530));
  const nominationStage = advanceDayStage(state, "nomination");
  assert.equal(nominationStage.ok, true, nominationStage.reason);
  const window = openNominationWindow(state, { ticks: 3 });
  assert.equal(window.ok, true, window.reason);

  const human = state.players.find((player) => player.isHuman);
  const nominee = state.players.find((player) => !player.isHuman && player.alive);
  const debate = createNominationDebate(
    state,
    { nominatorId: human.id, nomineeId: nominee.id, reason: `我提 ${nominee.name}，先听回应。`, source: "test" },
    fixedRng(20260531)
  );
  assert.equal(debate.ok, true, debate.reason);
  assert.equal(state.dayStageMeta.nominationDebate.active, true);
  assert.equal(state.dayStageMeta.nominationDebate.nomineeId, nominee.id);
  assert.equal(state.dayStageMeta.nominationDebate.lines.length, 2, "debate should only include nominator and nominee before vote");
  assert.equal(
    state.dayStageMeta.nominationDebate.lines.some((line) => line.role === "third-party"),
    false,
    "nomination debate should not add third-party interjections"
  );
  assert.equal(state.events.votes.length, 0, "creating debate should not resolve the vote yet");
}

function testHumanNomineeDefenseFeedsImmediateAIVoteDecision() {
  const rng = fixedRng(202606082);
  const state = createNewGame({ scriptId: "tb", playerCount: 9, preferredHumanRoleId: "washerwoman" }, rng);
  initializeAI(state);
  runNight(state, rng);
  initializeAI(state);
  advanceDayStage(state, "public");
  markPublicDiscussionRound(state);
  advanceDayStage(state, "nomination");

  const human = state.players.find((player) => player.isHuman && player.team === "good");
  const aiNominator = state.players.find((player) => !player.isHuman && player.alive && player.id !== human?.id);
  const goodVoter = state.players.find(
    (player) => !player.isHuman && player.team === "good" && player.alive && player.id !== aiNominator?.id
  );
  assert.ok(human, "expected a good human nominee");
  assert.ok(aiNominator, "expected an AI nominator");
  assert.ok(goodVoter, "expected a good AI voter");

  const debate = createNominationDebate(
    state,
    {
      nominatorId: aiNominator.id,
      nomineeId: human.id,
      reason: `${aiNominator.name} nominates ${human.name} as the current execution pressure.`,
      source: "test",
    },
    rng
  );
  assert.equal(debate.ok, true, debate.reason);

  refreshAIBeliefs(state);
  goodVoter.suspicion[human.id] = 0.6;
  const beforeDefense = decideAIVoteWithRationale(goodVoter, human, state, () => 0.99);
  assert.equal(beforeDefense.vote, true, "fixture should start with a good AI willing to follow the nomination pressure");
  assert.equal(beforeDefense.voteRationale.nominationDefenseContext, null, "pending human response should not count as a defense");

  const defenseText =
    "Please do not execute me here. This is too early and the case has no public evidence; vote no and keep pressure elsewhere.";
  const response = recordNominationDebateResponse(state, { speakerId: human.id, text: defenseText });
  assert.equal(response.ok, true, response.reason);
  assert.ok(
    state.events.speeches.some(
      (speech) => speech.source === "nomination-debate-response" && speech.playerId === human.id && speech.focusId === human.id
    ),
    "human defense should enter the public speech event stream"
  );

  refreshAIBeliefs(state);
  const refreshedVoter = state.players.find((player) => player.id === goodVoter.id);
  const afterDefense = decideAIVoteWithRationale(refreshedVoter, human, state, () => 0.99);
  const defenseEvidence = getAgentEvidence(state, refreshedVoter, { kind: "public-speech", targetId: human.id }).find(
    (entry) => entry.payload?.speakerId === human.id && entry.payload?.polarity === "defend"
  );
  const dialogueEvidence = getDialogueEvidenceForTarget(state, refreshedVoter, human.id, {
    publicOnly: true,
    includePrivate: false,
  }).find((entry) => entry.kind === "public-speech" && entry.payload?.polarity === "defend");

  assert.ok(defenseEvidence, "AI voter should receive human nomination defense as public evidence");
  assert.ok(dialogueEvidence, "dialogue evidence for vote pressure should include the human defense");
  assert.equal(afterDefense.vote, false, "human nominee defense should be able to stop an immediate good AI follow vote");
  assert.equal(afterDefense.voteRationale.nominationDefenseContext?.humanNominee, true);
  assert.ok(
    afterDefense.voteRationale.threshold > beforeDefense.voteRationale.threshold,
    "defense context should raise the good AI execution threshold"
  );
}

function testDayOnePublicDiscussionDoesNotMassClaim() {
  const state = makeTBState();
  const result = advanceDayStage(state, "public");
  assert.equal(result.ok, true, result.reason);
  runAIDiscussion(state, fixedRng(444));

  const aiCount = state.players.filter((player) => !player.isHuman).length;
  const publicClaims = (state.events.claims ?? []).filter((claim) => !claim.private && claim.day === state.day);
  assert.ok(publicClaims.length < aiCount, "day one public discussion should not make every AI hard-claim");
  const disclosureSpeeches = (state.events.speeches ?? []).filter(
    (speech) => !speech.private && speech.day === state.day && speech.claimDisclosureRationale
  );
  assert.ok(
    disclosureSpeeches.length <= 2,
    `day one opening should pace public self-disclosure instead of stacking it (${disclosureSpeeches.length} disclosures)`
  );

  const softDisclosure = (state.events.speeches ?? []).some(
    (speech) =>
      !speech.private &&
      /有一点早期信息|低信息量位置|偏外来者|不建议今天逼强功能位|不摊身份|全跳身份|不是强信息位|我先跳|公开报身份|公开身份|身份先放桌上|先跳/.test(speech.line ?? "")
  );
  assert.ok(softDisclosure, "day one public discussion should include visible role/info disclosure");
}

function testDayOnePublicDiscussionHasAtLeastOneVisibleHardClaim() {
  const state = makeTBState();
  const result = advanceDayStage(state, "public");
  assert.equal(result.ok, true, result.reason);

  runAIDiscussion(state, () => 0.99);

  const aiCount = state.players.filter((player) => !player.isHuman).length;
  const publicClaims = (state.events.claims ?? []).filter((claim) => !claim.private && claim.day === state.day);
  assert.ok(publicClaims.length >= 1, "opening public discussion should contain at least one visible role claim");
  assert.ok(publicClaims.length < aiCount, "opening public discussion should not become a mass hard-claim");
  const visibleClaim = publicClaims.some((claim) => {
    const roleName = getRoleById(state.scriptId, claim.roleId)?.name ?? claim.roleId;
    return (state.events.speeches ?? []).some(
      (speech) => !speech.private && speech.playerId === claim.playerId && `${speech.line ?? ""}`.includes(roleName)
    );
  });
  assert.ok(visibleClaim, "public claim event should be paired with a visible public line");
}

function testPublicClaimIsVisibleInPublicSpeech() {
  const state = makeTBState();
  const result = advanceDayStage(state, "public");
  assert.equal(result.ok, true, result.reason);

  runAIDiscussion(state, () => 0.01);

  const publicClaims = (state.events.claims ?? []).filter((claim) => !claim.private && claim.day === state.day);
  assert.ok(publicClaims.length > 0, "test fixture should force at least one public claim");
  publicClaims.forEach((claim) => {
    const roleName = getRoleById(state.scriptId, claim.roleId)?.name ?? claim.roleId;
    const visibleSpeech = (state.events.speeches ?? []).find(
      (speech) => !speech.private && speech.playerId === claim.playerId && `${speech.line ?? ""}`.includes(roleName)
    );
    assert.ok(visibleSpeech, "public claim should be visible in that AI's public speech line");
  });
}

function testClaimDisclosurePlannerBuildsPublicSafeRationale() {
  const state = makeTBState();
  const aiPlayer = state.players.find((player) => !player.isHuman && player.alive);
  const human = state.players.find((player) => player.isHuman);
  assert.ok(aiPlayer, "expected AI player");
  assert.ok(human, "expected human player");

  aiPlayer.publicClaimRoleId = null;
  aiPlayer.suspicion[aiPlayer.id] = 0.1;
  const rangePlan = claimDisclosurePlanner(state, aiPlayer, human, fixedRng(20260603), {
    private: false,
    audience: "public",
    roleId: "ravenkeeper",
    trustScore: 0.5,
  });
  assert.equal(rangePlan.claimDisclosureRationale.kind, "claim-disclosure-rationale");
  assert.equal(rangePlan.claimDisclosureRationale.publicOnly, true);
  assert.equal(rangePlan.claimDisclosureRationale.canRevealRole, false);
  assert.equal(rangePlan.claimDisclosureRationale.roleId, "", "public range/vague rationale must not leak exact role id");
  assert.equal(rangePlan.claimDisclosureRationale.roleName, "", "public range/vague rationale must not leak exact role name");
  assert.ok(rangePlan.claimDisclosureRationale.line, "rationale should explain why disclosure depth was chosen");

  const hardPlan = claimDisclosurePlanner(state, aiPlayer, human, fixedRng(20260604), {
    private: false,
    audience: "public",
    roleId: "ravenkeeper",
    forceHard: true,
    trustScore: 0.5,
  });
  assert.equal(hardPlan.claimDisclosureRationale.canRevealRole, true);
  assert.equal(hardPlan.claimDisclosureRationale.roleId, "ravenkeeper");
  assert.ok(hardPlan.claimDisclosureRationale.roleName, "hard-claim rationale may expose the claimed role");
}

function testPublicClaimSpeechCarriesDisclosureRationale() {
  const state = makeTBState();
  const result = advanceDayStage(state, "public");
  assert.equal(result.ok, true, result.reason);

  runAIDiscussion(state, () => 0.01);
  const speech = (state.events.speeches ?? []).find((entry) => !entry.private && entry.claimDisclosureRationale);
  assert.ok(speech, "public disclosure speech should carry claim-disclosure rationale");
  const rationale = speech.claimDisclosureRationale;
  assert.equal(rationale.kind, "claim-disclosure-rationale");
  assert.equal(rationale.publicOnly, true);
  assert.ok(rationale.spokenLine && speech.line.includes(rationale.spokenLine), "rationale spokenLine should match rendered public speech");
  if (!rationale.canRevealRole) {
    assert.equal(rationale.roleId, "", "non-hard public disclosure must not expose exact role id");
    assert.equal(rationale.roleName, "", "non-hard public disclosure must not expose exact role name");
  }
  assert.ok(
    (state.aiDialogue.timeline ?? []).some((entry) => entry.claimDisclosureRationale?.spokenLine === rationale.spokenLine),
    "public timeline should preserve claim-disclosure rationale"
  );
}

function testPrivateClaimAnswerCarriesDisclosureRationale() {
  const state = makeTBState();
  const target = state.players.find((player) => !player.isHuman && player.alive);
  assert.ok(target, "expected private whisper target");

  const result = runPrivateWhisper(
    state,
    { targetId: target.id, humanLine: "你的身份现在能给到什么程度？", intentHint: "claim" },
    fixedRng(20260605)
  );
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.claimDisclosureRationale?.kind, "claim-disclosure-rationale");
  assert.equal(result.claimDisclosureRationale?.audience, "private");
  assert.ok(
    result.claimDisclosureRationale?.spokenLine && result.response.includes(result.claimDisclosureRationale.spokenLine),
    "private claim rationale should point to rendered response text"
  );
  assert.ok(
    (state.events.speeches ?? []).some((entry) => entry.private && entry.claimDisclosureRationale?.spokenLine === result.claimDisclosureRationale.spokenLine),
    "private speech event should preserve claim-disclosure rationale"
  );
  assert.ok(
    (state.aiDialogue.timeline ?? []).some((entry) => entry.claimDisclosureRationale?.spokenLine === result.claimDisclosureRationale.spokenLine),
    "private timeline should preserve claim-disclosure rationale"
  );
}

function testThoughtFrameDrivesVisiblePublicClaim() {
  const state = makeTBState();
  const result = advanceDayStage(state, "public");
  assert.equal(result.ok, true, result.reason);
  const hardClaimOutsiders = state.players.filter((player) => {
    if (player.isHuman || !player.alive || player.category !== "outsider") return false;
    const frame = buildAIThoughtFrame(state, player, { audience: "public", roundInDay: 1, rng: () => 0.01 });
    return frame.selfDisclosureNeed === "hard_claim";
  }).sort((a, b) => a.seatIndex - b.seatIndex);
  assert.ok(hardClaimOutsiders.length > 0, "expected an AI outsider in TB fixture");

  const beforeClaims = (state.events.claims ?? []).filter((claim) => !claim.private).length;
  runAIDiscussion(state, () => 0.01);
  const claim = (state.events.claims ?? []).find(
    (entry) => !entry.private && hardClaimOutsiders.some((player) => player.id === entry.playerId)
  );
  assert.ok(claim, "opening thought-frame hard claims should create at least one visible public claim event");
  const disclosureSpeeches = (state.events.speeches ?? []).filter(
    (entry) => !entry.private && entry.claimDisclosureRationale
  );
  assert.ok(
    disclosureSpeeches.length <= 2,
    "opening thought-frame claims should be paced instead of forcing every eligible AI to claim"
  );
  const roleName = getRoleById(state.scriptId, claim.roleId)?.name ?? claim.roleId;
  const speech = (state.events.speeches ?? []).find(
    (entry) => !entry.private && entry.playerId === claim.playerId && `${entry.line ?? ""}`.includes(roleName)
  );
  assert.ok(speech, "thought-frame public claim should be visible in public speech");
  assert.ok(
    (state.aiDialogue.thoughtFramesByAgentId?.[claim.playerId]?.intendedAct ?? "") === "claim",
    "latest thought frame should be stored on dialogue state"
  );
  assert.ok(beforeClaims <= 0, "fixture should start without public claims");
}

function testThoughtFrameQuestionFeedsPrivateFollowUp() {
  const state = makeTBState();
  const observer = state.players.find((player) => !player.isHuman && player.team === "good");
  assert.ok(observer, "expected observer AI");

  const result = runPrivateWhisper(
    state,
    { targetId: observer.id, humanLine: "你现在最想追谁？为什么？", intentHint: "reason" },
    fixedRng(202605131)
  );

  const frame = state.aiDialogue.thoughtFramesByAgentId?.[observer.id];
  assert.equal(result.ok, true, result.reason);
  assert.ok(frame?.questionToAsk, "private response should build a thought-frame follow-up question");
  assert.ok(
    result.followUpPrompts?.includes(frame.questionToAsk) || `${result.response ?? ""}`.includes(frame.questionToAsk),
    "private follow-up prompts or response should use thoughtFrame.questionToAsk"
  );
}

function testThoughtFrameQuestionFeedsPublicFollowUp() {
  const state = makeTBState();
  advanceDayStage(state, "public");

  runAIDiscussion(state, fixedRng(202605132));
  const publicLines = (state.events.speeches ?? []).filter((entry) => !entry.private).map((entry) => entry.line ?? "");
  const frames = Object.values(state.aiDialogue.thoughtFramesByAgentId ?? {});

  assert.ok(frames.some((frame) => frame?.questionToAsk), "public discussion should build thought-frame questions");
  assert.ok(
    publicLines.some((line) => /下一句我会问|我会问|接下来先问|先问|把身份和昨晚信息|先听回应|补清|补上/.test(line)),
    "public discussion should surface thoughtFrame.questionToAsk as a follow-up line"
  );
}

function testPublicThoughtFrameUsesAgentViewEvidenceSummaries() {
  const state = makeTBState();
  const viewer = state.players.find((player) => !player.isHuman && player.team === "good" && player.alive);
  const target = state.players.find((player) => !player.isHuman && player.id !== viewer?.id && player.alive);
  assert.ok(viewer, "expected good AI viewer");
  assert.ok(target, "expected target");

  state.players.forEach((player) => {
    viewer.suspicion[player.id] = player.id === target.id ? 0.92 : 0.02;
  });
  addAgentObservation(state, viewer.id, {
    kind: "public-speech",
    source: "public-chat",
    private: false,
    text: "PUBTFMARK target contradicted their public claim",
    payload: { speakerId: target.id, focusId: target.id },
  });
  addAgentObservation(state, viewer.id, {
    kind: "private-whisper",
    source: "private-chat",
    private: true,
    text: "PRIVTFMARK private night read",
    payload: { speakerId: target.id, targetId: viewer.id, focusId: target.id },
  });

  const publicView = buildAgentView(state, viewer, { audience: "public", targetId: target.id });
  const frame = buildAIThoughtFrame(state, viewer, {
    audience: "public",
    agentView: publicView,
    stage: "nomination",
    rng: () => 0.1,
  });
  const evidenceText = JSON.stringify(frame.evidenceReasons ?? []);

  assert.equal(frame.primaryConcernId, target.id, "fixture should make the marked target the public thought focus");
  assert.match(evidenceText, /PUBTFMARK/, "public thought frame should keep public evidence summaries from agent view");
  assert.doesNotMatch(evidenceText, /PRIVTFMARK/, "public thought frame should not use private evidence summaries");
}

function testPublicDiscussionPriorityBudgetKeepsCoreSignals() {
  const state = makeTBState();
  advanceDayStage(state, "public");

  runAIDiscussion(state, fixedRng(202605132));
  const compactSignal = (value) => `${value ?? ""}`.replace(/\s+/g, "");
  const hasFollowUpCue = (line) => /身份和昨晚信息|再补昨晚信息|补清，再说昨晚信息|补身份和昨晚信息/.test(line ?? "");
  const anchored = (state.events.speeches ?? []).filter((entry) => !entry.private).find((entry) => {
    const frame = state.aiDialogue.thoughtFramesByAgentId?.[entry.playerId];
    return entry.focusId && entry.evidenceContract?.spokenText && frame?.questionToAsk && hasFollowUpCue(entry.line);
  });

  assert.ok(anchored, "public discussion should produce a follow-up line with target and evidence anchors");
  const target = state.players.find((player) => player.id === anchored.focusId);
  const targetLabels = [target?.name, target ? `${target.seatIndex + 1}号` : ""].filter(Boolean);
  const lineText = `${anchored.line ?? ""}`;
  const evidenceSignal = compactSignal(anchored.evidenceContract.spokenText);
  const evidenceBody = evidenceSignal.replace(/^两条线索合在一起/u, "");
  const personaMarkers = ["先说清楚", "公开身份", "我先看", "我不是空白位", "换句话说", "我的意思是", "我直说", "别拖", "说真的", "我有点在意", "我先留个心眼", "我不太放心", "嗯", "说实话", "我有点犹豫"];
  const signalHits = [
    targetLabels.some((label) => compactSignal(lineText).includes(compactSignal(label))),
    compactSignal(lineText).includes(evidenceSignal) || (!!evidenceBody && compactSignal(lineText).includes(evidenceBody)),
    hasFollowUpCue(lineText),
    personaMarkers.some((marker) => lineText.includes(marker)),
  ].filter(Boolean);

  assert.ok(signalHits.length >= 4, `public priority budget should preserve persona/target/evidence/follow-up signals, got ${anchored.line}`);
}

function testPublicSpeechRepairsHumanFollowUpCue() {
  const state = makeTBState();
  const speaker = state.players.find((player) => !player.isHuman && player.alive);
  assert.ok(speaker, "expected AI speaker");

  const rendered = applyHumanSpeechCadence(
    state,
    speaker,
    "1号这条先留桌面上，卡在推低证据位。让 你 把身份和昨晚信息说清楚。",
    fixedRng(202606031),
    { audience: "public", maxSentences: 3, maxChars: 160 }
  );

  assert.doesNotMatch(rendered, /让\s+你\s*把身份和昨晚信息说清楚/, "public cleanup should repair human-target follow-up spacing");
  assert.match(rendered, /你解释为什么压低证据位，再补昨晚信息|你先补身份和昨晚信息/, "public cleanup should keep an actionable human follow-up");
}

function testRepeatedSpeechGetsDifferentiated() {
  const state = makeTBState();
  const speaker = state.players.find((player) => !player.isHuman);
  assert.ok(speaker, "expected AI speaker");

  const first = applyHumanSpeechCadence(
    state,
    speaker,
    "我先看 3号。我卡在这儿：发言要回看。",
    fixedRng(202605133),
    { audience: "public", maxSentences: 2, maxChars: 120 }
  );
  const second = applyHumanSpeechCadence(
    state,
    speaker,
    "我先看 3号。我卡在这儿：发言要回看。",
    fixedRng(202605134),
    { audience: "public", maxSentences: 2, maxChars: 120 }
  );

  assert.notEqual(second, first, "repeated AI speech should be rendered with a visible variation");
}

function testPrivateTrustQuestionUsesActRenderer() {
  const state = makeTBState();
  const target = state.players.find((player) => !player.isHuman && player.team === "good");
  assert.ok(target, "expected AI target");

  const result = runPrivateWhisper(
    state,
    { targetId: target.id, humanLine: "你信我吗？现在桌上该先问谁？", intentHint: "trust" },
    fixedRng(202605135)
  );

  assert.equal(result.ok, true, result.reason);
  assert.match(
    result.response,
    /你这边|你目前|你在我这里/,
    "trust answer should directly answer the player's trust question"
  );
  assert.match(
    result.response,
    /桌上更该先问|下一句我会问|先问/,
    "trust answer should still render an actionable follow-up through the act renderer"
  );
}

function testPrivateCompareQuestionUsesActRenderer() {
  const state = makeTBState();
  const target = state.players.find((player) => !player.isHuman && player.team === "good");
  assert.ok(target, "expected AI target");

  const result = runPrivateWhisper(
    state,
    { targetId: target.id, humanLine: "你比较一下 2号 和 5号，谁更该先追？", intentHint: "compare" },
    fixedRng(202605136)
  );

  assert.equal(result.ok, true, result.reason);
  assert.match(result.response, /先级更高|先追|先排后面/, "compare answer should give a priority ordering");
  assert.doesNotMatch(result.response, /undefined|NaN/, "compare act rendering should not leak missing fields");
}

function testScriptPressureProfileRecognizesOutsiderIncentives() {
  const tb = createNewGame({ scriptId: "tb", playerCount: 9, preferredHumanRoleId: "washerwoman" }, fixedRng());
  const bmr = createNewGame({ scriptId: "bmr", playerCount: 9, preferredHumanRoleId: "grandmother" }, fixedRng());
  const snv = createNewGame({ scriptId: "snv", playerCount: 9, preferredHumanRoleId: "clockmaker" }, fixedRng());

  assert.equal(getAIScriptPressureProfile(tb).outsiderClaimsPlausible, true, "TB should account for Baron/Drunk outsider ambiguity");
  assert.equal(getAIScriptPressureProfile(bmr).outsiderClaimsRisky, true, "BMR should account for Godfather outsider pressure");
  assert.equal(getAIScriptPressureProfile(snv).outsiderBluffsValuable, true, "SnV should account for Fang Gu outsider bluff value");
}

function testGoodDayStrategyRecognizesExecutionIncentives() {
  const state = createNewGame({ scriptId: "snv", playerCount: 9, preferredHumanRoleId: "clockmaker" }, fixedRng());
  initializeAI(state);
  state.phase = "day";
  state.dayStage = "public";
  const goodAI = state.players.find((player) => !player.isHuman && player.team === "good");
  assert.ok(goodAI, "fixture should include a good AI");

  const strategy = evaluateGoodDayStrategy(state, goodAI, { stage: "public" });
  assert.equal(strategy.active, true, "good AI should receive good day strategy context");
  assert.ok(strategy.noExecutionRisk >= 0.36, "SnV/Vortox script should raise no-execution risk");
  assert.ok(strategy.nominationBias > 0, "execution incentives should lower nomination reluctance");
  assert.ok(
    strategy.reasons.includes("vortox-script-punishes-no-execution"),
    "strategy should explain the Vortox execution incentive"
  );
}

function testGoodAIProtectsPublicMayorFinalThreeNoExecutionWin() {
  const rng = fixedRng(2026060703);
  const state = createNewGame({ scriptId: "tb", playerCount: 9, preferredHumanRoleId: "washerwoman" }, rng);
  initializeAI(state);
  runNight(state, rng);
  initializeAI(state);

  const humanPlayer = state.players.find((player) => player.isHuman);
  const mayor = state.players.find((player) => !player.isHuman && player.team === "good" && player.alive);
  const demon = state.players.find((player) => !player.isHuman && player.category === "demon" && player.alive);
  assert.ok(humanPlayer, "fixture should include the human player");
  assert.ok(mayor, "fixture should include a good AI Mayor candidate");
  assert.ok(demon, "fixture should include an evil demon");
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
    assert.equal(advanceDayStage(state, "public").ok, true, "fixture should enter public discussion");
  }
  markPublicDiscussionRound(state);
  if (state.dayStage === "public") {
    assert.equal(advanceDayStage(state, "nomination").ok, true, "fixture should enter nominations");
  }
  state.players
    .filter((player) => !player.isHuman && player.id !== mayor.id)
    .forEach((player) => {
      player.nominatedToday = true;
    });

  const strategy = evaluateGoodDayStrategy(state, mayor, { stage: "nomination" });
  assert.equal(strategy.mayorNoExecutionWin, true, "good AI should recognize the public final-three Mayor win window");
  assert.equal(strategy.recommendedPublicAct, "hold-for-mayor-win");
  assert.equal(chooseAINomination(state), null, "good AI should not spend a nomination that breaks Mayor no-execution win");

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
  assert.equal(mayorVote?.vote, false, "claimed Mayor should vote no to preserve the no-execution win");
  assert.ok(
    (mayorVote?.voteRationale?.strategyShift ?? 0) >= 0.1,
    "vote rationale should expose a conservative strategy shift for the Mayor win window"
  );
  assert.equal(result.passed, false, "evil nomination should fail when good preserves Mayor no-execution");
  assert.equal(skipDay(state, rng), true, "day end should resolve the no-execution outcome");
  assert.equal(state.gameOver, true, "Mayor no-execution should end the game");
  assert.equal(state.winner, "good", "public Mayor final three with no execution should give good the win");
}

function testGoodAIProtectsMastermindExtraDayNoExecutionWin() {
  const rng = fixedRng(2026060704);
  const state = createNewGame({ scriptId: "bmr", playerCount: 9, preferredHumanRoleId: "grandmother" }, rng);
  initializeAI(state);
  runNight(state, rng);
  initializeAI(state);

  const humanPlayer = state.players.find((player) => player.isHuman);
  const goodAI = state.players.find((player) => !player.isHuman && player.team === "good" && player.alive);
  const mastermind = state.players.find((player) => !player.isHuman && player.id !== goodAI?.id && player.id !== humanPlayer?.id);
  const deadDemon = state.players.find(
    (player) => !player.isHuman && player.id !== goodAI?.id && player.id !== humanPlayer?.id && player.id !== mastermind?.id
  );
  assert.ok(humanPlayer, "fixture should include the human player");
  assert.ok(goodAI, "fixture should include a good AI");
  assert.ok(mastermind, "fixture should include an evil Mastermind candidate");
  assert.ok(deadDemon, "fixture should include a dead demon fixture");
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
    assert.equal(advanceDayStage(state, "public").ok, true, "fixture should enter public discussion");
  }
  markPublicDiscussionRound(state);
  if (state.dayStage === "public") {
    assert.equal(advanceDayStage(state, "nomination").ok, true, "fixture should enter nominations");
  }
  state.players
    .filter((player) => !player.isHuman && player.id !== goodAI.id)
    .forEach((player) => {
      player.nominatedToday = true;
    });

  const strategy = evaluateGoodDayStrategy(state, goodAI, { stage: "nomination" });
  assert.equal(strategy.mastermindNoExecutionWin, true, "good AI should recognize the Mastermind extra-day no-execution win");
  assert.equal(strategy.recommendedPublicAct, "hold-for-mastermind-win");
  assert.ok(
    strategy.reasons.includes("mastermind-extra-day-no-execution-win"),
    "strategy should explain the Mastermind no-execution incentive"
  );
  assert.equal(chooseAINomination(state), null, "good AI should not spend a nomination that breaks Mastermind no-execution win");

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
  assert.equal(goodVote?.vote, false, "good AI should vote no to preserve the Mastermind no-execution win");
  assert.ok(
    (goodVote?.voteRationale?.strategyShift ?? 0) >= 0.1,
    "vote rationale should expose a conservative strategy shift for the Mastermind win window"
  );
  assert.equal(result.passed, false, "evil nomination should fail when good preserves Mastermind no-execution");
  assert.equal(skipDay(state, rng), true, "day end should resolve the Mastermind no-execution outcome");
  assert.equal(state.gameOver, true, "Mastermind no-execution should end the game");
  assert.equal(state.winner, "good", "Mastermind extra day with no execution should give good the win");
}

function testGoodTwinAIPushesKnownEvilTwinExecutionWin() {
  const rng = fixedRng(2026060705);
  const state = createNewGame({ scriptId: "snv", playerCount: 9, preferredHumanRoleId: "clockmaker" }, rng);
  initializeAI(state);
  runNight(state, rng);
  initializeAI(state);

  const humanPlayer = state.players.find((player) => player.isHuman);
  const goodTwin = state.players.find((player) => !player.isHuman && player.team === "good" && player.alive);
  const evilTwin = state.players.find((player) => !player.isHuman && player.id !== goodTwin?.id && player.id !== humanPlayer?.id);
  assert.ok(humanPlayer, "fixture should include the human player");
  assert.ok(goodTwin, "fixture should include a good AI twin candidate");
  assert.ok(evilTwin, "fixture should include an evil twin candidate");

  applyRoleForContract(state, goodTwin, "clockmaker");
  applyRoleForContract(state, evilTwin, "evil-twin");
  state.snv.evilTwinPair = {
    evilTwinId: evilTwin.id,
    goodTwinId: goodTwin.id,
  };
  state.snv.snakeCharmerPoisonedIds = [];
  state.players.forEach((player) => {
    player.alive = [humanPlayer.id, goodTwin.id, evilTwin.id].includes(player.id);
    player.nominatedToday = player.id !== goodTwin.id && !player.isHuman;
    player.beenNominatedToday = false;
    player.ghostVoteAvailable = false;
    player.poisoned = false;
    player.poisonedTomorrowDay = false;
  });
  initializeAI(state);

  if (state.dayStage === "private") {
    assert.equal(advanceDayStage(state, "public").ok, true, "fixture should enter public discussion");
  }
  markPublicDiscussionRound(state);
  if (state.dayStage === "public") {
    assert.equal(advanceDayStage(state, "nomination").ok, true, "fixture should enter nominations");
  }

  const proposal = chooseAINomination(state);
  assert.ok(proposal, "good twin AI should propose a nomination from its twin information");
  assert.equal(proposal.nominatorId, goodTwin.id, "good twin should be the available AI nominator");
  assert.equal(proposal.nomineeId, evilTwin.id, "good twin should nominate the known evil twin");

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
  assert.equal(result.accepted, true, result.reason);
  assert.equal(result.passed, true, "known Evil Twin nomination should be executable");
  assert.equal(skipDay(state, rng), true, "day end should execute the Evil Twin on the block");
  assert.equal(state.gameOver, true, "executing the Evil Twin should immediately end the game");
  assert.equal(state.winner, "good", "executing the Evil Twin should give good the win");
}

function testGoodTwinAIRefusesKnownSelfExecutionLoss() {
  const rng = fixedRng(2026060707);
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
  assert.ok(humanPlayer, "fixture should include the human player");
  assert.ok(goodTwin, "fixture should include a good AI twin");
  assert.ok(ordinaryGood, "fixture should include a non-twin good AI");
  assert.ok(evilTwin, "fixture should include an Evil Twin holder");

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
    assert.equal(advanceDayStage(state, "public").ok, true, "fixture should enter public discussion");
  }
  markPublicDiscussionRound(state);
  if (state.dayStage === "public") {
    assert.equal(advanceDayStage(state, "nomination").ok, true, "fixture should enter nominations");
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
    "Good Twin should recognize its own execution as an evil win"
  );
  const hiddenContext = buildAIStrategyContext(state, ordinaryGood, {
    stage: "nomination",
    targetId: goodTwin.id,
  });
  assert.equal(
    hiddenContext.target?.evilTwinExecutionRisk,
    null,
    "non-twin good AI should not receive hidden Evil Twin pair knowledge"
  );

  const protectedVote = decideAIVoteWithRationale(goodTwin, goodTwin, state, () => 0.99);
  assert.equal(protectedVote.vote, false, "Good Twin should refuse a self-execution vote that gives evil the win");
  assert.ok(
    (protectedVote.voteRationale?.strategyShift ?? 0) >= 0.4,
    "vote rationale should expose the strong Evil Twin protection shift"
  );

  const ordinaryVote = decideAIVoteWithRationale(ordinaryGood, goodTwin, state, () => 0.99);
  assert.equal(
    ordinaryVote.vote,
    true,
    "ordinary good AI should not be protected by hidden twin knowledge it never learned"
  );

  const coalition = simulateCoalitionVote(state, evilTwin, goodTwin, {
    formalNomination: { nominatorId: evilTwin.id },
  });
  const goodTwinEstimate = coalition.voterEstimates.find((entry) => entry.voterId === goodTwin.id);
  const ordinaryEstimate = coalition.voterEstimates.find((entry) => entry.voterId === ordinaryGood.id);
  assert.ok(goodTwinEstimate?.probability <= 0.2, "coalition simulation should project the Good Twin refusing self-execution");
  assert.equal(
    goodTwinEstimate?.evilTwinExecutionRisk?.protectsGood,
    true,
    "coalition estimate should carry the Good Twin protection reason"
  );
  assert.equal(
    ordinaryEstimate?.evilTwinExecutionRisk,
    null,
    "coalition simulation should preserve hidden-info isolation for unrelated good voters"
  );
  assert.ok(ordinaryEstimate?.probability >= 0.5, "ordinary good voter should still follow visible suspicion");
}

function testGoodAlignedEvilTwinAIPushesOpposingTwin() {
  const rng = fixedRng(2026060706);
  const state = createNewGame({ scriptId: "snv", playerCount: 9, preferredHumanRoleId: "clockmaker" }, rng);
  initializeAI(state);
  runNight(state, rng);
  initializeAI(state);

  const humanPlayer = state.players.find((player) => player.isHuman);
  const goodEvilTwin = state.players.find((player) => !player.isHuman && player.team === "good" && player.alive);
  const opposingTwin = state.players.find((player) => !player.isHuman && player.team === "evil" && player.alive);
  assert.ok(humanPlayer, "fixture should include the human player");
  assert.ok(goodEvilTwin, "fixture should include a good AI Evil Twin holder candidate");
  assert.ok(opposingTwin, "fixture should include an opposing evil player");

  applyRoleForContract(state, goodEvilTwin, "evil-twin");
  goodEvilTwin.team = "good";
  goodEvilTwin.apparentTeam = "good";
  state.snv.evilTwinPair = {
    evilTwinId: goodEvilTwin.id,
    goodTwinId: goodEvilTwin.id,
    opposingTwinId: opposingTwin.id,
  };
  state.snv.snakeCharmerPoisonedIds = [];
  state.players.forEach((player) => {
    player.alive = [humanPlayer.id, goodEvilTwin.id, opposingTwin.id].includes(player.id);
    player.nominatedToday = player.id !== goodEvilTwin.id && !player.isHuman;
    player.beenNominatedToday = false;
    player.ghostVoteAvailable = false;
    player.poisoned = false;
    player.poisonedTomorrowDay = false;
  });
  initializeAI(state);

  if (state.dayStage === "private") {
    assert.equal(advanceDayStage(state, "public").ok, true, "fixture should enter public discussion");
  }
  markPublicDiscussionRound(state);
  if (state.dayStage === "public") {
    assert.equal(advanceDayStage(state, "nomination").ok, true, "fixture should enter nominations");
  }

  const proposal = chooseAINomination(state);
  assert.ok(proposal, "good-aligned Evil Twin AI should propose a nomination from its pair information");
  assert.equal(proposal.nominatorId, goodEvilTwin.id, "good-aligned Evil Twin should be the available AI nominator");
  assert.equal(proposal.nomineeId, opposingTwin.id, "good-aligned Evil Twin should push the opposing twin, not itself");
}

function testLunaticAgentUsesPerceivedDemonKnowledge() {
  const state = createNewGame({ scriptId: "bmr", playerCount: 9, preferredHumanRoleId: "grandmother" }, fixedRng());
  const lunatic = state.players.find((player) => !player.isHuman);
  assert.ok(lunatic, "expected AI player to convert into Lunatic fixture");

  lunatic.roleId = "lunatic";
  lunatic.roleName = "Lunatic";
  lunatic.category = "outsider";
  lunatic.team = "good";
  lunatic.apparentRoleId = "po";
  lunatic.apparentRoleName = "Po";
  lunatic.apparentCategory = "demon";
  lunatic.apparentTeam = "evil";
  state.bmr.lunaticFakeDemonRoleById[lunatic.id] = "po";
  state.bmr.lunaticFakeMinionIdsById[lunatic.id] = [state.players.find((player) => player.id !== lunatic.id).id];
  state.bmr.lunaticFakeBluffRoleIdsById[lunatic.id] = ["tinker", "moonchild", "gambler"];

  initializeAI(state);
  const agent = getAIAgent(state, lunatic);
  assert.equal(agent.knownSelfRoleId, "po", "Lunatic agent should know perceived demon role, not actual Lunatic");
  assert.equal(agent.knownSelfTeam, "evil", "Lunatic agent should believe they are evil");
  assert.ok(agent.knownBluffRoleIds.includes("tinker"), "Lunatic agent should receive fake demon bluffs");
  assert.ok(agent.knownAllyIds.length > 0, "Lunatic agent should receive fake minion allies");
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
  assert.ok(
    evidenceKinds(state, target, "private-whisper").some((entry) => entry.canBeFalse && entry.source === "private-chat"),
    "private whisper evidence should be marked as socially fallible"
  );
  assert.equal(
    observationKinds(getAIAgent(state, outsider), "private-whisper").length,
    0,
    "unrelated AI should not receive private-whisper observations"
  );
  assert.equal(
    evidenceKinds(state, outsider, "private-whisper").length,
    0,
    "unrelated AI should not receive private-whisper evidence"
  );
}

function testEvilAllyClaimQuestionRevealsRealAndBluffIdentity() {
  const rng = fixedRng();
  const state = createNewGame({ scriptId: "tb", playerCount: 9, preferredHumanRoleId: "imp" }, rng);
  initializeAI(state);
  runNight(state, rng);

  const evilAlly = state.players.find((player) => !player.isHuman && player.team === "evil");
  assert.ok(evilAlly, "expected evil AI ally for human demon");

  const result = runPrivateWhisper(
    state,
    { targetId: evilAlly.id, humanLine: "你是什么身份？", intentHint: "claim" },
    fixedRng(223)
  );

  assert.equal(result.ok, true, result.reason);
  assert.match(result.response, /自己人/, "evil ally should explicitly acknowledge shared team in private");
  assert.match(result.response, /真实身份/, "evil ally should reveal true identity to evil teammate when asked role");
  assert.match(result.response, /台面|伪装/, "evil ally should discuss public bluff cover when asked role");
}

function testDeadAICanStillPrivateWhisper() {
  const state = makeTBState();
  const target = state.players.find((player) => !player.isHuman);
  const outsider = state.players.find((player) => !player.isHuman && player.id !== target.id);
  assert.ok(target, "expected dead whisper target");
  assert.ok(outsider, "expected unrelated AI");

  target.alive = false;
  target.deathReason = "test-death";

  const result = runPrivateWhisper(
    state,
    { targetId: target.id, humanLine: "你是什么身份？", intentHint: "claim" },
    fixedRng(224)
  );

  assert.equal(result.ok, true, result.reason);
  assert.ok(
    observationKinds(getAIAgent(state, target), "private-whisper").length > 0,
    "dead AI should still receive private-whisper observations"
  );
  assert.ok(
    evidenceKinds(state, target, "private-whisper").length > 0,
    "dead AI private chat should still become evidence"
  );
  assert.equal(
    observationKinds(getAIAgent(state, outsider), "private-whisper").length,
    0,
    "dead AI whisper should not leak to unrelated AIs"
  );
}

function testDeadPrivateWhisperUsesDeadContextAct() {
  const state = makeTBState();
  const target = state.players.find((player) => !player.isHuman);
  const suspect = state.players.find((player) => !player.isHuman && player.id !== target.id && player.alive);
  assert.ok(target, "expected dead whisper target");
  assert.ok(suspect, "expected suspect");

  target.alive = false;
  target.deathReason = "test-death";
  target.dialogueBias = target.dialogueBias ?? {};
  target.dialogueBias[suspect.id] = 0.75;

  const result = runPrivateWhisper(
    state,
    { targetId: target.id, humanLine: `why do you suspect ${suspect.seatIndex + 1}?`, intentHint: "reason" },
    fixedRng(20260519)
  );

  assert.equal(result.ok, true, result.reason);
  assert.match(result.response, /死了|死人|出局|遗言/, "dead private whisper should use death-context wording");
}

function testDeadAICanStillJoinPublicDiscussion() {
  const state = makeTBState();
  const deadAI = state.players.find((player) => !player.isHuman);
  assert.ok(deadAI, "expected AI speaker");

  deadAI.alive = false;
  deadAI.deathReason = "test-death";

  const result = advanceDayStage(state, "public");
  assert.equal(result.ok, true, result.reason);
  runAIDiscussion(state, fixedRng(226));

  assert.ok(
    state.events.speeches.some((entry) => entry.playerId === deadAI.id && !entry.private),
    "dead AI should still be able to speak in public discussion"
  );
}

function testAIProactivelyWhispersWithoutConsumingHumanLimit() {
  const state = makeTBState();
  const human = state.players.find((player) => player.isHuman);
  const target = state.players.find((player) => !player.isHuman && player.privateNotes.length > 0);
  assert.ok(human, "expected human player");
  assert.ok(target, "expected an AI with shareable private information");

  const beforeUsed = state.dayStageMeta.privateUsed;
  const beforeTargeted = [...(state.dayStageMeta.privateTargets ?? [])];
  const messages = runAIProactiveWhispers(state, fixedRng(228));

  assert.ok(messages.length > 0, "AI should proactively private-whisper when it has useful information");
  assert.equal(state.dayStageMeta.privateUsed, beforeUsed, "proactive AI whispers should not consume human private slots");
  assert.deepEqual(
    state.dayStageMeta.privateTargets ?? [],
    beforeTargeted,
    "proactive AI whispers should not mark a human-initiated private target"
  );
  assert.ok(
    state.events.speeches.some((entry) => entry.private && entry.proactive && entry.playerId !== human.id),
    "proactive private whisper should be stored as private speech"
  );
  assert.ok(
    state.aiDialogue.timeline.some((entry) => entry.mode === "whisper-in" && entry.proactive),
    "proactive private whisper should appear in the dialogue timeline"
  );
  const rationaleMessage = messages.find((entry) => entry.decisionRationale?.spokenLine);
  assert.ok(rationaleMessage, "proactive private whisper should expose a spoken decision rationale when it has a focus");
  assert.ok(
    rationaleMessage.response.includes(rationaleMessage.decisionRationale.spokenLine),
    "proactive private rationale spokenLine should be copied from the final response text"
  );
  const rationaleSpeech = state.events.speeches.find(
    (entry) => entry.private && entry.proactive && entry.playerId === rationaleMessage.targetId && entry.line === rationaleMessage.response
  );
  assert.equal(
    rationaleSpeech?.decisionRationale?.spokenLine,
    rationaleMessage.decisionRationale.spokenLine,
    "proactive private speech event should keep the same spokenLine"
  );
  const rationaleTimeline = state.aiDialogue.timeline.find(
    (entry) => entry.mode === "whisper-in" && entry.proactive && entry.speakerId === rationaleMessage.targetId && entry.text === rationaleMessage.response
  );
  assert.equal(
    rationaleTimeline?.decisionRationale?.spokenLine,
    rationaleMessage.decisionRationale.spokenLine,
    "proactive private timeline should keep the same spokenLine"
  );
}

function testAIProactiveWhisperCanBeQueuedAcceptedOrDeclined() {
  const state = makeTBState();
  const human = state.players.find((player) => player.isHuman);
  assert.ok(human, "expected human player");

  const beforeUsed = state.dayStageMeta.privateUsed;
  const offers = runAIProactiveWhispers(state, fixedRng(22801), { queueOnly: true });
  assert.ok(offers.length > 0, "AI should be able to queue proactive whisper offers");
  assert.equal(state.dayStageMeta.privateUsed, beforeUsed, "queued proactive offers should not consume human private slots");
  assert.equal(
    state.aiDialogue.timeline.some((entry) => entry.proactive && entry.mode === "whisper-in"),
    false,
    "queued proactive offers should not jump into the player timeline before acceptance"
  );

  const first = offers[0];
  assert.match(first.reason, /信息|私下|同步|口径|站边|出局|目标|线/, "offer should expose a short reason for the visit");
  assert.ok(first.thoughtFrame?.intendedAct, "queued proactive offer should carry the AI thought frame that motivated it");
  assert.ok(first.decisionRationale?.spokenLine, "queued proactive offer should carry a spoken decision rationale");
  assert.ok(
    first.response.includes(first.decisionRationale.spokenLine),
    "queued proactive offer rationale should be copied from the queued response"
  );
  const accepted = acceptAIProactiveWhisper(state, first.id, fixedRng(22802));
  assert.equal(accepted.ok, true, accepted.reason);
  assert.equal(
    accepted.decisionRationale?.spokenLine,
    first.decisionRationale.spokenLine,
    "accepted proactive whisper should keep the queued spokenLine"
  );
  assert.ok(
    state.aiDialogue.timeline.some((entry) => entry.proactive && entry.speakerId === first.playerId && entry.text === first.response),
    "accepted proactive offer should enter the player-facing private timeline"
  );

  const secondOffers = runAIProactiveWhispers(state, fixedRng(22803), { queueOnly: true });
  if (secondOffers.length > 0) {
    const declined = declineAIProactiveWhisper(state, secondOffers[0].id);
    assert.equal(declined.ok, true, declined.reason);
    assert.equal(
      state.aiDialogue.timeline.some((entry) => entry.speakerId === secondOffers[0].playerId && entry.text === secondOffers[0].response),
      false,
      "declined proactive offer should not reveal its response text"
    );
  }
}

function testCrossDaySharedInfoMemorySuppressesRepeatedProactiveWhisper() {
  const state = makeTBState();
  const human = state.players.find((player) => player.isHuman);
  const chef = state.players.find((player) => !player.isHuman && player.team === "good");
  assert.ok(human && chef, "fixture should have human and AI");

  chef.roleId = "chef";
  chef.category = "townsfolk";
  chef.privateNotes = ["[第1夜] 你得知：场上有 1 对相邻邪恶玩家。"];
  state.events.infoPings.push({
    night: 1,
    actorId: chef.id,
    type: "chef",
    truth: 1,
    shown: 1,
    polluted: false,
    text: chef.privateNotes[0],
  });

  const first = runPrivateWhisper(
    state,
    { targetId: chef.id, humanLine: "你昨晚得到了什么信息？", intentHint: "night" },
    fixedRng(2026051602)
  );
  assert.equal(first.ok, true, first.reason);
  const key = `${chef.id}::${human.id}`;
  assert.ok(state.aiDialogue.statementMemory.sharedInfoByPairKey[key], "private answer should record shared info summary");

  state.day = 2;
  state.phase = "day";
  state.dayStage = "private";
  state.aiDialogue.pendingProactiveWhispers = [];
  const offers = runAIProactiveWhispers(state, fixedRng(2026051603), { queueOnly: true });
  assert.equal(
    offers.some((offer) => offer.playerId === chef.id),
    false,
    "same first-night info should not make the same AI proactively whisper every day"
  );
}

function testPrivateChatFollowUpsDoNotConsumeDailySlots() {
  const state = makeTBState();
  const target = state.players.find((player) => !player.isHuman);
  assert.ok(target, "expected private whisper target");
  assert.equal(privateChatLimitForDay(1, state.players.length), 5, "day 1 private chat cap should be 5");
  assert.equal(privateChatLimitForDay(2, state.players.length), 4, "day 2 private chat cap should decay to 4");
  assert.equal(privateChatLimitForDay(3, state.players.length), 3, "day 3 private chat cap should decay to 3");
  assert.equal(privateChatLimitForDay(4, state.players.length), 2, "day 4 private chat cap should decay to 2");
  assert.equal(privateChatLimitForDay(5, state.players.length), 1, "later private chat cap should bottom out at 1");
  assert.equal(state.dayStageMeta.privateLimit, 5, "day 1 initialized private chat limit should be 5");

  const first = runPrivateWhisper(
    state,
    { targetId: target.id, humanLine: "你是什么身份？", intentHint: "claim" },
    fixedRng(2281)
  );
  assert.equal(first.ok, true, first.reason);
  assert.equal(first.followUp, false, "first contact should consume a daily private slot");
  assert.equal(state.dayStageMeta.privateUsed, 1, "first contact should count as one private chat");

  const second = runPrivateWhisper(
    state,
    { targetId: target.id, humanLine: "再具体一点，你昨晚得到了什么信息？", intentHint: "night" },
    fixedRng(2282)
  );
  assert.equal(second.ok, true, second.reason);
  assert.equal(second.followUp, true, "same active target should count as a follow-up");
  assert.equal(state.dayStageMeta.privateUsed, 1, "follow-up should not consume another daily private slot");
  assert.equal(second.followUpUsed, 1, "first follow-up should be tracked");

  const third = runPrivateWhisper(
    state,
    { targetId: target.id, humanLine: "你现在最怀疑谁？", intentHint: "suspect" },
    fixedRng(2283)
  );
  assert.equal(third.ok, true, third.reason);
  assert.equal(third.followUp, true, "second follow-up should still be allowed");
  assert.equal(state.dayStageMeta.privateUsed, 1, "second follow-up should not consume another daily private slot");
  assert.equal(third.followUpUsed, 2, "second follow-up should be tracked");

  const fourth = runPrivateWhisper(
    state,
    { targetId: target.id, humanLine: "最后再问一句。", intentHint: "generic" },
    fixedRng(2284)
  );
  assert.equal(fourth.ok, false, "third extra follow-up should be rejected");
  assert.match(fourth.reason, /追问|follow/i, "rejection should explain follow-up exhaustion");
  assert.equal(state.dayStageMeta.privateUsed, 1, "rejected follow-up should not consume a slot");
}

function testDayStanceMemoryPersistsWithinDay() {
  const state = makeTBState();
  advanceDayStage(state, "public");
  runAIDiscussion(state, fixedRng(2285));
  runAIDiscussion(state, fixedRng(2286));

  const dayBucket = state.aiDialogue.dayStanceMemory?.[`${state.day}`] ?? {};
  const aiId = Object.keys(dayBucket)[0];
  assert.ok(aiId, "public discussion should write day stance memory for at least one AI");
  const targetEntries = Object.values(dayBucket[aiId] ?? {});
  assert.ok(targetEntries.length > 0, "day stance memory should contain target stance entries");
  assert.ok(
    targetEntries.some((entry) => entry.turns >= 1 && ["press", "suspect", "watch", "trust"].includes(entry.stance)),
    "day stance memory should store stable stance labels"
  );
}

function testCrossDayStanceHistoryFeedsPublicSpeech() {
  const state = makeTBState();
  advanceDayStage(state, "public");
  const speaker = state.players.filter((player) => !player.isHuman).sort((a, b) => a.seatIndex - b.seatIndex)[0];
  const target = state.players.find((player) => !player.isHuman && player.id !== speaker?.id && player.alive);

  assert.ok(speaker, "expected first public AI speaker");
  assert.ok(target, "expected cross-day stance target");

  const seedTargetPressure = (text) => {
    speaker.dialogueBias = speaker.dialogueBias ?? {};
    speaker.dialogueBias[target.id] = 0.9;
    addAgentObservation(state, speaker.id, {
      kind: "public-speech",
      source: "public-chat",
      private: false,
      text,
      payload: {
        speakerId: target.id,
        focusId: target.id,
        polarity: "accuse",
      },
    });
  };

  seedTargetPressure(`${target.name} 的公开身份和投票节奏对不上。`);
  const firstDay = state.day;
  const first = runAIConversationStep(state, fixedRng(2287));
  assert.equal(first.ok, true, first.reason);
  assert.equal(first.speakerId, speaker.id, "fixture should use the first AI speaker");
  assert.equal(first.focusId, target.id, "day-one public speech should establish the seeded target stance");

  state.day += 1;
  state.dayStage = "public";
  state.dayStageMeta.publicRounds = 0;
  state.dayStageMeta.publicConversation = null;
  state.dayStageMeta.nominationClock = null;
  state.players.forEach((player) => {
    player.nominatedToday = false;
    player.beenNominatedToday = false;
  });

  seedTargetPressure(`${target.name} 昨天那条身份解释今天还没补上。`);
  const second = runAIConversationStep(state, fixedRng(2288));
  assert.equal(second.ok, true, second.reason);
  assert.equal(second.speakerId, speaker.id, "day-two public speech should use the same fixture speaker");
  assert.equal(second.focusId, target.id, "day-two public speech should keep the seeded target stance");
  assert.equal(second.crossDayStance?.previousDay, firstDay, "speech metadata should point back to the previous day");
  assert.equal(second.crossDayStance?.currentDay, state.day, "speech metadata should identify the current day");
  assert.ok(second.crossDayStance?.currentReasonSummary, "cross-day metadata should explain the current-day evidence reason");
  assert.match(second.line, /昨天|天前|新起线|今天转/, "rendered speech should verbalize cross-day stance continuity");

  const history = state.aiDialogue.stanceHistoryBySpeakerId?.[speaker.id]?.[target.id] ?? [];
  assert.ok(history.some((entry) => entry.day === firstDay), "stance history should retain day-one record");
  assert.ok(history.some((entry) => entry.day === state.day), "stance history should retain day-two record");
  assert.ok(history.some((entry) => entry.reasonSummary), "stance history should retain evidence reason summaries");
}

function testCrossDayStanceShiftExplainsCurrentEvidence() {
  const state = makeTBState();
  advanceDayStage(state, "public");
  const speaker = state.players.filter((player) => !player.isHuman).sort((a, b) => a.seatIndex - b.seatIndex)[0];
  const target = state.players.find((player) => !player.isHuman && player.id !== speaker?.id && player.alive);
  const decoy = state.players.find(
    (player) => !player.isHuman && player.id !== speaker?.id && player.id !== target?.id && player.alive
  );

  assert.ok(speaker, "expected first public AI speaker");
  assert.ok(target, "expected cross-day shift target");
  assert.ok(decoy, "expected decoy player");

  speaker.dialogueBias = speaker.dialogueBias ?? {};
  speaker.dialogueBias[target.id] = 0.02;
  speaker.dialogueBias[decoy.id] = -0.25;
  const firstDay = state.day;
  const first = runAIConversationStep(state, fixedRng(2289));
  assert.equal(first.ok, true, first.reason);
  assert.equal(first.focusId, target.id, "day-one fixture should establish the low-pressure target");

  state.day += 1;
  state.dayStage = "public";
  state.dayStageMeta.publicRounds = 0;
  state.dayStageMeta.publicConversation = null;
  state.dayStageMeta.nominationClock = null;
  state.players.forEach((player) => {
    player.nominatedToday = false;
    player.beenNominatedToday = false;
  });

  speaker.dialogueBias[target.id] = 0.35;
  speaker.dialogueBias[decoy.id] = -0.25;
  addAgentObservation(state, speaker.id, {
    kind: "public-vote",
    source: "public-procedure",
    private: false,
    text: `${target.name} 的投票和身份解释连不上，今天必须正面回应。`,
    payload: {
      voterId: target.id,
      targetId: target.id,
      focusId: target.id,
      polarity: "accuse",
    },
  });

  const second = runAIConversationStep(state, fixedRng(2290));
  assert.equal(second.ok, true, second.reason);
  assert.equal(second.focusId, target.id, "day-two fixture should keep the same target with higher pressure");
  assert.equal(second.crossDayStance?.previousDay, firstDay, "cross-day shift should point to day one");
  assert.equal(second.crossDayStance?.continuity, "shift", "metadata should classify the stance change as a shift");
  assert.match(second.line, /今天转|因为/, "rendered speech should explain the cross-day stance shift");
  assert.match(second.line, /投票|身份解释|回应|公开站队|压|可见线索|补清|讲清/, "shift explanation should cite a current evidence reason");
}

function testCrossDayTargetSwitchFallbackIsPlayerVisible() {
  const unchanged = "台面上，身份说法和票型一起压过来。";
  const repaired = ensureCrossDayTargetSwitchExplanation(unchanged, {
    previousDay: 3,
    currentDay: 4,
    previousTargetName: "3号",
    currentTargetName: "9号",
    maxChars: 190,
  });
  assert.match(repaired, /昨天主线在3号/);
  assert.match(repaired, /今天先转9号/);
  assert.match(repaired, /不等于放掉3号/);
  assert.ok(repaired.includes(unchanged), "fallback should preserve the existing public reason within budget");

  const alreadyExplained = "记忆连续性：昨天主线在3号，今天先转9号，不等于放掉3号；新卡点是票型。";
  assert.equal(
    ensureCrossDayTargetSwitchExplanation(alreadyExplained, {
      previousDay: 3,
      currentDay: 4,
      previousTargetName: "3号",
      currentTargetName: "9号",
      maxChars: 190,
    }),
    alreadyExplained,
    "existing visible revision language should not be duplicated"
  );
}

function testAIToAIPrivateWhisperWritesParticipantObservationsOnly() {
  const state = makeTBState();
  const beforeUsed = state.dayStageMeta.privateUsed;
  const beforeTargeted = [...(state.dayStageMeta.privateTargets ?? [])];

  const messages = runAIToAIPrivateWhispers(state, fixedRng(229));
  assert.ok(messages.length > 0, "AI should privately exchange useful information with other AIs");

  const first = messages[0];
  const speaker = state.players.find((player) => player.id === first.speakerId);
  const target = state.players.find((player) => player.id === first.targetId);
  const unrelated = state.players.find(
    (player) => !player.isHuman && player.id !== first.speakerId && player.id !== first.targetId
  );

  assert.ok(speaker, "expected AI-AI speaker");
  assert.ok(target, "expected AI-AI target");
  assert.ok(unrelated, "expected unrelated AI observer");
  assert.equal(state.dayStageMeta.privateUsed, beforeUsed, "AI-AI private whispers should not consume human slots");
  assert.deepEqual(
    state.dayStageMeta.privateTargets ?? [],
    beforeTargeted,
    "AI-AI private whispers should not mark human private targets"
  );

  const speakerWhispers = observationKinds(getAIAgent(state, speaker), "private-whisper");
  const targetWhispers = observationKinds(getAIAgent(state, target), "private-whisper");
  const unrelatedWhispers = observationKinds(getAIAgent(state, unrelated), "private-whisper");

  assert.ok(
    speakerWhispers.some((entry) => entry.text === first.response && entry.payload?.targetId === target.id),
    "speaker should keep its AI-AI whisper as a private observation"
  );
  assert.ok(
    targetWhispers.some((entry) => entry.text === first.response && entry.payload?.speakerId === speaker.id),
    "target should receive the AI-AI whisper as a private observation"
  );
  assert.equal(
    unrelatedWhispers.some((entry) => entry.text === first.response),
    false,
    "unrelated AIs should not receive the AI-AI private whisper"
  );
  assert.ok(
    evidenceKinds(state, target, "private-whisper").some((entry) => entry.text === first.response),
    "AI-AI private whisper should enter the target evidence book"
  );
  assert.ok(
    state.events.speeches.some(
      (entry) =>
        entry.aiToAi &&
        entry.hiddenFromHuman &&
        entry.private &&
        entry.playerId === speaker.id &&
        entry.targetId === target.id
    ),
    "AI-AI private whisper should be stored as hidden private speech"
  );
  assert.equal(
    state.aiDialogue.timeline.some((entry) => entry.text === first.response),
    false,
    "AI-AI private whisper content should not leak into the human-facing dialogue timeline"
  );
  assert.equal(
    JSON.stringify(state.logs).includes(first.response),
    false,
    "human event log should not include AI-AI private content"
  );
  assert.equal(
    state.logs.some((entry) => entry.meta?.aiToAi || /进行了私聊/.test(entry.message ?? "")),
    false,
    "AI-AI private activity should not be displayed in the human event log"
  );
  assert.ok(
    state.players
      .filter((player) => !player.isHuman)
      .some((player) =>
        evidenceKinds(state, player, "private-channel").some(
          (entry) => entry.payload?.speakerId === speaker.id && entry.payload?.targetId === target.id && entry.source === "social-read"
        )
      ),
    "AI-AI private contact should still become a weak social-read line for agents"
  );
}

function testDeadAIPublicDiscussionClaimsAggressively() {
  const state = makeTBState();
  const deadAI = state.players.find((player) => !player.isHuman);
  assert.ok(deadAI, "expected dead AI speaker");

  deadAI.alive = false;
  deadAI.deathReason = "test-death";

  const result = advanceDayStage(state, "public");
  assert.equal(result.ok, true, result.reason);
  runAIDiscussion(state, () => 0.01);

  assert.ok(deadAI.publicClaimRoleId, "dead AI should usually hard-claim instead of staying hidden");
  assert.ok(
    (state.events.claims ?? []).some((entry) => entry.playerId === deadAI.id && !entry.private),
    "dead AI claim should be recorded as public claim evidence"
  );
  assert.ok(
    (state.events.speeches ?? []).some((entry) => entry.playerId === deadAI.id && /我已经死了/.test(entry.line ?? "")),
    "dead AI public speech should explain that it is sharing post-death information"
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
  assert.equal(result.passed, true, "forced yes votes should put the nominee on the block");
  assert.equal(result.onBlock, true, "passed vote should expose the active execution candidate");

  state.players
    .filter((player) => !player.isHuman)
    .forEach((player) => {
      const agent = getAIAgent(state, player);
      assert.ok(observationKinds(agent, "nomination").length > 0, `${player.name} should observe nomination`);
      assert.ok(observationKinds(agent, "vote").length > 0, `${player.name} should observe vote`);
      assert.equal(observationKinds(agent, "execution").length, 0, `${player.name} should not observe execution before day end`);
    });

  assert.equal(skipDay(state, fixedRng(334)), true, "day end should resolve the on-the-block execution");

  state.players
    .filter((player) => !player.isHuman)
    .forEach((player) => {
      const agent = getAIAgent(state, player);
      assert.ok(observationKinds(agent, "execution").length > 0, `${player.name} should observe execution outcome`);
      assert.ok(
        evidenceKinds(state, player, "vote").every((entry) => entry.source === "public-procedure" && !entry.canBeFalse),
        `${player.name} should store vote evidence as reliable public procedure`
      );
    });
}

function testAINominatorVotesForOwnNomination() {
  const state = makeTBState();
  advanceDayStage(state, "public");
  markPublicDiscussionRound(state);
  advanceDayStage(state, "nomination");

  const nominator = state.players.find((player) => !player.isHuman && player.alive);
  const nominee = state.players.find((player) => player.alive && player.id !== nominator.id && player.roleId !== "virgin");
  assert.ok(nominator, "expected AI nominator");
  assert.ok(nominee, "expected nominee");

  const result = resolveNominationAndVote(
    state,
    {
      nominatorId: nominator.id,
      nomineeId: nominee.id,
      humanVoteYes: false,
      decideAIVote: () => false,
    },
    fixedRng(20260515)
  );
  assert.equal(result.accepted, true, result.reason);
  assert.equal(
    result.votes.find((entry) => entry.voterId === nominator.id)?.vote,
    true,
    "AI should visibly vote for the nomination it just made"
  );
}

function testResolveNominationAcceptsDetailedAIVoteRationale() {
  const state = makeTBState();
  advanceDayStage(state, "public");
  markPublicDiscussionRound(state);
  advanceDayStage(state, "nomination");

  const nominator = state.players.find((player) => !player.isHuman && player.alive);
  const nominee = state.players.find((player) => player.alive && player.id !== nominator.id && player.roleId !== "virgin");
  const detailedVoter = state.players.find(
    (player) =>
      !player.isHuman &&
      player.alive &&
      player.id !== nominator.id &&
      player.id !== nominee.id &&
      player.roleId !== "butler"
  );
  assert.ok(nominator, "expected AI nominator");
  assert.ok(nominee, "expected nominee");
  assert.ok(detailedVoter, "expected AI voter eligible for detailed rationale");

  const result = resolveNominationAndVote(
    state,
    {
      nominatorId: nominator.id,
      nomineeId: nominee.id,
      humanVoteYes: false,
      decideAIVote: (voter, target) => ({
        vote: voter.id === detailedVoter.id,
        voteRationale: {
          kind: "vote-rationale",
          audience: "vote",
          publicOnly: true,
          voterId: voter.id,
          nomineeId: target.id,
          vote: voter.id === detailedVoter.id,
          line: `${voter.name} explains a formal vote on ${target.name}.`,
        },
      }),
    },
    fixedRng(20260602)
  );
  assert.equal(result.accepted, true, result.reason);
  const detailedEntry = result.votes.find((entry) => entry.voterId === detailedVoter.id);
  assert.equal(detailedEntry?.vote, true, "engine should preserve detailed callback vote value");
  assert.equal(detailedEntry?.voteRationale?.kind, "vote-rationale");
  assert.equal(detailedEntry?.voteRationale?.audience, "vote");
  assert.equal(detailedEntry?.voteRationale?.publicOnly, true);
  assert.equal(detailedEntry?.voteRationale?.nomineeId, nominee.id);
  assert.ok(detailedEntry?.voteRationale?.line.includes(nominee.name), "vote rationale should preserve readable line");
}

function testAINominationCanPressureNominateWithLowEvidence() {
  const state = makeTBState();
  advanceDayStage(state, "public");
  markPublicDiscussionRound(state);
  advanceDayStage(state, "nomination");

  state.players
    .filter((player) => !player.isHuman)
    .forEach((player) => {
      player.suspicion = {};
      state.players.forEach((target) => {
        player.suspicion[target.id] = target.id === player.id ? 0.01 : 0.49;
      });
      player.reasonFlags = {};
    });

  const deadTarget = state.players.find((player) => !player.isHuman && player.alive);
  assert.ok(deadTarget, "expected target to mark dead");
  deadTarget.alive = false;

  const proposal = chooseAINomination(state);
  assert.ok(proposal, "AI should produce a pressure nomination on day one instead of always passing");
  assert.equal(proposal.pressure, true, "low-evidence nomination should be marked as pressure");
  assert.equal(proposal.strategyIntent, "pressure-test", "low-evidence fallback should be labelled as pressure-test strategy");
  assert.ok(proposal.gameWindow?.pressureNominationAllowed, "nomination proposal should carry game-window pressure metadata");
  assert.match(proposal.reason, /先提|放上台|正面回应/, "pressure nomination should explain its intent");

  assert.match(
    proposal.reason,
    /压力测试|回应|站边|票型|票面/,
    "pressure nomination wording should verbalize strategy intent instead of only carrying metadata"
  );

  const nominee = state.players.find((player) => player.id === proposal.nomineeId);
  const nominator = state.players.find((player) => player.id === proposal.nominatorId);
  assert.ok(nominee?.alive, "AI should not nominate a dead player");
  assert.ok(nominator?.alive, "AI should use a living nominator");
}

function testEarlyAINominationDoesNotSpendLowEvidencePressureOnGoodHuman() {
  const state = makeTBState();
  advanceDayStage(state, "public");
  markPublicDiscussionRound(state);
  advanceDayStage(state, "nomination");
  state.day = 1;
  state.dayStageMeta.publicRounds = 1;

  const human = state.players.find((player) => player.isHuman && player.team === "good" && player.alive);
  const nominator = state.players.find((player) => !player.isHuman && player.team === "good" && player.alive);
  const publicTarget = state.players.find(
    (player) => !player.isHuman && player.alive && player.id !== nominator?.id
  );
  assert.ok(human, "expected a living good human player");
  assert.ok(nominator, "expected a good AI nominator");
  assert.ok(publicTarget, "expected a non-human public-evidence target");

  state.players.forEach((player) => {
    player.nominatedToday = !player.isHuman && player.id !== nominator.id;
    player.beenNominatedToday = false;
    player.reasonFlags = {};
    player.dialogueBias = {};
    player.dialogueBiasMeta = {};
    player.suspicion = {};
    state.players.forEach((target) => {
      player.suspicion[target.id] = target.id === player.id ? 0.01 : 0.12;
    });
    const agent = getAIAgent(state, player);
    if (agent) {
      agent.observations = [];
      agent.evidenceBook = [];
      agent.beliefTrailByPlayerId = {};
    }
  });

  nominator.aiPersona = "steady";
  nominator.dialogueBias[human.id] = 0.42;
  nominator.dialogueBiasMeta[human.id] = {
    visibility: "public",
    reasonKey: "tablePressure",
  };
  addAgentObservation(state, nominator.id, {
    kind: "public-speech",
    source: "public-chat",
    private: false,
    text: `${publicTarget.name} has the only public, testable contradiction on day one.`,
    payload: {
      speakerId: publicTarget.id,
      focusId: publicTarget.id,
      polarity: "accuse",
    },
  });

  refreshAIBeliefs(state);
  assert.equal(
    getDialogueEvidenceForTarget(state, nominator, human.id, { publicOnly: true, includePrivate: false }).length,
    0,
    "fixture should leave the human with no public evidence"
  );
  assert.ok(
    getDialogueEvidenceForTarget(state, nominator, publicTarget.id, { publicOnly: true, includePrivate: false }).length >= 1,
    "fixture should give the non-human target public evidence"
  );

  const proposal = chooseAINomination(state);
  assert.ok(proposal, "day-one AI should still make a pressure nomination");
  assert.equal(proposal.nominatorId, nominator.id, "fixture should leave only the audited AI able to nominate");
  assert.equal(
    proposal.nomineeId,
    publicTarget.id,
    "early AI pressure should use a public-evidence target instead of a low-evidence good human player"
  );
  assert.notEqual(proposal.nomineeId, human.id, "good human player should not be the low-evidence day-one pressure target");
}

function testPublicStatementMemoryLowersVoteThresholdForOwnFocus() {
  const state = makeTBState();
  const voter = state.players.find((player) => !player.isHuman && player.team === "good" && player.alive);
  const nominee = state.players.find((player) => !player.isHuman && player.id !== voter.id && player.alive);
  const other = state.players.find((player) => !player.isHuman && player.id !== voter.id && player.id !== nominee.id && player.alive);

  assert.ok(voter, "expected good AI voter");
  assert.ok(nominee, "expected nominee");
  assert.ok(other, "expected comparison nominee");

  voter.suspicion[nominee.id] = 0.52;
  voter.suspicion[other.id] = 0.52;
  state.aiDialogue.statementMemory.publicBySpeakerId[voter.id] = {
    day: state.day,
    speakerId: voter.id,
    audience: "public",
    focusId: nominee.id,
    focusName: nominee.name,
    focusScore: 0.62,
    stance: "suspect",
    evidenceSummary: "public pressure line",
    voteStance: "",
  };

  assert.equal(decideAIVote(voter, nominee, state, () => 0.99), true, "AI should vote with its public pressure line");
  assert.equal(decideAIVote(voter, other, state, () => 0.99), false, "memory should not lower threshold for other nominees");
}

function testDetailedAIVoteMatchesLegacyBooleanAndExplainsDecision() {
  const state = makeTBState();
  const voter = state.players.find((player) => !player.isHuman && player.team === "good" && player.alive);
  const nominee = state.players.find((player) => !player.isHuman && player.id !== voter.id && player.alive);
  assert.ok(voter, "expected good AI voter");
  assert.ok(nominee, "expected nominee");

  voter.suspicion[nominee.id] = 0.78;
  addAgentObservation(state, voter.id, {
    kind: "public-speech",
    source: "public-chat",
    private: false,
    text: `${nominee.name} gave a mismatched public claim and vote story.`,
    payload: {
      speakerId: nominee.id,
      focusId: nominee.id,
      polarity: "accuse",
    },
  });

  const detailed = decideAIVoteWithRationale(voter, nominee, state, () => 0.99);
  assert.equal(
    detailed.vote,
    decideAIVote(voter, nominee, state, () => 0.99),
    "detailed vote should preserve the legacy boolean decision"
  );
  assert.equal(detailed.voteRationale.kind, "vote-rationale");
  assert.equal(detailed.voteRationale.audience, "vote");
  assert.equal(detailed.voteRationale.publicOnly, true);
  assert.equal(detailed.voteRationale.voterId, voter.id);
  assert.equal(detailed.voteRationale.nomineeId, nominee.id);
  assert.equal(detailed.voteRationale.vote, detailed.vote);
  assert.equal(typeof detailed.voteRationale.suspicion, "number");
  assert.equal(typeof detailed.voteRationale.threshold, "number");
  assert.equal(typeof detailed.voteRationale.reasonKey, "string");
  assert.ok(detailed.voteRationale.reasonKey.length > 0, "vote rationale should classify the decision");
  assert.ok(detailed.voteRationale.line.includes(nominee.name), "vote rationale line should name the nominee");
}

function testPublicVoteRationaleEvidenceCountIgnoresPrivateInfo() {
  const state = makeTBState();
  const voter = state.players.find((player) => !player.isHuman && player.team === "good" && player.alive);
  const nominee = state.players.find((player) => !player.isHuman && player.id !== voter?.id && player.alive);
  assert.ok(voter, "expected good AI voter");
  assert.ok(nominee, "expected nominee");

  const agent = getAIAgent(state, voter);
  agent.evidenceBook = [];
  agent.observations = [];
  voter.suspicion[nominee.id] = 0.7;
  addAgentObservation(state, voter.id, {
    kind: "night-info",
    source: "storyteller",
    private: true,
    text: "PRIVATE_VOTE_MARKER should not count for public vote rationale",
    payload: { targetId: nominee.id },
  });

  const privateOnly = decideAIVoteWithRationale(voter, nominee, state, () => 0.99);
  assert.equal(privateOnly.voteRationale.publicOnly, true);
  assert.equal(
    privateOnly.voteRationale.evidenceCount,
    0,
    "public vote rationale should not count private-only evidence"
  );
  assert.doesNotMatch(
    JSON.stringify(privateOnly.voteRationale),
    /PRIVATE_VOTE_MARKER/,
    "public vote rationale should not serialize private-only evidence text"
  );

  addAgentObservation(state, voter.id, {
    kind: "public-speech",
    source: "public-chat",
    private: false,
    text: "PUBLIC_VOTE_MARKER nominee contradicted their public claim",
    payload: { speakerId: nominee.id, focusId: nominee.id, polarity: "accuse" },
  });
  const withPublicEvidence = decideAIVoteWithRationale(voter, nominee, state, () => 0.99);
  assert.equal(
    withPublicEvidence.voteRationale.evidenceCount,
    1,
    "public vote rationale should still count visible public evidence"
  );
}

function testStrategyPersonaChangesVoteBehavior() {
  const state = makeTBState();
  const pressureVoter = state.players.find((player) => !player.isHuman && player.team === "good");
  const steadyVoter = state.players.find(
    (player) => !player.isHuman && player.team === "good" && player.id !== pressureVoter.id
  );
  const nominee = state.players.find(
    (player) => !player.isHuman && player.id !== pressureVoter.id && player.id !== steadyVoter.id
  );

  assert.ok(pressureVoter, "expected pressure voter");
  assert.ok(steadyVoter, "expected steady voter");
  assert.ok(nominee, "expected nominee");

  pressureVoter.aiPersona = "pressure";
  steadyVoter.aiPersona = "steady";
  pressureVoter.suspicion[nominee.id] = 0.5;
  steadyVoter.suspicion[nominee.id] = 0.5;
  addAgentObservation(state, pressureVoter.id, {
    kind: "public-speech",
    source: "public-chat",
    private: false,
    text: "Persona evidence: nominee dodged the main world.",
    payload: {
      speakerId: nominee.id,
      focusId: nominee.id,
    },
  });

  assert.equal(
    decideAIVote(pressureVoter, nominee, state, () => 0.99),
    true,
    "pressure persona should vote earlier when it has evidence"
  );
  assert.equal(
    decideAIVote(steadyVoter, nominee, state, () => 0.99),
    false,
    "steady persona should wait at the same suspicion without evidence"
  );
}

function testStrategyGameWindowChangesVoteRisk() {
  const state = makeTBState();
  const voter = state.players.find((player) => !player.isHuman && player.team === "good" && player.alive);
  const nominee = state.players.find((player) => !player.isHuman && player.id !== voter.id && player.alive);
  assert.ok(voter, "expected good AI voter");
  assert.ok(nominee, "expected nominee");

  voter.aiPersona = "steady";
  voter.suspicion[nominee.id] = 0.56;
  assert.equal(
    decideAIVote(voter, nominee, state, () => 0.99),
    false,
    "early steady voter should not execute on medium suspicion without evidence"
  );

  state.players
    .filter((player) => !player.isHuman && player.id !== voter.id && player.id !== nominee.id)
    .slice(0, 4)
    .forEach((player) => {
      player.alive = false;
    });
  addAgentObservation(state, voter.id, {
    kind: "public-speech",
    source: "public-chat",
    private: false,
    text: `${nominee.name} dodged a public claim under late-game pressure.`,
    payload: {
      speakerId: nominee.id,
      focusId: nominee.id,
      polarity: "accuse",
    },
  });

  const window = evaluateGameWindow(state, voter, { stage: "nomination" });
  assert.equal(window.mustExecute, true, "five alive should become a must-execute window");
  assert.equal(window.voteThreshold, 3, "five alive vote threshold should be three");
  assert.equal(
    decideAIVote(voter, nominee, state, () => 0.99),
    true,
    "late-game evidence should lower vote hesitation without changing vote rules"
  );
}

function testHumanPublicCaseNominationCanCarryEarlyVotePressure() {
  const rng = fixedRng(202606081);
  const state = createNewGame({ scriptId: "tb", playerCount: 9, preferredHumanRoleId: "washerwoman" }, rng);
  initializeAI(state);
  runNight(state, rng);
  initializeAI(state);
  advanceDayStage(state, "public");
  markPublicDiscussionRound(state);
  advanceDayStage(state, "nomination");

  const human = state.players.find((player) => player.isHuman && player.team === "good");
  const demon = state.players.find((player) => !player.isHuman && player.category === "demon" && player.alive);
  const goodVoter = state.players.find((player) => !player.isHuman && player.team === "good" && player.alive);
  assert.ok(human, "expected human nominator");
  assert.ok(demon, "expected demon nominee");
  assert.ok(goodVoter, "expected good AI voter");

  assert.equal(
    decideAIVoteWithRationale(goodVoter, demon, state, () => 0.99).vote,
    false,
    "without a public case and formal nomination, early good AI should not execute on prior suspicion alone"
  );

  recordPublicSpeechForAgents(state, {
    speakerId: human.id,
    focusId: demon.id,
    polarity: "accuse",
    text: `${human.name} publicly puts ${demon.name} forward as the strongest demon-world candidate from night information.`,
  });
  refreshAIBeliefs(state);

  const result = resolveNominationAndVote(
    state,
    {
      nominatorId: human.id,
      nomineeId: demon.id,
      humanVoteYes: true,
      decideAIVote: decideAIVoteWithRationale,
    },
    rng
  );
  const goodAIVotes = result.votes.filter((entry) => {
    const voter = state.players.find((player) => player.id === entry.voterId);
    return voter && !voter.isHuman && voter.team === "good" && entry.vote;
  });
  const sampleGoodVote = result.votes.find((entry) => entry.voterId === goodVoter.id);

  assert.equal(result.accepted, true, result.reason);
  assert.equal(result.passed, true, "human public case plus formal nomination should be able to put a target on the block");
  assert.ok(goodAIVotes.length >= result.threshold - 1, "public case should earn enough good AI support beyond the human vote");
  assert.equal(sampleGoodVote?.vote, true, "a good AI voter should follow the public human case once it is formally nominated");
  assert.equal(sampleGoodVote?.voteRationale?.nominationProcedurePressure?.humanNominator, true);
  assert.ok(
    sampleGoodVote?.voteRationale?.nominationProcedurePressure?.publicCaseEvidenceCount >= 1,
    "vote pressure should be tied to visible public case evidence, not private human information"
  );
}

function testLateGameHumanNominationPressureCanCarryExecutionVote() {
  const state = makeTBState();
  const human = state.players.find((player) => player.isHuman);
  const voter = state.players.find((player) => !player.isHuman && player.team === "good" && player.alive);
  const demon = state.players.find((player) => !player.isHuman && player.category === "demon" && player.alive);
  assert.ok(human, "expected human nominator");
  assert.ok(voter, "expected good AI voter");
  assert.ok(demon, "expected demon nominee");

  state.phase = "day";
  state.day = 5;
  state.dayStage = "nomination";
  state.players.forEach((player) => {
    player.alive = [human.id, voter.id, demon.id].includes(player.id);
    player.nominatedToday = false;
    player.beenNominatedToday = false;
  });
  voter.aiPersona = "steady";
  voter.suspicion[demon.id] = 0.45;
  assert.equal(
    decideAIVoteWithRationale(voter, demon, state, () => 0.99).vote,
    false,
    "without an active nomination, steady AI should not execute on medium suspicion alone"
  );

  const result = resolveNominationAndVote(
    state,
    {
      nominatorId: human.id,
      nomineeId: demon.id,
      humanVoteYes: true,
      decideAIVote: decideAIVoteWithRationale,
    },
    fixedRng(260606)
  );
  const aiVote = result.votes.find((entry) => entry.voterId === voter.id);
  assert.equal(result.accepted, true);
  assert.equal(aiVote?.vote, true, "late-game AI should treat current human nomination as executable table pressure");
  assert.equal(result.passed, true, "human nomination plus AI support should be able to execute in final three");
  assert.equal(aiVote?.voteRationale?.nominationProcedurePressure?.active, true);
  assert.equal(aiVote?.voteRationale?.nominationProcedurePressure?.humanNominator, true);
  assert.ok(
    aiVote?.voteRationale?.suspicion > 0.45,
    "vote rationale should expose the nomination-pressure-adjusted suspicion"
  );
}

function testLateGameAINominationProjectsExecutableVote() {
  const state = makeTBState();
  const human = state.players.find((player) => player.isHuman);
  const demon = state.players.find((player) => !player.isHuman && player.category === "demon" && player.alive);
  const goodAIs = state.players.filter((player) => !player.isHuman && player.team === "good" && player.alive && player.id !== demon?.id);
  assert.ok(human, "expected human player");
  assert.ok(demon, "expected AI demon");
  assert.ok(goodAIs.length >= 3, "expected enough good AI voters for final five");

  advanceDayStage(state, "public");
  markPublicDiscussionRound(state);
  advanceDayStage(state, "nomination");
  state.day = 4;
  const aliveIds = new Set([human.id, demon.id, goodAIs[0].id, goodAIs[1].id, goodAIs[2].id]);
  state.players.forEach((player) => {
    player.alive = aliveIds.has(player.id);
    player.nominatedToday = false;
    player.beenNominatedToday = false;
    player.reasonFlags = {};
    player.dialogueBias = {};
    player.suspicion = {};
    aliveIds.forEach((targetId) => {
      player.suspicion[targetId] = targetId === player.id ? 0.01 : 0.12;
    });
    if (!player.isHuman && player.team === "good") {
      player.suspicion[demon.id] = 0.35;
    }
  });
  human.suspicion[demon.id] = 0.72;
  const demonAgent = getAIAgent(state, demon);
  if (demonAgent) {
    demonAgent.observations = [];
    demonAgent.evidenceBook = [];
  }
  goodAIs.forEach((player) => {
    const agent = getAIAgent(state, player);
    if (agent) {
      agent.observations = [];
      agent.evidenceBook = [];
      agent.beliefTrailByPlayerId = {};
    }
    player.dialogueBias[demon.id] = 0.25;
    addAgentObservation(state, player.id, {
      kind: "public-speech",
      source: "public-chat",
      private: false,
      text: `${demon.name} has the clearest final-five risk: claim and vote path do not line up.`,
      payload: {
        focusId: demon.id,
        polarity: "accuse",
      },
    });
  });

  const proposal = chooseAINomination(state);
  assert.ok(proposal, "late-game AI should create a nomination proposal instead of passing the day");
  assert.equal(proposal.nomineeId, demon.id, "good AI should put the highest-risk demon seat on the block");
  assert.ok(
    proposal.expectedSupport >= proposal.coalition.threshold,
    "late-game proposal should project enough formal nomination support to execute"
  );
  assert.equal(proposal.coalition.likelyPasses, true, "coalition simulation should classify the vote as likely passing");
  assert.equal(proposal.strategyIntent, "execution-push", "final-five executable vote should be treated as an execution push");
  assert.equal(proposal.strategyRationale?.likelyPasses, true, "strategy rationale should expose the executable vote window");

  const result = resolveNominationAndVote(
    state,
    {
      nominatorId: proposal.nominatorId,
      nomineeId: proposal.nomineeId,
      humanVoteYes: true,
      decideAIVote: decideAIVoteWithRationale,
    },
    fixedRng(260607)
  );
  assert.equal(result.accepted, true, result.reason);
  assert.equal(result.passed, true, "projected executable AI nomination should actually pass the vote");
  assert.ok(result.yesVotes >= result.threshold, "formal vote should meet the execution threshold");
}

function testRepeatedNoExecutionPressureMakesBMRZombuulVoteExecutable() {
  const rng = fixedRng(20260613);
  const state = createNewGame({ scriptId: "bmr", playerCount: 9, preferredHumanRoleId: "zombuul" }, rng);
  initializeAI(state);

  state.phase = "day";
  state.day = 4;
  state.night = 4;
  state.dayStage = "private";

  const humanZombuul = state.players.find((player) => player.isHuman && player.roleId === "zombuul");
  const goodAIs = state.players.filter((player) => !player.isHuman && player.team === "good");
  const evilAI = state.players.find((player) => !player.isHuman && player.team === "evil");
  assert.ok(humanZombuul, "expected the human player to be Zombuul");
  assert.ok(goodAIs.length >= 5, "expected enough good AI voters for a seven-player BMR day");
  assert.ok(evilAI, "expected an evil AI to keep the table at seven voters");

  const aliveGoodAIs = goodAIs.slice(0, 5);
  const aliveIds = new Set([humanZombuul.id, evilAI.id, ...aliveGoodAIs.map((player) => player.id)]);
  state.players.forEach((player) => {
    player.alive = aliveIds.has(player.id);
    player.nominatedToday = false;
    player.beenNominatedToday = false;
    player.ghostVoteAvailable = false;
    player.reasonFlags = {};
    player.dialogueBias = {};
    player.suspicion = {};
    aliveIds.forEach((targetId) => {
      player.suspicion[targetId] = targetId === player.id ? 0.01 : 0.18;
    });
  });

  aliveGoodAIs.forEach((player) => {
    const agent = getAIAgent(state, player);
    if (agent) {
      agent.observations = [];
      agent.evidenceBook = [];
      agent.beliefTrailByPlayerId = {};
    }
    player.suspicion[humanZombuul.id] = 0.38;
    player.dialogueBias[humanZombuul.id] = 0.12;
    addAgentObservation(state, player.id, {
      kind: "public-speech",
      source: "public-chat",
      private: false,
      text: `${humanZombuul.name} has survived repeated no-execution days with no coherent demon-world answer.`,
      payload: {
        focusId: humanZombuul.id,
        polarity: "accuse",
      },
    });
  });

  state.events.votes = [1, 2, 3].map((day) => ({
    day,
    nominatorId: aliveGoodAIs[0].id,
    nomineeId: aliveGoodAIs[1].id,
    yesVotes: 2,
    threshold: 4,
    votes: [],
    passed: false,
  }));
  state.events.executions = [];

  assert.equal(advanceDayStage(state, "public").ok, true, "fixture should enter public discussion");
  markPublicDiscussionRound(state);
  assert.equal(advanceDayStage(state, "nomination").ok, true, "fixture should enter nominations");

  const window = evaluateGameWindow(state, aliveGoodAIs[0], { stage: "nomination" });
  assert.equal(window.mustExecute, true, "day four BMR should be an execution window");
  assert.equal(window.priorNoExecutionVoteDays, 3, "fixture should expose repeated failed vote days");

  const proposal = chooseAINomination(state);
  assert.ok(proposal, "BMR AI should nominate instead of accepting another no-execution day");
  assert.equal(proposal.nomineeId, humanZombuul.id, "good AI should focus the pressured Zombuul seat");
  assert.equal(proposal.coalition.likelyPasses, true, "coalition simulation should treat repeated no-execution pressure as executable");
  assert.ok(
    proposal.coalition.expectedYesVotes >= proposal.coalition.threshold,
    "proposal should project enough support to clear the public threshold"
  );

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
  assert.equal(result.accepted, true, result.reason);
  assert.equal(result.passed, true, "repeated no-execution pressure should produce a real execution vote");
  assert.ok(result.yesVotes >= result.threshold, "formal vote should meet the public execution threshold");
}

function testEarlyFailedPressureBudgetStopsFifthLowImpactNomination() {
  const rng = fixedRng(20260615);
  const state = createNewGame({ scriptId: "bmr", playerCount: 9, preferredHumanRoleId: "zombuul" }, rng);
  initializeAI(state);
  runNight(state, rng);
  initializeAI(state);
  assert.equal(advanceDayStage(state, "public").ok, true, "fixture should enter public discussion");
  markPublicDiscussionRound(state);
  assert.equal(advanceDayStage(state, "nomination").ok, true, "fixture should enter nominations");

  const voters = state.players.filter((player) => !player.isHuman && player.alive);
  assert.ok(voters.length >= 6, "fixture needs enough AI players for failed pressure votes");
  state.events.votes = [
    {
      day: state.day,
      nominatorId: voters[0].id,
      nomineeId: voters[1].id,
      yesVotes: 2,
      threshold: 5,
      votes: [],
      passed: false,
    },
    {
      day: state.day,
      nominatorId: voters[2].id,
      nomineeId: voters[3].id,
      yesVotes: 2,
      threshold: 5,
      votes: [],
      passed: false,
    },
    {
      day: state.day,
      nominatorId: voters[4].id,
      nomineeId: voters[5].id,
      yesVotes: 2,
      threshold: 5,
      votes: [],
      passed: false,
    },
    {
      day: state.day,
      nominatorId: voters[5].id,
      nomineeId: voters[0].id,
      yesVotes: 2,
      threshold: 5,
      votes: [],
      passed: false,
    },
  ];
  state.events.executions = [];
  state.dayStageMeta.executionCandidate = null;

  const proposal = chooseAINomination(state);
  assert.equal(
    proposal,
    null,
    "day-one AI should stop adding low-impact pressure nominations after four failed votes without an execution candidate"
  );
}

function testGenericFailedPressureBudgetStopsFifthLowImpactNomination() {
  const rng = fixedRng(20260617);
  const state = createNewGame({ scriptId: "tb", playerCount: 9, preferredHumanRoleId: "imp" }, rng);
  initializeAI(state);
  runNight(state, rng);
  initializeAI(state);
  assert.equal(advanceDayStage(state, "public").ok, true, "fixture should enter public discussion");
  markPublicDiscussionRound(state);
  assert.equal(advanceDayStage(state, "nomination").ok, true, "fixture should enter nominations");

  const voters = state.players.filter((player) => !player.isHuman && player.alive);
  assert.ok(voters.length >= 6, "fixture needs enough AI players for failed pressure votes");
  state.players.forEach((player) => {
    player.suspicion = {};
    state.players.forEach((target) => {
      player.suspicion[target.id] = target.id === player.id ? 0.01 : 0.16;
    });
    player.reasonFlags = {};
    player.dialogueBias = {};
  });
  state.events.votes = [
    {
      day: state.day,
      nominatorId: voters[0].id,
      nomineeId: voters[1].id,
      yesVotes: 2,
      threshold: 5,
      votes: [],
      passed: false,
    },
    {
      day: state.day,
      nominatorId: voters[2].id,
      nomineeId: voters[3].id,
      yesVotes: 2,
      threshold: 5,
      votes: [],
      passed: false,
    },
    {
      day: state.day,
      nominatorId: voters[4].id,
      nomineeId: voters[5].id,
      yesVotes: 2,
      threshold: 5,
      votes: [],
      passed: false,
    },
    {
      day: state.day,
      nominatorId: voters[5].id,
      nomineeId: voters[0].id,
      yesVotes: 2,
      threshold: 5,
      votes: [],
      passed: false,
    },
  ];
  state.events.executions = [];
  state.dayStageMeta.executionCandidate = null;

  const proposal = chooseAINomination(state);
  assert.equal(
    proposal,
    null,
    "non-BMR day-one AI should stop adding a fifth low-impact failed pressure nomination"
  );
}

function testSnVFailedPressureBudgetAllowsExecutableMustExecuteNomination() {
  const rng = fixedRng(20260618);
  const state = createNewGame({ scriptId: "snv", playerCount: 9, preferredHumanRoleId: "clockmaker" }, rng);
  initializeAI(state);
  runNight(state, rng);
  initializeAI(state);
  advanceDayStage(state, "public");
  markPublicDiscussionRound(state);
  advanceDayStage(state, "nomination");
  state.day = 4;
  state.night = 4;

  const human = state.players.find((player) => player.isHuman);
  const demon = state.players.find((player) => !player.isHuman && player.category === "demon");
  const goodAIs = state.players.filter((player) => !player.isHuman && player.team === "good" && player.id !== demon?.id);
  assert.ok(human, "expected human player");
  assert.ok(demon, "expected AI demon");
  assert.ok(goodAIs.length >= 1, "fixture needs a good AI voter for final three");

  applyRoleForContract(state, demon, "vortox");
  const aliveGoodAIs = goodAIs.slice(0, 1);
  const aliveIds = new Set([human.id, demon.id, ...aliveGoodAIs.map((player) => player.id)]);
  state.players.forEach((player) => {
    player.alive = aliveIds.has(player.id);
    player.nominatedToday = false;
    player.beenNominatedToday = false;
    player.reasonFlags = {};
    player.dialogueBias = {};
    player.suspicion = {};
    aliveIds.forEach((targetId) => {
      player.suspicion[targetId] = targetId === player.id ? 0.01 : 0.12;
    });
    if (!player.isHuman && player.team === "good") {
      player.suspicion[demon.id] = 0.72;
      player.dialogueBias[demon.id] = 0.16;
      addAgentObservation(state, player.id, {
        kind: "public-speech",
        source: "public-chat",
        private: false,
        text: `${demon.name} has the cleanest SnV demon-world pressure and this window needs an execution.`,
        payload: {
          focusId: demon.id,
          polarity: "accuse",
        },
      });
    }
  });

  state.events.votes = [0, 1, 2].map((index) => ({
    day: state.day,
    nominatorId: aliveGoodAIs[index % aliveGoodAIs.length].id,
    nomineeId: human.id,
    yesVotes: 1,
    threshold: 2,
    votes: [],
    passed: false,
  }));
  state.events.executions = [];
  state.dayStageMeta.executionCandidate = null;

  const proposal = chooseAINomination(state);
  assert.ok(proposal, "SnV must-execute window should still nominate after failed pressure if the vote is executable");
  assert.equal(proposal.nomineeId, demon.id, "AI should spend the over-budget nomination on the executable demon world");
  assert.ok(
    proposal.gameWindow?.mustExecute || (proposal.strategyContext?.goodDayStrategy?.noExecutionRisk ?? 0) >= 0.36,
    "the over-budget SnV proposal should be tied to a real execution/no-execution-risk window"
  );
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
  assert.equal(result.accepted, true, result.reason);
  assert.equal(result.passed, true, "the over-budget SnV proposal should actually pass the formal vote");
}

function testBMRNominationAvoidsRecentlyExecutedSurvivorWhenFreshTargetExists() {
  const rng = fixedRng(20260616);
  const state = createNewGame({ scriptId: "bmr", playerCount: 9, preferredHumanRoleId: "zombuul" }, rng);
  initializeAI(state);
  runNight(state, rng);
  initializeAI(state);

  state.phase = "day";
  state.day = 7;
  state.night = 7;
  state.dayStage = "nomination";
  state.dayStageMeta = {
    ...(state.dayStageMeta ?? {}),
    publicRounds: 1,
    executionCandidate: null,
  };
  state.events.votes = [];
  state.events.executions = [];

  const observer = state.players.find((player) => !player.isHuman && player.team === "good" && player.alive);
  const survivor = state.players.find(
    (player) => !player.isHuman && player.id !== observer?.id && player.team === "good" && player.alive
  );
  const freshTarget = state.players.find(
    (player) => !player.isHuman && player.id !== observer?.id && player.id !== survivor?.id && player.alive
  );
  assert.ok(observer, "expected a good AI nominator");
  assert.ok(survivor, "expected a living no-death execution target");
  assert.ok(freshTarget, "expected a fresh alternative target");

  applyRoleForContract(state, survivor, "sailor");
  state.players.forEach((player) => {
    player.nominatedToday = !player.isHuman && player.id !== observer.id;
    player.beenNominatedToday = false;
    player.suspicion = {};
    player.reasonFlags = {};
    player.dialogueBias = {};
    state.players.forEach((target) => {
      player.suspicion[target.id] = target.id === player.id ? 0.01 : 0.14;
    });
  });
  observer.nominatedToday = false;
  observer.suspicion[survivor.id] = 0.86;
  observer.suspicion[freshTarget.id] = 0.66;

  state.events.executions.push({
    day: state.day - 1,
    nominatorId: observer.id,
    nomineeId: survivor.id,
    roleId: survivor.roleId,
    reason: "vote-execution",
    yesVotes: 5,
    threshold: 4,
    died: false,
  });
  addAgentObservation(state, observer.id, {
    kind: "public-speech",
    source: "public-chat",
    private: false,
    text: `${freshTarget.name} has a fresh BMR protection story that still needs a vote check.`,
    payload: {
      speakerId: freshTarget.id,
      focusId: freshTarget.id,
      polarity: "accuse",
    },
  });

  const proposal = chooseAINomination(state);
  assert.ok(proposal, "AI should still find a nomination instead of stalling the day");
  assert.equal(proposal.nominatorId, observer.id, "fixture leaves only the observer able to nominate");
  assert.notEqual(proposal.nomineeId, survivor.id, "AI should not immediately repeat a no-death execution target");
  assert.equal(proposal.nomineeId, freshTarget.id, "AI should spend the nomination on the fresh viable target");
}

function testAIStopsAfterHighVoteExecutionCandidateIsNotSafelyOvertaken() {
  const rng = fixedRng(20260614);
  const state = createNewGame({ scriptId: "bmr", playerCount: 9, preferredHumanRoleId: "zombuul" }, rng);
  initializeAI(state);

  state.phase = "day";
  state.day = 4;
  state.night = 4;
  state.dayStage = "private";

  const humanZombuul = state.players.find((player) => player.isHuman && player.roleId === "zombuul");
  const goodAIs = state.players.filter((player) => !player.isHuman && player.team === "good");
  const evilAI = state.players.find((player) => !player.isHuman && player.team === "evil");
  assert.ok(humanZombuul, "expected the human player to be Zombuul");
  assert.ok(goodAIs.length >= 5, "expected enough good AI voters for a seven-player BMR day");
  assert.ok(evilAI, "expected an evil AI to keep the table at seven voters");

  const aliveGoodAIs = goodAIs.slice(0, 5);
  const aliveIds = new Set([humanZombuul.id, evilAI.id, ...aliveGoodAIs.map((player) => player.id)]);
  state.players.forEach((player) => {
    player.alive = aliveIds.has(player.id);
    player.nominatedToday = false;
    player.beenNominatedToday = false;
    player.ghostVoteAvailable = false;
    player.reasonFlags = {};
    player.dialogueBias = {};
    player.suspicion = {};
    aliveIds.forEach((targetId) => {
      player.suspicion[targetId] = targetId === player.id ? 0.01 : 0.18;
    });
  });

  aliveGoodAIs.forEach((player) => {
    const agent = getAIAgent(state, player);
    if (agent) {
      agent.observations = [];
      agent.evidenceBook = [];
      agent.beliefTrailByPlayerId = {};
    }
    player.suspicion[humanZombuul.id] = 0.38;
    player.dialogueBias[humanZombuul.id] = 0.12;
    addAgentObservation(state, player.id, {
      kind: "public-speech",
      source: "public-chat",
      private: false,
      text: `${humanZombuul.name} has survived repeated no-execution days with no coherent demon-world answer.`,
      payload: {
        focusId: humanZombuul.id,
        polarity: "accuse",
      },
    });
  });

  state.events.votes = [1, 2, 3].map((day) => ({
    day,
    nominatorId: aliveGoodAIs[0].id,
    nomineeId: aliveGoodAIs[1].id,
    yesVotes: 2,
    threshold: 4,
    votes: [],
    passed: false,
  }));
  state.events.executions = [];

  assert.equal(advanceDayStage(state, "public").ok, true, "fixture should enter public discussion");
  markPublicDiscussionRound(state);
  assert.equal(advanceDayStage(state, "nomination").ok, true, "fixture should enter nominations");

  const currentOnBlock = aliveGoodAIs[1];
  currentOnBlock.beenNominatedToday = true;
  state.dayStageMeta.executionCandidate = {
    day: state.day,
    nomineeId: currentOnBlock.id,
    yesVotes: 6,
    threshold: 4,
    nominatorId: aliveGoodAIs[0].id,
    voteIndex: 0,
  };

  const proposal = chooseAINomination(state);
  assert.equal(
    proposal,
    null,
    "AI should stop after a six-vote execution candidate when no later nomination is safely projected to reach seven"
  );
}

function setupOnBlockOvertakeState({ currentYesVotes = 3 } = {}) {
  const state = makeTBState();
  advanceDayStage(state, "public");
  markPublicDiscussionRound(state);
  advanceDayStage(state, "nomination");
  state.day = 4;

  const human = state.players.find((player) => player.isHuman);
  const aiNominator = state.players.find((player) => !player.isHuman && player.team === "good" && player.alive);
  const currentOnBlock = state.players.find((player) => !player.isHuman && player.alive && player.id !== aiNominator.id);
  const overtakeTarget = state.players.find(
    (player) => !player.isHuman && player.alive && player.id !== aiNominator.id && player.id !== currentOnBlock.id && player.roleId !== "virgin"
  );
  const otherAlive = state.players
    .filter((player) => !player.isHuman && player.alive && ![aiNominator.id, currentOnBlock.id, overtakeTarget.id].includes(player.id))
    .slice(0, 1);
  assert.ok(human, "expected human player");
  assert.ok(aiNominator, "expected AI nominator");
  assert.ok(currentOnBlock, "expected current on-block nominee");
  assert.ok(overtakeTarget, "expected overtake target");
  assert.equal(otherAlive.length, 1, "fixture needs one additional living voter");

  const aliveIds = new Set([human.id, aiNominator.id, currentOnBlock.id, overtakeTarget.id, ...otherAlive.map((player) => player.id)]);
  state.players.forEach((player) => {
    player.alive = aliveIds.has(player.id);
    player.nominatedToday = false;
    player.beenNominatedToday = false;
  });
  currentOnBlock.beenNominatedToday = true;
  state.dayStageMeta.executionCandidate = {
    day: state.day,
    nomineeId: currentOnBlock.id,
    yesVotes: currentYesVotes,
    threshold: Math.ceil(aliveIds.size / 2),
    nominatorId: human.id,
    voteIndex: 0,
  };
  state.aiDialogue.statementMemory.publicBySpeakerId[aiNominator.id] = {
    day: state.day,
    speakerId: aiNominator.id,
    audience: "public",
    focusId: overtakeTarget.id,
    focusName: overtakeTarget.name,
    focusScore: 0.7,
    stance: "suspect",
    evidenceSummary: "public pressure line",
    voteStance: "",
  };
  state.players
    .filter((player) => !player.isHuman && player.alive)
    .forEach((voter) => {
      addAgentObservation(state, voter.id, {
        kind: "public-speech",
        source: "public-chat",
        private: false,
        text: `${overtakeTarget.name} has contradictory public evidence.`,
        payload: {
          speakerId: overtakeTarget.id,
          focusId: overtakeTarget.id,
          polarity: "accuse",
        },
      });
    });
  return { state, aiNominator, currentOnBlock, overtakeTarget };
}

function testAINominationOvertakesCurrentExecutionCandidateWhenVotesExist() {
  const { state, currentOnBlock } = setupOnBlockOvertakeState({ currentYesVotes: 3 });

  const proposal = chooseAINomination(state);
  assert.ok(proposal, "AI should nominate when it projects enough votes to overtake the current execution candidate");
  assert.notEqual(proposal.nomineeId, currentOnBlock.id, "AI should not renominate the player already on the block");
  assert.equal(proposal.overtakePlan?.active, true);
  assert.equal(proposal.overtakePlan?.currentNomineeId, currentOnBlock.id);
  assert.equal(proposal.overtakePlan?.requiredYesVotes, 4);
  assert.equal(proposal.overtakePlan?.canOvertake, true);

  const result = resolveNominationAndVote(
    state,
    {
      nominatorId: proposal.nominatorId,
      nomineeId: proposal.nomineeId,
      humanVoteYes: true,
      decideAIVote: decideAIVoteWithRationale,
    },
    fixedRng(260607)
  );
  assert.equal(result.accepted, true, result.reason);
  assert.equal(result.passed, true, "AI overtake nomination should clear the vote threshold");
  assert.ok(result.yesVotes > 3, "AI overtake nomination should beat the existing on-block vote count");
  assert.equal(state.dayStageMeta.executionCandidate.nomineeId, proposal.nomineeId);
  assert.equal(result.replacedExecutionCandidate?.nomineeId, currentOnBlock.id);
}

function testAINominationDoesNotWasteNominationWhenItCannotOvertake() {
  const { state } = setupOnBlockOvertakeState({ currentYesVotes: 5 });

  const proposal = chooseAINomination(state);
  assert.equal(proposal, null, "AI should not spend a nomination that cannot beat the current on-block vote count");
}

function setupEvilOnBlockDeflectionState({ currentYesVotes = 3 } = {}) {
  const state = makeTBState();
  advanceDayStage(state, "public");
  markPublicDiscussionRound(state);
  advanceDayStage(state, "nomination");
  state.day = 4;

  const human = state.players.find((player) => player.isHuman);
  const demon = state.players.find((player) => !player.isHuman && player.category === "demon" && player.alive);
  const minion = state.players.find((player) => !player.isHuman && player.category === "minion" && player.alive);
  const deflectionTarget = state.players.find((player) => !player.isHuman && player.team === "good" && player.alive);
  const otherGood = state.players.find(
    (player) => !player.isHuman && player.team === "good" && player.alive && player.id !== deflectionTarget?.id
  );

  assert.ok(human, "expected human player");
  assert.ok(demon, "expected AI demon");
  assert.ok(minion, "expected AI minion");
  assert.ok(deflectionTarget, "expected good deflection target");
  assert.ok(otherGood, "expected additional good voter");
  assert.ok(
    getAIAgent(state, minion)?.knownAllyIds?.includes(demon.id),
    "minion should know the demon before planning a rescue"
  );

  const aliveIds = new Set([human.id, demon.id, minion.id, deflectionTarget.id, otherGood.id]);
  state.players.forEach((player) => {
    player.alive = aliveIds.has(player.id);
    player.nominatedToday = !player.isHuman && player.id !== minion.id;
    player.beenNominatedToday = false;
    if (aliveIds.has(player.id)) {
      aliveIds.forEach((targetId) => {
        player.suspicion[targetId] = targetId === player.id ? 0.01 : 0.18;
      });
      player.suspicion[deflectionTarget.id] = player.id === deflectionTarget.id ? 0.01 : 0.86;
    }
  });
  demon.beenNominatedToday = true;
  state.dayStageMeta.executionCandidate = {
    day: state.day,
    nomineeId: demon.id,
    yesVotes: currentYesVotes,
    threshold: Math.ceil(aliveIds.size / 2),
    nominatorId: human.id,
    voteIndex: 0,
  };

  state.players
    .filter((player) => !player.isHuman && aliveIds.has(player.id))
    .forEach((voter) => {
      addAgentObservation(state, voter.id, {
        kind: "public-speech",
        source: "public-chat",
        private: false,
        text: `${deflectionTarget.name} has enough public pressure to test instead of the current on-block player.`,
        payload: {
          speakerId: deflectionTarget.id,
          focusId: deflectionTarget.id,
          polarity: "accuse",
        },
      });
    });

  return { state, human, demon, minion, deflectionTarget };
}

function testEvilMinionDeflectsWhenDemonIsOnBlockAndVotesCanOvertake() {
  const { state, demon, minion } = setupEvilOnBlockDeflectionState({ currentYesVotes: 3 });

  const proposal = chooseAINomination(state);
  const nominee = state.players.find((player) => player.id === proposal?.nomineeId);
  assert.ok(proposal, "evil team should nominate when it can save an on-block demon by overtaking the vote");
  assert.equal(proposal.nominatorId, minion.id, "the available minion should make the rescue nomination");
  assert.ok(nominee, "rescue proposal should name a real nominee");
  assert.equal(nominee.team, "good", "evil rescue should move pressure to a non-ally target");
  assert.notEqual(proposal.nomineeId, demon.id, "evil rescue should not renominate the demon already on the block");
  assert.equal(proposal.evilDeflectionPlan?.active, true, "proposal should expose the internal evil deflection plan");
  assert.equal(proposal.evilDeflectionPlan?.protectedNomineeId, demon.id);
  assert.equal(proposal.evilDeflectionPlan?.reasonKey, "save-demon-on-block");
  assert.equal(proposal.overtakePlan?.canOvertake, true, "rescue nomination should only fire when projected votes can overtake");

  const result = resolveNominationAndVote(
    state,
    {
      nominatorId: proposal.nominatorId,
      nomineeId: proposal.nomineeId,
      humanVoteYes: true,
      decideAIVote: decideAIVoteWithRationale,
    },
    fixedRng(260608)
  );
  assert.equal(result.accepted, true, result.reason);
  assert.equal(result.passed, true, "deflection nomination should pass the vote threshold");
  assert.ok(result.yesVotes > 3, "deflection vote should beat the demon's current on-block vote count");
  assert.equal(state.dayStageMeta.executionCandidate.nomineeId, proposal.nomineeId);
  assert.equal(result.replacedExecutionCandidate?.nomineeId, demon.id);
}

function testEvilMinionDoesNotWasteRescueNominationWhenDemonCannotBeOvertaken() {
  const { state } = setupEvilOnBlockDeflectionState({ currentYesVotes: 5 });

  const proposal = chooseAINomination(state);
  assert.equal(proposal, null, "evil team should not spend its nomination when no target can overtake the demon's vote count");
}

function testPublicStatementMemoryCanDriveNominationProposal() {
  const state = makeTBState();
  advanceDayStage(state, "public");
  markPublicDiscussionRound(state);
  advanceDayStage(state, "nomination");

  const nominator = state.players.find((player) => !player.isHuman && player.team === "good" && player.alive);
  const nominee = state.players.find((player) => !player.isHuman && player.id !== nominator.id && player.alive);
  assert.ok(nominator, "expected AI nominator");
  assert.ok(nominee, "expected AI nominee");

  state.players
    .filter((player) => !player.isHuman)
    .forEach((player) => {
      player.suspicion = {};
      state.players.forEach((target) => {
        player.suspicion[target.id] = target.id === player.id ? 0.01 : 0.16;
      });
      player.reasonFlags = {};
    });
  nominator.suspicion[nominee.id] = 0.42;
  state.aiDialogue.statementMemory.publicBySpeakerId[nominator.id] = {
    day: state.day,
    speakerId: nominator.id,
    audience: "public",
    focusId: nominee.id,
    focusName: nominee.name,
    focusScore: 0.62,
    stance: "suspect",
    evidenceSummary: "public pressure line",
    voteStance: "",
  };

  const proposal = chooseAINomination(state);
  assert.ok(proposal, "expected statement-memory nomination proposal");
  assert.equal(proposal.nominatorId, nominator.id, "public statement memory should keep the speaker accountable");
  assert.equal(proposal.nomineeId, nominee.id, "public statement memory should drive the matching nominee");
  assert.equal(proposal.statementMemoryFocus, true, "proposal should mark statement memory as its source");
  assert.match(proposal.reason, /公开.*(身份|说法)|pressure line/, "nomination reason should reference public statement memory");
}

function testObservationWritesEvidenceBook() {
  const state = makeTBState();
  const observer = state.players.find((player) => !player.isHuman && player.team === "good");
  const target = state.players.find((player) => player.id !== observer.id);
  assert.ok(observer, "expected observer AI");
  assert.ok(target, "expected target");

  const before = getAgentEvidence(state, observer, { targetId: target.id }).length;
  addAgentObservation(state, observer.id, {
    kind: "public-speech",
    source: "public-chat",
    private: false,
    text: "我怀疑这个人。",
    payload: {
      speakerId: target.id,
      focusId: target.id,
    },
  });
  const after = getAgentEvidence(state, observer, { targetId: target.id });
  assert.equal(after.length, before + 1, "new observations should create normalized evidence entries");
  assert.equal(after.at(-1).evidenceType, "social", "public speech should be normalized as social evidence");
  assert.equal(after.at(-1).canBeFalse, true, "player speech evidence should be treated as fallible");
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
  const trail = getSuspicionTrailForTarget(state, observer, target.id);
  assert.ok(trail.length > 0, "belief refresh should explain suspicion changes with evidence trail");
  assert.equal(trail.at(-1).reasonKey, "humanAccuse", "trail should record the reason key");
  assert.equal(trail.at(-1).evidenceKind, "public-speech", "trail should link back to evidence kind");
  assert.ok(Number.isFinite(trail.at(-1).before), "trail should record previous suspicion");
  assert.ok(Number.isFinite(trail.at(-1).after), "trail should record next suspicion");
  assert.ok(Number.isFinite(trail.at(-1).appliedDelta), "trail should record applied delta");

  const firstTrailLength = trail.length;
  refreshAIBeliefs(state);
  assert.equal(
    getSuspicionTrailForTarget(state, observer, target.id).length,
    firstTrailLength,
    "belief trail should describe the current recomputation instead of duplicating every refresh"
  );

  const insight = getAIInsightRows(state).find((entry) => entry.id === observer.id);
  const targetInsight = insight?.targets?.find((entry) => entry.id === target.id);
  assert.ok(targetInsight, "AI insight rows should expose target-level recap data");
  assert.ok(targetInsight.trail.length > 0, "AI insight rows should expose trail data for recap UI");
}

function testPrivateReasonUsesVisibleDialogueEvidence() {
  const state = makeTBState();
  const human = state.players.find((player) => player.isHuman);
  const observer = state.players.find((player) => !player.isHuman && player.team === "good");
  const target = state.players.find((player) => !player.isHuman && player.id !== observer.id && player.alive);

  assert.ok(human, "expected human");
  assert.ok(observer, "expected observer AI");
  assert.ok(target, "expected target AI");

  addAgentObservation(state, observer.id, {
    kind: "public-speech",
    source: "public-chat",
    private: false,
    text: "I would execute this player.",
    payload: {
      speakerId: target.id,
      focusId: target.id,
    },
  });
  observer.suspicion[target.id] = 0.82;

  const summary = summarizeEvidenceForDialogue(state, observer, target.id, { limit: 1 })[0];
  assert.ok(summary, "expected a dialogue-safe evidence summary");

  const result = runPrivateWhisper(
    state,
    {
      targetId: observer.id,
      humanLine: `why do you suspect ${target.seatIndex + 1}?`,
      intentHint: "reason",
    },
    fixedRng(1212)
  );

  const normalizeSpeech = (text) =>
    `${text ?? ""}`
      .replace(/（先(?:再)?对一下）|（先复核）/g, "")
      .replace(/复核|再对一下|对一下/g, "对一下")
      .replace(/(\d+)\s+号/g, "$1号")
      .replace(/\s+/g, " ")
      .trim();
  const responseForEvidenceMatch = normalizeSpeech(result.response);
  const spokenSummary = result.evidenceContract?.spokenText || result.evidenceContract?.text || summary;
  assert.ok(
    responseForEvidenceMatch.includes(normalizeSpeech(spokenSummary)) ||
      (result.evidenceContract?.summaries ?? [summary]).some(
        (entry) => entry && responseForEvidenceMatch.includes(normalizeSpeech(entry))
      ),
    "private reason should cite dialogue-safe evidence from the unified evidence contract"
  );
  assert.match(
    result.response,
    /换个说法|说白了|先说清楚|换句话说|我先看|我先点|我先不把话说死|我暂时不换目标|先把排序说清|我先按主线排|先给你一个暂定排序|这条先当主线/,
    "private reason should include a human cadence bridge instead of reading like a flat report"
  );
}

function testPrivateResponseUsesUnifiedEvidenceContract() {
  const state = makeTBState();
  const human = state.players.find((player) => player.isHuman);
  const observer = state.players.find((player) => !player.isHuman && player.team === "good");
  const target = state.players.find((player) => !player.isHuman && player.id !== observer.id && player.alive);

  assert.ok(human, "expected human");
  assert.ok(observer, "expected observer AI");
  assert.ok(target, "expected target AI");

  addAgentObservation(state, observer.id, {
    kind: "public-speech",
    source: "public-chat",
    private: false,
    text: "Contract evidence: pushed a weak execution.",
    payload: {
      speakerId: target.id,
      focusId: target.id,
    },
  });
  observer.suspicion[target.id] = 0.86;

  const result = runPrivateWhisper(
    state,
    {
      targetId: observer.id,
      humanLine: `why do you suspect ${target.seatIndex + 1}?`,
      intentHint: "reason",
    },
    fixedRng(1717)
  );

  assert.ok(result.evidenceContract, "private response should return the unified evidence contract");
  assert.equal(result.evidenceContract.hasEvidence, true, "contract should mark evidence-backed private response");
  const normalizeEvidenceSpeech = (text) =>
    `${text ?? ""}`
      .replaceAll("…", "...")
      .replace(/（先(?:再)?对一下）|（先复核）/g, "")
      .replace(/复核|再对一下|对一下/g, "对一下")
      .replace(/(\d+)\s+号/g, "$1号")
      .replace(/\s+/g, " ")
      .trim();
  const normalizedResponse = normalizeEvidenceSpeech(result.response);
  assert.ok(
    normalizedResponse.includes(normalizeEvidenceSpeech(result.evidenceContract.spokenText || result.evidenceContract.text)) ||
      result.evidenceContract.summaries.some((summary) => normalizedResponse.includes(normalizeEvidenceSpeech(summary))),
    "private response should cite evidence from the unified evidence contract"
  );
}

function testPrivateReasonUsesQuestionAnswerShape() {
  const state = makeTBState();
  const observer = state.players.find((player) => !player.isHuman && player.team === "good");
  const target = state.players.find((player) => !player.isHuman && player.id !== observer.id && player.alive);

  assert.ok(observer, "expected observer AI");
  assert.ok(target, "expected target AI");

  observer.dialogueBias = observer.dialogueBias ?? {};
  observer.dialogueBias[target.id] = 0.78;
  addAgentObservation(state, observer.id, {
    kind: "public-speech",
    source: "public-chat",
    private: false,
    text: `${target.id} dodged a role question.`,
    payload: {
      speakerId: target.id,
      focusId: target.id,
      polarity: "accuse",
    },
  });

  const result = runPrivateWhisper(
    state,
    { targetId: observer.id, humanLine: `为什么你怀疑 ${target.seatIndex + 1}号？`, intentHint: "reason" },
    fixedRng(20260525)
  );

  assert.equal(result.ok, true, result.reason);
  assert.match(result.response, /先给结论：|我先看|我先点|我先不把话说死|我暂时不换目标|先把排序说清|我先按主线排|先给你一个暂定排序|这条先当主线/, "private reason should start with a direct conversational answer");
  assert.match(result.response, /主要|理由|对不上|站队|信息|提到/, "private reason should answer the asked why-question before expanding");
  assert.match(
    result.response,
    /大概身份|身份|昨晚信息|说清楚|反问一句|下一句我会这样追|逐条回应|支持者也要解释|可被推翻|听回应|复核/,
    "private reason should end with a follow-up question direction"
  );
}

function testPrivateReasonContrastsTopTwoTargets() {
  const state = makeTBState();
  const observer = state.players.find((player) => !player.isHuman && player.team === "good");
  const focus = state.players.find((player) => !player.isHuman && player.id !== observer.id && player.alive);
  const second = state.players.find(
    (player) => !player.isHuman && player.id !== observer.id && player.id !== focus.id && player.alive
  );

  assert.ok(observer, "expected observer AI");
  assert.ok(focus, "expected focus target");
  assert.ok(second, "expected second target");

  state.players.forEach((player) => {
    observer.suspicion[player.id] = 0.12;
  });
  observer.suspicion[focus.id] = 0.84;
  observer.suspicion[second.id] = 0.71;
  addAgentObservation(state, observer.id, {
    kind: "public-speech",
    source: "public-chat",
    private: false,
    text: `${focus.id} avoided the public claim check while ${second.id} is only a secondary concern.`,
    payload: {
      speakerId: focus.id,
      focusId: focus.id,
      polarity: "accuse",
    },
  });

  const result = runPrivateWhisper(
    state,
    { targetId: observer.id, humanLine: `为什么你优先怀疑 ${focus.seatIndex + 1}号？`, intentHint: "reason" },
    fixedRng(2026060101)
  );

  assert.equal(result.ok, true, result.reason);
  assert.match(
    result.reasoningContrastLine,
    new RegExp(`${focus.seatIndex + 1}号.*${second.seatIndex + 1}号|${second.seatIndex + 1}号.*${focus.seatIndex + 1}号`),
    "private reason should expose the top-vs-second comparison as structured metadata"
  );
  assert.equal(result.decisionRationale?.kind, "decision-rationale");
  assert.equal(result.decisionRationale?.audience, "private");
  assert.equal(result.decisionRationale?.focusId, focus.id);
  assert.equal(result.decisionRationale?.runnerUpId, second.id);
  assert.equal(result.decisionRationale?.reasonKey, "more-visible-evidence");
  assert.match(
    result.decisionRationale?.verificationLine ?? "",
    /验证点|先问|先让|补|对上|解释|票型|身份|可验|复核/,
    "decision rationale should explain the next verification plan for this target"
  );
  assert.ok(result.decisionRationale?.evidenceMode, "decision rationale should classify the evidence mode behind the read");
  assert.match(
    result.decisionRationale?.evidenceModeLine ?? "",
    /主依据|发言节奏|票型|提名|身份口径|夜里信息|私聊线索|混合线索|个人证据|硬信息/,
    "decision rationale should explain what kind of evidence is driving the read"
  );
  assert.match(
    result.decisionRationale?.verificationLine ?? "",
    /私聊线索|昨晚信息|死亡|保护链|投票|提名|票型|身份口径|角色说法|逐条回应|个人证据|污染|公开发言|发言节奏|站边|可复核身份|发言链/,
    "verification plan should ask about the same evidence family that drives the read"
  );
  assert.match(
    result.decisionRationale?.responsePlanLine ?? "",
    /如果|回应/,
    "decision rationale should frame the target response as a conditional plan"
  );
  assert.match(
    result.decisionRationale?.responsePlanLine ?? "",
    /降压|降级|回看|重排|提名|加压|继续压|主压力|复核|重算/,
    "decision rationale should explain how the AI will classify or act on the response"
  );
  assert.match(
    result.decisionRationale?.responseCriteriaLine ?? "",
    /判定标准/,
    "decision rationale should preserve a concrete response-evaluation criterion"
  );
  assert.match(
    result.decisionRationale?.responseCriteriaLine ?? "",
    /能|只|补出|对上|讲清|接上|拆开|逐条/,
    "response criterion should describe what counts as a sufficient or insufficient answer"
  );
  assert.match(
    result.decisionRationale?.responseCriteriaLine ?? "",
    /降压|加压|继续压|重算|换顺位|观察位|提名压力/,
    "response criterion should state how the AI updates pressure after the answer"
  );
  assert.match(
    result.decisionRationale?.evidenceInteractionLine ?? "",
    /证据联动|互相|同向|接上|并入|托住|去重|降权|合并/,
    "decision rationale should explain how evidence families interact"
  );
  assert.match(
    result.decisionRationale?.evidenceInteractionLine ?? "",
    /身份|票型|发言|夜里|私聊|时间线|线索/,
    "evidence interaction should name the relevant evidence families"
  );
  assert.match(
    result.decisionRationale?.evidenceInteractionLine ?? "",
    /升级|降压|加压|继续压|上压|重排|弱压|观察位/,
    "evidence interaction should explain how combined evidence changes pressure"
  );
  assert.match(
    result.decisionRationale?.pressureStageLine ?? "",
    /压力档位|观察位|验证入口|对比档|提名前复核档|主压力位|验证压|分数前排位/,
    "decision rationale should classify the current pressure stage"
  );
  assert.match(
    result.decisionRationale?.pressureStageLine ?? "",
    /观察|追问|复核|提名|提名池|提名压力|不直接提名|升级/,
    "pressure stage should explain the next escalation boundary"
  );
  assert.match(
    result.decisionRationale?.counterEvidenceLine ?? "",
    /反证|也可能|不等于|不代表|不能锁死|不能只按|不是|误伤|重算/,
    "decision rationale should preserve a counter-evidence or alternative-explanation line"
  );
  assert.match(
    result.decisionRationale?.counterEvidenceLine ?? "",
    /降压|降级|观察|解释|对上|重算|复核|先核|先听|不能只按|不直接拍死|换顺位|自保|跟票|公开可核|定性|狼线/,
    "counter-evidence line should explain how the AI would avoid overcommitting"
  );
  assert.match(
    result.decisionRationale?.tableRiskLine ?? "",
    /桌面风险|风险|代价|浪费|带偏|隧道|分散|闭眼|跟票|带票|处决压力/,
    "decision rationale should preserve the table-level risk or cost of pressuring this target"
  );
  assert.match(
    result.decisionRationale?.tableRiskLine ?? "",
    /提名|票型|公开|私下|回应|追问|复核|第二压力位|可见口径|身份|时间线|带票/,
    "table risk line should connect the risk to a concrete next table action"
  );
  assert.match(
    result.decisionRationale?.informationGainLine ?? "",
    /信息收益|分清|判断|区分|可复核|独立证据/,
    "decision rationale should explain the information gain of asking this target"
  );
  assert.match(
    result.decisionRationale?.informationGainLine ?? "",
    /身份|票型|发言链|时间线|上票|跟票|解释|回应|公开|提名池|压力|线索/,
    "information gain line should name what signal the next question is trying to separate"
  );
  assert.match(
    result.decisionRationale?.tableReactionLine ?? "",
    /桌面反应|反应观察|看谁|跟压|护人|转移|站边|带票|跟票|洗白|补证/,
    "decision rationale should preserve which table reactions the AI will watch after pressuring the target"
  );
  assert.match(
    result.decisionRationale?.tableReactionLine ?? "",
    /跟压|护人|转移|站边|解释|发言|票型|提名|压力|第二压力位|回应|公开|理由/,
    "table reaction line should connect reactions to public pressure, vote shape, or follow-up reasons"
  );
  assert.match(
    result.decisionRationale?.timingWindowLine ?? "",
    /时机窗口|提名|投票|票前|公聊|私聊|回应窗口|提名前复核|低证据入口/,
    "decision rationale should preserve the timing window for this pressure"
  );
  assert.match(
    result.decisionRationale?.timingWindowLine ?? "",
    /轻压|追问|复核|回应|提名池|票型|发言|身份|升级|锁票|票意/,
    "timing window should explain whether this is a probe, review, or nomination/vote step"
  );
  assert.match(
    result.decisionRationale?.worldBranchLine ?? "",
    /世界分支|如果|成立|断开|好身份|坏身份|重排|主线|分支/,
    "decision rationale should preserve alternate world branches for this target"
  );
  assert.match(
    result.decisionRationale?.worldBranchLine ?? "",
    /身份|票型|发言|解释|公开|提名池|压力|降压|坏身份线|好身份分支|公开线/,
    "world branch line should explain what changes if the target explanation holds or breaks"
  );
  assert.match(
    result.decisionRationale?.voteCoalitionLine ?? "",
    /票面联盟|票面|跟票|上票|处决票|主票线|共识|分票|票数/,
    "decision rationale should preserve vote-coalition reasoning for the current pressure"
  );
  assert.match(
    result.decisionRationale?.voteCoalitionLine ?? "",
    /理由|公开|提名|压力|第二票面|第二压力位|回应|解释|支持者|共识/,
    "vote-coalition line should explain whether pressure can become a reasoned vote coalition"
  );
  assert.match(
    result.decisionRationale?.sourceReliabilityLine ?? "",
    /来源可靠度|来源|独立来源|同源|回声|可复核|可信度|污染|降权/,
    "decision rationale should preserve source-reliability reasoning for the current read"
  );
  assert.match(
    result.decisionRationale?.sourceReliabilityLine ?? "",
    /公开|身份|票型|发言|夜里|私下|第二来源|证据|回应|解释|复核|重排|时间线/,
    "source-reliability line should explain how evidence sources should be verified or downweighted"
  );
  assert.match(
    result.decisionRationale?.timelineConsistencyLine ?? "",
    /时间线一致性|时间线|先后|顺序|先报|改口|事后|前后|节点|本轮|跨日/,
    "decision rationale should preserve timeline-consistency reasoning for the current read"
  );
  assert.match(
    result.decisionRationale?.timelineConsistencyLine ?? "",
    /身份|票型|发言|夜里|死亡|保护|回应|公开|提名|投票|证据|复核|升级|降权/,
    "timeline-consistency line should explain how event order affects pressure"
  );
  assert.match(
    result.decisionRationale?.incentiveAlignmentLine ?? "",
    /动机归因|动机|收益|解桌|保自己|自保|护人|转移压力|获利|带偏|跟风/,
    "decision rationale should preserve incentive-alignment reasoning for the current read"
  );
  assert.match(
    result.decisionRationale?.incentiveAlignmentLine ?? "",
    /公开|行为|身份|票型|发言|回应|信息|压力|理由|复核|加压|降权|主压/,
    "incentive-alignment line should explain whose behavior benefits from the current pressure"
  );
  assert.match(
    result.decisionRationale?.burdenOfProofLine ?? "",
    /举证责任|责任|谁该|本人|支持者|跟票者|护航|回答|解释|给理由|公开理由/,
    "decision rationale should preserve burden-of-proof reasoning for the current read"
  );
  assert.match(
    result.decisionRationale?.burdenOfProofLine ?? "",
    /公开|身份|票型|发言|回应|理由|复核|证据|提名|上票|处决|压力|第二压力位|目标/,
    "burden-of-proof line should assign who needs to explain the current pressure"
  );
  assert.match(
    result.decisionRationale?.questionPriorityLine ?? "",
    /追问顺序|顺序|先问|先核|先让|再问|再看|回看|最后|下一步/,
    "decision rationale should preserve the follow-up question priority for the current read"
  );
  assert.match(
    result.decisionRationale?.questionPriorityLine ?? "",
    /公开|身份|票型|发言|回应|理由|复核|证据|时间线|跟票|支持者|提名|处决票|主疑点|第二压力位/,
    "question-priority line should name the concrete evidence or table lane to ask first"
  );
  assert.match(
    result.decisionRationale?.actionThresholdLine ?? "",
    /行动门槛|门槛|观察追问|观察位|压力台|主压力位|提名|提名池|处决票|锁票|上票|升级|降压|回切/,
    "decision rationale should preserve the action threshold for the current read"
  );
  assert.match(
    result.decisionRationale?.actionThresholdLine ?? "",
    /公开|回应|身份|票型|发言|证据|可复核|时间线|跟票|理由|断开|接上|第二压力位/,
    "action-threshold line should state what must happen before escalating or downgrading pressure"
  );
  assert.match(
    result.decisionRationale?.memoryContinuityLine ?? "",
    /记忆连续性|不是新起线|本日|建档|延续|转成|改看法|重置读法|对照|观察档/,
    "decision rationale should preserve memory-continuity reasoning for the current read"
  );
  assert.match(
    result.decisionRationale?.memoryContinuityLine ?? "",
    /证据|发言|身份|票型|公开|本轮|昨天|天前|回应|主线|读法|可见/,
    "memory-continuity line should connect the current read to evidence, stance, or future comparison"
  );
  assert.match(
    result.decisionRationale?.expressionDisciplineLine ?? "",
    /表达纪律|表达|公开说法|追问口吻|条件句|不说|不把|不锁死|不定性|回应质量|结论/,
    "decision rationale should preserve expression-discipline reasoning for the current read"
  );
  assert.match(
    result.decisionRationale?.expressionDisciplineLine ?? "",
    /公开|身份|票型|发言|回应|理由|复核|结论|处决|压力|跟票|时间线|夜里|可复核/,
    "expression-discipline line should state how to phrase the read without overclaiming"
  );
  assert.match(
    result.decisionRationale?.uncertaintyResolutionLine ?? "",
    /不确定性|不确定|还缺|缺口|消解|差异|拉开|待验证|回应质量|证据不弱/,
    "decision rationale should preserve the remaining uncertainty for the current read"
  );
  assert.match(
    result.decisionRationale?.uncertaintyResolutionLine ?? "",
    /公开|身份|票型|发言|回应|证据|复核|时间线|跟票|理由|夜里|提名|压力|处决/,
    "uncertainty-resolution line should state what public response or evidence can resolve the uncertainty"
  );
  assert.match(
    result.decisionRationale?.evidenceFreshnessLine ?? "",
    /证据新鲜度|新鲜|新证据|旧线索|旧理由|旧印象|本轮|本日|今天|当前回应|刷新|过夜|重新校验|新旧|同源/,
    "decision rationale should preserve evidence freshness reasoning for the current read"
  );
  assert.match(
    result.decisionRationale?.evidenceFreshnessLine ?? "",
    /公开|身份|票型|发言|回应|证据|理由|压力|时间线|死亡|保护|校验|建档|结论/,
    "evidence-freshness line should state whether current or stale evidence should drive pressure"
  );
  assert.match(
    result.decisionRationale?.falsificationCheckLine ?? "",
    /证伪检查|证伪|如果|能补|接上|自洽|降级|回切|不能继续|主压|强压|复核线/,
    "decision rationale should preserve the falsification condition for the current read"
  );
  assert.match(
    result.decisionRationale?.falsificationCheckLine ?? "",
    /公开|身份|票型|发言|回应|证据|理由|时间线|死亡|保护|背书|同源|处决|压力/,
    "falsification-check line should state what public evidence or response would force a downgrade"
  );
  assert.match(
    result.decisionRationale?.causalChainLine ?? "",
    /因果链|先.*再|导致|影响|推动|形成|变成|来自|才会|所以|解释空间|压力/,
    "decision rationale should preserve causal-chain reasoning for the current read"
  );
  assert.match(
    result.decisionRationale?.causalChainLine ?? "",
    /公开|身份|票型|发言|回应|证据|理由|时间线|死亡|保护|背书|同源|处决|桌面|台面|压力/,
    "causal-chain line should connect evidence behavior to table pressure or explanation space"
  );
  assert.match(
    result.decisionRationale?.assumptionAuditLine ?? "",
    /前提审计|前提|假设|依赖|不能假设|只假设|如果|否则|不成立/,
    "decision rationale should preserve the assumptions behind the current read"
  );
  assert.match(
    result.decisionRationale?.assumptionAuditLine ?? "",
    /公开|身份|票型|发言|回应|证据|理由|时间线|死亡|保护|背书|同源|处决|压力|自洽|自保|跟票|醉毒|污染/,
    "assumption-audit line should state which public evidence premise the read depends on"
  );
  assert.match(
    result.decisionRationale?.mechanicSensitivityLine ?? "",
    /机制敏感性|机制|规则|登记|醉毒|中毒|醉酒|死亡|保护|身份口径|票型|提名|处决|能力信息|私下视角|隐藏信息/,
    "decision rationale should preserve BOTC mechanic sensitivity for the current read"
  );
  assert.match(
    result.decisionRationale?.mechanicSensitivityLine ?? "",
    /公开|身份|票型|发言|回应|证据|理由|时间线|死亡|保护|背书|同源|处决|压力|能力|信息|复核|降权/,
    "mechanic-sensitivity line should connect the read to concrete BOTC mechanics"
  );
  assert.match(
    result.decisionRationale?.roleHypothesisLine ?? "",
    /角色假说|好身份|坏身份|伪装|身份线|自洽|分支|能力|口径|票型/,
    "decision rationale should preserve role-hypothesis reasoning for the current read"
  );
  assert.match(
    result.decisionRationale?.roleHypothesisLine ?? "",
    /公开|身份|票型|发言|回应|信息|能力|解释|断点|压力|复核|主线|好人世界|坏人世界/,
    "role-hypothesis line should split the read into public-safe good-role and bad-role worlds"
  );
  assert.match(
    result.decisionRationale?.evidenceBoundaryLine ?? "",
    /边界|证据薄|分差贴线|公开信息|第二候选|线索并不弱|继续复核|单点结论|台面/,
    "decision rationale should explain the evidence boundary for the current read"
  );
  assert.match(
    result.decisionRationale?.runnerUpWatchLine ?? "",
    /第二压力位|先排第二|回看|重排|不.*放过|线索先不丢/,
    "decision rationale should explain how the runner-up target remains under watch"
  );
  assert.ok(result.decisionRationale?.confidenceBand, "private decision rationale should classify confidence");
  assert.match(
    result.decisionRationale?.confidenceLine ?? "",
    /强压|偏前|贴线|接近|验证|不是铁证|不锁死/,
    "decision rationale should explain how confident the AI is in the current read"
  );
  assert.ok(
    result.decisionRationale.focusEvidenceCount > result.decisionRationale.runnerUpEvidenceCount,
    "private decision rationale should preserve evidence-count comparison"
  );
  assert.equal(
    result.decisionRationale?.line,
    result.reasoningContrastLine,
    "legacy reasoning line should stay in sync with structured rationale"
  );
  assert.equal(result.decisionRationale?.reconsiderationKey, "more-visible-evidence");
  assert.match(
    result.decisionRationale?.reconsiderationLine ?? "",
    /降级|重排|降压|不锁死/,
    "decision rationale should explain what would make the AI revise or soften this target"
  );
  const comparisonTrace = result.decisionRationale?.comparisonTrace;
  assert.equal(comparisonTrace?.kind, "target-comparison-trace");
  assert.equal(comparisonTrace?.focusId, focus.id);
  assert.equal(comparisonTrace?.runnerUpId, second.id);
  assert.equal(comparisonTrace?.focusEvidenceCount, result.decisionRationale.focusEvidenceCount);
  assert.equal(comparisonTrace?.runnerUpEvidenceCount, result.decisionRationale.runnerUpEvidenceCount);
  assert.ok(comparisonTrace?.focusReason, "comparison trace should explain the focus side");
  assert.ok(comparisonTrace?.runnerUpReason, "comparison trace should explain the runner-up side");
  assert.ok(
    comparisonTrace.summary.includes(comparisonTrace.focusName) &&
      comparisonTrace.summary.includes(comparisonTrace.runnerUpName),
    "comparison trace should include a readable target-vs-runner-up summary"
  );
  assert.ok(result.decisionRationale?.spokenLine, "private decision rationale should capture the final spoken sentence");
  assert.ok(
    result.response.includes(result.decisionRationale.spokenLine),
    "private decision rationale spokenLine should be copied from the final response"
  );
  assert.doesNotMatch(
    result.response,
    /(验证点|判定标准|证据联动|追问顺序|行动门槛|证伪检查|因果链|前提审计|机制敏感性|角色假说)\s*[：:]/,
    "private spoken reply should not expose internal rationale labels as report headings"
  );
  const privateTimeline = state.aiDialogue.timeline.find(
    (entry) => entry.mode === "whisper-in" && entry.speakerId === observer.id && entry.text === result.response
  );
  assert.equal(
    privateTimeline?.decisionRationale?.spokenLine,
    result.decisionRationale.spokenLine,
    "private timeline should keep the same decision rationale spokenLine"
  );
  assert.match(
    result.response,
    /不是放过|不是放掉|不是清掉|排第二|压力更集中|差距不大|放前面|先放主线|先验|后手位|更成组|更集中|重排/,
    "private reason should explain why the focus target outranks the secondary target"
  );
}

function testPrivateReasonDoesNotDirectAddressThirdPartyFocus() {
  const state = makeTBState();
  const observer = state.players.find((player) => !player.isHuman && player.team === "good");
  const target = state.players.find((player) => !player.isHuman && player.id !== observer.id && player.alive);

  assert.ok(observer, "expected observer AI");
  assert.ok(target, "expected target AI");

  observer.dialogueBias = observer.dialogueBias ?? {};
  observer.dialogueBias[target.id] = 0.78;
  addAgentObservation(state, observer.id, {
    kind: "public-speech",
    source: "public-chat",
    private: false,
    text: `${target.id} dodged a role question.`,
    payload: {
      speakerId: target.id,
      focusId: target.id,
      polarity: "accuse",
    },
  });

  const result = runPrivateWhisper(
    state,
    { targetId: observer.id, humanLine: `为什么你怀疑 ${target.seatIndex + 1}号？`, intentHint: "reason" },
    fixedRng(202605251)
  );

  assert.equal(result.ok, true, result.reason);
  assert.doesNotMatch(
    result.response,
    new RegExp(`${target.seatIndex + 1}号，(你|妳)`),
    "private reply should not address a third-party focus as if they were in the whisper"
  );
  assert.match(
    result.response,
    new RegExp(`(让|问|追|处理|复核).*${target.seatIndex + 1}号|${target.seatIndex + 1}号.*(回应|复核)`),
    "private reply should frame third-party pressure as an indirect action"
  );
}

function testPrivateVoteUsesQuestionAnswerShape() {
  const state = makeTBState();
  const observer = state.players.find((player) => !player.isHuman && player.team === "good");
  const target = state.players.find((player) => !player.isHuman && player.id !== observer.id && player.alive);

  assert.ok(observer, "expected observer AI");
  assert.ok(target, "expected target AI");

  observer.dialogueBias = observer.dialogueBias ?? {};
  observer.dialogueBias[target.id] = 0.72;

  const result = runPrivateWhisper(
    state,
    { targetId: observer.id, humanLine: `如果今天提 ${target.seatIndex + 1}号你会投吗？`, intentHint: "vote" },
    fixedRng(20260526)
  );

  assert.equal(result.ok, true, result.reason);
  assert.match(result.response, /如果提|跟票|回应补不上/, "private vote answer should answer the vote question directly");
  assert.match(result.response, /票前我会问|回应|跟票|投票/, "private vote answer should include the vote condition or follow-up");
}

function testPrivateClaimQuestionAnswersClaimDirectly() {
  const state = makeTBState();
  const observer = state.players.find((player) => !player.isHuman && player.team === "good");

  assert.ok(observer, "expected observer AI");

  const result = runPrivateWhisper(
    state,
    { targetId: observer.id, humanLine: "你是什么身份？", intentHint: "claim" },
    fixedRng(20260601)
  );

  assert.equal(result.ok, true, result.reason);
  assert.match(result.response, /身份|我是|说自己|大概方向|私下跟你说/, "claim question should answer the role/claim lane directly");
  assert.doesNotMatch(
    result.response,
    /身份我会回应，但先给你能落地的说法|眼下我更想听|我会先盯/,
    "claim answer should not drift into generic suspicion/focus talk"
  );
}

function testPrivateNightQuestionAnswersNightInfoDirectly() {
  const state = makeTBState();
  const observer = state.players.find((player) => !player.isHuman && player.team === "good");

  assert.ok(observer, "expected observer AI");
  observer.privateNotes = observer.privateNotes ?? [];
  observer.privateNotes.push("[第1夜] 你得知：测试夜间信息指向 7号。");

  const result = runPrivateWhisper(
    state,
    { targetId: observer.id, humanLine: "你昨晚得到了什么信息？", intentHint: "night" },
    fixedRng(20260602)
  );

  assert.equal(result.ok, true, result.reason);
  assert.match(result.response, /昨晚|夜里|夜间|信息|线索/, "night question should answer the night-info lane directly");
  assert.match(result.response, /测试夜间信息|能安全说|没有能/, "night answer should expose shareable personal night info or a clear no-info answer");
  assert.doesNotMatch(
    result.response,
    /最想追|第一关注|反问一句|夜里信息不能单独盘，我会和白天/,
    "night answer should not become a generic suspicion response"
  );
}

function testShareableNightInfoUsesSpeakerPerspective() {
  const state = makeTBState();
  const observer = state.players.find((player) => !player.isHuman && player.team === "good");
  assert.ok(observer, "expected observer AI");

  observer.privateNotes = ["[第1夜] 你查验 4号 与 6号，结果：否。"];
  const result = runPrivateWhisper(
    state,
    { targetId: observer.id, humanLine: "你昨晚得到了什么信息？", intentHint: "night" },
    fixedRng(202606021)
  );
  assert.equal(result.ok, true, result.reason);
  assert.match(result.response, /我查验 4号\s*与\s*6号，结果：否/, "shared night info should be rewritten into speaker perspective");
  assert.doesNotMatch(result.response, /你查验 4号\s*与\s*6号/, "AI should not quote self-private notes as if the listener performed the action");

  const proactive = runAIProactiveWhispers(state, fixedRng(202606022));
  const text = proactive.map((entry) => entry.response).join("\n");
  assert.doesNotMatch(text, /你查验 4号 与 6号/, "proactive private whisper should also avoid listener-perspective night notes");
}

function prepareFortuneTellerInfoFixture() {
  const state = makeTBState();
  const teller = state.players.find((player) => !player.isHuman && player.team === "good");
  const role = getRoleById(state.scriptId, "fortune-teller");
  assert.ok(teller && role, "expected good AI and Fortune Teller role");

  Object.assign(teller, {
    roleId: role.id,
    roleName: role.name,
    apparentRoleId: role.id,
    apparentRoleName: role.name,
    category: role.category,
    team: role.team,
    publicClaimRoleId: "",
    privateNotes: ["[第1夜] 你查验 4号 与 6号，结果：否。"],
  });
  state.events.infoPings = (state.events.infoPings ?? []).filter((entry) => entry.actorId !== teller.id);
  state.events.infoPings.push({
    night: 1,
    actorId: teller.id,
    type: "fortune-teller",
    targetIds: [],
    truth: false,
    shown: false,
    polluted: false,
    text: teller.privateNotes[0],
  });
  return { state, teller };
}

function testVerifiableInfoQuestionRoutesToRoleFormat() {
  const { state, teller } = prepareFortuneTellerInfoFixture();

  const result = runPrivateWhisper(
    state,
    { targetId: teller.id, humanLine: "你有什么别人能对得上的信息吗？", intentHint: "generic" },
    fixedRng(202606023)
  );

  assert.equal(result.ok, true, result.reason);
  assert.match(
    result.response,
    /每晚看两个人|是\/否|查验类信息位|对得上|可复核/,
    "verifiable-info questions should be answered as a night-info format question"
  );
  assert.doesNotMatch(
    result.response,
    /我先看\s*\d+号|接下来先问|身份和昨晚信息/,
    "verifiable-info answers should not drift into generic target-chasing"
  );
}

function testRepeatedNightQuestionGivesFortuneTellerFormatResult() {
  const { state, teller } = prepareFortuneTellerInfoFixture();

  const first = runPrivateWhisper(
    state,
    { targetId: teller.id, humanLine: "你有什么别人能对得上的信息吗？", intentHint: "generic" },
    fixedRng(202606024)
  );
  const second = runPrivateWhisper(
    state,
    { targetId: teller.id, humanLine: "你昨晚得到了什么信息？", intentHint: "night" },
    fixedRng(202606025)
  );

  assert.equal(first.ok, true, first.reason);
  assert.equal(second.ok, true, second.reason);
  assert.match(
    second.response,
    /我查验 4号\s*与\s*6号，结果：否|查验 4号\s*与\s*6号，结果：否/,
    "repeated direct night-info questions should give the BOTC-style role result"
  );
  assert.doesNotMatch(
    second.response,
    /结果先别急着公开摊完|目标和结果全报/,
    "repeated night-info answer should not repeat the vague range line"
  );
}

function testPrivateAnswerAlignmentContractCoversQuestionTypes() {
  const cases = [
    {
      intentHint: "reason",
      line: (target) => `为什么你怀疑 ${target.seatIndex + 1}号？`,
      pattern: /因为|理由|主要|证据|对不上|提到|卡点|这条|站队|信息|公开/,
    },
    {
      intentHint: "trust",
      line: () => "你信任我吗？",
      pattern: /你在我这里|信任|相信|放下|风险|偏好|中间位|不信/,
    },
    {
      intentHint: "claim",
      line: () => "你是什么身份？",
      pattern: /身份|我是|说自己|大概方向|私下跟你说|真实身份|台面上|不把身份/,
    },
    {
      intentHint: "vote",
      line: (target) => `如果今天提 ${target.seatIndex + 1}号，你会投吗？`,
      pattern: /投|票|提名|跟票|赞成|反对|回应补不上/,
    },
    {
      intentHint: "night",
      line: () => "你昨晚得到了什么信息？",
      pattern: /昨晚|昨夜|夜里|夜间|夜晚|信息|没有能.*信息|能安全说/,
    },
    {
      intentHint: "compare",
      line: (target, other) => `${target.seatIndex + 1}号和${other.seatIndex + 1}号谁更可疑？`,
      pattern: /更|比|先追|放第二|两者里|相比/,
    },
    {
      intentHint: "plan",
      line: (target) => `下一步怎么打？要不要先问 ${target.seatIndex + 1}号？`,
      pattern: /下一步|建议|计划|先问|先把|今天|公聊|提名/,
    },
    {
      intentHint: "suspect",
      line: () => "你现在最怀疑谁？",
      pattern: /怀疑|可疑|最想追|第一关注|先看|先盯|盯/,
    },
  ];

  cases.forEach((entry, index) => {
    const state = makeTBState();
    const observer = state.players.find((player) => !player.isHuman && player.team === "good");
    const targets = state.players.filter((player) => !player.isHuman && player.id !== observer.id && player.alive);
    const target = targets[0];
    const other = targets[1] ?? targets[0];

    assert.ok(observer, `expected observer AI for ${entry.intentHint}`);
    assert.ok(target, `expected target AI for ${entry.intentHint}`);

    observer.dialogueBias = observer.dialogueBias ?? {};
    observer.dialogueBias[target.id] = 0.78;
    addAgentObservation(state, observer.id, {
      kind: "public-speech",
      source: "public-chat",
      private: false,
      text: `${target.id} answer-alignment seeded evidence ${index}.`,
      payload: {
        speakerId: target.id,
        focusId: target.id,
        polarity: "accuse",
      },
    });

    const result = runPrivateWhisper(
      state,
      {
        targetId: observer.id,
        humanLine: entry.line(target, other),
        intentHint: entry.intentHint,
      },
      fixedRng(20260610 + index)
    );

    assert.equal(result.ok, true, result.reason);
    assert.match(result.response, entry.pattern, `${entry.intentHint} response should satisfy the unified answer-alignment contract`);
  });
}

function testPrivatePragmaticsEscalatesHighPressureTarget() {
  const state = makeTBState();
  const observer = state.players.find((player) => !player.isHuman && player.team === "good");
  const target = state.players.find((player) => !player.isHuman && player.id !== observer.id && player.alive);

  assert.ok(observer, "expected observer AI");
  assert.ok(target, "expected target AI");

  observer.dialogueBias = observer.dialogueBias ?? {};
  observer.dialogueBias[target.id] = 0.86;
  addAgentObservation(state, observer.id, {
    kind: "public-speech",
    source: "public-chat",
    private: false,
    text: `${target.id} refused to answer a claim conflict.`,
    payload: {
      speakerId: target.id,
      focusId: target.id,
      polarity: "accuse",
    },
  });

  const result = runPrivateWhisper(
    state,
    { targetId: observer.id, humanLine: `为什么先压 ${target.seatIndex + 1}号？`, intentHint: "reason" },
    fixedRng(20260527)
  );

  assert.equal(result.ok, true, result.reason);
  assert.match(result.response, /马上听回应|需要马上听回应/, "high-pressure private answer should use urgent in-game pragmatics");
  assert.match(result.response, /马上听回应|先给结论：|反问一句/, "pragmatic layer should preserve Q&A shape");
}

function testPublicPragmaticsHandlesOnBlockSpeaker() {
  const state = makeTBState();
  advanceDayStage(state, "public");

  const speaker = state.players.find((player) => !player.isHuman && player.team === "good" && player.alive);
  const target = state.players.find((player) => !player.isHuman && player.id !== speaker.id && player.alive);

  assert.ok(speaker, "expected public speaker");
  assert.ok(target, "expected public target");

  speaker.beenNominatedToday = true;
  speaker.dialogueBias = speaker.dialogueBias ?? {};
  speaker.dialogueBias[target.id] = 0.76;

  runAIDiscussion(state, fixedRng(20260528));
  const line = state.events.speeches.find((entry) => !entry.private && entry.playerId === speaker.id)?.line ?? "";

  assert.ok(line, "expected public line from nominated speaker");
  assert.match(line, /在台上|票型你们自己看|能验证的部分/, "on-block public speaker should use defensive pragmatic framing");
}

function testPersonaDialogueActsRenderDistinctPrivateSpeech() {
  const state = makeTBState();
  const human = state.players.find((player) => player.isHuman);
  const steady = state.players.find((player) => !player.isHuman && player.team === "good");
  const pressure = state.players.find((player) => !player.isHuman && player.team === "good" && player.id !== steady.id);
  const target = state.players.find(
    (player) => !player.isHuman && player.id !== steady.id && player.id !== pressure.id && player.alive
  );

  assert.ok(human, "expected human");
  assert.ok(steady, "expected steady AI");
  assert.ok(pressure, "expected pressure AI");
  assert.ok(target, "expected target AI");

  steady.aiPersona = "steady";
  pressure.aiPersona = "pressure";
  [steady, pressure].forEach((observer) => {
    observer.dialogueBias = observer.dialogueBias ?? {};
    observer.dialogueBias[target.id] = 0.7;
    addAgentObservation(state, observer.id, {
      kind: "public-speech",
      source: "public-chat",
      private: false,
      text: `${target.id} dodged the role timeline.`,
      payload: {
        speakerId: target.id,
        focusId: target.id,
        polarity: "accuse",
      },
    });
  });

  const steadyResult = runPrivateWhisper(
    state,
    {
      targetId: steady.id,
      humanLine: `why do you suspect ${target.seatIndex + 1}?`,
      intentHint: "reason",
    },
    fixedRng(20260515)
  );
  const pressureResult = runPrivateWhisper(
    state,
    {
      targetId: pressure.id,
      humanLine: `why do you suspect ${target.seatIndex + 1}?`,
      intentHint: "reason",
    },
    fixedRng(20260515)
  );

  assert.ok(steadyResult.ok, "steady private response should succeed");
  assert.ok(pressureResult.ok, "pressure private response should succeed");
  assert.notEqual(steadyResult.response, pressureResult.response, "persona dialogue acts should render distinct speech");
  assert.match(
    steadyResult.response,
    /不把话说死|从我这边看|先放主线|我按|我先看|我先点这条|先把排序说清|暂定排序|不急着拍死/,
    "steady speech should sound cautious"
  );
  assert.match(pressureResult.response, /直接压|先给结论|不想再绕|落锤/, "pressure speech should sound more forceful");
}

function testPhraseCooldownReducesRepeatedStockTerms() {
  const state = makeTBState();
  const aiPlayer = state.players.find((player) => !player.isHuman);
  assert.ok(aiPlayer, "expected AI player");

  aiPlayer.speechStyleMemory = {
    recentLines: ["这条证据线需要复核。", "这个口径也要复核。"],
    recentPhrases: ["证据线", "口径", "复核", "证据线", "口径", "复核"],
  };
  const rendered = applyHumanSpeechCadence(
    state,
    aiPlayer,
    "证据线和口径都需要复核。",
    fixedRng(20260516),
    { audience: "private", intent: "reason", force: true }
  );

  assert.doesNotMatch(rendered, /证据线/, "overused stock phrase should be cooled down");
  assert.doesNotMatch(rendered, /口径都需要复核/, "clustered repeated terms should be softened");
}

function testConversationalPolishRemovesDebugLikePhrases() {
  const state = makeTBState();
  const aiPlayer = state.players.find((player) => !player.isHuman);
  assert.ok(aiPlayer, "expected AI player");

  const rendered = applyHumanSpeechCadence(
    state,
    aiPlayer,
    "这题我分两层看。刚才那条线我还没改，还是围绕 5号（暂时偏清白） 看；核心还是 我私下听到的口径把焦点指向 5 号。这局先别急着拍死，问出反应比一句结论更值钱。",
    fixedRng(20260529),
    { audience: "private", intent: "reason", force: false, maxChars: 240 }
  );

  assert.doesNotMatch(rendered, /分两层看|核心还是|暂时偏清白|我私下听到的口径把焦点指向|一句结论更值钱/);
  assert.match(rendered, /我直说吧|主要还是|有人私下提到 5 号|问一句看反应更有用/);

  const lessStacked = applyHumanSpeechCadence(
    state,
    aiPlayer,
    "如果你要记，先记我偏 洗衣妇 口径，但先别替我公开。这局我目前的身份说法先按 洗衣妇 记，不会无理由改口。",
    fixedRng(20260530),
    { audience: "private", intent: "claim", force: false, maxChars: 220 }
  );
  assert.doesNotMatch(lessStacked, /口径|无理由改口/, "polish should remove debug-like claim jargon");
  assert.match(lessStacked, /别替我公开|没有新情况我不会换/, "claim text should read as short human sentences");

  const publicLeadIn = applyHumanSpeechCadence(
    state,
    aiPlayer,
    "我接一下前面的发言：如果今天提 7号，我会看他的防守有没有东西，不是闭眼跟。",
    fixedRng(20260531),
    { audience: "public", intent: "suspect", force: false, maxChars: 220 }
  );
  assert.doesNotMatch(publicLeadIn, /接前面一句|我接一下前面的发言/, "public polish should not invent a prior-speaker lead-in");
  assert.match(publicLeadIn, /如果今天提\s*7号/, "public polish should keep the actual vote condition");

  const disclosureStack = applyHumanSpeechCadence(
    state,
    aiPlayer,
    "我手里有一条信息，先私下给你听。手上大家能验证的部分是：身份直接摊：厨师。昨晚信息：夜里拿到的相邻邪恶数是 0。",
    fixedRng(20260610),
    { audience: "private", intent: "night", force: true, maxChars: 240 }
  );
  assert.doesNotMatch(disclosureStack, /：[^。！？；]*：/, "polish should collapse nested label colons");
  assert.doesNotMatch(disclosureStack, /身份直接摊|手上大家能验证的部分是/, "polish should remove label-like disclosure fragments");
  assert.match(disclosureStack, /厨师|相邻邪恶数是 0/, "polish should preserve role and night info facts");

  const emotionalLine = applyHumanSpeechCadence(
    state,
    aiPlayer,
    "7号这边我放不下，先听他说完再看票。",
    fixedRng(20260611),
    { audience: "private", intent: "reason", force: true, emotionalTexture: "force", maxChars: 180 }
  );
  assert.match(
    emotionalLine,
    /嗯|说实话|先别急|我有点|我直说|别拖|我先留个心眼|我不太放心/,
    "human cadence should be able to add light emotional texture"
  );

  aiPlayer.beenNominatedToday = true;
  const onBlockLine = applyHumanSpeechCadence(
    state,
    aiPlayer,
    "现在先听我把身份讲清楚，再决定票。",
    fixedRng(20260612),
    { audience: "nomination", intent: "vote", emotionalTexture: "force", maxChars: 180 }
  );
  assert.match(onBlockLine, /先别急|我得防一下|这票先别锁/, "on-block speech should sound defensive before votes");

  aiPlayer.beenNominatedToday = false;
  const contaminatedLine = applyHumanSpeechCadence(
    state,
    aiPlayer,
    "这条信息可能被影响，我先听听你怎么看。",
    fixedRng(20260613),
    { audience: "private", intent: "night", emotionalTexture: "force", maxChars: 180 }
  );
  assert.match(contaminatedLine, /先打折听|别当铁证|不敢说死/, "polluted information should be framed with uncertainty");

  const lowEvidenceLine = applyHumanSpeechCadence(
    state,
    aiPlayer,
    "公开信息还不够，等他回应。",
    fixedRng(20260614),
    { audience: "public", intent: "suspect", emotionalTexture: "force", maxChars: 180 }
  );
  assert.match(lowEvidenceLine, /先不定死|先别急着定|这条还轻/, "weak evidence should not sound like a hard solve");
}

function testSpeechBudgetLimitsLongDialogueText() {
  const text = "第一句很长但还可以。第二句继续解释。第三句补充说明。第四句又开始拖长。第五句应该被裁掉。";
  const rendered = applySpeechBudget(text, { audience: "public", maxSentences: 3, maxChars: 80 });

  assert.match(rendered, /第一句/);
  assert.match(rendered, /第三句/);
  assert.doesNotMatch(rendered, /第五句/, "speech budget should remove excess sentences");
  assert.ok(rendered.length <= 80, "speech budget should respect maxChars");
}

function testPublicSpeechBudgetPreservesPriorityFragments() {
  const text =
    "TARGET: 3 should answer. Long filler about table texture and timing that would normally eat the budget. EVIDENCE: vote swing. QUESTION: explain vote path.";
  const rendered = applySpeechBudget(text, {
    audience: "public",
    maxSentences: 2,
    maxChars: 128,
    minPriorityFragments: 4,
    priorityFragments: [
      { key: "persona", text: "PERSONA: steady opener", appendText: "PERSONA: steady opener.", placement: "prefix", priority: 1 },
      { key: "target", text: "TARGET: 3", priority: 4 },
      { key: "evidence", text: "EVIDENCE: vote swing", priority: 3 },
      { key: "question", text: "QUESTION: explain vote path", priority: 2 },
    ],
  });
  const hits = [
    "PERSONA: steady opener",
    "TARGET: 3",
    "EVIDENCE: vote swing",
    "QUESTION: explain vote path",
  ].filter((marker) => rendered.includes(marker));

  assert.ok(hits.length >= 4, `public budget should preserve all four priority fragments when room allows, got ${rendered}`);
  assert.ok(rendered.startsWith("PERSONA: steady opener."), `prefix priority fragment should stay at the front, got ${rendered}`);
  assert.ok(rendered.length <= 128, "priority-preserving public budget should still respect maxChars");
}

function testPrivateEvidenceDoesNotLeakIntoPublicSpeech() {
  const state = makeTBState();
  const observer = state.players.find((player) => !player.isHuman && player.team === "good");
  const target = state.players.find((player) => !player.isHuman && player.id !== observer.id && player.alive);
  const marker = "SECRET_PRIVATE_MARKER_20260510";

  assert.ok(observer, "expected observer AI");
  assert.ok(target, "expected target AI");

  addAgentObservation(state, observer.id, {
    kind: "private-whisper",
    source: "private-chat",
    private: true,
    text: marker,
    payload: {
      speakerId: target.id,
      targetId: observer.id,
      focusId: target.id,
    },
  });
  observer.suspicion[target.id] = 0.84;

  advanceDayStage(state, "public");
  runAIDiscussion(state, fixedRng(2323));
  const speeches = state.events.speeches.filter((entry) => !entry.private);
  assert.ok(speeches.length > 0, "expected public AI speeches");
  assert.ok(
    speeches.every((entry) => !`${entry.line ?? entry.text ?? ""}`.includes(marker)),
    "public discussion must not quote private whisper contents"
  );
}

function testGoodDialogueSummaryHidesDemonBluffs() {
  const state = makeTBState();
  const good = state.players.find((player) => !player.isHuman && player.team === "good");
  const target = state.players.find((player) => !player.isHuman && player.id !== good.id);
  const hiddenBluff = state.demonBluffs?.[0];

  assert.ok(good, "expected good AI");
  assert.ok(target, "expected target");
  assert.ok(hiddenBluff, "expected demon bluff fixture");

  assert.throws(
    () => assertNoHiddenInfoLeakForDialogue(hiddenBluff.name ?? hiddenBluff.id, state, good),
    /hidden demon bluff/,
    "test helper should catch hidden bluff role names for good viewers"
  );

  addAgentObservation(state, good.id, {
    kind: "night-info",
    source: "storyteller",
    private: true,
    text: `Hidden bluff was ${hiddenBluff.name ?? hiddenBluff.id}`,
    payload: {
      targetId: target.id,
    },
  });

  const summary = summarizeEvidenceForDialogue(state, good, target.id, { limit: 1 })[0] ?? "";
  assertNoHiddenInfoLeakForDialogue(summary, state, good);
}

function testAgentViewHidesHiddenTruthForGoodViewer() {
  const state = makeTBState();
  const good = state.players.find((player) => !player.isHuman && player.team === "good");
  const demon = state.players.find((player) => !player.isHuman && player.category === "demon");
  const hiddenBluff = state.demonBluffs?.[0];

  assert.ok(good, "expected good AI");
  assert.ok(demon, "expected demon AI");
  assert.ok(hiddenBluff, "expected hidden bluff");

  const view = buildAgentView(state, good, { audience: "public", targetId: demon.id });
  assert.ok(view, "expected agent view");
  assert.equal(view.self.teamKnownToSelf, "good", "good viewer should know only its own team");
  assert.deepEqual(view.knownBluffRoleIds, [], "good viewer should not receive demon bluffs");
  assert.equal(view.knownDemonId, null, "good viewer should not receive demon id");
  assert.deepEqual(view.knownMinionIds, [], "good viewer should not receive minion ids");
  assert.ok(
    view.targets.every((target) => !Object.prototype.hasOwnProperty.call(target, "roleId")),
    "target public views should not expose real role ids"
  );
  assert.ok(
    view.targets.every((target) => !Object.prototype.hasOwnProperty.call(target, "team")),
    "target public views should not expose real teams"
  );

  const serialized = JSON.stringify(view);
  assert.ok(!serialized.includes(hiddenBluff.name ?? hiddenBluff.id), "serialized good view should not contain bluff name");
  assert.ok(!serialized.includes(`"state"`), "raw state should not be enumerable on agent view");
}

function testAgentViewAllowsLegalDemonPrivateKnowledge() {
  const state = makeTBState();
  const demon = state.players.find((player) => !player.isHuman && player.category === "demon");
  const minion = state.players.find((player) => !player.isHuman && player.category === "minion");

  assert.ok(demon, "expected demon AI");
  assert.ok(minion, "expected minion AI");

  const view = buildAgentView(state, demon, { audience: "private", targetId: minion.id });
  assert.ok(view, "expected demon private view");
  assert.equal(view.canRevealEvilKnowledge, true, "demon private view can use legal evil knowledge");
  assert.equal(view.knownDemonId, demon.id, "demon view should know itself as demon");
  assert.ok(view.knownAllies.includes(minion.id), "demon view should know minion ally");
  assert.equal(view.knownBluffRoleIds.length, 3, "demon private view should include legal demon bluffs");
}

function testAgentViewPublicPrivateEvidenceBoundary() {
  const state = makeTBState();
  const observer = state.players.find((player) => !player.isHuman && player.team === "good");
  const target = state.players.find((player) => !player.isHuman && player.id !== observer.id && player.alive);

  assert.ok(observer, "expected observer AI");
  assert.ok(target, "expected target AI");

  addAgentObservation(state, observer.id, {
    kind: "public-speech",
    source: "public-chat",
    private: false,
    text: "Public pressure on target.",
    payload: { speakerId: target.id, focusId: target.id },
  });
  addAgentObservation(state, observer.id, {
    kind: "private-whisper",
    source: "private-chat",
    private: true,
    text: "PRIVATE_VIEW_MARKER_20260510",
    payload: { speakerId: target.id, targetId: observer.id, focusId: target.id },
  });

  const publicView = buildAgentView(state, observer, { audience: "public", targetId: target.id });
  const privateView = buildAgentView(state, observer, { audience: "private", targetId: target.id });

  assert.ok(publicView.evidenceForTarget(target.id).length > 0, "public view should see public evidence");
  assert.ok(
    publicView.evidenceForTarget(target.id).every((entry) => entry.visibility !== "private"),
    "public view should exclude private evidence"
  );
  assert.ok(
    privateView.evidenceForTarget(target.id).some((entry) => entry.visibility === "private"),
    "private view should include participant private evidence"
  );

  const bypassEvidence = publicView.evidenceForTarget(target.id, {
    publicOnly: false,
    includePrivate: true,
  });
  assert.ok(
    bypassEvidence.length > 0,
    "public view should still return public evidence when explicit private options are requested"
  );
  assert.ok(
    bypassEvidence.every((entry) => entry.visibility !== "private"),
    "public view evidence accessor should not allow explicit includePrivate bypass"
  );
  assert.equal(
    publicView.evidenceCountForTarget(target.id, { publicOnly: false, includePrivate: true }),
    bypassEvidence.length,
    "public view evidence count should stay public-only even with explicit private options"
  );
  assert.doesNotMatch(
    JSON.stringify(publicView.summariesForTarget(target.id, { publicOnly: false, includePrivate: true })),
    /PRIVATE_VIEW_MARKER_20260510/,
    "public view summaries should not allow explicit includePrivate bypass"
  );
  const publicGraph = publicView.graphForTarget(target.id, { publicOnly: false, includePrivate: true });
  assert.ok(
    (publicGraph.edges ?? []).every((edge) => edge.visibility !== "private"),
    "public view graph accessor should not expose private evidence edges"
  );
  assert.doesNotMatch(
    JSON.stringify(publicGraph),
    /PRIVATE_VIEW_MARKER_20260510/,
    "public view graph should not serialize private evidence nodes"
  );
  assert.ok(
    (privateView.graphForTarget(target.id).edges ?? []).some((edge) => edge.visibility === "private"),
    "private view graph should still include participant private evidence edges"
  );
}

function testKnowledgeGraphRecordsPublicClaimAndReveal() {
  const state = makeTBState();
  const observer = state.players.find((player) => !player.isHuman && player.team === "good");
  const target = state.players.find((player) => !player.isHuman && player.id !== observer.id);

  assert.ok(observer, "expected observer AI");
  assert.ok(target, "expected target AI");

  const claim = {
    day: state.day,
    playerId: target.id,
    roleId: target.roleId,
    private: false,
  };
  state.events.claims.push(claim);
  recordPublicClaimForAgents(state, claim);
  addAgentObservation(state, observer.id, {
    kind: "execution",
    source: "public-procedure",
    private: false,
    reliability: "certain",
    text: `${target.id} was revealed.`,
    payload: {
      playerId: target.id,
      targetId: target.id,
      roleId: target.roleId,
      reason: "test-reveal",
      phase: "day",
    },
  });

  const graph = getAgentKnowledgeGraph(state, observer, { targetId: target.id });
  assert.ok(graph.nodes.some((node) => node.id === `player:${target.id}`), "graph should include target player node");
  assert.ok(graph.nodes.some((node) => node.id === `role:${target.roleId}`), "graph should include claimed/revealed role node");
  assert.ok(
    graph.edges.some((edge) => edge.type === "claimed_role" && edge.from === `player:${target.id}` && edge.to === `role:${target.roleId}`),
    "graph should include claimed_role edge"
  );
  assert.ok(
    graph.edges.some((edge) => edge.type === "revealed_as" && edge.from === `player:${target.id}` && edge.to === `role:${target.roleId}`),
    "graph should include revealed_as edge"
  );
}

function testKnowledgeGraphKeepsPrivateWhisperParticipantScoped() {
  const state = makeTBState();
  const speaker = state.players.find((player) => !player.isHuman);
  const target = state.players.find((player) => !player.isHuman && player.id !== speaker.id);
  const outsider = state.players.find((player) => !player.isHuman && player.id !== speaker.id && player.id !== target.id);

  assert.ok(speaker, "expected speaker AI");
  assert.ok(target, "expected target AI");
  assert.ok(outsider, "expected outsider AI");

  const marker = "KG_PRIVATE_MARKER_20260511";
  addAgentObservation(state, speaker.id, {
    kind: "private-whisper",
    source: "private-chat",
    private: true,
    text: marker,
    payload: { speakerId: speaker.id, targetId: target.id, focusId: target.id },
  });
  addAgentObservation(state, target.id, {
    kind: "private-whisper",
    source: "private-chat",
    private: true,
    text: marker,
    payload: { speakerId: speaker.id, targetId: target.id, focusId: target.id },
  });

  const speakerGraph = getAgentKnowledgeGraph(state, speaker);
  const targetGraph = getAgentKnowledgeGraph(state, target);
  const outsiderGraph = getAgentKnowledgeGraph(state, outsider);

  assert.ok(speakerGraph.edges.some((edge) => edge.type === "whispered_to"), "speaker graph should record private whisper");
  assert.ok(targetGraph.edges.some((edge) => edge.type === "whispered_to"), "target graph should record private whisper");
  assert.ok(
    outsiderGraph.edges.every((edge) => edge.type !== "whispered_to"),
    "unrelated outsider graph should not receive private whisper edge"
  );
  assert.ok(
    JSON.stringify(outsiderGraph).includes(marker) === false,
    "unrelated outsider graph should not contain private marker text"
  );
}

function testKnowledgeGraphRecordsVoteEdgesAndStaysBounded() {
  const state = makeTBState();
  const observer = state.players.find((player) => !player.isHuman && player.team === "good");
  const nominee = state.players.find((player) => !player.isHuman && player.id !== observer.id);
  const voter = state.players.find((player) => !player.isHuman && player.id !== observer.id && player.id !== nominee.id);

  assert.ok(observer, "expected observer AI");
  assert.ok(nominee, "expected nominee AI");
  assert.ok(voter, "expected voter AI");

  recordVoteForAgents(state, {
    nominatorId: observer.id,
    nomineeId: nominee.id,
    yesVotes: 1,
    threshold: 5,
    passed: false,
    votes: [
      { voterId: observer.id, vote: true },
      { voterId: voter.id, vote: false },
    ],
  });

  const graph = getAgentKnowledgeGraph(state, observer, { targetId: nominee.id });
  assert.ok(
    graph.edges.some((edge) => edge.type === "voted_yes_on" && edge.from === `player:${observer.id}`),
    "graph should record yes vote edge"
  );
  assert.ok(
    graph.edges.some((edge) => edge.type === "voted_no_on" && edge.from === `player:${voter.id}`),
    "graph should record no vote edge"
  );
  const fullGraph = getAgentKnowledgeGraph(state, observer);
  assert.ok(fullGraph.nodes.length <= 420, "lightweight graph should keep node count bounded");
  assert.ok(fullGraph.edges.length <= 680, "lightweight graph should keep edge count bounded");
}

function testKnowledgeGraphFalseClaimInfluencesPrivateReason() {
  const state = makeTBState();
  const human = state.players.find((player) => player.isHuman);
  const observer = state.players.find((player) => !player.isHuman && player.team === "good");
  const target = state.players.find((player) => !player.isHuman && player.id !== observer.id && player.alive);

  assert.ok(human, "expected human");
  assert.ok(observer, "expected observer AI");
  assert.ok(target, "expected target AI");

  const fakeRoleId = target.roleId === "washerwoman" ? "chef" : "washerwoman";
  const claim = {
    day: state.day,
    playerId: target.id,
    roleId: fakeRoleId,
    private: false,
  };
  state.events.claims.push(claim);
  recordPublicClaimForAgents(state, claim);
  addAgentObservation(state, observer.id, {
    kind: "execution",
    source: "public-procedure",
    private: false,
    reliability: "certain",
    text: `${target.id} was revealed.`,
    payload: {
      playerId: target.id,
      targetId: target.id,
      roleId: target.roleId,
      reason: "test-reveal",
      phase: "day",
    },
  });
  observer.suspicion[target.id] = 0.86;

  const result = runPrivateWhisper(
    state,
    {
      targetId: observer.id,
      humanLine: `why do you suspect ${target.seatIndex + 1}?`,
      intentHint: "reason",
    },
    fixedRng(20260511)
  );

  assert.ok(result.evidenceContract?.graphPressure?.scoreDelta > 0, "false claim graph pressure should be positive");
  assert.ok(
    result.evidenceContract.summaries.some((summary) => /声称|验证|对不上/.test(summary)),
    "private reason should include graph-derived false-claim explanation"
  );
  assert.match(result.evidenceContract.spokenText, /身份对不上/, "contract should expose player-style short summary");
  assert.ok(
    result.evidenceContract.graphChains?.some((chain) => chain.type === "false-claim-chain"),
    "false claim should become an explicit KG reason chain"
  );
  assert.ok(
    result.followUpPrompts?.some((prompt) => /追问|身份口径|验证链/.test(prompt)),
    "private response should expose a KG-driven follow-up prompt"
  );
}

function testKnowledgeGraphRoleConflictInfluencesPrivateReason() {
  const state = makeTBState();
  const observer = state.players.find((player) => !player.isHuman && player.team === "good");
  const target = state.players.find((player) => !player.isHuman && player.id !== observer.id && player.alive);
  const claimant = state.players.find(
    (player) => !player.isHuman && player.id !== observer.id && player.id !== target.id && player.alive
  );

  assert.ok(observer, "expected observer AI");
  assert.ok(target, "expected target AI");
  assert.ok(claimant, "expected conflicting claimant AI");

  const contestedRoleId = "washerwoman";
  [target, claimant].forEach((player) => {
    const claim = {
      day: state.day,
      playerId: player.id,
      roleId: contestedRoleId,
      private: false,
    };
    state.events.claims.push(claim);
    recordPublicClaimForAgents(state, claim);
  });
  observer.suspicion[target.id] = 0.84;

  const result = runPrivateWhisper(
    state,
    {
      targetId: observer.id,
      humanLine: `why do you suspect ${target.seatIndex + 1}?`,
      intentHint: "reason",
    },
    fixedRng(20260513)
  );

  assert.ok(result.evidenceContract?.graphPressure?.scoreDelta > 0, "role conflict graph pressure should be positive");
  assert.ok(
    result.evidenceContract.summaries.some((summary) => /撞车|身份声称/.test(summary)),
    "private reason should include graph-derived role conflict explanation"
  );
  assert.ok(
    result.evidenceContract.graphChains?.some((chain) => chain.type === "role-conflict-chain"),
    "role conflict should become an explicit KG reason chain"
  );
}

function testKnowledgeGraphPublicDefenseOfHotTargetAddsPressure() {
  const state = makeTBState();
  const observer = state.players.find((player) => !player.isHuman && player.team === "good");
  const speaker = state.players.find((player) => !player.isHuman && player.id !== observer.id && player.alive);
  const protectedTarget = state.players.find(
    (player) => !player.isHuman && player.id !== observer.id && player.id !== speaker.id && player.alive
  );

  assert.ok(observer, "expected observer AI");
  assert.ok(speaker, "expected speaker AI");
  assert.ok(protectedTarget, "expected protected target AI");

  observer.suspicion[speaker.id] = 0.82;
  observer.suspicion[protectedTarget.id] = 0.72;
  observer.dialogueBias = observer.dialogueBias ?? {};
  observer.dialogueBias[speaker.id] = 0.72;
  observer.dialogueBias[protectedTarget.id] = 0.72;
  addAgentObservation(state, observer.id, {
    kind: "public-speech",
    source: "public-chat",
    private: false,
    text: `${speaker.id} says ${protectedTarget.id} is safe and should not be executed.`,
    payload: {
      speakerId: speaker.id,
      focusId: protectedTarget.id,
      polarity: "defend",
      roundInDay: 1,
      orderIndex: 1,
    },
  });

  const graph = getAgentKnowledgeGraph(state, observer, { targetId: speaker.id });
  assert.ok(
    graph.edges.some(
      (edge) => edge.type === "public_defended" && edge.from === `player:${speaker.id}` && edge.to === `player:${protectedTarget.id}`
    ),
    "public defense should become a KG edge"
  );

  const result = runPrivateWhisper(
    state,
    {
      targetId: observer.id,
      humanLine: `why do you suspect ${speaker.seatIndex + 1}?`,
      intentHint: "reason",
    },
    fixedRng(20260514)
  );

  assert.ok(result.evidenceContract?.graphPressure?.scoreDelta > 0, "defending a hot target should add pressure");
  assert.ok(
    result.evidenceContract.summaries.some((summary) => /维护|高压目标|公开站队/.test(summary)),
    "private reason should mention graph-derived public defense pressure"
  );
}

function testKnowledgeGraphPressureCanDriveNominationFocus() {
  const state = makeTBState();
  advanceDayStage(state, "public");
  advanceDayStage(state, "nomination");

  const nominator = state.players.find((player) => !player.isHuman && player.team === "good" && player.alive);
  const target = state.players.find((player) => !player.isHuman && player.id !== nominator.id && player.alive);
  assert.ok(nominator, "expected nominator");
  assert.ok(target, "expected target");

  state.players
    .filter((player) => !player.isHuman)
    .forEach((player) => {
      player.aiPersona = "steady";
      player.suspicion = {};
      player.reasonFlags = {};
      state.players.forEach((candidate) => {
        player.suspicion[candidate.id] = candidate.id === player.id ? 0.01 : 0.22;
      });
    });

  const fakeRoleId = target.roleId === "washerwoman" ? "chef" : "washerwoman";
  const claim = {
    day: state.day,
    playerId: target.id,
    roleId: fakeRoleId,
    private: false,
  };
  state.events.claims.push(claim);
  recordPublicClaimForAgents(state, claim);
  addAgentObservation(state, nominator.id, {
    kind: "execution",
    source: "public-procedure",
    private: false,
    reliability: "certain",
    text: `${target.id} was revealed.`,
    payload: {
      playerId: target.id,
      targetId: target.id,
      roleId: target.roleId,
      reason: "test-reveal",
      phase: "day",
    },
  });

  const proposal = chooseAINomination(state);
  assert.ok(proposal, "expected graph-pressure nomination proposal");
  assert.equal(proposal.nominatorId, nominator.id, "nominator should use its graph pressure");
  assert.equal(proposal.nomineeId, target.id, "false-claim graph pressure should drive target choice");
  assert.ok(
    proposal.evidenceContract?.graphPressure?.scoreDelta > 0,
    "proposal should expose graph pressure contribution"
  );
}

function testEvilAIUsesKnowledgeGraphForFramingNomination() {
  const state = makeTBState();
  advanceDayStage(state, "public");
  advanceDayStage(state, "nomination");

  const evilAI = state.players.find((player) => !player.isHuman && player.team === "evil" && player.alive);
  const target = state.players.find((player) => !player.isHuman && player.team === "good" && player.alive);
  const claimant = state.players.find(
    (player) => !player.isHuman && player.team === "good" && player.id !== target.id && player.alive
  );

  assert.ok(evilAI, "expected evil AI");
  assert.ok(target, "expected good framing target");
  assert.ok(claimant, "expected second good claimant");

  state.players
    .filter((player) => !player.isHuman && player.id !== evilAI.id)
    .forEach((player) => {
      player.nominatedToday = true;
    });
  evilAI.aiPersona = "shadow";
  evilAI.dialogueBias = evilAI.dialogueBias ?? {};
  evilAI.dialogueBias[target.id] = 0.55;

  [target, claimant].forEach((player) => {
    const claim = {
      day: state.day,
      playerId: player.id,
      roleId: "washerwoman",
      private: false,
    };
    state.events.claims.push(claim);
    recordPublicClaimForAgents(state, claim);
  });

  const proposal = chooseAINomination(state);
  assert.ok(proposal, "expected evil AI framing nomination proposal");
  assert.equal(proposal.nominatorId, evilAI.id, "evil AI should be the only available nominator");
  assert.equal(proposal.nomineeId, target.id, "evil AI should use the public role conflict as a framing target");
  assert.equal(proposal.framing, true, "proposal should mark KG-supported evil framing");
  assert.ok(
    proposal.evidenceContract?.graphChains?.some((chain) => chain.type === "role-conflict-chain"),
    "framing proposal should carry the KG chain it is using"
  );
}

function testEvilWorldPlanFramesNonAllyWhileProtectingAllies() {
  const state = makeTBState();
  advanceDayStage(state, "public");
  const evilAI = state.players.find((player) => !player.isHuman && player.team === "evil" && player.alive);
  const allyId = getAIAgent(state, evilAI)?.knownAllyIds?.find((id) => id !== evilAI.id);
  const ally = state.players.find((player) => player.id === allyId);
  const target = state.players.find((player) => !player.isHuman && player.team === "good" && player.alive);

  assert.ok(evilAI, "expected evil AI");
  assert.ok(ally, "expected known evil ally");
  assert.ok(target, "expected good framing target");

  ally.beenNominatedToday = true;
  evilAI.suspicion[target.id] = 0.64;
  const context = buildAIStrategyContext(state, evilAI, {
    audience: "public",
    stage: "nomination",
    targetId: target.id,
  });

  assert.equal(context.evilWorldPlan?.mode, "protect-ally", "evil plan should notice an ally under public pressure");
  assert.equal(context.evilWorldPlan?.version, 2, "evil world plan should use the flexible context schema");
  assert.ok(context.evilWorldPlan?.protectAllyIds.includes(ally.id), "evil plan should record pressured allies");
  assert.equal(context.evilWorldPlan?.framingTargetId, target.id, "evil plan should frame a non-ally target");
  assert.ok(
    context.evilWorldPlan?.narrativeAnchors?.some((anchor) => anchor.type === "protect-ally"),
    "evil plan should expose a structured ally-protection anchor for maintenance"
  );
  assert.ok(
    evilWorldPlanTargetBias(context.evilWorldPlan, ally.id, { isKnownAlly: true }) < 0,
    "protected allies should receive negative target bias"
  );
  assert.ok(
    evilWorldPlanTargetBias(context.evilWorldPlan, target.id, { isKnownAlly: false }) > 0,
    "framing target should receive positive target bias"
  );
  assert.equal(context.target.isKnownAlly, false, "strategy target should not be a known ally");
}

function testEvilTeamPlanCoordinatesNominationAcrossAllies() {
  const state = makeTBState();
  advanceDayStage(state, "nomination");
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
  assert.equal(state.aiDialogue?.evilTeamWorldPlan?.framingTargetId, teamTarget.id, "team plan should persist the shared frame target");

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

function testEvilTeamPlanPivotsAfterFailedVoteResult() {
  const state = makeTBState();
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
  assert.equal(pivot.evilWorldPlan?.staleFramingTargetId, failedTeamTarget.id, "pivot should retain the failed target as feedback context");
  assert.equal(pivot.evilWorldPlan?.staleReason, "failed-vote-release", "pivot should explain why the old team plan was released");

  const proposal = chooseAINomination(state);
  assert.ok(proposal, "expected an evil nomination after failed vote feedback");
  assert.equal(proposal.nominatorId, adoptingEvil.id, "fixture leaves only the adopting evil AI able to nominate");
  assert.equal(proposal.nomineeId, newTarget.id, "evil nomination should pivot to the stronger new target after a failed vote");
}

function testEvilWorldPlanMaintainsSoftContinuityAcrossDays() {
  const state = makeTBState();
  advanceDayStage(state, "public");
  const evilAI = state.players.find((player) => !player.isHuman && player.team === "evil" && player.alive);
  const targets = state.players.filter((player) => !player.isHuman && player.team === "good" && player.alive);
  const firstTarget = targets[0];
  const secondTarget = targets[1];

  assert.ok(evilAI, "expected evil AI");
  assert.ok(firstTarget && secondTarget, "expected two good targets");

  state.players.forEach((player) => {
    evilAI.suspicion[player.id] = player.id === evilAI.id ? 0.01 : 0.2;
  });
  evilAI.suspicion[firstTarget.id] = 0.66;
  evilAI.suspicion[secondTarget.id] = 0.48;

  const first = buildAIStrategyContext(state, evilAI, {
    audience: "public",
    stage: "public",
    targetId: firstTarget.id,
  });
  assert.equal(first.evilWorldPlan?.framingTargetId, firstTarget.id, "initial evil plan should pick the strongest frame target");

  state.day += 1;
  evilAI.suspicion[firstTarget.id] = 0.61;
  evilAI.suspicion[secondTarget.id] = 0.66;
  const second = buildAIStrategyContext(state, evilAI, {
    audience: "public",
    stage: "public",
    targetId: firstTarget.id,
  });

  assert.equal(second.evilWorldPlan?.framingTargetId, firstTarget.id, "evil plan should keep a close previous target");
  assert.equal(second.evilWorldPlan?.continuity, "hold", "soft continuity should be explicit instead of silently recalculating");
  assert.ok(second.evilWorldPlan?.commitment > (first.evilWorldPlan?.commitment ?? 0), "commitment should rise when holding a line");
  assert.ok(second.evilWorldPlan?.history?.length >= 1, "evil plan should keep bounded maintenance history");
}

function testEvilWorldPlanCanPivotWhenPressureClearlyChanges() {
  const state = makeTBState();
  advanceDayStage(state, "public");
  const evilAI = state.players.find((player) => !player.isHuman && player.team === "evil" && player.alive);
  const targets = state.players.filter((player) => !player.isHuman && player.team === "good" && player.alive);
  const firstTarget = targets[0];
  const secondTarget = targets[1];

  assert.ok(evilAI, "expected evil AI");
  assert.ok(firstTarget && secondTarget, "expected two good targets");

  state.players.forEach((player) => {
    evilAI.suspicion[player.id] = player.id === evilAI.id ? 0.01 : 0.2;
  });
  evilAI.suspicion[firstTarget.id] = 0.66;
  evilAI.suspicion[secondTarget.id] = 0.46;
  buildAIStrategyContext(state, evilAI, {
    audience: "public",
    stage: "public",
    targetId: firstTarget.id,
  });

  state.day = 3;
  evilAI.suspicion[firstTarget.id] = 0.42;
  evilAI.suspicion[secondTarget.id] = 0.9;
  const pivot = buildAIStrategyContext(state, evilAI, {
    audience: "public",
    stage: "nomination",
    targetId: secondTarget.id,
  });

  assert.equal(pivot.evilWorldPlan?.framingTargetId, secondTarget.id, "evil plan should pivot when a new target is clearly better");
  assert.equal(pivot.evilWorldPlan?.previousFramingTargetId, firstTarget.id, "pivot should retain the previous frame for maintenance context");
  assert.match(pivot.evilWorldPlan?.pivotReason ?? "", /new-public-pressure|late-window/, "pivot should have a readable reason");
  assert.equal(pivot.evilWorldPlan?.continuity, "soft-pivot", "pivot should be flexible rather than a hard reset");
}

function testAgentStrategyViewExposesLightweightWorldCandidates() {
  const state = makeTBState();
  advanceDayStage(state, "public");
  const aiPlayer = state.players.find((player) => !player.isHuman && player.team === "good" && player.alive);
  const target = state.players.find((player) => !player.isHuman && player.id !== aiPlayer.id && player.alive);

  assert.ok(aiPlayer, "expected good AI");
  assert.ok(target, "expected target");

  state.players.forEach((player) => {
    aiPlayer.suspicion[player.id] = player.id === target.id ? 0.74 : 0.2;
  });

  const view = buildAgentStrategyView(state, aiPlayer, {
    audience: "public",
    stage: "public",
    targetId: target.id,
  });

  assert.equal(view.kind, "agent-strategy-view", "new compatibility layer should expose the requested name");
  assert.equal(view.baseKind, "ai-strategy-context", "agentStrategyView should remain backward compatible");
  assert.equal(view.visibility.usesAgentView, true, "strategy view should be explicit about agent-view visibility");
  assert.ok(Array.isArray(view.worldCandidates?.candidates), "strategy view should expose lightweight world candidates");
  assert.equal(view.worldCandidates.candidates[0]?.targetId, target.id, "highest visible suspicion should drive the first candidate");
  assert.equal(view.evilWorldPlan, null, "good strategy view should not receive an evil world plan");
}

function testCoalitionVoteSimulationTracksLikelyVotes() {
  const state = makeTBState();
  advanceDayStage(state, "nomination");
  const actor = state.players.find((player) => !player.isHuman && player.alive);
  const nominee = state.players.find((player) => !player.isHuman && player.id !== actor.id && player.team === "good" && player.alive);

  assert.ok(actor, "expected AI actor");
  assert.ok(nominee, "expected nominee");

  state.players.forEach((voter) => {
    voter.suspicion[nominee.id] = 0.86;
  });

  const coalition = simulateCoalitionVote(state, actor, nominee);
  assert.equal(coalition.kind, "coalition-vote-simulation");
  assert.equal(coalition.nomineeId, nominee.id);
  assert.ok(coalition.expectedYesVotes >= coalition.threshold, "high shared suspicion should project enough yes votes");
  assert.equal(coalition.likelyPasses, true);
  assert.ok(coalition.voterEstimates.some((entry) => entry.voterId === actor.id), "simulation should keep per-voter estimates");
}

function testPublicVoteAndCoalitionIgnorePrivateOnlySuspicion() {
  const rng = fixedRng(2026060712);
  const state = createNewGame({ scriptId: "tb", playerCount: 9, preferredHumanRoleId: "washerwoman" }, rng);
  initializeAI(state);
  runNight(state, rng);
  initializeAI(state);
  advanceDayStage(state, "public");
  advanceDayStage(state, "nomination");
  state.day = 2;

  const actor = state.players.find((player) => !player.isHuman && player.team === "good" && player.alive);
  const privateVoter = state.players.find(
    (player) => !player.isHuman && player.team === "good" && player.id !== actor?.id && player.alive
  );
  const nominee = state.players.find(
    (player) => !player.isHuman && player.id !== actor?.id && player.id !== privateVoter?.id && player.alive
  );
  assert.ok(actor, "expected actor");
  assert.ok(privateVoter, "expected private-info voter");
  assert.ok(nominee, "expected nominee");

  state.players.forEach((player) => {
    privateVoter.suspicion[player.id] = 0.08;
  });
  const agent = getAIAgent(state, privateVoter);
  agent.evidenceBook = [];
  agent.observations = [];
  addAgentObservation(state, privateVoter.id, {
    kind: "night-info",
    source: "storyteller",
    private: true,
    text: "PRIVATE_COALITION_MARKER should not move public coalition projection",
    payload: { targetId: nominee.id },
  });
  for (let index = 0; index < 12; index += 1) {
    addAgentObservation(state, privateVoter.id, {
      kind: "private-whisper",
      source: "private-chat",
      private: true,
      reliability: "certain",
      contaminationRisk: 0,
      text: `PRIVATE_COALITION_MARKER ${index} says this nominee is evil`,
      payload: { speakerId: actor.id, focusId: nominee.id, targetId: privateVoter.id },
    });
  }

  refreshAIBeliefs(state);
  assert.ok(
    privateVoter.suspicion[nominee.id] >= 0.58,
    "fixture should prove private-only information can raise raw voter suspicion to the legacy yes-vote line"
  );

  const privateVote = decideAIVoteWithRationale(privateVoter, nominee, state, () => 0.99);
  assert.equal(privateVote.vote, false, "private-only suspicion should not drive the formal public vote");
  assert.equal(privateVote.voteRationale.publicOnly, true);
  assert.equal(privateVote.voteRationale.evidenceCount, 0, "formal vote should count only public evidence");
  assert.ok(
    privateVote.voteRationale.suspicion < privateVoter.suspicion[nominee.id],
    "formal vote rationale should expose the public-safe suspicion, not the private-raised raw suspicion"
  );
  assert.doesNotMatch(
    JSON.stringify(privateVote.voteRationale),
    /PRIVATE_COALITION_MARKER/,
    "formal vote rationale should not serialize private-only vote pressure"
  );

  const coalition = simulateCoalitionVote(state, actor, nominee);
  const privateVoterEstimate = coalition.voterEstimates.find((entry) => entry.voterId === privateVoter.id);
  assert.ok(privateVoterEstimate, "expected audited voter estimate");
  assert.ok(
    privateVoterEstimate.baseSuspicion < privateVoter.suspicion[nominee.id],
    "coalition simulation should not use private-raised raw suspicion as the public vote base"
  );
  assert.equal(
    privateVoterEstimate.projectedYes,
    false,
    "private-only suspicion should not project a public yes vote without visible evidence"
  );
  assert.ok(privateVoterEstimate.probability < 0.5, "private-only suspicion should stay below the public vote line");
}

function testNominationProposalCarriesStrategyWorldAndCoalitionMetadata() {
  const state = makeTBState();
  advanceDayStage(state, "nomination");
  const aiPlayer = state.players.find((player) => !player.isHuman && player.team === "good" && player.alive);
  const target = state.players.find((player) => !player.isHuman && player.id !== aiPlayer.id && player.alive);

  assert.ok(aiPlayer, "expected nominator");
  assert.ok(target, "expected target");

  state.players.forEach((player) => {
    if (!player.isHuman && player.id !== aiPlayer.id && player.id !== target.id) {
      player.nominatedToday = true;
    }
    if (player.id !== aiPlayer.id && player.id !== target.id) {
      player.beenNominatedToday = true;
    }
    aiPlayer.suspicion[player.id] = player.id === target.id ? 0.82 : 0.2;
  });
  target.nominatedToday = false;
  target.beenNominatedToday = false;

  const proposal = chooseAINomination(state);
  assert.ok(proposal, "expected a nomination proposal");
  assert.equal(proposal.nominatorId, aiPlayer.id, "fixture should leave only one AI nominator");
  assert.equal(proposal.nomineeId, target.id, "proposal should follow the strategy target");
  assert.equal(proposal.coalition?.kind, "coalition-vote-simulation", "proposal should carry coalition estimate metadata");
  assert.ok(Array.isArray(proposal.worldCandidates?.candidates), "proposal should carry strategy world candidates");
  assert.ok(
    proposal.strategyContext?.worldCandidates?.candidates?.some((entry) => entry.targetId === target.id),
    "strategy context should include the nominated target in its candidate worlds"
  );
}

function testEvilWorldPlanFeedsExpressionContextLine() {
  const state = makeTBState();
  advanceDayStage(state, "public");
  const evilAI = state.players.find((player) => !player.isHuman && player.team === "evil" && player.alive);
  const target = state.players.find((player) => !player.isHuman && player.team === "good" && player.alive);

  assert.ok(evilAI, "expected evil AI");
  assert.ok(target, "expected good target");

  state.players.forEach((player) => {
    evilAI.suspicion[player.id] = player.id === target.id ? 0.76 : 0.2;
  });

  const context = buildAIStrategyContext(state, evilAI, {
    audience: "public",
    stage: "public",
    targetId: target.id,
  });
  assert.match(context.evilPlanContextLine ?? "", new RegExp(target.name), "evil plan should provide a target-specific expression anchor");
  assert.equal(context.worldCandidates?.topCandidateId, target.id, "world candidates should align with the framing target");
}

function testKnowledgeGraphContaminatedNightInfoHasLimitedPressure() {
  const state = makeTBState();
  const human = state.players.find((player) => player.isHuman);
  const observer = state.players.find((player) => !player.isHuman && player.team === "good");
  const target = state.players.find((player) => !player.isHuman && player.id !== observer.id && player.alive);

  assert.ok(human, "expected human");
  assert.ok(observer, "expected observer AI");
  assert.ok(target, "expected target AI");

  addAgentObservation(state, observer.id, {
    kind: "night-info",
    source: "storyteller",
    private: true,
    reliability: "storyteller",
    text: "contaminated night info fixture",
    contaminationRisk: 0.82,
    payload: {
      targetId: target.id,
      sourceRoleId: "fortune-teller",
      contaminationReason: "poisoned-recipient",
    },
  });
  observer.suspicion[target.id] = 0.84;

  const result = runPrivateWhisper(
    state,
    {
      targetId: observer.id,
      humanLine: `why do you suspect ${target.seatIndex + 1}?`,
      intentHint: "reason",
    },
    fixedRng(20260512)
  );

  assert.ok(result.evidenceContract?.graphPressure?.riskFlags.includes("night-info-risk"));
  assert.ok(
    result.evidenceContract.graphPressure.scoreDelta < 0.03,
    "contaminated night info should have limited graph pressure"
  );
}

function testNightInfoContaminationMetadata() {
  const state = makeTBState();
  const observer = state.players.find((player) => !player.isHuman);
  const target = state.players.find((player) => player.id !== observer.id);

  assert.ok(observer, "expected observer AI");
  assert.ok(target, "expected target");

  recordPrivateInfoForAgent(state, observer, "normal storyteller info", {
    payload: { targetId: target.id },
  });
  const normal = getAgentEvidence(state, observer, { targetId: target.id }).find(
    (entry) => entry.text === "normal storyteller info"
  );

  observer.poisoned = true;
  recordPrivateInfoForAgent(state, observer, "poisoned storyteller info", {
    payload: { targetId: target.id },
  });
  const poisoned = getAgentEvidence(state, observer, { targetId: target.id }).find(
    (entry) => entry.text === "poisoned storyteller info"
  );

  assert.ok(normal, "normal private info should become evidence");
  assert.ok(poisoned, "poisoned private info should become evidence");
  assert.ok(
    poisoned.contaminationRisk > normal.contaminationRisk,
    "poisoned recipient night info should carry higher contamination risk"
  );
  assert.equal(poisoned.contaminationReason, "poisoned-recipient");
}

function testFalseClaimLowersDynamicSourceTrust() {
  const state = makeTBState();
  const observer = state.players.find((player) => !player.isHuman && player.team === "good");
  const target = state.players.find((player) => !player.isHuman && player.id !== observer.id);

  assert.ok(observer, "expected observer AI");
  assert.ok(target, "expected target AI");

  const fakeRoleId = target.roleId === "washerwoman" ? "chef" : "washerwoman";
  const claim = {
    day: state.day,
    playerId: target.id,
    roleId: fakeRoleId,
    private: false,
  };
  target.publicClaimRoleId = fakeRoleId;
  state.events.claims.push(claim);
  recordPublicClaimForAgents(state, claim);
  target.alive = false;
  state.events.executions.push({
    day: state.day,
    nomineeId: target.id,
    roleId: target.roleId,
    reason: "test-reveal",
  });

  refreshAIBeliefs(state);
  const trust = getAgentSourceTrustForPlayer(state, observer, target.id);
  const agent = getAIAgent(state, observer);

  assert.ok(trust < 0.5, "false public claim should lower per-player source trust");
  assert.ok(
    agent.trustEvents.some((entry) => entry.sourcePlayerId === target.id && entry.reason === "false-claim"),
    "false claim should write a trust event"
  );
  assert.ok(
    getAgentEvidence(state, observer, { targetId: target.id }).some(
      (entry) => entry.sourceId === target.id && entry.sourceTrust < 0.5
    ),
    "existing evidence from the false source should receive updated sourceTrust"
  );
  assert.ok(
    getAgentKnowledgeGraph(state, observer, { targetId: target.id }).edges.some(
      (edge) => edge.type === "claimed_role" && edge.from === `player:${target.id}` && edge.trust < 0.5
    ),
    "knowledge graph claim edges should receive updated sourceTrust"
  );
  assert.ok(
    getAgentKnowledgeGraph(state, observer, { targetId: target.id }).edges.some(
      (edge) => edge.type === "source_of" && edge.from === `player:${target.id}` && edge.trust < 0.5
    ),
    "knowledge graph source edges should receive updated sourceTrust"
  );
}

function testVerifiedClaimRaisesDynamicSourceTrust() {
  const state = makeTBState();
  const observer = state.players.find((player) => !player.isHuman && player.team === "good");
  const target = state.players.find((player) => !player.isHuman && player.id !== observer.id);

  assert.ok(observer, "expected observer AI");
  assert.ok(target, "expected target AI");

  const claim = {
    day: state.day,
    playerId: target.id,
    roleId: target.roleId,
    private: false,
  };
  target.publicClaimRoleId = target.roleId;
  state.events.claims.push(claim);
  recordPublicClaimForAgents(state, claim);
  target.alive = false;
  state.events.executions.push({
    day: state.day,
    nomineeId: target.id,
    roleId: target.roleId,
    reason: "test-reveal",
  });

  refreshAIBeliefs(state);
  const trust = getAgentSourceTrustForPlayer(state, observer, target.id);

  assert.ok(trust > 0.5, "verified public claim should raise per-player source trust");
}

function testAbnormalVoteLowersDynamicSourceTrust() {
  const state = makeTBState();
  const observer = state.players.find((player) => !player.isHuman && player.team === "good");
  const voter = state.players.find((player) => !player.isHuman && player.id !== observer.id);
  const nominee = state.players.find((player) => !player.isHuman && player.id !== observer.id && player.id !== voter.id);

  assert.ok(observer, "expected observer AI");
  assert.ok(voter, "expected voter AI");
  assert.ok(nominee, "expected nominee AI");

  recordVoteForAgents(state, {
    nominatorId: observer.id,
    nomineeId: nominee.id,
    yesVotes: 5,
    threshold: 5,
    passed: true,
    votes: [
      { voterId: observer.id, vote: true },
      { voterId: voter.id, vote: false },
    ],
  });

  refreshAIBeliefs(state);
  const trust = getAgentSourceTrustForPlayer(state, observer, voter.id);
  const agent = getAIAgent(state, observer);

  assert.ok(trust < 0.5, "voting against a passed execution should lower source trust");
  assert.ok(
    agent.trustEvents.some((entry) => entry.sourcePlayerId === voter.id && entry.reason === "abnormal-vote"),
    "abnormal vote should write a trust event"
  );
}

function testMisexecutionOutcomeRedirectsNextDayNomination() {
  const rng = fixedRng(2026060702);
  const state = createNewGame({ scriptId: "tb", playerCount: 9, preferredHumanRoleId: "washerwoman" }, rng);
  initializeAI(state);
  runNight(state, rng);
  initializeAI(state);

  const observer = state.players.find((player) => !player.isHuman && player.team === "good" && player.alive);
  const misleader = state.players.find((player) => !player.isHuman && player.team === "evil" && player.alive);
  const innocent = state.players.find(
    (player) => !player.isHuman && player.team === "good" && player.alive && player.id !== observer?.id
  );
  assert.ok(observer, "expected a good AI observer");
  assert.ok(misleader, "expected an evil AI to push the bad execution");
  assert.ok(innocent, "expected a good execution target");
  applyRoleForContract(state, innocent, "chef");

  assert.equal(advanceDayStage(state, "public").ok, true, "fixture should enter public discussion");
  markPublicDiscussionRound(state);
  assert.equal(advanceDayStage(state, "nomination").ok, true, "fixture should enter nomination");

  observer.dialogueBias = observer.dialogueBias ?? {};
  observer.dialogueBias[misleader.id] = 0.32;
  const yesVoterIds = new Set(
    state.players
      .filter((player) => !player.isHuman && player.alive && player.id !== observer.id && player.id !== innocent.id)
      .slice(0, 4)
      .map((player) => player.id)
  );
  yesVoterIds.add(misleader.id);

  const result = resolveNominationAndVote(
    state,
    {
      nominatorId: misleader.id,
      nomineeId: innocent.id,
      humanVoteYes: true,
      decideAIVote: (voter) => ({
        vote: yesVoterIds.has(voter.id),
        voteRationale: {
          kind: "vote-rationale",
          audience: "vote",
          publicOnly: true,
          voterId: voter.id,
          nomineeId: innocent.id,
          vote: yesVoterIds.has(voter.id),
          line: `${voter.name} follows the test vote plan.`,
        },
      }),
    },
    rng
  );
  assert.equal(result.accepted, true, result.reason);
  assert.equal(result.passed, true, "fixture execution vote should pass");
  assert.equal(skipDay(state, rng), true, "day end should resolve the on-block good execution");
  assert.equal(state.events.executions.at(-1)?.nomineeId, innocent.id, "the good target should be executed");
  assert.equal(state.events.executions.at(-1)?.roleId, "chef", "execution result should reveal the good role");

  state.players.forEach((player) => {
    player.threatScore = player.id === observer.id ? 0 : player.team === "good" ? 0.95 : player.threatScore;
  });
  runNight(state, rng);
  initializeAI(state);
  assert.equal(observer.alive, true, "observer should survive to use the execution feedback");

  if (state.dayStage === "private") {
    assert.equal(advanceDayStage(state, "public").ok, true, "next day should enter public discussion");
  }
  markPublicDiscussionRound(state);
  if (state.dayStage === "public") {
    assert.equal(advanceDayStage(state, "nomination").ok, true, "next day should enter nomination");
  }
  state.players.forEach((player) => {
    player.nominatedToday = !player.isHuman && player.id !== observer.id;
    player.beenNominatedToday = false;
  });

  refreshAIBeliefs(state);
  const trailReasons = getSuspicionTrailForTarget(state, observer, misleader.id).map((entry) => entry.reasonKey);
  assert.ok(
    trailReasons.includes("misexecutionNomination") && trailReasons.includes("misexecutionVote"),
    "wrong execution should become durable suspicion evidence against the pusher"
  );
  assert.ok(
    getAgentSourceTrustForPlayer(state, observer, misleader.id) < 0.5,
    "wrong execution should lower trust in the player who pushed it"
  );

  const proposal = chooseAINomination(state);
  assert.ok(proposal, "next-day AI should be willing to act on the wrong-execution feedback");
  assert.equal(proposal.nominatorId, observer.id, "fixture leaves only the observing good AI able to nominate");
  assert.equal(proposal.nomineeId, misleader.id, "wrong execution feedback should redirect the next nomination to the pusher");
}

function testDialogueEvidenceOrderingAndNominationReason() {
  const state = makeTBState();
  const observer = state.players.find((player) => !player.isHuman && player.team === "good");
  const target = state.players.find((player) => !player.isHuman && player.id !== observer.id && player.alive);

  assert.ok(observer, "expected observer AI");
  assert.ok(target, "expected target AI");

  addAgentObservation(state, observer.id, {
    kind: "public-speech",
    source: "public-chat",
    private: false,
    text: "I would execute this player.",
    payload: {
      speakerId: target.id,
      focusId: target.id,
    },
  });
  const rows = getDialogueEvidenceForTarget(state, observer, target.id, { limit: 2 });
  assert.ok(rows.length > 0, "dialogue evidence helper should return target evidence");
  assert.ok(rows[0].dialogueSummary, "dialogue evidence rows should include safe summaries");

  advanceDayStage(state, "public");
  advanceDayStage(state, "nomination");
  observer.suspicion[target.id] = 0.88;
  const proposal = chooseAINomination(state);
  assert.ok(proposal, "expected AI nomination proposal");
  assert.ok(
    /先提|正式提名|放上台|正面回应/.test(proposal.reason),
    "nomination reason should explicitly mark evidence-backed or pressure intent"
  );
  assert.ok(
    proposal.evidenceSummary || /先提|放上台|正面回应/.test(proposal.reason),
    "nomination proposal should carry evidence summary or mark low-evidence pressure"
  );
}

function testNominationUsesUnifiedEvidenceContract() {
  const state = makeTBState();
  advanceDayStage(state, "public");
  advanceDayStage(state, "nomination");

  const nominator = state.players.find((player) => !player.isHuman && player.team === "good" && player.alive);
  const nominee = state.players.find((player) => !player.isHuman && player.id !== nominator.id && player.alive);
  assert.ok(nominator, "expected good AI nominator");
  assert.ok(nominee, "expected nominee");

  addAgentObservation(state, nominator.id, {
    kind: "public-speech",
    source: "public-chat",
    private: false,
    text: "Nomination contract evidence: avoided the main world.",
    payload: {
      speakerId: nominee.id,
      focusId: nominee.id,
    },
  });
  nominator.suspicion[nominee.id] = 0.9;

  const proposal = chooseAINomination(state);
  assert.ok(proposal, "expected nomination proposal");
  assert.ok(proposal.evidenceContract, "nomination proposal should include unified evidence contract");
  assert.equal(proposal.evidenceContract.publicOnly, true, "nomination evidence should be public-only");
  assert.equal(proposal.decisionRationale?.kind, "decision-rationale");
  assert.equal(proposal.decisionRationale?.audience, "nomination");
  assert.equal(proposal.decisionRationale?.publicOnly, true);
  assert.equal(
    proposal.decisionRationale?.focusId,
    proposal.nomineeId,
    "nomination decision rationale should explain the selected nominee"
  );
  assert.ok(proposal.decisionRationale?.runnerUpName, "nomination decision rationale should retain runner-up label");
  assert.ok(proposal.decisionRationale?.spokenLine, "nomination decision rationale should retain the spoken comparison line");
  assert.match(
    proposal.decisionRationale?.tableRiskLine ?? "",
    /桌面风险|公开场上|提名|带票|可见身份|票型/,
    "nomination decision rationale should preserve public-safe table risk before committing the nomination"
  );
  assert.match(
    proposal.decisionRationale?.informationGainLine ?? "",
    /信息收益|公开身份|票型|发言链|可复核/,
    "nomination decision rationale should preserve the public-safe information gain behind the nomination pressure"
  );
  assert.match(
    proposal.decisionRationale?.tableReactionLine ?? "",
    /桌面反应|跟压|护人|转移|站边|带票|跟票|公开/,
    "nomination decision rationale should preserve public-safe table reaction watch points"
  );
  assert.match(
    proposal.decisionRationale?.timingWindowLine ?? "",
    /时机窗口|提名|投票|回应|提名池|票型|身份/,
    "nomination decision rationale should preserve the timing window behind nomination pressure"
  );
  assert.match(
    proposal.decisionRationale?.worldBranchLine ?? "",
    /世界分支|如果|公开|解释|成立|断开|身份|票型/,
    "nomination decision rationale should preserve public-safe alternate world branches"
  );
  assert.match(
    proposal.decisionRationale?.voteCoalitionLine ?? "",
    /票面联盟|提|跟票|票数|压力台|处决|公开|共识/,
    "nomination decision rationale should preserve public-safe vote coalition reasoning"
  );
  assert.match(
    proposal.decisionRationale?.sourceReliabilityLine ?? "",
    /来源可靠度|公开|可复核|独立来源|同源|降权|身份|票型|发言/,
    "nomination decision rationale should preserve public-safe source reliability reasoning"
  );
  assert.match(
    proposal.decisionRationale?.timelineConsistencyLine ?? "",
    /时间线一致性|公开|身份|票型|发言|顺序|提名|回应|复核/,
    "nomination decision rationale should preserve public-safe timeline consistency reasoning"
  );
  assert.match(
    proposal.decisionRationale?.incentiveAlignmentLine ?? "",
    /动机归因|公开|行为|收益|解桌|自保|护人|转移压力|票型|发言/,
    "nomination decision rationale should preserve public-safe incentive alignment reasoning"
  );
  assert.match(
    proposal.decisionRationale?.burdenOfProofLine ?? "",
    /举证责任|公开|身份|票型|发言|回应|理由|跟票者|支持者|上票/,
    "nomination decision rationale should preserve public-safe burden-of-proof reasoning"
  );
  assert.match(
    proposal.decisionRationale?.questionPriorityLine ?? "",
    /追问顺序|公开|身份|票型|发言|回应|理由|跟票|提名|处决票|第二压力位/,
    "nomination decision rationale should preserve public-safe question priority reasoning"
  );
  assert.match(
    proposal.decisionRationale?.actionThresholdLine ?? "",
    /行动门槛|公开|回应|提名|处决票|上票|降回压力台|锁票|票型|身份/,
    "nomination decision rationale should preserve public-safe action-threshold reasoning"
  );
  assert.match(
    proposal.decisionRationale?.memoryContinuityLine ?? "",
    /记忆连续性|本轮|建档|证据|公开|对照|读法/,
    "nomination decision rationale should preserve public-safe memory-continuity reasoning"
  );
  assert.match(
    proposal.decisionRationale?.expressionDisciplineLine ?? "",
    /表达纪律|公开说法|追问口吻|条件句|不说|不把|回应质量|结论|公开|身份|票型|发言|回应/,
    "nomination decision rationale should preserve public-safe expression-discipline reasoning"
  );
  assert.match(
    proposal.decisionRationale?.uncertaintyResolutionLine ?? "",
    /不确定性|公开|身份|票型|发言|回应|证据|复核|消解|提名|压力/,
    "nomination decision rationale should preserve public-safe uncertainty-resolution reasoning"
  );
  assert.match(
    proposal.decisionRationale?.evidenceFreshnessLine ?? "",
    /证据新鲜度|公开|身份|票型|发言|回应|证据|旧线索|新证据|当前回应|刷新|提名|压力/,
    "nomination decision rationale should preserve public-safe evidence-freshness reasoning"
  );
  assert.match(
    proposal.decisionRationale?.falsificationCheckLine ?? "",
    /证伪检查|如果|公开|身份|票型|发言|回应|证据|理由|接上|自洽|降级|回切|不能继续|主压|强压|复核线/,
    "nomination decision rationale should preserve public-safe falsification reasoning"
  );
  assert.match(
    proposal.decisionRationale?.causalChainLine ?? "",
    /因果链|公开|身份|票型|发言|回应|证据|理由|导致|影响|推动|形成|变成|桌面|台面|压力/,
    "nomination decision rationale should preserve public-safe causal-chain reasoning"
  );
  assert.match(
    proposal.decisionRationale?.assumptionAuditLine ?? "",
    /前提审计|前提|假设|依赖|不能假设|只假设|公开|身份|票型|发言|回应|证据|理由|压力|自洽/,
    "nomination decision rationale should preserve public-safe assumption-audit reasoning"
  );
  assert.match(
    proposal.decisionRationale?.mechanicSensitivityLine ?? "",
    /机制敏感性|机制|公开|身份|票型|发言|回应|证据|理由|死亡|保护|登记|醉毒|提名|处决|能力|信息|复核|压力/,
    "nomination decision rationale should preserve public-safe BOTC mechanic sensitivity"
  );
  assert.match(
    proposal.decisionRationale?.roleHypothesisLine ?? "",
    /角色假说|好身份|坏身份|伪装|身份线|自洽|分支|能力|口径|票型|公开|解释|断点|压力/,
    "nomination decision rationale should preserve public-safe role-hypothesis reasoning"
  );
  assert.equal(
    proposal.decisionRationale?.comparisonTrace?.publicOnly,
    true,
    "nomination comparison trace should stay public-safe"
  );
  assert.ok(
    proposal.decisionRationale?.comparisonTrace?.summary?.includes(proposal.decisionRationale.runnerUpName),
    "nomination comparison trace should preserve the runner-up reasoning summary"
  );
  assert.ok(
    proposal.reason.includes(proposal.decisionRationale.spokenLine),
    "nomination reason should use the same spoken comparison line stored in decision rationale"
  );
  assert.ok(
    proposal.reason.includes(proposal.decisionRationale.runnerUpName),
    "nomination reason should mention the runner-up comparison, not only store it as metadata"
  );
  assert.match(
    proposal.reason,
    /不是放过|不是放掉|不是清掉|压力更集中|差距不大|排在|放在|放前面|先放主线|先验|后手位|更成组|更集中|重排/,
    "nomination reason should verbalize why this nominee outranks the runner-up"
  );
  assert.match(
    proposal.reason,
    /票面|门槛|压力测试|愿意跟|推进|空过|执行信息|站边|跟票/,
    "nomination reason should verbalize strategy timing or vote-support context"
  );
  assert.equal(proposal.strategyRationale?.kind, "nomination-strategy-rationale");
  assert.ok(proposal.strategyRationale?.line, "nomination proposal should expose structured strategy rationale");
  assert.equal(
    proposal.reason.includes(proposal.strategyRationale.line),
    true,
    "nomination reason should stay in sync with structured strategy rationale"
  );
  assert.ok(
    ["pressure-test", "coalition-check", "execution-push", "avoid-no-execution", "execution-info", "public-reason-flow", "information-check"].includes(
      proposal.strategyRationale.displayIntent
    ),
    "strategy rationale should expose a public-safe display intent"
  );
  assert.ok(
    proposal.reason.includes(proposal.evidenceContract.text) ||
      proposal.reason.includes(proposal.evidenceContract.spokenText),
    "nomination reason should include contract text or player-style spoken summary"
  );
}

function testNominationDoesNotUseOtherAgentPrivateNightInfo() {
  const state = makeTBState();
  advanceDayStage(state, "public");
  advanceDayStage(state, "nomination");

  const nominator = state.players.find((player) => !player.isHuman && player.team === "good" && player.alive);
  const infoHolder = state.players.find(
    (player) => !player.isHuman && player.alive && player.id !== nominator?.id
  );
  const nominee = state.players.find(
    (player) => !player.isHuman && player.alive && player.id !== nominator?.id && player.id !== infoHolder?.id
  );
  assert.ok(nominator, "expected good AI nominator");
  assert.ok(infoHolder, "expected different AI info holder");
  assert.ok(nominee, "expected nominee");

  const secretMarker = "PRIVATE_NIGHT_SECRET_MARKER";
  recordPrivateInfoForAgent(state, infoHolder, `${secretMarker}: ${nominee.name} is evil`, {
    sourceRoleId: "empath",
    payload: { targetId: nominee.id },
  });
  addAgentObservation(state, nominator.id, {
    kind: "public-speech",
    source: "public-chat",
    private: false,
    text: "PUBLIC_NOMINATION_REASON: avoided the shared claim check.",
    payload: {
      speakerId: nominee.id,
      focusId: nominee.id,
    },
  });

  state.players
    .filter((player) => !player.isHuman)
    .forEach((player) => {
      player.nominatedToday = player.id !== nominator.id;
      state.players.forEach((target) => {
        player.suspicion[target.id] = 0.05;
      });
    });
  nominator.suspicion[nominee.id] = 0.95;

  const publicRows = getDialogueEvidenceForTarget(state, nominator, nominee.id, { publicOnly: true });
  const publicSummary = summarizeEvidenceForDialogue(state, nominator, nominee.id, { publicOnly: true });
  assert.doesNotMatch(
    JSON.stringify({ publicRows, publicSummary }),
    new RegExp(secretMarker),
    "public nomination evidence should not include another AI's private night info"
  );

  const proposal = chooseAINomination(state);
  assert.ok(proposal, "expected nomination proposal");
  assert.equal(proposal.nominatorId, nominator.id, "fixture should force the audited nominator");
  assert.equal(proposal.nomineeId, nominee.id, "fixture should force the audited nominee");
  assert.doesNotMatch(
    JSON.stringify(proposal),
    new RegExp(secretMarker),
    "nomination proposal should not quote another AI's private night info"
  );
}

function testPublicNominationRankingIgnoresPrivateOnlyEvidence() {
  const rng = fixedRng(2026060711);
  const state = createNewGame({ scriptId: "tb", playerCount: 9, preferredHumanRoleId: "washerwoman" }, rng);
  initializeAI(state);
  runNight(state, rng);
  initializeAI(state);
  advanceDayStage(state, "public");
  advanceDayStage(state, "nomination");
  state.day = 2;
  state.dayStageMeta.publicRounds = 1;

  const nominator = state.players.find((player) => !player.isHuman && player.team === "good" && player.alive);
  const privateOnlyTarget = state.players.find((player) => !player.isHuman && player.id !== nominator?.id && player.alive);
  const publicTarget = state.players.find(
    (player) => !player.isHuman && player.id !== nominator?.id && player.id !== privateOnlyTarget?.id && player.alive
  );
  assert.ok(nominator, "expected good AI nominator");
  assert.ok(privateOnlyTarget, "expected private-only target");
  assert.ok(publicTarget, "expected public-evidence target");

  state.players.forEach((player) => {
    player.nominatedToday = player.id !== nominator.id;
    player.beenNominatedToday = false;
    nominator.suspicion[player.id] = 0.01;
  });
  nominator.aiPersona = "steady";
  nominator.suspicion[privateOnlyTarget.id] = 0.56;
  nominator.suspicion[publicTarget.id] = 0.56;

  const agent = getAIAgent(state, nominator);
  agent.evidenceBook = [];
  agent.observations = [];
  addAgentObservation(state, nominator.id, {
    kind: "night-info",
    source: "storyteller",
    private: true,
    text: "PRIVATE_NOM_RANK_MARKER should not move public nomination rank",
    payload: { targetId: privateOnlyTarget.id },
  });
  addAgentObservation(state, nominator.id, {
    kind: "private-whisper",
    source: "private-chat",
    private: true,
    text: "PRIVATE_NOM_RANK_MARKER says execute this player",
    payload: { speakerId: publicTarget.id, targetId: nominator.id, focusId: privateOnlyTarget.id },
  });
  addAgentObservation(state, nominator.id, {
    kind: "public-speech",
    source: "public-chat",
    private: false,
    text: "PUBLIC_NOM_RANK_MARKER public contradiction",
    payload: { speakerId: publicTarget.id, focusId: publicTarget.id, polarity: "accuse" },
  });
  refreshAIBeliefs(state);
  assert.ok(
    nominator.suspicion[privateOnlyTarget.id] > nominator.suspicion[publicTarget.id],
    "fixture should prove private information can raise raw suspicion above the public target"
  );

  const proposal = chooseAINomination(state);
  assert.ok(proposal, "expected public nomination proposal");
  assert.equal(proposal.nominatorId, nominator.id, "fixture should leave only the audited nominator available");
  assert.equal(
    proposal.nomineeId,
    publicTarget.id,
    "public nomination ranking should prefer visible public evidence over private-only evidence"
  );
  assert.equal(proposal.evidenceCount, 1, "proposal should count only the visible public evidence");
  assert.doesNotMatch(
    JSON.stringify(proposal),
    /PRIVATE_NOM_RANK_MARKER/,
    "public nomination proposal should not serialize private-only ranking evidence"
  );
}

function testPublicAgentViewEvidenceCountDoesNotCountPrivateInfo() {
  const state = makeTBState();
  const viewer = state.players.find((player) => !player.isHuman && player.team === "good" && player.alive);
  const target = state.players.find((player) => !player.isHuman && player.alive && player.id !== viewer?.id);
  assert.ok(viewer, "expected good AI viewer");
  assert.ok(target, "expected target");

  const agent = getAIAgent(state, viewer);
  agent.evidenceBook = [];
  agent.observations = [];
  const marker = "HUMAN_ONLY_STYLE_PRIVATE_MARKER";
  recordPrivateInfoForAgent(state, viewer, `${marker}: ${target.name} looks evil`, {
    sourceRoleId: "empath",
    payload: { targetId: target.id },
  });

  const publicView = buildAgentView(state, viewer, { audience: "public", targetId: target.id });
  const privateView = buildAgentView(state, viewer, { audience: "private", targetId: target.id });
  assert.equal(
    publicView.evidenceCountForTarget(target.id),
    0,
    "public agent view should not count private-only evidence as public nomination support"
  );
  assert.ok(
    privateView.evidenceCountForTarget(target.id) > 0,
    "private agent view should still count the viewer's own private evidence"
  );
  assert.doesNotMatch(
    JSON.stringify(publicView.summariesForTarget(target.id)),
    new RegExp(marker),
    "public summaries should not quote private-only information"
  );

  state.players.forEach((player) => {
    viewer.suspicion[player.id] = player.id === target.id ? 0.95 : 0.01;
  });
  const publicCandidates = buildLightweightWorldCandidates(state, viewer, {
    audience: "public",
    agentView: publicView,
  });
  const publicTargetCandidate = publicCandidates.candidates.find((entry) => entry.targetId === target.id);
  assert.ok(publicTargetCandidate, "fixture should keep the private-info target visible in public candidates");
  assert.equal(
    publicTargetCandidate.publicEvidenceCount,
    0,
    "public world candidates should not count private evidence as public support"
  );
  assert.equal(
    publicTargetCandidate.totalEvidenceCount,
    0,
    "public world candidates should not let private evidence inflate total support"
  );
  assert.equal(
    publicTargetCandidate.reasons.includes("private-visible-evidence"),
    false,
    "public world candidates should not expose a private-evidence reason"
  );
  assert.doesNotMatch(
    JSON.stringify(publicTargetCandidate),
    new RegExp(marker),
    "public world candidates should not serialize private-only information"
  );

  const privateCandidates = buildLightweightWorldCandidates(state, viewer, {
    audience: "private",
    agentView: privateView,
  });
  const privateTargetCandidate = privateCandidates.candidates.find((entry) => entry.targetId === target.id);
  assert.ok(
    privateTargetCandidate?.totalEvidenceCount > 0,
    "private world candidates should still count the viewer's own private evidence"
  );
}

function testPublicDiscussionAddsTableTalkCadence() {
  const state = makeTBState();
  advanceDayStage(state, "public");

  runAIDiscussion(state, fixedRng(4545));
  const firstRoundCount = state.events.speeches.filter((entry) => !entry.private).length;
  runAIDiscussion(state, fixedRng(4546));
  const secondRoundSpeeches = state.events.speeches.filter((entry) => !entry.private).slice(firstRoundCount);

  assert.ok(secondRoundSpeeches.length > 0, "expected second public discussion round speeches");
  assert.ok(
    secondRoundSpeeches.some((entry) => /我的意思是|换句话说|先说清楚/.test(entry.line)),
    "round-two public speech should include table-talk cadence markers"
  );
}

function testFirstPublicDiscussionDoesNotInventPreviousLine() {
  const state = makeTBState();
  advanceDayStage(state, "public");

  runAIDiscussion(state, fixedRng(20260532));
  const publicText = state.events.speeches
    .filter((entry) => !entry.private && entry.day === state.day)
    .map((entry) => entry.line ?? "")
    .join("\n");

  assert.doesNotMatch(
    publicText,
    /接前面一句|我接一下前面的发言/,
    "first visible public discussion should not claim it is continuing an unseen previous sentence"
  );
}

function testPublicDiscussionUsesUnifiedEvidenceContract() {
  const state = makeTBState();
  advanceDayStage(state, "public");

  runAIDiscussion(state, fixedRng(4646));
  const focused = state.events.speeches.filter((entry) => !entry.private && entry.focusId && entry.evidenceContract);

  assert.ok(focused.length > 0, "public discussion should attach evidence contracts to focused speeches");
  const rationaleSpeeches = focused.filter((entry) => entry.decisionRationale);
  assert.ok(rationaleSpeeches.length > 0, "public discussion should attach decision rationales to focused speeches");
  rationaleSpeeches.forEach((entry) => {
    assert.equal(entry.decisionRationale.kind, "decision-rationale");
    assert.equal(entry.decisionRationale.audience, "public");
    assert.equal(entry.decisionRationale.publicOnly, true);
    assert.equal(entry.decisionRationale.focusId, entry.focusId);
    assert.ok(entry.decisionRationale.runnerUpId, "public decision rationale should retain runner-up target");
    assert.ok(entry.decisionRationale.spokenLine, "public decision rationale should capture the final spoken sentence");
    assert.ok(
      entry.line.includes(entry.decisionRationale.spokenLine),
      "public decision rationale spokenLine should be copied from the final public speech"
    );
    const timelineEntry = state.aiDialogue.timeline.find(
      (timeline) => timeline.mode === "public" && timeline.speakerId === entry.playerId && timeline.text === entry.line
    );
    assert.equal(
      timelineEntry?.decisionRationale?.spokenLine,
      entry.decisionRationale.spokenLine,
      "public timeline should keep the same decision rationale spokenLine"
    );
  });
  focused.forEach((entry) => {
    const contract = entry.evidenceContract;
    const normalizeEvidenceSpeech = (text) =>
      `${text ?? ""}`
        .replaceAll("…", "...")
        .replace(/卡点是：/g, "我卡在这儿：")
        .replace(/（先(?:再)?对一下）|（先复核）/g, "")
        .replace(/复核|再对一下|对一下/g, "对一下")
        .replace(/(\d+)\s+号/g, "$1号")
        .replace(/\s+/g, " ")
        .trim();
    const normalizedLine = normalizeEvidenceSpeech(entry.line);
    const containsContractSummary = contract.summaries.some((summary) => {
      const normalizedSummary = normalizeEvidenceSpeech(summary);
      const summaryBody = normalizedSummary.split(/[：:]/).pop() ?? normalizedSummary;
      return (
        normalizedLine.includes(normalizedSummary) ||
        normalizedLine.includes(summaryBody.slice(0, 12)) ||
        (summaryBody.length >= 4 && normalizedLine.includes(summaryBody.slice(0, 2)))
      );
    });
    const containsEvidenceCue = /前面发言没讲清楚|还缺解释|听回应|解释和票型|身份要对|公开线索更多/.test(normalizedLine);
    assert.equal(contract.publicOnly, true, "public speech evidence contract should be public-only");
    assert.ok(contract.text, "public speech evidence contract should include text");
    if (contract.hasEvidence) {
      assert.ok(
        containsContractSummary ||
          (contract.spokenText && normalizedLine.includes(normalizeEvidenceSpeech(contract.spokenText))) ||
          containsEvidenceCue,
        "public speech should quote a contract evidence summary or player-style spoken summary"
      );
    } else {
      assert.ok(
        normalizedLine.includes(normalizeEvidenceSpeech(contract.text)) ||
          (contract.spokenText && normalizedLine.includes(normalizeEvidenceSpeech(contract.spokenText))) ||
          /证据还弱|追问入口|不当定罪|证据还薄|先听回应|听回应|票型/.test(normalizedLine),
        "public low-evidence speech should include the contract fallback or spoken summary"
      );
    }
  });
}

function testPublicDialogueActsRenderPersonaSpeech() {
  const state = makeTBState();
  advanceDayStage(state, "public");

  const pressure = state.players.find((player) => !player.isHuman && player.team === "good");
  const shadow = state.players.find(
    (player) => !player.isHuman && player.team === "good" && player.id !== pressure.id
  );
  const target = state.players.find(
    (player) => !player.isHuman && player.id !== pressure.id && player.id !== shadow.id && player.alive
  );

  assert.ok(pressure, "expected pressure AI");
  assert.ok(shadow, "expected shadow AI");
  assert.ok(target, "expected target AI");

  pressure.aiPersona = "pressure";
  shadow.aiPersona = "shadow";
  [pressure, shadow].forEach((speaker) => {
    speaker.dialogueBias = speaker.dialogueBias ?? {};
    speaker.dialogueBias[target.id] = 0.8;
    addAgentObservation(state, speaker.id, {
      kind: "public-speech",
      source: "public-chat",
      private: false,
      text: `${target.id} needs to explain the claim chain.`,
      payload: {
        speakerId: target.id,
        focusId: target.id,
        polarity: "accuse",
      },
    });
  });

  runAIDiscussion(state, fixedRng(20260517));
  const pressureLine = state.events.speeches.find((entry) => !entry.private && entry.playerId === pressure.id)?.line ?? "";
  const shadowLine = state.events.speeches.find((entry) => !entry.private && entry.playerId === shadow.id)?.line ?? "";

  assert.match(
    pressureLine,
    /先上压力|直接点|别散火力|先压|直接压|给压力|压到桌面上/,
    "pressure public speech should use forceful act wording"
  );
  assert.match(
    shadowLine,
    /不急着拍死|谁替|主线|站边|暗记|换句话说|给解释|观察位|压力线|留一格压力|先不放下|记一笔|同一方向|同向|对账|台面压力/,
    "shadow public speech should use pattern-aware wording"
  );
  assert.notEqual(pressureLine, shadowLine, "public dialogue acts should not collapse personas into the same style");
}

function testPublicChallengeResponseActUsesReplyWordingAndBudget() {
  const state = makeTBState();
  advanceDayStage(state, "public");

  runAIDiscussion(state, fixedRng(20260518));
  const defenseLine = state.events.speeches.find((entry) => !entry.private && entry.debateBeat === "defense")?.line ?? "";

  assert.ok(defenseLine, "expected a defense beat public line");
  assert.match(defenseLine, /回应|质疑|反问|不是在硬保|不是乱打/, "defense beat should use challenge-response wording");
  assert.ok(defenseLine.length <= 190, "public challenge-response line should respect public speech budget");
}

function testPublicNominationAndVoteIntentActsUseContextWording() {
  const state = makeTBState();
  advanceDayStage(state, "public");

  runAIDiscussion(state, fixedRng(20260520));
  const nominationLine =
    state.events.speeches.find((entry) => !entry.private && entry.debateBeat === "nomination-pressure")?.line ?? "";
  const voteLine = state.events.speeches.find((entry) => !entry.private && entry.debateBeat === "vote-intent")?.line ?? "";

  assert.ok(nominationLine, "expected nomination-pressure public line");
  assert.ok(voteLine, "expected vote-intent public line");
  assert.match(nominationLine, /提名|上台|流程压力|正式压力|提名前/, "nomination-pressure beat should use nomination context");
  assert.match(voteLine, /投票|票型|如果提|跟票|反票/, "vote-intent beat should use vote context");
  assert.ok(nominationLine.length <= 190, "nomination-pressure line should respect public budget");
  assert.ok(voteLine.length <= 190, "vote-intent line should respect public budget");
}

function testEvilPrivateClaimUsesPerformanceCorpusWithoutLeaks() {
  const state = makeTBState();
  const evilAI = state.players.find((player) => !player.isHuman && player.team === "evil");

  assert.ok(evilAI, "expected evil AI");

  const result = runPrivateWhisper(
    state,
    { targetId: evilAI.id, humanLine: "你是什么身份？", intentHint: "claim" },
    fixedRng(20260521)
  );

  assert.equal(result.ok, true, result.reason);
  assert.match(result.response, /身份|公开|我是|大概方向|方向聊/, "evil AI should use outward-facing cover wording");
  assert.doesNotMatch(result.response, /说法范围|口径范围|好人位上靠|低信息好人位/, "evil cover wording should not use internal table jargon");
  assert.doesNotMatch(
    result.response,
    /自己人|邪恶视角|真实身份|爪牙|恶魔伪装|当前可用伪装|魔典/,
    "evil performance to a good human must not leak evil-only language"
  );
}

function testEvilPublicSpeechUsesPerformanceCorpusWithoutLeaks() {
  const state = makeTBState();
  advanceDayStage(state, "public");

  const evilAI = state.players.find((player) => !player.isHuman && player.team === "evil" && player.alive);
  const target = state.players.find((player) => !player.isHuman && player.team === "good" && player.alive);

  assert.ok(evilAI, "expected evil AI");
  assert.ok(target, "expected good target");

  evilAI.aiPersona = "steady";
  evilAI.dialogueBias = evilAI.dialogueBias ?? {};
  evilAI.dialogueBias[target.id] = 0.82;
  addAgentObservation(state, evilAI.id, {
    kind: "public-speech",
    source: "public-chat",
    private: false,
    text: `${target.id} needs to explain the public claim.`,
    payload: {
      speakerId: target.id,
      focusId: target.id,
      polarity: "accuse",
    },
  });

  runAIDiscussion(state, fixedRng(20260522));
  const line = state.events.speeches.find((entry) => !entry.private && entry.playerId === evilAI.id)?.line ?? "";

  assert.ok(line, "expected evil public line");
  assert.match(line, /好人视角|台面上|公开说|节奏|解围|闭眼冲/, "evil public speech should use performance-corpus table wording");
  assert.doesNotMatch(line, /自己人|邪恶视角|真实身份|爪牙|恶魔伪装|当前可用伪装|魔典/, "evil public speech must not leak evil-only language");
}

function testEvilNominationUsesPerformanceCorpusWithoutLeaks() {
  const state = makeTBState();
  advanceDayStage(state, "public");
  advanceDayStage(state, "nomination");

  const evilAI = state.players.find((player) => !player.isHuman && player.team === "evil" && player.alive);
  const target = state.players.find((player) => !player.isHuman && player.team === "good" && player.alive);
  const claimant = state.players.find(
    (player) => !player.isHuman && player.team === "good" && player.id !== target.id && player.alive
  );

  assert.ok(evilAI, "expected evil AI");
  assert.ok(target, "expected good target");
  assert.ok(claimant, "expected second good claimant");

  state.players
    .filter((player) => !player.isHuman && player.id !== evilAI.id)
    .forEach((player) => {
      player.nominatedToday = true;
    });
  evilAI.aiPersona = "steady";
  evilAI.dialogueBias = evilAI.dialogueBias ?? {};
  evilAI.dialogueBias[target.id] = 0.58;

  [target, claimant].forEach((player) => {
    const claim = {
      day: state.day,
      playerId: player.id,
      roleId: "washerwoman",
      private: false,
    };
    state.events.claims.push(claim);
    recordPublicClaimForAgents(state, claim);
  });

  const proposal = chooseAINomination(state);
  assert.ok(proposal, "expected evil nomination proposal");
  assert.equal(proposal.nominatorId, evilAI.id, "evil AI should be the only available nominator");
  assert.match(proposal.reason, /台面理由|上台讲清楚|放进流程/, "evil nomination should use outward-facing performance wording");
  assert.equal(proposal.strategyRationale?.kind, "nomination-strategy-rationale");
  assert.doesNotMatch(
    `${proposal.strategyRationale?.displayIntent ?? ""} ${proposal.strategyRationale?.line ?? ""}`,
    /evil|framing|sacrifice|protective|魔典|爪牙|恶魔/,
    "public strategy rationale must not expose evil-only nomination intent"
  );
  assert.doesNotMatch(
    proposal.reason,
    /自己人|邪恶视角|真实身份|爪牙|恶魔伪装|当前可用伪装|魔典/,
    "evil nomination reason must not leak evil-only language"
  );
}

function testPrivateStatementMemoryKeepsFollowUpOnSameLine() {
  const state = makeTBState();
  const observer = state.players.find((player) => !player.isHuman && player.team === "good");
  const suspect = state.players.find((player) => !player.isHuman && player.id !== observer.id && player.alive);

  assert.ok(observer, "expected observer AI");
  assert.ok(suspect, "expected suspect AI");

  addAgentObservation(state, observer.id, {
    kind: "public-speech",
    source: "public-chat",
    private: false,
    text: "I would execute this player.",
    payload: {
      speakerId: suspect.id,
      focusId: suspect.id,
    },
  });

  const first = runPrivateWhisper(
    state,
    { targetId: observer.id, humanLine: `why do you suspect ${suspect.name}?`, intentHint: "reason" },
    fixedRng(6060)
  );
  const second = runPrivateWhisper(
    state,
    { targetId: observer.id, humanLine: `still why ${suspect.name}?`, intentHint: "reason" },
    fixedRng(6061)
  );

  assert.equal(first.focusId, suspect.id, "first answer should focus the seeded suspect");
  assert.equal(second.focusId, suspect.id, "follow-up should keep the same focus when nothing changed");
  assert.match(second.response, /刚才那条线|还是围绕|暂时不换目标|还是先看/, "follow-up should explicitly connect to the previous line");
  const key = `${observer.id}::${state.players.find((player) => player.isHuman).id}`;
  assert.equal(
    state.aiDialogue.statementMemory.privateByPairKey[key].focusId,
    suspect.id,
    "private statement memory should store structured focus for that pair"
  );
  assert.equal(
    state.aiDialogue.statementMemory.privateByPairKey[key].consecutiveFocusCount,
    2,
    "private statement memory should track consecutive same-focus turns"
  );
  assert.ok(
    state.aiDialogue.statementMemory.privateByPairKey[key].recentTurns.length >= 2,
    "private statement memory should retain recent turn summaries"
  );
}

function testPrivateStatementMemoryExplainsExplicitFocusSwitch() {
  const state = makeTBState();
  const observer = state.players.find((player) => !player.isHuman && player.team === "good");
  const firstSuspect = state.players.find((player) => !player.isHuman && player.id !== observer.id && player.alive);
  const secondSuspect = state.players.find(
    (player) => !player.isHuman && player.id !== observer.id && player.id !== firstSuspect.id && player.alive
  );

  assert.ok(observer, "expected observer AI");
  assert.ok(firstSuspect, "expected first suspect");
  assert.ok(secondSuspect, "expected second suspect");

  addAgentObservation(state, observer.id, {
    kind: "public-speech",
    source: "public-chat",
    private: false,
    text: "I would execute this player.",
    payload: {
      speakerId: firstSuspect.id,
      focusId: firstSuspect.id,
    },
  });

  const first = runPrivateWhisper(
    state,
    { targetId: observer.id, humanLine: `why do you suspect ${firstSuspect.name}?`, intentHint: "reason" },
    fixedRng(6161)
  );
  const second = runPrivateWhisper(
    state,
    { targetId: observer.id, humanLine: `what about ${secondSuspect.name}?`, intentHint: "reason" },
    fixedRng(6162)
  );

  assert.equal(first.focusId, firstSuspect.id, "first answer should establish the first focus");
  assert.equal(second.focusId, secondSuspect.id, "explicitly mentioned target should become the new focus");
  assert.match(second.response, /我换到|明确问到|先放一边|你问到/, "focus switch should explain why the target changed");
  assert.match(second.response, /暂放一边|前面那条作废/, "focus switch should acknowledge the previous line instead of acting memoryless");
}

function testPublicStatementMemoryUsesRicherContinuityLine() {
  const state = makeTBState();
  advanceDayStage(state, "public");

  const speaker = state.players.find((player) => !player.isHuman && player.team === "good");
  const target = state.players.find((player) => !player.isHuman && player.id !== speaker.id && player.alive);

  assert.ok(speaker, "expected public speaker");
  assert.ok(target, "expected public target");

  speaker.dialogueBias = speaker.dialogueBias ?? {};
  speaker.dialogueBias[target.id] = 0.82;
  addAgentObservation(state, speaker.id, {
    kind: "public-speech",
    source: "public-chat",
    private: false,
    text: `${target.id} needs to answer the role conflict.`,
    payload: {
      speakerId: target.id,
      focusId: target.id,
      polarity: "accuse",
    },
  });

  runAIDiscussion(state, fixedRng(20260523));
  const before = state.events.speeches.length;
  runAIDiscussion(state, fixedRng(20260524));
  const secondLine = state.events.speeches
    .slice(before)
    .find((entry) => !entry.private && entry.playerId === speaker.id)?.line ?? "";
  const memory = state.aiDialogue.statementMemory.publicBySpeakerId[speaker.id];

  assert.ok(secondLine, "expected second public line from the same speaker");
  assert.match(secondLine, /公开.*先不换|上一轮(?:卡点|过不去)|还是围绕/, "public continuation should refer to the previous public line");
  assert.equal(memory.focusId, target.id, "public memory should stay on the seeded target");
  assert.ok(memory.consecutiveFocusCount >= 2, "public memory should track consecutive same-focus turns");
  assert.ok(memory.recentTurns.length >= 2, "public memory should keep recent turn summaries");
}

function testAIToAIStatementMemoryIsParticipantScoped() {
  const state = makeTBState();
  const messages = runAIToAIPrivateWhispers(state, fixedRng(6262));
  assert.ok(messages.length > 0, "expected AI-AI private whisper");

  const first = messages[0];
  const pairKey = `${first.speakerId}::${first.targetId}`;
  const unrelated = state.players.find(
    (player) => !player.isHuman && player.id !== first.speakerId && player.id !== first.targetId
  );

  assert.ok(state.aiDialogue.statementMemory.privateByPairKey[pairKey], "speaker-target pair should get private memory");
  assert.ok(unrelated, "expected unrelated AI");
  assert.ok(
    Object.keys(state.aiDialogue.statementMemory.privateByPairKey).every((key) => !key.includes(unrelated.id)),
    "unrelated AI should not receive AI-AI private statement memory"
  );
}

function testPrivateClaimStatementMemoryPreventsUnexplainedClaimFlip() {
  const state = makeTBState();
  const target = state.players.find((player) => !player.isHuman);
  const human = state.players.find((player) => player.isHuman);
  assert.ok(target, "expected private whisper target");
  assert.ok(human, "expected human");

  target.alive = false;
  const first = runPrivateWhisper(
    state,
    { targetId: target.id, humanLine: "claim role", intentHint: "claim" },
    fixedRng(6363)
  );
  const firstClaim = target.publicClaimRoleId;
  const second = runPrivateWhisper(
    state,
    { targetId: target.id, humanLine: "claim again", intentHint: "claim" },
    fixedRng(6364)
  );

  assert.ok(first.ok && second.ok, "claim follow-ups should succeed");
  assert.ok(firstClaim, "first claim should establish a role claim");
  assert.equal(target.publicClaimRoleId, firstClaim, "claim role should not flip on repeat question");
  assert.equal(second.claimDisclosureRationale?.continuity, "hold", "repeat claim should be classified as holding the same identity line");
  assert.ok(second.claimDisclosureRationale?.continuityLine, "repeat claim should carry a readable continuity explanation");
  assert.match(second.response, /我这次还是说自己是|还是/, "second claim should explicitly preserve the previous claim");
}

function testAIInsightRowsPreserveStatementMemory() {
  const state = makeTBState();
  const observer = state.players.find((player) => !player.isHuman);
  assert.ok(observer, "expected observer AI");

  const result = runPrivateWhisper(
    state,
    { targetId: observer.id, humanLine: "why do you suspect someone?", intentHint: "reason" },
    fixedRng(6464)
  );
  assert.ok(result.ok, "private whisper should establish statement memory");

  const before = JSON.stringify(state.aiDialogue.statementMemory);
  getAIInsightRows(state);
  const after = JSON.stringify(state.aiDialogue.statementMemory);
  assert.equal(after, before, "AI insight rows should not mutate statement memory");
}

function testEvilPrivateNotesDoNotLeakToGoodProactiveWhisper() {
  const state = makeTBState();
  const human = state.players.find((player) => player.isHuman);
  const evilAI = state.players.find((player) => !player.isHuman && player.team === "evil");

  assert.ok(human, "expected human player");
  assert.ok(evilAI, "expected an evil AI");
  assert.equal(human.team, "good", "fixture should keep human on good team");

  evilAI.alive = false;
  evilAI.privateNotes.push("[第1夜] 邪恶互认：你的爪牙是 3号。");
  evilAI.privateNotes.push("[第1夜] 恶魔伪装（不在场）：厨师 / 共情者 / 送葬者。");
  evilAI.privateNotes.push("[第1夜] 间谍查看了魔典。");

  const messages = runAIProactiveWhispers(state, fixedRng(777));
  assert.ok(messages.length > 0, "dead evil AI should be able to initiate a proactive whisper");

  const text = messages.map((entry) => entry.response).join("\n");
  assert.doesNotMatch(text, /邪恶互认|恶魔伪装|魔典|你的爪牙|不在场/, "evil-only private notes must not leak to a good human");
}

function testClaimDisclosurePlannerRangesHighSignatureOnDayOne() {
  const state = makeTBState();
  const human = state.players.find((player) => player.isHuman);
  const empath = state.players.find((player) => !player.isHuman && player.team === "good");
  assert.ok(human && empath, "expected human and good AI");

  empath.roleId = "empath";
  empath.category = "townsfolk";
  empath.publicClaimRoleId = null;
  empath.privateNotes.push("[第1夜] 你得知：你的两侧存活邻居中有 1 位邪恶。");
  state.events.infoPings.push({
    night: 1,
    actorId: empath.id,
    type: "empath",
    truth: 1,
    shown: 1,
    polluted: false,
    text: "[第1夜] 你得知：你的两侧存活邻居中有 1 位邪恶。",
  });

  const plan = claimDisclosurePlanner(state, empath, human, fixedRng(101), {
    private: true,
    audience: "private",
    intent: "night",
    infoPing: state.events.infoPings.at(-1),
    trustScore: 0.5,
  });
  assert.equal(plan.level, "range", "day-one recurring high-signature info should range-claim before hard-claiming");
  assert.equal(plan.claimDisclosureRationale?.continuity, "new", "first disclosure plan should start a new claim line");
  rememberClaimDisclosure(state, empath, plan, human, { private: true, audience: "private" });

  state.day = 3;
  const hardPlan = claimDisclosurePlanner(state, empath, human, fixedRng(103), {
    private: true,
    audience: "private",
    intent: "claim",
    forceHard: true,
    trustScore: 0.5,
    previousDisclosure: getClaimDisclosureState(state, empath, human, { private: true, audience: "private" }),
  });
  assert.equal(hardPlan.level, "hard", "forced pressure plan should hard-claim after an earlier range");
  assert.equal(hardPlan.claimDisclosureRationale?.continuity, "escalate", "range-to-hard disclosure should be explicit escalation");
  assert.ok(hardPlan.claimDisclosureRationale?.continuityLine, "escalation should carry a readable continuity line");
  state.day = 1;

  advanceDayStage(state, "private");
  const result = runPrivateWhisper(
    state,
    {
      targetId: empath.id,
      humanLine: "你昨晚得到了什么信息？",
      intentHint: "night",
    },
    fixedRng(102)
  );
  assert.equal(result.ok, true, result.reason);
  assert.match(result.response, /邻座信息位|身份交出来|格式/, "response should acknowledge the implied role family");
  assert.doesNotMatch(
    result.response,
    /两侧存活邻居中有\s*1\s*位邪恶(?!.*(共情者|邻座信息位))/,
    "AI should not leak exact Empath-format info while pretending it has not exposed a role"
  );
}

function testClaimDisclosurePlannerHardClaimsUnderPressure() {
  const state = makeTBState();
  const human = state.players.find((player) => player.isHuman);
  const empath = state.players.find((player) => !player.isHuman && player.team === "good");
  assert.ok(human && empath, "expected human and good AI");

  state.day = 3;
  empath.roleId = "empath";
  empath.category = "townsfolk";
  empath.publicClaimRoleId = null;
  empath.suspicion[empath.id] = 0.78;
  const infoPing = {
    night: 2,
    actorId: empath.id,
    type: "empath",
    truth: 1,
    shown: 1,
    polluted: false,
    text: "[第2夜] 你得知：你的两侧存活邻居中有 1 位邪恶。",
  };

  const plan = claimDisclosurePlanner(state, empath, human, fixedRng(103), {
    private: true,
    audience: "private",
    intent: "night",
    infoPing,
    trustScore: 0.5,
  });
  assert.equal(plan.level, "hard", "late/high-pressure recurring info should hard-claim");
}

function testClaimDisclosurePlannerExplainsHardClaimRevision() {
  const state = makeTBState();
  const human = state.players.find((player) => player.isHuman);
  const aiPlayer = state.players.find((player) => !player.isHuman && player.team === "good");
  assert.ok(human && aiPlayer, "expected human and good AI");

  const plan = claimDisclosurePlanner(state, aiPlayer, human, fixedRng(104), {
    private: true,
    audience: "private",
    intent: "claim",
    forceHard: true,
    roleId: "ravenkeeper",
    previousDisclosure: {
      level: "hard",
      roleId: "saint",
      roleName: "圣徒",
      channel: `private:${human.id}`,
    },
  });

  const rationale = plan.claimDisclosureRationale;
  assert.equal(rationale?.continuity, "revise", "hard-claim role change should be classified as a revision");
  assert.equal(rationale?.previousRoleId, "saint", "revision metadata should keep the previous hard claim role id");
  assert.equal(rationale?.roleId, "ravenkeeper", "revision metadata should keep the current hard claim role id");
  assert.ok(rationale?.previousRoleName, "revision metadata should keep the previous hard claim role name");
  assert.ok(rationale?.roleName, "revision metadata should keep the current hard claim role name");
  assert.ok(rationale?.continuitySummary?.includes("->"), "revision summary should show previous -> current claim movement");
  assert.ok(rationale?.continuityLine, "revision should carry a readable continuity explanation");
}

function testClaimDisclosureMemoryKeepsRangeOnFollowUp() {
  const state = makeTBState();
  const human = state.players.find((player) => player.isHuman);
  const empath = state.players.find((player) => !player.isHuman && player.team === "good");
  assert.ok(human && empath, "expected human and good AI");

  empath.roleId = "empath";
  empath.category = "townsfolk";
  empath.publicClaimRoleId = null;
  empath.privateNotes = ["[第1夜] 你得知：你的两侧存活邻居中有 1 位邪恶。"];
  state.events.infoPings.push({
    night: 1,
    actorId: empath.id,
    type: "empath",
    truth: 1,
    shown: 1,
    polluted: false,
    text: empath.privateNotes[0],
  });
  advanceDayStage(state, "private");

  const night = runPrivateWhisper(
    state,
    { targetId: empath.id, humanLine: "你昨晚得到了什么信息？", intentHint: "night" },
    fixedRng(104)
  );
  assert.equal(night.ok, true, night.reason);
  assert.match(night.response, /邻座信息位|身份交出来|格式/, "first answer should range-disclose high-signature info");

  const memory = getClaimDisclosureState(state, empath, human, { private: true, audience: "private" });
  assert.equal(memory?.level, "range", "range disclosure should be remembered for the same private listener");

  const claim = runPrivateWhisper(
    state,
    { targetId: empath.id, humanLine: "那你到底是什么身份？", intentHint: "claim" },
    fixedRng(105)
  );
  assert.equal(claim.ok, true, claim.reason);
  assert.match(claim.response, /刚才|范围|邻座信息位|身份/, "claim follow-up should continue the previous disclosure line");
  assert.doesNotMatch(claim.response, /不是空白位|身份细节另说/, "claim follow-up should not downgrade to generic non-answer");
}

function testClaimDisclosureMemoryDoesNotDowngradeAfterHardClaim() {
  const state = makeTBState();
  const human = state.players.find((player) => player.isHuman);
  const empath = state.players.find((player) => !player.isHuman && player.team === "good");
  assert.ok(human && empath, "expected human and good AI");

  state.day = 3;
  empath.roleId = "empath";
  empath.category = "townsfolk";
  empath.publicClaimRoleId = null;
  empath.suspicion[empath.id] = 0.8;
  empath.privateNotes = ["[第2夜] 你得知：你的两侧存活邻居中有 1 位邪恶。"];
  state.events.infoPings.push({
    night: 2,
    actorId: empath.id,
    type: "empath",
    truth: 1,
    shown: 1,
    polluted: false,
    text: empath.privateNotes[0],
  });
  advanceDayStage(state, "private");

  const first = runPrivateWhisper(
    state,
    { targetId: empath.id, humanLine: "你昨晚得到了什么信息？", intentHint: "night" },
    fixedRng(106)
  );
  assert.equal(first.ok, true, first.reason);
  assert.match(first.response, /身份直接摊：共情者|我是\s*共情者|我是 共情者/, "high-pressure answer should hard-claim");

  empath.suspicion[empath.id] = 0.2;
  const plan = claimDisclosurePlanner(state, empath, human, fixedRng(107), {
    private: true,
    audience: "private",
    intent: "night",
    infoPing: state.events.infoPings.at(-1),
    trustScore: 0.5,
  });
  assert.equal(plan.level, "hard", "planner should not downgrade after a hard claim in the same private channel");
}

[
  testLayeredSpeechCorpusResolvesByTeamPersonaAndAct,
  testEvilRecognitionIsAgentScoped,
  testFangGuJumpRefreshesAIEvilRecognition,
  testEvilAIVoteProtectsCurrentDemonAfterFangGuJump,
  testEvilWorldCandidatesNeverSacrificeCurrentDemon,
  testBarberSwapRefreshesAIAgentRoleAndEvilRecognition,
  testPrivateClaimsAreNotGlobal,
  testInsightRowsDoNotMutatePlayerBeliefs,
  testNightInfoBecomesPrivateObservation,
  testPublicDiscussionBecomesPublicObservations,
  testConversationClockStepUsesSoftClock,
  testPublicConversationStepsExposeProgressionWithoutInternalTerms,
  testPublicQuestionRoutesNextAIStepToAddressedTarget,
  testNominationDebateIsCreatedBeforeVote,
  testHumanNomineeDefenseFeedsImmediateAIVoteDecision,
  testDayOnePublicDiscussionDoesNotMassClaim,
  testDayOnePublicDiscussionHasAtLeastOneVisibleHardClaim,
  testPublicClaimIsVisibleInPublicSpeech,
  testClaimDisclosurePlannerBuildsPublicSafeRationale,
  testPublicClaimSpeechCarriesDisclosureRationale,
  testPrivateClaimAnswerCarriesDisclosureRationale,
  testThoughtFrameDrivesVisiblePublicClaim,
  testThoughtFrameQuestionFeedsPrivateFollowUp,
  testThoughtFrameQuestionFeedsPublicFollowUp,
  testPublicThoughtFrameUsesAgentViewEvidenceSummaries,
  testPublicDiscussionPriorityBudgetKeepsCoreSignals,
  testPublicSpeechRepairsHumanFollowUpCue,
  testRepeatedSpeechGetsDifferentiated,
  testPrivateTrustQuestionUsesActRenderer,
  testPrivateCompareQuestionUsesActRenderer,
  testScriptPressureProfileRecognizesOutsiderIncentives,
  testGoodDayStrategyRecognizesExecutionIncentives,
  testGoodAIProtectsPublicMayorFinalThreeNoExecutionWin,
  testGoodAIProtectsMastermindExtraDayNoExecutionWin,
  testGoodTwinAIPushesKnownEvilTwinExecutionWin,
  testGoodTwinAIRefusesKnownSelfExecutionLoss,
  testGoodAlignedEvilTwinAIPushesOpposingTwin,
  testLunaticAgentUsesPerceivedDemonKnowledge,
  testPrivateWhisperBecomesPrivateObservationOnlyForParticipant,
  testEvilAllyClaimQuestionRevealsRealAndBluffIdentity,
  testDeadAICanStillPrivateWhisper,
  testDeadPrivateWhisperUsesDeadContextAct,
  testDeadAICanStillJoinPublicDiscussion,
  testAIProactivelyWhispersWithoutConsumingHumanLimit,
  testAIProactiveWhisperCanBeQueuedAcceptedOrDeclined,
  testCrossDaySharedInfoMemorySuppressesRepeatedProactiveWhisper,
  testPrivateChatFollowUpsDoNotConsumeDailySlots,
  testDayStanceMemoryPersistsWithinDay,
  testCrossDayStanceHistoryFeedsPublicSpeech,
  testCrossDayStanceShiftExplainsCurrentEvidence,
  testCrossDayTargetSwitchFallbackIsPlayerVisible,
  testAIToAIPrivateWhisperWritesParticipantObservationsOnly,
  testDeadAIPublicDiscussionClaimsAggressively,
  testNominationAndVoteBecomePublicObservations,
  testAINominatorVotesForOwnNomination,
  testResolveNominationAcceptsDetailedAIVoteRationale,
  testAINominationCanPressureNominateWithLowEvidence,
  testEarlyAINominationDoesNotSpendLowEvidencePressureOnGoodHuman,
  testPublicStatementMemoryLowersVoteThresholdForOwnFocus,
  testDetailedAIVoteMatchesLegacyBooleanAndExplainsDecision,
  testPublicVoteRationaleEvidenceCountIgnoresPrivateInfo,
  testStrategyPersonaChangesVoteBehavior,
  testStrategyGameWindowChangesVoteRisk,
  testHumanPublicCaseNominationCanCarryEarlyVotePressure,
  testLateGameHumanNominationPressureCanCarryExecutionVote,
  testLateGameAINominationProjectsExecutableVote,
  testRepeatedNoExecutionPressureMakesBMRZombuulVoteExecutable,
  testEarlyFailedPressureBudgetStopsFifthLowImpactNomination,
  testGenericFailedPressureBudgetStopsFifthLowImpactNomination,
  testSnVFailedPressureBudgetAllowsExecutableMustExecuteNomination,
  testBMRNominationAvoidsRecentlyExecutedSurvivorWhenFreshTargetExists,
  testAIStopsAfterHighVoteExecutionCandidateIsNotSafelyOvertaken,
  testAINominationOvertakesCurrentExecutionCandidateWhenVotesExist,
  testAINominationDoesNotWasteNominationWhenItCannotOvertake,
  testEvilMinionDeflectsWhenDemonIsOnBlockAndVotesCanOvertake,
  testEvilMinionDoesNotWasteRescueNominationWhenDemonCannotBeOvertaken,
  testPublicStatementMemoryCanDriveNominationProposal,
  testObservationWritesEvidenceBook,
  testBeliefRefreshConsumesAgentObservations,
  testPrivateReasonUsesVisibleDialogueEvidence,
  testPrivateResponseUsesUnifiedEvidenceContract,
  testPrivateReasonUsesQuestionAnswerShape,
  testPrivateReasonContrastsTopTwoTargets,
  testPrivateReasonDoesNotDirectAddressThirdPartyFocus,
  testPrivateVoteUsesQuestionAnswerShape,
  testPrivateClaimQuestionAnswersClaimDirectly,
  testPrivateNightQuestionAnswersNightInfoDirectly,
  testShareableNightInfoUsesSpeakerPerspective,
  testVerifiableInfoQuestionRoutesToRoleFormat,
  testRepeatedNightQuestionGivesFortuneTellerFormatResult,
  testPrivateAnswerAlignmentContractCoversQuestionTypes,
  testPrivatePragmaticsEscalatesHighPressureTarget,
  testPublicPragmaticsHandlesOnBlockSpeaker,
  testPersonaDialogueActsRenderDistinctPrivateSpeech,
  testPhraseCooldownReducesRepeatedStockTerms,
  testConversationalPolishRemovesDebugLikePhrases,
  testSpeechBudgetLimitsLongDialogueText,
  testPublicSpeechBudgetPreservesPriorityFragments,
  testPrivateEvidenceDoesNotLeakIntoPublicSpeech,
  testGoodDialogueSummaryHidesDemonBluffs,
  testAgentViewHidesHiddenTruthForGoodViewer,
  testAgentViewAllowsLegalDemonPrivateKnowledge,
  testAgentViewPublicPrivateEvidenceBoundary,
  testKnowledgeGraphRecordsPublicClaimAndReveal,
  testKnowledgeGraphKeepsPrivateWhisperParticipantScoped,
  testKnowledgeGraphRecordsVoteEdgesAndStaysBounded,
  testKnowledgeGraphFalseClaimInfluencesPrivateReason,
  testKnowledgeGraphRoleConflictInfluencesPrivateReason,
  testKnowledgeGraphPublicDefenseOfHotTargetAddsPressure,
  testKnowledgeGraphPressureCanDriveNominationFocus,
  testEvilAIUsesKnowledgeGraphForFramingNomination,
  testEvilWorldPlanFramesNonAllyWhileProtectingAllies,
  testEvilTeamPlanCoordinatesNominationAcrossAllies,
  testEvilTeamPlanPivotsAfterFailedVoteResult,
  testEvilWorldPlanMaintainsSoftContinuityAcrossDays,
  testEvilWorldPlanCanPivotWhenPressureClearlyChanges,
  testAgentStrategyViewExposesLightweightWorldCandidates,
  testCoalitionVoteSimulationTracksLikelyVotes,
  testPublicVoteAndCoalitionIgnorePrivateOnlySuspicion,
  testNominationProposalCarriesStrategyWorldAndCoalitionMetadata,
  testEvilWorldPlanFeedsExpressionContextLine,
  testKnowledgeGraphContaminatedNightInfoHasLimitedPressure,
  testNightInfoContaminationMetadata,
  testFalseClaimLowersDynamicSourceTrust,
  testVerifiedClaimRaisesDynamicSourceTrust,
  testAbnormalVoteLowersDynamicSourceTrust,
  testMisexecutionOutcomeRedirectsNextDayNomination,
  testDialogueEvidenceOrderingAndNominationReason,
  testNominationUsesUnifiedEvidenceContract,
  testNominationDoesNotUseOtherAgentPrivateNightInfo,
  testPublicNominationRankingIgnoresPrivateOnlyEvidence,
  testPublicAgentViewEvidenceCountDoesNotCountPrivateInfo,
  testPublicDiscussionAddsTableTalkCadence,
  testFirstPublicDiscussionDoesNotInventPreviousLine,
  testPublicDiscussionUsesUnifiedEvidenceContract,
  testPublicDialogueActsRenderPersonaSpeech,
  testPublicChallengeResponseActUsesReplyWordingAndBudget,
  testPublicNominationAndVoteIntentActsUseContextWording,
  testEvilPrivateClaimUsesPerformanceCorpusWithoutLeaks,
  testEvilPublicSpeechUsesPerformanceCorpusWithoutLeaks,
  testEvilNominationUsesPerformanceCorpusWithoutLeaks,
  testPrivateStatementMemoryKeepsFollowUpOnSameLine,
  testPrivateStatementMemoryExplainsExplicitFocusSwitch,
  testPublicStatementMemoryUsesRicherContinuityLine,
  testAIToAIStatementMemoryIsParticipantScoped,
  testPrivateClaimStatementMemoryPreventsUnexplainedClaimFlip,
  testAIInsightRowsPreserveStatementMemory,
  testEvilPrivateNotesDoNotLeakToGoodProactiveWhisper,
  testClaimDisclosurePlannerRangesHighSignatureOnDayOne,
  testClaimDisclosurePlannerHardClaimsUnderPressure,
  testClaimDisclosurePlannerExplainsHardClaimRevision,
  testClaimDisclosureMemoryKeepsRangeOnFollowUp,
  testClaimDisclosureMemoryDoesNotDowngradeAfterHardClaim,
].forEach((test) => test());

console.log("ai agent contracts ok");
