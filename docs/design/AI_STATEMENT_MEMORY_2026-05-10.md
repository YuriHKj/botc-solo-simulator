# AI Statement Memory - 2026-05-10

## Goal

AI should remember the key line it has taken today, so follow-up dialogue and later strategy feel coherent. This pass does not change rules, scoring formulas, Unity UI, or external model usage.

## Runtime Ledger

`state.aiDialogue.statementMemory` is an internal runtime ledger:

- `publicBySpeakerId[speakerId]` stores public statements visible to everyone.
- `privateByPairKey["speaker::viewer"]` stores private statements visible only to that pair.

Each entry stores structured summary fields only:

- focus id/name and suspicion stance,
- claim role id if one exists,
- vote stance inferred from the final response,
- one safe evidence summary,
- day/night/source metadata.

Private raw text is never copied into public memory.

## Dialogue Behavior

- Private follow-up on the same target adds a continuity line such as "刚才那条线我还没改".
- Private focus switch explains the pivot, for example "我换到 X，是因为你刚才明确问到这个位置".
- Public round-two or later speech reads only public memory and can keep a previous public line.
- AI-AI private memory is keyed to `speaker::target`; unrelated AIs do not receive that pair ledger.
- Role claim consistency is enforced through existing `publicClaimRoleId` plus statement continuity wording.

## Strategy Consistency

Public statement memory also influences low-level AI strategy:

- `decideAIVote(...)` applies a small vote-threshold reduction when the nominee matches the voter's current public focus.
- `chooseAINomination(...)` considers the public-memory focus even when it is outside the first three ranked suspicion targets.
- nomination proposals produced from this path are marked with `statementMemoryFocus` and use a reason that starts from "延续公开口径".
- proposal sorting keeps these memory-driven proposals ahead of generic fallback pressure nominations.

Only public memory is allowed to drive public voting/nomination explanations. Private pair memory may shape that AI's private continuity, but it is not copied into public reasons or exposed as raw text.

## Known Boundaries

- Memory constrains expression and action consistency, not the underlying suspicion score.
- New evidence can still move the AI's focus, but the response must explain the shift.
- This ledger is not exposed to Unity/Electron UI in this pass.
