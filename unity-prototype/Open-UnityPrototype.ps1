$ErrorActionPreference = "Stop"

$projectPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$unityExe = "C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe"

if (-not (Test-Path -LiteralPath $unityExe)) {
  throw "Unity 2022.3.62f3 was not found at: $unityExe"
}

Write-Host "Opening BOTC Unity prototype..."
Write-Host "Project: $projectPath"
Start-Process -FilePath $unityExe -ArgumentList @("-projectPath", $projectPath)
