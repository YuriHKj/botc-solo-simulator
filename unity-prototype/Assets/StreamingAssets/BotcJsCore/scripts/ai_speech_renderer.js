import { sample } from "./data.js";
import AI_SPEECH_CORPUS from "./ai_speech_corpus.json" with { type: "json" };

const PERSONA_TYPES = {
  STEADY: "steady",
  PRESSURE: "pressure",
  SHADOW: "shadow",
};

const QUESTION_INTENT = {
  SUSPECT: "suspect",
  REASON: "reason",
  VOTE: "vote",
  COMPARE: "compare",
  PLAN: "plan",
};

function pickCorpusLine(lines, rng = Math.random) {
  if (!Array.isArray(lines) || lines.length === 0) {
    return "";
  }
  return lines[Math.floor(rng() * lines.length)] ?? lines[0] ?? "";
}

export function corpusLines(path, fallback = []) {
  const value = `${path ?? ""}`
    .split(".")
    .filter(Boolean)
    .reduce((node, key) => node?.[key], AI_SPEECH_CORPUS);
  return Array.isArray(value) && value.length > 0 ? value : fallback;
}

export function formatCorpusLine(template, values = {}) {
  return `${template ?? ""}`.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => `${values[key] ?? ""}`);
}

export function pickCorpusTemplate(path, values = {}, rng = Math.random, fallback = []) {
  return formatCorpusLine(pickCorpusLine(corpusLines(path, fallback), rng), values);
}

export function personaCorpusKey(persona) {
  return [PERSONA_TYPES.STEADY, PERSONA_TYPES.PRESSURE, PERSONA_TYPES.SHADOW].includes(persona)
    ? persona
    : PERSONA_TYPES.STEADY;
}

export function pickPersonaTemplate(persona, leaf, values = {}, rng = Math.random, fallback = []) {
  return pickCorpusTemplate(`persona.${personaCorpusKey(persona)}.${leaf}`, values, rng, fallback);
}

export function layeredCorpusPaths(options = {}) {
  const layer = `${options.layer ?? ""}`.trim();
  const audience = `${options.audience ?? ""}`.trim();
  const act = `${options.act ?? ""}`.trim();
  if (!layer || !audience || !act) {
    return [];
  }
  const persona = personaCorpusKey(options.persona);
  const team = `${options.team ?? ""}`.trim();
  const paths = [];
  if (team) {
    paths.push(`layers.${layer}.${audience}.team.${team}.${persona}.${act}`);
    paths.push(`layers.${layer}.${audience}.team.${team}.default.${act}`);
  }
  paths.push(`layers.${layer}.${audience}.persona.${persona}.${act}`);
  paths.push(`layers.${layer}.${audience}.act.${act}`);
  paths.push(`layers.${layer}.shared.${act}`);
  return [...new Set(paths)];
}

export function pickLayeredSpeech(options = {}, values = {}, rng = Math.random, fallback = []) {
  for (const path of layeredCorpusPaths(options)) {
    const line = pickCorpusTemplate(path, values, rng, []);
    if (line) {
      return line;
    }
  }
  return formatCorpusLine(pickCorpusLine(fallback, rng), values);
}

export function corpusTemplateEntry(path, id, values = {}, rng = Math.random, fallback = []) {
  return {
    id,
    text: pickCorpusTemplate(path, values, rng, fallback),
  };
}

export function renderDialogueActs(state, aiPlayer, act, values = {}, rng = Math.random, fallback = [], options = {}) {
  const persona = personaCorpusKey(aiPlayer?.aiPersona ?? PERSONA_TYPES.STEADY);
  const audience = options.audience ?? "private";
  const useEvilPerformance =
    options.evilPerformance ??
    ((audience === "public" || audience === "private") && (aiPlayer?.team === "evil" || aiPlayer?.knownSelfTeam === "evil"));
  const evilPath = `${audience}.evilPerformance.${persona}.${act}`;
  const normalPath = `${audience}.dialogueActs.${persona}.${act}`;
  const text = useEvilPerformance
    ? pickCorpusTemplate(evilPath, values, rng, []) || pickCorpusTemplate(normalPath, values, rng, fallback)
    : pickCorpusTemplate(normalPath, values, rng, fallback);
  return text || fallback[0] || "";
}

