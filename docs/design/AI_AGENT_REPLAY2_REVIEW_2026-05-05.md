# AI Agent Replay 2 Review - 2026-05-05

## Replay symptoms

- Timeline visibility is poor. The dialogue timeline exists in `state.aiDialogue.timeline` and the bottom dialogue stage, but it is visually secondary and easy to miss during play.
- Failed nominations incorrectly ended the day from the app flow. The engine already tracked `nominatedToday` and `beenNominatedToday`, but `executeNomination()` immediately advanced to night after every accepted nomination.
- Failed votes were treated as "no execution" inside `resolveNominationAndVote()`. Officially, no-execution effects should happen when the day ends with no execution, not after every failed nomination vote.
- Human player lacks an explicit outward-deception interface. Players can ask AI questions, but cannot clearly say "I claim X" as a public social action that AI agents observe.
- AI public speech still has repeated sentence skeletons. Agent reasoning is improving, but language cadence remains too template-like.
- Evil ally private chat is logically useful but overly report-like. It should sound like coordination at a table, not a telemetry dump.

## Changes made in this pass

- Added a board-level `白天时间线` rail so public claims, private chats and public discussion are visible near the grimoire instead of only in the bottom panel.
- Added a vote ceremony overlay for the latest day vote, including passed/failed state and voter pills.
- Added `你的对外声称` public claim control. This calls `registerClaim()`, records the claim for AI agents, and pushes a visible public timeline entry.
- Changed failed nomination flow: failed votes now keep the game in nomination stage so additional nominations can happen.
- Moved no-execution rule handling out of failed vote resolution. It now remains tied to explicit `skipDay()`.
- Added a small anti-repeat constraint so a given AI avoids using the same public speech template on consecutive public rounds.

## Remaining Agent problems

- AI needs intent-specific response policies, not just text templates. Example: "问身份" should have different behavior for dead players, high-pressure nominees, evil allies, first-day power roles and late-game claims.
- AI needs stronger "conversation state". It should remember that it already refused a claim and either escalate, compromise with a range, or give a reason instead of repeating the same refusal.
- Public discussion should become a staged debate, not simultaneous monologues. Proposed stages: opening claims -> challenge -> defense -> nomination pressure -> vote intent.
- Human lies should support private lies and information lies, not only public role claims. Needed actions: privately claim role, privately claim night information, publicly accuse, publicly defend, coordinate vote.
- Voting should ideally be interactive per voter with animation timing. Current overlay is a result animation, not a per-vote countdown.

## Next recommended implementation slice

1. Add private deception actions to the chat modal: "我声称我是 X", "我说我昨晚得到 Y", "我要求你别公开我说的话".
2. Convert public discussion into a queue of debate beats with skip/speed controls using the existing timeline playback.
3. Add per-voter vote animation state, then let nomination resolution consume the animated votes.
4. Refactor private response policy by role/day/alive status so dead players and pressured players stop giving generic evasions.
