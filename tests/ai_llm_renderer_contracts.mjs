import assert from "node:assert/strict";

import {
  buildLLMRendererPrompt,
  renderSpeechWithLocalLLM,
  resolveLLMRendererConfig,
  scoreTextSimilarity,
  validateLLMRenderedSpeech,
} from "../scripts/ai_llm_renderer.js";

const basePayload = {
  speakerName: "9号",
  targetName: "7号",
  audience: "public",
  intent: "pressure_question",
  persona: "steady",
  candidateText: "7号可以进提名池，但我先听身份和昨晚信息，再决定。",
  evidence: ["7号公开身份和昨晚信息没对上"],
  requiredTerms: ["7号"],
  forbiddenTerms: ["PRIVATE_SECRET_MARKER", "洗衣妇真实身份"],
  maxChars: 120,
};

function withEnv(overrides, callback) {
  const previous = {};
  for (const key of Object.keys(overrides)) {
    previous[key] = Object.prototype.hasOwnProperty.call(process.env, key) ? process.env[key] : undefined;
    const value = overrides[key];
    if (value === null || value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  try {
    return callback();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

function testRendererDefaultsToOllamaWhenOnlyEnabled() {
  withEnv(
    {
      BOTC_LLM_RENDERER: "1",
      BOTC_LLM_PROVIDER: null,
      BOTC_LLM_ENDPOINT: null,
      BOTC_LLM_OLLAMA_MODEL: null,
      BOTC_LLM_MOCK: null,
    },
    () => {
      const config = resolveLLMRendererConfig({});
      assert.equal(config.enabled, true);
      assert.equal(config.provider, "ollama");
      assert.match(config.endpoint, /11434\/api\/generate/);
      assert.equal(config.model, "qwen2.5:3b");
    }
  );
}

function testRendererPrefersOpenAICompatibleEndpoint() {
  withEnv(
    {
      BOTC_LLM_RENDERER: "1",
      BOTC_LLM_PROVIDER: null,
      BOTC_LLM_ENDPOINT: "http://127.0.0.1:18080/v1/chat/completions",
      BOTC_LLM_OLLAMA_MODEL: null,
      BOTC_LLM_MOCK: null,
    },
    () => {
      const config = resolveLLMRendererConfig({});
      assert.equal(config.provider, "openai-compatible");
      assert.equal(config.endpoint, "http://127.0.0.1:18080/v1/chat/completions");
    }
  );
}

function testPromptOnlyContainsSafePayload() {
  const { system, user, payload } = buildLLMRendererPrompt(basePayload);
  assert.match(system, /不做规则判断/);
  assert.match(system, /不要照抄/);
  assert.match(system, /requiredTerms/);
  assert.match(user, /render_botc_player_line_v2/);
  assert.equal(payload.targetName, "7号");
  assert.ok(payload.forbiddenTerms.includes("口径"), "system jargon should be forbidden by default");
  assert.ok(payload.forbiddenTerms.includes("复核"), "stock review words should be forbidden by default");
  assert.ok(payload.forbiddenTerms.includes("那件事"), "vague references should be forbidden by default");
  const userPayload = JSON.parse(user);
  assert.ok(
    userPayload.styleGuide.some((rule) => rule.includes("deterministic draft") || rule.includes("换一种句式")),
    "prompt should tell small local models not to copy the deterministic draft"
  );
  assert.equal(userPayload.roughDraft, undefined, "prompt should not expose a copy-friendly roughDraft field");
}

function testPrivateHumanRecipientIsNotPressureTarget() {
  const privatePayload = {
    ...basePayload,
    targetName: "你",
    audience: "private",
    intent: "private_reply",
    candidateText: "我先给范围：我是处决后验证类信息位。",
    evidence: [],
    requiredTerms: [],
  };
  const { user, payload } = buildLLMRendererPrompt(privatePayload);
  const userPayload = JSON.parse(user);
  assert.equal(payload.targetName, "", "private recipient UI label should not become a pressure target");
  assert.equal(userPayload.context.targetName, "");
  assert.ok(userPayload.visibleFacts.some((entry) => entry.includes("私聊回答要点")));
  const validation = validateLLMRenderedSpeech("我先把处决后能验证身份的范围讲清楚。", privatePayload);
  assert.equal(validation.ok, true, validation.reason);

  const seatYouPayload = {
    ...privatePayload,
    targetName: "3号（你）",
    requiredTerms: ["3号（你）"],
  };
  const seatYouPrompt = buildLLMRendererPrompt(seatYouPayload);
  assert.equal(seatYouPrompt.payload.targetName, "", "private seat-you UI label should not become a pressure target");
  assert.deepEqual(seatYouPrompt.payload.requiredTerms, [], "private seat-you UI label should not be required in speech text");
}

function testValidationRejectsForbiddenTerms() {
  const result = validateLLMRenderedSpeech("7号这里有 PRIVATE_SECRET_MARKER，直接出。", basePayload);
  assert.equal(result.ok, false);
  assert.match(result.reason, /forbidden-term/);
}

function testValidationRejectsMissingTarget() {
  const result = validateLLMRenderedSpeech("这个位置先听回应。", basePayload);
  assert.equal(result.ok, false);
  assert.match(result.reason, /missing-required-term|missing-target/);
}

function testValidationRejectsSpeakerPrefix() {
  const result = validateLLMRenderedSpeech("9号：7号这边先听回应。", basePayload);
  assert.equal(result.ok, false);
  assert.match(result.reason, /speaker-prefix/);
}

function testValidationRejectsStitchingArtifacts() {
  const result = validateLLMRenderedSpeech("7号这点先放不下，2 号公聊提到：公开身份。（先复…，先让他讲清楚。", basePayload);
  assert.equal(result.ok, false);
  assert.match(result.reason, /stitching-artifact/);
}

function testValidationRejectsBareTargetOnlyOutput() {
  const result = validateLLMRenderedSpeech("7号", basePayload);
  assert.equal(result.ok, false);
  assert.match(result.reason, /under-informative/);
}

function testValidationRejectsPromptLikeOutput() {
  const result = validateLLMRenderedSpeech("7号】昨晚的钟楼投票结果已经公布，您是否同意？", basePayload);
  assert.equal(result.ok, false);
  assert.match(result.reason, /prompt-like-output|stitching-artifact/);
  const leakedPrompt = validateLLMRenderedSpeech("7号，发言需要明确提到目标：7号", basePayload);
  assert.equal(leakedPrompt.ok, false);
  assert.match(leakedPrompt.reason, /prompt-like-output/);
  const offTopic = validateLLMRenderedSpeech("7号说团队的计划是去探险，所以要准备装备。", basePayload);
  assert.equal(offTopic.ok, false);
  assert.match(offTopic.reason, /prompt-like-output/);
  const targetInstruction = validateLLMRenderedSpeech("请发言时明确提到目标7号，发言焦点集中在身份和昨晚信息。", basePayload);
  assert.equal(targetInstruction.ok, false);
  assert.match(targetInstruction.reason, /prompt-like-output/);
  const voteAnnouncement = validateLLMRenderedSpeech("7号这边，1号：昨晚在钟楼的投票结果是……", basePayload);
  assert.equal(voteAnnouncement.ok, false);
  assert.match(voteAnnouncement.reason, /prompt-like-output/);
  const nightVote = validateLLMRenderedSpeech("7号，你刚刚提到了昨晚的信息，身份和昨晚的投票结果需要讲完整。", basePayload);
  assert.equal(nightVote.ok, false);
  assert.match(nightVote.reason, /prompt-like-output/);
  const roleplayLeak = validateLLMRenderedSpeech("我是玩家，私聊回答。投票先听被提名人解释。", {
    ...basePayload,
    targetName: "",
    requiredTerms: [],
    audience: "private",
  });
  assert.equal(roleplayLeak.ok, false);
  assert.match(roleplayLeak.reason, /prompt-like-output/);
  const malformedJson = validateLLMRenderedSpeech('{"text":"7号】】】】】】】】】】】', basePayload);
  assert.equal(malformedJson.ok, false);
  assert.match(malformedJson.reason, /stitching-artifact/);
  const privateHintLeak = validateLLMRenderedSpeech("私人回答要点：投票先听被提名人解释。", {
    ...basePayload,
    targetName: "",
    requiredTerms: [],
    audience: "private",
  });
  assert.equal(privateHintLeak.ok, false);
  assert.match(privateHintLeak.reason, /prompt-like-output/);
  const readyToAnswer = validateLLMRenderedSpeech("嗯，我准备好了。现在可以开始回答你的问题了。", {
    ...basePayload,
    targetName: "",
    requiredTerms: [],
    audience: "private",
  });
  assert.equal(readyToAnswer.ok, false);
  assert.match(readyToAnswer.reason, /prompt-like-output/);
  const reportFrame = validateLLMRenderedSpeech("在某号：7号的发言中，被推上台面这点需要回应。", basePayload);
  assert.equal(reportFrame.ok, false);
  assert.match(reportFrame.reason, /prompt-like-output/);
  const roleInstruction = validateLLMRenderedSpeech("你作为提名或互辩发言，先听回应或暂不定死。", {
    ...basePayload,
    targetName: "你",
    requiredTerms: ["你"],
    audience: "nomination",
  });
  assert.equal(roleInstruction.ok, false);
  assert.match(roleInstruction.reason, /prompt-like-output/);
  const playerRoleLeak = validateLLMRenderedSpeech("你这边，9号：嗯，我有点担心，但作为玩家，我需要先听回应。", {
    ...basePayload,
    targetName: "你",
    requiredTerms: ["你"],
    audience: "nomination",
  });
  assert.equal(playerRoleLeak.ok, false);
  assert.match(playerRoleLeak.reason, /prompt-like-output/);
  const packagePromptLeak = validateLLMRenderedSpeech(
    "你是一名玩家，正在讨论某号的提名或互辩发言。现在你需要指出对方在提名或互辩中的具体点。",
    basePayload
  );
  assert.equal(packagePromptLeak.ok, false);
  assert.match(packagePromptLeak.reason, /prompt-like-output/);
  const packageNeedToSpeakLeak = validateLLMRenderedSpeech("你有发言需要吗？", {
    ...basePayload,
    targetName: "你",
    requiredTerms: ["你"],
    audience: "nomination",
  });
  assert.equal(packageNeedToSpeakLeak.ok, false);
  assert.match(packageNeedToSpeakLeak.reason, /prompt-like-output/);
  const packageQuestionnaireLeak = validateLLMRenderedSpeech("你是谁？你有提名吗？你是否在讨论公聊投票？", {
    ...basePayload,
    targetName: "你",
    requiredTerms: ["你"],
    audience: "nomination",
  });
  assert.equal(packageQuestionnaireLeak.ok, false);
  assert.match(packageQuestionnaireLeak.reason, /prompt-like-output/);
  const packagePoliteQuestionLeak = validateLLMRenderedSpeech("9号玩家在公聊中提到，你是否愿意先听回应或暂不表态？", {
    ...basePayload,
    targetName: "你",
    requiredTerms: ["你"],
    audience: "nomination",
  });
  assert.equal(packagePoliteQuestionLeak.ok, false);
  assert.match(packagePoliteQuestionLeak.reason, /prompt-like-output/);
  const packageAssistantToneLeak = validateLLMRenderedSpeech("请在6号中确认身份和昨晚信息，以便我能够更好地了解情况并做出恰当的回应。", {
    ...basePayload,
    targetName: "6号",
    requiredTerms: ["6号"],
    audience: "public",
  });
  assert.equal(packageAssistantToneLeak.ok, false);
  assert.match(packageAssistantToneLeak.reason, /prompt-like-output/);
  const packageQuotedReportLeak = validateLLMRenderedSpeech("6号这边，2号公聊提到：我不无理由改口，镇长这条继续放桌面上。公开身份：镇长。", {
    ...basePayload,
    targetName: "6号",
    requiredTerms: ["6号"],
    audience: "public",
  });
  assert.equal(packageQuotedReportLeak.ok, false);
  assert.match(packageQuotedReportLeak.reason, /prompt-like-output/);
  const packageDebateStyleLeak = validateLLMRenderedSpeech("你提到，提名或互辩，语气可以更集中，但仍要留出投票判断空间。", {
    ...basePayload,
    targetName: "你",
    requiredTerms: ["你"],
    audience: "nomination",
  });
  assert.equal(packageDebateStyleLeak.ok, false);
  assert.match(packageDebateStyleLeak.reason, /prompt-like-output/);
  const liveAuditTargetSpeakerLeak = validateLLMRenderedSpeech("3号：嗯，昨晚我在钟楼遇到了一个陌生人，看起来有些神秘。", {
    ...basePayload,
    targetName: "3号",
    requiredTerms: ["3号"],
    candidateText: "我的意思是，台面上我先看3号。身份要对，先请3号把没讲清的点补清，再把昨晚信息说完整。",
    evidence: [],
  });
  assert.equal(liveAuditTargetSpeakerLeak.ok, false);
  assert.match(liveAuditTargetSpeakerLeak.reason, /target-speaker-prefix|prompt-like-output|unsupported-night-info/);
  const liveAuditReportLeak = validateLLMRenderedSpeech("在公聊中，7号提到了票型。", {
    ...basePayload,
    targetName: "7号",
    requiredTerms: ["7号"],
    candidateText: "我的意思是，台面上，7号这边公开信息还不够，先听回应和票型。",
    evidence: [],
  });
  assert.equal(liveAuditReportLeak.ok, false);
  assert.match(liveAuditReportLeak.reason, /prompt-like-output/);
  const liveAuditPressureReport = validateLLMRenderedSpeech("4号的投票和当前公开票型压力相反，这表明他可能被提名了。", {
    ...basePayload,
    targetName: "4号",
    requiredTerms: ["4号"],
    candidateText: "先把这组线放到同一桌面：票型反着走、被推上台面，先请4号解释票型，再补身份和昨晚信息。",
    evidence: [],
  });
  assert.equal(liveAuditPressureReport.ok, false);
  assert.match(liveAuditPressureReport.reason, /prompt-like-output/);
  const liveAuditPressureChain = validateLLMRenderedSpeech("7号，投票和当前公开票型压力相反，7号曾被放进公开提名压力链。", {
    ...basePayload,
    targetName: "7号",
    requiredTerms: ["7号"],
    candidateText: "新卡点是7号的票型需要重新对账，先请7号把票型解释清，身份和昨晚信息也要补清。",
    evidence: [],
  });
  assert.equal(liveAuditPressureChain.ok, false);
  assert.match(liveAuditPressureChain.reason, /prompt-like-output/);
  const liveAuditPressureDirection = validateLLMRenderedSpeech("6号的投票和当前公开票型压力相反，6号的投票和通过的处决方向一致。", {
    ...basePayload,
    targetName: "6号",
    requiredTerms: ["6号"],
    candidateText: "我先按这组矛盾追问：票型反着走、6号的投票和通过的处决...，这条先让6号解释票型。",
    evidence: [],
  });
  assert.equal(liveAuditPressureDirection.ok, false);
  assert.match(liveAuditPressureDirection.reason, /prompt-like-output/);
  const verifierRewriteLeak = validateLLMRenderedSpeech("你，我需要先听回应或暂不定死，现在能确定的东西不多，应该说成先听回应或暂不定死。", {
    ...basePayload,
    targetName: "你",
    requiredTerms: ["你"],
    candidateText: "你这边，先听回应，先别定死。",
    evidence: [],
    audience: "nomination",
  });
  assert.equal(verifierRewriteLeak.ok, false);
  assert.match(verifierRewriteLeak.reason, /prompt-like-output/);
  const liveAuditAssistantLeak = validateLLMRenderedSpeech("嗯，我注意到你提到了7号。在对话中，我并没有提到任何关于目标的信息。不过，如果你愿意，我可以问7号：身份和昨晚信有什么不同？", {
    ...basePayload,
    targetName: "7号",
    requiredTerms: ["7号"],
    candidateText: "我的意思是，台面上我先看7号。前面发言没讲清楚，先请7号把没讲清的点补清，再说昨晚信息。",
    evidence: [],
  });
  assert.equal(liveAuditAssistantLeak.ok, false);
  assert.match(liveAuditAssistantLeak.reason, /prompt-like-output/);
  const liveAuditSofterAssistantLeak = validateLLMRenderedSpeech("7号，我注意到你提到票型需要解释。", {
    ...basePayload,
    targetName: "7号",
    requiredTerms: ["7号"],
    candidateText: "我的意思是，台面上，7号这边公开信息还不够，先听回应和票型。",
    evidence: [],
  });
  assert.equal(liveAuditSofterAssistantLeak.ok, false);
  assert.match(liveAuditSofterAssistantLeak.reason, /prompt-like-output/);
  const liveAuditNightSpeechLeak = validateLLMRenderedSpeech("3号，你在昨晚的发言中提到身份和昨晚的信息。", {
    ...basePayload,
    targetName: "3号",
    requiredTerms: ["3号"],
    candidateText: "我的意思是，台面上我先看3号。身份要对，先请3号把没讲清的点补清，再把昨晚信息说完整。",
    evidence: [],
  });
  assert.equal(liveAuditNightSpeechLeak.ok, false);
  assert.match(liveAuditNightSpeechLeak.reason, /prompt-like-output/);
}

function testValidationRejectsPackageTargetPronounLeak() {
  const result = validateLLMRenderedSpeech("9号玩家发言，目标是你的，投票问题需要简明明确，先听回应或暂不定死。", {
    ...basePayload,
    targetName: "9号",
    requiredTerms: ["9号"],
    audience: "nomination",
    intent: "nomination_debate",
    candidateText: "9号被提名了，先回应提名理由，再看票。",
    evidence: ["9号被推上台面这点要回应"],
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /prompt-like-output/);
}

function testValidationRejectsDroppedSelfDisclosureBoundary() {
  const boundaryPayload = {
    ...basePayload,
    speakerName: "1号",
    targetName: "9号",
    requiredTerms: ["9号"],
    audience: "public",
    intent: "public_table_talk",
    candidateText:
      "我暂时保留具体身份，因为先给桌面能追问的边界，不把具体身份一次说死。先说清楚，我先给范围：我有早期信息，但第一轮不想全部倒出来。9号这边先听回应。",
    evidence: [],
    maxChars: 130,
  };
  const dropped = validateLLMRenderedSpeech("9号先回应桌上的问题，再把身份和信息补完整。", boundaryPayload);
  assert.equal(dropped.ok, false);
  assert.match(dropped.reason, /missing-candidate-anchor:self-disclosure-boundary|unsupported-target-pressure/);

  const preserved = validateLLMRenderedSpeech("我先给范围，9号这轮先听回应，答不齐再继续压。", boundaryPayload);
  assert.equal(preserved.ok, true, preserved.reason);
}

function testSimilarityScoresNearCopies() {
  assert.ok(scoreTextSimilarity(basePayload.candidateText, basePayload.candidateText) > 0.99);
  assert.ok(scoreTextSimilarity("7号先别急，我想听他把身份和信息讲完整。", basePayload.candidateText) < 0.7);
}

async function testMockRendererProducesSafeSpeech() {
  const result = await renderSpeechWithLocalLLM(basePayload, {
    enabled: true,
    provider: "mock",
  });
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.fallbackUsed, false);
  assert.match(result.text, /7号/);
  assert.match(result.text, /身份|信息/);
  assert.doesNotMatch(result.text, /口径|复核|硬信息|接前面一句|PRIVATE_SECRET_MARKER/);
}

async function testMockRendererDoesNotPressurePrivateRecipient() {
  const result = await renderSpeechWithLocalLLM(
    {
      ...basePayload,
      targetName: "你",
      audience: "private",
      intent: "private_reply",
      candidateText: "我先给范围：我是处决后验证类信息位。",
      evidence: [],
      requiredTerms: [],
    },
    {
      enabled: true,
      provider: "mock",
    }
  );
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.fallbackUsed, false);
  assert.match(result.text, /处决后.*信息位|验证身份/);
  assert.doesNotMatch(result.text, /你这点|这个位置|先让他讲清楚/);
}

async function testMockRendererPreservesPrivateFocusSuggestion() {
  const result = await renderSpeechWithLocalLLM(
    {
      ...basePayload,
      targetName: "你",
      audience: "private",
      intent: "private_reply",
      candidateText: "我想听 5号和 8号互相解释一下夜里信息位的边界，他们的压力点不太一样。",
      evidence: [],
      requiredTerms: [],
    },
    {
      enabled: true,
      provider: "mock",
    }
  );
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.fallbackUsed, false);
  assert.match(result.text, /5号和8号/);
  assert.doesNotMatch(result.text, /你这点|这个位置|5 号|8 号/);
}

async function testMockRendererUsesMultiEvidenceAnchor() {
  const result = await renderSpeechWithLocalLLM(
    {
      ...basePayload,
      evidence: ["前面发言没讲清楚", "身份先放桌上：我是送葬者"],
    },
    {
      enabled: true,
      provider: "mock",
    }
  );
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.fallbackUsed, false);
  assert.match(result.text, /身份/);
  assert.doesNotMatch(result.text, /这点我先放不下/);
}

async function testMockRendererUsesNaturalDeathEvidence() {
  const result = await renderSpeechWithLocalLLM(
    {
      ...basePayload,
      evidence: ["夜间死亡记录牵涉 7号"],
    },
    {
      enabled: true,
      provider: "mock",
    }
  );
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.fallbackUsed, false);
  assert.match(result.text, /昨晚死亡这条线/);
  assert.doesNotMatch(result.text, /死亡信息|这点我先放不下/);
}

