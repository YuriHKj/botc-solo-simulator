import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_SAMPLES = [
  {
    id: "identity",
    text: "你是什么身份？",
    intent: "claim",
    expected: /身份|我是|范围|具体身份|信息位|暂时|保留|不说死/,
  },
  {
    id: "night-info",
    text: "你昨晚得到了什么信息？",
    intent: "night",
    preferInfoTarget: true,
    expected: /昨晚|昨夜|夜里|夜间|夜晚|信息|没有/,
  },
  {
    id: "suspect",
    text: "你现在最怀疑谁？",
    intent: "suspect",
    expected: /怀疑|可疑|最想追|第一关注|先看|先盯|盯|追/,
  },
  {
    id: "trust",
    text: "你现在最信谁？你信我吗？",
    intent: "trust",
    expected: /信任|相信|信谁|你.{0,8}在我这里|偏好|风险|中间位|不信|放下/,
  },
  {
    id: "vote-nomination",
    text: "如果今天提名 5号，你会怎么投？",
    intent: "vote",
    expected: /投|票|提名|跟票|赞成|反对|上票|补不上/,
  },
  {
    id: "reason",
    text: "为什么你怀疑 3号？给我两个理由。",
    intent: "reason",
    expected: /因为|理由|主要|证据|对不上|提到|卡点|公开|信息|站队/,
  },
  {
    id: "free-plan",
    text: "这局你最担心什么？我们下一步怎么打？",
    intent: "plan",
    expected: /担心|下一步|建议|计划|先问|先把|今天|公聊|提名|推进/,
  },
  {
    id: "follow-up",
    text: "再具体一点，昨晚信息和身份边界能说清吗？",
    intent: "night",
    primer: { text: "你是什么身份？", intent: "claim" },
    expected: /具体|昨晚|昨夜|夜里|信息|身份|范围|边界|能说/,
  },
];

const FORBIDDEN_REPLY_PATTERNS = [
  /Public claim|Contract nomination|ghost vote control|self-protection vote|ally protection vote/i,
  /agentView|evidenceContract|forbiddenTerms|visibleFacts|deterministic draft|roughDraft/i,
  /JS Core|PRIVATE_SECRET_MARKER|真实身份|恶魔伪装|邪恶互认|系统提示|我是AI|作为AI/i,
  /undefined|NaN/,
];

function parseArgs(argv) {
  const values = new Map();
  const flags = new Set();
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
      flags.add(entry.slice(2));
    }
  }
  return { values, flags };
}

function argValue(args, name, fallback = "") {
  return args.values.get(name) ?? fallback;
}

