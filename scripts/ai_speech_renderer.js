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

export const PLAYER_VISIBLE_FORBIDDEN_TERMS = [
  "私下入口",
  "定性",
  "公开追问",
  "自洽",
  "降压",
  "降权",
  "主压力位",
  "证据联动",
  "判定标准",
  "举证责任",
  "世界分支",
  "角色假说",
];

export const TABLE_SPEECH_LIMITS = Object.freeze({
  public: Object.freeze({ maxSentences: 2, maxChars: 115 }),
  nomination: Object.freeze({ maxSentences: 2, maxChars: 120 }),
  private: Object.freeze({ maxSentences: 3, maxChars: 170 }),
  "ai-private": Object.freeze({ maxSentences: 3, maxChars: 170 }),
});

function normalizeCurrentTableAction(text) {
  let value = `${text ?? ""}`
    .replace(/下一句我会问\s*([0-9]+号)/gu, "先问$1")
    .replace(/让后续追问接着核/gu, "这轮先按这条核")
    .replace(/要看后续回应/gu, "现在先听回应")
    .replace(/票前我会问[：:]?\s*([0-9]+号)/gu, "票前先听$1")
    .replace(/我会问\s*([0-9]+号)/gu, "先问$1")
    .replace(/下一句我会/gu, "这句先")
    .replace(/我会问你/gu, "先问你")
    .replace(/死人不用再藏太多，我把能说的交给你/gu, "我已经死了，咱们在一边聊，我把能说的交给你")
    .replace(/提名前先把/gu, "先把")
    .replace(/到投票我会看\s*(\d+号)\s*有没有补出解释，没补就按压力票处理/gu, "$1先补解释，这票暂按压力票")
    .replace(/到投票我会看\s*(\d+号)\s*的回应有没有东西，不是闭眼跟/gu, "我先听$1回应，这票不是闭眼跟")
    .replace(/如果今天要动流程，我会先看\s*(\d+号)，但票前还要听解释/gu, "我先看$1，现在先听解释")
    .replace(/如果今天要动流程，我会先把\s*(\d+号)\s*放进候选/gu, "我先把$1放进候选")
    .replace(/如果提\s*(\d+号)，我(?:倾向先看|会看)回应(?:质量)?再决定票/gu, "$1上台我先听回应，这票暂不锁")
    .replace(/我会重排/gu, "再重排")
    .replace(/我不无理由改口/gu, "我不会空口改")
    .replace(/验证点是(?:先)?/gu, "")
    .replace(/核法是让/gu, "让")
    .replace(/提名前重新看(\d+号)：(?:我的意思是，)?/gu, "我先看$1，")
    .replace(/先问(\d+号)，身份和昨晚信息/gu, "$1先补身份和昨晚信息")
    .replace(/我先排(\d+号)，不是放过(\d+号)：\1这边公开线索更多/gu, "$2先放着，$1的公开线索更多")
    .replace(/如果提(\d+号)，我会先看回应/gu, "$1上台我先听回应，这票暂不锁")
    .replace(/后续看(\d+号)能不能接上身份，接不住再决定要不要提/gu, "$1现在先接身份，我先把他放到火力点")
    .replace(/(\d+号)\s*先进入观察位，回应之后再重排/gu, "$1先留在视野里，现在把问题讲清")
    .replace(/这条线先摆在桌上，等回应后再决定/gu, "这条线先摆在桌上，现在听回应")
    .replace(/(\d+号)(?:\s*这边)?\s*先放进观察位，等\s*(?:ta|他|她)\s*回应后再定/gu, "$1先放进观察位，现在听回应")
    .replace(/如果要推，说法可以是[，,:：]\s*/gu, "台面理由是：")
    .replace(/如果要推[，,:：]?/gu, "要推就看")
    .replace(/先这样，等今天公聊跑一轮再决定要不要提名/gu, "先这样，今天公聊就让他把身份和站边讲清")
    .replace(/再决定要不要提/gu, "这轮先放进提名位")
    .replace(/接不住就进提名位/gu, "这轮先放进提名位")
    .replace(/再决定投不投/gu, "这票暂不锁")
    .replace(/，?票面约\s*[^，。；]+/gu, "")
    .replace(/(\d+号)我过不去的是/gu, "我先看$1，过不去的是")
    .replace(/再补身份和昨晚信息要补清/gu, "身份和昨晚信息也要补清")
    .replace(/这条让(\d+号)把票型解释清，身份和昨晚信息也/gu, "$1先解释票型，再补身份和昨晚信息")
    .replace(/(\d+号)先解释票型，身份和昨晚信息也要补清，这条先让\1把票型解释清，身份和昨晚信息也要补清/gu, "$1先解释票型，再补身份和昨晚信息")
    .replace(/(\d+号)先解释票型，身份和昨晚信息也要补清，先听\1解释票型，昨晚信息和身份说法也要补清/gu, "$1先解释票型，再补身份和昨晚信息")
    .replace(/(先看(\d+号)：我过不去的是：([^。！？；，]+))，我先看\2，我过不去的是：\3/gu, "$1")
    .replace(/\s*如果[^。！？；]{0,56}我会降级这条/gu, "")
    .replace(/(\d+号)先放主线，(\d+号)留在第二层：现在(?:我可见的|公开)?线索更多压在\1/gu, "我先看$1，$2先放着：$1的线索更多")
    .replace(/(\d+号)和(\d+号)贴线时，先比较/gu, "$1先放前面，$2不是放掉：先比")
    .replace(/桌面问题连在一起：/gu, "台面上我卡的是：")
    .replace(/^(?:嗯，)?先说清楚，身份先不换，我这轮还是看(\d+号)[；;]?/u, "上一轮先看$1，这轮还是围绕$1。")
    .replace(/(\d+号)这边我先给压力，不要等到落票前才补说法/gu, "$1先上压力，再补说法")
    .replace(/(?:我卡的是这组线索|台面上我卡的是)：(\d+号)的公开站队和台面压力、可见记录：\1刚才投票态度要解释/gu, "$1先上压力：公开压力和票型互相推高，解释票型再补说法")
    .replace(/先把这组线放到同一桌面：(\d+号)的公开站队和台面压力、可见记录：\1的投票理由要补清/gu, "这条让$1把身份线和票型对上，再解释投票理由")
    .replace(/这条让(\d+号)把身份和票型对上，再解释投票理由。(?:我先看\1，)?这条让\1把身份线和票型对上，再解释投票理由。/gu, "这条让$1把身份线和票型对上，再解释投票理由。")
    .replace(/两条线先并起来看：(\d+号)的公开站队和台面压力、被推上台面/gu, "两条线合在一起：$1的身份和提名压力卡在一起，先请$1解释身份和提名压力")
    .replace(/这两点合着看：(\d+号)的公开站队和台面压力、被推上台面/gu, "提名前，$1的身份和提名压力卡在一起")
    .replace(/先听(\d+号)为什么推低证据位，再把身份和大家验证对上/gu, "两条线合在一起：$1低证据推人和身份对不上卡在一起，先听$1解释为什么推低证据位，再把身份和大家验证对上")
    .replace(/(身份[^。；]{0,96}(?:公开说法接上|身份说法和票型补清楚))(?=[。；])/gu, "$1，对不上再票我")
    .replace(/这轮可以拿我验，但先听完整防守。(?=提名卡的是：[^。]*推低证据位)/gu, "先验我说的点，别跳过防守。")
    .replace(/这轮可以拿我验，但先听完整防守。(?=提名卡的是：[^。]*死亡信息和票型)/gu, "我先防一下，保护链讲清前别跳过防守。")
    .replace(/这轮可以拿我验，但先听完整防守。(?=提名卡的是：[^。]*昨晚信息和公开报法)/gu, "先听我接这条，信息链讲完前别只催票。")
    .replace(/这个推进也要记/gu, "这条也要记")
    .replace(/([。！？；.!?;])\s+(?=\S)/gu, "$1")
    .replace(/[，：；,:;]\s*$/u, "。")
    .replace(/\s+/g, " ")
    .trim();
  value = value.replace(/^[、，；：,.!?;:\s]+/u, "");
  const firstSeat = value.match(/\d+号/u)?.[0] ?? "";
  if (firstSeat && /^这条我不是轻轻记一笔了，是需要马上听回应/u.test(value)) {
    value = value.replace(/^这条我不是轻轻记一笔了，是需要马上听回应/u, `我先看${firstSeat}，这条直接压，需要马上听回应`);
  }
  if (firstSeat && /^(前面发言没讲清楚|这点还不够|公开信息还不够)/u.test(value)) {
    value = `我先看${firstSeat}，${value}`;
  }
  return value;
}

