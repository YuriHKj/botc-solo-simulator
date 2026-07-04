import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_STATE_PATH = path.join(
  "output",
  "unity-playable-path-human-loop-package-owned-script-20260611",
  "tb-fortune-teller-9p-9014",
  "unity_state.json"
);
const DEFAULT_PACKAGE_RENDERER = path.join(
  "output",
  "release-unity-ai",
  "BOTC-Solo-Unity-AI-20260608-latest-rebuild-verified",
  "BOTC_Unity_Prototype_Data",
  "StreamingAssets",
  "BotcJsCore",
  "scripts",
  "ai_llm_renderer.js"
);

function argValue(name, fallback = "") {
  const hit = process.argv.find((entry) => entry === name || entry.startsWith(`${name}=`));
  if (!hit) return fallback;
  if (hit === name) return "true";
  return hit.slice(name.length + 1);
}

function hasFlag(name) {
  return process.argv.includes(name) || process.argv.some((entry) => entry.startsWith(`${name}=`));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function splitList(value) {
  return `${value ?? ""}`
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function oneLine(value) {
  return `${value ?? ""}`.replace(/\s+/g, " ").trim();
}

function playerLabel(player) {
  if (!player) return "";
  const seat = Number(player.seatIndex ?? -1) + 1;
  return seat > 0 ? `${seat}号` : oneLine(player.name);
}

function playerMaps(state) {
  const players = state.players ?? [];
  return {
    byId: new Map(players.map((player) => [player.id, player])),
    humanId: players.find((player) => player.isHuman)?.id ?? "",
  };
}

function inferAudience(entry) {
  const mode = `${entry.mode ?? ""}`.toLowerCase();
  if (entry.private || mode.includes("whisper") || mode.includes("private")) return "private";
  if (entry.debateBeat || mode.includes("nomination")) return "nomination";
  return "public";
}

function textForEntry(entry) {
  return oneLine(entry.line ?? entry.text);
}

function entryId(entry, index, sourceKind) {
  return `${sourceKind}-${entry.id ?? entry.speechId ?? entry.index ?? index}`;
}

function payloadFromEntry(state, maps, entry, index, sourceKind) {
  const speakerId = entry.playerId ?? entry.speakerId ?? "";
  const speaker = maps.byId.get(speakerId);
  if (!speaker || speaker.isHuman || entry.hiddenFromHuman) return null;
  const candidateText = textForEntry(entry);
  if (!candidateText) return null;

  const audience = inferAudience(entry);
  const target = maps.byId.get(entry.focusId || entry.targetId || "");
  const targetName = playerLabel(target);
  const maxChars = audience === "private" ? 170 : audience === "nomination" ? 150 : 130;
  return {
    id: entryId(entry, index, sourceKind),
    sourceKind,
    speakerName: playerLabel(speaker),
    targetName,
    audience,
    intent: audience === "private" ? "private_reply" : audience === "nomination" ? "nomination_debate" : "public_table_talk",
    persona: speaker.aiPersona ?? "steady",
    candidateText,
    evidence: entry.evidenceContract?.summaries ?? [],
    requiredTerms: targetName ? [targetName] : [],
    forbiddenTerms: ["PRIVATE_SECRET_MARKER", "真实身份", "邪恶互认", "恶魔伪装", "bluff"],
    maxChars,
  };
}

function collectPayloadsFromState(state, limit, stateLabel = "") {
  const maps = playerMaps(state);
  const seen = new Set();
  const payloads = [];
  const entries = [
    ...(state.events?.speeches ?? []).map((entry, index) => ({ entry, index, sourceKind: "speech" })),
    ...(state.aiDialogue?.timeline ?? []).map((entry, index) => ({ entry, index, sourceKind: "timeline" })),
  ];

  for (const item of entries) {
    const payload = payloadFromEntry(state, maps, item.entry, item.index, item.sourceKind);
    if (!payload) continue;
    const key = `${payload.speakerName}|${payload.audience}|${payload.candidateText}`;
    if (seen.has(key)) continue;
    seen.add(key);
    payloads.push({
      ...payload,
      id: stateLabel ? `${stateLabel}:${payload.id}` : payload.id,
      sourceKind: stateLabel ? `${payload.sourceKind}:${stateLabel}` : payload.sourceKind,
    });
    if (payloads.length >= limit) break;
  }
  return payloads;
}

function collectPayloads(statePaths, limit) {
  const payloads = [];
  const seen = new Set();
  for (const statePath of statePaths) {
    const parsed = readJson(statePath);
    const state = parsed.state ?? parsed;
    const stateLabel = path.basename(path.dirname(statePath));
    for (const payload of collectPayloadsFromState(state, limit, stateLabel)) {
      const key = `${payload.speakerName}|${payload.audience}|${payload.candidateText}`;
      if (seen.has(key)) continue;
      seen.add(key);
      payloads.push(payload);
      if (payloads.length >= limit) return payloads;
    }
  }
  return payloads;
}

function inspectText(text, payload) {
  const value = oneLine(text);
  const warnings = [];
  if (!value) warnings.push("empty");
  if (/当前|主线|证据链|信息链|可信度|压力链|复核|推演|策略评分|自动提名|逻辑上/.test(value)) {
    warnings.push("report-tone");
  }
  if (/PRIVATE_SECRET_MARKER|真实身份|邪恶互认|恶魔伪装|bluff/i.test(value)) {
    warnings.push("hidden-leak-risk");
  }
  if (/是否愿意|以便我|请你|请在|能否确认|我需要你/.test(value)) {
    warnings.push("assistant-tone");
  }
  if (/我现在是这么看|我这边先|简单说|接下来我会/.test(value)) {
    warnings.push("stock-opener");
  }
  if (value.length > (payload.maxChars ?? 150) + 20) {
    warnings.push("too-long");
  }
  for (const term of payload.requiredTerms ?? []) {
    if (term && !value.includes(term)) warnings.push(`missing-required:${term}`);
  }
  return warnings;
}

async function renderRows(payloads, renderer, options) {
  const rows = [];
  for (const payload of payloads) {
    const original = oneLine(payload.candidateText);
    const rendered = await renderer.renderSpeechWithLocalLLM(
      { ...payload, fallbackText: original },
      {
        enabled: options.enabled,
        provider: options.provider,
        endpoint: options.endpoint,
        model: options.model,
        timeoutMs: options.timeoutMs,
      }
    );
    rows.push({
      id: payload.id,
      sourceKind: payload.sourceKind,
      speakerName: payload.speakerName,
      targetName: payload.targetName,
      audience: payload.audience,
      original,
      rendered: rendered.text,
      llmSource: rendered.source,
      llmFallbackUsed: rendered.fallbackUsed,
      llmReason: rendered.reason,
      originalWarnings: inspectText(original, payload),
      renderedWarnings: inspectText(rendered.text, payload),
    });
  }
  return rows;
}

function summarize(rows) {
  return {
    rows: rows.length,
    originalWarnings: rows.reduce((sum, row) => sum + row.originalWarnings.length, 0),
    renderedWarnings: rows.reduce((sum, row) => sum + row.renderedWarnings.length, 0),
    improvedRows: rows.filter((row) => row.renderedWarnings.length < row.originalWarnings.length).length,
    worsenedRows: rows.filter((row) => row.renderedWarnings.length > row.originalWarnings.length).length,
    fallbackRows: rows.filter((row) => row.llmFallbackUsed).length,
    sources: Object.fromEntries(
      [...new Set(rows.map((row) => row.llmSource))].map((source) => [source, rows.filter((row) => row.llmSource === source).length])
    ),
  };
}

function markdownReport({ statePaths, rendererPath, provider, endpoint, model, summary, rows }) {
  const lines = [
    "# Unity Package AI Dialogue Audit",
    "",
    `States: ${statePaths.join(", ")}`,
    `Renderer: ${rendererPath}`,
    `Provider: ${provider}`,
    `Endpoint: ${endpoint}`,
    `Model: ${model}`,
    "",
    "## Summary",
    "",
    `- Rows: ${summary.rows}`,
    `- Original warnings: ${summary.originalWarnings}`,
    `- Rendered warnings: ${summary.renderedWarnings}`,
    `- Improved rows: ${summary.improvedRows}`,
    `- Worsened rows: ${summary.worsenedRows}`,
    `- Fallback rows: ${summary.fallbackRows}`,
    `- Sources: ${JSON.stringify(summary.sources)}`,
    "",
  ];
  rows.forEach((row, index) => {
    lines.push(`## ${index + 1}. ${row.speakerName} / ${row.audience}`, "");
    if (row.targetName) lines.push(`Target: ${row.targetName}`, "");
    lines.push(`Original warnings: ${row.originalWarnings.join(", ") || "none"}`);
    lines.push(`Rendered warnings: ${row.renderedWarnings.join(", ") || "none"}`);
    lines.push(`LLM: ${row.llmSource}${row.llmFallbackUsed ? ` fallback=${row.llmReason}` : ""}`, "");
    lines.push("Original:", "", `> ${row.original}`, "");
    lines.push("Rendered:", "", `> ${row.rendered}`, "");
  });
  return lines.join("\n");
}

async function main() {
  const statePaths = splitList(argValue("--states", argValue("--state", DEFAULT_STATE_PATH))).map((entry) => path.resolve(entry));
  const rendererPath = path.resolve(argValue("--renderer", DEFAULT_PACKAGE_RENDERER));
  const outDir = path.resolve(argValue("--out", path.join("output", "ai-dialogue-package-audit-20260611")));
  const limit = Number(argValue("--limit", "20")) || 20;
  const provider = argValue("--provider", process.env.BOTC_LLM_PROVIDER || "openai-compatible");
  const endpoint = argValue("--endpoint", process.env.BOTC_LLM_ENDPOINT || "http://127.0.0.1:18080/v1/chat/completions");
  const model = argValue("--model", process.env.BOTC_LLM_MODEL || "qwen2.5-0.5b-instruct-q4_k_m");
  const timeoutMs = Number(argValue("--timeout", process.env.BOTC_LLM_TIMEOUT_MS || "4000")) || 4000;
  const enabled = !hasFlag("--disabled");

  const payloads = collectPayloads(statePaths, limit);
  if (payloads.length < limit) {
    throw new Error(`Only found ${payloads.length} dialogue payloads in ${statePaths.join(", ")}; need ${limit}.`);
  }

  const renderer = await import(pathToFileURL(rendererPath).href);
  const rows = await renderRows(payloads, renderer, { enabled, provider, endpoint, model, timeoutMs });
  const summary = summarize(rows);
  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, "samples.json");
  const mdPath = path.join(outDir, "samples.md");
  const payload = {
    generatedAt: new Date().toISOString(),
    statePaths,
    rendererPath,
    provider,
    endpoint,
    model,
    timeoutMs,
    summary,
    rows,
  };
  fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  fs.writeFileSync(mdPath, `${markdownReport(payload)}\n`, "utf8");
  console.log(JSON.stringify({ jsonPath, mdPath, summary }, null, 2));
}

await main();
