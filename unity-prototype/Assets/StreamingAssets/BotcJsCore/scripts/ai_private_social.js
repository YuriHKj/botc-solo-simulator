export function createAIPrivateSocial(deps) {
  const {
    QUESTION_INTENT,
    PERSONA_TYPES,
    PERSONA_LABELS,
    ensureDialogueState,
    refreshAIBeliefs,
    buildAIThoughtFrame,
    areKnownAllies,
    composeEvilAllianceResponse,
    composeHumanizedEvilAllianceResponse,
    rankTargets,
    getTopTarget,
    summarizeShareablePrivateNotes,
    pickCorpusTemplate,
    pickPersonaTemplate,
    pickLayeredSpeech,
    claimRoleForContext,
    roleNameById,
    humanizeSharedPrivateNote,
    composeNightInfoDisclosure,
    rememberDayStance,
    collectEvidence,
    evidenceReasonText,
    statementTargetLabel,
    dayStanceLabel,
    applySpeechBudget,
    sanitizePrivateDialogueText,
    joinSpeechFragments,
    perceivedRoleForPlayer,
    roleForPlayer,
    isEarlyInfoRole,
    getPlayerById,
    addLog,
    predictDialogueSignals,
    recordPrivateWhisperForAgents,
    rememberStatementMemory,
    pushTimeline,
    recordUtteranceMVP,
    inferSpeechActsFromIntent,
    voteStanceFromText,
    applyPrivateStatementContinuity,
    recordPrivateChannelForAgents,
    clamp,
  } = deps;
function proactiveWhisperDayRecord(state) {
  const dialogue = ensureDialogueState(state);
  const dayKey = `${state.day ?? 0}`;
  dialogue.proactivePrivateByDay[dayKey] = dialogue.proactivePrivateByDay[dayKey] ?? {
    sentIds: [],
    declinedIds: [],
  };
  dialogue.proactivePrivateByDay[dayKey].sentIds = Array.isArray(dialogue.proactivePrivateByDay[dayKey].sentIds)
    ? dialogue.proactivePrivateByDay[dayKey].sentIds
    : [];
  dialogue.proactivePrivateByDay[dayKey].declinedIds = Array.isArray(dialogue.proactivePrivateByDay[dayKey].declinedIds)
    ? dialogue.proactivePrivateByDay[dayKey].declinedIds
    : [];
  return dialogue.proactivePrivateByDay[dayKey];
}

function aiPrivateDayRecord(state) {
  const dialogue = ensureDialogueState(state);
  const dayKey = `${state.day ?? 0}`;
  dialogue.aiPrivateByDay[dayKey] = dialogue.aiPrivateByDay[dayKey] ?? {
    pairKeys: [],
  };
  return dialogue.aiPrivateByDay[dayKey];
}

function aiPrivatePairLimitForDay(day) {
  return clamp(5 - Math.max(1, Number(day) || 1), 1, 4);
}

function scoreProactiveWhisperCandidate(state, aiPlayer, human, options = {}) {
  const perceivedRole = perceivedRoleForPlayer(state, aiPlayer) ?? roleForPlayer(state, aiPlayer);
  const notes = summarizeShareablePrivateNotes(aiPlayer, 2, { state, audience: human });
  const top = getTopTarget(aiPlayer, state);
  const thoughtFrame = options.thoughtFrame ?? buildAIThoughtFrame(state, aiPlayer, {
    audience: "private",
    stage: "private",
  });
  const humanRisk = aiPlayer.suspicion?.[human.id] ?? 0.5;
  let score = 0;

  if (!aiPlayer.alive && !aiPlayer.publicClaimRoleId) {
    score += 7;
  } else if (!aiPlayer.alive) {
    score += 3;
  }
  if (notes.length > 0) {
    score += Math.min(4, notes.length * 2);
  }
  if (isEarlyInfoRole(perceivedRole)) {
    score += state.day <= 1 ? 3 : 1.5;
  }
  if (perceivedRole?.category === "outsider") {
    score += state.day <= 2 ? 1.5 : 0.5;
  }
  if (top?.score >= 0.58) {
    score += 1.5;
  }
  if (thoughtFrame.intendedAct === "whisper") {
    score += 0.8;
  }
  if (thoughtFrame.primaryConcernId && thoughtFrame.evidenceReasons.length > 0) {
    score += 0.6;
  }
  if (thoughtFrame.selfDisclosureNeed !== "none") {
    score += 0.5;
  }
  if (humanRisk >= 0.58) {
    score += 1;
  }
  if (areKnownAllies(state, aiPlayer, human)) {
    score += 6;
  }

  return score;
}

function proactiveWhisperReason(state, aiPlayer, human, composed = {}) {
  const perceivedRole = perceivedRoleForPlayer(state, aiPlayer) ?? roleForPlayer(state, aiPlayer);
  const thoughtFrame = composed.thoughtFrame ?? null;
  const notes = summarizeShareablePrivateNotes(aiPlayer, 2, { state, audience: human });
  if (!aiPlayer.alive) {
    return "出局后想把可用口径留给你";
  }
  if (thoughtFrame?.intendedAct === "whisper" && thoughtFrame.primaryConcernId) {
    const focus = getPlayerById(state, thoughtFrame.primaryConcernId);
    if (focus) {
      return `想先和你私下对一下 ${focus.name}`;
    }
  }
  if (notes.length > 0 || composed.intent === QUESTION_INTENT.NIGHT) {
    return "手里有一条可私下同步的信息";
  }
  if ((composed.focusScore ?? 0) >= 0.58) {
    const focus = composed.focusId ? getPlayerById(state, composed.focusId) : null;
    return focus ? `想先和你对一下 ${focus.name} 这条线` : "想先同步一个高压目标";
  }
  if (isEarlyInfoRole(perceivedRole)) {
    return "信息位不想第一轮直接摊到公聊";
  }
  return "想在公聊前先交换站边";
}

function proactiveWhisperOfferId(state, aiPlayer) {
  return `proactive-${state.day ?? 0}-${aiPlayer.id}`;
}

function pendingProactiveOfferFor(state, aiPlayerId) {
  const dialogue = ensureDialogueState(state);
  return dialogue.pendingProactiveWhispers.find((entry) => entry.playerId === aiPlayerId) ?? null;
}

function buildProactiveWhisperOffer(state, aiPlayer, human, composed) {
  return {
    id: proactiveWhisperOfferId(state, aiPlayer),
    day: state.day ?? 0,
    night: state.night ?? 0,
    playerId: aiPlayer.id,
    playerName: aiPlayer.name,
    playerSeat: aiPlayer.seatIndex + 1,
    personaLabel: PERSONA_LABELS[aiPlayer.aiPersona ?? PERSONA_TYPES.STEADY] ?? "稳健",
    reason: proactiveWhisperReason(state, aiPlayer, human, composed),
    prompt: `${aiPlayer.name} 想私聊：${proactiveWhisperReason(state, aiPlayer, human, composed)}`,
    response: composed.response,
    focusId: composed.focusId ?? null,
    focusScore: composed.focusScore ?? null,
    intent: composed.intent ?? QUESTION_INTENT.GENERIC,
    thoughtFrame: composed.thoughtFrame ?? null,
    createdAt: Date.now(),
  };
}

function commitProactiveWhisper(state, offer, rng = Math.random) {
  const human = state.players.find((entry) => entry.isHuman);
  const aiPlayer = getPlayerById(state, offer.playerId);
  if (!human || !aiPlayer) {
    return null;
  }
  const response = `${offer.response ?? ""}`.trim();
  const intent = offer.intent ?? QUESTION_INTENT.GENERIC;
  const focusId = offer.focusId ?? null;
  const focusScore = Number.isFinite(offer.focusScore) ? offer.focusScore : null;
  const responseSignals = predictDialogueSignals(response);

  addLog(state, "whisper", `${aiPlayer.name} -> 你：${response}`, {
    private: true,
    viewerId: human.id,
    sourceId: aiPlayer.id,
    direction: "in",
    intent,
    proactive: true,
  });

  state.events.speeches.push({
    day: state.day,
    playerId: aiPlayer.id,
    line: response,
    focusId,
    private: true,
    viewerId: human.id,
    targetId: human.id,
    proactive: true,
  });

  recordPrivateWhisperForAgents(state, {
    speakerId: aiPlayer.id,
    targetId: human.id,
    text: response,
    intent,
    focusId,
  });
  rememberStatementMemory(state, aiPlayer, "private", human.id, { ...offer, response, focusId, focusScore }, {
    source: "ai_proactive_private_whisper",
    intent,
  });

  pushTimeline(state, {
    mode: "whisper-in",
    speakerId: aiPlayer.id,
    targetId: human.id,
    text: response,
    proactive: true,
  });

  recordUtteranceMVP(state, {
    speakerId: aiPlayer.id,
    audience: "private",
    text: response,
    speechActs: [
      ...new Set([
        ...inferSpeechActsFromIntent(intent, { audience: "private", isQuestion: false }),
        ...(responseSignals.speechActs ?? []),
      ]),
    ],
    targets: focusId ? [focusId] : [human.id],
    intent,
    voteStance: voteStanceFromText(response),
    evidenceSource: areKnownAllies(state, aiPlayer, human) ? "storyteller_signal" : "private_chat",
    epistemicStrength: focusScore >= 0.72 ? 3 : focusScore >= 0.56 ? 2 : 1,
    nominationRelated: /提名|nominate/i.test(response),
    metadata: {
      source: "ai_proactive_private_whisper",
      viewerId: human.id,
      direction: "in",
      proactive: true,
      offerId: offer.id ?? "",
      mlVoteLabel: responseSignals.voteLabel ?? "undecided",
      mlVoteConfidence: responseSignals.voteConfidence ?? 0,
      mlSpeechActs: responseSignals.speechActs ?? [],
      mlTokenHits: responseSignals.tokenHits ?? 0,
    },
  });

  return {
    targetId: aiPlayer.id,
    targetName: aiPlayer.name,
    targetSeat: aiPlayer.seatIndex + 1,
    personaLabel: PERSONA_LABELS[aiPlayer.aiPersona ?? PERSONA_TYPES.STEADY] ?? "稳健",
    question: "主动来访",
    reason: offer.reason ?? "",
    response,
    focusId,
  };
}

function composeProactiveWhisper(state, aiPlayer, human, rng = Math.random, options = {}) {
  const thoughtFrame = options.thoughtFrame ?? buildAIThoughtFrame(state, aiPlayer, {
    audience: "private",
    stage: "private",
    rng,
  });
  const sameEvilTeam = areKnownAllies(state, aiPlayer, human);
  if (sameEvilTeam) {
    const allianceAnalysis = {
      intent: QUESTION_INTENT.PLAN,
      mentionedPlayers: [],
      secondaryIntent: null,
    };
    const original = composeEvilAllianceResponse(state, aiPlayer, human, allianceAnalysis, rng);
    return {
      ...composeHumanizedEvilAllianceResponse(state, aiPlayer, human, allianceAnalysis, original, rng),
      intent: QUESTION_INTENT.PLAN,
      thoughtFrame,
    };
  }

  const ranked = rankTargets(aiPlayer, state, 3).filter((entry) => entry.player.id !== human.id);
  const focus =
    (thoughtFrame.primaryConcernId
      ? ranked.find((entry) => entry.player.id === thoughtFrame.primaryConcernId)
      : null) ??
    ranked[0] ??
    null;
  const notes = summarizeShareablePrivateNotes(aiPlayer, 2, { state, audience: human });
  const lines = [];
  const persona = aiPlayer.aiPersona ?? PERSONA_TYPES.STEADY;
  let intent = QUESTION_INTENT.PLAN;

  if (!aiPlayer.alive) {
    lines.push(pickLayeredSpeech({ layer: "privateSocial", audience: "private", persona, team: aiPlayer.team, act: "deadOpener" }, {}, rng, [
      "我已经死了，再藏身份意义不大，先把链条交给你。",
    ]));
    if (!aiPlayer.publicClaimRoleId) {
      const roleId = claimRoleForContext(state, aiPlayer, human, rng, { private: true, force: true });
      if (roleId) {
        lines.push(`我的身份口径是 ${roleNameById(state, roleId)}。`);
        intent = QUESTION_INTENT.CLAIM;
      }
    } else {
      lines.push(`我的身份口径是 ${roleNameById(state, aiPlayer.publicClaimRoleId)}。`);
      intent = QUESTION_INTENT.CLAIM;
    }
  } else if (notes.length > 0) {
    lines.push(pickLayeredSpeech({ layer: "privateSocial", audience: "private", persona, team: aiPlayer.team, act: "infoOpener" }, {}, rng, [
      "我主动找你一下，手里有条线，不想等公聊里被噪音盖过去。",
    ]));
    intent = QUESTION_INTENT.NIGHT;
  } else {
    lines.push(
      rng() < 0.55
        ? pickPersonaTemplate(persona, "privateOpeners", {}, rng, ["我主动找你同步一下思路。"])
        : pickLayeredSpeech({ layer: "privateSocial", audience: "private", persona, team: aiPlayer.team, act: "syncOpener" }, {}, rng, ["我主动找你同步一下思路。"])
    );
  }

  if (notes.length > 0) {
    const disclosure = composeNightInfoDisclosure?.(state, aiPlayer, human, rng, {
      trustScore: aiPlayer.suspicion?.[human.id],
    });
    const notesText = disclosure?.text || notes.map(humanizeSharedPrivateNote).join("；");
    lines.push(pickCorpusTemplate(
      "private.proactive.noteShare",
      { notesText },
      rng,
      [`我目前能交代的是：${notesText}。`]
    ));
  }

  if (focus) {
    const stanceMemory = rememberDayStance(state, aiPlayer, focus.player.id, focus.score, "proactive-private");
    const evidence = collectEvidence(state, aiPlayer, focus.player);
    const reasonText = evidenceReasonText(evidence, "主要来自发言姿态和场上位置");
    const focusName = statementTargetLabel(state, focus.player.id);
    lines.push(
      rng() < 0.55
        ? pickPersonaTemplate(persona, "focusPush", { targetName: focusName, reasonText }, rng, [
            `我现在更想推进 ${focusName}。理由是：${reasonText}。`,
          ])
        : pickLayeredSpeech({ layer: "privateSocial", audience: "private", persona, team: aiPlayer.team, act: "focusPush" }, { targetName: focusName, reasonText }, rng, [
            `我现在更想推进 ${focusName}。理由是：${reasonText}。`,
          ])
    );
    if (stanceMemory?.turns > 1) {
      lines.push(pickCorpusTemplate(
        "private.proactive.sameStance",
        { stanceLabel: dayStanceLabel(stanceMemory.stance) },
        rng,
        [`这和我今天前面的判断一致，先按“${dayStanceLabel(stanceMemory.stance)}”处理。`]
      ));
    }
  } else {
    lines.push(pickLayeredSpeech({ layer: "privateSocial", audience: "private", persona, team: aiPlayer.team, act: "noFocus" }, {}, rng, [
      "如果今天没人给新信息，至少要逼一个明确口径，别直接空过。",
    ]));
  }

  if (state.day >= 3 && !aiPlayer.alive) {
    lines.push(pickCorpusTemplate("private.proactive.deadLegacy", {}, rng, [
      "如果我白天没机会发言，你可以把这段当作我的遗言来盘。",
    ]));
  }

  return {
    response: applySpeechBudget(
      sanitizePrivateDialogueText(joinSpeechFragments(lines), focus ? statementTargetLabel(state, focus.player.id) : ""),
      { audience: "private", maxSentences: 3, maxChars: 170 }
    ),
    focusId: focus?.player?.id ?? null,
    focusScore: focus?.score ?? null,
    intent,
    thoughtFrame,
  };
}
function scoreAIToAIWhisperPair(state, speaker, target) {
  const perceivedRole = perceivedRoleForPlayer(state, speaker) ?? roleForPlayer(state, speaker);
  const notes = summarizeShareablePrivateNotes(speaker, 2, { state, audience: target });
  const top = getTopTarget(speaker, state);
  const targetRisk = speaker.suspicion?.[target.id] ?? 0.5;
  let score = 0;

  if (areKnownAllies(state, speaker, target)) {
    score += 7;
  }
  if (!speaker.alive && !speaker.publicClaimRoleId) {
    score += 4;
  } else if (!speaker.alive) {
    score += 2;
  }
  if (notes.length > 0) {
    score += Math.min(4, notes.length * 2);
  }
  if (isEarlyInfoRole(perceivedRole)) {
    score += state.day <= 1 ? 2.5 : 1;
  }
  if (targetRisk <= 0.4) {
    score += 1.2;
  }
  if (top?.player?.id === target.id && top.score >= 0.58) {
    score += 1.2;
  }

  return score;
}

function composeAIToAIWhisper(state, speaker, target, rng = Math.random) {
  if (areKnownAllies(state, speaker, target)) {
    const allianceAnalysis = {
      intent: QUESTION_INTENT.PLAN,
      mentionedPlayers: [],
      secondaryIntent: null,
    };
    const original = composeEvilAllianceResponse(state, speaker, target, allianceAnalysis, rng);
    return {
      ...composeHumanizedEvilAllianceResponse(state, speaker, target, allianceAnalysis, original, rng),
      intent: QUESTION_INTENT.PLAN,
    };
  }

  const ranked = rankTargets(speaker, state, 3).filter((entry) => entry.player.id !== target.id);
  const focus = ranked[0] ?? null;
  const notes = summarizeShareablePrivateNotes(speaker, 2, { state, audience: target });
  const lines = [];
  const persona = speaker.aiPersona ?? PERSONA_TYPES.STEADY;
  let intent = QUESTION_INTENT.PLAN;

  if (!speaker.alive) {
    lines.push(pickLayeredSpeech({ layer: "privateSocial", audience: "private", persona, team: speaker.team, act: "deadOpener" }, {}, rng, [
      "我已经死了，白天如果再藏信息只会拖节奏。",
    ]));
    if (!speaker.publicClaimRoleId) {
      const roleId = claimRoleForContext(state, speaker, target, rng, { private: true, force: true });
      if (roleId) {
        lines.push(`我的身份口径是 ${roleNameById(state, roleId)}。`);
        intent = QUESTION_INTENT.CLAIM;
      }
    } else {
      lines.push(`我的身份口径是 ${roleNameById(state, speaker.publicClaimRoleId)}。`);
      intent = QUESTION_INTENT.CLAIM;
    }
  } else if (notes.length > 0) {
    lines.push(pickLayeredSpeech({ layer: "privateSocial", audience: "private", persona, team: speaker.team, act: "infoOpener" }, {}, rng, [
      "我私下先给你一条线，公聊里我不一定马上全摊。",
    ]));
    intent = QUESTION_INTENT.NIGHT;
  } else {
    lines.push(
      rng() < 0.55
        ? pickPersonaTemplate(persona, "privateOpeners", {}, rng, ["公聊前先同步一下，我不想被第一轮发言带偏。"])
        : pickLayeredSpeech({ layer: "privateSocial", audience: "private", persona, team: speaker.team, act: "syncOpener" }, {}, rng, ["公聊前先同步一下，我不想被第一轮发言带偏。"])
    );
  }

  if (notes.length > 0) {
    const disclosure = composeNightInfoDisclosure?.(state, speaker, target, rng, {
      trustScore: speaker.suspicion?.[target.id],
    });
    const notesText = disclosure?.text || notes.map(humanizeSharedPrivateNote).join("；");
    lines.push(pickCorpusTemplate(
      "private.proactive.noteShare",
      { notesText },
      rng,
      [`我目前能说的是：${notesText}。`]
    ));
  }

  if (focus) {
    const stanceMemory = rememberDayStance(state, speaker, focus.player.id, focus.score, "ai-private");
    const evidence = collectEvidence(state, speaker, focus.player);
    const reasonText = evidenceReasonText(evidence, "主要是发言姿态和场上位置还不顺");
    const focusName = statementTargetLabel(state, focus.player.id);
    lines.push(
      rng() < 0.55
        ? pickPersonaTemplate(persona, "focusPush", { targetName: focusName, reasonText }, rng, [
            `我更想盯 ${focusName}。理由是：${reasonText}。`,
          ])
        : pickLayeredSpeech({ layer: "privateSocial", audience: "private", persona, team: speaker.team, act: "focusPush" }, { targetName: focusName, reasonText }, rng, [
            `我更想盯 ${focusName}。理由是：${reasonText}。`,
          ])
    );
    if (stanceMemory?.turns > 1) {
      lines.push(pickCorpusTemplate(
        "private.proactive.sameStance",
        { stanceLabel: dayStanceLabel(stanceMemory.stance) },
        rng,
        [`我今天对 ta 的口径还是“${dayStanceLabel(stanceMemory.stance)}”，先不乱跳线。`]
      ));
    }
  } else {
    lines.push(pickLayeredSpeech({ layer: "privateSocial", audience: "private", persona, team: speaker.team, act: "noFocus" }, {}, rng, [
      "如果今天没有新信息，至少要逼一个明确口径，不要直接空过。",
    ]));
  }

  return {
    response: applySpeechBudget(
      sanitizePrivateDialogueText(joinSpeechFragments(lines), focus ? statementTargetLabel(state, focus.player.id) : ""),
      { audience: "private", maxSentences: 3, maxChars: 170 }
    ),
    focusId: focus?.player?.id ?? null,
    focusScore: focus?.score ?? null,
    intent,
  };
}
function runAIToAIPrivateWhispers(state, rng = Math.random) {
  if (state.phase !== "day" || state.dayStage !== "private" || state.gameOver) {
    return [];
  }

  ensureDialogueState(state);
  state.events.speeches = state.events.speeches ?? [];
  refreshAIBeliefs(state);

  const dayRecord = aiPrivateDayRecord(state);
  const usedPairs = new Set(dayRecord.pairKeys ?? []);
  const aiPlayers = state.players.filter((entry) => !entry.isHuman);
  const maxPairs = aiPrivatePairLimitForDay(state.day);
  const remainingPairs = Math.max(0, maxPairs - usedPairs.size);
  if (remainingPairs === 0 || aiPlayers.length < 2) {
    return [];
  }

  const candidates = [];
  aiPlayers.forEach((speaker) => {
    aiPlayers
      .filter((target) => target.id !== speaker.id)
      .forEach((target) => {
        const pairKey = [speaker.id, target.id].sort().join("::");
        if (usedPairs.has(pairKey)) {
          return;
        }
        candidates.push({
          speaker,
          target,
          pairKey,
          score: scoreAIToAIWhisperPair(state, speaker, target),
          tie: rng(),
        });
      });
  });

  const selected = candidates
    .filter((entry) => entry.score >= 3)
    .sort((a, b) => b.score - a.score || a.tie - b.tie)
    .slice(0, remainingPairs);

  const messages = [];
  selected.forEach(({ speaker, target, pairKey }) => {
    let composed = composeAIToAIWhisper(state, speaker, target, rng);
    composed = applyPrivateStatementContinuity(
      state,
      speaker,
      target,
      composed,
      { intent: composed.intent, mentionedPlayers: [], secondaryIntent: null }
    );
    const responseSignals = predictDialogueSignals(composed.response);

    state.events.speeches.push({
      day: state.day,
      playerId: speaker.id,
      line: composed.response,
      focusId: composed.focusId,
      private: true,
      viewerIds: [speaker.id, target.id],
      targetId: target.id,
      aiToAi: true,
      hiddenFromHuman: true,
    });

    recordPrivateWhisperForAgents(state, {
      speakerId: speaker.id,
      targetId: target.id,
      text: composed.response,
      intent: composed.intent,
      focusId: composed.focusId,
    });
    recordPrivateChannelForAgents(state, {
      speakerId: speaker.id,
      targetId: target.id,
      aiToAi: true,
    });
    rememberStatementMemory(state, speaker, "private", target.id, composed, {
      source: "ai_to_ai_private_whisper",
      intent: composed.intent,
    });

    recordUtteranceMVP(state, {
      speakerId: speaker.id,
      audience: "private",
      text: composed.response,
      speechActs: [
        ...new Set([
          ...inferSpeechActsFromIntent(composed.intent, { audience: "private", isQuestion: false }),
          ...(responseSignals.speechActs ?? []),
        ]),
      ],
      targets: composed.focusId ? [composed.focusId] : [target.id],
      intent: composed.intent,
      voteStance: voteStanceFromText(composed.response),
      evidenceSource: areKnownAllies(state, speaker, target) ? "storyteller_signal" : "private_chat",
      epistemicStrength: composed.focusScore >= 0.72 ? 3 : composed.focusScore >= 0.56 ? 2 : 1,
      nominationRelated: /提名|nominate/i.test(composed.response),
      metadata: {
        source: "ai_to_ai_private_whisper",
        targetId: target.id,
        aiToAi: true,
        hiddenFromHuman: true,
        mlVoteLabel: responseSignals.voteLabel ?? "undecided",
        mlVoteConfidence: responseSignals.voteConfidence ?? 0,
        mlSpeechActs: responseSignals.speechActs ?? [],
        mlTokenHits: responseSignals.tokenHits ?? 0,
      },
    });

    usedPairs.add(pairKey);
    messages.push({
      speakerId: speaker.id,
      speakerName: speaker.name,
      targetId: target.id,
      targetName: target.name,
      response: composed.response,
      focusId: composed.focusId,
      intent: composed.intent,
    });
  });

  dayRecord.pairKeys = [...usedPairs];
  if (messages.length > 0) {
    refreshAIBeliefs(state);
  }
  return messages;
}

function runAIProactiveWhispers(state, rng = Math.random, options = {}) {
  if (state.phase !== "day" || state.dayStage !== "private" || state.gameOver) {
    return [];
  }

  const human = state.players.find((entry) => entry.isHuman);
  if (!human) {
    return [];
  }

  refreshAIBeliefs(state);
  const dayRecord = proactiveWhisperDayRecord(state);
  const sentIds = new Set(dayRecord.sentIds ?? []);
  const declinedIds = new Set(dayRecord.declinedIds ?? []);
  const dialogue = ensureDialogueState(state);
  const pendingIds = new Set(
    dialogue.pendingProactiveWhispers
      .filter((entry) => entry.day === (state.day ?? 0))
      .map((entry) => entry.playerId)
  );
  const maxMessages = state.day <= 1 || !human.alive ? 2 : 1;
  const remainingDailySlots = Math.max(0, maxMessages - sentIds.size - pendingIds.size);
  if (remainingDailySlots === 0) {
    return options.queueOnly
      ? dialogue.pendingProactiveWhispers.filter((entry) => entry.day === (state.day ?? 0))
      : [];
  }

  const candidates = state.players
    .filter((entry) => !entry.isHuman && !sentIds.has(entry.id) && !declinedIds.has(entry.id) && !pendingIds.has(entry.id))
    .map((entry) => {
      const thoughtFrame = buildAIThoughtFrame(state, entry, {
        audience: "private",
        stage: "private",
        rng,
      });
      return {
        player: entry,
        score: scoreProactiveWhisperCandidate(state, entry, human, { thoughtFrame }) + (thoughtFrame.evidenceReasons.length > 0 ? 0.2 : 0),
        thoughtFrame,
        tie: rng(),
      };
    })
    .filter((entry) => entry.score >= 2.2)
    .sort((a, b) => b.score - a.score || a.tie - b.tie)
    .slice(0, remainingDailySlots);

  const messages = [];
  const offers = [];
  candidates.forEach(({ player: aiPlayer, thoughtFrame }) => {
    let composed = composeProactiveWhisper(state, aiPlayer, human, rng, { thoughtFrame });
    composed = applyPrivateStatementContinuity(
      state,
      aiPlayer,
      human,
      composed,
      { intent: composed.intent, mentionedPlayers: [], secondaryIntent: null }
    );
    const offer = buildProactiveWhisperOffer(state, aiPlayer, human, composed);
    if (options.queueOnly) {
      dialogue.pendingProactiveWhispers.push(offer);
      offers.push(offer);
      return;
    }
    const committed = commitProactiveWhisper(state, offer, rng);
    if (committed) {
      sentIds.add(aiPlayer.id);
      messages.push(committed);
    }
  });

  dayRecord.sentIds = [...sentIds];
  return options.queueOnly ? offers : messages;
}

function acceptAIProactiveWhisper(state, offerId, rng = Math.random) {
  if (state.phase !== "day" || state.dayStage !== "private" || state.gameOver) {
    return { ok: false, reason: "当前不在私聊阶段。" };
  }
  const dialogue = ensureDialogueState(state);
  const index = dialogue.pendingProactiveWhispers.findIndex((entry) => entry.id === offerId);
  if (index < 0) {
    return { ok: false, reason: "该主动私聊邀请不存在或已处理。" };
  }
  const [offer] = dialogue.pendingProactiveWhispers.splice(index, 1);
  const dayRecord = proactiveWhisperDayRecord(state);
  const sentIds = new Set(dayRecord.sentIds ?? []);
  const committed = commitProactiveWhisper(state, offer, rng);
  if (!committed) {
    return { ok: false, reason: "主动私聊目标已不存在。" };
  }
  sentIds.add(offer.playerId);
  dayRecord.sentIds = [...sentIds];
  return {
    ok: true,
    message: `${offer.playerName} 的主动私聊已接受。`,
    offerId,
    ...committed,
  };
}

function declineAIProactiveWhisper(state, offerId) {
  if (state.phase !== "day" || state.dayStage !== "private" || state.gameOver) {
    return { ok: false, reason: "当前不在私聊阶段。" };
  }
  const dialogue = ensureDialogueState(state);
  const index = dialogue.pendingProactiveWhispers.findIndex((entry) => entry.id === offerId);
  if (index < 0) {
    return { ok: false, reason: "该主动私聊邀请不存在或已处理。" };
  }
  const [offer] = dialogue.pendingProactiveWhispers.splice(index, 1);
  const dayRecord = proactiveWhisperDayRecord(state);
  dayRecord.declinedIds = [...new Set([...(dayRecord.declinedIds ?? []), offer.playerId])];
  return {
    ok: true,
    message: `已拒绝 ${offer.playerName} 的主动私聊。`,
    offerId,
    playerId: offer.playerId,
    playerName: offer.playerName,
  };
}


  return {
    runAIToAIPrivateWhispers,
    runAIProactiveWhispers,
    acceptAIProactiveWhisper,
    declineAIProactiveWhisper,
  };
}
