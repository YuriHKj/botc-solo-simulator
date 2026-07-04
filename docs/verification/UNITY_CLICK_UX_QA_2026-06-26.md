# Unity Click UX QA - 2026-06-26

## Scope

This report closes the evidence loop for the current r23 playable baseline. It is a current-state snapshot, not a claim that the full long-running Unity UX convergence goal is complete.

North-star acceptance for this snapshot:

- A player can use the real Unity executable with mouse clicks across the core flow without knowing about JS bridge internals.
- Player-facing UI evidence is backed by screenshots, click coordinates, state JSON, and smoke reports.
- Structural safety remains covered by repository contract tests.

Evidence policy used here:

- Playability evidence comes from visible-window `tools\unity_build_click_smoke.ps1` runs only.
- Contract evidence comes from `npm` tests and package verification.
- Any remaining item not proven by these artifacts stays in the backlog.

## Current Artifact Index

- Latest playable package: `output\release-unity-ai\BOTC-Solo-Unity-AI-20260623-click-ux-qa-r23`
- Unity executable: `output\release-unity-ai\BOTC-Solo-Unity-AI-20260623-click-ux-qa-r23\BOTC_Unity_Prototype.exe`
- Package size: 696.32 MB folder, no zip.
- Package cleanup report: `output\release-unity-ai\BOTC-Solo-Unity-AI-20260623-click-ux-qa-r23\release-cleanup-report.json`
- Latest cleanup report: `output\release-unity-ai\release-cleanup-report-latest.json`
- Primary screenshot directories:
  - `output\unity-click-ux-qa-2026-06-23\social-1366-r23-rerun1`
  - `output\unity-click-ux-qa-2026-06-26\manual-night-1280-r23-rerun1`
  - `output\unity-click-ux-qa-2026-06-26\info-drawer-1920-fullscreen-r23-rerun1`
  - `output\unity-click-ux-qa-2026-06-26\default-1280-r23-rerun1`

Note: some machine timestamps in JSON are UTC and may show 2026-06-25 for local 2026-06-26 runs.

## r23 UI Change Summary

- `unity-prototype\Assets\Scripts\BotcPrototypeBootstrap.cs`
  - Lightened the left phase rail chrome and shortened its title from `流程` to `阶段`.
  - Kept the left rail at three player-facing blocks: `当前`, `状态`, and `下一步`.
  - Replaced longer tutorial-style hints with compact one- or two-line status copy.
  - Preserved the visible left main button position used by end-day click smoke.
- `tests\unity_ui_audio_regression_contracts.mjs`
  - Added a regression contract so the left phase rail stays compact and does not return to longer labels such as `当前阶段`, `等待原因`, or `推荐下一步`.

## Package Verification

Command:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools\package_unity_ai_release.ps1 -PackageName BOTC-Solo-Unity-AI-20260623-click-ux-qa-r23 -VerifyPackage -NoZip
```

Result: passed.

The package verification also ran:

- `npm run test:ai-llm-renderer` - passed.
- `npm run test:unity-action-bridge` - passed.

LLM package verification produced 2 successful rendered timeline entries and 0 fallback entries.

Unity C# compile smoke reported only existing CS0649 unused-field warnings and exited with `CSC_EXIT=0`.

## Contract Evidence

These commands passed on the r23 worktree:

- `npm run test:unity-ui-audio`
- `npm run test:unity-csharp-smoke`
- `npm run test:unity-viewmodel`
- `npm run test:unity-action-bridge`
- `npm run test:unity-assets`
- `npm run test:ai-llm-renderer`
- `npm run test:unity-demo-acceptance`
- `npm run test:unity-playable-path`

Important scope note: these tests support structure, data contracts, renderer safety, and non-visual playable-loop behavior. They are not counted as proof that mouse-driven Unity UI is playable; that proof comes from the click-smoke section below.

## Visible Click Evidence

### Social 1366 r23

Command:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools\unity_build_click_smoke.ps1 -PackageDir output\release-unity-ai\BOTC-Solo-Unity-AI-20260623-click-ux-qa-r23 -ArtifactDir output\unity-click-ux-qa-2026-06-23\social-1366-r23-rerun1 -OnlySocial -RestoreRuntimeState -AllowVisibleWindow -WindowWidth 1366 -WindowHeight 768
```

Result: passed.

- Report: `output\unity-click-ux-qa-2026-06-23\social-1366-r23-rerun1\click_smoke_report.json`
- Window: 1366x768, click coordinate baseline 1280x720.
- Results: 5 flows.
- Click trace entries: 46.
- Screenshots: 36.
- Covered flows: proactive queue accept/reject, private chat quick question/text send/close, public discussion, AI nomination, pass nomination window.

