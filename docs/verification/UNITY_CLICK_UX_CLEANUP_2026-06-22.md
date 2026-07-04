# Unity Click UX Cleanup - 2026-06-22

## Current Artifact Index

- Latest playable package: `C:\Users\11507\Documents\Playground\output\release-unity-ai\BOTC-Solo-Unity-AI-20260622-click-ux-qa-r22`
- Latest verification report: `docs\verification\UNITY_CLICK_UX_QA_2026-06-22.md`
- Full 1280 click evidence: `output\unity-click-ux-qa-2026-06-22\default-1280-r22-rerun2`
- Latest Fortune Teller manual target evidence: `output\unity-click-ux-qa-2026-06-22\manual-night-1280-r18-rerun1`
- Focused nomination vote evidence: `output\unity-click-ux-qa-2026-06-22\nomination-vote-1280-r18-rerun2`
- Latest 1920x1080 social/action-table evidence: `output\unity-click-ux-qa-2026-06-22\social-1920-fullscreen-r21-rerun1`
- Latest 1366x768 social/HUD/action-table evidence: `output\unity-click-ux-qa-2026-06-22\social-1366-r22-rerun1`
- Latest 1920x1080 info-drawer evidence: `output\unity-click-ux-qa-2026-06-22\info-drawer-1920-fullscreen-r22-rerun1`
- Latest 1366x768 main-board/info-drawer evidence: `output\unity-click-ux-qa-2026-06-22\info-drawer-1366-r18-rerun1`
- Latest populated-public info-drawer evidence: `output\unity-click-ux-qa-2026-06-22\info-drawer-public-1366-r18-rerun1`, `output\unity-click-ux-qa-2026-06-22\info-drawer-public-1920-fullscreen-r16-rerun1`
- Latest package cleanup report: `C:\Users\11507\Documents\Playground\output\release-unity-ai\BOTC-Solo-Unity-AI-20260622-click-ux-qa-r22\release-cleanup-report.json`

## Cleanup Notes

- Superseded diagnostic directories were left in `output\unity-click-ux-qa-2026-06-22` for traceability; the report names the passing reruns explicitly.
- The earlier `social-1920-r4-*` failures are harness/environment diagnostics, not current acceptance evidence.
- `tools\unity_build_click_smoke.ps1` records both launch resolution and the fixed 1280x720 click-coordinate reference in `click_smoke_report.json`.
- 1920x1080 visible click testing should use `-Fullscreen`; a 1080-high windowed Unity client can extend behind the Windows taskbar and make bottom dock clicks hit Windows UI instead of the game.
- Social/action-table evidence should cite the r22 1366 directory above and the r21 fullscreen directory where 1920 social evidence is needed; they include the lighter phase-aware bottom action dock, compact top HUD, readable public single-focus action table, transparent phase-transition overlay, proactive invite-card list with generic pre-acceptance title, and cover proactive invites, private chat, public discussion, AI nomination, and pass nomination.
- Manual night evidence should cite the r18 directory above; it validates the visible night-action entry still opens the Fortune Teller two-target form and records `p2,p9`.
- Nomination vote evidence should cite the r18 rerun2 directory above. The earlier `nomination-vote-1280-r18-rerun1` failure is a superseded harness-coordinate diagnostic: end-day candidates were still clicking the old phase-assist rail row before `tools\unity_build_click_smoke.ps1` was retargeted to `y=70`.
- Full 1280 evidence should cite the r22 rerun2 directory above. The earlier `default-1280-r18-rerun1` failure is a superseded harness diagnostic: the nomination window opened visibly, but the script waited only on a transient `open-nomination-window` action file before the action advanced. The harness now accepts stable nomination viewmodel state, and the r20 `default-1280-r20-rerun1` and `default-1280-r20-rerun2` failures are superseded harness diagnostics for stable day-end action/result state and correct terminal good-endgame state.
- The r21 `social-1366-r21-rerun1` and `social-1366-r21-rerun2` failures are superseded top-row coordinate diagnostics after the public action table height recovery. `rerun3` is the passing 1366 evidence; `social-1920-fullscreen-r21-rerun1` is the passing fullscreen evidence.
- The r22 `default-1280-r22-rerun1` failure is a superseded harness diagnostic: after pass-window closed the top action table, the player-visible left-flow main button was the correct route to night. `default-1280-r22-rerun2` is the passing evidence after adding left-flow end-day candidates.
- Info-drawer evidence should cite the r18 directories above; they include player-grouped private-chat notebook cards, public-speech cards, clue summary cards, folded full-log default state, lighter HUD/side-rail treatment, and proactive-invite cleanup before drawer screenshots.

## Remaining Cleanup Risks

- Several older reports and screenshots predate the click-coordinate fixes. They should not be cited as latest evidence unless the directory is listed above.
- The repository worktree contains many unrelated modified and untracked files; this cleanup did not delete, stage, or normalize them.
- UI polish is improved by the current evidence loop, including the r6 HUD/side-rail pass, r8 bottom action-dock pass, r10 phase-aware dock pass, r12 compact phase-assist pass, r13 proactive invite-card pass, r14 clue-card pass, r16 public info-drawer card pass, r17 phase-assist material pass, r18 folded-log/manual-action/vote refresh pass, r19 modal-material/social/full-sweep refresh pass, r20 transparent phase-transition/full-sweep refresh pass, r21 public action-table/privacy pass, and r22 compact top-HUD pass, but broader P1 visual convergence remains open beyond the verified click paths.
- The r22 full 1280 sweep plus r22 1366 social/HUD and r22 1920 info-drawer evidence are the current playable acceptance evidence for those surfaces. r21 remains the latest passing 1920 fullscreen social/action-table sweep.
- Some 1920 fullscreen screenshots may include AMD/NVIDIA desktop overlay artifacts from the host machine; use the 1366 r22 screenshots as cleaner visual references for the current compact top HUD, public action table, nomination material, and transparent phase transition, and the r22/r18 info-drawer screenshots as drawer references.
