# Dataset QA Report v1

## 1. Schema Validity
- 总记录数: 145447
- 合规记录数: 145447
- 合规率: 100.00%

## 2. Enum Consistency
- 检查字段总次数: 1599917
- 出现漂移的字段数: 0
- 无枚举漂移。

## 3. Missingness
- 总记录数: 145447
- 缺失/unknown 率最高字段（Top 10）:
- `speaker_private_role`: 100.00%
- `speaker_alignment`: 100.00%
- `action_capability`: 100.00%
- `intent`: 100.00%
- `truth_status_objective`: 100.00%
- `truth_status_subjective`: 100.00%
- `deception_type`: 100.00%
- `nomination_target`: 100.00%
- `nomination_by`: 100.00%
- `execution_push_strength`: 100.00%

## 4. Turn/Day Order
- 检查局数: 122
- 异常数: 0

## 5. Label Statistics
- 按来源 utterance 数:
- `aiwolf`: 1372
- `llmafia`: 120002
- `werewolf_among_us`: 24073
- speech_act 频次 Top 10:
- `table_read`: 119186
- `probe`: 12860
- `hard_claim`: 7495
- `coordinate_vote`: 5472
- `accuse`: 1153
- `soft_claim`: 734
- `defend`: 40
- `withhold_info`: 18
- vote 字段覆盖:
  - `vote_stance_rate`: 3.77%
  - `nomination_related_rate`: 100.00%
  - `targets_rate`: 0.00%

## 6. 结论与建议
1. 若 schema 合规率低于 95%，先修复 mapping 再扩充数据规模。
2. 对缺失率高字段（如 BOTC 专属状态）保留 `unknown`，并在后续 BOTC 人工补标阶段回填。
3. 对任何枚举漂移字段，优先在 mapper 中写显式映射，不要靠临时字符串透传。
