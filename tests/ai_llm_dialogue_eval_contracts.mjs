import assert from "node:assert/strict";

import {
  buildEvaluationPayloadsFromReplay,
  evaluateDialoguePayloads,
  inspectDialogueText,
  summarizeEvaluation,
} from "../scripts/ai_llm_dialogue_eval.mjs";

const replay = {
  dialogue: {
    speeches: [
      {
        index: 0,
        day: 1,
        mode: "public",
        playerId: "p2",
        speakerName: "2号",
        focusId: "p7",
        focusName: "7号",
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
        index: 1,
        mode: "whisper-in",
        speakerId: "p3",
        speakerName: "3号",
        targetId: "human",
        targetName: "你",
        text: "5号这边我先放不下，先听回应。",
      },
    ],
  },
};

function testBuildPayloadsFromReplay() {
  const payloads = buildEvaluationPayloadsFromReplay(replay, { limit: 10 });
  assert.equal(payloads.length, 2, "should skip human outgoing whispers and dedupe duplicate AI replies");
  assert.equal(payloads[0].speakerName, "2号");
  assert.equal(payloads[0].targetName, "7号");
  assert.equal(payloads[0].audience, "public");
  assert.deepEqual(payloads[0].requiredTerms, ["7号"]);
  assert.equal(payloads[1].audience, "private");
  assert.deepEqual(payloads[1].requiredTerms, ["5号"]);
}

function testInspectionRules() {
  const warnings = inspectDialogueText("接前面一句：7号 证据线还要复核。你 这边先听回应。，", {
    requiredTerms: ["7号"],
    maxChars: 80,
  });
  assert.ok(warnings.some((entry) => entry.rule === "system-jargon"));
  assert.ok(warnings.some((entry) => entry.rule === "report-tone"));
  assert.ok(warnings.some((entry) => entry.rule === "stitching-artifact"));
  const missing = inspectDialogueText("这个位置先听回应。", { requiredTerms: ["7号"], maxChars: 80 });
  assert.ok(missing.some((entry) => entry.rule === "missing-required-term"));
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
  assert.equal(rows[0].llmFallbackUsed, false);
  const summary = summarizeEvaluation(rows);
  assert.equal(summary.rows, 1);
  assert.equal(summary.fallbackRows, 0);
}

testBuildPayloadsFromReplay();
testInspectionRules();
await testEvaluationUsesMockRenderer();

console.log("ai llm dialogue eval contracts ok");
