# BOTC 语料获取清单与转换规范 v1

## 目标
这份文档给 agent 用，目标是帮助项目快速搭起一套 **可用但不完美** 的社交推理语料池，优先服务于：

1. 玩家发言风格建模
2. 投票 / 带票 / 怀疑链建模
3. BOTC 专属机制的后续少量人工补标
4. 与前面的 `label_schema_v1` 对齐

---

## 总结结论

不要等 BOTC 专属大语料。

第一阶段直接拼一个 **过渡语料池**：

- **主语料**：Werewolf Among Us
- **异步聊天补丁**：LLMafia
- **结构化日志补丁**：AIWolf / AIWolfDial
- **欺骗行为分析补丁**：Among Us 多智能体仿真数据（仅研究补充）

推荐优先级：

1. Werewolf Among Us
2. LLMafia
3. AIWolf / AIWolfDial logs
4. Among Us 2026 multi-agent corpus

---

## 资源矩阵

### 1) Werewolf Among Us

**定位**
- 当前最适合当主语料
- 适合训练“像社交推理玩家一样说话”
- 不等于 BOTC，但最适合打底

**公开情况**
- Hugging Face 数据集公开可见
- 论文和代码页都能找到

**内容**
- 199 局游戏
- 26,647 条 utterance-level persuasion annotations
- 含 transcript、speaker、timestamp、vote outcome、start/end roles
- 视频来源包括 YouTube 子集和 Ego4D 子集

**优点**
- 量相对够用
- 标签直接有用
- 最适合做发言行为分类、说服策略识别、投票预测

**缺点**
- 主要是 One Night Werewolf / Avalon，不是 BOTC
- 有视频来源依赖，上游素材使用边界要注意

**建议用途**
- 训练 `speech_acts`
- 训练 `evidence_source`
- 训练 `vote_stance`
- 训练 persuasion / accusation / defense 风格

**不适合直接学到的 BOTC 特性**
- dead speaking
- drunk / poisoned
- madness
- Storyteller 裁定

---

### 2) LLMafia / Time to Talk

**定位**
- 小而精的补丁语料
- 用来补“什么时候说、怎样插话、异步群聊怎么表现”

**公开情况**
- Hugging Face 数据集公开可见
- GitHub 项目公开

**内容**
- 33 局
- 3593 条消息
- 其中 275 条来自 LLM agent
- 每局含 metadata、phase、玩家日志、统一消息流、投票信息

**优点**
- 很适合学 timing / pacing / async conversation
- 文件结构干净
- 对 agent scheduler 和 message timing 很有帮助

**缺点**
- 体量小
- 是 Mafia，不是 BOTC
- 里面混有 agent 语言风格，不全是纯人类桌游语料

**建议用途**
- 训练“何时发言”
- 训练 `audience` / `phase` / `vote_stance`
- 做异步群聊代理的 few-shot 检索库

---

### 3) AIWolf / AIWolfDial logs

**定位**
- 用来补足结构化博弈日志
- 非常适合做状态机、投票链、阶段切换建模

**公开情况**
- AIWolf 官方资源页可下载过去比赛 logs
- 至少可见 4th、5th 国际赛日志下载入口
- AIWolfDial 2024 论文明确说明使用比赛 logs 做分析

**内容特点**
- 强结构化
- 更偏 agent-vs-agent / 比赛场景
- 自然语言部分可作为机器对局语料补充

**优点**
- 日志规则化强，适合做解析器
- 很适合补 `phase`、`vote`、`execution`、`alive/dead`、`role reveal` 等事件层
- 对“游戏状态追踪器”建设非常有帮助

**缺点**
- 语言风格可能偏比赛代理，不像真人桌游 BOTC
- 不适合作为唯一语言主语料

**建议用途**
- 搭状态追踪模块
- 学投票流程和局势变动
- 让 agent 学会结构化推理，而不是只会闲聊

---

### 4) Among Us 2026 multi-agent corpus

**定位**
- 研究补充，不是主语料
- 用来分析 deception、speech acts、social pressure

**公开情况**
- 论文写明 scripts / prompts / data 已放 GitHub
- 但商用前必须人工核许可证与上游 IP 风险

**内容特点**
- 1100 局仿真
- 上百万 token 会议对话
- 更适合做行为分析，不适合直接当 BOTC 风格语言语料

