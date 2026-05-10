import { getRoleById } from "./data.js";

const AGENT_SCHEMA_VERSION = 2;
const MAX_AGENT_OBSERVATIONS = 240;
const MAX_AGENT_EVIDENCE = 360;
const MAX_BELIEF_TRAIL_PER_TARGET = 80;

const SOURCE_TRUST_DEFAULTS = {
  storyteller: 0.96,
  "public-procedure": 0.88,
  "public-chat": 0.54,
  "private-chat": 0.5,
  public: 0.52,
  self: 0.9,
  unknown: 0.45,
};

const RELIABILITY_SCORES = {
  certain: 1,
  storyteller: 0.92,
  reliable: 0.78,
  observed: 0.72,
  claimed: 0.56,
  social: 0.5,
  rumor: 0.38,
  uncertain: 0.32,
  poisoned: 0.2,
};

function unique(values) {
  return [...new Set((values ?? []).filter(Boolean))];
}

function seatName(player) {
  if (!player) {
    return "--";
  }
  return `${player.seatIndex + 1}`;
}

function playerSeatLabel(state, playerId) {
  const player = (state.players ?? []).find((entry) => entry.id === playerId);
  return player ? `${player.seatIndex + 1}` : `${playerId ?? "--"}`;
}

function roleLabel(state, roleId) {
  if (!roleId) {
    return "";
  }
  const role = getRoleById(state.scriptId, roleId);
  return role?.name ?? roleId;
}

function clamp01(value, fallback = 0) {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
}

function conciseText(text, limit = 34) {
  const value = `${text ?? ""}`.replace(/\s+/g, " ").trim();
  if (value.length <= limit) {
    return value;
  }
  return `${value.slice(0, Math.max(0, limit - 3))}...`;
}

function createAgent(player) {
  return {
    version: AGENT_SCHEMA_VERSION,
    ownerId: player.id,
    knownSelfRoleId: player.apparentRoleId ?? player.roleId ?? null,
    knownSelfTeam: player.apparentTeam ?? player.team ?? null,
    knownAllyIds: [],
    knownDemonId: null,
    knownMinionIds: [],
    knownBluffRoleIds: [],
    observations: [],
    evidenceBook: [],
    beliefTrailByPlayerId: {},
    publicClaimByPlayerId: {},
    privateClaimByPlayerId: {},
    sourceTrust: {},
  };
}

function normalizeReliability(value, source = "unknown") {
  if (Number.isFinite(value)) {
    return Math.max(0, Math.min(1, value));
  }
  const key = `${value ?? ""}`.trim();
  if (Object.prototype.hasOwnProperty.call(RELIABILITY_SCORES, key)) {
    return RELIABILITY_SCORES[key];
  }
  return SOURCE_TRUST_DEFAULTS[source] ?? SOURCE_TRUST_DEFAULTS.unknown;
}

function inferChannel(observation) {
  if (observation.channel) {
    return observation.channel;
  }
  if (observation.private) {
    return "private";
  }
  if (observation.source === "private-chat") {
    return "private";
  }
  if (observation.source === "storyteller") {
    return "storyteller";
  }
  return "public";
}

function inferVisibility(observation) {
  return observation.private ? "private" : "public";
}

function inferSourceId(agent, observation) {
  const payload = observation.payload ?? {};
  if (payload.speakerId) {
    return payload.speakerId;
  }
  if (payload.nominatorId) {
    return payload.nominatorId;
  }
  if (payload.playerId && observation.kind === "claim") {
    return payload.playerId;
  }
  if (observation.source === "storyteller") {
    return "storyteller";
  }
  return payload.actorId ?? observation.actorId ?? agent.ownerId;
}

function uniqueTargetIds(values) {
  return unique(values.filter((entry) => typeof entry === "string" && entry.length > 0));
}

function inferTargetIds(observation) {
  const payload = observation.payload ?? {};
  const ids = [
    payload.playerId,
    payload.focusId,
    payload.targetId,
    payload.nomineeId,
    payload.nominatorId,
    payload.speakerId,
    payload.voterId,
  ];
  if (Array.isArray(payload.allyIds)) {
    ids.push(...payload.allyIds);
  }
  if (Array.isArray(payload.votes)) {
    ids.push(...payload.votes.map((entry) => entry?.voterId));
  }
  return uniqueTargetIds(ids);
}

