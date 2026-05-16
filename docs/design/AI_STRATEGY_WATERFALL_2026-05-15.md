# AI Strategy Waterfall - 2026-05-15

## Goal

Make AI decisions feel more like table play by adding a bounded strategy layer above suspicion scores. This pass does not change BOTC rules, hidden information access, Unity UI, or LLM language rendering.

## Scope

Implemented in this pass:

- `evaluateGameWindow(...)`: public game-state pressure such as day, alive count, nomination scarcity, vote threshold, and whether the table is in a must-execute window.
- `buildAIStrategyContext(...)`: a per-agent strategy view that combines `agentView`, game window, target evidence counts, social risk, and legal self-perspective.
- `buildEvilWorldPlan(...)`: a lightweight evil-only plan that records a public framing target, allies under pressure, current bluff claim, and rare sacrifice window.
- Vote threshold adjustment: `decideAIVote(...)` now considers game window, evidence support, weak-evidence caution, and evil framing/deflection.
- Nomination metadata: `chooseAINomination(...)` / proposal output now carries `strategyIntent`, `gameWindow`, `strategyContext`, and `evilWorldPlan`.

Out of scope:

- No global solver or world enumeration.
- No change to rule resolution or vote counting.
- No new Unity viewmodel/action fields required in this pass.
- No online LLM decision making.

## Design

```text
AI decision call
-> buildAgentView(...) for visibility-safe evidence
-> evaluateGameWindow(...) for table pressure
-> buildAIStrategyContext(...) for per-agent decision inputs
-> rankTargets(...) / decideAIVote(...) / chooseAINomination(...)
-> existing dialogue/evidence contract renders explanation
```

## Strategy Intent Labels

- `execution-push`: high-confidence or late-window nomination intended to execute.
- `pressure-test`: weak or early nomination intended to force a defense and reveal votes.
- `information-pressure`: evidence exists, but the AI is still using the nomination to clarify information.
- `coalition-check`: enough expected support that the nomination is partly checking table alignment.
- `evil-framing`: evil AI uses public evidence chains against a non-ally.
- `protective-deflection`: evil AI chooses a non-ally partly to draw heat away from a pressured ally.
- `evil-sacrifice`: reserved for rare late-game cases where an ally is already publicly compromised.

These labels are internal metadata. Player-facing text should keep saying natural things like "先上台讲清楚" rather than exposing strategy terms.

## Fairness Guardrails

- Good AI strategy context does not include demon bluffs, true evil team lists, or hidden roles.
- Evil plans can use legal evil self/team knowledge, but regular public framing only targets non-allies unless an explicit sacrifice window is reached.
- Game window uses public procedural state: day, alive count, nominations, public rounds, stage, and vote threshold.
- Strategy deltas are bounded. Suspicion, evidence, persona, and existing rules still dominate.

## Verification

Covered by `tests/ai_agent_contracts.mjs`:

- late-game window lowers voting hesitation when evidence exists
- game window exports must-execute and vote threshold metadata
- nomination proposal carries strategy intent and game window metadata
- evil world plan protects allies and frames a non-ally
- existing hidden-information and public/private evidence contracts still pass
