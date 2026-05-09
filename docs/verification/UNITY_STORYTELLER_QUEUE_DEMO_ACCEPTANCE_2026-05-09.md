# Unity Storyteller Queue Demo Acceptance Verification

Date: 2026-05-09

## Scope

Verify that Unity demo smoke covers a real JS Core death-triggered Storyteller queue.

## Commands

```powershell
npm run test:unity-demo-acceptance
npm run test:unity-action-bridge
npm test
```

## Result

All commands passed.

The full `npm test` run included:

- `test:passive-info-queues`
- `test:night-actions`
- `test:unity-viewmodel`
- `test:unity-action-bridge`
- `test:unity-assets`
- `test:unity-demo-acceptance`
- `test:mojibake`

The Unity demo acceptance output now includes:

- `real-sage-storyteller-queue-state`
- `real-ravenkeeper-storyteller-queue-state`
- `real-barber-storyteller-queue-state`
- `storyteller-action`
- `storytellerQueueCovered: true`
- `storytellerQueueTypes: ["sage-info", "ravenkeeper-info", "barber-swap"]`

## Notes

The added fixtures use real JS Core death-trigger paths, persist them through the Unity bridge state file, then resolve them through the same `storyteller-action` action file path used by the playable demo.

Covered queue shapes:

- `sage-info`: information-only Storyteller action.
- `ravenkeeper-info`: single-target Storyteller action that writes private information.
- `barber-swap`: two-target Storyteller action that mutates persisted player roles.
