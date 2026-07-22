import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  BAD_TASTE_RULES,
  DIALOGUE_LIMITS,
  buildReport,
  inspectOutput,
  runScenarios,
  sentenceCount,
} from "../scripts/ai_dialogue_smoke.mjs";
import { applySpeechBudget } from "../scripts/ai_speech_renderer.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function warningIds(output) {
  return inspectOutput(output).map((warning) => warning.rule);
}

function testWarningPolicyIsStillStrict() {
  const ruleIds = BAD_TASTE_RULES.map((rule) => rule.id);
  assert.ok(ruleIds.includes("future-script"), "future-script warning must remain enabled");
  assert.deepEqual(DIALOGUE_LIMITS.public, { maxChars: 115, maxSentences: 2 });
  assert.deepEqual(DIALOGUE_LIMITS.nomination, { maxChars: 120, maxSentences: 2 });
  assert.deepEqual(DIALOGUE_LIMITS.private, { maxChars: 170, maxSentences: 3 });

  assert.ok(
    warningIds({ audience: "public", prompt: "公聊", text: "我会问7号身份。" }).includes("future-script"),
    "known future-script fixture must still warn"
  );
  assert.ok(
    warningIds({ audience: "ai-private", prompt: "私聊", text: "等今天公聊跑一轮再决定要不要提名。" }).includes(
      "future-script"
    ),
    "future nomination-script fixture must still warn"
  );
  assert.ok(
    warningIds({ audience: "public", prompt: "公聊", text: "7号先进入观察位，回应之后再重排。" }).includes(
      "future-script"
    ),
    "future response-script fixture must still warn"
  );
  assert.ok(
    warningIds({ audience: "public", prompt: "公聊", text: "先看7号。证据没对上。先听回应。" }).includes(
      "too-many-sentences"
    ),
    "known three-sentence public fixture must still warn"
  );
  assert.ok(
    warningIds({ audience: "private", prompt: "理由", text: "先拆来源再看节奏，同源回声先压低。" }).includes(
      "analysis-report"
    ),
    "known report-style fixture must warn"
  );
  assert.ok(
    warningIds({
      audience: "public",
      prompt: "公聊",
      text: "让7号把没讲清的点补清，昨晚信息也要说完整。这条让7号把没讲清的点补上，再说昨晚信息。",
    }).includes("repeated-table-action"),
    "known repeated table action must warn"
  );
}

function testFixedCorpusIsConciseAndAnchored() {
  const scenarios = runScenarios();
  const report = buildReport(scenarios, "deterministic-contract");
  assert.equal(report.data.summary.lines, 22, "fixed smoke corpus must keep all 22 utterances");
  assert.equal(report.data.summary.warnings, 0, "fixed smoke corpus must have zero warnings");

  for (const output of report.data.outputs) {
    const limits = DIALOGUE_LIMITS[output.audience] ?? DIALOGUE_LIMITS.private;
    const maxSentences =
      output.allowHiddenTruth && output.audience === "ai-private"
        ? limits.hiddenTruthMaxSentences
        : limits.maxSentences;
    assert.ok(output.text.length <= limits.maxChars, `${output.scenario}: character budget exceeded`);
    assert.ok(sentenceCount(output.text) <= maxSentences, `${output.scenario}: sentence budget exceeded`);
    assert.equal(output.warnings.length, 0, `${output.scenario}: warning policy rejected final text`);

    if (output.audience === "nomination") {
      const target = output.prompt.match(/\d+号/u)?.[0] ?? "";
      assert.ok(target && output.text.includes(target), "nomination must retain its target seat");
      assert.match(output.text, /提|因为|没讲清|对不上|过不去|理由/u, "nomination must retain a reason");
    }
    if (output.audience === "public") {
      assert.match(output.text, /\d+号/u, "public line must retain a concrete seat target");
      assert.doesNotMatch(output.text, /先问你|我会问你/u, "public line must address the target seat, not a private pronoun");
      assert.doesNotMatch(output.text, /^\d+号[。！？]?$/u, "public line must not collapse to a target-only fragment");
    }
    if (/什么身份/u.test(output.prompt)) {
      assert.match(output.text, /身份|我是|跳/u, "identity reply must retain an identity claim");
    }
    if (/投票/u.test(output.prompt)) {
      assert.match(output.text, /投|票|站|支持|反对|不上/u, "vote reply must retain a stance");
    }
    if (/别绕|直接说/u.test(output.prompt)) {
      assert.match(output.text, /直接答|接着刚才|先说清楚|直接说/u, "pushback reply must acknowledge the turn");
    }
  }
}

