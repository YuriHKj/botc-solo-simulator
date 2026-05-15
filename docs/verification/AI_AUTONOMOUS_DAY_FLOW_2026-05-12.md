# AI Autonomous Day Flow Verification - 2026-05-12

## Scope

Verification for:

- AI proactive whisper invitation flow.
- Player accept/decline handling.
- AI-AI private whisper visibility boundary.
- Weak `private-channel` social evidence.
- Unity bridge and viewmodel exposure.
- Conversation-clock public chat step.
- Soft nomination window.
- Post-nomination mutual debate before vote resolution.

## Commands

```powershell
node --check scripts/ai.js
node --check scripts/ai_agents.js
node --check scripts/unity_action_bridge.mjs
node --check scripts/unity_viewmodel.js
node --check scripts/engine.js
node --check scripts/unity_phase_guard.mjs
node --check unity-prototype/Assets/StreamingAssets/BotcJsCore/scripts/ai.js
node --check unity-prototype/Assets/StreamingAssets/BotcJsCore/scripts/ai_agents.js
node --check unity-prototype/Assets/StreamingAssets/BotcJsCore/scripts/unity_action_bridge.mjs
node --check unity-prototype/Assets/StreamingAssets/BotcJsCore/scripts/unity_viewmodel.js
node --check unity-prototype/Assets/StreamingAssets/BotcJsCore/scripts/engine.js
node --check unity-prototype/Assets/StreamingAssets/BotcJsCore/scripts/unity_phase_guard.mjs
npm run test:ai-agents
npm run test:unity-action-bridge
npm run test:unity-assets
npm run ai:dialogue-smoke
npm test
```

## Current Result

- Pass.
- Full rerun completed on 2026-05-12.
- `npm test` passed, including Unity demo acceptance and mojibake checks.
- `npm run ai:dialogue-smoke` sampled 22 lines with 0 warnings.

## Contract Coverage

- `tests/ai_agent_contracts.mjs`
  - AI proactive whisper can be queued.
  - Pending proactive offer does not immediately consume player private slots.
  - Accepting offer reveals and records the private response.
  - Declining offer does not leak response content.
  - AI-AI private content stays out of human logs.
  - AI-AI private channel creates weak `social-read` evidence.
  - JS Core conversation-clock step emits a public speech and updates soft clock state.
  - Nomination debate can be created before any vote event is emitted.

- `tests/unity_action_bridge_contracts.mjs`
  - Unity can request proactive whisper offers.
  - Unity viewmodel exposes `pendingProactiveWhispers`.
  - Unity accept action commits a whisper timeline entry.
  - Unity decline action avoids response leakage.
  - Unity AI-AI whisper action keeps human-facing events clean while creating weak evidence.
  - Unity can advance public chat through `ai-public-step` and receives `publicConversation`.
  - Unity can open a nomination window and receives `nominationClock`.
  - Human nomination intent creates `nominationDebate` without immediately resolving a vote.
  - `resolve-nomination-vote` resolves the pending debate into `voteCeremony`.
  - `pass-nomination-window` can empty-pass the day into night.

## Notes

- Legacy `public-discussion` and immediate `nomination` actions remain available for Electron/backward compatibility.
