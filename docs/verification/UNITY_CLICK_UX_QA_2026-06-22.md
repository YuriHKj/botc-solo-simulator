# Unity Click UX QA - 2026-06-22

## Package

- Final tested package: `C:\Users\11507\Documents\Playground\output\release-unity-ai\BOTC-Solo-Unity-AI-20260622-click-ux-qa-r22`
- Superseded public action-table/privacy package: `C:\Users\11507\Documents\Playground\output\release-unity-ai\BOTC-Solo-Unity-AI-20260622-click-ux-qa-r21`
- Superseded phase-transition/full-sweep package: `C:\Users\11507\Documents\Playground\output\release-unity-ai\BOTC-Solo-Unity-AI-20260622-click-ux-qa-r20`
- Superseded nomination modal material package: `C:\Users\11507\Documents\Playground\output\release-unity-ai\BOTC-Solo-Unity-AI-20260622-click-ux-qa-r19`
- Superseded folded-log/full-sweep package: `C:\Users\11507\Documents\Playground\output\release-unity-ai\BOTC-Solo-Unity-AI-20260622-click-ux-qa-r18`
- Superseded phase-assist material package: `C:\Users\11507\Documents\Playground\output\release-unity-ai\BOTC-Solo-Unity-AI-20260622-click-ux-qa-r17`
- Superseded public info-drawer package: `C:\Users\11507\Documents\Playground\output\release-unity-ai\BOTC-Solo-Unity-AI-20260622-click-ux-qa-r16`
- Superseded info-drawer clue-card package: `C:\Users\11507\Documents\Playground\output\release-unity-ai\BOTC-Solo-Unity-AI-20260622-click-ux-qa-r14`
- Superseded proactive-invite package: `C:\Users\11507\Documents\Playground\output\release-unity-ai\BOTC-Solo-Unity-AI-20260622-click-ux-qa-r13`
- Superseded public phase-assist package: `C:\Users\11507\Documents\Playground\output\release-unity-ai\BOTC-Solo-Unity-AI-20260622-click-ux-qa-r12`
- Superseded public phase-assist package: `C:\Users\11507\Documents\Playground\output\release-unity-ai\BOTC-Solo-Unity-AI-20260622-click-ux-qa-r11`
- Superseded action-dock package: `C:\Users\11507\Documents\Playground\output\release-unity-ai\BOTC-Solo-Unity-AI-20260622-click-ux-qa-r10`
- Superseded HUD/info-drawer package: `C:\Users\11507\Documents\Playground\output\release-unity-ai\BOTC-Solo-Unity-AI-20260622-click-ux-qa-r6`
- Superseded info-drawer package: `C:\Users\11507\Documents\Playground\output\release-unity-ai\BOTC-Solo-Unity-AI-20260622-click-ux-qa-r5`
- Superseded full-flow package: `C:\Users\11507\Documents\Playground\output\release-unity-ai\BOTC-Solo-Unity-AI-20260622-click-ux-qa-r4`
- Build command: `powershell -NoProfile -ExecutionPolicy Bypass -File tools\package_unity_ai_release.ps1 -PackageName BOTC-Solo-Unity-AI-20260622-click-ux-qa-r22 -VerifyPackage -NoZip`
- Package verification passed. The package script also ran `test:ai-llm-renderer` and `test:unity-action-bridge`.
- r22 LLM verification produced 2 successful timeline entries and 0 fallback entries.
- Compile warnings were existing CS0649 unused/private-field warnings; `CSC_EXIT=0`.

## Click Evidence

### Full 1280x720 sweep

- Command: `powershell -NoProfile -ExecutionPolicy Bypass -File tools\unity_build_click_smoke.ps1 -PackageDir output\release-unity-ai\BOTC-Solo-Unity-AI-20260622-click-ux-qa-r22 -ArtifactDir output\unity-click-ux-qa-2026-06-22\default-1280-r22-rerun2 -WindowWidth 1280 -WindowHeight 720 -AllowVisibleWindow -RestoreRuntimeState`
- Result: passed.
- Report: `output\unity-click-ux-qa-2026-06-22\default-1280-r22-rerun2\click_smoke_report.json`
- Evidence: 126 recorded clicks and 66 screenshots with copied `unity_state.json`, `unity_viewmodel.json`, `unity_action.json`, and `unity_action_result.json` siblings where present.
- Diagnostic note: `default-1280-r18-rerun1` reached the visible nomination window but timed out waiting for the transient `open-nomination-window` action file. The click-smoke harness now accepts stable nomination viewmodel state when the action file has already been superseded. The r20 full sweep additionally accepted stable end-day viewmodel state after transient action files were gone and treats a correct `gameOver=true`, `winner=good` terminal state as success when a final extra phase click is correctly rejected because the game has already ended. The r21 harness retargeted the taller public action table to the correct visible top-row center. The r22 harness also covers the visible left-flow main button after `pass-nomination-window` closes the top action table. The current passing evidence is `default-1280-r22-rerun2`.
- Covered flows:
  - New game from main menu to night 1.
  - Proactive whisper queue accept, private-chat handoff, second-offer reject.
  - Private chat panel open, quick question, alternate target selection, typed message send, close.
  - Public discussion typed player speech, AI speech, AI-opened nomination.
  - Public-to-nomination flow advance.
  - AI nomination.
  - Pass nomination window.
  - Nomination vote yes and next-stage click to night.
  - Passing vote execution/endgame.
  - Human token select, human nomination, vote yes, execution/endgame.
  - Execution candidate day-end death.
  - Info drawer tab clicks.

### Manual Fortune Teller flow

- Command: `powershell -NoProfile -ExecutionPolicy Bypass -File tools\unity_build_click_smoke.ps1 -PackageDir output\release-unity-ai\BOTC-Solo-Unity-AI-20260622-click-ux-qa-r4 -ArtifactDir output\unity-click-ux-qa-2026-06-22\manual-night-1280-r4-rerun1 -OnlyManualNightAction -RestoreRuntimeState -AllowVisibleWindow`
- Result: passed.
- Report: `output\unity-click-ux-qa-2026-06-22\manual-night-1280-r4-rerun1\click_smoke_report.json`
- Final action: `night-action`, targets `p2,p9`, final phase `day`, day stage `private`.
- Key screenshots include:
  - `fortune-teller-scratch-target-selected.png`
  - `fortune-teller-after-reselect-clear.png`
  - `manual-night-action-targets-selected.png`

### Focused nomination vote check

- Command: `powershell -NoProfile -ExecutionPolicy Bypass -File tools\unity_build_click_smoke.ps1 -PackageDir output\release-unity-ai\BOTC-Solo-Unity-AI-20260622-click-ux-qa-r4 -ArtifactDir output\unity-click-ux-qa-2026-06-22\nomination-vote-1280-r4-rerun1 -OnlyNominationVote -RestoreRuntimeState -AllowVisibleWindow -ActionTimeoutSeconds 20`
- Result: passed.
- Vote passed with 7 yes votes; next-stage click emitted `phase`; final phase `night`.

### 1920x1080 social/fullscreen slice

- Command: `powershell -NoProfile -ExecutionPolicy Bypass -File tools\unity_build_click_smoke.ps1 -PackageDir output\release-unity-ai\BOTC-Solo-Unity-AI-20260622-click-ux-qa-r4 -ArtifactDir output\unity-click-ux-qa-2026-06-22\social-1920-fullscreen-r4-rerun2 -OnlySocial -RestoreRuntimeState -AllowVisibleWindow -WindowWidth 1920 -WindowHeight 1080 -Fullscreen`
- Result: passed.
- Report: `output\unity-click-ux-qa-2026-06-22\social-1920-fullscreen-r4-rerun2\click_smoke_report.json`
- Evidence: 64 recorded clicks and 36 screenshots. The report records launch size `1920x1080`, `fullscreen=true`, and click reference `1280x720`.
- Covered flows:
  - Proactive queue accept/reject at 1080p.
  - Private chat quick question, typed send, alternate target selection, and close.
  - Public discussion player speech, AI speech, and AI-opened nomination.
  - AI nomination and pass nomination at 1080p.
- Key screenshots include:
  - `proactive-queue-before-accept.png`
  - `proactive-queue-after-accept-private-chat.png`
  - `private-chat-panel-open.png`
  - `public-discussion-before-player-input.png`
  - `public-discussion-opened-nomination-window.png`
  - `ai-nomination-before-click.png`
  - `pass-nomination-before-click.png`

### 1366x768 main-board/info-drawer slice

