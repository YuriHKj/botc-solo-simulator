import { clamp, getAllRoles, getRoleById, sample } from "./data.js";
import { addLog, getEffectiveRoleId, getPerceivedRoleId } from "./engine.js";
import { pickLayeredSpeech } from "./ai_speech_renderer.js";
import {
  getAIAgent,
  getKnownBluffRoleIds,
  recordPublicClaimForAgents,
} from "./ai_agents.js";

export function roleNameById(state, roleId) {
  const role = getAllRoles(state.scriptId).find((entry) => entry.id === roleId);
  return role?.name ?? roleId;
}

export function roleForPlayer(state, player) {
  return getRoleById(state.scriptId, getEffectiveRoleId(player) ?? player?.roleId) ?? null;
}

export function perceivedRoleForPlayer(state, player) {
  return getRoleById(state.scriptId, getPerceivedRoleId(player) ?? getEffectiveRoleId(player) ?? player?.roleId) ?? null;
}

export function isEarlyInfoRole(role) {
  return !!role?.tags?.includes("info") && (role.tags.includes("firstNight") || role.tags.includes("recurring"));
}

export function isPowerRole(role) {
  return !!role?.tags?.some((tag) => ["protect", "revive", "burst", "control", "transform", "demonBackup"].includes(tag));
}

const INFO_SIGNATURES = {
  washerwoman: {
    family: "two-player-role",
    exposure: "high",
    cadence: "firstNight",
    rangeLabel: "二选一身份信息位",
    rangeText: "我是二选一身份信息位，昨晚给到的是两个人和一个身份的关系。",
  },
  librarian: {
    family: "two-player-role",
    exposure: "high",
    cadence: "firstNight",
    rangeLabel: "二选一身份信息位",
    rangeText: "我是二选一身份信息位，昨晚给到的是两个人和一个身份的关系。",
  },
  investigator: {
    family: "two-player-role",
    exposure: "high",
    cadence: "firstNight",
    rangeLabel: "二选一身份信息位",
    rangeText: "我是二选一身份信息位，昨晚给到的是两个人和一个身份的关系。",
  },
  chef: {
    family: "adjacent-pair-count",
    exposure: "high",
    cadence: "firstNight",
    rangeLabel: "座位结构信息位",
    rangeText: "我是座位结构信息位，信息和相邻关系有关。",
  },
  empath: {
    family: "adjacent-info",
    exposure: "high",
    cadence: "recurring",
    rangeLabel: "邻座信息位",
    rangeText: "我是邻座信息位，昨晚结果让我需要盯左右相邻这条线。",
  },
  "fortune-teller": {
    family: "demon-check",
    exposure: "high",
    cadence: "recurring",
    rangeLabel: "查验信息位",
    rangeText: "我是查验类信息位，昨晚看过两个人，目标和结果先留一点空间。",
  },
  undertaker: {
    family: "execution-reveal",
    exposure: "high",
    cadence: "recurring",
    rangeLabel: "处决验证位",
    rangeText: "我是处决后验证类信息位，能对今天被处决的人给说法。",
  },
  ravenkeeper: {
    family: "death-check",
    exposure: "medium",
    cadence: "onDeath",
    rangeLabel: "死亡触发信息位",
    rangeText: "我是死亡触发信息位，真死到我再把信息摊清楚。",
  },
  dreamer: {
    family: "two-role-check",
    exposure: "high",
    cadence: "recurring",
    rangeLabel: "查验信息位",
    rangeText: "我是查验类信息位，信息会给到身份范围。",
  },
  savant: {
    family: "statement-info",
    exposure: "medium",
    cadence: "recurring",
    rangeLabel: "说书人信息位",
    rangeText: "我是每天拿说法的信息位，信息需要结合真假一起盘。",
  },
  clockmaker: {
    family: "distance-info",
    exposure: "high",
    cadence: "firstNight",
    rangeLabel: "结构信息位",
    rangeText: "我是结构信息位，信息和邪恶方的位置关系有关。",
  },
};

export function infoSignatureForRoleId(roleId) {
  return INFO_SIGNATURES[roleId] ?? null;
}

function infoSignatureForRole(role) {
  return infoSignatureForRoleId(role?.id);
}

function claimDisclosureReason({ pressure, day, signature, trustScore, alive }) {
  if (!alive) return "dead_players_should_dump";
  if (pressure >= 0.76) return "self_on_block_or_high_pressure";
  if (day >= 3) return "late_game_information_value";
  if (signature?.cadence === "firstNight" && day >= 2) return "first_night_role_can_cash_out";
  if (trustScore >= 0.66) return "listener_not_trusted";
  if (signature?.cadence === "recurring" && day <= 1) return "recurring_role_survival_value";
  return "balanced_disclosure";
}

function activeMadnessRoleId(state, aiPlayer) {
  const forcedRoleId = `${state?.snv?.cerenovusForcedByPlayerId?.[aiPlayer?.id] ?? ""}`.trim();
  if (!forcedRoleId) {
    return "";
  }
  const enforceDay = state?.snv?.cerenovusEnforceDayByPlayerId?.[aiPlayer.id];
  const currentDay = Math.max(1, Number(state?.day) || 1);
  if (Number.isFinite(Number(enforceDay)) && Number(enforceDay) !== currentDay) {
    return "";
  }
  return forcedRoleId;
}

