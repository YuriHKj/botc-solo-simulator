# Unity Storyteller Queue Demo Acceptance

Date: 2026-05-09

## Goal

Extend the Unity playable demo smoke test so it covers a real JS Core death-triggered Storyteller queue. This catches the class of bug where the demo appears playable, but a Storyteller-only information action never reaches or leaves the Unity bridge.

## Current Coverage

- JS Core contracts verify passive night information and death-triggered queue rules.
- Unity action bridge contracts verify a synthetic pending Storyteller action can be resolved.
- Unity demo acceptance exercises fresh state, token selection, private chat, public discussion, nomination, and script handbook.

## Gap

The demo smoke does not yet prove that a real engine-produced pending action is visible to Unity and resolvable through the same action file path used by the demo.

## Design

The demo acceptance script adds Storyteller queue scenarios after the normal TB interaction smoke.

### Info Queue

1. Build a real `snv` game with the human player as Sage.
2. Run the first night.
3. Mark other good players dead and make living minions harmless for death-trigger testing.
4. Run another night so the demon kills the human Sage.
5. Assert JS Core produced a `sage-info` pending Storyteller action.
6. Persist that real state into the Unity bridge state file.
7. Export a Unity viewmodel and assert `pendingStorytellerAction.available` is true.
8. Send a `storyteller-action` through `processUnityActionFile`.
9. Assert the queue is empty, the action id is reflected, and private information is visible in the viewmodel.

### Single-Target Queue

1. Build a real `tb` game with the human player as Ravenkeeper.
2. Run the first night, then force the next night kill to hit the human Ravenkeeper.
3. Persist the resulting `ravenkeeper-info` pending action.
4. Pick a legal option from the Unity viewmodel and send it back as `targetIds`.
5. Assert the queue is empty and the Ravenkeeper private information appears in the Unity viewmodel.

### Multi-Target Queue

1. Build a real `snv` game with the human player as Fang Gu.
2. Put Barber on a living non-human good player and execute that player.
3. Persist the resulting `barber-swap` pending action.
4. Pick two legal non-demon options from the Unity viewmodel and send them back as `targetIds`.
5. Assert the queue is empty and the selected players' roles swapped in persisted JS Core state.

## Non-Goals

- No Unity prefab or C# layout changes.
- No change to role rules.
- No AI dialogue polish.

## Validation

- `npm run test:unity-demo-acceptance`
- `npm run test:unity-action-bridge`
- Full `npm test` when time allows.
