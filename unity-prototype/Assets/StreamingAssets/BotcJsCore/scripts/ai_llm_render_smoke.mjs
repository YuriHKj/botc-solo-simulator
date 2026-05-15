import fs from "node:fs";
import path from "node:path";

import { advanceDayStage, createNewGame, runNight } from "./engine.js";
import { initializeAI, runAIDiscussion, runPrivateWhisper } from "./ai.js";
import { renderSpeechWithLocalLLM, resolveLLMRendererConfig } from "./ai_llm_renderer.js";

const OUTPUT_DIR = path.resolve("output", "ai_llm_render_smoke");
const USE_MOCK = process.argv.includes("--mock");
const USE_LIVE = process.argv.includes("--live");

function fixedRng(seed = 987654321) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function makeState() {
  const rng = fixedRng(2026051401);
  const state = createNewGame({ scriptId: "tb", playerCount: 9, preferredHumanRoleId: "washerwoman" }, rng);
  initializeAI(state);
  runNight(state, rng);
  return { state, rng };
}

function playerName(state, id) {
  const player = state.players.find((entry) => entry.id === id);
  return player ? `${player.seatIndex + 1}号` : "";
}

function sampleLines() {
  const { state, rng } = makeState();
  const target = state.players.find((player) => !player.isHuman && player.alive && player.team === "good");
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
  const publicSpeech = state.events.speeches.slice(before).find((entry) => !entry.private && entry.focusId);

  return [
    {
      label: "private-reason",
      speakerName: playerName(state, target.id),
      targetName: playerName(state, privateResult.focusId),
      audience: "private",
      intent: "reason",
      persona: target.aiPersona ?? "steady",
      candidateText: privateResult.response,
      evidence: privateResult.evidenceContract?.summaries ?? [],
      requiredTerms: privateResult.focusId ? [playerName(state, privateResult.focusId)] : [],
      forbiddenTerms: ["PRIVATE_SECRET_MARKER", "真实身份", "恶魔伪装"],
      maxChars: 150,
    },
    {
      label: "public-pressure",
      speakerName: playerName(state, publicSpeech?.playerId),
      targetName: playerName(state, publicSpeech?.focusId),
      audience: "public",
      intent: "pressure_question",
      persona: state.players.find((entry) => entry.id === publicSpeech?.playerId)?.aiPersona ?? "steady",
      candidateText: publicSpeech?.line ?? "",
      evidence: publicSpeech?.evidenceContract?.summaries ?? [],
      requiredTerms: publicSpeech?.focusId ? [playerName(state, publicSpeech.focusId)] : [],
      forbiddenTerms: ["PRIVATE_SECRET_MARKER", "真实身份", "恶魔伪装"],
      maxChars: 130,
    },
  ].filter((entry) => entry.candidateText);
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const provider = USE_MOCK ? "mock" : process.env.BOTC_LLM_PROVIDER;
  const enabled = USE_MOCK || USE_LIVE || process.env.BOTC_LLM_RENDERER === "1";
  const config = resolveLLMRendererConfig({
    enabled,
    provider,
    timeoutMs: Number(process.env.BOTC_LLM_TIMEOUT_MS ?? 1400),
  });
  const rows = [];
  for (const payload of sampleLines()) {
    const result = await renderSpeechWithLocalLLM(payload, {
      enabled,
      provider: config.provider,
      endpoint: config.endpoint,
      model: config.model,
      timeoutMs: config.timeoutMs,
    });
    rows.push({ payload, result });
  }

  const report = [
    "# AI LLM Render Smoke",
    "",
    `enabled: ${enabled}`,
    `provider: ${config.provider}`,
    `endpoint: ${config.endpoint || "-"}`,
    `model: ${config.model || "-"}`,
    `generatedAt: ${new Date().toISOString()}`,
    "",
    ...rows.flatMap(({ payload, result }) => [
      `## ${payload.label}`,
      "",
      `speaker: ${payload.speakerName}`,
      `target: ${payload.targetName}`,
      `source: ${result.source}`,
      `ok: ${result.ok}`,
      `fallbackUsed: ${result.fallbackUsed}`,
      `retryUsed: ${result.retryUsed}`,
      `nearCopy: ${result.nearCopy}`,
      `similarity: ${Number.isFinite(result.similarity) ? result.similarity.toFixed(3) : "-"}`,
      `reason: ${result.reason || "-"}`,
      "",
      "candidate:",
      "",
      `> ${payload.candidateText}`,
      "",
      "rendered:",
      "",
      `> ${result.text}`,
      "",
    ]),
  ].join("\n");

  const outputPath = path.join(OUTPUT_DIR, "latest.md");
  fs.writeFileSync(outputPath, `${report}\n`, "utf8");
  console.log(`AI LLM render smoke report: ${outputPath}`);
  rows.forEach(({ payload, result }) => {
    console.log(`${payload.label}: ${result.ok ? "llm" : "fallback"} (${result.reason || result.source})`);
  });
}

await main();
