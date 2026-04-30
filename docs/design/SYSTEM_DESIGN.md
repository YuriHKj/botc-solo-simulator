# BOTC 单机模拟器系统设计（v0.3）

## 1. 架构
继续采用纯前端 ES Modules：
- `scripts/data.js`：剧本、人数配比、角色元信息。
- `scripts/engine.js`：规则引擎（TB 全规则 + BMR/SnV 官方级细则扩展）。
- `scripts/ai.js`：AI 推理、发言、提名、投票、私聊反馈（含意图识别与对话记忆）。
- `scripts/ui.js`：魔典风界面渲染、流程引导、技能入口。
- `scripts/app.js`：应用编排、存档、回合推进。

## 2. 规则模型

### 2.1 引擎分层
- `tb-full`：TB 完整规则。
- `simplified`：BMR/SnV 承载层；在本次版本将补齐官方细则分支，不再仅概率化处理。

### 2.2 BMR/SnV 状态扩展原则
- 所有“延迟触发”能力存入脚本状态对象（`state.bmr` / `state.snv`）。
- 影响白天信息的夜间状态在 `transitionToDayPhase` 前后保持可查询。
- 死亡/处决后触发统一走 `processNightDeath` / `processExecutionDeath`，避免遗漏胜负检查。

### 2.3 关键结算点
1. 夜晚开始：重置当夜中毒、保护、临时诅咒。
2. 夜间主动技能：按剧本角色顺序结算（含压制、变形、交换、额外击杀）。
3. 恶魔击杀：按恶魔类型细分（如 Po 蓄力、Pukka 延迟、Fang Gu 跳转、Vigormortis 附带中毒）。
4. 信息发放：按角色类型生成精确信息或可解释近似信息。
5. 白天投票/处决：处理 Devil's Advocate、Pacifist、Zombuul、Mastermind、Evil Twin、Vortox 等分支。
6. 死亡触发：Moonchild、Sweetheart、Barber、Klutz、Sage、Grandmother 等。

## 3. 胜负判定
- 保持用户给定规则优先：恶魔死亡判善良胜，2 人存活判邪恶胜，同时满足善良优先。
- 特殊分支前置：Saint、Mayor、Vortox、Mastermind、Evil Twin、Klutz 等。

## 4. 文档对齐
- TB 详见：`docs/design/TB_RULE_COVERAGE.md`
- BMR/SnV 详见：`docs/design/BMR_SNV_RULE_COVERAGE.md`

## 5. 对话系统设计（新增）

### 5.1 私聊处理流水线
1. 阶段校验（必须为 day/private）与额度扣减。
2. 刷新 AI 信念（claim/nomination/vote/night-pattern 信号）。
3. 解析用户提问意图与被提及对象。
4. 将用户话术映射为轻量“关系影响”（协作/质疑）并更新目标 AI 的本地态度。
5. 基于意图生成差异化答复段落（目标、置信度、理由、可选报身份、投票倾向、夜间解释）。
6. 写入 `events.speeches` 与私聊日志，供后续推理复用。

### 5.2 公聊生成策略
- 每个 AI 仍以当前最高嫌疑目标为核心，但改为多模板拼装：
  - 结论句：怀疑对象 + 置信度。
  - 证据句：来自 reason flags。
  - 行动句：提名/投票建议。
- 引入“轮次去重”与“近期关注对象”约束，降低连续重复发言。

### 5.3 会话记忆
- 在 `state.aiDialogue` 中维护轻量记忆（按 pair 与 day）：
  - 私聊轮次、最近提问意图、最近焦点目标、协作分/对抗分。
- 记忆仅影响文本与轻微嫌疑偏置，不改动核心胜负与规则引擎。

## 6. 夜间顺序与剧本手册（v0.4 新增）

### 6.1 顺序参考模型
- 在 `scripts/engine.js` 增加 `NIGHT_ORDER_BY_SCRIPT`，按剧本维护：
  - `firstNight`：首夜唤醒顺序参考。
  - `otherNight`：其后夜晚唤醒顺序参考。
- 对外导出 `getNightOrderReference(scriptId)`，供 UI 直接展示。

### 6.2 规则收紧点
- `each night*` 统一通过 `isRoleNightWindowOpen(...)` 判断是否开放窗口。
- SnV `Pit-Hag` 在首夜不再触发。
- BMR `Chambermaid` 的“是否醒来”统计改为顺序表+夜窗联合判定。
- 夜间信息发放（info ping）按顺序表优先级排序，再按座位兜底。

### 6.3 UI 展示
- 增加“剧本手册”弹窗：
  - 左侧显示本地剧本总览图（含官方首夜/其后夜晚顺序图示）。
  - 右侧显示当前引擎顺序列表（首夜/其后夜晚），用于核对实现口径。
