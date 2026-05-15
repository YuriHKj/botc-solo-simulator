import assert from "node:assert/strict";
import fs from "node:fs";

import { getAIInsightRows, initializeAI } from "../scripts/ai.js";
import { checkWin, createNewGame, runNight, withSeededRandom } from "../scripts/engine.js";
import { buildUnityViewModel } from "../scripts/unity_viewmodel.js";

function fixedRng() {
  return withSeededRandom(20260505);
}

function makeState() {
  const rng = fixedRng();
  const state = createNewGame({ scriptId: "tb", playerCount: 9, preferredHumanRoleId: "washerwoman" }, rng);
  initializeAI(state);
  state.phase = "night";
  runNight(state, rng);
  initializeAI(state);
  return state;
}

function testUnityViewModelShape() {
  const state = makeState();
  state.unityBridge = {
    revision: 7,
    lastActionId: "unity-test-action",
    lastActionType: "private-chat",
    status: "ok",
    message: "私聊已刷新。",
    updatedAt: "2026-05-08T00:00:00.000Z",
    llmRenderer: {
      enabled: true,
      provider: "mock",
      source: "mock",
      model: "mock",
      touched: 2,
      fallback: 1,
      reason: "",
      updatedAt: "2026-05-08T00:00:01.000Z",
    },
  };
  state.aiDialogue = state.aiDialogue ?? {};
  state.aiDialogue.timeline = [
    ...(Array.isArray(state.aiDialogue.timeline) ? state.aiDialogue.timeline : []),
    {
      id: "llm-viewmodel-test",
      mode: "public",
      speakerId: state.players.find((player) => !player.isHuman)?.id ?? "",
      text: "7号这里先听回应。",
      day: state.day ?? 1,
      night: state.night ?? 1,
      llmRender: { source: "mock", fallbackUsed: false, reason: "" },
    },
  ];
  const aiInsights = getAIInsightRows(state);
  const vm = buildUnityViewModel(state, { aiInsights, generatedAt: new Date("2026-05-05T00:00:00.000Z") });

  assert.equal(vm.version, 1);
  assert.equal(vm.scriptId, "tb");
  assert.equal(vm.scriptName, state.scriptName);
  assert.equal(vm.players.length, 9);
  assert.equal(vm.alive + vm.dead, 9);
  assert.ok(vm.setup.includes("民"));
  assert.ok(Array.isArray(vm.events));
  assert.ok(Array.isArray(vm.storytellerQueue));
  assert.ok(Array.isArray(vm.timeline));
  assert.ok(vm.action, "Unity viewmodel should include action bridge status");
  assert.equal(vm.action.updatedAt, "2026-05-08T00:00:00.000Z", "Unity viewmodel should include bridge updatedAt");
  assert.equal(vm.llmRenderer.provider, "mock", "Unity viewmodel should expose LLM renderer status");
  assert.equal(vm.llmRenderer.model, "mock", "Unity viewmodel should expose the resolved LLM model");
  assert.equal(vm.action.llmRenderer.touched, 2, "Unity action status should include LLM renderer status");
  assert.match(vm.actionSummary, /LLM润色/, "action summary should show active LLM polishing status");
  assert.equal(
    vm.timeline.find((entry) => entry.id === "llm-viewmodel-test")?.llmRender?.source,
    "mock",
    "timeline entries should preserve LLM render metadata for UI badges"
  );
  assert.ok(vm.phaseObjectiveTitle, "Unity viewmodel should include phase objective title");
  assert.ok(vm.phaseObjectiveHint, "Unity viewmodel should include phase objective hint");
  assert.ok(vm.phaseAdvance, "Unity viewmodel should include phase advance guard state");
  assert.equal(typeof vm.phaseAdvance.targetStage, "string", "phase advance guard should expose target stage");
  assert.equal(typeof vm.phaseAdvance.blocked, "boolean", "phase advance guard should expose blocked flag");
  assert.equal(typeof vm.actionSummary, "string", "Unity viewmodel should include action summary");
  assert.ok(Array.isArray(vm.privateInfo), "Unity viewmodel should include private info array");
  assert.ok(vm.humanNightAction, "Unity viewmodel should include human night action descriptor");
  assert.ok(vm.humanDayAction, "Unity viewmodel should include human day action descriptor");
  assert.ok(vm.pendingStorytellerAction, "Unity viewmodel should include pending storyteller action descriptor");
  assert.equal(typeof vm.nightActionText, "string", "Unity viewmodel should include night action display text");
  assert.equal(typeof vm.dayActionText, "string", "Unity viewmodel should include day action display text");
  assert.equal(typeof vm.storytellerActionText, "string", "Unity viewmodel should include storyteller action display text");
  assert.equal(typeof vm.nominationText, "string", "Unity viewmodel should include nomination display text");
  assert.equal(typeof vm.privateDeceptionText, "string", "Unity viewmodel should include private deception display text");
  assert.ok(Array.isArray(vm.aiRecap), "Unity viewmodel should include AI recap lines");
  assert.ok(Array.isArray(vm.aiRecapDetails), "Unity viewmodel should include AI recap detail objects");
  assert.ok(Array.isArray(vm.actionForms), "Unity viewmodel should include dynamic action form summaries");
  assert.equal(vm.actionForms.length, 3, "Unity viewmodel should export night/day/storyteller form slots");
  assert.ok(vm.scriptHandbook, "Unity viewmodel should include script handbook data");
  assert.ok(Array.isArray(vm.scriptHandbook.roles));
  assert.ok(Array.isArray(vm.scriptHandbook.firstNightOrder));
  const washerwoman = vm.scriptHandbook.roles.find((role) => role.id === "washerwoman");
  assert.ok(washerwoman?.ability?.includes("镇民角色"), "handbook roles should include official ability text");
  assert.ok(Array.isArray(washerwoman.reminders), "handbook roles should expose official reminder tokens");

  const human = vm.players.find((entry) => entry.human);
  assert.ok(human, "human player should be exported");
  assert.equal(human.seat >= 1, true);
  assert.equal(human.revealed, true, "human should see their own perceived role");
  assert.ok(human.roleId, "human role id should be visible to Unity");
}