async function testMockRendererUsesTableStanceEvidence() {
  const result = await renderSpeechWithLocalLLM(
    {
      ...basePayload,
      speakerName: "9号",
      targetName: "3号",
      audience: "private",
      intent: "private_reply",
      candidateText: "好，我直接答。我先看 3号。前面发言和站边还没讲顺。",
      evidence: ["前面发言和站边还没讲顺"],
      requiredTerms: ["3号"],
    },
    {
      enabled: true,
      provider: "mock",
    }
  );
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.fallbackUsed, false);
  assert.match(result.text, /3号/);
  assert.match(result.text, /发言|站边/);
  assert.doesNotMatch(result.text, /这点我先记着|这点我先放不下/);
}

async function testMockRendererUsesCandidateFocusWithoutEvidence() {
  const result = await renderSpeechWithLocalLLM(
    {
      ...basePayload,
      speakerName: "1号",
      targetName: "6号",
      audience: "public",
      intent: "public_table_talk",
      candidateText: "这条还只是追问入口，我先不定死，接下来先问6号：身份和昨晚信息。",
      evidence: [],
      requiredTerms: ["6号"],
    },
    {
      enabled: true,
      provider: "mock",
    }
  );
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.fallbackUsed, false);
  assert.match(result.text, /6号/);
  assert.match(result.text, /身份.*昨晚信息|昨晚信息.*身份/);
  assert.doesNotMatch(result.text, /6号先听回应，我现在不定死/);
}

