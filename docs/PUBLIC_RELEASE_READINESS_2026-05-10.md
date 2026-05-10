# Public Release Readiness - 2026-05-10

This note records the repository-prep pass before making the BOTC Solo Simulator repository public.

## Scope

- Prepare README wording for a public repository.
- Keep the unofficial, non-commercial, and non-affiliation disclaimers visible.
- Record asset and generated-output boundaries for future contributors.
- Do not change Unity UI, JS Core rules, AI behavior, or build scripts in this pass.

## Current Public Position

- The maintainer confirmed that the current checked-in assets do not have infringement issues for this repository's public display and demo distribution.
- The project remains an unofficial learning/research prototype and does not claim ownership of third-party Blood on the Clocktower names, rules, trademarks, or setting material.
- New assets, fonts, audio, scraped references, and training corpora should document their source and permitted use before being committed.
- Build outputs and generated runtime files remain ignored by Git and should be distributed through releases when needed.

## Checks Performed

- Reviewed `.gitignore`; generated outputs, local env files, Unity runtime JSON, screenshots, logs, and build directories are ignored.
- Ran a lightweight secret-pattern scan for common API keys, GitHub tokens, private keys, and env-style credentials. No matches were found.
- Updated `README.md` from the previous private/public-clean warning stance to a public-ready repository stance.

## Before Publishing A Binary Release

- Run `npm test`.
- Run the Unity demo acceptance path if the build artifact will be distributed.
- Include build date, commit hash, known issues, and asset note in the release description.
- Do not commit `release/`, `unity-build/`, `output/`, or generated `data/` / `models/` artifacts directly.
- The repository now includes an MIT `LICENSE` for source code reuse. Third-party BOTC names, rules, trademarks, setting material, and any non-code rights are not relicensed by MIT.
