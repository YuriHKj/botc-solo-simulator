# AI Agent 修改指南

这份文档说明当前 AI agent 拆分后的职责边界，方便后续从 Electron、Unity 或测试入口修改同一套 JS Core。

## 文件职责

| 文件 | 职责 | 常见修改 |
| --- | --- | --- |
| `scripts/ai.js` | AI 主流程编排：私聊、公聊、主动私聊、AI-AI 私聊、提名、投票、KG pressure 接入 | 改“AI 什么时候说/问/提名/投票”、新增决策信号、调整阶段流程 |
| `scripts/ai_claim_policy.js` | 身份声称策略：真实/感知身份解析、邪恶 bluff 选择、公开跳身份、私聊报身份、死亡后公开报身份、剧本压力判断 | 改“AI 什么时候跳身份、邪恶怎么选 bluff、外来者/信息位是否保守公开” |
| `scripts/ai_private_social.js` | 主动私聊与 AI-AI 私聊编排：候选评分、邀请生成、接受/拒绝、私聊写入、隐藏 AI-AI 弱线索 | 改“AI 主动找谁私聊、为什么找玩家、AI 之间私聊如何成为弱线索、拒绝后如何处理” |
| `scripts/ai_public_discussion.js` | 公聊编排：公开发言生成、conversation clock、debate beat、公开跳身份披露、公开发言日志/记忆写入 | 改“公聊谁先说、怎么回应、什么时候进入提名压力、公开宣称如何落到日志和 agent 观察” |
| `scripts/ai_agents.js` | agent 视角与知识：可见性、evidenceBook、belief trail、sourceTrust、knowledge graph、私聊/公聊观察记录 | 改“AI 能看见什么、记住什么、信谁、哪些信息会污染” |
| `scripts/ai_thought_frame.js` | ThoughtFrame：当轮关注目标、自我暴露需求、社交风险、提名准备度、下一句追问 | 改“AI 这一轮想干什么、要不要跳身份、要问谁什么” |
| `scripts/ai_statement_memory.js` | 对话记忆与连续性：statement memory、私聊/公聊承接、投票/提名记忆偏移、当天 stance 标签 | 改“AI 如何记住自己刚才说过什么、如何承接/改口、前文如何影响提名投票” |
| `scripts/ai_speech_renderer.js` | 人话渲染器：语料选择、persona/evilPerformance 分流、act 渲染辅助、口语润色、重复差分、句数/字数预算 | 改“AI 怎么把结构化意图说成人话” |
| `scripts/ai_speech_corpus.json` | 语料库：persona、public/private dialogueActs、evilPerformance、主动私聊、结尾句 | 加/改具体话术、扩充不同人格表达 |
| `scripts/ai_dialogue_smoke.mjs` | 对话质量 smoke：抽样私聊、公聊、AI-AI 私聊、提名发言，并检查工程词、过长、泄漏风险 | 加新的语言质量规则和样本场景 |
| `tests/ai_agent_contracts.mjs` | AI 行为契约测试 | 加可见性、追问、记忆、KG、提名/投票、act 渲染测试 |

Unity 版使用同步后的 JS Core 副本：

- `unity-prototype/Assets/StreamingAssets/BotcJsCore/scripts/ai.js`
- `unity-prototype/Assets/StreamingAssets/BotcJsCore/scripts/ai_claim_policy.js`
- `unity-prototype/Assets/StreamingAssets/BotcJsCore/scripts/ai_private_social.js`
- `unity-prototype/Assets/StreamingAssets/BotcJsCore/scripts/ai_public_discussion.js`
- `unity-prototype/Assets/StreamingAssets/BotcJsCore/scripts/ai_agents.js`
- `unity-prototype/Assets/StreamingAssets/BotcJsCore/scripts/ai_thought_frame.js`
- `unity-prototype/Assets/StreamingAssets/BotcJsCore/scripts/ai_statement_memory.js`
- `unity-prototype/Assets/StreamingAssets/BotcJsCore/scripts/ai_speech_renderer.js`
- `unity-prototype/Assets/StreamingAssets/BotcJsCore/scripts/ai_speech_corpus.json`

