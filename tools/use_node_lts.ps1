param(
  [switch]$Persist
)

function Test-NodeCandidate($candidate) {
  if (-not $candidate) { return $false }
  return Test-Path (Join-Path $candidate 'node.exe')
}

$candidate = $env:NODE_HOME

if (-not (Test-NodeCandidate $candidate)) {
  $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
  if ($nodeCommand -and $nodeCommand.Source) {
    $candidate = Split-Path -Parent $nodeCommand.Source
  }
}

if (-not (Test-NodeCandidate $candidate)) {
  $programFilesCandidate = Join-Path $env:ProgramFiles 'nodejs'
  if (Test-NodeCandidate $programFilesCandidate) {
    $candidate = $programFilesCandidate
  }
}

if (-not (Test-NodeCandidate $candidate)) {
  $fallback = Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like 'OpenJS.NodeJS.LTS*' } |
    ForEach-Object { Get-ChildItem $_.FullName -Directory -ErrorAction SilentlyContinue } |
    Where-Object { $_.Name -like 'node-v*-win-x64' } |
    Sort-Object Name -Descending |
    Select-Object -First 1
  if ($fallback) {
    $candidate = $fallback.FullName
  }
}

if (-not (Test-NodeCandidate $candidate)) {
  Write-Error "Node LTS not found. Run: winget install OpenJS.NodeJS.LTS --scope user --silent --accept-package-agreements --accept-source-agreements"
  exit 1
}

$env:Path = "$candidate;$env:Path"
Set-Alias -Name node -Value (Join-Path $candidate 'node.exe') -Scope Global

if ($Persist) {
  $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
  $parts = @($userPath -split ';' | Where-Object { $_ -and $_.Trim() -ne '' })
  $parts = @($parts | Where-Object { $_ -ne $candidate })
  $newUserPath = @($candidate) + $parts
  [Environment]::SetEnvironmentVariable('Path', ($newUserPath -join ';'), 'User')
  Write-Host "User PATH updated: Node LTS moved to first."
}

Write-Host "Using Node from: $candidate"
& (Join-Path $candidate 'node.exe') -v
if (Test-Path (Join-Path $candidate 'npm.cmd')) {
  & (Join-Path $candidate 'npm.cmd') -v
}
