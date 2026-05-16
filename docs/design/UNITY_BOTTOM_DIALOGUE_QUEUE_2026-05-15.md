# Unity Bottom Dialogue Queue Pass

Date: 2026-05-15

## Scope

This pass keeps JS Core as the only rules and AI authority. Unity only consumes existing viewmodel fields and changes presentation behavior.

## Goals

- Route player-facing information through the bottom formal dialogue stage in sequence.
- Preserve the existing typewriter, paging, source, and close controls.
- Add bottom dialogue coverage for nomination debate lines, vote results, and important action completion feedback.
- Keep vote ceremony and grimoire token state synchronized so vote feedback is readable without relying on a blocking popup.
- Make Information a direct drawer entry for claims, reported information, and the player's own confirmed information.

## Data Contract

No new JS fields are required. Unity reads existing fields:

- `timeline[]` for public/private speech.
- `privateInfo[]` for Storyteller information.
- `humanNightAction` / `actionForms[]` for immediate night-action prompts.
- `nominationDebate` for pre-vote debate lines.
- `voteCeremony` for final vote count/result.
- `action` for bridge completion status and message.

Unity keeps local narration keys for each source so repeated viewmodel polling does not replay old lines.

## Non-Goals

- No JS Core resolver changes.
- No AI strategy or hidden-information changes.
- No bridge action schema changes.

## Verification

- `npm test`
- `git diff --check`
- Unity batch build:
  - log: `output/unity-build-bottom-dialogue-2026-05-15.log`
  - result: `Build Finished, Result: Success.`
