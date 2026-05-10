# Passive Info And Storyteller Queue Verification

Date: 2026-05-09

## Scope

- TB Spy, BMR Grandmother, BMR Chambermaid, and SnV Oracle private information export.
- SnV Sage no longer receives generic passive information while alive.
- TB Ravenkeeper, BMR Moonchild, SnV Sage, SnV Klutz, and SnV Barber death-trigger Storyteller queues.
- Unity viewmodel preserves Storyteller action `type` and exports an available `storyteller-action` form.
- Unity Windows build includes the updated JS Core mirror.

## Commands

```powershell
npm run test:passive-info-queues
npm test
```

Result: passed.

```powershell
& 'C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe' `
  -batchmode -quit `
  -projectPath '<repo>\unity-prototype' `
  -executeMethod BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows `
  -logFile '<repo>\output\unity-build-passive-info-queue-2026-05-09.log'
```

Result: passed. The log contains `Build Finished, Result: Success.` and `Unity prototype build succeeded`.

```powershell
Test-Path unity-build\BOTC_Unity_Prototype.exe
Select-String -Path unity-build\BOTC_Unity_Prototype_Data\StreamingAssets\BotcJsCore\scripts\engine.js `
  -Pattern 'runPassiveInfoActorsSimplified'
Select-String -Path unity-build\BOTC_Unity_Prototype_Data\StreamingAssets\BotcJsCore\scripts\unity_viewmodel.js `
  -Pattern 'type: action\.type'
```

Result: passed. The built JS Core mirror contains the passive info order fix and Unity action `type` export.

```powershell
node 'unity-build\BOTC_Unity_Prototype_Data\StreamingAssets\BotcJsCore\scripts\unity_action_bridge.mjs' `
  --fresh `
  --state='output\build-bridge-passive-info-smoke\unity_state.json' `
  --out='output\build-bridge-passive-info-smoke\unity_viewmodel.json' `
  --action='output\build-bridge-passive-info-smoke\unity_action.json' `
  --result='output\build-bridge-passive-info-smoke\unity_action_result.json'
```

Result: passed. The built bridge exported a viewmodel successfully.
