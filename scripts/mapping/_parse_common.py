from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, Iterable, List

from scripts.pipeline_utils import (
    ensure_dir,
    iter_jsonl,
    read_json,
    repo_root_from,
    write_jsonl,
)


ALLOWED_PHASE = {
    "setup",
    "night",
    "day",
    "nomination",
    "execution",
    "endgame",
    "postgame",
    "unknown",
}

ALLOWED_AUDIENCE = {
    "public",
    "private",
    "whisper",
    "small_group",
    "storyteller_only",
    "unknown",
}


def repo_root() -> Path:
    return repo_root_from(__file__)


def normalize_phase(value: Any) -> str:
    if not value:
        return "unknown"
    s = str(value).strip().lower()
    if s in {"d", "day", "daytime", "discussion"}:
        return "day"
    if s in {"n", "night", "nighttime"}:
        return "night"
    if s in {"nom", "nomination"}:
        return "nomination"
    if s in {"exec", "execution"}:
        return "execution"
    if s in ALLOWED_PHASE:
        return s
    return "unknown"


def normalize_audience(value: Any, default: str = "public") -> str:
    if not value:
        return default if default in ALLOWED_AUDIENCE else "unknown"
    s = str(value).strip().lower()
    aliases = {
        "public": "public",
        "private": "private",
        "team": "private",
        "whisper": "whisper",
        "small_group": "small_group",
        "storyteller_only": "storyteller_only",
        "unknown": "unknown",
    }
    return aliases.get(s, default if default in ALLOWED_AUDIENCE else "unknown")


def validate_event_shape(event: Dict[str, Any]) -> List[str]:
    errors: List[str] = []
    required = [
        "source",
        "game_id",
        "phase",
        "turn_index",
        "speaker",
        "audience",
        "text",
        "timestamp",
        "raw_metadata",
    ]
    for field in required:
        if field not in event:
            errors.append(f"missing:{field}")
    if event.get("phase") not in ALLOWED_PHASE:
        errors.append(f"invalid phase:{event.get('phase')}")
    if event.get("audience") not in ALLOWED_AUDIENCE:
        errors.append(f"invalid audience:{event.get('audience')}")
    if not isinstance(event.get("turn_index"), int):
        errors.append("turn_index must be int")
    if event.get("day_index") is not None and not isinstance(event.get("day_index"), int):
        errors.append("day_index must be int when present")
    return errors


def write_events(source: str, records: Iterable[Dict[str, Any]]) -> Dict[str, Any]:
    root = repo_root()
    target = root / "data" / "interim" / source / "events.jsonl"
    ensure_dir(target.parent)
    records = list(records)
    count = write_jsonl(target, records)
    bad = []
    for idx, rec in enumerate(records):
        errs = validate_event_shape(rec)
        if errs:
            bad.append({"index": idx, "errors": errs})
    summary = {
        "source": source,
        "event_count": count,
        "invalid_count": len(bad),
        "invalid_examples": bad[:10],
        "output_path": str(target),
    }
    summary_path = root / "data" / "interim" / source / "parse_summary.json"
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    return summary


def load_json_or_jsonl(path: Path) -> List[Dict[str, Any]]:
    if path.suffix.lower() == ".jsonl":
        return list(iter_jsonl(path))
    if path.suffix.lower() == ".json":
        data = read_json(path, default=[])
        if isinstance(data, list):
            return [x for x in data if isinstance(x, dict)]
        if isinstance(data, dict):
            for key in ("records", "messages", "events", "data"):
                candidate = data.get(key)
                if isinstance(candidate, list):
                    return [x for x in candidate if isinstance(x, dict)]
        return []
    return []
