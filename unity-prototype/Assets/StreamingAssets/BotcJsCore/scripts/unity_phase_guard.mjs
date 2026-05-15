import {
  getHumanDayActionState,
  getHumanNightActionState,
  getPendingStorytellerActionState,
} from "./engine.js";

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function dayVoteState(state) {
  const votes = safeArray(state?.events?.votes).filter((entry) => entry.day === state.day);
  const executions = safeArray(state?.events?.executions).filter((entry) => entry.day === state.day);
  return {
    votes,
    executions,
    hasVote: votes.length > 0,
    hasPassedVote: votes.some((entry) => !!entry.passed),
    hasExecution: executions.length > 0,
  };
}

function hasSelectedPlan(action) {
  return !!action?.selectedPlan;
}

function nextSequentialStage(state) {
  if (state?.phase === "night") return "day";
  if (state?.phase !== "day") return "";
  if (state.dayStage === "private") return "public";
  if (state.dayStage === "public") return "nomination";
  if (state.dayStage === "nomination") return "night";
  return "public";
}

function normalizedTargetStage(state, targetStage = "") {
  const requested = `${targetStage ?? ""}`.trim();
  if (!requested || requested === "next") return nextSequentialStage(state);
  return requested;
}

function phaseLabelForStage(stage) {
  if (stage === "day") return "结算夜晚";
  if (stage === "public") return "进入公聊";
  if (stage === "nomination") return "进入提名";
  if (stage === "night") return "进入夜晚";
  return "推进阶段";
}

export function buildUnityPhaseAdvance(state, { targetStage = "", confirmed = false } = {}) {
  const blockers = [];
  const warnings = [];
  const confirmationWarnings = [];
  const stage = normalizedTargetStage(state, targetStage);
  const storytellerAction = getPendingStorytellerActionState(state);
  const dayAction = getHumanDayActionState(state);
  const nightAction = getHumanNightActionState(state);

  if (!state || !Array.isArray(state.players)) {
    blockers.push("尚未载入 JS Core 对局。");
  } else if (state.gameOver || state.phase === "ended") {
    blockers.push("对局已经结束。");
  }

  if (storytellerAction.available) {
    blockers.push(`还有 Storyteller 队列未处理：${storytellerAction.prompt ?? storytellerAction.reason ?? "待处理行动"}`);
  }

  if (!stage) {
    blockers.push("无法判断下一阶段。");
  } else if (state?.phase === "night") {
    if (stage !== "day") {
      blockers.push("夜晚只能先结算到白天。");
    }
    if (nightAction.available && !hasSelectedPlan(nightAction)) {
      blockers.push(`夜间行动尚未确认：${nightAction.roleName ?? "角色行动"}。请先打开夜间行动表单。`);
    }
  } else if (state?.phase === "day") {
    if (state.dayStage === "private") {
      if (stage !== "public") {
        blockers.push("请按顺序推进：私聊 -> 公聊 -> 提名 -> 夜晚。");
      }
      const used = state.dayStageMeta?.privateUsed ?? 0;
      const limit = state.dayStageMeta?.privateLimit ?? 0;
      if (limit > 0 && used < limit) {
        warnings.push(`私聊额度尚未用完（${used}/${limit}）。`);
      }
    } else if (state.dayStage === "public") {
      if (stage !== "nomination") {
        blockers.push("当前公聊阶段只能推进到提名。");
      }
      const rounds = state.dayStageMeta?.publicRounds ?? 0;
      if (rounds <= 0) {
        blockers.push("至少推进一次公聊对话后，才能进入提名。");
      }
      if (dayAction.available && !hasSelectedPlan(dayAction)) {
        const warning = `白天行动尚未处理：${dayAction.roleName ?? "角色行动"}。`;
        warnings.push(warning);
        confirmationWarnings.push(warning);
      }
    } else if (state.dayStage === "nomination") {
      if (stage !== "night") {
        blockers.push("当前提名阶段只能推进到夜晚。");
      }
      const voteState = dayVoteState(state);
      if (!voteState.hasExecution && !voteState.hasPassedVote) {
        const warning = voteState.hasVote ? "今天已有未通过投票；继续会以无人处决进入夜晚。" : "今天尚未产生处决；继续会以无人处决进入夜晚。";
        warnings.push(warning);
        confirmationWarnings.push(warning);
      }
      if (dayAction.available && !hasSelectedPlan(dayAction)) {
        const warning = `白天行动尚未处理：${dayAction.roleName ?? "角色行动"}。`;
        warnings.push(warning);
        confirmationWarnings.push(warning);
      }
      if (nightAction.available && !hasSelectedPlan(nightAction)) {
        blockers.push(`下一夜行动尚未确认：${nightAction.roleName ?? "角色行动"}。请先打开夜间行动表单。`);
      }
    } else {
      blockers.push("当前白天子阶段无效，无法安全推进。");
    }
  } else {
    blockers.push("当前阶段无法推进。");
  }

  const blocked = blockers.length > 0;
  const requiresConfirm = !blocked && confirmationWarnings.length > 0 && !confirmed;
  const reason = blocked ? blockers[0] : requiresConfirm ? confirmationWarnings[0] : "";
  const hint = blocked
    ? "请先处理阻断项，再重新推进。"
    : requiresConfirm
      ? "再次点击同一推进按钮确认跳过这些可选项。"
      : `${phaseLabelForStage(stage)}已就绪。`;

  return {
    blocked,
    canAdvance: !blocked && !requiresConfirm,
    requiresConfirm,
    targetStage: stage,
    label: phaseLabelForStage(stage),
    reason,
    hint,
    blockers,
    warnings,
    confirmText: confirmationWarnings.length > 0 ? confirmationWarnings.join("\n") : "",
  };
}

export function canResolveDayIntoNight(state) {
  const voteState = dayVoteState(state);
  return voteState.hasExecution || voteState.hasPassedVote;
}
