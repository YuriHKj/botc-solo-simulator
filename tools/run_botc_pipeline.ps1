param(
  [switch]$Demo
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

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

$cmd = Get-Command py -ErrorAction SilentlyContinue
if (-not $py -and $cmd) {
  $candidate = $cmd.Source
  if (Test-PythonRuntime $candidate) {
    $py = $candidate
  }
}

if (-not $py) {
  throw "Python runtime not found or not executable. Please install Python 3 and ensure python is available on PATH."
}

$argsList = @("scripts/run_botc_pipeline.py")
if ($Demo) {
  $argsList += "--demo"
}

Write-Host "Using Python: $py"
& $py @argsList
