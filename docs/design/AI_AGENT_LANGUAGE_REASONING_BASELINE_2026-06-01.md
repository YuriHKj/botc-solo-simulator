# AI Agent Language And Reasoning Baseline

更新日期：2026-06-05

本文专门记录当前 AI agent 的语言表达质量、逻辑思考深度，以及下一步优化方向。它补充总进度基准，不替代 `AI_AGENT_MVP.md` 和 `AI_EVIDENCE_BOOK.md`。

## 当前分层判断

AI agent 现在已经从“模板 NPC”推进到“证据约束的桌边玩家原型”：

- 能基于个人可见信息发言，而不是读全局真相。
- 能把公开/私有证据、夜间信息、投票、提名、身份声明写进 agent 侧证据簿。
- 能通过 persona、发言记忆、主动私聊、公聊时钟和提名/投票策略形成不同风格。
- 能在可选 LLM polish 下把确定性草稿润色成人话，但 LLM 不参与隐藏信息推理和规则判断。

仍然没有达到“完整长程博弈智能体”：

- 信念仍主要由启发式刷新和 evidence 权重驱动，不是完整的概率世界模型。
- 长局目标、谎言维护、阵营协作和跨日叙事还需要更强的评测与记忆。
- 发言虽然已经明显更自然，但仍会在高压、多证据、预算裁剪时露出结构痕迹。

## 语言表达现状

已具备：

- 公聊有 opening / response / crossfire / nomination-ready / cooldown 等软时钟。
- 私聊能区分身份、理由、信任、投票、夜间信息、比较和计划类问题。
- persona 已影响措辞：pressure 更主动，shadow 更观察，steady 更留余地。
- speech renderer 会做去模板化、预算控制、重复冷却、禁用系统词、防近似照抄和 LLM 输出修复。
- public speech budget now supports priority fragments, so persona marker, target mention, evidence anchor, and next-question intent are preserved together before the line leaves the public-discussion path.
- 邪恶玩家对好人发言会走 performance wording，避免泄露“自己人、恶魔伪装、魔典”等隐藏语言。
- 公开发言会强制使用 seat label，避免把第三方误说成“你”。

主要不足：

- 部分回答仍会像“短报告”，尤其是同时需要解释证据、比较目标、给下一步问题时。
- 公聊 2 句预算已有 persona/target/evidence/question 第一版优先级控制，但情绪纹理和长局谎言维护还需要更细的预算策略。
- 私聊虽然能回答问题，但有时会先讲结论，后续缺少“为什么不是另一个候选人”的比较。
- LLM polish 只改语气，不改变思维深度，所以 deterministic draft 的结构质量仍然是上限。

## 逻辑思考深度现状

已具备：

- `evidenceBook` 记录来源、可见性、可信度、污染风险、是否可能为假。
- `beliefTrailByPlayerId` 记录证据导致的怀疑变化。
- `knowledgeGraph` 记录身份、声明、验证、投票等关系边。
- `buildAIStrategyContext` 已能评估局势窗口、执行压力、投票阈值、邪恶 framing plan 和 coalition vote。
- `buildAIThoughtFrame` 会给出 primary concern、secondary concern、自我披露需求、nomination readiness 和下一步问题。

主要不足：

- thought frame、strategy context 和 evidence contract 还没有完全统一为一个“可解释决策包”。
- AI 可以给出关注目标，但过去不稳定解释“为什么先处理 A 而不是 B”。
- 长期信念轨迹仍是当前刷新解释，不是完整跨日历史。
- 世界候选和邪恶计划已经存在，但还没有广泛进入好人视角的自然语言推理。

## 2026-06-01 本轮改动

本轮新增轻量 top-vs-second 对比推理：

- 新增 `buildReasoningContrastLine(...)`，对比当前 focus target 与 secondary target。
- 对比依据只使用当前 agent 可见信息：怀疑分数、公开/私有证据数量、目标排序。
- 私聊回答现在会在解释怀疑时补一句类似“我先排 A，不是放过 B；A 这边线索更多”。
- 公聊 surface act 也接入同一对比推理，但通过句子预算压缩，避免牺牲证据契约。
- `runPrivateWhisper(...)` 返回新增 `reasoningContrastLine`，方便测试和后续 UI/调试面板展示。
- 补充契约测试 `testPrivateReasonContrastsTopTwoTargets`，验证私聊理由会显式比较第一关注位和第二关注位。

这不是大脑重写，而是一个小的思维深度台阶：AI 开始把“排序原因”说出来，而不仅是报出最高怀疑目标。

## 2026-06-01 Follow-up: Structured Decision Rationale

This follow-up implements the first next-step item below.

