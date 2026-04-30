$python = 'C:\Users\11507\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
$pyinstaller = 'C:\Users\11507\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\Scripts\pyinstaller.exe'

& $python -m pip install --upgrade pyinstaller pywebview

& $pyinstaller --noconfirm --clean --windowed --name 'BOTC-Solo' `
  --add-data 'index.html;.' `
  --add-data 'styles.css;.' `
  --add-data 'scripts;scripts' `
  --add-data 'assets;assets' `
  'desktop_launcher.py'
