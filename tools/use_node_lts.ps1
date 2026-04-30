param(
  [switch]$Persist
)

$candidate = 'C:\Users\11507\AppData\Local\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS_Microsoft.Winget.Source_8wekyb3d8bbwe\node-v24.15.0-win-x64'

if (-not (Test-Path (Join-Path $candidate 'node.exe'))) {
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

if (-not (Test-Path (Join-Path $candidate 'node.exe'))) {
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
