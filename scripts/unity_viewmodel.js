import { getAllRoles, getRoleById } from "./data.js";
import {
  getHumanDayActionState,
  getHumanNightActionState,
  getNightOrderReference,
  getPendingStorytellerActionState,
  getPerceivedRoleId,
  publicRoleLabel,
  registersAsAlive,
  registersAsDead,
} from "./engine.js";
import { getOfficialRoleReference } from "./grimoire_reference.js";
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
      title: `玩家 · ${seat}号${selected.isHuman ? "（你）" : ""}`,
      text: [
        `身份显示：${roleName}`,
        `状态：${selected.alive ? "存活" : "死亡"}${selected.ghostVoteAvailable ? " · 有鬼票" : ""}`,
        reminders.length > 0 ? `标记：${reminders.join(" / ")}` : "",
        "已选中这名玩家；后续私聊、公聊、提名会优先围绕他执行。",
      ]
        .filter(Boolean)
        .join("\n"),
    };
  }

  const timeline = safeArray(state?.aiDialogue?.timeline).filter((entry) => !entry.hiddenFromHuman);
  const active = state?.aiDialogue?.activeSpeech ?? timeline[timeline.length - 1] ?? null;
  if (!active) {
    return {
      title: "对话舞台",
      text: "点击任意玩家查看可用操作；公聊、私聊、提名和夜间选择会在这里展开。",
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
    resolvedImmediately: !!bridge.resolvedImmediately,
    publicAction: !!bridge.publicAction,
    speechId: bridge.speechId ?? "",
    updatedAt: bridge.updatedAt ?? "",
    selectedPlayerId: bridge.selectedPlayerId ?? "",
    selectedPlayerName: selected ? `${(selected.seatIndex ?? 0) + 1}号${selected.isHuman ? "（你）" : ""}` : "",
    autoAdvance: bridge.autoAdvance ?? null,
    llmRenderer: buildLLMRendererStatus(state),
  };
}

