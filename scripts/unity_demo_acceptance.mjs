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

const outputDir = path.resolve(argValue("--dir", path.join("output", `unity_demo_acceptance_${Date.now()}`)));
const seed = Number(argValue("--seed", "20260508")) || 20260508;
const statePath = path.join(outputDir, "unity_state.json");
const viewModelPath = path.join(outputDir, "unity_viewmodel.json");
const actionPath = path.join(outputDir, "unity_action.json");
const resultPath = path.join(outputDir, "unity_action_result.json");

fs.mkdirSync(outputDir, { recursive: true });
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
const summary = [];
let demoVoteVoters = 0;

function assertOk(processed, label) {
  assert.equal(processed.result.ok, true, `${label}: ${processed.result.reason ?? processed.result.message ?? "bridge failed"}`);
  return processed.viewModel;
}

function writeAction(type, payload = {}) {
  const id = `acceptance-${String(++step).padStart(2, "0")}-${type}`;
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

  const processed = processUnityActionFile(bridgeOptions);
  const vm = assertOk(processed, type);
  assert.equal(vm.action.lastActionId, id, `${type}: viewmodel should acknowledge the action id`);
  summary.push({ type, status: vm.action.status, message: vm.action.message ?? "" });
  return vm;
}

function readPersistedState() {
  return JSON.parse(fs.readFileSync(statePath, "utf8")).state;
}

