# AI LLM Premium And SFT Verification - 2026-05-15

## Scope

This pass expands the offline Unity AI-polished release toward the requested 2-3GB package budget and adds the first fine-tune dataset export loop.

## Implemented

- Added model tiers:
  - `premium`: `Qwen/Qwen3-4B-GGUF`, `Qwen3-4B-Q4_K_M.gguf`.
  - `premium-max`: `Qwen/Qwen3-4B-GGUF`, `Qwen3-4B-Q5_K_M.gguf`.
- Added package scripts:
  - `npm run prepare:local-llm:premium`
  - `npm run prepare:local-llm:premium-max`
  - `npm run package:unity-ai:premium`
  - `npm run package:unity-ai:premium-max`
- Added Qwen3 `/no_think` prompt control and sampling parameters in `scripts/ai_llm_renderer.js`.
- Switched large package zip creation from PowerShell `Compress-Archive` to `tar.exe`, because `Compress-Archive` fails around 2GB with `Stream was too long`.
- Added SFT dataset export:
  - `scripts\build_llm_sft_dataset.mjs`
  - `npm run ai:llm-sft-dataset`
  - `npm run ai:llm-sft-dataset:rendered`
- Added model budget and fine-tune design:
  - `docs\design\AI_LLM_MODEL_BUDGET_AND_FINETUNE_2026-05-15.md`

## Hardware Boundary

Observed machine:

- RAM: about 32GB.
- GPU: NVIDIA GeForce RTX 4060 Laptop GPU, about 4GB VRAM.

Conclusion:

- Premium 4B Q4 GGUF inference is viable.
- Local 4B fine-tuning is not the default path.
- Fine-tune experiments should start with 1.5B/1.7B LoRA or move 4B LoRA to an external GPU.

## Commands Run

```powershell
npm run prepare:local-llm:premium
npm run test:ai-llm-renderer
npm run ai:llm-sft-dataset -- --limit=8 --output=output\llm_finetune\sft_dataset_test.jsonl
npm run ai:llm-sft-dataset:rendered -- --limit=8 --output=output\llm_finetune\sft_dataset_rendered_test.jsonl
```

Live premium smoke:

```powershell
# Started third_party\LocalLLM-premium\llama-server.exe on localhost:18087
$env:BOTC_LLM_RENDERER = '1'
$env:BOTC_LLM_PROVIDER = 'openai-compatible'
$env:BOTC_LLM_ENDPOINT = 'http://127.0.0.1:18087/v1/chat/completions'
$env:BOTC_LLM_MODEL = 'Qwen3-4B-Q4_K_M'
$env:BOTC_LLM_TIMEOUT_MS = '60000'
node scripts\ai_llm_render_smoke.mjs --live
```

Result after `/no_think` prompt fix:

- `private-reason`: `llm (openai-compatible)`, no fallback, no near-copy.
- `public-pressure`: `llm (openai-compatible)`, no fallback, no near-copy.

Sample rendered outputs:

- `1号，这条行为和我手里的信息对不上。你先说说具体是哪部分？`
- `3号，昨晚的提名和信息能完整说说吗？`

Premium package:

```powershell
powershell -ExecutionPolicy Bypass -File tools\package_unity_ai_release.ps1 -PrepareLocalLlm -RequireLocalLlm -ModelTier premium -LocalLlmSource third_party\LocalLLM-premium -PackageName BOTC-Solo-Unity-AI-Premium-20260515-r2 -OutputRoot output\release-unity-ai
```

Result:

- Folder: `output\release-unity-ai\BOTC-Solo-Unity-AI-Premium-20260515-r2`
- Zip: `output\release-unity-ai\BOTC-Solo-Unity-AI-Premium-20260515-r2.zip`
- Zip size: `2519969861` bytes, about 2.35GiB.
- Manifest parses with Node `JSON.parse`.
- `botc_ai_polish.enabled`: present.
- `LocalLLM\llama-server.exe`: present.
- `LocalLLM\models\Qwen3-4B-Q4_K_M.gguf`: present.
- Manifest model tier: `premium`.
- Manifest model license: `Apache-2.0`.
- Manifest runtime license: `MIT`.

## Dataset Export Result

`npm run ai:llm-sft-dataset -- --limit=8` generated:

- `output\llm_finetune\sft_dataset_test.jsonl`
- `output\llm_finetune\sft_dataset_test.report.md`
- 7 sample rows.

`npm run ai:llm-sft-dataset:rendered -- --limit=8` generated:

- `output\llm_finetune\sft_dataset_rendered_test.jsonl`
- `output\llm_finetune\sft_dataset_rendered_test.report.md`
- 7 sample rows.

The dataset builder falls back to generated sample payloads when the current replay file exists but has no usable AI speech rows.

## Remaining Caveats

- The premium model improves language capacity, but the upstream AI act still controls how smart the content is.
- Fine-tuning on unreviewed deterministic text can preserve awkward phrasing. Manual review or high-quality distillation should come before a real training run.
- `premium-max` has not been downloaded or packaged yet; it should be tested only if the package can approach the 3GB ceiling.
