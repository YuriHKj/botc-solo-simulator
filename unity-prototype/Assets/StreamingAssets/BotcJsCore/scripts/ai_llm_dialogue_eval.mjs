import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { advanceDayStage, createNewGame, runNight } from "./engine.js";
import { initializeAI, runAIDiscussion, runPrivateWhisper } from "./ai.js";
import { renderSpeechWithLocalLLM } from "./ai_llm_renderer.js";

const DEFAULT_REPLAY_PATH = path.resolve("output", "demo_replays", "latest.json");
const OUTPUT_DIR = path.resolve("output", "ai_llm_dialogue_eval");

export const LLM_DIALOGUE_EVAL_RULES = [
  {
    id: "system-jargon",
    pattern: /口径|证据线|接前面一句|JS Core|agentView|evidenceContract|undefined|NaN/i,
    advice: "去掉工程词和复盘词，改成桌边玩家短句。",
  },
  {
    id: "report-tone",
    pattern: /当前主线|可信度|污染风险|低证据|证据还薄|压力提名|自动提名|信息链|身份链|复核/i,
    advice: "避免像审计报告，改成“先听回应/这点对不上/今天先别定死”。",
  },
  {
    id: "awkward-transition",
    pattern: /简单讲，我现在是这么看|我尽量不绕|我会反问一句|下一句我会|先把我的判断摊开/i,
    advice: "删掉空转过渡，直接给判断、原因和追问。",
  },
  {
    id: "hidden-leak-risk",
    pattern: /真实身份|邪恶互认|恶魔伪装|PRIVATE_SECRET_MARKER|bluff/i,
    advice: "公开或好人视角不能出现隐藏信息词。",
  },
  {
    id: "stitching-artifact",
    pattern: /你\s+这边|他\s+把|让他把这块|。，|，。|。。|，，/i,
    advice: "清掉拼接痕迹和断裂空格，优先用具体座位号和一句自然追问。",
  },
];

function argValue(name, fallback = "") {
  const hit = process.argv.find((entry) => entry === name || entry.startsWith(`${name}=`));
  if (!hit) return fallback;
  if (hit === name) return "true";
  return hit.slice(name.length + 1);
}

function hasFlag(name) {
  return process.argv.includes(name) || process.argv.some((entry) => entry.startsWith(`${name}=`));
}

function oneLine(text) {
  return `${text ?? ""}`.replace(/\s+/g, " ").trim();
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(raw);
}

function compactText(value, limit = 180) {
  const text = oneLine(value);
  return text.length > limit ? `${text.slice(0, Math.max(0, limit - 1)).trim()}…` : text;
}

function unique(values) {
  return [...new Set((values ?? []).map((entry) => oneLine(entry)).filter(Boolean))];
}

function fixedRng(seed = 987654321) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function playerName(state, id) {
  const player = state.players?.find((entry) => entry.id === id);
  return player ? `${player.seatIndex + 1}号` : "";
}

function inferAudience(row) {
  const mode = `${row.mode ?? ""}`.toLowerCase();
  if (row.private || mode.includes("whisper") || mode.includes("private")) return "private";
  if (mode.includes("nomination") || row.debateBeat) return "nomination";
  return "public";
}

function targetForRow(row) {
  return oneLine(row.focusName || row.targetName);
}

function textForRow(row) {
  return oneLine(row.line ?? row.text);
}

function payloadFromReplayRow(row, index, sourceKind = "replay") {
  const targetName = targetForRow(row);
  const candidateText = textForRow(row);
  const audience = inferAudience(row);
  return {
    id: `${sourceKind}-${row.index ?? index}`,
    sourceKind,
    speakerName: oneLine(row.speakerName || row.speaker),
    targetName,
    audience,
    intent: audience === "nomination" ? "nomination_reason" : audience === "public" ? "public_table_talk" : "private_reply",
    persona: row.persona ?? "steady",
    candidateText,
    evidence: unique(row.evidenceSummaries ?? row.evidence ?? []).slice(0, 3),
    requiredTerms: targetName ? [targetName] : [],
    forbiddenTerms: ["PRIVATE_SECRET_MARKER", "真实身份", "恶魔伪装", "邪恶互认"],
    maxChars: audience === "public" ? 130 : audience === "nomination" ? 150 : 170,
  };
}