function inferPolarity(observation) {
  const payload = observation.payload ?? {};
  if (payload.polarity) {
    return payload.polarity;
  }
  if (observation.kind === "vote") {
    return payload.passed ? "pressure" : "failed-pressure";
  }
  if (observation.kind === "nomination") {
    return "pressure";
  }
  if (observation.kind === "execution" || observation.kind === "night-death") {
    return "death";
  }
  if (observation.kind === "claim") {
    return "claim";
  }
  if (observation.kind === "evil-recognition") {
    return "confirmed-team";
  }
  return "neutral";
}

function inferContaminationRisk(observation, reliabilityScore) {
  if (Number.isFinite(observation.contaminationRisk)) {
    return Math.max(0, Math.min(1, observation.contaminationRisk));
  }
  if (typeof observation.canBeFalse === "boolean") {
    return observation.canBeFalse ? 0.45 : 0.03;
  }
  if (observation.kind === "night-info") {
    return 0.22;
  }
  if (observation.kind === "evil-recognition") {
    return 0.01;
  }
  if (observation.source === "storyteller" || observation.source === "public-procedure") {
    return 0.04;
  }
  if (observation.source === "private-chat" || observation.source === "public-chat" || observation.kind === "claim") {
    return Math.max(0.35, 1 - reliabilityScore);
  }
  return Math.max(0.08, 1 - reliabilityScore);
}

function classifyEvidence(observation) {
  if (observation.kind === "night-info" || observation.kind === "evil-recognition") {
    return "private-info";
  }
  if (observation.kind === "claim") {
    return "claim";
  }
  if (observation.kind === "vote" || observation.kind === "nomination" || observation.kind === "execution") {
    return "procedure";
  }
  if (observation.kind === "public-speech" || observation.kind === "private-whisper") {
    return "social";
  }
  return observation.kind ?? "misc";
}

function evidenceFromObservation(state, agent, observation) {
  const source = observation.source ?? "unknown";
  const reliabilityScore = normalizeReliability(observation.reliability, source);
  const contaminationRisk = inferContaminationRisk(observation, reliabilityScore);
  const targetIds = inferTargetIds(observation);
  const sourceRoleId = observation.sourceRoleId ?? observation.payload?.sourceRoleId ?? "";
  const contaminationReason = observation.contaminationReason ?? observation.payload?.contaminationReason ?? "";
  return {
    id: `ev-${observation.id ?? `${Date.now()}-${Math.floor(Math.random() * 100000)}`}`,
    observationId: observation.id ?? null,
    day: observation.day ?? state.day ?? 0,
    night: observation.night ?? state.night ?? 0,
    phase: observation.phase ?? state.phase ?? "",
    timestamp: observation.timestamp ?? Date.now(),
    kind: observation.kind ?? "note",
    evidenceType: observation.evidenceType ?? classifyEvidence(observation),
    source,
    sourceId: observation.sourceId ?? inferSourceId(agent, observation),
    channel: inferChannel(observation),
    visibility: inferVisibility(observation),
    private: !!observation.private,
    targetIds,
    subjectId: observation.subjectId ?? targetIds[0] ?? null,
    polarity: inferPolarity(observation),
    reliability: observation.reliability ?? "uncertain",
    reliabilityScore,
    sourceTrust: normalizeReliability(agent.sourceTrust?.[source], source),
    contaminationRisk,
    contaminationReason,
    sourceRoleId,
    canBeFalse: contaminationRisk >= 0.15,
    text: observation.text ?? "",
    payload: observation.payload ?? {},
    tags: unique(
      [
        observation.kind,
        source,
        observation.private ? "private" : "public",
        observation.evidenceType,
        contaminationReason,
        sourceRoleId,
      ].filter(Boolean)
    ),
  };
}