async function testMockRendererVariesRepeatedPublicPressure() {
  const outputs = [];
  for (const speakerName of ["1号", "2号", "3号", "4号", "5号", "6号"]) {
    const result = await renderSpeechWithLocalLLM(
      {
        ...basePayload,
        speakerName,
        targetName: "8号",
        audience: "public",
        intent: "public_table_talk",
        candidateText: "8号这边，前面发言没讲清楚。",
        evidence: ["前面发言没讲清楚", "身份先放桌上：我是送葬者"],
        requiredTerms: ["8号"],
      },
      {
        enabled: true,
        provider: "mock",
      }
    );
    assert.equal(result.ok, true, result.reason);
    assert.equal(result.fallbackUsed, false);
    assert.match(result.text, /8号/);
    assert.match(result.text, /身份/);
    outputs.push(result.text);
  }
  assert.ok(new Set(outputs).size >= 2, `expected varied pressure lines, got ${outputs.join(" | ")}`);
}

async function testRendererRetriesNearCopy() {
  let calls = 0;
  const result = await renderSpeechWithLocalLLM(basePayload, {
    enabled: true,
    provider: "openai-compatible",
    transport: async () => {
      calls += 1;
      return calls === 1
        ? JSON.stringify({ text: basePayload.candidateText })
        : JSON.stringify({ text: "7号先别急着过，我想听你把身份和昨晚信息讲完整。" });
    },
  });
  assert.equal(calls, 2, "near-copy output should trigger one rewrite retry");
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.retryUsed, true);
  assert.equal(result.reason, "retry-near-copy");
  assert.match(result.text, /7号/);
  assert.notEqual(result.text, basePayload.candidateText);
}

async function testRendererRepairsMissingVisibleTarget() {
  const result = await renderSpeechWithLocalLLM(basePayload, {
    enabled: true,
    provider: "openai-compatible",
    transport: async () => JSON.stringify({ text: "先别急着过，我想听他把身份和昨晚信息讲完整。" }),
  });
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.fallbackUsed, false);
  assert.equal(result.repaired, true);
  assert.match(result.text, /7号/);
}

async function testRendererRepairsSpeakerPrefix() {
  const result = await renderSpeechWithLocalLLM(basePayload, {
    enabled: true,
    provider: "openai-compatible",
    transport: async () => JSON.stringify({ text: "9号：7号先说身份和昨晚信息，我再判断。" }),
  });
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.fallbackUsed, false);
  assert.equal(result.repaired, true);
  assert.equal(result.reason, "repaired:speaker-prefix:9号");
  assert.match(result.text, /7号/);
  assert.doesNotMatch(result.text, /^9号/);
}

async function testRendererRepairsStitchingArtifacts() {
  const result = await renderSpeechWithLocalLLM(basePayload, {
    enabled: true,
    provider: "openai-compatible",
    transport: async () => JSON.stringify({ text: "7号这点我先放不下，2 号公聊提到：公开身份：镇长。（先复…，先让他讲清楚。" }),
  });
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.fallbackUsed, false);
  assert.equal(result.repaired, true);
  assert.equal(result.reason, "repaired:stitching-artifact");
  assert.match(result.text, /7号/);
  assert.doesNotMatch(result.text, /复…|[（(]|[0-9]+\s+号/);
}

