# Unity Information Notebook Verification — 2026-07-20

## Scope

This change replaces the private/public “recent three cards” in the Unity information drawer with a bounded master/detail notebook. The private tab cycles through every non-human player, four evidence lenses, and every matching source record. The public tab cycles through day, attention object, and every matching original statement.

The UI consumes the existing player-safe Unity data only. No JS core, viewmodel export, action bridge, base bootstrap, shared UI utility, stage dialogue, nomination/vote, package, or capture-harness contract changed.

## Behavior Evidence

- Private player selector: previous/next cycling with `player current / total`; players without records remain selectable.
- Private lenses: `身份声称`, `夜间信息`, `近期发言`, and `待验证`; recent statements contains every private source row for the selected player.
- Private provenance: one full sanitized source row at a time, speaker/time, `record current / total`, and `仅你可见` visibility wording.
- Pending invitation privacy: only the existing public intent/reason is rendered before acceptance.
- Public filters: All or one day and All or one displayable focus; resolution order is a known `focusId`, then a known `targetId`, then `全桌`, without exposing raw identifiers.
- Public provenance: one full sanitized `原始发言` at a time with speaker, time, focus, and `匹配记录 current / total`.
- Dense state: selectors and record navigation replace fixed top-N cuts and vertically stacked source cards.
- Sparse state: empty player/lens/filter states display a neutral `下一步` prompt and clear stale source detail.
- Layout envelope: all new controls stay inside the existing 584 px notebook root and the unchanged 702x660 right-side drawer.

## Proof-First Contract

The new contract was run before the runtime implementation. It failed with exit code 1 because `BuildWhisperNotebookLensEntries` did not exist in the original recent-card implementation. After the implementation, it passed.

An independent implementation review initially identified three P1 reachability defects: question-only private records were omitted, unknown non-empty public focus values could be mislabeled as a player, and long source text could be visually clipped. The implementation now retains question-only records and every follow-up prompt, resolves only displayable focus/target players before using the neutral table label, and pages full source text with reachable previous/next controls. The follow-up review found all three resolved and no remaining P0/P1 findings.

The `ce-work` shipping pass then ran `ce-simplify-code` and the formal multi-persona `ce-code-review`. Simplification applied five behavior-preserving improvements: existing `WrapIndex` reuse, one canonical lens-title source, `StringBuilder` text paging, reuse of normalized public results, and reuse of the active private lens result. Formal review produced two independently validated P2 findings, both fixed and rechecked by a dedicated fix batch:

- Unknown public `focusId` now falls through to a displayable `targetId` before the whole-table bucket, matching plan R8.
- Unknown private counterpart IDs remain internal grouping keys and render as `未知玩家` rather than raw identifiers.

A third candidate about pending invitations was rejected by an independent validator because the existing proactive-whisper queue already exposes the allowed public intent/reason and accept/decline route. No actionable review findings remain.

| Command | Result |
|---|---|
| `rtk node tests/unity_info_drawer_ux_contracts.mjs` | Passed — `unity info drawer notebook UX contracts ok`. |
| `rtk npm run test:unity-csharp-smoke` | Passed — `CSC_EXIT=0`; warnings are pre-existing unassigned-field warnings in the frozen base bootstrap. |
| `rtk npm run test:unity-ui-audio` | Passed — `unity UI audio regression contracts ok`. |
| `rtk npm run test:unity-viewmodel` | Passed — `unity viewmodel contracts ok`. |
| `rtk npm run test:unity-action-bridge` | Passed — `unity action bridge contracts ok`. |
| `rtk npm run test:unity-assets` | Passed — `unity asset contracts ok`; Unity assets are in sync. |
| `rtk npm run test:mojibake` | Passed — `mojibake contracts ok`. |
| `rtk npm test` | Passed — complete JS/Electron/Unity contract chain, including Unity demo acceptance. |
| `rtk git diff --check` | Passed with no output. |

## Interface Boundary

The existing exporter retains a bounded recent timeline (default 48 player-visible entries), so this UI can guarantee reachability only over every record currently supplied to Unity. It does not claim or reconstruct older source history.

