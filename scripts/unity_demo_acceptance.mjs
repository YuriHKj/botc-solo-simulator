import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

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

vm = writeAction("script-handbook", { mode: "open", tab: "roles" });
assert.equal(vm.scriptHandbook.open, true, "script-handbook should open the handbook view");
assert.ok(vm.scriptHandbook.roles.length > 0, "script handbook should include role data");

console.log("unity demo acceptance ok");
console.log(
  JSON.stringify(
    {
      outputDir,
      steps: summary,
      players: vm.players.length,
      voteVoters: vm.voteCeremony?.voters?.length ?? 0,
      lastAction: vm.action.lastActionType,
    },
    null,
    2
  )
);