export function shortReasonText(reasonText, limit = 24) {
  const first = `${reasonText ?? ""}`.split(/[；。]/u).map((entry) => entry.trim()).find(Boolean) ?? "";
  return first.length > limit ? `${first.slice(0, limit)}...` : first;
}

export function joinSpeechFragments(fragments) {
  return (fragments ?? [])
    .map((entry) => `${entry ?? ""}`.trim())
    .filter(Boolean)
    .join(" ");
}

const HUMAN_CADENCE_MARKERS = ["换个说法", "说白了", "我的意思是", "换句话说", "先说清楚"];
const COOLDOWN_PHRASE_REPLACEMENTS = {
  证据线: ["这条链", "这个点", "这段信息"],
  口径: ["说法", "解释", "这边的身份"],
  复核: ["再对一下", "回头确认", "重新听一遍"],
};

function alreadyHasHumanCadence(text) {
  const value = `${text ?? ""}`;
  return HUMAN_CADENCE_MARKERS.some((marker) => value.includes(marker));
}

function stripDuplicateHumanOpeners(text) {
  let value = `${text ?? ""}`.replace(/\s+/g, " ").trim();
  const stockOpeners = [
    "我先说人话版。",
    "简单讲，我现在是这么看。",
    "别急，我给你一个能落地的判断。",
    "我不把话说死，但目前倾向是这样。",
    "先给结论，细节你可以继续追问。",
    "我尽量不绕，先把我的判断摊开。",
    "这事我有点想法，但先别当铁证听。",
  ];
  let changed = true;
  while (changed) {
    changed = false;
    for (const opener of stockOpeners) {
      const doubled = `${opener} ${opener}`;
      if (value.startsWith(doubled)) {
        value = `${opener} ${value.slice(doubled.length).trim()}`.trim();
        changed = true;
      }
    }
  }
  return value;
}

function bridgePhraseForSpeech(aiPlayer, options = {}) {
  const persona = aiPlayer?.aiPersona ?? PERSONA_TYPES.STEADY;
  if (options.audience === "public") {
    if (persona === PERSONA_TYPES.PRESSURE) return "先说清楚，";
    if (persona === PERSONA_TYPES.SHADOW) return "换句话说，";
    return "我的意思是，";
  }
  if ([QUESTION_INTENT.REASON, QUESTION_INTENT.SUSPECT, QUESTION_INTENT.COMPARE].includes(options.intent)) {
    return persona === PERSONA_TYPES.PRESSURE ? "说白了，" : "换个说法，";
  }
  if ([QUESTION_INTENT.VOTE, QUESTION_INTENT.PLAN].includes(options.intent)) {
    return persona === PERSONA_TYPES.SHADOW ? "换句话说，" : "先说清楚，";
  }
  return "";
}

function insertCadenceBridge(text, bridge) {
  const value = `${text ?? ""}`.trim();
  if (!bridge || !value || value.includes(bridge.replace(/[，,]\s*$/, ""))) {
    return value;
  }
  const match = value.match(/[。！？；]\s*/u);
  if (!match || match.index === undefined) {
    return `${bridge}${value}`;
  }
  const splitAt = match.index + match[0].length;
  return `${value.slice(0, splitAt)}${bridge}${value.slice(splitAt).trim()}`;
}

