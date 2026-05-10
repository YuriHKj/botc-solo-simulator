# Unity Fullscreen UI Baseline Verification

Date: 2026-05-10

## Commands

```powershell
npm test
```

Result: passed. JS Core, Unity viewmodel, action bridge, asset sync, demo acceptance, and mojibake contracts all passed.

```powershell
& 'C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe' -batchmode -quit -projectPath 'C:\Users\11507\Documents\Playground\unity-prototype' -executeMethod BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows -logFile 'C:\Users\11507\Documents\Playground\output\unity-build-fullscreen-ui-2026-05-10-r2.log'
```

Result: passed. Unity reported `Build Finished, Result: Success.` and `Unity prototype build succeeded`.

```powershell
npm run unity:ui-smoke
```

Result: passed. Latest 1920x1080 screenshot set:

- `output/unity-ui-smoke-20260510-162249/main-board.png`
- `output/unity-ui-smoke-20260510-162249/private-chat.png`
- `output/unity-ui-smoke-20260510-162249/action-form.png`
- `output/unity-ui-smoke-20260510-162249/storyteller-queue.png`
- `output/unity-ui-smoke-20260510-162249/script-handbook.png`
- `output/unity-ui-smoke-20260510-162249/vote-ceremony.png`
- `output/unity-ui-smoke-20260510-162249/role-picker.png`

```powershell
powershell -ExecutionPolicy Bypass -File tools\capture_unity_ui_smoke.ps1 -States main-board -Fullscreen -OutputDir output\unity-ui-smoke-fullscreen-check-20260510-161250
```

Result: passed. Fullscreen screenshot path produced a 1920x1080 `main-board.png`.

```powershell
powershell -ExecutionPolicy Bypass -File tools\run_unity_demo.ps1 -Fresh -NoWatch -NoLaunch -BuildAssets
```

Result: passed. Build StreamingAssets state/viewmodel initialization still works.

## Visual Notes

- Main board, side rails, top HUD, and bottom collapsed action capsule fit the 1920x1080 baseline.
- Private chat now reads as a wider bottom dialogue panel with a dedicated target token card and conversation area.
- Action form, Storyteller queue, handbook, vote ceremony, and role picker open as larger fullscreen modals with no obvious button clipping in the smoke set.
- Remaining visual debt: compact action-form role tokens are still denser than the final grimoire style; secondary 1600x900 and 1366x768 sweeps are still future work.
