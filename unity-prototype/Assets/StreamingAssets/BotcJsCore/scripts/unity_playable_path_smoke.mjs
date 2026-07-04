import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { processUnityActionFile as defaultProcessUnityActionFile } from "./unity_action_bridge.mjs";

let activeProcessUnityActionFile = defaultProcessUnityActionFile;

const DEFAULT_SCENARIOS = [
  { scriptId: "tb", roleId: "washerwoman", players: 9, seed: 20260607 },
  { scriptId: "tb", roleId: "librarian", players: 9, seed: 20260608 },
  { scriptId: "tb", roleId: "fortune-teller", players: 9, seed: 9014 },
  { scriptId: "tb", roleId: "empath", players: 9, seed: 20260609 },
  { scriptId: "tb", roleId: "slayer", players: 9, seed: 270001 },
  { scriptId: "tb", roleId: "soldier", players: 9, seed: 20260610 },
];

const REQUIRED_HUMAN_ROLE_IDS = ["washerwoman", "librarian", "fortune-teller", "empath", "slayer", "soldier"];
const REQUIRED_FLOW_NODE_IDS = [
  "first-night",
  "day-one-private",
  "day-one-public",
  "day-one-nomination",
  "day-one-vote",
  "second-night",
];

const PROTECTED_NIGHT_INFO_ROLES = new Set(["washerwoman", "librarian", "fortune-teller", "empath"]);
const INTERNAL_UI_TERMS = [
  "Timeline Rationale",
  "targetId",
  "evidence",
  "payload",
  "viewmodel",
  "JS Core",
  "roleId",
  "roleName",
  "personaLabel",
  "prompt",
  "response",
  "reason:",
  "cards:",
  "内部理由",
  "内部提示",
  "完整内容",
];

