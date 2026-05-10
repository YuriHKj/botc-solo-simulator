# Unity Storyteller Queue UI

Date: 2026-05-10

## Goal

Turn the Unity Storyteller queue from a text summary into a dedicated modal surface that can be used during real death-trigger and passive-information queues.

## Data Contract

Keep the existing `storytellerQueue[]` string array for backwards compatibility.

Add `storytellerQueueDetails[]` for UI cards:

- `id`
- `type`
- `roleId`
- `roleName`
- `inputType`
- `prompt`
- `phaseLabel`
- `createdDay`
- `createdNight`
- `createdPhase`
- `minTargetCount`
- `maxTargetCount`
- `targetCount`
- `optionCount`
- `current`

The first item is the only currently processable queue entry because JS Core resolves `pendingStorytellerActions[0]`.

## Unity Layout

The modal is centered and split into three functional regions:

1. Left queue lane: pending queue cards, with the current card highlighted.
2. Right detail lane: current role/action type, prompt, input type, target range and option count.
3. Bottom preview lane: first legal target options or empty/info state.

Primary actions:

- `处理当前`: opens the existing dynamic action form.
- `自动处理`: submits `storyteller-action` using existing JS Core default legal selection behavior.
- `刷新`
- `关闭`

## Non-Goals

- No JS Core resolver change.
- No new action payload type.
- No change to phase guard behavior.
- No queue reordering; JS Core remains first-in-first-out.

## Verification

- `npm test`
- `npm run test:unity-demo-acceptance`
- Unity batchmode build
