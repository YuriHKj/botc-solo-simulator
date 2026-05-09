# Unity Build User Acceptance

Date: 2026-05-09

## Scope

Validate the current Unity build from a user-facing path:

- rebuild the Windows prototype from the current Unity project;
- initialize a fresh build StreamingAssets state;
- launch `unity-build/BOTC_Unity_Prototype.exe` directly;
- confirm the build starts its bundled JS Core bridge without a separate terminal;
- drive a player-like action sequence through the build StreamingAssets action/result files.

## Build

Command:

```powershell
& 'C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe' -batchmode -quit -projectPath 'C:\Users\11507\Documents\Playground\unity-prototype' -executeMethod BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows -logFile 'C:\Users\11507\Documents\Playground\output\unity-build-user-acceptance-2026-05-09.log'
```

Result: passed.

Relevant log line:

```text
Unity prototype build succeeded: C:\Users\11507\Documents\Playground\unity-build\BOTC_Unity_Prototype.exe
```

The build includes:

- `BOTC_Unity_Prototype_Data/StreamingAssets/BotcJsCore`
- `BOTC_Unity_Prototype_Data/StreamingAssets/BotcJsRuntime/node.exe`

## Direct Exe Launch

Fresh build state command:

```powershell
powershell -ExecutionPolicy Bypass -File tools\run_unity_demo.ps1 -Fresh -NoWatch -NoLaunch -BuildAssets
```

Direct launch command:

```powershell
unity-build\BOTC_Unity_Prototype.exe
```

Observed:

- Unity started the bundled bridge automatically.
- The bridge process used `StreamingAssets/BotcJsRuntime/node.exe`.
- Player log included `Unity action bridge started from ... BotcJsCore\scripts\unity_action_bridge.mjs`.

One default launch exited before the action smoke could run. Player log showed normal shutdown and no exception. A windowed relaunch was stable for the action smoke:

```powershell
unity-build\BOTC_Unity_Prototype.exe -screen-fullscreen 0 -screen-width 1600 -screen-height 900
```

After 20 seconds, both Unity and the bundled bridge process were still alive.

## Action Smoke

The windowed build processed these actions through its self-started bridge:

1. `select-token`
2. `private-chat`
3. `public-discussion`
4. `phase` to nomination
5. `nomination`
6. `script-handbook`

Result:

```json
{
  "ok": true,
  "target": "p5",
  "nominee": "p5",
  "dayStage": "nomination",
  "lastAction": "script-handbook",
  "voteVoters": 9,
  "handbookRoles": 22
}
```

Screenshot captured:

```text
output/unity-build-user-acceptance-windowed.png
```

## Findings

Passed:

- Current Unity project builds successfully.
- Build package contains JS Core and bundled Node runtime.
- Direct exe launch can self-start the JS Core bridge.
- Build StreamingAssets action/result loop processes player-like actions.
- Script handbook view opened and rendered role content.

Caveats:

- Default launch showed one non-reproducible early exit in this desktop environment. Windowed launch stayed alive and completed the smoke. Next pass should make the build/run script prefer explicit windowed args for automated user acceptance.
- Raw logs still contain some legacy encoding noise. The captured handbook UI text was readable, but status strings should remain on the UI polish checklist.

## Cleanup

Unity and bridge processes were closed after the run. Generated screenshots/logs remain under ignored `output/`.
