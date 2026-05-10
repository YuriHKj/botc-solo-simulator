# Unity Storyteller Queue UI Verification

Date: 2026-05-10

## Scope

Verified the dedicated Unity Storyteller queue UI pass:

- `storytellerQueueDetails[]` is exported while preserving `storytellerQueue[]`.
- Unity compiles the new centered Storyteller queue modal.
- Existing queue processing through `storyteller-action` still resolves real Sage, Ravenkeeper, and Barber fixtures.

## Commands

```powershell
npm test
```

Result: passed.

```powershell
npm run test:unity-demo-acceptance
```

Result: passed. The acceptance run covered:

- `sage-info`
- `ravenkeeper-info`
- `barber-swap`

```powershell
& 'C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe' -batchmode -quit -projectPath 'C:\Users\11507\Documents\Playground\unity-prototype' -executeMethod BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows -logFile 'C:\Users\11507\Documents\Playground\output\unity-build-storyteller-queue-ui-2026-05-10-r2.log'
```

Result: build completed with `Build Finished, Result: Success.` The log still contains early Unity licensing noise and shutdown thread warnings, but the build result is successful.

```powershell
powershell -ExecutionPolicy Bypass -File tools\run_unity_demo.ps1 -Fresh -NoWatch -NoLaunch -BuildAssets
```

Result: passed.

## Runtime Smoke

Launched `unity-build\BOTC_Unity_Prototype.exe` windowed at `1600x900` for 10 seconds.

Result:

- Process stayed alive for the smoke window.
- Player log scan found no relevant `Exception`, `NullReference`, `Error`, or `Failed` entries.
- The self-started bridge process was stopped after the smoke.
