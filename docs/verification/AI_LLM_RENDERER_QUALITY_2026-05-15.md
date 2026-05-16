# AI LLM Renderer Quality Verification - 2026-05-15

## Scope

This verification covers the optional local LLM speech-polish layer for the Unity build. JS Core remains the rule, visibility, nomination, vote, and AI decision engine; the local model only rewrites already-safe dialogue text.

## Implemented

- Added a quality waterfall design for the local LLM renderer.
- Added a `quality` model tier for packaging: `Qwen2.5-1.5B-Instruct-GGUF` Q4_K_M.
- Wrote package/manifest text files as UTF-8 without BOM so Node and other JSON readers can parse manifests directly.
- Improved prompt payload from copy-prone rough draft rewriting to structured act rendering.
- Removed exact draft text from the model-facing user payload.
- Added near-copy detection, one retry, and local rewrite fallback.
- Added repairs for missing target anchors, accidental speaker prefixes, vague evidence-free wording, and evidence lines that lose concrete anchors.
- Added banned default terms for UI/system wording and vague wording: `口径`, `证据线`, `复核`, `硬信息`, `那件事`, `接前面一句`, `JS Core`, `agentView`, `evidenceContract`.
- Synced `scripts/ai_llm_renderer.js` into Unity StreamingAssets for both prototype and current build.
- Fixed the Unity AI packaging script to pass local LLM preparation arguments by named hashtable splatting.

## Verification Commands

```powershell
npm run test:ai-llm-renderer
npm run ai:llm-render-smoke
npm run test:unity-action-bridge
npm run test:mojibake
```

Result: all passed.

Live local-model smoke:

```powershell
# Started third_party\LocalLLM-quality\llama-server.exe on localhost:18086
$env:BOTC_LLM_RENDERER = '1'
$env:BOTC_LLM_PROVIDER = 'openai-compatible'
$env:BOTC_LLM_ENDPOINT = 'http://127.0.0.1:18086/v1/chat/completions'
$env:BOTC_LLM_MODEL = 'qwen2.5-1.5b-instruct-q4_k_m'
$env:BOTC_LLM_TIMEOUT_MS = '45000'
node scripts\ai_llm_render_smoke.mjs --live
```

Result: passed. Latest report:

- `private-reason`: `llm (openai-compatible)`, no fallback, no near-copy.
- `public-pressure`: `llm (openai-compatible)`, no fallback, no near-copy.

Sample rendered outputs:

- `1号，我注意到你最近的行为和我手里的信息有些不搭。你是不是有什么新的计划？`
- `3号，昨晚发生了什么？`

## Package

Quality package generated:

- Folder: `output\release-unity-ai\BOTC-Solo-Unity-AI-Quality-20260515-r3`
- Zip: `output\release-unity-ai\BOTC-Solo-Unity-AI-Quality-20260515-r3.zip`
- Zip size: about 1.18 GB

Package checks:

- `botc_ai_polish.enabled`: present.
- `LocalLLM\llama-server.exe`: present.
- `LocalLLM\models\qwen2.5-1.5b-instruct-q4_k_m.gguf`: present.
- `LocalLLM\LOCAL_LLM_MANIFEST.json`: tier is `quality`, model license is `Apache-2.0`, runtime license is `MIT`.
- `LocalLLM\LOCAL_LLM_MANIFEST.json`: parses successfully with Node `JSON.parse`.
- Unity StreamingAssets JS Core contains the updated LLM renderer.

## Remaining Caveat

The 1.5B model is still a small local model. The new renderer now prevents several bad visible outcomes, but deeper intelligence still depends on the upstream structured act, evidence contract, claim planner, and public/private dialogue logic.
