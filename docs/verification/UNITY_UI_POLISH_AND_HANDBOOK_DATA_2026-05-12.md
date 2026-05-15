# Unity UI Polish and Handbook Data Verification

Date: 2026-05-12

## Scope

Verified the Unity-only UI pass for:

- phase transition stability for night/day/public/nomination-style changes
- larger shared button, tool, and token role typography
- dialogue typewriter tick sound volume and cadence
- wider right-side information drawer with slide-in entrance
- suggested-action button highlighting for phase progression and action forms
- script handbook enrichment from official script JSON data

This pass does not change AI decision quality, rule settlement, or JS Core phase logic.

## Commands

```powershell
npm run test:unity-viewmodel
npm run test:unity-action-bridge
& 'C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe' -batchmode -quit -projectPath 'C:\Users\11507\Documents\Playground\unity-prototype' -executeMethod BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows -logFile 'C:\Users\11507\Documents\Playground\output\unity-build-ui-polish-handbook-7.log'
powershell -ExecutionPolicy Bypass -File 'tools\capture_unity_ui_smoke.ps1' -State 'main-board' -WindowWidth 1920 -WindowHeight 1080
powershell -ExecutionPolicy Bypass -File 'tools\capture_unity_ui_smoke.ps1' -State 'info-drawer' -WindowWidth 1920 -WindowHeight 1080
powershell -ExecutionPolicy Bypass -File 'tools\capture_unity_ui_smoke.ps1' -State 'script-handbook' -WindowWidth 1920 -WindowHeight 1080
powershell -ExecutionPolicy Bypass -File 'tools\capture_unity_ui_smoke.ps1' -State 'stage-dialogue' -WindowWidth 1920 -WindowHeight 1080
npm test
```

## Results

- `npm run test:unity-viewmodel`: passed.
- `npm run test:unity-action-bridge`: passed.
- Unity Windows build: passed, log at `output/unity-build-ui-polish-handbook-7.log`.
- UI smoke screenshots: passed manual visual check.
- `npm test`: passed.

## Smoke Artifacts

- Main board suggested next-phase highlight: `output/unity-ui-smoke-20260512-190747/main-board.png`
- Wider right drawer: `output/unity-ui-smoke-20260512-184943/info-drawer.png`
- Handbook JSON enrichment: `output/unity-ui-smoke-20260512-184944/script-handbook.png`
- Dialogue/stage panel: `output/unity-ui-smoke-20260512-184944/stage-dialogue.png`

## Notes

- The suggested next-phase button now uses both a gold pulse/frame and a visible text prefix so the hint remains readable against the dark scene.
- Handbook roles now display official ability text, first-night/other-night reminder content, and reminder tokens when present in the script JSON.
- The right-side drawer is intentionally wider on 1080p to reduce line wrapping and make the slide-in treatment visible.
