# CHANGE REQUESTS

## CR-2026-04-20-01
- 请求人：用户
- 目标：开发单机《血染钟楼》模拟器，先支持官方三剧本。
- 状态：已完成 v0.1（简化引擎）。

## CR-2026-04-20-02
- 请求人：用户
- 时间：2026-04-20
- 变更内容：
  1. 完整实现暗流涌动（TB）技能。
  2. 参考官方魔典网页 UI 风格（并结合用户截图）。
  3. 胜负判定遵循用户提供 txt 规则。
  4. 最终目标支持 `.exe`；当前主线为 BOTC-Solo 桌面版。
- 状态：已完成（v0.2）。

## CR-2026-04-21-01
- 请求人：用户
- 时间：2026-04-21
- 变更内容：
  1. 补全 BMR/SnV 剩余角色的“官方级”细则判定。
  2. 保持现有 UI 与本地素材方案不回退。
  3. 输出可运行 exe 并同步文档与验证记录。
- 处理策略：
  - 以 `scripts/engine.js` 为主实现 BMR/SnV 细则。
  - 对文本裁定类能力采用“系统可解释近似 + 日志标注”。
  - 通过构建与启动冒烟验证确认回归。
- 状态：已完成（v0.3）。

## CR-2026-04-21-02
- 请求人：用户
- 时间：2026-04-21
- 变更内容：
  1. 深化并优化“与电脑玩家聊天”流程。
  2. 让私聊回复与提问意图、局势线索、信任关系产生更强关联。
  3. 降低公聊模板重复，增强可解释性与可读性。
- 处理策略：
  - 在 `scripts/ai.js` 新增“问题意图识别 + 聊天记忆 + 分类型应答”。
  - 私聊中支持对“怀疑对象、信任、报身份、投票倾向、夜间解读、双人比较”等问题给出差异化回答。
  - 公聊发言改为多模板生成，绑定嫌疑排序与证据原因，减少机械重复。
  - 保持与现有 day-stage（私聊/公聊/提名）状态机兼容。
- 状态：已完成（v0.3）。

## CR-2026-04-21-03
- 请求人：用户
- 时间：2026-04-21
- 变更内容：
  1. 修复“每个夜晚 / 每个夜晚*”首夜触发语义（重点：占卜师首夜应行动，恶魔类 `*` 首夜不行动）。
  2. 修复界面与日志中的乱码文本。
  3. 取消 `AI-x` 命名，改为座位号表达。
  4. 重新打包可运行 EXE。
- 状态：已完成（v0.3）。

## CR-2026-04-21-04
- 请求人：用户
- 时间：2026-04-21
- 变更内容：
  1. 将所有 `each night*` 角色修正为“首夜不触发”语义。
  2. 在局内提供可查看的剧本总览与夜间行动顺序表（基于三张官方剧本截图）。
  3. 根据顺序表收紧夜间结算顺序与触发窗口。
- 处理策略：
  - 在 `engine.js` 增加剧本级夜间顺序常量，统一首夜/其后夜晚顺序参考。
  - 用 `isRoleNightWindowOpen` + 顺序表约束 `Pit-Hag`、BMR 侍女统计与夜间信息发放顺序。
  - 在 `index.html`/`ui.js`/`styles.css` 增加“剧本手册”弹窗，显示本地剧本大图与引擎顺序列表。
- 状态：已完成（v0.4）。

