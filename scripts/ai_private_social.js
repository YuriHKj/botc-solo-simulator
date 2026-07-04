export function createAIPrivateSocial(deps) {
  const {
    QUESTION_INTENT,
    PERSONA_TYPES,
    PERSONA_LABELS,
    ensureDialogueState,
    refreshAIBeliefs,
    buildAIThoughtFrame,
    buildAIStrategyContext,
    buildAgentView,
    buildDialogueEvidenceContract,
    buildDecisionRationale,
    attachDecisionRationaleSpokenLine,
    attachClaimDisclosureRationaleSpokenLine,
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
    crossDayStanceContinuityLine,
    getSharedInfoMemory,
    collectEvidence,
    evidenceReasonText,
    statementTargetLabel,
    dayStanceLabel,
    applyHumanSpeechCadence,
    applySpeechBudget,
    sanitizePrivateDialogueText,
    joinSpeechFragments,
    perceivedRoleForPlayer,
    roleForPlayer,
    isEarlyInfoRole,
    getPlayerById,
    addLog,
    consumePrivateChat,
    predictDialogueSignals,
    recordPrivateWhisperForAgents,
    rememberSharedInfoMemory,
    rememberStatementMemory,
    summarizeSharedInfoRepeat,
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

function cleanHiddenEvilCoordinationText(text) {
  let value = `${text ?? ""}`
    .replace(/^我直接说，(?=.*我直接说。)/u, "")
    .replace(/([0-9]+号)\s+(是个不错的火力点)/gu, "$1$2")
    .replace(/把\s*([0-9]+号)\s*放到/gu, "把$1放到")
    .trim();
  const openQuoteCount = (value.match(/“/gu) ?? []).length;
  const closeQuoteCount = (value.match(/”/gu) ?? []).length;
  if (openQuoteCount > closeQuoteCount) {
    value = `${value.replace(/[。！？；]?$/u, "")}”。`;
  }
  return value;
}

const PRIVATE_SOCIAL_RATIONALE_LABEL_PATTERN =
  /^(验证点|判定标准|证据联动|压力档位|反证|桌面风险|信息收益|桌面反应|时机窗口|世界分支|票面联盟|来源可靠度|时间线一致性|动机归因|举证责任|追问顺序|行动门槛|记忆连续性|表达纪律|不确定性|证据新鲜度|证伪检查|因果链|前提审计|机制敏感性|角色假说)\s*[：:]\s*/u;

function privateSocialRationaleSentence(text) {
  const value = `${text ?? ""}`.trim().replace(PRIVATE_SOCIAL_RATIONALE_LABEL_PATTERN, "").trim();
  if (!value) {
    return "";
  }
  return /[。！？]$/.test(value) ? value : `${value}。`;
}

function uniquePrivateSocialFragments(fragments = []) {
  const seen = new Set();
  return fragments.filter((entry) => {
    const value = `${entry ?? ""}`.trim();
    if (!value) return false;
    const key = value.replace(/[，。！？；：、,.!?;:\s]/gu, "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isTargetSwitchPrivateSocialLine(line) {
  return /昨天主线|天前主线|先转|不等于放掉|旧线|回看/.test(`${line ?? ""}`);
}

function selectedPrivateSocialRationaleFragments(decisionRationale, intent) {
  if (!decisionRationale?.focusId) {
    return [];
  }
  const targetSwitchLine = privateSocialRationaleSentence(
    decisionRationale.targetSwitchLine || decisionRationale.memoryContinuityLine
  );
  const targetSwitchMemoryLine = isTargetSwitchPrivateSocialLine(targetSwitchLine) ? targetSwitchLine : "";
  const verificationLine = privateSocialRationaleSentence(decisionRationale.verificationLine);
  const evidenceModeLine = privateSocialRationaleSentence(decisionRationale.evidenceModeLine);
  const responsePlanLine = privateSocialRationaleSentence(decisionRationale.responsePlanLine);
  const actionThresholdLine = privateSocialRationaleSentence(decisionRationale.actionThresholdLine);
  const roleHypothesisLine = privateSocialRationaleSentence(decisionRationale.roleHypothesisLine);
  const falsificationCheckLine = privateSocialRationaleSentence(decisionRationale.falsificationCheckLine);
  const evidenceBoundaryLine = privateSocialRationaleSentence(decisionRationale.evidenceBoundaryLine);
  const confidenceLine = privateSocialRationaleSentence(decisionRationale.confidenceLine);
  const reconsiderationLine = privateSocialRationaleSentence(decisionRationale.reconsiderationLine);
  const byIntent = {
    [QUESTION_INTENT.VOTE]: [targetSwitchMemoryLine, responsePlanLine, actionThresholdLine, falsificationCheckLine],
    [QUESTION_INTENT.PLAN]: [targetSwitchMemoryLine, verificationLine, responsePlanLine, actionThresholdLine],
    [QUESTION_INTENT.NIGHT]: [targetSwitchMemoryLine, evidenceModeLine, verificationLine, evidenceBoundaryLine],
    [QUESTION_INTENT.CLAIM]: [targetSwitchMemoryLine, evidenceModeLine, verificationLine, evidenceBoundaryLine],
  };
  const fallback = [targetSwitchMemoryLine, verificationLine, roleHypothesisLine, responsePlanLine, evidenceModeLine, confidenceLine, reconsiderationLine];
  return uniquePrivateSocialFragments([...(byIntent[intent] ?? []), ...fallback]).slice(0, 2);
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

function sharedPrivateInfoSummary(state, speaker, audience, limit = 2) {
  return summarizeShareablePrivateNotes(speaker, limit, { state, audience })
    .map(humanizeSharedPrivateNote)
    .filter(Boolean)
    .join(" / ");
}

function scoreProactiveWhisperCandidate(state, aiPlayer, human, options = {}) {
  const perceivedRole = perceivedRoleForPlayer(state, aiPlayer) ?? roleForPlayer(state, aiPlayer);
  const notes = summarizeShareablePrivateNotes(aiPlayer, 2, { state, audience: human });
  const sharedSummary = sharedPrivateInfoSummary(state, aiPlayer, human);
  const repeat = summarizeSharedInfoRepeat
    ? summarizeSharedInfoRepeat(state, aiPlayer, human, sharedSummary)
    : null;
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
  if (repeat?.repeated && repeat.staleDays >= 1) {
    score -= notes.length > 0 ? 4.2 : 1.2;
  } else if (getSharedInfoMemory?.(state, aiPlayer.id, human.id)?.claimRoleId && state.day >= 2) {
    score -= 0.8;
  }

  return score;
}

function proactiveWhisperReason(state, aiPlayer, human, composed = {}) {
  const perceivedRole = perceivedRoleForPlayer(state, aiPlayer) ?? roleForPlayer(state, aiPlayer);
  const thoughtFrame = composed.thoughtFrame ?? null;
  const notes = summarizeShareablePrivateNotes(aiPlayer, 2, { state, audience: human });
  const sharedSummary = sharedPrivateInfoSummary(state, aiPlayer, human);
  const repeat = summarizeSharedInfoRepeat
    ? summarizeSharedInfoRepeat(state, aiPlayer, human, sharedSummary)
    : null;
  if (!aiPlayer.alive) {
    return "出局后想把可用口径留给你";
  }
  if (thoughtFrame?.intendedAct === "whisper" && thoughtFrame.primaryConcernId) {
    const focus = getPlayerById(state, thoughtFrame.primaryConcernId);
    if (focus) {
      return `想先和你私下对一下 ${focus.name}`;
    }
  }
  if (repeat?.repeated && repeat.staleDays >= 1) {
    return "昨天那条信息没有变化，只想补一下今天的观察";
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

function privateDialogueEventAnchor(state, options = {}) {
  const timestamp = Number.isFinite(Number(options.timestamp)) ? Number(options.timestamp) : Date.now();
  const speakerId = options.speakerId ?? "";
  const targetId = options.targetId ?? "";
  const eventId =
    options.eventId ??
    `${options.mode ?? "private"}-${state.day ?? 0}-${speakerId || "speaker"}-${targetId || "target"}-${timestamp}`;
  return {
    eventId,
    timelineEntryId: options.timelineEntryId ?? eventId,
    mode: options.mode ?? "private",
    source: options.source ?? "private",
    audience: options.audience ?? "private",
    speakerId,
    targetId,
    focusId: options.focusId ?? "",
    visibility: options.visibility ?? "private",
    day: state.day ?? 0,
    night: state.night ?? 0,
    timestamp,
    text: options.text ?? "",
  };
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
    evidenceContract: composed.evidenceContract ?? null,
    decisionRationale: composed.decisionRationale ?? null,
    claimDisclosureRationale: composed.claimDisclosureRationale ?? null,
    crossDayStance: composed.crossDayStance ?? null,
    sourceEventAnchor: composed.sourceEventAnchor ?? null,
    infoSummary: composed.infoSummary ?? "",
    repeatedInfo: !!composed.repeatedInfo,
    createdAt: composed.sourceEventAnchor?.timestamp ?? Date.now(),
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
  const sourceEventAnchor = offer.sourceEventAnchor ?? privateDialogueEventAnchor(state, {
    eventId: offer.id ?? "",
    mode: "whisper-in",
    source: "ai_proactive_private_whisper",
    audience: "private",
    speakerId: aiPlayer.id,
    targetId: human.id,
    visibility: "private",
    timestamp: offer.createdAt,
  });
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
    evidenceContract: offer.evidenceContract ?? null,
    decisionRationale: offer.decisionRationale ?? null,
    claimDisclosureRationale: offer.claimDisclosureRationale ?? null,
    crossDayStance: offer.crossDayStance ?? null,
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
  if (rememberSharedInfoMemory && (offer.infoSummary || aiPlayer.publicClaimRoleId)) {
    rememberSharedInfoMemory(state, aiPlayer, human, {
      infoSummary: offer.infoSummary,
      claimRoleId: aiPlayer.publicClaimRoleId ?? "",
      source: "ai_proactive_private_whisper",
    });
  }

  pushTimeline(state, {
    id: sourceEventAnchor.eventId,
    timestamp: sourceEventAnchor.timestamp,
    mode: "whisper-in",
    speakerId: aiPlayer.id,
    targetId: human.id,
    text: response,
    proactive: true,
    focusId: focusId ?? "",
    evidenceSummary: offer.evidenceContract?.spokenText || offer.evidenceContract?.text || "",
    decisionRationale: offer.decisionRationale ?? null,
    claimDisclosureRationale: offer.claimDisclosureRationale ?? null,
    crossDayStance: offer.crossDayStance ?? null,
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
      decisionRationale: offer.decisionRationale ?? null,
      claimDisclosureRationale: offer.claimDisclosureRationale ?? null,
      crossDayStance: offer.crossDayStance ?? null,
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
    decisionRationale: offer.decisionRationale ?? null,
    claimDisclosureRationale: offer.claimDisclosureRationale ?? null,
    crossDayStance: offer.crossDayStance ?? null,
  };
}

function composeProactiveWhisper(state, aiPlayer, human, rng = Math.random, options = {}) {
  const sourceEventAnchor = options.sourceEventAnchor ?? privateDialogueEventAnchor(state, {
    eventId: proactiveWhisperOfferId(state, aiPlayer),
    mode: "whisper-in",
    source: "ai_proactive_private_whisper",
    audience: "private",
    speakerId: aiPlayer.id,
    targetId: human?.id ?? "",
    visibility: "private",
  });
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
      sourceEventAnchor,
    };
  }

  const ranked = rankTargets(aiPlayer, state, 3).filter((entry) => entry.player.id !== human.id);
  const focus =
    (thoughtFrame.primaryConcernId
      ? ranked.find((entry) => entry.player.id === thoughtFrame.primaryConcernId)
      : null) ??
    ranked[0] ??
    null;
  const second = focus ? ranked.find((entry) => entry.player.id !== focus.player.id) ?? null : null;
  const agentView = focus && buildAgentView
    ? buildAgentView(state, aiPlayer, { audience: "private", targetId: focus.player.id })
    : null;
  const strategyContext = focus && buildAIStrategyContext
    ? buildAIStrategyContext(state, aiPlayer, {
        audience: "private",
        stage: "private",
        targetId: focus.player.id,
      })
    : null;
  const strategyLine = strategyContext?.evilPlanContextLine && aiPlayer.team === "evil"
    ? strategyContext.evilPlanContextLine
    : "";
  const evidenceContract = focus && buildDialogueEvidenceContract
    ? buildDialogueEvidenceContract(agentView ?? state, aiPlayer, focus.player)
    : null;
  const notes = summarizeShareablePrivateNotes(aiPlayer, 2, { state, audience: human });
  const infoSummary = sharedPrivateInfoSummary(state, aiPlayer, human);
  const repeatInfo = summarizeSharedInfoRepeat
    ? summarizeSharedInfoRepeat(state, aiPlayer, human, infoSummary)
    : null;
  const lines = [];
  const persona = aiPlayer.aiPersona ?? PERSONA_TYPES.STEADY;
  let intent = QUESTION_INTENT.PLAN;
  let claimDisclosureRationale = null;
  let crossDayStance = null;
  let decisionRationale = null;

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
    claimDisclosureRationale = disclosure?.claimDisclosureRationale ?? null;
    const notesText = disclosure?.text || notes.map(humanizeSharedPrivateNote).join("；");
    if (repeatInfo?.line) {
      lines.push(repeatInfo.line);
    } else {
    lines.push(pickCorpusTemplate(
      "private.proactive.noteShare",
      { notesText },
      rng,
      [`我目前能交代的是：${notesText}。`]
    ));
    }
  }

  if (focus) {
    const evidence = collectEvidence(state, aiPlayer, focus.player);
    const reasonText = evidenceReasonText(evidence, "主要来自发言姿态和场上位置");
    const focusName = statementTargetLabel(state, focus.player.id);
    const stanceMemory = rememberDayStance(state, aiPlayer, focus.player.id, focus.score, "proactive-private", {
      reasonSummary: reasonText,
      evidenceCount: evidence.length,
      evidenceSummaries: evidence,
      evidenceAnchors: evidenceContract?.evidenceAnchors ?? [],
      scoreTrailAnchors: evidenceContract?.scoreTrailAnchors ?? [],
      eventAnchors: [
        {
          ...sourceEventAnchor,
          focusId: focus.player.id,
          focusScore: focus.score,
          text: reasonText,
        },
      ],
    });
    crossDayStance = stanceMemory?.crossDayStance ?? null;
    decisionRationale = buildDecisionRationale
      ? buildDecisionRationale(agentView ?? state, aiPlayer, focus, second, {
          publicOnly: false,
          audience: "proactive-private",
          stanceMemory,
        })
      : null;
    const rationaleFragments = selectedPrivateSocialRationaleFragments(decisionRationale, intent);
    const targetSwitchFragments = rationaleFragments.filter(isTargetSwitchPrivateSocialLine);
    const supportingRationaleFragments = rationaleFragments.filter((entry) => !isTargetSwitchPrivateSocialLine(entry));
    lines.push(...targetSwitchFragments);
    lines.push(
      rng() < 0.55
        ? pickPersonaTemplate(persona, "focusPush", { targetName: focusName, reasonText }, rng, [
            `我现在更想推进 ${focusName}。理由是：${reasonText}。`,
          ])
        : pickLayeredSpeech({ layer: "privateSocial", audience: "private", persona, team: aiPlayer.team, act: "focusPush" }, { targetName: focusName, reasonText }, rng, [
            `我现在更想推进 ${focusName}。理由是：${reasonText}。`,
          ])
    );
    lines.push(...supportingRationaleFragments);
    const crossDayLine = crossDayStanceContinuityLine
      ? crossDayStanceContinuityLine(state, aiPlayer, focus.player.id, stanceMemory, {
          targetName: focusName,
          compact: true,
        })
      : "";
    if (crossDayLine) {
      lines.push(crossDayLine);
    } else if (stanceMemory?.turns > 1) {
      lines.push(pickCorpusTemplate(
        "private.proactive.sameStance",
        { stanceLabel: dayStanceLabel(stanceMemory.stance) },
        rng,
        [`这和我今天前面的判断一致，先按“${dayStanceLabel(stanceMemory.stance)}”处理。`]
      ));
    }
    if (strategyLine && rng() < 0.65) {
      lines.push(strategyLine);
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

  const rawResponse = sanitizePrivateDialogueText(joinSpeechFragments(lines), focus ? statementTargetLabel(state, focus.player.id) : "");
  const response = applyHumanSpeechCadence
    ? applyHumanSpeechCadence(state, aiPlayer, rawResponse, rng, {
        audience: "private",
        intent,
        force: true,
        maxSentences: 3,
        maxChars: 170,
      })
    : applySpeechBudget(rawResponse, { audience: "private", maxSentences: 3, maxChars: 170 });
  return {
    response,
    focusId: focus?.player?.id ?? null,
    focusScore: focus?.score ?? null,
    intent,
    thoughtFrame,
    strategyContext,
    evidenceContract,
    decisionRationale: attachDecisionRationaleSpokenLine
      ? attachDecisionRationaleSpokenLine(decisionRationale, response)
      : decisionRationale,
    claimDisclosureRationale: attachClaimDisclosureRationaleSpokenLine
      ? attachClaimDisclosureRationaleSpokenLine(claimDisclosureRationale, response)
      : claimDisclosureRationale,
    crossDayStance,
    sourceEventAnchor,
    infoSummary,
    repeatedInfo: !!repeatInfo?.repeated,
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
  const sourceEventAnchor = privateDialogueEventAnchor(state, {
    mode: "ai-private",
    source: "ai_to_ai_private_whisper",
    audience: "private",
    speakerId: speaker?.id ?? "",
    targetId: target?.id ?? "",
    visibility: "hidden",
  });
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
      sourceEventAnchor,
    };
  }

  const ranked = rankTargets(speaker, state, 3).filter((entry) => entry.player.id !== target.id);
  const focus = ranked[0] ?? null;
  const runnerUp = focus ? ranked.find((entry) => entry.player.id !== focus.player.id) ?? null : null;
  const strategyContext = focus && buildAIStrategyContext
    ? buildAIStrategyContext(state, speaker, {
        audience: "private",
        stage: "private",
        targetId: focus.player.id,
      })
    : null;
  const strategyLine = strategyContext?.evilPlanContextLine && speaker.team === "evil"
    ? strategyContext.evilPlanContextLine
    : "";
  const notes = summarizeShareablePrivateNotes(speaker, 2, { state, audience: target });
  const lines = [];
  const persona = speaker.aiPersona ?? PERSONA_TYPES.STEADY;
  let intent = QUESTION_INTENT.PLAN;
  let crossDayStance = null;
  let decisionRationale = null;

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
    const evidenceContract = buildDialogueEvidenceContract
      ? buildDialogueEvidenceContract(state, speaker, focus.player)
      : null;
    const evidence = evidenceContract?.summaries ?? collectEvidence(state, speaker, focus.player);
    const reasonText = evidenceReasonText(evidence, "主要是发言姿态和场上位置还不顺");
    const focusName = statementTargetLabel(state, focus.player.id);
    const stanceMemory = rememberDayStance(state, speaker, focus.player.id, focus.score, "ai-private", {
      reasonSummary: reasonText,
      evidenceCount: evidence.length,
      evidenceSummaries: evidence,
      evidenceAnchors: evidenceContract?.evidenceAnchors ?? [],
      scoreTrailAnchors: evidenceContract?.scoreTrailAnchors ?? [],
      eventAnchors: [
        {
          ...sourceEventAnchor,
          focusId: focus.player.id,
          focusScore: focus.score,
          text: reasonText,
        },
      ],
    });
    crossDayStance = stanceMemory?.crossDayStance ?? null;
    decisionRationale = buildDecisionRationale
      ? buildDecisionRationale(state, speaker, focus, runnerUp, {
          publicOnly: false,
          audience: "private",
          stanceMemory,
        })
      : null;
    const rationaleFragments = selectedPrivateSocialRationaleFragments(decisionRationale, intent);
    const targetSwitchFragments = rationaleFragments.filter(isTargetSwitchPrivateSocialLine);
    const supportingRationaleFragments = rationaleFragments.filter((entry) => !isTargetSwitchPrivateSocialLine(entry));
    lines.push(...targetSwitchFragments);
    lines.push(
      rng() < 0.55
        ? pickPersonaTemplate(persona, "focusPush", { targetName: focusName, reasonText }, rng, [
            `我更想盯 ${focusName}。理由是：${reasonText}。`,
          ])
        : pickLayeredSpeech({ layer: "privateSocial", audience: "private", persona, team: speaker.team, act: "focusPush" }, { targetName: focusName, reasonText }, rng, [
            `我更想盯 ${focusName}。理由是：${reasonText}。`,
          ])
    );
    lines.push(...supportingRationaleFragments);
    const crossDayLine = crossDayStanceContinuityLine
      ? crossDayStanceContinuityLine(state, speaker, focus.player.id, stanceMemory, {
          targetName: focusName,
          compact: true,
        })
      : "";
    if (crossDayLine) {
      lines.push(crossDayLine);
    } else if (stanceMemory?.turns > 1) {
      lines.push(pickCorpusTemplate(
        "private.proactive.sameStance",
        { stanceLabel: dayStanceLabel(stanceMemory.stance) },
        rng,
        [`我今天对 ta 的口径还是“${dayStanceLabel(stanceMemory.stance)}”，先不乱跳线。`]
      ));
    }
    if (strategyLine && rng() < 0.65) {
      lines.push(strategyLine);
    }
  } else {
    lines.push(pickLayeredSpeech({ layer: "privateSocial", audience: "private", persona, team: speaker.team, act: "noFocus" }, {}, rng, [
      "如果今天没有新信息，至少要逼一个明确口径，不要直接空过。",
    ]));
  }

  const rawResponse = sanitizePrivateDialogueText(joinSpeechFragments(lines), focus ? statementTargetLabel(state, focus.player.id) : "");
  return {
    response: applyHumanSpeechCadence
      ? applyHumanSpeechCadence(state, speaker, rawResponse, rng, {
          audience: "private",
          intent,
          force: true,
          maxSentences: 3,
          maxChars: 170,
        })
      : applySpeechBudget(rawResponse, { audience: "private", maxSentences: 3, maxChars: 170 }),
    focusId: focus?.player?.id ?? null,
    focusScore: focus?.score ?? null,
    intent,
    strategyContext,
    decisionRationale,
    crossDayStance,
    sourceEventAnchor,
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
    if (areKnownAllies(state, speaker, target)) {
      composed = {
        ...composed,
        response: cleanHiddenEvilCoordinationText(composed.response),
      };
    }
    if (composed.decisionRationale) {
      composed = {
        ...composed,
        decisionRationale: attachDecisionRationaleSpokenLine
          ? attachDecisionRationaleSpokenLine(composed.decisionRationale, composed.response)
          : composed.decisionRationale,
      };
    }
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
      decisionRationale: composed.decisionRationale ?? null,
      crossDayStance: composed.crossDayStance ?? null,
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
        decisionRationale: composed.decisionRationale ?? null,
        crossDayStance: composed.crossDayStance ?? null,
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
      decisionRationale: composed.decisionRationale ?? null,
      crossDayStance: composed.crossDayStance ?? null,
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
  const offer = dialogue.pendingProactiveWhispers[index];
  const slot = typeof consumePrivateChat === "function" ? consumePrivateChat(state, offer.playerId) : { ok: true };
  if (!slot.ok) {
    return { ok: false, reason: slot.reason };
  }
  dialogue.pendingProactiveWhispers.splice(index, 1);
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
