import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { initializeAI } from "./ai.js";
import { getRoleById } from "./data.js";
import {
  advanceDayStage,
  createNewGame,
  markPublicDiscussionRound,
  resolveNominationAndVote,
  runNight,
  withSeededRandom,
} from "./engine.js";
import { processUnityActionFile } from "./unity_action_bridge.mjs";

function argValue(flag, fallback = "") {
  const index = process.argv.indexOf(flag);
  if (index >= 0 && index + 1 < process.argv.length) return process.argv[index + 1];
  const prefix = `${flag}=`;
  const entry = process.argv.find((arg) => arg.startsWith(prefix));
  return entry ? entry.slice(prefix.length) : fallback;
}

const root = process.cwd();
const streamingAssets = path.resolve(
  argValue("--streaming-assets", path.join(root, "unity-build", "BOTC_Unity_Prototype_Data", "StreamingAssets"))
);
const stateName = argValue("--state", "main-board");
const seed = Number(argValue("--seed", "20260510")) || 20260510;

const statePath = path.join(streamingAssets, "unity_state.json");
const viewModelPath = path.join(streamingAssets, "unity_viewmodel.json");
const actionPath = path.join(streamingAssets, "unity_action.json");
const resultPath = path.join(streamingAssets, "unity_action_result.json");

fs.mkdirSync(streamingAssets, { recursive: true });
fs.rmSync(actionPath, { force: true });

const bridgeOptions = {
  statePath,
  viewModelPath,
  actionPath,
  resultPath,
  scriptId: "tb",
  playerCount: 9,
  preferredHumanRoleId: "washerwoman",
  seed,
};

let step = 0;

function assertOk(processed, label) {
  assert.equal(processed.result.ok, true, `${label}: ${processed.result.reason ?? processed.result.message ?? "bridge failed"}`);
  return processed.viewModel;
}

function processNoAction(label, options = {}) {
  fs.rmSync(actionPath, { force: true });
  return assertOk(processUnityActionFile({ ...bridgeOptions, ...options }), label);
}

