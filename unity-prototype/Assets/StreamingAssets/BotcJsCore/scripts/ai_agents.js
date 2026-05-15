import { getRoleById } from "./data.js";

const AGENT_SCHEMA_VERSION = 2;
const MAX_AGENT_OBSERVATIONS = 240;
const MAX_AGENT_EVIDENCE = 360;
const MAX_BELIEF_TRAIL_PER_TARGET = 80;
const MAX_KG_NODES = 420;
const MAX_KG_EDGES = 680;

const SOURCE_TRUST_DEFAULTS = {
  storyteller: 0.96,
  "public-procedure": 0.88,
  "social-read": 0.58,
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
    sourceTrustByPlayerId: {},
    trustEvents: [],
    knowledgeGraph: {
      version: 1,
      nodes: [],
      edges: [],
    },
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

function dynamicSourceTrust(agent, source, sourceId = "") {
  const categoryTrust = normalizeReliability(agent?.sourceTrust?.[source], source);
  const playerTrust = Number.isFinite(agent?.sourceTrustByPlayerId?.[sourceId])
    ? agent.sourceTrustByPlayerId[sourceId]
    : null;
  if (playerTrust === null) {
    return categoryTrust;
  }
  return clamp01(categoryTrust * 0.35 + playerTrust * 0.65, categoryTrust);
}

function ensureKnowledgeGraph(agent) {
  agent.knowledgeGraph = agent.knowledgeGraph ?? {};
  agent.knowledgeGraph.version = 1;
  agent.knowledgeGraph.nodes = Array.isArray(agent.knowledgeGraph.nodes) ? agent.knowledgeGraph.nodes : [];
  agent.knowledgeGraph.edges = Array.isArray(agent.knowledgeGraph.edges) ? agent.knowledgeGraph.edges : [];
  return agent.knowledgeGraph;
}

function pushGraphNode(agent, node) {
  if (!node?.id || !node.type) {
    return null;
  }
  const graph = ensureKnowledgeGraph(agent);
  const existing = graph.nodes.find((entry) => entry.id === node.id);
  if (existing) {
    Object.assign(existing, { ...node, metadata: { ...(existing.metadata ?? {}), ...(node.metadata ?? {}) } });
    return existing;
  }
  const record = {
    id: node.id,
    type: node.type,
    label: node.label ?? node.id,
    playerId: node.playerId ?? "",
    roleId: node.roleId ?? "",
    evidenceId: node.evidenceId ?? "",
    day: node.day ?? null,
    night: node.night ?? null,
    metadata: node.metadata ?? {},
  };
  graph.nodes.push(record);
  if (graph.nodes.length > MAX_KG_NODES) {
    graph.nodes.splice(0, graph.nodes.length - MAX_KG_NODES);
  }
  return record;
}

function pushGraphEdge(agent, edge) {
  if (!edge?.from || !edge?.to || !edge.type) {
    return null;
  }
  const graph = ensureKnowledgeGraph(agent);
  const key = edge.id ?? `${edge.from}->${edge.type}->${edge.to}:${edge.evidenceId ?? ""}`;
  const existing = graph.edges.find((entry) => entry.id === key);
  if (existing) {
    Object.assign(existing, { ...edge, id: key, metadata: { ...(existing.metadata ?? {}), ...(edge.metadata ?? {}) } });
    return existing;
  }
  const record = {
    id: key,
    from: edge.from,
    to: edge.to,
    type: edge.type,
    evidenceId: edge.evidenceId ?? "",
    observationId: edge.observationId ?? "",
    day: edge.day ?? null,
    night: edge.night ?? null,
    visibility: edge.visibility ?? "",
    trust: Number.isFinite(edge.trust) ? edge.trust : null,
    contaminationRisk: Number.isFinite(edge.contaminationRisk) ? edge.contaminationRisk : null,
    metadata: edge.metadata ?? {},
  };
  graph.edges.push(record);
  if (graph.edges.length > MAX_KG_EDGES) {
    graph.edges.splice(0, graph.edges.length - MAX_KG_EDGES);
  }
  return record;
}

function graphPlayerNodeId(playerId) {
  return playerId ? `player:${playerId}` : "";
}

function graphRoleNodeId(roleId) {
  return roleId ? `role:${roleId}` : "";
}

function graphEvidenceNodeId(evidenceId) {
  return evidenceId ? `evidence:${evidenceId}` : "";
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
  if (observation.kind === "public-speech" || observation.kind === "private-whisper" || observation.kind === "private-channel") {
    return "social";
  }
  return observation.kind ?? "misc";
}

function evidenceFromObservation(state, agent, observation) {
  const source = observation.source ?? "unknown";
  const reliabilityScore = normalizeReliability(observation.reliability, source);
  const contaminationRisk = inferContaminationRisk(observation, reliabilityScore);
  const targetIds = inferTargetIds(observation);
  const sourceId = observation.sourceId ?? inferSourceId(agent, observation);
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
    sourceId,
    channel: inferChannel(observation),
    visibility: inferVisibility(observation),
    private: !!observation.private,
    targetIds,
    subjectId: observation.subjectId ?? targetIds[0] ?? null,
    polarity: inferPolarity(observation),
    reliability: observation.reliability ?? "uncertain",
    reliabilityScore,
    sourceTrust: dynamicSourceTrust(agent, source, sourceId),
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

function addKnowledgeGraphForEvidence(agent, evidence) {
  if (!agent || !evidence?.id) {
    return;
  }
  const payload = evidence.payload ?? {};
  const evidenceNodeId = graphEvidenceNodeId(evidence.id);
  pushGraphNode(agent, {
    id: evidenceNodeId,
    type: "evidence",
    label: conciseText(evidence.text || evidence.kind || evidence.id, 48),
    evidenceId: evidence.id,
    day: evidence.day,
    night: evidence.night,
    metadata: {
      kind: evidence.kind,
      source: evidence.source,
      visibility: evidence.visibility,
      reliabilityScore: evidence.reliabilityScore,
      sourceTrust: evidence.sourceTrust,
      contaminationRisk: evidence.contaminationRisk,
    },
  });

  const sourcePlayerId = evidence.sourceId && evidence.sourceId !== "storyteller" ? evidence.sourceId : payload.speakerId;
  if (sourcePlayerId) {
    pushGraphNode(agent, { id: graphPlayerNodeId(sourcePlayerId), type: "player", label: sourcePlayerId, playerId: sourcePlayerId });
    pushGraphEdge(agent, {
      from: graphPlayerNodeId(sourcePlayerId),
      to: evidenceNodeId,
      type: "source_of",
      evidenceId: evidence.id,
      observationId: evidence.observationId,
      day: evidence.day,
      night: evidence.night,
      visibility: evidence.visibility,
      trust: evidence.sourceTrust,
      contaminationRisk: evidence.contaminationRisk,
    });
  }

  (evidence.targetIds ?? []).forEach((targetId) => {
    pushGraphNode(agent, { id: graphPlayerNodeId(targetId), type: "player", label: targetId, playerId: targetId });
    pushGraphEdge(agent, {
      from: evidenceNodeId,
      to: graphPlayerNodeId(targetId),
      type: evidence.kind === "night-info" ? "night_info_about" : "about_player",
      evidenceId: evidence.id,
      observationId: evidence.observationId,
      day: evidence.day,
      night: evidence.night,
      visibility: evidence.visibility,
      trust: evidence.sourceTrust,
      contaminationRisk: evidence.contaminationRisk,
      metadata: {
        polarity: evidence.polarity,
        sourceRoleId: evidence.sourceRoleId,
        contaminationReason: evidence.contaminationReason,
      },
    });
  });

  if (evidence.kind === "claim" && payload.playerId && payload.roleId) {
    pushGraphNode(agent, { id: graphPlayerNodeId(payload.playerId), type: "player", label: payload.playerId, playerId: payload.playerId });
    pushGraphNode(agent, { id: graphRoleNodeId(payload.roleId), type: "role", label: payload.roleId, roleId: payload.roleId });
    pushGraphEdge(agent, {
      from: graphPlayerNodeId(payload.playerId),
      to: graphRoleNodeId(payload.roleId),
      type: "claimed_role",
      evidenceId: evidence.id,
      observationId: evidence.observationId,
      day: evidence.day,
      night: evidence.night,
      visibility: evidence.visibility,
      trust: evidence.sourceTrust,
      contaminationRisk: evidence.contaminationRisk,
      metadata: { private: !!evidence.private },
    });
  }

  if ((evidence.kind === "private-whisper" || evidence.kind === "private-channel") && payload.speakerId && payload.targetId) {
    pushGraphEdge(agent, {
      from: graphPlayerNodeId(payload.speakerId),
      to: graphPlayerNodeId(payload.targetId),
      type: "whispered_to",
      evidenceId: evidence.id,
      observationId: evidence.observationId,
      day: evidence.day,
      night: evidence.night,
      visibility: evidence.visibility,
      trust: evidence.sourceTrust,
      contaminationRisk: evidence.contaminationRisk,
      metadata: {
        intent: payload.intent ?? "",
        focusId: payload.focusId ?? "",
        contentKnown: evidence.kind === "private-whisper",
        aiToAi: !!payload.aiToAi,
      },
    });
  }

  if (evidence.kind === "public-speech" && payload.speakerId && payload.focusId) {
    const relationType =
      evidence.polarity === "defend"
        ? "public_defended"
        : evidence.polarity === "accuse" || evidence.polarity === "pressure"
        ? "public_accused"
        : "";
    if (relationType) {
      pushGraphEdge(agent, {
        from: graphPlayerNodeId(payload.speakerId),
        to: graphPlayerNodeId(payload.focusId),
        type: relationType,
        evidenceId: evidence.id,
        observationId: evidence.observationId,
        day: evidence.day,
        night: evidence.night,
        visibility: evidence.visibility,
        trust: evidence.sourceTrust,
        contaminationRisk: evidence.contaminationRisk,
        metadata: { polarity: evidence.polarity, roundInDay: payload.roundInDay, orderIndex: payload.orderIndex },
      });
    }
  }

  if (evidence.kind === "nomination" && payload.nominatorId && payload.nomineeId) {
    pushGraphEdge(agent, {
      from: graphPlayerNodeId(payload.nominatorId),
      to: graphPlayerNodeId(payload.nomineeId),
      type: "nominated",
      evidenceId: evidence.id,
      observationId: evidence.observationId,
      day: evidence.day,
      night: evidence.night,
      visibility: evidence.visibility,
      trust: evidence.sourceTrust,
    });
  }

  if (evidence.kind === "vote" && payload.nomineeId) {
    (payload.votes ?? []).forEach((vote) => {
      if (!vote?.voterId || vote.abstain) {
        return;
      }
      pushGraphEdge(agent, {
        from: graphPlayerNodeId(vote.voterId),
        to: graphPlayerNodeId(payload.nomineeId),
        type: vote.vote ? "voted_yes_on" : "voted_no_on",
        evidenceId: evidence.id,
        observationId: evidence.observationId,
        day: evidence.day,
        night: evidence.night,
        visibility: evidence.visibility,
        trust: evidence.sourceTrust,
        metadata: { passed: !!payload.passed, threshold: payload.threshold, yesVotes: payload.yesVotes },
      });
    });
  }

  if ((evidence.kind === "night-death" || evidence.kind === "execution") && payload.playerId && payload.roleId) {
    pushGraphNode(agent, { id: graphPlayerNodeId(payload.playerId), type: "player", label: payload.playerId, playerId: payload.playerId });
    pushGraphNode(agent, { id: graphRoleNodeId(payload.roleId), type: "role", label: payload.roleId, roleId: payload.roleId });
    pushGraphEdge(agent, {
      from: graphPlayerNodeId(payload.playerId),
      to: graphRoleNodeId(payload.roleId),
      type: "revealed_as",
      evidenceId: evidence.id,
      observationId: evidence.observationId,
      day: evidence.day,
      night: evidence.night,
      visibility: evidence.visibility,
      trust: 1,
      metadata: { reason: payload.reason ?? "", phase: payload.phase ?? "" },
    });
  }
}

function refreshKnowledgeGraphTrustForSource(agent, sourcePlayerId) {
  if (!agent || !sourcePlayerId) {
    return;
  }
  const evidenceTrustById = new Map();
  (agent.evidenceBook ?? []).forEach((entry) => {
    if (entry.sourceId === sourcePlayerId && entry.id) {
      evidenceTrustById.set(entry.id, entry.sourceTrust);
    }
  });
  if (evidenceTrustById.size === 0) {
    return;
  }
  const sourceNodeId = graphPlayerNodeId(sourcePlayerId);
  const graph = ensureKnowledgeGraph(agent);
  graph.edges.forEach((edge) => {
    if (evidenceTrustById.has(edge.evidenceId)) {
      edge.trust = evidenceTrustById.get(edge.evidenceId);
    } else if (edge.type === "source_of" && edge.from === sourceNodeId && evidenceTrustById.has(edge.to?.replace(/^evidence:/, ""))) {
      edge.trust = evidenceTrustById.get(edge.to.replace(/^evidence:/, ""));
    }
  });
}

function pushEvidence(agent, evidence) {
  agent.evidenceBook = Array.isArray(agent.evidenceBook) ? agent.evidenceBook : [];
  if (evidence.observationId && agent.evidenceBook.some((entry) => entry.observationId === evidence.observationId)) {
    return evidence;
  }
  agent.evidenceBook.push(evidence);
  addKnowledgeGraphForEvidence(agent, evidence);
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
      existing.sourceTrustByPlayerId = existing.sourceTrustByPlayerId ?? {};
      existing.trustEvents = Array.isArray(existing.trustEvents) ? existing.trustEvents : [];
      ensureKnowledgeGraph(existing);
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
    return "（这条先打折听）";
  }
  if (risk >= 0.36) {
    return "（先复核）";
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
      return `夜里那条信息让我先看 ${targetSeat} 号${suffix}`;
    }
    return `有人私下提到 ${targetSeat} 号${suffix}`;
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
    return `夜里那条信息让我先看 ${targetSeat} 号${suffix}`;
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
    sourceTrust: dynamicSourceTrust(agent, source, evidence.sourceId ?? "manual"),
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

export function getAgentSourceTrustForPlayer(state, viewerOrId, sourcePlayerId) {
  const agent = getAIAgent(state, viewerOrId);
  if (!agent || !sourcePlayerId) {
    return 0.5;
  }
  return Number.isFinite(agent.sourceTrustByPlayerId?.[sourcePlayerId])
    ? agent.sourceTrustByPlayerId[sourcePlayerId]
    : 0.5;
}

export function getAgentKnowledgeGraph(state, viewerOrId, options = {}) {
  const agent = getAIAgent(state, viewerOrId);
  if (!agent) {
    return { version: 1, nodes: [], edges: [] };
  }
  const graph = ensureKnowledgeGraph(agent);
  if (!options.targetId && !options.type) {
    return graph;
  }
  const targetNodeId = graphPlayerNodeId(options.targetId);
  const edges = graph.edges.filter((edge) => {
    if (options.type && edge.type !== options.type) {
      return false;
    }
    if (targetNodeId && edge.from !== targetNodeId && edge.to !== targetNodeId) {
      return false;
    }
    return true;
  });
  const nodeIds = new Set(edges.flatMap((edge) => [edge.from, edge.to]));
  return {
    version: graph.version,
    nodes: graph.nodes.filter((node) => nodeIds.has(node.id)),
    edges,
  };
}

export function updateAgentSourceTrustForPlayer(
  state,
  viewerOrId,
  sourcePlayerId,
  { delta = 0, reason = "", eventKey = "", evidenceId = "", source = "social", metadata = {} } = {}
) {
  const agent = getAIAgent(state, viewerOrId);
  if (!agent || !sourcePlayerId || !Number.isFinite(delta) || delta === 0) {
    return null;
  }
  agent.sourceTrustByPlayerId = agent.sourceTrustByPlayerId ?? {};
  agent.trustEvents = Array.isArray(agent.trustEvents) ? agent.trustEvents : [];
  const key = eventKey || `${reason}:${sourcePlayerId}:${evidenceId}:${state.day ?? 0}:${state.night ?? 0}`;
  if (agent.trustEvents.some((entry) => entry.eventKey === key)) {
    return null;
  }
  const before = getAgentSourceTrustForPlayer(state, agent.ownerId, sourcePlayerId);
  const after = clamp01(before + delta, before);
  agent.sourceTrustByPlayerId[sourcePlayerId] = after;
  const record = {
    id: `trust-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    eventKey: key,
    day: state.day ?? 0,
    night: state.night ?? 0,
    phase: state.phase ?? "",
    timestamp: Date.now(),
    sourcePlayerId,
    source,
    reason,
    before,
    after,
    delta,
    evidenceId,
    metadata,
  };
  agent.trustEvents.push(record);
  if (agent.trustEvents.length > 120) {
    agent.trustEvents.splice(0, agent.trustEvents.length - 120);
  }
  (agent.evidenceBook ?? []).forEach((entry) => {
    if (entry.sourceId === sourcePlayerId) {
      entry.sourceTrust = dynamicSourceTrust(agent, entry.source, entry.sourceId);
    }
  });
  refreshKnowledgeGraphTrustForSource(agent, sourcePlayerId);
  return record;
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

export function recordPublicSpeechForAgents(
  state,
  { speakerId, text, focusId = null, roundInDay = null, orderIndex = null, polarity = "" }
) {
  observeAllAI(state, {
    kind: "public-speech",
    source: "public-chat",
    private: false,
    text,
    payload: { speakerId, focusId, roundInDay, orderIndex, polarity },
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

export function recordPrivateChannelForAgents(state, { speakerId, targetId, aiToAi = false }) {
  observeAllAI(state, {
    kind: "private-channel",
    source: "social-read",
    private: false,
    reliability: "social",
    text: `Private channel observed: ${speakerId} -> ${targetId}.`,
    payload: {
      speakerId,
      targetId,
      aiToAi: !!aiToAi,
      contentKnown: false,
    },
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

function playerPublicView(state, viewerPlayer, player) {
  const suspicion = viewerPlayer?.suspicion?.[player.id];
  return {
    id: player.id,
    name: player.name,
    seatIndex: player.seatIndex,
    alive: !!player.alive,
    dead: !player.alive,
    isHuman: !!player.isHuman,
    ghostVote: !!player.ghostVote,
    nominatedToday: !!player.nominatedToday,
    beenNominatedToday: !!player.beenNominatedToday,
    publicClaimRoleId: player.publicClaimRoleId ?? null,
    markedRoleId: player.markedRoleId ?? null,
    suspicion: Number.isFinite(suspicion) ? suspicion : 0.5,
    reasonFlags: viewerPlayer?.reasonFlags?.[player.id] ?? [],
  };
}

function audienceRelationFor(state, viewerPlayer, targetPlayer) {
  if (!targetPlayer) {
    return "none";
  }
  if (viewerPlayer?.id === targetPlayer.id) {
    return "self";
  }
  if (areKnownAllies(state, viewerPlayer, targetPlayer)) {
    return "known-ally";
  }
  if (targetPlayer.isHuman) {
    return "human";
  }
  return "unknown";
}

export function buildAgentView(state, viewerPlayerOrId, options = {}) {
  ensureAIAgents(state);
  const viewerPlayer =
    typeof viewerPlayerOrId === "string"
      ? (state.players ?? []).find((entry) => entry.id === viewerPlayerOrId)
      : viewerPlayerOrId;
  if (!viewerPlayer) {
    return null;
  }

  const agent = getAIAgent(state, viewerPlayer);
  const audience = options.audience ?? "self";
  const targetPlayer = options.targetId
    ? (state.players ?? []).find((entry) => entry.id === options.targetId) ?? null
    : null;
  const knownSelfTeam = agent?.knownSelfTeam ?? viewerPlayer.apparentTeam ?? null;
  const canRevealEvilKnowledge =
    knownSelfTeam === "evil" && (audience !== "public" || targetPlayer?.id === viewerPlayer.id);
  const knownBluffRoleIds = canRevealEvilKnowledge ? [...(agent?.knownBluffRoleIds ?? [])] : [];
  const visibleClaims = getVisibleClaims(state, viewerPlayer);
  const visibleSpeeches = getVisibleSpeeches(state, viewerPlayer);
  const targets = (state.players ?? []).map((player) => playerPublicView(state, viewerPlayer, player));

  const view = {
    kind: "agent-view",
    viewerId: viewerPlayer.id,
    day: state.day ?? 0,
    night: state.night ?? 0,
    phase: state.phase ?? "",
    dayStage: state.dayStage ?? "",
    audience,
    targetId: targetPlayer?.id ?? null,
    audienceRelation: audienceRelationFor(state, viewerPlayer, targetPlayer),
    canUsePrivateEvidence: audience !== "public",
    canRevealEvilKnowledge,
    self: {
      id: viewerPlayer.id,
      name: viewerPlayer.name,
      seatIndex: viewerPlayer.seatIndex,
      alive: !!viewerPlayer.alive,
      isHuman: !!viewerPlayer.isHuman,
      teamKnownToSelf: knownSelfTeam,
      roleKnownToSelf: agent?.knownSelfRoleId ?? viewerPlayer.apparentRoleId ?? null,
      perceivedRoleId: viewerPlayer.apparentRoleId ?? agent?.knownSelfRoleId ?? null,
    },
    knownAllies: [...(agent?.knownAllyIds ?? [])],
    knownDemonId: canRevealEvilKnowledge ? agent?.knownDemonId ?? null : null,
    knownMinionIds: canRevealEvilKnowledge ? [...(agent?.knownMinionIds ?? [])] : [],
    knownBluffRoleIds,
    visibleClaims,
    visibleSpeeches,
    visibleVotes: [...(state.events?.votes ?? [])],
    visibleNominations: [...(state.events?.nominations ?? [])],
    visibleDeaths: [
      ...(state.events?.nightDeaths ?? []),
      ...(state.events?.executions ?? []),
      ...(state.events?.deaths ?? []),
    ],
    targets,
    targetById: Object.fromEntries(targets.map((target) => [target.id, target])),
    evidenceForTarget(targetId, evidenceOptions = {}) {
      const scopedOptions = {
        ...evidenceOptions,
        publicOnly: evidenceOptions.publicOnly ?? audience === "public",
        includePrivate: evidenceOptions.includePrivate ?? audience !== "public",
      };
      return getDialogueEvidenceForTarget(state, viewerPlayer, targetId, scopedOptions);
    },
    summariesForTarget(targetId, evidenceOptions = {}) {
      const scopedOptions = {
        ...evidenceOptions,
        publicOnly: evidenceOptions.publicOnly ?? audience === "public",
        includePrivate: evidenceOptions.includePrivate ?? audience !== "public",
      };
      return summarizeEvidenceForDialogue(state, viewerPlayer, targetId, scopedOptions);
    },
    trailForTarget(targetId) {
      return getSuspicionTrailForTarget(state, viewerPlayer, targetId);
    },
    evidenceCountForTarget(targetId) {
      return countAgentEvidence(agent, targetId);
    },
    graphForTarget(targetId, graphOptions = {}) {
      return getAgentKnowledgeGraph(state, viewerPlayer, { ...graphOptions, targetId });
    },
  };
  Object.defineProperty(view, "state", { value: state, enumerable: false });
  Object.defineProperty(view, "viewerPlayer", { value: viewerPlayer, enumerable: false });
  Object.defineProperty(view, "agent", { value: agent, enumerable: false });
  return view;
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
