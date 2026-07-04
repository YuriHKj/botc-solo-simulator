import assert from "node:assert/strict";
import fs from "node:fs";

import { getAIInsightRows, initializeAI } from "../scripts/ai.js";
import { beginNightPhase, checkWin, createNewGame, processNightDeath, runNight, withSeededRandom } from "../scripts/engine.js";
import { buildUnityViewModel } from "../scripts/unity_viewmodel.js";

const unityViewModelSource = fs.readFileSync(new URL("../scripts/unity_viewmodel.js", import.meta.url), "utf8");

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
      llmRender: {
        source: "mock",
        fallbackUsed: false,
        reason: "",
        deterministicDraft: "7号这里先听回应。",
        finalText: "7号这里先把身份和信息讲清楚。",
      },
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
  assert.match(vm.actionSummary, /发言润色/, "action summary should show active speech polishing status");
  assert.equal(
    vm.timeline.find((entry) => entry.id === "llm-viewmodel-test")?.llmRender?.source,
    "mock",
    "timeline entries should preserve LLM render metadata for UI badges"
  );
  assert.equal(
    vm.timeline.find((entry) => entry.id === "llm-viewmodel-test")?.llmRender?.deterministicDraft,
    "7号这里先听回应。",
    "timeline entries should preserve deterministic LLM drafts for package dialogue audits"
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
  assert.ok(Array.isArray(vm.aiReasoningRecap), "Unity viewmodel should include AI reasoning recap groups");
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

function testUnityViewModelExportsAllPendingProactiveWhisperOffersSafely() {
  const state = makeState();
  const human = state.players.find((player) => player.isHuman);
  const ais = state.players.filter((player) => !player.isHuman).slice(0, 2);
  assert.equal(ais.length, 2, "fixture needs two AI players");
  state.phase = "day";
  state.dayStage = "private";
  state.aiDialogue = state.aiDialogue ?? {};
  state.aiDialogue.pendingProactiveWhispers = ais.map((ai, index) => ({
    id: `viewmodel-offer-${index + 1}`,
    day: state.day,
    night: state.night,
    playerId: ai.id,
    playerName: ai.name,
    playerSeat: ai.seatIndex + 1,
    reason: `内部理由 ${index + 1} 不应导出`,
    prompt: `内部提示 ${index + 1} 不应导出`,
    response: `第${index + 1}个邀请的真实私聊内容`,
    intent: index === 0 ? "reason" : "vote",
    focusId: human.id,
  }));

  const vm = buildUnityViewModel(state, { aiInsights: getAIInsightRows(state) });
  assert.deepEqual(
    vm.pendingProactiveWhispers.map((offer) => offer.id),
    ["viewmodel-offer-1", "viewmodel-offer-2"],
    "Unity viewmodel should export every pending proactive whisper as an independently visible queue item"
  );
  assert.equal(JSON.stringify(vm.pendingProactiveWhispers).includes("真实私聊内容"), false);
  assert.equal(JSON.stringify(vm.pendingProactiveWhispers).includes("内部理由"), false);
  assert.equal(JSON.stringify(vm.pendingProactiveWhispers).includes("内部提示"), false);
  assert.equal(JSON.stringify(vm.pendingProactiveWhispers).includes(human.id), false, "hidden focus targets should stay out of pending offers");
  assert.ok(vm.pendingProactiveWhispers.every((offer) => offer.publicReason.includes("接受后才会显示具体内容")));
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
      label: "game over recap with terminal storyteller queue",
      mutate: (state) => {
        state.pendingStorytellerActions = [{ prompt: "等待贤者信息。" }];
        state.gameOver = true;
        state.phase = "ended";
        state.winner = "evil";
        state.winnerReason = "邪恶阵营获胜。";
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
        text: "公开身份：圣徒。",
        claimDisclosureRationale: {
          kind: "claim-disclosure-rationale",
          audience: "public",
          publicOnly: true,
          speakerId: other.id,
          speakerName: other.name,
          level: "hard",
          previousLevel: "hard",
          previousRoleId: "ravenkeeper",
          previousRoleName: "守鸦人",
          previousRangeLabel: "",
          roleId: "saint",
          roleName: "圣徒",
          rangeLabel: "",
          family: "",
          exposure: "low",
          reasonKey: "self_on_block_or_high_pressure",
          day: state.day,
          trustScore: 0.5,
          selfHeat: 0.78,
          pressure: 0.82,
          alreadyClaimed: false,
          canRevealRole: true,
          channel: "public",
          continuity: "revise",
          continuityLine: "这次身份口径从守鸦人改到圣徒，需要把改口原因讲清楚。",
          continuitySummary: "改口：守鸦人 -> 圣徒",
          line: "我选择明跳圣徒，因为压力已经到自己身上。",
          spokenLine: "公开身份：圣徒。",
        },
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
        timestamp: 1000,
        claimDisclosureRationale: {
          kind: "claim-disclosure-rationale",
          audience: "private",
          publicOnly: false,
          speakerId: other.id,
          speakerName: other.name,
          level: "hard",
          previousLevel: "hard",
          previousRoleId: "ravenkeeper",
          previousRoleName: "守鸦人",
          previousRangeLabel: "",
          roleId: "saint",
          roleName: "圣徒",
          rangeLabel: "",
          family: "",
          exposure: "low",
          reasonKey: "self_on_block_or_high_pressure",
          day: state.day,
          trustScore: 0.5,
          selfHeat: 0.78,
          pressure: 0.82,
          alreadyClaimed: false,
          canRevealRole: true,
          channel: `private:${human.id}`,
          continuity: "revise",
          continuityLine: "这次身份口径从守鸦人改到圣徒，需要把改口原因讲清楚。",
          continuitySummary: "改口：守鸦人 -> 圣徒",
          line: "我选择明跳圣徒，因为压力已经到自己身上。",
          spokenLine: "私下改口为圣徒。",
        },
        decisionRationale: {
          kind: "decision-rationale",
          audience: "private",
          publicOnly: false,
          focusId: other.id,
          focusName: other.name,
          runnerUpId: human.id,
          runnerUpName: human.name,
          focusScore: 0.68,
          focusEvidenceCount: 2,
          runnerUpScore: 0.52,
          runnerUpEvidenceCount: 1,
          scoreGap: 0.16,
          confidenceBand: "lean",
          reasonKey: "more-visible-evidence",
          comparisonTrace: {
            kind: "target-comparison-trace",
            publicOnly: false,
            focusId: other.id,
            focusName: other.name,
            focusScore: 0.68,
            focusEvidenceCount: 2,
            focusReason: "身份对不上",
            focusEvidenceSummary: "3号公开身份和发言对不上。",
            runnerUpId: human.id,
            runnerUpName: human.name,
            runnerUpScore: 0.52,
            runnerUpEvidenceCount: 1,
            runnerUpReason: "证据待补",
            runnerUpEvidenceSummary: "",
            scoreGap: 0.16,
            reasonKey: "more-visible-evidence",
            confidenceBand: "lean",
            summary: `${other.name}：身份对不上；${human.name}：证据待补`,
          },
          spokenLine: "我先看 3号，因为公开身份和发言对不上。",
          line: "3号 比 1号 更需要先解释。",
        },
        text: "这句私聊只给主视角看。",
        day: state.day,
        night: state.night,
      },
      {
        id: "test-public-rationale",
        mode: "public",
        speakerId: other.id,
        focusId: other.id,
        evidenceSummary: "3号刚才投票态度摇摆。",
        evidenceKind: "vote-swing",
        timestamp: 2000,
        decisionRationale: {
          kind: "decision-rationale",
          audience: "public",
          publicOnly: true,
          focusId: other.id,
          focusName: other.name,
          runnerUpId: human.id,
          runnerUpName: human.name,
          focusScore: 0.74,
          focusEvidenceCount: 3,
          runnerUpScore: 0.52,
          runnerUpEvidenceCount: 1,
          scoreGap: 0.22,
          confidenceBand: "clear",
          reasonKey: "score-order",
          comparisonTrace: {
            kind: "target-comparison-trace",
            publicOnly: true,
            focusId: other.id,
            focusName: other.name,
            focusScore: 0.74,
            focusEvidenceCount: 3,
            focusReason: "票型摇摆",
            focusEvidenceSummary: "3号刚才投票态度摇摆。",
            runnerUpId: human.id,
            runnerUpName: human.name,
            runnerUpScore: 0.52,
            runnerUpEvidenceCount: 1,
            runnerUpReason: "证据待补",
            runnerUpEvidenceSummary: "",
            scoreGap: 0.22,
            reasonKey: "score-order",
            confidenceBand: "clear",
            summary: `${other.name}：票型摇摆；${human.name}：证据待补`,
          },
          spokenLine: "我继续看 3号，因为投票态度也摇摆。",
          line: "3号 今天需要继续解释。",
        },
        crossDayStance: {
          kind: "cross-day-stance",
          speakerId: other.id,
          targetId: other.id,
          previousDay: state.day - 1,
          currentDay: state.day,
          dayGap: 1,
          previousStance: "watch",
          currentStance: "press",
          continuity: "shift",
          previousScore: 0.5,
          currentScore: 0.74,
          previousReasonSummary: "昨天只有轻微观察",
          currentReasonSummary: "3号刚才投票态度摇摆",
          previousEvidenceCount: 0,
          currentEvidenceCount: 3,
          previousSources: ["quality-fixture"],
          currentSources: ["public"],
          previousEventAnchors: [
            {
              eventId: "prior-public-rationale",
              timelineEntryId: "prior-public-rationale",
              mode: "public",
              source: "quality-fixture",
              audience: "public",
              speakerId: other.id,
              targetId: other.id,
              focusId: other.id,
              visibility: "public",
              day: state.day - 1,
              night: 0,
              timestamp: 100,
              focusScore: 0.5,
              text: "昨天只有轻微观察",
            },
          ],
          currentEventAnchors: [
            {
              eventId: "test-public-rationale",
              timelineEntryId: "test-public-rationale",
              mode: "public",
              source: "test-public",
              audience: "public",
              speakerId: other.id,
              targetId: other.id,
              focusId: other.id,
              visibility: "public",
              day: state.day,
              night: state.night,
              timestamp: 2000,
              focusScore: 0.74,
              text: "3号刚才投票态度摇摆",
            },
          ],
          previousScoreTrailAnchors: [
            {
              trailId: "prior-bt-watch",
              evidenceId: "prior-ev-watch",
              observationId: "prior-ob-watch",
              reasonKey: "prior-watch",
              kind: "quality-prior-stance",
              source: "quality-fixture",
              sourceId: other.id,
              visibility: "public",
              day: state.day - 1,
              night: 0,
              timestamp: 100,
              before: 0.48,
              after: 0.5,
              appliedDelta: 0.02,
              text: "昨天只有轻微观察",
            },
          ],
          currentScoreTrailAnchors: [
            {
              trailId: "bt-vote-swing",
              evidenceId: "ev-vote-swing",
              observationId: "ob-vote-swing",
              reasonKey: "vote-swing",
              kind: "vote-swing",
              source: "public-procedure",
              sourceId: other.id,
              visibility: "public",
              day: state.day,
              night: state.night,
              timestamp: 1900,
              before: 0.68,
              after: 0.74,
              appliedDelta: 0.06,
              text: "3号刚才投票态度摇摆。",
            },
          ],
        },
        text: "我继续看 3号，因为投票态度也摇摆。",
        day: state.day,
        night: state.night,
      },
    ],
  };
  const otherAgent = state.aiAgents?.[other.id];
  assert.ok(otherAgent, "fixture should initialize an AI agent for reasoning drilldown");
  otherAgent.evidenceBook.push(
    {
      id: "ev-claim-conflict",
      day: state.day,
      night: state.night,
      timestamp: 900,
      kind: "claim-conflict",
      evidenceType: "claim-conflict",
      source: "public-procedure",
      sourceId: human.id,
      visibility: "public",
      targetIds: [other.id],
      reliabilityScore: 0.72,
      contaminationRisk: 0.18,
      canBeFalse: true,
      timelineEntryId: "test-private",
      timelineIndex: 1,
      timelineText: "这句私聊只给主视角看。",
      text: "3号公开身份和发言对不上。",
    },
    {
      id: "ev-vote-swing",
      day: state.day,
      night: state.night,
      timestamp: 2000,
      kind: "vote-swing",
      evidenceType: "vote",
      source: "public-procedure",
      sourceId: other.id,
      visibility: "public",
      targetIds: [other.id],
      reliabilityScore: 0.84,
      contaminationRisk: 0.12,
      canBeFalse: false,
      text: "3号刚才投票态度摇摆。",
    }
  );
  otherAgent.beliefTrailByPlayerId = {
    ...(otherAgent.beliefTrailByPlayerId ?? {}),
    [other.id]: [
      {
        id: "bt-claim-conflict",
        day: state.day,
        night: state.night,
        timestamp: 900,
        targetId: other.id,
        evidenceId: "ev-claim-conflict",
        reasonKey: "claim-conflict",
        before: 0.5,
        after: 0.68,
        appliedDelta: 0.18,
        evidenceKind: "claim-conflict",
        source: "public-procedure",
        sourceId: human.id,
        visibility: "public",
        reliabilityScore: 0.72,
        contaminationRisk: 0.18,
        canBeFalse: true,
        timelineEntryId: "test-private",
        timelineIndex: 1,
        timelineText: "这句私聊只给主视角看。",
        text: "3号公开身份和发言对不上。",
      },
      {
        id: "bt-vote-swing",
        day: state.day,
        night: state.night,
        timestamp: 2000,
        targetId: other.id,
        evidenceId: "ev-vote-swing",
        reasonKey: "vote-swing",
        before: 0.68,
        after: 0.74,
        appliedDelta: 0.06,
        evidenceKind: "vote-swing",
        source: "public-procedure",
        sourceId: other.id,
        visibility: "public",
        reliabilityScore: 0.84,
        contaminationRisk: 0.12,
        canBeFalse: false,
        text: "3号刚才投票态度摇摆。",
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
  assert.equal(vm.timeline.length, 3);
  assert.equal(vm.timeline[0].rationaleSummary, "改口：守鸦人 -> 圣徒 公开身份：圣徒。");
  assert.equal(vm.timeline[0].claimDisclosureRationale.kind, "claim-disclosure-rationale");
  assert.equal(vm.timeline[0].claimDisclosureRationale.roleId, "saint");
  assert.equal(vm.timeline[0].claimDisclosureRationale.previousRoleId, "ravenkeeper");
  assert.equal(vm.timeline[0].claimDisclosureRationale.previousRoleName, "守鸦人");
  assert.equal(vm.timeline[0].claimDisclosureRationale.previousRangeLabel, "");
  assert.equal(vm.timeline[0].claimDisclosureRationale.continuity, "revise");
  assert.equal(vm.timeline[0].claimDisclosureRationale.continuityLine, "这次身份口径从守鸦人改到圣徒，需要把改口原因讲清楚。");
  assert.equal(vm.timeline[0].claimDisclosureRationale.continuitySummary, "改口：守鸦人 -> 圣徒");
  assert.equal(vm.timeline[0].claimDisclosureRationale.spokenLine, "公开身份：圣徒。");
  assert.equal(vm.timeline[1].targetId, human.id);
  assert.equal(vm.timeline[1].intent, "reason");
  assert.equal(vm.timeline[1].evidenceKind, "claim-conflict");
  assert.equal(vm.timeline[1].evidenceSummary, "3号的说法和公开身份对不上。");
  const claimContinuitySummary = "改口：守鸦人 -> 圣徒";
  const privateReasonSummary = `${claimContinuitySummary} 我先看 3号，因为公开身份和发言对不上。`;
  assert.equal(vm.timeline[1].rationaleSummary, privateReasonSummary);
  assert.equal(vm.timeline[1].questionToAsk, "让 3号 解释昨晚信息。");
  assert.deepEqual(vm.timeline[1].followUpPrompts, ["你为什么这么判断？", "你愿意给身份范围吗？"]);
  const crossDaySummary = "昨天是“观察”，今天转“强压”，因为3号刚才投票态度摇摆。";
  const latestReasoningSummary = `${crossDaySummary} 我继续看 3号，因为投票态度也摇摆。`;
  assert.equal(vm.timeline[2].crossDayStance.kind, "cross-day-stance");
  assert.equal(vm.timeline[2].crossDayStance.continuity, "shift");
  assert.equal(vm.timeline[2].crossDayStance.currentReasonSummary, "3号刚才投票态度摇摆");
  assert.equal(vm.timeline[2].crossDayStance.summary, crossDaySummary);
  assert.equal(vm.timeline[2].crossDayStance.currentEventAnchors[0].timelineEntryId, "test-public-rationale");
  assert.equal(vm.timeline[2].crossDayStance.currentEventAnchors[0].source, "test-public");
  assert.equal(vm.timeline[2].crossDayStance.currentScoreTrailAnchors[0].trailId, "bt-vote-swing");
  assert.equal(vm.timeline[2].crossDayStance.currentScoreTrailAnchors[0].appliedDelta, 0.06);
  assert.equal(vm.timeline[2].rationaleSummary, latestReasoningSummary);
  const reasoning = vm.aiReasoningRecap.find((entry) => entry.speakerId === other.id && entry.targetId === other.id);
  assert.ok(reasoning, "Unity viewmodel should group rationale summaries by speaker and focus target");
  assert.ok(
    unityViewModelSource.includes("inferReasoningEvidenceTimelineAnchor") &&
      unityViewModelSource.includes("evidenceTimestamp !== Number(entry.timestamp)") &&
      unityViewModelSource.includes("kindMatches") &&
      unityViewModelSource.includes("textMatches"),
    "Unity viewmodel should infer per-evidence timeline anchors only from strict timestamp plus kind/text matches"
  );
  assert.equal(reasoning.count, 2);
  assert.equal(reasoning.latestSummary, latestReasoningSummary);
  assert.deepEqual(reasoning.summaries, [latestReasoningSummary, privateReasonSummary]);
  assert.equal(reasoning.latestScore, 0.74);
  assert.equal(reasoning.previousScore, 0.68);
  assert.equal(reasoning.scoreDelta, 0.06);
  assert.equal(reasoning.scoreTrend, "rising");
  assert.deepEqual(
    reasoning.scoreTrail.map((point) => point.focusScore),
    [0.74, 0.68]
  );
  assert.equal(reasoning.scoreTrail[0].timelineEntryId, "test-public-rationale");
  assert.equal(reasoning.scoreTrail[0].timelineIndex, 2);
  assert.equal(reasoning.scoreTrail[0].timelineText, "我继续看 3号，因为投票态度也摇摆。");
  assert.equal(reasoning.scoreTrail[0].timestamp, 2000);
  assert.equal(reasoning.scoreTrail[1].timelineEntryId, "test-private");
  assert.equal(reasoning.scoreTrail[1].timelineIndex, 1);
  assert.equal(reasoning.scoreTrail[1].timelineText, "这句私聊只给主视角看。");
  assert.equal(reasoning.scoreTrail[1].timestamp, 1000);
  assert.equal(reasoning.scoreTrail[0].focusEvidenceCount, 3);
  assert.equal(reasoning.scoreTrail[0].runnerUpEvidenceCount, 1);
  assert.equal(reasoning.scoreTrail[0].crossDayStance.kind, "cross-day-stance");
  assert.equal(reasoning.scoreTrail[0].crossDayStance.continuity, "shift");
  assert.equal(reasoning.scoreTrail[0].crossDayStance.summary, crossDaySummary);
  assert.equal(reasoning.scoreTrail[0].crossDayStance.currentEventAnchors[0].timelineEntryId, "test-public-rationale");
  assert.equal(reasoning.scoreTrail[0].crossDayStance.previousEventAnchors[0].timelineEntryId, "prior-public-rationale");
  assert.equal(reasoning.scoreTrail[0].crossDayStance.currentScoreTrailAnchors[0].evidenceId, "ev-vote-swing");
  assert.equal(reasoning.scoreTrail[0].crossDayStance.currentScoreTrailAnchors[0].after, 0.74);
  assert.equal(reasoning.scoreTrail[0].crossDayStance.previousScoreTrailAnchors[0].trailId, "prior-bt-watch");
  assert.equal(reasoning.scoreTrail[0].evidenceRows[0].evidenceId, "ev-vote-swing");
  assert.equal(reasoning.scoreTrail[0].evidenceRows[0].appliedDelta, 0.06);
  assert.equal(reasoning.scoreTrail[0].evidenceRows[0].sourceName, other.name);
  assert.equal(reasoning.scoreTrail[0].evidenceRows[0].timelineEntryId, "test-public-rationale");
  assert.equal(reasoning.scoreTrail[0].evidenceRows[0].timelineIndex, 2);
  assert.equal(reasoning.scoreTrail[0].evidenceRows[0].timelineText, "我继续看 3号，因为投票态度也摇摆。");
  assert.equal(reasoning.scoreTrail[0].evidenceRows[1].evidenceId, "ev-claim-conflict");
  assert.equal(reasoning.scoreTrail[0].evidenceRows[1].timelineEntryId, "test-private");
  assert.equal(reasoning.scoreTrail[1].evidenceRows.length, 1);
  assert.equal(reasoning.scoreTrail[1].evidenceRows[0].evidenceId, "ev-claim-conflict");
  assert.equal(reasoning.scoreTrail[1].evidenceRows[0].timelineEntryId, "test-private");
  assert.equal(reasoning.scoreTrail[1].claimDisclosureRationale.continuity, "revise");
  assert.equal(reasoning.scoreTrail[1].claimDisclosureRationale.continuitySummary, claimContinuitySummary);
  assert.equal(reasoning.scoreTrail[1].claimDisclosureRationale.previousRoleId, "ravenkeeper");
  assert.equal(reasoning.scoreTrail[1].claimDisclosureRationale.roleId, "saint");
  assert.equal(reasoning.scoreTrail[0].comparisonTrace.summary, `${other.name}：票型摇摆；${human.name}：证据待补`);
  assert.equal(reasoning.scoreTrail[0].comparisonTrace.runnerUpName, human.name);
  assert.ok(
    reasoning.evidenceSnippets.some((snippet) => snippet.kind === "vote-swing" && snippet.text.includes("投票态度")),
    "reasoning recap should carry timeline evidence snippets"
  );
  assert.ok(
    reasoning.evidenceSnippets.some((snippet) => snippet.source === "decision-rationale" && snippet.focusEvidenceCount === 3),
    "reasoning recap should carry decision-rationale evidence counts"
  );
  assert.ok(
    reasoning.evidenceSnippets.some((snippet) => snippet.source === "decision-comparison" && snippet.text.includes("对比：")),
    "reasoning recap should carry target-vs-runner-up comparison snippets"
  );
  assert.ok(
    reasoning.evidenceSnippets.some((snippet) => snippet.source === "cross-day-stance" && snippet.text === crossDaySummary),
    "reasoning recap should carry cross-day stance snippets"
  );
  assert.ok(
    reasoning.evidenceSnippets.some((snippet) => snippet.source === "claim-disclosure" && snippet.text === claimContinuitySummary),
    "reasoning recap should carry claim-disclosure continuity snippets"
  );
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
      {
        voterId: voter.id,
        vote: true,
        abstain: false,
        voteRationale: {
          kind: "vote-rationale",
          audience: "vote",
          publicOnly: true,
          voterId: voter.id,
          voterName: voter.name,
          nomineeId: nominee.id,
          nomineeName: nominee.name,
          vote: true,
          canVote: true,
          suspicion: 0.78,
          threshold: 0.56,
          margin: 0.22,
          evidenceCount: 2,
          memoryShift: -0.02,
          strategyShift: -0.04,
          reasonKey: "evidence-backed-yes",
          confidenceBand: "clear-yes",
          line: `${voter.name} formal vote rationale for ${nominee.name}.`,
        },
      },
    ],
  });

  const vm = buildUnityViewModel(state, { aiInsights: getAIInsightRows(state) });
  assert.ok(vm.voteCeremony, "Unity viewmodel should export latest vote ceremony");
  assert.equal(vm.voteCeremony.nomineeId, nominee.id);
  assert.equal(vm.voteCeremony.yesVotes, 2);
  assert.equal(vm.voteCeremony.voters.length, 3);
  assert.equal(vm.voteCeremony.voters[2].voteRationale.kind, "vote-rationale");
  assert.equal(vm.voteCeremony.voters[2].voteRationale.nomineeId, nominee.id);
  assert.equal(vm.voteCeremony.voters[2].voteRationale.reasonKey, "evidence-backed-yes");
  assert.ok(vm.voteCeremony.voters[2].voteRationale.line.includes(nominee.name));
  assert.equal(vm.voteCeremony.resultText.includes("未通过"), true);
}

