# CHANGE REQUESTS

## CR-2026-05-15-01
- 请求人：用户
- 时间：2026-05-15
- 变更内容：
  1. 对 AI 发言润色做瀑布式开发，目标是让内置本地大模型的效果肉眼可见，而不是仅证明“模型被调用”。
  2. 提升 prompt 质量：从“改写已有模板句”升级为“根据结构化对话 act 生成玩家式短发言”。
  3. 增加近似照抄检测；当 LLM 输出与 deterministic 草稿过于相似时，自动二次重写或标记。
  4. 增加模型体量档位：保留轻量发行版，同时支持更高质量的 1.5B 模型发行包。
  5. 保持安全边界：LLM 只做人话表达，不参与规则、身份推理、投票、提名或隐藏信息访问。
- 处理策略：
  - 修改 `scripts/ai_llm_renderer.js` 的 prompt、校验和 near-copy retry。
  - 修改 `tools/prepare_local_llm.ps1` / `tools/package_unity_ai_release.ps1`，支持 tiny/balanced/quality 模型档。
  - 扩展 LLM renderer 契约测试，覆盖近似照抄二次重写、禁词、必需目标词和 provider 默认解析。
  - 更新本地 LLM 发行说明和验证记录。
- 状态：进行中（LLM renderer quality pass）。

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

## CR-2026-05-09-10
- 请求人：用户
- 时间：2026-05-09
- 变更内容：
  1. 做 Unity build 用户视角后的 UI 视觉收束，优先处理不需要改 JS Core 协议的可读性问题。
  2. 构建版默认启动应更稳定、更像可验收 demo，避免全屏默认状态导致自动验收/截图不稳定。
  3. 剧本手册作为高频大面板，需要减少拥挤、扩大角色图标网格、提升详情和夜晚顺序区域的阅读宽度。
- 处理策略：
  - Unity build 入口固定玩家窗口默认值：Windowed、1600x900、可调整窗口。
  - `tools/run_unity_demo.ps1` 启动 build 时默认带 windowed 参数，并保留 `-Fullscreen` 开关。
  - 剧本手册面板加宽，左侧角色图标由 3 列改为 4 列，右侧详情/夜序区域重新分配空间。
  - 不改变 `unity_viewmodel.json` 或 `unity_action.json` 协议，不改变 JS Core 规则。
- 状态：已完成（Unity visual consolidation pass）。

## CR-2026-05-10-01
- 请求人：用户
- 时间：2026-05-10
- 变更内容：
  1. 做 Unity 版 Storyteller 队列专用 UI，不再只用一段长文本摘要承载队列。
  2. 队列 UI 应清楚区分“队列列表”“当前待处理行动”“可选目标/输入预览”和“处理入口”。
  3. 本轮只增强 Unity 展示与 viewmodel 可读字段，不改变 JS Core 规则结算和 `storyteller-action` action 语义。
- 处理策略：
  - 保留既有 `storytellerQueue[]` 字符串字段，新增 `storytellerQueueDetails[]` 作为 Unity 专用队列卡片数据。
  - Unity Storyteller 面板改为居中大模态：左侧队列卡片，右侧当前行动详情，底部目标预览和处理按钮。
  - 当前行动仍通过已有动态行动表单或自动合法选择提交给 JS Core。
- 状态：已完成（Storyteller queue dedicated UI pass）。

## CR-2026-05-10-02
- 请求人：用户
- 时间：2026-05-10
- 变更内容：
  1. 美化 Unity 复杂行动表单，尤其是多目标、身份、模式、问题输入组合在同一表单中时的拥挤问题。
  2. 表单需要更像正式模态，不再像调试面板；玩家要能快速看出行动类型、要求、当前选择和可提交状态。
  3. 不改变 JS Core 行动规则、`actionForms[]` 数据来源或 action payload 语义。
- 处理策略：
  - 行动表单改为居中宽面板，顶部显示行动摘要，底部固定状态与提交按钮。
  - 目标选择改为卡片式按钮；身份选择继续使用角色 token；分页容量调整为 5 列 x 2 行。
  - 模式选择改为更宽的分段按钮，问题输入和信息型行动使用更明确的空/说明状态。
- 状态：已完成（complex action form visual pass）。

## CR-2026-05-10-03
- 请求人：用户
- 时间：2026-05-10
- 变更内容：
  1. 修复 Unity 投票仪式在 13-15 人局中只显示前 12 个 voter token 的问题。
  2. 保持 JS Core 投票结果为唯一数据源，Unity 只负责完整渲染 `voteCeremony.voters[]`。
  3. 补 demo 验收，防止以后出现 JS Core 已导出 15 人但 Unity smoke 没覆盖的回归。
- 处理策略：
  - `RenderVoteTokenCeremony()` 视觉上限从 12 扩到 15。
  - 对 13-15 人投票启用更紧凑的 token、椭圆半径和姓名标签尺寸。
  - `scripts/unity_demo_acceptance.mjs` 增加 15 人 TB 投票夹具，断言 Unity viewmodel 导出 15 名 voter。
- 状态：已完成（15-player vote ceremony acceptance pass）。

## CR-2026-05-10-04
- 请求人：用户
- 时间：2026-05-10
- 变更内容：
  1. Unity UI 方向继续推进，先补关键 UI 状态的截图 smoke。
  2. 覆盖主魔典、私聊面板、复杂行动表单、Storyteller 队列、剧本手册、投票仪式和角色选择器。
  3. 脚本应复用 JS Core / Unity viewmodel 数据，不用鼠标坐标模拟点击，降低验收脆弱性。
- 处理策略：
  - Unity 增加命令行专用 `-botc-ui-smoke` 入口，启动时直接打开指定面板。
  - Unity 增加 `-botc-no-bridge` 入口，截图 smoke 时不自启动 watcher，避免截图期间状态被额外进程刷新。
  - 新增 JS fixture 生成脚本，为不同 UI 状态写入对应 `unity_state.json` / `unity_viewmodel.json`。
  - 新增 PowerShell 截图脚本，逐个启动 Unity build 并捕获窗口 PNG 到 `output/unity-ui-smoke-*`。
  - 截图改为 Unity 内部 `Texture2D.ReadPixels` 输出，避免 Windows DirectX 窗口外部截图出现黑屏。
  - 首轮 smoke 暴露并修复两个 UI 问题：Storyteller 队列被终局弹窗遮挡、复杂行动表单目标/身份区挤压。
- 状态：已完成（UI screenshot smoke pass）。

## CR-2026-05-10-05
- 请求人：用户
- 时间：2026-05-10
- 变更内容：
  1. Unity UI 以 1920x1080 全屏作为正式 demo/build 的主验收基线。
  2. 直接运行 Unity build exe 或 `npm run unity:demo` 时默认进入全屏；窗口化只作为调试和截图复现模式。
  3. 顶栏、底部动作区、私聊面板、复杂行动表单、Storyteller 队列、剧本手册、投票仪式和角色选择器需要按全屏空间重新排布，减少拥挤与截断。
  4. 本轮只处理 Unity 表现层、启动参数和文档，不改变 JS Core 规则、AI 或 action/viewmodel 协议。