**优点**
- 量大
- 适合研究说谎、回避、含糊表达、受压辩解

**缺点**
- 不是人类真实桌游对话
- 不是 BOTC
- Among Us IP 与 fair use 表述意味着再利用边界要谨慎

**建议用途**
- 训练 `deception_type`
- 做 speech act 统计和压力情境分析
- 给 agent 的欺骗策略模块做启发式样本

---

## 实操建议：怎么拼成一套可用语料池

### Phase 1：先把通用社交推理语言跑起来

来源：
- Werewolf Among Us
- LLMafia

产出：
- 一个通用 `social_deduction_dialogue.jsonl`
- 每条样本至少有：文本、speaker、phase、targets、speech_acts、vote_stance

### Phase 2：补状态机和投票链

来源：
- AIWolf / AIWolfDial logs

产出：
- `game_events.jsonl`
- `vote_events.jsonl`
- `execution_events.jsonl`
- `player_state_timeline.jsonl`

### Phase 3：再补 BOTC 专属现象

来源：
- 少量人工整理的 BOTC replay / transcript / 规则构造样本

只补最难从狼人杀迁移过来的字段：
- `dead_speaking`
- `drunk / poisoned`
- `madness_compliance`
- `storyteller_uncertainty`
- `public_claim != private_role`

---

## 与 label schema 的字段映射

下面假设我们统一映射到之前的 schema：

```json
{
  "game_id": "",
  "script": "",
  "phase": "",
  "day_index": 0,
  "speaker": "",
  "audience": "public",
  "speaker_alive": true,
  "speaker_public_claim": "",
  "text": "",
  "speech_acts": [],
  "targets": [],
  "vote_stance": ""
}
```

### A. Werewolf Among Us -> schema

**原始可取字段**
- game id
- utterance timestamp
- speaker
- transcript
- persuasion strategy
- vote outcome
- role annotations

**建议映射**
- `game_id` <- 原游戏 id
- `phase` <- 若无明确 phase，可依据时间段或规则切分，先默认 `day`
- `speaker` <- transcript 中 speaker
- `text` <- utterance text
- `speech_acts` <- persuasion labels 映射
- `vote_stance` <- 若 utterance 靠近投票并带明显倾向，则从文本推断；否则结合最终 vote outcome 做弱监督
- `targets` <- 从文本中 NER / 规则抽取玩家指向
- `speaker_public_claim` <- 从 identity declaration / text 中抽取

**推荐 persuasion -> speech_acts 映射**
- identity declaration -> `hard_claim` / `soft_claim`
- interrogation -> `probe`
- evidence -> `info_dump` / `mechanical_check`
- accusation -> `accuse`
- defense -> `defend`
- call for action -> `coordinate_vote` / `pressure`

---

### B. LLMafia -> schema

**原始可取字段**
- all_messages
- public_daytime_chat
- public_nighttime_chat
- vote files
- config.json
- status / results
- timestamp

**建议映射**
- `game_id` <- game folder name
- `phase` <- daytime / nighttime / manager
- `speaker` <- message sender
- `audience` <- public 或 mafia-private
- `text` <- message text
- `speaker_alive` <- 从 status timeline 推断
- `vote_stance` <- 从 vote 文件或文本联立确定
- `speech_acts` <- 文本分类器或规则标注
- `targets` <- message mention extraction

**特别建议**
额外保留一个非 schema 字段：
- `timing_delta_prev_msg`
- `timing_delta_prev_self`

因为 LLMafia 最大价值就是发言时机。

---

### C. AIWolf / AIWolfDial logs -> schema

**原始可取字段**
- day / turn / talk / vote / execute / attack / divine 等结构化事件
- 玩家身份、存活状态、投票和结果

**建议映射**
- `phase` <- day / night
- `day_index` <- 日志 day
- `speaker` <- talk actor
- `text` <- natural language division 的发言文本
- `speaker_alive` <- 事件时间点状态
- `vote_stance` <- 从 vote record 直接映射
- `targets` <- 自然语言解析或事件字段
- `speech_acts` <- 后处理分类

**特别建议**
AIWolf 最重要的不是 text，而是：
- 生成 `player_state_timeline`
- 生成 `belief tracking` 的训练输入
- 生成 `who voted for whom` 的监督标签

---

### D. Among Us 2026 multi-agent corpus -> schema

**原始可取字段**
- meeting dialogue
- role labels
- discussions / votes / reasoning traces

