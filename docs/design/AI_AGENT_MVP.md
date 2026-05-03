# AI Agent MVP

## Goal

This MVP moves AI reasoning away from direct global truth access and toward per-player perspective state.
It is intentionally incremental: existing dialogue heuristics remain in place, but they now read several key
signals through an agent-visibility layer.

## Implemented

- `state.aiAgents[playerId]` stores per-AI memory:
  - own role/team knowledge
  - known evil allies from first-night recognition
  - demon-only bluff role IDs
  - private observations
  - public/private claim maps
- First-night evil recognition writes to AI agents:
  - demon learns minion seats and demon bluffs
  - minions learn demon seat and other minion seats
  - good AI receives no evil-team knowledge
- Private claims and private whispers no longer behave as global information:
  - private claims include `private: true` and `viewerId`
  - claim scoring now reads each AI's local `claim` observations
  - speech evidence shown in summaries still uses `getVisibleSpeeches(...)`
- Core social events are now mirrored into per-agent observations:
  - public chat -> `public-speech`, visible to every AI
  - private chat -> `private-whisper`, visible only to the participating AI
  - night/setup information -> `night-info`, visible only to the recipient AI
  - nominations -> `nomination`, visible to every AI
  - vote results -> `vote`, visible to every AI and including each AI's own vote when present
  - execution/night death results -> `execution` / `night-death`, visible to every AI
- Evil coordination uses known allies, not raw `player.team`.
- The belief refresh pass now consumes each AI's own observations for claims, public speech, private whispers,
  nominations, and votes.
- AI insight rows snapshot and restore player belief fields, so rendering the recap no longer mutates suspicion.
- Suspicion normalization no longer stretches tiny differences into `92%` certainty.

## Still Simplified

- Suspicion is still recomputed from agent observation history rather than being a fully incremental Bayesian memory.
- Good AI can be influenced by false information only when that false information is represented as visible claims,
  private whispers, or future structured night-info observations.
- Private dialogue language generation still uses templates; the perspective layer constrains information access,
  but does not yet make every AI a fully independent conversational planner.
- Evil lying is basic: minions without demon bluffs pick plausible good roles, while the demon can use known bluffs.

## Recommended Next Step

Deepen the observation-driven belief model:

1. Add an incremental `updateAgentBeliefsFromObservation(...)` pass instead of full recomputation.
2. Store normalized evidence entries with source, reliability, target, and polarity.
3. Split claim, speech, vote, nomination, and night information into typed evidence records.
4. Generate dialogue from `agent.observations` and `agent.beliefs`, not directly from global events.
5. Teach dialogue generation to explicitly cite confirmed execution/death observations when appropriate.
