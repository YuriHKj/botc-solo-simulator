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


SOURCE = "werewolf_among_us"


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
            base_game_id = str(
                row.get("game_id")
                or row.get("game")
                or row.get("match_id")
                or row.get("EG_ID")
                or row.get("YT_ID")
                or file.stem
                or "unknown_game"
            )
            phase = normalize_phase(row.get("phase") or "day")
            day_index = row.get("day_index")
            if not isinstance(day_index, int):
                day_index = int(row.get("day", 1)) if str(row.get("day", "")).isdigit() else 1

            if isinstance(row.get("Dialogue"), list):
                for d in row.get("Dialogue", []):
                    turn += 1
                    text = str(d.get("utterance") or d.get("text") or "").strip()
                    if not text:
                        continue
                    out.append(
                        {
                            "source": SOURCE,
                            "game_id": f"{base_game_id}_{row.get('Game_ID', 'G')}",
                            "phase": phase,
                            "day_index": day_index,
                            "turn_index": turn,
                            "speaker": str(d.get("speaker") or "unknown"),
                            "audience": "public",
                            "text": text,
                            "timestamp": d.get("timestamp"),
                            "raw_metadata": {
                                "source_file": str(file),
                                "game_meta": {
                                    "playerNames": row.get("playerNames"),
                                    "votingOutcome": row.get("votingOutcome"),
                                    "startRoles": row.get("startRoles"),
                                    "endRoles": row.get("endRoles"),
                                },
                                "dialogue_annotation": d.get("annotation"),
                                "raw_row": d,
                            },
                        }
                    )
                continue

            turn += 1
            text = str(row.get("text") or row.get("utterance") or row.get("transcript") or "").strip()
            speaker = str(row.get("speaker") or row.get("player") or "unknown")
            out.append(
                {
                    "source": SOURCE,
                    "game_id": base_game_id,
                    "phase": phase,
                    "day_index": day_index,
                    "turn_index": turn,
                    "speaker": speaker,
                    "audience": normalize_audience(row.get("audience"), default="public"),
                    "text": text,
                    "timestamp": row.get("timestamp"),
                    "raw_metadata": {
                        "source_file": str(file),
                        "persuasion_label": row.get("persuasion_label"),
                        "vote_target": row.get("vote_target"),
                        "raw_row": row,
                    },
                }
            )
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description="Parse werewolf_among_us raw data into intermediate events.")
    parser.add_argument("--raw-dir", default="", help="Override raw source directory.")
    args = parser.parse_args()

    root = repo_root()
    raw_dir = Path(args.raw_dir).resolve() if args.raw_dir else root / "data" / "raw" / SOURCE
    events = parse_records(raw_dir)
    summary = write_events(SOURCE, events)
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
