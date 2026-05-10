# Project Structure

This repository keeps runtime entry files at the root and groups reusable assets under `assets/`.

## Root

- `index.html` and `styles.css`: Electron renderer entry and shared desktop UI styles.
- `package.json` and `package-lock.json`: Node/Electron scripts, build config, and locked dependencies.
- `README.md`, `LICENSE`, `.gitignore`, `.editorconfig`: public-facing repository metadata.
- `desktop_launcher.py` and `BOTC-Solo.spec`: legacy PyInstaller desktop packaging entry points.

## Source

- `scripts/`: JS Core game engine, role logic, AI behavior, Electron UI orchestration, Unity viewmodel export, and bridge scripts.
- `electron/`: Electron main/preload/path helper code.
- `unity-prototype/`: Unity visual prototype and build entry.
- `agent/`, `train/`, `eval/`, `schemas/`: local AI/data pipeline experiments and schemas.

## Assets

- `assets/audio/`: canonical stage BGM source files.
- `assets/data/`: script JSON data.
- `assets/fonts/`: font files.
- `assets/roles/`: role icons grouped by script.
- `assets/ui/`: grimoire background, token, shroud, reminder, and other UI art.
- `assets/generated/`: generated prototype art assets.
- `assets/references/` and `assets/reference_scraped/`: reference material kept separate from runtime source assets.

Unity consumes a mirrored copy under `unity-prototype/Assets/Resources/Botc/**`. Keep the root `assets/**` tree canonical and run:

```powershell
npm run unity:sync-assets
npm run test:unity-assets
```

## Documentation

- `docs/design/`: feature design notes and migration plans.
- `docs/verification/`: verification notes and smoke-test records.
- `docs/requirements/`: product requirements and change request history.
- `docs/packaging/`: build and release instructions.
- `docs/notes/`: historical rule and agent notes.
