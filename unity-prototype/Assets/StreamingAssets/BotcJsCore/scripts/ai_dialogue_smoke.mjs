import fs from "node:fs";
import path from "node:path";

import { advanceDayStage, createNewGame, runNight } from "./engine.js";
import {
  chooseAINomination,
  initializeAI,
  runAIDiscussion,
  runAIToAIPrivateWhispers,
  runPrivateWhisper,
} from "./ai.js";

const OUTPUT_DIR = path.resolve("output", "ai_dialogue_smoke");
const STRICT = process.argv.includes("--strict");

function fixedRng(seed = 987654321) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function makeTBState(seed, options = {}) {
  const rng = fixedRng(seed);
  const state = createNewGame(
    {
      scriptId: "tb",
      playerCount: options.playerCount ?? 9,
      preferredHumanRoleId: options.preferredHumanRoleId ?? "washerwoman",
    },
    rng
  );
  initializeAI(state);
  runNight(state, rng);
  return { state, rng };
}

function seat(player) {
  return player ? `${player.seatIndex + 1}号` : "未知";
}

function seatFromName(name) {
  return /^\d+号$/.test(`${name ?? ""}`) ? name : "未知";
}

function oneLine(text) {
  return `${text ?? ""}`.replace(/\s+/g, " ").trim();
}

function pickAITarget(state, predicate = () => true) {
  return state.players.find((player) => !player.isHuman && player.alive && predicate(player));
}

function collectPrivateFollowUpScenario() {
  const { state, rng } = makeTBState(2026051101);
  const target = pickAITarget(state, (player) => player.team === "good") ?? pickAITarget(state);
  const outputs = [];

  [
    { humanLine: "你是什么身份？", intentHint: "claim" },
    { humanLine: "你刚才说的这条线，为什么怀疑他？", intentHint: "reason" },
    { humanLine: "如果要投票，你会怎么站？", intentHint: "vote" },
  ].forEach((input) => {
    const result = runPrivateWhisper(state, { targetId: target.id, ...input }, rng);
    outputs.push({
      speaker: target.name,
      speakerId: target.id,
      seat: seat(target),
      audience: "private",
      prompt: input.humanLine,
      text: result.ok ? result.response : result.reason,
      ok: result.ok,
      focusId: result.focusId ?? null,
    });
  });

  return {
    title: `连续私聊承接：你 -> ${seat(target)}`,
    description: "检查身份口径、追问承接、投票态度是否像一段连续聊天。",
    outputs,
  };
}

function collectFocusSwitchScenario() {
  const { state, rng } = makeTBState(2026051102);
  const target = pickAITarget(state, (player) => player.team === "good") ?? pickAITarget(state);
  const candidates = state.players.filter((player) => !player.isHuman && player.id !== target.id).slice(0, 2);
  const firstName = candidates[0]?.name ?? "2号";
  const secondName = candidates[1]?.name ?? "5号";
  const outputs = [];

  [
    { humanLine: `你怎么看${firstName}？`, intentHint: "reason" },
    { humanLine: `那${secondName}呢？不要空泛，给一句判断。`, intentHint: "compare" },
  ].forEach((input) => {
    const result = runPrivateWhisper(state, { targetId: target.id, ...input }, rng);
    outputs.push({
      speaker: target.name,
      speakerId: target.id,
      seat: seat(target),
      audience: "private",
      prompt: input.humanLine,
      text: result.ok ? result.response : result.reason,
      ok: result.ok,
      focusId: result.focusId ?? null,
    });
  });

  return {
    title: `明确换焦点：你 -> ${seat(target)}`,
    description: "检查 AI 被问到新目标时是否解释转向，而不是像忘了上一句。",
    outputs,
  };
}

function collectDirectPushbackScenario() {
  const { state, rng } = makeTBState(2026051207);
  const target = pickAITarget(state, (player) => player.team === "good") ?? pickAITarget(state);
  const suspect =
    state.players.find((player) => !player.isHuman && player.id !== target.id && player.alive) ?? target;
  const first = runPrivateWhisper(
    state,
    {
      targetId: target.id,
      humanLine: `你怎么看${seat(suspect)}？`,
      intentHint: "reason",
    },
    rng
  );
  const second = runPrivateWhisper(
    state,
    {
      targetId: target.id,
      humanLine: `别绕，直接说，为什么还是看${seat(suspect)}？`,
      intentHint: "reason",
    },
    rng
  );

  return {
    title: `玩家追问压迫感：你 -> ${seat(target)}`,
    description: "检查 AI 是否先接住玩家的“别绕/直接说”，再继续给判断。",
    outputs: [
      {
        speaker: target.name,
        speakerId: target.id,
        seat: seat(target),
        audience: "private",
        prompt: "先问判断",
        text: first.ok ? first.response : first.reason,
        ok: first.ok,
        focusId: first.focusId ?? null,
      },
      {
        speaker: target.name,
        speakerId: target.id,
        seat: seat(target),
        audience: "private",
        prompt: "别绕，直接说",
        text: second.ok ? second.response : second.reason,
        ok: second.ok,
        focusId: second.focusId ?? null,
      },
    ],
  };
}

