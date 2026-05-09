# Unity 原型验证记录

## 目标

先验证 Unity 是否适合作为 BOTC Solo 的表现层，而不是立即替换当前 Electron/JS 项目。

## 当前策略

- 保留当前 JS Core：规则、AI、证据簿、角色接口继续在现项目中维护。
- Unity 只做可视化前端原型：魔典、token、对话舞台、阶段演出和 BGM。
- 两边未来通过 JSON view model/action 通信。

## 已落地

目录：`unity-prototype/`

内容：

- `Assets/Scripts/BotcPrototypeBootstrap.cs`：运行时自动生成 UI。
- `Assets/StreamingAssets/sample_viewmodel.json`：原型示例数据。
- `Assets/Resources/Botc/ui`：背景与 token 基础 UI 素材。
- `Assets/Resources/Botc/roles`：少量 TB 角色图标。
- `Assets/Resources/Botc/audio`：三首阶段 BGM。

## 验证点

1. Unity 中的中心魔典是否比当前 HTML UI 更有空间和演出感。
2. token 点击菜单是否适合作为主交互入口。
3. BGM/阶段切换/对话舞台是否比 Electron 更自然。
4. 是否值得继续做 JS Core <-> Unity 通信层。

## 风险

- 当前环境没有检测到 Unity/Unity Hub，因此本轮无法直接编译运行 Unity 工程。
- 原型使用 Unity 运行时动态 UI，第一轮偏验证，不是最终 UI 架构。
- 官方素材仍只应在私有开发中使用，公开仓库需要替换为自制或授权素材。

## 下一步

1. 在 Unity Hub 打开 `unity-prototype` 并 Play 验证画面。
2. 若可行，新增 `unity_viewmodel` 导出器，把当前 JS state 转为 Unity 可读 JSON。
3. 再做 action bridge：Unity 点击 token -> JS Core 处理 -> Unity 重新渲染。

## 2026-05-07 UI 优化记录

本轮目标是在保留 JS Core 与 viewmodel/action bridge 的前提下，让 Unity 对局默认态更接近“中心魔典主视图”。

已调整：

- 顶部 HUD 从厚横条改为更轻、更窄的状态条，降低背景遮挡。
- 中心魔典区域扩大，环形半径略增，中心标题和光环透明度降低，减少视觉噪音。
- 左右常驻面板弱化为流程/资料按钮轨道，不再像大侧栏一样抢主画面。
- 底部对话/行动托盘默认折叠为屏幕底部中央的小胶囊，展开后也缩窄为轻量托盘。
- 按钮统一增加细边框、暖色左侧 accent 和更低透明度，减少硬矩形感。
- token 选中后增加金色细环，怀疑值徽章改为深底细框，降低蓝色硬块感。

未改变：

- `unity_viewmodel.json` 数据结构。
- `unity_action.json` action 协议。
- JS Core 规则、AI、角色接口和测试链。

验证：

- `npm test` 通过。
- Unity batchmode 构建通过，日志：`output/unity-build-ui-2026-05-07.log`。
- `Assembly-CSharp.dll` 已更新至 2026-05-07 14:11:57。
- 构建版 exe 启动 6 秒后仍在运行，Player.log 未见运行时异常。

## 2026-05-07 Demo 对齐记录

目标：让 Unity 构建版可以作为“和 Electron/JS Core 对齐的可运行 demo”，而不是只读取静态 sample。

已调整：

- Unity 字体尺度整体上调：HUD、按钮、token 名牌、角色标签、怀疑值、中央剧本名、底部行动托盘均提升可读性。
- `scripts/unity_action_bridge.mjs` 增加 `--fresh` / `--reset-state`，可强制用 JS Core 创建 fresh demo state 并导出 Unity viewmodel。
- 新增 `tools/run_unity_demo.ps1`：
  - 初始化 `unity_state.json` / `unity_viewmodel.json`。
  - 后台启动 `unity_action_bridge.mjs --watch`。
  - 启动 `unity-build/BOTC_Unity_Prototype.exe`。
- `package.json` 增加：
  - `npm run unity:demo:init`
  - `npm run unity:demo`

当前推荐 demo 命令：

```powershell
npm run unity:demo
```

验证：

- `node --check scripts/unity_action_bridge.mjs` 通过。
- `powershell -ExecutionPolicy Bypass -File tools/run_unity_demo.ps1 -Fresh -NoWatch -NoLaunch` 通过。
- bridge watch 启动验证通过，验证后已停止测试进程。
- `npm test` 通过。
- Unity batchmode 构建通过，日志：`output/unity-build-demo-align-2026-05-07.log`。
- 构建版 exe 启动 6 秒后仍在运行，Player.log 未见运行时异常。

