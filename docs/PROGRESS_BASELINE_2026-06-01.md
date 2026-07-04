# 项目三方向进展基线

更新日期：2026-06-05

本文作为后续继续深化项目的当前基线，按三个方向整理现状：

- AI agent 智能程度
- UI 美化程度
- 游戏规则完成程度

本基线继承 `docs/PROGRESS_BASELINE_2026-05-31.md`，并补入 2026-06-01 至 2026-06-05 新增的 AI 决策理由、提名策略复盘、跨天 stance 追踪、Unity reasoning recap、AI 语言质量门禁、Unity full-state smoke 基线和相关合同验证。评分是开发成熟度参考，不代表最终产品质量。

## 总体判断

项目已经进入“可玩原型向可信模拟器收敛”的阶段。JS Core 仍是规则、AI、权限和状态的唯一事实源；Unity 是主要可视化体验层；Electron 保留桌面原型和旧 UI 能力。当前最值得继续深化的主线是：让 AI 更像真实桌边玩家，让 Unity 更像正式游戏界面，让 BMR/SnV 从可玩近似走向合同背书的细则准确。

| 方向 | 当前成熟度 | 当前定位 | 下一阶段目标 |
| --- | --- | --- | --- |
| AI agent 智能程度 | 约 7.8/10 | 证据约束、可度量语言质量的桌边玩家原型 | 长期信念、更大固定评测集、跨剧本压力语言 |
| UI 美化程度 | 约 7.1/10 | 31-state Unity 视觉回归基线与高频界面舞台化 | 视觉差异对比、更多演出状态、AI 复盘卡片深化 |
| 游戏规则完成程度 | 约 7.1/10 | TB 较完整，BMR/SnV 核心可玩 | 角色审计矩阵、事件管线、逐角色 fixture |

建议深化顺序：

1. 继续推进 AI agent 的解释一致性和可衡量评测，因为这是项目差异化最明显的部分。
2. 建立规则审计矩阵，优先校准 BMR/SnV 的高风险边界，避免 UI 和 AI 建在不稳定规则上。
3. 做 Unity UI 的视觉回归和核心场景美术化，把已有功能变成稳定、统一、有演出感的体验。

## 1. AI Agent 智能程度

当前成熟度：约 7.5/10，中高阶原型，已经不是模板 NPC，但仍不是完整长程博弈智能体。

### 已完成能力

- 每个 AI 有独立 `observations`、`evidenceBook`、`beliefTrailByPlayerId` 和 `knowledgeGraph`，公开信息、私聊、夜间信息、投票和提名会按可见性写入对应 agent。
- 隐藏信息边界已经是核心合同：邪恶互认、恶魔 bluff、私有夜间信息、好人视角和公开发言都通过测试约束防泄漏。
- AI 能参与私聊、公聊、主动私聊、AI-to-AI 私聊、死亡发言、提名、投票和阵营策略判断。
- 语言层有 persona、发言预算、重复冷却、禁用系统词、seat label、公开/私有语气差异和可选本地 LLM polish。
- 策略层有 `buildAIThoughtFrame(...)`、`buildAIStrategyContext(...)`、good-day strategy、evil framing plan、coalition vote simulation、nomination pressure 和 vote threshold。
- 2026-06-01 新增结构化 `decisionRationale`：记录 focus、runner-up、分数差、证据数量、reason key、confidence band、risk flags、evidence mode / evidence mode line、verification question / verification line、response plan line、response criteria line、evidence interaction line、pressure stage line、counter-evidence line 和最终 spoken line。
- `decisionRationale` 现在追加 public-safe `comparisonTrace`，把 focus 和 runner-up 各自的可读理由、证据摘要、证据数量与分差放在同一个结构中，避免“只给排名，不讲为什么不是第二候选”。
- `decisionRationale` 现在还带 `reconsiderationKey` / `reconsiderationLine`，公聊、私聊、主动私聊和普通 AI-AI 私聊可以说明“什么回应会让我降级/重排/降压”，让 AI 不只给结论，也给出可改判条件。
- `decisionRationale` 现在还带 `evidenceMode` / `evidenceModeLine`，会把当前判断标注为身份口径、票型/提名、夜里信息、私聊线索、公开发言节奏、低证据入口或混合线索，并用一句话说明“主依据是什么类型”，避免只报证据数量。
- `decisionRationale` 现在还带 `verificationLine`，把 reason key 和 evidence mode 转成“先问谁、核哪类线、是否要补身份/昨晚信息/票型/公开发言节奏”的可执行验证计划；私聊优先把它作为下一步追问，Unity 提名验证卡也直接展示这条计划。
- `decisionRationale` 现在还带 `responsePlanLine`，把目标回应分成“对得上就降压/回看 runner-up，不连贯就继续加压或进入提名压力”的条件化行动计划；私聊、主动私聊、AI-AI 私聊和 Unity 提名验证卡都能保留这条分流逻辑。
- `decisionRationale` 现在还带 `responseCriteriaLine`，把 `evidenceMode` 转成具体回应判定门槛：票型线要讲清上票/跟票/提名动机，身份线要前后口径连上，夜里信息要对上死亡/保护/身份时间线，低证据入口要先补可复核身份或票型；私聊会直接讲出这条标准，公开发言在句长允许时保留，Unity 提名 rationale 卡也会展示它。
- `decisionRationale` 现在还带 `evidenceInteractionLine`，说明证据之间如何互相托住或互相削弱：例如身份口径连上后票型只算弱压，身份断开时票型和发言会并入压力，私聊线索必须接上公开身份/票型才升级，重复来源会先降权；私聊会直接讲出这条证据联动，公开发言在句长允许时保留，Unity 提名 rationale 卡也会展示它。
- `decisionRationale` 现在还带 `pressureStageLine`，把当前目标放进“观察位、验证入口、对比档、主压力位、提名前复核档、提名压力”等节奏档位，并说明下一步是追问、复核还是进入提名池；私聊会直接讲出这条压力档位，公开发言在句长允许时保留，Unity 提名 rationale 卡也会展示它。
- `decisionRationale` 现在还带 `counterEvidenceLine`，把“如果不是狼/不是硬结论，可能是什么替代解释”结构化出来：例如私聊传话失真、夜里信息被死亡/保护/身份口径污染、票型只是自保或跟票、身份改口只是临场自保等；私聊会直接讲出这条反证口径，公开发言在句长允许时保留，Unity 提名 rationale 卡也展示它，避免 AI 只会单向加压。
- `decisionRationale` 现在还带 `tableRiskLine`，把“继续压这个目标会给桌面带来什么成本”结构化出来：例如过早提名会浪费处决压力、私聊线索必须转成公开问题、第二压力位不能被隧道化遮蔽、票型压力不能变成闭眼带票；Unity 提名 rationale 卡会展示它，质量评估用 `decisionTableRiskCoverage` 固定覆盖。
- `decisionRationale` 现在还带 `informationGainLine`，把“问这个目标能分清什么”结构化出来：例如区分传话误差还是回避、夜里信息污染还是身份断裂、自保票/跟票/主动推人、继续观察还是升级压力；Unity 提名 rationale 卡会展示它，质量评估用 `decisionInformationGainCoverage` 固定覆盖。
- `decisionRationale` 现在还带 `tableReactionLine`，把“压完目标后看哪些桌面反应”结构化出来：例如谁无理由跟压、谁急着护人、谁转移发言、谁选择性站边、谁绕开第二压力位；Unity 提名 rationale 卡会展示它，质量评估用 `decisionTableReactionCoverage` 固定覆盖。
- `decisionRationale` 现在还带 `timingWindowLine`，把“现在处于什么行动窗口”结构化出来：例如私聊先收可复核线、公聊早段轻压、公聊后段提名前复核、票前转成票意或提名阶段落身份/票型回应；Unity 提名 rationale 卡会展示它，质量评估用 `decisionTimingWindowCoverage` 固定覆盖。
- `decisionRationale` 现在还带 `worldBranchLine`，把“如果目标解释成立/断开，哪条世界线会被保留或重排”结构化出来：例如好身份分支回升、坏身份线继续领先、主线回到 runner-up、或两条贴线世界继续对比；Unity 提名 rationale 卡会展示它，质量评估用 `decisionWorldBranchCoverage` 固定覆盖。
- `decisionRationale` 现在还带 `voteCoalitionLine`，把“当前压力是否能转成有理由的票面联盟”结构化出来：例如低证据时不急凑处决票、贴线候选要防分票、提名前先看跟票者能否给理由、票前只在回应断开时转成处决票；Unity 提名 rationale 卡会展示它，质量评估用 `decisionVoteCoalitionCoverage` 固定覆盖。
- `decisionRationale` 现在还带 `sourceReliabilityLine`，把“这条读法的证据来源是否独立、是否可公开复核、是否需要降权”结构化出来：例如私下入口要转成公开问题、单点证据要等第二独立来源、贴线候选要防同源回声、夜里信息要接上时间线；Unity 提名 rationale 卡会展示它，质量评估用 `decisionSourceReliabilityCoverage` 固定覆盖。
- `decisionRationale` 现在还带 `timelineConsistencyLine`，把“证据出现的先后顺序是否自洽”结构化出来：例如身份口径是先报还是被压后改口、票型是在解释前还是解释后、夜里信息能否接上死亡/保护/身份公开时间线、事后跟风节点是否要降权；Unity 提名 rationale 卡会展示它，质量评估用 `decisionTimelineConsistencyCoverage` 固定覆盖。
- `decisionRationale` 现在还带 `incentiveAlignmentLine`，把“这条行为对谁有收益、动机更像解桌/自保/护人/转移压力”结构化出来：例如票型要拆成自保、跟风和主动推人，身份口径要区分主动解桌还是被压后补防线，公开发言要看是在贡献可检验信息还是把话题从自己或盟友身上移走；Unity 提名 rationale 卡会展示它，质量评估用 `decisionIncentiveAlignmentCoverage` 固定覆盖。
- `decisionRationale` 现在还带 `burdenOfProofLine`，把“谁该给公开理由、谁该回答、谁不能只替别人护航”结构化出来：例如目标本人要解释身份/票型/发言，跟票者也要给理由，护人者要补公开链，第二压力位不能只靠排序被放掉；Unity 提名 rationale 卡会展示它，质量评估用 `decisionBurdenOfProofCoverage` 固定覆盖。
- `decisionRationale` 现在还带 `questionPriorityLine`，把“下一句先追谁、再核哪条、何时回看第二压力位”结构化出来：例如先问目标身份/票型/发言，再问跟票者或支持者理由，贴线时把 runner-up 保留在第二追问序列；Unity 提名 rationale 卡会展示它，质量评估用 `decisionQuestionPriorityCoverage` 固定覆盖。
- `decisionRationale` 现在还带 `actionThresholdLine`，把“当前读法只够观察、可以继续加压、能进提名，还是能转成处决票”的行动门槛结构化出来：例如低证据停在追问，公开回应断开才升级，提名审查中回应接不上才要票；Unity 提名 rationale 卡会展示它，质量评估用 `decisionActionThresholdCoverage` 固定覆盖。
- `decisionRationale` 现在还带 `memoryContinuityLine`，把“这条读法是本轮建档、本日延续、跨日保持、因为证据变化而转向，还是从昨天主线换到今天主线”结构化出来：例如低证据先入观察档，本日多次看同一目标时不重置读法，跨日 hold/shift 会说明证据量变化，跨日 target-switch 会说明旧主线、新目标和“不是直接放掉旧线”；Unity 提名 rationale 卡会展示它，质量评估用 `decisionMemoryContinuityCoverage` 固定覆盖。
- `decisionRationale` 现在还带 `expressionDisciplineLine`，把“这条读法该怎么说”结构化出来：例如低证据用追问口吻、贴线先说对比、夜里信息只说可公开接上的时间线、主压力也要保留回应断开才升级；Unity 提名 rationale 卡会展示它，质量评估用 `decisionExpressionDisciplineCoverage` 固定覆盖。
- `decisionRationale` 现在还带 `uncertaintyResolutionLine`，把“当前还缺什么、靠什么消解”结构化出来：例如低证据缺第一条公开可复核证据，贴线候选要靠回应质量拉开，夜里信息要接上死亡/保护/身份时间线；Unity 提名 rationale 卡会展示它，质量评估用 `decisionUncertaintyResolutionCoverage` 固定覆盖。
- `decisionRationale` 现在还带 `evidenceFreshnessLine`，把“这条证据是新动作、旧线索延续，还是旧理由需要当前回应刷新”结构化出来：例如跨日线索不能直接当新结论，旧票型只做背景，强压也要看今天公开解释；Unity 提名 rationale 卡会展示它，质量评估用 `decisionEvidenceFreshnessCoverage` 固定覆盖。
- `decisionRationale` 现在还带 `falsificationCheckLine`，把“什么情况会推翻当前读法或迫使降级”结构化出来：例如公开身份、票型和发言能自洽时降压，贴线候选回应接上时回切，旧强压不能无视当前公开解释；Unity 提名 rationale 卡会展示它，质量评估用 `decisionFalsificationCheckCoverage` 固定覆盖。
- `decisionRationale` 现在还带 `causalChainLine`，把“行为如何导致桌面后果，再如何支撑当前压力”结构化出来：例如身份口径断开会让票型和发言变重，票型说不清会改变处决窗口，公开回应补齐则强压回落；Unity 提名 rationale 卡会展示它，质量评估用 `decisionCausalChainCoverage` 固定覆盖。
- `decisionRationale` 现在还带 `assumptionAuditLine`，把“当前读法依赖了什么前提”结构化出来：例如票型不是单纯自保、私下入口必须转成公开矛盾、多条证据必须彼此独立、夜里信息要排除醉毒或污染；Unity 提名 rationale 卡会展示它，质量评估用 `decisionAssumptionAuditCoverage` 固定覆盖。
- `decisionRationale` 现在还带 `mechanicSensitivityLine`，把 BOTC 特有机制约束结构化出来：例如醉毒/中毒、死亡与保护链、身份登记、提名/处决门槛、私下视角和公开规则结论的边界；Unity 提名 rationale 卡会展示它，质量评估用 `decisionMechanicSensitivityCoverage` 固定覆盖。
- `decisionRationale` 现在还带 `roleHypothesisLine`，把当前压力拆成公开安全的好身份自洽线和坏身份伪装线：先看身份、能力、票型、发言和时间线能否解释断点，再决定是否把读法转成坏身份主线；Unity 提名 rationale 卡会展示它，质量评估用 `decisionRoleHypothesisCoverage` 固定覆盖。
- 私聊 surface 现在会按 intent 选择少量 rationale 片段，而不是把所有解释字段交给预算器裁剪；玩家可见文本会去掉 `追问顺序：`、`角色假说：`、`机制敏感性：` 等内部标题，保留口语化的验证方向、角色假说或行动门槛。该纪律已扩展到 human-initiated 私聊、主动私聊和普通 AI-AI 私聊，质量评估用 `privateSurfaceReportDisciplineCoverage` 固定这一点。
- `decisionRationale` 现在还带 `evidenceBoundaryLine`，把 `riskFlags` 转成“证据薄、分差贴线、只能用公开信息、第二候选线索不弱”等判断边界；私聊/主动私聊/AI-AI 私聊和 Unity 提名卡片都能显示这条限制，避免 AI 把启发式读法说成铁证。
- `decisionRationale` 现在还带 `runnerUpWatchLine`，把 runner-up 从“只存在对比表里”升级为可执行的第二压力位：AI 会说明谁先排第二、什么时候回看或重排，减少单目标隧道视角。
- 提名现在同时带 `decisionRationale` 和 public-safe `strategyRationale`，AI 能解释“为什么提这个人、为什么不是另一个候选、这票是压力测试还是联盟确认”。
- 公聊、私聊、主动私聊和提名都把最终玩家实际读到的句子同步回 `decisionRationale.spokenLine`，避免 UI 复盘和实际发言脱节。
- public speech 预算器已新增 `priorityFragments` 保底：公开发言在裁剪时会优先保留 persona marker、目标点名、证据锚点和下一步追问，减少“像短报告但丢风格和行动意图”的情况。
- Unity viewmodel 已导出 `rationaleCards`、timeline `rationaleSummary` 和按 speaker/focus target 聚合的 `aiReasoningRecap`，能检查 AI 是否持续围绕同一目标给出连贯理由。
- `aiReasoningRecap` 已继续扩展证据片段与分数轨迹：`evidenceSnippets`、`scoreTrail`、`scoreDelta` 和 `scoreTrend` 能显示目标压力是上升、下降还是持平。
- `scoreTrail` 已追加 `evidenceRows` 和 `comparisonTrace`，从该 AI 的 `beliefTrailByPlayerId` 回连 `evidenceBook`，并把每次分数变化背后的证据行、可靠度、污染风险和 target-vs-runner-up 对比串起来。
- Unity AI 复盘页已新增 selected reasoning evidence drilldown card，能把分数、gap、证据计数、可信度、污染风险和 applied delta 放到同一张卡上。
- Unity AI 复盘页已增加 reasoning-track selector，可在多个 AI/目标推理轨道之间循环切换，推理卡和证据明细卡同步更新。
- 选中的 reasoning track 现在会展示紧凑多点 `scoreTrail` 轨迹，最多列出 3 个可见分数点及其首要证据行，不再只露出最新 evidence row。
- 已新增跨日 `stanceHistoryBySpeakerId`：AI 会记录每个 speaker 对每个 target 的每日 stance，并在第二天公聊、私聊、主动私聊和 AI-AI 私聊中说出“昨天也盯这条/今天为什么转向”的短句。
- `stanceHistoryBySpeakerId` 已进一步记录每日 stance 的证据摘要和证据数量，跨日转向句可以说明“今天为什么从观察改成强压/从偏信改成观察”，而不只报告 stance 变化。
- 跨日 `crossDayStance` 现在进一步导出 `evidenceDelta` 和 `changeSummary`：hold 会说明“证据量没少”，shift 会说明“比昨天多 N 条可见线索”，让 AI 的改看法更像可追溯玩家记忆，而不是每日重新算分。
- `crossDayStance` 现在还会保留 `previousEvidenceSnippets` / `currentEvidenceSnippets`、`previousEvidenceAnchors` / `currentEvidenceAnchors`、`previousEventAnchors` / `currentEventAnchors` 以及 `previousScoreTrailAnchors` / `currentScoreTrailAnchors`，公聊、私聊、主动私聊和 AI-AI 私聊都会把当轮 evidence summaries、evidenceBook 锚点、source event 锚点与 score movement 锚点传入 stance 账本；复盘层可从跨日 stance 回连到具体“公开站队、票型解释、公聊提到”等证据片段及其 `evidenceId` / `observationId`，也可回连到 `timelineEntryId`、`source`、`timestamp` 和 before/after/appliedDelta 分数变化。
- `decisionRationale.targetSwitchContinuity` 现在会从 `stanceHistoryBySpeakerId` 推导“昨天主线在 A，今天为什么先转 B”：公开场景只接受 public / quality-fixture / public-anchor 证据，玩家可见公聊会把关键结论前置成“今天先转 B，不等于放掉 A”，避免 AI 看起来像每日重新算分。
- `claimDisclosureRationale` 已新增身份口径连续性字段：`continuity` 会区分 `new`、`hold`、`escalate`、`revise`，`continuityLine` 会给出可读解释，重复追问身份时不会只靠文本碰运气。
- 身份口径 `revise` 现在会保留 public-safe 的 previous/current claim metadata：当上一条和当前条都允许明示身份时，rationale 会带 `previousRoleId`、`previousRoleName`、`previousRangeLabel` 和 `continuitySummary`，复盘能看到类似“改口：圣徒 -> 守鸦人”的移动。
- 固定 AI 评测集当前为 100 rows，已覆盖 TB/BMR/SnV 的 formal vote、private claim、claim hold/escalate/revise、role-constrained claim disclosure、public reasoning、public multi-evidence、public persona pressure variants、public script pressure variants、public timing pressure variants、public role pressure variants、public action-role claim pressure、public evidence synthesis/dedup、private multi-evidence、private evidence synthesis variants、evil private coordination、AI-AI evil coordination、evil public claim-cover continuity、evil public claim-cover pivot/protect-ally/cross-day arcs、TB/BMR/SnV evil public long deception arc、cross-day stance hold/shift、TB/BMR/SnV cross-day target-switch，以及 human private / proactive private / AI-AI private 三渠道 non-public target-switch 样本；`decisionRationaleCoverage`、`decisionReconsiderationCoverage`、`decisionConfidenceCalibrationCoverage`、`decisionVerificationPlanCoverage`、`decisionEvidenceModeCoverage`、`decisionEvidenceModeVerificationAlignmentCoverage`、`decisionResponsePlanCoverage`、`decisionResponseCriteriaCoverage`、`decisionEvidenceInteractionCoverage`、`decisionPressureStageCoverage`、`decisionCounterEvidenceCoverage`、`decisionTableRiskCoverage`、`decisionInformationGainCoverage`、`decisionTableReactionCoverage`、`decisionTimingWindowCoverage`、`decisionWorldBranchCoverage`、`decisionVoteCoalitionCoverage`、`decisionEvidenceBoundaryCoverage`、`decisionRunnerUpWatchCoverage`、`crossScriptClaimDisclosureCoverage`、`crossScriptClaimContinuityCoverage`、`roleConstrainedClaimDisclosureCoverage`、`crossScriptPublicReasoningCoverage`、`crossScriptPublicMultiEvidenceCoverage`、`publicPersonaPressureVariantCoverage`、`publicScriptPressureVariantCoverage`、`publicTimingPressureVariantCoverage`、`publicRolePressureVariantCoverage`、`publicEvidenceSynthesisCoverage`、`publicEvidenceSynthesisDedupCoverage`、`crossScriptPrivateMultiEvidenceCoverage`、`privateEvidenceSynthesisCoverage`、`privateEvidenceSynthesisVariantCoverage`、`evilPrivateCoordinationCoverage`、`aiToAiEvilCoordinationCoverage`、`evilPublicClaimCoverContinuityCoverage`、`evilPublicClaimCoverPivotCoverage`、`evilPublicClaimCoverProtectAllyCoverage`、`evilPublicClaimCoverCrossDayCoverage`、`evilPublicClaimCoverDeceptionArcCoverage`、`evilPublicClaimCoverPressureContinuityCoverage`、`crossScriptCrossDayStanceCoverage`、`crossDayTargetSwitchCoverage`、`crossScriptCrossDayTargetSwitchCoverage`、`nonPublicTargetSwitchContinuityCoverage`、`crossDayStanceContinuityCoverage`、`crossDayStanceEvidenceDeltaCoverage`、`crossDayStanceEvidenceTraceCoverage`、`crossDayStanceEvidenceAnchorCoverage`、`crossDayStanceEventAnchorCoverage`、`crossDayStanceScoreTrailAnchorCoverage`、public priority signal、public polish、evil cover/protect-ally、formal vote edge 与 multi-evidence vote 压缩等核心门禁均为 1，`hiddenLeakCount = 0`，当前 `evidenceCitationRate = 0.920`，`formalVoteLineDiversityCoverage = 0.957`，`publicShadowPressureLineDiversityCoverage = 0.923`，`repetitionRate = 0.287`，`stanceContinuityRate = 1`。
- 本轮新增 `burdenOfProofLine` 后，最新 fixed snapshot 仍为 92 rows，`decisionBurdenOfProofCoverage = 1`，`hiddenLeakCount = 0`，`repetitionRate = 0.286`，低于 0.35 门禁。
- 本轮新增 `questionPriorityLine` 后，最新 fixed snapshot 仍为 92 rows，`decisionQuestionPriorityCoverage = 1`，`hiddenLeakCount = 0`，`repetitionRate = 0.295`，低于 0.35 门禁。
- 本轮新增 `actionThresholdLine` 后，最新 fixed snapshot 仍为 92 rows，`decisionActionThresholdCoverage = 1`，`hiddenLeakCount = 0`，`repetitionRate = 0.308`，低于 0.35 门禁。
- 本轮新增 `memoryContinuityLine` 后，最新 fixed snapshot 仍为 92 rows，`decisionMemoryContinuityCoverage = 1`，`hiddenLeakCount = 0`，`repetitionRate = 0.308`，低于 0.35 门禁。
- 本轮新增 `expressionDisciplineLine` 后，最新 fixed snapshot 仍为 92 rows，`decisionExpressionDisciplineCoverage = 1`，`hiddenLeakCount = 0`，`repetitionRate = 0.312`，低于 0.35 门禁。
- 本轮新增 `uncertaintyResolutionLine` 后，最新 fixed snapshot 仍为 92 rows，`decisionUncertaintyResolutionCoverage = 1`，`hiddenLeakCount = 0`，`repetitionRate = 0.312`，低于 0.35 门禁。
- 本轮新增 `evidenceFreshnessLine` 后，最新 fixed snapshot 仍为 92 rows，`decisionEvidenceFreshnessCoverage = 1`，`hiddenLeakCount = 0`，`repetitionRate = 0.312`，低于 0.35 门禁。
- 本轮新增 `falsificationCheckLine` 后，最新 fixed snapshot 仍为 92 rows，`decisionFalsificationCheckCoverage = 1`，`hiddenLeakCount = 0`，`repetitionRate = 0.312`，低于 0.35 门禁。
- 本轮新增 `causalChainLine` 后，最新 fixed snapshot 仍为 92 rows，`decisionCausalChainCoverage = 1`，`hiddenLeakCount = 0`，`repetitionRate = 0.316`，低于 0.35 门禁。
- 本轮新增 `assumptionAuditLine` 后，最新 fixed snapshot 仍为 92 rows，`decisionAssumptionAuditCoverage = 1`，`hiddenLeakCount = 0`，`repetitionRate = 0.312`，低于 0.35 门禁。
- 本轮新增 `mechanicSensitivityLine` 后，最新 fixed snapshot 仍为 92 rows，`decisionMechanicSensitivityCoverage = 1`，`hiddenLeakCount = 0`，`repetitionRate = 0.312`，低于 0.35 门禁。
- 本轮新增 `roleHypothesisLine` 后，最新 fixed snapshot 仍为 92 rows，`decisionRoleHypothesisCoverage = 1`，`hiddenLeakCount = 0`，`repetitionRate = 0.312`，低于 0.35 门禁。
- 本轮收束私聊 surface rationale 选择并扩展到主动私聊/AI-AI 私聊后，最新 fixed snapshot 仍为 92 rows，`privateSurfaceReportDisciplineCoverage = 1`，`hiddenLeakCount = 0`，`repetitionRate = 0.286`，低于 0.35 门禁。
- 本轮继续打磨角色约束身份披露的公开表层句式，新增 `roleConstrainedClaimLineDiversityCoverage = 1` 门禁；最新 fixed snapshot 仍为 92 rows，`roleConstrainedClaimDisclosureCoverage = 1`，`hiddenLeakCount = 0`，`repetitionRate = 0.278`，低于 0.35 门禁。
- 本轮继续打磨 shadow/persona 高压多证据公聊开头，`publicPressureVariantWithSalt(...)` 现在用 target + persona/evidence 语境选择起手句，避免 3/6/9 号一起落到同一句“这不是单点感觉”；新增 `publicPersonaPressureLineDiversityCoverage = 1` 和 `publicShadowPressureLineDiversityCoverage = 0.818` 门禁，最新 fixed snapshot 仍为 92 rows，`hiddenLeakCount = 0`，`repetitionRate = 0.269`，低于 0.35 门禁。
- 本轮继续打磨邪恶方长局公开伪装，跨日 claim-cover 线现在会把“昨天已经盯过/转到当前目标”接到今天的公开身份线和压力分散上，并扩展到 BMR/SnV；新增 `evilPublicClaimCoverPressureContinuityCoverage = 1` 三剧本门禁，该轮 fixed snapshot 为 94 rows，`evilPublicClaimCoverDeceptionArcCoverage = 1`，`publicShadowPressureLineDiversityCoverage = 0.923`，`hiddenLeakCount = 0`，`repetitionRate = 0.271`，低于 0.35 门禁。
- 本轮新增跨日主压力换线解释：`targetSwitchContinuity` 会记录 previous/current target、day gap、stance、score、evidence count 和 public anchors，公开话术要求说出“昨天主线在 A，今天先转 B，不等于放掉 A”；新增 `crossDayTargetSwitchCoverage = 1` 门禁，该轮 fixed snapshot 为 95 rows，`hiddenLeakCount = 0`，`evidenceCitationRate = 0.916`，`repetitionRate = 0.276`，低于 0.35 门禁。
- 本轮继续把跨日主压力换线扩展到 BMR/SnV：固定样本现在要求 TB/BMR/SnV 都能说清旧主线、新主线和旧线保留，新增 `crossScriptCrossDayTargetSwitchCoverage = 1` 门禁；最新 fixed snapshot 为 97 rows，`hiddenLeakCount = 0`，`evidenceCitationRate = 0.918`，`repetitionRate = 0.293`，低于 0.35 门禁。
- 本轮继续把跨日主压力换线落实到非公开表层并扩展成三渠道门禁：human-initiated 私聊会优先保留 `targetSwitchLine` / target-switch `memoryContinuityLine`，主动私聊和普通 AI-AI 私聊会在写入当日 stance 后再构建 `decisionRationale`，且 target-switch 片段会在 focus push 前进入预算，避免被夜间同步或死亡身份句裁掉；`nonPublicTargetSwitchContinuityCoverage = 1` 现在要求 `private-whisper`、`proactive-private`、`ai-ai-private` 三个来源都说清旧主线、新主线和旧线保留，最新 fixed snapshot 为 100 rows，`hiddenLeakCount = 0`，`evidenceCitationRate = 0.920`，`repetitionRate = 0.287`，低于 0.35 门禁。
- 本轮继续把解释门禁扩展到 `decisionSourceReliabilityCoverage` 和 `decisionTimelineConsistencyCoverage`，固定样本要求 AI 同时说明证据来源可靠度与事件先后顺序。
- 本轮继续把解释门禁扩展到 `decisionIncentiveAlignmentCoverage`，固定样本要求 AI 说明行为动机和收益归属，而不是只描述证据强弱。
- 本轮继续把解释门禁扩展到 `decisionBurdenOfProofCoverage`，固定样本要求 AI 分配举证责任，而不是替目标或跟票者脑补理由。
- 本轮继续把解释门禁扩展到 `decisionQuestionPriorityCoverage`，固定样本要求 AI 明确下一句追问顺序，而不是只列验证项。
- 本轮继续把解释门禁扩展到 `decisionActionThresholdCoverage`，固定样本要求 AI 明确行动升级/降压门槛，而不是只表达当前压力强弱。
- 本轮继续把解释门禁扩展到 `decisionMemoryContinuityCoverage`，固定样本要求 AI 把当前读法接到记忆账本或未来对照记录，而不是每轮像新算一次。
- 本轮继续把解释门禁扩展到 `decisionExpressionDisciplineCoverage`，固定样本要求 AI 说明这条判断应该用追问、条件句或公开安全说法表达，而不是把压力读法说成定论。
- 本轮继续把解释门禁扩展到 `decisionUncertaintyResolutionCoverage`，固定样本要求 AI 说清当前读法还缺哪条公开回应、证据或时间线来消解疑点。
- 本轮继续把解释门禁扩展到 `decisionEvidenceFreshnessCoverage`，固定样本要求 AI 区分新证据、旧线索、同源重复和当前回应刷新，而不是反复消费旧理由。
- 本轮继续把解释门禁扩展到 `decisionFalsificationCheckCoverage`，固定样本要求 AI 说清“如果出现什么公开回应/证据，当前判断就要降级或回切”，避免只会防守自己的读法。
- 本轮继续把解释门禁扩展到 `decisionCausalChainCoverage`，固定样本要求 AI 说清“行为 -> 公开解释空间/桌面压力 -> 当前判断”的因果链，而不是只并列罗列证据。
- 本轮继续把解释门禁扩展到 `decisionAssumptionAuditCoverage`，固定样本要求 AI 说清“这条判断依赖哪个前提成立”，避免把自保票、同源证据、醉毒污染或私下入口默认当硬结论。
- 本轮继续把解释门禁扩展到 `decisionMechanicSensitivityCoverage`，固定样本要求 AI 把判断落回 BOTC 机制：醉毒/中毒、身份登记、死亡保护链、提名处决窗口和公开/私下信息边界。
- `stanceContinuityRate` 已改为按 `qualityRunId + speakerId` 追踪同一质量样本链，并排除 proactive private disclosure 样本；这些主动私聊仍由 `proactiveRationaleCoverage` 单独门禁，避免把独立 fixture 或信息披露目标误判为公开立场漂移。
- Unity timeline viewmodel 已导出 `crossDayStance`，并把跨日摘要合并进 `rationaleSummary`、reasoning recap evidence snippets 和每个 `scoreTrail` 分数点；玩家复盘时能看到 AI 是延续昨天线，还是因为当前证据发生转向。
- Unity timeline viewmodel 和 C# DTO 已保留 `claimDisclosureRationale.continuity`、`continuityLine`、`continuitySummary` 与 previous role/range 字段，后续身份口径卡片可以直接显示“延续、升级、改口”的原因和移动方向。
- Unity timeline `rationaleSummary` 现在会优先拼入 `claimDisclosureRationale.continuitySummary` / `continuityLine`，所以轻量时间线复盘也能直接看到“改口：守鸦人 -> 圣徒 公开身份：圣徒。”这类身份口径变化，而不用点开原始 metadata。
- Unity `aiReasoningRecap.evidenceSnippets` 现在也会收录 `claim-disclosure` 来源的身份口径连续性片段；当同一 AI/目标 reasoning track 涉及身份改口时，AI 复盘卡能把这条“改口/升级/延续”当作证据片段展示。
- Unity `scoreTrail` 的每个分数点现在也会保留 `claimDisclosureRationale`，身份口径连续性可以和当时的 score、`evidenceRows`、`comparisonTrace`、`crossDayStance` 一起做逐点 drilldown。
- Unity `scoreTrail` 分数点现在新增 `timelineEntryId`、`timelineIndex`、`timelineText` 和 `timestamp`，推理复盘可以从“分数为什么变化”回连到“当时是哪条发言/时间线行触发的”。

