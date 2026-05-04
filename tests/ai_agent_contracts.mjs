import assert from "node:assert/strict";

import {
  advanceDayStage,
  createNewGame,
  markPublicDiscussionRound,
  resolveNominationAndVote,
  runNight,
} from "../scripts/engine.js";
import {
  chooseAINomination,
  getAIScriptPressureProfile,
  getAIInsightRows,
  initializeAI,
  refreshAIBeliefs,
  runAIDiscussion,
  runPrivateWhisper,
} from "../scripts/ai.js";
import {
  addAgentObservation,
  getAgentEvidence,
  getAIAgent,
  getKnownBluffRoleIds,
  getSuspicionTrailForTarget,
  getVisibleClaims,
} from "../scripts/ai_agents.js";

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

function testDayOnePublicDiscussionDoesNotMassClaim() {
  const state = makeTBState();
  const result = advanceDayStage(state, "public");
  assert.equal(result.ok, true, result.reason);
  runAIDiscussion(state, fixedRng(444));

  const aiCount = state.players.filter((player) => !player.isHuman).length;
  const publicClaims = (state.events.claims ?? []).filter((claim) => !claim.private && claim.day === state.day);
  assert.ok(publicClaims.length < aiCount, "day one public discussion should not make every AI hard-claim");

  const softDisclosure = (state.events.speeches ?? []).some(
    (speech) =>
      !speech.private &&
      /有一点早期信息|低信息量位置|偏外来者|不建议今天逼强功能位|不摊身份|全跳身份|不是强信息位/.test(speech.line ?? "")
  );
  assert.ok(softDisclosure, "day one public discussion should allow soft role/info disclosure without hard-claiming");
}

function testScriptPressureProfileRecognizesOutsiderIncentives() {
  const tb = createNewGame({ scriptId: "tb", playerCount: 9, preferredHumanRoleId: "washerwoman" }, fixedRng());
  const bmr = createNewGame({ scriptId: "bmr", playerCount: 9, preferredHumanRoleId: "grandmother" }, fixedRng());
  const snv = createNewGame({ scriptId: "snv", playerCount: 9, preferredHumanRoleId: "clockmaker" }, fixedRng());

  assert.equal(getAIScriptPressureProfile(tb).outsiderClaimsPlausible, true, "TB should account for Baron/Drunk outsider ambiguity");
  assert.equal(getAIScriptPressureProfile(bmr).outsiderClaimsRisky, true, "BMR should account for Godfather outsider pressure");
  assert.equal(getAIScriptPressureProfile(snv).outsiderBluffsValuable, true, "SnV should account for Fang Gu outsider bluff value");
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
      assert.ok(
        evidenceKinds(state, player, "vote").every((entry) => entry.source === "public-procedure" && !entry.canBeFalse),
        `${player.name} should store vote evidence as reliable public procedure`
      );
    });
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
  assert.ok(proposal.reason.includes("压力提名"), "pressure nomination should explain its intent");

  const nominee = state.players.find((player) => player.id === proposal.nomineeId);
  const nominator = state.players.find((player) => player.id === proposal.nominatorId);
  assert.ok(nominee?.alive, "AI should not nominate a dead player");
  assert.ok(nominator?.alive, "AI should use a living nominator");
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

[
  testEvilRecognitionIsAgentScoped,
  testPrivateClaimsAreNotGlobal,
  testInsightRowsDoNotMutatePlayerBeliefs,
  testNightInfoBecomesPrivateObservation,
  testPublicDiscussionBecomesPublicObservations,
  testDayOnePublicDiscussionDoesNotMassClaim,
  testScriptPressureProfileRecognizesOutsiderIncentives,
  testLunaticAgentUsesPerceivedDemonKnowledge,
  testPrivateWhisperBecomesPrivateObservationOnlyForParticipant,
  testDeadAICanStillPrivateWhisper,
  testDeadAICanStillJoinPublicDiscussion,
  testNominationAndVoteBecomePublicObservations,
  testAINominationCanPressureNominateWithLowEvidence,
  testObservationWritesEvidenceBook,
  testBeliefRefreshConsumesAgentObservations,
].forEach((test) => test());

console.log("ai agent contracts ok");
