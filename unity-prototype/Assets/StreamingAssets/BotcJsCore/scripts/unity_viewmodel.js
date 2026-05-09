import { getAllRoles, getRoleById } from "./data.js";
import {
  getHumanDayActionState,
  getHumanNightActionState,
  getNightOrderReference,
  getPendingStorytellerActionState,
  getPerceivedRoleId,
  publicRoleLabel,
} from "./engine.js";
import { buildUnityPhaseAdvance } from "./unity_phase_guard.mjs";

const UNITY_VIEWMODEL_VERSION = 1;

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanText(value, fallback = "") {
  return `${value ?? fallback}`.replace(/\s+/g, " ").trim();
}

function categorySetupText(counts = {}) {
  const townsfolk = counts.townsfolk ?? "?";
  const outsider = counts.outsider ?? "?";
  const minion = counts.minion ?? "?";
  const demon = counts.demon ?? "?";
  return `${townsfolk}民 ${outsider}外 ${minion}爪 ${demon}恶`;
}

function phaseLabel(state) {
  if (state?.phase === "night") return "夜间行动";
  if (state?.phase === "ended") return "复盘";
  if (state?.dayStage === "nomination") return "提名 / 投票 / 处决";
  if (state?.dayStage === "public") return "公聊";
  if (state?.dayStage === "private") return "私聊";
  return "准备中";
}

function isPrivateLogVisible(state, entry) {
  if (!entry?.payload?.private || state?.grimoireView) {
    return true;
  }
  const human = safeArray(state?.players).find((player) => player.isHuman);
  if (!human) {
    return false;
  }
  const payload = entry.payload ?? {};
  return [payload.playerId, payload.viewerId, payload.sourceId, payload.targetId].includes(human.id);
}

function exportedLogs(state, limit = 12) {
  return safeArray(state?.logs)
    .filter((entry) => isPrivateLogVisible(state, entry))
    .slice(-limit)
    .map((entry) => cleanText(entry.message))
    .filter(Boolean);
}

function latestDialogue(state) {
  const selectedPlayerId = state?.unityBridge?.selectedPlayerId ?? "";
  const selected = selectedPlayerId
    ? safeArray(state?.players).find((player) => player.id === selectedPlayerId)
    : null;
  if (selected && state?.unityBridge?.lastActionType === "select-token") {
    const note = state?.grimoireNotes?.[selected.id] ?? null;
    const roleId = visibleRoleIdForUnity(state, selected, note);
    const roleName = visibleRoleNameForUnity(state, selected, roleId, note);
    const reminders = playerRemindersForUnity(state, selected, note);
    const seat = (selected.seatIndex ?? 0) + 1;
    return {
      title: `Token · ${seat}号${selected.isHuman ? "（你）" : ""}`,
      text: [
        `身份显示：${roleName}`,
        `状态：${selected.alive ? "存活" : "死亡"}${selected.ghostVoteAvailable ? " · 有鬼票" : ""}`,
        reminders.length > 0 ? `标记：${reminders.join(" / ")}` : "",
        "Unity 已把这次点击写入 JS Core；后续私聊、公聊、提名会基于这个 token 执行。",
      ]
        .filter(Boolean)
        .join("\n"),
    };
  }

  const timeline = safeArray(state?.aiDialogue?.timeline);
  const active = state?.aiDialogue?.activeSpeech ?? timeline[timeline.length - 1] ?? null;
  if (!active) {
    return {
      title: "对话舞台",
      text: "点击任意 token 查看可用操作；公聊、私聊、提名和夜间选择会逐步接入 Unity。",
    };
  }
  const speaker = safeArray(state.players).find((player) => player.id === active.speakerId);
  const mode = active.mode === "public" ? "公聊" : active.mode?.includes("whisper") ? "私聊" : "发言";
  return {
    title: `${mode} · ${speaker?.name ?? "未知玩家"}`,
    text: cleanText(active.text, "等待玩家行动。"),
  };
}

