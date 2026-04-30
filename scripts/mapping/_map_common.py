from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Dict, Iterable, List, Tuple

from scripts.pipeline_utils import (
    ensure_dir,
    iter_jsonl,
    load_label_schema,
    repo_root_from,
    validate_mvp_record,
    write_jsonl,
)


PLAYER_PATTERN = re.compile(r"\bP(\d+)\b|(\d+)号")


def repo_root() -> Path:
    return repo_root_from(__file__)


def extract_targets(text: str) -> List[str]:
    targets = []
    for m in PLAYER_PATTERN.finditer(text or ""):
        if m.group(1):
            targets.append(f"P{m.group(1)}")
        elif m.group(2):
            targets.append(f"P{m.group(2)}")
    dedup = []
    seen = set()
    for t in targets:
        if t not in seen:
            seen.add(t)
            dedup.append(t)
    return dedup


def infer_speech_acts(text: str) -> List[str]:
    t = (text or "").lower()
    acts: List[str] = []
    if any(k in t for k in ["我是", "i am", "i'm", "报身份", "claim"]):
        acts.append("hard_claim")
    if any(k in t for k in ["觉得", "maybe", "可能", "倾向", "lean"]):
        acts.append("soft_claim")
    if any(k in t for k in ["你为什么", "why", "解释", "请说", "信息是什么", "?"]):
        acts.append("probe")
    if any(k in t for k in ["票", "vote", "处决", "execute", "投"]):
        acts.append("coordinate_vote")
    if any(k in t for k in ["像狼", "可疑", "怀疑", "accuse", "sus"]):
        acts.append("accuse")
    if any(k in t for k in ["别票", "别处决", "不是我", "defend"]):
        acts.append("defend")
    if any(k in t for k in ["先不说", "不方便说", "暂不公开", "not reveal"]):
        acts.append("withhold_info")
    if not acts:
        acts.append("table_read")
    return sorted(set(acts))


def infer_vote_stance(text: str) -> str:
    t = (text or "").lower()
    if any(k in t for k in ["vote", "处决", "票", "投他", "execute"]):
        if any(k in t for k in ["不要", "别", "不该", "not", "don't"]):
            return "lean_do_not_execute_target"
        return "lean_execute_target"
    if any(k in t for k in ["支持", "赞成", "support"]):
        return "support"
    if any(k in t for k in ["反对", "oppose"]):
        return "oppose"
    if any(k in t for k in ["弃权", "abstain"]):
        return "abstain_signal"
    return "undecided"


def infer_public_claim(text: str) -> str:
    if not text:
        return ""
    m = re.search(r"(我是|I am|I'm)\s*([A-Za-z\u4e00-\u9fa5\- ]{1,24})", text, re.IGNORECASE)
    if m:
        return m.group(2).strip()
    return ""


def base_record_from_event(event: Dict[str, Any], script_value: str) -> Dict[str, Any]:
    text = str(event.get("text") or "")
    targets = extract_targets(text)
    speech_acts = infer_speech_acts(text)
    vote_stance = infer_vote_stance(text)
    public_claim = infer_public_claim(text)
    record = {
        "game_id": str(event.get("game_id") or "unknown_game"),
        "script": script_value,
        "phase": str(event.get("phase") or "unknown"),
        "day_index": int(event.get("day_index") or 0),
        "utterance_id": f"{event.get('game_id','g')}_{event.get('turn_index',0)}",
        "speaker": str(event.get("speaker") or "unknown"),
        "audience": str(event.get("audience") or "public"),
        "speaker_alive": True,
        "speaker_private_role": "unknown",
        "speaker_alignment": "unknown",
        "speaker_public_claim": public_claim,
        "speaker_state": {
            "alive_dead": "unknown",
            "sober_drunk": "unknown",
            "healthy_poisoned": "unknown",
            "sane_mad": "unknown",
        },
        "text": text,
        "speech_acts": speech_acts,
        "targets": targets,
        "epistemic_strength": 1,
        "intent": "unknown",
        "truth_status_objective": "unknown",
        "truth_status_subjective": "unknown",
        "evidence_source": "unknown",
        "vote_stance": vote_stance,
        "nomination_related": bool("nom" in str(event.get("phase", "")).lower()),
        "field_provenance": {
            "speech_acts": "heuristic_text_rules",
            "targets": "regex_text_extraction",
            "vote_stance": "heuristic_text_rules",
            "speaker_public_claim": "regex_text_extraction",
            "speaker_alive": "default_assumption",
        },
        "source_metadata": {
            "source": event.get("source"),
            "turn_index": event.get("turn_index"),
            "timestamp": event.get("timestamp"),
            "raw_metadata": event.get("raw_metadata", {}),
        },
    }
    return record


def map_events_to_records(events: Iterable[Dict[str, Any]], script_value: str) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    root = repo_root()
    schema = load_label_schema(root)
    out: List[Dict[str, Any]] = []
    errors: List[Dict[str, Any]] = []
    for idx, event in enumerate(events):
        record = base_record_from_event(event, script_value=script_value)
        rec_errors = validate_mvp_record(record, schema)
        if rec_errors:
            errors.append({"index": idx, "errors": rec_errors, "record": record})
        out.append(record)
    return out, errors


def write_mapped_output(source: str, records: List[Dict[str, Any]], errors: List[Dict[str, Any]]) -> Dict[str, Any]:
    root = repo_root()
    out_path = root / "data" / "processed" / f"{source}.jsonl"
    ensure_dir(out_path.parent)
    write_jsonl(out_path, records)
    summary = {
        "source": source,
        "record_count": len(records),
        "validation_error_count": len(errors),
        "validation_error_examples": errors[:10],
        "output_path": str(out_path),
    }
    summary_path = root / "data" / "processed" / f"{source}.summary.json"
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    return summary


def load_interim_events(source: str) -> List[Dict[str, Any]]:
    root = repo_root()
    path = root / "data" / "interim" / source / "events.jsonl"
    return list(iter_jsonl(path))