- Command: `powershell -NoProfile -ExecutionPolicy Bypass -File tools\unity_build_click_smoke.ps1 -PackageDir output\release-unity-ai\BOTC-Solo-Unity-AI-20260622-click-ux-qa-r4 -ArtifactDir output\unity-click-ux-qa-2026-06-22\info-drawer-1366-r4-rerun1 -OnlyInfoDrawer -RestoreRuntimeState -AllowVisibleWindow -WindowWidth 1366 -WindowHeight 768`
- Result: passed.
- Report: `output\unity-click-ux-qa-2026-06-22\info-drawer-1366-r4-rerun1\click_smoke_report.json`
- Evidence: 8 screenshots covering the 1366 main board and info drawer tab sequence:
  - `info-drawer-before-open.png`
  - `info-drawer-events-tab.png`
  - `info-drawer-whispers-tab.png`
  - `info-drawer-public-tab.png`
  - `info-drawer-clues-tab.png`

### Info drawer polish on r5

- Change: the `私聊` drawer tab now renders notebook-style player cards instead of dense text. Each card groups by player and separates identity claim, night information, latest line, and verification state. Pending proactive invitations still hide specific content until accepted.
- 1920 command: `powershell -NoProfile -ExecutionPolicy Bypass -File tools\unity_build_click_smoke.ps1 -PackageDir output\release-unity-ai\BOTC-Solo-Unity-AI-20260622-click-ux-qa-r5 -ArtifactDir output\unity-click-ux-qa-2026-06-22\info-drawer-1920-fullscreen-r5-rerun2 -OnlyInfoDrawer -RestoreRuntimeState -AllowVisibleWindow -WindowWidth 1920 -WindowHeight 1080 -Fullscreen`
- 1920 result: passed. Report: `output\unity-click-ux-qa-2026-06-22\info-drawer-1920-fullscreen-r5-rerun2\click_smoke_report.json`
- 1366 command: `powershell -NoProfile -ExecutionPolicy Bypass -File tools\unity_build_click_smoke.ps1 -PackageDir output\release-unity-ai\BOTC-Solo-Unity-AI-20260622-click-ux-qa-r5 -ArtifactDir output\unity-click-ux-qa-2026-06-22\info-drawer-1366-r5-rerun1 -OnlyInfoDrawer -RestoreRuntimeState -AllowVisibleWindow -WindowWidth 1366 -WindowHeight 768`
- 1366 result: passed. Report: `output\unity-click-ux-qa-2026-06-22\info-drawer-1366-r5-rerun1\click_smoke_report.json`
- Key screenshots:
  - `output\unity-click-ux-qa-2026-06-22\info-drawer-1920-fullscreen-r5-rerun2\info-drawer-whispers-tab.png`
  - `output\unity-click-ux-qa-2026-06-22\info-drawer-1366-r5-rerun1\info-drawer-whispers-tab.png`

### HUD and side-rail polish on r6

- Change: the top HUD shadow, top-left brand/ticker pod, top-right system pod, left flow rail, right info rail, and flow task cards now use lighter translucent fills and subtler frames. Button positions and action routing were not moved.
- 1366 command: `powershell -NoProfile -ExecutionPolicy Bypass -File tools\unity_build_click_smoke.ps1 -PackageDir output\release-unity-ai\BOTC-Solo-Unity-AI-20260622-click-ux-qa-r6 -ArtifactDir output\unity-click-ux-qa-2026-06-22\info-drawer-1366-r6-rerun1 -OnlyInfoDrawer -RestoreRuntimeState -AllowVisibleWindow -WindowWidth 1366 -WindowHeight 768`
- 1366 result: passed. Report: `output\unity-click-ux-qa-2026-06-22\info-drawer-1366-r6-rerun1\click_smoke_report.json`
- 1366 evidence: 11 click-trace entries and 11 screenshots. Window `1366x768`, click reference `1280x720`, final action `decline-proactive-whisper`.
- 1920 command: `powershell -NoProfile -ExecutionPolicy Bypass -File tools\unity_build_click_smoke.ps1 -PackageDir output\release-unity-ai\BOTC-Solo-Unity-AI-20260622-click-ux-qa-r6 -ArtifactDir output\unity-click-ux-qa-2026-06-22\info-drawer-1920-fullscreen-r6-rerun1 -OnlyInfoDrawer -RestoreRuntimeState -AllowVisibleWindow -WindowWidth 1920 -WindowHeight 1080 -Fullscreen`
- 1920 result: passed. Report: `output\unity-click-ux-qa-2026-06-22\info-drawer-1920-fullscreen-r6-rerun1\click_smoke_report.json`
- 1920 evidence: 21 click-trace entries and 11 screenshots. Window `1920x1080`, `fullscreen=true`, click reference `1280x720`, final action `decline-proactive-whisper`.
- Key screenshots:
  - `output\unity-click-ux-qa-2026-06-22\info-drawer-1366-r6-rerun1\info-drawer-before-open.png`
  - `output\unity-click-ux-qa-2026-06-22\info-drawer-1366-r6-rerun1\info-drawer-whispers-tab.png`
  - `output\unity-click-ux-qa-2026-06-22\info-drawer-1920-fullscreen-r6-rerun1\info-drawer-before-open.png`

### Bottom action dock polish on r8

- Change: the bottom `对话 / 行动` area now uses a shorter, lighter action dock. The main panel height is reduced, translucent fills and dividers are softer, the objective/action regions are visually separated, secondary buttons use compact styling, and the primary `行动` button remains prominent. Existing button coordinates and action routes were preserved.
- 1366 command: `powershell -NoProfile -ExecutionPolicy Bypass -File tools\unity_build_click_smoke.ps1 -PackageDir output\release-unity-ai\BOTC-Solo-Unity-AI-20260622-click-ux-qa-r8 -ArtifactDir output\unity-click-ux-qa-2026-06-22\social-1366-r8-rerun1 -OnlySocial -RestoreRuntimeState -AllowVisibleWindow -WindowWidth 1366 -WindowHeight 768`
- 1366 result: passed. Report: `output\unity-click-ux-qa-2026-06-22\social-1366-r8-rerun1\click_smoke_report.json`
- 1366 evidence: 46 click-trace entries and 36 screenshots. Window `1366x768`, click reference `1280x720`.
- 1920 command: `powershell -NoProfile -ExecutionPolicy Bypass -File tools\unity_build_click_smoke.ps1 -PackageDir output\release-unity-ai\BOTC-Solo-Unity-AI-20260622-click-ux-qa-r8 -ArtifactDir output\unity-click-ux-qa-2026-06-22\social-1920-fullscreen-r8-rerun1 -OnlySocial -RestoreRuntimeState -AllowVisibleWindow -WindowWidth 1920 -WindowHeight 1080 -Fullscreen`
- 1920 result: passed. Report: `output\unity-click-ux-qa-2026-06-22\social-1920-fullscreen-r8-rerun1\click_smoke_report.json`
- 1920 evidence: 64 click-trace entries and 36 screenshots. Window `1920x1080`, `fullscreen=true`, click reference `1280x720`.
- Covered r8 flows:
  - Proactive invite accept and reject.
  - Bottom action dock open and private-chat entry.
  - Private chat quick question, typed message, alternate target selection, send, and close.
  - Public discussion player speech and AI speech.
  - AI-opened nomination window, AI nomination, and pass nomination.
- Key screenshots:
  - `output\unity-click-ux-qa-2026-06-22\social-1366-r8-rerun1\private-chat-action-dock-open.png`
  - `output\unity-click-ux-qa-2026-06-22\social-1920-fullscreen-r8-rerun1\private-chat-action-dock-open.png`
  - `output\unity-click-ux-qa-2026-06-22\social-1920-fullscreen-r8-rerun1\public-discussion-before-player-input.png`
  - `output\unity-click-ux-qa-2026-06-22\social-1920-fullscreen-r8-rerun1\public-discussion-opened-nomination-window.png`

### Phase-aware action dock on r10