function pushEvidence(agent, evidence) {
  agent.evidenceBook = Array.isArray(agent.evidenceBook) ? agent.evidenceBook : [];
  if (evidence.observationId && agent.evidenceBook.some((entry) => entry.observationId === evidence.observationId)) {
    return evidence;
  }
  agent.evidenceBook.push(evidence);
  if (agent.evidenceBook.length > MAX_AGENT_EVIDENCE) {
    agent.evidenceBook.splice(0, agent.evidenceBook.length - MAX_AGENT_EVIDENCE);
  }
  return evidence;
}

export function ensureAIAgents(state) {
  state.aiAgents = state.aiAgents ?? {};
  (state.players ?? [])
    .filter((player) => !player.isHuman)
    .forEach((player) => {
      const existing = state.aiAgents[player.id] ?? createAgent(player);
      existing.version = AGENT_SCHEMA_VERSION;
      existing.ownerId = player.id;
      existing.knownSelfRoleId = existing.knownSelfRoleId ?? player.apparentRoleId ?? player.roleId ?? null;
      existing.knownSelfTeam = existing.knownSelfTeam ?? player.apparentTeam ?? player.team ?? null;
      existing.knownAllyIds = unique(existing.knownAllyIds);
      existing.knownMinionIds = unique(existing.knownMinionIds);
      existing.knownBluffRoleIds = unique(existing.knownBluffRoleIds);
      if (player.roleId === "lunatic" && state.bmr) {
        const fakeMinionIds = unique(state.bmr.lunaticFakeMinionIdsById?.[player.id] ?? []);
        const fakeBluffRoleIds = unique(state.bmr.lunaticFakeBluffRoleIdsById?.[player.id] ?? []);
        existing.knownAllyIds = unique([...existing.knownAllyIds, ...fakeMinionIds]);
        existing.knownMinionIds = unique([...existing.knownMinionIds, ...fakeMinionIds]);
        existing.knownDemonId = existing.knownDemonId ?? player.id;
        existing.knownBluffRoleIds = unique([...existing.knownBluffRoleIds, ...fakeBluffRoleIds]);
      }
      existing.observations = Array.isArray(existing.observations) ? existing.observations : [];
      existing.evidenceBook = Array.isArray(existing.evidenceBook) ? existing.evidenceBook : [];
      existing.beliefTrailByPlayerId = existing.beliefTrailByPlayerId ?? {};
      existing.publicClaimByPlayerId = existing.publicClaimByPlayerId ?? {};
      existing.privateClaimByPlayerId = existing.privateClaimByPlayerId ?? {};
      existing.sourceTrust = existing.sourceTrust ?? {};
      const evidenceObservationIds = new Set(existing.evidenceBook.map((entry) => entry.observationId).filter(Boolean));
      existing.observations.forEach((observation) => {
        if (!observation?.id || evidenceObservationIds.has(observation.id)) {
          return;
        }
        pushEvidence(existing, evidenceFromObservation(state, existing, observation));
      });
      state.aiAgents[player.id] = existing;
    });
  return state.aiAgents;
}

export function getAIAgent(state, playerOrId) {
  ensureAIAgents(state);
  const id = typeof playerOrId === "string" ? playerOrId : playerOrId?.id;
  return id ? state.aiAgents?.[id] ?? null : null;
}

export function getAgentObservations(state, playerOrId, kind = null) {
  const observations = getAIAgent(state, playerOrId)?.observations ?? [];
  if (!kind) {
    return observations;
  }
  return observations.filter((entry) => entry.kind === kind);
}

export function getAgentEvidence(state, playerOrId, options = {}) {
  const agent = getAIAgent(state, playerOrId);
  let evidence = agent?.evidenceBook ?? [];
  if (options.kind) {
    evidence = evidence.filter((entry) => entry.kind === options.kind);
  }
  if (options.evidenceType) {
    evidence = evidence.filter((entry) => entry.evidenceType === options.evidenceType);
  }
  if (options.targetId) {
    evidence = evidence.filter((entry) => (entry.targetIds ?? []).includes(options.targetId));
  }
  if (options.visibility) {
    evidence = evidence.filter((entry) => entry.visibility === options.visibility);
  }
  return evidence;
}

export function getEvidenceForTarget(state, playerOrId, targetId) {
  return getAgentEvidence(state, playerOrId, { targetId });
}

