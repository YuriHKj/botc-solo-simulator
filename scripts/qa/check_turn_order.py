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
from scripts.qa._qa_common import processed_files, save_qa_json


def main() -> None:
    parser = argparse.ArgumentParser(description="Check turn/day ordering consistency in processed records.")
    parser.add_argument("--input", action="append", default=[], help="Specific processed JSONL file(s).")
    args = parser.parse_args()

    files = [Path(p).resolve() for p in args.input] if args.input else processed_files()
    by_game = defaultdict(list)

    for file in files:
        for rec in iter_jsonl(file):
            game_id = str(rec.get("game_id", "unknown_game"))
            source_turn = rec.get("source_metadata", {}).get("turn_index")
            by_game[game_id].append(
                {
                    "turn_index": source_turn if isinstance(source_turn, int) else None,
                    "day_index": rec.get("day_index"),
                    "phase": rec.get("phase"),
                }
            )

    anomalies = []
    checked_games = 0
    for game_id, rows in by_game.items():
        checked_games += 1
        last_turn = -1
        last_day = -1
        for idx, row in enumerate(rows):
            turn = row["turn_index"]
            day = row["day_index"] if isinstance(row["day_index"], int) else -1
            if turn is not None:
                if turn < last_turn:
                    anomalies.append(
                        {
                            "game_id": game_id,
                            "type": "turn_regression",
                            "index": idx,
                            "prev_turn": last_turn,
                            "current_turn": turn,
                        }
                    )
                last_turn = turn
            if day < last_day:
                anomalies.append(
                    {
                        "game_id": game_id,
                        "type": "day_regression",
                        "index": idx,
                        "prev_day": last_day,
                        "current_day": day,
                    }
                )
            last_day = max(last_day, day)

    summary = {
        "check": "turn_order",
        "checked_games": checked_games,
        "anomaly_count": len(anomalies),
        "anomalies": anomalies[:50],
    }
    out_path = save_qa_json("turn_order.json", summary)
    print(json.dumps({"output": str(out_path), **summary}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
