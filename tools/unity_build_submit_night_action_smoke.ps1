param(
  [string]$ScriptId = "tb",
  [string]$Role = "fortune-teller",
  [int]$Players = 9,
  [int]$Seed = 20260610,
  [int]$WindowWidth = 1280,
  [int]$WindowHeight = 720,
  [int]$StartupWaitSeconds = 4,
  [int]$ActionTimeoutSeconds = 45
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$unityExe = Join-Path $root "unity-build\BOTC_Unity_Prototype.exe"
$streamingAssets = Join-Path $root "unity-build\BOTC_Unity_Prototype_Data\StreamingAssets"
$statePath = Join-Path $streamingAssets "unity_state.json"
$actionPath = Join-Path $streamingAssets "unity_action.json"
$resultPath = Join-Path $streamingAssets "unity_action_result.json"
$viewModelPath = Join-Path $streamingAssets "unity_viewmodel.json"
$bridgeScript = Join-Path $root "scripts\unity_action_bridge.mjs"
$submitScript = Join-Path $root "scripts\submit_unity_night_action.mjs"

function Read-JsonFile {
  param([string]$PathValue)

  return [System.IO.File]::ReadAllText($PathValue) | ConvertFrom-Json
}

function Remove-BridgeFiles {
  Remove-Item -LiteralPath $actionPath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $resultPath -Force -ErrorAction SilentlyContinue
}

function Get-BridgeNodeProcesses {
  param([int[]]$BeforeIds = @())

  $needle = "unity_action_bridge.mjs"
  return @(
    Get-CimInstance Win32_Process -Filter "name = 'node.exe'" -ErrorAction SilentlyContinue |
      Where-Object {
        $BeforeIds -notcontains $_.ProcessId -and
        $_.CommandLine -and
        ($_.CommandLine -like "*$needle*" -or $_.CommandLine -like "*BotcJsCore*")
      }
  )
}

function Wait-UnityBridgeProcess {
  param([int[]]$BeforeIds)

  $deadline = (Get-Date).AddSeconds($StartupWaitSeconds)
  while ((Get-Date) -lt $deadline) {
    $nodes = @(Get-BridgeNodeProcesses -BeforeIds $BeforeIds)
    if ($nodes.Count -gt 0) {
      return $nodes
    }
    Start-Sleep -Milliseconds 250
  }

  throw "Unity did not start a Node bridge process."
}

function Prepare-BridgeFreshState {
  $node = (Get-Command node -ErrorAction Stop).Source
  Remove-BridgeFiles
  & $node $bridgeScript `
    --fresh `
    "--script=$ScriptId" `
    "--role=$Role" `
    "--players=$Players" `
    "--seed=$Seed" `
    "--state=$statePath" `
    "--viewmodel=$viewModelPath" `
    "--action=$actionPath" `
    "--result=$resultPath" `
    --no-replay | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to prepare bridge fresh state for $ScriptId/$Role."
  }

  $viewModel = Read-JsonFile $viewModelPath
  if ($viewModel.phase -ne "night" -or $viewModel.humanNightAction.available -ne $true) {
    throw "Fresh state did not expose a human night action."
  }
  Remove-BridgeFiles
}

if (-not (Test-Path -LiteralPath $unityExe)) {
  throw "Unity build executable not found: $unityExe"
}
if (-not (Test-Path -LiteralPath $streamingAssets)) {
  throw "Unity build StreamingAssets not found: $streamingAssets"
}
if (-not (Test-Path -LiteralPath $submitScript)) {
  throw "Submit script not found: $submitScript"
}

Prepare-BridgeFreshState

$beforeNodeIds = @(Get-Process node -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
$unityProcess = Start-Process `
  -FilePath $unityExe `
  -ArgumentList @("-screen-fullscreen", "0", "-screen-width", "$WindowWidth", "-screen-height", "$WindowHeight") `
  -WorkingDirectory (Split-Path -Parent $unityExe) `
  -PassThru

try {
  $newNodes = @(Wait-UnityBridgeProcess -BeforeIds $beforeNodeIds)

  $node = (Get-Command node -ErrorAction Stop).Source
  $submitOutput = & $node $submitScript "--streaming-assets=$streamingAssets" "--timeout-ms=$($ActionTimeoutSeconds * 1000)"
  if ($LASTEXITCODE -ne 0) {
    throw "submit_unity_night_action failed: $submitOutput"
  }

  $viewModel = Read-JsonFile $viewModelPath
  if ($viewModel.action.lastActionType -ne "night-action") {
    throw "Submit smoke did not refresh Unity viewmodel with a night-action."
  }
  if ($viewModel.phase -ne "day" -or $viewModel.humanNightAction.available -ne $false) {
    throw "Submitted night action did not resolve into day. phase=$($viewModel.phase), available=$($viewModel.humanNightAction.available)"
  }

  [PSCustomObject]@{
    UnityPid = $unityProcess.Id
    NodePids = ($newNodes | Select-Object -ExpandProperty ProcessId) -join ","
    ScriptId = $ScriptId
    Role = $Role
    Seed = $Seed
    Phase = $viewModel.phase
    DayStage = $viewModel.dayStage
    HumanNightActionAvailable = $viewModel.humanNightAction.available
    LastActionType = $viewModel.action.lastActionType
    LastActionId = $viewModel.action.lastActionId
    SubmitSummary = ($submitOutput -join " | ")
  } | Format-List
}
finally {
  if ($unityProcess -and -not $unityProcess.HasExited) {
    Stop-Process -Id $unityProcess.Id -Force -ErrorAction SilentlyContinue
  }
  foreach ($node in @(Get-CimInstance Win32_Process -Filter "name = 'node.exe'" -ErrorAction SilentlyContinue | Where-Object { $beforeNodeIds -notcontains $_.ProcessId })) {
    Stop-Process -Id $node.ProcessId -Force -ErrorAction SilentlyContinue
  }
}
