# Unity UI Screenshot Smoke

Date: 2026-05-10

## Goal

Add a repeatable user-view UI smoke path for Unity build screenshots. The first pass is not pixel-diff CI; it creates deterministic screenshots for the major panels so overlap, clipping, missing role icons, and modal stacking can be reviewed without manual clicking.

## Covered States

- `main-board`: closed menu, core grimoire board.
- `private-chat`: selected target with recent private chat history.
- `action-form`: complex player+role form using the BMR Gambler fixture.
- `storyteller-queue`: real death-triggered Storyteller queue.
- `script-handbook`: formal role-grid handbook.
- `vote-ceremony`: real 15-player vote ceremony.
- `role-picker`: role-token picker used by grimoire/private claim flows.

## Flow

1. `scripts/unity_ui_smoke_fixture.mjs` prepares the requested fixture in the target `StreamingAssets` directory.
2. Unity build starts with:

```text
-botc-no-bridge -botc-ui-smoke <state>
```

3. `BotcPrototypeBootstrap` loads the prepared viewmodel, closes the main menu, opens the requested panel, and does not start the bridge watcher.
4. `tools/capture_unity_ui_smoke.ps1` captures the Unity window as a PNG and writes a manifest.

## Non-Goals

- No visual diff threshold yet.
- No OCR or automatic clipped-text detection yet.
- No 1366x768 sweep yet; first target is the 1920x1080 fullscreen-first baseline.

## Next Extensions

- Add 1600x900 and 1366x768 secondary viewport sweeps after the 1080p baseline settles.
- Add a lightweight image comparison baseline once the UI settles.
- Add explicit BGM no-restart smoke by opening every modal in one process.
