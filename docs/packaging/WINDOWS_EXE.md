# Windows EXE Packaging

The primary desktop packaging path is Electron:

```powershell
npm run electron:win
```

For a faster unpacked package:

```powershell
npm run electron:pack
```

Build outputs are ignored by Git and should be distributed through GitHub Releases when needed.

## Legacy PyInstaller Package

The repository also keeps a legacy PyInstaller/WebView launcher:

```powershell
python -m pip install --upgrade pyinstaller pywebview
python -m PyInstaller --noconfirm --clean --windowed --name BOTC-Solo --add-data "index.html;." --add-data "styles.css;." --add-data "scripts;scripts" --add-data "assets;assets" desktop_launcher.py
```

`desktop_launcher.py` starts a local HTTP server on `127.0.0.1` and opens the app through WebView2. This path is useful for experiments, but Electron is the better-maintained route.

## Notes

- Windows WebView2 runtime is required for the PyInstaller/WebView path.
- Unsigned builds may trigger Windows security prompts.
- Do not commit generated `release/`, `release-*`, `dist/`, `build/`, `unity-build/`, or `output/` directories.
