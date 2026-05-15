const DEFAULT_BANNED_PHRASES = [
  "接前面一句",
  "我接一下前面的发言",
  "口径",
  "证据线",
  "当前主线",
  "低证据",
  "agentView",
  "evidenceContract",
  "JS Core",
  "undefined",
  "NaN",
];

const DEFAULT_OPENAI_ENDPOINT = "http://127.0.0.1:8080/v1/chat/completions";
const DEFAULT_OLLAMA_ENDPOINT = "http://127.0.0.1:11434/api/generate";
const DEFAULT_NEAR_COPY_THRESHOLD = 0.88;

function compactText(value, limit = 240) {
  const text = `${value ?? ""}`.replace(/\s+/g, " ").trim();
  return text.length > limit ? `${text.slice(0, Math.max(0, limit - 1)).trim()}…` : text;
}

function removeTerms(value, terms) {
  let text = `${value ?? ""}`;
  unique(terms).forEach((term) => {
    text = text.split(term).join("");
  });
  return text.replace(/\s+/g, " ").trim();
}

function unique(values) {
  return [...new Set((values ?? []).map((entry) => `${entry ?? ""}`.trim()).filter(Boolean))];
}

function normalizeProvider(value) {
  const provider = `${value ?? process.env.BOTC_LLM_PROVIDER ?? ""}`.trim().toLowerCase();
  if (["ollama", "openai", "openai-compatible", "mock"].includes(provider)) {
    return provider === "openai" ? "openai-compatible" : provider;
  }
  if (process.env.BOTC_LLM_MOCK === "1") return "mock";
  if (process.env.BOTC_LLM_ENDPOINT) return "openai-compatible";
  if (process.env.BOTC_LLM_OLLAMA_MODEL) return "ollama";
  if (process.env.BOTC_LLM_RENDERER === "1") return "ollama";
  return "openai-compatible";
}

