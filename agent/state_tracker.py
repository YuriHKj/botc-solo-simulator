from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class PlayerState:
    player_id: str
    alive: bool = True
    alignment: str = "unknown"
    private_role: str = "unknown"
    public_claim: str = ""
    sober_drunk: str = "unknown"
    healthy_poisoned: str = "unknown"
    sane_mad: str = "unknown"
    dead_vote_available: bool = True
    dead_vote_spent: bool = False


@dataclass
class SocialDeductionStateTracker:
    game_id: str
    players: Dict[str, PlayerState] = field(default_factory=dict)
    day_index: int = 0
    phase: str = "setup"
    claims_by_player: Dict[str, List[str]] = field(default_factory=lambda: defaultdict(list))
    accusations: Dict[str, Counter] = field(default_factory=lambda: defaultdict(Counter))
    defenses: Dict[str, Counter] = field(default_factory=lambda: defaultdict(Counter))
    vote_history: List[Dict[str, Any]] = field(default_factory=list)
    nominations: List[Dict[str, Any]] = field(default_factory=list)
    storyteller_signals: List[Dict[str, Any]] = field(default_factory=list)
    utterance_history: List[Dict[str, Any]] = field(default_factory=list)

    def ensure_player(self, player_id: str) -> PlayerState:
        if player_id not in self.players:
            self.players[player_id] = PlayerState(player_id=player_id)
        return self.players[player_id]

    def set_player_role(self, player_id: str, private_role: str, alignment: str = "unknown") -> None:
        p = self.ensure_player(player_id)
        p.private_role = private_role
        p.alignment = alignment

    def set_player_state_flags(
        self,
        player_id: str,
        *,
        sober_drunk: Optional[str] = None,
        healthy_poisoned: Optional[str] = None,
        sane_mad: Optional[str] = None,
    ) -> None:
        p = self.ensure_player(player_id)
        if sober_drunk is not None:
            p.sober_drunk = sober_drunk
        if healthy_poisoned is not None:
            p.healthy_poisoned = healthy_poisoned
        if sane_mad is not None:
            p.sane_mad = sane_mad

    def mark_dead(self, player_id: str) -> None:
        p = self.ensure_player(player_id)
        p.alive = False

    def spend_dead_vote(self, player_id: str) -> None:
        p = self.ensure_player(player_id)
        p.dead_vote_available = False
        p.dead_vote_spent = True

    def apply_utterance(self, utterance: Dict[str, Any]) -> None:
        speaker = str(utterance.get("speaker", "unknown"))
        self.ensure_player(speaker)
        self.day_index = int(utterance.get("day_index", self.day_index) or self.day_index)
        self.phase = str(utterance.get("phase", self.phase))
        self.utterance_history.append(utterance)

        claim = str(utterance.get("speaker_public_claim", "") or "").strip()
        if claim:
            self.players[speaker].public_claim = claim
            if claim not in self.claims_by_player[speaker]:
                self.claims_by_player[speaker].append(claim)

        acts = utterance.get("speech_acts", []) or []
        targets = utterance.get("targets", []) or []
        for tgt in targets:
            self.ensure_player(str(tgt))
        if "accuse" in acts or "soft_accuse" in acts:
            for tgt in targets:
                self.accusations[speaker][str(tgt)] += 1
        if "defend" in acts:
            for tgt in targets:
                self.defenses[speaker][str(tgt)] += 1

        vote_stance = utterance.get("vote_stance")
        if vote_stance and vote_stance != "unknown":
            self.vote_history.append(
                {
                    "day_index": self.day_index,
                    "phase": self.phase,
                    "speaker": speaker,
                    "vote_stance": vote_stance,
                    "targets": targets,
                }
            )

    def apply_event(self, event: Dict[str, Any]) -> None:
        event_type = str(event.get("event_type", "")).lower()
        actor = str(event.get("actor", "system"))
        target = str(event.get("target", ""))
        if actor and actor != "system":
            self.ensure_player(actor)
        if target:
            self.ensure_player(target)
        if event_type in {"execute", "killed", "death"} and target:
            self.mark_dead(target)
        if event_type == "vote":
            self.vote_history.append(
                {
                    "day_index": int(event.get("day_index", self.day_index)),
                    "phase": str(event.get("phase", self.phase)),
                    "speaker": actor,
                    "vote_stance": "support",
                    "targets": [target] if target else [],
                }
            )
        if event_type == "nomination":
            self.nominations.append(event)
        if event_type == "storyteller_signal":
            self.storyteller_signals.append(event)

    def suspicion_scores(self) -> Dict[str, float]:
        scores = defaultdict(float)
        for _, counter in self.accusations.items():
            for target, cnt in counter.items():
                scores[target] += float(cnt)
        for _, counter in self.defenses.items():
            for target, cnt in counter.items():
                scores[target] -= 0.5 * float(cnt)
        return dict(scores)

    def to_snapshot(self) -> Dict[str, Any]:
        return {
            "game_id": self.game_id,
            "day_index": self.day_index,
            "phase": self.phase,
            "players": {
                pid: {
                    "alive": p.alive,
                    "alignment": p.alignment,
                    "private_role": p.private_role,
                    "public_claim": p.public_claim,
                    "sober_drunk": p.sober_drunk,
                    "healthy_poisoned": p.healthy_poisoned,
                    "sane_mad": p.sane_mad,
                    "dead_vote_available": p.dead_vote_available,
                    "dead_vote_spent": p.dead_vote_spent,
                }
                for pid, p in self.players.items()
            },
            "claims_by_player": dict(self.claims_by_player),
            "accusations": {k: dict(v) for k, v in self.accusations.items()},
            "defenses": {k: dict(v) for k, v in self.defenses.items()},
            "vote_history": self.vote_history,
            "nominations": self.nominations,
            "storyteller_signals": self.storyteller_signals,
            "suspicion_scores": self.suspicion_scores(),
        }
