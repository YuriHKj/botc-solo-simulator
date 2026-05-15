# Unity / Electron Interface Gap Check

Date: 2026-05-12

## Checked Sources

- Electron UI entrypoints: `index.html`, `scripts/app.js`, `scripts/ui.js`
- Electron native bridge: `electron/preload.cjs`, `electron/main.cjs`
- Unity bridge actions: `scripts/unity_action_bridge.mjs`
- Unity UI shell: `unity-prototype/Assets/Scripts/BotcPrototypeBootstrap.cs`

## Already Covered In Unity

- New game through JS Core `new-game`
- Script handbook / role icon handbook
- Token selection and token inspector
- Private chat, including claim/deception fields
- Public discussion / phase progression
- Public claim role action
- Nomination and voting
- Human night/day action forms
- Storyteller action queue
- Grimoire role marks and reminder tokens
- Game over feedback
- One-slot save/load and settings for resolution, fullscreen, music/UI/master volume

## Still Missing Or Not Fully Parity

- Electron start menu save slots: Unity currently has simple save/load, but not slot list, delete, or per-slot metadata.
- Public discussion playback controls: Electron has speed/skip/progress for public dialogue playback; Unity has dialogue presentation but no equivalent speed/skip controls.
- Proactive AI whisper inbox: the JS bridge supports `ai-proactive-whispers`, `accept-proactive-whisper`, and `decline-proactive-whisper`, but Unity still lacks a dedicated prompt/inbox UI.
- AI-to-AI private whisper trigger: the JS bridge supports `ai-private-whispers` / `ai-ai-whispers`; Unity does not expose it as a user-facing control.
- Electron layout toggles: left/right/bottom collapse and density controls are not mapped one-to-one because Unity uses a fixed full-screen grimoire layout.
- UI scale setting: Electron settings include UI scale; Unity settings currently cover resolution, fullscreen, and volume only.

## New In This Pass

- Unity main menu now has a dedicated painted town background resource.
- Unity main menu new-game setup now exposes script, player count, and preferred human role before calling JS Core.
