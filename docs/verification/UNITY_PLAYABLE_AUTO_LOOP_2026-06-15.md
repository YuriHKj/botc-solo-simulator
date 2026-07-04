# Unity Playable Auto Loop Verification - 2026-06-15

## Scope

Goal: build and run an automated BOTC Unity-playable correction loop that advances fresh games through first-night information, Day 1 private/public/nomination/vote, second night, and endgame or a stable D2 loop while covering these human roles:

- washerwoman
- librarian
- fortune-teller
- empath
- slayer
- soldier

Primary implementation under verification:

- `scripts/unity_playable_path_smoke.mjs`
- `tools/capture_unity_playable_path_nodes.ps1`
- `tools/capture_unity_ui_smoke.ps1`
- `unity-prototype/Assets/Scripts/BotcPrototypeBootstrap.InfoDrawer.cs`
- `unity-prototype/Assets/Scripts/BotcPrototypeBootstrap.cs`
- `tests/unity_asset_contracts.mjs`
- `tests/unity_ui_audio_regression_contracts.mjs`

## Automated Playable Loop Evidence

Command:

```powershell
npm run test:unity-playable-path
```

Result: passed.

Report:

- `output/unity-playable-path-smoke/playable_loop_report.json`

The report recorded `issues: 0` and `blockingIssues: 0`.

Coverage summary:

| Human role | Winner | Actions | Votes | Nodes | Artifact directory |
| --- | --- | ---: | ---: | ---: | --- |
| washerwoman | evil | 64 | 7 | 10 | `output/unity-playable-path-smoke/tb-washerwoman-9p-20260607/` |
| librarian | evil | 53 | 5 | 10 | `output/unity-playable-path-smoke/tb-librarian-9p-20260608/` |
| fortune-teller | good | 52 | 5 | 10 | `output/unity-playable-path-smoke/tb-fortune-teller-9p-9014/` |
| empath | evil | 61 | 7 | 10 | `output/unity-playable-path-smoke/tb-empath-9p-20260609/` |
| slayer | evil | 65 | 7 | 10 | `output/unity-playable-path-smoke/tb-slayer-9p-270001/` |
| soldier | evil | 60 | 6 | 10 | `output/unity-playable-path-smoke/tb-soldier-9p-20260610/` |

Each scenario covered:

- `first-night`
- `day-one-private`
- `day-one-public`
- `day-one-nomination`
- `day-one-vote`
- `second-night`
- `day-two-loop`
- `endgame`

Each node directory contains:

- `unity_state.json`
- `unity_viewmodel.json`
- `unity_action.json`
- `unity_action_result.json`
- `node_summary.json`
- `screen.svg`

Representative screenshot/evidence paths:

- First night: `output/unity-playable-path-smoke/tb-washerwoman-9p-20260607/nodes/002-first-night/screen.svg`
- Day 1 private: `output/unity-playable-path-smoke/tb-washerwoman-9p-20260607/nodes/003-day-one-private/screen.svg`
- Day 1 public: `output/unity-playable-path-smoke/tb-washerwoman-9p-20260607/nodes/004-day-one-public/screen.svg`
- Day 1 nomination: `output/unity-playable-path-smoke/tb-washerwoman-9p-20260607/nodes/005-day-one-nomination/screen.svg`
- Day 1 vote: `output/unity-playable-path-smoke/tb-washerwoman-9p-20260607/nodes/006-day-one-vote/screen.svg`
- Second night: `output/unity-playable-path-smoke/tb-washerwoman-9p-20260607/nodes/007-second-night/screen.svg`
- Endgame: `output/unity-playable-path-smoke/tb-washerwoman-9p-20260607/nodes/010-final/screen.svg`

Note: `screen.svg` files are deterministic viewmodel-derived smoke screenshots. The same node snapshots were also replayed through the packaged Unity executable to generate PNG camera captures below.

## Real Unity Rendered Screenshot Evidence