function ensureSpeechStyleMemory(aiPlayer) {
  aiPlayer.speechStyleMemory = aiPlayer.speechStyleMemory ?? {};
  aiPlayer.speechStyleMemory.recentLines = Array.isArray(aiPlayer.speechStyleMemory.recentLines)
    ? aiPlayer.speechStyleMemory.recentLines
    : [];
  aiPlayer.speechStyleMemory.recentPhrases = Array.isArray(aiPlayer.speechStyleMemory.recentPhrases)
    ? aiPlayer.speechStyleMemory.recentPhrases
    : [];
  return aiPlayer.speechStyleMemory;
}

function recentPhraseCount(memory, phrase) {
  const phraseHits = (memory.recentPhrases ?? []).filter((entry) => entry === phrase).length;
  const lineHits = (memory.recentLines ?? []).filter((line) => `${line ?? ""}`.includes(phrase)).length;
  return phraseHits + lineHits;
}

function applyPhraseCooldown(text, aiPlayer, rng = Math.random) {
  let value = `${text ?? ""}`;
  const memory = ensureSpeechStyleMemory(aiPlayer);
  Object.entries(COOLDOWN_PHRASE_REPLACEMENTS).forEach(([phrase, replacements]) => {
    if (!value.includes(phrase) || recentPhraseCount(memory, phrase) < 2) {
      return;
    }
    const pool = replacements.filter((entry) => entry !== phrase);
    const replacement = sample(pool.length > 0 ? pool : replacements, 1, rng)[0] ?? phrase;
    value = value.replaceAll(phrase, replacement);
  });
  return value;
}

export function differentiateRepeatedSpeech(text, aiPlayer, rng = Math.random, options = {}) {
  let value = `${text ?? ""}`.trim();
  if (!value || !aiPlayer) {
    return value;
  }
  const memory = ensureSpeechStyleMemory(aiPlayer);
  const recent = memory.recentLines ?? [];
  const exactRepeats = recent.filter((line) => line === value).length;
  if (exactRepeats <= 0) {
    return value;
  }
  const audience = options.audience ?? "private";
  const replacements = [
    [/我先不把话说死/g, "我换个说法"],
    [/我暂时不换目标/g, "这条我先不撤"],
    [/我先看/g, "我先盯"],
    [/我公开报身份/g, "我把身份放桌上"],
    [/我先跳一下/g, "我直接跳"],
    [/我卡在这儿/g, "我现在卡在这点"],
    [/发言要回看/g, "前面的发言要再听一遍"],
    [/身份要对/g, "身份得对上"],
  ];
  for (const [pattern, replacement] of replacements) {
    if (pattern.test(value)) {
      return value.replace(pattern, replacement);
    }
  }
  const nudges =
    audience === "public"
      ? ["换句话说，", "我补一句，", "这句换个说法，"]
      : ["我换个说法，", "再直白一点，", "我补一句，"];
  return `${sample(nudges, 1, rng)[0] ?? "我换个说法，"}${value}`;
}