- 处理策略：
  - Unity 构建入口设置 `FullScreenWindow`、1920x1080 默认尺寸。
  - `tools/run_unity_demo.ps1` 默认传入 fullscreen 参数，新增 `-Windowed` 作为开发调试路径。
  - `tools/capture_unity_ui_smoke.ps1` 默认截图基线改为 1920x1080，并保留可选 fullscreen 截图开关。
  - Unity C# 运行时 UI 使用现有 Canvas 1920x1080 reference resolution，放大主要模态面板和底部 dock。
  - 私聊延续“底部对话框 + 左侧 token 卡 + 右侧对话/compose”的方向；手册、行动表单和角色选择器继续使用角色 token 网格。
- 状态：已完成（Unity fullscreen-first UI pass）。

## CR-2026-05-10-06
- 请求人：用户
- 时间：2026-05-10
- 变更内容：
  1. 优化 AI agent 的私聊/公聊/提名理由，让发言基于自己可见的 evidence/trail，而不是泛模板。
  2. 私聊证据不得泄漏给未参与 AI；公聊不得直接引用私聊原文。
  3. 好人视角不得因对话理由看到恶魔 bluff、邪恶互认或隐藏身份。
  4. 醉酒/中毒夜间信息与玩家私聊声称需要更高污染风险、更低引用可信度。
- 处理策略：
  - 新增 dialogue evidence helper，统一生成可放进 AI 发言的安全短理由。
  - `composePrivateResponse`、`composePublicLine`、`chooseAINomination` 复用同一证据摘要路径。
  - `recordPrivateInfoForAgent` 与玩家私聊夜间信息声称写入 contamination metadata。
  - 增加 AI 契约测试与本轮设计审计文档。
- 状态：已完成（AI evidence-driven dialogue contracts pass）。

## CR-2026-05-10-07
- 请求人：用户
- 时间：2026-05-10
- 变更内容：
  1. 做一轮 AI “模拟人类说话”优化，让私聊/公聊更像玩家临场推理，而不是规则摘要或模板公告。
  2. 本轮只处理最终发言层的表达节奏，不改变 AI 怀疑度、规则结算、证据可见性或 Unity UI。
  3. 人类化表达必须保留上一轮证据驱动和隐藏信息边界：不能为了口语化编造证据，也不能泄漏私聊/恶魔信息。
- 处理策略：
  - 在 `scripts/ai.js` 增加最终发言 cadence polish：去重开场白、加入少量修正/承接语、按 persona 调整口吻。
  - 私聊回答在保留 evidence summary 的同时加入“我换个说法/说白了”等临场解释痕迹。
  - 公聊在第二轮或更强压力发言中加入“我的意思是/换句话说”等桌面承接语，减少纯模板感。
  - 增加契约测试，确保口语化不破坏证据引用和私聊泄漏防线。
- 状态：已完成（AI human speech cadence pass）。

## CR-2026-05-10-08
- 请求人：用户
- 时间：2026-05-10
- 变更内容：
  1. 增加 AI 对话记忆一致性账本，覆盖玩家私聊、公聊和 AI-AI 私聊。
  2. AI 连续被追问时应承接上一轮口径；如果切换关注目标，需要解释为什么换线。
  3. 记忆账本只能存结构化摘要，不能把私聊原文提升到公聊可见记忆。
  4. `getAIInsightRows(...)` 不应污染 statement memory。
- 处理策略：
  - `state.aiDialogue.statementMemory` 拆分 public-by-speaker 和 private-by-pair 两类。
  - 发言生成后统一写入 focus、stance、claim、vote stance、evidence summary 等摘要。
  - 发言展示前读取对应作用域记忆，补充“刚才那条线/我换目标是因为”等承接语。
  - 增加 AI 契约测试验证连续追问、显式改口、AI-AI 作用域、身份口径和 insight 不污染。
- 状态：已完成（AI statement memory consistency pass）。

## CR-2026-05-10-09
- 请求人：用户
- 时间：2026-05-10
- 变更内容：
  1. 继续优化 AI agent，让“当天公开说过的话”不只影响下一句表达，也能约束后续投票和提名决策。
  2. AI 如果公开把某名玩家放进主线，后续投票/提名应更愿意延续该公开口径，而不是像没有记忆一样随机换线。
  3. 私聊记忆仍不得直接升级为公开行动理由；公开提名/投票只能使用公开 statement memory 和安全 evidence summary。
- 处理策略：
  - 新增公开 statement memory 读取 helper，按当天、speaker、focusId 匹配。
  - `decideAIVote(...)` 在目标命中公开怀疑/施压口径时小幅降低投票阈值。
  - `chooseAINomination(...)` 将公开记忆目标纳入候选，并在低证据压力提名时生成“延续公开口径”的理由。
  - 排序时优先保留 statement-memory-driven proposal，避免 fallback 压过 AI 自己刚公开讲过的主线。
  - 增加 AI 契约测试覆盖公开口径降低投票阈值、公开口径驱动提名 proposal。
- 状态：已完成（AI statement memory strategy consistency pass）。

## CR-2026-05-10-10
- 请求人：用户
- 时间：2026-05-10
- 变更内容：
  1. 新增 AI `agentView` 层，先覆盖私聊、公聊和提名，不做全仓替换。
  2. 对话和公开提名理由优先通过 viewer-scoped evidence/trail 读取，不让生成函数直接到处读裸 `state`。
  3. Good AI 的 view 不应包含恶魔伪装、邪恶队伍列表、隐藏身份或目标真实阵营。
- 处理策略：
  - 在 `scripts/ai_agents.js` 新增 `buildAgentView(...)`，导出自我认知、可见声明/发言/流程、目标公开视图和 evidence/trail accessor。
  - `collectEvidence(...)` 支持接收 `agentView`，并从 view 读取 summaries、visible claims、visible speeches 和 evidence count。
  - 玩家私聊、公聊和提名 proposal 路径传入 `agentView`；旧函数签名保留兼容。
  - 增加 AI 契约测试覆盖 good view 隐藏真实信息、demon private view 合法携带邪恶知识、public/private evidence 边界。
  - 更新 `AI_AGENT_AUDIT.md`，标注 agentView 已落地与剩余迁移点。
- 状态：已完成（AI agentView first pass）。

## CR-2026-05-10-11
- 请求人：用户
- 时间：2026-05-10
- 变更内容：
  1. 将“私聊/公聊/提名必须引用 evidence/trail”收束为统一 contract，而不是每个函数各自拼 fallback 文案。
  2. 有 evidence 时，最终文本必须引用 1-2 条 viewer 可见 summary。
  3. 没有 evidence 时，最终文本必须明确标记为低证据/压力判断，不能伪装成硬证据。