### 当前不足

- 推理仍主要是启发式证据权重和刷新式 belief trail，不是完整概率世界模型或多日规划器。
- 长期信念已经有跨日 stance 账本和证据摘要的第一版，但还不是完整世界模型，也还没有覆盖复杂 hold-vs-shift 对照、谎言维护和阵营长期计划。
- 自然语言比早期明显更好，public speech 预算已有核心信号保底；但在多证据、高压和长局谎言维护场景仍可能像“短报告”。
- LLM polish 只提升口吻，不参与规则判断和隐藏信息推理，所以 deterministic draft 的结构质量仍决定上限。
- AI 评测已有固定局面评分集 `scripts/ai_quality_eval.mjs`，能量化泄漏数、工程残留、证据引用率、`decisionRationale` 覆盖、可改判条件覆盖、信心校准覆盖、验证计划覆盖、证据类型说明覆盖、证据类型与验证问法对齐覆盖、回应分流计划覆盖、回应判定标准覆盖、证据联动解释覆盖、压力档位覆盖、反证/替代解释覆盖、证据边界覆盖、runner-up 对比与第二压力位观察覆盖、主动私聊 rationale 覆盖、私聊投票意图覆盖、策略理由覆盖、claim disclosure 连续性、角色约束 disclosure、public/private multi-evidence compression、human-AI/AI-AI evil coordination、public priority signal 覆盖、重复率、同日/跨日立场连续性、跨日原因覆盖和提名合理性；但长局谎言维护和多日计划仍主要靠局部合同，还不是完整世界模型。

### 下一阶段抓手

- 扩展固定 AI 评测集：继续加入刻意制造的多日 hold-vs-shift 对照、长局 deception arcs（身份口径维护、目标转线、保护队友的组合局面）、更多角色约束 claim disclosure（例如 Lunatic、Klutz、Moonchild、Sage death timing 等更细边界）和更复杂的私聊/公聊多证据压缩变体，并沉淀趋势报告。
- 继续把 `stanceHistoryBySpeakerId` 与 `beliefTrailByPlayerId` / `evidenceBook` 更深连接；当前已记录跨日 `evidenceDelta/changeSummary`、短 evidence snippets、evidence/observation anchors、source event/timeline anchors 和 score movement anchors，下一步应把更完整的 scoreTrail 片段、全部可见证据行和时间线 drilldown 串进“什么时候因为什么改变看法”。
- 将 `decisionRationale` 扩展到更多决策点：投票、是否公开交身份、是否主动私聊、邪恶方是否换推目标。
- 让 AI 复盘支持更深 drilldown：从每个 `scoreTrail` 点展开全部证据片段、目标比较、时间线定位和多日变化。
- 增强邪恶方策略连续性：保护队友、维持伪装、转移火力、解释刀口和模拟投票联盟。

### 后续衡量指标

- 隐藏信息泄漏：固定局面中公开/好人视角 `hiddenLeakCount` 为 0。
- 解释覆盖：固定局面中 focused rows 的 `decisionRationaleCoverage`、`decisionReconsiderationCoverage`、`decisionConfidenceCalibrationCoverage`、`decisionVerificationPlanCoverage`、`decisionEvidenceModeCoverage`、`decisionEvidenceModeVerificationAlignmentCoverage`、`decisionResponsePlanCoverage`、`decisionResponseCriteriaCoverage`、`decisionEvidenceInteractionCoverage`、`decisionPressureStageCoverage`、`decisionCounterEvidenceCoverage`、`decisionTableRiskCoverage`、`decisionInformationGainCoverage`、`decisionTableReactionCoverage`、`decisionTimingWindowCoverage`、`decisionWorldBranchCoverage`、`decisionVoteCoalitionCoverage`、`decisionEvidenceBoundaryCoverage`、`decisionRunnerUpWatchCoverage`、`runnerUpComparisonCoverage`、`proactiveRationaleCoverage`、`voteIntentCoverage` 和 `strategyRationaleCoverage` 维持在基线阈值以上；当前 fixed snapshot 的 `decisionRationaleCoverage = 1`、`decisionReconsiderationCoverage = 1`、`decisionConfidenceCalibrationCoverage = 1`、`decisionVerificationPlanCoverage = 1`、`decisionEvidenceModeCoverage = 1`、`decisionEvidenceModeVerificationAlignmentCoverage = 1`、`decisionResponsePlanCoverage = 1`、`decisionResponseCriteriaCoverage = 1`、`decisionEvidenceInteractionCoverage = 1`、`decisionPressureStageCoverage = 1`、`decisionCounterEvidenceCoverage = 1`、`decisionTableRiskCoverage = 1`、`decisionInformationGainCoverage = 1`、`decisionTableReactionCoverage = 1`、`decisionTimingWindowCoverage = 1`、`decisionWorldBranchCoverage = 1`、`decisionVoteCoalitionCoverage = 1`、`decisionEvidenceBoundaryCoverage = 1`、`decisionRunnerUpWatchCoverage = 1`，邪恶私聊协调和 AI-AI 邪恶协调也能导出目标选择 rationale。
- 解释覆盖新增来源可靠度与时间线一致性：当前 fixed snapshot 继续要求 `decisionSourceReliabilityCoverage = 1`、`decisionTimelineConsistencyCoverage = 1`。
- 解释覆盖新增动机收益归因：当前 fixed snapshot 继续要求 `decisionIncentiveAlignmentCoverage = 1`。
- 解释覆盖新增举证责任：当前 fixed snapshot 继续要求 `decisionBurdenOfProofCoverage = 1`。
- 解释覆盖新增追问优先级：当前 fixed snapshot 继续要求 `decisionQuestionPriorityCoverage = 1`。
- 解释覆盖新增行动门槛：当前 fixed snapshot 继续要求 `decisionActionThresholdCoverage = 1`。
- 解释覆盖新增记忆连续性：当前 fixed snapshot 继续要求 `decisionMemoryContinuityCoverage = 1`。
- 解释覆盖新增表达纪律：当前 fixed snapshot 继续要求 `decisionExpressionDisciplineCoverage = 1`。
- 解释覆盖新增不确定性消解：当前 fixed snapshot 继续要求 `decisionUncertaintyResolutionCoverage = 1`。
- 解释覆盖新增证据新鲜度：当前 fixed snapshot 继续要求 `decisionEvidenceFreshnessCoverage = 1`。
- 解释覆盖新增证伪检查：当前 fixed snapshot 继续要求 `decisionFalsificationCheckCoverage = 1`。
- 解释覆盖新增因果链：当前 fixed snapshot 继续要求 `decisionCausalChainCoverage = 1`。
- 解释覆盖新增前提审计：当前 fixed snapshot 继续要求 `decisionAssumptionAuditCoverage = 1`。
- 解释覆盖新增机制敏感性：当前 fixed snapshot 继续要求 `decisionMechanicSensitivityCoverage = 1`。
- 解释覆盖新增角色假说：当前 fixed snapshot 继续要求 `decisionRoleHypothesisCoverage = 1`。
- 私聊口语化纪律：当前 fixed snapshot 要求 `privateSurfaceReportDisciplineCoverage = 1`，human-initiated 私聊、主动私聊和普通 AI-AI 私聊都不应把内部 rationale 标签原样暴露为报告标题。
- 语言质量：固定局面 `repetitionRate` 低于阈值，2 句预算下通过 priority fragments 保留 persona、目标、证据、下一步意图。
- 策略一致性：同一 AI 对同一目标的 reasoning recap 和 cross-day stance 能形成可读轨迹，而不是每轮或每天重置。
- 邪恶协作：邪恶阵营在固定局面中能形成非泄漏、非自爆的保护或转推行为。

## 2. UI 美化程度

当前成熟度：约 6.7/10，可玩的 Unity 视觉垂直切片，功能覆盖强于视觉完成度。

### 已完成能力

- Unity prototype 已可运行，并通过 `unity_action.json` / `unity_viewmodel.json` 与 JS Core 闭环。
- Unity 构建版支持自启动 JS Core bridge，发行包也能选择性启用本地 LLM polish。
- 主界面已形成 fullscreen-first 魔典体验：中心座位环、角色 token、死亡帷幕、reminder、顶部 HUD、底部 dock、阶段目标和同步反馈。
- 已接入私聊面板、公聊阶段辅助、提名互辩、投票仪式、终局反馈、剧本手册、角色选择器、Storyteller 队列、动态行动表单和 More actions。
- 投票仪式已能展示 15 人举手导出，Storyteller 队列 smoke 覆盖 `sage-info`、`ravenkeeper-info`、`barber-swap`。
- AI 复盘从纯 `aiRecap` 推进到 nomination `rationaleCards`、timeline `rationaleSummary` 和 recap tab 的 reasoning trajectory cards。
- 视觉素材方向已经明确：官方风格 token、角色图标、背景、死亡帷幕、提醒物、字体、BGM 和阶段音景。

### 当前不足

- Unity UI 仍大量由 C# 固定坐标生成，1920x1080 基线较稳，但 1600x900、1366x768、高 DPI 和非 16:9 仍需要系统验证。
- 自动视觉验证仍偏 smoke，没有形成截图 diff、OCR、裁切和重叠检测。
- 私聊、公聊、投票和 AI recap 已可用，但仍有工具面板感，演出节奏、动效、音效和角色舞台还不够。
- Token inspector、More actions、AI recap 和复杂行动表单仍偏文本密集。
- Role picker、Storyteller queue 和多组 guesses 输入还需要分页、滚动或专用控件。
- 行动表单的即时校验和 disabled 状态不完整，部分错误仍靠提交后反馈。

### 下一阶段抓手

- 建立视觉回归：主魔典、私聊、公聊/阶段辅助、行动表单、Storyteller 队列、剧本手册、投票仪式、终局、AI recap 至少覆盖 1920x1080 和 1600x900。
- 把私聊/公聊统一成更像桌边对话或视觉小说的舞台：token/头像、气泡、焦点目标、快速追问和历史滚动。
- 把投票与处决做成仪式化流程：逐个举手、音效、结果停顿、死亡帷幕和处决过场。
- 把 AI recap 做成 suspect cards、证据 chips、信任/污染标记和可展开 reasoning trail。
- 将固定坐标逐步抽成少量布局组件，优先解决核心面板在三档分辨率下的可读性。

### 后续衡量指标

- 视觉回归：主要 UI 状态能稳定产出截图，并能检查裁切、重叠和缺失按钮。
- 响应式：1920x1080、1600x900、1366x768 三档核心流程无遮挡可用。
- 交互清晰度：无效行动在点击前有 disabled 或明确提示，而不是提交后才失败。
- 演出感：私聊、公聊、投票、处决四个高频场景有统一的视觉节奏和声音反馈。
- 信息密度：AI recap 和 token inspector 从调试文本转向卡片、图标和可展开明细。

## 3. 游戏规则完成程度

当前成熟度：约 7.1/10。TB 较完整，BMR/SnV 已全角色核心覆盖并可玩，但官方边界仍需要校准。

### 已完成能力

- 三个基础剧本已接入：TB 22 个角色，BMR 25 个角色，SnV 25 个角色。
- 规则层已有完整对局闭环：开局、发牌、夜晚、白天、私聊、公聊、提名、投票、处决、死亡、胜负和下一夜。
- `scripts/roles/` 已承载角色规则模块化，TB 最成熟，BMR/SnV 也已有角色定义、行动规则和简化 night runner。
- 已支持结构化行动输入：`player-target`、`player-role`、`role`、`question`、`guesses`、`charge-or-targets`、`info`。
- 核心机制已具备：官方人数配置、男爵改外来者、酒鬼伪装、醉毒、误注册、邪恶互认、恶魔 bluff、鬼票、提名投票、常见胜负和死亡触发。
- Storyteller 队列覆盖 Ravenkeeper、Moonchild、Klutz、Barber、Sage、Pit-Hag 等需要暂停流程或主持人确认的分支。
- 测试覆盖角色行动、被动信息队列、夜间行动完整性、Unity action bridge、Unity viewmodel 和 demo acceptance。

### 当前不足

- BMR/SnV 虽然所有角色有核心覆盖，但仍有不少官方细则、特殊时机和 Storyteller discretion 点属于可玩近似。
- 保护、复活、多杀、换角、阵营变化、攻击来源、异常胜负和醉毒错误信息还需要统一事件管线。
- 一些主持人判断仍是概率或启发式模拟，例如 Mayor 转移、醉毒假信息质量、部分信息选择风格。
- 复杂角色 UI 能回传结构化 payload，但还没有全部变成角色专属美术控件。
- 自定义剧本已有接口基础，但还不是完整产品能力。

### 下一阶段抓手

- 建立角色审计矩阵：每个角色标注 `Exact / Playable Approximation / Partial / Missing`，列出官方偏差、测试缺口和 UI 缺口。
- 优先统一事件管线：死亡、保护、复活、多杀、攻击来源、角色交换、阵营变化、注册异常和特殊胜负。
- 为 BMR/SnV 做逐角色 fixture，先覆盖 Zombuul、Pukka、Shabaloth、Po、Devil's Advocate、Pit-Hag、Barber、Vortox、Fang Gu、Cerenovus、Juggler、Savant 等高风险角色。
- 将 Storyteller discretion 从随机/固定模拟升级为可配置风格或可解释决策。
- 规则稳定后再推进自定义剧本、旅人、寓言角色和更多官方/社区扩展。

### 后续衡量指标

- 角色准确度：每个角色都有审计状态、官方偏差说明和至少一个核心 fixture。
- 事件一致性：死亡、保护、复活、换角等跨角色机制通过统一事件管线处理。
- 剧本可信度：TB 接近 `Exact`，BMR/SnV 从 playable approximation 推进到 contract-backed accuracy。
- UI 覆盖：所有结构化行动类型都有可读、可校验、可回放的 Unity 输入界面。
- 回归安全：每次规则改动都能通过角色合同、夜间完整性和 Unity bridge 合同验证。

## 当前验证基线

本次基线整理期间已通过以下验证：

```powershell
node --check scripts\unity_viewmodel.js
node --check unity-prototype\Assets\StreamingAssets\BotcJsCore\scripts\unity_viewmodel.js
node tests\unity_viewmodel_contracts.mjs
node tests\unity_asset_contracts.mjs
git diff --no-index -- scripts\unity_viewmodel.js unity-prototype\Assets\StreamingAssets\BotcJsCore\scripts\unity_viewmodel.js
npm run test:unity-viewmodel
npm run test:unity-assets
npm run test:unity-action-bridge
npm run test:ai-agents
npm test
git diff --check -- scripts\unity_viewmodel.js tests\unity_viewmodel_contracts.mjs tests\unity_asset_contracts.mjs unity-prototype\Assets\Scripts\BotcPrototypeBootstrap.cs unity-prototype\Assets\StreamingAssets\BotcJsCore\scripts\unity_viewmodel.js
```

完整 `npm test` 已通过，覆盖 role action、passive info / Storyteller queue、night action completeness、AI agent、LLM renderer、Electron build/path、Unity viewmodel/action bridge/assets/demo acceptance 和 mojibake regression。

## 2026-06-02 Follow-up: Formal Vote Rationale

This follow-up advances the AI-agent intelligence baseline without changing the underlying vote rules.

- Formal nomination voting can now carry a public-safe `voteRationale` object for each AI vote decision. Existing boolean `decideAIVote(...)` callers remain compatible, while Unity action bridge uses the detailed `decideAIVoteWithRationale(...)` path.
- `resolveNominationAndVote(...)` accepts either `true` / `false` or `{ vote, voteRationale }`, so old tests and old callers keep their behavior. Butler vote restrictions also update the rationale line when an intended yes vote is blocked.
- Unity viewmodel exports `voteCeremony.voters[].voteRationale`, and C# now deserializes `VoteRationaleViewModel`, giving the vote ceremony a stable explanation contract for future UI cards.
- The fixed AI quality evaluation now includes real formal vote decisions and tracks `formalVoteRationaleCoverage` separately from private vote-intent dialogue.

## 2026-06-04 Follow-up: AI Surface Phrase Stack Discipline

This follow-up tightens the AI speech polish layer so otherwise smart reasoning no longer reads like several template fragments pasted together.

- Shared Chinese surface normalization now removes residual phrase seams such as `刚才 2号`, `与 8号`, `是 酒鬼`, `卡在 在推低证据位`, `换线 台面理由`, and Chinese sentence punctuation followed by stray spaces.
- Public discussion now has a final `polishPublicLineSurface(...)` pass immediately before public speech is persisted to events, memory, logs, timeline, and utterance records.
- Nomination reasons now receive a final polish after budget trimming, so nomination and nomination-defense rows share the same surface discipline as private and public speech.
- The AI quality evaluator now applies the same one-line surface polish to generated rows and tightens `nonPublicSurfacePolishCoverage` / `publicSurfacePolishCoverage` so future regressions are caught.
- Root and Unity embedded `ai.js`, `ai_public_discussion.js`, `ai_speech_renderer.js`, and `ai_quality_eval.mjs` copies were kept in sync.
- Latest validation passed: `node --check` on touched root and Unity JS files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot is 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.936`, `crossScriptPublicReasoningCoverage = 1`, `crossScriptPublicMultiEvidenceCoverage = 1`, `crossScriptCrossDayStanceCoverage = 1`, `nonPublicSurfacePolishCoverage = 1`, `publicSurfacePolishCoverage = 1`, `repetitionRate = 0.278`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: Claim Range Label And Seat Polish

This follow-up fixes the next player-visible language seams found by the fixed AI quality report, without changing claim-disclosure rules or AI suspicion logic.

- Claim disclosure range labels now stay as short labels such as `有技能的好人身份` or `查验信息位`, while the fuller `claimRangeForRole(...)` sentence remains the explanatory range text. This prevents public lines like `我只给“我先给范围：...”范围`.
- Claim disclosure memory and rationale now store normalized range labels, so hold/escalate/revise recap does not inherit a whole sentence as a label.
- The shared surface polish now also removes residual spaces after verbs such as `点过`, `给`, and `放下`, and tightens `理由还是可见记录：` into `理由还是这条可见记录：`.
- The evaluator mirrors the same polish and tightens public/non-public artifact patterns so the old full-sentence range-label regression is caught in future runs.
- Root and Unity embedded `ai_claim_policy.js`, `ai.js`, `ai_public_discussion.js`, `ai_speech_renderer.js`, and `ai_quality_eval.mjs` copies were kept in sync.
- Latest validation passed: `node --check` on touched root and Unity JS files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot remains 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.936`, `claimDisclosureRationaleCoverage = 1`, `nonPublicSurfacePolishCoverage = 1`, `publicSurfacePolishCoverage = 1`, `repetitionRate = 0.277`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: Private Script-Sensitive Claim Deflection

This follow-up improves private claim-withholding speech so AI does not use the same generic identity-deflection line across scripts.

- Good private claim deflections now add script-aware reasoning before withholding exact identity: BMR mentions death/protection/revival disrupting identity value, while SnV mentions identity and madness pressure needing to be heard separately.
- The disclosure decision itself is unchanged; this only changes the player-facing explanation for why the AI is not immediately giving a full identity claim.
- The fixed AI quality evaluator now gates `privateScriptClaimDeflectCoverage = 1`, requiring BMR/SnV private claim rows to include script-sensitive withholding pressure instead of collapsing to the same generic sentence.
- The normalized duplicate scan now removes the previous BMR/SnV private claim duplicate; the follow-up below closes the remaining formal-vote normalized duplicates.
- Root and Unity embedded `ai.js` and `ai_quality_eval.mjs` copies were kept in sync.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot remains 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.936`, `privateScriptClaimDeflectCoverage = 1`, `crossScriptClaimDisclosureCoverage = 1`, `repetitionRate = 0.273`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: Formal Vote Normalized Line Diversity

This follow-up removes the last normalized formal-vote duplicates without changing vote thresholds or resolution rules.

- High-evidence no-vote rationale now uses a voter-seat-stable variant set, so multiple AI players can all say "many clues, not enough execution closure" without collapsing into the same sentence after seat labels are normalized.
- Nomination-defense-aware no-votes now receive script-sensitive BMR/SnV variants that still quote the nomination reason and still explain how the nominee defense lowers the vote, while adding death/protection or identity/madness pressure.
- The fixed evaluator keeps `formalVoteLineDiversityCoverage = 1` and `formalVoteNormalizedLineDiversityCoverage = 1`, requiring formal vote rows to remain distinct even after replacing concrete seat labels with `#号`.
- Root and Unity embedded `ai.js` copies were kept in sync; the existing `ai_quality_eval.mjs` normalized-diversity gate remains in sync as well.
- Latest validation passed: `node --check` on root and Unity `ai.js`, `npm run test:ai-quality-eval`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot remains 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.944`, `formalVoteLineDiversityCoverage = 1`, `formalVoteNormalizedLineDiversityCoverage = 1`, `privateScriptClaimDeflectCoverage = 1`, `repetitionRate = 0.265`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: Private Deep Reasoning Brevity

This follow-up keeps private multi-evidence reasoning deep, but stops the spoken line from reading like an audit report.

- Private reason replies still include the compressed source/timeline and incentive/burden reasoning beats, but those beats are now shorter table-chat sentences such as independent-source priority, same-source downgrading, motive split, and who must give reasons.
- The longest fixed private multi-evidence sample dropped from 225 characters to 188 characters while preserving evidence synthesis, target-vs-runner-up contrast, verification action, source/timeline reasoning, and motive/justification reasoning.
- The fixed evaluator now gates `privateDeepReasoningBrevityCoverage = 1`, requiring private compressed deep-reasoning segments to stay concise and semicolon-free instead of expanding back into long report clauses.
- Root and Unity embedded `ai.js` and `ai_quality_eval.mjs` copies were kept in sync.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot remains 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.944`, `privateDeepReasoningBrevityCoverage = 1`, `privateDeepReasoningCompressionCoverage = 1`, `privateEvidenceSynthesisCoverage = 1`, `repetitionRate = 0.261`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: Public Evidence Label Stack

This follow-up fixes a public-speech seam where evidence labels could stack as `我过不去的是：两条线索合在一起：...`.

