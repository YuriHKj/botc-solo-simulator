from __future__ import annotations

import argparse
import json
import shutil
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List

from scripts.pipeline_utils import (
    ensure_dir,
    list_files_recursive,
    rel_to,
    repo_root_from,
    sha256_of_file,
    update_source_manifest,
    utc_now_iso,
    write_json,
)


@dataclass
class SourceConfig:
    name: str
    default_urls: List[str]
    default_license: str
    description: str


def create_parser(config: SourceConfig) -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=f"Acquire/register raw data for {config.name}."
    )
    parser.add_argument(
        "--from-local",
        action="append",
        default=[],
        help="Local file/folder to copy into raw source folder (can pass multiple).",
    )
    parser.add_argument(
        "--download-url",
        action="append",
        default=[],
        help="URL to download into raw source folder (can pass multiple).",
    )
    parser.add_argument(
        "--register-only",
        action="store_true",
        help="Only write manifest entry, do not copy/download data.",
    )
    parser.add_argument(
        "--demo",
        action="store_true",
        help="Generate a tiny demo raw dataset when real source is unavailable.",
    )
    parser.add_argument(
        "--license",
        default=config.default_license,
        help="License string recorded in source_manifest.json.",
    )
    parser.add_argument(
        "--note",
        default="",
        help="Optional operator note written to source metadata.",
    )
    return parser


def copy_local_inputs(inputs: Iterable[str], dest_dir: Path) -> List[Path]:
    copied: List[Path] = []
    files_dir = ensure_dir(dest_dir / "files")
    for src in inputs:
        src_path = Path(src).expanduser().resolve()
        if not src_path.exists():
            continue
        target = files_dir / src_path.name
        if src_path.is_dir():
            if target.exists():
                shutil.rmtree(target, ignore_errors=True)
            shutil.copytree(src_path, target)
        else:
            shutil.copy2(src_path, target)
        copied.append(target)
    return copied


def download_inputs(urls: Iterable[str], dest_dir: Path) -> List[Path]:
    saved: List[Path] = []
    dl_dir = ensure_dir(dest_dir / "downloads")
    for url in urls:
        filename = url.rstrip("/").split("/")[-1] or "download.bin"
        target = dl_dir / filename
        try:
            urllib.request.urlretrieve(url, target)
            saved.append(target)
        except Exception:
            continue
    return saved


def finalize_source_metadata(
    repo_root: Path,
    config: SourceConfig,
    source_dir: Path,
    urls: List[str],
    license_str: str,
    note: str = "",
) -> Dict[str, Any]:
    files = list_files_recursive(source_dir)
    file_entries = []
    for file_path in files:
        file_entries.append(
            {
                "path": rel_to(file_path, repo_root),
                "size_bytes": file_path.stat().st_size,
                "sha256": sha256_of_file(file_path),
            }
        )

    source_info = {
        "source_name": config.name,
        "description": config.description,
        "source_urls": urls or config.default_urls,
        "license": license_str,
        "acquired_at": utc_now_iso(),
        "raw_root": rel_to(source_dir, repo_root),
        "files": file_entries,
        "note": note,
    }
    write_json(source_dir / "source_info.json", source_info)

    manifest_entry = {
        "description": config.description,
        "source_urls": source_info["source_urls"],
        "license": license_str,
        "acquired_at": source_info["acquired_at"],
        "raw_root": source_info["raw_root"],
        "file_count": len(file_entries),
        "files": file_entries,
        "note": note,
    }
    update_source_manifest(repo_root, config.name, manifest_entry)
    return source_info


def get_repo_root() -> Path:
    return repo_root_from(__file__)
