# Unity Fullscreen UI Baseline

Date: 2026-05-10

## Goal

Make the Unity prototype feel like a fullscreen-first playable demo. The primary visual acceptance target is 1920x1080 fullscreen; smaller windowed modes remain developer/debug paths.

## Scope

- Unity standalone build defaults to fullscreen window mode at 1920x1080.
- `tools/run_unity_demo.ps1` launches fullscreen by default and keeps `-Windowed` for stable local debugging.
- UI screenshot smoke defaults to 1920x1080 output and can optionally request real fullscreen capture.
- The Unity UI continues to consume the existing JS Core viewmodel and action bridge. No rule, AI, permission, or action schema changes are introduced in this pass.

## Layout Direction

- Top HUD: wider bar for 1080p, preserving script/phase/sync/new-game/handbook/menu controls without crowding.
- Bottom dock: wider three-zone layout for objective, short dialogue/status, and six frequent actions.
- Private chat: larger bottom dialogue panel with left token card, right conversation area, and a compose section with quick follow-up buttons.
- Action form and Storyteller queue: larger centered modal panels with wider summary and option regions.
- Script handbook: wider atlas layout with a 5-column role-token grid and more room for detail/night-order text.
- Vote ceremony: larger stage and wider ellipse so 13-15 voter tokens remain readable.
- Role picker: larger official-grimoire-style role-token grid for mark-role and private-claim flows.

## Acceptance

- `npm run unity:demo` should open the build in fullscreen by default.
- `tools/run_unity_demo.ps1 -Windowed` should still open a deterministic 1920x1080 window unless overridden by `-WindowWidth` / `-WindowHeight`.
- `npm run unity:ui-smoke` should generate 1920x1080 screenshots for the seven existing UI states.
- Screenshots should show no obvious text overlap, hidden action buttons, or modal/token collisions in the primary 1080p baseline.