## CR-2026-05-07-01
- 请求人：用户
- 时间：2026-05-07
- 变更内容：
  1. 深度调研当前 BOTC Solo Simulator 项目文件，恢复 Electron/JS Core 与 Unity prototype 双线背景。
  2. 在不重置、不清理未提交改动的前提下，继续优化 Unity prototype 的对局 UI。
  3. 视觉方向：顶部 HUD 更轻，中心魔典占据主视觉，左右流程/资料入口弱化为按钮轨道，底部对话默认收起为小胶囊，减少硬矩形和大面板对魔典的遮挡。
  4. 放大 Unity 对局界面字体，提升 token、按钮、HUD、底部托盘和中央剧本标题的可读性与正式感。
  5. 增加 Unity demo 启动入口，使 Unity 构建版可通过 JS Core fresh state + action bridge 运行，而不是只展示静态 sample。
  6. 生成 Unity/Electron 接入代码理解文档，明确 Unity 只作为 JS Core 表现层，不承载规则重写。
  7. 修复 Unity 版非恶魔主视角泄露恶魔伪装的问题，权限口径对齐 Electron：非恶魔且非全知时只显示未知。
  8. 将 Electron 已有的阶段目标、私有信息、行动摘要、白天行动、Storyteller 行动、全知切换和新局入口接入 Unity viewmodel/action bridge 主干。
  9. 生成 Unity 迁移矩阵，以 Electron 功能、JS Core 来源、Unity viewmodel 字段、Unity UI 状态和测试覆盖逐项推进。
  10. 扩展 Unity viewmodel 契约，覆盖权限矩阵和阶段显示矩阵，避免 Unity UI 只“看起来能跑”但信息权限错误。
  11. 接入 Unity 私聊骗人预设、夜间/白天行动摘要、Storyteller 队列摘要、提名/投票入口、剧本手册和 AI 复盘摘要。
  12. 继续推进矩阵剩余项：动态行动表单数据、投票 ceremony stream、AI 证据簿复盘详情。
- 处理策略：
  - 保持 JS Core、viewmodel/action bridge 协议不变。
  - 仅调整 `unity-prototype/Assets/Scripts/BotcPrototypeBootstrap.cs` 的运行时 UI 生成布局、按钮质感与默认可见性。
  - 在 `scripts/unity_action_bridge.mjs` 增加 `--fresh` / `--reset-state` 初始化选项。
  - 新增 `tools/run_unity_demo.ps1`，串联状态初始化、bridge watch 和 Unity exe 启动。
  - 在 `package.json` 增加 `unity:demo:init` 与 `unity:demo`。
  - 在 `scripts/unity_viewmodel.js` 中复用 Electron 可见性口径，新增 Unity 可消费的 `phaseObjectiveTitle`、`phaseObjectiveHint`、`actionSummary`、`privateInfo`。
  - 增加 `nightActionText`、`dayActionText`、`storytellerActionText`、`nominationText`、`privateDeceptionText`、`aiRecap[]`，让 Unity UI 直接消费 JS Core 生成的显示语义。
  - 在 `tests/unity_viewmodel_contracts.mjs` 中加入权限矩阵和阶段矩阵。
  - 在 `tests/unity_action_bridge_contracts.mjs` 中加入私聊骗人、白天行动和 Storyteller 队列闭环。
  - 在 `scripts/unity_viewmodel.js` 中新增 `actionForms[]`、`voteCeremony`、`aiRecapDetails[]`，将候选项、投票逐人数据和 AI trail 作为 Unity 可消费数据。
  - 在 Unity C# 中展示动态行动表单摘要、投票仪式文本和 AI 证据簿详情，下一步再替换为可点击控件与动画。
  - 在 Unity C# UI 中展示上述状态，并把新增按钮全部回传给 `unity_action_bridge.mjs`。
  - 通过 `npm test` 与 Unity batchmode 构建验证不破坏现有契约和原型编译。
- 状态：已完成（Unity UI prototype + migration matrix pass）。

## CR-2026-05-08-01
- 请求人：用户
- 时间：2026-05-08
- 变更内容：
  1. 补齐 Unity 夜间/白天复杂行动表单，使 `actionForms[]` 的目标、身份、模式、问题和猜测类输入都有明确 UI。
  2. 新增 Unity Storyteller 队列独立面板，不再只把队列藏在资料抽屉摘要里。
  3. 将 Unity 剧本手册正式化为可扫描的角色列表 + 详情 + 类别过滤。
  4. 将 Unity 投票仪式从行列表动画升级为 token 式举手镜头，同时保留 JS Core 投票结果为唯一事实来源。
- 处理策略：
  - 不改 JS Core 规则归属，不在 Unity 中新增规则判定。
  - 复用现有 `unity_viewmodel.json` 字段：`actionForms[]`、`pendingStorytellerAction`、`storytellerQueue[]`、`scriptHandbook`、`voteCeremony.voters[]`。
  - 必要时仅扩展 Unity action payload 表达，使其仍由 `unity_action_bridge.mjs` 调用 JS Core 结算。
  - 每块 UI 完成后运行 `npm test`、JS 语法检查、Unity batchmode build 和 exe smoke，并记录验证。
- 状态：已完成（Unity UI roadmap pass）。