- Public evidence anchors now choose a label based on the spoken evidence text. When the evidence text already starts with `两条线索合在一起：`, the public line uses `证据卡在：...` instead of nesting it under `我过不去的是：...`.
- The full evidence anchor remains intact, so priority-signal and cross-script reasoning gates still see the same public-safe evidence content.
- The fixed evaluator now gates `publicEvidenceSynthesisLabelStackCoverage = 1`, preventing stacked evidence-label prefixes while keeping `publicEvidenceSynthesisCoverage`, `publicPrioritySignalCoverage`, and cross-script public reasoning at full coverage.
- Root and Unity embedded `ai_public_discussion.js` and `ai_quality_eval.mjs` copies were kept in sync.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot remains 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.944`, `publicEvidenceSynthesisLabelStackCoverage = 1`, `publicEvidenceSynthesisCoverage = 1`, `publicPrioritySignalCoverage = 1`, `crossScriptPublicReasoningCoverage = 1`, `repetitionRate = 0.265`, and `stanceContinuityRate = 1`.

Updated short-term baseline:

1. AI agent: formal vote rationale is no longer missing; next AI focus is multi-day stance history, BMR/SnV coverage, evil cooperation, public claim-disclosure decisions, and richer vote edge-case evaluation.
2. UI polish: the next vote/UI task is to render `voteRationale` during the vote ceremony as compact explanation cards or expandable voter chips, instead of only exporting the data.
3. Rules: continue with the BMR/SnV role audit matrix and event pipeline cleanup so AI and UI reasoning is built on more exact script behavior.

## 2026-06-02 Follow-up: Formal Vote Line Diversity

This follow-up improves the player-facing language floor for formal votes without changing vote rules or the `voteRationale` data contract.

- Formal vote rationale lines now choose from deterministic public-safe variants keyed by voter, nominee, persona, reason, evidence count, and margin, so repeated no-votes do not all read as the same NPC template.
- The fixed AI quality evaluation now gates `formalVoteLineDiversityCoverage` in addition to `formalVoteRationaleCoverage`.
- Current fixed snapshot: 35 rows, `formalVoteRationaleCoverage = 1`, `formalVoteLineDiversityCoverage = 0.867`, `formalVoteReasonModeCoverage = 1`, `formalVoteNearThresholdCoverage = 1`, `repetitionRate = 0.100`, and `hiddenLeakCount = 0`.
- Unity StreamingAssets JS mirrors were synced for `ai.js` and `ai_quality_eval.mjs`.

Updated short-term baseline:

1. AI agent: formal vote explanation is now both present and measurably less repetitive; next vote-language work should cover yes-vote, ghost-vote, Butler-blocked, evil-ally, and near-threshold edge cases.
2. UI polish: vote ceremony cards can now render varied `voteRationale.line` text without waiting for LLM polish.
3. Rules: no vote resolution behavior changed; this is a language-quality and evaluation-contract improvement only.

## 2026-06-02 Follow-up: Formal Vote Reason Mode Coverage

This follow-up expands formal vote evaluation from repeated no-vote wording to multiple public-safe vote decision modes.

- The fixed AI quality evaluation now adds deterministic formal-vote edge fixtures for `evidence-backed-yes`, `pressure-threshold-yes`, `pressure-below-threshold`, `ghost-vote-pressure`, and `cannot-vote`, alongside the real nomination vote rows that cover `evidence-below-threshold`.
- `formalVoteReasonModeCoverage` is now a quality gate, so future changes cannot silently collapse formal vote reasoning back to a single decision mode.
- Ghost-vote rationale lines now explicitly mention the public ghost vote, e.g. `我剩这张鬼票就投 ...` without exposing hidden state.
- Current fixed snapshot: 35 rows, `formalVoteReasonModeCoverage = 1`, `formalVoteLineDiversityCoverage = 0.867`, `formalVoteRationaleCoverage = 1`, `formalVoteNearThresholdCoverage = 1`, `repetitionRate = 0.100`, and `hiddenLeakCount = 0`.
- Unity StreamingAssets JS mirrors were synced for `ai.js` and `ai_quality_eval.mjs`.

Updated short-term baseline:

1. AI agent: formal vote reasoning now covers major public-safe vote modes; next vote-language work should add evil-ally protection/sacrifice vote fixtures and richer near-threshold variants under evidence-backed yes/no.
2. UI polish: vote ceremony explanation cards can now distinguish yes/no/ghost/cannot-vote states from `reasonKey` instead of treating all rationale lines as generic text.
3. Rules: no rule behavior changed; this only strengthens deterministic AI evaluation around existing vote outcomes.

## 2026-06-02 Follow-up: Formal Vote Boundary Texture

This follow-up adds the two formal vote edge cases that were still weak after reason-mode coverage: near-threshold hesitation and Butler-blocked vote resolution.

- Near-threshold formal vote lines now detect small vote margins and verbalize uncertainty with table-readable wording such as `贴线票`, `勉强跟`, `刚过我的线`, `差一点过线`, or `几乎到线`.
- The fixed AI quality evaluation now adds near-threshold yes/no fixtures and gates `formalVoteNearThresholdCoverage`.
- Butler-blocked rationale now runs through the full `resolveNominationAndVote(...)` path. When an intended yes vote is blocked, the player-facing line names the nominee while preserving the existing `butler-restricted` reason key.
- Current fixed snapshot: 35 rows, `formalVoteNearThresholdCoverage = 1`, `formalVoteReasonModeCoverage = 1`, `formalVoteLineDiversityCoverage = 0.867`, `formalVoteRationaleCoverage = 1`, `repetitionRate = 0.100`, and `hiddenLeakCount = 0`.
- Unity StreamingAssets JS mirrors were synced for `ai.js`, `ai_quality_eval.mjs`, and `engine.js`.

Updated short-term baseline:

1. AI agent: formal vote explanations now cover ordinary yes/no, ghost vote, cannot-vote, Butler-blocked, and near-threshold hesitation; the next vote edge should keep expanding script-specific pressure contexts.
2. UI polish: vote ceremony cards can now show near-threshold uncertainty and blocked-vote explanations directly from `voteRationale.line`.
3. Rules: no vote-resolution behavior changed; only blocked-vote explanation text and AI evaluation coverage changed.

## 2026-06-02 Follow-up: Formal Vote Evil Cover Safety

This follow-up closes the formal-vote version of the evil-side cover gap: hidden teammate strategy can influence the vote decision, but the player-visible explanation remains table-readable.

- Evil known-ally formal vote decisions now classify their public rationale as `table-balance-no` when the AI avoids joining pressure, or `execution-window-yes` when the AI rarely follows a high-pressure execution window.
- The rendered vote lines speak in public table terms such as pressure balance, second pressure position, vote shape, process, and execution window; they do not say `自己人`, `邪恶视角`, `爪牙`, `恶魔伪装`, or English hidden-strategy terms.
- The fixed AI quality evaluation now adds deterministic evil formal-vote yes/no fixtures and gates `formalVoteEvilCoverSafetyCoverage`.
- Current fixed snapshot: 37 rows, `formalVoteEvilCoverSafetyCoverage = 1`, `formalVoteNearThresholdCoverage = 1`, `formalVoteReasonModeCoverage = 1`, `formalVoteLineDiversityCoverage = 0.882`, `formalVoteRationaleCoverage = 1`, `repetitionRate = 0.097`, and `hiddenLeakCount = 0`.
- Unity StreamingAssets JS mirrors were synced for `ai.js` and `ai_quality_eval.mjs`.

Updated short-term baseline:

1. AI agent: formal vote explanations now cover ordinary yes/no, ghost vote, cannot-vote, Butler-blocked, near-threshold hesitation, and evil-side cover/sacrifice boundaries without leaking hidden intent.
2. UI polish: vote ceremony cards can safely render the new public reason keys as table-facing explanations, without needing to show hidden evil rationale.
3. Rules: no vote-resolution behavior changed; this is a language-quality and evaluation-contract improvement only.

## 2026-06-02 Follow-up: Formal Vote Evidence Boundary

This follow-up deepens near-threshold formal vote language when evidence exists: the AI should not only say a vote is close, but also say whether the public evidence barely crossed or barely missed the execution line.

- Evidence-backed near-threshold yes votes now preserve both the evidence anchor and the uncertainty marker, e.g. `证据刚好过线，但这是贴线票`.
- Evidence-backed near-threshold no votes now explain that the line is close but still missing enough public evidence, e.g. `线索差一点过线，还缺能落票的公开证据`.
- The fixed AI quality evaluation now adds deterministic evidence-backed near-threshold yes/no fixtures and gates `formalVoteEvidenceBoundaryCoverage`.
- Current fixed snapshot: 39 rows, `formalVoteEvidenceBoundaryCoverage = 1`, `formalVoteEvilCoverSafetyCoverage = 1`, `formalVoteNearThresholdCoverage = 1`, `formalVoteReasonModeCoverage = 1`, `formalVoteLineDiversityCoverage = 0.895`, `formalVoteRationaleCoverage = 1`, `repetitionRate = 0.095`, and `hiddenLeakCount = 0`.
- Unity StreamingAssets JS mirrors were synced for `ai.js` and `ai_quality_eval.mjs`.

Updated short-term baseline:

1. AI agent: formal vote explanations now distinguish evidence-backed close yes/no decisions from generic pressure hesitation.
2. UI polish: vote ceremony cards can render evidence-backed boundary lines directly from `voteRationale.line`.
3. Rules: no vote-resolution behavior changed; this is a language-quality and evaluation-contract improvement only.

## 2026-06-02 Follow-up: Formal Vote Multi-Evidence Compression

This follow-up deepens formal-vote wording when more than one public evidence row points at the nominee.

- Multi-evidence yes votes now compress accumulated pressure into table-readable lines such as `多条证据合在一起，今天不能只停在讨论`.
- Multi-evidence no votes now distinguish discussion pressure from execution pressure, e.g. `两条线索够讨论，但还没合成处决票`.
- The fixed AI quality evaluation now adds deterministic multi-evidence yes/no fixtures and gates `formalVoteMultiEvidenceCompressionCoverage`.
- Current fixed snapshot: 41 rows, `formalVoteMultiEvidenceCompressionCoverage = 1`, `formalVoteEvidenceBoundaryCoverage = 1`, `formalVoteEvilCoverSafetyCoverage = 1`, `formalVoteNearThresholdCoverage = 1`, `formalVoteReasonModeCoverage = 1`, `formalVoteLineDiversityCoverage = 0.810`, `formalVoteRationaleCoverage = 1`, `repetitionRate = 0.118`, and `hiddenLeakCount = 0`.
- Unity StreamingAssets JS mirrors were synced for `ai.js` and `ai_quality_eval.mjs`.

Updated short-term baseline:

1. AI agent: formal vote explanations now cover single evidence, evidence-backed close calls, and multi-evidence compression.
2. UI polish: vote ceremony cards can surface evidence accumulation without parsing raw evidence rows.
3. Rules: no vote-resolution behavior changed; this is a language-quality and evaluation-contract improvement only.

## 2026-06-02 Follow-up: Formal Vote Cross-Script Coverage

This follow-up starts moving the fixed AI quality evaluation beyond TB without broadening the rule surface under test.

- The fixed AI quality set now adds deterministic BMR and SnV formal-vote samples using the same public-safe `voteRationale` path as TB.
- `formalVoteScriptCoverage` now gates that formal vote rationale rows cover `tb`, `bmr`, and `snv`.
- The BMR/SnV rows currently test evidence-backed public vote wording and hidden-leak safety; they do not claim full BMR/SnV dialogue or role-specific AI coverage yet.
- Current fixed snapshot: 43 rows, `formalVoteScriptCoverage = 1`, `formalVoteMultiEvidenceCompressionCoverage = 1`, `formalVoteEvidenceBoundaryCoverage = 1`, `formalVoteEvilCoverSafetyCoverage = 1`, `formalVoteNearThresholdCoverage = 1`, `formalVoteReasonModeCoverage = 1`, `formalVoteLineDiversityCoverage = 0.826`, `formalVoteRationaleCoverage = 1`, `repetitionRate = 0.115`, and `hiddenLeakCount = 0`.
- Unity StreamingAssets JS mirrors were synced for `ai.js`, `ai_private_social.js`, and `ai_quality_eval.mjs`.

Updated short-term baseline:

1. AI agent: formal vote rationale now has a first fixed cross-script language contract across TB, BMR, and SnV.
2. UI polish: vote ceremony cards can rely on the same `voteRationale` shape across the three base scripts.
3. Rules: this does not verify BMR/SnV role-rule accuracy; it only verifies AI formal-vote rationale portability across scripts.

## 2026-06-03 Follow-up: Private Claim Cross-Script Coverage

This follow-up adds the first BMR/SnV fixed samples for private identity-disclosure language.

- The fixed AI quality set now adds deterministic BMR and SnV private claim-question rows through `runPrivateWhisper(...)`.
- `crossScriptClaimDisclosureCoverage` now gates that those rows carry `claimDisclosureRationale`, disclosure level, script id, and table-readable identity-lane wording.
- Current BMR/SnV samples use a cautious vague disclosure line, e.g. preserving a private identity lane while saying not to publish it on the caller's behalf.
- Current fixed snapshot: 45 rows, `crossScriptClaimDisclosureCoverage = 1`, `claimDisclosureRationaleCoverage = 1`, `claimDisclosureContinuityCoverage = 1`, `claimDisclosureContinuityModeCoverage = 1`, `formalVoteScriptCoverage = 1`, `repetitionRate = 0.155`, and `hiddenLeakCount = 0`.
- Unity StreamingAssets JS mirrors were synced for `ai.js`, `ai_private_social.js`, and `ai_quality_eval.mjs`.

Updated short-term baseline:

1. AI agent: BMR/SnV now have fixed private claim-disclosure rationale samples in addition to formal-vote rationale samples.

## 2026-06-03 Follow-up: Decision Role Hypothesis

This follow-up continues the AI-agent reasoning-depth track without changing game rules or scoring behavior.

- `decisionRationale` now also exports `roleHypothesisLine`, which splits the current pressure into public-safe good-role and bad-role hypotheses instead of only naming evidence, timing, or BOTC mechanics.
- The line is derived from evidence mode, reason key, confidence band, risk flags, public-only constraints, and runner-up context. It asks whether a good identity line can self-consistently explain role, ability, vote, speech, and timing, or whether the behavior is better explained as bad-role cover, pressure avoidance, or claim repair.
- Private replies, proactive private chat, AI-AI private chat, public discussion, nomination rationale cards, and Unity verification cards now preserve the field.
- The fixed AI quality evaluation now gates `decisionRoleHypothesisCoverage = 1`.
- Current fixed snapshot remains 92 rows with `decisionRoleHypothesisCoverage = 1`, `decisionMechanicSensitivityCoverage = 1`, `hiddenLeakCount = 0`, and `repetitionRate = 0.312`.

Updated three-direction baseline:

1. AI agent: decision reasoning now distinguishes rule-mechanic constraints from role/alignment hypotheses, which makes the AI closer to a real table player comparing plausible worlds.
2. UI polish: Unity rationale cards can show role-hypothesis text directly, giving future recap cards a clearer "good-world vs bad-world" layer.
3. Rules: no rule resolution changed; this is an explanation and evaluation-contract improvement only.
2. UI polish: identity-disclosure cards can rely on the same `claimDisclosureRationale` shape across the three base scripts.
3. Rules: this does not verify BMR/SnV role-specific claim constraints; it only verifies private claim-disclosure rationale portability across scripts.

## 2026-06-03 Follow-up: Public Reasoning Cross-Script Coverage

This follow-up adds the first BMR/SnV fixed samples for public-discussion reasoning.

- The fixed AI quality set now adds deterministic BMR and SnV public-discussion rows through `runAIConversationStep(...)`.
- `crossScriptPublicReasoningCoverage` now gates that those rows carry script id, public audience, focus target, final `decisionRationale.spokenLine`, public evidence anchor, and table-action follow-up wording.
- Public surface polish now repairs human-target follow-up artifacts such as `让 你 把身份和昨晚信息说清楚`, and the evaluator also catches `X号 我...` spacing regressions.
- Current fixed snapshot: 47 rows, `crossScriptPublicReasoningCoverage = 1`, `crossScriptClaimDisclosureCoverage = 1`, `formalVoteScriptCoverage = 1`, `publicSurfacePolishCoverage = 1`, `repetitionRate = 0.157`, and `hiddenLeakCount = 0`.
- Unity StreamingAssets JS mirrors were synced for `ai_quality_eval.mjs` and `ai_speech_renderer.js`.

Updated short-term baseline:

1. AI agent: BMR/SnV now have fixed public reasoning samples in addition to formal-vote and private claim-disclosure samples.
2. UI polish: public dialogue cards can rely on cleaner follow-up text and the same `decisionRationale` shape across the three base scripts.
3. Rules: this does not verify BMR/SnV role-specific public strategy; it verifies public-discussion reasoning portability and language safety across scripts.

## 2026-06-03 Follow-up: Public Multi-Evidence Cross-Script Coverage

This follow-up makes the BMR/SnV public-discussion fixture harder: the AI must handle multiple visible evidence rows in one table-readable public line.

- The fixed AI quality set now adds deterministic BMR and SnV public multi-evidence rows with identity mismatch, vote-shape pressure, and nomination-pressure context on the same focus target.
- `crossScriptPublicMultiEvidenceCoverage` now gates that those rows carry at least two evidence summaries, `decisionRationale.focusEvidenceCount >= 2`, readable multi-evidence compression wording, and an actionable follow-up.
- Current fixed snapshot: 49 rows, `crossScriptPublicMultiEvidenceCoverage = 1`, `crossScriptPublicReasoningCoverage = 1`, `publicSurfacePolishCoverage = 1`, `repetitionRate = 0.160`, and `hiddenLeakCount = 0`.
- Unity StreamingAssets JS mirror was synced for `ai_quality_eval.mjs`.

Updated short-term baseline:

1. AI agent: BMR/SnV public reasoning now has both basic focus/evidence/follow-up coverage and a first multi-evidence compression floor.
2. UI polish: public dialogue and future recap cards can surface multi-evidence pressure without parsing raw evidence rows.
3. Rules: this remains a language/reasoning portability contract; it does not claim BMR/SnV role-specific public strategy is complete.

## 2026-06-03 Follow-up: Cross-Day Stance Cross-Script Coverage

This follow-up moves cross-day stance continuity beyond the TB baseline.

- The fixed AI quality set now adds deterministic BMR and SnV public cross-day rows for both `hold` and `shift` modes.
- `crossScriptCrossDayStanceCoverage` now gates that BMR/SnV each preserve a public-safe cross-day stance object, name the focus target, verbalize the previous-day anchor, cite the current-day reason, and cover both "hold pressure" and "watch -> pressure shift".
- Public clipped-evidence cleanup now repairs bare `身份...` fragments into readable `身份要对` wording, so cross-day summaries do not surface half-cut evidence text.
- Current fixed snapshot: 53 rows, `crossScriptCrossDayStanceCoverage = 1`, `crossDayStanceContinuityCoverage = 1`, `crossDayStanceReasonCoverage = 1`, `crossDayStanceModeCoverage = 1`, `repetitionRate = 0.152`, and `hiddenLeakCount = 0`.
- Unity StreamingAssets JS mirrors were synced for `ai_quality_eval.mjs` and `ai_speech_renderer.js`.

Updated short-term baseline:

1. AI agent: cross-day stance reasoning now has fixed BMR/SnV hold and shift coverage, not only TB day-two examples.
2. UI polish: future reasoning recap cards can trust cross-day stance metadata across all three base scripts.
3. Rules: this remains a language/reasoning continuity contract; it does not alter script-specific rule resolution.

## 2026-06-03 Follow-up: Claim Continuity Cross-Script Coverage

This follow-up moves identity-line continuity beyond the TB repeat-claim and forced-revision baseline.

- The fixed AI quality set now adds deterministic BMR and SnV claim-disclosure continuity rows for `hold`, `escalate`, and `revise`.
- `crossScriptClaimContinuityCoverage` now gates that each BMR/SnV fixture preserves script id, previous disclosure level, continuity mode, continuity line, rendered spoken line, and revision movement metadata when the role claim changes.
- Claim continuity wording now removes awkward role-name spacing such as `明跳 圣徒` / `从 守鸦人 改到 圣徒`, producing tighter player-facing lines like `明跳圣徒` and `从守鸦人改到圣徒`.
- Current fixed snapshot: 59 rows, `crossScriptClaimContinuityCoverage = 1`, `crossScriptClaimDisclosureCoverage = 1`, `claimDisclosureRationaleCoverage = 1`, `claimDisclosureContinuityCoverage = 1`, `claimDisclosureContinuityModeCoverage = 1`, `repetitionRate = 0.171`, and `hiddenLeakCount = 0`.
- Unity StreamingAssets JS mirrors were synced for `ai_quality_eval.mjs` and `ai_claim_policy.js`.

Updated short-term baseline:

1. AI agent: BMR/SnV identity disclosure now has fixed coverage for preserving, upgrading, and revising a prior claim line.
2. UI polish: reasoning recap and timeline identity cards can rely on cleaner claim-continuity wording and previous -> current movement metadata.
3. Rules: this remains a claim-language continuity contract; the first dedicated madness / outsider-risk / death-trigger fixture floor is added in the 2026-06-03 role-constrained follow-up below.

## 2026-06-03 Follow-up: Private Multi-Evidence Cross-Script Coverage

This follow-up moves multi-evidence compression from public discussion into private reasoning replies.

- `playerStyleEvidenceSummary(...)` now prefixes two distinct clue families with `两条线索合在一起：...`, so private reason answers can say they are combining evidence instead of sounding like a single-point suspicion.
- Private multi-evidence wording now adds a compact evidence-family synthesis such as `低证据推人和身份对不上卡在一起`, so the answer explains why the clue families reinforce each other instead of only listing labels.
- The fixed synthesis floor now covers three private evidence-family modes: `identity-low-evidence`, `identity-vote`, and `identity-night-info`, including wording like `票型和身份同时咬住` and `夜信链和身份需要互相对上`.
- The fixed AI quality set now adds deterministic BMR and SnV private reason rows where the focus target has both a false public claim chain and a public low-evidence accusation chain.
- `crossScriptPrivateMultiEvidenceCoverage` now gates that these rows preserve script id, private audience, reason intent, `focusEvidenceCount >= 2`, at least two evidence summaries, both `false-claim-chain` and `public-accuse-chain`, focus naming, and rendered multi-evidence wording; `privateEvidenceSynthesisCoverage` gates the relationship sentence, and `privateEvidenceSynthesisVariantCoverage` gates the three synthesis modes.
- Current fixed snapshot: 92 rows, `crossScriptPrivateMultiEvidenceCoverage = 1`, `privateEvidenceSynthesisCoverage = 1`, `privateEvidenceSynthesisVariantCoverage = 1`, `crossScriptPublicMultiEvidenceCoverage = 1`, `publicEvidenceSynthesisCoverage = 1`, `publicEvidenceSynthesisDedupCoverage = 1`, `evidenceCitationRate = 0.913`, `formalVoteLineDiversityCoverage = 0.957`, `repetitionRate = 0.304`, and `hiddenLeakCount = 0`.
- Unity StreamingAssets JS mirrors were synced for `ai.js` and `ai_quality_eval.mjs`.

Updated short-term baseline:

1. AI agent: BMR/SnV private reasoning now has a fixed floor for combining identity contradiction with public-pressure, vote-shape, or night-info evidence in one answer.
2. UI polish: future private-chat recap cards can rely on `evidenceSpokenText`, evidence summaries, and graph-chain metadata for multi-evidence explanations.
3. Rules: this is still a language/reasoning contract; it does not change role resolution or execution truth.

## 2026-06-03 Follow-up: Evil Private Coordination Coverage

This follow-up gives evil-team private planning a fixed quality gate instead of leaving it only to isolated behavior contracts.

- Same-evil private replies now keep enough budget to include team confirmation, true identity, public cover plan, and a pressure target in one answer.
- Evil private claim/plan replies now merge cover and target into a compact `台面安排` line, e.g. `伪装先不锁死，今天把7号放到火力点，先问身份和夜里信息`.
- `evilPrivateCoordinationCoverage` now gates deterministic TB/BMR/SnV evil private rows. These rows are explicitly `allowHiddenTruth = true`, so hidden-team language is verified in the evil-private lane without polluting ordinary hidden-leak gates.
- Current fixed snapshot: 64 rows, `evilPrivateCoordinationCoverage = 1`, `claimDisclosureRationaleCoverage = 1`, `crossScriptPrivateMultiEvidenceCoverage = 1`, `crossScriptCrossDayStanceCoverage = 1`, `repetitionRate = 0.217`, and `hiddenLeakCount = 0`.
- Unity StreamingAssets JS mirrors were synced for `ai.js` and `ai_quality_eval.mjs`.

Updated short-term baseline:

1. AI agent: evil human-AI private coordination now has a measurable floor for identity, cover, and target-pressure planning across TB/BMR/SnV.
2. UI polish: private-chat timelines can safely distinguish hidden-allowed evil coordination from public-safe dialogue by using the existing private context instead of parsing hidden terms as leaks.
3. Rules: this does not change evil-team recognition or win-condition logic; it only improves private planning language and evaluation.

## 2026-06-03 Follow-up: AI-AI Evil Coordination Coverage

This follow-up extends evil-team planning coverage from human-AI private chat into hidden AI-AI private whispers.

- The fixed AI quality set now adds deterministic TB/BMR/SnV hidden AI-AI evil coordination rows generated through `runAIToAIPrivateWhispers(...)`.
- `aiToAiEvilCoordinationCoverage` gates that those rows are `aiToAi`, `hiddenFromHuman`, hidden from the human-facing timeline/log, same-team evil-to-evil, and include team context, a named pressure target, and a public-facing reason.
- These rows are `allowHiddenTruth = true`, so evil-only language is validated in the hidden AI-AI lane while ordinary public/private leak gates remain clean.
- Current fixed snapshot: 67 rows, `aiToAiEvilCoordinationCoverage = 1`, `evilPrivateCoordinationCoverage = 1`, `crossScriptPrivateMultiEvidenceCoverage = 1`, `decisionRationaleCoverage = 0.818`, `repetitionRate = 0.222`, and `hiddenLeakCount = 0`.
- Unity StreamingAssets JS mirror was synced for `ai_quality_eval.mjs`.

Updated short-term baseline:

1. AI agent: hidden AI-AI evil coordination now has a measurable floor for team planning, target pressure, and table-safe reason packaging.
2. UI polish: human-facing UI remains protected because the gate also proves these hidden AI-AI rows do not enter the player timeline or log.
3. Rules: no rule behavior changed; this validates private coordination language and visibility boundaries only.

## 2026-06-03 Follow-up: Role-Constrained Claim Disclosure

This follow-up gives identity-disclosure reasoning its first role-specific constraint floor instead of only generic pressure/trust/day rules.

- `claimDisclosurePlanner(...)` now recognizes public-role constraints for Cerenovus-style madness pressure, risky outsider scripts, Mutant outsider-claim risk, Sweetheart death-drunk risk, Barber swap timing, and alive death-trigger roles.
- Non-forced public plans cap those constrained disclosures below hard-claim, so the rationale can explain why the AI is preserving a range/withhold line instead of exposing exact `roleId` or `roleName`.
- The fixed AI quality set now adds deterministic SnV madness-pressure, BMR outsider-risk, SnV Mutant, SnV Sweetheart, SnV Barber, and TB death-trigger timing rows.
- `roleConstrainedClaimDisclosureCoverage` gates that those rows are public-safe, non-hard, synced to rendered rationale text, and explicitly verbalize the relevant role risk.
- Current fixed snapshot: 73 rows, `roleConstrainedClaimDisclosureCoverage = 1`, `claimDisclosureRationaleCoverage = 1`, `claimDisclosureContinuityCoverage = 1`, `decisionRationaleCoverage = 0.818`, `evidenceCitationRate = 0.890`, `repetitionRate = 0.233`, and `hiddenLeakCount = 0`.
- A later language-polish pass varies the public-safe opening line by reason key, so madness pressure, outsider-risk, Mutant, Sweetheart, Barber, and death-trigger rows no longer all start with the same `我暂时保留具体身份` template.
- Latest fixed snapshot after that pass: 92 rows, `roleConstrainedClaimLineDiversityCoverage = 1`, `roleConstrainedClaimDisclosureCoverage = 1`, `claimDisclosureRationaleCoverage = 1`, `repetitionRate = 0.278`, and `hiddenLeakCount = 0`.
- A later public-pressure polish pass salts high-pressure multi-evidence persona openings with target/persona/evidence context. Latest fixed snapshot: 92 rows, `publicPersonaPressureLineDiversityCoverage = 1`, `publicShadowPressureLineDiversityCoverage = 0.818`, `publicPersonaPressureVariantCoverage = 1`, `repetitionRate = 0.269`, and `hiddenLeakCount = 0`.
- A later long-arc claim-cover pass lets evil public speech say the visible pressure line also has continuity, e.g. yesterday already watching the current target while today's public claimed-role line stays stable. It now covers TB/BMR/SnV generated arcs, with shadow high-pressure openers salted by target/script/cover context. Latest fixed snapshot: 94 rows, `evilPublicClaimCoverPressureContinuityCoverage = 1`, `evilPublicClaimCoverDeceptionArcCoverage = 1`, `publicShadowPressureLineDiversityCoverage = 0.923`, `repetitionRate = 0.271`, and `hiddenLeakCount = 0`.
- Unity StreamingAssets JS mirrors were synced for `ai_claim_policy.js`, `ai_public_discussion.js`, and `ai_quality_eval.mjs`.

Updated short-term baseline:

1. AI agent: identity disclosure now reasons about role pressure, not just generic suspicion and trust.
2. UI polish: future claim-disclosure cards can surface public-safe reason keys for madness pressure, outsider risk, and death-trigger timing without exposing hidden roles.
3. Rules: this still does not implement every script-specific claim edge; it extends the measurable floor to Mutant, Sweetheart, and Barber in addition to madness, outsider-risk, and death-trigger timing.

## 2026-06-03 Follow-up: Evil Public Claim-Cover Continuity

This follow-up deepens evil-side public deception from generic table pressure into maintaining an already-public identity line.

- Evil public discussion now emits a public-safe claim-cover continuity fragment when an evil AI has already made a visible public claim, e.g. `公开身份我仍按调查员这条说，今天先看信息口径和票型怎么对`.
- The fragment is added before the final public speech budget and has its own priority fragment, so target, evidence, question, table-safe cover wording, and claimed-role continuity can survive trimming together.
- The fixed AI quality set now adds a deterministic evil public claim-cover row and gates `evilPublicClaimCoverContinuityCoverage`.
- Current fixed snapshot: 74 rows, `evilPublicClaimCoverContinuityCoverage = 1`, `evilPublicCoverTextureCoverage = 1`, `evilPublicCoverMaintenanceCoverage = 1`, `evilPublicCoverPivotCoverage = 1`, `evilPublicProtectAllyCoverage = 1`, `evidenceCitationRate = 0.890`, `repetitionRate = 0.236`, and `hiddenLeakCount = 0`.
- Unity StreamingAssets JS mirrors were synced for `ai_public_discussion.js` and `ai_quality_eval.mjs`.

Updated short-term baseline:

1. AI agent: evil public deception now has a first measurable identity-line continuity floor, not only target-pressure cover, pivot, and ally-protection wording.
2. UI polish: future recap cards can distinguish "public identity line maintained" from hidden evil intent using player-visible text and metrics, without exposing the true role.
3. Rules: no rule behavior changed; this is a language-quality and hidden-leak safety contract for public speech only.

## 2026-06-03 Follow-up: Evil Claim-Cover Pivot Arc

This follow-up combines two previously separate evil-public skills: keeping an already-public identity line and publicly pivoting pressure to a new target.

- Evil public claim-cover wording now uses a sharper pivot-aware fragment when the same line is paired with a public-safe target pivot, e.g. `目标可以转，公开身份我仍按调查员这条说，先看信息口径和票型怎么对`.
- The fixed AI quality set now adds a deterministic evil public claim-cover pivot row and gates `evilPublicClaimCoverPivotCoverage`.
- The gate requires one public speech to preserve the pivot target, the visible claimed role, identity-line continuity wording, pivot wording, table-safe cover markers, and zero evil-only leak terms.
- Current fixed snapshot: 75 rows, `evilPublicClaimCoverPivotCoverage = 1`, `evilPublicClaimCoverContinuityCoverage = 1`, `evilPublicCoverPivotCoverage = 1`, `evilPublicProtectAllyCoverage = 1`, `evidenceCitationRate = 0.893`, `repetitionRate = 0.238`, and `hiddenLeakCount = 0`.
- Unity StreamingAssets JS mirrors were synced for `ai_public_discussion.js` and `ai_quality_eval.mjs`.

Updated short-term baseline:

1. AI agent: evil public deception now has a first measurable combined arc: the AI can change pressure targets while explicitly keeping its public claimed identity stable.
2. UI polish: future recap cards can treat "target pivot under same public identity line" as a distinct public-facing deception pattern.
3. Rules: no rule behavior changed; this is public dialogue quality and hidden-leak safety only.

## 2026-06-03 Follow-up: Evil Claim-Cover Protect-Ally Arc

This follow-up adds the other half of the longer evil deception arc: keeping the public identity line stable while using table-readable pressure distribution to deflect from an ally.

- Evil public claim-cover wording now has a protect-ally-aware fragment, e.g. `压力可以分散，公开身份我仍按调查员这条说，先看信息口径和票型怎么对`.
- The fixed AI quality set now adds a deterministic evil public claim-cover protect-ally row and gates `evilPublicClaimCoverProtectAllyCoverage`.
- The gate requires one public speech to preserve the named pressure target, visible claimed role, claim-cover wording, pressure-distribution wording, table-safe cover markers, and zero hidden evil leak terms.
- Current fixed snapshot: 76 rows, `evilPublicClaimCoverProtectAllyCoverage = 1`, `evilPublicClaimCoverPivotCoverage = 1`, `evilPublicClaimCoverContinuityCoverage = 1`, `evilPublicProtectAllyCoverage = 1`, `evidenceCitationRate = 0.895`, `repetitionRate = 0.240`, and `hiddenLeakCount = 0`.
- Unity StreamingAssets JS mirrors were synced for `ai_public_discussion.js` and `ai_quality_eval.mjs`.

Updated short-term baseline:

1. AI agent: evil public deception now covers both major combined arcs: changing targets under the same public identity line, and distributing pressure away from an ally while keeping that line stable.
2. UI polish: future recap cards can distinguish public pressure distribution from hidden ally protection without showing the protected ally relationship.
3. Rules: no rule behavior changed; this is public dialogue quality and hidden-leak safety only.

## 2026-06-03 Follow-up: Public Action-Role Claim Pressure

This follow-up expands visible role-claim pressure beyond information, outsider-risk, death-trigger, and protection families.

- Public claim pressure now has a `public-action` family for visible action/trigger roles such as Slayer, Virgin, Gossip, Professor, and Exorcist.
- Action-role claim pressure can say `既然4号报猎手，行动窗口和目标结果要讲清，不能只把能力牌挂出来`, grounding the challenge in public action timing and target/result accountability.
- Public evidence synthesis now has a dedupe pass after both public speech budget exits, so a line keeps the synthesis once instead of repeating the same phrase before both the role-pressure clause and the evidence recap.
- The fixed AI quality set now covers 5 public role-pressure modes and gates `publicEvidenceSynthesisDedupCoverage`.
- Current fixed snapshot: 88 rows, `publicRolePressureVariantCoverage = 1`, `publicEvidenceSynthesisCoverage = 1`, `publicEvidenceSynthesisDedupCoverage = 1`, `publicTimingPressureVariantCoverage = 1`, `publicScriptPressureVariantCoverage = 1`, `publicPersonaPressureVariantCoverage = 1`, `evidenceCitationRate = 0.909`, `repetitionRate = 0.298`, and `hiddenLeakCount = 0`.
- Unity StreamingAssets JS mirrors were synced for `ai_public_discussion.js` and `ai_quality_eval.mjs`.

Updated short-term baseline:

1. AI agent: visible action-role claims now get role-family-specific pressure instead of generic identity pressure.
2. UI polish: future recap chips can distinguish information, risk, death-trigger, protection, and action-window claim pressure.
3. Rules: no role behavior changed; this is public dialogue reasoning and quality-gate coverage only.

## 2026-06-03 Follow-up: Public Evidence Synthesis

This follow-up makes high-pressure public multi-evidence speech explain how evidence families connect, not only that multiple clues exist.

- Public discussion now synthesizes visible evidence families into compact public-safe clauses such as `身份解释和投票线卡在同一处`, `公开压力和票型互相推高`, or `身份线被提名压力顶住`.
- Persona and role-pressure lines pass target names into deterministic variants, reducing repeated stems without adding randomness or changing target selection.
- Role-claim pressure can prepend this synthesis before visible claim critique, so a line can connect identity, vote, or nomination pressure before asking the claimed role to clarify.
- The fixed AI quality set now gates `publicEvidenceSynthesisCoverage` and the later `publicEvidenceSynthesisDedupCoverage` follow-up prevents repeated synthesis phrases in the same line.
- Current fixed snapshot: 88 rows, `publicEvidenceSynthesisCoverage = 1`, `publicEvidenceSynthesisDedupCoverage = 1`, `publicRolePressureVariantCoverage = 1`, `publicTimingPressureVariantCoverage = 1`, `publicScriptPressureVariantCoverage = 1`, `publicPersonaPressureVariantCoverage = 1`, `evidenceCitationRate = 0.909`, `repetitionRate = 0.298`, and `hiddenLeakCount = 0`.
- Unity StreamingAssets JS mirrors were synced for `ai_public_discussion.js` and `ai_quality_eval.mjs`.

Updated short-term baseline:

1. AI agent: public multi-evidence speech now explains why clue families reinforce each other, not just lists them.
2. UI polish: future recap cards can show an "evidence family synthesis" chip beside role, timing, and script pressure chips.
3. Rules: no rule behavior changed; this is public dialogue reasoning compression and quality-gate coverage only.

## 2026-06-03 Follow-up: Public Role Pressure Variants

This follow-up makes high-pressure multi-evidence public speech react to the target's public role claim.

- Public claim pressure is based only on visible claim events, not true hidden role state.
- Info-role claims can now be pressed with lines like `既然3号报调查员，信息链就要和票型对上，不能只给身份名`.
- Outsider-risk claims can now be pressed with lines like `既然3号报修补匠，风险边界要说清，不能只靠外来者身份挡压`.
- Death-trigger and protection claims can now mention public-safe role pressure such as `死亡触发和死后信息` or `保护口径要和昨晚死亡对上`.
- The fixed AI quality set now adds deterministic info-claim, outsider-risk, death-trigger, protection, and later public-action rows, and gates `publicRolePressureVariantCoverage`.
- Current fixed snapshot: 88 rows, `publicRolePressureVariantCoverage = 1`, `publicEvidenceSynthesisDedupCoverage = 1`, `publicTimingPressureVariantCoverage = 1`, `publicScriptPressureVariantCoverage = 1`, `publicPersonaPressureVariantCoverage = 1`, `evidenceCitationRate = 0.909`, `repetitionRate = 0.298`, and `hiddenLeakCount = 0`.
- Unity StreamingAssets JS mirrors were synced for `ai_public_discussion.js` and `ai_quality_eval.mjs`.

Updated short-term baseline:

1. AI agent: high-pressure public reasoning now distinguishes evidence pressure, script context, persona handling, table timing, and visible role-claim pressure.
2. UI polish: future recap cards can show which public role claim triggered pressure without revealing hidden role truth.
3. Rules: no rule behavior changed; this is visible-claim dialogue texture and quality-gate coverage only.

## 2026-06-03 Follow-up: Public Timing Pressure Variants

This follow-up makes high-pressure multi-evidence public speech aware of table timing.

- Nomination-pressure speech can now say `提名前先把1号的身份和票型压实，不然上台只剩防守`.
- Vote-intent speech can now say `到投票我会看6号有没有补出解释，没补就按压力票处理`.
- Timing texture is public-safe and does not change nomination or vote rules.
- Cross-day stance lines remain higher priority, so timing texture is suppressed when it would overwrite yesterday/today continuity.
- Public priority compacting now reinserts evidence and follow-up priority fragments as complete sentences, avoiding clipped joins such as `要解释 1号解释票型`.
- The fixed AI quality set now adds deterministic nomination-pressure and vote-intent rows and gates `publicTimingPressureVariantCoverage`.
- Current fixed snapshot: 83 rows, `publicTimingPressureVariantCoverage = 1`, `publicScriptPressureVariantCoverage = 1`, `publicPersonaPressureVariantCoverage = 1`, `evidenceCitationRate = 0.904`, `repetitionRate = 0.285`, and `hiddenLeakCount = 0`.
- Unity StreamingAssets JS mirrors were synced for `ai_public_discussion.js` and `ai_quality_eval.mjs`.

Updated short-term baseline:

1. AI agent: high-pressure public reasoning now distinguishes evidence pressure, script context, persona handling, and table timing.
2. UI polish: future recap cards can show whether a line is pre-nomination pressure or vote-intent pressure.
3. Rules: no rule behavior changed; this is public dialogue texture and quality-gate coverage only.

## 2026-06-03 Follow-up: Public Script Pressure Variants

This follow-up gives BMR/SnV public multi-evidence pressure a script-aware public context instead of treating every script like TB.

- BMR high-pressure public multi-evidence speech can now say `BMR里死亡/保护会搅票型，先把6号口径对齐`.
- SnV high-pressure public multi-evidence speech can now say `SnV里身份线和疯狂压力要分开听，先看7号回应`.
- These lines are public-safe script context only; they do not reveal hidden role state or change script rules.
- Cross-day stance lines remain higher priority, so script texture is suppressed when it would overwrite yesterday/today continuity.
- The fixed AI quality set now gates `publicScriptPressureVariantCoverage` on the existing BMR/SnV public multi-evidence rows.
- Current fixed snapshot: 81 rows, `publicScriptPressureVariantCoverage = 1`, `publicPersonaPressureVariantCoverage = 1`, `crossScriptPublicMultiEvidenceCoverage = 1`, `evidenceCitationRate = 0.901`, `repetitionRate = 0.276`, and `hiddenLeakCount = 0`.
- Unity StreamingAssets JS mirrors were synced for `ai_public_discussion.js` and `ai_quality_eval.mjs`.

Updated short-term baseline:

1. AI agent: BMR/SnV public pressure now has a measurable script-context floor, not just generic identity/vote evidence wording.
2. UI polish: future recap cards can display script-context hints alongside evidence compression.
3. Rules: no rule behavior changed; this is public dialogue texture and quality-gate coverage only.

## 2026-06-03 Follow-up: Public Persona Pressure Variants

This follow-up makes high-pressure public multi-evidence speech differ by persona instead of only changing the opener.

- Public discussion now adds a persona-specific multi-evidence pressure bridge when a living AI has at least two public evidence rows and high focus pressure.
- Pressure persona can say `这不是单点感觉，我会先压9号，别拖到票前才解释`.
- Shadow persona can say `这不是单点感觉，我先暗记9号这条主线，看回应有没有再绕`.
- Steady persona can say `这不是单点感觉，我不锁死2号，但解释要落到桌面`.
- Cross-day stance lines remain higher priority than persona texture, so this bridge is suppressed when it would overwrite `昨天也盯...` / `今天转...` continuity.
- The fixed AI quality set now adds deterministic pressure/shadow/steady public rows and gates `publicPersonaPressureVariantCoverage`.
- Current fixed snapshot: 81 rows, `publicPersonaPressureVariantCoverage = 1`, `publicPressureTextureCoverage = 1`, `crossDayStanceContinuityCoverage = 0.857`, `evidenceCitationRate = 0.901`, `repetitionRate = 0.303`, and `hiddenLeakCount = 0`.
- Unity StreamingAssets JS mirrors were synced for `ai_public_discussion.js` and `ai_quality_eval.mjs`.

Updated short-term baseline:

1. AI agent: high-pressure multi-evidence public speech now has measurable persona-specific handling, not just a generic evidence report.
2. UI polish: future recap cards can show whether an AI is directly pressing, cautiously watching, or asking for a grounded explanation.
3. Rules: no rule behavior changed; this is public dialogue texture and quality-gate coverage only.

## 2026-06-03 Follow-up: Evil Claim-Cover Long Deception Arc

This follow-up combines the previously separate evil claim-cover behaviors into one longer public deception arc.

- Evil public claim-cover wording now preserves explicit cross-day identity-line language even when the same speech is also doing a target pivot or ally-protection pressure split, e.g. `昨天身份线我不改，今天压力可以分散，公开身份仍按调查员这条说`.
- The fixed AI quality set now adds a deterministic long deception-arc row and gates `evilPublicClaimCoverDeceptionArcCoverage`.
- The fixture first generates a public claimed-role line, then a same-claim target pivot line, then a day-two pressure-splitting line; the final row stores the prior generated arc lines so the gate proves the pivot actually happened.
- Current fixed snapshot: 78 rows, `evilPublicClaimCoverDeceptionArcCoverage = 1`, `evilPublicClaimCoverCrossDayCoverage = 1`, `evilPublicClaimCoverProtectAllyCoverage = 1`, `evilPublicClaimCoverPivotCoverage = 1`, `evidenceCitationRate = 0.897`, `repetitionRate = 0.250`, and `hiddenLeakCount = 0`.
- Unity StreamingAssets JS mirrors were synced for `ai_public_discussion.js` and `ai_quality_eval.mjs`.

Updated short-term baseline:

1. AI agent: evil public deception now has a measured multi-step arc, not only isolated single-turn identity maintenance, pivot, protect-ally, or cross-day samples.
2. UI polish: future recap cards can label "identity line held while target and pressure changed" as one coherent public-facing deception trajectory.
3. Rules: no rule behavior changed; this is public dialogue quality, continuity reasoning, and hidden-leak safety only.

## 2026-06-03 Follow-up: Evil Claim-Cover Cross-Day Arc

This follow-up extends public identity-line deception across days instead of only within the same public discussion window.

- Evil public claim-cover wording now detects when the visible public claim came from a prior day and uses a cross-day continuity fragment, e.g. `昨天身份线我不改，公开身份仍按调查员这条说，今天继续看信息口径和票型`.
- The fixed AI quality set now adds a deterministic evil public claim-cover cross-day row and gates `evilPublicClaimCoverCrossDayCoverage`.
- The gate requires one day-two public speech to preserve the named pressure target, visible claimed role, cross-day identity-line wording, table-safe cover markers, and zero hidden evil leak terms.
- Current fixed snapshot: 77 rows, `evilPublicClaimCoverCrossDayCoverage = 1`, `evilPublicClaimCoverProtectAllyCoverage = 1`, `evilPublicClaimCoverPivotCoverage = 1`, `evilPublicClaimCoverContinuityCoverage = 1`, `evidenceCitationRate = 0.896`, `repetitionRate = 0.243`, and `hiddenLeakCount = 0`.
- Unity StreamingAssets JS mirrors were synced for `ai_public_discussion.js` and `ai_quality_eval.mjs`.

Updated short-term baseline:

1. AI agent: evil public deception now has a measurable cross-day identity-line floor, so the AI can maintain yesterday's public claimed role while continuing today's pressure.
2. UI polish: future recap cards can surface "same public identity line across days" as a player-visible consistency pattern.
3. Rules: no rule behavior changed; this is public dialogue quality and hidden-leak safety only.

## 2026-06-02 Follow-up: Claim Disclosure Rationale

This follow-up closes another AI decision-explanation gap: why an agent chooses to hard-claim, give only a role/info range, withhold, or continue an existing identity line.

- `claimDisclosurePlanner(...)` now returns a structured `claimDisclosureRationale` with disclosure level, previous level, reason key, pressure/trust/self-heat scores, range metadata, and a rendered-text `spokenLine`.
- Public disclosure rationale is leak-safe by construction: non-hard public range/vague/withhold decisions do not expose exact `roleId` or `roleName`; hard claims and already-public claims may expose the visible claimed role.
- Public discussion, private claim answers, and proactive private info-sharing now carry `claimDisclosureRationale` through speech events, timeline rows, and utterance metadata.
- Unity timeline viewmodel exports `claimDisclosureRationale`, and `rationaleSummary` can now show identity-disclosure reasoning alongside target-choice reasoning.
- The fixed AI quality evaluation now includes a claim prompt and tracks `claimDisclosureRationaleCoverage`, so identity-disclosure explanations are measured separately from target, nomination, and vote rationale.

Updated short-term baseline:

1. AI agent: public claim-disclosure decisions are no longer absent; next AI focus is multi-day stance/claim-history continuity, BMR/SnV disclosure edge cases, and evil-side cover consistency under pressure.
2. UI polish: claim-disclosure rationale can now be rendered as timeline chips or identity-disclosure cards instead of remaining raw metadata.
3. Rules: script-specific disclosure constraints now have a fixed floor for madness pressure, outsider risk, Mutant, Sweetheart, Barber, and death-trigger timing; future work should extend this to other sharp edges.

## 2026-06-02 Follow-up: Public Pressure Texture

This follow-up raises the floor for high-pressure public speech without changing target selection, rules, or hidden-information boundaries.

- High-pressure public discussion now forces a light emotional-texture pass before the public line exits the cadence renderer.
- Generic public bridge starters such as `我的意思是` are stripped in strong-pressure contexts, so pressure lines can surface markers like `说实话`, `我直说`, or `我有点在意`.
- Public persona priority fragments now choose pressure-safe emotional prefixes under high pressure, including steady, pressure, and shadow personas.
- The fixed AI quality evaluation now gates `publicPressureTextureCoverage`; the current fixed snapshot keeps both `publicPrioritySignalCoverage = 1` and `publicPressureTextureCoverage = 1`.
- Unity StreamingAssets JS mirrors were synced for the renderer, public discussion, and AI quality evaluation scripts.

Updated short-term baseline:

1. AI agent: high-pressure public speech now has a measurable emotional-texture floor; next language work should focus on long-game deception, richer multi-evidence compression, and persona-specific pressure variants.
2. UI polish: public dialogue cards can eventually expose pressure texture through visual emphasis or tone chips, but the data/rendering floor is now in JS Core.
3. Rules: no rule behavior changed; this is a language-quality and evaluation-contract improvement only.

## 2026-06-02 Follow-up: Evil Public Cover Texture

This follow-up turns evil-side public performance wording from a one-off contract into a fixed quality gate.

- Evil public discussion now includes a cover-safe priority fragment in the final speech-budget pass, preserving markers such as `台面上`, `公开说`, `好人视角`, `节奏`, `解围`, or `闭眼冲` when the line is trimmed.
- The speech-budget coverage check now normalizes `…` and `...`, preventing duplicate evidence fragments caused by punctuation variants.
- The fixed AI quality evaluation now adds a deterministic evil public cover sample and gates `evilPublicCoverTextureCoverage`.
- Evil public discussion now surfaces public-safe `evilWorldPlanContextLine` only when the same AI has already shown the same public focus, so a second turn can say `还是沿着 ... 这条看，不急着换线` without exposing hidden evil intent.
- The fixed AI quality evaluation now adds a deterministic evil cover maintenance sample and gates `evilPublicCoverMaintenanceCoverage`.
- Evil public discussion can now recover a recent `soft-pivot` from evil plan history before it is collapsed by repeated context rebuilds, so a first visible statement on the new target can say `这轮先转到 ...，因为台面压力有了新变化`.
- The fixed AI quality evaluation now adds a deterministic evil cover pivot sample and gates `evilPublicCoverPivotCoverage`.
- Evil public discussion now gives `protect-ally` mode a public-safe deflection line, e.g. `台面压力别只堆一处，先把 ... 也拉出来对话`, without naming the protected ally or exposing evil-only intent.
- The fixed AI quality evaluation now adds a deterministic evil protect-ally sample and gates `evilPublicProtectAllyCoverage`.
- Public speech budget now dedupes repeated follow-up cues, so lines do not keep both `接下来先问 X：身份和昨晚信息` and `让 X 把身份和昨晚信息说清楚`.
- The fixed AI quality evaluation now gates `publicFollowUpDedupCoverage`, `publicFollowUpTemplateDisciplineCoverage`, `publicFollowUpSpecificityCoverage`, `publicEvidenceFragmentClarityCoverage`, `nonPublicEvidenceFragmentClarityCoverage`, `publicSurfacePolishCoverage`, `publicSentenceClosureCoverage`, and `publicGenericOpenerDisciplineCoverage`.
- Current fixed snapshot: 27 rows, `publicPrioritySignalCoverage = 1`, `publicFollowUpDedupCoverage = 1`, `publicFollowUpTemplateDisciplineCoverage = 1`, `publicFollowUpSpecificityCoverage = 1`, `publicEvidenceFragmentClarityCoverage = 1`, `nonPublicEvidenceFragmentClarityCoverage = 1`, `publicSurfacePolishCoverage = 1`, `publicSentenceClosureCoverage = 1`, `publicGenericOpenerDisciplineCoverage = 1`, `publicPressureTextureCoverage = 1`, `evilPublicCoverTextureCoverage = 1`, `evilPublicCoverMaintenanceCoverage = 1`, `evilPublicCoverPivotCoverage = 1`, `evilPublicProtectAllyCoverage = 1`, and `hiddenLeakCount = 0`.
- Unity StreamingAssets JS mirrors were synced for the renderer, public discussion, and AI quality evaluation scripts.

Updated short-term baseline:

1. AI agent: evil public speech now has measurable outward-facing cover, same-focus maintenance, public-safe pivot, and ally-protection deflection floors; next work should deepen longer deception arcs and richer persona-specific pressure variants without leaking evil-only state.
2. UI polish: future AI recap cards can distinguish public-safe cover rationale from hidden evil intent, but no UI contract changed in this pass.
3. Rules: no rule behavior changed; this only preserves language texture and strengthens quality evaluation.

## 2026-06-02 Follow-up: Unity Vote Rationale Cards

This follow-up turns the formal-vote rationale contract from exported data into visible Unity vote ceremony UI.

- Unity vote ceremony now renders a bottom-left current-voter rationale card and a bottom-right revealed-rationale history card.
- The rationale history only reads voters already reached by the ceremony animation via `Take(asked)`, so future voter explanations are not shown before that voter is asked.
- The `vote-ceremony` UI smoke fixture now injects public-safe sample `voteRationale` lines, so screenshots exercise the new cards instead of only the boolean vote path.
- Root and Unity embedded `unity_ui_smoke_fixture.mjs` copies were kept in sync.
- Validation passed: `npm run test:unity-viewmodel`, `npm run test:unity-assets`, Unity batch build, and `vote-ceremony` smoke captures at 1920x1080, 1600x900, and 1366x768.

Updated short-term baseline:

1. UI polish: formal vote explanations are now player-visible during the vote ceremony, not only available as raw viewmodel metadata.
2. AI agent: current `voteRationale.line` variants can be inspected in the live ceremony without waiting for a separate recap panel.
3. Visual regression: vote ceremony now has fresh 1920x1080, 1600x900, and 1366x768 smoke artifacts for the rationale-card layout.

## 2026-06-03 UI Completion Snapshot

Current Unity UI completion status after the June 3 polish passes:

- Completed / visually verified: vote rationale cards, Private Chat rationale rails, AI Recap signal chips, AI Recap suspect snapshot/trail selection, AI Recap score-trail paging/row expansion/timeline-anchor jump, Stage Dialogue context rail, Token Inspector signal chips, More Actions signal chips/route strip, Action Form readiness signals, Storyteller queue pagination/signals, Role Picker pagination/signals, and Script Handbook mental-model signals.
- Regression coverage now exists for the main polished surfaces at 1920x1080, 1600x900, and 1366x768: private chat, recap, stage dialogue, token inspector, more actions, action forms, storyteller queue, role picker, and script handbook. A new visual verifier can now enforce requested smoke state/viewport coverage, report foreground edge-density cropping risk, and optionally compare against a baseline screenshot directory.
- Contract coverage now guards the recurring signal-strip pattern across player-facing modal/tool surfaces, so future UI edits have string-level checks for the added roots, render helpers, label helpers, and smoke fixture mappings.
- Still open: AI Recap may still need deeper per-evidence source jumps after playtest, vote/public/private dialogue still need more ceremony and stage polish, and any full official script-sheet tab remains separate from the current Handbook order-reference panel. The visual verifier still needed an accepted full-state baseline at this snapshot.

Practical next UI direction:

1. Establish an accepted full-state smoke baseline and run the new visual verifier across the broad modal/state matrix, not only the current recap subset. Completed in the 2026-06-04 follow-up below.
2. Add more ceremony to vote/public/private dialogue after the high-density tool surfaces have stable scan paths.
3. Revisit AI Recap only for deeper per-evidence drillthrough once playtest feedback proves the timeline-anchor jump is not enough.

## 2026-06-03 Follow-up: Unity Private Chat Rationale Rails

This follow-up extends the previous rationale UI work from public/vote surfaces into the high-frequency private-chat panel.

- Unity private-chat bubbles now include an intent label beside speaker/timestamp metadata.
- Each private-chat bubble can render a compact context rail for `rationaleSummary`, `claimDisclosureRationale`, `evidenceSummary`, or `questionToAsk`, with the private claim-continuity line taking priority when present.
- Bubble height now accounts for the context rail, preserving the existing scrollable thread behavior instead of overlapping the main utterance text.
- Unity viewmodel now preserves a raw `rationaleSummary` fallback when no structured rationale object exists, so private-only reasoning summaries can still reach the chat rail.
- The `private-chat-long` UI smoke fixture now injects claim continuity, evidence, question, and rationale sample metadata, and the root/Unity embedded fixture copies were kept in sync.
- A Unity asset contract now guards the private-chat rationale/context renderer and intent-label hook.
- Validation passed: `node --check` for both fixture copies and the asset contract, `npm run test:unity-viewmodel`, `npm run test:unity-assets`, Unity batch build, and `private-chat-long` smoke captures at 1920x1080, 1600x900, and 1366x768.

Updated short-term baseline:

1. UI polish: private AI reasoning and identity-continuity context is now visible directly inside the chat thread, not only in the info drawer or later recap views.
2. AI agent: private `claimDisclosureRationale` and `rationaleSummary` fields now have an immediate player-facing surface during private conversation review.
3. Visual regression: private chat now has fresh 1920x1080, 1600x900, and 1366x768 smoke artifacts covering the context-rail layout.

## 2026-06-03 Follow-up: Unity AI Recap Signal Chips

This follow-up continues the AI recap polish by reducing dense reasoning text into scannable per-track signals.

- Unity reasoning recap cards now render compact signal chips for latest score, score movement, focus-vs-runner-up evidence count, and confidence band.
- The card still preserves the latest reasoning summary, while the bottom row is now fixed-width chip UI instead of a long history/evidence sentence.
- The `recap` UI smoke fixture now injects deterministic public reasoning timeline entries, evidence rows, and belief-trail deltas, so the screenshot path exercises `aiReasoningRecap`, `scoreTrail`, and the new chip row.
- Root and Unity embedded `unity_ui_smoke_fixture.mjs` copies were kept in sync.
- A Unity asset contract now guards the reasoning recap signal-chip renderer.
- Validation passed: fixture `node --check`, `npm run test:unity-viewmodel`, `npm run test:unity-assets`, Unity batch build, and `recap` smoke captures at 1920x1080, 1600x900, and 1366x768.

Updated short-term baseline:

1. UI polish: AI recap is a step less text-dense; a player can scan score, movement, evidence shape, and confidence without parsing a long metadata line.
2. AI agent: deterministic recap smoke now proves reasoning recap data is player-visible, not only exported by the viewmodel.
3. Visual regression: recap now has fresh 1920x1080, 1600x900, and 1366x768 smoke artifacts covering the signal-chip layout.

## 2026-06-03 Follow-up: Unity Stage Dialogue Context Rail

This follow-up continues the high-frequency dialogue polish by making the bottom stage dialogue easier to scan during public, private, storyteller, and queued speech playback.

- Unity stage dialogue now reserves a compact right-side context rail beside the dialogue body.
- The rail renders source, focus, and progress chips derived from existing dialogue state: `stageDialogueSourceMode`, speaker/target ids, current page, queued count, typing state, and pending transition state.
- The dialogue body width was tightened to avoid overlap with the rail while preserving the existing page wrapping and typewriter flow.
- A Unity asset contract now guards the stage-dialogue context rail, chip renderer, and focus/progress/source helper labels.
- Validation passed: `npm run test:unity-viewmodel`, `npm run test:unity-assets`, Unity batch build, and `stage-dialogue` plus `stage-dialogue-queued` smoke captures at 1920x1080, 1600x900, and 1366x768.

Updated short-term baseline:

1. UI polish: the bottom dialogue stage now surfaces source, focus, and queue progress as visual chips instead of burying them in tag/meta text.
2. Interaction clarity: queued public/stage dialogue is easier to read before pressing continue because the player can see where the line came from and how much remains.
3. Visual regression: stage dialogue now has fresh single-line and queued smoke artifacts across 1920x1080, 1600x900, and 1366x768.

## 2026-06-03 Follow-up: Unity Token Inspector Signal Chips

This follow-up closes the token inspector item from the UI issue list by making the selected-token detail panel scannable before the player reads the longer guidance line.

- Unity token inspector now renders a compact header signal strip for seat, viewpoint, identity/mark state, and recommended next action.
- The existing role token, four meta cards, guidance badge, and quick-action tray remain intact; the new strip gives a top-level scan path for dense marked-role/reminder targets.
- The `token-inspector` UI smoke fixture now uses a rich target instead of the plain role-picker fixture: marked `undertaker`, five reminder chips, and an 84% pressure card generated through the normal AI insight path.
- Root and Unity embedded `unity_ui_smoke_fixture.mjs` copies were kept in sync.
- A Unity asset contract now guards the signal strip, signal-chip helper labels, recommended-action highlight, and rich token-inspector smoke fixture.
- Validation passed: fixture `node --check`, `npm run test:unity-viewmodel`, `npm run test:unity-assets`, Unity batch build, fixture export sanity check, and `token-inspector` smoke captures at 1920x1080, 1600x900, and 1366x768.

Updated short-term baseline:

1. UI polish: token inspector is no longer only a debug-style text panel; selected-token state has a header scan path plus card details and highlighted recommended action.
2. Interaction clarity: marked roles, reminders, pressure, and suggested action can be validated visually in one inspector smoke state.
3. Visual regression: token inspector now has fresh 1920x1080, 1600x900, and 1366x768 smoke artifacts covering a dense selected-token layout.

## 2026-06-03 Follow-up: Unity More Actions Signal Chips

This follow-up reduces the More actions drawer's text-button feel without changing any action routing.

- Unity More actions now renders a compact signal strip for phase, selected target, recommended tool count, and current public/all-knowing view.
- The existing 4x4 tool tile grid, section rails, and suggested-tile glow remain intact; the new strip gives the drawer a quick context scan before the player reads the recommendation sentence.
- The `more-actions` UI smoke fixture now reuses the rich selected-target fixture, so screenshots cover a marked role, reminders, high-pressure target, and suggested tool highlights instead of a plain selection.
- Root and Unity embedded `unity_ui_smoke_fixture.mjs` copies were kept in sync.
- A Unity asset contract now guards the More actions signal strip, phase/target/recommendation/view helper labels, suggested-tile glow, and rich smoke fixture mapping.
- Validation passed: fixture `node --check`, `npm run test:unity-viewmodel`, `npm run test:unity-assets`, Unity batch build, fixture export sanity check, and `more-actions` smoke captures at 1920x1080, 1600x900, and 1366x768.

Updated short-term baseline:

1. UI polish: More actions now has a scannable context layer above the tool grid, reducing dependence on two long text lines.
2. Interaction clarity: recommended tools are visible both as highlighted tiles and as a compact count chip tied to the current target/phase.
3. Visual regression: More actions now has fresh 1920x1080, 1600x900, and 1366x768 smoke artifacts covering the rich selected-target layout.

## 2026-06-03 Follow-up: Unity Action Form Readiness Signals

This follow-up continues the complex-action polish by making the action form's requirements and submit readiness visible before the player reads the full prompt.

- Unity action forms now render a compact signal strip for role/action source, input type, requirement, current progress, and submit readiness.
- The existing checklist, multi-guess builder, guess rows, and submit disabled state remain intact; the new strip gives a top-level scan path for complex actions such as `guesses`.
- The submit button continues to be driven by `CanSubmitActionForm(...)`, including disabled visual state and contextual labels such as waiting for guesses, targets, roles, or question text.
- A Unity asset contract now guards the action-form signal strip, role/progress/submit helper labels, disabled-submit path, multi-guess builder, and `guesses[]` submit payload.
- Validation passed: fixture `node --check`, `npm run test:unity-viewmodel`, `npm run test:unity-assets`, Unity batch build, fixture export sanity check, and `action-form-guesses` smoke captures at 1920x1080, 1600x900, and 1366x768.

Updated short-term baseline:

1. UI polish: complex action forms now expose role, input kind, requirement, progress, and submit status as chips instead of relying only on prompt text and checklist rows.
2. Interaction clarity: invalid submit states are visible in both the disabled button and the readiness chip, reducing repeated invalid clicks.
3. Visual regression: action-form guesses now has fresh 1920x1080, 1600x900, and 1366x768 smoke artifacts covering the dense multi-guess layout.

## 2026-06-03 Follow-up: Unity Storyteller Queue Signals

This follow-up closes the highest-priority Storyteller queue readability item without changing queue processing order or action routing.

- Unity Storyteller queue now renders a compact signal strip for queue count, current page, queue-head role, input type, and target/option readiness.
- The existing queue pagination remains intact: page 1 still emphasizes the current FIFO action, and page 2 remains browse-only while the queue-head priority note stays visible.
- The queue and current-action panels were nudged down to reserve fixed space for the signal strip instead of overlaying chips on top of queue cards.
- A Unity asset contract now guards the Storyteller signal strip, helper labels, and existing `storyteller-queue-page2` smoke coverage.
- Validation passed: `node --check tests/unity_asset_contracts.mjs`, `npm run test:unity-assets`, `npm run test:unity-viewmodel`, fixture `node --check`, Unity batch build, and `storyteller-queue` / `storyteller-queue-page2` smoke captures at 1920x1080, 1600x900, and 1366x768 in `output/unity-ui-smoke-storyteller-signals-2026-06-03`.

Updated short-term baseline:

1. UI polish: Storyteller queue status is now scannable before reading the queue body or card details.
2. Interaction clarity: players can distinguish queue count, page position, queue-head action, required input, and target options without losing the FIFO/pagination mental model.
3. Visual regression: Storyteller queue now has fresh page-1 and page-2 smoke artifacts across 1920x1080, 1600x900, and 1366x768.

## 2026-06-03 Follow-up: Unity Role Picker Paging Signals

This follow-up turns the Role Picker pagination work into a more inspectable UI state for large or custom role pools.

- Unity Role Picker now renders a compact bottom signal strip for picker mode, active category/filter count, current page/range, and current selection.
- The signal strip lives outside the role-token grid, preserving the existing 10-column role layout, category tabs, bottom action strip, and clear/no-claim token behavior.
- The existing large-role-pool pagination remains intact through `RolePickerPageSize`, `ChangeRolePickerPage(...)`, and the `role-picker-paged` smoke fixture.
- A Unity asset contract now guards the Role Picker signal strip, helper labels, and paged smoke fixture mapping.
- Validation passed: `node --check tests/unity_asset_contracts.mjs`, `npm run test:unity-assets`, `npm run test:unity-viewmodel`, fixture `node --check`, Unity batch build, and `role-picker` / `role-picker-paged` smoke captures at 1920x1080, 1600x900, and 1366x768 in `output/unity-ui-smoke-role-picker-signals-2026-06-03`.

Updated short-term baseline:

1. UI polish: Role Picker pagination is now paired with a persistent scan path for mode, filter, page, and selected role.
2. Interaction clarity: expanded/custom role pools are easier to inspect because the page/range and current selection remain visible even when many role tokens are shown.
3. Visual regression: Role Picker now has fresh normal and paged smoke artifacts across 1920x1080, 1600x900, and 1366x768.

## 2026-06-03 Follow-up: Unity AI Recap Score Trail Paging

This follow-up deepens the AI recap polish from signal chips into a more usable reasoning-trail drilldown.

- Unity AI recap score-trail drilldown now pages through `scoreTrail` points with a fixed `ReasoningScoreTrailPageSize` instead of showing only a fixed first slice.
- Switching reasoning tracks resets the score-trail page, while the recap smoke mode `recap-trail-page2` can open the second trail page directly for visual regression.
- The `recap` smoke fixture now produces more than one page of reasoning score points, so the pager is exercised by real viewmodel data instead of a static UI-only state.
- A Unity asset contract now guards score-trail paging, the page-2 smoke fixture, and the removal of the fixed `.Take(3)` drilldown path.
- Validation passed: fixture `node --check`, `npm run test:unity-assets`, `npm run test:unity-viewmodel`, Unity batch build, and `recap` / `recap-trail-page2` smoke captures at 1920x1080, 1600x900, and 1366x768 in `output/unity-ui-smoke-recap-trail-paging-2026-06-03`.

Updated short-term baseline:

1. UI polish: AI recap now exposes additional reasoning score points through paging instead of hiding all but the first visible rows.
2. Interaction clarity: players can inspect how a target stayed, rose, or narrowed across multiple public-reasoning turns without parsing raw metadata.
3. Visual regression: AI recap now has fresh first-page and score-trail-page-2 smoke artifacts across 1920x1080, 1600x900, and 1366x768.

## 2026-06-03 Follow-up: Unity AI Recap Suspect Snapshot

This follow-up moves issue #12 from raw reasoning density toward a player-facing suspect-card scan path.

- Unity AI Recap now renders a `Suspect Snapshot` panel immediately below the recap summary, before the dense reasoning card and score-trail drilldown.
- The snapshot aggregates `aiRecapDetails` targets and `aiReasoningRecap` tracks into up to three compact suspect cards, sorted by score and evidence count.
- Each suspect card exposes a score ring/badge plus evidence, trail, and delta chips, so players can scan pressure lanes before reading the selected reasoning track.
- The existing reasoning-card selector and paged `scoreTrail` drilldown remain below the snapshot; `recap-trail-page2` still opens the second trail page for visual regression.
- A Unity asset contract now guards the suspect snapshot, suspect cards, evidence/trail/delta chips, aggregation helper, and existing recap smoke fixture mapping.
- Validation passed: fixture `node --check`, `npm run test:unity-assets`, `npm run test:unity-viewmodel`, Unity batch build, and `recap` / `recap-trail-page2` smoke captures at 1920x1080, 1600x900, and 1366x768 in `output/unity-ui-smoke-recap-suspect-snapshot-2026-06-03`.

Updated short-term baseline:

1. UI polish: AI recap now starts with suspect cards instead of forcing players directly into long metadata and score-trail rows.
2. Interaction clarity: score, evidence count, trail depth, and latest movement are visible per suspect lane before reading the detailed reasoning card.
3. Visual regression: AI recap now has fresh suspect snapshot and trail-page-2 smoke artifacts across 1920x1080, 1600x900, and 1366x768.

## 2026-06-03 Follow-up: Unity AI Recap Suspect Trail Selection

This follow-up turns the suspect snapshot from a passive scan strip into a selectable trail controller.

- Unity AI Recap suspect cards now act as lightweight buttons when a matching `aiReasoningRecap` track exists.
- Selecting a suspect card switches `activeReasoningRecapIndex`, resets the score-trail page, and reopens the recap drawer on the matching reasoning trail.
- The open suspect lane now has a selected glow/frame and an `open` trail-state marker, while other lanes remain visible for comparison.
- The recap smoke fixture now creates multiple suspect reasoning tracks, and the new `recap-suspect2` Unity smoke state opens the second suspect trail directly.
- Unity asset contracts now guard suspect-card selection, page reset, selected visual state, the multi-track smoke fixture, and `recap-suspect2` mode.
- Validation passed: fixture `node --check`, `npm run test:unity-assets`, `npm run test:unity-viewmodel`, Unity batch build, and `recap` / `recap-suspect2` / `recap-trail-page2` smoke captures at 1920x1080, 1600x900, and 1366x768 in `output/unity-ui-smoke-recap-suspect-select-2026-06-03`.

Updated short-term baseline:

1. UI polish: suspect cards now connect directly to the detailed reasoning trail instead of only sitting above it as a summary.
2. Interaction clarity: players can scan suspects, open a lane, and see the matching score-trail card update with selected-track context.
3. Visual regression: AI recap now has fresh default, second-suspect, and trail-page-2 smoke artifacts across 1920x1080, 1600x900, and 1366x768.

## 2026-06-03 Follow-up: Unity Script Handbook Mental Model Signals

This follow-up clarifies the current Script Handbook behavior without changing role data, information-drawer routing, or official-order content.

- Unity Script Handbook now renders a compact bottom signal strip for atlas primacy, active script, category/filter count, first/other-night order counts, and notes-drawer context.
- The role atlas remains the primary modal surface; the official night order remains a right-side reference panel; the information drawer remains the notes/player-info entry point.
- The signal strip lives below the role grid and detail panes, preserving the existing category tabs, role pagination, right-side role detail, order reference, and close button placement.
- A Unity asset contract now guards the Handbook signal strip, helper label derivation, mode chips, notes drawer handoff, order reference panel, and `script-handbook` smoke coverage.
- Validation passed: fixture `node --check`, `npm run test:unity-assets`, `npm run test:unity-viewmodel`, Unity batch build, and `script-handbook` smoke captures at 1920x1080, 1600x900, and 1366x768 in `output/unity-ui-smoke-handbook-signals-2026-06-03`.

Updated short-term baseline:

1. UI polish: Script Handbook now tells players which surface they are using before they parse the role grid or right-side reference block.
2. Interaction clarity: atlas, script scope, filter scope, order reference, and notes drawer no longer compete silently inside one modal.
3. Visual regression: Script Handbook now has fresh smoke artifacts across 1920x1080, 1600x900, and 1366x768.

## 2026-06-03 Follow-up: Unity AI Recap Full ScoreTrail Export

This follow-up improves the AI reasoning recap data path before adding more visual drilldown.

- Unity viewmodel now preserves every current-day, human-visible `scoreTrail` point for each `aiReasoningRecap` speaker/focus track instead of truncating the export to four points.
- The existing Unity pager can now page across the full reasoning arc produced by the JS core, so long-running pressure, hold, shift, and target-vs-runner-up comparisons are no longer discarded before the UI can inspect them.
- A new Unity viewmodel contract builds a six-point reasoning arc and requires all six points to remain in newest-to-oldest order with score delta, evidence count, and comparison-trace metadata intact.
- Root and Unity embedded `unity_viewmodel.js` copies were kept in sync.
- Validation passed: `node --check scripts/unity_viewmodel.js`, `node --check tests/unity_viewmodel_contracts.mjs`, `npm run test:unity-viewmodel`, `npm run test:unity-assets`, and root/Unity embedded `unity_viewmodel.js` sync diff.

Updated short-term baseline:

1. AI agent: long-arc reasoning is now exportable as a full recap trail rather than only a latest-four snapshot.
2. UI polish: the existing score-trail pager has enough data to support richer second/third-page reasoning review.
3. Next drilldown work should focus on expandable point details, source timeline jumps, and cross-day stance badges rather than basic trail preservation.

## 2026-06-03 Follow-up: Unity AI Recap ScoreTrail Row Context

This follow-up makes the full exported score trail more readable inside the existing Unity drilldown card.

- Unity score-trail rows now include source timeline anchors from `timelineIndex`, `timelineEntryId`, and `timelineText`, so a player can connect a score movement back to the visible utterance that caused it.
- Each row also surfaces cross-day stance or claim-disclosure continuity context, prioritizing `crossDayStance.summary` before claim-continuity summaries and lines.
- The row body now combines comparison, source utterance, continuity, and leading evidence text instead of only showing target-vs-runner-up comparison plus the first evidence row.
- Unity asset contracts now guard `ReasoningTimelineAnchorLine(...)`, `ReasoningContinuityLine(...)`, and the current suspect snapshot / reasoning drilldown relationship.
- Validation passed: full `npm test`, `npm run test:unity-assets`, `npm run test:unity-viewmodel`, `git diff --check`, and `node scripts\ai_quality_eval.mjs`; latest fixed AI quality snapshot remains 100 rows with `hiddenLeakCount = 0`, `evidenceCitationRate = 0.920`, and `repetitionRate = 0.291`.

Updated short-term baseline:

1. AI agent: reasoning changes are now easier to audit at the exact score-point level, not only at the track summary level.
2. UI polish: Recap rows carry the cause, continuity arc, comparison, and evidence in one scan path.
3. Next work can move from row-level context toward interactive expansion and direct timeline/source jumps.

## 2026-06-03 Follow-up: Unity AI Recap Cross-Day Anchor Preservation

This follow-up keeps the deeper cross-day reasoning anchors alive after JS-to-Unity serialization.

- Unity C# now deserializes `CrossDayEvidenceAnchorViewModel`, `CrossDayEventAnchorViewModel`, and `CrossDayScoreTrailAnchorViewModel` instead of only keeping the cross-day stance summary and score fields.
- `CrossDayStanceViewModel` now preserves previous/current evidence anchors, event anchors, score-trail anchors, evidence snippets, evidence delta, and change summary.
- The score-trail row continuity display now adds a compact `anchors:` segment from current event, score, and evidence anchors, so a player can see which source event and score movement support the cross-day read.
- Unity asset contracts now guard the C# DTO fields and `ReasoningCrossDayAnchorLine(...)` display path.
- Validation passed: full `npm test`, `npm run test:unity-assets`, `npm run test:unity-viewmodel`, and `node scripts\ai_quality_eval.mjs`; latest fixed AI quality snapshot remains 100 rows with `hiddenLeakCount = 0`, `evidenceCitationRate = 0.920`, and `repetitionRate = 0.287`.

Updated short-term baseline:

1. AI agent: cross-day stance is no longer just a summary at Unity display time; its source anchors survive into the UI model.
2. UI polish: score-trail rows can now point to the concrete event, score trail, and evidence anchor behind a cross-day shift/hold.
3. Next work should turn these preserved anchors into explicit expandable rows or timeline navigation.

## 2026-06-03 Follow-up: Unity Timeline Rationale Card Recap

This follow-up carries nomination rationale cards into the lightweight timeline recap path.

- Unity timeline entries already export `rationaleCards` from `decisionRationale` and `strategyRationale`; Info Drawer rows now surface those cards instead of hiding them behind the active nomination debate panel.
- `InfoTimelineRationaleCardsLine(...)` compresses up to three cards into a `cards:` segment, using title/kind/id plus summary/detail/reason metadata.
- Timeline rows with both `rationaleSummary` and `rationaleCards` now show both; rows with cards but no summary still show the card recap before falling back to raw text.
- Unity asset contracts now guard the helper, `entry.rationaleCards`, and the `cards:` display path.
- Validation passed: full `npm test`, `npm run test:unity-assets`, `npm run test:unity-viewmodel`, `git diff --check`, and `node scripts\ai_quality_eval.mjs`; latest fixed AI quality snapshot remains 100 rows with `hiddenLeakCount = 0`, `evidenceCitationRate = 0.920`, and `repetitionRate = 0.287`.

Updated short-term baseline:

1. AI agent: structured nomination reasoning is now visible during later timeline review, not only while the debate panel is open.
2. UI polish: timeline rows can summarize target-choice, strategy, and verification cards in one compact scan path.
3. Next work should expand these card summaries into dedicated recap drilldowns with evidence snippets and target-vs-runner-up traces.

## 2026-06-03 Follow-up: Unity RationaleCard Raw Line Preservation

This follow-up preserves the deeper rationale-card fields that the JS core already exports.

- Unity C# `RationaleCardViewModel` now deserializes raw decision-rationale lines such as evidence mode, response plan, source reliability, timeline consistency, action threshold, memory continuity, falsification check, role hypothesis, and reconsideration.
- `RationaleCardRawLine(...)` provides a shared fallback for Info Drawer timeline recaps and active nomination rationale cards when compact `detail` text is missing.
- Timeline `cards:` summaries still stay compact, but they now have access to raw rationale lines for future expandable drilldown work.
- Unity asset contracts now guard raw rationale fields and the shared fallback path in both Info Drawer and nomination debate rendering.
- Validation passed: full `npm test`, `npm run test:unity-assets`, `npm run test:unity-viewmodel`, `git diff --check`, and `node scripts\ai_quality_eval.mjs`; latest fixed AI quality snapshot remains 100 rows with `hiddenLeakCount = 0`, `evidenceCitationRate = 0.920`, and `repetitionRate = 0.291`.

## 2026-06-03 Follow-up: Unity RationaleCard Sectioned Drilldown Text

This follow-up starts turning preserved rationale-card fields into visible card-level reasoning structure.

- Added shared `RationaleCardSectionLine(...)` and `RationaleCardHasVisibleText(...)` helpers so cards can be shown when they only contain raw reasoning fields, not just compact `summary` or `detail` text.
- Info Drawer timeline `cards:` recaps now preserve the old headline while appending compact sections such as `evidence`, `plan`, `check`, `role`, and `memory` when those raw fields exist.
- Active nomination rationale cards now use the same section text for card summary/detail fallback, making the small cards read like layered reasoning instead of one flattened sentence.
- Unity asset contracts now guard the section helper, timeline display helper, and nomination-card section calls.
- Validation passed: full `npm test`, `npm run test:unity-assets`, `npm run test:unity-viewmodel`, and `node scripts\ai_quality_eval.mjs`; latest fixed AI quality snapshot remains 100 rows with `hiddenLeakCount = 0`, `evidenceCitationRate = 0.920`, and `repetitionRate = 0.287`.

## 2026-06-03 Follow-up: Unity AI Recap Latest Decision Snapshot

This follow-up makes the selected AI reasoning track easier to audit before paging through individual score points.

- Added `AI Reasoning Latest Decision Snapshot` to the reasoning drilldown card, using the latest score point as a compact decision snapshot.
- The snapshot combines score/gap/evidence count, target-vs-runner-up comparison, source timeline anchor, continuity context, and the leading evidence row.
- Added `ReasoningLatestDecisionSnapshotLine(...)` and `ReasoningScorePointAuditLine(...)`, so the snapshot and paged score-trail rows reuse the same audit text path.
- `ReasoningScoreTrailPageSize` is now `2`, making room for the snapshot while preserving access to the full score trail through paging.
- Unity asset contracts now guard the snapshot helper, shared audit helper, and two-row score-trail page size.
- Validation passed: full `npm test`, `npm run test:unity-assets`, `npm run test:unity-viewmodel`, and `node scripts\ai_quality_eval.mjs`; latest fixed AI quality snapshot remains 100 rows with `hiddenLeakCount = 0`, `evidenceCitationRate = 0.920`, and `repetitionRate = 0.287`.

## 2026-06-03 Follow-up: Unity AI Recap Explicit Audit Sections

This follow-up makes the latest-decision snapshot more legible as a structured review artifact.

- Added `ReasoningScorePointAuditSections(...)` and `ReasoningAuditSection(...)` to label recap drilldown reasoning as explicit sections.
- Latest decision snapshots now expose `score`, `compare`, `source`, `continuity`, and `evidence` labels instead of one untyped audit sentence.
- Score-trail rows reuse the same section helper while avoiding duplicated score text in the body, so the row meta can carry score movement and the row body can keep comparison/source/continuity/evidence visible.
- Unity asset contracts now guard all five audit labels.
- Validation passed: full `npm test`, `npm run test:unity-assets`, `npm run test:unity-viewmodel`, and `node scripts\ai_quality_eval.mjs`; latest fixed AI quality snapshot is 100 rows with `hiddenLeakCount = 0`, `evidenceCitationRate = 0.920`, and `repetitionRate = 0.283`.

## 2026-06-03 Follow-up: Unity AI Recap Audit Section Chips

This follow-up turns the latest-decision snapshot from a long sectioned text line into compact UI chips.

- Added `AddReasoningLatestDecisionSnapshotChips(...)` and `AddReasoningAuditSectionChip(...)` to render `score`, `compare`, `source`, `continuity`, and `evidence` as small colored chips in the selected reasoning drilldown card.
- The chip values reuse the existing score, comparison, timeline anchor, continuity, and evidence-row helpers, so the visual row remains tied to the same reasoning audit path.
- Empty reasoning tracks now keep the area stable with a single `pending` chip instead of losing the snapshot affordance.
- Unity asset contracts now guard the chip row helper, chip rendering helper, and the five audit chip labels.
- Validation passed: full `npm test`, `npm run test:unity-assets`, `npm run test:unity-viewmodel`, and `node scripts\ai_quality_eval.mjs`; latest fixed AI quality snapshot is 100 rows with `hiddenLeakCount = 0`, `evidenceCitationRate = 0.920`, and `repetitionRate = 0.287`.

## 2026-06-03 Follow-up: Unity ScoreTrail Expanded Row Timeline Jump

This follow-up makes the selected score-trail point actionable instead of only readable.

- The reasoning drilldown now supports score-trail selector chips and an `AI Reasoning Score Trail Expanded Row`, allowing one score point on the current page to be inspected as the active point.
- The expanded row exposes a `TL` action that calls `JumpToReasoningScoreTrailTimeline(...)` and stores `activeInfoTimelineAnchorId` from `timelineEntryId` or `timelineIndex`.
- The timeline tab uses `TimelineEntryMatchesAnchor(...)` to pull the anchored entry into the recent timeline list and highlight it with `ANCHOR`, `TL`, and `Info Activity Row Timeline Anchor Glow`.
- Added the `recap-trail-jump` smoke state alongside `recap`, `recap-suspect2`, and `recap-trail-page2`, keeping the root and Unity embedded smoke fixtures in sync.
- Unity asset contracts guard the selector/expanded row, timeline jump helper, timeline anchor id helper, active anchor state, highlighted timeline row path, and smoke fixture mapping.
- Validation passed: `node --check` for the Unity asset contract and both smoke fixture copies, `npm run test:unity-assets`, `npm run test:unity-viewmodel`, Unity batch build, and 12 smoke captures across `recap`, `recap-suspect2`, `recap-trail-page2`, and `recap-trail-jump` at 1920x1080, 1600x900, and 1366x768.

## 2026-06-03 Follow-up: Unity Cross-Day Event Anchor Timeline Fallback

This follow-up completes the first direct source-navigation path for cross-day reasoning rows.

- Unity score-trail timeline anchors now fall back to `crossDayStance.currentEventAnchors` when a score point has no direct `timelineEntryId`, `timelineIndex`, or `timelineText`.
- The expanded `TL` action can now use a cross-day event anchor's `timelineEntryId` or `eventId` to open and highlight the source timeline row.
- Direct score-point timeline anchors still take priority, so existing exact source jumps are preserved.
- Unity asset contracts now guard the fallback helper, cross-day event-anchor source, and fallback id fields.
- Validation passed: `node --check tests\unity_asset_contracts.mjs` and `npm run test:unity-assets`; broader AI quality and Unity viewmodel checks remain unchanged from the previous baseline.

## 2026-06-03 Follow-up: Unity Cross-Day Anchor Chips In Expanded ScoreTrail

This follow-up turns preserved cross-day anchors into explicit scan chips inside the selected score point.

- The expanded score-trail row now renders compact `event`, `score`, and `evidence` chips when cross-day stance anchors exist.
- The chips read from `crossDayStance.currentEventAnchors`, `currentScoreTrailAnchors`, and `currentEvidenceAnchors`, reusing the same source fields as the continuity line and timeline fallback.
- The existing `TL` jump remains unchanged; the chips clarify the evidence anatomy behind a cross-day hold/shift without changing AI scoring, JS schema, or game rules.
- Unity asset contracts now guard the chip renderer, chip panel names, and event/score/evidence helper paths.
- Validation passed: `node --check tests\unity_asset_contracts.mjs` and `npm run test:unity-assets`.

## 2026-06-03 Follow-up: Unity Cross-Day Stance Badge In Expanded ScoreTrail

This follow-up makes the selected score point's cross-day stance state visible alongside its source anchors.

- The expanded score-trail row now renders an `AI Reasoning Cross Day Stance Badge` when `crossDayStance` exists.
- The badge summarizes hold/shift mode, previous-to-current score movement, evidence delta, and previous-to-current stance labels.
- The existing event/score/evidence anchor chips and `TL` source jump stay unchanged; the badge adds arc-state readability without changing AI scoring, JS schema, action flow, or game rules.
- Unity asset contracts now guard the stance badge renderer, badge panel names, score movement fields, evidence delta, and stance labels.
- Validation passed: `node --check tests\unity_asset_contracts.mjs` and `npm run test:unity-assets`.

## 2026-06-03 Follow-up: Unity Target-Vs-Runner Comparison Trace Detail

This follow-up makes selected AI reasoning points explain the target-vs-runner-up decision more explicitly.

- Unity `ReasoningComparisonLine(...)` now expands beyond `comparisonTrace.summary` into separate `focus` and `runner` side lines.
- Each side line can show name, score, evidence count, reason, and evidence summary, using the existing `AiReasoningComparisonTraceViewModel` fields.
- The comparison line also surfaces score gap, confidence band, reason key, and public-only status as compact metadata.
- No JS schema, scoring logic, AI decision logic, or game rules changed; this is a Unity audit-display enhancement over already-exported reasoning data.
- Unity asset contracts now guard the detailed comparison helpers and focus/runner reason/evidence fields.
- Validation passed: `node --check tests\unity_asset_contracts.mjs` and `npm run test:unity-assets`.

## 2026-06-03 Follow-up: Unity Timeline Rationale Dedicated Drilldown

This follow-up turns timeline rationale cards from a compact row suffix into a dedicated review strip.

- The timeline tab now renders `Info Timeline Rationale Drilldown` below the recent timeline activity rows.
- The strip follows the active `TL` source anchor when possible; otherwise it falls back to the latest timeline entry with visible `rationaleCards`.
- Up to three `Info Timeline Rationale Card` blocks display decision, strategy, and verification cards using the existing timeline card text and raw rationale fallback helpers.
- The drilldown is a Unity display enhancement only: no JS schema, AI scoring, action flow, or rule semantics changed.
- Unity asset contracts now guard the drilldown strip, compact rationale-card blocks, selector helpers, and accent helper.
- Validation passed: `node --check tests\unity_asset_contracts.mjs` and `npm run test:unity-assets`.

## 2026-06-03 Follow-up: Unity Timeline Rationale Card Trace Detail

This follow-up makes the dedicated timeline rationale cards more audit-readable without changing AI decisions or game rules.

- Timeline rationale card bodies now prefer `InfoTimelineRationaleCardTraceLine(...)` before falling back to the older timeline/raw rationale text.
- The trace line can show target-vs-runner-up matchup, confidence/reason context, evidence mode/source reliability/timeline consistency, and the next verification or response-plan step.
- The implementation reuses existing `RationaleCardViewModel` fields such as `targetName`, `runnerUpName`, `evidenceMode`, `sourceReliabilityLine`, `verificationLine`, and `responsePlanLine`.
- No JS schema, scoring logic, speech generation, action flow, or rule semantics changed; this is a Unity audit-display enhancement over existing rationale-card metadata.
- Unity asset contracts now guard the new trace helpers and field usage.
- Validation passed: `node --check tests\unity_asset_contracts.mjs` and `npm run test:unity-assets`.

## 2026-06-03 Follow-up: Unity ScoreTrail Evidence Drillthrough Chips

This follow-up makes selected AI score movements expose their source evidence without changing the AI scoring path.

- Expanded score-trail rows now render up to two `AI Reasoning Evidence Drillthrough Chip` blocks when cross-day anchor chips are not using the right-side chip lane.
- Each evidence chip is built from existing `evidenceRows` and can show evidence kind/source, applied delta, reliability score, and contamination risk.
- Unity viewmodel evidence rows now preserve optional `timelineEntryId`, `timelineIndex`, and `timelineText` fields when row/evidence sources provide them.
- Production viewmodel export can now infer a row-level timeline anchor when the evidence row timestamp exactly matches the timeline entry timestamp and the evidence kind or text matches that entry; weaker evidence ids, observation ids, or source ids alone are not enough.
- When an evidence row has its own timeline anchor, the chip becomes an exact `->EV` jump to that evidence row's visible source; otherwise it falls back to the score point's `->TL` context jump.
- The fallback remains deliberately scoped to the score point: `evidenceId`, `observationId`, and `sourceId` alone still do not directly identify `TimelineEntryViewModel.id`.
- Cross-day anchor chips still take priority, preserving the existing event/score/evidence source-jump path for cross-day stance points.
- The implementation reuses `AiReasoningEvidenceRowViewModel` fields such as `evidenceId`, `observationId`, `sourceName`, `reliabilityScore`, and `contaminationRisk`.
- No scoring logic, speech generation, action flow, or rule semantics changed; this is a backward-compatible Unity viewmodel/UI audit enhancement over existing score-trail metadata.
- Unity viewmodel contracts now prove inferred row-level timeline anchors survive into `scoreTrail[].evidenceRows[]` without explicit fixture anchor fields; Unity asset contracts guard the exact row jump and safe score-point context fallback.
- Validation passed: `npm run test:unity-viewmodel` and `npm run test:unity-assets`.

## 2026-06-03 Follow-up: Unity ScoreTrail Expanded Evidence Rows

This follow-up upgrades the selected AI score point from compact evidence chips into a fuller evidence-row audit lane.

- Expanded score-trail rows now render up to two `AI Reasoning Evidence Expanded Row` blocks when cross-day anchor chips are not occupying the right-side lane.
- Each row still uses the existing `AiReasoningEvidenceRowViewModel` data, but shows a wider source/text line alongside applied delta, reliability, and contamination risk.
- Exact evidence jumps and safe context jumps share one prefix helper: row-level anchors render as `e#->EV`, while score-point fallback anchors render as `e#->TL`.
- `timelineText` is now explicitly part of the expanded row source-text path, so inferred row anchors can show the visible source utterance rather than only an evidence id.
- No AI scoring, JS schema, speech generation, action flow, or rule semantics changed; this is a Unity audit-display enhancement over existing score-trail metadata.
- Unity asset contracts now guard the expanded row helper, shared jump-prefix logic, row source text, and `timelineText` usage.