## 2026-05-07 Electron 主干接入记录

依据：`docs/design/UNITY_ELECTRON_CODE_UNDERSTANDING_2026-05-07.md`

已调整：

- 修复 Unity 导出层的恶魔伪装可见性：
  - 非恶魔主视角、非全知魔典视角：`bluffs = ["未知", "未知", "未知"]`。
  - 恶魔或全知视角：显示真实 `state.demonBluffs`。
- Unity viewmodel 新增：
  - `phaseObjectiveTitle`
  - `phaseObjectiveHint`
  - `actionSummary`
  - `privateInfo`
- Unity bottom dock 展示阶段目标、行动摘要和主视角私有信息。
- Unity 增加 Electron/JS Core 主干动作入口：
  - 新局：`new-game`
  - 全知切换：`toggle-grimoire`
  - 白天行动：`day-action`
  - Storyteller 行动：`storyteller-action`
- `tests/unity_viewmodel_contracts.mjs` 增加非恶魔不泄露 bluffs、全知视角显示 bluffs 的契约。

验证：

- `npm test` 通过。
- `powershell -ExecutionPolicy Bypass -File tools/run_unity_demo.ps1 -Fresh -NoWatch -NoLaunch` 通过，live viewmodel 中非恶魔主视角 bluffs 为未知。
- Unity batchmode 构建通过，日志：`output/unity-build-electron-bridge-2026-05-07.log`。
- `Assembly-CSharp.dll` 更新时间为 2026-05-07 14:53:45。
- 构建版 exe 启动 6 秒后仍在运行，Player.log 未见运行时异常。

## 2026-05-07 迁移矩阵推进记录

依据：`docs/design/UNITY_MIGRATION_MATRIX.md`

已调整：

- Unity viewmodel 继续扩展为 UI 的唯一信息来源，新增/锁定：
  - `nightActionText`
  - `dayActionText`
  - `storytellerActionText`
  - `nominationText`
  - `privateDeceptionText`
  - `aiRecap[]`
- Unity bottom dock 接入这些字段，夜间、白天、Storyteller、提名和私聊骗人都展示 JS Core 给出的当前可用状态。
- Unity 私聊骗人接口新增三个闭环预设：
  - `骗身`：发送 `claimRoleId`。
  - `编夜信`：发送 `nightInfo`。
  - `保密`：发送 `askSecret=true`。
- Unity action payload 扩展为可写入 `claimRoleId`、`nightInfo`、`askSecret`，由 `unity_action_bridge.mjs` 归一化为 JS Core 的 `deception` 对象。
- 时间线面板追加 `aiRecap[]`，让 Unity demo 已能看到复盘摘要主干。
- 契约测试补齐：
  - viewmodel 权限矩阵：非全知不泄露他人真实身份，非恶魔不泄露恶魔伪装，全知视角可见。
  - viewmodel 阶段矩阵：Storyteller 队列、复盘、夜晚、私聊、公聊、提名。
  - bridge 行动矩阵：私聊骗人、夜间行动、白天行动、Storyteller 队列、剧本手册、提名/公聊。

仍保留为下一批的 UI 细化：

- 夜间/白天行动还不是完整动态表单；当前 demo 采用“选中 token + 合法输入摘要”的可运行闭环。
- 提名投票已能通过 JS Core 结算，但逐个举手动画尚未导出独立 event stream。
- AI 复盘当前为摘要行，尚未展开到可逐条查看 evidence trail 的详情面板。

## 2026-05-07 迁移矩阵续推进记录

已调整：

- Unity viewmodel 新增 `actionForms[]`，把夜间行动、白天行动、Storyteller 队列统一导出为表单摘要：
  - `inputType`
  - `prompt`
  - `minTargetCount/maxTargetCount`
  - `options`
  - `roleOptions`
  - `modes`
- Unity viewmodel 新增 `voteCeremony`，从 JS Core `state.events.votes[]` 导出：
  - 提名者/被提名者
  - 赞成票数/阈值/是否通过
  - 每名投票者是否举手、是否弃权、是否幽灵票
- Unity viewmodel 新增 `aiRecapDetails[]`，保留 `getAIInsightRows(...)` 中的目标排序和 evidence trail 摘要。
- Unity bottom dock 展示 vote ceremony 文本仪式和动态行动表单摘要。
- Unity timeline panel 展示首位 AI 的证据簿详情，先作为复盘详情面板的数据闭环验证。