## CR-2026-05-08-02
- 请求人：用户
- 时间：2026-05-08
- 变更内容：
  1. 做 Unity 可玩 demo 验收，验证 build/bridge/viewmodel/action 的真实闭环，而不是只验证静态 UI。
  2. 收束 Unity UI 状态反馈：玩家点击操作后，应能看见“已写入、处理中、已刷新、错误、bridge 未响应”的明确状态。
  3. 修复手动启动 build exe 时容易误以为 AI 没回复的问题；bridge 未启动或监听错目录时，Unity UI 需要给出可执行提示。
- 处理策略：
  - JS Core 仍是唯一规则、AI 和结算来源。
  - Unity 只新增本地 pending action 状态追踪和同步提示，不新增规则判定。
  - 新增可重复运行的 demo acceptance 脚本，覆盖新局、选 token、私聊、公聊、提名投票和剧本手册闭环。
  - 将 build 版 bridge 启动方式写入文档和 npm scripts。
- 状态：已完成（Unity playable demo acceptance + UI sync feedback pass）。

## CR-2026-05-08-03
- 请求人：用户
- 时间：2026-05-08
- 变更内容：
  1. 仔细梳理 Electron 版构建流程和资源打包流程，解释为什么 Electron 有完整素材而 Unity build 缺角色图。
  2. 将 Electron 资源源目录与 Unity Resources 镜像之间的同步脚本化，避免以后新增/声明角色时 Unity 再出现白块或缺图。
  3. 把资源同步检查纳入测试与 Unity demo/build 流程。
- 处理策略：
  - 保持 `assets/**` 作为 Electron/JS Core 的资源源头。
  - 新增 `scripts/sync_unity_assets.mjs`，同步 `assets/roles/{tb,bmr,snv}` 和 `assets/ui` 到 `unity-prototype/Assets/Resources/Botc`。
  - 新增 `tests/unity_asset_contracts.mjs`，检查 JS Core 三个官方剧本的角色图都存在于 Unity Resources。
  - `npm test` 纳入 `test:unity-assets`。
  - `tools/run_unity_demo.ps1` 和 Unity Editor build 入口都在启动/构建前同步资源。
- 状态：已完成（Electron/Unity asset build flow guarded）。

## CR-2026-05-08-04
- 请求人：用户
- 时间：2026-05-08
- 变更内容：
  1. 继续阅读 Electron 构建和运行路径，避免开发态正常、打包态才暴露的 Unity 接入 bug。
  2. 修复 Electron `botc:write-unity-viewmodel` 在 packaged app 中可能尝试写入 `app.asar` 或源码目录的问题。
  3. 增加路径契约测试，把开发态、打包态和环境变量覆盖路径固定下来。
  4. 增加 Electron build.files 契约，防止素材、脚本或 Electron helper 在打包配置中被漏掉。
  5. 增加快速 unpacked package 入口，用真实 `app.asar` 检查新 helper、preload、JS Core 和素材是否进包。
- 处理策略：
  - 新增 `electron/path_helpers.cjs`，集中解析 Unity viewmodel 输出路径。
  - Electron 开发态仍写 `unity-prototype/Assets/StreamingAssets/unity_viewmodel.json`，方便 Unity Editor 调试。
  - Electron 打包态检测到 `app.asar` 后写入 `app.getPath("userData")/unity/unity_viewmodel.json`。
  - `BOTC_UNITY_VIEWMODEL_PATH` 可显式覆盖输出路径，用于未来 Electron/Unity 外壳联调。
  - 新增 `electron:pack`，用于执行 `electron-builder --win --dir` 的轻量打包验证。
  - 新增 `tests/electron_build_contracts.cjs`，固定 Electron 包含 `assets/**/*`、`scripts/**/*` 和 `electron/**/*`。
  - 新增 `tests/electron_path_contracts.cjs` 并纳入 `npm test`。
- 状态：已完成（Electron packaged viewmodel path guarded）。

## CR-2026-05-08-05
- 请求人：用户
- 时间：2026-05-08
- 变更内容：
  1. 做 Unity build 版用户视角验收，确认 demo 黄金路径不只是在契约里通过，也能作为可玩流程启动。
  2. 收束当前最明显的 UI 拥挤问题，优先处理底部动作区、更多动作抽屉、私聊面板、资料抽屉和投票仪式镜头。
  3. 不触碰 JS Core 规则、AI 逻辑、权限边界或 Unity action/viewmodel 协议。
