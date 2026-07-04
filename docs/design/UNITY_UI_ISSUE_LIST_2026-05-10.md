# Unity UI Issue List

Date: 2026-05-10

This list tracks open or not-yet-verified Unity UI issues after the recent visual consolidation, Storyteller queue UI, and complex action form passes. It intentionally does not repeat items already closed in `docs/requirements/CHANGE_REQUESTS.md`.

## P0

### 1. Vote Ceremony 15-Player Dense Layout Regression Watch

Status: fixed in CR-2026-05-10-03 and re-polished on 2026-06-04 / 2026-06-05; keep this item as a regression watch for future screenshot smoke.

Evidence:

- `RenderVoteTokenCeremony(...)` now renders up to `Take(15)`.
- The `vote-ceremony` smoke fixture records all 15 voters and is included in the full-state baseline.
- Dense mode now uses outward seat labels plus a compact tally rail so high-player-count votes remain readable.
- The tally rail now also includes a live `Vote Threshold Meter`, showing the current yes-vote fill, the execution threshold marker, and whether the vote is still short or already over the line.
- The current voter now has a `Vote Active Voter Spotlight`, center-to-token beam, halo, and pin so the active seat remains scannable in the 15-player ring without covering the central tally or rationale cards.

Impact:

- In 13-15 player games, future layout regressions could make the vote result correct in JS Core while the ceremony becomes visually cramped or omits the last voters.

Suggested fix:

- Keep all voters visible up to 15 with adaptive radius/label placement and a visible active-voter spotlight/beam.
- Keep the 15-player `vote-ceremony` smoke and Unity asset contracts in the regression path.

### 2. Automated Visual Regression Coverage Regression Watch

Status: initial screenshot smoke added in CR-2026-05-10-04 and promoted to a 1920x1080 baseline in CR-2026-05-10-05. Improved again on 2026-06-04 with a full-state 31-state smoke baseline across 1920x1080, 1600x900, and 1366x768, covering 93 screenshots plus reusable coverage/crop/diff verification. Refreshed on 2026-06-05 after the Phase Assist public route pass; the current accepted baseline is `output\unity-ui-smoke-full-baseline-phase-assist-public-route-2026-06-05`; a fixed full-baseline gate is available through `npm run unity:ui-smoke:verify:full`. Still open for OCR/text-clipping heuristics.

Evidence:

- Current verification covers JS contracts, demo acceptance, Unity build, and process smoke.
- Current full-state verification now compares the accepted screenshot set, including `phase-assist-public` with the public route strip and speaker/focus/next-action chips, the Private Chat dialogue-stage frame/latest-focus split, the Stage Dialogue speaker spotlight/beam, the Vote Ceremony active-voter spotlight/beam, the Nomination Debate focus strip, the Endgame verdict focus strip, the Token Inspector target-focus rail, the More Actions route strip, and the Phase Transition route strip, for coverage, crop, and screenshot diff thresholds across the three supported viewports.
- `tools/verify_unity_full_ui_baseline.ps1` requires the default 31-state smoke matrix and all three accepted viewports, failing warnings by default.
- `tools/capture_unity_ui_smoke.ps1` now retries an individual state/viewport once after transient screenshot validation failures before failing the full matrix.
- It still does not perform OCR-level text clipping or semantic overlap detection.

Impact:

- UI bugs such as subtle text clipping, semantic overlap, or unexpected modal/audio side effects can still pass non-OCR checks.

Suggested fix:

- Keep `npm run unity:ui-smoke:verify:full` in the before/after loop for future UI changes.
- Add OCR/text-clipping or semantic overlap checks once the current coverage/crop/diff gate finds no structural risk.
- Add new smoke states before shipping new major UI surfaces so the fixed full-baseline gate stays representative.

## P1

### 3. Fixed-Coordinate Layout Is Still Viewport Fragile

Evidence:

- Unity UI is generated with fixed pixel rectangles in `BotcPrototypeBootstrap.cs`.
- Recent builds default to 1600x900, and the accepted full-state smoke baseline now verifies the broad 31-state matrix at 1920x1080, 1600x900, and 1366x768.

Impact:

- High-DPI scaling and non-16:9 windows may still clip modals, side rails, or bottom action areas outside the current accepted viewports.

Suggested fix:

- Keep 1920x1080, 1600x900, and 1366x768 as supported acceptance viewports in the smoke verifier.
- Add simple responsive variants for modal widths, token radius, and top HUD density only when the visual verifier or manual review finds a concrete viewport risk.

### 4. Complex Guess Actions Multi-Guess Regression Watch

Evidence:

- `SendActionFormComposed()` sends one `guessPlayerId` + `guessRoleId` pair for `inputType == "guesses"`.
- Some BOTC-style actions naturally ask for multiple guesses.

Impact:

- UI can look polished but still under-expresses complex role actions.

