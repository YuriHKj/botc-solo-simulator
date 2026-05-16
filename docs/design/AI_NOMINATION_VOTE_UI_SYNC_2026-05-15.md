# AI Nomination Vote UI Sync

Date: 2026-05-15

## Scope

This pass responds to gameplay feedback from the Unity prototype:

- AI could nominate but then visibly not vote.
- AI nomination wording could feel formulaic or address the human player as "你".
- The grimoire kept nomination and vote markers after the day ended.

The change keeps JS Core authoritative for rules and AI decisions. Unity only consumes the synchronized viewmodel contract.

## Contract Changes

- `resolveNominationAndVote(...)` now treats an AI nominator as a public yes vote for its own nomination.
- `buildNominationProposal(...)` only reuses public statement memory as nomination wording when that memory represents actual pressure.
- `pressureReasonFor(...)` uses seat labels for human targets.
- `buildVoteCeremony(...)` returns `null` unless the latest vote belongs to the current day and the state is `phase: "day"` plus `dayStage: "nomination"`.

Root scripts and Unity embedded scripts were kept in sync:

- `scripts/ai.js`
- `scripts/engine.js`
- `scripts/unity_viewmodel.js`
- `unity-prototype/Assets/StreamingAssets/BotcJsCore/scripts/ai.js`
- `unity-prototype/Assets/StreamingAssets/BotcJsCore/scripts/engine.js`
- `unity-prototype/Assets/StreamingAssets/BotcJsCore/scripts/unity_viewmodel.js`

## AI-Side Follow-Up Suggestions

- Add explicit nomination intent metadata such as `voteIntent` or `nominatorCommitment` if UI later wants to preview the nominator's stance before vote resolution.
- Add per-voter public vote rationale as a separate viewmodel field instead of deriving rationale from suspicion thresholds in Unity.
- Keep statement memory tagged by stance strength so nomination text can distinguish pressure, watch, trust, and neutral mentions.
- Prefer player seat labels in AI public speech when the target is the human player, unless the line is direct dialogue.

## UI Behavior

Unity should continue drawing vote and nomination markers only from `voteCeremony`. Because stale ceremonies now export as `null`, the grimoire no longer needs a local heuristic to clear old marker state after day end.