- 处理策略：
  - 底部动作区改为 6 个常用动作 + 小型收起按钮，减少按钮网格压力。
  - 底部同步摘要改为紧凑 4 行，长文本交给私聊面板、资料抽屉和时间线承载。
  - 更多动作抽屉改为 4 列，降低高度并保持在底部右侧。
  - 私聊面板加宽上移，历史区和编辑区重排，状态反馈区加高。
  - 资料抽屉加宽加高，tab 与主/副内容区重新分配空间。
  - 投票仪式面板加宽，token 式举手镜头半径调整，避免接近容器边界。
  - 新增 `docs/design/UNITY_PLAYABLE_DEMO_VISUAL_QA_2026-05-08.md` 记录验收路径、视觉改动和剩余体验债。
- 状态：已完成（Unity playable demo visual QA + layout declutter pass）。

## CR-2026-05-08-06
- 请求人：用户
- 时间：2026-05-08
- 变更内容：
  1. 修复 Unity 私聊交互中 token 选中 pending 与私聊面板打开之间的竞态。
  2. 私聊阶段点非主视角 token 时，应直接进入私聊面板，而不是只在底部显示摘要。
  3. Fresh demo 启动不应继承上一次残留的 `unity_action.json`。
- 处理策略：
  - `select-token` 仍写入 action 文件供 bridge 同步，但在 Unity 本地不再作为需要等待的 pending action。
  - 私聊、提名等真实动作仍正常 tracking pending，并继续由 JS Core 结算。
  - 私聊阶段点击非主视角 token 自动打开私聊面板。
  - 底部摘要优先显示本地当前目标，并过滤旧 viewmodel 的“未选中 token”行。
  - `tools/run_unity_demo.ps1 -Fresh` 清理旧 action/result 文件，避免新局启动消费旧操作。
- 状态：已完成（Unity private chat interaction race fixed）。

## CR-2026-05-08-07
- 请求人：用户
- 时间：2026-05-08
- 变更内容：
  1. 修复 Unity 私聊面板在未选择目标时仍显示半可用编辑表单的问题。
  2. 用户直接点击底部 `私聊` 时，应在面板内选择私聊目标，而不是只依赖魔典 token 点击。
- 处理策略：
  - 私聊面板新增目标选择覆盖层，无目标时显示可私聊玩家按钮。
  - 选中非主视角玩家后，才显示声称身份、夜间信息、保密和发送按钮对应的编辑区。
  - 底部 `私聊`、`询身`、`骗身`、`编夜信`、`保密` 在无目标时统一打开目标选择层。
  - 私聊目标必须是非主视角玩家；旧目标失效或选中主视角时回到选目标状态。
- 状态：已完成（Unity private chat target picker pass）。

## CR-2026-05-08-08
- 请求人：用户
- 时间：2026-05-08
- 变更内容：
  1. 修复 Unity 私聊面板中文字重叠、私聊历史末尾被截断、剧本手册夜晚顺序看不到完整尾部的问题。
  2. 修复打开剧本手册等纯 UI 面板时 BGM 可能被重复播放/刷新，造成“莫名切 BGM”的体验。
  3. 继续朝 Electron 版“底部对话框 + 人物立绘”的私聊表达方向收束，但本轮先做可读性与状态触发底座。
- 处理策略：
  - 私聊状态提示下移，复选框文本宽度扩展，避免和提示文案重叠。
  - 私聊历史展示最近 8 行并加宽单行容量。
  - 剧本手册夜晚顺序完整展示，按 5 个角色一行换行，不再硬省略。
  - BGM 增加当前 mood 记录，只有昼/夜/提名仪式 mood 变化或 clip 停止时才重新播放。
- 状态：已完成（Unity private panel text + BGM mood guard pass）。

## CR-2026-05-08-09
- 请求人：用户
- 时间：2026-05-08
- 变更内容：
  1. 私聊 UI 朝 Electron 参考图的“底部对话框 + 人物立绘/Token 卡”方向推进。
  2. 私聊面板应减少工具面板感，形成更清晰的对话场景。
  3. 不改变 JS Core 规则、AI 回复、action payload 或 viewmodel 字段。
