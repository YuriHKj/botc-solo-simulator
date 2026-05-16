# AI Strategy Waterfall Verification - 2026-05-15

## Scope

Verified the AI strategy-context pass:

- `scripts/ai_strategy.js`
- `scripts/ai.js` strategy integration for voting and nomination
- `tests/ai_agent_contracts.mjs`
- Unity StreamingAssets JS Core sync

## Commands

```text
npm run test:ai-agents
npm run test:unity-viewmodel
npm run test:unity-action-bridge
npm run test:ai-llm-dialogue-eval
npm test
npm run ai:dialogue-smoke
```

## Results

- `npm run test:ai-agents`: passed
- `npm run test:unity-viewmodel`: passed
- `npm run test:unity-action-bridge`: passed
- `npm run test:ai-llm-dialogue-eval`: passed
- `npm test`: passed
- `npm run ai:dialogue-smoke`: passed, sampled 22 lines with 0 warnings

Full test output included:

- role action contracts ok
- passive info and storyteller queue contracts ok
- night action completeness contracts ok
- ai agent contracts ok
- ai llm renderer contracts ok
- ai llm dialogue eval contracts ok
- Electron build/path contracts passed
- unity viewmodel/action bridge/assets/demo acceptance ok
- mojibake contracts ok

## Behavioral Checks Added

- Late-game `evaluateGameWindow(...)` marks five alive as a must-execute window and exports the correct vote threshold.
- A steady AI remains cautious on early medium suspicion without evidence, but can vote in a late-game evidence-backed window.
- Low-evidence fallback nomination is labelled `pressure-test` and carries game-window metadata.
- Evil world plan notices pressured known allies, records them for protection, and selects a non-ally framing target.

## Residual Risk

- Strategy intent is currently metadata and threshold weighting; Unity does not yet display it.
- Evil `evilWorldPlan` is lightweight. It preserves a framing target and ally-protection pressure, but does not yet maintain a multi-day fake world narrative.
- Voting still uses a bounded threshold model, not full coalition simulation.
