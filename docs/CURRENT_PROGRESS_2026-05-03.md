# 当前工作进度快照

更新日期：2026-05-03

## 总体状态

项目已经从早期 HTML Demo 推进到 Electron 桌面原型。当前主线具备三类基础能力：

- 可以运行和测试的核心游戏框架。
- 三个官方基础剧本的角色模块与夜间/白天流程雏形。
- 正在向“独立玩家视角”演进的 AI agent 系统。

最近一次整理后，工作区已经按主题拆成三次提交：

- `72381db feat(core): add structured role action interface`
- `6293cd9 feat(ai): add per-agent observation reasoning`
- `88d16af docs: organize current development handoff`

当前 `git status --short` 为空，表示没有未提交改动。

## 已完成的主要能力

### 1. 游戏框架

- Electron 桌面应用可以运行。
- 支持开局、玩家数量、剧本选择、自选身份测试入口。
- 支持第一夜、白天私聊、公聊、提名、投票、处决、后续夜晚等基础流程。
- 支持随机初设与基础阵营配置。
- 当前测试入口已经接入 `npm test`。

### 2. 剧本与角色模块

- TB 已经是完成度最高的剧本，核心夜间信息、毒醉误导、恶魔杀人、部分白天/死亡触发都已模块化。
- BMR 和 SnV 已有模块化文件：
  - `scripts/roles/bmr.js`
  - `scripts/roles/snv.js`
- 三个剧本都通过 `scripts/roles/index.js` 暴露角色行动规则和夜晚 runner。
- 已有通用结构化行动接口，不再只支持“选一名/两名玩家”。

当前支持的行动输入类型：

- `player-target`：选择玩家。
- `player-role`：选择玩家 + 角色。
- `role`：只选择角色。
- `question`：输入是/否问题。
- `guesses`：多组玩家 + 角色猜测。
- `charge-or-targets`：蓄力/不行动/多目标行动。

已接入结构化 UI 的重点角色：

- BMR：Gambler、Po。
- SnV：Philosopher、Artist、Cerenovus、Pit-Hag、Juggler。
- TB：Butler、Fortune Teller、Monk、Poisoner、Imp、Slayer 等沿用并适配通用接口。

### 3. AI Agent MVP

AI 已经开始从“全局状态推理”转向“每个 AI 自己看到什么，就根据什么推理”。

当前每个 AI 都有自己的 `state.aiAgents[playerId]`，包含：

- 自己的角色/阵营知识。
- 邪恶方首夜互认信息。
- 恶魔伪装角色。
- 私有观察记录。
- 公共/私有身份声称记录。
- 基础信任与怀疑信息。

已经进入 per-agent observations 的事件：

- 公聊：`public-speech`
- 私聊：`private-whisper`
- 夜间/开局信息：`night-info`
- 邪恶互认：`evil-recognition`
- 提名：`nomination`
- 投票：`vote`
- 处决：`execution`
- 夜死：`night-death`
- 公开身份声称：`claim`

当前 AI 信念刷新已经读取这些 observation 中的主要信号：

- 身份冲突。
- 公聊指控/维护。
- 私聊指控/维护。
- 提名行为。
- 投票行为。
- 夜死前发言关联。
- 已知邪恶队友保护。

### 4. UI 进展

- 已经形成以中间魔典为主的布局方向。
- 已有开始菜单、设置、脚本手册、可收起面板、魔典 token、死亡帷幕、提醒物等基础能力。
- 夜间行动弹窗已经从固定两个目标，升级成根据角色 action schema 动态渲染。
- 私聊/公聊/对话舞台已有雏形，但仍需要进一步收束和美术化。

### 5. 文档与测试

新增或重点维护的文档：

- `docs/design/ROLE_MODULE_REFACTOR_PHASE1.md`
- `docs/design/AI_AGENT_MVP.md`
- `docs/design/WORKTREE_TRIAGE_2026-05-03.md`
- `docs/diagnostics/AI_REPLAY_ANALYSIS_2026-05-03.md`