- Change: the bottom dock now hides stage-irrelevant buttons instead of showing six equal actions at all times. Private stage shows `私聊 / 公聊 / 更多`; public stage exposes public discussion and nomination; nomination/vote states expose nomination and vote; night or available action forms expose the primary `行动` button. Empty `voteCeremony` viewmodels no longer make the vote button appear during private chat setup.
- 1366 social command: `powershell -NoProfile -ExecutionPolicy Bypass -File tools\unity_build_click_smoke.ps1 -PackageDir output\release-unity-ai\BOTC-Solo-Unity-AI-20260622-click-ux-qa-r10 -ArtifactDir output\unity-click-ux-qa-2026-06-22\social-1366-r10-rerun1 -OnlySocial -RestoreRuntimeState -AllowVisibleWindow -WindowWidth 1366 -WindowHeight 768`
- 1366 social result: passed. Report: `output\unity-click-ux-qa-2026-06-22\social-1366-r10-rerun1\click_smoke_report.json`
- 1366 evidence: 46 click-trace entries and 36 screenshots. Window `1366x768`, click reference `1280x720`.
- 1920 social command: `powershell -NoProfile -ExecutionPolicy Bypass -File tools\unity_build_click_smoke.ps1 -PackageDir output\release-unity-ai\BOTC-Solo-Unity-AI-20260622-click-ux-qa-r10 -ArtifactDir output\unity-click-ux-qa-2026-06-22\social-1920-fullscreen-r10-rerun1 -OnlySocial -RestoreRuntimeState -AllowVisibleWindow -WindowWidth 1920 -WindowHeight 1080 -Fullscreen`
- 1920 social result: passed. Report: `output\unity-click-ux-qa-2026-06-22\social-1920-fullscreen-r10-rerun1\click_smoke_report.json`
- 1920 evidence: 67 click-trace entries and 36 screenshots. Window `1920x1080`, `fullscreen=true`, click reference `1280x720`.
- Manual night command: `powershell -NoProfile -ExecutionPolicy Bypass -File tools\unity_build_click_smoke.ps1 -PackageDir output\release-unity-ai\BOTC-Solo-Unity-AI-20260622-click-ux-qa-r10 -ArtifactDir output\unity-click-ux-qa-2026-06-22\manual-night-1280-r10-rerun1 -OnlyManualNightAction -RestoreRuntimeState -AllowVisibleWindow`
- Manual night result: passed. Report: `output\unity-click-ux-qa-2026-06-22\manual-night-1280-r10-rerun1\click_smoke_report.json`
- Manual night evidence: 18 click-trace entries and 6 screenshots; final action `night-action`, targets `p2,p9`, final phase `day`, day stage `private`.
- Key screenshots:
  - `output\unity-click-ux-qa-2026-06-22\social-1366-r10-rerun1\private-chat-action-dock-open.png`
  - `output\unity-click-ux-qa-2026-06-22\social-1920-fullscreen-r10-rerun1\private-chat-action-dock-open.png`
  - `output\unity-click-ux-qa-2026-06-22\manual-night-1280-r10-rerun1\fortune-teller-scratch-target-selected.png`

### Compact public/nomination phase assist on r12

- Change: the public discussion and nomination `Phase Assist Panel` now renders as a compact translucent top rail instead of a tall dark console. Public discussion exposes the existing `说话 / 焦点 / 下一步` signal chips, shortens the title to `speaker -> focus`, trims the hint copy, and preserves the same action bridge commands. The click-smoke public/nomination button coordinates were updated to the new rail center.
- r12 package verification passed. The package script also ran `test:ai-llm-renderer` and `test:unity-action-bridge`; LLM verification produced 2 successful timeline entries and 0 fallback entries.
- 1366 social command: `powershell -NoProfile -ExecutionPolicy Bypass -File tools\unity_build_click_smoke.ps1 -PackageDir output\release-unity-ai\BOTC-Solo-Unity-AI-20260622-click-ux-qa-r12 -ArtifactDir output\unity-click-ux-qa-2026-06-22\social-1366-r12-rerun3 -OnlySocial -RestoreRuntimeState -AllowVisibleWindow -WindowWidth 1366 -WindowHeight 768`
- 1366 social result: passed. Report: `output\unity-click-ux-qa-2026-06-22\social-1366-r12-rerun3\click_smoke_report.json`
- 1366 evidence: 46 click-trace entries and 36 screenshots. Window `1366x768`, click reference `1280x720`.
- 1920 social command: `powershell -NoProfile -ExecutionPolicy Bypass -File tools\unity_build_click_smoke.ps1 -PackageDir output\release-unity-ai\BOTC-Solo-Unity-AI-20260622-click-ux-qa-r12 -ArtifactDir output\unity-click-ux-qa-2026-06-22\social-1920-fullscreen-r12-rerun1 -OnlySocial -RestoreRuntimeState -AllowVisibleWindow -WindowWidth 1920 -WindowHeight 1080 -Fullscreen`
- 1920 social result: passed. Report: `output\unity-click-ux-qa-2026-06-22\social-1920-fullscreen-r12-rerun1\click_smoke_report.json`
- 1920 evidence: 64 click-trace entries and 36 screenshots. Window `1920x1080`, `fullscreen=true`, click reference `1280x720`.
- Key screenshots:
  - `output\unity-click-ux-qa-2026-06-22\social-1366-r12-rerun3\public-discussion-before-player-input.png`
  - `output\unity-click-ux-qa-2026-06-22\social-1366-r12-rerun3\ai-nomination-before-click.png`
  - `output\unity-click-ux-qa-2026-06-22\social-1920-fullscreen-r12-rerun1\public-discussion-before-player-input.png`

### Proactive private-chat invite cards on r13

- Change: the proactive private-chat panel now uses lighter fills and invitation-card rows. The active invitation title reads as `N号想私聊`, the meta copy states that private content remains hidden before acceptance, and each queued invite row shows player, `新/待` state, public intent, public reason, and accept/reject buttons. Action routes for accepting, snoozing, and declining were preserved.
- r13 package verification passed. The package script also ran `test:ai-llm-renderer` and `test:unity-action-bridge`; LLM verification produced 2 successful timeline entries and 0 fallback entries.
- 1366 social command: `powershell -NoProfile -ExecutionPolicy Bypass -File tools\unity_build_click_smoke.ps1 -PackageDir output\release-unity-ai\BOTC-Solo-Unity-AI-20260622-click-ux-qa-r13 -ArtifactDir output\unity-click-ux-qa-2026-06-22\social-1366-r13-rerun1 -OnlySocial -RestoreRuntimeState -AllowVisibleWindow -WindowWidth 1366 -WindowHeight 768`
- 1366 social result: passed. Report: `output\unity-click-ux-qa-2026-06-22\social-1366-r13-rerun1\click_smoke_report.json`
- 1366 evidence: 46 click-trace entries and 36 screenshots. Window `1366x768`, click reference `1280x720`.
- 1920 social command: `powershell -NoProfile -ExecutionPolicy Bypass -File tools\unity_build_click_smoke.ps1 -PackageDir output\release-unity-ai\BOTC-Solo-Unity-AI-20260622-click-ux-qa-r13 -ArtifactDir output\unity-click-ux-qa-2026-06-22\social-1920-fullscreen-r13-rerun1 -OnlySocial -RestoreRuntimeState -AllowVisibleWindow -WindowWidth 1920 -WindowHeight 1080 -Fullscreen`
- 1920 social result: passed. Report: `output\unity-click-ux-qa-2026-06-22\social-1920-fullscreen-r13-rerun1\click_smoke_report.json`
- 1920 evidence: 67 click-trace entries and 36 screenshots. Window `1920x1080`, `fullscreen=true`, click reference `1280x720`.
- Key screenshots:
  - `output\unity-click-ux-qa-2026-06-22\social-1366-r13-rerun1\proactive-queue-before-accept.png`
  - `output\unity-click-ux-qa-2026-06-22\social-1366-r13-rerun1\proactive-queue-after-accept-private-chat.png`
  - `output\unity-click-ux-qa-2026-06-22\social-1366-r13-rerun1\proactive-queue-before-reject-second.png`

### Info drawer clue cards on r14

- Change: the `线索` drawer tab now renders four notebook cards instead of a dense text recap: `已知信息`, `待验证`, `身份声称`, and `社交线索 / 下一步`. The tab subtitle now uses player-facing `摘要` copy, and clue lines sanitize backend-flavored words such as payload/viewmodel/JS Core before rendering.
- r14 package verification passed. The package script also ran `test:ai-llm-renderer` and `test:unity-action-bridge`; LLM verification produced 2 successful timeline entries and 0 fallback entries.
- 1366 info-drawer command: `powershell -NoProfile -ExecutionPolicy Bypass -File tools\unity_build_click_smoke.ps1 -PackageDir output\release-unity-ai\BOTC-Solo-Unity-AI-20260622-click-ux-qa-r14 -ArtifactDir output\unity-click-ux-qa-2026-06-22\info-drawer-1366-r14-rerun1 -OnlyInfoDrawer -WindowWidth 1366 -WindowHeight 768 -AllowVisibleWindow -RestoreRuntimeState`
- 1366 result: passed. Report: `output\unity-click-ux-qa-2026-06-22\info-drawer-1366-r14-rerun1\click_smoke_report.json`
- 1366 evidence: 11 click-trace entries and 11 screenshots. Window `1366x768`, click reference `1280x720`, final action `decline-proactive-whisper`.
- 1920 fullscreen info-drawer command: `powershell -NoProfile -ExecutionPolicy Bypass -File tools\unity_build_click_smoke.ps1 -PackageDir output\release-unity-ai\BOTC-Solo-Unity-AI-20260622-click-ux-qa-r14 -ArtifactDir output\unity-click-ux-qa-2026-06-22\info-drawer-1920-fullscreen-r14-rerun1 -OnlyInfoDrawer -WindowWidth 1920 -WindowHeight 1080 -Fullscreen -AllowVisibleWindow -RestoreRuntimeState`
- 1920 result: passed. Report: `output\unity-click-ux-qa-2026-06-22\info-drawer-1920-fullscreen-r14-rerun1\click_smoke_report.json`
- 1920 evidence: 21 click-trace entries and 11 screenshots. Window `1920x1080`, `fullscreen=true`, click reference `1280x720`, final action `decline-proactive-whisper`.
- Key screenshots:
  - `output\unity-click-ux-qa-2026-06-22\info-drawer-1366-r14-rerun1\info-drawer-clues-tab.png`
  - `output\unity-click-ux-qa-2026-06-22\info-drawer-1920-fullscreen-r14-rerun1\info-drawer-clues-tab.png`
  - `output\unity-click-ux-qa-2026-06-22\info-drawer-1366-r14-rerun1\info-drawer-whispers-tab.png`

