# BOTC Solo Simulator

《血染钟楼》单机模拟器原型。目标是把“说书人魔典 + 电脑玩家推理 + 夜晚/白天流程 + 私聊/公聊/提名投票”做成可独立运行的桌面游戏 Demo。

> 非官方项目：本项目与 The Pandemonium Institute、Blood on the Clocktower 官方团队无隶属关系。Blood on the Clocktower 及相关名称、角色、规则与视觉资产归其权利方所有。本仓库当前主要用于个人学习、研究和私有开发。

## 当前状态

这是一个快速迭代中的原型，而不是完整商业级游戏。

- 桌面版基于 Electron，可打包为 Windows `.exe`。
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

## 测试

```powershell
npm test
```

当前测试覆盖：

- 角色行动接口契约
- AI agent observation / evidence book
- 邪恶方互认与伪装认知
- 私聊、公聊、提名、投票转 observation
- AI 主动私聊不消耗玩家私聊次数
- 死亡 AI 公开交身份
- 邪恶队友被问身份时交真实身份与伪装口径

## 项目结构

- `index.html`：Electron 渲染入口。
- `styles.css`：主 UI、魔典、对话舞台、弹窗、菜单样式和动画。
- `electron/main.js`：Electron 主进程。
- `scripts/app.js`：应用状态、事件绑定、流程入口、存档和启动流程。
- `scripts/ui.js`：界面渲染、魔典交互、私聊弹窗、公聊时序播放。
- `scripts/engine.js`：核心游戏状态、阶段推进、胜负和通用规则。
- `scripts/roles/`：按剧本拆分的角色规则模块。
- `scripts/ai.js`：AI 对话、推理、主动私聊、投票和表达生成。
- `scripts/ai_agents.js`：AI agent 观察、证据簿、私有/公开信息边界。
- `scripts/ml_runtime*.js`：轻量模型运行时和导出权重。
- `assets/`：本地素材、剧本 JSON、角色图标和 UI 图片。
- `docs/`：需求、设计、打包、调研与 QA 文档。
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

如果只用于 private repository 自测，可以在 GitHub Release 中上传 `.exe` 或 `.zip`。如果未来考虑公开发布，建议先阅读下方注意事项。

## 公开发布注意事项

当前仓库包含或引用了来自官方/资源站点的参考素材、角色图标、背景图、字体和规则资料。它们适合本地研究和私有开发，但不应默认视为可公开再分发资产。

在把仓库设为 public 或发布 Release 前，建议先完成：

- 删除或替换所有不确定授权的官方/抓取素材。
- 将 `assets/reference_scraped/`、官方图标、背景和字体改为本地私有资源包，或提供下载/导入脚本而不是直接提交素材。
- 使用自制、开源授权或占位素材替代打包进 exe 的资源。
- 在 README 和 Release note 中保留非官方声明。
- 不使用可能让人误解为官方产品的名称、logo 或描述。
- 不发布可能与官方 app、script tool 或商业产品直接竞争的公开工具。

更稳妥的公开路线是：保留此仓库为 private，然后另建一个 public-clean 仓库，只包含代码、占位素材、构建说明和素材导入接口。

## Release 建议

Private 仓库：

- 可以发布 GitHub Release，上传 `.exe` 或 `.zip` 给自己测试。
- Release note 建议注明构建日期、commit、已知问题和素材仅供私有测试。

Public 仓库：

- 暂不建议上传当前完整 exe。
- 可以只发布源码或 clean demo build，但需要移除受限素材。
- 如果保留玩法规则实现，README 应强调非官方、非商业、学习用途。

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
- 如果 Codex 线程过长导致客户端卡顿，建议新开线程并引用 `docs/design/CURRENT_THREAD_HANDOFF.md` 或最近的进度快照继续。
