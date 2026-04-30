# Blood on the Clocktower / 血染钟楼 研究包 v1

> 用途：给 agent 阅读、继续扩写、改写或拆分为后续任务。
> 
> 范围：整合此前两次回答，聚焦两条线：
> 1. 世界观 / 美术 / 设定
> 2. 玩家模拟 / 语料标签体系

---

## 1. 项目目标

这个研究包服务于两个后续方向：

1. **美术与生图**
   - 让模型理解 Blood on the Clocktower（BOTC）的世界观、气质、视觉母题。
   - 基于已有素材做风格归纳，避免只会“照抄一张角色牌”。

2. **玩家模拟与语料建设**
   - 让 AI 能够模拟 BOTC 玩家发言。
   - 为后续 prompt、标注、检索、训练、agent 设计提供统一 schema。

---

## 2. 游戏本体概览

### 2.1 基础设定

- **Blood on the Clocktower** 是一款社交推理游戏。
- 故事背景核心地点是 **Ravenswood Bluff**。
- 游戏通常由 **5–20 人**参与。
- 玩家分属 **Good / Evil** 两大阵营。
- 另有一名 **Storyteller** 负责主持流程、裁定规则效果与叙事节奏。

### 2.2 胜利条件

- **善方（Good）**：通常目标是处决真正的 Demon。
- **恶方（Evil）**：通常在只剩两名玩家存活时获胜。

### 2.3 三套基础脚本

1. **Trouble Brewing**
2. **Bad Moon Rising**
3. **Sects & Violets**

这三套脚本不仅规则重心不同，也适合作为后续美术风格拆分的三种子方向。

---

## 3. BOTC 与普通狼人杀的关键差异

这是做 agent 时最重要的部分之一。

### 3.1 死亡不等于退出博弈

在 BOTC 中，**死者仍然继续参与推理和发言**。

意味着：
- 死者仍能说话。
- 死者仍会影响票型与局势。
- 死者仍会影响团队胜负。
- 但死者通常失去能力，不能再提名，并且只剩一次投票机会。

所以对 AI 来说，“死亡”不是退场，而是进入另一种受限但依然强影响的博弈状态。

### 3.2 Storyteller 裁定空间很大

BOTC 不是一个“所有信息都机械结算、绝对刚性”的游戏。

Storyteller 会参与：
- 流程控制
- 信息结算
- 状态裁定
- 特定角色效果解释

所以玩家 Bot 不能只做“规则引擎 + 文本输出”，还要能处理**不完全信息、主持人裁定、表面矛盾信息**。

### 3.3 存在状态失真

BOTC 中很重要的几个状态：
- `drunk`
- `poisoned`
- `mad`
- `alive / dead`

这些状态意味着：
- 玩家说的话可能**客观错误，但主观真诚**。
- 玩家可能**被迫表演某种立场**。
- 玩家可能**自认为拿到真实信息，实际上却是错的**。

这和很多普通狼人杀语料的假设不同，因此需要单独建模。

---

## 4. 角色类型框架

BOTC 顶层角色类型可先按下面的结构理解：

- **Townsfolk**
- **Outsider**
- **Minion**
- **Demon**
- 另外还有：
  - **Traveller**
  - **Fabled**

后续如要做 agent，可以先按这套大类建知识库，再逐步补具体角色。

---

## 5. 三套基础脚本的气质拆分

这部分主要服务后续生图、角色风格词库、世界观提炼。

### 5.1 Trouble Brewing

适合新人，是最“经典猎魔”的 BOTC 脚本。

关键词：
- 直接 Demon hunt
- 信息、保护、诱饵、牺牲并存
- 误导与核验共存
- 经典村镇猎巫氛围

视觉气质建议：
- 哥特村镇
- 秋夜
- 烛火
- 石板街
- 壁炉余温
- 暖光中藏不安
- 普通居民中的恐惧感

### 5.2 Bad Moon Rising

