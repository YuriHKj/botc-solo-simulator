# Unity Public Day Actions Verification

Date: 2026-05-15

## Scope

- Unity UI contract for public day actions.
- Slayer: target selection on the grimoire and `公开开枪`.
- Gossip: statement input and `公开声明`.
- Bridge/viewmodel feedback fields: `resolvedImmediately`, `publicAction`, `speechId`.
- Public timeline export for `public-ability` entries.

## Changes Verified

- `day-action` remains the single Unity action type for public skills.
- JS bridge now persists immediate/public action fields into `unityBridge` and result JSON.
- Unity viewmodel exports action status fields and public ability metadata on timeline entries.
- Unity action forms render public day actions as `公开发动` rather than generic preset actions.
- Human public ability entries are allowed into the bottom stage dialogue queue.
- Root JS and Unity embedded JS copies were synchronized for the touched scripts.

## Validation

```powershell
npm test
```

Result: passed.

```powershell
& "C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe" -batchmode -quit -projectPath "C:\Users\11507\Documents\Playground\unity-prototype" -executeMethod BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows -logFile "C:\Users\11507\Documents\Playground\output\unity-build-public-day-actions-2026-05-15.log"
```

Result: passed, build log reports `Build Finished, Result: Success.`

```powershell
git diff --check
```

Result: no whitespace errors; only existing CRLF conversion warnings.

## Notes

- Unity licensing warnings appeared in the build log, but the build completed successfully.
- Two small JS Core timing/contract fixes were required for full validation: Slayer public shots return the speech id, and simplified night no longer resolves end-of-day triggers from setup before D1.
