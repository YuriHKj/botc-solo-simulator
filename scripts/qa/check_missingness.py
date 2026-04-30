from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.pipeline_utils import iter_jsonl
from scripts.qa._qa_common import processed_files, save_qa_json, schema


UNKNOWN_LIKE = {"unknown", "UNKNOWN", "", None}


def is_missing(value) -> bool:
    if value is None:
        return True
    if isinstance(value, str) and value in {"unknown", "UNKNOWN", ""}:
        return True
    if isinstance(value, list) and len(value) == 0:
        return True
    if isinstance(value, dict) and len(value) == 0:
        return True
    return False


def main() -> None:
    parser = argparse.ArgumentParser(description="Compute missingness/null-rate for processed schema fields.")
    parser.add_argument("--input", action="append", default=[], help="Specific processed JSONL file(s).")
    args = parser.parse_args()

    files = [Path(p).resolve() for p in args.input] if args.input else processed_files()
    label_schema = schema()
    fields = list(label_schema.get("field_spec", {}).keys())

    present_counter = defaultdict(int)
    missing_counter = defaultdict(int)
    total = 0

    for file in files:
        for rec in iter_jsonl(file):
            total += 1
            for field in fields:
                if field in rec:
                    if is_missing(rec.get(field)):
                        missing_counter[field] += 1
                    else:
                        present_counter[field] += 1
                else:
                    missing_counter[field] += 1

    field_stats = {}
    for field in fields:
        present = present_counter[field]
        missing = missing_counter[field]
        denom = present + missing
        field_stats[field] = {
            "present": present,
            "missing_or_unknown": missing,
            "missing_rate": (missing / denom) if denom else 0.0,
        }

    summary = {
        "check": "missingness",
        "total_records": total,
        "field_stats": field_stats,
        "top_missing_fields": sorted(
            [
                {"field": f, "missing_rate": s["missing_rate"]}
                for f, s in field_stats.items()
            ],
            key=lambda x: x["missing_rate"],
            reverse=True,
        )[:20],
    }
    out_path = save_qa_json("missingness.json", summary)
    print(json.dumps({"output": str(out_path), **summary}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
