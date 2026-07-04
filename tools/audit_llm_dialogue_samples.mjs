import fs from "node:fs";
import path from "node:path";

import {
  buildEvaluationPayloadsFromReplay,
  buildEvaluationReport,
  buildSampleEvaluationPayloadBatch,
  evaluateDialoguePayloads,
  summarizeEvaluation,
} from "../scripts/ai_llm_dialogue_eval.mjs";

function argValue(name, fallback = "") {
  const hit = process.argv.find((entry) => entry === name || entry.startsWith(`${name}=`));
  if (!hit) return fallback;
  if (hit === name) return "true";
  return hit.slice(name.length + 1);
}

function readReplay(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function recentReplayFiles(replayDir, limit) {
  if (!fs.existsSync(replayDir)) return [];
  return fs
    .readdirSync(replayDir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => path.join(replayDir, file))
    .sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs)
    .slice(0, limit);
}

function addUnique(payloads, seen, payload, tag) {
  const candidateText = `${payload.candidateText ?? ""}`.trim();
  const key = [payload.speakerName, payload.audience, candidateText].join("|");
  if (!candidateText || seen.has(key)) return;
  seen.add(key);
  payloads.push({ ...payload, sourceKind: `${payload.sourceKind}:${tag}` });
}

async function main() {
  const outDir = path.resolve(argValue("--out", path.join("output", "ux-audit-latest-package-20260608")));
  const replayDir = path.resolve(argValue("--replay-dir", path.join("output", "demo_replays")));
  const limit = Number(argValue("--limit", "30")) || 30;
  const replayLimit = Number(argValue("--replay-limit", "24")) || 24;
  const provider = argValue("--provider", process.env.BOTC_LLM_PROVIDER || "openai-compatible");
  const timeoutMs = Number(argValue("--timeout", process.env.BOTC_LLM_TIMEOUT_MS || "30000")) || 30000;

  const payloads = [];
  const seen = new Set();
  for (const filePath of recentReplayFiles(replayDir, replayLimit)) {
    try {
      const replay = readReplay(filePath);
      for (const payload of buildEvaluationPayloadsFromReplay(replay, { limit: 32 })) {
        addUnique(payloads, seen, payload, path.basename(filePath));
      }
    } catch {
      // Keep audit sampling resilient to partial demo replay writes.
    }
    if (payloads.length >= limit) break;
  }

  if (payloads.length < limit) {
    for (const payload of buildSampleEvaluationPayloadBatch({ limit })) {
      addUnique(payloads, seen, payload, "generated-batch");
      if (payloads.length >= limit) break;
    }
  }

  const rows = await evaluateDialoguePayloads(payloads.slice(0, limit), {
    enabled: true,
    live: true,
    provider,
    timeoutMs,
  });
  const summary = summarizeEvaluation(rows);

  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, "ai-dialogue-samples.json");
  const mdPath = path.join(outDir, "ai-dialogue-samples.md");
  fs.writeFileSync(
    jsonPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        provider,
        model: process.env.BOTC_LLM_MODEL || "",
        endpoint: process.env.BOTC_LLM_ENDPOINT || "",
        summary,
        rows,
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  fs.writeFileSync(
    mdPath,
    `${buildEvaluationReport(rows, {
      replayPath: `${replayDir} + generated samples`,
      provider,
    })}\n`,
    "utf8"
  );
  console.log(JSON.stringify({ rows: rows.length, summary, jsonPath, mdPath }, null, 2));
}

await main();