### Fortune Teller Manual Night 1280 r23

Command:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools\unity_build_click_smoke.ps1 -PackageDir output\release-unity-ai\BOTC-Solo-Unity-AI-20260623-click-ux-qa-r23 -ArtifactDir output\unity-click-ux-qa-2026-06-26\manual-night-1280-r23-rerun1 -OnlyManualNightAction -RestoreRuntimeState -AllowVisibleWindow
```

Result: passed.

- Report: `output\unity-click-ux-qa-2026-06-26\manual-night-1280-r23-rerun1\click_smoke_report.json`
- Window: 1280x720, click coordinate baseline 1280x720.
- Results: 1 flow.
- Click trace entries: 18.
- Screenshots: 6.
- Submitted action: `night-action`.
- Submitted targets: `p2,p9`.
- Final phase: Day 1 private stage.
- Covered flow: Fortune Teller target selection, cancel/reselect, two-target confirm.

### Info Drawer 1920 Fullscreen r23

Command:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools\unity_build_click_smoke.ps1 -PackageDir output\release-unity-ai\BOTC-Solo-Unity-AI-20260623-click-ux-qa-r23 -ArtifactDir output\unity-click-ux-qa-2026-06-26\info-drawer-1920-fullscreen-r23-rerun1 -OnlyInfoDrawer -RestoreRuntimeState -AllowVisibleWindow -WindowWidth 1920 -WindowHeight 1080 -Fullscreen
```

Result: passed.

- Report: `output\unity-click-ux-qa-2026-06-26\info-drawer-1920-fullscreen-r23-rerun1\click_smoke_report.json`
- Window: 1920x1080 fullscreen, click coordinate baseline 1280x720.
- Results: 2 entries.
- Click trace entries: 19.
- Screenshots: 11.
- Covered tabs: `日志`, `私聊`, `公开`, `线索`.

### Full 1280 r23 Sweep

