import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { advanceDayStage, createNewGame, openNominationWindow, runNight } from "./engine.js";
import {
  chooseAINomination,
  createNominationDebate,
  decideAIVoteWithRationale,
  initializeAI,
  runAIDiscussion,
  runAIProactiveWhispers,
  runPrivateWhisper,
} from "./ai.js";
import { renderSpeechWithLocalLLM } from "./ai_llm_renderer.js";
import { PLAYER_VISIBLE_FORBIDDEN_TERMS } from "./ai_speech_renderer.js";

const DEFAULT_REPLAY_PATH = path.resolve("output", "demo_replays", "latest.json");
const OUTPUT_DIR = path.resolve("output", "ai_llm_dialogue_eval");
const PLAYER_VISIBLE_FORBIDDEN_PATTERN = new RegExp(
  PLAYER_VISIBLE_FORBIDDEN_TERMS.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")
);

export const LLM_DIALOGUE_EVAL_RULES = [
  {
    id: "internal-reasoning-jargon",
    pattern: PLAYER_VISIBLE_FORBIDDEN_PATTERN,
    category: "wrong-identity",
    advice: "玩家可见发言不能带内部分析词；改成桌边能听懂的目标、理由和追问。",
  },
  {
    id: "system-jargon",
    pattern: /口径|证据线|接前面一句|JS Core|agentView|evidenceContract|undefined|NaN/i,
    category: "garbled-english-leak",
    advice: "去掉工程词和复盘词，改成桌边玩家短句。",
  },
  {
    id: "report-tone",
    pattern: /当前主线|可信度|污染风险|低证据|证据还薄|压力提名|自动提名|信息链|身份链|复核/i,
    category: "wrong-identity",
    advice: "避免像审计报告，改成“先听回应/这点对不上/今天先别定死”。",
  },
  {
    id: "awkward-transition",
    pattern: /简单讲，我现在是这么看|我尽量不绕|我会反问一句|下一句我会|先把我的判断摊开/i,
    category: "repeated-template",
    advice: "删掉空转过渡，直接给判断、原因和追问。",
  },
  {
    id: "hidden-leak-risk",
    pattern: /真实身份|邪恶互认|恶魔伪装|PRIVATE_SECRET_MARKER|bluff/i,
    category: "hidden-info-leak",
    advice: "公开或好人视角不能出现隐藏信息词。",
  },
  {
    id: "stitching-artifact",
    pattern: /你\s+这边|他\s+把|让他把这块|复…|[（(][^）)]*…|[0-9]+\s+号|。，|，。|。。|，，/i,
    category: "garbled-english-leak",
    advice: "清掉拼接痕迹和断裂空格，优先用具体座位号和一句自然追问。",
  },
  {
    id: "assistant-tone",
    pattern: /请在[0-9]+号中确认|以便我能够|做出恰当的回应|是否愿意|公聊提到：/i,
    category: "wrong-identity",
    advice: "避免像助手、问卷或复述记录，改成桌边玩家自己的判断句。",
  },
];

export const FAILURE_CATEGORY_LABELS = {
  "off-topic": "离题",
  "no-answer": "没回答问题",
  "repeated-template": "重复模板",
  "hidden-info-leak": "泄露隐藏信息",
  "garbled-english-leak": "乱码/英文泄漏",
  "too-long": "过长",
  "logic-contradiction": "逻辑矛盾",
  "wrong-identity": "不像当前身份",
};

function warning(rule, advice, category = "off-topic") {
  return { rule, category, advice };
}

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

function unsupportedDeathInfoDrift(text, payload = {}) {
  const value = oneLine(text);
  const source = oneLine([payload.candidateText, ...(payload.evidence ?? [])].join(" "));
  const deathClaim = /(?:昨晚|夜里|夜间|昨夜).{0,12}(?:死亡|死了|被杀|死在)|(?:死亡|死了|被杀|死在).{0,12}(?:这条线|解释|记录|昨晚|夜里|夜间|昨夜)/;
  const sourceDeath = /(?:昨晚|夜里|夜间|昨夜).{0,12}(?:死亡|死了|被杀|死在)|夜间死亡|死亡记录|被杀|死了|死在|死于/;
  return deathClaim.test(value) && !sourceDeath.test(source);
}

