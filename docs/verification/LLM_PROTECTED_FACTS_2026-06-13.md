# LLM Protected Facts Verification - 2026-06-13

## Release Package

- Folder: `output/release-unity-ai/BOTC-Solo-Unity-AI-CorePlayable-20260613-1926-llm-facts`
- Zip: `output/release-unity-ai/BOTC-Solo-Unity-AI-CorePlayable-20260613-1926-llm-facts.zip`
- Cleanup report: `output/release-unity-ai/BOTC-Solo-Unity-AI-CorePlayable-20260613-1926-llm-facts/release-cleanup-report.json`

The package verifier passed with the embedded tiny LocalLLM path enabled via the AI-polish launch mode. The verifier reported `llm.enabled = true`, provider/source `openai-compatible`, touched 2 timeline entries, and fallback 0 during the package flow.

## Protected Facts

The renderer now treats private human target labels `你`, `X号（你）`, and `X号(你)` as UI context, not required player-visible terms.

Private night/claim hard facts now extract and protect:

- Role names such as `洗衣妇`, `图书管理员`, `调查员`, `占卜师`, and `共情者`.
- Seat labels such as `2号` and `3号`.
- Result relations such as `有一位是`, `不是/否`, `查到`, `拿到`, and count facts such as `1位邪恶`.

If a model output loses any protected fact, repair is skipped and the final player-visible text falls back to the deterministic draft.

## Live Smoke

- Report: `output/llm-facts-live-smoke-20260613-1926/live-smoke.md`
- JSON: `output/llm-facts-live-smoke-20260613-1926/live-smoke.json`
- Bridge report: `output/llm-facts-live-smoke-20260613-1926/bridge-live-smoke.md`
- Bridge JSON: `output/llm-facts-live-smoke-20260613-1926/bridge-live-smoke.json`
- Server: package `LocalLLM/llama-server.exe`
- Model: `qwen2.5-0.5b-instruct-q4_k_m.gguf`
- Endpoint: `http://127.0.0.1:18080/v1/chat/completions`

Before/draft:

> 我是洗衣妇，昨晚拿到 2号 与 3号 中有一位是洗衣妇。

Rejected tiny LocalLLM output:

> 5号：您好，请问有什么我可以帮助您的吗？

Final player-visible text:

> 我是洗衣妇，昨晚拿到 2号 与 3号 中有一位是洗衣妇。

Result: `factEquivalent = true`, `fallbackUsed = true`, reason `missing-protected-fact:role:洗衣妇`.

Package bridge live smoke used the final package `unity_action_bridge.mjs` with the same package LocalLLM endpoint. The bridge touched 1 private timeline entry, rejected the tiny model output for `missing-protected-fact:relation:有一位是`, and left the final Unity timeline text as:

> 我是洗衣妇，昨晚拿到 2号 与 3号 中有一位是洗衣妇。

## Validation Commands

- `npm run test:ai-llm-renderer` passed.
- `npm run test:unity-action-bridge` passed.
- `npm run test:ai-llm-dialogue-eval` passed.
- `npm run ai:llm-dialogue-eval -- --sample --mock --limit=50` passed: 50 rows, 50 passed, 0 failed, 0 final warnings.
- `npm run test:unity-build-core-sync` passed.
- `powershell -ExecutionPolicy Bypass -File tools/package_unity_ai_release.ps1 -PackageName BOTC-Solo-Unity-AI-CorePlayable-20260613-1926-llm-facts -OutputRoot output\release-unity-ai -VerifyPackage` passed.

## Notes

- A first packaging attempt, `BOTC-Solo-Unity-AI-CorePlayable-20260613-1912-llm-facts`, failed package verification because the generated Unity JS mirror did not yet include the paired `ai_speech_renderer.js` export required by the updated renderer. It is not treated as a verified package.
- A second package, `BOTC-Solo-Unity-AI-CorePlayable-20260613-1920-llm-facts`, passed package verification, but the protected-facts live smoke initially hit a 1024-token context limit. The final `1926` package includes the shorter protected-facts prompt and is the accepted package for this fix.
- C# compile still reports existing CS0649 warnings for unused private UI fields; compilation exits successfully.
