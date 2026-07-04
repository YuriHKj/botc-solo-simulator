import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const RUNTIME_FILES = [
  "unity_state.json",
  "unity_viewmodel.json",
  "unity_action.json",
  "unity_action_result.json",
];

function parseArgs(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const entry = argv[index];
    if (!entry.startsWith("--")) continue;
    const eqIndex = entry.indexOf("=");
    if (eqIndex >= 0) {
      values.set(entry.slice(2, eqIndex), entry.slice(eqIndex + 1));
      continue;
    }
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      values.set(entry.slice(2), next);
      index += 1;
    } else {
      values.set(entry.slice(2), "1");
    }
  }
  return values;
}

function argValue(args, name, fallback = "") {
  return args.get(name) ?? fallback;
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function runtimeFileStatus(streamingAssets) {
  return Object.fromEntries(
    RUNTIME_FILES.map((name) => {
      const filePath = path.join(streamingAssets, name);
      return [name, fs.existsSync(filePath) ? fs.statSync(filePath).size : 0];
    })
  );
}

function assertNoStaleRuntimeFiles(streamingAssets) {
  const status = runtimeFileStatus(streamingAssets);
  const stale = Object.entries(status).filter(([, size]) => size > 0);
  assert.equal(stale.length, 0, `package should not ship stale Unity runtime files: ${JSON.stringify(status)}`);
  return status;
}

function packagePaths(packageDir, outputRoot) {
  const packagePath = path.resolve(packageDir);
  const streamingAssets = path.join(packagePath, "BOTC_Unity_Prototype_Data", "StreamingAssets");
  const bridgeScript = path.join(streamingAssets, "BotcJsCore", "scripts", "unity_action_bridge.mjs");
  assert.ok(fs.existsSync(path.join(packagePath, "BOTC_Unity_Prototype.exe")), `Unity executable missing: ${packagePath}`);
  assert.ok(fs.existsSync(streamingAssets), `StreamingAssets missing: ${streamingAssets}`);
  assert.ok(fs.existsSync(bridgeScript), `package bridge script missing: ${bridgeScript}`);
  const harnessRoot = path.resolve(outputRoot, `${path.basename(packagePath)}-core-smoke`);
  fs.rmSync(harnessRoot, { recursive: true, force: true });
  fs.mkdirSync(harnessRoot, { recursive: true });
  return {
    packagePath,
    streamingAssets,
    bridgeScript,
    harnessRoot,
    statePath: path.join(harnessRoot, "unity_state.json"),
    viewModelPath: path.join(harnessRoot, "unity_viewmodel.json"),
    actionPath: path.join(harnessRoot, "unity_action.json"),
    resultPath: path.join(harnessRoot, "unity_action_result.json"),
    evidencePath: path.join(harnessRoot, "core_playable_evidence.json"),
  };
}

function submit(processUnityActionFile, paths, type, payload, options = {}) {
  const action = {
    id: `${type}-${Date.now()}-${process.pid}-${Math.floor(Math.random() * 100000)}`,
    type,
    payload,
    createdAt: new Date().toISOString(),
  };
  writeJson(paths.actionPath, action);
  const processed = processUnityActionFile({
    statePath: paths.statePath,
    viewModelPath: paths.viewModelPath,
    actionPath: paths.actionPath,
    resultPath: paths.resultPath,
    scriptId: "tb",
    playerCount: 9,
    preferredHumanRoleId: "fortune-teller",
    seed: 9014,
    disableReplayRecorder: true,
    ...options,
  });
  return { action, ...processed };
}

function pickPrivateTarget(state) {
  return (
    state.players.find((player) => !player.isHuman && player.alive && player.team === "good") ??
    state.players.find((player) => !player.isHuman && player.alive) ??
    null
  );
}

export async function runUnityCorePackageSmoke(options = {}) {
  const packageDir = options.packageDir ?? "";
  assert.ok(packageDir, "packageDir is required");
  const paths = packagePaths(packageDir, options.outputRoot ?? path.join("output", "unity-core-package-smoke"));
  const freshStartRuntimeFiles = assertNoStaleRuntimeFiles(paths.streamingAssets);
  const bridge = await import(pathToFileURL(paths.bridgeScript).href);
  const processUnityActionFile = bridge.processUnityActionFile;
  assert.equal(typeof processUnityActionFile, "function", "package bridge should export processUnityActionFile");

  const newGame = submit(processUnityActionFile, paths, "new-game", {
    scriptId: "tb",
    playerCount: 9,
    preferredHumanRoleId: "fortune-teller",
    seed: options.seed ?? 9014,
  });
  assert.equal(newGame.result.ok, true, newGame.result.reason);
  const nightAction = newGame.viewModel.humanNightAction;
  assert.equal(nightAction.available, true, "fresh Fortune Teller game should expose a night action");
  assert.equal(nightAction.roleId, "fortune-teller");
  assert.equal(nightAction.minTargetCount, 2);
  assert.equal(nightAction.maxTargetCount, 2);
  assert.equal(nightAction.targetCount, 2);
  const targetOptions = nightAction.options.slice(0, 2);
  const targetIds = targetOptions.map((entry) => entry.id);
  const targetNames = targetOptions.map((entry) => entry.name);
  assert.equal(targetIds.length, 2, "Fortune Teller smoke needs two legal targets");

  const emptyRejected = submit(processUnityActionFile, paths, "night-action", {});
  assert.equal(emptyRejected.result.ok, false, "empty Fortune Teller action should not auto-fill hidden targets");
  assert.equal(emptyRejected.viewModel.phase, "night");

  const rejected = submit(processUnityActionFile, paths, "night-action", { targetIds: targetIds.slice(0, 1) });
  assert.equal(rejected.result.ok, false, "one-target Fortune Teller action should be rejected");
  assert.equal(rejected.viewModel.phase, "night");

  const accepted = submit(processUnityActionFile, paths, "night-action", { targetIds });
  assert.equal(accepted.result.ok, true, accepted.result.reason);
  assert.equal(accepted.viewModel.phase, "day", "two-target Fortune Teller action should resolve into day/private");
  assert.equal(accepted.viewModel.humanNightAction.available, false);
  const privateInfo = accepted.viewModel.privateInfo ?? [];
  const acceptedState = readJson(paths.statePath).state;
  const infoPing = (acceptedState.events?.infoPings ?? []).find((entry) => entry.actorId === acceptedState.players.find((player) => player.isHuman)?.id && entry.type === "fortune-teller");
  assert.deepEqual(infoPing?.targetIds, targetIds, "privateInfo should be backed by a two-target Fortune Teller info ping");
  assert.ok(privateInfo.some((line) => /查验/.test(line) && /结果/.test(line)), "privateInfo should show the resolved check result");

  let state = readJson(paths.statePath).state;
  const chatTarget = pickPrivateTarget(state);
  assert.ok(chatTarget?.id, "package smoke needs a private chat target");
  const chatPrompts = [
    { text: "你是什么身份？", intent: "claim" },
    { text: "你昨晚得到了什么信息？", intent: "night" },
  ];
  const privateChats = [];
  for (const prompt of chatPrompts) {
    const beforeTimelineCount = readJson(paths.statePath).state.aiDialogue?.timeline?.length ?? 0;
    const chat = submit(processUnityActionFile, paths, "private-chat", {
      targetId: chatTarget.id,
      text: prompt.text,
      intent: prompt.intent,
    });
    assert.equal(chat.result.ok, true, chat.result.reason);
    state = readJson(paths.statePath).state;
    const newEntries = (state.aiDialogue?.timeline ?? []).slice(beforeTimelineCount);
    const outgoing = newEntries.find((entry) => entry.mode === "whisper-out" && entry.targetId === chatTarget.id);
    const incoming = [...newEntries].reverse().find((entry) => entry.mode === "whisper-in" && entry.speakerId === chatTarget.id);
    assert.equal(outgoing?.text, prompt.text, "private-chat should preserve outgoing text");
    assert.equal(outgoing?.intent, prompt.intent, "private-chat should preserve outgoing intent");
    assert.ok(incoming?.text, "private-chat should produce an AI reply");
    privateChats.push({
      prompt,
      outgoing: { text: outgoing.text, intent: outgoing.intent },
      incoming: { text: incoming.text, intent: incoming.intent ?? "" },
    });
  }

  const evidence = {
    ok: true,
    packageDir: paths.packagePath,
    freshStartRuntimeFiles,
    fortuneTeller: {
      minTargetCount: nightAction.minTargetCount,
      maxTargetCount: nightAction.maxTargetCount,
      targetCount: nightAction.targetCount,
      targetIds,
      targetNames,
      emptyTargetRejected: emptyRejected.result.ok === false,
      singleTargetRejected: rejected.result.ok === false,
      submittedPayload: accepted.action.payload,
      settledInfoPingTargetIds: infoPing?.targetIds ?? [],
      privateInfo,
      phaseAfterSubmit: accepted.viewModel.phase,
      dayStageAfterSubmit: accepted.viewModel.dayStage,
    },
    privateChats,
    artifactDir: paths.harnessRoot,
  };
  writeJson(paths.evidencePath, evidence);
  return evidence;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2));
  const evidence = await runUnityCorePackageSmoke({
    packageDir: argValue(args, "package-dir", argValue(args, "package", "")),
    outputRoot: argValue(args, "out", path.join("output", "unity-core-package-smoke")),
    seed: Number(argValue(args, "seed", "9014")) || 9014,
  });
  console.log(JSON.stringify(evidence, null, 2));
}