## 2026-06-03 Follow-up: Unity UI Smoke Visual Regression Verifier

This follow-up turns the smoke screenshot path from "nonblank screenshot exists" into a reusable visual regression gate.

- Added `tools/verify_unity_ui_smoke.ps1`, which reads a Unity smoke `manifest.json`, checks required state/viewport coverage, samples each screenshot for UI-like foreground edge pressure, and writes `visual-regression-report.json`.
- The verifier supports optional baseline screenshot comparison through `-BaselineDir`, with `MaxDiffChangedRate`, `MaxMeanAbsDelta`, and `PixelDeltaThreshold` controls for intentional baseline updates.
- The edge-risk path reports foreground bounds, safe margins, and edge foreground rates, so future fixed-coordinate regressions have a numeric signal before manual screenshot review.
- Added `npm run unity:ui-smoke:verify` and Unity asset contract coverage for the verifier entry point, manifest/report flow, edge-risk metrics, and baseline diff thresholds.
- Validation passed: `node --check tests\unity_asset_contracts.mjs`, `npm run test:unity-assets`, visual verification of the 12-shot recap smoke manifest with required states/viewports, and a self-baseline diff run against the same screenshot directory.

## 2026-06-04 Follow-up: Unity UI Full-State Smoke Baseline

This follow-up turns the new visual verifier into an accepted broad UI baseline and closes the private-chat edge warning found during the first full-state pass.

