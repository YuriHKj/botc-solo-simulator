# BOTC Solo Simulator

《血染钟楼》单机模拟器原型。目标是把“说书人魔典 + 电脑玩家推理 + 夜晚/白天流程 + 私聊/公聊/提名投票”做成可独立运行的桌面游戏 Demo。

> 非官方项目：本项目与 The Pandemonium Institute、Blood on the Clocktower 官方团队无隶属关系。Blood on the Clocktower 及相关名称、角色、规则与视觉资产归其权利方所有。本仓库已整理为可公开浏览的学习、研究与原型开发项目；维护者已确认当前随仓库提交的素材可用于本项目公开展示和 demo 分发。

## 当前状态

这是一个快速迭代中的原型，而不是完整商业级游戏。

- 桌面版基于 Electron，可打包为 Windows `.exe`。
- Unity prototype 已进入可运行 demo 阶段：Unity 负责魔典 UI、面板和动画承载，JS Core 仍是唯一规则/AI/权限引擎。
- Unity 构建版已支持自启动 JS Core bridge；直接运行 `unity-build/BOTC_Unity_Prototype.exe` 时会优先使用随包的 Node runtime，不需要额外手动启动后端。
- 局内 UI 以“魔典”为核心，支持座位环、角色 token、死亡帷幕、提醒物、恶魔伪装、事件日志、夜间行动弹窗和脚本手册。
- 当前主要支持三个官方基础剧本：
  - 暗流涌动 / Trouble Brewing
  - 黯月初升 / Bad Moon Rising
  - 梦殒春宵 / Sects & Violets
- TB 规则实现相对完整；BMR / SnV 已有可玩流程和大量角色钩子，但仍有部分规则属于简化或近似实现。
- AI 玩家已经从简单模板升级为 per-agent observation / evidence book 驱动：每个 AI 只基于自己看到的公聊、私聊、夜间信息、投票、提名和死亡信息更新判断。

## 主要功能

- 随机开局，并支持测试用自选身份。
- 第一夜 -> 第一天 -> 第二夜 -> 后续白天/夜晚流程。
- 邪恶方首夜互认：恶魔知道爪牙与三个不在场伪装，爪牙知道恶魔与其他爪牙。
- 夜间主动技能弹窗选择目标，支持 Storyteller pending action 队列。
- 白天流程包含有限私聊、公聊、提名、投票、处决与胜负判定。
- AI 可参与私聊、公聊、提名和投票，死亡 AI 仍可聊天并更倾向交身份/交信息。
- AI 会在有信息时主动私聊主视角；主动私聊不会消耗玩家自己的私聊次数。
- 邪恶队友私聊“问身份”时会交真实身份、台面伪装和配合口径。
- 公聊加入时序播放；私聊弹窗加入类似推理游戏的对话框、打字式回复和说话状态。
- 玩家可直接在魔典 token 上添加角色标记和 reminder。
- Unity demo 已接入可点击 action bridge：选 token、私聊、公聊、提名投票、夜间/白天行动、Storyteller 队列、剧本手册和魔典标记都通过 `unity_action.json` 回传 JS Core。
- Storyteller 队列支持真实规则触发的被动信息、死亡触发信息、单目标选择和多目标选择；Unity demo smoke 覆盖 `sage-info`、`ravenkeeper-info`、`barber-swap`。
- 事件日志记录公开事件、主视角夜间信息、私聊和关键流程。
- 本地轻量语料/模型管线可用于改善 AI 的发言意图识别、投票倾向和表达风格。

## 运行方式

### 安装依赖

```powershell
npm install
```

### 桌面开发启动

```powershell
npm run electron:start
```

### Windows 打包

```powershell
npm run electron:win
```

