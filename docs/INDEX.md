# 文档索引

本索引用来区分“当前开发决策文档”和“历史研究/缓存资料”。后续继续开发时，优先阅读当前文档，避免被旧计划或抓取缓存误导。

## 当前优先阅读

- `docs/PROJECT_STATUS_AND_OPEN_REQUIREMENTS.md`  
  当前总体状态、未满足需求、建议优先级。
- `docs/design/CURRENT_THREAD_HANDOFF.md`  
  新开 Codex 线程时的短交接文档。
- `docs/requirements/PRODUCT_REQUIREMENTS.md`  
  产品目标与验收标准。部分“必须完成”已经被后续审计细化，不应单独作为完成度判断。
- `docs/design/ROLE_IMPLEMENTATION_AUDIT.md`  
  当前每个角色的真实实现方式与偏差，是判断规则缺口的主要依据。
- `docs/design/UI_GRIMOIRE_FOCUS_REFACTOR_PLAN.md`  
  UI 继续精修时的主要执行计划。
- `docs/design/AI_DIALOGUE_LOGIC_REPORT.md`  
  AI 对话链路、现有问题和下一步优化建议。
- `docs/design/ROLE_MODULE_REFACTOR_PHASE1.md`  
  角色模块化拆分进度与后续接口方向。

## 验证与发布

- `docs/verification/VERIFICATION.md`  
  历史验证记录。注意日期较早，不覆盖 2026-04-30 之后所有改动。
- `docs/packaging/WINDOWS_EXE.md`  
  Windows 打包说明。
- `docs/packaging/RELEASE_20260430.md`  
  2026-04-30 附近版本的发布记录。

## AI / 语料管线

- `docs/pipeline/IMPLEMENTATION_STATUS.md`  
  语料与 Agent 管线落地状态。
- `docs/pipeline/botc_implementation_plan_v1.md`
- `docs/pipeline/botc_label_schema_v1.md`
- `docs/pipeline/botc_corpus_acquisition_and_mapping_v1.md`
- `docs/pipeline/botc_research_pack_v1.md`
- `docs/dataset_qa_report_v1.md`
- `docs/mapping_notes.md`

## 历史计划

- `docs/plans/PLANS.md`  
  早期计划与完成勾选。只作为历史记录，不作为当前缺口清单。
- `docs/requirements/CHANGE_REQUESTS.md`  
  早期变更请求记录。部分“已完成”表示当时版本完成，不代表官方级细节完全满足。
- `docs/design/TB_RULE_COVERAGE.md`
- `docs/design/BMR_SNV_RULE_COVERAGE.md`  
  覆盖清单偏“核心触发是否存在”，细节偏差请以 `ROLE_IMPLEMENTATION_AUDIT.md` 为准。

## 研究缓存与大体积资料

以下文件/目录是调研抓取结果或截图缓存，通常不需要在普通开发线程中读取：

- `docs/research/app.js`
- `docs/research/chunk-vendors.js`
- `docs/research/*.html`
- `docs/research/wiki_cache/`
- `docs/research/grimoire-assets/`
- `docs/verification/*.png`

如果 Codex 客户端卡顿，优先不要批量打开这些文件。
