# BOTC 单机模拟器（v0.2）

本项目是《血染钟楼》单机模拟原型。

## 已实现

- 三剧本开局：Trouble Brewing / Bad Moon Rising / Sects & Violets。
- **暗流涌动（TB）完整技能结算**（包含 Baron 外来者修正、Imp 传位、Scarlet Woman 接任、Saint / Mayor 特殊胜负、Virgin / Slayer / Butler / Monk / Ravenkeeper 等机制）。
- AI 推理与发言（非纯随机胡言）。
- 魔典风 UI：环形座位、HUD 配比、恶魔伪装卡片、事件日志、夜间私有信息面板。

## 运行（BOTC-Solo 桌面版）

已提供并产出 BOTC-Solo 桌面版 EXE（目录版），详见：
- `docs/packaging/WINDOWS_EXE.md`

已构建产物：
- `dist/BOTC-Solo/`（目录版）

快速命令（重建 EXE）：

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\build_exe.ps1
```

## 项目结构

- `index.html` / `styles.css`
- `scripts/data.js`
- `scripts/engine.js`
- `scripts/ai.js`
- `scripts/ui.js`
- `scripts/app.js`
- `docs/requirements/*`
- `docs/design/*`
- `docs/research/*`

## 语料与 Agent 管线（新增）

为对齐 `botc_implementation_plan_v1.md`，仓库新增了完整的数据到策略基线流程：

1. `scripts/acquisition/*`：采集/登记上游语料并写 provenance manifest  
2. `scripts/mapping/parse_*.py`：将多源数据统一到 intermediate events  
3. `scripts/mapping/map_*.py`：映射到 `schemas/botc_label_schema_v1.json`  
4. `scripts/qa/*`：结构校验、枚举漂移、缺失率、时序检查  
5. `agent/*`：state tracker / retriever / prompt builder / baseline policy  
6. `eval/*`：离线场景评测与报告

新增目录：
- `data/raw/` / `data/interim/` / `data/processed/`
- `schemas/`
- `scripts/acquisition/` / `scripts/mapping/` / `scripts/qa/`
- `agent/` / `eval/`

### 一键跑通（demo 数据）

```powershell
python scripts/run_botc_pipeline.py --demo
```

输出重点：
- `data/raw/source_manifest.json`
- `data/interim/<source>/events.jsonl`
- `data/processed/*.jsonl`
- `docs/qa/*.json`
- `docs/dataset_qa_report_v1.md`
- `eval/report_latest.json`

### 仅登记上游来源（不下载）

```powershell
python scripts/run_botc_pipeline.py
```

### 真实语料接入并训练（新增）

```powershell
python scripts/run_real_data_pipeline.py
```

该流程会尝试接入公开可访问真实源并训练轻量模型：
- `werewolf_among_us`: `bolinlai/Werewolf-Among-Us`
- `llmafia` transfer fallback: `peterpeterp/mafiamessages`
- `aiwolf` transfer: `fukufuk/aiwolf-convs`

产物：
- 处理后语料：`data/processed/*.jsonl`
- QA 报告：`docs/dataset_qa_report_v1.md`
- 训练报告：`models/training_report.json`
- 模型文件：`models/vote_stance_model.joblib`、`models/speech_acts_model.joblib`
- 前端推理权重：`scripts/ml_runtime_model_data.js`（游戏运行时直接调用）

## 在线参考资料

- [Trouble Brewing - Official Wiki](https://wiki.bloodontheclocktower.com/Trouble_Brewing)
- [Bad Moon Rising - Official Wiki](https://wiki.bloodontheclocktower.com/Bad_Moon_Rising)
- [Sects & Violets - Official Wiki](https://wiki.bloodontheclocktower.com/Sects_%26_Violets)
- [Setup - Official Wiki](https://wiki.bloodontheclocktower.com/Setup)
- UI/素材参考页：[clocktower.gstonegames.com/grimoire](https://clocktower.gstonegames.com/grimoire/)

## 说明

- TB 为高保真规则实现。
- BMR / SnV 目前仍为简化规则模式（可玩）。
