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


def main() -> None:
    parser = argparse.ArgumentParser(description="Check enum drift in processed records.")
    parser.add_argument("--input", action="append", default=[], help="Specific processed JSONL file(s).")
    args = parser.parse_args()

    files = [Path(p).resolve() for p in args.input] if args.input else processed_files()
    label_schema = schema()
    field_spec = label_schema.get("field_spec", {})
    enum_sets = label_schema.get("enum_sets", {})

    enum_fields = {}
    for field, spec in field_spec.items():
        values_ref = spec.get("values_ref")
        if values_ref and values_ref in enum_sets:
            enum_fields[field] = {
                "ref": values_ref,
                "allowed": set(enum_sets[values_ref]),
                "is_array": spec.get("type") == "array<enum>",
            }

    drift = defaultdict(lambda: defaultdict(int))
    total_checked = 0

    for file in files:
        for rec in iter_jsonl(file):
            for field, meta in enum_fields.items():
                if field not in rec:
                    continue
                value = rec.get(field)
                total_checked += 1
                if value is None:
                    continue
                if meta["is_array"]:
                    if not isinstance(value, list):
                        drift[field]["<non_list_value>"] += 1
                    else:
                        for item in value:
                            if item not in meta["allowed"]:
                                drift[field][str(item)] += 1
                else:
                    if value not in meta["allowed"]:
                        drift[field][str(value)] += 1

    summary = {
        "check": "enum_consistency",
        "files": [str(p) for p in files],
        "total_enum_field_checks": total_checked,
        "drift": {f: dict(v) for f, v in drift.items()},
        "drift_field_count": sum(1 for _, values in drift.items() if values),
    }
    out_path = save_qa_json("enum_consistency.json", summary)
    print(json.dumps({"output": str(out_path), **summary}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