function numberOption(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

export function resolveLLMRendererConfig(options = {}) {
  const provider = normalizeProvider(options.provider);
  const timeoutMs = numberOption(options.timeoutMs ?? process.env.BOTC_LLM_TIMEOUT_MS, 1400);
  const endpoint = provider === "ollama"
    ? options.endpoint ?? process.env.BOTC_LLM_OLLAMA_ENDPOINT ?? DEFAULT_OLLAMA_ENDPOINT
    : provider === "mock"
      ? ""
      : options.endpoint ?? process.env.BOTC_LLM_ENDPOINT ?? DEFAULT_OPENAI_ENDPOINT;
  const model = provider === "ollama"
    ? options.model ?? process.env.BOTC_LLM_OLLAMA_MODEL ?? process.env.BOTC_LLM_MODEL ?? "qwen2.5:3b"
    : provider === "mock"
      ? "mock"
      : options.model ?? process.env.BOTC_LLM_MODEL ?? "local-model";
  return {
    enabled: options.enabled === true || process.env.BOTC_LLM_RENDERER === "1",
    provider,
    endpoint,
    model,
    timeoutMs,
  };
}

function intentLabel(intent) {
  return {
    reason: "解释怀疑或信任",
    private_reply: "私聊回答",
    pressure_question: "公开追问",
    public_table_talk: "公聊表态",
    nomination_reason: "提名理由",
    nomination_debate: "互辩发言",
    claim: "说明身份说法",
    vote: "解释投票倾向",
    plan: "说明下一步计划",
  }[intent] ?? "桌边发言";
}

function personaGuide(persona) {
  return {
    pressure: "偏主动，短句施压，要求对方给出可核验信息。",
    steady: "偏稳健，先留余地，再指出需要复核的点。",
    shadow: "偏观察票型和改口，语气谨慎但会抓矛盾。",
    social: "偏社交，少下结论，多问对方信息来源。",
    evil: "像普通玩家一样自然发言，不暴露阵营，不说自己在表演。",
  }[persona] ?? "像普通桌游玩家一样简短自然。";
}

function audienceGuide(audience) {
  if (audience === "public") return "这是公聊，不能透露私聊原文，只能说公开可说的判断。";
  if (audience === "nomination") return "这是提名或互辩，语气可以更集中，但仍要留出投票判断空间。";
  return "这是私聊，可以更直接，但不要说系统术语。";
}

export function buildLLMRenderPayload(input = {}) {
  const maxChars = Number.isFinite(input.maxChars) ? input.maxChars : input.audience === "public" ? 120 : 160;
  return {
    speakerName: `${input.speakerName ?? ""}`.trim(),
    targetName: `${input.targetName ?? ""}`.trim(),
    audience: `${input.audience ?? "private"}`.trim(),
    intent: `${input.intent ?? "generic"}`.trim(),
    persona: `${input.persona ?? "steady"}`.trim(),
    tone: `${input.tone ?? "像桌游玩家，短句，别像系统报告"}`.trim(),
    candidateText: compactText(input.candidateText, 320),
    evidence: unique(input.evidence).slice(0, 3).map((entry) => compactText(entry, 90)),
    requiredTerms: unique(input.requiredTerms).slice(0, 5),
    forbiddenTerms: unique([...(input.forbiddenTerms ?? []), ...DEFAULT_BANNED_PHRASES]).slice(0, 48),
    maxChars,
    rewriteAttempt: Number.isFinite(input.rewriteAttempt) ? input.rewriteAttempt : 1,
    copyAvoidance: !!input.copyAvoidance,
  };
}

function buildVisibleFacts(payload) {
  const facts = [];
  if (payload.targetName) facts.push(`发言需要明确提到目标：${payload.targetName}`);
  if (payload.evidence.length > 0) {
    payload.evidence.forEach((entry) => facts.push(`可见线索：${entry}`));
  } else {
    facts.push("目前硬信息不足，应该说成先听回应或暂不定死。");
  }
  if (payload.candidateText) facts.push(`原始草稿含义：${payload.candidateText}`);
  return facts;
}

export function buildLLMRendererPrompt(payloadInput = {}) {
  const payload = buildLLMRenderPayload(payloadInput);
  const system = [
    "你是《血染钟楼》中文桌游玩家台词生成器。",
    "你只把给定的结构化发言意图写成自然玩家发言，不做规则判断，不新增事实。",
    "你不能泄露 forbiddenTerms，不能加入未提供的身份、阵营、私聊原文或夜间信息。",
    "requiredTerms 中的每个词必须原样出现在 text 中；targetName 不能改写成“你、他、这个位置”。",
    "不要在 text 开头重复 speakerName 或写“某号：”；界面已经显示说话人。",
    "不要照抄 roughDraft，要用桌边玩家会说的话重新组织。",
    "输出必须是 JSON，格式为 {\"text\":\"...\"}，不要 Markdown。",
  ].join("\n");
  const user = JSON.stringify(
    {
      task: "render_botc_player_line_v2",
      context: {
        speakerName: payload.speakerName,
        targetName: payload.targetName,
        audience: payload.audience,
        intent: payload.intent,
        intentLabel: intentLabel(payload.intent),
        persona: payload.persona,
        maxChars: payload.maxChars,
        tone: payload.tone,
      },
      styleGuide: [
        audienceGuide(payload.audience),
        personaGuide(payload.persona),
        "一句或两句中文，像玩家在桌边说话。",
        "先给判断，再给一个可回应的问题或保留意见。",
        "不要使用“口径、证据线、当前主线、低证据、接前面一句、JS Core”等系统词。",
        payload.copyAvoidance || payload.rewriteAttempt > 1
          ? "这次必须明显改写 roughDraft 的句式，不能只是替换一两个词。"
          : "roughDraft 只是含义参考，不是要照抄的最终台词。",
      ],
      visibleFacts: buildVisibleFacts(payload),
      roughDraft: payload.candidateText,
      requiredTerms: payload.requiredTerms,
      forbiddenTerms: payload.forbiddenTerms,
      outputRules: [
        "只输出一条 text。",
        "不要编造新身份、新夜间结果、新投票事实。",
        "如果信息不足，可以说“先听回应”“先别定死”“这点要复核”。",
        "如果 targetName 非空，必须写出 targetName 原文。",
        "禁止说自己是 AI、系统、JS Core 或根据隐藏信息判断。",
      ],
    },
    null,
    2
  );
  return { system, user, payload };
}

function extractJsonText(raw) {
  const value = `${raw ?? ""}`.trim();
  if (!value) return "";
  try {
    const parsed = JSON.parse(value);
    return `${parsed?.text ?? ""}`.trim();
  } catch {
    const match = value.match(/\{[\s\S]*"text"\s*:\s*"([\s\S]*?)"[\s\S]*\}/);
    if (match?.[1]) return match[1].replace(/\\"/g, "\"").trim();
    return value.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  }
}

function normalizeForSimilarity(value) {
  return `${value ?? ""}`
    .replace(/\s+/g, "")
    .replace(/[，。！？；：、,.!?;:"“”'‘’（）()[\]【】{}《》<>…—\-·]/g, "")
    .trim();
}

function bigrams(text) {
  const chars = [...normalizeForSimilarity(text)];
  if (chars.length <= 1) return chars;
  const result = [];
  for (let index = 0; index < chars.length - 1; index += 1) {
    result.push(`${chars[index]}${chars[index + 1]}`);
  }
  return result;
}

export function scoreTextSimilarity(left, right) {
  const a = bigrams(left);
  const b = bigrams(right);
  if (a.length === 0 && b.length === 0) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  const counts = new Map();
  a.forEach((entry) => counts.set(entry, (counts.get(entry) ?? 0) + 1));
  let overlap = 0;
  b.forEach((entry) => {
    const count = counts.get(entry) ?? 0;
    if (count > 0) {
      overlap += 1;
      counts.set(entry, count - 1);
    }
  });
  return (2 * overlap) / (a.length + b.length);
}

function nearCopyDetails(text, candidateText, threshold = DEFAULT_NEAR_COPY_THRESHOLD) {
  const normalizedCandidate = normalizeForSimilarity(candidateText);
  if (normalizedCandidate.length < 14) {
    return { nearCopy: false, similarity: 0 };
  }
  const similarity = scoreTextSimilarity(text, candidateText);
  return { nearCopy: similarity >= threshold, similarity };
}

export function validateLLMRenderedSpeech(text, payloadInput = {}, options = {}) {
  const payload = buildLLMRenderPayload(payloadInput);
  const value = `${text ?? ""}`.replace(/\s+/g, " ").trim();
  if (!value) return { ok: false, reason: "empty-output", text: "" };
  if (value.length > payload.maxChars + 24) {
    return { ok: false, reason: "too-long", text: value };
  }
  const banned = unique([...(payload.forbiddenTerms ?? []), ...(options.extraForbiddenTerms ?? [])]);
  const leaked = banned.find((term) => term && value.includes(term));
  if (leaked) return { ok: false, reason: `forbidden-term:${leaked}`, text: value };
  const required = unique(payload.requiredTerms);
  const missing = required.find((term) => !value.includes(term));
  if (missing) return { ok: false, reason: `missing-required-term:${missing}`, text: value };
  if (payload.speakerName) {
    const escaped = payload.speakerName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`^\\s*${escaped}\\s*[：:，,。.]`).test(value)) {
      return { ok: false, reason: `speaker-prefix:${payload.speakerName}`, text: value };
    }
  }
  if (payload.targetName && options.requireTarget !== false && !value.includes(payload.targetName)) {
    return { ok: false, reason: `missing-target:${payload.targetName}`, text: value };
  }
  if (options.rejectNearCopy === true) {
    const copy = nearCopyDetails(value, payload.candidateText, options.nearCopyThreshold);
    if (copy.nearCopy) {
      return { ok: false, reason: `near-copy:${copy.similarity.toFixed(2)}`, text: value, ...copy };
    }
  }
  return { ok: true, reason: "", text: value };
}

function makeSafeFallbackText(payloadInput = {}, raw = "") {
  const payload = buildLLMRenderPayload(payloadInput);
  const banned = unique(payload.forbiddenTerms);
  let value = removeTerms(raw || payload.candidateText || "我先听回应。", banned);
  value = value || "我先听回应。";
  unique(payload.requiredTerms).forEach((term) => {
    if (term && !value.includes(term)) value = `${term}这边，${value}`;
  });
  if (payload.targetName && !value.includes(payload.targetName)) value = `${payload.targetName}这边，${value}`;
  return compactText(value, payload.maxChars);
}

async function fetchWithTimeout(url, request, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(100, timeoutMs));
  try {
    return await fetch(url, { ...request, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function callOpenAICompatible(prompt, options = {}) {
  const endpoint = options.endpoint ?? process.env.BOTC_LLM_ENDPOINT ?? DEFAULT_OPENAI_ENDPOINT;
  const model = options.model ?? process.env.BOTC_LLM_MODEL ?? "local-model";
  const response = await fetchWithTimeout(
    endpoint,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(process.env.BOTC_LLM_API_KEY ? { authorization: `Bearer ${process.env.BOTC_LLM_API_KEY}` } : {}),
      },
      body: JSON.stringify({
        model,
        temperature: Number.isFinite(options.temperature) ? options.temperature : 0.45,
        max_tokens: Number.isFinite(options.maxTokens) ? options.maxTokens : 128,
        messages: [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.user },
        ],
      }),
    },
    options.timeoutMs ?? 1400
  );
  if (!response.ok) throw new Error(`openai-compatible ${response.status}`);
  const json = await response.json();
  return json?.choices?.[0]?.message?.content ?? "";
}

async function callOllama(prompt, options = {}) {
  const endpoint = options.endpoint ?? process.env.BOTC_LLM_OLLAMA_ENDPOINT ?? DEFAULT_OLLAMA_ENDPOINT;
  const model = options.model ?? process.env.BOTC_LLM_OLLAMA_MODEL ?? process.env.BOTC_LLM_MODEL ?? "qwen2.5:3b";
  const response = await fetchWithTimeout(
    endpoint,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model,
        prompt: `${prompt.system}\n\n${prompt.user}`,
        stream: false,
        format: "json",
        options: {
          temperature: Number.isFinite(options.temperature) ? options.temperature : 0.35,
          num_predict: Number.isFinite(options.maxTokens) ? options.maxTokens : 128,
        },
      }),
    },
    options.timeoutMs ?? 1400
  );
  if (!response.ok) throw new Error(`ollama ${response.status}`);
  const json = await response.json();
  return json?.response ?? "";
}

