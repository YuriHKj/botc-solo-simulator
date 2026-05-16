# AI Evil World Plan Context - 2026-05-15

## Goal

Upgrade `evilWorldPlan` from a single-turn framing hint into a flexible multi-day context. The plan should help evil AI maintain a believable fake world without becoming a fixed script.

## Principles

- Flexible inertia, not a railroad.
- Keep a framing target when the table evidence is still close.
- Pivot when the old target is invalid, already processed, a new public opportunity is much stronger, an ally is under pressure, or the game is near endgame.
- Store structured context for tests and future UI/debug views, but keep player-facing speech natural.
- Never expose evil-only context to good AI.

## Data Shape

`state.aiDialogue.evilWorldPlansByAgentId[agentId]` now uses version 2:

- `framingTargetId`: current public target the evil AI wants the table to pressure.
- `secondaryFrameTargetId`: backup target if the primary line stalls.
- `previousFramingTargetId`: previous target when still relevant.
- `protectAllyIds`: known allies whose public pressure should be reduced.
- `sacrificeAllyId`: rare late-game compromised ally sacrifice option.
- `continuity`: `new`, `hold`, `soft-pivot`, or `reset`.
- `pivotReason`: `target-invalid`, `new-public-pressure`, `protect-ally`, `late-window`, or empty.
- `commitment`: bounded 0-1 inertia score.
- `narrativeAnchors[]`: small structured anchors such as `cover-claim`, `frame-target`, `backup-frame`, `protect-ally`, `pivot-reason`.
- `history[]`: bounded recent plan snapshots.

## Integration

- `buildEvilWorldPlan(...)` owns plan refresh and persistence.
- `evilWorldPlanTargetBias(...)` centralizes ranking pressure:
  - current framing target receives a small positive bias based on commitment
  - backup target receives a smaller positive bias
  - protected allies receive a negative bias unless they are the explicit sacrifice target
- `buildAIStrategyContext(...)` exposes `evilPlanContextLine`, but this remains internal metadata for now.
- Existing public/private speech benefits indirectly through target ranking and strategy intent; no hard-coded script line is forced into every utterance.

## Non-Rigidity Guardrails

- Commitment is capped and can decay on pivot.
- Old target is held only if it remains close enough to the best new target.
- Urgent windows lower the pivot margin.
- Ally pressure lowers the pivot margin.
- History is bounded and deduplicated by state snapshot key.

## Tests

Contract tests should cover:

- holding a previous framing target when the new target is only slightly better
- pivoting when the new target is much stronger
- protecting an ally by giving them negative ranking bias
- preserving narrative anchors/history without leaking them into good-agent views
