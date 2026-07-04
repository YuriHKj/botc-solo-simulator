import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { advanceDayStage, createNewGame, markPublicDiscussionRound, resolveNominationAndVote, runNight } from "./engine.js";
import {
  buildNominationStrategyRationale,
  chooseAINomination,
  createNominationDebate,
  decideAIVoteWithRationale,
  initializeAI,
  runAIDiscussion,
  runAIConversationStep,
  runAIProactiveWhispers,
  runAIToAIPrivateWhispers,
  runPrivateWhisper,
} from "./ai.js";
import {
  addAgentObservation,
  areKnownAllies,
  getAIAgent,
  recordPublicClaimForAgents,
  updateAgentSourceTrustForPlayer,
} from "./ai_agents.js";
import { claimDisclosurePlanner, roleNameById } from "./ai_claim_policy.js";
import { getRoleById } from "./data.js";

const OUTPUT_DIR = path.resolve("output", "ai_quality_eval");

export const AI_QUALITY_BASELINE_THRESHOLDS = {
  hiddenLeakCount: 0,
  mechanicalArtifactCount: 0,
  evidenceCitationRate: 0.55,
  decisionRationaleCoverage: 1,
  decisionReconsiderationCoverage: 1,
  decisionConfidenceCalibrationCoverage: 1,
  decisionVerificationPlanCoverage: 1,
  decisionEvidenceModeCoverage: 1,
  decisionEvidenceModeVerificationAlignmentCoverage: 1,
  decisionResponsePlanCoverage: 1,
  decisionResponseCriteriaCoverage: 1,
  decisionEvidenceInteractionCoverage: 1,
  decisionPressureStageCoverage: 1,
  decisionCounterEvidenceCoverage: 1,
  decisionTableRiskCoverage: 1,
  decisionInformationGainCoverage: 1,
  decisionTableReactionCoverage: 1,
  decisionTimingWindowCoverage: 1,
  decisionWorldBranchCoverage: 1,
  decisionVoteCoalitionCoverage: 1,
  decisionSourceReliabilityCoverage: 1,
  decisionTimelineConsistencyCoverage: 1,
  decisionIncentiveAlignmentCoverage: 1,
  decisionBurdenOfProofCoverage: 1,
  decisionQuestionPriorityCoverage: 1,
  decisionActionThresholdCoverage: 1,
  decisionMemoryContinuityCoverage: 1,
  decisionExpressionDisciplineCoverage: 1,
  decisionUncertaintyResolutionCoverage: 1,
  decisionEvidenceFreshnessCoverage: 1,
  decisionFalsificationCheckCoverage: 1,
  decisionCausalChainCoverage: 1,
  decisionAssumptionAuditCoverage: 1,
  decisionMechanicSensitivityCoverage: 1,
  decisionRoleHypothesisCoverage: 1,
  decisionEvidenceBoundaryCoverage: 1,
  decisionRunnerUpWatchCoverage: 1,
  runnerUpComparisonCoverage: 0.8,
  privateRunnerUpComparisonLineVariantCoverage: 1,
  strategyRationaleCoverage: 0.8,
  nominationActionContextCoverage: 1,
  nominationStrategyModeCoverage: 1,
  nominationStrategyPlanDedupCoverage: 1,
  nominationDefenseResponseCoverage: 1,
  nominationDefenseResponseVariantCoverage: 1,
  nominationDefenseInfoDedupCoverage: 1,
  nominationDefenseReasonAnchorCoverage: 1,
  highPressureNominationDefenseCounterPressureCoverage: 1,
  crossScriptNominationDefenseReasonAnchorCoverage: 1,
  nominationDefenseAwareVoteCoverage: 1,
  nominationReasonAnchoredDefenseVoteCoverage: 1,
  nominationReasonAnchoredDefenseVoteLineDiversityCoverage: 1,
  crossScriptNominationDefenseAwareVoteCoverage: 1,
  proactiveRationaleCoverage: 0.8,
  voteIntentCoverage: 0.8,
  claimDisclosureRationaleCoverage: 1,
  claimDisclosureContinuityCoverage: 1,
  claimDisclosureContinuityModeCoverage: 1,
  claimDisclosureSurfaceDedupCoverage: 1,
  claimDisclosureHoldLeadVariantCoverage: 1,
  publicClaimHoldLeadVariantCoverage: 1,
  claimDisclosureBalancedReasonVariantCoverage: 1,
  crossScriptClaimDisclosureCoverage: 1,
  privateScriptClaimDeflectCoverage: 1,
  crossScriptClaimContinuityCoverage: 1,
  roleConstrainedClaimDisclosureCoverage: 1,
  roleConstrainedClaimLineDiversityCoverage: 0.8,
  crossScriptPublicReasoningCoverage: 1,
  crossScriptPublicMultiEvidenceCoverage: 1,
  publicScriptPressureVariantCoverage: 1,
  publicTimingPressureVariantCoverage: 1,
  publicRolePressureVariantCoverage: 1,
  crossScriptPrivateMultiEvidenceCoverage: 1,
  privateSurfaceReportDisciplineCoverage: 1,
  privateReasonOpeningRedundancyCoverage: 1,
  privateReasonOpeningVariantCoverage: 1,
  privateReasonOpeningLeadVariantCoverage: 1,
  privateReasonOpeningSentenceCoverage: 1,
  privateVerificationLeadNaturalizationCoverage: 1,
  privateDeepReasoningSpokenCoverage: 1,
  privateTimelineReasoningSpokenCoverage: 1,
  privateSourceTimelineCompressionCoverage: 1,
  privateIncentiveReasoningSpokenCoverage: 1,
  privateBurdenReasoningSpokenCoverage: 1,
  privateDeepReasoningCompressionCoverage: 1,
  privateDeepReasoningCompressionVariantCoverage: 1,
  privateDeepReasoningHeadingVariantCoverage: 1,
  privateDeepReasoningTailVariantCoverage: 1,
  privateDeepReasoningBrevityCoverage: 1,
  privateDeepReasoningLeadDedupCoverage: 1,
  privateEvidenceSynthesisCoverage: 1,
  privateEvidenceSynthesisVariantCoverage: 1,
  privateEvidenceSynthesisVerificationCoverage: 1,
  privateEvidenceSynthesisSpokenVerificationCoverage: 1,
  privateEvidenceSynthesisSourceIdentityDedupCoverage: 1,
  privateEvidenceSynthesisVoteTaxonomyDedupCoverage: 1,
  formalVoteRationaleCoverage: 0.8,
  formalVoteTableContextCoverage: 1,
  formalVoteLineDiversityCoverage: 1,
  formalVoteNormalizedLineDiversityCoverage: 1,
  formalVoteReasonModeCoverage: 1,
  formalVoteNearThresholdCoverage: 1,
  formalVoteEvilCoverSafetyCoverage: 1,
  formalVoteEvidenceBoundaryCoverage: 1,
  formalVoteMultiEvidenceCompressionCoverage: 1,
  formalVoteScriptCoverage: 1,
  crossDayStanceContinuityCoverage: 0.8,
  crossDayStanceReasonCoverage: 0.8,
  crossDayStanceReasonRecapDedupCoverage: 1,
  crossDayStanceEvidenceDeltaCoverage: 1,
  crossDayStanceEvidenceTraceCoverage: 1,
  crossDayStanceEvidenceAnchorCoverage: 1,
  crossDayStanceEventAnchorCoverage: 1,
  crossDayStanceScoreTrailAnchorCoverage: 1,
  crossDayStanceModeCoverage: 1,
  crossScriptCrossDayStanceCoverage: 1,
  crossDayTargetSwitchCoverage: 1,
  crossScriptCrossDayTargetSwitchCoverage: 1,
  nonPublicTargetSwitchContinuityCoverage: 1,
  publicPrioritySignalCoverage: 0.8,
  publicFollowUpDedupCoverage: 1,
  publicFollowUpTemplateDisciplineCoverage: 1,
  publicFollowUpSpecificityCoverage: 1,
  publicEvidenceSynthesisCoverage: 1,
  publicEvidenceSynthesisDedupCoverage: 1,
  publicEvidenceSynthesisLabelStackCoverage: 1,
  publicEvidenceAnchorLeadVariantCoverage: 1,
  publicEvidenceAnchorDedupCoverage: 1,
  publicEvidenceSynthesisSpokenVerificationCoverage: 1,
  publicEvidenceSynthesisSpokenVerificationVariantCoverage: 1,
  publicEvidenceSynthesisExplicitModeCoverage: 1,
  publicVerificationLeadVariantCoverage: 1,
  publicFollowUpTailVariantCoverage: 1,
  publicEvidenceFragmentClarityCoverage: 1,
  nonPublicEvidenceFragmentClarityCoverage: 1,
  nonPublicSurfacePolishCoverage: 1,
  publicSurfacePolishCoverage: 1,
  publicTableSpeechBrevityCoverage: 1,
  publicSentenceClosureCoverage: 1,
  publicGenericOpenerDisciplineCoverage: 1,
  publicPressureTextureCoverage: 0.8,
  publicPersonaPressureVariantCoverage: 1,
  publicPersonaPressureLineDiversityCoverage: 0.8,
  publicShadowPressureLineDiversityCoverage: 1,
  publicShadowTargetLineVariantCoverage: 1,
  publicPressureActionLeadVariantCoverage: 1,
  publicPressureUrgencyTailVariantCoverage: 1,
  publicPressureActionLeadDedupCoverage: 1,
  evilPublicCoverTextureCoverage: 0.8,
  evilPublicCoverMaintenanceCoverage: 0.8,
  evilPublicCoverMaintenanceDedupCoverage: 1,
  evilPublicCoverPivotCoverage: 0.8,
  evilPublicProtectAllyCoverage: 0.8,
  evilPublicClaimCoverContinuityCoverage: 1,
  evilPublicClaimCoverPivotCoverage: 1,
  evilPublicClaimCoverProtectAllyCoverage: 1,
  evilPublicClaimCoverCrossDayCoverage: 1,
  evilPublicClaimCoverDeceptionArcCoverage: 1,
  evilPublicClaimCoverPressureContinuityCoverage: 1,
  evilPublicClaimCoverPlanDedupCoverage: 1,
  evilPrivateCoordinationCoverage: 1,
  evilPrivateTeamInfoVariantCoverage: 1,
  evilPrivateCoverPlanVariantCoverage: 1,
  evilPrivatePressurePlanDedupCoverage: 1,
  aiToAiEvilCoordinationCoverage: 1,
  repetitionRate: 0.35,
  stanceContinuityRate: 1,
  nominationReasonableRate: 1,
};

const NOMINATION_STRATEGY_MODE_FIXTURES = [
  { intent: "pressure-test", expectedMode: "pressure-test", support: 2.2, threshold: 5 },
  { intent: "coalition-check", expectedMode: "coalition-check", support: 4.6, threshold: 5 },
  { intent: "execution-push", expectedMode: "execution-push", support: 5.1, threshold: 5 },
  { intent: "good-avoid-no-execution", expectedMode: "avoid-no-execution", support: 3.7, threshold: 5 },
  { intent: "good-execution-info", expectedMode: "execution-info", support: 1.8, threshold: 5 },
  { intent: "evil-framing", expectedMode: "public-reason-flow", support: 4.1, threshold: 5 },
  { intent: "information-check", expectedMode: "information-check", support: 2.9, threshold: 5 },
];
const NOMINATION_STRATEGY_DISPLAY_MODES = NOMINATION_STRATEGY_MODE_FIXTURES.map((fixture) => fixture.expectedMode);

const HIDDEN_LEAK_TERMS = [
  "真实身份",
  "邪恶互认",
  "恶魔伪装",
  "魔典",
  "PRIVATE_SECRET_MARKER",
  "bluff",
  "你的爪牙",
  "自己人",
  "邪恶视角",
  "爪牙",
  "当前可用伪装",
];

const MECHANICAL_ARTIFACT_PATTERN = /undefined|NaN|JS Core|agentView|evidenceContract|decisionRationale|\[object Object\]/i;
const EVIDENCE_LANGUAGE_PATTERN = /身份|发言|投票|票型|昨晚|夜里|信息|线索|证据|对不上|回应|提名|站边|公开/i;
const STANCE_SWITCH_PATTERN = /换看|改看|转看|你问到|先不锁|差距不大|重新看|第二候选|昨天也盯|今天证据量没少/;
const PRIVATE_SURFACE_REPORT_LABEL_PATTERN =
  /(验证点|判定标准|证据联动|压力档位|反证|桌面风险|信息收益|桌面反应|时机窗口|世界分支|票面联盟|来源可靠度|时间线一致性|动机归因|举证责任|追问顺序|行动门槛|记忆连续性|表达纪律|不确定性|证据新鲜度|证伪检查|因果链|前提审计|机制敏感性|角色假说)\s*[：:]/u;

function fixedRng(seed = 987654321) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function oneLine(text) {
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

function compactSignal(text) {
  return oneLine(text).replaceAll("…", "...").replace(/\s+/g, "");
}

function publicEvidenceSignalVariants(text) {
  const cleaned = cleanClippedPublicEvidenceFragments(text);
  const stripped = cleaned.replace(/^两条线索合在一起：/u, "").trim();
  return [...new Set([cleaned, stripped].map((entry) => compactSignal(entry)).filter(Boolean))];
}

function publicTextIncludesEvidenceSignal(text, evidenceText, headLength = 10) {
  const cleanText = compactSignal(cleanClippedPublicEvidenceFragments(text));
  return publicEvidenceSignalVariants(evidenceText).some((signal) => {
    const head = signal.slice(0, Math.min(headLength, signal.length));
    return !!head && cleanText.includes(head);
  });
}

function countOccurrences(text, needle) {
  if (!needle) return 0;
  let count = 0;
  let index = `${text ?? ""}`.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = `${text ?? ""}`.indexOf(needle, index + needle.length);
  }
  return count;
}

function rate(numerator, denominator) {
  return denominator > 0 ? Math.round((numerator / denominator) * 1000) / 1000 : 1;
}

function seat(player) {
  return player ? `${player.seatIndex + 1}号` : "";
}

function playerName(state, id) {
  const player = state.players?.find((entry) => entry.id === id);
  return player ? seat(player) : "";
}

function qualityRunId(state, fallback = "") {
  return state?.aiQualityRunId ?? fallback ?? "";
}

function publicPersonaMarkers(persona) {
  if (persona === "pressure") return ["先说清楚", "我直说", "别拖", "说真的", "我会直接压", "先上压力"];
  if (persona === "shadow") return ["换句话说", "我有点在意", "我先留个心眼", "我不太放心", "先留一格压力"];
  return ["先说清楚", "公开身份", "我先看", "我不是空白位", "嗯", "说实话", "我有点犹豫", "我先按这组", "昨天也盯", "记忆连续性"];
}

const PUBLIC_PRESSURE_TEXTURE_MARKERS = [
  "嗯",
  "说实话",
  "我有点犹豫",
  "我直说",
  "别拖",
  "说真的",
  "我有点在意",
  "我先留个心眼",
  "我不太放心",
  "先别急",
  "我得防一下",
  "这票先别锁",
];

const PUBLIC_FOLLOW_UP_DUPLICATE_PATTERN =
  /(?:接下来先问|先问|我会问)\s*([0-9]+号)\s*：\s*身份和昨晚信息[。！？；]?\s*让\s*\1\s*把身份和昨晚信息说清楚|让\s*([0-9]+号)\s*把身份和昨晚信息说清楚[。！？；]?\s*让\s*\2\s*把身份和昨晚信息说清楚|(先听([0-9]+号)补身份和昨晚信息)(?:[，,]\s*\3)+|([0-9]+号先补身份和昨晚信息)(?:[，,]\s*\5)+/;
const PUBLIC_SPECIFIC_FOLLOW_UP_DUPLICATE_PATTERN =
  /((?:先听)?[0-9]+号(?:解释票型，再补身份和昨晚信息|把身份对上，再补昨晚信息|把没讲清的点补清，再说昨晚信息|解释为什么压低证据位，再补昨晚信息))(?:[，,]\s*\1)+/;
const PUBLIC_FOLLOW_UP_TEMPLATE_PATTERN =
  /让[0-9]+号把身份和昨晚信息说清楚|接下来先问[0-9]+号：身份和昨晚信息/;
const PUBLIC_FOLLOW_UP_SPECIFICITY_PATTERN =
  /解释票型|票型解释清|把身份(?:和票型)?对上|身份(?:和票型)?(?:先)?对上|身份(?:说法|口径|和票型)?对齐|身份先(?:对上|落桌面)|把身份(?:先)?落到桌面|投票理由|台面压力|提名压力|把没讲清的点(?:先)?补(?:清|上)|解释(?:为什么)?压低证据位|说明为什么压低证据位|压低证据位的理由|压低证据位这点先讲清/;
const PUBLIC_MULTI_EVIDENCE_COMPRESSION_PATTERN =
  /多条|两条|不止一条|合在一起|公开站队和台面压力|身份和票型|投票和身份|公开线索更多|线索更多|证据位/;
const PUBLIC_EVIDENCE_SYNTHESIS_PATTERN =
  /身份口径和票型一起压过来|身份说法和票型一起压过来|身份解释和投票线卡在同一处|身份线和票型互相咬住|公开站队和票型在同一方向|台面压力和投票线同向|公开压力和票型互相推高|身份口径和提名压力卡在一起|身份说法和提名压力卡在一起|身份解释和上台窗口撞在一起|身份线被提名压力顶住|台面压力和提名窗口卡在一起|公开压力和上台窗口连在一起|台面节奏已经顶到提名口|这两点合着看|我卡的是这组线索|不止一条线在指这里|桌面问题连在一起|两条线先并起来看|这组关系不能拆开看|不是单点，线索接在一起|先把这组线放到同一桌面|我先按这组矛盾追问|这里要把两边一起验/;
const PUBLIC_EVIDENCE_SYNTHESIS_PHRASES = [
  "身份口径和票型一起压过来",
  "身份说法和票型一起压过来",
  "身份解释和投票线卡在同一处",
  "身份线和票型互相咬住",
  "公开站队和票型在同一方向",
  "台面压力和投票线同向",
  "公开压力和票型互相推高",
  "身份口径和提名压力卡在一起",
  "身份说法和提名压力卡在一起",
  "身份解释和上台窗口撞在一起",
  "身份线被提名压力顶住",
  "台面压力和提名窗口卡在一起",
  "公开压力和上台窗口连在一起",
  "台面节奏已经顶到提名口",
];
const PUBLIC_EVIDENCE_ANCHOR_LEAD_PATTERNS = [
  /这两点合着看：/u,
  /我卡的是这组线索：/u,
  /不止一条线在指这里：/u,
  /桌面问题连在一起：/u,
  /两条线先并起来看：/u,
  /这组关系不能拆开看：/u,
  /不是单点，线索接在一起：/u,
  /先把这组线放到同一桌面：/u,
  /我先按这组矛盾追问：/u,
  /这里要把两边一起验：/u,
  /证据还薄，但两点要对：/u,
  /这点还没定死，先看：/u,
  /线索不厚，但两边要接上：/u,
  /先按两条弱线对账：/u,
  /证据不厚，先把两边接住：/u,
  /这组线还要补证：/u,
];
const OLD_PUBLIC_EVIDENCE_ANCHOR_STACK_PATTERN =
  /(?:证据卡在|我过不去的是|这点还不够)：两条线索合在一起：/u;
const PUBLIC_EVIDENCE_ANCHOR_SENTENCE_CAPTURE =
  /(?:这两点合着看|我卡的是这组线索|不止一条线在指这里|桌面问题连在一起|两条线先并起来看|这组关系不能拆开看|不是单点，线索接在一起|先把这组线放到同一桌面|我先按这组矛盾追问|这里要把两边一起验|证据还薄，但两点要对|这点还没定死，先看|线索不厚，但两边要接上|先按两条弱线对账|证据不厚，先把两边接住|这组线还要补证)：([^。！？；]+)/gu;
const PUBLIC_VERIFICATION_LEAD_PATTERN =
  /(?:核法是(?:先听|让)|核法先交给|这条(?:先)?让|先请)\s*[0-9]+号(?:来)?/u;
const PUBLIC_VERIFICATION_LEAD_PATTERNS = [
  /核法是先听\s*[0-9]+号/u,
  /核法是让\s*[0-9]+号/u,
  /核法先交给\s*[0-9]+号来/u,
  /这条先让\s*[0-9]+号/u,
  /这条让\s*[0-9]+号/u,
  /先请\s*[0-9]+号/u,
];
const PUBLIC_FOLLOW_UP_TAIL_PATTERNS = [
  /再解释投票理由/u,
  /再补投票理由/u,
  /投票理由也要补清/u,
  /再补身份和昨晚信息/u,
  /再把身份和昨晚信息补齐/u,
  /身份和昨晚信息也要补清/u,
  /昨晚信息和身份口径也要补清/u,
  /昨晚信息和身份说法也要补清/u,
  /再补昨晚信息/u,
  /再把昨晚信息说完整/u,
  /昨晚信息也要补清/u,
  /昨晚信息也要说完整/u,
  /再说昨晚信息/u,
  /说明提名压力怎么解/u,
  /回应提名压力怎么解/u,
  /再解释提名压力/u,
  /再说明为什么进提名压力/u,
];
const PUBLIC_EVIDENCE_SYNTHESIS_SPOKEN_VERIFICATION_PATTERN =
  /(?:核法是(?:先听|让)|核法先交给|这条(?:先)?让|先请)\s*[0-9]+号(?:来)?.*(?:解释票型|票型解释清|把身份(?:和票型)?对上|身份(?:和票型)?(?:先)?对上|身份(?:说法|口径|和票型)?对齐|身份先(?:对上|落桌面)|把身份(?:先)?落到桌面|投票理由|台面压力|提名压力|把没讲清的点(?:先)?补(?:清|上)|解释(?:为什么)?压低证据位|说明为什么压低证据位|压低证据位的理由|压低证据位这点先讲清).*(?:身份|昨晚信息|没讲清|证据位|投票|票型|提名压力)/;
const PUBLIC_EVIDENCE_SYNTHESIS_VERIFICATION_VARIANT_PATTERNS = {
  "identity-vote": {
    synthesis: /身份口径和票型一起压过来|身份说法和票型一起压过来|身份解释和投票线卡在同一处|身份线和票型互相咬住/,
    verification: /(?:核法是(?:先听|让)|核法先交给|这条(?:先)?让|先请)\s*[0-9]+号(?:来)?.*身份.*票型.*投票理由/,
  },
  "pressure-vote": {
    synthesis: /公开站队和票型在同一方向|台面压力和投票线同向|公开压力和票型互相推高/,
    verification: /(?:核法是(?:先听|让)|核法先交给|这条(?:先)?让|先请)\s*[0-9]+号(?:来)?.*票型.*台面压力/,
  },
  "identity-nomination": {
    synthesis: /身份口径和提名压力卡在一起|身份说法和提名压力卡在一起|身份解释和上台窗口撞在一起|身份线被提名压力顶住/,
    verification: /(?:核法是(?:先听|让)|核法先交给|这条(?:先)?让|先请)\s*[0-9]+号(?:来)?.*身份.*提名压力/,
  },
  "pressure-nomination": {
    synthesis: /台面压力和提名窗口卡在一起|公开压力和上台窗口连在一起|台面节奏已经顶到提名口/,
    verification: /(?:核法是(?:先听|让)|核法先交给|这条(?:先)?让|先请)\s*[0-9]+号(?:来)?.*(?:没讲清|台面压力).*提名压力/,
  },
};
const PUBLIC_EVIDENCE_SYNTHESIS_VERIFICATION_MODES = [
  "identity-vote",
  "pressure-vote",
  "identity-nomination",
  "pressure-nomination",
];
const PUBLIC_PERSONA_PRESSURE_VARIANT_PATTERNS = {
  pressure: /我会先压|这轮先压|我会直接压|压到桌面上|先给压力|先上压力|需要马上听回应/,
  shadow: /暗记|主线|观察位|压力线|留一格压力|先不放下|记一笔|不太放心/,
  steady: /不锁死|落到桌面|说实话/,
};
const PUBLIC_PRESSURE_ACTION_LEAD_PATTERNS = [
  /我会先压\s*[0-9]+号/u,
  /这轮先压\s*[0-9]+号/u,
  /我会直接压\s*[0-9]+号/u,
  /先把\s*[0-9]+号压到桌面上/u,
  /[0-9]+号这边我先给压力/u,
  /[0-9]+号先上压力/u,
];
const PUBLIC_SHADOW_TARGET_LINE_PATTERNS = [
  /[0-9]+号这条先留在主线里/u,
  /[0-9]+号先挂观察位/u,
  /这条先记在[0-9]+号身上/u,
  /[0-9]+号这边先留一格压力/u,
  /[0-9]+号先留在台面压力线上/u,
  /[0-9]+号这边我先不放下/u,
  /先把[0-9]+号留在压力线上/u,
  /[0-9]+号这条先记一笔/u,
];
const OLD_PUBLIC_SHADOW_TARGET_LINE_PATTERN = /我先暗记\s*[0-9]+号这条主线|[0-9]+号我先暗记成主线/u;
const PUBLIC_PRESSURE_URGENCY_TAIL_PATTERNS = [
  /别拖到票前才解释/u,
  /这轮就要先把回应补上/u,
  /不要等到落票前才补口径/u,
  /先在讨论阶段把解释说清/u,
  /票前再补就太晚了/u,
];
const PUBLIC_SCRIPT_PRESSURE_VARIANT_PATTERNS = {
  bmr: /BMR里|死亡\/保护|搅票型/,
  snv: /SnV里|身份线|疯狂压力|分开听/,
};
const PUBLIC_TIMING_PRESSURE_VARIANT_PATTERNS = {
  "nomination-pressure": /提名前|压实|上台只剩防守/,
  "vote-intent": /到投票|压力票|补出解释|票前/,
};
const PUBLIC_ROLE_PRESSURE_VARIANT_PATTERNS = {
  "info-claim": /信息链|票型对上|不能只给身份名/,
  "outsider-risk": /风险边界|外来者身份|身份挡压/,
  "death-trigger": /死亡触发|死后信息|身份会挡掉压力/,
  protection: /保护口径|昨晚死亡|免票/,
  "public-action": /行动窗口|目标结果|能力牌/,
};
const PRIVATE_EVIDENCE_SYNTHESIS_PATTERN =
  /低证据推人和身份(?:口径)?对不上卡在一起|票型和身份(?:口径)?同时咬住|夜信链和身份(?:口径)?需要互相对上|保高压位和票型反向互相顶住|来源链和身份(?:口径)?卡在一起/;
const PRIVATE_EVIDENCE_SYNTHESIS_VARIANT_PATTERNS = {
  "identity-low-evidence": /低证据推人和身份(?:口径)?对不上卡在一起/,
  "identity-vote": /票型和身份(?:口径)?同时咬住/,
  "identity-night-info": /夜信链和身份(?:口径)?需要互相对上/,
  "protection-vote": /保高压位和票型反向互相顶住/,
  "source-identity": /来源链和身份(?:口径)?卡在一起/,
};
const PRIVATE_EVIDENCE_SYNTHESIS_VERIFICATION_PATTERNS = {
  "identity-low-evidence": /推低证据位.*身份口径.*公开验证/,
  "identity-vote": /身份口径.*投票.*压力相反/,
  "identity-night-info": /夜信来源.*身份口径.*公开验证/,
  "protection-vote": /维护高压位.*反票理由.*票型压力/,
  "source-identity": /来源.*复核.*身份口径.*公开验证/,
};
const PRIVATE_EVIDENCE_SYNTHESIS_SPOKEN_VERIFICATION_PATTERNS = {
  "identity-low-evidence": /(?:验证点|先听|先核|这条先问).*推低证据位.*身份(?:口径)?.*(?:公开|大家)验证.*对上/,
  "identity-vote": /(?:验证点|先听|先核|这条先问).*身份(?:口径)?.*投票.*压力相反/,
  "identity-night-info": /(?:验证点|先听|先核|这条先问).*夜信来源.*(?:复核|再对一下).*身份(?:口径)?.*(?:公开|大家)验证.*对上/,
  "protection-vote": /(?:验证点|先听|先核|这条先问).*维护高压位.*反票理由.*票型压力/,
  "source-identity": /(?:验证点|先听|先核|这条先问).*来源.*(?:复核|再对一下).*身份(?:口径)?.*(?:公开|大家)验证.*对齐/,
};
const PUBLIC_CLIPPED_EVIDENCE_PATTERN = /(?:当前压|可见|刚才投票|投票和|投票理|票型跟|公开站队和|身份解释|身份)(?:\.{3,}|…)/;
const NON_PUBLIC_CLIPPED_EVIDENCE_PATTERN = /投票态度摇摆，压(?:\.{3,}|…)|需要把昨(?:\.{3,}|…)/;
const NON_PUBLIC_SURFACE_POLISH_ARTIFACT_PATTERN =
  /[0-9]+\s+号|[0-9]+号\s+(?=[\u4e00-\u9fff])|[。！？；]\s+(?=\S)|(?:刚才|如果|昨天|今天|明天|前面)\s+[0-9]+号|[与和及]\s+[0-9]+号|(?:是|还是|为|按|报|跳|主线在|转到|转向|恶魔位|恶魔)\s+[0-9]+号|(?:点过|给|放下|放回|放低|丢给|交给)\s+[0-9]+号|(?:是|还是|为|按|报|跳)\s+[\u4e00-\u9fff]{1,12}(?=[，。；！？：、\s]|$)|(?:爪牙同伴|其他爪牙)\s+暂无|卡在\s+(?:在|前面|推低|身份|公开|两条|[0-9]+号)|换线\s+台面理由|(?:让|问|看|盯|对|排|压|转到|转|沿着|把|放过|放掉|清掉|处理|验|提|举|投|跟|出|在|不跟|不投|不举)\s+[0-9]+号/u;
const PUBLIC_SURFACE_POLISH_ARTIFACT_PATTERN =
  /我只给[“"']?我先给范围|我只给[“"'][^”"']{12,}范围|让\s+你\s*把身份和昨晚信息说清楚|来先|台面上。还是|先请[0-9]+号先|核法先交给[0-9]+号来(?:身份|把身份)|(?:核法是让|核法先交给|这条(?:先)?让|先请)[0-9]+号(?:来)?(?:把)?身份(?:口径)?先(?:对齐|对上|落到桌面)|把(?:身份和票型|没讲清的点)先(?:对上|对齐|补上)|先听[0-9]+号[^。！？；，,]{0,18}先(?:补|对|解释)|卡在\s+(?:在|前面|推低|身份|公开|两条|[0-9]+号)|[0-9]+号这边，在|[0-9]+号\s+(?:这条|这边|那条|也|的|刚才|我)|[。！？；]\s+(?=\S)|(?:刚才|如果|昨天|今天|明天|前面)\s+[0-9]+号|[与和及]\s+[0-9]+号|(?:是|还是|为|按|报|跳|主线在|转到|转向)\s+[0-9]+号|(?:点过|给|放下|放回|放低|丢给|交给)\s+[0-9]+号|(?:是|还是|为|按|报|跳)\s+[\u4e00-\u9fff]{1,12}(?=[，。；！？：、\s]|$)|(?:让|问|看|盯|对|排|压|转到|沿着|先把|把|放过)\s+[0-9]+号|[0-9]+号\s+(?:是|也|把|可以|需要|继续|先)/;
const PUBLIC_GENERIC_OPENER_PATTERN = /我的意思是/;

const EVIL_PUBLIC_COVER_MARKERS = [
  "好人视角",
  "台面上",
  "公开说",
  "节奏",
  "解围",
  "闭眼冲",
  "台面理由",
  "放进流程",
];

const EVIL_COVER_MAINTENANCE_PATTERN = /还是沿着|不急着换线|这轮先转到|台面压力有了新变化|备选压力位|不换线|继续/;
const EVIL_COVER_PIVOT_PATTERN = /这轮先转到|台面压力有了新变化|窗口不能再散|压力需要重新分配/;
const EVIL_PROTECT_ALLY_PATTERN = /台面压力别只堆一处|先把\s*[0-9]+号\s*也拉出来对话|压力重新分配|别只压一个点/;
const EVIL_CLAIM_COVER_CONTINUITY_PATTERN = /公开身份|仍按|信息口径|票型|这条说|不会无理由改口/;
const EVIL_CLAIM_COVER_PIVOT_PATTERN = /目标可以转|这轮先转到|台面压力有了新变化|窗口不能再散|压力需要重新分配/;
const EVIL_CLAIM_COVER_PROTECT_ALLY_PATTERN = /压力可以分散|台面压力别只堆一处|也拉出来对话|压力重新分配|别只压一个点/;
const EVIL_CLAIM_COVER_CROSS_DAY_PATTERN = /隔天身份线|昨天|前一天|身份线我不改|今天继续/;
const EVIL_CLAIM_COVER_DECEPTION_ARC_PATTERN =
  /(?:昨天身份线|隔天身份线|昨天已经(?:转到|盯过|看过)).*(?:压力可以分散|压力和目标可以重新分配|目标可以转|目标继续看)|(?:压力可以分散|压力和目标可以重新分配|目标可以转|目标继续看).*(?:昨天身份线|隔天身份线|昨天已经(?:转到|盯过|看过))/;
const EVIL_CLAIM_COVER_PRESSURE_CONTINUITY_PATTERN =
  /昨天已经(?:转到|盯过|看过)\s*[0-9]+号|[0-9]+号这条.*今天(?:继续|压力可以分散|目标继续看|压力和目标可以重新分配)/;
const EVIL_ONLY_LANGUAGE_PATTERN = /自己人|邪恶视角|真实身份|爪牙|恶魔伪装|当前可用伪装|魔典|PRIVATE_SECRET_MARKER|bluff/i;
const EVIL_PRIVATE_TEAM_PATTERN = /自己人|一边|邪恶视角|对底|队伍信息|恶魔位|爪牙/;
const EVIL_PRIVATE_IDENTITY_PATTERN = /真实身份|我真实身份/;
const EVIL_PRIVATE_COVER_PATTERN = /台面安排|台面上|伪装|装|低信息好人/;
const EVIL_PRIVATE_PRESSURE_PATTERN = /火力点|放到讨论中心|先压|先问|多说|先问身份和夜里信息|决定要不要提/;
const EVIL_PRIVATE_REASON_PATTERN = /理由|说法|公开身份|票型|台面压力|公聊提到|拿来做台面/;
const EVIL_PRIVATE_TEAM_INFO_PATTERNS = [
  /队伍先对齐：恶魔位\s*[0-9]+号/u,
  /我这边知道的底牌：恶魔是\s*[0-9]+号/u,
  /先把队伍信息说清，恶魔\s*[0-9]+号/u,
  /邪恶视角先对底：恶魔位\s*[0-9]+号/u,
  /我这边的队伍牌面：恶魔\s*[0-9]+号/u,
  /队伍先对齐：我这边看到的爪牙是/u,
  /先把队伍信息放清：爪牙位/u,
  /邪恶视角先对底，爪牙位是/u,
  /我这边的队伍牌面：爪牙/u,
];
const EVIL_PRIVATE_COVER_PLAN_PATTERNS = [
  /台面安排：伪装先不锁死，今天把\s*[0-9]+号\s*放到火力点/u,
  /台面上我先不定死伪装，今天把\s*[0-9]+号\s*放到火力点/u,
  /伪装先留活口，白天先压\s*[0-9]+号\s*的身份和夜里信息/u,
  /台面身份边走边补，今天先把\s*[0-9]+号\s*放到讨论中心/u,
  /低信息好人方向先留着，今天把\s*[0-9]+号\s*放到火力点/u,
  /台面安排：我先往.+这个方向装，今天把\s*[0-9]+号\s*放到火力点/u,
];
const OLD_CLAIM_DISCLOSURE_HOLD_LEAD_PATTERN = /延续前面的(?:身份口径|“[^”]+”范围)/u;
const CLAIM_DISCLOSURE_HOLD_LEAD_PATTERNS = [
  /身份线我不改，今天仍按/u,
  /.+这条身份线不改，今天仍按它来聊/u,
  /前面这条身份我先不换，继续按/u,
  /.+这条我先不换，继续按前面(?:口径|说法)说/u,
  /这轮不改身份(?:口径|说法)，还是按/u,
  /.+(?:口径|说法)这轮不改，还是沿着这条聊/u,
  /我不无理由改口，.+这条继续放桌面上/u,
  /这条身份先沿用.+，让后续追问接着核/u,
  /.+这条身份先沿用，让后续追问接着核/u,
  /今天不重开身份线，.+这条继续留给桌面核/u,
  /.+身份线今天不重开，这条继续留给桌面核/u,
  /我先稳住.+(?:口径|说法)，不为了压力临时换说法/u,
  /前面报过的.+先不撤，后续按这条继续验/u,
  /.+前面报过先不撤，后续按这条继续验/u,
  /前面的“[^”]+”范围我先不改/u,
  /身份范围暂时沿用“[^”]+”/u,
  /我还按“[^”]+”这个范围说/u,
  /身份口径我先不无理由改口/u,
];
const OLD_CLAIM_DISCLOSURE_BALANCED_REASON_PATTERN = /当前适合给可追问口径，但不一定一次交死/u;
const CLAIM_DISCLOSURE_BALANCED_REASON_PATTERNS = [
  /现在需要把身份口径交到能被追问的程度/u,
  /这轮要让桌面有具体口径可以复核/u,
  /身份线已经到该给可验证落点的时候/u,
  /继续含糊只会让后续追问失焦/u,
  /先给桌面能追问的边界，不把具体身份一次说死/u,
  /现在适合交可核范围，具体身份还留一点余地/u,
  /这轮先让口径可追问，身份细节等压力再补/u,
  /先把可验证边界放出来，不急着把整条身份线摊完/u,
];

function spokenLineAppearsInText(line, text) {
  const expected = `${line ?? ""}`.trim();
  const visible = `${text ?? ""}`.trim();
  if (!expected || !visible) {
    return false;
  }
  if (visible.includes(expected)) {
    return true;
  }
  const variants = [
    expected.replaceAll("口径", "说法"),
    expected.replaceAll("说法", "口径"),
  ].filter((entry, index, list) => entry && list.indexOf(entry) === index);
  return variants.some((variant) => visible.includes(variant));
}

const FORMAL_VOTE_REASON_MODES = [
  "evidence-backed-yes",
  "pressure-threshold-yes",
  "evidence-below-threshold",
  "pressure-below-threshold",
  "ghost-vote-pressure",
  "cannot-vote",
  "butler-restricted",
  "table-balance-no",
  "execution-window-yes",
];
const FORMAL_VOTE_NEAR_THRESHOLD_PATTERN = /贴线|勉强|刚过|差一点|几乎到线|还差一句|不是锁死/;
const FORMAL_VOTE_EVIDENCE_BOUNDARY_PATTERN =
  /(?:证据|线索|公开证据).*(?:贴线|勉强|刚过|差一点|几乎到线|还差一句|不是锁死|过线)|(?:贴线|勉强|刚过|差一点|几乎到线|还差一句|不是锁死|过线).*(?:证据|线索|公开证据)/;
const FORMAL_VOTE_MULTI_EVIDENCE_PATTERN = /两条|多条|不止一条|身份和票型|公开线索|合在一起|合成/;
const FORMAL_VOTE_TABLE_CONTEXT_PATTERN = /投票|票型|提名|回应|证据|线索|防守|解释|公开|处决|站边|信息|身份/;
const FORMAL_VOTE_EVIL_COVER_PATTERN = /台面压力|第二压力位|旁边压力|执行窗口|流程|票型|落票|压力别只堆/;
const FORMAL_VOTE_EVIL_COVER_LEAK_PATTERN =
  /自己人|邪恶视角|真实身份|爪牙|恶魔伪装|当前可用伪装|魔典|PRIVATE_SECRET_MARKER|bluff|evil|framing|sacrifice|protective|minion|demon|ally/i;
const CROSS_DAY_STANCE_CHANGE_PATTERN = /比昨天多\d+条可见线索|比昨天少\d+条可见线索|证据量没少|新信息更重|昨天线没被洗掉/;

function createQualityState(seed = 2026060201) {
  const rng = fixedRng(seed);
  const state = createNewGame({ scriptId: "tb", playerCount: 9, preferredHumanRoleId: "washerwoman" }, rng);
  state.aiQualityRunId = `tb-quality-${seed}`;
  initializeAI(state);
  runNight(state, rng);

  const observer = state.players.find((player) => !player.isHuman && player.team === "good" && player.alive);
  const focus = state.players.find((player) => !player.isHuman && player.id !== observer?.id && player.alive);
  const runnerUp = state.players.find(
    (player) => !player.isHuman && player.id !== observer?.id && player.id !== focus?.id && player.alive
  );
  const proactiveSpeaker = state.players.find(
    (player) => !player.isHuman && player.id !== observer?.id && player.id !== focus?.id && player.alive
  );

  if (observer && focus && runnerUp) {
    state.players.forEach((player) => {
      observer.suspicion[player.id] = 0.12;
    });
    observer.suspicion[focus.id] = 0.84;
    observer.suspicion[runnerUp.id] = 0.72;
    addAgentObservation(state, observer.id, {
      kind: "public-speech",
      source: "public-chat",
      private: false,
      text: `${seat(focus)} 的公开身份和前面发言对不上，需要先回应。`,
      payload: {
        speakerId: focus.id,
        focusId: focus.id,
        polarity: "accuse",
      },
    });
    addAgentObservation(state, observer.id, {
      kind: "public-vote",
      source: "public-procedure",
      private: false,
      text: `${seat(focus)} 刚才投票态度摇摆，压力继续上升。`,
      payload: {
        voterId: focus.id,
        targetId: focus.id,
        focusId: focus.id,
        polarity: "accuse",
      },
    });
    addAgentObservation(state, observer.id, {
      kind: "public-speech",
      source: "public-chat",
      private: false,
      text: `${seat(runnerUp)} 也有身份口径要补，但目前只有一条轻线索。`,
      payload: {
        speakerId: runnerUp.id,
        focusId: runnerUp.id,
        polarity: "accuse",
      },
    });
  }
  if (proactiveSpeaker && focus) {
    state.players.forEach((player) => {
      proactiveSpeaker.suspicion[player.id] = Math.min(proactiveSpeaker.suspicion[player.id] ?? 0.12, 0.2);
    });
    proactiveSpeaker.suspicion[focus.id] = 0.78;
    addAgentObservation(state, proactiveSpeaker.id, {
      kind: "public-speech",
      source: "public-chat",
      private: false,
      text: `${seat(focus)} 的投票和身份解释连不上，适合先私下同步。`,
      payload: {
        speakerId: focus.id,
        focusId: focus.id,
        polarity: "accuse",
      },
    });
  }

  return { state, rng, observer, focus, runnerUp };
}

function rowFromPrivateResult(state, scenarioId, index, speaker, input, result) {
  return {
    id: `${scenarioId}-private-${index}`,
    scenarioId,
    qualityRunId: qualityRunId(state, scenarioId),
    scriptId: state.scriptId ?? "",
    audience: "private",
    source: "private-whisper",
    intent: input.intentHint ?? "",
    speakerId: speaker?.id ?? "",
    speakerName: seat(speaker),
    speakerTeam: speaker?.team ?? "",
    prompt: input.humanLine,
    text: oneLine(result.ok ? result.response : result.reason),
    ok: !!result.ok,
    focusId: result.focusId ?? result.decisionRationale?.focusId ?? "",
    focusName: playerName(state, result.focusId ?? result.decisionRationale?.focusId),
    decisionRationale: result.decisionRationale ?? null,
    claimDisclosureRationale: result.claimDisclosureRationale ?? null,
    crossDayStance: result.crossDayStance ?? null,
    strategyRationale: null,
    evidenceSummaries: result.evidenceContract?.summaries ?? [],
    evidenceSpokenText: result.evidenceContract?.spokenText ?? "",
    evidenceGraphChains: result.evidenceContract?.graphChains ?? [],
    requiresClaimDisclosureRationale: !input.allowHiddenTruth && ["claim", "night"].includes(input.intentHint ?? ""),
    requiresClaimDisclosureContinuity: !!input.requiresClaimDisclosureContinuity,
    allowHiddenTruth: !!input.allowHiddenTruth,
    humanTeam: input.humanTeam ?? "",
  };
}

function markHiddenAllowedPrivateRow(row, extra = {}) {
  return {
    ...row,
    allowHiddenTruth: true,
    ...extra,
  };
}

function rowFromProactiveMessage(state, scenarioId, index, message) {
  return {
    id: `${scenarioId}-proactive-${index}`,
    scenarioId,
    qualityRunId: qualityRunId(state, scenarioId),
    scriptId: state.scriptId ?? "",
    audience: "private",
    source: "proactive-private",
    intent: message.intent ?? "",
    speakerId: message.targetId ?? "",
    speakerName: message.targetName ?? playerName(state, message.targetId),
    prompt: message.reason || "proactive private whisper",
    text: oneLine(message.response),
    ok: !!message.response,
    focusId: message.focusId ?? message.decisionRationale?.focusId ?? "",
    focusName: playerName(state, message.focusId ?? message.decisionRationale?.focusId),
    decisionRationale: message.decisionRationale ?? null,
    claimDisclosureRationale: message.claimDisclosureRationale ?? null,
    crossDayStance: message.crossDayStance ?? null,
    strategyRationale: null,
    evidenceSummaries: [],
    evidenceSpokenText: "",
    evidenceGraphChains: [],
    requiresClaimDisclosureRationale: !!message.claimDisclosureRationale,
    allowHiddenTruth: false,
  };
}

function rowFromAIToAIPrivateMessage(state, scenarioId, index, message) {
  const speaker = state.players?.find((player) => player.id === message.speakerId);
  const target = state.players?.find((player) => player.id === message.targetId);
  return {
    id: `${scenarioId}-ai-to-ai-${index}`,
    scenarioId,
    qualityRunId: qualityRunId(state, scenarioId),
    scriptId: state.scriptId ?? "",
    audience: "private",
    source: "ai-ai-private",
    intent: message.intent ?? "",
    speakerId: message.speakerId ?? "",
    speakerName: message.speakerName ?? playerName(state, message.speakerId),
    speakerTeam: speaker?.team ?? "",
    targetId: message.targetId ?? "",
    targetName: message.targetName ?? playerName(state, message.targetId),
    targetTeam: target?.team ?? "",
    prompt: "hidden AI-AI private whisper",
    text: oneLine(message.response),
    ok: !!message.response,
    focusId: message.focusId ?? "",
    focusName: playerName(state, message.focusId),
    decisionRationale: message.decisionRationale ?? null,
    claimDisclosureRationale: null,
    crossDayStance: message.crossDayStance ?? null,
    strategyRationale: null,
    evidenceSummaries: [],
    evidenceSpokenText: "",
    evidenceGraphChains: [],
    aiToAi: true,
    hiddenFromHuman: true,
    allowHiddenTruth: true,
  };
}

function latestPublicClaimForPlayer(state, playerId) {
  if (!playerId || !Array.isArray(state?.events?.claims)) {
    return null;
  }
  return [...state.events.claims]
    .reverse()
    .find((claim) => claim?.playerId === playerId && claim?.roleId && !claim?.private) ?? null;
}

function rowFromPublicSpeech(state, scenarioId, entry, index) {
  const speaker = state.players?.find((player) => player.id === entry.playerId);
  const focusId = entry.focusId ?? entry.decisionRationale?.focusId ?? "";
  const publicClaim = latestPublicClaimForPlayer(state, focusId);
  const thoughtQuestion = state.aiDialogue?.thoughtFramesByAgentId?.[entry.playerId]?.questionToAsk ?? "";
  const verificationQuestion = entry.decisionRationale?.verificationLine ?? entry.decisionRationale?.verificationQuestion ?? "";
  return {
    id: `${scenarioId}-public-${index}`,
    scenarioId,
    qualityRunId: qualityRunId(state, scenarioId),
    scriptId: state.scriptId ?? "",
    audience: "public",
    source: "public-discussion",
    intent: entry.intent ?? "",
    debateBeat: entry.debateBeat ?? "",
    speakerId: entry.playerId ?? "",
    speakerName: playerName(state, entry.playerId),
    speakerTeam: speaker?.team ?? "",
    speakerPersona: speaker?.aiPersona ?? "",
    prompt: "public discussion",
    text: oneLine(entry.line),
    ok: true,
    focusId,
    focusName: playerName(state, focusId),
    publicClaimRoleId: publicClaim?.roleId ?? "",
    publicClaimRoleName: publicClaim?.roleId ? roleNameById(state, publicClaim.roleId) : "",
    decisionRationale: entry.decisionRationale ?? null,
    claimDisclosureRationale: entry.claimDisclosureRationale ?? null,
    crossDayStance: entry.crossDayStance ?? null,
    strategyRationale: null,
    evidenceSummaries: entry.evidenceContract?.summaries ?? [],
    evidenceSpokenText: entry.evidenceContract?.spokenText ?? "",
    evidenceGraphChains: entry.evidenceContract?.graphChains ?? [],
    personaPressureLine: entry.personaPressureLine ?? "",
    scriptPressureLine: entry.scriptPressureLine ?? "",
    timingPressureLine: entry.timingPressureLine ?? "",
    rolePressureLine: entry.rolePressureLine ?? "",
    thoughtQuestion,
    verificationQuestion,
    personaMarkers: publicPersonaMarkers(speaker?.aiPersona),
    requiresPublicPrioritySignals: !!(entry.focusId && entry.evidenceContract?.spokenText && (thoughtQuestion || verificationQuestion)),
    requiresEvilCoverTexture: speaker?.team === "evil",
    requiresClaimDisclosureRationale: !!entry.claimDisclosureRationale,
    allowHiddenTruth: false,
  };
}

function resetQualityStateForNextPublicDay(state) {
  state.day += 1;
  state.phase = "day";
  state.dayStage = "public";
  state.dayStageMeta = state.dayStageMeta ?? {};
  state.dayStageMeta.publicRounds = 0;
  state.dayStageMeta.publicConversation = null;
  state.dayStageMeta.nominationClock = null;
  state.dayStageMeta.nominationDebate = null;
  state.dayStageMeta.privateUsed = 0;
  state.dayStageMeta.privateTargets = [];
  state.players.forEach((player) => {
    player.nominatedToday = false;
    player.beenNominatedToday = false;
  });
}

function resetQualityStateForNextPrivateDay(state) {
  resetQualityStateForNextPublicDay(state);
  state.dayStage = "private";
  state.dayStageMeta.privateUsed = 0;
  state.dayStageMeta.privateTargets = [];
}

function seedPriorCrossDayStance(state, speaker, target, { stance, score, reasonSummary, evidenceCount = 1 }) {
  if (!speaker?.id || !target?.id) {
    return;
  }
  state.aiDialogue = state.aiDialogue ?? {};
  state.aiDialogue.stanceHistoryBySpeakerId = state.aiDialogue.stanceHistoryBySpeakerId ?? {};
  state.aiDialogue.stanceHistoryBySpeakerId[speaker.id] = state.aiDialogue.stanceHistoryBySpeakerId[speaker.id] ?? {};
  const ledger = state.aiDialogue.stanceHistoryBySpeakerId[speaker.id];
  const priorDay = Math.max(1, Number(state.day ?? 1) - 1);
  const prior = {
    day: priorDay,
    targetId: target.id,
    stance,
    firstScore: score,
    lastScore: score,
    sources: ["quality-fixture"],
    turns: 1,
    reasonSummary,
    firstReasonSummary: reasonSummary,
    lastReasonSummary: reasonSummary,
    evidenceSnippets: reasonSummary ? [reasonSummary] : [],
    lastEvidenceSnippets: reasonSummary ? [reasonSummary] : [],
    evidenceAnchors: reasonSummary
      ? [
          {
            evidenceId: `${speaker.id}-${target.id}-prior-day-${priorDay}`,
            observationId: `${speaker.id}-${target.id}-prior-stance-${priorDay}`,
            kind: "quality-prior-stance",
            source: "quality-fixture",
            sourceId: speaker.id,
            visibility: "public",
            day: priorDay,
            night: 0,
            timestamp: priorDay,
            text: reasonSummary,
          },
        ]
      : [],
    lastEvidenceAnchors: reasonSummary
      ? [
          {
            evidenceId: `${speaker.id}-${target.id}-prior-day-${priorDay}`,
            observationId: `${speaker.id}-${target.id}-prior-stance-${priorDay}`,
            kind: "quality-prior-stance",
            source: "quality-fixture",
            sourceId: speaker.id,
            visibility: "public",
            day: priorDay,
            night: 0,
            timestamp: priorDay,
            text: reasonSummary,
          },
        ]
      : [],
    eventAnchors: reasonSummary
      ? [
          {
            eventId: `${speaker.id}-${target.id}-prior-event-${priorDay}`,
            timelineEntryId: `${speaker.id}-${target.id}-prior-event-${priorDay}`,
            mode: "public",
            source: "quality-fixture",
            audience: "public",
            speakerId: speaker.id,
            targetId: target.id,
            focusId: target.id,
            visibility: "public",
            day: priorDay,
            night: 0,
            timestamp: priorDay,
            focusScore: score,
            text: reasonSummary,
          },
        ]
      : [],
    lastEventAnchors: reasonSummary
      ? [
          {
            eventId: `${speaker.id}-${target.id}-prior-event-${priorDay}`,
            timelineEntryId: `${speaker.id}-${target.id}-prior-event-${priorDay}`,
            mode: "public",
            source: "quality-fixture",
            audience: "public",
            speakerId: speaker.id,
            targetId: target.id,
            focusId: target.id,
            visibility: "public",
            day: priorDay,
            night: 0,
            timestamp: priorDay,
            focusScore: score,
            text: reasonSummary,
          },
        ]
      : [],
    scoreTrailAnchors: reasonSummary
      ? [
          {
            trailId: `${speaker.id}-${target.id}-prior-trail-${priorDay}`,
            evidenceId: `${speaker.id}-${target.id}-prior-day-${priorDay}`,
            observationId: `${speaker.id}-${target.id}-prior-stance-${priorDay}`,
            reasonKey: "quality-prior-stance",
            kind: "quality-prior-stance",
            source: "quality-fixture",
            sourceId: speaker.id,
            visibility: "public",
            day: priorDay,
            night: 0,
            timestamp: priorDay,
            before: Math.max(0, score - 0.02),
            after: score,
            appliedDelta: 0.02,
            text: reasonSummary,
          },
        ]
      : [],
    lastScoreTrailAnchors: reasonSummary
      ? [
          {
            trailId: `${speaker.id}-${target.id}-prior-trail-${priorDay}`,
            evidenceId: `${speaker.id}-${target.id}-prior-day-${priorDay}`,
            observationId: `${speaker.id}-${target.id}-prior-stance-${priorDay}`,
            reasonKey: "quality-prior-stance",
            kind: "quality-prior-stance",
            source: "quality-fixture",
            sourceId: speaker.id,
            visibility: "public",
            day: priorDay,
            night: 0,
            timestamp: priorDay,
            before: Math.max(0, score - 0.02),
            after: score,
            appliedDelta: 0.02,
            text: reasonSummary,
          },
        ]
      : [],
    evidenceCount,
  };
  ledger[target.id] = [
    ...(Array.isArray(ledger[target.id]) ? ledger[target.id] : []).filter((entry) => Number(entry?.day ?? 0) < priorDay),
    prior,
  ].slice(-24);
}

function forceNextPublicResponse(state, speaker, focus, options = {}) {
  state.dayStageMeta = state.dayStageMeta ?? {};
  state.dayStageMeta.publicRounds = 0;
  state.dayStageMeta.publicConversation = {
    active: true,
    step: 0,
    clock: "response",
    pressure: 0,
    activeSpeakerId: null,
    focusId: focus?.id ?? null,
    pendingResponseSpeakerId: speaker?.id ?? null,
    pendingResponseFocusId: focus?.id ?? null,
    pendingQuestionText: "quality cross-day fixture",
    suppressSelfDisclosure: !!options.suppressSelfDisclosure,
    canContinue: true,
    suggestedActions: ["continue-public"],
    lastUpdatedDay: state.day ?? 0,
  };
}

function pushCrossDayPublicStep(rows, state, scenarioId, index, speaker, focus, rng) {
  forceNextPublicResponse(state, speaker, focus);
  const before = state.events.speeches.length;
  const step = runAIConversationStep(state, rng);
  if (!step.ok) {
    return;
  }
  const speech = state.events.speeches
    .slice(before)
    .find((entry) => !entry.private && entry.playerId === speaker.id && entry.focusId === focus.id && entry.crossDayStance);
  if (speech) {
    rows.push(rowFromPublicSpeech(state, scenarioId, speech, index));
  }
}

function pushEvilCoverPublicRow(rows, scenarioId, seed = 2026060301) {
  const { state, rng } = createQualityState(seed);
  advanceDayStage(state, "public");
  const evilAI = state.players.find((player) => !player.isHuman && player.team === "evil" && player.alive);
  const target = state.players.find((player) => !player.isHuman && player.team === "good" && player.alive);
  if (!evilAI || !target) {
    return;
  }

  evilAI.aiPersona = "shadow";
  evilAI.dialogueBias = evilAI.dialogueBias ?? {};
  state.players.forEach((player) => {
    evilAI.suspicion[player.id] = player.id === target.id ? 0.84 : 0.12;
    evilAI.dialogueBias[player.id] = player.id === target.id ? 0.9 : -0.1;
  });
  addAgentObservation(state, evilAI.id, {
    kind: "public-speech",
    source: "public-chat",
    private: false,
    text: `${seat(target)} 的公开身份和前面发言对不上，适合放到台面上压回应。`,
    payload: {
      speakerId: target.id,
      focusId: target.id,
      polarity: "accuse",
    },
  });

  const beforePublic = state.events.speeches.length;
  runAIDiscussion(state, rng);
  const speech = state.events.speeches
    .slice(beforePublic)
    .find((entry) => !entry.private && entry.playerId === evilAI.id);
  if (speech) {
    rows.push(rowFromPublicSpeech(state, scenarioId, speech, "evil-cover"));
  }
  forceNextPublicResponse(state, evilAI, target);
  const beforeMaintenance = state.events.speeches.length;
  runAIConversationStep(state, rng);
  const maintenanceSpeech = state.events.speeches
    .slice(beforeMaintenance)
    .find((entry) => !entry.private && entry.playerId === evilAI.id && entry.focusId === target.id);
  if (maintenanceSpeech) {
    rows.push({
      ...rowFromPublicSpeech(state, scenarioId, maintenanceSpeech, "evil-cover-maintenance"),
      requiresEvilCoverMaintenance: true,
    });
  }
}

function pushEvilCoverPivotRow(rows, scenarioId, seed = 2026060302) {
  const { state, rng } = createQualityState(seed);
  advanceDayStage(state, "public");
  const evilAI = state.players.find((player) => !player.isHuman && player.team === "evil" && player.alive);
  const [firstTarget, secondTarget] = state.players
    .filter((player) => !player.isHuman && player.team === "good" && player.alive)
    .slice(0, 2);
  if (!evilAI || !firstTarget || !secondTarget) {
    return;
  }

  evilAI.aiPersona = "shadow";
  evilAI.dialogueBias = evilAI.dialogueBias ?? {};
  state.players.forEach((player) => {
    evilAI.suspicion[player.id] = 0.12;
    evilAI.dialogueBias[player.id] = -0.2;
  });
  evilAI.suspicion[firstTarget.id] = 0.84;
  evilAI.dialogueBias[firstTarget.id] = 0.95;
  addAgentObservation(state, evilAI.id, {
    kind: "public-speech",
    source: "public-chat",
    private: false,
    text: `${seat(firstTarget)} 的公开身份和前面发言对不上，适合放到台面上压回应。`,
    payload: {
      speakerId: firstTarget.id,
      focusId: firstTarget.id,
      polarity: "accuse",
    },
  });
  runAIDiscussion(state, rng);

  evilAI.suspicion[firstTarget.id] = 0.15;
  evilAI.dialogueBias[firstTarget.id] = -0.5;
  evilAI.suspicion[secondTarget.id] = 0.99;
  evilAI.dialogueBias[secondTarget.id] = 1.2;
  addAgentObservation(state, evilAI.id, {
    kind: "public-speech",
    source: "public-chat",
    private: false,
    text: `${seat(secondTarget)} 的公开身份和投票解释突然连不上，台面压力比前一条更高。`,
    payload: {
      speakerId: secondTarget.id,
      focusId: secondTarget.id,
      polarity: "accuse",
    },
  });
  forceNextPublicResponse(state, evilAI, secondTarget);
  const beforePivot = state.events.speeches.length;
  runAIConversationStep(state, rng);
  const pivotSpeech = state.events.speeches
    .slice(beforePivot)
    .find((entry) => !entry.private && entry.playerId === evilAI.id && entry.focusId === secondTarget.id);
  if (pivotSpeech) {
    rows.push({
      ...rowFromPublicSpeech(state, scenarioId, pivotSpeech, "evil-cover-pivot"),
      requiresEvilCoverPivot: true,
    });
  }
}

function pushEvilProtectAllyPublicRow(rows, scenarioId, seed = 2026060303) {
  const { state, rng } = createQualityState(seed);
  advanceDayStage(state, "public");
  const evilAI = state.players.find(
    (player) =>
      !player.isHuman &&
      player.team === "evil" &&
      player.alive &&
      (getAIAgent(state, player)?.knownAllyIds ?? []).some((id) => id !== player.id)
  );
  const allyId = getAIAgent(state, evilAI)?.knownAllyIds?.find((id) => id !== evilAI?.id);
  const ally = state.players.find((player) => player.id === allyId);
  const target = state.players.find(
    (player) => !player.isHuman && player.team === "good" && player.alive && player.id !== evilAI?.id && player.id !== ally?.id
  );
  if (!evilAI || !ally || !target) {
    return;
  }

  evilAI.aiPersona = "shadow";
  evilAI.dialogueBias = evilAI.dialogueBias ?? {};
  state.players.forEach((player) => {
    evilAI.suspicion[player.id] = 0.12;
    evilAI.dialogueBias[player.id] = -0.2;
  });
  ally.beenNominatedToday = true;
  ally.nominatedToday = true;
  evilAI.suspicion[ally.id] = 0.72;
  evilAI.dialogueBias[ally.id] = 0.8;
  evilAI.suspicion[target.id] = 0.76;
  evilAI.dialogueBias[target.id] = 0.9;
  addAgentObservation(state, evilAI.id, {
    kind: "public-speech",
    source: "public-chat",
    private: false,
    text: `${seat(ally)} 刚刚被台面集中压，但 ${seat(target)} 的身份解释也明显连不上。`,
    payload: {
      speakerId: ally.id,
      focusId: ally.id,
      polarity: "accuse",
    },
  });
  addAgentObservation(state, evilAI.id, {
    kind: "public-speech",
    source: "public-chat",
    private: false,
    text: `${seat(target)} 的公开身份和前面发言对不上，适合放到台面上压回应。`,
    payload: {
      speakerId: target.id,
      focusId: target.id,
      polarity: "accuse",
    },
  });
  forceNextPublicResponse(state, evilAI, target);
  const beforeProtect = state.events.speeches.length;
  runAIConversationStep(state, rng);
  const protectSpeech = state.events.speeches
    .slice(beforeProtect)
    .find((entry) => !entry.private && entry.playerId === evilAI.id && entry.focusId === target.id);
  if (protectSpeech) {
    rows.push({
      ...rowFromPublicSpeech(state, scenarioId, protectSpeech, "evil-protect-ally"),
      requiresEvilProtectAlly: true,
    });
  }
}

function pushEvilClaimCoverContinuityRow(rows, scenarioId, seed = 2026060304) {
  const { state, rng } = createQualityState(seed);
  advanceDayStage(state, "public");
  const evilAI = state.players.find((player) => !player.isHuman && player.team === "evil" && player.alive);
  const target = state.players.find((player) => !player.isHuman && player.team === "good" && player.alive);
  const claimRoleId = getRoleById(state.scriptId, "investigator") ? "investigator" : "washerwoman";
  if (!evilAI || !target || !claimRoleId) {
    return;
  }

  evilAI.aiPersona = "shadow";
  evilAI.publicClaimRoleId = claimRoleId;
  const publicClaim = {
    day: state.day,
    playerId: evilAI.id,
    roleId: claimRoleId,
    private: false,
  };
  state.events.claims = state.events.claims ?? [];
  state.events.claims.push(publicClaim);
  recordPublicClaimForAgents(state, publicClaim);

  evilAI.dialogueBias = evilAI.dialogueBias ?? {};
  state.players.forEach((player) => {
    evilAI.suspicion[player.id] = player.id === target.id ? 0.86 : 0.12;
    evilAI.dialogueBias[player.id] = player.id === target.id ? 0.95 : -0.1;
  });
  addAgentObservation(state, evilAI.id, {
    kind: "public-speech",
    source: "public-chat",
    private: false,
    text: `${seat(target)} 的公开身份和票型解释对不上，适合继续放到台面上压回应。`,
    payload: {
      speakerId: target.id,
      focusId: target.id,
      polarity: "accuse",
    },
  });

  forceNextPublicResponse(state, evilAI, target);
  const beforeClaimCover = state.events.speeches.length;
  runAIConversationStep(state, rng);
  const claimCoverSpeech = state.events.speeches
    .slice(beforeClaimCover)
    .find((entry) => !entry.private && entry.playerId === evilAI.id && entry.focusId === target.id);
  if (claimCoverSpeech) {
    rows.push({
      ...rowFromPublicSpeech(state, scenarioId, claimCoverSpeech, "evil-claim-cover-continuity"),
      requiresEvilClaimCoverContinuity: true,
      expectedClaimRoleId: claimRoleId,
      expectedClaimRoleName: roleNameById(state, claimRoleId),
    });
  }
}

function pushEvilClaimCoverPivotRow(rows, scenarioId, seed = 2026060305) {
  const { state, rng } = createQualityState(seed);
  advanceDayStage(state, "public");
  const evilAI = state.players.find((player) => !player.isHuman && player.team === "evil" && player.alive);
  const [firstTarget, secondTarget] = state.players
    .filter((player) => !player.isHuman && player.team === "good" && player.alive)
    .slice(0, 2);
  const claimRoleId = getRoleById(state.scriptId, "investigator") ? "investigator" : "washerwoman";
  if (!evilAI || !firstTarget || !secondTarget || !claimRoleId) {
    return;
  }

  evilAI.aiPersona = "shadow";
  evilAI.publicClaimRoleId = claimRoleId;
  const publicClaim = {
    day: state.day,
    playerId: evilAI.id,
    roleId: claimRoleId,
    private: false,
  };
  state.events.claims = state.events.claims ?? [];
  state.events.claims.push(publicClaim);
  recordPublicClaimForAgents(state, publicClaim);

  evilAI.dialogueBias = evilAI.dialogueBias ?? {};
  state.players.forEach((player) => {
    evilAI.suspicion[player.id] = 0.12;
    evilAI.dialogueBias[player.id] = -0.2;
  });
  evilAI.suspicion[firstTarget.id] = 0.84;
  evilAI.dialogueBias[firstTarget.id] = 0.95;
  addAgentObservation(state, evilAI.id, {
    kind: "public-speech",
    source: "public-chat",
    private: false,
    text: `${seat(firstTarget)} 的公开身份和前面发言对不上，适合放到台面上压回应。`,
    payload: {
      speakerId: firstTarget.id,
      focusId: firstTarget.id,
      polarity: "accuse",
    },
  });
  runAIDiscussion(state, rng);

  evilAI.suspicion[firstTarget.id] = 0.15;
  evilAI.dialogueBias[firstTarget.id] = -0.5;
  evilAI.suspicion[secondTarget.id] = 0.99;
  evilAI.dialogueBias[secondTarget.id] = 1.2;
  addAgentObservation(state, evilAI.id, {
    kind: "public-speech",
    source: "public-chat",
    private: false,
    text: `${seat(secondTarget)} 的公开身份和票型解释突然连不上，台面压力比前一条更高。`,
    payload: {
      speakerId: secondTarget.id,
      focusId: secondTarget.id,
      polarity: "accuse",
    },
  });

  forceNextPublicResponse(state, evilAI, secondTarget);
  const beforePivot = state.events.speeches.length;
  runAIConversationStep(state, rng);
  const pivotSpeech = state.events.speeches
    .slice(beforePivot)
    .find((entry) => !entry.private && entry.playerId === evilAI.id && entry.focusId === secondTarget.id);
  if (pivotSpeech) {
    rows.push({
      ...rowFromPublicSpeech(state, scenarioId, pivotSpeech, "evil-claim-cover-pivot"),
      requiresEvilClaimCoverPivot: true,
      expectedClaimRoleId: claimRoleId,
      expectedClaimRoleName: roleNameById(state, claimRoleId),
    });
  }
}

function pushEvilClaimCoverProtectAllyRow(rows, scenarioId, seed = 2026060306) {
  const { state, rng } = createQualityState(seed);
  advanceDayStage(state, "public");
  const evilAI = state.players.find(
    (player) =>
      !player.isHuman &&
      player.team === "evil" &&
      player.alive &&
      (getAIAgent(state, player)?.knownAllyIds ?? []).some((id) => id !== player.id)
  );
  const allyId = getAIAgent(state, evilAI)?.knownAllyIds?.find((id) => id !== evilAI?.id);
  const ally = state.players.find((player) => player.id === allyId);
  const target = state.players.find(
    (player) => !player.isHuman && player.team === "good" && player.alive && player.id !== evilAI?.id && player.id !== ally?.id
  );
  const claimRoleId = getRoleById(state.scriptId, "investigator") ? "investigator" : "washerwoman";
  if (!evilAI || !ally || !target || !claimRoleId) {
    return;
  }

  evilAI.aiPersona = "shadow";
  evilAI.publicClaimRoleId = claimRoleId;
  const publicClaim = {
    day: state.day,
    playerId: evilAI.id,
    roleId: claimRoleId,
    private: false,
  };
  state.events.claims = state.events.claims ?? [];
  state.events.claims.push(publicClaim);
  recordPublicClaimForAgents(state, publicClaim);

  evilAI.dialogueBias = evilAI.dialogueBias ?? {};
  state.players.forEach((player) => {
    evilAI.suspicion[player.id] = 0.12;
    evilAI.dialogueBias[player.id] = -0.2;
  });
  ally.beenNominatedToday = true;
  ally.nominatedToday = true;
  evilAI.suspicion[ally.id] = 0.72;
  evilAI.dialogueBias[ally.id] = 0.8;
  evilAI.suspicion[target.id] = 0.76;
  evilAI.dialogueBias[target.id] = 0.9;
  addAgentObservation(state, evilAI.id, {
    kind: "public-speech",
    source: "public-chat",
    private: false,
    text: `${seat(ally)} 刚刚被台面集中压，但 ${seat(target)} 的身份解释也明显连不上。`,
    payload: {
      speakerId: ally.id,
      focusId: ally.id,
      polarity: "accuse",
    },
  });
  addAgentObservation(state, evilAI.id, {
    kind: "public-speech",
    source: "public-chat",
    private: false,
    text: `${seat(target)} 的公开身份和前面发言对不上，适合放到台面上压回应。`,
    payload: {
      speakerId: target.id,
      focusId: target.id,
      polarity: "accuse",
    },
  });
  forceNextPublicResponse(state, evilAI, target);
  const beforeProtect = state.events.speeches.length;
  runAIConversationStep(state, rng);
  const protectSpeech = state.events.speeches
    .slice(beforeProtect)
    .find((entry) => !entry.private && entry.playerId === evilAI.id && entry.focusId === target.id);
  if (protectSpeech) {
    rows.push({
      ...rowFromPublicSpeech(state, scenarioId, protectSpeech, "evil-claim-cover-protect-ally"),
      requiresEvilClaimCoverProtectAlly: true,
      expectedClaimRoleId: claimRoleId,
      expectedClaimRoleName: roleNameById(state, claimRoleId),
    });
  }
}

function pushEvilClaimCoverCrossDayRow(rows, scenarioId, seed = 2026060307) {
  const { state, rng } = createQualityState(seed);
  advanceDayStage(state, "public");
  const evilAI = state.players.find((player) => !player.isHuman && player.team === "evil" && player.alive);
  const target = state.players.find((player) => !player.isHuman && player.team === "good" && player.alive);
  const claimRoleId = getRoleById(state.scriptId, "investigator") ? "investigator" : "washerwoman";
  if (!evilAI || !target || !claimRoleId) {
    return;
  }

  evilAI.aiPersona = "shadow";
  evilAI.publicClaimRoleId = claimRoleId;
  const publicClaim = {
    day: state.day,
    playerId: evilAI.id,
    roleId: claimRoleId,
    private: false,
  };
  state.events.claims = state.events.claims ?? [];
  state.events.claims.push(publicClaim);
  recordPublicClaimForAgents(state, publicClaim);

  resetQualityStateForNextPublicDay(state);
  evilAI.dialogueBias = evilAI.dialogueBias ?? {};
  state.players.forEach((player) => {
    evilAI.suspicion[player.id] = player.id === target.id ? 0.86 : 0.12;
    evilAI.dialogueBias[player.id] = player.id === target.id ? 0.95 : -0.1;
  });
  addAgentObservation(state, evilAI.id, {
    kind: "public-speech",
    source: "public-chat",
    private: false,
    text: `${seat(target)} 第二天的公开身份和票型解释还是对不上，适合继续放到台面上压回应。`,
    payload: {
      speakerId: target.id,
      focusId: target.id,
      polarity: "accuse",
    },
  });

  forceNextPublicResponse(state, evilAI, target);
  const beforeCrossDay = state.events.speeches.length;
  runAIConversationStep(state, rng);
  const crossDaySpeech = state.events.speeches
    .slice(beforeCrossDay)
    .find((entry) => !entry.private && entry.playerId === evilAI.id && entry.focusId === target.id);
  if (crossDaySpeech) {
    rows.push({
      ...rowFromPublicSpeech(state, scenarioId, crossDaySpeech, "evil-claim-cover-cross-day"),
      requiresEvilClaimCoverCrossDay: true,
      expectedClaimRoleId: claimRoleId,
      expectedClaimRoleName: roleNameById(state, claimRoleId),
    });
  }
}

function pushEvilClaimCoverDeceptionArcFixture(rows, scenarioId, state, rng, rowId, claimRoleId) {
  advanceDayStage(state, "public");
  const evilAI = state.players.find(
    (player) =>
      !player.isHuman &&
      player.team === "evil" &&
      player.alive &&
      (getAIAgent(state, player)?.knownAllyIds ?? []).some((id) => id !== player.id)
  );
  const allyId = getAIAgent(state, evilAI)?.knownAllyIds?.find((id) => id !== evilAI?.id);
  const ally = state.players.find((player) => player.id === allyId);
  const [firstTarget, secondTarget] = state.players
    .filter((player) => !player.isHuman && player.team === "good" && player.alive && player.id !== ally?.id)
    .slice(0, 2);
  if (!evilAI || !ally || !firstTarget || !secondTarget || !claimRoleId) {
    return;
  }

  evilAI.aiPersona = "shadow";
  evilAI.publicClaimRoleId = claimRoleId;
  const publicClaim = {
    day: state.day,
    playerId: evilAI.id,
    roleId: claimRoleId,
    private: false,
  };
  state.events.claims = state.events.claims ?? [];
  state.events.claims.push(publicClaim);
  recordPublicClaimForAgents(state, publicClaim);

  evilAI.dialogueBias = evilAI.dialogueBias ?? {};
  state.players.forEach((player) => {
    evilAI.suspicion[player.id] = 0.12;
    evilAI.dialogueBias[player.id] = -0.2;
  });
  evilAI.suspicion[firstTarget.id] = 0.84;
  evilAI.dialogueBias[firstTarget.id] = 0.95;
  addAgentObservation(state, evilAI.id, {
    kind: "public-speech",
    source: "public-chat",
    private: false,
    text: `${seat(firstTarget)} 的公开身份和前面发言对不上，适合先放到台面上压回应。`,
    payload: {
      speakerId: firstTarget.id,
      focusId: firstTarget.id,
      polarity: "accuse",
    },
  });
  forceNextPublicResponse(state, evilAI, firstTarget);
  const beforeFirst = state.events.speeches.length;
  runAIConversationStep(state, rng);
  const firstSpeech = state.events.speeches
    .slice(beforeFirst)
    .find((entry) => !entry.private && entry.playerId === evilAI.id && entry.focusId === firstTarget.id);

  evilAI.suspicion[firstTarget.id] = 0.15;
  evilAI.dialogueBias[firstTarget.id] = -0.5;
  evilAI.suspicion[secondTarget.id] = 0.99;
  evilAI.dialogueBias[secondTarget.id] = 1.2;
  addAgentObservation(state, evilAI.id, {
    kind: "public-speech",
    source: "public-chat",
    private: false,
    text: `${seat(secondTarget)} 的公开身份和票型解释突然连不上，台面压力比前一条更高。`,
    payload: {
      speakerId: secondTarget.id,
      focusId: secondTarget.id,
      polarity: "accuse",
    },
  });
  forceNextPublicResponse(state, evilAI, secondTarget);
  const beforePivot = state.events.speeches.length;
  runAIConversationStep(state, rng);
  const pivotSpeech = state.events.speeches
    .slice(beforePivot)
    .find((entry) => !entry.private && entry.playerId === evilAI.id && entry.focusId === secondTarget.id);
  if (!firstSpeech || !pivotSpeech) {
    return;
  }

  resetQualityStateForNextPublicDay(state);
  evilAI.dialogueBias = evilAI.dialogueBias ?? {};
  state.players.forEach((player) => {
    evilAI.suspicion[player.id] = 0.12;
    evilAI.dialogueBias[player.id] = -0.2;
  });
  ally.beenNominatedToday = true;
  ally.nominatedToday = true;
  evilAI.suspicion[ally.id] = 0.74;
  evilAI.dialogueBias[ally.id] = 0.8;
  evilAI.suspicion[secondTarget.id] = 0.78;
  evilAI.dialogueBias[secondTarget.id] = 0.95;
  addAgentObservation(state, evilAI.id, {
    kind: "public-speech",
    source: "public-chat",
    private: false,
    text: `${seat(ally)} 今天被台面集中压，但 ${seat(secondTarget)} 的身份解释和昨天票型也连不上。`,
    payload: {
      speakerId: ally.id,
      focusId: ally.id,
      polarity: "accuse",
    },
  });
  addAgentObservation(state, evilAI.id, {
    kind: "public-speech",
    source: "public-chat",
    private: false,
    text: `${seat(secondTarget)} 第二天的公开身份和票型解释还是对不上，适合继续放到台面上压回应。`,
    payload: {
      speakerId: secondTarget.id,
      focusId: secondTarget.id,
      polarity: "accuse",
    },
  });
  forceNextPublicResponse(state, evilAI, secondTarget);
  const beforeArc = state.events.speeches.length;
  runAIConversationStep(state, rng);
  const arcSpeech = state.events.speeches
    .slice(beforeArc)
    .find((entry) => !entry.private && entry.playerId === evilAI.id && entry.focusId === secondTarget.id);
  if (arcSpeech) {
    rows.push({
      ...rowFromPublicSpeech(state, scenarioId, arcSpeech, rowId),
      requiresEvilClaimCoverDeceptionArc: true,
      requiresEvilClaimCoverPressureContinuity: true,
      expectedClaimRoleId: claimRoleId,
      expectedClaimRoleName: roleNameById(state, claimRoleId),
      priorArcLines: [firstSpeech.line, pivotSpeech.line].map(oneLine).filter(Boolean),
      priorArcFocusNames: [seat(firstTarget), seat(secondTarget)],
    });
  }
}

function pushEvilClaimCoverDeceptionArcRow(rows, scenarioId, seed = 2026060308) {
  const { state, rng } = createQualityState(seed);
  const claimRoleId = getRoleById(state.scriptId, "investigator") ? "investigator" : "washerwoman";
  pushEvilClaimCoverDeceptionArcFixture(rows, scenarioId, state, rng, "evil-claim-cover-deception-arc", claimRoleId);
}

const CROSS_SCRIPT_EVIL_CLAIM_COVER_ROLES = {
  bmr: "gambler",
  snv: "artist",
};

function pushCrossScriptEvilClaimCoverPressureContinuityRows(rows, scenarioId, seed = 2026060411) {
  Object.entries(CROSS_SCRIPT_EVIL_CLAIM_COVER_ROLES).forEach(([scriptId, claimRoleId], index) => {
    const { state, rng } = createScriptVoteQualityState(scriptId, seed + index);
    if (!getRoleById(scriptId, claimRoleId)) return;
    pushEvilClaimCoverDeceptionArcFixture(
      rows,
      scenarioId,
      state,
      rng,
      `cross-script-evil-claim-cover-pressure-continuity-${scriptId}`,
      claimRoleId
    );
    const latest = rows[rows.length - 1];
    if (latest?.id?.includes(`cross-script-evil-claim-cover-pressure-continuity-${scriptId}`)) {
      latest.requiresCrossScriptEvilClaimCoverPressureContinuity = true;
      latest.expectedScriptId = scriptId;
    }
  });
}

function rowFromNomination(state, scenarioId, proposal) {
  const nominator = state.players.find((player) => player.id === proposal?.nominatorId);
  return {
    id: `${scenarioId}-nomination`,
    scenarioId,
    qualityRunId: qualityRunId(state, scenarioId),
    scriptId: state.scriptId ?? "",
    audience: "nomination",
    source: "nomination",
    intent: "nomination",
    speakerId: proposal?.nominatorId ?? "",
    speakerName: seat(nominator),
    prompt: proposal?.nomineeId ? `nominate ${playerName(state, proposal.nomineeId)}` : "no nomination",
    text: oneLine(proposal?.reason ?? "本局面没有生成 AI 提名。"),
    ok: !!proposal,
    focusId: proposal?.nomineeId ?? proposal?.decisionRationale?.focusId ?? "",
    focusName: playerName(state, proposal?.nomineeId ?? proposal?.decisionRationale?.focusId),
    decisionRationale: proposal?.decisionRationale ?? null,
    strategyRationale: proposal?.strategyRationale ?? null,
    evidenceSummaries: proposal?.evidenceContract?.summaries ?? [],
    allowHiddenTruth: false,
  };
}

function rowFromNominationDefense(state, scenarioId, debate, index) {
  const nominee = state.players.find((player) => player.id === debate?.nomineeId);
  const nominator = state.players.find((player) => player.id === debate?.nominatorId);
  const defenseLine = (debate?.lines ?? []).find((line) => line.role === "nominee");
  return {
    id: `${scenarioId}-nomination-defense-${index}`,
    scenarioId,
    qualityRunId: qualityRunId(state, scenarioId),
    scriptId: state.scriptId ?? "",
    audience: "nomination-defense",
    source: "nomination-defense",
    intent: "nomination-defense",
    speakerId: nominee?.id ?? "",
    speakerName: seat(nominee),
    nomineeId: nominee?.id ?? "",
    nomineeName: seat(nominee),
    nominatorId: nominator?.id ?? "",
    nominatorName: seat(nominator),
    prompt: oneLine(debate?.reason ?? ""),
    text: oneLine(defenseLine?.text ?? ""),
    ok: !!defenseLine?.text,
    focusId: "",
    focusName: "",
    decisionRationale: null,
    strategyRationale: null,
    evidenceSummaries: defenseLine?.text ? [defenseLine.text] : [],
    allowHiddenTruth: false,
    requiresNominationDefenseResponse: true,
  };
}

function pushNominationDefenseResponseRows(rows, scenarioId, seed = 2026060419) {
  [0.01, 0.99].forEach((rngValue, index) => {
    const { state } = createQualityState(seed + index);
    state.phase = "day";
    state.dayStage = "public";
    state.dayStageMeta = state.dayStageMeta ?? {};
    state.dayStageMeta.publicRounds = Math.max(1, state.dayStageMeta.publicRounds ?? 0);
    markPublicDiscussionRound(state);
    advanceDayStage(state, "nomination");
    const proposal = chooseAINomination(state);
    let nominatorId = proposal?.nominatorId ?? "";
    let nomineeId = proposal?.nomineeId ?? "";
    let reason = proposal?.reason ?? "";
    let nominee = state.players.find((player) => player.id === nomineeId);
    if (!nominee || nominee.isHuman) {
      const aiPlayers = state.players.filter((player) => !player.isHuman && player.alive);
      const nominator = aiPlayers[0];
      nominee = aiPlayers.find((player) => player.id !== nominator?.id);
      if (!nominator || !nominee) {
        return;
      }
      nominatorId = nominator.id;
      nomineeId = nominee.id;
      reason = `我提 ${seat(nominee)}。刚才身份和票型没对上，先让他把信息讲完。`;
    }
    if (!nominatorId || !nomineeId) {
      return;
    }
    nominee.suspicion = nominee.suspicion ?? {};
    nominee.suspicion[nominatorId] = index === 0 ? 0.42 : 0.72;
    const debate = createNominationDebate(
      state,
      {
        nominatorId,
        nomineeId,
        reason,
        source: "quality-eval",
        decisionRationale: proposal?.decisionRationale ?? null,
        strategyRationale: proposal?.strategyRationale ?? null,
      },
      () => rngValue
    )?.debate;
    rows.push({
      ...rowFromNominationDefense(state, scenarioId, debate, index),
      expectedPressureBand: index === 0 ? "low" : "high",
      requiresHighPressureNominationDefenseCounterPressure: index === 1,
    });
  });
}

const CROSS_SCRIPT_NOMINATION_DEFENSE_REASONS = {
  bmr: [
    "死亡信息和票型没接上，先让他把保护链讲清楚。",
    "处决边缘和昨晚信息对不上，先听他怎么解释票型。",
  ],
  snv: [
    "昨晚信息和公开报法没对上，先让他把信息链讲完。",
    "身份说法和投票解释接不上，先听他把逻辑补齐。",
  ],
};

function pushCrossScriptNominationDefenseResponseRows(rows, scenarioId, seed = 2026060431) {
  ["bmr", "snv"].forEach((scriptId, scriptIndex) => {
    [0.01, 0.99].forEach((rngValue, index) => {
      const { state } = createScriptVoteQualityState(scriptId, seed + scriptIndex * 17 + index);
      state.phase = "day";
      state.dayStage = "public";
      state.dayStageMeta = state.dayStageMeta ?? {};
      state.dayStageMeta.publicRounds = Math.max(1, state.dayStageMeta.publicRounds ?? 0);
      markPublicDiscussionRound(state);
      advanceDayStage(state, "nomination");
      const aiPlayers = state.players.filter((player) => !player.isHuman && player.alive);
      const nominator = aiPlayers[0];
      const nominee = aiPlayers.find((player) => player.id !== nominator?.id);
      if (!nominator || !nominee) {
        return;
      }
      nominee.suspicion = nominee.suspicion ?? {};
      nominee.suspicion[nominator.id] = index === 0 ? 0.42 : 0.72;
      const debate = createNominationDebate(
        state,
        {
          nominatorId: nominator.id,
          nomineeId: nominee.id,
          reason: `我提 ${seat(nominee)}。${CROSS_SCRIPT_NOMINATION_DEFENSE_REASONS[scriptId]?.[index] ?? "身份和票型没对上，先让他把信息讲完。"}`,
          source: "quality-eval",
        },
        () => rngValue
      )?.debate;
      if (!debate) {
        return;
      }
      rows.push({
        ...rowFromNominationDefense(state, `${scenarioId}-cross-script-nomination-defense-${scriptId}`, debate, index),
        requiresCrossScriptNominationDefenseReasonAnchor: true,
        requiresHighPressureNominationDefenseCounterPressure: index === 1,
        expectedScriptId: scriptId,
        expectedPressureBand: index === 0 ? "low" : "high",
      });
    });
  });
}

const NOMINATION_DEFENSE_AWARE_VOTE_FIXTURES = [
  { vote: true, suspicion: 0.86, rngValue: 0.01 },
  { vote: false, suspicion: 0.34, rngValue: 0.99 },
];

function pushNominationDefenseAwareVoteFixtureRows(rows, scenarioId, fixtures, createStateForFixture, rowTag, extra = {}) {
  fixtures.forEach((fixture, index) => {
    const { state } = createStateForFixture(fixture, index);
    state.phase = "day";
    state.dayStage = "public";
    state.dayStageMeta = state.dayStageMeta ?? {};
    state.dayStageMeta.publicRounds = Math.max(1, state.dayStageMeta.publicRounds ?? 0);
    markPublicDiscussionRound(state);
    advanceDayStage(state, "nomination");
    const aiPlayers = state.players.filter((player) => !player.isHuman && player.alive);
    const nominator = aiPlayers[0];
    const nominee = aiPlayers.find((player) => player.id !== nominator?.id);
    const voter = aiPlayers.find((player) => player.id !== nominator?.id && player.id !== nominee?.id && player.team === "good") ??
      aiPlayers.find((player) => player.id !== nominator?.id && player.id !== nominee?.id);
    if (!nominator || !nominee || !voter) {
      return;
    }
    voter.suspicion[nominee.id] = fixture.suspicion;
    addAgentObservation(state, voter.id, {
      kind: "public-speech",
      source: "public-chat",
      private: false,
      text: `${seat(nominee)} 刚才身份、昨晚信息和票型需要接上提名防守。`,
      payload: {
        speakerId: nominee.id,
        focusId: nominee.id,
        polarity: fixture.vote ? "accuse" : "neutral",
      },
    });
    const debate = createNominationDebate(
      state,
      {
        nominatorId: nominator.id,
        nomineeId: nominee.id,
        reason: `我提 ${seat(nominee)}。身份和票型没对上，先听防守再看票。`,
        source: "quality-eval",
      },
      () => fixture.rngValue
    )?.debate;
    if (!debate) {
      return;
    }
    const decision = decideAIVoteWithRationale(voter, nominee, state, () => fixture.rngValue);
    rows.push({
      ...rowFromFormalVote(
        state,
        `${scenarioId}-${rowTag}-${fixture.vote ? "yes" : "no"}`,
        { nomineeId: nominee.id },
        { voterId: voter.id, vote: decision.vote, voteRationale: decision.voteRationale },
        index
      ),
      requiresNominationDefenseAwareVote: true,
      expectedVote: fixture.vote,
      nominationDefenseText: debate.lines?.find((line) => line.role === "nominee")?.text ?? "",
      ...extra,
    });
  });
}

function pushNominationDefenseAwareVoteRows(rows, scenarioId, seed = 2026060421) {
  pushNominationDefenseAwareVoteFixtureRows(
    rows,
    scenarioId,
    NOMINATION_DEFENSE_AWARE_VOTE_FIXTURES,
    (_fixture, index) => createQualityState(seed + index),
    "nomination-defense-aware-vote"
  );
}

function pushCrossScriptNominationDefenseAwareVoteRows(rows, scenarioId, seed = 2026060423) {
  ["bmr", "snv"].forEach((scriptId, scriptIndex) => {
    pushNominationDefenseAwareVoteFixtureRows(
      rows,
      scenarioId,
      NOMINATION_DEFENSE_AWARE_VOTE_FIXTURES,
      (_fixture, index) => createScriptVoteQualityState(scriptId, seed + scriptIndex * 17 + index),
      `cross-script-nomination-defense-aware-vote-${scriptId}`,
      {
        requiresCrossScriptNominationDefenseAwareVote: true,
        expectedScriptId: scriptId,
      }
    );
  });
}

function pushNominationStrategyModeRows(rows, scenarioId, seed = 2026060417) {
  const { state } = createQualityState(seed);
  markPublicDiscussionRound(state);
  advanceDayStage(state, "nomination");
  const baseProposal = chooseAINomination(state);
  const baseDecision = baseProposal?.decisionRationale ?? null;
  if (!baseProposal || !baseDecision?.focusId || !baseDecision?.spokenLine) {
    return;
  }

  const focusName = playerName(state, baseDecision.focusId);
  const runnerUpName = playerName(state, baseDecision.runnerUpId);
  const modeDecisionLines = [
    `先把${focusName}放上台，不是因为${runnerUpName}没问题，而是这轮更需要听防守。`,
    `${focusName}和${runnerUpName}都要留意，但这票先看谁愿意跟到门槛边。`,
    `现在优先处理${focusName}，票面如果能过就不能只停在聊天层。`,
    `我不想让今天空转，先用${focusName}这一票把流程压力打出来。`,
    `${focusName}这轮能换到执行信息，先听防守再决定票要不要压上去。`,
    `台面理由先押在${focusName}，公开流程要留下能复盘的压力线。`,
    `${focusName}先上台验信息，${runnerUpName}继续留在第二观察位。`,
  ];

  NOMINATION_STRATEGY_MODE_FIXTURES.forEach((fixture, index) => {
    const strategyRationale = buildNominationStrategyRationale({
      strategyIntent: fixture.intent,
      coalition: {
        expectedYesVotes: fixture.support,
        threshold: fixture.threshold,
        margin: fixture.support - fixture.threshold,
        likelyPasses: fixture.support >= fixture.threshold,
      },
    });
    const decisionRationale = {
      ...baseDecision,
      spokenLine: modeDecisionLines[index] ?? baseDecision.spokenLine,
    };
    const row = rowFromNomination(state, `${scenarioId}-nomination-strategy-${fixture.expectedMode}`, {
      ...baseProposal,
      decisionRationale,
      strategyRationale,
      reason: [decisionRationale.spokenLine, strategyRationale.line].filter(Boolean).join(" "),
    });
    rows.push({
      ...row,
      source: "nomination-strategy-mode",
      requiresNominationStrategyModeCoverage: true,
      expectedNominationStrategyMode: fixture.expectedMode,
      expectedNominationStrategyIntent: fixture.intent,
      evidenceSummaries:
        row.evidenceSummaries?.length > 0
          ? row.evidenceSummaries
          : [`${focusName} has public nomination pressure context for ${fixture.expectedMode}.`],
    });
  });
}

function rowFromFormalVote(state, scenarioId, voteEvent, entry, index) {
  const voter = state.players.find((player) => player.id === entry?.voterId);
  const rationale = entry?.voteRationale ?? null;
  return {
    id: `${scenarioId}-formal-vote-${index}`,
    scenarioId,
    qualityRunId: qualityRunId(state, scenarioId),
    scriptId: state.scriptId ?? "",
    audience: "vote",
    source: "formal-vote",
    intent: "formal-vote",
    speakerId: entry?.voterId ?? "",
    speakerName: seat(voter),
    prompt: `formal vote on ${playerName(state, voteEvent?.nomineeId)}`,
    text: oneLine(
      rationale?.line ?? `${seat(voter)} ${entry?.vote ? "votes yes" : "votes no"} on ${playerName(state, voteEvent?.nomineeId)}.`
    ),
    ok: true,
    focusId: voteEvent?.nomineeId ?? rationale?.nomineeId ?? "",
    focusName: playerName(state, voteEvent?.nomineeId ?? rationale?.nomineeId),
    decisionRationale: null,
    voteRationale: rationale,
    strategyRationale: null,
    evidenceSummaries: [],
    allowHiddenTruth: false,
  };
}

function clearAgentTargetEvidence(state, voter, nominee) {
  const agent = getAIAgent(state, voter);
  if (!agent || !nominee?.id) return;
  const hasTarget = (entry) => (entry?.targetIds ?? []).includes(nominee.id);
  agent.evidenceBook = (agent.evidenceBook ?? []).filter((entry) => !hasTarget(entry));
  agent.observations = (agent.observations ?? []).filter((entry) => {
    const payload = entry?.payload ?? {};
    return ![payload.playerId, payload.focusId, payload.targetId, payload.nomineeId, payload.nominatorId, payload.speakerId, payload.voterId].includes(
      nominee.id
    );
  });
  if (agent.beliefTrailByPlayerId) {
    delete agent.beliefTrailByPlayerId[nominee.id];
  }
}

function prepareVoteFixtureState(state, voter, nominee, fixture = {}) {
  state.phase = "day";
  state.dayStage = "nomination";
  state.gameOver = false;
  state.events.executions = [];
  state.players.forEach((player) => {
    player.nominatedToday = false;
    player.beenNominatedToday = false;
  });
  nominee.alive = true;
  voter.alive = fixture.ghost ? false : true;
  voter.ghostVoteAvailable = !!fixture.ghost;
  voter.suspicion = voter.suspicion ?? {};
  state.players.forEach((player) => {
    voter.suspicion[player.id] = 0.04;
  });
  voter.suspicion[nominee.id] = fixture.suspicion;
  clearAgentTargetEvidence(state, voter, nominee);
  const evidenceCount = Math.max(fixture.withEvidence ? 1 : 0, Number(fixture.withEvidenceCount ?? 0) || 0);
  const evidenceFixtures = [
    {
      kind: "public-speech",
      source: "public-chat",
      text: `${seat(nominee)} 的公开身份和票型对不上。`,
      payload: {
        speakerId: nominee.id,
        focusId: nominee.id,
        polarity: "accuse",
      },
    },
    {
      kind: "vote",
      source: "public-procedure",
      text: `${seat(nominee)} 刚才投票态度摇摆，和身份口径连不上。`,
      payload: {
        voterId: nominee.id,
        targetId: nominee.id,
        focusId: nominee.id,
        polarity: "accuse",
      },
    },
    {
      kind: "nomination",
      source: "public-procedure",
      text: `${seat(nominee)} 在提名压力下没有补出能对齐的公开信息。`,
      payload: {
        nomineeId: nominee.id,
        nominatorId: fixture.nominatorId ?? "",
        focusId: nominee.id,
        polarity: "accuse",
      },
    },
  ];
  evidenceFixtures.slice(0, evidenceCount).forEach((entry) => {
    addAgentObservation(state, voter.id, {
      ...entry,
      private: false,
    });
  });
}

function findVoteDecisionForFixture(state, voter, nominee, fixture = {}, rng = () => 0.99) {
  if (!fixture.nearThreshold) {
    return decideAIVoteWithRationale(voter, nominee, state, rng);
  }
  const targetVote = !!fixture.targetVote;
  for (let suspicion = 0.42; suspicion <= 0.78; suspicion += 0.005) {
    voter.suspicion[nominee.id] = Math.round(suspicion * 1000) / 1000;
    const decision = decideAIVoteWithRationale(voter, nominee, state, rng);
    if (decision.vote === targetVote && Math.abs(decision.voteRationale?.margin ?? 1) <= 0.04) {
      return decision;
    }
  }
  return decideAIVoteWithRationale(voter, nominee, state, rng);
}

function pushFormalVoteEdgeCaseRows(rows, scenarioId, seed) {
  const fixtures = [
    { reasonKey: "evidence-backed-yes", suspicion: 0.96, withEvidence: true },
    { reasonKey: "multi-evidence-yes", suspicion: 0.96, withEvidenceCount: 2, multiEvidence: true, targetVote: true },
    { reasonKey: "multi-evidence-no", suspicion: 0.24, withEvidenceCount: 2, multiEvidence: true, targetVote: false },
    { reasonKey: "pressure-threshold-yes", suspicion: 0.96, withEvidence: false },
    { reasonKey: "pressure-below-threshold", suspicion: 0.08, withEvidence: false },
    { reasonKey: "ghost-vote-pressure", suspicion: 0.96, withEvidence: false, ghost: true },
    { reasonKey: "cannot-vote", suspicion: 0.96, withEvidence: false, cannotVote: true },
    { reasonKey: "near-threshold-yes", suspicion: 0.6, withEvidence: false, nearThreshold: true, targetVote: true },
    { reasonKey: "near-threshold-no", suspicion: 0.6, withEvidence: false, nearThreshold: true, targetVote: false },
    {
      reasonKey: "evidence-near-threshold-yes",
      suspicion: 0.6,
      withEvidence: true,
      nearThreshold: true,
      targetVote: true,
      evidenceBoundary: true,
    },
    {
      reasonKey: "evidence-near-threshold-no",
      suspicion: 0.6,
      withEvidence: true,
      nearThreshold: true,
      targetVote: false,
      evidenceBoundary: true,
    },
  ];
  fixtures.forEach((fixture, index) => {
    const { state } = createQualityState(seed + index);
    const nominee = state.players.find((player) => !player.isHuman && player.team === "good" && player.alive);
    const voter = state.players.find(
      (player) => !player.isHuman && player.team === "good" && player.id !== nominee?.id && player.alive
    );
    if (!voter || !nominee) return;
    prepareVoteFixtureState(state, voter, nominee, fixture);
    if (fixture.cannotVote) {
      voter.alive = false;
      voter.ghostVoteAvailable = false;
    }
    const decision = findVoteDecisionForFixture(state, voter, nominee, fixture, () => 0.99);
    rows.push({
      ...rowFromFormalVote(
        state,
        scenarioId,
        { nomineeId: nominee.id },
        { voterId: voter.id, vote: decision.vote, voteRationale: decision.voteRationale },
        `edge-${fixture.reasonKey}`
      ),
      requiresFormalVoteReasonMode: fixture.nearThreshold || fixture.multiEvidence ? decision.voteRationale?.reasonKey : fixture.reasonKey,
      requiresFormalVoteNearThreshold: !!fixture.nearThreshold,
      requiresFormalVoteEvidenceBoundary: !!fixture.evidenceBoundary,
      requiresFormalVoteMultiEvidence: !!fixture.multiEvidence,
      expectedVote: fixture.targetVote,
    });
  });
}

function pushButlerRestrictedFormalVoteRow(rows, scenarioId, seed) {
  const { state } = createQualityState(seed);
  const human = state.players.find((player) => player.isHuman);
  const nominee = state.players.find((player) => !player.isHuman && player.team === "good" && player.roleId !== "virgin" && player.alive);
  const butler = state.players.find((player) => !player.isHuman && player.id !== nominee?.id && player.alive);
  if (!human || !nominee || !butler) return;

  prepareVoteFixtureState(state, butler, nominee, { suspicion: 0.96, withEvidence: false });
  butler.roleId = "butler";
  butler.apparentRoleId = "butler";
  butler.team = "good";
  butler.apparentTeam = "good";
  state.tb.butlerMasterById[butler.id] = null;
  const result = resolveNominationAndVote(
    state,
    {
      nominatorId: human.id,
      nomineeId: nominee.id,
      humanVoteYes: false,
      decideAIVote: (voter, votedNominee, currentState) =>
        voter.id === butler.id
          ? decideAIVoteWithRationale(voter, votedNominee, currentState, () => 0.99)
          : false,
    },
    () => 0.99
  );
  const entry = result.votes?.find((voteEntry) => voteEntry.voterId === butler.id);
  if (!entry?.voteRationale) return;
  rows.push({
    ...rowFromFormalVote(state, scenarioId, result, entry, "edge-butler-restricted"),
    requiresFormalVoteReasonMode: "butler-restricted",
  });
}

function findEvilAllyVotePair(state, options = {}) {
  const avoidDemonNominee = !!options.avoidDemonNominee;
  const evilPlayers = state.players.filter((player) => !player.isHuman && player.team === "evil" && player.alive);
  for (const voter of evilPlayers) {
    const nominee = evilPlayers.find((candidate) => {
      if (candidate.id === voter.id || !areKnownAllies(state, voter, candidate)) {
        return false;
      }
      const role = getRoleById(state.scriptId, candidate.roleId);
      return !avoidDemonNominee || role?.category !== "demon";
    });
    if (nominee) {
      return { voter, nominee };
    }
  }
  return { voter: null, nominee: null };
}

function pushEvilFormalVoteCoverRows(rows, scenarioId, seed) {
  const fixtures = [
    { reasonKey: "table-balance-no", suspicion: 0.95, voteRng: 0.99, targetVote: false },
    { reasonKey: "execution-window-yes", suspicion: 0.95, voteRng: 0.01, targetVote: true, withEvidenceCount: 3 },
  ];

  fixtures.forEach((fixture, index) => {
    const { state } = createQualityState(seed + index);
    const human = state.players.find((player) => player.isHuman);
    const { voter, nominee } = findEvilAllyVotePair(state, {
      avoidDemonNominee: fixture.reasonKey === "execution-window-yes",
    });
    if (!voter || !nominee) return;

    prepareVoteFixtureState(state, voter, nominee, {
      suspicion: fixture.suspicion,
      withEvidenceCount: fixture.withEvidenceCount ?? 0,
      nominatorId: human?.id ?? "",
    });
    const decision = decideAIVoteWithRationale(voter, nominee, state, () => fixture.voteRng);
    rows.push({
      ...rowFromFormalVote(
        state,
        scenarioId,
        { nomineeId: nominee.id },
        { voterId: voter.id, vote: decision.vote, voteRationale: decision.voteRationale },
        `edge-${fixture.reasonKey}`
      ),
      requiresFormalVoteReasonMode: fixture.reasonKey,
      requiresFormalVoteEvilCoverMode: true,
      expectedVote: fixture.targetVote,
    });
  });
}

function createScriptVoteQualityState(scriptId, seed) {
  const rng = fixedRng(seed);
  const state = createNewGame({ scriptId, playerCount: 9 }, rng);
  state.aiQualityRunId = `${scriptId}-quality-${seed}`;
  initializeAI(state);
  runNight(state, rng);
  return { state, rng };
}

function pushCrossScriptPrivateClaimRows(rows, scenarioId, seed) {
  ["bmr", "snv"].forEach((scriptId, index) => {
    const { state, rng } = createScriptVoteQualityState(scriptId, seed + index);
    const speaker = state.players.find((player) => !player.isHuman && player.team === "good" && player.alive);
    if (!speaker) return;

    const input = {
      humanLine: "你是什么身份？",
      intentHint: "claim",
    };
    const result = runPrivateWhisper(state, { targetId: speaker.id, ...input }, rng);
    rows.push({
      ...rowFromPrivateResult(state, scenarioId, `cross-script-claim-${scriptId}`, speaker, input, result),
      requiresCrossScriptClaimDisclosure: true,
      expectedScriptId: scriptId,
    });
  });
}

const CROSS_SCRIPT_CLAIM_CONTINUITY_FIXTURES = {
  bmr: {
    currentRoleId: "professor",
    previousRoleId: "gambler",
    rangeLabel: "复活或赌博相关信息位范围",
  },
  snv: {
    currentRoleId: "savant",
    previousRoleId: "artist",
    rangeLabel: "说书人或提问相关信息位范围",
  },
};

function rowFromClaimDisclosureContinuityFixture(state, scenarioId, scriptId, speaker, mode, rationale) {
  const continuityLine = oneLine(rationale?.continuityLine ?? "");
  const rationaleLine = oneLine(rationale?.line ?? "");
  const text = oneLine([continuityLine, rationaleLine].filter(Boolean).join(" "));
  return {
    id: `${scenarioId}-cross-script-claim-${scriptId}-${mode}`,
    scenarioId,
    scriptId: state.scriptId ?? "",
    audience: "private",
    source: "claim-disclosure-fixture",
    intent: `claim-${mode}`,
    speakerId: speaker?.id ?? "",
    speakerName: seat(speaker),
    prompt: `forced ${scriptId} identity-line ${mode} fixture`,
    text,
    ok: !!text,
    focusId: "",
    focusName: "",
    decisionRationale: null,
    claimDisclosureRationale: {
      ...(rationale ?? {}),
      spokenLine: continuityLine || rationaleLine || rationale?.spokenLine || "",
    },
    crossDayStance: null,
    strategyRationale: null,
    evidenceSummaries: [],
    requiresClaimDisclosureRationale: true,
    requiresClaimDisclosureContinuity: true,
    requiresCrossScriptClaimContinuity: true,
    expectedScriptId: scriptId,
    expectedClaimContinuityMode: mode,
    allowHiddenTruth: false,
  };
}

function pushCrossScriptClaimContinuityRows(rows, scenarioId, seed) {
  Object.entries(CROSS_SCRIPT_CLAIM_CONTINUITY_FIXTURES).forEach(([scriptId, fixture], index) => {
    const { state, rng } = createScriptVoteQualityState(scriptId, seed + index);
    const speaker = state.players.find((player) => !player.isHuman && player.team === "good" && player.alive);
    const human = state.players.find((player) => player.isHuman);
    if (!speaker || !human) return;

    const channel = `private:${human.id}`;
    const currentRoleName = roleNameById(state, fixture.currentRoleId);
    const previousRoleName = roleNameById(state, fixture.previousRoleId);
    [
      {
        mode: "hold",
        previousDisclosure: {
          level: "hard",
          roleId: fixture.currentRoleId,
          roleName: currentRoleName,
          channel,
        },
      },
      {
        mode: "escalate",
        previousDisclosure: {
          level: "range",
          rangeLabel: fixture.rangeLabel,
          channel,
        },
      },
      {
        mode: "revise",
        previousDisclosure: {
          level: "hard",
          roleId: fixture.previousRoleId,
          roleName: previousRoleName,
          channel,
        },
      },
    ].forEach((continuityFixture) => {
      const plan = claimDisclosurePlanner(state, speaker, human, rng, {
        private: true,
        audience: "private",
        intent: "claim",
        forceHard: true,
        roleId: fixture.currentRoleId,
        previousDisclosure: continuityFixture.previousDisclosure,
      });
      rows.push(
        rowFromClaimDisclosureContinuityFixture(
          state,
          scenarioId,
          scriptId,
          speaker,
          continuityFixture.mode,
          plan.claimDisclosureRationale
        )
      );
    });
  });
}

const ROLE_CONSTRAINED_CLAIM_FIXTURES = [
  {
    scriptId: "snv",
    roleId: "sage",
    reasonKey: "madness_pressure_cover",
    setup(state, speaker) {
      state.snv.cerenovusForcedByPlayerId[speaker.id] = "artist";
      state.snv.cerenovusEnforceDayByPlayerId[speaker.id] = state.day;
    },
  },
  {
    scriptId: "bmr",
    roleId: "tinker",
    reasonKey: "outsider_execution_risk",
  },
  {
    scriptId: "snv",
    roleId: "mutant",
    reasonKey: "mutant_outsider_claim_risk",
  },
  {
    scriptId: "snv",
    roleId: "sweetheart",
    reasonKey: "sweetheart_death_drunk_risk",
  },
  {
    scriptId: "snv",
    roleId: "barber",
    reasonKey: "barber_swap_timing",
  },
  {
    scriptId: "tb",
    roleId: "ravenkeeper",
    reasonKey: "death_trigger_timing",
  },
];

function forceSpeakerRoleForClaimFixture(state, speaker, roleId) {
  const role = getRoleById(state.scriptId, roleId);
  if (!role || !speaker) {
    return null;
  }
  speaker.roleId = role.id;
  speaker.roleName = role.name;
  speaker.apparentRoleId = role.id;
  speaker.apparentRoleName = role.name;
  speaker.category = role.category;
  speaker.apparentCategory = role.category;
  speaker.team = role.team;
  speaker.apparentTeam = role.team;
  speaker.publicClaimRoleId = null;
  speaker.suspicion = speaker.suspicion ?? {};
  speaker.suspicion[speaker.id] = 0.16;
  return role;
}

function rowFromRoleConstrainedClaimFixture(state, scenarioId, fixture, speaker, rationale) {
  const rationaleLine = oneLine(rationale?.line ?? "");
  return {
    id: `${scenarioId}-role-constrained-claim-${fixture.scriptId}-${fixture.reasonKey}`,
    scenarioId,
    scriptId: state.scriptId ?? "",
    audience: "public",
    source: "claim-disclosure-fixture",
    intent: `claim-${fixture.reasonKey}`,
    speakerId: speaker?.id ?? "",
    speakerName: seat(speaker),
    prompt: `forced ${fixture.scriptId} role-constrained claim fixture`,
    text: rationaleLine,
    ok: !!rationaleLine,
    focusId: "",
    focusName: "",
    decisionRationale: null,
    claimDisclosureRationale: {
      ...(rationale ?? {}),
      spokenLine: rationaleLine || rationale?.spokenLine || "",
    },
    crossDayStance: null,
    strategyRationale: null,
    evidenceSummaries: [],
    requiresClaimDisclosureRationale: true,
    requiresRoleConstrainedClaimDisclosure: true,
    expectedScriptId: fixture.scriptId,
    expectedRoleId: fixture.roleId,
    expectedRoleConstraintReason: fixture.reasonKey,
    allowHiddenTruth: false,
  };
}

function pushRoleConstrainedClaimDisclosureRows(rows, scenarioId, seed) {
  ROLE_CONSTRAINED_CLAIM_FIXTURES.forEach((fixture, index) => {
    const { state, rng } = createScriptVoteQualityState(fixture.scriptId, seed + index);
    const speaker = state.players.find((player) => !player.isHuman && player.team === "good" && player.alive);
    const human = state.players.find((player) => player.isHuman);
    if (!speaker || !human || !forceSpeakerRoleForClaimFixture(state, speaker, fixture.roleId)) return;
    fixture.setup?.(state, speaker);
    const plan = claimDisclosurePlanner(state, speaker, human, rng, {
      private: false,
      audience: "public",
      intent: "public-disclosure",
      roleId: fixture.roleId,
      trustScore: 0.5,
    });
    rows.push(rowFromRoleConstrainedClaimFixture(state, scenarioId, fixture, speaker, plan.claimDisclosureRationale));
  });
}

function pushCrossScriptPublicReasoningRows(rows, scenarioId, seed) {
  ["bmr", "snv"].forEach((scriptId, index) => {
    const { state, rng } = createScriptVoteQualityState(scriptId, seed + index);
    const speaker = state.players.find((player) => !player.isHuman && player.team === "good" && player.alive);
    const focus = state.players.find((player) => !player.isHuman && player.id !== speaker?.id && player.alive);
    if (!speaker || !focus) return;

    advanceDayStage(state, "public");
    speaker.aiPersona = index % 2 === 0 ? "steady" : "shadow";
    speaker.dialogueBias = speaker.dialogueBias ?? {};
    state.players.forEach((player) => {
      speaker.suspicion[player.id] = player.id === focus.id ? 0.86 : 0.12;
      speaker.dialogueBias[player.id] = player.id === focus.id ? 0.96 : -0.12;
    });
    addAgentObservation(state, speaker.id, {
      kind: "public-speech",
      source: "public-chat",
      private: false,
      text: `${seat(focus)} 的公开身份和前面投票对不上，需要正面回应。`,
      payload: {
        speakerId: focus.id,
        focusId: focus.id,
        polarity: "accuse",
      },
    });
    addAgentObservation(state, speaker.id, {
      kind: "public-vote",
      source: "public-procedure",
      private: false,
      text: `${seat(focus)} 在推低证据位，需要解释为什么压低证据位。`,
      payload: {
        voterId: focus.id,
        targetId: focus.id,
        focusId: focus.id,
        polarity: "accuse",
      },
    });

    forceNextPublicResponse(state, speaker, focus);
    const before = state.events.speeches.length;
    const step = runAIConversationStep(state, rng);
    if (!step.ok) return;

    const speech = state.events.speeches
      .slice(before)
      .find((entry) => !entry.private && entry.playerId === speaker.id && entry.focusId === focus.id);
    if (!speech) return;

    rows.push({
      ...rowFromPublicSpeech(state, scenarioId, speech, `cross-script-public-${scriptId}`),
      requiresCrossScriptPublicReasoning: true,
      expectedScriptId: scriptId,
    });
  });
}

function pushCrossScriptPublicMultiEvidenceRows(rows, scenarioId, seed) {
  ["bmr", "snv"].forEach((scriptId, index) => {
    const { state, rng } = createScriptVoteQualityState(scriptId, seed + index);
    const speaker = state.players.find((player) => !player.isHuman && player.team === "good" && player.alive);
    const focus = state.players.find((player) => !player.isHuman && player.id !== speaker?.id && player.alive);
    if (!speaker || !focus) return;

    advanceDayStage(state, "public");
    speaker.aiPersona = "pressure";
    speaker.dialogueBias = speaker.dialogueBias ?? {};
    state.players.forEach((player) => {
      speaker.suspicion[player.id] = player.id === focus.id ? 0.92 : 0.08;
      speaker.dialogueBias[player.id] = player.id === focus.id ? 0.98 : -0.15;
    });
    [
      {
        kind: "public-speech",
        source: "public-chat",
        text: `${seat(focus)} 的公开身份和昨晚信息对不上，需要正面回应。`,
        payload: {
          speakerId: focus.id,
          focusId: focus.id,
          polarity: "accuse",
        },
      },
      {
        kind: "public-vote",
        source: "public-procedure",
        text: `${seat(focus)} 刚才投票态度摇摆，和身份口径连不上。`,
        payload: {
          voterId: focus.id,
          targetId: focus.id,
          focusId: focus.id,
          polarity: "accuse",
        },
      },
      {
        kind: "nomination",
        source: "public-procedure",
        text: `${seat(focus)} 在提名压力下没有补出能对齐的公开信息。`,
        payload: {
          nomineeId: focus.id,
          focusId: focus.id,
          polarity: "accuse",
        },
      },
    ].forEach((entry) => {
      addAgentObservation(state, speaker.id, {
        ...entry,
        private: false,
      });
    });

    forceNextPublicResponse(state, speaker, focus);
    const before = state.events.speeches.length;
    const step = runAIConversationStep(state, rng);
    if (!step.ok) return;

    const speech = state.events.speeches
      .slice(before)
      .find((entry) => !entry.private && entry.playerId === speaker.id && entry.focusId === focus.id);
    if (!speech) return;

    rows.push({
      ...rowFromPublicSpeech(state, scenarioId, speech, `cross-script-public-multi-evidence-${scriptId}`),
      requiresCrossScriptPublicMultiEvidence: true,
      expectedScriptId: scriptId,
    });
  });
}

function pushPublicPersonaPressureVariantRows(rows, scenarioId, seed = 2026060310) {
  ["pressure", "shadow", "steady"].forEach((persona, index) => {
    const { state, rng } = createQualityState(seed + index);
    advanceDayStage(state, "public");
    const speaker = state.players.find((player) => !player.isHuman && player.team === "good" && player.alive);
    const focus = state.players.find((player) => !player.isHuman && player.id !== speaker?.id && player.alive);
    if (!speaker || !focus) return;

    speaker.aiPersona = persona;
    speaker.dialogueBias = speaker.dialogueBias ?? {};
    state.players.forEach((player) => {
      speaker.suspicion[player.id] = player.id === focus.id ? 0.94 : 0.08;
      speaker.dialogueBias[player.id] = player.id === focus.id ? 1.05 : -0.15;
    });
    [
      {
        kind: "public-speech",
        source: "public-chat",
        text: `${seat(focus)} 的公开身份和昨晚信息对不上，需要正面回应。`,
        payload: {
          speakerId: focus.id,
          focusId: focus.id,
          polarity: "accuse",
        },
      },
      {
        kind: "public-vote",
        source: "public-procedure",
        text: `${seat(focus)} 刚才投票态度摇摆，和身份口径连不上。`,
        payload: {
          voterId: focus.id,
          targetId: focus.id,
          focusId: focus.id,
          polarity: "accuse",
        },
      },
      {
        kind: "nomination",
        source: "public-procedure",
        text: `${seat(focus)} 在提名压力下没有补出能对齐的公开信息。`,
        payload: {
          nomineeId: focus.id,
          focusId: focus.id,
          polarity: "accuse",
        },
      },
    ].forEach((entry) => {
      addAgentObservation(state, speaker.id, {
        ...entry,
        private: false,
      });
    });

    forceNextPublicResponse(state, speaker, focus);
    const before = state.events.speeches.length;
    const step = runAIConversationStep(state, rng);
    if (!step.ok) return;
    const speech = state.events.speeches
      .slice(before)
      .find((entry) => !entry.private && entry.playerId === speaker.id && entry.focusId === focus.id);
    if (!speech) return;

    rows.push({
      ...rowFromPublicSpeech(state, scenarioId, speech, `public-persona-pressure-${persona}`),
      requiresPublicPersonaPressureVariant: true,
      expectedPersona: persona,
    });
  });
}

function seedPublicTimingPressureEvidence(state, speaker, focus) {
  speaker.aiPersona = "pressure";
  speaker.dialogueBias = speaker.dialogueBias ?? {};
  state.players.forEach((player) => {
    speaker.suspicion[player.id] = player.id === focus.id ? 0.94 : 0.08;
    speaker.dialogueBias[player.id] = player.id === focus.id ? 1.05 : -0.15;
  });
  [
    {
      kind: "public-speech",
      source: "public-chat",
      text: `${seat(focus)} 的公开身份和昨晚信息对不上，需要正面回应。`,
      payload: {
        speakerId: focus.id,
        focusId: focus.id,
        polarity: "accuse",
      },
    },
    {
      kind: "public-vote",
      source: "public-procedure",
      text: `${seat(focus)} 刚才投票态度摇摆，和身份口径连不上。`,
      payload: {
        voterId: focus.id,
        targetId: focus.id,
        focusId: focus.id,
        polarity: "accuse",
      },
    },
    {
      kind: "nomination",
      source: "public-procedure",
      text: `${seat(focus)} 在提名压力下没有补出能对齐的公开信息。`,
      payload: {
        nomineeId: focus.id,
        focusId: focus.id,
        polarity: "accuse",
      },
    },
  ].forEach((entry) => {
    addAgentObservation(state, speaker.id, {
      ...entry,
      private: false,
    });
  });
}

function clearPublicContinuityForTimingFixture(state, speaker, focus) {
  if (!state || !speaker?.id || !focus?.id) return;
  const dialogue = state.aiDialogue ?? {};
  const dayKey = `${state.day ?? 0}`;
  if (dialogue.dayStanceMemory?.[dayKey]?.[speaker.id]) {
    delete dialogue.dayStanceMemory[dayKey][speaker.id][focus.id];
  }
  if (dialogue.stanceHistoryBySpeakerId?.[speaker.id]) {
    delete dialogue.stanceHistoryBySpeakerId[speaker.id][focus.id];
  }
  if (dialogue.statementMemory?.publicBySpeakerId) {
    delete dialogue.statementMemory.publicBySpeakerId[speaker.id];
  }
  if (Array.isArray(speaker.speechHistory)) {
    speaker.speechHistory = speaker.speechHistory.filter((entry) => entry?.focusId !== focus.id);
  }
}

const PUBLIC_ROLE_PRESSURE_FIXTURES = [
  { scriptId: "tb", roleId: "investigator", expectedMode: "info-claim" },
  { scriptId: "bmr", roleId: "tinker", expectedMode: "outsider-risk" },
  { scriptId: "snv", roleId: "sage", expectedMode: "death-trigger" },
  { scriptId: "bmr", roleId: "innkeeper", expectedMode: "protection" },
  { scriptId: "tb", roleId: "slayer", expectedMode: "public-action" },
];

function seedPublicRoleClaimForTarget(state, focus, roleId) {
  if (!state || !focus?.id || !getRoleById(state.scriptId, roleId)) return null;
  focus.publicClaimRoleId = roleId;
  const claim = {
    day: state.day,
    playerId: focus.id,
    roleId,
    private: false,
  };
  state.events.claims = state.events.claims ?? [];
  state.events.claims.push(claim);
  recordPublicClaimForAgents(state, claim);
  return claim;
}

function pushPublicRolePressureVariantRows(rows, scenarioId, seed = 2026060313) {
  PUBLIC_ROLE_PRESSURE_FIXTURES.forEach((fixture, index) => {
    const { state, rng } = createScriptVoteQualityState(fixture.scriptId, seed + index);
    advanceDayStage(state, "public");
    const speaker = state.players.find((player) => !player.isHuman && player.team === "good" && player.alive);
    const focus = state.players.find((player) => !player.isHuman && player.id !== speaker?.id && player.alive);
    if (!speaker || !focus || !seedPublicRoleClaimForTarget(state, focus, fixture.roleId)) return;

    clearPublicContinuityForTimingFixture(state, speaker, focus);
    seedPublicTimingPressureEvidence(state, speaker, focus);
    forceNextPublicResponse(state, speaker, focus, { suppressSelfDisclosure: true });
    const before = state.events.speeches.length;
    const step = runAIConversationStep(state, rng);
    if (!step.ok) return;

    const speech = state.events.speeches
      .slice(before)
      .find((entry) => !entry.private && entry.playerId === speaker.id && entry.focusId === focus.id);
    if (!speech) return;

    rows.push({
      ...rowFromPublicSpeech(state, scenarioId, speech, `public-role-pressure-${fixture.expectedMode}`),
      requiresPublicRolePressureVariant: true,
      expectedRolePressureMode: fixture.expectedMode,
      expectedClaimRoleId: fixture.roleId,
      expectedClaimRoleName: roleNameById(state, fixture.roleId),
    });
  });
}

function pushPublicTimingPressureVariantRows(rows, scenarioId, seed = 2026060311) {
  {
    const { state, rng } = createQualityState(seed);
    advanceDayStage(state, "public");
    const speakers = state.players.filter((player) => !player.isHuman).sort((a, b) => a.seatIndex - b.seatIndex);
    const speaker = speakers[2] ?? speakers[0];
    const focus = state.players.find((player) => !player.isHuman && player.id !== speaker?.id && player.alive);
    if (speaker && focus) {
      clearPublicContinuityForTimingFixture(state, speaker, focus);
      seedPublicTimingPressureEvidence(state, speaker, focus);
      state.dayStageMeta = state.dayStageMeta ?? {};
      state.dayStageMeta.publicConversation = {
        active: true,
        step: 2,
        clock: "nomination-ready",
        pressure: 0.94,
        activeSpeakerId: null,
        focusId: focus.id,
        pendingResponseSpeakerId: null,
        pendingResponseFocusId: null,
        pendingQuestionText: "",
        canContinue: true,
        suggestedActions: ["open-nomination-window", "continue-public"],
        lastUpdatedDay: state.day ?? 0,
      };
      const before = state.events.speeches.length;
      const step = runAIConversationStep(state, rng);
      const speech = step.ok
        ? state.events.speeches
            .slice(before)
            .find((entry) => !entry.private && entry.playerId === speaker.id && entry.debateBeat === "nomination-pressure")
        : null;
      if (speech) {
        rows.push({
          ...rowFromPublicSpeech(state, scenarioId, speech, "public-timing-nomination-pressure"),
          requiresPublicTimingPressureVariant: true,
          expectedTimingBeat: "nomination-pressure",
        });
      }
    }
  }

  {
    const { state, rng } = createQualityState(seed + 1);
    advanceDayStage(state, "public");
    runAIDiscussion(state, rng);
    const speakers = state.players.filter((player) => !player.isHuman).sort((a, b) => a.seatIndex - b.seatIndex);
    const speaker = speakers[2] ?? speakers[0];
    const focus = state.players.find((player) => !player.isHuman && player.id !== speaker?.id && player.alive);
    if (speaker && focus) {
      clearPublicContinuityForTimingFixture(state, speaker, focus);
      seedPublicTimingPressureEvidence(state, speaker, focus);
      const before = state.events.speeches.length;
      runAIDiscussion(state, rng);
      const speech = state.events.speeches
        .slice(before)
        .find((entry) => !entry.private && entry.playerId === speaker.id && entry.debateBeat === "vote-intent");
      if (speech) {
        rows.push({
          ...rowFromPublicSpeech(state, scenarioId, speech, "public-timing-vote-intent"),
          requiresPublicTimingPressureVariant: true,
          expectedTimingBeat: "vote-intent",
        });
      }
    }
  }
}

function seedPublicSynthesisVerificationVariantEvidence(state, speaker, focus, mode) {
  speaker.aiPersona = "pressure";
  speaker.dialogueBias = speaker.dialogueBias ?? {};
  state.players.forEach((player) => {
    speaker.suspicion[player.id] = player.id === focus.id ? 0.95 : 0.08;
    speaker.dialogueBias[player.id] = player.id === focus.id ? 1.08 : -0.15;
  });
  if (["identity-vote", "identity-nomination"].includes(mode)) {
    seedPublicRoleClaimForTarget(state, focus, "investigator");
  }
  const entriesByMode = {
    "identity-vote": [
      {
        kind: "public-speech",
        source: "public-chat",
        text: `${seat(focus)} 的身份解释和昨晚信息先后对不上，需要把身份口径讲清。`,
        payload: {
          speakerId: focus.id,
          focusId: focus.id,
          polarity: "accuse",
        },
      },
      {
        kind: "public-vote",
        source: "public-procedure",
        text: `${seat(focus)} 的投票理由和身份口径连不上，票型需要解释。`,
        payload: {
          voterId: focus.id,
          targetId: focus.id,
          focusId: focus.id,
          polarity: "accuse",
        },
      },
    ],
    "pressure-vote": [
      {
        kind: "public-speech",
        source: "public-chat",
        text: `${seat(focus)} 的公开站队和台面压力都压在同一边。`,
        payload: {
          speakerId: focus.id,
          focusId: focus.id,
          polarity: "accuse",
        },
      },
      {
        kind: "public-vote",
        source: "public-procedure",
        text: `${seat(focus)} 的票型跟台面压力同向，但投票理由没讲清。`,
        payload: {
          voterId: focus.id,
          targetId: focus.id,
          focusId: focus.id,
          polarity: "accuse",
        },
      },
    ],
    "identity-nomination": [
      {
        kind: "public-speech",
        source: "public-chat",
        text: `${seat(focus)} 的身份解释被提名压力顶住，上台前需要把身份口径讲清。`,
        payload: {
          speakerId: focus.id,
          focusId: focus.id,
          polarity: "accuse",
        },
      },
      {
        kind: "nomination",
        source: "public-procedure",
        text: `${seat(focus)} 被推上台面后没有补出能对齐的身份口径。`,
        payload: {
          nomineeId: focus.id,
          focusId: focus.id,
          polarity: "accuse",
        },
      },
    ],
    "pressure-nomination": [
      {
        kind: "public-speech",
        source: "public-chat",
        text: `${seat(focus)} 的公开站队和台面压力都压到提名口。`,
        payload: {
          speakerId: focus.id,
          focusId: focus.id,
          polarity: "accuse",
        },
      },
      {
        kind: "nomination",
        source: "public-procedure",
        text: `${seat(focus)} 被推上台面后还没有补清公开压力来源。`,
        payload: {
          nomineeId: focus.id,
          focusId: focus.id,
          polarity: "accuse",
        },
      },
    ],
  };
  const entries = entriesByMode[mode] ?? [];
  entries.forEach((entry) => {
    addAgentObservation(state, speaker.id, {
      ...entry,
      private: false,
    });
  });
}

function pushPublicEvidenceSynthesisVerificationVariantRows(rows, scenarioId, seed = 2026060410) {
  [
    { mode: "identity-vote", scriptId: "tb" },
    { mode: "pressure-vote", scriptId: "bmr" },
    { mode: "identity-nomination", scriptId: "tb" },
    { mode: "pressure-nomination", scriptId: "bmr" },
  ].forEach((fixture, index) => {
    const { state, rng } = createScriptVoteQualityState(fixture.scriptId, seed + index);
    advanceDayStage(state, "public");
    const speaker = state.players.find((player) => !player.isHuman && player.team === "good" && player.alive);
    const focus = state.players.find((player) => !player.isHuman && player.id !== speaker?.id && player.alive);
    if (!speaker || !focus) return;

    clearPublicContinuityForTimingFixture(state, speaker, focus);
    seedPublicSynthesisVerificationVariantEvidence(state, speaker, focus, fixture.mode);
    forceNextPublicResponse(state, speaker, focus);
    const before = state.events.speeches.length;
    const step = runAIConversationStep(state, rng);
    if (!step.ok) return;

    const speech = state.events.speeches
      .slice(before)
      .find((entry) => !entry.private && entry.playerId === speaker.id && entry.focusId === focus.id);
    if (!speech) return;

    rows.push({
      ...rowFromPublicSpeech(state, scenarioId, speech, `public-synthesis-verification-${fixture.mode}`),
      requiresPublicEvidenceSynthesisVerificationVariant: true,
      expectedPublicEvidenceSynthesisVerificationMode: fixture.mode,
    });
  });
}

const CROSS_SCRIPT_FALSE_CLAIM_FIXTURES = {
  bmr: {
    fakeRoleId: "gambler",
    alternateFakeRoleId: "professor",
  },
  snv: {
    fakeRoleId: "artist",
    alternateFakeRoleId: "savant",
  },
};

function pushCrossScriptPrivateMultiEvidenceRows(rows, scenarioId, seed) {
  Object.entries(CROSS_SCRIPT_FALSE_CLAIM_FIXTURES).forEach(([scriptId, fixture], index) => {
    const { state, rng } = createScriptVoteQualityState(scriptId, seed + index);
    const speaker = state.players.find((player) => !player.isHuman && player.team === "good" && player.alive);
    const focus = state.players.find((player) => !player.isHuman && player.id !== speaker?.id && player.alive);
    const decoy = state.players.find(
      (player) => !player.isHuman && player.id !== speaker?.id && player.id !== focus?.id && player.alive
    );
    if (!speaker || !focus || !decoy) return;

    state.players.forEach((player) => {
      speaker.suspicion[player.id] = player.id === focus.id ? 0.86 : player.id === decoy.id ? 0.18 : 0.12;
    });
    const fakeRoleId = fixture.fakeRoleId === focus.roleId ? fixture.alternateFakeRoleId : fixture.fakeRoleId;
    const claim = {
      day: state.day,
      playerId: focus.id,
      roleId: fakeRoleId,
      private: false,
    };
    state.events.claims.push(claim);
    focus.publicClaimRoleId = fakeRoleId;
    recordPublicClaimForAgents(state, claim);
    addAgentObservation(state, speaker.id, {
      kind: "execution",
      source: "public-procedure",
      private: false,
      reliability: "certain",
      text: `${focus.id} was revealed.`,
      payload: {
        playerId: focus.id,
        targetId: focus.id,
        roleId: focus.roleId,
        reason: "fixed-eval-reveal",
        phase: "day",
      },
    });
    addAgentObservation(state, speaker.id, {
      kind: "public-speech",
      source: "public-chat",
      private: false,
      text: `${seat(focus)} 在公聊里推动低证据位 ${seat(decoy)}，像是在转移焦点。`,
      payload: {
        speakerId: focus.id,
        focusId: decoy.id,
        polarity: "accuse",
      },
    });

    const input = {
      humanLine: `你现在为什么优先看 ${seat(focus)}？`,
      intentHint: "reason",
    };
    const result = runPrivateWhisper(state, { targetId: speaker.id, ...input }, rng);
    rows.push({
      ...rowFromPrivateResult(state, scenarioId, `cross-script-private-multi-evidence-${scriptId}`, speaker, input, result),
      requiresCrossScriptPrivateMultiEvidence: true,
      requiresPrivateEvidenceSynthesisVariant: true,
      expectedPrivateEvidenceSynthesisMode: "identity-low-evidence",
      expectedScriptId: scriptId,
    });
  });
}

function pushPrivateVoteIdentitySynthesisRows(rows, scenarioId, seed = 2026060321) {
  ["bmr", "snv"].forEach((scriptId, index) => {
    const { state, rng } = createScriptVoteQualityState(scriptId, seed + index);
    const speaker = state.players.find((player) => !player.isHuman && player.team === "good" && player.alive);
    const focus = state.players.find((player) => !player.isHuman && player.id !== speaker?.id && player.alive);
    const runnerUp = state.players.find(
      (player) => !player.isHuman && player.id !== speaker?.id && player.id !== focus?.id && player.alive
    );
    if (!speaker || !focus || !runnerUp) return;

    state.players.forEach((player) => {
      speaker.suspicion[player.id] = player.id === focus.id ? 0.84 : player.id === runnerUp.id ? 0.7 : 0.14;
    });
    addAgentObservation(state, speaker.id, {
      kind: "public-speech",
      source: "public-chat",
      private: false,
      text: `${seat(focus)} 的身份口径和前面说法对不上。`,
      payload: {
        speakerId: focus.id,
        targetId: focus.id,
        polarity: "accuse",
      },
    });
    addAgentObservation(state, speaker.id, {
      kind: "public-speech",
      source: "public-chat",
      private: false,
      text: `${seat(focus)} 的投票和当前票型压力相反。`,
      payload: {
        speakerId: focus.id,
        targetId: focus.id,
        polarity: "accuse",
      },
    });

    const input = {
      humanLine: `你为什么说 ${seat(focus)} 比 ${seat(runnerUp)} 更急？`,
      intentHint: "reason",
    };
    const result = runPrivateWhisper(state, { targetId: speaker.id, ...input }, rng);
    rows.push({
      ...rowFromPrivateResult(state, scenarioId, `private-evidence-synthesis-identity-vote-${scriptId}`, speaker, input, result),
      requiresPrivateEvidenceSynthesisVariant: true,
      expectedPrivateEvidenceSynthesisMode: "identity-vote",
      expectedScriptId: scriptId,
    });
  });
}

function pushPrivateNightInfoIdentitySynthesisRows(rows, scenarioId, seed = 2026060325) {
  Object.entries(CROSS_SCRIPT_FALSE_CLAIM_FIXTURES).forEach(([scriptId, fixture], index) => {
    const { state, rng } = createScriptVoteQualityState(scriptId, seed + index);
    const speaker = state.players.find((player) => !player.isHuman && player.team === "good" && player.alive);
    const focus = state.players.find((player) => !player.isHuman && player.id !== speaker?.id && player.alive);
    const runnerUp = state.players.find(
      (player) => !player.isHuman && player.id !== speaker?.id && player.id !== focus?.id && player.alive
    );
    if (!speaker || !focus || !runnerUp) return;

    state.players.forEach((player) => {
      speaker.suspicion[player.id] = player.id === focus.id ? 0.85 : player.id === runnerUp.id ? 0.68 : 0.13;
    });
    const fakeRoleId = fixture.alternateFakeRoleId === focus.roleId ? fixture.fakeRoleId : fixture.alternateFakeRoleId;
    const claim = {
      day: state.day,
      playerId: focus.id,
      roleId: fakeRoleId,
      private: false,
    };
    state.events.claims.push(claim);
    focus.publicClaimRoleId = fakeRoleId;
    recordPublicClaimForAgents(state, claim);
    addAgentObservation(state, speaker.id, {
      kind: "execution",
      source: "public-procedure",
      private: false,
      reliability: "certain",
      text: `${focus.id} was revealed.`,
      payload: {
        playerId: focus.id,
        targetId: focus.id,
        roleId: focus.roleId,
        reason: "fixed-eval-reveal",
        phase: "day",
      },
    });
    addAgentObservation(state, speaker.id, {
      kind: "night-info",
      source: "storyteller",
      private: true,
      reliability: "uncertain",
      contaminationRisk: 0.18,
      text: `夜间信息链条指向 ${seat(focus)}，需要和身份口径互相验证。`,
      payload: {
        targetId: focus.id,
        playerId: focus.id,
        contaminationReason: "fixed-eval-night-info",
      },
    });

    const input = {
      humanLine: `你现在为什么优先看 ${seat(focus)}？先说证据关系。`,
      intentHint: "reason",
    };
    const result = runPrivateWhisper(state, { targetId: speaker.id, ...input }, rng);
    rows.push({
      ...rowFromPrivateResult(state, scenarioId, `private-evidence-synthesis-identity-night-info-${scriptId}`, speaker, input, result),
      requiresPrivateEvidenceSynthesisVariant: true,
      expectedPrivateEvidenceSynthesisMode: "identity-night-info",
      expectedScriptId: scriptId,
    });
  });
}

function pushPrivateProtectionVoteSynthesisRows(rows, scenarioId, seed = 2026060327) {
  Object.entries(CROSS_SCRIPT_FALSE_CLAIM_FIXTURES).forEach(([scriptId, fixture], index) => {
    const { state, rng } = createScriptVoteQualityState(scriptId, seed + index);
    const speaker = state.players.find((player) => !player.isHuman && player.team === "good" && player.alive);
    const focus = state.players.find((player) => !player.isHuman && player.id !== speaker?.id && player.alive);
    const protectedTarget = state.players.find(
      (player) => !player.isHuman && player.id !== speaker?.id && player.id !== focus?.id && player.alive
    );
    if (!speaker || !focus || !protectedTarget) return;

    state.players.forEach((player) => {
      speaker.suspicion[player.id] = player.id === focus.id ? 0.86 : player.id === protectedTarget.id ? 0.74 : 0.12;
    });
    const fakeRoleId =
      fixture.fakeRoleId === protectedTarget.roleId ? fixture.alternateFakeRoleId : fixture.fakeRoleId;
    const claim = {
      day: state.day,
      playerId: protectedTarget.id,
      roleId: fakeRoleId,
      private: false,
    };
    state.events.claims.push(claim);
    protectedTarget.publicClaimRoleId = fakeRoleId;
    recordPublicClaimForAgents(state, claim);
    addAgentObservation(state, speaker.id, {
      kind: "execution",
      source: "public-procedure",
      private: false,
      reliability: "certain",
      text: `${protectedTarget.id} was revealed.`,
      payload: {
        playerId: protectedTarget.id,
        targetId: protectedTarget.id,
        roleId: protectedTarget.roleId,
        reason: "fixed-eval-protected-target-reveal",
        phase: "day",
      },
    });
    addAgentObservation(state, speaker.id, {
      kind: "public-speech",
      source: "public-chat",
      private: false,
      text: `${seat(focus)} 在公聊里维护高压目标 ${seat(protectedTarget)}，像是在帮人卸压。`,
      polarity: "defend",
      payload: {
        speakerId: focus.id,
        targetId: focus.id,
        focusId: protectedTarget.id,
        protectedTargetId: protectedTarget.id,
        polarity: "defend",
      },
    });
    addAgentObservation(state, speaker.id, {
      kind: "public-vote",
      source: "public-procedure",
      private: false,
      text: `${seat(focus)} 的投票和当前票型压力相反，反票理由要讲清。`,
      payload: {
        voterId: focus.id,
        targetId: focus.id,
        focusId: focus.id,
        polarity: "accuse",
      },
    });

    const input = {
      humanLine: `你为什么说 ${seat(focus)} 的保人和票型要一起看？`,
      intentHint: "reason",
    };
    const result = runPrivateWhisper(state, { targetId: speaker.id, ...input }, rng);
    rows.push({
      ...rowFromPrivateResult(state, scenarioId, `private-evidence-synthesis-protection-vote-${scriptId}`, speaker, input, result),
      requiresPrivateEvidenceSynthesisVariant: true,
      expectedPrivateEvidenceSynthesisMode: "protection-vote",
      expectedScriptId: scriptId,
      protectedTargetName: seat(protectedTarget),
    });
  });
}

function pushPrivateSourceIdentitySynthesisRows(rows, scenarioId, seed = 2026060329) {
  Object.entries(CROSS_SCRIPT_FALSE_CLAIM_FIXTURES).forEach(([scriptId, fixture], index) => {
    const { state, rng } = createScriptVoteQualityState(scriptId, seed + index);
    const speaker = state.players.find((player) => !player.isHuman && player.team === "good" && player.alive);
    const focus = state.players.find((player) => !player.isHuman && player.id !== speaker?.id && player.alive);
    const runnerUp = state.players.find(
      (player) => !player.isHuman && player.id !== speaker?.id && player.id !== focus?.id && player.alive
    );
    if (!speaker || !focus || !runnerUp) return;

    state.players.forEach((player) => {
      speaker.suspicion[player.id] = player.id === focus.id ? 0.85 : player.id === runnerUp.id ? 0.64 : 0.12;
    });
    const fakeRoleId = fixture.fakeRoleId === focus.roleId ? fixture.alternateFakeRoleId : fixture.fakeRoleId;
    const claim = {
      day: state.day,
      playerId: focus.id,
      roleId: fakeRoleId,
      private: false,
    };
    state.events.claims.push(claim);
    focus.publicClaimRoleId = fakeRoleId;
    recordPublicClaimForAgents(state, claim);
    addAgentObservation(state, speaker.id, {
      kind: "execution",
      source: "public-procedure",
      private: false,
      reliability: "certain",
      text: `${focus.id} was revealed.`,
      payload: {
        playerId: focus.id,
        targetId: focus.id,
        roleId: focus.roleId,
        reason: "fixed-eval-source-identity-reveal",
        phase: "day",
      },
    });
    const sourceObservation = addAgentObservation(state, speaker.id, {
      kind: "public-speech",
      source: "public-chat",
      private: false,
      text: `${seat(focus)} 前面给过一条来源需要复核的身份口径，细节和公开验证没有对齐。`,
      payload: {
        speakerId: focus.id,
        targetId: focus.id,
        focusId: focus.id,
        polarity: "claim",
      },
    });
    updateAgentSourceTrustForPlayer(state, speaker.id, focus.id, {
      delta: -0.36,
      reason: "fixed-eval-source-identity-unstable",
      eventKey: `fixed-eval-source-identity-${scriptId}`,
      evidenceId: sourceObservation?.id ?? "",
      source: "quality-fixture",
    });

    const input = {
      humanLine: `你为什么说 ${seat(focus)} 的来源和身份要一起复核？`,
      intentHint: "reason",
    };
    const result = runPrivateWhisper(state, { targetId: speaker.id, ...input }, rng);
    rows.push({
      ...rowFromPrivateResult(state, scenarioId, `private-evidence-synthesis-source-identity-${scriptId}`, speaker, input, result),
      requiresPrivateEvidenceSynthesisVariant: true,
      expectedPrivateEvidenceSynthesisMode: "source-identity",
      expectedScriptId: scriptId,
    });
  });
}

const EVIL_PRIVATE_COORDINATION_FIXTURES = {
  tb: "imp",
  bmr: "po",
  snv: "vortox",
};

function pushEvilPrivateCoordinationRows(rows, scenarioId, seed) {
  Object.entries(EVIL_PRIVATE_COORDINATION_FIXTURES).forEach(([scriptId, preferredHumanRoleId], index) => {
    const rng = fixedRng(seed + index);
    const state = createNewGame({ scriptId, playerCount: 9, preferredHumanRoleId }, rng);
    state.aiQualityRunId = `${scriptId}-evil-private-${seed + index}`;
    initializeAI(state);
    runNight(state, rng);

    const human = state.players.find((player) => player.isHuman);
    const speaker = state.players.find(
      (player) =>
        !player.isHuman &&
        player.team === "evil" &&
        player.alive &&
        (getAIAgent(state, player)?.knownAllyIds ?? []).includes(human?.id)
    );
    const focus = state.players.find((player) => player.team === "good" && !player.isHuman && player.alive && player.id !== speaker?.id);
    if (!human || !speaker || !focus) return;

    speaker.suspicion[focus.id] = 0.99;
    speaker.dialogueBias = speaker.dialogueBias ?? {};
    speaker.dialogueBias[focus.id] = 1.2;
    addAgentObservation(state, speaker.id, {
      kind: "public-speech",
      source: "public-chat",
      private: false,
      text: `${seat(focus)} 的公开身份和票型有破绽，可以拿来做台面压力。`,
      payload: {
        speakerId: focus.id,
        focusId: focus.id,
        polarity: "accuse",
      },
    });

    const input = {
      humanLine: "自己人，你真实身份和台面伪装怎么安排？今天推谁？",
      intentHint: "claim",
      allowHiddenTruth: true,
      humanTeam: human.team ?? "",
    };
    const result = runPrivateWhisper(state, { targetId: speaker.id, ...input }, rng);
    rows.push(
      markHiddenAllowedPrivateRow(rowFromPrivateResult(state, scenarioId, `evil-private-coordination-${scriptId}`, speaker, input, result), {
        requiresEvilPrivateCoordination: true,
        expectedScriptId: scriptId,
        humanTeam: human.team ?? "",
      })
    );
  });
}

const AI_TO_AI_EVIL_COORDINATION_FIXTURES = {
  tb: "washerwoman",
  bmr: "sailor",
  snv: "clockmaker",
};

function pushAIToAIEvilCoordinationRows(rows, scenarioId, seed) {
  Object.entries(AI_TO_AI_EVIL_COORDINATION_FIXTURES).forEach(([scriptId, preferredHumanRoleId], index) => {
    const rng = fixedRng(seed + index);
    const state = createNewGame({ scriptId, playerCount: 9, preferredHumanRoleId }, rng);
    state.aiQualityRunId = `${scriptId}-ai-to-ai-evil-${seed + index}`;
    initializeAI(state);
    runNight(state, rng);

    const speaker = state.players.find(
      (player) =>
        !player.isHuman &&
        player.team === "evil" &&
        player.alive &&
        (getAIAgent(state, player)?.knownAllyIds ?? []).some((id) => id !== player.id)
    );
    const allyId = getAIAgent(state, speaker)?.knownAllyIds?.find((id) => id !== speaker?.id);
    const target = state.players.find((player) => player.id === allyId && !player.isHuman && player.team === "evil" && player.alive);
    const focus = state.players.find(
      (player) => player.team === "good" && !player.isHuman && player.alive && player.id !== speaker?.id && player.id !== target?.id
    );
    if (!speaker || !target || !focus) return;

    speaker.suspicion[target.id] = 0.02;
    speaker.suspicion[focus.id] = 0.99;
    speaker.dialogueBias = speaker.dialogueBias ?? {};
    speaker.dialogueBias[target.id] = 1.3;
    speaker.dialogueBias[focus.id] = 1.2;
    addAgentObservation(state, speaker.id, {
      kind: "public-speech",
      source: "public-chat",
      private: false,
      text: `${seat(focus)} 的公开身份和票型有破绽，可以拿来做台面压力。`,
      payload: {
        speakerId: focus.id,
        focusId: focus.id,
        polarity: "accuse",
      },
    });

    const messages = runAIToAIPrivateWhispers(state, rng);
    const message = messages.find(
      (entry) =>
        entry.speakerId === speaker.id &&
        entry.targetId === target.id &&
        /自己人|一边|邪恶视角|队伍信息|恶魔|爪牙/.test(entry.response ?? "")
    );
    if (!message) return;

    const leakedToTimeline = (state.aiDialogue?.timeline ?? []).some((entry) => entry.text === message.response);
    const leakedToLog = JSON.stringify(state.logs ?? []).includes(message.response);
    rows.push({
      ...rowFromAIToAIPrivateMessage(state, scenarioId, `evil-coordination-${scriptId}`, message),
      requiresAIToAIEvilCoordination: true,
      expectedScriptId: scriptId,
      hiddenFromHuman: true,
      hiddenFromTimeline: !leakedToTimeline,
      hiddenFromLog: !leakedToLog,
    });
  });
}

function pushCrossScriptCrossDayStanceRows(rows, scenarioId, seed) {
  ["bmr", "snv"].forEach((scriptId, scriptIndex) => {
    ["hold", "shift"].forEach((mode, modeIndex) => {
      const { state, rng } = createScriptVoteQualityState(scriptId, seed + scriptIndex * 17 + modeIndex);
      const speaker = state.players.find((player) => !player.isHuman && player.team === "good" && player.alive);
      const focus = state.players.find((player) => !player.isHuman && player.id !== speaker?.id && player.alive);
      if (!speaker || !focus) return;

      advanceDayStage(state, "public");
      resetQualityStateForNextPublicDay(state);
      speaker.aiPersona = mode === "hold" ? "steady" : "pressure";
      speaker.dialogueBias = speaker.dialogueBias ?? {};
      state.players.forEach((player) => {
        speaker.suspicion[player.id] = player.id === focus.id ? (mode === "hold" ? 0.84 : 0.88) : 0.12;
        speaker.dialogueBias[player.id] = player.id === focus.id ? 0.96 : -0.12;
      });

      if (mode === "hold") {
        seedPriorCrossDayStance(state, speaker, focus, {
          stance: "press",
          score: 0.82,
          reasonSummary: "昨天公开身份和票型对不上",
          evidenceCount: 2,
        });
        addAgentObservation(state, speaker.id, {
          kind: "public-speech",
          source: "public-chat",
          private: false,
          text: `${seat(focus)} 昨天的公开身份和票型今天仍然对不上。`,
          payload: {
            speakerId: focus.id,
            focusId: focus.id,
            polarity: "accuse",
          },
        });
      } else {
        seedPriorCrossDayStance(state, speaker, focus, {
          stance: "watch",
          score: 0.5,
          reasonSummary: "昨天只有轻微观察",
          evidenceCount: 0,
        });
        addAgentObservation(state, speaker.id, {
          kind: "public-vote",
          source: "public-procedure",
          private: false,
          text: `${seat(focus)} 的投票和身份解释今天彻底连不上，需要把昨天观察线升级成压力线。`,
          payload: {
            voterId: focus.id,
            targetId: focus.id,
            focusId: focus.id,
            polarity: "accuse",
          },
        });
      }

      const before = rows.length;
      pushCrossDayPublicStep(rows, state, scenarioId, `cross-script-cross-day-${scriptId}-${mode}`, speaker, focus, rng);
      if (rows.length > before) {
        rows[rows.length - 1] = {
          ...rows[rows.length - 1],
          requiresCrossScriptCrossDayStance: true,
          expectedScriptId: scriptId,
          expectedCrossDayMode: mode,
        };
      }
    });
  });
}

function pushCrossDayTargetSwitchPublicStep(rows, state, scenarioId, index, speaker, previousFocus, currentFocus, rng, extra = {}) {
  forceNextPublicResponse(state, speaker, currentFocus);
  const before = state.events.speeches.length;
  const step = runAIConversationStep(state, rng);
  if (!step.ok) {
    return;
  }
  const speech = state.events.speeches
    .slice(before)
    .find(
      (entry) =>
        !entry.private &&
        entry.playerId === speaker.id &&
        entry.focusId === currentFocus.id &&
        entry.decisionRationale?.targetSwitchContinuity
    );
  if (speech) {
    rows.push({
      ...rowFromPublicSpeech(state, scenarioId, speech, index),
      requiresCrossDayTargetSwitch: true,
      expectedPreviousFocusId: previousFocus.id,
      expectedPreviousFocusName: seat(previousFocus),
      ...extra,
    });
  }
}

function pushCrossDayTargetSwitchRow(rows, scenarioId, seed) {
  const { state, rng, observer, focus: previousFocus } = createQualityState(seed);
  const speaker = observer;
  const currentFocus = state.players.find(
    (player) => !player.isHuman && player.id !== speaker?.id && player.id !== previousFocus?.id && player.alive
  );
  if (!speaker || !previousFocus || !currentFocus) {
    return;
  }

  advanceDayStage(state, "public");
  resetQualityStateForNextPublicDay(state);
  speaker.aiPersona = "steady";
  speaker.dialogueBias = speaker.dialogueBias ?? {};
  state.players.forEach((player) => {
    speaker.suspicion[player.id] =
      player.id === currentFocus.id ? 0.89 : player.id === previousFocus.id ? 0.58 : 0.12;
    speaker.dialogueBias[player.id] =
      player.id === currentFocus.id ? 1.05 : player.id === previousFocus.id ? 0.25 : -0.18;
  });
  seedPriorCrossDayStance(state, speaker, previousFocus, {
    stance: "press",
    score: 0.84,
    reasonSummary: "昨天公开身份和票型对不上",
    evidenceCount: 2,
  });
  addAgentObservation(state, speaker.id, {
    kind: "public-speech",
    source: "public-chat",
    private: false,
    text: `${seat(currentFocus)} 今天身份口径和上一轮发言对不上，需要先解释。`,
    payload: {
      speakerId: currentFocus.id,
      focusId: currentFocus.id,
      polarity: "accuse",
    },
  });
  addAgentObservation(state, speaker.id, {
    kind: "public-vote",
    source: "public-procedure",
    private: false,
    text: `${seat(currentFocus)} 的投票态度和当前票型压力相反，今天多出一条可见证据。`,
    payload: {
      voterId: currentFocus.id,
      targetId: currentFocus.id,
      focusId: currentFocus.id,
      polarity: "accuse",
    },
  });

  pushCrossDayTargetSwitchPublicStep(rows, state, scenarioId, "cross-day-target-switch", speaker, previousFocus, currentFocus, rng);
}

function pushCrossScriptCrossDayTargetSwitchRows(rows, scenarioId, seed) {
  ["bmr", "snv"].forEach((scriptId, index) => {
    const { state, rng } = createScriptVoteQualityState(scriptId, seed + index);
    const speaker = state.players.find((player) => !player.isHuman && player.team === "good" && player.alive);
    const targets = state.players.filter((player) => !player.isHuman && player.id !== speaker?.id && player.alive);
    const previousFocus = targets[0];
    const currentFocus = targets[1];
    if (!speaker || !previousFocus || !currentFocus) return;

    advanceDayStage(state, "public");
    resetQualityStateForNextPublicDay(state);
    speaker.aiPersona = "steady";
    speaker.dialogueBias = speaker.dialogueBias ?? {};
    state.players.forEach((player) => {
      speaker.suspicion[player.id] =
        player.id === currentFocus.id ? 0.9 : player.id === previousFocus.id ? 0.6 : 0.12;
      speaker.dialogueBias[player.id] =
        player.id === currentFocus.id ? 1.08 : player.id === previousFocus.id ? 0.28 : -0.18;
    });
    seedPriorCrossDayStance(state, speaker, previousFocus, {
      stance: "press",
      score: 0.84,
      reasonSummary: scriptId === "bmr" ? "昨天死亡保护口径和票型对不上" : "昨天公开身份口径和投票对不上",
      evidenceCount: 2,
    });
    addAgentObservation(state, speaker.id, {
      kind: "public-speech",
      source: "public-chat",
      private: false,
      text:
        scriptId === "bmr"
          ? `${seat(currentFocus)} 今天的死亡保护解释和上一轮发言接不上，需要先公开补链。`
          : `${seat(currentFocus)} 今天的身份口径和公开压力回应接不上，需要先公开补链。`,
      payload: {
        speakerId: currentFocus.id,
        focusId: currentFocus.id,
        polarity: "accuse",
      },
    });
    addAgentObservation(state, speaker.id, {
      kind: "public-vote",
      source: "public-procedure",
      private: false,
      text:
        scriptId === "bmr"
          ? `${seat(currentFocus)} 的票型和死亡保护解释方向相反，今天多出一条可见证据。`
          : `${seat(currentFocus)} 的票型和身份解释方向相反，今天多出一条可见证据。`,
      payload: {
        voterId: currentFocus.id,
        targetId: currentFocus.id,
        focusId: currentFocus.id,
        polarity: "accuse",
      },
    });

    pushCrossDayTargetSwitchPublicStep(rows, state, scenarioId, `cross-script-target-switch-${scriptId}`, speaker, previousFocus, currentFocus, rng, {
      requiresCrossScriptCrossDayTargetSwitch: true,
      expectedScriptId: scriptId,
    });
  });
}

function prepareNonPublicTargetSwitchFixture(seed) {
  const { state, rng, observer: speaker, focus: previousFocus } = createQualityState(seed);
  const human = state.players.find((player) => player.isHuman);
  const currentFocus = state.players.find(
    (player) => !player.isHuman && player.id !== speaker?.id && player.id !== previousFocus?.id && player.alive
  );
  if (!speaker || !human || !previousFocus || !currentFocus) {
    return null;
  }

  resetQualityStateForNextPrivateDay(state);
  speaker.aiPersona = "steady";
  speaker.dialogueBias = speaker.dialogueBias ?? {};
  state.players.forEach((player) => {
    speaker.suspicion[player.id] =
      player.id === currentFocus.id ? 0.9 : player.id === previousFocus.id ? 0.58 : player.id === human.id ? 0.2 : 0.12;
    speaker.dialogueBias[player.id] =
      player.id === currentFocus.id ? 1.05 : player.id === previousFocus.id ? 0.25 : -0.18;
  });
  seedPriorCrossDayStance(state, speaker, previousFocus, {
    stance: "press",
    score: 0.84,
    reasonSummary: "昨天公开身份和票型对不上",
    evidenceCount: 2,
  });
  addAgentObservation(state, speaker.id, {
    kind: "public-speech",
    source: "public-chat",
    private: false,
    text: `${seat(currentFocus)} 今天身份口径和上一轮发言对不上，需要先解释。`,
    payload: {
      speakerId: currentFocus.id,
      focusId: currentFocus.id,
      polarity: "accuse",
    },
  });
  addAgentObservation(state, speaker.id, {
    kind: "public-vote",
    source: "public-procedure",
    private: false,
    text: `${seat(currentFocus)} 的投票态度和当前票型压力相反，今天多出一条可见证据。`,
    payload: {
      voterId: currentFocus.id,
      targetId: currentFocus.id,
      focusId: currentFocus.id,
      polarity: "accuse",
    },
  });

  return { state, rng, speaker, human, previousFocus, currentFocus };
}

function pushNonPublicTargetSwitchRow(rows, scenarioId, seed) {
  const fixture = prepareNonPublicTargetSwitchFixture(seed);
  if (!fixture) {
    return;
  }
  const { state, rng, speaker, previousFocus, currentFocus } = fixture;

  const input = {
    humanLine: `你今天为什么先看 ${seat(currentFocus)}，不继续压 ${seat(previousFocus)}？`,
    intentHint: "reason",
  };
  const result = runPrivateWhisper(state, { targetId: speaker.id, ...input }, rng);
  rows.push({
    ...rowFromPrivateResult(state, scenarioId, "non-public-target-switch", speaker, input, result),
    requiresNonPublicTargetSwitchContinuity: true,
    expectedPreviousFocusId: previousFocus.id,
    expectedPreviousFocusName: seat(previousFocus),
  });
}

function pushProactiveTargetSwitchRow(rows, scenarioId, seed) {
  const fixture = prepareNonPublicTargetSwitchFixture(seed);
  if (!fixture) {
    return;
  }
  const { state, rng, speaker, previousFocus, currentFocus, human } = fixture;
  speaker.suspicion[human.id] = 0.66;
  speaker.privateNotes = [...(speaker.privateNotes ?? []), `${seat(currentFocus)} 今天票型压力需要先私下同步。`];

  const messages = runAIProactiveWhispers(state, rng);
  const message = messages.find(
    (entry) =>
      entry.targetId === speaker.id &&
      entry.focusId === currentFocus.id &&
      entry.decisionRationale?.targetSwitchContinuity?.previousTargetId === previousFocus.id
  );
  if (!message) {
    return;
  }
  rows.push({
    ...rowFromProactiveMessage(state, scenarioId, "target-switch-proactive", message),
    requiresNonPublicTargetSwitchContinuity: true,
    expectedPreviousFocusId: previousFocus.id,
    expectedPreviousFocusName: seat(previousFocus),
    expectedNonPublicTargetSwitchSource: "proactive-private",
  });
}

function pushAIToAITargetSwitchRow(rows, scenarioId, seed) {
  const fixture = prepareNonPublicTargetSwitchFixture(seed);
  if (!fixture) {
    return;
  }
  const { state, rng, speaker, previousFocus, currentFocus } = fixture;
  speaker.alive = false;
  speaker.publicClaimRoleId = speaker.roleId;

  const messages = runAIToAIPrivateWhispers(state, rng);
  const message = messages.find(
    (entry) =>
      entry.speakerId === speaker.id &&
      entry.focusId === currentFocus.id &&
      entry.decisionRationale?.targetSwitchContinuity?.previousTargetId === previousFocus.id
  );
  if (!message) {
    return;
  }
  rows.push({
    ...rowFromAIToAIPrivateMessage(state, scenarioId, "target-switch-ai-ai", message),
    requiresNonPublicTargetSwitchContinuity: true,
    expectedPreviousFocusId: previousFocus.id,
    expectedPreviousFocusName: seat(previousFocus),
    expectedNonPublicTargetSwitchSource: "ai-ai-private",
  });
}

function pushCrossScriptFormalVoteRows(rows, scenarioId, seed) {
  ["bmr", "snv"].forEach((scriptId, index) => {
    const { state } = createScriptVoteQualityState(scriptId, seed + index);
    const nominee = state.players.find((player) => !player.isHuman && player.team === "good" && player.alive);
    const voter = state.players.find(
      (player) => !player.isHuman && player.team === "good" && player.id !== nominee?.id && player.alive
    );
    if (!voter || !nominee) return;

    prepareVoteFixtureState(state, voter, nominee, { suspicion: 0.96, withEvidence: true });
    const decision = decideAIVoteWithRationale(voter, nominee, state, () => 0.99);
    rows.push({
      ...rowFromFormalVote(
        state,
        scenarioId,
        { nomineeId: nominee.id },
        { voterId: voter.id, vote: decision.vote, voteRationale: decision.voteRationale },
        `edge-cross-script-${scriptId}`
      ),
      requiresFormalVoteScriptCoverage: true,
      expectedScriptId: scriptId,
    });
  });
}

function rowFromClaimDisclosureRevision(state, scenarioId, speaker, rationale) {
  const continuityLine = oneLine(rationale?.continuityLine ?? "");
  const rationaleLine = oneLine(rationale?.line ?? "");
  const text = oneLine([continuityLine, rationaleLine].filter(Boolean).join(" "));
  return {
    id: `${scenarioId}-claim-revise`,
    scenarioId,
    audience: "private",
    source: "claim-disclosure-fixture",
    intent: "claim-revise",
    speakerId: speaker?.id ?? "",
    speakerName: seat(speaker),
    prompt: "forced identity-line revision fixture",
    text,
    ok: !!text,
    focusId: "",
    focusName: "",
    decisionRationale: null,
    claimDisclosureRationale: {
      ...(rationale ?? {}),
      spokenLine: continuityLine || rationaleLine || rationale?.spokenLine || "",
    },
    crossDayStance: null,
    strategyRationale: null,
    evidenceSummaries: [],
    requiresClaimDisclosureRationale: true,
    requiresClaimDisclosureContinuity: true,
    allowHiddenTruth: false,
  };
}

export function buildAIQualityEvaluationSet(options = {}) {
  const scenarioId = options.scenarioId ?? "tb-fixed-quality";
  const { state, rng, observer, focus } = createQualityState(options.seed ?? 2026060201);
  const rows = [];

  if (observer && focus) {
    const privateInputs = [
      { humanLine: `你现在为什么优先看 ${seat(focus)}？`, intentHint: "reason" },
      { humanLine: `如果今天提 ${seat(focus)}，你会不会跟票？`, intentHint: "vote" },
      { humanLine: "你的身份现在能给到什么程度？", intentHint: "claim" },
    ];
    privateInputs.forEach((input, index) => {
      const result = runPrivateWhisper(state, { targetId: observer.id, ...input }, rng);
      rows.push(rowFromPrivateResult(state, scenarioId, index, observer, input, result));
    });
  }

  {
    const claimFixture = createQualityState((options.seed ?? 2026060201) + 17);
    const claimState = claimFixture.state;
    const claimRng = claimFixture.rng;
    const claimObserver = claimFixture.observer;
    if (claimObserver) {
      runPrivateWhisper(
        claimState,
        { targetId: claimObserver.id, humanLine: "你的身份现在能给到什么程度？", intentHint: "claim" },
        claimRng
      );
      const repeatInput = {
        humanLine: "刚才那个身份口径你还保持吗？",
        intentHint: "claim",
        requiresClaimDisclosureContinuity: true,
      };
      const repeat = runPrivateWhisper(claimState, { targetId: claimObserver.id, ...repeatInput }, claimRng);
      rows.push(rowFromPrivateResult(claimState, scenarioId, 3, claimObserver, repeatInput, repeat));
    }
  }

  {
    const reviseFixture = createQualityState((options.seed ?? 2026060201) + 31);
    const reviseState = reviseFixture.state;
    const reviseRng = reviseFixture.rng;
    const reviseSpeaker = reviseFixture.observer;
    const human = reviseState.players.find((player) => player.isHuman);
    if (reviseSpeaker && human) {
      const previousRoleId = "saint";
      const currentRoleId = "ravenkeeper";
      const previousDisclosure = {
        level: "hard",
        roleId: previousRoleId,
        roleName: roleNameById(reviseState, previousRoleId),
        channel: `private:${human.id}`,
      };
      const plan = claimDisclosurePlanner(reviseState, reviseSpeaker, human, reviseRng, {
        private: true,
        audience: "private",
        intent: "claim",
        forceHard: true,
        roleId: currentRoleId,
        previousDisclosure,
      });
      rows.push(rowFromClaimDisclosureRevision(reviseState, scenarioId, reviseSpeaker, plan.claimDisclosureRationale));
    }
  }

  runAIProactiveWhispers(state, rng)
    .slice(0, 2)
    .forEach((message, index) => {
      rows.push(rowFromProactiveMessage(state, scenarioId, index, message));
    });

  advanceDayStage(state, "public");
  const beforePublic = state.events.speeches.length;
  runAIDiscussion(state, rng);
  runAIDiscussion(state, rng);
  state.events.speeches
    .slice(beforePublic)
    .filter((entry) => !entry.private && oneLine(entry.line))
    .slice(0, 6)
    .forEach((entry, index) => {
      rows.push(rowFromPublicSpeech(state, scenarioId, entry, index));
    });

  pushEvilCoverPublicRow(rows, scenarioId, (options.seed ?? 2026060201) + 43);
  pushEvilCoverPivotRow(rows, scenarioId, (options.seed ?? 2026060201) + 47);
  pushEvilProtectAllyPublicRow(rows, scenarioId, (options.seed ?? 2026060201) + 53);
  pushEvilClaimCoverContinuityRow(rows, scenarioId, (options.seed ?? 2026060201) + 59);
  pushEvilClaimCoverPivotRow(rows, scenarioId, (options.seed ?? 2026060201) + 61);
  pushEvilClaimCoverProtectAllyRow(rows, scenarioId, (options.seed ?? 2026060201) + 67);
  pushEvilClaimCoverCrossDayRow(rows, scenarioId, (options.seed ?? 2026060201) + 71);
  pushEvilClaimCoverDeceptionArcRow(rows, scenarioId, (options.seed ?? 2026060201) + 73);
  pushCrossScriptEvilClaimCoverPressureContinuityRows(rows, scenarioId, (options.seed ?? 2026060201) + 75);

  if (observer && focus) {
    resetQualityStateForNextPublicDay(state);
    observer.dialogueBias = observer.dialogueBias ?? {};
    state.players.forEach((player) => {
      observer.dialogueBias[player.id] = player.id === focus.id ? 0.95 : -0.15;
    });
    seedPriorCrossDayStance(state, observer, focus, {
      stance: "press",
      score: 0.82,
      reasonSummary: "昨天公开身份和票型对不上",
      evidenceCount: 2,
    });
    addAgentObservation(state, observer.id, {
      kind: "public-speech",
      source: "public-chat",
      private: false,
      text: `${seat(focus)} 昨天的公开身份和票型今天仍然对不上。`,
      payload: {
        speakerId: focus.id,
        focusId: focus.id,
        polarity: "accuse",
      },
    });
    pushCrossDayPublicStep(rows, state, scenarioId, 6, observer, focus, rng);
  }

  if (observer && focus) {
    resetQualityStateForNextPublicDay(state);
    const decoy = state.players.find((player) => !player.isHuman && player.id !== observer.id && player.id !== focus.id && player.alive);
    observer.dialogueBias = observer.dialogueBias ?? {};
    state.players.forEach((player) => {
      observer.dialogueBias[player.id] = player.id === focus.id ? 0.95 : player.id === decoy?.id ? -0.25 : -0.15;
    });
    seedPriorCrossDayStance(state, observer, focus, {
      stance: "watch",
      score: 0.5,
      reasonSummary: "昨天只有轻微观察",
      evidenceCount: 0,
    });
    addAgentObservation(state, observer.id, {
      kind: "public-vote",
      source: "public-procedure",
      private: false,
      text: `${seat(focus)} 的投票和身份解释今天彻底连不上，需要把昨天观察线升级成压力线。`,
      payload: {
        voterId: focus.id,
        targetId: focus.id,
        focusId: focus.id,
        polarity: "accuse",
      },
    });
    pushCrossDayPublicStep(rows, state, scenarioId, 7, observer, focus, rng);
  }

  pushCrossDayTargetSwitchRow(rows, scenarioId, (options.seed ?? 2026060201) + 113);
  pushCrossScriptCrossDayTargetSwitchRows(rows, scenarioId, (options.seed ?? 2026060201) + 117);
  pushNonPublicTargetSwitchRow(rows, scenarioId, (options.seed ?? 2026060201) + 121);
  pushProactiveTargetSwitchRow(rows, scenarioId, (options.seed ?? 2026060201) + 123);
  pushAIToAITargetSwitchRow(rows, scenarioId, (options.seed ?? 2026060201) + 125);

  markPublicDiscussionRound(state);
  advanceDayStage(state, "nomination");
  const proposal = chooseAINomination(state);
  rows.push(rowFromNomination(state, scenarioId, proposal));
  pushNominationStrategyModeRows(rows, scenarioId, (options.seed ?? 2026060201) + 69);
  pushNominationDefenseResponseRows(rows, scenarioId, (options.seed ?? 2026060201) + 70);
  pushCrossScriptNominationDefenseResponseRows(rows, scenarioId, (options.seed ?? 2026060201) + 71);
  pushNominationDefenseAwareVoteRows(rows, scenarioId, (options.seed ?? 2026060201) + 72);
  pushCrossScriptNominationDefenseAwareVoteRows(rows, scenarioId, (options.seed ?? 2026060201) + 73);
  if (proposal?.nominatorId && proposal?.nomineeId) {
    const voteResult = resolveNominationAndVote(
      state,
      {
        nominatorId: proposal.nominatorId,
        nomineeId: proposal.nomineeId,
        humanVoteYes: false,
        decideAIVote: (voter, nominee, currentState) => decideAIVoteWithRationale(voter, nominee, currentState, rng),
      },
      rng
    );
    if (voteResult.accepted) {
      voteResult.votes
        .filter((entry) => {
          const voter = state.players.find((player) => player.id === entry.voterId);
          return voter && !voter.isHuman && voter.id !== proposal.nominatorId && !entry.abstain;
        })
        .forEach((entry, index) => {
          rows.push(rowFromFormalVote(state, scenarioId, voteResult, entry, index));
        });
    }
  }
  pushFormalVoteEdgeCaseRows(rows, scenarioId, (options.seed ?? 2026060201) + 71);
  pushButlerRestrictedFormalVoteRow(rows, scenarioId, (options.seed ?? 2026060201) + 89);
  pushEvilFormalVoteCoverRows(rows, scenarioId, (options.seed ?? 2026060201) + 101);
  pushCrossScriptFormalVoteRows(rows, scenarioId, (options.seed ?? 2026060201) + 131);
  pushCrossScriptPrivateClaimRows(rows, scenarioId, (options.seed ?? 2026060201) + 151);
  pushCrossScriptClaimContinuityRows(rows, scenarioId, (options.seed ?? 2026060201) + 161);
  pushRoleConstrainedClaimDisclosureRows(rows, scenarioId, (options.seed ?? 2026060201) + 165);
  pushCrossScriptPublicReasoningRows(rows, scenarioId, (options.seed ?? 2026060201) + 171);
  pushCrossScriptPublicMultiEvidenceRows(rows, scenarioId, (options.seed ?? 2026060201) + 191);
  pushPublicPersonaPressureVariantRows(rows, scenarioId, (options.seed ?? 2026060201) + 195);
  pushPublicTimingPressureVariantRows(rows, scenarioId, (options.seed ?? 2026060201) + 197);
  pushPublicRolePressureVariantRows(rows, scenarioId, (options.seed ?? 2026060201) + 199);
  pushPublicEvidenceSynthesisVerificationVariantRows(rows, scenarioId, (options.seed ?? 2026060201) + 200);
  pushCrossScriptPrivateMultiEvidenceRows(rows, scenarioId, (options.seed ?? 2026060201) + 201);
  pushPrivateVoteIdentitySynthesisRows(rows, scenarioId, (options.seed ?? 2026060201) + 203);
  pushPrivateNightInfoIdentitySynthesisRows(rows, scenarioId, (options.seed ?? 2026060201) + 204);
  pushPrivateProtectionVoteSynthesisRows(rows, scenarioId, (options.seed ?? 2026060201) + 206);
  pushPrivateSourceIdentitySynthesisRows(rows, scenarioId, (options.seed ?? 2026060201) + 208);
  pushEvilPrivateCoordinationRows(rows, scenarioId, (options.seed ?? 2026060201) + 205);
  pushAIToAIEvilCoordinationRows(rows, scenarioId, (options.seed ?? 2026060201) + 207);
  pushCrossScriptCrossDayStanceRows(rows, scenarioId, (options.seed ?? 2026060201) + 211);

  return {
    scenarioId,
    stateSummary: {
      scriptId: state.scriptId,
      day: state.day,
      night: state.night,
      observer: seat(observer),
      focus: seat(focus),
    },
    rows: rows.filter((row) => row.text),
  };
}

function hasHiddenLeak(row) {
  if (row.allowHiddenTruth) return false;
  const text = row.text ?? "";
  return HIDDEN_LEAK_TERMS.some((term) => text.includes(term));
}

function hasEvidenceCitation(row) {
  return (
    (row.evidenceSummaries?.length ?? 0) > 0 ||
    (row.decisionRationale?.focusEvidenceCount ?? 0) > 0 ||
    (row.voteRationale?.evidenceCount ?? 0) > 0 ||
    EVIDENCE_LANGUAGE_PATTERN.test(row.text ?? "")
  );
}

function hasRunnerUpComparison(row) {
  const decision = row.decisionRationale;
  const trace = decision?.comparisonTrace;
  if (!decision?.runnerUpId) return false;
  return !!(
    trace?.summary &&
    oneLine(trace.summary).includes(oneLine(trace.focusName || decision.focusName)) &&
    oneLine(trace.summary).includes(oneLine(trace.runnerUpName || decision.runnerUpName))
  );
}

function hasDecisionReconsideration(row) {
  const decision = row.decisionRationale;
  const line = oneLine(decision?.reconsiderationLine);
  const focusName = oneLine(decision?.focusName || row.focusName);
  if (!decision?.focusId || !decision?.reconsiderationKey || !line) {
    return false;
  }
  return (
    (!focusName || line.includes(focusName)) &&
    /降级|重排|降压|不锁死|重新比较/.test(line) &&
    !(decision.publicOnly && EVIL_ONLY_LANGUAGE_PATTERN.test(line))
  );
}

function hasDecisionConfidenceCalibration(row) {
  const decision = row.decisionRationale;
  const line = oneLine(decision?.confidenceLine);
  const focusName = oneLine(decision?.focusName || row.focusName);
  if (!decision?.focusId || !decision?.confidenceBand || !line) {
    return false;
  }
  return (
    (!focusName || line.includes(focusName)) &&
    /强压|偏前|贴线|接近|验证|不是铁证|不锁死/.test(line) &&
    !(decision.publicOnly && EVIL_ONLY_LANGUAGE_PATTERN.test(line))
  );
}

function hasDecisionVerificationPlan(row) {
  const decision = row.decisionRationale;
  const line = oneLine(decision?.verificationLine);
  const focusName = oneLine(decision?.focusName || row.focusName);
  if (!decision?.focusId || !line) {
    return false;
  }
  return (
    (!focusName || line.includes(focusName)) &&
    /验证点|先问|先让|补|对上|解释|票型|身份|可验|复核/.test(line) &&
    !(decision.publicOnly && EVIL_ONLY_LANGUAGE_PATTERN.test(line))
  );
}

function hasDecisionEvidenceMode(row) {
  const decision = row.decisionRationale;
  const line = oneLine(decision?.evidenceModeLine);
  const focusName = oneLine(decision?.focusName || row.focusName);
  if (!decision?.focusId || !decision?.evidenceMode || !line) {
    return false;
  }
  return (
    (!focusName || line.includes(focusName)) &&
    /主依据|发言节奏|票型|提名|身份口径|夜里信息|私聊线索|混合线索|个人证据|硬信息/.test(line) &&
    !(decision.publicOnly && EVIL_ONLY_LANGUAGE_PATTERN.test(line))
  );
}

function hasDecisionEvidenceModeVerificationAlignment(row) {
  const decision = row.decisionRationale;
  const line = oneLine(decision?.verificationLine);
  const focusName = oneLine(decision?.focusName || row.focusName);
  if (!decision?.focusId || !decision?.evidenceMode || !line) {
    return false;
  }
  const modePattern = {
    "private-rumor": /私聊线索|公开可复核/,
    "night-info": /昨晚信息|夜里信息|死亡|保护链/,
    "vote-shape": /投票|提名|票型/,
    "claim-chain": /身份口径|角色说法/,
    "evidence-count": /逐条回应|个人证据|污染/,
    "public-speech": /公开发言|发言节奏|站边/,
    "low-evidence": /可复核身份|票型|观察/,
    "mixed-evidence": /身份.*票型.*发言链|发言链/,
  }[decision.evidenceMode] ?? /身份|票型|发言链|公开|复核/;
  return (
    (!focusName || line.includes(focusName)) &&
    modePattern.test(line) &&
    !(decision.publicOnly && EVIL_ONLY_LANGUAGE_PATTERN.test(line))
  );
}

function hasDecisionResponsePlan(row) {
  const decision = row.decisionRationale;
  const line = oneLine(decision?.responsePlanLine);
  const focusName = oneLine(decision?.focusName || row.focusName);
  if (!decision?.focusId || !line) {
    return false;
  }
  return (
    (!focusName || line.includes(focusName)) &&
    /如果|回应/.test(line) &&
    /降压|降级|回看|重排|提名|加压|继续压|主压力|复核|重算/.test(line) &&
    !(decision.publicOnly && EVIL_ONLY_LANGUAGE_PATTERN.test(line))
  );
}

function hasDecisionResponseCriteria(row) {
  const decision = row.decisionRationale;
  const line = oneLine(decision?.responseCriteriaLine);
  const focusName = oneLine(decision?.focusName || row.focusName);
  if (!decision?.focusId || !line) {
    return false;
  }
  return (
    (!focusName || line.includes(focusName)) &&
    /判定标准|算过关|过关|降压|加压|继续压|重算|换顺位|观察位|提名压力/.test(line) &&
    /能|只|补出|对上|讲清|接上|拆开|逐条/.test(line) &&
    !(decision.publicOnly && EVIL_ONLY_LANGUAGE_PATTERN.test(line))
  );
}

function hasDecisionEvidenceInteraction(row) {
  const decision = row.decisionRationale;
  const line = oneLine(decision?.evidenceInteractionLine);
  const focusName = oneLine(decision?.focusName || row.focusName);
  if (!decision?.focusId || !line) {
    return false;
  }
  return (
    (!focusName || line.includes(focusName)) &&
    /证据联动|互相|同向|接上|并入|托住|去重|降权|合并/.test(line) &&
    /身份|票型|发言|夜里|私聊|时间线|线索/.test(line) &&
    /升级|降压|加压|继续压|上压|重排|弱压|观察位/.test(line) &&
    !(decision.publicOnly && EVIL_ONLY_LANGUAGE_PATTERN.test(line))
  );
}

function hasDecisionPressureStage(row) {
  const decision = row.decisionRationale;
  const line = oneLine(decision?.pressureStageLine);
  const focusName = oneLine(decision?.focusName || row.focusName);
  if (!decision?.focusId || !line) {
    return false;
  }
  return (
    (!focusName || line.includes(focusName)) &&
    /压力档位|观察位|验证入口|对比档|提名前复核档|主压力位|验证压|分数前排位/.test(line) &&
    /观察|追问|复核|提名|提名池|提名压力|不直接提名|升级/.test(line) &&
    !(decision.publicOnly && EVIL_ONLY_LANGUAGE_PATTERN.test(line))
  );
}

function hasDecisionCounterEvidence(row) {
  const decision = row.decisionRationale;
  const line = oneLine(decision?.counterEvidenceLine);
  const focusName = oneLine(decision?.focusName || row.focusName);
  if (!decision?.focusId || !line) {
    return false;
  }
  return (
    (!focusName || line.includes(focusName)) &&
    /反证|也可能|不等于|不代表|不能锁死|不能只按|不是|误伤|重算/.test(line) &&
    /降压|降级|观察|解释|对上|重算|复核|先核|先听|不能锁死|不能只按|不直接拍死|换顺位|自保|跟票|公开可核|定性|狼线/.test(line) &&
    !(decision.publicOnly && EVIL_ONLY_LANGUAGE_PATTERN.test(line))
  );
}

function hasDecisionTableRisk(row) {
  const decision = row.decisionRationale;
  const line = oneLine(decision?.tableRiskLine);
  const focusName = oneLine(decision?.focusName || row.focusName);
  if (!decision?.focusId || !line) {
    return false;
  }
  return (
    (!focusName || line.includes(focusName)) &&
    /桌面风险|风险|代价|浪费|带偏|隧道|分散|闭眼|跟票|带票|处决压力/.test(line) &&
    /提名|票型|公开|私下|回应|追问|复核|第二压力位|可见口径|身份|时间线|带票/.test(line) &&
    !(decision.publicOnly && EVIL_ONLY_LANGUAGE_PATTERN.test(line))
  );
}

function hasDecisionInformationGain(row) {
  const decision = row.decisionRationale;
  const line = oneLine(decision?.informationGainLine);
  const focusName = oneLine(decision?.focusName || row.focusName);
  if (!decision?.focusId || !line) {
    return false;
  }
  return (
    (!focusName || line.includes(focusName)) &&
    /信息收益|分清|判断|区分|可复核|独立证据/.test(line) &&
    /身份|票型|发言链|时间线|上票|跟票|解释|回应|公开|提名池|压力|线索/.test(line) &&
    !(decision.publicOnly && EVIL_ONLY_LANGUAGE_PATTERN.test(line))
  );
}

function hasDecisionTableReaction(row) {
  const decision = row.decisionRationale;
  const line = oneLine(decision?.tableReactionLine);
  const focusName = oneLine(decision?.focusName || row.focusName);
  if (!decision?.focusId || !line) {
    return false;
  }
  return (
    (!focusName || line.includes(focusName)) &&
    /桌面反应|反应观察|看谁|跟压|护人|转移|站边|带票|跟票|洗白|补证/.test(line) &&
    /跟压|护人|转移|站边|解释|发言|票型|提名|压力|第二压力位|回应|公开|理由/.test(line) &&
    !(decision.publicOnly && EVIL_ONLY_LANGUAGE_PATTERN.test(line))
  );
}

function hasDecisionTimingWindow(row) {
  const decision = row.decisionRationale;
  const line = oneLine(decision?.timingWindowLine);
  const focusName = oneLine(decision?.focusName || row.focusName);
  if (!decision?.focusId || !line) {
    return false;
  }
  return (
    (!focusName || line.includes(focusName)) &&
    /时机窗口|提名|投票|票前|公聊|私聊|回应窗口|提名前复核|低证据入口/.test(line) &&
    /轻压|追问|复核|回应|提名池|票型|发言|身份|升级|锁票|票意/.test(line) &&
    !(decision.publicOnly && EVIL_ONLY_LANGUAGE_PATTERN.test(line))
  );
}

function hasDecisionWorldBranch(row) {
  const decision = row.decisionRationale;
  const line = oneLine(decision?.worldBranchLine);
  const focusName = oneLine(decision?.focusName || row.focusName);
  if (!decision?.focusId || !line) {
    return false;
  }
  return (
    (!focusName || line.includes(focusName)) &&
    /世界分支|如果|成立|断开|好身份|坏身份|重排|主线|分支/.test(line) &&
    /身份|票型|发言|解释|公开|提名池|压力|降压|坏身份线|好身份分支|公开线/.test(line) &&
    !(decision.publicOnly && EVIL_ONLY_LANGUAGE_PATTERN.test(line))
  );
}

function hasDecisionVoteCoalition(row) {
  const decision = row.decisionRationale;
  const line = oneLine(decision?.voteCoalitionLine);
  const focusName = oneLine(decision?.focusName || row.focusName);
  if (!decision?.focusId || !line) {
    return false;
  }
  return (
    (!focusName || line.includes(focusName)) &&
    /票面联盟|票面|跟票|上票|处决票|主票线|共识|分票|票数/.test(line) &&
    /理由|公开|提名|压力|第二票面|第二压力位|回应|解释|支持者|共识/.test(line) &&
    !(decision.publicOnly && EVIL_ONLY_LANGUAGE_PATTERN.test(line))
  );
}

function hasDecisionSourceReliability(row) {
  const decision = row.decisionRationale;
  const line = oneLine(decision?.sourceReliabilityLine);
  const focusName = oneLine(decision?.focusName || row.focusName);
  if (!decision?.focusId || !line) {
    return false;
  }
  return (
    (!focusName || line.includes(focusName)) &&
    /来源可靠度|来源|独立来源|同源|回声|可复核|可信度|污染|降权/.test(line) &&
    /公开|身份|票型|发言|夜里|私下|第二来源|证据|回应|解释|复核|重排|时间线/.test(line) &&
    !(decision.publicOnly && EVIL_ONLY_LANGUAGE_PATTERN.test(line))
  );
}

function hasDecisionTimelineConsistency(row) {
  const decision = row.decisionRationale;
  const line = oneLine(decision?.timelineConsistencyLine);
  const focusName = oneLine(decision?.focusName || row.focusName);
  if (!decision?.focusId || !line) {
    return false;
  }
  return (
    (!focusName || line.includes(focusName)) &&
    /时间线一致性|时间线|先后|顺序|先报|改口|事后|前后|节点|本轮|跨日/.test(line) &&
    /身份|票型|发言|夜里|死亡|保护|回应|公开|提名|投票|证据|复核|升级|降权|主线|第二压力位/.test(line) &&
    !(decision.publicOnly && EVIL_ONLY_LANGUAGE_PATTERN.test(line))
  );
}

function hasDecisionIncentiveAlignment(row) {
  const decision = row.decisionRationale;
  const line = oneLine(decision?.incentiveAlignmentLine);
  const focusName = oneLine(decision?.focusName || row.focusName);
  if (!decision?.focusId || !line) {
    return false;
  }
  return (
    (!focusName || line.includes(focusName)) &&
    /动机归因|动机|收益|解桌|保自己|自保|护人|转移压力|获利|带偏|跟风/.test(line) &&
    /公开|行为|身份|票型|发言|回应|信息|压力|理由|复核|加压|降权|主压/.test(line) &&
    !(decision.publicOnly && EVIL_ONLY_LANGUAGE_PATTERN.test(line))
  );
}

function hasDecisionBurdenOfProof(row) {
  const decision = row.decisionRationale;
  const line = oneLine(decision?.burdenOfProofLine);
  const focusName = oneLine(decision?.focusName || row.focusName);
  if (!decision?.focusId || !line) {
    return false;
  }
  return (
    (!focusName || line.includes(focusName)) &&
    /举证责任|责任|谁该|本人|支持者|跟票者|护航|回答|解释|给理由|公开理由/.test(line) &&
    /公开|身份|票型|发言|回应|理由|复核|证据|提名|上票|处决|压力|第二压力位|目标/.test(line) &&
    !(decision.publicOnly && EVIL_ONLY_LANGUAGE_PATTERN.test(line))
  );
}

function hasDecisionQuestionPriority(row) {
  const decision = row.decisionRationale;
  const line = oneLine(decision?.questionPriorityLine);
  const focusName = oneLine(decision?.focusName || row.focusName);
  if (!decision?.focusId || !line) {
    return false;
  }
  return (
    (!focusName || line.includes(focusName)) &&
    /追问顺序|顺序|先问|先核|先让|再问|再看|回看|最后|下一步/.test(line) &&
    /公开|身份|票型|发言|回应|理由|复核|证据|时间线|跟票|支持者|提名|处决票|主疑点|第二压力位/.test(line) &&
    !(decision.publicOnly && EVIL_ONLY_LANGUAGE_PATTERN.test(line))
  );
}

function hasDecisionActionThreshold(row) {
  const decision = row.decisionRationale;
  const line = oneLine(decision?.actionThresholdLine);
  const focusName = oneLine(decision?.focusName || row.focusName);
  if (!decision?.focusId || !line) {
    return false;
  }
  return (
    (!focusName || line.includes(focusName)) &&
    /行动门槛|门槛|观察追问|观察位|压力台|主压力位|提名|提名池|处决票|锁票|上票|升级|降压|回切/.test(line) &&
    /公开|回应|身份|票型|发言|证据|可复核|时间线|跟票|理由|断开|接上|第二压力位/.test(line) &&
    !(decision.publicOnly && EVIL_ONLY_LANGUAGE_PATTERN.test(line))
  );
}

function hasDecisionMemoryContinuity(row) {
  const decision = row.decisionRationale;
  const line = oneLine(decision?.memoryContinuityLine);
  const focusName = oneLine(decision?.focusName || row.focusName);
  if (!decision?.focusId || !line) {
    return false;
  }
  return (
    (!focusName || line.includes(focusName)) &&
    /记忆连续性|不是新起线|本日|建档|延续|转成|改看法|重置读法|对照|观察档/.test(line) &&
    /证据|发言|身份|票型|公开|本轮|昨天|天前|回应|主线|读法|可见/.test(line) &&
    !(decision.publicOnly && EVIL_ONLY_LANGUAGE_PATTERN.test(line))
  );
}

function hasDecisionExpressionDiscipline(row) {
  const decision = row.decisionRationale;
  const line = oneLine(decision?.expressionDisciplineLine);
  const focusName = oneLine(decision?.focusName || row.focusName);
  if (!decision?.focusId || !line) {
    return false;
  }
  return (
    (!focusName || line.includes(focusName)) &&
    /表达纪律|表达|公开说法|追问口吻|条件句|不说|不把|不锁死|不定性|回应质量|结论/.test(line) &&
    /公开|身份|票型|发言|回应|理由|复核|结论|处决|压力|跟票|时间线|夜里|可复核/.test(line) &&
    !(decision.publicOnly && EVIL_ONLY_LANGUAGE_PATTERN.test(line))
  );
}

function hasDecisionUncertaintyResolution(row) {
  const decision = row.decisionRationale;
  const line = oneLine(decision?.uncertaintyResolutionLine);
  const focusName = oneLine(decision?.focusName || row.focusName);
  if (!decision?.focusId || !line) {
    return false;
  }
  return (
    (!focusName || line.includes(focusName)) &&
    /不确定性|不确定|还缺|缺口|消解|差异|拉开|待验证|回应质量|证据不弱/.test(line) &&
    /公开|身份|票型|发言|回应|证据|复核|时间线|跟票|理由|夜里|提名|压力|处决/.test(line) &&
    !(decision.publicOnly && EVIL_ONLY_LANGUAGE_PATTERN.test(line))
  );
}

function hasDecisionEvidenceFreshness(row) {
  const decision = row.decisionRationale;
  const line = oneLine(decision?.evidenceFreshnessLine);
  const focusName = oneLine(decision?.focusName || row.focusName);
  if (!decision?.focusId || !line) {
    return false;
  }
  return (
    (!focusName || line.includes(focusName)) &&
    /证据新鲜度|新鲜|新证据|旧线索|旧理由|旧印象|本轮|本日|今天|当前回应|刷新|过夜|重新校验|新旧|同源/.test(line) &&
    /公开|身份|票型|发言|回应|证据|理由|压力|时间线|死亡|保护|校验|建档|结论/.test(line) &&
    !(decision.publicOnly && EVIL_ONLY_LANGUAGE_PATTERN.test(line))
  );
}

function hasDecisionFalsificationCheck(row) {
  const decision = row.decisionRationale;
  const line = oneLine(decision?.falsificationCheckLine);
  const focusName = oneLine(decision?.focusName || row.focusName);
  if (!decision?.focusId || !line) {
    return false;
  }
  return (
    (!focusName || line.includes(focusName)) &&
    /证伪检查|证伪|如果|能补|接上|自洽|降级|回切|不能继续|主压|强压|复核线/.test(line) &&
    /公开|身份|票型|发言|回应|证据|理由|时间线|死亡|保护|背书|同源|处决|压力/.test(line) &&
    !(decision.publicOnly && EVIL_ONLY_LANGUAGE_PATTERN.test(line))
  );
}

function hasDecisionCausalChain(row) {
  const decision = row.decisionRationale;
  const line = oneLine(decision?.causalChainLine);
  const focusName = oneLine(decision?.focusName || row.focusName);
  if (!decision?.focusId || !line) {
    return false;
  }
  return (
    (!focusName || line.includes(focusName)) &&
    /因果链|先.*再|导致|影响|推动|形成|变成|来自|才会|所以|解释空间|压力/.test(line) &&
    /公开|身份|票型|发言|回应|证据|理由|时间线|死亡|保护|背书|同源|处决|桌面|台面|压力/.test(line) &&
    !(decision.publicOnly && EVIL_ONLY_LANGUAGE_PATTERN.test(line))
  );
}

function hasDecisionAssumptionAudit(row) {
  const decision = row.decisionRationale;
  const line = oneLine(decision?.assumptionAuditLine);
  const focusName = oneLine(decision?.focusName || row.focusName);
  if (!decision?.focusId || !line) {
    return false;
  }
  return (
    (!focusName || line.includes(focusName)) &&
    /前提审计|前提|假设|依赖|不能假设|只假设|如果|否则|不成立/.test(line) &&
    /公开|身份|票型|发言|回应|证据|理由|时间线|死亡|保护|背书|同源|处决|压力|自洽|自保|跟票|醉毒|污染/.test(line) &&
    !(decision.publicOnly && EVIL_ONLY_LANGUAGE_PATTERN.test(line))
  );
}

function hasDecisionMechanicSensitivity(row) {
  const decision = row.decisionRationale;
  const line = oneLine(decision?.mechanicSensitivityLine);
  const focusName = oneLine(decision?.focusName || row.focusName);
  if (!decision?.focusId || !line) {
    return false;
  }
  return (
    (!focusName || line.includes(focusName)) &&
    /机制敏感性|机制|规则|登记|醉毒|中毒|醉酒|死亡|保护|身份口径|票型|提名|处决|能力信息|私下视角|隐藏信息/.test(line) &&
    /公开|身份|票型|发言|回应|证据|理由|时间线|死亡|保护|背书|同源|处决|压力|能力|信息|复核|降权/.test(line) &&
    !(decision.publicOnly && EVIL_ONLY_LANGUAGE_PATTERN.test(line))
  );
}

function hasDecisionRoleHypothesis(row) {
  const decision = row.decisionRationale;
  const line = oneLine(decision?.roleHypothesisLine);
  const focusName = oneLine(decision?.focusName || row.focusName);
  if (!decision?.focusId || !line) {
    return false;
  }
  return (
    (!focusName || line.includes(focusName)) &&
    /角色假说|好身份|坏身份|伪装|身份线|自洽|分支|能力|口径|票型/.test(line) &&
    /公开|身份|票型|发言|回应|信息|能力|解释|断点|压力|复核|主线|好人世界|坏人世界/.test(line) &&
    !(decision.publicOnly && EVIL_ONLY_LANGUAGE_PATTERN.test(line))
  );
}

function hasDecisionEvidenceBoundary(row) {
  const decision = row.decisionRationale;
  const line = oneLine(decision?.evidenceBoundaryLine);
  const focusName = oneLine(decision?.focusName || row.focusName);
  if (!decision?.focusId || !Array.isArray(decision?.riskFlags) || !line) {
    return false;
  }
  return (
    (!focusName || line.includes(focusName)) &&
    /边界|证据薄|分差贴线|公开信息|第二候选|线索并不弱|继续复核|单点结论|台面/.test(line) &&
    !(decision.publicOnly && EVIL_ONLY_LANGUAGE_PATTERN.test(line))
  );
}

function hasDecisionRunnerUpWatch(row) {
  const decision = row.decisionRationale;
  const line = oneLine(decision?.runnerUpWatchLine);
  const runnerUpName = oneLine(decision?.runnerUpName);
  if (!decision?.focusId || !decision?.runnerUpId || !runnerUpName || !line) {
    return false;
  }
  return (
    line.includes(runnerUpName) &&
    /第二压力位|先排第二|回看|重排|不.*放过|线索先不丢/.test(line) &&
    !(decision.publicOnly && EVIL_ONLY_LANGUAGE_PATTERN.test(line))
  );
}

function decisionReconsiderationCoverage(rows) {
  const decisionRows = rows.filter((row) => row.source !== "formal-vote" && row.decisionRationale?.focusId);
  if (decisionRows.length === 0) return 1;
  return rate(decisionRows.filter(hasDecisionReconsideration).length, decisionRows.length);
}

function decisionConfidenceCalibrationCoverage(rows) {
  const decisionRows = rows.filter((row) => row.source !== "formal-vote" && row.decisionRationale?.focusId);
  if (decisionRows.length === 0) return 1;
  return rate(decisionRows.filter(hasDecisionConfidenceCalibration).length, decisionRows.length);
}

function decisionVerificationPlanCoverage(rows) {
  const decisionRows = rows.filter((row) => row.source !== "formal-vote" && row.decisionRationale?.focusId);
  if (decisionRows.length === 0) return 1;
  return rate(decisionRows.filter(hasDecisionVerificationPlan).length, decisionRows.length);
}

function decisionEvidenceModeCoverage(rows) {
  const decisionRows = rows.filter((row) => row.source !== "formal-vote" && row.decisionRationale?.focusId);
  if (decisionRows.length === 0) return 1;
  return rate(decisionRows.filter(hasDecisionEvidenceMode).length, decisionRows.length);
}

function decisionEvidenceModeVerificationAlignmentCoverage(rows) {
  const decisionRows = rows.filter((row) => row.source !== "formal-vote" && row.decisionRationale?.focusId);
  if (decisionRows.length === 0) return 1;
  return rate(decisionRows.filter(hasDecisionEvidenceModeVerificationAlignment).length, decisionRows.length);
}

function decisionResponsePlanCoverage(rows) {
  const decisionRows = rows.filter((row) => row.source !== "formal-vote" && row.decisionRationale?.focusId);
  if (decisionRows.length === 0) return 1;
  return rate(decisionRows.filter(hasDecisionResponsePlan).length, decisionRows.length);
}

function decisionResponseCriteriaCoverage(rows) {
  const decisionRows = rows.filter((row) => row.source !== "formal-vote" && row.decisionRationale?.focusId);
  if (decisionRows.length === 0) return 1;
  return rate(decisionRows.filter(hasDecisionResponseCriteria).length, decisionRows.length);
}

function decisionEvidenceInteractionCoverage(rows) {
  const decisionRows = rows.filter((row) => row.source !== "formal-vote" && row.decisionRationale?.focusId);
  if (decisionRows.length === 0) return 1;
  return rate(decisionRows.filter(hasDecisionEvidenceInteraction).length, decisionRows.length);
}

function decisionPressureStageCoverage(rows) {
  const decisionRows = rows.filter((row) => row.source !== "formal-vote" && row.decisionRationale?.focusId);
  if (decisionRows.length === 0) return 1;
  return rate(decisionRows.filter(hasDecisionPressureStage).length, decisionRows.length);
}

function decisionCounterEvidenceCoverage(rows) {
  const decisionRows = rows.filter((row) => row.source !== "formal-vote" && row.decisionRationale?.focusId);
  if (decisionRows.length === 0) return 1;
  return rate(decisionRows.filter(hasDecisionCounterEvidence).length, decisionRows.length);
}

function decisionTableRiskCoverage(rows) {
  const decisionRows = rows.filter((row) => row.source !== "formal-vote" && row.decisionRationale?.focusId);
  if (decisionRows.length === 0) return 1;
  return rate(decisionRows.filter(hasDecisionTableRisk).length, decisionRows.length);
}

function decisionInformationGainCoverage(rows) {
  const decisionRows = rows.filter((row) => row.source !== "formal-vote" && row.decisionRationale?.focusId);
  if (decisionRows.length === 0) return 1;
  return rate(decisionRows.filter(hasDecisionInformationGain).length, decisionRows.length);
}

function decisionTableReactionCoverage(rows) {
  const decisionRows = rows.filter((row) => row.source !== "formal-vote" && row.decisionRationale?.focusId);
  if (decisionRows.length === 0) return 1;
  return rate(decisionRows.filter(hasDecisionTableReaction).length, decisionRows.length);
}

function decisionTimingWindowCoverage(rows) {
  const decisionRows = rows.filter((row) => row.source !== "formal-vote" && row.decisionRationale?.focusId);
  if (decisionRows.length === 0) return 1;
  return rate(decisionRows.filter(hasDecisionTimingWindow).length, decisionRows.length);
}

function decisionWorldBranchCoverage(rows) {
  const decisionRows = rows.filter((row) => row.source !== "formal-vote" && row.decisionRationale?.focusId);
  if (decisionRows.length === 0) return 1;
  return rate(decisionRows.filter(hasDecisionWorldBranch).length, decisionRows.length);
}

function decisionVoteCoalitionCoverage(rows) {
  const decisionRows = rows.filter((row) => row.source !== "formal-vote" && row.decisionRationale?.focusId);
  if (decisionRows.length === 0) return 1;
  return rate(decisionRows.filter(hasDecisionVoteCoalition).length, decisionRows.length);
}

function decisionSourceReliabilityCoverage(rows) {
  const decisionRows = rows.filter((row) => row.source !== "formal-vote" && row.decisionRationale?.focusId);
  if (decisionRows.length === 0) return 1;
  return rate(decisionRows.filter(hasDecisionSourceReliability).length, decisionRows.length);
}

function decisionTimelineConsistencyCoverage(rows) {
  const decisionRows = rows.filter((row) => row.source !== "formal-vote" && row.decisionRationale?.focusId);
  if (decisionRows.length === 0) return 1;
  return rate(decisionRows.filter(hasDecisionTimelineConsistency).length, decisionRows.length);
}

function decisionIncentiveAlignmentCoverage(rows) {
  const decisionRows = rows.filter((row) => row.source !== "formal-vote" && row.decisionRationale?.focusId);
  if (decisionRows.length === 0) return 1;
  return rate(decisionRows.filter(hasDecisionIncentiveAlignment).length, decisionRows.length);
}

function decisionBurdenOfProofCoverage(rows) {
  const decisionRows = rows.filter((row) => row.source !== "formal-vote" && row.decisionRationale?.focusId);
  if (decisionRows.length === 0) return 1;
  return rate(decisionRows.filter(hasDecisionBurdenOfProof).length, decisionRows.length);
}

function decisionQuestionPriorityCoverage(rows) {
  const decisionRows = rows.filter((row) => row.source !== "formal-vote" && row.decisionRationale?.focusId);
  if (decisionRows.length === 0) return 1;
  return rate(decisionRows.filter(hasDecisionQuestionPriority).length, decisionRows.length);
}

function decisionActionThresholdCoverage(rows) {
  const decisionRows = rows.filter((row) => row.source !== "formal-vote" && row.decisionRationale?.focusId);
  if (decisionRows.length === 0) return 1;
  return rate(decisionRows.filter(hasDecisionActionThreshold).length, decisionRows.length);
}

function decisionMemoryContinuityCoverage(rows) {
  const decisionRows = rows.filter((row) => row.source !== "formal-vote" && row.decisionRationale?.focusId);
  if (decisionRows.length === 0) return 1;
  return rate(decisionRows.filter(hasDecisionMemoryContinuity).length, decisionRows.length);
}

function decisionExpressionDisciplineCoverage(rows) {
  const decisionRows = rows.filter((row) => row.source !== "formal-vote" && row.decisionRationale?.focusId);
  if (decisionRows.length === 0) return 1;
  return rate(decisionRows.filter(hasDecisionExpressionDiscipline).length, decisionRows.length);
}

function decisionUncertaintyResolutionCoverage(rows) {
  const decisionRows = rows.filter((row) => row.source !== "formal-vote" && row.decisionRationale?.focusId);
  if (decisionRows.length === 0) return 1;
  return rate(decisionRows.filter(hasDecisionUncertaintyResolution).length, decisionRows.length);
}

function decisionEvidenceFreshnessCoverage(rows) {
  const decisionRows = rows.filter((row) => row.source !== "formal-vote" && row.decisionRationale?.focusId);
  if (decisionRows.length === 0) return 1;
  return rate(decisionRows.filter(hasDecisionEvidenceFreshness).length, decisionRows.length);
}

function decisionFalsificationCheckCoverage(rows) {
  const decisionRows = rows.filter((row) => row.source !== "formal-vote" && row.decisionRationale?.focusId);
  if (decisionRows.length === 0) return 1;
  return rate(decisionRows.filter(hasDecisionFalsificationCheck).length, decisionRows.length);
}

function decisionCausalChainCoverage(rows) {
  const decisionRows = rows.filter((row) => row.source !== "formal-vote" && row.decisionRationale?.focusId);
  if (decisionRows.length === 0) return 1;
  return rate(decisionRows.filter(hasDecisionCausalChain).length, decisionRows.length);
}

function decisionAssumptionAuditCoverage(rows) {
  const decisionRows = rows.filter((row) => row.source !== "formal-vote" && row.decisionRationale?.focusId);
  if (decisionRows.length === 0) return 1;
  return rate(decisionRows.filter(hasDecisionAssumptionAudit).length, decisionRows.length);
}

function decisionMechanicSensitivityCoverage(rows) {
  const decisionRows = rows.filter((row) => row.source !== "formal-vote" && row.decisionRationale?.focusId);
  if (decisionRows.length === 0) return 1;
  return rate(decisionRows.filter(hasDecisionMechanicSensitivity).length, decisionRows.length);
}

function decisionRoleHypothesisCoverage(rows) {
  const decisionRows = rows.filter((row) => row.source !== "formal-vote" && row.decisionRationale?.focusId);
  if (decisionRows.length === 0) return 1;
  return rate(decisionRows.filter(hasDecisionRoleHypothesis).length, decisionRows.length);
}

function decisionEvidenceBoundaryCoverage(rows) {
  const decisionRows = rows.filter((row) => row.source !== "formal-vote" && row.decisionRationale?.focusId);
  if (decisionRows.length === 0) return 1;
  return rate(decisionRows.filter(hasDecisionEvidenceBoundary).length, decisionRows.length);
}

function decisionRunnerUpWatchCoverage(rows) {
  const runnerUpRows = rows.filter((row) => row.source !== "formal-vote" && row.decisionRationale?.runnerUpId);
  if (runnerUpRows.length === 0) return 1;
  return rate(runnerUpRows.filter(hasDecisionRunnerUpWatch).length, runnerUpRows.length);
}

function sentenceStems(text) {
  const sentences = oneLine(text).match(/[^。！？；.!?;]+[。！？；.!?;]?/g) ?? [];
  return sentences
    .map((entry) =>
      oneLine(entry)
        .replace(/[，。！？；：、,.!?;:\s]/g, "")
        .slice(0, 12)
    )
    .filter((entry) => entry.length >= 4);
}

function repetitionRate(rows) {
  const stems = rows.flatMap((row) => sentenceStems(row.text));
  if (stems.length === 0) return 0;
  const seen = new Set();
  let repeats = 0;
  stems.forEach((stem) => {
    if (seen.has(stem)) repeats += 1;
    seen.add(stem);
  });
  return rate(repeats, stems.length);
}

function countsForStanceContinuity(row) {
  if (!row.decisionRationale?.focusId || !row.speakerId) return false;
  if (row.source === "formal-vote") return false;
  // Proactive private whispers are covered by their own rationale gate; they can
  // focus on disclosure safety rather than the public pressure target.
  if (row.source === "proactive-private") return false;
  return true;
}

function stanceContinuityRate(rows) {
  const bySpeaker = new Map();
  rows
    .filter(countsForStanceContinuity)
    .forEach((row) => {
      const groupKey = row.qualityRunId || row.scenarioId || row.id || "ungrouped";
      const speakerKey = `${groupKey}:${row.speakerId}`;
      const list = bySpeaker.get(speakerKey) ?? [];
      list.push(row);
      bySpeaker.set(speakerKey, list);
    });
  let pairs = 0;
  let coherent = 0;
  for (const list of bySpeaker.values()) {
    for (let index = 1; index < list.length; index += 1) {
      const previous = list[index - 1];
      const current = list[index];
      pairs += 1;
      if (
        current.decisionRationale.focusId === previous.decisionRationale.focusId ||
        STANCE_SWITCH_PATTERN.test(current.text)
      ) {
        coherent += 1;
      }
    }
  }
  return pairs === 0 ? 1 : rate(coherent, pairs);
}

function nominationReasonableRate(rows) {
  const nominations = rows.filter((row) => row.audience === "nomination");
  if (nominations.length === 0) return 1;
  const passed = nominations.filter((row) => {
    const decision = row.decisionRationale;
    return !!(
      row.ok &&
      decision?.focusId &&
      decision?.spokenLine &&
      row.text.includes(decision.spokenLine) &&
      row.strategyRationale?.line &&
      row.text.includes(row.strategyRationale.line)
    );
  }).length;
  return rate(passed, nominations.length);
}

function hasNominationActionContext(row) {
  const strategy = row.strategyRationale ?? null;
  const line = `${strategy?.line ?? ""}`;
  return !!(
    row.ok &&
    line &&
    row.text.includes(line) &&
    /不是空过|空过风险|不是空聊/.test(row.text) &&
    (!strategy?.voteText || row.text.includes(strategy.voteText)) &&
    /防守|站边|愿意跟|流程压力|执行信息|压力测试|桌面联盟|推进|换信息/.test(row.text)
  );
}

function nominationActionContextCoverage(rows) {
  const nominations = rows.filter((row) => row.audience === "nomination");
  if (nominations.length === 0) return 1;
  return rate(nominations.filter(hasNominationActionContext).length, nominations.length);
}

function nominationStrategyModeCoverage(rows) {
  const strategyRows = rows.filter((row) => row.requiresNominationStrategyModeCoverage);
  if (strategyRows.length === 0) return 0;
  const coveredRows = strategyRows.filter((row) => {
    const expectedMode = row.expectedNominationStrategyMode ?? "";
    const strategy = row.strategyRationale ?? null;
    return !!(
      row.source === "nomination-strategy-mode" &&
      row.audience === "nomination" &&
      NOMINATION_STRATEGY_DISPLAY_MODES.includes(expectedMode) &&
      strategy?.kind === "nomination-strategy-rationale" &&
      strategy.displayIntent === expectedMode &&
      hasNominationActionContext(row)
    );
  });
  const coveredModes = new Set(coveredRows.map((row) => row.expectedNominationStrategyMode).filter(Boolean));
  return Math.min(
    rate(coveredRows.length, strategyRows.length),
    rate(NOMINATION_STRATEGY_DISPLAY_MODES.filter((mode) => coveredModes.has(mode)).length, NOMINATION_STRATEGY_DISPLAY_MODES.length)
  );
}

function nominationStrategyPlanDedupCoverage(rows) {
  const strategyRows = rows.filter((row) => row.requiresNominationStrategyModeCoverage);
  if (strategyRows.length === 0) return 0;
  const repeatedPlanPhrases = ["流程压力打出来", "看谁愿意跟", "执行信息"];
  const coveredRows = strategyRows.filter((row) => {
    const text = compactSignal(row.text ?? "");
    return repeatedPlanPhrases.every((phrase) => countOccurrences(text, compactSignal(phrase)) <= 1);
  });
  return rate(coveredRows.length, strategyRows.length);
}

function nominationDefenseResponseCoverage(rows) {
  const defenseRows = rows.filter((row) => row.requiresNominationDefenseResponse);
  if (defenseRows.length === 0) return 0;
  return rate(defenseRows.filter(hasNominationDefenseResponse).length, defenseRows.length);
}

function nominationDefenseInfoDedupCoverage(rows) {
  const defenseRows = rows.filter((row) => row.requiresNominationDefenseResponse);
  if (defenseRows.length === 0) return 0;
  const repeatedInfoPhrases = ["昨晚信息", "我的信息"];
  const coveredRows = defenseRows.filter((row) => {
    const text = compactSignal(row.text ?? "");
    return repeatedInfoPhrases.every((phrase) => countOccurrences(text, compactSignal(phrase)) <= 1);
  });
  return rate(coveredRows.length, defenseRows.length);
}

function nominationDefenseOpeningKey(row) {
  const text = `${row.text ?? ""}`.replace(/\s+/g, " ").trim();
  const opening = text.split(/[。；]/u)[0] ?? text;
  return opening
    .replace(/：.*/u, "：")
    .replace(/「.*$/u, "「")
    .replace(/\d+号/gu, "N号")
    .trim();
}

function nominationDefenseResponseVariantCoverage(rows) {
  const defenseRows = rows.filter((row) => row.requiresNominationDefenseResponse);
  if (defenseRows.length === 0) return 0;
  const openingCounts = new Map();
  defenseRows.forEach((row) => {
    const key = nominationDefenseOpeningKey(row);
    openingCounts.set(key, (openingCounts.get(key) ?? 0) + 1);
  });
  const distinctOpeningTarget = Math.min(4, defenseRows.length);
  const distinctOpeningCoverage = rate(Math.min(openingCounts.size, distinctOpeningTarget), distinctOpeningTarget);
  const maxAllowedOpeningCount = Math.max(2, Math.ceil(defenseRows.length * 0.3));
  const dominantOpeningCount = Math.max(...openingCounts.values(), 0);
  const dominanceCoverage = dominantOpeningCount <= maxAllowedOpeningCount ? 1 : rate(maxAllowedOpeningCount, dominantOpeningCount);
  const oldStemRows = defenseRows.filter((row) => /我先不把身份一次说死/.test(row.text ?? "")).length;
  const oldStemAllowed = Math.max(1, Math.floor(defenseRows.length * 0.2));
  const oldStemCoverage = oldStemRows <= oldStemAllowed ? 1 : rate(oldStemAllowed, oldStemRows);
  return Math.min(
    rate(defenseRows.filter(hasNominationDefenseResponse).length, defenseRows.length),
    distinctOpeningCoverage,
    dominanceCoverage,
    oldStemCoverage
  );
}

function hasNominationDefenseResponse(row) {
  const text = row.text ?? "";
  return !!(
    row.ok &&
    row.source === "nomination-defense" &&
    row.audience === "nomination-defense" &&
    /回应提名理由|被点的理由|提名理由要拆开|提名理由拆开|提名卡的是|先听我接这条|公开口径接上|只推票不听我补信息|先验我说的点|我先防一下/.test(text) &&
    /身份|昨晚信息|票型|公开报/.test(text) &&
    /补不上再上票|对不上再票我|验不上再票我|接不上再票我|补不上再锁票|先验我说的点/.test(text) &&
    /降压|别跳过防守|防守要落到点上|先听完整防守|别只听结论|别只催票|桌面也要反看|这条也要记|推进也要记/.test(text)
  );
}

function nominationDefenseReasonAnchorCoverage(rows) {
  const defenseRows = rows.filter((row) => row.requiresNominationDefenseResponse);
  if (defenseRows.length === 0) return 0;
  return rate(defenseRows.filter(hasNominationDefenseReasonAnchor).length, defenseRows.length);
}

function highPressureNominationDefenseCounterPressureCoverage(rows) {
  const defenseRows = rows.filter((row) => row.requiresHighPressureNominationDefenseCounterPressure);
  if (defenseRows.length === 0) return 0;
  return rate(
    defenseRows.filter(
      (row) =>
        row.expectedPressureBand === "high" &&
        hasNominationDefenseResponse(row) &&
        hasNominationDefenseReasonAnchor(row) &&
        /反看|只推票不听我补信息|只催落票|直接催票|这条也要记|推进也要记|不听我补信息|不听我补口径/.test(row.text ?? "")
    ).length,
    defenseRows.length
  );
}

function crossScriptNominationDefenseReasonAnchorCoverage(rows) {
  const defenseRows = rows.filter((row) => row.requiresCrossScriptNominationDefenseReasonAnchor);
  if (defenseRows.length === 0) return 0;
  const coveredRows = defenseRows.filter(
    (row) =>
      ["bmr", "snv"].includes(row.scriptId) &&
      row.expectedScriptId === row.scriptId &&
      hasNominationDefenseResponse(row) &&
      hasNominationDefenseReasonAnchor(row)
  );
  const coveredCombos = new Set(coveredRows.map((row) => `${row.scriptId}:${row.expectedPressureBand ?? ""}`).filter(Boolean));
  const expectedCombos = ["bmr:low", "bmr:high", "snv:low", "snv:high"];
  return Math.min(rate(coveredRows.length, defenseRows.length), rate(expectedCombos.filter((combo) => coveredCombos.has(combo)).length, expectedCombos.length));
}

function hasNominationDefenseReasonAnchor(row) {
  const text = row.text ?? "";
  const reasonAnchor = nominationReasonAnchorFromPrompt(row.prompt ?? "");
  return !!(
    row.ok &&
    row.source === "nomination-defense" &&
    row.audience === "nomination-defense" &&
    reasonAnchor &&
    /身份|信息|票型|防守|证据|压力|解释|对上|昨晚|发言|投票|处决|验|跳|报/.test(reasonAnchor) &&
    text.includes(reasonAnchor)
  );
}

function nominationReasonAnchorFromPrompt(prompt) {
  const sentences = `${prompt ?? ""}`
    .replace(/\s+/g, " ")
    .split(/[。！？；]/u)
    .map((entry) => entry.replace(/^我(?:先)?提\s*/u, "").trim())
    .filter(Boolean);
  const reasonSentence =
    sentences.find((entry) => /身份|信息|票型|防守|证据|压力|解释|对上|昨晚|发言|投票|处决|验|跳|报/.test(entry)) ??
    sentences.find((entry) => entry.length > 8) ??
    sentences[0] ??
    "";
  const cleaned = reasonSentence.replace(/[。！？；\s]+$/u, "").trim();
  return cleaned.length > 52 ? `${cleaned.slice(0, 52)}...` : cleaned;
}

function nominationDefenseAwareVoteCoverage(rows) {
  const voteRows = rows.filter((row) => row.requiresNominationDefenseAwareVote);
  if (voteRows.length === 0) return 0;
  const coveredRows = voteRows.filter(hasNominationDefenseAwareVote);
  const coveredVotes = new Set(coveredRows.map((row) => String(!!row.expectedVote)));
  return Math.min(rate(coveredRows.length, voteRows.length), rate(["true", "false"].filter((vote) => coveredVotes.has(vote)).length, 2));
}

function nominationReasonAnchoredDefenseVoteCoverage(rows) {
  const voteRows = rows.filter((row) => row.requiresNominationDefenseAwareVote);
  if (voteRows.length === 0) return 0;
  const coveredRows = voteRows.filter(hasNominationReasonAnchoredDefenseVote);
  const coveredVotes = new Set(coveredRows.map((row) => String(!!row.expectedVote)));
  return Math.min(rate(coveredRows.length, voteRows.length), rate(["true", "false"].filter((vote) => coveredVotes.has(vote)).length, 2));
}

function nominationReasonAnchoredDefenseVoteLineDiversityCoverage(rows) {
  const voteRows = rows.filter((row) => row.requiresNominationDefenseAwareVote && hasNominationReasonAnchoredDefenseVote(row));
  if (voteRows.length === 0) return 0;
  const normalizedPrefixes = new Set(voteRows.map((row) => nominationDefenseVotePrefixKey(row)).filter(Boolean));
  const yesPrefixes = new Set(
    voteRows.filter((row) => row.expectedVote === true).map((row) => nominationDefenseVotePrefixKey(row)).filter(Boolean)
  );
  const noPrefixes = new Set(
    voteRows.filter((row) => row.expectedVote === false).map((row) => nominationDefenseVotePrefixKey(row)).filter(Boolean)
  );
  return Math.min(rate(normalizedPrefixes.size, 3), rate(yesPrefixes.size, 2), rate(noPrefixes.size, 2));
}

function nominationDefenseVotePrefixKey(row) {
  const line = row.voteRationale?.line ?? row.text ?? "";
  const prefix = line.split("。")[0] ?? "";
  return prefix
    .replace(/\d+号/g, "N号")
    .replace(/「[^」]+」/g, "「reason」")
    .trim();
}

function hasNominationDefenseAwareVote(row) {
  const line = row.voteRationale?.line ?? row.text ?? "";
  const defenseContext = row.voteRationale?.nominationDefenseContext ?? null;
  const expectedVote = !!row.expectedVote;
  return !!(
    row.source === "formal-vote" &&
    row.audience === "vote" &&
    row.voteRationale?.publicOnly === true &&
    defenseContext?.line &&
    /刚才.*防守/.test(line) &&
    (expectedVote
      ? /没把身份、信息或票型对上|这票继续落/.test(line)
      : /给了可复核方向|先降压不落票/.test(line))
  );
}

function hasNominationReasonAnchoredDefenseVote(row) {
  const line = row.voteRationale?.line ?? row.text ?? "";
  const defenseContext = row.voteRationale?.nominationDefenseContext ?? null;
  return !!(
    hasNominationDefenseAwareVote(row) &&
    defenseContext?.reasonLine &&
    /身份|信息|票型|防守|证据|压力|解释|对上|昨晚|发言|投票|处决|验|跳|报/.test(defenseContext.reasonLine) &&
    /提名理由/.test(line) &&
    line.includes(defenseContext.reasonLine)
  );
}

function crossScriptNominationDefenseAwareVoteCoverage(rows) {
  const voteRows = rows.filter((row) => row.requiresCrossScriptNominationDefenseAwareVote);
  if (voteRows.length === 0) return 0;
  const coveredRows = voteRows.filter(
    (row) => ["bmr", "snv"].includes(row.scriptId) && row.expectedScriptId === row.scriptId && hasNominationDefenseAwareVote(row)
  );
  const coveredCombos = new Set(coveredRows.map((row) => `${row.scriptId}:${!!row.expectedVote}`).filter(Boolean));
  const expectedCombos = ["bmr:true", "bmr:false", "snv:true", "snv:false"];
  return Math.min(rate(coveredRows.length, voteRows.length), rate(expectedCombos.filter((combo) => coveredCombos.has(combo)).length, expectedCombos.length));
}

function proactiveRationaleCoverage(rows) {
  const proactiveRows = rows.filter((row) => row.source === "proactive-private");
  if (proactiveRows.length === 0) return 1;
  const covered = proactiveRows.filter((row) => {
    const line = row.decisionRationale?.spokenLine;
    return !!(line && row.text.includes(line));
  }).length;
  return rate(covered, proactiveRows.length);
}

function voteIntentCoverage(rows) {
  const voteRows = rows.filter((row) => row.intent === "vote" || /投票|跟票|会不会跟|如果今天提/.test(row.prompt));
  if (voteRows.length === 0) return 1;
  const covered = voteRows.filter((row) => /投票|票型|跟票|反票|提名|回应|补不上/.test(row.text) && hasEvidenceCitation(row)).length;
  return rate(covered, voteRows.length);
}

function claimDisclosureRationaleCoverage(rows) {
  const claimRows = rows.filter((row) => row.requiresClaimDisclosureRationale || row.claimDisclosureRationale);
  if (claimRows.length === 0) return 1;
  const covered = claimRows.filter((row) => {
    const rationale = row.claimDisclosureRationale;
    const spokenLine = rationale?.spokenLine;
    const hiddenRoleLeak =
      rationale &&
      !rationale.canRevealRole &&
      !!(rationale.roleId || rationale.roleName || rationale.previousRoleId || rationale.previousRoleName);
    return !!(rationale?.kind === "claim-disclosure-rationale" && spokenLine && row.text.includes(spokenLine) && !hiddenRoleLeak);
  }).length;
  return rate(covered, claimRows.length);
}

function claimDisclosureContinuityCoverage(rows) {
  const continuityRows = rows.filter(
    (row) =>
      row.requiresClaimDisclosureContinuity ||
      (row.claimDisclosureRationale?.continuity && row.claimDisclosureRationale.continuity !== "new")
  );
  if (continuityRows.length === 0) return 0;
  const covered = continuityRows.filter((row) => {
    const rationale = row.claimDisclosureRationale;
    const continuity = rationale?.continuity ?? "";
    const reviseExplained =
      continuity !== "revise" ||
      !!(rationale.previousRoleId && rationale.previousRoleName && rationale.roleId && rationale.roleName && rationale.continuitySummary);
    return !!(
      rationale?.kind === "claim-disclosure-rationale" &&
      ["hold", "escalate", "revise"].includes(continuity) &&
      rationale.previousLevel &&
      rationale.previousLevel !== "none" &&
      rationale.continuityLine &&
      reviseExplained &&
      rationale.spokenLine &&
      row.text.includes(rationale.spokenLine)
    );
  }).length;
  return rate(covered, continuityRows.length);
}

function claimDisclosureContinuityModeCoverage(rows) {
  const modes = new Set(rows.map((row) => row.claimDisclosureRationale?.continuity).filter(Boolean));
  return rate(["hold", "escalate", "revise"].filter((mode) => modes.has(mode)).length, 3);
}

function claimDisclosureSurfaceDedupCoverage(rows) {
  const claimRows = rows.filter(
    (row) =>
      row.claimDisclosureRationale &&
      (row.requiresClaimDisclosureContinuity ||
        row.requiresCrossScriptClaimContinuity ||
        row.requiresRoleConstrainedClaimDisclosure)
  );
  if (claimRows.length === 0) return 0;
  const coveredRows = claimRows.filter((row) => {
    const text = compactSignal(row.text ?? "");
    const visibleRoleName = row.claimDisclosureRationale?.roleName ?? "";
    const repeatedPhrases = ["具体身份", "功能风险", "公开坐实", "死亡触发身份", visibleRoleName ? `明跳${visibleRoleName}` : ""]
      .map(compactSignal)
      .filter(Boolean);
    return repeatedPhrases.every((phrase) => countOccurrences(text, phrase) <= 1);
  });
  return rate(coveredRows.length, claimRows.length);
}

function claimDisclosureHoldLeadVariantCoverage(rows) {
  const holdRows = rows.filter(
    (row) => row.claimDisclosureRationale?.continuity === "hold" && row.claimDisclosureRationale?.continuityLine
  );
  if (holdRows.length === 0) return 0;
  const matchedRows = holdRows.filter((row) => {
    const line = row.claimDisclosureRationale?.continuityLine ?? "";
    const text = row.text ?? "";
    return (
      !OLD_CLAIM_DISCLOSURE_HOLD_LEAD_PATTERN.test(line) &&
      !OLD_CLAIM_DISCLOSURE_HOLD_LEAD_PATTERN.test(text) &&
      CLAIM_DISCLOSURE_HOLD_LEAD_PATTERNS.some((pattern) => pattern.test(line)) &&
      spokenLineAppearsInText(line, text)
    );
  });
  if (matchedRows.length !== holdRows.length) {
    return rate(matchedRows.length, holdRows.length);
  }
  const coveredLeads = new Set();
  const leadCounts = new Map();
  matchedRows.forEach((row) => {
    const line = row.claimDisclosureRationale?.continuityLine ?? "";
    const leadIndex = CLAIM_DISCLOSURE_HOLD_LEAD_PATTERNS.findIndex((pattern) => pattern.test(line));
    if (leadIndex >= 0) {
      coveredLeads.add(leadIndex);
      leadCounts.set(leadIndex, (leadCounts.get(leadIndex) ?? 0) + 1);
    }
  });
  const maxLeadCount = Math.max(...leadCounts.values());
  const maxAllowedLeadCount = Math.max(3, Math.ceil(matchedRows.length * 0.3));
  if (maxLeadCount > maxAllowedLeadCount) {
    return rate(maxAllowedLeadCount, maxLeadCount);
  }
  const requiredLeadCount = Math.min(5, holdRows.length);
  return rate(Math.min(coveredLeads.size, requiredLeadCount), requiredLeadCount);
}

function publicClaimHoldLeadVariantCoverage(rows) {
  const publicHoldRows = rows.filter(
    (row) =>
      row.audience === "public" &&
      row.claimDisclosureRationale?.publicOnly === true &&
      row.claimDisclosureRationale?.continuity === "hold" &&
      row.claimDisclosureRationale?.continuityLine
  );
  if (publicHoldRows.length === 0) return 0;
  const leadCounts = new Map();
  let matchedRows = 0;
  publicHoldRows.forEach((row) => {
    const line = row.claimDisclosureRationale?.continuityLine ?? "";
    const text = row.text ?? "";
    const leadIndex = CLAIM_DISCLOSURE_HOLD_LEAD_PATTERNS.findIndex((pattern) => pattern.test(line));
    if (leadIndex >= 0 && spokenLineAppearsInText(line, text)) {
      matchedRows += 1;
      leadCounts.set(leadIndex, (leadCounts.get(leadIndex) ?? 0) + 1);
    }
  });
  if (matchedRows !== publicHoldRows.length) {
    return rate(matchedRows, publicHoldRows.length);
  }
  const maxLeadCount = Math.max(0, ...leadCounts.values());
  const maxAllowedLeadCount = Math.max(4, Math.ceil(publicHoldRows.length * 0.22));
  if (maxLeadCount > maxAllowedLeadCount) {
    return rate(maxAllowedLeadCount, maxLeadCount);
  }
  const requiredLeadCount = Math.min(6, publicHoldRows.length);
  return rate(Math.min(leadCounts.size, requiredLeadCount), requiredLeadCount);
}

function claimDisclosureBalancedReasonVariantCoverage(rows) {
  const balancedRows = rows.filter(
    (row) => row.claimDisclosureRationale?.reasonKey === "balanced_disclosure" && row.claimDisclosureRationale?.line
  );
  if (balancedRows.length === 0) return 0;
  const matchedRows = balancedRows.filter((row) => {
    const line = row.claimDisclosureRationale?.line ?? "";
    const text = row.text ?? "";
    return (
      !OLD_CLAIM_DISCLOSURE_BALANCED_REASON_PATTERN.test(line) &&
      !OLD_CLAIM_DISCLOSURE_BALANCED_REASON_PATTERN.test(text) &&
      CLAIM_DISCLOSURE_BALANCED_REASON_PATTERNS.some((pattern) => pattern.test(line))
    );
  });
  if (matchedRows.length !== balancedRows.length) {
    return rate(matchedRows.length, balancedRows.length);
  }
  const visibleRows = matchedRows.filter((row) => (row.text ?? "").includes(row.claimDisclosureRationale?.line ?? ""));
  if (visibleRows.length === 0) {
    return 0;
  }
  const coveredReasons = new Set();
  visibleRows.forEach((row) => {
    const line = row.claimDisclosureRationale?.line ?? "";
    const reasonIndex = CLAIM_DISCLOSURE_BALANCED_REASON_PATTERNS.findIndex((pattern) => pattern.test(line));
    if (reasonIndex >= 0) {
      coveredReasons.add(reasonIndex);
    }
  });
  const requiredReasonCount = Math.min(3, visibleRows.length);
  return rate(Math.min(coveredReasons.size, requiredReasonCount), requiredReasonCount);
}

function crossScriptClaimDisclosureCoverage(rows) {
  const claimRows = rows.filter((row) => row.requiresCrossScriptClaimDisclosure);
  if (claimRows.length === 0) return 1;
  const covered = claimRows.filter((row) => {
    const text = row.text ?? "";
    const rationale = row.claimDisclosureRationale;
    return (
      ["bmr", "snv"].includes(row.scriptId) &&
      row.expectedScriptId === row.scriptId &&
      row.source === "private-whisper" &&
      row.intent === "claim" &&
      !!rationale?.line &&
      !!rationale?.level &&
      /身份|具体身份|口径|保留|公开|信息结论/.test(text)
    );
  }).length;
  const scriptCoverage = new Set(claimRows.map((row) => row.scriptId).filter(Boolean));
  const coveredScripts = ["bmr", "snv"].filter((scriptId) => scriptCoverage.has(scriptId)).length;
  return Math.min(rate(covered, claimRows.length), rate(coveredScripts, 2));
}

function privateScriptClaimDeflectCoverage(rows) {
  const claimRows = rows.filter(
    (row) =>
      row.requiresCrossScriptClaimDisclosure &&
      row.source === "private-whisper" &&
      row.intent === "claim" &&
      ["bmr", "snv"].includes(row.scriptId)
  );
  if (claimRows.length === 0) return 0;
  const covered = claimRows.filter((row) => {
    const text = row.text ?? "";
    const stillWithholding = /先不|不把|不裸|不急|保留|具体身份/.test(text);
    if (row.scriptId === "bmr") {
      return stillWithholding && /BMR|死亡|保护|复活|身份价值/.test(text);
    }
    if (row.scriptId === "snv") {
      return stillWithholding && /SnV|疯狂|身份口径|身份线|口径/.test(text);
    }
    return false;
  }).length;
  return rate(covered, claimRows.length);
}

function crossScriptClaimContinuityCoverage(rows) {
  const continuityRows = rows.filter((row) => row.requiresCrossScriptClaimContinuity);
  if (continuityRows.length === 0) return 0;
  const coveredRows = continuityRows.filter((row) => {
    const rationale = row.claimDisclosureRationale;
    const mode = row.expectedClaimContinuityMode ?? "";
    const continuity = rationale?.continuity ?? "";
    const reviseExplained =
      continuity !== "revise" ||
      !!(rationale.previousRoleId && rationale.previousRoleName && rationale.roleId && rationale.roleName && rationale.continuitySummary);
    return !!(
      ["bmr", "snv"].includes(row.scriptId) &&
      row.expectedScriptId === row.scriptId &&
      ["hold", "escalate", "revise"].includes(mode) &&
      continuity === mode &&
      rationale?.kind === "claim-disclosure-rationale" &&
      rationale.previousLevel &&
      rationale.previousLevel !== "none" &&
      rationale.continuityLine &&
      rationale.spokenLine &&
      row.text.includes(rationale.spokenLine) &&
      reviseExplained
    );
  });
  const coveredCombos = new Set(
    coveredRows.map((row) => `${row.scriptId}:${row.claimDisclosureRationale?.continuity ?? ""}`).filter(Boolean)
  );
  const requiredCombos = ["bmr:hold", "bmr:escalate", "bmr:revise", "snv:hold", "snv:escalate", "snv:revise"];
  return Math.min(rate(coveredRows.length, continuityRows.length), rate(requiredCombos.filter((combo) => coveredCombos.has(combo)).length, requiredCombos.length));
}

const ROLE_CONSTRAINT_REASON_KEYS = [
  "madness_pressure_cover",
  "outsider_execution_risk",
  "mutant_outsider_claim_risk",
  "sweetheart_death_drunk_risk",
  "barber_swap_timing",
  "death_trigger_timing",
];

const ROLE_CONSTRAINT_TEXT_PATTERN = /公开口径|身份线|外来者|免费出处决|死亡触发|夜里|功能风险|醉酒风险|换位窗口|触发时机/;

function roleConstrainedClaimDisclosureCoverage(rows) {
  const claimRows = rows.filter((row) => row.requiresRoleConstrainedClaimDisclosure);
  if (claimRows.length === 0) return 0;
  const coveredRows = claimRows.filter((row) => {
    const rationale = row.claimDisclosureRationale;
    const reasonKey = rationale?.reasonKey ?? "";
    const spokenLine = rationale?.spokenLine ?? "";
    return !!(
      ["tb", "bmr", "snv"].includes(row.scriptId) &&
      row.expectedScriptId === row.scriptId &&
      ROLE_CONSTRAINT_REASON_KEYS.includes(reasonKey) &&
      reasonKey === row.expectedRoleConstraintReason &&
      row.source === "claim-disclosure-fixture" &&
      row.audience === "public" &&
      rationale?.kind === "claim-disclosure-rationale" &&
      rationale.publicOnly === true &&
      rationale.canRevealRole === false &&
      !rationale.roleId &&
      !rationale.roleName &&
      rationale.level !== "hard" &&
      spokenLine &&
      row.text.includes(spokenLine) &&
      ROLE_CONSTRAINT_TEXT_PATTERN.test(row.text)
    );
  });
  const coveredReasons = new Set(coveredRows.map((row) => row.claimDisclosureRationale?.reasonKey).filter(Boolean));
  return Math.min(
    rate(coveredRows.length, claimRows.length),
    rate(ROLE_CONSTRAINT_REASON_KEYS.filter((reasonKey) => coveredReasons.has(reasonKey)).length, ROLE_CONSTRAINT_REASON_KEYS.length)
  );
}

function roleConstrainedClaimLineDiversityCoverage(rows) {
  const claimRows = rows.filter((row) => row.requiresRoleConstrainedClaimDisclosure);
  if (claimRows.length === 0) return 0;
  const openingStems = claimRows.map((row) => sentenceStems(row.text)[0]).filter(Boolean);
  if (openingStems.length === 0) return 0;
  return rate(new Set(openingStems).size, claimRows.length);
}

function crossScriptPublicReasoningCoverage(rows) {
  const publicRows = rows.filter((row) => row.requiresCrossScriptPublicReasoning);
  if (publicRows.length === 0) return 0;
  const covered = publicRows.filter((row) => {
    const text = compactSignal(cleanClippedPublicEvidenceFragments(row.text));
    const spokenLine = compactSignal(row.decisionRationale?.spokenLine);
    return (
      ["bmr", "snv"].includes(row.scriptId) &&
      row.expectedScriptId === row.scriptId &&
      row.source === "public-discussion" &&
      row.audience === "public" &&
      row.decisionRationale?.focusId === row.focusId &&
      !!spokenLine &&
      text.includes(spokenLine.slice(0, Math.min(10, spokenLine.length))) &&
      !!row.focusName &&
      text.includes(compactSignal(row.focusName)) &&
      publicTextIncludesEvidenceSignal(row.text, row.evidenceSpokenText, 10) &&
      /回应|解释|身份|昨晚信息|投票|证据/.test(row.text ?? "") &&
      !PUBLIC_SURFACE_POLISH_ARTIFACT_PATTERN.test(row.text ?? "")
    );
  }).length;
  const scriptCoverage = new Set(publicRows.map((row) => row.scriptId).filter(Boolean));
  const coveredScripts = ["bmr", "snv"].filter((scriptId) => scriptCoverage.has(scriptId)).length;
  return Math.min(rate(covered, publicRows.length), rate(coveredScripts, 2));
}

function crossScriptPublicMultiEvidenceCoverage(rows) {
  const publicRows = rows.filter((row) => row.requiresCrossScriptPublicMultiEvidence);
  if (publicRows.length === 0) return 0;
  const covered = publicRows.filter((row) => {
    const text = row.text ?? "";
    const cleanText = compactSignal(cleanClippedPublicEvidenceFragments(text));
    return (
      ["bmr", "snv"].includes(row.scriptId) &&
      row.expectedScriptId === row.scriptId &&
      row.source === "public-discussion" &&
      row.audience === "public" &&
      (row.decisionRationale?.focusEvidenceCount ?? 0) >= 2 &&
      (row.evidenceSummaries?.length ?? 0) >= 2 &&
      !!row.focusName &&
      cleanText.includes(compactSignal(row.focusName)) &&
      publicTextIncludesEvidenceSignal(text, row.evidenceSpokenText, 10) &&
      PUBLIC_MULTI_EVIDENCE_COMPRESSION_PATTERN.test(text) &&
      /身份和昨晚信息|再补昨晚信息|补清，再说昨晚信息|解释/.test(text) &&
      !PUBLIC_SURFACE_POLISH_ARTIFACT_PATTERN.test(text)
    );
  }).length;
  const scriptCoverage = new Set(publicRows.map((row) => row.scriptId).filter(Boolean));
  const coveredScripts = ["bmr", "snv"].filter((scriptId) => scriptCoverage.has(scriptId)).length;
  return Math.min(rate(covered, publicRows.length), rate(coveredScripts, 2));
}

function crossScriptPrivateMultiEvidenceCoverage(rows) {
  const privateRows = rows.filter((row) => row.requiresCrossScriptPrivateMultiEvidence);
  if (privateRows.length === 0) return 0;
  const compactWithoutPunctuation = (value) => compactSignal(value).replace(/[，。！？；：、,.!?;:]/gu, "");
  const covered = privateRows.filter((row) => {
    const text = row.text ?? "";
    const cleanText = compactWithoutPunctuation(text);
    const cleanEvidence = compactWithoutPunctuation(row.evidenceSpokenText);
    const chainTypes = new Set((row.evidenceGraphChains ?? []).map((chain) => chain.type).filter(Boolean));
    return (
      ["bmr", "snv"].includes(row.scriptId) &&
      row.expectedScriptId === row.scriptId &&
      row.source === "private-whisper" &&
      row.audience === "private" &&
      row.intent === "reason" &&
      (row.decisionRationale?.focusEvidenceCount ?? 0) >= 2 &&
      (row.evidenceSummaries?.length ?? 0) >= 2 &&
      chainTypes.has("false-claim-chain") &&
      chainTypes.has("public-accuse-chain") &&
      !!row.focusName &&
      cleanText.includes(compactSignal(row.focusName)) &&
      !!cleanEvidence &&
      cleanText.includes(cleanEvidence.slice(0, Math.min(10, cleanEvidence.length))) &&
      PUBLIC_MULTI_EVIDENCE_COMPRESSION_PATTERN.test(text) &&
      /身份对不上|推低证据位/.test(text)
    );
  }).length;
  const scriptCoverage = new Set(privateRows.map((row) => row.scriptId).filter(Boolean));
  const coveredScripts = ["bmr", "snv"].filter((scriptId) => scriptCoverage.has(scriptId)).length;
  return Math.min(rate(covered, privateRows.length), rate(coveredScripts, 2));
}

function privateEvidenceSynthesisCoverage(rows) {
  const privateRows = rows.filter(
    (row) => row.requiresCrossScriptPrivateMultiEvidence || row.requiresPrivateEvidenceSynthesisVariant
  );
  if (privateRows.length === 0) return 0;
  return rate(privateRows.filter((row) => PRIVATE_EVIDENCE_SYNTHESIS_PATTERN.test(row.text ?? "")).length, privateRows.length);
}

function privateEvidenceSynthesisVariantCoverage(rows) {
  const privateRows = rows.filter((row) => row.requiresPrivateEvidenceSynthesisVariant);
  if (privateRows.length === 0) return 0;
  const covered = privateRows.filter((row) => {
    const pattern = PRIVATE_EVIDENCE_SYNTHESIS_VARIANT_PATTERNS[row.expectedPrivateEvidenceSynthesisMode];
    return (
      row.source === "private-whisper" &&
      row.audience === "private" &&
      row.intent === "reason" &&
      !!row.focusName &&
      (row.text ?? "").includes(row.focusName) &&
      (row.evidenceSummaries?.length ?? 0) >= 2 &&
      !!pattern &&
      pattern.test(row.text ?? "") &&
      !EVIL_ONLY_LANGUAGE_PATTERN.test(row.text ?? "")
    );
  }).length;
  const coveredModes = new Set(
    privateRows
      .filter((row) => PRIVATE_EVIDENCE_SYNTHESIS_VARIANT_PATTERNS[row.expectedPrivateEvidenceSynthesisMode]?.test(row.text ?? ""))
      .map((row) => row.expectedPrivateEvidenceSynthesisMode)
      .filter(Boolean)
  );
  return Math.min(
    rate(covered, privateRows.length),
    rate(
      ["identity-low-evidence", "identity-vote", "identity-night-info", "protection-vote", "source-identity"].filter((mode) =>
        coveredModes.has(mode)
      ).length,
      5
    )
  );
}

function privateEvidenceSynthesisVerificationCoverage(rows) {
  const privateRows = rows.filter((row) => row.requiresPrivateEvidenceSynthesisVariant);
  if (privateRows.length === 0) return 0;
  return rate(
    privateRows.filter((row) => {
      const pattern = PRIVATE_EVIDENCE_SYNTHESIS_VERIFICATION_PATTERNS[row.expectedPrivateEvidenceSynthesisMode];
      return !!pattern && pattern.test(row.decisionRationale?.verificationLine ?? "");
    }).length,
    privateRows.length
  );
}

function privateEvidenceSynthesisSpokenVerificationCoverage(rows) {
  const privateRows = rows.filter((row) => row.requiresPrivateEvidenceSynthesisVariant);
  if (privateRows.length === 0) return 0;
  return rate(
    privateRows.filter((row) => {
      const pattern = PRIVATE_EVIDENCE_SYNTHESIS_SPOKEN_VERIFICATION_PATTERNS[row.expectedPrivateEvidenceSynthesisMode];
      return !!pattern && pattern.test(row.text ?? "");
    }).length,
    privateRows.length
  );
}

function privateEvidenceSynthesisSourceIdentityDedupCoverage(rows) {
  const privateRows = rows.filter(
    (row) =>
      row.requiresPrivateEvidenceSynthesisVariant &&
      row.expectedPrivateEvidenceSynthesisMode === "source-identity"
  );
  if (privateRows.length === 0) return 0;
  return rate(
    privateRows.filter((row) => {
      const text = compactSignal(row.text ?? "");
      return countOccurrences(text, "来源不稳") <= 1 && countOccurrences(text, "再对一下") <= 1;
    }).length,
    privateRows.length
  );
}

function privateEvidenceSynthesisVoteTaxonomyDedupCoverage(rows) {
  const privateRows = rows.filter(
    (row) =>
      row.requiresPrivateEvidenceSynthesisVariant &&
      row.expectedPrivateEvidenceSynthesisMode === "protection-vote"
  );
  if (privateRows.length === 0) return 0;
  const repeatedTaxonomyPhrases = ["自保", "跟风", "主动推人"];
  return rate(
    privateRows.filter((row) => {
      const text = compactSignal(row.text ?? "");
      return repeatedTaxonomyPhrases.every((phrase) => countOccurrences(text, phrase) <= 1);
    }).length,
    privateRows.length
  );
}

function privateSurfaceReportDisciplineCoverage(rows) {
  const privateRows = rows.filter(
    (row) =>
      ["private-whisper", "proactive-private", "ai-ai-private"].includes(row.source) &&
      row.audience === "private" &&
      row.decisionRationale?.focusId
  );
  if (privateRows.length === 0) return 1;
  return rate(privateRows.filter((row) => !PRIVATE_SURFACE_REPORT_LABEL_PATTERN.test(row.text ?? "")).length, privateRows.length);
}

function hasPrivateReasonOpeningRedundancy(row) {
  return /^我先看\s*(\d+号)。(?=[\s\S]{0,120}(?:我先排\s*\1|\1\s*是当前最可处理的位置|\1这边|\1\s*先放主线|先处理\s*\1|\1\s*先排前面))/u.test(
    row.text ?? ""
  );
}

function privateReasonOpeningRedundancyCoverage(rows) {
  const privateRows = rows.filter(
    (row) =>
      row.source === "private-whisper" &&
      row.audience === "private" &&
      row.intent === "reason" &&
      row.decisionRationale?.focusId
  );
  if (privateRows.length === 0) return 0;
  return rate(privateRows.filter((row) => !hasPrivateReasonOpeningRedundancy(row)).length, privateRows.length);
}

const PRIVATE_REASON_OPENING_SENTENCE_CAPTURE =
  /^(先给结论：(?:我先不把话说死|我先看这条，但不锁死|我先点这条，但不把话说死|我暂时不换目标，先放主线)|我先不把话说死，先说排序|这条我先看，但不锁死|我先点这条，先别当铁证|我暂时不换目标，先放主线|先把排序说清，但不拍死|我先按主线排，不当铁证|先给你一个暂定排序|这条先当主线，不急着拍死)[。！？]/u;
const PRIVATE_REASON_OPENING_LEAD_CAPTURE =
  /^(先给结论|我先不把话说死|这条我先看|我先点这条|我暂时不换目标|先把排序说清|我先按主线排|先给你一个暂定排序|这条先当主线)/u;
const PRIVATE_RUNNER_UP_COMPARISON_LINE_VARIANT_PATTERNS = [
  /我先排\d+号不是放过\d+号\d+号这边(?:我可见的|公开)线索更多/u,
  /\d+号不是放掉只是\d+号这边(?:我可见的|公开)证据更成组先排前面/u,
  /\d+号先放主线\d+号留在第二层现在(?:我可见的|公开)线索更多压在\d+号/u,
  /先处理\d+号不是清掉\d+号\d+号这边(?:我可见的|公开)证据更集中/u,
  /和\d+号比\d+号现在压力更集中\d+号有线索但先排第二/u,
  /\d+号线索不少但\d+号的压力更贴当前桌面先放前面/u,
  /我不是忽略\d+号只是\d+号的分数已经拉开先验\d+号/u,
  /\d+号和\d+号差距不大我先处理更容易被追问验证的\d+号/u,
  /\d+号和\d+号贴得很近先问\d+号是因为这条更快能被回应验证/u,
  /\d+号还在视野里但\d+号这条更适合先拿来校验/u,
  /和\d+号比我先把\d+号放前面\d+号暂时排第二/u,
  /\d+号先排前面\d+号不出视野等\d+号回应后再重排/u,
  /我先看\d+号\d+号先记在后手位这轮先验证更靠前的压力点/u,
];

function normalizedPrivateRunnerUpComparisonLine(line = "") {
  return compactSignal(line).replace(/[，。；：、！？]/gu, "");
}

function privateReasonOpeningRows(rows) {
  return rows.filter(
    (row) =>
      row.source === "private-whisper" &&
      row.audience === "private" &&
      row.intent === "reason" &&
      PRIVATE_REASON_OPENING_SENTENCE_CAPTURE.test(row.text ?? "")
  );
}

function privateReasonOpeningVariantCoverage(rows) {
  const bridgeRows = privateReasonOpeningRows(rows);
  if (bridgeRows.length === 0) return 0;
  const variants = new Set(
    bridgeRows
      .map((row) => (row.text ?? "").match(PRIVATE_REASON_OPENING_SENTENCE_CAPTURE)?.[0] ?? "")
      .filter(Boolean)
  );
  const requiredVariantCount = Math.min(5, bridgeRows.length);
  return rate(Math.min(variants.size, requiredVariantCount), requiredVariantCount);
}

function privateReasonOpeningLeadVariantCoverage(rows) {
  const bridgeRows = privateReasonOpeningRows(rows);
  if (bridgeRows.length === 0) return 0;
  const leadCounts = new Map();
  bridgeRows.forEach((row) => {
    const lead = (row.text ?? "").match(PRIVATE_REASON_OPENING_LEAD_CAPTURE)?.[1] ?? "";
    if (lead) {
      leadCounts.set(lead, (leadCounts.get(lead) ?? 0) + 1);
    }
  });
  const leads = new Set(leadCounts.keys());
  const requiredLeadCount = Math.min(5, bridgeRows.length);
  const maxCount = Math.max(0, ...leadCounts.values());
  const dominanceLimit = Math.max(2, Math.ceil(bridgeRows.length * 0.35));
  return Math.min(
    rate(Math.min(leads.size, requiredLeadCount), requiredLeadCount),
    rate(bridgeRows.filter((row) => !/^先给结论：/.test(row.text ?? "")).length, bridgeRows.length),
    maxCount <= dominanceLimit ? 1 : 0
  );
}

function privateReasonOpeningSentenceCoverage(rows) {
  const bridgeRows = privateReasonOpeningRows(rows);
  if (bridgeRows.length === 0) return 0;
  return rate(
    bridgeRows.filter((row) => PRIVATE_REASON_OPENING_SENTENCE_CAPTURE.test(row.text ?? "")).length,
    bridgeRows.length
  );
}

function privateRunnerUpComparisonLineVariantCoverage(rows) {
  const comparisonRows = rows.filter(
    (row) => row.audience === "private" && row.decisionRationale?.runnerUpName && row.decisionRationale?.line
  );
  if (comparisonRows.length === 0) return 0;
  const variantIndexes = comparisonRows.map((row) => {
    const line = normalizedPrivateRunnerUpComparisonLine(row.decisionRationale?.line ?? "");
    return PRIVATE_RUNNER_UP_COMPARISON_LINE_VARIANT_PATTERNS.findIndex((pattern) => pattern.test(line));
  });
  const recognizedCoverage = rate(variantIndexes.filter((index) => index !== -1).length, comparisonRows.length);
  const variants = new Set(variantIndexes.filter((index) => index !== -1));
  const variantCoverage = rate(Math.min(variants.size, 6), 6);
  const oldTemplateCount = variantIndexes.filter((index) => index === 0).length;
  const oldTemplateDiscipline =
    oldTemplateCount <= Math.max(4, Math.floor(comparisonRows.length * 0.25)) ? 1 : 0;
  const variantCounts = new Map();
  variantIndexes
    .filter((index) => index !== -1)
    .forEach((index) => variantCounts.set(index, (variantCounts.get(index) ?? 0) + 1));
  const maxVariantCount = Math.max(0, ...variantCounts.values());
  const dominanceDiscipline =
    maxVariantCount <= Math.max(5, Math.ceil(comparisonRows.length * 0.3)) ? 1 : 0;
  return Math.min(recognizedCoverage, variantCoverage, oldTemplateDiscipline, dominanceDiscipline);
}

function privateVerificationLeadNaturalizationCoverage(rows) {
  const verificationRows = rows.filter(
    (row) => {
      const text = row.text ?? "";
      return (
        row.source === "private-whisper" &&
        row.audience === "private" &&
        row.intent === "reason" &&
        !!row.decisionRationale?.verificationLine &&
        (row.requiresPrivateEvidenceSynthesisVariant || /(?:验证点是|先听|先核|这条先问|这条先让)/u.test(text))
      );
    }
  );
  if (verificationRows.length === 0) return 0;
  return rate(
    verificationRows.filter((row) => {
      const text = row.text ?? "";
      return !/验证点是/u.test(text) && /(?:先听|先核|这条先问|这条先让)/u.test(text);
    }).length,
    verificationRows.length
  );
}

function spokenRationaleLine(line = "") {
  return oneLine(line).replace(/^(验证点|判定标准|证据联动|压力档位|反证|桌面风险|信息收益|桌面反应|时机窗口|世界分支|票面联盟|来源可靠度|时间线一致性|动机归因|举证责任|追问顺序|行动门槛|记忆连续性|表达纪律|不确定性|证据新鲜度|证伪检查|因果链|前提审计|机制敏感性|角色假说)\s*[：:]\s*/u, "");
}

function naturalizedSpokenTimelineLine(line = "") {
  return spokenRationaleLine(line)
    .replace(/(\d+号)\s+和\s+(\d+号)/gu, "$1和$2")
    .replace(/(\d+号和\d+号)\s+/gu, "$1")
    .replace(/(\d+号)\s+的/gu, "$1的")
    .replace(/^(\d+号和\d+号)贴线时，?先看/u, "再看");
}

function naturalizedSpokenIncentiveLine(line = "") {
  return spokenRationaleLine(line)
    .replace(/(\d+号)\s+和\s+(\d+号)/gu, "$1和$2")
    .replace(/(\d+号和\d+号)\s+/gu, "$1")
    .replace(/(\d+号)\s+的/gu, "$1的")
    .replace(/^(\d+号和\d+号)贴线时，?/u, "动机上再分");
}

function naturalizedSpokenBurdenLine(line = "") {
  return spokenRationaleLine(line)
    .replace(/(\d+号)\s+和\s+(\d+号)/gu, "$1和$2")
    .replace(/(\d+号和\d+号)\s+/gu, "$1")
    .replace(/(\d+号)\s+的/gu, "$1的")
    .replace(/^(\d+号和\d+号)贴线时，?/u, "举证上");
}

function compressedSpokenSourceLine(line = "") {
  const value = spokenRationaleLine(line)
    .replace(/(\d+号)\s+和\s+(\d+号)/gu, "$1和$2")
    .replace(/(\d+号和\d+号)\s+/gu, "$1")
    .replace(/(\d+号)\s+的/gu, "$1的");
  const pair = value.match(/^(\d+号和\d+号)贴线时先看谁有独立来源/u)?.[1] ?? "";
  if (pair) {
    return `${pair}的来源和时间线一起看：先看谁有独立来源`;
  }
  const voteSeat = value.match(/^(\d+号)的票型证据要区分/u)?.[1] ?? "";
  if (voteSeat) {
    return `${voteSeat}的来源和时间线一起看：票型先分自保、跟票还是主动推人，同源跟票不当第二来源`;
  }
  return "";
}

function compressedSpokenTimelineLine(line = "") {
  const value = spokenRationaleLine(line)
    .replace(/(\d+号)\s+和\s+(\d+号)/gu, "$1和$2")
    .replace(/(\d+号和\d+号)\s+/gu, "$1")
    .replace(/(\d+号)\s+的/gu, "$1的");
  const pair = value.match(/^(\d+号和\d+号)贴线时，?先看/u)?.[1] ?? "";
  if (pair) {
    return `${pair}的来源和时间线一起看：先看谁有独立来源，身份、票型和回应先后是否自洽`;
  }
  const voteSeat = value.match(/^(\d+号)的投票要看/u)?.[1] ?? "";
  if (voteSeat) {
    return `${voteSeat}的来源和时间线一起看：票型先分自保、跟票还是主动推人，同源跟票不当第二来源；先上票后补理由更吃压力`;
  }
  return "";
}

function compressedSpokenIncentiveLine(line = "") {
  const value = spokenRationaleLine(line)
    .replace(/(\d+号)\s+和\s+(\d+号)/gu, "$1和$2")
    .replace(/(\d+号和\d+号)\s+/gu, "$1")
    .replace(/(\d+号)\s+的/gu, "$1的");
  const pair = value.match(/^(\d+号和\d+号)贴线时，?谁更像解桌、谁更像护人或转移压力/u)?.[1] ?? "";
  if (pair) {
    return `${pair}的动机和举证一起看：谁更像解桌、护人或转移压力`;
  }
  const voteSeat = value.match(/^(\d+号)的票型要拆成/u)?.[1] ?? "";
  if (voteSeat) {
    return `${voteSeat}的动机和举证一起看：这票是自保、跟风还是主动推人`;
  }
  return "";
}

function compressedSpokenBurdenLine(line = "") {
  const value = spokenRationaleLine(line)
    .replace(/(\d+号)\s+和\s+(\d+号)/gu, "$1和$2")
    .replace(/(\d+号和\d+号)\s+/gu, "$1")
    .replace(/(\d+号)\s+的/gu, "$1的");
  const pair = value.match(/^(\d+号和\d+号)贴线时，?两边支持者/u)?.[1] ?? "";
  if (pair) {
    return `${pair}的动机和举证一起看：谁更像解桌、护人或转移压力，两边支持者谁能说清身份、票型或发言理由`;
  }
  const voteSeat = value.match(/^(\d+号)的投票理由要由本人讲清/u)?.[1] ?? "";
  if (voteSeat) {
    return `${voteSeat}的动机和举证一起看：这票是自保、跟风还是主动推人，本人和跟票者都要说清理由`;
  }
  return "";
}

const PRIVATE_SOURCE_TIMELINE_HEADING_PATTERN =
  /(?:来源和时间线一起看|来源和节奏合起来|这条线先拆来源|这票先拆来源|这边先看投票先后|这边先看回应先后|先分来源再看节奏|这条先按来源拆开|先对来源独立性|先分票源和节奏|这票先看谁先动手)/u;
const PRIVATE_SOURCE_TIMELINE_HEADING_CAPTURE =
  /(来源和时间线一起看|来源和节奏合起来|这条线先拆来源|这票先拆来源|这边先看投票先后|这边先看回应先后|先分来源再看节奏|这条先按来源拆开|先对来源独立性|先分票源和节奏|这票先看谁先动手)：([^。！？]+)/gu;
const PRIVATE_MOTIVE_BURDEN_HEADING_PATTERN =
  /(?:动机和举证一起看|动机和理由合起来|票面动机要拆开|再看票的收益|再看举证负担|再看收益和举证|收益线要拆开|再分动机和举证|最后看谁该说明|最后落到责任)/u;
const PRIVATE_MOTIVE_BURDEN_HEADING_CAPTURE =
  /(动机和举证一起看|动机和理由合起来|票面动机要拆开|再看票的收益|再看举证负担|再看收益和举证|收益线要拆开|再分动机和举证|最后看谁该说明|最后落到责任)：([^。！？]+)/gu;

function hasPrivateSourceTimelineHeading(text = "") {
  return PRIVATE_SOURCE_TIMELINE_HEADING_PATTERN.test(text);
}

function hasPrivateMotiveBurdenHeading(text = "") {
  return PRIVATE_MOTIVE_BURDEN_HEADING_PATTERN.test(text);
}

function privateDeepReasoningSegments(text = "") {
  return [
    ...[...`${text ?? ""}`.matchAll(PRIVATE_SOURCE_TIMELINE_HEADING_CAPTURE)].map((match) => `${match[1]}：${match[2]}`),
    ...[...`${text ?? ""}`.matchAll(PRIVATE_MOTIVE_BURDEN_HEADING_CAPTURE)].map((match) => `${match[1]}：${match[2]}`),
  ];
}

function privateDeepReasoningSpokenCoverage(rows) {
  const privateRows = rows.filter(
    (row) =>
      row.source === "private-whisper" &&
      row.audience === "private" &&
      row.intent === "reason" &&
      !!row.decisionRationale?.sourceReliabilityLine
  );
  if (privateRows.length === 0) return 0;
  return rate(
    privateRows.filter((row) => {
      const text = compactSignal(row.text ?? "");
      const line = compactSignal(spokenRationaleLine(row.decisionRationale?.sourceReliabilityLine ?? ""));
      const compressedLine = compactSignal(compressedSpokenSourceLine(row.decisionRationale?.sourceReliabilityLine ?? ""));
      const compressedPresent =
        hasPrivateSourceTimelineHeading(row.text ?? "") &&
        /独立来源|同源|回声|第二来源|降权|票源|独立上票|独立复核|互相复述|独立信息|来源独立性|彼此托住|互相借力|事后跟票|拆开算/.test(row.text ?? "");
      return (
        !!line &&
        (text.includes(line) || (!!compressedLine && text.includes(compressedLine)) || compressedPresent) &&
        /独立来源|同源|回声|可复核|复核|降权|私下入口|单点证据|票源|独立上票|独立信息|来源独立性|互相复述|彼此托住|互相借力|事后跟票|拆开算/.test(row.text ?? "") &&
        !PRIVATE_SURFACE_REPORT_LABEL_PATTERN.test(row.text ?? "")
      );
    }).length,
    privateRows.length
  );
}

function privateTimelineReasoningSpokenCoverage(rows) {
  const privateRows = rows.filter(
    (row) =>
      row.source === "private-whisper" &&
      row.audience === "private" &&
      row.intent === "reason" &&
      !!row.decisionRationale?.timelineConsistencyLine
  );
  if (privateRows.length === 0) return 0;
  return rate(
    privateRows.filter((row) => {
      const text = compactSignal(row.text ?? "");
      const rawLine = compactSignal(spokenRationaleLine(row.decisionRationale?.timelineConsistencyLine ?? ""));
      const naturalLine = compactSignal(naturalizedSpokenTimelineLine(row.decisionRationale?.timelineConsistencyLine ?? ""));
      const compressedLine = compactSignal(compressedSpokenTimelineLine(row.decisionRationale?.timelineConsistencyLine ?? ""));
      const compressedPresent =
        hasPrivateSourceTimelineHeading(row.text ?? "") &&
        /时间线|先后|回应|解释顺序|解释晚于上票|先上票|补理由|补解释|节奏|谁先动手|先有理由|事后跟票|跟着补理由|跟着补话/.test(row.text ?? "");
      return (
        !!rawLine &&
        (text.includes(rawLine) || (!!naturalLine && text.includes(naturalLine)) || (!!compressedLine && text.includes(compressedLine)) || compressedPresent) &&
        /时间线|先后|顺序|先报|改口|事后|节点|本轮|跨日|回应|解释前|解释后|先上票|补理由|节奏|先有理由|事后跟票|跟着补理由|跟着补话/.test(row.text ?? "") &&
        !PRIVATE_SURFACE_REPORT_LABEL_PATTERN.test(row.text ?? "")
      );
    }).length,
    privateRows.length
  );
}

function privateSourceTimelineCompressionCoverage(rows) {
  const privateRows = rows.filter(
    (row) =>
      row.source === "private-whisper" &&
      row.audience === "private" &&
      row.intent === "reason" &&
      !!row.decisionRationale?.sourceReliabilityLine &&
      !!row.decisionRationale?.timelineConsistencyLine
  );
  if (privateRows.length === 0) return 0;
  return rate(
    privateRows.filter((row) => {
      const text = row.text ?? "";
      return (
        hasPrivateSourceTimelineHeading(text) &&
        /独立来源|同源|回声|第二来源|降权|票源|独立上票|独立复核|互相复述|独立信息|来源独立性|彼此托住|互相借力|事后跟票|拆开算/.test(text) &&
        /时间线|先后|回应|解释前|解释后|先上票|补理由|节奏|谁先动手|先有理由|事后跟票|跟着补理由|跟着补话/.test(text) &&
        !PRIVATE_SURFACE_REPORT_LABEL_PATTERN.test(text)
      );
    }).length,
    privateRows.length
  );
}

function privateIncentiveReasoningSpokenCoverage(rows) {
  const privateRows = rows.filter(
    (row) =>
      row.source === "private-whisper" &&
      row.audience === "private" &&
      row.intent === "reason" &&
      !!row.decisionRationale?.incentiveAlignmentLine
  );
  if (privateRows.length === 0) return 0;
  return rate(
    privateRows.filter((row) => {
      const text = compactSignal(row.text ?? "");
      const rawLine = compactSignal(spokenRationaleLine(row.decisionRationale?.incentiveAlignmentLine ?? ""));
      const naturalLine = compactSignal(naturalizedSpokenIncentiveLine(row.decisionRationale?.incentiveAlignmentLine ?? ""));
      const compressedLine = compactSignal(compressedSpokenIncentiveLine(row.decisionRationale?.incentiveAlignmentLine ?? ""));
      const compressedPresent =
        hasPrivateMotiveBurdenHeading(row.text ?? "") &&
        /动机|解桌|护人|转移压力|转压|自保|跟风|主动推人|收益|受益|票面动机/.test(row.text ?? "");
      return (
        !!rawLine &&
        (text.includes(rawLine) || (!!naturalLine && text.includes(naturalLine)) || (!!compressedLine && text.includes(compressedLine)) || compressedPresent) &&
        /动机|收益|解桌|护人|转移压力|转压|自保|跟风|主动推人|受益|压力方向|票面动机/.test(row.text ?? "") &&
        !PRIVATE_SURFACE_REPORT_LABEL_PATTERN.test(row.text ?? "")
      );
    }).length,
    privateRows.length
  );
}

function privateBurdenReasoningSpokenCoverage(rows) {
  const privateRows = rows.filter(
    (row) =>
      row.source === "private-whisper" &&
      row.audience === "private" &&
      row.intent === "reason" &&
      !!row.decisionRationale?.burdenOfProofLine
  );
  if (privateRows.length === 0) return 0;
  return rate(
    privateRows.filter((row) => {
      const text = compactSignal(row.text ?? "");
      const rawLine = compactSignal(spokenRationaleLine(row.decisionRationale?.burdenOfProofLine ?? ""));
      const naturalLine = compactSignal(naturalizedSpokenBurdenLine(row.decisionRationale?.burdenOfProofLine ?? ""));
      const compressedLine = compactSignal(compressedSpokenBurdenLine(row.decisionRationale?.burdenOfProofLine ?? ""));
      const compressedPresent =
        hasPrivateMotiveBurdenHeading(row.text ?? "") &&
        /举证|支持者|跟票者|本人|说清|理由|空跟|给理由|举证负担|公开理由|可复核理由|责任|交理由|推给别人/.test(row.text ?? "");
      return (
        !!rawLine &&
        (text.includes(rawLine) || (!!naturalLine && text.includes(naturalLine)) || (!!compressedLine && text.includes(compressedLine)) || compressedPresent) &&
        /举证|支持者|跟票者|护航|回答|解释|给理由|公开理由|本人讲清|说清|没人给理由|责任|交理由|推给别人|主疑点|可复核理由/.test(row.text ?? "") &&
        !PRIVATE_SURFACE_REPORT_LABEL_PATTERN.test(row.text ?? "")
      );
    }).length,
    privateRows.length
  );
}

function privateDeepReasoningCompressionCoverage(rows) {
  const privateRows = rows.filter(
    (row) =>
      row.source === "private-whisper" &&
      row.audience === "private" &&
      row.intent === "reason" &&
      !!row.decisionRationale?.incentiveAlignmentLine &&
      !!row.decisionRationale?.burdenOfProofLine
  );
  if (privateRows.length === 0) return 0;
  return rate(
    privateRows.filter((row) => {
      const text = row.text ?? "";
      return (
        hasPrivateMotiveBurdenHeading(text) &&
        /解桌|自保|跟风|主动推人|护人|转移压力|转压|收益|受益|票面动机/.test(text) &&
        /支持者|跟票者|本人|说清|理由|举证|责任|交理由|可复核理由|推给别人/.test(text) &&
        !PRIVATE_SURFACE_REPORT_LABEL_PATTERN.test(text)
      );
    }).length,
    privateRows.length
  );
}

function normalizedPrivateDeepCompressionVariant(line = "") {
  return `${line ?? ""}`
    .replace(/\d+号(?:和\d+号)?/gu, "#号")
    .replace(/\s+/g, "")
    .trim();
}

function privateDeepReasoningCompressionVariantCoverage(rows) {
  const privateRows = rows.filter(
    (row) =>
      row.source === "private-whisper" &&
      row.audience === "private" &&
      row.intent === "reason" &&
      !!row.decisionRationale?.sourceReliabilityLine &&
      !!row.decisionRationale?.timelineConsistencyLine &&
      !!row.decisionRationale?.incentiveAlignmentLine &&
      !!row.decisionRationale?.burdenOfProofLine
  );
  if (privateRows.length === 0) return 0;
  const sourceVariants = new Set();
  const motiveVariants = new Set();
  privateRows.forEach((row) => {
    const text = row.text ?? "";
    const sourceVariant = [...text.matchAll(PRIVATE_SOURCE_TIMELINE_HEADING_CAPTURE)][0]?.[2] ?? "";
    const motiveVariant = [...text.matchAll(PRIVATE_MOTIVE_BURDEN_HEADING_CAPTURE)][0]?.[2] ?? "";
    if (sourceVariant) {
      sourceVariants.add(normalizedPrivateDeepCompressionVariant(sourceVariant));
    }
    if (motiveVariant) {
      motiveVariants.add(normalizedPrivateDeepCompressionVariant(motiveVariant));
    }
  });
  return Math.min(
    rate(Math.min(sourceVariants.size, 3), 3),
    rate(Math.min(motiveVariants.size, 3), 3)
  );
}

function privateDeepReasoningHeadingVariantCoverage(rows) {
  const privateRows = rows.filter(
    (row) =>
      row.source === "private-whisper" &&
      row.audience === "private" &&
      row.intent === "reason" &&
      !!row.decisionRationale?.sourceReliabilityLine &&
      !!row.decisionRationale?.timelineConsistencyLine &&
      !!row.decisionRationale?.incentiveAlignmentLine &&
      !!row.decisionRationale?.burdenOfProofLine
  );
  if (privateRows.length === 0) return 0;
  const sourceHeadings = new Set();
  const motiveHeadings = new Set();
  privateRows.forEach((row) => {
    const text = row.text ?? "";
    const sourceMatch = [...text.matchAll(PRIVATE_SOURCE_TIMELINE_HEADING_CAPTURE)][0];
    const motiveMatch = [...text.matchAll(PRIVATE_MOTIVE_BURDEN_HEADING_CAPTURE)][0];
    if (sourceMatch?.[1]) {
      sourceHeadings.add(sourceMatch[1]);
    }
    if (motiveMatch?.[1]) {
      motiveHeadings.add(motiveMatch[1]);
    }
  });
  return Math.min(
    rate(Math.min(sourceHeadings.size, 3), 3),
    rate(Math.min(motiveHeadings.size, 3), 3)
  );
}

function privateDeepReasoningTailVariantCoverage(rows) {
  const privateRows = rows.filter(
    (row) =>
      row.source === "private-whisper" &&
      row.audience === "private" &&
      row.intent === "reason" &&
      !!row.decisionRationale?.sourceReliabilityLine &&
      !!row.decisionRationale?.incentiveAlignmentLine
  );
  if (privateRows.length === 0) return 0;
  const sourceVariants = [];
  const motiveVariants = [];
  privateRows.forEach((row) => {
    const text = row.text ?? "";
    sourceVariants.push(
      ...[...text.matchAll(PRIVATE_SOURCE_TIMELINE_HEADING_CAPTURE)]
        .map((match) => normalizedPrivateDeepCompressionVariant(match[2] ?? ""))
        .filter(Boolean)
    );
    motiveVariants.push(
      ...[...text.matchAll(PRIVATE_MOTIVE_BURDEN_HEADING_CAPTURE)]
        .map((match) => normalizedPrivateDeepCompressionVariant(match[2] ?? ""))
        .filter(Boolean)
    );
  });
  const sourceSet = new Set(sourceVariants);
  const motiveSet = new Set(motiveVariants);
  const sourceCoverage = rate(Math.min(sourceSet.size, 6), 6);
  const motiveCoverage = rate(Math.min(motiveSet.size, 6), 6);
  const maxCount = (values) => {
    const counts = new Map();
    values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
    return Math.max(0, ...counts.values());
  };
  const sourceDominance =
    maxCount(sourceVariants) <= Math.max(3, Math.ceil(sourceVariants.length * 0.3)) ? 1 : 0;
  const motiveDominance =
    maxCount(motiveVariants) <= Math.max(3, Math.ceil(motiveVariants.length * 0.3)) ? 1 : 0;
  return Math.min(sourceCoverage, motiveCoverage, sourceDominance, motiveDominance);
}

function privateDeepReasoningBrevityCoverage(rows) {
  const privateRows = rows.filter(
    (row) =>
      row.source === "private-whisper" &&
      row.audience === "private" &&
      row.intent === "reason" &&
      hasPrivateSourceTimelineHeading(row.text ?? "") &&
      hasPrivateMotiveBurdenHeading(row.text ?? "")
  );
  if (privateRows.length === 0) return 0;
  return rate(
    privateRows.filter((row) => {
      const text = row.text ?? "";
      const deepSegments = privateDeepReasoningSegments(text);
      const deepText = deepSegments.join("");
      return (
        deepSegments.length >= 2 &&
        text.length <= 195 &&
        deepText.length <= 115 &&
        deepSegments.every((segment) => segment.length <= 62) &&
        !/；/.test(deepText)
      );
    }).length,
    privateRows.length
  );
}

function privateDeepReasoningLeadDedupCoverage(rows) {
  const privateRows = rows.filter(
    (row) =>
      row.source === "private-whisper" &&
      row.audience === "private" &&
      row.intent === "reason" &&
      hasPrivateSourceTimelineHeading(row.text ?? "") &&
      hasPrivateMotiveBurdenHeading(row.text ?? "")
  );
  if (privateRows.length === 0) return 0;
  return rate(
    privateRows.filter((row) => {
      const text = row.text ?? "";
      return !/(\d+号(?:和\d+号)?)的来源和时间线一起看[\s\S]{0,140}\1的动机和举证一起看/u.test(text);
    }).length,
    privateRows.length
  );
}

function formalVoteRationaleCoverage(rows) {
  const voteRows = rows.filter((row) => row.source === "formal-vote");
  if (voteRows.length === 0) return 1;
  const covered = voteRows.filter((row) => {
    const line = row.voteRationale?.line;
    return !!(line && row.text.includes(line) && row.voteRationale?.publicOnly === true);
  }).length;
  return rate(covered, voteRows.length);
}

function formalVoteTableContextCoverage(rows) {
  const voteRows = rows.filter((row) => row.source === "formal-vote");
  if (voteRows.length === 0) return 1;
  const covered = voteRows.filter((row) => {
    const text = row.text ?? "";
    return row.voteRationale?.publicOnly === true && FORMAL_VOTE_TABLE_CONTEXT_PATTERN.test(text);
  }).length;
  return rate(covered, voteRows.length);
}

function formalVoteLineDiversityCoverage(rows) {
  const voteRows = rows.filter((row) => row.source === "formal-vote");
  if (voteRows.length <= 1) return 1;
  const distinctLines = new Set(
    voteRows
      .map((row) => compactSignal(row.voteRationale?.line ?? row.text))
      .filter(Boolean)
  );
  return rate(distinctLines.size, voteRows.length);
}

function formalVoteNormalizedLineDiversityCoverage(rows) {
  const voteRows = rows.filter((row) => row.source === "formal-vote");
  if (voteRows.length <= 1) return 1;
  const distinctLines = new Set(
    voteRows
      .map((row) => compactSignal(row.voteRationale?.line ?? row.text).replace(/[0-9]+号/g, "#号"))
      .filter(Boolean)
  );
  return rate(distinctLines.size, voteRows.length);
}

function formalVoteReasonModeCoverage(rows) {
  const modes = new Set(
    rows
      .filter((row) => row.source === "formal-vote")
      .map((row) => row.voteRationale?.reasonKey)
      .filter(Boolean)
  );
  return rate(FORMAL_VOTE_REASON_MODES.filter((mode) => modes.has(mode)).length, FORMAL_VOTE_REASON_MODES.length);
}

function formalVoteNearThresholdCoverage(rows) {
  const nearRows = rows.filter((row) => row.requiresFormalVoteNearThreshold);
  if (nearRows.length === 0) return 1;
  const covered = nearRows.filter((row) => {
    const margin = row.voteRationale?.margin;
    return Number.isFinite(margin) && Math.abs(margin) <= 0.04 && FORMAL_VOTE_NEAR_THRESHOLD_PATTERN.test(row.text ?? "");
  }).length;
  return rate(covered, nearRows.length);
}

function formalVoteEvilCoverSafetyCoverage(rows) {
  const coverRows = rows.filter((row) => row.requiresFormalVoteEvilCoverMode);
  if (coverRows.length === 0) return 1;
  const covered = coverRows.filter((row) => {
    const text = row.text ?? "";
    const reasonKey = row.voteRationale?.reasonKey ?? "";
    return (
      ["table-balance-no", "execution-window-yes"].includes(reasonKey) &&
      row.voteRationale?.publicOnly === true &&
      FORMAL_VOTE_EVIL_COVER_PATTERN.test(text) &&
      !FORMAL_VOTE_EVIL_COVER_LEAK_PATTERN.test(text)
    );
  }).length;
  return rate(covered, coverRows.length);
}

function formalVoteEvidenceBoundaryCoverage(rows) {
  const evidenceBoundaryRows = rows.filter((row) => row.requiresFormalVoteEvidenceBoundary);
  if (evidenceBoundaryRows.length === 0) return 1;
  const covered = evidenceBoundaryRows.filter((row) => {
    const margin = row.voteRationale?.margin;
    return (
      Number.isFinite(margin) &&
      Math.abs(margin) <= 0.04 &&
      (row.voteRationale?.evidenceCount ?? 0) > 0 &&
      ["evidence-backed-yes", "evidence-below-threshold"].includes(row.voteRationale?.reasonKey ?? "") &&
      FORMAL_VOTE_EVIDENCE_BOUNDARY_PATTERN.test(row.text ?? "")
    );
  }).length;
  return rate(covered, evidenceBoundaryRows.length);
}

function formalVoteMultiEvidenceCompressionCoverage(rows) {
  const multiEvidenceRows = rows.filter((row) => row.requiresFormalVoteMultiEvidence);
  if (multiEvidenceRows.length === 0) return 1;
  const covered = multiEvidenceRows.filter((row) => {
    return (
      (row.voteRationale?.evidenceCount ?? 0) >= 2 &&
      ["evidence-backed-yes", "evidence-below-threshold"].includes(row.voteRationale?.reasonKey ?? "") &&
      FORMAL_VOTE_MULTI_EVIDENCE_PATTERN.test(row.text ?? "")
    );
  }).length;
  return rate(covered, multiEvidenceRows.length);
}

function formalVoteScriptCoverage(rows) {
  const scriptIds = new Set(
    rows
      .filter((row) => row.source === "formal-vote")
      .map((row) => row.scriptId)
      .filter(Boolean)
  );
  return rate(["tb", "bmr", "snv"].filter((scriptId) => scriptIds.has(scriptId)).length, 3);
}

function crossDayStanceContinuityCoverage(rows) {
  const crossDayRows = rows.filter((row) => row.crossDayStance);
  if (crossDayRows.length === 0) return 1;
  const covered = crossDayRows.filter((row) => {
    const text = row.text ?? "";
    const targetMention = row.focusName ? text.includes(row.focusName) : true;
    return targetMention && /(昨天|天前|新起线|今天转)/.test(text);
  }).length;
  return rate(covered, crossDayRows.length);
}

function crossDayStanceReasonCoverage(rows) {
  const crossDayRows = rows.filter((row) => row.crossDayStance);
  if (crossDayRows.length === 0) return 1;
  const covered = crossDayRows.filter((row) => {
    return publicTextIncludesEvidenceSignal(row.text, row.crossDayStance?.currentReasonSummary, 8);
  }).length;
  return rate(covered, crossDayRows.length);
}

function crossDayStanceReasonRecapDedupCoverage(rows) {
  const crossDayRows = rows.filter((row) => row.crossDayStance);
  if (crossDayRows.length === 0) return 1;
  const covered = crossDayRows.filter((row) => {
    const reason = compactSignal(cleanClippedPublicEvidenceFragments(row.crossDayStance?.currentReasonSummary));
    const reasonHead = reason.slice(0, Math.min(12, reason.length));
    if (!reasonHead) return true;
    const text = compactSignal(cleanClippedPublicEvidenceFragments(row.text));
    return countOccurrences(text, reasonHead) <= 1;
  }).length;
  return rate(covered, crossDayRows.length);
}

function crossDayStanceEvidenceDeltaCoverage(rows) {
  const crossDayRows = rows.filter((row) => row.crossDayStance);
  if (crossDayRows.length === 0) return 1;
  const metadataCovered = crossDayRows.filter((row) => {
    const crossDay = row.crossDayStance ?? {};
    return (
      Number.isFinite(crossDay.previousEvidenceCount) &&
      Number.isFinite(crossDay.currentEvidenceCount) &&
      Number.isFinite(crossDay.evidenceDelta) &&
      !!crossDay.changeSummary
    );
  }).length;
  const spokenRows = crossDayRows.filter((row) => row.requiresCrossScriptCrossDayStance);
  const spokenCovered = spokenRows.filter((row) => CROSS_DAY_STANCE_CHANGE_PATTERN.test(row.text ?? "")).length;
  return Math.min(rate(metadataCovered, crossDayRows.length), rate(spokenCovered, spokenRows.length));
}

function evidenceSnippetOverlapsRow(row) {
  const snippets = row.crossDayStance?.currentEvidenceSnippets ?? [];
  const evidence = row.evidenceSummaries ?? [];
  if (snippets.length === 0 || evidence.length === 0) {
    return false;
  }
  const cleanSnippets = snippets.map((entry) => compactSignal(cleanClippedPublicEvidenceFragments(entry))).filter(Boolean);
  const cleanEvidence = evidence.map((entry) => compactSignal(cleanClippedPublicEvidenceFragments(entry))).filter(Boolean);
  return cleanSnippets.some((snippet) =>
    cleanEvidence.some((entry) => {
      const snippetHead = snippet.slice(0, Math.min(10, snippet.length));
      const entryHead = entry.slice(0, Math.min(10, entry.length));
      return !!snippetHead && !!entryHead && (snippet.includes(entryHead) || entry.includes(snippetHead));
    })
  );
}

function crossDayStanceEvidenceTraceCoverage(rows) {
  const crossDayRows = rows.filter((row) => row.crossDayStance);
  if (crossDayRows.length === 0) return 1;
  const metadataCovered = crossDayRows.filter(
    (row) =>
      (row.crossDayStance?.previousEvidenceSnippets?.length ?? 0) > 0 &&
      (row.crossDayStance?.currentEvidenceSnippets?.length ?? 0) > 0
  ).length;
  const evidenceRows = crossDayRows.filter((row) => (row.evidenceSummaries?.length ?? 0) > 0);
  const overlapCovered = evidenceRows.filter(evidenceSnippetOverlapsRow).length;
  return Math.min(rate(metadataCovered, crossDayRows.length), rate(overlapCovered, evidenceRows.length));
}

function anchorOverlapsEvidence(row) {
  const anchors = row.crossDayStance?.currentEvidenceAnchors ?? [];
  const evidence = [...(row.evidenceSummaries ?? []), ...(row.crossDayStance?.currentEvidenceSnippets ?? [])];
  if (anchors.length === 0 || evidence.length === 0) {
    return false;
  }
  const cleanEvidence = evidence.map((entry) => compactSignal(cleanClippedPublicEvidenceFragments(entry))).filter(Boolean);
  return anchors.some((anchor) => {
    const cleanAnchor = compactSignal(cleanClippedPublicEvidenceFragments(anchor?.text ?? ""));
    return cleanEvidence.some((entry) => {
      const anchorHead = cleanAnchor.slice(0, Math.min(10, cleanAnchor.length));
      const entryHead = entry.slice(0, Math.min(10, entry.length));
      return !!anchorHead && !!entryHead && (cleanAnchor.includes(entryHead) || entry.includes(anchorHead));
    });
  });
}

function crossDayStanceEvidenceAnchorCoverage(rows) {
  const crossDayRows = rows.filter((row) => row.crossDayStance);
  if (crossDayRows.length === 0) return 1;
  const metadataCovered = crossDayRows.filter((row) => {
    const previous = row.crossDayStance?.previousEvidenceAnchors ?? [];
    const current = row.crossDayStance?.currentEvidenceAnchors ?? [];
    return (
      previous.length > 0 &&
      current.length > 0 &&
      [...previous, ...current].every((anchor) => (anchor?.evidenceId || anchor?.observationId) && anchor?.text && anchor?.visibility)
    );
  }).length;
  const overlapCovered = crossDayRows.filter(anchorOverlapsEvidence).length;
  return Math.min(rate(metadataCovered, crossDayRows.length), rate(overlapCovered, crossDayRows.length));
}

function eventAnchorOverlapsRow(row) {
  const anchors = row.crossDayStance?.currentEventAnchors ?? [];
  const evidence = [
    row.text ?? "",
    ...(row.evidenceSummaries ?? []),
    ...(row.crossDayStance?.currentEvidenceSnippets ?? []),
  ];
  if (anchors.length === 0 || evidence.length === 0) {
    return false;
  }
  const cleanEvidence = evidence.map((entry) => compactSignal(cleanClippedPublicEvidenceFragments(entry))).filter(Boolean);
  return anchors.some((anchor) => {
    const cleanAnchor = compactSignal(cleanClippedPublicEvidenceFragments(anchor?.text ?? ""));
    return cleanEvidence.some((entry) => {
      const anchorHead = cleanAnchor.slice(0, Math.min(10, cleanAnchor.length));
      const entryHead = entry.slice(0, Math.min(10, entry.length));
      return !!anchorHead && !!entryHead && (cleanAnchor.includes(entryHead) || entry.includes(anchorHead));
    });
  });
}

function crossDayStanceEventAnchorCoverage(rows) {
  const crossDayRows = rows.filter((row) => row.crossDayStance);
  if (crossDayRows.length === 0) return 1;
  const metadataCovered = crossDayRows.filter((row) => {
    const previous = row.crossDayStance?.previousEventAnchors ?? [];
    const current = row.crossDayStance?.currentEventAnchors ?? [];
    return (
      previous.length > 0 &&
      current.length > 0 &&
      [...previous, ...current].every(
        (anchor) =>
          (anchor?.eventId || anchor?.timelineEntryId) &&
          anchor?.source &&
          anchor?.visibility &&
          Number.isFinite(Number(anchor?.timestamp)) &&
          anchor?.text
      )
    );
  }).length;
  const overlapCovered = crossDayRows.filter(eventAnchorOverlapsRow).length;
  return Math.min(rate(metadataCovered, crossDayRows.length), rate(overlapCovered, crossDayRows.length));
}

function scoreTrailAnchorOverlapsRow(row) {
  const anchors = row.crossDayStance?.currentScoreTrailAnchors ?? [];
  const evidence = [
    row.text ?? "",
    ...(row.evidenceSummaries ?? []),
    ...(row.crossDayStance?.currentEvidenceSnippets ?? []),
    ...(row.crossDayStance?.currentEvidenceAnchors ?? []).map((anchor) => anchor?.text ?? ""),
  ];
  if (anchors.length === 0 || evidence.length === 0) {
    return false;
  }
  const cleanEvidence = evidence.map((entry) => compactSignal(cleanClippedPublicEvidenceFragments(entry))).filter(Boolean);
  return anchors.some((anchor) => {
    const cleanAnchor = compactSignal(cleanClippedPublicEvidenceFragments(anchor?.text ?? ""));
    return cleanEvidence.some((entry) => {
      const anchorHead = cleanAnchor.slice(0, Math.min(10, cleanAnchor.length));
      const entryHead = entry.slice(0, Math.min(10, entry.length));
      return !!anchorHead && !!entryHead && (cleanAnchor.includes(entryHead) || entry.includes(anchorHead));
    });
  });
}

function crossDayStanceScoreTrailAnchorCoverage(rows) {
  const crossDayRows = rows.filter((row) => row.crossDayStance);
  if (crossDayRows.length === 0) return 1;
  const metadataCovered = crossDayRows.filter((row) => {
    const previous = row.crossDayStance?.previousScoreTrailAnchors ?? [];
    const current = row.crossDayStance?.currentScoreTrailAnchors ?? [];
    return (
      previous.length > 0 &&
      current.length > 0 &&
      [...previous, ...current].every(
        (anchor) =>
          (anchor?.trailId || anchor?.evidenceId || anchor?.observationId) &&
          anchor?.text &&
          anchor?.visibility &&
          Number.isFinite(Number(anchor?.timestamp)) &&
          Number.isFinite(Number(anchor?.after)) &&
          Number.isFinite(Number(anchor?.appliedDelta))
      )
    );
  }).length;
  const overlapCovered = crossDayRows.filter(scoreTrailAnchorOverlapsRow).length;
  return Math.min(rate(metadataCovered, crossDayRows.length), rate(overlapCovered, crossDayRows.length));
}

function crossDayStanceModeCoverage(rows) {
  const modes = new Set(rows.map((row) => row.crossDayStance?.continuity).filter(Boolean));
  return rate(["hold", "shift"].filter((mode) => modes.has(mode)).length, 2);
}

function crossScriptCrossDayStanceCoverage(rows) {
  const crossScriptRows = rows.filter((row) => row.requiresCrossScriptCrossDayStance);
  if (crossScriptRows.length === 0) return 0;
  const covered = crossScriptRows.filter((row) => {
    const text = row.text ?? "";
    return (
      ["bmr", "snv"].includes(row.scriptId) &&
      row.expectedScriptId === row.scriptId &&
      row.source === "public-discussion" &&
      row.audience === "public" &&
      row.crossDayStance?.kind === "cross-day-stance" &&
      row.crossDayStance?.continuity === row.expectedCrossDayMode &&
      (row.crossDayStance?.previousEvidenceSnippets?.length ?? 0) > 0 &&
      (row.crossDayStance?.currentEvidenceSnippets?.length ?? 0) > 0 &&
      (row.crossDayStance?.previousEvidenceAnchors?.length ?? 0) > 0 &&
      (row.crossDayStance?.currentEvidenceAnchors?.length ?? 0) > 0 &&
      (row.crossDayStance?.previousEventAnchors?.length ?? 0) > 0 &&
      (row.crossDayStance?.currentEventAnchors?.length ?? 0) > 0 &&
      (row.crossDayStance?.previousScoreTrailAnchors?.length ?? 0) > 0 &&
      (row.crossDayStance?.currentScoreTrailAnchors?.length ?? 0) > 0 &&
      ["hold", "shift"].includes(row.expectedCrossDayMode) &&
      !!row.focusName &&
      text.includes(row.focusName) &&
      /(昨天|天前|新起线|今天转)/.test(text) &&
      CROSS_DAY_STANCE_CHANGE_PATTERN.test(text) &&
      evidenceSnippetOverlapsRow(row) &&
      anchorOverlapsEvidence(row) &&
      eventAnchorOverlapsRow(row) &&
      scoreTrailAnchorOverlapsRow(row) &&
      publicTextIncludesEvidenceSignal(text, row.crossDayStance?.currentReasonSummary, 8) &&
      !PUBLIC_SURFACE_POLISH_ARTIFACT_PATTERN.test(text)
    );
  }).length;
  const combos = new Set(crossScriptRows.map((row) => `${row.scriptId}:${row.expectedCrossDayMode}`));
  const coveredCombos = ["bmr:hold", "bmr:shift", "snv:hold", "snv:shift"].filter((combo) => combos.has(combo)).length;
  return Math.min(rate(covered, crossScriptRows.length), rate(coveredCombos, 4));
}

function hasCrossDayTargetSwitch(row) {
  const text = row.text ?? "";
  const decision = row.decisionRationale ?? {};
  const switchState = decision.targetSwitchContinuity ?? {};
  const line = oneLine(decision.targetSwitchLine || decision.memoryContinuityLine);
  const previousName = row.expectedPreviousFocusName ?? "";
  const currentName = row.focusName ?? "";
  const compactText = compactSignal(text);
  const compactLine = compactSignal(line);
  return (
    row.source === "public-discussion" &&
    row.audience === "public" &&
    switchState.kind === "cross-day-target-switch" &&
    switchState.previousTargetId === row.expectedPreviousFocusId &&
    switchState.currentTargetId === row.focusId &&
    !!previousName &&
    !!currentName &&
    compactText.includes(compactSignal(previousName)) &&
    compactText.includes(compactSignal(currentName)) &&
    compactLine.includes(compactSignal(previousName)) &&
    compactLine.includes(compactSignal(currentName)) &&
    /昨天主线|天前主线/.test(line) &&
    /先转|不等于放掉|旧线|回看/.test(text) &&
    Number.isFinite(switchState.previousDay) &&
    Number.isFinite(switchState.currentDay) &&
    Number.isFinite(switchState.currentEvidenceCount) &&
    (switchState.currentEvidenceCount ?? 0) >= 2 &&
    !EVIL_ONLY_LANGUAGE_PATTERN.test(text)
  );
}

function crossDayTargetSwitchCoverage(rows) {
  const switchRows = rows.filter((row) => row.requiresCrossDayTargetSwitch);
  if (switchRows.length === 0) return 0;
  return rate(switchRows.filter(hasCrossDayTargetSwitch).length, switchRows.length);
}

function crossScriptCrossDayTargetSwitchCoverage(rows) {
  const switchRows = rows.filter((row) => row.requiresCrossScriptCrossDayTargetSwitch);
  if (switchRows.length === 0) return 0;
  const covered = switchRows.filter(
    (row) => ["bmr", "snv"].includes(row.scriptId) && row.expectedScriptId === row.scriptId && hasCrossDayTargetSwitch(row)
  );
  const scripts = new Set(covered.map((row) => row.scriptId).filter(Boolean));
  return Math.min(rate(covered.length, switchRows.length), rate(["bmr", "snv"].filter((scriptId) => scripts.has(scriptId)).length, 2));
}

function hasNonPublicTargetSwitch(row) {
  const text = row.text ?? "";
  const decision = row.decisionRationale ?? {};
  const switchState = decision.targetSwitchContinuity ?? {};
  const line = oneLine(decision.targetSwitchLine || decision.memoryContinuityLine);
  const previousName = row.expectedPreviousFocusName ?? "";
  const currentName = row.focusName ?? "";
  const compactText = compactSignal(text);
  const compactLine = compactSignal(line);
  return (
    row.audience === "private" &&
    ["private-whisper", "proactive-private", "ai-ai-private"].includes(row.source) &&
    switchState.kind === "cross-day-target-switch" &&
    switchState.previousTargetId === row.expectedPreviousFocusId &&
    switchState.currentTargetId === row.focusId &&
    !!previousName &&
    !!currentName &&
    compactText.includes(compactSignal(previousName)) &&
    compactText.includes(compactSignal(currentName)) &&
    compactLine.includes(compactSignal(previousName)) &&
    compactLine.includes(compactSignal(currentName)) &&
    /昨天主线|天前主线/.test(line) &&
    /先转|不等于放掉|旧线|回看/.test(text) &&
    Number.isFinite(switchState.previousDay) &&
    Number.isFinite(switchState.currentDay) &&
    Number.isFinite(switchState.currentEvidenceCount) &&
    (switchState.currentEvidenceCount ?? 0) >= 2 &&
    !EVIL_ONLY_LANGUAGE_PATTERN.test(text)
  );
}

function nonPublicTargetSwitchContinuityCoverage(rows) {
  const switchRows = rows.filter((row) => row.requiresNonPublicTargetSwitchContinuity);
  if (switchRows.length === 0) return 0;
  const covered = switchRows.filter(hasNonPublicTargetSwitch);
  const sources = new Set(covered.map((row) => row.source).filter(Boolean));
  const sourceCoverage = ["private-whisper", "proactive-private", "ai-ai-private"].filter((source) => sources.has(source)).length;
  return Math.min(rate(covered.length, switchRows.length), rate(sourceCoverage, 3));
}

function publicPrioritySignalCoverage(rows) {
  const publicRows = rows.filter((row) => row.requiresPublicPrioritySignals);
  if (publicRows.length === 0) return 1;
  const covered = publicRows.filter((row) => {
    const text = compactSignal(cleanClippedPublicEvidenceFragments(row.text));
    const exactQuestionHit = row.thoughtQuestion && text.includes(compactSignal(row.thoughtQuestion));
    const focusQuestionCue =
      row.focusName &&
      text.includes(compactSignal(row.focusName)) &&
      /让|问|追问|回应|解释|身份|昨晚信息/.test(row.text ?? "");
    const hits = [
      row.personaMarkers?.some((marker) => marker && (row.text ?? "").includes(marker)),
      row.focusName && text.includes(compactSignal(row.focusName)),
      row.evidenceSpokenText && publicTextIncludesEvidenceSignal(row.text, row.evidenceSpokenText, 10),
      exactQuestionHit || focusQuestionCue,
    ].filter(Boolean).length;
    const hasFocus = !!(row.focusName && text.includes(compactSignal(row.focusName)));
    const hasEvidence = !!(row.evidenceSpokenText && publicTextIncludesEvidenceSignal(row.text, row.evidenceSpokenText, 10));
    const hasPersonaOrFollowUp = !!(
      row.personaMarkers?.some((marker) => marker && (row.text ?? "").includes(marker)) ||
      exactQuestionHit ||
      focusQuestionCue
    );
    return hits >= 4 || (hasFocus && hasEvidence && hasPersonaOrFollowUp);
  }).length;
  return rate(covered, publicRows.length);
}

function publicFollowUpDedupCoverage(rows) {
  const publicRows = rows.filter((row) => row.audience === "public" && /身份和昨晚信息/.test(row.text ?? ""));
  if (publicRows.length === 0) return 1;
  return rate(
    publicRows.filter((row) => {
      const text = row.text ?? "";
      return !PUBLIC_FOLLOW_UP_DUPLICATE_PATTERN.test(text) && !PUBLIC_SPECIFIC_FOLLOW_UP_DUPLICATE_PATTERN.test(text);
    }).length,
    publicRows.length
  );
}

function publicFollowUpTemplateDisciplineCoverage(rows) {
  const publicRows = rows.filter((row) => row.audience === "public" && /身份和昨晚信息/.test(row.text ?? ""));
  if (publicRows.length === 0) return 1;
  return rate(publicRows.filter((row) => !PUBLIC_FOLLOW_UP_TEMPLATE_PATTERN.test(row.text ?? "")).length, publicRows.length);
}

function publicFollowUpSpecificityCoverage(rows) {
  const publicRows = rows.filter((row) => row.audience === "public" && row.evidenceSpokenText && /昨晚信息/.test(row.text ?? ""));
  if (publicRows.length === 0) return 1;
  return rate(publicRows.filter((row) => PUBLIC_FOLLOW_UP_SPECIFICITY_PATTERN.test(row.text ?? "")).length, publicRows.length);
}

function publicEvidenceSynthesisCoverage(rows) {
  const publicRows = rows.filter(
    (row) =>
      row.audience === "public" &&
      (row.evidenceSummaries?.length ?? 0) >= 2 &&
      (
        row.requiresCrossScriptPublicMultiEvidence ||
        row.requiresPublicPersonaPressureVariant ||
        row.requiresPublicTimingPressureVariant ||
        row.requiresPublicRolePressureVariant ||
        row.requiresPublicEvidenceSynthesisVerificationVariant
      )
  );
  if (publicRows.length === 0) return 1;
  return rate(publicRows.filter((row) => PUBLIC_EVIDENCE_SYNTHESIS_PATTERN.test(row.text ?? "")).length, publicRows.length);
}

function publicEvidenceSynthesisRows(rows) {
  return rows.filter(
    (row) =>
      row.audience === "public" &&
      (row.evidenceSummaries?.length ?? 0) >= 2 &&
      (
        row.requiresCrossScriptPublicMultiEvidence ||
        row.requiresPublicPersonaPressureVariant ||
        row.requiresPublicTimingPressureVariant ||
        row.requiresPublicRolePressureVariant ||
        row.requiresPublicEvidenceSynthesisVerificationVariant
      )
  );
}

function hasDuplicatePublicEvidenceSynthesis(text) {
  const value = oneLine(text);
  return PUBLIC_EVIDENCE_SYNTHESIS_PHRASES.some((phrase) => {
    const first = value.indexOf(phrase);
    return first >= 0 && value.indexOf(phrase, first + phrase.length) >= 0;
  });
}

function publicEvidenceSynthesisDedupCoverage(rows) {
  const publicRows = rows.filter(
    (row) =>
      row.audience === "public" &&
      (row.evidenceSummaries?.length ?? 0) >= 2 &&
      PUBLIC_EVIDENCE_SYNTHESIS_PATTERN.test(row.text ?? "")
  );
  if (publicRows.length === 0) return 1;
  return rate(publicRows.filter((row) => !hasDuplicatePublicEvidenceSynthesis(row.text ?? "")).length, publicRows.length);
}

function hasPublicEvidenceSynthesisLabelStack(text = "") {
  const value = oneLine(text);
  return (
    /(?:我过不去的是|这点还不够)：两条线索合在一起：/.test(value) ||
    /(?:这两点合着看|我卡的是这组线索|不止一条线在指这里|桌面问题连在一起|两条线先并起来看|这组关系不能拆开看|不是单点，线索接在一起|先把这组线放到同一桌面|我先按这组矛盾追问|这里要把两边一起验|证据还薄，但两点要对|这点还没定死，先看|线索不厚，但两边要接上|先按两条弱线对账|证据不厚，先把两边接住|这组线还要补证)[，,]\s*两条线索合在一起：/.test(value)
  );
}

function publicEvidenceSynthesisLabelStackCoverage(rows) {
  const publicRows = publicEvidenceSynthesisRows(rows).filter((row) =>
    /我过不去的是|这点还不够|两条线索合在一起/.test(row.text ?? "")
  );
  if (publicRows.length === 0) return 1;
  return rate(publicRows.filter((row) => !hasPublicEvidenceSynthesisLabelStack(row.text ?? "")).length, publicRows.length);
}

function publicEvidenceAnchorBodies(text = "") {
  return [...`${text ?? ""}`.matchAll(PUBLIC_EVIDENCE_ANCHOR_SENTENCE_CAPTURE)]
    .map((match) => compactSignal(match[1] ?? ""))
    .filter(Boolean);
}

function publicEvidenceAnchorBodiesOverlap(left, right) {
  const leftBody = `${left ?? ""}`;
  const rightBody = `${right ?? ""}`;
  if (!leftBody || !rightBody) return false;
  if (leftBody === rightBody) return true;
  return Math.min(leftBody.length, rightBody.length) >= 12 && (leftBody.startsWith(rightBody) || rightBody.startsWith(leftBody));
}

function hasDuplicatePublicEvidenceAnchorBody(text = "") {
  const bodies = publicEvidenceAnchorBodies(text);
  const seenBodies = [];
  for (const body of bodies) {
    if (seenBodies.some((seenBody) => publicEvidenceAnchorBodiesOverlap(seenBody, body))) {
      return true;
    }
    seenBodies.push(body);
  }
  return false;
}

function publicEvidenceAnchorDedupCoverage(rows) {
  const publicRows = publicEvidenceSynthesisRows(rows).filter((row) =>
    publicEvidenceAnchorBodies(row.text ?? "").length > 0
  );
  if (publicRows.length === 0) return 1;
  return rate(publicRows.filter((row) => !hasDuplicatePublicEvidenceAnchorBody(row.text ?? "")).length, publicRows.length);
}

function publicEvidenceAnchorLeadVariantCoverage(rows) {
  const publicRows = publicEvidenceSynthesisRows(rows).filter((row) => {
    const text = row.text ?? "";
    const evidenceText = row.evidenceSpokenText ?? "";
    return (
      /^两条线索合在一起：/u.test(evidenceText) ||
      OLD_PUBLIC_EVIDENCE_ANCHOR_STACK_PATTERN.test(text) ||
      PUBLIC_EVIDENCE_ANCHOR_LEAD_PATTERNS.some((pattern) => pattern.test(text))
    );
  });
  if (publicRows.length === 0) return 1;
  const matchedRows = publicRows.filter((row) => {
    const text = row.text ?? "";
    return (
      !OLD_PUBLIC_EVIDENCE_ANCHOR_STACK_PATTERN.test(text) &&
      PUBLIC_EVIDENCE_ANCHOR_LEAD_PATTERNS.some((pattern) => pattern.test(text))
    );
  });
  if (matchedRows.length !== publicRows.length) {
    return rate(matchedRows.length, publicRows.length);
  }
  const coveredLeads = new Set();
  matchedRows.forEach((row) => {
    const text = row.text ?? "";
    const leadIndex = PUBLIC_EVIDENCE_ANCHOR_LEAD_PATTERNS.findIndex((pattern) => pattern.test(text));
    if (leadIndex >= 0) {
      coveredLeads.add(leadIndex);
    }
  });
  const requiredLeadCount = Math.min(5, publicRows.length);
  const leadCounts = new Map();
  matchedRows.forEach((row) => {
    const text = row.text ?? "";
    const leadIndex = PUBLIC_EVIDENCE_ANCHOR_LEAD_PATTERNS.findIndex((pattern) => pattern.test(text));
    if (leadIndex >= 0) {
      leadCounts.set(leadIndex, (leadCounts.get(leadIndex) ?? 0) + 1);
    }
  });
  const maxCount = Math.max(0, ...leadCounts.values());
  const dominanceLimit = Math.max(4, Math.ceil(matchedRows.length * 0.35));
  return Math.min(
    rate(Math.min(coveredLeads.size, requiredLeadCount), requiredLeadCount),
    maxCount <= dominanceLimit ? 1 : 0
  );
}

function publicEvidenceSynthesisSpokenVerificationCoverage(rows) {
  const publicRows = publicEvidenceSynthesisRows(rows);
  if (publicRows.length === 0) return 1;
  return rate(
    publicRows.filter((row) => PUBLIC_EVIDENCE_SYNTHESIS_SPOKEN_VERIFICATION_PATTERN.test(row.text ?? "")).length,
    publicRows.length
  );
}

function publicEvidenceSynthesisVerificationMode(row) {
  const text = row?.text ?? "";
  return Object.entries(PUBLIC_EVIDENCE_SYNTHESIS_VERIFICATION_VARIANT_PATTERNS)
    .find(([, patterns]) => patterns.synthesis.test(text))?.[0] ?? "";
}

function publicEvidenceSynthesisVerificationMatchingModes(row) {
  const text = row?.text ?? "";
  return Object.entries(PUBLIC_EVIDENCE_SYNTHESIS_VERIFICATION_VARIANT_PATTERNS)
    .filter(([, patterns]) => patterns.synthesis.test(text) && patterns.verification.test(text))
    .map(([mode]) => mode);
}

function publicEvidenceSynthesisSpokenVerificationVariantCoverage(rows) {
  const publicRows = publicEvidenceSynthesisRows(rows);
  if (publicRows.length === 0) return 1;
  const coveredRows = publicRows.filter((row) => publicEvidenceSynthesisVerificationMatchingModes(row).length > 0);
  const coveredModes = new Set(coveredRows.flatMap(publicEvidenceSynthesisVerificationMatchingModes).filter(Boolean));
  return Math.min(
    rate(coveredRows.length, publicRows.length),
    rate(
      PUBLIC_EVIDENCE_SYNTHESIS_VERIFICATION_MODES.filter((mode) => coveredModes.has(mode)).length,
      PUBLIC_EVIDENCE_SYNTHESIS_VERIFICATION_MODES.length
    )
  );
}

function publicEvidenceSynthesisExplicitModeCoverage(rows) {
  const publicRows = rows.filter((row) => row.requiresPublicEvidenceSynthesisVerificationVariant);
  if (publicRows.length === 0) return 0;
  const coveredRows = publicRows.filter((row) => {
    const mode = row.expectedPublicEvidenceSynthesisVerificationMode ?? "";
    return (
      PUBLIC_EVIDENCE_SYNTHESIS_VERIFICATION_MODES.includes(mode) &&
      row.source === "public-discussion" &&
      row.audience === "public" &&
      (row.evidenceSummaries?.length ?? 0) >= 2 &&
      publicEvidenceSynthesisVerificationMatchingModes(row).includes(mode) &&
      !EVIL_ONLY_LANGUAGE_PATTERN.test(row.text ?? "")
    );
  });
  const coveredModes = new Set(coveredRows.map((row) => row.expectedPublicEvidenceSynthesisVerificationMode).filter(Boolean));
  return Math.min(
    rate(coveredRows.length, publicRows.length),
    rate(
      PUBLIC_EVIDENCE_SYNTHESIS_VERIFICATION_MODES.filter((mode) => coveredModes.has(mode)).length,
      PUBLIC_EVIDENCE_SYNTHESIS_VERIFICATION_MODES.length
    )
  );
}

function publicVerificationLeadVariantCoverage(rows) {
  const publicRows = publicEvidenceSynthesisRows(rows).filter((row) =>
    PUBLIC_EVIDENCE_SYNTHESIS_SPOKEN_VERIFICATION_PATTERN.test(row.text ?? "")
  );
  if (publicRows.length === 0) return 1;
  const matchedRows = publicRows.filter((row) => PUBLIC_VERIFICATION_LEAD_PATTERN.test(row.text ?? ""));
  if (matchedRows.length !== publicRows.length) {
    return rate(matchedRows.length, publicRows.length);
  }
  const coveredLeads = new Set();
  matchedRows.forEach((row) => {
    const text = row.text ?? "";
    const leadIndex = PUBLIC_VERIFICATION_LEAD_PATTERNS.findIndex((pattern) => pattern.test(text));
    if (leadIndex >= 0) {
      coveredLeads.add(leadIndex);
    }
  });
  const requiredLeadCount = Math.min(3, publicRows.length);
  return rate(Math.min(coveredLeads.size, requiredLeadCount), requiredLeadCount);
}

function publicFollowUpTailVariantCoverage(rows) {
  const publicRows = rows.filter((row) => {
    const text = row.text ?? "";
    return (
      row.audience === "public" &&
      PUBLIC_VERIFICATION_LEAD_PATTERN.test(text) &&
      /昨晚信息|投票理由|提名压力/u.test(text)
    );
  });
  if (publicRows.length === 0) return 0;
  const matchedRows = publicRows.filter((row) =>
    PUBLIC_FOLLOW_UP_TAIL_PATTERNS.some((pattern) => pattern.test(row.text ?? ""))
  );
  if (matchedRows.length !== publicRows.length) {
    return rate(matchedRows.length, publicRows.length);
  }
  const coveredTails = new Set();
  matchedRows.forEach((row) => {
    const text = row.text ?? "";
    const tailIndex = PUBLIC_FOLLOW_UP_TAIL_PATTERNS.findIndex((pattern) => pattern.test(text));
    if (tailIndex >= 0) {
      coveredTails.add(tailIndex);
    }
  });
  const oldNightTailCount = publicRows.filter((row) => /再说昨晚信息/u.test(row.text ?? "")).length;
  const maxOldNightTailCount = Math.max(3, Math.floor(publicRows.length * 0.25));
  if (oldNightTailCount > maxOldNightTailCount) {
    return rate(publicRows.length - oldNightTailCount, publicRows.length);
  }
  const requiredTailCount = Math.min(6, publicRows.length);
  return rate(Math.min(coveredTails.size, requiredTailCount), requiredTailCount);
}

function cleanClippedPublicEvidenceFragments(text) {
  return `${text ?? ""}`
    .replace(/公开站队和(?:\.{3,}|…)/g, "公开站队和台面压力")
    .replace(/可见记录：\s*([0-9]+号)\s*的投票理(?:\.{3,}|…)/g, "可见记录：$1的投票理由要补清")
    .replace(/投票理(?:\.{3,}|…)/g, "投票理由要补清")
    .replace(/票型跟(?:\.{3,}|…)/g, "票型跟台面压力要对")
    .replace(/当前压(?:\.{3,}|…)/g, "台面压力")
    .replace(/可见记录：\s*([0-9]+号)\s*刚才投票(?:\.{3,}|…)/g, "可见记录：$1刚才投票态度要解释")
    .replace(/可见记录：\s*([0-9]+号)\s*的投票和(?:\.{3,}|…)/g, "可见记录：$1的投票和身份解释要对")
    .replace(/可见记录：\s*([0-9]+号)\s*身份解释(?:\.{3,}|…)/g, "可见记录：$1身份解释要补清")
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

function publicEvidenceFragmentClarityCoverage(rows) {
  const publicRows = rows.filter((row) => row.audience === "public" && row.evidenceSpokenText);
  if (publicRows.length === 0) return 1;
  return rate(publicRows.filter((row) => !PUBLIC_CLIPPED_EVIDENCE_PATTERN.test(row.text ?? "")).length, publicRows.length);
}

function nonPublicEvidenceFragmentClarityCoverage(rows) {
  const nonPublicRows = rows.filter((row) => row.audience !== "public" && row.text);
  if (nonPublicRows.length === 0) return 1;
  return rate(nonPublicRows.filter((row) => !NON_PUBLIC_CLIPPED_EVIDENCE_PATTERN.test(row.text ?? "")).length, nonPublicRows.length);
}

function nonPublicSurfacePolishCoverage(rows) {
  const nonPublicRows = rows.filter((row) => row.audience !== "public" && row.text);
  if (nonPublicRows.length === 0) return 1;
  return rate(nonPublicRows.filter((row) => !NON_PUBLIC_SURFACE_POLISH_ARTIFACT_PATTERN.test(row.text ?? "")).length, nonPublicRows.length);
}

function publicSurfacePolishCoverage(rows) {
  const publicRows = rows.filter((row) => row.audience === "public");
  if (publicRows.length === 0) return 1;
  return rate(publicRows.filter((row) => !PUBLIC_SURFACE_POLISH_ARTIFACT_PATTERN.test(row.text ?? "")).length, publicRows.length);
}

function publicTableSpeechBrevityCoverage(rows) {
  const publicRows = rows.filter((row) => row.source === "public-discussion" && row.audience === "public");
  if (publicRows.length === 0) return 1;
  return rate(
    publicRows.filter((row) => {
      const text = oneLine(row.text ?? "");
      return text.length <= 190;
    }).length,
    publicRows.length
  );
}

function publicSentenceClosureCoverage(rows) {
  const publicRows = rows.filter((row) => row.audience === "public");
  if (publicRows.length === 0) return 1;
  return rate(publicRows.filter((row) => /[。！？]$/.test(row.text ?? "")).length, publicRows.length);
}

function publicGenericOpenerDisciplineCoverage(rows) {
  const publicRows = rows.filter((row) => row.audience === "public");
  if (publicRows.length === 0) return 1;
  return rate(publicRows.filter((row) => !PUBLIC_GENERIC_OPENER_PATTERN.test(row.text ?? "")).length, publicRows.length);
}

function publicPressureTextureCoverage(rows) {
  const pressureRows = rows.filter((row) => row.audience === "public" && (row.decisionRationale?.focusScore ?? 0) >= 0.72);
  if (pressureRows.length === 0) return 1;
  const covered = pressureRows.filter((row) =>
    PUBLIC_PRESSURE_TEXTURE_MARKERS.some((marker) => marker && (row.text ?? "").includes(marker))
  ).length;
  return rate(covered, pressureRows.length);
}

function publicPersonaPressureVariantCoverage(rows) {
  const variantRows = rows.filter((row) => row.requiresPublicPersonaPressureVariant);
  if (variantRows.length === 0) return 0;
  const covered = variantRows.filter((row) => {
    const text = row.text ?? "";
    const expectedPersona = row.expectedPersona ?? "";
    const pattern = PUBLIC_PERSONA_PRESSURE_VARIANT_PATTERNS[expectedPersona];
    return (
      row.source === "public-discussion" &&
      row.audience === "public" &&
      row.speakerPersona === expectedPersona &&
      !!row.focusName &&
      text.includes(row.focusName) &&
      (row.evidenceSummaries?.length ?? 0) >= 2 &&
      PUBLIC_MULTI_EVIDENCE_COMPRESSION_PATTERN.test(text) &&
      !!pattern &&
      pattern.test(text) &&
      !EVIL_ONLY_LANGUAGE_PATTERN.test(text)
    );
  }).length;
  const coveredPersonas = new Set(
    variantRows
      .filter((row) => PUBLIC_PERSONA_PRESSURE_VARIANT_PATTERNS[row.expectedPersona]?.test(row.text ?? ""))
      .map((row) => row.expectedPersona)
      .filter(Boolean)
  );
  return Math.min(rate(covered, variantRows.length), rate(coveredPersonas.size, 3));
}

function publicPersonaPressureLineDiversityCoverage(rows) {
  const variantRows = rows.filter((row) => row.requiresPublicPersonaPressureVariant);
  if (variantRows.length === 0) return 0;
  const openingStems = variantRows.map((row) => sentenceStems(row.text)[0]).filter(Boolean);
  if (openingStems.length === 0) return 0;
  return rate(new Set(openingStems).size, openingStems.length);
}

function publicShadowPressureLineDiversityCoverage(rows) {
  const shadowRows = rows.filter(
    (row) =>
      row.audience === "public" &&
      row.speakerPersona === "shadow" &&
      (row.decisionRationale?.focusScore ?? 0) >= 0.72 &&
      (row.evidenceSummaries?.length ?? 0) >= 2
  );
  if (shadowRows.length === 0) return 1;
  const openingStems = shadowRows.map((row) => sentenceStems(row.text)[0]).filter(Boolean);
  if (openingStems.length === 0) return 0;
  return rate(new Set(openingStems).size, openingStems.length);
}

function publicShadowTargetLineVariantCoverage(rows) {
  const shadowRows = rows.filter(
    (row) =>
      row.audience === "public" &&
      row.speakerPersona === "shadow" &&
      (row.requiresPublicPersonaPressureVariant ||
        OLD_PUBLIC_SHADOW_TARGET_LINE_PATTERN.test(row.text ?? "") ||
        PUBLIC_SHADOW_TARGET_LINE_PATTERNS.some((pattern) => pattern.test(row.text ?? "")))
  );
  if (shadowRows.length === 0) return 0;
  const matchedRows = shadowRows.filter((row) =>
    PUBLIC_SHADOW_TARGET_LINE_PATTERNS.some((pattern) => pattern.test(row.text ?? ""))
  );
  if (matchedRows.length !== shadowRows.length) {
    return rate(matchedRows.length, shadowRows.length);
  }
  const coveredLines = new Set();
  const lineCounts = new Map();
  matchedRows.forEach((row) => {
    const text = row.text ?? "";
    const lineIndex = PUBLIC_SHADOW_TARGET_LINE_PATTERNS.findIndex((pattern) => pattern.test(text));
    if (lineIndex >= 0) {
      coveredLines.add(lineIndex);
      lineCounts.set(lineIndex, (lineCounts.get(lineIndex) ?? 0) + 1);
    }
  });
  const maxLineCount = Math.max(...lineCounts.values());
  const maxAllowedLineCount = Math.max(3, Math.ceil(matchedRows.length * 0.45));
  if (maxLineCount > maxAllowedLineCount) {
    return rate(maxAllowedLineCount, maxLineCount);
  }
  const requiredLineCount = Math.min(3, shadowRows.length);
  return rate(Math.min(coveredLines.size, requiredLineCount), requiredLineCount);
}

function publicPressureActionLeadVariantCoverage(rows) {
  const pressureRows = rows.filter(
    (row) =>
      row.audience === "public" &&
      row.speakerPersona === "pressure" &&
      (row.decisionRationale?.focusScore ?? 0) >= 0.72 &&
      (row.evidenceSummaries?.length ?? 0) >= 2 &&
      ((row.requiresPublicPersonaPressureVariant && row.expectedPersona === "pressure") ||
        PUBLIC_PRESSURE_ACTION_LEAD_PATTERNS.some((pattern) => pattern.test(row.text ?? "")))
  );
  if (pressureRows.length === 0) return 0;
  const matchedRows = pressureRows.filter((row) =>
    PUBLIC_PRESSURE_ACTION_LEAD_PATTERNS.some((pattern) => pattern.test(row.text ?? ""))
  );
  if (matchedRows.length !== pressureRows.length) {
    return rate(matchedRows.length, pressureRows.length);
  }
  const coveredLeads = new Set();
  const leadCounts = new Map();
  matchedRows.forEach((row) => {
    const text = row.text ?? "";
    const leadIndex = PUBLIC_PRESSURE_ACTION_LEAD_PATTERNS.findIndex((pattern) => pattern.test(text));
    if (leadIndex >= 0) {
      coveredLeads.add(leadIndex);
      leadCounts.set(leadIndex, (leadCounts.get(leadIndex) ?? 0) + 1);
    }
  });
  const maxLeadCount = Math.max(...leadCounts.values());
  const maxAllowedLeadCount = Math.max(3, Math.ceil(matchedRows.length * 0.45));
  if (maxLeadCount > maxAllowedLeadCount) {
    return rate(maxAllowedLeadCount, maxLeadCount);
  }
  const requiredLeadCount = Math.min(4, pressureRows.length);
  return rate(Math.min(coveredLeads.size, requiredLeadCount), requiredLeadCount);
}

function publicPressureUrgencyTailVariantCoverage(rows) {
  const pressureRows = rows.filter(
    (row) =>
      row.audience === "public" &&
      row.speakerPersona === "pressure" &&
      (row.decisionRationale?.focusScore ?? 0) >= 0.72 &&
      (row.evidenceSummaries?.length ?? 0) >= 2 &&
      ((row.requiresPublicPersonaPressureVariant && row.expectedPersona === "pressure") ||
        PUBLIC_PRESSURE_ACTION_LEAD_PATTERNS.some((pattern) => pattern.test(row.text ?? "")))
  );
  if (pressureRows.length === 0) return 0;
  const matchedRows = pressureRows.filter((row) =>
    PUBLIC_PRESSURE_URGENCY_TAIL_PATTERNS.some((pattern) => pattern.test(row.text ?? ""))
  );
  if (matchedRows.length !== pressureRows.length) {
    return rate(matchedRows.length, pressureRows.length);
  }
  const coveredTails = new Set();
  matchedRows.forEach((row) => {
    const text = row.text ?? "";
    const tailIndex = PUBLIC_PRESSURE_URGENCY_TAIL_PATTERNS.findIndex((pattern) => pattern.test(text));
    if (tailIndex >= 0) {
      coveredTails.add(tailIndex);
    }
  });
  const requiredTailCount = Math.min(3, pressureRows.length);
  return rate(Math.min(coveredTails.size, requiredTailCount), requiredTailCount);
}

function hasRepeatedPublicPressureActionLead(text) {
  const value = `${text ?? ""}`;
  for (let seat = 1; seat <= 20; seat += 1) {
    const target = `${seat}号`;
    const hasStructuredAction =
      new RegExp(`我会先压\\s*${target}`, "u").test(value) ||
      new RegExp(`这轮先压\\s*${target}`, "u").test(value) ||
      new RegExp(`我会直接压\\s*${target}`, "u").test(value) ||
      new RegExp(`先把\\s*${target}压到桌面上`, "u").test(value) ||
      new RegExp(`${target}这边我先给压力`, "u").test(value) ||
      new RegExp(`${target}先上压力`, "u").test(value);
    if (hasStructuredAction && new RegExp(`我(?:直说，)?先压\\s*${target}，需要马上听回应`, "u").test(value)) {
      return true;
    }
  }
  return false;
}

function publicPressureActionLeadDedupCoverage(rows) {
  const pressureRows = rows.filter(
    (row) =>
      row.audience === "public" &&
      (row.requiresPublicPersonaPressureVariant ||
        row.requiresPublicTimingPressureVariant ||
        row.requiresPublicRolePressureVariant ||
        (row.decisionRationale?.focusScore ?? 0) >= 0.72)
  );
  if (pressureRows.length === 0) return 1;
  return rate(
    pressureRows.filter((row) => {
      const text = row.text ?? "";
      return (
        !hasRepeatedPublicPressureActionLead(text) &&
        !/我先暗记(\d+号)这条主线[\s\S]{0,120}\1我先暗记成主线/u.test(text)
      );
    }).length,
    pressureRows.length
  );
}

function publicScriptPressureVariantCoverage(rows) {
  const scriptRows = rows.filter((row) => row.requiresCrossScriptPublicMultiEvidence);
  if (scriptRows.length === 0) return 0;
  const covered = scriptRows.filter((row) => {
    const text = row.text ?? "";
    const scriptId = row.expectedScriptId ?? row.scriptId ?? "";
    const pattern = PUBLIC_SCRIPT_PRESSURE_VARIANT_PATTERNS[scriptId];
    return (
      ["bmr", "snv"].includes(scriptId) &&
      row.expectedScriptId === row.scriptId &&
      row.source === "public-discussion" &&
      row.audience === "public" &&
      !!row.focusName &&
      text.includes(row.focusName) &&
      (row.evidenceSummaries?.length ?? 0) >= 2 &&
      PUBLIC_MULTI_EVIDENCE_COMPRESSION_PATTERN.test(text) &&
      !!pattern &&
      pattern.test(text) &&
      !EVIL_ONLY_LANGUAGE_PATTERN.test(text)
    );
  }).length;
  const coveredScripts = new Set(
    scriptRows
      .filter((row) => PUBLIC_SCRIPT_PRESSURE_VARIANT_PATTERNS[row.expectedScriptId]?.test(row.text ?? ""))
      .map((row) => row.expectedScriptId)
      .filter(Boolean)
  );
  return Math.min(rate(covered, scriptRows.length), rate(["bmr", "snv"].filter((scriptId) => coveredScripts.has(scriptId)).length, 2));
}

function publicTimingPressureVariantCoverage(rows) {
  const timingRows = rows.filter((row) => row.requiresPublicTimingPressureVariant);
  if (timingRows.length === 0) return 0;
  const covered = timingRows.filter((row) => {
    const text = row.text ?? "";
    const expectedBeat = row.expectedTimingBeat ?? "";
    const pattern = PUBLIC_TIMING_PRESSURE_VARIANT_PATTERNS[expectedBeat];
    return (
      row.source === "public-discussion" &&
      row.audience === "public" &&
      row.debateBeat === expectedBeat &&
      !!row.focusName &&
      text.includes(row.focusName) &&
      (row.evidenceSummaries?.length ?? 0) >= 2 &&
      PUBLIC_MULTI_EVIDENCE_COMPRESSION_PATTERN.test(text) &&
      !!pattern &&
      pattern.test(text) &&
      !EVIL_ONLY_LANGUAGE_PATTERN.test(text)
    );
  }).length;
  const coveredBeats = new Set(
    timingRows
      .filter((row) => PUBLIC_TIMING_PRESSURE_VARIANT_PATTERNS[row.expectedTimingBeat]?.test(row.text ?? ""))
      .map((row) => row.expectedTimingBeat)
      .filter(Boolean)
  );
  return Math.min(
    rate(covered, timingRows.length),
    rate(["nomination-pressure", "vote-intent"].filter((beat) => coveredBeats.has(beat)).length, 2)
  );
}

function publicRolePressureVariantCoverage(rows) {
  const roleRows = rows.filter((row) => row.requiresPublicRolePressureVariant);
  if (roleRows.length === 0) return 0;
  const covered = roleRows.filter((row) => {
    const text = row.text ?? "";
    const expectedMode = row.expectedRolePressureMode ?? "";
    const pattern = PUBLIC_ROLE_PRESSURE_VARIANT_PATTERNS[expectedMode];
    return (
      row.source === "public-discussion" &&
      row.audience === "public" &&
      !!row.focusName &&
      text.includes(row.focusName) &&
      !!row.expectedClaimRoleId &&
      row.publicClaimRoleId === row.expectedClaimRoleId &&
      !!row.expectedClaimRoleName &&
      text.includes(row.expectedClaimRoleName) &&
      (row.evidenceSummaries?.length ?? 0) >= 2 &&
      PUBLIC_MULTI_EVIDENCE_COMPRESSION_PATTERN.test(text) &&
      !!pattern &&
      pattern.test(text) &&
      !EVIL_ONLY_LANGUAGE_PATTERN.test(text)
    );
  }).length;
  const coveredModes = new Set(
    roleRows
      .filter((row) => PUBLIC_ROLE_PRESSURE_VARIANT_PATTERNS[row.expectedRolePressureMode]?.test(row.text ?? ""))
      .map((row) => row.expectedRolePressureMode)
      .filter(Boolean)
  );
  return Math.min(
    rate(covered, roleRows.length),
    rate(
      ["info-claim", "outsider-risk", "death-trigger", "protection", "public-action"].filter((mode) =>
        coveredModes.has(mode)
      ).length,
      5
    )
  );
}

function evilPublicCoverTextureCoverage(rows) {
  const evilPublicRows = rows.filter((row) => row.requiresEvilCoverTexture);
  if (evilPublicRows.length === 0) return 1;
  const covered = evilPublicRows.filter((row) => {
    const text = row.text ?? "";
    return EVIL_PUBLIC_COVER_MARKERS.some((marker) => marker && text.includes(marker)) && !EVIL_ONLY_LANGUAGE_PATTERN.test(text);
  }).length;
  return rate(covered, evilPublicRows.length);
}

function evilPublicCoverMaintenanceCoverage(rows) {
  const maintenanceRows = rows.filter((row) => row.requiresEvilCoverMaintenance);
  if (maintenanceRows.length === 0) return 1;
  const covered = maintenanceRows.filter((row) => {
    const text = row.text ?? "";
    return (
      EVIL_COVER_MAINTENANCE_PATTERN.test(text) &&
      EVIL_PUBLIC_COVER_MARKERS.some((marker) => marker && text.includes(marker)) &&
      !EVIL_ONLY_LANGUAGE_PATTERN.test(text)
    );
  }).length;
  return rate(covered, maintenanceRows.length);
}

function publicPressureLeadBody(sentence = "") {
  return `${sentence ?? ""}`.replace(/[。！？；\s]+$/gu, "").trim();
}

function isPublicPressureLeadBody(body = "") {
  const compact = `${body ?? ""}`.replace(/\s+/g, "");
  return (
    compact.length >= 18 &&
    /[0-9]+号/u.test(compact) &&
    /(这条|这边|压力|主线|观察位|台面|回应)/u.test(compact) &&
    /(压|回应|主线|观察|不放下|补实|降压|记一笔)/u.test(compact)
  );
}

function hasRepeatedPublicPressureLeadExtension(text = "") {
  const value = `${text ?? ""}`;
  for (let seat = 1; seat <= 20; seat += 1) {
    const target = `${seat}号`;
    const knownLeads = [
      `${target}这条不单看，${target}这边我先不放下，回应绕就继续压`,
      `${target}这条先单独记，${target}这边我先不放下，回应绕就继续压`,
      `${target}这条要看后续回应，${target}这边我先不放下，回应绕就继续压`,
      `${target}这条不单看，${target}这条先留在主线里，等回应再降压`,
      `${target}这条先单独记，${target}这条先留在主线里，等回应再降压`,
      `${target}这条要看后续回应，${target}这条先留在主线里，等回应再降压`,
      `${target}这条不单看，先把${target}留在压力线上，看回应有没有补实`,
      `${target}这条先单独记，先把${target}留在压力线上，看回应有没有补实`,
      `${target}这条要看后续回应，先把${target}留在压力线上，看回应有没有补实`,
    ];
    if (knownLeads.some((lead) => {
      const first = value.indexOf(lead);
      return first >= 0 && value.indexOf(lead, first + lead.length) >= 0;
    })) {
      return true;
    }
  }
  const fragments = `${text ?? ""}`.match(/[^。！？；]+[。！？；]?/gu) ?? [];
  return fragments.some((fragment, index) => {
    const body = publicPressureLeadBody(fragment);
    if (!isPublicPressureLeadBody(body)) {
      return false;
    }
    return fragments
      .slice(index + 1)
      .some((later) => {
        const laterBody = publicPressureLeadBody(later);
        return laterBody.startsWith(`${body}，`) || laterBody.startsWith(`${body},`) || laterBody.startsWith(`${body}：`);
      });
  });
}

function evilPublicCoverMaintenanceDedupCoverage(rows) {
  const maintenanceRows = rows.filter((row) => row.requiresEvilCoverMaintenance);
  if (maintenanceRows.length === 0) return 1;
  return rate(
    maintenanceRows.filter((row) => !hasRepeatedPublicPressureLeadExtension(row.text ?? "")).length,
    maintenanceRows.length
  );
}

function evilPublicCoverPivotCoverage(rows) {
  const pivotRows = rows.filter((row) => row.requiresEvilCoverPivot);
  if (pivotRows.length === 0) return 1;
  const covered = pivotRows.filter((row) => {
    const text = row.text ?? "";
    return (
      EVIL_COVER_PIVOT_PATTERN.test(text) &&
      EVIL_PUBLIC_COVER_MARKERS.some((marker) => marker && text.includes(marker)) &&
      !EVIL_ONLY_LANGUAGE_PATTERN.test(text)
    );
  }).length;
  return rate(covered, pivotRows.length);
}

function evilPublicProtectAllyCoverage(rows) {
  const protectRows = rows.filter((row) => row.requiresEvilProtectAlly);
  if (protectRows.length === 0) return 1;
  const covered = protectRows.filter((row) => {
    const text = row.text ?? "";
    return (
      EVIL_PROTECT_ALLY_PATTERN.test(text) &&
      EVIL_PUBLIC_COVER_MARKERS.some((marker) => marker && text.includes(marker)) &&
      !EVIL_ONLY_LANGUAGE_PATTERN.test(text)
    );
  }).length;
  return rate(covered, protectRows.length);
}

function evilPublicClaimCoverPlanDedupCoverage(rows) {
  const planRows = rows.filter(
    (row) =>
      row.requiresEvilClaimCoverPivot ||
      row.requiresEvilClaimCoverProtectAlly ||
      row.requiresEvilClaimCoverDeceptionArc ||
      row.requiresEvilClaimCoverPressureContinuity ||
      row.requiresCrossScriptEvilClaimCoverPressureContinuity
  );
  if (planRows.length === 0) return 0;
  const repeatedPlanPhrases = ["这轮先转到", "台面压力别只堆一处", "别只压一个点", "压力重新分配一下"];
  const covered = planRows.filter((row) => {
    const text = compactSignal(row.text ?? "");
    return repeatedPlanPhrases.every((phrase) => countOccurrences(text, compactSignal(phrase)) <= 1);
  }).length;
  return rate(covered, planRows.length);
}

function evilPublicClaimCoverContinuityCoverage(rows) {
  const claimCoverRows = rows.filter((row) => row.requiresEvilClaimCoverContinuity);
  if (claimCoverRows.length === 0) return 0;
  const covered = claimCoverRows.filter((row) => {
    const text = row.text ?? "";
    const expectedName = row.expectedClaimRoleName ?? "";
    return (
      row.source === "public-discussion" &&
      row.audience === "public" &&
      row.speakerTeam === "evil" &&
      !!expectedName &&
      text.includes(expectedName) &&
      EVIL_CLAIM_COVER_CONTINUITY_PATTERN.test(text) &&
      EVIL_PUBLIC_COVER_MARKERS.some((marker) => marker && text.includes(marker)) &&
      !EVIL_ONLY_LANGUAGE_PATTERN.test(text)
    );
  }).length;
  return rate(covered, claimCoverRows.length);
}

function evilPublicClaimCoverPivotCoverage(rows) {
  const pivotRows = rows.filter((row) => row.requiresEvilClaimCoverPivot);
  if (pivotRows.length === 0) return 0;
  const covered = pivotRows.filter((row) => {
    const text = row.text ?? "";
    const expectedName = row.expectedClaimRoleName ?? "";
    return (
      row.source === "public-discussion" &&
      row.audience === "public" &&
      row.speakerTeam === "evil" &&
      !!row.focusName &&
      text.includes(row.focusName) &&
      !!expectedName &&
      text.includes(expectedName) &&
      EVIL_CLAIM_COVER_CONTINUITY_PATTERN.test(text) &&
      EVIL_CLAIM_COVER_PIVOT_PATTERN.test(text) &&
      EVIL_PUBLIC_COVER_MARKERS.some((marker) => marker && text.includes(marker)) &&
      !EVIL_ONLY_LANGUAGE_PATTERN.test(text)
    );
  }).length;
  return rate(covered, pivotRows.length);
}

function evilPublicClaimCoverProtectAllyCoverage(rows) {
  const protectRows = rows.filter((row) => row.requiresEvilClaimCoverProtectAlly);
  if (protectRows.length === 0) return 0;
  const covered = protectRows.filter((row) => {
    const text = row.text ?? "";
    const expectedName = row.expectedClaimRoleName ?? "";
    return (
      row.source === "public-discussion" &&
      row.audience === "public" &&
      row.speakerTeam === "evil" &&
      !!row.focusName &&
      text.includes(row.focusName) &&
      !!expectedName &&
      text.includes(expectedName) &&
      EVIL_CLAIM_COVER_CONTINUITY_PATTERN.test(text) &&
      EVIL_CLAIM_COVER_PROTECT_ALLY_PATTERN.test(text) &&
      EVIL_PUBLIC_COVER_MARKERS.some((marker) => marker && text.includes(marker)) &&
      !EVIL_ONLY_LANGUAGE_PATTERN.test(text)
    );
  }).length;
  return rate(covered, protectRows.length);
}

function evilPublicClaimCoverCrossDayCoverage(rows) {
  const crossDayRows = rows.filter((row) => row.requiresEvilClaimCoverCrossDay);
  if (crossDayRows.length === 0) return 0;
  const covered = crossDayRows.filter((row) => {
    const text = row.text ?? "";
    const expectedName = row.expectedClaimRoleName ?? "";
    return (
      row.source === "public-discussion" &&
      row.audience === "public" &&
      row.speakerTeam === "evil" &&
      !!row.focusName &&
      text.includes(row.focusName) &&
      !!expectedName &&
      text.includes(expectedName) &&
      EVIL_CLAIM_COVER_CONTINUITY_PATTERN.test(text) &&
      EVIL_CLAIM_COVER_CROSS_DAY_PATTERN.test(text) &&
      EVIL_PUBLIC_COVER_MARKERS.some((marker) => marker && text.includes(marker)) &&
      !EVIL_ONLY_LANGUAGE_PATTERN.test(text)
    );
  }).length;
  return rate(covered, crossDayRows.length);
}

function evilPublicClaimCoverDeceptionArcCoverage(rows) {
  const arcRows = rows.filter((row) => row.requiresEvilClaimCoverDeceptionArc);
  if (arcRows.length === 0) return 0;
  const covered = arcRows.filter((row) => {
    const text = row.text ?? "";
    const expectedName = row.expectedClaimRoleName ?? "";
    const priorArcLines = Array.isArray(row.priorArcLines) ? row.priorArcLines : [];
    return (
      row.source === "public-discussion" &&
      row.audience === "public" &&
      row.speakerTeam === "evil" &&
      !!row.focusName &&
      text.includes(row.focusName) &&
      !!expectedName &&
      text.includes(expectedName) &&
      priorArcLines.length >= 2 &&
      priorArcLines.some((line) => EVIL_CLAIM_COVER_PIVOT_PATTERN.test(line)) &&
      EVIL_CLAIM_COVER_CONTINUITY_PATTERN.test(text) &&
      EVIL_CLAIM_COVER_CROSS_DAY_PATTERN.test(text) &&
      EVIL_CLAIM_COVER_PROTECT_ALLY_PATTERN.test(text) &&
      EVIL_CLAIM_COVER_DECEPTION_ARC_PATTERN.test(text) &&
      EVIL_PUBLIC_COVER_MARKERS.some((marker) => marker && text.includes(marker)) &&
      !EVIL_ONLY_LANGUAGE_PATTERN.test(text)
    );
  }).length;
  return rate(covered, arcRows.length);
}

function evilPublicClaimCoverPressureContinuityCoverage(rows) {
  const continuityRows = rows.filter((row) => row.requiresEvilClaimCoverPressureContinuity);
  if (continuityRows.length === 0) return 0;
  const covered = continuityRows.filter((row) => {
    const text = row.text ?? "";
    const expectedName = row.expectedClaimRoleName ?? "";
    const priorArcLines = Array.isArray(row.priorArcLines) ? row.priorArcLines : [];
    return (
      row.source === "public-discussion" &&
      row.audience === "public" &&
      row.speakerTeam === "evil" &&
      !!row.focusName &&
      text.includes(row.focusName) &&
      !!expectedName &&
      text.includes(expectedName) &&
      priorArcLines.some((line) => line.includes(row.focusName) && EVIL_CLAIM_COVER_PIVOT_PATTERN.test(line)) &&
      EVIL_CLAIM_COVER_PRESSURE_CONTINUITY_PATTERN.test(text) &&
      EVIL_CLAIM_COVER_CONTINUITY_PATTERN.test(text) &&
      EVIL_PUBLIC_COVER_MARKERS.some((marker) => marker && text.includes(marker)) &&
      !EVIL_ONLY_LANGUAGE_PATTERN.test(text)
    );
  });
  const coveredScripts = new Set(covered.map((row) => row.scriptId).filter(Boolean));
  return Math.min(
    rate(covered.length, continuityRows.length),
    rate(["tb", "bmr", "snv"].filter((scriptId) => coveredScripts.has(scriptId)).length, 3)
  );
}

function evilPrivateCoordinationCoverage(rows) {
  const privateRows = rows.filter((row) => row.requiresEvilPrivateCoordination);
  if (privateRows.length === 0) return 0;
  const covered = privateRows.filter((row) => {
    const text = row.text ?? "";
    return (
      ["tb", "bmr", "snv"].includes(row.scriptId) &&
      row.expectedScriptId === row.scriptId &&
      row.source === "private-whisper" &&
      row.audience === "private" &&
      row.intent === "claim" &&
      row.speakerTeam === "evil" &&
      row.humanTeam === "evil" &&
      row.allowHiddenTruth === true &&
      !!row.focusName &&
      text.includes(row.focusName) &&
      EVIL_PRIVATE_TEAM_PATTERN.test(text) &&
      EVIL_PRIVATE_IDENTITY_PATTERN.test(text) &&
      EVIL_PRIVATE_COVER_PATTERN.test(text) &&
      EVIL_PRIVATE_PRESSURE_PATTERN.test(text)
    );
  }).length;
  const scriptCoverage = new Set(privateRows.map((row) => row.scriptId).filter(Boolean));
  const coveredScripts = ["tb", "bmr", "snv"].filter((scriptId) => scriptCoverage.has(scriptId)).length;
  return Math.min(rate(covered, privateRows.length), rate(coveredScripts, 3));
}

function evilPrivateTeamInfoVariantCoverage(rows) {
  const privateRows = rows.filter((row) => row.requiresEvilPrivateCoordination || row.requiresAIToAIEvilCoordination);
  if (privateRows.length === 0) return 0;
  const matchedRows = privateRows.filter((row) => EVIL_PRIVATE_TEAM_INFO_PATTERNS.some((pattern) => pattern.test(row.text ?? "")));
  if (matchedRows.length !== privateRows.length) {
    return rate(matchedRows.length, privateRows.length);
  }
  const variantCounts = new Map();
  matchedRows.forEach((row) => {
    const index = EVIL_PRIVATE_TEAM_INFO_PATTERNS.findIndex((pattern) => pattern.test(row.text ?? ""));
    if (index >= 0) {
      variantCounts.set(index, (variantCounts.get(index) ?? 0) + 1);
    }
  });
  const requiredVariantCount = Math.min(4, matchedRows.length);
  const maxCount = Math.max(0, ...variantCounts.values());
  const dominanceLimit = Math.max(2, Math.ceil(matchedRows.length * 0.4));
  return Math.min(
    rate(Math.min(variantCounts.size, requiredVariantCount), requiredVariantCount),
    maxCount <= dominanceLimit ? 1 : 0
  );
}

function evilPrivateCoverPlanVariantCoverage(rows) {
  const privateRows = rows.filter((row) => row.requiresEvilPrivateCoordination);
  if (privateRows.length === 0) return 0;
  const matchedRows = privateRows.filter((row) => EVIL_PRIVATE_COVER_PLAN_PATTERNS.some((pattern) => pattern.test(row.text ?? "")));
  if (matchedRows.length !== privateRows.length) {
    return rate(matchedRows.length, privateRows.length);
  }
  const variantCounts = new Map();
  matchedRows.forEach((row) => {
    const index = EVIL_PRIVATE_COVER_PLAN_PATTERNS.findIndex((pattern) => pattern.test(row.text ?? ""));
    if (index >= 0) {
      variantCounts.set(index, (variantCounts.get(index) ?? 0) + 1);
    }
  });
  const requiredVariantCount = Math.min(3, matchedRows.length);
  const maxCount = Math.max(0, ...variantCounts.values());
  const dominanceLimit = Math.max(2, Math.ceil(matchedRows.length * 0.5));
  return Math.min(
    rate(Math.min(variantCounts.size, requiredVariantCount), requiredVariantCount),
    maxCount <= dominanceLimit ? 1 : 0
  );
}

function evilPrivatePressurePlanDedupCoverage(rows) {
  const privateRows = rows.filter((row) => row.requiresEvilPrivateCoordination);
  if (privateRows.length === 0) return 0;
  const covered = privateRows.filter((row) => {
    const text = compactSignal(row.text ?? "");
    return countOccurrences(text, "火力点") <= 1 && countOccurrences(text, "先问身份和夜里信息") <= 1;
  }).length;
  return rate(covered, privateRows.length);
}

function aiToAiEvilCoordinationCoverage(rows) {
  const privateRows = rows.filter((row) => row.requiresAIToAIEvilCoordination);
  if (privateRows.length === 0) return 0;
  const covered = privateRows.filter((row) => {
    const text = row.text ?? "";
    return (
      ["tb", "bmr", "snv"].includes(row.scriptId) &&
      row.expectedScriptId === row.scriptId &&
      row.source === "ai-ai-private" &&
      row.audience === "private" &&
      row.aiToAi === true &&
      row.hiddenFromHuman === true &&
      row.hiddenFromTimeline === true &&
      row.hiddenFromLog === true &&
      row.allowHiddenTruth === true &&
      row.speakerTeam === "evil" &&
      row.targetTeam === "evil" &&
      !!row.focusName &&
      text.includes(row.focusName) &&
      EVIL_PRIVATE_TEAM_PATTERN.test(text) &&
      EVIL_PRIVATE_PRESSURE_PATTERN.test(text) &&
      EVIL_PRIVATE_REASON_PATTERN.test(text)
    );
  }).length;
  const scriptCoverage = new Set(privateRows.map((row) => row.scriptId).filter(Boolean));
  const coveredScripts = ["tb", "bmr", "snv"].filter((scriptId) => scriptCoverage.has(scriptId)).length;
  return Math.min(rate(covered, privateRows.length), rate(coveredScripts, 3));
}

export function summarizeAIQualityEvaluation(rows) {
  const safeRows = rows ?? [];
  const focusedRows = safeRows.filter((row) => row.source !== "formal-vote" && (row.focusId || row.decisionRationale?.focusId));
  const decisionRows = focusedRows.filter((row) => row.decisionRationale);
  const runnerUpRows = decisionRows.filter((row) => row.decisionRationale?.runnerUpId);
  const nominationRows = safeRows.filter((row) => row.audience === "nomination");
  return {
    totalRows: safeRows.length,
    focusedRows: focusedRows.length,
    hiddenLeakCount: safeRows.filter(hasHiddenLeak).length,
    mechanicalArtifactCount: safeRows.filter((row) => MECHANICAL_ARTIFACT_PATTERN.test(row.text ?? "")).length,
    evidenceCitationRate: rate(safeRows.filter(hasEvidenceCitation).length, safeRows.length),
    decisionRationaleCoverage: rate(decisionRows.length, focusedRows.length),
    decisionReconsiderationCoverage: decisionReconsiderationCoverage(safeRows),
    decisionConfidenceCalibrationCoverage: decisionConfidenceCalibrationCoverage(safeRows),
    decisionVerificationPlanCoverage: decisionVerificationPlanCoverage(safeRows),
    decisionEvidenceModeCoverage: decisionEvidenceModeCoverage(safeRows),
    decisionEvidenceModeVerificationAlignmentCoverage: decisionEvidenceModeVerificationAlignmentCoverage(safeRows),
    decisionResponsePlanCoverage: decisionResponsePlanCoverage(safeRows),
    decisionResponseCriteriaCoverage: decisionResponseCriteriaCoverage(safeRows),
    decisionEvidenceInteractionCoverage: decisionEvidenceInteractionCoverage(safeRows),
    decisionPressureStageCoverage: decisionPressureStageCoverage(safeRows),
    decisionCounterEvidenceCoverage: decisionCounterEvidenceCoverage(safeRows),
    decisionTableRiskCoverage: decisionTableRiskCoverage(safeRows),
    decisionInformationGainCoverage: decisionInformationGainCoverage(safeRows),
    decisionTableReactionCoverage: decisionTableReactionCoverage(safeRows),
    decisionTimingWindowCoverage: decisionTimingWindowCoverage(safeRows),
    decisionWorldBranchCoverage: decisionWorldBranchCoverage(safeRows),
    decisionVoteCoalitionCoverage: decisionVoteCoalitionCoverage(safeRows),
    decisionSourceReliabilityCoverage: decisionSourceReliabilityCoverage(safeRows),
    decisionTimelineConsistencyCoverage: decisionTimelineConsistencyCoverage(safeRows),
    decisionIncentiveAlignmentCoverage: decisionIncentiveAlignmentCoverage(safeRows),
    decisionBurdenOfProofCoverage: decisionBurdenOfProofCoverage(safeRows),
    decisionQuestionPriorityCoverage: decisionQuestionPriorityCoverage(safeRows),
    decisionActionThresholdCoverage: decisionActionThresholdCoverage(safeRows),
    decisionMemoryContinuityCoverage: decisionMemoryContinuityCoverage(safeRows),
    decisionExpressionDisciplineCoverage: decisionExpressionDisciplineCoverage(safeRows),
    decisionUncertaintyResolutionCoverage: decisionUncertaintyResolutionCoverage(safeRows),
    decisionEvidenceFreshnessCoverage: decisionEvidenceFreshnessCoverage(safeRows),
    decisionFalsificationCheckCoverage: decisionFalsificationCheckCoverage(safeRows),
    decisionCausalChainCoverage: decisionCausalChainCoverage(safeRows),
    decisionAssumptionAuditCoverage: decisionAssumptionAuditCoverage(safeRows),
    decisionMechanicSensitivityCoverage: decisionMechanicSensitivityCoverage(safeRows),
    decisionRoleHypothesisCoverage: decisionRoleHypothesisCoverage(safeRows),
    decisionEvidenceBoundaryCoverage: decisionEvidenceBoundaryCoverage(safeRows),
    decisionRunnerUpWatchCoverage: decisionRunnerUpWatchCoverage(safeRows),
    runnerUpComparisonCoverage: rate(runnerUpRows.filter(hasRunnerUpComparison).length, runnerUpRows.length),
    privateRunnerUpComparisonLineVariantCoverage: privateRunnerUpComparisonLineVariantCoverage(safeRows),
    strategyRationaleCoverage: rate(nominationRows.filter((row) => row.strategyRationale?.line).length, nominationRows.length),
    nominationActionContextCoverage: nominationActionContextCoverage(safeRows),
    nominationStrategyModeCoverage: nominationStrategyModeCoverage(safeRows),
    nominationStrategyPlanDedupCoverage: nominationStrategyPlanDedupCoverage(safeRows),
    nominationDefenseResponseCoverage: nominationDefenseResponseCoverage(safeRows),
    nominationDefenseResponseVariantCoverage: nominationDefenseResponseVariantCoverage(safeRows),
    nominationDefenseInfoDedupCoverage: nominationDefenseInfoDedupCoverage(safeRows),
    nominationDefenseReasonAnchorCoverage: nominationDefenseReasonAnchorCoverage(safeRows),
    highPressureNominationDefenseCounterPressureCoverage: highPressureNominationDefenseCounterPressureCoverage(safeRows),
    crossScriptNominationDefenseReasonAnchorCoverage: crossScriptNominationDefenseReasonAnchorCoverage(safeRows),
    nominationDefenseAwareVoteCoverage: nominationDefenseAwareVoteCoverage(safeRows),
    nominationReasonAnchoredDefenseVoteCoverage: nominationReasonAnchoredDefenseVoteCoverage(safeRows),
    nominationReasonAnchoredDefenseVoteLineDiversityCoverage: nominationReasonAnchoredDefenseVoteLineDiversityCoverage(safeRows),
    crossScriptNominationDefenseAwareVoteCoverage: crossScriptNominationDefenseAwareVoteCoverage(safeRows),
    proactiveRationaleCoverage: proactiveRationaleCoverage(safeRows),
    voteIntentCoverage: voteIntentCoverage(safeRows),
    claimDisclosureRationaleCoverage: claimDisclosureRationaleCoverage(safeRows),
    claimDisclosureContinuityCoverage: claimDisclosureContinuityCoverage(safeRows),
    claimDisclosureContinuityModeCoverage: claimDisclosureContinuityModeCoverage(safeRows),
    claimDisclosureSurfaceDedupCoverage: claimDisclosureSurfaceDedupCoverage(safeRows),
    claimDisclosureHoldLeadVariantCoverage: claimDisclosureHoldLeadVariantCoverage(safeRows),
    publicClaimHoldLeadVariantCoverage: publicClaimHoldLeadVariantCoverage(safeRows),
    claimDisclosureBalancedReasonVariantCoverage: claimDisclosureBalancedReasonVariantCoverage(safeRows),
    crossScriptClaimDisclosureCoverage: crossScriptClaimDisclosureCoverage(safeRows),
    privateScriptClaimDeflectCoverage: privateScriptClaimDeflectCoverage(safeRows),
    crossScriptClaimContinuityCoverage: crossScriptClaimContinuityCoverage(safeRows),
    roleConstrainedClaimDisclosureCoverage: roleConstrainedClaimDisclosureCoverage(safeRows),
    roleConstrainedClaimLineDiversityCoverage: roleConstrainedClaimLineDiversityCoverage(safeRows),
    crossScriptPublicReasoningCoverage: crossScriptPublicReasoningCoverage(safeRows),
    crossScriptPublicMultiEvidenceCoverage: crossScriptPublicMultiEvidenceCoverage(safeRows),
    publicScriptPressureVariantCoverage: publicScriptPressureVariantCoverage(safeRows),
    publicTimingPressureVariantCoverage: publicTimingPressureVariantCoverage(safeRows),
    publicRolePressureVariantCoverage: publicRolePressureVariantCoverage(safeRows),
    crossScriptPrivateMultiEvidenceCoverage: crossScriptPrivateMultiEvidenceCoverage(safeRows),
    privateSurfaceReportDisciplineCoverage: privateSurfaceReportDisciplineCoverage(safeRows),
    privateReasonOpeningRedundancyCoverage: privateReasonOpeningRedundancyCoverage(safeRows),
    privateReasonOpeningVariantCoverage: privateReasonOpeningVariantCoverage(safeRows),
    privateReasonOpeningLeadVariantCoverage: privateReasonOpeningLeadVariantCoverage(safeRows),
    privateReasonOpeningSentenceCoverage: privateReasonOpeningSentenceCoverage(safeRows),
    privateVerificationLeadNaturalizationCoverage: privateVerificationLeadNaturalizationCoverage(safeRows),
    privateDeepReasoningSpokenCoverage: privateDeepReasoningSpokenCoverage(safeRows),
    privateTimelineReasoningSpokenCoverage: privateTimelineReasoningSpokenCoverage(safeRows),
    privateSourceTimelineCompressionCoverage: privateSourceTimelineCompressionCoverage(safeRows),
    privateIncentiveReasoningSpokenCoverage: privateIncentiveReasoningSpokenCoverage(safeRows),
    privateBurdenReasoningSpokenCoverage: privateBurdenReasoningSpokenCoverage(safeRows),
    privateDeepReasoningCompressionCoverage: privateDeepReasoningCompressionCoverage(safeRows),
    privateDeepReasoningCompressionVariantCoverage: privateDeepReasoningCompressionVariantCoverage(safeRows),
    privateDeepReasoningHeadingVariantCoverage: privateDeepReasoningHeadingVariantCoverage(safeRows),
    privateDeepReasoningTailVariantCoverage: privateDeepReasoningTailVariantCoverage(safeRows),
    privateDeepReasoningBrevityCoverage: privateDeepReasoningBrevityCoverage(safeRows),
    privateDeepReasoningLeadDedupCoverage: privateDeepReasoningLeadDedupCoverage(safeRows),
    privateEvidenceSynthesisCoverage: privateEvidenceSynthesisCoverage(safeRows),
    privateEvidenceSynthesisVariantCoverage: privateEvidenceSynthesisVariantCoverage(safeRows),
    privateEvidenceSynthesisVerificationCoverage: privateEvidenceSynthesisVerificationCoverage(safeRows),
    privateEvidenceSynthesisSpokenVerificationCoverage: privateEvidenceSynthesisSpokenVerificationCoverage(safeRows),
    privateEvidenceSynthesisSourceIdentityDedupCoverage: privateEvidenceSynthesisSourceIdentityDedupCoverage(safeRows),
    privateEvidenceSynthesisVoteTaxonomyDedupCoverage: privateEvidenceSynthesisVoteTaxonomyDedupCoverage(safeRows),
    formalVoteRationaleCoverage: formalVoteRationaleCoverage(safeRows),
    formalVoteTableContextCoverage: formalVoteTableContextCoverage(safeRows),
    formalVoteLineDiversityCoverage: formalVoteLineDiversityCoverage(safeRows),
    formalVoteNormalizedLineDiversityCoverage: formalVoteNormalizedLineDiversityCoverage(safeRows),
    formalVoteReasonModeCoverage: formalVoteReasonModeCoverage(safeRows),
    formalVoteNearThresholdCoverage: formalVoteNearThresholdCoverage(safeRows),
    formalVoteEvilCoverSafetyCoverage: formalVoteEvilCoverSafetyCoverage(safeRows),
    formalVoteEvidenceBoundaryCoverage: formalVoteEvidenceBoundaryCoverage(safeRows),
    formalVoteMultiEvidenceCompressionCoverage: formalVoteMultiEvidenceCompressionCoverage(safeRows),
    formalVoteScriptCoverage: formalVoteScriptCoverage(safeRows),
    crossDayStanceContinuityCoverage: crossDayStanceContinuityCoverage(safeRows),
    crossDayStanceReasonCoverage: crossDayStanceReasonCoverage(safeRows),
    crossDayStanceReasonRecapDedupCoverage: crossDayStanceReasonRecapDedupCoverage(safeRows),
    crossDayStanceEvidenceDeltaCoverage: crossDayStanceEvidenceDeltaCoverage(safeRows),
    crossDayStanceEvidenceTraceCoverage: crossDayStanceEvidenceTraceCoverage(safeRows),
    crossDayStanceEvidenceAnchorCoverage: crossDayStanceEvidenceAnchorCoverage(safeRows),
    crossDayStanceEventAnchorCoverage: crossDayStanceEventAnchorCoverage(safeRows),
    crossDayStanceScoreTrailAnchorCoverage: crossDayStanceScoreTrailAnchorCoverage(safeRows),
    crossDayStanceModeCoverage: crossDayStanceModeCoverage(safeRows),
    crossScriptCrossDayStanceCoverage: crossScriptCrossDayStanceCoverage(safeRows),
    crossDayTargetSwitchCoverage: crossDayTargetSwitchCoverage(safeRows),
    crossScriptCrossDayTargetSwitchCoverage: crossScriptCrossDayTargetSwitchCoverage(safeRows),
    nonPublicTargetSwitchContinuityCoverage: nonPublicTargetSwitchContinuityCoverage(safeRows),
    publicPrioritySignalCoverage: publicPrioritySignalCoverage(safeRows),
    publicFollowUpDedupCoverage: publicFollowUpDedupCoverage(safeRows),
    publicFollowUpTemplateDisciplineCoverage: publicFollowUpTemplateDisciplineCoverage(safeRows),
    publicFollowUpSpecificityCoverage: publicFollowUpSpecificityCoverage(safeRows),
    publicEvidenceSynthesisCoverage: publicEvidenceSynthesisCoverage(safeRows),
    publicEvidenceSynthesisDedupCoverage: publicEvidenceSynthesisDedupCoverage(safeRows),
    publicEvidenceSynthesisLabelStackCoverage: publicEvidenceSynthesisLabelStackCoverage(safeRows),
    publicEvidenceAnchorLeadVariantCoverage: publicEvidenceAnchorLeadVariantCoverage(safeRows),
    publicEvidenceAnchorDedupCoverage: publicEvidenceAnchorDedupCoverage(safeRows),
    publicEvidenceSynthesisSpokenVerificationCoverage: publicEvidenceSynthesisSpokenVerificationCoverage(safeRows),
    publicEvidenceSynthesisSpokenVerificationVariantCoverage: publicEvidenceSynthesisSpokenVerificationVariantCoverage(safeRows),
    publicEvidenceSynthesisExplicitModeCoverage: publicEvidenceSynthesisExplicitModeCoverage(safeRows),
    publicVerificationLeadVariantCoverage: publicVerificationLeadVariantCoverage(safeRows),
    publicFollowUpTailVariantCoverage: publicFollowUpTailVariantCoverage(safeRows),
    publicEvidenceFragmentClarityCoverage: publicEvidenceFragmentClarityCoverage(safeRows),
    nonPublicEvidenceFragmentClarityCoverage: nonPublicEvidenceFragmentClarityCoverage(safeRows),
    nonPublicSurfacePolishCoverage: nonPublicSurfacePolishCoverage(safeRows),
    publicSurfacePolishCoverage: publicSurfacePolishCoverage(safeRows),
    publicTableSpeechBrevityCoverage: publicTableSpeechBrevityCoverage(safeRows),
    publicSentenceClosureCoverage: publicSentenceClosureCoverage(safeRows),
    publicGenericOpenerDisciplineCoverage: publicGenericOpenerDisciplineCoverage(safeRows),
    publicPressureTextureCoverage: publicPressureTextureCoverage(safeRows),
    publicPersonaPressureVariantCoverage: publicPersonaPressureVariantCoverage(safeRows),
    publicPersonaPressureLineDiversityCoverage: publicPersonaPressureLineDiversityCoverage(safeRows),
    publicShadowPressureLineDiversityCoverage: publicShadowPressureLineDiversityCoverage(safeRows),
    publicShadowTargetLineVariantCoverage: publicShadowTargetLineVariantCoverage(safeRows),
    publicPressureActionLeadVariantCoverage: publicPressureActionLeadVariantCoverage(safeRows),
    publicPressureUrgencyTailVariantCoverage: publicPressureUrgencyTailVariantCoverage(safeRows),
    publicPressureActionLeadDedupCoverage: publicPressureActionLeadDedupCoverage(safeRows),
    evilPublicCoverTextureCoverage: evilPublicCoverTextureCoverage(safeRows),
    evilPublicCoverMaintenanceCoverage: evilPublicCoverMaintenanceCoverage(safeRows),
    evilPublicCoverMaintenanceDedupCoverage: evilPublicCoverMaintenanceDedupCoverage(safeRows),
    evilPublicCoverPivotCoverage: evilPublicCoverPivotCoverage(safeRows),
    evilPublicProtectAllyCoverage: evilPublicProtectAllyCoverage(safeRows),
    evilPublicClaimCoverContinuityCoverage: evilPublicClaimCoverContinuityCoverage(safeRows),
    evilPublicClaimCoverPivotCoverage: evilPublicClaimCoverPivotCoverage(safeRows),
    evilPublicClaimCoverProtectAllyCoverage: evilPublicClaimCoverProtectAllyCoverage(safeRows),
    evilPublicClaimCoverCrossDayCoverage: evilPublicClaimCoverCrossDayCoverage(safeRows),
    evilPublicClaimCoverDeceptionArcCoverage: evilPublicClaimCoverDeceptionArcCoverage(safeRows),
    evilPublicClaimCoverPressureContinuityCoverage: evilPublicClaimCoverPressureContinuityCoverage(safeRows),
    evilPublicClaimCoverPlanDedupCoverage: evilPublicClaimCoverPlanDedupCoverage(safeRows),
    evilPrivateCoordinationCoverage: evilPrivateCoordinationCoverage(safeRows),
    evilPrivateTeamInfoVariantCoverage: evilPrivateTeamInfoVariantCoverage(safeRows),
    evilPrivateCoverPlanVariantCoverage: evilPrivateCoverPlanVariantCoverage(safeRows),
    evilPrivatePressurePlanDedupCoverage: evilPrivatePressurePlanDedupCoverage(safeRows),
    aiToAiEvilCoordinationCoverage: aiToAiEvilCoordinationCoverage(safeRows),
    repetitionRate: repetitionRate(safeRows),
    stanceContinuityRate: stanceContinuityRate(safeRows),
    nominationReasonableRate: nominationReasonableRate(safeRows),
  };
}

export function evaluateAIQualityGates(summary, thresholds = AI_QUALITY_BASELINE_THRESHOLDS) {
  const failures = [];
  const maxGates = ["hiddenLeakCount", "mechanicalArtifactCount", "repetitionRate"];
  const minGates = [
    "evidenceCitationRate",
    "decisionRationaleCoverage",
    "decisionReconsiderationCoverage",
    "decisionConfidenceCalibrationCoverage",
    "decisionVerificationPlanCoverage",
    "decisionEvidenceModeCoverage",
    "decisionEvidenceModeVerificationAlignmentCoverage",
    "decisionResponsePlanCoverage",
    "decisionResponseCriteriaCoverage",
    "decisionEvidenceInteractionCoverage",
    "decisionPressureStageCoverage",
    "decisionCounterEvidenceCoverage",
    "decisionTableRiskCoverage",
    "decisionInformationGainCoverage",
    "decisionTableReactionCoverage",
    "decisionTimingWindowCoverage",
    "decisionWorldBranchCoverage",
    "decisionVoteCoalitionCoverage",
    "decisionSourceReliabilityCoverage",
    "decisionTimelineConsistencyCoverage",
    "decisionIncentiveAlignmentCoverage",
    "decisionBurdenOfProofCoverage",
    "decisionQuestionPriorityCoverage",
    "decisionActionThresholdCoverage",
    "decisionMemoryContinuityCoverage",
    "decisionExpressionDisciplineCoverage",
    "decisionUncertaintyResolutionCoverage",
    "decisionEvidenceFreshnessCoverage",
    "decisionFalsificationCheckCoverage",
    "decisionCausalChainCoverage",
    "decisionAssumptionAuditCoverage",
    "decisionMechanicSensitivityCoverage",
    "decisionRoleHypothesisCoverage",
    "decisionEvidenceBoundaryCoverage",
    "decisionRunnerUpWatchCoverage",
    "runnerUpComparisonCoverage",
    "privateRunnerUpComparisonLineVariantCoverage",
    "strategyRationaleCoverage",
    "nominationActionContextCoverage",
    "nominationStrategyModeCoverage",
    "nominationStrategyPlanDedupCoverage",
    "nominationDefenseResponseCoverage",
    "nominationDefenseResponseVariantCoverage",
    "nominationDefenseInfoDedupCoverage",
    "nominationDefenseReasonAnchorCoverage",
    "highPressureNominationDefenseCounterPressureCoverage",
    "crossScriptNominationDefenseReasonAnchorCoverage",
    "nominationDefenseAwareVoteCoverage",
    "nominationReasonAnchoredDefenseVoteCoverage",
    "nominationReasonAnchoredDefenseVoteLineDiversityCoverage",
    "crossScriptNominationDefenseAwareVoteCoverage",
    "proactiveRationaleCoverage",
    "voteIntentCoverage",
    "claimDisclosureRationaleCoverage",
    "claimDisclosureContinuityCoverage",
    "claimDisclosureContinuityModeCoverage",
    "claimDisclosureSurfaceDedupCoverage",
    "claimDisclosureHoldLeadVariantCoverage",
    "publicClaimHoldLeadVariantCoverage",
    "claimDisclosureBalancedReasonVariantCoverage",
    "crossScriptClaimDisclosureCoverage",
    "privateScriptClaimDeflectCoverage",
    "crossScriptClaimContinuityCoverage",
    "roleConstrainedClaimDisclosureCoverage",
    "roleConstrainedClaimLineDiversityCoverage",
    "crossScriptPublicReasoningCoverage",
    "crossScriptPublicMultiEvidenceCoverage",
    "publicScriptPressureVariantCoverage",
    "publicTimingPressureVariantCoverage",
    "publicRolePressureVariantCoverage",
    "crossScriptPrivateMultiEvidenceCoverage",
    "privateSurfaceReportDisciplineCoverage",
    "privateReasonOpeningRedundancyCoverage",
    "privateReasonOpeningVariantCoverage",
    "privateReasonOpeningLeadVariantCoverage",
    "privateReasonOpeningSentenceCoverage",
    "privateVerificationLeadNaturalizationCoverage",
    "privateDeepReasoningSpokenCoverage",
    "privateTimelineReasoningSpokenCoverage",
    "privateSourceTimelineCompressionCoverage",
    "privateIncentiveReasoningSpokenCoverage",
    "privateBurdenReasoningSpokenCoverage",
    "privateDeepReasoningCompressionCoverage",
    "privateDeepReasoningCompressionVariantCoverage",
    "privateDeepReasoningHeadingVariantCoverage",
    "privateDeepReasoningTailVariantCoverage",
    "privateDeepReasoningBrevityCoverage",
    "privateDeepReasoningLeadDedupCoverage",
    "privateEvidenceSynthesisCoverage",
    "privateEvidenceSynthesisVariantCoverage",
    "privateEvidenceSynthesisVerificationCoverage",
    "privateEvidenceSynthesisSpokenVerificationCoverage",
    "privateEvidenceSynthesisSourceIdentityDedupCoverage",
    "privateEvidenceSynthesisVoteTaxonomyDedupCoverage",
    "formalVoteRationaleCoverage",
    "formalVoteTableContextCoverage",
    "formalVoteLineDiversityCoverage",
    "formalVoteNormalizedLineDiversityCoverage",
    "formalVoteReasonModeCoverage",
    "formalVoteNearThresholdCoverage",
    "formalVoteEvilCoverSafetyCoverage",
    "formalVoteEvidenceBoundaryCoverage",
    "formalVoteMultiEvidenceCompressionCoverage",
    "formalVoteScriptCoverage",
    "crossDayStanceContinuityCoverage",
    "crossDayStanceReasonCoverage",
    "crossDayStanceReasonRecapDedupCoverage",
    "crossDayStanceEvidenceDeltaCoverage",
    "crossDayStanceEvidenceTraceCoverage",
    "crossDayStanceEvidenceAnchorCoverage",
    "crossDayStanceEventAnchorCoverage",
    "crossDayStanceScoreTrailAnchorCoverage",
    "crossDayStanceModeCoverage",
    "crossScriptCrossDayStanceCoverage",
    "crossDayTargetSwitchCoverage",
    "crossScriptCrossDayTargetSwitchCoverage",
    "nonPublicTargetSwitchContinuityCoverage",
    "publicPrioritySignalCoverage",
    "publicFollowUpDedupCoverage",
    "publicFollowUpTemplateDisciplineCoverage",
    "publicFollowUpSpecificityCoverage",
    "publicEvidenceSynthesisCoverage",
    "publicEvidenceSynthesisDedupCoverage",
    "publicEvidenceSynthesisLabelStackCoverage",
    "publicEvidenceAnchorLeadVariantCoverage",
    "publicEvidenceAnchorDedupCoverage",
    "publicEvidenceSynthesisSpokenVerificationCoverage",
    "publicEvidenceSynthesisSpokenVerificationVariantCoverage",
    "publicEvidenceSynthesisExplicitModeCoverage",
    "publicVerificationLeadVariantCoverage",
    "publicFollowUpTailVariantCoverage",
    "publicEvidenceFragmentClarityCoverage",
    "nonPublicEvidenceFragmentClarityCoverage",
    "nonPublicSurfacePolishCoverage",
    "publicSurfacePolishCoverage",
    "publicTableSpeechBrevityCoverage",
    "publicSentenceClosureCoverage",
    "publicGenericOpenerDisciplineCoverage",
    "publicPressureTextureCoverage",
    "publicPersonaPressureVariantCoverage",
    "publicPersonaPressureLineDiversityCoverage",
    "publicShadowPressureLineDiversityCoverage",
    "publicShadowTargetLineVariantCoverage",
    "publicPressureActionLeadVariantCoverage",
    "publicPressureUrgencyTailVariantCoverage",
    "publicPressureActionLeadDedupCoverage",
    "evilPublicCoverTextureCoverage",
    "evilPublicCoverMaintenanceCoverage",
    "evilPublicCoverMaintenanceDedupCoverage",
    "evilPublicCoverPivotCoverage",
    "evilPublicProtectAllyCoverage",
    "evilPublicClaimCoverContinuityCoverage",
    "evilPublicClaimCoverPivotCoverage",
    "evilPublicClaimCoverProtectAllyCoverage",
    "evilPublicClaimCoverCrossDayCoverage",
    "evilPublicClaimCoverDeceptionArcCoverage",
    "evilPublicClaimCoverPressureContinuityCoverage",
    "evilPublicClaimCoverPlanDedupCoverage",
    "evilPrivateCoordinationCoverage",
    "evilPrivateTeamInfoVariantCoverage",
    "evilPrivateCoverPlanVariantCoverage",
    "evilPrivatePressurePlanDedupCoverage",
    "aiToAiEvilCoordinationCoverage",
    "stanceContinuityRate",
    "nominationReasonableRate",
  ];

  maxGates.forEach((key) => {
    if (summary[key] > thresholds[key]) {
      failures.push({ key, expected: `<= ${thresholds[key]}`, actual: summary[key] });
    }
  });
  minGates.forEach((key) => {
    if (summary[key] < thresholds[key]) {
      failures.push({ key, expected: `>= ${thresholds[key]}`, actual: summary[key] });
    }
  });
  return failures;
}

function writeReport(report) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const reportPath = path.join(OUTPUT_DIR, "latest.json");
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return reportPath;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const evaluation = buildAIQualityEvaluationSet();
  const summary = summarizeAIQualityEvaluation(evaluation.rows);
  const failures = evaluateAIQualityGates(summary);
  const reportPath = writeReport({ ...evaluation, summary, failures, generatedAt: new Date().toISOString() });
  console.log(`AI quality eval report: ${reportPath}`);
  console.log(JSON.stringify(summary, null, 2));
  if (failures.length > 0) {
    console.error("AI quality eval gates failed:");
    failures.forEach((failure) => {
      console.error(`- ${failure.key}: ${failure.actual} (${failure.expected})`);
    });
    process.exit(1);
  }
}
