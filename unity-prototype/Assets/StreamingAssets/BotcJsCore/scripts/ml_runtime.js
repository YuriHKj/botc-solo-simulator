import { BOTC_RUNTIME_MODEL } from "./ml_runtime_model_data.js";

const MAX_CACHE = 400;
const predictionCache = new Map();

function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

function softmax(scores) {
  const entries = Object.entries(scores);
  if (entries.length === 0) {
    return {};
  }
  const maxV = Math.max(...entries.map(([, value]) => value));
  const exps = entries.map(([label, value]) => [label, Math.exp(value - maxV)]);
  const denom = exps.reduce((sum, [, value]) => sum + value, 0) || 1;
  return Object.fromEntries(exps.map(([label, value]) => [label, value / denom]));
}

function normalizeText(text) {
  return `${text ?? ""}`
    .toLowerCase()
    .replace(/[，。！？、；：“”‘’（）【】《》〈〉「」『』]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractBaseTokens(text) {
  const normalized = normalizeText(text);
  if (!normalized) {
    return [];
  }

  const tokens = [];
  const latinWords = normalized.match(/[a-z0-9_]{2,}/g) ?? [];
  latinWords.forEach((word) => tokens.push(word));

  const cjkSegments = normalized.match(/[\u4e00-\u9fff]{2,}/g) ?? [];
  cjkSegments.forEach((seg) => {
    tokens.push(seg);
    for (let i = 0; i < seg.length - 1; i += 1) {
      tokens.push(seg.slice(i, i + 2));
    }
  });

  return tokens;
}

function makeTokenSet(text) {
  const base = extractBaseTokens(text);
  if (base.length === 0) {
    return new Set();
  }
  const set = new Set(base);
  for (let i = 0; i < base.length - 1; i += 1) {
    set.add(`${base[i]} ${base[i + 1]}`);
  }
  return set;
}

function mapFromFeatureRows(rows = []) {
  const map = new Map();
  rows.forEach((row) => {
    if (!row || !row.token) {
      return;
    }
    const weight = Number.isFinite(row.weight) ? row.weight : 0;
    const idf = Number.isFinite(row.idf) ? row.idf : 1;
    map.set(row.token, weight * idf);
  });
  return map;
}

function compileRuntimeModel() {
  const vote = BOTC_RUNTIME_MODEL?.vote_model ?? {};
  const speech = BOTC_RUNTIME_MODEL?.speech_model ?? {};
  return {
    voteClasses: Array.isArray(vote.classes) ? vote.classes : [],
    voteIntercepts: vote.intercepts ?? {},
    voteFeatures: Object.fromEntries(
      (vote.classes ?? []).map((label) => [label, mapFromFeatureRows(vote.top_features?.[label] ?? [])]),
    ),
    speechLabels: Array.isArray(speech.labels) ? speech.labels : [],
    speechIntercepts: speech.intercepts ?? {},
    speechFeatures: Object.fromEntries(
      (speech.labels ?? []).map((label) => [label, mapFromFeatureRows(speech.top_features?.[label] ?? [])]),
    ),
  };
}

const compiled = compileRuntimeModel();

function scoreByFeatures(tokenSet, intercept, featureMap) {
  let score = Number.isFinite(intercept) ? intercept : 0;
  let hits = 0;
  tokenSet.forEach((token) => {
    const w = featureMap.get(token);
    if (Number.isFinite(w)) {
      score += w;
      hits += 1;
    }
  });
  return { score, hits };
}

export function predictDialogueSignals(text) {
  const cacheKey = `${text ?? ""}`;
  if (predictionCache.has(cacheKey)) {
    return predictionCache.get(cacheKey);
  }

  const tokenSet = makeTokenSet(text);
  if (tokenSet.size === 0) {
    const empty = {
      available: false,
      voteLabel: "undecided",
      voteConfidence: 0,
      voteProbabilities: {},
      speechActs: [],
      speechScores: {},
      tokenHits: 0,
    };
    predictionCache.set(cacheKey, empty);
    return empty;
  }

  let totalHits = 0;

  const voteRawScores = {};
  compiled.voteClasses.forEach((label) => {
    const scored = scoreByFeatures(
      tokenSet,
      compiled.voteIntercepts?.[label] ?? 0,
      compiled.voteFeatures?.[label] ?? new Map(),
    );
    voteRawScores[label] = scored.score;
    totalHits += scored.hits;
  });
  const voteProbabilities = softmax(voteRawScores);
  const voteRanked = Object.entries(voteProbabilities).sort((a, b) => b[1] - a[1]);
  const voteLabel = voteRanked[0]?.[0] ?? "undecided";
  const voteConfidence = voteRanked[0]?.[1] ?? 0;

  const speechScores = {};
  compiled.speechLabels.forEach((label) => {
    const scored = scoreByFeatures(
      tokenSet,
      compiled.speechIntercepts?.[label] ?? 0,
      compiled.speechFeatures?.[label] ?? new Map(),
    );
    speechScores[label] = sigmoid(scored.score);
    totalHits += scored.hits;
  });

  let speechActs = Object.entries(speechScores)
    .filter(([, prob]) => prob >= 0.52)
    .sort((a, b) => b[1] - a[1])
    .map(([label]) => label);
  if (speechActs.length === 0) {
    const top = Object.entries(speechScores).sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] >= 0.44) {
      speechActs = [top[0]];
    }
  }

  const result = {
    available: totalHits > 0,
    voteLabel,
    voteConfidence,
    voteProbabilities,
    speechActs,
    speechScores,
    tokenHits: totalHits,
  };

  predictionCache.set(cacheKey, result);
  if (predictionCache.size > MAX_CACHE) {
    const firstKey = predictionCache.keys().next().value;
    predictionCache.delete(firstKey);
  }
  return result;
}

export function voteLabelToInGameStance(label) {
  const normalized = `${label ?? ""}`.trim();
  if (!normalized) {
    return "";
  }
  if (normalized === "support" || normalized === "lean_execute_target") {
    return "support";
  }
  if (normalized === "oppose" || normalized === "lean_do_not_execute_target") {
    return "oppose";
  }
  if (normalized === "abstain_signal") {
    return "abstain_signal";
  }
  return "";
}
