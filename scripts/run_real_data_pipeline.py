from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.pipeline_utils import repo_root_from


def run_step(cmd: list[str], cwd: Path) -> None:
    print(f"[RUN] {' '.join(cmd)}")
    res = subprocess.run(cmd, cwd=str(cwd), check=False)
    if res.returncode != 0:
        raise SystemExit(res.returncode)


def resolve_python() -> str:
    py = sys.executable
    if py and "python" in Path(py).name.lower():
        return py
    found = shutil.which("python")
    if found:
        return found
    found = shutil.which("python3")
    if found:
        return found
    raise RuntimeError("No usable Python interpreter found. Install Python 3 and ensure it is available on PATH.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Run real-data ingestion + mapping + QA + training.")
    parser.add_argument("--llmafia-dataset", default="peterpeterp/mafiamessages")
    parser.add_argument("--aiwolf-dataset", default="fukufuk/aiwolf-convs")
    parser.add_argument("--wau-dataset", default="bolinlai/Werewolf-Among-Us")
    parser.add_argument("--llmafia-max-rows", type=int, default=250000)
    parser.add_argument("--aiwolf-max-rows", type=int, default=20000)
    args = parser.parse_args()

    root = repo_root_from(__file__)
    py = resolve_python()

    run_step(
        [py, "scripts/acquisition/get_werewolf_among_us.py", "--real-hf", "--hf-dataset", args.wau_dataset],
        cwd=root,
    )
    run_step(
        [
            py,
            "scripts/acquisition/get_llmafia.py",
            "--real-hf",
            "--hf-dataset",
            args.llmafia_dataset,
            "--max-rows",
            str(args.llmafia_max_rows),
        ],
        cwd=root,
    )
    run_step(
        [
            py,
            "scripts/acquisition/get_aiwolf_logs.py",
            "--real-hf",
            "--hf-dataset",
            args.aiwolf_dataset,
            "--max-rows",
            str(args.aiwolf_max_rows),
        ],
        cwd=root,
    )

    run_step([py, "scripts/mapping/parse_werewolf_among_us.py"], cwd=root)
    run_step([py, "scripts/mapping/parse_llmafia.py"], cwd=root)
    run_step([py, "scripts/mapping/parse_aiwolf.py"], cwd=root)

    run_step([py, "scripts/mapping/map_werewolf_among_us.py"], cwd=root)
    run_step([py, "scripts/mapping/map_llmafia.py"], cwd=root)
    run_step([py, "scripts/mapping/map_aiwolf.py"], cwd=root)

    run_step([py, "scripts/qa/check_schema_validity.py"], cwd=root)
    run_step([py, "scripts/qa/check_enum_consistency.py"], cwd=root)
    run_step([py, "scripts/qa/check_missingness.py"], cwd=root)
    run_step([py, "scripts/qa/check_turn_order.py"], cwd=root)
    run_step([py, "scripts/qa/check_label_statistics.py"], cwd=root)
    run_step([py, "scripts/qa/generate_dataset_qa_report.py"], cwd=root)

    run_step([py, "train/train_transfer_models.py"], cwd=root)
    run_step([py, "train/export_runtime_model.py"], cwd=root)
    print("[DONE] real-data pipeline + training + runtime export completed.")


if __name__ == "__main__":
    main()