- 处理策略：
  - 在 `scripts/ai.js` 新增 `buildDialogueEvidenceContract(...)`，统一产出 `summaries`、`text`、`hasEvidence`、`lowEvidence` 和 `publicOnly`。
  - 新增 `ensureEvidenceContractInText(...)`，在模板和人格话术之后强制把 evidence summary 或低证据 fallback 写入最终文本。
  - 私聊回答、公聊发言和提名 proposal 均接入该 contract。
  - 私聊返回值、公聊 speech event、提名 proposal 均暴露 `evidenceContract`，便于契约测试和后续复盘。
  - 增加 AI 契约测试覆盖私聊、公聊、提名三条路径。
- 状态：已完成（AI unified evidence citation contract pass）。

## CR-2026-05-10-12
- 请求人：用户
- 时间：2026-05-10
- 变更内容：
  1. 增加动态 `sourceTrust`，让 AI 根据“谁说谎、谁被验证、谁投票异常”调整来源可信度。
  2. 增强策略型人格，让不同 AI 不只是话术不同，也在投票、提名和目标排序上有不同倾向。
- 处理策略：
  - `aiAgents` 增加 `sourceTrustByPlayerId` 和 `trustEvents[]`。
  - evidence 创建和手动 evidence 写入时融合来源类别 trust 与 per-player trust。
  - 公开 claim 被死亡/处决身份验证后，写入 `verified-claim` 或 `false-claim` trust event。
  - 投票通过时反向投票、低可信投票等写入 `abnormal-vote` / `validated-vote` trust event。
  - 更新 trust 后同步刷新该来源已有 evidence 的 `sourceTrust`。
  - 新增 `personaStrategyProfile(...)`：pressure 更早压人，steady 更重证据，shadow 更重票型/改口/异常模式。
  - 目标排序、投票阈值、提名阈值接入策略人格；公开 statement memory 作为公开承诺证据参与调分。
  - 增加 AI 契约测试覆盖 false claim、verified claim、abnormal vote 和 persona vote behavior。
- 状态：已完成（AI dynamic sourceTrust + strategy persona pass）。

## CR-2026-05-11-01
- 请求人：用户
- 时间：2026-05-11
- 变更内容：
  1. 评估局内知识图谱对 AI 反应时间的影响。
  2. 先实现轻量结构，不引入图数据库，不改变现有 AI 决策主路径。
  3. 图谱必须保持 per-agent 可见性边界，私聊关系不能进入第三方 AI 图谱。
- 处理策略：
  - 在每个 AI agent 上新增 `knowledgeGraph: { version, nodes, edges }`。
  - 图谱只在 `pushEvidence(...)` 写入 evidence 时增量追加节点/边，不在每次发言时全图搜索。
  - 节点限制为 420、边限制为 680，避免长局无限增长。
  - 初始支持 `player` / `role` / `evidence` 节点。
  - 初始支持 `claimed_role`、`whispered_to`、`nominated`、`voted_yes_on`、`voted_no_on`、`revealed_as`、`night_info_about` 等边。
  - `buildAgentView(...)` 暴露 `graphForTarget(...)` 供后续解释/复盘使用。
  - 增加 AI 契约测试覆盖 claim+reveal、私聊 participant scope、vote edges 和图谱大小上限。
- 状态：已完成（AI lightweight per-agent knowledge graph pass）。

## CR-2026-05-11-02
- 请求人：用户
- 时间：2026-05-11
- 变更内容：
  1. 将轻量知识图谱更深地用于 AI agent 决策，而不只是用于复盘/解释。
  2. KG 应影响怀疑、提名等选择，但不能变成全知最优解，避免好人阵营稳定碾压。
  3. 保持局内趣味性：AI 可以被污染信息、弱证据、人设策略和公开压力影响。
- 处理策略：
  - 新增 `computeGraphPressureForTarget(...)`，从单个 agent 的可见 KG 中抽取目标相关压力。
  - 将 claim/reveal 矛盾、验证声明、投票异常、提名记录和夜间信息转成小幅 `scoreDelta`。
  - 在 `personaAdjustedTargetScore(...)` 中加入 KG 压力，使其影响目标排序与提名焦点。
  - 在 `buildDialogueEvidenceContract(...)` 中加入 KG 安全理由，使 AI 解释能引用关系证据。
  - 对 public dialogue / nomination 使用 `publicOnly` 图谱压力，防止私聊原文升级为公开理由。
  - 对污染夜间信息降低权重并标记 `night-info-risk`，避免 AI 把可能错误的信息当硬证据。
  - 将 KG 决策压力限制在小幅区间，保留 persona、statement memory、sourceTrust、怀疑度和流程约束的作用。
- 状态：已完成（AI knowledge graph decision pressure pass）。

## CR-2026-05-11-03
- 请求人：用户
- 时间：2026-05-11
- 变更内容：
  1. 继续深化 KG 在 AI agent 决策中的应用。
  2. 动态 `sourceTrust` 变化应同步影响 KG，而不是让图谱边保留旧可信度。
  3. AI 应能把“某人作为信息来源可靠/不可靠”作为弱关系证据，但不能把它当作硬身份结论。
- 处理策略：
  - 在 `updateAgentSourceTrustForPlayer(...)` 后刷新该来源玩家关联的 KG 边 `trust`。
  - `source_of`、`claimed_role` 等同源 evidence 边会随 evidenceBook 的 `sourceTrust` 一起更新。
  - `computeGraphPressureForTarget(...)` 增加来源可信度信号：
    - 平均 source trust 偏低时，对目标增加小幅压力。
    - 平均 source trust 偏高时，对目标提供小幅保护。
  - 该信号仍走 public/private visibility 过滤，公开发言不会使用私聊来源细节。
  - 增加 AI 契约测试覆盖 sourceTrust 更新后 KG 边权同步。
- 状态：已完成（AI KG sourceTrust propagation pass）。

## CR-2026-05-11-04
- 请求人：用户
- 时间：2026-05-11
- 变更内容：
  1. 继续深入 KG 决策应用，让 AI 能识别局内公开关系结构，而不只看单条证据。
  2. 优先实现 BOTC 玩家常用的“撞身份”推理模式。
  3. 保持趣味性：不同人格对同一 KG 模式的反应应有差异。
- 处理策略：
  - `computeGraphPressureForTarget(...)` 增加 role-claim conflict motif。
  - 当 viewer 可见图谱中多名玩家声称同一角色时，对相关目标增加小幅压力。
  - 该判断只使用可见 `claimed_role` 边，不读取真实身份或阵营。
  - `personaStrategyProfile(...)` 增加 `graphPressureWeight`：
    - pressure persona 更愿意用 KG 推进节奏。
    - shadow persona 更重视关系模式。
    - steady persona 将 KG 作为较弱的辅助上下文。
  - 增加契约测试覆盖撞身份进入私聊 evidence contract。
- 状态：已完成（AI KG relation motif + persona weighting pass）。

## CR-2026-05-11-05
- 请求人：用户
- 时间：2026-05-11
- 变更内容：
  1. 继续深入 KG 决策应用，让 AI 识别公开发言里的站队关系。
  2. 将“谁公开压谁 / 谁公开保谁”作为轻量图谱边，服务后续解释和决策。
  3. 保持非全知：只基于 viewer 可见公聊和 viewer 当前怀疑压力判断站队是否异常。