玩法重点是：
- 高死亡率
- 高波动
- 高风险高收益
- 善恶双方都更容易出现爆炸式局势变化

视觉气质建议：
- 血月
- 暴雨
- 墓园
- 夜雾
- 连环死亡
- 深蓝 / 黑 / 红强对比
- 猎人与怪物感
- 医治与反噬并存

### 5.3 Sects & Violets

玩法重点是：
- madness
- 身份流动
- 角色变化
- 阵营变化
- 高混乱与认知错位

视觉气质建议：
- 紫罗兰
- 面具
- 异端仪式
- 镜像
- 幻觉
- 错位
- 华丽舞台感
- 神秘教团气息

---

## 6. 美术方向：风格圣经草案

如果后续要根据 BOTC 背景和已有素材生图，不建议直接从“某张角色牌长什么样”出发，而建议先固定一套更高层的视觉语言。

### 6.1 共通视觉母题

- Ravenswood Bluff
- 小镇钟楼
- 夜色
- 煤烟
- 蜡烛
- 宗教与民俗混杂
- 公开审判
- 隐藏恶魔
- 哥特装饰
- 戏剧化轮廓
- 紫 / 黑 / 金为主的戏剧性色彩体系

### 6.2 画面氛围方向

建议把 BOTC 生图分成三层：

1. **世界观场景层**
   - 村镇、钟楼、广场、教堂、墓园、巷道、烛火窗光

2. **角色层**
   - 村民、异端、仆从、恶魔、主持人感人物

3. **事件层**
   - 夜晚审判、怀疑、处刑、私聊、误导、身份揭示、血月异象

### 6.3 生图时的推荐策略

先让模型学会：
- 这是一个什么气质的世界
- 三个脚本的情绪差异是什么
- 哪些是稳定可复用元素

再去做：
- 场景图
- 角色图
- UI/Token/徽章/图标
- 宣传风格图

避免一开始就只依赖“角色卡外观”做近似复制。

---

## 7. 玩家模拟：为什么不能只学狼人杀对白

如果目标是“AI 能像 BOTC 玩家一样玩”，那么只训练“会聊天”远远不够。

需要至少建模以下五层：

1. **角色认知**
   - 我是谁
   - 我知道什么
   - 我不知道什么

2. **公共叙事**
   - 我现在对外声称什么
   - 我怎么解释自己行为

3. **可信度管理**
   - 我什么时候说真话
   - 什么时候半真半假
   - 什么时候故意误导

4. **票型决策**
   - 何时带票
   - 何时弃票
   - 死后何时用唯一一票

5. **时机控制**
   - 什么时候先说
   - 什么时候拖到最后说
   - 什么时候只在私聊中表达

BOTC 的 AI 不是普通聊天机器人，而是一个在不完全信息下管理自我叙事、团队博弈和表面可信度的代理。

---

## 8. 类似游戏语料的迁移思路

目前若语料难拿，优先用类似游戏迁移，而不是死等 BOTC 专属大语料。

### 8.1 可迁移对象

- 狼人杀 / Werewolf
- Mafia
- One Night Werewolf
- Avalon
- Among Us（更偏欺骗与会议语言）

### 8.2 优先学习的能力，而不是原封不动套规则

优先迁移：
- 说服
- 指控
- 辩护
- 试探
- 带票
- 甩锅
- 模糊表态
- 对局势进行语言化总结
- 发言时机控制

不要直接假设：
- 这些游戏的死亡机制和 BOTC 完全一样
- 信息结构完全等价
- 主持人裁定空间完全等价

---

## 9. 玩家语料标签体系 v1

下面给出用于标注、检索、prompt 设计和初代训练的 schema。

### 9.1 标注目标

这套 schema 用于：
- 让 agent 理解一条发言“在做什么”
- 让系统跟踪角色认知与公共叙事之间的差异
- 支持后续投票/提名/处决预测
- 支持训练更接近 BOTC 的发言代理

---

