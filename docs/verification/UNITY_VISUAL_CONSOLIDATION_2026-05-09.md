# Unity Visual Consolidation Verification

Date: 2026-05-09

## Scope

This pass tightened Unity build launch behavior and reduced script handbook density without changing JS Core rules, Unity action payloads, viewmodel fields, or save-state semantics.

## Changes Verified

- Unity Windows build entry now applies windowed defaults before building:
  - `FullScreenMode.Windowed`
  - `1600x900`
  - resizable window
- `tools/run_unity_demo.ps1` launches the build windowed by default and keeps `-Fullscreen` for manual fullscreen checks.
- Script handbook layout is wider:
  - role grid changed from 3 columns x 4 rows to 4 columns x 3 rows;
  - role tokens are larger;
  - detail and night-order text areas have more horizontal space.

## Commands

```powershell
npm run test:unity-demo-acceptance
```

Result: passed.

```powershell
npm test
```

Result: passed.

```powershell
& 'C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe' -batchmode -quit -projectPath '<repo>\unity-prototype' -executeMethod BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows -logFile '<repo>\output\unity-build-visual-consolidation-2026-05-09.log'
```

Result: build completed with `Build Finished, Result: Success.` The log still contained early Unity licensing noise, but the final build result was successful.

```powershell
powershell -ExecutionPolicy Bypass -File tools\run_unity_demo.ps1 -Fresh -NoWatch -NoLaunch -BuildAssets
```

Result: passed.

## Runtime Smoke

- Directly launching `unity-build\BOTC_Unity_Prototype.exe` without command-line arguments stayed alive for the 12-second smoke window.
- The bundled/self-started action bridge accepted a `script-handbook` action and returned:
  - `ok: true`
  - `message: 剧本手册已打开。`
- Player log check found no relevant `Exception`, `Error`, or `Failed` entries after launch and action processing.

## Screenshots

- `output\unity-visual-consolidation-window.png`
- `output\unity-visual-consolidation-handbook.png`
