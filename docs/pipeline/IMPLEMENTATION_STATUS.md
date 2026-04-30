# BOTC Implementation Plan v1 — 落地状态

对应文档：
- `docs/pipeline/botc_implementation_plan_v1.md`
- `docs/pipeline/botc_label_schema_v1.md`
- `schemas/botc_label_schema_v1.json`
- `docs/pipeline/botc_corpus_acquisition_and_mapping_v1.md`
- `docs/pipeline/botc_research_pack_v1.md`

## Phase 1 — Repository Skeleton
- [x] 创建目录：`data/raw`、`data/interim`、`data/processed`、`schemas`、`scripts/acquisition`、`scripts/mapping`、`scripts/qa`、`agent`、`eval`。
- [x] 复制 schema：`schemas/botc_label_schema_v1.json`。
- [x] 文档归档到 `docs/pipeline/`。

## Phase 2 — Data Acquisition
- [x] `scripts/acquisition/get_werewolf_among_us.py`
- [x] `scripts/acquisition/get_llmafia.py`
- [x] `scripts/acquisition/get_aiwolf_logs.py`
- [x] 生成 provenance：`data/raw/source_manifest.json`

说明：脚本支持 `--register-only`（仅登记来源）与 `--demo`（生成可运行样例）。

## Phase 3 — Intermediate Format
- [x] `schemas/intermediate_event_schema.json`
- [x] parser：
  - `scripts/mapping/parse_werewolf_among_us.py`
  - `scripts/mapping/parse_llmafia.py`
  - `scripts/mapping/parse_aiwolf.py`
- [x] 输出 `data/interim/<source>/events.jsonl`

## Phase 4 — Final Schema Mapping
- [x] mapper：
  - `scripts/mapping/map_werewolf_among_us.py`
  - `scripts/mapping/map_llmafia.py`
  - `scripts/mapping/map_aiwolf.py`
- [x] 输出：
  - `data/processed/werewolf_among_us.jsonl`
  - `data/processed/llmafia.jsonl`
  - `data/processed/aiwolf.jsonl`
- [x] 映射说明：`docs/mapping_notes.md`

## Phase 5 — QA
- [x] `scripts/qa/check_schema_validity.py`
- [x] `scripts/qa/check_enum_consistency.py`
- [x] `scripts/qa/check_missingness.py`
- [x] `scripts/qa/check_turn_order.py`
- [x] 报告生成：`scripts/qa/generate_dataset_qa_report.py`
- [x] 报告输出：`docs/dataset_qa_report_v1.md` 与 `docs/qa/*.json`

## Phase 6 — Baseline Agent
- [x] `agent/state_tracker.py`
- [x] `agent/retriever.py`
- [x] `agent/prompt_builder.py`
- [x] `agent/baseline_policy.py`
- [x] BOTC约束扩展：`agent/botc_extensions.py`

## Phase 7 — Evaluation Harness
- [x] `eval/test_scenarios.json`
- [x] `eval/run_eval.py`
- [x] 输出：`eval/report_latest.json`

## Phase 8 — BOTC-specific Extension Layer
- [x] 死者发言/鬼票约束（policy扩展）
- [x] drunk/poisoned 不确定性降置信处理
- [x] madness 发言风格钩子
- [x] storyteller uncertainty hook
- [x] BOTC 扩展场景已写入 `eval/test_scenarios.json`

## 2026-04-25 — Agent/UI Information Boundary Notes
- [x] 夜间或开局给玩家的主观私有信息现在会同步进入事件日志，事件类型为 `private-info`，并保留原有“夜间私有信息”面板。
- [x] `private-info` 日志带 `payload.private=true` 和 `playerId`，普通玩家视角只显示属于自己的私有信息；魔典全知视角仍可查看完整日志。
- [x] 中毒/醉酒等客观隐藏状态仍不应在普通玩家日志中直接暴露。若玩家因中毒/醉酒获得错误信息，该信息应作为“玩家主观收到的信息”出现，而不是暴露底层原因。
- [x] 当前实现符合 label schema 中“objective truth / subjective claim / private knowledge”分层的最小落地：日志记录玩家知道了什么，AI 决策层再根据身份、阵营、公开发言和私有知识更新判断。
- [ ] 下一步建议补充 BOTC 专用人工小样本：中毒诚实误报、醉酒自信误判、邪恶互认后同阵营不互骗、死人仍可发言但投票受限、疯狂约束下的可疑发言。
- [ ] 下一步建议把 `private-info` 事件接入对话检索上下文，作为“我亲眼/夜里收到的信息”的高权重证据，但不能让其他 AI 无条件知道。

## 一键执行
- `scripts/run_botc_pipeline.py`（Python）
- `tools/run_botc_pipeline.ps1`（PowerShell 包装）
- `scripts/run_real_data_pipeline.py`（真实语料接入 + QA + 训练）

推荐命令（含 demo）：
```powershell
powershell -ExecutionPolicy Bypass -File .\tools\run_botc_pipeline.ps1 -Demo
```

真实语料接入与训练（已验证）：
```powershell
python scripts/run_real_data_pipeline.py --llmafia-max-rows 60000 --aiwolf-max-rows 5000
```