### Public info-drawer cards on r16

- Change: the `公开` drawer tab now renders notebook cards from public timeline entries instead of a sparse text page. The cards group by day and focus player, show the latest speaker line, and keep an explicit next-step chip. The empty public state now uses a player-facing card and hides the old duplicate footer text.
- Tooling: `tools\unity_build_click_smoke.ps1` gained `-InfoDrawerPublicFixture`; `scripts\unity_ui_smoke_fixture.mjs` gained `information-drawer-public`, which preserves public timeline data while returning to a stage where the drawer entry point is visible.
- r16 package verification passed. The package script also ran `test:ai-llm-renderer` and `test:unity-action-bridge`; LLM verification produced 2 successful timeline entries and 0 fallback entries.
- Default 1366 info-drawer command: `powershell -NoProfile -ExecutionPolicy Bypass -File tools\unity_build_click_smoke.ps1 -PackageDir output\release-unity-ai\BOTC-Solo-Unity-AI-20260622-click-ux-qa-r16 -ArtifactDir output\unity-click-ux-qa-2026-06-22\info-drawer-1366-r16-rerun1 -OnlyInfoDrawer -WindowWidth 1366 -WindowHeight 768 -AllowVisibleWindow -RestoreRuntimeState`
- Default 1366 result: passed. Report: `output\unity-click-ux-qa-2026-06-22\info-drawer-1366-r16-rerun1\click_smoke_report.json`; 11 click-trace entries and 11 screenshots.
- Default 1920 command: `powershell -NoProfile -ExecutionPolicy Bypass -File tools\unity_build_click_smoke.ps1 -PackageDir output\release-unity-ai\BOTC-Solo-Unity-AI-20260622-click-ux-qa-r16 -ArtifactDir output\unity-click-ux-qa-2026-06-22\info-drawer-1920-fullscreen-r16-rerun1 -OnlyInfoDrawer -WindowWidth 1920 -WindowHeight 1080 -Fullscreen -AllowVisibleWindow -RestoreRuntimeState`
- Default 1920 result: passed. Report: `output\unity-click-ux-qa-2026-06-22\info-drawer-1920-fullscreen-r16-rerun1\click_smoke_report.json`; 21 click-trace entries and 11 screenshots.
- Populated public 1366 command: `powershell -NoProfile -ExecutionPolicy Bypass -File tools\unity_build_click_smoke.ps1 -PackageDir output\release-unity-ai\BOTC-Solo-Unity-AI-20260622-click-ux-qa-r16 -ArtifactDir output\unity-click-ux-qa-2026-06-22\info-drawer-public-1366-r16-rerun2 -OnlyInfoDrawer -InfoDrawerPublicFixture -WindowWidth 1366 -WindowHeight 768 -AllowVisibleWindow -RestoreRuntimeState`
- Populated public 1366 result: passed. Report: `output\unity-click-ux-qa-2026-06-22\info-drawer-public-1366-r16-rerun2\click_smoke_report.json`; 11 click-trace entries, 11 screenshots, 5 timeline entries.
- Populated public 1920 command: `powershell -NoProfile -ExecutionPolicy Bypass -File tools\unity_build_click_smoke.ps1 -PackageDir output\release-unity-ai\BOTC-Solo-Unity-AI-20260622-click-ux-qa-r16 -ArtifactDir output\unity-click-ux-qa-2026-06-22\info-drawer-public-1920-fullscreen-r16-rerun1 -OnlyInfoDrawer -InfoDrawerPublicFixture -WindowWidth 1920 -WindowHeight 1080 -Fullscreen -AllowVisibleWindow -RestoreRuntimeState`
- Populated public 1920 result: passed. Report: `output\unity-click-ux-qa-2026-06-22\info-drawer-public-1920-fullscreen-r16-rerun1\click_smoke_report.json`; 21 click-trace entries, 11 screenshots, 5 timeline entries.
- 1366 social rerun with r16 also passed: `output\unity-click-ux-qa-2026-06-22\social-1366-r16-rerun2\click_smoke_report.json`; 54 click-trace entries and 37 screenshots.
- Key screenshots:
  - `output\unity-click-ux-qa-2026-06-22\info-drawer-1366-r16-rerun1\info-drawer-public-tab.png`
  - `output\unity-click-ux-qa-2026-06-22\info-drawer-public-1366-r16-rerun2\info-drawer-public-tab.png`
  - `output\unity-click-ux-qa-2026-06-22\info-drawer-public-1920-fullscreen-r16-rerun1\info-drawer-public-tab.png`
  - `output\unity-click-ux-qa-2026-06-22\social-1366-r16-rerun2\public-discussion-after-player-speech.png`

### Phase-assist material polish on r17

- Change: the public discussion and nomination phase-assist rail keeps the r12 compact geometry and click targets, but replaces the remaining high-alpha black fills with warmer translucent table/card surfaces. The right-side signal strip, signal chips, frame colors, header wash, and public speech input now read less like a debug console while preserving the same action bridge commands.
- r17 package verification passed. The package script also ran `test:ai-llm-renderer` and `test:unity-action-bridge`; LLM verification produced 2 successful timeline entries and 0 fallback entries.
- 1366 social command: `powershell -NoProfile -ExecutionPolicy Bypass -File tools\unity_build_click_smoke.ps1 -PackageDir output\release-unity-ai\BOTC-Solo-Unity-AI-20260622-click-ux-qa-r17 -ArtifactDir output\unity-click-ux-qa-2026-06-22\social-1366-r17-rerun2 -OnlySocial -WindowWidth 1366 -WindowHeight 768 -AllowVisibleWindow -RestoreRuntimeState`
- 1366 social result: passed. Report: `output\unity-click-ux-qa-2026-06-22\social-1366-r17-rerun2\click_smoke_report.json`; 46 click-trace entries and 36 screenshots.
- 1920 fullscreen social command: `powershell -NoProfile -ExecutionPolicy Bypass -File tools\unity_build_click_smoke.ps1 -PackageDir output\release-unity-ai\BOTC-Solo-Unity-AI-20260622-click-ux-qa-r17 -ArtifactDir output\unity-click-ux-qa-2026-06-22\social-1920-fullscreen-r17-rerun2 -OnlySocial -WindowWidth 1920 -WindowHeight 1080 -Fullscreen -AllowVisibleWindow -RestoreRuntimeState`
- 1920 fullscreen social result: passed. Report: `output\unity-click-ux-qa-2026-06-22\social-1920-fullscreen-r17-rerun2\click_smoke_report.json`; 67 click-trace entries and 36 screenshots.
- Diagnostic note: `social-1366-r17-rerun1` failed before reaching the game flow because a Windows Security Center firewall dialog for NVIDIA App covered the Unity window. This was an external host popup; the clean rerun above passed.
- Key screenshots:
  - `output\unity-click-ux-qa-2026-06-22\social-1366-r17-rerun2\public-discussion-before-player-input.png`
  - `output\unity-click-ux-qa-2026-06-22\social-1366-r17-rerun2\ai-nomination-before-click.png`
  - `output\unity-click-ux-qa-2026-06-22\social-1366-r17-rerun2\pass-nomination-before-click.png`
  - `output\unity-click-ux-qa-2026-06-22\social-1920-fullscreen-r17-rerun2\public-discussion-before-player-input.png`

### r19 nomination modal material and current-package sweep

