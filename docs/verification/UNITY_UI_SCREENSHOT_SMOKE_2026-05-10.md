# Unity UI Screenshot Smoke Verification

Date: 2026-05-10

## Scope

Verify the first repeatable Unity UI screenshot smoke pass for these states:

- main board
- private chat
- complex action form
- Storyteller queue
- script handbook
- 15-player vote ceremony
- role picker

## Commands

```powershell
node scripts\unity_ui_smoke_fixture.mjs --state=main-board --streaming-assets=output\unity_ui_smoke_fixture_probe\main-board --seed=20260510
npm run test:unity-demo-acceptance
npm run test:unity-viewmodel
& 'C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe' -batchmode -quit -projectPath 'C:\Users\11507\Documents\Playground\unity-prototype' -executeMethod BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows -logFile 'C:\Users\11507\Documents\Playground\output\unity-build-ui-smoke-layout-fixes-2026-05-10.log'
powershell -ExecutionPolicy Bypass -File tools\capture_unity_ui_smoke.ps1 -OutputDir output\unity-ui-smoke-2026-05-10
```

## Results

- JS fixture generation for all seven states: passed.
- `npm run test:unity-demo-acceptance`: passed.
- `npm run test:unity-viewmodel`: passed.
- Unity batchmode build: passed. Log contains `Build Finished, Result: Success.` and `Unity prototype build succeeded`.
- UI screenshot smoke: passed. Manifest written to `output/unity-ui-smoke-2026-05-10/manifest.json`.

## Screenshots

Generated PNGs:

- `output/unity-ui-smoke-2026-05-10/main-board.png`
- `output/unity-ui-smoke-2026-05-10/private-chat.png`
- `output/unity-ui-smoke-2026-05-10/action-form.png`
- `output/unity-ui-smoke-2026-05-10/storyteller-queue.png`
- `output/unity-ui-smoke-2026-05-10/script-handbook.png`
- `output/unity-ui-smoke-2026-05-10/vote-ceremony.png`
- `output/unity-ui-smoke-2026-05-10/role-picker.png`

## Fixes From This Smoke Pass

- External Windows capture returned black DirectX frames, so screenshot output now uses Unity-side `Texture2D.ReadPixels`.
- Storyteller queue smoke was covered by the endgame modal in one fixture; UI smoke mode now dismisses endgame overlays before opening the requested panel.
- Complex action form target cards were visually pressing into the role section; target cards are slimmer and target/role spacing is wider.

## Remaining UI Notes

- This is still a screenshot artifact smoke, not a pixel-diff regression test.
- Action-form role labels are readable enough for this pass but remain visually dense.
- Vote ceremony 15-player labels fit, but label duplication/noise should be revisited when vote presentation gets its next polish pass.