function claimDisclosureRoleConstraint(state, aiPlayer, role, options = {}) {
  const publicAudience = options.private === false || options.audience === "public";
  if (!publicAudience || !aiPlayer || aiPlayer.alive === false) {
    return null;
  }
  const forcedRoleId = activeMadnessRoleId(state, aiPlayer);
  if (forcedRoleId) {
    return {
      reasonKey: "madness_pressure_cover",
      maxLevel: "range",
    };
  }
  if (role?.id === "mutant") {
    return {
      reasonKey: "mutant_outsider_claim_risk",
      maxLevel: "withhold",
    };
  }
  if (role?.id === "sweetheart") {
    return {
      reasonKey: "sweetheart_death_drunk_risk",
      maxLevel: "range",
    };
  }
  if (role?.id === "barber") {
    return {
      reasonKey: "barber_swap_timing",
      maxLevel: "range",
    };
  }
  const profile = getAIScriptPressureProfile(state);
  if (role?.category === "outsider" && profile.outsiderClaimsRisky) {
    return {
      reasonKey: "outsider_execution_risk",
      maxLevel: "range",
    };
  }
  const day = Math.max(1, Number(state?.day) || 1);
  if (role?.tags?.includes("onDeath") && day <= 2) {
    return {
      reasonKey: "death_trigger_timing",
      maxLevel: "range",
    };
  }
  return null;
}

function roundDisclosureScore(value) {
  return Number.isFinite(value) ? Math.round(value * 1000) / 1000 : 0;
}

function claimDisclosureReasonLine(reasonKey) {
  return {
    dead_players_should_dump: "已经出局，继续藏身份的收益很低",
    self_on_block_or_high_pressure: "压力已经到自己身上，需要给桌面一个可验证口径",
    late_game_information_value: "天数变深，信息价值高于继续保留身份",
    first_night_role_can_cash_out: "首夜信息已经可以拿出来交叉复核",
    listener_not_trusted: "听者或桌面对我仍有风险，所以要控制披露深度",
    recurring_role_survival_value: "持续信息位早期还需要保留生存价值",
    madness_pressure_cover: "当前有必须维持的公开口径，先避免把身份线说乱",
    mutant_outsider_claim_risk: "外来者口径容易被当成处决借口，先只给可验证边界",
    sweetheart_death_drunk_risk: "死亡后会制造醉酒风险，太早交死会让邪恶方更好安排",
    barber_swap_timing: "这个身份死亡后会给恶魔换位窗口，公开时不能把触发时机送得太早",
    outsider_execution_risk: "这个剧本里外来者容易被邪恶方利用，不能把自己当免费出处决位",
    death_trigger_timing: "活着时价值还没兑现，过早摊开会让夜里更好处理",
    private_claim: "已经在私聊中形成身份口径",
    public_claim: "已经公开形成身份口径",
    balanced_disclosure: "当前适合给可追问口径，但不一定一次交死",
  }[reasonKey] ?? "当前披露深度取决于压力、天数和可验证信息价值";
}

function claimRangeLabelForRole(role) {
  if (!role) {
    return "非空白身份";
  }
  const category = `${role.category ?? ""}`;
  if (category === "outsider") {
    return "外来者/低信息身份";
  }
  if (category === "townsfolk" && isLikelyEarlyInfoRole(role)) {
    return "有信息的好人身份";
  }
  if (category === "townsfolk") {
    return "有技能的好人身份";
  }
  return "保守身份";
}

