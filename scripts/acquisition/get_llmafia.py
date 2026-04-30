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
    name="llmafia",
    default_urls=[
        "https://huggingface.co/datasets/92MING/LLMafia",
        "https://github.com/boluoweifenda/LLMafia",
    ],
    default_license="Unknown (verify dataset card and repo license for reuse constraints)",
    description="Async/group-chat social deduction corpus used as timing and pacing supplement.",
)


def build_demo_messages() -> list[dict]:
    return [
        {
            "game_id": "llmafia_demo_001",
            "phase": "day",
            "speaker": "P3",
            "audience": "public",
            "timestamp": "2026-04-01T10:00:00Z",
            "text": "我倾向让5号先解释昨晚的投票理由。",
        },
        {
            "game_id": "llmafia_demo_001",
            "phase": "night",
            "speaker": "P8",
            "audience": "private",
            "timestamp": "2026-04-01T10:03:00Z",
            "text": "今晚别急着刀3号，先制造他是好人的印象。",
        },
    ]


def build_demo_votes() -> list[dict]:
    return [
        {
            "game_id": "llmafia_demo_001",
            "phase": "day",
            "day_index": 1,
            "voter": "P3",
            "target": "P5",
            "timestamp": "2026-04-01T10:04:00Z",
        }
    ]


def main() -> None:
    parser = create_parser(CONFIG)
    parser.add_argument(
        "--real-hf",
        action="store_true",
        help="Fetch real dataset from Hugging Face (fallback source if official LLMafia dataset is unavailable).",
    )
    parser.add_argument(
        "--hf-dataset",
        default="peterpeterp/mafiamessages",
        help="Hugging Face dataset repo id.",
    )
    parser.add_argument(
        "--max-rows",
        type=int,
        default=200000,
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
                        text = str(row.get("text") or row.get("message") or "").strip()
                        target = str(row.get("target") or row.get("label") or "")
                        rows.append(
                            {
                                "game_id": f"{args.hf_dataset.replace('/', '_')}_{split}",
                                "phase": "day",
                                "speaker": "unknown",
                                "audience": "public",
                                "timestamp": None,
                                "text": text,
                                "target": target,
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
            write_jsonl(source_dir / "demo_llmafia_messages.jsonl", build_demo_messages())
            write_jsonl(source_dir / "demo_llmafia_votes.jsonl", build_demo_votes())

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