function repeatedTemplateIssue(text) {
  const value = oneLine(text);
  const repeatedPhrases = [
    "先听回应",
    "我先不定死",
    "这点过不去",
    "讲清楚",
    "先放一边",
  ];
  return repeatedPhrases.some((phrase) => {
    const first = value.indexOf(phrase);
    return first >= 0 && value.indexOf(phrase, first + phrase.length) >= 0;
  });
}

function englishOrGarbledLeak(text) {
  const value = oneLine(text);
  return /�|[A-Za-z_]{5,}|undefined|NaN|null/.test(value);
}

function wrongAudienceVoice(text, payload = {}) {
  const value = oneLine(text);
  if (payload.audience === "public" && /私下|只在我们之间|别公开|保密/.test(value)) return true;
  if (payload.audience === "private" && /全桌|公开投|大家都|台面/.test(value)) return true;
  return false;
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

function playerPersona(state, id) {
  return state.players?.find((entry) => entry.id === id)?.aiPersona ?? "steady";
}

function defaultForbiddenTerms() {
  return ["PRIVATE_SECRET_MARKER", "真实身份", "恶魔伪装", "邪恶互认", ...PLAYER_VISIBLE_FORBIDDEN_TERMS];
}

function pushPayload(payloads, payload) {
  if (!payload?.candidateText) return;
  payloads.push(payload);
}

function addUniquePayload(payloads, seen, payload) {
  const candidateText = oneLine(payload?.candidateText);
  if (!candidateText) return;
  const key = [payload.speakerName, payload.audience, payload.intent, candidateText].join("|");
  if (seen.has(key)) return;
  seen.add(key);
  payloads.push({ ...payload, candidateText });
}

function inferAudience(row) {
  const mode = `${row.mode ?? ""}`.toLowerCase();
  if (row.private || mode.includes("whisper") || mode.includes("private")) return "private";
  if (mode.includes("nomination")) return "nomination";
  return "public";
}

function humanSeatNameFromReplay(replay) {
  const human = (replay?.players ?? []).find((entry) => entry?.human || entry?.id === "human" || entry?.name === "你");
  if (!human) return "";
  const seat = Number(human.seat ?? human.seatIndex);
  return Number.isFinite(seat) ? `${seat}号` : "";
}

function targetForRow(row, options = {}) {
  const audience = options.audience ?? inferAudience(row);
  const raw = oneLine(row.focusName || row.targetName);
  if (raw === "你" && audience !== "private") {
    return options.humanSeatName || "";
  }
  return raw;
}

function privateHumanContextLabel(value) {
  const text = oneLine(value).replace(/\s+/g, "");
  return text === "你" || /^[0-9]+号[（(]你[）)]$/u.test(text);
}

function textForRow(row) {
  return oneLine(row.line ?? row.text);
}

function isHumanSpeakerRow(row) {
  const speakerName = oneLine(row.speakerName || row.speaker || row.playerName);
  const speakerId = oneLine(row.speakerId || row.playerId);
  return speakerName === "你" || speakerId === "human";
}

function payloadFromReplayRow(row, index, sourceKind = "replay", options = {}) {
  const candidateText = textForRow(row);
  const audience = inferAudience(row);
  const targetName = targetForRow(row, { ...options, audience });
  const requiredTargetName = audience === "private" && privateHumanContextLabel(targetName) ? "" : targetName;
  return {
    id: `${sourceKind}-${row.index ?? index}`,
    sourceKind,
    speakerName: oneLine(row.speakerName || row.speaker || row.playerName),
    targetName,
    audience,
    intent: audience === "nomination" ? "nomination_reason" : audience === "public" ? "public_table_talk" : "private_reply",
    persona: row.persona ?? "steady",
    candidateText,
    evidence: unique(row.evidenceSummaries ?? row.evidence ?? []).slice(0, 3),
    requiredTerms: requiredTargetName ? [requiredTargetName] : [],
    forbiddenTerms: defaultForbiddenTerms(),
    maxChars: audience === "public" ? 130 : audience === "nomination" ? 150 : 170,
  };
}

export function buildEvaluationPayloadsFromReplay(replay, options = {}) {
  const limit = Number(options.limit ?? 50) || 50;
  const speeches = replay?.dialogue?.speeches ?? [];
  const timeline = replay?.dialogue?.timeline ?? [];
  const replayContext = { humanSeatName: humanSeatNameFromReplay(replay) };
  const speechRows = speeches
    .filter((entry) => textForRow(entry) && entry.playerId && !isHumanSpeakerRow(entry))
    .map((entry, index) => payloadFromReplayRow(entry, index, "speech", replayContext));
  const timelineRows = timeline
    .filter((entry) => textForRow(entry) && entry.speakerId && entry.mode !== "whisper-out" && entry.mode !== "ai-private" && !isHumanSpeakerRow(entry))
    .map((entry, index) => payloadFromReplayRow(entry, index, "timeline", replayContext));

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

export function buildSampleEvaluationPayloads(options = {}) {
  const seed = Number(options.seed ?? 2026051402) || 2026051402;
  const rng = fixedRng(seed);
  const state = createNewGame(
    {
      scriptId: options.scriptId ?? "tb",
      playerCount: Number(options.playerCount ?? 9) || 9,
      preferredHumanRoleId: options.role ?? "washerwoman",
    },
    rng
  );
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
  const proactiveOffers = options.includeCoverage
    ? runAIProactiveWhispers(state, rng, { queueOnly: true })
    : [];
  advanceDayStage(state, "public");
  const before = state.events.speeches.length;
  runAIDiscussion(state, rng);
  const publicRows = state.events.speeches.slice(before).filter((entry) => !entry.private);

  const sampleIdPrefix = oneLine(options.idPrefix || `sample-${seed}-${options.role ?? "washerwoman"}`);
  const payloads = [
    {
      id: `${sampleIdPrefix}-private`,
      sourceKind: "sample",
      speakerName: playerName(state, target.id),
      targetName: playerName(state, privateResult.focusId),
      audience: "private",
      intent: "private_reply",
      persona: target.aiPersona ?? "steady",
      candidateText: privateResult.response,
      evidence: privateResult.evidenceContract?.summaries ?? [],
      requiredTerms: privateResult.focusId ? [playerName(state, privateResult.focusId)] : [],
      forbiddenTerms: defaultForbiddenTerms(),
      maxChars: 170,
    },
    ...publicRows.slice(0, 6).map((entry, index) => ({
      id: `${sampleIdPrefix}-public-${index}`,
      sourceKind: "sample",
      speakerName: playerName(state, entry.playerId),
      targetName: playerName(state, entry.focusId),
      audience: "public",
      intent: "public_table_talk",
      persona: state.players.find((player) => player.id === entry.playerId)?.aiPersona ?? "steady",
      candidateText: entry.line,
      evidence: entry.evidenceContract?.summaries ?? [],
      requiredTerms: entry.focusId ? [playerName(state, entry.focusId)] : [],
      forbiddenTerms: defaultForbiddenTerms(),
      maxChars: 130,
    })),
  ].filter((entry) => entry.candidateText);

  if (!options.includeCoverage) return payloads;

  proactiveOffers.slice(0, 2).forEach((offer, index) => {
    pushPayload(payloads, {
      id: `${sampleIdPrefix}-proactive-private-${index}`,
      sourceKind: "sample-proactive-private",
      speakerName: playerName(state, offer.playerId),
      targetName: playerName(state, offer.focusId),
      audience: "private",
      intent: "proactive_private",
      persona: playerPersona(state, offer.playerId),
      candidateText: offer.reason,
      evidence: [],
      requiredTerms: offer.focusId ? [playerName(state, offer.focusId)].filter(Boolean) : [],
      forbiddenTerms: defaultForbiddenTerms(),
      maxChars: 150,
    });
  });

  advanceDayStage(state, "nomination");
  openNominationWindow(state, { ticks: 4, intent: "eval" });
  const proposal = chooseAINomination(state);
  const nominatorId = proposal?.nominatorId ?? "";
  const nomineeId = proposal?.nomineeId ?? "";
  if (nominatorId && nomineeId) {
    const nomineeName = playerName(state, nomineeId);
    pushPayload(payloads, {
      id: `${sampleIdPrefix}-nomination-reason`,
      sourceKind: "sample-nomination",
      speakerName: playerName(state, nominatorId),
      targetName: nomineeName,
      audience: "nomination",
      intent: "nomination_reason",
      persona: playerPersona(state, nominatorId),
      candidateText: proposal.reason,
      evidence: proposal.evidenceSummary ? [proposal.evidenceSummary] : [],
      requiredTerms: nomineeName ? [nomineeName] : [],
      forbiddenTerms: defaultForbiddenTerms(),
      maxChars: 170,
    });

    const debateResult = createNominationDebate(
      state,
      {
        nominatorId,
        nomineeId,
        reason: proposal.reason,
        source: "eval",
        decisionRationale: proposal.decisionRationale ?? null,
        strategyRationale: proposal.strategyRationale ?? null,
      },
      rng
    );
    const debate = debateResult?.debate;
    (debate?.lines ?? []).forEach((line, index) => {
      const speaker = state.players.find((player) => player.id === line.speakerId);
      if (!speaker || speaker.isHuman || line.pending) return;
      const targetId = line.role === "nominee" ? nominatorId : nomineeId;
      const targetName = playerName(state, targetId);
      pushPayload(payloads, {
        id: `${sampleIdPrefix}-nomination-debate-${index}`,
        sourceKind: "sample-nomination-debate",
        speakerName: playerName(state, line.speakerId),
        targetName,
        audience: "nomination",
        intent: line.role === "nominee" ? "nomination_defense" : "nomination_attack",
        persona: playerPersona(state, line.speakerId),
        candidateText: line.text,
        evidence: proposal.evidenceSummary ? [proposal.evidenceSummary] : [],
        requiredTerms: targetName ? [targetName] : [],
        forbiddenTerms: defaultForbiddenTerms(),
        maxChars: 170,
      });
    });

    const nominee = state.players.find((player) => player.id === nomineeId);
    state.players
      .filter((player) => player && !player.isHuman && player.id !== nomineeId)
      .slice(0, 4)
      .forEach((voter, index) => {
        const decision = decideAIVoteWithRationale(voter, nominee, state, rng);
        pushPayload(payloads, {
          id: `${sampleIdPrefix}-vote-${index}`,
          sourceKind: "sample-vote",
          speakerName: playerName(state, voter.id),
          targetName: nomineeName,
          audience: "nomination",
          intent: "vote_reason",
          persona: playerPersona(state, voter.id),
          candidateText: decision.voteRationale?.line,
          evidence: [],
          requiredTerms: nomineeName ? [nomineeName] : [],
          forbiddenTerms: defaultForbiddenTerms(),
          maxChars: 150,
        });
      });
  }

  return payloads;
}

export function buildSampleEvaluationPayloadBatch(options = {}) {
  const limit = Number(options.limit ?? 50) || 50;
  const seedBase = Number(options.seed ?? 2026051402) || 2026051402;
  const sampleRoles = options.roles ?? ["washerwoman", "fortune-teller", "slayer", "undertaker", "empath", "ravenkeeper"];
  const payloads = [];
  const seen = new Set();
  let batch = 0;
  while (payloads.length < limit && batch < Math.max(12, limit)) {
    const role = sampleRoles[batch % sampleRoles.length];
    const seed = seedBase + batch * 101;
    for (const payload of buildSampleEvaluationPayloads({
      ...options,
      seed,
      role,
      includeCoverage: true,
      idPrefix: `sample-${batch}-${role}`,
    })) {
      addUniquePayload(payloads, seen, payload);
      if (payloads.length >= limit) break;
    }
    batch += 1;
  }
  return payloads.slice(0, limit);
}

export function inspectDialogueText(text, payload = {}) {
  const value = oneLine(text);
  const warnings = [];
  if (!value) {
    warnings.push(warning("empty", "发言不能为空。", "no-answer"));
  }
  LLM_DIALOGUE_EVAL_RULES.forEach((rule) => {
    if (rule.pattern.test(value)) warnings.push(warning(rule.id, rule.advice, rule.category));
  });
  if (unsupportedDeathInfoDrift(value, payload)) {
    warnings.push(warning(
      "unsupported-death-info",
      "不要把普通昨晚信息改成死亡事实；没有死亡记录时只能说身份/昨晚信息还要解释。",
      "logic-contradiction"
    ));
  }
  if (repeatedTemplateIssue(value)) {
    warnings.push(warning("repeated-template", "同一句模板重复出现；保留一个判断，再给一个具体追问。", "repeated-template"));
  }
  if (englishOrGarbledLeak(value)) {
    warnings.push(warning("english-or-garbled-leak", "不要出现英文工程词、乱码、undefined/NaN/null。", "garbled-english-leak"));
  }
  if (wrongAudienceVoice(value, payload)) {
    warnings.push(warning("wrong-audience-voice", "发言频道和语气不一致；公聊不要像私聊，私聊不要像全桌发言。", "wrong-identity"));
  }
  const missing = unique(payload.requiredTerms).find((term) => !value.includes(term));
  if (missing) {
    warnings.push(warning("missing-required-term", `缺少必须保留的目标词：${missing}`, "no-answer"));
  }
  const maxChars = payload.maxChars ?? (payload.audience === "public" ? 130 : 170);
  if (value.length > maxChars + 20) {
    warnings.push(warning("too-long", `当前 ${value.length} 字，建议压到 ${maxChars} 字以内。`, "too-long"));
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
      deterministicDraft: currentText,
      llmRendered: render.text,
      llmFinal: render.fallbackUsed ? "" : render.text,
      llmSource: render.source,
      llmFallbackUsed: render.fallbackUsed,
      llmReason: render.reason,
      fallbackReason: render.fallbackUsed ? render.reason : "",
      finalPlayerVisibleText: render.text,
      currentWarnings,
      llmWarnings,
      delta: currentWarnings.length - llmWarnings.length,
    });
  }
  return rows;
}

