from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, Iterator, List, Optional


def repo_root_from(file_path: str | Path) -> Path:
    path = Path(file_path).resolve()
    for parent in [path] + list(path.parents):
        if (parent / ".git").exists():
            return parent
    return path.parents[1]


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def ensure_dir(path: str | Path) -> Path:
    p = Path(path)
    p.mkdir(parents=True, exist_ok=True)
    return p


def read_json(path: str | Path, default: Optional[Any] = None) -> Any:
    p = Path(path)
    if not p.exists():
        return {} if default is None else default
    return json.loads(p.read_text(encoding="utf-8"))


def write_json(path: str | Path, data: Any) -> None:
    p = Path(path)
    ensure_dir(p.parent)
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def iter_jsonl(path: str | Path) -> Iterator[Dict[str, Any]]:
    p = Path(path)
    if not p.exists():
        return
    with p.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                yield json.loads(line)
            except json.JSONDecodeError:
                continue


def write_jsonl(path: str | Path, records: Iterable[Dict[str, Any]]) -> int:
    p = Path(path)
    ensure_dir(p.parent)
    count = 0
    with p.open("w", encoding="utf-8") as f:
        for rec in records:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
            count += 1
    return count


def append_jsonl(path: str | Path, records: Iterable[Dict[str, Any]]) -> int:
    p = Path(path)
    ensure_dir(p.parent)
    count = 0
    with p.open("a", encoding="utf-8") as f:
        for rec in records:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
            count += 1
    return count


def sha256_of_file(path: str | Path) -> str:
    h = hashlib.sha256()
    with Path(path).open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def list_files_recursive(path: str | Path) -> List[Path]:
    p = Path(path)
    if not p.exists():
        return []
    return [x for x in p.rglob("*") if x.is_file()]


def rel_to(path: str | Path, base: str | Path) -> str:
    return str(Path(path).resolve().relative_to(Path(base).resolve())).replace("\\", "/")


def load_label_schema(repo_root: Path) -> Dict[str, Any]:
    schema_path = repo_root / "schemas" / "botc_label_schema_v1.json"
    return read_json(schema_path, default={})


def update_source_manifest(repo_root: Path, source_name: str, entry: Dict[str, Any]) -> Dict[str, Any]:
    manifest_path = repo_root / "data" / "raw" / "source_manifest.json"
    manifest = read_json(
        manifest_path,
        default={
            "manifest_name": "botc_source_manifest_v1",
            "generated_at": utc_now_iso(),
            "sources": {},
        },
    )
    manifest["generated_at"] = utc_now_iso()
    manifest.setdefault("sources", {})
    manifest["sources"][source_name] = entry
    write_json(manifest_path, manifest)
    return manifest


def validate_mvp_record(record: Dict[str, Any], schema: Dict[str, Any]) -> List[str]:
    errors: List[str] = []
    required = schema.get("modes", {}).get("mvp", {}).get("required_fields", [])
    enum_sets = schema.get("enum_sets", {})
    field_spec = schema.get("field_spec", {})

    for field in required:
        if field not in record:
            errors.append(f"missing required field: {field}")
            continue
        value = record.get(field)
        if value is None:
            errors.append(f"null required field: {field}")

    for field, spec in field_spec.items():
        if field not in record:
            continue
        value = record.get(field)
        ref = spec.get("values_ref")
        ftype = spec.get("type", "")
        if ref and ref in enum_sets and value is not None:
            allowed = enum_sets[ref]
            if ftype == "array<enum>":
                if not isinstance(value, list):
                    errors.append(f"field {field} should be list")
                else:
                    bad = [x for x in value if x not in allowed]
                    if bad:
                        errors.append(f"field {field} has invalid enum values: {bad}")
            elif value not in allowed:
                errors.append(f"field {field} invalid enum value: {value}")
    return errors


def tokenize(text: str) -> List[str]:
    cleaned = []
    for ch in text.lower():
        if ch.isalnum() or ch in {"_", " ", "-", "#"}:
            cleaned.append(ch)
        else:
            cleaned.append(" ")
    return [t for t in "".join(cleaned).split() if t]
