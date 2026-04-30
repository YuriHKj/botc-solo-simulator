from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Dict, List
import sys

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.mapping._parse_common import (
    load_json_or_jsonl,
    normalize_audience,
    normalize_phase,
    repo_root,
    write_events,
)


SOURCE = "aiwolf"


def find_candidate_files(raw_dir: Path) -> List[Path]:
    candidates: List[Path] = []
    skip = {
        "source_info.json",
        "download_manifest.json",
        "export_manifest.json",
        "parse_summary.json",
    }
    for path in raw_dir.rglob("*"):
        if not path.is_file():
            continue
        if path.name in skip:
            continue
        if path.suffix.lower() not in {".json", ".jsonl"}:
            continue
        candidates.append(path)
    return sorted(set(candidates))


def parse_records(raw_dir: Path) -> List[Dict]:
    out: List[Dict] = []
    files = find_candidate_files(raw_dir)
    turn = 0
    for file in files:
        rows = load_json_or_jsonl(file)
        for row in rows:
            event_type = str(row.get("event_type") or "").lower()
            phase = normalize_phase(row.get("phase"))
            if phase == "unknown":
                if event_type in {"vote", "talk", "whisper"}:
                    phase = "day"
                elif event_type in {"attack", "divine", "guard"}:
                    phase = "night"
            text = str(row.get("text") or row.get("script") or row.get("summary") or "")
            if not text and event_type == "vote":
                text = f"VOTE {row.get('target', '')}".strip()
            if not text:
                continue
            turn += 1
            day = row.get("day")
            day_index = day if isinstance(day, int) else 1
            out.append(
                {
                    "source": SOURCE,
                    "game_id": str(row.get("game_id") or row.get("match_id") or file.stem),
                    "phase": phase,
                    "day_index": day_index,
                    "turn_index": turn,
                    "speaker": str(row.get("actor") or row.get("speaker") or "system"),
                    "audience": normalize_audience(row.get("audience"), default="public"),
                    "text": text,
                    "timestamp": row.get("timestamp"),
                    "raw_metadata": {
                        "source_file": str(file),
                        "event_type": event_type,
                        "target": row.get("target"),
                        "raw_row": row,
                    },
                }
            )
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description="Parse aiwolf raw data into intermediate events.")
    parser.add_argument("--raw-dir", default="", help="Override raw source directory.")
    args = parser.parse_args()

    root = repo_root()
    raw_dir = Path(args.raw_dir).resolve() if args.raw_dir else root / "data" / "raw" / SOURCE
    events = parse_records(raw_dir)
    summary = write_events(SOURCE, events)
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