- Added a structured `decisionRationale` package while keeping `reasoningContrastLine` as the backward-compatible text line.
- The package records `focusId`, `runnerUpId`, scores, score gap, evidence counts, `reasonKey`, confidence band, risk flags, evidence mode / evidence mode line, verification question / verification line, response plan line, response criteria line, evidence interaction line, pressure stage line, evidence boundary line, counter-evidence line, runner-up watch line, and the rendered contrast line.
- `decisionRationale` now also carries a public-safe `comparisonTrace` with focus-side and runner-up-side reasons, evidence summaries, evidence counts, and score gap. This makes the AI's "why this target instead of the runner-up" reasoning auditable beyond a single numeric rank.
- `decisionRationale` now also carries `reconsiderationKey` and `reconsiderationLine`, so the AI can state what would make it soften, downgrade, or reorder the read instead of only defending the current top target.
- Private whispers now return `decisionRationale` and write it into private timeline / MVP utterance metadata.
- Public discussion speech events, public timeline rows, and MVP utterance metadata now carry `decisionRationale`.
- Nomination proposals now carry `decisionRationale`, so future UI and recap work can explain why this nominee beat the runner-up instead of only showing a final reason string.
- Follow-up implementation now also makes nomination wording consume the same rationale: the spoken nomination reason mentions the runner-up comparison instead of leaving it only in metadata.
- Nomination wording now also consumes `strategyIntent`, `coalition`, and `expectedSupport`: AI can say whether the nomination is a pressure test, a coalition check, an execution push, or a public-reason flow with estimated vote support.
- Added public-safe `strategyRationale` metadata for nomination recap. AI nomination debates and Unity viewmodel now expose display-safe strategy rationale alongside `decisionRationale`, without leaking evil-only strategy labels.
- `decisionRationale` now also supports focus-only nominations with `reasonKey: "only-eligible-target"`, so recap does not break when there is no runner-up candidate.
- Unity viewmodel now builds `rationaleCards` for nomination debates and nomination timeline rows. Cards split the recap into target choice, vote strategy, and next verification question, so UI can render AI reasoning without parsing internal fields.
- Unity nomination debate panel now deserializes and renders those `rationaleCards` as compact target-choice / strategy / verification cards. When old viewmodels do not include cards, the panel keeps the previous three-line debate layout.
- Nomination `decisionRationale` now stores a polished `spokenLine`, and both the actual nomination reason and Unity target-choice card read from that same line. Contract tests now compare proposal text, active debate recap, and timeline recap so the AI cannot say one explanation while showing a different one in UI.
- Public discussion, human-initiated private whispers, and proactive private whispers now also attach `decisionRationale.spokenLine` from the final rendered utterance. Speech events and timeline rows are tested against the same line, so later polish / budget / continuity passes cannot silently desync rationale metadata from what the player actually read.
- Public discussion now runs a priority-fragment budget pass after final target repair. Contract tests cover both the generic budget helper and real public-discussion output, requiring the final line to keep persona marker, target, evidence, and follow-up intent together when those signals are available.
- The fixed AI quality evaluation now gates `publicPrioritySignalCoverage`, measuring whether final public rows preserve persona marker, target mention, evidence anchor, and follow-up intent together. Current fixed snapshot has `publicPrioritySignalCoverage = 1`.
- High-pressure public discussion now forces light emotional texture in the cadence pass, strips generic bridge starters such as `我的意思是` in strong-pressure contexts, and keeps pressure-safe persona prefixes through the final speech-budget pass.
- The fixed AI quality evaluation now gates `publicPressureTextureCoverage`, measuring whether high-focus public rows preserve emotional texture after budget trimming and continuity repair. Current fixed snapshot has `publicPressureTextureCoverage = 1` while `publicPrioritySignalCoverage` remains 1.
- Evil public discussion now has a cover-safe priority fragment in the final speech-budget pass, preserving outward-facing table wording such as `台面上`, `公开说`, `好人视角`, `节奏`, `解围`, or `闭眼冲` without exposing evil-only state.
- Evil public discussion now surfaces public-safe `evilWorldPlanContextLine` for same-focus maintenance only after that AI has already made a visible public statement on the same target, so `还是沿着 ... 这条看，不急着换线` reflects player-visible continuity instead of hidden internal planning.
- Evil public discussion now recovers a recent `soft-pivot` from evil plan history before repeated strategy-context rebuilds collapse it into `hold`, letting the first visible statement on the new target say `这轮先转到 ...，因为台面压力有了新变化`.
- Evil public discussion now gives `protect-ally` mode a public-safe deflection line such as `台面压力别只堆一处，先把 ... 也拉出来对话`, preserving the strategic move without naming the protected ally or exposing evil-only intent.
- Public speech budget now dedupes repeated follow-up cues at the final player-visible text layer, so one line does not keep both `接下来先问 X：身份和昨晚信息` and `让 X 把身份和昨晚信息说清楚`.
- The fixed AI quality evaluation now includes deterministic evil public cover, cover-maintenance, cover-pivot, and protect-ally samples, while also gating public follow-up dedupe, public follow-up template discipline, public follow-up specificity, clipped evidence fragment clarity, non-public evidence fragment clarity, public surface polish, public sentence closure, and public generic opener discipline. Current fixed snapshot is 27 rows with `publicPrioritySignalCoverage = 1`, `publicFollowUpDedupCoverage = 1`, `publicFollowUpTemplateDisciplineCoverage = 1`, `publicFollowUpSpecificityCoverage = 1`, `publicEvidenceFragmentClarityCoverage = 1`, `nonPublicEvidenceFragmentClarityCoverage = 1`, `publicSurfacePolishCoverage = 1`, `publicSentenceClosureCoverage = 1`, `publicGenericOpenerDisciplineCoverage = 1`, `publicPressureTextureCoverage = 1`, `evilPublicCoverTextureCoverage = 1`, `evilPublicCoverMaintenanceCoverage = 1`, `evilPublicCoverPivotCoverage = 1`, `evilPublicProtectAllyCoverage = 1`, and `hiddenLeakCount = 0`.
- Speech-budget priority matching now normalizes `…` and `...`, so evidence fragments are not duplicated just because the renderer and evaluator use different ellipsis forms.
- Unity timeline viewmodel now exports a compact `rationaleSummary`, and the Info Drawer recent timeline rows surface it as `理由：...`. This makes public/private AI reasoning visible in the lightweight recap path instead of requiring raw metadata inspection.
- Unity viewmodel now also builds `aiReasoningRecap` groups by speaker and focus target across the current day. The recap tab renders these as compact reasoning trajectory cards, making it easier to inspect whether an AI is consistently pressuring the same target for coherent reasons.
- `aiReasoningRecap` now carries `evidenceSnippets`, `scoreTrail`, `latestScore`, `previousScore`, `scoreDelta`, and `scoreTrend`. The recap card can show not only the spoken rationale, but also the evidence snippet and whether the target pressure is rising, falling, or steady.
- `scoreTrail` now includes timestamp-aware `evidenceRows` sourced from the speaker agent's `beliefTrailByPlayerId` and linked `evidenceBook` rows, plus the same `comparisonTrace` used by the spoken rationale. This gives the recap a per-event drilldown path from spoken rationale -> score movement -> target-vs-runner-up comparison -> source evidence row.
- The Unity recap tab now renders a dedicated reasoning evidence drilldown card for the selected reasoning track. It surfaces score, score gap, evidence counts, evidence-row text, reliability, contamination risk, and applied score delta.
- The Unity recap tab now also has a reasoning-track selector. When multiple AI/target tracks exist, the player can cycle through them and the reasoning card plus evidence drilldown update together.
- The selected drilldown now lists compact rows for up to 3 visible `scoreTrail` points, including target-vs-runner-up comparison text, so the player can see how suspicion pressure moved instead of only seeing the latest evidence row.
- Added an initial fixed AI quality evaluation set in `scripts/ai_quality_eval.mjs`. It samples deterministic private, proactive-private, public, vote-intent, and nomination rows, then gates hidden-info leakage, mechanical artifacts, evidence citation rate, `decisionRationale` coverage, runner-up comparison coverage, proactive rationale coverage, vote-intent coverage, public priority signal coverage, `strategyRationale` coverage, repetition rate, stance continuity, and nomination reasonability.
- Formal nomination voting now supports public-safe `voteRationale` while preserving the legacy boolean `decideAIVote(...)` API. The detailed path returns `decideAIVoteWithRationale(...)`, and `resolveNominationAndVote(...)` accepts either the old boolean decision or the new `{ vote, voteRationale }` shape.
- Unity vote ceremony viewmodels now export `voters[].voteRationale`, and C# deserialization includes `VoteRationaleViewModel`. This gives the UI a stable data contract for future vote-ceremony explanation cards without changing the vote rules.
- The fixed AI quality evaluation now samples real formal vote decisions and gates `formalVoteRationaleCoverage`, so formal vote explanations are tracked separately from private vote-intent dialogue.
- Formal vote rationale wording now uses deterministic public-safe variants keyed by voter, nominee, persona, reason, evidence count, and margin. The fixed evaluation now gates `formalVoteLineDiversityCoverage`, `formalVoteReasonModeCoverage`, `formalVoteNearThresholdCoverage`, `formalVoteEvilCoverSafetyCoverage`, `formalVoteEvidenceBoundaryCoverage`, `formalVoteMultiEvidenceCompressionCoverage`, and `formalVoteScriptCoverage`; current fixed snapshot has 92 rows, `decisionRationaleCoverage = 1`, `decisionReconsiderationCoverage = 1`, `decisionConfidenceCalibrationCoverage = 1`, `decisionVerificationPlanCoverage = 1`, `decisionEvidenceModeCoverage = 1`, `decisionEvidenceModeVerificationAlignmentCoverage = 1`, `decisionResponsePlanCoverage = 1`, `decisionResponseCriteriaCoverage = 1`, `decisionEvidenceInteractionCoverage = 1`, `decisionPressureStageCoverage = 1`, `decisionCounterEvidenceCoverage = 1`, `decisionTableRiskCoverage = 1`, `decisionInformationGainCoverage = 1`, `decisionTableReactionCoverage = 1`, `decisionTimingWindowCoverage = 1`, `decisionWorldBranchCoverage = 1`, `decisionVoteCoalitionCoverage = 1`, `decisionEvidenceBoundaryCoverage = 1`, `decisionRunnerUpWatchCoverage = 1`, `formalVoteRationaleCoverage = 1`, `formalVoteLineDiversityCoverage = 0.957`, `formalVoteReasonModeCoverage = 1`, `formalVoteNearThresholdCoverage = 1`, `formalVoteEvilCoverSafetyCoverage = 1`, `formalVoteEvidenceBoundaryCoverage = 1`, `formalVoteMultiEvidenceCompressionCoverage = 1`, `formalVoteScriptCoverage = 1`, `crossScriptClaimDisclosureCoverage = 1`, `crossScriptClaimContinuityCoverage = 1`, `roleConstrainedClaimDisclosureCoverage = 1`, `crossScriptPublicReasoningCoverage = 1`, `crossScriptPublicMultiEvidenceCoverage = 1`, `publicPersonaPressureVariantCoverage = 1`, `publicScriptPressureVariantCoverage = 1`, `publicTimingPressureVariantCoverage = 1`, `publicRolePressureVariantCoverage = 1`, `publicEvidenceSynthesisCoverage = 1`, `publicEvidenceSynthesisDedupCoverage = 1`, `crossScriptPrivateMultiEvidenceCoverage = 1`, `privateEvidenceSynthesisCoverage = 1`, `privateEvidenceSynthesisVariantCoverage = 1`, `evilPrivateCoordinationCoverage = 1`, `aiToAiEvilCoordinationCoverage = 1`, `evilPublicClaimCoverContinuityCoverage = 1`, `evilPublicClaimCoverPivotCoverage = 1`, `evilPublicClaimCoverProtectAllyCoverage = 1`, `evilPublicClaimCoverCrossDayCoverage = 1`, `evilPublicClaimCoverDeceptionArcCoverage = 1`, `crossScriptCrossDayStanceCoverage = 1`, `crossDayStanceContinuityCoverage = 1`, `crossDayStanceEvidenceDeltaCoverage = 1`, `crossDayStanceEvidenceTraceCoverage = 1`, `crossDayStanceEvidenceAnchorCoverage = 1`, `crossDayStanceEventAnchorCoverage = 1`, `crossDayStanceScoreTrailAnchorCoverage = 1`, `publicPrioritySignalCoverage = 1`, `evidenceCitationRate = 0.913`, `repetitionRate = 0.286`, `stanceContinuityRate = 1`, and `hiddenLeakCount = 0`.
- After adding `burdenOfProofLine`, the latest fixed snapshot remains 92 rows with `decisionBurdenOfProofCoverage = 1`, `hiddenLeakCount = 0`, and `repetitionRate = 0.286`, still below the 0.35 gate.
- After adding `questionPriorityLine`, the latest fixed snapshot remains 92 rows with `decisionQuestionPriorityCoverage = 1`, `hiddenLeakCount = 0`, and `repetitionRate = 0.295`, still below the 0.35 gate.
- After adding `actionThresholdLine`, the latest fixed snapshot remains 92 rows with `decisionActionThresholdCoverage = 1`, `hiddenLeakCount = 0`, and `repetitionRate = 0.308`, still below the 0.35 gate.
- After adding `memoryContinuityLine`, the latest fixed snapshot remains 92 rows with `decisionMemoryContinuityCoverage = 1`, `hiddenLeakCount = 0`, and `repetitionRate = 0.308`, still below the 0.35 gate.
- After adding `expressionDisciplineLine`, the latest fixed snapshot remains 92 rows with `decisionExpressionDisciplineCoverage = 1`, `hiddenLeakCount = 0`, and `repetitionRate = 0.312`, still below the 0.35 gate.
- After adding `uncertaintyResolutionLine`, the latest fixed snapshot remains 92 rows with `decisionUncertaintyResolutionCoverage = 1`, `hiddenLeakCount = 0`, and `repetitionRate = 0.312`, still below the 0.35 gate.
- After adding `evidenceFreshnessLine`, the latest fixed snapshot remains 92 rows with `decisionEvidenceFreshnessCoverage = 1`, `hiddenLeakCount = 0`, and `repetitionRate = 0.312`, still below the 0.35 gate.
- After adding `falsificationCheckLine`, the latest fixed snapshot remains 92 rows with `decisionFalsificationCheckCoverage = 1`, `hiddenLeakCount = 0`, and `repetitionRate = 0.312`, still below the 0.35 gate.
- After adding `causalChainLine`, the latest fixed snapshot remains 92 rows with `decisionCausalChainCoverage = 1`, `hiddenLeakCount = 0`, and `repetitionRate = 0.316`, still below the 0.35 gate.
- After adding `assumptionAuditLine`, the latest fixed snapshot remains 92 rows with `decisionAssumptionAuditCoverage = 1`, `hiddenLeakCount = 0`, and `repetitionRate = 0.312`, still below the 0.35 gate.
- After adding `mechanicSensitivityLine`, the latest fixed snapshot remains 92 rows with `decisionMechanicSensitivityCoverage = 1`, `hiddenLeakCount = 0`, and `repetitionRate = 0.312`, still below the 0.35 gate.
- After adding `roleHypothesisLine`, the latest fixed snapshot remains 92 rows with `decisionRoleHypothesisCoverage = 1`, `hiddenLeakCount = 0`, and `repetitionRate = 0.312`, still below the 0.35 gate.
- After tightening private surface rationale selection and extending it to proactive / ordinary AI-AI private speech, the latest fixed snapshot remains 92 rows with `privateSurfaceReportDisciplineCoverage = 1`, `hiddenLeakCount = 0`, and `repetitionRate = 0.286`, still below the 0.35 gate.
- After varying public-safe role-constrained claim-disclosure openings by reason key, the latest fixed snapshot remains 92 rows with `roleConstrainedClaimLineDiversityCoverage = 1`, `roleConstrainedClaimDisclosureCoverage = 1`, `hiddenLeakCount = 0`, and `repetitionRate = 0.278`, still below the 0.35 gate.
- After salting high-pressure multi-evidence persona openings with target/persona/evidence context, the latest fixed snapshot remains 92 rows with `publicPersonaPressureLineDiversityCoverage = 1`, `publicShadowPressureLineDiversityCoverage = 0.818`, `publicPersonaPressureVariantCoverage = 1`, `hiddenLeakCount = 0`, and `repetitionRate = 0.269`, still below the 0.35 gate.
- After extending cross-day evil claim-cover pressure continuity to BMR/SnV, the latest fixed snapshot is 94 rows with `evilPublicClaimCoverPressureContinuityCoverage = 1`, `evilPublicClaimCoverDeceptionArcCoverage = 1`, `publicShadowPressureLineDiversityCoverage = 0.923`, `hiddenLeakCount = 0`, and `repetitionRate = 0.271`, still below the 0.35 gate.
- Cross-day stance metadata now includes `evidenceDelta` and `changeSummary`. Hold rows can say the evidence volume did not drop, while shift rows can say the pressure changed because visible evidence increased, giving the AI a more legible memory of why its stance moved.
- Cross-day stance metadata now also carries `previousEvidenceSnippets` / `currentEvidenceSnippets`, `previousEvidenceAnchors` / `currentEvidenceAnchors`, `previousEventAnchors` / `currentEventAnchors`, and `previousScoreTrailAnchors` / `currentScoreTrailAnchors`, sourced from the same public/private evidence summaries, dialogue source event, and belief/stance score movement used in the spoken rationale. The fixed evaluation gates `crossDayStanceEvidenceTraceCoverage`, `crossDayStanceEvidenceAnchorCoverage`, `crossDayStanceEventAnchorCoverage`, and `crossDayStanceScoreTrailAnchorCoverage`, proving the current stance can be traced back to concrete visible snippets, their `evidenceId` / `observationId` anchors, the `timelineEntryId` / `source` / `timestamp` that triggered the stance update, and the before/after/appliedDelta score movement.
- Stance continuity is now scoped by `qualityRunId + speakerId` and ignores proactive private disclosure rows, so the metric checks same-run pressure/nomination continuity instead of accidentally comparing unrelated fixed fixtures that reuse the same seat id.
- Formal vote edge fixtures now cover public-safe reason modes including evidence-backed yes, pressure-threshold yes, evidence-below-threshold no, pressure-below-threshold no, ghost-vote pressure, and cannot-vote. Ghost-vote lines explicitly mention the public ghost vote while avoiding hidden-role or evil-only language.
- Formal vote boundary fixtures now cover near-threshold yes/no hesitation and full-path Butler-blocked resolution. Near-threshold lines say they are `贴线` / `勉强` / `刚过` / `差一点`, and Butler-blocked lines keep `reasonKey: "butler-restricted"` while naming the nominee in the rendered explanation.
- Evil-side formal vote fixtures now cover the hidden-strategy boundary that public speech already had: an evil voter can avoid voting on a known teammate with `table-balance-no` wording, or rarely follow the execution window with `execution-window-yes`, while the player-visible line stays in table terms such as pressure balance, vote shape, process, or execution window.
- Evidence-backed formal vote boundary fixtures now cover near-threshold yes/no cases where public evidence exists but the margin is close. Lines must preserve both the evidence anchor (`证据` / `线索` / `公开证据`) and the boundary marker (`贴线` / `刚过` / `差一点` / `过线`), so the AI explains not only uncertainty, but why the evidence did or did not cross the execution line.
- Multi-evidence formal vote fixtures now cover yes/no cases with at least two public evidence rows. Lines must compress multiple rows into table-readable wording such as `多条证据合在一起` or `两条线索够讨论，但还没合成处决票`, so the AI explains evidence accumulation instead of repeating a flat conclusion.
- Cross-script formal vote fixtures now include BMR and SnV evidence-backed samples in addition to the TB baseline, giving formal vote rationale its first fixed cross-script language contract.
- Claim disclosure now has a structured `claimDisclosureRationale` package for public discussion, private claim answers, and proactive private info sharing. It records disclosure level, previous level, reason key, pressure/trust/self-heat scores, range metadata, and a final `spokenLine` synced to the rendered text.
- Public disclosure rationale is explicitly leak-safe: range/vague/withhold decisions do not expose exact `roleId` or `roleName`; only hard claims or already-public claims may carry the visible claimed role.
- Unity timeline viewmodel now exports `claimDisclosureRationale`, and `rationaleSummary` can summarize identity-disclosure reasoning. The fixed AI quality evaluation now gates `claimDisclosureRationaleCoverage` alongside vote and nomination rationale.
- `claimDisclosureRationale` now also carries public-safe claim-line continuity metadata: `continuity` classifies `new` / `hold` / `escalate` / `revise`, and `continuityLine` explains whether the agent is preserving, upgrading, or changing an identity line. Repeat claim prompts now have fixed contract coverage so an agent cannot silently flip or reframe its identity story without metadata.
- Claim-line revision metadata now includes public-safe previous/current movement fields. When both sides of a revision are hard-claim-visible, rationale exports `previousRoleId`, `previousRoleName`, `previousRangeLabel`, and `continuitySummary`, so recap paths can show movements like `改口：圣徒 -> 守鸦人` instead of only a generic "changed claim" tag.
- Cross-script private claim-disclosure fixtures now include BMR and SnV identity-question samples. They gate `crossScriptClaimDisclosureCoverage = 1`, proving private claim rationale can carry disclosure level, rationale line, and table-readable identity-lane wording beyond the TB baseline without leaking hidden truth.
- Cross-script claim-continuity fixtures now include BMR and SnV `hold`, `escalate`, and `revise` identity-line samples. They gate `crossScriptClaimContinuityCoverage = 1`, proving identity disclosure can preserve, upgrade, or revise a prior claim line beyond the TB baseline while exporting previous/current movement metadata.
- Cross-script public reasoning fixtures now include BMR and SnV public-discussion samples. They gate `crossScriptPublicReasoningCoverage = 1`, proving public speech can carry script id, focus target, final spoken rationale, public evidence anchor, and table-action follow-up beyond the TB baseline.
- Cross-script public multi-evidence fixtures now include BMR and SnV high-pressure public-discussion samples with multiple visible evidence rows. They gate `crossScriptPublicMultiEvidenceCoverage = 1`, proving public speech can compress identity, voting, and pressure evidence into a readable table line while keeping an actionable follow-up.
- Public persona pressure fixtures now include deterministic pressure, shadow, and steady high-pressure multi-evidence rows. They gate `publicPersonaPressureVariantCoverage = 1`, proving public speech can say "directly press", "keep a wary eye", or "not lock but demand a grounded explanation" while preserving multi-evidence compression.
- Public script pressure fixtures now require BMR/SnV public multi-evidence rows to carry script-aware public context. They gate `publicScriptPressureVariantCoverage = 1`, proving BMR can mention death/protection pressure and SnV can mention identity/madness pressure without leaking hidden state.
- Public timing pressure fixtures now include deterministic nomination-pressure and vote-intent rows. They gate `publicTimingPressureVariantCoverage = 1`, proving high-pressure public speech can distinguish pre-nomination pressure from vote-intent pressure while preserving multi-evidence compression.
- Public role pressure fixtures now include deterministic info-claim, outsider-risk, death-trigger, protection, and public-action public-claim rows. They gate `publicRolePressureVariantCoverage = 1`, proving high-pressure public speech can pressure visible role claims without using hidden role truth.
- Public evidence synthesis fixtures now require high-pressure public multi-evidence rows to explain how evidence families connect, not just say that there are multiple clues. They gate `publicEvidenceSynthesisCoverage = 1`, and `publicEvidenceSynthesisDedupCoverage = 1` now prevents the same synthesis phrase from being repeated in one public line.
- Cross-script private multi-evidence fixtures now include BMR and SnV reason replies that combine false public claim, public low-evidence accusation, vote-shape conflict, and night-info chains. They gate `crossScriptPrivateMultiEvidenceCoverage = 1`, `privateEvidenceSynthesisCoverage = 1`, and `privateEvidenceSynthesisVariantCoverage = 1`, proving private answers can verbalize multiple clue families with `两条线索合在一起` while covering low-evidence-vs-identity, vote-vs-identity, and night-info-vs-identity synthesis modes.
- Evil private coordination fixtures now include TB, BMR, and SnV same-team private rows. They gate `evilPrivateCoordinationCoverage = 1`, proving hidden-allowed evil private replies can preserve team confirmation, true identity, public cover, and a target-pressure plan without affecting ordinary hidden-leak gates.
- AI-AI evil coordination fixtures now include TB, BMR, and SnV hidden private rows generated by `runAIToAIPrivateWhispers(...)`. They gate `aiToAiEvilCoordinationCoverage = 1`, proving hidden AI-AI planning can carry team context, a pressure target, and a table-facing reason without leaking into the human timeline/log.
- Role-constrained claim-disclosure fixtures now include SnV madness-pressure, BMR outsider-risk, SnV Mutant, SnV Sweetheart, SnV Barber, and TB death-trigger timing rows. They gate `roleConstrainedClaimDisclosureCoverage = 1`, proving public disclosure rationale can explain why an AI keeps an identity line below hard-claim without exposing exact hidden role metadata.
- Evil public claim-cover fixtures now include a deterministic already-claimed evil public row. They gate `evilPublicClaimCoverContinuityCoverage = 1`, proving an evil AI can keep saying the same public claimed role in table-safe language without leaking the true hidden role or internal bluff plan.
- Evil public claim-cover pivot fixtures now include a deterministic row where one speech keeps the visible claimed role while pivoting pressure to a new target. It gates `evilPublicClaimCoverPivotCoverage = 1`, proving the AI can say "target can change, public identity line stays stable" without exposing hidden evil intent.
- Evil public claim-cover protect-ally fixtures now include a deterministic row where one speech keeps the visible claimed role while distributing pressure away from an ally. It gates `evilPublicClaimCoverProtectAllyCoverage = 1`, proving the AI can say "pressure can be distributed, public identity line stays stable" without exposing hidden ally relationships.
- Evil public claim-cover cross-day fixtures now include a deterministic day-two public row. It gates `evilPublicClaimCoverCrossDayCoverage = 1`, proving the AI can carry yesterday's public claimed role into today's public pressure without leaking hidden evil intent.
- Evil public claim-cover long deception fixtures now combine the separate pieces into one generated arc: first maintain the public claimed role, then pivot targets under that role, then carry the role into day two with explicit "yesterday identity line / today pressure split" wording while splitting pressure away from an ally. It gates `evilPublicClaimCoverDeceptionArcCoverage = 1`, proving the prior pivot line and final cross-day protect line can coexist without hidden evil leaks.
- Cross-script cross-day stance fixtures now include BMR and SnV hold/shift public-discussion samples. They gate `crossScriptCrossDayStanceCoverage = 1`, proving cross-day stance continuity can verbalize both "yesterday also pressed this target" and "yesterday watched, today shifted to pressure" beyond the TB baseline.
- Public surface polish now repairs human-target follow-up artifacts such as `让 你 把身份和昨晚信息说清楚` into actionable player-facing wording, and the fixed evaluator treats that broken phrase plus `X号 我...` spacing as public-speech regressions.
- Unity timeline `rationaleSummary` now merges `claimDisclosureRationale.continuitySummary` / `continuityLine` before the spoken claim line, making identity-line continuity visible in lightweight timeline recaps without inspecting raw metadata.
- Unity `aiReasoningRecap.evidenceSnippets` now also includes `claim-disclosure` snippets sourced from claim continuity metadata. This lets the reasoning recap card show identity-line continuity alongside timeline evidence, decision counts, target-vs-runner-up comparison, and cross-day stance snippets.
- Exported `scoreTrail` points now preserve normalized `claimDisclosureRationale`, so a selected reasoning track can explain identity-line hold/escalate/revise state at the same point as score movement, source evidence, target-vs-runner-up comparison, and cross-day stance.
- Exported `scoreTrail` points now also include `timelineEntryId`, `timelineIndex`, `timelineText`, and `timestamp`, giving each reasoning score movement a stable anchor back to the exact timeline utterance that produced it.
- Added a bounded cross-day `stanceHistoryBySpeakerId` ledger. `rememberDayStance(...)` still preserves the same-day stance bucket, but now also records per-speaker / per-target daily stance history and returns public-safe `crossDayStance` metadata when today's stance has a prior-day anchor.
- Public discussion, human-initiated private replies, proactive private whispers, and AI-AI private whispers can now verbalize cross-day continuity with compact lines such as "昨天也盯 3号，这不是新起线" or a public-safe stance shift line when the AI changes pressure level.
- Speech events, timeline rows, MVP utterance metadata, proactive whisper offers, and `runPrivateWhisper(...)` / `runAIConversationStep(...)` results now preserve `crossDayStance` where relevant, so future UI recap work can inspect whether an agent is carrying or shifting a line across days.
- The fixed AI quality evaluation now includes deterministic day-two public samples and gates `crossDayStanceContinuityCoverage`. Current fixed snapshot: 23 rows, 2 cross-day rows, `crossDayStanceContinuityCoverage = 1`, `claimDisclosureContinuityCoverage = 1`, `claimDisclosureContinuityModeCoverage = 1`, `stanceContinuityRate = 0.714`, no hidden leaks or mechanical artifacts.
- `stanceHistoryBySpeakerId` now also stores compact evidence reasons (`reasonSummary`, `lastReasonSummary`, `evidenceCount`) for each daily stance record. Cross-day shift lines can now say why the stance changed, not only that it changed.
- The fixed AI quality evaluation now gates `crossDayStanceReasonCoverage`, `crossDayStanceModeCoverage`, `claimDisclosureContinuityCoverage`, and `claimDisclosureContinuityModeCoverage` in addition to continuity wording. Current fixed snapshot remains 23 rows with 2 cross-day rows: 1 hold row and 1 shift row, `crossDayStanceContinuityCoverage = 1`, `crossDayStanceReasonCoverage = 1`, `crossDayStanceModeCoverage = 1`, `claimDisclosureContinuityCoverage = 1`, `claimDisclosureContinuityModeCoverage = 1`, and `stanceContinuityRate = 0.714`; the forced revision fixture now proves the previous -> current claim movement is exported without hidden leaks.
- Unity timeline viewmodel now normalizes `crossDayStance`, merges its summary into `rationaleSummary`, adds it as a reasoning recap evidence snippet, and preserves its snippets, evidence anchors, event anchors, and score-trail anchors on each exported `scoreTrail` point. This makes "yesterday I held this line" / "today I shifted because..." visible in the recap path instead of staying as raw AI metadata.
- Public discussion, human-initiated private replies, proactive private whispers, and ordinary AI-AI private whispers now surface `decisionRationale.reconsiderationLine` when there is room. The fixed evaluator gates `decisionReconsiderationCoverage = 1`, and Unity nomination verification cards prefer the same reconsideration line over the older generic verification question.
- `decisionRationale` now also exports `confidenceLine`, derived from `confidenceBand` plus target/runner-up context. Public discussion, human-initiated private replies, proactive private whispers, and ordinary AI-AI private whispers can surface whether the read is clear, leaning, close, or only a verification entry; the fixed evaluator gates `decisionConfidenceCalibrationCoverage = 1`, and Unity nomination rationale cards preserve the same calibration line.
- `decisionRationale` now also exports `evidenceMode` and `evidenceModeLine`, derived from the focus target's visible evidence summaries. It classifies whether the read is driven by claim line, vote/nomination shape, night-info chain, private rumor, public speech rhythm, low-evidence posture, evidence-count accumulation, or mixed evidence; private/proactive/AI-AI channels and Unity nomination cards preserve the line, and the fixed evaluator gates `decisionEvidenceModeCoverage = 1`.
- `decisionRationale` now also exports `verificationLine`, derived from `reasonKey`, evidence mode, and target/runner-up context. Private replies prefer it as the concrete next-step follow-up, proactive/private AI channels preserve it, Unity nomination verification cards render it directly, and the fixed evaluator gates both `decisionVerificationPlanCoverage = 1` and `decisionEvidenceModeVerificationAlignmentCoverage = 1`.
- `decisionRationale` now also exports `responsePlanLine`, derived from `reasonKey`, confidence band, and runner-up context. It states how the AI will classify the target's answer: lower pressure, revisit the runner-up, continue pressure, or move toward nomination pressure; private/proactive/AI-AI channels and Unity nomination verification cards preserve it, and the fixed evaluator gates `decisionResponsePlanCoverage = 1`.
- `decisionRationale` now also exports `responseCriteriaLine`, derived from `evidenceMode`, `reasonKey`, and runner-up context. It turns the response plan into a judging rubric: what answer lowers pressure, what answer keeps pressure, and when runner-up ordering changes. Private replies surface it directly, public speech preserves it when the line stays short, Unity nomination rationale cards include it, and the fixed evaluator gates `decisionResponseCriteriaCoverage = 1`.
- `decisionRationale` now also exports `evidenceInteractionLine`, derived from `evidenceMode`, `reasonKey`, risk flags, and runner-up context. It explains whether evidence families reinforce, weaken, or gate each other: claim continuity can downgrade vote pressure, a broken claim can merge vote/speech pressure, private rumor must connect to public evidence, repeated rows are downweighted, and close calls need a new independent line. Private replies surface it directly, public speech preserves it when the line stays short, Unity nomination rationale cards include it, and the fixed evaluator gates `decisionEvidenceInteractionCoverage = 1`.
- `decisionRationale` now also exports `pressureStageLine`, derived from confidence band, reason key, evidence count, score, and risk flags. It classifies the current target as observation, verification entry, comparison tier, main pressure, pre-nomination review, or nomination pressure, then names the escalation boundary. Private replies surface it directly, public speech preserves it when the line stays short, Unity nomination rationale cards include it, and the fixed evaluator gates `decisionPressureStageCoverage = 1`.
- `decisionRationale` now also exports `counterEvidenceLine`, derived from `reasonKey`, evidence mode, and risk flags. It states the plausible non-evil / non-final alternative explanation for the current target: rumor distortion, night-info contamination, self-preservation vote shape, temporary claim adjustment, repeated evidence pollution, low-evidence observation, or close-score uncertainty. Private replies surface it directly, public speech preserves it when the line stays short, Unity nomination rationale cards include it, and the fixed evaluator gates `decisionCounterEvidenceCoverage = 1`.
- `decisionRationale` now also exports `tableRiskLine`, derived from `reasonKey`, evidence mode, confidence band, score, and risk flags. It names the table-level cost of pressuring the current target: wasting execution pressure on thin evidence, leaking private-rumor logic into public speech, tunnel-visioning past the runner-up, splitting close votes, or turning vote-shape pressure into blind bandwagoning. Unity nomination rationale cards preserve it, and the fixed evaluator gates `decisionTableRiskCoverage = 1`.
- `decisionRationale` now also exports `informationGainLine`, derived from evidence mode, reason key, confidence band, and risk flags. It states what the next question is meant to separate: rumor distortion versus target evasion, night-info contamination versus role-chain breakage, self-preservation votes versus active pushes, observation versus pressure upgrade, or target/runner-up reorder. Unity nomination rationale cards preserve it, and the fixed evaluator gates `decisionInformationGainCoverage = 1`.
- `decisionRationale` now also exports `tableReactionLine`, derived from evidence mode, reason key, confidence band, and risk flags. It states what table reactions the AI will watch after pressuring the target: unexplained pile-ons, sudden defenses, topic shifts, selective stance-taking between close candidates, or players steering away from the runner-up. Unity nomination rationale cards preserve it, and the fixed evaluator gates `decisionTableReactionCoverage = 1`.
- `decisionRationale` now also exports `timingWindowLine`, derived from day stage, public round count, debate beat, nomination clock, confidence band, and risk flags. It states whether the current pressure belongs in private information gathering, early public probing, later public pre-nomination review, vote-intent conversion, or the nomination/vote window. Unity nomination rationale cards preserve it, and the fixed evaluator gates `decisionTimingWindowCoverage = 1`.
- `decisionRationale` now also exports `worldBranchLine`, derived from evidence mode, reason key, risk flags, and runner-up context. It states what changes if the target's explanation holds or breaks: good-identity branches recover, bad-identity lines stay live, pressure can return to the runner-up, or close worlds remain side-by-side until identity/vote evidence breaks the tie. Unity nomination rationale cards preserve it, and the fixed evaluator gates `decisionWorldBranchCoverage = 1`.
- `decisionRationale` now also exports `voteCoalitionLine`, derived from evidence mode, reason key, confidence band, timing context, and runner-up risk. It states whether the current pressure can become a reasoned vote coalition, should remain a pressure table, must avoid split votes, or should wait for supporters to give public reasons. Unity nomination rationale cards preserve it, and the fixed evaluator gates `decisionVoteCoalitionCoverage = 1`.
- `decisionRationale` now also exports `sourceReliabilityLine`, derived from evidence mode, evidence count, public-only risk, and runner-up context. It states whether the current read rests on independent, public-verifiable evidence or should be downweighted as private rumor, single-source evidence, same-source echo, or contaminated timing. Unity nomination rationale cards preserve it, and the fixed evaluator gates `decisionSourceReliabilityCoverage = 1`.
- `decisionRationale` now also exports `timelineConsistencyLine`, derived from evidence mode, reason key, public round, nomination/vote beat, and runner-up context. It checks whether claims, votes, night-info references, and public responses appear in a coherent order instead of only as static evidence fragments. Unity nomination rationale cards preserve it, and the fixed evaluator gates `decisionTimelineConsistencyCoverage = 1`.
- `decisionRationale` now also exports `incentiveAlignmentLine`, derived from evidence mode, reason key, confidence band, risk flags, and runner-up context. It states whose incentives the behavior serves: solving the table, self-preservation, protecting another player, following pressure, or moving heat away. Unity nomination rationale cards preserve it, and the fixed evaluator gates `decisionIncentiveAlignmentCoverage = 1`.
- `decisionRationale` now also exports `burdenOfProofLine`, derived from evidence mode, reason key, confidence band, public-only constraints, and runner-up context. It assigns who must explain the current pressure: the target, vote followers, defenders, or the second-pressure lane, so the AI does not silently supply excuses for players. Unity nomination rationale cards preserve it, and the fixed evaluator gates `decisionBurdenOfProofCoverage = 1`.
- `decisionRationale` now also exports `questionPriorityLine`, derived from evidence mode, reason key, confidence band, public-only constraints, and runner-up context. It orders the next table question: who is asked first, which public evidence family comes next, and when the runner-up lane must be revisited. Unity nomination rationale cards preserve it, and the fixed evaluator gates `decisionQuestionPriorityCoverage = 1`.
- `decisionRationale` now also exports `actionThresholdLine`, derived from evidence mode, reason key, confidence band, focus score, public-only constraints, and nomination context. It states whether the AI should only observe, keep pressuring, enter nomination review, or convert to an execution vote, and what public response would change that commitment. Unity nomination rationale cards preserve it, and the fixed evaluator gates `decisionActionThresholdCoverage = 1`.
- `decisionRationale` now also exports `memoryContinuityLine`, derived from same-day stance memory, cross-day stance metadata, evidence mode, evidence count, and cross-target prior-day pressure. It states whether the read is a new record, a same-day continuation, a cross-day hold, a shift caused by evidence changes, or a deliberate move from yesterday's main pressure to today's main pressure, so the AI's current pressure can be audited against memory instead of feeling freshly recomputed. Unity nomination rationale cards preserve it, and the fixed evaluator gates `decisionMemoryContinuityCoverage = 1`.
- `decisionRationale` now also exports `expressionDisciplineLine`, derived from evidence mode, reason key, confidence band, risk flags, public-only constraints, and runner-up context. It states how the AI should phrase the read: probe instead of verdict, comparison instead of lock, public-safe wording instead of private leakage, and conditional escalation instead of unconditional execution. Unity nomination rationale cards preserve it, and the fixed evaluator gates `decisionExpressionDisciplineCoverage = 1`.
- `decisionRationale` now also exports `uncertaintyResolutionLine`, derived from evidence mode, reason key, confidence band, risk flags, public-only constraints, and runner-up context. It states what uncertainty remains and what public response, evidence row, or timeline link would resolve it, so the AI can name the missing piece instead of only piling on reasons. Unity nomination rationale cards preserve it, and the fixed evaluator gates `decisionUncertaintyResolutionCoverage = 1`.
- `decisionRationale` now also exports `evidenceFreshnessLine`, derived from evidence mode, reason key, confidence band, risk flags, visible evidence count, and stance memory. It distinguishes fresh evidence, stale lines, repeated same-source evidence, and current-response refresh, so the AI does not keep spending old reasons as if they were new pressure. Unity nomination rationale cards preserve it, and the fixed evaluator gates `decisionEvidenceFreshnessCoverage = 1`.
- `decisionRationale` now also exports `falsificationCheckLine`, derived from evidence mode, reason key, confidence band, risk flags, public-only constraints, and runner-up context. It states what public response or evidence would falsify, downgrade, or redirect the current read, so the AI can actively name how it could be wrong instead of only defending the pressure line. Unity nomination rationale cards preserve it, and the fixed evaluator gates `decisionFalsificationCheckCoverage = 1`.
- `decisionRationale` now also exports `causalChainLine`, derived from evidence mode, reason key, confidence band, risk flags, public-only constraints, and runner-up context. It states how the observed behavior changes the public explanation space, table pressure, vote window, or identity chain before becoming a read, so the AI explains the causal path behind pressure instead of merely listing evidence labels. Unity nomination rationale cards preserve it, and the fixed evaluator gates `decisionCausalChainCoverage = 1`.
- `decisionRationale` now also exports `assumptionAuditLine`, derived from evidence mode, reason key, confidence band, risk flags, public-only constraints, and runner-up context. It states which premise the read depends on, such as whether a vote was not pure self-preservation, whether private input can become a public contradiction, whether multiple evidence rows are independent, or whether night information may be poisoned or contaminated. Unity nomination rationale cards preserve it, and the fixed evaluator gates `decisionAssumptionAuditCoverage = 1`.
- `decisionRationale` now also exports `mechanicSensitivityLine`, derived from evidence mode, reason key, confidence band, risk flags, public-only constraints, and runner-up context. It states which BOTC mechanics constrain the read, such as drunk/poisoned information, death/protection chains, identity registration, nomination/execution windows, and the boundary between private perspective and public rule conclusions. Unity nomination rationale cards preserve it, and the fixed evaluator gates `decisionMechanicSensitivityCoverage = 1`.
- `decisionRationale` now also exports `roleHypothesisLine`, derived from evidence mode, reason key, confidence band, risk flags, public-only constraints, and runner-up context. It splits the read into public-safe good-role and bad-role hypotheses: whether a good identity line can explain role ability, vote shape, speech, and timing, or whether the behavior is better modeled as bad-role cover, pressure avoidance, or claim repair. Unity nomination rationale cards preserve it, and the fixed evaluator gates `decisionRoleHypothesisCoverage = 1`.
- Private surface speech now selects a small intent-aware subset of rationale fragments before speech budgeting. Reason/suspect replies prioritize the concrete verification direction plus role-hypothesis reasoning, vote replies prioritize response classification and action threshold, and plan replies preserve the next-step direction. Human-initiated private replies, proactive private whispers, and ordinary AI-AI private whispers strip report headings such as `追问顺序：`, `角色假说：`, and `机制敏感性：`; the fixed evaluator gates `privateSurfaceReportDisciplineCoverage = 1`.
- `decisionRationale` now also exports `evidenceBoundaryLine`, derived from `riskFlags`. It verbalizes when evidence is thin, the score gap is close, the runner-up has real evidence, or the read is public-only; private/proactive/AI-AI channels can surface it, Unity nomination target cards preserve it, and the fixed evaluator gates `decisionEvidenceBoundaryCoverage = 1`.
- `decisionRationale` now also exports `runnerUpWatchLine`, derived from the same top-vs-runner-up decision package. It keeps the second candidate visible as a watchable pressure slot, explains when the AI will revisit or reorder the read, preserves that line in private/proactive/AI-AI channels and Unity nomination cards, and the fixed evaluator gates `decisionRunnerUpWatchCoverage = 1`.
- Role-constrained public claim disclosure now uses reason-key-specific opening variants for madness pressure, risky outsider scripts, Mutant, Sweetheart, Barber, and death-trigger roles. The AI still withholds exact public role metadata when constrained, but the player-facing line no longer collapses into one repeated `我暂时保留具体身份` template; the fixed evaluator gates `roleConstrainedClaimLineDiversityCoverage = 1`.
- High-pressure multi-evidence public speech now chooses persona-pressure openings from target/persona/evidence context instead of seat-only modulo selection. This keeps shadow/evil cover lines from repeatedly starting with the same `这不是单点感觉` stem while preserving the same target, evidence, and follow-up signals; the fixed evaluator gates `publicPersonaPressureLineDiversityCoverage = 1` and `publicShadowPressureLineDiversityCoverage >= 0.8`.
- Long-arc evil public claim-cover speech now distinguishes stable identity cover from visible pressure continuity across TB/BMR/SnV: when the same target was already pressured in a prior public arc, the cross-day line can say `昨天已经盯过 4号这条` while still keeping the public claimed role stable and avoiding hidden-team language. Shadow high-pressure openers are also salted by target/script/cover context so the added cross-script arcs do not collapse back into one repeated `我有点在意` stem. The fixed evaluator gates `evilPublicClaimCoverPressureContinuityCoverage = 1`.
- Cross-day target switching now has structured rationale metadata. `targetSwitchContinuity` derives the strongest prior-day non-current pressure from `stanceHistoryBySpeakerId`, keeps previous/current target, stance, score, evidence count, and anchors, and public speech only uses public-safe entries. The spoken line front-loads the decision as `昨天主线在 A，今天先转 B，不等于放掉 A`; the fixed evaluator adds `crossDayTargetSwitchCoverage = 1`.
- Cross-script target-switch fixtures now extend the same contract to BMR and SnV. The fixed evaluator adds `crossScriptCrossDayTargetSwitchCoverage = 1`, proving target switches can name the prior lane, current lane, and retained old pressure beyond the TB baseline.
- Non-public target-switch continuity now has a fixed three-channel gate. Private replies prioritize `targetSwitchLine` / target-switch `memoryContinuityLine` before the generic top-vs-runner-up sentence; proactive / ordinary AI-AI private speech rebuilds `decisionRationale` after writing the current-day stance, and target-switch fragments are placed before the focus-push sentence so they survive night-info or dead-speaker budget pressure. The fixed evaluator now requires `private-whisper`, `proactive-private`, and `ai-ai-private` rows to all name the previous lane, current lane, and retained old pressure. Latest fixed snapshot: 100 rows, `hiddenLeakCount = 0`, `evidenceCitationRate = 0.920`, `publicShadowPressureLineDiversityCoverage = 0.923`, `crossDayTargetSwitchCoverage = 1`, `crossScriptCrossDayTargetSwitchCoverage = 1`, `nonPublicTargetSwitchContinuityCoverage = 1`, and `repetitionRate = 0.287`.