- 处理策略：
  - `public-speech` evidence 根据 `polarity` 写入 `public_accused` / `public_defended` KG 边。
  - AI 公聊记录时将高压发言标记为 `accuse` polarity。
  - `computeGraphPressureForTarget(...)` 增加社交站队 motif：
    - 公开维护当前高压目标时，对 speaker 增加小幅压力。
    - 公开攻击当前低压目标时，对 speaker 增加小幅压力。
    - 与当前压力一致的公开站队给予轻微保护。
  - 该逻辑读取的是当前 AI 自己的 suspicion，不读取真实身份/阵营。
  - 增加契约测试覆盖“公开维护高压目标”进入 KG 边和私聊 evidence reason。
- 状态：已完成（AI KG public stance edge pass）。

## CR-2026-05-11-06
- 请求人：用户
- 时间：2026-05-11
- 变更内容：
  1. 实现 KG chain extractor，让 AI 不只引用单条 evidence，而是能说出短链式解释。
  2. 实现邪恶方基于 KG 的嫁祸倾向，但不引入全知最优解。
  3. 实现 KG-driven 追问，让私聊回答能给出下一步应问什么。
- 处理策略：
  - 新增 `extractGraphReasonChains(...)`，从 per-agent KG 中提取 top-K 短链。
  - 当前支持 false claim、verified claim、role conflict、公聊维护高压位、公聊推动低证据位、night-info risk、low source trust 等链。
  - `buildDialogueEvidenceContract(...)` 优先纳入 KG chains，再合并 graph pressure reason 和普通 evidence summary。
  - 新增 `buildGraphFollowUpPrompts(...)`，将 KG chain 转换为私聊追问建议。
  - `runPrivateWhisper(...)` 返回 `followUpPrompts`，私聊理由/计划类回复会自然补一句“下一句我会这样追”。
  - 邪恶 AI 在 `personaAdjustedTargetScore(...)` 中获得小幅 public KG chain framing bonus，且仍过滤 known evil allies。
  - `buildNominationProposal(...)` 对邪恶方 KG 嫁祸 proposal 标记 `framing: true`。
  - 增加契约测试覆盖 false claim chain、KG-driven follow-up、evil framing nomination。
- 状态：已完成（AI KG chain extractor + evil framing + follow-up pass）。

## CR-2026-05-11-07
- 请求人：用户
- 时间：2026-05-11
- 变更内容：
  1. 实现 AI 说话自然化小闭环，让不同 persona 对同一推理结果有不同表达。
  2. 使用轻量本地语料库，不引入在线 LLM 或大型运行时依赖。
  3. 降低“证据线 / 口径 / 复核”等 stock phrase 在日志和私聊中的重复感。
- 处理策略：
  - 扩展 `scripts/ai_speech_corpus.json`，新增 `private.dialogueActs`。
  - 新增 `renderDialogueActs(...)`，将结构化 act（reason / plan / generic / vote）按 persona 渲染成人话。
  - 私聊 `composePrivateResponse(...)` 的 reason / plan / generic / vote 路径接入 dialogue act renderer。
  - 新增 `speechStyleMemory`，记录每个 AI 最近表达。
  - `applyHumanSpeechCadence(...)` 增加 phrase cooldown，将高频 stock phrase 替换为轻量同义表达。
  - 增加契约测试覆盖 persona 输出差异和 phrase cooldown。
- 状态：已完成（AI lightweight speech corpus rendering pass）。

## CR-2026-05-11-08
- 请求人：用户
- 时间：2026-05-11
- 变更内容：
  1. 继续深化 AI 说话自然化，让公聊和提名也使用结构化 act 渲染。
  2. 同一 public evidence contract 下，不同 persona 应稳定呈现不同公聊风格。
  3. 提名理由要更像玩家上台发言，避免把 `自动提名` / `压力提名` 等内部标签直接说给玩家听。
- 处理策略：
  - 扩展 `scripts/ai_speech_corpus.json`，新增 `public.dialogueActs`。
  - `renderDialogueActs(...)` 支持 `audience` 参数，复用同一轻量表达层渲染 private/public act。
  - `composePublicLine(...)` 强制使用 public dialogue act 作为主体发言，再叠加 debate beat 和 evidence contract。
  - `buildNominationProposal(...)` 使用 public `nomination` act 渲染提名理由，并继续通过 `ensureEvidenceContractInText(...)` 保证证据文本可追踪。
  - 增加契约测试覆盖 pressure/shadow 公聊风格差异。
- 状态：已完成（AI public/nomination dialogue act rendering pass）。

## CR-2026-05-11-09
- 请求人：用户
- 时间：2026-05-11
- 变更内容：
  1. 继续扩展 AI 表达闭环，加入 speechBudget、玩家式短摘要、被质询回应 act。
  2. 降低 Unity 日志和资料抽屉里的长段落压力，同时保留完整 evidence contract 供测试和复盘使用。
  3. 公聊 defense/被质询语境应更像在回应桌上质疑，而不是继续念同一套压力模板。
- 处理策略：
  - `buildDialogueEvidenceContract(...)` 新增 `spokenText`，将完整 evidence summary 压缩成玩家式短摘要。
  - 新增 `playerStyleEvidenceSummary(...)`，把常见证据链转成“身份撞车 / 身份对不上 / 票型反着走 / 夜信可能脏 / 在保高压位”等短说法。
  - 新增 `applySpeechBudget(...)`，按 audience 控制句数和字符数，并保留 `短线` / `弱证据说明` 句。
  - `applyHumanSpeechCadence(...)` 接入 speechBudget。
  - 扩展 `public.dialogueActs`，新增 `challengeResponse`。
  - `composePublicLine(...)` 在 debate beat 为 `defense` 时使用 challenge-response act。
  - 提名和公聊优先使用 `spokenText`，但 `evidenceContract.text` 仍保留完整证据。
  - 增加契约测试覆盖 speechBudget、玩家式短摘要、challenge-response act。
- 状态：已完成（AI speech budget + spoken evidence + challenge response pass）。

## CR-2026-05-11-10
- 请求人：用户
- 时间：2026-05-11
- 变更内容：
  1. 做“语境化表达”，让 AI 的措辞跟当前桌面语境绑定，而不是只靠 persona 改词。
  2. 公聊中的提名压力、投票意向、被质询回应应分别使用不同表达 act。
  3. 已死亡 AI 的私聊回复应带死亡/遗言语境，但不破坏 evidence contract。
- 处理策略：
  - 扩展 `scripts/ai_speech_corpus.json`：
    - `public.dialogueActs.*.nominationPressure`
    - `public.dialogueActs.*.voteIntent`
    - `private.dialogueActs.*.deadPrivate`
  - 新增 `publicDialogueActForContext(...)`，根据 debate beat 映射 public act。
  - `composePublicLine(...)` 使用 `publicDialogueActForContext(...)`，让 `nomination-pressure` 与 `vote-intent` 不再落回普通 pressure/probe 文案。
  - `composePrivateResponse(...)` 在死亡 AI 的 reason/plan/generic/suspect 回复中补一条死亡语境表达，并继续通过 unified evidence contract 引用安全证据。
  - Unity StreamingAssets 内置 JS Core 已同步 `ai.js` 与 `ai_speech_corpus.json`。
  - 增加契约测试覆盖死亡私聊语境、公聊提名压力语境、公聊投票意向语境。