## 10. 最小标注单位

建议把**一句发言**作为基本单位，而不是整轮讨论。

原因：
- 容易做 speech act 标注
- 容易做上下文摘要
- 容易做 belief update
- 容易对齐投票与执行结果

示例：

```json
{
  "game_id": "botc_tb_001",
  "script": "Trouble Brewing",
  "phase": "day",
  "day_index": 2,
  "utterance_id": "d2_u17",
  "speaker": "P4",
  "audience": "public",
  "speaker_alive": true,
  "speaker_private_role": "Fortune Teller",
  "speaker_alignment": "good",
  "speaker_public_claim": "Empath",
  "speaker_state": {
    "alive_dead": "alive",
    "sober_drunk": "sober",
    "healthy_poisoned": "healthy",
    "sane_mad": "sane"
  },
  "text": "我昨晚的信息不太像1号好人，但我现在还不想全报。",
  "speech_acts": ["soft_claim", "withhold_info", "soft_accuse"],
  "targets": ["P1"],
  "epistemic_strength": 2,
  "intent": "set_up_future_push",
  "truth_status_objective": "mixed",
  "truth_status_subjective": "believed_true",
  "evidence_source": "night_info",
  "vote_stance": "lean_execute_P1",
  "nomination_related": false
}
```

---

## 11. 字段分层

### 11.1 A 层：必标字段

每条都建议保留：

- `game_id`
- `script`
- `phase`
- `day_index`
- `utterance_id`
- `speaker`
- `audience`
- `text`
- `speaker_alive`
- `speaker_private_role`
- `speaker_alignment`
- `speaker_public_claim`
- `speaker_state`

### 11.2 B 层：推荐字段

- `speech_acts`
- `targets`
- `epistemic_strength`
- `intent`
- `evidence_source`
- `vote_stance`
- `nomination_related`

### 11.3 C 层：高阶字段

- `belief_delta`
- `coalition_signal`
- `deception_type`
- `rhetorical_style`
- `pressure_level`
- `contradiction_links`

---

## 12. Speech Acts：核心发言动作标签集

建议先使用 18 个主标签。

### 12.1 身份与信息类

- `hard_claim`：硬报身份
- `soft_claim`：软报身份 / 模糊影射
- `role_explain`：解释自己声称角色的机制
- `info_dump`：完整报信息
- `withhold_info`：保留信息
- `partial_reveal`：半报信息
- `mechanical_check`：基于规则互动做核验

### 12.2 试探与审问类

- `probe`：普通试探
- `cross_check`：交叉核验
- `trap_question`：诱导式提问
- `consistency_check`：追问前后不一致
- `private_pull`：拉人私聊

### 12.3 说服与带票类

- `accuse`：指控
- `defend`：辩护 / 洗白
- `pressure`：施压要表态 / 要报身份
- `coordinate_vote`：号召投票
- `anti_execute`：明确反处决
- `nominate`：正式提名
- `second_push`：在已有嫌疑上继续加压

### 12.4 欺骗与表演类

- `fake_claim`：假报身份
- `bait`：放饵
- `frame`：栽赃
- `distance`：恶方切割队友
- `pocket`：拉拢建立信任
- `hedge`：模糊表态留退路
- `mad_play`：为满足或规避 madness 而进行的表演

> 注：一句话可以多标签，不建议强行单标签化。

---

## 13. Truth 与 Deception 双轨标注

BOTC 里必须把“客观真假”和“说话者主观认知”分开。

### 13.1 客观真假

`truth_status_objective`
- `true`
- `false`
- `mixed`
- `unverifiable`

### 13.2 主观真假

`truth_status_subjective`
- `believed_true`
- `known_false`
- `strategic_uncertain`

### 13.3 欺骗类型

`deception_type`
- `none`
- `cover_true_role`
- `fake_info`
- `half_truth`
- `baiting`
- `madness_compliance`
- `team_coordination_lie`

