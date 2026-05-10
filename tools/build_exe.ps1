$ErrorActionPreference = "Stop"

$pythonCommand = Get-Command python -ErrorAction SilentlyContinue
if (-not $pythonCommand) {
  throw "Python not found. Install Python 3 and ensure python is available on PATH."
}

$python = $pythonCommand.Source

& $python -m pip install --upgrade pyinstaller pywebview

& $python -m PyInstaller --noconfirm --clean --windowed --name 'BOTC-Solo' `
  --add-data 'index.html;.' `
  --add-data 'styles.css;.' `
  --add-data 'scripts;scripts' `
  --add-data 'assets;assets' `
  'desktop_launcher.py'