async function testRendererGroundsVagueEvidenceLine() {
  const result = await renderSpeechWithLocalLLM(basePayload, {
    enabled: true,
    provider: "openai-compatible",
    transport: async () => JSON.stringify({ text: "7号这里我觉得有点怪，先听他说。" }),
  });
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.fallbackUsed, false);
  assert.equal(result.repaired, true);
  assert.equal(result.reason, "repaired:missing-evidence-anchor:身份/信息");
  assert.match(result.text, /7号/);
  assert.match(result.text, /身份|信息/);
}

async function testRendererRepairsBareTargetOnlyOutput() {
  const result = await renderSpeechWithLocalLLM(basePayload, {
    enabled: true,
    provider: "openai-compatible",
    transport: async () => JSON.stringify({ text: "7号" }),
  });
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.fallbackUsed, false);
  assert.equal(result.repaired, true);
  assert.equal(result.reason, "repaired:under-informative-target-only");
  assert.match(result.text, /7号/);
  assert.match(result.text, /身份|信息/);
  assert.notEqual(result.text, "7号");
}

async function testRendererRepairsPromptLikeOutput() {
  const result = await renderSpeechWithLocalLLM(basePayload, {
    enabled: true,
    provider: "openai-compatible",
    transport: async () => JSON.stringify({ text: "7号】昨晚的钟楼投票结果已经公布，您是否同意？" }),
  });
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.fallbackUsed, false);
  assert.equal(result.repaired, true);
  assert.match(result.reason, /repaired:(prompt-like-output|stitching-artifact)/);
  assert.match(result.text, /7号/);
  assert.doesNotMatch(result.text, /您是否同意|血染钟楼字样的牌|投票结果已经公布/);

  const leakedPrompt = await renderSpeechWithLocalLLM(basePayload, {
    enabled: true,
    provider: "openai-compatible",
    transport: async () => JSON.stringify({ text: "7号，发言需要明确提到目标：7号" }),
  });
  assert.equal(leakedPrompt.ok, true, leakedPrompt.reason);
  assert.equal(leakedPrompt.repaired, true);
  assert.doesNotMatch(leakedPrompt.text, /发言需要明确提到目标/);

  const offTopic = await renderSpeechWithLocalLLM(basePayload, {
    enabled: true,
    provider: "openai-compatible",
    transport: async () => JSON.stringify({ text: "7号说团队的计划是去探险，所以要准备装备。" }),
  });
  assert.equal(offTopic.ok, true, offTopic.reason);
  assert.equal(offTopic.repaired, true);
  assert.doesNotMatch(offTopic.text, /探险|装备/);

  const targetInstruction = await renderSpeechWithLocalLLM(basePayload, {
    enabled: true,
    provider: "openai-compatible",
    transport: async () => JSON.stringify({ text: "请发言时明确提到目标7号，发言焦点集中在身份和昨晚信息。" }),
  });
  assert.equal(targetInstruction.ok, true, targetInstruction.reason);
  assert.equal(targetInstruction.repaired, true);
  assert.doesNotMatch(targetInstruction.text, /请发言时|发言焦点/);

  const voteAnnouncement = await renderSpeechWithLocalLLM(basePayload, {
    enabled: true,
    provider: "openai-compatible",
    transport: async () => JSON.stringify({ text: "7号这边，1号：昨晚在钟楼的投票结果是……" }),
  });
  assert.equal(voteAnnouncement.ok, true, voteAnnouncement.reason);
  assert.equal(voteAnnouncement.repaired, true);
  assert.doesNotMatch(voteAnnouncement.text, /钟楼的投票结果|1号：/);

  const nightVote = await renderSpeechWithLocalLLM(basePayload, {
    enabled: true,
    provider: "openai-compatible",
    transport: async () => JSON.stringify({ text: "7号，你刚刚提到了昨晚的信息，身份和昨晚的投票结果需要讲完整。" }),
  });
  assert.equal(nightVote.ok, true, nightVote.reason);
  assert.equal(nightVote.repaired, true);
  assert.doesNotMatch(nightVote.text, /昨晚的投票结果/);

  const roleplayLeak = await renderSpeechWithLocalLLM(
    {
      ...basePayload,
      targetName: "",
      requiredTerms: [],
      audience: "private",
      candidateText: "我会先听被提名人的说法；如果解释不清，我会倾向投赞成。",
      evidence: [],
    },
    {
      enabled: true,
      provider: "openai-compatible",
      transport: async () => JSON.stringify({ text: "我是玩家，私聊回答。投票先听被提名人解释。" }),
    }
  );
  assert.equal(roleplayLeak.ok, true, roleplayLeak.reason);
  assert.equal(roleplayLeak.repaired, true);
  assert.doesNotMatch(roleplayLeak.text, /我是玩家|私聊回答/);

  const malformedJson = await renderSpeechWithLocalLLM(basePayload, {
    enabled: true,
    provider: "openai-compatible",
    transport: async () => JSON.stringify({ text: '{"text":"7号】】】】】】】】】】】' }),
  });
  assert.equal(malformedJson.ok, true, malformedJson.reason);
  assert.equal(malformedJson.repaired, true);
  assert.doesNotMatch(malformedJson.text, /\{"text"|】】】/);

  const privateHintLeak = await renderSpeechWithLocalLLM(
    {
      ...basePayload,
      targetName: "",
      requiredTerms: [],
      audience: "private",
      candidateText: "我会先听被提名人的说法；如果解释不清，我会倾向投赞成。",
      evidence: [],
    },
    {
      enabled: true,
      provider: "openai-compatible",
      transport: async () => JSON.stringify({ text: "私人回答要点：投票先听被提名人解释。" }),
    }
  );
  assert.equal(privateHintLeak.ok, true, privateHintLeak.reason);
  assert.equal(privateHintLeak.repaired, true);
  assert.doesNotMatch(privateHintLeak.text, /私人回答要点/);

  const readyToAnswer = await renderSpeechWithLocalLLM(
    {
      ...basePayload,
      targetName: "",
      requiredTerms: [],
      audience: "private",
      candidateText: "我会先听被提名人的说法；如果解释不清，我会倾向投赞成。",
      evidence: [],
    },
    {
      enabled: true,
      provider: "openai-compatible",
      transport: async () => JSON.stringify({ text: "嗯，我准备好了。现在可以开始回答你的问题了。" }),
    }
  );
  assert.equal(readyToAnswer.ok, true, readyToAnswer.reason);
  assert.equal(readyToAnswer.repaired, true);
  assert.doesNotMatch(readyToAnswer.text, /准备好了|回答你的问题/);

  const reportFrame = await renderSpeechWithLocalLLM(basePayload, {
    enabled: true,
    provider: "openai-compatible",
    transport: async () => JSON.stringify({ text: "在某号：7号的发言中，被推上台面这点需要回应。" }),
  });
  assert.equal(reportFrame.ok, true, reportFrame.reason);
  assert.equal(reportFrame.repaired, true);
  assert.doesNotMatch(reportFrame.text, /在某号/);

  const roleInstruction = await renderSpeechWithLocalLLM(
    {
      ...basePayload,
      targetName: "你",
      requiredTerms: ["你"],
      audience: "nomination",
    },
    {
      enabled: true,
      provider: "openai-compatible",
      transport: async () => JSON.stringify({ text: "你作为提名或互辩发言，先听回应或暂不定死。" }),
    }
  );
  assert.equal(roleInstruction.ok, true, roleInstruction.reason);
  assert.equal(roleInstruction.repaired, true);
  assert.doesNotMatch(roleInstruction.text, /你作为|互辩发言/);

  const playerRoleLeak = await renderSpeechWithLocalLLM(
    {
      ...basePayload,
      targetName: "你",
      requiredTerms: ["你"],
      audience: "nomination",
    },
    {
      enabled: true,
      provider: "openai-compatible",
      transport: async () => JSON.stringify({ text: "你这边，9号：嗯，我有点担心，但作为玩家，我需要先听回应。" }),
    }
  );
  assert.equal(playerRoleLeak.ok, true, playerRoleLeak.reason);
  assert.equal(playerRoleLeak.repaired, true);
  assert.doesNotMatch(playerRoleLeak.text, /作为玩家|9号：/);
}

async function testRendererRepairsVagueNoEvidenceLine() {
  const result = await renderSpeechWithLocalLLM(
    {
      ...basePayload,
      evidence: [],
    },
    {
      enabled: true,
      provider: "openai-compatible",
      transport: async () => JSON.stringify({ text: "7号刚才那件事，先解释一下。" }),
    }
  );
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.fallbackUsed, false);
  assert.equal(result.repaired, true);
  assert.equal(result.reason, "repaired:forbidden-term:那件事");
  assert.match(result.text, /7号/);
  assert.match(result.text, /身份|信息/);
  assert.doesNotMatch(result.text, /那件事/);
}

