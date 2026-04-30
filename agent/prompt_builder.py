from __future__ import annotations

from typing import Any, Dict, List


def _format_examples(examples: List[Dict[str, Any]]) -> str:
    lines = []
    for i, ex in enumerate(examples, start=1):
        lines.append(
            f"[{i}] speaker={ex.get('speaker')} phase={ex.get('phase')} acts={ex.get('speech_acts')} vote={ex.get('vote_stance')} text={ex.get('text')}"
        )
    return "\n".join(lines) if lines else "(no examples)"


def build_agent_prompt(
    *,
    state_snapshot: Dict[str, Any],
    speaker: str,
    audience: str,
    action_type: str,
    retrieved_examples: List[Dict[str, Any]],
    user_hint: str = "",
) -> str:
    suspicion = state_snapshot.get("suspicion_scores", {})
    top_sus = sorted(suspicion.items(), key=lambda kv: kv[1], reverse=True)[:3]
    top_sus_text = ", ".join([f"{k}:{v:.1f}" for k, v in top_sus]) if top_sus else "none"
    return f"""You are a BOTC-style social deduction player.
Return a structured output and keep statement strategically plausible.

Current state:
- game_id: {state_snapshot.get('game_id')}
- day_index: {state_snapshot.get('day_index')}
- phase: {state_snapshot.get('phase')}
- speaker: {speaker}
- audience: {audience}
- action_type: {action_type}
- top_suspicion: {top_sus_text}

Role/claim context:
{state_snapshot.get('players', {}).get(speaker, {})}

User hint:
{user_hint or "(none)"}

Retrieved reference utterances:
{_format_examples(retrieved_examples)}

Please produce:
1) one utterance sentence/paragraph
2) speech_acts list
3) targets list
4) vote_stance
5) optional nomination_target
"""
