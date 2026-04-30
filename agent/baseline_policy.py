from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

from agent.botc_extensions import apply_botc_constraints, estimate_nomination_target
from agent.prompt_builder import build_agent_prompt
from agent.retriever import SimpleRetriever


DEFAULT_PUBLIC_TEMPLATES = [
    "我目前最怀疑{target}，建议今天重点盘他。",
    "{target}这轮发言与票型不一致，我倾向处决。",
    "我先不全报信息，但我会把票压在{target}。",
]

DEFAULT_PRIVATE_TEMPLATES = [
    "我私下告诉你，我更怀疑{target}，但公聊会先观察。",
    "先别公开站边，我觉得{target}的行为很怪。",
    "如果你有信息能对上{target}，我们白天配合推动。",
]


@dataclass
class BaselinePolicy:
    retriever: Optional[SimpleRetriever] = None

    @classmethod
    def from_processed_dir(cls, processed_dir: Path) -> "BaselinePolicy":
        paths = sorted(processed_dir.glob("*.jsonl"))
        return cls(retriever=SimpleRetriever(paths))

    def decide(
        self,
        *,
        state_snapshot: Dict[str, Any],
        speaker: str,
        audience: str = "public",
        action_type: str = "public_statement",
        user_hint: str = "",
    ) -> Dict[str, Any]:
        target = self._pick_target(state_snapshot=state_snapshot, speaker=speaker)
        retrieved = self._retrieve_examples(
            query=user_hint or f"{speaker} {action_type} {target or ''}",
            audience=audience,
            phase=state_snapshot.get("phase"),
        )
        prompt = build_agent_prompt(
            state_snapshot=state_snapshot,
            speaker=speaker,
            audience=audience,
            action_type=action_type,
            retrieved_examples=retrieved,
            user_hint=user_hint,
        )
        action = self._build_action(
            state_snapshot=state_snapshot,
            speaker=speaker,
            audience=audience,
            action_type=action_type,
            target=target,
            user_hint=user_hint,
        )
        action["prompt_debug"] = prompt
        action["retrieval_hits"] = retrieved[:3]
        action = apply_botc_constraints(state_snapshot, speaker, action)
        return action

    def _retrieve_examples(self, query: str, audience: str, phase: str) -> List[Dict[str, Any]]:
        if not self.retriever:
            return []
        hits = self.retriever.retrieve(query, top_k=5, filters={"audience": audience, "phase": phase})
        return [h.record for h in hits]

    def _pick_target(self, *, state_snapshot: Dict[str, Any], speaker: str) -> Optional[str]:
        scores = state_snapshot.get("suspicion_scores", {})
        alive_map = {k: v.get("alive", True) for k, v in state_snapshot.get("players", {}).items()}
        ordered = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
        for pid, _ in ordered:
            if pid == speaker:
                continue
            if alive_map.get(pid, True):
                return pid
        for pid, alive in alive_map.items():
            if pid != speaker and alive:
                return pid
        return None

    def _build_action(
        self,
        *,
        state_snapshot: Dict[str, Any],
        speaker: str,
        audience: str,
        action_type: str,
        target: Optional[str],
        user_hint: str,
    ) -> Dict[str, Any]:
        target = target or "P1"
        if audience == "private":
            template = DEFAULT_PRIVATE_TEMPLATES[hash((speaker, target, action_type)) % len(DEFAULT_PRIVATE_TEMPLATES)]
        else:
            template = DEFAULT_PUBLIC_TEMPLATES[hash((speaker, target, action_type)) % len(DEFAULT_PUBLIC_TEMPLATES)]
        utterance = template.format(target=target)
        if user_hint:
            utterance = f"{utterance} {user_hint}"

        vote_stance = "lean_execute_target" if target else "undecided"
        speech_acts = ["table_read", "coordinate_vote"] if target else ["table_read"]
        if audience == "private":
            speech_acts.append("private_pull")

        nomination_target = None
        if action_type in {"nomination_recommendation", "vote_push"}:
            nomination_target = estimate_nomination_target(state_snapshot, speaker)

        return {
            "speaker": speaker,
            "audience": audience,
            "action_type": action_type,
            "utterance": utterance,
            "speech_acts": sorted(set(speech_acts)),
            "targets": [target] if target else [],
            "vote_stance": vote_stance,
            "nomination_target": nomination_target,
            "epistemic_strength": 2,
        }
