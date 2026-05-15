# AI Autonomous Thinking Loop

Date: 2026-05-13

## Goal

Make each AI agent feel like it is thinking for itself during a single BOTC game, without adding an online LLM and without giving it storyteller truth.

The target is not perfect play. The target is believable play:

- notices public and private events from its own viewpoint
- keeps a limited memory of claims, whispers, votes, deaths, and night information
- chooses what it cares about next
- decides whether to claim, challenge, whisper, nominate, defend, or hold
- explains itself with information it could actually know
- can be wrong because information is polluted, incomplete, or socially risky

## Proposed Loop

Each AI turn should follow the same loop:

1. Perceive
   - Build `agentView` from visible public events, private conversations involving this AI, night information, and its own role/team knowledge.
   - Never pass raw global state to dialogue or decision functions when an agent-view path exists.

2. Update Beliefs
   - Refresh suspicion, source trust, statement memory, and the per-agent knowledge graph.
   - Keep contamination metadata on drunk, poisoned, private-claim, and secondhand information.

3. Deliberate
   - Produce a small `thoughtFrame`:
     - `primaryConcernId`
     - `secondaryConcernId`
     - `selfDisclosureNeed`
     - `socialRisk`
     - `nominationReadiness`
     - `questionToAsk`
     - `evidenceReasons`
   - Limit the frame to top 2-3 chains, so the AI remains player-like instead of solver-like.

4. Choose Act
   - Pick one action act based on phase and clock:
     - public claim
     - public pressure
     - public defense
     - private whisper
     - AI-AI whisper
     - nominate
     - vote stance
     - hold / pass
   - Persona modifies thresholds and style, not truth access.

5. Render Speech
   - Convert the act into human table-talk.
   - Require 1 visible reason when making a pressure claim, but allow "weak read" language when evidence is thin.
   - Ban internal terms in surfaced speech, such as evidence contract, suspicion score, contamination risk, or debug labels.

6. Reflect
   - Write a compact statement memory entry:
     - what it claimed
     - who it pressured
     - why
     - whether it promised a vote or nomination
   - Future speech should stay consistent unless new evidence explains the shift.

## Current Implementation Status

Already present:

- per-agent evidence book and belief trail
- statement memory for public/private speech
- source trust updates
- lightweight knowledge graph pressure
- public/private evidence contracts
- conversation clock for public discussion
- AI proactive whisper, AI-AI whisper, nomination window, debate lines
- final speech polish layer and dialogue smoke report

Added in this pass:

- public claim visibility: if JS Core records an AI public claim, the public speech line now visibly says the role
- public claim contract test: public claim events must be matched by visible speech text
- first JS Core `thoughtFrame` implementation:
  - stored at `state.aiDialogue.thoughtFramesByAgentId[agentId]`
  - drives public claim vs range disclosure vs pressure
  - carried into proactive whisper offers as the reason frame
  - nudges nomination thresholds and proposal ordering
  - remains internal/debug-safe and is not printed as in-game speech

## Next Implementation Slice

Expand the first-class `thoughtFrame` object in JS Core:

```js
{
  agentId,
  phase,
  clock,
  primaryConcernId,
  secondaryConcernId,
  selfDisclosureNeed: "none" | "range" | "hard_claim",
  socialRisk: 0.0,
  nominationReadiness: 0.0,
  evidenceReasons: [],
  intendedAct: "claim" | "pressure" | "defend" | "whisper" | "nominate" | "hold"
}
```

Initial use:

- tune public claim timing by script and role
- use `questionToAsk` in private/public follow-up prompts
- expose a debug-safe recap row for post-game review
- let evil AI build a `fakeThoughtFrame` for deliberate framing

## Fun Preservation Rules

- Each AI only uses its own `agentView`.
- No world solving from hidden truth.
- Keep top-K reasoning small.
- Apply persona bias and risk tolerance.
- Let evil AI use the same loop to fake useful worlds.
- Treat information as fallible unless verified by public death/reveal.
- Make action thresholds depend on social risk and vote support, not just suspicion.
