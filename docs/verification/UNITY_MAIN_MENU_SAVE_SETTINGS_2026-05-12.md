# Unity Main Menu, Save, and Settings Verification

Date: 2026-05-12

## Scope

Verified the Unity UI pass that separates the startup main menu from gameplay, delays first-night/storyteller dialogue until entering the grimoire, adds local save/load actions, and exposes resolution/fullscreen/audio settings from both the main menu and in-game top bar.

## Results

- Unity Windows build: passed.
- Main-menu UI smoke: passed. The startup menu is standalone and does not show the bottom storyteller dialogue.
- Settings UI smoke: passed. The in-game settings panel opens over gameplay and the top-bar settings button no longer overlaps phase/sync text.
- Stage-dialogue UI smoke: passed. The formal storyteller dialogue still renders after gameplay entry paths.
- Unity viewmodel contracts: passed.
- Unity action bridge contracts: passed.
- Unity asset sync/contracts: passed.
- Unity demo acceptance: passed.
- Full `npm test`: passed.

## Commands

```powershell
& 'C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe' -batchmode -quit -projectPath 'C:\Users\11507\Documents\Playground\unity-prototype' -executeMethod BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows -logFile 'C:\Users\11507\Documents\Playground\output\unity-build-menu-save-settings-4.log'
```

```powershell
tools\capture_unity_ui_smoke.ps1 -States @('main-menu','settings','stage-dialogue') -WindowWidth 1920 -WindowHeight 1080
```

```powershell
npm run test:unity-viewmodel
npm run test:unity-action-bridge
npm run test:unity-assets
npm run test:unity-demo-acceptance
npm test
```

## Artifacts

- UI smoke directory: `C:\Users\11507\Documents\Playground\output\unity-ui-smoke-20260512-170729`
- Build log: `C:\Users\11507\Documents\Playground\output\unity-build-menu-save-settings-4.log`

