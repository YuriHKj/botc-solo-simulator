# Unity Playable Demo Visual QA

日期：2026-05-08

## 目标

本轮目标是从玩家视角收束 Unity build demo 的主要体验压力点：底部动作区拥挤、私聊面板信息密度、资料抽屉窄、投票仪式镜头空间偏紧。

规则、AI、权限和 action/viewmodel 协议不在本轮变更范围内；JS Core 仍是唯一规则与结算来源。

## 用户路径验收

已通过自动验收：

1. fresh state 初始化。
2. 选择 token。
3. 私聊并收到 JS Core/AI 回写。
4. 公聊阶段推进。
5. 阶段切换。
6. 提名并生成投票 ceremony。
7. 打开剧本手册。

命令：

```powershell
npm run test:unity-demo-acceptance
```

结果：通过。

## 视觉收束

### 底部动作区

- 底部常驻按钮从 8 个压缩为 6 个：`私聊`、`公聊`、`提名`、`行动`、`投票`、`更多`。
- `收起` 移为右上角小按钮，减少主按钮网格压力。
- 左侧阶段/对话区、中部同步摘要区、右侧常用动作区重新分配宽度。
- 底部同步摘要改为紧凑显示：同步状态、行动摘要、首条私有信息和当前阶段行动只显示最关键 4 行。
- 对话正文在底部限制为 3 行，长内容交给私聊面板、资料抽屉和时间线承载。

### 更多动作抽屉

- 从 3 列改为 4 列，降低抽屉高度。
- 抽屉位置保持在底部右侧，避免遮挡中央魔典。
- 文案缩短，强调这里是低频工具入口。

### Token Inspector

- 保持独立面板，不再把 token 详情挤回底部。
- 本轮未改变字段来源，仍只消费 Unity viewmodel 可见信息。

### 私聊面板

- 面板加宽并上移，减少贴底和右侧压迫感。
- 历史区与本次编辑区重新分栏，历史文本拥有更宽阅读空间。
- 声称身份文本避开左右切换按钮。
- 状态反馈区加高，避免 pending/timeout 文案贴近底部按钮。

### 资料抽屉

- 抽屉整体加宽并加高。
- tab 按钮加宽，主内容区与 Storyteller 摘要区拉开层次。
- 保持日志、时间线、手册、复盘入口不变。

### 投票仪式

- 投票面板加宽并提高高度。
- token 式举手镜头获得更宽横向空间。
- 动画椭圆半径调整，避免 token 接近容器边界。
- 操作按钮加大并保持在底部。

## 验证

执行：

```powershell
npm test
& 'C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe' `
  -batchmode -nographics -quit `
  -projectPath 'C:\Users\11507\Documents\Playground\unity-prototype' `
  -executeMethod BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows `
  -logFile 'C:\Users\11507\Documents\Playground\output\unity-build-visual-qa-layout-2026-05-08.log'
powershell -ExecutionPolicy Bypass -File tools/run_unity_demo.ps1 -Fresh
```

结果：

- `npm test` 通过。
- Unity build 通过，`Assembly-CSharp.dll` 已更新。
- Unity build demo 启动后 6 秒，bridge 与 Unity 进程均仍在运行。
- `Player.log` 未出现 `Exception`、`Error`、`Failed`、`NullReference`。

Unity build 日志仍包含 Unity licensing / pipe close warning，但构建结果为 `Unity prototype build succeeded`，不是本轮 C# UI 改动导致的失败。

## 剩余体验债

- 需要在空闲桌面或专门截图工具下补一轮真实窗口截图 QA，当前自动截图容易被其他前景应用干扰。
- 后续可继续打磨：Token Inspector 内容排版、夜间/白天复杂表单的输入节奏、投票镜头的音效/停顿、私聊历史的滚动与筛选。
- AI 对话自然度和规则边界仍按既定优先级后置。

## 私聊交互修正

发现问题：

- 点 token 会写 `select-token` action，并进入 pending 状态；如果用户马上做私聊，顶部和底部可能仍显示“选中处理中 / 未选中 token”。
- 私聊阶段点非主视角 token 时，Unity 只更新底部/Inspector，不够接近 Electron 的“点私聊弹出对话框”体验。
- `npm run unity:demo -Fresh` 可能读到上次残留的 `unity_action.json`，让新局一开始带着旧选中状态。

修正：

