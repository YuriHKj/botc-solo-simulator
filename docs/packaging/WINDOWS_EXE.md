# Windows EXE Packaging

This page documents the development-only Electron packaging route. It is not the default player path and a successful build is not public-distribution approval. Current product maturity and distribution posture are generated in `docs/CAPABILITY_STATUS.md`.

Build the Electron experiment with:

```powershell
npm run electron:win
```

For a faster unpacked package:

```powershell
npm run electron:pack
```

Build outputs are ignored by Git. Do not publish them until the capability contract's distribution posture and a separate release/rights review allow it.

## Legacy PyInstaller Package

The repository also keeps a legacy PyInstaller/WebView launcher:

```powershell
python -m pip install --upgrade pyinstaller pywebview
python -m PyInstaller --noconfirm --clean --windowed --name BOTC-Solo --add-data "index.html;." --add-data "styles.css;." --add-data "scripts;scripts" --add-data "assets;assets" desktop_launcher.py
```

`desktop_launcher.py` starts a local HTTP server on `127.0.0.1` and opens the app through WebView2. This path and Electron packaging are retained for development experiments; neither supersedes the Unity/Trouble Brewing default player path.

## Notes

- Windows WebView2 runtime is required for the PyInstaller/WebView path.
- Unsigned builds may trigger Windows security prompts.
- Do not commit generated `release/`, `release-*`, `dist/`, `build/`, `unity-build/`, or `output/` directories.