async function testRendererRepairsGenericPrivateExecutionVerification() {
  const result = await renderSpeechWithLocalLLM(
    {
      ...basePayload,
      targetName: "你",
      audience: "private",
      intent: "private_reply",
      candidateText: "我先给范围：我是处决后验证类信息位，能对今天被处决的人给说法。具体身份先不摊死。",
      evidence: [],
      requiredTerms: [],
      maxChars: 170,
    },
    {
      enabled: true,
      provider: "openai-compatible",
      transport: async () => JSON.stringify({ text: "这位身份和昨晚信息先讲完整，我现在不定死。" }),
    }
  );
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.repaired, true);
  assert.match(result.reason, /missing-candidate-anchor|unsupported-night-info/);
  assert.match(result.text, /处决|验证/);
  assert.doesNotMatch(result.text, /这位身份和昨晚信息先讲完整/);
}

async function testRendererRepairsDroppedSelfDisclosureBoundary() {
  const result = await renderSpeechWithLocalLLM(
    {
      ...basePayload,
      speakerName: "1号",
      targetName: "9号",
      requiredTerms: ["9号"],
      audience: "public",
      intent: "public_table_talk",
      candidateText:
        "我暂时保留具体身份，因为先给桌面能追问的边界，不把具体身份一次说死。先说清楚，我先给范围：我有早期信息，但第一轮不想全部倒出来。9号这边先听回应。",
      evidence: [],
      maxChars: 130,
    },
    {
      enabled: true,
      provider: "openai-compatible",
      transport: async () => JSON.stringify({ text: "9号先回应桌上的问题，再把身份和信息补完整。" }),
    }
  );
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.repaired, true);
  assert.match(result.reason, /missing-candidate-anchor:self-disclosure-boundary|unsupported-target-pressure/);
  assert.match(result.text, /9号/);
  assert.match(result.text, /先给范围|给范围|早期信息|不说死|保留具体身份/);
  assert.doesNotMatch(result.text, /9号[^。！？；]{0,36}(身份|昨晚|夜里|信息|身份线|身份说法|补完整|对上)/);
  assert.notEqual(result.text, "9号先回应桌上的问题，再把身份和信息补完整。");
}

async function testRendererPreservesPublicRoleClaimWhenTinyModelGeneric() {
  const result = await renderSpeechWithLocalLLM(
    {
      ...basePayload,
      speakerName: "1号",
      targetName: "9号",
      requiredTerms: ["9号"],
      audience: "public",
      intent: "public_table_talk",
      candidateText: "身份先放桌上：我是送葬者。9号这边，先解释票型，再补身份和昨晚信息。",
      evidence: [],
      maxChars: 130,
    },
    {
      enabled: true,
      provider: "openai-compatible",
      transport: async () => JSON.stringify({ text: "9号身份和昨晚信息先讲完整，我现在不定死。" }),
    }
  );
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.repaired, true);
  assert.match(result.reason, /missing-candidate-anchor/);
  assert.match(result.text, /送葬者/);
  assert.match(result.text, /9号/);
  assert.match(result.text, /票型|身份|昨晚|信息/);
}

async function testRendererRepairsSelfClaimTargetResponseDrift() {
  const result = await renderSpeechWithLocalLLM(
    {
      ...basePayload,
      speakerName: "1号",
      targetName: "9号",
      requiredTerms: ["9号"],
      audience: "public",
      intent: "public_table_talk",
      candidateText:
        "送葬者这条身份线不改，今天仍按它来聊。我有点犹豫，但我先跳送葬者。9号这边先听回应。",
      evidence: [],
      maxChars: 130,
    },
    {
      enabled: true,
      provider: "openai-compatible",
      transport: async () => JSON.stringify({ text: "我先跳送葬者。9号先把身份线补完整，别只给结论。" }),
    }
  );
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.repaired, true);
  assert.match(result.reason, /unsupported-target-pressure/);
  assert.match(result.text, /送葬者/);
  assert.match(result.text, /9号/);
  assert.match(result.text, /先听回应|听完回应|不定死|先留着|话说完整/);
  assert.doesNotMatch(result.text, /9号[^。！？；]{0,36}(身份|昨晚|夜里|信息|票型|身份线|身份说法|补完整|对上)/);
}

async function testRendererKeepsSelfClaimResponseGenericWithReplayEvidence() {
  const result = await renderSpeechWithLocalLLM(
    {
      ...basePayload,
      speakerName: "4号",
      targetName: "6号",
      requiredTerms: ["6号"],
      audience: "public",
      intent: "public_table_talk",
      candidateText: "送葬者这条身份线不改，今天仍按它来聊。身份先放桌上：我是送葬者。6号这边先听回应。",
      evidence: [
        "3 号公聊提到：我选择明跳身份，因为身份线已经到该给可验证落点的时候。",
        "2 号公聊提到：镇长这条继续放桌面上，6号这条先留桌面。",
      ],
      maxChars: 130,
    },
    {
      enabled: true,
      provider: "openai-compatible",
      transport: async () => JSON.stringify({ text: "6号" }),
    }
  );
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.repaired, true);
  assert.match(result.reason, /under-informative/);
  assert.match(result.text, /送葬者/);
  assert.match(result.text, /6号/);
  assert.match(result.text, /先听回应|听完回应|不定死|先留着|话说完整/);
  assert.doesNotMatch(result.text, /6号[^。！？；]{0,36}(身份|昨晚|夜里|信息|票型|身份线|身份说法|补完整|对上)/);
}

async function testRendererKeepsSelfDisclosureResponseGenericWithReplayEvidence() {
  const result = await renderSpeechWithLocalLLM(
    {
      ...basePayload,
      speakerName: "4号",
      targetName: "7号",
      requiredTerms: ["7号"],
      audience: "public",
      intent: "public_table_talk",
      candidateText:
        "我只给保守身份范围，因为先给桌面能追问的边界，不把具体身份一次说死。台面上，强功能位别第一天全交，先让信息互相撞。7号这边先听回应。",
      evidence: [
        "3 号公聊提到：我选择明跳身份，因为身份线已经到该给可验证落点的时候。",
        "2 号公聊提到：陌客这条继续放桌面上，公开身份：陌客。",
      ],
      maxChars: 130,
    },
    {
      enabled: true,
      provider: "openai-compatible",
      transport: async () => JSON.stringify({ text: "我先给范围，具体身份先不说死。7号前面没把身份讲顺，先听他补清楚。" }),
    }
  );
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.repaired, true);
  assert.match(result.reason, /unsupported-target-pressure/);
  assert.match(result.text, /先给范围|具体身份先不说死|保守身份范围|早期信息/);
  assert.match(result.text, /7号/);
  assert.match(result.text, /先听回应|听完回应|不定死|先留着|话说完整/);
  assert.doesNotMatch(result.text, /7号[^。！？；]{0,36}(身份|昨晚|夜里|信息|票型|身份线|身份说法|补完整|对上|讲顺)/);
}

async function testRendererVariesIdentityInfoRepairByCandidateAnchor() {
  const voteContext = await renderSpeechWithLocalLLM(
    {
      ...basePayload,
      speakerName: "1号",
      targetName: "9号",
      requiredTerms: ["9号"],
      audience: "public",
      intent: "public_table_talk",
      candidateText: "9号这边，公开信息还不够，先听回应和票型。先请9号解释票型，再补身份和昨晚信息。",
      evidence: [],
      maxChars: 130,
    },
    {
      enabled: true,
      provider: "openai-compatible",
      transport: async () => JSON.stringify({ text: "9号。" }),
    }
  );
  const pressureContext = await renderSpeechWithLocalLLM(
    {
      ...basePayload,
      speakerName: "1号",
      targetName: "9号",
      requiredTerms: ["9号"],
      audience: "public",
      intent: "pressure_question",
      candidateText: "9号可以进提名池，但我先听身份和昨晚信息，再决定要不要继续上压力。",
      evidence: [],
      maxChars: 130,
    },
    {
      enabled: true,
      provider: "openai-compatible",
      transport: async () => JSON.stringify({ text: "9号。" }),
    }
  );

  assert.equal(voteContext.ok, true, voteContext.reason);
  assert.equal(pressureContext.ok, true, pressureContext.reason);
  assert.equal(voteContext.repaired, true);
  assert.equal(pressureContext.repaired, true);
  assert.match(voteContext.reason, /under-informative/);
  assert.match(pressureContext.reason, /under-informative/);
  assert.match(voteContext.text, /9号/);
  assert.match(pressureContext.text, /9号/);
  assert.match(voteContext.text, /票型|投票|解释/);
  assert.match(pressureContext.text, /压力|提名|身份信息/);
  assert.notEqual(voteContext.text, pressureContext.text);
  assert.doesNotMatch(voteContext.text, /身份和昨晚信息先讲完整|这轮重点是身份和昨晚信息/);
}