function hasFlag(args, name) {
  return args.flags.has(name) || args.values.has(name);
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function cleanText(value) {
  return `${value ?? ""}`.replace(/\s+/g, " ").trim();
}

function sampleHarness(outputRoot, sample) {
  const root = path.resolve(outputRoot, sample.id);
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(root, { recursive: true });
  return {
    root,
    statePath: path.join(root, "unity_state.json"),
    viewModelPath: path.join(root, "unity_viewmodel.json"),
    actionPath: path.join(root, "unity_action.json"),
    resultPath: path.join(root, "unity_action_result.json"),
  };
}

async function submit(processUnityActionFileAsync, harness, type, payload, options = {}) {
  const action = {
    id: `${type}-${Date.now()}-${process.pid}-${Math.floor(Math.random() * 100000)}`,
    type,
    payload,
    createdAt: new Date().toISOString(),
  };
  writeJson(harness.actionPath, action);
  const processed = await processUnityActionFileAsync({
    statePath: harness.statePath,
    viewModelPath: harness.viewModelPath,
    actionPath: harness.actionPath,
    resultPath: harness.resultPath,
    scriptId: "tb",
    playerCount: 9,
    preferredHumanRoleId: "slayer",
    seed: options.seed ?? 20260612,
    disableReplayRecorder: true,
    llmRenderer: options.llmRenderer,
    llmProvider: options.llmProvider,
    llmTimeoutMs: options.llmTimeoutMs,
    llmMaxLines: options.llmMaxLines ?? 4,
  });
  return { action, ...processed };
}

function pickTarget(state, sample) {
  const players = state.players ?? [];
  if (sample.preferInfoTarget) {
    const infoTarget = players.find((player) =>
      !player.isHuman &&
      player.alive !== false &&
      Array.isArray(player.privateNotes) &&
      player.privateNotes.length > 0
    );
    if (infoTarget) return infoTarget;
  }
  return (
    players.find((player) => !player.isHuman && player.alive !== false && player.team === "good") ??
    players.find((player) => !player.isHuman && player.alive !== false) ??
    null
  );
}

function intentPreserved(outgoing, sample) {
  return outgoing?.text === sample.text && outgoing?.intent === sample.intent;
}

function semanticFailure(reply, sample) {
  const text = cleanText(reply);
  if (!text) return "empty-reply";
  const forbidden = FORBIDDEN_REPLY_PATTERNS.find((pattern) => pattern.test(text));
  if (forbidden) return `forbidden-leak:${forbidden}`;
  if (
    ["claim", "night"].includes(sample.intent) &&
    /^你.{0,12}(?:先|这块|这个|身份|昨晚|信息).{0,24}(?:补|讲|说清|对齐|给结论)/.test(text)
  ) {
    return "answer-directed-at-human";
  }
  if (/^[0-9]+号[，,。.\s]*$/.test(text) || text.length < 8) return "under-informative-target-only";
  if (!sample.expected.test(text)) return `intent-not-answered:${sample.id}`;
  return "";
}

function reportMarkdown(report) {
  const lines = [
    "# Unity Private Chat Semantic Samples",
    "",
    `- Generated: ${report.generatedAt}`,
    `- LLM renderer: ${report.llm.enabled ? `${report.llm.provider}/${report.llm.model || "default"}` : "disabled"}`,
    `- Passed: ${report.passed}/${report.rows.length}`,
    "",
  ];
  for (const row of report.rows) {
    lines.push(
      `## ${row.id}`,
      "",
      `- Player question: ${row.playerQuestion}`,
      `- Intent: ${row.intent}`,
      `- Outgoing preserved: ${row.outgoingPreserved ? "yes" : "no"}`,
      `- AI raw reply: ${row.aiRawReply}`,
      `- LLM final: ${row.llmFinal}`,
      `- LLM: ${row.llmSource}${row.llmFallbackUsed ? ` fallback=${row.llmReason || "unknown"}` : ""}`,
      `- Semantic check: ${row.pass ? "pass" : `fail (${row.failure})`}`,
      ""
    );
  }
  return `${lines.join("\n")}\n`;
}

async function prepareDay(processUnityActionFileAsync, harness, sample, options) {
  let step = await submit(processUnityActionFileAsync, harness, "new-game", {
    scriptId: "tb",
    playerCount: 9,
    preferredHumanRoleId: "slayer",
    seed: options.seed,
  }, options);
  assert.equal(step.result.ok, true, step.result.reason);
  if (step.viewModel.phase === "night") {
    step = await submit(processUnityActionFileAsync, harness, "phase", { stage: "day" }, options);
    assert.equal(step.result.ok, true, step.result.reason);
  }
  assert.equal(step.viewModel.phase, "day", `${sample.id} should reach day phase`);
  return step.viewModel;
}

async function runOneSample(processUnityActionFileAsync, sample, options) {
  const harness = sampleHarness(options.outputRoot, sample);
  await prepareDay(processUnityActionFileAsync, harness, sample, options);
  let state = readJson(harness.statePath).state;
  const target = pickTarget(state, sample);
  assert.ok(target?.id, `${sample.id} needs a private chat target`);

  if (sample.primer) {
    const primer = await submit(processUnityActionFileAsync, harness, "private-chat", {
      targetId: target.id,
      text: sample.primer.text,
      intent: sample.primer.intent,
    }, options);
    assert.equal(primer.result.ok, true, primer.result.reason);
  }

  state = readJson(harness.statePath).state;
  const beforeTimelineCount = state.aiDialogue?.timeline?.length ?? 0;
  const processed = await submit(processUnityActionFileAsync, harness, "private-chat", {
    targetId: target.id,
    text: sample.text,
    intent: sample.intent,
  }, options);
  assert.equal(processed.result.ok, true, processed.result.reason);

  state = readJson(harness.statePath).state;
  const newEntries = (state.aiDialogue?.timeline ?? []).slice(beforeTimelineCount);
  const outgoing = newEntries.find((entry) => entry.mode === "whisper-out" && entry.targetId === target.id);
  const incoming = [...newEntries].reverse().find((entry) => entry.mode === "whisper-in" && entry.speakerId === target.id);
  const reply = cleanText(incoming?.text);
  const llm = incoming?.llmRender ?? null;
  const rawReply = cleanText(llm?.deterministicDraft || reply);
  const finalReply = cleanText(llm?.finalText || reply);
  const outgoingOk = intentPreserved(outgoing, sample);
  const semanticReason = semanticFailure(finalReply, sample);
  const pass = outgoingOk && !semanticReason;
  return {
    id: sample.id,
    targetId: target.id,
    targetName: target.name,
    playerQuestion: sample.text,
    intent: sample.intent,
    outgoingText: outgoing?.text ?? "",
    outgoingIntent: outgoing?.intent ?? "",
    outgoingPreserved: outgoingOk,
    aiRawReply: rawReply,
    llmFinal: finalReply,
    reply,
    llmSource: llm?.source ?? (options.llmRenderer ? "missing" : "deterministic"),
    llmFallbackUsed: !!llm?.fallbackUsed,
    llmReason: llm?.reason ?? "",
    pass,
    failure: outgoingOk ? semanticReason : "outgoing-text-or-intent-not-preserved",
  };
}

export async function runPrivateChatSemanticSamples(options = {}) {
  const outputRoot = path.resolve(options.outputRoot ?? path.join("output", "unity-private-chat-semantic-samples"));
  fs.rmSync(outputRoot, { recursive: true, force: true });
  fs.mkdirSync(outputRoot, { recursive: true });
  const bridgeScript = path.resolve(options.bridgeScript ?? path.join("scripts", "unity_action_bridge.mjs"));
  const bridge = await import(pathToFileURL(bridgeScript).href);
  assert.equal(typeof bridge.processUnityActionFileAsync, "function", "bridge should export async processor");
  const sampleOptions = {
    outputRoot,
    seed: options.seed ?? 20260612,
    llmRenderer: options.llmRenderer ?? true,
    llmProvider: options.llmProvider ?? "mock",
    llmTimeoutMs: options.llmTimeoutMs ?? 1800,
    llmMaxLines: options.llmMaxLines ?? 4,
  };
  const samples = options.samples ?? DEFAULT_SAMPLES;
  const rows = [];
  for (const sample of samples) {
    rows.push(await runOneSample(bridge.processUnityActionFileAsync, sample, sampleOptions));
  }
  const report = {
    ok: rows.every((row) => row.pass),
    generatedAt: new Date().toISOString(),
    bridgeScript,
    llm: {
      enabled: !!sampleOptions.llmRenderer,
      provider: sampleOptions.llmProvider,
      model: sampleOptions.llmProvider === "mock" ? "mock" : process.env.BOTC_LLM_MODEL ?? "",
    },
    passed: rows.filter((row) => row.pass).length,
    rows,
    outputRoot,
  };
  writeJson(path.join(outputRoot, "private_chat_semantic_samples.json"), report);
  fs.writeFileSync(path.join(outputRoot, "private_chat_semantic_samples.md"), reportMarkdown(report), "utf8");
  if (options.assertPass !== false) {
    assert.equal(report.ok, true, `private chat semantic samples failed: ${rows.filter((row) => !row.pass).map((row) => `${row.id}:${row.failure}`).join(", ")}`);
  }
  return report;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2));
  const report = await runPrivateChatSemanticSamples({
    outputRoot: argValue(args, "out", path.join("output", "unity-private-chat-semantic-samples")),
    bridgeScript: argValue(args, "bridge-script", path.join("scripts", "unity_action_bridge.mjs")),
    seed: Number(argValue(args, "seed", "20260612")) || 20260612,
    llmRenderer: !hasFlag(args, "no-llm"),
    llmProvider: argValue(args, "llm-provider", "mock"),
    llmTimeoutMs: Number(argValue(args, "llm-timeout", "1800")) || 1800,
    assertPass: !hasFlag(args, "no-assert"),
  });
  console.log(JSON.stringify(report, null, 2));
}
