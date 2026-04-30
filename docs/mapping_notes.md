# BOTC 语料映射说明（v1）

## 范围
本说明对应以下脚本：
- `scripts/mapping/parse_werewolf_among_us.py`
- `scripts/mapping/parse_llmafia.py`
- `scripts/mapping/parse_aiwolf.py`
- `scripts/mapping/map_werewolf_among_us.py`
- `scripts/mapping/map_llmafia.py`
- `scripts/mapping/map_aiwolf.py`

## 设计原则
1. 优先保留源数据，不可恢复字段写 `unknown`。
2. 所有推断字段必须落 `field_provenance`。
3. 非 BOTC 语料不强行伪造 BOTC 特有状态。
4. `source_metadata.raw_metadata` 保留原始上下文，便于追溯。

## Intermediate Event 说明
中间层统一字段：
- `source`
- `game_id`
- `phase`
- `day_index`
- `turn_index`
- `speaker`
- `audience`
- `text`
- `timestamp`
- `raw_metadata`

输出位置：
- `data/interim/werewolf_among_us/events.jsonl`
- `data/interim/llmafia/events.jsonl`
- `data/interim/aiwolf/events.jsonl`

## 映射策略
### Werewolf Among Us
- `script = werewolf_transfer`
- `evidence_source = social_read`
- `speech_acts`、`targets`、`vote_stance` 使用启发式文本规则。

### LLMafia
- `script = mafia_transfer`
- 夜晚默认 `audience=private`（若源字段缺失）。
- `evidence_source` 根据 audience 规则推断：`private_chat` 或 `public_claims`。

### AIWolf
- `script = aiwolf_transfer`
- 若 `event_type=vote`，则 `vote_stance=support`，并追加 `coordinate_vote`。
- `evidence_source = mechanical_reasoning`。

## 已知限制
1. 当前是 MVP 先行，full-mode 字段多为 `unknown`。
2. `speaker_alive` 默认 `true`，后续可结合事件流修正。
3. `intent`、`truth_status_objective/subjective` 仍以保守值为主，需要后续补标或分类模型。

## 下一步建议
1. 接入真实上游语料后，完善各源 parser 的字段映射表。
2. 增加 `player_state_timeline` 生成器，改进 `speaker_alive` 与状态标记。
3. 引入半自动标注（弱监督 + 人工复核）回填 full-mode 字段。
