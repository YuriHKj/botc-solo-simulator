# Unity Main Menu Background And Setup Verification

Date: 2026-05-12

## Scope

Verified the Unity main menu pass for:

- main menu-only painted background resource from the provided `bg.jpg`
- new-game setup controls for script, player count, and preferred human role
- Unity `new-game` payload forwarding into JS Core
- Electron-to-Unity interface gap check documentation

## Commands

```powershell
& 'C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe' -batchmode -quit -projectPath 'C:\Users\11507\Documents\Playground\unity-prototype' -executeMethod BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows -logFile 'C:\Users\11507\Documents\Playground\output\unity-build-menu-bg-setup-2.log'
powershell -ExecutionPolicy Bypass -File 'tools\capture_unity_ui_smoke.ps1' -State 'main-menu' -WindowWidth 1920 -WindowHeight 1080
npm run test:unity-assets
npm run test:unity-action-bridge
npm run test:unity-viewmodel
npm test
```

## Manual Bridge Check

Used a temporary Unity action payload:

```json
{
  "type": "new-game",
  "payload": {
    "scriptId": "snv",
    "playerCount": 12,
    "roleId": "artist"
  }
}
```

Resulting JS Core state:

- `scriptId`: `snv`
- player count: `12`
- human role: `artist`

## Results

- Unity Windows build: passed.
- Main menu smoke screenshot: `output/unity-ui-smoke-20260512-211447/main-menu.png`
- `npm run test:unity-assets`: passed.
- `npm run test:unity-action-bridge`: passed.
- `npm run test:unity-viewmodel`: passed.
- `npm test`: passed.