Suggested fix:

- Add a guess-row builder: player token + role token + add/remove row.
- Keep JS Core payload as `guesses[]`.

Status 2026-06-04:

- Fixed and visually verified. Unity action forms now keep a multi-guess builder, guess rows, readiness signals, disabled submit state, and `guesses[]` payload submission, with `action-form-guesses` smoke coverage at 1920x1080, 1600x900, and 1366x768.

### 5. Action Form Buttons Are Not Disabled When Invalid

Evidence:

- `确认发送` remains clickable even when required targets/roles/questions are missing.
- Validation happens after click through dialogue text.

Impact:

- Users can repeatedly click invalid actions and only get delayed text feedback.

Suggested fix:

- Compute `CanSubmitActionForm(form)` and apply disabled visual style.
- Keep “自动合法选择” enabled only when JS Core can safely fill defaults.

Status 2026-06-03:

- Fixed and visually verified. Unity action forms now use `CanSubmitActionForm(...)`, disabled submit styling, contextual submit labels, readiness chips, and `action-form` / `action-form-ready` / `action-form-guesses` smoke coverage at 1920x1080, 1600x900, and 1366x768.

### 6. Private Chat Panel Still Needs Final Conversation Treatment

Evidence:

- Current private chat has token card, bubbles, quick prompts, claim role, night info, and secret toggle.
- Recent polish added private rationale rails, compose readiness/preview, a stronger modal backdrop, a compact turn-rhythm track, inbound/outbound lane cues, a conversation stage banner, a persistent scroll rail for long transcripts, a pressure-colored target portrait stage, a compact quick-question strip for recent exchanges, and a latest-message spotlight that marks the current transcript focus.
- Follow-up polish added a contained `Private Dialogue Stage Frame`, increased the transcript viewport height in the tight 1366 layout, and split latest-message focus into underlay/foreground cues so focus markers no longer paint over bubble text.
- It is not yet the final “bottom dialogue + portrait/token stage” style the Electron reference suggests.

Impact:

- Playable, but visually still half tool-panel, half dialogue scene.

Suggested fix:

- Make private chat the next major polish pass:
  - richer player/AI stage treatment beyond the current portrait/header/body and stage-banner cues;
  - richer scrollable recent history if playtests need older-message navigation beyond the current recent-window rail;
  - deeper dialogue-stage treatment if playtests still read the modal as too tool-like after the latest-message spotlight.

### 7. Storyteller Queue Shows Only First 5 Cards

Evidence:

- Dedicated Storyteller UI renders up to 5 queue cards and shows a remaining count.
- JS Core resolves FIFO, so this is not a rules bug.

Impact:

- Long chained queues are playable but not fully inspectable.

Suggested fix:

- Add queue pagination or a compact vertical scroll.

Status 2026-06-03:

- Fixed and visually verified. Unity Storyteller queue now uses `StorytellerQueuePageSize`, page navigation, a compact queue signal strip, and `storyteller-queue` / `storyteller-queue-page2` smoke coverage at 1920x1080, 1600x900, and 1366x768.

### 8. Role Picker Has No Pagination

Evidence:

- Role picker lays all script roles into an 11-column grid.
- Current official-script counts fit, but future traveler/custom script counts may overflow.

Impact:

- Fine for current scripts; risky for expanded scripts or custom role pools.

Suggested fix:

- Reuse handbook/action-form pagination for role picker.

Status 2026-06-03:

- Fixed and visually verified. Unity Role Picker now uses `RolePickerPageSize`, page navigation, a compact mode/filter/page/selection signal strip, and `role-picker` / `role-picker-paged` smoke coverage at 1920x1080, 1600x900, and 1366x768.

## P2

### 9. Token Inspector Still Reads Like Debug Output

Impact:

- It is useful, but visually less refined than the newer modals.

Suggested fix:

- Convert status/reminder/role rows into icon-led fields.
- Add clearer affordances for mark role, reminder, private chat, and nomination.

Status 2026-06-03:

- Improved and visually verified. Unity Token Inspector now has a compact signal strip, highlighted recommended action path, and a selected-target focus rail with a seat pin, target halo, pressure trace, and action node, with `token-inspector` smoke coverage at 1920x1080, 1600x900, and 1366x768.

### 10. More Actions Drawer Is Text-Button Heavy

Impact:

- Functionally fine, but it does not yet match the role-icon and grimoire-token visual direction.

Suggested fix:

- Add small icons for handbook, grimoire, role mark, reminder, recap, new game.

Status 2026-06-05:

- Improved and visually verified. Unity More Actions now renders icon-led tool tiles, section rails, a context pill, compact signal chips, and a target -> recommendation -> next-tool route strip, with `more-actions` smoke coverage at 1920x1080, 1600x900, and 1366x768.

### 11. Script Handbook Has Two Competing Mental Models

