from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.pipeline_utils import validate_mvp_record
from scripts.qa._qa_common import processed_files, save_qa_json, schema
from scripts.pipeline_utils import iter_jsonl


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate processed records against BOTC MVP schema constraints.")
    parser.add_argument("--input", action="append", default=[], help="Specific processed JSONL file(s).")
    args = parser.parse_args()

    files = [Path(p).resolve() for p in args.input] if args.input else processed_files()
    label_schema = schema()

    total = 0
    valid = 0
    by_file = {}
    error_counter = defaultdict(int)
    error_examples = []

    for file in files:
        f_total = 0
        f_valid = 0
        for idx, rec in enumerate(iter_jsonl(file)):
            total += 1
            f_total += 1
            errors = validate_mvp_record(rec, label_schema)
            if errors:
                for e in errors:
                    error_counter[e] += 1
                if len(error_examples) < 20:
                    error_examples.append({"file": str(file), "line_index": idx, "errors": errors, "record": rec})
            else:
                valid += 1
                f_valid += 1
        by_file[str(file)] = {
            "total": f_total,
            "valid": f_valid,
            "validity_rate": (f_valid / f_total) if f_total else 0.0,
        }

    summary = {
        "check": "schema_validity_mvp",
        "total_records": total,
        "valid_records": valid,
        "validity_rate": (valid / total) if total else 0.0,
        "files": by_file,
        "error_counter": dict(sorted(error_counter.items(), key=lambda kv: kv[1], reverse=True)),
        "error_examples": error_examples,
    }
    out_path = save_qa_json("schema_validity.json", summary)
    print(json.dumps({"output": str(out_path), **summary}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