function buildActionStatus(state) {
  const bridge = state?.unityBridge ?? {};
  const selected = bridge.selectedPlayerId
    ? safeArray(state?.players).find((player) => player.id === bridge.selectedPlayerId)
    : null;
  return {
    revision: bridge.revision ?? 0,
    lastActionId: bridge.lastActionId ?? "",
    lastActionType: bridge.lastActionType ?? "",
    status: bridge.status ?? "idle",
    message: bridge.message ?? "",
    updatedAt: bridge.updatedAt ?? "",
    selectedPlayerId: bridge.selectedPlayerId ?? "",
    selectedPlayerName: selected ? `${(selected.seatIndex ?? 0) + 1}号${selected.isHuman ? "（你）" : ""}` : "",
  };
}


function compactActionOption(option) {
  return {
    id: option?.id ?? "",
    name: option?.name ?? option?.label ?? option?.id ?? "",
    seat: option?.seat ?? option?.seatIndex ?? null,
    roleId: option?.roleId ?? "",
    roleName: option?.roleName ?? "",
    alive: option?.alive ?? null,
    team: option?.team ?? "",
    category: option?.category ?? "",
  };
}

function buildRoleAction(action) {
  if (!action?.available) {
    return {
      available: false,
      reason: cleanText(action?.reason ?? "当前没有可用行动。"),
    };
  }
  return {
    available: true,
    type: action.type ?? "",
    roleId: action.roleId ?? "",
    roleName: action.roleName ?? "",
    inputType: action.inputType ?? "",
    prompt: cleanText(action.prompt ?? ""),
    minTargetCount: action.minTargetCount ?? action.targetCount ?? 0,
    maxTargetCount: action.maxTargetCount ?? action.targetCount ?? 0,
    targetCount: action.targetCount ?? 0,
    allowSelf: !!action.allowSelf,
    allowDead: !!action.allowDead,
    modes: safeArray(action.modes).map((mode) => ({
      id: mode?.id ?? "",
      label: mode?.label ?? mode?.name ?? mode?.id ?? "",
    })),
    options: safeArray(action.options).map(compactActionOption),
    roleOptions: safeArray(action.roleOptions).map((role) => ({
      id: role?.id ?? "",
      name: role?.name ?? role?.id ?? "",
      category: role?.category ?? "",
      team: role?.team ?? "",
    })),
    selectedTargetIds: safeArray(action.selectedTargetIds),
    interaction: action.interaction ?? null,
  };
}

function buildScriptHandbook(state) {
  const bridge = state?.unityBridge ?? {};
  const nightOrder = getNightOrderReference(state.scriptId);
  const roles = getAllRoles(state.scriptId).map((role) => ({
    id: role.id,
    name: role.name,
    category: role.category,
    team: role.team,
    ability: role.ability ?? role.description ?? "",
    icon: role.icon ?? "",
  }));
  return {
    open: !!bridge.scriptHandbookOpen,
    activeTab: bridge.scriptHandbookTab ?? "roles",
    scriptId: state.scriptId ?? "",
    scriptName: state.scriptName ?? "",
    roles,
    firstNightOrder: nightOrder.firstNight,
    otherNightOrder: nightOrder.otherNight,
  };
}

function averageSuspicionByTarget(aiInsights = []) {
  const buckets = new Map();
  safeArray(aiInsights).forEach((row) => {
    safeArray(row.targets).forEach((target) => {
      const value = Number.isFinite(target.scoreValue) ? target.scoreValue : null;
      if (!target.id || value === null) return;
      const bucket = buckets.get(target.id) ?? [];
      bucket.push(value);
      buckets.set(target.id, bucket);
    });
  });
  const result = {};
  buckets.forEach((values, targetId) => {
    const avg = values.reduce((sum, item) => sum + item, 0) / Math.max(1, values.length);
    result[targetId] = Math.round(avg * 100);
  });
  return result;
}

function visibleRoleIdForUnity(state, player, note) {
  if (!player) return "";
  if (state?.grimoireView) return player.roleId ?? "";
  if (player.isHuman) return getPerceivedRoleId(player) ?? player.roleId ?? "";
  if (player.publicClaimRoleId) return player.publicClaimRoleId;
  if (note?.markedRoleId) return note.markedRoleId;
  return "";
}

function visibleRoleNameForUnity(state, player, roleId, note) {
  if (!player) return "未知";
  if (state?.grimoireView || player.isHuman || player.publicClaimRoleId) {
    return publicRoleLabel(state, player, !!state?.grimoireView);
  }
  if (note?.markedRoleId) {
    return getRoleById(state.scriptId, note.markedRoleId)?.name ?? note.markedRoleId;
  }
  if (roleId) {
    return getRoleById(state.scriptId, roleId)?.name ?? roleId;
  }
  return "未知";
}