function testUnityViewModelHidesStaleVoteCeremonyAfterDayEnds() {
  const state = makeState();
  state.phase = "night";
  state.dayStage = "private";
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
  assert.equal(vm.voteCeremony, null, "Unity should not keep old nomination/vote token markers after day ends");
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

function testUnityViewModelPreservesFullReasoningScoreTrail() {
  const state = makeState();
  const speaker = state.players.find((player) => !player.isHuman);
  const target = state.players.find((player) => !player.isHuman && player.id !== speaker.id);
  const runnerUp = state.players.find((player) => player.isHuman);
  assert.ok(speaker && target && runnerUp, "fixture should have speaker, focus, and runner-up players");

  state.aiDialogue = {
    timeline: Array.from({ length: 6 }, (_, index) => {
      const turn = index + 1;
      const focusScore = Math.round((0.5 + turn * 0.04) * 100) / 100;
      const runnerUpScore = 0.41;
      return {
        id: `long-score-trail-${turn}`,
        mode: "public",
        speakerId: speaker.id,
        focusId: target.id,
        targetId: target.id,
        text: `第 ${turn} 次继续复盘 ${target.name} 的公开压力。`,
        day: state.day,
        night: state.night,
        timestamp: 1000 + turn * 100,
        decisionRationale: {
          focusId: target.id,
          focusName: target.name,
          runnerUpId: runnerUp.id,
          runnerUpName: runnerUp.name,
          spokenLine: `第 ${turn} 次继续复盘 ${target.name}，因为公开压力还在累积。`,
          focusScore,
          runnerUpScore,
          scoreGap: focusScore - runnerUpScore,
          focusEvidenceCount: turn,
          runnerUpEvidenceCount: 1,
          confidenceBand: turn >= 5 ? "strong-pressure" : "watching",
          reasonKey: "long-arc-public-pressure",
          comparisonTrace: {
            summary: `${target.name}：第 ${turn} 条公开压力；${runnerUp.name}：保留观察`,
            focusReason: `第 ${turn} 条公开压力继续累积`,
            runnerUpReason: "暂时只有一条观察线",
            focusEvidenceCount: turn,
            runnerUpEvidenceCount: 1,
            focusScore,
            runnerUpScore,
            scoreGap: focusScore - runnerUpScore,
          },
        },
      };
    }),
  };

  const vm = buildUnityViewModel(state, { aiInsights: [] });
  const reasoning = vm.aiReasoningRecap.find((entry) => entry.speakerId === speaker.id && entry.targetId === target.id);
  assert.ok(reasoning, "Unity reasoning recap should include the long-running speaker/focus track");
  assert.equal(reasoning.count, 6);
  assert.equal(
    reasoning.scoreTrail.length,
    6,
    "Unity reasoning recap should preserve all visible scoreTrail points for paged drilldown"
  );
  assert.deepEqual(
    reasoning.scoreTrail.map((point) => point.timelineEntryId),
    [
      "long-score-trail-6",
      "long-score-trail-5",
      "long-score-trail-4",
      "long-score-trail-3",
      "long-score-trail-2",
      "long-score-trail-1",
    ]
  );
  assert.equal(reasoning.latestScore, 0.74);
  assert.equal(reasoning.previousScore, 0.7);
  assert.equal(reasoning.scoreDelta, 0.04);
  assert.equal(reasoning.scoreTrend, "rising");
  assert.equal(reasoning.scoreTrail[4].focusEvidenceCount, 2, "second Unity score-trail page should retain older evidence counts");
  assert.ok(
    reasoning.scoreTrail[5].comparisonTrace.summary.includes(runnerUp.name),
    "oldest scoreTrail point should still preserve target-vs-runner-up comparison"
  );
}

function testUnityViewModelPreservesRawRationaleSummaryFallback() {
  const state = makeState();
  const human = state.players.find((player) => player.isHuman);
  const other = state.players.find((player) => !player.isHuman);
  const summary = "Private context summary stays visible when no structured rationale exists.";
  state.aiDialogue = {
    timeline: [
      {
        id: "test-raw-rationale-summary",
        mode: "whisper-in",
        speakerId: other.id,
        targetId: human.id,
        text: "I will keep this as a private reasoning line.",
        rationaleSummary: summary,
        day: state.day,
        night: state.night,
      },
    ],
  };

  const vm = buildUnityViewModel(state, { aiInsights: [] });
  assert.equal(
    vm.timeline.find((entry) => entry.id === "test-raw-rationale-summary")?.rationaleSummary,
    summary,
    "Unity timeline should preserve raw rationaleSummary as a fallback for private chat context rails"
  );
}

function testUnityViewModelExportsNominationRationaleCards() {
  const state = makeState();
  state.phase = "day";
  state.dayStage = "nomination";
  const [nominator, nominee, runnerUp] = state.players;
  const spokenDecisionLine = `${nominee.name} 当前比 ${runnerUp.name} 更适合先上台回应。`;
  const verificationLine = `先问 ${nominee.name} 哪条证据能公开对上，再补身份和昨晚信息。`;
  const evidenceModeLine = `主依据偏身份口径链，先核 ${nominee.name} 前后身份说法能不能接上。`;
  const evidenceBoundaryLine = `边界是我只能用台面公开信息看 ${nominee.name}，不拿私下结论压人。`;
  const runnerUpWatchLine = `${runnerUp.name} 先排第二，等新票型或身份信息再回看。`;
  const confidenceLine = `${nominee.name} 现在是强压位，但仍按回应校准。`;
  const responsePlanLine = `如果 ${nominee.name} 回应能接上证据就降压，回应断开就继续压；${runnerUp.name} 有新线再重排。`;
  const sourceReliabilityLine = `来源可靠度：${nominee.name} 的身份口径要前后可复核；只重复身份名不算独立来源。`;
  const memoryContinuityLine = `记忆连续性：${nominee.name} 先按本轮 2 条可见证据建档，后续发言会和这条记录对照。`;
  const reconsiderationLine = `如果 ${nominee.name} 能把公开身份链和票型补上，我会降级这条。`;
  const strategyLine = "票面接近门槛，票面约 3/5，正好看谁愿意跟。";
  const longAuditLine = [
    sourceReliabilityLine,
    `时间线一致性：${nominee.name} 的身份、票型和回应顺序要能接住，临场补口径要继续复核。`,
    `动机归因：${nominee.name} 要说明这条行为是在解桌还是自保；只转移压力就继续追。`,
    `举证责任：先让 ${nominee.name} 把身份、票型和发言理由讲完整；谁护航谁也要补公开理由。`,
    `追问顺序：下一句我会这样追问 ${nominee.name}，先问身份口径前后，再核谁替他背书，最后看票型是否配合。`,
    memoryContinuityLine,
  ].join(" ");
  state.dayStageMeta = {
    ...(state.dayStageMeta ?? {}),
    nominationDebate: {
      active: true,
      nominationId: "nomination-rationale-card-test",
      day: state.day,
      nominatorId: nominator.id,
      nomineeId: nominee.id,
      source: "ai",
      reason: `我提 2号。${spokenDecisionLine} ${strategyLine}`,
      decisionRationale: {
        kind: "decision-rationale",
        audience: "nomination",
        publicOnly: true,
        focusId: nominee.id,
        focusName: nominee.name,
        focusScore: 0.82,
        focusEvidenceCount: 2,
        runnerUpId: runnerUp.id,
        runnerUpName: runnerUp.name,
        runnerUpScore: 0.61,
        runnerUpEvidenceCount: 1,
        scoreGap: 0.21,
        reasonKey: "score-order",
        confidenceBand: "clear",
        evidenceMode: "claim-chain",
        evidenceModeLine,
        verificationLine,
        evidenceBoundaryLine,
        runnerUpWatchLine,
        confidenceLine,
        responsePlanLine,
        voteCoalitionLine: `票面联盟：提 ${nominee.name} 前要看愿意跟票的人能否说清理由，票数不够就先当压力台。`,
        sourceReliabilityLine,
        timelineConsistencyLine: longAuditLine,
        incentiveAlignmentLine: longAuditLine,
        burdenOfProofLine: longAuditLine,
        questionPriorityLine: longAuditLine,
        actionThresholdLine: longAuditLine,
        memoryContinuityLine,
        expressionDisciplineLine: longAuditLine,
        uncertaintyResolutionLine: longAuditLine,
        evidenceFreshnessLine: longAuditLine,
        falsificationCheckLine: longAuditLine,
        causalChainLine: longAuditLine,
        assumptionAuditLine: longAuditLine,
        mechanicSensitivityLine: longAuditLine,
        roleHypothesisLine: longAuditLine,
        reconsiderationKey: "score-order",
        reconsiderationLine,
        line: `${nominee.name} 比 ${runnerUp.name} 更该先上台。`,
        spokenLine: spokenDecisionLine,
      },
      strategyRationale: {
        kind: "nomination-strategy-rationale",
        displayIntent: "coalition-check",
        line: strategyLine,
        expectedSupport: 3,
        threshold: 5,
        margin: -2,
        likelyPasses: false,
        voteText: "票面约 3/5",
      },
      lines: [
        {
          speakerId: nominator.id,
          role: "nominator",
          text: `我提 2号。${spokenDecisionLine} ${strategyLine} ${longAuditLine}`,
          pending: false,
        },
        {
          speakerId: nominee.id,
          role: "nominee",
          text: "等你回应。",
          pending: true,
        },
      ],
      nextAction: "vote",
    },
  };
  state.aiDialogue.timeline.push({
    id: "nomination-rationale-card-timeline",
    mode: "nomination-debate",
    speakerId: nominator.id,
    targetId: nominee.id,
    text: "AI 提名互辩。",
    decisionRationale: state.dayStageMeta.nominationDebate.decisionRationale,
    strategyRationale: state.dayStageMeta.nominationDebate.strategyRationale,
  });

  const vm = buildUnityViewModel(state, { aiInsights: [] });
  const decisionCard = vm.nominationDebate.rationaleCards.find((card) => card.kind === "decision" && card.targetId === nominee.id);
  const strategyCard = vm.nominationDebate.rationaleCards.find((card) => card.kind === "strategy" && card.displayIntent === "coalition-check");
  assert.ok(decisionCard);
  assert.equal(decisionCard.summary, spokenDecisionLine, "decision card should use the same spoken comparison line as the nomination reason");
  assert.equal(decisionCard.summary.includes("票面约"), false, "decision summary should not expose internal vote math");
  assert.ok(decisionCard.detail.length <= 86, "decision detail should stay player-sized");
  assert.ok(decisionCard.detail.includes(evidenceModeLine), "decision detail should keep one actionable evidence cue");
  assert.equal(decisionCard.evidenceMode, "claim-chain", "decision card should preserve the raw evidence mode");
  assert.equal(decisionCard.evidenceModeLine, evidenceModeLine, "decision card should preserve the raw evidence mode line");
  assert.equal(decisionCard.evidenceBoundaryLine, evidenceBoundaryLine, "decision card should preserve the raw evidence boundary line");
  assert.equal(decisionCard.sourceReliabilityLine, sourceReliabilityLine, "decision card should preserve the raw source reliability line");
  assert.equal(decisionCard.memoryContinuityLine, memoryContinuityLine, "decision card should preserve the raw memory continuity line");
  assert.equal(decisionCard.confidenceLine, confidenceLine, "decision card should preserve the raw confidence line");
  assert.ok(vm.nominationDebate.reason.includes(decisionCard.summary), "debate reason and decision card should stay aligned");
  assert.equal(vm.nominationDebate.reason.includes("票面约"), false, "debate reason should not expose internal vote math");
  assert.ok(vm.nominationDebate.reason.length <= 112, "debate reason should stay readable in the panel");
  const nominatorLine = vm.nominationDebate.lines.find((line) => line.role === "nominator");
  assert.equal(nominatorLine.text.includes("票面约"), false, "nominator line should not expose internal vote math");
  assert.ok(nominatorLine.text.length <= 112, "nominator line should be a table line, not an audit report");
  assert.ok(strategyCard);
  assert.equal(strategyCard.summary.includes("票面约"), false, "strategy card should hide internal vote math");
  assert.ok(strategyCard.summary.length <= 72, "strategy summary should stay player-sized");
  assert.equal(strategyCard.detail, "先看回应", "strategy detail should show player-facing intent instead of numeric margin");
  const verificationCard = vm.nominationDebate.rationaleCards.find((card) => card.kind === "verification" && card.summary.includes(nominee.name));
  assert.ok(verificationCard);
  assert.equal(verificationCard.summary, verificationLine, "verification card should summarize the concrete verification plan");
  assert.ok(verificationCard.detail.length <= 86, "verification detail should stay player-sized");
  assert.equal(verificationCard.verificationLine, verificationLine, "verification card should preserve the raw verification line");
  assert.equal(verificationCard.evidenceMode, "claim-chain", "verification card should preserve the raw evidence mode");
  assert.equal(verificationCard.evidenceModeLine, evidenceModeLine, "verification card should preserve the raw evidence mode line");
  assert.ok(verificationCard.detail.includes(responsePlanLine), "verification card should show the response classification plan");
  assert.equal(verificationCard.responsePlanLine, responsePlanLine, "verification card should preserve the raw response plan line");
  assert.equal(verificationCard.evidenceBoundaryLine, evidenceBoundaryLine, "verification card should preserve the raw evidence boundary line");
  assert.equal(verificationCard.sourceReliabilityLine, sourceReliabilityLine, "verification card should preserve the raw source reliability line");
  assert.equal(verificationCard.memoryContinuityLine, memoryContinuityLine, "verification card should preserve the raw memory continuity line");
  assert.equal(verificationCard.confidenceLine, confidenceLine, "verification card should preserve the raw confidence line");
  assert.equal(verificationCard.reconsiderationLine, reconsiderationLine, "verification card should preserve the raw reconsideration line");
  assert.equal(
    vm.nominationDebate.decisionRationale.memoryContinuityLine,
    memoryContinuityLine,
    "full decision rationale should remain available separately from player-facing card detail"
  );
  const timelineDebate = vm.timeline.find((entry) => entry.id === "nomination-rationale-card-timeline");
  assert.equal(
    timelineDebate?.rationaleCards.find((card) => card.kind === "decision")?.summary,
    decisionCard.summary,
    "timeline recap should use the same decision card summary as the active debate"
  );
  assert.equal(
    timelineDebate?.rationaleCards.find((card) => card.kind === "strategy")?.summary,
    strategyCard.summary,
    "timeline recap should use the same strategy card summary as the active debate"
  );
}

function testUnityViewModelShowsHiddenDeadZombuulAsDead() {
  const rng = fixedRng();
  const state = createNewGame({ scriptId: "bmr", playerCount: 9, preferredHumanRoleId: "zombuul" }, rng);
  beginNightPhase(state);
  const zombuul = state.players.find((player) => player.isHuman);
  processNightDeath(state, zombuul, "contract-zombuul-first-death", {}, rng);

  const vm = buildUnityViewModel(state, { aiInsights: [] });
  const token = vm.players.find((player) => player.id === zombuul.id);

  assert.equal(zombuul.alive, true, "fixture Zombuul should remain actually alive");
  assert.equal(token.alive, false, "Unity should render hidden-dead Zombuul as publicly dead");
  assert.equal(token.actualAlive, true, "Unity should preserve actual-alive state for grimoire/debug consumers");
  assert.equal(token.registersAsDead, true);
  assert.ok(token.reminders.includes("登记死亡"));
  assert.equal(vm.alive, state.players.length - 1);
  assert.equal(vm.dead, 1);
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
testUnityViewModelExportsAllPendingProactiveWhisperOffersSafely();
testUnityViewModelExportsGameOutcome();
testUnityViewModelConsumesInteractiveFields();
testUnityViewModelPreservesRawRationaleSummaryFallback();
testUnityViewModelExportsVoteCeremony();
testUnityViewModelHidesStaleVoteCeremonyAfterDayEnds();
testUnityViewModelExportsAiRecapDetails();
testUnityViewModelExportsNominationRationaleCards();
testUnityViewModelShowsHiddenDeadZombuulAsDead();
testLiveExportFileIfPresent();
console.log("unity viewmodel contracts ok");
