import assert from "node:assert/strict";

import {
  buildEvaluationPayloadsFromReplay,
  buildSampleEvaluationPayloads,
  buildSampleEvaluationPayloadBatch,
  evaluateDialoguePayloads,
  inspectDialogueText,
  summarizeEvaluation,
} from "../scripts/ai_llm_dialogue_eval.mjs";

const replay = {
  players: [
    {
      id: "human",
      seat: 3,
      name: "你",
      human: true,
    },
  ],
  dialogue: {
    speeches: [
      {
        index: 0,
        day: 1,
        mode: "public",
        playerId: "p2",
        playerName: "2号",
        focusId: "p7",
        focusName: "7号",
        debateBeat: "opening",
        line: "接前面一句：7号这里先听回应。",
      },
      {
        index: 1,
        day: 1,
        private: true,
        mode: "private",
        playerId: "p3",
        speakerName: "3号",
        targetId: "human",
        targetName: "你",
        focusId: "p5",
        focusName: "5号",
        line: "5号这边我先放不下，先听回应。",
      },
    ],
    timeline: [
      {
        index: 0,
        mode: "whisper-out",
        speakerId: "human",
        speakerName: "你",
        targetId: "p3",
        targetName: "3号",
        text: "你怎么看 5 号？",
      },
      {
        index: 2,
        mode: "public",
        speakerId: "human",
        speakerName: "你",
        text: "公开身份：洗衣妇。我先把自己的口径放上桌。",
      },
      {
        index: 1,
        mode: "whisper-in",
        speakerId: "p3",
        speakerName: "3号",
        targetId: "human",
        targetName: "你",
        text: "5号这边我先放不下，先听回应。",
      },
      {
        index: 3,
        mode: "whisper-in",
        speakerId: "p4",
        speakerName: "4号",
        targetId: "human",
        targetName: "你",
        text: "我先给范围，身份暂时不说死。",
      },
      {
        index: 5,
        mode: "whisper-in",
        speakerId: "p5",
        speakerName: "5号",
        targetId: "human",
        targetName: "3号（你）",
        text: "我是洗衣妇，昨晚拿到 2号 与 3号 中有一位是洗衣妇。",
      },
      {
        index: 4,
        mode: "public",
        speakerId: "p4",
        speakerName: "4号",
        targetId: "human",
        targetName: "你",
        text: "我会先问3号：身份和昨晚信息。",
      },
    ],
  },
};

function testBuildPayloadsFromReplay() {
  const payloads = buildEvaluationPayloadsFromReplay(replay, { limit: 10 });
  assert.equal(payloads.length, 5, "should skip human outgoing whispers and dedupe duplicate AI replies");
  assert.equal(payloads[0].speakerName, "2号");
  assert.equal(payloads[0].targetName, "7号");
  assert.equal(payloads[0].audience, "public");
  assert.deepEqual(payloads[0].requiredTerms, ["7号"]);
  assert.equal(payloads[1].audience, "private");
  assert.deepEqual(payloads[1].requiredTerms, ["5号"]);
  assert.deepEqual(payloads[2].requiredTerms, [], "private replies to the human should not require literal 你");
  assert.equal(payloads[3].targetName, "3号（你）");
  assert.deepEqual(payloads[3].requiredTerms, [], "private replies to a seat-you UI label should not require the label");
  assert.equal(payloads[4].audience, "public");
  assert.equal(payloads[4].targetName, "3号");
  assert.deepEqual(payloads[4].requiredTerms, ["3号"], "public references to the human should use the seat number, not UI text");
}

function testInspectionRules() {
  const warnings = inspectDialogueText("接前面一句：7号 证据线还要复核。你 这边先听回应。，", {
    requiredTerms: ["7号"],
    maxChars: 80,
  });
  assert.ok(warnings.some((entry) => entry.rule === "system-jargon"));
  assert.ok(warnings.some((entry) => entry.category === "garbled-english-leak"));
  assert.ok(warnings.some((entry) => entry.rule === "report-tone"));
  assert.ok(warnings.some((entry) => entry.rule === "stitching-artifact"));
  const partial = inspectDialogueText("6号这点我先放不下，2 号公聊提到：公开身份。（先复…，先让他讲清楚。", {
    requiredTerms: ["6号"],
    maxChars: 100,
  });
  assert.ok(partial.some((entry) => entry.rule === "stitching-artifact"));
  const missing = inspectDialogueText("这个位置先听回应。", { requiredTerms: ["7号"], maxChars: 80 });
  assert.ok(missing.some((entry) => entry.rule === "missing-required-term"));
  const deathDrift = inspectDialogueText("6号要把昨晚死亡这条线解释清楚。", {
    requiredTerms: ["6号"],
    maxChars: 100,
    candidateText: "6号身份和昨晚信息先讲完整，我现在不定死。",
    evidence: [],
  });
  assert.ok(deathDrift.some((entry) => entry.rule === "unsupported-death-info"));
  const assistantTone = inspectDialogueText("请在6号中确认身份和昨晚信息，以便我能够更好地了解情况并做出恰当的回应。", {
    requiredTerms: ["6号"],
    maxChars: 100,
    candidateText: "6号身份和昨晚信息先讲完整。",
  });
  assert.ok(assistantTone.some((entry) => entry.rule === "assistant-tone"));
  assert.ok(assistantTone.some((entry) => entry.category === "wrong-identity"));
  const quotedReport = inspectDialogueText("6号这边，2号公聊提到：我不无理由改口。公开身份：镇长。", {
    requiredTerms: ["6号"],
    maxChars: 100,
    candidateText: "6号身份和昨晚信息先讲完整。",
  });
  assert.ok(quotedReport.some((entry) => entry.rule === "assistant-tone"));
  const internalJargon = inspectDialogueText("6号是主压力位，按世界分支和角色假说继续公开追问。", {
    requiredTerms: ["6号"],
    maxChars: 100,
  });
  assert.ok(internalJargon.some((entry) => entry.rule === "internal-reasoning-jargon"));
  assert.ok(internalJargon.some((entry) => entry.category === "wrong-identity"));
}

