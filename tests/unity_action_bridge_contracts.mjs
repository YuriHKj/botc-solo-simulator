import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { processUnityActionFile } from "../scripts/unity_action_bridge.mjs";

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

function testUnityActionLoopCreatesStateAndViewModel() {
  const action = writeAction("new-game", { scriptId: "tb", playerCount: 9, preferredHumanRoleId: "washerwoman", seed: 1234 });
  const { result, viewModel } = process();
  assert.equal(result.ok, true);
  assert.equal(viewModel.action.lastActionId, action.id);
  assert.equal(viewModel.action.lastActionType, "new-game");
  assert.equal(viewModel.action.revision, 1);
  assert.ok(fs.existsSync(statePath), "bridge should persist JS state");
  assert.ok(fs.existsSync(viewModelPath), "bridge should export Unity viewmodel");
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

function testUnityPrivateChatMutatesTimeline() {
  const before = readViewModel();
  const target = before.players.find((player) => !player.human);
  const action = writeAction("private-chat", { targetId: target.id, intent: "claim", text: "What is your role?" });
  const { result, viewModel } = process();
  assert.equal(result.ok, true);
  assert.equal(viewModel.action.lastActionId, action.id);
  assert.ok(viewModel.timeline.some((entry) => entry.mode === "whisper-in" && entry.speakerId === target.id));
}

function testUnityPrivateDeceptionPayloadMutatesTimeline() {
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

function testUnityPublicDiscussionMutatesTimeline() {
  const action = writeAction("public-discussion");
  const { result, viewModel } = process();
  assert.equal(result.ok, true);
  assert.equal(viewModel.dayStage, "public");
  assert.ok(viewModel.timeline.some((entry) => entry.mode === "public"), "public action should add public timeline entries");
  assert.ok(viewModel.action.revision >= 4);
}

function testUnityPhaseGuardBlocksSkippingToNomination() {
  const action = writeAction("new-game", { scriptId: "tb", playerCount: 9, preferredHumanRoleId: "washerwoman", seed: 1357 });
  let processed = process();
  assert.equal(processed.result.ok, true, action.id);

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

function testUnityDayActionWritesPlan() {
  const action = writeAction("new-game", { scriptId: "tb", playerCount: 9, preferredHumanRoleId: "slayer", seed: 3456 });
  let processed = process();
  assert.equal(processed.result.ok, true, action.id);

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

testUnityActionLoopCreatesStateAndViewModel();
testUnitySelectTokenRoundTrip();
testUnityPrivateChatMutatesTimeline();
testUnityPrivateDeceptionPayloadMutatesTimeline();
testUnityPublicDiscussionMutatesTimeline();
testUnityPhaseGuardBlocksSkippingToNomination();
testUnityNominationExportsVoteCeremony();
testUnityNightActionWritesPlan();
testUnityDayActionWritesPlan();
testUnityStorytellerActionClearsQueue();
testUnityReminderAndHandbookActions();
console.log("unity action bridge contracts ok");
