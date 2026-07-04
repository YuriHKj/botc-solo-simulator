# Unity Playable Agent Loop Verification - 2026-06-20

## Scope

Goal: run a self-play, screenshot, diagnose, fix, and verify loop for the BOTC Solo Unity playable until the core flow is smooth across:

- washerwoman, seed `20260607`
- librarian, seed `20260608`
- fortune-teller, seed `9014`
- empath, seed `20260609`
- slayer, seed `270001`
- soldier, seed `20260610`

Playable package produced:

- `output/release-unity-ai/BOTC-Solo-Unity-AI-20260620-agent-loop`
- Executable: `output/release-unity-ai/BOTC-Solo-Unity-AI-20260620-agent-loop/BOTC_Unity_Prototype.exe`

## Round 1: Baseline Self-Play

Commands:

```powershell
npm run test:unity-playable-path
powershell -NoProfile -ExecutionPolicy Bypass -File tools\build_verify_unity_ai_release.ps1 -SkipUiSmoke -NoZip -PackageName BOTC-Solo-Unity-AI-20260620-agent-loop
```

Results:

- `npm run test:unity-playable-path`: passed, `issues: 0`, `blockingIssues: 0`.
- Report: `output/unity-playable-path-smoke/playable_loop_report.json`.
- Summary: `output/unity-playable-path-smoke/playable_loop_summary.json`.
- New package build: passed.
- Package cleanup report: `output/release-unity-ai/release-cleanup-report-latest.json`.

Each required role reached:

- first night
- Day 1 private chat
- Day 1 public discussion
- Day 1 nomination
- Day 1 vote
- second night
- Day 2 loop or endgame

## Real Unity Package Runs