- 处理策略：
  - 私聊面板改为底部居中大对话框。
  - 新增左侧目标 token 卡，根据当前目标渲染座位、怀疑值、存活/鬼票状态和可见身份。
  - 未选择目标时左侧显示问号 token，右侧显示目标选择层。
  - 已选择目标时右侧上半区显示最近私聊，下半区显示声称身份、夜间说法、保密和发送操作。
  - 未揭示目标不读取真实身份显示；只显示未知或明确的魔典标记。
- 状态：已完成（Unity private dialogue card direction pass）。

## CR-2026-05-08-10
- 请求人：用户
- 时间：2026-05-08
- 变更内容：
  1. 继续完善私聊对话框，使最近私聊更接近 Electron 版聊天体验。
  2. 区分玩家发言和对方回复，降低纯文本历史的阅读压力。
  3. 不改变 JS Core 私聊 action、AI 回复或 timeline 数据来源。
- 处理策略：
  - 新增 `privateDialogueRoot`，动态渲染最近 3 条私聊气泡。
  - 玩家发言靠右，对方回复靠左，使用不同色彩和边框强化区分。
  - 气泡限制为 2 行，避免长回复撑破底部对话框；完整历史继续由 timeline/资料抽屉承载。
  - 抽出 `PrivateTimelineEntriesForSelected()` 作为私聊记录筛选共用逻辑。
- 状态：已完成（Unity private dialogue bubbles pass）。

## CR-2026-05-08-11
- 请求人：用户
- 时间：2026-05-08
- 变更内容：
  1. 继续完善 Unity 私聊对话框，补齐 Electron 版“继续追问”式交互。
  2. 快捷追问应复用现有 JS Core 私聊 action，不引入新协议字段。
  3. 调整底部 compose 区拥挤问题，避免新增按钮后文字重叠。
- 处理策略：
  - 私聊 compose 区加高，状态提示移到底部右侧。
  - 新增 `身份范围`、`硬信息`、`昨晚信息`、`提名意向` 4 个快捷追问按钮。
  - 新增 `SendPrivateQuickQuestion()`，统一处理无目标状态、发送 `private-chat` action、更新本地等待提示。
  - 快捷追问仅设置 `text` 与 `intent`，保持现有 bridge/action schema。
- 状态：已完成（Unity private quick follow-ups pass）。

## CR-2026-05-08-12
- 请求人：用户
- 时间：2026-05-08
- 变更内容：
  1. 私聊发送后等待 JS Core/AI 回复的状态需要更明显，不能只显示在角落状态文字里。
  2. 等待/超时反馈应与当前私聊目标绑定，避免切换目标时误显示上一段等待状态。
  3. 保持现有 JS Core 协议不变。
- 处理策略：
  - pending action 增加 Unity 本地 `pendingActionPlayerId`。
  - 私聊对话区新增系统等待气泡，正常等待显示秒数，超时显示 bridge 检查提示。
  - 等待气泡只在当前目标与 pending target 匹配时显示。
  - 对话区最多显示 2 条最近私聊 + 1 条等待气泡，避免布局溢出。
- 状态：已完成（Unity private pending bubble pass）。

## CR-2026-05-08-13
- 请求人：用户
- 时间：2026-05-08
- 变更内容：
  1. 优化 Unity 大面板 UI 层级和背景干扰。
  2. 私聊、行动表单、Storyteller、剧本手册、投票仪式打开时需要更像正式模态弹窗。
  3. 修复资料抽屉与大面板可能同时显示导致的层级混乱。
- 处理策略：
  - 新增 `modalBackdrop` 暗幕层，放在所有大面板下方。
  - 大面板激活时显示暗幕，点击暗幕关闭当前活动大面板。
  - 打开任一大面板前统一 `CloseAuxPanels()`，收起资料抽屉/时间线。
  - 遮罩层只属于 Unity 表达层，不改变 JS Core action/viewmodel。
- 状态：已完成（Unity modal backdrop + panel hierarchy pass）。

## CR-2026-05-08-14
- 请求人：用户
- 时间：2026-05-08
- 变更内容：
  1. 继续优化 Unity 主界面 UI 可读性。
  2. 顶部 HUD、左右侧栏、token 名牌和同步状态需要更清楚。
  3. 不改变 JS Core 规则、AI、action/viewmodel 协议。
- 处理策略：
  - 顶部 HUD 加宽加高，重新排布标题、阵营计数、存活/死亡、阶段和右侧操作按钮。
  - 新增 `syncStatusPill`，按 normal/pending/error/timeout 显示不同底色。
  - 左右侧栏加深背景和边框，提高按钮尺寸。
  - token 选中光圈、怀疑值 badge、名牌和身份标签略微放大。