- `select-token` 改为本地即时反馈，不再占用 pending action 状态；后续私聊、提名仍会在 payload 中携带目标，由 JS Core 结算。
- 私聊阶段点击非主视角 token 会直接打开私聊面板。
- 底部摘要优先显示 Unity 本地当前目标，并过滤旧 viewmodel 中的“未选中 token”行。
- `tools/run_unity_demo.ps1 -Fresh` 会清理旧 `unity_action.json` 和 `unity_action_result.json`。

补充验证：

```powershell
npm run test:unity-demo-acceptance
& 'C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe' `
  -batchmode -nographics -quit `
  -projectPath 'C:\Users\11507\Documents\Playground\unity-prototype' `
  -executeMethod BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows `
  -logFile 'C:\Users\11507\Documents\Playground\output\unity-build-private-chat-interaction-fix-2026-05-08.log'
powershell -ExecutionPolicy Bypass -File tools/run_unity_demo.ps1 -Fresh -NoWatch -NoLaunch -BuildAssets
npm test
```

结果：通过。Fresh build assets 初始化输出 `No action file.`，不会继续消费旧 action。

## 私聊无目标状态修正

发现问题：

- 用户从底部直接点 `私聊` 时，面板可能打开但仍显示 `目标：未选择 token`，右侧却露出“声称身份 / 夜间信息 / 发送私聊”的半可用表单。
- 这会让用户以为私聊已经可发送，实际按钮又要求先选目标。

修正：

- 私聊面板新增目标选择覆盖层：无目标时，右侧显示可私聊玩家按钮。
- 选中目标后才露出本次私聊编辑区。
- 底部 `私聊`、`询身`、`骗身`、`编夜信`、`保密` 入口在无目标时都会先打开目标选择层。
- 私聊目标必须是非主视角玩家；点到主视角或旧目标失效时，会回到选目标状态。

补充验证：

```powershell
npm run test:unity-demo-acceptance
& 'C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe' `
  -batchmode -nographics -quit `
  -projectPath 'C:\Users\11507\Documents\Playground\unity-prototype' `
  -executeMethod BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows `
  -logFile 'C:\Users\11507\Documents\Playground\output\unity-build-private-target-picker-2026-05-08.log'
npm test
powershell -ExecutionPolicy Bypass -File tools/run_unity_demo.ps1 -Fresh
```

结果：通过。Unity build demo 启动 6 秒后 bridge 与 Unity 进程均仍在运行，Player.log 未见异常关键词。

## 私聊文本与 BGM 触发收束

发现问题：
- 私聊编辑区的“请求对方暂时保密”复选框与状态提示距离过近，在无目标/超时提示时会出现文字重叠。
- 私聊历史与剧本手册夜晚顺序使用硬截断，长句或长角色列表会在末尾显示省略号，用户看不到完整信息。
- `RenderAllAndMood()` 每次刷新 UI 都会重新播放当前 BGM clip，打开剧本手册这类纯 UI 面板时会像是 BGM 被刷新或莫名切换。

修正：
- 私聊状态提示区下移，并扩大复选框文本的可读宽度。
- 私聊历史从最近 5 行扩展到最近 8 行，单行容量加宽，优先保留完整回复。
- 剧本手册夜晚顺序不再 `Take(5)` 后追加省略号，改为每 5 个角色换行展示完整顺序。
- BGM 增加 `currentMood` 防抖：只有昼/夜/提名仪式 mood 真的变化，或者当前 clip 停止播放时，才会重新 `Play()`。
- 这一步仍只是朝 Electron 版“底部对话框 + 人物立绘”方向的可读性打底；人物立绘式私聊卡片尚未正式接入。

补充验证：
```powershell
npm run test:mojibake
npm run test:unity-demo-acceptance
& 'C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe' `
  -batchmode -quit `
  -projectPath 'C:\Users\11507\Documents\Playground\unity-prototype' `
  -executeMethod BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows `
  -logFile 'C:\Users\11507\Documents\Playground\output\unity-build-private-panel-bgm-text-2026-05-08.log'
npm test
powershell -ExecutionPolicy Bypass -File tools/run_unity_demo.ps1 -Fresh -NoWatch -NoLaunch -BuildAssets
```

结果：通过。Unity build 日志包含 `Unity prototype build succeeded`；demo smoke 启动 6 秒后 bridge 与 Unity 进程均保持运行，Player.log 未见异常关键词。

## 私聊对话框方向稿

目标：
- 将 Unity 私聊 UI 从“右侧工具面板”推进到 Electron 参考图的“底部对话框 + 左侧人物/Token 立绘卡”方向。
- 保持 JS Core action/viewmodel 协议不变，本轮只改变 Unity 表达层和局部信息层级。