Command:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools\capture_unity_playable_path_nodes.ps1 -Viewports 1920x1080,1366x768,1024x768 -IncludeProactiveRegression -OutputRoot output\unity-playable-path-render-smoke-20260615
```

Result: passed.

Manifest:

- `output/unity-playable-path-render-smoke-20260615/playable-node-render-manifest.json`

Coverage audit:

- 153 PNG captures.
- Missing role/node/viewport entries: 0.
- Bad image metrics: 0.
- Smoke modes: `main-board` 99, `nomination-debate` 18, `vote-ceremony` 18, `endgame` 18.

The matrix covers every required role across:

- `first-night`
- `day-one-private`
- `day-one-public`
- `day-one-nomination`
- `day-one-vote`
- `second-night`
- `day-two-loop`
- `endgame`

Representative Unity PNG paths:

- Multiple proactive whispers before acceptance: `output/unity-playable-path-render-smoke-20260615/proactive-whisper/050-proactive-before-accept/main-board-1920x1080.png`
- Proactive whisper after first accept: `output/unity-playable-path-render-smoke-20260615/proactive-whisper/051-proactive-after-first-accept/main-board-1920x1080.png`
- Day 1 vote ceremony: `output/unity-playable-path-render-smoke-20260615/washerwoman/005-day-one-vote/vote-ceremony-1920x1080.png`
- Endgame panel: `output/unity-playable-path-render-smoke-20260615/washerwoman/008-endgame/endgame-1920x1080.png`
- Narrow viewport stress capture: `output/unity-playable-path-render-smoke-20260615/proactive-whisper/050-proactive-before-accept/main-board-1024x768.png`

Post-matrix targeted captures were added after tightening the proactive whisper narrow layout and HUD event sanitizer:

- Final 1366 proactive whisper queue: `output/unity-playable-path-render-smoke-compact-check-3/proactive-whisper/003-proactive-before-accept/main-board-1366x768.png`
- Final 1024 proactive whisper queue: `output/unity-playable-path-render-smoke-compact-check-3/proactive-whisper/003-proactive-before-accept/main-board-1024x768.png`
- Final info drawer HUD/event sanitizer check: `output/unity-info-drawer-help-smoke-sanitize-check-3/information-drawer.png`

The final narrow proactive queue keeps bottom player tokens visible and avoids clipping queue controls. The 1024x768 stress layout intentionally compacts the queue text and overlaps the right-side drawer area rather than covering bottom player cards.

## Proactive Whisper Regression

The playable loop includes a deterministic two-offer proactive whisper fixture.

Evidence paths:

- Before accepting first offer: `output/unity-playable-path-smoke/tb-proactive-whisper-queue-9p-880601/nodes/002-proactive-before-accept/screen.svg`
- After accepting first offer: `output/unity-playable-path-smoke/tb-proactive-whisper-queue-9p-880601/nodes/003-proactive-after-first-accept/screen.svg`
- Regression summary: `output/unity-playable-path-smoke/tb-proactive-whisper-queue-9p-880601/playable_summary.json`
- Real Unity before/after PNGs:
  - `output/unity-playable-path-render-smoke-compact-check-3/proactive-whisper/003-proactive-before-accept/main-board-1366x768.png`
  - `output/unity-playable-path-render-smoke-compact-check-3/proactive-whisper/004-proactive-after-first-accept/main-board-1366x768.png`

Verified:

- Two pending proactive whispers are exported together.
- Pending offers do not expose internal prompt/response/reason fields.
- Pending offers do not expose AI role identity before acceptance.
- Accepting the first offer leaves the second offer visible.
- Only accepted private content enters the timeline.

## Auto-Detected Risk Coverage

The loop now checks:

- Required six-role matrix coverage.
- Required flow-node coverage per role.
- Protected first-night info for washerwoman, librarian, fortune-teller, and empath.
- Fortune-teller target count completeness.
- Night/day/storyteller action target-count completeness before submitting actions.
- Proactive whisper queue integrity and pre-acceptance secrecy.
- Static UI safety contracts for bottom dock safe layout, token name plate, help route, proactive queue rows, info drawer tabs, and player-facing info drawer wording.

## UI / Info Drawer Changes Verified

The public information drawer no longer surfaces internal field labels such as `Timeline Rationale`, `reason:`, `cards:`, `target:`, `evidence:`, or `next:` in the public timeline surface. It now maps rationale details to player-facing labels for:

- speaker insight
- summary
- supplemental context
- judgement
- voting
- verification
- evidence basis
- plan
- re-check
- identity

Tests updated to preserve the richer drilldown while preventing internal implementation wording from returning.

Additional UI cleanup verified:

- Top HUD event text now uses a player-facing sanitizer for internal or incomplete private-chat event strings, including `secret-response-*` and dangling `->` events.
- The top ticker is capped before Unity text clipping so long private-chat events do not appear as half-sentences.
- The proactive whisper queue uses a compact narrow-viewport layout for 1366x768 and 1024x768.
- The right info drawer presents four player-facing tabs: `日志`, `私聊`, `公开`, `线索`.
- Tutorial/reference copy is routed to the `script-help` / handbook panel. The main flow panel keeps compact blockers and next-step information only.
- Main-surface retained prompts are blockers/current-stage actions: private chat quota, current stage, next primary action, and pending invitation count. Longer "how to play" material belongs to the help/handbook panel.

Info drawer / help screenshot evidence:

- `output/unity-info-drawer-help-smoke-20260615/info-drawer-1920x1080.png`
- `output/unity-info-drawer-help-smoke-20260615/information-drawer-1920x1080.png`
- `output/unity-info-drawer-help-smoke-20260615/script-help-1920x1080.png`
- Final sanitized info drawer: `output/unity-info-drawer-help-smoke-sanitize-check-3/information-drawer.png`

## Validation Commands

Passed:

```powershell
node --check scripts\unity_playable_path_smoke.mjs
node scripts\unity_playable_path_smoke.mjs --quick --max-actions 220 --out output\unity-playable-path-smoke-debug
npm run test:unity-playable-path
npm run test:unity-viewmodel
npm run test:unity-action-bridge
npm run test:ai-llm-renderer
npm run test:unity-demo-acceptance
npm run test:unity-assets
npm run test:unity-ui-audio
npm run test:unity-csharp-smoke
npm run unity:sync-build-core
npm run test:unity-build-core-sync
powershell -ExecutionPolicy Bypass -File tools\unity_csharp_compile_smoke.ps1 -OutputPath unity-build\BOTC_Unity_Prototype_Data\Managed\Assembly-CSharp.dll
powershell -NoProfile -ExecutionPolicy Bypass -File tools\capture_unity_playable_path_nodes.ps1 -Viewports 1920x1080,1366x768,1024x768 -IncludeProactiveRegression -OutputRoot output\unity-playable-path-render-smoke-20260615
powershell -NoProfile -ExecutionPolicy Bypass -File tools\capture_unity_ui_smoke.ps1 -States info-drawer,information-drawer,script-help -Viewports 1920x1080,1366x768 -OutputDir output\unity-info-drawer-help-smoke-20260615 -RestoreRuntimeState
```

`npm run test:unity-csharp-smoke` passed with existing CS0649 warnings for unassigned optional UI fields and emitted:

- `output/BotcUnityRuntimeSmoke.dll`

Intermediate failure fixed during this verification:

- `npm run test:unity-assets` initially failed because the old contract still required internal `cards:` wording in the info drawer. The test was updated to assert player-facing insight summaries instead, then passed.
- Real Unity visual inspection found two additional UI leaks:
  - Top HUD displayed `secret-response-1-hidden` after accepting a proactive whisper. Fixed by player-facing event sanitization.
  - Top HUD displayed a clipped `1号 ->` private-event prefix in the info-drawer fixture. Fixed by normalizing private arrows and shortening the ticker.
- The 1024/1366 proactive whisper queue initially overlapped bottom/right player tokens. Fixed by compacting and moving the narrow layout toward the right drawer.

## Remaining Risks

- The full playable progression is still driven by the deterministic JS action bridge, then replayed into Unity for node screenshots. This verifies Unity-rendered UI for saved nodes, not click-by-click Unity input automation.
- The 1024x768 proactive whisper queue is readable enough for smoke evidence but intentionally compact; further polish could replace it with a dedicated right-drawer mini-list.
- `unity:sync-build-core` reported `0 files copied`; `test:unity-build-core-sync` passed, so build-core mirrored files are currently considered in sync by the repository script.