- Change: the stage-dialogue shell and nomination-debate shell now use warmer translucent table materials instead of near-black plates. The visual pass is material-only: panel bounds, buttons, and action bridge routing were not moved.
- r19 package verification passed. The package script also ran `test:ai-llm-renderer` and `test:unity-action-bridge`; LLM verification produced 2 successful timeline entries and 0 fallback entries.
- 1366 social command: `powershell -NoProfile -ExecutionPolicy Bypass -File tools\unity_build_click_smoke.ps1 -PackageDir output\release-unity-ai\BOTC-Solo-Unity-AI-20260622-click-ux-qa-r19 -ArtifactDir output\unity-click-ux-qa-2026-06-22\social-1366-r19-rerun1 -OnlySocial -WindowWidth 1366 -WindowHeight 768 -AllowVisibleWindow -RestoreRuntimeState`
- 1366 social result: passed. Report: `output\unity-click-ux-qa-2026-06-22\social-1366-r19-rerun1\click_smoke_report.json`; 46 click-trace entries and 36 screenshots.
- Full 1280 sweep command: `powershell -NoProfile -ExecutionPolicy Bypass -File tools\unity_build_click_smoke.ps1 -PackageDir output\release-unity-ai\BOTC-Solo-Unity-AI-20260622-click-ux-qa-r19 -ArtifactDir output\unity-click-ux-qa-2026-06-22\default-1280-r19-rerun1 -WindowWidth 1280 -WindowHeight 720 -AllowVisibleWindow -RestoreRuntimeState`
- Full 1280 sweep result: passed. Report: `output\unity-click-ux-qa-2026-06-22\default-1280-r19-rerun1\click_smoke_report.json`; 118 click-trace entries and 69 screenshots.
- Superseded diagnostic: `output\unity-click-ux-qa-2026-06-22\default-1280-r18-rerun1\click_smoke_report.json` failed after visibly opening the nomination window because the harness waited only for a transient bridge action file. `tools\unity_build_click_smoke.ps1` now retargets flow-advance clicks to the compact rail center at `y=70` and confirms nomination through stable viewmodel state if the action file has already advanced.
- Visual note: `public-discussion-opened-nomination-window.png` is warmer and less debug-like in the modal plates, but the full-screen phase-transition layer still darkens the table heavily in r19. This visual issue is superseded by the r20 transparent phase-transition pass below.
- Key screenshots:
  - `output\unity-click-ux-qa-2026-06-22\social-1366-r19-rerun1\public-discussion-before-player-input.png`
  - `output\unity-click-ux-qa-2026-06-22\social-1366-r19-rerun1\public-discussion-opened-nomination-window.png`
  - `output\unity-click-ux-qa-2026-06-22\social-1366-r19-rerun1\ai-nomination-before-click.png`
  - `output\unity-click-ux-qa-2026-06-22\social-1366-r19-rerun1\pass-nomination-before-click.png`
  - `output\unity-click-ux-qa-2026-06-22\default-1280-r19-rerun1\flow-advance-before-click.png`
  - `output\unity-click-ux-qa-2026-06-22\default-1280-r19-rerun1\public-discussion-opened-nomination-window.png`
  - `output\unity-click-ux-qa-2026-06-22\default-1280-r19-rerun1\info-drawer-events-tab.png`

### r22 compact top HUD and left-flow day-end click

- Change: the top HUD now uses shorter, lighter left/right pods. The brand/recent-event block no longer stretches as far across the board, and the right-side menu/settings/help/new-game controls use compact HUD tool buttons instead of full-size menu buttons inside a dark bar.
- Harness change: `tools\unity_build_click_smoke.ps1` now includes the visible left-flow main button as an end-day advance candidate. `default-1280-r22-rerun1` exposed that after `pass-nomination-window` closed the top action table, the player-visible left button was the correct route to night; `default-1280-r22-rerun2` is the passing evidence.
- r22 package verification passed. The package script also ran `test:ai-llm-renderer` and `test:unity-action-bridge`; LLM verification produced 2 successful timeline entries and 0 fallback entries.
- 1366 social command: `powershell -NoProfile -ExecutionPolicy Bypass -File tools\unity_build_click_smoke.ps1 -PackageDir output\release-unity-ai\BOTC-Solo-Unity-AI-20260622-click-ux-qa-r22 -ArtifactDir output\unity-click-ux-qa-2026-06-22\social-1366-r22-rerun1 -OnlySocial -RestoreRuntimeState -AllowVisibleWindow -WindowWidth 1366 -WindowHeight 768`
- 1366 social result: passed. Report: `output\unity-click-ux-qa-2026-06-22\social-1366-r22-rerun1\click_smoke_report.json`; 46 click-trace entries and 36 screenshots.
- 1920 fullscreen info-drawer command: `powershell -NoProfile -ExecutionPolicy Bypass -File tools\unity_build_click_smoke.ps1 -PackageDir output\release-unity-ai\BOTC-Solo-Unity-AI-20260622-click-ux-qa-r22 -ArtifactDir output\unity-click-ux-qa-2026-06-22\info-drawer-1920-fullscreen-r22-rerun1 -OnlyInfoDrawer -RestoreRuntimeState -AllowVisibleWindow -WindowWidth 1920 -WindowHeight 1080 -Fullscreen`
- 1920 fullscreen info-drawer result: passed. Report: `output\unity-click-ux-qa-2026-06-22\info-drawer-1920-fullscreen-r22-rerun1\click_smoke_report.json`; 21 click-trace entries and 11 screenshots.
- Full 1280 sweep command: `powershell -NoProfile -ExecutionPolicy Bypass -File tools\unity_build_click_smoke.ps1 -PackageDir output\release-unity-ai\BOTC-Solo-Unity-AI-20260622-click-ux-qa-r22 -ArtifactDir output\unity-click-ux-qa-2026-06-22\default-1280-r22-rerun2 -WindowWidth 1280 -WindowHeight 720 -AllowVisibleWindow -RestoreRuntimeState`
- Full 1280 sweep result: passed. Report: `output\unity-click-ux-qa-2026-06-22\default-1280-r22-rerun2\click_smoke_report.json`; 126 click-trace entries and 66 screenshots.
- Key screenshots:
  - `output\unity-click-ux-qa-2026-06-22\social-1366-r22-rerun1\proactive-queue-before-accept.png`
  - `output\unity-click-ux-qa-2026-06-22\social-1366-r22-rerun1\public-discussion-before-player-input.png`
  - `output\unity-click-ux-qa-2026-06-22\social-1366-r22-rerun1\public-discussion-opened-nomination-window.png`
  - `output\unity-click-ux-qa-2026-06-22\info-drawer-1920-fullscreen-r22-rerun1\info-drawer-before-open.png`
  - `output\unity-click-ux-qa-2026-06-22\info-drawer-1920-fullscreen-r22-rerun1\info-drawer-events-tab.png`
  - `output\unity-click-ux-qa-2026-06-22\default-1280-r22-rerun2\execution-candidate-before-click.png`
  - `output\unity-click-ux-qa-2026-06-22\default-1280-r22-rerun2\end-day-after-dialogue-dismiss.png`

### r21 public action table recovery and privacy polish

