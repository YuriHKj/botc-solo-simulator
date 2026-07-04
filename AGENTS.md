# AGENTS.md

## Project Overview

- Purpose: BOTC Solo Simulator is a single-player Blood on the Clocktower prototype with an Electron/JS core and a Unity playable front end.
- Primary stacks: JavaScript ES modules, Electron, Unity 2022.3 C#, PowerShell tooling, and small Python data/ML utilities.
- Main workflows: JS rules/AI engine, Unity viewmodel/action bridge, Unity package/release builds, Electron packaging, AI dialogue evaluation, and dataset/model experiments.

## Repository Layout

- `scripts/`: JS core game engine, AI behavior, Unity viewmodel export, action bridge, evaluation, and utility scripts.
- `tests/`: Node and PowerShell contract/smoke tests.
- `unity-prototype/`: Unity project, C# UI bootstrap, editor build entry, Resources mirror, and StreamingAssets bridge files.
- `assets/`: canonical runtime assets for roles, UI, fonts, audio, and data. Unity mirrors these under `unity-prototype/Assets/Resources/Botc/**`.
- `tools/`: PowerShell and Node release, package, Unity smoke, capture, and verification tools.
- `docs/`: design notes, verification records, packaging docs, and project status.
- `agent/`, `train/`, `eval/`, `schemas/`, `models/`, `data/`: AI/data pipeline experiments and generated outputs.

## Setup And Local Run

- Install dependencies: `npm install`.
- Electron dev run: `npm run electron:start`.
- Unity fresh demo run: `npm run unity:demo`.
- Unity fresh data only: `powershell -ExecutionPolicy Bypass -File tools/run_unity_demo.ps1 -Fresh -NoWatch -NoLaunch -BuildAssets`.
- Unity bridge for existing build: `npm run unity:bridge:build`.
- Unity asset sync: `npm run unity:sync-assets`.

## Validation Commands

- Full JS/Electron/Unity contract suite: `npm test`.
- AI dialogue eval smoke: `npm run ai:llm-dialogue-eval`.
- Unity viewmodel contracts: `npm run test:unity-viewmodel`.
- Unity action bridge contracts: `npm run test:unity-action-bridge`.
- Unity demo acceptance: `npm run test:unity-demo-acceptance`.
- Unity assets check: `npm run test:unity-assets`.
- Unity C# compile smoke: `npm run test:unity-csharp-smoke`.
- Unity playable smoke commands are exposed as `npm run test:unity-playable-*`.
- Unity AI package build/verify: `npm run package:unity-ai`, `npm run verify:unity-ai-package`, or `npm run release:unity-ai:verified`.

## Coding And Architecture Rules

- Keep JS core as the rules, AI, and permission source of truth. Unity should consume exported viewmodels and submit actions through the action bridge.
- Do not add new roles or scripts unless explicitly requested.
- For Unity UI changes, prefer editing the existing `BotcPrototypeBootstrap.*.cs` partials and local UI helpers before adding new frameworks or broad abstractions.
- Preserve existing bridge JSON contracts unless the corresponding tests and downstream consumers are updated in the same change.
- Player-facing UI must not expose backend terms such as JS Core, payload, viewmodel, or internal debug state unless a dev/debug mode is explicitly active.
- Keep AI dialogue changes grounded in deterministic samples and eval reports, not only live LLM availability.

## Documentation Update Rules

- Update `README.md`, `unity-prototype/README.md`, or `docs/packaging/*` when setup, run, package, or release commands change.
- Add verification notes under `docs/verification/` when a task produces new manual/smoke evidence.
- Add design notes under `docs/design/` only for durable architecture or product decisions.

## Sensitive Or Generated Files

- Generated build outputs normally live in `release/`, `dist/`, `build/`, `unity-build/`, `output/`, and `release-*`; do not commit them unless explicitly requested.
- Unity mirrored assets under `unity-prototype/Assets/Resources/Botc/**` are generated from root `assets/**`; update via `npm run unity:sync-assets` when possible.
- Unity StreamingAssets JS core files mirror root `scripts/**`; use the sync/package scripts when possible and keep root and mirrored copies consistent.
- `package-lock.json` should change only when npm dependencies change.
- Treat `models/`, processed `data/`, and third-party or scraped reference assets as provenance-sensitive outputs.

## Repository Gotchas And Safety Constraints

- The worktree may contain unrelated in-progress changes. Do not reset, checkout, or overwrite them without explicit user instruction.
- Unity batchmode can fail because of Unity licensing or Package Manager state. Report this as blocked rather than claiming a successful build.
- Local LLM packaging depends on `third_party/LocalLLM` unless the package is intentionally deterministic/fallback-only.
- Fresh playable/release verification must not rely on stale `unity_state.json`, `unity_viewmodel.json`, old playtest state, or old package directories.
- Keep high-risk action/state contract changes small and validated with bridge/viewmodel tests.

## Review Expectations

- Scope changes narrowly to the requested playable experience or AI dialogue quality.
- Explain why each edited area changed.
- Record validation commands and results explicitly.
- Call out skipped checks, Unity/license blockers, and remaining P0/P1 risks.

## Done Criteria

- Requested behavior is implemented or the blocker is documented clearly.
- Player-facing UI is validated with screenshots or smoke evidence when changed.
- AI dialogue quality work includes generated samples, classifications, and before/after or deterministic/final/fallback comparison.
- Relevant tests and packaging checks are run, or gaps are reported explicitly.
- Final summary includes changed files, validation, release/package path when produced, and remaining issues.

## Agent Behavior In This Repository

- Read this file before non-trivial implementation work.
- Inspect existing code and docs before editing.
- Plan before broad or behavior-changing work.
- Prefer the smallest viable change that improves player completion of the flow or reduces AI nonsense.
- Do not overwrite unrelated user changes.
- Report blockers honestly.