实现：
- 私聊面板改为底部居中大对话框，覆盖底部 dock 的部分区域，形成明确的模态对话场景。
- 左侧新增 `privateTargetCardRoot`，根据当前私聊目标动态渲染 token 卡：
  - 未选择目标时显示问号 token 与选择提示。
  - 已选择目标时显示座位号、怀疑值、存活/鬼票状态、公开可见身份或魔典标记。
  - 未揭示玩家不会从 `roleId/roleName` 泄露真实身份，只显示未知或显式标记。
- 右侧上半区承载最近私聊记录，下半区承载本次声称身份、夜间说法、保密与发送操作。
- 无目标时目标选择层覆盖右侧内容区，避免半可用编辑表单暴露。

补充验证：
```powershell
npm run test:mojibake
npm run test:unity-demo-acceptance
& 'C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe' `
  -batchmode -quit `
  -projectPath 'C:\Users\11507\Documents\Playground\unity-prototype' `
  -executeMethod BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows `
  -logFile 'C:\Users\11507\Documents\Playground\output\unity-build-private-dialogue-card-2026-05-08.log'
npm test
powershell -ExecutionPolicy Bypass -File tools/run_unity_demo.ps1 -Fresh -NoWatch -NoLaunch -BuildAssets
```

结果：通过。build demo smoke 启动 6 秒后 bridge 与 Unity 进程均保持运行，Player.log 未见异常关键词。

## 文本 Overflow 策略

目标：
- 文字过长时不能画出自己的 UI 容器，避免遮挡按钮、输入框或相邻说明。
- 短区域优先显示最高价值的信息，超出时用省略号表达“还有内容”。
- 只改 Unity 表达层，不改变 JS Core 导出的数据。

实现：
- `AddText()` 默认纵向 overflow 改为 `VerticalWrapMode.Truncate`。
- 新增 `ClampTextBlock()` 作为单段文案的统一截断入口。
- 顶部 HUD：
  - 阶段文字使用 `Ellipsize(..., 42)`。
  - 最近事件使用 `Ellipsize(..., 72)`。
  - 阶段目标标题/提示限制在底部左侧区域内。
- 私聊状态限制为 2 行，避免压住 compose 区按钮。
- 投票仪式说明和实时计票限制在标题下方说明区内。
- 行动表单说明限制为 4 行，状态限制为 2 行，避免挤压底部确认按钮。

补充验证：
```powershell
npm run test:unity-demo-acceptance
npm run test:unity-assets
npm run test:mojibake
& 'C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe' `
  -batchmode -quit `
  -projectPath 'C:\Users\11507\Documents\Playground\unity-prototype' `
  -executeMethod BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows `
  -logFile 'C:\Users\11507\Documents\Playground\output\unity-build-text-overflow-strategy-2026-05-08.log'
powershell -ExecutionPolicy Bypass -File tools/run_unity_demo.ps1 -Fresh -NoWatch -NoLaunch -BuildAssets
```

结果：通过。Unity build 日志包含 `Unity prototype build succeeded`，`Assembly-CSharp.dll` 更新时间为 2026-05-08 21:11:34。

## 行动表单与剧本手册分页

目标：
- 行动表单和剧本手册不能因为 UI 空间有限而静默隐藏后续选项。
- 先用稳定分页解决可玩 demo 的完整性；复杂滚动容器后续再统一设计。

实现：
- 行动表单目标选项每页 8 项，页码与 `‹` / `›` 控件显示在选项区下方。
- 行动表单身份选项每页 8 项；若 action 未提供专属 `roleOptions`，Unity fallback 会读取完整剧本角色列表。
- 剧本手册角色列表每页 12 个角色，并显示 `第 x/y 页 · n 个角色`。
- 剧本手册切页时自动选中当前页首个角色，避免详情区停留在不可见角色上。
- 增加 `PageCount()` 和 `ClampPage()` 统一处理页码边界。

补充验证：
```powershell
npm run test:unity-demo-acceptance
npm run test:mojibake
& 'C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe' `
  -batchmode -quit `
  -projectPath 'C:\Users\11507\Documents\Playground\unity-prototype' `
  -executeMethod BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows `
  -logFile 'C:\Users\11507\Documents\Playground\output\unity-build-action-handbook-pagination-2026-05-08.log'
powershell -ExecutionPolicy Bypass -File tools/run_unity_demo.ps1 -Fresh -NoWatch -NoLaunch -BuildAssets
npm test
```