function evidenceDialogueWeight(evidence) {
  const reliability = clamp01(evidence.reliabilityScore, 0.4);
  const trust = clamp01(evidence.sourceTrust, 0.45);
  const risk = clamp01(evidence.contaminationRisk, 0.2);
  const recency = Math.min(0.16, Math.max(0, Number(evidence.timestamp ?? 0) / 10000000000000));
  return reliability * trust * (1 - risk) + recency;
}

function contaminationSuffix(evidence) {
  const risk = clamp01(evidence.contaminationRisk, 0);
  if (risk >= 0.58) {
    return "（可信度较低，可能被醉酒/中毒或私聊口径污染）";
  }
  if (risk >= 0.36) {
    return "（可信度有限，需要复核）";
  }
  return "";
}

function summaryForDialogueEvidence(state, evidence, options = {}) {
  const payload = evidence.payload ?? {};
  const targetId = options.targetId ?? evidence.subjectId ?? evidence.targetIds?.[0] ?? payload.targetId ?? payload.playerId;
  const targetSeat = playerSeatLabel(state, targetId);
  const isPrivate = evidence.private || evidence.visibility === "private";
  const suffix = contaminationSuffix(evidence);

  if (isPrivate && options.publicOnly) {
    return "";
  }
  if (isPrivate && options.redactPrivate !== false) {
    if (evidence.source === "storyteller" || evidence.kind === "night-info") {
      return `我自己的夜间信息牵到 ${targetSeat} 号${suffix}`;
    }
    return `我私下听到的口径把焦点指向 ${targetSeat} 号${suffix}`;
  }

  if (evidence.kind === "claim") {
    const roleId = payload.roleId ?? evidence.sourceRoleId;
    const claimType = isPrivate ? "私聊身份口径" : "公开身份口径";
    return `${targetSeat} 号的${claimType}是 ${roleLabel(state, roleId) || "未明身份"}${suffix}`;
  }
  if (evidence.kind === "vote") {
    const yesVotes = Number.isFinite(payload.yesVotes) ? payload.yesVotes : "?";
    const threshold = Number.isFinite(payload.threshold) ? payload.threshold : "?";
    return `投票记录：${targetSeat} 号那轮是 ${yesVotes}/${threshold}${payload.passed ? "，通过" : "，未通过"}${suffix}`;
  }
  if (evidence.kind === "nomination") {
    return `提名记录：${targetSeat} 号被推上台面${suffix}`;
  }
  if (evidence.kind === "execution") {
    return `公开处决记录牵涉 ${targetSeat} 号${suffix}`;
  }
  if (evidence.kind === "night-death") {
    return `夜间死亡记录牵涉 ${targetSeat} 号${suffix}`;
  }
  if (evidence.kind === "public-speech") {
    const speakerSeat = playerSeatLabel(state, payload.speakerId ?? evidence.sourceId);
    const quote = conciseText(evidence.text, 30);
    return quote
      ? `${speakerSeat} 号公聊提到：${quote}${suffix}`
      : `${speakerSeat} 号公聊把焦点放到 ${targetSeat} 号${suffix}`;
  }
  if (evidence.kind === "night-info") {
    if (evidence.source === "private-chat") {
      return `有人私下声称的夜间信息提到 ${targetSeat} 号${suffix}`;
    }
    return `我自己的夜间信息指向 ${targetSeat} 号${suffix}`;
  }
  const generic = conciseText(evidence.text, 30);
  return generic ? `可见记录：${generic}${suffix}` : `可见记录把焦点指向 ${targetSeat} 号${suffix}`;
}

export function getDialogueEvidenceForTarget(state, viewer, targetId, options = {}) {
  if (!targetId) {
    return [];
  }
  const includePrivate = options.includePrivate !== false && !options.publicOnly;
  const evidence = getAgentEvidence(state, viewer, { targetId })
    .filter((entry) => (includePrivate ? true : !(entry.private || entry.visibility === "private")))
    .filter((entry) => (options.evidenceType ? entry.evidenceType === options.evidenceType : true))
    .map((entry) => ({
      ...entry,
      dialogueSummary: summaryForDialogueEvidence(state, entry, {
        targetId,
        publicOnly: !!options.publicOnly,
        redactPrivate: options.redactPrivate,
      }),
      dialogueWeight: evidenceDialogueWeight(entry),
    }))
    .filter((entry) => entry.dialogueSummary);

  evidence.sort((a, b) => {
    if (b.dialogueWeight !== a.dialogueWeight) {
      return b.dialogueWeight - a.dialogueWeight;
    }
    return (b.timestamp ?? 0) - (a.timestamp ?? 0);
  });
  return evidence.slice(0, options.maxEvidence ?? 8);
}