- 状态：已完成（Unity HUD readability pass）。

## CR-2026-05-08-15
- 请求人：用户
- 时间：2026-05-08
- 变更内容：
  1. 继续优化 Unity 主界面 UI。
  2. 点击 token 后的信息面板需要更像正式的目标详情卡，减少底部文本压力和调试感。
  3. 未揭示目标仍不能通过详情面板泄露真实身份。
- 处理策略：
  - 放大并重新排版 Token Inspector，标题改为 `目标详情`，增加主体底纹和边框。
  - 正文改为短字段列表：身份显示、状态、怀疑值、玩家认知、提醒物和可用快捷操作。
  - 底部按钮调整为 `私聊`、`提名`、`行动`、`关闭`，减少绕回底部动作托盘的成本。
  - 未揭示目标只显示未知或明确的魔典标记，不读取真实角色名。
- 状态：已完成（Unity token inspector detail card pass）。

## CR-2026-05-08-16
- 请求人：用户
- 时间：2026-05-08
- 变更内容：
  1. 制定并落实 Unity 文本 overflow 策略。
  2. 文本应优先在容器内截断，避免跑出面板、压住按钮或与其他说明重叠。
  3. 不改变 JS Core 数据、action/viewmodel 协议或规则逻辑。
- 处理策略：
  - Unity `AddText()` 默认纵向 overflow 从 `Overflow` 改为 `Truncate`。
  - 新增 `ClampTextBlock()`，统一给单段动态文案套行数和字符数限制。
  - 顶部阶段、最近事件、阶段目标、私聊状态、投票说明、行动表单说明与状态改为显式截断。
  - 保留已有 `ClampTextLines()` 的省略号策略，超出内容用 `…` 提示仍有剩余。
- 状态：已完成（Unity text overflow strategy pass）。

## CR-2026-05-08-17
- 请求人：用户
- 时间：2026-05-08
- 变更内容：
  1. 行动表单和剧本手册需要分页或滚动，避免选项被硬截断。
  2. 行动表单目标/身份选项不应只显示前 8 个后静默丢弃。
  3. 剧本手册角色列表不应只显示前 13 个角色。
- 处理策略：
  - 行动表单目标选项新增分页，每页 8 项，保留已选目标状态。
  - 行动表单身份选项新增分页，每页 8 项；fallback 身份来源改为完整剧本角色，不再只取前 12 个。
  - 剧本手册角色列表新增分页，每页 12 个角色，切页时自动选择当前页首个角色。
  - 增加统一 `PageCount()` / `ClampPage()` helper，避免页码越界。
- 状态：已完成（Unity action form + handbook pagination pass）。

## CR-2026-05-09-01
- 请求人：用户
- 时间：2026-05-09
- 变更内容：
  1. 做 Unity 版初步打包，让用户只启动 `unity-build` 里的 exe，不需要另开 JS Core bridge。
  2. Unity build 应随包携带 JS Core 脚本镜像，避免运行时强依赖 repo 根目录的 `scripts`。
  3. 本轮不做内嵌 Node runtime；机器仍需可执行 `node`。
- 处理策略：
  - 构建前把 JS Core 的 `.js`、`.mjs`、`.json` 文件同步到 `Assets/StreamingAssets/BotcJsCore/scripts`。
  - 同步最小 `package.json`，声明 `type: module`，保证镜像中的 `.js` 仍按 ESM 运行。
  - Unity 启动时优先从 `StreamingAssets/BotcJsCore/scripts/unity_action_bridge.mjs` 自动启动 bridge watcher。
  - Unity 退出时关闭自己启动的 bridge 进程；如果找不到 Node 或 bridge，UI 同步状态给出明确提示。
- 状态：已完成（Unity self-start bridge package pass）。

## CR-2026-05-09-02
- 请求人：用户
- 时间：2026-05-09
- 变更内容：
  1. Unity 初步包需要免环境启动，不再依赖目标机器 PATH 中已安装 `node`。
  2. Unity UI 继续靠近官方魔典体验，更多使用角色图标，尤其是图鉴、私聊声称身份和魔典身份标记。
  3. 保持 JS Core 作为规则和 AI 驱动，不改 action/viewmodel 协议。