- Captured a full 30-state x 3-viewport Unity UI smoke matrix in `output/unity-ui-smoke-full-baseline-2026-06-04`, covering 90 screenshots across 1920x1080, 1600x900, and 1366x768.
- The first full-state baseline found 6 `foreground-near-bottom-edge` warnings, all limited to `private-chat` / `private-chat-long`; inspection showed the bottom dock and dimmed board labels were still visually competing behind the private modal.
- Private chat now explicitly refreshes bottom-dock visibility when the panel opens and closes, and `ApplyBottomDockVisibility()` suppresses both the open dock and collapsed dock toggle while the private modal owns the bottom action area.
- Private-chat-only modal backdrop strength now uses a darker scrim than ordinary modals, pushing the underlying board text back without hiding the active private conversation controls.
- Unity asset contracts now guard both the private modal dock suppression and the stronger private backdrop so future UI edits do not reopen the same visual regression.
- This 30-state set remains the historical first accepted full-state baseline; the current accepted UI baseline was refreshed to 31 states after `phase-assist-public` joined the default smoke matrix.
- Validation passed: `node --check tests\unity_asset_contracts.mjs`, `npm run test:unity-assets`, Unity batch build, private-chat smoke verifier on 6 screenshots with zero warnings/failures, and full-state smoke verifier report on 90 screenshots with `failureCount = 0` and `warningCount = 0`.

## 2026-06-03 Follow-up: AI Private Protection-Vote Evidence Synthesis

This follow-up extends the AI agent reasoning baseline with a harder private synthesis case: protecting a high-pressure target while vote shape moves against table pressure.

- Added a fourth private synthesis variant, `protection-vote`, requiring BMR and SnV private-whisper samples to say `保高压位和票型反向互相顶住`.
- The fixed AI quality set now includes two new samples, raising the set from 100 to 102 rows while keeping `hiddenLeakCount = 0`.
- `computeGraphPressureForTarget(...)` and `extractGraphReasonChains(...)` now preserve explicit hot-target defense when source evidence text names high-pressure protection or unload-pressure behavior.
- `buildDialogueEvidenceContract(...)` now dedupes duplicate hot-defense summary families so the second evidence slot can preserve a different family such as vote conflict.
- Root and Unity embedded JS core copies were kept in sync.
- Validation passed: `node --check scripts\ai.js`, `node --check scripts\ai_quality_eval.mjs`, `node --check tests\ai_quality_eval_contracts.mjs`, `npm run test:ai-quality-eval`, and `node scripts\ai_quality_eval.mjs`; latest metrics include `evidenceCitationRate = 0.922`, `privateEvidenceSynthesisVariantCoverage = 1`, `repetitionRate = 0.288`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: AI Private Source-Identity Evidence Synthesis

This follow-up adds another private reasoning variant for source reliability plus identity-line conflict.

- Added a fifth private synthesis variant, `source-identity`, covering the relationship between unstable information source trust and a public identity line that fails verification.
- Added BMR and SnV private-whisper samples that combine `low-source-trust-chain` with `false-claim-chain`.
- The samples lower source trust through the existing `updateAgentSourceTrustForPlayer(...)` API, so the fixture exercises the real trust and knowledge-graph path instead of a hardcoded text shortcut.
- `privateEvidenceSynthesisVariantCoverage` now requires five modes and remains `1`.
- Root and Unity embedded `ai_quality_eval.mjs` copies were kept in sync.
- Validation passed: `node --check scripts\ai_quality_eval.mjs`, `node --check tests\ai_quality_eval_contracts.mjs`, `npm run test:ai-quality-eval`, and `node scripts\ai_quality_eval.mjs`; latest fixed snapshot is 104 rows with `hiddenLeakCount = 0`, `evidenceCitationRate = 0.923`, `repetitionRate = 0.300`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: AI Private Synthesis Verification Specificity

This follow-up makes private multi-evidence reasoning more actionable by pairing each synthesis mode with a specific next verification step.

- Private synthesis rows now carry evidence-family-specific `verificationLine` text instead of falling back to a generic "逐条对上" instruction.
- The implementation merges the new specific verification line with the existing evidence-mode tail, so old evidence-mode alignment remains intact.
- Added `privateEvidenceSynthesisVerificationCoverage = 1` as a new AI quality gate.
- The current five private synthesis modes are now guarded at two levels: synthesis wording and mode-specific verification action.
- Root and Unity embedded `ai.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Validation passed: `node --check` on touched JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`; latest fixed snapshot is 104 rows with `hiddenLeakCount = 0`, `evidenceCitationRate = 0.923`, `privateEvidenceSynthesisVerificationCoverage = 1`, `repetitionRate = 0.296`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: AI Private Synthesis Spoken Verification

This follow-up makes the private synthesis verification step visible in the actual player-facing reply, not just in rationale metadata.

- Added a final private-response guard after humanization, statement continuity, turn-taking, and answer alignment, so synthesis verification lines survive the full private dialogue pipeline.
- The spoken line uses conversational wording, allowing `身份和大家验证对上` / `再对一下` while still preserving the stricter `decisionRationale.verificationLine` contract.
- Added `privateEvidenceSynthesisSpokenVerificationCoverage = 1` as a new AI quality gate.
- All 10 BMR/SnV private synthesis rows now guard three layers: evidence-family synthesis wording, mode-specific rationale verification, and player-facing spoken verification action.
- Root and Unity embedded `ai.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, `node scripts\ai_quality_eval.mjs`, Unity/root JS no-index sync checks, and `git diff --check`; latest fixed snapshot is 104 rows with `hiddenLeakCount = 0`, `evidenceCitationRate = 0.923`, `privateEvidenceSynthesisVerificationCoverage = 1`, `privateEvidenceSynthesisSpokenVerificationCoverage = 1`, `repetitionRate = 0.292`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: AI Public Synthesis Spoken Verification

This follow-up makes public multi-evidence reasoning more actionable by turning generic public follow-ups into explicit table-verification wording.

- Public synthesis replies now say `核法是...` when the AI asks the table to verify a multi-evidence pressure line, e.g. asking the target to explain vote shape and then supplement identity/night information.
- Existing already-specialized public follow-ups are normalized into the same explicit verification wording, so `先听X解释票型...` no longer bypasses the spoken verification style.
- Added `publicEvidenceSynthesisSpokenVerificationCoverage = 1` as a new AI quality gate.
- The gate covers 12 public synthesis rows across BMR/SnV cross-script public multi-evidence, persona pressure, timing pressure, and role-pressure samples.
- Root and Unity embedded `ai_public_discussion.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, `node scripts\ai_quality_eval.mjs`, Unity/root JS no-index sync checks, and `git diff --check`; latest fixed snapshot is 104 rows with `hiddenLeakCount = 0`, `evidenceCitationRate = 0.923`, `publicEvidenceSynthesisCoverage = 1`, `publicEvidenceSynthesisDedupCoverage = 1`, `publicEvidenceSynthesisSpokenVerificationCoverage = 1`, `repetitionRate = 0.292`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: AI Public Synthesis Verification Variants

This follow-up makes public multi-evidence verification mode-aware instead of using one generic public follow-up for every evidence-family combination.

- Public `核法是...` wording now changes with the synthesis phrase: identity+vote checks identity and vote shape together, public-pressure+vote asks why vote shape matches table pressure, identity+nomination checks identity against nomination pressure, and public-pressure+nomination asks what remains unclear before nomination pressure is justified.
- Added two fixed real-pipeline public synthesis samples for `identity-nomination` and `pressure-nomination`.
- Added `publicEvidenceSynthesisSpokenVerificationVariantCoverage = 1` as a new AI quality gate over all public synthesis rows.
- The fixed set now covers four public synthesis verification modes while preserving the previous public synthesis, dedup, spoken verification, persona, timing, role-pressure, and hidden-leak contracts.
- Root and Unity embedded `ai_public_discussion.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, `node scripts\ai_quality_eval.mjs`, Unity/root JS no-index sync checks, and `git diff --check`; latest fixed snapshot is 106 rows with `hiddenLeakCount = 0`, `evidenceCitationRate = 0.925`, `publicEvidenceSynthesisSpokenVerificationCoverage = 1`, `publicEvidenceSynthesisSpokenVerificationVariantCoverage = 1`, `repetitionRate = 0.288`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: AI Nomination Action Context

This follow-up strengthens the AI's nomination-stage reasoning by making the strategy text explicitly say why a nomination is an action window rather than an empty pass.

- Nomination strategy rationale now uses public-safe `不是空过` / `空过风险` language across pressure-test, coalition-check, execution-push, avoid-no-execution, execution-info, public-reason-flow, and information-check modes.
- The same `strategyRationale.line` remains the shared source for proposal text, nomination debate metadata, Unity rationale cards, and quality rows.
- Added `nominationActionContextCoverage = 1` as a new AI quality gate, requiring nomination rows to preserve the strategy line, empty-pass/action-window wording, vote context when available, and a concrete observation target such as defense, stand-side, execution information, public-reason flow, or information gain.
- Root and Unity embedded `ai.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, `node scripts\ai_quality_eval.mjs`, Unity/root JS no-index sync checks, and `git diff --check`; latest fixed snapshot is 106 rows with `hiddenLeakCount = 0`, `evidenceCitationRate = 0.925`, `strategyRationaleCoverage = 1`, `nominationActionContextCoverage = 1`, `repetitionRate = 0.281`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: AI Nomination Strategy Mode Coverage

This follow-up makes the nomination action-context gate mode-complete instead of only row-complete.

- Exported and reused `buildNominationStrategyRationale(...)` inside the AI quality evaluator, so fixed samples call the same strategy wording path as live nominations.
- Added fixed rows for all seven public strategy display modes: pressure test, coalition check, execution push, avoid-no-execution, execution information, public-reason flow, and information check.
- Added `nominationStrategyModeCoverage = 1` as a new AI quality gate, requiring every expected mode to preserve the generated strategy line, action-window wording, vote context, and a concrete observation target.
- Root and Unity embedded `ai.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`; latest fixed snapshot is 113 rows with `hiddenLeakCount = 0`, `evidenceCitationRate = 0.929`, `nominationActionContextCoverage = 1`, `nominationStrategyModeCoverage = 1`, `repetitionRate = 0.272`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: AI Nomination Defense Response

This follow-up upgrades the nominee side of nomination debates from generic self-defense into structured, verifiable table speech.

- AI nominee defenses now directly answer the nomination reason, preserve the public-safe claim lane, state which identity/night-info/vote-shape detail they will verify, and give a clear vote threshold: if the answer does not connect, vote; if it connects, lower pressure.
- High-pressure defenses can also ask the table to remember the nominator's behavior if the nominator keeps pushing the vote without hearing the defense.
- Added two real `createNominationDebate(...)` fixed rows for normal nominee defense and counter-pressure defense.
- Added `nominationDefenseResponseCoverage = 1` as a new AI quality gate for nominee debate replies.
- Root and Unity embedded `ai.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`; latest fixed snapshot is 115 rows with `hiddenLeakCount = 0`, `evidenceCitationRate = 0.930`, `nominationActionContextCoverage = 1`, `nominationStrategyModeCoverage = 1`, `nominationDefenseResponseCoverage = 1`, `repetitionRate = 0.273`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: AI Nomination Defense-Aware Vote Rationale

This follow-up closes the nomination debate loop by carrying the nominee's defense into formal vote explanations.

- AI formal vote rationale now reads the active nomination debate defense as public context, without changing the underlying yes/no vote decision.
- Yes-vote explanations can say the defense did not connect identity, information, or vote shape; no-vote explanations can say the defense gave a verifiable direction and should lower pressure.
- Added fixed yes/no formal-vote rows that go through real nomination debate creation and `decideAIVoteWithRationale(...)`.
- Added `nominationDefenseAwareVoteCoverage = 1` as a new AI quality gate.
- Root and Unity embedded `ai.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`; latest fixed snapshot is 117 rows with `hiddenLeakCount = 0`, `evidenceCitationRate = 0.932`, `nominationDefenseResponseCoverage = 1`, `nominationDefenseAwareVoteCoverage = 1`, `formalVoteRationaleCoverage = 1`, `formalVoteLineDiversityCoverage = 0.960`, `repetitionRate = 0.266`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: AI Cross-Script Nomination Defense-Aware Vote

This follow-up makes the defense-aware formal vote explanation portable beyond TB.

- Reused the same real nomination debate and formal vote rationale fixture path for BMR and SnV.
- Added BMR/SnV fixed yes/no rows requiring formal vote rationale to say whether nominee defense lowered pressure or failed to connect.
- Added `crossScriptNominationDefenseAwareVoteCoverage = 1` as a new AI quality gate.
- Root and Unity embedded `ai_quality_eval.mjs` copies were kept in sync.
- Validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`; latest fixed snapshot is 121 rows with `hiddenLeakCount = 0`, `evidenceCitationRate = 0.934`, `nominationDefenseAwareVoteCoverage = 1`, `crossScriptNominationDefenseAwareVoteCoverage = 1`, `formalVoteRationaleCoverage = 1`, `formalVoteLineDiversityCoverage = 0.966`, `repetitionRate = 0.266`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: AI Nomination Reason-Anchored Defense Vote

This follow-up makes defense-aware vote explanations connect all three public debate steps: nomination reason, nominee defense, and final vote.

- `voteRationale.nominationDefenseContext` now carries a public `reasonLine` from the active nomination debate.
- Formal vote lines now anchor on the real pressure point, e.g. `身份和票型没对上，先听防守再看票`, before saying whether the defense failed to connect or lowered pressure.
- Added `nominationReasonAnchoredDefenseVoteCoverage = 1` as a new AI quality gate, and tightened the gate so a bare seat-number anchor is not enough.
- Root and Unity embedded `ai.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`; latest fixed snapshot is 121 rows with `hiddenLeakCount = 0`, `evidenceCitationRate = 0.934`, `nominationDefenseAwareVoteCoverage = 1`, `nominationReasonAnchoredDefenseVoteCoverage = 1`, `crossScriptNominationDefenseAwareVoteCoverage = 1`, `formalVoteRationaleCoverage = 1`, `formalVoteLineDiversityCoverage = 0.966`, `repetitionRate = 0.276`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: AI Reason-Anchored Defense Vote Line Diversity

This follow-up keeps the deeper nomination-reason -> defense -> vote chain, while making the player-facing opening less template-like.

- Defense-aware formal vote openings now vary deterministically between forms like `提名理由点的是...`, `我按提名理由...看`, and `先回到提名理由...`.
- The selector uses public seat buckets before hash fallback, preserving reproducibility and avoiding any change to the actual yes/no vote decision.
- Added `nominationReasonAnchoredDefenseVoteLineDiversityCoverage = 1`, requiring diverse normalized openings across reason-anchored defense-aware vote rows and separately across yes/no outcomes.
- Root and Unity embedded `ai.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`; latest fixed snapshot is 121 rows with `hiddenLeakCount = 0`, `evidenceCitationRate = 0.934`, `nominationDefenseAwareVoteCoverage = 1`, `nominationReasonAnchoredDefenseVoteCoverage = 1`, `nominationReasonAnchoredDefenseVoteLineDiversityCoverage = 1`, `crossScriptNominationDefenseAwareVoteCoverage = 1`, `formalVoteLineDiversityCoverage = 0.966`, `repetitionRate = 0.267`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: AI Nominee Defense Reason Anchor

This follow-up improves the nominee side of the nomination debate, not only the later vote explanation.

- AI nominee-defense lines now answer the concrete nomination pressure point, e.g. `身份和票型没对上...`, instead of reducing the reason to only a seat number.
- All nominee-defense variants quote the pressure point before explaining identity, night-info, vote-shape, and what should happen to the vote if the answer connects.
- Added `nominationDefenseReasonAnchorCoverage = 1` as a new AI quality gate.
- Root and Unity embedded `ai.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`; latest fixed snapshot is 121 rows with `hiddenLeakCount = 0`, `evidenceCitationRate = 0.934`, `nominationDefenseResponseCoverage = 1`, `nominationDefenseReasonAnchorCoverage = 1`, `nominationDefenseAwareVoteCoverage = 1`, `nominationReasonAnchoredDefenseVoteCoverage = 1`, `nominationReasonAnchoredDefenseVoteLineDiversityCoverage = 1`, `crossScriptNominationDefenseAwareVoteCoverage = 1`, `repetitionRate = 0.269`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: AI Cross-Script Nominee Defense Reason Anchor

This follow-up extends nominee-defense reason anchors from TB to BMR and SnV.

- Added BMR/SnV fixed nomination-defense rows through real nomination debates, covering both low-pressure and high-pressure defenses.
- BMR fixtures now use death/protection/execution-pressure wording, while SnV fixtures use information-chain and identity-logic pressure wording.
- Added `crossScriptNominationDefenseReasonAnchorCoverage = 1` as a new AI quality gate.
- Root and Unity embedded `ai_quality_eval.mjs` copies were kept in sync.
- Validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`; latest fixed snapshot is 125 rows with `hiddenLeakCount = 0`, `evidenceCitationRate = 0.936`, `nominationDefenseResponseCoverage = 1`, `nominationDefenseReasonAnchorCoverage = 1`, `crossScriptNominationDefenseReasonAnchorCoverage = 1`, `nominationReasonAnchoredDefenseVoteCoverage = 1`, `crossScriptNominationDefenseAwareVoteCoverage = 1`, `repetitionRate = 0.287`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: AI High-Pressure Nominee Defense Counter-Pressure

