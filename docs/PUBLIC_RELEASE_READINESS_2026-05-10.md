# Public Release Readiness - 2026-05-10

> Historical snapshot only. This note records a repository-preparation pass performed on 2026-05-10. It is not current authorization to distribute binaries or third-party assets. Current distribution posture is generated in `docs/CAPABILITY_STATUS.md`.

This note records the repository-prep pass before making the BOTC Solo Simulator source repository public.

## Scope

- Prepare README wording for a public repository.
- Keep the unofficial, non-commercial, and non-affiliation disclaimers visible.
- Record asset and generated-output boundaries for future contributors.
- Do not change Unity UI, JS Core rules, AI behavior, or build scripts in this pass.

## Position Recorded On 2026-05-10

- The pass recorded a maintainer assessment of then-checked-in assets. That historical assessment is not durable permission evidence and must not be used as current public-display, demo-distribution, or binary-release authorization.
- The project remains an unofficial learning/research prototype and does not claim ownership of third-party Blood on the Clocktower names, rules, trademarks, or setting material.
- New assets, fonts, audio, scraped references, and training corpora should document their source and permitted use before being committed.
- Build outputs and generated runtime files remain ignored by Git; an allowed output location or packaging command does not imply permission to publish them.

## Checks Performed

- Reviewed `.gitignore`; generated outputs, local env files, Unity runtime JSON, screenshots, logs, and build directories are ignored.
- Ran a lightweight secret-pattern scan for common API keys, GitHub tokens, private keys, and env-style credentials. No matches were found.
- Updated `README.md` from the previous private/public-clean warning stance to a public-ready repository stance.
- Moved root-level BGM files into `assets/audio/` and kept Unity audio resources synced from that canonical source.
- Removed internal handoff notes, empty scratch files, and mojibake raw traces from the public documentation surface.

## Before Any Future Binary Release Review

- Run `npm test`.
- Run the Unity demo acceptance path if the build artifact will be distributed.
- Include build date, commit hash, known issues, and asset note in the release description.
- Do not commit `release/`, `unity-build/`, `output/`, or generated `data/` / `models/` artifacts directly.
- The repository includes an MIT `LICENSE` for project source code reuse. That source license is separate from, and does not relicense, third-party BOTC names, rules, trademarks, setting material, visual/audio assets, models, datasets, or any other non-code rights.