- 处理策略：
  - Unity build 阶段查找当前构建机的 `node.exe`，复制到 `Assets/StreamingAssets/BotcJsRuntime/node.exe`，并随 Windows build 输出。
  - Unity standalone 启动时优先使用 `StreamingAssets/BotcJsRuntime/node.exe` 拉起 bridge，只有缺少内置 runtime 时才回退到 PATH 中的 `node`。
  - 新增统一角色 token 按钮组件，复用现有角色 PNG 和阵营色光环。
  - 剧本手册角色列表改为图标网格；行动表单中的身份选择改为图标 token；私聊声称身份新增可点击图标入口。
  - 新增官方魔典风格的角色选择器，用于私聊声称身份与选中玩家的魔典身份标记；清除/不声称也通过 token 入口表达。
- 状态：已完成（Unity bundled Node runtime + role icon picker pass）。

## CR-2026-05-09-03
- 请求人：用户
- 时间：2026-05-09
- 变更内容：
  1. 继续优化 Unity UI，强化魔典身份标记的可见性。
  2. 角色选择器需要更明确显示当前目标和当前选择。
  3. 私聊声称身份入口需要避免小图标被裁切。
- 处理策略：
  - 未揭示玩家如果有 `markedRoleId`，主魔典 token 上直接渲染小号角色徽章和“标”提示。
  - 角色选择器顶部状态改为显示目标玩家、当前标记/当前声称身份和作用范围。
  - 放大私聊声称身份 token 容器，避免小号角色 token 被面板边界压住。
  - 不改变 JS Core 规则、action/viewmodel 协议或真实身份可见性规则。
- 状态：已完成（Unity marked-role badge + picker context polish pass）。

## CR-2026-05-09-04
- 请求人：用户
- 时间：2026-05-09
- 变更内容：
  1. Unity 版需要胜负/终局反馈，不能只在事件日志里隐约出现胜负。
  2. 胜负结果必须由 JS Core 规则结算状态驱动，而不是 Unity 侧自行推断。
  3. 终局后应提供复盘、新局和继续查看魔典的入口。
- 处理策略：
  - 扩展 `unity_viewmodel`，新增顶层 `gameOver`、`winner`、`winnerReason` 和结构化 `outcome`。
  - `outcome` 包含阵营标签、标题、原因、存活/死亡计数和终局事件片段，供 Unity 直接渲染。
  - Unity 新增终局弹窗；对局结束后自动弹出，并支持 `查看复盘`、`新局`、`继续查看`。
  - 顶部 HUD 在终局状态显示胜利阵营，复盘抽屉也补入终局结果摘要。
  - 增加 Unity viewmodel 终局契约测试，防止 UI 看起来结束但胜负字段缺失。
- 状态：已完成（Unity endgame feedback pass）。

## CR-2026-05-09-05
- 请求人：用户
- 时间：2026-05-09
- 变更内容：
  1. 做 Unity/JS Core 夜晚行动完整性检查。
  2. 检查不应只看某一个角色能不能点，而要覆盖三套剧本中所有 JS Core 已定义的夜晚主动行动。
  3. 发现 Unity action form 数据截断、字段缺失或无法写入合法 plan 时应修复并加契约测试。
- 处理策略：
  - 新增 `tests/night_action_completeness_contracts.mjs`，枚举 TB/BMR/SnV 的夜晚主动行动规则。
  - 检查 `getHumanNightActionState`、Unity viewmodel `humanNightAction`、Unity `night-action` form 和 `setHumanNightActionPlan` 的完整链路。
  - 单独覆盖 BMR Lunatic 的“以认知恶魔身份行动”和 BMR Po 蓄力后的多目标模式。
  - 修复 `unity_viewmodel` 中 `actionForms[].options` / `roleOptions` 仍被截断到 8 项的问题，改为全量导出，由 Unity 分页显示。
  - 将 `test:night-actions` 纳入 `npm test`。
- 状态：已完成（night action completeness contract pass）。

## CR-2026-05-09-06
- 请求人：用户
- 时间：2026-05-09
- 变更内容：
  1. 做 Unity 阶段推进防呆，避免误点跳过关键流程。
  2. Unity 不应本地乐观修改阶段；阶段推进必须由 JS Core 校验后刷新。
  3. 防呆需要覆盖 Storyteller 队列、公聊前置、下一夜行动、无人处决入夜等高风险状态。