async function testRendererPreservesPublicExecutionRangeAsShortFallback() {
  const result = await renderSpeechWithLocalLLM(
    {
      ...basePayload,
      speakerName: "1号",
      targetName: "9号",
      requiredTerms: ["9号"],
      audience: "public",
      intent: "public_table_talk",
      candidateText:
        "我只给处决验证位范围，因为持续信息位早期还需要保留生存价值。9号这条先留桌面上，身份和昨晚信息要补清。",
      evidence: [],
      maxChars: 130,
    },
    {
      enabled: true,
      provider: "openai-compatible",
      transport: async () => JSON.stringify({ text: "9号。" }),
    }
  );
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.repaired, true);
  assert.match(result.reason, /under-informative/);
  assert.match(result.text, /处决|验证/);
  assert.match(result.text, /9号/);
  assert.ok(result.text.length < 90, "execution range fallback should stay short");
}

async function testRendererPreservesPrivateMultiSeatAsk() {
  const result = await renderSpeechWithLocalLLM(
    {
      ...basePayload,
      targetName: "你",
      audience: "private",
      intent: "private_reply",
      candidateText: "我想听 5号和 8号互相解释一下夜里信息位的边界，他们的压力点不太一样。",
      evidence: [],
      requiredTerms: [],
      maxChars: 170,
    },
    {
      enabled: true,
      provider: "openai-compatible",
      transport: async () => JSON.stringify({ text: "这位先把昨晚信息补清楚，再看站边。" }),
    }
  );
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.repaired, true);
  assert.match(result.reason, /missing-candidate-anchor/);
  assert.match(result.text, /5号/);
  assert.match(result.text, /8号/);
}

async function testRendererRepairsSpeakerTargetConfusion() {
  const result = await renderSpeechWithLocalLLM(
    {
      ...basePayload,
      speakerName: "1号",
      targetName: "3号",
      requiredTerms: ["3号"],
      audience: "public",
      intent: "public_table_talk",
      candidateText: "台面上我先看3号，身份和昨晚信息要说完整。",
      evidence: [],
      maxChars: 130,
    },
    {
      enabled: true,
      provider: "openai-compatible",
      transport: async () => JSON.stringify({ text: "大家好，我是3号，今天我提到了昨晚的信息。" }),
    }
  );
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.repaired, true);
  assert.match(result.reason, /speaker-target-confusion/);
  assert.match(result.text, /3号/);
  assert.doesNotMatch(result.text, /我是3号/);
}

async function testRendererRepairsUnsupportedNightInfoDrift() {
  const result = await renderSpeechWithLocalLLM(
    {
      ...basePayload,
      targetName: "你",
      audience: "private",
      intent: "private_reply",
      candidateText: "我会先听被提名人的说法；如果解释不清，我会倾向投赞成。",
      evidence: [],
      requiredTerms: [],
      maxChars: 170,
    },
    {
      enabled: true,
      provider: "openai-compatible",
      transport: async () => JSON.stringify({ text: "我来回答了昨晚的信息。投票先听被提名人解释，解释不清再考虑赞成。" }),
    }
  );
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.repaired, true);
  assert.match(result.reason, /prompt-like-output|unsupported-night-info/);
  assert.match(result.text, /投票|赞成|被提名/);
  assert.doesNotMatch(result.text, /昨晚|我来回答了/);
}

async function testRendererRepairsUnsupportedDeathInfoDrift() {
  const validation = validateLLMRenderedSpeech("6号要把昨晚死亡这条线解释清楚。", {
    ...basePayload,
    targetName: "6号",
    requiredTerms: ["6号"],
    audience: "public",
    intent: "public_table_talk",
    candidateText: "6号身份和昨晚信息先讲完整，我现在不定死。",
    evidence: [],
    maxChars: 130,
  });
  assert.equal(validation.ok, false);
  assert.equal(validation.reason, "unsupported-death-info");

  const result = await renderSpeechWithLocalLLM(
    {
      ...basePayload,
      speakerName: "2号",
      targetName: "6号",
      requiredTerms: ["6号"],
      audience: "public",
      intent: "public_table_talk",
      candidateText: "6号身份和昨晚信息先讲完整，我现在不定死。",
      evidence: [],
      maxChars: 130,
    },
    {
      enabled: true,
      provider: "openai-compatible",
      transport: async () => JSON.stringify({ text: "6号要把昨晚死亡这条线解释清楚。" }),
    }
  );
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.repaired, true);
  assert.match(result.reason, /unsupported-death-info/);
  assert.match(result.text, /6号/);
  assert.match(result.text, /身份|昨晚信息|解释/);
  assert.doesNotMatch(result.text, /昨晚死亡|死亡这条线/);
}

async function testRendererRepairsTableTalkDrift() {
  const result = await renderSpeechWithLocalLLM(
    {
      ...basePayload,
      speakerName: "1号",
      targetName: "2号",
      requiredTerms: ["2号"],
      audience: "public",
      intent: "public_table_talk",
      candidateText: "2号身份和昨晚信息先讲完整，我现在不定死。",
      evidence: [],
      maxChars: 130,
    },
    {
      enabled: true,
      provider: "openai-compatible",
      transport: async () => JSON.stringify({ text: "2号，昨晚我们讨论了很多话题，但你似乎不太了解。有什么问题吗？" }),
    }
  );
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.repaired, true);
  assert.match(result.reason, /prompt-like-output/);
  assert.match(result.text, /2号/);
  assert.doesNotMatch(result.text, /讨论了很多话题|不太了解|有什么问题吗/);
}

async function testRendererRepairsGenericQuestionDrift() {
  const result = await renderSpeechWithLocalLLM(
    {
      ...basePayload,
      speakerName: "1号",
      targetName: "2号",
      requiredTerms: ["2号"],
      audience: "public",
      intent: "public_table_talk",
      candidateText: "2号身份和昨晚信息先讲完整，我现在不定死。",
      evidence: [],
      maxChars: 130,
    },
    {
      enabled: true,
      provider: "openai-compatible",
      transport: async () => JSON.stringify({ text: "2号，你有什么想说的吗？" }),
    }
  );
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.repaired, true);
  assert.match(result.reason, /prompt-like-output/);
  assert.match(result.text, /2号/);
  assert.doesNotMatch(result.text, /有什么想说/);
}

async function testRendererRepairsPackagePromptLeak() {
  const result = await renderSpeechWithLocalLLM(
    {
      ...basePayload,
      speakerName: "8号",
      targetName: "5号",
      requiredTerms: ["5号"],
      audience: "nomination",
      intent: "nomination_debate",
      candidateText: "5号投票这块先解释，再看要不要继续压。",
      evidence: ["5号投票这块需要解释"],
      maxChars: 120,
    },
    {
      enabled: true,
      provider: "openai-compatible",
      transport: async () => JSON.stringify({
        text: "你是一名玩家，正在讨论某号的提名或互辩发言。现在你需要指出对方在提名或互辩中的具体点。",
      }),
    }
  );
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.fallbackUsed, true);
  assert.match(result.reason, /prompt-like-output|near-copy-local-rewrite/);
  assert.match(result.text, /5号/);
  assert.match(result.text, /票|解释/);
  assert.doesNotMatch(result.text, /你是一名玩家|正在讨论某号|现在你需要/);
}

async function testRendererRepairsPackageNeedToSpeakLeak() {
  const result = await renderSpeechWithLocalLLM(
    {
      ...basePayload,
      speakerName: "1号",
      targetName: "你",
      requiredTerms: ["你"],
      audience: "nomination",
      intent: "nomination_debate",
      candidateText: "你被提名了，先回应提名理由，再看票。",
      evidence: ["你被推上台面这点要回应"],
      maxChars: 120,
    },
    {
      enabled: true,
      provider: "openai-compatible",
      transport: async () => JSON.stringify({ text: "你有发言需要吗？" }),
    }
  );
  assert.equal(result.ok, true, result.reason);
  assert.match(result.reason, /prompt-like-output|near-copy-local-rewrite/);
  assert.match(result.text, /你/);
  assert.match(result.text, /提名|回应|票|防守/);
  assert.doesNotMatch(result.text, /发言需要/);
}

async function testRendererRepairsPackageQuestionnaireLeak() {
  const result = await renderSpeechWithLocalLLM(
    {
      ...basePayload,
      speakerName: "9号",
      targetName: "你",
      requiredTerms: ["你"],
      audience: "nomination",
      intent: "nomination_debate",
      candidateText: "你被提名了，先回应提名理由，再看票。",
      evidence: ["你被推上台面这点要回应"],
      maxChars: 120,
    },
    {
      enabled: true,
      provider: "openai-compatible",
      transport: async () => JSON.stringify({ text: "你是谁？你有提名吗？你是否在讨论公聊投票？" }),
    }
  );
  assert.equal(result.ok, true, result.reason);
  assert.match(result.reason, /prompt-like-output|near-copy-local-rewrite/);
  assert.match(result.text, /你/);
  assert.match(result.text, /提名|回应|票|防守/);
  assert.doesNotMatch(result.text, /你是谁|你有提名吗|是否在讨论公聊投票/);
}