function testUnityProjectMirrorsMatchCanonicalSources() {
  const mirroredFiles = [
    "ai_dialogue_smoke.mjs",
    "ai_public_discussion.js",
    "ai_speech_corpus.json",
    "ai_speech_renderer.js",
  ];
  mirroredFiles.forEach((fileName) => {
    const canonical = readFileSync(path.join(ROOT, "scripts", fileName));
    const mirror = readFileSync(
      path.join(ROOT, "unity-prototype", "Assets", "StreamingAssets", "BotcJsCore", "scripts", fileName)
    );
    assert.deepEqual(mirror, canonical, `${fileName}: Unity project mirror must match the canonical source byte-for-byte`);
  });
}

function testHiddenTruthBudgetExceptionStaysIsolated() {
  const ordinaryPrivate = applySpeechBudget(
    "我真实身份是厨师。昨晚信息是1。先听7号回应。票型也要解释。",
    { audience: "private", maxSentences: 5, maxChars: 170 }
  );
  assert.ok(sentenceCount(ordinaryPrivate) <= 3, "ordinary private identity speech must keep the three-sentence cap");

  const alliedPrivate = applySpeechBudget(
    "自己人，队伍信息先说清。恶魔是2号。我真实身份是男爵。台面上先压7号。理由只用公开发言。",
    { audience: "private", maxSentences: 5, maxChars: 170 }
  );
  assert.ok(sentenceCount(alliedPrivate) <= 3, "implicit private speech must keep the ordinary sentence cap");
  assert.match(alliedPrivate, /队伍信息|恶魔是2号/u, "allied private compaction must keep team information");
  assert.match(alliedPrivate, /真实身份|男爵/u, "allied private compaction must keep the speaker's true role");
  assert.match(alliedPrivate, /7号|公开发言/u, "allied private compaction must keep its public cover action");

  const publicCopy = applySpeechBudget(alliedPrivate, { audience: "public", maxSentences: 5, maxChars: 170 });
  assert.ok(sentenceCount(publicCopy) <= 2, "hidden-team markers must never expand the public speech budget");
}

function testTerminalCompactionKeepsMandatoryAnchors() {
  const text = applySpeechBudget("我是圣徒。昨天先看1号，今天转2号。2号前面发言没讲清楚。", {
    audience: "public",
    maxSentences: 2,
    maxChars: 115,
    minPriorityFragments: 3,
    priorityFragments: [
      { key: "claim", text: "我是圣徒。", priority: 5 },
      { key: "continuity", text: "昨天先看1号，今天转2号。", priority: 5 },
      { key: "evidence", text: "2号前面发言没讲清楚。", priority: 5 },
    ],
  });
  assert.ok(sentenceCount(text) <= 2, "mandatory anchors must still fit the public sentence budget");
  assert.match(text, /圣徒/u, "terminal compaction must keep the identity claim");
  assert.match(text, /今天转2号/u, "terminal compaction must keep continuity and the current target");
  assert.match(text, /2号前面发言没讲清楚/u, "terminal compaction must keep current public evidence");
}

function testFutureVotePlanBecomesCurrentStance() {
  const text = applySpeechBudget("如果提1号，我会先看回应，再决定投不投。", {
    audience: "private",
    maxSentences: 3,
    maxChars: 170,
  });
  assert.match(text, /1号|回应/u, "vote stance must keep its target and response condition");
  assert.match(text, /票暂不锁/u, "vote stance must state the current position");
  assert.equal(warningIds({ audience: "private", prompt: "投票", text }).includes("future-script"), false);
}

function testRepeatedTargetEvidenceCollapsesToOneTableAction() {
  const text = applySpeechBudget(
    "猎手说法这轮不改，还是沿着这条聊。我先回应质疑：先看2号：我过不去的是：前面发言没讲清楚，我先看2号，我过不去的是：前面发言没讲清楚。",
    { audience: "public", maxSentences: 2, maxChars: 115 }
  );
  assert.equal(text.match(/前面发言没讲清楚/gu)?.length ?? 0, 1, "the same target evidence must be stated once");
  assert.equal(warningIds({ audience: "public", prompt: "回应质疑", text }).length, 0);
}

testWarningPolicyIsStillStrict();
testFixedCorpusIsConciseAndAnchored();
testUnityProjectMirrorsMatchCanonicalSources();
testHiddenTruthBudgetExceptionStaysIsolated();
testTerminalCompactionKeepsMandatoryAnchors();
testFutureVotePlanBecomesCurrentStance();
testRepeatedTargetEvidenceCollapsesToOneTableAction();
console.log("AI table language contracts passed.");