## 2026-06-03 Follow-up: Full Reasoning ScoreTrail Export

This follow-up closes the hidden truncation between AI long-arc reasoning and the Unity recap drilldown.

- Unity viewmodel no longer truncates each `aiReasoningRecap[].scoreTrail` to the latest four points before export.
- The existing Unity score-trail pager can now receive every current-day, human-visible score point for the selected speaker/focus track, instead of paging over an already-shortened list.
- A new viewmodel contract builds a six-point reasoning arc for one AI/target pair and requires all six points to remain in newest-to-oldest order, with latest score, previous score, score delta, evidence counts, and target-vs-runner-up comparison still preserved.
- Validation passed: `node --check scripts/unity_viewmodel.js`, `node --check tests/unity_viewmodel_contracts.mjs`, `npm run test:unity-viewmodel`, `npm run test:unity-assets`, and root/Unity embedded `unity_viewmodel.js` sync diff.

## 2026-06-03 Follow-up: ScoreTrail Row Drilldown Context

This follow-up makes each exported reasoning score point easier to read in the Unity recap.

- Unity score-trail rows now combine target-vs-runner-up comparison, source timeline anchor, cross-day or claim-continuity context, and the leading evidence row into one drilldown body.
- The new `ReasoningTimelineAnchorLine(...)` helper uses `timelineIndex`, `timelineEntryId`, `timelineText`, and point summary to show which visible utterance triggered the score movement.
- The new `ReasoningContinuityLine(...)` helper surfaces `crossDayStance.summary` first, then claim-disclosure continuity summaries/lines, so the row can explain whether the point is part of a day-to-day stance arc or an identity-claim continuity arc.
- Unity asset contracts now guard both helper paths and the existing suspect snapshot / reasoning drilldown relationship. Latest validation passed: full `npm test`, `git diff --check`, and `node scripts\ai_quality_eval.mjs` with 100 rows, `hiddenLeakCount = 0`, `evidenceCitationRate = 0.920`, and `repetitionRate = 0.291`.

## 2026-06-03 Follow-up: Cross-Day Anchor Preservation In Unity

This follow-up closes the data-contract gap between JS reasoning export and Unity recap display.

- JS already exported `previous/currentEvidenceAnchors`, `previous/currentEventAnchors`, and `previous/currentScoreTrailAnchors` inside each normalized `crossDayStance`; Unity C# now deserializes those fields instead of dropping them at the DTO boundary.
- Added `CrossDayEvidenceAnchorViewModel`, `CrossDayEventAnchorViewModel`, and `CrossDayScoreTrailAnchorViewModel`, plus the corresponding arrays on `CrossDayStanceViewModel`.
- Unity score-trail row continuity now appends a compact `anchors:` segment using the current event, score-trail, and evidence anchors when present.
- Unity asset contracts now guard C# anchor deserialization and the `ReasoningCrossDayAnchorLine(...)` display path. Latest validation passed: full `npm test`, `npm run test:unity-assets`, `npm run test:unity-viewmodel`, and `node scripts\ai_quality_eval.mjs` with 100 rows, `hiddenLeakCount = 0`, `evidenceCitationRate = 0.920`, and `repetitionRate = 0.287`.

## 2026-06-03 Follow-up: Timeline Rationale Card Recap

This follow-up makes structured nomination rationale cards visible in the lightweight timeline recap path.

- Timeline entries already carry `rationaleCards` built from the same `decisionRationale` and `strategyRationale` package used by the active nomination debate panel.
- Unity Info Drawer timeline rows now compress up to three rationale cards into a compact `cards:` segment, preserving target-choice, strategy, and verification summaries beside the existing `rationaleSummary`.
- If a timeline entry has rationale cards but no summary fallback, the row can still surface the card summaries instead of reverting to raw utterance text.
- Unity asset contracts now guard `InfoTimelineRationaleCardsLine(...)`, `entry.rationaleCards`, and the `cards:` recap path. Latest validation passed: full `npm test`, `npm run test:unity-assets`, `npm run test:unity-viewmodel`, `git diff --check`, and `node scripts\ai_quality_eval.mjs` with 100 rows, `hiddenLeakCount = 0`, `evidenceCitationRate = 0.920`, and `repetitionRate = 0.287`.

## 2026-06-03 Follow-up: RationaleCard Raw Line Preservation

This follow-up keeps the deeper decision-rationale lines available after Unity deserialization.

- JS rationale cards already export raw fields such as `evidenceModeLine`, `responsePlanLine`, `sourceReliabilityLine`, `timelineConsistencyLine`, `actionThresholdLine`, `memoryContinuityLine`, `falsificationCheckLine`, `roleHypothesisLine`, and `reconsiderationLine`.
- Unity C# `RationaleCardViewModel` now deserializes those raw rationale lines instead of keeping only compact `summary` / `detail` fields.
- Added shared `RationaleCardRawLine(...)` fallback logic so both Info Drawer timeline recaps and the active nomination debate panel can still show a meaningful line when compact detail text is absent.
- Unity asset contracts now guard raw-line DTO fields plus the Info Drawer and nomination-panel fallback paths. Latest validation passed: full `npm test`, `npm run test:unity-assets`, `npm run test:unity-viewmodel`, `git diff --check`, and `node scripts\ai_quality_eval.mjs` with 100 rows, `hiddenLeakCount = 0`, `evidenceCitationRate = 0.920`, and `repetitionRate = 0.291`.

## 2026-06-03 Follow-up: RationaleCard Sectioned Drilldown Text

This follow-up turns the preserved raw rationale fields into card-level reasoning sections without changing the JS output schema.

- Added shared `RationaleCardSectionLine(...)` text assembly for `verify`, `evidence`, `plan`, `check`, `role`, and `memory` sections, sourced from the existing raw rationale-card fields.
- Timeline rationale-card recaps now keep the old headline/summary while appending a compact section line when available, so the lightweight row can show both the card purpose and the AI's reasoning structure.
- Active nomination rationale cards now use the same section helper for summary/detail fallback, which makes cards with only raw rationale fields visible and gives each small card a scan path for evidence, plan, falsification, role hypothesis, and memory continuity.
- Unity asset contracts now guard `RationaleCardHasVisibleText(...)`, `RationaleCardTimelineText(...)`, and the section labels. Latest validation passed: full `npm test`, `npm run test:unity-assets`, `npm run test:unity-viewmodel`, and `node scripts\ai_quality_eval.mjs` with 100 rows, `hiddenLeakCount = 0`, `evidenceCitationRate = 0.920`, and `repetitionRate = 0.287`.

## 2026-06-03 Follow-up: AI Recap Latest Decision Snapshot

This follow-up makes the selected reasoning-track drilldown start with an auditable latest-decision snapshot before the paged score-trail rows.

- Unity AI recap drilldown now renders `AI Reasoning Latest Decision Snapshot`, assembled from the latest score point's score/gap/evidence count, target-vs-runner-up comparison, source timeline anchor, cross-day or claim-continuity context, and leading evidence row.
- Added `ReasoningLatestDecisionSnapshotLine(...)` and `ReasoningScorePointAuditLine(...)` so the latest snapshot and each score-trail row reuse the same audit-path assembly instead of drifting into separate text formats.
- `ReasoningScoreTrailPageSize` is now `2`, reserving vertical space for the latest-decision snapshot while keeping the full score trail available through existing paging controls.
- Unity asset contracts now guard the latest snapshot, shared audit helper, and two-row paged layout. Latest validation passed: full `npm test`, `npm run test:unity-assets`, `npm run test:unity-viewmodel`, and `node scripts\ai_quality_eval.mjs` with 100 rows, `hiddenLeakCount = 0`, `evidenceCitationRate = 0.920`, and `repetitionRate = 0.287`.

## 2026-06-03 Follow-up: AI Recap Explicit Audit Sections

This follow-up makes the latest-decision snapshot and score-trail rows explicitly label their reasoning components.

- Added `ReasoningScorePointAuditSections(...)` and `ReasoningAuditSection(...)` so recap drilldown text is assembled as named sections instead of a long untyped sentence.
- Latest decision snapshots now surface `score`, `compare`, `source`, `continuity`, and `evidence` sections, matching the way a human reviewer audits a read.
- Paged score-trail rows reuse the same section helper but omit the duplicate score section in row bodies, preserving room for evidence after the row meta already shows score movement.
- Unity asset contracts now guard all five audit labels. Latest validation passed: full `npm test`, `npm run test:unity-assets`, `npm run test:unity-viewmodel`, and `node scripts\ai_quality_eval.mjs` with 100 rows, `hiddenLeakCount = 0`, `evidenceCitationRate = 0.920`, and `repetitionRate = 0.283`.

## 2026-06-03 Follow-up: AI Recap Audit Section Chips

This follow-up moves the latest-decision snapshot from labeled text toward a compact visual audit row.

- Added `AddReasoningLatestDecisionSnapshotChips(...)` and `AddReasoningAuditSectionChip(...)`, rendering `score`, `compare`, `source`, `continuity`, and `evidence` as small color-coded chips inside the selected reasoning drilldown card.
- The chips reuse the same latest score point, comparison trace, timeline anchor, continuity line, and evidence-row helpers as the text audit path, so UI polish does not fork the reasoning semantics.
- The empty-state fallback renders a single `pending` chip instead of dropping the snapshot area, preserving layout stability while the belief trail is still empty.
- Unity asset contracts now guard the chip row and all five chip labels. Latest validation passed: full `npm test`, `npm run test:unity-assets`, `npm run test:unity-viewmodel`, and `node scripts\ai_quality_eval.mjs` with 100 rows, `hiddenLeakCount = 0`, `evidenceCitationRate = 0.920`, and `repetitionRate = 0.287`.

## 2026-06-03 Follow-up: ScoreTrail Expanded Row Timeline Jump

This follow-up closes the loop between an AI reasoning score point and the timeline entry that produced it.

- The selected reasoning drilldown now has score-trail selector chips plus an `AI Reasoning Score Trail Expanded Row`, so one score point can be inspected in more detail instead of only reading the latest two-row page.
- The expanded row includes a `TL` action wired through `JumpToReasoningScoreTrailTimeline(...)`; when the score point has `timelineEntryId` or `timelineIndex`, it stores `activeInfoTimelineAnchorId` and opens the timeline tab.
- Timeline rows already resolve that anchor via `TimelineEntryMatchesAnchor(...)`, pull the anchored event into the recent list if needed, and render it with `ANCHOR`, `TL`, and `Info Activity Row Timeline Anchor Glow`.
- Unity asset contracts guard the expanded row, timeline jump helper, timeline anchor id helper, active anchor state, and highlighted timeline row path. Latest validation passed: full `npm test`, `npm run test:unity-assets`, `npm run test:unity-viewmodel`, and `node scripts\ai_quality_eval.mjs` with 100 rows, `hiddenLeakCount = 0`, `evidenceCitationRate = 0.920`, and `repetitionRate = 0.287`.

