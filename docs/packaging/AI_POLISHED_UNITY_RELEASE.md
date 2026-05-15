# AI-polished Unity release

This package path is for an offline release where AI dialogue can be locally polished without requiring the player to install Ollama.

## Runtime shape

Unity still launches the JS Core bridge. JS Core still owns rules, visibility, AI decisions, nominations, votes, and safety validation.

The optional LLM layer only rewrites already-safe dialogue text:

```text
BOTC_Unity_Prototype.exe
BOTC_Unity_Prototype_Data/
botc_ai_polish.enabled
LocalLLM/
  enable_ai_polish.flag
  llama-server.exe
  models/
    qwen2.5-0.5b-instruct-q4_k_m.gguf
  licenses/
    llama.cpp-MIT.txt
    qwen2.5-0.5b-instruct-APACHE-2.0.txt
```

When Unity starts and either the package marker `botc_ai_polish.enabled` exists, the settings toggle is on, or the command line contains `-botc-llm-renderer` / `-botc-ai-polish`, it tries this order:

1. If `BOTC_LLM_ENDPOINT` is already set, use that OpenAI-compatible endpoint.
2. If exe-sibling `LocalLLM` contains `llama-server.exe` and `models/*.gguf`, start it on `127.0.0.1:18080`.
3. Otherwise fall back to Ollama-compatible env (`qwen2.5:3b` by default).
4. If the model call times out or fails validation, JS Core shows the deterministic renderer output.

## Why not bundle current Ollama model

The current dev loop uses Ollama plus `qwen2.5:3b` as a convenient local experiment. For public distribution, prefer a model artifact with a clear redistributable license and bundle its notices directly.

Default built-in bundle:

- `llama.cpp` runtime: MIT license (`https://github.com/ggml-org/llama.cpp/blob/master/LICENSE`).
- `Qwen2.5-0.5B-Instruct-GGUF`: Apache-2.0 small GGUF (`https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF`).

The 0.5B model is deliberately chosen for distribution size and startup cost. It only polishes wording; JS Core still controls game logic.

Do not ship a GGUF unless the model card and license allow redistribution for your release channel.

## Build command

From repo root:

```powershell
npm run prepare:local-llm
npm run package:unity-ai:embedded
```

The first command downloads `llama.cpp` Windows CPU runtime plus the default Qwen 0.5B GGUF into `third_party/LocalLLM`. The second command copies Unity build + LocalLLM into a zip-ready release folder and writes the auto-enable marker.

Quality package:

```powershell
npm run prepare:local-llm:quality
npm run package:unity-ai:quality
```

The quality tier uses `Qwen2.5-1.5B-Instruct-GGUF` Q4_K_M. It is larger and slower to start, but gives the renderer more language capacity than the default 0.5B package.

Manual packaging with an existing LocalLLM folder:

```powershell
npm run package:unity-ai -- -LocalLlmSource third_party\LocalLLM
```

For a strict release that fails if the local model/runtime is absent:

```powershell
powershell -ExecutionPolicy Bypass -File tools/package_unity_ai_release.ps1 -LocalLlmSource third_party\LocalLLM -RequireLocalLlm
```

The script creates:

```text
output/release-unity-ai/
  BOTC-Solo-Unity-AI-YYYYMMDD-HHMMSS/
  BOTC-Solo-Unity-AI-YYYYMMDD-HHMMSS.zip
```

Inside the package:

- `BOTC_Unity_Prototype.exe`: direct launch. If the package includes a valid `LocalLLM`, the packager writes `botc_ai_polish.enabled`, so this is enough for the polished build.
- `Start AI Polished.bat`: fallback launcher that forces Unity with `-botc-llm-renderer`.
- `Start Basic.bat`: runs Unity with `-botc-no-llm-renderer`.
- `README_AI_POLISH.md`: explains local model fallback behavior.

## LocalLLM source folder checklist

Before packaging a public build, prepare:

```text
third_party/LocalLLM/
  llama-server.exe
  models/
    your-model.gguf
  licenses/
    llama.cpp-MIT.txt
    model-license.txt
  MODEL_CARD.md
```

The packager copies this folder into the release package. It does not commit or vendor large model artifacts into Git.

## Useful launch flags

- `-botc-llm-renderer`: enable local dialogue polish.
- `-botc-ai-polish`: alias for the same behavior.
- `-botc-no-llm-renderer`: force deterministic dialogue.
- `botc_ai_polish.enabled`: package marker that enables polish when directly opening the exe.
- `-botc-llm-root <path>`: override `LocalLLM` folder.
- `-botc-llm-server <path>`: override `llama-server.exe`.
- `-botc-llm-model <path>`: override GGUF model.
- `-botc-llm-port <port>`: default `18080`.
- `-botc-llm-context <tokens>`: default `1024`.
- `-botc-llm-args "<extra args>"`: pass extra llama-server arguments.

## Validation

Run these before packaging:

```powershell
npm run test:ai-llm-renderer
npm run test:unity-action-bridge
npm run ai:llm-dialogue-eval
```

Run a live local model smoke after placing `LocalLLM`:

```powershell
$env:BOTC_LLM_RENDERER="1"
$env:BOTC_LLM_PROVIDER="openai-compatible"
$env:BOTC_LLM_ENDPOINT="http://127.0.0.1:18080/v1/chat/completions"
$env:BOTC_LLM_MODEL="embedded-local-model"
node scripts/ai_llm_render_smoke.mjs --live
```

## Remaining release risk

This solves the model/runtime distribution boundary for dialogue polish. It does not solve Blood on the Clocktower trademark, logo, role icon, or official asset redistribution rights. Keep those assets under your existing release policy.