function reduceClauseStacking(text) {
  let value = `${text ?? ""}`.trim();
  if (!value) {
    return value;
  }
  value = value
    .replace(/如果你要记，先记我是\s*([^，。；！？]+)，但别替我公开。?/g, "你可以先记我是$1。别替我公开。")
    .replace(/如果你要记，先记我更像\s*([^，。；！？]+)，但先别替我公开。?/g, "你可以先记我更像$1。别替我公开。")
    .replace(/这局我先说自己是\s*([^，。；！？]+)，后面不会平白换身份。?/g, "没有新情况我不会换。")
    .replace(/我可以私下跟你说，我是\s*([^，。；！？]+)，先别替我在公聊里摊开/g, "我可以私下跟你说，我是$1。先别替我在公聊里说");

  const splitLongClause = (sentence) => {
    const commaCount = (sentence.match(/，/g) ?? []).length;
    if (sentence.length < 42 || commaCount < 3) {
      return sentence;
    }
    return sentence
      .replace(/，但是/g, "。但是")
      .replace(/，但/g, "。但")
      .replace(/，不过/g, "。不过")
      .replace(/，只是/g, "。只是")
      .replace(/，先/g, "。先");
  };

  value = (value.match(/[^。！？]+[。！？]?/gu) ?? [value])
    .map((entry) => splitLongClause(entry.trim()))
    .filter(Boolean)
    .join("");

  return value
    .replace(/。{2,}/g, "。")
    .replace(/，。/g, "。")
    .replace(/\s+([，。；！？])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function polishConversationalText(text) {
  const value = `${text ?? ""}`
    .replace(/\.{3,}/g, "…")
    .replace(/我接一下前面的发言：我先回应一下：不是要带节奏，我只是觉得\s*([^。]+?)\s*这边还缺解释。/g, "$1 这边还缺解释。")
    .replace(/我接一下前面的发言：如果今天提/g, "如果今天提")
    .replace(/我接一下前面的发言：/g, "")
    .replace(/接前面一句：/g, "")
    .replace(/先回应前面的质疑/g, "先回应这点")
    .replace(/我先回应一下：不是要带节奏，我只是觉得\s*([^。]+?)\s*这边还缺解释。/g, "$1 这边还缺解释。")
    .replace(/身份口径我不改，还是\s*([^；。]+)[；。]?/g, "我这次还是说自己是 $1。")
    .replace(/先记我的说法，真要推到我身上我会补完整身份和信息。?/g, "先按这个说法记，真要推到我身上会补完整。")
    .replace(/我的身份口径是\s*([^；。]+)[；。]?/g, "我现在说自己是 $1。")
    .replace(/我的公开口径是\s*([^；。]+)[；。]?/g, "我公开会说自己是 $1。")
    .replace(/这局我目前的身份说法先按\s*([^，。；]+)\s*记，不会无理由改口。?/g, "这局我先说自己是 $1，后面不会平白换身份。")
    .replace(/如果你要记，就记我偏\s*([^，。；]+)\s*口径，但先别替我公开。?/g, "如果你要记，先记我是 $1，但别替我公开。")
    .replace(/身份我现在不想直接裸跳。你可以先记我不是空白位；如果今天真的要推我，我会补完整口径。?/g, "我现在先不把身份说死。真要推到我身上，我会把身份和信息补完整。")
    .replace(/给你完整口径：我是\s*/g, "我直接说：我是 ")
    .replace(/给你底牌式口径：我是\s*/g, "我直接跟你说：我是 ")
    .replace(/身份我先不给死，只给你可公开的口径范围：/g, "我先不把身份说满，只告诉你大概方向：")
    .replace(/身份我先不给死，只给你口径范围：/g, "我先不把身份说满，只给你大概方向：")
    .replace(/先按\s*([^，。；]+)\s*这条口径聊信息/g, "先按 $1 的身份聊信息")
    .replace(/偏\s*([^，。；]+)\s*口径/g, "更像 $1")
    .replace(/先记\s*([^，。；]+)\s*方向，真到票前我会把口径补齐。?/g, "先按 $1 方向听我，真到票前我会说完整。")
    .replace(/先记我的口径，真要推到我身上我会补完整身份链。?/g, "我现在先不把身份说死，真要推到我身上会补完整。")
    .replace(/先按我现在说的听，真要推到我身上我会把身份和信息补完整。?/g, "我现在先不把身份说死，真要推到我身上会补完整。")
    .replace(/这条先当私下口径，别直接替我公开。?/g, "这句先只在我们之间，别替我公开。")
    .replace(/先让\s*([0-9]+号|[^，。；！？\s]+)\s*把自己的口径补完整/g, "先让 $1 把自己的说法补完整")
    .replace(/你可以先让\s*([0-9]+号|[^，。；！？\s]+)\s*把身份范围和信息来源说清楚/g, "你可以先让 $1 把身份和昨晚信息说清楚")
    .replace(/先给身份范围，再给一条能被别人复核的信息/g, "先说大概身份，再给一条别人能对得上的信息")
    .replace(/身份范围和信息来源/g, "身份和昨晚信息")
    .replace(/身份说法/g, "身份")
    .replace(/信息来源/g, "这条信息从哪来")
    .replace(/身份范围/g, "大概身份")
    .replace(/公开身份口径|私聊身份口径|身份口径|公开口径|私下口径|口径/g, "身份")
    .replace(/无理由改口/g, "平白换说法")
    .replace(/改口/g, "换说法")
    .replace(/可公开验证/g, "大家能验证")
    .replace(/公开验证/g, "大家验证")
    .replace(/交叉验证/g, "互相对得上")
    .replace(/可复核/g, "能对得上")
    .replace(/复核/g, "再对一下")
    .replace(/（先再对一下）/g, "")
    .replace(/（先对一下）/g, "")
    .replace(/（先打折听）/g, "，先打折听")
    .replace(/身份链/g, "身份和信息")
    .replace(/硬信息/g, "实打实的信息")
    .replace(/裸跳/g, "直接跳身份")
    .replace(/摊开/g, "说出来")
    .replace(/摊太满/g, "说太满")
    .replace(/全摊/g, "全说")
    .replace(/目前能交代的是/g, "我现在能说的是")
    .replace(/卡点是：/g, "我卡在这儿：")
    .replace(/证据还薄：/g, "现在还不够：")
    .replace(/我卡在这儿：公开信息还不够，先听…/g, "现在还不够，先听回应")
    .replace(/现在还不够：公开信息还不够，先听…/g, "现在还不够，先听回应")
    .replace(/我卡在这儿：(?:发言)?…（先对一下）。?/g, "我卡在这儿：前面的发言还要回看。")
    .replace(/发言…（先对一下）/g, "前面的发言还要回看")
    .replace(/先再对一下/g, "先对一下")
    .replace(/下一句我会问\s*([0-9]+号)\s*：\s*([^。；！？]+)/g, "接下来先问 $1：$2")
    .replace(/我会问\s*([0-9]+号)\s*：\s*([^。；！？]+)/g, "先问 $1：$2")
    .replace(/我会问\s*([0-9]+号)\s*：?/g, "先问 $1")
    .replace(/票前我会问：/g, "票前先问：")
    .replace(/我会先问/g, "我先问")
    .replace(/刚才那条线我还没改，还是围绕\s*([0-9]+号)\s*看/g, "刚才那条我还没撤，还是先看 $1")
    .replace(/我暂时不换目标，还是先看/g, "这条先不撤，还是看")
    .replace(/我先不把话说死，先看/g, "我先看")
    .replace(/我现在第一关注还是\s*([0-9]+号)/g, "现在先看 $1")
    .replaceAll("这题我分两层看。", "我直说吧。")
    .replaceAll("这局先别急着拍死，问出反应比一句结论更值钱。", "先别急着定死，问一句看反应更有用。")
    .replaceAll("问出反应比一句结论更值钱", "问一句看反应更有用")
    .replaceAll("我可以私下报给你：我是", "我可以私下跟你说，我是")
    .replaceAll("但先别在公聊里替我摊开", "先别替我在公聊里摊开")
    .replace(/([0-9]+号|[^，。；！？\s（）]+)（(?:暂时偏清白|信息不足|偏可疑|高度可疑)(?:，约\s*\d+%)?）/g, "$1")
    .replace(/核心还是\s*/g, "主要还是")
    .replace(/主要还是\s+有人私下提到/g, "因为有人私下提到")
    .replace(/因为\s+有人私下提到/g, "因为有人私下提到")
    .replace(/我私下听到的口径把焦点指向\s*([0-9]+)\s*号/g, "有人私下提到 $1 号")
    .replace(/但别只盯身份，眼下我更想听\s*([^。]+?)\s*怎么解释。/g, "但先别只盯我的身份，我更想听 $1 怎么说。")
    .replace(/可互相对得上的信息/g, "能互相对上的信息")
    .replace(/我是\s+([^，。；！？\s]+)\s+([，。；！？])/g, "我是$1$2")
    .replace(/我是\s+([^，。；！？\s]+)([，。；！？])/g, "我是$1$2")
    .replace(/我先跳\s+([^，。；！？\s]+)([，。；！？])/g, "我先跳$1$2")
    .replace(/我公开报身份：我是/g, "公开身份：")
    .replace(/我先跳一下，我是/g, "先跳")
    .replace(/我会看解释和票型/g, "先看防守和票型")
    .replace(/回应质量/g, "防守有没有东西")
    .replace(/解释质量/g, "防守有没有东西")
    .replace(/等\s+他\s+回应/g, "等他回应")
    .replace(/\s+号/g, "号")
    .replace(/\s+。/g, "。")
    .replace(/\s+/g, " ")
    .trim();
  return reduceClauseStacking(value);
}

function rememberSpeechStyle(aiPlayer, text) {
  const memory = ensureSpeechStyleMemory(aiPlayer);
  const value = `${text ?? ""}`.trim();
  if (!value) {
    return;
  }
  memory.recentLines.push(value);
  if (memory.recentLines.length > 8) {
    memory.recentLines.splice(0, memory.recentLines.length - 8);
  }
  Object.keys(COOLDOWN_PHRASE_REPLACEMENTS).forEach((phrase) => {
    if (value.includes(phrase)) {
      memory.recentPhrases.push(phrase);
    }
  });
  if (memory.recentPhrases.length > 20) {
    memory.recentPhrases.splice(0, memory.recentPhrases.length - 20);
  }
}

function reducePublicSelfDensity(text, options = {}) {
  let value = `${text ?? ""}`.trim();
  if (options.audience !== "public" || (value.match(/我/g) ?? []).length < 5) {
    return value;
  }
  value = value
    .replace(/我公开报身份：我是\s*([^。；，！？\s]+)[。；，！？]?/g, "公开身份：$1。")
    .replace(/我先跳一下，我是\s*([^。；，！？\s]+)[。；，！？]?/g, "先跳 $1。")
    .replace(/我先跳\s*([^。；，！？\s]+)[。；，！？]?/g, "先跳 $1。")
    .replace(/我把身份放桌上/g, "身份先放桌上")
    .replace(/我的意思是：/g, "换句话说：")
    .replace(/我接一下前面的发言/g, "我补一个判断")
    .replace(/接前面一句/g, "我补一个判断")
    .replace(/我先回应一下/g, "先回应一下")
    .replace(/我不是硬保/g, "不是硬保")
    .replace(/我只是觉得/g, "只是觉得")
    .replace(/我先把\s*([^，。；！？]+?)\s*放进/g, "先把 $1 放进")
    .replace(/我先看/g, "先看")
    .replace(/我先压/g, "先压")
    .replace(/我先记/g, "先记")
    .replace(/我先暗记/g, "先暗记")
    .replace(/我先问/g, "先问")
    .replace(/我会问/g, "接下来问")
    .replace(/我会看/g, "先看")
    .replace(/我会先看/g, "先看")
    .replace(/我会认真考虑/g, "可以认真考虑")
    .replace(/我会把/g, "会把")
    .replace(/我会/g, "会")
    .replace(/我想/g, "想")
    .replace(/\s+/g, " ")
    .trim();
  if ((value.match(/我/g) ?? []).length >= 5) {
    value = value.replace(/我/g, (match, offset) => (offset === value.indexOf("我") ? match : ""));
  }
  return value;
}

export function applySpeechBudget(text, options = {}) {
  let value = `${text ?? ""}`.replace(/\s+/g, " ").trim();
  if (!value) {
    return value;
  }
  const audience = options.audience ?? "private";
  const maxSentences =
    options.maxSentences ?? (audience === "public" ? 2 : audience === "nomination" ? 2 : 3);
  const maxChars = options.maxChars ?? (audience === "public" ? 150 : audience === "nomination" ? 120 : 180);
  const sentences = value.match(/[^。！？；]+[。！？；]?/gu)?.map((entry) => entry.trim()).filter(Boolean) ?? [value];
  const evidenceSentence = sentences.find((entry) => /(我现在抓的点|这条还弱|卡点是|我卡在这儿|证据还薄|短线|弱证据说明|证据线)：|进提名池|提名前|如果今天提/.test(entry));
  const followUpSentence = sentences.find((entry) => /(反问一句|下一句我会|下一步|票前我会问|我下|追问)/.test(entry));
  if (sentences.length > maxSentences) {
    const kept = sentences.slice(0, maxSentences);
    const requiredSentence = audience === "private" ? followUpSentence ?? evidenceSentence : evidenceSentence ?? followUpSentence;
    if (requiredSentence && !kept.includes(requiredSentence)) {
      kept[Math.max(0, kept.length - 1)] = requiredSentence;
    }
    value = kept.join("");
  }
  if (value.length > maxChars) {
    const suffix = "…";
    if (evidenceSentence && value.includes(evidenceSentence) && evidenceSentence.length < maxChars - 12) {
      const prefixBudget = Math.max(0, maxChars - evidenceSentence.length - suffix.length - 1);
      const prefix = value.slice(0, prefixBudget).trim();
      value = `${prefix}${suffix}${evidenceSentence}`;
    } else {
      value = `${value.slice(0, Math.max(0, maxChars - suffix.length)).trim()}${suffix}`;
    }
  }
  return value
    .replace(/我卡在这儿：[^。！？；]*…（先对一下）。?/g, "我卡在这儿：前面的发言要回看。")
    .replace(/我卡在这儿：(?:发言)?…（先对一下）。?/g, "我卡在这儿：前面的发言要回看。")
    .replace(/我卡在这儿：发言…（先对一下）。?/g, "我卡在这儿：前面的发言要回看。")
    .trim();
}

export function applyHumanSpeechCadence(state, aiPlayer, text, rng = Math.random, options = {}) {
  let value = stripDuplicateHumanOpeners(text);
  if (!value || alreadyHasHumanCadence(value)) {
    value = applyPhraseCooldown(value, aiPlayer, rng);
    value = polishConversationalText(value);
    value = differentiateRepeatedSpeech(value, aiPlayer, rng, options);
    value = applySpeechBudget(value, options);
    value = reducePublicSelfDensity(value, options);
    rememberSpeechStyle(aiPlayer, value);
    return value;
  }

  const shouldBridge =
    options.force ||
    (options.audience === "private" &&
      [QUESTION_INTENT.REASON, QUESTION_INTENT.SUSPECT, QUESTION_INTENT.VOTE, QUESTION_INTENT.COMPARE, QUESTION_INTENT.PLAN].includes(options.intent)) ||
    (options.audience === "public" && ((options.roundInDay ?? 1) >= 2 || (options.focusScore ?? 0) >= 0.62 || rng() < 0.35));

  if (!shouldBridge) {
    value = applyPhraseCooldown(value, aiPlayer, rng);
    value = polishConversationalText(value);
    value = differentiateRepeatedSpeech(value, aiPlayer, rng, options);
    value = applySpeechBudget(value, options);
    value = reducePublicSelfDensity(value, options);
    rememberSpeechStyle(aiPlayer, value);
    return value;
  }
  value = insertCadenceBridge(value, bridgePhraseForSpeech(aiPlayer, options));
  value = applyPhraseCooldown(value, aiPlayer, rng);
  value = polishConversationalText(value);
  value = differentiateRepeatedSpeech(value, aiPlayer, rng, options);
  value = applySpeechBudget(value, options);
  value = reducePublicSelfDensity(value, options);
  rememberSpeechStyle(aiPlayer, value);
  return value;
}