- 处理策略：
  - 新增 `scripts/unity_phase_guard.mjs`，集中生成 `phaseAdvance` 守卫状态。
  - `unity_viewmodel` 导出 `phaseAdvance`，Unity UI 消费 `blocked`、`requiresConfirm`、`targetStage`、`reason` 和 `hint`。
  - Unity `CyclePhase()` 改为只发送 phase action，不再直接改 `vm.phase` / `vm.dayStage`。
  - 点击提名前若尚未进入提名阶段，会先请求安全推进；进入提名后才结算选中 token 的提名。
  - `unity_action_bridge` 对 `phase` action 做同一套守卫校验；禁止 private -> nomination 跳跃。
  - 增加 Unity viewmodel 和 bridge 契约测试，覆盖阻断、警告和安全提名路径。
- 状态：已完成（Unity phase advance guard pass）。

## CR-2026-05-09-07
- 请求人：用户
- 时间：2026-05-09
- 变更内容：
  1. 补齐被动夜间/开局信息的数据链路，避免 Unity 看得到界面但缺少真实 JS Core 信息。
  2. 补齐死亡触发 Storyteller 队列验收，覆盖守鸦人、贤者、月之子、呆瓜、理发师。
  3. 继续保持 JS Core 为唯一规则来源，Unity 只消费 viewmodel 和 action bridge。
- 处理策略：
  - 新增 `tests/passive_info_storyteller_queue_contracts.mjs`，断言私人信息必须进入 `privateNotes`、`pendingHumanInfo`、typed `events.infoPings` 和 Unity `privateInfo`。
  - SnV 简化夜晚中，被动信息按夜序在恶魔击杀前发放，修复神谕者等角色可能先被杀而漏掉当夜信息的问题。
  - 排除 `onDeath` 信息角色的泛用被动线索，避免贤者活着时获得不属于其能力的随机夜间信息。
  - TB 间谍、BMR 祖母、BMR 侍女、SnV 贤者非主视角自动信息补 typed `infoPings`。
  - Unity viewmodel 的 `buildRoleAction` 和 `actionForms[]` 保留 Storyteller action `type`，UI 不再需要从 prompt 推断动作类型。
- 状态：已完成（passive info + death-trigger queue contract pass）。

## CR-2026-05-09-08
- 请求人：用户
- 时间：2026-05-09
- 变更内容：
  1. Unity demo smoke 需要覆盖真实 JS Core 产生的死亡触发 Storyteller 队列。
  2. 验收不能只依赖合成 pending action；需要证明真实规则状态能被 Unity bridge 看见并处理。
  3. 处理后必须验证队列清空、行动 id 写回、私人信息进入 Unity viewmodel。
- 处理策略：
  - 扩展 `scripts/unity_demo_acceptance.mjs`，在常规 TB demo smoke 后追加 SnV Sage 死亡触发 fixture。
  - fixture 通过 JS Core 夜晚流程真实生成 `sage-info` pending Storyteller action，再写入 Unity bridge state 文件。
  - 经 `storyteller-action` 处理后断言 `pendingStorytellerAction.available` 关闭、`pendingStorytellerActions` 清空、`privateInfo` 可见。
  - 本轮不改 Unity 视觉或核心规则，仅补齐 demo 验收边界。
- 状态：已完成（Unity demo Storyteller queue acceptance pass）。

## CR-2026-05-09-09
- 请求人：用户
- 时间：2026-05-09
- 变更内容：
  1. 在 CR-2026-05-09-08 的基础上，Unity demo smoke 不应只覆盖 `info` 型 Storyteller 队列。
  2. 需要覆盖真实规则产生的单目标和多目标 Storyteller action，防止 Unity bridge 只在“无需输入”的队列上看起来可用。
  3. 验收应证明 targetIds 能从 Unity action payload 进入 JS Core resolver，并正确清空队列/写入结果。
- 处理策略：
  - 增加真实 TB 守鸦人夜死 fixture，验证 `ravenkeeper-info` 单目标选择经 Unity bridge 写入私人信息。
  - 增加真实 SnV 理发师死亡 fixture，验证 `barber-swap` 双目标选择经 Unity bridge 交换角色。
  - 保持 Unity UI/C# 不变，本轮只补 demo smoke 覆盖范围。
- 状态：已完成（Unity demo target Storyteller queue acceptance pass）。