async function callMock(prompt) {
  const data = JSON.parse(prompt.user);
  const target = data.context?.targetName || "这个位置";
  const evidence = data.visibleFacts?.find((entry) => entry.startsWith("可见线索："))?.replace("可见线索：", "");
  const line = data.styleGuide?.some((entry) => entry.includes("必须明显改写"))
    ? `${target}先别急着过，我要听他把身份和信息来源说完整。`
    : `${target}这点我先放不下，${compactText(evidence || "先听回应", 34)}，先让他讲清楚。`;
  return JSON.stringify({ text: line });
}

async function callProvider(provider, prompt, options = {}) {
  if (options.transport) return options.transport(prompt, options);
  if (provider === "mock") return callMock(prompt, options);
  if (provider === "ollama") return callOllama(prompt, options);
  return callOpenAICompatible(prompt, options);
}

function resultFromValidation(validation, provider, prompt, extra = {}) {
  return {
    ok: true,
    text: validation.text,
    source: provider,
    fallbackUsed: false,
    reason: extra.reason ?? "",
    payload: prompt.payload,
    nearCopy: !!extra.nearCopy,
    similarity: Number.isFinite(extra.similarity) ? extra.similarity : 0,
    retryUsed: !!extra.retryUsed,
  };
}

export async function renderSpeechWithLocalLLM(payloadInput = {}, options = {}) {
  const prompt = buildLLMRendererPrompt(payloadInput);
  const fallbackText = makeSafeFallbackText(prompt.payload, payloadInput.fallbackText ?? payloadInput.candidateText);
  const fallback = {
    ok: false,
    text: fallbackText,
    source: "fallback",
    fallbackUsed: true,
    reason: "disabled",
    payload: prompt.payload,
    nearCopy: false,
    similarity: 0,
    retryUsed: false,
  };
  const config = resolveLLMRendererConfig(options);
  if (options.enabled === false || !config.enabled) return fallback;

  const provider = config.provider;
  const providerOptions = {
    ...options,
    endpoint: options.endpoint ?? config.endpoint,
    model: options.model ?? config.model,
    timeoutMs: options.timeoutMs ?? config.timeoutMs,
  };

  try {
    const raw = await callProvider(provider, prompt, providerOptions);
    const text = extractJsonText(raw);
    const validation = validateLLMRenderedSpeech(text, prompt.payload, options);
    if (!validation.ok) {
      return { ...fallback, reason: validation.reason, rejectedText: validation.text, source: provider };
    }

    const copy = nearCopyDetails(validation.text, prompt.payload.candidateText, options.nearCopyThreshold);
    if (copy.nearCopy && options.retryOnNearCopy !== false) {
      const retryPrompt = buildLLMRendererPrompt({
        ...payloadInput,
        rewriteAttempt: 2,
        copyAvoidance: true,
      });
      const retryRaw = await callProvider(provider, retryPrompt, {
        ...providerOptions,
        temperature: Number.isFinite(providerOptions.temperature) ? Math.min(0.8, providerOptions.temperature + 0.15) : 0.55,
        maxTokens: Number.isFinite(providerOptions.maxTokens) ? Math.max(128, providerOptions.maxTokens) : 144,
      });
      const retryText = extractJsonText(retryRaw);
      const retryValidation = validateLLMRenderedSpeech(retryText, retryPrompt.payload, options);
      if (retryValidation.ok) {
        const retryCopy = nearCopyDetails(retryValidation.text, retryPrompt.payload.candidateText, options.nearCopyThreshold);
        return resultFromValidation(retryValidation, provider, retryPrompt, {
          reason: retryCopy.nearCopy ? "near-copy-retry-accepted" : "retry-near-copy",
          retryUsed: true,
          ...retryCopy,
        });
      }
    }

    return resultFromValidation(validation, provider, prompt, copy.nearCopy ? { reason: "near-copy", ...copy } : copy);
  } catch (error) {
    return {
      ...fallback,
      source: provider,
      reason: error?.name === "AbortError" ? "timeout" : error?.message ?? "llm-error",
    };
  }
}