function playerRemindersForUnity(state, player, note) {
  const reminders = [...safeArray(note?.reminders)];
  if (state?.grimoireView) {
    if (player.poisoned) reminders.push("中毒");
    if (player.drunk) reminders.push("醉酒");
  }
  if (!player.alive && player.ghostVoteAvailable) {
    reminders.push("鬼票");
  }
  return [...new Set(reminders)].slice(0, 5);
}

function buildPlayers(state, aiInsights) {
  const suspicion = averageSuspicionByTarget(aiInsights);
  return safeArray(state?.players)
    .slice()
    .sort((a, b) => a.seatIndex - b.seatIndex)
    .map((player) => {
      const note = state?.grimoireNotes?.[player.id] ?? null;
      const roleId = visibleRoleIdForUnity(state, player, note);
      const roleName = visibleRoleNameForUnity(state, player, roleId, note);
      const seat = (player.seatIndex ?? 0) + 1;
      return {
        id: player.id,
        seat,
        name: player.isHuman ? `${seat}号（你）` : `${seat}号`,
        roleId,
        roleName,
        actualRoleId: state?.grimoireView ? player.roleId ?? "" : "",
        perceivedRoleId: player.isHuman ? getPerceivedRoleId(player) ?? "" : "",
        markedRoleId: note?.markedRoleId ?? "",
        markedRoleName: note?.markedRoleId ? getRoleById(state.scriptId, note.markedRoleId)?.name ?? note.markedRoleId : "",
        revealed: !!roleId,
        alive: !!player.alive,
        human: !!player.isHuman,
        ghostVoteAvailable: !!player.ghostVoteAvailable,
        suspicion: suspicion[player.id] ?? 0,
        reminders: playerRemindersForUnity(state, player, note),
      };
    });
}

function buildBluffs(state) {
  const human = safeArray(state?.players).find((player) => player.isHuman);
  const canReveal = !!state?.grimoireView || human?.category === "demon";
  if (!canReveal) {
    return ["未知", "未知", "未知"];
  }
  return safeArray(state?.demonBluffs)
    .slice(0, 3)
    .map((entry) => entry?.name ?? entry?.id ?? "未知");
}

function buildPrivateInfo(state) {
  return safeArray(state?.pendingHumanInfo)
    .slice(-6)
    .map((entry) => cleanText(entry))
    .filter(Boolean);
}

function formatActionOptions(action, limit = 5) {
  const options = safeArray(action?.options)
    .slice(0, limit)
    .map((entry) => entry.name ?? entry.label ?? entry.id)
    .filter(Boolean);
  if (options.length === 0) return "";
  const suffix = safeArray(action?.options).length > limit ? " ..." : "";
  return `可选：${options.join(" / ")}${suffix}`;
}

function describeRoleAction(action, availableLabel, unavailableLabel) {
  if (!action?.available) {
    return `${unavailableLabel}：${cleanText(action?.reason ?? "当前不可用")}`;
  }
  const prompt = cleanText(action.prompt ?? "");
  const input = cleanText(action.inputType ?? "");
  const options = formatActionOptions(action);
  return [
    `${availableLabel}：${action.roleName ?? action.roleId ?? "角色行动"}`,
    input ? `输入：${input}` : "",
    prompt,
    options,
  ].filter(Boolean).join("\n");
}

function buildNominationText(state) {
  if (state?.phase !== "day") return "当前不在白天，不能提名。";
  if (state?.gameOver) return "对局已结束，不能继续提名。";
  const alive = safeArray(state?.players).filter((player) => player.alive);
  const human = alive.find((player) => player.isHuman);
  const nomineeCount = alive.filter((player) => !player.isHuman).length;
  if (state?.dayStage !== "nomination") {
    return `尚未进入提名阶段；可先公聊，再进入提名。存活可提名目标：${nomineeCount}`;
  }
  return `提名阶段：${human ? `${(human.seatIndex ?? 0) + 1}号可作为默认提名者` : "请选择提名者"}；存活可提名目标：${nomineeCount}`;
}