## 2026-06-03 Follow-up: Cross-Day Event Anchor Timeline Fallback

This follow-up makes cross-day reasoning source anchors actionable when an individual score point does not carry a direct timeline id.

- `ReasoningTimelineAnchorLine(...)` now falls back to `crossDayStance.currentEventAnchors` when the score point lacks direct `timelineEntryId`, `timelineIndex`, and `timelineText` fields.
- `ReasoningTimelineAnchorId(...)` uses the same fallback, preferring the cross-day event anchor's `timelineEntryId` before `eventId`, so the expanded score-trail `TL` action can still open the source timeline row.
- Existing direct point anchors remain highest priority, preserving the previous exact-jump behavior for score points that already include `timelineEntryId` or `timelineIndex`.
- Unity asset contracts now guard `ReasoningCrossDayEventAnchor(...)`, the cross-day `currentEventAnchors` source, and the fallback id fields. Latest targeted validation passed: `node --check tests\unity_asset_contracts.mjs` and `npm run test:unity-assets`.

## 2026-06-03 Follow-up: Cross-Day Anchor Chips In Expanded ScoreTrail

This follow-up makes the preserved cross-day source anchors scannable inside the selected score point, not only readable in a continuity sentence.

- The `AI Reasoning Score Trail Expanded Row` now renders compact cross-day `event`, `score`, and `evidence` chips when the selected score point has `crossDayStance.currentEventAnchors`, `currentScoreTrailAnchors`, or `currentEvidenceAnchors`.
- The chips reuse the same normalized cross-day DTOs and helper selection path as the timeline fallback, so UI display does not fork the reasoning semantics.
- The expanded row keeps the existing `TL` action and direct/fallback timeline-jump behavior; the new chips are scan affordances, not new state or rule decisions.
- Unity asset contracts now guard `AddReasoningCrossDayAnchorChips(...)`, `AI Reasoning Cross Day Anchor Chip`, and the event/score/evidence chip label helpers. Latest targeted validation passed: `node --check tests\unity_asset_contracts.mjs` and `npm run test:unity-assets`.

## 2026-06-03 Follow-up: Cross-Day Stance Badge In Expanded ScoreTrail

This follow-up makes the selected score point's cross-day stance state visible at a glance.

- The `AI Reasoning Score Trail Expanded Row` now renders an `AI Reasoning Cross Day Stance Badge` when the selected score point has a `crossDayStance`.
- The badge compresses `continuity` / `kind`, previous-to-current score movement, evidence delta, and previous-to-current stance labels into one small scan affordance.
- The existing cross-day event/score/evidence chips and `TL` timeline jump remain unchanged; the stance badge explains the arc state while the chips explain its source anchors.
- Unity asset contracts now guard `AddReasoningCrossDayStanceBadge(...)`, `ReasoningCrossDayStanceBadgeLine(...)`, previous/current score fields, evidence delta, and previous/current stance fields. Latest targeted validation passed: `node --check tests\unity_asset_contracts.mjs` and `npm run test:unity-assets`.

## 2026-06-03 Follow-up: Target-Vs-Runner Comparison Trace Detail

This follow-up makes the selected score point explain the target choice more explicitly instead of relying on one compressed comparison sentence.

- `ReasoningComparisonLine(...)` now keeps the original `comparisonTrace.summary` but appends separate `focus` and `runner` side lines with score, evidence count, reason, and evidence summary when those fields exist.
- The same line also appends compact comparison metadata from `scoreGap`, `confidenceBand`, `reasonKey`, and `publicOnly`, so a reviewer can see not just which side won, but why the current read is calibrated that way.
- The implementation reuses the existing Unity `AiReasoningComparisonTraceViewModel` fields; no JS schema, scoring logic, or rule semantics changed.
- Unity asset contracts now guard `ReasoningComparisonSideLine(...)`, `ReasoningComparisonMetaLine(...)`, focus/runner reason fields, evidence summary fields, and the new `compare:` display path. Latest targeted validation passed: `node --check tests\unity_asset_contracts.mjs` and `npm run test:unity-assets`.

## 2026-06-03 Follow-up: Timeline Rationale Dedicated Drilldown

This follow-up upgrades lightweight timeline rationale recap from a compressed `cards:` sentence into a small dedicated review strip.

- The timeline tab now renders `Info Timeline Rationale Drilldown` at the bottom of the activity list.
- The drilldown follows the current `TL` anchored timeline entry when that entry has visible `rationaleCards`; otherwise it falls back to the most recent timeline entry with rationale cards.
- Up to three cards are rendered as compact `Info Timeline Rationale Card` blocks, reusing `RationaleCardTimelineText(...)`, `RationaleCardSectionLine(...)`, and raw-line fallbacks instead of inventing a separate explanation path.
- Empty timelines keep a stable placeholder, so the panel remains predictable before nomination or strategy events create rationale cards.
- Unity asset contracts now guard the drilldown strip, rationale-card blocks, visible-card selector, rationale-card presence helper, and accent helper. Latest targeted validation passed: `node --check tests\unity_asset_contracts.mjs` and `npm run test:unity-assets`.

## 2026-06-03 Follow-up: Timeline Rationale Card Trace Detail

This follow-up makes each dedicated timeline rationale card show why the card matters before falling back to a generic summary.

- `InfoTimelineRationaleCardTraceLine(...)` now assembles compact trace text from existing `RationaleCardViewModel` fields.
- `RationaleCardMatchupTraceLine(...)` surfaces the card's target-vs-runner-up matchup with confidence/reason context when available.
- `RationaleCardEvidenceTraceLine(...)` surfaces evidence mode plus source reliability, timeline consistency, evidence interaction, or evidence-boundary context.
- `RationaleCardNextCheckTraceLine(...)` surfaces the next verification, response plan, action threshold, question priority, or runner-up watch line.
- The dedicated card body prefers this trace line, then falls back to `RationaleCardTimelineText(...)`, raw rationale lines, reason key, or display intent.
- No JS schema, AI scoring logic, public speech generation, or game rules changed; this is a Unity audit-display enhancement over already-exported rationale-card fields.
- Unity asset contracts now guard the new trace helpers and the target, runner-up, evidence, source, verification, and response-plan field usage. Latest targeted validation passed: `node --check tests\unity_asset_contracts.mjs` and `npm run test:unity-assets`.

## 2026-06-03 Follow-up: ScoreTrail Evidence Drillthrough Chips

This follow-up makes selected AI score movements expose their source evidence at a finer grain.

- Expanded score-trail rows now render up to two `AI Reasoning Evidence Drillthrough Chip` blocks when the right-side chip lane is not occupied by cross-day anchor chips.
- Each chip is built from existing `evidenceRows` data and can show evidence kind/source, applied delta, reliability score, and contamination risk.
- Unity viewmodel evidence rows now preserve optional `timelineEntryId`, `timelineIndex`, and `timelineText` fields when row/evidence sources provide them.
- Production viewmodel export can now infer a row-level timeline anchor when the evidence row timestamp exactly matches the timeline entry timestamp and the evidence kind or text matches that entry; weaker evidence ids, observation ids, or source ids alone are not enough.
- When an evidence row has its own timeline anchor, the chip becomes an exact `->EV` jump to that evidence row's visible source; otherwise it falls back to the score point's `->TL` context jump.
- The fallback remains intentional: `evidenceId` / `observationId` / `sourceId` alone still do not prove a `TimelineEntryViewModel.id` match.
- Cross-day event/score/evidence anchor chips keep priority when present, so the new evidence chips do not overwrite the cross-day source-jump path.
- `ReasoningVisibleEvidenceRows(...)` filters usable evidence rows by text, evidence id, observation id, or source fields; `ReasoningEvidenceDrillthroughLine(...)` formats the compact chip text.
- No belief scoring, speech rendering, AI decision logic, or game rules changed; the optional row-level anchor export is a backward-compatible Unity viewmodel/UI audit enhancement.
- Unity viewmodel contracts now prove inferred row-level timeline anchors survive into `scoreTrail[].evidenceRows[]` without explicit fixture anchor fields, and Unity asset contracts guard the exact `->EV` jump plus `->TL` fallback. Latest targeted validation passed: `npm run test:unity-viewmodel` and `npm run test:unity-assets`.

## 2026-06-03 Follow-up: ScoreTrail Expanded Evidence Rows

This follow-up upgrades the selected score point's evidence lane from compact chips into fuller inline audit rows.

- The expanded score-trail row now renders up to two `AI Reasoning Evidence Expanded Row` blocks when cross-day anchor chips are not occupying the right-side lane.
- Each row uses the existing `evidenceRows` data and preserves evidence kind/source, applied delta, reliability, contamination risk, and source text from `timelineText` or row text.
- The exact source-jump behavior remains the same: rows with an inferred or explicit row-level anchor use `e#->EV`, while rows without one fall back to the selected score point's `e#->TL` context jump.
- `ReasoningEvidenceJumpPrefix(...)` now centralizes the `->EV` / `->TL` label choice so compact chips and expanded rows cannot drift apart.
- No AI scoring, speech rendering, JS schema, or game rules changed; this is a Unity audit-display improvement over already-exported evidence metadata.
- Unity asset contracts now guard the expanded evidence-row helper, source text usage, shared jump prefix, and row-level timeline text preservation.

## 2026-06-03 Follow-up: Private Protection-Vote Evidence Synthesis

This follow-up deepens private reasoning language around a harder two-family clue: a player protecting a high-pressure target while their vote shape moves against table pressure.

- Added `protection-vote` to the private evidence synthesis variant set, guarded by the phrase `保高压位和票型反向互相顶住`.
- Added fixed BMR and SnV private-whisper samples where the focus player publicly protects a high-pressure target and also has a vote-shape conflict.
- `computeGraphPressureForTarget(...)` and `extractGraphReasonChains(...)` now preserve explicit hot-target defense when the source evidence text names a high-pressure target or unload-pressure behavior, even if refreshed suspicion has compressed the protected target back toward baseline.
- `buildDialogueEvidenceContract(...)` now family-dedupes obvious duplicate hot-defense summaries so a second evidence family, such as vote conflict, can survive into the spoken evidence pair.
- The root JS core and Unity embedded JS core were kept in sync.
- Latest validation passed: `node --check scripts\ai.js`, `node --check scripts\ai_quality_eval.mjs`, `npm run test:ai-quality-eval`, and `node scripts\ai_quality_eval.mjs`. The fixed set is now 102 rows with `hiddenLeakCount = 0`, `evidenceCitationRate = 0.922`, `privateEvidenceSynthesisVariantCoverage = 1`, `repetitionRate = 0.288`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: Private Source-Identity Evidence Synthesis

This follow-up adds a fifth private evidence synthesis mode for cases where the same player is both an unstable information source and has an identity line that no longer matches public verification.

- Added `source-identity` to the private synthesis variant set, accepting the natural private wording `来源不稳和身份一起要再对一下` as well as the contract phrase `来源不稳和身份口径一起要复核`.
- Added fixed BMR and SnV private-whisper samples where the focus player has a false public claim/reveal chain and their source trust is lowered through the existing `updateAgentSourceTrustForPlayer(...)` path.
- The fixture reuses existing `low-source-trust-chain` and `false-claim-chain` reasoning instead of inventing a synthetic shortcut, so the spoken synthesis is backed by real graph evidence.
- `privateEvidenceSynthesisVariantCoverage` now requires five modes: `identity-low-evidence`, `identity-vote`, `identity-night-info`, `protection-vote`, and `source-identity`.
- The root and Unity embedded `ai_quality_eval.mjs` copies were kept in sync.
- Latest validation passed: `node --check scripts\ai_quality_eval.mjs`, `node --check tests\ai_quality_eval_contracts.mjs`, `npm run test:ai-quality-eval`, and `node scripts\ai_quality_eval.mjs`. The fixed set is now 104 rows with `hiddenLeakCount = 0`, `evidenceCitationRate = 0.923`, `privateEvidenceSynthesisVariantCoverage = 1`, `repetitionRate = 0.300`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: Private Synthesis Verification Specificity

This follow-up upgrades private evidence synthesis from "these clues fit together" to "this is the exact next verification step for this clue family."

- Added `privateEvidenceSynthesisVerificationLine(...)` in the private response path so the five synthesis modes now get mode-specific verification actions:
  - low-evidence + identity mismatch asks why the target pushed a low-evidence slot and how the identity line matches public verification.
  - vote + identity asks where the identity line breaks and why the vote moved against pressure.
  - night-info + identity asks whether the night-info source can be checked against the identity line.
  - protection + vote asks why the target protected a high-pressure slot and how the reverse vote should be explained.
  - source + identity asks which source can be independently checked and how the identity line matches public verification.
- The specific verification line is merged with the existing evidence-mode tail, preserving `decisionEvidenceModeVerificationAlignmentCoverage = 1` instead of replacing the older contract.
- Added `privateEvidenceSynthesisVerificationCoverage`, requiring all fixed synthesis rows to carry the correct mode-specific verification line.
- Root and Unity embedded `ai.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Latest validation passed: `node --check` on touched JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`. The fixed set remains 104 rows with `hiddenLeakCount = 0`, `evidenceCitationRate = 0.923`, `privateEvidenceSynthesisVariantCoverage = 1`, `privateEvidenceSynthesisVerificationCoverage = 1`, `decisionEvidenceModeVerificationAlignmentCoverage = 1`, `repetitionRate = 0.296`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: Private Synthesis Spoken Verification

This follow-up closes the gap between "the decision rationale knows the right verification step" and "the private reply actually says that verification step."

- Added a final private-response guard that reruns private synthesis verification after humanization, turn-taking, and alignment, so mode-specific verification actions are not trimmed out by speech budgets.
- The spoken guard now routes the verification line through conversational polish, preserving natural phrasing such as `身份和大家验证对上` and `再对一下` instead of exposing only internal contract wording.
- Added `privateEvidenceSynthesisSpokenVerificationCoverage`, requiring all 10 fixed BMR/SnV private synthesis rows to say the correct mode-specific verification action in `row.text`, not only in `decisionRationale.verificationLine`.
- Root and Unity embedded `ai.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, `node scripts\ai_quality_eval.mjs`, Unity/root JS no-index sync checks, and `git diff --check`. The fixed set remains 104 rows with `hiddenLeakCount = 0`, `evidenceCitationRate = 0.923`, `privateEvidenceSynthesisVerificationCoverage = 1`, `privateEvidenceSynthesisSpokenVerificationCoverage = 1`, `repetitionRate = 0.292`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: Public Synthesis Spoken Verification

This follow-up mirrors the private spoken-verification upgrade in public discussion, so public multi-evidence pressure says not only why clue families connect, but how the table should verify them next.

- Public follow-up specialization now upgrades actionable public checks into `核法是...` wording, e.g. `核法是让6号解释票型，再补身份和昨晚信息`.
- Existing already-specialized follow-ups such as `先听7号解释票型，再补身份和昨晚信息` are normalized into explicit verification wording instead of bypassing the new phrasing.
- Added `publicEvidenceSynthesisSpokenVerificationCoverage`, requiring all public synthesis rows with multi-evidence pressure to say the verification action in `row.text`.
- The gate covers cross-script BMR/SnV public multi-evidence rows plus persona, timing, and role-pressure public synthesis rows, keeping synthesis wording, public-safe follow-up, and script/role context intact.
- Root and Unity embedded `ai_public_discussion.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, `node scripts\ai_quality_eval.mjs`, Unity/root JS no-index sync checks, and `git diff --check`. The fixed set remains 104 rows with `hiddenLeakCount = 0`, `evidenceCitationRate = 0.923`, `publicEvidenceSynthesisCoverage = 1`, `publicEvidenceSynthesisDedupCoverage = 1`, `publicEvidenceSynthesisSpokenVerificationCoverage = 1`, `repetitionRate = 0.292`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: Public Synthesis Verification Variants

This follow-up makes public spoken verification mode-aware: the table check now changes depending on whether the visible evidence is identity + vote, public pressure + vote, identity + nomination, or public pressure + nomination.

- `publicSpecificFollowUpQuestionText(...)` now derives the `核法是...` line from the public synthesis phrase, producing more specific checks such as identity+vote -> `把身份和票型对上，再解释投票理由`, public-pressure+vote -> `解释票型为什么跟台面压力同向`, and nomination variants -> identity or pressure checks tied to nomination pressure.
- Public role-pressure context now recognizes public claim + nomination evidence and surfaces identity/nomination synthesis instead of collapsing that case into generic table pressure.
- Added two fixed real-pipeline public synthesis verification rows for `identity-nomination` and `pressure-nomination`, raising the fixed set to 106 rows.
- Added `publicEvidenceSynthesisSpokenVerificationVariantCoverage`, requiring all public synthesis rows to match their spoken verification action to the detected evidence-family mode and requiring coverage of all four public modes.
- Root and Unity embedded `ai_public_discussion.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, `node scripts\ai_quality_eval.mjs`, Unity/root JS no-index sync checks, and `git diff --check`. Current fixed snapshot is 106 rows with `hiddenLeakCount = 0`, `evidenceCitationRate = 0.925`, `publicEvidenceSynthesisSpokenVerificationCoverage = 1`, `publicEvidenceSynthesisSpokenVerificationVariantCoverage = 1`, `repetitionRate = 0.288`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: Nomination Action Context

This follow-up makes AI nomination strategy text explicitly distinguish "using nomination to create information or execution pressure" from simply passing or drifting through the day.

- `buildNominationStrategyRationale(...)` now keeps the existing public-safe strategy modes but phrases each mode around `不是空过` / `空过风险`, so nomination reasons clearly explain why now is an action window.
- Strategy lines still preserve vote-context details such as `票面约 X/Y`, support threshold, defense quality, stand-side checks, execution information, or public-reason flow.
- Added `nominationActionContextCoverage`, requiring nomination rows to include the synced strategy line, a not-empty-pass/empty-pass-risk marker, vote context when available, and a concrete observation/action target.
- Root and Unity embedded `ai.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, `node scripts\ai_quality_eval.mjs`, Unity/root JS no-index sync checks, and `git diff --check`. Current fixed snapshot is 106 rows with `hiddenLeakCount = 0`, `evidenceCitationRate = 0.925`, `strategyRationaleCoverage = 1`, `nominationActionContextCoverage = 1`, `repetitionRate = 0.281`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: Nomination Strategy Mode Coverage

This follow-up turns nomination action context from a general row-level gate into explicit coverage for every public strategy mode.

- `buildNominationStrategyRationale(...)` is now exported and reused by the quality evaluator, so fixed strategy-mode samples exercise the same wording generator that real nominations use.
- Added seven fixed nomination strategy rows covering `pressure-test`, `coalition-check`, `execution-push`, `avoid-no-execution`, `execution-info`, `public-reason-flow`, and `information-check`.
- Added `nominationStrategyModeCoverage = 1`, requiring every strategy-mode row to preserve the generated line, the not-empty-pass/action-window wording, vote context, and a concrete table observation such as defense, stand-side, coalition, execution info, pressure test, or information gain.
- Root and Unity embedded `ai.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot is 113 rows with `hiddenLeakCount = 0`, `evidenceCitationRate = 0.929`, `nominationActionContextCoverage = 1`, `nominationStrategyModeCoverage = 1`, `repetitionRate = 0.272`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: Nomination Defense Response

This follow-up deepens the nominee side of nomination debates, so AI players do not only make structured nominations but can also defend against them in a table-readable way.

- `nominationDefenseLine(...)` now answers the nomination reason directly, names the public-safe claim lane, states what identity/night-info/vote-shape detail the nominee will verify, and gives a vote threshold such as "补不上再上票 / 对不上再票我 / 补得上就先降压".
- High-pressure nominee defenses can also mark the nominator's behavior for later review if the nominator pushes a vote without hearing the defense.
- Added two real `createNominationDebate(...)` fixture rows covering regular defense and counter-pressure defense, without changing nomination rules or vote resolution.
- Added `nominationDefenseResponseCoverage = 1`, requiring nominee defenses to answer the nomination, preserve verifiable identity/info/vote context, and say what response should change the vote.
- Root and Unity embedded `ai.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot is 115 rows with `hiddenLeakCount = 0`, `evidenceCitationRate = 0.930`, `nominationActionContextCoverage = 1`, `nominationStrategyModeCoverage = 1`, `nominationDefenseResponseCoverage = 1`, `repetitionRate = 0.273`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: Nomination Defense-Aware Vote Rationale