验证新增覆盖：

- `tests/unity_viewmodel_contracts.mjs`：
  - `actionForms[]` 三槽位存在。
  - `voteCeremony` 可从投票事件导出。
  - `aiRecapDetails[]` 包含目标排序和 trail 数组。
- `tests/unity_action_bridge_contracts.mjs`：
  - Unity nomination action 会产生 `voteCeremony`。

## 2026-05-07 私聊面板与底部托盘修复

问题：

- 迁移矩阵推进后，底部托盘同时展示阶段目标、私聊说明、行动摘要和三排按钮，导致右侧按钮与状态文本重叠。
- Unity 的“私聊”按钮此前会立即发送询问身份 action；Electron 版则是先打开对话框，再由玩家选择问题、补充文本或骗人选项。

已调整：

- 底部托盘改成三列：
  - 左侧：阶段目标和当前对话/私聊说明。
  - 中间：JS Core 状态、行动表单、投票仪式摘要。
  - 右侧：4x4 动作按钮矩阵。
- 行动摘要增加行数和单行长度裁剪，避免长文本压到按钮区。
- “私聊”按钮现在只打开 Unity 私聊面板，不再立即发送 action。
- 新增“询身”按钮用于发送基础 `private-chat` 身份询问。
- “骗身 / 编夜信 / 保密”继续通过 `unity_action.json` 回传 JS Core 的 deception payload。

当前交互口径：

- Unity 已经可以和其他 agent 交互：按钮写入 `unity_action.json`，`unity_action_bridge.mjs` 调用 JS Core 的 `runPrivateWhisper(...)`，再把 AI 回复、observation/evidence 和 timeline 导回 `unity_viewmodel.json`。
- 尚未迁移 Electron 的自由输入框、角色下拉和 checkbox 形式；当前 Unity 是预设按钮版私聊面板。

## 2026-05-07 私聊真实控件面板

已调整：

- Unity 新增独立私聊面板，打开后不占用底部按钮区。
- 面板包含：
  - 当前目标。
  - 声称身份选择（左右切换，来源于 `scriptHandbook.roles`）。
  - 夜间信息输入框。
  - 请求保密开关。
  - `询问身份` 与 `发送私聊` 按钮。
- `发送私聊` 会把 `claimRoleId`、`nightInfo`、`askSecret` 一并写入 `unity_action.json`，继续由 JS Core 的 `runPrivateWhisper(...)` 处理。

说明：

- 这已经补上 Electron 私聊弹框的核心玩法能力。
- 视觉上仍是运行时 UI 原型，后续可以再替换成更正式的弹窗样式和私聊历史列表。

## 2026-05-07 动态行动表单控件

已调整：

- Unity 新增独立行动表单面板，夜间、白天、Storyteller 按钮不再立即发送默认 action，而是先打开表单。
- 表单展示 JS Core 导出的：
  - `title`
  - `roleName`
  - `inputType`
  - `prompt`
  - `minTargetCount/maxTargetCount`
  - `options`
  - `roleOptions`
  - `modes`
- 表单支持：
  - 点击玩家目标，发送对应 `targetId`。
  - 点击角色选项，发送对应 `roleId`。
  - 点击模式选项，发送对应 `mode`。
  - 点击“自动合法选择”，让 bridge 使用 JS Core 的默认合法输入补全。

仍待细化：

- Fortune Teller 这类多目标行动目前适合用“自动合法选择”；下一步需要做多选勾选后统一确认。
- Juggler/复杂 guesses 表单仍需要专用 UI。

## 2026-05-07 轻量 UI Polish

已调整：

- 底部托盘右侧动作区增加分组标题：私聊、白天流程、角色行动、工具。
- 紧凑按钮字号随按钮高度收敛，避免短按钮文字顶边或挤压。
- 私聊面板、行动表单增加 `Esc 关闭` 提示。
- 私聊面板和行动表单互斥打开，避免两个浮层同时压住魔典。
- `Esc` 现在按层级关闭：
  1. 私聊面板
  2. 行动表单
  3. 日志/时间线
  4. 主菜单

未改变：

- JS Core 规则、AI 和 action bridge 协议。
- Unity viewmodel 字段。

## 2026-05-07 资料抽屉 Tabs

已调整：

- 右侧资料区统一为一个 tabs 抽屉，包含：
  - 日志
  - 时间
  - 手册
  - 复盘
