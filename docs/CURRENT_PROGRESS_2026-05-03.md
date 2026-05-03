# 当前工作进度快照

更新日期：2026-05-04

## 总体状态
项目已经从早期 HTML Demo 推进到 Electron 桌面原型。当前主线具备以下基础能力：

- 可运行、可测试的核心游戏框架。
- 三个官方基础剧本的角色模块与白天/夜晚流程雏形。
- 面向单机 BOTC 的结构化角色行动接口。
- 面向主视角沉浸流程的 Storyteller 操作队列。
- AI agent 已开始从“全局读状态”转向“每个玩家只基于自身 observations 推理”。

最近关键提交：

- `72381db feat(core): add structured role action interface`
- `6293cd9 feat(ai): add per-agent observation reasoning`
- `88d16af docs: organize current development handoff`
- `54f31be feat(core): add pending storyteller action queue`
- `89b2db1 feat(ui): specialize storyteller action modal`
- `43f10a6 feat(roles): expand storyteller-trigger interactions`

当前工作树在本快照更新前为 clean；本次修改仅更新该进度快照文档。

## 已完成内容

### 1. 核心流程与数据结构
- 已有 `GameState`、玩家状态、脚本配置、夜晚/白天阶段、提名投票和胜利判定基础。
- 已有 `pendingStorytellerActions` 队列，用于把需要说书人裁定或玩家选择的事件延迟到 UI 中处理。
- 已有 `observationsByPlayer`，用于记录每个玩家自己的信息来源，避免 AI 直接读取全局真相。

### 2. 结构化角色行动接口
角色接口已不再只依赖散落的硬编码函数，而是开始向独立角色模块拆分。

当前已经支持的交互规格包括：

- `player-target`：选择一名或多名玩家。
- `player-role`：选择玩家并选择角色。
- `role`：选择角色。
- `question`：是/否或问题类互动。
- `guesses`：多组猜测。
- `charge-or-targets`：蓄力/攻击类选择。
- `info`：纯信息展示。

这些接口为后续“角色不绑定剧本、可自由组合成新剧本”打了底。

### 3. Storyteller 队列与死亡触发
已经接入或扩展的触发类角色包括：

- `ravenkeeper`：死亡后选择一名玩家，获得其角色信息。
- `moonchild`：死亡后选择一名善良玩家，错误选择会导致目标死亡。
- `klutz`：死亡后选择一名存活玩家；若选择邪恶方，邪恶阵营获胜。
- `barber`：死亡后恶魔可选择交换两名玩家角色。
- `sage`：死亡后若被恶魔杀死，获得两个玩家中有一个是恶魔的信息。
- `professor`：夜间复活一名死亡玩家。
- `snake_charmer`：查验恶魔时与恶魔交换角色与阵营。
- `slayer`：白天公开射击一名玩家。

队列处理已经接入多个触发点：

- 处决后。
- 跳过白天后。
- 夜晚结算后。
- Slayer 行动后。
- 存档/读档后的队列恢复。

### 4. Storyteller 专用 UI
已有专门的说书人弹窗，不再只靠普通日志提示。

当前 UI 能根据 `pendingStorytellerAction.kind` 渲染不同的行动界面：

- 选择玩家。
- 选择两名玩家。
- 恶魔专用交换选择。
- 死亡触发提示。
- 失败/胜利类提示。

这部分是后续“夜间像真实说书人叫醒角色并给出选择”的基础。

### 5. AI Agent MVP
AI 已完成第一步拆分：

- 每个玩家有独立观察记录。
- 公聊、私聊、夜间信息、投票、提名会写入对应玩家 observation。
- AI 推理开始使用自己的 observation，而不是直接读取全部真相。
- 邪恶方互认信息已进入 observation 系统。

不过当前 AI 仍然偏规则模板化，距离“像真实玩家逐步推理”还有明显距离。

### 6. 文档与测试
已有以下关键文档：

- `docs/INDEX.md`
- `docs/CURRENT_PROGRESS_2026-05-03.md`
- `docs/design/PENDING_STORYTELLER_ACTION_QUEUE.md`
- `docs/design/ROLE_MODULE_REFACTOR_PHASE1.md`
- `docs/design/AI_AGENT_MVP.md`

已有测试：

- `tests/role_action_contracts.mjs`
- `tests/ai_agent_contracts.mjs`

最近验证过：

- `npm test`
- `npm run electron:win`

## 仍未满足或需要继续做的需求

### P0：完整对局体验仍不够顺滑
- 白天私聊、公聊、提名、投票、入夜之间仍像工具流，不像完整桌游流程。
- 新手引导还没有完全串成“下一步该做什么”的稳定流程。
- 夜间行动虽然有队列和弹窗雏形，但还没有覆盖所有角色。

### P1：角色规则准确度仍需继续补
- TB/BMR/SnV 仍有大量官方级细则需要持续校准。
- 中毒/醉酒错误信息的“说书人风格”仍然需要逐角色调教。
- 死亡触发、复活、保护、多杀、换角、异常胜负条件需要继续补测试。

### P1：AI 体验仍需继续改
- AI 现在能分开观察，但推理还不够像真实玩家。
- 需要把“信息来源可信度”“谁告诉我的”“是否可能是假信息”“邪恶玩家是否共享信息”做成更明确的证据链。
- 需要减少模板腔，让发言更短、更自然、更带立场变化。

### P1：UI 体验仍需继续精修
- 中心魔典仍要更大、更像官方魔典，减少侧栏和底部面板对空间的侵占。
- 对话舞台和侧栏聊天功能仍存在职责重叠，需要二选一或拆分层级。
- 玩家 token、reminder、死亡帷幕、角色声明等仍需继续贴近官方视觉。

## 建议下一步

我建议下一步优先做三件事：

1. 继续扩展 Storyteller 触发队列，让更多死亡触发、夜间触发、特殊胜负角色走统一队列。
2. 把 AI observation 系统升级为“证据簿”，每条信息记录来源、时间、可信度、是否公开、是否可能被污染。
3. 重做局内 UI 信息层级，让中心魔典成为绝对主角，聊天、日志、伪装、剧本手册都变成可呼出的浮层。

如果继续开发，我建议先做第 2 项。因为 AI 现在最大的风险不是“不会说话”，而是它还没有足够清晰的个人知识边界和证据推导链。这个问题不先稳住，后面无论文案怎么润色，都容易再次出现“AI 像开了全图”的感觉。
