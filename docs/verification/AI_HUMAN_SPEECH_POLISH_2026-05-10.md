# AI Human Speech Polish Verification - 2026-05-10

## Commands

- `node --check scripts/ai.js`
- `node --check tests/ai_agent_contracts.mjs`
- `npm run test:ai-agents`
- `npm run test:unity-viewmodel`
- `npm test`

## Result

All commands passed.

## Coverage Added

- Private "why suspect" replies still include the visible evidence summary.
- Private reasoning replies now include a human cadence bridge such as "我换个说法" or "说白了".
- Second-round public discussion includes table-talk cadence such as "我的意思是", "换句话说", or "先说清楚".
- Existing hidden-info, private-leak, Unity viewmodel, action bridge, asset, demo acceptance, and mojibake contracts remain passing.

## Notes

The polish layer only changes final wording. It does not change suspicion scoring, nomination logic, role information, evidence visibility, or UI contracts.