function tableSpeechSentences(text) {
  const protectedValue = `${text ?? ""}`.replace(/(\d)\.(\d)/gu, "$1__DECIMAL_POINT__$2");
  return protectedValue
    .match(/[^。！？；.!?;]+[。！？；.!?;]?/gu)
    ?.map((entry) => entry.replaceAll("__DECIMAL_POINT__", ".").trim())
    .filter(Boolean) ?? [];
}

function tableSpeechComparable(text) {
  return `${text ?? ""}`.replace(/[，。！？；：,.!?;:\s]/gu, "").replace(/我/gu, "").trim();
}

function tableSpeechConclusionKey(text) {
  const value = `${text ?? ""}`;
  if (/前面发言没讲清楚|发言没讲清|没讲清的点.*(?:补清|补上|说完整)/u.test(value)) return "unclear-speech";
  if (/公开信息还不够|这点还不够/u.test(value)) return "thin-public-evidence";
  if (/压低证据位/u.test(value)) return "low-evidence-pressure";
  if (/低证据推人和身份.*对不上/u.test(value)) return "low-evidence-identity";
  if (/身份线和票型.*咬住/u.test(value)) return "identity-vote";
  if (/公开压力和票型.*推高/u.test(value)) return "pressure-vote";
  if (/身份(?:说法)?和提名压力.*卡在一起/u.test(value)) return "identity-nomination";
  return "";
}

function tableSpeechSentenceScore(sentence, index, priorityFragments = []) {
  const value = `${sentence ?? ""}`;
  let score = Math.max(0, 8 - index);
  if (/(真实身份|我是[^，。；！？]{1,16}(?:恶魔|爪牙)|台面.*(?:伪装|身份))/u.test(value)) score += 190;
  if (/(队伍先对齐|底牌|队伍信息|邪恶视角先对底|队伍牌面|爪牙位|恶魔位|恶魔是)/u.test(value)) score += 185;
  if (/(死了|死人|出局|遗言)/u.test(value)) score += 175;
  if (/(昨天|天前|新起线|今天转)/u.test(value)) score += 180;
  if (/(刚才那条线|还是围绕|暂时不换目标|还是先看|接着刚才)/u.test(value)) score += 160;
  if (/(身份线我不改|身份线不改|身份我先不换|这条我先不换|这轮不改身份|(?:口径|说法)这轮不改|我不无理由改口|我不会空口改|身份先沿用|身份线今天不重开|我先稳住|前面报过|身份范围暂时沿用|我还按)/u.test(value)) score += 175;
  if (/(马上听回应|需要马上听回应)/u.test(value)) score += 165;
  if (/\d+号/u.test(value)) score += 18;
  if (/(身份|昨晚|夜里|发言|回应|站边|票型|投票|提名|没讲清|对不上|过不去|怀疑|理由)/u.test(value)) score += 20;
  if (/(先看|先问|先听|补身份|补昨晚|解释|回应|我提|我投|不投|支持|反对|放着|排)/u.test(value)) score += 12;
  if (/(直接答|接着刚才|先说清楚|直接说)/u.test(value)) score += 55;
  if (/^(嗯|简单讲|我接着刚才|我先说人话版|先给结论|这件事我有点想法)[，。]/u.test(value)) score -= 36;
  if (/(来源.*节奏|先拆(?:独立)?来源|同源回声|收益线|加权|权重|举证|动机|两种可能|身份可能)/u.test(value)) score -= 60;
  for (const fragment of priorityFragments) {
    if (!fragment || !hasPriorityFragment(value, fragment)) continue;
    const keyBoost = fragment.key === "claim" ? 170 : fragment.key === "state" ? 165 : fragment.key === "continuity" ? 150 : fragment.key === "target" ? 70 : fragment.key === "evidence" ? 60 : fragment.key === "question" ? 45 : 20;
    score += keyBoost + Math.max(0, Number(fragment.priority) || 0) * 4;
  }
  return score;
}

function isAnalysisReportSentence(sentence) {
  return /(来源.*节奏|先拆(?:独立)?来源|按来源拆开|独立信息|分开算|同源回声|收益线|加权|权重|举证|动机|两种可能|身份可能|好身份解释|坏身份伪装线|最后看谁该说明|解桌|转移压力)/u.test(`${sentence ?? ""}`);
}

function trimTableSentenceToChars(sentence, maxChars) {
  const clean = `${sentence ?? ""}`.replace(/[，。！？；：,.!?;:\s]+$/u, "").trim();
  if (clean.length <= maxChars) {
    return /[。！？.!?]$/u.test(`${sentence ?? ""}`) ? `${sentence ?? ""}`.trim() : `${clean}。`;
  }
  const clipped = clean.slice(0, Math.max(1, maxChars - 1));
  const naturalCut = Math.max(clipped.lastIndexOf("，"), clipped.lastIndexOf(","));
  const body = (naturalCut >= Math.floor(maxChars * 0.55) ? clipped.slice(0, naturalCut) : clipped).trim();
  return `${body.replace(/[，。！？；：,.!?;:\s]+$/u, "")}。`;
}

function tableSpeechPrefixWithinChars(text, maxChars) {
  const kept = [];
  let used = 0;
  for (const sentence of tableSpeechSentences(text)) {
    if (used + sentence.length > maxChars) break;
    kept.push(sentence);
    used += sentence.length;
  }
  if (kept.length > 0) return kept.join("");
  return trimTableSentenceToChars(tableSpeechSentences(text)[0] ?? text, maxChars);
}