function testUnityViewModelPhaseAdvanceGuardMatrix() {
  let state = makeState();
  let vm = buildUnityViewModel(state, { aiInsights: getAIInsightRows(state) });
  assert.equal(vm.phaseAdvance.targetStage, "public", "private stage should advance to public");
  assert.equal(vm.phaseAdvance.blocked, false, "private to public should be available");
  assert.ok(vm.phaseAdvance.warnings.some((entry) => entry.includes("私聊")), "unused private chat quota should be a visible warning");

  state = makeState();
  state.pendingStorytellerActions = [{ prompt: "等待守鸦人选择两名玩家。" }];
  vm = buildUnityViewModel(state, { aiInsights: getAIInsightRows(state) });
  assert.equal(vm.phaseAdvance.blocked, true, "storyteller queue should block phase advance");
  assert.ok(vm.phaseAdvance.reason.includes("Storyteller"), "storyteller blocker should be visible");

  state = makeState();
  state.phase = "day";
  state.dayStage = "public";
  state.dayStageMeta.publicRounds = 0;
  vm = buildUnityViewModel(state, { aiInsights: getAIInsightRows(state) });
  assert.equal(vm.phaseAdvance.blocked, true, "public to nomination should require one public round");
  assert.ok(vm.phaseAdvance.reason.includes("公聊"), "public-round blocker should explain the missing public discussion");

  const rng = fixedRng();
  state = createNewGame({ scriptId: "tb", playerCount: 9, preferredHumanRoleId: "fortune-teller" }, rng);
  initializeAI(state);
  state.phase = "night";
  runNight(state, rng);
  initializeAI(state);
  state.phase = "day";
  state.dayStage = "nomination";
  state.dayStageMeta.publicRounds = 1;
  vm = buildUnityViewModel(state, { aiInsights: getAIInsightRows(state) });
  assert.equal(vm.phaseAdvance.targetStage, "night", "nomination should advance toward night");
  assert.equal(vm.humanNightAction.available, false, "next-night human action should not be exported during the day");
  assert.equal(vm.phaseAdvance.blocked, false, "unplanned next-night human action should not block ending the current day");
  assert.equal(
    vm.phaseAdvance.blockers.some((entry) => /夜间|night/i.test(entry)),
    false,
    "day phase advance blockers should not mention next-night actions"
  );
}

