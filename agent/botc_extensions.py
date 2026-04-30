from __future__ import annotations

from typing import Any, Dict, List


def speaker_status(snapshot: Dict[str, Any], speaker: str) -> Dict[str, Any]:
    return snapshot.get("players", {}).get(speaker, {})


def apply_botc_constraints(snapshot: Dict[str, Any], speaker: str, action: Dict[str, Any]) -> Dict[str, Any]:
    status = speaker_status(snapshot, speaker)
    updated = dict(action)
    acts = list(updated.get("speech_acts", []))
    text = str(updated.get("utterance", ""))

    alive = bool(status.get("alive", True))
    if not alive and status.get("dead_vote_available") is False:
        if updated.get("vote_stance") in {"support", "lean_execute_target"}:
            updated["vote_stance"] = "abstain_signal"
        if "self_preservation" not in acts:
            acts.append("self_preservation")

    if status.get("sober_drunk") == "drunk" or status.get("healthy_poisoned") == "poisoned":
        updated["epistemic_strength"] = min(int(updated.get("epistemic_strength", 2)), 1)
        if "hedge" not in acts:
            acts.append("hedge")
        if "可能" not in text and "也许" not in text and "maybe" not in text.lower():
            text = f"也许我记错了，但{text}" if text else "也许我记错了，先给个保守判断。"

    if status.get("sane_mad") == "mad":
        if "mad_play" not in acts:
            acts.append("mad_play")
        claim = status.get("public_claim")
        if claim and claim not in text:
            text = f"{text}（继续坚持我的公开身份：{claim}）".strip()

    if snapshot.get("storyteller_signals"):
        updated.setdefault("metadata", {})
        updated["metadata"]["storyteller_uncertainty"] = True
        if "meta_comment" not in acts:
            acts.append("meta_comment")

    updated["speech_acts"] = sorted(set(acts))
    updated["utterance"] = text
    return updated


def estimate_nomination_target(snapshot: Dict[str, Any], speaker: str) -> str | None:
    scores = snapshot.get("suspicion_scores", {})
    if not scores:
        return None
    ordered = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
    for pid, _score in ordered:
        if pid == speaker:
            continue
        if snapshot.get("players", {}).get(pid, {}).get("alive", True):
            return pid
    return None