export function buildEvaluationPayloadsFromReplay(replay, options = {}) {
  const limit = Number(options.limit ?? 32) || 32;
  const speeches = replay?.dialogue?.speeches ?? [];
  const timeline = replay?.dialogue?.timeline ?? [];
  const speechRows = speeches
    .filter((entry) => textForRow(entry) && entry.playerId)
    .map((entry, index) => payloadFromReplayRow(entry, index, "speech"));
  const timelineRows = timeline
    .filter((entry) => textForRow(entry) && entry.speakerId && entry.mode !== "whisper-out" && entry.mode !== "ai-private")
    .map((entry, index) => payloadFromReplayRow(entry, index, "timeline"));

  const seen = new Set();
  return [...speechRows, ...timelineRows]
    .filter((payload) => {
      const key = `${payload.speakerName}|${payload.audience}|${payload.candidateText}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(-limit);
}

export function buildSampleEvaluationPayloads() {
  const rng = fixedRng(2026051402);
  const state = createNewGame({ scriptId: "tb", playerCount: 9, preferredHumanRoleId: "washerwoman" }, rng);
  initializeAI(state);
  runNight(state, rng);
  const target = state.players.find((player) => !player.isHuman && player.alive) ?? state.players[1];
  const privateResult = runPrivateWhisper(
    state,
    {
      targetId: target.id,
      humanLine: "你现在最怀疑谁，直接说。",
      intentHint: "reason",
    },
    rng
  );
  advanceDayStage(state, "public");
  const before = state.events.speeches.length;
  runAIDiscussion(state, rng);
  const publicRows = state.events.speeches.slice(before).filter((entry) => !entry.private);

  return [
    {
      id: "sample-private",
      sourceKind: "sample",
      speakerName: playerName(state, target.id),
      targetName: playerName(state, privateResult.focusId),
      audience: "private",
      intent: "private_reply",
      persona: target.aiPersona ?? "steady",
      candidateText: privateResult.response,
      evidence: privateResult.evidenceContract?.summaries ?? [],
      requiredTerms: privateResult.focusId ? [playerName(state, privateResult.focusId)] : [],
      forbiddenTerms: ["PRIVATE_SECRET_MARKER", "真实身份", "恶魔伪装", "邪恶互认"],
      maxChars: 170,
    },
    ...publicRows.slice(0, 6).map((entry, index) => ({
      id: `sample-public-${index}`,
      sourceKind: "sample",
      speakerName: playerName(state, entry.playerId),
      targetName: playerName(state, entry.focusId),
      audience: "public",
      intent: "public_table_talk",
      persona: state.players.find((player) => player.id === entry.playerId)?.aiPersona ?? "steady",
      candidateText: entry.line,
      evidence: entry.evidenceContract?.summaries ?? [],
      requiredTerms: entry.focusId ? [playerName(state, entry.focusId)] : [],
      forbiddenTerms: ["PRIVATE_SECRET_MARKER", "真实身份", "恶魔伪装", "邪恶互认"],
      maxChars: 130,
    })),
  ].filter((entry) => entry.candidateText);
}

export function inspectDialogueText(text, payload = {}) {
  const value = oneLine(text);
  const warnings = [];
  if (!value) {
    warnings.push({ rule: "empty", advice: "发言不能为空。" });
  }
  LLM_DIALOGUE_EVAL_RULES.forEach((rule) => {
    if (rule.pattern.test(value)) warnings.push({ rule: rule.id, advice: rule.advice });
  });
  const missing = unique(payload.requiredTerms).find((term) => !value.includes(term));
  if (missing) {
    warnings.push({ rule: "missing-required-term", advice: `缺少必须保留的目标词：${missing}` });
  }
  const maxChars = payload.maxChars ?? (payload.audience === "public" ? 130 : 170);
  if (value.length > maxChars + 20) {
    warnings.push({ rule: "too-long", advice: `当前 ${value.length} 字，建议压到 ${maxChars} 字以内。` });
  }
  return warnings;
}

export async function evaluateDialoguePayloads(payloads, options = {}) {
  const provider = options.provider ?? (options.mock ? "mock" : process.env.BOTC_LLM_PROVIDER);
  const enabled = options.enabled ?? options.mock ?? options.live ?? process.env.BOTC_LLM_RENDERER === "1";
  const rows = [];
  for (const payload of payloads) {
    const currentText = compactText(payload.candidateText, payload.maxChars ?? 180);
    const render = await renderSpeechWithLocalLLM(
      {
        ...payload,
        fallbackText: currentText,
      },
      {
        enabled,
        provider,
        timeoutMs: Number(options.timeoutMs ?? process.env.BOTC_LLM_TIMEOUT_MS ?? 1400),
      }
    );
    const currentWarnings = inspectDialogueText(currentText, payload);
    const llmWarnings = inspectDialogueText(render.text, payload);
    rows.push({
      id: payload.id,
      sourceKind: payload.sourceKind,
      speakerName: payload.speakerName,
      targetName: payload.targetName,
      audience: payload.audience,
      intent: payload.intent,
      originalStructured: currentText,
      currentLocal: currentText,
      llmRendered: render.text,
      llmSource: render.source,
      llmFallbackUsed: render.fallbackUsed,
      llmReason: render.reason,
      currentWarnings,
      llmWarnings,
      delta: currentWarnings.length - llmWarnings.length,
    });
  }
  return rows;
}

export function summarizeEvaluation(rows) {
  return {
    rows: rows.length,
    currentWarnings: rows.reduce((sum, row) => sum + row.currentWarnings.length, 0),
    llmWarnings: rows.reduce((sum, row) => sum + row.llmWarnings.length, 0),
    improvedRows: rows.filter((row) => row.delta > 0).length,
    worsenedRows: rows.filter((row) => row.delta < 0).length,
    fallbackRows: rows.filter((row) => row.llmFallbackUsed).length,
  };
}

export function buildEvaluationReport(rows, options = {}) {
  const summary = summarizeEvaluation(rows);
  const lines = [
    "# AI LLM Dialogue Evaluation",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Replay: ${options.replayPath || "sample"}`,
    `Provider: ${options.provider || "mock"}`,
    "",
    "## Summary",
    "",
    `- Rows: ${summary.rows}`,
    `- Current warnings: ${summary.currentWarnings}`,
    `- LLM warnings: ${summary.llmWarnings}`,
    `- Improved rows: ${summary.improvedRows}`,
    `- Worsened rows: ${summary.worsenedRows}`,
    `- Fallback rows: ${summary.fallbackRows}`,
    "",
  ];

  rows.forEach((row, index) => {
    lines.push(`## ${index + 1}. ${row.speakerName || "未知"} · ${row.audience}`, "");
    if (row.targetName) lines.push(`Target: ${row.targetName}`, "");
    lines.push("Original structured / current local:", "", `> ${row.currentLocal}`, "");
    lines.push(`LLM rendered (${row.llmSource}${row.llmFallbackUsed ? ` fallback: ${row.llmReason}` : ""}):`, "", `> ${row.llmRendered}`, "");
    if (row.currentWarnings.length > 0 || row.llmWarnings.length > 0) {
      lines.push("Warnings:");
      row.currentWarnings.forEach((warning) => lines.push(`- current \`${warning.rule}\`: ${warning.advice}`));
      row.llmWarnings.forEach((warning) => lines.push(`- llm \`${warning.rule}\`: ${warning.advice}`));
      lines.push("");
    }
  });
  return lines.join("\n");
}

async function main() {
  const replayPath = path.resolve(argValue("--replay", DEFAULT_REPLAY_PATH));
  const useSample = hasFlag("--sample") || !fs.existsSync(replayPath);
  const mock = hasFlag("--mock");
  const live = hasFlag("--live");
  const provider = mock ? "mock" : argValue("--provider", process.env.BOTC_LLM_PROVIDER || "ollama");
  const limit = Number(argValue("--limit", "32")) || 32;
  let payloads = useSample
    ? buildSampleEvaluationPayloads().slice(-limit)
    : buildEvaluationPayloadsFromReplay(readJson(replayPath), { limit });
  if (payloads.length === 0) {
    payloads = buildSampleEvaluationPayloads().slice(-limit);
  }
  const rows = await evaluateDialoguePayloads(payloads, {
    enabled: mock || live || process.env.BOTC_LLM_RENDERER === "1",
    mock,
    live,
    provider,
    timeoutMs: Number(argValue("--timeout", process.env.BOTC_LLM_TIMEOUT_MS || "1400")) || 1400,
  });
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const reportPath = path.join(OUTPUT_DIR, "latest.md");
  const jsonPath = path.join(OUTPUT_DIR, "latest.json");
  const summary = summarizeEvaluation(rows);
  fs.writeFileSync(reportPath, `${buildEvaluationReport(rows, { replayPath: useSample ? "sample" : replayPath, provider })}\n`, "utf8");
  fs.writeFileSync(jsonPath, `${JSON.stringify({ summary, rows }, null, 2)}\n`, "utf8");
  console.log(`AI LLM dialogue eval report: ${reportPath}`);
  console.log(
    `Rows ${summary.rows}; current warnings ${summary.currentWarnings}; llm warnings ${summary.llmWarnings}; fallback ${summary.fallbackRows}.`
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