function compactNominationTableSpeech(text, maxChars) {
  const sentences = tableSpeechSentences(text);
  if (sentences.length <= TABLE_SPEECH_LIMITS.nomination.maxSentences && text.length <= maxChars) return text;
  const targetSentence = sentences.find((entry) => /(?:我先提|我提)\s*\d+号/u.test(entry)) ?? "";
  const target = targetSentence.match(/\d+号/u)?.[0] ?? "";
  const comparisonSentence = sentences.find((entry) => /(不是放过|不是放掉|不是清掉|排第二|先放主线|放前面)/u.test(entry)) ?? "";
  const strategySentence =
    sentences.find((entry) => /^(?:这票|票面|门槛|压力测试|愿意跟|推进|空过|执行信息|跟票)/u.test(entry)) ??
    sentences.find((entry) => /(不是空过|空过风险|不是空聊)/u.test(entry)) ??
    "";
  const evidenceCandidates = sentences.filter((entry) =>
    entry !== targetSentence &&
    entry !== comparisonSentence &&
    entry !== strategySentence
  );
  const evidenceSentence =
    evidenceCandidates.find((entry) => /(台面理由|上台讲清楚|放进流程)/u.test(entry)) ??
    evidenceCandidates[0] ??
    "";
  if (!target || !strategySentence) return text;

  const targetBody = targetSentence
    .replace(new RegExp(`^(?:我先提|我提)\\s*${target}[：:]?`, "u"), "")
    .replace(/[。！？；.!?;]+$/u, "")
    .trim();
  const embeddedComparison = targetBody.match(/(?:不是放过|不是放掉|不是清掉|排第二|先放主线|放前面)[^。！？；.!?;]*$/u)?.[0] ?? "";
  const evidence = (evidenceSentence || targetBody.replace(embeddedComparison, ""))
    .replace(/^这条还没到拍死，但/u, "")
    .replace(/^这条/u, "")
    .replace(/前面发言没讲清楚，这点过不去/u, "发言没讲清")
    .replace(/[，,:：]\s*$/u, "")
    .replace(/[。！？；.!?;]+$/u, "")
    .trim();
  const comparison = (embeddedComparison || (comparisonSentence === targetSentence ? "" : comparisonSentence))
    .replace(/这边公开线索更多，先上台更好验/u, "公开线索更多")
    .replace(/[。！？；.!?;]+$/u, "")
    .trim();
  const strategy = /[。！？.!?]$/u.test(strategySentence) ? strategySentence : `${strategySentence.replace(/[；;]+$/u, "")}。`;
  let primary = `我先提${target}：${evidence}${comparison ? `，${comparison}` : ""}。`;
  if (primary.length + strategy.length > maxChars) {
    primary = trimTableSentenceToChars(primary, Math.max(18, maxChars - strategy.length));
  }
  const compact = `${primary}${strategy}`;
  return compact.length <= maxChars ? compact : text;
}

function compactTableSpeech(text, { audience = "", maxSentences, maxChars, priorityFragments = [] } = {}) {
  let value = normalizeCurrentTableAction(text);
  if (!value) return value;
  if (audience === "nomination") {
    value = compactNominationTableSpeech(value, maxChars);
  }
  const normalizedPriority = (priorityFragments ?? []).map(normalizePriorityFragment).filter(Boolean);
  const unique = [];
  const seen = new Set();
  for (const sentence of tableSpeechSentences(value)) {
    const key = tableSpeechComparable(sentence);
    if (!key || seen.has(key)) continue;
    const containedIndex = unique.findIndex((entry) => {
      const existingKey = tableSpeechComparable(entry);
      return key.includes(existingKey) || existingKey.includes(key);
    });
    if (containedIndex >= 0) {
      const existingKey = tableSpeechComparable(unique[containedIndex]);
      if (key.includes(existingKey) && /(在台上|回应质疑|提名前|投票前)/u.test(sentence)) {
        seen.delete(existingKey);
        unique[containedIndex] = sentence;
        seen.add(key);
      }
      continue;
    }
    const conclusionKey = tableSpeechConclusionKey(sentence);
    const conclusionIndex = conclusionKey
      ? unique.findIndex((entry) => tableSpeechConclusionKey(entry) === conclusionKey)
      : -1;
    if (conclusionIndex >= 0) {
      const existing = unique[conclusionIndex];
      const hasAction = /(先听|先请|这条让|解释|回应|补)/u.test(sentence);
      const existingHasAction = /(先听|先请|这条让|解释|回应|补)/u.test(existing);
      if ((hasAction && !existingHasAction) || (hasAction === existingHasAction && sentence.length < existing.length)) {
        seen.delete(tableSpeechComparable(existing));
        unique[conclusionIndex] = sentence;
        seen.add(key);
      }
      continue;
    }
    seen.add(key);
    unique.push(sentence);
  }
  if (unique.length === 0) return value;

  const scored = unique.map((sentence, index) => ({
    sentence,
    index,
    score: tableSpeechSentenceScore(sentence, index, normalizedPriority),
  }));
  const tableCandidates = scored.filter((entry) => !isAnalysisReportSentence(entry.sentence));
  let selected = tableCandidates.length > 0 ? tableCandidates : scored;
  if (selected.length > maxSentences) {
    selected = [...selected]
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .slice(0, maxSentences)
      .sort((a, b) => a.index - b.index);
  }
  while (selected.length > 1 && selected.map((entry) => entry.sentence).join("").length > maxChars) {
    const removable = [...selected].sort((a, b) => a.score - b.score || b.index - a.index)[0];
    selected = selected.filter((entry) => entry !== removable);
  }
  value = selected.map((entry) => entry.sentence).join("");
  if (maxSentences <= 2) {
    const perSentenceMax = Math.min(72, maxChars);
    value = tableSpeechSentences(value)
      .map((sentence) => sentence.length > perSentenceMax ? trimTableSentenceToChars(sentence, perSentenceMax) : sentence)
      .join("");
  }
  if (value.length > maxChars) {
    value = trimTableSentenceToChars(value, maxChars);
  }
  return normalizeCurrentTableAction(value);
}

function looksLikeTableSpeech(text) {
  return /(\d+号|身份|昨晚|夜里|发言|票型|投票|提名|怀疑|回应)/u.test(`${text ?? ""}`);
}

function hasAlliedHiddenTruthMarkers(text) {
  const value = `${text ?? ""}`;
  const hasTeamContext = /(自己人|一边的|邪恶视角|对底|队伍信息|队伍牌面|恶魔位|爪牙位)/u.test(value);
  const hasHiddenFact = /(真实身份|邪恶互认|恶魔伪装|爪牙位|恶魔(?:是)?\d+号)/u.test(value);
  const hasPairedRoleTruth = /真实身份/u.test(value) && /(爪牙位|恶魔(?:是)?\d+号)/u.test(value);
  return hasHiddenFact && (hasTeamContext || hasPairedRoleTruth);
}

function compactAlliedHiddenTruthIntro(text) {
  const sentences = tableSpeechSentences(text);
  const intro = sentences.filter((sentence) =>
    /(自己人|一边的|邪恶视角|对底|队伍信息|队伍牌面|知道的底牌|恶魔(?:是)?\d+号|爪牙|真实身份)/u.test(sentence)
  );
  const fusedIntro = intro.length >= 2
    ? `${intro.map((sentence) => sentence.replace(/[。！？；]+$/u, "").trim()).join("，")}。`
    : "";
  let rest = intro.length >= 2 ? sentences.filter((sentence) => !intro.includes(sentence)) : [...sentences];
  const actionIndex = rest.findIndex((sentence) => /\d+号.*(?:压|提名|观察|身份|回应)/u.test(sentence));
  if (intro.length >= 2 && actionIndex >= 0 && !/(台面安排|台面上|伪装|低信息好人)/u.test(rest[actionIndex])) {
    rest[actionIndex] = `台面上，${rest[actionIndex]}`;
  }
  const pressureTargets = new Set();
  rest = rest.filter((sentence) => {
    const target = sentence.match(/(\d+号)/u)?.[1] ?? "";
    if (!target || !/(火力点|提名位|讨论中心)/u.test(sentence)) return true;
    if (pressureTargets.has(target)) return false;
    pressureTargets.add(target);
    return true;
  });
  return `${fusedIntro}${rest.join("")}`;
}