This follow-up carries the nominee's defense into the formal vote explanation, closing the loop from nomination reason -> defense -> vote.

- `decideAIVoteWithRationale(...)` now reads the active nomination debate's nominee defense as public context and passes it into `voteRationale` without changing the boolean vote decision.
- `voteRationale.line` now says whether the defense failed to connect identity/info/vote-shape before a yes vote, or gave a verifiable direction before a no vote.
- Added two fixed formal-vote rows covering defense-aware yes and no outcomes through the real `createNominationDebate(...)` and `decideAIVoteWithRationale(...)` paths.
- Added `nominationDefenseAwareVoteCoverage = 1`, requiring defense-aware formal vote rows to preserve public-only vote rationale, defense context, and the vote-specific interpretation of that defense.
- Root and Unity embedded `ai.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot is 117 rows with `hiddenLeakCount = 0`, `evidenceCitationRate = 0.932`, `nominationDefenseResponseCoverage = 1`, `nominationDefenseAwareVoteCoverage = 1`, `formalVoteRationaleCoverage = 1`, `formalVoteLineDiversityCoverage = 0.960`, `repetitionRate = 0.266`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: Cross-Script Nomination Defense-Aware Vote

This follow-up extends defense-aware formal vote rationale from the TB baseline to BMR and SnV.

- Reused the same real `createNominationDebate(...)` -> `decideAIVoteWithRationale(...)` fixture helper for TB, BMR, and SnV, avoiding a separate cross-script text path.
- Added BMR/SnV defense-aware formal-vote rows covering both yes and no outcomes.
- Added `crossScriptNominationDefenseAwareVoteCoverage = 1`, requiring BMR/SnV rows to preserve public-only vote rationale, nominee defense context, and vote-specific defense interpretation.
- Root and Unity embedded `ai_quality_eval.mjs` copies were kept in sync.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot is 121 rows with `hiddenLeakCount = 0`, `evidenceCitationRate = 0.934`, `nominationDefenseAwareVoteCoverage = 1`, `crossScriptNominationDefenseAwareVoteCoverage = 1`, `formalVoteRationaleCoverage = 1`, `formalVoteLineDiversityCoverage = 0.966`, `repetitionRate = 0.266`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: Nomination Reason-Anchored Defense Vote

This follow-up deepens defense-aware vote rationale from "the nominee defended" to "the defense answered or failed the original nomination reason."

- `voteRationale.nominationDefenseContext` now carries a public `reasonLine` derived from the active nomination debate's nominator reason.
- Defense-aware formal vote lines now start from the nomination pressure point, e.g. `提名理由点的是「身份和票型没对上，先听防守再看票」`, before judging whether the nominee defense lowered pressure or failed to connect.
- Added `nominationReasonAnchoredDefenseVoteCoverage = 1`, requiring these rows to preserve a real pressure/identity/info/vote-shape reason anchor in the final player-visible vote line.
- Root and Unity embedded `ai.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot is 121 rows with `hiddenLeakCount = 0`, `evidenceCitationRate = 0.934`, `nominationDefenseAwareVoteCoverage = 1`, `nominationReasonAnchoredDefenseVoteCoverage = 1`, `crossScriptNominationDefenseAwareVoteCoverage = 1`, `formalVoteRationaleCoverage = 1`, `formalVoteLineDiversityCoverage = 0.966`, `repetitionRate = 0.276`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: Reason-Anchored Defense Vote Line Diversity

This follow-up keeps the new nomination-reason anchor but avoids collapsing every defense-aware vote into the same opening sentence.

- Defense-aware vote openings now use deterministic public-safe variants such as `提名理由点的是...`, `我按提名理由...看`, and `先回到提名理由...`.
- The variant selector is seat-bucketed before falling back to hash selection, so yes/no rows across TB/BMR/SnV spread across more than one opening form without adding randomness to vote decisions.
- Added `nominationReasonAnchoredDefenseVoteLineDiversityCoverage = 1`, requiring at least three normalized reason-anchor opening forms overall and at least two forms for both yes and no defense-aware vote rows.
- Root and Unity embedded `ai.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot is 121 rows with `hiddenLeakCount = 0`, `evidenceCitationRate = 0.934`, `nominationDefenseAwareVoteCoverage = 1`, `nominationReasonAnchoredDefenseVoteCoverage = 1`, `nominationReasonAnchoredDefenseVoteLineDiversityCoverage = 1`, `crossScriptNominationDefenseAwareVoteCoverage = 1`, `formalVoteLineDiversityCoverage = 0.966`, `repetitionRate = 0.267`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: Nominee Defense Reason Anchor

This follow-up brings the same nomination-reason anchor back into the nominee's own defense line, not only the later formal vote.

- `nominationDefenseReasonFragment(...)` now reuses the public nomination-reason anchor extractor, so a reason such as `我提 2号。身份和票型没对上...` is answered as `身份和票型没对上...` rather than only `2号`.
- All AI nominee-defense variants now quote the concrete pressure point before explaining identity, night-info, vote-shape, and vote-threshold follow-up.
- Added `nominationDefenseReasonAnchorCoverage = 1`, requiring fixed nominee-defense rows to answer the real nomination pressure point and reject bare seat-number anchors.
- Root and Unity embedded `ai.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot is 121 rows with `hiddenLeakCount = 0`, `evidenceCitationRate = 0.934`, `nominationDefenseResponseCoverage = 1`, `nominationDefenseReasonAnchorCoverage = 1`, `nominationDefenseAwareVoteCoverage = 1`, `nominationReasonAnchoredDefenseVoteCoverage = 1`, `nominationReasonAnchoredDefenseVoteLineDiversityCoverage = 1`, `crossScriptNominationDefenseAwareVoteCoverage = 1`, `repetitionRate = 0.269`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: Cross-Script Nominee Defense Reason Anchor

This follow-up makes the nominee-defense reason anchor portable across BMR and SnV, not only TB.

- Added BMR/SnV fixed nomination-defense rows through the real `createNominationDebate(...)` path, covering both lower-pressure and higher-pressure defenses.
- The cross-script fixtures use script-flavored public pressure points: BMR rows reference death/protection/execution information, while SnV rows reference information chains and identity-logic consistency.
- Added `crossScriptNominationDefenseReasonAnchorCoverage = 1`, requiring BMR/SnV nominee defenses to preserve script id, high/low pressure coverage, normal defense-response structure, and the concrete nomination reason anchor.
- Root and Unity embedded `ai_quality_eval.mjs` copies were kept in sync.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot is 125 rows with `hiddenLeakCount = 0`, `evidenceCitationRate = 0.936`, `nominationDefenseResponseCoverage = 1`, `nominationDefenseReasonAnchorCoverage = 1`, `crossScriptNominationDefenseReasonAnchorCoverage = 1`, `nominationReasonAnchoredDefenseVoteCoverage = 1`, `crossScriptNominationDefenseAwareVoteCoverage = 1`, `repetitionRate = 0.287`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: High-Pressure Nominee Defense Counter-Pressure

This follow-up makes high-pressure nominee defenses consistently counter-check the nominator's behavior instead of only answering the charge.

- High-pressure AI nominee defenses now always add a public-safe counter-pressure sentence: if the nominator keeps pushing votes without hearing the defense, that push should also be remembered.
- Added `highPressureNominationDefenseCounterPressureCoverage = 1`, requiring high-pressure nominee-defense rows to keep the normal defense structure, preserve the nomination reason anchor, and mention `只推票不听我补信息` / `这条也要记`.
- Root and Unity embedded `ai.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot is 125 rows with `hiddenLeakCount = 0`, `evidenceCitationRate = 0.936`, `nominationDefenseReasonAnchorCoverage = 1`, `highPressureNominationDefenseCounterPressureCoverage = 1`, `crossScriptNominationDefenseReasonAnchorCoverage = 1`, `nominationReasonAnchoredDefenseVoteCoverage = 1`, `nominationReasonAnchoredDefenseVoteLineDiversityCoverage = 1`, `crossScriptNominationDefenseAwareVoteCoverage = 1`, `repetitionRate = 0.285`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: Public Target-Switch Claim Disclosure Continuity

This follow-up closes a public-speech handoff gap: when an AI changes its public pressure lane, any active identity-disclosure rationale must still be spoken on the table.

- Public target-switch speech now preserves claim-disclosure and claim-continuity wording after the final speech budget pass instead of letting identity-lane rationale remain only in metadata.
- The final `claimDisclosureRationale.spokenLine` is re-attached after public statement continuity and budget trimming, so the rationale points to the actual rendered public text.
- Counter-evidence wording for messy public speech now says to listen for an explanation and re-check the later public response, making the "do not lock this yet" branch more actionable.
- Tightened `claimDisclosureRationaleCoverage` and `claimDisclosureContinuityCoverage` from `0.8` to `1`.
- Root and Unity embedded `ai.js` / `ai_public_discussion.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot is 125 rows with `hiddenLeakCount = 0`, `evidenceCitationRate = 0.936`, `decisionCounterEvidenceCoverage = 1`, `claimDisclosureRationaleCoverage = 1`, `claimDisclosureContinuityCoverage = 1`, `crossDayTargetSwitchCoverage = 1`, `crossScriptCrossDayTargetSwitchCoverage = 1`, `publicEvidenceSynthesisCoverage = 1`, `repetitionRate = 0.292`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: Shadow High-Pressure Targeted Openings

This follow-up makes shadow-persona high-pressure speech less like one repeated suspicious opener and more like target-specific caution.

- Shadow high-pressure multi-evidence lines now bring the target into the opening judgment, e.g. `9号这条不单看...`, before saying the target is being secretly tracked as a main lane.
- Evil protect-ally public cover now has target-keyed visible variants: `台面压力别只堆一处`, `别只压一个点`, and `压力重新分配一下`.
- Tightened `publicShadowPressureLineDiversityCoverage` from `0.8` to `1`.
- Root and Unity embedded `ai_public_discussion.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot is 125 rows with `hiddenLeakCount = 0`, `evidenceCitationRate = 0.936`, `publicPersonaPressureVariantCoverage = 1`, `publicPersonaPressureLineDiversityCoverage = 1`, `publicShadowPressureLineDiversityCoverage = 1`, `evilPublicProtectAllyCoverage = 1`, `evilPublicClaimCoverPressureContinuityCoverage = 1`, `repetitionRate = 0.289`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: Formal Vote Full Line Diversity

This follow-up removes the last repeated formal-vote line in the fixed quality set without changing vote decisions.

- Formal vote line variants can now read voter context, so the same nominee / multi-evidence / no-vote branch can vary between `我先`, `我这边先`, and `我这里先` while preserving the same public rationale.
- The change only affects player-facing `voteRationale.line`; `voteRationale` shape, reason keys, thresholds, evidence counts, and yes/no vote decisions remain unchanged.
- Tightened `formalVoteLineDiversityCoverage` from `0.75` to `1`.
- Root and Unity embedded `ai.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot is 125 rows with `hiddenLeakCount = 0`, `evidenceCitationRate = 0.936`, `formalVoteRationaleCoverage = 1`, `formalVoteLineDiversityCoverage = 1`, `formalVoteReasonModeCoverage = 1`, `formalVoteNearThresholdCoverage = 1`, `formalVoteEvidenceBoundaryCoverage = 1`, `formalVoteMultiEvidenceCompressionCoverage = 1`, `formalVoteScriptCoverage = 1`, `repetitionRate = 0.286`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: Private Source-Reliability Spoken Reasoning

This follow-up moves one deeper reasoning lens from metadata into player-facing private explanation.

- Private `reason` replies now append the naturalized `sourceReliabilityLine`, so AI explains whether a pressure read has an independent source, is only same-source echo, needs public replication, or should be downweighted.
- The spoken line strips report-style labels such as `来源可靠度：` before rendering, preserving `privateSurfaceReportDisciplineCoverage = 1`.
- Added `privateDeepReasoningSpokenCoverage = 1`, requiring fixed private reason rows to say the source-reliability reasoning in `row.text`, not only store it in `decisionRationale`.
- Root and Unity embedded `ai.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot is 125 rows with `hiddenLeakCount = 0`, `evidenceCitationRate = 0.936`, `privateSurfaceReportDisciplineCoverage = 1`, `privateDeepReasoningSpokenCoverage = 1`, `privateEvidenceSynthesisCoverage = 1`, `privateEvidenceSynthesisSpokenVerificationCoverage = 1`, `repetitionRate = 0.294`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: Private Timeline-Consistency Spoken Reasoning

This follow-up adds a second player-facing deep reasoning lens to private `reason` replies.

- Private `reason` replies now also append the naturalized `timelineConsistencyLine`, so the AI says whether claims, votes, explanations, and responses appear in a coherent order.
- When source reliability and timeline consistency share the same target pair, the second line is de-duplicated into phrasing such as `再看谁的身份、票型、回应先后更自洽...` instead of repeating the full pair opener.
- Added `privateTimelineReasoningSpokenCoverage = 1`, requiring fixed private reason rows to say the timeline-consistency reasoning in `row.text`.
- Root and Unity embedded `ai.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot is 125 rows with `hiddenLeakCount = 0`, `evidenceCitationRate = 0.936`, `privateSurfaceReportDisciplineCoverage = 1`, `privateDeepReasoningSpokenCoverage = 1`, `privateTimelineReasoningSpokenCoverage = 1`, `privateEvidenceSynthesisCoverage = 1`, `privateEvidenceSynthesisSpokenVerificationCoverage = 1`, `repetitionRate = 0.308`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: Private Incentive-Alignment Spoken Reasoning

This follow-up adds a third player-facing deep reasoning lens to private `reason` replies.

- Private `reason` replies now also append the naturalized `incentiveAlignmentLine`, so the AI says whether a behavior is more likely table-solving, self-preserving, protecting another player, following pressure, or moving heat away.
- When source, timeline, and incentive lines share the same target pair, the incentive sentence is de-duplicated into phrasing such as `动机上再分谁更像解桌、谁更像护人或转移压力...` instead of repeating the full pair opener.
- Added `privateIncentiveReasoningSpokenCoverage = 1`, requiring fixed private reason rows to say the incentive-alignment reasoning in `row.text`.
- Root and Unity embedded `ai.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot is 125 rows with `hiddenLeakCount = 0`, `evidenceCitationRate = 0.936`, `privateSurfaceReportDisciplineCoverage = 1`, `privateDeepReasoningSpokenCoverage = 1`, `privateTimelineReasoningSpokenCoverage = 1`, `privateIncentiveReasoningSpokenCoverage = 1`, `privateEvidenceSynthesisCoverage = 1`, `privateEvidenceSynthesisSpokenVerificationCoverage = 1`, `repetitionRate = 0.321`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: Private Burden-of-Proof Spoken Reasoning

This follow-up adds the fourth player-facing deep reasoning lens to private `reason` replies.

- Private `reason` replies now also append the naturalized `burdenOfProofLine`, so the AI says who needs to supply public reasons: the target, vote followers, defenders, or supporters on a close pressure lane.
- When source, timeline, incentive, and burden lines share the same target pair, the burden sentence is de-duplicated into phrasing such as `举证上两边支持者都要说清身份、票型或发言理由...` instead of repeating the full pair opener.
- Added `privateBurdenReasoningSpokenCoverage = 1`, requiring fixed private reason rows to say burden-of-proof reasoning in `row.text`.
- Root and Unity embedded `ai.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot is 125 rows with `hiddenLeakCount = 0`, `evidenceCitationRate = 0.936`, `privateSurfaceReportDisciplineCoverage = 1`, `privateDeepReasoningSpokenCoverage = 1`, `privateTimelineReasoningSpokenCoverage = 1`, `privateIncentiveReasoningSpokenCoverage = 1`, `privateBurdenReasoningSpokenCoverage = 1`, `privateEvidenceSynthesisCoverage = 1`, `privateEvidenceSynthesisSpokenVerificationCoverage = 1`, `repetitionRate = 0.333`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: Private Deep-Reasoning Compression

This follow-up keeps the four private reasoning lenses visible while reducing the report-like feel of private `reason` replies.

- Private `reason` replies now merge `incentiveAlignmentLine` and `burdenOfProofLine` into one conversational sentence when they describe the same target lane.
- Pair-comparison reads now say phrasing such as `4号和2号的动机和举证一起看：谁更像解桌、护人或转移压力，两边支持者谁能说清身份、票型或发言理由。`
- Single-target vote reads now say phrasing such as `7号的动机和举证一起看：这票是自保、跟风还是主动推人，本人和跟票者都要说清理由。`
- Added `privateDeepReasoningCompressionCoverage = 1`, requiring fixed private reason rows to preserve both incentive and burden reasoning in the compressed sentence instead of falling back to four separate report fragments.
- Root and Unity embedded `ai.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot is 125 rows with `hiddenLeakCount = 0`, `evidenceCitationRate = 0.936`, `privateDeepReasoningSpokenCoverage = 1`, `privateTimelineReasoningSpokenCoverage = 1`, `privateIncentiveReasoningSpokenCoverage = 1`, `privateBurdenReasoningSpokenCoverage = 1`, `privateDeepReasoningCompressionCoverage = 1`, `privateEvidenceSynthesisSpokenVerificationCoverage = 1`, `repetitionRate = 0.301`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: Private Source-Timeline Compression

This follow-up compresses the first two private reasoning lenses while keeping both checks audible.

- Private `reason` replies now merge `sourceReliabilityLine` and `timelineConsistencyLine` into one sentence when they describe the same target lane.
- Pair-comparison reads now say phrasing such as `4号和2号的来源和时间线一起看：先看谁有独立来源，身份、票型和回应先后是否自洽；同源回声先降权，再决定主压谁。`
- Single-target vote reads now say phrasing such as `7号的来源和时间线一起看：票型先分自保、跟票还是主动推人，同源跟票不当第二来源；先上票后补理由更吃压力。`
- Added `privateSourceTimelineCompressionCoverage = 1`, requiring fixed private reason rows to preserve both source-reliability and timeline-consistency reasoning in the compressed sentence.
- Root and Unity embedded `ai.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot is 125 rows with `hiddenLeakCount = 0`, `evidenceCitationRate = 0.936`, `privateDeepReasoningSpokenCoverage = 1`, `privateTimelineReasoningSpokenCoverage = 1`, `privateSourceTimelineCompressionCoverage = 1`, `privateIncentiveReasoningSpokenCoverage = 1`, `privateBurdenReasoningSpokenCoverage = 1`, `privateDeepReasoningCompressionCoverage = 1`, `privateEvidenceSynthesisSpokenVerificationCoverage = 1`, `repetitionRate = 0.291`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: Private Reason Opening Redundancy

This follow-up trims a smaller conversational artifact in private `reason` replies.

- Private `reason` replies no longer keep the pattern `我先看 X。...我先排 X` when the same target is already named in the actual conclusion sentence.
- The replacement keeps the direct-answer and cautious-persona contract by using `先给结论：我先不把话说死，...` instead of deleting the bridge entirely.
- Added `privateReasonOpeningRedundancyCoverage = 1`, requiring fixed private reason rows to avoid repeating the focus target in the opening while keeping a human cadence bridge.
- Root and Unity embedded `ai.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot is 125 rows with `hiddenLeakCount = 0`, `evidenceCitationRate = 0.936`, `privateReasonOpeningRedundancyCoverage = 1`, `privateDeepReasoningSpokenCoverage = 1`, `privateTimelineReasoningSpokenCoverage = 1`, `privateSourceTimelineCompressionCoverage = 1`, `privateIncentiveReasoningSpokenCoverage = 1`, `privateBurdenReasoningSpokenCoverage = 1`, `privateDeepReasoningCompressionCoverage = 1`, `repetitionRate = 0.294`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: Private Reason Opening Variants

This follow-up keeps the non-redundant private `reason` opening while reducing its stock-phrase feel.

- Redundant `我先看 X。...我先排 X` openings now choose a deterministic bridge variant from the target seat instead of always using the same phrase.
- Variants include cautious/direct forms such as `先给结论：我先不把话说死，`, `先给结论：我先看这条，但不锁死，`, `先给结论：我先点这条，但不把话说死，`, and `先给结论：我暂时不换目标，先放主线，`.
- The variants still satisfy the existing private dialogue contracts for direct question-answer shape, cautious steady-persona wording, and human cadence.
- Added `privateReasonOpeningVariantCoverage = 1`, requiring the fixed private reason rows to expose multiple direct-answer bridge variants instead of collapsing into one repeated opening.
- Root and Unity embedded `ai.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot is 125 rows with `hiddenLeakCount = 0`, `evidenceCitationRate = 0.936`, `privateReasonOpeningRedundancyCoverage = 1`, `privateReasonOpeningVariantCoverage = 1`, `privateDeepReasoningSpokenCoverage = 1`, `privateTimelineReasoningSpokenCoverage = 1`, `privateSourceTimelineCompressionCoverage = 1`, `privateDeepReasoningCompressionCoverage = 1`, `repetitionRate = 0.286`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: Private Reason Opening Sentence Discipline