This follow-up makes high-pressure nominee defenses more table-aware.

- High-pressure nominee defenses now always add a public-safe counter-pressure warning if the nominator keeps pushing votes without listening to the defense.
- The line is appended after the normal reason-anchored defense, so it does not replace identity/info/vote-shape explanation or vote-threshold language.
- Added `highPressureNominationDefenseCounterPressureCoverage = 1` as a new AI quality gate.
- Root and Unity embedded `ai.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`; latest fixed snapshot is 125 rows with `hiddenLeakCount = 0`, `evidenceCitationRate = 0.936`, `nominationDefenseReasonAnchorCoverage = 1`, `highPressureNominationDefenseCounterPressureCoverage = 1`, `crossScriptNominationDefenseReasonAnchorCoverage = 1`, `nominationReasonAnchoredDefenseVoteLineDiversityCoverage = 1`, `crossScriptNominationDefenseAwareVoteCoverage = 1`, `repetitionRate = 0.285`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: AI Public Target-Switch Claim Disclosure Continuity

This follow-up makes public target-switch speech keep identity-lane reasoning visible.

- Public target-switch speech now preserves claim-disclosure and claim-continuity wording after the final speech budget pass.
- `claimDisclosureRationale.spokenLine` is re-attached to the final rendered public line, so metadata points to what the player actually sees.
- Public-speech counter-evidence now says to listen for an explanation and re-check the later public response before locking the read.
- Tightened `claimDisclosureRationaleCoverage` and `claimDisclosureContinuityCoverage` to `1`.
- Root and Unity embedded `ai.js` / `ai_public_discussion.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`; latest fixed snapshot is 125 rows with `hiddenLeakCount = 0`, `evidenceCitationRate = 0.936`, `decisionCounterEvidenceCoverage = 1`, `claimDisclosureRationaleCoverage = 1`, `claimDisclosureContinuityCoverage = 1`, `crossDayTargetSwitchCoverage = 1`, `crossScriptCrossDayTargetSwitchCoverage = 1`, `publicEvidenceSynthesisCoverage = 1`, `repetitionRate = 0.292`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: AI Shadow High-Pressure Targeted Openings

This follow-up improves shadow-persona public speech under high pressure.

- Shadow high-pressure multi-evidence openings now include the target before the caution judgment, so repeated suspicious openers become target-specific reads.
- Evil protect-ally cover can now say `台面压力别只堆一处`, `别只压一个点`, or `压力重新分配一下`, preserving the same public-safe cover intent with less repeated wording.
- Tightened `publicShadowPressureLineDiversityCoverage` to `1`.
- Root and Unity embedded `ai_public_discussion.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`; latest fixed snapshot is 125 rows with `hiddenLeakCount = 0`, `evidenceCitationRate = 0.936`, `publicPersonaPressureVariantCoverage = 1`, `publicPersonaPressureLineDiversityCoverage = 1`, `publicShadowPressureLineDiversityCoverage = 1`, `evilPublicProtectAllyCoverage = 1`, `evilPublicClaimCoverPressureContinuityCoverage = 1`, `repetitionRate = 0.289`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: AI Formal Vote Full Line Diversity

This follow-up removes the last repeated formal-vote rationale line from the fixed quality set.

- Formal vote line variants can now read voter context, so repeated same-target, multi-evidence, no-vote rows vary between `我先`, `我这边先`, and `我这里先` without changing the public rationale.
- The change only touches player-facing `voteRationale.line`; vote decisions, thresholds, reason keys, and the `voteRationale` data shape stay unchanged.
- Tightened `formalVoteLineDiversityCoverage` to `1`.
- Root and Unity embedded `ai.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`; latest fixed snapshot is 125 rows with `hiddenLeakCount = 0`, `evidenceCitationRate = 0.936`, `formalVoteRationaleCoverage = 1`, `formalVoteLineDiversityCoverage = 1`, `formalVoteReasonModeCoverage = 1`, `formalVoteNearThresholdCoverage = 1`, `formalVoteEvidenceBoundaryCoverage = 1`, `formalVoteMultiEvidenceCompressionCoverage = 1`, `formalVoteScriptCoverage = 1`, `repetitionRate = 0.286`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: AI Private Source-Reliability Spoken Reasoning

This follow-up makes private AI explanations verbalize one deeper reasoning lens instead of leaving it only in metadata.

- Private `reason` replies now append the naturalized `sourceReliabilityLine`, so the AI says whether a pressure read has an independent source, is only same-source echo, needs public replication, or should be downweighted.
- The renderer strips report labels such as `来源可靠度：`, keeping the line conversational and preserving `privateSurfaceReportDisciplineCoverage = 1`.
- Added `privateDeepReasoningSpokenCoverage = 1`, requiring fixed private reason rows to say source-reliability reasoning in the spoken text.
- Root and Unity embedded `ai.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`; latest fixed snapshot is 125 rows with `hiddenLeakCount = 0`, `evidenceCitationRate = 0.936`, `privateSurfaceReportDisciplineCoverage = 1`, `privateDeepReasoningSpokenCoverage = 1`, `privateEvidenceSynthesisCoverage = 1`, `privateEvidenceSynthesisSpokenVerificationCoverage = 1`, `repetitionRate = 0.294`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: AI Private Timeline-Consistency Spoken Reasoning

This follow-up makes private AI explanations verbalize the timeline consistency check after source reliability.

- Private `reason` replies now append the naturalized `timelineConsistencyLine`, so the AI says whether claims, votes, explanations, and responses appear in a coherent order.
- When the source and timeline lines use the same target pair, the second sentence is de-duplicated into `再看...` phrasing instead of repeating the full pair opener.
- Added `privateTimelineReasoningSpokenCoverage = 1`, requiring fixed private reason rows to say timeline-consistency reasoning in the spoken text.
- Root and Unity embedded `ai.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`; latest fixed snapshot is 125 rows with `hiddenLeakCount = 0`, `evidenceCitationRate = 0.936`, `privateSurfaceReportDisciplineCoverage = 1`, `privateDeepReasoningSpokenCoverage = 1`, `privateTimelineReasoningSpokenCoverage = 1`, `privateEvidenceSynthesisCoverage = 1`, `privateEvidenceSynthesisSpokenVerificationCoverage = 1`, `repetitionRate = 0.308`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: AI Private Incentive-Alignment Spoken Reasoning

This follow-up makes private AI explanations verbalize the incentive alignment check after source reliability and timeline consistency.

- Private `reason` replies now append the naturalized `incentiveAlignmentLine`, so the AI says whether behavior looks like table-solving, self-preservation, protecting another player, following pressure, or moving heat away.
- When the source, timeline, and incentive lines share the same target pair, the incentive sentence is de-duplicated into `动机上再分...` phrasing instead of repeating the full pair opener.
- Added `privateIncentiveReasoningSpokenCoverage = 1`, requiring fixed private reason rows to say incentive-alignment reasoning in the spoken text.
- Root and Unity embedded `ai.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`; latest fixed snapshot is 125 rows with `hiddenLeakCount = 0`, `evidenceCitationRate = 0.936`, `privateSurfaceReportDisciplineCoverage = 1`, `privateDeepReasoningSpokenCoverage = 1`, `privateTimelineReasoningSpokenCoverage = 1`, `privateIncentiveReasoningSpokenCoverage = 1`, `privateEvidenceSynthesisCoverage = 1`, `privateEvidenceSynthesisSpokenVerificationCoverage = 1`, `repetitionRate = 0.321`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: AI Private Burden-of-Proof Spoken Reasoning

This follow-up makes private AI explanations verbalize the burden-of-proof check after source reliability, timeline consistency, and incentive alignment.

- Private `reason` replies now append the naturalized `burdenOfProofLine`, so the AI says who must provide public reasons: the target, vote followers, defenders, or supporters on a close pressure lane.
- When the source, timeline, incentive, and burden lines share the same target pair, the burden sentence is de-duplicated into `举证上...` phrasing instead of repeating the full pair opener.
- Added `privateBurdenReasoningSpokenCoverage = 1`, requiring fixed private reason rows to say burden-of-proof reasoning in the spoken text.
- Root and Unity embedded `ai.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`; latest fixed snapshot is 125 rows with `hiddenLeakCount = 0`, `evidenceCitationRate = 0.936`, `privateSurfaceReportDisciplineCoverage = 1`, `privateDeepReasoningSpokenCoverage = 1`, `privateTimelineReasoningSpokenCoverage = 1`, `privateIncentiveReasoningSpokenCoverage = 1`, `privateBurdenReasoningSpokenCoverage = 1`, `privateEvidenceSynthesisCoverage = 1`, `privateEvidenceSynthesisSpokenVerificationCoverage = 1`, `repetitionRate = 0.333`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: AI Private Deep-Reasoning Compression

This follow-up improves the language shape of private AI explanations without removing any reasoning lens.

- Private `reason` replies now merge incentive alignment and burden of proof when both apply to the same target lane.
- Pair-comparison reads use phrasing like `动机和举证一起看`, keeping who benefits and who must justify the pressure in the same conversational sentence.
- Single-target vote reads also compress the vote-motive and vote-reason burden into one sentence, so the AI says whether a vote is self-preservation, following, or active pushing while naming who must explain it.
- Added `privateDeepReasoningCompressionCoverage = 1`, requiring this compressed spoken form in the fixed private reason rows.
- Root and Unity embedded `ai.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`; latest fixed snapshot is 125 rows with `hiddenLeakCount = 0`, `evidenceCitationRate = 0.936`, `privateDeepReasoningSpokenCoverage = 1`, `privateTimelineReasoningSpokenCoverage = 1`, `privateIncentiveReasoningSpokenCoverage = 1`, `privateBurdenReasoningSpokenCoverage = 1`, `privateDeepReasoningCompressionCoverage = 1`, `privateEvidenceSynthesisSpokenVerificationCoverage = 1`, `repetitionRate = 0.301`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: AI Private Source-Timeline Compression

This follow-up improves private AI explanation shape by merging the first two deep reasoning lenses.

- Private `reason` replies now merge source reliability and timeline consistency when both apply to the same target lane.
- Pair-comparison reads use phrasing like `来源和时间线一起看`, keeping source independence, same-source echo risk, and claim/vote/response order in one sentence.
- Single-target vote reads also compress source and timing into one sentence, so the AI can say whether vote evidence is independent and whether the vote order makes pressure stronger.
- Added `privateSourceTimelineCompressionCoverage = 1`, requiring this compressed spoken form in the fixed private reason rows.
- Root and Unity embedded `ai.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`; latest fixed snapshot is 125 rows with `hiddenLeakCount = 0`, `evidenceCitationRate = 0.936`, `privateDeepReasoningSpokenCoverage = 1`, `privateTimelineReasoningSpokenCoverage = 1`, `privateSourceTimelineCompressionCoverage = 1`, `privateIncentiveReasoningSpokenCoverage = 1`, `privateBurdenReasoningSpokenCoverage = 1`, `privateDeepReasoningCompressionCoverage = 1`, `privateEvidenceSynthesisSpokenVerificationCoverage = 1`, `repetitionRate = 0.291`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: AI Private Reason Opening Redundancy

This follow-up polishes the opening cadence of private reason replies without changing the reasoning content.

- Private `reason` replies now replace redundant `我先看 X。...我先排 X` openings with `先给结论：我先不把话说死，...`.
- This keeps the direct-answer shape and cautious persona marker while avoiding repeated focus-target announcements in the same opening.
- Added `privateReasonOpeningRedundancyCoverage = 1`, requiring the fixed private reason rows to avoid the redundant opening.
- Root and Unity embedded `ai.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`; latest fixed snapshot is 125 rows with `hiddenLeakCount = 0`, `evidenceCitationRate = 0.936`, `privateReasonOpeningRedundancyCoverage = 1`, `privateDeepReasoningSpokenCoverage = 1`, `privateTimelineReasoningSpokenCoverage = 1`, `privateSourceTimelineCompressionCoverage = 1`, `privateIncentiveReasoningSpokenCoverage = 1`, `privateBurdenReasoningSpokenCoverage = 1`, `privateDeepReasoningCompressionCoverage = 1`, `repetitionRate = 0.294`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: AI Private Reason Opening Variants

This follow-up reduces stock phrasing in private reason openings while preserving the direct-answer contract.

- Private `reason` replies now choose a deterministic direct-answer bridge variant from the target seat when trimming redundant `我先看 X。...我先排 X` openings.
- The bridge variants keep cautious table language, including `我先不把话说死`, `我先看这条，但不锁死`, `我先点这条，但不把话说死`, and `我暂时不换目标，先放主线`.
- Added `privateReasonOpeningVariantCoverage = 1`, requiring multiple bridge variants in the fixed private reason rows.
- Root and Unity embedded `ai.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`; latest fixed snapshot is 125 rows with `hiddenLeakCount = 0`, `evidenceCitationRate = 0.936`, `privateReasonOpeningRedundancyCoverage = 1`, `privateReasonOpeningVariantCoverage = 1`, `privateDeepReasoningSpokenCoverage = 1`, `privateTimelineReasoningSpokenCoverage = 1`, `privateSourceTimelineCompressionCoverage = 1`, `privateDeepReasoningCompressionCoverage = 1`, `repetitionRate = 0.286`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: AI Private Reason Opening Sentence Discipline

This follow-up tightens private reason openings so the direct-answer bridge reads like a complete spoken sentence before evidence synthesis begins.

- Private `reason` bridge variants now close with a standalone sentence boundary, turning openings such as `先给结论：我暂时不换目标，先放主线。` into a clean lead-in instead of comma-splicing into the body.
- Added `privateReasonOpeningSentenceCoverage = 1`, requiring fixed private reason rows to match one of the standalone bridge sentences before continuing into source, timeline, incentive, and burden reasoning.
- Root and Unity embedded `ai.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`; latest fixed snapshot is 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.936`, `privateReasonOpeningRedundancyCoverage = 1`, `privateReasonOpeningVariantCoverage = 1`, `privateReasonOpeningSentenceCoverage = 1`, `privateDeepReasoningSpokenCoverage = 1`, `privateTimelineReasoningSpokenCoverage = 1`, `privateSourceTimelineCompressionCoverage = 1`, `privateDeepReasoningCompressionCoverage = 1`, `repetitionRate = 0.293`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: AI Non-Public Surface Spacing Discipline

This follow-up removes another mechanical text artifact from AI speech: Chinese seat labels no longer keep English-style spaces in private, nomination, and formal-vote lines.

- Added shared Chinese seat-label spacing normalization for conversational rendering, private reason post-processing, nomination defense responses, formal vote rationales, and the Butler vote-restriction line.
- Added `nonPublicSurfacePolishCoverage = 1`, requiring private, nomination, and vote rows to avoid forms such as `1 号`, `1号 的`, `先问 1号`, or `我先排 4号`.
- Public vote-intent timing pressure now has a final preservation guard, so budget trimming keeps `到投票` / `压力票` / `补出解释` style timing markers.
- Root and Unity embedded `ai.js`, `ai_speech_renderer.js`, `ai_public_discussion.js`, `engine.js`, and `ai_quality_eval.mjs` copies were kept in sync.
- Validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`; latest fixed snapshot is 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.936`, `nonPublicSurfacePolishCoverage = 1`, `publicTimingPressureVariantCoverage = 1`, `privateReasonOpeningVariantCoverage = 1`, `privateReasonOpeningSentenceCoverage = 1`, `repetitionRate = 0.293`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: AI Private Deep Reasoning Variants

This follow-up deepens private `reason` replies by keeping the four-factor reasoning contract while avoiding one repeated compressed template.

- Private compressed source/timeline lines now vary deterministically by target, covering forms such as independent-source vs same-source echo checks, explanation-order checks, and vote-timing checks.
- Private compressed incentive/burden lines now vary deterministically by target, covering解桌 / 护人 / 转移压力 comparisons, self-preservation vs follow-vote vs active-push reads, and who must give reasons.
- Added `privateDeepReasoningCompressionVariantCoverage = 1`, which normalizes seat labels away before counting variants so different targets do not fake diversity.
- Extended non-public spacing discipline to catch `在 3号`, `转 7号`, and `放掉 3号`; latest sample inspection found `nonpublic spacing bad rows = 0`.
- Root and Unity embedded `ai.js`, `ai_speech_renderer.js`, and `ai_quality_eval.mjs` copies were kept in sync.
- Validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`; latest fixed snapshot is 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.936`, `privateDeepReasoningCompressionVariantCoverage = 1`, `privateDeepReasoningCompressionCoverage = 1`, `privateSourceTimelineCompressionCoverage = 1`, `nonPublicSurfacePolishCoverage = 1`, `repetitionRate = 0.278`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: Unity Vote Ceremony Dense Layout

This follow-up continues the UI ceremony polish on the highest-risk vote surface: 15-player vote playback.

- `RenderVoteTokenCeremony(...)` already renders up to 15 voters; the 15-player smoke screenshot showed all voters present but the dense ring was still visually hard to scan at 1366x768.
- Dense vote tokens now use a slightly wider ring with smaller token bodies and outward radial seat labels instead of placing every seat label below the token.
- Each seat label now has a compact backplate and selected-state frame, making the current voter easier to locate without changing the vote animation timing.
- The vote center now renders a `Vote Tally Rail` with `已问`, `举手`, `未举`, and `待问` chips, so 15-player votes expose progress and threshold pressure at a glance.
- Unity asset contracts now guard the 15-voter cap, dense mode, radial label helper, and tally rail helper.

## 2026-06-04 Follow-up: Unity Stage Dialogue Playback Cue

This follow-up continues public/private dialogue stage polish by making queued or paged dialogue feel like a readable playback sequence.

- The existing `Stage Dialogue Queue Strip` now includes a progress track, fill, and knob instead of relying only on static pips and compact text.
- Queue pips now highlight the actual current page index and mark completed pages separately, so multi-page public dialogue and queued speech no longer look stuck on the first pip.
- The progress cue is driven by existing page count, queue count, and pending phase-transition state; no dialogue queue behavior, text generation, or action flow changed.
- Unity asset contracts now guard the playback cue, progress helper, and current-step highlight.

## 2026-06-04 Follow-up: Unity Stage Dialogue Speech Card

This follow-up strengthens the active bottom-stage dialogue line without changing typing, paging, or queue behavior.

- The active spoken line now sits on a `Stage Dialogue Speech Card` instead of floating only on the broad body wash.
- A `Stage Dialogue Speaker Bridge` visually connects the portrait/token column to the speech card.
- The card includes a warm left accent, a fine top rule, and a low-opacity quote mark, giving public and queued speech a clearer stage-read shape.
- Unity asset contracts now guard the speech card, accent, bridge, and quote marker.

## 2026-06-04 Follow-up: Unity Stage Dialogue Route Ribbon

This follow-up makes each staged public/private line read as a directed speech beat instead of only a speaker header plus body text.

- Stage Dialogue now renders a compact `Stage Dialogue Route Ribbon` beside the meta line.
- The ribbon derives `来源 · 发言者 -> 目标/全桌` from the existing stage source mode, `speakerId`, and `targetId`.
- The source-colored route accent reuses the existing context-rail source palette, so private, timeline, recap, nomination, and event dialogue keep distinct visual lanes.
- The change preserves typing, queue order, paging, source button behavior, and dialogue payloads; it only improves scanability of who is speaking to whom.
- Unity asset contracts now guard the route-ribbon references, accent, update helper, and route-label helper.

## 2026-06-04 Follow-up: Unity Private Chat Turn Rhythm Track

This follow-up continues private-chat polish by making the conversation header read more like a two-person exchange instead of only a tool summary.

- The existing `Private Thread Rhythm` row now adds a compact `Private Rhythm Turn Track` at the right edge.
- The track renders recent private messages as small direction-coded pips: warm pips for the human side, cool pips for the target side, and a highlighted pending ring while the model response is still waiting.
- The existing channel/latest/next-step/boundary fields remain in place, but the boundary field was tightened to make room for the new rhythm track without changing panel width.
- Unity asset contracts now guard the turn track, pip helper, and pending-ring marker.

## 2026-06-04 Follow-up: Unity Private Chat Conversation Lane Cues

This follow-up moves the private-chat message body closer to a dialogue scene while preserving the existing scroll/content behavior.

- The `Private Dialogue Content` root now renders a low-opacity lane backdrop, with separate inbound and outbound side lanes matching the existing cool/warm participant colors.
- Private message bubbles now sit slightly inset from the panel edges, leaving room for compact turn cues outside the bubble body.
- Each rendered private bubble gets a side cue with a short connector, ring/dot marker, and `收`/`发` tag, so short and long private threads read as alternating conversation turns instead of isolated info panels.
- Unity asset contracts now guard the lane backdrop, inbound/outbound lanes, and turn-tag helper.

## 2026-06-04 Follow-up: Unity Private Chat Stage Banner

This follow-up makes the private-chat transcript read more like a directed conversation scene instead of only a scrollable log.

- The private transcript area now renders a fixed `Private Dialogue Stage Banner` between the rhythm strip and the scrollable message viewport.
- The banner shows `你 -> 目标`, the private-thread record count, pending/synced state, and hidden older-record count when applicable.
- A compact `Private Dialogue Stage Track` with human/target nodes visually connects the two sides before the message bubbles begin.
- The banner also appears in empty and no-target states, giving the private-chat surface a stable stage frame before the first message without depending on scroll position.
- Unity asset contracts now guard the stage banner, route track, human/target nodes, render helper, and meta-label helper.

## 2026-06-04 Follow-up: Unity Private Chat Scroll Rail

This follow-up makes long private transcripts advertise their scrollable/recent-window state even when the thread is parked at the latest message.

- The private transcript viewport now has a fixed `Private Dialogue Scroll Rail` along the right edge.
- The rail renders a slim track, thumb, and compact state label: `选` before a target is selected, `新` for very short threads, `全` when the visible window covers all messages, and `近` when older records are hidden outside the recent rendered window.
- The thumb stays at the latest end because the panel still auto-scrolls to the newest message; this preserves existing `ScrollRect` behavior while making the long-thread affordance visible.
- Unity asset contracts now guard the scroll-rail root, track, thumb, and render helper.

## 2026-06-04 Follow-up: Unity Private Chat Portrait Stage

This follow-up strengthens the left-side private-chat target card so the selected player reads as the conversation subject, not just a data card.

- `RenderPrivateTargetCard(...)` now renders a `Private Target Portrait Stage` behind both selected and empty target states.
- The target token gets a pressure-colored aura/halo and inner ring derived from existing suspicion, while unknown targets use a cooler neutral stage.
- A subtle `Private Target Spotlight Floor` grounds the large token portrait without adding new interaction state or changing player data.
- Unity asset contracts now guard the portrait stage, halo, spotlight floor, and pressure-accent helper.

## 2026-06-04 Follow-up: Unity Private Chat Quick Prompt Strip

This follow-up tightens the compose area by turning scattered quick-question buttons into a compact prompt strip.

- The four existing private quick questions now sit inside a `Private Quick Prompt Strip` with a left-side `追问` label.
- A small state pill shows `选目标`, `可追问`, `等回应`, or `先等` from the existing target and pending-response state.
- The original quick-question actions and intent payloads remain unchanged; the polish only improves grouping, scan order, and pending-state feedback.
- Unity asset contracts now guard the quick prompt strip, state pill, update helper, and state-label helper.

## 2026-06-04 Follow-up: Unity Vote Ceremony Threshold Meter

This follow-up continues the vote ceremony polish by making execution pressure readable during the animation, not only after reading the center text.

- The existing `Vote Tally Rail` now has a live `Vote Threshold Meter` below the count chips.
- The meter fills from the currently revealed yes votes, marks the configured execution threshold, and shows `差 N` or `已过线 +N` as the animation advances.
- The change preserves vote decisions, animation timing, rationale cards, and voter order; it only improves threshold scanability inside the existing ceremony layout.
- Unity asset contracts now guard the threshold-meter helper and marker alongside the dense 15-player vote ceremony rail.

## 2026-06-04 Follow-up: Unity Nomination Debate Duel Rail

This follow-up continues public ceremony/stage polish by making the nomination debate read as a compact accusation-defense-vote sequence.

- The right action zone in `Nomination Debate Panel` now includes a fixed `Nomination Debate Duel Rail`.
- The rail shows `nominator -> nominee`, visible debate-line count, and the current duel state: waiting for defense, waiting for the human response, defense received, or ready to vote.
- A three-node track connects accusation, defense, and vote readiness without changing nomination, response, or vote-resolution behavior.
- Unity asset contracts now guard the duel rail, stage helper, state-label helper, and vote node marker.

## 2026-06-04 Follow-up: Unity Phase Assist Public Signal Strip

This follow-up continues public-table UI polish by making the phase-assist panel scan like a live conversation controller instead of only a hint box plus buttons.

- `Phase Assist Panel` now keeps a compact `Phase Assist Signal Strip` above the action buttons.
- During public conversation, the strip shows the active speaker, current focus target, and recommended next action from the existing `publicConversation` view model.
- The same strip also summarizes nomination-window and nomination-debate states, so the panel keeps a stable information rhythm as the table moves from public discussion to nomination and voting.
- A new `phase-assist-public` Unity smoke state enters public discussion through the normal action bridge and directly verifies this public phase-assist surface at screenshot time; the default smoke capture state list now includes it for future full-matrix runs.
- Unity asset contracts now guard the signal-strip root, chip helper, public-action label, nomination/debate labels, the dedicated smoke fixture, and default capture inclusion.

## 2026-06-04 Follow-up: Unity Endgame Recap Rail

This follow-up improves the final result surface by connecting the end-state verdict to the replay/review path.

- The right-side final event area in `Endgame Panel` now includes an `Endgame Event Recap Rail` above the event cards.
- The rail shows the final-event count, a compact result -> evidence review -> new game path, and a short recap hint derived from the available final events.
- Existing winner/reason/stat cards, final event rows, close/review/new-game actions, and outcome view model data stay unchanged.
- Unity asset contracts now guard the recap rail root, render helper, review node call, and endgame smoke fixture.

## 2026-06-04 Follow-up: Unity UI Audio Modal Regression Contract

This follow-up closes the most concrete audio/BGM UI regression gap with a dedicated static contract.

- Added `tests/unity_ui_audio_regression_contracts.mjs` and `npm run test:unity-ui-audio`.
- The contract verifies that Unity BGM mood changes are centralized in `Start()` and `RenderAllAndMood()`, instead of being triggered by modal open/close paths.
- It also verifies that `SetMood(...)` keeps the current clip when the mood has not changed, and that common modal/backdrop/open/close methods do not call `SetMood(...)`, reload `AudioClip` resources, or directly restart `musicSource`.
- The root `npm test` path now includes this UI audio regression check after Unity asset contracts.

## 2026-06-04 Follow-up: Unity Full-State UI Baseline Refresh

This follow-up refreshes the accepted broad UI screenshot matrix after the Phase Assist public signal strip added a dedicated smoke state.

- Captured the current default 31-state x 3-viewport Unity UI smoke matrix in `output/unity-ui-smoke-full-baseline-31state-2026-06-04`, covering 93 screenshots across 1920x1080, 1600x900, and 1366x768.
- The refreshed matrix includes `phase-assist-public` plus the current vote ceremony, nomination debate, stage dialogue, private chat, endgame, recap, role/action, drawer, and transition polish surfaces.
- The verifier required all 31 states and all 3 viewports, then produced `screenshotCount = 93`, `failureCount = 0`, and `warningCount = 0`.
- Manual spot checks of the 1366x768 `phase-assist-public`, `nomination-debate`, and `endgame` screenshots showed the new public signal strip, duel rail, and recap rail staying readable without obvious overlap.

## 2026-06-04 Follow-up: Unity Full-State UI Gate

This follow-up turns the accepted 31-state screenshot matrix into a repeatable developer gate.

- Added `tools/verify_unity_full_ui_baseline.ps1`, initially defaulting to `output/unity-ui-smoke-full-baseline-31state-2026-06-04\manifest.json`.
- Added `npm run unity:ui-smoke:verify:full` so future UI passes can verify the full accepted matrix without manually copying the 31 required states and 3 required viewports.
- The full gate fails warnings by default, because the accepted baseline currently has zero verifier warnings and zero failures.
- Unity asset contracts now compare the full-gate `RequiredStates` against the default capture script state list, preventing the gate from drifting behind newly added smoke states.

## 2026-06-04 Follow-up: Unity Private Chat Latest Focus Spotlight

This follow-up continues Private Chat's move from tool panel toward dialogue stage by making the current transcript focus visible.

- The latest visible private-chat bubble now receives a `Private Latest Bubble Spotlight`: a fine frame, subtle glow, side rail, and compact focus tag.
- Pending private replies use the same spotlight treatment with a waiting label, so players can distinguish "latest sent, waiting for response" from older transcript history.
- This preserves timeline filtering, rendered-entry limits, scroll position behavior, pending-action handling, compose controls, and all private-message payload flow.
- Unity asset contracts now guard the latest-focus helper, spotlight frame, rail, focus tag, and `isLatestVisible` path.
- Targeted smoke passed for `private-chat` and `private-chat-long` across 1920x1080, 1600x900, and 1366x768 with 6 screenshots, zero warnings, and zero failures.
- At this point the accepted full-state baseline was refreshed to `output\unity-ui-smoke-full-baseline-private-latest-spotlight-2026-06-04`, covering 31 states x 3 viewports, 93 screenshots, zero warnings, and zero failures. It was superseded by the 2026-06-05 Stage Dialogue speaker spotlight baseline below.

## 2026-06-04 Follow-up: Evil Private Pressure Plan Dedup

This follow-up tightens evil private coordination speech without changing hidden-info visibility, target selection, or vote/nomination logic.

- Evil claim-to-ally replies now detect when the public-cover sentence already names the pressure target and plan, such as putting a player on the firepoint and asking for identity/night info.
- When that plan is already present, the follow-up sentence advances the plan toward response quality and possible nomination instead of restating the same firepoint action.
- Added `evilPrivatePressurePlanDedupCoverage = 1` to the fixed AI evaluator and contract tests, requiring TB/BMR/SnV evil private coordination rows to avoid repeating `火力点` or `先问身份和夜里信息` in the same spoken reply.
- Root and Unity embedded `ai.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot remains 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.944`, `evilPrivateCoordinationCoverage = 1`, `evilPrivatePressurePlanDedupCoverage = 1`, `aiToAiEvilCoordinationCoverage = 1`, `repetitionRate = 0.268`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: Nomination Strategy Plan Dedup

This follow-up tightens nomination strategy speech so the target-choice sentence and strategy-rationale sentence do not repeat the same action plan.

- `coalition-check`, `avoid-no-execution`, and `execution-info` strategy rationale lines now preserve their mode and vote estimate while moving to the next layer of meaning: whether the table can form a vote, whether the execution window is preserved, or whether the defense quality is worth testing.
- Fixed samples no longer say the same plan twice, such as `先用9号这一票把流程压力打出来` followed by `先把流程压力打出来`.
- Added `nominationStrategyPlanDedupCoverage = 1` to the fixed AI evaluator and contract tests, checking strategy rows for repeated `流程压力打出来`, `看谁愿意跟`, and `执行信息` action phrases.
- Root and Unity embedded `ai.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot remains 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.944`, `nominationActionContextCoverage = 1`, `nominationStrategyModeCoverage = 1`, `nominationStrategyPlanDedupCoverage = 1`, `repetitionRate = 0.265`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: Evil Public Claim-Cover Plan Dedup

This follow-up tightens public evil claim-cover speech where the same visible pivot/protect action could be repeated before the verification cue.

- Public evil claim-cover pivot/protect lines still surface the public-safe move, such as switching to a new target, spreading pressure, or redistributing table pressure.
- When the same action phrase already appears earlier in the line, the later verification sentence now starts directly with `核法是...` instead of repeating the pivot/protect action before the question.
- Added `evilPublicClaimCoverPlanDedupCoverage = 1` to the fixed AI evaluator and contract tests, checking long-arc and cross-script evil claim-cover rows for repeated `这轮先转到`, `台面压力别只堆一处`, `别只压一个点`, and `压力重新分配一下` phrases.
- Root and Unity embedded `ai_public_discussion.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot remains 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.944`, `evilPublicClaimCoverPivotCoverage = 1`, `evilPublicClaimCoverProtectAllyCoverage = 1`, `evilPublicClaimCoverDeceptionArcCoverage = 1`, `evilPublicClaimCoverPressureContinuityCoverage = 1`, `evilPublicClaimCoverPlanDedupCoverage = 1`, `repetitionRate = 0.270`, and `stanceContinuityRate = 1`.

## 2026-06-04 Follow-up: Nomination Defense Info Dedup

This follow-up tightens nominee defense speech so the claim lane and vote-threshold sentence do not repeat the same information plan.

- Nominee defenses still answer the concrete nomination reason, keep a public-safe claim lane, and state what should happen if the defense does or does not connect.
- When the nomination reason already names `昨晚信息`, the claim lane now uses `关键口径`; defense options move to `身份口径`, `公开口径`, or `身份线和票型` instead of restating `昨晚信息` / `我的信息`.
- Added `nominationDefenseInfoDedupCoverage = 1` to the fixed AI evaluator and contract tests, checking every nomination-defense response row for repeated `昨晚信息` and `我的信息` phrases.
- Root and Unity embedded `ai.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot remains 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.944`, `nominationDefenseResponseCoverage = 1`, `nominationDefenseInfoDedupCoverage = 1`, `nominationDefenseReasonAnchorCoverage = 1`, `crossScriptNominationDefenseReasonAnchorCoverage = 1`, `repetitionRate = 0.270`, and `stanceContinuityRate = 1`.

## 2026-06-05 Follow-up: Claim Disclosure Surface Dedup

This follow-up tightens claim-disclosure speech so continuity, hard-claim action, and role-risk explanation do not repeat the same surface phrase.

- Hard-claim escalation now says the line is moving from a range to `具体身份`, then lets the action sentence name the role once, e.g. `我选择明跳教授...`.
- Role-constrained public claim lines now separate boundary and consequence: the spoken boundary can say `功能风险`, `公开坐实`, `具体身份`, or `死亡触发身份`, while the reason sentence explains the table risk without repeating that same phrase.
- Added `claimDisclosureSurfaceDedupCoverage = 1` to the fixed AI evaluator and contract tests, checking claim continuity and role-constrained claim rows for repeated `具体身份`, `功能风险`, `公开坐实`, `死亡触发身份`, and `明跳<role>` phrases.
- Root and Unity embedded `ai_claim_policy.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot remains 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.952`, `claimDisclosureContinuityCoverage = 1`, `claimDisclosureContinuityModeCoverage = 1`, `claimDisclosureSurfaceDedupCoverage = 1`, `roleConstrainedClaimDisclosureCoverage = 1`, `repetitionRate = 0.273`, and `stanceContinuityRate = 1`.

## 2026-06-05 Follow-up: Private Source-Identity Synthesis Dedup

This follow-up tightens private evidence synthesis where source reliability and identity mismatch are combined.

- Source-identity private reasoning now says `来源链和身份口径卡在一起` at the synthesis layer, then leaves the concrete source recheck to the verification sentence.
- The source-identity samples no longer repeat the old action shape `来源不稳和身份...再对一下` before also asking which source can be rechecked.
- Added `privateEvidenceSynthesisSourceIdentityDedupCoverage = 1` to the fixed AI evaluator and contract tests, checking source-identity private synthesis rows for repeated `来源不稳` and `再对一下` wording.
- Root and Unity embedded `ai.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot remains 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.952`, `privateEvidenceSynthesisVariantCoverage = 1`, `privateEvidenceSynthesisVerificationCoverage = 1`, `privateEvidenceSynthesisSpokenVerificationCoverage = 1`, `privateEvidenceSynthesisSourceIdentityDedupCoverage = 1`, `repetitionRate = 0.273`, and `stanceContinuityRate = 1`.

## 2026-06-05 Follow-up: Private Vote-Taxonomy Synthesis Dedup

This follow-up separates vote-source reliability from vote-motive taxonomy in private evidence synthesis.

- Protection-vote private reasoning now uses the source/timeline sentence to ask whether the counter-vote is an independent action and whether same-source follow votes should be discounted.
- The motive/burden sentence keeps the taxonomy layer, splitting whether the vote was self-preservation, following, or actively pushing, so the same classification no longer appears in both layers.
- Added `privateEvidenceSynthesisVoteTaxonomyDedupCoverage = 1` to the fixed AI evaluator and contract tests, checking protection-vote private synthesis rows for repeated `自保`, `跟风`, and `主动推人` wording.
- Root and Unity embedded `ai.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot remains 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.952`, `privateSourceTimelineCompressionCoverage = 1`, `privateDeepReasoningCompressionCoverage = 1`, `privateEvidenceSynthesisVoteTaxonomyDedupCoverage = 1`, `repetitionRate = 0.274`, and `stanceContinuityRate = 1`.

## 2026-06-05 Follow-up: Unity Stage Dialogue Speaker Spotlight

This follow-up continues the bottom dialogue stage pass by making the active speaker-to-speech relationship visible without changing dialogue queue, paging, source routing, or button behavior.

- Added a low-opacity `Stage Dialogue Speaker Spotlight` plus `Stage Dialogue Speaker Beam`, `Stage Dialogue Speaker Beam Core`, and `Stage Dialogue Speaker Beam Pin` behind the active portrait and speech card.
- The new spotlight colors update through `StageDialogueContextAccent(...)`, so private, timeline, recap, nomination, and event-sourced dialogue keep distinct route accents.
- Unity asset contracts now guard the spotlight fields, builder, update helper, beam objects, and typing-state opacity path.
- Tightened `tools\capture_unity_ui_smoke.ps1` by extending the Unity internal screenshot wait from 12 seconds to 24 seconds after a transient 1366x768 capture fallback produced a wrong-size window grab.
- Validation passed: `node --check tests\unity_asset_contracts.mjs`, `npm run test:unity-assets`, Unity batch build, targeted `stage-dialogue` / `stage-dialogue-queued` smoke captures across 1920x1080, 1600x900, and 1366x768 with 6 screenshots, zero warnings, and zero failures.
- The current accepted full-state baseline was refreshed to `output\unity-ui-smoke-full-baseline-stage-speaker-spotlight-2026-06-05-r2`, covering 31 states x 3 viewports, 93 screenshots, zero warnings, and zero failures; `tools\verify_unity_full_ui_baseline.ps1` now defaults to this manifest and `npm run unity:ui-smoke:verify:full` passed.

## 2026-06-05 Follow-up: Unity Vote Ceremony Active Voter Spotlight

This follow-up continues the high-density vote ceremony pass by making the active voter legible in the 15-player ring without changing vote order, tally resolution, rationale cards, or bridge payloads.

- Added `RenderVoteActiveVoterSpotlight(...)` behind the current voter token, drawing a low-opacity center-to-token beam, beam core, token spotlight, halo, and pin before the token itself is rendered.
- The spotlight uses `VoteActiveVoterAccent(...)`, so unrevealed, raised, abstaining, and revealed no-vote states keep distinct readable accents while preserving the existing token color semantics.
- Unity asset contracts now guard the active-voter helper, spotlight/beam/halo object names, accent helper, accepted full-baseline path, and smoke capture retry behavior.
- Tightened `tools\capture_unity_ui_smoke.ps1` again so an individual state/viewport retries once after transient screenshot validation failure instead of failing the whole 31-state matrix on a wrong-size fallback capture.
- Validation passed: `node --check tests\unity_asset_contracts.mjs`, `npm run test:unity-assets`, Unity batch build, targeted `vote-ceremony` smoke captures across 1920x1080, 1600x900, and 1366x768 with 3 screenshots, zero warnings, and zero failures.
- The current accepted full-state baseline was refreshed to `output\unity-ui-smoke-full-baseline-vote-active-spotlight-2026-06-05-r2`, covering 31 states x 3 viewports, 93 screenshots, zero warnings, and zero failures; `tools\verify_unity_full_ui_baseline.ps1` now defaults to this manifest and `npm run unity:ui-smoke:verify:full` passed.

## 2026-06-05 Follow-up: Unity Nomination Debate Focus Strip

This follow-up continues public nomination UI polish by making the active accusation-defense-vote state visible in the debate header without changing nomination payloads, debate response flow, vote transition behavior, or rationale-card rendering.

- Added `Nomination Debate Focus Strip` to the nomination debate header, with nominator, nominee, and current duel-state chips connected by subtle route beams.
- The strip reuses `NominationDebateDuelStageIndex(...)` and `NominationDebateDuelStateLabel(...)`, so the header cue and existing right-side duel rail stay semantically aligned.
- Active focus chips now get a stronger fill, frame, accent, and underline, while inactive chips remain muted enough not to compete with rationale cards or response rows.
- Unity asset contracts now guard `nominationDebateFocusRoot`, `RenderNominationDebateFocusStrip(...)`, focus route beams, active underline, and the refreshed accepted full-baseline path.
- Validation passed: `node --check tests\unity_asset_contracts.mjs`, `npm run test:unity-assets`, Unity batch build, targeted `nomination-debate` smoke captures across 1920x1080, 1600x900, and 1366x768 with 3 screenshots, zero warnings, and zero failures.
- The current accepted full-state baseline was refreshed to `output\unity-ui-smoke-full-baseline-nomination-focus-strip-2026-06-05`, covering 31 states x 3 viewports, 93 screenshots, zero warnings, and zero failures; `tools\verify_unity_full_ui_baseline.ps1` now defaults to this manifest and the full verifier passed.

## 2026-06-05 Follow-up: Unity Endgame Verdict Focus Strip

This follow-up continues endgame review polish by making the final verdict, game cycle, and review count visible in the endgame header without changing winner resolution, replay buttons, recap routing, or final-event data.

- Added `Endgame Verdict Focus Strip` to the endgame header with winner, D/N cycle, and review-event chips connected by subtle route markers.
- The strip reuses `OutcomeWinnerLabel()`, `EndgameWinnerAccent()`, current day/night, and the same `finalEvents` / fallback `events` source that feeds the existing right-side recap rail.
- The winner chip uses the winning-team accent while cycle and review chips stay muted, so the strip gives a quick verdict scan without competing with the main result hero.
- Unity asset contracts now guard `endgameVerdictFocusRoot`, `RenderEndgameVerdictFocusStrip(...)`, verdict connectors, chip helper, and the refreshed accepted full-baseline path.
- Validation passed: `node --check tests\unity_asset_contracts.mjs`, `npm run test:unity-assets`, Unity batch build, targeted `endgame` smoke captures across 1920x1080, 1600x900, and 1366x768 with 3 screenshots, zero warnings, and zero failures.
- The current accepted full-state baseline was refreshed to `output\unity-ui-smoke-full-baseline-endgame-verdict-focus-2026-06-05`, covering 31 states x 3 viewports, 93 screenshots, zero warnings, and zero failures; `tools\verify_unity_full_ui_baseline.ps1` now defaults to this manifest and the full verifier passed.

## 2026-06-05 Follow-up: Cross-Day Reason Recap Dedup Gate

This follow-up locks the current cross-day stance speech behavior so memory recap and evidence anchoring stay in separate layers.

- Cross-day public stance lines now use the memory recap to state continuity or evidence-volume movement, while the later evidence anchor owns the concrete current reason.
- Added `crossDayStanceReasonRecapDedupCoverage = 1` to the fixed AI evaluator and contract tests, checking that each cross-day row cites the current reason once rather than repeating it in both the recap and evidence anchor.
- Root and Unity embedded `ai.js` copies are hash-synced, and root/Unity `ai_quality_eval.mjs` copies are hash-synced with the new metric.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot remains 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.952`, `crossDayStanceContinuityCoverage = 1`, `crossDayStanceReasonCoverage = 1`, `crossDayStanceReasonRecapDedupCoverage = 1`, `crossDayStanceEvidenceDeltaCoverage = 1`, `crossScriptCrossDayStanceCoverage = 1`, `repetitionRate = 0.270`, and `stanceContinuityRate = 1`.

