# AI LLM Model Budget And Fine-Tune Plan - 2026-05-15

## Goal

Move the Unity AI-polished release from the current lightweight 0.5B/1.5B local model path toward a 2-3GB final package, while keeping the LLM as a language-only renderer.

The LLM must not:

- decide BOTC rules
- inspect hidden state
- pick nominations or votes
- invent role information
- bypass JS Core visibility contracts

## Local Hardware Read

Observed on this machine:

- RAM: about 32GB.
- GPU: NVIDIA GeForce RTX 4060 Laptop GPU, about 4GB VRAM.
- CPU: 16 logical processors.
- Free disk at planning time:
  - `C:` about 28.9GB free.
  - `E:` about 203GB free.

Implication:

- 4B GGUF CPU/offload inference is realistic for smoke testing and release validation.
- Local 4B fine-tuning is not a good default on 4GB VRAM.
- Local LoRA experiments should target 1.5B/1.7B first, or run 4B training on an external GPU.

## Package Space Budget

Current known packages:

| Tier | Model | Model File | Model Size | Expected Zip Range | Intended Use |
| --- | --- | --- | ---: | ---: | --- |
| embedded | Qwen2.5 0.5B Q4_K_M | `qwen2.5-0.5b-instruct-q4_k_m.gguf` | about 0.5GB | about 0.57GB | smallest offline test |
| quality | Qwen2.5 1.5B Q4_K_M | `qwen2.5-1.5b-instruct-q4_k_m.gguf` | about 1.04GB | about 1.18GB | current quality build |
| premium | Qwen3 4B Q4_K_M | `Qwen3-4B-Q4_K_M.gguf` | about 2.33GiB | about 2.4-2.6GB | target 2-3GB release |
| premium-max | Qwen3 4B Q5_K_M | `Qwen3-4B-Q5_K_M.gguf` | about 2.69GiB | about 2.8-3.0GB | upper-bound quality experiment |

Packaging needs temporary space for:

- source `third_party\LocalLLM-*`
- copied release folder under `output\release-unity-ai`
- final zip
- download cache under `.cache\local-llm`

Rule of thumb: keep at least 3x model size free on the packaging drive. For premium-max this means 9-10GB free minimum, preferably more.

## Model Choice

Preferred 2-3GB path:

- `premium`: `Qwen/Qwen3-4B-GGUF`, `Qwen3-4B-Q4_K_M.gguf`, Apache-2.0.

Reason:

- Fits the requested package budget.
- Larger than the current 1.5B model.
- License is simpler than `Qwen2.5-3B-Instruct-GGUF`, whose model card reports `other`.
- 7B Q4 models exceed the target budget once runtime and Unity files are included.

`premium-max` can be tested if the 3GB ceiling is flexible. It may improve phrasing but increases startup and generation cost.

## Fine-Tune Strategy

Do not fine-tune game logic. Fine-tune only the renderer mapping:

```text
structured act + safe visible facts + persona + audience
  -> short natural BOTC table-talk line
```

### Data Sources

1. Replay recorder:
   - `output\demo_replays\latest.json`
   - captures AI speeches, private replies, timeline entries, and enough metadata to rebuild render payloads.

2. LLM dialogue evaluator:
   - `scripts\ai_llm_dialogue_eval.mjs`
   - already converts replays into renderer payloads and warning reports.

3. New SFT export:
   - `scripts\build_llm_sft_dataset.mjs`
   - writes JSONL chat examples for supervised fine-tuning.

### Dataset Modes

- `candidate`: use existing deterministic AI text as target. Useful only for plumbing tests.
- `rendered`: use current local LLM renderer output as target. Useful for distilling 4B/premium output into a smaller model after safety checks.
- `manual`: export review rows for human rewrite before training. Best long-term quality path.

### Training Path

Recommended first experiment:

1. Play several demo games with replay recording enabled.
2. Export manual review queue.
3. Rewrite 200-500 lines into natural BOTC table speech.
4. LoRA train a 1.5B/1.7B instruct model.
5. Merge LoRA, quantize to GGUF, then package with `-ModelTier custom`.

4B LoRA is not blocked by code, but should be treated as external-GPU work on this machine.

## Acceptance Criteria

- `premium` package lands between 2GB and 3GB.
- Direct exe launch still works through `botc_ai_polish.enabled`.
- `npm test` passes after script changes.
- Live smoke with the premium model produces no hidden leak, no speaker prefix duplication, no system jargon, and no near-copy.
- SFT export can generate a JSONL dataset and a review report from `output\demo_replays\latest.json` or fallback sample payloads.

## Remaining Risks

- Larger local models improve language but not reasoning. Bad dialogue acts will still produce mediocre speech.
- Fine-tuning on uncurated deterministic text can teach the model the same awkward style. Manual review or high-quality distillation is required.
- Any trained/merged model needs a fresh license and redistribution review before public release.
