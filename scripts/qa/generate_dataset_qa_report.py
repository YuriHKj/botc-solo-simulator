from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Dict
import sys

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.pipeline_utils import read_json, repo_root_from
from scripts.qa._qa_common import qa_output_dir


def load_or_empty(path: Path) -> Dict[str, Any]:
    return read_json(path, default={})


def render_markdown(
    schema_validity: Dict[str, Any],
    enum_consistency: Dict[str, Any],
    missingness: Dict[str, Any],
    turn_order: Dict[str, Any],
    label_stats: Dict[str, Any],
) -> str:
    top_missing = missingness.get("top_missing_fields", [])[:10]
    drift = enum_consistency.get("drift", {})
    drift_lines = []
    for field, values in drift.items():
        if not values:
            continue
        drift_lines.append(f"- `{field}`: {values}")
    if not drift_lines:
        drift_lines.append("- 无枚举漂移。")

    missing_lines = []
    for row in top_missing:
        missing_lines.append(f"- `{row.get('field')}`: {row.get('missing_rate', 0):.2%}")
    if not missing_lines:
        missing_lines.append("- 无数据。")

    source_lines = []
    for src, cnt in (label_stats.get("utterance_count_by_source", {}) or {}).items():
        source_lines.append(f"- `{src}`: {cnt}")
    if not source_lines:
        source_lines.append("- 无数据。")

    act_lines = []
    for act, cnt in list((label_stats.get("speech_act_frequency", {}) or {}).items())[:10]:
        act_lines.append(f"- `{act}`: {cnt}")
    if not act_lines:
        act_lines.append("- 无数据。")

    vote_cov = label_stats.get("vote_related_field_coverage", {}) or {}
    md = f"""# Dataset QA Report v1

## 1. Schema Validity
- 总记录数: {schema_validity.get("total_records", 0)}
- 合规记录数: {schema_validity.get("valid_records", 0)}
- 合规率: {schema_validity.get("validity_rate", 0):.2%}

## 2. Enum Consistency
- 检查字段总次数: {enum_consistency.get("total_enum_field_checks", 0)}
- 出现漂移的字段数: {enum_consistency.get("drift_field_count", 0)}
{chr(10).join(drift_lines)}

## 3. Missingness
- 总记录数: {missingness.get("total_records", 0)}
- 缺失/unknown 率最高字段（Top 10）:
{chr(10).join(missing_lines)}

## 4. Turn/Day Order
- 检查局数: {turn_order.get("checked_games", 0)}
- 异常数: {turn_order.get("anomaly_count", 0)}

## 5. Label Statistics
- 按来源 utterance 数:
{chr(10).join(source_lines)}
- speech_act 频次 Top 10:
{chr(10).join(act_lines)}
- vote 字段覆盖:
  - `vote_stance_rate`: {vote_cov.get("vote_stance_rate", 0):.2%}
  - `nomination_related_rate`: {vote_cov.get("nomination_related_rate", 0):.2%}
  - `targets_rate`: {vote_cov.get("targets_rate", 0):.2%}

## 6. 结论与建议
1. 若 schema 合规率低于 95%，先修复 mapping 再扩充数据规模。
2. 对缺失率高字段（如 BOTC 专属状态）保留 `unknown`，并在后续 BOTC 人工补标阶段回填。
3. 对任何枚举漂移字段，优先在 mapper 中写显式映射，不要靠临时字符串透传。
"""
    return md


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate docs/dataset_qa_report_v1.md from QA JSON outputs.")
    parser.add_argument(
        "--output",
        default="docs/dataset_qa_report_v1.md",
        help="Markdown report output path.",
    )
    args = parser.parse_args()

    root = repo_root_from(__file__)
    out_dir = qa_output_dir()
    schema_validity = load_or_empty(out_dir / "schema_validity.json")
    enum_consistency = load_or_empty(out_dir / "enum_consistency.json")
    missingness = load_or_empty(out_dir / "missingness.json")
    turn_order = load_or_empty(out_dir / "turn_order.json")
    label_stats = load_or_empty(out_dir / "label_statistics.json")

    markdown = render_markdown(schema_validity, enum_consistency, missingness, turn_order, label_stats)
    out_path = root / args.output
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(markdown, encoding="utf-8")
    print(json.dumps({"output": str(out_path)}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
