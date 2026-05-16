# AI Public Memory And Good Day Strategy

Date: 2026-05-16

## Problem

Playtest feedback showed three related issues:

- An AI can repeat the same first-night claim and info on later days as if it forgot it had already shared that line.
- Public chat has UI entry points, but a human public statement mostly records text; it does not reliably force an addressed AI to answer.
- Good AI strategy does not yet recognize day-execution incentives from roles such as Undertaker, Virgin, and Vortox.

## Scope

This pass adds a small, testable loop rather than a full social simulator:

- Cross-day shared-info memory for AI -> participant pairs.
- Public conversation pending-response routing after human public speech.
- A good-side day strategy helper that adjusts disclosure, nomination, and vote pressure.

## Memory Contract

`state.aiDialogue.statementMemory.sharedInfoByPairKey["speaker::viewer"]` stores only structured summaries:

- `speakerId`
- `viewerId`
- `claimRoleId`
- `lastInfoFingerprint`
- `lastInfoSummary`
- `lastSharedDay`
- `shareCount`

It must not promote private raw text into public memory. It is used to:

- reduce proactive whisper score when no new information exists
- phrase repeat contact as "yesterday's line has not changed" rather than re-announcing the same info
- preserve role-claim consistency across days

## Public Response Contract

`human-public-speech` now prepares:

- `publicConversation.pendingResponseSpeakerId`
- `publicConversation.pendingQuestionText`
- `publicConversation.pendingResponseFocusId`

The next `ai-public-step` uses the pending response before falling back to the normal conversation clock. The response still goes through public evidence contracts and normal public speech recording.

## Good Day Strategy

`evaluateGoodDayStrategy(state, aiPlayer, options)` returns:

- `executionValue`
- `noExecutionRisk`
- `verificationValue`
- `selfDisclosureBias`
- `nominationBias`
- `voteBias`
- `reasons[]`
- `recommendedPublicAct`

Initial role signals:

- Undertaker present: execution can create next-day role information.
- Virgin present: first Townsfolk nomination can be a public verification attempt.
- Vortox present: no-execution day is dangerous in SnV.

Guardrails:

- This does not reveal hidden roles to AI outside script-level role availability.
- It changes strategy pressure, not rules.
- It should not make every good AI mass-claim. Biases are bounded and depend on role category, day, and public stage.
