import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { applyLLMDialoguePostprocess, processUnityActionFile, processUnityActionFileAsync } from "../scripts/unity_action_bridge.mjs";
import { initializeAI } from "../scripts/ai.js";
import { PLAYER_VISIBLE_FORBIDDEN_TERMS } from "../scripts/ai_speech_renderer.js";
import { getAllRoles, getRoleById } from "../scripts/data.js";
import {
  advanceDayStage,
  beginNightPhase,
  createNewGame,
  endDayAndBeginNight,
  markPublicDiscussionRound,
  resolveNominationAndVote,
  runNight,
  setHumanNightActionPlan,
  withSeededRandom,
} from "../scripts/engine.js";

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

function assertNoPlayerVisibleForbiddenTerms(text, context) {
  const value = `${text ?? ""}`;
  for (const term of PLAYER_VISIBLE_FORBIDDEN_TERMS) {
    assert.equal(value.includes(term), false, `${context} should not expose internal analysis term "${term}": ${value}`);
  }
}

function applyRole(state, player, roleId) {
  const role = getRoleById(state.scriptId, roleId);
  assert.ok(role, `expected role ${roleId}`);
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
  player.tags = [...(role.tags ?? [])];
}

function compactForLineMatch(value) {
  return `${value ?? ""}`.replace(/\s+/g, "");
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

function testUnityNewGameClearsTransientDialogueState() {
  const firstAction = writeAction("new-game", { scriptId: "tb", playerCount: 9, preferredHumanRoleId: "washerwoman", seed: 12345 });
  let processed = process();
  assert.equal(processed.result.ok, true, firstAction.id);
  resolveFirstNightIfNeeded();

  const dirty = readState();
  dirty.aiDialogue = dirty.aiDialogue ?? {};
  dirty.aiDialogue.pendingProactiveWhispers = [
    {
      id: "stale-offer",
      playerId: dirty.players.find((player) => !player.isHuman)?.id ?? "p2",
      reason: "旧私聊内容不应带入新局",
      prompt: "旧 prompt 不应带入新局",
      day: dirty.day,
    },
  ];
  dirty.dayStageMeta = dirty.dayStageMeta ?? {};
  dirty.dayStageMeta.publicConversation = {
    step: 3,
    clock: "nomination-ready",
    lastStep: { speakerId: "old-speaker", targetId: "old-target", line: "旧公聊不应带入新局" },
  };
  dirty.unityBridge = dirty.unityBridge ?? {};
  dirty.unityBridge.lastActionId = "old-action-result";
  dirty.unityBridge.lastActionType = "ai-public-step";
  dirty.unityBridge.message = "old action result";
  writeState(dirty);

  const newAction = writeAction("new-game", { scriptId: "snv", playerCount: 9, preferredHumanRoleId: "clockmaker", seed: 67890 });
  processed = process({ scriptId: "snv", preferredHumanRoleId: "clockmaker" });
  assert.equal(processed.result.ok, true, processed.result.reason);
  assert.equal(processed.viewModel.action.lastActionId, newAction.id);
  assert.equal(processed.viewModel.action.lastActionType, "new-game");
  assert.equal(processed.viewModel.pendingProactiveWhispers.length, 0, "new game should not expose stale proactive offers");
  assert.equal(processed.viewModel.publicConversation.step, 0, "new game should not keep stale public conversation progress");
  assert.equal(processed.viewModel.publicConversation.lastStep, null, "new game should not keep stale public conversation step");
  assert.equal(JSON.stringify(processed.viewModel).includes("old action result"), false, "new game should not expose stale action result text");
  assert.equal(JSON.stringify(processed.viewModel).includes("旧私聊内容不应带入新局"), false, "new game should not expose stale private text");
}

function testUnityBridgeCliAcceptsInlineQuotedPathsFromCSharp() {
  const dir = path.join(root, "inline-quoted-cli");
  fs.mkdirSync(dir, { recursive: true });
  const quotedStatePath = path.join(dir, "unity_state.json");
  const quotedViewModelPath = path.join(dir, "unity_viewmodel.json");
  const quotedActionPath = path.join(dir, "unity_action.json");
  const quotedResultPath = path.join(dir, "unity_action_result.json");
  const action = {
    id: "inline-quoted-new-game",
    type: "new-game",
    createdAt: new Date().toISOString(),
    payload: { scriptId: "bmr", playerCount: 9, preferredHumanRoleId: "zombuul", seed: 20260609 },
  };
  fs.writeFileSync(quotedActionPath, `${JSON.stringify(action, null, 2)}\n`, "utf8");

  const cli = spawnSync(
    globalThis.process.execPath,
    [
      path.resolve("scripts", "unity_action_bridge.mjs"),
      `--state="${quotedStatePath}"`,
      `--viewmodel="${quotedViewModelPath}"`,
      `--action="${quotedActionPath}"`,
      `--result="${quotedResultPath}"`,
      "--script=bmr",
      "--role=zombuul",
      "--players=9",
      "--seed=20260609",
    ],
    { encoding: "utf8" }
  );

  assert.equal(cli.status, 0, `bridge CLI should accept C# inline quoted paths: ${cli.stderr || cli.stdout}`);
  assert.ok(fs.existsSync(quotedResultPath), "result should be written to the unquoted target path");
  assert.ok(fs.existsSync(quotedViewModelPath), "viewmodel should be written to the unquoted target path");
  const result = JSON.parse(fs.readFileSync(quotedResultPath, "utf8"));
  assert.equal(result.actionId, action.id);
  assert.equal(result.ok, true);
}

function testUnitySubmitGuidedPitHagDefaultDoesNotRemoveOnlyDemon() {
  const dir = path.join(root, "guided-pit-hag-default");
  fs.mkdirSync(dir, { recursive: true });
  const localStatePath = path.join(dir, "unity_state.json");
  const localViewModelPath = path.join(dir, "unity_viewmodel.json");
  const state = createNewGame({ scriptId: "snv", playerCount: 9, preferredHumanRoleId: "pit-hag" }, withSeededRandom(320003));
  initializeAI(state);
  const human = state.players.find((player) => player.isHuman);
  const demon = state.players.find((player) => player.category === "demon" && player.alive);
  const safeTarget = state.players.find((player) => !player.isHuman && player.alive && player.category !== "demon");
  assert.ok(human, "fixture needs human Pit-Hag");
  assert.ok(demon, "fixture needs a living demon");
  assert.ok(safeTarget, "fixture needs a non-demon target");
  applyRole(state, human, "pit-hag");
  state.phase = "night";
  state.night = 2;
  fs.writeFileSync(localStatePath, `${JSON.stringify({ state }, null, 2)}\n`, "utf8");

  const roleOptions = getAllRoles("snv").map((role) => ({
    id: role.id,
    name: role.name,
    category: role.category,
    team: role.team,
  }));
  const viewModel = {
    phase: "night",
    gameOver: false,
    humanNightAction: {
      available: true,
      roleId: "pit-hag",
      roleName: "Pit-Hag",
      inputType: "player-role",
      minTargetCount: 1,
      maxTargetCount: 1,
      targetCount: 1,
      options: [
        { id: demon.id, name: "demon-first", seat: demon.seatIndex + 1, alive: true },
        { id: safeTarget.id, name: "safe-target", seat: safeTarget.seatIndex + 1, alive: true },
      ],
      selectedTargetIds: [demon.id],
      roleOptions,
    },
  };
  fs.writeFileSync(localViewModelPath, `${JSON.stringify(viewModel, null, 2)}\n`, "utf8");

  const cli = spawnSync(
    globalThis.process.execPath,
    [
      path.resolve("scripts", "submit_unity_night_action.mjs"),
      `--streaming-assets=${dir}`,
      "--dry-run",
    ],
    { encoding: "utf8" }
  );

  assert.equal(cli.status, 0, `guided Pit-Hag dry-run should succeed: ${cli.stderr || cli.stdout}`);
  const action = JSON.parse(cli.stdout);
  assert.deepEqual(action.payload.targetIds, [safeTarget.id], "guided Pit-Hag default should avoid targeting the only demon");
  assert.equal(
    action.payload.roleId,
    safeTarget.roleId,
    "guided Pit-Hag default should no-op the safe target instead of choosing the first role option"
  );
}

function testUnitySubmitGuidedBarberDefaultUsesEvilAllyAndBestGoodRole() {
  const dir = path.join(root, "guided-barber-default");
  fs.mkdirSync(dir, { recursive: true });
  const localStatePath = path.join(dir, "unity_state.json");
  const localViewModelPath = path.join(dir, "unity_viewmodel.json");
  const state = createNewGame({ scriptId: "snv", playerCount: 9, preferredHumanRoleId: "fang-gu" }, withSeededRandom(330002));
  initializeAI(state);
  const human = state.players.find((player) => player.isHuman);
  const evilAlly = state.players.find((player) => !player.isHuman && player.team === "evil");
  const goodDreamer = state.players.find((player) => !player.isHuman && player.team === "good");
  const firstGood = state.players.find((player) => !player.isHuman && player.team === "good" && player.id !== goodDreamer?.id);
  const secondGood = state.players.find(
    (player) => !player.isHuman && player.team === "good" && ![goodDreamer?.id, firstGood?.id].includes(player.id)
  );
  assert.ok(human, "fixture needs human demon");
  assert.ok(evilAlly, "fixture needs evil non-demon ally");
  assert.ok(goodDreamer, "fixture needs strong good target");
  assert.ok(firstGood && secondGood, "fixture needs ordinary good options before the strategic choices");
  applyRole(state, human, "fang-gu");
  applyRole(state, evilAlly, "witch");
  applyRole(state, goodDreamer, "dreamer");
  applyRole(state, firstGood, "sweetheart");
  applyRole(state, secondGood, "klutz");
  state.phase = "day";
  fs.writeFileSync(localStatePath, `${JSON.stringify({ state }, null, 2)}\n`, "utf8");

  const viewModel = {
    phase: "day",
    gameOver: false,
    pendingStorytellerAction: {
      available: true,
      type: "barber-swap",
      roleId: "barber",
      roleName: "Barber",
      inputType: "player-target",
      minTargetCount: 2,
      maxTargetCount: 2,
      targetCount: 2,
      options: [
        { id: firstGood.id, name: "first-good", seat: firstGood.seatIndex + 1, alive: true },
        { id: secondGood.id, name: "second-good", seat: secondGood.seatIndex + 1, alive: true },
        { id: evilAlly.id, name: "evil-ally", seat: evilAlly.seatIndex + 1, alive: true },
        { id: goodDreamer.id, name: "good-dreamer", seat: goodDreamer.seatIndex + 1, alive: true },
      ],
    },
  };
  fs.writeFileSync(localViewModelPath, `${JSON.stringify(viewModel, null, 2)}\n`, "utf8");

  const cli = spawnSync(
    globalThis.process.execPath,
    [
      path.resolve("scripts", "submit_unity_night_action.mjs"),
      `--streaming-assets=${dir}`,
      "--storyteller-action",
      "--dry-run",
    ],
    { encoding: "utf8" }
  );

  assert.equal(cli.status, 0, `guided Barber dry-run should succeed: ${cli.stderr || cli.stdout}`);
  const action = JSON.parse(cli.stdout);
  assert.deepEqual(
    action.payload.targetIds,
    [evilAlly.id, goodDreamer.id],
    "guided Barber default should pair the evil ally with the strongest visible good role instead of taking the first two options"
  );
}

function testUnitySubmitGuidedKlutzDefaultChoosesGoodUnlessExplicit() {
  const dir = path.join(root, "guided-klutz-default");
  fs.mkdirSync(dir, { recursive: true });
  const localStatePath = path.join(dir, "unity_state.json");
  const localViewModelPath = path.join(dir, "unity_viewmodel.json");
  const state = createNewGame({ scriptId: "snv", playerCount: 9, preferredHumanRoleId: "klutz" }, withSeededRandom(330006));
  initializeAI(state);
  const human = state.players.find((player) => player.isHuman);
  const evilTarget = state.players.find((player) => !player.isHuman && player.team === "evil");
  const goodTarget = state.players.find((player) => !player.isHuman && player.team === "good");
  assert.ok(human, "fixture needs human Klutz");
  assert.ok(evilTarget, "fixture needs evil target");
  assert.ok(goodTarget, "fixture needs good target");
  applyRole(state, human, "klutz");
  applyRole(state, evilTarget, "witch");
  applyRole(state, goodTarget, "dreamer");
  state.phase = "day";
  human.alive = false;
  fs.writeFileSync(localStatePath, `${JSON.stringify({ state }, null, 2)}\n`, "utf8");

  const viewModel = {
    phase: "day",
    gameOver: false,
    pendingStorytellerAction: {
      available: true,
      type: "klutz-choice",
      roleId: "klutz",
      roleName: "Klutz",
      inputType: "player-target",
      minTargetCount: 1,
      maxTargetCount: 1,
      targetCount: 1,
      options: [
        { id: evilTarget.id, name: "evil-target", seat: evilTarget.seatIndex + 1, alive: true },
        { id: goodTarget.id, name: "good-target", seat: goodTarget.seatIndex + 1, alive: true },
      ],
    },
  };
  fs.writeFileSync(localViewModelPath, `${JSON.stringify(viewModel, null, 2)}\n`, "utf8");

  const defaultCli = spawnSync(
    globalThis.process.execPath,
    [
      path.resolve("scripts", "submit_unity_night_action.mjs"),
      `--streaming-assets=${dir}`,
      "--storyteller-action",
      "--dry-run",
    ],
    { encoding: "utf8" }
  );
  assert.equal(defaultCli.status, 0, `guided Klutz dry-run should succeed: ${defaultCli.stderr || defaultCli.stdout}`);
  const defaultAction = JSON.parse(defaultCli.stdout);
  assert.deepEqual(
    defaultAction.payload.targetIds,
    [goodTarget.id],
    "guided Klutz default should choose a known-good target instead of ending the game on the first evil option"
  );

  const explicitCli = spawnSync(
    globalThis.process.execPath,
    [
      path.resolve("scripts", "submit_unity_night_action.mjs"),
      `--streaming-assets=${dir}`,
      "--storyteller-action",
      `--target=${evilTarget.id}`,
      "--dry-run",
    ],
    { encoding: "utf8" }
  );
  assert.equal(explicitCli.status, 0, `explicit Klutz dry-run should succeed: ${explicitCli.stderr || explicitCli.stdout}`);
  const explicitAction = JSON.parse(explicitCli.stdout);
  assert.deepEqual(
    explicitAction.payload.targetIds,
    [evilTarget.id],
    "explicit Klutz target should remain under player control even when it loses immediately"
  );
}

function testUnitySubmitGuidedProfessorDefaultPrefersDeadTownsfolkUnlessExplicit() {
  const dir = path.join(root, "guided-professor-default");
  fs.mkdirSync(dir, { recursive: true });
  const localStatePath = path.join(dir, "unity_state.json");
  const localViewModelPath = path.join(dir, "unity_viewmodel.json");
  const localActionPath = path.join(dir, "unity_action.json");
  const localResultPath = path.join(dir, "unity_action_result.json");
  const state = createNewGame({ scriptId: "bmr", playerCount: 9, preferredHumanRoleId: "professor" }, withSeededRandom(340003));
  initializeAI(state);
  const human = state.players.find((player) => player.isHuman);
  const deadOutsider = state.players.find((player) => !player.isHuman);
  const deadTownsfolk = state.players.find((player) => !player.isHuman && player.id !== deadOutsider?.id);
  assert.ok(human && deadOutsider && deadTownsfolk, "fixture needs a Professor, a dead outsider, and a dead townsfolk");
  applyRole(state, human, "professor");
  applyRole(state, deadOutsider, "moonchild");
  applyRole(state, deadTownsfolk, "grandmother");
  deadOutsider.alive = false;
  deadTownsfolk.alive = false;
  state.phase = "night";
  state.night = 2;
  fs.writeFileSync(localStatePath, `${JSON.stringify({ state }, null, 2)}\n`, "utf8");

  const viewModel = {
    phase: "night",
    gameOver: false,
    humanNightAction: {
      available: true,
      roleId: "professor",
      roleName: "Professor",
      inputType: "player-target",
      minTargetCount: 1,
      maxTargetCount: 1,
      targetCount: 1,
      selectedTargetIds: [deadOutsider.id],
      options: [
        { id: deadOutsider.id, name: "dead-outsider", seat: deadOutsider.seatIndex + 1, alive: false },
        { id: deadTownsfolk.id, name: "dead-townsfolk", seat: deadTownsfolk.seatIndex + 1, alive: false },
      ],
    },
  };
  fs.writeFileSync(localViewModelPath, `${JSON.stringify(viewModel, null, 2)}\n`, "utf8");

  const defaultCli = spawnSync(
    globalThis.process.execPath,
    [
      path.resolve("scripts", "submit_unity_night_action.mjs"),
      `--streaming-assets=${dir}`,
      "--dry-run",
    ],
    { encoding: "utf8" }
  );
  assert.equal(defaultCli.status, 0, `guided Professor dry-run should succeed: ${defaultCli.stderr || defaultCli.stdout}`);
  const defaultAction = JSON.parse(defaultCli.stdout);
  assert.deepEqual(
    defaultAction.payload.targetIds,
    [deadTownsfolk.id],
    "guided Professor default should revive a dead townsfolk instead of following a dead outsider default"
  );

  const explicitCli = spawnSync(
    globalThis.process.execPath,
    [
      path.resolve("scripts", "submit_unity_night_action.mjs"),
      `--streaming-assets=${dir}`,
      `--target=${deadOutsider.id}`,
      "--dry-run",
    ],
    { encoding: "utf8" }
  );
  assert.equal(explicitCli.status, 0, `explicit Professor dry-run should succeed: ${explicitCli.stderr || explicitCli.stdout}`);
  const explicitAction = JSON.parse(explicitCli.stdout);
  assert.deepEqual(
    explicitAction.payload.targetIds,
    [deadOutsider.id],
    "explicit Professor target should stay under player control"
  );

  const bridgeAction = {
    id: "guided-professor-revive-contract",
    type: "night-action",
    payload: defaultAction.payload,
    createdAt: new Date().toISOString(),
  };
  fs.writeFileSync(localActionPath, `${JSON.stringify(bridgeAction, null, 2)}\n`, "utf8");
  const processed = processUnityActionFile({
    statePath: localStatePath,
    viewModelPath: localViewModelPath,
    actionPath: localActionPath,
    resultPath: localResultPath,
    scriptId: "bmr",
    playerCount: 9,
    preferredHumanRoleId: "professor",
    seed: 340003,
  });
  assert.equal(processed.result.ok, true, processed.result.reason);
  const resolvedState = JSON.parse(fs.readFileSync(localStatePath, "utf8")).state;
  assert.ok(
    resolvedState.logs.some((entry) => entry.type === "night-effect" && entry.payload?.targetId === deadTownsfolk.id),
    "guided Professor default should resolve through the Unity bridge into a concrete revive effect"
  );

  const skipDir = path.join(root, "guided-professor-skip");
  fs.mkdirSync(skipDir, { recursive: true });
  const skipStatePath = path.join(skipDir, "unity_state.json");
  const skipViewModelPath = path.join(skipDir, "unity_viewmodel.json");
  const skipActionPath = path.join(skipDir, "unity_action.json");
  const skipResultPath = path.join(skipDir, "unity_action_result.json");
  const skipState = createNewGame({ scriptId: "bmr", playerCount: 9, preferredHumanRoleId: "professor" }, withSeededRandom(340004));
  initializeAI(skipState);
  const skipHuman = skipState.players.find((player) => player.isHuman);
  const onlyDeadOutsider = skipState.players.find((player) => !player.isHuman);
  const livingTownsfolk = skipState.players.find((player) => !player.isHuman && player.id !== onlyDeadOutsider?.id);
  assert.ok(skipHuman && onlyDeadOutsider && livingTownsfolk, "skip fixture needs a Professor, a dead outsider, and a living townsfolk");
  applyRole(skipState, skipHuman, "professor");
  applyRole(skipState, onlyDeadOutsider, "moonchild");
  applyRole(skipState, livingTownsfolk, "grandmother");
  skipState.players
    .filter((player) => player.category === "townsfolk" && !player.isHuman)
    .forEach((player) => {
      player.alive = true;
    });
  onlyDeadOutsider.alive = false;
  skipState.phase = "night";
  skipState.night = 2;
  fs.writeFileSync(skipStatePath, `${JSON.stringify({ state: skipState }, null, 2)}\n`, "utf8");
  fs.writeFileSync(
    skipViewModelPath,
    `${JSON.stringify(
      {
        phase: "night",
        gameOver: false,
        humanNightAction: {
          available: true,
          roleId: "professor",
          roleName: "Professor",
          inputType: "player-target",
          minTargetCount: 1,
          maxTargetCount: 1,
          targetCount: 1,
          optional: true,
          selectedTargetIds: [onlyDeadOutsider.id],
          options: [{ id: onlyDeadOutsider.id, name: "dead-outsider", seat: onlyDeadOutsider.seatIndex + 1, alive: false }],
        },
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  const skipCli = spawnSync(
    globalThis.process.execPath,
    [
      path.resolve("scripts", "submit_unity_night_action.mjs"),
      `--streaming-assets=${skipDir}`,
      "--dry-run",
    ],
    { encoding: "utf8" }
  );
  assert.equal(skipCli.status, 0, `guided Professor skip dry-run should succeed: ${skipCli.stderr || skipCli.stdout}`);
  const skipAction = JSON.parse(skipCli.stdout);
  assert.deepEqual(skipAction.payload, { mode: "skip" }, "guided Professor should wait instead of spending revive on a non-Townsfolk corpse");

  fs.writeFileSync(
    skipActionPath,
    `${JSON.stringify(
      {
        id: "guided-professor-skip-contract",
        type: "night-action",
        payload: skipAction.payload,
        createdAt: new Date().toISOString(),
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  const skipped = processUnityActionFile({
    statePath: skipStatePath,
    viewModelPath: skipViewModelPath,
    actionPath: skipActionPath,
    resultPath: skipResultPath,
    scriptId: "bmr",
    playerCount: 9,
    preferredHumanRoleId: "professor",
    seed: 340004,
  });
  assert.equal(skipped.result.ok, true, skipped.result.reason);
  const skippedState = JSON.parse(fs.readFileSync(skipStatePath, "utf8")).state;
  assert.equal(
    skippedState.bmr.professorUsedByIds.includes(skipHuman.id),
    false,
    "guided Professor skip should not consume the once-per-game revive"
  );
  assert.equal(
    skippedState.logs.some((entry) => entry.payload?.by === skipHuman.id && entry.payload?.targetId === onlyDeadOutsider.id),
    false,
    "guided Professor skip should not resolve as a failed revive against the dead outsider"
  );

  const autoDir = path.join(root, "guided-professor-auto-skip");
  fs.mkdirSync(autoDir, { recursive: true });
  const autoStatePath = path.join(autoDir, "unity_state.json");
  const autoViewModelPath = path.join(autoDir, "unity_viewmodel.json");
  const autoActionPath = path.join(autoDir, "unity_action.json");
  const autoResultPath = path.join(autoDir, "unity_action_result.json");
  const autoState = createNewGame({ scriptId: "bmr", playerCount: 9, preferredHumanRoleId: "professor" }, withSeededRandom(340005));
  initializeAI(autoState);
  const autoHuman = autoState.players.find((player) => player.isHuman);
  const autoDeadOutsider = autoState.players.find((player) => !player.isHuman);
  const autoLivingTownsfolk = autoState.players.find((player) => !player.isHuman && player.id !== autoDeadOutsider?.id);
  assert.ok(autoHuman && autoDeadOutsider && autoLivingTownsfolk, "auto-skip fixture needs a Professor, a dead outsider, and a living townsfolk");
  applyRole(autoState, autoHuman, "professor");
  applyRole(autoState, autoDeadOutsider, "moonchild");
  applyRole(autoState, autoLivingTownsfolk, "grandmother");
  autoState.players
    .filter((player) => player.category === "townsfolk" && !player.isHuman)
    .forEach((player) => {
      player.alive = true;
    });
  autoDeadOutsider.alive = false;
  autoState.phase = "night";
  autoState.night = 2;
  fs.writeFileSync(autoStatePath, `${JSON.stringify({ state: autoState }, null, 2)}\n`, "utf8");
  fs.writeFileSync(
    autoActionPath,
    `${JSON.stringify(
      {
        id: "guided-professor-auto-skip-contract",
        type: "auto-advance",
        payload: { mode: "full-auto", maxSteps: 1 },
        createdAt: new Date().toISOString(),
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  const autoSkipped = processUnityActionFile({
    statePath: autoStatePath,
    viewModelPath: autoViewModelPath,
    actionPath: autoActionPath,
    resultPath: autoResultPath,
    scriptId: "bmr",
    playerCount: 9,
    preferredHumanRoleId: "professor",
    seed: 340005,
  });
  assert.equal(autoSkipped.result.ok, true, autoSkipped.result.reason);
  const autoSkippedState = JSON.parse(fs.readFileSync(autoStatePath, "utf8")).state;
  assert.equal(
    autoSkippedState.bmr.professorUsedByIds.includes(autoHuman.id),
    false,
    "Unity full-auto should not spend Professor on a corpse that cannot revive"
  );
  assert.equal(
    autoSkippedState.logs.some((entry) => entry.payload?.by === autoHuman.id && entry.payload?.targetId === autoDeadOutsider.id),
    false,
    "Unity full-auto should not convert optional Professor wait into a failed revive"
  );
}

function testUnitySubmitGuidedDemonKillAvoidsEvilAllyUnlessExplicit() {
  const dir = path.join(root, "guided-demon-kill-default");
  fs.mkdirSync(dir, { recursive: true });
  const localStatePath = path.join(dir, "unity_state.json");
  const localViewModelPath = path.join(dir, "unity_viewmodel.json");
  const state = createNewGame({ scriptId: "snv", playerCount: 9, preferredHumanRoleId: "vortox" }, withSeededRandom(330003));
  initializeAI(state);
  const human = state.players.find((player) => player.isHuman);
  const evilAlly = state.players.find((player) => !player.isHuman && player.team === "evil");
  const goodDreamer = state.players.find((player) => !player.isHuman && player.team === "good");
  const firstGood = state.players.find((player) => !player.isHuman && player.team === "good" && player.id !== goodDreamer?.id);
  assert.ok(human, "fixture needs human demon");
  assert.ok(evilAlly, "fixture needs evil ally");
  assert.ok(goodDreamer, "fixture needs strong good target");
  assert.ok(firstGood, "fixture needs a lower-value good target");
  applyRole(state, human, "vortox");
  applyRole(state, evilAlly, "witch");
  applyRole(state, goodDreamer, "dreamer");
  applyRole(state, firstGood, "klutz");
  state.phase = "night";
  state.night = 2;
  fs.writeFileSync(localStatePath, `${JSON.stringify({ state }, null, 2)}\n`, "utf8");

  const viewModel = {
    phase: "night",
    gameOver: false,
    humanNightAction: {
      available: true,
      roleId: "vortox",
      roleName: "Vortox",
      inputType: "player-target",
      minTargetCount: 1,
      maxTargetCount: 1,
      targetCount: 1,
      options: [
        { id: evilAlly.id, name: "evil-ally", seat: evilAlly.seatIndex + 1, alive: true },
        { id: firstGood.id, name: "first-good", seat: firstGood.seatIndex + 1, alive: true },
        { id: goodDreamer.id, name: "good-dreamer", seat: goodDreamer.seatIndex + 1, alive: true },
      ],
    },
  };
  fs.writeFileSync(localViewModelPath, `${JSON.stringify(viewModel, null, 2)}\n`, "utf8");

  const defaultCli = spawnSync(
    globalThis.process.execPath,
    [
      path.resolve("scripts", "submit_unity_night_action.mjs"),
      `--streaming-assets=${dir}`,
      "--dry-run",
    ],
    { encoding: "utf8" }
  );
  assert.equal(defaultCli.status, 0, `guided demon kill dry-run should succeed: ${defaultCli.stderr || defaultCli.stdout}`);
  const defaultAction = JSON.parse(defaultCli.stdout);
  assert.deepEqual(
    defaultAction.payload.targetIds,
    [goodDreamer.id],
    "guided demon kill default should skip the evil ally and choose the highest-value good target"
  );

  const explicitCli = spawnSync(
    globalThis.process.execPath,
    [
      path.resolve("scripts", "submit_unity_night_action.mjs"),
      `--streaming-assets=${dir}`,
      `--target=${evilAlly.id}`,
      "--dry-run",
    ],
    { encoding: "utf8" }
  );
  assert.equal(explicitCli.status, 0, `explicit demon kill dry-run should succeed: ${explicitCli.stderr || explicitCli.stdout}`);
  const explicitAction = JSON.parse(explicitCli.stdout);
  assert.deepEqual(
    explicitAction.payload.targetIds,
    [evilAlly.id],
    "explicit demon kill target should remain under player control"
  );
}

function testUnitySubmitGuidedDemonKillPivotsAfterFailedDefaultTarget() {
  const dir = path.join(root, "guided-demon-kill-failed-target-pivot");
  fs.mkdirSync(dir, { recursive: true });
  const localStatePath = path.join(dir, "unity_state.json");
  const localViewModelPath = path.join(dir, "unity_viewmodel.json");
  const state = createNewGame({ scriptId: "bmr", playerCount: 9, preferredHumanRoleId: "zombuul" }, withSeededRandom(330013));
  initializeAI(state);
  const human = state.players.find((player) => player.isHuman);
  const protectedInfoTarget = state.players.find((player) => !player.isHuman && player.team === "good");
  const alternateGood = state.players.find(
    (player) => !player.isHuman && player.team === "good" && player.id !== protectedInfoTarget?.id
  );
  assert.ok(human, "fixture needs human Zombuul");
  assert.ok(protectedInfoTarget, "fixture needs a high-value good target");
  assert.ok(alternateGood, "fixture needs an alternate good target");
  applyRole(state, human, "zombuul");
  applyRole(state, protectedInfoTarget, "courtier");
  applyRole(state, alternateGood, "gambler");
  state.phase = "night";
  state.day = 3;
  state.night = 4;
  state.logs = [
    ...(state.logs ?? []),
    {
      day: 2,
      night: 3,
      type: "night-plan",
      text: "contract previous Zombuul target",
      payload: {
        private: true,
        playerId: human.id,
        roleId: "zombuul",
        night: 3,
        targetIds: [protectedInfoTarget.id],
      },
    },
  ];
  state.events.nightDeaths = (state.events.nightDeaths ?? []).filter((entry) => entry.playerId !== protectedInfoTarget.id);
  fs.writeFileSync(localStatePath, `${JSON.stringify({ state }, null, 2)}\n`, "utf8");

  const viewModel = {
    phase: "night",
    gameOver: false,
    humanNightAction: {
      available: true,
      roleId: "zombuul",
      roleName: "Zombuul",
      inputType: "player-target",
      minTargetCount: 1,
      maxTargetCount: 1,
      targetCount: 1,
      selectedTargetIds: [protectedInfoTarget.id],
      options: [
        { id: protectedInfoTarget.id, name: "protected-info", seat: protectedInfoTarget.seatIndex + 1, alive: true },
        { id: alternateGood.id, name: "alternate-good", seat: alternateGood.seatIndex + 1, alive: true },
      ],
    },
  };
  fs.writeFileSync(localViewModelPath, `${JSON.stringify(viewModel, null, 2)}\n`, "utf8");

  const cli = spawnSync(
    globalThis.process.execPath,
    [
      path.resolve("scripts", "submit_unity_night_action.mjs"),
      `--streaming-assets=${dir}`,
      "--dry-run",
    ],
    { encoding: "utf8" }
  );
  assert.equal(cli.status, 0, `guided Zombuul dry-run should succeed: ${cli.stderr || cli.stdout}`);
  const action = JSON.parse(cli.stdout);
  assert.deepEqual(
    action.payload.targetIds,
    [alternateGood.id],
    "guided demon kill should ignore stale UI defaults and pivot after a recent target produced no night death"
  );
}

function testUnitySubmitGuidedFangGuDefaultJumpsToOutsiderBeforeInfoKill() {
  const dir = path.join(root, "guided-fang-gu-jump-default");
  fs.mkdirSync(dir, { recursive: true });
  const localStatePath = path.join(dir, "unity_state.json");
  const localViewModelPath = path.join(dir, "unity_viewmodel.json");
  const state = createNewGame({ scriptId: "snv", playerCount: 9, preferredHumanRoleId: "fang-gu" }, withSeededRandom(330004));
  initializeAI(state);
  const human = state.players.find((player) => player.isHuman);
  const evilAlly = state.players.find((player) => !player.isHuman && player.team === "evil");
  const goodDreamer = state.players.find((player) => !player.isHuman && player.team === "good");
  const goodMutant = state.players.find((player) => !player.isHuman && player.team === "good" && player.id !== goodDreamer?.id);
  assert.ok(human, "fixture needs human Fang Gu");
  assert.ok(evilAlly, "fixture needs evil ally");
  assert.ok(goodDreamer, "fixture needs high-value townsfolk target");
  assert.ok(goodMutant, "fixture needs good outsider jump target");
  applyRole(state, human, "fang-gu");
  applyRole(state, evilAlly, "witch");
  applyRole(state, goodDreamer, "dreamer");
  applyRole(state, goodMutant, "mutant");
  state.phase = "night";
  state.night = 2;
  state.snv.fangGuJumpUsed = false;
  fs.writeFileSync(localStatePath, `${JSON.stringify({ state }, null, 2)}\n`, "utf8");

  const viewModel = {
    phase: "night",
    gameOver: false,
    humanNightAction: {
      available: true,
      roleId: "fang-gu",
      roleName: "Fang Gu",
      inputType: "player-target",
      minTargetCount: 1,
      maxTargetCount: 1,
      targetCount: 1,
      options: [
        { id: evilAlly.id, name: "evil-ally", seat: evilAlly.seatIndex + 1, alive: true },
        { id: goodDreamer.id, name: "good-dreamer", seat: goodDreamer.seatIndex + 1, alive: true },
        { id: goodMutant.id, name: "good-mutant", seat: goodMutant.seatIndex + 1, alive: true },
      ],
    },
  };
  fs.writeFileSync(localViewModelPath, `${JSON.stringify(viewModel, null, 2)}\n`, "utf8");

  const jumpCli = spawnSync(
    globalThis.process.execPath,
    [
      path.resolve("scripts", "submit_unity_night_action.mjs"),
      `--streaming-assets=${dir}`,
      "--dry-run",
    ],
    { encoding: "utf8" }
  );
  assert.equal(jumpCli.status, 0, `guided Fang Gu jump dry-run should succeed: ${jumpCli.stderr || jumpCli.stdout}`);
  const jumpAction = JSON.parse(jumpCli.stdout);
  assert.deepEqual(
    jumpAction.payload.targetIds,
    [goodMutant.id],
    "guided Fang Gu default should use the unused outsider jump before killing a stronger townsfolk"
  );

  state.snv.fangGuJumpUsed = true;
  fs.writeFileSync(localStatePath, `${JSON.stringify({ state }, null, 2)}\n`, "utf8");
  const spentCli = spawnSync(
    globalThis.process.execPath,
    [
      path.resolve("scripts", "submit_unity_night_action.mjs"),
      `--streaming-assets=${dir}`,
      "--dry-run",
    ],
    { encoding: "utf8" }
  );
  assert.equal(spentCli.status, 0, `spent Fang Gu jump dry-run should succeed: ${spentCli.stderr || spentCli.stdout}`);
  const spentAction = JSON.parse(spentCli.stdout);
  assert.deepEqual(
    spentAction.payload.targetIds,
    [goodDreamer.id],
    "guided Fang Gu default should return to high-value good kills after the jump is spent"
  );

  state.snv.fangGuJumpUsed = false;
  fs.writeFileSync(localStatePath, `${JSON.stringify({ state }, null, 2)}\n`, "utf8");
  const explicitCli = spawnSync(
    globalThis.process.execPath,
    [
      path.resolve("scripts", "submit_unity_night_action.mjs"),
      `--streaming-assets=${dir}`,
      `--target=${goodDreamer.id}`,
      "--dry-run",
    ],
    { encoding: "utf8" }
  );
  assert.equal(explicitCli.status, 0, `explicit Fang Gu dry-run should succeed: ${explicitCli.stderr || explicitCli.stdout}`);
  const explicitAction = JSON.parse(explicitCli.stdout);
  assert.deepEqual(
    explicitAction.payload.targetIds,
    [goodDreamer.id],
    "explicit Fang Gu target should stay under player control"
  );
}

function testUnitySubmitGuidedShabalothDefaultUsesTwoGoodTargets() {
  const dir = path.join(root, "guided-shabaloth-default");
  fs.mkdirSync(dir, { recursive: true });
  const localStatePath = path.join(dir, "unity_state.json");
  const localViewModelPath = path.join(dir, "unity_viewmodel.json");
  const state = createNewGame({ scriptId: "bmr", playerCount: 9, preferredHumanRoleId: "shabaloth" }, withSeededRandom(340001));
  initializeAI(state);
  const human = state.players.find((player) => player.isHuman);
  const evilAlly = state.players.find((player) => !player.isHuman && player.team === "evil");
  const goodCourtier = state.players.find((player) => !player.isHuman && player.team === "good");
  const goodProfessor = state.players.find((player) => !player.isHuman && player.team === "good" && player.id !== goodCourtier?.id);
  const lowerGood = state.players.find(
    (player) => !player.isHuman && player.team === "good" && ![goodCourtier?.id, goodProfessor?.id].includes(player.id)
  );
  assert.ok(human, "fixture needs human Shabaloth");
  assert.ok(evilAlly, "fixture needs evil ally");
  assert.ok(goodCourtier && goodProfessor && lowerGood, "fixture needs multiple good targets");
  applyRole(state, human, "shabaloth");
  applyRole(state, evilAlly, "assassin");
  applyRole(state, goodCourtier, "courtier");
  applyRole(state, goodProfessor, "professor");
  applyRole(state, lowerGood, "sailor");
  state.phase = "night";
  state.night = 2;
  fs.writeFileSync(localStatePath, `${JSON.stringify({ state }, null, 2)}\n`, "utf8");

  const viewModel = {
    phase: "night",
    gameOver: false,
    humanNightAction: {
      available: true,
      roleId: "shabaloth",
      roleName: "Shabaloth",
      inputType: "player-target",
      minTargetCount: 2,
      maxTargetCount: 2,
      targetCount: 2,
      options: [
        { id: evilAlly.id, name: "evil-ally", seat: evilAlly.seatIndex + 1, alive: true },
        { id: lowerGood.id, name: "lower-good", seat: lowerGood.seatIndex + 1, alive: true },
        { id: goodCourtier.id, name: "good-courtier", seat: goodCourtier.seatIndex + 1, alive: true },
        { id: goodProfessor.id, name: "good-professor", seat: goodProfessor.seatIndex + 1, alive: true },
      ],
    },
  };
  fs.writeFileSync(localViewModelPath, `${JSON.stringify(viewModel, null, 2)}\n`, "utf8");

  const cli = spawnSync(
    globalThis.process.execPath,
    [
      path.resolve("scripts", "submit_unity_night_action.mjs"),
      `--streaming-assets=${dir}`,
      "--dry-run",
    ],
    { encoding: "utf8" }
  );
  assert.equal(cli.status, 0, `guided Shabaloth dry-run should succeed: ${cli.stderr || cli.stdout}`);
  const action = JSON.parse(cli.stdout);
  assert.deepEqual(
    action.payload.targetIds,
    [goodCourtier.id, goodProfessor.id],
    "guided Shabaloth default should skip the evil ally and fill both kills with high-value good roles"
  );
}

function testUnitySubmitGuidedChargedPoDefaultUsesThreeGoodTargets() {
  const dir = path.join(root, "guided-charged-po-default");
  fs.mkdirSync(dir, { recursive: true });
  const localStatePath = path.join(dir, "unity_state.json");
  const localViewModelPath = path.join(dir, "unity_viewmodel.json");
  const state = createNewGame({ scriptId: "bmr", playerCount: 9, preferredHumanRoleId: "po" }, withSeededRandom(340002));
  initializeAI(state);
  const human = state.players.find((player) => player.isHuman);
  const evilAlly = state.players.find((player) => !player.isHuman && player.team === "evil");
  const goodCourtier = state.players.find((player) => !player.isHuman && player.team === "good");
  const goodProfessor = state.players.find((player) => !player.isHuman && player.team === "good" && player.id !== goodCourtier?.id);
  const goodExorcist = state.players.find(
    (player) => !player.isHuman && player.team === "good" && ![goodCourtier?.id, goodProfessor?.id].includes(player.id)
  );
  const lowerGood = state.players.find(
    (player) => !player.isHuman && player.team === "good" && ![goodCourtier?.id, goodProfessor?.id, goodExorcist?.id].includes(player.id)
  );
  assert.ok(human, "fixture needs human Po");
  assert.ok(evilAlly, "fixture needs evil ally");
  assert.ok(goodCourtier && goodProfessor && goodExorcist && lowerGood, "fixture needs at least four good targets");
  applyRole(state, human, "po");
  applyRole(state, evilAlly, "assassin");
  applyRole(state, goodCourtier, "courtier");
  applyRole(state, goodProfessor, "professor");
  applyRole(state, goodExorcist, "exorcist");
  applyRole(state, lowerGood, "sailor");
  state.phase = "night";
  state.night = 3;
  state.bmr.poCharged = true;
  fs.writeFileSync(localStatePath, `${JSON.stringify({ state }, null, 2)}\n`, "utf8");

  const chargedViewModel = {
    phase: "night",
    gameOver: false,
    humanNightAction: {
      available: true,
      roleId: "po",
      roleName: "Po",
      inputType: "charge-or-targets",
      minTargetCount: 1,
      maxTargetCount: 3,
      targetCount: 3,
      modes: [{ id: "kill", label: "Kill up to 3 players" }],
      options: [
        { id: evilAlly.id, name: "evil-ally", seat: evilAlly.seatIndex + 1, alive: true },
        { id: lowerGood.id, name: "lower-good", seat: lowerGood.seatIndex + 1, alive: true },
        { id: goodExorcist.id, name: "good-exorcist", seat: goodExorcist.seatIndex + 1, alive: true },
        { id: goodProfessor.id, name: "good-professor", seat: goodProfessor.seatIndex + 1, alive: true },
        { id: goodCourtier.id, name: "good-courtier", seat: goodCourtier.seatIndex + 1, alive: true },
      ],
    },
  };
  fs.writeFileSync(localViewModelPath, `${JSON.stringify(chargedViewModel, null, 2)}\n`, "utf8");

  const defaultCli = spawnSync(
    globalThis.process.execPath,
    [
      path.resolve("scripts", "submit_unity_night_action.mjs"),
      `--streaming-assets=${dir}`,
      "--dry-run",
    ],
    { encoding: "utf8" }
  );
  assert.equal(defaultCli.status, 0, `guided charged Po dry-run should succeed: ${defaultCli.stderr || defaultCli.stdout}`);
  const defaultAction = JSON.parse(defaultCli.stdout);
  assert.equal(defaultAction.payload.mode, "kill");
  assert.deepEqual(
    defaultAction.payload.targetIds,
    [goodCourtier.id, goodProfessor.id, goodExorcist.id],
    "guided charged Po default should use the full triple kill on the strongest good targets"
  );

  const explicitCli = spawnSync(
    globalThis.process.execPath,
    [
      path.resolve("scripts", "submit_unity_night_action.mjs"),
      `--streaming-assets=${dir}`,
      "--mode=kill",
      `--target=${evilAlly.id}`,
      "--dry-run",
    ],
    { encoding: "utf8" }
  );
  assert.equal(explicitCli.status, 0, `explicit charged Po dry-run should succeed: ${explicitCli.stderr || explicitCli.stdout}`);
  const explicitAction = JSON.parse(explicitCli.stdout);
  assert.deepEqual(
    explicitAction.payload.targetIds,
    [evilAlly.id],
    "explicit charged Po targets should remain under player control"
  );

  state.bmr.poCharged = false;
  fs.writeFileSync(localStatePath, `${JSON.stringify({ state }, null, 2)}\n`, "utf8");
  chargedViewModel.humanNightAction.maxTargetCount = 1;
  chargedViewModel.humanNightAction.targetCount = 1;
  chargedViewModel.humanNightAction.modes = [
    { id: "kill", label: "Kill 1 player" },
    { id: "charge", label: "Charge tonight" },
  ];
  fs.writeFileSync(localViewModelPath, `${JSON.stringify(chargedViewModel, null, 2)}\n`, "utf8");

  const chargeCli = spawnSync(
    globalThis.process.execPath,
    [
      path.resolve("scripts", "submit_unity_night_action.mjs"),
      `--streaming-assets=${dir}`,
      "--mode=charge",
      "--dry-run",
    ],
    { encoding: "utf8" }
  );
  assert.equal(chargeCli.status, 0, `explicit Po charge dry-run should succeed: ${chargeCli.stderr || chargeCli.stdout}`);
  const chargeAction = JSON.parse(chargeCli.stdout);
  assert.deepEqual(chargeAction.payload, { mode: "charge" }, "explicit Po charge should not be converted into a kill");
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

function testUnityAutoAdvanceStopsAtNominationDecision() {
  const newGameAction = writeAction("new-game", { scriptId: "tb", playerCount: 9, preferredHumanRoleId: "washerwoman", seed: 20260606 });
  let processed = process();
  assert.equal(processed.result.ok, true, newGameAction.id);
  assert.equal(processed.viewModel.phase, "night", "fixture should start on first night");

  const autoAction = writeAction("auto-step", { mode: "decision", maxSteps: 32 });
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);
  assert.equal(processed.viewModel.action.lastActionType, "auto-advance", "auto-step alias should normalize to auto-advance");
  assert.equal(processed.viewModel.action.lastActionId, autoAction.id);
  assert.equal(processed.viewModel.phase, "day");
  assert.equal(processed.viewModel.dayStage, "nomination");
  assert.equal(processed.viewModel.nominationDebate?.active, true, "auto-advance should pause before the human vote decision");
  assert.equal(processed.viewModel.action.autoAdvance?.stoppedAt, "nomination-debate");
  assert.ok(
    processed.viewModel.action.autoAdvance?.steps?.some((entry) => entry.type === "night"),
    "auto-advance should resolve the visible night when no human night action is pending"
  );
  assert.ok(
    processed.viewModel.action.autoAdvance?.steps?.some((entry) => entry.type === "ai-public-step"),
    "auto-advance should run a public AI step before nominations"
  );
  assert.ok(
    processed.viewModel.action.autoAdvance?.steps?.some((entry) => entry.type === "ai-nomination-step"),
    "auto-advance should drive the AI nomination step"
  );

  const state = readState();
  assert.ok(state.dayStageMeta.publicRounds > 0, "auto public step should satisfy the nomination phase guard");
  const bridgeResult = JSON.parse(fs.readFileSync(resultPath, "utf8"));
  assert.equal(bridgeResult.autoAdvance?.stoppedAt, "nomination-debate", "result JSON should expose the stop reason");
}

function testUnityDefaultAutoAdvanceRemainsSafePublicStep() {
  const newGameAction = writeAction("new-game", { scriptId: "tb", playerCount: 9, preferredHumanRoleId: "washerwoman", seed: 202606061 });
  let processed = process();
  assert.equal(processed.result.ok, true, newGameAction.id);
  resolveFirstNightIfNeeded();

  const autoAction = writeAction("auto-advance");
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);
  assert.equal(processed.viewModel.action.lastActionId, autoAction.id);
  assert.equal(processed.viewModel.dayStage, "public");
  assert.equal(processed.viewModel.nominationDebate, null, "default auto-advance should not jump into nomination without a decision mode");
  assert.equal(processed.viewModel.action.autoAdvance?.stoppedAt, "public-discussion");
  assert.ok(
    processed.viewModel.action.autoAdvance?.steps?.some((entry) => entry.type === "ai-public-step"),
    "default auto-advance should still perform the safe public step"
  );
}

function testUnityFullAutoAdvanceCanReachEndgame() {
  const newGameAction = writeAction("new-game", { scriptId: "tb", playerCount: 9, preferredHumanRoleId: "washerwoman", seed: 20260607 });
  let processed = process();
  assert.equal(processed.result.ok, true, newGameAction.id);

  const autoAction = writeAction("auto-advance", {
    fullAuto: true,
    humanVoteYes: true,
    maxSteps: 192,
  });
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);
  assert.equal(processed.viewModel.action.lastActionId, autoAction.id);
  assert.equal(processed.viewModel.gameOver, true, "full auto-advance should be able to drive the Unity bridge to endgame");
  assert.ok(["good", "evil"].includes(processed.viewModel.winner), "full auto-advance should leave a concrete winner");
  assert.equal(processed.viewModel.action.autoAdvance?.stoppedAt, "ended");
  assert.ok(
    processed.viewModel.action.autoAdvance?.steps?.some((entry) => entry.type === "resolve-nomination-vote"),
    "full auto-advance should exercise nomination vote resolution"
  );
  assert.ok(
    processed.viewModel.action.autoAdvance?.steps?.some((entry) => entry.type === "end-day"),
    "full auto-advance should exercise day-end execution flow"
  );
  assert.ok(
    (readState().events.executions ?? []).length > 0,
    "full auto-advance should produce at least one execution before endgame"
  );
}

function testUnityFullAutoAdvanceConsumesHumanNightActions() {
  const scenarios = [
    { scriptId: "bmr", roleId: "gambler", seed: 20260607 },
    { scriptId: "bmr", roleId: "zombuul", seed: 20260609 },
  ];

  scenarios.forEach(({ scriptId, roleId, seed }) => {
    const newGameAction = writeAction("new-game", { scriptId, playerCount: 9, preferredHumanRoleId: roleId, seed });
    let processed = process({ scriptId, preferredHumanRoleId: roleId, seed });
    assert.equal(processed.result.ok, true, `${scriptId}/${roleId} new-game ${newGameAction.id}`);

    const autoAction = writeAction("auto-advance", {
      fullAuto: true,
      humanVoteYes: true,
      maxSteps: 512,
    });
    processed = process({ scriptId, preferredHumanRoleId: roleId, seed });
    assert.equal(processed.result.ok, true, processed.result.reason);
    assert.equal(processed.viewModel.action.lastActionId, autoAction.id);
    assert.equal(
      processed.viewModel.gameOver,
      true,
      `${scriptId}/${roleId}: fullAuto should not pause permanently at the human night action`
    );
    assert.ok(["good", "evil"].includes(processed.viewModel.winner), `${scriptId}/${roleId}: fullAuto should produce a winner`);
    assert.equal(processed.viewModel.action.autoAdvance?.stoppedAt, "ended");
    assert.ok(
      processed.viewModel.action.autoAdvance?.steps?.some((entry) => entry.type === "human-night-action"),
      `${scriptId}/${roleId}: fullAuto should submit at least one default human night action`
    );
  });
}

function runSeededAutoplayAtWallClock(label, wallClockMs) {
  const originalDateNow = Date.now;
  const harnessRoot = path.join(root, label);
  const paths = {
    statePath: path.join(harnessRoot, "unity_state.json"),
    viewModelPath: path.join(harnessRoot, "unity_viewmodel.json"),
    actionPath: path.join(harnessRoot, "unity_action.json"),
    resultPath: path.join(harnessRoot, "unity_action_result.json"),
  };
  function writeLocalAction(id, type, payload = {}) {
    fs.mkdirSync(harnessRoot, { recursive: true });
    fs.writeFileSync(
      paths.actionPath,
      `${JSON.stringify(
        {
          id,
          type,
          payload,
          createdAt: "2026-06-09T00:00:00.000Z",
        },
        null,
        2
      )}\n`,
      "utf8"
    );
  }

  try {
    Date.now = () => wallClockMs;
    writeLocalAction(`${label}-new-game`, "new-game", {
      scriptId: "snv",
      playerCount: 9,
      preferredHumanRoleId: "klutz",
      seed: 260609,
    });
    let processed = processUnityActionFile({
      ...paths,
      scriptId: "snv",
      playerCount: 9,
      preferredHumanRoleId: "klutz",
      seed: 260609,
      disableReplayRecorder: true,
    });
    assert.equal(processed.result.ok, true, `${label}: new game should load`);

    writeLocalAction(`${label}-auto`, "auto-advance", {
      fullAuto: true,
      humanVoteYes: true,
      maxSteps: 320,
    });
    processed = processUnityActionFile({
      ...paths,
      scriptId: "snv",
      playerCount: 9,
      preferredHumanRoleId: "klutz",
      seed: 260609,
      disableReplayRecorder: true,
    });
    assert.equal(processed.result.ok, true, `${label}: auto advance should resolve`);
    assert.equal(processed.viewModel.gameOver, true, `${label}: auto advance should reach endgame`);
    const state = processed.state;
    const autoSteps = processed.viewModel.action.autoAdvance?.steps ?? [];
    return {
      rngSeed: state.unityBridge.rngSeed,
      rngState: state.unityBridge.rngState,
      summary: {
        winner: state.winner,
        winnerReason: state.winnerReason,
        day: state.day,
        night: state.night,
        executions: (state.events.executions ?? []).map((entry) => ({
          day: entry.day,
          nomineeId: entry.nomineeId,
          reason: entry.reason,
        })),
        dayDeaths: (state.events.dayDeaths ?? []).map((entry) => ({
          day: entry.day,
          playerId: entry.playerId,
          reason: entry.reason,
        })),
        nightDeaths: (state.events.nightDeaths ?? []).map((entry) => ({
          night: entry.night,
          playerId: entry.playerId,
          reason: entry.reason,
        })),
        votes: (state.events.votes ?? []).map((entry) => ({
          day: entry.day,
          nomineeId: entry.nomineeId,
          yesVotes: entry.yesVotes,
          threshold: entry.threshold,
          passed: entry.passed,
        })),
        autoStepTypes: autoSteps.map((entry) => entry.type),
      },
    };
  } finally {
    Date.now = originalDateNow;
  }
}

function testUnityBridgeSeededAutoplayIgnoresWallClock() {
  const first = runSeededAutoplayAtWallClock("seeded-wallclock-a", 1000000000000);
  const second = runSeededAutoplayAtWallClock("seeded-wallclock-b", 2000000000000);

  assert.equal(first.rngSeed, 260609, "bridge should persist the scenario seed into the playable state");
  assert.equal(second.rngSeed, 260609, "bridge should reuse the persisted scenario seed instead of wall-clock time");
  assert.equal(Number.isFinite(first.rngState), true, "bridge should persist advanced RNG state after gameplay actions");
  assert.equal(Number.isFinite(second.rngState), true, "bridge should persist advanced RNG state after gameplay actions");
  assert.deepEqual(second.summary, first.summary, "same seeded Unity action sequence should produce the same game summary under different wall clocks");
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
  assert.ok(offer.publicReason, "proactive offer should include a public-safe reason before the player accepts");
  assert.ok(offer.publicIntent, "proactive offer should include a public-safe intent before the player accepts");
  assert.equal(Object.hasOwn(offer, "reason"), false, "pending proactive offers should not export internal reason text");
  assert.equal(Object.hasOwn(offer, "prompt"), false, "pending proactive offers should not export private prompt text");
  assert.equal(Object.hasOwn(offer, "focusId"), false, "pending proactive offers should not export the hidden focus target");
  assert.equal(Object.hasOwn(offer, "personaLabel"), false, "pending proactive offers should not export AI persona labels");
  assert.equal(
    processed.viewModel.timeline.some((entry) => entry.mode === "whisper-in" && entry.speakerId === offer.playerId),
    false,
    "queued offer should not reveal the private message before acceptance"
  );

  const beforeAcceptState = readState();
  const beforeAcceptUsed = beforeAcceptState.dayStageMeta.privateUsed ?? 0;
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
  assert.equal(
    state.dayStageMeta.privateUsed,
    beforeAcceptUsed + 1,
    "accepted proactive offers should consume a human private-chat slot"
  );

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

function testUnityProactiveWhisperRequiresExplicitOfferIdAndConsumesSelectedOffer() {
  const newGameAction = writeAction("new-game", { scriptId: "tb", playerCount: 9, preferredHumanRoleId: "washerwoman", seed: 626262 });
  let processed = process();
  assert.equal(processed.result.ok, true, newGameAction.id);
  resolveFirstNightIfNeeded();

  let state = readState();
  const human = state.players.find((player) => player.isHuman);
  const ais = state.players.filter((player) => !player.isHuman).slice(0, 2);
  assert.equal(ais.length, 2, "fixture needs two AI players");
  state.aiDialogue = state.aiDialogue ?? {};
  state.aiDialogue.pendingProactiveWhispers = ais.map((ai, index) => ({
    id: `explicit-offer-${index + 1}`,
    day: state.day,
    night: state.night,
    playerId: ai.id,
    playerName: ai.name,
    playerSeat: ai.seatIndex + 1,
    reason: `内部理由 ${index + 1} 不应在接受前展示`,
    prompt: `内部提示 ${index + 1} 不应展示`,
    response: `第${index + 1}个邀请的真实私聊内容`,
    intent: index === 0 ? "reason" : "vote",
    focusId: human.id,
    createdAt: 1000 + index,
  }));
  writeState(state);

  processed = process();
  assert.equal(processed.viewModel.pendingProactiveWhispers.length, 2, "fixture should export both pending offers");
  assert.deepEqual(
    processed.viewModel.pendingProactiveWhispers.map((offer) => offer.id),
    ["explicit-offer-1", "explicit-offer-2"],
    "pending offers should remain independently addressable"
  );
  assert.equal(
    JSON.stringify(processed.viewModel.pendingProactiveWhispers).includes("真实私聊内容"),
    false,
    "pending offers should not export private reply content"
  );
  assert.equal(
    JSON.stringify(processed.viewModel.pendingProactiveWhispers).includes("内部理由"),
    false,
    "pending offers should not export internal offer reasons"
  );

  const missingOfferAction = writeAction("accept-proactive-whisper", {});
  processed = process();
  assert.equal(processed.result.ok, false, "accepting without offerId should fail");
  assert.equal(processed.viewModel.action.lastActionId, missingOfferAction.id);
  assert.equal(processed.viewModel.pendingProactiveWhispers.length, 2, "failed accept should not consume the first queued offer");

  const acceptSecondAction = writeAction("accept-proactive-whisper", { offerId: "explicit-offer-2" });
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);
  assert.equal(processed.viewModel.action.lastActionId, acceptSecondAction.id);
  assert.deepEqual(
    processed.viewModel.pendingProactiveWhispers.map((offer) => offer.id),
    ["explicit-offer-1"],
    "accepting the second offer should leave the first offer pending"
  );
  assert.ok(
    processed.viewModel.timeline.some((entry) => entry.mode === "whisper-in" && entry.speakerId === ais[1].id && entry.text.includes("第2个邀请")),
    "accepted offer should add only that offer's private reply"
  );
  assert.equal(
    processed.viewModel.timeline.some((entry) => entry.mode === "whisper-in" && entry.speakerId === ais[0].id && entry.text.includes("第1个邀请")),
    false,
    "accepting the second offer must not consume or reveal the first offer"
  );

  const declineFirstAction = writeAction("decline-proactive-whisper", { offerId: "explicit-offer-1" });
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);
  assert.equal(processed.viewModel.action.lastActionId, declineFirstAction.id);
  assert.equal(processed.viewModel.pendingProactiveWhispers.length, 0, "declined offer should be removed independently");
  assert.equal(
    processed.viewModel.timeline.some((entry) => entry.mode === "whisper-in" && entry.speakerId === ais[0].id && entry.text.includes("第1个邀请")),
    false,
    "declined offer should not leak its private reply"
  );
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
  const newGameAction = writeAction("new-game", { scriptId: "tb", playerCount: 9, preferredHumanRoleId: "washerwoman", seed: 424242 });
  let processed = process();
  assert.equal(processed.result.ok, true, newGameAction.id);
  resolveFirstNightIfNeeded();

  const action = writeAction("public-discussion", { mode: "confirm" });
  processed = process();
  const { result, viewModel } = processed;
  assert.equal(result.ok, true);
  assert.equal(viewModel.dayStage, "public");
  assert.ok(viewModel.timeline.some((entry) => entry.mode === "public"), "public action should add public timeline entries");
  assert.ok(
    viewModel.timeline.some((entry) => entry.mode === "public" && entry.speakerId === viewModel.players.find((player) => player.human)?.id),
    "entering public discussion should give the human a public table claim before AI pressure"
  );
  assert.equal(
    viewModel.timeline.filter((entry) => entry.mode === "public" && !viewModel.players.find((player) => player.id === entry.speakerId)?.human).length,
    1,
    "public-discussion should advance one conversation-clock AI speaker, not a full AI round"
  );
  const state = readState();
  const human = state.players.find((player) => player.isHuman);
  assert.ok(
    state.events.claims.some((entry) => entry.playerId === human.id && !entry.private),
    "human public opening should register a public claim for AI context"
  );
}

function testUnityHumanPublicSpeechMutatesTimeline() {
  const newGameAction = writeAction("new-game", { scriptId: "tb", playerCount: 9, preferredHumanRoleId: "washerwoman", seed: 515151 });
  let processed = process();
  assert.equal(processed.result.ok, true, newGameAction.id);
  resolveFirstNightIfNeeded();

  writeAction("public-discussion", { mode: "confirm" });
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);
  const human = processed.viewModel.players.find((player) => player.human);
  const focus = processed.viewModel.players.find((player) => !player.human);
  assert.ok(human && focus, "human public speech test needs human and AI players");

  const line = "我公开补充：我的身份口径先按洗衣妇记，今晚信息后面再对。";
  const action = writeAction("human-public-speech", { text: line, focusId: focus.id, intent: "human-public" });
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);
  assert.equal(processed.viewModel.action.lastActionId, action.id);
  assert.ok(
    processed.viewModel.timeline.some((entry) => entry.mode === "public" && entry.speakerId === human.id && entry.text === line),
    "human public speech should be exported as a public timeline entry"
  );

  const state = readState();
  assert.ok(
    state.events.speeches.some((entry) => !entry.private && entry.playerId === human.id && entry.line === line),
    "human public speech should enter the public speech event stream"
  );
  assert.equal(
    state.dayStageMeta?.publicConversation?.pendingResponseSpeakerId,
    focus.id,
    "human public speech should queue the addressed AI for the next public response"
  );
  assert.ok(
    Object.values(state.aiAgents ?? {}).some((agent) =>
      (agent.observations ?? []).some((entry) => entry.kind === "public-speech" && entry.payload?.speakerId === human.id)
    ),
    "human public speech should be visible to AI agents"
  );

  const stepAction = writeAction("ai-public-step");
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);
  assert.equal(processed.viewModel.action.lastActionId, stepAction.id);
  assert.equal(processed.result.speakerId, focus.id, "addressed AI should answer the next Unity public step");
  assert.equal(
    readState().dayStageMeta?.publicConversation?.pendingResponseSpeakerId,
    null,
    "addressed public response should consume the pending response"
  );
}

function testUnitySubmitPublicSpeechDryRunBuildsHumanSpeechAction() {
  const newGameAction = writeAction("new-game", { scriptId: "tb", playerCount: 9, preferredHumanRoleId: "washerwoman", seed: 515152 });
  let processed = process();
  assert.equal(processed.result.ok, true, newGameAction.id);
  resolveFirstNightIfNeeded();

  writeAction("public-discussion", { mode: "confirm" });
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);
  const focus = processed.viewModel.players.find((player) => !player.human);
  assert.ok(focus, "public speech submit dry-run needs an AI focus");

  const cli = spawnSync(
    globalThis.process.execPath,
    [
      path.resolve("scripts", "submit_unity_night_action.mjs"),
      `--streaming-assets=${root}`,
      "--public-speech",
      "--dry-run",
      "--focus",
      focus.id,
      "--text",
      "I want this answer in public before nominations.",
    ],
    { encoding: "utf8" }
  );

  assert.equal(cli.status, 0, `public speech dry-run should succeed: ${cli.stderr || cli.stdout}`);
  const action = JSON.parse(cli.stdout);
  assert.equal(action.type, "human-public-speech");
  assert.equal(action.payload.focusId, focus.id);
  assert.equal(action.payload.text, "I want this answer in public before nominations.");
}

function testUnityAutoPublicOpeningHonorsCerenovusMadness() {
  const newGameAction = writeAction("new-game", { scriptId: "snv", playerCount: 9, preferredHumanRoleId: "fang-gu", seed: 616161 });
  let processed = process({ scriptId: "snv", preferredHumanRoleId: "fang-gu", seed: 616161 });
  assert.equal(processed.result.ok, true, newGameAction.id);

  const state = readState();
  const human = state.players.find((player) => player.isHuman);
  assert.ok(human, "fixture needs human player");
  assert.equal(human.roleId, "fang-gu", "fixture should place the human as Fang Gu");

  state.phase = "day";
  state.day = 2;
  state.dayStage = "private";
  state.dayStageMeta = {
    ...state.dayStageMeta,
    publicRounds: 0,
    nominationClock: null,
    nominationDebate: null,
    executionCandidate: null,
  };
  human.publicClaimRoleId = "fang-gu";
  state.events.claims.push({ day: 1, playerId: human.id, roleId: "fang-gu", private: false });
  state.events.executions = [];
  state.snv.cerenovusForcedByPlayerId = { ...(state.snv.cerenovusForcedByPlayerId ?? {}), [human.id]: "oracle" };
  state.snv.cerenovusEnforceDayByPlayerId = { ...(state.snv.cerenovusEnforceDayByPlayerId ?? {}), [human.id]: state.day };
  writeState(state);

  const publicAction = writeAction("public-discussion", { mode: "confirm" });
  processed = process({ scriptId: "snv", preferredHumanRoleId: "fang-gu", seed: 616161 });
  assert.equal(processed.result.ok, true, processed.result.reason);
  assert.equal(processed.viewModel.action.lastActionId, publicAction.id);

  const afterPublic = readState();
  const humanAfterPublic = afterPublic.players.find((player) => player.id === human.id);
  assert.equal(humanAfterPublic.publicClaimRoleId, "oracle", "automatic public opening should claim the Cerenovus-forced role");
  assert.ok(
    afterPublic.events.claims.some((entry) => entry.day === 2 && entry.playerId === human.id && entry.roleId === "oracle"),
    "forced madness claim should enter the public claim event stream"
  );
  assert.ok(
    (afterPublic.aiDialogue.timeline ?? []).some(
      (entry) => entry.speakerId === human.id && entry.claimReason === "cerenovus" && /公开身份：/.test(entry.text)
    ),
    "forced madness claim should be visible in the Unity public timeline"
  );

  markPublicDiscussionRound(afterPublic);
  assert.equal(advanceDayStage(afterPublic, "nomination").ok, true);
  const dayEnd = endDayAndBeginNight(afterPublic, withSeededRandom(616162));
  assert.equal(dayEnd.ok, true, dayEnd.reason);
  assert.equal(humanAfterPublic.alive, true, "Cerenovus-compliant autoplay should not execute the human at day end");
  assert.equal(
    afterPublic.events.executions.some((entry) => entry.reason === "cerenovus-break" && entry.nomineeId === human.id),
    false,
    "day end should not record a Cerenovus break for the compliant auto-claim"
  );
}

function testUnityEnteringPublicClearsPendingProactiveWhispers() {
  const newGameAction = writeAction("new-game", { scriptId: "tb", playerCount: 9, preferredHumanRoleId: "washerwoman", seed: 616161 });
  let processed = process();
  assert.equal(processed.result.ok, true, newGameAction.id);
  resolveFirstNightIfNeeded();

  let state = readState();
  const ai = state.players.find((player) => !player.isHuman);
  assert.ok(ai, "test needs an AI player");
  ai.privateNotes = ai.privateNotes ?? [];
  ai.privateNotes.push("[第1天] 你得知：进入公聊前的主动私聊测试信息。");
  writeState(state);

  writeAction("ai-proactive-whispers");
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);
  assert.ok(processed.viewModel.pendingProactiveWhispers.length > 0, "fixture should queue proactive whispers");

  writeAction("public-discussion", { mode: "confirm" });
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);
  assert.equal(processed.viewModel.dayStage, "public");
  assert.equal(processed.viewModel.pendingProactiveWhispers.length, 0, "public stage should not expose stale private offers");
  state = readState();
  assert.equal(
    (state.aiDialogue?.pendingProactiveWhispers ?? []).filter((entry) => entry.day === state.day).length,
    0,
    "entering public should clear same-day queued proactive whispers"
  );
}

function testUnityConversationClockStep() {
  const action = writeAction("new-game", { scriptId: "tb", playerCount: 9, preferredHumanRoleId: "washerwoman", seed: 31415 });
  let processed = process();
  assert.equal(processed.result.ok, true, action.id);
  resolveFirstNightIfNeeded();

  for (let index = 0; index < 3; index += 1) {
    const stepAction = writeAction("ai-public-step");
    processed = process();
    assert.equal(processed.result.ok, true, stepAction.id);
    assert.equal(processed.viewModel.dayStage, "public");
    assert.equal(processed.viewModel.publicConversation.active, true);
    assert.equal(processed.viewModel.publicConversation.step, index + 1);
    assert.ok(processed.viewModel.publicConversation.label, "conversation clock should expose a label");
    const lastStep = processed.viewModel.publicConversation.lastStep;
    assert.ok(lastStep, "conversation clock should expose the latest structured step");
    assert.ok(lastStep.speakerId, "structured step should identify speaker");
    assert.ok(lastStep.targetId, "structured step should identify target");
    assert.ok(lastStep.stance, "structured step should identify stance");
    assert.ok(lastStep.question, "structured step should include a question");
    assert.ok(lastStep.reason, "structured step should include a reason");
    assert.ok(lastStep.followUp || lastStep.nominationTendency, "structured step should include follow-up or nomination tendency");
    [lastStep.line, lastStep.reason, lastStep.question, lastStep.followUp].forEach((text, textIndex) => {
      assertNoPlayerVisibleForbiddenTerms(text, `Unity public conversation step ${index + 1}.${textIndex + 1}`);
    });
  }
  assert.doesNotMatch(processed.viewModel.phaseObjectiveTitle, /轮/, "new public UI objective should not be round-based");
  assert.ok(processed.viewModel.timeline.some((entry) => entry.mode === "public"), "conversation step should add one public line");
  assert.ok(
    processed.viewModel.publicConversation.suggestedActions.includes("open-nomination-window"),
    "third public step should offer a nomination path"
  );
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

function testUnityHumanNominationReasonFeedsAIVotePressure() {
  const action = writeAction("new-game", { scriptId: "tb", playerCount: 9, preferredHumanRoleId: "washerwoman", seed: 202606081 });
  let processed = process();
  assert.equal(processed.result.ok, true, action.id);
  resolveFirstNightIfNeeded();

  writeAction("public-discussion", { mode: "confirm" });
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);
  writeAction("open-nomination-window", { ticks: 3 });
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);

  const before = readState();
  const human = before.players.find((player) => player.isHuman);
  const demon = before.players.find((player) => !player.isHuman && player.category === "demon" && player.alive);
  assert.ok(human, "human nomination reason fixture needs a human");
  assert.ok(demon, "human nomination reason fixture needs an AI demon target");

  const reason = `${human.name} points at ${demon.name}: public case says this is the strongest demon-world candidate.`;
  writeAction("human-nomination-intent", { nomineeId: demon.id, text: reason });
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);
  assert.equal(processed.viewModel.nominationDebate.active, true);
  assert.match(processed.viewModel.nominationDebate.reason, /strongest demon-world ca/);

  let state = readState();
  assert.ok(
    state.events.speeches.some((entry) => !entry.private && entry.playerId === human.id && entry.focusId === demon.id && entry.line === reason),
    "explicit human nomination reason should enter the public speech event stream"
  );
  assert.ok(
    Object.values(state.aiAgents ?? {}).some((agent) =>
      (agent.observations ?? []).some(
        (entry) => entry.kind === "public-speech" && entry.payload?.speakerId === human.id && entry.payload?.focusId === demon.id
      )
    ),
    "explicit human nomination reason should be visible to AI agents before the vote"
  );

  writeAction("resolve-nomination-vote", { humanVoteYes: true });
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);
  assert.equal(processed.result.result.passed, true, "human nomination reason should create enough public vote pressure to put the target on block");
  const supportingVote = processed.result.result.votes.find((entry) => {
    const voter = processed.state.players.find((player) => player.id === entry.voterId);
    return voter && !voter.isHuman && voter.team === "good" && entry.vote;
  });
  assert.ok(supportingVote, "at least one good AI should support the explicit public nomination case");
  assert.ok(
    supportingVote.voteRationale?.nominationProcedurePressure?.publicCaseEvidenceCount >= 1,
    "AI vote pressure should cite the explicit public nomination reason as visible public evidence"
  );
}

function testUnityVirginNominationResolvesBeforeDebate() {
  const action = writeAction("new-game", { scriptId: "tb", playerCount: 9, preferredHumanRoleId: "washerwoman", seed: 271824 });
  let processed = process();
  assert.equal(processed.result.ok, true, action.id);
  resolveFirstNightIfNeeded();

  writeAction("ai-public-step");
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);

  writeAction("open-nomination-window", { ticks: 3 });
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);

  const state = readState();
  const human = state.players.find((player) => player.isHuman);
  const virgin = state.players.find((player) => !player.isHuman && player.alive);
  assert.ok(human, "Virgin nomination fixture needs a human nominator");
  assert.ok(virgin, "Virgin nomination fixture needs a living nominee");
  applyRole(state, human, "chef");
  applyRole(state, virgin, "virgin");
  human.poisoned = false;
  virgin.poisoned = false;
  writeState(state);

  const intentAction = writeAction("human-nomination-intent", {
    nomineeId: virgin.id,
    reason: "contract Virgin immediate nomination",
  });
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);
  assert.equal(processed.result.immediateResolution, true, "Virgin nomination should resolve before a pre-vote debate");
  assert.equal(processed.result.result?.special, "virgin");
  assert.equal(processed.viewModel.action.lastActionId, intentAction.id);
  assert.equal(processed.viewModel.nominationDebate, null, "Virgin trigger should not create a pending debate");
  assert.equal(processed.viewModel.voteCeremony, null, "Virgin trigger should not wait for a vote ceremony");

  const after = readState();
  const humanAfter = after.players.find((player) => player.id === human.id);
  assert.equal(humanAfter?.alive, false, "Virgin trigger should immediately execute the nominator");
  assert.equal(after.dayStageMeta.nominationClock.active, false, "immediate execution should close the nomination window");
  assert.equal(after.dayStageMeta.nominationClock.status, "execution-resolved");
  assert.ok(
    after.events.executions.some((entry) => entry.nomineeId === human.id && entry.reason === "virgin-trigger"),
    "Virgin trigger execution should be recorded immediately"
  );
}

function testUnityWitchCursedNominationKillsBeforeDebateVote() {
  const action = writeAction("new-game", { scriptId: "snv", playerCount: 9, preferredHumanRoleId: "clockmaker", seed: 271825 });
  let processed = process({ scriptId: "snv", preferredHumanRoleId: "clockmaker", seed: 271825 });
  assert.equal(processed.result.ok, true, action.id);

  writeAction("phase", { stage: "day" });
  processed = process({ scriptId: "snv", preferredHumanRoleId: "clockmaker", seed: 271825 });
  assert.equal(processed.result.ok, true, processed.result.reason);

  const state = readState();
  assert.equal(advanceDayStage(state, "public").ok, true);
  markPublicDiscussionRound(state);
  assert.equal(advanceDayStage(state, "nomination").ok, true);
  const human = state.players.find((player) => player.isHuman && player.alive);
  const nominee = state.players.find((player) => !player.isHuman && player.alive && player.id !== human?.id);
  assert.ok(human, "Witch nomination fixture needs a living human nominator");
  assert.ok(nominee, "Witch nomination fixture needs a living nominee");
  state.snv.witchCurses[human.id] = state.day;
  writeState(state);

  writeAction("open-nomination-window", { ticks: 3 });
  processed = process({ scriptId: "snv", preferredHumanRoleId: "clockmaker", seed: 271825 });
  assert.equal(processed.result.ok, true, processed.result.reason);

  const intentAction = writeAction("human-nomination-intent", {
    nomineeId: nominee.id,
    reason: "contract Witch nomination timing",
  });
  processed = process({ scriptId: "snv", preferredHumanRoleId: "clockmaker", seed: 271825 });
  assert.equal(processed.result.ok, true, processed.result.reason);
  assert.equal(processed.result.debate?.active, true, "Witch-triggering nomination should still create a debate");
  assert.equal(processed.result.debate?.nominationAccepted, true, "Unity debate should carry the accepted-nomination marker");
  assert.equal(processed.result.immediateResolution ?? false, false, "Witch curse should not skip into a Virgin-style immediate resolution");
  assert.equal(processed.viewModel.action.lastActionId, intentAction.id);
  assert.equal(processed.viewModel.nominationDebate?.active, true);
  assert.equal(processed.viewModel.voteCeremony, null, "vote should still wait until debate is resolved");

  const afterDebate = readState();
  const humanAfterDebate = afterDebate.players.find((player) => player.id === human.id);
  const nomineeAfterDebate = afterDebate.players.find((player) => player.id === nominee.id);
  assert.equal(humanAfterDebate?.alive, false, "Witch curse should kill the nominator as soon as the nomination is made");
  assert.equal(humanAfterDebate?.nominatedToday, true, "Witch-triggering nomination should spend the human nomination");
  assert.equal(nomineeAfterDebate?.beenNominatedToday, true, "Witch-triggering nomination should mark the nominee before the vote");
  assert.equal(afterDebate.events.votes.length, 0, "pre-vote debate should not record a vote");
  assert.equal(
    afterDebate.events.dayDeaths.filter((entry) => entry.reason === "witch-curse" && entry.playerId === human.id).length,
    1,
    "Witch curse death should be recorded when the debate starts"
  );

  writeAction("resolve-nomination-vote", { humanVoteYes: false });
  processed = process({ scriptId: "snv", preferredHumanRoleId: "clockmaker", seed: 271825 });
  assert.equal(processed.result.ok, true, processed.result.reason);
  assert.equal(processed.result.result?.accepted, true, "accepted debate nomination should resolve into a vote");
  assert.equal(processed.viewModel.nominationDebate?.active, false);
  assert.ok(processed.viewModel.voteCeremony, "resolved debate should export the vote ceremony");

  const afterVote = readState();
  assert.equal(afterVote.events.votes.length, 1, "Witch-triggering nomination should still create one vote record");
  assert.equal(
    afterVote.events.dayDeaths.filter((entry) => entry.reason === "witch-curse" && entry.playerId === human.id).length,
    1,
    "resolving the vote should not trigger Witch a second time"
  );
}

function testUnityAutoAdvanceVirginImmediateNominationKeepsExecutionStatus() {
  const action = writeAction("new-game", { scriptId: "tb", playerCount: 9, preferredHumanRoleId: "washerwoman", seed: 271826 });
  let processed = process();
  assert.equal(processed.result.ok, true, action.id);
  resolveFirstNightIfNeeded();

  const state = readState();
  assert.equal(advanceDayStage(state, "public").ok, true);
  markPublicDiscussionRound(state);
  assert.equal(advanceDayStage(state, "nomination").ok, true);
  state.dayStageMeta.nominationClock = { active: true, remaining: 3, budget: 3, status: "open", intent: "contract" };
  state.dayStageMeta.nominationDebate = null;
  state.dayStageMeta.executionCandidate = null;
  state.events.votes = [];
  state.events.executions = [];

  const nominator = state.players.find((player) => !player.isHuman && player.alive);
  const virgin = state.players.find((player) => !player.isHuman && player.alive && player.id !== nominator?.id);
  assert.ok(nominator, "auto-advance Virgin fixture needs an AI nominator");
  assert.ok(virgin, "auto-advance Virgin fixture needs an AI Virgin target");
  applyRole(state, nominator, "chef");
  applyRole(state, virgin, "virgin");
  virgin.poisoned = false;
  nominator.poisoned = false;
  state.tb.virginTriggeredIds = [];

  state.players.forEach((player) => {
    player.nominatedToday = !player.isHuman && player.id !== nominator.id;
    player.beenNominatedToday = player.id !== virgin.id;
    player.suspicion = player.suspicion ?? {};
    state.players.forEach((target) => {
      player.suspicion[target.id] = target.id === virgin.id ? 0.95 : 0.01;
    });
  });
  writeState(state);

  const autoAction = writeAction("auto-advance", {
    mode: "flow",
    resolveDebates: true,
    maxSteps: 1,
    publicSteps: 0,
    nominationTicks: 3,
  });
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);
  assert.equal(processed.viewModel.action.lastActionId, autoAction.id);
  assert.ok(
    processed.viewModel.action.autoAdvance?.steps?.some((entry) => entry.type === "ai-nomination-step"),
    "auto-advance fixture should exercise an AI nomination step"
  );

  const after = readState();
  const nominatorAfter = after.players.find((player) => player.id === nominator.id);
  assert.equal(nominatorAfter?.alive, false, "Virgin immediate trigger should execute the AI nominator during auto-advance");
  assert.equal(after.dayStageMeta.nominationClock?.active, false);
  assert.equal(
    after.dayStageMeta.nominationClock?.status,
    "execution-resolved",
    "auto-advance must not overwrite Virgin immediate execution with nomination-made"
  );
  assert.equal(after.dayStageMeta.nominationDebate, null, "Virgin immediate trigger should not leave a debate for auto-advance");
  assert.equal(after.events.votes.length, 0, "Virgin immediate trigger should not fabricate a vote during auto-advance");
  assert.ok(
    after.events.executions.some((entry) => entry.reason === "virgin-trigger" && entry.nomineeId === nominator.id),
    "Virgin trigger execution should be recorded during auto-advance"
  );
}

function testUnityAutoAdvanceVirginImmediateNominationDoesNotFakeDebateStop() {
  const action = writeAction("new-game", { scriptId: "tb", playerCount: 9, preferredHumanRoleId: "washerwoman", seed: 271827 });
  let processed = process();
  assert.equal(processed.result.ok, true, action.id);
  resolveFirstNightIfNeeded();

  const state = readState();
  assert.equal(advanceDayStage(state, "public").ok, true);
  markPublicDiscussionRound(state);
  assert.equal(advanceDayStage(state, "nomination").ok, true);
  state.dayStageMeta.nominationClock = { active: true, remaining: 3, budget: 3, status: "open", intent: "contract" };
  state.dayStageMeta.nominationDebate = null;
  state.dayStageMeta.executionCandidate = null;
  state.events.votes = [];
  state.events.executions = [];

  const nominator = state.players.find((player) => !player.isHuman && player.alive);
  const virgin = state.players.find((player) => !player.isHuman && player.alive && player.id !== nominator?.id);
  assert.ok(nominator, "auto-advance decision fixture needs an AI nominator");
  assert.ok(virgin, "auto-advance decision fixture needs an AI Virgin target");
  applyRole(state, nominator, "chef");
  applyRole(state, virgin, "virgin");
  virgin.poisoned = false;
  nominator.poisoned = false;
  state.tb.virginTriggeredIds = [];

  state.players.forEach((player) => {
    player.nominatedToday = !player.isHuman && player.id !== nominator.id;
    player.beenNominatedToday = player.id !== virgin.id;
    player.suspicion = player.suspicion ?? {};
    state.players.forEach((target) => {
      player.suspicion[target.id] = target.id === virgin.id ? 0.95 : 0.01;
    });
  });
  writeState(state);

  writeAction("auto-advance", {
    mode: "flow",
    resolveDebates: false,
    maxSteps: 1,
    publicSteps: 0,
    nominationTicks: 3,
  });
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);
  assert.notEqual(
    processed.viewModel.action.autoAdvance?.stoppedAt,
    "nomination-debate",
    "immediate Virgin execution should not be reported as a pending player vote decision"
  );
  assert.equal(processed.viewModel.nominationDebate, null, "immediate Virgin execution should not export a fake debate stop");

  const after = readState();
  const nominatorAfter = after.players.find((player) => player.id === nominator.id);
  assert.equal(nominatorAfter?.alive, false);
  assert.equal(after.dayStageMeta.nominationClock?.status, "execution-resolved");
  assert.equal(after.events.votes.length, 0);
}

function testUnityInvalidHumanNominationKeepsWindowOpen() {
  const action = writeAction("new-game", { scriptId: "tb", playerCount: 9, preferredHumanRoleId: "washerwoman", seed: 271820 });
  let processed = process();
  assert.equal(processed.result.ok, true, action.id);
  resolveFirstNightIfNeeded();

  writeAction("ai-public-step");
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);

  writeAction("open-nomination-window", { ticks: 3 });
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);
  assert.equal(processed.viewModel.nominationClock.active, true);

  const state = readState();
  const human = state.players.find((player) => player.isHuman);
  const nominee = state.players.find((player) => !player.isHuman && player.alive);
  assert.ok(human, "invalid nomination fixture needs a human player");
  assert.ok(nominee, "invalid nomination fixture needs a living nominee");
  human.nominatedToday = true;
  writeState(state);

  const invalidAction = writeAction("human-nomination-intent", {
    nominatorId: human.id,
    nomineeId: nominee.id,
    reason: "invalid repeat nomination",
  });
  processed = process();
  assert.equal(processed.result.ok, false, "invalid nomination intent should fail");
  assert.equal(processed.viewModel.action.lastActionId, invalidAction.id);

  const after = readState();
  assert.equal(after.dayStageMeta.nominationClock.active, true, "failed nomination intent should not close the window");
  assert.equal(after.dayStageMeta.nominationClock.status, "open");
  assert.equal(after.dayStageMeta.nominationClock.ticksRemaining, 3);
  assert.equal(after.dayStageMeta.nominationDebate?.active ?? false, false, "failed nomination intent should not create debate");
  assert.equal(processed.viewModel.nominationClock.active, true, "Unity should still show the open nomination window");
}

function testUnitySelfNominationIntentKeepsWindowOpen() {
  const action = writeAction("new-game", { scriptId: "tb", playerCount: 9, preferredHumanRoleId: "washerwoman", seed: 271823 });
  let processed = process();
  assert.equal(processed.result.ok, true, action.id);
  resolveFirstNightIfNeeded();

  writeAction("ai-public-step");
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);

  writeAction("open-nomination-window", { ticks: 3 });
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);
  assert.equal(processed.viewModel.nominationClock.active, true);

  const before = readViewModel();
  const human = before.players.find((player) => player.human);
  assert.ok(human, "self-nomination fixture needs a human player");

  const invalidAction = writeAction("human-nomination-intent", {
    nomineeId: human.id,
    reason: "contract illegal self nomination",
  });
  processed = process();
  assert.equal(processed.result.ok, false, "self-nomination intent should fail before creating debate");
  assert.equal(processed.viewModel.action.lastActionId, invalidAction.id);

  const after = readState();
  const humanState = after.players.find((player) => player.isHuman);
  assert.equal(humanState?.nominatedToday, false, "self-nomination should not spend the human nomination");
  assert.equal(humanState?.beenNominatedToday, false, "self-nomination should not mark the human as nominated");
  assert.equal(after.dayStageMeta.nominationClock.active, true, "failed self-nomination should not close the window");
  assert.equal(after.dayStageMeta.nominationDebate?.active ?? false, false, "failed self-nomination should not create debate");
  assert.equal(after.events.votes.length, 0, "failed self-nomination should not create a vote");
  assert.equal(processed.viewModel.nominationClock.active, true, "Unity should keep the nomination controls available");
}

function testUnityCannotPassNominationWindowWithActiveDebate() {
  const action = writeAction("new-game", { scriptId: "tb", playerCount: 9, preferredHumanRoleId: "washerwoman", seed: 271821 });
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
  const target = before.players.find((player) => !player.human && player.alive);
  assert.ok(target, "active debate pass guard fixture needs a living nominee");

  writeAction("human-nomination-intent", { nomineeId: target.id, reason: "contract active debate nomination" });
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);
  assert.equal(processed.viewModel.nominationDebate.active, true);

  const passAction = writeAction("pass-nomination-window");
  processed = process();
  assert.equal(processed.result.ok, false, "active nomination debate should block passing the window");
  assert.match(processed.result.reason, /投票|提名/);
  assert.equal(processed.viewModel.action.lastActionId, passAction.id);
  assert.equal(processed.viewModel.phase, "day");
  assert.equal(processed.viewModel.dayStage, "nomination");
  assert.equal(processed.viewModel.nominationDebate.active, true, "failed pass should preserve the active debate");
  assert.equal(processed.viewModel.voteCeremony, null, "failed pass should not fabricate a vote ceremony");

  const state = readState();
  assert.equal(state.phase, "day");
  assert.equal(state.dayStage, "nomination");
  assert.equal(state.dayStageMeta.nominationDebate?.active, true);
  assert.equal(state.events.votes.length, 0, "active debate should still be waiting for a vote");
  assert.equal(state.events.executions.length, 0);
}

function testUnityLegacyNominationActionResolvesActiveDebate() {
  const action = writeAction("new-game", { scriptId: "tb", playerCount: 9, preferredHumanRoleId: "washerwoman", seed: 271822 });
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
  const target = before.players.find((player) => !player.human && player.alive);
  assert.ok(target, "legacy nomination fixture needs a living nominee");

  writeAction("human-nomination-intent", { nomineeId: target.id, reason: "contract legacy nomination bridge" });
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);
  assert.equal(processed.viewModel.nominationDebate.active, true);

  const legacyVoteAction = writeAction("nomination", { nomineeId: target.id, humanVoteYes: true });
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);
  assert.equal(processed.viewModel.action.lastActionId, legacyVoteAction.id);
  assert.equal(processed.viewModel.nominationDebate.active, false, "legacy nomination action should close the active debate it resolves");
  assert.ok(processed.viewModel.voteCeremony, "legacy nomination action should export the resolved vote");
  assert.equal(processed.viewModel.voteCeremony.nomineeId, target.id);

  const state = readState();
  assert.equal(state.dayStageMeta.nominationDebate?.active, false);
  assert.equal(state.events.votes.length, 1, "legacy action should create exactly one vote for the active debate");
  assert.equal(state.events.votes[0].nomineeId, target.id);
}

function testUnityAINominationStepCanResolveVote() {
  const action = writeAction("new-game", { scriptId: "tb", playerCount: 9, preferredHumanRoleId: "washerwoman", seed: 314159 });
  let processed = process();
  assert.equal(processed.result.ok, true, action.id);
  resolveFirstNightIfNeeded();

  writeAction("ai-public-step");
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);

  writeAction("open-nomination-window", { ticks: 3 });
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);

  const state = readState();
  const nominator = state.players.find((player) => !player.isHuman && player.alive);
  const nominee = state.players.find((player) => !player.isHuman && player.alive && player.id !== nominator?.id);
  assert.ok(nominator, "expected AI nominator");
  assert.ok(nominee, "expected AI nominee");
  state.players.forEach((player) => {
    player.beenNominatedToday = player.id !== nominee.id;
  });
  state.players
    .filter((player) => !player.isHuman)
    .forEach((player) => {
      player.nominatedToday = player.id !== nominator.id;
      state.players.forEach((target) => {
        player.suspicion[target.id] = target.id === nominee.id ? 0.92 : 0.05;
      });
    });
  writeState(state);

  writeAction("ai-nomination-step");
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);
  assert.equal(processed.viewModel.nominationDebate.active, true, "AI nomination should enter debate before vote");
  assert.equal(processed.viewModel.nominationDebate.nominatorId, nominator.id);
  assert.equal(processed.viewModel.nominationDebate.nomineeId, nominee.id);
  assert.equal(
    processed.viewModel.nominationDebate.strategyRationale?.kind,
    "nomination-strategy-rationale",
    "AI nomination debate should export structured strategy rationale"
  );
  assert.ok(
    processed.viewModel.nominationDebate.reason &&
      processed.viewModel.nominationDebate.strategyRationale.line,
    "exported nomination debate should keep both a visible reason and structured strategy rationale"
  );
  assert.equal(
    processed.viewModel.nominationDebate.decisionRationale?.focusId,
    nominee.id,
    "AI nomination debate should export decision rationale for recap"
  );
  assert.ok(
    processed.viewModel.nominationDebate.rationaleCards?.some((card) => card.kind === "decision" && card.targetId === nominee.id),
    "AI nomination debate should expose a target-choice rationale card"
  );
  assert.ok(
    processed.viewModel.nominationDebate.rationaleCards?.some((card) => card.kind === "strategy" && card.summary),
    "AI nomination debate should expose a vote-strategy rationale card"
  );
  assert.ok(
    processed.viewModel.nominationDebate.rationaleCards?.some((card) => card.kind === "verification" && card.summary.includes(processed.viewModel.nominationDebate.nomineeName)),
    "AI nomination debate should expose a verification rationale card"
  );
  const debateDecisionCard = processed.viewModel.nominationDebate.rationaleCards.find((card) => card.kind === "decision");
  const debateStrategyCard = processed.viewModel.nominationDebate.rationaleCards.find((card) => card.kind === "strategy");
  assert.equal(
    debateDecisionCard?.summary,
    processed.viewModel.nominationDebate.decisionRationale.spokenLine,
    "decision card should use the same spoken line stored in decision rationale"
  );
  assert.ok(
    compactForLineMatch(processed.viewModel.nominationDebate.reason).includes(compactForLineMatch(debateDecisionCard.summary)),
    "debate reason should include the same decision summary shown in recap"
  );
  assert.ok(
    debateStrategyCard?.summary &&
      processed.viewModel.nominationDebate.strategyRationale.line &&
      compactForLineMatch(processed.viewModel.nominationDebate.strategyRationale.line).includes(
        compactForLineMatch(debateStrategyCard.summary).slice(0, 12)
      ),
    "strategy card should remain anchored to the stored strategy rationale"
  );
  assert.ok(
    processed.viewModel.timeline.some((entry) => entry.mode === "nomination-debate" && entry.rationaleCards?.some((card) => card.kind === "strategy")),
    "nomination timeline should expose rationale cards for recap"
  );
  const timelineDebate = processed.viewModel.timeline.find((entry) => entry.mode === "nomination-debate" && entry.targetId === nominee.id);
  assert.equal(
    timelineDebate?.rationaleCards.find((card) => card.kind === "decision")?.summary,
    debateDecisionCard.summary,
    "timeline decision recap should match the active debate decision recap"
  );
  assert.equal(
    timelineDebate?.rationaleCards.find((card) => card.kind === "strategy")?.summary,
    debateStrategyCard.summary,
    "timeline strategy recap should match the active debate strategy recap"
  );
  assert.equal(processed.viewModel.voteCeremony, null, "AI nomination vote should wait for resolve action");

  writeAction("resolve-nomination-vote", { humanVoteYes: true });
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);
  assert.equal(processed.viewModel.nominationDebate.active, false);
  assert.equal(processed.viewModel.voteCeremony.nomineeId, nominee.id);
  assert.equal(
    processed.viewModel.voteCeremony.voters.find((entry) => entry.voterId === nominator.id)?.vote,
    true,
    "AI nominator should visibly vote yes after debate resolution"
  );
}

function testUnityLateGameAINominationCanBecomeExecutionBeforeFinalThree() {
  const action = writeAction("new-game", { scriptId: "tb", playerCount: 9, preferredHumanRoleId: "washerwoman", seed: 424242 });
  let processed = process();
  assert.equal(processed.result.ok, true, action.id);
  resolveFirstNightIfNeeded();

  const state = readState();
  const goodNominator = state.players.find((player) => !player.isHuman && player.team === "good");
  const goodVoters = state.players.filter((player) => !player.isHuman && player.team === "good" && player.id !== goodNominator?.id).slice(0, 2);
  const demon = state.players.find((player) => !player.isHuman && player.category === "demon");
  const evilAlly = state.players.find((player) => !player.isHuman && player.team === "evil" && player.id !== demon?.id);
  assert.ok(goodNominator, "fixture needs a good AI nominator");
  assert.equal(goodVoters.length, 2, "fixture needs two good AI voters");
  assert.ok(demon, "fixture needs an evil nominee");
  assert.ok(evilAlly, "fixture needs a second evil player");

  state.phase = "day";
  state.day = 5;
  state.night = 5;
  state.dayStage = "private";
  state.dayStageMeta.nominationClock = { active: false, remaining: 0, budget: 0, status: "idle" };
  state.dayStageMeta.nominationDebate = null;
  state.dayStageMeta.executionCandidate = null;
  state.events.votes = [];
  state.events.executions = [];

  const aliveIds = new Set([goodNominator.id, ...goodVoters.map((player) => player.id), demon.id, evilAlly.id]);
  state.players.forEach((player) => {
    player.alive = aliveIds.has(player.id);
    player.ghostVoteAvailable = false;
    player.nominatedToday = player.id !== goodNominator.id;
    player.beenNominatedToday = player.id !== demon.id;
    player.suspicion = player.suspicion ?? {};
    state.players.forEach((target) => {
      player.suspicion[target.id] = 0.08;
    });
    player.suspicion[demon.id] = player.id === goodNominator.id ? 0.72 : 0.25;
  });
  initializeAI(state);
  assert.equal(advanceDayStage(state, "public").ok, true);
  markPublicDiscussionRound(state);
  assert.equal(advanceDayStage(state, "nomination").ok, true);
  writeState(state);

  writeAction("open-nomination-window", { ticks: 4 });
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);

  writeAction("ai-nomination-step");
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);
  assert.equal(processed.viewModel.nominationDebate.active, true, "late-game AI nomination should enter debate");
  assert.equal(processed.viewModel.nominationDebate.nominatorId, goodNominator.id);
  assert.equal(processed.viewModel.nominationDebate.nomineeId, demon.id);

  writeAction("resolve-nomination-vote", { humanVoteYes: true });
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);
  assert.equal(processed.result.result.threshold, 3, "five alive should require three votes");
  assert.equal(processed.result.result.passed, true, "late-game AI nomination should gather enough support to go on the block");
  assert.ok(processed.result.result.yesVotes >= processed.result.result.threshold);
  goodVoters.forEach((voter) => {
    assert.equal(
      processed.result.result.votes.find((entry) => entry.voterId === voter.id)?.vote,
      true,
      "good AI voters should support executable pressure in a five-alive window"
    );
  });
  assert.equal(processed.viewModel.executionCandidate?.nomineeId, demon.id, "passed AI vote should put the nominee on the block");

  writeAction("pass-nomination-window");
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);
  assert.equal(
    readState().events.executions.some((entry) => entry.nomineeId === demon.id && entry.reason === "vote-execution"),
    true,
    "ending the late-game nomination window should execute the AI-backed nominee"
  );
}

function setupDeadHumanVoteFixture(seed) {
  const action = writeAction("new-game", { scriptId: "tb", playerCount: 9, preferredHumanRoleId: "washerwoman", seed });
  let processed = process();
  assert.equal(processed.result.ok, true, action.id);
  resolveFirstNightIfNeeded();

  const state = readState();
  const human = state.players.find((player) => player.isHuman);
  const nominator = state.players.find((player) => !player.isHuman && player.alive);
  const nominee = state.players.find((player) => !player.isHuman && player.alive && player.id !== nominator?.id);
  assert.ok(human, "fixture needs human player");
  assert.ok(nominator, "fixture needs AI nominator");
  assert.ok(nominee, "fixture needs AI nominee");

  state.phase = "day";
  state.day = 3;
  state.dayStage = "nomination";
  state.dayStageMeta.nominationClock = { active: true, remaining: 3, budget: 3, status: "open" };
  state.dayStageMeta.nominationDebate = null;
  state.dayStageMeta.executionCandidate = null;
  state.events.votes = [];
  state.events.executions = [];
  human.alive = false;
  human.ghostVoteAvailable = true;
  state.players.forEach((player) => {
    player.nominatedToday = false;
    player.beenNominatedToday = false;
  });
  writeState(state);

  writeAction("human-nomination-intent", {
    nominatorId: nominator.id,
    nomineeId: nominee.id,
    reason: "Contract nomination for dead-human ghost vote control.",
  });
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);
  assert.equal(processed.viewModel.nominationDebate.active, true);
  return { human, nominator, nominee };
}

function setupAliveHumanNomineeVoteFixture(seed) {
  const action = writeAction("new-game", { scriptId: "tb", playerCount: 9, preferredHumanRoleId: "washerwoman", seed });
  let processed = process();
  assert.equal(processed.result.ok, true, action.id);
  resolveFirstNightIfNeeded();

  const state = readState();
  const human = state.players.find((player) => player.isHuman);
  const nominator = state.players.find((player) => !player.isHuman && player.alive);
  assert.ok(human, "fixture needs human player");
  assert.ok(nominator, "fixture needs AI nominator");

  state.phase = "day";
  state.day = 2;
  state.dayStage = "nomination";
  state.dayStageMeta.nominationClock = { active: true, remaining: 3, budget: 3, status: "open" };
  state.dayStageMeta.nominationDebate = null;
  state.dayStageMeta.executionCandidate = null;
  state.events.votes = [];
  state.events.executions = [];
  state.players.forEach((player) => {
    player.nominatedToday = false;
    player.beenNominatedToday = false;
  });
  writeState(state);

  writeAction("human-nomination-intent", {
    nominatorId: nominator.id,
    nomineeId: human.id,
    reason: "Contract nomination for default human self-protection vote.",
  });
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);
  assert.equal(processed.viewModel.nominationDebate.active, true);
  assert.equal(processed.viewModel.nominationDebate.nomineeId, human.id);
  return { human, nominator };
}

function setupEvilAllyNomineeVoteFixture(seed) {
  const action = writeAction("new-game", { scriptId: "tb", playerCount: 9, preferredHumanRoleId: "imp", seed });
  let processed = process({ preferredHumanRoleId: "imp", seed });
  assert.equal(processed.result.ok, true, action.id);
  resolveFirstNightIfNeeded();

  const state = readState();
  const human = state.players.find((player) => player.isHuman);
  const nominee = state.players.find((player) => !player.isHuman && player.alive);
  const nominator = state.players.find((player) => !player.isHuman && player.alive && player.id !== nominee?.id);
  assert.ok(human, "fixture needs human player");
  assert.ok(nominee, "fixture needs AI nominee");
  assert.ok(nominator, "fixture needs AI nominator");

  applyRole(state, human, "imp");
  applyRole(state, nominee, "scarlet-woman");
  state.phase = "day";
  state.day = 2;
  state.dayStage = "nomination";
  state.dayStageMeta.nominationClock = { active: true, remaining: 3, budget: 3, status: "open" };
  state.dayStageMeta.nominationDebate = null;
  state.dayStageMeta.executionCandidate = null;
  state.events.votes = [];
  state.events.executions = [];
  state.players.forEach((player) => {
    player.nominatedToday = false;
    player.beenNominatedToday = false;
  });
  writeState(state);

  writeAction("human-nomination-intent", {
    nominatorId: nominator.id,
    nomineeId: nominee.id,
    reason: "Contract nomination for default evil ally protection vote.",
  });
  processed = process({ preferredHumanRoleId: "imp", seed });
  assert.equal(processed.result.ok, true, processed.result.reason);
  assert.equal(processed.viewModel.nominationDebate.active, true);
  assert.equal(processed.viewModel.nominationDebate.nomineeId, nominee.id);
  return { human, nominee, nominator };
}

function testUnityAliveHumanNomineeVotesNoByDefault() {
  const { human } = setupAliveHumanNomineeVoteFixture(515153);

  writeAction("resolve-nomination-vote");
  const processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);
  const humanVote = processed.result.result.votes.find((entry) => entry.voterId === human.id);
  assert.equal(humanVote?.vote, false, "alive human nominee should not vote yes without an explicit Unity payload");
}

function testUnityEvilHumanProtectsEvilAllyByDefault() {
  const { human } = setupEvilAllyNomineeVoteFixture(515154);

  writeAction("resolve-nomination-vote");
  const processed = process({ preferredHumanRoleId: "imp", seed: 515154 });
  assert.equal(processed.result.ok, true, processed.result.reason);
  const humanVote = processed.result.result.votes.find((entry) => entry.voterId === human.id);
  assert.equal(humanVote?.vote, false, "evil human should not default-vote yes on an evil ally");
}

function testUnityDeadHumanDoesNotSpendGhostVoteByDefault() {
  const { human } = setupDeadHumanVoteFixture(515151);

  writeAction("resolve-nomination-vote");
  const processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);
  const humanVote = processed.result.result.votes.find((entry) => entry.voterId === human.id);
  assert.equal(humanVote?.vote, false, "dead human should not vote yes without an explicit Unity payload");
  assert.equal(readState().players.find((player) => player.id === human.id)?.ghostVoteAvailable, true);
}

function testUnityDeadHumanCanExplicitlySpendGhostVote() {
  const { human } = setupDeadHumanVoteFixture(515152);

  writeAction("resolve-nomination-vote", { humanVoteYes: true });
  const processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);
  const humanVote = processed.result.result.votes.find((entry) => entry.voterId === human.id);
  assert.equal(humanVote?.vote, true, "explicit yes should still spend the dead human ghost vote");
  assert.equal(readState().players.find((player) => player.id === human.id)?.ghostVoteAvailable, false);
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

function testUnityNominationDefenseRefreshesImmediateResolveVote() {
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
  assert.ok(human && aiNominator, "human defense vote fixture should have a human nominee and AI nominator");

  writeAction("human-nomination-intent", {
    nominatorId: aiNominator.id,
    nomineeId: human.id,
    reason: `${aiNominator.name} nominates ${human.name}`,
  });
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);
  assert.equal(processed.viewModel.nominationDebate.active, true);

  writeAction("nomination-debate-response", {
    text: "Please do not execute me here. This is too early and the case has no public evidence; vote no and keep pressure elsewhere.",
  });
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);

  const state = readState();
  const goodVoter = state.players.find(
    (player) => !player.isHuman && player.team === "good" && player.alive && player.id !== aiNominator.id
  );
  assert.ok(goodVoter, "fixture should have a good AI voter");
  goodVoter.suspicion[human.id] = 0.6;
  writeState(state);

  writeAction("resolve-nomination-vote", { humanVoteYes: false });
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);
  const vote = processed.result.result.votes.find((entry) => entry.voterId === goodVoter.id);
  assert.ok(vote, "resolve result should include the chosen good AI voter");
  assert.equal(vote.vote, false, "resolve should refresh human defense evidence before the immediate AI vote");
  assert.equal(vote.voteRationale?.nominationDefenseContext?.humanNominee, true);
  assert.ok(
    vote.voteRationale?.suspicion < 0.5,
    "fresh public defense evidence should replace stale raw suspicion during resolve"
  );
  assert.ok(vote.voteRationale?.threshold > 0.64, "human defense should raise the immediate execution threshold");
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

function testUnityExecutionDayCannotReopenNominationWindow() {
  const action = writeAction("new-game", { scriptId: "tb", playerCount: 9, preferredHumanRoleId: "washerwoman", seed: 260610 });
  let processed = process();
  assert.equal(processed.result.ok, true, action.id);
  writeAction("phase", { stage: "day" });
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);

  const state = readState();
  assert.equal(advanceDayStage(state, "public").ok, true);
  markPublicDiscussionRound(state);
  assert.equal(advanceDayStage(state, "nomination").ok, true);
  const virgin = state.players.find((player) => !player.isHuman && player.alive);
  const nominator = state.players.find((player) => !player.isHuman && player.alive && player.id !== virgin?.id);
  assert.ok(virgin, "fixture needs a Virgin target");
  assert.ok(nominator, "fixture needs a townsfolk nominator");
  applyRole(state, virgin, "virgin");
  applyRole(state, nominator, "chef");

  const result = resolveNominationAndVote(
    state,
    {
      nominatorId: nominator.id,
      nomineeId: virgin.id,
      humanVoteYes: true,
      decideAIVote: () => true,
    }
  );
  assert.equal(result.accepted, true, result.reason);
  assert.equal(result.special, "virgin");
  assert.equal(state.dayStageMeta.nominationClock.status, "execution-resolved");
  writeState(state);

  const openAction = writeAction("open-nomination-window", { ticks: 3 });
  processed = process();
  assert.equal(processed.result.ok, false, "Unity should not reopen nomination after an execution");
  assert.match(processed.result.reason, /处决/);
  assert.equal(processed.viewModel.action.lastActionId, openAction.id);
  assert.equal(readState().dayStageMeta.nominationClock.status, "execution-resolved");

  const aiAction = writeAction("ai-nomination-step", { ticks: 3 });
  processed = process();
  assert.equal(processed.result.ok, false, "AI nomination step should also stop before reopening the window");
  assert.match(processed.result.reason, /处决/);
  assert.equal(processed.viewModel.action.lastActionId, aiAction.id);
  assert.equal(readState().dayStageMeta.nominationClock.status, "execution-resolved");

  const passAction = writeAction("pass-nomination-window");
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);
  assert.equal(processed.viewModel.action.lastActionId, passAction.id);
  assert.equal(processed.result.stage, "night", "player pass/end-day should continue to night after a same-day execution");
  assert.equal(processed.viewModel.phase, "night");
}

function testUnityExecutionStopsOnSecondNightForHumanAction() {
  const action = writeAction("new-game", { scriptId: "tb", playerCount: 9, preferredHumanRoleId: "fortune-teller", seed: 424242 });
  let processed = process();
  assert.equal(processed.result.ok, true, action.id);

  const firstNightTargets = processed.viewModel.humanNightAction.options.slice(0, 2).map((entry) => entry.id);
  assert.equal(processed.viewModel.humanNightAction.available, true, "fixture should start with a first-night Fortune Teller action");
  writeAction("night-action", { targetIds: firstNightTargets });
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);
  assert.equal(processed.viewModel.phase, "day");

  writeAction("public-discussion", { mode: "confirm" });
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);

  writeAction("phase", { stage: "nomination" });
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);

  const state = readState();
  const nominee = state.players.find(
    (player) => player.alive && !player.isHuman && player.category !== "demon" && player.roleId !== "saint"
  );
  assert.ok(nominee, "second-night flow fixture needs a non-demon nominee");
  nominee.alive = false;
  state.events.votes.push({
    day: state.day,
    nominatorId: state.players.find((player) => player.isHuman)?.id ?? "p1",
    nomineeId: nominee.id,
    yesVotes: Math.ceil(state.players.filter((player) => player.alive).length / 2),
    threshold: Math.ceil(state.players.filter((player) => player.alive).length / 2),
    votes: [],
    passed: true,
  });
  state.events.executions.push({
    day: state.day,
    nomineeId: nominee.id,
    roleId: nominee.roleId,
    reason: "contract-execution",
    died: true,
  });
  writeState(state);

  writeAction("phase", { stage: "night", confirmed: true });
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);
  assert.equal(processed.viewModel.phase, "night", "execution day should stop on the next night, not auto-resolve to day");
  assert.equal(processed.viewModel.day, 1, "entering night should not increment the day until night resolves");
  assert.equal(processed.viewModel.night, 2, "execution day should begin the second night");
  assert.equal(processed.viewModel.humanNightAction.available, true, "second-night human action should be available before night resolution");

  const secondNightTargets = processed.viewModel.humanNightAction.options.slice(0, 2).map((entry) => entry.id);
  assert.equal(secondNightTargets.length, 2, "second-night Fortune Teller action should expose two targets");
  writeAction("night-action", { targetIds: secondNightTargets });
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);
  assert.equal(readState().humanNightPlan ?? null, null, "second-night action should be consumed during N2 resolution");
  assert.equal(processed.result.stage, "day");
  assert.equal(processed.viewModel.phase, "day", "resolving N2 should then advance to the next day");
  assert.equal(processed.viewModel.day, 2);
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

function testUnityPassedNominationCanBeOvertakenBeforeDayEnd() {
  const action = writeAction("new-game", { scriptId: "tb", playerCount: 12, preferredHumanRoleId: "washerwoman", seed: 2469 });
  let processed = process({ playerCount: 12 });
  assert.equal(processed.result.ok, true, action.id);
  writeAction("phase", { stage: "day" });
  processed = process({ playerCount: 12 });
  assert.equal(processed.result.ok, true, processed.result.reason);

  let state = readState();
  assert.equal(advanceDayStage(state, "public").ok, true);
  markPublicDiscussionRound(state);
  assert.equal(advanceDayStage(state, "nomination").ok, true);

  const human = state.players.find((player) => player.isHuman);
  const livingAis = state.players.filter(
    (player) => !player.isHuman && player.alive && !["virgin", "ravenkeeper"].includes(player.roleId)
  );
  assert.ok(human, "fixture needs a human player");
  assert.ok(livingAis.length >= 8, "fixture needs enough legal AI targets");

  const firstTarget = livingAis[0];
  const secondNominator = livingAis[8] ?? livingAis[6];
  const secondTarget = livingAis.find((player) => player.id !== firstTarget.id && player.id !== secondNominator.id && player.team === "good") ?? livingAis[7];
  const firstYes = new Set(livingAis.slice(0, 6).map((player) => player.id));
  const secondYes = new Set(livingAis.slice(0, 8).map((player) => player.id));
  const decideAIVote = (voter, nominee) => (nominee.id === firstTarget.id ? firstYes.has(voter.id) : secondYes.has(voter.id));

  const first = resolveNominationAndVote(
    state,
    {
      nominatorId: human.id,
      nomineeId: firstTarget.id,
      humanVoteYes: true,
      decideAIVote,
    }
  );
  assert.equal(first.accepted, true, first.reason);
  assert.equal(first.passed, true);
  assert.equal(first.onBlock, true);
  assert.equal(firstTarget.alive, true, "Unity state should not kill on the first passed vote");

  const second = resolveNominationAndVote(
    state,
    {
      nominatorId: secondNominator.id,
      nomineeId: secondTarget.id,
      humanVoteYes: true,
      decideAIVote,
    }
  );
  assert.equal(second.accepted, true, second.reason);
  assert.equal(second.passed, true);
  assert.ok(second.yesVotes > first.yesVotes, "second vote should overtake the first on-block nominee");
  assert.equal(state.dayStageMeta.executionCandidate.nomineeId, secondTarget.id);
  writeState(state);

  const passAction = writeAction("pass-nomination-window");
  processed = process({ playerCount: 12 });
  assert.equal(processed.result.ok, true, processed.result.reason);
  assert.equal(processed.viewModel.action.lastActionId, passAction.id);

  state = readState();
  const persistedFirstTarget = state.players.find((player) => player.id === firstTarget.id);
  const persistedSecondTarget = state.players.find((player) => player.id === secondTarget.id);
  assert.equal(persistedFirstTarget?.alive, true, "overtaken nominee should remain alive after Unity day end");
  assert.equal(persistedSecondTarget?.alive, false, "Unity day end should execute the final on-block nominee");
  assert.ok(state.events.executions.some((entry) => entry.nomineeId === secondTarget.id && entry.reason === "vote-execution"));
  assert.equal(processed.viewModel.executionCandidate, null, "executed candidate should be cleared from Unity viewmodel");
}

function testUnityNightActionResolvesNightToDay() {
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
  assert.equal(state.humanNightPlan ?? null, null, "Unity night-action should consume the submitted plan during night resolution");
  assert.equal(processed.result.stage, "day", "Unity night-action should continue resolving to the next day when no Storyteller gate blocks");
  assert.equal(processed.viewModel.phase, "day");
  assert.equal(processed.viewModel.humanNightAction.available, false);
  assert.equal(readViewModel().action.lastActionId, nightAction.id);
}

function testUnityFortuneTellerRequiresAndSettlesTwoTargets() {
  const action = writeAction("new-game", { scriptId: "tb", playerCount: 9, preferredHumanRoleId: "fortune-teller", seed: 9014 });
  let processed = process();
  assert.equal(processed.result.ok, true, action.id);

  const before = readViewModel();
  assert.equal(before.phase, "night");
  assert.equal(before.humanNightAction.available, true);
  assert.equal(before.humanNightAction.roleId, "fortune-teller");
  assert.equal(before.humanNightAction.minTargetCount, 2);
  assert.equal(before.humanNightAction.maxTargetCount, 2);
  assert.equal(before.humanNightAction.targetCount, 2);
  const options = before.humanNightAction.options.slice(0, 2);
  const targets = options.map((entry) => entry.id);
  const targetNames = options.map((entry) => entry.name);
  assert.equal(targets.length, 2, "Fortune Teller should expose two selectable targets");

  const emptyTargetAction = writeAction("night-action", {});
  processed = process();
  assert.equal(processed.result.ok, false, "Fortune Teller should reject an empty manual Unity action instead of auto-filling hidden targets");
  assert.equal(processed.viewModel.action.lastActionId, emptyTargetAction.id);
  assert.equal(processed.viewModel.phase, "night", "empty rejected Fortune Teller action should keep the player in night");

  const oneTargetAction = writeAction("night-action", { targetIds: targets.slice(0, 1) });
  processed = process();
  assert.equal(processed.result.ok, false, "Fortune Teller should reject a single target from Unity");
  assert.equal(processed.viewModel.action.lastActionId, oneTargetAction.id);
  assert.equal(processed.viewModel.phase, "night", "rejected Fortune Teller action should keep the player in night");

  const twoTargetAction = writeAction("night-action", { targetIds: targets });
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);
  assert.equal(processed.viewModel.action.lastActionId, twoTargetAction.id);
  assert.equal(processed.viewModel.phase, "day");
  assert.equal(processed.viewModel.humanNightAction.available, false);
  assert.deepEqual(twoTargetAction.payload.targetIds, targets, "Unity action payload should carry both targetIds");
  const infoPing = readState().events.infoPings.find((entry) => entry.actorId === before.players.find((player) => player.human)?.id && entry.type === "fortune-teller");
  assert.deepEqual(infoPing?.targetIds, targets, "Fortune Teller info ping should settle the same two targetIds Unity submitted");
  assert.ok(
    processed.viewModel.privateInfo.some((line) => /查验/.test(line) && /结果/.test(line)),
    "Fortune Teller privateInfo should show the resolved check result"
  );
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

function testUnityPassNominationWindowExposesNextNightAction() {
  const action = writeAction("new-game", { scriptId: "tb", playerCount: 9, preferredHumanRoleId: "fortune-teller", seed: 9014 });
  let processed = process();
  assert.equal(processed.result.ok, true, action.id);

  const firstNightTargets = processed.viewModel.humanNightAction.options.slice(0, 2).map((entry) => entry.id);
  writeAction("night-action", { targetIds: firstNightTargets });
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);
  assert.equal(processed.viewModel.phase, "day");

  writeAction("ai-public-step");
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);

  writeAction("open-nomination-window", { ticks: 2 });
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);
  assert.equal(processed.viewModel.dayStage, "nomination");

  const passAction = writeAction("pass-nomination-window");
  processed = process();
  assert.equal(processed.result.ok, true, processed.result.reason);
  assert.equal(processed.result.stage, "night");
  assert.equal(processed.viewModel.phase, "night");
  assert.equal(processed.viewModel.night, 2);
  assert.equal(processed.viewModel.humanNightAction.available, true, "passing nomination should expose the next human night action");
  assert.equal(processed.viewModel.humanNightAction.roleId, "fortune-teller");
  assert.equal(processed.viewModel.action.lastActionId, passAction.id);
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
  assert.equal(processed.result.resolvedImmediately, true, "Slayer public day action should resolve immediately");
  assert.equal(processed.result.public, true, "Slayer public day action should be marked public");
  const state = readState();
  assert.equal(state.humanDayPlan ?? null, null, "resolved public day actions should not linger as a pending day plan");
  assert.ok(
    state.events.dayDeaths.some((entry) => entry.reason === "slayer-shot" && entry.playerId === target.id) ||
      state.events.speeches.some((entry) => entry.publicAbility && entry.abilityRoleId === "slayer"),
    "Unity day-action should resolve or at least publicly record the Slayer shot immediately"
  );
  const vm = readViewModel();
  assert.equal(vm.action.lastActionId, dayAction.id);
  assert.equal(vm.action.resolvedImmediately, true);
  assert.equal(vm.action.publicAction, true);
  assert.ok(vm.action.speechId, "Unity action status should expose the public ability speech id");
  assert.ok(
    vm.timeline.some((entry) => entry.intent === "public-ability" && entry.abilityRoleId === "slayer"),
    "Unity timeline should expose the public Slayer ability entry"
  );
}

function testUnityArtistUsesDayActionInsteadOfNightAction() {
  const action = writeAction("new-game", { scriptId: "snv", playerCount: 9, preferredHumanRoleId: "artist", seed: 3457 });
  let processed = process({ scriptId: "snv", preferredHumanRoleId: "artist", seed: 3457 });
  assert.equal(processed.result.ok, true, action.id);
  assert.equal(processed.viewModel.phase, "night");
  assert.equal(processed.viewModel.humanNightAction.available, false, "Artist should not be exposed as a night action");

  resolveFirstNightIfNeeded();
  const before = readViewModel();
  assert.equal(before.phase, "day");
  assert.equal(before.humanDayAction.available, true, before.humanDayAction.reason);
  assert.equal(before.humanDayAction.roleId, "artist");
  assert.equal(before.humanDayAction.inputType, "question");

  const dayAction = writeAction("day-action", { question: "Is there a demon in play?" });
  processed = process({ scriptId: "snv", preferredHumanRoleId: "artist", seed: 3457 });
  assert.equal(processed.result.ok, true, processed.result.reason);
  assert.equal(processed.result.resolvedImmediately, true, "Artist day question should resolve immediately");
  assert.equal(processed.result.private, true, "Artist answer should be private");
  assert.equal(processed.viewModel.action.lastActionId, dayAction.id);
  const state = readState();
  const humanPlayer = state.players.find((player) => player.isHuman);
  assert.equal(state.humanDayPlan ?? null, null, "resolved Artist question should not linger as a pending day plan");
  assert.ok(
    state.events.infoPings.some((entry) => entry.actorId === humanPlayer?.id && entry.type === "artist"),
    "Unity day-action should write an Artist private info ping"
  );
  assert.ok(
    humanPlayer?.privateNotes.some((note) => /Artist|答案/.test(note)),
    "Unity day-action should add the Artist answer to private notes"
  );
}

function testUnityGossipPublicStatementWritesTimeline() {
  const action = writeAction("new-game", { scriptId: "bmr", playerCount: 9, preferredHumanRoleId: "gossip", seed: 4512 });
  let processed = process({ scriptId: "bmr", preferredHumanRoleId: "gossip" });
  assert.equal(processed.result.ok, true, action.id);
  resolveFirstNightIfNeeded();

  const phaseAction = writeAction("public-discussion");
  processed = process({ scriptId: "bmr", preferredHumanRoleId: "gossip" });
  assert.equal(processed.result.ok, true, phaseAction.id);

  const before = readViewModel();
  assert.equal(before.humanDayAction.available, true, before.humanDayAction.reason);
  assert.equal(before.humanDayAction.roleId, "gossip");
  assert.equal(before.humanDayAction.interaction.confirmText, "公开声明");
  const statement = "我公开声明：今天至少有一名外来者在场。";
  const dayAction = writeAction("day-action", { text: statement });
  processed = process({ scriptId: "bmr", preferredHumanRoleId: "gossip" });
  assert.equal(processed.result.ok, true, processed.result.reason);
  assert.equal(processed.result.resolvedImmediately, true);
  assert.equal(processed.result.public, true);

  const state = readState();
  assert.equal(state.humanDayPlan ?? null, null, "Gossip public statement should not linger as a pending day plan");
  assert.ok(
    state.events.speeches.some((entry) => entry.publicAbility && entry.abilityRoleId === "gossip" && entry.line.includes(statement)),
    "Gossip statement should be recorded as a public ability speech"
  );
  const vm = readViewModel();
  assert.equal(vm.action.lastActionId, dayAction.id);
  assert.equal(vm.action.resolvedImmediately, true);
  assert.equal(vm.action.publicAction, true);
  assert.ok(vm.action.speechId, "Gossip public statement should expose a speech id");
  assert.ok(
    vm.timeline.some((entry) => entry.intent === "public-ability" && entry.abilityRoleId === "gossip" && entry.text.includes(statement)),
    "Unity timeline should expose the public Gossip statement"
  );
}

function testUnityJugglerPublicGuessesWriteTimeline() {
  const action = writeAction("new-game", { scriptId: "snv", playerCount: 9, preferredHumanRoleId: "juggler", seed: 4513 });
  let processed = process({ scriptId: "snv", preferredHumanRoleId: "juggler" });
  assert.equal(processed.result.ok, true, action.id);
  resolveFirstNightIfNeeded();

  const phaseAction = writeAction("public-discussion");
  processed = process({ scriptId: "snv", preferredHumanRoleId: "juggler" });
  assert.equal(processed.result.ok, true, phaseAction.id);

  const before = readViewModel();
  assert.equal(before.humanDayAction.available, true, before.humanDayAction.reason);
  assert.equal(before.humanDayAction.roleId, "juggler");
  assert.equal(before.humanDayAction.inputType, "guesses");
  const guesses = before.humanDayAction.options.slice(0, 2).map((entry, index) => ({
    playerId: entry.id,
    roleId: before.humanDayAction.roleOptions[index]?.id ?? before.humanDayAction.roleOptions[0].id,
  }));
  const dayAction = writeAction("day-action", { guesses });
  processed = process({ scriptId: "snv", preferredHumanRoleId: "juggler" });
  assert.equal(processed.result.ok, true, processed.result.reason);
  assert.equal(processed.result.resolvedImmediately, true);
  assert.equal(processed.result.public, true);

  const state = readState();
  const humanPlayer = state.players.find((player) => player.isHuman);
  assert.ok(humanPlayer, "fixture should keep a human Juggler");
  assert.equal(state.humanDayPlan ?? null, null, "Juggler public guesses should not linger as a pending day plan");
  assert.equal(state.snv.jugglerGuessesByDay[humanPlayer.id].guesses.length, guesses.length);
  assert.equal(state.snv.jugglerGuessesByDay[humanPlayer.id].sourceSpeechId, processed.result.speechId);
  assert.ok(
    state.events.speeches.some((entry) => entry.publicAbility && entry.abilityRoleId === "juggler" && entry.abilityKind === "juggler-guesses"),
    "Juggler guesses should be recorded as a public ability speech"
  );
  const vm = readViewModel();
  assert.equal(vm.action.lastActionId, dayAction.id);
  assert.equal(vm.action.resolvedImmediately, true);
  assert.equal(vm.action.publicAction, true);
  assert.ok(vm.action.speechId, "Juggler public guesses should expose a speech id");
  assert.ok(
    vm.timeline.some((entry) => entry.intent === "public-ability" && entry.abilityRoleId === "juggler"),
    "Unity timeline should expose the public Juggler guesses"
  );
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

function testUnityTerminalNightWinTakesPriorityOverStorytellerQueue() {
  const state = createNewGame({ scriptId: "snv", playerCount: 9, preferredHumanRoleId: "sage" }, withSeededRandom(20260606));
  initializeAI(state);
  runNight(state, withSeededRandom(20260607));
  beginNightPhase(state);

  const human = state.players.find((player) => player.isHuman);
  assert.equal(human?.roleId, "sage", "fixture should place the human as Sage");
  for (const player of state.players) {
    if (!player.isHuman && player.team === "good") {
      player.alive = false;
    }
    if (player.alive && player.category === "minion") {
      applyRole(state, player, "evil-twin");
    }
  }
  writeState(state);

  const phaseAction = writeAction("phase", { stage: "day" });
  let processed = process({ scriptId: "snv", preferredHumanRoleId: "sage" });
  assert.equal(processed.result.ok, true, processed.result.reason);
  assert.equal(processed.result.stage, "ended", "terminal night wins should not be reported as a Storyteller pause");
  assert.equal(processed.viewModel.action.lastActionId, phaseAction.id);
  assert.equal(processed.viewModel.gameOver, true);
  assert.equal(processed.viewModel.winner, "evil");
  assert.equal(processed.viewModel.phaseObjectiveTitle.includes("复盘"), true);
  assert.equal(processed.viewModel.pendingStorytellerAction?.available, true, "terminal info can still be resolved from recap");
  assert.equal(processed.viewModel.pendingStorytellerAction?.type, "sage-info");

  const statusCli = spawnSync(
    globalThis.process.execPath,
    [
      path.resolve("scripts", "submit_unity_night_action.mjs"),
      `--streaming-assets=${root}`,
      "--status",
    ],
    { encoding: "utf8" }
  );
  assert.equal(statusCli.status, 0, `status should succeed with terminal Storyteller info: ${statusCli.stderr || statusCli.stdout}`);
  assert.match(statusCli.stdout, /PendingStorytellerType=sage-info/);
  assert.match(
    statusCli.stdout,
    /NextCommand1=npm run unity:submit-storyteller-action/,
    "terminal Storyteller info should be recommended before starting a new game"
  );

  const terminalState = readState();
  const firstStorytellerAction = terminalState.pendingStorytellerActions?.[0];
  assert.ok(firstStorytellerAction, "terminal fixture should have a Storyteller action to duplicate");
  terminalState.pendingStorytellerActions.push({
    ...firstStorytellerAction,
    id: "contract-second-terminal-sage-info",
    informationText: "Second terminal Sage info should also be claimable before recap is complete.",
  });
  writeState(terminalState);

  const storytellerAction = writeAction("storyteller-action");
  processed = process({ scriptId: "snv", preferredHumanRoleId: "sage" });
  assert.equal(processed.result.ok, true, processed.result.reason);
  assert.equal(processed.viewModel.action.lastActionId, storytellerAction.id);
  assert.equal(processed.result.stage, "storyteller", "a terminal game with more queued Storyteller actions should not report fully ended yet");
  assert.equal(processed.viewModel.gameOver, true);
  assert.equal(processed.viewModel.pendingStorytellerAction?.available, true);
  assert.equal(readState().pendingStorytellerActions?.length ?? 0, 1, "one terminal Storyteller action should remain after resolving the first");

  const autoAction = writeAction("auto-advance", { mode: "playable", resolveStoryteller: true });
  processed = process({ scriptId: "snv", preferredHumanRoleId: "sage" });
  assert.equal(processed.result.ok, true, processed.result.reason);
  assert.equal(processed.viewModel.action.lastActionId, autoAction.id);
  assert.equal(processed.viewModel.gameOver, true);
  assert.equal(processed.viewModel.pendingStorytellerAction?.available, false);
  assert.equal(readState().pendingStorytellerActions?.length ?? 0, 0, "auto-advance should drain terminal Storyteller info before stopping");
}

function testUnityDayExecutionStorytellerActionAutoResumesNight() {
  const action = writeAction("new-game", { scriptId: "bmr", playerCount: 9, preferredHumanRoleId: "moonchild", seed: 4513 });
  let processed = process({ scriptId: "bmr", preferredHumanRoleId: "moonchild" });
  assert.equal(processed.result.ok, true, action.id);

  writeAction("phase", { stage: "day" });
  processed = process({ scriptId: "bmr", preferredHumanRoleId: "moonchild" });
  assert.equal(processed.result.ok, true, processed.result.reason);

  const state = readState();
  const human = state.players.find((player) => player.isHuman);
  assert.ok(human, "fixture needs human Moonchild");
  assert.equal(human.roleId, "moonchild");
  state.bmr.devilsAdvocateProtectedId = null;
  state.bmr.sailorDrunkId = null;
  state.players
    .filter((player) => ["pacifist", "tea-lady", "fool", "devils-advocate"].includes(player.roleId))
    .forEach((player) => applyRole(state, player, "sailor"));

  assert.equal(advanceDayStage(state, "public").ok, true);
  markPublicDiscussionRound(state);
  assert.equal(advanceDayStage(state, "nomination").ok, true);

  const nominator = state.players.find((player) => !player.isHuman && player.alive);
  assert.ok(nominator, "fixture needs a living AI nominator");
  const vote = resolveNominationAndVote(
    state,
    {
      nominatorId: nominator.id,
      nomineeId: human.id,
      humanVoteYes: true,
      decideAIVote: () => true,
    }
  );
  assert.equal(vote.accepted, true, vote.reason);
  assert.equal(vote.passed, true);
  writeState(state);

  const nightAction = writeAction("phase", { stage: "night" });
  processed = process({ scriptId: "bmr", preferredHumanRoleId: "moonchild" });
  assert.equal(processed.result.ok, true, processed.result.reason);
  assert.equal(processed.result.stage, "storyteller");
  assert.equal(processed.viewModel.pendingStorytellerAction?.available, true);
  assert.equal(processed.viewModel.pendingStorytellerAction?.type, "moonchild-choice");
  assert.equal(processed.viewModel.action.lastActionId, nightAction.id);

  const targetId =
    processed.viewModel.pendingStorytellerAction.options.find((entry) => entry.team === "good")?.id ??
    processed.viewModel.pendingStorytellerAction.options[0]?.id;
  assert.ok(targetId, "moonchild Storyteller action should expose a target");

  const storytellerAction = writeAction("storyteller-action", { targetIds: [targetId] });
  processed = process({ scriptId: "bmr", preferredHumanRoleId: "moonchild" });
  assert.equal(processed.result.ok, true, processed.result.reason);
  assert.equal(processed.result.flowAdvance?.stage, "night");
  assert.equal(processed.result.stage, "night");
  assert.equal(processed.viewModel.phase, "night");
  assert.equal(processed.viewModel.night, 2);
  assert.equal(processed.viewModel.pendingStorytellerAction?.available, false);
  assert.equal(processed.viewModel.action.lastActionId, storytellerAction.id);

  const after = readState();
  assert.equal(after.phase, "night");
  assert.equal(after.pendingStorytellerActions?.length ?? 0, 0);
}

function testUnityStorytellerResumeExposesNextHumanNightAction() {
  const action = writeAction("new-game", { scriptId: "bmr", playerCount: 9, preferredHumanRoleId: "gambler", seed: 4514 });
  let processed = process({ scriptId: "bmr", preferredHumanRoleId: "gambler" });
  assert.equal(processed.result.ok, true, action.id);

  writeAction("phase", { stage: "day" });
  processed = process({ scriptId: "bmr", preferredHumanRoleId: "gambler" });
  assert.equal(processed.result.ok, true, processed.result.reason);

  const state = readState();
  assert.equal(advanceDayStage(state, "public").ok, true);
  markPublicDiscussionRound(state);
  assert.equal(advanceDayStage(state, "nomination").ok, true);

  const actor = state.players.find((player) => !player.isHuman && player.alive);
  const target = state.players.find((player) => player.id !== actor?.id && player.alive && player.team === "good") ??
    state.players.find((player) => player.id !== actor?.id && player.alive);
  assert.ok(actor, "fixture needs a Storyteller action actor");
  assert.ok(target, "fixture needs a Storyteller action target");
  state.pendingStorytellerActions = [
    {
      id: "contract-day-storyteller-resume",
      type: "moonchild-choice",
      roleId: "moonchild",
      roleName: "Moonchild",
      actorId: actor.id,
      inputType: "player-target",
      targetCount: 1,
      minTargetCount: 1,
      maxTargetCount: 1,
      options: state.players
        .filter((player) => player.id !== actor.id && player.alive)
        .map((player) => ({ id: player.id, label: player.name, alive: player.alive, team: player.team, category: player.category })),
      prompt: "Contract Storyteller gate before the next night.",
      createdPhase: "day",
      createdDay: state.day,
      createdNight: state.night,
    },
  ];
  writeState(state);

  const storytellerAction = writeAction("storyteller-action", { targetIds: [target.id] });
  processed = process({ scriptId: "bmr", preferredHumanRoleId: "gambler" });
  assert.equal(processed.result.ok, true, processed.result.reason);
  assert.equal(processed.result.stage, "night");
  assert.equal(processed.viewModel.phase, "night");
  assert.equal(processed.viewModel.night, 2);
  assert.equal(processed.viewModel.pendingStorytellerAction?.available, false);
  assert.equal(processed.viewModel.humanNightAction.available, true, "Storyteller resume should expose the next human night action");
  assert.equal(processed.viewModel.humanNightAction.roleId, "gambler");
  assert.equal(processed.viewModel.action.lastActionId, storytellerAction.id);
}

function testUnityNightStorytellerQueueStopsPhaseAdvance() {
  const rng = withSeededRandom(6617);
  const state = createNewGame({ scriptId: "snv", playerCount: 9, preferredHumanRoleId: "pit-hag" }, rng);
  runNight(state, rng);
  beginNightPhase(state);

  const demon = state.players.find((player) => player.alive && player.category === "demon");
  assert.ok(demon, "fixture needs a living demon");
  const planned = setHumanNightActionPlan(state, { targetIds: [demon.id], roleId: "artist" });
  assert.equal(planned.ok, true, planned.reason);
  writeState(state);

  const phaseAction = writeAction("phase", { stage: "day" });
  let processed = process({ scriptId: "snv", preferredHumanRoleId: "pit-hag", seed: 1 });
  assert.equal(processed.result.ok, true, processed.result.reason);
  assert.equal(processed.result.stage, "storyteller");
  assert.equal(processed.result.pendingStorytellerActions, 1);
  assert.equal(processed.viewModel.pendingStorytellerAction?.available, true);
  assert.equal(processed.viewModel.pendingStorytellerAction?.type, "pit-hag-demon-balance");
  assert.equal(processed.viewModel.action.lastActionId, phaseAction.id);

  const storytellerAction = writeAction("storyteller-action");
  processed = process({ scriptId: "snv", preferredHumanRoleId: "pit-hag", seed: 1 });
  assert.equal(processed.result.ok, true, processed.result.reason);
  assert.equal(processed.result.stage, "ended");
  assert.equal(processed.viewModel.gameOver, true);
  assert.equal(processed.viewModel.winner, "good");
  assert.equal(processed.viewModel.pendingStorytellerAction?.available, false);
  assert.equal(processed.viewModel.action.lastActionId, storytellerAction.id);
}

function testUnityPitHagAutoBalanceUsesDefaultSelectedTargets() {
  const rng = withSeededRandom(1);
  const state = createNewGame({ scriptId: "snv", playerCount: 9, preferredHumanRoleId: "pit-hag" }, rng);
  runNight(state, rng);
  const originalDemon = state.players.find((player) => player.alive && player.category === "demon");
  const extraDemon = state.players.find((player) => player.alive && !player.isHuman && player.category !== "demon" && player.id !== originalDemon?.id);
  assert.ok(originalDemon, "fixture needs an original demon");
  assert.ok(extraDemon, "fixture needs a second player to register as demon");
  applyRole(state, extraDemon, "vortox");
  state.snv.pitHagDemonBalancePending = true;
  state.pendingStorytellerActions = [
    {
      id: "contract-pit-hag-default-target",
      type: "pit-hag-demon-balance",
      roleId: "pit-hag",
      roleName: "Pit-Hag",
      inputType: "player-target",
      balanceMode: "extra-demons",
      targetCount: 1,
      minTargetCount: 1,
      maxTargetCount: 1,
      selectedTargetIds: [extraDemon.id],
      options: [
        { id: originalDemon.id, label: `seat-${originalDemon.seatIndex + 1}`, alive: true, team: originalDemon.team, category: originalDemon.category },
        { id: extraDemon.id, label: `seat-${extraDemon.seatIndex + 1}`, alive: true, team: extraDemon.team, category: extraDemon.category },
      ],
      prompt: "Pit-Hag demon balance.",
    },
      /*
      options: [
        { id: originalDemon.id, label: `${originalDemon.seatIndex + 1}号`, alive: true, team: originalDemon.team, category: originalDemon.category },
        { id: extraDemon.id, label: `${extraDemon.seatIndex + 1}号`, alive: true, team: extraDemon.team, category: extraDemon.category },
      ],
      prompt: "Pit-Hag 造成多恶魔。请选择要死亡的额外恶魔，留下 1 名恶魔存活。",
    },
      */
  ];

  const action = state.pendingStorytellerActions[0];
  const defaultTargets = action.selectedTargetIds;
  const firstOptionTargets = action.options.slice(0, action.maxTargetCount).map((entry) => entry.id);
  assert.notDeepEqual(
    defaultTargets,
    firstOptionTargets,
    "fixture should distinguish Pit-Hag default balance targets from option order"
  );
  writeState(state);

  const before = readState();
  const deathsBefore = before.events.nightDeaths.length;
  const storytellerAction = writeAction("storyteller-action");
  let processed = process({ scriptId: "snv", preferredHumanRoleId: "pit-hag", seed: 1 });
  assert.equal(processed.result.ok, true, processed.result.reason);
  assert.equal(processed.viewModel.pendingStorytellerAction?.available, false);
  assert.equal(processed.viewModel.action.lastActionId, storytellerAction.id);

  const after = readState();
  const newDeaths = after.events.nightDeaths.slice(deathsBefore).map((entry) => entry.playerId);
  assert.deepEqual(
    newDeaths,
    defaultTargets,
    "empty Unity storyteller-action payload should use Pit-Hag's selected default balance targets"
  );
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
  const renderedTimelineEntry = processed.state.aiDialogue.timeline.find((entry) => entry.mode === "public" && entry.llmRender?.source === "mock");
  assert.ok(renderedTimelineEntry.llmRender.deterministicDraft, "LLM metadata should record the deterministic draft");
  assert.ok(renderedTimelineEntry.llmRender.finalText, "LLM metadata should record the final rendered text");
  const vm = readViewModel();
  assert.equal(vm.llmRenderer.enabled, true, "Unity viewmodel should expose the active LLM renderer");
  assert.equal(vm.action.llmRenderer.provider, "mock", "Unity action status should mirror LLM provider status");
  assert.equal(vm.action.llmRenderer.model, "mock", "Unity action status should expose the resolved LLM model");
  assert.ok(
    vm.timeline.some((entry) => entry.mode === "public" && entry.llmRender?.source === "mock"),
    "Unity viewmodel timeline should preserve LLM render metadata for UI badges"
  );
  assert.ok(
    vm.timeline.some((entry) => entry.mode === "public" && entry.llmRender?.deterministicDraft && entry.llmRender?.finalText),
    "Unity viewmodel timeline should preserve LLM draft/final text for quality reports"
  );
}

async function testUnityBridgeLLMPostprocessProtectsPrivateNightFacts() {
  const state = createNewGame({ scriptId: "tb", playerCount: 9, preferredHumanRoleId: "washerwoman" }, withSeededRandom(909001));
  initializeAI(state);
  const human = state.players.find((player) => player.isHuman);
  const speaker = state.players.find((player) => !player.isHuman);
  assert.ok(human && speaker, "protected LLM bridge fixture needs human and AI speaker");
  const draft = "我是洗衣妇，昨晚拿到 2号 与 3号 中有一位是洗衣妇。";
  state.phase = "day";
  state.day = 1;
  state.dayStage = "private";
  state.aiDialogue = state.aiDialogue ?? {};
  state.aiDialogue.timeline = [
    {
      id: "protected-private-night-fact",
      timestamp: Date.now(),
      day: 1,
      night: 1,
      mode: "whisper-in",
      speakerId: speaker.id,
      targetId: human.id,
      text: draft,
    },
  ];
  state.events = state.events ?? {};
  state.events.speeches = [
    {
      day: 1,
      night: 1,
      playerId: speaker.id,
      line: draft,
      private: true,
      viewerId: human.id,
      targetId: human.id,
    },
  ];

  const result = await applyLLMDialoguePostprocess(
    state,
    { timelineCount: 0, speechCount: 0 },
    {
      llmRenderer: true,
      llmProvider: "openai-compatible",
      llmTimeoutMs: 1200,
      llmTransport: async () => JSON.stringify({ text: "我有信息，但先不说具体内容，等公聊反应出来再看。" }),
    }
  );

  assert.equal(result.enabled, true);
  assert.equal(result.touched, 1);
  assert.equal(result.fallback, 1, "protected private night fact should fall back on bad LLM text");
  const rendered = state.aiDialogue.timeline[0];
  assert.equal(rendered.text, draft, "Unity-visible private night info should remain the deterministic draft");
  assert.equal(rendered.llmRender.deterministicDraft, draft);
  assert.equal(rendered.llmRender.finalText, draft);
  assert.equal(rendered.llmRender.fallbackUsed, true);
  assert.match(rendered.llmRender.reason, /missing-protected-fact/);
}

async function testUnityBridgeLLMPostprocessCapsVisibleLines() {
  const action = writeAction("new-game", { scriptId: "tb", playerCount: 9, preferredHumanRoleId: "washerwoman", seed: 616161 });
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

  const publicAction = writeAction("public-discussion");
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
    llmMaxLines: 0,
  });
  assert.equal(processed.result.ok, true, publicAction.id);
  assert.equal(processed.result.llmRenderer.maxLines, 0);
  assert.equal(processed.result.llmRenderer.touched, 0, "bridge LLM postprocess should respect per-action line cap");
  assert.ok(processed.state.unityBridge.llmRenderer.skipped >= 1, "capped public discussion should skip visible lines instead of blocking bridge");
  assert.equal(
    processed.state.aiDialogue.timeline.filter((entry) => entry.mode === "public" && entry.llmRender?.source === "mock").length,
    0,
    "no player-visible timeline entries should be LLM-rendered when the cap is zero"
  );
}

testUnityActionLoopCreatesStateAndViewModel();
testUnityNewGameClearsTransientDialogueState();
testUnityBridgeCliAcceptsInlineQuotedPathsFromCSharp();
testUnitySubmitGuidedPitHagDefaultDoesNotRemoveOnlyDemon();
testUnitySubmitGuidedBarberDefaultUsesEvilAllyAndBestGoodRole();
testUnitySubmitGuidedKlutzDefaultChoosesGoodUnlessExplicit();
testUnitySubmitGuidedProfessorDefaultPrefersDeadTownsfolkUnlessExplicit();
testUnitySubmitGuidedDemonKillAvoidsEvilAllyUnlessExplicit();
testUnitySubmitGuidedDemonKillPivotsAfterFailedDefaultTarget();
testUnitySubmitGuidedFangGuDefaultJumpsToOutsiderBeforeInfoKill();
testUnitySubmitGuidedShabalothDefaultUsesTwoGoodTargets();
testUnitySubmitGuidedChargedPoDefaultUsesThreeGoodTargets();
testUnityNewGameRoleIdPayloadControlsHumanRole();
testUnitySelectTokenRoundTrip();
testUnityGrimoireRoleMarkRoundTrip();
testUnityPrivateChatMutatesTimeline();
testUnityPrivateFollowupIntentAliasesStayAligned();
testUnityActionTypeAliasesStayAligned();
testUnityAutoAdvanceStopsAtNominationDecision();
testUnityDefaultAutoAdvanceRemainsSafePublicStep();
testUnityFullAutoAdvanceCanReachEndgame();
testUnityFullAutoAdvanceConsumesHumanNightActions();
testUnityBridgeSeededAutoplayIgnoresWallClock();
testUnityPrivateDeceptionPayloadMutatesTimeline();
testUnityAIProactiveWhisperOfferAcceptDecline();
testUnityProactiveWhisperRequiresExplicitOfferIdAndConsumesSelectedOffer();
testUnityAIPrivateWhispersStayOutOfHumanLogs();
testUnityPublicDiscussionMutatesTimeline();
testUnityHumanPublicSpeechMutatesTimeline();
testUnitySubmitPublicSpeechDryRunBuildsHumanSpeechAction();
testUnityAutoPublicOpeningHonorsCerenovusMadness();
testUnityEnteringPublicClearsPendingProactiveWhispers();
testUnityConversationClockStep();
testUnityNominationWindowDebateAndVote();
testUnityHumanNominationReasonFeedsAIVotePressure();
testUnityVirginNominationResolvesBeforeDebate();
testUnityWitchCursedNominationKillsBeforeDebateVote();
testUnityAutoAdvanceVirginImmediateNominationKeepsExecutionStatus();
testUnityAutoAdvanceVirginImmediateNominationDoesNotFakeDebateStop();
testUnityInvalidHumanNominationKeepsWindowOpen();
testUnitySelfNominationIntentKeepsWindowOpen();
testUnityCannotPassNominationWindowWithActiveDebate();
testUnityLegacyNominationActionResolvesActiveDebate();
testUnityAINominationStepCanResolveVote();
testUnityLateGameAINominationCanBecomeExecutionBeforeFinalThree();
testUnityAliveHumanNomineeVotesNoByDefault();
testUnityEvilHumanProtectsEvilAllyByDefault();
testUnityDeadHumanDoesNotSpendGhostVoteByDefault();
testUnityDeadHumanCanExplicitlySpendGhostVote();
testUnityNominationDebateAcceptsHumanResponse();
testUnityNominationDefenseRefreshesImmediateResolveVote();
testUnityNominationWindowCanPassToNight();
testUnityExecutionDayCannotReopenNominationWindow();
testUnityExecutionStopsOnSecondNightForHumanAction();
testUnityPhaseGuardBlocksSkippingToNomination();
testUnityNominationExportsVoteCeremony();
testUnityPassedNominationCanBeOvertakenBeforeDayEnd();
testUnityNightActionResolvesNightToDay();
testUnityFortuneTellerRequiresAndSettlesTwoTargets();
testUnityNightActionDoesNotLeakIntoDayFlow();
testUnityPassNominationWindowExposesNextNightAction();
testUnityDayActionWritesPlan();
testUnityArtistUsesDayActionInsteadOfNightAction();
testUnityGossipPublicStatementWritesTimeline();
testUnityJugglerPublicGuessesWriteTimeline();
testUnityStorytellerActionClearsQueue();
testUnityTerminalNightWinTakesPriorityOverStorytellerQueue();
testUnityDayExecutionStorytellerActionAutoResumesNight();
testUnityStorytellerResumeExposesNextHumanNightAction();
testUnityNightStorytellerQueueStopsPhaseAdvance();
testUnityPitHagAutoBalanceUsesDefaultSelectedTargets();
testUnityReminderAndHandbookActions();
await testUnityBridgeExperimentalLLMPostprocess();
await testUnityBridgeLLMPostprocessProtectsPrivateNightFacts();
await testUnityBridgeLLMPostprocessCapsVisibleLines();
console.log("unity action bridge contracts ok");
