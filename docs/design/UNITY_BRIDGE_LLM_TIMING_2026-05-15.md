# Unity Bridge LLM Timing

Date: 2026-05-15

## Problem

Unity used a short 3 second pending-action timeout that made sense before local LLM polishing. With LLM enabled, a private reply or public step may legitimately take longer. During that wait, another click could overwrite `unity_action.json`, so the UI could look like private chat, public chat, and phase progression were interleaving.

## UI Timing Contract

- A tracked Unity action is now serialized while pending.
- If a tracked action is still pending, another tracked action shows a waiting message instead of writing a new action file.
- The first slow warning appears after 8 seconds.
- A pending action is only considered stale after 75 seconds, so a genuinely dead bridge can recover without making normal LLM latency look like failure.
- Non-critical selection actions can still update local focus while a dialogue action is pending.

## JS Bridge LLM Contract

- Bridge LLM postprocess operates on newly visible `aiDialogue.timeline` entries.
- When a timeline line is rendered, the matching new `events.speeches` item is updated with the same text and `llmRender` metadata.
- The bridge no longer separately renders both speech events and timeline entries for the same player-facing line.
- Per-action LLM rendering is capped by `llmMaxLines`, defaulting to 3.
- Runtime configuration:
  - CLI: `--llm-max-lines=<n>`
  - Env: `BOTC_LLM_MAX_LINES_PER_ACTION=<n>`

## Expected Gameplay Behavior

When the player asks a private question, accepts an AI visit, starts public chat, or advances phase, Unity should show a waiting state until JS Core writes the matching `lastActionId` back into the viewmodel. If the player clicks another flow action during that wait, Unity should keep the original action intact and explain that the local model is still processing.

