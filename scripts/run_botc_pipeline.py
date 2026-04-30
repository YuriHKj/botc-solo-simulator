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
    result = subprocess.run(cmd, cwd=str(cwd), check=False)
    if result.returncode != 0:
        raise SystemExit(result.returncode)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run BOTC corpus->agent baseline pipeline.")
    parser.add_argument("--demo", action="store_true", help="Generate demo raw inputs if real data is unavailable.")
    args = parser.parse_args()

    root = repo_root_from(__file__)
    py = sys.executable
    if not py or "python" not in Path(py).name.lower():
        py = shutil.which("python") or ""
    if not py:
        fallback = Path(
            r"C:\Users\11507\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
        )
        if fallback.exists():
            py = str(fallback)
    if not py:
        raise SystemExit("No Python interpreter found. Please pass with a valid Python runtime.")

    acquisition_steps = [
        ["scripts/acquisition/get_werewolf_among_us.py"],
        ["scripts/acquisition/get_llmafia.py"],
        ["scripts/acquisition/get_aiwolf_logs.py"],
    ]
    if args.demo:
        acquisition_steps = [step + ["--demo"] for step in acquisition_steps]
    else:
        acquisition_steps = [step + ["--register-only"] for step in acquisition_steps]

    for step in acquisition_steps:
        run_step([py, *step], cwd=root)

    parse_steps = [
        ["scripts/mapping/parse_werewolf_among_us.py"],
        ["scripts/mapping/parse_llmafia.py"],
        ["scripts/mapping/parse_aiwolf.py"],
    ]
    for step in parse_steps:
        run_step([py, *step], cwd=root)

    map_steps = [
        ["scripts/mapping/map_werewolf_among_us.py"],
        ["scripts/mapping/map_llmafia.py"],
        ["scripts/mapping/map_aiwolf.py"],
    ]
    for step in map_steps:
        run_step([py, *step], cwd=root)

    qa_steps = [
        ["scripts/qa/check_schema_validity.py"],
        ["scripts/qa/check_enum_consistency.py"],
        ["scripts/qa/check_missingness.py"],
        ["scripts/qa/check_turn_order.py"],
        ["scripts/qa/check_label_statistics.py"],
        ["scripts/qa/generate_dataset_qa_report.py"],
    ]
    for step in qa_steps:
        run_step([py, *step], cwd=root)

    run_step([py, "eval/run_eval.py"], cwd=root)
    print("[DONE] Pipeline completed successfully.")


if __name__ == "__main__":
    main()