- 原先独立的日志面板和时间线面板不再同时弹出，避免多个侧栏叠加。
- 顶部、侧边和底部入口都会打开同一个资料抽屉：
  - `日志` -> 日志 tab
  - `时间线` -> 时间 tab
  - `剧本/剧本手册` -> 手册 tab
  - `复盘` -> AI 复盘 tab
- 抽屉底部保留说书人队列摘要；手册 tab 改为显示角色总数与类别统计；复盘 tab 显示 AI trail 来源说明。

未改变：

- JS Core 数据结构。
- Unity action/viewmodel 主协议。

## 2026-05-07 行动表单多选

已调整：

- 动态行动表单的玩家目标改为可多选：
  - 点击候选项切换选中状态。
  - 选中项用 `✓` 标记。
  - 达到 `maxTargetCount` 后继续选择会自动移除最早选择。
  - `确认选择` 会发送 `targetIds[]` 给 `unity_action_bridge.mjs`。
  - `清空` 可重置选择。
- 角色选项和模式选项继续保持点击即发送。

验证意义：

- Fortune Teller 等多目标角色不再只能依赖“自动合法选择”。
- Bridge 已有 `targetIds` 契约测试覆盖双目标写入计划。

## 2026-05-07 投票仪式面板

已调整：

- Unity 新增独立投票仪式面板。
- 面板展示：
  - 当前投票日。
  - 提名者 -> 被提名者。
  - 赞成票数 / 阈值。
  - 通过或未通过结果。
  - 逐人举手列表，包括死亡和幽灵票状态。
- 点击底部 `投票` 可打开当前投票面板。
- 发送提名 action 后会自动打开投票面板等待刷新。
- `Esc` 会优先关闭投票面板。

仍待细化：

- 当前为清晰文本仪式；下一步可把 `voteCeremony.voters[]` 做成逐个 token 举手动画。

## 2026-05-07 资料抽屉视觉打磨

已调整：

- 资料抽屉增加顶部暖色 wash、内容区和底部摘要区底色分区。
- tabs 增加选中态：
  - 当前 tab 前显示 `◆`。
  - 当前 tab 使用金色高亮与粗体。
  - 未选中 tab 使用低饱和文字。
- 抽屉标题改为 `资料抽屉 · 日志/时间/手册/复盘`。
- 日志、时间、复盘内容增加分隔标题。
- 剧本手册增加角色分类预览：
  - 镇民
  - 外来者
  - 爪牙
  - 恶魔
- 复盘底部展示 AI 条目数量和数据来源提示。

未改变：

- 资料抽屉仍消费现有 `unity_viewmodel.json`。
- 未新增 JS Core 字段。

## 2026-05-07 私聊历史面板

已调整：

- Unity 私聊面板扩大为正式浮层，顶部保留目标、身份声称、夜间信息和保密开关。
- 面板中部新增 `最近私聊` 区域。
- 历史内容来自现有 `timeline[]`：
  - 只显示 `whisper` / `private` 类型条目。
  - 按当前选中 token 与主视角玩家的往返关系过滤。
  - 仅展示最近 5 条，避免面板拥挤。
- 切换 token 时，如果私聊面板已经打开，会即时刷新历史区域。

未改变：

- 未新增 JS Core 字段。
- 未改变 `unity_action.json` 私聊动作契约。
- 私聊历史仍遵守 `unity_viewmodel.json` 的可见性过滤，Unity 不读取真相 state。

## 2026-05-07 投票逐个举手动画

已调整：

- Unity 投票仪式面板从纯文本列表升级为动画行列表。
- 面板顶部显示：
  - 提名者 -> 被提名者。
  - 实时计票。
  - 当前播放进度或最终结果。
- 面板下方按座位顺序逐个揭示投票者状态：
  - 赞成票高亮为 `举手`。
  - 反对票显示 `放下`。
  - 弃权显示 `弃权`。
  - 死亡和幽灵票状态保留在行内。
- 新增 `重播举手` 按钮，可从头播放当前 `voteCeremony.voters[]`。
- viewmodel 投票 key 变化时会自动重置播放状态，避免旧动画套在新投票上。

未改变：

- 投票结算仍完全来自 JS Core。
- Unity 只消费 `voteCeremony.voters[]`，不自行决定 AI 是否举手。

## 2026-05-07 底部托盘降噪

问题：

- 底部托盘同时承载阶段目标、token 明细、JS Core 摘要和 16 个动作按钮。
- 迁移功能变多后，中栏长文本与右侧按钮矩阵在视觉上过挤，按钮行标题也压缩了可点击区域。

已调整：