- 状态：已完成（AI contextual expression pass）。

## CR-2026-05-11-11
- 请求人：用户
- 时间：2026-05-11
- 变更内容：
  1. 增加邪恶方表演语料，让邪恶 AI 对外发言更像普通玩家在盘证据。
  2. 邪恶同队私聊仍可同步真实队伍和 bluff 信息，但对好人私聊、公聊、提名不得泄漏内部词。
  3. 继续沿用本地轻量语料库，不引入在线 LLM 或额外运行时。
- 处理策略：
  - 扩展 `scripts/ai_speech_corpus.json`：
    - `public.evilPerformance.*`：覆盖 pressure / probe / challengeResponse / nominationPressure / voteIntent / nomination。
    - `private.evilPerformance.*`：覆盖 reason / plan / generic / vote / deadPrivate / claimCover / claimCoverPressured。
  - `renderDialogueActs(...)` 在 speaker 具备 evil perspective 且 audience 为 public/private 时，优先读取 `evilPerformance`，缺省再回落到普通 `dialogueActs`。
  - `composePrivateClaimPolicy(...)` 的邪恶对外身份回复改为走 `private.evilPerformance.*.claimCover`，避免固定模板反复出现。
  - 保持 `private.evilAlliance.*` 只用于已知同队私聊，继续允许真实队伍/伪装同步。
  - Unity StreamingAssets 内置 JS Core 已同步 `ai.js` 与 `ai_speech_corpus.json`。
  - 增加契约测试覆盖邪恶对好人私聊 claim、公聊发言、提名理由均使用表演语料且不泄漏邪恶内部词。
- 状态：已完成（AI evil performance corpus pass）。

## CR-2026-05-11-12
- 请求人：用户
- 时间：2026-05-11
- 变更内容：
  1. 做更真实的记忆延续，让 AI 不只是机械插入“刚才那条线”。
  2. AI 连续盯同一目标时，应能承接上一轮理由。
  3. AI 切换目标时，应解释旧目标是暂放还是新问题显式要求，而不是像无记忆一样突然换人。
- 处理策略：
  - 扩展 `state.aiDialogue.statementMemory`：
    - 新增 `recentTurns`，保留最近几轮结构化发言摘要。
    - 新增 `consecutiveFocusCount`，记录连续围绕同一目标的次数。
    - 新增 `previousEvidenceSummary` / `previousStance`，用于下一轮承接。
  - `continuityLineForPrivateStatement(...)`：
    - 同目标追问时引用上一轮 evidence summary。
    - 多次同目标时表达为“连续盯这个位置”，更像真人坚持主线。
    - 显式换目标时说明“前面那条暂放/不是作废”。
  - `continuityLineForPublicStatement(...)`：
    - 第二轮以后公聊承接上一轮公开口径和卡点。
    - 公开换目标时说明是压力转移，不是洗掉前一轮。
  - 连续承接后重新套 speech budget，避免 Unity 日志/资料抽屉出现过长文本。
  - Unity StreamingAssets 内置 JS Core 已同步 `ai.js`。
  - 增加契约测试覆盖私聊 recentTurns、连续 focus 计数、显式换目标承认旧线、公聊第二轮承接上一轮卡点。
- 状态：已完成（AI richer statement memory continuity pass）。

## CR-2026-05-11-13
- 请求人：用户
- 时间：2026-05-11
- 变更内容：
  1. 做“问答风格”，让玩家私聊提问后，AI 先直接回答问题，再展开理由。
  2. 理由、计划、投票类回答应补一个可继续追问的具体问题。
  3. 不改变规则、怀疑度、KG 或 evidence contract，只调整表达组织方式。
- 处理策略：
  - 新增 `directAnswerForPrivateQuestion(...)`：
    - 根据 `QUESTION_INTENT` 生成 `短答：...` 开头。
    - 覆盖 reason / trust / claim / vote / night / compare / plan / generic。
  - 新增 `followUpQuestionForPrivateAnswer(...)`：
    - reason/suspect/generic 回答后补“我会反问一句...”。
    - plan 回答后补下一问。
    - vote 回答后补票前检查问题。
  - `composePrivateResponse(...)` 先插入短答，再沿用现有 persona dialogue act、evidence contract、statement memory 和 speech budget。
  - Unity StreamingAssets 内置 JS Core 已同步 `ai.js`。
  - 增加契约测试覆盖私聊 reason 和 vote 的问答形态。
- 状态：已完成（AI private Q&A style pass）。

## CR-2026-05-11-14
- 请求人：用户
- 时间：2026-05-11
- 变更内容：
  1. 深度做一轮局内语用层，让 AI 根据局内压力改变说话方式。
  2. 支持死亡、被提名上台、高压目标、低证据、提名阶段、后期天数等局内语境。
  3. 不改变规则、怀疑度、KG、agentView 或 evidence contract，只改变表达 framing。
- 处理策略：
  - 新增 `pragmaticPressureContext(...)`：
    - 汇总 `alive`、`beenNominatedToday`、`nominatedToday`、`dayStage`、`day`、`focusScore`、`lowEvidence`、`selfHeat`。
  - 新增 `pragmaticLineForSpeech(...)`：
    - 死亡：声明“当遗言线索听”。
    - 被提名：进入防御式票前回应。
    - 自身压力高：先说明会给可复核逻辑。
    - 提名阶段/后期：压缩成可执行版本。
    - 目标高压：语气更急，要求马上听回应。
    - 低证据：明确“当追问入口，不当定罪”。
  - 新增 `applyInGamePragmatics(...)`，在私聊和公聊主体文本生成后、speech budget 与 evidence-contract enforcement 前插入语用 framing。
  - Unity StreamingAssets 内置 JS Core 已同步 `ai.js`。
  - 增加契约测试覆盖高压私聊目标和被提名公聊 speaker 的语用变化。
- 状态：已完成（AI in-game pragmatics pass）。

## CR-2026-05-11-15
- 请求人：用户
- 时间：2026-05-11
- 变更内容：
  1. 修复 AI 聊天仍不像人的问题，重点处理模板味、调试摘要味和不自然括号标签。
  2. 消除截图中出现的“这题我分两层看”“核心还是 我私下听到的口径...”“5号（暂时偏清白）”等表达。
  3. 保留 evidence contract，不因为口语化清洗破坏证据引用。