这一步非常关键，因为：
- poisoned / drunk 玩家可能主观上完全真诚，但客观上错误；
- mad 玩家可能被迫推动自己并不相信的叙事。

---

## 14. Epistemic 与 Evidence 标注

### 14.1 把握度

`epistemic_strength`
- `0`：纯试探 / 基本无立场
- `1`：弱怀疑 / 弱支持
- `2`：较明确倾向
- `3`：强结论 / 带票级断言

### 14.2 信息来源

`evidence_source`
- `night_info`
- `public_claims`
- `private_chat`
- `vote_pattern`
- `execution_result`
- `storyteller_signal`
- `social_read`
- `mechanical_reasoning`

---

## 15. BOTC 专属状态标签

`speaker_state`
- `alive_dead`: `alive | dead`
- `sober_drunk`: `sober | drunk | unknown`
- `healthy_poisoned`: `healthy | poisoned | unknown`
- `sane_mad`: `sane | mad | unknown`

还可以额外维护：

`action_capability`
- `has_ability`
- `ability_spent`
- `cannot_nominate`
- `dead_vote_available`
- `dead_vote_spent`

---

## 16. 提名与投票标签

如果后续要做真正可玩的 agent，这部分要单独保留。

### 16.1 发言层字段

- `nomination_related`
- `nomination_target`
- `nomination_by`
- `execution_push_strength`: `soft | medium | hard`
- `vote_stance`: `support | oppose | abstain_signal | undecided`
- `reason_type`: `mechanical | social | survival | bluff | endgame`

### 16.2 事件层字段

- `nominated_player`
- `vote_count`
- `executed`
- `dead_votes_used`

---

## 17. 标注规则建议

### 17.1 一句多标签

不要强行把一句话压成单一类别。

### 17.2 公开真相与玩家认知分离

必须同时记录：
- 客观真假
- 主观真假

### 17.3 Public / Private 分开存

不要把私聊直接并入公共对白。

### 17.4 死者发言不要降权

在 BOTC 中，死者依然是桌面局势的重要驱动者。

---

## 18. MVP 版最小字段集合

如果现在就要开工，先标这 12 个字段就够：

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

第二阶段再补：
- `speaker_private_role`
- `speaker_alignment`
- `speaker_state`
- `truth_status_objective`
- `truth_status_subjective`
- `deception_type`
- `evidence_source`
- `epistemic_strength`

---

## 19. 实施路线建议

### 第一步：规则知识库

先整理：
- 顶层阵营
- 角色类型
- BOTC 状态系统
- Storyteller 裁定相关概念

### 第二步：发言动作标签体系

以 speech act 为中心开始标注或合成语料。

### 第三步：相似游戏语料迁移

先从狼人杀 / Mafia / One Night Werewolf / Among Us 中抽取：
- 指控
- 辩护
- 带票
- 模糊欺骗
- 私聊 / 公聊切换
- 时机控制

### 第四步：BOTC 专属增强

重点增强：
- 死亡后持续发言
- drunk / poisoned / mad
- 角色/阵营变动
- Storyteller 裁定导致的信息失真

---

## 20. 后续可继续扩展的方向

1. 输出正式 `label_schema_v1.json`
2. 为每个 speech act 补 5–10 条中文示例
3. 增加 `belief tracking` 数据结构
4. 增加 `private chat` 与 `public square talk` 的双通道对话建模
5. 将 BOTC 三套基础脚本拆成三份独立 agent prompt 包
6. 生成“美术风格提示词模板”与“角色卡风格模板”

---

## 21. 给后续 agent 的建议

后续 agent 修改这个文档时，可以优先做这些事：

- 把第 5、6 节扩成正式美术设定文档。
- 把第 9–18 节改成严格的 schema 规范。
- 加入更多中英文示例 utterances。
- 把 `speech_acts` 变成枚举表。
- 拆出“BOTC 与狼人杀差异表”。
- 追加“可迁移公开语料清单”。