This follow-up keeps the bridge variants but makes their sentence boundary explicit before the deeper private reasoning body starts.

- Direct-answer bridge variants now end as standalone sentences, e.g. `先给结论：我先看这条，但不锁死。`, before continuing into evidence synthesis.
- Added `privateReasonOpeningSentenceCoverage = 1`, requiring the fixed private `reason` rows to use one of the standalone bridge sentences instead of comma-splicing the bridge into `在推低证据位...` or `两条线索...`.
- Root and Unity embedded `ai.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot is 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.936`, `privateReasonOpeningRedundancyCoverage = 1`, `privateReasonOpeningVariantCoverage = 1`, `privateReasonOpeningSentenceCoverage = 1`, `privateDeepReasoningSpokenCoverage = 1`, `privateTimelineReasoningSpokenCoverage = 1`, `privateSourceTimelineCompressionCoverage = 1`, `privateDeepReasoningCompressionCoverage = 1`, `repetitionRate = 0.293`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: Non-Public Surface Spacing Discipline

This follow-up keeps non-public AI speech from carrying English-style spaces around Chinese seat labels.

- Added shared normalization so private, nomination, and formal-vote lines say `先问1号`, `4号这边`, and `我原本想投3号` instead of `先问 1号`, `4号 这边`, or `想投 3号`.
- Added `nonPublicSurfacePolishCoverage = 1`, extending the existing public surface polish discipline to private, nomination-defense, and vote rows.
- Added a final public vote-intent timing-pressure preservation guard so budget trimming cannot drop `到投票`, `压力票`, or `补出解释` from high-pressure vote-intent rows.
- Root and Unity embedded `ai.js`, `ai_speech_renderer.js`, `ai_public_discussion.js`, `engine.js`, and `ai_quality_eval.mjs` copies were kept in sync.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot is 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.936`, `nonPublicSurfacePolishCoverage = 1`, `publicTimingPressureVariantCoverage = 1`, `privateReasonOpeningVariantCoverage = 1`, `privateReasonOpeningSentenceCoverage = 1`, `repetitionRate = 0.293`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: Private Deep Reasoning Variants

This follow-up keeps the source/timeline and incentive/burden compression contract, but gives it more human variation.

- Added deterministic source/timeline compression variants for private `reason` replies, so the AI can talk about independent sources, same-source echoes, response order, vote timing, and explanation order without repeating one fixed sentence.
- Added deterministic incentive/burden compression variants, so the AI can distinguish解桌, 护人, 转移压力, 自保, 跟风, 主动推人, and who owes the table a reason.
- Added `privateDeepReasoningCompressionVariantCoverage = 1`; the evaluator strips seat labels before counting variants, so the metric measures phrasing diversity rather than target diversity.
- Tightened non-public seat spacing again to remove residual `在 3号`, `转 7号`, and `放掉 3号` forms.
- Root and Unity embedded `ai.js`, `ai_speech_renderer.js`, and `ai_quality_eval.mjs` copies were kept in sync.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot is 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.936`, `privateDeepReasoningCompressionVariantCoverage = 1`, `privateDeepReasoningCompressionCoverage = 1`, `privateSourceTimelineCompressionCoverage = 1`, `nonPublicSurfacePolishCoverage = 1`, `repetitionRate = 0.278`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: AI Surface Phrase Stack Discipline

This follow-up expands the previous spacing discipline into a broader surface phrase-stack guard.

- The shared polish pass now removes awkward Chinese seams around time words, seats, role names, evidence phrases, and sentence joins: examples include `刚才2号`, `7号与8号`, `有一位是酒鬼`, `卡在推低证据位`, and `换线。台面理由`.
- Public discussion gained a final runtime surface pass after all late-added memory, claim-cover, timing-pressure, and disclosure fragments have been joined.
- Nomination proposal text now receives a final polish after `applySpeechBudget(...)`, preventing polished public reasoning from degrading when it is reused as nomination pressure.
- `oneLine(...)` in the evaluator now mirrors the same polish, so fixture rows and runtime rows are judged under the same surface contract.
- `PUBLIC_SURFACE_POLISH_ARTIFACT_PATTERN` and `NON_PUBLIC_SURFACE_POLISH_ARTIFACT_PATTERN` now catch these phrase-stack seams plus Chinese punctuation followed by leftover spaces.
- Latest validation passed: `node --check` on touched root and Unity JS files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot is 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.936`, `crossScriptPublicReasoningCoverage = 1`, `crossScriptPublicMultiEvidenceCoverage = 1`, `crossScriptCrossDayStanceCoverage = 1`, `nonPublicSurfacePolishCoverage = 1`, `publicSurfacePolishCoverage = 1`, `repetitionRate = 0.278`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: Claim Range Label And Seat Polish

This follow-up addresses the next visible seams in claim disclosure, nomination, and formal-vote wording.

- `claimDisclosurePlanner(...)` now separates short `rangeLabel` values from full `claimRangeForRole(...)` explanatory sentences, so public BMR/SnV claim-pressure rows no longer render a full sentence inside `我只给...范围`.
- `buildClaimDisclosureRationale(...)` and `rememberClaimDisclosure(...)` normalize range labels before storing or recapping them, preserving public-safe continuity without carrying quote-wrapped full sentences forward.
- The shared Chinese surface polish now covers `点过4号`, `我给4号`, `放下1号`, and `理由还是这条可见记录：`, matching the runtime text to the evaluator's one-line contract.
- Public/non-public surface artifact gates now include the old full-sentence range-label shape and the newly covered seat-spacing verbs.
- Latest validation passed: `node --check` on touched root and Unity JS files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot remains 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.936`, `claimDisclosureRationaleCoverage = 1`, `nonPublicSurfacePolishCoverage = 1`, `publicSurfacePolishCoverage = 1`, `repetitionRate = 0.277`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: Private Script-Sensitive Claim Deflection

This follow-up adds a small reasoning layer to private claim withholding.

- First-day, low-pressure good private claim replies now explain script-specific withholding pressure instead of only saying `身份先不说`: BMR cites death/protection/revival identity-value risk, while SnV cites identity and madness pressure separation.
- This keeps the same disclosure planner behavior but makes the private line sound like a player considering the current script, not a generic NPC refusing to claim.
- Added `privateScriptClaimDeflectCoverage = 1` to the fixed evaluator and contract tests, so BMR/SnV private claim rows must keep script-sensitive deflection reasoning.
- The previous normalized duplicate `身份我先不急着说出来...` across BMR/SnV is gone; the follow-up below now closes the remaining formal-vote normalized duplicates.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot remains 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.936`, `privateScriptClaimDeflectCoverage = 1`, `crossScriptClaimDisclosureCoverage = 1`, `repetitionRate = 0.273`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: Formal Vote Normalized Line Diversity

This follow-up tightens formal vote speech after the evaluator started normalizing seat labels before duplicate checks.

- High-evidence no-vote lines now distinguish pressure from execution closure with voter-seat-stable variants, so rows like "many clues, keep pressuring, but do not execute yet" no longer converge to one copied sentence.
- Defense-aware no-votes now get BMR/SnV-specific language while preserving the existing contract: quote the nomination reason, mention the nominee defense, say the defense gave a verifiable direction, and explain why the AI lowers pressure instead of voting.
- The normalized duplicate scan is now empty for formal-vote rows, with `formalVoteLineDiversityCoverage = 1` and `formalVoteNormalizedLineDiversityCoverage = 1`.
- Latest validation passed: `node --check` on root and Unity `ai.js`, `npm run test:ai-quality-eval`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot remains 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.944`, `formalVoteLineDiversityCoverage = 1`, `formalVoteNormalizedLineDiversityCoverage = 1`, `privateScriptClaimDeflectCoverage = 1`, `repetitionRate = 0.265`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: Private Deep Reasoning Brevity

This follow-up improves the balance between reasoning depth and human-readable private chat.

- The private reason path still says the same four deeper reasoning families: evidence synthesis, source/timeline reliability, incentive alignment, and burden of proof.
- The compressed source/timeline and motive/justification fragments are now shorter: same-source evidence is downgraded in one clause, vote motives are split in one clause, and supporter burden is stated without a second report-like half-sentence.
- Added `privateDeepReasoningBrevityCoverage = 1` to the fixed evaluator and contract tests. The gate checks private reason rows with both compressed deep-reasoning fragments and requires them to stay compact enough for chat.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot remains 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.944`, `privateDeepReasoningBrevityCoverage = 1`, `privateDeepReasoningCompressionCoverage = 1`, `privateEvidenceSynthesisCoverage = 1`, `repetitionRate = 0.261`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: Public Evidence Label Stack

This follow-up removes a public speech phrase-stack artifact while preserving the underlying evidence anchor.

- Public lines no longer say `我过不去的是：两条线索合在一起：...`; when the evidence text already announces multi-evidence synthesis, the outer label becomes `证据卡在：...`.
- The complete `两条线索合在一起：...` fragment is still present, so public priority fragments, cross-script reasoning, and evidence-synthesis verification continue to anchor on the same content.
- Added `publicEvidenceSynthesisLabelStackCoverage = 1` to the fixed evaluator and contract tests, requiring public multi-evidence rows to avoid stacked evidence labels.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot remains 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.944`, `publicEvidenceSynthesisLabelStackCoverage = 1`, `publicEvidenceSynthesisCoverage = 1`, `publicPrioritySignalCoverage = 1`, `crossScriptPublicReasoningCoverage = 1`, `repetitionRate = 0.265`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: Evil Private Pressure Plan Dedup

This follow-up fixes a private evil coordination seam where cover planning and target pressure could say the same action twice.

- Evil private claim replies now treat the cover sentence as already carrying the pressure plan when it names the focus target with `火力点`, `先问身份和夜里信息`, `放到讨论中心`, or `先压`.
- In that case, the extra target-pressure sentence becomes a next-step check such as whether the target can keep their story straight and whether to nominate if they cannot, instead of repeating the same firepoint instruction.
- Added `evilPrivatePressurePlanDedupCoverage = 1`; the fixed evaluator checks TB/BMR/SnV evil private coordination samples for repeated `火力点` and `先问身份和夜里信息` phrases.
- This preserves the deeper evil coordination contract: team context, true identity reveal to an evil ally, public cover, pressure target, hidden-truth allowance, and private-only audience all remain covered.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot remains 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.944`, `evilPrivateCoordinationCoverage = 1`, `evilPrivatePressurePlanDedupCoverage = 1`, `aiToAiEvilCoordinationCoverage = 1`, `repetitionRate = 0.268`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: Nomination Strategy Plan Dedup

This follow-up separates nomination target choice from nomination strategy explanation.

- Strategy mode rows still cover `pressure-test`, `coalition-check`, `execution-push`, `avoid-no-execution`, `execution-info`, `public-reason-flow`, and `information-check`.
- The target-choice sentence can now say who goes on the block and why, while the strategy-rationale sentence says what the vote window is testing. This prevents repeated action phrases such as `流程压力打出来` from appearing twice in one nomination line.
- `coalition-check` now uses the second sentence to test whether the table can form a vote, `avoid-no-execution` uses it to preserve the execution window, and `execution-info` uses it to test defense quality instead of restating the same surface reason.
- Added `nominationStrategyPlanDedupCoverage = 1`; the fixed evaluator checks nomination strategy samples for repeated `流程压力打出来`, `看谁愿意跟`, and `执行信息` phrases.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot remains 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.944`, `nominationActionContextCoverage = 1`, `nominationStrategyModeCoverage = 1`, `nominationStrategyPlanDedupCoverage = 1`, `repetitionRate = 0.265`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: Evil Public Claim-Cover Plan Dedup

This follow-up removes duplicated visible plan phrases from evil public claim-cover speech.

- Evil public speech can still explain a public-safe pivot, ally-protection deflection, or cross-day pressure redistribution.
- The repeated copy no longer appears before the verification cue: samples now read like `这轮先转到3号...。台面上...。核法是先听3号...` rather than saying `这轮先转到3号...` twice.
- Added `evilPublicClaimCoverPlanDedupCoverage = 1`; the fixed evaluator covers TB/BMR/SnV long-arc and cross-script claim-cover rows for repeated pivot/protect action phrases.
- This preserves the existing safety contracts: the public claim role remains visible, pivot/protect/cross-day intent remains table-facing, and hidden evil-only language stays absent.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot remains 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.944`, `evilPublicClaimCoverPivotCoverage = 1`, `evilPublicClaimCoverProtectAllyCoverage = 1`, `evilPublicClaimCoverDeceptionArcCoverage = 1`, `evilPublicClaimCoverPressureContinuityCoverage = 1`, `evilPublicClaimCoverPlanDedupCoverage = 1`, `repetitionRate = 0.270`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: Nomination Defense Info Dedup

This follow-up cleans the nominee-defense surface while preserving the deeper debate contract.

- Nominee defense lines now separate the reason anchor, public-safe claim lane, and vote threshold more clearly.
- If the reason itself already says `昨晚信息`, the claim sentence switches to `关键口径`; the follow-up defense sentence then verifies `身份口径`, `公开口径`, or `身份线和票型` without repeating the same information phrase.
- Added `nominationDefenseInfoDedupCoverage = 1`; the fixed evaluator and contract tests now guard against repeated `昨晚信息` / `我的信息` wording in nomination-defense rows.
- The existing contracts stay intact: nomination-defense rows still answer the concrete pressure point, preserve public-only identity/info/vote context, and state the vote threshold or counter-pressure condition.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot remains 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.944`, `nominationDefenseResponseCoverage = 1`, `nominationDefenseInfoDedupCoverage = 1`, `nominationDefenseReasonAnchorCoverage = 1`, `crossScriptNominationDefenseReasonAnchorCoverage = 1`, `repetitionRate = 0.270`, and `stanceContinuityRate = 1`.

## 2026-06-05 Follow-up: Claim Disclosure Surface Dedup

This follow-up polishes claim-disclosure continuity and role-risk speech without changing the disclosure planner's actual level decisions.

- Hard-claim escalation now avoids saying `明跳<role>` twice: the continuity sentence says the claim is advancing to `具体身份`, and the action sentence names the role once.
- Role-constrained claim reasons now explain the consequence behind the boundary instead of echoing the boundary phrase. For example, Mutant risk keeps `功能风险` / `不公开坐实具体身份` in the boundary sentence, then explains outsider execution risk in the reason sentence.
- Added `claimDisclosureSurfaceDedupCoverage = 1`; the fixed evaluator and contract tests guard repeated `具体身份`, `功能风险`, `公开坐实`, `死亡触发身份`, and `明跳<role>` in claim-continuity and role-constrained claim rows.
- Existing disclosure contracts remain intact: continuity still covers hold/escalate/revise, role-constrained claims still cover madness / outsider-risk / Mutant / Sweetheart / Barber / death-trigger timing, and public-only hidden-role safety remains enforced.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot remains 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.952`, `claimDisclosureContinuityCoverage = 1`, `claimDisclosureContinuityModeCoverage = 1`, `claimDisclosureSurfaceDedupCoverage = 1`, `roleConstrainedClaimDisclosureCoverage = 1`, `repetitionRate = 0.273`, and `stanceContinuityRate = 1`.

## 2026-06-05 Follow-up: Private Source-Identity Synthesis Dedup

This follow-up sharpens private source-vs-identity reasoning so it reads like layered analysis instead of a repeated recheck instruction.

- The synthesis layer now says the structural conflict: `来源链和身份口径卡在一起`.
- The verification layer still asks the actionable question: which source can be rechecked, then whether the identity line aligns with public validation.
- Added `privateEvidenceSynthesisSourceIdentityDedupCoverage = 1`; the fixed evaluator and contract tests guard source-identity private synthesis rows against repeated `来源不稳` / `再对一下` wording.
- Existing private evidence-synthesis contracts remain intact: all five modes still cover family synthesis, mode-specific verification metadata, and spoken verification actions across BMR/SnV.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot remains 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.952`, `privateEvidenceSynthesisVariantCoverage = 1`, `privateEvidenceSynthesisVerificationCoverage = 1`, `privateEvidenceSynthesisSpokenVerificationCoverage = 1`, `privateEvidenceSynthesisSourceIdentityDedupCoverage = 1`, `repetitionRate = 0.273`, and `stanceContinuityRate = 1`.

## 2026-06-05 Follow-up: Private Vote-Taxonomy Synthesis Dedup

This follow-up sharpens protection-vote private reasoning by separating source independence from vote-motive classification.

- Source/timeline compression for vote conflicts now asks whether the counter-vote is independent and whether same-source follow votes should be discounted.
- Motive/burden compression keeps the self-preservation / following / active-push taxonomy, so the classification appears once at the right reasoning layer.
- Added `privateEvidenceSynthesisVoteTaxonomyDedupCoverage = 1`; the fixed evaluator and contract tests guard protection-vote private synthesis rows against repeated `自保`, `跟风`, and `主动推人` wording.
- Existing deep-reasoning contracts remain intact: source/timeline compression, incentive/burden compression, and all private evidence-synthesis mode gates still pass.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot remains 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.952`, `privateSourceTimelineCompressionCoverage = 1`, `privateDeepReasoningCompressionCoverage = 1`, `privateEvidenceSynthesisVoteTaxonomyDedupCoverage = 1`, `repetitionRate = 0.274`, and `stanceContinuityRate = 1`.

## 2026-06-05 Follow-up: Cross-Day Reason Recap Dedup Gate

This follow-up protects the cross-day public stance layer from sounding like it pastes the same evidence fragment twice.

- Cross-day memory recap now stays focused on stance continuity and evidence-volume movement; the concrete current reason stays in the evidence anchor that follows.
- The fixed evaluator adds `crossDayStanceReasonRecapDedupCoverage = 1`, counting each cross-day row's current reason head and requiring it to appear no more than once in the spoken line.
- Contract tests now assert the same row-level condition for BMR/SnV cross-day hold and shift samples, while degraded summaries are expected to fail the new gate.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot remains 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.952`, `crossDayStanceContinuityCoverage = 1`, `crossDayStanceReasonCoverage = 1`, `crossDayStanceReasonRecapDedupCoverage = 1`, `crossDayStanceEvidenceDeltaCoverage = 1`, `crossScriptCrossDayStanceCoverage = 1`, `repetitionRate = 0.270`, and `stanceContinuityRate = 1`.

## 2026-06-05 Follow-up: Private Deep Reasoning Lead Dedup

This follow-up tightens private reason replies where compressed source/timeline and motive/burden sentences appear back-to-back.

- The first compressed sentence still names the relevant target pair or vote seat so the evidence comparison remains anchored.
- The second compressed sentence now starts with `动机和举证一起看...`, turning it into a continuation instead of another full target-labeled audit heading.
- The fixed evaluator adds `privateDeepReasoningLeadDedupCoverage = 1`, rejecting rows where the same `X号` or `X号和Y号` lead appears before both `来源和时间线一起看` and `动机和举证一起看`.
- Contract tests assert the same condition over all private reason rows with both deep-compression segments, and degraded summaries now fail the new gate.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot remains 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.952`, `privateSourceTimelineCompressionCoverage = 1`, `privateDeepReasoningCompressionCoverage = 1`, `privateDeepReasoningBrevityCoverage = 1`, `privateDeepReasoningLeadDedupCoverage = 1`, `privateEvidenceSynthesisCoverage = 1`, `repetitionRate = 0.285`, and `stanceContinuityRate = 1`.

## 2026-06-05 Follow-up: Public Pressure Action Lead Dedup

This follow-up tightens high-pressure public lines where persona pressure and final urgency could repeat the same action lead.

- Pressure persona rows can still open with a direct action such as `我会先压9号`, but the later urgency sentence now continues as `我直说，需要马上听回应。` instead of repeating `我先压9号`.
- Shadow pressure rows can still mark a target as the main line, but the follow-up sentence now says `我有点在意，需要听回应。` instead of restating `9号我先暗记成主线`.
- The fixed evaluator adds `publicPressureActionLeadDedupCoverage = 1`, checking public persona/timing/role/high-focus pressure rows for repeated same-seat pressure action leads.
- Contract tests assert the same row-level condition over public persona-pressure samples, and degraded summaries now fail the new gate.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot remains 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.952`, `publicPersonaPressureVariantCoverage = 1`, `publicShadowPressureLineDiversityCoverage = 1`, `publicPressureActionLeadDedupCoverage = 1`, `repetitionRate = 0.283`, and `stanceContinuityRate = 1`.