- 处理策略：
  - `scripts/ai_speech_corpus.json`：
    - 将 steady 私聊 opener “这题我分两层看” 改为“我直说吧”。
    - 将“问出反应比一句结论更值钱”改为“问一句看反应更有用”。
  - `scripts/ai_agents.js`：
    - 私聊 evidence 摘要从“我私下听到的口径把焦点指向 X 号”改为“有人私下提到 X 号”。
  - `scripts/ai.js`：
    - `formatFocus(..., false)` 改为只输出玩家名，避免聊天中出现“5号（暂时偏清白）”。
    - `ensureEvidenceContractInText(...)` 标签从 `短线` / `弱证据说明` 改为 `我现在抓的点` / `这条还弱`。
    - 新增 `polishConversationalText(...)`，在 cadence/speech budget 前清洗模板化短语。
  - Unity StreamingAssets 内置 JS Core 已同步 `ai.js`、`ai_agents.js` 和 `ai_speech_corpus.json`。
  - 增加契约测试覆盖 conversational polish，不允许这些调试味短语回流。
- 状态：已完成（AI conversational polish pass）。

## CR-2026-05-11-16
- 请求人：用户
- 时间：2026-05-11
- 变更内容：
  1. 建立 AI 对话自测闭环，让开发时可以离线产出多类 AI 对话样本。
  2. 自动标记“不像人”的坏味道，例如报告腔、工程词、过长发言、私聊泄漏风险和评分标签。
  3. 根据首轮 smoke 结果，先修一波高频表达问题。
- 处理策略：
  - 新增 `scripts/ai_dialogue_smoke.mjs`：
    - 固定生成 TB 局面，覆盖连续私聊、换焦点追问、公聊两轮、AI-AI 私聊、邪恶方表演和提名理由。
    - 输出 `output/ai_dialogue_smoke/latest.md` 与 `latest.json`。
    - 支持 `--strict`，后续可以用于 CI 或本地强制检查。
  - 新增 npm 命令 `npm run ai:dialogue-smoke`。
  - 首轮报告从 31 个 warning 收束到 8 个 warning：
    - 缩短普通私聊/公聊 speech budget。
    - 将“可信度有限/污染”类证据后缀改成更像玩家说法的“先复核/这条先打折听”。
    - 将“短答：...”改成“先给结论/先说你这边/如果提...”等更自然的问答开头。
    - 修复 AI-AI smoke 报告里的 seat 字段显示为 `undefined号`。
  - 继续二次收束到 0 个 warning：
    - 面向玩家的提名理由不再输出“压力提名 / 自动提名 / 怀疑度 / 行动线”，改成“先提上台 / 正面回应 / 看站票”。
    - smoke 审计区分合法邪恶 AI-AI 私聊，不把参与双方可见的队伍信息误报为玩家可见泄漏。
    - 私聊 cadence 从“我换个说法”压成“换个说法”，减少第一人称堆叠。
  - Unity StreamingAssets 内置 JS Core 已同步 `ai.js` 和 `ai_agents.js`。
- 状态：已完成（AI dialogue smoke harness + self-correction pass to zero warnings）。

## CR-2026-05-12-01
- 请求人：用户
- 时间：2026-05-12
- 变更内容：
  1. 实现“结构化 act -> 人话渲染器”，先覆盖私聊怀疑、夜信、追问和提名样本文案。
  2. 修复 `latest` 中出现的病句：“你能把 让他把身份和信息讲完整 讲清楚吗？”。
  3. 不接在线 LLM，不改变规则结算、怀疑度、agentView 或 Unity UI。
- 处理策略：
  - 新增私聊 surface act 渲染链：
    - `buildPrivateSurfaceAct(...)` 将 focus、evidence、persona、intent、statement memory 压成结构化 act。
    - `renderPrivateSurfaceAct(...)` 用完整句式渲染连续怀疑、明确换焦点、夜间信息、投票态度和追问。
    - `surfaceFollowUpForAct(...)` 直接生成“7号，你身份和信息能连起来说吗？”这类完整追问，不再嵌套内部指令。
  - `normalizeSurfaceEvidence(...)` 把证据摘要转成更像玩家的话：
    - “我自己的夜间信息牵到 X 号” -> “夜里那条信息让我先看 X 号”。
    - “该玩家的行为与我掌握的信息不一致” -> “这条行为和我手里的信息对不上”。
  - `humanizeSharedPrivateNote(...)` 清理 AI-AI 私聊中的原始夜间日志，避免 `信息链是：[第1夜]...` 直接出现在对白中。
  - 扩展 `ai_dialogue_smoke` 坏味道规则：
    - `nested-prompt`：禁止“你能把 让他...”/原始日志嵌入。
    - `abstract-subject`：禁止“该玩家/当前目标”式系统摘要。
    - `empty-transition`：禁止“简单讲，我现在是这么看”等空转过渡句。
  - 契约测试调整为接受 surface-rendered 的自然承接语，例如“我暂时不换目标”“那条暂放一边”。
  - Unity StreamingAssets 内置 JS Core 已同步 `ai.js` 和 `ai_agents.js`。
- 当前效果：
  - `npm run ai:dialogue-smoke` 通过，20 条样本 0 warning。
  - 私聊中已不再出现用户指出的嵌套追问病句。
  - 仍观察到公聊样本里存在 `你 我先...` 这类公开发言拼接问题，下一轮应把 public discussion 也迁移到 surface renderer。
- 状态：已完成（private structured surface renderer first pass）。

## CR-2026-05-12-02
- 请求人：用户
- 时间：2026-05-12
- 变更内容：
  1. 继续完善结构化 act -> 人话渲染器，覆盖公聊 pressure / defense / nomination-pressure / vote-intent。
  2. 修复公聊样本中出现的“你 我先...”“你 可以进提名池”等目标代词拼接问题。
  3. 保持离线本地生成，不接在线 LLM，不改 Unity UI 或规则结算。
- 处理策略：
  - 新增公聊 surface 渲染路径：
    - `buildPublicSurfaceAct(...)` 读取公开 focus、evidence contract、debateBeat、persona、阵营表演状态。
    - `renderPublicSurfaceActReadable(...)` 将公聊意图渲染为短句，例如“我先压 7号”“7号 可以进提名池，但我先听一句回应”。
    - 邪恶方公开发言保留“台面上 / 公开说 / 别闭眼冲”等表演语气，但不泄漏邪恶信息。
  - 公开目标名统一使用座位号：
    - 当目标是玩家本人或名字为“你”时，公聊和提名理由改用 `N号`，避免公开记录里出现“你 可以...”。
  - 增加 `sanitizePublicSurfaceEvidence(...)`：
    - 清理公开证据摘要里继承来的“你 这边 / 看 你 的解释 / 围着 你 打”等残留。
    - 将 `...` 统一渲染为 `…`，减少 smoke 误判和 UI 文本截断感。
  - 扩展 `ai_dialogue_smoke`：
    - 新增 `public-splice` 规则，专门抓公开发言里的目标代词拼接。
    - 当前 20 条固定样本为 0 warning。
  - 契约测试放宽 evidence contract 的展示匹配，允许自然口语渲染中的省略号与短摘要，但仍要求引用 contract-derived 证据。
  - Unity StreamingAssets 内置 JS Core 已同步 `ai.js` 和 `ai_dialogue_smoke.mjs`。