function buildPrivateDeceptionText(state) {
  if (state?.phase !== "day" || state?.dayStage !== "private") {
    return "当前不在私聊阶段，骗人接口不可用。";
  }
  const roles = getAllRoles(state.scriptId).slice(0, 6).map((role) => role.name);
  return `私聊可附带：声称身份、编夜间信息、请求保密。候选身份：${roles.join(" / ")}`;
}

function buildAiRecap(aiInsights) {
  return safeArray(aiInsights)
    .slice(0, 6)
    .map((row) => {
      const topTrail = safeArray(row.targets?.[0]?.trail);
      const trailText = topTrail.length > 0 ? `；证据链 ${topTrail.length} 条` : "";
      return `${row.name ?? row.id} -> ${row.target ?? "--"} ${row.score ?? "--"}：${row.reason ?? "暂无线索"}${trailText}`;
    });
}

function buildAiRecapDetails(aiInsights) {
  return safeArray(aiInsights)
    .slice(0, 6)
    .map((row) => ({
      id: row.id ?? "",
      name: row.name ?? row.id ?? "",
      targetId: row.targetId ?? "",
      target: row.target ?? "--",
      score: row.score ?? "--",
      reason: cleanText(row.reason ?? "暂无线索"),
      targets: safeArray(row.targets)
        .slice(0, 4)
        .map((target) => ({
          id: target.id ?? "",
          name: target.name ?? target.id ?? "",
          score: target.score ?? "--",
          scoreValue: Number.isFinite(target.scoreValue) ? target.scoreValue : 0,
          reason: cleanText(target.reason ?? "暂无明确理由"),
          trail: safeArray(target.trail)
            .slice(-4)
            .map((entry) => ({
              reasonKey: entry.reasonKey ?? "",
              evidenceKind: entry.evidenceKind ?? "",
              before: Number.isFinite(entry.before) ? entry.before : 0,
              after: Number.isFinite(entry.after) ? entry.after : 0,
              appliedDelta: Number.isFinite(entry.appliedDelta) ? entry.appliedDelta : 0,
              reason: cleanText(entry.reason ?? entry.label ?? entry.reasonKey ?? ""),
            })),
        })),
    }));
}

function buildVoteCeremony(state) {
  const vote = safeArray(state?.events?.votes).at(-1);
  if (!vote) {
    return null;
  }
  const playerById = new Map(safeArray(state?.players).map((player) => [player.id, player]));
  const nominee = playerById.get(vote.nomineeId);
  const nominator = playerById.get(vote.nominatorId);
  return {
    day: vote.day ?? state?.day ?? 0,
    nominatorId: vote.nominatorId ?? "",
    nominatorName: nominator?.name ?? vote.nominatorId ?? "",
    nomineeId: vote.nomineeId ?? "",
    nomineeName: nominee?.name ?? vote.nomineeId ?? "",
    yesVotes: vote.yesVotes ?? 0,
    threshold: vote.threshold ?? 0,
    passed: !!vote.passed,
    resultText: `投票结果：${vote.yesVotes ?? 0} / ${vote.threshold ?? 0}，${vote.passed ? "通过" : "未通过"}`,
    voters: safeArray(vote.votes).map((entry) => {
      const voter = playerById.get(entry.voterId);
      return {
        voterId: entry.voterId ?? "",
        voterName: voter?.name ?? entry.voterId ?? "",
        seat: (voter?.seatIndex ?? -1) + 1,
        alive: !!voter?.alive,
        ghostVote: !voter?.alive && !!entry.vote,
        vote: !!entry.vote,
        abstain: !!entry.abstain,
      };
    }),
  };
}

function buildActionForms({ nightAction, dayAction, storytellerAction }) {
  return [
    { id: "night-action", title: "夜间行动", action: nightAction },
    { id: "day-action", title: "白天行动", action: dayAction },
    { id: "storyteller-action", title: "Storyteller 队列", action: storytellerAction },
  ].map((entry) => {
    const action = buildRoleAction(entry.action);
    return {
      id: entry.id,
      title: entry.title,
      available: !!action.available,
      reason: action.reason ?? "",
      roleId: action.roleId ?? "",
      roleName: action.roleName ?? "",
      type: action.type ?? "",
      inputType: action.inputType ?? "",
      prompt: action.prompt ?? "",
      minTargetCount: action.minTargetCount ?? 0,
      maxTargetCount: action.maxTargetCount ?? 0,
      targetCount: action.targetCount ?? 0,
      options: safeArray(action.options),
      roleOptions: safeArray(action.roleOptions),
      modes: safeArray(action.modes),
      selectedTargetIds: safeArray(action.selectedTargetIds),
    };
  });
}