- Change: restored the public `Phase Assist Panel` to the contract-expected readable single-focus action table, moved the hint row down for legibility, and hides the signal strip during public discussion so it no longer reads as a narrow route/chip strip over the board.
- Change: proactive private-chat invite titles now use the generic `有人想私聊你` before acceptance, avoiding pre-acceptance role/persona leakage in the panel title. The top HUD pods were darkened slightly so the status text remains readable over the town background.
- Harness change: `tools\unity_build_click_smoke.ps1` retargets public/nomination top-row candidates to the current visible action-table center. The failed `social-1366-r21-rerun1` and `social-1366-r21-rerun2` directories are superseded coordinate diagnostics; `rerun1` clicked the old high row and `rerun2` clicked below the table after accounting for the window title bar.
- r21 package verification passed. The package script also ran `test:ai-llm-renderer` and `test:unity-action-bridge`; LLM verification produced 2 successful timeline entries and 0 fallback entries.
- Contract recovery: `npm run test:unity-assets` initially failed on the public phase-assist shape and passed after the action-table recovery. `npm run test:unity-ui-audio` initially failed on proactive invite title leakage and top HUD readability and passed after the privacy/HUD fixes.
- 1366 social command: `powershell -NoProfile -ExecutionPolicy Bypass -File tools\unity_build_click_smoke.ps1 -PackageDir output\release-unity-ai\BOTC-Solo-Unity-AI-20260622-click-ux-qa-r21 -ArtifactDir output\unity-click-ux-qa-2026-06-22\social-1366-r21-rerun3 -OnlySocial -RestoreRuntimeState -AllowVisibleWindow -WindowWidth 1366 -WindowHeight 768`
- 1366 social result: passed. Report: `output\unity-click-ux-qa-2026-06-22\social-1366-r21-rerun3\click_smoke_report.json`; 44 click-trace entries and 36 screenshots.
- 1920 fullscreen social command: `powershell -NoProfile -ExecutionPolicy Bypass -File tools\unity_build_click_smoke.ps1 -PackageDir output\release-unity-ai\BOTC-Solo-Unity-AI-20260622-click-ux-qa-r21 -ArtifactDir output\unity-click-ux-qa-2026-06-22\social-1920-fullscreen-r21-rerun1 -OnlySocial -RestoreRuntimeState -AllowVisibleWindow -WindowWidth 1920 -WindowHeight 1080 -Fullscreen`
- 1920 fullscreen social result: passed. Report: `output\unity-click-ux-qa-2026-06-22\social-1920-fullscreen-r21-rerun1\click_smoke_report.json`; 64 click-trace entries and 36 screenshots.
- Full 1280 sweep command: `powershell -NoProfile -ExecutionPolicy Bypass -File tools\unity_build_click_smoke.ps1 -PackageDir output\release-unity-ai\BOTC-Solo-Unity-AI-20260622-click-ux-qa-r21 -ArtifactDir output\unity-click-ux-qa-2026-06-22\default-1280-r21-rerun1 -WindowWidth 1280 -WindowHeight 720 -AllowVisibleWindow -RestoreRuntimeState`
- Full 1280 sweep result: passed. Report: `output\unity-click-ux-qa-2026-06-22\default-1280-r21-rerun1\click_smoke_report.json`; 124 click-trace entries and 67 screenshots.
- Key screenshots:
  - `output\unity-click-ux-qa-2026-06-22\social-1366-r21-rerun3\proactive-queue-before-accept.png`
  - `output\unity-click-ux-qa-2026-06-22\social-1366-r21-rerun3\public-discussion-before-player-input.png`
  - `output\unity-click-ux-qa-2026-06-22\social-1366-r21-rerun3\public-discussion-opened-nomination-window.png`
  - `output\unity-click-ux-qa-2026-06-22\social-1920-fullscreen-r21-rerun1\public-discussion-before-player-input.png`
  - `output\unity-click-ux-qa-2026-06-22\default-1280-r21-rerun1\human-nomination-token-selected.png`
  - `output\unity-click-ux-qa-2026-06-22\default-1280-r21-rerun1\info-drawer-events-tab.png`

### r20 transparent phase transition and current-package sweep

- Change: the phase-transition overlay now uses a lighter tint, softer top/bottom vignettes, lighter center/route plates, and shorter public/nomination hold timing. This preserves the phase cue while keeping the town table and player tokens readable during stage dialogue and nomination opening.
- Harness change: `tools\unity_build_click_smoke.ps1` now accepts stable end-day viewmodel state when a transient day-end action file has already advanced, and it validates correct terminal good endgame state when an extra phase click is rejected because the game has already ended.
- r20 package verification passed. The package script also ran `test:ai-llm-renderer` and `test:unity-action-bridge`; LLM verification produced 2 successful timeline entries and 0 fallback entries.
- 1366 social command: `powershell -NoProfile -ExecutionPolicy Bypass -File tools\unity_build_click_smoke.ps1 -PackageDir output\release-unity-ai\BOTC-Solo-Unity-AI-20260622-click-ux-qa-r20 -ArtifactDir output\unity-click-ux-qa-2026-06-22\social-1366-r20-rerun1 -OnlySocial -RestoreRuntimeState -AllowVisibleWindow -WindowWidth 1366 -WindowHeight 768`
- 1366 social result: passed. Report: `output\unity-click-ux-qa-2026-06-22\social-1366-r20-rerun1\click_smoke_report.json`; 46 click-trace entries and 36 screenshots.
- Full 1280 sweep command: `powershell -NoProfile -ExecutionPolicy Bypass -File tools\unity_build_click_smoke.ps1 -PackageDir output\release-unity-ai\BOTC-Solo-Unity-AI-20260622-click-ux-qa-r20 -ArtifactDir output\unity-click-ux-qa-2026-06-22\default-1280-r20-rerun3 -WindowWidth 1280 -WindowHeight 720 -AllowVisibleWindow -RestoreRuntimeState`
- Full 1280 sweep result: passed. Report: `output\unity-click-ux-qa-2026-06-22\default-1280-r20-rerun3\click_smoke_report.json`; 122 click-trace entries and 67 screenshots.
- Superseded diagnostics: `default-1280-r20-rerun1` reached night after nomination-vote day-end but timed out on a superseded transient action file; `default-1280-r20-rerun2` reached a correct good endgame after human nomination but failed because a final extra phase click was correctly rejected with "game already ended." Both are superseded by `default-1280-r20-rerun3`.
- Visual note: `public-discussion-after-ai-speech.png` may still capture the phase cue mid-transition, but the r20 tint is transparent enough that the table and tokens remain readable. `public-discussion-opened-nomination-window.png` no longer shows the prior r19 full-screen black backdrop effect.
- Key screenshots:
  - `output\unity-click-ux-qa-2026-06-22\social-1366-r20-rerun1\public-discussion-after-ai-speech.png`
  - `output\unity-click-ux-qa-2026-06-22\social-1366-r20-rerun1\public-discussion-opened-nomination-window.png`
  - `output\unity-click-ux-qa-2026-06-22\social-1366-r20-rerun1\ai-nomination-before-click.png`
  - `output\unity-click-ux-qa-2026-06-22\default-1280-r20-rerun3\public-discussion-opened-nomination-window.png`
  - `output\unity-click-ux-qa-2026-06-22\default-1280-r20-rerun3\human-nomination-token-selected.png`
  - `output\unity-click-ux-qa-2026-06-22\default-1280-r20-rerun3\info-drawer-events-tab.png`

### Info-drawer folded log on r18

- Change: the `日志` drawer tab now explicitly shows a folded full-log state. The top summary reads as `最近 4 / 全部 N · 完整日志折叠`, the visible rows stay focused on the latest events, and a bottom archive row states how many older entries are hidden while preserving the full ledger. The timeline anchor label also uses player-facing `已定位` instead of the English `ANCHOR`.
- r18 package verification passed. The package script also ran `test:ai-llm-renderer` and `test:unity-action-bridge`; LLM verification produced 2 successful timeline entries and 0 fallback entries.
- 1366 info-drawer command: `powershell -NoProfile -ExecutionPolicy Bypass -File tools\unity_build_click_smoke.ps1 -PackageDir output\release-unity-ai\BOTC-Solo-Unity-AI-20260622-click-ux-qa-r18 -ArtifactDir output\unity-click-ux-qa-2026-06-22\info-drawer-1366-r18-rerun1 -OnlyInfoDrawer -WindowWidth 1366 -WindowHeight 768 -AllowVisibleWindow -RestoreRuntimeState`
- 1366 info-drawer result: passed. Report: `output\unity-click-ux-qa-2026-06-22\info-drawer-1366-r18-rerun1\click_smoke_report.json`; 11 click-trace entries and 11 screenshots.
- 1920 fullscreen info-drawer command: `powershell -NoProfile -ExecutionPolicy Bypass -File tools\unity_build_click_smoke.ps1 -PackageDir output\release-unity-ai\BOTC-Solo-Unity-AI-20260622-click-ux-qa-r18 -ArtifactDir output\unity-click-ux-qa-2026-06-22\info-drawer-1920-fullscreen-r18-rerun1 -OnlyInfoDrawer -WindowWidth 1920 -WindowHeight 1080 -Fullscreen -AllowVisibleWindow -RestoreRuntimeState`
- 1920 fullscreen info-drawer result: passed. Report: `output\unity-click-ux-qa-2026-06-22\info-drawer-1920-fullscreen-r18-rerun1\click_smoke_report.json`; 21 click-trace entries and 11 screenshots.
- Populated-public 1366 info-drawer command: `powershell -NoProfile -ExecutionPolicy Bypass -File tools\unity_build_click_smoke.ps1 -PackageDir output\release-unity-ai\BOTC-Solo-Unity-AI-20260622-click-ux-qa-r18 -ArtifactDir output\unity-click-ux-qa-2026-06-22\info-drawer-public-1366-r18-rerun1 -OnlyInfoDrawer -InfoDrawerPublicFixture -WindowWidth 1366 -WindowHeight 768 -AllowVisibleWindow -RestoreRuntimeState`
- Populated-public 1366 info-drawer result: passed. Report: `output\unity-click-ux-qa-2026-06-22\info-drawer-public-1366-r18-rerun1\click_smoke_report.json`; 11 click-trace entries, 11 screenshots, 5 timeline entries.
- Key screenshots:
  - `output\unity-click-ux-qa-2026-06-22\info-drawer-1366-r18-rerun1\info-drawer-events-tab.png`
  - `output\unity-click-ux-qa-2026-06-22\info-drawer-1920-fullscreen-r18-rerun1\info-drawer-events-tab.png`
  - `output\unity-click-ux-qa-2026-06-22\info-drawer-public-1366-r18-rerun1\info-drawer-public-tab.png`