- 底部托盘重新划分为左 / 中 / 右三个视觉分区。
- 右侧动作区去掉行标题，保留规整 4x4 按钮矩阵。
- 中栏行动摘要只保留当前最关键的状态、私有信息、夜间/白天/Storyteller/提名摘要。
- 投票详情、行动表单、私聊骗人说明不再塞进中栏，而是交给各自面板承载。

未改变：

- 没有改动 JS Core 数据来源。
- 没有改动 Unity action/viewmodel 契约。

## 2026-05-07 常用动作 + 更多动作抽屉

已调整：

- 底部动作区从 16 个常驻按钮改为 8 个常用入口：
  - 私聊
  - 公聊
  - 提名
  - 投票
  - 行动
  - 资料
  - 更多
  - 收起
- 新增右下 `更多动作` 抽屉，承载低频入口：
  - 询身
  - 骗身
  - 保密
  - 编夜信
  - 夜间
  - 白天
  - 说书人
  - 标记
  - 剧本
  - 复盘
  - 全知
- `行动` 会根据当前 viewmodel 优先打开 Storyteller、夜间或白天行动表单。
- `Esc` 会优先关闭更多动作抽屉。
- 打开私聊、行动表单、投票、资料抽屉时，会自动关闭更多动作抽屉。

未改变：

- 没有新增或修改 JS Core action type。
- 没有改变 `unity_viewmodel.json` / `unity_action.json` 契约。

## 2026-05-07 Token Inspector 独立面板

已调整：

- 点击 token 后不再把完整玩家详情塞进底部 dialogue。
- 新增左下 `Token Inspector` 面板，展示：
  - 身份显示。
  - 存活 / 死亡与鬼票状态。
  - 怀疑值。
  - 魔典标记。
  - 主视角认知角色。
  - 提醒物。
- Inspector 内置快捷按钮：
  - 私聊
  - 提名
  - 关闭
- 底部 dialogue 只保留短提示：当前选中了谁，以及可使用底部常用动作。
- `Esc` 可关闭 Inspector。

未改变：

- Inspector 只消费 `players[]` 里已经由 JS Core/viewmodel 过滤过的字段。
- 没有新增 JS Core 数据字段。
- 没有改变 `select-token` action。

## 2026-05-07 私聊面板视觉定稿

已调整：

- 私聊面板从纵向堆叠控件改为正式双栏弹窗。
- 左侧区域：
  - 当前私聊目标。
  - 最近私聊历史。
- 右侧区域：
  - 本次私聊内容。
  - 声称身份切换。
  - 夜间信息输入。
  - 保密开关。
  - 发送状态反馈。
- 底部统一为三个操作：
  - 询问身份。
  - 发送私聊。
  - 关闭。
- 发送身份询问或私聊内容后，面板内会显示等待 JS Core 刷新的状态。
- 底部 dialogue 改为短提示，不再承载私聊玩法说明长文本。

未改变：

- 私聊仍通过既有 `private-chat` action 写入 `unity_action.json`。
- AI 回复、observation/evidence 和 timeline 仍由 JS Core 生成。
- 没有新增 Unity 侧规则判断。

## 2026-05-08 Unity UI Roadmap Pass

已调整：

- 夜间 / 白天复杂行动表单：
  - 动态表单扩大为正式面板。
  - `actionForms[]` 的目标、身份、模式、问题和 guess 输入都有对应 UI。
  - 支持玩家多选、身份选择、模式选择、问题输入和单组 guess 提交。
  - 表单显示输入说明、当前选择和确认状态。
- Storyteller 队列：
  - 新增独立 Storyteller 队列面板。
  - 展示 `storytellerQueue[]`、当前 pending action、输入类型、目标数和可选项数量。
  - `处理当前` 会打开动态行动表单，仍由 JS Core 结算。
- 剧本手册：
  - 新增独立正式手册面板。
  - 支持全部、镇民、外来者、爪牙、恶魔过滤。
  - 左侧角色列表，右侧角色详情，底部夜晚顺序和类别统计。
  - 主视角身份和魔典标记身份只基于 viewmodel 可见字段提示。
- 投票仪式：
  - 投票动画从行列表升级为 token 式环形举手镜头。
  - 当前询问者高亮，赞成显示 `举`，反对显示 `落`，弃权显示 `弃`。
  - 提名链、实时计票和 JS Core `resultText` 保留在面板顶部。

未改变：

- Unity 不读取 `unity_state.json` 真相。
- Unity 不决定角色行动、Storyteller 处理、剧本能力或投票结果。
- 规则仍通过 `unity_action_bridge.mjs` 进入 JS Core。