export function sanitizePlayerVisibleText(text) {
  let value = normalizeChineseSeatSpacing(`${text ?? ""}`)
    .replace(/私下入口/g, "私聊线索")
    .replace(/公开追问/g, "当桌问清")
    .replace(/自洽/g, "能对上")
    .replace(/降压/g, "先放低")
    .replace(/降权/g, "先打折")
    .replace(/主压力位/g, "重点位置")
    .replace(/证据联动/g, "几条线一起看")
    .replace(/判定标准/g, "看点")
    .replace(/举证责任/g, "该谁解释")
    .replace(/世界分支/g, "两种可能")
    .replace(/角色假说/g, "身份可能")
    .replace(/身份链/g, "身份")
    .replace(/不能只按传话定性/g, "不能只按传话下结论")
    .replace(/定性/g, "下结论")
    .replace(/身份口径|身份说法/g, "身份")
    .replace(/公开口径/g, "公开说法")
    .replace(/私下口径|口径/g, "说法")
    .replace(/\s+/g, " ")
    .trim();
  const nominationSpeech = /(?:我先提|我提)\s*\d+号/u.test(value) && /(这票|票面|压力测试|空过|推进)/u.test(value);
  const alliedHiddenTruth = hasAlliedHiddenTruthMarkers(value);
  if (alliedHiddenTruth) value = compactAlliedHiddenTruthIntro(value);
  // Frozen ai.js calls this lexical sanitizer at its last visible boundary, so
  // table-shaped text also receives a hard cap here. Already-authorized allied
  // truth markers are fused to keep team/role facts inside that cap; only an
  // explicit ai-private budget call may expand the sentence allowance.
  const visibleLimits = nominationSpeech ? TABLE_SPEECH_LIMITS.nomination : TABLE_SPEECH_LIMITS.private;
  return looksLikeTableSpeech(value)
    ? compactTableSpeech(value, { ...visibleLimits, audience: nominationSpeech ? "nomination" : "private" })
    : normalizeCurrentTableAction(value);
}

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