Evidence:

- There is a formal Unity role-grid handbook panel.
- There are also information-drawer handbook summaries and previously captured official script-sheet-style visuals.

Impact:

- Users may not immediately know whether “手册” means role reference grid, official sheet, or drawer summary.

Suggested fix:

- Decide final handbook behavior:
  - role atlas modal as primary;
  - official sheet as optional reference tab;
  - drawer only as summary entry point.

Status 2026-06-03:

- Improved for the current Unity modal: the role atlas is explicitly treated as primary, the official night order is preserved as a reference panel, and the drawer is surfaced as the notes/player-info entry point.
- A compact Handbook signal strip now summarizes Atlas, Script, Filter, Order, and Notes state, reducing the competing-model ambiguity without changing role data or drawer routing.
- Remaining optional work: if the product needs a full official script-sheet tab rather than an order reference panel, that is still a separate UI expansion.

### 12. AI Recap Is Still Text Dense

Impact:

- Useful for debugging AI reasoning, less comfortable as player-facing UI.

Suggested fix:

- Turn recap details into suspect cards with score rings, evidence chips, and expandable trails.

Status 2026-06-03:

- Partially improved and visually verified. Unity AI recap already has reasoning signal chips, evidence drilldown rows, and now paged `scoreTrail` drilldown coverage through `recap` / `recap-trail-page2` smoke captures at 1920x1080, 1600x900, and 1366x768. A fuller suspect-card / expandable-trail product treatment remains open.

Status 2026-06-03 follow-up:

- Improved again and visually verified. Unity AI recap now adds a `Suspect Snapshot` panel before the dense reasoning details, aggregating up to three top suspect lanes with score rings/badges plus evidence, trail, and delta chips.
- The existing reasoning selector and paged `scoreTrail` drilldown remain intact below the snapshot, with fresh `recap` / `recap-trail-page2` smoke captures at 1920x1080, 1600x900, and 1366x768.
- Follow-up improved this again: suspect cards now select their matching reasoning trail, reset score-trail paging, and show an open selected state; the new `recap-suspect2` smoke mode verifies a second suspect lane at 1920x1080, 1600x900, and 1366x768.
- Follow-up improved this again: individual score-trail rows now render as selectable chips with a stable expanded detail row, and the expanded row has a `TL` jump that opens the timeline drawer with the source anchor highlighted. The new `recap-trail-jump` smoke mode verifies this path at 1920x1080, 1600x900, and 1366x768.
- Remaining work: add deeper per-evidence source jumps or full timeline scrolling only if playtests show the current source-anchor highlight is not enough.

### 13. Audio/BGM UI Triggers Need Manual Regression

Evidence:

- BGM refresh was previously tightened; before the 2026-06-04 follow-up there was no dedicated UI regression check for opening/closing each modal.

Impact:

- Pure UI actions could accidentally retrigger mood/audio changes in later refactors.

Suggested fix:

- Add a manual or scripted smoke note: open/close each modal and confirm no unexpected BGM restart.

Status 2026-06-04:

- Improved with a dedicated `test:unity-ui-audio` regression contract.
- The contract statically verifies that BGM mood changes stay centralized in initialization/full-state render, that `SetMood(...)` keeps the current clip when the phase mood is unchanged, and that common modal open/close/backdrop methods do not call `SetMood(...)`, reload `AudioClip` resources, or directly restart `musicSource`.
- Remaining optional work: add a runtime/manual ear-check pass if future audio changes need confirmation beyond the static modal-path guard.

## Suggested Order

1. Add more ceremony and stage polish to vote, public dialogue, private dialogue, and endgame review; current vote ceremony already has dense labels, tally chips, and a threshold meter, Phase Assist now has public speaker/focus/next-action chips with dedicated smoke coverage, Nomination Debate now has an accusation-defense-vote duel rail plus a header focus strip, Stage Dialogue now has playback, speech-card, route-ribbon, and speaker spotlight/beam cues, Private Chat now has a contained transcript stage and cleaner latest-focus layering, Token Inspector now has a selected-target focus rail, More Actions now has a target/recommendation/next-tool route strip, Phase Transition now has contained horizon and route chips, and Endgame now has a final-events-to-recap rail plus a verdict focus strip.
2. Keep the reviewed 31-state full-smoke baseline in the before/after loop for future UI changes through `npm run unity:ui-smoke:verify:full`.
3. Continue patching secondary 1600x900 / 1366x768 layouts as the visual verifier or manual screenshot review finds concrete risks.
4. Keep the dedicated audio/BGM UI regression contract in the normal test path, and add a runtime/manual ear-check pass only if future audio behavior changes.
5. Revisit AI Recap only for deeper per-evidence drillthrough if playtest feedback shows the current timeline-anchor jump is not enough.
6. Keep role/action-specific UI refinements scoped to states that have screenshot coverage.
