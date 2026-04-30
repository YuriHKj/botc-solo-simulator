param(
  [switch]$Demo
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$defaultPy = "C:\Users\11507\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"

function Test-PythonRuntime($candidate) {
  if (-not $candidate) { return $false }
  if (-not (Test-Path $candidate)) { return $false }
  if ($candidate -like "*WindowsApps\\python.exe") { return $false }
  $proc = Start-Process -FilePath $candidate -ArgumentList "--version" -NoNewWindow -PassThru -Wait -ErrorAction SilentlyContinue
  if (-not $proc) { return $false }
  return $proc.ExitCode -eq 0
}

$py = $null
$cmd = Get-Command python -ErrorAction SilentlyContinue
if ($cmd) {
  $candidate = $cmd.Source
  if (Test-PythonRuntime $candidate) {
    $py = $candidate
  }
}

if (-not $py -and (Test-PythonRuntime $defaultPy)) {
  $py = $defaultPy
}

if (-not $py) {
  throw "Python runtime not found or not executable. Please install Python or update tools/run_botc_pipeline.ps1."
}

$argsList = @("scripts/run_botc_pipeline.py")
if ($Demo) {
  $argsList += "--demo"
}

Write-Host "Using Python: $py"
& $py @argsList
