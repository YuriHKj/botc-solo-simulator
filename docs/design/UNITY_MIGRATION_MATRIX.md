# Unity Migration Matrix

更新时间：2026-05-07

目标：以 JS Core 作为唯一规则/AI/权限驱动引擎，Unity 只负责更美观的 UI、动画和交互呈现。迁移不采用“复制 Electron DOM”的方式，而是把 Electron 已有玩法能力抽成 `unity_viewmodel.json` 字段和 `unity_action.json` 动作契约。

## 状态标记

- Done：已迁移并有测试或 smoke 覆盖。
- Partial：已有主干，但 UI 或测试仍不完整。
- Planned：尚未接入。

## 功能矩阵

| Electron 已有功能 | JS Core 数据/动作来源 | Unity viewmodel 字段 | Unity UI 状态 | 测试覆盖 | 状态 |
| --- | --- | --- | --- | --- | --- |
| 新局 / 指定主视角角色 | `createNewGame(...)` via `unity_action_bridge.mjs:new-game` | `scriptId`, `scriptName`, `players`, `setup`, `events` | 顶部“新局”按钮 + demo script | `unity_action_bridge_contracts` | Done |
| 阶段 HUD | `state.phase`, `state.dayStage`, `dayStageMeta` | `phaseLabel`, `phaseObjectiveTitle`, `phaseObjectiveHint` | 顶部 HUD + bottom dock 阶段目标 | `unity_viewmodel_contracts` | Done |
| token 环形魔典 | `state.players`, `publicRoleLabel(...)`, AI insight suspicion | `players[]` | Unity grimoire token | `unity_viewmodel_contracts` | Done |
| 自己身份可见 | `getPerceivedRoleId(...)`, `publicRoleLabel(...)` | `players[].human/revealed/roleId/roleName` | human token 显示自身认知角色 | `unity_viewmodel_contracts` | Done |
| 非主视角身份隐藏/声明显示 | `publicRoleLabel(...)`, `grimoireNotes` | `players[].roleId/roleName/markedRoleName` | token 角色标签 | `unity_viewmodel_contracts` | Done |
| 恶魔伪装 | `state.demonBluffs`; Electron 权限：`grimoireView || human.category === "demon"` | `bluffs[]` | 左下 bluffs panel | 非恶魔隐藏、全知显示契约 | Done |
| 魔典全知视角 | `toggle-grimoire` action | `grimoireView`, `players[].actualRoleId`, `bluffs[]` | 右侧“全知”按钮 | `unity_action_bridge_contracts`, `unity_viewmodel_contracts` | Done |
| 私有日志过滤 | `logs[].payload.private`, human visibility | `events[]`, `privateInfo[]` | 事件日志 + bottom dock 私有信息 | `unity_viewmodel_contracts` | Done |
| 公聊/私聊时间线 | `state.aiDialogue.timeline` | `timeline[]`, `dialogueTitle`, `dialogueText` | timeline panel + bottom dialogue | `unity_viewmodel_contracts`, bridge private/public tests | Done |
| 私聊基础动作 | `runPrivateWhisper(...)` | `action`, `timeline`, `dialogue*` | token 选择 + “私聊”面板 + “询身”发送 | `unity_action_bridge_contracts` | Done |
| 私聊骗人接口 | `runPrivateWhisper(... deception ...)`, `state.aiDialogue.timeline` | `privateDeceptionText`, `scriptHandbook.roles`, `timeline[]` | Unity 私聊面板：身份切换、夜间信息输入、保密开关、发送按钮；按当前目标过滤最近私聊历史 | bridge/viewmodel contract + Unity build smoke | Done |
| 公聊动作 | `runAIDiscussion(...)`, `markPublicDiscussionRound(...)` | `timeline[]`, `phaseObjective*` | “公聊”按钮 | `unity_action_bridge_contracts` | Done |
| 提名/投票流程 | `resolveNominationAndVote(...)`, `decideAIVote(...)` | `nominationText`, `voteCeremony`, `events[]`, `action` | “提名”按钮，优先使用选中 token；投票结果和举手名单展示在行动托盘 | `unity_action_bridge_contracts`, `unity_viewmodel_contracts` | Done |
| 夜间角色行动 | `getHumanNightActionState(...)`, `setHumanNightActionPlan(...)` | `humanNightAction`, `nightActionText`, `actionForms[]` | “夜间/行动”打开复杂动态表单；支持目标、身份、模式、问题、guess 组合后确认 | `unity_action_bridge_contracts`, `unity_viewmodel_contracts`, Unity build smoke | Done |
| 白天角色行动 | `getHumanDayActionState(...)`, `setHumanDayActionPlan(...)` | `humanDayAction`, `dayActionText`, `actionForms[]` | “白天/行动”打开复杂动态表单；支持目标、身份、模式、问题、guess 组合后确认 | `unity_viewmodel_contracts`, `unity_action_bridge_contracts`, Unity build smoke | Done |
| Storyteller 队列 | `pendingStorytellerActions`, `resolvePendingStorytellerAction(...)` | `storytellerQueue[]`, `pendingStorytellerAction`, `storytellerActionText`, `actionForms[]` | 独立 Storyteller 队列面板 + “处理当前”动态表单 | `unity_viewmodel_contracts`, `unity_action_bridge_contracts`, Unity build smoke | Done |
| 剧本手册 | `getNightOrderReference(...)`, `getAllRoles(...)` | `scriptHandbook` | 独立正式手册：类别过滤、角色列表、角色详情、夜晚顺序摘要 | `unity_action_bridge_contracts`, Unity build smoke | Done |
| reminder / 魔典标记 | `addGrimoireReminder(...)`, `setGrimoireMarkedRole(...)` | `players[].reminders/markedRoleName` | “标记”按钮（当前默认 Guard） | `unity_action_bridge_contracts` | Partial |
| AI 复盘摘要 | `getAIInsightRows(...)` | `aiRecap[]`, `aiRecapDetails[]` | 时间线 panel 展示摘要与首位 AI 证据簿详情 | `unity_viewmodel_contracts` | Partial |
| 投票逐个举手动画 | `state.events.votes[]` | `voteCeremony.voters[]` | 独立投票仪式面板展示提名链、实时计票、token 式环形举手镜头；支持重播动画 | `unity_viewmodel_contracts`, `unity_action_bridge_contracts`, Unity build smoke | Done |
| Electron 完整设置/存档 | `app.js` settings/save slots | 待设计 | 未迁移 | 未覆盖 | Planned |

## 当前迁移策略

1. 先迁移 viewmodel 权限和阶段矩阵，防止 Unity 泄露 JS Core 不该暴露的信息。
2. 行动先做“可闭环按钮 + 自动/选中 token 参数”，再逐步升级成完整动态表单。
3. 复杂 UI（夜间表单、私聊骗人、投票动画、AI 证据簿）每迁移一项都必须补契约测试。
4. Unity 不实现规则，不解释阵营，不直接访问 `unity_state.json` 中的真相；它只消费 `unity_viewmodel.json`。

## 下一批应推进项

1. 动态夜间/白天行动表单：目标多选、角色选择、模式选择、问题和单组 guess 已可回传；下一步是针对具体角色做专门美术控件。
2. 私聊骗人接口：Unity 已有身份切换、夜间信息输入、保密开关和按目标过滤的历史私聊列表；下一步可升级为更漂亮的正式弹窗样式。
3. 提名/投票：`voteCeremony.voters[]` 已导出并可播放 token 式环形举手镜头；下一步可补音效和处决过场。
4. AI 复盘：`aiRecapDetails[]` 已导出；下一步做可选 AI、可选目标、trail 明细面板。
