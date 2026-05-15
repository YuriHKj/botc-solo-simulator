# AI Statement Memory Verification - 2026-05-10

## Commands

- `node --check scripts/ai.js`
- `node --check tests/ai_agent_contracts.mjs`
- `npm run test:ai-agents`
- `npm run test:unity-viewmodel`
- `npm test`

## Result

All commands passed.

## Coverage Added

- Consecutive private follow-up on the same target keeps the same focus and references the previous line.
- Explicit private focus switch explains why the AI changed target.
- AI-AI private statement memory is scoped to the participating pair.
- Repeated private claim questions preserve the established claim role.
- Public statement memory lowers the vote threshold only for the matching public focus.
- Public statement memory can produce a matching nomination proposal with a memory-derived reason.
- `getAIInsightRows(...)` preserves `statementMemory`.

## Notes

`runPrivateWhisper(...)` now returns `focusId` and `focusScore` for the AI response, matching data already written to events and timelines.