const FLOW_NODE_TITLES = {
  setup: "Setup",
  "first-night": "First night",
  "day-one-private": "Day 1 private chat",
  "day-one-public": "Day 1 public discussion",
  "day-one-nomination": "Day 1 nomination",
  "day-one-vote": "Day 1 vote",
  "second-night": "Second night",
  "day-two-loop": "Day 2 stable loop",
  endgame: "Endgame",
};

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
    const key = entry.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      values.set(key, next);
      index += 1;
    } else {
      flags.add(key);
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

function parseScenario(raw) {
  const [scriptId = "tb", roleId = "washerwoman", players = "9", seed = "20260607"] = `${raw ?? ""}`
    .split(":")
    .map((part) => part.trim());
  return {
    scriptId,
    roleId,
    players: Number(players) || 9,
    seed: Number(seed) || 20260607,
  };
}

function scenarioSlug(scenario) {
  return `${scenario.scriptId}-${scenario.roleId}-${scenario.players}p-${scenario.seed}`.replace(/[^\w.-]+/g, "-");
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeText(filePath, text) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${text}`, "utf8");
}

function copyIfExists(sourcePath, targetPath) {
  if (!fs.existsSync(sourcePath)) return "";
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
  return targetPath;
}

function slugPart(value) {
  return `${value ?? ""}`.trim().replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || "node";
}

function escapeXml(value) {
  return `${value ?? ""}`
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cleanLine(value, fallback = "") {
  return `${value ?? fallback}`.replace(/\s+/g, " ").trim();
}

function compactLines(lines, limit = 5) {
  return (lines ?? []).map((line) => cleanLine(line)).filter(Boolean).slice(0, limit);
}

function addIssue(issues, severity, code, message, details = {}) {
  const issue = { severity, code, message, details };
  issues.push(issue);
  return issue;
}

function blockingIssues(issues) {
  return issues.filter((issue) => issue.severity === "P0" || issue.severity === "P1");
}

function createHarness(scenario, outputRoot) {
  const root = path.resolve(outputRoot, scenarioSlug(scenario));
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(root, { recursive: true });
  return {
    root,
    nodesDir: path.join(root, "nodes"),
    nodeCounter: 0,
    statePath: path.join(root, "unity_state.json"),
    viewModelPath: path.join(root, "unity_viewmodel.json"),
    actionPath: path.join(root, "unity_action.json"),
    resultPath: path.join(root, "unity_action_result.json"),
  };
}

function persistedState(harness) {
  const persisted = fs.existsSync(harness.statePath) ? readJson(harness.statePath) : {};
  return persisted.state ?? persisted;
}

function writePersistedState(harness, state) {
  const persisted = fs.existsSync(harness.statePath) ? readJson(harness.statePath) : {};
  writeJson(harness.statePath, { ...persisted, state });
}

function latestResult(harness) {
  return fs.existsSync(harness.resultPath) ? readJson(harness.resultPath) : {};
}

function humanPlayerFromState(state) {
  return state?.players?.find((player) => player?.isHuman) ?? null;
}

function nodeIdFor(viewModel, state, traceEntry = {}) {
  if (viewModel?.gameOver === true || viewModel?.phase === "ended") return "endgame";
  if (viewModel?.phase === "night") {
    return Number(viewModel.night ?? state?.night ?? 0) >= 2 ? "second-night" : "first-night";
  }
  if (viewModel?.phase === "day" && Number(viewModel.day ?? state?.day ?? 0) >= 2) return "day-two-loop";
  if (viewModel?.phase === "day" && viewModel?.dayStage === "private") return "day-one-private";
  if (viewModel?.phase === "day" && viewModel?.dayStage === "public") return "day-one-public";
  if (viewModel?.phase === "day" && viewModel?.dayStage === "nomination") {
    const voteCount = state?.events?.votes?.length ?? 0;
    if (traceEntry?.type === "resolve-nomination-vote" || voteCount > 0) return "day-one-vote";
    return "day-one-nomination";
  }
  return "setup";
}

function summarizeViewModel(viewModel, state, traceEntry = {}) {
  const players = viewModel?.players ?? [];
  const human = players.find((player) => player?.human) ?? humanPlayerFromState(state) ?? {};
  const alive = players.filter((player) => player?.alive !== false).length;
  const pendingWhispers = viewModel?.pendingProactiveWhispers ?? [];
  const publicEntries = (viewModel?.timeline ?? []).filter((entry) => entry?.mode === "public");
  const privateEntries = (viewModel?.timeline ?? []).filter((entry) => `${entry?.mode ?? ""}`.includes("whisper"));
  return {
    phase: viewModel?.phase ?? "",
    dayStage: viewModel?.dayStage ?? "",
    day: viewModel?.day ?? state?.day ?? 0,
    night: viewModel?.night ?? state?.night ?? 0,
    human: {
      id: human.id ?? "",
      seat: human.seat ?? ((human.seatIndex ?? -1) + 1),
      name: human.name ?? "",
      roleId: human.roleId ?? "",
      roleName: human.roleName ?? "",
    },
    players: players.length,
    alive,
    dead: players.length - alive,
    pendingWhispers: pendingWhispers.map((offer) => ({
      id: offer.id ?? "",
      playerId: offer.playerId ?? "",
      playerSeat: offer.playerSeat ?? 0,
      publicIntent: offer.publicIntent ?? "",
      publicReason: offer.publicReason ?? "",
    })),
    privateInfo: compactLines(viewModel?.privateInfo ?? [], 4),
    publicTimelineCount: publicEntries.length,
    privateTimelineCount: privateEntries.length,
    nominationVotes: state?.events?.votes?.length ?? 0,
    executions: state?.events?.executions?.length ?? 0,
    lastAction: {
      type: traceEntry.type ?? "",
      ok: traceEntry.ok ?? true,
      message: traceEntry.message ?? "",
    },
  };
}

function evidenceSvg(summary, viewModel, nodeId) {
  const players = viewModel?.players ?? [];
  const rows = players.slice(0, 12).map((player, index) => {
    const col = index % 6;
    const row = Math.floor(index / 6);
    const x = 90 + col * 178;
    const y = 300 + row * 112;
    const fill = player.human ? "#7b4b1f" : player.alive === false ? "#2a2523" : "#342316";
    const role = player.revealed ? cleanLine(player.roleName, player.roleId) : "unknown";
    return [
      `<rect x="${x}" y="${y}" width="138" height="84" rx="8" fill="${fill}" stroke="#c99346" stroke-opacity="0.45"/>`,
      `<circle cx="${x + 28}" cy="${y + 32}" r="20" fill="#d8b66a" fill-opacity="0.28" stroke="#efd18b" stroke-opacity="0.62"/>`,
      `<text x="${x + 60}" y="${y + 27}" class="small strong">${escapeXml(player.name ?? player.id ?? "")}</text>`,
      `<text x="${x + 60}" y="${y + 48}" class="tiny">${escapeXml(role)}</text>`,
      `<text x="${x + 60}" y="${y + 68}" class="tiny muted">seat ${escapeXml(player.seat ?? "")}${player.alive === false ? " / dead" : ""}</text>`,
    ].join("");
  }).join("\n");
  const whispers = summary.pendingWhispers.length === 0
    ? ["No pending whispers"]
    : summary.pendingWhispers.map((offer) => `Seat ${offer.playerSeat || "?"}: ${offer.publicIntent || "wants to talk"}`);
  const privateInfo = summary.privateInfo.length === 0 ? ["No private info visible"] : summary.privateInfo;
  const infoLines = [
    `Node: ${FLOW_NODE_TITLES[nodeId] ?? nodeId}`,
    `Phase: ${summary.phase}/${summary.dayStage || "-"} D${summary.day} N${summary.night}`,
    `Human: seat ${summary.human.seat || "?"} ${summary.human.roleName || summary.human.roleId || "unknown"}`,
    `Players: ${summary.players} alive ${summary.alive} dead ${summary.dead}`,
    `Timeline: public ${summary.publicTimelineCount} private ${summary.privateTimelineCount}`,
  ];
  const textList = (list, x, y, className = "small") => list.map((line, index) =>
    `<text x="${x}" y="${y + index * 24}" class="${className}">${escapeXml(line)}</text>`
  ).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <style>
    .title { font: 700 30px Arial, sans-serif; fill: #f4d38a; }
    .small { font: 16px Arial, sans-serif; fill: #f5ead2; }
    .tiny { font: 13px Arial, sans-serif; fill: #f1dfbd; }
    .muted { fill: #cbb996; }
    .strong { font-weight: 700; }
  </style>
  <rect width="1280" height="720" fill="#120d0a"/>
  <rect x="28" y="24" width="1224" height="80" rx="10" fill="#28170d" stroke="#b9823e" stroke-opacity="0.45"/>
  <text x="54" y="74" class="title">BOTC Unity playable smoke</text>
  <text x="760" y="58" class="small">${escapeXml(FLOW_NODE_TITLES[nodeId] ?? nodeId)}</text>
  <text x="760" y="84" class="tiny muted">${escapeXml(scenarioNodeSubtitle(summary))}</text>
  <rect x="34" y="128" width="360" height="150" rx="10" fill="#20150f" stroke="#c99346" stroke-opacity="0.30"/>
  ${textList(infoLines, 58, 166)}
  <rect x="420" y="128" width="360" height="150" rx="10" fill="#171b1a" stroke="#8fb7b7" stroke-opacity="0.28"/>
  <text x="444" y="166" class="small strong">Private queue</text>
  ${textList(whispers.slice(0, 4), 444, 196, "tiny")}
  <rect x="806" y="128" width="420" height="150" rx="10" fill="#21170f" stroke="#c99346" stroke-opacity="0.30"/>
  <text x="830" y="166" class="small strong">Private info</text>
  ${textList(privateInfo.slice(0, 4), 830, 196, "tiny")}
  <rect x="34" y="286" width="1192" height="266" rx="10" fill="#170f0b" stroke="#c99346" stroke-opacity="0.22"/>
  ${rows}
  <rect x="34" y="580" width="1192" height="94" rx="10" fill="#1b120c" stroke="#c99346" stroke-opacity="0.24"/>
  <text x="58" y="622" class="small strong">Bottom safe layout</text>
  <text x="58" y="650" class="tiny muted">Action dock evidence is checked by Unity source contracts; this smoke keeps the bottom player row readable in node summaries.</text>
</svg>
`;
}

function scenarioNodeSubtitle(summary) {
  return `D${summary.day}/N${summary.night} ${summary.phase}${summary.dayStage ? `/${summary.dayStage}` : ""} last=${summary.lastAction.type || "none"}`;
}

function saveNodeEvidence(harness, label, viewModel, traceEntry = {}, options = {}) {
  const state = persistedState(harness);
  const nodeId = options.nodeId ?? nodeIdFor(viewModel, state, traceEntry);
  const index = String(++harness.nodeCounter).padStart(3, "0");
  const dir = path.join(harness.nodesDir, `${index}-${slugPart(label || nodeId)}`);
  fs.mkdirSync(dir, { recursive: true });
  copyIfExists(harness.statePath, path.join(dir, "unity_state.json"));
  copyIfExists(harness.viewModelPath, path.join(dir, "unity_viewmodel.json"));
  copyIfExists(harness.actionPath, path.join(dir, "unity_action.json"));
  copyIfExists(harness.resultPath, path.join(dir, "unity_action_result.json"));
  const summary = summarizeViewModel(viewModel, state, traceEntry);
  const nodeSummary = {
    nodeId,
    title: FLOW_NODE_TITLES[nodeId] ?? nodeId,
    label,
    summary,
    paths: {
      dir,
      state: path.join(dir, "unity_state.json"),
      viewModel: path.join(dir, "unity_viewmodel.json"),
      action: path.join(dir, "unity_action.json"),
      result: path.join(dir, "unity_action_result.json"),
      screenshot: path.join(dir, "screen.svg"),
    },
  };
  writeJson(path.join(dir, "node_summary.json"), nodeSummary);
  writeText(path.join(dir, "screen.svg"), evidenceSvg(summary, viewModel, nodeId));
  return nodeSummary;
}

function submitAction(harness, scenario, type, payload = {}, trace = []) {
  const action = {
    id: `${type}-${Date.now()}-${process.pid}-${trace.length}`,
    type,
    payload,
    createdAt: new Date().toISOString(),
  };
  writeJson(harness.actionPath, action);
  const processed = activeProcessUnityActionFile({
    statePath: harness.statePath,
    viewModelPath: harness.viewModelPath,
    actionPath: harness.actionPath,
    resultPath: harness.resultPath,
    scriptId: scenario.scriptId,
    playerCount: scenario.players,
    preferredHumanRoleId: scenario.roleId,
    seed: scenario.seed,
    disableReplayRecorder: true,
  });
  trace.push({
    type,
    payload,
    ok: processed.result.ok !== false,
    message: processed.result.message ?? processed.result.reason ?? "",
    speechId: processed.result.speechId ?? processed.result.speech?.id ?? "",
    speakerId: processed.result.speakerId ?? processed.result.speech?.playerId ?? "",
    phase: processed.viewModel.phase,
    dayStage: processed.viewModel.dayStage ?? "",
    day: processed.viewModel.day,
    night: processed.viewModel.night,
    gameOver: processed.viewModel.gameOver === true,
    lastActionType: processed.viewModel.action?.lastActionType ?? "",
    stoppedAt: processed.viewModel.action?.autoAdvance?.stoppedAt ?? "",
  });
  assert.equal(
    processed.result.ok,
    true,
    `${scenario.scriptId}/${scenario.roleId}: ${type} failed: ${processed.result.reason ?? processed.result.message ?? ""}`
  );
  return processed.viewModel;
}

function targetCountFor(action) {
  const min = Math.max(0, Number(action?.minTargetCount ?? action?.targetCount ?? 0) || 0);
  const max = Math.max(min, Number(action?.maxTargetCount ?? action?.targetCount ?? min) || min);
  return { min, max };
}

function roleIdFor(action, fallback = "") {
  if (fallback && (action?.roleOptions ?? []).some((role) => role.id === fallback)) {
    return fallback;
  }
  return action?.roleOptions?.find((role) => role.id)?.id ?? "";
}

function rankedOptions(action) {
  const options = action?.options ?? [];
  if (action?.roleId && ["imp", "fang-gu", "vigormortis", "no-dashii", "vortox", "zombuul", "pukka", "shabaloth", "po"].includes(action.roleId)) {
    return [
      ...options.filter((entry) => entry.team === "good" && entry.human !== true),
      ...options.filter((entry) => entry.team === "good"),
      ...options,
    ];
  }
  return [
    ...options.filter((entry) => entry.human !== true),
    ...options,
  ];
}

function targetIdsFor(action) {
  const { min, max } = targetCountFor(action);
  if (max <= 0) return [];
  const selected = (action?.selectedTargetIds ?? []).filter(Boolean).slice(0, max);
  if (selected.length >= min) return selected;
  const ids = [];
  for (const option of rankedOptions(action)) {
    if (option?.id && !ids.includes(option.id)) {
      ids.push(option.id);
    }
    if (ids.length >= Math.max(1, min)) break;
  }
  return ids.slice(0, max);
}

function playablePayload(action = {}) {
  const inputType = action.inputType ?? "player-target";
  if (action.optional && (action.options ?? []).length === 0) {
    return { mode: "skip" };
  }
  if (inputType === "info") {
    return {};
  }
  if (inputType === "role") {
    return { roleId: roleIdFor(action) };
  }
  if (inputType === "player-role") {
    const targetIds = targetIdsFor(action);
    const target = (action.options ?? []).find((entry) => entry.id === targetIds[0]);
    return { targetIds, roleId: roleIdFor(action, target?.roleId ?? "") };
  }
  if (inputType === "question") {
    return { question: "Is there a demon in play?" };
  }
  if (inputType === "guesses") {
    const count = Math.max(1, Number(action.minGuessCount ?? 1) || 1);
    const roleId = roleIdFor(action);
    return {
      guesses: rankedOptions(action).slice(0, count).map((option) => ({
        playerId: option.id,
        roleId,
      })),
    };
  }
  if (inputType === "charge-or-targets") {
    return { mode: "kill", targetIds: targetIdsFor(action) };
  }
  return { targetIds: targetIdsFor(action) };
}

function actionModelForCommand(viewModel, command) {
  if (command?.type === "night-action") return viewModel?.humanNightAction ?? {};
  if (command?.type === "day-action") return viewModel?.humanDayAction ?? {};
  if (command?.type === "storyteller-action") return pendingStorytellerAction(viewModel) ?? {};
  return null;
}

function payloadTargetIds(payload = {}) {
  if (Array.isArray(payload.targetIds)) return payload.targetIds.filter(Boolean);
  return [payload.targetId ?? payload.playerId].filter(Boolean);
}

function validateActionPayloadCompleteness(viewModel, command, scenario) {
  const action = actionModelForCommand(viewModel, command);
  if (!action) return;
  const inputType = action.inputType ?? "player-target";
  if (inputType === "info" || inputType === "role" || inputType === "question") return;
  if (command.payload?.mode === "skip" && action.optional) return;
  if (inputType === "guesses") {
    const minGuessCount = Math.max(1, Number(action.minGuessCount ?? 1) || 1);
    const guesses = Array.isArray(command.payload?.guesses) ? command.payload.guesses : [];
    assert.ok(
      guesses.length >= minGuessCount,
      `${scenarioSlug(scenario)} ${command.type} should submit ${minGuessCount} guesses, got ${guesses.length}`
    );
    return;
  }
  if (inputType === "charge-or-targets" && command.payload?.mode !== "kill") return;
  const { min, max } = targetCountFor(action);
  if (max <= 0) return;
  const ids = payloadTargetIds(command.payload);
  assert.ok(
    ids.length >= min,
    `${scenarioSlug(scenario)} ${command.type} target selection incomplete: required ${min}, got ${ids.length}`
  );
  assert.ok(
    ids.length <= max,
    `${scenarioSlug(scenario)} ${command.type} target selection too large: max ${max}, got ${ids.length}`
  );
}

function pendingStorytellerAction(viewModel) {
  const action = viewModel.pendingStorytellerAction ?? {};
  return action.available ? action : null;
}

function pickHumanNominationTarget(harness, options = {}) {
  const state = readJson(harness.statePath).state;
  const human = state.players?.find((player) => player.isHuman);
  if (options.avoidDemon) {
    const safeNominees = (state.players ?? []).filter(
      (player) => !player.isHuman && player.alive && player.category !== "demon" && player.roleId !== "virgin"
    );
    const nonDemon =
      safeNominees.find((player) => player.team === "good") ??
      safeNominees[0] ??
      null;
    if (nonDemon) return nonDemon;
  }
  return (
    state.players?.find((player) => !player.isHuman && player.alive && player.category === "demon") ??
    state.players?.find((player) => !player.isHuman && player.alive && player.team === "evil") ??
    state.players?.find((player) => !player.isHuman && player.alive && player.id !== human?.id) ??
    null
  );
}

function pickHumanPublicFocusTarget(harness) {
  return pickHumanNominationTarget(harness);
}

function nextPlayableCommand(viewModel, usedDayActions, context = {}) {
  const storyteller = pendingStorytellerAction(viewModel);
  if (storyteller) {
    return { type: "storyteller-action", payload: playablePayload(storyteller) };
  }

  if (viewModel.gameOver === true || viewModel.phase === "ended") {
    return null;
  }

  const debate = viewModel.nominationDebate ?? {};
  if (debate.active === true) {
    if (debate.canHumanRespond) {
      return {
        type: "nomination-debate-response",
        payload: { text: "I have said my piece; resolve the vote and keep the game moving." },
      };
    }
    return { type: "resolve-nomination-vote", payload: {} };
  }

  if (viewModel.phase === "night") {
    if (viewModel.humanNightAction?.available) {
      return { type: "night-action", payload: playablePayload(viewModel.humanNightAction) };
    }
    return { type: "phase", payload: { stage: "day" } };
  }

  if (viewModel.phase !== "day") {
    throw new Error(`Unsupported phase in playable smoke: ${viewModel.phase}`);
  }

  const dayAction = viewModel.humanDayAction ?? {};
  const dayActionKey = `${viewModel.day}:${dayAction.roleId ?? ""}`;
  if (dayAction.available && dayAction.roleId && !usedDayActions.has(dayActionKey)) {
    usedDayActions.add(dayActionKey);
    return { type: "day-action", payload: playablePayload(dayAction) };
  }

  if (viewModel.dayStage === "private") {
    return { type: "public-discussion", payload: {} };
  }

  if (viewModel.dayStage === "public") {
    if (context.forceHumanPublicSpeech && !context.humanPublicSpeechSubmitted) {
      const focus = pickHumanPublicFocusTarget(context.harness);
      assert.ok(focus?.id, `${scenarioSlug(context.scenario)} should have a legal human public speech focus`);
      context.humanPublicSpeechSubmitted = true;
      context.awaitingHumanPublicSpeechResponse = true;
      return {
        type: "human-public-speech",
        payload: {
          focusId: focus.id,
          text: `I want ${focus.name} to answer publicly before nominations; my info is on the table and I want a clear read.`,
          intent: "human-public",
        },
      };
    }
    if (context.awaitingHumanPublicSpeechResponse) {
      context.awaitingHumanPublicSpeechResponse = false;
      return { type: "ai-public-step", payload: {} };
    }
    if (viewModel.phaseAdvance?.targetStage === "nomination" && viewModel.phaseAdvance?.blocked !== true) {
      return { type: "phase", payload: { stage: "nomination" } };
    }
    return { type: "ai-public-step", payload: {} };
  }

  if (viewModel.dayStage === "nomination") {
    const clock = viewModel.nominationClock ?? {};
    if (clock.status === "expired" || clock.status === "passed" || clock.status === "execution-resolved") {
      return { type: "pass-nomination-window", payload: {} };
    }
    if (context.forceHumanNomination && !context.humanNominationSubmitted && clock.active && clock.status === "open") {
      const target = pickHumanNominationTarget(context.harness, { avoidDemon: (viewModel.day ?? 0) <= 1 });
      assert.ok(target?.id, `${scenarioSlug(context.scenario)} should have a legal human nomination target`);
      context.humanNominationSubmitted = true;
      return {
        type: "human-nomination-intent",
        payload: {
          nomineeId: target.id,
          reason: `I nominate ${target.name}; let both sides speak, then resolve the vote.`,
        },
      };
    }
    if (clock.active && clock.status === "open") {
      return { type: "ai-nomination-step", payload: { ticks: 4 } };
    }
    return { type: "open-nomination-window", payload: { ticks: 4 } };
  }

  throw new Error(`Unsupported day stage in playable smoke: ${viewModel.dayStage}`);
}

function runPlayableScenario(scenario, options = {}) {
  const maxActions = Number(options.maxActions ?? 320) || 320;
  const harness = createHarness(scenario, options.outputRoot ?? path.join("output", "unity-playable-path-smoke"));
  const trace = [];
  const nodeRecords = [];
  const coveredFlowNodes = new Set();
  const issues = [];
  const usedDayActions = new Set();
  const context = {
    forceHumanNomination: options.forceHumanNomination !== false,
    forceHumanPublicSpeech: options.forceHumanPublicSpeech === true,
    humanNominationSubmitted: false,
    humanPublicSpeechSubmitted: false,
    awaitingHumanPublicSpeechResponse: false,
    harness,
    scenario,
  };

  let viewModel = submitAction(
    harness,
    scenario,
    "new-game",
    {
      scriptId: scenario.scriptId,
      playerCount: scenario.players,
      preferredHumanRoleId: scenario.roleId,
      seed: scenario.seed,
    },
    trace
  );
  nodeRecords.push(saveNodeEvidence(harness, "new-game", viewModel, trace.at(-1), { nodeId: "setup" }));
  if (viewModel.phase === "night" && Number(viewModel.night ?? 0) === 1) {
    nodeRecords.push(saveNodeEvidence(harness, "first-night", viewModel, trace.at(-1), { nodeId: "first-night" }));
    coveredFlowNodes.add("first-night");
  }

  for (let step = 0; step < maxActions; step += 1) {
    const command = nextPlayableCommand(viewModel, usedDayActions, context);
    if (!command) {
      const state = readJson(harness.statePath).state;
      const finalNode = saveNodeEvidence(harness, "final", viewModel, trace.at(-1));
      nodeRecords.push(finalNode);
      coveredFlowNodes.add(finalNode.nodeId);
      const resolved = {
        scenario,
        root: harness.root,
        actionCount: trace.length,
        winner: viewModel.winner,
        winnerReason: viewModel.winnerReason ?? "",
        executions: state.events?.executions?.length ?? 0,
        votes: state.events?.votes?.length ?? 0,
        nightDeaths: state.events?.nightDeaths?.length ?? 0,
        storytellerResolved: trace.filter((entry) => entry.type === "storyteller-action").length,
        humanNightActions: trace.filter((entry) => entry.type === "night-action").length,
        humanDayActions: trace.filter((entry) => entry.type === "day-action").length,
        humanPublicSpeeches: trace.filter((entry) => entry.type === "human-public-speech").length,
        humanPublicResponseSteps: trace.filter((entry, index) =>
          entry.type === "ai-public-step" &&
          trace.slice(0, index).some((previous) => previous.type === "human-public-speech")
        ).length,
        humanNominations: trace.filter((entry) => entry.type === "human-nomination-intent").length,
        nominationVotes: trace.filter((entry) => entry.type === "resolve-nomination-vote").length,
        coveredFlowNodes: [...coveredFlowNodes],
        nodes: nodeRecords,
        issues,
        firstScreenshotPath: nodeRecords[0]?.paths?.screenshot ?? "",
        lastScreenshotPath: finalNode.paths?.screenshot ?? "",
        trace,
      };
      for (const nodeId of REQUIRED_FLOW_NODE_IDS) {
        if (!coveredFlowNodes.has(nodeId)) {
          addIssue(issues, "P0", "flow-node-missing", `${scenarioSlug(scenario)} did not cover ${nodeId}`, {
            coveredFlowNodes: [...coveredFlowNodes],
          });
        }
      }
      const voteNode = nodeRecords.find((node) => node.nodeId === "day-one-vote");
      if (voteNode && Number(voteNode.summary?.day ?? 0) !== 1) {
        addIssue(issues, "P0", "day-one-vote-wrong-day", `${scenarioSlug(scenario)} vote evidence was not captured on Day 1`, {
          day: voteNode.summary?.day,
          nodeDir: voteNode.paths?.dir,
        });
      }
      assert.ok(["good", "evil"].includes(resolved.winner), `${scenarioSlug(scenario)} should end with a concrete winner`);
      assert.ok(resolved.votes > 0, `${scenarioSlug(scenario)} should exercise nomination voting`);
      if (options.forceHumanNomination !== false) {
        assert.ok(resolved.humanNominations > 0, `${scenarioSlug(scenario)} should exercise a player-initiated nomination`);
      }
      if (options.requireHumanNightAction === true) {
        assert.ok(resolved.humanNightActions > 0, `${scenarioSlug(scenario)} should exercise at least one player night action`);
      }
      if (options.requireHumanPublicSpeech === true) {
        assert.ok(resolved.humanPublicSpeeches > 0, `${scenarioSlug(scenario)} should exercise a player public speech`);
        assert.ok(resolved.humanPublicResponseSteps > 0, `${scenarioSlug(scenario)} should exercise an AI response after player public speech`);
        assert.ok(
          state.events?.speeches?.some((entry) => !entry.private && state.players?.find((player) => player.id === entry.playerId)?.isHuman),
          `${scenarioSlug(scenario)} should persist a human public speech event`
        );
      }
      const fatalIssues = blockingIssues(issues);
      assert.deepEqual(fatalIssues, [], `${scenarioSlug(scenario)} has blocking playable smoke issues`);
      writeJson(path.join(harness.root, "playable_summary.json"), resolved);
      return resolved;
    }
    validateActionPayloadCompleteness(viewModel, command, scenario);
    viewModel = submitAction(harness, scenario, command.type, command.payload, trace);
    const state = persistedState(harness);
    const traceEntry = trace.at(-1);
    const candidateNodeIds = [];
    if (traceEntry?.type === "resolve-nomination-vote" && Number(traceEntry.day ?? 0) === 1 && !coveredFlowNodes.has("day-one-vote")) {
      candidateNodeIds.push("day-one-vote");
    }
    const currentNodeId = nodeIdFor(viewModel, state, traceEntry);
    candidateNodeIds.push(currentNodeId);
    for (const nodeId of [...new Set(candidateNodeIds)]) {
      if (!coveredFlowNodes.has(nodeId)) {
        const nodeRecord = saveNodeEvidence(harness, nodeId, viewModel, traceEntry, { nodeId });
        nodeRecords.push(nodeRecord);
        coveredFlowNodes.add(nodeId);
        checkProtectedNightInfo(scenario, viewModel, state, issues);
      }
    }
  }

  throw new Error(`${scenarioSlug(scenario)} did not reach endgame within ${maxActions} guided actions.`);
}

function checkProtectedNightInfo(scenario, viewModel, state, issues) {
  if (!PROTECTED_NIGHT_INFO_ROLES.has(scenario.roleId)) return;
  if (viewModel?.phase !== "day" || viewModel?.dayStage !== "private" || Number(viewModel.day ?? 0) !== 1) return;
  const human = humanPlayerFromState(state);
  const pings = (state?.events?.infoPings ?? []).filter(
    (entry) => entry?.actorId === human?.id && entry?.type === scenario.roleId && Number(entry?.night ?? 0) === 1
  );
  const privateInfo = compactLines(viewModel?.privateInfo ?? [], 8);
  const stateInfo = compactLines(state?.pendingHumanInfo ?? [], 8);
  if (pings.length === 0) {
    addIssue(issues, "P0", "missing-first-night-info-ping", `${scenarioSlug(scenario)} has no protected first-night info ping`);
  }
  if (privateInfo.length === 0) {
    addIssue(issues, "P0", "missing-first-night-private-info", `${scenarioSlug(scenario)} has no private info visible in viewmodel`);
  }
  if (scenario.roleId === "fortune-teller") {
    const targetCount = pings[0]?.targetIds?.length ?? 0;
    if (targetCount < 2) {
      addIssue(issues, "P0", "fortune-teller-targets-incomplete", `${scenarioSlug(scenario)} fortune teller info should include two targets`, {
        targetCount,
      });
    }
  }
  const privateInfoText = privateInfo.join("\n");
  for (const line of stateInfo) {
    if (line && !privateInfoText.includes(line)) {
      addIssue(issues, "P1", "first-night-info-mutated", `${scenarioSlug(scenario)} private info text changed between state and viewmodel`, {
        stateLine: line,
        privateInfo,
      });
      break;
    }
  }
  const lower = privateInfoText.toLowerCase();
  for (const term of ["llm", "renderer", "prompt", "payload", "json"]) {
    if (lower.includes(term)) {
      addIssue(issues, "P1", "first-night-info-internal-term", `${scenarioSlug(scenario)} private info contains internal renderer term`, {
        term,
      });
    }
  }
}

function advanceToDayOnePrivate(harness, scenario, trace) {
  const usedDayActions = new Set();
  const context = {
    forceHumanNomination: false,
    forceHumanPublicSpeech: false,
    humanNominationSubmitted: false,
    humanPublicSpeechSubmitted: false,
    awaitingHumanPublicSpeechResponse: false,
    harness,
    scenario,
  };
  let viewModel = submitAction(
    harness,
    scenario,
    "new-game",
    {
      scriptId: scenario.scriptId,
      playerCount: scenario.players,
      preferredHumanRoleId: scenario.roleId,
      seed: scenario.seed,
    },
    trace
  );
  for (let step = 0; step < 40; step += 1) {
    if (viewModel.phase === "day" && viewModel.dayStage === "private" && Number(viewModel.day ?? 0) === 1) {
      return viewModel;
    }
    const command = nextPlayableCommand(viewModel, usedDayActions, context);
    assert.ok(command, `${scenarioSlug(scenario)} proactive queue regression should reach day-one private`);
    validateActionPayloadCompleteness(viewModel, command, scenario);
    viewModel = submitAction(harness, scenario, command.type, command.payload, trace);
  }
  throw new Error(`${scenarioSlug(scenario)} proactive queue regression did not reach day-one private`);
}

function assertNoProactiveLeak(viewModel, state, issues, contextLabel) {
  const pending = viewModel?.pendingProactiveWhispers ?? [];
  const exported = JSON.stringify(pending);
  for (const term of INTERNAL_UI_TERMS) {
    if (term && exported.includes(term)) {
      addIssue(issues, "P0", "proactive-whisper-leak", `${contextLabel} exported pending proactive whisper leaked internal/private term`, {
        term,
      });
    }
  }
  const aiById = new Map((state?.players ?? []).map((player) => [player.id, player]));
  for (const offer of pending) {
    const ai = aiById.get(offer.playerId);
    for (const secret of [ai?.roleId, ai?.roleName, ai?.apparentRoleId, ai?.apparentRoleName].filter(Boolean)) {
      if (exported.includes(secret)) {
        addIssue(issues, "P0", "proactive-whisper-role-leak", `${contextLabel} pending proactive whisper leaked role identity before acceptance`, {
          offerId: offer.id,
          secret,
        });
      }
    }
  }
}

function seedTwoProactiveWhispers(harness) {
  const state = persistedState(harness);
  const human = humanPlayerFromState(state);
  const ais = (state.players ?? []).filter((entry) => !entry.isHuman && entry.alive).slice(0, 2);
  assert.equal(ais.length, 2, "proactive queue regression needs two living AI players");
  state.aiDialogue = state.aiDialogue ?? {};
  state.aiDialogue.pendingProactiveWhispers = ais.map((ai, index) => ({
    id: `playable-proactive-offer-${index + 1}`,
    day: state.day,
    night: state.night,
    playerId: ai.id,
    playerName: ai.name,
    playerSeat: ai.seatIndex + 1,
    reason: `internal-reason-${index + 1}-hidden`,
    prompt: `internal-prompt-${index + 1}-hidden`,
    response: `secret-response-${index + 1}-hidden`,
    intent: index === 0 ? "reason" : "vote",
    focusId: human?.id ?? "",
    createdAt: 910000 + index,
  }));
  writePersistedState(harness, state);
  return state.aiDialogue.pendingProactiveWhispers;
}

function runProactiveWhisperQueueRegression(options = {}) {
  const scenario = { scriptId: "tb", roleId: "washerwoman", players: 9, seed: 880601 };
  const harness = createHarness({ ...scenario, roleId: "proactive-whisper-queue" }, options.outputRoot ?? path.join("output", "unity-playable-path-smoke"));
  const trace = [];
  const issues = [];
  const nodes = [];
  let viewModel = advanceToDayOnePrivate(harness, scenario, trace);
  nodes.push(saveNodeEvidence(harness, "proactive-day-one-private", viewModel, trace.at(-1), { nodeId: "day-one-private" }));
  const offers = seedTwoProactiveWhispers(harness);
  const human = humanPlayerFromState(persistedState(harness));
  viewModel = submitAction(harness, scenario, "select-token", { playerId: human?.id }, trace);
  nodes.push(saveNodeEvidence(harness, "proactive-before-accept", viewModel, trace.at(-1), { nodeId: "day-one-private" }));
  assert.deepEqual(
    (viewModel.pendingProactiveWhispers ?? []).map((offer) => offer.id),
    ["playable-proactive-offer-1", "playable-proactive-offer-2"],
    "playable proactive queue should export two pending entries"
  );
  assertNoProactiveLeak(viewModel, persistedState(harness), issues, "before accept");
  const beforeTimeline = JSON.stringify(viewModel.timeline ?? []);
  assert.equal(beforeTimeline.includes("secret-response-1-hidden"), false, "first proactive private content should stay hidden before accept");
  assert.equal(beforeTimeline.includes("secret-response-2-hidden"), false, "second proactive private content should stay hidden before accept");
  viewModel = submitAction(harness, scenario, "accept-proactive-whisper", { offerId: offers[0].id }, trace);
  nodes.push(saveNodeEvidence(harness, "proactive-after-first-accept", viewModel, trace.at(-1), { nodeId: "day-one-private" }));
  assert.deepEqual(
    (viewModel.pendingProactiveWhispers ?? []).map((offer) => offer.id),
    ["playable-proactive-offer-2"],
    "accepting the first proactive whisper should leave the second entry visible"
  );
  const afterTimeline = JSON.stringify(viewModel.timeline ?? []);
  assert.ok(afterTimeline.includes("secret-response-1-hidden"), "accepted proactive private content should enter the timeline");
  assert.equal(afterTimeline.includes("secret-response-2-hidden"), false, "unaccepted proactive private content should remain hidden");
  const fatalIssues = blockingIssues(issues);
  assert.deepEqual(fatalIssues, [], "proactive whisper queue regression has blocking issues");
  const summary = {
    scenario,
    root: harness.root,
    trace,
    issues,
    nodes,
    beforeAcceptScreenshotPath: nodes[1]?.paths?.screenshot ?? "",
    afterAcceptScreenshotPath: nodes[2]?.paths?.screenshot ?? "",
  };
  writeJson(path.join(harness.root, "playable_summary.json"), summary);
  return summary;
}

function methodSlice(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  if (start < 0) return "";
  const end = endNeedle ? source.indexOf(endNeedle, start + startNeedle.length) : -1;
  return source.slice(start, end < 0 ? undefined : end);
}

function runStaticUiRiskChecks(options = {}) {
  const issues = [];
  const sourceRoot = path.join(process.cwd(), "unity-prototype", "Assets", "Scripts");
  const sources = fs
    .readdirSync(sourceRoot)
    .filter((fileName) => /^BotcPrototypeBootstrap(?:\..+)?\.cs$/.test(fileName))
    .map((fileName) => fs.readFileSync(path.join(sourceRoot, fileName), "utf8"));
  const allSource = sources.join("\n");
  const infoDrawer = fs.readFileSync(path.join(sourceRoot, "BotcPrototypeBootstrap.InfoDrawer.cs"), "utf8");
  const publicTimelineSurface = [
    methodSlice(infoDrawer, "InfoTimelineBody", "InfoTimelineRationaleCardsLine"),
    methodSlice(infoDrawer, "InfoTimelineRationaleCardsLine", "TimelineEntryHasRationaleCards"),
    methodSlice(infoDrawer, "AddInfoTimelineRationaleDrilldown", "AddInfoTimelineRationaleCard"),
    methodSlice(infoDrawer, "RationaleCardMatchupTraceLine", "RationaleCardTimelineText"),
    methodSlice(infoDrawer, "RationaleCardSectionLine", "RationaleCardRawLine"),
  ].join("\n");

  const requiredSourceChecks = [
    ["proactive queue rows", allSource.includes("proactiveWhisperQueueListRoot") && allSource.includes("RenderProactiveWhisperQueueList")],
    ["bottom dock safe offset", allSource.includes("dockSafeYOffset") && allSource.includes("bottomDockOpen ? 146f : 36f")],
    ["token name plate", allSource.includes('AddPanel("Name Plate"') && allSource.includes('AddText("Role Label"')],
    ["help panel route", allSource.includes('mode == "help"') && allSource.includes("OpenHandbookPanel(\"help\")")],
    ["info drawer tabs", ["events", "whispers", "public", "clues"].every((tab) => infoDrawer.includes(`"${tab}"`))],
    ["info drawer tab builders", ["BuildWhisperTabText", "BuildPublicSpeechTabText", "BuildClueSummaryTabText"].every((name) => infoDrawer.includes(name))],
  ];
  for (const [label, passed] of requiredSourceChecks) {
    if (!passed) {
      addIssue(issues, "P1", "static-ui-contract-missing", `Unity UI source is missing ${label}`);
    }
  }
  for (const forbidden of ["Timeline Rationale", "Structured rationale", "reason:", "cards:", "target:", "runner:", "evidence:", "source:", "next:"]) {
    if (publicTimelineSurface.includes(forbidden)) {
      addIssue(issues, "P1", "public-info-drawer-internal-term", `Info drawer public timeline still exposes internal wording: ${forbidden}`);
    }
  }
  if (options.issues) options.issues.push(...issues);
  return { issues };
}

function scenariosFromArgs(args) {
  const explicit = argValue(args, "scenario", "");
  if (explicit) {
    return explicit.split(",").map(parseScenario);
  }
  if (hasFlag(args, "quick")) {
    return DEFAULT_SCENARIOS.slice(0, 2);
  }
  return DEFAULT_SCENARIOS;
}

export function runPlayablePathSmoke(options = {}) {
  const scenarios = options.scenarios ?? DEFAULT_SCENARIOS;
  const outputRoot = path.resolve(options.outputRoot ?? path.join("output", "unity-playable-path-smoke"));
  fs.mkdirSync(outputRoot, { recursive: true });
  const issues = [];
  const coveredRoles = new Set(scenarios.map((scenario) => scenario.roleId));
  if (options.requireFullCoverage !== false) {
    for (const roleId of REQUIRED_HUMAN_ROLE_IDS) {
      if (!coveredRoles.has(roleId)) {
        addIssue(issues, "P0", "required-role-missing", `Playable smoke scenario matrix is missing ${roleId}`);
      }
    }
  }
  const proactiveRegression = runProactiveWhisperQueueRegression({ ...options, outputRoot });
  issues.push(...(proactiveRegression.issues ?? []));
  const summaries = scenarios.map((scenario) => {
    const summary = runPlayableScenario(scenario, { ...options, outputRoot });
    issues.push(...(summary.issues ?? []));
    return summary;
  });
  const staticChecks = runStaticUiRiskChecks({ issues });
  const report = {
    generatedAt: new Date().toISOString(),
    outputRoot,
    requiredRoles: REQUIRED_HUMAN_ROLE_IDS,
    coveredRoles: [...coveredRoles],
    requiredFlowNodes: REQUIRED_FLOW_NODE_IDS,
    proactiveRegression,
    staticChecks,
    scenarios: summaries,
    issues,
    blockingIssues: blockingIssues(issues),
  };
  writeJson(path.join(outputRoot, "playable_loop_report.json"), report);
  assert.deepEqual(report.blockingIssues, [], "playable path smoke found blocking P0/P1 issues");
  summaries.report = report;
  summaries.proactiveRegression = proactiveRegression;
  return summaries;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2));
  const bridgeScript = argValue(args, "bridge-script", "");
  if (bridgeScript) {
    const bridgeModule = await import(pathToFileURL(path.resolve(bridgeScript)).href);
    activeProcessUnityActionFile = bridgeModule.processUnityActionFile;
  }
  const outputRoot = argValue(args, "out", path.join("output", "unity-playable-path-smoke"));
  const maxActions = Number(argValue(args, "max-actions", "320")) || 320;
  const explicitScenario = !!argValue(args, "scenario", "");
  const forceHumanNomination = hasFlag(args, "no-human-nomination") ? false : true;
  const forceHumanPublicSpeech = hasFlag(args, "no-human-public-speech") ? false : true;
  const requireHumanNightAction = hasFlag(args, "require-human-night-action");
  const requireHumanPublicSpeech = hasFlag(args, "require-human-public-speech") || forceHumanPublicSpeech;
  const summaries = runPlayablePathSmoke({
    scenarios: scenariosFromArgs(args),
    outputRoot,
    maxActions,
    forceHumanNomination,
    forceHumanPublicSpeech,
    requireHumanNightAction,
    requireHumanPublicSpeech,
    requireFullCoverage: !hasFlag(args, "quick") && !explicitScenario,
  });

  summaries.forEach((summary) => {
    console.log(
      [
        `${scenarioSlug(summary.scenario)} ok`,
        `winner=${summary.winner}`,
        `actions=${summary.actionCount}`,
        `votes=${summary.votes}`,
        `executions=${summary.executions}`,
        `humanNightActions=${summary.humanNightActions}`,
        `humanDayActions=${summary.humanDayActions}`,
        `humanPublicSpeeches=${summary.humanPublicSpeeches}`,
        `humanPublicResponseSteps=${summary.humanPublicResponseSteps}`,
        `humanNominations=${summary.humanNominations}`,
        `storytellerResolved=${summary.storytellerResolved}`,
        `nodes=${summary.nodes?.length ?? 0}`,
        `lastScreenshot=${path.resolve(summary.lastScreenshotPath ?? summary.root)}`,
        `artifacts=${path.resolve(summary.root)}`,
      ].join(" ")
    );
  });
  console.log(`playable_loop_report=${path.resolve(summaries.report?.outputRoot ?? outputRoot, "playable_loop_report.json")}`);
}
