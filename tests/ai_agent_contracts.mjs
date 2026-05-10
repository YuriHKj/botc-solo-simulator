import assert from "node:assert/strict";

import {
  advanceDayStage,
  createNewGame,
  markPublicDiscussionRound,
  privateChatLimitForDay,
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
  runAIToAIPrivateWhispers,
  runAIProactiveWhispers,
  runPrivateWhisper,
} from "../scripts/ai.js";
import {
  addAgentObservation,
  assertNoHiddenInfoLeakForDialogue,
  getAgentEvidence,
  getAIAgent,
  getDialogueEvidenceForTarget,
  getKnownBluffRoleIds,
  getSuspicionTrailForTarget,
  getVisibleClaims,
  recordPrivateInfoForAgent,
  summarizeEvidenceForDialogue,
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
    "human event log should only show redacted AI-AI private activity"
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

  assert.ok(result.response.includes(summary), "private reason should cite visible evidence summary");
  assert.match(
    result.response,
    /我换个说法|说白了|先说清楚|换句话说/,
    "private reason should include a human cadence bridge instead of reading like a flat report"
  );
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
    proposal.reason.includes("压力提名") || proposal.reason.includes("自动提名"),
    "nomination reason should explicitly mark evidence-backed or pressure intent"
  );
  assert.ok(
    proposal.evidenceSummary || proposal.reason.includes("压力提名"),
    "nomination proposal should carry evidence summary or mark low-evidence pressure"
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
  testEvilAllyClaimQuestionRevealsRealAndBluffIdentity,
  testDeadAICanStillPrivateWhisper,
  testDeadAICanStillJoinPublicDiscussion,
  testAIProactivelyWhispersWithoutConsumingHumanLimit,
  testPrivateChatFollowUpsDoNotConsumeDailySlots,
  testDayStanceMemoryPersistsWithinDay,
  testAIToAIPrivateWhisperWritesParticipantObservationsOnly,
  testDeadAIPublicDiscussionClaimsAggressively,
  testNominationAndVoteBecomePublicObservations,
  testAINominationCanPressureNominateWithLowEvidence,
  testObservationWritesEvidenceBook,
  testBeliefRefreshConsumesAgentObservations,
  testPrivateReasonUsesVisibleDialogueEvidence,
  testPrivateEvidenceDoesNotLeakIntoPublicSpeech,
  testGoodDialogueSummaryHidesDemonBluffs,
  testNightInfoContaminationMetadata,
  testDialogueEvidenceOrderingAndNominationReason,
  testPublicDiscussionAddsTableTalkCadence,
  testEvilPrivateNotesDoNotLeakToGoodProactiveWhisper,
].forEach((test) => test());

console.log("ai agent contracts ok");