### r18 manual action and vote click refresh

- Change: `tools\unity_build_click_smoke.ps1` retargeted the nomination end-day click candidates from the stale `y=91` row to the current compact phase-assist rail center at `y=70`. The first r18 vote rerun proved the old coordinates missed the visible `进入夜晚` button after vote resolution; rerun2 is the fixed passing evidence.
- Manual Fortune Teller command: `powershell -NoProfile -ExecutionPolicy Bypass -File tools\unity_build_click_smoke.ps1 -PackageDir output\release-unity-ai\BOTC-Solo-Unity-AI-20260622-click-ux-qa-r18 -ArtifactDir output\unity-click-ux-qa-2026-06-22\manual-night-1280-r18-rerun1 -OnlyManualNightAction -RestoreRuntimeState -AllowVisibleWindow`
- Manual Fortune Teller result: passed. Report: `output\unity-click-ux-qa-2026-06-22\manual-night-1280-r18-rerun1\click_smoke_report.json`; 18 click-trace entries and 6 screenshots. Final action `night-action`, targets `p2,p9`, final phase `day`, day stage `private`.
- Nomination vote diagnostic: `output\unity-click-ux-qa-2026-06-22\nomination-vote-1280-r18-rerun1\click_smoke_report.json` failed after vote resolution because end-day candidates were still clicking the old rail row.
- Nomination vote command after harness retarget: `powershell -NoProfile -ExecutionPolicy Bypass -File tools\unity_build_click_smoke.ps1 -PackageDir output\release-unity-ai\BOTC-Solo-Unity-AI-20260622-click-ux-qa-r18 -ArtifactDir output\unity-click-ux-qa-2026-06-22\nomination-vote-1280-r18-rerun2 -OnlyNominationVote -RestoreRuntimeState -AllowVisibleWindow -ActionTimeoutSeconds 20`
- Nomination vote result: passed. Report: `output\unity-click-ux-qa-2026-06-22\nomination-vote-1280-r18-rerun2\click_smoke_report.json`; 14 click-trace entries and 5 screenshots. Vote passed with 7 yes votes, end-day click emitted `phase`, and final phase entered `night`.
- Key screenshots:
  - `output\unity-click-ux-qa-2026-06-22\manual-night-1280-r18-rerun1\manual-night-action-targets-selected.png`
  - `output\unity-click-ux-qa-2026-06-22\manual-night-1280-r18-rerun1\fortune-teller-after-reselect-clear.png`
  - `output\unity-click-ux-qa-2026-06-22\nomination-vote-1280-r18-rerun2\nomination-vote-before-click.png`
  - `output\unity-click-ux-qa-2026-06-22\nomination-vote-1280-r18-rerun2\end-day-before-click.png`

## Fixes Made

- Re-render queued proactive whispers after closing an accepted proactive private chat.
- Added optional `toNight` payload support to Unity action submission, and made the pass-nomination button close the nomination window without immediately forcing night.
- Added `executionCandidate` to the Unity viewmodel mirror.
- Changed nomination primary action so an on-block execution candidate uses explicit phase advance to night instead of the AI decision-loop auto-advance.
- Retargeted and expanded the click-smoke harness for vote ceremony close, stage-dialogue collapse, right-side vote buttons, viewmodel-ordered grimoire token clicks, and structured click/screenshot reports.
- Fixed passing-nomination fixture preflight so its cloned trial state can re-evaluate vote passability without stale nomination flags.
- Separated the click-smoke launch resolution from the fixed 1280x720 click-coordinate baseline, added click-candidate labels to reports, and added `-Fullscreen` for true 1080p visible click testing without Windows taskbar interference.
- Added responsive proactive invite accept/reject candidates for the 1920x1080 panel layout and reused them in the proactive cleanup helper.
- Added player-grouped private-chat notebook cards to the info drawer and updated the info-drawer smoke to clear proactive invite overlays before capturing drawer tabs.
- Reduced the visual weight of the top HUD and side rails so the main board reads less like stacked debug panels while preserving existing click targets.
- Reduced the bottom action dock height and visual weight, preserving click coordinates while making the center board and lower tokens less obstructed.
- Added phase-aware bottom dock button visibility so secondary or currently irrelevant actions move out of the first-level dock.
- Compact public discussion and nomination phase assist into a lighter top rail with visible speaker/focus/next-step signal chips.
- Retargeted public discussion, AI nomination, and pass-nomination click-smoke coordinates to the compact phase-assist rail.
- Restyled proactive private-chat invitations as lighter player-readable invite cards with explicit `新/待` state and pre-acceptance privacy copy.

- Replaced the info-drawer clue recap text block with player-facing clue summary cards and sanitized backend-flavored clue wording before display.
- Replaced the info-drawer public tab text page with grouped public-speech cards, added a populated-public fixture for drawer screenshots, and hid the old duplicate public footer text.
- Warmed the public/nomination phase-assist rail material, signal strip, chips, frame, header wash, and public speech input so the rail no longer reads as a black debug console.
- Added an explicit folded full-log row to the info-drawer `日志` tab and replaced the timeline anchor marker with player-facing `已定位` copy.
- Retargeted the nomination vote end-day click-smoke candidates to the current compact phase-assist rail center so the visible `进入夜晚` button is actually clicked after vote resolution.
- Retargeted the full-sweep flow-advance click-smoke candidates to the current compact phase-assist rail center and allowed stable nomination viewmodel state to satisfy the check when the transient `open-nomination-window` action file is superseded quickly.
- Warmed the stage-dialogue shell, speech card, context rail, queue strip, and nomination-debate shell/seat/line plates so the nomination-open modal no longer reads as stacked black debug panels.
- Restored the public phase-assist surface to the contract-expected readable single-focus action table, hid public signal chips, made proactive invite titles generic before acceptance, and retargeted top-row click smoke coordinates to the table center.
- Shortened and lightened the top HUD pods, moved top menu/settings/help/new-game controls into compact HUD tool buttons, and added left-flow main-button end-day click candidates for the post-pass-window day-end path.

## Validation Commands