function buildLLMRendererStatus(state) {
  const status = state?.unityBridge?.llmRenderer ?? {};
  return {
    enabled: !!status.enabled,
    provider: status.provider ?? status.source ?? "",
    source: status.source ?? status.provider ?? "",
    model: status.model ?? "",
    touched: Number.isFinite(status.touched) ? status.touched : 0,
    fallback: Number.isFinite(status.fallback) ? status.fallback : 0,
    reason: cleanText(status.reason ?? ""),
    updatedAt: status.updatedAt ?? "",
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
    minGuessCount: action.minGuessCount ?? 0,
    maxGuessCount: action.maxGuessCount ?? 0,
    optional: !!action.optional,
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
  const roles = getAllRoles(state.scriptId).map((role) => {
    const reference = getOfficialRoleReference(state.scriptId, role.id)
      ?? getOfficialRoleReference(state.scriptId, role.name);
    return {
      id: role.id,
      name: role.name,
      category: role.category,
      team: role.team,
      ability: reference?.ability ?? role.ability ?? role.description ?? "",
      icon: role.icon ?? "",
      firstNightReminder: reference?.firstNightReminder ?? "",
      otherNightReminder: reference?.otherNightReminder ?? "",
      reminders: safeArray(reference?.reminders),
      remindersGlobal: safeArray(reference?.remindersGlobal),
      firstNight: Number(reference?.firstNight ?? 0),
      otherNight: Number(reference?.otherNight ?? 0),
    };
  });
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
  if (registersAsDead(state, player)) {
    reminders.push("登记死亡");
  }
  if (state?.grimoireView) {
    if (player.poisoned) reminders.push("中毒");
    if (player.drunk) reminders.push("醉酒");
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
      const publicAlive = registersAsAlive(state, player);
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
        alive: publicAlive,
        actualAlive: !!player.alive,
        registersAsDead: registersAsDead(state, player),
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
  const alive = safeArray(state?.players).filter((player) => registersAsAlive(state, player));
  const human = alive.find((player) => player.isHuman);
  const nomineeCount = alive.filter((player) => !player.isHuman).length;
  const executionCandidate = buildExecutionCandidate(state);
  const onBlockText = executionCandidate?.active
    ? `；处决台：${executionCandidate.nomineeName}（${executionCandidate.yesVotes}/${executionCandidate.threshold}）`
    : "";
  if (state?.dayStage !== "nomination") {
    return `尚未进入提名窗口；先让公聊走到提名压力，再开启窗口。存活可提名目标：${nomineeCount}${onBlockText}`;
  }
  const clock = state?.dayStageMeta?.nominationClock;
  const clockText = clock?.status === "open"
    ? `窗口剩余 ${clock.ticksRemaining ?? 0}/${clock.totalTicks ?? 0}`
    : clock?.status === "nomination-made"
      ? "已有提名，等待互辩/投票"
      : clock?.status === "passed"
        ? "今日无人提名"
        : "窗口未开启";
  return `提名阶段：${clockText}；${human ? `${(human.seatIndex ?? 0) + 1}号可作为默认提名者` : "请选择提名者"}；存活可提名目标：${nomineeCount}${onBlockText}`;
}

function conversationClockLabel(clock) {
  return {
    opening: "开场",
    response: "回应",
    crossfire: "交锋",
    "nomination-ready": "提名压力",
    cooldown: "冷却",
  }[clock] ?? "公聊";
}

function buildPublicConversationStep(conversation) {
  const step = conversation?.lastStep;
  if (!step) {
    return null;
  }
  return {
    step: step.step ?? 0,
    clock: step.clock ?? "",
    speakerId: step.speakerId ?? "",
    speakerName: step.speakerName ?? "",
    targetId: step.targetId ?? "",
    targetName: step.targetName ?? "",
    stance: step.stance ?? "",
    question: step.question ?? "",
    reason: step.reason ?? "",
    followUp: step.followUp ?? "",
    nominationTendency: step.nominationTendency ?? "",
    line: step.line ?? "",
  };
}

function buildPublicConversation(state) {
  const conversation = state?.dayStageMeta?.publicConversation ?? {};
  const players = new Map(safeArray(state?.players).map((player) => [player.id, player]));
  const speaker = players.get(conversation.activeSpeakerId);
  const focus = players.get(conversation.focusId);
  const clock = conversation.clock ?? (state?.dayStage === "public" ? "opening" : "");
  return {
    active: state?.phase === "day" && state?.dayStage === "public",
    clock,
    label: conversationClockLabel(clock),
    step: conversation.step ?? 0,
    pressure: Number.isFinite(conversation.pressure) ? conversation.pressure : 0,
    speakerId: conversation.activeSpeakerId ?? "",
    speakerName: speaker?.name ?? "",
    focusId: conversation.focusId ?? "",
    focusName: focus?.name ?? "",
    canContinue: conversation.canContinue !== false,
    suggestedActions: safeArray(conversation.suggestedActions),
    lastStep: buildPublicConversationStep(conversation),
  };
}

function buildNominationClock(state) {
  const clock = state?.dayStageMeta?.nominationClock ?? {};
  return {
    active: !!clock.active,
    status: clock.status ?? "idle",
    ticksRemaining: clock.ticksRemaining ?? 0,
    totalTicks: clock.totalTicks ?? 0,
    progress: clock.totalTicks ? Math.max(0, Math.min(1, (clock.ticksRemaining ?? 0) / clock.totalTicks)) : 0,
    lastActorId: clock.lastActorId ?? "",
    lastIntent: clock.lastIntent ?? "",
  };
}

function buildExecutionCandidate(state) {
  const candidate = state?.dayStageMeta?.executionCandidate ?? null;
  if (!candidate || candidate.day !== (state?.day ?? 0)) {
    return null;
  }
  const players = new Map(safeArray(state?.players).map((player) => [player.id, player]));
  const nominee = players.get(candidate.nomineeId);
  const nominator = players.get(candidate.nominatorId);
  return {
    active: true,
    day: candidate.day ?? state?.day ?? 0,
    nomineeId: candidate.nomineeId ?? "",
    nomineeName: nominee?.name ?? candidate.nomineeId ?? "",
    nomineeSeat: (nominee?.seatIndex ?? -1) + 1,
    nominatorId: candidate.nominatorId ?? "",
    nominatorName: nominator?.name ?? candidate.nominatorId ?? "",
    yesVotes: candidate.yesVotes ?? 0,
    threshold: candidate.threshold ?? 0,
    voteIndex: candidate.voteIndex ?? -1,
    resultText: `${nominee?.name ?? candidate.nomineeId ?? "候选人"} 暂在处决台：${candidate.yesVotes ?? 0}/${candidate.threshold ?? 0}`,
  };
}

function buildNominationDebate(state) {
  const debate = state?.dayStageMeta?.nominationDebate ?? null;
  if (!debate) {
    return null;
  }
  const players = new Map(safeArray(state?.players).map((player) => [player.id, player]));
  const nominator = players.get(debate.nominatorId);
  const nominee = players.get(debate.nomineeId);
  const human = safeArray(state?.players).find((player) => player.isHuman);
  const humanLine = safeArray(debate.lines).find((line) => line.speakerId === human?.id && !!line.pending);
  return {
    active: !!debate.active,
    nominationId: debate.nominationId ?? "",
    day: debate.day ?? state?.day ?? 0,
    nominatorId: debate.nominatorId ?? "",
    nominatorName: nominator?.name ?? debate.nominatorId ?? "",
    nomineeId: debate.nomineeId ?? "",
    nomineeName: nominee?.name ?? debate.nomineeId ?? "",
    reason: nominationReasonUiLine(debate, debate.reason ?? ""),
    decisionRationale: debate.decisionRationale ?? null,
    strategyRationale: debate.strategyRationale ?? null,
    rationaleCards: buildNominationRationaleCards(debate.decisionRationale, debate.strategyRationale),
    nextAction: debate.nextAction ?? "vote",
    canHumanRespond: !!(debate.active && humanLine),
    humanSpeakerRole: humanLine?.role ?? "",
    responsePrompt:
      humanLine?.role === "nominee"
        ? "你被提名了。先回应身份和昨晚信息，再决定是否拉票。"
        : humanLine?.role === "nominator"
          ? "你可以补充提名理由。"
          : "",
    lines: safeArray(debate.lines).map((line) => {
      const speaker = players.get(line.speakerId);
      return {
        speakerId: line.speakerId ?? "",
        speakerName: speaker?.name ?? line.speakerId ?? "",
        role: line.role ?? "",
        text: nominationDebateLineUiText(line, debate),
        pending: !!line.pending,
      };
    }),
  };
}

function buildPrivateDeceptionText(state) {
  if (state?.phase !== "day" || state?.dayStage !== "private") {
    return "当前不在私聊阶段，骗人接口不可用。";
  }
  const roles = getAllRoles(state.scriptId).slice(0, 6).map((role) => role.name);
  return `私聊可附带：声称身份、编夜间信息、请求保密。候选身份：${roles.join(" / ")}`;
}

function buildPendingProactiveWhispers(state) {
  if (state?.phase !== "day" || state?.dayStage !== "private" || state?.gameOver) {
    return [];
  }
  return safeArray(state?.aiDialogue?.pendingProactiveWhispers)
    .filter((entry) => entry.day === (state.day ?? 0))
    .map((entry) => ({
      id: entry.id ?? "",
      playerId: entry.playerId ?? "",
      playerName: entry.playerName ?? entry.playerId ?? "",
      playerSeat: Number.isFinite(entry.playerSeat) ? entry.playerSeat : 0,
      publicIntent: proactiveWhisperPublicIntent(entry),
      publicReason: proactiveWhisperPublicReason(entry),
      isNew: entry.seen !== true,
    }));
}

function proactiveWhisperPublicIntent(entry) {
  const intent = `${entry?.intent ?? ""}`.trim().toLowerCase();
  return {
    claim: "想确认身份",
    compare: "想比较视角",
    night: "想同步信息",
    plan: "想聊下一步",
    reason: "想说明判断",
    suspect: "想聊怀疑",
    trust: "想建立互信",
    vote: "想聊提名投票",
  }[intent] ?? "想交换信息";
}

function proactiveWhisperPublicReason(entry) {
  const intent = proactiveWhisperPublicIntent(entry);
  const seat = Number.isFinite(entry?.playerSeat) && entry.playerSeat > 0 ? `${entry.playerSeat}号` : "";
  return `${seat ? `${seat}玩家` : "这名玩家"}${intent}。接受后才会显示具体内容。`;
}

function playerNameById(state, playerId) {
  const player = safeArray(state?.players).find((entry) => entry.id === playerId);
  return player?.name ?? playerId ?? "";
}

function buildAiSocialClues(state, limit = 8) {
  const seen = new Set();
  const lines = [];
  for (const agent of Object.values(state?.aiAgents ?? {})) {
    for (const evidence of safeArray(agent?.evidenceBook)) {
      if (evidence?.kind !== "private-channel" || evidence?.source !== "social-read") continue;
      const payload = evidence.payload ?? {};
      if (!payload.aiToAi) continue;
      const speakerId = payload.speakerId ?? "";
      const targetId = payload.targetId ?? "";
      if (!speakerId || !targetId) continue;
      const key = [speakerId, targetId].sort().join("::");
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push(`社交线索：${playerNameById(state, speakerId)} 与 ${playerNameById(state, targetId)} 有过私聊。`);
      if (lines.length >= limit) return lines;
    }
  }
  return lines;
}

function publicTimelineCount(state) {
  return safeArray(state?.aiDialogue?.timeline).filter(
    (entry) => entry.mode === "public" && entry.day === (state?.day ?? 0)
  ).length;
}

function buildConversationClock(state) {
  const beats = ["开场", "回应", "交锋", "提名压力", "冷却"];
  const count = publicTimelineCount(state);
  const beatIndex = Math.min(beats.length - 1, Math.max(0, Math.floor(count / 2)));
  const visible = state?.phase === "day" && state?.dayStage === "public" && !state?.gameOver;
  return {
    visible,
    beat: beats[beatIndex],
    beatIndex,
    beatCount: beats.length,
    progress: visible ? Math.min(1, Math.max(0.08, (beatIndex + 1) / beats.length)) : 0,
    label: visible ? `公聊时钟 · ${beats[beatIndex]}` : "",
    hint: visible
      ? beatIndex >= 3
        ? "讨论已进入提名压力；可以收束目标并准备进入提名窗口。"
        : "观察发言焦点变化，等信息形成后再推进到提名。"
      : "",
  };
}

function buildNominationWindow(state) {
  const visible = state?.phase === "day" && state?.dayStage === "nomination" && !state?.gameOver;
  const vote = safeArray(state?.events?.votes).at(-1);
  const hasTodayVote = !!vote && vote.day === (state?.day ?? 0);
  return {
    visible,
    label: visible ? "提名窗口" : "",
    progress: visible ? (hasTodayVote ? 1 : 0.28) : 0,
    expired: false,
    hint: visible
      ? hasTodayVote
        ? "提名已结算；查看互辩和投票仪式，然后决定是否结束白天。"
        : "玩家或 AI 可以主动提名；若没有合适目标，可空过今日。"
      : "",
  };
}

function strategyRationaleLabel(displayIntent) {
  return {
    "pressure-test": "压力测试",
    "coalition-check": "票面检验",
    "execution-push": "推进处决",
    "avoid-no-execution": "避免空过",
    "execution-info": "换取执行信息",
    "public-reason-flow": "公开理由推进",
    "information-check": "信息检验",
  }[displayIntent] ?? "策略判断";
}

function formatRationaleNumber(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "0";
  }
  return Number.isInteger(numeric) ? `${numeric}` : `${Math.round(numeric * 10) / 10}`;
}

function stripInternalNominationMath(value) {
  return cleanText(value)
    .replace(/票面约\s*[^，。；;]+[，。；;]?/g, "")
    .replace(/差值\s*-?\d+(?:\.\d+)?[，。；;]?/g, "")
    .replace(/分差\s*-?\d+(?:\.\d+)?/g, "分差很小")
    .replace(/\s+/g, " ")
    .replace(/，\s*，/g, "，")
    .replace(/。\s*。/g, "。")
    .trim();
}

function sentenceChunks(value) {
  return cleanText(value).match(/[^。！？!?]+[。！？!?]?/g) ?? [];
}

function clampUiLine(value, maxChars = 72) {
  const clean = stripInternalNominationMath(value);
  if (clean.length <= maxChars) return clean;
  const chunks = sentenceChunks(clean);
  let result = "";
  for (const chunk of chunks) {
    const next = cleanText(`${result}${result ? " " : ""}${chunk}`);
    if (next.length > maxChars) break;
    result = next;
  }
  if (result) return result;
  return `${clean.slice(0, Math.max(0, maxChars - 3)).trim()}...`;
}

function nominationStrategyUiLine(strategy) {
  const stripped = stripInternalNominationMath(strategy?.line ?? "");
  if (stripped) return clampUiLine(stripped, 72);
  return {
    "pressure-test": "这票先当压力测试，看回应、站边和票型。",
    "coalition-check": "这票先看谁愿意跟，谁在回避。",
    "execution-push": "这票已经接近处决窗口，可以推进。",
    "avoid-no-execution": "今天需要避免空过，先把可疑位放上台。",
    "execution-info": "这票主要换取处决信息和明天的站边。",
    "public-reason-flow": "这票跟着公开理由走，先让桌面回应。",
    "information-check": "这票先验证信息链是否能接上。",
  }[strategy?.displayIntent] ?? "这票主要换取回应和站边。";
}

function nominationReasonUiLine(debate, fallback = "") {
  const decision = debate?.decisionRationale ?? null;
  const strategy = debate?.strategyRationale ?? null;
  const targetName = cleanText(decision?.focusName ?? "");
  const primary = clampUiLine(decision?.spokenLine || decision?.line || fallback, 72);
  const verification = clampUiLine(
    decision?.verificationLine ||
      decision?.responseCriteriaLine ||
      (targetName ? `先听 ${targetName} 的身份和信息能不能接上。` : ""),
    64
  );
  const strategyLine = nominationStrategyUiLine(strategy);
  return clampUiLine([primary, verification || strategyLine].filter(Boolean).join(" "), 112);
}

function nominationDebateLineUiText(line, debate) {
  const text = cleanText(line?.text ?? "");
  if (line?.pending) return text;
  if (line?.role === "nominator") {
    return nominationReasonUiLine(debate, text);
  }
  return clampUiLine(text, 112);
}

function buildNominationRationaleCards(decisionRationale, strategyRationale) {
  const cards = [];
  const decision = decisionRationale ?? null;
  const strategy = strategyRationale ?? null;
  if (decision) {
    const targetName = cleanText(decision.focusName ?? decision.focusId ?? "目标");
    const runnerUpName = cleanText(decision.runnerUpName ?? "");
    const comparison = runnerUpName
      ? `对比 ${runnerUpName}，分差 ${formatRationaleNumber(decision.scoreGap)}，证据 ${decision.focusEvidenceCount ?? 0}/${decision.runnerUpEvidenceCount ?? 0}。`
      : "没有稳定第二候选，先处理当前最可验证的位置。";
    cards.push({
      id: "target-choice",
      kind: "decision",
      title: "目标选择",
      summary: clampUiLine(decision.spokenLine || decision.line || `${targetName} 是当前优先目标。`, 64),
      detail: clampUiLine([comparison, decision.evidenceModeLine, decision.evidenceBoundaryLine, decision.confidenceLine].filter(Boolean).join(" "), 86),
      targetId: decision.focusId ?? "",
      targetName,
      runnerUpId: decision.runnerUpId ?? "",
      runnerUpName,
      confidenceBand: decision.confidenceBand ?? "",
      evidenceMode: decision.evidenceMode ?? "",
      evidenceModeLine: cleanText(decision.evidenceModeLine ?? ""),
      evidenceInteractionLine: cleanText(decision.evidenceInteractionLine ?? ""),
      sourceReliabilityLine: cleanText(decision.sourceReliabilityLine ?? ""),
      timelineConsistencyLine: cleanText(decision.timelineConsistencyLine ?? ""),
      incentiveAlignmentLine: cleanText(decision.incentiveAlignmentLine ?? ""),
      burdenOfProofLine: cleanText(decision.burdenOfProofLine ?? ""),
      questionPriorityLine: cleanText(decision.questionPriorityLine ?? ""),
      actionThresholdLine: cleanText(decision.actionThresholdLine ?? ""),
      memoryContinuityLine: cleanText(decision.memoryContinuityLine ?? ""),
      expressionDisciplineLine: cleanText(decision.expressionDisciplineLine ?? ""),
      uncertaintyResolutionLine: cleanText(decision.uncertaintyResolutionLine ?? ""),
      evidenceFreshnessLine: cleanText(decision.evidenceFreshnessLine ?? ""),
      falsificationCheckLine: cleanText(decision.falsificationCheckLine ?? ""),
      causalChainLine: cleanText(decision.causalChainLine ?? ""),
      assumptionAuditLine: cleanText(decision.assumptionAuditLine ?? ""),
      mechanicSensitivityLine: cleanText(decision.mechanicSensitivityLine ?? ""),
      roleHypothesisLine: cleanText(decision.roleHypothesisLine ?? ""),
      pressureStageLine: cleanText(decision.pressureStageLine ?? ""),
      timingWindowLine: cleanText(decision.timingWindowLine ?? ""),
      worldBranchLine: cleanText(decision.worldBranchLine ?? ""),
      voteCoalitionLine: cleanText(decision.voteCoalitionLine ?? ""),
      tableRiskLine: cleanText(decision.tableRiskLine ?? ""),
      informationGainLine: cleanText(decision.informationGainLine ?? ""),
      tableReactionLine: cleanText(decision.tableReactionLine ?? ""),
      evidenceBoundaryLine: cleanText(decision.evidenceBoundaryLine ?? ""),
      responseCriteriaLine: cleanText(decision.responseCriteriaLine ?? ""),
      counterEvidenceLine: cleanText(decision.counterEvidenceLine ?? ""),
      runnerUpWatchLine: cleanText(decision.runnerUpWatchLine ?? ""),
      confidenceLine: cleanText(decision.confidenceLine ?? ""),
      reasonKey: decision.reasonKey ?? "",
    });
    cards.push({
      id: "verification",
      kind: "verification",
      title: "下一步验证",
      summary: clampUiLine(decision.verificationLine || `让 ${targetName} 把身份、公开证据链和投票理由说清楚。`, 72),
      detail: clampUiLine([decision.responsePlanLine, decision.responseCriteriaLine, decision.reconsiderationLine || decision.verificationQuestion].filter(Boolean).join(" "), 86),
      verificationLine: cleanText(decision.verificationLine ?? ""),
      evidenceMode: decision.evidenceMode ?? "",
      evidenceModeLine: cleanText(decision.evidenceModeLine ?? ""),
      responsePlanLine: cleanText(decision.responsePlanLine ?? ""),
      responseCriteriaLine: cleanText(decision.responseCriteriaLine ?? ""),
      evidenceInteractionLine: cleanText(decision.evidenceInteractionLine ?? ""),
      sourceReliabilityLine: cleanText(decision.sourceReliabilityLine ?? ""),
      timelineConsistencyLine: cleanText(decision.timelineConsistencyLine ?? ""),
      incentiveAlignmentLine: cleanText(decision.incentiveAlignmentLine ?? ""),
      burdenOfProofLine: cleanText(decision.burdenOfProofLine ?? ""),
      questionPriorityLine: cleanText(decision.questionPriorityLine ?? ""),
      actionThresholdLine: cleanText(decision.actionThresholdLine ?? ""),
      memoryContinuityLine: cleanText(decision.memoryContinuityLine ?? ""),
      expressionDisciplineLine: cleanText(decision.expressionDisciplineLine ?? ""),
      uncertaintyResolutionLine: cleanText(decision.uncertaintyResolutionLine ?? ""),
      evidenceFreshnessLine: cleanText(decision.evidenceFreshnessLine ?? ""),
      falsificationCheckLine: cleanText(decision.falsificationCheckLine ?? ""),
      causalChainLine: cleanText(decision.causalChainLine ?? ""),
      assumptionAuditLine: cleanText(decision.assumptionAuditLine ?? ""),
      mechanicSensitivityLine: cleanText(decision.mechanicSensitivityLine ?? ""),
      roleHypothesisLine: cleanText(decision.roleHypothesisLine ?? ""),
      pressureStageLine: cleanText(decision.pressureStageLine ?? ""),
      timingWindowLine: cleanText(decision.timingWindowLine ?? ""),
      worldBranchLine: cleanText(decision.worldBranchLine ?? ""),
      voteCoalitionLine: cleanText(decision.voteCoalitionLine ?? ""),
      tableRiskLine: cleanText(decision.tableRiskLine ?? ""),
      informationGainLine: cleanText(decision.informationGainLine ?? ""),
      tableReactionLine: cleanText(decision.tableReactionLine ?? ""),
      counterEvidenceLine: cleanText(decision.counterEvidenceLine ?? ""),
      evidenceBoundaryLine: cleanText(decision.evidenceBoundaryLine ?? ""),
      runnerUpWatchLine: cleanText(decision.runnerUpWatchLine ?? ""),
      confidenceLine: cleanText(decision.confidenceLine ?? ""),
      reconsiderationLine: cleanText(decision.reconsiderationLine ?? ""),
      targetId: decision.focusId ?? "",
      targetName,
    });
  }
  if (strategy) {
    const voteText = strategy.likelyPasses ? "有机会通过" : "先看回应";
    cards.push({
      id: "vote-strategy",
      kind: "strategy",
      title: strategyRationaleLabel(strategy.displayIntent),
      summary: nominationStrategyUiLine(strategy),
      detail: voteText,
      displayIntent: strategy.displayIntent ?? "",
      expectedSupport: Number.isFinite(Number(strategy.expectedSupport)) ? Number(strategy.expectedSupport) : 0,
      threshold: Number.isFinite(Number(strategy.threshold)) ? Number(strategy.threshold) : 0,
      margin: Number.isFinite(Number(strategy.margin)) ? Number(strategy.margin) : 0,
      likelyPasses: !!strategy.likelyPasses,
    });
  }
  return cards;
}

function buildTimelineRationaleSummary(entry) {
  const decision = entry?.decisionRationale ?? null;
  const claimDisclosure = entry?.claimDisclosureRationale ?? null;
  const strategy = entry?.strategyRationale ?? null;
  const crossDay = normalizeCrossDayStance(entry?.crossDayStance);
  const claimContinuity = cleanText(claimDisclosure?.continuitySummary || claimDisclosure?.continuityLine || "");
  const primary = cleanText(
    decision?.spokenLine ||
      decision?.line ||
      claimDisclosure?.spokenLine ||
      claimDisclosure?.line ||
      strategy?.line ||
      safeArray(entry?.rationaleCards).find((card) => card?.summary)?.summary ||
      entry?.rationaleSummary ||
      ""
  );
  if (claimContinuity && primary && !primary.includes(claimContinuity)) {
    const withClaimContinuity = cleanText(`${claimContinuity} ${primary}`);
    if (crossDay?.summary && !withClaimContinuity.includes(crossDay.summary)) {
      return cleanText(`${crossDay.summary} ${withClaimContinuity}`);
    }
    return withClaimContinuity;
  }
  if (crossDay?.summary && primary && !primary.includes(crossDay.summary)) {
    return cleanText(`${crossDay.summary} ${primary}`);
  }
  return cleanText(
    primary ||
      claimContinuity ||
      crossDay?.summary ||
      ""
  );
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

function playerNameMap(state) {
  return new Map(safeArray(state?.players).map((player) => [player.id, player.name ?? player.id]));
}

function finiteRationaleNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.round(numeric * 1000) / 1000 : fallback;
}

function normalizeClaimDisclosureRationale(rationale) {
  if (!rationale) return null;
  return {
    kind: rationale.kind ?? "claim-disclosure-rationale",
    audience: rationale.audience ?? "",
    publicOnly: !!rationale.publicOnly,
    speakerId: rationale.speakerId ?? "",
    speakerName: rationale.speakerName ?? "",
    level: rationale.level ?? "",
    previousLevel: rationale.previousLevel ?? "",
    previousRoleId: rationale.previousRoleId ?? "",
    previousRoleName: rationale.previousRoleName ?? "",
    previousRangeLabel: cleanText(rationale.previousRangeLabel ?? ""),
    roleId: rationale.roleId ?? "",
    roleName: rationale.roleName ?? "",
    rangeLabel: cleanText(rationale.rangeLabel ?? ""),
    family: rationale.family ?? "",
    exposure: rationale.exposure ?? "",
    reasonKey: rationale.reasonKey ?? "",
    day: Number.isFinite(Number(rationale.day)) ? Number(rationale.day) : 0,
    trustScore: finiteRationaleNumber(rationale.trustScore, 0),
    selfHeat: finiteRationaleNumber(rationale.selfHeat, 0),
    pressure: finiteRationaleNumber(rationale.pressure, 0),
    alreadyClaimed: !!rationale.alreadyClaimed,
    canRevealRole: !!rationale.canRevealRole,
    channel: rationale.channel ?? "",
    continuity: rationale.continuity ?? "",
    continuityLine: cleanText(rationale.continuityLine ?? ""),
    continuitySummary: cleanText(rationale.continuitySummary ?? ""),
    line: cleanText(rationale.line ?? ""),
    spokenLine: cleanText(rationale.spokenLine ?? ""),
  };
}

function stanceLabel(stance) {
  return {
    press: "强压",
    suspect: "怀疑",
    watch: "观察",
    trust: "偏信",
    unknown: "未知",
  }[stance] ?? cleanText(stance || "观察");
}

function normalizeCrossDayEvidenceAnchor(anchor) {
  return {
    evidenceId: anchor?.evidenceId ?? anchor?.id ?? "",
    observationId: anchor?.observationId ?? "",
    kind: anchor?.kind ?? "",
    source: anchor?.source ?? "",
    sourceId: anchor?.sourceId ?? "",
    visibility: anchor?.visibility ?? "",
    day: Number.isFinite(Number(anchor?.day)) ? Number(anchor.day) : 0,
    night: Number.isFinite(Number(anchor?.night)) ? Number(anchor.night) : 0,
    timestamp: Number.isFinite(Number(anchor?.timestamp)) ? Number(anchor.timestamp) : 0,
    text: cleanText(anchor?.text ?? ""),
  };
}

function normalizeCrossDayEventAnchor(anchor) {
  return {
    eventId: anchor?.eventId ?? anchor?.id ?? "",
    timelineEntryId: anchor?.timelineEntryId ?? anchor?.eventId ?? anchor?.id ?? "",
    mode: anchor?.mode ?? "",
    source: anchor?.source ?? "",
    audience: anchor?.audience ?? "",
    speakerId: anchor?.speakerId ?? "",
    targetId: anchor?.targetId ?? "",
    focusId: anchor?.focusId ?? anchor?.targetId ?? "",
    visibility: anchor?.visibility ?? "",
    day: Number.isFinite(Number(anchor?.day)) ? Number(anchor.day) : 0,
    night: Number.isFinite(Number(anchor?.night)) ? Number(anchor.night) : 0,
    timestamp: Number.isFinite(Number(anchor?.timestamp)) ? Number(anchor.timestamp) : 0,
    focusScore: finiteRationaleNumber(anchor?.focusScore, 0),
    text: cleanText(anchor?.text ?? ""),
  };
}

function normalizeCrossDayScoreTrailAnchor(anchor) {
  return {
    trailId: anchor?.trailId ?? anchor?.id ?? "",
    evidenceId: anchor?.evidenceId ?? "",
    observationId: anchor?.observationId ?? "",
    reasonKey: anchor?.reasonKey ?? "",
    kind: anchor?.kind ?? anchor?.evidenceKind ?? "",
    source: anchor?.source ?? "",
    sourceId: anchor?.sourceId ?? "",
    visibility: anchor?.visibility ?? "",
    day: Number.isFinite(Number(anchor?.day)) ? Number(anchor.day) : 0,
    night: Number.isFinite(Number(anchor?.night)) ? Number(anchor.night) : 0,
    timestamp: Number.isFinite(Number(anchor?.timestamp)) ? Number(anchor.timestamp) : 0,
    before: finiteRationaleNumber(anchor?.before, 0),
    after: finiteRationaleNumber(anchor?.after, 0),
    appliedDelta: finiteRationaleNumber(anchor?.appliedDelta, 0),
    text: cleanText(anchor?.text ?? ""),
  };
}

function normalizeCrossDayStance(crossDay) {
  if (!crossDay) return null;
  const continuity = crossDay.continuity === "hold" ? "hold" : crossDay.continuity === "shift" ? "shift" : "";
  const dayGap = Number.isFinite(Number(crossDay.dayGap)) ? Number(crossDay.dayGap) : 0;
  const dayWord = dayGap <= 1 ? "昨天" : `${dayGap}天前`;
  const previousLabel = stanceLabel(crossDay.previousStance);
  const currentLabel = stanceLabel(crossDay.currentStance);
  const reason = cleanText(crossDay.currentReasonSummary ?? "");
  const summary =
    continuity === "hold"
      ? cleanText(`${dayWord}延续“${currentLabel}”${reason ? `，仍卡在${reason}` : ""}。`)
      : continuity === "shift"
      ? cleanText(`${dayWord}是“${previousLabel}”，今天转“${currentLabel}”${reason ? `，因为${reason}` : ""}。`)
      : "";
  return {
    kind: crossDay.kind ?? "cross-day-stance",
    speakerId: crossDay.speakerId ?? "",
    targetId: crossDay.targetId ?? "",
    previousDay: Number.isFinite(Number(crossDay.previousDay)) ? Number(crossDay.previousDay) : 0,
    currentDay: Number.isFinite(Number(crossDay.currentDay)) ? Number(crossDay.currentDay) : 0,
    dayGap,
    previousStance: crossDay.previousStance ?? "",
    currentStance: crossDay.currentStance ?? "",
    continuity,
    previousScore: finiteRationaleNumber(crossDay.previousScore, 0),
    currentScore: finiteRationaleNumber(crossDay.currentScore, 0),
    previousReasonSummary: cleanText(crossDay.previousReasonSummary ?? ""),
    currentReasonSummary: reason,
    previousEvidenceCount: finiteRationaleNumber(crossDay.previousEvidenceCount, 0),
    currentEvidenceCount: finiteRationaleNumber(crossDay.currentEvidenceCount, 0),
    evidenceDelta: finiteRationaleNumber(crossDay.evidenceDelta, 0),
    changeSummary: cleanText(crossDay.changeSummary ?? ""),
    previousEvidenceSnippets: safeArray(crossDay.previousEvidenceSnippets).map(cleanText).filter(Boolean),
    currentEvidenceSnippets: safeArray(crossDay.currentEvidenceSnippets).map(cleanText).filter(Boolean),
    previousEvidenceAnchors: safeArray(crossDay.previousEvidenceAnchors).map(normalizeCrossDayEvidenceAnchor),
    currentEvidenceAnchors: safeArray(crossDay.currentEvidenceAnchors).map(normalizeCrossDayEvidenceAnchor),
    previousEventAnchors: safeArray(crossDay.previousEventAnchors).map(normalizeCrossDayEventAnchor),
    currentEventAnchors: safeArray(crossDay.currentEventAnchors).map(normalizeCrossDayEventAnchor),
    previousScoreTrailAnchors: safeArray(crossDay.previousScoreTrailAnchors).map(normalizeCrossDayScoreTrailAnchor),
    currentScoreTrailAnchors: safeArray(crossDay.currentScoreTrailAnchors).map(normalizeCrossDayScoreTrailAnchor),
    previousSources: safeArray(crossDay.previousSources).map((source) => `${source ?? ""}`).filter(Boolean),
    currentSources: safeArray(crossDay.currentSources).map((source) => `${source ?? ""}`).filter(Boolean),
    summary,
  };
}

function normalizeDecisionComparisonTrace(trace, decision = {}) {
  const source = trace ?? decision?.comparisonTrace ?? null;
  if (!source) return null;
  const focusName = cleanText(source.focusName ?? decision?.focusName ?? "");
  const runnerUpName = cleanText(source.runnerUpName ?? decision?.runnerUpName ?? "");
  const focusReason = cleanText(source.focusReason ?? "");
  const runnerUpReason = cleanText(source.runnerUpReason ?? "");
  const fallbackSummary = focusName
    ? `${focusName}：${focusReason || "证据待补"}；${runnerUpName || "第二候选"}：${runnerUpReason || "证据待补"}`
    : "";
  const summary = cleanText(source.summary ?? fallbackSummary);
  if (!summary) return null;
  return {
    kind: source.kind ?? "target-comparison-trace",
    publicOnly: !!(source.publicOnly ?? decision?.publicOnly),
    focusId: source.focusId ?? decision?.focusId ?? "",
    focusName,
    focusScore: finiteRationaleNumber(source.focusScore ?? decision?.focusScore, 0),
    focusEvidenceCount: finiteRationaleNumber(source.focusEvidenceCount ?? decision?.focusEvidenceCount, 0),
    focusReason,
    focusEvidenceSummary: cleanText(source.focusEvidenceSummary ?? ""),
    runnerUpId: source.runnerUpId ?? decision?.runnerUpId ?? "",
    runnerUpName,
    runnerUpScore: finiteRationaleNumber(source.runnerUpScore ?? decision?.runnerUpScore, 0),
    runnerUpEvidenceCount: finiteRationaleNumber(source.runnerUpEvidenceCount ?? decision?.runnerUpEvidenceCount, 0),
    runnerUpReason,
    runnerUpEvidenceSummary: cleanText(source.runnerUpEvidenceSummary ?? ""),
    scoreGap: finiteRationaleNumber(source.scoreGap ?? decision?.scoreGap, 0),
    reasonKey: source.reasonKey ?? decision?.reasonKey ?? "",
    confidenceBand: source.confidenceBand ?? decision?.confidenceBand ?? "",
    summary,
  };
}

function buildReasoningEvidenceSnippets(entry) {
  const snippets = [];
  const crossDay = normalizeCrossDayStance(entry?.crossDayStance);
  if (crossDay?.summary) {
    snippets.push({
      kind: "cross-day-stance",
      text: crossDay.summary,
      source: "cross-day-stance",
      focusEvidenceCount: crossDay.currentEvidenceCount,
      runnerUpEvidenceCount: 0,
    });
  }
  const claimDisclosure = normalizeClaimDisclosureRationale(entry?.claimDisclosureRationale);
  const claimText = cleanText(
    claimDisclosure?.continuitySummary ||
      claimDisclosure?.continuityLine ||
      claimDisclosure?.spokenLine ||
      claimDisclosure?.line ||
      ""
  );
  if (claimText) {
    snippets.push({
      kind: claimDisclosure?.continuity ? `claim-${claimDisclosure.continuity}` : "claim-disclosure",
      text: claimText,
      source: "claim-disclosure",
      focusEvidenceCount: 0,
      runnerUpEvidenceCount: 0,
    });
  }
  const evidenceSummary = cleanText(entry?.evidenceSummary ?? "");
  if (evidenceSummary) {
    snippets.push({
      kind: entry?.evidenceKind ?? "",
      text: evidenceSummary,
      source: "timeline",
      focusEvidenceCount: 0,
      runnerUpEvidenceCount: 0,
    });
  }

  const decision = entry?.decisionRationale ?? null;
  if (decision) {
    const focusCount = finiteRationaleNumber(decision.focusEvidenceCount, 0);
    const runnerUpCount = finiteRationaleNumber(decision.runnerUpEvidenceCount, 0);
    if (focusCount > 0 || runnerUpCount > 0) {
      const focusName = cleanText(decision.focusName ?? "目标");
      const runnerUpName = cleanText(decision.runnerUpName ?? "第二候选");
      snippets.push({
        kind: decision.reasonKey ?? "decision-count",
        text: cleanText(`${focusName} 证据 ${focusCount} 条；${runnerUpName} ${runnerUpCount} 条。`),
        source: "decision-rationale",
        focusEvidenceCount: focusCount,
        runnerUpEvidenceCount: runnerUpCount,
      });
    }
    const comparisonTrace = normalizeDecisionComparisonTrace(decision.comparisonTrace, decision);
    if (comparisonTrace?.summary) {
      snippets.push({
        kind: comparisonTrace.reasonKey || "decision-comparison",
        text: cleanText(`对比：${comparisonTrace.summary}`),
        source: "decision-comparison",
        focusEvidenceCount: comparisonTrace.focusEvidenceCount,
        runnerUpEvidenceCount: comparisonTrace.runnerUpEvidenceCount,
      });
    }
  }

  const seen = new Set();
  return snippets
    .filter((snippet) => {
      const text = cleanText(snippet.text);
      if (!text || seen.has(text)) return false;
      seen.add(text);
      snippet.text = text;
      return true;
    })
    .slice(0, 4);
}

function evidenceRowText(evidence) {
  return cleanText(
    evidence?.text ||
      evidence?.dialogueSummary ||
      evidence?.payload?.text ||
      evidence?.payload?.line ||
      evidence?.payload?.reason ||
      evidence?.payload?.claimText ||
      evidence?.payload?.summary ||
      ""
  );
}

function firstCleanText(...values) {
  for (const value of values) {
    const text = cleanText(value ?? "");
    if (text) return text;
  }
  return "";
}

function inferReasoningEvidenceTimelineAnchor(row, evidence, entry, timelineIndex = -1) {
  if (!entry?.id || !Number.isFinite(Number(entry?.timestamp))) return null;
  const evidenceTimestamp = Number(row?.timestamp ?? evidence?.timestamp);
  if (!Number.isFinite(evidenceTimestamp) || evidenceTimestamp !== Number(entry.timestamp)) return null;
  const evidenceText = evidenceRowText({ ...evidence, ...row });
  const entryText = cleanText([
    entry?.text,
    entry?.evidenceSummary,
    entry?.decisionRationale?.spokenLine,
    entry?.decisionRationale?.line,
  ].filter(Boolean).join(" "));
  const evidenceKind = cleanText(row?.evidenceKind || evidence?.kind || evidence?.evidenceType || "");
  const kindMatches = evidenceKind && evidenceKind === cleanText(entry?.evidenceKind ?? "");
  const textMatches = evidenceText && entryText && (entryText.includes(evidenceText) || evidenceText.includes(entryText));
  if (!kindMatches && !textMatches) return null;
  return {
    timelineEntryId: entry.id ?? "",
    timelineIndex: Number.isInteger(timelineIndex) ? timelineIndex : -1,
    timelineText: cleanText(entry.text ?? ""),
  };
}

function normalizeReasoningEvidenceRow(row, evidence, names, entry = null, timelineIndex = -1) {
  const sourceId = row?.sourceId || evidence?.sourceId || "";
  const reliabilityScore = finiteRationaleNumber(row?.reliabilityScore ?? evidence?.reliabilityScore, 0);
  const contaminationRisk = finiteRationaleNumber(row?.contaminationRisk ?? evidence?.contaminationRisk, 0);
  const timelineIndexValue = row?.timelineIndex ?? evidence?.timelineIndex;
  const inferredAnchor = inferReasoningEvidenceTimelineAnchor(row, evidence, entry, timelineIndex);
  return {
    id: row?.id ?? evidence?.id ?? "",
    evidenceId: row?.evidenceId ?? evidence?.id ?? "",
    observationId: row?.observationId ?? evidence?.observationId ?? "",
    timelineEntryId: firstCleanText(row?.timelineEntryId, evidence?.timelineEntryId, row?.eventId, evidence?.eventId, inferredAnchor?.timelineEntryId),
    timelineIndex: Number.isInteger(timelineIndexValue) ? timelineIndexValue : inferredAnchor?.timelineIndex ?? -1,
    timelineText: firstCleanText(row?.timelineText, evidence?.timelineText, inferredAnchor?.timelineText),
    reasonKey: row?.reasonKey ?? "",
    kind: row?.evidenceKind || evidence?.kind || evidence?.evidenceType || "",
    source: row?.source || evidence?.source || "",
    sourceId,
    sourceName: names.get(sourceId) ?? sourceId,
    visibility: row?.visibility || evidence?.visibility || "",
    reliabilityScore,
    contaminationRisk,
    canBeFalse: !!(row?.canBeFalse ?? evidence?.canBeFalse),
    before: finiteRationaleNumber(row?.before, 0),
    after: finiteRationaleNumber(row?.after, 0),
    appliedDelta: finiteRationaleNumber(row?.appliedDelta, 0),
    text: cleanText(row?.text || evidenceRowText(evidence)),
    day: row?.day ?? evidence?.day ?? 0,
    night: row?.night ?? evidence?.night ?? 0,
    timestamp: Number.isFinite(Number(row?.timestamp ?? evidence?.timestamp)) ? Number(row?.timestamp ?? evidence?.timestamp) : 0,
  };
}

function buildReasoningEvidenceRows(state, names, speakerId, targetId, entry, timelineIndex = -1) {
  const agent = state?.aiAgents?.[speakerId] ?? null;
  if (!agent || !targetId) return [];
  const evidenceById = new Map(safeArray(agent.evidenceBook).map((evidence) => [evidence.id, evidence]));
  const day = entry?.day ?? state?.day ?? 0;
  const cutoff = Number(entry?.timestamp);
  const withinEntryTime = (row) => !Number.isFinite(cutoff) || !Number.isFinite(Number(row?.timestamp)) || Number(row.timestamp) <= cutoff;
  const trailRows = safeArray(agent.beliefTrailByPlayerId?.[targetId])
    .filter((row) => (row?.day ?? day) === day)
    .filter(withinEntryTime)
    .sort((a, b) => Number(b?.timestamp ?? 0) - Number(a?.timestamp ?? 0))
    .slice(0, 3)
    .map((row) => normalizeReasoningEvidenceRow(row, evidenceById.get(row?.evidenceId), names, entry, timelineIndex))
    .filter((row) => row.text || row.evidenceId || row.reasonKey);
  if (trailRows.length > 0) return trailRows;

  return safeArray(agent.evidenceBook)
    .filter((evidence) => safeArray(evidence?.targetIds).includes(targetId))
    .filter((evidence) => (evidence?.day ?? day) === day)
    .filter(withinEntryTime)
    .sort((a, b) => Number(b?.timestamp ?? 0) - Number(a?.timestamp ?? 0))
    .slice(0, 3)
    .map((evidence) => normalizeReasoningEvidenceRow(
      {
        id: `row-${evidence.id ?? ""}`,
        evidenceId: evidence.id ?? "",
        reasonKey: "evidence-book",
        evidenceKind: evidence.kind ?? evidence.evidenceType ?? "",
        before: 0,
        after: 0,
        appliedDelta: 0,
      },
      evidence,
      names,
      entry,
      timelineIndex
    ))
    .filter((row) => row.text || row.evidenceId);
}

function buildReasoningScorePoint(entry, summary, evidenceRows = [], timelineIndex = -1) {
  const decision = entry?.decisionRationale ?? null;
  if (!decision) return null;
  const focusScore = finiteRationaleNumber(decision.focusScore, NaN);
  if (!Number.isFinite(focusScore)) return null;
  return {
    timelineEntryId: entry?.id ?? "",
    timelineIndex: Number.isInteger(timelineIndex) ? timelineIndex : -1,
    timelineText: cleanText(entry?.text ?? ""),
    timestamp: Number.isFinite(Number(entry?.timestamp)) ? Number(entry.timestamp) : 0,
    mode: entry?.mode ?? "event",
    summary: cleanText(summary),
    focusScore,
    runnerUpScore: finiteRationaleNumber(decision.runnerUpScore, 0),
    scoreGap: finiteRationaleNumber(decision.scoreGap, 0),
    focusEvidenceCount: finiteRationaleNumber(decision.focusEvidenceCount, 0),
    runnerUpEvidenceCount: finiteRationaleNumber(decision.runnerUpEvidenceCount, 0),
    confidenceBand: decision.confidenceBand ?? "",
    reasonKey: decision.reasonKey ?? "",
    comparisonTrace: normalizeDecisionComparisonTrace(decision.comparisonTrace, decision),
    evidenceRows,
    crossDayStance: normalizeCrossDayStance(entry?.crossDayStance),
    claimDisclosureRationale: normalizeClaimDisclosureRationale(entry?.claimDisclosureRationale),
    day: entry?.day ?? 0,
    night: entry?.night ?? 0,
  };
}

function scoreTrendFromDelta(delta) {
  if (delta >= 0.03) return "rising";
  if (delta <= -0.03) return "falling";
  return "steady";
}

function buildAiReasoningRecap(state, limit = 6) {
  const names = playerNameMap(state);
  const groups = new Map();
  safeArray(state?.aiDialogue?.timeline)
    .filter((entry) => !entry?.hiddenFromHuman)
    .forEach((entry, index) => {
      const summary = buildTimelineRationaleSummary(entry);
      if (!summary) {
        return;
      }
      const day = entry.day ?? state?.day ?? 0;
      if (day !== (state?.day ?? day)) {
        return;
      }
      const speakerId = entry.speakerId ?? "";
      const targetId = entry.focusId || entry.decisionRationale?.focusId || entry.targetId || "";
      if (!speakerId || !targetId) {
        return;
      }
      const key = `${speakerId}::${targetId}`;
      const existing = groups.get(key) ?? {
        id: key,
        speakerId,
        speakerName: names.get(speakerId) ?? entry.speakerName ?? speakerId,
        targetId,
        targetName: names.get(targetId) ?? entry.decisionRationale?.focusName ?? targetId,
        count: 0,
        latestMode: "",
        latestSummary: "",
        summaries: [],
        evidenceSnippets: [],
        scoreTrail: [],
        latestScore: 0,
        previousScore: 0,
        scoreDelta: 0,
        scoreTrend: "steady",
        day,
        night: entry.night ?? state?.night ?? 0,
        lastIndex: -1,
      };
      existing.count += 1;
      existing.latestMode = entry.mode ?? "event";
      existing.latestSummary = summary;
      existing.day = day;
      existing.night = entry.night ?? state?.night ?? 0;
      existing.lastIndex = index;
      if (!existing.summaries.includes(summary)) {
        existing.summaries.unshift(summary);
        existing.summaries = existing.summaries.slice(0, 3);
      }
      const evidenceRows = buildReasoningEvidenceRows(state, names, speakerId, targetId, entry, index);
      for (const snippet of buildReasoningEvidenceSnippets(entry).reverse()) {
        if (!existing.evidenceSnippets.some((item) => item.text === snippet.text)) {
          existing.evidenceSnippets.unshift(snippet);
          existing.evidenceSnippets = existing.evidenceSnippets.slice(0, 8);
        }
      }
      const scorePoint = buildReasoningScorePoint(entry, summary, evidenceRows, index);
      if (scorePoint) {
        existing.scoreTrail.unshift(scorePoint);
        const previousPoint = existing.scoreTrail[1] ?? null;
        existing.latestScore = scorePoint.focusScore;
        existing.previousScore = previousPoint?.focusScore ?? scorePoint.focusScore;
        existing.scoreDelta = finiteRationaleNumber(existing.latestScore - existing.previousScore, 0);
        existing.scoreTrend = scoreTrendFromDelta(existing.scoreDelta);
      }
      groups.set(key, existing);
    });

  return [...groups.values()]
    .sort((a, b) => b.lastIndex - a.lastIndex || b.count - a.count)
    .slice(0, limit)
    .map(({ lastIndex, ...entry }) => ({
      ...entry,
      summaries: safeArray(entry.summaries).map((summary) => cleanText(summary)).filter(Boolean),
      latestSummary: cleanText(entry.latestSummary),
      evidenceSnippets: safeArray(entry.evidenceSnippets)
        .map((snippet) => ({
          kind: snippet.kind ?? "",
          text: cleanText(snippet.text ?? ""),
          source: snippet.source ?? "",
          focusEvidenceCount: finiteRationaleNumber(snippet.focusEvidenceCount, 0),
          runnerUpEvidenceCount: finiteRationaleNumber(snippet.runnerUpEvidenceCount, 0),
        }))
        .filter((snippet) => snippet.text),
      scoreTrail: safeArray(entry.scoreTrail)
        .map((point) => ({
          timelineEntryId: point.timelineEntryId ?? "",
          timelineIndex: Number.isInteger(point.timelineIndex) ? point.timelineIndex : -1,
          timelineText: cleanText(point.timelineText ?? ""),
          timestamp: Number.isFinite(Number(point.timestamp)) ? Number(point.timestamp) : 0,
          mode: point.mode ?? "event",
          summary: cleanText(point.summary ?? ""),
          focusScore: finiteRationaleNumber(point.focusScore, 0),
          runnerUpScore: finiteRationaleNumber(point.runnerUpScore, 0),
          scoreGap: finiteRationaleNumber(point.scoreGap, 0),
          focusEvidenceCount: finiteRationaleNumber(point.focusEvidenceCount, 0),
          runnerUpEvidenceCount: finiteRationaleNumber(point.runnerUpEvidenceCount, 0),
          confidenceBand: point.confidenceBand ?? "",
          reasonKey: point.reasonKey ?? "",
          comparisonTrace: normalizeDecisionComparisonTrace(point.comparisonTrace),
          crossDayStance: normalizeCrossDayStance(point.crossDayStance),
          claimDisclosureRationale: normalizeClaimDisclosureRationale(point.claimDisclosureRationale),
          evidenceRows: safeArray(point.evidenceRows)
            .map((row) => ({
              id: row.id ?? "",
              evidenceId: row.evidenceId ?? "",
              observationId: row.observationId ?? "",
              timelineEntryId: row.timelineEntryId ?? "",
              timelineIndex: Number.isInteger(row.timelineIndex) ? row.timelineIndex : -1,
              timelineText: cleanText(row.timelineText ?? ""),
              reasonKey: row.reasonKey ?? "",
              kind: row.kind ?? "",
              source: row.source ?? "",
              sourceId: row.sourceId ?? "",
              sourceName: row.sourceName ?? "",
              visibility: row.visibility ?? "",
              reliabilityScore: finiteRationaleNumber(row.reliabilityScore, 0),
              contaminationRisk: finiteRationaleNumber(row.contaminationRisk, 0),
              canBeFalse: !!row.canBeFalse,
              before: finiteRationaleNumber(row.before, 0),
              after: finiteRationaleNumber(row.after, 0),
              appliedDelta: finiteRationaleNumber(row.appliedDelta, 0),
              text: cleanText(row.text ?? ""),
              day: row.day ?? 0,
              night: row.night ?? 0,
              timestamp: Number.isFinite(Number(row.timestamp)) ? Number(row.timestamp) : 0,
            }))
            .filter((row) => row.text || row.evidenceId),
          day: point.day ?? 0,
          night: point.night ?? 0,
        })),
      latestScore: finiteRationaleNumber(entry.latestScore, 0),
      previousScore: finiteRationaleNumber(entry.previousScore, 0),
      scoreDelta: finiteRationaleNumber(entry.scoreDelta, 0),
      scoreTrend: entry.scoreTrend ?? "steady",
    }));
}

function buildVoteCeremony(state) {
  const vote = safeArray(state?.events?.votes).at(-1);
  if (!vote) {
    return null;
  }
  if (vote.day !== (state?.day ?? 0) || state?.phase !== "day" || state?.dayStage !== "nomination") {
    return null;
  }
  const playerById = new Map(safeArray(state?.players).map((player) => [player.id, player]));
  const nominee = playerById.get(vote.nomineeId);
  const nominator = playerById.get(vote.nominatorId);
  const executionCandidate = buildExecutionCandidate(state);
  const onBlock = !!(
    executionCandidate &&
    executionCandidate.day === vote.day &&
    executionCandidate.nomineeId === vote.nomineeId &&
    (executionCandidate.voteIndex < 0 || executionCandidate.voteIndex === safeArray(state?.events?.votes).length - 1)
  );
  return {
    day: vote.day ?? state?.day ?? 0,
    nominatorId: vote.nominatorId ?? "",
    nominatorName: nominator?.name ?? vote.nominatorId ?? "",
    nomineeId: vote.nomineeId ?? "",
    nomineeName: nominee?.name ?? vote.nomineeId ?? "",
    yesVotes: vote.yesVotes ?? 0,
    threshold: vote.threshold ?? 0,
    passed: !!vote.passed,
    onBlock,
    resultText: `投票结果：${vote.yesVotes ?? 0} / ${vote.threshold ?? 0}，${vote.passed ? "通过" : "未通过"}`,
    voters: safeArray(vote.votes).map((entry) => {
      const voter = playerById.get(entry.voterId);
      return {
        voterId: entry.voterId ?? "",
        voterName: voter?.name ?? entry.voterId ?? "",
        seat: (voter?.seatIndex ?? -1) + 1,
        alive: registersAsAlive(state, voter),
        ghostVote: !registersAsAlive(state, voter) && !!entry.vote,
        vote: !!entry.vote,
        abstain: !!entry.abstain,
        voteRationale: normalizeVoteRationale(entry.voteRationale),
      };
    }),
  };
}

function normalizeVoteRationale(rationale) {
  if (!rationale) return null;
  return {
    kind: rationale.kind ?? "vote-rationale",
    audience: rationale.audience ?? "vote",
    publicOnly: !!rationale.publicOnly,
    voterId: rationale.voterId ?? "",
    voterName: rationale.voterName ?? "",
    nomineeId: rationale.nomineeId ?? "",
    nomineeName: rationale.nomineeName ?? "",
    vote: !!rationale.vote,
    canVote: !!rationale.canVote,
    suspicion: finiteRationaleNumber(rationale.suspicion, 0),
    threshold: finiteRationaleNumber(rationale.threshold, 0),
    margin: finiteRationaleNumber(rationale.margin, 0),
    evidenceCount: finiteRationaleNumber(rationale.evidenceCount, 0),
    memoryShift: finiteRationaleNumber(rationale.memoryShift, 0),
    strategyShift: finiteRationaleNumber(rationale.strategyShift, 0),
    reasonKey: rationale.reasonKey ?? "",
    confidenceBand: rationale.confidenceBand ?? "",
    line: cleanText(rationale.line ?? ""),
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
      minGuessCount: action.minGuessCount ?? 0,
      maxGuessCount: action.maxGuessCount ?? 0,
      optional: !!action.optional,
      options: safeArray(action.options),
      roleOptions: safeArray(action.roleOptions),
      modes: safeArray(action.modes),
      selectedTargetIds: safeArray(action.selectedTargetIds),
      interaction: action.interaction ?? null,
    };
  });
}

