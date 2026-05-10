# AI Agent Optimization Round - 2026-05-10

## Goal

This round makes AI dialogue explain itself from each agent's own visible evidence instead of broad template claims. It does not add an online LLM, does not change BOTC rule resolution, and does not change Unity UI.

## Touched Entrypoints

- `scripts/ai_agents.js`
  - `getDialogueEvidenceForTarget(state, viewer, targetId, options)`
  - `summarizeEvidenceForDialogue(state, viewer, targetId, options)`
  - `assertNoHiddenInfoLeakForDialogue(text, state, viewer)`
  - `recordPrivateInfoForAgent(...)`
  - `recordPrivateInfoClaimForAgent(...)`

- `scripts/ai.js`
  - `collectEvidence(...)`
  - `composePrivateResponse(...)`
  - `composePublicLine(...)`
  - `buildNominationProposal(...)`

## Visibility Boundary

Dialogue evidence is read from `agent.evidenceBook`, which is scoped by AI owner. Public dialogue uses `publicOnly: true`, so private whispers and night information are not quoted into public speech.

Private dialogue may use private evidence from that same viewer, but private content is summarized rather than copied verbatim. A private whisper becomes a vague "private line of play" reason, while storyteller night information becomes "my night information".

Good agents do not receive demon bluff IDs through the dialogue helper. The audit helper throws if a good viewer's dialogue text contains hidden demon bluff labels or evil-recognition phrases.

## Contamination Model

`recordPrivateInfoForAgent(...)` now stores:

- `sourceRoleId`
- `contaminationReason`
- `contaminationRisk`

Storyteller night information still has high base trust, but recipient state changes risk:

- normal recipient: low-to-medium risk
- drunk recipient: higher risk
- poisoned recipient: higher risk

Private player claims about night information are recorded as rumor-level private evidence with high contamination risk. This changes AI interpretation and wording only; rule results are unchanged.

## Remaining Direct Reads

Known places still reading broader game fields directly:

- `rankTargets(...)` and suspicion heuristics still inspect public game state and player suspicion maps.
- Evil alliance private responses intentionally use evil-recognition fields when both participants are evil-aligned.
- `summarizeShareablePrivateNotes(...)` still filters old `privateNotes` strings defensively, but this should eventually become structured evidence.
- Public speech templates still add persona tails after the evidence-backed reason, so some flavor text remains template-driven.

## Test Coverage

`tests/ai_agent_contracts.mjs` now checks:

- Private "why suspect X" replies include evidence visible to that AI.
- Private whisper text is not quoted in later public AI speech.
- Good-viewer dialogue audit catches hidden demon bluff labels.
- Poisoned night information receives higher contamination risk than normal storyteller information.
- AI nomination proposal reason includes either an evidence-derived reason or an explicit pressure marker.
- Existing AI insight rows still avoid mutating belief state.

