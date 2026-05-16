# AI Public Memory And Good Day Strategy Verification

Date: 2026-05-16

## Scope

This verification covers the CR-2026-05-16-02 pass:

- cross-day AI shared-info memory
- human public speech routing into the next addressed AI response
- good-side day execution / verification strategy pressure
- Unity JS Core sync for prototype and build StreamingAssets

## Commands

```powershell
node --check scripts\ai_statement_memory.js
node --check scripts\ai_private_social.js
node --check scripts\ai_public_discussion.js
node --check scripts\unity_action_bridge.mjs
node --check scripts\ai_strategy.js
node --check scripts\ai_thought_frame.js
node --check scripts\ai.js
npm run test:ai-agents
npm run test:unity-action-bridge
npm run test:unity-viewmodel
npm test
```

## Result

All commands passed.

`npm test` covered:

- role action contracts
- passive info and Storyteller queue contracts
- night action completeness contracts
- AI agent contracts
- AI LLM renderer and dialogue eval contracts
- Electron build/path contracts
- Unity viewmodel and action bridge contracts
- Unity assets and demo acceptance
- mojibake contracts

## Notes

- `human-public-speech` now queues `pendingResponseSpeakerId` / `pendingResponseFocusId`; the next `ai-public-step` consumes the pending response.
- AI proactive private whispers now read `statementMemory.sharedInfoByPairKey` so unchanged first-night information is not repeatedly pushed to the same player every day.
- `evaluateGoodDayStrategy(...)` is bounded: it shifts disclosure, nomination, and vote pressure, but low-evidence nominations remain explicitly labelled as pressure tests.
