import assert from "node:assert/strict";

import { getRoleById } from "../scripts/data.js";
import {
  advanceDayStage,
  createNewGame,
  markPublicDiscussionRound,
  openNominationWindow,
  privateChatLimitForDay,
  resolveNominationAndVote,
  runNight,
} from "../scripts/engine.js";
import {
  applyHumanSpeechCadence,
  applySpeechBudget,
  acceptAIProactiveWhisper,
  buildAIThoughtFrame,
  chooseAINomination,
  claimDisclosurePlanner,
  createNominationDebate,
  declineAIProactiveWhisper,
  decideAIVote,
  getAIScriptPressureProfile,
  getClaimDisclosureState,
  getAIInsightRows,
  initializeAI,
  refreshAIBeliefs,
  runAIConversationStep,
  runAIDiscussion,
  runAIToAIPrivateWhispers,
  runAIProactiveWhispers,
  runPrivateWhisper,
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
  recordPrivateInfoForAgent,
  recordPublicClaimForAgents,
  recordVoteForAgents,
  summarizeEvidenceForDialogue,
} from "../scripts/ai_agents.js";
import {
  layeredCorpusPaths,
  pickLayeredSpeech,
} from "../scripts/ai_speech_renderer.js";

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

function testThoughtFrameDrivesVisiblePublicClaim() {
  const state = makeTBState();
  const result = advanceDayStage(state, "public");
  assert.equal(result.ok, true, result.reason);
  const outsider = state.players.find((player) => {
    if (player.isHuman || !player.alive || player.category !== "outsider") return false;
    const frame = buildAIThoughtFrame(state, player, { audience: "public", roundInDay: 1, rng: () => 0.01 });
    return frame.selfDisclosureNeed === "hard_claim";
  });
  assert.ok(outsider, "expected an AI outsider in TB fixture");

  const frame = buildAIThoughtFrame(state, outsider, { audience: "public", roundInDay: 1, rng: () => 0.01 });
  assert.equal(frame.selfDisclosureNeed, "hard_claim", "TB outsider thought frame should choose public claim");
  const beforeClaims = (state.events.claims ?? []).filter((claim) => !claim.private && claim.playerId === outsider.id).length;
  runAIDiscussion(state, () => 0.01);
  const claim = (state.events.claims ?? []).find((entry) => !entry.private && entry.playerId === outsider.id);
  assert.ok(claim, "thought-frame hard claim should create a public claim event");
  const roleName = getRoleById(state.scriptId, claim.roleId)?.name ?? claim.roleId;
  const speech = (state.events.speeches ?? []).find(
    (entry) => !entry.private && entry.playerId === outsider.id && `${entry.line ?? ""}`.includes(roleName)
  );
  assert.ok(speech, "thought-frame public claim should be visible in public speech");
  assert.ok(
    (state.aiDialogue.thoughtFramesByAgentId?.[outsider.id]?.intendedAct ?? "") === "claim",
    "latest thought frame should be stored on dialogue state"
  );
  assert.ok(beforeClaims <= 0, "fixture should start without that AI public claim");
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
    publicLines.some((line) => /下一句我会问|我会问|接下来先问|先问/.test(line)),
    "public discussion should surface thoughtFrame.questionToAsk as a follow-up line"
  );
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
  const accepted = acceptAIProactiveWhisper(state, first.id, fixedRng(22802));
  assert.equal(accepted.ok, true, accepted.reason);
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
  assert.match(proposal.reason, /先提|放上台|正面回应/, "pressure nomination should explain its intent");

  const nominee = state.players.find((player) => player.id === proposal.nomineeId);
  const nominator = state.players.find((player) => player.id === proposal.nominatorId);
  assert.ok(nominee?.alive, "AI should not nominate a dead player");
  assert.ok(nominator?.alive, "AI should use a living nominator");
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
    /换个说法|说白了|先说清楚|换句话说|我先看|我先点|我先不把话说死|我暂时不换目标/,
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
  assert.match(result.response, /先给结论：|我先看|我先点|我先不把话说死|我暂时不换目标/, "private reason should start with a direct conversational answer");
  assert.match(result.response, /主要|理由|对不上|站队|信息|提到/, "private reason should answer the asked why-question before expanding");
  assert.match(result.response, /大概身份|身份|昨晚信息|说清楚|反问一句|下一句我会这样追/, "private reason should end with a follow-up question direction");
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
    new RegExp(`(让|问|追).*${target.seatIndex + 1}号|${target.seatIndex + 1}号.*回应`),
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
  assert.match(result.response, /我查验 4号 与 6号，结果：否/, "shared night info should be rewritten into speaker perspective");
  assert.doesNotMatch(result.response, /你查验 4号 与 6号/, "AI should not quote self-private notes as if the listener performed the action");

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
    /我查验 4号 与 6号，结果：否|查验 4号 与 6号，结果：否/,
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
  assert.match(steadyResult.response, /不把话说死|从我这边看|先放主线|我按|我先看/, "steady speech should sound cautious");
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
  assert.match(publicLeadIn, /如果今天提 7号/, "public polish should keep the actual vote condition");
}