**建议映射**
- `phase` <- meeting
- `speaker` <- agent id
- `text` <- dialogue turn
- `speech_acts` <- 规则或分类器标注
- `deception_type` <- 由论文中的分析标签或再标注得到
- `epistemic_strength` <- 由语言模式估计

**特别提醒**
这套更适合做：
- deception classifier
- equivocation / denial / ambiguity analysis
- pressure-response behavior

不建议直接混成“真人桌游风格语料”的主体。

---

## 推荐统一导出格式

### 1) utterance 级 JSONL

```json
{"game_id":"g001","phase":"day","day_index":1,"speaker":"P3","audience":"public","speaker_alive":true,"speaker_public_claim":"","text":"我觉得7像狼","speech_acts":["accuse"],"targets":["P7"],"vote_stance":"lean_execute_P7"}
```

### 2) event 级 JSONL

```json
{"game_id":"g001","event_type":"vote","phase":"day","day_index":1,"actor":"P3","target":"P7","timestamp":"..."}
```

### 3) player state timeline JSONL

```json
{"game_id":"g001","day_index":1,"player":"P3","alive":true,"role":"seer","alignment":"good"}
```

---

## 推荐文件夹结构

```text
corpus/
  raw/
    werewolf_among_us/
    llmafia/
    aiwolf/
    amongus_agents/
  normalized/
    utterances.jsonl
    events.jsonl
    states.jsonl
  schema/
    label_schema_v1.json
    mapping_rules.md
  botc_manual/
    botc_seed_examples.jsonl
```

---

## 获取顺序（强烈建议按这个来）

### 第一步
先下载：
- Werewolf Among Us
- LLMafia

因为这两套现在最容易拿到、也最直接能转成训练样本。

### 第二步
补：
- AIWolf / AIWolfDial logs

因为你需要投票链和阶段状态，不然 agent 只能“会聊”不会“会玩”。

### 第三步
最后再看：
- Among Us 2026 multi-agent corpus

只把它当行为学补充，不要拿它替代真人语料。

---

## 训练侧建议

### 第一阶段：先做分类和检索
- `speech_acts` 多标签分类
- `targets` 抽取
- `vote_stance` 分类
- 基于相似 utterance 的 few-shot 检索

### 第二阶段：再做 agent
- 记忆模块：保存 player state 与历史 claim
- 决策模块：决定今天怀疑谁、是否带票
- 生成模块：控制语气、长度、时机

### 第三阶段：BOTC 专属增强
- 加死后发言
- 加 drunk / poisoned 误信息
- 加 madness
- 加 Storyteller 裁定型不确定性

---

## 风险提醒

1. **Werewolf Among Us** 虽然数据卡可见，但其视频源来自 YouTube / Ego4D；如果涉及原视频再分发或商业使用，要单独核上游条款。
2. **LLMafia** 相对清晰，代码仓库是 MIT；但仍建议保留论文和数据集来源记录。
3. **AIWolf** 日志适合研究与工程实现，但语言风格更接近比赛代理，不应直接代表 BOTC 真人语言。
4. **Among Us 2026** 更偏研究仿真语料；若涉商用或外部发布，必须人工审查许可证和上游 IP 边界。

---

## 给 agent 的明确任务单

1. 下载并整理 Werewolf Among Us 与 LLMafia 到 `corpus/raw/`
2. 编写统一 parser，导出 `utterances.jsonl`
3. 为 utterance 增加字段：
   - `speech_acts`
   - `targets`
   - `vote_stance`
   - `audience`
4. 从 AIWolf logs 导出 `events.jsonl` 与 `states.jsonl`
5. 建立一个最小训练集：
   - 先 5k~20k utterances
   - 先不追求 BOTC 专属状态完整覆盖
6. 预留 BOTC 补标接口：
   - `madness_compliance`
   - `drunk_poisoned_uncertainty`
   - `dead_speaking`

---

## 最后的策略建议

**不要把“没有 BOTC 大语料”当成阻塞点。**

社交推理 agent 的第一步，本来就应该先学：
- 如何报身份
- 如何怀疑别人
- 如何辩护
- 如何带票
- 如何在不同阶段说不同的话

这些能力完全可以先用 Werewolf / Mafia / AIWolf 的公开资源搭起来。BOTC 的独特性，再通过少量人工规则样本补进去。