## 2026-06-05 Follow-up: Private Deep Reasoning Lead Dedup

This follow-up keeps private deep reasoning layered without making consecutive audit sentences repeat the same target lead.

- Private source/timeline compression still names the target pair or vote seat, e.g. `4号和2号的来源和时间线一起看...`.
- The following motive/burden compression now continues as `动机和举证一起看...` instead of repeating `4号和2号的动机和举证一起看...`.
- Added `privateDeepReasoningLeadDedupCoverage = 1` to the fixed AI evaluator and contract tests, guarding private reason rows that contain both source/timeline and motive/burden compression.
- Root and Unity embedded `ai.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot remains 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.952`, `privateSourceTimelineCompressionCoverage = 1`, `privateDeepReasoningCompressionCoverage = 1`, `privateDeepReasoningBrevityCoverage = 1`, `privateDeepReasoningLeadDedupCoverage = 1`, `privateEvidenceSynthesisCoverage = 1`, `repetitionRate = 0.285`, and `stanceContinuityRate = 1`.

## 2026-06-05 Follow-up: Public Pressure Action Lead Dedup

This follow-up tightens high-pressure public speech so the same visible pressure action is not stated twice in one line.

- Public pressure lines still preserve urgency and persona texture, but final surface polish now removes repeated action leads such as `我会先压9号...我先压9号...`.
- Shadow pressure lines keep the cautious framing while avoiding the matching duplicate form `我先暗记9号这条主线...9号我先暗记成主线...`.
- Added `publicPressureActionLeadDedupCoverage = 1` to the fixed AI evaluator and contract tests, guarding public pressure rows across persona, timing, role, and high-focus variants.
- Root and Unity embedded `ai_public_discussion.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot remains 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.952`, `publicPersonaPressureVariantCoverage = 1`, `publicShadowPressureLineDiversityCoverage = 1`, `publicPressureActionLeadDedupCoverage = 1`, `repetitionRate = 0.283`, and `stanceContinuityRate = 1`.

## 2026-06-05 Follow-up: Private Deep Reasoning Heading Variants

This follow-up makes private deep reasoning read less like repeated audit headings while preserving the same source/timeline and motive/burden reasoning layers.

- Private source/timeline compression now varies headings such as `来源和节奏合起来`, `这条线先拆来源`, `这票先拆来源`, and `这边先看回应先后` instead of always saying `来源和时间线一起看`.
- Private motive/burden compression now varies headings such as `动机和理由合起来`, `再看票的收益`, `再看收益和举证`, and `最后看谁该说明` instead of always saying `动机和举证一起看`.
- Added `privateDeepReasoningHeadingVariantCoverage = 1` to the fixed AI evaluator and contract tests, requiring at least three source/timeline heading variants and at least three motive/burden heading variants across private reason samples.
- Root and Unity embedded `ai.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot remains 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.952`, `privateSourceTimelineCompressionCoverage = 1`, `privateDeepReasoningCompressionCoverage = 1`, `privateDeepReasoningCompressionVariantCoverage = 1`, `privateDeepReasoningHeadingVariantCoverage = 1`, `privateDeepReasoningBrevityCoverage = 1`, `privateDeepReasoningLeadDedupCoverage = 1`, `repetitionRate = 0.285`, and `stanceContinuityRate = 1`.

## 2026-06-05 Follow-up: Private Reason Opening Lead Variants

This follow-up removes the last fixed lead from private reason replies, so direct answers no longer all begin with `先给结论：`.

- Private reason openings now rotate through human cadence leads such as `我先不把话说死，先说排序。`, `这条我先看，但不锁死。`, `我先点这条，先别当铁证。`, and `我暂时不换目标，先放主线。`.
- The existing private reason contracts still require the opening to avoid repeating the focus seat and to remain a standalone sentence before evidence details begin.
- Added `privateReasonOpeningLeadVariantCoverage = 1` to the fixed AI evaluator and contract tests, requiring at least three opening lead variants and rejecting rows that fall back to the old fixed `先给结论：` lead.
- Root and Unity embedded `ai.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot remains 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.952`, `privateReasonOpeningRedundancyCoverage = 1`, `privateReasonOpeningVariantCoverage = 1`, `privateReasonOpeningLeadVariantCoverage = 1`, `privateReasonOpeningSentenceCoverage = 1`, `repetitionRate = 0.285`, and `stanceContinuityRate = 1`.

## 2026-06-05 Follow-up: Private Reason Opening Lead Distribution Gate

This follow-up deepens private reason opening naturalization: private reason replies now need broader distribution across cautious direct-answer leads, not just a non-`先给结论：` opening.

- `privateReasonOpeningBridgeForSeat(...)` now has eight cautious leads, adding `先把排序说清，但不拍死`, `我先按主线排，不当铁证`, `先给你一个暂定排序`, and `这条先当主线，不急着拍死`.
- Bridge selection now salts by seat plus the current reply body, so similar multi-evidence rows no longer collapse into `我先不把话说死，先说排序`.
- `privateReasonOpeningVariantCoverage` and `privateReasonOpeningLeadVariantCoverage` now require at least five opening variants/leads, still reject `先给结论：`, and fail if one lead dominates private reason rows.
- Contract tests now assert the expanded lead set, at least five private opening leads, and bounded dominance while keeping the standalone-sentence and no-focus-repeat checks.
- Root and Unity embedded `ai.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `node scripts\ai_quality_eval.mjs`, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, root/Unity no-index sync checks, `git diff --check`, and trailing-whitespace checks. Current fixed snapshot remains 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.952`, `privateReasonOpeningVariantCoverage = 1`, `privateReasonOpeningLeadVariantCoverage = 1`, `privateReasonOpeningSentenceCoverage = 1`, `repetitionRate = 0.194`, and `stanceContinuityRate = 1`.

## 2026-06-05 Follow-up: Private Verification Lead Naturalization

This follow-up removes the report-like `验证点是...` lead from private reason spoken text while preserving the structured `decisionRationale.verificationLine` field.

- Private spoken verification now uses table-chat leads such as `先听...`, `先核...`, `这条先问...`, and `这条先让...` before the concrete verification action.
- The underlying decision package still keeps `verificationLine`, so tests and UI metadata can audit the same verification plan even though the spoken text is less report-like.
- Added `privateVerificationLeadNaturalizationCoverage = 1` to the fixed AI evaluator and contract tests, covering private reason rows where a verification action is actually spoken.
- Root and Unity embedded `ai.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot remains 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.952`, `privateEvidenceSynthesisSpokenVerificationCoverage = 1`, `privateVerificationLeadNaturalizationCoverage = 1`, `repetitionRate = 0.285`, and `stanceContinuityRate = 1`.

## 2026-06-05 Follow-up: Public Evidence Anchor Lead Variants

This follow-up removes the repeated public evidence lead `证据卡在：两条线索合在一起：...` without weakening the evidence anchor itself.

- Public multi-evidence anchors now strip the structural `两条线索合在一起：` prefix before speaking, then use table-chat leads such as `这两点合着看：...`, `我卡的是这组线索：...`, `不止一条线在指这里：...`, and `桌面问题连在一起：...`.
- The public claim/disclosure surface path also naturalizes the same structure, so `卡在两条线索合在一起：...` becomes `卡在这两点合着看：...`.
- The evaluator now matches public evidence by both full `evidenceSpokenText` and the stripped evidence body, preserving cross-script public reasoning, cross-day stance, and priority-signal gates while allowing less mechanical speech.
- Added `publicEvidenceAnchorLeadVariantCoverage = 1` to the fixed AI evaluator and contract tests, requiring varied natural public evidence anchor leads and rejecting the old stacked label.
- Root and Unity embedded `ai.js`, `ai_public_discussion.js`, and `ai_quality_eval.mjs` copies were kept in sync.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot remains 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.952`, `publicEvidenceSynthesisCoverage = 1`, `publicEvidenceSynthesisLabelStackCoverage = 1`, `publicEvidenceAnchorLeadVariantCoverage = 1`, `publicPrioritySignalCoverage = 1`, `repetitionRate = 0.248`, and `stanceContinuityRate = 1`.

## 2026-06-05 Follow-up: Public Evidence Anchor Lead Distribution Gate

This follow-up deepens the previous public evidence-anchor naturalization pass: public multi-evidence rows now need broader lead distribution, not just a non-stacked lead.

- Public evidence anchor leads gained additional table-chat variants such as `两条线先并起来看`, `这组关系不能拆开看`, `不是单点，线索接在一起`, `先把这组线放到同一桌面`, `我先按这组矛盾追问`, and `这里要把两边一起验`.
- Low-evidence two-line anchors also gained softer variants such as `先按两条弱线对账`, `证据不厚，先把两边接住`, and `这组线还要补证`.
- The final public surface polish now rewrites `我先按这组矛盾追问，两条线索合在一起：...` into `我先按这组矛盾追问：...`, so newly naturalized leads do not keep the raw structural prefix.
- `publicEvidenceAnchorLeadVariantCoverage` now requires recognized anchor leads, at least five lead variants, and no single lead dominating fixed public multi-evidence rows.
- Contract tests now assert the expanded lead set, reject both old stacked labels and new `lead，两条线索合在一起：...` stacks, and check row-level lead dominance.
- Root and Unity embedded `ai_public_discussion.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `node scripts\ai_quality_eval.mjs`, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, root/Unity no-index sync checks, `git diff --check`, and trailing-whitespace checks. Current fixed snapshot remains 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.952`, `publicEvidenceAnchorLeadVariantCoverage = 1`, `publicEvidenceSynthesisLabelStackCoverage = 1`, `publicEvidenceSynthesisCoverage = 1`, `repetitionRate = 0.201`, and `stanceContinuityRate = 1`.

## 2026-06-05 Follow-up: Claim Disclosure Hold Lead Variants

This follow-up removes the repeated hold-continuity lead `延续前面的身份口径，仍按...` without changing disclosure level decisions.

- Hold claim-disclosure continuity now uses stable table-chat variants such as `身份线我不改，今天仍按...`, `前面这条身份我先不换，继续按...`, and `我不无理由改口，...这条继续放桌面上`.
- `claimDisclosureRationale.continuityLine` remains the auditable metadata source, and the final spoken text must still include that exact continuity line.
- Added `claimDisclosureHoldLeadVariantCoverage = 1` to the fixed evaluator and contract tests, requiring all hold rows to avoid the old fixed lead and requiring at least three natural lead variants.
- Root and Unity embedded `ai_claim_policy.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, root/Unity no-index sync checks, `git diff --check`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot remains 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.952`, `claimDisclosureContinuityCoverage = 1`, `claimDisclosureSurfaceDedupCoverage = 1`, `claimDisclosureHoldLeadVariantCoverage = 1`, `publicEvidenceAnchorLeadVariantCoverage = 1`, `repetitionRate = 0.258`, and `stanceContinuityRate = 1`.

## 2026-06-05 Follow-up: Public Verification Lead Variants

This follow-up reduces the repeated public verification lead `核法是先听...` without weakening the concrete verification action.

- Public synthesis verification now uses stable table-chat leads such as `核法是先听...`, `这条先让...`, `先请...`, and `核法先交给...来`.
- The same verification content still names the target and asks for the evidence-specific action: identity/vote alignment, vote-vs-pressure explanation, identity-vs-nomination explanation, or pressure-vs-nomination explanation.
- Expanded `dedupePublicEvilPlanBeforeVerification(...)` so evil claim-cover pivot/protect lines still drop duplicated strategy-action text before any of the new verification leads.
- Added `publicVerificationLeadVariantCoverage = 1` to the fixed evaluator and contract tests, requiring at least three public verification lead variants.
- Root and Unity embedded `ai_public_discussion.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, root/Unity no-index sync checks, `git diff --check`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot remains 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.952`, `publicVerificationLeadVariantCoverage = 1`, `publicEvidenceSynthesisSpokenVerificationCoverage = 1`, `publicEvidenceSynthesisSpokenVerificationVariantCoverage = 1`, `evilPublicClaimCoverPlanDedupCoverage = 1`, `repetitionRate = 0.241`, and `stanceContinuityRate = 1`.

## 2026-06-05 Follow-up: Balanced Claim Disclosure Reason Variants

This follow-up removes the repeated balanced-disclosure reason `当前适合给可追问口径，但不一定一次交死` while keeping the same disclosure level and reason key.

- `balanced_disclosure` now chooses deterministic public-safe reason variants based on disclosure level, visible role/range, audience, continuity, day, and channel.
- Hard-claim lines now say why a concrete role needs to become checkable, e.g. `现在需要把身份口径交到能被追问的程度`, `这轮要让桌面有具体口径可以复核`, or `继续含糊只会让后续追问失焦`.
- Range/vague lines now keep the cautious boundary explicit, e.g. `先给桌面能追问的边界，不把具体身份一次说死`, `这轮先让口径可追问，身份细节等压力再补`, or `先把可验证边界放出来，不急着把整条身份线摊完`.
- `reasonKey = balanced_disclosure`, disclosure level, `claimDisclosureRationale.line`, and continuity metadata remain unchanged as contracts; only the spoken reason surface varies.
- Added `claimDisclosureBalancedReasonVariantCoverage = 1` to the fixed evaluator and contract tests, requiring the old fixed reason to disappear and visible balanced-disclosure rows to cover at least three reason variants.
- Root and Unity embedded `ai_claim_policy.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, root/Unity no-index sync checks, `git diff --check`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot remains 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.952`, `claimDisclosureBalancedReasonVariantCoverage = 1`, `claimDisclosureRationaleCoverage = 1`, `claimDisclosureContinuityCoverage = 1`, `claimDisclosureHoldLeadVariantCoverage = 1`, `publicVerificationLeadVariantCoverage = 1`, `repetitionRate = 0.241`, and `stanceContinuityRate = 1`.

## 2026-06-05 Follow-up: Public Pressure Urgency Tail Variants

This follow-up reduces the repeated high-pressure public tail `别拖到票前才解释` without changing the pressure target or multi-evidence synthesis.

- Pressure-persona public multi-evidence lines still say `我会先压X号`, but the urgency tail now varies deterministically across `别拖到票前才解释`, `这轮就要先把回应补上`, `不要等到落票前才补口径`, `先在讨论阶段把解释说清`, and `票前再补就太晚了`.
- The target, score threshold, evidence count requirement, persona pressure line, and priority-fragment preservation remain unchanged.
- The evaluator now adds `publicPressureUrgencyTailVariantCoverage = 1`, requiring all public `我会先压X号` multi-evidence rows to use a recognized urgency tail and requiring at least three tail variants.
- Contract tests assert both the summary metric and row-level urgency-tail diversity over fixed public pressure rows.
- Root and Unity embedded `ai_public_discussion.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, root/Unity no-index sync checks, `git diff --check`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot remains 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.952`, `publicPressureUrgencyTailVariantCoverage = 1`, `publicPersonaPressureVariantCoverage = 1`, `publicPressureActionLeadDedupCoverage = 1`, `publicVerificationLeadVariantCoverage = 1`, `repetitionRate = 0.233`, and `stanceContinuityRate = 1`.

## 2026-06-05 Follow-up: Public Follow-up Tail Variants

This follow-up reduces repeated public verification tails such as `再说昨晚信息`, `再解释投票理由`, and `再补身份和昨晚信息` without changing target choice, evidence-family matching, or verification intent.

- Public verification actions now use deterministic action-family variants for identity/vote, pressure/vote, identity/nomination, pressure/nomination, vote-only, identity-only, unclear, and evidence-position follow-ups.
- The same target and public verification lead are preserved, but tails can now say e.g. `再补投票理由`, `投票理由也要补清`, `再把身份和昨晚信息补齐`, `昨晚信息也要说完整`, `回应提名压力怎么解`, or `再解释提名压力`.
- Expanded evaluator recognition for naturalized verification actions such as `把身份和票型先对上`, `身份口径先对齐`, `把没讲清的点先补上`, and `压低证据位这点先讲清`.
- Fixed `publicEvidenceSynthesisSpokenVerificationVariantCoverage` so rows with multiple synthesis families pass when any synthesis/verification pair matches, instead of being forced to the first synthesis phrase.
- Added `publicFollowUpTailVariantCoverage = 1` to the fixed evaluator and contract tests, requiring all public verification follow-up tails to be recognized, requiring at least six tail variants, and preventing old `再说昨晚信息` from dominating.
- Updated the AI agent contract so public priority-budget evidence checks accept the naturalized stripped evidence body, matching current public evidence anchor behavior.
- Root and Unity embedded `ai_public_discussion.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, root/Unity no-index sync checks, `git diff --check`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot remains 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.952`, `publicFollowUpTailVariantCoverage = 1`, `publicEvidenceSynthesisSpokenVerificationCoverage = 1`, `publicEvidenceSynthesisSpokenVerificationVariantCoverage = 1`, `publicVerificationLeadVariantCoverage = 1`, `publicPressureUrgencyTailVariantCoverage = 1`, `repetitionRate = 0.236`, and `stanceContinuityRate = 1`.

## 2026-06-05 Follow-up: Private Runner-up Comparison Line Variants

This follow-up reduces the repeated private reasoning comparison line `我先排X号，不是放过Y号：X号这边我可见的线索更多` without changing focus choice, runner-up tracking, evidence counts, score gaps, or decision reason keys.

- `buildReasoningContrastLine(...)` now chooses deterministic comparison variants salted by focus, runner-up, evidence counts, score gap, evidence mode, evidence-summary key, and public/private scope.
- The more-visible-evidence branch can now say e.g. `Y号不是放掉，只是X号这边我可见的证据更成组`, `X号先放主线，Y号留在第二层`, or `先处理X号，不是清掉Y号`, instead of always using the old `我先排...不是放过...` template.
- Higher-pressure, close-call, and score-order comparison branches also gained deterministic spoken variants while preserving the same structured `decisionRationale` focus/runner-up metadata.
- Private reason opening de-duplication now recognizes the new comparison forms, so `我先看X号。先处理X号...` and `我先看X号。X号先放主线...` are still rewritten into natural direct-answer openings.
- Added `privateRunnerUpComparisonLineVariantCoverage = 1` to the fixed evaluator and contract tests, requiring recognized private runner-up comparison lines, at least six normalized variants, no old-template dominance, and no single new variant dominance.
- Updated the AI agent contracts so multi-evidence private follow-up directions such as `逐条回应` and `支持者也要解释` count as valid question-answer shape endings.
- Root and Unity embedded `ai.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, root/Unity no-index sync checks, `git diff --check`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot remains 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.952`, `privateRunnerUpComparisonLineVariantCoverage = 1`, `runnerUpComparisonCoverage = 1`, `privateReasonOpeningRedundancyCoverage = 1`, `privateReasonOpeningVariantCoverage = 1`, `privateReasonOpeningLeadVariantCoverage = 1`, `publicFollowUpTailVariantCoverage = 1`, `repetitionRate = 0.232`, and `stanceContinuityRate = 1`.

## 2026-06-05 Follow-up: Private Deep Reasoning Tail Variants

This follow-up reduces repeated private deep-reasoning tails such as `同源回声降权`, `谁能自洽先降压`, and `支持者也要说清理由` without changing source/timeline, incentive, or burden-of-proof rationale metadata.

- `privateSourceTimelineCompressionLine(...)` and `privateIncentiveBurdenCompressionLine(...)` now use a full-text deterministic hash instead of only the first seat number, so different focus/runner-up pairs and evidence modes no longer collapse into the same tail.
- Source/timeline compression gained variants around independent source weighting, source order, vote source timing, mutual restatement, and response support, e.g. `先分来源再看节奏`, `这条先按来源拆开`, `先对来源独立性`, and `这票先看谁先动手`.
- Incentive/burden compression gained variants around benefit lines, proof burden, vote motive, and public responsibility, e.g. `票面动机要拆开`, `再看举证负担`, `收益线要拆开`, `再分动机和举证`, and `最后落到责任`.
- The evaluator now recognizes the new source/timeline and motive/burden headings plus their semantic tail keywords, rather than forcing old `同源回声` / `支持者说清理由` phrasing.
- Added `privateDeepReasoningTailVariantCoverage = 1` to the fixed evaluator and contract tests, requiring at least six normalized source/timeline tails, at least six normalized motive/burden tails, and no single tail dominating fixed private reason rows.
- Root and Unity embedded `ai.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, root/Unity no-index sync checks, `git diff --check`, and `node scripts\ai_quality_eval.mjs`. Current fixed snapshot remains 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.952`, `privateDeepReasoningTailVariantCoverage = 1`, `privateDeepReasoningCompressionVariantCoverage = 1`, `privateDeepReasoningHeadingVariantCoverage = 1`, `privateSourceTimelineCompressionCoverage = 1`, `privateDeepReasoningBrevityCoverage = 1`, `privateRunnerUpComparisonLineVariantCoverage = 1`, `repetitionRate = 0.227`, and `stanceContinuityRate = 1`.

## 2026-06-05 Follow-up: Claim Disclosure Hold Lead Distribution Gate

This follow-up tightens the previous claim-continuity naturalization pass: hard identity-hold rows no longer only need to avoid the old fixed lead, they now need broader distribution across natural hold leads.

- Hard hold continuity gained four more public-safe variants around keeping the same identity line checkable: `这条身份先沿用...`, `今天不重开身份线...`, `我先稳住...口径`, and `前面报过的...先不撤`.
- Variant selection now uses a dedicated rolling hash salted by level, visible role, reason key, audience, day, and channel, instead of only the visible role name; this keeps the same role/level/continuity metadata while reducing repeated surface phrasing across public and private rows.
- `claimDisclosureHoldLeadVariantCoverage` now requires at least five recognized hold-lead variants and fails if one lead dominates the fixed set.
- Contract tests now assert the expanded pattern set, row-level spoken continuity preservation, at least five hold-lead variants, and no single lead dominating the fixed rows.
- Root and Unity embedded `ai_claim_policy.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Latest validation passed: `node --check` on touched root and Unity JS/test files plus `node scripts\ai_quality_eval.mjs`. Current fixed snapshot remains 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.952`, `claimDisclosureHoldLeadVariantCoverage = 1`, `claimDisclosureContinuityCoverage = 1`, `claimDisclosureRationaleCoverage = 1`, `repetitionRate = 0.217`, and `stanceContinuityRate = 1`.

## 2026-06-05 Follow-up: Public Shadow Target Line Variants

This follow-up reduces the repeated shadow/public-cover line `我先暗记X号这条主线` while keeping the same target, pressure score, evidence synthesis, and public-safe cover intent.

- Shadow high-pressure public speech now routes target tracking through `publicShadowTargetLine(...)` instead of a single fixed `暗记主线` sentence.
- The target-tracking line can now say e.g. `X号这条先留在主线里`, `X号先挂观察位`, `这条先记在X号身上`, `X号这边先留一格压力`, `X号先留在台面压力线上`, `X号这边我先不放下`, `先把X号留在压力线上`, or `X号这条先记一笔`.
- Public pressure de-duplication now recognizes both the new shadow target lines and the old `暗记主线` line, so legacy corpus fragments such as `X号我先暗记成主线，需要听回应` are stripped when a new target-tracking line is already spoken.
- Added `publicShadowTargetLineVariantCoverage = 1` to the fixed evaluator and contract tests, requiring recognized shadow target-tracking lines, at least three variants, and no single line dominating.
- Root and Unity embedded `ai_public_discussion.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `node scripts\ai_quality_eval.mjs`, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, root/Unity no-index sync checks, and `git diff --check`. Current fixed snapshot remains 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.952`, `publicShadowTargetLineVariantCoverage = 1`, `publicShadowPressureLineDiversityCoverage = 1`, `publicPressureActionLeadDedupCoverage = 1`, `repetitionRate = 0.216`, and `stanceContinuityRate = 1`.

## 2026-06-05 Follow-up: Public Pressure Action Lead Variants

This follow-up keeps pressure-persona public target commitment intact while reducing the repeated action lead `我会先压X号`.

- `publicPersonaMultiEvidencePressureLine(...)` now routes the pressure action through `publicPressureActionLine(...)`, preserving the same target, evidence synthesis, evidence count, score threshold, and urgency-tail contract.
- The pressure action can now vary across table-chat forms such as `我会先压X号`, `这轮先压X号`, `我会直接压X号`, `先把X号压到桌面上`, `X号这边我先给压力`, and `X号先上压力`.
- Public pressure de-duplication now recognizes the expanded action-lead set and strips legacy corpus fragments such as `我先压X号，需要马上听回应` when a structured pressure action is already spoken.
- Added `publicPressureActionLeadVariantCoverage = 1` to the fixed evaluator and contract tests, requiring recognized pressure action leads, at least four variants, and no single lead dominating fixed pressure rows.
- Root and Unity embedded `ai_public_discussion.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Latest fixed snapshot remains 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.952`, `publicPressureActionLeadVariantCoverage = 1`, `publicPressureUrgencyTailVariantCoverage = 1`, `publicPressureActionLeadDedupCoverage = 1`, `repetitionRate = 0.214`, and `stanceContinuityRate = 1`.

## 2026-06-05 Follow-up: Evil Private Team/Cover Variants

This follow-up keeps evil-only private coordination hidden and strategically useful, while removing the repeated team-info and no-bluff cover-plan seams from same-team private rows.

- `composeHumanizedEvilAllianceResponse(...)` now routes hidden team recognition through `evilAllianceTeamInfoLine(...)`, so evil private rows can say `队伍先对齐...`, `我这边知道的底牌...`, `先把队伍信息放清...`, `邪恶视角先对底...`, or `我这边的队伍牌面...` instead of collapsing into one `先对底：恶魔位X号；爪牙同伴暂无` template.
- Empty-minion wording now varies across forms such as `其他爪牙暂无`, `暂时没有别的爪牙`, `旁边爪牙先记空`, `其他爪牙先不算`, and `爪牙同伴暂时没看到`, preserving the same hidden information while making the private line less mechanical.
- No-bluff pressure planning now routes through `evilAllianceNoBluffCoverPlanLine(...)`, varying table-facing cover plans such as `伪装先留活口`, `台面身份边走边补`, and `低信息好人方向先留着` while keeping the public pressure target and hidden-info boundary intact.
- The fixed evaluator adds `evilPrivateTeamInfoVariantCoverage = 1` and `evilPrivateCoverPlanVariantCoverage = 1`, requiring recognized variants, enough diversity, and no single team-info or cover-plan line dominating fixed evil private samples.
- Contract tests now assert the new summary metrics, reject the old fixed team-info sentence, check row-level variant distribution, and preserve the existing evil private / AI-AI coordination coverage.
- Root and Unity embedded `ai.js` / `ai_quality_eval.mjs` copies were kept in sync.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `node scripts\ai_quality_eval.mjs`, `npm run test:ai-quality-eval`, and `npm run test:ai-agents`. Current fixed snapshot remains 125 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.952`, `evilPrivateCoordinationCoverage = 1`, `evilPrivateTeamInfoVariantCoverage = 1`, `evilPrivateCoverPlanVariantCoverage = 1`, `aiToAiEvilCoordinationCoverage = 1`, `repetitionRate = 0.182`, and `stanceContinuityRate = 1`.