- 当前效果：
  - 私聊与公聊都已走结构化 surface 渲染主路径。
  - 公开样本不再出现 `你 我...` / `你 可以...` 这类硬拼。
  - 下一步可继续做 AI-AI 私聊、提名理由和死亡复盘的专用 act renderer，进一步降低模板味。
- 状态：已完成（public structured surface renderer pass）。

## CR-2026-05-12-03
- 请求人：用户
- 时间：2026-05-12
- 变更内容：
  1. 继续优化 AI 语言自然度，重点处理 smoke 虽然 0 warning、但肉眼仍像系统摘要的表达。
  2. 收束低证据公聊、AI-AI 私聊、主动私聊和提名理由中的模板残留。
  3. 不改规则引擎、不接在线 LLM、不改变 Unity UI。
- 处理策略：
  - 低证据 evidence contract：
    - 无公开硬证据时，`spokenText` 改为“公开信息还不够，先听回应和票型”。
    - 公聊 evidence label 从“我现在抓的点”改为更桌边的“卡点是 / 证据还薄”。
  - AI-AI / 主动私聊：
    - `private.proactive.noteShare` 从“我的信息链是”改为“我这边拿到的是”。
    - 邪恶方“白天话术可以围着 X 打一圈”改成“白天可以先问 X，别急着冲票，先看回应”。
    - `sanitizePrivateDialogueText(...)` 清理 `信息链是`、`ta`、`围绕 9号 追问`、`你这边先放进观察位` 等模板痕迹。
    - AI-AI 目标如果是玩家本人，统一转成座位号。
  - 提名理由：
    - 公开记忆驱动的提名理由不再复读整段公聊原文，改为短句：“刚才我已经点过 7号，理由还是 8号公聊口径需要复核。”
  - smoke 规则：
    - 新增 `mechanical-dialogue` 检查，覆盖 `低证据判断`、`信息链是`、`围着你`、`ta` 等本轮发现的机械残留。
  - Unity StreamingAssets 内置 JS Core 已同步 `ai.js`、`ai_speech_corpus.json` 和 `ai_dialogue_smoke.mjs`。
- 当前效果：
  - `npm run ai:dialogue-smoke` 仍为 20 条样本 0 warning。
  - 样本里 AI-AI 私聊已从“信息链是 / 围着你 / ta”转为更像玩家私下对线的短句。
- 状态：已完成（AI-AI/proactive/nomination language polish pass）。

## CR-2026-05-12-04
- 请求人：用户
- 时间：2026-05-12
- 变更内容：
  1. 增加游戏中的“对话感”，让 AI 不只是陈述判断，而是能接住玩家追问、直接回应语气压力。
  2. 私聊需要在“别绕/直接说/刚才那条/投票怎么站”等语境下给出明显 turn-taking。
  3. 公聊引用前面发言时更像接话，而不是孤立输出判断。
- 处理策略：
  - 新增轻量 turn-taking 层：
    - `privateDialogueTurnPrefix(...)` 识别“别绕/直接/刚才/投票/对外口径/下一步”等玩家语用信号。
    - `applyPrivateDialogueTurnTaking(...)` 在 AI 私聊回复前补“好，我直接答”“嗯，我接着刚才那条说”“票这块我先说清楚”等接话短句。
    - claim/vote 场景给更宽的 speech budget，避免接话前缀挤掉身份、票型态度或证据句。
  - 公聊 surface renderer：
    - 当公聊证据来自前面发言，且处于 defense / nomination-pressure / vote-intent beat 时，补“我接一下前面的发言：...”。
  - smoke 场景：
    - 新增“玩家追问压迫感”样本，模拟玩家先问判断，再追问“别绕，直接说”。
    - 新增 `missing-turn-taking` 检查，确保 AI 在这种追问下先接住对话动作。
- 当前效果：
  - 私聊样本出现“嗯，我接着刚才那条说”“好，我直接答”“票这块我先说清楚”。
  - 公聊样本出现“我接一下前面的发言：...”。
  - `npm run ai:dialogue-smoke` 扩展为 22 条样本，0 warning。
- 状态：已完成（dialogue turn-taking pass）。

## CR-2026-05-12-05
- 请求人：用户
- 时间：2026-05-12
- 变更内容：
  1. Unity 版启动时主菜单应与游戏界面分开；不要在主菜单上叠加首夜/说书人对话。
  2. 只有玩家选择“新游戏 / 进入魔典”或“继续当前局”后，才显示首夜或阶段引导对话。
  3. Unity 版需要本地存档入口，支持保存当前局、继续最近存档、读档失败反馈和新局重开。
  4. 设置面板需要提供常规选项：分辨率、全屏切换、主音量、音乐音量、UI 音效音量；游戏内顶部也需要设置按钮。
- 处理策略：
  - Unity UI 只负责本地菜单、设置、存档外壳；规则状态仍由 JS Core `unity_state.json` / `unity_viewmodel.json` 驱动。
  - 设置使用 `PlayerPrefs` 保存，启动时应用到 `Screen.SetResolution` 与 Unity AudioSource 音量。
  - 存档使用 Unity `Application.persistentDataPath` 下的 JSON 副本，保存/恢复当前 bridge state/viewmodel/action result。
  - 主菜单显示时隐藏或弱化游戏 HUD 与底部正式对话；进入游戏后再触发首夜转场/说书人对话。
- 状态：已完成（Unity main menu / save / settings pass）。

## CR-2026-05-12-06
- 请求人：用户
- 时间：2026-05-12
- 变更内容：
  1. 检查并修复 Unity 阶段转场动画偶尔播不完整的问题，重点覆盖白天、公聊、提名。
  2. 提升通用 UI 字号，尤其按钮、工具按钮和角色 token 名称。
  3. 说书人/正式对话框打字弹出时需要有更明显的 UI 音效。
  4. 右侧资料按钮打开的抽屉需要更宽，并呈现从右侧屏幕滑入的效果。
  5. 当前建议点击的按钮需要高亮提示，例如夜晚可推进时提示“结算夜晚/下一阶段”。
  6. 基于剧本 JSON 补全图鉴内容，包括角色能力、夜晚提醒和标记词。
- 处理策略：
  - Unity UI 只改展示、动效和提示；不改变 JS Core 规则结算、AI 决策和阶段守卫判断。
  - 阶段转场使用排队播放，避免 pending 转场被 viewmodel 快速刷新直接截断。
  - 图鉴字段由 `assets/data/official_*.json` 生成到 JS Core viewmodel，再由 Unity 渲染。
- 状态：已完成（Unity UI polish and handbook data pass）。

## CR-2026-05-12-07
- 请求人：用户
- 时间：2026-05-12
- 变更内容：
  1. 增加 demo 复盘记录器，把每局核心信息，尤其 AI 私聊/公聊发言，自动落盘，方便后续复盘和调试。
  2. 自行通过 JS Core 私聊/公聊接口复现“问 AI 经常牛头不对马嘴”的问题，并修正明确意图问题的回答对齐。