function buildPhaseObjective(state) {
  const queueCount = safeArray(state?.pendingStorytellerActions).length;
  const nightAction = getHumanNightActionState(state);
  const dayAction = getHumanDayActionState(state);

  if (queueCount > 0) {
    return {
      title: `处理 Storyteller 队列（${queueCount}）`,
      hint: "流程已暂停。先处理即时触发、死亡触发或特殊角色选择。",
    };
  }
  if (state?.gameOver) {
    return {
      title: "复盘本局",
      hint: state.winnerReason ?? "查看事件、时间线和 AI 推理摘要，然后可以新开一局。",
    };
  }
  if (state?.phase === "night") {
    return nightAction.available
      ? { title: `夜间行动：${nightAction.roleName}`, hint: nightAction.prompt ?? "Storyteller 正在等待你的选择。" }
      : { title: "夜晚结算中", hint: "JS Core 会按夜间顺序处理技能、死亡和私有信息。" };
  }
  if (state?.dayStage === "private") {
    const used = state?.dayStageMeta?.privateUsed ?? 0;
    const limit = state?.dayStageMeta?.privateLimit ?? 0;
    const followUsed = state?.dayStageMeta?.privateFollowUpUsed ?? 0;
    const followLimit = state?.dayStageMeta?.privateFollowUpLimit ?? 2;
    return {
      title: `私聊收集线索（${used}/${limit}）`,
      hint: `点击 token 后可私聊；同一对象追问 ${followUsed}/${followLimit}。`,
    };
  }
  if (state?.dayStage === "public") {
    const rounds = state?.dayStageMeta?.publicRounds ?? 0;
    return {
      title: `公聊形成公开信息（${rounds}轮）`,
      hint: "进行公聊后观察 timeline，再决定是否进入提名。",
    };
  }
  if (dayAction.available) {
    return {
      title: `白天行动：${dayAction.roleName}`,
      hint: dayAction.prompt ?? "可先发动白天技能，也可以进入提名投票。",
    };
  }
  return {
    title: "提名与投票",
    hint: "选择被提名者并结算投票；也可以让 AI 发起压力提名。",
  };
}

function roleActionSummary(label, action) {
  if (!action?.available) {
    return "";
  }
  const prompt = cleanText(action.prompt ?? "");
  return `${label}：${action.roleName ?? "角色行动"}${prompt ? ` - ${prompt}` : ""}`;
}

function buildActionSummary(state) {
  const bridge = state?.unityBridge ?? {};
  const selected = bridge.selectedPlayerId
    ? safeArray(state?.players).find((player) => player.id === bridge.selectedPlayerId)
    : null;
  const selectedText = selected ? `选中 ${(selected.seatIndex ?? 0) + 1}号${selected.isHuman ? "（你）" : ""}` : "未选中 token";
  const statusText = bridge.message ? `状态：${bridge.message}` : "状态：等待 Unity 操作";
  const parts = [
    selectedText,
    statusText,
    roleActionSummary("夜间", getHumanNightActionState(state)),
    roleActionSummary("白天", getHumanDayActionState(state)),
    roleActionSummary("Storyteller", getPendingStorytellerActionState(state)),
    buildNominationText(state),
  ].filter(Boolean);
  return parts.join("\n");
}

function buildStorytellerQueue(state) {
  return safeArray(state?.pendingStorytellerActions)
    .slice(0, 8)
    .map((action) => cleanText(action.prompt ?? action.title ?? action.kind ?? action.type ?? "待处理行动"));
}

function buildTimeline(state, limit = 16) {
  return safeArray(state?.aiDialogue?.timeline)
    .slice(-limit)
    .map((entry) => ({
      id: entry.id ?? "",
      mode: entry.mode ?? "event",
      speakerId: entry.speakerId ?? "",
      targetId: entry.targetId ?? "",
      text: cleanText(entry.text),
      day: entry.day ?? state.day ?? 0,
      night: entry.night ?? state.night ?? 0,
    }));
}

