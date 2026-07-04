import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_STREAMING_ASSETS = "unity-build/BOTC_Unity_Prototype_Data/StreamingAssets";
const DEFAULT_TIMEOUT_MS = 45000;
const DEFAULT_POLL_MS = 1000;

function unquote(value) {
  const text = `${value ?? ""}`;
  if (text.length >= 2) {
    const first = text[0];
    const last = text[text.length - 1];
    if ((first === "\"" && last === "\"") || (first === "'" && last === "'")) {
      return text.slice(1, -1);
    }
  }
  return text;
}

function parseArgs(argv) {
  const values = new Map();
  const flags = new Set();
  const positionals = [];

  function addValue(key, value) {
    const normalized = key.replace(/^--/, "");
    const list = values.get(normalized) ?? [];
    list.push(unquote(value));
    values.set(normalized, list);
  }

  for (let index = 0; index < argv.length; index += 1) {
    const entry = argv[index];
    if (!entry.startsWith("--")) {
      positionals.push(unquote(entry));
      continue;
    }

    const eqIndex = entry.indexOf("=");
    if (eqIndex >= 0) {
      addValue(entry.slice(0, eqIndex), entry.slice(eqIndex + 1));
      continue;
    }

    const key = entry.replace(/^--/, "");
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      addValue(key, next);
      index += 1;
    } else {
      flags.add(key);
    }
  }

  return { values, flags, positionals };
}

function argValue(args, name, fallback = "") {
  const list = args.values.get(name);
  return list?.[list.length - 1] ?? fallback;
}

function argValues(args, name) {
  return args.values.get(name) ?? [];
}

function hasFlag(args, name) {
  return args.flags.has(name) || args.values.has(name);
}

function splitList(values) {
  return values
    .flatMap((value) => `${value ?? ""}`.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(raw);
}

function tryReadJson(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return readJson(filePath);
  } catch {
    return null;
  }
}