function testUnityViewModelJsonRoundTrip() {
  const state = makeState();
  const vm = buildUnityViewModel(state, { aiInsights: getAIInsightRows(state) });
  const json = JSON.stringify(vm, null, 2);
  const parsed = JSON.parse(json);
  assert.equal(parsed.players.length, vm.players.length);
  assert.deepEqual(parsed.bluffs, vm.bluffs);
}

function testUnityViewModelHidesDemonBluffsFromNonDemonHuman() {
  const state = makeState();
  const human = state.players.find((player) => player.isHuman);
  assert.notEqual(human.category, "demon", "fixture should use a non-demon human");
  const vm = buildUnityViewModel(state, { aiInsights: getAIInsightRows(state) });
  assert.deepEqual(vm.bluffs, ["未知", "未知", "未知"], "non-demon human should not see demon bluffs");
}

function testUnityViewModelRevealsDemonBluffsInGrimoireView() {
  const state = makeState();
  state.grimoireView = true;
  const vm = buildUnityViewModel(state, { aiInsights: getAIInsightRows(state) });
  assert.deepEqual(
    vm.bluffs,
    state.demonBluffs.slice(0, 3).map((entry) => entry.name),
    "grimoire view should reveal demon bluffs"
  );
}

function testUnityViewModelRoleVisibilityMatrix() {
  const state = makeState();
  const hidden = state.players.find((player) => !player.isHuman);
  assert.ok(hidden, "fixture should include AI players");

  let vm = buildUnityViewModel(state, { aiInsights: getAIInsightRows(state) });
  let exportedHidden = vm.players.find((player) => player.id === hidden.id);
  assert.equal(exportedHidden.revealed, false, "non-grimoire view should not reveal other players");
  assert.equal(exportedHidden.actualRoleId, "", "non-grimoire view should not export hidden actual roles");

  state.grimoireNotes = {
    ...(state.grimoireNotes ?? {}),
    [hidden.id]: { ...(state.grimoireNotes?.[hidden.id] ?? {}), markedRoleId: "soldier", reminders: [] },
  };
  vm = buildUnityViewModel(state, { aiInsights: getAIInsightRows(state) });
  exportedHidden = vm.players.find((player) => player.id === hidden.id);
  assert.equal(exportedHidden.revealed, false, "manual role marks should not count as revealed identity");
  assert.equal(exportedHidden.roleId, "", "manual role marks should stay separate from visible roleId");
  assert.equal(exportedHidden.markedRoleId, "soldier", "manual role marks should be exported as mark metadata");
  assert.equal(exportedHidden.markedRoleName, "士兵", "manual role marks should include display names");

  state.grimoireView = true;
  vm = buildUnityViewModel(state, { aiInsights: getAIInsightRows(state) });
  exportedHidden = vm.players.find((player) => player.id === hidden.id);
  assert.equal(exportedHidden.revealed, true, "grimoire view should reveal other players");
  assert.equal(exportedHidden.actualRoleId, hidden.roleId, "grimoire view should export actual role ids");
}