修改 `scripts/` 中 JS Core 后，需要同步到 Unity StreamingAssets。

## 当前对话生成链路

```text
玩家/阶段输入
-> ai.js 解析 intent、选择 focus、编排流程
-> ai_agents.js 提供 agentView/evidence/KG/sourceTrust
-> ai_thought_frame.js 生成当轮意图/追问/暴露需求
-> ai_claim_policy.js 决定是否跳身份、公开报什么、私聊报什么
-> ai.js 生成 surface act
-> ai_speech_renderer.js + ai_speech_corpus.json 渲染成人话
-> speech budget / polish / repeated speech diff
-> ai_statement_memory.js 写入/读取发言记忆
-> 写入日志、agent observations
```

## 修改建议

## 分层语料

`scripts/ai_speech_corpus.json` 现在支持 `layers`，用于把“结构化 act”拆成更可控的语料层。优先在这里加话术，而不是把新句子继续塞进流程代码。

当前约定：

- `layers.publicDiscussion.public.*`：公聊发言、公开施压、回应质疑、提名前压力、投票倾向。
- `layers.privateSocial.private.*`：主动私聊、AI-AI 私聊、死人私聊、私下同步信息。
- `layers.claimPolicy.public.*` / `layers.claimPolicy.private.*`：公开跳身份、给身份范围、私聊报身份。

读取顺序由 `layeredCorpusPaths(...)` 控制：

1. `team + persona + act`
2. `team.default + act`
3. `persona + act`
4. `act`
5. `shared + act`

也就是说，可以先写通用 act，再只给邪恶方、pressure 型人格或 shadow 型人格补差异。`pickLayeredSpeech(...)` 会自动按这个顺序查找，并用 `{targetName}`、`{shortReason}`、`{roleName}` 等字段插值。

公聊语料要尽量避免连续使用“我……我……我……”。如果一句话必须表达立场，优先写成“台面上先看 5 号”“5 号需要解释昨晚信息”，把主语从 AI 自己转回桌面信息。`ai_speech_renderer.js` 里也有 `reducePublicSelfDensity(...)` 作为兜底，防止生成结果回到报告腔。

### 想让 AI 更会说人话
优先改：

1. `scripts/ai_speech_corpus.json`
2. `scripts/ai_speech_renderer.js`
3. `scripts/ai_dialogue_smoke.mjs`

不要先改规则或 suspicion。语言问题尽量不要动 `ai_agents.js`。

### 想改 AI 公开跳身份/私聊报身份
优先改 `scripts/ai_claim_policy.js`：

- `choosePublicClaimRole(...)`：公开跳身份概率与时机。
- `publicClaimDisclosureLine(...)`：已经决定公开报身份后的发言。
- `maybePublicDisclosureLine(...)`：不完全跳身份时给范围或保留信息的发言。
- `pickClaimRole(...)` / `chooseScriptAwareBluffRoleId(...)`：邪恶方 bluff 选择。
- `maybePrivateClaim(...)` / `claimRoleForContext(...)`：私聊报身份和记录。

改完要确认好人不会读到恶魔 bluff 或未公开身份，邪恶方 bluff 也不能污染规则结算。

### 想改公聊节奏 / 公开发言
优先改 `scripts/ai_public_discussion.js`：

- `composePublicLine(...)`：单条公开发言的内容组合。
- `publishPublicSpeech(...)`：公开发言如何写入日志、timeline、agent observations、statement memory。
- `runAIConversationStep(...)`：conversation clock 的单步推进。
- `runAIDiscussion(...)`：旧式整轮 AI 公聊。
- `debateBeatForConversationClock(...)` / `suggestedActionsForConversation(...)`：从开场、回应、交锋、提名压力到冷却的节奏。

公聊只能引用公开 evidence；如果私聊影响策略，只能模糊表达为需要复核，不能泄漏未参与私聊原文。

