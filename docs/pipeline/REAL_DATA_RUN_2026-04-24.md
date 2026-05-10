# 真实语料接入与训练运行记录（2026-04-24）

## 本次运行目标
- 使用可访问的真实公开语料（Hugging Face）完成：
  - 采集（raw）
  - 解析（interim）
  - 映射到统一标签 schema（processed）
  - QA 校验
  - 训练迁移模型（vote stance + speech acts）

## 本次使用的数据源
1. Werewolf transfer: `https://huggingface.co/datasets/bolinlai/Werewolf-Among-Us`
2. LLMafia fallback transfer: `https://huggingface.co/datasets/peterpeterp/mafiamessages`
3. AIWolf transfer: `https://huggingface.co/datasets/fukufuk/aiwolf-convs`

说明：
- 原计划中的 `chenxran/Werewolf-Among-Us`、`92MING/LLMafia` 在当前环境不可直接访问，已使用可访问替代源，并在 `data/raw/*/source_info.json` 记录 provenance。

## 运行命令
```powershell
python scripts\run_real_data_pipeline.py --llmafia-max-rows 60000 --aiwolf-max-rows 5000
```

## 产物路径
- 原始层：`data/raw/*`
- 中间层：`data/interim/*/events.jsonl`
- 处理层：`data/processed/*.jsonl`
- QA 报告：`docs/qa/*`、`docs/dataset_qa_report_v1.md`
- 训练模型：`models/vote_stance_model.joblib`、`models/speech_acts_model.joblib`
- 训练摘要：`models/training_report.json`

## 样本规模（本次实际跑出）
- werewolf_among_us: **24,073**
- llmafia: **120,002**
- aiwolf: **1,372**
- 总计: **145,447**

## QA 摘要
- schema validity: **100%**
- enum drift: **0**
- turn/day order anomaly: **0**

详见：
- `docs/qa/schema_validity.json`
- `docs/qa/enum_consistency.json`
- `docs/qa/missingness.json`
- `docs/qa/turn_order.json`
- `docs/qa/label_statistics.json`
- `docs/dataset_qa_report_v1.md`

## 训练结果摘要

### 1) vote_stance 分类
- status: `ok`
- samples: **145,446**（自动剔除 singleton label）
- weighted_f1: **0.99779**
- model: `models/vote_stance_model.joblib`

### 2) speech_acts 多标签分类
- status: `ok`
- samples: **145,447**
- label_count: **8**
- micro_f1: **0.84993**
- macro_f1: **0.72053**
- model: `models/speech_acts_model.joblib`

## 备注
- 当前训练流程已经可重复执行，后续可以继续做：
  - 更均衡的标签采样
  - 分源加权训练
  - 线上推理集成（替换部分规则对话策略）
