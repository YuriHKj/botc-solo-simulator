from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from pathlib import Path
from typing import Dict, List
import sys

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.pipeline_utils import iter_jsonl
from scripts.qa._qa_common import processed_files, save_qa_json


def main() -> None:
    parser = argparse.ArgumentParser(description="Compute label frequency / co-occurrence / vote coverage statistics.")
    parser.add_argument("--input", action="append", default=[], help="Specific processed JSONL file(s).")
    args = parser.parse_args()

    files = [Path(p).resolve() for p in args.input] if args.input else processed_files()
    source_counts = Counter()
    speech_act_freq = Counter()
    cooccur = Counter()
    vote_coverage = Counter()
    total = 0

    for file in files:
        source_name = file.stem
        for rec in iter_jsonl(file):
            total += 1
            source_counts[source_name] += 1
            acts = [str(x) for x in (rec.get("speech_acts") or [])]
            for a in acts:
                speech_act_freq[a] += 1
            acts_sorted = sorted(set(acts))
            for i in range(len(acts_sorted)):
                for j in range(i + 1, len(acts_sorted)):
                    cooccur[(acts_sorted[i], acts_sorted[j])] += 1

            if rec.get("vote_stance") not in {None, "", "unknown", "undecided"}:
                vote_coverage["vote_stance_available"] += 1
            if rec.get("nomination_related") is not None:
                vote_coverage["nomination_related_available"] += 1
            if rec.get("targets"):
                vote_coverage["targets_available"] += 1

    cooccur_rows = [
        {"act_a": a, "act_b": b, "count": c}
        for (a, b), c in cooccur.most_common(50)
    ]
    summary = {
        "check": "label_statistics",
        "total_records": total,
        "utterance_count_by_source": dict(source_counts),
        "speech_act_frequency": dict(speech_act_freq.most_common()),
        "speech_act_cooccurrence_top50": cooccur_rows,
        "vote_related_field_coverage": {
            "vote_stance_rate": (vote_coverage["vote_stance_available"] / total) if total else 0.0,
            "nomination_related_rate": (vote_coverage["nomination_related_available"] / total) if total else 0.0,
            "targets_rate": (vote_coverage["targets_available"] / total) if total else 0.0,
            "raw_counts": dict(vote_coverage),
        },
    }
    out_path = save_qa_json("label_statistics.json", summary)
    print(json.dumps({"output": str(out_path), **summary}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