当前自动测试：

- `tests/role_action_contracts.mjs`
- `tests/ai_agent_contracts.mjs`
- `npm test`

最近验证结果：

- `npm test` 通过。
- `git diff --check` 通过。

## 仍未满足的核心需求

### P0：影响“完整玩一局”的问题

1. 部分 BMR/SnV 角色仍是简化实现。
2. 死亡触发类角色还缺少统一 Storyteller 弹窗队列。
3. 新手流程引导仍偏弱，玩家仍可能不知道下一步该点哪里。
4. AI 对话虽然已有个人视角，但还不是完整的独立推理 agent。
5. UI 中魔典视觉权重还需要继续加大，两侧与底部内容仍要继续收束。

### P1：规则准确性问题

需要重点继续审查：

- BMR：Lunatic、Godfather、Mastermind、Zombuul、Pukka、Shabaloth、Po。
- SnV：Snake Charmer、Mathematician、Savant、Philosopher、Artist、Juggler、Mutant、Cerenovus、Pit-Hag、Vigormortis、Vortox。
- TB：整体较好，但仍需要更多固定种子回归测试覆盖毒醉、注册、死亡触发和胜利边界。

### P1：AI 体验问题

当前 AI 已避免最严重的“全知视角”问题，但仍存在：

- 信念仍是每次刷新时从 observation history 重算，不是增量长期记忆。
- 对话生成仍偏模板化。
- AI 对来源可信度、谎言传播、同日立场一致性的建模较浅。
- 夜间信息已经能进入 observation，但 dialogue 层还没有充分引用这些证据。

### P1：UI 体验问题

仍需继续处理：

- 魔典应继续扩大，减少边栏/底栏抢空间。
- 对话入口应进一步统一到“点击玩家 token”或更沉浸的弹窗流程。
- 公聊最好做成轮流发言、token 高亮、发言气泡或舞台化演出。
- 设置页、开始页、脚本手册页还可以增加装饰与动效。

## 推荐下一阶段路线

### 第一优先级：Storyteller 操作队列

建立 `pendingStorytellerAction` 或类似队列，用来处理死亡触发、特殊选择和流程暂停。

优先覆盖：

- Ravenkeeper
- Moonchild
- Klutz
- Barber
- Sage
- Professor
- Snake Charmer 后续信息/身份变化

这样可以让“玩家夜里/死后要做选择”真正沉浸起来，也能减少系统随机代替玩家决策。

### 第二优先级：AI 观察流升级为证据系统

在 `agent.observations` 之上新增结构化证据层：

- source：消息来源是谁。
- reliability：来源可信度。
- target：指向谁。
- polarity：怀疑/维护/中立。
- reason：触发原因。
- day/night：发生时间。

目标是让 AI 不是直接算一个怀疑分，而是能说出“我为什么这么判断”。

### 第三优先级：UI 回到魔典中心

下一轮 UI 不建议再堆侧栏功能，而是：

- 默认只显示魔典、顶部状态条和必要流程按钮。
- 私聊、标记、夜间行动、角色说明都从 token 点击弹出。
- 底部对话舞台默认折叠或变成可拖动浮窗。
- 复盘时再展示 AI 推理摘要。

### 第四优先级：测试与打包

每完成一组功能后执行：

- `npm test`
- 固定种子三剧本 smoke。
- 关键 UI 截图。
- Electron 打包。

## 当前建议下一步

建议下一步做 `pendingStorytellerAction` 队列。

原因：

- 它能同时服务角色接口、UI 沉浸感和 AI observation。
- 死亡触发与特殊选择是当前“像不像真正 BOTC 流程”的主要缺口。
- 做完后，BMR/SnV 的官方级细则会更容易逐个接入，而不是继续堆随机简化逻辑。