function normalizeChineseSeatSpacing(text) {
  return `${text ?? ""}`
    .replace(/([0-9]+)\s+号/gu, "$1号")
    .replace(/(刚才|如果|昨天|今天|明天|前面)\s+([0-9]+号)/gu, "$1$2")
    .replace(/([与和及])\s+([0-9]+号)/gu, "$1$2")
    .replace(/(是|还是|为|按|报|跳|主线在|转到|转向|恶魔位|恶魔)\s+([0-9]+号)/gu, "$1$2")
    .replace(/(点过|给|放下|放回|放低|丢给|交给)\s+([0-9]+号)/gu, "$1$2")
    .replace(/(是|还是|为|按|报|跳)\s+([\u4e00-\u9fff]{1,12})(?=[，。；！？：、\s]|$)/gu, "$1$2")
    .replace(/(爪牙同伴|其他爪牙)\s+(暂无)/gu, "$1$2")
    .replace(/理由还是\s*可见记录：/gu, "理由还是这条可见记录：")
    .replace(/卡在\s+在/gu, "卡在")
    .replace(/卡在\s+(?=前面|推低|身份|公开|两条|[0-9]+号)/gu, "卡在")
    .replace(/换线\s+台面理由/gu, "换线。台面理由")
    .replace(/((?:我|你|大家|今天|这轮|票前)?(?:会|先|暂时|直接|继续|不)?(?:让|问|看|盯|对|排|压|转到|转|沿着|把|放过|放掉|提|举|投|跟|出|在))\s+([0-9]+号)/gu, "$1$2")
    .replace(/([0-9]+号)\s+(?=[\u4e00-\u9fff])/gu, "$1")
    .replace(/\s+([，。；！？：、])/gu, "$1")
    .replace(/([。！？；])\s+(?=\S)/gu, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

const HUMAN_CADENCE_MARKERS = ["换个说法", "说白了", "我的意思是", "换句话说", "先说清楚"];
const EMOTIONAL_TEXTURE_MARKERS = [
  "嗯，",
  "说实话，",
  "先别急，",
  "先别当铁证，",
  "这条先打折听，",
  "我不敢说死，",
  "我得防一下，",
  "这票先别锁，",
  "我有点",
  "我直说，",
  "别拖，",
  "我先留个心眼，",
  "我不太放心，",
  "票上我先说清，",
];
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

function hasEmotionalTexture(text) {
  const value = `${text ?? ""}`;
  return EMOTIONAL_TEXTURE_MARKERS.some((marker) => value.includes(marker));
}

function emotionContextForSpeech(text, state, aiPlayer, options = {}) {
  const value = `${text ?? ""}`;
  if (options.emotionContext) {
    return `${options.emotionContext}`;
  }
  if (
    options.selfNominated ||
    aiPlayer?.beenNominatedToday ||
    options.audience === "nomination" ||
    /被提名|上台|在台上|这票|锁票|投死|票型你们自己看|防守|辩解|互辩/.test(value)
  ) {
    return "on-block";
  }
  if (/醉酒|中毒|污染|脏信息|打折|别当铁证|可能被|暂时偏清白/.test(value)) {
    return "contaminated";
  }
  if (options.intent === "claim" || /我是|身份|跳身份|直接说身份|大概身份|昨晚信息/.test(value)) {
    return "claim";
  }
  if ((options.focusScore ?? 0) >= 0.72 || /放不下|过不去|马上听回应|需要马上听回应|先压|直接压|别拖/.test(value)) {
    return "strong-pressure";
  }
  if (/公开信息还不够|证据还薄|现在还不够|信息不够|先听回应|先别定死|这条还弱/.test(value)) {
    return "low-evidence";
  }
  if (options.intent === "vote" || /投票|上票|跟票|票型|处决/.test(value)) {
    return "vote";
  }
  if (options.intent === "night" || /昨晚|夜里|夜间信息|拿到/.test(value)) {
    return "night-info";
  }
  return "default";
}

function contextAlreadyHasEmotion(text, context) {
  const value = `${text ?? ""}`;
  if (!value) {
    return true;
  }
  if (context === "on-block") {
    return /先别急|我得防一下|这票先别锁|在台上|票型你们自己看/.test(value);
  }
  if (context === "contaminated") {
    return /打折听|别当铁证|不敢说死|可能被醉酒|可能被中毒/.test(value);
  }
  if (context === "strong-pressure") {
    return /我直说|别拖|说真的|马上听回应|直接压/.test(value);
  }
  if (context === "low-evidence") {
    return /先不定死|先别定死|这条还轻|先听回应|现在还不够/.test(value);
  }
  if (context === "vote") {
    return /票上我先说清|投票|票型/.test(value);
  }
  return false;
}

function stripGenericBridgeForEmotion(text, context) {
  const value = `${text ?? ""}`;
  if (!["on-block", "contaminated", "low-evidence", "vote", "night-info", "strong-pressure"].includes(context)) {
    return value;
  }
  return value.replace(/^(换个说法|说白了|我的意思是|换句话说|先说清楚)，\s*/u, "");
}

function emotionPrefixForSpeech(text, state, aiPlayer, options = {}, rng = Math.random) {
  const persona = aiPlayer?.aiPersona ?? PERSONA_TYPES.STEADY;
  const audience = options.audience ?? "private";
  const intent = options.intent ?? "";
  const context = emotionContextForSpeech(text, state, aiPlayer, options);
  if (context === "on-block") {
    return sample(["先别急，", "我得防一下，", "这票先别锁，"], 1, rng)[0] ?? "先别急，";
  }
  if (context === "contaminated") {
    return sample(["这条先打折听，", "先别当铁证，", "我不敢说死，"], 1, rng)[0] ?? "这条先打折听，";
  }
  if (context === "low-evidence") {
    return sample(["我先不定死，", "先别急着定，", "这条还轻，"], 1, rng)[0] ?? "我先不定死，";
  }
  if (context === "vote") {
    return sample(["票上我先说清，", "到票我会看，", "先别急着跟票，"], 1, rng)[0] ?? "票上我先说清，";
  }
  if (context === "night-info") {
    return sample(["嗯，", "说实话，", "我先把这条说清，"], 1, rng)[0] ?? "嗯，";
  }
  if (audience === "public" && !options.force && (options.focusScore ?? 0) < 0.58 && context === "default") {
    return "";
  }
  if (intent === "claim") {
    return sample(["嗯，", "我直接说，", "先别急，"], 1, rng)[0] ?? "嗯，";
  }
  if (persona === PERSONA_TYPES.PRESSURE) {
    return sample(["我直说，", "别拖，", "说真的，"], 1, rng)[0] ?? "我直说，";
  }
  if (persona === PERSONA_TYPES.SHADOW) {
    return sample(["我有点在意，", "我先留个心眼，", "我不太放心，"], 1, rng)[0] ?? "我有点在意，";
  }
  return sample(["嗯，", "说实话，", "我有点犹豫，但"], 1, rng)[0] ?? "嗯，";
}

function applyEmotionalTexture(text, state, aiPlayer, rng = Math.random, options = {}) {
  let value = `${text ?? ""}`.trim();
  if (!value || options.emotionalTexture === false || hasEmotionalTexture(value)) {
    return value;
  }
  const context = emotionContextForSpeech(value, state, aiPlayer, options);
  value = stripGenericBridgeForEmotion(value, context).trim();
  if (contextAlreadyHasEmotion(value, context)) {
    return value;
  }
  if (context !== "strong-pressure" && /^(换个说法|说白了|我的意思是|换句话说|先说清楚|我直说|我直接说|公开身份|先跳)/.test(value)) {
    return value;
  }
  const force = options.emotionalTexture === "force";
  const contextualForce = ["on-block", "contaminated", "low-evidence"].includes(context);
  const chance =
    context === "strong-pressure"
      ? 0.48
      : context === "vote"
        ? 0.36
        : options.audience === "private"
          ? 0.42
          : 0.22;
  if (!force && !contextualForce && rng() >= chance) {
    return value;
  }
  const prefix = emotionPrefixForSpeech(value, state, aiPlayer, options, rng);
  if (!prefix) {
    return value;
  }
  return `${prefix}${value}`
    .replace(/^(嗯，)+/g, "嗯，")
    .replace(/^(说实话，)+/g, "说实话，")
    .replace(/^(先别急，)+/g, "先别急，")
    .replace(/，我直接说身份/g, "，直接说身份")
    .trim();
}

export function differentiateRepeatedSpeech(text, aiPlayer, rng = Math.random, options = {}) {
  let value = `${text ?? ""}`.trim();
  if (!value || !aiPlayer) {
    return value;
  }
  const memory = ensureSpeechStyleMemory(aiPlayer);
  const recent = memory.recentLines ?? [];
  const audience = options.audience ?? "private";
  const repeatComparable = (line) => (audience === "public" ? normalizePublicSpeechText(line) : `${line ?? ""}`.trim());
  const comparableValue = repeatComparable(value);
  const exactRepeats = recent.filter((line) => repeatComparable(line) === comparableValue).length;
  if (exactRepeats <= 0) {
    return value;
  }
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
    .replace(/(目前能交代的是|我目前能说的是|手上(?:大家能验证|可公开验证)的部分是|先别当铁证，夜里拿到的是)：\s*身份直接摊：\s*([^。；！？]+)。\s*昨晚信息：\s*([^。；！？]+)。?/g, (_, lead, roleName, infoText) => {
      const role = `${roleName ?? ""}`.trim();
      const info = `${infoText ?? ""}`.replace(/^夜里拿到的/, "").trim();
      if (/先别当铁证/.test(lead)) {
        return `先别当铁证，我是${role}，昨晚拿到的是${info}。`;
      }
      if (/手上/.test(lead)) {
        return `能先给你验证的是，我是${role}，昨晚拿到的是${info}。`;
      }
      return `我现在能直接说，我是${role}，昨晚拿到的是${info}。`;
    })
    .replace(/身份直接摊：\s*([^。；！？]+)。\s*昨晚信息：\s*([^。；！？]+)。?/g, (_, roleName, infoText) => {
      const role = `${roleName ?? ""}`.trim();
      const info = `${infoText ?? ""}`.replace(/^夜里拿到的/, "").trim();
      return `我直接说身份，我是${role}，昨晚拿到的是${info}。`;
    })
    .replace(/昨晚信息：\s*夜里拿到的/g, "昨晚我拿到的")
    .replace(/昨晚信息：/g, "昨晚我拿到的是")
    .replace(/昨晚拿到的是([^，。；！？]{1,24})是\s*([0-9]+)/g, "昨晚拿到的$1是 $2")
    .replace(/拿来再对一下/g, "拿来对一下")
    .replace(/身份直接摊：/g, "我直接说身份，我是")
    .replace(/我有夜间信息，但现在能安全说的只有：我先不把格式交出来。/g, "我有夜间信息，但格式先不交出来。")
    .replace(/我有一条夜间信息，但现在能安全说的只有：说清格式基本就等于暴露身份。/g, "我有一条夜间信息，但格式现在不能说太细，说细了基本就暴露身份。")
    .replace(/手上(?:大家能验证|可公开验证)的部分是：/g, "能先给你验证的是，")
    .replace(/目前能交代的是：/g, "我现在能说的是，")
    .replace(/我目前能说的是：/g, "我现在能说的是，")
    .replace(/夜里拿到的是：/g, "夜里拿到的是")
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
    .replace(/：([^。！？；]*?)：/g, "，$1：")
    .replace(/，。/g, "。")
    .replace(/\s+([，。；！？])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupePrivateEvidenceMentions(text) {
  return `${text ?? ""}`
    .replace(/因为\s+有人/g, "因为有人")
    .replace(/(有人私下提到\s*([0-9]+)\s*号。(?:[^。！？]*[。！？]){0,2})有人私下提到\s*\2\s*号。?/g, "$1")
    .replace(/但这条可能被醉酒或中毒影响，先别当铁证/g, "但这条可能被醉酒或中毒影响")
    .replace(/这条可能被醉酒或中毒影响，先别当铁证/g, "这条可能被醉酒或中毒影响")
    .replace(/但这条可能有醉酒或中毒风险，先别当铁证/g, "但这条可能有醉酒或中毒风险")
    .replace(/这条可能有醉酒或中毒风险，先别当铁证/g, "这条可能有醉酒或中毒风险")
    .replace(/([，：。！？；])\s+/g, "$1")
    .replace(/\s+([，。；！？：])/g, "$1")
    .replace(/([0-9]+号)\s+这边/g, "$1这边")
    .replace(/([0-9]+号)\s+那条/g, "$1那条")
    .replace(/([0-9]+号)\s+(放进|进|被|先|需要|可以|把|回应|解释|讲|说|问)/g, "$1$2")
    .replace(/我跳\s+([^，。；！？\s]+)(?=[，。；！？])/g, "我跳$1")
    .replace(/先跳一下[，,]\s*([^，。；！？\s]+)(?=[，。；！？])/g, "先跳$1")
    .replace(/我会往\s+([^，。；！？\s]+)\s+这类/g, "我会往$1这类")
    .replace(/，?接…[。！？；]?$/u, "，先听回应。")
    .replace(/[，：；]\s*$/u, "。")
    .replace(/\s+号/g, "号")
    .replace(/\s+([，。；！？])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupePublicFollowUpCues(text) {
  return `${text ?? ""}`
    .replace(
      /(接下来先问\s*([0-9]+号)\s*：\s*身份和昨晚信息[。！？；]?)(?:\s*让\s*\2\s*把身份和昨晚信息说清楚[。！？；]?)+/g,
      "$1"
    )
    .replace(
      /(先问\s*([0-9]+号)\s*：\s*身份和昨晚信息[。！？；]?)(?:\s*让\s*\2\s*把身份和昨晚信息说清楚[。！？；]?)+/g,
      "$1"
    )
    .replace(
      /(我会问\s*([0-9]+号)\s*：\s*身份和昨晚信息[。！？；]?)(?:\s*让\s*\2\s*把身份和昨晚信息说清楚[。！？；]?)+/g,
      "$1"
    )
    .replace(
      /(让\s*([0-9]+号)\s*把身份和昨晚信息说清楚[。！？；]?)(?:\s*让\s*\2\s*把身份和昨晚信息说清楚[。！？；]?)+/g,
      "$1"
    )
    .replace(/\s+([，。；！？：])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanClippedPublicEvidenceFragments(text) {
  return `${text ?? ""}`
    .replace(/当前压(?:\.{3,}|…)/g, "台面压力")
    .replace(/可见记录：\s*([0-9]+号)\s*刚才投票(?:\.{3,}|…)/g, "可见记录：$1刚才投票态度要解释")
    .replace(/可见记录：\s*([0-9]+号)\s*的投票和(?:\.{3,}|…)/g, "可见记录：$1的投票和身份解释要对")
    .replace(/可见记录：\s*([0-9]+号)\s*身份解释(?:\.{3,}|…)/g, "可见记录：$1身份解释要补清")
    .replace(/投票态度摇摆，压(?:\.{3,}|…)/g, "投票态度摇摆，压力变化要解释")
    .replace(/需要把昨(?:\.{3,}|…)/g, "需要把昨晚信息补清")
    .replace(/刚才投票(?:\.{3,}|…)/g, "刚才投票态度要解释")
    .replace(/([0-9]+号)\s*的投票和(?:\.{3,}|…)/g, "$1的投票和身份解释要对")
    .replace(/投票和(?:\.{3,}|…)/g, "投票和身份解释要对")
    .replace(/身份解释(?:\.{3,}|…)/g, "身份解释要补清")
    .replace(/身份(?:\.{3,}|…)/g, "身份要对")
    .replace(/可见(?:\.{3,}|…)/g, "可见记录还要对")
    .replace(/([0-9]+号)\s+的/g, "$1的")
    .replace(/([0-9]+号)\s+刚才/g, "$1刚才")
    .replace(/\s+([，。；！？：、])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function evidenceSpecificPublicFollowUp(target, context, mode = "direct") {
  const prefix = mode === "listen" ? `先听${target}` : target;
  if (/刚才投票态度要解释|投票和身份解释要对/.test(context)) {
    return `${prefix}解释票型，再补身份和昨晚信息`;
  }
  if (/身份要对|身份对不上|身份解释要补清/.test(context)) {
    return `${prefix}把身份对上，再补昨晚信息`;
  }
  if (/前面发言没讲清楚/.test(context)) {
    return `${prefix}把没讲清的点补清，再说昨晚信息`;
  }
  if (/在推低证据位|推低证据位/.test(context)) {
    return `${prefix}解释为什么压低证据位，再补昨晚信息`;
  }
  return mode === "listen" ? `先听${target}补身份和昨晚信息` : `${target}先补身份和昨晚信息`;
}

function specializePublicFollowUpByEvidence(text) {
  let value = `${text ?? ""}`;
  value = value.replace(/([0-9]+号)先补身份和昨晚信息/g, (match, target, offset, fullText) =>
    evidenceSpecificPublicFollowUp(target, fullText.slice(0, offset), "direct")
  );
  value = value.replace(/你先补身份和昨晚信息/g, (match, offset, fullText) =>
    evidenceSpecificPublicFollowUp("你", fullText.slice(0, offset), "direct")
  );
  return value.replace(/先听([0-9]+号)补身份和昨晚信息/g, (match, target, offset, fullText) =>
    evidenceSpecificPublicFollowUp(target, fullText.slice(0, offset), "listen")
  );
}

function ensurePublicSentenceClosure(text) {
  const value = `${text ?? ""}`.trim();
  if (!value || /[。！？]$/u.test(value)) {
    return value;
  }
  return `${value}。`;
}

function cleanPublicSurfaceWording(text, options = {}) {
  const value = specializePublicFollowUpByEvidence(`${text ?? ""}`
    .replace(/^我的意思是，(?=先跳)/u, "先说清楚，")
    .replace(/^我的意思是，我先公开身份：/u, "先说清楚，公开身份：")
    .replace(/^我的意思是，我先给范围：/u, "先说清楚，我先给范围：")
    .replace(/^我的意思是，(?=先说清楚|我先看|我不是空白位|公开身份|说实话|我有点)/u, "")
    .replace(/^我的意思是，公开身份：/u, "先说清楚，公开身份：")
    .replace(/(^|。)公开身份：([^。！？；]+)。我的意思是，/gu, "$1先说清楚，公开身份：$2。")
    .replace(/。我的意思是，/g, "。")
    .replace(/让\s*你\s*把身份和昨晚信息说清楚/g, "你先补身份和昨晚信息")
    .replace(/让([0-9]+号)把身份和昨晚信息说清楚/g, "$1先补身份和昨晚信息")
    .replace(/接下来先问([0-9]+号)：身份和昨晚信息/g, "先听$1补身份和昨晚信息")
    .replace(/(先听([0-9]+号)补身份和昨晚信息)(?:[，,]\s*\1)+/g, "$1")
    .replace(/([0-9]+号先补身份和昨晚信息)(?:[，,]\s*\1)+/g, "$1")
    .replace(
      /((?:先听)?[0-9]+号(?:解释票型，再补身份和昨晚信息|把身份对上，再补昨晚信息|把没讲清的点补清，再说昨晚信息|解释为什么压低证据位，再补昨晚信息))(?:[，,]\s*\1)+/g,
      "$1"
    )
    .replace(/卡在\s+在/g, "卡在")
    .replace(/卡在\s+(?=前面|推低|身份|公开|两条|[0-9]+号)/g, "卡在")
    .replace(/([0-9]+号这边)，在/g, "$1在")
    .replace(/([0-9]+号)\s+(这条|这边|那条|也|的|刚才)/g, "$1$2")
    .replace(/([0-9]+号)\s+(我(?:先|会|再|得|要))/g, "$1，$2")
    .replace(/(让|问|看|盯|对|排|压|转到|沿着|先把|把|放过)\s+([0-9]+号)/g, "$1$2")
    .replace(/([0-9]+号)\s+(是|也|把|可以|需要|继续|先)/g, "$1$2")
    .replace(/\s+([，。；！？：、])/g, "$1")
    .replace(/\s+/g, " ")
    .trim())
    .replace(
      /((?:先听)?[0-9]+号(?:解释票型，再补身份和昨晚信息|把身份对上，再补昨晚信息|把没讲清的点补清，再说昨晚信息|解释为什么压低证据位，再补昨晚信息))(?:[，,]\s*\1)+/g,
      "$1"
    )
    .replace(/(先听([0-9]+号)[^，。；！？]+)(?:[，,]\s*\1)+/g, "$1")
    .replace(/([0-9]+号[^，。；！？]+)(?:[，,]\s*\1)+/g, "$1")
    .trim();
  return options.closeSentence === false ? value : ensurePublicSentenceClosure(value);
}

function normalizePublicSpeechText(text) {
  return sanitizePlayerVisibleText(cleanPublicSurfaceWording(cleanClippedPublicEvidenceFragments(text), { closeSentence: false }));
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
    .replace(/身份我先不给死，只给你可公开的说法范围：/g, "身份我先不说满，对外先按 ")
    .replace(/我会往\s*([^，。；！？\s]+)\s*这类好人位上靠/g, "$1 这个方向聊")
    .replace(/低信息好人位/g, "低信息身份")
    .replace(/按\s+([^，。；！？\s]+)\s+这个方向聊/g, "按$1这个方向聊")
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
    .replace(/卡点是：/g, "我过不去的是：")
    .replace(/我卡的点：/g, "我过不去的是：")
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
    .replace(/因为\s+有人/g, "因为有人")
    .replace(/有人私下提到\s*([0-9]+)\s*号。([^。！？]*。)?有人私下提到\s*\1\s*号。?/g, "有人私下提到 $1号。$2")
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
  return sanitizePlayerVisibleText(reduceClauseStacking(dedupePrivateEvidenceMentions(value)));
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
    return sanitizePlayerVisibleText(value);
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
  return sanitizePlayerVisibleText(value);
}

function normalizePriorityFragment(fragment) {
  if (!fragment) {
    return null;
  }
  const aliases = Array.isArray(fragment.aliases) ? fragment.aliases : [];
  const texts = [fragment.text, ...aliases]
    .map((entry) => priorityComparableText(entry))
    .filter(Boolean);
  const appendText = normalizePublicSpeechText(
    `${fragment.appendText ?? fragment.text ?? ""}`.replace(/\s+/g, " ").trim()
  );
  if (texts.length === 0 && !appendText) {
    return null;
  }
  return {
    key: fragment.key ?? "",
    priority: Number.isFinite(Number(fragment.priority)) ? Number(fragment.priority) : 0,
    placement: fragment.placement === "prefix" ? "prefix" : "append",
    texts,
    appendText,
  };
}

function priorityComparableText(text) {
  return normalizePublicSpeechText(text)
    .replaceAll("…", "...")
    .replace(/[。！？；]+$/u, "")
    .replace(/\s+/g, " ")
    .trim();
}

function followUpTargetFromPriorityText(text) {
  return `${text ?? ""}`.match(/([0-9]+号).*(?:身份和昨晚信息|昨晚信息|身份)/u)?.[1] ?? "";
}

function hasPublicFollowUpForTarget(text, target) {
  if (!target) {
    return false;
  }
  return [
    `${target}先补身份和昨晚信息`,
    `先听${target}补身份和昨晚信息`,
    `${target}解释票型，再补身份和昨晚信息`,
    `先听${target}解释票型，再补身份和昨晚信息`,
    `${target}把身份对上，再补昨晚信息`,
    `先听${target}把身份对上，再补昨晚信息`,
    `${target}把没讲清的点补清，再说昨晚信息`,
    `先听${target}把没讲清的点补清，再说昨晚信息`,
    `${target}解释为什么压低证据位，再补昨晚信息`,
    `先听${target}解释为什么压低证据位，再补昨晚信息`,
  ].some((entry) => text.includes(entry));
}

function hasPriorityFragment(text, fragment) {
  const value = priorityComparableText(text);
  if (fragment.key === "question") {
    const target = fragment.texts.map(followUpTargetFromPriorityText).find(Boolean);
    if (target && hasPublicFollowUpForTarget(value, target)) {
      return true;
    }
  }
  return fragment.texts.some((entry) => entry && value.includes(entry));
}

function priorityCoverageCount(text, fragments) {
  return fragments.filter((fragment) => hasPriorityFragment(text, fragment)).length;
}

function ensurePriorityFragmentCoverage(text, fragments, minCoverage, maxChars) {
  const normalized = (fragments ?? []).map(normalizePriorityFragment).filter(Boolean);
  if (normalized.length === 0 || !Number.isFinite(Number(minCoverage)) || minCoverage <= 0) {
    return `${text ?? ""}`.trim();
  }
  let value = `${text ?? ""}`.replace(/\s+/g, " ").trim();
  const targetCoverage = Math.min(normalized.length, Math.max(0, Number(minCoverage)));
  const mandatory = normalized.filter((fragment) => fragment.priority >= 5);
  const coversMandatory = (candidate) => mandatory.every((fragment) => hasPriorityFragment(candidate, fragment));
  if (priorityCoverageCount(value, normalized) >= targetCoverage && coversMandatory(value)) {
    return value;
  }

  const missing = normalized
    .filter((fragment) => !hasPriorityFragment(value, fragment))
    .sort((a, b) => b.priority - a.priority);
  for (const fragment of missing) {
    if (priorityCoverageCount(value, normalized) >= targetCoverage && coversMandatory(value)) {
      break;
    }
    const addition = fragment.appendText || fragment.texts[0] || "";
    if (!addition || value.includes(addition)) {
      continue;
    }
    const appended = fragment.placement === "prefix"
      ? joinSpeechFragments([addition, value])
      : joinSpeechFragments([value, addition]);
    if (appended.length <= maxChars) {
      value = appended;
      continue;
    }
    const room = Math.max(0, maxChars - addition.length - 1);
    if (room > 12) {
      const clipped = tableSpeechPrefixWithinChars(value, room);
      const candidate = fragment.placement === "prefix"
        ? joinSpeechFragments([addition, clipped])
        : joinSpeechFragments([clipped, addition]);
      if (candidate.length <= maxChars && priorityCoverageCount(candidate, normalized) >= priorityCoverageCount(value, normalized)) {
        value = candidate;
      }
    }
  }

  if (priorityCoverageCount(value, normalized) >= targetCoverage && coversMandatory(value)) {
    return value;
  }
  const compact = normalized
    .sort((a, b) => {
      if (a.placement === "prefix" && b.placement !== "prefix") return -1;
      if (b.placement === "prefix" && a.placement !== "prefix") return 1;
      return b.priority - a.priority;
    })
    .map((fragment) => fragment.appendText || fragment.texts[0] || "")
    .filter(Boolean)
    .filter((entry, index, arr) => arr.indexOf(entry) === index)
    .slice(0, targetCoverage)
    .join(" ");
  return compact && compact.length <= maxChars && priorityCoverageCount(compact, normalized) >= targetCoverage && coversMandatory(compact)
    ? compact
    : value;
}

function priorityFragmentComposite(fragments, minCoverage, maxSentences, maxChars) {
  const normalized = (fragments ?? []).map(normalizePriorityFragment).filter(Boolean);
  if (normalized.length === 0 || !Number.isFinite(Number(minCoverage)) || minCoverage <= 0) {
    return "";
  }
  const targetCoverage = Math.min(normalized.length, Math.max(0, Number(minCoverage)));
  const ordered = [...normalized].sort((a, b) => {
    if (a.placement === "prefix" && b.placement !== "prefix") return -1;
    if (b.placement === "prefix" && a.placement !== "prefix") return 1;
    return b.priority - a.priority;
  });
  const selected = [];
  ordered.filter((fragment) => fragment.priority >= 5).forEach((fragment) => selected.push(fragment));
  ordered.forEach((fragment) => {
    if (!selected.includes(fragment) && selected.length < targetCoverage) selected.push(fragment);
  });
  const entries = selected
    .map((fragment) => fragment.appendText || fragment.texts[0] || "")
    .filter(Boolean)
    .filter((entry, index, values) => values.indexOf(entry) === index);
  if (entries.length === 0) return "";
  let candidate = entries.join("");
  if (entries.length > maxSentences) {
    const headCount = Math.max(0, maxSentences - 1);
    const head = entries.slice(0, headCount);
    const tailBodies = entries.slice(headCount).map((entry) => entry.replace(/[。！？；]+$/u, "").trim());
    candidate = `${head.join("")}${tailBodies.join("，")}。`;
  }
  const mandatory = normalized.filter((fragment) => fragment.priority >= 5);
  return candidate.length <= maxChars &&
    priorityCoverageCount(candidate, normalized) >= targetCoverage &&
    mandatory.every((fragment) => hasPriorityFragment(candidate, fragment))
    ? candidate
    : "";
}

export function applySpeechBudget(text, options = {}) {
  let value = `${text ?? ""}`.replace(/\s+/g, " ").trim();
  if (!value) {
    return value;
  }
  value = dedupePrivateEvidenceMentions(value);
  const audience = options.audience ?? "private";
  const hardLimits = TABLE_SPEECH_LIMITS[audience] ?? TABLE_SPEECH_LIMITS.private;
  const alliedHiddenTruth =
    audience !== "public" && audience !== "nomination" && hasAlliedHiddenTruthMarkers(value);
  if (alliedHiddenTruth) value = compactAlliedHiddenTruthIntro(value);
  const requestedMaxSentences = options.maxSentences ?? hardLimits.maxSentences;
  const requestedMaxChars = options.maxChars ?? hardLimits.maxChars;
  const maxSentences =
    options.allowHiddenTruth && audience === "ai-private"
      ? Math.min(requestedMaxSentences, 5)
      : Math.min(requestedMaxSentences, hardLimits.maxSentences);
  const maxChars = Math.min(requestedMaxChars, hardLimits.maxChars);
  const sentences = value.match(/[^。！？；]+[。！？；]?/gu)?.map((entry) => entry.trim()).filter(Boolean) ?? [value];
  const alliedContextSentence = audience === "public" || audience === "nomination"
    ? ""
    : sentences.find((entry) => /(自己人|一边|邪恶视角|对底|队伍信息|队伍牌面|只在我们之间)/u.test(entry)) ?? "";
  const evidenceSentence = sentences.find((entry) => /(我现在抓的点|这条还弱|卡点是|我卡的点|我过不去的是|我卡在这儿|证据还薄|这点还不够|短线|弱证据说明|证据线)：|进提名池|提名前|如果今天提/.test(entry));
  const followUpSentence = sentences.find((entry) => /(反问一句|下一句我会|下一步|票前我会问|我下|追问)/.test(entry));
  const urgentSentence = sentences.find((entry) => /(马上听回应|需要马上听回应)/.test(entry));
  const continuitySentence = sentences.find((entry) => /(刚才那条线|还是围绕|暂时不换目标|还是先看|接着刚才)/.test(entry));
  const tableStateSentence = sentences.find((entry) => /(我已经死了|我现在在台上|票型你们自己看|能验证的部分)/.test(entry));
  if (sentences.length > maxSentences) {
    const kept = sentences.slice(0, maxSentences);
    const requiredSentence =
      audience === "private"
        ? tableStateSentence ?? urgentSentence ?? continuitySentence ?? followUpSentence ?? evidenceSentence
        : tableStateSentence ?? evidenceSentence ?? followUpSentence;
    if (requiredSentence && !kept.includes(requiredSentence)) {
      kept[Math.max(0, kept.length - 1)] = requiredSentence;
    }
    value = kept.join("");
  }
  if (value.length > maxChars) {
    value = compactTableSpeech(value, {
      audience,
      maxSentences,
      maxChars,
      priorityFragments: options.priorityFragments,
    });
  }
  value = ensurePriorityFragmentCoverage(
    value,
    options.priorityFragments,
    options.minPriorityFragments ?? (audience === "public" ? 3 : 0),
    maxChars
  );
  const finalValue = dedupePublicFollowUpCues(dedupePrivateEvidenceMentions(value))
    .replace(/我卡在这儿：[^。！？；]*…（先对一下）。?/g, "我卡在这儿：前面的发言要回看。")
    .replace(/我卡在这儿：(?:发言)?…（先对一下）。?/g, "我卡在这儿：前面的发言要回看。")
    .replace(/我卡在这儿：发言…（先对一下）。?/g, "我卡在这儿：前面的发言要回看。");
  const cleaned = audience === "public"
    ? cleanPublicSurfaceWording(cleanClippedPublicEvidenceFragments(finalValue))
    : cleanClippedPublicEvidenceFragments(finalValue);
  let compacted = compactTableSpeech(cleaned, {
    audience,
    maxSentences,
    maxChars,
    priorityFragments: options.priorityFragments,
  });
  const minPriorityFragments = options.minPriorityFragments ?? (audience === "public" ? 3 : 0);
  const requiredComposite = priorityFragmentComposite(
    options.priorityFragments,
    minPriorityFragments,
    maxSentences,
    maxChars
  );
  if (requiredComposite) {
    const normalized = (options.priorityFragments ?? []).map(normalizePriorityFragment).filter(Boolean);
    const targetCoverage = Math.min(normalized.length, Math.max(0, Number(minPriorityFragments)));
    const mandatory = normalized.filter((fragment) => fragment.priority >= 5);
    if (
      priorityCoverageCount(compacted, normalized) < targetCoverage ||
      mandatory.some((fragment) => !hasPriorityFragment(compacted, fragment))
    ) {
      compacted = requiredComposite;
    }
  }
  if (alliedContextSentence && !/(自己人|一边|邪恶视角|对底|队伍信息|队伍牌面|只在我们之间)/u.test(compacted)) {
    const withContext = `${alliedContextSentence}${compacted}`;
    if (withContext.length <= maxChars && tableSpeechSentences(withContext).length <= maxSentences) {
      compacted = withContext;
    }
  }
  return sanitizePlayerVisibleText(compacted);
}

export function applyHumanSpeechCadence(state, aiPlayer, text, rng = Math.random, options = {}) {
  let value = stripDuplicateHumanOpeners(text);
  if (!value || alreadyHasHumanCadence(value)) {
    value = applyPhraseCooldown(value, aiPlayer, rng);
    value = polishConversationalText(value);
    value = applyEmotionalTexture(value, state, aiPlayer, rng, options);
    value = differentiateRepeatedSpeech(value, aiPlayer, rng, options);
    value = applySpeechBudget(value, options);
    value = reducePublicSelfDensity(value, options);
    value = sanitizePlayerVisibleText(value);
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
    value = applyEmotionalTexture(value, state, aiPlayer, rng, options);
    value = differentiateRepeatedSpeech(value, aiPlayer, rng, options);
    value = applySpeechBudget(value, options);
    value = reducePublicSelfDensity(value, options);
    value = sanitizePlayerVisibleText(value);
    rememberSpeechStyle(aiPlayer, value);
    return value;
  }
  value = insertCadenceBridge(value, bridgePhraseForSpeech(aiPlayer, options));
  value = applyPhraseCooldown(value, aiPlayer, rng);
  value = polishConversationalText(value);
  value = applyEmotionalTexture(value, state, aiPlayer, rng, options);
  value = differentiateRepeatedSpeech(value, aiPlayer, rng, options);
  value = applySpeechBudget(value, options);
  value = reducePublicSelfDensity(value, options);
  value = sanitizePlayerVisibleText(value);
  rememberSpeechStyle(aiPlayer, value);
  return value;
}