结果：通过。Unity build 日志包含 `Unity prototype build succeeded`，`Assembly-CSharp.dll` 更新时间为 2026-05-08 22:33:55。

## Token Inspector 目标详情卡

目标：
- 点击魔典 token 后，信息面板应更像正式 UI，而不是调试日志。
- 详情面板需要承接“目标是谁、当前能知道什么、接下来能做什么”三件事。
- 不改变 JS Core 数据、不新增 action/viewmodel 协议字段，并继续避免未揭示身份泄露。

实现：
- 放大 Token Inspector，并加入标题区、主体底纹和细边框。
- 标题改为 `目标详情`，空状态提示改为“点击魔典 token 查看公开可见信息”。
- 正文压缩成短字段列表：身份、状态、怀疑、玩家认知、提醒物、可用快捷操作。
- 底部按钮改为 `私聊`、`提名`、`行动`、`关闭`。
- 身份显示遵守可见性：已揭示时显示真实身份；未揭示时只显示 `未知` 或显式魔典标记。

补充验证：
```powershell
npm run test:mojibake
npm run test:unity-demo-acceptance
& 'C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe' `
  -batchmode -quit `
  -projectPath 'C:\Users\11507\Documents\Playground\unity-prototype' `
  -executeMethod BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows `
  -logFile 'C:\Users\11507\Documents\Playground\output\unity-build-token-inspector-card-ui-2026-05-08.log'
npm test
powershell -ExecutionPolicy Bypass -File tools/run_unity_demo.ps1 -Fresh -NoWatch -NoLaunch -BuildAssets
```

结果：通过。build demo smoke 启动 6 秒后 bridge 与 Unity 进程均保持运行，Player.log 未见异常关键词。

## HUD 与主界面可读性

目标：
- 顶部 HUD、左右侧栏和 token 状态在 1080p 下更容易扫读。
- 同步状态不再只依赖小字颜色，应有明确状态底色。

实现：
- 顶部 HUD 加宽加高，标题、阵营计数、存活/死亡、阶段、同步状态重新分配空间。
- 同步状态新增 `syncStatusPill` 底色：
  - 正常：绿色暗底。
  - pending：琥珀暗底。
  - timeout/error：红色暗底。
- 左右侧栏背景和边框增强，按钮尺寸从 124x42 提升到 132x44。
- token 选中光圈、怀疑值 badge、名牌和身份标签略微放大，提升魔典主视图辨识度。

补充验证：
```powershell
npm run test:mojibake
npm run test:unity-demo-acceptance
& 'C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe' `
  -batchmode -quit `
  -projectPath 'C:\Users\11507\Documents\Playground\unity-prototype' `
  -executeMethod BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows `
  -logFile 'C:\Users\11507\Documents\Playground\output\unity-build-hud-readability-ui-2026-05-08.log'
npm test
powershell -ExecutionPolicy Bypass -File tools/run_unity_demo.ps1 -Fresh -NoWatch -NoLaunch -BuildAssets
```

结果：通过。build demo smoke 启动 6 秒后 bridge 与 Unity 进程均保持运行，Player.log 未见异常关键词。

## 模态遮罩与面板层级

目标：
- 私聊、行动表单、Storyteller、剧本手册、投票仪式这类大面板打开时，背景魔典不应继续抢视觉焦点。
- 避免资料抽屉先打开后，大面板被抽屉压住或界面层级混乱。

实现：
- 新增 `modalBackdrop`，位于 token inspector 之后、所有大面板之前。
- 大面板激活时显示柔和暗幕，顶部/底部有轻微加深，提升弹窗可读性。
- 点击暗幕会关闭当前活动大面板。
- 打开私聊、行动表单、Storyteller、剧本手册、投票仪式前，会先收起资料抽屉/时间线抽屉。
- 遮罩不参与 JS Core 状态，不改变 action/viewmodel 协议。

补充验证：
```powershell
npm run test:mojibake
npm run test:unity-demo-acceptance
& 'C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe' `
  -batchmode -quit `
  -projectPath 'C:\Users\11507\Documents\Playground\unity-prototype' `
  -executeMethod BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows `
  -logFile 'C:\Users\11507\Documents\Playground\output\unity-build-modal-backdrop-ui-2026-05-08.log'
npm test
powershell -ExecutionPolicy Bypass -File tools/run_unity_demo.ps1 -Fresh -NoWatch -NoLaunch -BuildAssets
```

结果：通过。build demo smoke 启动 6 秒后 bridge 与 Unity 进程均保持运行，Player.log 未见异常关键词。

