from __future__ import annotations

import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.acquisition._acquisition_common import (
    SourceConfig,
    copy_local_inputs,
    create_parser,
    download_inputs,
    finalize_source_metadata,
    get_repo_root,
)
from scripts.pipeline_utils import ensure_dir, write_jsonl


CONFIG = SourceConfig(
    name="aiwolf",
    default_urls=[
        "https://aiwolf.org/en/resource",
    ],
    default_license="Unknown (check competition log terms before reuse)",
    description="Structured werewolf logs used for event/state-machine modeling.",
)


def build_demo_events() -> list[dict]:
    return [
        {
            "game_id": "aiwolf_demo_001",
            "day": 1,
            "phase": "day",
            "event_type": "talk",
            "actor": "P2",
            "text": "I estimate P5 is likely werewolf.",
            "target": "P5",
            "timestamp": "turn_01",
        },
        {
            "game_id": "aiwolf_demo_001",
            "day": 1,
            "phase": "day",
            "event_type": "vote",
            "actor": "P2",
            "target": "P5",
            "text": "",
            "timestamp": "turn_09",
        },
        {
            "game_id": "aiwolf_demo_001",
            "day": 1,
            "phase": "execution",
            "event_type": "execute",
            "actor": "system",
            "target": "P5",
            "text": "",
            "timestamp": "turn_10",
        },
    ]


def main() -> None:
    parser = create_parser(CONFIG)
    parser.add_argument(
        "--real-hf",
        action="store_true",
        help="Fetch real AIWolf-related corpus from Hugging Face.",
    )
    parser.add_argument(
        "--hf-dataset",
        default="fukufuk/aiwolf-convs",
        help="Hugging Face dataset repo id.",
    )
    parser.add_argument(
        "--max-rows",
        type=int,
        default=100000,
        help="Maximum rows per split for raw export.",
    )
    args = parser.parse_args()

    repo_root = get_repo_root()
    source_dir = ensure_dir(repo_root / "data" / "raw" / CONFIG.name)

    if not args.register_only:
        copy_local_inputs(args.from_local, source_dir)
        download_inputs(args.download_url, source_dir)

        if args.real_hf:
            try:
                from datasets import load_dataset

                hf_dir = ensure_dir(source_dir / "hf_export")
                exported = []
                loaded = load_dataset(args.hf_dataset)
                for split, ds in loaded.items():
                    rows = []
                    limit = min(len(ds), max(args.max_rows, 1))
                    for i in range(limit):
                        row = ds[i]
                        text = str(row.get("script") or row.get("summary") or row.get("text") or "").strip()
                        rows.append(
                            {
                                "game_id": f"{args.hf_dataset.replace('/', '_')}_{split}",
                                "day": 1,
                                "phase": "day",
                                "event_type": "talk",
                                "actor": "P1",
                                "target": "",
                                "text": text,
                                "timestamp": None,
                                "raw": row,
                            }
                        )
                    out_path = hf_dir / f"{split}.jsonl"
                    write_jsonl(out_path, rows)
                    exported.append({"split": split, "rows": len(rows), "path": str(out_path)})

                (hf_dir / "export_manifest.json").write_text(
                    json.dumps(
                        {
                            "repo_id": args.hf_dataset,
                            "max_rows": args.max_rows,
                            "exports": exported,
                        },
                        ensure_ascii=False,
                        indent=2,
                    ),
                    encoding="utf-8",
                )
            except Exception as exc:
                (source_dir / "hf_error.txt").write_text(str(exc), encoding="utf-8")

        if args.demo:
            write_jsonl(source_dir / "demo_aiwolf_events.jsonl", build_demo_events())

    source_urls = list(args.download_url or [])
    if args.real_hf:
        source_urls.append(f"https://huggingface.co/datasets/{args.hf_dataset}")

    source_info = finalize_source_metadata(
        repo_root=repo_root,
        config=CONFIG,
        source_dir=source_dir,
        urls=source_urls,
        license_str=args.license,
        note=args.note,
    )
    print(json.dumps(source_info, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