function buildPhaseObjective(state) {
  const queueCount = safeArray(state?.pendingStorytellerActions).length;
  const nightAction = getHumanNightActionState(state);
  const dayAction = getHumanDayActionState(state);

  if (state?.gameOver || state?.phase === "ended") {
    return {
      title: "复盘本局",
      hint: state.winnerReason ?? "查看事件、时间线和 AI 推理摘要，然后可以新开一局。",
    };
  }
  if (queueCount > 0) {
    return {
      title: `处理 Storyteller 队列（${queueCount}）`,
      hint: "流程已暂停。先处理即时触发、死亡触发或特殊角色选择。",
    };
  }
  if (state?.phase === "night") {
    return nightAction.available
      ? { title: `夜间行动：${nightAction.roleName}`, hint: nightAction.prompt ?? "Storyteller 正在等待你的选择。" }
      : { title: "夜晚结算中", hint: "夜晚会按顺序处理技能、死亡和私有信息。" };
  }
  if (state?.dayStage === "private") {
    const used = state?.dayStageMeta?.privateUsed ?? 0;
    const limit = state?.dayStageMeta?.privateLimit ?? 0;
    const followUsed = state?.dayStageMeta?.privateFollowUpUsed ?? 0;
    const followLimit = state?.dayStageMeta?.privateFollowUpLimit ?? 2;
    return {
      title: `私聊收集线索（${used}/${limit}）`,
      hint: `点击玩家后可私聊；同一对象追问 ${followUsed}/${followLimit}。`,
    };
  }
  if (state?.dayStage === "public") {
    const conversation = buildPublicConversation(state);
    return {
      title: `公聊：${conversation.label}`,
      hint: conversation.step > 0
        ? `当前压力 ${Math.round((conversation.pressure ?? 0) * 100)}%，可继续对话或开启提名窗口。`
        : "让 AI 按当前公聊节奏自然接话，而不是固定轮次。",
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
  const selectedText = selected ? `选中 ${(selected.seatIndex ?? 0) + 1}号${selected.isHuman ? "（你）" : ""}` : "尚未选中玩家";
  const statusText = bridge.message ? `状态：${bridge.message}` : "状态：等待玩家操作";
  const llmRenderer = buildLLMRendererStatus(state);
  const llmText = llmRenderer.enabled
    ? `发言润色：已开启（润色 ${llmRenderer.touched} 条，回退 ${llmRenderer.fallback} 条）`
    : "";
  const parts = [
    selectedText,
    statusText,
    llmText,
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

function buildStorytellerQueueDetails(state) {
  return safeArray(state?.pendingStorytellerActions)
    .slice(0, 8)
    .map((action, index) => ({
      id: action?.id ?? "",
      type: action?.type ?? "",
      roleId: action?.roleId ?? "",
      roleName: action?.roleName ?? "Storyteller",
      inputType: action?.inputType ?? "player-target",
      prompt: cleanText(action?.prompt ?? action?.title ?? action?.type ?? "待处理行动"),
      phaseLabel: action?.phaseLabel ?? `D${action?.createdDay ?? state?.day ?? 0}/N${action?.createdNight ?? state?.night ?? 0}`,
      createdDay: action?.createdDay ?? state?.day ?? 0,
      createdNight: action?.createdNight ?? state?.night ?? 0,
      createdPhase: action?.createdPhase ?? state?.phase ?? "",
      minTargetCount: action?.minTargetCount ?? action?.targetCount ?? 0,
      maxTargetCount: action?.maxTargetCount ?? action?.targetCount ?? 0,
      targetCount: action?.targetCount ?? 0,
      optionCount: safeArray(action?.options).length + safeArray(action?.roleOptions).length + safeArray(action?.modes).length,
      current: index === 0,
    }));
}

function buildTimeline(state, limit = 48) {
  return safeArray(state?.aiDialogue?.timeline)
    .filter((entry) => !entry.hiddenFromHuman)
    .slice(-limit)
    .map((entry) => ({
      id: entry.id ?? "",
      mode: entry.mode ?? "event",
      speakerId: entry.speakerId ?? "",
      targetId: entry.targetId ?? "",
      focusId: entry.focusId ?? "",
      intent: entry.intent ?? "",
      evidenceSummary: cleanText(entry.evidenceSummary ?? ""),
      evidenceKind: entry.evidenceKind ?? "",
      abilityRoleId: entry.abilityRoleId ?? "",
      abilityKind: entry.abilityKind ?? "",
      questionToAsk: cleanText(entry.questionToAsk ?? ""),
      followUpPrompts: safeArray(entry.followUpPrompts).map((prompt) => cleanText(prompt)).filter(Boolean).slice(0, 4),
      decisionRationale: entry.decisionRationale ?? null,
      claimDisclosureRationale: normalizeClaimDisclosureRationale(entry.claimDisclosureRationale),
      crossDayStance: normalizeCrossDayStance(entry.crossDayStance),
      strategyRationale: entry.strategyRationale ?? null,
      rationaleSummary: buildTimelineRationaleSummary(entry),
      rationaleCards: buildNominationRationaleCards(entry.decisionRationale, entry.strategyRationale),
      text: cleanText(entry.text),
      llmRender: entry.llmRender
        ? {
            source: entry.llmRender.source ?? "",
            fallbackUsed: !!entry.llmRender.fallbackUsed,
            reason: cleanText(entry.llmRender.reason ?? ""),
            deterministicDraft: cleanText(entry.llmRender.deterministicDraft ?? ""),
            finalText: cleanText(entry.llmRender.finalText ?? ""),
          }
        : null,
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
  const alive = players.filter((player) => registersAsAlive(state, player)).length;
  const dead = players.filter((player) => !player?.alive).length;
  const registeredDead = players.filter((player) => registersAsDead(state, player)).length;
  const finalEvents = exportedLogs(state, 8);

  return {
    gameOver,
    winner,
    winnerLabel,
    title: gameOver ? `${winnerLabel || "本局"}胜利` : "",
    reason,
    summary: gameOver
      ? cleanText(`${reason || "胜负已结算。"} 存活 ${alive}，死亡 ${dead + registeredDead}。`)
      : "",
    alive,
    dead: dead + registeredDead,
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
    alive: safeArray(state.players).filter((player) => registersAsAlive(state, player)).length,
    dead: safeArray(state.players).filter((player) => !player.alive || registersAsDead(state, player)).length,
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
    pendingProactiveWhispers: buildPendingProactiveWhispers(state),
    aiSocialClues: buildAiSocialClues(state),
    llmRenderer: buildLLMRendererStatus(state),
    publicConversation: buildPublicConversation(state),
    nominationClock: buildNominationClock(state),
    nominationDebate: buildNominationDebate(state),
    executionCandidate: buildExecutionCandidate(state),
    aiRecap: buildAiRecap(aiInsights),
    aiRecapDetails: buildAiRecapDetails(aiInsights),
    aiReasoningRecap: buildAiReasoningRecap(state),
    voteCeremony: buildVoteCeremony(state),
    actionForms: buildActionForms({ nightAction: humanNightAction, dayAction: humanDayAction, storytellerAction }),
    dialogueTitle: dialogue.title,
    dialogueText: dialogue.text,
    events: logs.length > 0 ? logs : ["暂无事件。"],
    storytellerQueue: buildStorytellerQueue(state),
    storytellerQueueDetails: buildStorytellerQueueDetails(state),
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