- Interface follow-up: [#6 — expose complete player-safe timeline history to Unity notebook](https://github.com/YuriHKj/botc-solo-simulator/issues/6)
- The issue proposes privacy-preserving cursor/completeness metadata and explicitly preserves `hiddenFromHuman` filtering.

## Fresh Verified Package

The first attempt used the requested npm entry point:

```text
rtk npm run release:unity-ai:verified
```

It was initially blocked before build by Unity licensing (exit code 1; `output/unity-build-latest-20260720-184021.log`). After the Unity entitlement was refreshed, the same entry point produced a fresh executable but could not finish package verification because the isolated worktree intentionally had no ignored `third_party/LocalLLM` payload.

The complete pipeline was rerun with the existing provenance-sensitive LocalLLM directory supplied as an absolute, read-only source:

```text
rtk proxy powershell -ExecutionPolicy Bypass -File tools\build_verify_unity_ai_release.ps1 -LocalLlmSource "C:\Users\11507\Documents\Playground\third_party\LocalLLM" -PackageName "BOTC-Solo-Unity-AI-20260720-information-notebook-verified"
```

Result: passed.

- Build log: `output/unity-build-latest-20260720-200113.log`; contains `Unity prototype build succeeded`.
- Package: `output/release-unity-ai/BOTC-Solo-Unity-AI-20260720-information-notebook-verified/` (696.5 MB).
- Zip: `output/release-unity-ai/BOTC-Solo-Unity-AI-20260720-information-notebook-verified.zip` (544.16 MB).
- Embedded verifier: `ok: true`, attempt 1, packaged runtime state restored. The tiny model was reached through the OpenAI-compatible local endpoint; both sampled rewrites used the verifier-accepted deterministic fallback.
- Cleanup report: `output/release-unity-ai/BOTC-Solo-Unity-AI-20260720-information-notebook-verified/release-cleanup-report.json`.
- Release UI smoke: `output/unity-ui-smoke-release-20260720-200656/visual-regression-report.json`; 8 screenshots, 0 warnings, 0 failures.

## Real Executable Click Evidence

The frozen `tools/unity_build_click_smoke.ps1` was run against the fresh verified executable with `-AllowVisibleWindow`, `-OnlyInfoDrawer`, and `-RestoreRuntimeState`. It exercised the four top-level InfoDrawer tabs and saved screenshots plus the corresponding `unity_state.json` and `unity_viewmodel.json` for every capture.

Completed evidence, not for commit:

- 1280x720 private fixture: `output/unity-information-notebook-2026-07-20/info-drawer-1280-private/click_smoke_report.json`.
- 1280x720 populated-public fixture: `output/unity-information-notebook-2026-07-20/info-drawer-1280-public/click_smoke_report.json`.
- Representative private screenshot: `info-drawer-1280-private/info-drawer-whispers-tab.png`, with its adjacent `.unity_state.json` and `.unity_viewmodel.json`.
- Representative public screenshot: `info-drawer-1280-public/info-drawer-public-tab.png`, with its adjacent `.unity_state.json` and `.unity_viewmodel.json`.
- Both completed reports record a 1280x720 Unity client, successful tab click coordinates, real Unity/Node process IDs, and restored runtime state. Visual inspection found all notebook controls inside the existing drawer envelope with no text spilling into the board.

The frozen harness does not click the new internal player/lens/day/focus/record controls; reachability of those controls remains covered by the proof-first source contract, not by the completed executable click sequence.

The 1366x768 first attempt failed before UI assertions with the Windows-level message `GetWindowRect failed for Unity window`. A retry was stopped immediately when the user instructed `别开游戏`; 1920x1080 and manual internal-control clicks were therefore not run. No `BOTC_Unity_Prototype` process remained after cancellation. These are explicit verification gaps, not passing evidence.

## Commit Hygiene

At the automated-gate checkpoint, the worktree contains only:

- `unity-prototype/Assets/Scripts/BotcPrototypeBootstrap.InfoDrawer.cs`
- `tests/unity_info_drawer_ux_contracts.mjs`
- `docs/verification/UNITY_INFORMATION_NOTEBOOK_2026-07-20.md`

Generated `output/` content remains untracked and must not be committed.
