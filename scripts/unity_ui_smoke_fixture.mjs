import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { addAgentObservation } from "./ai_agents.js";
import { decideAIVoteWithRationale, initializeAI } from "./ai.js";
import { getRoleById } from "./data.js";
import {
  advanceDayStage,
  beginNightPhase,
  createNewGame,
  markPublicDiscussionRound,
  openNominationWindow,
  resolveNominationAndVote,
  runNight,
  setHumanNightActionPlan,
  skipDay,
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

function writeViewModel(vm) {
  fs.writeFileSync(viewModelPath, `${JSON.stringify(vm, null, 2)}\n`, "utf8");
  return vm;
}

function readPersistedState() {
  return JSON.parse(fs.readFileSync(statePath, "utf8")).state;
}

function freshViewModel(options = {}) {
  return processNoAction("fresh-state", { ...options, freshState: true });
}

function resolveFirstNight(vm) {
  if (vm?.phase !== "night") return vm;
  const resolved = writeAction("phase", { stage: "day" });
  assert.equal(resolved.phase, "day", "fixture should resolve first night into day one");
  return resolved;
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
  assert.equal(nominee.alive, true, "fixture nominee should stay on the block until day end");
  assert.equal(skipDay(state, withSeededRandom(seed + seedOffset + 1)), true, "fixture day end should resolve execution");
  assert.equal(nominee.alive, false, "fixture nominee should die");
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
  attachVoteRationaleSmokeLines(state, nominee);
  initializeAI(state);
  return state;
}

function attachVoteRationaleSmokeLines(state, nominee) {
  const vote = state.events?.votes?.at(-1);
  assert.ok(vote, "vote rationale smoke needs a persisted vote event");
  const reasonKeys = ["evidence-backed-yes", "pressure-threshold-yes", "execution-window-yes", "multi-evidence-yes"];
  const reasonLines = [
    "这条公开线索已经够进处决流程。",
    "票面接近门槛，先让压力落地。",
    "今天需要把这个处决窗口打开。",
    "多条证据合在一起，不能只停在讨论。",
  ];

  for (const [index, entry] of (vote.votes ?? []).entries()) {
    const voter = state.players.find((player) => player.id === entry.voterId);
    const voterName = voter?.name ?? entry.voterId ?? "未知玩家";
    const seat = (voter?.seatIndex ?? index) + 1;
    const reasonIndex = index % reasonKeys.length;
    entry.voteRationale = {
      kind: "vote-rationale",
      audience: "vote",
      publicOnly: true,
      voterId: entry.voterId ?? "",
      voterName,
      nomineeId: nominee.id,
      nomineeName: nominee.name,
      vote: !!entry.vote,
      canVote: true,
      suspicion: 0.68 + (index % 4) * 0.04,
      threshold: 0.56,
      margin: 0.12 + (index % 3) * 0.05,
      evidenceCount: 1 + (index % 3),
      memoryShift: 0,
      strategyShift: 0,
      reasonKey: reasonKeys[reasonIndex],
      confidenceBand: index % 3 === 0 ? "clear-yes" : "lean-yes",
      line: `${seat}号支持 ${nominee.name}：${reasonLines[reasonIndex]}`,
    };
  }
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
  keepStorytellerSmokeGameInProgress(state);
  appendStorytellerQueueSmokeItems(state);
  assert.ok((state.pendingStorytellerActions ?? []).length > 4, "Storyteller queue smoke should cover paging");
  return state;
}

function keepStorytellerSmokeGameInProgress(state) {
  state.gameOver = false;
  state.winner = "";
  state.winnerReason = "";
  if (state.phase === "ended") state.phase = "night";
  state.dayStage = "none";
  state.logs = Array.isArray(state.logs) ? state.logs.filter((entry) => entry?.type !== "game-end") : state.logs;

  const alivePlayers = state.players.filter((player) => player.alive);
  if (alivePlayers.length >= 5) return;
  for (const player of state.players) {
    if (!player.isHuman && player.team === "good") player.alive = true;
    if (state.players.filter((entry) => entry.alive).length >= 5) break;
  }
}

function appendStorytellerQueueSmokeItems(state) {
  const queue = state.pendingStorytellerActions ?? [];
  const current = queue[0];
  assert.ok(current, "Storyteller queue smoke needs a current action");
  const options = current.options?.length
    ? current.options
    : state.players.map((player) => ({
        id: player.id,
        label: `${player.seatIndex + 1}`,
        alive: player.alive,
        team: player.team,
        category: player.category,
      }));
  const prompts = [
    "后续身份确认：将守鸦人信息与魔典标记交叉核对。",
    "死亡触发排队：若第一条信息被污染，准备备用目标。",
    "被动信息暂存：确认结果后再允许阶段继续推进。",
    "延迟提醒：处理前先核对目标 token 与座位。",
    "最终队列检查：后续行动可见，但仍保持队首优先。",
  ];
  for (const [index, prompt] of prompts.entries()) {
    queue.push({
      ...current,
      id: `${current.id}-smoke-${index + 1}`,
      prompt,
      phaseLabel: `队列 ${index + 2}`,
      createdDay: state.day,
      createdNight: state.night,
      createdPhase: state.phase,
      options,
      selectedTargetIds: [],
    });
  }
  state.pendingStorytellerActions = queue;
}

function makeSageStorytellerQueueFixture() {
  const state = createNewGame(
    {
      scriptId: "snv",
      playerCount: 9,
      preferredHumanRoleId: "sage",
    },
    withSeededRandom(seed + 801)
  );
  initializeAI(state);
  runNight(state, withSeededRandom(seed + 802));

  const human = humanPlayer(state);
  assert.equal(human.roleId, "sage", "Sage fixture should place the human as Sage");

  for (const player of state.players) {
    if (!player.isHuman && player.team === "good") player.alive = false;
    if (player.alive && player.category === "minion") assignRole(state, player, "evil-twin");
  }

  beginNightPhase(state);
  runNight(state, withSeededRandom(seed + 803));
  initializeAI(state);

  assert.equal(human.alive, false, "Sage fixture should kill the human Sage");
  assert.ok(
    (state.pendingStorytellerActions ?? []).some((action) => action.type === "sage-info"),
    "Sage fixture should produce a real sage-info Storyteller action"
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
    withSeededRandom(seed + 901)
  );
  initializeAI(state);
  runNight(state, withSeededRandom(seed + 902));

  const human = humanPlayer(state);
  assert.equal(human.category, "demon", "Barber fixture should place the human as a demon");
  const barber = firstOtherPlayer(state, (entry) => entry.alive && entry.team === "good");
  assignRole(state, barber, "barber");

  moveToNomination(state);
  executePlayer(state, barber, 903);
  initializeAI(state);

  assert.equal(barber.alive, false, "Barber fixture should execute Barber");
  assert.ok(
    (state.pendingStorytellerActions ?? []).some((action) => action.type === "barber-swap"),
    "Barber fixture should produce a real barber-swap Storyteller action"
  );
  return state;
}

function makeMoonchildStorytellerQueueFixture() {
  const state = createNewGame(
    {
      scriptId: "bmr",
      playerCount: 9,
      preferredHumanRoleId: "moonchild",
    },
    withSeededRandom(seed + 1001)
  );
  initializeAI(state);
  runNight(state, withSeededRandom(seed + 1002));

  const human = humanPlayer(state);
  assert.equal(human.roleId, "moonchild", "Moonchild fixture should place the human as Moonchild");
  state.bmr.devilsAdvocateProtectedId = null;
  state.bmr.sailorDrunkId = null;
  state.bmr.sailorDrunkIds = [];
  state.players
    .filter((player) => ["pacifist", "tea-lady", "fool", "devils-advocate"].includes(player.roleId))
    .forEach((player) => assignRole(state, player, "sailor"));

  moveToNomination(state);
  executePlayer(state, human, 1003);
  initializeAI(state);

  assert.equal(human.alive, false, "Moonchild fixture should execute Moonchild");
  assert.ok(
    (state.pendingStorytellerActions ?? []).some((action) => action.type === "moonchild-choice"),
    "Moonchild fixture should produce a real moonchild-choice Storyteller action"
  );
  return state;
}

function makePitHagStorytellerQueueFixture() {
  const state = createNewGame(
    {
      scriptId: "snv",
      playerCount: 9,
      preferredHumanRoleId: "pit-hag",
    },
    withSeededRandom(seed + 1101)
  );
  initializeAI(state);
  runNight(state, withSeededRandom(seed + 1102));
  beginNightPhase(state);

  const target = firstOtherPlayer(state, (entry) => entry.alive && entry.team === "good" && entry.category !== "demon");
  const planned = setHumanNightActionPlan(state, { targetIds: [target.id], roleId: "vortox" });
  assert.equal(planned.ok, true, planned.reason);
  const nightResult = runNight(state, withSeededRandom(seed + 1103));
  initializeAI(state);

  assert.equal(nightResult.stage, "storyteller", "Pit-Hag fixture should pause night for Storyteller balance");
  assert.equal(state.snv.pitHagDemonBalancePending, true, "Pit-Hag fixture should keep balance pending");
  assert.ok(
    (state.pendingStorytellerActions ?? []).some((action) => action.type === "pit-hag-demon-balance"),
    "Pit-Hag fixture should produce a real pit-hag-demon-balance Storyteller action"
  );
  return state;
}

function makeKlutzStorytellerQueueFixture() {
  const state = createNewGame(
    {
      scriptId: "snv",
      playerCount: 9,
      preferredHumanRoleId: "klutz",
    },
    withSeededRandom(seed + 1201)
  );
  initializeAI(state);
  runNight(state, withSeededRandom(seed + 1202));

  const human = humanPlayer(state);
  assert.equal(human.roleId, "klutz", "Klutz fixture should place the human as Klutz");

  moveToNomination(state);
  executePlayer(state, human, 1203);
  initializeAI(state);

  assert.equal(human.alive, false, "Klutz fixture should execute Klutz");
  assert.ok(
    (state.pendingStorytellerActions ?? []).some((action) => action.type === "klutz-choice"),
    "Klutz fixture should produce a real klutz-choice Storyteller action"
  );
  return state;
}

function prepareMainBoard() {
  return freshViewModel();
}

function preparePhaseAssistPublic() {
  let vm = resolveFirstNight(freshViewModel());
  if (vm.dayStage !== "public") {
    vm = writeAction("phase", { stage: "public" });
  }
  assert.equal(vm.phase, "day", "phase-assist-public smoke should be in day phase");
  assert.equal(vm.dayStage, "public", "phase-assist-public smoke should enter public discussion");
  assert.equal(vm.publicConversation?.active, true, "phase-assist-public smoke should expose an active public conversation");
  assert.ok(vm.publicConversation?.speakerName || vm.publicConversation?.speakerId, "phase-assist-public smoke should name the active public speaker");
  assert.ok((vm.publicConversation?.suggestedActions ?? []).length > 0, "phase-assist-public smoke should expose suggested public actions");
  return vm;
}

function preparePrivateChat() {
  let vm = resolveFirstNight(freshViewModel());
  const state = readPersistedState();
  const target =
    state.players.find((player) => !player.isHuman && player.alive && player.category === "demon") ??
    state.players.find((player) => !player.isHuman && player.alive && player.team === "evil") ??
    state.players.find((player) => !player.isHuman && player.alive);
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

function prepareLongPrivateChat() {
  let vm = resolveFirstNight(freshViewModel());
  const state = readPersistedState();
  const target =
    state.players.find((player) => !player.isHuman && player.alive && player.category === "demon") ??
    state.players.find((player) => !player.isHuman && player.alive && player.team === "evil") ??
    state.players.find((player) => !player.isHuman && player.alive);
  assert.ok(target, "private-chat-long smoke needs a non-human target");
  vm = writeAction("select-token", { playerId: target.id });
  const prompts = [
    ["你是什么身份？", "claim"],
    ["你有什么别人能对得上的信息吗？", "reason"],
  ];
  for (const [text, intent] of prompts) {
    vm = writeAction("private-chat", { targetId: target.id, text, intent });
  }
  const updatedState = readPersistedState();
  const human = humanPlayer(updatedState);
  const persistedTarget = updatedState.players.find((player) => player.id === target.id);
  assert.ok(persistedTarget, "private-chat-long smoke needs persisted target");
  appendPrivateThreadSmokeLines(updatedState, human, persistedTarget);
  writePersistedState(updatedState);
  vm = processNoAction("private-chat-long");
  const privateLines = vm.timeline.filter(
    (entry) => (entry.mode === "whisper-in" && entry.speakerId === target.id) || (entry.mode === "whisper-out" && entry.targetId === target.id)
  );
  assert.ok(privateLines.length >= 10, "private-chat-long smoke should produce a scrollable thread");
  return vm;
}

function appendPrivateThreadSmokeLines(state, human, target) {
  state.aiDialogue = state.aiDialogue ?? {};
  state.aiDialogue.timeline = Array.isArray(state.aiDialogue.timeline) ? state.aiDialogue.timeline : [];
  state.events = state.events ?? {};
  state.events.speeches = Array.isArray(state.events.speeches) ? state.events.speeches : [];
  state.logs = Array.isArray(state.logs) ? state.logs : [];
  state.dayStageMeta = state.dayStageMeta ?? {};
  state.dayStageMeta.activePrivateTargetId = target.id;
  state.dayStageMeta.privateTargets = Array.from(new Set([...(state.dayStageMeta.privateTargets ?? []), target.id]));

  const existingTimestamps = state.aiDialogue.timeline.map((entry) => Number(entry?.timestamp) || 0);
  const baseTimestamp = Math.max(Date.now(), ...existingTimestamps) + 1;
  const lines = [
    ["whisper-out", "你昨晚得到了什么信息？", "night"],
    ["whisper-in", "我昨晚没有新的硬信息，但我的身份需要今天的处决结果来验证。现在更想看谁急着把票堆起来。", "night"],
    ["whisper-out", "如果今天提名你会怎么投？", "vote"],
    ["whisper-in", "我会先听被提名人的说法；如果有人完全不解释自己的身份和信息，我会倾向投赞成。", "vote"],
    ["whisper-out", "这条线索先不要公开，可以吗？", "trust"],
    ["whisper-in", "可以。你如果要公开，只说我愿意配合验证，不要直接把范围替我摊出去。", "trust"],
    ["whisper-out", "你现在最想听谁发言？", "focus"],
    ["whisper-in", "我想听 5号和 8号互相解释一下夜里信息位的边界，他们的压力点不太一样。", "focus"],
  ];

  for (const [index, [mode, text, intent]] of lines.entries()) {
    const outgoing = mode === "whisper-out";
    const speaker = outgoing ? human : target;
    const recipient = outgoing ? target : human;
    const timestamp = baseTimestamp + index;
    const context = privateThreadSmokeContext(state, human, target, outgoing, text, intent, index);
    const record = {
      id: `ui-smoke-private-long-${state.day ?? 0}-${index + 1}`,
      timestamp,
      day: state.day,
      night: state.night,
      mode,
      speakerId: speaker.id,
      targetId: recipient.id,
      text,
      intent,
      focusId: "",
      evidenceSummary: context.evidenceSummary,
      evidenceKind: "ui-smoke",
      questionToAsk: context.questionToAsk,
      followUpPrompts: context.followUpPrompts,
      claimDisclosureRationale: context.claimDisclosureRationale,
      rationaleSummary: context.rationaleSummary,
    };
    state.aiDialogue.timeline.push(record);
    state.logs.push({
      id: `ui-smoke-log-private-long-${index + 1}`,
      day: state.day,
      night: state.night,
      phase: state.phase,
      type: "whisper",
      message: `${speaker.name} -> ${recipient.name}：${text}`,
      payload: outgoing
        ? { private: true, playerId: human.id, targetId: target.id, direction: "out", intent, source: "ui-smoke-private-chat" }
        : { private: true, viewerId: human.id, sourceId: target.id, direction: "in", intent, source: "ui-smoke-private-chat" },
      timestamp,
    });
    if (!outgoing) {
      state.events.speeches.push({
        day: state.day,
        night: state.night,
        playerId: target.id,
        targetId: human.id,
        focusId: null,
        line: text,
        private: true,
        source: "ui-smoke-private-chat",
        intent,
      });
    }
    state.aiDialogue.activeSpeech = record;
  }

  if (state.aiDialogue.timeline.length > 80) {
    state.aiDialogue.timeline.splice(0, state.aiDialogue.timeline.length - 80);
  }
}

function privateThreadSmokeContext(state, human, target, outgoing, text, intent, index) {
  const base = {
    evidenceSummary: "",
    questionToAsk: "",
    followUpPrompts: [],
    claimDisclosureRationale: null,
    rationaleSummary: "",
  };
  if (outgoing) {
    if (intent === "vote") {
      return {
        ...base,
        questionToAsk: "问清楚：如果被提名者给出自洽身份，票意是否会变化。",
        followUpPrompts: ["什么情况会让你撤票？", "投票前还想先听谁发言？"],
        rationaleSummary: "玩家在打开公开提名线前，先确认对方的上票阈值。",
      };
    }
    if (intent === "trust") {
      return {
        ...base,
        questionToAsk: "确认这条私聊线暂时是否可以不放上公聊台面。",
        rationaleSummary: "这次私聊把信息控制在可信任的小范围内，没有过早公开。",
      };
    }
    return base;
  }

  if (intent === "night" || intent === "claim" || intent === "trust") {
    const continuity = intent === "trust" ? "hold" : "range";
    return {
      ...base,
      claimDisclosureRationale: {
        kind: "claim-disclosure-rationale",
        audience: "private",
        publicOnly: false,
        speakerId: target.id,
        speakerName: target.name ?? target.id,
        level: "range",
        previousLevel: intent === "trust" ? "range" : "vague",
        previousRangeLabel: intent === "trust" ? "information role" : "",
        roleId: "",
        roleName: "",
        rangeLabel: "information role",
        family: "townsfolk",
        exposure: "private",
        reasonKey: `ui-smoke-private-${intent}`,
        day: state.day ?? 0,
        trustScore: 0.62,
        selfHeat: 0.28,
        pressure: 0.48,
        alreadyClaimed: intent === "trust",
        canRevealRole: false,
        channel: `private:${human.id}`,
        continuity,
        continuityLine: "沿用前一条私聊的信息位口径，但不暴露硬身份。",
        continuitySummary: "延续私下的信息位口径。",
        line: "先别报死身份，只在私聊里给出大致范围。",
        spokenLine: text,
      },
      rationaleSummary: "延续私下的信息位口径，同时避免形成公开硬跳。",
    };
  }
  if (intent === "vote") {
    return {
      ...base,
      evidenceSummary: "票意取决于被提名者能否解释身份和夜间信息。",
      rationaleSummary: "投票阈值围绕解释质量展开，而不是只看裸怀疑。",
    };
  }
  if (intent === "focus") {
    return {
      ...base,
      evidenceSummary: "聚焦 5号和 8号，因为两人的夜间信息边界互相冲突。",
      questionToAsk: "让两边把硬信息和社交读法分开讲。",
      rationaleSummary: "这次回复为下一轮公聊指定了一条可比较的具体讨论线。",
    };
  }
  return base;
}

function prepareProactiveWhisper() {
  let vm = resolveFirstNight(freshViewModel());
  const state = readPersistedState();
  const ai = firstOtherPlayer(state, (entry) => entry.alive);
  ai.privateNotes = ai.privateNotes ?? [];
  ai.privateNotes.push("[第1夜] 你得知：UI smoke 主动私聊测试信息。");
  writePersistedState(state);
  vm = writeAction("ai-proactive-whispers");
  assert.ok(vm.pendingProactiveWhispers?.length > 0, "proactive-whisper smoke needs a queued invite");
  assert.equal(
    vm.timeline.some((entry) => entry.mode === "whisper-in" && entry.speakerId === vm.pendingProactiveWhispers[0].playerId),
    false,
    "proactive-whisper smoke must not leak full private content before acceptance"
  );
  return vm;
}

function seedTwoProactiveWhispers() {
  let vm = resolveFirstNight(freshViewModel());
  const state = readPersistedState();
  const human = humanPlayer(state);
  const ais = state.players.filter((entry) => !entry.isHuman && entry.alive).slice(0, 2);
  assert.equal(ais.length, 2, "proactive-whisper-queue smoke needs two living AI players");
  state.aiDialogue = state.aiDialogue ?? {};
  state.aiDialogue.pendingProactiveWhispers = ais.map((ai, index) => ({
    id: `ui-smoke-proactive-offer-${index + 1}`,
    day: state.day,
    night: state.night,
    playerId: ai.id,
    playerName: ai.name,
    playerSeat: ai.seatIndex + 1,
    reason: `内部理由 ${index + 1} 不应在 UI 队列展示`,
    prompt: `内部提示 ${index + 1} 不应展示`,
    response: `第${index + 1}个主动私聊的完整内容`,
    intent: index === 0 ? "reason" : "vote",
    focusId: human.id,
    createdAt: 2000 + index,
  }));
  writePersistedState(state);
  vm = processNoAction("proactive-whisper-queue");
  assert.deepEqual(
    vm.pendingProactiveWhispers.map((offer) => offer.id),
    ["ui-smoke-proactive-offer-1", "ui-smoke-proactive-offer-2"],
    "proactive-whisper-queue smoke should export two visible queue entries"
  );
  assert.equal(JSON.stringify(vm.pendingProactiveWhispers).includes("完整内容"), false);
  assert.equal(JSON.stringify(vm.pendingProactiveWhispers).includes("内部理由"), false);
  return vm;
}

function prepareProactiveWhisperQueue() {
  return seedTwoProactiveWhispers();
}

function prepareProactiveWhisperAfterAccept() {
  seedTwoProactiveWhispers();
  const vm = writeAction("accept-proactive-whisper", { offerId: "ui-smoke-proactive-offer-1" });
  assert.deepEqual(
    vm.pendingProactiveWhispers.map((offer) => offer.id),
    ["ui-smoke-proactive-offer-2"],
    "accepting the first proactive whisper should leave the second entry visible"
  );
  assert.ok(
    vm.timeline.some((entry) => entry.mode === "whisper-in" && entry.text.includes("第1个主动私聊")),
    "accepted proactive whisper should add only the accepted private content to the timeline"
  );
  assert.equal(
    vm.timeline.some((entry) => entry.mode === "whisper-in" && entry.text.includes("第2个主动私聊")),
    false,
    "unaccepted proactive whisper should remain hidden"
  );
  return vm;
}

function prepareNominationDebate() {
  let vm = resolveFirstNight(freshViewModel());
  vm = writeAction("ai-public-step");
  assert.equal(vm.publicConversation?.active, true, "nomination-debate smoke should enter public conversation");
  vm = writeAction("open-nomination-window", { ticks: 3 });
  assert.equal(vm.nominationClock?.active, true, "nomination-debate smoke should open the nomination window");
  const state = readPersistedState();
  const target =
    state.players.find((player) => !player.isHuman && player.alive && player.category === "demon") ??
    state.players.find((player) => !player.isHuman && player.alive && player.team === "evil") ??
    state.players.find((player) => !player.isHuman && player.alive);
  assert.ok(target, "nomination-debate smoke needs a nominee");
  vm = writeAction("human-nomination-intent", { nomineeId: target.id, reason: `我提 ${target.name}，先听双方说完。` });
  assert.equal(vm.nominationDebate?.active, true, "nomination-debate smoke should export an active debate");
  assert.equal(vm.voteCeremony, null, "nomination-debate smoke should wait before the vote ceremony");
  return vm;
}

function makeLateGamePassingNominationState() {
  const state = createNewGame(
    {
      scriptId: "tb",
      playerCount: 9,
      preferredHumanRoleId: "washerwoman",
    },
    withSeededRandom(seed + 701)
  );
  const human = humanPlayer(state);
  const demon = firstOtherPlayer(state, (entry) => entry.category === "demon");
  const goodVoter = firstOtherPlayer(state, (entry) => entry.team === "good" && entry.id !== demon.id);

  assignRole(state, demon, "imp");
  assignRole(state, goodVoter, "soldier");
  for (const player of state.players) {
    player.alive = [human.id, goodVoter.id, demon.id].includes(player.id);
    player.ghostVoteAvailable = false;
    player.nominatedToday = false;
    player.beenNominatedToday = false;
    player.deadVoteUsed = false;
    if (!player.alive) player.deathReason = "ui-smoke-final-three";
  }

  state.phase = "day";
  state.day = 5;
  state.night = Math.max(4, state.night ?? 1);
  state.dayStage = "nomination";
  state.gameOver = false;
  state.winner = "";
  state.winnerReason = "";
  state.dayStageMeta = {
    ...(state.dayStageMeta ?? {}),
    publicConversation: null,
    nominationDebate: null,
    executionCandidate: null,
    dayEndResolvedDay: null,
    dayEndTriggersResolvedDay: null,
  };
  state.events.executions = (state.events.executions ?? []).filter((entry) => entry.day !== state.day);
  initializeAI(state);
  goodVoter.aiPersona = "steady";
  goodVoter.suspicion = goodVoter.suspicion ?? {};
  goodVoter.suspicion[demon.id] = 0.45;
  return { state, human, goodVoter, demon };
}

function preparePassingNominationDebate() {
  const { state, human, goodVoter, demon } = makeLateGamePassingNominationState();
  writePersistedState(state);
  const vm = writeAction("human-nomination-intent", {
    nomineeId: demon.id,
    reason: `Final three: ${demon.name} must be tested now.`,
  });
  assert.equal(vm.nominationDebate?.active, true, "passing nomination smoke should export an active debate");
  assert.equal(vm.nominationDebate?.nominatorId, human.id, "passing nomination smoke should keep the human as nominator");
  assert.equal(vm.nominationDebate?.nomineeId, demon.id, "passing nomination smoke should nominate the demon");

  const trialState = structuredClone(readPersistedState());
  const debate = trialState.dayStageMeta?.nominationDebate;
  const trialNominator = trialState.players.find((player) => player.id === debate.nominatorId);
  const trialNominee = trialState.players.find((player) => player.id === debate.nomineeId);
  if (trialNominator) trialNominator.nominatedToday = false;
  if (trialNominee) trialNominee.beenNominatedToday = false;
  const trial = resolveNominationAndVote(
    trialState,
    {
      nominatorId: debate.nominatorId,
      nomineeId: debate.nomineeId,
      humanVoteYes: true,
      decideAIVote: decideAIVoteWithRationale,
    },
    withSeededRandom(seed + 702)
  );
  const aiVote = trial.votes?.find((entry) => entry.voterId === goodVoter.id);
  assert.equal(trial.accepted, true, trial.reason);
  assert.equal(trial.passed, true, "passing nomination smoke should be able to pass with real AI vote logic");
  assert.equal(aiVote?.vote, true, "passing nomination smoke should make the living good AI vote yes");
  assert.equal(trial.executionCandidate?.nomineeId, demon.id, "passing nomination smoke should put the nominee on the block after vote");
  return vm;
}

function preparePassingNominationWindow() {
  const { state, human, demon } = makeLateGamePassingNominationState();
  const opened = openNominationWindow(state, { ticks: 3, actorId: human.id, intent: "ui-smoke-human-nomination" });
  assert.equal(opened.ok, true, opened.reason);
  writePersistedState(state);

  const vm = processNoAction("nomination-window-pass");
  assert.equal(vm.phase, "day", "passing nomination window smoke should stay in day phase");
  assert.equal(vm.dayStage, "nomination", "passing nomination window smoke should stay in nomination stage");
  assert.equal(vm.nominationClock?.active, true, "passing nomination window smoke should expose an open nomination window");
  assert.equal(vm.nominationDebate, null, "passing nomination window smoke should start before a nomination debate");
  assert.ok(vm.players.find((player) => player.id === demon.id && !player.human && player.alive), "passing nomination window smoke should expose a living demon nominee");
  return vm;
}

function prepareActionForm() {
  let vm = resolveFirstNight(freshViewModel({
    scriptId: "bmr",
    playerCount: 9,
    preferredHumanRoleId: "gossip",
  }));
  vm = writeAction("public-discussion");
  assert.equal(vm.actionForms?.find((form) => form.id === "day-action")?.available, true);
  return vm;
}

function prepareFortuneTellerActionForm() {
  const vm = freshViewModel({
    scriptId: "tb",
    playerCount: 9,
    preferredHumanRoleId: "fortune-teller",
  });
  const form = vm.actionForms?.find((entry) => entry.id === "night-action");
  assert.equal(vm.phase, "night", "fortune-teller action smoke should stay in night phase");
  assert.equal(form?.available, true, "fortune-teller action smoke needs an available night action");
  assert.equal(form?.roleId, "fortune-teller", "fortune-teller action smoke should use the Fortune Teller");
  assert.equal(form?.minTargetCount, 2, "fortune-teller action smoke should require two targets");
  assert.equal(form?.maxTargetCount, 2, "fortune-teller action smoke should preserve both selected targets");
  assert.ok((form?.options ?? []).length >= 2, "fortune-teller action smoke needs two legal target options");
  return vm;
}

function prepareInformationDrawer() {
  let vm = resolveFirstNight(freshViewModel());
  const target = vm.players.find((player) => !player.human && player.alive);
  assert.ok(target, "information drawer smoke needs a non-human target");
  vm = writeAction("select-token", { playerId: target.id });
  vm = writeAction("private-chat", {
    targetId: target.id,
    text: "你愿意先给个身份和昨晚信息吗？",
    intent: "claim",
  });
  assert.ok(vm.timeline?.some((entry) => entry.speakerId === target.id), "information drawer smoke needs a recorded reply");
  return vm;
}

function prepareInformationDrawerPublic() {
  let vm = prepareInformationDrawer();
  if (vm.dayStage !== "public") {
    vm = writeAction("public-discussion");
  }
  const focus = vm.players.find((player) => !player.human && player.alive) ?? vm.players.find((player) => !player.human);
  assert.ok(focus, "information drawer public smoke needs a public focus");
  vm = writeAction("human-public-speech", {
    focusId: focus.id,
    text: "我先把公开信息放上桌，请这条线给出回应。",
    intent: "human-public",
  });
  assert.ok(
    vm.timeline?.some((entry) => entry.mode === "public" && entry.speakerId === vm.players.find((player) => player.human)?.id),
    "information drawer public smoke needs a recorded human public speech"
  );
  const state = readPersistedState();
  state.phase = "day";
  state.dayStage = "private";
  state.dayStageMeta = {
    ...(state.dayStageMeta ?? {}),
    publicConversation: null,
  };
  writePersistedState(state);
  vm = processNoAction("information-drawer-public");
  assert.equal(vm.phase, "day", "information drawer public smoke should stay in day phase");
  assert.equal(vm.dayStage, "private", "information drawer public smoke should expose the drawer entry point");
  assert.ok(
    vm.timeline?.some((entry) => entry.mode === "public" && entry.speakerId === vm.players.find((player) => player.human)?.id),
    "information drawer public smoke should preserve the public speech after returning to private stage"
  );
  return vm;
}

function prepareGuessActionForm() {
  let vm = resolveFirstNight(freshViewModel({
    scriptId: "snv",
    playerCount: 9,
    preferredHumanRoleId: "juggler",
  }));
  vm = writeAction("public-discussion");
  const form = vm.actionForms?.find((entry) => entry.id === "day-action");
  assert.equal(form?.available, true, "guess action smoke needs an available day action");
  assert.equal(form?.inputType, "guesses", "guess action smoke should expose guesses input");
  assert.ok(form?.maxGuessCount >= 5, "guess action smoke should export max guess count");
  return vm;
}

function prepareStorytellerQueue() {
  writePersistedState(makeRavenkeeperStorytellerQueueFixture());
  const vm = processNoAction("storyteller-queue");
  assert.equal(vm.pendingStorytellerAction?.available, true);
  return vm;
}

function prepareRealSageStorytellerQueue() {
  writePersistedState(makeSageStorytellerQueueFixture());
  const vm = processNoAction("real-sage-storyteller-queue");
  assert.equal(vm.pendingStorytellerAction?.available, true);
  assert.equal(vm.pendingStorytellerAction?.type, "sage-info");
  return vm;
}

function prepareRealBarberStorytellerQueue() {
  writePersistedState(makeBarberStorytellerQueueFixture());
  const vm = processNoAction("real-barber-storyteller-queue");
  assert.equal(vm.pendingStorytellerAction?.available, true);
  assert.equal(vm.pendingStorytellerAction?.type, "barber-swap");
  return vm;
}

function prepareRealMoonchildStorytellerQueue() {
  writePersistedState(makeMoonchildStorytellerQueueFixture());
  const vm = processNoAction("real-moonchild-storyteller-queue");
  assert.equal(vm.pendingStorytellerAction?.available, true);
  assert.equal(vm.pendingStorytellerAction?.type, "moonchild-choice");
  return vm;
}

function prepareRealPitHagStorytellerQueue() {
  writePersistedState(makePitHagStorytellerQueueFixture());
  const vm = processNoAction("real-pit-hag-storyteller-queue");
  assert.equal(vm.pendingStorytellerAction?.available, true);
  assert.equal(vm.pendingStorytellerAction?.type, "pit-hag-demon-balance");
  return vm;
}

function prepareRealKlutzStorytellerQueue() {
  writePersistedState(makeKlutzStorytellerQueueFixture());
  const vm = processNoAction("real-klutz-storyteller-queue");
  assert.equal(vm.pendingStorytellerAction?.available, true);
  assert.equal(vm.pendingStorytellerAction?.type, "klutz-choice");
  return vm;
}

function prepareScriptHandbook() {
  const vm = freshViewModel();
  assert.ok(vm.scriptHandbook?.roles?.length > 0);
  return vm;
}

function prepareScriptHelp() {
  freshViewModel();
  const vm = writeAction("script-handbook", { mode: "open", tab: "help" });
  assert.equal(vm.scriptHandbook?.open, true, "script-help smoke should open the handbook panel");
  assert.equal(vm.scriptHandbook?.activeTab, "help", "script-help smoke should request the tutorial/help tab");
  assert.ok(vm.scriptHandbook?.roles?.length > 0);
  return vm;
}

function prepareVoteCeremony() {
  writePersistedState(makeFifteenPlayerVoteFixture());
  const vm = processNoAction("vote-ceremony");
  assert.equal(vm.voteCeremony?.voters?.length, 15);
  return vm;
}

function prepareExecutionCandidate() {
  const state = makeFifteenPlayerVoteFixture();
  const candidate = state.dayStageMeta?.executionCandidate;
  assert.ok(candidate?.nomineeId, "execution-candidate smoke needs an on-block nominee");
  const nominee = state.players.find((player) => player.id === candidate.nomineeId);
  assert.ok(nominee, "execution-candidate smoke needs a persisted nominee");
  assignRole(state, nominee, "soldier");
  nominee.alive = true;
  nominee.deathReason = "";
  nominee.deadVoteUsed = false;

  let demon = state.players.find((player) => player.category === "demon" && player.id !== nominee.id);
  if (!demon) demon = state.players.find((player) => !player.isHuman && player.id !== nominee.id && player.alive);
  assert.ok(demon, "execution-candidate smoke needs a surviving demon");
  assignRole(state, demon, "imp");
  demon.alive = true;

  state.gameOver = false;
  state.winner = "";
  state.winnerReason = "";
  state.phase = "day";
  state.dayStage = "nomination";
  writePersistedState(state);

  const vm = processNoAction("execution-candidate");
  assert.equal(vm.executionCandidate?.nomineeId, nominee.id, "execution-candidate smoke should expose the on-block nominee");
  assert.equal(vm.players.find((player) => player.id === nominee.id)?.alive, true, "execution-candidate smoke should start before execution death");
  assert.ok(vm.voteCeremony?.passed, "execution-candidate smoke should keep the passed vote ceremony visible");
  return vm;
}

function prepareRolePicker() {
  const vm = freshViewModel();
  const target = vm.players.find((player) => !player.human && player.alive);
  assert.ok(target, "role-picker smoke needs a non-human target");
  return writeAction("select-token", { playerId: target.id });
}

function prepareGrimoireReminders() {
  let vm = resolveFirstNight(freshViewModel());
  const target = vm.players.find((player) => !player.human && player.alive);
  assert.ok(target, "grimoire-reminders smoke needs a non-human target");
  vm = writeAction("select-token", { playerId: target.id });
  vm = writeAction("grimoire-mark-role", { playerId: target.id, roleId: "undertaker" });
  for (const reminder of ["中毒", "醉酒", "重点怀疑", "可信", "死于今日"]) {
    vm = writeAction("grimoire-reminder", { playerId: target.id, reminder });
  }
  const updated = vm.players.find((player) => player.id === target.id);
  assert.equal(updated?.markedRoleId, "undertaker", "grimoire-reminders smoke should export a marked role");
  assert.ok((updated?.reminders?.length ?? 0) >= 5, "grimoire-reminders smoke should export reminder tokens");
  return vm;
}

function prepareTokenInspector() {
  let vm = prepareGrimoireReminders();
  const targetId = vm.action?.selectedPlayerId;
  assert.ok(targetId, "token-inspector smoke needs a selected target");
  const state = readPersistedState();
  initializeAI(state);
  const target = state.players.find((player) => player.id === targetId);
  const speaker = state.players.find((player) => player.isHuman) ?? state.players.find((player) => player.id !== targetId);
  assert.ok(target && speaker, "token-inspector smoke needs a target and public pressure source");
  for (const observer of state.players.filter((player) => !player.isHuman && player.id !== targetId)) {
    observer.dialogueBias = observer.dialogueBias ?? {};
    observer.dialogueBias[targetId] = 0.95;
    addAgentObservation(state, observer.id, {
      kind: "public-speech",
      source: "public-chat",
      private: false,
      day: state.day,
      phase: state.phase,
      actorId: speaker.id,
      text: `${speaker.name} accuses ${target.name} and asks the circle to keep pressure there.`,
      payload: {
        speakerId: speaker.id,
        focusId: target.id,
      },
    });
  }
  writePersistedState(state);
  vm = processNoAction("token-inspector");
  const updated = vm.players.find((player) => player.id === targetId);
  assert.equal(updated?.markedRoleId, "undertaker", "token-inspector smoke should expose a marked role");
  assert.ok((updated?.reminders?.length ?? 0) >= 5, "token-inspector smoke should expose dense reminder chips");
  assert.ok((updated?.suspicion ?? 0) >= 65, "token-inspector smoke should expose a high pressure card");
  return vm;
}

function extendRolePickerRoles(vm, targetCount = 44) {
  const roles = vm.scriptHandbook?.roles ?? [];
  assert.ok(roles.length > 0, "role-picker smoke needs handbook roles");
  const expanded = [...roles];
  for (let index = 0; expanded.length < targetCount; index++) {
    const source = roles[index % roles.length];
    expanded.push({
      ...source,
      name: `${source.name} ${Math.floor(index / roles.length) + 2}`,
      ability: `${source.ability ?? ""}（分页烟测副本）`.trim(),
    });
  }
  vm.scriptHandbook.roles = expanded;
  return vm;
}

function preparePagedRolePicker() {
  const vm = extendRolePickerRoles(prepareRolePicker());
  assert.ok(vm.scriptHandbook?.roles?.length > 29, "role-picker-paged smoke should force pager controls");
  return writeViewModel(vm);
}

function prepareEndgame() {
  resolveFirstNight(freshViewModel());
  const state = readPersistedState();
  const demon = state.players.find((player) => player.category === "demon");
  if (demon) demon.alive = false;
  state.phase = "ended";
  state.dayStage = "none";
  state.gameOver = true;
  state.winner = "good";
  state.winnerReason = "恶魔已死亡，善良阵营达成胜利条件。";
  state.day = Math.max(2, state.day ?? 0);
  state.night = Math.max(2, state.night ?? 0);
  state.logs = Array.isArray(state.logs) ? state.logs : [];
  const baseTimestamp = Date.now();
  [
    "第2天处决结算完成。",
    "恶魔玩家死亡，立即触发善良阵营胜利。",
    "最终魔典已锁定，可以进入复盘查看 AI 证据链。",
  ].forEach((message, index) => {
    state.logs.push({
      id: `ui-smoke-endgame-${index + 1}`,
      day: state.day,
      night: state.night,
      phase: state.phase,
      type: index === 1 ? "game-end" : "endgame",
      message,
      payload: { source: "ui-smoke-endgame" },
      timestamp: baseTimestamp + index,
    });
  });
  writePersistedState(state);
  const vm = processNoAction("endgame");
  assert.equal(vm.gameOver, true, "endgame smoke should produce a finished game");
  assert.equal(vm.winner, "good", "endgame smoke should expose a winner");
  assert.ok(vm.outcome?.finalEvents?.length > 0, "endgame smoke should expose final events");
  return vm;
}

function prepareRecap() {
  let vm = resolveFirstNight(freshViewModel());
  const state = readPersistedState();
  const observer = state.players.find((player) => !player.isHuman && player.team === "good");
  const speaker = state.players.find((player) => !player.isHuman && player.id !== observer?.id);
  const target = state.players.find((player) => player.alive && player.id !== observer?.id && player.id !== speaker?.id);
  const alternateTarget = state.players.find(
    (player) => player.alive && player.id !== observer?.id && player.id !== speaker?.id && player.id !== target?.id
  );
  assert.ok(observer && speaker && target && alternateTarget, "recap smoke needs observer, speaker, and two focus targets");
  addAgentObservation(state, observer.id, {
    kind: "public-speech",
    source: "public-chat",
    private: false,
    day: state.day,
    phase: state.phase,
    actorId: speaker.id,
    text: `${speaker.name} publicly pushes suspicion onto ${target.name}.`,
    payload: {
      speakerId: speaker.id,
      focusId: target.id,
    },
  });
  addAgentObservation(state, observer.id, {
    kind: "public-speech",
    source: "public-chat",
    private: false,
    day: state.day,
    phase: state.phase,
    actorId: target.id,
    text: `${target.name} redirects suspicion toward ${alternateTarget.name}.`,
    payload: {
      speakerId: target.id,
      focusId: alternateTarget.id,
    },
  });
  appendRecapReasoningSmokeLines(state, observer, speaker, target);
  appendRecapReasoningSmokeLines(state, observer, target, alternateTarget, "alt");
  writePersistedState(state);
  vm = processNoAction("recap");
  assert.ok(
    vm.aiRecapDetails?.some((entry) => entry.targets?.some((item) => (item.trail?.length ?? 0) > 0)),
    "recap smoke should include an evidence trail"
  );
  assert.ok(
    vm.aiReasoningRecap?.some((entry) => (entry.scoreTrail?.length ?? 0) > 3),
    "recap smoke should include a paged reasoning recap score trail"
  );
  assert.ok(
    (vm.aiReasoningRecap?.length ?? 0) > 1,
    "recap smoke should include multiple suspect reasoning tracks"
  );
  return vm;
}

function appendRecapReasoningSmokeLines(state, observer, speaker, target, suffix = "") {
  state.aiDialogue = state.aiDialogue ?? {};
  state.aiDialogue.timeline = Array.isArray(state.aiDialogue.timeline) ? state.aiDialogue.timeline : [];
  state.aiAgents = state.aiAgents ?? {};
  const agent = state.aiAgents[observer.id] = state.aiAgents[observer.id] ?? {};
  agent.evidenceBook = Array.isArray(agent.evidenceBook) ? agent.evidenceBook : [];
  agent.beliefTrailByPlayerId = agent.beliefTrailByPlayerId ?? {};
  const day = state.day ?? 1;
  const night = state.night ?? 1;
  const suffixPart = suffix ? `-${suffix}` : "";
  const baseTimestamp = Math.max(Date.now(), ...state.aiDialogue.timeline.map((entry) => Number(entry?.timestamp) || 0)) + 1;
  const evidenceRows = [
    {
      id: `ui-smoke-recap-evidence-${day}${suffixPart}-1`,
      kind: "public-speech",
      source: "public-chat",
      sourceId: speaker.id,
      targetIds: [target.id],
      visibility: "public",
      reliabilityScore: 0.84,
      contaminationRisk: 0.12,
      canBeFalse: false,
      text: `${speaker.name} pushes ${target.name} without separating claim from pressure.`,
      day,
      night,
      timestamp: baseTimestamp,
    },
    {
      id: `ui-smoke-recap-evidence-${day}${suffixPart}-2`,
      kind: "vote-swing",
      source: "public-procedure",
      sourceId: target.id,
      targetIds: [target.id],
      visibility: "public",
      reliabilityScore: 0.78,
      contaminationRisk: 0.18,
      canBeFalse: true,
      text: `${target.name} changes vote intent after the pressure line lands.`,
      day,
      night,
      timestamp: baseTimestamp + 1,
    },
  ];
  agent.evidenceBook.push(...evidenceRows);
  agent.beliefTrailByPlayerId[target.id] = [
    {
      id: `ui-smoke-recap-trail-${day}${suffixPart}-1`,
      evidenceId: evidenceRows[0].id,
      reasonKey: "public-pressure",
      evidenceKind: "public-speech",
      source: "public-chat",
      sourceId: speaker.id,
      visibility: "public",
      reliabilityScore: 0.84,
      contaminationRisk: 0.12,
      canBeFalse: false,
      before: 0.42,
      after: 0.58,
      appliedDelta: 0.16,
      text: evidenceRows[0].text,
      day,
      night,
      timestamp: baseTimestamp,
    },
    {
      id: `ui-smoke-recap-trail-${day}${suffixPart}-2`,
      evidenceId: evidenceRows[1].id,
      reasonKey: "vote-swing",
      evidenceKind: "vote-swing",
      source: "public-procedure",
      sourceId: target.id,
      visibility: "public",
      reliabilityScore: 0.78,
      contaminationRisk: 0.18,
      canBeFalse: true,
      before: 0.58,
      after: 0.66,
      appliedDelta: 0.08,
      text: evidenceRows[1].text,
      day,
      night,
      timestamp: baseTimestamp + 1,
    },
  ];

  const comparisonTrace = (focusScore, runnerUpScore, reasonKey) => ({
    kind: "decision-comparison",
    publicOnly: true,
    focusId: target.id,
    focusName: target.name,
    focusScore,
    focusEvidenceCount: 2,
    focusReason: "pressure plus vote movement",
    focusEvidenceSummary: "public pressure and vote movement align",
    runnerUpId: speaker.id,
    runnerUpName: speaker.name,
    runnerUpScore,
    runnerUpEvidenceCount: 1,
    runnerUpReason: "speaker created the pressure",
    runnerUpEvidenceSummary: "speaker is the pressure source",
    scoreGap: focusScore - runnerUpScore,
    reasonKey,
    confidenceBand: focusScore >= 0.65 ? "clear" : "lean",
    summary: `${target.name}: pressure and vote movement; ${speaker.name}: pressure source`,
  });
  const entries = [
    {
      id: `ui-smoke-recap-reasoning-${day}${suffixPart}-1`,
      timestamp: baseTimestamp,
      focusScore: 0.58,
      runnerUpScore: 0.44,
      reasonKey: "public-pressure",
      confidenceBand: "lean",
      text: `${observer.name} asks ${target.name} to explain the pressure line.`,
      spokenLine: `${target.name} should explain why the vote moved after that pressure.`,
      summary: "Pressure line and vote movement are now linked.",
    },
    {
      id: `ui-smoke-recap-reasoning-${day}${suffixPart}-2`,
      timestamp: baseTimestamp + 2,
      focusScore: 0.66,
      runnerUpScore: 0.46,
      reasonKey: "vote-swing",
      confidenceBand: "clear",
      text: `${observer.name} keeps ${target.name} as the top pressure target.`,
      spokenLine: `${target.name} stays top pressure because the vote movement followed the public push.`,
      summary: "Vote movement confirms the earlier pressure read.",
    },
    {
      id: `ui-smoke-recap-reasoning-${day}${suffixPart}-3`,
      timestamp: baseTimestamp + 3,
      focusScore: 0.61,
      runnerUpScore: 0.49,
      reasonKey: "counter-pressure",
      confidenceBand: "lean",
      text: `${observer.name} rechecks ${target.name} after a counter-pressure response.`,
      spokenLine: `${target.name} is still ahead, but the counter-pressure needs to be separated from the original push.`,
      summary: "Counter-pressure narrows the gap but does not erase the first read.",
    },
    {
      id: `ui-smoke-recap-reasoning-${day}${suffixPart}-4`,
      timestamp: baseTimestamp + 4,
      focusScore: 0.70,
      runnerUpScore: 0.45,
      reasonKey: "evidence-stack",
      confidenceBand: "clear",
      text: `${observer.name} stacks the public evidence back onto ${target.name}.`,
      spokenLine: `${target.name} returns to clear pressure once the public evidence is stacked together.`,
      summary: "The evidence stack widens the target-vs-runner-up gap.",
    },
    {
      id: `ui-smoke-recap-reasoning-${day}${suffixPart}-5`,
      timestamp: baseTimestamp + 5,
      focusScore: 0.64,
      runnerUpScore: 0.52,
      reasonKey: "late-table-reaction",
      confidenceBand: "lean",
      text: `${observer.name} keeps ${target.name} visible after the late table reaction.`,
      spokenLine: `${target.name} remains the visible pressure lane, even after the table reaction gets noisier.`,
      summary: "Late table noise lowers certainty but keeps the same focus target.",
    },
  ];
  for (const entry of entries) {
    state.aiDialogue.timeline.push({
      id: entry.id,
      timestamp: entry.timestamp,
      day,
      night,
      mode: "public",
      speakerId: observer.id,
      targetId: "",
      focusId: target.id,
      text: entry.text,
      decisionRationale: {
        kind: "decision-rationale",
        audience: "public",
        publicOnly: true,
        speakerId: observer.id,
        speakerName: observer.name,
        focusId: target.id,
        focusName: target.name,
        runnerUpId: speaker.id,
        runnerUpName: speaker.name,
        focusScore: entry.focusScore,
        runnerUpScore: entry.runnerUpScore,
        scoreGap: entry.focusScore - entry.runnerUpScore,
        focusEvidenceCount: 2,
        runnerUpEvidenceCount: 1,
        confidenceBand: entry.confidenceBand,
        reasonKey: entry.reasonKey,
        line: entry.spokenLine,
        spokenLine: entry.spokenLine,
        confidenceLine: `${target.name} is ${entry.confidenceBand === "clear" ? "clear" : "leaning"} pressure, but still needs a response.`,
        evidenceModeLine: entry.summary,
        comparisonTrace: comparisonTrace(entry.focusScore, entry.runnerUpScore, entry.reasonKey),
      },
    });
  }
}

const preparations = {
  "main-menu": prepareMainBoard,
  "settings": prepareMainBoard,
  "main-board": prepareMainBoard,
  "token-inspector": prepareTokenInspector,
  "more-actions": prepareTokenInspector,
  "endgame": prepareEndgame,
  "game-over": prepareEndgame,
  "recap": prepareRecap,
  "recap-trail-page2": prepareRecap,
  "recap-trail-jump": prepareRecap,
  "recap-suspect2": prepareRecap,
  "proactive-whisper": prepareProactiveWhisper,
  "proactive-whisper-queue": prepareProactiveWhisperQueue,
  "proactive-whisper-after-accept": prepareProactiveWhisperAfterAccept,
  "nomination-debate": prepareNominationDebate,
  "nomination-debate-pass": preparePassingNominationDebate,
  "nomination-window-pass": preparePassingNominationWindow,
  "info-drawer": prepareMainBoard,
  "information-drawer": prepareInformationDrawer,
  "information-drawer-public": prepareInformationDrawerPublic,
  "private-chat": preparePrivateChat,
  "private-chat-long": prepareLongPrivateChat,
  "action-form": prepareActionForm,
  "action-form-ready": prepareActionForm,
  "fortune-teller-action-form": prepareFortuneTellerActionForm,
  "fortune-teller-action-form-ready": prepareFortuneTellerActionForm,
  "action-form-guesses": prepareGuessActionForm,
  "storyteller-queue": prepareStorytellerQueue,
  "storyteller-queue-page2": prepareStorytellerQueue,
  "real-sage-storyteller-queue": prepareRealSageStorytellerQueue,
  "real-barber-storyteller-queue": prepareRealBarberStorytellerQueue,
  "real-moonchild-storyteller-queue": prepareRealMoonchildStorytellerQueue,
  "real-pit-hag-storyteller-queue": prepareRealPitHagStorytellerQueue,
  "real-klutz-storyteller-queue": prepareRealKlutzStorytellerQueue,
  "script-handbook": prepareScriptHandbook,
  "script-help": prepareScriptHelp,
  "vote-ceremony": prepareVoteCeremony,
  "execution-candidate": prepareExecutionCandidate,
  "role-picker": prepareRolePicker,
  "role-picker-paged": preparePagedRolePicker,
  "grimoire-reminders": prepareGrimoireReminders,
  "reminder-picker": prepareRolePicker,
  "stage-dialogue": prepareMainBoard,
  "stage-dialogue-queued": prepareMainBoard,
  "phase-assist-public": preparePhaseAssistPublic,
  "phase-transition": prepareMainBoard,
  "transition-day": prepareMainBoard,
  "transition-night": prepareMainBoard,
  "transition-nomination": prepareMainBoard,
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