- 处理策略：
  - `unity_action_bridge.mjs` 每次处理 Unity action 后写出 `output/demo_replays/<gameId>.json` 和 `output/demo_replays/latest.json`。
  - replay 内容包含局面元数据、玩家公开状态、debug truth、AI speech events、dialogue timeline、日志和 AI recap 摘要。
  - action result 增加 `replayPath` / `latestReplayPath`，方便 Unity 或调试脚本定位最近复盘文件。
  - 私聊 `claim` / `night` 意图提前生成直接回答，避免先进入通用怀疑目标链路再被 speech budget 截断。
  - 连续对话记忆不再把上一条怀疑线强行 prepend 到身份/夜晚回答前；重复问身份时明确保持既有身份口径。
- 当前效果：
  - 手动模拟“你是什么身份？”会直接给身份或身份范围；“你昨晚得到了什么信息？”会直接回答个人可分享夜间信息或明确无信息。
  - 新增契约覆盖 replay 落盘、私聊身份直答和夜晚信息直答。
- 状态：已完成（demo replay recorder + private Q/A intent alignment）。

## CR-2026-05-12-08
- 请求人：用户
- 时间：2026-05-12
- 变更内容：
  1. 评估“AI 回答牛头不对马嘴”是否为个例。
  2. 从根因上收束私聊回答，让所有主要问题类型都先满足“问什么答什么”，再进入证据、人设和记忆表达。
- 处理策略：
  - 结论：不是个例。根因是私聊生成里 surface act / evidence focus / intent switch 多层都可能抢回答权。
  - 新增 `privateAnswerAlignmentPattern(...)` 与 `ensurePrivateAnswerAlignment(...)`，作为最终出门前的统一私聊回答契约。
  - 覆盖 reason、trust、claim、vote、night、compare、plan、suspect：如果最终文本没有命中当前问题类型的回答信号，会补入对应 direct answer。
  - 兜底层只在回答缺失时生效，不覆盖已经自然成句的 surface act / 语料库表达。
  - 同步 Unity StreamingAssets 内置 `ai.js`。
- 当前效果：
  - 新增契约测试一次性覆盖 8 类私聊问题。
  - `npm run ai:dialogue-smoke` 保持 22 条样本 0 warning。
- 状态：已完成（private answer alignment contract pass）。

## CR-2026-05-12-09
- 请求人：用户
- 时间：2026-05-12
- 变更内容：
  1. 接入 AI 主动私聊和 AI-AI 私聊到 Unity bridge。
  2. AI 主动私聊不能突脸，玩家需要能接受或拒绝。
  3. AI-AI 私聊不显示在人类日志中，但要成为 agent 可用的弱社交线索。
  4. 公聊不希望按轮数呈现；提名阶段希望向限时/窗口制发展；提名后考虑双方互辩。
  5. 完成后生成 UI 跟进 prompt。
- 处理策略：
  - AI 主动私聊拆为 pending offer：
    - `ai-proactive-whispers` 只生成邀请，不泄漏完整私聊。
    - `accept-proactive-whisper` 才写入玩家时间线和私聊 evidence。
    - `decline-proactive-whisper` 移除邀请，不写入回复文本。
  - Unity viewmodel 新增 `pendingProactiveWhispers[]`，供 UI 渲染“接受/拒绝”。
  - AI-AI 私聊移除人类日志记录；内容仍只进参与双方 evidence。
  - 新增 `private-channel` / `social-read` 弱社交 evidence，所有 agent 可知道“谁和谁有过私聊”，但不知道内容。
  - 设计文档记录下一步：
    - 公聊改 conversation clock，而不是轮数 UI。
    - 提名改 nomination window/soft timer。
    - 提名后加入双方互辩，再进入投票。
  - 后续实现：
    - 新增 `ai-public-step`，以 conversation clock 推进开场、回应、交锋、提名压力、冷却。
    - 新增 `open-nomination-window`、`ai-nomination-step`、`human-nomination-intent`、`pass-nomination-window`，用软行动预算表达提名窗口。
    - 新增 `resolve-nomination-vote`，让提名意图先进入双方互辩，再结算投票。
- 状态：已完成（AI autonomous day flow bridge pass）。

## CR-2026-05-12-10
- 请求人：用户
- 时间：2026-05-12
- 变更内容：
  1. 检查 Electron 版已有交互接口在 Unity 版中的接入缺口。
  2. 将用户提供的 `bg.jpg` 接入 Unity 主菜单背景，解决主菜单黑屏感。
  3. 在 Unity 主菜单的新游戏入口增加初设选项：剧本、人数、自选角色。
- 处理策略：
  - 背景只作用于主菜单，不替换游戏内白天/夜晚棋盘背景。
  - 主菜单初设通过 Unity action payload 传给 JS Core 的 `new-game`，不绕过规则引擎。
  - 角色列表由现有官方剧本 JSON 生成 Unity Resources 用的轻量 catalog。
- 状态：已完成（main menu background and setup pass）。

## CR-2026-05-12-11
- 请求人：用户
- 时间：2026-05-12
- 变更内容：
  1. Unity 私聊阶段消费 AI 侧新增 bridge actions：`ai-proactive-whispers`、`accept-proactive-whisper`、`decline-proactive-whisper`、`ai-private-whispers`。
  2. AI 主动私聊以轻量 toast / 小抽屉展示，包含 token/头像、座位号、人格标签、来访原因，提供“接受 / 稍后 / 拒绝”。
  3. 主动私聊不能突脸挡住主魔典；同屏最多显示 1 条，其余保留在队列。
  4. AI-AI 私聊不进事件日志、不弹窗，只在 AI 复盘/调试视图显示弱社交线索。
  5. 公聊 UI 不再强调“第 N 轮”，改为 conversation clock：开场、回应、交锋、提名压力、冷却。
  6. 提名阶段增加软限时 UI：显示“提名窗口”进度，玩家或 AI 可主动提名；耗尽后提示今日空过。
  7. 提名后增加双方互辩面板：提名者陈述、被提名者辩解、可选第三方插话，然后进入投票仪式。
- 处理策略：
  - 只做 Unity UI 与 viewmodel 消费层，不改变 AI 生成策略和规则结算。
  - 主动私聊 toast 只显示 invitation metadata；接受后才调用 bridge action 并打开现有底部对话框。
  - conversation clock 与 nomination window 先采用 UI 时间/阶段表现，不把软计时当作 JS Core 强规则。
  - 投票仪式继续沿用现有 `voteCeremony` 数据，互辩面板作为投票前的表现层。
- 当前效果：
  - Unity 增加主动私聊小抽屉队列：同屏 1 条，支持接受、稍后、拒绝；接受后打开私聊面板，拒绝不写入时间线。
  - AI-AI 私聊只在 AI 复盘中以“社交线索”显示，不进入玩家事件日志或弹窗。
  - 公聊入口改为 `ai-public-step`，提名入口改为窗口/互辩/投票的分段流程。
  - 新增 `proactive-whisper`、`nomination-debate` UI smoke 状态。
- 状态：已完成（AI social UI and nomination flow pass）。