function writeJsonAtomic(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  fs.rmSync(filePath, { force: true });
  fs.renameSync(tempPath, filePath);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function processIsAlive(pid) {
  const numericPid = Number(pid);
  if (!Number.isInteger(numericPid) || numericPid <= 0) {
    return false;
  }
  try {
    process.kill(numericPid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

async function acquireActionLock(lockPath, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  const staleMs = Math.max(180000, timeoutMs * 3);
  while (Date.now() < deadline) {
    try {
      fs.mkdirSync(lockPath);
      writeJsonAtomic(path.join(lockPath, "owner.json"), {
        pid: process.pid,
        acquiredAt: new Date().toISOString(),
      });
      return () => fs.rmSync(lockPath, { recursive: true, force: true });
    } catch (error) {
      if (error?.code !== "EEXIST") {
        throw error;
      }
      try {
        const owner = tryReadJson(path.join(lockPath, "owner.json"));
        if (owner?.pid && !processIsAlive(owner.pid)) {
          fs.rmSync(lockPath, { recursive: true, force: true });
          continue;
        }
        const stats = fs.statSync(lockPath);
        if (Date.now() - stats.mtimeMs > staleMs) {
          fs.rmSync(lockPath, { recursive: true, force: true });
          continue;
        }
      } catch {
        // The lock disappeared between checks; retry immediately.
      }
      await sleep(100);
    }
  }
  throw new Error(`Timed out waiting for Unity action lock: ${lockPath}`);
}

function pathsFromArgs(args) {
  const streamingAssets = path.resolve(argValue(args, "streaming-assets", DEFAULT_STREAMING_ASSETS));
  return {
    streamingAssets,
    statePath: path.resolve(argValue(args, "state", path.join(streamingAssets, "unity_state.json"))),
    viewModelPath: path.resolve(argValue(args, "viewmodel", path.join(streamingAssets, "unity_viewmodel.json"))),
    actionPath: path.resolve(argValue(args, "action", path.join(streamingAssets, "unity_action.json"))),
    resultPath: path.resolve(argValue(args, "result", path.join(streamingAssets, "unity_action_result.json"))),
  };
}

function playerOptionLabel(option) {
  if (!option) return "";
  return [option.name, option.id].filter(Boolean).join(" ");
}

function normalizeLookup(value) {
  return `${value ?? ""}`.trim().toLowerCase();
}

function resolvePlayerOption(action, value) {
  const needle = normalizeLookup(value);
  if (!needle) return null;
  const options = action.options ?? [];
  return options.find((entry) => normalizeLookup(entry.id) === needle)
    ?? options.find((entry) => normalizeLookup(entry.name) === needle)
    ?? options.find((entry) => `${entry.seat ?? ""}` === needle)
    ?? null;
}

function playerLabel(player) {
  if (!player) return "";
  return [player.name, player.id].filter(Boolean).join(" ");
}

function eligibleNominationTarget(player) {
  return !!player?.id && player.alive !== false && player.human !== true;
}

function resolveViewModelPlayer(viewModel, value, { requireNominationTarget = false } = {}) {
  const needle = normalizeLookup(value);
  if (!needle) return null;
  const players = viewModel.players ?? [];
  const player = players.find((entry) => normalizeLookup(entry.id) === needle)
    ?? players.find((entry) => normalizeLookup(entry.name) === needle)
    ?? players.find((entry) => `${entry.seat ?? ""}` === needle)
    ?? null;
  if (player && requireNominationTarget && !eligibleNominationTarget(player)) {
    throw new Error(`Illegal nomination target: ${playerLabel(player) || value}`);
  }
  return player;
}

function resolveRoleId(action, value) {
  const requested = normalizeLookup(value);
  const roles = action.roleOptions ?? [];
  if (!requested) return roles.find((entry) => entry.id)?.id ?? "";
  const role = roles.find((entry) => normalizeLookup(entry.id) === requested)
    ?? roles.find((entry) => normalizeLookup(entry.name) === requested);
  if (!role) {
    throw new Error(`Unknown role option: ${value}`);
  }
  return role.id;
}

function roleOptionIds(action) {
  return new Set((action.roleOptions ?? []).map((entry) => entry.id).filter(Boolean));
}

function hasExplicitRoleSelection(args) {
  return !!`${argValue(args, "role-id", argValue(args, "role", ""))}`.trim();
}

function requestedTargetsFromArgs(args) {
  return splitList([
    ...args.positionals,
    ...argValues(args, "target"),
    ...argValues(args, "targets"),
    ...argValues(args, "player"),
    ...argValues(args, "players"),
  ]);
}

function hasExplicitTargetSelection(args) {
  return requestedTargetsFromArgs(args).length > 0;
}

function explicitModeSelection(args) {
  return `${argValue(args, "mode", "")}`.trim().toLowerCase();
}

function targetBounds(action) {
  const rawMin = action.minTargetCount ?? action.targetCount ?? 0;
  const rawMax = action.maxTargetCount ?? action.targetCount ?? rawMin;
  const min = Math.max(0, Number(rawMin) || 0);
  const max = Math.max(min, Number(rawMax) || min);
  return { min, max };
}

function chooseTargetIds(action, requestedTargets) {
  const { min, max } = targetBounds(action);
  const resolved = [];

  for (const target of requestedTargets) {
    const option = resolvePlayerOption(action, target);
    if (!option) {
      throw new Error(`Unknown or illegal target for this action: ${target}`);
    }
    if (!resolved.includes(option.id)) {
      resolved.push(option.id);
    }
  }

  if (resolved.length > 0) {
    if (resolved.length < min) {
      throw new Error(`This action needs at least ${min} target(s), got ${resolved.length}.`);
    }
    if (resolved.length > max) {
      throw new Error(`This action allows at most ${max} target(s), got ${resolved.length}.`);
    }
    return resolved;
  }

  const selected = Array.isArray(action.selectedTargetIds) ? action.selectedTargetIds.filter(Boolean) : [];
  if (selected.length >= min && selected.length <= max) {
    return selected;
  }

  return (action.options ?? []).slice(0, min).map((entry) => entry.id).filter(Boolean);
}

function pitHagGuidedDefaultPayload(args, action, paths) {
  if (action.roleId !== "pit-hag" || action.inputType !== "player-role") {
    return null;
  }
  if (hasExplicitRoleSelection(args) || hasExplicitTargetSelection(args)) {
    return null;
  }

  const state = tryReadJson(paths.statePath)?.state ?? null;
  if (!state || state.scriptId !== "snv") {
    return null;
  }

  const optionIds = new Set((action.options ?? []).map((entry) => entry.id).filter(Boolean));
  const roleIds = roleOptionIds(action);
  const candidates = (state.players ?? [])
    .filter((player) => optionIds.has(player.id) && player.alive !== false)
    .filter((player) => player.isHuman !== true);
  if (candidates.length <= 0) {
    return null;
  }

  const selectedIds = Array.isArray(action.selectedTargetIds) ? action.selectedTargetIds.filter(Boolean) : [];
  const selectedCandidates = selectedIds
    .map((id) => candidates.find((player) => player.id === id))
    .filter(Boolean);
  const target =
    selectedCandidates.find((player) => player.category !== "demon") ??
    candidates.find((player) => player.category !== "demon") ??
    selectedCandidates[0] ??
    candidates[0];
  if (!target) {
    return null;
  }

  const safeRoleId = roleIds.has(target.roleId) ? target.roleId : resolveRoleId(action, "");
  return safeRoleId ? { targetIds: [target.id], roleId: safeRoleId } : null;
}

function klutzGuidedDefaultPayload(args, action, paths) {
  const isKlutzChoice = action.type === "klutz-choice" || (action.roleId === "klutz" && action.inputType === "player-target");
  if (!isKlutzChoice || hasExplicitTargetSelection(args)) {
    return null;
  }
  const { min, max } = targetBounds(action);
  if (min !== 1 || max < 1) {
    return null;
  }

  const state = tryReadJson(paths.statePath)?.state ?? null;
  const playersById = new Map((state?.players ?? []).map((player) => [player.id, player]));
  const goodOption = (action.options ?? []).find((option) => {
    if (!option?.id) return false;
    const player = playersById.get(option.id);
    if (player) return player.alive !== false && player.team === "good";
    return option.team === "good";
  });
  return goodOption ? { targetIds: [goodOption.id] } : null;
}

function professorGuidedDefaultPayload(args, action, paths) {
  if (action.roleId !== "professor" || action.inputType !== "player-target" || hasExplicitTargetSelection(args)) {
    return null;
  }
  const { min, max } = targetBounds(action);
  if (min !== 1 || max < 1) {
    return null;
  }

  const state = tryReadJson(paths.statePath)?.state ?? null;
  if (!state || state.scriptId !== "bmr") {
    return null;
  }

  const optionOrder = new Map((action.options ?? []).map((entry, index) => [entry.id, index]));
  const optionIds = new Set(optionOrder.keys());
  const target = (state.players ?? [])
    .filter((player) => optionIds.has(player.id) && player.isHuman !== true && player.alive === false)
    .filter((player) => player.category === "townsfolk")
    .sort((a, b) => (optionOrder.get(a.id) ?? 0) - (optionOrder.get(b.id) ?? 0))[0];
  return target ? { targetIds: [target.id] } : { mode: "skip" };
}

const BARBER_SWAP_ROLE_VALUE = new Map([
  ["savant", 100],
  ["dreamer", 96],
  ["artist", 92],
  ["seamstress", 88],
  ["flowergirl", 84],
  ["town-crier", 82],
  ["oracle", 78],
  ["mathematician", 76],
  ["juggler", 74],
  ["clockmaker", 70],
  ["philosopher", 66],
  ["sage", 62],
  ["snake-charmer", 56],
]);

function barberSwapRoleValue(player) {
  return BARBER_SWAP_ROLE_VALUE.get(player?.roleId) ?? (
    player?.category === "townsfolk" ? 45 :
      player?.category === "outsider" ? 25 :
        player?.category === "minion" ? 20 : 0
  );
}

function barberGuidedDefaultPayload(args, action, paths) {
  const isBarberSwap = action.type === "barber-swap" || (action.roleId === "barber" && action.inputType === "player-target");
  if (!isBarberSwap || hasExplicitTargetSelection(args)) {
    return null;
  }
  const { min } = targetBounds(action);
  if (min !== 2) {
    return null;
  }

  const state = tryReadJson(paths.statePath)?.state ?? null;
  if (!state || state.scriptId !== "snv") {
    return null;
  }

  const optionIds = new Set((action.options ?? []).map((entry) => entry.id).filter(Boolean));
  const candidates = (state.players ?? [])
    .filter((player) => optionIds.has(player.id) && player.alive !== false && player.category !== "demon");
  const evilTargets = candidates
    .filter((player) => player.team === "evil")
    .sort((a, b) => barberSwapRoleValue(a) - barberSwapRoleValue(b));
  const goodTargets = candidates
    .filter((player) => player.team === "good")
    .sort((a, b) => barberSwapRoleValue(b) - barberSwapRoleValue(a));
  const evilTarget = evilTargets[0] ?? null;
  const goodTarget = goodTargets.find((player) => player.id !== evilTarget?.id) ?? null;
  return evilTarget && goodTarget ? { targetIds: [evilTarget.id, goodTarget.id] } : null;
}

const DEMON_KILL_ROLE_IDS = new Set([
  "imp",
  "fang-gu",
  "vigormortis",
  "no-dashii",
  "vortox",
  "zombuul",
  "pukka",
  "shabaloth",
  "po",
]);

const DEMON_KILL_TARGET_VALUE = new Map([
  ["savant", 100],
  ["dreamer", 96],
  ["artist", 92],
  ["seamstress", 88],
  ["fortune-teller", 86],
  ["empath", 84],
  ["flowergirl", 84],
  ["town-crier", 82],
  ["undertaker", 80],
  ["oracle", 78],
  ["mathematician", 76],
  ["juggler", 74],
  ["clockmaker", 70],
  ["philosopher", 66],
  ["slayer", 64],
  ["monk", 62],
  ["sage", 60],
  ["ravenkeeper", 58],
  ["snake-charmer", 54],
  ["mayor", 52],
  ["professor", 50],
  ["exorcist", 88],
  ["gambler", 46],
  ["chambermaid", 44],
  ["innkeeper", 40],
  ["tea-lady", 38],
  ["courtier", 94],
  ["professor", 90],
  ["grandmother", 82],
  ["gossip", 72],
  ["fool", 34],
  ["sailor", 32],
  ["moonchild", 30],
  ["tinker", 24],
  ["goon", 22],
  ["lunatic", 8],
  ["soldier", 24],
]);

function demonKillTargetValue(player) {
  return DEMON_KILL_TARGET_VALUE.get(player?.roleId) ?? (
    player?.category === "townsfolk" ? 45 :
      player?.category === "outsider" ? 25 :
        player?.team === "good" ? 10 : 0
  );
}

const DEMON_NIGHT_DEATH_REASONS = new Set([
  "demon-kill",
  "pukka-delayed-kill",
  "shabaloth-kill",
]);

function recentFailedDemonTargetIds(state, humanId, lookback = 4) {
  const plans = (state?.logs ?? [])
    .filter((entry) => entry?.type === "night-plan" && entry.payload?.playerId === humanId)
    .filter((entry) => DEMON_KILL_ROLE_IDS.has(entry.payload?.roleId))
    .filter((entry) => Array.isArray(entry.payload?.targetIds) && entry.payload.targetIds.length > 0)
    .slice(-lookback);
  const failed = new Set();
  const nightDeaths = state?.events?.nightDeaths ?? [];

  plans.forEach((entry) => {
    const night = Number(entry.payload?.night ?? 0) || 0;
    entry.payload.targetIds.forEach((targetId) => {
      const diedThatNight = nightDeaths.some((death) =>
        death.playerId === targetId &&
        (!night || Number(death.night ?? 0) === night) &&
        DEMON_NIGHT_DEATH_REASONS.has(death.reason)
      );
      if (!diedThatNight) {
        failed.add(targetId);
      }
    });
  });

  return failed;
}

function bmrCurrentProtectionPenalty(state, player) {
  if (state?.scriptId !== "bmr" || !player?.id) {
    return 0;
  }
  let penalty = 0;
  if ((state.bmr?.innkeeperProtectedIds ?? []).includes(player.id)) penalty += 70;
  if ((state.bmr?.teaLadyProtectedIds ?? []).includes(player.id)) penalty += 70;
  if (state.bmr?.devilsAdvocateProtectedId === player.id) penalty += 70;
  if (player.roleId === "fool" && !state.bmr?.foolSavedById?.[player.id]) penalty += 46;
  return penalty;
}

function demonKillGuidedTargetScore(state, player, optionOrder, failedTargetIds) {
  return (
    demonKillTargetValue(player) -
    (failedTargetIds.has(player.id) ? 64 : 0) -
    bmrCurrentProtectionPenalty(state, player) -
    ((optionOrder.get(player.id) ?? 0) * 0.001)
  );
}

const FANG_GU_JUMP_OUTSIDER_VALUE = new Map([
  ["barber", 88],
  ["sweetheart", 84],
  ["klutz", 80],
  ["mutant", 76],
]);

function fangGuJumpOutsiderValue(player) {
  return FANG_GU_JUMP_OUTSIDER_VALUE.get(player?.roleId) ?? 50;
}

function fangGuJumpTargets(state, action, candidates, optionOrder, max) {
  if (action.roleId !== "fang-gu" || state.scriptId !== "snv" || state.snv?.fangGuJumpUsed) {
    return [];
  }
  return candidates
    .filter((player) => player.team === "good" && player.category === "outsider")
    .sort((a, b) => {
      const valueDiff = fangGuJumpOutsiderValue(b) - fangGuJumpOutsiderValue(a);
      return valueDiff || ((optionOrder.get(a.id) ?? 0) - (optionOrder.get(b.id) ?? 0));
    })
    .slice(0, max);
}

function demonKillGuidedDefaultPayload(args, action, paths) {
  if (!DEMON_KILL_ROLE_IDS.has(action.roleId) || !["player-target", "charge-or-targets"].includes(action.inputType)) {
    return null;
  }
  if (hasExplicitTargetSelection(args)) {
    return null;
  }
  const explicitMode = explicitModeSelection(args);
  if (action.inputType === "charge-or-targets" && ["charge", "none"].includes(explicitMode)) {
    return null;
  }
  const { min, max } = targetBounds(action);
  if (min < 1 || max < min) {
    return null;
  }

  const state = tryReadJson(paths.statePath)?.state ?? null;
  const human = (state?.players ?? []).find((player) => player.isHuman);
  if (!state || human?.category !== "demon") {
    return null;
  }

  const optionOrder = new Map((action.options ?? []).map((entry, index) => [entry.id, index]));
  const optionIds = new Set(optionOrder.keys());
  const candidates = (state.players ?? [])
    .filter((player) => optionIds.has(player.id) && player.alive !== false && player.id !== human.id);
  const fangGuTargets = fangGuJumpTargets(state, action, candidates, optionOrder, max);
  if (fangGuTargets.length >= min) {
    const payload = { targetIds: fangGuTargets.map((player) => player.id) };
    return action.inputType === "charge-or-targets" ? { mode: "kill", ...payload } : payload;
  }

  const failedTargetIds = recentFailedDemonTargetIds(state, human.id);
  const goodTargets = candidates
    .filter((player) => player.team === "good")
    .sort((a, b) => {
      const valueDiff =
        demonKillGuidedTargetScore(state, b, optionOrder, failedTargetIds) -
        demonKillGuidedTargetScore(state, a, optionOrder, failedTargetIds);
      return valueDiff || ((optionOrder.get(a.id) ?? 0) - (optionOrder.get(b.id) ?? 0));
    });
  const desiredCount = Math.min(max, goodTargets.length);
  if (desiredCount < min) {
    return null;
  }

  const payload = { targetIds: goodTargets.slice(0, desiredCount).map((player) => player.id) };
  return action.inputType === "charge-or-targets" ? { mode: "kill", ...payload } : payload;
}

function parseGuesses(args, action) {
  const rawGuesses = splitList([...argValues(args, "guess"), ...argValues(args, "guesses")]);
  if (rawGuesses.length > 0) {
    return rawGuesses.map((entry) => {
      const [target, role] = entry.split(":").map((part) => part?.trim()).filter(Boolean);
      const option = resolvePlayerOption(action, target);
      if (!option) {
        throw new Error(`Unknown or illegal guess target: ${target}`);
      }
      return { playerId: option.id, roleId: resolveRoleId(action, role) };
    });
  }

  const count = Math.max(1, Number(action.minGuessCount ?? 1) || 1);
  const players = (action.options ?? []).slice(0, count).map((entry) => entry.id).filter(Boolean);
  const roleId = resolveRoleId(action, argValue(args, "role-id", argValue(args, "role", "")));
  return players.map((playerId) => ({ playerId, roleId }));
}

function buildPayload(args, action, paths = null) {
  const inputType = action.inputType ?? "player-target";
  const explicitMode = explicitModeSelection(args);
  if (action.optional && (explicitMode === "skip" || explicitMode === "none")) {
    return { mode: "skip" };
  }
  const guidedPitHagPayload = paths ? pitHagGuidedDefaultPayload(args, action, paths) : null;
  if (guidedPitHagPayload) {
    return guidedPitHagPayload;
  }
  const guidedKlutzPayload = paths ? klutzGuidedDefaultPayload(args, action, paths) : null;
  if (guidedKlutzPayload) {
    return guidedKlutzPayload;
  }
  const guidedProfessorPayload = paths ? professorGuidedDefaultPayload(args, action, paths) : null;
  if (guidedProfessorPayload) {
    return guidedProfessorPayload;
  }
  const guidedBarberPayload = paths ? barberGuidedDefaultPayload(args, action, paths) : null;
  if (guidedBarberPayload) {
    return guidedBarberPayload;
  }
  const guidedDemonKillPayload = paths ? demonKillGuidedDefaultPayload(args, action, paths) : null;
  if (guidedDemonKillPayload) {
    return guidedDemonKillPayload;
  }
  const requestedTargets = requestedTargetsFromArgs(args);
  const roleId = resolveRoleId(action, argValue(args, "role-id", argValue(args, "role", "")));

  if (inputType === "info") {
    return {};
  }
  if (inputType === "role") {
    return { roleId };
  }
  if (inputType === "player-role") {
    return {
      targetIds: chooseTargetIds(action, requestedTargets),
      roleId,
    };
  }
  if (inputType === "question") {
    return { question: argValue(args, "question", argValue(args, "text", "Is there a demon in play?")) };
  }
  if (inputType === "guesses") {
    return { guesses: parseGuesses(args, action) };
  }
  if (inputType === "charge-or-targets") {
    const mode = argValue(args, "mode", action.modes?.find((entry) => entry.id === "kill")?.id ?? action.modes?.[0]?.id ?? "kill");
    if (mode === "charge" || mode === "none") {
      return { mode };
    }
    return {
      mode,
      targetIds: chooseTargetIds(action, requestedTargets),
    };
  }
  return {
    targetIds: chooseTargetIds(action, requestedTargets),
  };
}

function payloadTargetLabels(action, payload) {
  const ids = payload.targetIds ?? [];
  return ids.map((id) => playerOptionLabel((action.options ?? []).find((entry) => entry.id === id)) || id);
}

function boolArg(args, name, fallback = false) {
  if (args.flags.has(name)) return true;
  const raw = argValue(args, name, "");
  if (!raw) return fallback;
  return !["0", "false", "no", "off"].includes(raw.trim().toLowerCase());
}

function resolvePlayerDecisions(args) {
  return boolArg(args, "resolve-player-decisions", false) ||
    boolArg(args, "guided-player-decisions", false) ||
    boolArg(args, "player-decisions", false);
}

async function waitForResult(resultPath, actionId, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = tryReadJson(resultPath);
    if (result?.actionId === actionId) {
      return result;
    }
    await sleep(250);
  }
  throw new Error(`Timed out waiting for Unity bridge result actionId=${actionId}`);
}

async function waitForBridgeCompletion(paths, action, timeoutMs, options = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = tryReadJson(paths.resultPath);
    if (result?.actionId === action.id) {
      const after = await waitForViewModel(paths.viewModelPath, action.id, Math.min(timeoutMs, 10000), options);
      return { result, after };
    }

    const viewModel = tryReadJson(paths.viewModelPath);
    if (viewModel?.action?.lastActionId === action.id) {
      return {
        result: {
          actionId: action.id,
          actionType: action.type,
          ok: viewModel.action.status !== "error",
          message: viewModel.action.message ?? "",
          inferredFromViewModel: true,
        },
        after: viewModel,
      };
    }
    if (typeof options.acceptViewModelCompletion === "function" && options.acceptViewModelCompletion(viewModel)) {
      return {
        result: {
          actionId: action.id,
          actionType: action.type,
          ok: true,
          message: "Action completion inferred from a later Unity viewmodel.",
          inferredFromViewModel: true,
        },
        after: viewModel,
      };
    }

    await sleep(200);
  }
  throw new Error(`Timed out waiting for Unity bridge result actionId=${action.id}`);
}

async function waitForViewModel(viewModelPath, actionId, timeoutMs, options = {}) {
  const deadline = Date.now() + timeoutMs;
  let latest = null;
  while (Date.now() < deadline) {
    const viewModel = tryReadJson(viewModelPath);
    if (viewModel) {
      latest = viewModel;
    }
    if (!actionId || viewModel?.action?.lastActionId === actionId) {
      return viewModel;
    }
    if (options.allowLaterAction === true && viewModel?.action?.lastActionId) {
      return viewModel;
    }
    await sleep(200);
  }
  if (options.allowLaterAction === true && latest) {
    return latest;
  }
  throw new Error(`Timed out waiting for Unity viewmodel actionId=${actionId}`);
}

async function submitBridgeAction(args, paths, action, options = {}) {
  if (hasFlag(args, "dry-run")) {
    return { dryRun: true, action, result: null, after: null };
  }

  const timeoutMs = Number(argValue(args, "timeout-ms", `${DEFAULT_TIMEOUT_MS}`)) || DEFAULT_TIMEOUT_MS;
  const releaseLock = await acquireActionLock(`${paths.actionPath}.lock`, timeoutMs);
  let result;
  let after;
  try {
    fs.rmSync(paths.resultPath, { force: true });
    writeJsonAtomic(paths.actionPath, action);
    ({ result, after } = options.acceptViewModelCompletion
      ? await waitForBridgeCompletion(paths, action, timeoutMs, options)
      : {
          result: await waitForResult(paths.resultPath, action.id, timeoutMs),
          after: await waitForViewModel(paths.viewModelPath, action.id, Math.min(timeoutMs, 10000), options),
        });
  } finally {
    releaseLock();
  }

  if (result.ok !== true) {
    throw new Error(result.message || `Unity bridge rejected ${action.type} action ${action.id}.`);
  }
  return { action, result, after };
}

function explicitVoteChoiceFromArgs(args) {
  if (hasFlag(args, "vote-no") || hasFlag(args, "no")) {
    return { explicit: true, humanVoteYes: false };
  }
  if (hasFlag(args, "vote-yes") || hasFlag(args, "yes")) {
    return { explicit: true, humanVoteYes: true };
  }

  const raw = argValue(args, "vote", "");
  if (!raw) {
    return { explicit: false, humanVoteYes: null };
  }
  return {
    explicit: true,
    humanVoteYes: !["0", "false", "no", "nay", "n", "off"].includes(raw.trim().toLowerCase()),
  };
}

function humanVoteFromResult(result, viewModel) {
  const humanId = viewModel?.players?.find((player) => player.human)?.id ?? "";
  if (!humanId) {
    return null;
  }
  const vote = result?.result?.votes?.find((entry) => entry.voterId === humanId);
  return typeof vote?.vote === "boolean" ? vote.vote : null;
}

async function submitNominationVote(args, paths) {
  if (!fs.existsSync(paths.viewModelPath)) {
    throw new Error(`Unity viewmodel not found: ${paths.viewModelPath}`);
  }

  const viewModel = readJson(paths.viewModelPath);
  const debate = viewModel.nominationDebate ?? {};
  if (viewModel.phase !== "day" || debate.active !== true) {
    throw new Error("No active nomination debate is currently waiting for a player vote.");
  }

  const voteChoice = explicitVoteChoiceFromArgs(args);
  const payload = voteChoice.explicit ? { humanVoteYes: voteChoice.humanVoteYes } : {};
  const explicitId = argValue(args, "id", "");
  const action = {
    id: explicitId || `submit-vote-${Date.now()}-${process.pid}`,
    type: "resolve-nomination-vote",
    createdAt: new Date().toISOString(),
    payload,
  };

  if (hasFlag(args, "dry-run")) {
    return { dryRun: true, action, debate, humanVoteYes: voteChoice.humanVoteYes, voteExplicit: voteChoice.explicit };
  }

  const nominationId = debate.nominationId ?? "";
  const { result, after } = await submitBridgeAction(args, paths, action, {
    allowLaterAction: true,
    acceptViewModelCompletion: (nextViewModel) => {
      const nextDebate = nextViewModel?.nominationDebate ?? {};
      return nextViewModel?.gameOver === true ||
        nextViewModel?.phase === "ended" ||
        nextDebate.active !== true ||
        (!!nominationId && nextDebate.nominationId && nextDebate.nominationId !== nominationId);
    },
  });
  const resolvedHumanVoteYes = voteChoice.explicit ? voteChoice.humanVoteYes : humanVoteFromResult(result, after);
  return { action, debate, humanVoteYes: resolvedHumanVoteYes, voteExplicit: voteChoice.explicit, result, after };
}

function printNominationVoteSummary(summary) {
  if (summary.dryRun) {
    console.log(JSON.stringify(summary.action, null, 2));
    return;
  }

  const { action, debate, humanVoteYes, voteExplicit, result, after } = summary;
  const voteLabel = typeof humanVoteYes === "boolean" ? (humanVoteYes ? "yes" : "no") : "default";
  console.log("Submitted Unity nomination vote");
  console.log(`ActionId=${action.id}`);
  console.log(`NominationId=${debate.nominationId ?? ""}`);
  console.log(`Nominee=${debate.nomineeName ?? debate.nomineeId ?? ""}`);
  console.log(`Vote=${voteLabel}${voteExplicit ? "" : " (default)"}`);
  console.log(`ResultOk=${result?.ok === true}`);
  console.log(`Phase=${after?.phase ?? ""}`);
  console.log(`Day=${after?.day ?? ""}`);
  console.log(`DayStage=${after?.dayStage ?? ""}`);
  console.log(`GameOver=${after?.gameOver === true}`);
  console.log(`Winner=${after?.winner ?? ""}`);
  console.log(`LastActionType=${after?.action?.lastActionType ?? ""}`);
}

function nominationTargetFromArgs(args, viewModel) {
  const requested = splitList([
    ...args.positionals,
    ...argValues(args, "target"),
    ...argValues(args, "targets"),
    ...argValues(args, "player"),
    ...argValues(args, "players"),
    ...argValues(args, "nominee"),
    ...argValues(args, "nominate"),
  ]);
  if (requested.length > 0) {
    const player = resolveViewModelPlayer(viewModel, requested[0], { requireNominationTarget: true });
    if (!player) {
      throw new Error(`Unknown nomination target: ${requested[0]}`);
    }
    return player;
  }

  const selected = resolveViewModelPlayer(viewModel, viewModel.action?.selectedPlayerId ?? "", { requireNominationTarget: true });
  if (selected) {
    return selected;
  }

  return (viewModel.players ?? []).find(eligibleNominationTarget) ?? null;
}

function publicSpeechFocusFromArgs(args, viewModel) {
  const requested = splitList([
    ...args.positionals,
    ...argValues(args, "target"),
    ...argValues(args, "targets"),
    ...argValues(args, "player"),
    ...argValues(args, "players"),
    ...argValues(args, "focus"),
  ]);
  if (requested.length > 0) {
    const player = resolveViewModelPlayer(viewModel, requested[0]);
    if (!player) {
      throw new Error(`Unknown public speech focus: ${requested[0]}`);
    }
    return player;
  }

  const selected = resolveViewModelPlayer(viewModel, viewModel.action?.selectedPlayerId ?? "");
  if (selected && selected.human !== true) {
    return selected;
  }

  return (viewModel.players ?? []).find((player) => player.human !== true && player.alive !== false) ?? null;
}

async function submitPublicDiscussionStage(args, paths) {
  const action = {
    id: `nomination-public-${Date.now()}-${process.pid}`,
    type: "public-discussion",
    createdAt: new Date().toISOString(),
    payload: {},
  };
  return submitBridgeAction(args, paths, action, { allowLaterAction: true });
}

function publicSpeechText(args, focus) {
  const explicit = argValue(args, "text", argValue(args, "line", argValue(args, "message", "")));
  if (explicit) {
    return explicit;
  }
  const focusName = focus?.name ?? "that seat";
  return `I want ${focusName} to answer this publicly before nominations; my info is on the table and I want a clear read.`;
}

async function submitHumanPublicSpeech(args, paths) {
  if (!fs.existsSync(paths.viewModelPath)) {
    throw new Error(`Unity viewmodel not found: ${paths.viewModelPath}`);
  }

  let viewModel = readJson(paths.viewModelPath);
  if (viewModel.gameOver === true || viewModel.phase === "ended") {
    throw new Error("The game is already over; no public speech can be submitted.");
  }
  if (viewModel.phase !== "day") {
    throw new Error("Human public speech is only available during the day.");
  }

  let stageSummary = null;
  if (viewModel.dayStage === "private" && !hasFlag(args, "no-stage-advance")) {
    stageSummary = await submitPublicDiscussionStage(args, paths);
    viewModel = stageSummary.after ?? readJson(paths.viewModelPath);
  }
  if (viewModel.dayStage !== "public") {
    throw new Error("Human public speech is only available during public discussion.");
  }

  const focus = publicSpeechFocusFromArgs(args, viewModel);
  const explicitId = argValue(args, "id", "");
  const text = publicSpeechText(args, focus);
  const action = {
    id: explicitId || `submit-public-${Date.now()}-${process.pid}`,
    type: "human-public-speech",
    createdAt: new Date().toISOString(),
    payload: {
      focusId: focus?.id ?? "",
      targetId: focus?.id ?? "",
      text,
      intent: argValue(args, "intent", "human-public"),
    },
  };

  if (hasFlag(args, "dry-run")) {
    return { dryRun: true, action, focus, stageSummary };
  }

  const { result, after } = await submitBridgeAction(args, paths, action, {
    allowLaterAction: true,
    acceptViewModelCompletion: (nextViewModel) => nextViewModel?.action?.lastActionId === action.id ||
      (nextViewModel?.phase === "day" && nextViewModel?.dayStage === "public"),
  });

  return { action, focus, text, result, after, stageSummary };
}

function printHumanPublicSpeechSummary(summary) {
  if (summary.dryRun) {
    console.log(JSON.stringify(summary.action, null, 2));
    return;
  }

  const { action, focus, after, stageSummary } = summary;
  console.log("Submitted Unity human public speech");
  if (stageSummary?.action?.id) {
    console.log(`StageActionId=${stageSummary.action.id}`);
  }
  console.log(`ActionId=${action.id}`);
  console.log(`Focus=${playerLabel(focus) || focus?.id || ""}`);
  console.log(`Phase=${after?.phase ?? ""}`);
  console.log(`Day=${after?.day ?? ""}`);
  console.log(`DayStage=${after?.dayStage ?? ""}`);
  console.log(`PublicConversation=${after?.publicConversation?.active === true}`);
  console.log(`LastActionType=${after?.action?.lastActionType ?? ""}`);
}

async function submitHumanNomination(args, paths) {
  if (!fs.existsSync(paths.viewModelPath)) {
    throw new Error(`Unity viewmodel not found: ${paths.viewModelPath}`);
  }

  let viewModel = readJson(paths.viewModelPath);
  if (viewModel.gameOver === true || viewModel.phase === "ended") {
    throw new Error("The game is already over; no nomination can be submitted.");
  }
  if (viewModel.phase !== "day") {
    throw new Error("Human nomination is only available during the day.");
  }
  if (viewModel.nominationDebate?.active === true) {
    throw new Error("A nomination debate is already active; resolve its vote before nominating again.");
  }

  let stageSummary = null;
  if (viewModel.dayStage === "private" && !hasFlag(args, "no-stage-advance")) {
    stageSummary = await submitPublicDiscussionStage(args, paths);
    viewModel = stageSummary.after ?? readJson(paths.viewModelPath);
  }

  const nominee = nominationTargetFromArgs(args, viewModel);
  if (!nominee) {
    throw new Error("No living non-human nomination target is available.");
  }

  const explicitId = argValue(args, "id", "");
  const action = {
    id: explicitId || `submit-nomination-${Date.now()}-${process.pid}`,
    type: "human-nomination-intent",
    createdAt: new Date().toISOString(),
    payload: {
      nomineeId: nominee.id,
      targetId: nominee.id,
      reason: argValue(args, "reason", argValue(args, "text", "")),
    },
  };

  if (hasFlag(args, "dry-run")) {
    return { dryRun: true, action, nominee, stageSummary };
  }

  const { result, after } = await submitBridgeAction(args, paths, action, {
    allowLaterAction: true,
    acceptViewModelCompletion: (nextViewModel) => {
      const debate = nextViewModel?.nominationDebate ?? {};
      return debate.active === true && debate.nomineeId === nominee.id;
    },
  });
  const debate = after?.nominationDebate ?? result?.debate ?? {};
  if (debate.active !== true || debate.nomineeId !== nominee.id) {
    throw new Error("Unity bridge accepted the nomination, but no matching nomination debate is active.");
  }

  return { action, nominee, result, after, debate, stageSummary };
}

function printHumanNominationSummary(summary) {
  if (summary.dryRun) {
    console.log(JSON.stringify(summary.action, null, 2));
    return;
  }

  const { action, nominee, after, debate, stageSummary } = summary;
  console.log("Submitted Unity human nomination");
  if (stageSummary?.action?.id) {
    console.log(`StageActionId=${stageSummary.action.id}`);
  }
  console.log(`ActionId=${action.id}`);
  console.log(`NominationId=${debate?.nominationId ?? ""}`);
  console.log(`Nominee=${playerLabel(nominee) || nominee?.id || ""}`);
  console.log(`Phase=${after?.phase ?? ""}`);
  console.log(`Day=${after?.day ?? ""}`);
  console.log(`DayStage=${after?.dayStage ?? ""}`);
  console.log(`NominationDebateActive=${after?.nominationDebate?.active === true}`);
  console.log(`LastActionType=${after?.action?.lastActionType ?? ""}`);
}

async function submitPassNomination(args, paths) {
  if (!fs.existsSync(paths.viewModelPath)) {
    throw new Error(`Unity viewmodel not found: ${paths.viewModelPath}`);
  }

  const before = readJson(paths.viewModelPath);
  if (before.gameOver === true || before.phase === "ended") {
    throw new Error("The game is already over; no nomination window can be passed.");
  }
  if (before.phase !== "day" || before.dayStage !== "nomination") {
    throw new Error("Passing the nomination window is only available during the day nomination stage.");
  }
  if (before.nominationDebate?.active === true) {
    throw new Error("A nomination debate is still active; submit a vote before passing the nomination window.");
  }

  const explicitId = argValue(args, "id", "");
  const action = {
    id: explicitId || `pass-nomination-${Date.now()}-${process.pid}`,
    type: "pass-nomination-window",
    createdAt: new Date().toISOString(),
    payload: {
      toNight: !boolArg(args, "stay-day", false),
    },
  };

  if (hasFlag(args, "dry-run")) {
    return { dryRun: true, action, before };
  }

  const beforeDay = Number(before.day ?? 0) || 0;
  const { result, after } = await submitBridgeAction(args, paths, action, {
    allowLaterAction: true,
    acceptViewModelCompletion: (nextViewModel) => nextViewModel?.phase === "night" ||
      nextViewModel?.phase === "ended" ||
      nextViewModel?.gameOver === true ||
      nextViewModel?.pendingStorytellerAction?.available === true ||
      ((Number(nextViewModel?.day ?? 0) || 0) > beforeDay && nextViewModel?.phase === "day"),
  });

  return { action, before, result, after };
}

function printPassNominationSummary(summary) {
  if (summary.dryRun) {
    console.log(JSON.stringify(summary.action, null, 2));
    return;
  }

  const { action, result, after } = summary;
  console.log("Submitted Unity nomination pass");
  console.log(`ActionId=${action.id}`);
  console.log(`ResultOk=${result?.ok === true}`);
  console.log(`Stage=${result?.stage ?? ""}`);
  console.log(`Phase=${after?.phase ?? ""}`);
  console.log(`Day=${after?.day ?? ""}`);
  console.log(`Night=${after?.night ?? ""}`);
  console.log(`DayStage=${after?.dayStage ?? ""}`);
  console.log(`GameOver=${after?.gameOver === true}`);
  console.log(`Winner=${after?.winner ?? ""}`);
  console.log(`LastActionType=${after?.action?.lastActionType ?? ""}`);
}

async function submitAvailableRoleAction(args, paths, config) {
  if (!fs.existsSync(paths.viewModelPath)) {
    throw new Error(`Unity viewmodel not found: ${paths.viewModelPath}`);
  }

  const viewModel = readJson(paths.viewModelPath);
  const roleAction = viewModel[config.viewModelKey] ?? {};
  if (roleAction.available !== true) {
    throw new Error(roleAction.reason || `No human ${config.label} is currently available.`);
  }

  const payload = buildPayload(args, roleAction, paths);
  const explicitId = argValue(args, "id", "");
  const actionId = explicitId && !hasFlag(args, "watch")
    ? explicitId
    : `${config.idPrefix}-${Date.now()}-${process.pid}`;
  const action = {
    id: actionId,
    type: config.actionType,
    createdAt: new Date().toISOString(),
    payload,
  };

  if (hasFlag(args, "dry-run")) {
    return { dryRun: true, action, roleAction, payload, label: config.label };
  }

  const { result, after } = await submitBridgeAction(args, paths, action, {
    allowLaterAction: config.allowLaterAction === true,
    acceptViewModelCompletion: config.acceptViewModelCompletion,
  });

  if (config.pendingViewModelKey && after?.[config.pendingViewModelKey]?.available === true && after?.action?.lastActionId === action.id) {
    throw new Error(`Unity bridge accepted the action, but the human ${config.label} is still pending.`);
  }

  return { action, roleAction, payload, result, after, label: config.label };
}

async function submitAvailableNightAction(args, paths) {
  const summary = await submitAvailableRoleAction(args, paths, {
    viewModelKey: "humanNightAction",
    pendingViewModelKey: "humanNightAction",
    actionType: "night-action",
    idPrefix: "submit-night",
    label: "night action",
  });
  return { ...summary, nightAction: summary.roleAction };
}

async function submitAvailableDayAction(args, paths) {
  const summary = await submitAvailableRoleAction(args, paths, {
    viewModelKey: "humanDayAction",
    pendingViewModelKey: "humanDayAction",
    actionType: "day-action",
    idPrefix: "submit-day",
    label: "day action",
    allowLaterAction: true,
    acceptViewModelCompletion: (nextViewModel) => nextViewModel?.humanDayAction?.available === false ||
      nextViewModel?.gameOver === true ||
      nextViewModel?.phase === "ended",
  });
  return { ...summary, dayAction: summary.roleAction };
}

async function submitAvailableStorytellerAction(args, paths) {
  const summary = await submitAvailableRoleAction(args, paths, {
    viewModelKey: "pendingStorytellerAction",
    actionType: "storyteller-action",
    idPrefix: "submit-storyteller",
    label: "storyteller action",
    allowLaterAction: true,
    acceptViewModelCompletion: (nextViewModel) => nextViewModel?.pendingStorytellerAction?.available === false,
  });
  return { ...summary, storytellerAction: summary.roleAction };
}

function printRoleActionSummary(summary) {
  if (summary.dryRun) {
    console.log(JSON.stringify(summary.action, null, 2));
    return;
  }

  const { action, roleAction, payload, after, label } = summary;
  console.log(`Submitted Unity ${label}`);
  console.log(`ActionId=${action.id}`);
  console.log(`Role=${roleAction.roleId ?? ""}`);
  console.log(`InputType=${roleAction.inputType ?? ""}`);
  const labels = payloadTargetLabels(roleAction, payload);
  if (labels.length > 0) {
    console.log(`Targets=${labels.join(", ")}`);
  }
  if (payload.roleId) {
    console.log(`SelectedRole=${payload.roleId}`);
  }
  console.log(`Phase=${after?.phase ?? ""}`);
  console.log(`DayStage=${after?.dayStage ?? ""}`);
  console.log(`GameOver=${after?.gameOver === true}`);
  console.log(`Winner=${after?.winner ?? ""}`);
  console.log(`LastActionType=${after?.action?.lastActionType ?? ""}`);
}

function printSubmissionSummary(summary) {
  printRoleActionSummary({ ...summary, roleAction: summary.nightAction ?? summary.roleAction, label: "night action" });
}

function printDayActionSummary(summary) {
  printRoleActionSummary({ ...summary, roleAction: summary.dayAction ?? summary.roleAction, label: "day action" });
}

function printStorytellerActionSummary(summary) {
  printRoleActionSummary({
    ...summary,
    roleAction: summary.storytellerAction ?? summary.roleAction,
    label: "storyteller action",
  });
}

function commandWithSuggestedTargets(baseCommand, action) {
  const { min } = targetBounds(action ?? {});
  if (!action?.available || min <= 0) {
    return baseCommand;
  }
  const ids = (action.options ?? []).slice(0, min).map((entry) => entry.id).filter(Boolean);
  if (ids.length <= 0) {
    return baseCommand;
  }
  const flag = ids.length === 1 ? "--target" : "--targets";
  const value = ids.length === 1 ? ids[0] : ids.join(",");
  return `${baseCommand} -- ${flag} ${value}`;
}

function firstNominationTarget(viewModel) {
  return (viewModel.players ?? []).find(eligibleNominationTarget) ?? null;
}

function nominationCommand(viewModel) {
  const target = firstNominationTarget(viewModel);
  if (!target?.id) {
    return "npm run unity:submit-nomination";
  }
  return `npm run unity:submit-nomination -- --target ${target.id}`;
}

function playableStatusCommands(viewModel) {
  if (viewModel.pendingStorytellerAction?.available === true) {
    return [commandWithSuggestedTargets("npm run unity:submit-storyteller-action", viewModel.pendingStorytellerAction)];
  }
  if (viewModel.gameOver === true || viewModel.phase === "ended") {
    return ["Game is over; start another playable run with npm run unity:playable"];
  }
  if (viewModel.humanNightAction?.available === true) {
    return [commandWithSuggestedTargets("npm run unity:submit-night-action", viewModel.humanNightAction)];
  }
  if (viewModel.humanDayAction?.available === true) {
    return [commandWithSuggestedTargets("npm run unity:submit-day-action", viewModel.humanDayAction)];
  }
  if (viewModel.nominationDebate?.active === true) {
    return [
      "npm run unity:submit-vote",
      "npm run unity:submit-vote -- --vote-no",
    ];
  }
  if (viewModel.phase === "day" && viewModel.dayStage === "nomination") {
    return [
      nominationCommand(viewModel),
      "npm run unity:pass-nomination",
    ];
  }
  if (viewModel.phase === "day" && viewModel.dayStage === "public") {
    return [
      "npm run unity:submit-public-speech",
      nominationCommand(viewModel),
      "npm run unity:advance-flow",
    ];
  }
  if (viewModel.phase === "day") {
    return [
      nominationCommand(viewModel),
      "npm run unity:advance-flow",
    ];
  }
  if (viewModel.phase === "night") {
    return ["npm run unity:advance-flow"];
  }
  return ["npm run unity:advance-flow"];
}

function optionPreview(action, limit = 5) {
  return (action?.options ?? [])
    .slice(0, limit)
    .map((entry) => playerOptionLabel(entry))
    .filter(Boolean)
    .join(", ");
}

function printPlayableStatus(paths) {
  if (!fs.existsSync(paths.viewModelPath)) {
    throw new Error(`Unity viewmodel not found: ${paths.viewModelPath}`);
  }
  const viewModel = readJson(paths.viewModelPath);
  const commands = playableStatusCommands(viewModel);
  const queueCount = Array.isArray(viewModel.storytellerQueueDetails)
    ? viewModel.storytellerQueueDetails.length
    : Array.isArray(viewModel.storytellerQueue)
      ? viewModel.storytellerQueue.length
      : 0;

  console.log("Unity playable status");
  console.log(`Phase=${viewModel.phase ?? ""}`);
  console.log(`Day=${viewModel.day ?? ""}`);
  console.log(`Night=${viewModel.night ?? ""}`);
  console.log(`DayStage=${viewModel.dayStage ?? ""}`);
  console.log(`GameOver=${viewModel.gameOver === true}`);
  console.log(`Winner=${viewModel.winner ?? ""}`);
  console.log(`Objective=${viewModel.phaseObjectiveTitle ?? ""}`);
  console.log(`Hint=${viewModel.phaseObjectiveHint ?? ""}`);
  console.log(`LastActionType=${viewModel.action?.lastActionType ?? ""}`);
  console.log(`StorytellerQueue=${queueCount}`);
  console.log(`HumanNightAction=${viewModel.humanNightAction?.available === true ? viewModel.humanNightAction.roleId ?? "" : ""}`);
  console.log(`HumanDayAction=${viewModel.humanDayAction?.available === true ? viewModel.humanDayAction.roleId ?? "" : ""}`);
  console.log(`NominationDebateActive=${viewModel.nominationDebate?.active === true}`);
  console.log(`VoteCeremony=${viewModel.voteCeremony ? `${viewModel.voteCeremony.yesVotes ?? 0}/${viewModel.voteCeremony.threshold ?? 0}` : ""}`);
  if (viewModel.pendingStorytellerAction?.available === true) {
    console.log(`PendingStorytellerType=${viewModel.pendingStorytellerAction.type ?? ""}`);
    console.log(`PendingStorytellerTargets=${optionPreview(viewModel.pendingStorytellerAction)}`);
  }
  if (viewModel.humanNightAction?.available === true) {
    console.log(`NightTargets=${optionPreview(viewModel.humanNightAction)}`);
  }
  if (viewModel.humanDayAction?.available === true) {
    console.log(`DayTargets=${optionPreview(viewModel.humanDayAction)}`);
  }
  commands.forEach((command, index) => {
    console.log(`NextCommand${index + 1}=${command}`);
  });
}

function buildAutoAdvancePayload(args) {
  const resolveVotes = boolArg(args, "resolve-votes", false) || boolArg(args, "resolve-debates", false);
  const directPlayerDecisions = resolvePlayerDecisions(args);
  const payload = {
    mode: argValue(args, "flow-mode", "playable"),
    resolveStoryteller: !directPlayerDecisions && !boolArg(args, "pause-storyteller", false),
    resolveDebates: !directPlayerDecisions && resolveVotes,
    maxSteps: Math.max(1, Number(argValue(args, "max-steps", "96")) || 96),
  };
  if (boolArg(args, "human-vote-no", false)) {
    payload.humanVoteYes = false;
  } else if (boolArg(args, "human-vote-yes", false)) {
    payload.humanVoteYes = true;
  }
  const publicSteps = argValue(args, "public-steps", "");
  const nominationTicks = argValue(args, "nomination-ticks", "");
  if (publicSteps) payload.publicSteps = Number(publicSteps) || 1;
  if (nominationTicks) payload.nominationTicks = Number(nominationTicks) || 4;
  return payload;
}

async function submitAutoAdvance(args, paths) {
  const action = {
    id: `flow-auto-${Date.now()}-${process.pid}`,
    type: "auto-advance",
    createdAt: new Date().toISOString(),
    payload: buildAutoAdvancePayload(args),
  };
  return submitBridgeAction(args, paths, action);
}

function printAutoAdvanceSummary(summary) {
  if (summary.dryRun) {
    console.log(JSON.stringify(summary.action, null, 2));
    return;
  }
  const { action, result, after } = summary;
  const auto = result?.autoAdvance ?? after?.action?.autoAdvance ?? {};
  console.log("Submitted Unity flow advance");
  console.log(`ActionId=${action.id}`);
  console.log(`StoppedAt=${auto.stoppedAt ?? ""}`);
  console.log(`StepCount=${auto.stepCount ?? 0}`);
  console.log(`Phase=${after?.phase ?? ""}`);
  console.log(`Day=${after?.day ?? ""}`);
  console.log(`DayStage=${after?.dayStage ?? ""}`);
  console.log(`GameOver=${after?.gameOver === true}`);
  console.log(`Winner=${after?.winner ?? ""}`);
  console.log(`LastActionType=${after?.action?.lastActionType ?? ""}`);
}

function viewModelKey(viewModel) {
  if (!viewModel) return "";
  return [
    viewModel.action?.lastActionId ?? "",
    viewModel.phase ?? "",
    viewModel.day ?? "",
    viewModel.dayStage ?? "",
    viewModel.nominationDebate?.active ? "debate" : "",
    viewModel.humanNightAction?.available ? "night" : "",
    viewModel.humanDayAction?.available ? "day-action" : "",
    viewModel.pendingStorytellerAction?.available ? "storyteller" : "",
    viewModel.gameOver ? "ended" : "",
  ].join("|");
}

function canFlowAdvance(viewModel, blockedKey) {
  if (!viewModel) {
    return false;
  }
  const key = viewModelKey(viewModel);
  if (blockedKey && blockedKey === key) {
    return false;
  }
  if (viewModel.pendingStorytellerAction?.available === true) {
    return true;
  }
  if (viewModel.gameOver === true || viewModel.phase === "ended") {
    return false;
  }
  if (viewModel.humanNightAction?.available === true) {
    return false;
  }
  return ["day", "night"].includes(viewModel.phase);
}

function shouldHoldUntilPlayerInput(summary, args) {
  const stoppedAt = summary.result?.autoAdvance?.stoppedAt ?? summary.after?.action?.autoAdvance?.stoppedAt ?? "";
  if (stoppedAt === "nomination-debate" && !boolArg(args, "resolve-votes", false) && !boolArg(args, "resolve-debates", false)) {
    return true;
  }
  return ["human-day-action", "private-chat", "public-discussion", "storyteller-action"].includes(stoppedAt);
}

async function watchNightActions(args, paths) {
  const pollMs = Number(argValue(args, "poll-ms", `${DEFAULT_POLL_MS}`)) || DEFAULT_POLL_MS;
  const idleTimeoutMs = Number(argValue(args, "idle-timeout-ms", "0")) || 0;
  const maxActions = Math.max(1, Number(argValue(args, "max-actions", "64")) || 64);
  let submitted = 0;
  let lastActivity = Date.now();

  console.log(`Watching Unity night actions: ${paths.viewModelPath}`);
  console.log(`MaxActions=${maxActions}`);

  for (;;) {
    const viewModel = tryReadJson(paths.viewModelPath);
    if (viewModel?.humanNightAction?.available === true) {
      const summary = await submitAvailableNightAction(args, paths);
      printSubmissionSummary(summary);
      submitted += 1;
      lastActivity = Date.now();
      if (submitted >= maxActions || hasFlag(args, "dry-run")) {
        console.log(`Stopped after ${submitted} night action(s).`);
        return;
      }
    } else if (idleTimeoutMs > 0 && Date.now() - lastActivity > idleTimeoutMs) {
      throw new Error(`Timed out waiting for a human night action after ${idleTimeoutMs}ms; submitted=${submitted}.`);
    }

    await sleep(pollMs);
  }
}

async function watchFlow(args, paths) {
  const pollMs = Number(argValue(args, "poll-ms", `${DEFAULT_POLL_MS}`)) || DEFAULT_POLL_MS;
  const idleTimeoutMs = Number(argValue(args, "idle-timeout-ms", "0")) || 0;
  const maxActions = Math.max(1, Number(argValue(args, "max-actions", "128")) || 128);
  let submitted = 0;
  let lastActivity = Date.now();
  let blockedKey = "";

  console.log(`Watching Unity playable flow: ${paths.viewModelPath}`);
  console.log(`MaxActions=${maxActions}`);
  console.log(`ResolveVotes=${boolArg(args, "resolve-votes", false) || boolArg(args, "resolve-debates", false)}`);
  console.log(`ResolvePlayerDecisions=${resolvePlayerDecisions(args)}`);

  for (;;) {
    const viewModel = tryReadJson(paths.viewModelPath);
    if (viewModel?.humanNightAction?.available === true) {
      const summary = await submitAvailableNightAction(args, paths);
      printSubmissionSummary(summary);
      submitted += 1;
      blockedKey = "";
      lastActivity = Date.now();
    } else if (resolvePlayerDecisions(args) && viewModel?.pendingStorytellerAction?.available === true) {
      const summary = await submitAvailableStorytellerAction(args, paths);
      printStorytellerActionSummary(summary);
      submitted += 1;
      blockedKey = "";
      lastActivity = Date.now();
    } else if (resolvePlayerDecisions(args) && viewModel?.humanDayAction?.available === true) {
      const summary = await submitAvailableDayAction(args, paths);
      printDayActionSummary(summary);
      submitted += 1;
      blockedKey = "";
      lastActivity = Date.now();
    } else if (resolvePlayerDecisions(args) && viewModel?.nominationDebate?.active === true) {
      const summary = await submitNominationVote(args, paths);
      printNominationVoteSummary(summary);
      submitted += 1;
      blockedKey = "";
      lastActivity = Date.now();
    } else if (canFlowAdvance(viewModel, blockedKey)) {
      const summary = await submitAutoAdvance(args, paths);
      printAutoAdvanceSummary(summary);
      submitted += 1;
      lastActivity = Date.now();
      blockedKey = shouldHoldUntilPlayerInput(summary, args) ? viewModelKey(summary.after) : "";
    } else if (viewModel?.gameOver === true || viewModel?.phase === "ended") {
      console.log(`Stopped: gameOver=${viewModel?.gameOver === true}, winner=${viewModel?.winner ?? ""}`);
      return;
    } else if (idleTimeoutMs > 0 && Date.now() - lastActivity > idleTimeoutMs) {
      throw new Error(`Timed out waiting for playable flow progress after ${idleTimeoutMs}ms; submitted=${submitted}.`);
    }

    if (submitted >= maxActions || hasFlag(args, "dry-run")) {
      console.log(`Stopped after ${submitted} flow action(s).`);
      return;
    }

    await sleep(pollMs);
  }
}

function printHelp() {
  console.log(`Submit legal human night actions or drive playable flow on a running BOTC Unity bridge.

Usage:
  node scripts/submit_unity_night_action.mjs [options] [target...]

Options:
  --streaming-assets PATH  Unity StreamingAssets directory. Defaults to current unity-build.
  --target ID             Target player id, seat number, or visible name. Repeatable.
  --targets A,B           Comma-separated targets.
  --role-id ID            Role option for role/player-role actions.
  --question TEXT         Question text for question actions.
  --mode MODE             Mode for charge-or-targets actions.
  --timeout-ms MS         Wait timeout. Defaults to ${DEFAULT_TIMEOUT_MS}.
  --watch                 Keep watching and submit each human night action.
  --watch-flow            Keep watching night actions and safe day flow advances.
  --advance-flow          Submit one safe flow advance for the current Unity game.
  --status                Print current playable state and suggested next command.
  --day-action            Submit the currently available human day action.
  --storyteller-action    Submit the currently available Storyteller queue action.
  --public-speech         Submit one human public speech during public discussion.
  --nominate TARGET       Create a human nomination debate for a living target.
  --focus TARGET          Public speech focus player id, seat number, or visible name.
  --reason TEXT           Optional public reason for --nominate.
  --text TEXT             Public speech text, nomination reason, or role question text.
  --vote                  Resolve the currently active nomination debate.
  --vote-yes              Vote yes when resolving the current nomination debate.
  --vote-no               Vote no when resolving the current nomination debate.
  --pass-nomination       Close nominations and resolve day-end execution/night.
  --stay-day              With --pass-nomination, skip to day-end without forcing night.
  --resolve-votes         In watch-flow mode, resolve nomination debates/votes too.
  --resolve-player-decisions
                          In watch-flow mode, submit player votes/day actions/Storyteller gates through command actions.
  --human-vote-no         In watch-flow resolve-votes mode, make the human vote no.
  --human-vote-yes        In watch-flow resolve-votes mode, make the human vote yes.
  --max-steps N           Max engine steps for each auto-advance. Defaults to 96.
  --max-actions N         Stop watch mode after N submitted actions. Defaults to 64.
  --idle-timeout-ms MS    Optional watch idle timeout. Defaults to no timeout.
  --poll-ms MS            Watch poll interval. Defaults to ${DEFAULT_POLL_MS}.
  --dry-run               Print the action that would be written.
  --help                  Show this help.

With no target arguments, the command chooses the first legal target(s) exposed by
unity_viewmodel.json. It still submits through unity_action.json, so the JS Core
rules validate and resolve the action.`);
}

async function main(argv) {
  const args = parseArgs(argv);
  if (hasFlag(args, "help")) {
    printHelp();
    return;
  }

  const paths = pathsFromArgs(args);
  if (hasFlag(args, "status")) {
    printPlayableStatus(paths);
    return;
  }
  if (hasFlag(args, "watch-flow") || hasFlag(args, "flow")) {
    await watchFlow(args, paths);
    return;
  }
  if (hasFlag(args, "advance-flow") || hasFlag(args, "flow-step") || hasFlag(args, "auto-advance")) {
    printAutoAdvanceSummary(await submitAutoAdvance(args, paths));
    return;
  }
  if (hasFlag(args, "day-action") || hasFlag(args, "submit-day-action")) {
    printDayActionSummary(await submitAvailableDayAction(args, paths));
    return;
  }
  if (hasFlag(args, "storyteller-action") || hasFlag(args, "submit-storyteller-action")) {
    printStorytellerActionSummary(await submitAvailableStorytellerAction(args, paths));
    return;
  }
  if (hasFlag(args, "public-speech") || hasFlag(args, "human-public-speech") || hasFlag(args, "submit-public-speech")) {
    printHumanPublicSpeechSummary(await submitHumanPublicSpeech(args, paths));
    return;
  }
  if (hasFlag(args, "nominate") || hasFlag(args, "nomination") || hasFlag(args, "submit-nomination")) {
    printHumanNominationSummary(await submitHumanNomination(args, paths));
    return;
  }
  if (hasFlag(args, "pass-nomination") || hasFlag(args, "end-day")) {
    printPassNominationSummary(await submitPassNomination(args, paths));
    return;
  }
  if (hasFlag(args, "vote") || hasFlag(args, "vote-yes") || hasFlag(args, "vote-no") || hasFlag(args, "yes") || hasFlag(args, "no")) {
    printNominationVoteSummary(await submitNominationVote(args, paths));
    return;
  }
  if (hasFlag(args, "watch")) {
    await watchNightActions(args, paths);
    return;
  }

  printSubmissionSummary(await submitAvailableNightAction(args, paths));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error?.message ?? `${error}`);
    process.exit(1);
  });
}