export function summarizeEvidenceForDialogue(state, viewer, targetId, options = {}) {
  const limit = options.limit ?? 2;
  return unique(
    getDialogueEvidenceForTarget(state, viewer, targetId, options).map((entry) => entry.dialogueSummary)
  ).slice(0, limit);
}

export function assertNoHiddenInfoLeakForDialogue(text, state, viewer) {
  const value = `${text ?? ""}`;
  const agent = getAIAgent(state, viewer);
  const knownBluffs = new Set(agent?.knownBluffRoleIds ?? []);
  const hiddenBluffs = (state.demonBluffs ?? []).filter((role) => role?.id && !knownBluffs.has(role.id));
  hiddenBluffs.forEach((role) => {
    const labels = unique([role.id, role.name, roleLabel(state, role.id)]).filter((entry) => `${entry}`.length > 1);
    labels.forEach((label) => {
      if (value.includes(label)) {
        throw new Error(`dialogue leaked hidden demon bluff: ${label}`);
      }
    });
  });
  if (agent?.knownSelfTeam !== "evil") {
    ["Known minions", "Known demon", "恶魔伪装", "邪恶互认", "真实邪恶队友"].forEach((token) => {
      if (value.includes(token)) {
        throw new Error(`dialogue leaked hidden evil information: ${token}`);
      }
    });
  }
  return true;
}

export function addAgentObservation(state, playerOrId, observation) {
  const agent = getAIAgent(state, playerOrId);
  if (!agent) {
    return null;
  }
  const record = {
    id: `${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    day: state.day ?? 0,
    night: state.night ?? 0,
    phase: state.phase ?? "",
    timestamp: Date.now(),
    ...observation,
  };
  agent.observations.push(record);
  if (agent.observations.length > MAX_AGENT_OBSERVATIONS) {
    agent.observations.splice(0, agent.observations.length - MAX_AGENT_OBSERVATIONS);
  }
  pushEvidence(agent, evidenceFromObservation(state, agent, record));
  return record;
}

export function addAgentEvidence(state, playerOrId, evidence) {
  const agent = getAIAgent(state, playerOrId);
  if (!agent) {
    return null;
  }
  const source = evidence.source ?? "unknown";
  const reliabilityScore = normalizeReliability(evidence.reliabilityScore ?? evidence.reliability, source);
  const record = {
    id: evidence.id ?? `ev-manual-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    day: evidence.day ?? state.day ?? 0,
    night: evidence.night ?? state.night ?? 0,
    phase: evidence.phase ?? state.phase ?? "",
    timestamp: evidence.timestamp ?? Date.now(),
    kind: evidence.kind ?? "manual",
    evidenceType: evidence.evidenceType ?? evidence.kind ?? "manual",
    source,
    sourceId: evidence.sourceId ?? "manual",
    channel: evidence.channel ?? "system",
    visibility: evidence.visibility ?? (evidence.private ? "private" : "public"),
    private: !!evidence.private,
    targetIds: uniqueTargetIds(evidence.targetIds ?? [evidence.targetId]),
    subjectId: evidence.subjectId ?? evidence.targetId ?? null,
    polarity: evidence.polarity ?? "neutral",
    reliability: evidence.reliability ?? "uncertain",
    reliabilityScore,
    sourceTrust: normalizeReliability(agent.sourceTrust?.[source], source),
    contaminationRisk: Number.isFinite(evidence.contaminationRisk)
      ? Math.max(0, Math.min(1, evidence.contaminationRisk))
      : Math.max(0.08, 1 - reliabilityScore),
    contaminationReason: evidence.contaminationReason ?? evidence.payload?.contaminationReason ?? "",
    sourceRoleId: evidence.sourceRoleId ?? evidence.payload?.sourceRoleId ?? "",
    canBeFalse: evidence.canBeFalse ?? true,
    text: evidence.text ?? "",
    payload: evidence.payload ?? {},
    tags: unique(
      evidence.tags ?? [
        evidence.kind,
        source,
        evidence.contaminationReason ?? evidence.payload?.contaminationReason,
        evidence.sourceRoleId ?? evidence.payload?.sourceRoleId,
      ]
    ),
  };
  return pushEvidence(agent, record);
}

