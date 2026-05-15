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
  const next = {
    level: nextLevel,
    roleId: plan.roleId || previous?.roleId || aiPlayer.publicClaimRoleId || "",
    roleName: plan.roleName || previous?.roleName || roleNameById(state, plan.roleId || previous?.roleId || aiPlayer.publicClaimRoleId),
    family: plan.family || previous?.family || "",
    rangeLabel: plan.rangeLabel || previous?.rangeLabel || "",
    rangeText: plan.rangeText || previous?.rangeText || "",
    exposure: plan.exposure || previous?.exposure || "",
    reason: plan.reason || previous?.reason || "",
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

  if (options.forceHard) {
    level = "hard";
  }
  if (options.forceRange && level !== "hard") {
    level = "range";
  }
  if (previousDisclosure && disclosureLevelRank(previousDisclosure.level) > disclosureLevelRank(level)) {
    level = previousDisclosure.level;
  }

  const reason = claimDisclosureReason({ pressure, day, signature, trustScore, alive });
  return {
    level,
    roleId: plannedRoleId || previousDisclosure?.roleId || "",
    roleName: roleNameById(state, plannedRoleId || previousDisclosure?.roleId),
    signature,
    family: signature?.family ?? previousDisclosure?.family ?? "",
    rangeLabel: signature?.rangeLabel ?? previousDisclosure?.rangeLabel ?? claimRangeForRole(role),
    rangeText: signature?.rangeText ?? previousDisclosure?.rangeText ?? claimRangeForRole(role),
    exposure: signature?.exposure ?? previousDisclosure?.exposure ?? "low",
    reason,
    trustScore,
    selfHeat,
    day,
    alreadyClaimed,
    previousLevel: previousDisclosure?.level ?? "none",
    channel: disclosureChannelKey(audience, options),
    shouldClaimRole: level === "hard",
    shouldUseRange: level === "range",
    shouldWithholdFormat: level === "vague" || level === "withhold",
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
    return "我先给范围：我是有信息压力的好人位，信息可以聊，但身份不急着裸。";
  }
  if (category === "townsfolk") {
    return "我先给范围：我是好人功能位，今天先别逼我把技能细节全交出来。";
  }
  return "我先给范围：我今天先保守处理，等压力真的到我身上再展开。";
}