## 私聊等待气泡

目标：
- 发出私聊/追问后，等待 JS Core/AI 回复的状态应出现在对话流里，而不是只藏在右下角状态文字。
- 切换目标时不应把上一位玩家的等待状态显示到当前玩家对话里。

实现：
- pending action 额外记录 `pendingActionPlayerId`。
- 私聊对话区在目标匹配且 action 未完成时显示系统等待气泡：
  - 正常等待：暖黄色“等待对方回应... 0.0s”。
  - 超时：红色“仍未收到 JS Core 刷新；请确认 bridge 正在运行。”
- 等待气泡会占用最近对话的最后一行，最多显示 2 条最近私聊 + 1 条等待状态，避免挤出容器。
- JS Core 刷新并命中 `lastActionId` 后会清空 pending id、type、player id，等待气泡随之消失。

补充验证：
```powershell
npm run test:mojibake
npm run test:unity-demo-acceptance
& 'C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe' `
  -batchmode -quit `
  -projectPath 'C:\Users\11507\Documents\Playground\unity-prototype' `
  -executeMethod BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows `
  -logFile 'C:\Users\11507\Documents\Playground\output\unity-build-private-pending-bubble-2026-05-08.log'
npm test
powershell -ExecutionPolicy Bypass -File tools/run_unity_demo.ps1 -Fresh -NoWatch -NoLaunch -BuildAssets
```

结果：通过。build demo smoke 启动 6 秒后 bridge 与 Unity 进程均保持运行，Player.log 未见异常关键词。

## 私聊快捷追问

目标：
- 让 Unity 私聊对话框更接近 Electron 版的“继续追问”体验。
- 减少用户每次都要手动组织追问文本的成本。

实现：
- 私聊 compose 区加高并重排，状态提示移到底部右侧，避免和输入框/复选框重叠。
- 新增 4 个快捷追问按钮：
  - `身份范围`：你愿意给身份范围吗？
  - `硬信息`：你有硬信息能证明自己吗？
  - `昨晚信息`：你昨晚得到了什么信息？
  - `提名意向`：你现在想提名谁？
- 按钮仍发送现有 `private-chat` action，只改变 `text` 与 `intent`，不新增 JS Core 协议字段。
- 无目标时会打开私聊面板并提示先选择目标。

补充验证：
```powershell
npm run test:mojibake
npm run test:unity-demo-acceptance
& 'C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe' `
  -batchmode -quit `
  -projectPath 'C:\Users\11507\Documents\Playground\unity-prototype' `
  -executeMethod BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows `
  -logFile 'C:\Users\11507\Documents\Playground\output\unity-build-private-quick-followups-2026-05-08.log'
npm test
powershell -ExecutionPolicy Bypass -File tools/run_unity_demo.ps1 -Fresh -NoWatch -NoLaunch -BuildAssets
```

结果：通过。build demo smoke 启动 6 秒后 bridge 与 Unity 进程均保持运行，Player.log 未见异常关键词。

## 私聊气泡化续作

目标：
- 将“最近私聊”从纯文本记录进一步推进成对话式 UI。
- 让玩家能一眼分辨“我说的话”和“对方回复”，减少阅读压力。

实现：
- 新增 `privateDialogueRoot`，在右侧上半区动态渲染最近 3 条私聊。
- 玩家自己的发言靠右，使用暖棕色气泡；对方回复靠左，使用冷蓝黑气泡。
- 气泡文本限制为 2 行，避免长回复把对话框撑坏；完整历史仍可由时间线/资料抽屉承担。
- `BuildPrivateHistoryText()` 保留为 fallback，并把私聊 timeline 过滤逻辑抽为 `PrivateTimelineEntriesForSelected()`，避免气泡和旧文本各写一套筛选规则。

补充验证：
```powershell
npm run test:mojibake
npm run test:unity-demo-acceptance
& 'C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe' `
  -batchmode -quit `
  -projectPath 'C:\Users\11507\Documents\Playground\unity-prototype' `
  -executeMethod BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows `
  -logFile 'C:\Users\11507\Documents\Playground\output\unity-build-private-dialogue-bubbles-2026-05-08.log'
npm test
powershell -ExecutionPolicy Bypass -File tools/run_unity_demo.ps1 -Fresh -NoWatch -NoLaunch -BuildAssets
```

结果：通过。build demo smoke 启动 6 秒后 bridge 与 Unity 进程均保持运行，Player.log 未见异常关键词。
