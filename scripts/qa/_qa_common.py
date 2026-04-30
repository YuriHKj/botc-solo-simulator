from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, Iterable, List

from scripts.pipeline_utils import iter_jsonl, load_label_schema, read_json, repo_root_from, write_json


def repo_root() -> Path:
    return repo_root_from(__file__)


def processed_files() -> List[Path]:
    root = repo_root()
    processed_dir = root / "data" / "processed"
    if not processed_dir.exists():
        return []
    files = []
    for p in processed_dir.glob("*.jsonl"):
        if p.name.endswith(".summary.jsonl"):
            continue
        files.append(p)
    return sorted(files)


def load_records(paths: Iterable[Path]) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for p in paths:
        rows.extend(list(iter_jsonl(p)))
    return rows


def qa_output_dir() -> Path:
    root = repo_root()
    out = root / "docs" / "qa"
    out.mkdir(parents=True, exist_ok=True)
    return out


def save_qa_json(filename: str, data: Dict[str, Any]) -> Path:
    path = qa_output_dir() / filename
    write_json(path, data)
    return path


def schema() -> Dict[str, Any]:
    return load_label_schema(repo_root())
