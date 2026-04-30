from __future__ import annotations

import json
from pathlib import Path
import sys
import shutil

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
    name="werewolf_among_us",
    default_urls=[
        "https://huggingface.co/datasets/chenxran/Werewolf-Among-Us",
    ],
    default_license="Unknown (check upstream dataset card before external redistribution)",
    description="Primary transfer corpus with persuasion-oriented social deduction utterances.",
)


def build_demo_records() -> list[dict]:
    return [
        {
            "game_id": "wau_demo_001",
            "timestamp": "00:00:12",
            "speaker": "P1",
            "text": "我先软报一下身份，2号你昨晚信息是什么？",
            "persuasion_label": "interrogation",
            "vote_target": "",
            "phase": "day",
        },
        {
            "game_id": "wau_demo_001",
            "timestamp": "00:00:27",
            "speaker": "P2",
            "text": "我偏向今天看7号，他发言太飘了。",
            "persuasion_label": "accusation",
            "vote_target": "P7",
            "phase": "day",
        },
        {
            "game_id": "wau_demo_001",
            "timestamp": "00:00:43",
            "speaker": "P7",
            "text": "先别急着票我，我愿意对跳。",
            "persuasion_label": "defense",
            "vote_target": "",
            "phase": "day",
        },
    ]


def main() -> None:
    parser = create_parser(CONFIG)
    parser.add_argument(
        "--real-hf",
        action="store_true",
        help="Fetch real dataset split json files from Hugging Face.",
    )
    parser.add_argument(
        "--hf-dataset",
        default="bolinlai/Werewolf-Among-Us",
        help="Hugging Face dataset repo id.",
    )
    args = parser.parse_args()

    repo_root = get_repo_root()
    source_dir = ensure_dir(repo_root / "data" / "raw" / CONFIG.name)

    if not args.register_only:
        copy_local_inputs(args.from_local, source_dir)
        download_inputs(args.download_url, source_dir)

        if args.real_hf:
            try:
                from huggingface_hub import hf_hub_download

                hf_dir = ensure_dir(source_dir / "hf_splits")
                split_files = [
                    "Ego4D/split/train.json",
                    "Ego4D/split/val.json",
                    "Ego4D/split/test.json",
                    "Youtube/split/train.json",
                    "Youtube/split/val.json",
                    "Youtube/split/test.json",
                ]
                fetched = []
                for rel in split_files:
                    try:
                        local = hf_hub_download(
                            repo_id=args.hf_dataset,
                            repo_type="dataset",
                            filename=rel,
                        )
                        target = hf_dir / rel.replace("/", "__")
                        shutil.copy2(local, target)
                        fetched.append(str(target))
                    except Exception:
                        continue
                (hf_dir / "download_manifest.json").write_text(
                    json.dumps(
                        {
                            "repo_id": args.hf_dataset,
                            "fetched_files": fetched,
                        },
                        ensure_ascii=False,
                        indent=2,
                    ),
                    encoding="utf-8",
                )
            except Exception as exc:
                (source_dir / "hf_error.txt").write_text(str(exc), encoding="utf-8")

        if args.demo:
            demo_path = source_dir / "demo_werewolf_among_us_utterances.jsonl"
            write_jsonl(demo_path, build_demo_records())

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