Command pattern:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools\run_unity_playable_demo.ps1 -PackageDir output\release-unity-ai\BOTC-Solo-Unity-AI-20260620-agent-loop -ScriptId tb -Role <role> -Seed <seed> -ExternalBridge -AutoFlow -ResolvePlayerDecisions -StopAtEndgame -RestoreRuntimeState
```

Summary:

| Role | Seed | Result | Day | Human actions |
| --- | ---: | --- | ---: | --- |
| washerwoman | 20260607 | evil win, ended | 4 | none pending |
| librarian | 20260608 | good win, ended | 5 | none pending |
| fortune-teller | 9014 | evil win, ended | 4 | 2 night actions |
| empath | 20260609 | evil win, ended | 5 | none pending |
| slayer | 270001 | evil win, ended | 5 | 1 day action |
| soldier | 20260610 | evil win, ended | 6 | none pending |

Evidence:

- Raw runs: `output/unity-playable-demo-20260620-agent-loop/unity_playable_runs.json`.
- Summary: `output/unity-playable-demo-20260620-agent-loop/unity_playable_runs_summary.json`.

All six package runs ended with:

- `Phase: ended`
- `GameOver: True`
- `FinalStorytellerQueueCount: 0`
- `HumanNightActionAvailable: False`
- `HumanDayActionAvailable: False`

## Screenshots

Initial Unity rendered matrix:

- `output/unity-playable-path-render-smoke-20260620-agent-loop`
- Rerun manifest for the failed tail segment: `output/unity-playable-path-render-smoke-20260620-agent-loop-rerun/playable-node-render-manifest.json`
- Combined dimension audit: `output/unity-playable-path-render-smoke-20260620-agent-loop-combined-audit.json`

HUD fix smoke:

- Manifest: `output/unity-playable-hud-fix-smoke-20260620/playable-node-render-manifest.json`
- 1920 first-night screenshot: `output/unity-playable-hud-fix-smoke-20260620/washerwoman/001-first-night/main-board-1920x1080.png`
- 1366 first-night screenshot: `output/unity-playable-hud-fix-smoke-20260620/washerwoman/001-first-night/main-board-1366x768.png`
- Proactive private queue before accept: `output/unity-playable-hud-fix-smoke-20260620/proactive-whisper/004-proactive-before-accept/main-board-1366x768.png`
- Proactive private queue after first accept: `output/unity-playable-hud-fix-smoke-20260620/proactive-whisper/005-proactive-after-first-accept/main-board-1366x768.png`

One stale screenshot from the first matrix attempt had fallback window dimensions `1107x652`; the same slayer/day-two-loop node was rerun successfully in the rerun manifest.

## Findings And Fixes

### P0

No P0 remained in this round.

Verified:

- Six-role core flow reaches endgame or stable final state.
- Fortune Teller exports and accepts exactly two night targets.
- Empty and one-target Fortune Teller submissions are rejected.
- Multiple proactive private-chat offers are visible together.
- Accepting the first proactive private-chat offer leaves the second visible.
- Pending proactive private-chat offers do not reveal private content or role identity before acceptance.
- First-night protected info appears in `privateInfo` and path smoke reports no mutation issues.
- No pending Storyteller/human action remains at endgame.

### P1 Fixed

Top HUD black overlay was visually too heavy.

Changed:

- `unity-prototype/Assets/Scripts/BotcPrototypeBootstrap.cs`
  - Reduced top HUD pod height from `74` to `64`.
  - Reduced pod alpha from `0.78` to `0.50`.
  - Adjusted header/ticker/status text positions and font sizes.

Regression:

- `tests/unity_ui_audio_regression_contracts.mjs`
  - Added `testTopHudUsesLightweightChrome()`.

### P1 Fixed

Embedded tiny LLM could produce unnatural template-like wording such as `目标是你的`.

Changed:

- `scripts/ai_llm_renderer.js`
  - Added `目标是你(?:的)?` to prompt-like output rejection.
- `tests/ai_llm_renderer_contracts.mjs`
  - Added `testValidationRejectsPackageTargetPronounLeak()`.
- Mirrored renderer to:
  - `unity-prototype/Assets/StreamingAssets/BotcJsCore/scripts/ai_llm_renderer.js`
  - `unity-build/BOTC_Unity_Prototype_Data/StreamingAssets/BotcJsCore/scripts/ai_llm_renderer.js`
  - package StreamingAssets under the produced package.

Package verifier before the fix surfaced an awkward LLM line. After syncing the fix, package verifier passed with natural repaired text:

- `你刚才票型要说清楚，我先不放过。`

### P1/P2 Observed

The proactive private-chat queue on `1366x768` intentionally overlaps part of the right information rail while it is open. It does not hide bottom player tokens or the main action button. This is acceptable for now but remains a polish target.

## Automatic Detection Checklist

- Multiple AI private-chat entries visible: passed.
- Accept first offer leaves second offer visible: passed.
- No role/private content leak before acceptance: passed.
- First-night role information shown and preserved: passed.
- LLM protected facts for washerwoman/librarian/investigator/fortune-teller/empath: passed by `npm run test:ai-llm-renderer`.
- Fortune Teller target count: passed by package core smoke.
- Public discussion advances into nomination/vote/endgame: passed by six package runs and path smoke.
- Nomination, vote, execution, next night: passed by six path scenarios and package runs.
- UI overlap/blocking: no P0; HUD P1 fixed; proactive queue overlap recorded.
- Main menu/non-game premature dialogue: covered by UI smoke states and no observed package verifier leak.
- Local release/output cleanup: one current package, no cleanup candidates; report-only cleanup path exists.

## Validation

Passed:

```powershell
npm run test:unity-playable-path
npm run test:unity-csharp-smoke
npm run test:unity-viewmodel
npm run test:unity-action-bridge
npm run test:ai-llm-renderer
npm run test:ai-llm-dialogue-eval
npm run test:unity-demo-acceptance
npm run test:unity-assets
npm run test:unity-ui-audio
npm run test:unity-build-core-sync
node scripts\unity_core_package_smoke.mjs --package-dir output\release-unity-ai\BOTC-Solo-Unity-AI-20260620-agent-loop --out output\unity-core-package-smoke-20260620-agent-loop
powershell -NoProfile -ExecutionPolicy Bypass -File tools\verify_unity_ai_package.ps1 -PackageDir output\release-unity-ai\BOTC-Solo-Unity-AI-20260620-agent-loop
```

Package build passed:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools\build_verify_unity_ai_release.ps1 -SkipUiSmoke -NoZip -PackageName BOTC-Solo-Unity-AI-20260620-agent-loop
```

Screenshot capture passed after rerun:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools\capture_unity_playable_path_nodes.ps1 -Report output\unity-playable-path-smoke\playable_loop_report.json -UnityExe output\release-unity-ai\BOTC-Solo-Unity-AI-20260620-agent-loop\BOTC_Unity_Prototype.exe -StreamingAssets output\release-unity-ai\BOTC-Solo-Unity-AI-20260620-agent-loop\BOTC_Unity_Prototype_Data\StreamingAssets -Viewports 1920x1080,1366x768 -IncludeProactiveRegression -OutputRoot output\unity-playable-path-render-smoke-20260620-agent-loop-rerun -AllowWindowFallback
```

## Remaining Highest Risk

The loop uses real Unity executable runs and Unity-rendered screenshots, but gameplay decisions are submitted through the bridge automation rather than physical click-by-click mouse input. The remaining highest risk is a click-only UI regression that does not appear in viewmodel/action bridge smoke. A future pass should add targeted click smoke for the proactive queue, action forms, and vote panel.

