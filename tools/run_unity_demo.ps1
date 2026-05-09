param(
  [string]$ScriptId = "tb",
  [int]$Players = 9,
  [string]$Role = "washerwoman",
  [int]$Seed = 20260507,
  [switch]$Fresh,
  [switch]$NoWatch,
  [switch]$NoLaunch,
  [switch]$ProjectAssets,
  [switch]$BuildAssets
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$unityExe = Join-Path $root "unity-build\BOTC_Unity_Prototype.exe"
$projectStreamingAssets = Join-Path $root "unity-prototype\Assets\StreamingAssets"
$buildStreamingAssets = Join-Path (Split-Path -Parent $unityExe) "BOTC_Unity_Prototype_Data\StreamingAssets"

if ($ProjectAssets -and $BuildAssets) {
  throw "Use only one of -ProjectAssets or -BuildAssets."
}

if ($BuildAssets) {
  $streamingAssets = $buildStreamingAssets
  $assetMode = "build"
} elseif ($ProjectAssets) {
  $streamingAssets = $projectStreamingAssets
  $assetMode = "project"
} elseif ($NoLaunch) {
  $streamingAssets = $projectStreamingAssets
  $assetMode = "project"
} else {
  $streamingAssets = $buildStreamingAssets
  $assetMode = "build"
}

$statePath = Join-Path $streamingAssets "unity_state.json"
$viewModelPath = Join-Path $streamingAssets "unity_viewmodel.json"
$actionPath = Join-Path $streamingAssets "unity_action.json"
$resultPath = Join-Path $streamingAssets "unity_action_result.json"
$bridgeScript = Join-Path $root "scripts\unity_action_bridge.mjs"
$outputDir = Join-Path $root "output"

New-Item -ItemType Directory -Force -Path $streamingAssets | Out-Null
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

if ($Fresh) {
  Remove-Item -LiteralPath $actionPath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $resultPath -Force -ErrorAction SilentlyContinue
}

$nodeCommand = Get-Command node -ErrorAction Stop
$node = $nodeCommand.Source
$assetSyncScript = Join-Path $root "scripts\sync_unity_assets.mjs"

Write-Host "Checking Unity asset mirror..."
& $node $assetSyncScript

$commonArgs = @(
  $bridgeScript,
  "--state=$statePath",
  "--viewmodel=$viewModelPath",
  "--action=$actionPath",
  "--result=$resultPath",
  "--script=$ScriptId",
  "--players=$Players",
  "--role=$Role",
  "--seed=$Seed"
)

$initArgs = @($commonArgs)
if ($Fresh) {
  $initArgs += "--fresh"
}

Write-Host "Initializing Unity demo state..."
Write-Host "StreamingAssets mode: $assetMode"
Write-Host "StreamingAssets path: $streamingAssets"
& $node @initArgs

if ((-not $NoLaunch) -and (-not (Test-Path -LiteralPath $unityExe))) {
  throw "Unity build not found: $unityExe. Build it first with the Unity editor menu or the documented batchmode command."
}

if (-not $NoWatch) {
  $watchArgs = @($commonArgs)
  $watchArgs += "--watch"
  $bridgeProcess = Start-Process -FilePath $node -ArgumentList $watchArgs -WorkingDirectory $root -WindowStyle Hidden -PassThru
  Write-Host "Unity action bridge running. PID: $($bridgeProcess.Id)"
}

if (-not $NoLaunch) {
  $unityProcess = Start-Process -FilePath $unityExe -WorkingDirectory (Split-Path -Parent $unityExe) -PassThru
  Write-Host "Unity demo launched. PID: $($unityProcess.Id)"
}

Write-Host "ViewModel: $viewModelPath"