## 2026-06-05 Follow-up: Public Evidence Synthesis Explicit Modes

This follow-up expands the fixed AI quality set instead of changing AI decision behavior: public multi-evidence speech now has explicit fixtures for every synthesis + verification mode, so future regressions cannot hide behind incidental coverage from broader public rows.

- Public synthesis verification fixtures now cover four table-facing combinations: `identity-vote`, `pressure-vote`, `identity-nomination`, and `pressure-nomination`.
- The new `identity-vote` row verifies lines like `身份口径和票型一起压过来` plus a matching action such as asking the target to align identity, vote shape, and vote reason.
- The new `pressure-vote` row verifies lines like `台面压力和投票线同向` plus a matching action such as asking the target to explain why vote shape follows table pressure.
- Existing nomination synthesis rows remain covered: identity pressure into nomination must ask how identity resolves nomination pressure, while table pressure into nomination must ask what unresolved point pushed the target into nomination pressure.
- Added `publicEvidenceSynthesisExplicitModeCoverage = 1` to the fixed evaluator and contract tests, requiring the explicit public synthesis fixtures to cover all four modes, match the expected verification action, preserve multiple evidence summaries, and stay public-safe.
- Root and Unity embedded `ai_quality_eval.mjs` copies were kept in sync.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `node scripts\ai_quality_eval.mjs`, and `npm run test:ai-quality-eval`. Current fixed snapshot is 127 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.953`, `publicEvidenceSynthesisSpokenVerificationVariantCoverage = 1`, `publicEvidenceSynthesisExplicitModeCoverage = 1`, `publicVerificationLeadVariantCoverage = 1`, `repetitionRate = 0.181`, and `stanceContinuityRate = 1`.

## 2026-06-05 Follow-up: Public Table Speech Brevity Gate

This follow-up keeps public reasoning readable at the table: the fixed set now checks that public discussion lines do not grow back into long audit paragraphs as more rationale fragments are added.

- Added `publicTableSpeechBrevityCoverage = 1` to the fixed evaluator, measuring real `public-discussion` rows rather than private, vote, or nomination text.
- The gate requires every fixed public discussion row to stay within a 190-character one-line table-chat limit, preserving room for claim continuity, evidence synthesis, role/script context, and verification action without letting them stack indefinitely.
- Contract tests now assert both the summary metric and the actual longest public discussion row length, so future changes cannot pass by only reporting the metric.
- Root and Unity embedded `ai_quality_eval.mjs` copies were kept in sync.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `node scripts\ai_quality_eval.mjs`, and `npm run test:ai-quality-eval`. Current fixed snapshot is 127 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.953`, `publicEvidenceSynthesisExplicitModeCoverage = 1`, `publicTableSpeechBrevityCoverage = 1`, `repetitionRate = 0.181`, and `stanceContinuityRate = 1`.

## 2026-06-06 Follow-up: Public Evidence Anchor Body Dedup

This follow-up tightens public table speech polish by removing repeated natural evidence-anchor bodies after the public budget path restores verification actions.

- `polishPublicLineSurface(...)` now runs `dedupePublicEvidenceAnchorLine(...)` as a final surface pass, so both main public-discussion lines and later composed lines share the same anchor-body cleanup.
- Anchor dedupe treats exact repeats and long boundary-prefix repeats as the same body. This catches rows where the first anchor says `evidence body + verification action`, then a later sentence repeats only the evidence body.
- The fixed evaluator now gates `publicEvidenceAnchorDedupCoverage = 1`, and contract tests check both the summary metric and row-level duplicate/nested anchor bodies for public multi-evidence rows.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `node scripts\ai_quality_eval.mjs`, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and root/Unity no-index sync checks. Current fixed snapshot is 127 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.953`, `publicEvidenceAnchorDedupCoverage = 1`, `publicEvidenceAnchorLeadVariantCoverage = 1`, `publicTableSpeechBrevityCoverage = 1`, `repetitionRate = 0.171`, and `stanceContinuityRate = 1`.

## 2026-06-06 Follow-up: Public Clipped Evidence Fragment Cleanup

This follow-up removes remaining `...` / `…` evidence shards from public table speech, especially cross-script target-switch and public synthesis rows where budgeted evidence text had leaked as half-phrases.

- `buildDecisionTargetSwitchLine(...)` now turns long current-reason summaries into spoken target-switch clauses such as `票型需要重新对账` or `公开压力要重新对齐`, rather than exposing truncated `两条线索合在一起：...` evidence summaries.
- `polishPublicLineSurface(...)` now runs clipped-evidence cleanup after the existing surface pass, repairing forms such as `公开站队和...`, `投票理...`, and `票型跟...` into complete table-chat phrases.
- The public evidence clarity gate now recognizes those newer clipped fragments, and contract tests scan each fixed public evidence row for them. `publicSurfacePolishCoverage` also treats `来先` as a public wording artifact.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `node scripts\ai_quality_eval.mjs`, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and root/Unity no-index sync checks. Current fixed snapshot is 127 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.953`, `publicEvidenceFragmentClarityCoverage = 1`, `publicSurfacePolishCoverage = 1`, `publicTableSpeechBrevityCoverage = 1`, zero public ellipsis rows, zero `来先` rows, `repetitionRate = 0.175`, and `stanceContinuityRate = 1`.

## 2026-06-06 Follow-up: Public Action-First Surface Polish

This follow-up smooths public verification/action wording by removing duplicated `先` markers that made table speech sound generated rather than spoken.

- `polishPublicLineSurface(...)` now rewrites `先请X号先...`, `把身份和票型先对上/对齐`, and `把没讲清的点先补上` into single-action forms.
- `publicSurfacePolishCoverage` now treats those duplicate action-first phrases as public wording artifacts, and contract tests scan every public row for the same pattern.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `node scripts\ai_quality_eval.mjs`, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, and root/Unity no-index sync checks. Current fixed snapshot is 127 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.953`, `publicSurfacePolishCoverage = 1`, zero public duplicate-action-first rows, `publicEvidenceFragmentClarityCoverage = 1`, `publicTableSpeechBrevityCoverage = 1`, `repetitionRate = 0.177`, and `stanceContinuityRate = 1`.

## 2026-06-06 Follow-up: Non-Public Seat Verb Spacing

This follow-up closes a private-surface polish leak where runner-up comparison lines could still say `先处理 4号` or `不是清掉 2号` after deep-reasoning fragments were injected.

- `polishChineseSeatSpacing(...)` now covers `清掉`、`处理`、`验` before seat labels, and private final response exits re-run that polish after evidence-contract / deep-reasoning insertion.
- `nonPublicSurfacePolishCoverage` now treats those verb-to-seat spaces as non-public wording artifacts, and contract tests scan every non-public row for the same pattern.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `node scripts\ai_quality_eval.mjs`, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, targeted zero-row non-public verb-seat scan, and root/Unity no-index sync checks. Current fixed snapshot is 127 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.953`, `nonPublicSurfacePolishCoverage = 1`, zero non-public verb-seat spacing rows, `publicSurfacePolishCoverage = 1`, `privateDeepReasoningSpokenCoverage = 1`, `repetitionRate = 0.177`, and `stanceContinuityRate = 1`.

## 2026-06-06 Follow-up: Evil Public Maintenance Lead Dedup

This follow-up removes repeated public pressure leads from evil cover-maintenance speech while preserving table-safe continuity wording.

- `polishPublicLineSurface(...)` now removes an earlier pressure lead when a later public sentence starts with the same target-pressure body and extends it with verification, e.g. the short `6号这条不单看...继续压` sentence no longer repeats before the fuller `核法是...` sentence.
- The fixed evaluator adds `evilPublicCoverMaintenanceDedupCoverage = 1`, and contract tests scan `requiresEvilCoverMaintenance` rows for repeated pressure-lead extensions.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `node scripts\ai_quality_eval.mjs`, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, targeted maintenance-row lead-count scan, and root/Unity no-index sync checks. Current fixed snapshot is 127 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.953`, `evilPublicCoverMaintenanceCoverage = 1`, `evilPublicCoverMaintenanceDedupCoverage = 1`, `publicSurfacePolishCoverage = 1`, `repetitionRate = 0.180`, and `stanceContinuityRate = 1`.

## 2026-06-06 Follow-up: Public Verification Wording Polish

This follow-up cleans public verification wording that still sounded like stitched templates, especially identity-check lines.

- `polishPublicLineSurface(...)` now rewrites awkward forms such as `核法先交给2号来身份先对上`, `核法先交给7号来把身份和票型对上`, `把身份先落到桌面`, and `台面上。还是...` into natural public verification wording.
- `publicSurfacePolishCoverage` now treats these public verification wording artifacts as failures, and contract tests scan every public row for the same forms.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `node scripts\ai_quality_eval.mjs`, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, targeted zero-row verification wording scan, and root/Unity no-index sync checks. Current fixed snapshot is 127 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 0.953`, `publicSurfacePolishCoverage = 1`, zero `来身份` / `来把身份` / identity-action `先` / `台面上。还是` rows, `publicVerificationLeadVariantCoverage = 1`, `repetitionRate = 0.180`, and `stanceContinuityRate = 1`.

## 2026-06-06 Follow-up: Formal Vote Table Context Anchors

This follow-up closes the last fixed evidence-citation gap by making edge-case formal vote lines name the table-readable vote context, not only abstract pressure or timing.

- Formal vote edge templates now keep natural anchors such as `投票`, `票型`, `公开回应`, `公开处决线`, and `投票流程` across ghost-vote, cannot-vote, near-threshold, table-balance, and execution-window reason modes.
- The fixed evaluator adds `formalVoteTableContextCoverage = 1` beside formal vote rationale/diversity/mode gates, and contract tests scan every formal-vote row for table-readable vote context.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `node scripts\ai_quality_eval.mjs`, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, targeted zero-row formal-vote context scan, and root/Unity no-index sync checks. Current fixed snapshot is 127 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 1`, `formalVoteRationaleCoverage = 1`, `formalVoteTableContextCoverage = 1`, `formalVoteLineDiversityCoverage = 1`, `formalVoteReasonModeCoverage = 1`, `repetitionRate = 0.180`, and `stanceContinuityRate = 1`.

## 2026-06-06 Follow-up: Public Claim Hold Lead Diversity

This follow-up reduces repeated public identity-continuity openings so repeat claim lines sound like table memory, not a template loop.

- `claimDisclosureHoldVariantIndex(...)` now uses a wider deterministic hash, and hard hold templates move the role name earlier (`圣徒这条身份先沿用...`, `猎手口径这轮不改...`) so repeated stems are role-specific instead of all starting with the same generic lead.
- The fixed evaluator adds `publicClaimHoldLeadVariantCoverage = 1`, measuring the final spoken public hold lines rather than only the internal continuity metadata.
- Contract tests assert the summary metric, require at least six public hold lead variants, and cap any one public spoken hold lead at four rows.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `node scripts\ai_quality_eval.mjs`, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, targeted public hold lead distribution scan, and root/Unity no-index sync checks. Current fixed snapshot is 127 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 1`, `claimDisclosureHoldLeadVariantCoverage = 1`, `publicClaimHoldLeadVariantCoverage = 1`, public hold leads 19 rows / 15 distinct / max 3, `repetitionRate = 0.175`, and `stanceContinuityRate = 1`.

## 2026-06-06 Follow-up: Nomination Defense Response Variants

This follow-up reduces repeated nominee-defense openings so nomination debates sound like responsive table defense instead of one reusable scaffold.

- `nominationDefenseLine(...)` now uses deterministic variants keyed by script, nominee, nominator, pressure band, reason text, and salt, with separate low-pressure, high-pressure, claim-text, and counter-pressure pools.
- Defense claim text no longer repeats the old `我先不把身份一次说死` stem in fixed rows, while still preserving public-safe identity / information / vote-threshold anchors.
- Formal vote follow-up context now recognizes the new defense thresholds (`验不上`, `接不上`) and counter-pressure cues (`只催落票`, `直接催票`, `推进也要记`) so defense-aware vote reasoning continues to consume the richer response.
- The fixed evaluator adds `nominationDefenseResponseVariantCoverage = 1`; contract tests require at least four nominee-defense openings, cap any one opening at two rows in the fixed set, and ensure the old identity stem no longer dominates.
- Latest validation passed: `node --check` on touched root and Unity JS/test files, `node scripts\ai_quality_eval.mjs`, `npm run test:ai-quality-eval`, `npm run test:ai-agents`, root/Unity no-index sync checks, `git diff --check`, and trailing-whitespace checks. Current fixed snapshot is 127 rows with `hiddenLeakCount = 0`, `mechanicalArtifactCount = 0`, `evidenceCitationRate = 1`, `nominationDefenseResponseCoverage = 1`, `nominationDefenseResponseVariantCoverage = 1`, defense openings 6 rows / 5 distinct / max 2 / old stem 0, `repetitionRate = 0.161`, and `stanceContinuityRate = 1`.

## 2026-06-05 Follow-up: Unity Token Inspector Target Focus Rail

This follow-up continues Token Inspector polish by tying the selected token, pressure state, and recommended quick action into one compact visual path without changing token selection, action dispatch, reminders, or role marking behavior.

- Added `Token Inspector Target Focus Rail` above the role/meta zone, with a selected-target halo, seat pin, pressure trace, route track, and recommended-action node.
- The rail reuses `TokenInspectorRecommendedAction(...)`, `TokenInspectorGuidanceBadge(...)`, `TokenInspectorSeatLabel(...)`, and `TokenInspectorFocusAccent(...)`, so the focus cue stays aligned with the existing signal chips and suggested action glow.
- The focus rail is non-interactive and has raycast targets disabled, preserving the existing Token Inspector buttons and role-token click behavior.
- Unity asset contracts now guard `tokenInspectorFocusRoot`, `RenderTokenInspectorTargetFocus(...)`, route-track object names, and the refreshed accepted full-baseline path.
- Validation passed: `node --check tests\unity_asset_contracts.mjs`, `npm run test:unity-assets`, Unity batch build, targeted `token-inspector` smoke captures across 1920x1080, 1600x900, and 1366x768 with 3 screenshots, zero warnings, and zero failures.
- The accepted full-state baseline was refreshed at that point to `output\unity-ui-smoke-full-baseline-token-inspector-focus-2026-06-05`, covering 31 states x 3 viewports, 93 screenshots, zero warnings, and zero failures; `tools\verify_unity_full_ui_baseline.ps1` defaulted to that manifest for the Token Inspector pass and the full verifier passed.

## 2026-06-05 Follow-up: Unity More Actions Route Strip

This follow-up continues More Actions polish by turning the selected target, recommended tool count, and primary next tool into a compact route cue without changing action dispatch, tile availability, player selection, or modal routing.

- Added `More Actions Route Strip` in the drawer header area, with target, recommendation, and next-tool chips connected by subtle route markers.
- The strip reuses the selected player context, `MoreActionSuggestedKeys(...)`, `MoreActionsSignalTargetLabel(...)`, `MoreActionsSignalToolsLabel(...)`, and existing suggested-tile highlighting, so the new cue stays aligned with the existing tool grid and signal strip.
- The route strip is non-interactive, has raycast targets disabled, and preserves the existing More Actions buttons and close behavior.
- Unity asset contracts now guard `moreActionsRouteRoot`, `RenderMoreActionsRouteStrip(...)`, route connectors/chips, `MoreActionsPrimarySuggestedLabel(...)`, and the refreshed accepted full-baseline path.
- Validation passed: `node --check tests\unity_asset_contracts.mjs`, `npm run test:unity-assets`, Unity batch build, targeted `more-actions` smoke captures across 1920x1080, 1600x900, and 1366x768 with 3 screenshots, zero warnings, and zero failures.
- The accepted full-state baseline was refreshed at that point to `output\unity-ui-smoke-full-baseline-more-actions-route-2026-06-05`, covering 31 states x 3 viewports, 93 screenshots, zero warnings, and zero failures; `tools\verify_unity_full_ui_baseline.ps1` defaulted to that manifest for the More Actions pass and the full verifier passed.

## 2026-06-05 Follow-up: Unity Phase Transition Route Strip

This follow-up continues transition-scene polish by making phase changes read as contained stage cards instead of a full-screen horizontal band, while preserving phase dispatch, dialogue queueing, narration, and smoke state routing.

- Replaced the full-width `Phase Transition Horizon` / fine-line treatment with a contained `Phase Transition Contained Horizon` plus `Phase Transition Horizon Core` inside the transition card area.
- Added `Phase Transition Route Strip` with current-stage, next-action, and sync-state chips connected by subtle route markers.
- The strip reuses `PhaseTransitionStageName(...)`, `PhaseTransitionNextAction(...)`, and `PhaseTransitionAccentColor(...)`, so day, night, nomination, public, and ended transitions keep their existing semantics and stage colors.
- Unity asset contracts now guard `phaseTransitionRouteRoot`, route accent/connectors, contained horizon object names, route chips, and the four transition smoke states.
- Validation passed: `node --check tests\unity_asset_contracts.mjs`, `npm run test:unity-assets`, Unity batch build, targeted `phase-transition` / `transition-day` / `transition-night` / `transition-nomination` smoke captures across 1920x1080, 1600x900, and 1366x768 with 12 screenshots, zero warnings, and zero failures.
- The accepted full-state baseline was refreshed at that point to `output\unity-ui-smoke-full-baseline-phase-transition-route-2026-06-05`, covering 31 states x 3 viewports, 93 screenshots, zero warnings, and zero failures; `tools\verify_unity_full_ui_baseline.ps1` defaulted to that manifest for the Phase Transition pass and the full verifier passed.

## 2026-06-05 Follow-up: Unity Private Chat Dialogue Stage

This follow-up continues Private Chat polish by making the transcript read more like a contained conversation stage, while preserving target selection, private-message dispatch, quick prompts, claim/night inputs, secrecy toggles, and timeline syncing.

- Added `Private Dialogue Stage Frame`, `Private Dialogue Stage Floor`, and `Private Dialogue Stage Vignette` behind the scrollable transcript so the message viewport has its own contained stage instead of floating inside the history wash.
- Expanded the transcript viewport and scroll rail height in the tight 1366 layout, giving recent messages more breathing room before the compose area begins.
- Split `AddPrivateLatestBubbleSpotlight(...)` into underlay and foreground passes: the low-opacity focus frame now renders behind the bubble, while the focus rail/tag render after the bubble text, avoiding focus markers painting over the readable message body.
- Unity asset contracts now guard `privateDialogueStageRoot`, the stage-frame object names, `Private Latest Bubble Underlay`, and both foreground/underlay latest-focus call paths for normal and pending private replies.
- Validation passed: `npm run test:unity-assets`, Unity batch build, targeted `private-chat` / `private-chat-long` smoke captures across 1920x1080, 1600x900, and 1366x768 with 6 screenshots, zero warnings, and zero failures.
- The accepted full-state baseline was refreshed at that point to `output\unity-ui-smoke-full-baseline-private-dialogue-stage-2026-06-05`, covering 31 states x 3 viewports, 93 screenshots, zero warnings, and zero failures; `tools\verify_unity_full_ui_baseline.ps1` defaulted to that manifest for the Private Chat pass and the full verifier passed.

## 2026-06-05 Follow-up: Unity Phase Assist Public Route Strip

This follow-up continues public-discussion polish by making the Phase Assist panel read as a public table route instead of a floating tool strip, while preserving public speech dispatch, nomination routing, debate helpers, and phase action behavior.

- Added `Phase Assist Public Route Strip` between the current hint and public speech input, with stage, speaker, and next-action chips connected by a subtle track.
- The route strip reuses `PhaseAssistPublicActionLabel(...)`, `NameForPlayerId(...)`, and `PhaseAssistPublicRouteAccent(...)`, so the cue stays aligned with the current public conversation and existing signal strip.
- The strip is non-interactive, has raycast targets disabled, and is hidden in nomination/debate/non-visible Phase Assist states so existing buttons keep their behavior.
- Unity asset contracts now guard `phaseAssistPublicRouteRoot`, `RenderPhaseAssistPublicRoute(...)`, route track/connectors/chips, route accent naming, and the refreshed accepted full-baseline path.
- Validation passed: `node --check tests\unity_asset_contracts.mjs`, `npm run test:unity-assets`, Unity batch build, targeted `phase-assist-public` smoke captures across 1920x1080, 1600x900, and 1366x768 with 3 screenshots, zero warnings, and zero failures.
- The current accepted full-state baseline was refreshed to `output\unity-ui-smoke-full-baseline-phase-assist-public-route-2026-06-05`, covering 31 states x 3 viewports, 93 screenshots, zero warnings, and zero failures; `tools\verify_unity_full_ui_baseline.ps1` now defaults to this manifest and the full verifier passed.

Updated short-term baseline:

1. AI agent: structured decision lines, selected score-track snapshots, target-vs-runner-up side traces, private runner-up comparison line variants, five-mode private evidence synthesis with mode-specific rationale/spoken verification actions, private reason opening lead variants, private verification lead naturalization, private source-identity synthesis dedup, private vote-taxonomy synthesis dedup, private source-reliability / timeline-consistency / incentive-alignment spoken reasoning with natural heading and tail variants, public multi-evidence synthesis with mode-matched spoken table-verification actions, natural public evidence anchor lead variants and anchor-body dedup, clipped public evidence-fragment cleanup, public action-first surface polish, public verification wording polish, non-public verb-seat spacing polish, evil public maintenance lead dedup, public verification lead variants, public follow-up tail variants, public target-switch claim-disclosure continuity, claim-disclosure surface dedup, claim-disclosure hold lead variants plus public spoken hold lead diversity, balanced claim-disclosure reason variants, shadow high-pressure target-specific openings, public pressure action-lead variants and dedup, public pressure urgency-tail variants, formal vote table-context anchors and full line diversity, nomination action context with full strategy-mode coverage, nominee defense-response coverage and response-opening variants, nominee defense info-plan dedup, nominee defense reason anchors, cross-script nominee defense anchors, high-pressure defense counter-pressure, defense-aware vote rationale, reason-anchored defense-aware vote rationale, reason-anchor vote-line diversity, cross-script defense-aware vote rationale, timeline rationale card trace details, expanded score-trail evidence rows, and cross-day stance badges/source anchors are now visible as named audit paths instead of flattened summaries.
2. UI polish: AI Recap and Timeline now have a complete scan path from suspect card -> selected reasoning track -> expanded score point -> focus/runner comparison trace -> cross-day stance badge -> cross-day anchor chips or expanded evidence rows -> exact evidence-row `EV` jump or score-point `TL` context jump -> timeline rationale drilldown/card trace, vote ceremony has denser 15-player readable labels/tally, a live threshold meter, and an active-voter spotlight/beam, Nomination Debate has a compact accusation-defense-vote duel rail plus a header focus strip, Phase Assist has public speaker/focus/next-action chips, a public stage route strip, and dedicated public smoke coverage, Stage Dialogue has a clearer playback progress cue, active speech card, route ribbon, and speaker spotlight/beam, Private Chat has a compact turn-rhythm track, inbound/outbound message lane cues, a contained transcript stage, an expanded scroll viewport, a transcript stage banner, a persistent scroll rail, a stronger target portrait stage, a compact quick-question strip, and split underlay/foreground latest-message focus cues, Token Inspector has compact signal chips plus a selected-target focus rail, More Actions has signal chips plus a target/recommendation/next-tool route strip, Phase Transition has a contained horizon plus stage/action/state route chips, Endgame has a final-events-to-recap rail plus a verdict focus strip, and Unity smoke has a reusable coverage/crop/diff verifier plus per-state capture retry.
3. Visual/audio regression: the reviewed full-state Unity smoke baseline now covers 31 states x 3 viewports in `output\unity-ui-smoke-full-baseline-phase-assist-public-route-2026-06-05`, with 93 screenshots, zero warnings, and zero failures after adding `phase-assist-public`, the Phase Assist public route strip, the Private Chat latest-focus spotlight and contained dialogue stage, the Stage Dialogue speaker spotlight, the Vote Ceremony active-voter spotlight, the Nomination Debate focus strip, the Endgame verdict focus strip, the Token Inspector target-focus rail, the More Actions route strip, and the Phase Transition route strip to the default matrix; `npm run unity:ui-smoke:verify:full` now gates that matrix with warnings as failures; modal-related BGM regressions now have a dedicated `test:unity-ui-audio` static contract in the normal test path.

## 当前 goal 三方向快照

1. AI agent 智能程度：当前主进展是把“更会想”和“更像人说话”都转成可测合同。AI 已有结构化决策包、跨天 stance、公开/私聊/提名/投票多场景理由、邪恶阵营公开伪装与私下协作边界；最近的重点是消除深推理尾句、主目标/次目标比较、高压发言、公共验证 lead、公共验证措辞毛刺、formal vote 边界票语境缺锚、公开身份延续开头重复、提名答辩开场重复、公聊 evidence anchor body、公聊 clipped evidence fragment、公聊 action-first 双 `先`、非公聊动词-座位空格、邪恶公开 maintenance lead 重复、邪恶私聊队伍信息和 no-bluff 伪装计划里的重复模板，并把公聊多证据 synthesis 扩展成四类显式评估模式，同时新增公聊长度门禁，避免语言层重新膨胀拖累推理层。
2. UI 美化程度：当前主进展是 Unity 从功能面板走向舞台化界面。AI Recap、Timeline、Vote Ceremony、Nomination Debate、Stage Dialogue、Private Chat、Phase Assist、Token Inspector、More Actions、Phase Transition、Endgame 已有更清晰的扫描路径，并且 31-state x 3-viewport full-state smoke baseline 已经成为可重复验证的视觉基线。
3. 游戏规则完成程度：当前主进展相对稳定但不是本轮主要改动。TB 仍是最成熟脚本，BMR/SnV 核心可玩；下一步关键不是继续堆 UI 或话术，而是建立角色审计矩阵，把每个角色的 Exact / Playable Approximation / Partial / Missing 状态、官方偏差、fixture 缺口和 UI 缺口列清楚。

## 后续使用方式

接下来如果继续沿这三个方向深化，建议每次迭代都回答三个问题：

1. 这次改动提升的是 AI、UI、规则中的哪一条主线？
2. 它让哪个可衡量指标变好，还是只是增加了功能面积？
3. 是否需要同步更新合同测试、视觉 smoke 或角色审计矩阵？

短期最建议启动的三个任务：

1. UI 演出：继续打磨投票、公聊、私聊三个高频界面的 ceremony 和 stage polish。
2. UI 回归：把 full-state smoke baseline 纳入后续改动前后的对比流程，特别关注 1600x900 / 1366x768 的 modal、side rail 和 bottom action 区。
3. 游戏规则：建立 BMR/SnV 角色审计矩阵，先标出 Exact / Approximation / Partial / Missing，再逐角色补 fixture。
