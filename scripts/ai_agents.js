const AGENT_SCHEMA_VERSION = 1;
const MAX_AGENT_OBSERVATIONS = 240;

function unique(values) {
  return [...new Set((values ?? []).filter(Boolean))];
}

function seatName(player) {
  if (!player) {
    return "--";
  }
  return `${player.seatIndex + 1}`;
}

function createAgent(player) {
  return {
    version: AGENT_SCHEMA_VERSION,
    ownerId: player.id,
    knownSelfRoleId: player.roleId ?? null,
    knownSelfTeam: player.team ?? null,
    knownAllyIds: [],
    knownDemonId: null,
    knownMinionIds: [],
    knownBluffRoleIds: [],
    observations: [],
    publicClaimByPlayerId: {},
    privateClaimByPlayerId: {},
    sourceTrust: {},
  };
}

export function ensureAIAgents(state) {
  state.aiAgents = state.aiAgents ?? {};
  (state.players ?? [])
    .filter((player) => !player.isHuman)
    .forEach((player) => {
      const existing = state.aiAgents[player.id] ?? createAgent(player);
      existing.version = AGENT_SCHEMA_VERSION;
      existing.ownerId = player.id;
      existing.knownSelfRoleId = existing.knownSelfRoleId ?? player.roleId ?? null;
      existing.knownSelfTeam = existing.knownSelfTeam ?? player.team ?? null;
      existing.knownAllyIds = unique(existing.knownAllyIds);
      existing.knownMinionIds = unique(existing.knownMinionIds);
      existing.knownBluffRoleIds = unique(existing.knownBluffRoleIds);
      existing.observations = Array.isArray(existing.observations) ? existing.observations : [];
      existing.publicClaimByPlayerId = existing.publicClaimByPlayerId ?? {};
      existing.privateClaimByPlayerId = existing.privateClaimByPlayerId ?? {};
      existing.sourceTrust = existing.sourceTrust ?? {};
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

export function addAgentObservation(state, playerOrId, observation) {
  const agent = getAIAgent(state, playerOrId);
  if (!agent) {
    return null;
  }
  const record = {
    id: `${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    day: state.day ?? 0,
    night: state.night ?? 0,
    timestamp: Date.now(),
    ...observation,
  };
  agent.observations.push(record);
  if (agent.observations.length > MAX_AGENT_OBSERVATIONS) {
    agent.observations.splice(0, agent.observations.length - MAX_AGENT_OBSERVATIONS);
  }
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
  addAgentObservation(state, player.id, {
    kind: "night-info",
    source: metadata.source ?? "storyteller",
    text,
    private: true,
    reliability: metadata.reliability ?? "storyteller",
    payload: metadata.payload ?? {},
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