### 想改主动私聊 / AI-AI 私聊
优先改 `scripts/ai_private_social.js`：

- `scoreProactiveWhisperCandidate(...)`：AI 主动找玩家私聊的候选评分。
- `proactiveWhisperReason(...)` / `buildProactiveWhisperOffer(...)`：玩家看到的邀请理由。
- `composeProactiveWhisper(...)`：AI 主动找玩家时说什么。
- `scoreAIToAIWhisperPair(...)` / `composeAIToAIWhisper(...)`：AI-AI 私聊如何发生、说什么。
- `runAIProactiveWhispers(...)` / `acceptAIProactiveWhisper(...)` / `declineAIProactiveWhisper(...)`：队列、接受、拒绝流程。

这块不应该直接改规则结果；AI-AI 私聊默认对玩家隐藏，但会写入 agent 观察和弱线索。

### 想新增一种对话动作
推荐步骤：

1. 在 `scripts/ai.js` 的 private/public surface act kind 中新增 act 类型。
2. 在 `scripts/ai_speech_corpus.json` 的 `public.dialogueActs` 或 `private.dialogueActs` 下补 persona 语料。
3. 如果邪恶方需要不同表演，补 `evilPerformance`。
4. 在 `tests/ai_agent_contracts.mjs` 加契约测试。
5. 跑 
pm run ai:dialogue-smoke` 看是否出现工程词或过长。

### 想改 AI 知道什么
优先改 `scripts/ai_agents.js`：

- agent view
- evidenceBook
- beliefTrailByPlayerId
- knowledge graph
- sourceTrust
- private/public observation 写入

注意：不要让好人 AI 直接读真实身份、恶魔 bluff、邪恶互认、未参与私聊原文。

### 想改 AI 怎么决策
优先改 `scripts/ai.js` 和 `scripts/ai_thought_frame.js`：

- `ai_thought_frame.js` 的 `buildAIThoughtFrameCore(...)`
- target ranking / KG pressure 接入点
- `chooseAINomination(...)`
- `decideAIVote(...)`
- conversation clock / nomination window

决策变化必须补契约测试，避免 AI 变成上帝视角或过强最优解。

### 想改 AI 这一轮想做什么
优先改 `scripts/ai_thought_frame.js`：

- 自我暴露：`hard_claim` / `range` / 
one`
- 追问目标：`primaryConcernId` 和 `questionToAsk`
- 社交风险：`socialRisk`
- 提名准备度：
ominationReadiness`
- 公开 act：`claim` / `claim_range` / `pressure` / `probe` / `hold`

### 想改 AI 怎么承接前文
优先改 `scripts/ai_statement_memory.js`：

- `rememberStatementMemory(...)`：记录公聊/私聊结构化摘要。
- `applyPrivateStatementContinuity(...)`：让私聊回答接住上一句或解释换目标。
- `applyPublicStatementContinuity(...)`：让公聊多轮发言保持连续。
- `publicStatementVoteThresholdShift(...)`：让公开表态影响后续投票阈值。
- `publicStatementNominationReason(...)`：让提名理由沿用之前公开点过的线。

## 验证命令

常用最小回归：

```bash
npm run test:ai-agents
npm run ai:dialogue-smoke
npm run test:unity-viewmodel
npm run test:unity-action-bridge
```

完整回归：

```bash
npm test
```

如果改了 Unity 内置 JS Core，至少确认：

```bash
npm run test:unity-demo-acceptance
```

## 同步注意

当前没有自动同步所有 JS Core 文件到 Unity StreamingAssets。改动这些文件后请复制对应文件：

- `scripts/ai.js`
- `scripts/ai_claim_policy.js`
- `scripts/ai_private_social.js`
- `scripts/ai_public_discussion.js`
- `scripts/ai_agents.js`
- `scripts/ai_thought_frame.js`
- `scripts/ai_statement_memory.js`
- `scripts/ai_speech_renderer.js`
- `scripts/ai_speech_corpus.json`

后续可以补一个 JS Core 同步脚本，避免手动漏拷。
