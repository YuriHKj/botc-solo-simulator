import { PLAYER_VISIBLE_FORBIDDEN_TERMS, sanitizePlayerVisibleText } from "./ai_speech_renderer.js";

const DEFAULT_BANNED_PHRASES = [
  ...PLAYER_VISIBLE_FORBIDDEN_TERMS,
  "接前面一句",
  "我接一下前面的发言",
  "口径",
  "证据线",
  "当前主线",
  "低证据",
  "复核",
  "硬信息",
  "那件事",
  "agentView",
  "evidenceContract",
  "JS Core",
  "undefined",
  "NaN",
];

const DEFAULT_OPENAI_ENDPOINT = "http://127.0.0.1:8080/v1/chat/completions";
const DEFAULT_OLLAMA_ENDPOINT = "http://127.0.0.1:11434/api/generate";
const DEFAULT_NEAR_COPY_THRESHOLD = 0.88;
const REPAIRABLE_VAGUE_TERMS = ["那件事"];
const PROTECTED_FACT_ROLE_NAMES = [
  "洗衣妇",
  "图书管理员",
  "调查员",
  "占卜师",
  "共情者",
  "厨师",
  "守鸦人",
  "送葬者",
  "圣徒",
  "酒鬼",
  "男爵",
  "投毒者",
  "间谍",
  "小恶魔",
  "管家",
  "隐士",
  "杀手",
  "士兵",
  "僧侣",
  "处女",
  "市长",
  "镇长",
  "恶魔",
  "爪牙",
  "外来者",
];

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

