# AI Evidence Book

更新日期：2026-05-04

## 目标

把原来的 per-agent `observations` 升级为更适合推理的“证据簿”：

- AI 仍然只能看到自己可见的信息。
- 每条信息都记录来源、时间、公开性、可信度和污染风险。
- 后续 AI 发言可以引用“我为什么这么判断”，而不是只输出模板化结论。

## 当前实现

位置：`scripts/ai_agents.js`

每个 AI agent 现在包含：

- `observations`：兼容旧逻辑的原始观察记录。
- `evidenceBook`：从 observation 归一化出来的证据记录。
- `beliefTrailByPlayerId`：按目标玩家分组的怀疑变化轨迹。

`addAgentObservation(...)` 会同时写入两份数据：

1. 原始 observation。
2. 标准 evidence 记录。

旧存档或旧代码路径只要仍写 observation，就会在 `ensureAIAgents(...)` 时自动补生成 evidence，避免硬切换导致断档。

## Evidence 字段

一条 evidence 目前包含：

- `kind`：原始事件类型，如 `claim`、`public-speech`、`private-whisper`、`vote`、`night-info`。
- `evidenceType`：归一化类别，如 `social`、`claim`、`procedure`、`private-info`。
- `source`：信息来源类别，如 `storyteller`、`public-chat`、`private-chat`、`public-procedure`。
- `sourceId`：具体来源，如发言者、提名者或 `storyteller`。
- `channel`：信息通道，如 `public`、`private`、`storyteller`。
- `visibility`：`public` 或 `private`。
- `targetIds`：这条证据关联的玩家列表。
- `subjectId`：主目标。
- `polarity`：大致倾向，如 `claim`、`pressure`、`death`、`confirmed-team`、`neutral`。
- `reliabilityScore`：这条信息自身可信度，范围 0 到 1。
- `sourceTrust`：AI 对该来源类别的默认信任度，范围 0 到 1。
- `contaminationRisk`：这条信息可能被醉酒、中毒、撒谎或误导污染的风险，范围 0 到 1。
- `canBeFalse`：是否应被 AI 当作“可能为假”的信息处理。
- `text` / `payload`：原始文本和结构化字段。

## 推理接入

位置：`scripts/ai.js`

当前这些推理入口已经改为读取 evidence：

- 身份声明冲突：`claim`
- 公聊压力和维护：`public-speech`
- 私聊压力和维护：`private-whisper`
- 提名：`nomination`
- 投票：`vote`
- 夜死链路：`night-death`

证据会通过 `evidenceWeight(...)` 打折：

- 说书人和公开流程信息权重更高。
- 玩家发言、私聊和身份声明权重较低。
- `contaminationRisk` 越高，对怀疑值影响越小。

这意味着 AI 不会再把“别人私聊里随口说的话”和“公开投票结果”当成同等强度的信息。

## 怀疑变化轨迹

位置：`scripts/ai_agents.js` 与 `scripts/ai.js`

每次 evidence 导致某个 AI 对某名玩家的怀疑值变化时，会记录一条 trail：

- `targetId`：被影响的玩家。
- `reasonKey`：触发原因，如 `humanAccuse`、`duplicateClaim`、`antiGoodVote`。
- `before` / `after`：变化前后的怀疑值。
- `rawDelta`：规则原始改变量。
- `appliedDelta`：经过 evidence 权重折扣后的实际改变量。
- `weight`：本次证据权重。
- `evidenceId` / `observationId`：回指来源 evidence / observation。
- `evidenceKind` / `evidenceType`：证据类型。
- `source` / `sourceId`：证据来源。
- `reliabilityScore` / `contaminationRisk` / `canBeFalse`：可信度和污染风险。
- `text`：相关原文。

注意：当前 `refreshAIBeliefs(...)` 是从 observation/evidence 重新计算怀疑值，所以 trail 表示“当前信念的解释轨迹”，不是无限追加的历史日志。每次刷新前会清空本轮轨迹，再从证据簿重建。这样可以避免同一条证据因为 UI 刷新或 AI 决策多次调用而重复写入。

## 当前边界

已经做到：

- 私聊证据只进入参与者的证据簿。
- 夜间信息是私有证据。
- 公聊、提名、投票、处决是公开证据。
- 玩家发言和声明默认被标记为可能为假。
- 公开流程默认更可信，且不会被标记为可污染。
- 每次 evidence 造成的怀疑变化会写入 `beliefTrailByPlayerId`。
- `getAIInsightRows(...)` 会快照并恢复玩家信念与 agent trail，避免打开摘要面板污染推理状态。
- 游戏结束后的右侧复盘 UI 会展示 AI 摘要、目标切换和最近的怀疑变化证据链。

仍未做到：

- 每个 AI 还没有长期动态调整 `sourceTrust`。
- 中毒/醉酒导致的错误信息还没有逐角色写入精确 `contaminationRisk`。
- AI 发言还没有完全从证据簿和 trail 中“检索引用”，目前只是信念刷新和部分理由摘要使用。
- 复盘 UI 目前只展示 trail 摘要，还没有展示完整 evidenceBook。
- 复盘 UI 目前依赖游戏结束态，尚未提供开发者调试开关。

## 下一步建议

1. 给 `night-info` 增加逐角色 `sourceRoleId` 和 `contaminationReason`。
2. 让私聊回答能引用 1 到 2 条具体 evidence/trail，而不是只说“个人证据 N 条”。
3. 在复盘界面补充完整 evidenceBook 检索，方便诊断 AI 是否又“开全图”。
4. 增加长期历史轨迹模式，用于复盘整局“某 AI 的立场如何变化”。
