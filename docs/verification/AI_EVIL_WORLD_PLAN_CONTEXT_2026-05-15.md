# AI Evil World Plan Context Verification - 2026-05-15

## Scope

Verified the flexible evil world plan context pass:

- `scripts/ai_strategy.js`
- `scripts/ai.js`
- `tests/ai_agent_contracts.mjs`
- Unity StreamingAssets JS Core copies

## Commands

```text
npm run test:ai-agents
npm run test:unity-viewmodel
npm run test:unity-action-bridge
npm run ai:dialogue-smoke
npm run test:role-actions
npm test
```

## Results

- `npm run test:ai-agents`: passed
- `npm run test:unity-viewmodel`: passed
- `npm run test:unity-action-bridge`: passed
- `npm run ai:dialogue-smoke`: passed, sampled 22 lines with 0 warnings
- `npm run test:role-actions`: passed
- `npm test`: passed

## Behavioral Checks Added

- Evil world plan version 2 exposes `narrativeAnchors`, `history`, `continuity`, `pivotReason`, and `commitment`.
- Pressured known allies receive negative target bias.
- Current framing targets receive positive target bias.
- A close previous framing target is held across days with increased commitment.
- A clearly stronger new public target causes a `soft-pivot` with a readable pivot reason.

## Notes

- The first full `npm test` attempt saw `engine.js` fail during `test:role-actions` with a duplicate `summary` parse error, but immediate `node --check scripts/engine.js`, `npm run test:role-actions`, and the repeated full `npm test` all passed. No engine edit was required for this pass.

## Residual Risk

- Evil plan context currently influences target ranking and proposal metadata. It does not yet force a dedicated public/private sentence every time, which is intentional to avoid rigid scripted behavior.
- The plan history is bounded and deduplicated, but future replay tooling could surface it more clearly for debugging.