也可以使用项目脚本：

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\build_exe.ps1
```

更多说明见：

- `docs/packaging/WINDOWS_EXE.md`
- `docs/packaging/RELEASE_20260430.md`

### Unity 可玩 Demo

如果已有 `unity-build/BOTC_Unity_Prototype.exe`，可以直接启动 exe。构建版会尝试从自身 `StreamingAssets/BotcJsRuntime/node.exe` 拉起 JS Core bridge，并读取同目录下的 `unity_state.json` / `unity_viewmodel.json`。

开发期推荐从仓库根目录运行：

```powershell
npm run unity:demo
```

这会初始化 fresh state、启动 bridge watcher，并打开 Unity build。只初始化数据、不打开窗口：

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\run_unity_demo.ps1 -Fresh -NoWatch -NoLaunch -BuildAssets
```

`tools/run_unity_demo.ps1` 默认以 1920x1080 全屏启动构建版，贴近正式 demo 验收。开发调试或稳定截图时加 `-Windowed`；需要其他窗口尺寸时加 `-WindowWidth` / `-WindowHeight`。

更多 Unity 说明见：

- `unity-prototype/README.md`
- `docs/design/UNITY_SELF_BOOTSTRAP_BRIDGE_2026-05-09.md`
- `docs/design/UNITY_STORYTELLER_QUEUE_DEMO_ACCEPTANCE_2026-05-09.md`

## 测试

```powershell
npm test
```

当前测试覆盖：

- 角色行动接口契约
- 被动夜间信息与死亡触发 Storyteller 队列
- 夜晚行动完整性矩阵
- AI agent observation / evidence book
- 邪恶方互认与伪装认知
- 私聊、公聊、提名、投票转 observation
- AI 主动私聊不消耗玩家私聊次数
- 死亡 AI 公开交身份
- 邪恶队友被问身份时交真实身份与伪装口径
- Electron 打包路径与资源路径契约
- Unity viewmodel、action bridge、资源同步和可玩 demo smoke

Unity demo smoke 会跑一条可玩闭环，并额外覆盖真实 JS Core Storyteller 队列：

- `sage-info`：信息型队列。
- `ravenkeeper-info`：单目标队列。
- `barber-swap`：双目标队列。

## 项目结构

更完整的目录约定见 `docs/PROJECT_STRUCTURE.md`。

- `index.html`：Electron 渲染入口。
- `styles.css`：主 UI、魔典、对话舞台、弹窗、菜单样式和动画。
- `electron/main.cjs`：Electron 主进程。
- `scripts/app.js`：应用状态、事件绑定、流程入口、存档和启动流程。
- `scripts/ui.js`：界面渲染、魔典交互、私聊弹窗、公聊时序播放。
- `scripts/engine.js`：核心游戏状态、阶段推进、胜负和通用规则。
- `scripts/roles/`：按剧本拆分的角色规则模块。
- `scripts/ai.js`：AI 对话、推理、主动私聊、投票和表达生成。
- `scripts/ai_agents.js`：AI agent 观察、证据簿、私有/公开信息边界。
- `scripts/unity_viewmodel.js`：Unity UI 消费的只读 viewmodel 导出。
- `scripts/unity_action_bridge.mjs`：Unity action 文件到 JS Core 规则调用的桥接层。
- `unity-prototype/`：Unity 可运行 UI 原型和构建入口。
- `scripts/ml_runtime*.js`：轻量模型运行时和导出权重。
- `assets/audio/`：阶段 BGM 源文件；Electron 直接加载这里，Unity 通过同步脚本镜像到 `Resources/Botc/audio`。
- `assets/data/`：基础剧本 JSON。
- `assets/fonts/`：字体资源。
- `assets/roles/`：按剧本拆分的角色图标。
- `assets/ui/`：背景、token、提醒物、死亡帷幕等 UI 图片。
- `docs/`：需求、设计、打包、调研与 QA 文档。
- `docs/notes/`：历史参考笔记和规则理解草稿。
- `agent/`、`train/`、`eval/`：语料、训练和评测相关代码。

## AI 与语料管线

仓库包含从公开狼人杀类语料到游戏内策略基线的实验管线：

