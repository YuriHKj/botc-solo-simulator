# AI LLM Renderer Quality Waterfall

## Scope

This pass improves the optional local LLM dialogue polish layer for Unity releases.

The LLM remains language-only. It must not:

- decide game rules
- inspect hidden identity or team state
- choose nominations or votes
- invent night information
- override JS Core visibility or evidence contracts

## Current Problem

The first embedded build proved that `llama.cpp + Qwen2.5-0.5B` can run offline, but output quality is too subtle. The model often receives a nearly finished deterministic sentence and returns it with only tiny edits.

Visible symptoms:

- LLM smoke can show `llm (openai-compatible)` while rendered text is almost identical to candidate text.
- Small local models follow the draft too literally.
- The release has only one lightweight model tier, so quality testing requires manual model replacement.

## Requirements

1. Prompt quality:
   - Treat deterministic text as a rough draft, not the desired answer.
   - Render from structured act fields: audience, intent, target, persona, visible evidence, required terms, and forbidden terms.
   - Prefer one or two short tabletop-player sentences.
   - Avoid UI/system words: `口径`, `证据线`, `JS Core`, `agentView`, `evidenceContract`, `接前面一句`.

2. Safety:
   - Preserve required visible anchors such as target seat number.
   - Reject hidden/private forbidden terms.
   - Reject speaker prefixes because Unity already shows speaker labels.
   - Fall back to deterministic text on timeout, invalid JSON, leakage, or missing anchors.

3. Anti-copy:
   - Measure similarity between LLM output and deterministic candidate.
   - If similarity is too high, retry once with a stronger rewrite prompt.
   - Record near-copy metadata in the result for evaluation.

4. Model tiers:
   - `tiny`: Qwen2.5-0.5B Q4_K_M, smallest distributable package.
   - `balanced`: same as tiny for now, kept as the default compatibility alias.
   - `quality`: Qwen2.5-1.5B Q4_K_M, larger package with better language capacity.
   - Custom model repo/file remains supported.

5. Verification:
   - Contract tests for prompt shape, safety rejection, fallback, and near-copy retry.
   - Mock smoke for deterministic CI.
   - Live smoke against embedded llama.cpp when a model is present.

## Data Flow

```text
JS Core AI decision
  -> deterministic candidate text
  -> safe LLM payload
  -> local provider
  -> output validation
  -> near-copy check
  -> optional retry
  -> Unity timeline / speech text
```

## Release Policy

The default release can stay lightweight. A quality release may be generated with:

```powershell
npm run prepare:local-llm:quality
npm run package:unity-ai:quality
```

Both tiers copy model licenses and a manifest into `LocalLLM/`.

## Acceptance

- `npm run test:ai-llm-renderer` passes.
- `npm run test:unity-action-bridge` passes.
- `npm run test:mojibake` passes.
- Mock smoke shows non-fallback LLM output.
- Live embedded smoke reports `llm (openai-compatible)`.
- For near-copy mock transport, the renderer retries and returns the second, more natural line.