function testUnityViewModelStageDisplayMatrix() {
  const cases = [
    {
      label: "storyteller queue",
      mutate: (state) => {
        state.pendingStorytellerActions = [{ prompt: "等待守鸦人选择。" }];
      },
      expected: "Storyteller",
    },
    {
      label: "game over recap",
      mutate: (state) => {
        state.pendingStorytellerActions = [];
        state.gameOver = true;
        state.winnerReason = "善良阵营获胜。";
      },
      expected: "复盘",
    },
    {
      label: "night",
      mutate: (state) => {
        state.pendingStorytellerActions = [];
        state.gameOver = false;
        state.phase = "night";
        state.dayStage = "none";
      },
      expected: "夜",
    },
    {
      label: "private",
      mutate: (state) => {
        state.pendingStorytellerActions = [];
        state.gameOver = false;
        state.phase = "day";
        state.dayStage = "private";
      },
      expected: "私聊",
    },
    {
      label: "public",
      mutate: (state) => {
        state.pendingStorytellerActions = [];
        state.gameOver = false;
        state.phase = "day";
        state.dayStage = "public";
      },
      expected: "公聊",
    },
    {
      label: "nomination",
      mutate: (state) => {
        state.pendingStorytellerActions = [];
        state.gameOver = false;
        state.phase = "day";
        state.dayStage = "nomination";
      },
      expected: "提名",
    },
  ];

  for (const entry of cases) {
    const state = makeState();
    entry.mutate(state);
    const vm = buildUnityViewModel(state, { aiInsights: getAIInsightRows(state) });
    assert.equal(
      vm.phaseObjectiveTitle.includes(entry.expected),
      true,
      `${entry.label} should include ${entry.expected} in phase objective title`
    );
  }
}

function testUnityViewModelExportsGameOutcome() {
  const state = makeState();
  state.pendingStorytellerActions = [];
  for (const player of state.players) {
    if (player.category === "demon") player.alive = false;
  }
  assert.equal(checkWin(state), "good", "fixture should reach a JS Core good win when all demons are dead");

  const vm = buildUnityViewModel(state, { aiInsights: getAIInsightRows(state) });
  assert.equal(vm.gameOver, true, "Unity viewmodel should expose top-level gameOver flag");
  assert.equal(vm.winner, "good", "Unity viewmodel should expose winning team");
  assert.ok(vm.winnerReason, "Unity viewmodel should expose JS Core winner reason");
  assert.ok(vm.outcome, "Unity viewmodel should include structured outcome data");
  assert.equal(vm.outcome.gameOver, true);
  assert.equal(vm.outcome.winner, "good");
  assert.equal(vm.outcome.winnerLabel, "善良阵营");
  assert.equal(vm.outcome.title.includes("胜利"), true);
  assert.equal(vm.outcome.summary.includes("存活"), true);
  assert.equal(Array.isArray(vm.outcome.finalEvents), true);
  assert.equal(vm.outcome.finalEvents.some((line) => line.includes("胜利")), true);
}

function testUnityViewModelConsumesInteractiveFields() {
  const state = makeState();
  const human = state.players.find((player) => player.isHuman);
  const other = state.players.find((player) => !player.isHuman);
  state.aiDialogue = {
    timeline: [
      {
        id: "test-public",
        mode: "public",
        speakerId: other.id,
        targetId: "",
        text: "我先给一个公共信息。",
        day: state.day,
        night: state.night,
      },
      {
        id: "test-private",
        mode: "whisper-in",
        speakerId: other.id,
        targetId: human.id,
        focusId: other.id,
        intent: "reason",
        evidenceSummary: "3号的说法和公开身份对不上。",
        evidenceKind: "claim-conflict",
        questionToAsk: "让 3号 解释昨晚信息。",
        followUpPrompts: ["你为什么这么判断？", "你愿意给身份范围吗？"],
        text: "这句私聊只给主视角看。",
        day: state.day,
        night: state.night,
      },
    ],
  };
  state.pendingStorytellerActions = [{
    id: "queue-washerwoman",
    type: "washerwoman-info",
    roleId: "washerwoman",
    roleName: "洗衣妇",
    inputType: "player-target",
    targetCount: 2,
    minTargetCount: 2,
    maxTargetCount: 2,
    prompt: "等待洗衣妇选择两名玩家。",
    options: [{ id: other.id, label: "2号", alive: true }],
  }];
  state.grimoireNotes = {
    ...(state.grimoireNotes ?? {}),
    [other.id]: { reminders: ["守护", "中毒"] },
  };

  const vm = buildUnityViewModel(state, { aiInsights: getAIInsightRows(state) });
  const exportedOther = vm.players.find((player) => player.id === other.id);
  assert.equal(vm.timeline.length, 2);
  assert.equal(vm.timeline[1].targetId, human.id);
  assert.equal(vm.timeline[1].intent, "reason");
  assert.equal(vm.timeline[1].evidenceKind, "claim-conflict");
  assert.equal(vm.timeline[1].evidenceSummary, "3号的说法和公开身份对不上。");
  assert.equal(vm.timeline[1].questionToAsk, "让 3号 解释昨晚信息。");
  assert.deepEqual(vm.timeline[1].followUpPrompts, ["你为什么这么判断？", "你愿意给身份范围吗？"]);
  assert.deepEqual(vm.storytellerQueue, ["等待洗衣妇选择两名玩家。"]);
  assert.equal(vm.storytellerQueueDetails.length, 1);
  assert.equal(vm.storytellerQueueDetails[0].current, true);
  assert.equal(vm.storytellerQueueDetails[0].type, "washerwoman-info");
  assert.equal(vm.storytellerQueueDetails[0].roleName, "洗衣妇");
  assert.equal(vm.storytellerQueueDetails[0].optionCount, 1);
  assert.ok(exportedOther.reminders.includes("守护"));
  assert.ok(exportedOther.reminders.includes("中毒"));
}