1. `scripts/acquisition/*`：采集或登记上游语料，并写入 provenance manifest。
2. `scripts/mapping/parse_*.py`：将多源数据统一成 intermediate events。
3. `scripts/mapping/map_*.py`：映射到 `schemas/botc_label_schema_v1.json`。
4. `scripts/qa/*`：做结构校验、枚举漂移、缺失率、时序检查。
5. `agent/*`：state tracker / retriever / prompt builder / baseline policy。
6. `eval/*`：离线场景评测与报告。

Demo 数据跑通：

```powershell
python scripts/run_botc_pipeline.py --demo
```

真实语料接入与训练：

```powershell
python scripts/run_real_data_pipeline.py
```

可能生成的产物：

- `data/processed/*.jsonl`
- `docs/dataset_qa_report_v1.md`
- `models/training_report.json`
- `models/vote_stance_model.joblib`
- `models/speech_acts_model.joblib`
- `scripts/ml_runtime_model_data.js`

`data/`、`models/` 等产物是否提交，需要根据语料许可和仓库发布方式单独判断。

## 本地打包产物

构建产物默认不会提交到 Git。

常见本地输出目录：

- `release/`
- `release-model/`
- `release-20260430-portable/`
- `release-20260430-mojibake-fix/`

构建产物默认不会提交到 Git；如需对外提供试玩包，建议通过 GitHub Release 上传 `.exe` 或 `.zip`，并在 Release note 中注明构建日期、commit、已知问题和素材说明。

## 公开仓库说明

本仓库可以作为 public repo 展示和协作，但它仍是非官方学习/研究原型，不是官方产品或商业发行版。

- 维护者已完成当前素材清查，并确认随仓库提交的图片、字体、音频和 Unity 镜像素材可用于本项目公开展示与 demo 分发。
- Blood on the Clocktower 名称、角色、规则、商标和相关世界观仍归权利方所有；本项目不声称拥有这些第三方权利，也不代表官方背书。
- 新增图片、字体、音频、抓取资料或训练语料前，请在提交说明或文档中记录来源、用途和授权边界。
- `data/`、`models/`、`release/`、`unity-build/`、`output/` 等生成物默认不入库；公开二进制包应通过 Release 分发，而不是直接提交到仓库。
- 仓库公开不等于开放商用或大规模再分发；涉及商用、平台分发或衍生资源包时，需要重新确认第三方授权与项目许可证。

本轮公开准备记录见：

- `docs/PUBLIC_RELEASE_READINESS_2026-05-10.md`

## 授权与许可证

本项目源代码以 MIT License 开源，详见 `LICENSE`。

随仓库提交的项目素材已由维护者确认可用于本项目公开展示和 demo 分发；但 Blood on the Clocktower 名称、角色、规则、商标、世界观和任何第三方权利不因本仓库 MIT 授权而被重新授权。复用或二次分发素材时，请保留非官方声明，并自行确认适用场景的授权边界。

## 参考资料

- [Blood on the Clocktower 官方站](https://bloodontheclocktower.com/)
- [Community Created Content Policy](https://bloodontheclocktower.com/pages/community-created-content-policy)
- [Terms of Use](https://bloodontheclocktower.com/pages/terms-of-use)
- [Trouble Brewing Wiki](https://wiki.bloodontheclocktower.com/Trouble_Brewing)
- [Bad Moon Rising Wiki](https://wiki.bloodontheclocktower.com/Bad_Moon_Rising)
- [Sects & Violets Wiki](https://wiki.bloodontheclocktower.com/Sects_%26_Violets)
- [Setup Wiki](https://wiki.bloodontheclocktower.com/Setup)
- [GStone Grimoire Reference](https://clocktower.gstonegames.com/grimoire/)

## 开发备注

- 当前主要面向 Windows。
- Node / Electron 版本以 `package-lock.json` 为准。
- 项目仍处于重构阶段，角色规则、AI 对话和 UI 会继续变化。