function writePersistedState(state) {
  fs.writeFileSync(statePath, `${JSON.stringify({ state }, null, 2)}\n`, "utf8");
  fs.rmSync(actionPath, { force: true });
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

function moveToNomination(state) {
  assert.equal(advanceDayStage(state, "public").ok, true, "fixture should enter public discussion");
  markPublicDiscussionRound(state);
  assert.equal(advanceDayStage(state, "nomination").ok, true, "fixture should enter nomination");
}

function executePlayer(state, nominee, seedOffset) {
  const human = humanPlayer(state);
  const nominator =
    human.alive && human.id !== nominee.id ? human : firstOtherPlayer(state, (entry) => entry.alive && entry.id !== nominee.id);
  const result = resolveNominationAndVote(
    state,
    {
      nominatorId: nominator.id,
      nomineeId: nominee.id,
      humanVoteYes: true,
      decideAIVote: () => true,
    },
    withSeededRandom(seed + seedOffset)
  );
  assert.equal(result.accepted, true, result.reason);
  assert.equal(result.passed, true, "fixture execution vote should pass");
  assert.equal(nominee.alive, false, "fixture nominee should die");
}

function makeSageStorytellerQueueFixture() {
  const state = createNewGame(
    {
      scriptId: "snv",
      playerCount: 9,
      preferredHumanRoleId: "sage",
    },
    withSeededRandom(seed + 101)
  );
  initializeAI(state);
  runNight(state, withSeededRandom(seed + 102));

  const human = humanPlayer(state);
  assert.equal(human.roleId, "sage", "Sage fixture should place the human as Sage");

  for (const player of state.players) {
    if (!player.isHuman && player.team === "good") player.alive = false;
    if (player.alive && player.category === "minion") assignRole(state, player, "evil-twin");
  }

  runNight(state, withSeededRandom(seed + 103));
  initializeAI(state);

  assert.equal(human.alive, false, "Sage fixture should kill the human Sage");
  const pending = state.pendingStorytellerActions ?? [];
  assert.ok(
    pending.some((action) => action.type === "sage-info"),
    "Sage fixture should produce a real sage-info Storyteller action"
  );
  return state;
}

function makeRavenkeeperStorytellerQueueFixture() {
  const state = createNewGame(
    {
      scriptId: "tb",
      playerCount: 9,
      preferredHumanRoleId: "ravenkeeper",
    },
    withSeededRandom(seed + 201)
  );
  initializeAI(state);
  runNight(state, withSeededRandom(seed + 202));

  const human = humanPlayer(state);
  assert.equal(human.roleId, "ravenkeeper", "Ravenkeeper fixture should place the human as Ravenkeeper");

  for (const player of state.players) {
    if (!player.isHuman && player.team === "good") player.alive = false;
    if (player.alive && player.category === "minion") assignRole(state, player, "baron");
  }

  runNight(state, withSeededRandom(seed + 203));
  initializeAI(state);

  assert.equal(human.alive, false, "Ravenkeeper fixture should kill the human Ravenkeeper");
  assert.ok(
    (state.pendingStorytellerActions ?? []).some((action) => action.type === "ravenkeeper-info"),
    "Ravenkeeper fixture should produce a real ravenkeeper-info Storyteller action"
  );
  return state;
}

function makeBarberStorytellerQueueFixture() {
  const state = createNewGame(
    {
      scriptId: "snv",
      playerCount: 9,
      preferredHumanRoleId: "fang-gu",
    },
    withSeededRandom(seed + 301)
  );
  initializeAI(state);
  runNight(state, withSeededRandom(seed + 302));

  const human = humanPlayer(state);
  assert.equal(human.category, "demon", "Barber fixture should place the human as a demon");
  const barber = firstOtherPlayer(state, (entry) => entry.alive && entry.team === "good");
  assignRole(state, barber, "barber");

  moveToNomination(state);
  executePlayer(state, barber, 303);
  initializeAI(state);

  assert.equal(barber.alive, false, "Barber fixture should execute Barber");
  assert.ok(
    (state.pendingStorytellerActions ?? []).some((action) => action.type === "barber-swap"),
    "Barber fixture should produce a real barber-swap Storyteller action"
  );
  return state;
}

function assertStorytellerQueueReady(vm, expectedType) {
  assert.equal(
    vm.pendingStorytellerAction?.available,
    true,
    "real Storyteller queue should be visible to Unity viewmodel"
  );
  assert.equal(
    vm.pendingStorytellerAction?.type,
    expectedType,
    "Unity viewmodel should preserve Storyteller action type"
  );
}

function exportStorytellerFixture(state, expectedType, label) {
  writePersistedState(state);
  const processedFixture = processUnityActionFile(bridgeOptions);
  const fixtureVm = assertOk(processedFixture, label);
  assertStorytellerQueueReady(fixtureVm, expectedType);
  summary.push({
    type: label,
    status: fixtureVm.action.status,
    message: fixtureVm.pendingStorytellerAction?.prompt ?? "",
  });
  return fixtureVm;
}

function optionIds(vm, count, predicate = () => true) {
  const options = (vm.pendingStorytellerAction?.options ?? []).filter((entry) => entry?.id && predicate(entry));
  assert.ok(options.length >= count, `Storyteller action should expose ${count} legal option(s)`);
  return options.slice(0, count).map((entry) => entry.id);
}

let processed = processUnityActionFile({ ...bridgeOptions, freshState: true });
let vm = assertOk(processed, "fresh demo state");
assert.equal(vm.players.length, 9, "fresh demo should export 9 players");
assert.ok(vm.players.some((player) => player.human), "fresh demo should include the human player");
summary.push({ type: "fresh-state", status: vm.action.status, message: vm.action.message ?? "" });

const firstTarget = vm.players.find((player) => !player.human && player.alive);
assert.ok(firstTarget, "acceptance needs a living non-human target");

vm = writeAction("select-token", { playerId: firstTarget.id });
assert.equal(vm.action.selectedPlayerId, firstTarget.id, "select-token should update selected player");

vm = writeAction("private-chat", {
  targetId: firstTarget.id,
  text: "我想私下听听你的身份说法。",
  intent: "claim",
});
assert.ok(
  vm.timeline.some((entry) => entry.mode === "whisper-in" && entry.speakerId === firstTarget.id),
  "private-chat should add an AI whisper reply"
);

vm = writeAction("public-discussion");
assert.equal(vm.dayStage, "public", "public-discussion should enter public day stage");
assert.ok(vm.timeline.some((entry) => entry.mode === "public"), "public-discussion should add public timeline entries");

vm = writeAction("phase", { stage: "nomination" });
assert.equal(vm.dayStage, "nomination", "phase nomination should enter nomination stage");

const nominee = vm.players.find((player) => !player.human && player.alive) ?? firstTarget;
vm = writeAction("nomination", { nomineeId: nominee.id, humanVoteYes: true });
assert.ok(vm.voteCeremony, "nomination should export vote ceremony");
assert.equal(vm.voteCeremony.nomineeId, nominee.id, "vote ceremony should target the nominee");
assert.ok(vm.voteCeremony.voters.length > 0, "vote ceremony should include voters");
demoVoteVoters = vm.voteCeremony.voters.length;

vm = writeAction("script-handbook", { mode: "open", tab: "roles" });
assert.equal(vm.scriptHandbook.open, true, "script-handbook should open the handbook view");
assert.ok(vm.scriptHandbook.roles.length > 0, "script handbook should include role data");

const sageQueueState = makeSageStorytellerQueueFixture();
vm = exportStorytellerFixture(sageQueueState, "sage-info", "real-sage-storyteller-queue-state");

vm = writeAction("storyteller-action");
assert.equal(
  vm.pendingStorytellerAction?.available,
  false,
  "storyteller-action should clear the visible pending Storyteller action"
);
assert.ok(vm.privateInfo.length > 0, "storyteller-action should surface private info in the Unity viewmodel");
const resolvedState = readPersistedState();
assert.equal(resolvedState.pendingStorytellerActions?.length ?? 0, 0, "storyteller-action should clear persisted queue");
assert.ok(
  resolvedState.events?.infoPings?.some((ping) => ping.type === "sage"),
  "storyteller-action should persist typed Sage info ping"
);

const ravenkeeperQueueState = makeRavenkeeperStorytellerQueueFixture();
vm = exportStorytellerFixture(ravenkeeperQueueState, "ravenkeeper-info", "real-ravenkeeper-storyteller-queue-state");
const ravenkeeperHumanId = humanPlayer(readPersistedState()).id;
const ravenkeeperTargetIds = optionIds(vm, 1, (entry) => entry.id !== ravenkeeperHumanId);

vm = writeAction("storyteller-action", { targetIds: ravenkeeperTargetIds });
assert.equal(
  vm.pendingStorytellerAction?.available,
  false,
  "ravenkeeper storyteller-action should clear the visible pending Storyteller action"
);
assert.ok(vm.privateInfo.length > 0, "ravenkeeper storyteller-action should surface private info");
const ravenkeeperResolvedState = readPersistedState();
assert.equal(
  ravenkeeperResolvedState.pendingStorytellerActions?.length ?? 0,
  0,
  "ravenkeeper storyteller-action should clear persisted queue"
);
assert.ok(
  ravenkeeperResolvedState.events?.infoPings?.some((ping) => ping.type === "ravenkeeper"),
  "ravenkeeper storyteller-action should persist typed Ravenkeeper info ping"
);

const barberQueueState = makeBarberStorytellerQueueFixture();
vm = exportStorytellerFixture(barberQueueState, "barber-swap", "real-barber-storyteller-queue-state");
const barberTargetIds = optionIds(vm, 2, (entry) => entry.category !== "demon");
const barberBeforeState = readPersistedState();
const barberBeforeRoles = barberTargetIds.map((id) => barberBeforeState.players.find((player) => player.id === id)?.roleId);

vm = writeAction("storyteller-action", { targetIds: barberTargetIds });
assert.equal(
  vm.pendingStorytellerAction?.available,
  false,
  "barber storyteller-action should clear the visible pending Storyteller action"
);
const barberResolvedState = readPersistedState();
assert.equal(barberResolvedState.pendingStorytellerActions?.length ?? 0, 0, "barber storyteller-action should clear persisted queue");
const barberAfterRoles = barberTargetIds.map((id) => barberResolvedState.players.find((player) => player.id === id)?.roleId);
assert.deepEqual(barberAfterRoles, [...barberBeforeRoles].reverse(), "barber storyteller-action should swap selected roles");

console.log("unity demo acceptance ok");
console.log(
  JSON.stringify(
    {
      outputDir,
      steps: summary,
      players: vm.players.length,
      voteVoters: demoVoteVoters,
      lastAction: vm.action.lastActionType,
      storytellerQueueCovered: true,
      storytellerQueueTypes: ["sage-info", "ravenkeeper-info", "barber-swap"],
    },
    null,
    2
  )
);