Command:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools\unity_build_click_smoke.ps1 -PackageDir output\release-unity-ai\BOTC-Solo-Unity-AI-20260623-click-ux-qa-r23 -ArtifactDir output\unity-click-ux-qa-2026-06-26\default-1280-r23-rerun1 -WindowWidth 1280 -WindowHeight 720 -AllowVisibleWindow -RestoreRuntimeState
```

Result: passed.

- Report: `output\unity-click-ux-qa-2026-06-26\default-1280-r23-rerun1\click_smoke_report.json`
- Window: 1280x720, click coordinate baseline 1280x720.
- Results: 13 entries.
- Click trace entries: 126.
- Screenshots: 69.
- Covered flows: new game, proactive queue, private chat, public discussion, flow advance, AI nomination, pass nomination, nomination vote, passing nomination vote, human nomination, execution death, info drawer tabs.

## Screenshot Index

Main board:

- 1366 board with proactive queue: `output\unity-click-ux-qa-2026-06-23\social-1366-r23-rerun1\proactive-queue-before-accept.png`
- 1920 board before info drawer: `output\unity-click-ux-qa-2026-06-26\info-drawer-1920-fullscreen-r23-rerun1\info-drawer-before-open.png`

Proactive queue:

- Before accept: `output\unity-click-ux-qa-2026-06-23\social-1366-r23-rerun1\proactive-queue-before-accept.png`
- After accept: `output\unity-click-ux-qa-2026-06-23\social-1366-r23-rerun1\proactive-queue-after-accept-private-chat.png`
- After reject: `output\unity-click-ux-qa-2026-06-23\social-1366-r23-rerun1\proactive-queue-after-reject.png`

Fortune Teller action form:

- Before targets: `output\unity-click-ux-qa-2026-06-26\manual-night-1280-r23-rerun1\manual-night-action-before-targets.png`
- Scratch target selected: `output\unity-click-ux-qa-2026-06-26\manual-night-1280-r23-rerun1\fortune-teller-scratch-target-selected.png`
- Reselect cleared: `output\unity-click-ux-qa-2026-06-26\manual-night-1280-r23-rerun1\fortune-teller-after-reselect-clear.png`
- Two targets selected: `output\unity-click-ux-qa-2026-06-26\manual-night-1280-r23-rerun1\manual-night-action-targets-selected.png`

Private chat:

- Panel open: `output\unity-click-ux-qa-2026-06-23\social-1366-r23-rerun1\private-chat-panel-open.png`
- After quick question: `output\unity-click-ux-qa-2026-06-23\social-1366-r23-rerun1\private-chat-after-quick-question.png`
- Before text send: `output\unity-click-ux-qa-2026-06-23\social-1366-r23-rerun1\private-chat-before-send-text.png`
- After text send: `output\unity-click-ux-qa-2026-06-23\social-1366-r23-rerun1\private-chat-after-send-text.png`

Public discussion:

- Before player input: `output\unity-click-ux-qa-2026-06-23\social-1366-r23-rerun1\public-discussion-before-player-input.png`
- After player speech: `output\unity-click-ux-qa-2026-06-23\social-1366-r23-rerun1\public-discussion-after-player-speech.png`
- After AI speech: `output\unity-click-ux-qa-2026-06-23\social-1366-r23-rerun1\public-discussion-after-ai-speech.png`
- Nomination window opened from public flow: `output\unity-click-ux-qa-2026-06-23\social-1366-r23-rerun1\public-discussion-opened-nomination-window.png`

Nomination and vote:

- AI nomination before click: `output\unity-click-ux-qa-2026-06-23\social-1366-r23-rerun1\ai-nomination-before-click.png`
- Pass nomination before click: `output\unity-click-ux-qa-2026-06-23\social-1366-r23-rerun1\pass-nomination-before-click.png`
- Nomination vote before click: `output\unity-click-ux-qa-2026-06-26\default-1280-r23-rerun1\nomination-vote-before-click.png`
- Human nomination target selected: `output\unity-click-ux-qa-2026-06-26\default-1280-r23-rerun1\human-nomination-token-selected.png`
- Execution candidate before click: `output\unity-click-ux-qa-2026-06-26\default-1280-r23-rerun1\execution-candidate-before-click.png`

Info drawer:

- Before open: `output\unity-click-ux-qa-2026-06-26\info-drawer-1920-fullscreen-r23-rerun1\info-drawer-before-open.png`
- Events tab: `output\unity-click-ux-qa-2026-06-26\info-drawer-1920-fullscreen-r23-rerun1\info-drawer-events-tab.png`
- Whispers tab: `output\unity-click-ux-qa-2026-06-26\info-drawer-1920-fullscreen-r23-rerun1\info-drawer-whispers-tab.png`
- Public tab: `output\unity-click-ux-qa-2026-06-26\info-drawer-1920-fullscreen-r23-rerun1\info-drawer-public-tab.png`
- Clues tab: `output\unity-click-ux-qa-2026-06-26\info-drawer-1920-fullscreen-r23-rerun1\info-drawer-clues-tab.png`

## Visual QA Notes

- The r23 left phase rail stays within three information blocks and now reads as `阶段 / 当前 / 状态 / 下一步`; blocker and hint copy is visibly shorter than r22.
- The left main flow button remains reachable in the full sweep, including end-day progression after nomination/vote states.
- The proactive private-chat queue still appears as a compact invitation list: player number and invitation type are visible before acceptance, while private content stays hidden until accepted.
- Fortune Teller manual action selection shows selected targets, supports reselect/clear behavior, and exposes a visible confirm button that submits successfully.
- The 1920 fullscreen info drawer is readable and does not overlap the central board, but its content organization is still a P1 improvement area rather than a finished design.

## Remaining Risks

### P0

- No current r23 P0 blocker is proven by the visible click evidence above. Core click flows listed in the objective have at least one passing visible-window smoke path.

### P1

- The info drawer is readable and tabbed, but it still needs a stronger information model: private claims by player, public discussion grouped by round/target, and clue summaries that are more useful than empty/low-content states in sparse seeds.
- Public discussion and nomination panels are clickable and clearer than earlier builds, but they still have room to feel more like a tabletop conversation surface and less like a control overlay.
- The main board is closer to the desired player-only signal set, but the bottom action dock and right-side info rail still need one more pass for phase-specific density and visual consistency.
- Screenshot evidence is strong for the r23 flows above, but no OCR-style proof was run over screenshots. Internal-term protection is currently covered by source/contracts, especially `testInfoDrawerPublicTabsAvoidInternalTimelineTerms`.

### P2

- Older r4-r22 reports and screenshots remain referenced in existing docs. Cleanup is report-only; no old artifacts were archived or deleted.
- Button material, border weight, and translucent panel alpha are improved in targeted areas, but the whole Unity UI is not yet visually unified.
- The release cleanup report lists old playable packages as archive candidates, but artifact cleanup has not been executed.

## Conclusion

r23 is the current evidence-backed playable baseline. The real Unity executable passes visible click smoke for the core manual flows, including Fortune Teller two-target night action, social/private/public flow, nomination/vote, execution, and info drawer tabs.

This closes the r23 evidence loop and gives the next UI pass a stable baseline. It does not complete the broader UX convergence goal; the remaining P1/P2 items above should guide the next iteration.