export function summarizeEvaluation(rows) {
  const failureCategories = {};
  rows.forEach((row) => {
    row.llmWarnings.forEach((entry) => {
      const category = entry.category ?? "off-topic";
      failureCategories[category] = (failureCategories[category] ?? 0) + 1;
    });
  });
  return {
    rows: rows.length,
    passedRows: rows.filter((row) => row.llmWarnings.length === 0).length,
    failedRows: rows.filter((row) => row.llmWarnings.length > 0).length,
    currentWarnings: rows.reduce((sum, row) => sum + row.currentWarnings.length, 0),
    llmWarnings: rows.reduce((sum, row) => sum + row.llmWarnings.length, 0),
    improvedRows: rows.filter((row) => row.delta > 0).length,
    worsenedRows: rows.filter((row) => row.delta < 0).length,
    fallbackRows: rows.filter((row) => row.llmFallbackUsed).length,
    failureCategories,
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
    `- Passed rows: ${summary.passedRows}`,
    `- Failed rows: ${summary.failedRows}`,
    `- Current warnings: ${summary.currentWarnings}`,
    `- LLM warnings: ${summary.llmWarnings}`,
    `- Improved rows: ${summary.improvedRows}`,
    `- Worsened rows: ${summary.worsenedRows}`,
    `- Fallback rows: ${summary.fallbackRows}`,
    "",
  ];
  const categoryEntries = Object.entries(summary.failureCategories ?? {});
  if (categoryEntries.length > 0) {
    lines.push("## Failure Categories", "");
    categoryEntries
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .forEach(([category, count]) => {
        lines.push(`- ${FAILURE_CATEGORY_LABELS[category] ?? category}: ${count}`);
      });
    lines.push("");
  }

  rows.forEach((row, index) => {
    lines.push(`## ${index + 1}. ${row.speakerName || "未知"} · ${row.audience} · ${row.intent || "speech"}`, "");
    if (row.targetName) lines.push(`Target: ${row.targetName}`, "");
    lines.push("Deterministic draft:", "", `> ${row.deterministicDraft ?? row.currentLocal}`, "");
    lines.push("LLM final:", "", `> ${row.llmFinal || "(fallback used)"}`, "");
    lines.push(`Fallback reason: ${row.fallbackReason || "none"}`, "");
    lines.push("Final player-visible text:", "", `> ${row.finalPlayerVisibleText ?? row.llmRendered}`, "");
    if (row.currentWarnings.length > 0 || row.llmWarnings.length > 0) {
      lines.push("Warnings:");
      row.currentWarnings.forEach((warning) => lines.push(`- current \`${warning.category ?? "off-topic"}:${warning.rule}\`: ${warning.advice}`));
      row.llmWarnings.forEach((warning) => lines.push(`- final \`${warning.category ?? "off-topic"}:${warning.rule}\`: ${warning.advice}`));
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
  const limit = Number(argValue("--limit", "50")) || 50;
  let payloads = useSample
    ? buildSampleEvaluationPayloadBatch({ limit })
    : buildEvaluationPayloadsFromReplay(readJson(replayPath), { limit });
  if (payloads.length === 0) {
    payloads = buildSampleEvaluationPayloadBatch({ limit });
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
    `Rows ${summary.rows}; passed ${summary.passedRows}; failed ${summary.failedRows}; current warnings ${summary.currentWarnings}; final warnings ${summary.llmWarnings}; fallback ${summary.fallbackRows}.`
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