function testUnityViewModelExportsVoteCeremony() {
  const state = makeState();
  state.phase = "day";
  state.dayStage = "nomination";
  const [nominator, nominee, voter] = state.players;
  state.events.votes.push({
    day: state.day,
    nominatorId: nominator.id,
    nomineeId: nominee.id,
    yesVotes: 2,
    threshold: 5,
    passed: false,
    votes: [
      { voterId: nominator.id, vote: true, abstain: false },
      { voterId: nominee.id, vote: false, abstain: false },
      { voterId: voter.id, vote: true, abstain: false },
    ],
  });

  const vm = buildUnityViewModel(state, { aiInsights: getAIInsightRows(state) });
  assert.ok(vm.voteCeremony, "Unity viewmodel should export latest vote ceremony");
  assert.equal(vm.voteCeremony.nomineeId, nominee.id);
  assert.equal(vm.voteCeremony.yesVotes, 2);
  assert.equal(vm.voteCeremony.voters.length, 3);
  assert.equal(vm.voteCeremony.resultText.includes("未通过"), true);
}

function testUnityViewModelExportsAiRecapDetails() {
  const state = makeState();
  const aiInsights = getAIInsightRows(state);
  const vm = buildUnityViewModel(state, { aiInsights });
  assert.ok(vm.aiRecapDetails.length > 0, "AI recap detail list should not be empty");
  assert.ok(Array.isArray(vm.aiRecapDetails[0].targets), "AI recap detail should include ranked targets");
  assert.ok(
    vm.aiRecapDetails[0].targets.every((target) => Array.isArray(target.trail)),
    "AI recap targets should expose trail arrays for Unity detail UI"
  );
}

function testLiveExportFileIfPresent() {
  const path = "unity-prototype/Assets/StreamingAssets/unity_viewmodel.json";
  if (!fs.existsSync(path)) {
    return;
  }
  const parsed = JSON.parse(fs.readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
  assert.ok(Array.isArray(parsed.players), "live Unity viewmodel should contain players");
}

testUnityViewModelShape();
testUnityViewModelJsonRoundTrip();
testUnityViewModelHidesDemonBluffsFromNonDemonHuman();
testUnityViewModelRevealsDemonBluffsInGrimoireView();
testUnityViewModelRoleVisibilityMatrix();
testUnityViewModelStageDisplayMatrix();
testUnityViewModelPhaseAdvanceGuardMatrix();
testUnityViewModelExportsGameOutcome();
testUnityViewModelConsumesInteractiveFields();
testUnityViewModelExportsVoteCeremony();
testUnityViewModelExportsAiRecapDetails();
testLiveExportFileIfPresent();
console.log("unity viewmodel contracts ok");
