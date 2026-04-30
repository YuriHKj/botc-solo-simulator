# BOTC Solo Simulator

《血染钟楼》单机模拟器原型，目标是把“说书人魔典 + 电脑玩家推理 + 夜晚/白天流程”做成可独立运行的桌面游戏 Demo。

> 非官方项目：本项目与 The Pandemonium Institute、Blood on the Clocktower 官方团队无隶属关系。Blood on the Clocktower 及相关名称、角色、规则与视觉资产归其权利方所有。本仓库当前主要用于个人学习、研究和私有开发。

## 当前状态

这是一个处于快速迭代中的原型，而不是完整商业级游戏。

- 桌面版基于 Electron，可打包为 Windows `.exe`。
- 局内 UI 以“魔典”为核心，支持座位环、角色 token、死亡帷幕、提醒物、恶魔伪装、事件日志和夜间行动弹窗。
- 当前主要支持 3 个官方基础剧本：
  - 暗流涌动 / Trouble Brewing
  - 黯月初升 / Bad Moon Rising
  - 梦殒春宵 / Sects & Violets
- TB 规则实现相对完整；BMR / SnV 已有可玩流程和大量角色钩子，但仍有部分规则属于简化或近似实现。
- AI 玩家目前是规则/语料/轻量模型混合驱动，用于模拟报身份、私聊、公聊、投票倾向和基础推理。

## 功能概览

- 三剧本随机开局，支持选择测试用自身份。
- 第一夜 / 第一日 / 后续夜晚和白天阶段推进。
- 邪恶方首夜互认与恶魔伪装信息。
- 夜间主动技能弹窗选择目标。
- 私聊、公聊、提名、投票、处决与胜负判断。
- 玩家可直接在魔典 token 上添加角色标记和 reminder。
- 事件日志记录公开事件与主视角夜间信息。
- 训练/语料管线可把外部狼人杀类语料映射成简化行为标签，用于改进 AI 表达和投票倾向。

## 运行方式

### 桌面开发启动

```powershell
npm install
npm run electron:start
```

### Windows 打包

```powershell
npm run electron:win
```

或使用项目脚本：

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\build_exe.ps1
```

更多说明见：

- `docs/packaging/WINDOWS_EXE.md`
- `docs/packaging/RELEASE_20260430.md`

## 本地打包产物

构建产物默认不会提交到 Git。

近期本地构建目录示例：

- `release-20260430-mojibake-fix/`
- `release-20260430-portable/`
- `release/`

如果要给自己测试，可以在 GitHub private repository 中上传 Release 附件；如果仓库转为 public，不建议直接上传当前 exe，原因见下方“公开发布注意事项”。

## 项目结构

- `index.html`：Electron 渲染入口。
- `styles.css`：主 UI、魔典、弹窗、菜单样式。
- `electron/main.js`：Electron 主进程。
- `scripts/app.js`：应用状态、事件绑定、流程入口。
- `scripts/ui.js`：界面渲染与交互。
- `scripts/engine.js`：核心游戏状态、阶段推进、胜负和通用规则。
- `scripts/roles/`：按剧本拆分的角色规则模块。
- `scripts/ai.js`：AI 对话、推理、投票和表达生成。
- `scripts/ml_runtime*.js`：轻量模型运行时和导出权重。
- `assets/`：本地素材、剧本 JSON、角色图标和 UI 图片。
- `docs/`：需求、设计、打包、调研与 QA 文档。
- `agent/`、`train/`、`eval/`：语料、训练和评测相关代码。

## AI 与语料管线

仓库包含一个从公开狼人杀类语料到游戏内策略基线的实验管线：

1. `scripts/acquisition/*`：采集或登记上游语料，并写入 provenance manifest。
2. `scripts/mapping/parse_*.py`：将多源数据统一成 intermediate events。
3. `scripts/mapping/map_*.py`：映射到 `schemas/botc_label_schema_v1.json`。
4. `scripts/qa/*`：做结构校验、枚举漂移、缺失率、时序检查。
5. `agent/*`：state tracker / retriever / prompt builder / baseline policy。
6. `eval/*`：离线场景评测与报告。

### Demo 数据跑通

```powershell
python scripts/run_botc_pipeline.py --demo
```

### 真实语料接入并训练

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

## 公开发布注意事项

当前仓库包含或引用了来自官方/资源站点的参考素材、角色图标、背景图、字体和规则资料。它们适合本地研究和私有开发，但不应默认视为可公开再分发资产。

在把仓库设为 public 或发布 Release 前，建议先完成：

- 删除或替换所有不确定授权的官方/抓取素材。
- 将 `assets/reference_scraped/`、官方图标、背景和字体改为本地私有资源包，或提供下载/导入脚本而不是直接提交素材。
- 使用自制、开源授权或占位素材替代打包进 exe 的资源。
- 在 README 和 Release note 中保留非官方声明。
- 不要使用可能让人误解为官方产品的名称、logo 或描述。
- 不要发布可能与官方 app、script tool 或商业产品直接竞争的公开工具。

更稳妥的公开路线是：保留此仓库为 private，然后另建一个 public-clean 仓库，只包含代码、占位素材、构建说明和素材导入接口。

## Release 建议

Private 仓库：

- 可以发布 GitHub Release，上传 `.exe` 或 `.zip` 给自己测试。
- Release note 建议注明构建日期、commit、已知问题和素材只供私有测试。

Public 仓库：

- 暂不建议上传当前完整 exe。
- 可只发布源码或 demo build，但需要移除受限素材。
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
- 项目仍处于重构阶段，角色规则、AI 对话和 UI 都会继续变化。
- 如果 Codex 线程过长导致客户端卡顿，建议新开线程并引用 `docs/design/CURRENT_THREAD_HANDOFF.md` 或最近的设计文档继续。