## 2026-06-05 Follow-up: Private Deep Reasoning Heading Variants

This follow-up keeps private deep reasoning deep, but makes the compressed reasoning headings less report-like.

- Source/timeline compression now rotates through player-readable headings such as `来源和节奏合起来`, `这条线先拆来源`, `这票先拆来源`, and `这边先看回应先后`.
- Motive/burden compression now rotates through headings such as `动机和理由合起来`, `再看票的收益`, `再看收益和举证`, and `最后看谁该说明`.
- The fixed evaluator adds `privateDeepReasoningHeadingVariantCoverage = 1`, while existing source/timeline, incentive, burden, compression, brevity, and lead-dedup gates still pass.
- Contract tests assert that private reason samples use at least three source/timeline heading variants and at least three motive/burden heading variants, so the old single-heading style cannot silently return.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot remains 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.952`, `privateSourceTimelineCompressionCoverage = 1`, `privateDeepReasoningCompressionCoverage = 1`, `privateDeepReasoningCompressionVariantCoverage = 1`, `privateDeepReasoningHeadingVariantCoverage = 1`, `privateDeepReasoningBrevityCoverage = 1`, `privateDeepReasoningLeadDedupCoverage = 1`, `repetitionRate = 0.285`, and `stanceContinuityRate = 1`.

## 2026-06-05 Follow-up: Private Reason Opening Lead Variants

This follow-up removes the fixed `先给结论：` lead from private reason replies.

- Private reason openings now rotate through `我先不把话说死，先说排序。`, `这条我先看，但不锁死。`, `我先点这条，先别当铁证。`, and `我暂时不换目标，先放主线。`.
- The new wording still satisfies the existing human-cadence contract: each opening is a standalone sentence and still signals uncertainty or target-ordering before evidence details.
- The fixed evaluator adds `privateReasonOpeningLeadVariantCoverage = 1`, requiring at least three opening lead variants and rejecting the old single-lead `先给结论：` style.
- Contract tests assert both the new summary metric and row-level lead diversity across private reason samples.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot remains 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.952`, `privateReasonOpeningRedundancyCoverage = 1`, `privateReasonOpeningVariantCoverage = 1`, `privateReasonOpeningLeadVariantCoverage = 1`, `privateReasonOpeningSentenceCoverage = 1`, `repetitionRate = 0.285`, and `stanceContinuityRate = 1`.

## 2026-06-05 Follow-up: Private Reason Opening Lead Distribution Gate

This follow-up makes private reason openings prove distribution instead of only avoiding the old `先给结论：` lead.

- `privateReasonOpeningBridgeForSeat(...)` now rotates across eight cautious direct-answer leads, including `先把排序说清，但不拍死`, `我先按主线排，不当铁证`, `先给你一个暂定排序`, and `这条先当主线，不急着拍死`.
- The bridge uses seat plus current reply content as its deterministic salt, so repeated multi-evidence reason rows vary without changing focus, runner-up, evidence synthesis, verification plan, or deep reasoning lines.
- The fixed evaluator keeps `privateReasonOpeningVariantCoverage = 1` and `privateReasonOpeningLeadVariantCoverage = 1`, but now requires at least five variants/leads and rejects single-lead dominance.
- Contract tests assert expanded accepted leads, at least five private opening leads, bounded dominance, standalone opening sentences, and no focus-seat repetition.
- Latest validation passed: `node --check` on touched root/Unity JS/test files, `node scripts\ai_quality_eval.mjs`, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, root/Unity no-index sync checks, `git diff --check`, and trailing-whitespace checks. Current fixed snapshot remains 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.952`, `privateReasonOpeningVariantCoverage = 1`, `privateReasonOpeningLeadVariantCoverage = 1`, `privateReasonOpeningSentenceCoverage = 1`, `repetitionRate = 0.194`, and `stanceContinuityRate = 1`.

## 2026-06-05 Follow-up: Private Verification Lead Naturalization

This follow-up turns private verification actions from report-style labels into spoken table prompts.

- Spoken private reason text no longer needs to say `验证点是...`; the same action can surface as `先听...`, `先核...`, `这条先问...`, or `这条先让...`.
- Structured metadata is unchanged: `decisionRationale.verificationLine` still carries the auditable verification plan for tests and future UI cards.
- The fixed evaluator adds `privateVerificationLeadNaturalizationCoverage = 1`, scoped to private reason rows where a verification action is actually spoken.
- Contract tests assert that spoken private verification rows do not expose `验证点是` and do include a natural verification lead.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot remains 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.952`, `privateEvidenceSynthesisSpokenVerificationCoverage = 1`, `privateVerificationLeadNaturalizationCoverage = 1`, `repetitionRate = 0.285`, and `stanceContinuityRate = 1`.

## 2026-06-05 Follow-up: Public Evidence Anchor Lead Variants

This follow-up keeps public multi-evidence reasoning intact while making the spoken evidence anchor less repetitive.

- Public evidence anchors no longer need to say `证据卡在：两条线索合在一起：...`; the structural prefix is stripped from the spoken line and replaced with leads such as `这两点合着看：...`, `我卡的是这组线索：...`, `不止一条线在指这里：...`, or `桌面问题连在一起：...`.
- `renderPublicSurfaceActReadable(...)` now also rewrites public claim/disclosure evidence from `卡在两条线索合在一起：...` to `卡在这两点合着看：...`, closing the non-anchor surface path.
- `publicTextIncludesEvidenceSignal(...)` lets the evaluator treat full `evidenceSpokenText` and stripped evidence body as the same public evidence anchor, so existing cross-script public reasoning, cross-day stance reason, and priority-signal coverage still prove evidence preservation.
- The fixed evaluator adds `publicEvidenceAnchorLeadVariantCoverage = 1`, requiring all public multi-evidence anchor rows to avoid the old stacked lead and requiring at least three natural lead variants.
- Contract tests assert both the summary metric and row-level lead naturalization over public multi-evidence anchor rows.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot remains 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.952`, `crossScriptPublicReasoningCoverage = 1`, `crossScriptPublicMultiEvidenceCoverage = 1`, `publicPrioritySignalCoverage = 1`, `publicEvidenceAnchorLeadVariantCoverage = 1`, `repetitionRate = 0.248`, and `stanceContinuityRate = 1`.

## 2026-06-05 Follow-up: Public Evidence Anchor Lead Distribution Gate

This follow-up turns public evidence-anchor naturalization into a distribution contract instead of only a recognizability contract.

- `publicEvidenceAnchorLabel(...)` now has a larger strong-anchor lead pool, including `两条线先并起来看`, `这组关系不能拆开看`, `不是单点，线索接在一起`, `先把这组线放到同一桌面`, `我先按这组矛盾追问`, and `这里要把两边一起验`.
- Low-evidence anchor leads also gained softer variants such as `先按两条弱线对账`, `证据不厚，先把两边接住`, and `这组线还要补证`.
- Final public surface polish now compresses `lead，两条线索合在一起：...` into `lead：...`, removing the remaining structural wording after a natural lead has already been selected.
- The fixed evaluator keeps `publicEvidenceAnchorLeadVariantCoverage = 1`, but now requires at least five lead variants and rejects dominance by a single lead across fixed public multi-evidence rows.
- Contract tests assert the expanded lead pattern, no old or new label stacks, at least five variants, and bounded lead dominance.
- Latest validation passed: `node --check` on touched root/Unity JS/test files, `node scripts\ai_quality_eval.mjs`, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, root/Unity no-index sync checks, `git diff --check`, and trailing-whitespace checks. Current fixed snapshot remains 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.952`, `publicEvidenceAnchorLeadVariantCoverage = 1`, `publicEvidenceSynthesisLabelStackCoverage = 1`, `publicEvidenceSynthesisCoverage = 1`, `repetitionRate = 0.201`, and `stanceContinuityRate = 1`.

## 2026-06-05 Follow-up: Claim Disclosure Hold Lead Variants

This follow-up makes repeated identity-claim hold lines less template-like while keeping the same disclosure planner and metadata contract.

- Hold continuity no longer falls back to `延续前面的身份口径，仍按...`; it now uses stable spoken variants such as `身份线我不改，今天仍按...`, `前面这条身份我先不换，继续按...`, and `我不无理由改口，...这条继续放桌面上`.
- The structured field `claimDisclosureRationale.continuityLine` remains authoritative, and the rendered response must include the same line for auditability.
- The fixed evaluator adds `claimDisclosureHoldLeadVariantCoverage = 1`, requiring hold rows to avoid the old fixed lead and requiring at least three natural lead variants.
- Contract tests assert both the summary metric and row-level hold-continuity lead naturalization over claim-disclosure hold rows.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, root/Unity no-index sync checks, `git diff --check`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot remains 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.952`, `claimDisclosureContinuityCoverage = 1`, `claimDisclosureSurfaceDedupCoverage = 1`, `claimDisclosureHoldLeadVariantCoverage = 1`, `publicEvidenceAnchorLeadVariantCoverage = 1`, `repetitionRate = 0.258`, and `stanceContinuityRate = 1`.

## 2026-06-05 Follow-up: Public Verification Lead Variants

This follow-up keeps public multi-evidence verification actionable while reducing repeated `核法是先听...` openings.

- Public synthesis verification now varies the lead across `核法是先听...`, `这条先让...`, `先请...`, and `核法先交给...来`, keyed deterministically by target and evidence context.
- The verification body still carries the same reasoning contract: target name, evidence-family relation, and the specific table action needed to resolve the pressure.
- `dedupePublicEvilPlanBeforeVerification(...)` now recognizes the new leads, so evil pivot/protect claim-cover rows still remove duplicated strategy-action text before verification.
- The fixed evaluator adds `publicVerificationLeadVariantCoverage = 1`, requiring every public synthesis verification row to use a recognized lead and requiring at least three lead variants.
- Contract tests assert both the summary metric and row-level lead diversity over public multi-evidence verification prompts.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, root/Unity no-index sync checks, `git diff --check`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot remains 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.952`, `publicVerificationLeadVariantCoverage = 1`, `publicEvidenceSynthesisSpokenVerificationCoverage = 1`, `publicEvidenceSynthesisSpokenVerificationVariantCoverage = 1`, `evilPublicClaimCoverPlanDedupCoverage = 1`, `repetitionRate = 0.241`, and `stanceContinuityRate = 1`.

## 2026-06-05 Follow-up: Balanced Claim Disclosure Reason Variants

This follow-up keeps `balanced_disclosure` as the same planner decision while making its spoken reason less template-like.

- The old fixed reason `当前适合给可追问口径，但不一定一次交死` is no longer used in balanced claim-disclosure rationale lines or final text.
- `claimDisclosureActionLine(...)` now derives a deterministic balanced reason from disclosure level, visible role/range, audience, continuity, day, and channel.
- Hard disclosures use concrete-checkability reasons such as `现在需要把身份口径交到能被追问的程度`, `这轮要让桌面有具体口径可以复核`, `身份线已经到该给可验证落点的时候`, and `继续含糊只会让后续追问失焦`.
- Range/vague disclosures keep the caution explicit with lines such as `先给桌面能追问的边界，不把具体身份一次说死`, `这轮先让口径可追问，身份细节等压力再补`, and `先把可验证边界放出来，不急着把整条身份线摊完`.
- The fixed evaluator adds `claimDisclosureBalancedReasonVariantCoverage = 1`, requiring every balanced rationale line to use a recognized natural reason, requiring final text to avoid the old fixed reason, and requiring visible balanced-disclosure rows to cover at least three reason variants.
- Contract tests assert both the summary metric and row-level balanced-reason naturalization while preserving existing claim disclosure rationale, continuity, hold-lead, cross-script, and role-constrained gates.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, root/Unity no-index sync checks, `git diff --check`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot remains 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.952`, `claimDisclosureBalancedReasonVariantCoverage = 1`, `claimDisclosureRationaleCoverage = 1`, `claimDisclosureContinuityCoverage = 1`, `claimDisclosureHoldLeadVariantCoverage = 1`, `publicVerificationLeadVariantCoverage = 1`, `repetitionRate = 0.241`, and `stanceContinuityRate = 1`.

## 2026-06-05 Follow-up: Public Pressure Urgency Tail Variants

This follow-up keeps high-pressure public target commitment intact while making the spoken urgency tail less repetitive.

- `publicPersonaMultiEvidencePressureLine(...)` still uses the same score/evidence threshold and still emits `我会先压X号` for pressure-persona multi-evidence rows.
- The repeated tail `别拖到票前才解释` now varies across deterministic public-safe options: `别拖到票前才解释`, `这轮就要先把回应补上`, `不要等到落票前才补口径`, `先在讨论阶段把解释说清`, and `票前再补就太晚了`.
- `PUBLIC_PERSONA_PRESSURE_VARIANT_PATTERNS.pressure` no longer depends on the old fixed tail; it recognizes the pressure action itself instead.
- The fixed evaluator adds `publicPressureUrgencyTailVariantCoverage = 1`, requiring every public multi-evidence row with `我会先压X号` to carry a recognized urgency tail and requiring at least three tail variants.
- Contract tests assert both the summary metric and row-level urgency-tail diversity over fixed public pressure samples.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, root/Unity no-index sync checks, `git diff --check`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot remains 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.952`, `publicPressureUrgencyTailVariantCoverage = 1`, `publicPersonaPressureVariantCoverage = 1`, `publicPressureActionLeadDedupCoverage = 1`, `publicVerificationLeadVariantCoverage = 1`, `repetitionRate = 0.233`, and `stanceContinuityRate = 1`.

## 2026-06-05 Follow-up: Public Follow-up Tail Variants

This follow-up keeps public verification intent and evidence-family matching intact while making the action tail less like a repeated script cue.

- `publicEvidenceSynthesisVerificationText(...)` and `publicSpecificFollowUpQuestionText(...)` now route through deterministic action-family tail variants for identity/vote, pressure/vote, identity/nomination, pressure/nomination, vote-only, identity-only, unclear, and evidence-position follow-ups.
- Public lines keep the same target and verification lead, but the follow-up can now vary between tails such as `再补投票理由`, `投票理由也要补清`, `再把身份和昨晚信息补齐`, `昨晚信息也要说完整`, `回应提名压力怎么解`, and `再解释提名压力`.
- The evaluator recognizes naturalized action starts such as `把身份和票型先对上`, `身份口径先对齐`, `把没讲清的点先补上`, and `压低证据位这点先讲清`, so the gate measures the intended public action instead of forcing one grammatical template.
- `publicEvidenceSynthesisSpokenVerificationVariantCoverage` now accepts any matching synthesis/verification pair in rows with multiple synthesis families, preventing the first detected synthesis phrase from hiding a valid mode match.
- The fixed evaluator adds `publicFollowUpTailVariantCoverage = 1`, requiring recognized public verification tails, at least six tail variants, and no dominance from the old `再说昨晚信息` wording.
- Contract tests cover both the summary metric and row-level tail distribution, and the AI agent priority-budget test now accepts the naturalized stripped evidence body used by current public evidence anchors.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, root/Unity no-index sync checks, `git diff --check`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot remains 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.952`, `publicFollowUpTailVariantCoverage = 1`, `publicEvidenceSynthesisSpokenVerificationCoverage = 1`, `publicEvidenceSynthesisSpokenVerificationVariantCoverage = 1`, `publicVerificationLeadVariantCoverage = 1`, `publicPressureUrgencyTailVariantCoverage = 1`, `repetitionRate = 0.236`, and `stanceContinuityRate = 1`.

## 2026-06-05 Follow-up: Private Runner-up Comparison Line Variants

This follow-up keeps the structured focus-vs-runner-up comparison intact while making the private reasoning line sound less like the same audit sentence every time.

- `buildReasoningContrastLine(...)` now salts comparison wording with focus, runner-up, evidence counts, score gap, evidence mode, evidence-summary key, and public/private scope.
- More-visible-evidence comparisons no longer collapse into only `我先排X号，不是放过Y号：X号这边我可见的线索更多`; they can now say `Y号不是放掉，只是X号这边我可见的证据更成组`, `X号先放主线，Y号留在第二层`, or `先处理X号，不是清掉Y号`.
- Higher-pressure, close-call, and score-order branches also gained deterministic variants while preserving the same target, runner-up, evidence count, score gap, reason key, and comparison trace metadata.
- Private reason opening polish and evaluator redundancy detection now recognize the new comparison forms, preventing `我先看X号。先处理X号...` from reintroducing repeated focus openings.
- The fixed evaluator adds `privateRunnerUpComparisonLineVariantCoverage = 1`, requiring recognized private runner-up comparison lines, at least six normalized variants, no old-template dominance, and no single variant dominance.
- Contract tests cover the new summary metric and row-level normalized variant distribution, and the AI agent question-answer-shape test now accepts multi-evidence endings such as `逐条回应` and `支持者也要解释`.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, root/Unity no-index sync checks, `git diff --check`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot remains 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.952`, `privateRunnerUpComparisonLineVariantCoverage = 1`, `runnerUpComparisonCoverage = 1`, `privateReasonOpeningRedundancyCoverage = 1`, `privateReasonOpeningVariantCoverage = 1`, `privateReasonOpeningLeadVariantCoverage = 1`, `publicFollowUpTailVariantCoverage = 1`, `repetitionRate = 0.232`, and `stanceContinuityRate = 1`.

## 2026-06-05 Follow-up: Private Deep Reasoning Tail Variants

This follow-up keeps the private source/timeline and incentive/burden reasoning contracts intact while making their compressed spoken tails less repetitive.

- `privateSourceTimelineCompressionLine(...)` and `privateIncentiveBurdenCompressionLine(...)` now use a full-text deterministic hash for variant selection instead of only the first seat number.
- Source/timeline tails now vary across independent source weighting, vote-source timing, mutual restatement, independent information order, and response support, with headings such as `先分来源再看节奏`, `这条先按来源拆开`, `先对来源独立性`, `先分票源和节奏`, and `这票先看谁先动手`.
- Incentive/burden tails now vary across vote motive, proof burden, benefit line, pressure transfer, and public responsibility, with headings such as `票面动机要拆开`, `再看举证负担`, `收益线要拆开`, `再分动机和举证`, and `最后落到责任`.
- The evaluator recognizes the expanded heading set and semantic tails such as `互相复述`, `独立信息`, `来源独立性`, `事后跟票`, `举证负担`, `可复核理由`, and `推给别人`.
- The fixed evaluator adds `privateDeepReasoningTailVariantCoverage = 1`, requiring at least six normalized source/timeline tails, at least six normalized motive/burden tails, and no single tail dominating the fixed private reason rows.
- Contract tests cover the new summary metric, row-level normalized tail distribution, and existing source/timeline, incentive, burden, heading, brevity, and lead-dedup gates.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, root/Unity no-index sync checks, `git diff --check`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot remains 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.952`, `privateDeepReasoningTailVariantCoverage = 1`, `privateDeepReasoningCompressionVariantCoverage = 1`, `privateDeepReasoningHeadingVariantCoverage = 1`, `privateSourceTimelineCompressionCoverage = 1`, `privateDeepReasoningBrevityCoverage = 1`, `privateRunnerUpComparisonLineVariantCoverage = 1`, `repetitionRate = 0.227`, and `stanceContinuityRate = 1`.

## 2026-06-05 Follow-up: Claim Disclosure Hold Lead Distribution Gate

This follow-up deepens claim-continuity language quality by making repeated hard identity-hold rows prove distribution, not just recognizability.

- Hard hold continuity now has eight recognized natural leads, including new forms such as `这条身份先沿用...`, `今天不重开身份线...`, `我先稳住...口径`, and `前面报过的...先不撤`.
- A dedicated rolling hash now salts hold-lead selection with level, visible role, reason key, audience, day, and channel, so repeated claim continuity can vary without changing the planner's disclosure level, role, continuity mode, or spoken audit line contract.
- `claimDisclosureHoldLeadVariantCoverage` now requires at least five hold-lead variants and rejects a fixed set where one lead dominates.
- Contract tests assert the expanded pattern set, exact spoken inclusion of `claimDisclosureRationale.continuityLine`, at least five variants, and bounded dominance.
- Latest validation passed for syntax and the fixed evaluator: `node --check` on touched root/Unity JS/test files and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot remains 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.952`, `claimDisclosureHoldLeadVariantCoverage = 1`, `claimDisclosureContinuityCoverage = 1`, `claimDisclosureRationaleCoverage = 1`, `repetitionRate = 0.217`, and `stanceContinuityRate = 1`.

## 2026-06-05 Follow-up: Public Shadow Target Line Variants

This follow-up keeps shadow/persona public target tracking intact while removing the repeated `我先暗记X号这条主线` surface.

