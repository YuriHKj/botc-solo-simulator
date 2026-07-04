# Unity Playable UI Refactor Verification - 2026-06-14

## Scope

This pass focused on the first-day playable Unity UI:

- Proactive private whisper offers now render as a visible queue/list instead of a single active card.
- The bottom `对话 / 行动` dock was moved to the lower-right safe area, and the grimoire ring now reserves bottom space when the dock opens.
- Player token cards use a lighter seat/name plate below the token art instead of covering the role/unknown icon.
- The left flow panel keeps compact current-stage, next-action, and blocker/optional-state cards.
- The right info drawer now has player-facing tabs: `日志`, `私聊`, `公开`, `线索`.
- A dedicated `教程/帮助` mode was added to the existing handbook modal; the top HUD opens this help page, while the more-actions menu still opens the role handbook.

## Prompt Governance

Player-facing main UI now keeps:

- Current stage and latest event.
- Current objective, next action, and required blocker state.
- Public-safe pending whisper labels such as player seat/name and "接受后才会显示具体内容".
- Short action labels only.

Moved out of the persistent main UI:

- `点击玩家后可私聊`, info-drawer usage, reminder/help copy, and hint classification now live in the `教程/帮助` handbook mode.
- Detailed private/public history moved to the right info drawer tabs.
- Public speech summaries are filtered to player-visible text and no longer show internal fields such as timeline rationale, target, or evidence.
- Debug/internal guidance is documented as default-hidden in the help page, not displayed on the main board.

## UI Evidence

Final screenshot manifest:

- `output/unity-ui-smoke-playable-ui-20260614-final/manifest.json`
- `output/unity-ui-smoke-playable-ui-20260614-final/visual-regression-report.json`

Required evidence screenshots:

- Multiple pending proactive whispers: `output/unity-ui-smoke-playable-ui-20260614-final/proactive-whisper-queue-1920x1080.png`
- After accepting the first offer, the second remains: `output/unity-ui-smoke-playable-ui-20260614-final/proactive-whisper-after-accept-1920x1080.png`
- Bottom-safe main board at narrow layout: `output/unity-ui-smoke-playable-ui-20260614-final/main-board-1280x720.png`
- Info drawer tabs/content: `output/unity-ui-smoke-playable-ui-20260614-final/information-drawer-1920x1080.png`
- Private chat panel: `output/unity-ui-smoke-playable-ui-20260614-final/private-chat-1920x1080.png`
- Unknown/known/human/dead token coverage fixture: `output/unity-ui-smoke-playable-ui-20260614-final/token-inspector-1920x1080.png`
- Tutorial/help panel: `output/unity-ui-smoke-playable-ui-20260614-final/script-help-1920x1080.png`

Responsive coverage was captured for all required states at:

- `1920x1080`
- `1366x768`
- `1280x720`

The visual smoke verifier reported 21 screenshots, 0 warnings, and 0 failures.

## Build Evidence

Unity Windows build:

- Executable: `unity-build/BOTC_Unity_Prototype.exe`
- Build log: `output/unity-build-ui-refactor-help-20260614-164012.log`
- Success marker: `Unity prototype build succeeded: C:\Users\11507\Documents\Playground\unity-build\BOTC_Unity_Prototype.exe`

The build log contains Unity licensing update warnings, but the build process returned exit code 0 and wrote the success marker.

## Validation Commands

Passed:

- `npm run test:unity-viewmodel`
- `npm run test:unity-action-bridge`
- `npm run test:unity-assets`
- `npm run test:unity-ui-audio`
- `npm run test:unity-demo-acceptance`
- `npm run test:unity-csharp-smoke`
- `npm run test:unity-build-core-sync`
- `node scripts/unity_ui_smoke_fixture.mjs --state script-help --streaming-assets output\ui-fixture-script-help`
- `powershell -ExecutionPolicy Bypass -File tools/capture_unity_ui_smoke.ps1 -States proactive-whisper-queue,proactive-whisper-after-accept,main-board,information-drawer,private-chat,token-inspector,script-help -Viewports 1920x1080,1366x768,1280x720 -RestoreRuntimeState -OutputDir output\unity-ui-smoke-playable-ui-20260614-final`
- `powershell -ExecutionPolicy Bypass -File tools/verify_unity_ui_smoke.ps1 -Manifest output\unity-ui-smoke-playable-ui-20260614-final\manifest.json -RequiredStates proactive-whisper-queue,proactive-whisper-after-accept,main-board,information-drawer,private-chat,token-inspector,script-help -RequiredViewports 1920x1080,1366x768,1280x720 -ReportPath output\unity-ui-smoke-playable-ui-20260614-final\visual-regression-report.json`

`test:unity-csharp-smoke` passed with existing CS0649 warnings for private compose fields that remain unassigned; compilation exit was `CSC_EXIT=0`.

## Remaining Issues

- No release package was produced in this pass; the verified playable output is the local `unity-build` build.
- The help page is intentionally concise. More scenario-specific tutorial copy can be added there later without returning long tutorial text to the main board.
- The existing CS0649 warnings should be cleaned up separately when the private compose preview/readiness fields are either wired or removed.