function cleanRenderedSpacing(value) {
  return `${value ?? ""}`
    .replace(/([0-9]+)\s+号/g, "$1号")
    .replace(/([0-9]+号)\s+(这边|那条|放进|进|被|先|需要|可以|把|回应|解释|讲|说|问)/g, "$1$2")
    .replace(/([：。！？；])\s+/g, "$1")
    .replace(/\s+([，。；！？：])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function renderedArtifactReason(value) {
  const text = `${value ?? ""}`;
  const openParen = (text.match(/[（(]/g) ?? []).length;
  const closeParen = (text.match(/[）)]/g) ?? []).length;
  if (/复…|[（(][^）)]*…/.test(text) || openParen !== closeParen) return "stitching-artifact";
  if (/^\s*\{?\s*"text"\s*:/.test(text) || /】{3,}/.test(text)) return "stitching-artifact";
  if (/^\s*[0-9]+\s*号】/.test(text)) return "stitching-artifact";
  if (/[0-9]+\s+号|[0-9]+号\s+(这边|那条|放进|进|被|先|需要|可以|把|回应|解释|讲|说|问)/.test(text)) {
    return "stitching-artifact";
  }
  if (/[：。！？；]\s+|。，|，。|。。|，，/.test(text)) return "stitching-artifact";
  return "";
}

function repairRenderedArtifacts(value) {
  return cleanRenderedSpacing(value)
    .replace(/[（(][^，。；！？)]*复…[，,]?/g, "")
    .replace(/复…/g, "先听回应")
    .replace(/[（）()]/g, "")
    .replace(/([，。；！？]){2,}/g, "$1")
    .replace(/^[，。；！？]+/g, "")
    .trim();
}

function unique(values) {
  return [...new Set((values ?? []).map((entry) => `${entry ?? ""}`.trim()).filter(Boolean))];
}

function compactForProtectedFacts(value) {
  return cleanRenderedSpacing(value).replace(/\s+/g, "");
}

function isPrivateHumanContextLabel(value) {
  const text = compactForProtectedFacts(value);
  return text === "你" || /^[0-9]+号[（(]你[）)]$/u.test(text);
}

function protectedFactSeatLabels(text) {
  return unique([...`${text ?? ""}`.matchAll(/[0-9]+\s*号/g)].map((match) => match[0].replace(/\s+/g, "")));
}

function protectedFactRoleNames(text) {
  const compact = compactForProtectedFacts(text);
  return PROTECTED_FACT_ROLE_NAMES.filter((role) => compact.includes(role));
}

function protectedFactRelations(text) {
  const value = cleanRenderedSpacing(text);
  const relations = [];
  if (/有\s*一\s*位\s*是/u.test(value)) relations.push("有一位是");
  if (/查到/u.test(value)) relations.push("查到");
  if (/拿到/u.test(value)) relations.push("拿到");
  if (/得知/u.test(value)) relations.push("得知");
  if (/不是|结果\s*[：:]?\s*(?:否|不是)/u.test(value)) relations.push("negative-result");
  return unique(relations);
}

function protectedFactCounts(text) {
  const compact = compactForProtectedFacts(text);
  const counts = [];
  const evilCount = compact.match(/([0-9一二三两]+)位邪恶/u)?.[0] ?? "";
  if (evilCount) counts.push(evilCount);
  return unique(counts);
}

function buildProtectedFacts(candidateText = "", payload = {}) {
  const text = cleanRenderedSpacing(candidateText);
  if (!text || payload.audience !== "private") {
    return { active: false, roles: [], seats: [], relations: [], counts: [] };
  }
  const roles = protectedFactRoleNames(text);
  const seats = protectedFactSeatLabels(text);
  const relations = protectedFactRelations(text);
  const counts = protectedFactCounts(text);
  const hasNightMarker = /第[0-9一二三四五六七八九十]+夜|昨晚|昨夜|夜里|夜间|夜晚|夜间信息|昨晚信息/u.test(text);
  const hasSelfDisclosure = roles.length > 0 && /我是|身份直接摊|身份\s*[：:]/u.test(text);
  const hasHardRelation = relations.length > 0 || counts.length > 0 || /有\s*一\s*位\s*是/u.test(text);
  const active = hasSelfDisclosure || (roles.length > 0 && (hasNightMarker || seats.length > 0 || hasHardRelation)) || (hasNightMarker && hasHardRelation);
  return {
    active,
    roles,
    seats,
    relations,
    counts,
  };
}

function protectedFactsSummary(facts = {}) {
  if (!facts.active) return "";
  const parts = [];
  if (facts.roles?.length) parts.push(`角色：${facts.roles.join("、")}`);
  if (facts.seats?.length) parts.push(`座位：${facts.seats.join("、")}`);
  if (facts.relations?.length) parts.push(`结果关系：${facts.relations.map((entry) => (entry === "negative-result" ? "不是/否" : entry)).join("、")}`);
  if (facts.counts?.length) parts.push(`数量：${facts.counts.join("、")}`);
  return parts.join("；");
}

function protectedRelationPresent(relation, value) {
  const text = cleanRenderedSpacing(value);
  if (relation === "有一位是") return /有\s*一\s*位\s*是/u.test(text);
  if (relation === "查到") return /查到/u.test(text);
  if (relation === "拿到") return /拿到/u.test(text);
  if (relation === "得知") return /得知/u.test(text);
  if (relation === "negative-result") return /不是|结果\s*[：:]?\s*(?:否|不是)|(?:^|[，。；：\s])否(?:[，。；：\s]|$)/u.test(text);
  return relation ? compactForProtectedFacts(value).includes(compactForProtectedFacts(relation)) : true;
}

function missingProtectedFactReason(value, payload = {}) {
  const facts = payload.protectedFacts ?? buildProtectedFacts(payload.candidateText, payload);
  if (!facts.active) return "";
  const compact = compactForProtectedFacts(value);
  const missingRole = (facts.roles ?? []).find((role) => !compact.includes(role));
  if (missingRole) return `missing-protected-fact:role:${missingRole}`;
  const missingSeat = (facts.seats ?? []).find((seat) => !compact.includes(seat));
  if (missingSeat) return `missing-protected-fact:seat:${missingSeat}`;
  const missingRelation = (facts.relations ?? []).find((relation) => !protectedRelationPresent(relation, value));
  if (missingRelation) return `missing-protected-fact:relation:${missingRelation}`;
  const missingCount = (facts.counts ?? []).find((count) => !compact.includes(count));
  if (missingCount) return `missing-protected-fact:count:${missingCount}`;
  return "";
}

function protectedFactFallbackText(payloadInput = {}, raw = "") {
  const payload = buildLLMRenderPayload(payloadInput);
  const facts = payload.protectedFacts ?? buildProtectedFacts(payload.candidateText, payload);
  if (!facts.active) return "";
  const source = `${raw || payload.candidateText || ""}`.trim();
  if (!source) return "";
  return compactText(localizeKnownFallbackTemplates(source), payload.maxChars);
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
    night: "回答夜晚信息",
    suspect: "指出怀疑对象",
    trust: "说明信任判断",
    vote: "解释投票倾向",
    plan: "说明下一步计划",
  }[intent] ?? "桌边发言";
}

function personaGuide(persona) {
  return {
    pressure: "偏主动，短句施压，要求对方给出可核验信息。",
    steady: "偏稳健，先留余地，再指出需要对方讲清楚的点。",
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

const SELF_DISCLOSURE_BOUNDARY_TERMS = [
  "我先给范围",
  "先给范围",
  "给范围",
  "范围",
  "身份范围",
  "可核范围",
  "能追问的边界",
  "保留具体身份",
  "暂时保留",
  "具体身份先",
  "具体身份还留",
  "不把具体身份",
  "不说死",
  "不摊身份",
  "不摊死",
  "早期信息",
  "不完整报身份",
  "不想全部倒",
  "一口气全倒"
];

function hasSelfDisclosureBoundary(candidateText = "") {
  const text = cleanRenderedSpacing(candidateText);
  return /先给范围|身份范围|可核范围|能追问的边界|暂时保留具体身份|保留具体身份|不把具体身份|具体身份.{0,14}(?:不说死|先不|暂时|保留|还留|留一点|不摊|不急|等需要|余地)|身份.{0,10}(?:不说死|先不摊|暂时不说死|先不完整|不完整报)|不摊身份|早期信息|第一[天轮].{0,12}(?:不完整|不想.{0,6}倒)|一口气全倒|不完整报身份/.test(text);
}

function selfDisclosureBoundaryPrefix(candidateText = "") {
  const text = cleanRenderedSpacing(candidateText);
  if (/早期信息|第一[天轮].{0,12}(?:不完整|不想.{0,6}倒)|一口气全倒|不完整报身份/.test(text)) {
    return "我有早期信息，但先只给范围。";
  }
  if (/身份范围|可核范围|先给范围|能追问的边界|范围/.test(text)) {
    return "我先给范围，具体身份先不说死。";
  }
  return "我暂时保留具体身份。";
}

function privateReplyHint(candidateText = "") {
  const text = cleanRenderedSpacing(candidateText);
  if (!text) return "";
  const hasPrivateBoundary = /别替我公开|不要[^。；，,]{0,12}公开|别[^。；，,]{0,12}公开|只在我们之间/.test(text);
  if (/互相解释|夜里信息位|压力点/.test(text)) {
    const seats = unique([...text.matchAll(/[0-9]+号/g)].map((match) => match[0])).slice(0, 2);
    return seats.length >= 2
      ? `我想听 ${seats[0]}和${seats[1]}把夜里信息边界解释清楚`
      : "我想让相关位置把夜里信息边界解释清楚";
  }
  if (/被提名人|投赞成|倾向投|投票|票/.test(text)) {
    return "投票先听被提名人解释，解释不清再考虑赞成";
  }
  if (/处决后验证|被处决.*身份|身份需要今天的处决结果来验证|处决结果来验证/.test(text)) {
    return hasPrivateBoundary
      ? "我是处决后能验证身份的信息位，具体身份先不说死；别替我公开"
      : "我是处决后能验证身份的信息位，具体身份先不说死";
  }
  if (/公开|替我|配合验证|带出去/.test(text)) {
    return "可以说我愿意配合验证，但别替我公开完整身份";
  }
  if (/昨晚没有|没有新的/.test(text)) {
    return "昨晚没有新信息，今天看谁急着堆票";
  }
  if (/身份|我是/.test(text)) {
    return "我先说明身份范围，细节暂时不摊死";
  }
  return "";
}

function focusHintFromCandidate(candidateText = "") {
  const text = cleanRenderedSpacing(candidateText);
  if (!text) return "";
  if (selfContextOnlyNeedsTargetResponse(text)) return "先听回应";
  if (/身份.*(?:昨晚|夜里|信息)|(?:昨晚|夜里|信息).*身份/.test(text)) {
    return "身份和昨晚信息需要讲完整";
  }
  if (/发言.*站边|站边.*发言/.test(text)) return "发言和站边还没讲顺";
  if (/投票|票型|上票|票/.test(text)) return "票型需要解释";
  if (/提名|被提/.test(text)) return "被推上台面这点要回应";
  if (/死亡|处决|死/.test(text)) return "昨晚死亡这条线要解释";
  if (/身份|角色|跳/.test(text)) return "身份说法还要对上";
  if (/昨晚|夜里|查验|得知|信息/.test(text)) return "昨晚信息还要对上";
  return "";
}

function roleClaimFromCandidate(candidateText = "") {
  const text = cleanRenderedSpacing(candidateText);
  const patterns = [
    /公开身份[：:]\s*([\p{Script=Han}]{2,10})/u,
    /身份先放桌上[：:]\s*我是\s*([\p{Script=Han}]{2,10})/u,
    /先跳\s*([\p{Script=Han}]{2,10})/u,
    /我是\s*([\p{Script=Han}]{2,10})/u,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const claim = `${match?.[1] ?? ""}`.replace(/[，。；：、].*$/u, "").trim();
    if (!claim || claim.length < 2 || claim.length > 10) continue;
    if (/信息位|范围|空白位|好人身份|具体身份|身份需要|不是空白/.test(claim)) continue;
    return claim;
  }
  return "";
}

function selfContextOnlyNeedsTargetResponse(candidateText = "") {
  const text = cleanRenderedSpacing(candidateText);
  if (!roleClaimFromCandidate(text) && !hasSelfDisclosureBoundary(text)) return false;
  if (!/[0-9]\s*号[^。！？；]{0,24}(先听回应|听回应|先听他|听他回应|听完回应|先留|不定死)/u.test(text)) {
    return false;
  }
  return !/[0-9]\s*号[^。！？；]{0,48}(身份|昨晚|夜里|信息|票型|说法|解释|补|对上|站边|讲清|查验|投票)/u.test(text);
}

function publicSelfContextPrefix(payload = {}) {
  if (payload.audience === "private") return "";
  const text = cleanRenderedSpacing(payload.candidateText);
  const claim = roleClaimFromCandidate(text);
  if (claim) return `我先跳${claim}。`;
  if (/处决.*验证|验证.*处决|被处决|处决后/.test(text)) return "我只给处决验证位范围。";
  if (/外来者范围/.test(text)) return "我先给外来者范围。";
  if (/不急着公开具体身份|不摊身份|先别逼我一次说满/.test(text)) return "我先不把身份摊死。";
  if (hasSelfDisclosureBoundary(text)) return selfDisclosureBoundaryPrefix(text);
  return "";
}

function candidateAnchorGroups(payload = {}) {
  const text = cleanRenderedSpacing(payload.candidateText);
  if (!text) return [];
  const groups = [];
  const claim = roleClaimFromCandidate(text);
  if (claim) groups.push({ label: `claim:${claim}`, terms: [claim] });
  if (/外来者范围/.test(text)) groups.push({ label: "outsider-range", terms: ["外来者范围", "外来者"] });
  if (hasSelfDisclosureBoundary(text)) {
    groups.push({ label: "self-disclosure-boundary", terms: SELF_DISCLOSURE_BOUNDARY_TERMS });
  }
  if (payload.audience === "private" && !payload.targetName) {
    unique([...text.matchAll(/[0-9]+\s*号/g)].map((match) => match[0].replace(/\s+/g, "")))
      .slice(0, 3)
      .forEach((seat) => groups.push({ label: `seat:${seat}`, terms: [seat] }));
  }
  if (/处决.*验证|验证.*处决|被处决|处决后/.test(text)) {
    groups.push({ label: "execution-validation", terms: ["处决", "验证"] });
  }
  if (/配合验证/.test(text)) {
    groups.push({ label: "cooperate-verify", terms: ["配合验证", "验证"] });
  }
  if (/别替我公开|不要[^。；，,]{0,12}公开|别[^。；，,]{0,12}公开|只在我们之间/.test(text)) {
    groups.push({ label: "private-boundary", terms: ["别替我公开", "不要公开", "别公开", "只在我们之间", "私下"] });
  }
  if (payload.audience === "private" && /投票|赞成|被提名人|被提名/.test(text)) {
    groups.push({ label: "vote-intent", terms: ["投票", "赞成", "被提名", "票"] });
  }
  return groups;
}

function missingCandidateAnchorReason(value, payload = {}) {
  for (const group of candidateAnchorGroups(payload)) {
    if (!group.terms.some((term) => term && value.includes(term))) {
      return `missing-candidate-anchor:${group.label}`;
    }
  }
  return "";
}

export function buildLLMRenderPayload(input = {}) {
  const maxChars = Number.isFinite(input.maxChars) ? input.maxChars : input.audience === "public" ? 120 : 160;
  const audience = `${input.audience ?? "private"}`.trim();
  const requiredTerms = unique(input.requiredTerms)
    .filter((term) => !(audience === "private" && isPrivateHumanContextLabel(term)))
    .slice(0, 5);
  const rawTargetName = `${input.targetName ?? ""}`.trim();
  const targetName = audience === "private" && isPrivateHumanContextLabel(rawTargetName) ? "" : rawTargetName;
  const payload = {
    speakerName: `${input.speakerName ?? ""}`.trim(),
    targetName,
    audience,
    intent: `${input.intent ?? "generic"}`.trim(),
    persona: `${input.persona ?? "steady"}`.trim(),
    tone: `${input.tone ?? "像桌游玩家，短句，别像系统报告"}`.trim(),
    candidateText: compactText(input.candidateText, 320),
    evidence: unique(input.evidence).slice(0, 3).map((entry) => compactText(entry, 90)),
    requiredTerms,
    forbiddenTerms: unique([...(input.forbiddenTerms ?? []), ...DEFAULT_BANNED_PHRASES]).slice(0, 48),
    maxChars,
    rewriteAttempt: Number.isFinite(input.rewriteAttempt) ? input.rewriteAttempt : 1,
    copyAvoidance: !!input.copyAvoidance,
  };
  payload.protectedFacts = buildProtectedFacts(payload.candidateText, payload);
  return payload;
}

function buildVisibleFacts(payload) {
  const facts = [];
  const protectedSummary = protectedFactsSummary(payload.protectedFacts);
  if (protectedSummary) {
    facts.push(`受保护事实：${protectedSummary}。必须保留这些事实，不要泛化。`);
    return facts;
  }
  if (payload.targetName) facts.push(`发言需要明确提到目标：${payload.targetName}`);
  const privateHint = payload.audience === "private" && !payload.targetName ? privateReplyHint(payload.candidateText) : "";
  if (privateHint) facts.push(`私聊回答要点：${privateHint}`);
  const focusHint = payload.evidence.length === 0 ? focusHintFromCandidate(payload.candidateText) : "";
  if (focusHint) facts.push(`发言焦点：${focusHint}`);
  if (payload.evidence.length > 0) {
    payload.evidence.forEach((entry) => facts.push(`可见线索：${entry}`));
  } else {
    facts.push("目前能确定的东西不多，应该说成先听回应或暂不定死。");
    if (payload.intent === "pressure_question") {
      facts.push("公开追问没有具体线索时，可以要求目标把身份和昨晚信息讲完整。");
    }
  }
  return facts;
}

export function buildLLMRendererPrompt(payloadInput = {}) {
  const payload = buildLLMRenderPayload(payloadInput);
  const system = [
    "你是《血染钟楼》中文桌游玩家台词生成器。",
    "/no_think",
    "你只把给定的结构化发言意图写成自然玩家发言，不做规则判断，不新增事实。",
    "你不能泄露 forbiddenTerms，不能加入未提供的身份、阵营、私聊原文或夜间信息。",
    "requiredTerms 中的每个词必须原样出现在 text 中；targetName 不能改写成“你、他、这个位置”。",
    "如果 protectedFacts 非空，角色名、座位号和结果关系必须保留；不能改身份，不能删座位，不能泛化成“我有信息但先不说”。",
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
        "可以少量使用“嗯、说实话、先别急、我有点担心”这类自然语气，但不要卖萌，不要每句都加。",
        "语气要贴合局势：被提名时先防守，信息可能脏时先打折，强压目标时短句直接，弱证据时留余地。",
        "先给判断，再给一个可回应的问题或保留意见。",
        "如果 visibleFacts 里有可见线索，必须保留至少一个具体锚点，比如身份、信息、投票、提名或私聊；不要只说“有点怪”“那件事”。",
        "不要直接复述“X号公聊提到：……”这类记录句，先压缩成玩家话，比如“身份说法要对上”。",
        "不要使用“口径、证据线、当前主线、低证据、复核、硬信息、那件事、接前面一句、JS Core”等系统词。",
        payload.copyAvoidance || payload.rewriteAttempt > 1
          ? "这次必须换一种句式表达，不能只是替换一两个词。"
          : "不要模仿 deterministic draft 的句式。",
      ],
      visibleFacts: buildVisibleFacts(payload),
      protectedFacts: payload.protectedFacts,
      deterministicDraftToAvoid: payload.candidateText ? "已有本地草稿，但不要照抄；只参考 visibleFacts。" : "",
      requiredTerms: payload.requiredTerms,
      forbiddenTerms: payload.forbiddenTerms,
      outputRules: [
        "只输出一条 text。",
        "不要编造新身份、新夜间结果、新投票事实。",
        "如果信息不足，可以说“先听回应”“先别定死”“这点再对一下”。",
        "如果 targetName 非空，必须写出 targetName 原文。",
        "如果 protectedFacts.active 为 true，必须保留 protectedFacts 中的角色、座位、结果关系和数量事实。",
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

function repairMissingRequiredTerms(text, payloadInput = {}) {
  const payload = buildLLMRenderPayload(payloadInput);
  const missing = unique([...payload.requiredTerms, payload.targetName]).filter((term) => term && !`${text ?? ""}`.includes(term));
  if (missing.length === 0) return `${text ?? ""}`.trim();
  return compactText(`${missing.join("、")}这边，${text ?? ""}`, payload.maxChars + 20);
}

function evidenceAnchorTerms(evidenceEntries = []) {
  const text = unique(evidenceEntries).join(" ");
  const anchors = [];
  if (/身份|角色|跳/.test(text)) anchors.push("身份");
  if (/信息|昨晚|夜|查验|得知/.test(text)) anchors.push("信息");
  if (/投票|上票|票型|票/.test(text)) anchors.push("票");
  if (/提名|被提/.test(text)) anchors.push("提名");
  if (/私聊|声称|说法|告诉/.test(text)) anchors.push("私聊");
  if (/死亡|处决|死/.test(text)) anchors.push("死亡");
  if (/发言|站边/.test(text)) anchors.push("发言");
  return unique(anchors);
}

function evidenceSnippetForPlayerLine(evidenceText = "", forbiddenTerms = []) {
  const safe = cleanRenderedSpacing(removeTerms(evidenceText || "现在说法还没对上", forbiddenTerms)) || "现在说法还没对上";
  if (/身份.*(?:昨晚|夜里|信息)|(?:昨晚|夜里|信息).*身份/.test(safe)) {
    return "身份和昨晚信息要讲完整";
  }
  if (/发言.*站边|站边.*发言/.test(safe)) return "发言和站边还没讲顺";
  if (/前面发言没讲清楚/.test(safe)) {
    return /身份|角色|跳/.test(safe) ? "身份和前面发言还要对上" : "前面发言没讲清楚";
  }
  if (/死亡|处决|死/.test(safe)) return "昨晚死亡这条线要解释";
  if (/昨晚|夜|查验|得知|信息/.test(safe)) return "昨晚信息还要对上";
  if (/身份|角色|跳/.test(safe)) return "身份说法还要对上";
  if (/投票|上票|票型|票/.test(safe)) return "票型需要解释";
  if (/提名|被提/.test(safe)) return "被推上台面这点要回应";
  if (/私聊|声称|说法|告诉|有人私下/.test(safe)) return "有人私下提到他";
  return compactText(safe, 44).replace(/[，。；！？：、]?…$/u, "");
}

function evidenceSnippetForPlayerLineSet(evidenceEntries = [], forbiddenTerms = []) {
  const safeText = unique(evidenceEntries)
    .map((entry) => cleanRenderedSpacing(removeTerms(entry, forbiddenTerms)))
    .filter(Boolean)
    .join(" ");
  if (!safeText) return "现在说法还没对上";
  if (/发言.*站边|站边.*发言/.test(safeText)) return "发言和站边还没讲顺";
  if (/前面发言没讲清楚/.test(safeText) && /身份|角色|跳/.test(safeText)) {
    return "身份和前面发言还要对上";
  }
  return evidenceSnippetForPlayerLine(safeText, forbiddenTerms);
}

function stableVariantIndex(payload = {}, count = 1) {
  if (count <= 1) return 0;
  const source = [
    payload.speakerName,
    payload.persona,
    payload.intent,
    payload.targetName,
    payload.candidateText,
  ]
    .map((entry) => `${entry ?? ""}`)
    .join("|");
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) | 0;
  }
  return Math.abs(hash) % count;
}

function chooseGroundedLine(payload, choices) {
  return choices[stableVariantIndex(payload, choices.length)] ?? choices[0] ?? "";
}

function groundedIdentityNightInfoLine(target, payload = {}) {
  const text = cleanRenderedSpacing(payload.candidateText);
  if ((payload.evidence ?? []).length === 0 && selfContextOnlyNeedsTargetResponse(text)) {
    return groundedPlayerLine(target, "先听回应", payload);
  }
  if (/票型|投票|上票|票/.test(text)) {
    return chooseGroundedLine(payload, [
      `${target}先把刚才票型讲清楚，身份和昨晚信息放后面一起补。`,
      `${target}票型这块别跳过去，先解释，再补昨晚信息。`,
      `我先卡${target}的票型，身份和昨晚信息等他说完整。`
    ]);
  }
  if (/公开身份|身份先放桌上|先跳|我是/.test(text)) {
    return chooseGroundedLine(payload, [
      `${target}先别只报身份，昨晚信息和站边也要对上。`,
      `${target}身份放桌上了，下一句要补昨晚信息和站边。`,
      `${target}这个身份说法先留着，但信息来源要讲清楚。`
    ]);
  }
  if (/公开信息还不够|先听回应|听回应|解释/.test(text)) {
    return chooseGroundedLine(payload, [
      `${target}别只给结论，身份、昨晚信息和刚才回应都要接上。`,
      `${target}先回应桌上的问题，再把身份和信息补完整。`,
      `${target}这轮先听回应，答不齐再继续压。`
    ]);
  }
  if (/上压力|压力|提名池|进提名/.test(text)) {
    return chooseGroundedLine(payload, [
      `${target}先吃一点压力，把身份和昨晚信息说顺再放。`,
      `${target}可以先进压力位，讲清楚身份和昨晚信息再下来。`,
      `${target}这轮不急着定死，但要他把身份和昨晚信息补出来。`
    ]);
  }
  return chooseGroundedLine(payload, [
    `${target}身份说法和昨晚信息一起补，别只给半句。`,
    `${target}先把身份范围、昨晚信息讲顺，我再看票。`,
    `${target}这边我先不定死，但身份和昨晚信息要现在说清楚。`,
    `${target}这块先留桌面上，身份和昨晚信息都要对齐。`
  ]);
}

function makeEvidenceGroundedFallbackText(payloadInput = {}) {
  const payload = buildLLMRenderPayload(payloadInput);
  const target = payload.targetName || "这位";
  const privateHint = payload.audience === "private" && !payload.targetName ? privateReplyHint(payload.candidateText) : "";
  if (privateHint) {
    return compactText(/[。！？]$/u.test(privateHint) ? privateHint : `${privateHint}。`, payload.maxChars);
  }
  if (selfContextOnlyNeedsTargetResponse(payload.candidateText)) {
    const grounded = groundedPlayerLine(target, "先听回应", payload);
    const prefix = publicSelfContextPrefix(payload);
    return compactText(prefix ? `${prefix}${grounded}` : grounded, payload.maxChars);
  }
  if (payload.evidence.length === 0) {
    const focusHint = focusHintFromCandidate(payload.candidateText) || "身份和昨晚信息要讲完整";
    const grounded = groundedPlayerLine(target, focusHint, payload);
    const prefix = publicSelfContextPrefix(payload);
    return compactText(prefix ? `${prefix}${grounded}` : grounded, payload.maxChars);
  }
  const safeEvidence = evidenceSnippetForPlayerLineSet(payload.evidence, payload.forbiddenTerms);
  const grounded = groundedPlayerLine(target, safeEvidence, payload);
  const prefix = publicSelfContextPrefix(payload);
  return compactText(prefix ? `${prefix}${grounded}` : grounded, payload.maxChars);
}

function groundedPlayerLine(targetName, evidenceText = "", payload = {}) {
  const target = targetName || "这位";
  const evidence = cleanRenderedSpacing(evidenceText || "先听回应");
  if (/身份和昨晚信息/.test(evidence)) {
    return groundedIdentityNightInfoLine(target, payload);
  }
  if (/身份和前面发言/.test(evidence)) {
    return chooseGroundedLine(payload, [
      `${target}的身份和前面发言要对上，先让他补这一块。`,
      `${target}前面没把身份讲顺，先听他补清楚。`,
      `我先卡${target}这里：身份和前面发言没接上。`,
    ]);
  }
  if (/发言和站边|发言.*站边|站边.*发言/.test(evidence)) {
    return chooseGroundedLine(payload, [
      `${target}前面发言和站边还没讲顺，先听他补。`,
      `${target}站边和发言还要对上，我先听解释。`,
      `${target}这轮先把发言和站边讲清楚，我再判断。`,
    ]);
  }
  if (/昨晚死亡/.test(evidence)) {
    return chooseGroundedLine(payload, [
      `${target}和昨晚死亡这条线有关，我想听他解释清楚。`,
      `昨晚死亡这条线绕不开${target}，先听解释。`,
      `${target}要把昨晚死亡这条线解释清楚。`,
    ]);
  }
  if (/昨晚信息|夜里信息/.test(evidence)) {
    return chooseGroundedLine(payload, [
      `${target}昨晚信息还要对上，先让他讲清楚。`,
      `${target}夜里信息这块还没对齐，我先听解释。`,
      `${target}先把昨晚信息补清楚，再看站边。`,
    ]);
  }
  if (/身份说法|身份/.test(evidence)) {
    return chooseGroundedLine(payload, [
      `${target}身份说法要对上，先听他怎么补。`,
      `${target}身份这块先讲清楚，我再判断。`,
      `${target}先把身份线补完整，别只给结论。`,
    ]);
  }
  if (/票型|投票/.test(evidence)) {
    return chooseGroundedLine(payload, [
      `${target}这轮票型需要解释，先听他怎么说。`,
      `${target}刚才票型要说清楚，我先不放过。`,
      `${target}投票这块先解释，再看要不要继续压。`,
    ]);
  }
  if (/被推上台面|提名/.test(evidence)) {
    return chooseGroundedLine(payload, [
      `${target}被推上台面这点要回应，先听防守。`,
      `${target}既然进了提名压力，先把防守讲明白。`,
      `${target}这轮先回应提名理由，我再看票。`,
    ]);
  }
  if (/私下|有人私下/.test(evidence)) {
    return chooseGroundedLine(payload, [
      `${target}有人私下提到他，我先听回应。`,
      `${target}这边有私聊说法，我先让他解释。`,
      `私下有人点到${target}，但我先不直接定死。`,
    ]);
  }
  if (/前面发言没讲清楚/.test(evidence)) {
    return chooseGroundedLine(payload, [
      `${target}前面发言没讲清楚，先听他补。`,
      `${target}刚才没讲明白，我想听他再补一句。`,
      `${target}前面的说法还空着，先让他回应。`,
    ]);
  }
  if (/先听回应/.test(evidence)) {
    return chooseGroundedLine(payload, [
      `${target}先听回应，我现在不定死。`,
      `${target}我先不下结论，听完回应再说。`,
      `${target}这里先留着，等他把话说完整。`,
    ]);
  }
  return `${target}这点我先记着，${evidence}，先听回应。`;
}

function stripSpeakerPrefix(text, payloadInput = {}) {
  const payload = buildLLMRenderPayload(payloadInput);
  if (!payload.speakerName) return `${text ?? ""}`.trim();
  const escaped = payload.speakerName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return `${text ?? ""}`.replace(new RegExp(`^\\s*${escaped}\\s*(?:[：:、，,。.-]+\\s*)?`), "").trim();
}

function localizeKnownFallbackTemplates(value) {
  return `${value ?? ""}`
    .replace(
      /([0-9]+\s*号)\s+nominates\s+([0-9]+\s*号)(（你）)?/gi,
      (_, nominator, nominee, youLabel = "") => `${nominator}提名${nominee}${youLabel}，先听回应。`
    )
    .replace(/Contract nomination for dead-human ghost vote control\./gi, "这轮先看幽灵票，别让死者票把结果带偏。")
    .replace(/Contract nomination for default evil ally protection vote\./gi, "这轮先听回应，我不急着上票。")
    .replace(/Contract nomination for default human self-protection vote\./gi, "这轮先听防守，票先别急着定。");
}

function informativeFragment(value, payload = {}) {
  let text = `${value ?? ""}`;
  unique([payload.targetName, payload.speakerName]).forEach((term) => {
    if (term) text = text.split(term).join("");
  });
  return text
    .replace(/[0-9]+\s*号/g, "")
    .replace(/[【】\[\]（）()「」『』“”"'：:，,。.!！?？；;、\s]/g, "")
    .replace(/这边|这里|这个位置|这位|先听|回应|先|听|我|你|他|她|嗯|啊|呢|吧/g, "")
    .trim();
}

function underInformativeReason(value, payload = {}) {
  const text = `${value ?? ""}`.trim();
  const target = payload.targetName || "";
  if (target) {
    const escapedTarget = target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`^\\s*${escapedTarget}\\s*(?:这边|这里|这个位置)?\\s*[】\\]）)]?\\s*[。.!！?？、，,：:；;\\s]*$`).test(text)) {
      return "under-informative-target-only";
    }
  }
  const informative = informativeFragment(text, payload);
  if (target && informative.length < 3) return "under-informative-target-only";
  if (!target && informative.length < 4) return "under-informative";
  return "";
}

function missingPrivateIntentAnchorReason(value, payload = {}) {
  if (payload.audience !== "private") return "";
  const text = cleanRenderedSpacing(value);
  const intent = `${payload.intent ?? ""}`.trim();
  const checks = {
    claim: /身份|我是|范围|具体身份|信息位|暂时|保留|不说死/,
    night: /昨晚|昨夜|夜里|夜间|夜晚|信息|没有/,
    suspect: /怀疑|可疑|最想追|第一关注|先看|先盯|盯|追/,
    trust: /信任|相信|信谁|你.{0,8}在我这里|偏好|风险|中间位|不信|放下/,
    vote: /投|票|提名|跟票|赞成|反对|上票|补不上/,
    reason: /因为|理由|主要|证据|对不上|提到|卡点|公开|信息|站队/,
    plan: /下一步|建议|计划|先问|先把|今天|公聊|提名|推进|担心/,
  };
  const pattern = checks[intent];
  if (!pattern || pattern.test(text)) return "";
  return `missing-private-intent-anchor:${intent}`;
}

function promptLikeOutputReason(value, payload = {}) {
  const text = cleanRenderedSpacing(value);
  if (payload.targetName) {
    const escapedTarget = payload.targetName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`^\\s*${escapedTarget}\\s*[：:]`).test(text)) {
      return `target-speaker-prefix:${payload.targetName}`;
    }
  }
  if (/^(您好|请问您谁|请问你是谁|你是谁(?:[？?]|$)|你有(?:提名|发言)吗|你是否在讨论|你，作为|你是(?:一名)?玩家|作为.*玩家|请提供|请在指定时间|需要在指定时间)/.test(text)) {
    return "prompt-like-output";
  }
  if (
    /您是否同意|是否愿意|请提供.*(?:信息|线索|回答)|请发言时|请在[0-9]+号中确认|以便我能够|做出恰当的回应|回答我的问题|回答你的问题|我来回答了|讨论了很多话题|正在讨论某号|玩家在公聊中提到|公聊提到：|在公聊中|在对话中|我注意到你提到|你在昨晚的发言|昨晚的发言中|我并没有提到|如果你愿意|我可以问|是否在讨论公聊投票|现在你需要(?:指出|生成|回答|扮演|改写|输出)|不太了解|有什么问题吗|有什么想说|有发言需要吗|发言需要吗|提名或互辩|语气可以更集中|投票判断空间|私人回答要点|血染钟楼字样的牌|投票结果|钟楼.*投票|昨晚在钟楼|发言需要明确提到目标|发言焦点|目标是你(?:的)?|当前公开(?:票型|提名)压力|压力链|这表明|应该说成|你作为|作为.*(?:玩家|提名|互辩|发言)/.test(text)
  ) {
    return "prompt-like-output";
  }
  if (/^你，我需要|你这边，[0-9]+号[：:]|[0-9]+号这边，[0-9]+号：|在某号[：:]|团队的计划|去探险|准备.*装备|准备好了.*回答|我是玩家|私聊回答|那位是[……...]*$/.test(text)) {
    return "prompt-like-output";
  }
  if (payload.speakerName && new RegExp(`我是\\s*${payload.speakerName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(text)) {
    return `speaker-self-label:${payload.speakerName}`;
  }
  if (payload.targetName && payload.speakerName && payload.targetName !== payload.speakerName) {
    const escapedTarget = payload.targetName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`我是\\s*${escapedTarget}`).test(text)) {
      return `speaker-target-confusion:${payload.targetName}`;
    }
  }
  return "";
}

function unsupportedCandidateDriftReason(value, payload = {}) {
  const text = cleanRenderedSpacing(value);
  const source = cleanRenderedSpacing([payload.candidateText, ...(payload.evidence ?? [])].join(" "));
  const firstPersonNightClaim = /(?:我.{0,12}(?:昨晚|夜里|夜间|昨夜).{0,24}(?:遇到|看见|看到|查到|得知|听到|被|在钟楼|陌生人|神秘)|(?:昨晚|夜里|夜间|昨夜).{0,8}我.{0,24}(?:遇到|看见|看到|查到|得知|听到|被|在钟楼|陌生人|神秘))/;
  const sourceFirstPersonNightClaim = /(?:我.{0,12}(?:昨晚|夜里|夜间|昨夜).{0,24}(?:遇到|看见|看到|查到|得知|听到|被|在钟楼|陌生人|神秘)|(?:昨晚|夜里|夜间|昨夜).{0,8}我.{0,24}(?:遇到|看见|看到|查到|得知|听到|被|在钟楼|陌生人|神秘))/;
  if (firstPersonNightClaim.test(text) && !sourceFirstPersonNightClaim.test(source)) {
    return "unsupported-night-info";
  }
  if (/(昨晚|夜里|夜间|昨夜)/.test(text) && !/(昨晚|夜里|夜间|昨夜)/.test(source)) {
    return "unsupported-night-info";
  }
  const deathClaim = /(?:昨晚|夜里|夜间|昨夜).{0,12}(?:死亡|死了|被杀|死在)|(?:死亡|死了|被杀|死在).{0,12}(?:这条线|解释|记录|昨晚|夜里|夜间|昨夜)/;
  const sourceDeath = /(?:昨晚|夜里|夜间|昨夜).{0,12}(?:死亡|死了|被杀|死在)|夜间死亡|死亡记录|被杀|死了|死在|死于/;
  if (deathClaim.test(text) && !sourceDeath.test(source)) {
    return "unsupported-death-info";
  }
  if (selfContextOnlyNeedsTargetResponse(payload.candidateText) && payload.targetName) {
    const escapedTarget = payload.targetName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const targetPressure = new RegExp(
      `${escapedTarget}[^。！？；]{0,48}(身份|昨晚|夜里|信息|票型|投票|说法|站边|查验|补完整|补清楚|对上|讲清楚)`
    );
    if (targetPressure.test(text)) {
      return "unsupported-target-pressure";
    }
  }
  return "";
}

export function validateLLMRenderedSpeech(text, payloadInput = {}, options = {}) {
  const payload = buildLLMRenderPayload(payloadInput);
  const value = cleanRenderedSpacing(text);
  if (!value) return { ok: false, reason: "empty-output", text: "" };
  const artifactReason = renderedArtifactReason(text);
  if (artifactReason) return { ok: false, reason: artifactReason, text: value };
  const promptLikeReason = promptLikeOutputReason(value, payload);
  if (promptLikeReason) return { ok: false, reason: promptLikeReason, text: value };
  const driftReason = unsupportedCandidateDriftReason(value, payload);
  if (driftReason) return { ok: false, reason: driftReason, text: value };
  if (value.length > payload.maxChars + 24) {
    return { ok: false, reason: "too-long", text: value };
  }
  const banned = unique([...(payload.forbiddenTerms ?? []), ...(options.extraForbiddenTerms ?? [])]);
  const leaked = banned.find((term) => term && value.includes(term));
  if (leaked) return { ok: false, reason: `forbidden-term:${leaked}`, text: value };
  const required = unique(payload.requiredTerms);
  const missing = required.find((term) => !value.includes(term));
  if (missing) return { ok: false, reason: `missing-required-term:${missing}`, text: value };
  const protectedReason = missingProtectedFactReason(value, payload);
  if (protectedReason) return { ok: false, reason: protectedReason, text: value };
  if (payload.speakerName) {
    const escaped = payload.speakerName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`^\\s*${escaped}\\s*[：:，,。.]`).test(value)) {
      return { ok: false, reason: `speaker-prefix:${payload.speakerName}`, text: value };
    }
  }
  if (payload.targetName && options.requireTarget !== false && !value.includes(payload.targetName)) {
    return { ok: false, reason: `missing-target:${payload.targetName}`, text: value };
  }
  const thinReason = underInformativeReason(value, payload);
  if (thinReason) return { ok: false, reason: thinReason, text: value };
  const privateIntentReason = missingPrivateIntentAnchorReason(value, payload);
  if (privateIntentReason) return { ok: false, reason: privateIntentReason, text: value };
  const evidenceAnchors = evidenceAnchorTerms(payload.evidence);
  const candidateAlreadyFramesResponse = selfContextOnlyNeedsTargetResponse(payload.candidateText);
  if (
    options.requireEvidenceAnchor !== false &&
    !candidateAlreadyFramesResponse &&
    evidenceAnchors.length > 0 &&
    !evidenceAnchors.some((term) => value.includes(term))
  ) {
    return { ok: false, reason: `missing-evidence-anchor:${evidenceAnchors.join("/")}`, text: value };
  }
  const candidateReason = missingCandidateAnchorReason(value, payload);
  if (options.requireCandidateAnchors !== false && candidateReason) {
    return { ok: false, reason: candidateReason, text: value };
  }
  if (options.rejectNearCopy === true) {
    const copy = nearCopyDetails(value, payload.candidateText, options.nearCopyThreshold);
    if (copy.nearCopy) {
      return { ok: false, reason: `near-copy:${copy.similarity.toFixed(2)}`, text: value, ...copy };
    }
  }
  return { ok: true, reason: "", text: value };
}

function validateOrRepairLLMRenderedSpeech(text, payloadInput = {}, options = {}) {
  const validation = validateLLMRenderedSpeech(text, payloadInput, options);
  if (validation.ok) {
    return validation;
  }
  const payload = buildLLMRenderPayload(payloadInput);
  if (payload.protectedFacts?.active) {
    return validation;
  }
  if (validation.reason === "stitching-artifact") {
    const repairedText = repairRenderedArtifacts(validation.text);
    const repaired = validateLLMRenderedSpeech(repairedText, payloadInput, options);
    if (repaired.ok) {
      return {
        ...repaired,
        repaired: true,
        repairReason: validation.reason,
      };
    }
    const groundedText = makeEvidenceGroundedFallbackText(payloadInput);
    const grounded = validateLLMRenderedSpeech(groundedText, payloadInput, options);
    if (grounded.ok) {
      return {
        ...grounded,
        repaired: true,
        repairReason: validation.reason,
      };
    }
  }
  if (/speaker-prefix/.test(validation.reason)) {
    const strippedText = stripSpeakerPrefix(validation.text, payloadInput);
    const stripped = validateLLMRenderedSpeech(strippedText, payloadInput, options);
    if (stripped.ok) {
      return {
        ...stripped,
        repaired: true,
        repairReason: validation.reason,
      };
    }
    const groundedText = makeEvidenceGroundedFallbackText(payloadInput);
    const grounded = validateLLMRenderedSpeech(groundedText, payloadInput, options);
    if (grounded.ok) {
      return {
        ...grounded,
        repaired: true,
        repairReason: validation.reason,
      };
    }
  }
  if (/missing-evidence-anchor|missing-candidate-anchor/.test(validation.reason)) {
    const groundedText = makeEvidenceGroundedFallbackText(payloadInput);
    const grounded = validateLLMRenderedSpeech(groundedText, payloadInput, options);
    if (grounded.ok) {
      return {
        ...grounded,
        repaired: true,
        repairReason: validation.reason,
      };
    }
  }
  if (/under-informative|missing-private-intent-anchor|prompt-like-output|speaker-self-label|speaker-target-confusion|target-speaker-prefix|unsupported-night-info|unsupported-death-info|unsupported-target-pressure/.test(validation.reason)) {
    const groundedText = makeEvidenceGroundedFallbackText(payloadInput);
    const grounded = validateLLMRenderedSpeech(groundedText, payloadInput, options);
    if (grounded.ok) {
      return {
        ...grounded,
        repaired: true,
        repairReason: validation.reason,
      };
    }
  }
  if (validation.reason.startsWith("forbidden-term:")) {
    const term = validation.reason.slice("forbidden-term:".length);
    if (REPAIRABLE_VAGUE_TERMS.includes(term)) {
      const groundedText = makeEvidenceGroundedFallbackText(payloadInput);
      const grounded = validateLLMRenderedSpeech(groundedText, payloadInput, options);
      if (grounded.ok) {
        return {
          ...grounded,
          repaired: true,
          repairReason: validation.reason,
        };
      }
    }
    const groundedText = makeEvidenceGroundedFallbackText(payloadInput);
    const grounded = validateLLMRenderedSpeech(groundedText, payloadInput, options);
    if (grounded.ok) {
      return {
        ...grounded,
        repaired: true,
        repairReason: validation.reason,
      };
    }
  }
  if (!/missing-required-term|missing-target/.test(validation.reason)) {
    return validation;
  }
  const repairedText = repairMissingRequiredTerms(validation.text, payloadInput);
  const repaired = validateLLMRenderedSpeech(repairedText, payloadInput, options);
  if (!repaired.ok) {
    const groundedText = makeEvidenceGroundedFallbackText(payloadInput);
    const grounded = validateLLMRenderedSpeech(groundedText, payloadInput, options);
    if (grounded.ok) {
      return {
        ...grounded,
        repaired: true,
        repairReason: validation.reason,
      };
    }
    return validation;
  }
  return {
    ...repaired,
    repaired: true,
    repairReason: validation.reason,
  };
}

function makeSafeFallbackText(payloadInput = {}, raw = "") {
  const payload = buildLLMRenderPayload(payloadInput);
  const banned = unique(payload.forbiddenTerms);
  const rawText = `${raw || payload.candidateText || ""}`;
  const protectedFallback = protectedFactFallbackText(payload, rawText);
  if (protectedFallback) {
    return protectedFallback;
  }
  const nominationTemplate = rawText.match(/([0-9]+\s*号)\s+nominates\s+([0-9]+\s*号(?:（你）)?)/i);
  if (nominationTemplate) {
    const nominator = nominationTemplate[1].replace(/\s+/g, "");
    const nominee = nominationTemplate[2].replace(/\s+/g, "");
    return compactText(`${nominator}提名${nominee}，先听防守再看票。`, payload.maxChars);
  }
  if (/Contract nomination for dead-human ghost vote control\./i.test(rawText)) {
    const target = payload.targetName || "这位";
    return compactText(`${target}这票先看幽灵票，别让死者票把结果带偏。`, payload.maxChars);
  }
  if (/Contract nomination for default evil ally protection vote\./i.test(rawText)) {
    const target = payload.targetName || "这位";
    return compactText(`${target}这轮先听回应，我不急着把票打死。`, payload.maxChars);
  }
  if (/Contract nomination for default human self-protection vote\./i.test(rawText)) {
    const target = payload.targetName || "这位";
    return compactText(`${target}这轮先听防守，票先别急着定。`, payload.maxChars);
  }
  if (payload.audience === "private" && /昨晚没有新的|没有新的硬信息/.test(rawText)) {
    return compactText("我昨晚没有新信息；我的身份要看今天处决结果，先看谁急着堆票。", payload.maxChars);
  }
  if (/nominates|Contract nomination/i.test(rawText)) {
    const localized = compactText(removeTerms(localizeKnownFallbackTemplates(rawText), banned), payload.maxChars);
    const localizedValidation = validateOrRepairLLMRenderedSpeech(localized, payloadInput);
    if (localizedValidation.ok) {
      return localizedValidation.text;
    }
  }
  const groundedText = makeEvidenceGroundedFallbackText(payloadInput);
  const grounded = validateLLMRenderedSpeech(groundedText, payloadInput);
  if (grounded.ok) {
    return compactText(grounded.text, payload.maxChars);
  }
  const relaxedGrounded = validateLLMRenderedSpeech(groundedText, payloadInput, {
    requireCandidateAnchors: false,
    requireEvidenceAnchor: false,
  });
  if (relaxedGrounded.ok) {
    return compactText(relaxedGrounded.text, payload.maxChars);
  }
  if (payload.evidence.length > 0) {
    const candidateOnly = { ...payloadInput, evidence: [] };
    const candidateGroundedText = makeEvidenceGroundedFallbackText(candidateOnly);
    const candidateGrounded = validateLLMRenderedSpeech(candidateGroundedText, candidateOnly, {
      requireCandidateAnchors: false,
      requireEvidenceAnchor: false,
    });
    if (candidateGrounded.ok) {
      return compactText(candidateGrounded.text, payload.maxChars);
    }
  }
  let value = removeTerms(localizeKnownFallbackTemplates(raw || payload.candidateText || "我先听回应。"), banned);
  value = value || "我先听回应。";
  unique(payload.requiredTerms).forEach((term) => {
    if (term && !value.includes(term)) value = `${term}这边，${value}`;
  });
  if (payload.targetName && !value.includes(payload.targetName)) value = `${payload.targetName}这边，${value}`;
  const cleaned = compactText(sanitizePlayerVisibleText(value), payload.maxChars);
  const cleanedValidation = validateOrRepairLLMRenderedSpeech(cleaned, payloadInput);
  return cleanedValidation.ok ? cleanedValidation.text : cleaned;
}

function makeAntiCopyFallbackText(payloadInput = {}) {
  const payload = buildLLMRenderPayload(payloadInput);
  const target = payload.targetName || "这个位置";
  const evidence = selfContextOnlyNeedsTargetResponse(payload.candidateText)
    ? "先听回应"
    : payload.evidence.length > 0
    ? evidenceSnippetForPlayerLineSet(payload.evidence, payload.forbiddenTerms)
    : focusHintFromCandidate(payload.candidateText) || "先听回应";
  if (payload.intent === "pressure_question" || payload.audience === "public") {
    return compactText(groundedPlayerLine(target, evidence || "先听回应", payload), payload.maxChars);
  }
  if (payload.intent === "nomination_reason" || payload.audience === "nomination") {
    return compactText(`${target}这轮需要回应一下，先说身份和信息来源，再看票。`, payload.maxChars);
  }
  if (evidence) {
    return compactText(groundedPlayerLine(target, evidence, payload), payload.maxChars);
  }
  return compactText(`${target}我现在还不能定死，先听回应。`, payload.maxChars);
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
        top_p: Number.isFinite(options.topP) ? options.topP : 0.8,
        presence_penalty: Number.isFinite(options.presencePenalty) ? options.presencePenalty : 1.2,
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
          top_p: Number.isFinite(options.topP) ? options.topP : 0.8,
          presence_penalty: Number.isFinite(options.presencePenalty) ? options.presencePenalty : 1.2,
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
  const context = data.context ?? {};
  const target = context.targetName || "";
  const audience = context.audience || "private";
  const privateHint = data.visibleFacts?.find((entry) => entry.startsWith("私聊回答要点："))?.replace("私聊回答要点：", "");
  const focusHint = data.visibleFacts?.find((entry) => entry.startsWith("发言焦点："))?.replace("发言焦点：", "");
  const evidenceEntries = (data.visibleFacts ?? [])
    .filter((entry) => entry.startsWith("可见线索："))
    .map((entry) => entry.replace("可见线索：", ""));
  const evidenceText = evidenceSnippetForPlayerLineSet(evidenceEntries.length > 0 ? evidenceEntries : [focusHint || "先听回应"], data.forbiddenTerms ?? []);
  if (!target && audience === "private") {
    return JSON.stringify({ text: privateHint ? `${privateHint}。` : `我先把能说的范围讲清楚，${evidenceText}。` });
  }
  const namedTarget = target || "这个位置";
  const line = data.styleGuide?.some((entry) => entry.includes("必须明显改写"))
    ? `${namedTarget}先别急着过，我要听他把身份和信息来源说完整。`
    : groundedPlayerLine(namedTarget, evidenceText, context);
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
    reason: extra.reason ?? (validation.repaired ? `repaired:${validation.repairReason}` : ""),
    payload: prompt.payload,
    nearCopy: !!extra.nearCopy,
    similarity: Number.isFinite(extra.similarity) ? extra.similarity : 0,
    retryUsed: !!extra.retryUsed,
    repaired: !!validation.repaired,
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
    const validation = validateOrRepairLLMRenderedSpeech(text, prompt.payload, options);
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
      const retryValidation = validateOrRepairLLMRenderedSpeech(retryText, retryPrompt.payload, options);
      if (retryValidation.ok) {
        const retryCopy = nearCopyDetails(retryValidation.text, retryPrompt.payload.candidateText, options.nearCopyThreshold);
        if (retryCopy.nearCopy && options.localRewriteOnNearCopy !== false) {
          const localText = makeAntiCopyFallbackText(retryPrompt.payload);
          const localValidation = validateLLMRenderedSpeech(localText, retryPrompt.payload, options);
          if (localValidation.ok) {
            return {
              ok: true,
              text: localValidation.text,
              source: "local-rewrite",
              fallbackUsed: true,
              reason: "near-copy-local-rewrite",
              payload: retryPrompt.payload,
              nearCopy: false,
              similarity: scoreTextSimilarity(localValidation.text, retryPrompt.payload.candidateText),
              retryUsed: true,
              repaired: false,
            };
          }
        }
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
