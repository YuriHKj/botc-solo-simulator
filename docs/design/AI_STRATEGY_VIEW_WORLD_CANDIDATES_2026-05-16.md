# AI Strategy View And Lightweight Worlds

Date: 2026-05-16

## Goal

This pass turns the existing AI strategy context into a named `agentStrategyView` compatibility layer and adds lightweight world candidates plus coalition vote estimates. The goal is better strategic continuity, not a truth-solving engine.

## Scope

- Add `buildAgentStrategyView(...)` as the public compatibility name for per-agent strategy decisions.
- Keep `buildAIStrategyContext(...)` backward-compatible for existing callers.
- Add `worldCandidates` to the strategy context. These are top-K attention lines derived from the agent's visible evidence, suspicion values, public pressure, and legal self-perspective.
- Add `simulateCoalitionVote(...)` to estimate whether a nomination has enough likely votes.
- Wire strategy hints into public discussion, proactive private whispers, AI-AI whispers, and nomination proposals.
- Sync the JS Core copy used by Unity.

## Non-Goals

- No full multi-world solver.
- No exhaustive BOTC world enumeration.
- No rule-result changes.
- No UI schema changes.
- No online LLM changes.

## Data Shape

`buildAgentStrategyView(state, aiPlayer, options)` returns the same usable fields as `buildAIStrategyContext(...)`, plus:

- `kind: "agent-strategy-view"`
- `baseKind: "ai-strategy-context"`
- `worldCandidates`
- `visibility`

`worldCandidates` contains:

- `kind`
- `agentId`
- `audience`
- `candidates[]`
- `topCandidateId`

Each candidate contains:

- `targetId`
- `targetName`
- `kind`
- `score`
- `weight`
- `suspicion`
- `publicEvidenceCount`
- `totalEvidenceCount`
- `reasons[]`
- `riskFlags[]`

`simulateCoalitionVote(...)` returns:

- `kind`
- `actorId`
- `nomineeId`
- `threshold`
- `expectedYesVotes`
- `likelyPasses`
- `margin`
- `voterEstimates[]`

## Fairness Guardrails

- Good AI only receives its own `agentView` and legal visible evidence.
- Evil AI can use known ally information only for evil strategy; player-facing text must not expose this metadata.
- Private evidence can shape a private strategy view, but public wording must still pass the public evidence contract.
- World candidates are attention hints. They do not assert truth.
- Coalition vote estimates do not decide rules. The existing nomination/vote resolver remains authoritative.

## Migration Plan

1. Keep old `buildAIStrategyContext(...)` callers working.
2. Add `buildAgentStrategyView(...)` for new code and tests.
3. Attach `worldCandidates` to serialized proposal metadata.
4. Use `simulateCoalitionVote(...)` in nomination proposal construction.
5. Gradually replace older claim and evil-alliance helpers with strategy-view inputs in later passes.