- `publicPersonaMultiEvidencePressureLine(...)` now delegates shadow target tracking to `publicShadowTargetLine(...)`, preserving the same target, synthesis, evidence count, and score threshold.
- The target line now varies across table-chat forms such as `X号这条先留在主线里`, `X号先挂观察位`, `这条先记在X号身上`, `X号这边先留一格压力`, `X号先留在台面压力线上`, `X号这边我先不放下`, `先把X号留在压力线上`, and `X号这条先记一笔`.
- Public pressure de-duplication now removes legacy `X号我先暗记成主线，需要听回应` fragments whenever either old or new shadow target-tracking lines are already present.
- The fixed evaluator adds `publicShadowTargetLineVariantCoverage = 1`, requiring recognized target-tracking lines, at least three variants, and bounded dominance across fixed shadow target rows.
- Contract tests assert the summary metric, reject old `暗记主线` lines, and check row-level variant distribution.
- Latest validation passed: `node --check` on touched root/Unity JS/test files, `node scripts\ai_quality_eval.mjs`, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, root/Unity no-index sync checks, and `git diff --check`. Current fixed snapshot remains 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.952`, `publicShadowTargetLineVariantCoverage = 1`, `publicShadowPressureLineDiversityCoverage = 1`, `publicPressureActionLeadDedupCoverage = 1`, `repetitionRate = 0.216`, and `stanceContinuityRate = 1`.

## 2026-06-05 Follow-up: Public Pressure Action Lead Variants

This follow-up keeps pressure-persona public commitment intact while making the visible action lead less template-like.

- `publicPersonaMultiEvidencePressureLine(...)` now delegates pressure commitment wording to `publicPressureActionLine(...)`, preserving the same target, synthesis, evidence count, score, persona path, and urgency-tail logic.
- The action lead now varies across forms such as `我会先压X号`, `这轮先压X号`, `我会直接压X号`, `先把X号压到桌面上`, `X号这边我先给压力`, and `X号先上压力`.
- Pressure-action de-duplication recognizes the expanded lead set, so legacy fragments like `我先压X号，需要马上听回应` are removed after any structured pressure action has already appeared.
- The fixed evaluator adds `publicPressureActionLeadVariantCoverage = 1`, requiring recognized pressure action leads, at least four variants, and bounded dominance across fixed pressure rows.
- Contract tests assert both the summary metric and row-level action-lead distribution while preserving urgency-tail coverage and action-lead de-dup coverage.
- Latest fixed snapshot remains 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.952`, `publicPressureActionLeadVariantCoverage = 1`, `publicPressureUrgencyTailVariantCoverage = 1`, `publicPressureActionLeadDedupCoverage = 1`, `repetitionRate = 0.214`, and `stanceContinuityRate = 1`.

## 2026-06-05 Follow-up: Evil Private Team/Cover Variants

This follow-up improves hidden evil coordination speech without changing evil recognition, bluff knowledge, public cover safety, or the private-only visibility boundary.

- Hidden team-info speech now flows through `evilAllianceTeamInfoLine(...)`, giving demon/minion rows several table-chat private forms for the same facts: `队伍先对齐...`, `我这边知道的底牌...`, `先把队伍信息说清...`, `邪恶视角先对底...`, and `我这边的队伍牌面...`.
- Empty-minion cases no longer repeat only `爪牙同伴暂无`; they can now say `其他爪牙暂无`, `暂时没有别的爪牙`, `旁边爪牙先记空`, `其他爪牙先不算`, or `爪牙同伴暂时没看到`.
- No-bluff cover planning now flows through `evilAllianceNoBluffCoverPlanLine(...)`, so same-team private rows can keep the same public pressure target while varying the plan with forms like `伪装先留活口`, `台面身份边走边补`, and `低信息好人方向先留着`.
- The fixed evaluator now gates `evilPrivateTeamInfoVariantCoverage = 1` and `evilPrivateCoverPlanVariantCoverage = 1`, requiring recognized hidden-team and cover-plan variants, enough distribution, and no single sentence dominating the fixed set.
- Contract tests reject the old fixed `先对底：恶魔位X号；爪牙同伴暂无` line, check at least four team-info variants and at least three cover-plan variants, and keep existing evil private / AI-AI coordination contracts intact.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `node scripts\ai_quality_eval.mjs`, `npm run test:ai-quality-eval`, and `npm run test:ai-agents`. Current fixed snapshot remains 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.952`, `evilPrivateCoordinationCoverage = 1`, `evilPrivateTeamInfoVariantCoverage = 1`, `evilPrivateCoverPlanVariantCoverage = 1`, `aiToAiEvilCoordinationCoverage = 1`, `repetitionRate = 0.182`, and `stanceContinuityRate = 1`.

## 2026-06-05 Follow-up: Public Evidence Synthesis Explicit Modes

This follow-up deepens the public reasoning evaluation floor: all public multi-evidence synthesis modes now have explicit generated fixtures, rather than relying on incidental coverage from broader public-pressure rows.

- `pushPublicEvidenceSynthesisVerificationVariantRows(...)` now emits four expected modes: `identity-vote`, `pressure-vote`, `identity-nomination`, and `pressure-nomination`.
- The `identity-vote` fixture requires identity/vote synthesis such as `身份口径和票型一起压过来` and a matching public action that asks the target to align identity, vote shape, and vote reason.
- The `pressure-vote` fixture requires pressure/vote synthesis such as `台面压力和投票线同向` and a matching public action that asks why the vote shape follows table pressure.
- The nomination fixtures keep the existing deeper actions: identity/nomination must ask how the identity resolves nomination pressure, while pressure/nomination must ask which unresolved table-pressure point pushed the target into nomination pressure.
- The fixed evaluator now gates `publicEvidenceSynthesisExplicitModeCoverage = 1`, requiring every explicit fixture to preserve multiple evidence summaries, match its expected synthesis mode, say the matching verification action, and avoid hidden-team language.
- Contract tests now expect all four explicit public synthesis rows, assert the summary metric, and include a degraded-summary failure check for the new gate.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `node scripts\ai_quality_eval.mjs`, and `npm run test:ai-quality-eval`. Current fixed snapshot is 127 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.953`, `publicEvidenceSynthesisSpokenVerificationVariantCoverage = 1`, `publicEvidenceSynthesisExplicitModeCoverage = 1`, `publicVerificationLeadVariantCoverage = 1`, `repetitionRate = 0.181`, and `stanceContinuityRate = 1`.

## 2026-06-05 Follow-up: Public Table Speech Brevity Gate

This follow-up adds a public-facing brevity contract so richer reasoning does not silently turn public table speech into audit prose.

- The fixed evaluator now gates `publicTableSpeechBrevityCoverage = 1` for generated `public-discussion` rows.
- The limit is intentionally applied only to public discussion speech: private deep reasoning already has its own brevity gate, while nomination, defense, and vote rows have different UI and ceremony constraints.
- Every fixed public discussion row must stay within 190 characters after one-line normalization. Current generated rows remain under the limit while preserving public evidence synthesis, role/script pressure, target focus, and verification action.
- Contract tests assert both the summary metric and the actual longest generated public discussion row, making the brevity contract auditable instead of only declarative.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `node scripts\ai_quality_eval.mjs`, and `npm run test:ai-quality-eval`. Current fixed snapshot is 127 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.953`, `publicEvidenceSynthesisExplicitModeCoverage = 1`, `publicTableSpeechBrevityCoverage = 1`, `repetitionRate = 0.181`, and `stanceContinuityRate = 1`.

## 2026-06-06 Follow-up: Public Evidence Anchor Body Dedup

This follow-up keeps the richer public multi-evidence reasoning from re-saying the same evidence anchor after a verification-action tail has already carried it.

- `polishPublicLineSurface(...)` now applies `dedupePublicEvidenceAnchorLine(...)` after the existing surface cleanup, covering both direct public discussion output and composed public lines.
- The dedupe key compares exact body repeats and long nested-prefix repeats, so `anchor body, verification action...` followed by the same `anchor body` is removed without trimming short unrelated fragments.
- The fixed evaluator adds `publicEvidenceAnchorDedupCoverage = 1` beside the existing lead-variant and label-stack gates; contract tests also scan every fixed public multi-evidence row for duplicate or nested anchor bodies.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `node scripts\ai_quality_eval.mjs`, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and root/Unity no-index sync checks. Current fixed snapshot is 127 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.953`, `publicEvidenceAnchorDedupCoverage = 1`, `publicEvidenceAnchorLeadVariantCoverage = 1`, `publicEvidenceSynthesisExplicitModeCoverage = 1`, `publicTableSpeechBrevityCoverage = 1`, `repetitionRate = 0.171`, and `stanceContinuityRate = 1`.

## 2026-06-06 Follow-up: Public Clipped Evidence Fragment Cleanup

This follow-up tightens the public-language floor by removing remaining clipped evidence fragments from generated table speech instead of merely normalizing them during evaluator matching.

- Target-switch memory lines now convert long current-reason summaries into compact spoken clauses (`票型需要重新对账`, `公开压力要重新对齐`) before the evidence anchor expands the concrete reason.
- Public final polish now repairs newer clipped evidence shards such as `公开站队和...`, `投票理...`, and `票型跟...`, matching the existing cleanup for older `刚才投票...` / `身份...` forms.
- `publicEvidenceFragmentClarityCoverage` now catches those newer clipped forms, and the contract test adds row-level assertions for every fixed public evidence row. `publicSurfacePolishCoverage` also catches the awkward `来先` sequence.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `node scripts\ai_quality_eval.mjs`, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and root/Unity no-index sync checks. Current fixed snapshot is 127 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.953`, `publicEvidenceFragmentClarityCoverage = 1`, `publicSurfacePolishCoverage = 1`, `publicTableSpeechBrevityCoverage = 1`, zero public ellipsis rows, zero `来先` rows, `repetitionRate = 0.175`, and `stanceContinuityRate = 1`.

## 2026-06-06 Follow-up: Public Action-First Surface Polish

This follow-up tightens public action wording by removing duplicate `先` markers from verification requests while preserving the same target, evidence, and follow-up action.

- Public final polish now rewrites `先请X号先...`, `把身份和票型先对上/对齐`, and `把没讲清的点先补上` into single-action forms.
- The fixed evaluator extends `publicSurfacePolishCoverage = 1` to catch duplicate action-first wording, and contract tests assert every public row avoids the same pattern.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `node scripts\ai_quality_eval.mjs`, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and root/Unity no-index sync checks. Current fixed snapshot is 127 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.953`, `publicSurfacePolishCoverage = 1`, zero public duplicate-action-first rows, `publicEvidenceFragmentClarityCoverage = 1`, `publicTableSpeechBrevityCoverage = 1`, `repetitionRate = 0.177`, and `stanceContinuityRate = 1`.

## 2026-06-06 Follow-up: Non-Public Seat Verb Spacing

This follow-up tightens non-public table-chat polish around runner-up comparison and deep-reasoning insertions.

- Private final response text now runs `polishChineseSeatSpacing(...)` after evidence-contract and deep-reasoning fragments are inserted, so late-added lines also lose awkward seat-label gaps.
- `polishChineseSeatSpacing(...)` now explicitly repairs `清掉 X号`, `处理 X号`, and `验 X号` forms, covering examples like `先处理 4号，不是清掉 2号`.
- The fixed evaluator extends `nonPublicSurfacePolishCoverage = 1` to catch those verb-to-seat gaps, and contract tests assert every non-public row avoids the same pattern.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `node scripts\ai_quality_eval.mjs`, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, targeted zero-row non-public verb-seat scan, and root/Unity no-index sync checks. Current fixed snapshot is 127 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.953`, `nonPublicSurfacePolishCoverage = 1`, zero non-public verb-seat spacing rows, `publicSurfacePolishCoverage = 1`, `privateDeepReasoningSpokenCoverage = 1`, `repetitionRate = 0.177`, and `stanceContinuityRate = 1`.

## 2026-06-06 Follow-up: Evil Public Maintenance Lead Dedup

This follow-up tightens public evil-cover maintenance speech where a cover-safe pressure line could be repeated once as a short sentence and again as the start of a verification sentence.

- Public final polish now removes the earlier duplicate pressure lead when the later sentence extends the same target-pressure body with `核法是...`, preserving the richer verification sentence.
- The fixed evaluator adds `evilPublicCoverMaintenanceDedupCoverage = 1` beside `evilPublicCoverMaintenanceCoverage`, and contract tests scan every `requiresEvilCoverMaintenance` row for repeated pressure-lead extensions.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `node scripts\ai_quality_eval.mjs`, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, targeted maintenance-row lead-count scan, and root/Unity no-index sync checks. Current fixed snapshot is 127 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.953`, `evilPublicCoverMaintenanceCoverage = 1`, `evilPublicCoverMaintenanceDedupCoverage = 1`, `publicSurfacePolishCoverage = 1`, `repetitionRate = 0.180`, and `stanceContinuityRate = 1`.

## 2026-06-06 Follow-up: Public Verification Wording Polish

This follow-up cleans public verification lines that were mechanically correct but still awkward to read at the table.

- Public final polish now repairs identity-check wording such as `核法先交给X号来身份先对上`, `核法先交给X号来把身份和票型对上`, and `把身份先落到桌面`, while preserving recognized verification lead variants.
- The same pass repairs `台面上。还是...` after maintenance dedup so cover-continuity speech remains one natural public line.
- `publicSurfacePolishCoverage = 1` now catches these wording artifacts, and contract tests scan every public row for them.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `node scripts\ai_quality_eval.mjs`, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, targeted zero-row verification wording scan, and root/Unity no-index sync checks. Current fixed snapshot is 127 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.953`, `publicSurfacePolishCoverage = 1`, zero `来身份` / `来把身份` / identity-action `先` / `台面上。还是` rows, `publicVerificationLeadVariantCoverage = 1`, `repetitionRate = 0.180`, and `stanceContinuityRate = 1`.

## 2026-06-06 Follow-up: Formal Vote Table Context Anchors

This follow-up closes the remaining fixed evidence-citation gap by making formal vote edge cases explain the table context behind the vote, not only the abstract pressure level.

- Formal vote edge templates now keep vote-context anchors across ghost-vote, cannot-vote, near-threshold, table-balance, and execution-window modes, using wording such as `投票`, `票型`, `公开回应`, `公开处决线`, and `投票流程`.
- The fixed evaluator adds `formalVoteTableContextCoverage = 1` beside existing formal vote rationale, diversity, reason-mode, near-threshold, evil-cover, evidence-boundary, multi-evidence, and script-coverage gates.
- Contract tests assert the summary metric, scan every formal-vote row for table-readable vote context, and include a degraded-summary failure check for the new gate.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `node scripts\ai_quality_eval.mjs`, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, targeted zero-row formal-vote context scan, and root/Unity no-index sync checks. Current fixed snapshot is 127 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 1`, `formalVoteRationaleCoverage = 1`, `formalVoteTableContextCoverage = 1`, `formalVoteLineDiversityCoverage = 1`, `formalVoteReasonModeCoverage = 1`, `repetitionRate = 0.180`, and `stanceContinuityRate = 1`.

## 2026-06-06 Follow-up: Public Claim Hold Lead Diversity

This follow-up reduces repeated public claim-continuity openings by making the held role appear earlier and by measuring final spoken public hold leads.

- `claimDisclosureHoldVariantIndex(...)` now uses a wider deterministic hash so public hard-hold rows do not cluster on the first template.
- Hard hold templates now front-load the role name (`圣徒这条身份先沿用...`, `猎手口径这轮不改...`, `送葬者这条身份线不改...`) so repeated stems encode the actual claim instead of repeating generic continuity language.
- The fixed evaluator adds `publicClaimHoldLeadVariantCoverage = 1`, and contract tests require at least six public hold lead variants while capping any one public spoken hold lead at four rows.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `node scripts\ai_quality_eval.mjs`, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, targeted public hold lead distribution scan, and root/Unity no-index sync checks. Current fixed snapshot is 127 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 1`, `claimDisclosureHoldLeadVariantCoverage = 1`, `publicClaimHoldLeadVariantCoverage = 1`, public hold leads 19 rows / 15 distinct / max 3, `repetitionRate = 0.175`, and `stanceContinuityRate = 1`.

## 2026-06-06 Follow-up: Nomination Defense Response Variants

This follow-up makes nominee defense lines answer the same structural contract with more table-like surface variety.

- `nominationDefenseLine(...)` now separates the response scaffold, identity/info claim, and high-pressure counter-check into deterministic variant pools instead of sampling one of a few full-sentence templates.
- Low-pressure defenses can now start from `这票可以验`, `先别只看票数`, or `这轮可以拿我验`; high-pressure defenses can start from `我先回应提名理由`, `先把提名理由拆开`, `别只催票`, or `我先防一下`.
- Defense claim variants keep the role / information / vote-threshold anchors but avoid the old repeated `我先不把身份一次说死` stem in the fixed set.
- The fixed evaluator adds `nominationDefenseResponseVariantCoverage = 1`, requiring several distinct defense openings, capping the dominant opening, and guarding against the old identity stem returning.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `node scripts\ai_quality_eval.mjs`, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, root/Unity no-index sync checks, `git diff --check`, and trailing-whitespace checks. Current fixed snapshot is 127 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 1`, `nominationDefenseResponseCoverage = 1`, `nominationDefenseResponseVariantCoverage = 1`, defense openings 6 rows / 5 distinct / max 2 / old stem 0, `repetitionRate = 0.161`, and `stanceContinuityRate = 1`.

Updated next baseline:

1. Upgrade the timeline rationale drilldown from compact trace cards into a fuller expandable card review, with per-evidence snippets, source jumps, mode-matched public/private spoken verification actions, and richer multi-line card details.
2. Continue upgrading the selected reasoning-track drilldown beyond inline expanded evidence rows, with multi-line evidence details, score movement history from `crossDayStance.currentScoreTrailAnchors`, nomination action context plus strategy-mode, nominee defense response variants, nominee defense info-plan dedup, nominee defense reason anchors, high-pressure counter-pressure, public target-switch claim-disclosure continuity, claim-disclosure surface dedup, claim-disclosure hold lead variants plus public spoken hold-lead gates, balanced claim-disclosure reason variants, shadow high-pressure target-specific openings, public pressure action-lead variants and dedup, evil public maintenance lead dedup, public pressure urgency-tail variants, public follow-up tail variants, public evidence anchor lead variants and anchor-body dedup gates, clipped public evidence-fragment gates, public action-first surface gates, public verification wording gates, non-public verb-seat spacing gates, public verification lead variants, public evidence synthesis explicit-mode gates, public table-speech brevity gates, formal vote table-context gates and full line diversity, private runner-up comparison line variants, private reason opening lead variants, private verification lead naturalization, private source-identity synthesis dedup, private vote-taxonomy synthesis dedup, private source-reliability / timeline-consistency and incentive-alignment / burden-of-proof spoken reasoning compression with heading and tail variants, evil private team/cover variant gates, cross-script nominee defense anchors, defense-aware vote coverage, reason-anchored defense-aware vote coverage, reason-anchor line diversity, cross-script defense-aware vote coverage, and fuller cross-day stance history details.
3. Expand the fixed evaluation set beyond the current portability floor: add richer BMR/SnV public speech variants, high-pressure emotional variants across more scripts and pressure levels, longer deception arcs across more scripts and more day changes, harder cross-day hold-vs-shift and target-switch variants with different evidence families, more public/private evidence-family synthesis combinations, and deeper role-constrained claim-disclosure edges beyond the current madness / outsider-risk / Mutant / Sweetheart / Barber / death-trigger / public-action floor.

## 下一步建议

1. 把 `reasoningContrastLine` 扩展成结构化 `decisionRationale`，包含 focus、runner-up、evidence count、score gap、risk flags 和 verification question。
2. 扩展 nomination action context 的固定样本，让压力测试、联盟检查、处决推进、避免空过和邪恶公开理由五类提名策略都各有真实 pipeline 样本。
3. Extend the public/private speech texture pass beyond this high-pressure, persona-specific pressure, script-specific pressure, timing-specific pressure, role-specific public-claim pressure, public action-role pressure, public/private evidence synthesis, evil-cover, claim-cover continuity, claim-cover pivot/protect-ally/cross-day/long-arc, same-focus maintenance, pivot-explanation, and ally-protection floor into more evidence-family combinations and more specialized role families.
4. 将 AI 复盘从 `trail` 摘要升级为“当时为什么选这个目标”的决策快照。
5. 扩展固定评测集，持续统计自然度、重复率、隐藏信息泄漏、证据引用率、top-vs-second 解释覆盖率、主动私聊 rationale 覆盖率、投票意图覆盖率、策略理由覆盖率、多日立场延续和多日立场转向解释。