- `npm run test:unity-csharp-smoke` - passed.
- `npm run test:unity-ui-audio` - passed.
- `npm run test:unity-viewmodel` - passed.
- `npm run test:unity-action-bridge` - passed.
- `npm run test:unity-assets` - passed; assets in sync.
- `npm run test:unity-demo-acceptance` - passed.
- `npm run test:unity-playable-path` - passed.
- Package verification - passed.
- `npm run test:ai-llm-renderer` - passed as part of package verification.
- Targeted 1920x1080 social/fullscreen click smoke - passed.
- Targeted 1366x768 info-drawer click smoke - passed.
- `npm run test:unity-csharp-smoke` - passed after the r5 info-drawer UI change.
- r5 package verification - passed.
- r5 targeted 1920x1080 info-drawer/fullscreen click smoke - passed.
- r5 targeted 1366x768 info-drawer click smoke - passed.
- `npm run test:unity-csharp-smoke` - passed after the r6 HUD/rail visual polish.
- r6 package verification - passed.
- r6 targeted 1366x768 info-drawer/main-board click smoke - passed.
- r6 targeted 1920x1080 info-drawer/fullscreen click smoke - passed.
- `npm run test:unity-csharp-smoke` - passed after the r8 bottom action dock polish.
- r8 package verification - passed.
- r8 targeted 1366x768 social/action-dock click smoke - passed.
- r8 targeted 1920x1080 social/action-dock/fullscreen click smoke - passed.
- `npm run test:unity-csharp-smoke` - passed after the r10 phase-aware action dock change.
- r10 package verification - passed.
- r10 targeted 1366x768 social/action-dock click smoke - passed.
- r10 targeted 1920x1080 social/action-dock/fullscreen click smoke - passed.
- r10 targeted Fortune Teller manual night action click smoke - passed.
- `npm run test:unity-csharp-smoke` - passed after the r12 phase-assist rail change.
- r12 package verification - passed.
- r12 targeted 1366x768 social/phase-assist click smoke - passed.
- r12 targeted 1920x1080 social/phase-assist/fullscreen click smoke - passed.
- `npm run test:unity-csharp-smoke` - passed after the r13 proactive invite-card change.
- r13 package verification - passed.
- r13 targeted 1366x768 social/proactive-invite click smoke - passed.
- r13 targeted 1920x1080 social/proactive-invite/fullscreen click smoke - passed.
- `npm run test:unity-csharp-smoke` - passed after the r14 clue-card change.
- r14 package verification - passed.
- r14 targeted 1366x768 info-drawer clue-card click smoke - passed.
- r14 targeted 1920x1080 info-drawer clue-card fullscreen click smoke - passed.
- `npm run test:unity-csharp-smoke` - passed after the r16 public info-drawer card change.
- `npm run test:unity-viewmodel` - passed after the r16 public info-drawer card change.
- r16 package verification - passed.
- r16 targeted 1366x768 info-drawer click smoke - passed.
- r16 targeted 1920x1080 info-drawer fullscreen click smoke - passed.
- r16 targeted 1366x768 populated-public info-drawer click smoke - passed.
- r16 targeted 1920x1080 populated-public info-drawer fullscreen click smoke - passed.
- r16 targeted 1366x768 social click smoke - passed.
- `npm run test:unity-csharp-smoke` - passed after the r17 phase-assist material polish.
- r17 package verification - passed.
- r17 targeted 1366x768 social/phase-assist click smoke - passed.
- r17 targeted 1920x1080 social/phase-assist fullscreen click smoke - passed.
- `npm run test:unity-csharp-smoke` - passed after the r18 folded-log info-drawer change.
- `npm run test:unity-viewmodel` - passed after the r18 folded-log info-drawer change.
- r18 package verification - passed.
- r18 targeted 1366x768 info-drawer click smoke - passed.
- r18 targeted 1920x1080 info-drawer fullscreen click smoke - passed.
- r18 targeted 1366x768 populated-public info-drawer click smoke - passed.
- r18 targeted Fortune Teller manual night action click smoke - passed.
- r18 targeted nomination vote/end-day click smoke - passed after harness coordinate retarget; the failed `nomination-vote-1280-r18-rerun1` is superseded by `nomination-vote-1280-r18-rerun2`.
- r18 targeted 1366x768 social/phase-assist click smoke - passed.
- r18 full 1280x720 click sweep - passed after flow-advance harness retarget/state confirmation; the failed `default-1280-r18-rerun1` is superseded by `default-1280-r18-rerun2`.
- `npm run test:unity-csharp-smoke` - passed after the r19 modal material polish.
- r19 package verification - passed.
- `npm run test:unity-viewmodel` - passed after the r19 modal material polish.
- r19 targeted 1366x768 social/phase-assist click smoke - passed.
- r19 full 1280x720 click sweep - passed.
- `npm run test:unity-csharp-smoke` - passed after the r20 phase-transition polish.
- `npm run test:unity-viewmodel` - passed after the r20 phase-transition polish.
- `npm run test:unity-action-bridge` - passed after the r20 phase-transition polish.
- r20 package verification - passed.
- r20 targeted 1366x768 social/phase-assist click smoke - passed.
- r20 full 1280x720 click sweep - passed after end-day/endgame harness state confirmation; the failed `default-1280-r20-rerun1` and `default-1280-r20-rerun2` are superseded by `default-1280-r20-rerun3`.
- `npm run test:ai-llm-renderer` - passed before r21 package verification.
- `npm run test:unity-assets` - initially failed on public phase-assist shape, then passed after the action-table recovery.
- `npm run test:unity-ui-audio` - initially failed on proactive invite title leakage and HUD readability, then passed after the privacy/HUD fixes.
- `npm run test:unity-csharp-smoke` - passed after the r21 public action-table/privacy polish; only existing CS0649 warnings were emitted.
- `npm run test:unity-viewmodel` - passed after the r21 public action-table/privacy polish.
- `npm run test:unity-action-bridge` - passed after the r21 public action-table/privacy polish.
- `npm run test:unity-demo-acceptance` - passed after the r21 public action-table/privacy polish.
- `npm run test:unity-playable-path` - passed after the r21 public action-table/privacy polish.
- r21 package verification - passed.
- r21 targeted 1366x768 social/action-table click smoke - passed after top-row coordinate retarget; the failed `social-1366-r21-rerun1` and `social-1366-r21-rerun2` are superseded coordinate diagnostics.
- r21 targeted 1920x1080 social/action-table fullscreen click smoke - passed.
- r21 full 1280x720 click sweep - passed.
- `npm run test:unity-ui-audio` - passed after the r22 compact top-HUD change and updated HUD regression contract.
- `npm run test:unity-csharp-smoke` - passed after the r22 compact top-HUD change; only existing CS0649 warnings were emitted.
- `npm run test:unity-viewmodel` - passed after the r22 compact top-HUD change.
- `npm run test:unity-action-bridge` - passed after the r22 compact top-HUD change.
- `npm run test:unity-assets` - passed after the r22 compact top-HUD change.
- r22 package verification - passed.
- `npm run test:unity-demo-acceptance` - passed after the r22 compact top-HUD change.
- `npm run test:unity-playable-path` - passed after the r22 compact top-HUD change.
- r22 targeted 1366x768 social/HUD click smoke - passed.
- r22 targeted 1920x1080 info-drawer/main-board fullscreen click smoke - passed.
- r22 full 1280x720 click sweep - passed after adding left-flow end-day click candidates; the failed `default-1280-r22-rerun1` is superseded by `default-1280-r22-rerun2`.

## Current Artifact Index

- Latest playable package: `C:\Users\11507\Documents\Playground\output\release-unity-ai\BOTC-Solo-Unity-AI-20260622-click-ux-qa-r22`
- Latest verification report: `docs\verification\UNITY_CLICK_UX_QA_2026-06-22.md`
- Latest cleanup/index report: `docs\verification\UNITY_CLICK_UX_CLEANUP_2026-06-22.md`
- Latest screenshot roots:
  - `output\unity-click-ux-qa-2026-06-22\default-1280-r22-rerun2`
  - `output\unity-click-ux-qa-2026-06-22\manual-night-1280-r18-rerun1`
  - `output\unity-click-ux-qa-2026-06-22\nomination-vote-1280-r18-rerun2`
  - `output\unity-click-ux-qa-2026-06-22\social-1920-fullscreen-r21-rerun1`
  - `output\unity-click-ux-qa-2026-06-22\social-1366-r22-rerun1`
  - `output\unity-click-ux-qa-2026-06-22\info-drawer-1920-fullscreen-r22-rerun1`
  - `output\unity-click-ux-qa-2026-06-22\info-drawer-1366-r18-rerun1`
  - `output\unity-click-ux-qa-2026-06-22\info-drawer-public-1366-r18-rerun1`
  - `output\unity-click-ux-qa-2026-06-22\info-drawer-public-1920-fullscreen-r16-rerun1`

## Remaining P0/P1/P2 Items

- P0: The named click paths now have passing r22 smoke evidence at 1280, with current r22 1366 social/HUD coverage, r21 1920 social/action-table coverage, and r22 1920 info-drawer coverage. No current P0 blocker is known in the verified paths.
- P1: Broader visual convergence is not fully complete. The top HUD, side rails, bottom dock, phase-assist/action table, proactive invite cards, info-drawer public/clue/log cards, stage/nomination materials, and phase-transition tint are lighter or more readable across r10/r12/r13/r14/r16/r17/r18/r19/r20/r21/r22. The verified r22 main-board HUD is shorter and lighter than r21, and the verified r21/r22 public and nomination-open paths no longer show the heavy full-screen black backdrop or narrow public route strip. Unverified long-tail modal states may still need polish.
- P1: The info drawer now has grouped private-chat, public-speech, clue summary cards, and a folded-log default state, but deeper trust-note polish remains open.
- P2: Older failed/superseded screenshot directories remain under `output\unity-click-ux-qa-2026-06-22` for traceability. Use the artifact index above as the authoritative current evidence set.

## Notes And Gaps

- Earlier diagnostic 1920x1080 windowed social runs under `social-1920-r4-*` failed before the harness separated launch resolution from click coordinates and before fullscreen mode existed. They are superseded by `social-1920-fullscreen-r4-rerun2`.
- 1920x1080 windowed Unity can extend behind the Windows taskbar on this desktop; use `-Fullscreen` for visible 1080p click acceptance.
- No Unity licensing or Package Manager blocker was hit.
- Runtime state was restored after visible package smokes.
- Some 1920 fullscreen screenshots, including r12/r13/r17 captures, contain AMD/NVIDIA desktop overlay artifacts from the host machine; these are external to the Unity UI and did not affect the click-smoke pass. Use the 1366 r22 screenshots as the cleaner visual reference for the current compact top HUD, public action table, nomination material, and transparent phase transition.
