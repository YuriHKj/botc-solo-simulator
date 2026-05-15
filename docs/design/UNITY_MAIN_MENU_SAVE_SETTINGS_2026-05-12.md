# Unity Main Menu, Save, and Settings

Date: 2026-05-12

## Goal

Make the Unity prototype start like a standalone game instead of a paused in-game overlay. The initial screen is a dedicated main menu. Gameplay dialogue, especially the first-night storyteller prompt, should appear only after the player enters the grimoire.

## Scope

- Unity-only UI and local shell behavior.
- No AI, rule-engine, role, phase-guard, or viewmodel schema changes.
- JS Core remains the source of truth for game state.

## Runtime Flow

1. Unity starts and boots the local JS Core bridge as before.
2. Main menu is shown on top of the background while gameplay HUD is hidden.
3. Player chooses:
   - **New Game / Enter Grimoire**: send `new-game`, hide menu, then show first-night/phase dialogue after the viewmodel refreshes.
   - **Continue Current Game**: hide menu and show current phase guidance.
   - **Load Save**: restore local copied state/viewmodel files, refresh UI, enter grimoire.
   - **Settings**: open settings panel without entering gameplay.
4. In-game settings button opens the same settings panel.

## Save Model

Unity stores a single local save under `Application.persistentDataPath/BotcSoloUnitySave/`.

Saved files:

- `unity_state.json`
- `unity_viewmodel.json`
- `unity_action_result.json` when available
- `save_meta.json` with timestamp and short viewmodel summary

The save is intentionally a file copy of bridge artifacts, not a new game-state format. This keeps Unity from becoming a second rule engine.

## Settings Model

Settings are stored in `PlayerPrefs`.

- Resolution preset: `1280x720`, `1600x900`, `1920x1080`, `2560x1440`
- Fullscreen: on/off
- Master volume
- Music volume
- UI sound volume

Effective audio volume is:

- music source: `master * music`
- UI source: `master * ui`

## Verification

- Unity batch build passed.
- `npm test` passed.
- UI smoke covered `main-menu`, `settings`, and `stage-dialogue` at 1920x1080.
- Screenshot artifact: `output/unity-ui-smoke-20260512-170729`.
- Verification record: `docs/verification/UNITY_MAIN_MENU_SAVE_SETTINGS_2026-05-12.md`.
