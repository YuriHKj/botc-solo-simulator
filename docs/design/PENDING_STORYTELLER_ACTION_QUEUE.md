# Pending Storyteller Action Queue

## Goal

Some BOTC abilities do not resolve at the moment the engine detects the trigger. They require a Storyteller prompt to the human player or to the human-controlled evil player:

- Ravenkeeper dies at night and chooses a player to learn.
- Moonchild dies and chooses a living player.
- Klutz dies and chooses a living player.
- Barber dies and, if the demon is human-controlled, the demon chooses two non-demon players to swap.

The engine now has a `pendingStorytellerActions` FIFO queue so these triggers can pause the flow instead of being auto-resolved or skipped.

## Action Shape

Each queued action stores a serializable payload:

- `type`: resolver key, for example `moonchild-choice`.
- `actorId`: role owner that caused the action.
- `controllerId`: optional player who makes the choice when different from the actor, for example Barber's demon.
- `roleId`, `roleName`, `roleIcon`: UI identity.
- `inputType`: currently `player-target`; future actions can reuse the same queue with richer role-action interfaces.
- `targetCount`, `minTargetCount`, `maxTargetCount`: validation contract.
- `options`: legal target list already filtered for the action.
- `prompt`, `phaseLabel`, `interaction`: text used by the existing Storyteller modal.

## Flow Contract

1. Role module detects the trigger.
2. If the choice belongs to a human-controlled perspective, the module calls `enqueueStorytellerAction`.
3. App flow calls `handlePendingStorytellerActions` after executions, no-execution day skips, night resolution, Slayer deaths, and save loading.
4. The modal resolves the queue head through `resolvePendingStorytellerAction`.
5. The resolver applies side effects, removes the queue head, checks win state, then the app checks the next queued action.

## Current Coverage

- TB: Ravenkeeper night death choice.
- BMR: Moonchild death choice.
- SnV: Klutz death choice.
- SnV: Barber swap choice when the demon is human-controlled.

## 2026-05-04 Expansion Scope

This round extends the queue beyond "choose a player" prompts:

- Add an `info` style pending action for triggered information that should visibly pause the flow and ask the human to acknowledge it.
- SnV Sage uses that path when the human Sage is killed by a demon: the engine precomputes the two-player pair, then the modal shows the information as a Storyteller wake-up.
- BMR Professor keeps using the normal active night action pipeline, but receives dedicated interaction metadata so the UI no longer looks like a generic target picker.
- SnV Snake Charmer remains an active night action; when the human Snake Charmer hits a demon and swaps, the human receives explicit private information instead of only seeing a hidden log-side role swap.

## Known Follow-ups

- Snapshot poisoned/drunk state into queued information actions when exact timing matters.
- Add richer UI layouts for future Storyteller choices, such as player plus role, multi-kill, and yes/no questions.
- Expand tests for Ravenkeeper and Barber once public test helpers can deterministically trigger night deaths and non-human death events.
