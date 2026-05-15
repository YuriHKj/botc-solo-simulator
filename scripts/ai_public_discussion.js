export function createAIPublicDiscussion(deps) {
  const {
    QUESTION_INTENT,
    PERSONA_TYPES,
    DEBATE_BEATS,
    ensureDialogueState,
    refreshAIBeliefs,
    buildAgentView,
    buildAIThoughtFrame,
    rankTargets,
    resolveStableFocus,
    rememberDayStance,
    personaThresholdShift,
    buildDialogueEvidenceContract,
    publicClaimDisclosureLine,
    thoughtFrameDisclosureLine,
    maybePublicDisclosureLine,
    shortReasonText,
    renderDialogueActs,
    corpusTemplateEntry,
    personaCorpusKey,
    pickCorpusTemplate,
    pickPersonaTemplate,
    pickLayeredSpeech,
    sample,
    dayStanceLabel,
    roleNameById,
    summarizeShareablePrivateNotes,
    joinSpeechFragments,
    renderPublicSurfaceActReadable,
    buildPublicSurfaceAct,
    ensureEvidenceContractInText,
    applyInGamePragmatics,
    applyHumanSpeechCadence,
    appendPublicThoughtQuestion,
    shouldDeadPublicClaim,
    pickClaimRole,
    choosePublicClaimRole,
    claimRoleForContext,
    applyPublicStatementContinuityFromMemory,
    rememberStatementMemory,
    recordPublicSpeechForAgents,
    addLog,
    pushTimeline,
    predictDialogueSignals,
    recordUtteranceMVP,
    inferPublicSpeechActs,
    voteStanceFromText,
    clamp,
  } = deps;
function nextPublicRound(state) {
  const dialogue = ensureDialogueState(state);
  const dayKey = `${state.day}`;
  dialogue.publicRoundByDay[dayKey] = (dialogue.publicRoundByDay[dayKey] ?? 0) + 1;
  return dialogue.publicRoundByDay[dayKey];
}

function debateBeatForOrder(orderIndex, totalSpeakers, roundInDay) {
  if (roundInDay >= 2) {
    return orderIndex % 2 === 0 ? "challenge" : "vote-intent";
  }
  const bucket = Math.floor((orderIndex / Math.max(1, totalSpeakers)) * DEBATE_BEATS.length);
  return DEBATE_BEATS[Math.max(0, Math.min(DEBATE_BEATS.length - 1, bucket))] ?? "opening";
}

function publicDialogueActForContext(debateBeat, score, hardPressThreshold) {
  if (debateBeat === "defense") {
    return "challengeResponse";
  }
  if (debateBeat === "nomination-pressure") {
    return "nominationPressure";
  }
  if (debateBeat === "vote-intent") {
    return "voteIntent";
  }
  return score >= hardPressThreshold ? "pressure" : "probe";
}

function debateBeatLabel(beat) {
  return {
    opening: "开场发言",
    challenge: "质询",
    defense: "回应/辩护",
    "nomination-pressure": "提名压力",
    "vote-intent": "投票意向",
  }[beat] ?? "公聊";
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

function applyDebateBeatTone(line, beat, focusName, rng = Math.random) {
  const safeFocus = focusName || "这个位置";
  const prefix = pickCorpusTemplate(
    `public.debateBeat.${beat}`,
    { focusName: safeFocus },
    rng,
    [""]
  );
  return prefix ? `${prefix}${line}` : line;
}

function composePublicLine(state, aiPlayer, roundInDay, rng = Math.random, options = {}) {
  const agentView =
    options.agentView ?? buildAgentView(state, aiPlayer, { audience: "public" });
  const thoughtFrame =
    options.thoughtFrame ?? buildAIThoughtFrame(state, aiPlayer, {
      agentView,
      audience: "public",
      roundInDay,
      rng,
    });
  const ranked = rankTargets(aiPlayer, state, 3);
  const topCandidate =
    (thoughtFrame?.primaryConcernId
      ? ranked.find((entry) => entry.player.id === thoughtFrame.primaryConcernId)
      : null) ??
    ranked[0] ??
    null;
  if (!topCandidate) {
    if (!aiPlayer.alive && aiPlayer.publicClaimRoleId) {
      const notes = summarizeShareablePrivateNotes(aiPlayer, 2, { state });
      const infoText = notes.length > 0 ? `信息是：${notes.join("；")}。` : "可验证信息不多，但身份链先给出来。";
      return {
        templateId: "dead-claim-no-target",
        line: pickCorpusTemplate(
          "public.deadClaim",
          { roleName: roleNameById(state, aiPlayer.publicClaimRoleId), infoText },
          rng,
          [pickLayeredSpeech(
            {
              layer: "publicDiscussion",
              audience: "public",
              persona: aiPlayer.aiPersona,
              team: aiPlayer.team,
              act: "deadClaimNoTarget",
            },
            { roleName: roleNameById(state, aiPlayer.publicClaimRoleId), infoText },
            rng,
            [`我已经死了，先报身份：我是 ${roleNameById(state, aiPlayer.publicClaimRoleId)}。${infoText}`]
          )]
        ),
        focusId: null,
        score: 0.5,
      };
    }
    return {
      templateId: "no-target",
      line: pickLayeredSpeech(
        {
          layer: "publicDiscussion",
          audience: "public",
          persona: aiPlayer.aiPersona,
          team: aiPlayer.team,
          act: "noTarget",
        },
        {},
        rng,
        ["这一轮我信息不足，先听其他人发言。"]
      ),
      focusId: null,
      score: 0.5,
    };
  }

  const stabilized = resolveStableFocus(state, aiPlayer, topCandidate, ranked, { explicitMention: false });
  const top = stabilized.focus;
  const second = ranked.find((entry) => entry.player.id !== top.player.id) ?? null;
  const stanceMemory = rememberDayStance(state, aiPlayer, top.player.id, top.score, "public");

  const persona = aiPlayer.aiPersona ?? PERSONA_TYPES.STEADY;
  const hardPressThreshold = 0.58 + personaThresholdShift(persona);
  const evidenceContract = buildDialogueEvidenceContract(agentView ?? state, aiPlayer, top.player, {
    publicOnly: true,
  });
  const evidence = evidenceContract.summaries;
  const reasonText = evidenceContract.spokenText || evidenceContract.text;
  const scoreMood = top.score >= 0.68 ? "压力很高" : top.score >= hardPressThreshold ? "有明显压力" : top.score >= 0.42 ? "需要解释" : "先观察";
  const claimDisclosureLine = publicClaimDisclosureLine(state, aiPlayer, options.publicClaimRoleId, rng);
  const frameDisclosureLine = thoughtFrameDisclosureLine(state, aiPlayer, thoughtFrame, rng);
  const disclosureLine = claimDisclosureLine || frameDisclosureLine || maybePublicDisclosureLine(state, aiPlayer, roundInDay, rng);
  const values = {
    targetName: top.player.name,
    reasonText,
    shortReason: shortReasonText(reasonText),
    scoreMood,
  };
  const publicAct = publicDialogueActForContext(options.debateBeat, top.score, hardPressThreshold);
  const layeredPublicActText = pickLayeredSpeech(
    {
      layer: "publicDiscussion",
      audience: "public",
      persona,
      team: aiPlayer.team,
      act: publicAct,
    },
    values,
    rng,
    []
  );
  const publicActText = layeredPublicActText || renderDialogueActs(
    state,
    aiPlayer,
    publicAct,
    values,
    rng,
    publicAct === "challengeResponse"
      ? [`我回应一下，{targetName} 这条先看 {shortReason}。`]
      : publicAct === "nominationPressure"
      ? [`提名前我先把话说清：${top.player.name} 这条是 ${shortReasonText(reasonText)}。`]
      : publicAct === "voteIntent"
      ? [`如果提 ${top.player.name}，我会看票型和回应。`]
      : top.score >= hardPressThreshold
      ? [`${top.player.name} 这里我放不太下，主要卡在：${reasonText}。先听回答。`]
      : [`${top.player.name} 我先记一笔，还没到硬推，但需要解释。`],
    { audience: "public" }
  );

  const templates = top.score >= hardPressThreshold
    ? [
        corpusTemplateEntry("", "public-act", {}, rng, [publicActText]),
        corpusTemplateEntry("public.pressure", "press", values, rng, [
          `${top.player.name} 这里我放不太下，主要卡在：${reasonText}。先听回答。`,
        ]),
        corpusTemplateEntry("public.pressure", "risk", values, rng, [
          `我现在最放不下 ${top.player.name}。理由是：${reasonText}。`,
        ]),
        corpusTemplateEntry("public.pressure", "nominate-ready", values, rng, [
          `如果今天要动手，我会先考虑提 ${top.player.name}。但先让 ta 把身份和信息讲完整。`,
        ]),
        corpusTemplateEntry(`persona.${personaCorpusKey(persona)}.focusPush`, "persona-focus", values, rng, [
          `我会先围绕 ${top.player.name} 追问，不急着马上定票。`,
        ]),
      ]
    : [
        corpusTemplateEntry("", "public-act", {}, rng, [publicActText]),
        corpusTemplateEntry("public.probe", "probe", values, rng, [
          `${top.player.name} 我先记一笔，还没到硬推，但需要解释。`,
        ]),
        corpusTemplateEntry("public.probe", "soft", values, rng, [
          `我对 ${top.player.name} 有点不舒服。先不砍，先问清楚。`,
        ]),
        corpusTemplateEntry("public.probe", "watch", values, rng, [
          `${top.player.name} 的回答我会重点听；如果继续绕，下一轮再加压。`,
        ]),
        corpusTemplateEntry(`persona.${personaCorpusKey(persona)}.focusPush`, "persona-focus", values, rng, [
          `我当前更关注 ${top.player.name}，但还没到铁推。`,
        ]),
      ];

  const personaTailPath =
    persona === PERSONA_TYPES.PRESSURE
      ? "public.tails.personaPressure"
      : persona === PERSONA_TYPES.SHADOW
      ? "public.tails.personaShadow"
      : "public.tails.personaSteady";
  const stanceTail =
    stanceMemory?.turns > 1
      ? pickCorpusTemplate(
          "public.tails.stanceRetained",
          { targetName: top.player.name, stanceLabel: dayStanceLabel(stanceMemory.stance) },
          rng,
          [`我今天对 ${top.player.name} 的口径还是“${dayStanceLabel(stanceMemory.stance)}”，暂时不换主线。`]
        )
      : "";

  const tails = [
    second
      ? pickCorpusTemplate(
          "public.tails.secondFocus",
          { targetName: top.player.name, secondName: second.player.name },
          rng,
          [`次级关注是 ${second.player.name}。`]
        )
      : "次级关注位暂不明确。",
    roundInDay > 1
      ? pickCorpusTemplate(
          "public.tails.laterRound",
          { roundInDay },
          rng,
          [`这是今天第 ${roundInDay} 轮公聊，我想看 ta 有没有改口。`]
        )
      : "",
    top.score >= 0.68
      ? pickCorpusTemplate("public.tails.nominationReady", {}, rng, ["这个位置今天已经可以进提名池。"])
      : pickCorpusTemplate("public.tails.hold", {}, rng, ["我还没说必出，但不能让 ta 舒服过白天。"]),
    pickPersonaTemplate(persona, "publicTails", {}, rng, ["先用信息和票型压人，别只凭一句感觉出人。"]),
    pickCorpusTemplate(personaTailPath, {}, rng, ["我先听回应，不急着把票打死。"]),
    stanceTail,
  ].filter(Boolean);

  const chosen = { id: `public-act-${publicAct}`, text: publicActText };
  const tail = sample(tails, 1, rng)[0];
  let prefix = disclosureLine ? `${disclosureLine} ` : "";
  if (!aiPlayer.alive && aiPlayer.publicClaimRoleId) {
    const notes = summarizeShareablePrivateNotes(aiPlayer, 2, { state });
    const infoText = notes.length > 0 ? `信息是：${notes.join("；")}。` : "可验证信息不多，但身份链先给出来。";
    prefix = `${pickCorpusTemplate(
      "public.deadClaim",
      { roleName: roleNameById(state, aiPlayer.publicClaimRoleId), infoText },
      rng,
      [pickLayeredSpeech(
        {
          layer: "publicDiscussion",
          audience: "public",
          persona,
          team: aiPlayer.team,
          act: "deadClaimNoTarget",
        },
        { roleName: roleNameById(state, aiPlayer.publicClaimRoleId), infoText },
        rng,
        [`我已经死了，先报身份：我是 ${roleNameById(state, aiPlayer.publicClaimRoleId)}。${infoText}`]
      )]
    )} ${prefix}`;
  }

  const rawLine = applyDebateBeatTone(
    joinSpeechFragments([prefix, chosen.text, tail]),
    options.debateBeat,
    top.player.name,
    rng
  );
  const publicSurfaceLine = renderPublicSurfaceActReadable(
    buildPublicSurfaceAct(state, aiPlayer, {
      focus: top,
      second,
      evidenceContract,
      reasonText,
      debateBeat: options.debateBeat ?? "opening",
      hardPress: top.score >= hardPressThreshold,
      disclosureLine,
      deadClaimLine: !aiPlayer.alive && aiPlayer.publicClaimRoleId ? prefix.trim() : "",
      thoughtFrame,
    })
  );
  const selectedRawLine = publicSurfaceLine || rawLine;
  let evidenceLine = ensureEvidenceContractInText(
    applyInGamePragmatics(state, aiPlayer, selectedRawLine, {
      audience: "public",
      intent: top.score >= hardPressThreshold ? QUESTION_INTENT.SUSPECT : QUESTION_INTENT.GENERIC,
      focusId: top.player.id,
      focusScore: top.score,
      lowEvidence: evidenceContract.lowEvidence && !claimDisclosureLine,
    }),
    evidenceContract,
    { label: evidenceContract.lowEvidence ? "证据还薄" : "卡点是" }
  );
  const contractSpoken = `${evidenceContract.spokenText ?? ""}`;
  if (contractSpoken && !evidenceLine.replaceAll("…", "...").includes(contractSpoken.replaceAll("…", "..."))) {
    const firstSentence = `${selectedRawLine}`.match(/[^。！？；]+[。！？；]?/u)?.[0]?.trim() || selectedRawLine;
    evidenceLine = joinSpeechFragments([
      firstSentence,
      `${evidenceContract.lowEvidence ? "证据还薄" : "卡点是"}：${contractSpoken}。`,
    ]);
  }
  const renderedPublicLine = applyHumanSpeechCadence(state, aiPlayer, evidenceLine, rng, {
    audience: "public",
    intent: top.score >= hardPressThreshold ? QUESTION_INTENT.SUSPECT : QUESTION_INTENT.GENERIC,
    focusId: top.player.id,
    focusScore: top.score,
    roundInDay,
    maxSentences: aiPlayer.alive ? 2 : 3,
    maxChars: aiPlayer.alive
      ? (options.debateBeat === "defense" ? 145 : 135)
      : 190,
  });
  const normalizedRendered = renderedPublicLine.replaceAll("…", "...");
  const normalizedContract = `${contractSpoken ?? ""}`.replaceAll("…", "...");
  const finalPublicLine =
    normalizedContract && !normalizedRendered.includes(normalizedContract)
      ? joinSpeechFragments([
          renderedPublicLine.match(/[^。！？；]+[。！？；]?/u)?.[0]?.trim() || renderedPublicLine,
          `${evidenceContract.lowEvidence ? "证据还薄" : "卡点是"}：${contractSpoken}。`,
        ])
      : renderedPublicLine;
  const contextSafeLine = ensureDebateBeatContextCue(
    appendPublicThoughtQuestion(finalPublicLine, thoughtFrame, aiPlayer.alive ? 190 : 210),
    options.debateBeat ?? "opening",
    top.player.name,
    aiPlayer.alive ? 190 : 210
  );
  return {
    templateId: chosen.id,
    line: contextSafeLine,
    focusId: top.player.id,
    score: top.score,
    debateBeat: options.debateBeat ?? "opening",
    evidenceContract,
    thoughtFrame,
  };
}

function ensureDebateBeatContextCue(line, debateBeat, targetName, maxChars = 190) {
  const value = `${line ?? ""}`.trim();
  if (!value) {
    return value;
  }
  let prefix = "";
  if (debateBeat === "nomination-pressure" && !/(提名|上台|流程压力|正式压力|提名前)/u.test(value)) {
    prefix = `提名前先看 ${targetName}：`;
  } else if (debateBeat === "vote-intent" && !/(投票|票型|如果提|跟票|反票)/u.test(value)) {
    prefix = `投票态度先说清：`;
  }
  if (!prefix) {
    return value;
  }
  const joined = joinSpeechFragments([prefix, value]);
  if (joined.length <= maxChars) {
    return joined;
  }
  const room = Math.max(0, maxChars - prefix.length - 1);
  return `${prefix}${value.slice(0, room).replace(/[，。！？；、\s]+$/u, "").trim()}`;
}
function rotateBy(arr, shift) {
  if (arr.length === 0) {
    return [];
  }
  const n = shift % arr.length;
  return [...arr.slice(n), ...arr.slice(0, n)];
}

function publicClaimCountForDay(state) {
  return (state.events?.claims ?? []).filter((claim) => !claim.private && claim.day === state.day).length;
}

function shouldForceOpeningPublicClaim(state, aiPlayer, roundInDay, orderIndex, thoughtFrame) {
  if (!state || !aiPlayer || aiPlayer.publicClaimRoleId || aiPlayer.alive === false) {
    return false;
  }
  if (roundInDay !== 1 || Math.max(1, Number(state.day) || 1) !== 1) {
    return false;
  }
  if (publicClaimCountForDay(state) > 0) {
    return false;
  }
  if (thoughtFrame?.selfDisclosureNeed === "hard_claim") {
    return true;
  }
  return thoughtFrame?.selfDisclosureNeed === "range" && orderIndex <= 2;
}

function publishPublicSpeech(state, aiPlayer, { roundInDay = 1, orderIndex = 0, debateBeat = "opening", rng = Math.random, source = "ai_public_discussion" } = {}) {
  const dialogue = ensureDialogueState(state);
  const agentView = buildAgentView(state, aiPlayer, { audience: "public" });
  const thoughtFrame = buildAIThoughtFrame(state, aiPlayer, {
    agentView,
    audience: "public",
    roundInDay,
    clock: state.dayStageMeta?.publicConversation?.clock ?? debateBeat,
    rng,
  });
  const forceOpeningClaim = shouldForceOpeningPublicClaim(state, aiPlayer, roundInDay, orderIndex, thoughtFrame);
  const claimRoleId = thoughtFrame.selfDisclosureNeed === "hard_claim" && thoughtFrame.suggestedClaimRoleId
    ? thoughtFrame.suggestedClaimRoleId
    : forceOpeningClaim
    ? pickClaimRole(state, aiPlayer, rng, { force: true })
    : shouldDeadPublicClaim(state, aiPlayer, roundInDay, rng)
    ? pickClaimRole(state, aiPlayer, rng, { force: true })
    : choosePublicClaimRole(state, aiPlayer, roundInDay, rng);
  if (claimRoleId) {
    claimRoleForContext(state, aiPlayer, null, rng, { force: true, private: false, roleId: claimRoleId });
  }

  let composed = composePublicLine(state, aiPlayer, roundInDay, rng, {
    debateBeat,
    agentView,
    publicClaimRoleId: claimRoleId,
    thoughtFrame,
  });
  composed = applyPublicStatementContinuityFromMemory(state, aiPlayer, composed, roundInDay, {
    appendPublicThoughtQuestion,
  });

  dialogue.lastPublicFocusBySpeaker[aiPlayer.id] = composed.focusId ?? null;
  dialogue.lastPublicTemplateBySpeaker[aiPlayer.id] = composed.templateId;

  aiPlayer.speechHistory.push({ day: state.day, line: composed.line, focusId: composed.focusId });
  const speechEvent = {
    day: state.day,
    playerId: aiPlayer.id,
    line: composed.line,
    focusId: composed.focusId,
    private: false,
    debateBeat,
    evidenceContract: composed.evidenceContract ?? null,
  };
  state.events.speeches.push(speechEvent);
  rememberStatementMemory(
    state,
    aiPlayer,
    "public",
    null,
    {
      ...composed,
      response: composed.line,
      focusScore: composed.score,
      intent: composed.score >= 0.62 ? QUESTION_INTENT.SUSPECT : QUESTION_INTENT.GENERIC,
    },
    {
      source,
      intent: composed.score >= 0.62 ? QUESTION_INTENT.SUSPECT : QUESTION_INTENT.GENERIC,
      roundInDay,
    }
  );
  recordPublicSpeechForAgents(state, {
    speakerId: aiPlayer.id,
    text: composed.line,
    focusId: composed.focusId,
    roundInDay,
    orderIndex,
    debateBeat,
    polarity: composed.score >= 0.62 ? "accuse" : "neutral",
  });

  addLog(state, "speech", `${aiPlayer.name}：${composed.line}`, {
    playerId: aiPlayer.id,
    focusId: composed.focusId,
    score: composed.score,
    roundInDay,
    orderIndex,
    private: false,
    debateBeat,
  });

  pushTimeline(state, {
    mode: "public",
    roundInDay,
    orderIndex,
    speakerId: aiPlayer.id,
    targetId: composed.focusId,
    text: composed.line,
    debateBeat,
    debateBeatLabel: debateBeatLabel(debateBeat),
  });
  const publicSignals = predictDialogueSignals(composed.line);

  recordUtteranceMVP(state, {
    speakerId: aiPlayer.id,
    audience: "public",
    text: composed.line,
    speechActs: inferPublicSpeechActs(composed),
    targets: composed.focusId ? [composed.focusId] : [],
    intent: composed.score >= 0.62 ? "suspect" : "plan",
    voteStance: voteStanceFromText(composed.line),
    evidenceSource: "social_read",
    epistemicStrength: composed.score >= 0.74 ? 3 : composed.score >= 0.58 ? 2 : 1,
    nominationRelated: /提名|nominate/i.test(composed.line),
    metadata: {
      source,
      roundInDay,
      orderIndex,
      debateBeat,
      debateBeatLabel: debateBeatLabel(debateBeat),
      templateId: composed.templateId ?? "",
      focusScore: composed.score ?? null,
      mlVoteLabel: publicSignals.voteLabel ?? "undecided",
      mlVoteConfidence: publicSignals.voteConfidence ?? 0,
      mlSpeechActs: publicSignals.speechActs ?? [],
      mlTokenHits: publicSignals.tokenHits ?? 0,
      publicClaimRoleId: claimRoleId ?? "",
      thoughtFrame: {
        intendedAct: thoughtFrame.intendedAct,
        primaryConcernId: thoughtFrame.primaryConcernId,
        selfDisclosureNeed: thoughtFrame.selfDisclosureNeed,
        nominationReadiness: thoughtFrame.nominationReadiness,
      },
    },
  });

  return {
    ...composed,
    speechEvent,
    speakerId: aiPlayer.id,
    speakerName: aiPlayer.name,
    debateBeat,
    debateBeatLabel: debateBeatLabel(debateBeat),
    thoughtFrame,
    roundInDay,
    orderIndex,
  };
}

function ensurePublicConversationClock(state) {
  state.dayStageMeta = state.dayStageMeta ?? {};
  const existing = state.dayStageMeta.publicConversation ?? {};
  const clock = {
    step: Number(existing.step ?? 0) || 0,
    clock: existing.clock ?? "opening",
    pressure: Number(existing.pressure ?? 0) || 0,
    activeSpeakerId: existing.activeSpeakerId ?? null,
    focusId: existing.focusId ?? null,
    canContinue: existing.canContinue ?? true,
    suggestedActions: Array.isArray(existing.suggestedActions) ? existing.suggestedActions : ["continue-public"],
    lastUpdatedDay: state.day ?? 0,
  };
  state.dayStageMeta.publicConversation = clock;
  return clock;
}

function tablePressure(state) {
  let pressure = 0;
  state.players
    .filter((player) => !player.isHuman)
    .forEach((aiPlayer) => {
      const top = rankTargets(aiPlayer, state, 1)[0];
      if (top?.score) {
        pressure = Math.max(pressure, top.score);
      }
    });
  return clamp(pressure, 0, 1);
}

function conversationClockForStep(step, pressure) {
  if (pressure >= 0.66 && step >= 2) return "nomination-ready";
  if (step <= 0) return "opening";
  if (step === 1) return "response";
  if (step <= 3) return "crossfire";
  return "cooldown";
}

function debateBeatForConversationClock(clock) {
  return {
    opening: "opening",
    response: "defense",
    crossfire: "challenge",
    "nomination-ready": "nomination-pressure",
    cooldown: "vote-intent",
  }[clock] ?? "opening";
}

function suggestedActionsForConversation(clock, step) {
  if (clock === "nomination-ready") {
    return ["open-nomination-window", "ask-followup", "continue-public"];
  }
  if (clock === "cooldown") {
    return ["open-nomination-window", "pass-to-nomination", "ask-followup"];
  }
  if (step <= 1) {
    return ["continue-public", "ask-followup"];
  }
  return ["continue-public", "open-nomination-window", "ask-followup"];
}

function speakerForConversationStep(state, clock, step, speakers) {
  if (clock === "response") {
    const lastFocused = [...(state.events?.speeches ?? [])]
      .reverse()
      .find((entry) => !entry.private && entry.focusId)?.focusId;
    const focusedSpeaker = speakers.find((entry) => entry.id === lastFocused);
    if (focusedSpeaker) {
      return focusedSpeaker;
    }
  }
  return speakers[step % Math.max(1, speakers.length)] ?? null;
}

function runAIConversationStep(state, rng = Math.random) {
  if (state.phase !== "day" || state.dayStage !== "public" || state.gameOver) {
    return { ok: false, reason: "当前不在公聊阶段。" };
  }

  refreshAIBeliefs(state);
  const conversation = ensurePublicConversationClock(state);
  const speakers = state.players
    .filter((entry) => !entry.isHuman)
    .sort((a, b) => a.seatIndex - b.seatIndex);
  if (speakers.length === 0) {
    return { ok: false, reason: "没有可发言的 AI。" };
  }
  const step = conversation.step ?? 0;
  const pressure = tablePressure(state);
  const clock = conversationClockForStep(step, pressure);
  const debateBeat = debateBeatForConversationClock(clock);
  const speaker = speakerForConversationStep(state, clock, step, speakers);
  if (!speaker) {
    return { ok: false, reason: "没有可发言的 AI。" };
  }
  const composed = publishPublicSpeech(state, speaker, {
    roundInDay: step + 1,
    orderIndex: step,
    debateBeat,
    rng,
    source: "ai_public_conversation_step",
  });
  conversation.step = step + 1;
  conversation.clock = conversationClockForStep(conversation.step, Math.max(pressure, composed.score ?? 0));
  conversation.pressure = Math.max(pressure, composed.score ?? 0);
  conversation.activeSpeakerId = speaker.id;
  conversation.focusId = composed.focusId ?? null;
  conversation.canContinue = conversation.clock !== "cooldown" || conversation.step < 6;
  conversation.suggestedActions = suggestedActionsForConversation(conversation.clock, conversation.step);
  conversation.lastUpdatedDay = state.day ?? 0;
  state.dayStageMeta.publicRounds = Math.max(state.dayStageMeta.publicRounds ?? 0, conversation.step);
  addLog(state, "conversation-clock", `公聊推进：${conversationClockLabel(conversation.clock)}。`, {
    clock: conversation.clock,
    step: conversation.step,
    speakerId: speaker.id,
    focusId: composed.focusId,
  });
  return {
    ok: true,
    message: `${speaker.name} 发言：${conversationClockLabel(conversation.clock)}`,
    publicConversation: { ...conversation },
    line: composed.line,
    speakerId: speaker.id,
    focusId: composed.focusId,
    debateBeat,
  };
}

function runAIDiscussion(state, rng = Math.random) {
  if (state.phase !== "day" || state.gameOver) {
    return;
  }

  refreshAIBeliefs(state);
  const dialogue = ensureDialogueState(state);
  const roundInDay = nextPublicRound(state);

  const speakingAIs = state.players
    .filter((entry) => !entry.isHuman)
    .sort((a, b) => a.seatIndex - b.seatIndex);
  const speakers = rotateBy(speakingAIs, Math.max(0, roundInDay - 1));

  speakers.forEach((aiPlayer, orderIndex) => {
    const debateBeat = debateBeatForOrder(orderIndex, speakers.length, roundInDay);
    publishPublicSpeech(state, aiPlayer, {
      roundInDay,
      orderIndex,
      debateBeat,
      rng,
      source: "ai_public_discussion",
    });
  });
}


  return {
    runAIConversationStep,
    runAIDiscussion,
  };
}
