# Unity Public Speech And Private Timing Verification

Date: 2026-05-15

## Scope

- Add a Unity/bridge contract for main POV public speech during public chat.
- Prevent proactive private whisper cards from surfacing while entering public chat.
- Count accepted proactive private whispers against the human private-chat limit.

## Checks

- `npm run test:unity-action-bridge`
  - Covers `human-public-speech` timeline/event/AI observation export.
  - Covers clearing same-day pending proactive whispers when entering public.
  - Covers accepted proactive whispers consuming `dayStageMeta.privateUsed`.
- `npm run test:unity-viewmodel`
  - Confirms the updated exported viewmodel shape remains compatible.
- `npm run test:ai-agents`
  - Confirms proactive private and public-pressure vote behavior remain valid.
- `npm test`
  - Full repository JS contract suite passed.
- `git diff --check`
  - No whitespace errors; only existing LF/CRLF conversion warnings.
- Unity batch build
  - `output/unity-build-public-speech-private-timing-2026-05-15.log`
  - Result: Success.
  - Output: `unity-build/BOTC_Unity_Prototype.exe`.

## Unity Notes

- Public phase-assist panel now exposes an input and a `你发言` action.
- `AI 接话` remains the AI conversation-clock step.
- Private/proactive panels are hidden when a private-to-public phase action is pending or confirmed.
