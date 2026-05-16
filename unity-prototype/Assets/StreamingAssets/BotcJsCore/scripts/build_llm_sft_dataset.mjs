import fs from "node:fs";
import path from "node:path";

import {
  buildEvaluationPayloadsFromReplay,
  buildSampleEvaluationPayloads,
  inspectDialogueText,
} from "./ai_llm_dialogue_eval.mjs";
import { buildLLMRendererPrompt, renderSpeechWithLocalLLM } from "./ai_llm_renderer.js";

const DEFAULT_INPUT = path.resolve("output", "demo_replays", "latest.json");
const DEFAULT_OUTPUT = path.resolve("output", "llm_finetune", "sft_dataset.jsonl");

function argValue(name, fallback = "") {
  const hit = process.argv.find((entry) => entry === name || entry.startsWith(`${name}=`));
  if (!hit) return fallback;
  if (hit === name) return "true";
  return hit.slice(name.length + 1);
}

function hasFlag(name) {
  return process.argv.includes(name) || process.argv.some((entry) => entry.startsWith(`${name}=`));
}

function oneLine(value) {
  return `${value ?? ""}`.replace(/\s+/g, " ").trim();
}

function compactText(value, limit = 180) {
  const text = oneLine(value);
  return text.length > limit ? `${text.slice(0, Math.max(0, limit - 1)).trim()}…` : text;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function listReplayFiles(inputPath) {
  if (!inputPath || !fs.existsSync(inputPath)) return [];
  const stat = fs.statSync(inputPath);
  if (stat.isFile()) return [inputPath];
  if (!stat.isDirectory()) return [];
  return fs
    .readdirSync(inputPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.join(inputPath, entry.name))
    .sort();
}

function ensureParent(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function fallbackTarget(payload) {
  return compactText(payload.candidateText, payload.maxChars ?? 170);
}

async function targetForPayload(payload, options) {
  if (options.targetMode === "rendered") {
    const result = await renderSpeechWithLocalLLM(payload, {
      enabled: options.live || process.env.BOTC_LLM_RENDERER === "1" || options.provider === "mock",
      provider: options.provider,
      timeoutMs: options.timeoutMs,
    });
    return {
      text: result.text,
      source: result.source,
      fallbackUsed: result.fallbackUsed,
      reason: result.reason,
    };
  }
  return {
    text: fallbackTarget(payload),
    source: "candidate",
    fallbackUsed: true,
    reason: options.targetMode === "manual" ? "manual-review-needed" : "candidate-baseline",
  };
}

function sftRecordFromPayload(payload, target, options = {}) {
  const prompt = buildLLMRendererPrompt(payload);
  const warnings = inspectDialogueText(target.text, payload);
  return {
    messages: [
      { role: "system", content: prompt.system },
      { role: "user", content: prompt.user },
      { role: "assistant", content: JSON.stringify({ text: target.text }) },
    ],
    metadata: {
      id: payload.id,
      sourceKind: payload.sourceKind,
      targetMode: options.targetMode,
      targetSource: target.source,
      fallbackUsed: target.fallbackUsed,
      reason: target.reason,
      speakerName: payload.speakerName,
      targetName: payload.targetName,
      audience: payload.audience,
      intent: payload.intent,
      persona: payload.persona,
      warnings,
      reviewRequired: options.targetMode !== "rendered" || warnings.length > 0,
    },
  };
}

function markdownReport(rows, outputPath, options = {}) {
  const warningRows = rows.filter((row) => row.metadata.warnings.length > 0);
  const reviewRows = rows.filter((row) => row.metadata.reviewRequired);
  const lines = [
    "# LLM SFT Dataset Report",
    "",
    `generatedAt: ${new Date().toISOString()}`,
    `output: ${outputPath}`,
    `targetMode: ${options.targetMode}`,
    `rows: ${rows.length}`,
    `reviewRequired: ${reviewRows.length}`,
    `warningRows: ${warningRows.length}`,
    "",
    "## Notes",
    "",
    "- This dataset trains only the language renderer.",
    "- It must not be used to train rule decisions, hidden information access, nominations, or votes.",
    "- `candidate` and `manual` modes are plumbing/review modes; use curated or rendered targets before real training.",
    "",
  ];
  if (warningRows.length > 0) {
    lines.push("## Warning Samples", "");
    warningRows.slice(0, 12).forEach((row) => {
      const warningIds = row.metadata.warnings.map((entry) => entry.rule).join(", ");
      const assistant = JSON.parse(row.messages[2].content).text;
      lines.push(`- ${row.metadata.id}: ${warningIds}`);
      lines.push(`  - target: ${assistant}`);
    });
    lines.push("");
  }
  return lines.join("\n");
}

async function main() {
  const input = path.resolve(argValue("--input", DEFAULT_INPUT));
  const output = path.resolve(argValue("--output", DEFAULT_OUTPUT));
  const targetMode = argValue("--target", "candidate").toLowerCase();
  if (!["candidate", "rendered", "manual"].includes(targetMode)) {
    throw new Error(`Unsupported --target=${targetMode}. Use candidate, rendered, or manual.`);
  }
  const limit = Number(argValue("--limit", "80")) || 80;
  const provider = argValue("--provider", process.env.BOTC_LLM_PROVIDER || "mock");
  const timeoutMs = Number(argValue("--timeout", process.env.BOTC_LLM_TIMEOUT_MS || "30000")) || 30000;
  const live = hasFlag("--live");

  const replayFiles = listReplayFiles(input);
  let payloads = replayFiles.length > 0
    ? replayFiles.flatMap((filePath) => buildEvaluationPayloadsFromReplay(readJson(filePath), { limit }))
    : buildSampleEvaluationPayloads().slice(0, limit);
  if (payloads.length === 0) {
    payloads = buildSampleEvaluationPayloads().slice(0, limit);
  }

  const rows = [];
  for (const payload of payloads.slice(-limit)) {
    const target = await targetForPayload(payload, { targetMode, provider, timeoutMs, live });
    rows.push(sftRecordFromPayload(payload, target, { targetMode }));
  }

  ensureParent(output);
  fs.writeFileSync(output, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf8");
  const reportPath = output.replace(/\.jsonl$/i, ".report.md");
  fs.writeFileSync(reportPath, `${markdownReport(rows, output, { targetMode })}\n`, "utf8");

  console.log(`LLM SFT dataset rows: ${rows.length}`);
  console.log(`Dataset: ${output}`);
  console.log(`Report: ${reportPath}`);
}

await main();
