import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { processUnityActionFile, processUnityActionFileAsync } from "../scripts/unity_action_bridge.mjs";

const root = path.resolve("output", `unity_action_bridge_contracts_${Date.now()}`);
const statePath = path.join(root, "unity_state.json");
const viewModelPath = path.join(root, "unity_viewmodel.json");
const actionPath = path.join(root, "unity_action.json");
const resultPath = path.join(root, "unity_action_result.json");

function writeAction(type, payload = {}) {
  fs.mkdirSync(root, { recursive: true });
  const action = {
    id: `${type}-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    type,
    payload,
    createdAt: new Date().toISOString(),
  };
  fs.writeFileSync(actionPath, `${JSON.stringify(action, null, 2)}\n`, "utf8");
  return action;
}

function process(options = {}) {
  return processUnityActionFile({
    statePath,
    viewModelPath,
    actionPath,
    resultPath,
    scriptId: "tb",
    playerCount: 9,
    preferredHumanRoleId: "washerwoman",
    seed: 20260506,
    ...options,
  });
}

function readViewModel() {
  return JSON.parse(fs.readFileSync(viewModelPath, "utf8"));
}

function readState() {
  return JSON.parse(fs.readFileSync(statePath, "utf8")).state;
}

function writeState(state) {
  fs.writeFileSync(statePath, `${JSON.stringify({ state }, null, 2)}\n`, "utf8");
}

function resolveFirstNightIfNeeded() {
  const before = readViewModel();
  if (before.phase !== "night") return before;
  const action = writeAction("phase", { stage: "day" });
  const processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);
  assert.equal(processed.viewModel.action.lastActionId, action.id);
  assert.equal(processed.viewModel.phase, "day");
  assert.equal(processed.viewModel.day, 1);
  return processed.viewModel;
}

function testUnityActionLoopCreatesStateAndViewModel() {
  const action = writeAction("new-game", { scriptId: "tb", playerCount: 9, preferredHumanRoleId: "washerwoman", seed: 1234 });
  const { result, viewModel } = process();
  assert.equal(result.ok, true);
  assert.equal(viewModel.action.lastActionId, action.id);
  assert.equal(viewModel.action.lastActionType, "new-game");
  assert.equal(viewModel.action.revision, 1);
  assert.ok(fs.existsSync(statePath), "bridge should persist JS state");
  assert.ok(fs.existsSync(viewModelPath), "bridge should export Unity viewmodel");
  assert.equal(viewModel.phase, "night", "new Unity games should expose the first night before D1");
  assert.equal(viewModel.night, 1);
  assert.equal(
    viewModel.players.find((player) => player.human)?.roleId,
    "washerwoman",
    "Unity new-game preferredHumanRoleId should control the human role"
  );
}

function testUnityNewGameRoleIdPayloadControlsHumanRole() {
  const action = writeAction("new-game", { scriptId: "tb", playerCount: 9, roleId: "chef", seed: 4321 });
  const { result, viewModel } = process();
  assert.equal(result.ok, true, result.reason);
  assert.equal(viewModel.action.lastActionId, action.id);
  assert.equal(
    viewModel.players.find((player) => player.human)?.roleId,
    "chef",
    "Unity menu roleId payload should map directly to a JS Core role id"
  );
}

function testUnitySelectTokenRoundTrip() {
  const before = readViewModel();
  const target = before.players.find((player) => !player.human);
  assert.ok(target, "test needs a non-human target");

  const action = writeAction("select-token", { playerId: target.id });
  const { result, viewModel } = process();
  assert.equal(result.ok, true);
  assert.equal(viewModel.action.lastActionId, action.id);
  assert.equal(viewModel.action.selectedPlayerId, target.id);
  assert.equal(viewModel.dialogueTitle.includes(`${target.seat}`), true);
}

function testUnityGrimoireRoleMarkRoundTrip() {
  const before = readViewModel();
  const target = before.players.find((player) => !player.human);
  assert.ok(target, "role mark test needs a non-human target");

  const action = writeAction("grimoire-mark-role", { playerId: target.id, targetId: target.id, roleId: "soldier" });
  const { result, viewModel } = process();
  assert.equal(result.ok, true, result.reason);
  assert.equal(viewModel.action.lastActionId, action.id);
  assert.equal(viewModel.action.lastActionType, "grimoire-mark-role");
  const exportedTarget = viewModel.players.find((player) => player.id === target.id);
  assert.equal(exportedTarget.revealed, false, "manual role mark should not reveal the target");
  assert.equal(exportedTarget.markedRoleId, "soldier");
  assert.equal(exportedTarget.markedRoleName, "士兵");
}

function testUnityPrivateChatMutatesTimeline() {
  resolveFirstNightIfNeeded();
  const before = readViewModel();
  const target = before.players.find((player) => !player.human);
  const action = writeAction("private-chat", { targetId: target.id, intent: "claim", text: "What is your role?" });
  const { result, viewModel } = process();
  assert.equal(result.ok, true);
  assert.equal(viewModel.action.lastActionId, action.id);
  assert.ok(viewModel.timeline.some((entry) => entry.mode === "whisper-in" && entry.speakerId === target.id));
  const bridgeResult = JSON.parse(fs.readFileSync(resultPath, "utf8"));
  assert.ok(fs.existsSync(bridgeResult.latestReplayPath), "bridge should write latest dialogue replay");
  const replay = JSON.parse(fs.readFileSync(bridgeResult.latestReplayPath, "utf8"));
  assert.ok(
    replay.dialogue.speeches.some((entry) => entry.private && entry.playerId === target.id),
    "dialogue replay should capture AI private replies"
  );
  assert.ok(
    replay.dialogue.timeline.some((entry) => entry.mode === "whisper-out" && entry.targetId === target.id),
    "dialogue replay should capture the player's private question"
  );
}

function testUnityPrivateFollowupIntentAliasesStayAligned() {
  const newGameAction = writeAction("new-game", { scriptId: "tb", playerCount: 9, preferredHumanRoleId: "washerwoman", seed: 20260514 });
  let processed = process();
  assert.equal(processed.result.ok, true, newGameAction.id);
  resolveFirstNightIfNeeded();

  const before = readViewModel();
  const target = before.players.find((player) => !player.human);
  assert.ok(target, "test needs a non-human target");

  const action = writeAction("private-chat", {
    targetId: target.id,
    intent: "followup-proof",
    text: "继续说。",
  });
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);
  assert.equal(processed.viewModel.action.lastActionId, action.id);

  const state = readState();
  const outgoing = state.logs.findLast?.((entry) => entry.type === "whisper" && entry.payload?.direction === "out");
  assert.equal(outgoing?.payload?.intent, "reason", "Unity followup-proof should reach AI as a reason intent, not generic");
}

function testUnityActionTypeAliasesStayAligned() {
  const newGameAction = writeAction("new-game", { scriptId: "tb", playerCount: 9, preferredHumanRoleId: "washerwoman", seed: 20260515 });
  let processed = process();
  assert.equal(processed.result.ok, true, newGameAction.id);
  resolveFirstNightIfNeeded();

  const publicAliasAction = writeAction("conversation-step");
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);
  assert.equal(processed.viewModel.action.lastActionType, "ai-public-step");
  assert.ok(processed.viewModel.timeline.some((entry) => entry.mode === "public"), "conversation-step alias should run public AI");

  const nominationAliasAction = writeAction("nomination-intent", { nomineeId: processed.viewModel.players.find((player) => !player.human)?.id });
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);
  assert.equal(processed.viewModel.action.lastActionType, "human-nomination-intent");
  assert.equal(processed.viewModel.nominationDebate?.active, true);
  assert.equal(processed.viewModel.voteCeremony, null, "nomination-intent alias should enter debate before vote");
}

function testUnityPrivateDeceptionPayloadMutatesTimeline() {
  const newGameAction = writeAction("new-game", { scriptId: "tb", playerCount: 9, preferredHumanRoleId: "washerwoman", seed: 20260516 });
  let processed = process();
  assert.equal(processed.result.ok, true, newGameAction.id);
  resolveFirstNightIfNeeded();

  const before = readViewModel();
  const target = before.players.find((player) => !player.human);
  const action = writeAction("private-chat", {
    targetId: target.id,
    intent: "claim",
    text: "这条信息先只在我们之间对齐。",
    claimRoleId: "undertaker",
    nightInfo: "我昨晚看到 1 号和 2 号之间至少有一个关键身份。",
    askSecret: true,
  });
  const { result, viewModel } = process();
  assert.equal(result.ok, true);
  assert.equal(viewModel.action.lastActionId, action.id);
  assert.ok(
    viewModel.timeline.some(
      (entry) =>
        entry.mode === "whisper-out" &&
        entry.targetId === target.id &&
        entry.text.includes("声称自己是") &&
        entry.text.includes("昨晚得到的信息")
    ),
    "private deception payload should be visible in the outgoing whisper timeline"
  );
}

function testUnityAIProactiveWhisperOfferAcceptDecline() {
  resolveFirstNightIfNeeded();
  let state = readState();
  const ai = state.players.find((player) => !player.isHuman);
  assert.ok(ai, "test needs an AI player");
  ai.privateNotes = ai.privateNotes ?? [];
  ai.privateNotes.push("[第1夜] 你得知：测试主动私聊信息。");
  writeState(state);

  const offerAction = writeAction("ai-proactive-whispers");
  let processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);
  assert.equal(processed.viewModel.action.lastActionId, offerAction.id);
  assert.ok(processed.viewModel.pendingProactiveWhispers.length > 0, "proactive offers should be exported to Unity");
  const offer = processed.viewModel.pendingProactiveWhispers[0];
  assert.ok(offer.reason, "proactive offer should include a reason before the player accepts");
  assert.equal(
    processed.viewModel.timeline.some((entry) => entry.mode === "whisper-in" && entry.speakerId === offer.playerId),
    false,
    "queued offer should not reveal the private message before acceptance"
  );

  const acceptAction = writeAction("accept-proactive-whisper", { offerId: offer.id });
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);
  assert.equal(processed.viewModel.action.lastActionId, acceptAction.id);
  assert.ok(
    processed.viewModel.timeline.some((entry) => entry.mode === "whisper-in" && entry.speakerId === offer.playerId),
    "accepted proactive offer should add a private reply to the timeline"
  );
  assert.equal(
    processed.viewModel.action.selectedPlayerId,
    offer.playerId,
    "accepted proactive offer should keep the visiting AI selected for Unity private chat"
  );

  state = readState();
  const otherAI = state.players.find((player) => !player.isHuman && player.id !== offer.playerId);
  if (otherAI) {
    otherAI.privateNotes = otherAI.privateNotes ?? [];
    otherAI.privateNotes.push("[第1夜] 你得知：第二条测试主动私聊信息。");
    writeState(state);
    const secondOfferAction = writeAction("ai-proactive-whispers");
    processed = process();
    assert.equal(processed.result.ok, true, secondOfferAction.id);
    if (processed.viewModel.pendingProactiveWhispers.length > 0) {
      const declinedOffer = processed.viewModel.pendingProactiveWhispers[0];
      const declineAction = writeAction("decline-proactive-whisper", { offerId: declinedOffer.id });
      processed = process();
      assert.equal(processed.result.ok, true, processed.result.reason);
      assert.equal(processed.viewModel.action.lastActionId, declineAction.id);
      assert.equal(
        processed.viewModel.timeline.some((entry) => entry.speakerId === declinedOffer.playerId && entry.text.includes("第二条测试")),
        false,
        "declined proactive offer should not leak its message text"
      );
    }
  }
}

function testUnityAIPrivateWhispersStayOutOfHumanLogs() {
  resolveFirstNightIfNeeded();
  const action = writeAction("ai-private-whispers");
  const processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);
  assert.equal(processed.viewModel.action.lastActionId, action.id);
  assert.equal(
    processed.viewModel.events.some((entry) => /进行了私聊|AI 之间/.test(entry)),
    false,
    "AI-AI private activity should not be displayed in Unity event logs"
  );
  const state = readState();
  assert.ok(
    Object.values(state.aiAgents ?? {}).some((agent) =>
      (agent.evidenceBook ?? []).some((entry) => entry.kind === "private-channel" && entry.source === "social-read")
    ),
    "AI-AI private activity should still become weak social-read evidence"
  );
}

function testUnityPublicDiscussionMutatesTimeline() {
  const action = writeAction("public-discussion");
  const { result, viewModel } = process();
  assert.equal(result.ok, true);
  assert.equal(viewModel.dayStage, "public");
  assert.ok(viewModel.timeline.some((entry) => entry.mode === "public"), "public action should add public timeline entries");
  assert.ok(viewModel.action.revision >= 4);
}

function testUnityConversationClockStep() {
  const action = writeAction("new-game", { scriptId: "tb", playerCount: 9, preferredHumanRoleId: "washerwoman", seed: 31415 });
  let processed = process();
  assert.equal(processed.result.ok, true, action.id);
  resolveFirstNightIfNeeded();

  const stepAction = writeAction("ai-public-step");
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);
  assert.equal(processed.viewModel.dayStage, "public");
  assert.equal(processed.viewModel.publicConversation.active, true);
  assert.equal(processed.viewModel.publicConversation.step, 1);
  assert.ok(processed.viewModel.publicConversation.label, "conversation clock should expose a label");
  assert.doesNotMatch(processed.viewModel.phaseObjectiveTitle, /轮/, "new public UI objective should not be round-based");
  assert.ok(processed.viewModel.timeline.some((entry) => entry.mode === "public"), "conversation step should add one public line");
}

function testUnityNominationWindowDebateAndVote() {
  const action = writeAction("new-game", { scriptId: "tb", playerCount: 9, preferredHumanRoleId: "washerwoman", seed: 27182 });
  let processed = process();
  assert.equal(processed.result.ok, true, action.id);
  resolveFirstNightIfNeeded();

  const stepAction = writeAction("ai-public-step");
  processed = process();
  assert.equal(processed.result.ok, true, stepAction.id);

  const openAction = writeAction("open-nomination-window", { ticks: 3 });
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);
  assert.equal(processed.viewModel.dayStage, "nomination");
  assert.equal(processed.viewModel.nominationClock.active, true);
  assert.equal(processed.viewModel.nominationClock.ticksRemaining, 3);

  const before = readViewModel();
  const target = before.players.find((player) => !player.human && player.alive);
  assert.ok(target, "nomination debate test should have a legal target");
  const intentAction = writeAction("human-nomination-intent", { nomineeId: target.id, reason: `我提 ${target.name}，先听回应。` });
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);
  assert.equal(processed.viewModel.nominationDebate.active, true);
  assert.equal(processed.viewModel.nominationDebate.nomineeId, target.id);
  assert.ok(processed.viewModel.nominationDebate.lines.length >= 2, "debate should include nominator and nominee lines");
  assert.equal(processed.viewModel.voteCeremony, null, "vote should wait until debate is resolved");

  const voteAction = writeAction("resolve-nomination-vote", { humanVoteYes: true });
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);
  assert.equal(processed.viewModel.nominationDebate.active, false);
  assert.ok(processed.viewModel.voteCeremony, "resolved debate should export vote ceremony");
  assert.equal(processed.viewModel.voteCeremony.nomineeId, target.id);
}

function testUnityNominationDebateAcceptsHumanResponse() {
  const action = writeAction("new-game", { scriptId: "tb", playerCount: 9, preferredHumanRoleId: "washerwoman", seed: 27183 });
  let processed = process();
  assert.equal(processed.result.ok, true, action.id);
  resolveFirstNightIfNeeded();

  writeAction("ai-public-step");
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);

  writeAction("open-nomination-window", { ticks: 3 });
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);

  const before = readViewModel();
  const human = before.players.find((player) => player.human);
  const aiNominator = before.players.find((player) => !player.human && player.alive);
  assert.ok(human && aiNominator, "human response test should have both human and AI players");

  writeAction("human-nomination-intent", {
    nominatorId: aiNominator.id,
    nomineeId: human.id,
    reason: `${aiNominator.name} 提名 ${human.name}，先听回应。`,
  });
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);
  assert.equal(processed.viewModel.nominationDebate.active, true);
  assert.equal(processed.viewModel.nominationDebate.nomineeId, human.id);
  assert.equal(processed.viewModel.nominationDebate.canHumanRespond, true, "human nominee should be able to respond");
  assert.equal(
    processed.viewModel.nominationDebate.lines.some((line) => line.role === "third-party"),
    false,
    "debate should not expose third-party interjections"
  );

  writeAction("nomination-debate-response", { text: "我先回应：这票别急，我会把昨晚信息讲清楚。" });
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);
  assert.equal(processed.viewModel.nominationDebate.canHumanRespond, false);
  assert.ok(
    processed.viewModel.nominationDebate.lines.some((line) => line.speakerId === human.id && /这票别急/.test(line.text) && !line.pending),
    "human response should replace pending nominee line"
  );
}

function testUnityNominationWindowCanPassToNight() {
  const action = writeAction("new-game", { scriptId: "tb", playerCount: 9, preferredHumanRoleId: "washerwoman", seed: 16180 });
  let processed = process();
  assert.equal(processed.result.ok, true, action.id);
  resolveFirstNightIfNeeded();

  const stepAction = writeAction("ai-public-step");
  processed = process();
  assert.equal(processed.result.ok, true, stepAction.id);

  const openAction = writeAction("open-nomination-window", { ticks: 1 });
  processed = process();
  assert.equal(processed.result.ok, true, openAction.id);

  const passAction = writeAction("pass-nomination-window");
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);
  assert.equal(processed.viewModel.phase, "night", "passing the nomination window should advance to night");
}

function testUnityPhaseGuardBlocksSkippingToNomination() {
  const action = writeAction("new-game", { scriptId: "tb", playerCount: 9, preferredHumanRoleId: "washerwoman", seed: 1357 });
  let processed = process();
  assert.equal(processed.result.ok, true, action.id);
  resolveFirstNightIfNeeded();

  const phaseAction = writeAction("phase", { stage: "nomination" });
  processed = process();
  assert.equal(processed.result.ok, false, "phase guard should reject private -> nomination skips");
  assert.equal(processed.viewModel.dayStage, "private");
  assert.equal(processed.viewModel.action.lastActionId, phaseAction.id);
  assert.equal(processed.viewModel.phaseAdvance.targetStage, "public");
}

function testUnityNominationExportsVoteCeremony() {
  const action = writeAction("new-game", { scriptId: "tb", playerCount: 9, preferredHumanRoleId: "washerwoman", seed: 2468 });
  let processed = process();
  assert.equal(processed.result.ok, true, action.id);
  resolveFirstNightIfNeeded();

  const publicAction = writeAction("public-discussion");
  processed = process();
  assert.equal(processed.result.ok, true, publicAction.id);

  const phaseAction = writeAction("phase", { stage: "nomination" });
  processed = process();
  assert.equal(processed.result.ok, true, phaseAction.id);

  const before = readViewModel();
  const target = before.players.find((player) => !player.human && player.alive);
  assert.ok(target, "nomination test should have a legal target");
  const nominationAction = writeAction("nomination", { nomineeId: target.id, humanVoteYes: true });
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);
  assert.equal(processed.viewModel.action.lastActionId, nominationAction.id);
  assert.ok(processed.viewModel.voteCeremony, "nomination should export vote ceremony data");
  assert.equal(processed.viewModel.voteCeremony.nomineeId, target.id);
  assert.ok(processed.viewModel.voteCeremony.voters.length > 0);
}

function testUnityNightActionWritesPlan() {
  const action = writeAction("new-game", { scriptId: "tb", playerCount: 9, preferredHumanRoleId: "fortune-teller", seed: 9012 });
  let processed = process();
  assert.equal(processed.result.ok, true, action.id);

  const before = readViewModel();
  assert.equal(before.humanNightAction.available, true);
  const targets = before.humanNightAction.options.slice(0, 2).map((entry) => entry.id);
  const nightAction = writeAction("night-action", { targetIds: targets });
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);
  const state = JSON.parse(fs.readFileSync(statePath, "utf8")).state;
  assert.equal(state.humanNightPlan.targetIds.length, 2);
  assert.equal(readViewModel().action.lastActionId, nightAction.id);
}

function testUnityNightActionDoesNotLeakIntoDayFlow() {
  const action = writeAction("new-game", { scriptId: "tb", playerCount: 9, preferredHumanRoleId: "fortune-teller", seed: 9013 });
  let processed = process();
  assert.equal(processed.result.ok, true, action.id);

  const before = readViewModel();
  assert.equal(before.phase, "night");
  assert.equal(before.humanNightAction.available, true);
  const targets = before.humanNightAction.options.slice(0, 2).map((entry) => entry.id);
  writeAction("night-action", { targetIds: targets });
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);

  writeAction("phase", { stage: "day" });
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);
  assert.equal(processed.viewModel.phase, "day");
  assert.equal(processed.viewModel.humanNightAction.available, false, "night action should not be offered during the following day");

  writeAction("ai-public-step");
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);

  writeAction("open-nomination-window", { ticks: 3 });
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);
  assert.equal(processed.viewModel.dayStage, "nomination");
  assert.equal(processed.viewModel.phaseAdvance.targetStage, "night");
  assert.equal(
    processed.viewModel.phaseAdvance.blockers.some((entry) => /夜间|night/i.test(entry)),
    false,
    "nomination/day flow should not be blocked by next night's Fortune Teller action"
  );
}

function testUnityDayActionWritesPlan() {
  const action = writeAction("new-game", { scriptId: "tb", playerCount: 9, preferredHumanRoleId: "slayer", seed: 3456 });
  let processed = process();
  assert.equal(processed.result.ok, true, action.id);
  resolveFirstNightIfNeeded();

  const phaseAction = writeAction("public-discussion");
  processed = process();
  assert.equal(processed.result.ok, true, phaseAction.id);

  const before = readViewModel();
  assert.equal(before.humanDayAction.available, true, before.humanDayAction.reason);
  const target = before.humanDayAction.options.find((entry) => !entry.human) ?? before.humanDayAction.options[0];
  assert.ok(target, "Slayer day action should expose a target");
  const dayAction = writeAction("day-action", { targetId: target.id });
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);
  const state = readState();
  assert.equal(state.humanDayPlan.targetIds[0], target.id);
  assert.equal(readViewModel().action.lastActionId, dayAction.id);
}

function testUnityStorytellerActionClearsQueue() {
  const action = writeAction("new-game", { scriptId: "snv", playerCount: 9, preferredHumanRoleId: "sage", seed: 7788 });
  let processed = process();
  assert.equal(processed.result.ok, true, action.id);

  const state = readState();
  const human = state.players.find((player) => player.isHuman);
  assert.ok(human, "fixture should include human player");
  state.pendingStorytellerActions = [
    {
      id: "contract-sage-info",
      type: "sage-info",
      roleId: "sage",
      roleName: "贤者",
      actorId: human.id,
      inputType: "info",
      targetCount: 0,
      minTargetCount: 0,
      maxTargetCount: 0,
      options: [],
      informationText: "你作为贤者获得了与恶魔相关的信息。",
      prompt: "展示贤者死亡信息。",
    },
  ];
  writeState(state);

  const storytellerAction = writeAction("storyteller-action");
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);
  const after = readState();
  assert.equal(after.pendingStorytellerActions.length, 0);
  assert.equal(readViewModel().action.lastActionId, storytellerAction.id);
}

function testUnityReminderAndHandbookActions() {
  const before = readViewModel();
  const target = before.players.find((player) => !player.human);
  assert.ok(target);

  const reminderAction = writeAction("grimoire-reminder", { playerId: target.id, reminder: "Guard" });
  let processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);
  let vm = readViewModel();
  assert.equal(vm.action.lastActionId, reminderAction.id);
  assert.ok(vm.players.find((player) => player.id === target.id).reminders.includes("Guard"));

  const handbookAction = writeAction("script-handbook", { open: true, tab: "night" });
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);
  vm = readViewModel();
  assert.equal(vm.action.lastActionId, handbookAction.id);
  assert.equal(vm.scriptHandbook.open, true);
  assert.ok(vm.scriptHandbook.roles.length > 0);
  assert.ok(vm.scriptHandbook.firstNightOrder.length > 0);
}

async function testUnityBridgeExperimentalLLMPostprocess() {
  const action = writeAction("new-game", { scriptId: "tb", playerCount: 9, preferredHumanRoleId: "washerwoman", seed: 515151 });
  let processed = await processUnityActionFileAsync({
    statePath,
    viewModelPath,
    actionPath,
    resultPath,
    scriptId: "tb",
    playerCount: 9,
    preferredHumanRoleId: "washerwoman",
    seed: 20260506,
  });
  assert.equal(processed.result.ok, true, action.id);
  resolveFirstNightIfNeeded();

  const publicAction = writeAction("ai-public-step");
  processed = await processUnityActionFileAsync({
    statePath,
    viewModelPath,
    actionPath,
    resultPath,
    scriptId: "tb",
    playerCount: 9,
    preferredHumanRoleId: "washerwoman",
    seed: 20260506,
    llmRenderer: true,
    llmProvider: "mock",
    llmTimeoutMs: 1200,
  });
  assert.equal(processed.result.ok, true, publicAction.id);
  assert.equal(processed.state.unityBridge.llmRenderer.enabled, true);
  assert.ok(processed.state.unityBridge.llmRenderer.touched > 0, "experimental LLM renderer should postprocess new AI lines");
  assert.ok(
    processed.state.aiDialogue.timeline.some((entry) => entry.mode === "public" && entry.llmRender?.source === "mock"),
    "Unity timeline should preserve LLM render metadata for evaluation"
  );
  const vm = readViewModel();
  assert.equal(vm.llmRenderer.enabled, true, "Unity viewmodel should expose the active LLM renderer");
  assert.equal(vm.action.llmRenderer.provider, "mock", "Unity action status should mirror LLM provider status");
  assert.equal(vm.action.llmRenderer.model, "mock", "Unity action status should expose the resolved LLM model");
  assert.ok(
    vm.timeline.some((entry) => entry.mode === "public" && entry.llmRender?.source === "mock"),
    "Unity viewmodel timeline should preserve LLM render metadata for UI badges"
  );
}

testUnityActionLoopCreatesStateAndViewModel();
testUnityNewGameRoleIdPayloadControlsHumanRole();
testUnitySelectTokenRoundTrip();
testUnityGrimoireRoleMarkRoundTrip();
testUnityPrivateChatMutatesTimeline();
testUnityPrivateFollowupIntentAliasesStayAligned();
testUnityActionTypeAliasesStayAligned();
testUnityPrivateDeceptionPayloadMutatesTimeline();
testUnityAIProactiveWhisperOfferAcceptDecline();
testUnityAIPrivateWhispersStayOutOfHumanLogs();
testUnityPublicDiscussionMutatesTimeline();
testUnityConversationClockStep();
testUnityNominationWindowDebateAndVote();
testUnityNominationDebateAcceptsHumanResponse();
testUnityNominationWindowCanPassToNight();
testUnityPhaseGuardBlocksSkippingToNomination();
testUnityNominationExportsVoteCeremony();
testUnityNightActionWritesPlan();
testUnityNightActionDoesNotLeakIntoDayFlow();
testUnityDayActionWritesPlan();
testUnityStorytellerActionClearsQueue();
testUnityReminderAndHandbookActions();
await testUnityBridgeExperimentalLLMPostprocess();
console.log("unity action bridge contracts ok");
