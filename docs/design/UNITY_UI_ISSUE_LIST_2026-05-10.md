# Unity UI Issue List

Date: 2026-05-10

This list tracks open or not-yet-verified Unity UI issues after the recent visual consolidation, Storyteller queue UI, and complex action form passes. It intentionally does not repeat items already closed in `docs/requirements/CHANGE_REQUESTS.md`.

## P0

### 1. Vote Ceremony Only Renders 12 Voters

Status: fixed in CR-2026-05-10-03; keep this item as a regression watch for future screenshot smoke.

Evidence:

- `RenderVoteTokenCeremony(...)` currently limits visual voter tokens with `Take(12)`.
- Product direction supports 7-15 players.

Impact:

- In 13-15 player games, the vote result can be correct in JS Core while Unity visually omits voters.

Suggested fix:

- Render all voters up to 15 with adaptive radius/label placement.
- Add demo smoke or contract fixture for a 15-player vote ceremony.

### 2. No Automated Visual Regression Coverage

Status: initial screenshot smoke added in CR-2026-05-10-04 and promoted to a 1920x1080 baseline in CR-2026-05-10-05. Still open for image diff, OCR/clipping checks, and secondary 1600x900/1366x768 viewport sweeps.

Evidence:

- Current verification covers JS contracts, demo acceptance, Unity build, and process smoke.
- It does not compare screenshots for modal layout, clipped text, overlap, or viewport-specific regressions.

Impact:

- UI bugs such as overlap, missing tail text, hidden buttons, or bad modal stacking can pass CI-style checks.

Suggested fix:

- Add screenshot smoke for at least:
  - main board;
  - private chat panel;
  - action form;
  - Storyteller queue;
  - script handbook;
  - vote ceremony;
  - role picker.
- Check 1920x1080 first, then add 1600x900 and 1366x768 secondary sweeps.

## P1

### 3. Fixed-Coordinate Layout Is Still Viewport Fragile

Evidence:

- Unity UI is generated with fixed pixel rectangles in `BotcPrototypeBootstrap.cs`.
- Recent builds default to 1600x900, but several panels are 1080-1360px wide and not yet verified on narrower displays.

Impact:

- 1366x768, high-DPI scaling, and non-16:9 windows may clip modals, side rails, or bottom dock.

Suggested fix:

- Define supported acceptance viewports.
- Add simple responsive variants for modal widths, token radius, and top HUD density.

### 4. Complex Guess Actions Still Support Only One Player+Role Pair

Evidence:

- `SendActionFormComposed()` sends one `guessPlayerId` + `guessRoleId` pair for `inputType == "guesses"`.
- Some BOTC-style actions naturally ask for multiple guesses.

Impact:

- UI can look polished but still under-expresses complex role actions.

Suggested fix:

- Add a guess-row builder: player token + role token + add/remove row.
- Keep JS Core payload as `guesses[]`.

### 5. Action Form Buttons Are Not Disabled When Invalid

Evidence:

- `确认发送` remains clickable even when required targets/roles/questions are missing.
- Validation happens after click through dialogue text.

Impact:

- Users can repeatedly click invalid actions and only get delayed text feedback.

Suggested fix:

- Compute `CanSubmitActionForm(form)` and apply disabled visual style.
- Keep “自动合法选择” enabled only when JS Core can safely fill defaults.

### 6. Private Chat Panel Still Needs Final Conversation Treatment

Evidence:

- Current private chat has token card, bubbles, quick prompts, claim role, night info, and secret toggle.
- It is not yet the final “bottom dialogue + portrait/token stage” style the Electron reference suggests.

Impact:

- Playable, but visually still half tool-panel, half dialogue scene.

Suggested fix:

- Make private chat the next major polish pass:
  - stronger left character/token portrait;
  - scrollable recent history;
  - clearer player/AI turn rhythm;
  - compact quick-question strip.

### 7. Storyteller Queue Shows Only First 5 Cards

Evidence:

- Dedicated Storyteller UI renders up to 5 queue cards and shows a remaining count.
- JS Core resolves FIFO, so this is not a rules bug.

Impact:

- Long chained queues are playable but not fully inspectable.

Suggested fix:

- Add queue pagination or a compact vertical scroll.

### 8. Role Picker Has No Pagination

Evidence:

- Role picker lays all script roles into an 11-column grid.
- Current official-script counts fit, but future traveler/custom script counts may overflow.

Impact:

- Fine for current scripts; risky for expanded scripts or custom role pools.

Suggested fix:

- Reuse handbook/action-form pagination for role picker.

## P2

### 9. Token Inspector Still Reads Like Debug Output

Impact:

- It is useful, but visually less refined than the newer modals.

Suggested fix:

- Convert status/reminder/role rows into icon-led fields.
- Add clearer affordances for mark role, reminder, private chat, and nomination.

### 10. More Actions Drawer Is Text-Button Heavy

Impact:

- Functionally fine, but it does not yet match the role-icon and grimoire-token visual direction.

Suggested fix:

- Add small icons for handbook, grimoire, role mark, reminder, recap, new game.

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

### 12. AI Recap Is Still Text Dense

Impact:

- Useful for debugging AI reasoning, less comfortable as player-facing UI.

Suggested fix:

- Turn recap details into suspect cards with score rings, evidence chips, and expandable trails.

### 13. Audio/BGM UI Triggers Need Manual Regression

Evidence:

- BGM refresh was previously tightened, but there is no dedicated UI regression check for opening/closing each modal.

Impact:

- Pure UI actions could accidentally retrigger mood/audio changes in later refactors.

Suggested fix:

- Add a manual or scripted smoke note: open/close each modal and confirm no unexpected BGM restart.

## Suggested Order

1. Fix 15-player vote ceremony rendering.
2. Add screenshot smoke for the six major UI states at 1600x900.
3. Verify and patch secondary 1600x900 / 1366x768 layouts.
4. Add disabled states for complex action forms.
5. Improve private chat final dialogue presentation.
6. Add pagination/scroll for Storyteller queue and role picker.
