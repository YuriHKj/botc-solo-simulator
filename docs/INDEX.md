# 文档索引

这个索引用来区分“当前开发应优先阅读的文档”和“历史调研/缓存资料”。后续继续开发时，优先看当前文档，避免被旧计划、旧截图缓存或乱码日志误导。

## 当前优先阅读

- `docs/PROJECT_STATUS_AND_OPEN_REQUIREMENTS.md`
  当前总体状态、未满足需求和建议优先级。
- `docs/design/CURRENT_THREAD_HANDOFF.md`
  新开 Codex 线程时的短交接文档。
- `docs/requirements/PRODUCT_REQUIREMENTS.md`
  产品目标与验收标准。部分“必须完成”已经被后续审计细化，不应单独作为完成度判断。
- `docs/design/ROLE_IMPLEMENTATION_AUDIT.md`
  当前每个角色的真实实现方式与偏差，是判断规则缺口的主要依据。
- `docs/design/ROLE_MODULE_REFACTOR_PHASE1.md`
  角色模块化拆分进度、通用行动接口和后续接口方向。
- `docs/design/AI_AGENT_MVP.md`
  AI 独立个体视角 MVP：个人记忆、邪恶互认、私聊/公聊可见性边界。
- `docs/design/AI_EVIDENCE_BOOK.md`
  AI 证据簿结构：来源、可信度、公开性、污染风险和后续推理接入方式。
- `docs/design/UI_GRIMOIRE_FOCUS_REFACTOR_PLAN.md`
  UI 继续精修时的主要执行计划。
- `docs/design/AI_DIALOGUE_LOGIC_REPORT.md`
  AI 对话链路、现有问题和下一步优化建议。

## 诊断记录

- `docs/diagnostics/AI_REPLAY_ANALYSIS_2026-05-03.md`
  用户实例日志暴露的 AI Day 1 神判问题，以及本轮 AI Agent MVP 的处理结果。
- `docs/diagnostics/AI_REPLAY_RAW_MOJIBAKE_2026-05-03.txt`
  用户原始实例日志，因历史编码问题保留为 raw trace，不作为可读设计文档。

## 验证与发布

- `docs/verification/VERIFICATION.md`
  历史验证记录。注意日期较早，不覆盖 2026-04-30 之后所有改动。
- `docs/packaging/WINDOWS_EXE.md`
  Windows 打包说明。
- `docs/packaging/RELEASE_20260430.md`
  2026-04-30 附近版本的发布记录。

## AI / 语料管线

- `docs/pipeline/IMPLEMENTATION_STATUS.md`
- `docs/pipeline/botc_implementation_plan_v1.md`
- `docs/pipeline/botc_label_schema_v1.md`
- `docs/pipeline/botc_corpus_acquisition_and_mapping_v1.md`
- `docs/pipeline/botc_research_pack_v1.md`
- `docs/dataset_qa_report_v1.md`
- `docs/mapping_notes.md`

## 历史计划

- `docs/plans/PLANS.md`
  早期计划与完成勾选，只作为历史记录。
- `docs/plans/AI_SOCIAL_TODO_2026-05-04.md`
  AI 私聊、公聊报身份、死人聊天、压力提名和外来者伪装策略 TODO。
- `docs/requirements/CHANGE_REQUESTS.md`
  早期变更请求记录。部分“已完成”表示当时版本完成，不代表官方级细节完全满足。
- `docs/design/TB_RULE_COVERAGE.md`
- `docs/design/BMR_SNV_RULE_COVERAGE.md`

## 研究缓存与大体积资料

以下文件/目录是调研抓取结果或截图缓存，普通开发线程通常不需要批量读取：

- `docs/research/app.js`
- `docs/research/chunk-vendors.js`
- `docs/research/*.html`
- `docs/research/wiki_cache/`
- `docs/research/grimoire-assets/`
- `docs/verification/*.png`

如果 Codex 客户端卡顿，优先不要批量打开这些文件。
