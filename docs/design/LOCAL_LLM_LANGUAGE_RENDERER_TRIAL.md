# Local LLM Language Renderer Trial

## Goal

This trial adds an optional language-only LLM layer for AI dialogue.

The LLM must not decide game logic. JS Core still owns:

- rules and phase flow
- agent visibility
- evidence/KG/sourceTrust
- claim disclosure policy
- nomination/vote decisions
- evil-team deception strategy

The LLM only rewrites a safe structured act into short player-like Chinese.

## Files

- `scripts/ai_llm_renderer.js`
  - builds a safe payload
  - calls a local provider
  - validates the output
  - retries once when the model simply copies the deterministic draft
  - falls back to the existing deterministic renderer on timeout, leak, or malformed output
- `scripts/ai_llm_render_smoke.mjs`
  - smoke script for private/public sample lines
- `scripts/ai_llm_dialogue_eval.mjs`
  - reads `output/demo_replays/latest.json` when available
  - compares current local dialogue text against optional LLM-rendered text
  - writes Markdown/JSON reports to `output/ai_llm_dialogue_eval/`
- `tests/ai_llm_renderer_contracts.mjs`
  - validates forbidden-term rejection and fallback
- `tests/ai_llm_dialogue_eval_contracts.mjs`
  - validates replay extraction, warning rules, and mock evaluation
- `scripts/unity_action_bridge.mjs`
  - contains the optional Unity bridge postprocess hook
  - only touches new player-visible AI lines after JS Core has already made the decision
  - leaves the synchronous test path unchanged; the standalone bridge CLI uses the async path
- `scripts/unity_viewmodel.js`
  - exports `llmRenderer` status for Unity UI/debug surfaces
  - preserves per-line `timeline[].llmRender` metadata so the UI can show whether a line came from the model or fallback
- `unity-prototype/Assets/Scripts/BotcPrototypeBootstrap.MenuSettings.cs`
  - exposes the experimental Unity setting `本地 LLM 润色`
  - default is off

## Smoke Commands

Mock mode, no model required:

```powershell
npm run test:ai-llm-renderer
npm run test:ai-llm-dialogue-eval
npm run ai:llm-render-smoke
npm run ai:llm-dialogue-eval
```

Live OpenAI-compatible local server:

```powershell
$env:BOTC_LLM_RENDERER="1"
$env:BOTC_LLM_PROVIDER="openai-compatible"
$env:BOTC_LLM_ENDPOINT="http://127.0.0.1:8080/v1/chat/completions"
$env:BOTC_LLM_MODEL="local-model-name"
node scripts/ai_llm_render_smoke.mjs --live
npm run ai:llm-dialogue-eval:live
```

Live Ollama:

```powershell
$env:BOTC_LLM_RENDERER="1"
$env:BOTC_LLM_PROVIDER="ollama"
$env:BOTC_LLM_OLLAMA_MODEL="qwen2.5:3b"
node scripts/ai_llm_render_smoke.mjs --live
```

If `BOTC_LLM_RENDERER=1` is set and no explicit provider or OpenAI-compatible endpoint is configured, JS Core now defaults to Ollama at `http://127.0.0.1:11434/api/generate`.

## Safety Contract

The renderer rejects output when:

- it is empty
- it is too long
- it contains hidden/private forbidden terms
- it contains system words such as `口径`, `证据线`, `JS Core`, `agentView`, or `evidenceContract`
- it misses required visible anchors such as the target token

The renderer also measures near-copy similarity. A near-copy does not immediately fail; it triggers one stronger rewrite attempt so small local models have a second chance to produce a visibly different tabletop line.

Rejected output is not shown. The caller receives the fallback text.

## Recommended Use

Default gameplay should keep the deterministic renderer. Use the Unity setting or CLI flag only for experiments:

```powershell
node scripts/unity_action_bridge.mjs --watch --llm-renderer --llm-provider=ollama --llm-timeout=1800
```

For the common local Ollama case, `--llm-renderer` alone is enough as long as Ollama is already serving `qwen2.5:3b` or `BOTC_LLM_OLLAMA_MODEL` points to another installed model.

The Unity settings panel can toggle `本地 LLM 润色`; in standalone builds this restarts the bundled bridge with:

- `BOTC_LLM_RENDERER=1`
- embedded `LocalLLM/llama-server.exe` + `LocalLLM/models/*.gguf` when present
- otherwise an explicit `BOTC_LLM_ENDPOINT` OpenAI-compatible server
- otherwise Ollama-compatible fallback (`qwen2.5:3b` by default)

For a redistributable AI-polished Unity package, see:

```text
docs/packaging/AI_POLISHED_UNITY_RELEASE.md
```

Keep it experimental until:

- local model latency is measured
- fallback rate is acceptable
- generated output is consistently better than the deterministic renderer
- leak tests cover the active integration point

## Evaluation Loop

1. Play a Unity demo session. The bridge records dialogue snapshots under `output/demo_replays/latest.json`.
2. Run:

```powershell
npm run ai:llm-dialogue-eval
```

3. For real Ollama output:

```powershell
npm run ai:llm-dialogue-eval:live
```

4. Compare `current local` and `LLM rendered` in:

```text
output/ai_llm_dialogue_eval/latest.md
```

The report counts warning deltas and fallback rows. A row is not automatically “better” just because the LLM changed it; it must reduce warning hits without missing required target anchors or leaking forbidden terms.