async function testRendererRepairsPackagePoliteQuestionLeak() {
  const result = await renderSpeechWithLocalLLM(
    {
      ...basePayload,
      speakerName: "9号",
      targetName: "你",
      requiredTerms: ["你"],
      audience: "nomination",
      intent: "nomination_debate",
      candidateText: "你被提名了，先回应提名理由，再看票。",
      evidence: ["你被推上台面这点要回应"],
      maxChars: 120,
    },
    {
      enabled: true,
      provider: "openai-compatible",
      transport: async () => JSON.stringify({ text: "9号玩家在公聊中提到，你是否愿意先听回应或暂不表态？" }),
    }
  );
  assert.equal(result.ok, true, result.reason);
  assert.match(result.reason, /prompt-like-output|near-copy-local-rewrite/);
  assert.match(result.text, /你/);
  assert.match(result.text, /提名|回应|票|防守/);
  assert.doesNotMatch(result.text, /玩家在公聊中提到|是否愿意|暂不表态/);
}

async function testRendererRepairsPackageDebateStyleLeak() {
  const result = await renderSpeechWithLocalLLM(
    {
      ...basePayload,
      speakerName: "2号",
      targetName: "你",
      requiredTerms: ["你"],
      audience: "nomination",
      intent: "nomination_debate",
      candidateText: "你被提名了，先回应提名理由，再看票。",
      evidence: ["你被推上台面这点要回应"],
      maxChars: 120,
    },
    {
      enabled: true,
      provider: "openai-compatible",
      transport: async () => JSON.stringify({
        text: "你提到，提名或互辩，语气可以更集中，但仍要留出投票判断空间。",
      }),
    }
  );
  assert.equal(result.ok, true, result.reason);
  assert.match(result.reason, /prompt-like-output|near-copy-local-rewrite/);
  assert.match(result.text, /你/);
  assert.match(result.text, /提名|回应|票|防守/);
  assert.doesNotMatch(result.text, /提名或互辩|语气可以更集中|投票判断空间/);
}

async function testRendererRepairsLiveAuditAssistantAndHallucinationLeaks() {
  const hallucinatedNight = await renderSpeechWithLocalLLM(
    {
      ...basePayload,
      speakerName: "1号",
      targetName: "3号",
      requiredTerms: ["3号"],
      audience: "public",
      intent: "public_table_talk",
      candidateText: "我的意思是，台面上我先看3号。身份要对，先请3号把没讲清的点补清，再把昨晚信息说完整。",
      evidence: [],
      maxChars: 130,
    },
    {
      enabled: true,
      provider: "openai-compatible",
      transport: async () => JSON.stringify({ text: "3号：嗯，昨晚我在钟楼遇到了一个陌生人，看起来有些神秘。" }),
    }
  );
  assert.equal(hallucinatedNight.ok, true, hallucinatedNight.reason);
  assert.equal(hallucinatedNight.repaired, true);
  assert.match(hallucinatedNight.reason, /target-speaker-prefix|prompt-like-output|unsupported-night-info/);
  assert.match(hallucinatedNight.text, /3号/);
  assert.doesNotMatch(hallucinatedNight.text, /钟楼|陌生人|神秘|^3号[：:]/);

  const reportTone = await renderSpeechWithLocalLLM(
    {
      ...basePayload,
      speakerName: "1号",
      targetName: "7号",
      requiredTerms: ["7号"],
      audience: "public",
      intent: "public_table_talk",
      candidateText: "我的意思是，台面上，7号这边公开信息还不够，先听回应和票型。",
      evidence: [],
      maxChars: 130,
    },
    {
      enabled: true,
      provider: "openai-compatible",
      transport: async () => JSON.stringify({ text: "在公聊中，7号提到了票型。" }),
    }
  );
  assert.equal(reportTone.ok, true, reportTone.reason);
  assert.equal(reportTone.repaired, true);
  assert.match(reportTone.reason, /prompt-like-output/);
  assert.match(reportTone.text, /7号/);
  assert.doesNotMatch(reportTone.text, /在公聊中|提到了票型/);
}

async function testRendererUsesLocalRewriteWhenRetryStillCopies() {
  const result = await renderSpeechWithLocalLLM(basePayload, {
    enabled: true,
    provider: "openai-compatible",
    transport: async () => JSON.stringify({ text: basePayload.candidateText }),
  });
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.retryUsed, true);
  assert.equal(result.source, "local-rewrite");
  assert.equal(result.reason, "near-copy-local-rewrite");
  assert.match(result.text, /7号/);
  assert.notEqual(result.text, basePayload.candidateText);
}

async function testRendererFallsBackOnLeak() {
  const result = await renderSpeechWithLocalLLM(basePayload, {
    enabled: true,
    provider: "openai-compatible",
    transport: async () => JSON.stringify({ text: "7号是洗衣妇真实身份，直接出。" }),
  });
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.repaired, true);
  assert.equal(result.fallbackUsed, false);
  assert.match(result.reason, /forbidden-term/);
  assert.doesNotMatch(result.text, /洗衣妇真实身份/);
}

async function testRendererFallsBackWhenDisabled() {
  const result = await renderSpeechWithLocalLLM(basePayload, {
    enabled: false,
  });
  assert.equal(result.ok, false);
  assert.equal(result.fallbackUsed, true);
  assert.match(result.text, /7号/);
}

async function testFallbackSanitizesAndRestoresTarget() {
  const result = await renderSpeechWithLocalLLM(
    {
      ...basePayload,
      candidateText: "这条证据线里有 PRIVATE_SECRET_MARKER，先听回应。",
      fallbackText: "这条证据线里有 PRIVATE_SECRET_MARKER，先听回应。",
    },
    {
      enabled: false,
    }
  );
  assert.equal(result.fallbackUsed, true);
  assert.match(result.text, /7号/);
  assert.doesNotMatch(result.text, /PRIVATE_SECRET_MARKER|证据线/);
}

async function testFallbackLocalizesNominationTemplate() {
  const result = await renderSpeechWithLocalLLM(
    {
      ...basePayload,
      candidateText: "1号 nominates 7号（你）",
      fallbackText: "1号 nominates 7号（你）",
      intent: "nomination_reason",
      audience: "nomination",
    },
    {
      enabled: false,
    }
  );
  assert.equal(result.fallbackUsed, true);
  assert.match(result.text, /1号提名7号（你）/);
  assert.doesNotMatch(result.text, /nominates/);
}

async function testFallbackKeepsPrivateNoNewInfoNatural() {
  const result = await renderSpeechWithLocalLLM(
    {
      ...basePayload,
      targetName: "你",
      audience: "private",
      intent: "private_reply",
      candidateText: "我昨晚没有新的硬信息，但我的身份需要今天的处决结果来验证。现在更想看谁急着把票堆起来。",
      fallbackText: "我昨晚没有新的硬信息，但我的身份需要今天的处决结果来验证。现在更想看谁急着把票堆起来。",
      requiredTerms: [],
      maxChars: 170,
    },
    {
      enabled: false,
    }
  );
  assert.equal(result.fallbackUsed, true);
  assert.match(result.text, /没有新信息/);
  assert.match(result.text, /处决结果/);
  assert.doesNotMatch(result.text, /没有新的，但/);
}

const protectedNightInfoCases = [
  {
    id: "washerwoman",
    roleName: "洗衣妇",
    draft: "我是洗衣妇，昨晚拿到 2号 与 3号 中有一位是洗衣妇。",
    dropSeats: "我是洗衣妇，昨晚拿到的信息我先不点具体座位。",
    wrongRole: "我是图书管理员，昨晚拿到 2号 与 3号 中有一位是图书管理员。",
  },
  {
    id: "librarian",
    roleName: "图书管理员",
    draft: "我是图书管理员，昨晚拿到 4号 与 5号 中有一位是圣徒。",
    dropSeats: "我是图书管理员，昨晚拿到两人中有一位是圣徒，但先不点具体座位。",
    wrongRole: "我是洗衣妇，昨晚拿到 4号 与 5号 中有一位是洗衣妇。",
  },
  {
    id: "investigator",
    roleName: "调查员",
    draft: "我是调查员，昨晚拿到 6号 与 7号 中有一位是男爵。",
    dropSeats: "我是调查员，昨晚拿到两人中有一位是男爵，但先不点具体座位。",
    wrongRole: "我是占卜师，昨晚拿到 6号 与 7号 中有一位是占卜师。",
  },
  {
    id: "fortune-teller",
    roleName: "占卜师",
    draft: "我是占卜师，昨晚查到 2号 与 8号 不是恶魔。",
    dropSeats: "我是占卜师，昨晚查到不是恶魔，但先不点具体座位。",
    wrongRole: "我是共情者，昨晚查到 2号 与 8号 不是恶魔。",
  },
  {
    id: "empath",
    roleName: "共情者",
    draft: "我是共情者，昨晚查到 2号 与 4号 两侧存活邻居中有 1 位邪恶。",
    dropSeats: "我是共情者，昨晚查到两侧存活邻居中有 1 位邪恶，但先不点座位。",
    wrongRole: "我是厨师，昨晚查到 2号 与 4号 两侧存活邻居中有 1 位邪恶。",
  },
];