function collectPublicDiscussionScenario() {
  const { state, rng } = makeTBState(2026051103);
  advanceDayStage(state, "public");
  const before = state.events.speeches.length;
  runAIDiscussion(state, rng);
  runAIDiscussion(state, rng);
  const outputs = state.events.speeches
    .slice(before)
    .filter((entry) => !entry.private)
    .slice(0, 8)
    .map((entry) => {
      const speaker = state.players.find((player) => player.id === entry.playerId);
      return {
        speaker: speaker?.name ?? entry.playerId,
        speakerId: entry.playerId,
        seat: seat(speaker),
        audience: "public",
        prompt: "公聊发言",
        text: entry.line,
        ok: true,
        focusId: entry.focusId ?? null,
      };
    });

  return {
    title: "公聊两轮样本",
    description: "检查公开发言是否简短、接地气，并且不泄漏私聊原文。",
    outputs,
  };
}

function collectAIToAIScenario() {
  const { state, rng } = makeTBState(2026051104);
  const messages = runAIToAIPrivateWhispers(state, rng).slice(0, 4);
  const outputs = messages.map((entry) => {
    const speaker = state.players.find((player) => player.id === entry.speakerId);
    const target = state.players.find((player) => player.id === entry.targetId);
    return {
      speaker: entry.speakerName,
      speakerId: entry.speakerId,
      seat: seatFromName(entry.speakerName),
      audience: "ai-private",
      prompt: `${seatFromName(entry.speakerName)} -> ${seatFromName(entry.targetName)}`,
      text: entry.response,
      ok: true,
      focusId: entry.focusId ?? null,
      allowHiddenTruth: speaker?.team === "evil" && target?.team === "evil",
    };
  });

  return {
    title: "AI-AI 私聊样本",
    description: "检查 AI 之间的信息交换是否像私下串线，而不是复盘摘要。",
    outputs,
  };
}

function collectEvilPerformanceScenario() {
  const { state, rng } = makeTBState(2026051105);
  const target = pickAITarget(state, (player) => player.team === "evil") ?? pickAITarget(state);
  const outputs = [];
  [
    { humanLine: "你是什么身份？先给我一个能对外说的口径。", intentHint: "claim" },
    { humanLine: "你觉得今天谁最该被推？", intentHint: "suspect" },
  ].forEach((input) => {
    const result = runPrivateWhisper(state, { targetId: target.id, ...input }, rng);
    outputs.push({
      speaker: target.name,
      speakerId: target.id,
      seat: seat(target),
      audience: "private",
      prompt: input.humanLine,
      text: result.ok ? result.response : result.reason,
      ok: result.ok,
      focusId: result.focusId ?? null,
    });
  });

  return {
    title: `邪恶方表演：你 -> ${seat(target)}`,
    description: "检查邪恶 AI 是否能构造好人视角口径，同时不漏真实阵营。",
    outputs,
  };
}

function collectNominationScenario() {
  const { state, rng } = makeTBState(2026051106);
  advanceDayStage(state, "public");
  runAIDiscussion(state, rng);
  advanceDayStage(state, "nomination");
  const proposal = chooseAINomination(state);
  const nominator = state.players.find((player) => player.id === proposal?.nominatorId);
  const nominee = state.players.find((player) => player.id === proposal?.nomineeId);
  const outputs = [
    {
      speaker: nominator?.name ?? "无提名者",
      speakerId: proposal?.nominatorId ?? "",
      seat: seat(nominator),
      audience: "nomination",
      prompt: nominee ? `提名 ${seat(nominee)}` : "无提名",
      text: proposal?.reason ?? "本局面没有生成 AI 提名。",
      ok: !!proposal,
      focusId: proposal?.nomineeId ?? null,
    },
  ];

  return {
    title: "提名理由样本",
    description: "检查提名理由是否像桌上发言，而不是内部评分报告。",
    outputs,
  };
}