function normalizeClaimRangeLabel(label, role = null) {
  const value = `${label ?? ""}`
    .replace(/[“”"']/gu, "")
    .replace(/[。！？；\s]+$/gu, "")
    .trim()
    .replace(/范围$/u, "");
  if (!value) {
    return claimRangeLabelForRole(role);
  }
  if (value.length <= 16 && !/[：，。；！？]/u.test(value) && !/^我(?:先|可以)/u.test(value)) {
    return value;
  }
  if (/外来者|低信息/u.test(value)) {
    return "外来者/低信息身份";
  }
  if (/有信息|信息可以聊|首夜|持续信息|查验|二选一|邻座|结构|说书人/u.test(value)) {
    return "有信息的好人身份";
  }
  if (/有技能|技能细节|功能/u.test(value)) {
    return "有技能的好人身份";
  }
  if (/不是完全没信息|不适合裸跳/u.test(value)) {
    return "非空白身份";
  }
  if (/保守|压力真的到/u.test(value)) {
    return "保守身份";
  }
  return claimRangeLabelForRole(role);
}

function claimDisclosureActionLine({ level, reasonKey, visibleRoleName, rangeLabel, audience, continuity, day, channel }) {
  const reason =
    reasonKey === "balanced_disclosure"
      ? claimDisclosureBalancedReasonLine({ level, visibleRoleName, rangeLabel, audience, continuity, day, channel })
      : claimDisclosureReasonLine(reasonKey);
  if (level === "hard") {
    return visibleRoleName
      ? `我选择明跳${visibleRoleName}，因为${reason}。`
      : `我选择明跳身份，因为${reason}。`;
  }
  if (level === "range") {
    const normalizedRangeLabel = normalizeClaimRangeLabel(rangeLabel);
    const range = normalizedRangeLabel ? `${normalizedRangeLabel}范围` : "身份范围";
    const rangeVariants = {
      madness_pressure_cover: `今天先只给${range}，${reason}。`,
      mutant_outsider_claim_risk: `这条我只说功能风险，不把具体身份坐实，${reason}。`,
      sweetheart_death_drunk_risk: `我先给${range}这层边界，${reason}。`,
      barber_swap_timing: `这条我先说到${range}，${reason}。`,
      outsider_execution_risk: `这局我先把身份压在${range}里，${reason}。`,
      death_trigger_timing: `我先把身份放在${range}里，${reason}。`,
    };
    if (rangeVariants[reasonKey]) {
      return rangeVariants[reasonKey];
    }
    return `我只给${range}，因为${reason}。`;
  }
  if (level === "withhold") {
    if (reasonKey === "mutant_outsider_claim_risk") {
      return `这条我只承认可验证信息，不公开坐实具体身份，${reason}。`;
    }
    return `我暂时只承认可验证信息，不交具体身份，因为${reason}。`;
  }
  const vagueVariants = {
    madness_pressure_cover: `今天这条我先不摊具体身份，${reason}。`,
    mutant_outsider_claim_risk: `这条我只说功能风险，不公开坐实具体身份，${reason}。`,
    sweetheart_death_drunk_risk: `我先讲风险边界，不急着公开具体身份，${reason}。`,
    barber_swap_timing: `这身份线我先收住触发细节，${reason}。`,
    outsider_execution_risk: `这局我先不把具体身份交出来，${reason}。`,
    death_trigger_timing: `我先不把死亡触发身份摊开，${reason}。`,
  };
  if (vagueVariants[reasonKey]) {
    return vagueVariants[reasonKey];
  }
  return `我暂时保留具体身份，因为${reason}。`;
}

function buildClaimDisclosureRationale({
  state,
  aiPlayer,
  level,
  previousLevel,
  roleId,
  roleName,
  signature,
  rangeLabel,
  exposure,
  reason,
  trustScore,
  selfHeat,
  pressure,
  day,
  alreadyClaimed,
  alive,
  channel,
  previousDisclosure,
  options = {},
}) {
  const hardVisible = level === "hard" || alreadyClaimed;
  const visibleRoleId = hardVisible ? roleId || aiPlayer?.publicClaimRoleId || "" : "";
  const visibleRoleName = hardVisible ? roleName || roleNameById(state, visibleRoleId) : "";
  const audience = options.audience ?? (options.private === false ? "public" : "private");
  const previousHardVisible = hardVisible && previousDisclosure?.level === "hard";
  const previousRoleId = previousHardVisible ? previousDisclosure?.roleId ?? "" : "";
  const previousRoleName = previousHardVisible
    ? previousDisclosure?.roleName || roleNameById(state, previousRoleId)
    : "";
  const rangeRole = getRoleById(state?.scriptId, roleId || visibleRoleId || aiPlayer?.publicClaimRoleId || aiPlayer?.roleId) ?? null;
  const normalizedRangeLabel = normalizeClaimRangeLabel(rangeLabel, rangeRole);
  const previousRangeLabel = !previousHardVisible && previousDisclosure?.rangeLabel
    ? normalizeClaimRangeLabel(previousDisclosure.rangeLabel, rangeRole)
    : "";
  const continuity = claimDisclosureContinuity(previousDisclosure, {
    level,
    roleId: roleId || visibleRoleId,
  });
  const continuityLine = claimDisclosureContinuityLine({
    continuity,
    level,
    reasonKey: reason,
    visibleRoleName,
    rangeLabel: normalizedRangeLabel,
    previousRoleName,
    previousRangeLabel,
    audience,
    day,
    channel,
  });
  const continuitySummary = claimDisclosureContinuitySummary({
    continuity,
    visibleRoleName,
    rangeLabel: normalizedRangeLabel,
    previousRoleName,
    previousRangeLabel,
  });
  return {
    kind: "claim-disclosure-rationale",
    audience,
    publicOnly: options.private === false || audience === "public",
    speakerId: aiPlayer?.id ?? "",
    speakerName: aiPlayer?.name ?? "",
    level,
    previousLevel: previousLevel ?? "none",
    previousRoleId,
    previousRoleName,
    previousRangeLabel,
    roleId: visibleRoleId,
    roleName: visibleRoleName,
    rangeLabel: normalizedRangeLabel,
    family: signature?.family ?? "",
    exposure: exposure ?? signature?.exposure ?? "low",
    reasonKey: reason,
    day: Math.max(1, Number(day) || 1),
    trustScore: roundDisclosureScore(trustScore),
    selfHeat: roundDisclosureScore(selfHeat),
    pressure: roundDisclosureScore(pressure),
    alreadyClaimed: !!alreadyClaimed,
    canRevealRole: hardVisible,
    channel,
    continuity,
    continuityLine,
    continuitySummary,
    line: claimDisclosureActionLine({
      level,
      reasonKey: reason,
      visibleRoleName,
      rangeLabel: normalizedRangeLabel,
      audience,
      continuity,
      day,
      channel,
    }),
    spokenLine: "",
  };
}

export function attachClaimDisclosureRationaleSpokenLine(rationale, spokenText) {
  if (!rationale) {
    return null;
  }
  const text = `${spokenText ?? ""}`.replace(/\s+/g, " ").trim();
  const candidates = text.match(/[^。！？；.!?;]+[。！？；.!?;]?/gu)?.map((entry) => entry.trim()).filter(Boolean) ?? [];
  const roleName = `${rationale.roleName ?? ""}`.trim();
  const rangeLabel = `${rationale.rangeLabel ?? ""}`.trim();
  const selected =
    candidates.find((entry) => roleName && entry.includes(roleName)) ??
    candidates.find((entry) => rangeLabel && entry.includes(rangeLabel)) ??
    candidates.find((entry) => /身份|范围|信息|公开|先跳|先给|保留|摊/.test(entry)) ??
    candidates[0] ??
    "";
  return {
    ...rationale,
    spokenLine: selected || rationale.spokenLine || rationale.line || "",
  };
}

const DISCLOSURE_LEVEL_RANK = {
  none: 0,
  vague: 1,
  withhold: 1,
  range: 2,
  hard: 3,
};

function disclosureLevelRank(level) {
  return DISCLOSURE_LEVEL_RANK[level] ?? 0;
}

function claimDisclosureContinuity(previousDisclosure, current = {}) {
  if (!previousDisclosure?.level) {
    return "new";
  }
  const previousRank = disclosureLevelRank(previousDisclosure.level);
  const currentRank = disclosureLevelRank(current.level);
  const previousRoleId = `${previousDisclosure.roleId ?? ""}`.trim();
  const currentRoleId = `${current.roleId ?? ""}`.trim();
  if (previousRoleId && currentRoleId && previousRoleId !== currentRoleId && Math.max(previousRank, currentRank) >= 3) {
    return "revise";
  }
  if (currentRank > previousRank) {
    return "escalate";
  }
  if (currentRank < previousRank) {
    return "revise";
  }
  return "hold";
}

function claimDisclosureVariantIndex(key, count) {
  if (count <= 1) {
    return 0;
  }
  const text = `${key ?? ""}`;
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash += text.charCodeAt(index) * (index + 1);
  }
  return Math.abs(hash) % count;
}

function claimDisclosureHoldVariantIndex(key, count) {
  if (count <= 1) {
    return 0;
  }
  const text = `${key ?? ""}`;
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return Math.abs(hash) % count;
}

function claimDisclosureBalancedReasonLine({ level, visibleRoleName, rangeLabel, audience, continuity, day, channel }) {
  const hardVariants = [
    "现在需要把身份口径交到能被追问的程度",
    "这轮要让桌面有具体口径可以复核",
    "身份线已经到该给可验证落点的时候",
    "继续含糊只会让后续追问失焦",
  ];
  const cautiousVariants = [
    "先给桌面能追问的边界，不把具体身份一次说死",
    "现在适合交可核范围，具体身份还留一点余地",
    "这轮先让口径可追问，身份细节等压力再补",
    "先把可验证边界放出来，不急着把整条身份线摊完",
  ];
  const variants = level === "hard" ? hardVariants : cautiousVariants;
  const key = [
    level,
    visibleRoleName ?? "",
    rangeLabel ?? "",
    audience ?? "",
    continuity ?? "",
    day ?? "",
    channel ?? "",
  ].join(":");
  return variants[claimDisclosureVariantIndex(key, variants.length)] ?? variants[0];
}

function claimDisclosureHoldLine({ level, visibleRoleName, rangeLabel, reasonKey, audience, day, channel }) {
  if (level === "hard" && visibleRoleName) {
    const variants = [
      `${visibleRoleName}这条身份线不改，今天仍按它来聊。`,
      `${visibleRoleName}这条我先不换，继续按前面口径说。`,
      `${visibleRoleName}口径这轮不改，还是沿着这条聊。`,
      `我不无理由改口，${visibleRoleName}这条继续放桌面上。`,
      `${visibleRoleName}这条身份先沿用，让后续追问接着核。`,
      `${visibleRoleName}身份线今天不重开，这条继续留给桌面核。`,
      `我先稳住${visibleRoleName}口径，不为了压力临时换说法。`,
      `${visibleRoleName}前面报过先不撤，后续按这条继续验。`,
    ];
    const variantKey = [level, visibleRoleName, reasonKey ?? "", audience ?? "", day ?? "", channel ?? ""].join(":");
    return variants[claimDisclosureHoldVariantIndex(variantKey, variants.length)] ?? variants[0];
  }
  if (level === "range" && rangeLabel) {
    const variants = [
      `前面的“${rangeLabel}”范围我先不改，除非桌面给新理由。`,
      `身份范围暂时沿用“${rangeLabel}”，不无理由改口。`,
      `我还按“${rangeLabel}”这个范围说，先让桌面继续追问。`,
    ];
    return variants[claimDisclosureVariantIndex(rangeLabel, variants.length)] ?? variants[0];
  }
  return "身份口径我先不无理由改口。";
}

function claimDisclosureContinuityLine({
  continuity,
  level,
  reasonKey,
  visibleRoleName,
  rangeLabel,
  previousRoleName,
  previousRangeLabel,
  audience,
  day,
  channel,
}) {
  if (continuity === "hold") {
    return claimDisclosureHoldLine({ level, visibleRoleName, rangeLabel, reasonKey, audience, day, channel });
  }
  if (continuity === "escalate") {
    if (level === "hard" && visibleRoleName) {
      return `从前面的范围推进到具体身份，因为桌面压力已经变了。`;
    }
    if (level === "range" && rangeLabel) {
      return `从保留身份推进到“${rangeLabel}”范围，因为现在需要给可追问口径。`;
    }
    return "从保留身份推进到更明确的身份口径，因为现在需要给可追问口径。";
  }
  if (continuity === "revise") {
    if (previousRoleName && visibleRoleName) {
      return `这次身份口径从${previousRoleName}改到${visibleRoleName}，需要把改口原因讲清楚。`;
    }
    if (previousRangeLabel && visibleRoleName) {
      return `这次身份口径从“${previousRangeLabel}”范围改到${visibleRoleName}，需要把改口原因讲清楚。`;
    }
    return "这次身份口径发生变化，需要把改口原因讲清楚。";
  }
  return "";
}

function claimDisclosureContinuitySummary({
  continuity,
  visibleRoleName,
  rangeLabel,
  previousRoleName,
  previousRangeLabel,
}) {
  const current = visibleRoleName || rangeLabel || "";
  const previous = previousRoleName || previousRangeLabel || "";
  if (continuity === "revise" && previous && current) {
    return `改口：${previous} -> ${current}`;
  }
  if (continuity === "escalate" && previous && current) {
    return `升级：${previous} -> ${current}`;
  }
  if (continuity === "hold" && current) {
    return `延续：${current}`;
  }
  return "";
}

function disclosureChannelKey(audience, options = {}) {
  if (options.audience === "public" || options.private === false) {
    return "public";
  }
  return `private:${audience?.id ?? "unknown"}`;
}

export function getClaimDisclosureState(state, aiPlayer, audience = null, options = {}) {
  const key = disclosureChannelKey(audience, options);
  const memory = state?.aiDialogue?.claimDisclosureByPlayerId?.[aiPlayer?.id]?.[key] ?? null;
  const globalHard = aiPlayer?.publicClaimRoleId
    ? {
        level: "hard",
        roleId: aiPlayer.publicClaimRoleId,
        roleName: roleNameById(state, aiPlayer.publicClaimRoleId),
        channel: key,
      }
    : null;
  if (!memory) {
    return globalHard;
  }
  if (globalHard && disclosureLevelRank(globalHard.level) > disclosureLevelRank(memory.level)) {
    return { ...memory, ...globalHard };
  }
  return memory;
}

export function rememberClaimDisclosure(state, aiPlayer, plan, audience = null, options = {}) {
  if (!state || !aiPlayer || !plan?.level) {
    return null;
  }
  state.aiDialogue = state.aiDialogue ?? {};
  state.aiDialogue.claimDisclosureByPlayerId = state.aiDialogue.claimDisclosureByPlayerId ?? {};
  state.aiDialogue.claimDisclosureByPlayerId[aiPlayer.id] = state.aiDialogue.claimDisclosureByPlayerId[aiPlayer.id] ?? {};
  const key = disclosureChannelKey(audience, options);
  const previous = state.aiDialogue.claimDisclosureByPlayerId[aiPlayer.id][key] ?? null;
  const nextLevel =
    disclosureLevelRank(previous?.level) > disclosureLevelRank(plan.level)
      ? previous.level
      : plan.level;
  const rangeRole = getRoleById(state.scriptId, plan.roleId || previous?.roleId || aiPlayer.publicClaimRoleId || aiPlayer.roleId) ?? null;
  const normalizedPlanRangeLabel = normalizeClaimRangeLabel(plan.rangeLabel, rangeRole);
  const normalizedPreviousRangeLabel = previous?.rangeLabel
    ? normalizeClaimRangeLabel(previous.rangeLabel, rangeRole)
    : "";
  const next = {
    level: nextLevel,
    roleId: plan.roleId || previous?.roleId || aiPlayer.publicClaimRoleId || "",
    roleName: plan.roleName || previous?.roleName || roleNameById(state, plan.roleId || previous?.roleId || aiPlayer.publicClaimRoleId),
    family: plan.family || previous?.family || "",
    rangeLabel: normalizedPlanRangeLabel || normalizedPreviousRangeLabel || "",
    rangeText: plan.rangeText || previous?.rangeText || "",
    exposure: plan.exposure || previous?.exposure || "",
    reason: plan.reason || previous?.reason || "",
    claimDisclosureRationale: plan.claimDisclosureRationale ?? previous?.claimDisclosureRationale ?? null,
    continuity: plan.claimDisclosureRationale?.continuity ?? plan.continuity ?? previous?.continuity ?? "new",
    continuityLine: plan.claimDisclosureRationale?.continuityLine ?? plan.continuityLine ?? previous?.continuityLine ?? "",
    continuitySummary: plan.claimDisclosureRationale?.continuitySummary ?? plan.continuitySummary ?? previous?.continuitySummary ?? "",
    lastSpokenLine: plan.claimDisclosureRationale?.spokenLine ?? plan.spokenLine ?? previous?.lastSpokenLine ?? "",
    channel: key,
    day: state.day ?? 0,
    updatedAt: Date.now(),
  };
  state.aiDialogue.claimDisclosureByPlayerId[aiPlayer.id][key] = next;
  return next;
}

export function claimDisclosurePlanner(state, aiPlayer, audience = null, rng = Math.random, options = {}) {
  const perceivedRole = perceivedRoleForPlayer(state, aiPlayer) ?? roleForPlayer(state, aiPlayer);
  const infoPingRoleId = infoSignatureForRoleId(options.infoPing?.type) ? options.infoPing.type : "";
  const plannedRoleId = options.roleId ?? aiPlayer?.publicClaimRoleId ?? infoPingRoleId ?? perceivedRole?.id ?? aiPlayer?.roleId ?? "";
  const role = getRoleById(state.scriptId, plannedRoleId) ?? perceivedRole;
  const signature = options.infoSignature ?? infoSignatureForRoleId(options.infoPing?.type) ?? infoSignatureForRole(role);
  const previousDisclosure = options.previousDisclosure ?? getClaimDisclosureState(state, aiPlayer, audience, options);
  const day = Math.max(1, Number(state.day) || 1);
  const selfHeat = Number.isFinite(aiPlayer?.suspicion?.[aiPlayer.id]) ? aiPlayer.suspicion[aiPlayer.id] : 0.5;
  const trustScore = Number.isFinite(options.trustScore)
    ? options.trustScore
    : audience?.id && Number.isFinite(aiPlayer?.suspicion?.[audience.id])
      ? aiPlayer.suspicion[audience.id]
      : 0.5;
  const askedCount = Number(options.askedCount ?? 0);
  const alive = aiPlayer?.alive !== false;
  const alreadyClaimed = !!aiPlayer?.publicClaimRoleId;
  const privateAudience = options.private !== false && options.audience !== "public";
  const roleConstraint = claimDisclosureRoleConstraint(state, aiPlayer, role, options);
  const pressure =
    (options.selfNominated ? 0.82 : 0) +
    (selfHeat >= 0.62 ? selfHeat : 0) +
    (askedCount >= 2 ? 0.18 : 0) +
    (!alive ? 1 : 0);

  let level = "vague";
  if (!signature) {
    level = alreadyClaimed || pressure >= 0.72 || day >= 3 ? "hard" : "vague";
  } else if (alreadyClaimed || !alive || pressure >= 0.76 || (day >= 3 && trustScore < 0.7)) {
    level = "hard";
  } else if (signature.cadence === "firstNight") {
    if (day >= 2 || trustScore >= 0.66) {
      level = day >= 2 && trustScore < 0.66 ? "hard" : "range";
    } else {
      level = privateAudience && trustScore > 0.34 ? "range" : "hard";
    }
  } else if (signature.cadence === "recurring") {
    if (day <= 1) {
      level = trustScore >= 0.66 ? "withhold" : "range";
    } else {
      level = pressure >= 0.62 || trustScore < 0.42 ? "hard" : "range";
    }
  } else if (signature.exposure === "medium") {
    level = pressure >= 0.62 || day >= 2 ? "range" : "vague";
  }

  if (
    roleConstraint?.maxLevel &&
    !options.forceHard &&
    disclosureLevelRank(level) > disclosureLevelRank(roleConstraint.maxLevel)
  ) {
    level = roleConstraint.maxLevel;
  }
  if (options.forceHard) {
    level = "hard";
  }
  if (options.forceRange && level !== "hard") {
    level = "range";
  }
  if (previousDisclosure && disclosureLevelRank(previousDisclosure.level) > disclosureLevelRank(level)) {
    level = previousDisclosure.level;
  }

  const reason = roleConstraint?.reasonKey ?? claimDisclosureReason({ pressure, day, signature, trustScore, alive });
  const fallbackRangeText = claimRangeForRole(role);
  const fallbackRangeLabel = claimRangeLabelForRole(role);
  const disclosure = {
    level,
    roleId: plannedRoleId || previousDisclosure?.roleId || "",
    roleName: roleNameById(state, plannedRoleId || previousDisclosure?.roleId),
    signature,
    family: signature?.family ?? previousDisclosure?.family ?? "",
    rangeLabel: normalizeClaimRangeLabel(signature?.rangeLabel ?? previousDisclosure?.rangeLabel ?? fallbackRangeLabel, role),
    rangeText: signature?.rangeText ?? previousDisclosure?.rangeText ?? fallbackRangeText,
    exposure: signature?.exposure ?? previousDisclosure?.exposure ?? "low",
    reason,
    trustScore,
    selfHeat,
    pressure,
    day,
    alreadyClaimed,
    previousLevel: previousDisclosure?.level ?? "none",
    channel: disclosureChannelKey(audience, options),
    roleConstraint: roleConstraint?.reasonKey ?? "",
    shouldClaimRole: level === "hard",
    shouldUseRange: level === "range",
    shouldWithholdFormat: level === "vague" || level === "withhold",
  };
  return {
    ...disclosure,
    claimDisclosureRationale: buildClaimDisclosureRationale({
      state,
      aiPlayer,
      level,
      previousLevel: previousDisclosure?.level ?? "none",
      roleId: disclosure.roleId,
      roleName: disclosure.roleName,
      signature,
      rangeLabel: disclosure.rangeLabel,
      exposure: disclosure.exposure,
      reason,
      trustScore,
      selfHeat,
      pressure,
      day,
      alreadyClaimed,
      alive,
      channel: disclosure.channel,
      previousDisclosure,
      options,
    }),
  };
}

function isSafeLowInfoRole(role) {
  return !!role && role.team === "good" && (role.category === "outsider" || role.tags.includes("social") || role.tags.includes("defense"));
}

function evilPrior(state, viewer) {
  const evilSlots = (state.setupCounts?.minion ?? 0) + (state.setupCounts?.demon ?? 0);
  const denominator = Math.max(1, (state.players?.length ?? 1) - 1);
  if (viewer?.team === "evil") {
    return clamp((evilSlots - 1) / denominator, 0.05, 0.85);
  }
  return clamp(evilSlots / denominator, 0.05, 0.85);
}

export function getAIScriptPressureProfile(state) {
  const roleIds = new Set(getAllRoles(state.scriptId).map((role) => role.id));
  return {
    hasGodfather: roleIds.has("godfather"),
    hasFangGu: roleIds.has("fang-gu"),
    hasBaron: roleIds.has("baron"),
    hasDrunk: roleIds.has("drunk"),
    hasRecluse: roleIds.has("recluse"),
    outsiderClaimsRisky: roleIds.has("godfather") || roleIds.has("fang-gu"),
    outsiderClaimsPlausible: roleIds.has("baron") || roleIds.has("drunk") || roleIds.has("fang-gu"),
    outsiderBluffsValuable: roleIds.has("godfather") || roleIds.has("fang-gu") || roleIds.has("baron"),
    cognitiveCoverPlausible: roleIds.has("drunk") || roleIds.has("lunatic"),
    misregistrationPlausible: roleIds.has("recluse") || roleIds.has("spy"),
  };
}

function bluffRoleScore(state, role) {
  if (!role) {
    return 0;
  }
  const profile = getAIScriptPressureProfile(state);
  let score = 0;
  if (role.category === "outsider") {
    score += profile.outsiderBluffsValuable ? 0.42 : 0.08;
    if (profile.hasGodfather && role.tags.includes("risk")) {
      score += 0.08;
    }
    if (profile.hasFangGu) {
      score += 0.12;
    }
  }
  if (role.tags.includes("info") && !role.tags.includes("recurring")) {
    score += profile.cognitiveCoverPlausible ? 0.18 : 0.08;
  }
  if (role.tags.includes("social") || role.tags.includes("defense")) {
    score += 0.12;
  }
  if (role.tags.includes("lateGame") || role.tags.includes("protect") || role.tags.includes("revive")) {
    score -= 0.12;
  }
  return score;
}

export function chooseScriptAwareBluffRoleId(state, bluffPool, rng = Math.random) {
  const candidates = (bluffPool ?? [])
    .map((roleId) => getRoleById(state.scriptId, roleId))
    .filter(Boolean)
    .map((role) => ({ role, score: bluffRoleScore(state, role) + rng() * 0.08 }))
    .sort((a, b) => b.score - a.score);
  return candidates[0]?.role?.id ?? sample(bluffPool, 1, rng)[0] ?? null;
}

export function pickClaimRole(state, aiPlayer, rng = Math.random, options = {}) {
  if (aiPlayer.publicClaimRoleId) {
    return null;
  }
  const force = !!options.force;
  if (!force && state.day > 1 && rng() > 0.35) {
    return null;
  }

  const agent = getAIAgent(state, aiPlayer);
  const believesEvil = aiPlayer.team === "evil" || agent?.knownSelfTeam === "evil";
  if (believesEvil) {
    let bluffPool = getKnownBluffRoleIds(state, aiPlayer);
    if (bluffPool.length === 0) {
      bluffPool = getAllRoles(state.scriptId)
        .filter((role) => role.team === "good")
        .map((role) => role.id);
    }
    if (bluffPool.length > 0) {
      const unused = bluffPool.filter((roleId) => !state.players.some((entry) => entry.publicClaimRoleId === roleId));
      const pool = unused.length > 0 ? unused : bluffPool;
      return chooseScriptAwareBluffRoleId(state, pool, rng);
    }
  }

  const perceived = getPerceivedRoleId(aiPlayer) ?? getEffectiveRoleId(aiPlayer) ?? aiPlayer.roleId;
  return perceived ?? null;
}

export function claimRoleForContext(state, aiPlayer, human = null, rng = Math.random, options = {}) {
  const roleId = options.roleId ?? pickClaimRole(state, aiPlayer, rng, options);
  if (!roleId) {
    return null;
  }

  aiPlayer.publicClaimRoleId = roleId;
  const claim = {
    day: state.day,
    playerId: aiPlayer.id,
    roleId,
    private: !!options.private,
    viewerId: options.private ? human?.id ?? null : undefined,
  };
  state.events.claims = state.events.claims ?? [];
  state.events.claims.push(claim);

  if (!options.private) {
    recordPublicClaimForAgents(state, claim);
  }

  addLog(
    state,
    "claim",
    options.private
      ? `${aiPlayer.name} 在私聊中报身份为 ${roleNameById(state, roleId)}。`
      : `${aiPlayer.name} 声称自己是 ${roleNameById(state, roleId)}。`,
    {
      playerId: aiPlayer.id,
      viewerId: options.private ? human?.id ?? null : undefined,
      roleId,
      private: !!options.private,
    }
  );

  rememberClaimDisclosure(
    state,
    aiPlayer,
    {
      level: "hard",
      roleId,
      roleName: roleNameById(state, roleId),
      signature: infoSignatureForRoleId(roleId),
      family: infoSignatureForRoleId(roleId)?.family ?? "",
      rangeLabel: infoSignatureForRoleId(roleId)?.rangeLabel ?? "",
      rangeText: infoSignatureForRoleId(roleId)?.rangeText ?? "",
      exposure: infoSignatureForRoleId(roleId)?.exposure ?? "low",
      reason: options.private ? "private_claim" : "public_claim",
    },
    human,
    { private: !!options.private, audience: options.private ? "private" : "public" }
  );

  return roleId;
}

export function choosePublicClaimRole(state, aiPlayer, roundInDay, rng = Math.random) {
  if (aiPlayer.publicClaimRoleId) {
    return null;
  }

  const actualRole = roleForPlayer(state, aiPlayer);
  const perceivedRole = perceivedRoleForPlayer(state, aiPlayer) ?? actualRole;
  const profile = getAIScriptPressureProfile(state);
  const suspicion = aiPlayer.suspicion?.[aiPlayer.id] ?? evilPrior(state, aiPlayer);
  const day = state.day ?? 1;
  const pressure = suspicion >= 0.62;
  const forcedLate = day >= 2 && (roundInDay >= 2 || suspicion >= 0.52);

  let chance = 0.08;
  if (perceivedRole?.category === "outsider") {
    chance += day === 1 ? 0.28 : 0.18;
    if (profile.outsiderClaimsRisky) {
      chance -= day === 1 ? 0.13 : 0.06;
    }
    if (profile.outsiderClaimsPlausible) {
      chance += 0.06;
    }
  }
  if (isEarlyInfoRole(perceivedRole)) {
    chance += day === 1 ? 0.12 : 0.2;
    if (profile.hasDrunk && day === 1) {
      chance -= 0.04;
    }
  }
  if (isPowerRole(perceivedRole)) {
    chance -= day === 1 ? 0.22 : 0.1;
  }
  if (pressure) {
    chance += 0.32;
  }
  if (forcedLate) {
    chance += 0.18;
  }
  if (!aiPlayer.alive) {
    chance += day === 1 ? 0.32 : 0.42;
  }
  const agent = getAIAgent(state, aiPlayer);
  const believesEvil = aiPlayer.team === "evil" || agent?.knownSelfTeam === "evil";
  if (believesEvil) {
    const bluffRoles = getKnownBluffRoleIds(state, aiPlayer)
      .map((roleId) => getRoleById(state.scriptId, roleId))
      .filter(Boolean);
    if (bluffRoles.some(isSafeLowInfoRole)) {
      chance += 0.08;
    } else {
      chance -= 0.1;
    }
  }

  chance = clamp(chance, 0.02, day === 1 ? 0.48 : 0.72);
  if (rng() > chance) {
    return null;
  }

  return pickClaimRole(state, aiPlayer, rng);
}

export function shouldDeadPublicClaim(state, aiPlayer, roundInDay, rng = Math.random) {
  if (aiPlayer.alive || aiPlayer.publicClaimRoleId) {
    return false;
  }
  const day = state.day ?? 1;
  let chance = day <= 1 ? 0.72 : 0.9;
  if (roundInDay >= 2) {
    chance += 0.08;
  }
  if (!state.players.find((entry) => entry.isHuman)?.alive) {
    chance += 0.04;
  }
  return rng() < clamp(chance, 0.05, 0.98);
}

export function maybePublicDisclosureLine(state, aiPlayer, roundInDay, rng = Math.random) {
  if (aiPlayer.publicClaimRoleId || roundInDay > 2) {
    return "";
  }
  const role = perceivedRoleForPlayer(state, aiPlayer) ?? roleForPlayer(state, aiPlayer);
  const profile = getAIScriptPressureProfile(state);
  if (roundInDay > 1 && rng() > 0.42) {
    return "";
  }
  if (role?.category === "outsider") {
    return pickLayeredSpeech(
      {
        layer: "claimPolicy",
        audience: "public",
        team: aiPlayer.team,
        act: profile.outsiderClaimsRisky ? "outsiderRangeRisky" : "outsiderRangeSafe",
      },
      {},
      rng,
      profile.outsiderClaimsRisky
        ? [
            "我这边偏外来者/低信息量，但有教父或方古这类收益点时，我先不给具体身份。",
            "我可以承认自己偏外来者范围，不过今天不建议把外来者当成免费处决位。",
            "外来者信息在这个剧本里会被邪恶方利用，我先给范围，具体身份等需要时再补。",
          ]
        : [
            "我这边偏低信息量位置，今天可以给范围，但不急着把具体风险说死。",
            "我是偏外来者/低信息位的说法，今天不建议逼所有功能位全跳。",
            "我这边不是强信息位，如果今天要处决我可以再补更具体身份。",
          ]
    );
  }
  if (isEarlyInfoRole(role)) {
    return pickLayeredSpeech(
      { layer: "claimPolicy", audience: "public", team: aiPlayer.team, act: "infoRange" },
      {},
      rng,
      [
        "我有一点早期信息，但第一天先不完整报身份。",
        "我手里有可交叉验证的信息，先看大家怎么说再决定是否摊开。",
        "我不是空白位，但现在全跳身份会让夜里太好刀。",
      ]
    );
  }
  if (isPowerRole(role)) {
    return pickLayeredSpeech(
      { layer: "claimPolicy", audience: "public", team: aiPlayer.team, act: "powerHold" },
      {},
      rng,
      [
        "我不建议今天逼强功能位交全身份，先用信息和票型压人。",
        "我暂时不摊身份，今天先看谁在逼信息位裸跳。",
        "我会保留身份细节，必要时到提名前再补。",
      ]
    );
  }
  return "";
}

export function publicClaimDisclosureLine(state, aiPlayer, claimRoleId, rng = Math.random) {
  if (!claimRoleId) {
    return "";
  }
  const role = getRoleById(state.scriptId, claimRoleId);
  const roleName = roleNameById(state, claimRoleId);
  if (!roleName) {
    return "";
  }
  const agent = getAIAgent(state, aiPlayer);
  const believesEvil = aiPlayer?.team === "evil" || agent?.knownSelfTeam === "evil";
  if (believesEvil) {
    return pickLayeredSpeech(
      { layer: "claimPolicy", audience: "public", team: "evil", act: "publicClaim" },
      { roleName },
      rng,
      [
        `台面上我先跳${roleName}。这个身份先按公开说法听。`,
        `公开说，我是${roleName}。先按好人视角盘我的信息。`,
      ]
    );
  }
  const profile = getAIScriptPressureProfile(state);
  if (role?.category === "outsider") {
    const lines = profile.outsiderClaimsRisky
      ? [
          `我公开说一下，我是 ${roleName}。这个剧本外来者会被邪恶方利用，所以细节别急着逼完。`,
          `我先把身份放桌上：我是 ${roleName}。今天别因为我是外来者就默认免费出。`,
        ]
      : [
          `我公开报身份：我是 ${roleName}。这边信息量不高，公开信息还不够，先听回应。`,
          `我先跳一下，我是 ${roleName}。公开信息还不够，先听回应和票型。`,
        ];
    return sample(lines, 1, rng)[0] ?? "";
  }
  if (isEarlyInfoRole(role)) {
    const lines = [
      `我公开报身份：我是 ${roleName}。昨晚信息我先给方向，追问时再补细节。`,
      `我先跳 ${roleName}。信息不是空的，但第一轮我不想把全部夜信直接倒完。`,
      `身份先放桌上：我是 ${roleName}。我会把能对上的信息一点点给出来。`,
    ];
    return sample(lines, 1, rng)[0] ?? "";
  }
  if (isPowerRole(role)) {
    const lines = [
      `我先公开身份：我是 ${roleName}。技能细节我会保留一点，避免夜里太好处理。`,
      `我跳 ${roleName}。如果今天压力到我身上，我会把细节补完整。`,
      `身份先说，我是 ${roleName}。现在别把强功能位的细节一次逼干净。`,
    ];
    return sample(lines, 1, rng)[0] ?? "";
  }
  const lines = [
    `我公开报身份：我是 ${roleName}。`,
    `我先跳一下，我是 ${roleName}。`,
    `身份先放桌上：我是 ${roleName}。`,
  ];
  return pickLayeredSpeech(
    { layer: "claimPolicy", audience: "public", team: aiPlayer.team, act: "publicClaim" },
    { roleName },
    rng,
    lines
  );
}

export function maybePrivateClaim(state, aiPlayer, human, rng = Math.random) {
  if (aiPlayer.publicClaimRoleId || rng() >= 0.35) {
    return "";
  }

  const roleId = claimRoleForContext(state, aiPlayer, human, rng, { private: true });
  if (!roleId) {
    return "";
  }

  return pickLayeredSpeech(
    { layer: "claimPolicy", audience: "private", team: aiPlayer.team, act: "privateClaim" },
    { roleName: roleNameById(state, roleId) },
    rng,
    [`补充一句：我先报身份，${roleNameById(state, roleId)}。`]
  );
}

export function isLikelyEarlyInfoRole(role) {
  const tags = role?.tags ?? [];
  const id = `${role?.id ?? ""}`;
  return (
    (tags.includes("info") && (tags.includes("firstNight") || tags.includes("recurring"))) ||
    tags.includes("firstNightInfo") ||
    tags.includes("ongoingInfo") ||
    ["washerwoman", "librarian", "investigator", "empath", "fortune-teller", "fortuneteller", "undertaker", "dreamer", "savant", "clockmaker", "pixie"].includes(id)
  );
}

export function claimRangeForRole(role) {
  if (!role) {
    return "我先给范围：不是完全没信息的位置，但现在不适合裸跳。";
  }
  const category = `${role.category ?? ""}`;
  if (category === "outsider") {
    return "我可以先说范围：我偏外来者，不是核心信息位。";
  }
  if (category === "townsfolk" && isLikelyEarlyInfoRole(role)) {
    return "我先给范围：我是有信息的好人身份，信息可以聊，但身份不急着裸。";
  }
  if (category === "townsfolk") {
    return "我先给范围：我是有技能的好人身份，今天先别逼我把技能细节全交出来。";
  }
  return "我先给范围：我今天先保守处理，等压力真的到我身上再展开。";
}