async function renderProtectedBadLLMCase(testCase, badText, overrides = {}) {
  return renderSpeechWithLocalLLM(
    {
      ...basePayload,
      speakerName: "5号",
      targetName: overrides.targetName ?? "你",
      audience: "private",
      intent: "night",
      persona: "steady",
      candidateText: testCase.draft,
      fallbackText: testCase.draft,
      evidence: [],
      requiredTerms: overrides.requiredTerms ?? [],
      forbiddenTerms: ["PRIVATE_SECRET_MARKER"],
      maxChars: 180,
    },
    {
      enabled: true,
      provider: "openai-compatible",
      transport: async () => JSON.stringify({ text: badText }),
    }
  );
}

async function testProtectedNightInfoFactsRejectBadLLMAndFallbackToDraft() {
  for (const testCase of protectedNightInfoCases) {
    const deletedSeat = await renderProtectedBadLLMCase(testCase, testCase.dropSeats);
    assert.equal(deletedSeat.fallbackUsed, true, `${testCase.id}: deleted seats should fall back`);
    assert.match(deletedSeat.reason, /missing-protected-fact:seat/, `${testCase.id}: ${deletedSeat.reason}`);
    assert.equal(deletedSeat.text, testCase.draft, `${testCase.id}: deleted-seat fallback should preserve deterministic draft`);

    const wrongRole = await renderProtectedBadLLMCase(testCase, testCase.wrongRole);
    assert.equal(wrongRole.fallbackUsed, true, `${testCase.id}: wrong role should fall back`);
    assert.match(wrongRole.reason, /missing-protected-fact:role/, `${testCase.id}: ${wrongRole.reason}`);
    assert.equal(wrongRole.text, testCase.draft, `${testCase.id}: wrong-role fallback should preserve deterministic draft`);

    const generic = await renderProtectedBadLLMCase(testCase, "我有信息，但先不说具体内容，等公聊反应出来再看。");
    assert.equal(generic.fallbackUsed, true, `${testCase.id}: generic withheld info should fall back`);
    assert.match(generic.reason, /missing-protected-fact:(role|seat|relation|count)/, `${testCase.id}: ${generic.reason}`);
    assert.equal(generic.text, testCase.draft, `${testCase.id}: generic fallback should preserve deterministic draft`);
  }
}

async function testProtectedNightInfoIgnoresPrivateSeatYouTargetName() {
  const washerwoman = protectedNightInfoCases[0];
  const prompt = buildLLMRendererPrompt({
    ...basePayload,
    targetName: "3号（你）",
    audience: "private",
    intent: "night",
    candidateText: washerwoman.draft,
    requiredTerms: ["3号（你）"],
  });
  assert.equal(prompt.payload.targetName, "");
  assert.deepEqual(prompt.payload.requiredTerms, []);
  assert.equal(prompt.payload.protectedFacts.active, true);

  const result = await renderProtectedBadLLMCase(washerwoman, "我是洗衣妇，我有信息但先不说。", {
    targetName: "3号（你）",
    requiredTerms: ["3号（你）"],
  });
  assert.equal(result.fallbackUsed, true);
  assert.equal(result.text, washerwoman.draft);
  assert.doesNotMatch(result.text, /^3号（你）/);
}

async function testFallbackDoesNotReturnLongPublicReportDraft() {
  const result = await renderSpeechWithLocalLLM(
    {
      ...basePayload,
      speakerName: "2号",
      targetName: "6号",
      requiredTerms: ["6号"],
      audience: "public",
      intent: "public_table_talk",
      candidateText:
        "我不无理由改口，镇长这条继续放桌面上。公开身份：镇长。6号这条先留桌面上，卡在前面发言没讲清楚，我会问6号：身份和昨晚信息，6号和1号差距不大，我先处理更容易被追问验证的 6号。这条让6号把身份对上，昨晚信息也要补清。",
      fallbackText:
        "我不无理由改口，镇长这条继续放桌面上。公开身份：镇长。6号这条先留桌面上，卡在前面发言没讲清楚，我会问6号：身份和昨晚信息，6号和1号差距不大，我先处理更容易被追问验证的 6号。这条让6号把身份对上，昨晚信息也要补清。",
      evidence: ["2号公聊提到：我不无理由改口，镇长这条继续放桌面上。公开身份：镇长。"],
      maxChars: 130,
    },
    {
      enabled: false,
    }
  );
  assert.equal(result.fallbackUsed, true);
  assert.match(result.text, /6号/);
  assert.ok(result.text.length <= 70, `fallback should stay table-speak short, got ${result.text.length}: ${result.text}`);
  assert.doesNotMatch(result.text, /差距不大|公开线索更多|第二独立来源|这条继续放桌面上/);
}

async function testFallbackLocalizesContractNominationTemplate() {
  const result = await renderSpeechWithLocalLLM(
    {
      ...basePayload,
      targetName: "3号",
      requiredTerms: ["3号"],
      candidateText: "Contract nomination for dead-human ghost vote control.",
      fallbackText: "Contract nomination for dead-human ghost vote control.",
      intent: "nomination_reason",
      audience: "nomination",
      maxChars: 120,
    },
    {
      enabled: false,
    }
  );
  assert.equal(result.fallbackUsed, true);
  assert.match(result.text, /3号/);
  assert.match(result.text, /幽灵票|死者票|票/);
  assert.doesNotMatch(result.text, /Contract nomination|ghost vote control/i);
}

await testPromptOnlyContainsSafePayload();
testPrivateHumanRecipientIsNotPressureTarget();
testRendererDefaultsToOllamaWhenOnlyEnabled();
testRendererPrefersOpenAICompatibleEndpoint();
await testValidationRejectsForbiddenTerms();
await testValidationRejectsMissingTarget();
await testValidationRejectsSpeakerPrefix();
await testValidationRejectsStitchingArtifacts();
await testValidationRejectsBareTargetOnlyOutput();
await testValidationRejectsPromptLikeOutput();
testValidationRejectsPackageTargetPronounLeak();
await testValidationRejectsDroppedSelfDisclosureBoundary();
testSimilarityScoresNearCopies();
await testMockRendererProducesSafeSpeech();
await testMockRendererDoesNotPressurePrivateRecipient();
await testMockRendererPreservesPrivateFocusSuggestion();
await testMockRendererUsesMultiEvidenceAnchor();
await testMockRendererUsesNaturalDeathEvidence();
await testMockRendererUsesTableStanceEvidence();
await testMockRendererUsesCandidateFocusWithoutEvidence();
await testMockRendererVariesRepeatedPublicPressure();
await testRendererRetriesNearCopy();
await testRendererRepairsMissingVisibleTarget();
await testRendererRepairsSpeakerPrefix();
await testRendererRepairsStitchingArtifacts();
await testRendererGroundsVagueEvidenceLine();
await testRendererRepairsBareTargetOnlyOutput();
await testRendererRepairsPromptLikeOutput();
await testRendererRepairsVagueNoEvidenceLine();
await testRendererRepairsGenericPrivateExecutionVerification();
await testRendererRepairsDroppedSelfDisclosureBoundary();
await testRendererPreservesPublicRoleClaimWhenTinyModelGeneric();
await testRendererRepairsSelfClaimTargetResponseDrift();
await testRendererKeepsSelfClaimResponseGenericWithReplayEvidence();
await testRendererKeepsSelfDisclosureResponseGenericWithReplayEvidence();
await testRendererVariesIdentityInfoRepairByCandidateAnchor();
await testRendererPreservesPublicExecutionRangeAsShortFallback();
await testRendererPreservesPrivateMultiSeatAsk();
await testRendererRepairsSpeakerTargetConfusion();
await testRendererRepairsUnsupportedNightInfoDrift();
await testRendererRepairsUnsupportedDeathInfoDrift();
await testRendererRepairsTableTalkDrift();
await testRendererRepairsGenericQuestionDrift();
await testRendererRepairsPackagePromptLeak();
await testRendererRepairsPackageNeedToSpeakLeak();
await testRendererRepairsPackageQuestionnaireLeak();
await testRendererRepairsPackagePoliteQuestionLeak();
await testRendererRepairsPackageDebateStyleLeak();
await testRendererRepairsLiveAuditAssistantAndHallucinationLeaks();
await testRendererUsesLocalRewriteWhenRetryStillCopies();
await testRendererFallsBackOnLeak();
await testRendererFallsBackWhenDisabled();
await testFallbackSanitizesAndRestoresTarget();
await testFallbackLocalizesNominationTemplate();
await testFallbackKeepsPrivateNoNewInfoNatural();
await testProtectedNightInfoFactsRejectBadLLMAndFallbackToDraft();
await testProtectedNightInfoIgnoresPrivateSeatYouTargetName();
await testFallbackDoesNotReturnLongPublicReportDraft();
await testFallbackLocalizesContractNominationTemplate();

console.log("ai llm renderer contracts ok");