async function testEvaluationUsesMockRenderer() {
  const payloads = buildEvaluationPayloadsFromReplay(replay, { limit: 1 });
  const rows = await evaluateDialoguePayloads(payloads, {
    enabled: true,
    provider: "mock",
    mock: true,
  });
  assert.equal(rows.length, 1);
  assert.match(rows[0].llmRendered, new RegExp(rows[0].targetName));
  assert.equal(rows[0].deterministicDraft, rows[0].currentLocal);
  assert.equal(rows[0].finalPlayerVisibleText, rows[0].llmRendered);
  assert.equal(rows[0].fallbackReason, "");
  assert.equal(rows[0].llmFallbackUsed, false);
  const summary = summarizeEvaluation(rows);
  assert.equal(summary.rows, 1);
  assert.equal(summary.passedRows + summary.failedRows, 1);
  assert.equal(summary.fallbackRows, 0);
}

async function testEvaluationKeepsDeterministicFallback() {
  const payload = buildSampleEvaluationPayloads()[0];
  const rows = await evaluateDialoguePayloads([payload], {
    enabled: false,
    provider: "mock",
    mock: false,
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].deterministicDraft, payload.candidateText);
  assert.equal(rows[0].llmFinal, "");
  assert.equal(rows[0].llmFallbackUsed, true);
  assert.ok(rows[0].fallbackReason, "disabled renderer should record why deterministic fallback was used");
  assert.ok(rows[0].finalPlayerVisibleText, "fallback must still produce player-visible text");
  assert.ok(
    payload.requiredTerms.every((term) => rows[0].finalPlayerVisibleText.includes(term)),
    "fallback must preserve required target anchors"
  );
  assert.deepEqual(inspectDialogueText(rows[0].finalPlayerVisibleText, payload), []);
}

function testSampleLocalDialoguePassesCurrentInspection() {
  const payloads = buildSampleEvaluationPayloads();
  const warnings = payloads.flatMap((payload) =>
    inspectDialogueText(payload.candidateText, payload).map((warning) => ({
      id: payload.id,
      rule: warning.rule,
      text: payload.candidateText,
    }))
  );
  assert.deepEqual(warnings, []);
}

function testSampleDialogueVariesBySeed() {
  const first = buildSampleEvaluationPayloads({ seed: 2026051402, role: "washerwoman" });
  const second = buildSampleEvaluationPayloads({ seed: 2026051503, role: "fortune-teller" });
  const firstTexts = new Set(first.map((payload) => payload.candidateText));
  const newTexts = second.filter((payload) => !firstTexts.has(payload.candidateText));
  assert.ok(newTexts.length > 0, "sample audit batches should cover more than one deterministic dialogue path");
  const warnings = [...first, ...second].flatMap((payload) =>
    inspectDialogueText(payload.candidateText, payload).map((warning) => ({
      id: payload.id,
      rule: warning.rule,
      text: payload.candidateText,
    }))
  );
  assert.deepEqual(warnings, []);
}

function testSampleBatchCoversRequiredDialogueModes() {
  const payloads = buildSampleEvaluationPayloadBatch({ limit: 50 });
  assert.ok(payloads.length >= 50, "generated sample batch should satisfy the 50-row eval floor");
  const intents = new Set(payloads.map((payload) => payload.intent));
  assert.ok(intents.has("private_reply"), "sample batch should include private replies");
  assert.ok(intents.has("public_table_talk"), "sample batch should include public table talk");
  assert.ok(intents.has("nomination_reason"), "sample batch should include nomination reasons");
  assert.ok(intents.has("vote_reason"), "sample batch should include vote rationales");
  assert.ok(intents.has("proactive_private"), "sample batch should include proactive private chat");
}

testBuildPayloadsFromReplay();
testInspectionRules();
testSampleLocalDialoguePassesCurrentInspection();
testSampleDialogueVariesBySeed();
testSampleBatchCoversRequiredDialogueModes();
await testEvaluationUsesMockRenderer();
await testEvaluationKeepsDeterministicFallback();

console.log("ai llm dialogue eval contracts ok");