function teamLabel(team) {
  if (team === "good") return "善良阵营";
  if (team === "evil") return "邪恶阵营";
  return "";
}

function buildGameOutcome(state) {
  const gameOver = !!state?.gameOver || state?.phase === "ended";
  const winner = state?.winner ?? "";
  const winnerLabel = teamLabel(winner);
  const reason = cleanText(state?.winnerReason ?? "");
  const players = safeArray(state?.players);
  const alive = players.filter((player) => player?.alive).length;
  const dead = players.filter((player) => !player?.alive).length;
  const finalEvents = exportedLogs(state, 8);

  return {
    gameOver,
    winner,
    winnerLabel,
    title: gameOver ? `${winnerLabel || "本局"}胜利` : "",
    reason,
    summary: gameOver
      ? cleanText(`${reason || "胜负已结算。"} 存活 ${alive}，死亡 ${dead}。`)
      : "",
    alive,
    dead,
    finalEvents,
  };
}

export function buildUnityViewModel(state, { aiInsights = [], generatedAt = new Date() } = {}) {
  if (!state || !Array.isArray(state.players)) {
    throw new Error("buildUnityViewModel requires a game state with players.");
  }
  const dialogue = latestDialogue(state);
  const logs = exportedLogs(state, 12);
  const objective = buildPhaseObjective(state);
  const humanNightAction = getHumanNightActionState(state);
  const humanDayAction = getHumanDayActionState(state);
  const storytellerAction = getPendingStorytellerActionState(state);
  const gameOver = !!state.gameOver || state.phase === "ended";
  const outcome = buildGameOutcome(state);
  const phaseAdvance = buildUnityPhaseAdvance(state);
  return {
    version: UNITY_VIEWMODEL_VERSION,
    generatedAt: generatedAt instanceof Date ? generatedAt.toISOString() : `${generatedAt}`,
    gameId: state.id ?? "",
    scriptId: state.scriptId ?? "",
    scriptName: state.scriptName ?? "未知剧本",
    phase: state.phase ?? "setup",
    dayStage: state.dayStage ?? "none",
    phaseLabel: phaseLabel(state),
    gameOver,
    winner: state.winner ?? "",
    winnerReason: state.winnerReason ?? "",
    outcome,
    day: state.day ?? 0,
    night: state.night ?? 0,
    alive: safeArray(state.players).filter((player) => player.alive).length,
    dead: safeArray(state.players).filter((player) => !player.alive).length,
    setup: categorySetupText(state.setupCounts),
    grimoireView: !!state.grimoireView,
    bluffs: buildBluffs(state),
    phaseObjectiveTitle: objective.title,
    phaseObjectiveHint: objective.hint,
    phaseAdvance,
    actionSummary: buildActionSummary(state),
    privateInfo: buildPrivateInfo(state),
    nightActionText: describeRoleAction(humanNightAction, "夜间行动", "夜间行动"),
    dayActionText: describeRoleAction(humanDayAction, "白天行动", "白天行动"),
    storytellerActionText: describeRoleAction(storytellerAction, "Storyteller", "Storyteller"),
    nominationText: buildNominationText(state),
    privateDeceptionText: buildPrivateDeceptionText(state),
    aiRecap: buildAiRecap(aiInsights),
    aiRecapDetails: buildAiRecapDetails(aiInsights),
    voteCeremony: buildVoteCeremony(state),
    actionForms: buildActionForms({ nightAction: humanNightAction, dayAction: humanDayAction, storytellerAction }),
    dialogueTitle: dialogue.title,
    dialogueText: dialogue.text,
    events: logs.length > 0 ? logs : ["暂无事件。"],
    storytellerQueue: buildStorytellerQueue(state),
    timeline: buildTimeline(state),
    action: buildActionStatus(state),
    humanNightAction: buildRoleAction(humanNightAction),
    humanDayAction: buildRoleAction(humanDayAction),
    pendingStorytellerAction: buildRoleAction(storytellerAction),
    scriptHandbook: buildScriptHandbook(state),
    players: buildPlayers(state, aiInsights),
  };
}

export function stringifyUnityViewModel(viewModel) {
  return `${JSON.stringify(viewModel, null, 2)}\n`;
}
