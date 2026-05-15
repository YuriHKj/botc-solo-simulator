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
  candidateText: "7号可以进提名池，但我先听一句回应。发言要回看。",
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
  const userPayload = JSON.parse(user);
  assert.ok(
    userPayload.styleGuide.some((rule) => rule.includes("roughDraft") || rule.includes("明显改写")),
    "prompt should tell small local models not to copy the rough draft"
  );
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
  assert.doesNotMatch(result.text, /口径|接前面一句|PRIVATE_SECRET_MARKER/);
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

async function testRendererFallsBackOnLeak() {
  const result = await renderSpeechWithLocalLLM(basePayload, {
    enabled: true,
    provider: "openai-compatible",
    transport: async () => JSON.stringify({ text: "7号是洗衣妇真实身份，直接出。" }),
  });
  assert.equal(result.ok, false);
  assert.equal(result.fallbackUsed, true);
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

await testPromptOnlyContainsSafePayload();
testRendererDefaultsToOllamaWhenOnlyEnabled();
testRendererPrefersOpenAICompatibleEndpoint();
await testValidationRejectsForbiddenTerms();
await testValidationRejectsMissingTarget();
await testValidationRejectsSpeakerPrefix();
testSimilarityScoresNearCopies();
await testMockRendererProducesSafeSpeech();
await testRendererRetriesNearCopy();
await testRendererFallsBackOnLeak();
await testRendererFallsBackWhenDisabled();
await testFallbackSanitizesAndRestoresTarget();

console.log("ai llm renderer contracts ok");
