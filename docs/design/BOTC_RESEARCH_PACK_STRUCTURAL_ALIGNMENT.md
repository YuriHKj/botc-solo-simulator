# BOTC 研究包结构对齐（初步改造 v1）

## 来源文档
- `C:/Users/11507/Downloads/botc_research_pack_v1.md`

## 本轮目标
按研究包中第 17~19 节先做结构改造，不改变现有可玩流程：
1. Public / Private 对话分轨存储。
2. 引入 MVP 发言 schema（第 18 节）。
3. 让现有 AI 私聊、公聊链路自动产出结构化发言记录。
4. 保证旧存档兼容。

## 已完成改造

### 1) 新增统一 schema 模块
- 文件：`scripts/dialogue_schema.js`
- 内容：
  - `UTTERANCE_SCHEMA_VERSION = "botc-label-schema-mvp-v1"`
  - `SPEECH_ACT_ENUM`（对齐研究包第 12 节）
  - `createEmptyUtteranceArchive()`
  - `ensureUtteranceArchive(state)`
  - `inferSpeechActsFromIntent(...)`
  - `recordUtteranceMVP(...)`

### 2) 新局状态挂载 utterance archive
- 文件：`scripts/engine.js`
- 改动：`createNewGame(...)` 的 state 新增
  - `utteranceArchive: createEmptyUtteranceArchive()`

### 3) 读档兼容处理
- 文件：`scripts/app.js`
- 改动：`hydrateLoadedState(...)` 增量补齐
  - `loadedState.utteranceArchive`
  - `loadedState.aiDialogue.dailyFocusLock`

### 4) AI 对话链路写入结构化 utterance
- 文件：`scripts/ai.js`
- 改动：
  - 公聊 `runAIDiscussion(...)`：每条 AI 公聊写入 `audience=public`
  - 私聊 `runPrivateWhisper(...)`：
    - 人类提问写入 `audience=private`
    - AI 回复写入 `audience=private`
  - 附带基础字段：
    - `speech_acts`
    - `intent`
    - `targets`
    - `vote_stance`
    - `evidence_source`
    - `epistemic_strength`

## 与研究包章节对应关系
- 第 17.3 节：Public / Private 分开存 -> 已实现（`utteranceArchive.public/private`）
- 第 18 节：MVP 最小字段集合 -> 已覆盖核心字段
- 第 12 节：Speech Acts 标签体系 -> 已建立枚举与意图映射（初版）
- 第 19 节：实施路线第一轮 -> 已完成“规则 + 发言结构层”挂载

## 本轮不改内容
- 不改变投票规则和胜负判定。
- 不改变 UI 操作路径。
- 不进行模型训练，只做数据结构落地。

## 下一轮建议
1. 把 `truth_status_objective / subjective / deception_type` 由空值改为可推断策略。
2. 增加导出接口（jsonl）用于后续离线标注/训练。
3. 在 UI 加一个“对话标注调试面板”查看当前局 utterance 记录。