export function clearAgentBeliefTrail(state, playerOrId) {
  const agent = getAIAgent(state, playerOrId);
  if (!agent) {
    return;
  }
  agent.beliefTrailByPlayerId = {};
}

export function recordSuspicionChangeFromEvidence(
  state,
  playerOrId,
  { targetId, reasonKey = "", evidence = null, before = null, after = null, rawDelta = 0, appliedDelta = 0, weight = 1 } = {}
) {
  const agent = getAIAgent(state, playerOrId);
  if (!agent || !targetId || !evidence) {
    return null;
  }
  agent.beliefTrailByPlayerId = agent.beliefTrailByPlayerId ?? {};
  agent.beliefTrailByPlayerId[targetId] = Array.isArray(agent.beliefTrailByPlayerId[targetId])
    ? agent.beliefTrailByPlayerId[targetId]
    : [];
  const record = {
    id: `bt-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    day: state.day ?? 0,
    night: state.night ?? 0,
    phase: state.phase ?? "",
    timestamp: Date.now(),
    targetId,
    reasonKey,
    before,
    after,
    rawDelta,
    appliedDelta,
    weight,
    evidenceId: evidence.id ?? null,
    observationId: evidence.observationId ?? null,
    evidenceKind: evidence.kind ?? "",
    evidenceType: evidence.evidenceType ?? "",
    source: evidence.source ?? "",
    sourceId: evidence.sourceId ?? "",
    visibility: evidence.visibility ?? "",
    reliabilityScore: evidence.reliabilityScore ?? null,
    contaminationRisk: evidence.contaminationRisk ?? null,
    canBeFalse: !!evidence.canBeFalse,
    text: evidence.text ?? "",
  };
  agent.beliefTrailByPlayerId[targetId].push(record);
  if (agent.beliefTrailByPlayerId[targetId].length > MAX_BELIEF_TRAIL_PER_TARGET) {
    agent.beliefTrailByPlayerId[targetId].splice(
      0,
      agent.beliefTrailByPlayerId[targetId].length - MAX_BELIEF_TRAIL_PER_TARGET
    );
  }
  return record;
}

export function getSuspicionTrailForTarget(state, playerOrId, targetId) {
  const agent = getAIAgent(state, playerOrId);
  if (!agent || !targetId) {
    return [];
  }
  return agent.beliefTrailByPlayerId?.[targetId] ?? [];
}

function observeAllAI(state, observationFactory) {
  ensureAIAgents(state);
  Object.values(state.aiAgents ?? {}).forEach((agent) => {
    const observation =
      typeof observationFactory === "function" ? observationFactory(agent.ownerId, agent) : observationFactory;
    addAgentObservation(state, agent.ownerId, observation);
  });
}

export function recordPrivateInfoForAgent(state, player, text, metadata = {}) {
  if (!player || player.isHuman) {
    return;
  }
  const receiverIsPoisoned = !!player.poisoned;
  const receiverIsDrunk = !!player.drunk;
  const stateRisk = receiverIsPoisoned ? 0.64 : receiverIsDrunk ? 0.58 : 0.22;
  const contaminationReason =
    metadata.contaminationReason ??
    (receiverIsPoisoned ? "poisoned-recipient" : receiverIsDrunk ? "drunk-recipient" : "");
  const sourceRoleId = metadata.sourceRoleId ?? player.roleId ?? "";
  const payload = {
    ...(metadata.payload ?? {}),
    sourceRoleId,
    contaminationReason,
  };
  addAgentObservation(state, player.id, {
    kind: "night-info",
    source: metadata.source ?? "storyteller",
    text,
    private: true,
    reliability: metadata.reliability ?? "storyteller",
    contaminationRisk: Number.isFinite(metadata.contaminationRisk)
      ? Math.max(0, Math.min(1, metadata.contaminationRisk))
      : stateRisk,
    contaminationReason,
    sourceRoleId,
    payload,
  });
}

export function recordEvilRecognitionForAgents(state) {
  ensureAIAgents(state);
  const evilPlayers = (state.players ?? []).filter((entry) => entry.team === "evil");
  const demon = evilPlayers.find((entry) => entry.category === "demon") ?? null;
  const minions = evilPlayers.filter((entry) => entry.category === "minion");
  const bluffRoleIds = unique((state.demonBluffs ?? []).map((entry) => entry.id));

  evilPlayers
    .filter((player) => !player.isHuman)
    .forEach((player) => {
      const agent = getAIAgent(state, player.id);
      if (!agent) {
        return;
      }
      const allyIds = evilPlayers.filter((entry) => entry.id !== player.id).map((entry) => entry.id);
      agent.knownAllyIds = unique([...agent.knownAllyIds, ...allyIds]);
      agent.knownDemonId = demon?.id ?? agent.knownDemonId ?? null;
      agent.knownMinionIds = unique(minions.map((entry) => entry.id));
      if (player.category === "demon") {
        agent.knownBluffRoleIds = unique([...agent.knownBluffRoleIds, ...bluffRoleIds]);
      }

      addAgentObservation(state, player.id, {
        kind: "evil-recognition",
        source: "storyteller",
        private: true,
        reliability: "certain",
        text:
          player.category === "demon"
            ? `Known minions: ${minions.map(seatName).join(", ") || "none"}.`
            : `Known demon: ${demon ? seatName(demon) : "unknown"}.`,
        payload: {
          allyIds,
          demonId: demon?.id ?? null,
          minionIds: minions.map((entry) => entry.id),
          bluffRoleIds: player.category === "demon" ? bluffRoleIds : [],
        },
      });
    });
}

export function recordPublicSpeechForAgents(state, { speakerId, text, focusId = null, roundInDay = null, orderIndex = null }) {
  observeAllAI(state, {
    kind: "public-speech",
    source: "public-chat",
    private: false,
    text,
    payload: { speakerId, focusId, roundInDay, orderIndex },
  });
}

export function recordPrivateWhisperForAgents(state, { speakerId, targetId, text, intent = "", focusId = null }) {
  [speakerId, targetId].forEach((id) => {
    addAgentObservation(state, id, {
      kind: "private-whisper",
      source: "private-chat",
      private: true,
      text,
      payload: { speakerId, targetId, intent, focusId },
    });
  });
}

export function recordNominationForAgents(state, { nominatorId, nomineeId }) {
  observeAllAI(state, {
    kind: "nomination",
    source: "public-procedure",
    private: false,
    text: `Nomination: ${nominatorId} -> ${nomineeId}.`,
    payload: { nominatorId, nomineeId, playerId: nominatorId, targetId: nomineeId },
  });
}

export function recordVoteForAgents(state, { nominatorId, nomineeId, yesVotes, threshold, votes, passed }) {
  observeAllAI(state, (ownerId) => {
    const ownVote = (votes ?? []).find((entry) => entry.voterId === ownerId) ?? null;
    return {
      kind: "vote",
      source: "public-procedure",
      private: false,
      text: `Vote on ${nomineeId}: ${yesVotes}/${threshold}, ${passed ? "passed" : "failed"}.`,
      payload: {
        nominatorId,
        nomineeId,
        playerId: nomineeId,
        targetId: nomineeId,
        yesVotes,
        threshold,
        passed,
        votes,
        ownVote,
      },
    };
  });
}

export function recordDeathForAgents(state, { playerId, roleId = null, reason = "", phase = "night", payload = {} }) {
  const kind = phase === "day" ? "execution" : "night-death";
  observeAllAI(state, {
    kind,
    source: "public-procedure",
    private: false,
    text:
      phase === "day"
        ? `Execution: ${playerId} died.`
        : `Night death: ${playerId} died.`,
    payload: {
      playerId,
      targetId: playerId,
      roleId,
      reason,
      phase,
      ...payload,
    },
  });
}

export function recordPublicClaimForAgents(state, claim) {
  ensureAIAgents(state);
  Object.values(state.aiAgents ?? {}).forEach((agent) => {
    agent.publicClaimByPlayerId[claim.playerId] = claim.roleId;
    addAgentObservation(state, agent.ownerId, {
      kind: "claim",
      source: "public",
      private: false,
      text: `${claim.playerId} publicly claimed ${claim.roleId}.`,
      payload: { playerId: claim.playerId, roleId: claim.roleId },
    });
  });
}

export function recordPrivateClaimForAgent(state, viewerId, claim) {
  const agent = getAIAgent(state, viewerId);
  if (!agent || !claim?.playerId || !claim?.roleId) {
    return null;
  }
  agent.privateClaimByPlayerId[claim.playerId] = claim.roleId;
  return addAgentObservation(state, viewerId, {
    kind: "claim",
    source: "private-chat",
    private: true,
    reliability: "claimed",
    text: `${claim.playerId} privately claimed ${claim.roleId}.`,
    payload: {
      playerId: claim.playerId,
      roleId: claim.roleId,
      targetId: claim.playerId,
      viewerId,
      private: true,
      claimStyle: claim.claimStyle ?? "hard_claim",
      deceptionType: claim.deceptionType ?? "",
    },
  });
}

export function recordPrivateInfoClaimForAgent(state, viewerId, { speakerId, text, targetIds = [], deceptionType = "" } = {}) {
  if (!viewerId || !speakerId || !text) {
    return null;
  }
  return addAgentObservation(state, viewerId, {
    kind: "night-info",
    evidenceType: "private-info",
    source: "private-chat",
    private: true,
    reliability: "rumor",
    text,
    contaminationRisk: 0.62,
    contaminationReason: deceptionType || "private-player-claim",
    payload: {
      speakerId,
      playerId: speakerId,
      targetId: targetIds[0] ?? speakerId,
      targetIds,
      viewerId,
      claimedInfo: text,
      deceptionType,
      contaminationReason: deceptionType || "private-player-claim",
    },
  });
}

export function areKnownAllies(state, viewerPlayer, targetPlayer) {
  if (!viewerPlayer || !targetPlayer || viewerPlayer.id === targetPlayer.id) {
    return false;
  }
  const agent = getAIAgent(state, viewerPlayer.id);
  return !!agent?.knownAllyIds?.includes(targetPlayer.id);
}

export function getKnownAllyIds(state, viewerPlayer) {
  return getAIAgent(state, viewerPlayer)?.knownAllyIds ?? [];
}

export function getKnownBluffRoleIds(state, viewerPlayer) {
  return getAIAgent(state, viewerPlayer)?.knownBluffRoleIds ?? [];
}

export function getVisibleClaims(state, viewerPlayer) {
  const viewerId = viewerPlayer?.id ?? "";
  return (state.events?.claims ?? []).filter((claim) => {
    if (!claim.private) {
      return true;
    }
    return claim.viewerId === viewerId || claim.playerId === viewerId || claim.targetId === viewerId;
  });
}

export function getVisibleSpeeches(state, viewerPlayer) {
  const viewerId = viewerPlayer?.id ?? "";
  return (state.events?.speeches ?? []).filter((speech) => {
    if (!speech.private) {
      return true;
    }
    return speech.viewerId === viewerId || speech.playerId === viewerId || speech.targetId === viewerId;
  });
}

export function countAgentEvidence(agent, targetId) {
  if (!agent || !targetId) {
    return 0;
  }
  const evidence = Array.isArray(agent.evidenceBook) && agent.evidenceBook.length > 0 ? agent.evidenceBook : null;
  if (evidence) {
    return evidence.filter((entry) => (entry.targetIds ?? []).includes(targetId)).length;
  }
  return (agent.observations ?? []).filter((entry) => {
    const payload = entry.payload ?? {};
    return (
      payload.playerId === targetId ||
      payload.focusId === targetId ||
      payload.targetId === targetId ||
      payload.nomineeId === targetId ||
      payload.nominatorId === targetId
    );
  }).length;
}
