# Unity Visual Consolidation

Date: 2026-05-09

## Goal

Tighten the current Unity build's visual and launch behavior without changing JS Core rules, action payloads, viewmodel fields, or game state semantics.

## Inputs

- The Unity build user acceptance found that a windowed launch completed the action smoke reliably.
- The current script handbook is functional, but the role grid and detail/night-order sections are still visually dense.
- Existing UI direction remains: grimoire-first board, dark modal panels, role icons over text where practical.

## Scope

### Build Window Defaults

The Windows prototype build should default to:

- windowed mode;
- 1600x900 initial size;
- resizable window.

`tools/run_unity_demo.ps1` should launch the build with matching windowed arguments by default, while allowing `-Fullscreen` for manual testing.

### Script Handbook Panel

The handbook panel should:

- be wider, using the stable 1600x900 acceptance viewport;
- keep a left role-icon grid and a right details column;
- show 12 roles as 4 columns x 3 rows instead of 3 columns x 4 rows;
- give the role detail text and night-order reference more horizontal room;
- keep existing category filters and pagination behavior.

## Non-Goals

- No JS Core rule changes.
- No viewmodel/action contract changes.
- No new UI library or prefab system.
- No AI dialogue changes.

## Validation

- `npm run test:unity-demo-acceptance`
- `npm test`
- Unity batchmode build with `BotcPrototypeBuild.BuildWindows`
- Build StreamingAssets initialization through `tools/run_unity_demo.ps1 -Fresh -NoWatch -NoLaunch -BuildAssets`
