from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Dict, List
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from agent.baseline_policy import BaselinePolicy
from scripts.pipeline_utils import load_label_schema, read_json, repo_root_from, validate_mvp_record, write_json


def normalize_action_for_schema(action: Dict[str, Any], scenario: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "game_id": scenario["state_snapshot"].get("game_id", "eval_game"),
        "script": "custom",
        "phase": scenario["state_snapshot"].get("phase", "day"),
        "day_index": int(scenario["state_snapshot"].get("day_index", 1)),
        "speaker": scenario.get("speaker", "P1"),
        "audience": scenario.get("audience", "public"),
        "speaker_alive": bool(
            scenario["state_snapshot"]
            .get("players", {})
            .get(scenario.get("speaker", "P1"), {})
            .get("alive", True)
        ),
        "speaker_public_claim": scenario["state_snapshot"]
        .get("players", {})
        .get(scenario.get("speaker", "P1"), {})
        .get("public_claim", ""),
        "text": action.get("utterance", ""),
        "speech_acts": action.get("speech_acts", []),
        "targets": action.get("targets", []),
        "vote_stance": action.get("vote_stance", "unknown"),
    }


def score_action(action: Dict[str, Any], scenario: Dict[str, Any]) -> Dict[str, Any]:
    targets = action.get("targets", []) or []
    speech_acts = action.get("speech_acts", []) or []
    utter = str(action.get("utterance", ""))
    vote_stance = action.get("vote_stance", "unknown")
    players = scenario["state_snapshot"].get("players", {})

    target_consistency = 1.0
    for t in targets:
        if t not in players:
            target_consistency = 0.0
            break

    contradiction = 0.0
    if "accuse" in speech_acts and vote_stance in {"oppose", "lean_do_not_execute_target"}:
        contradiction = 1.0

    stance_consistency = 1.0
    if vote_stance == "lean_execute_target" and not targets:
        stance_consistency = 0.0

    plausibility = 1.0
    if len(utter.strip()) < 4:
        plausibility -= 0.4
    if not speech_acts:
        plausibility -= 0.3
    if scenario["audience"] == "private" and "private_pull" not in speech_acts:
        plausibility -= 0.2
    plausibility = max(0.0, min(1.0, plausibility))

    return {
        "contradiction": contradiction,
        "stance_consistency": stance_consistency,
        "target_consistency": target_consistency,
        "plausibility": plausibility,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Run offline evaluation on baseline BOTC agent scenarios.")
    parser.add_argument("--scenarios", default="eval/test_scenarios.json")
    parser.add_argument("--processed-dir", default="data/processed")
    parser.add_argument("--output", default="eval/report_latest.json")
    args = parser.parse_args()

    root = repo_root_from(__file__)
    scenarios = read_json(root / args.scenarios, default=[])
    policy = BaselinePolicy.from_processed_dir(root / args.processed_dir)
    schema = load_label_schema(root)

    results: List[Dict[str, Any]] = []
    schema_ok = 0
    contradiction_sum = 0.0
    stance_sum = 0.0
    target_sum = 0.0
    plausibility_sum = 0.0

    for scenario in scenarios:
        action = policy.decide(
            state_snapshot=scenario["state_snapshot"],
            speaker=scenario["speaker"],
            audience=scenario["audience"],
            action_type=scenario["action_type"],
            user_hint=scenario.get("user_hint", ""),
        )
        normalized = normalize_action_for_schema(action, scenario)
        schema_errors = validate_mvp_record(normalized, schema)
        if not schema_errors:
            schema_ok += 1
        scores = score_action(action, scenario)
        contradiction_sum += scores["contradiction"]
        stance_sum += scores["stance_consistency"]
        target_sum += scores["target_consistency"]
        plausibility_sum += scores["plausibility"]
        results.append(
            {
                "scenario_id": scenario["id"],
                "suite": scenario.get("suite", "core"),
                "action": action,
                "schema_errors": schema_errors,
                "scores": scores,
            }
        )

    n = len(results) or 1
    summary = {
        "scenario_count": len(results),
        "schema_validity_rate": schema_ok / n,
        "contradiction_rate": contradiction_sum / n,
        "stance_consistency_rate": stance_sum / n,
        "target_consistency_rate": target_sum / n,
        "plausibility_score": plausibility_sum / n,
    }

    report = {"summary": summary, "results": results}
    out_path = root / args.output
    out_path.parent.mkdir(parents=True, exist_ok=True)
    write_json(out_path, report)
    print(json.dumps({"output": str(out_path), **summary}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