const BAD_TASTE_RULES = [
  { id: "debug-layering", pattern: /分两层看|核心还是|证据线|证据摘要|evidence|contract|agent|JS Core/i, advice: "去掉工程/审计口吻，改成桌边短句。" },
  { id: "table-jargon", pattern: /口径|无理由改口|身份说法|可复核|信息来源|交叉验证|身份范围|身份链|裸跳|摊开|硬信息|当前主线|可信度|污染风险/i, advice: "把复盘/魔典整理词换成玩家会顺口说出的身份、昨晚信息、能对上、直接跳身份等表达。" },
  { id: "numeric-label", pattern: /暂时偏清白|高度可疑|低信息量位置|怀疑度\s*\d+%|\d+%\s*vs/i, advice: "不要把 UI/评分标签直接说出口。" },
  { id: "private-leak-style", pattern: /我私下听到的口径把焦点指向|私聊原文|未参与私聊/i, advice: "私聊影响只能模糊表达为有人提到/有人私下说过，不能复述原文。" },
  { id: "report-tone", pattern: /本轮|当前主线|低证据提名|压力提名|自动提名|可信度|污染风险/i, advice: "把复盘报告词改成玩家发言词。" },
  { id: "stock-ending", pattern: /一句结论更值钱|问出反应比|先看票型和回应。?$/i, advice: "尾句需要更短、更像临场补一句。" },
  { id: "hidden-truth-risk", pattern: /真实身份|邪恶互认|恶魔伪装|爪牙|魔典|bluff/i, advice: "确认是否只出现在邪恶私聊；公开或好人视角必须禁用。" },
  { id: "nested-prompt", pattern: /你能把\s*让他|把\s*让他|让他把.*讲清楚|信息链是：?\[/i, advice: "不要把内部追问指令或原始夜间日志直接塞进成句模板。" },
  { id: "abstract-subject", pattern: /该玩家|当前目标|这个位置(?=.*(行为|信息|口径))/i, advice: "把抽象主体换成具体座位，避免像系统摘要。" },
  { id: "empty-transition", pattern: /简单讲，我现在是这么看|我尽量不绕，先把我的判断摊开/i, advice: "删除空转过渡句，直接说判断和原因。" },
  { id: "future-script", pattern: /下一句我会|我会问\s*\d+号|票前我会问/i, advice: "不要把内部下一步计划说成脚本，改成“接下来先问 X”。" },
  { id: "cleanup-remnant", pattern: /先复核|先再对一下|…（先对一下）|\s他\s回应/i, advice: "去掉整理残留和断裂空格，改成自然短句。" },
];

function sentenceCount(text) {
  const matches = oneLine(text).match(/[^。！？；.!?;]+[。！？；.!?;]?/g);
  return matches?.filter((entry) => entry.trim()).length ?? 0;
}

function inspectOutput(output) {
  const text = oneLine(output.text);
  const warnings = [];
  BAD_TASTE_RULES.forEach((rule) => {
    if (rule.id === "hidden-truth-risk" && output.allowHiddenTruth) {
      return;
    }
    if (rule.pattern.test(text)) {
      warnings.push({ rule: rule.id, advice: rule.advice });
    }
  });
  if (
    output.audience === "public" &&
    /你\s+我|你\s+这条|你\s+可以进提名池|看\s+你\s+的解释|围着\s+你\s+打/i.test(text)
  ) {
    warnings.push({
      rule: "public-splice",
      advice: "公聊不要把目标代词和第一人称判断硬拼在一起，改成座位号 + 判断 + 追问。",
    });
  }
  if (/低证据判断|信息链是|围着\s+你|围绕\s+你|围绕\s+\d+号\s+追问|你\s+这边先放进观察位|\bta\b/.test(text)) {
    warnings.push({
      rule: "mechanical-dialogue",
      advice: "把信息链/ta/围着你这类模板残留改成座位号和短玩家话。",
    });
  }
  if (output.audience === "private" && /\d+号，\s*你/.test(text)) {
    warnings.push({
      rule: "private-third-party-address",
      advice: "私聊里谈第三方时不要写成当面对第三方喊话，改成“让 X 号回应/把身份和信息补完整”。",
    });
  }
  if (/别绕|直接说/.test(output.prompt) && !/(直接答|接着刚才|先说清楚|直接说)/.test(text)) {
    warnings.push({
      rule: "missing-turn-taking",
      advice: "玩家要求直接回答时，AI 需要先接住这个对话动作，再给判断。",
    });
  }
  const limit = output.audience === "public" ? 115 : output.audience === "nomination" ? 120 : 170;
  if (text.length > limit) {
    warnings.push({
      rule: "too-long",
      advice: `${output.audience} 发言 ${text.length} 字，建议压到 ${limit} 字以内。`,
    });
  }
  const maxSentences =
    output.allowHiddenTruth && output.audience === "ai-private"
      ? 5
      : output.audience === "public"
      ? 2
      : output.audience === "nomination"
      ? 2
      : 3;
  if (sentenceCount(text) > maxSentences) {
    warnings.push({
      rule: "too-many-sentences",
      advice: `${output.audience} 发言句子偏多，建议拆成追问或下一轮再说。`,
    });
  }
  if (!output.allowHiddenTruth && (text.match(/我/g) ?? []).length >= 5) {
    warnings.push({ rule: "self-heavy", advice: "第一人称过密，可以换成目标行为或桌面信息开句。" });
  }
  return warnings;
}

function runScenarios() {
  return [
    collectPrivateFollowUpScenario(),
    collectFocusSwitchScenario(),
    collectDirectPushbackScenario(),
    collectPublicDiscussionScenario(),
    collectAIToAIScenario(),
    collectEvilPerformanceScenario(),
    collectNominationScenario(),
  ];
}

function buildReport(scenarios, generatedAt) {
  const allOutputs = scenarios.flatMap((scenario) =>
    scenario.outputs.map((output) => ({
      scenario: scenario.title,
      ...output,
      warnings: inspectOutput(output),
    }))
  );
  const warningCount = allOutputs.reduce((sum, output) => sum + output.warnings.length, 0);
  const riskyOutputs = allOutputs.filter((output) => output.warnings.length > 0);

  const lines = [
    "# AI Dialogue Smoke Report",
    "",
    `Generated: ${generatedAt}`,
    "",
    "## Summary",
    "",
    `- Scenarios: ${scenarios.length}`,
    `- Lines sampled: ${allOutputs.length}`,
    `- Warnings: ${warningCount}`,
    "",
    "## Warning Rules",
    "",
    ...BAD_TASTE_RULES.map((rule) => `- \`${rule.id}\`: ${rule.advice}`),
    "",
  ];

  scenarios.forEach((scenario) => {
    lines.push(`## ${scenario.title}`, "", scenario.description, "");
    scenario.outputs.forEach((output) => {
      const warnings = inspectOutput(output);
      lines.push(`### ${output.seat} · ${output.audience}`, "");
      lines.push(`**Prompt:** ${output.prompt}`, "");
      lines.push("> " + oneLine(output.text), "");
      if (warnings.length > 0) {
        lines.push("Warnings:");
        warnings.forEach((warning) => {
          lines.push(`- \`${warning.rule}\`: ${warning.advice}`);
        });
        lines.push("");
      }
    });
  });

  lines.push("## Next Fix Targets", "");
  if (riskyOutputs.length === 0) {
    lines.push("- No obvious bad-taste rule hit in this sample. Next step: add richer scenario fixtures.");
  } else {
    const grouped = new Map();
    riskyOutputs.forEach((output) => {
      output.warnings.forEach((warning) => {
        grouped.set(warning.rule, (grouped.get(warning.rule) ?? 0) + 1);
      });
    });
    [...grouped.entries()]
      .sort((a, b) => b[1] - a[1])
      .forEach(([rule, count]) => {
        lines.push(`- \`${rule}\`: ${count} hit(s)`);
      });
  }
  lines.push("");

  return {
    markdown: lines.join("\n"),
    data: {
      generatedAt,
      summary: {
        scenarios: scenarios.length,
        lines: allOutputs.length,
        warnings: warningCount,
      },
      outputs: allOutputs,
    },
  };
}

function main() {
  const generatedAt = new Date().toISOString();
  const scenarios = runScenarios();
  const report = buildReport(scenarios, generatedAt);
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const mdPath = path.join(OUTPUT_DIR, "latest.md");
  const jsonPath = path.join(OUTPUT_DIR, "latest.json");
  fs.writeFileSync(mdPath, report.markdown, "utf8");
  fs.writeFileSync(jsonPath, JSON.stringify(report.data, null, 2), "utf8");
  console.log(`AI dialogue smoke report: ${mdPath}`);
  console.log(`Sampled ${report.data.summary.lines} lines with ${report.data.summary.warnings} warning(s).`);
  if (STRICT && report.data.summary.warnings > 0) {
    process.exitCode = 1;
  }
}

main();