function writeAction(type, payload = {}, options = {}) {
  const id = `ui-smoke-${String(++step).padStart(2, "0")}-${type}`;
  fs.writeFileSync(
    actionPath,
    `${JSON.stringify(
      {
        id,
        type,
        createdAt: new Date().toISOString(),
        payload,
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  return assertOk(processUnityActionFile({ ...bridgeOptions, ...options }), type);
}

function writePersistedState(state) {
  fs.writeFileSync(statePath, `${JSON.stringify({ state }, null, 2)}\n`, "utf8");
  fs.rmSync(actionPath, { force: true });
}

function freshViewModel(options = {}) {
  return processNoAction("fresh-state", { ...options, freshState: true });
}

function humanPlayer(state) {
  const player = state.players.find((entry) => entry.isHuman);
  assert.ok(player, "fixture needs a human player");
  return player;
}

function firstOtherPlayer(state, predicate = () => true) {
  const player = state.players.find((entry) => !entry.isHuman && predicate(entry));
  assert.ok(player, "fixture needs a matching non-human player");
  return player;
}

function assignRole(state, player, roleId) {
  const role = getRoleById(state.scriptId, roleId);
  assert.ok(role, `missing role ${roleId} in ${state.scriptId}`);
  player.roleId = role.id;
  player.roleName = role.name;
  player.roleIcon = role.icon ?? null;
  player.team = role.team;
  player.category = role.category;
  player.tags = [...(role.tags ?? [])];
  player.apparentRoleId = role.id;
  player.apparentRoleName = role.name;
  player.apparentRoleIcon = role.icon ?? null;
  player.apparentTeam = role.team;
  player.apparentCategory = role.category;
}

function moveToNomination(state) {
  assert.equal(advanceDayStage(state, "public").ok, true, "fixture should enter public discussion");
  markPublicDiscussionRound(state);
  assert.equal(advanceDayStage(state, "nomination").ok, true, "fixture should enter nomination");
}

function makeFifteenPlayerVoteFixture() {
  const state = createNewGame(
    {
      scriptId: "tb",
      playerCount: 15,
      preferredHumanRoleId: "washerwoman",
    },
    withSeededRandom(seed + 401)
  );
  initializeAI(state);
  runNight(state, withSeededRandom(seed + 402));
  moveToNomination(state);

  const human = humanPlayer(state);
  const nominee = firstOtherPlayer(state, (entry) => entry.alive);
  const result = resolveNominationAndVote(
    state,
    {
      nominatorId: human.id,
      nomineeId: nominee.id,
      humanVoteYes: true,
      decideAIVote: () => true,
    },
    withSeededRandom(seed + 403)
  );
  assert.equal(result.accepted, true, result.reason);
  assert.equal(result.votes.length, 15, "15-player fixture should record every voter");
  initializeAI(state);
  return state;
}

function makeRavenkeeperStorytellerQueueFixture() {
  const state = createNewGame(
    {
      scriptId: "tb",
      playerCount: 9,
      preferredHumanRoleId: "ravenkeeper",
    },
    withSeededRandom(seed + 501)
  );
  initializeAI(state);
  runNight(state, withSeededRandom(seed + 502));

  const human = humanPlayer(state);
  assert.equal(human.roleId, "ravenkeeper", "Ravenkeeper fixture should place the human as Ravenkeeper");

  for (const player of state.players) {
    if (!player.isHuman && player.team === "good") player.alive = false;
    if (player.alive && player.category === "minion") assignRole(state, player, "baron");
  }

  runNight(state, withSeededRandom(seed + 503));
  initializeAI(state);
  assert.ok(
    (state.pendingStorytellerActions ?? []).some((action) => action.type === "ravenkeeper-info"),
    "Ravenkeeper fixture should produce a real Storyteller queue action"
  );
  return state;
}

function prepareMainBoard() {
  return freshViewModel();
}

function preparePrivateChat() {
  let vm = freshViewModel();
  const target = vm.players.find((player) => !player.human && player.alive);
  assert.ok(target, "private-chat smoke needs a non-human target");
  vm = writeAction("select-token", { playerId: target.id });
  vm = writeAction("private-chat", {
    targetId: target.id,
    text: "你是什么身份？",
    intent: "claim",
  });
  assert.ok(vm.timeline.some((entry) => entry.mode === "whisper-in" && entry.speakerId === target.id));
  return vm;
}

function prepareActionForm() {
  const vm = freshViewModel({
    scriptId: "bmr",
    playerCount: 9,
    preferredHumanRoleId: "gambler",
  });
  assert.equal(vm.actionForms?.find((form) => form.id === "night-action")?.available, true);
  return vm;
}

function prepareStorytellerQueue() {
  writePersistedState(makeRavenkeeperStorytellerQueueFixture());
  const vm = processNoAction("storyteller-queue");
  assert.equal(vm.pendingStorytellerAction?.available, true);
  return vm;
}

function prepareScriptHandbook() {
  const vm = freshViewModel();
  assert.ok(vm.scriptHandbook?.roles?.length > 0);
  return vm;
}

function prepareVoteCeremony() {
  writePersistedState(makeFifteenPlayerVoteFixture());
  const vm = processNoAction("vote-ceremony");
  assert.equal(vm.voteCeremony?.voters?.length, 15);
  return vm;
}

function prepareRolePicker() {
  const vm = freshViewModel();
  const target = vm.players.find((player) => !player.human && player.alive);
  assert.ok(target, "role-picker smoke needs a non-human target");
  return writeAction("select-token", { playerId: target.id });
}

const preparations = {
  "main-board": prepareMainBoard,
  "private-chat": preparePrivateChat,
  "action-form": prepareActionForm,
  "storyteller-queue": prepareStorytellerQueue,
  "script-handbook": prepareScriptHandbook,
  "vote-ceremony": prepareVoteCeremony,
  "role-picker": prepareRolePicker,
};

const prepare = preparations[stateName];
if (!prepare) {
  throw new Error(`Unknown UI smoke state: ${stateName}`);
}

const vm = prepare();
fs.rmSync(actionPath, { force: true });

console.log(
  JSON.stringify(
    {
      state: stateName,
      streamingAssets,
      statePath,
      viewModelPath,
      players: vm.players?.length ?? 0,
      selectedPlayerId: vm.action?.selectedPlayerId ?? "",
      voteVoters: vm.voteCeremony?.voters?.length ?? 0,
      storytellerQueue: vm.storytellerQueueDetails?.length ?? vm.storytellerQueue?.length ?? 0,
      actionForms: vm.actionForms?.map((form) => ({ id: form.id, available: form.available, inputType: form.inputType })) ?? [],
    },
    null,
    2
  )
);