function testSpeechBudgetLimitsLongDialogueText() {
  const text = "第一句很长但还可以。第二句继续解释。第三句补充说明。第四句又开始拖长。第五句应该被裁掉。";
  const rendered = applySpeechBudget(text, { audience: "public", maxSentences: 3, maxChars: 80 });

  assert.match(rendered, /第一句/);
  assert.match(rendered, /第三句/);
  assert.doesNotMatch(rendered, /第五句/, "speech budget should remove excess sentences");
  assert.ok(rendered.length <= 80, "speech budget should respect maxChars");
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
    assert.equal(contract.publicOnly, true, "public speech evidence contract should be public-only");
    assert.ok(contract.text, "public speech evidence contract should include text");
    if (contract.hasEvidence) {
      assert.ok(
        containsContractSummary ||
          (contract.spokenText && normalizedLine.includes(normalizeEvidenceSpeech(contract.spokenText))),
        "public speech should quote a contract evidence summary or player-style spoken summary"
      );
    } else {
      assert.ok(
        normalizedLine.includes(normalizeEvidenceSpeech(contract.text)) ||
          (contract.spokenText && normalizedLine.includes(normalizeEvidenceSpeech(contract.spokenText))) ||
          /证据还弱|追问入口|不当定罪|证据还薄/.test(normalizedLine),
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

  assert.match(pressureLine, /先上压力|直接点|别散火力|先压/, "pressure public speech should use forceful act wording");
  assert.match(shadowLine, /不急着拍死|谁替|主线|站边|暗记|换句话说|给解释/, "shadow public speech should use pattern-aware wording");
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
  assert.match(result.response, /好人位|身份|公开|我是|大概方向/, "evil AI should use outward-facing cover wording");
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
  assert.match(secondLine, /公开.*先不换|上一轮卡点|还是围绕/, "public continuation should refer to the previous public line");
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
  testPrivateClaimsAreNotGlobal,
  testInsightRowsDoNotMutatePlayerBeliefs,
  testNightInfoBecomesPrivateObservation,
  testPublicDiscussionBecomesPublicObservations,
  testConversationClockStepUsesSoftClock,
  testNominationDebateIsCreatedBeforeVote,
  testDayOnePublicDiscussionDoesNotMassClaim,
  testDayOnePublicDiscussionHasAtLeastOneVisibleHardClaim,
  testThoughtFrameDrivesVisiblePublicClaim,
  testThoughtFrameQuestionFeedsPrivateFollowUp,
  testThoughtFrameQuestionFeedsPublicFollowUp,
  testRepeatedSpeechGetsDifferentiated,
  testPrivateTrustQuestionUsesActRenderer,
  testPrivateCompareQuestionUsesActRenderer,
  testScriptPressureProfileRecognizesOutsiderIncentives,
  testLunaticAgentUsesPerceivedDemonKnowledge,
  testPrivateWhisperBecomesPrivateObservationOnlyForParticipant,
  testEvilAllyClaimQuestionRevealsRealAndBluffIdentity,
  testDeadAICanStillPrivateWhisper,
  testDeadPrivateWhisperUsesDeadContextAct,
  testDeadAICanStillJoinPublicDiscussion,
  testAIProactivelyWhispersWithoutConsumingHumanLimit,
  testAIProactiveWhisperCanBeQueuedAcceptedOrDeclined,
  testPrivateChatFollowUpsDoNotConsumeDailySlots,
  testDayStanceMemoryPersistsWithinDay,
  testAIToAIPrivateWhisperWritesParticipantObservationsOnly,
  testDeadAIPublicDiscussionClaimsAggressively,
  testNominationAndVoteBecomePublicObservations,
  testAINominationCanPressureNominateWithLowEvidence,
  testPublicStatementMemoryLowersVoteThresholdForOwnFocus,
  testStrategyPersonaChangesVoteBehavior,
  testPublicStatementMemoryCanDriveNominationProposal,
  testObservationWritesEvidenceBook,
  testBeliefRefreshConsumesAgentObservations,
  testPrivateReasonUsesVisibleDialogueEvidence,
  testPrivateResponseUsesUnifiedEvidenceContract,
  testPrivateReasonUsesQuestionAnswerShape,
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
  testKnowledgeGraphContaminatedNightInfoHasLimitedPressure,
  testNightInfoContaminationMetadata,
  testFalseClaimLowersDynamicSourceTrust,
  testVerifiedClaimRaisesDynamicSourceTrust,
  testAbnormalVoteLowersDynamicSourceTrust,
  testDialogueEvidenceOrderingAndNominationReason,
  testNominationUsesUnifiedEvidenceContract,
  testNominationDoesNotUseOtherAgentPrivateNightInfo,
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
  testClaimDisclosureMemoryKeepsRangeOnFollowUp,
  testClaimDisclosureMemoryDoesNotDowngradeAfterHardClaim,
].forEach((test) => test());

console.log("ai agent contracts ok");
