param(
  [string]$StateName = "storyteller-queue",
  [int]$Seed = 20260610,
  [int]$StartupTimeoutSeconds = 10,
  [int]$ActionTimeoutSeconds = 45
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$streamingAssets = Join-Path $root "unity-build\BOTC_Unity_Prototype_Data\StreamingAssets"
$statePath = Join-Path $streamingAssets "unity_state.json"
$actionPath = Join-Path $streamingAssets "unity_action.json"
$resultPath = Join-Path $streamingAssets "unity_action_result.json"
$viewModelPath = Join-Path $streamingAssets "unity_viewmodel.json"
$fixtureScript = Join-Path $root "scripts\unity_ui_smoke_fixture.mjs"
$submitScript = Join-Path $root "scripts\submit_unity_night_action.mjs"
$bridgeScript = Join-Path $root "scripts\unity_action_bridge.mjs"
$artifactDir = Join-Path $root "output\unity-build-submit-storyteller-action"
$bridgeOutPath = Join-Path $artifactDir "bridge.stdout.txt"
$bridgeErrPath = Join-Path $artifactDir "bridge.stderr.txt"

function Read-JsonFile {
  param([string]$PathValue)

  return [System.IO.File]::ReadAllText($PathValue) | ConvertFrom-Json
}

function Wait-ResultAction {
  param(
    [string]$ActionId,
    [int]$TimeoutSeconds
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-Path -LiteralPath $resultPath) {
      try {
        $result = Read-JsonFile $resultPath
        if ($result.actionId -eq $ActionId) {
          return $result
        }
      }
      catch {
        Start-Sleep -Milliseconds 150
      }
    }
    Start-Sleep -Milliseconds 250
  }

  throw "Timed out waiting for Unity bridge result actionId=$ActionId"
}

function Wait-ViewModel {
  param(
    [scriptblock]$Predicate,
    [string]$Description,
    [int]$TimeoutSeconds
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-Path -LiteralPath $viewModelPath) {
      try {
        $viewModel = Read-JsonFile $viewModelPath
        if (& $Predicate $viewModel) {
          return $viewModel
        }
      }
      catch {
        Start-Sleep -Milliseconds 150
      }
    }
    Start-Sleep -Milliseconds 250
  }

  throw "Timed out waiting for Unity viewmodel: $Description"
}

if (-not (Test-Path -LiteralPath $streamingAssets)) {
  throw "Unity build StreamingAssets not found: $streamingAssets"
}
foreach ($required in @($fixtureScript, $submitScript, $bridgeScript)) {
  if (-not (Test-Path -LiteralPath $required)) {
    throw "Required script not found: $required"
  }
}

New-Item -ItemType Directory -Force -Path $artifactDir | Out-Null
foreach ($artifactPath in @($bridgeOutPath, $bridgeErrPath)) {
  Remove-Item -LiteralPath $artifactPath -Force -ErrorAction SilentlyContinue
}
Remove-Item -LiteralPath "$actionPath.lock" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $actionPath -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $resultPath -Force -ErrorAction SilentlyContinue

$node = (Get-Command node -ErrorAction Stop).Source

& $node $fixtureScript "--state=$StateName" "--seed=$Seed" "--streaming-assets=$streamingAssets" | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw "Failed to prepare $StateName fixture."
}

$beforeViewModel = Read-JsonFile $viewModelPath
if ($beforeViewModel.pendingStorytellerAction.available -ne $true) {
  throw "Fixture did not expose a pending Storyteller action."
}
$storytellerType = $beforeViewModel.pendingStorytellerAction.type
$targetCount = 0
if ($null -ne $beforeViewModel.pendingStorytellerAction.targetCount) {
  $targetCount = [int]$beforeViewModel.pendingStorytellerAction.targetCount
}
$beforeState = Read-JsonFile $statePath
$beforeQueueCount = 0
if ($null -ne $beforeState.state.pendingStorytellerActions) {
  $beforeQueueCount = @($beforeState.state.pendingStorytellerActions).Count
}

$bridgeArgs = @(
  $bridgeScript,
  "--watch",
  "--state=$statePath",
  "--viewmodel=$viewModelPath",
  "--action=$actionPath",
  "--result=$resultPath"
)
$bridgeProcess = Start-Process `
  -FilePath $node `
  -ArgumentList $bridgeArgs `
  -WorkingDirectory $root `
  -RedirectStandardOutput $bridgeOutPath `
  -RedirectStandardError $bridgeErrPath `
  -WindowStyle Hidden `
  -PassThru

try {
  Wait-ResultAction -ActionId "" -TimeoutSeconds $StartupTimeoutSeconds | Out-Null

  $submitOutput = & $node $submitScript "--streaming-assets=$streamingAssets" "--timeout-ms=$($ActionTimeoutSeconds * 1000)" "--storyteller-action" 2>&1
  $submitExitCode = $LASTEXITCODE
  $submitOutputText = ($submitOutput | Out-String).Trim()
  if ($submitExitCode -ne 0) {
    throw "unity submit storyteller action failed: $submitOutputText"
  }
  $actionMatch = [regex]::Match($submitOutputText, "(?m)^ActionId=(\S+)")
  if (-not $actionMatch.Success) {
    throw "unity submit storyteller action did not print an ActionId: $submitOutputText"
  }
  $actionId = $actionMatch.Groups[1].Value

  $resolvedViewModel = Wait-ViewModel `
    -Description "Storyteller queue to advance after player command" `
    -TimeoutSeconds $ActionTimeoutSeconds `
    -Predicate {
      param($vm)
      return $vm.action.lastActionId -eq $actionId -and
        $vm.action.lastActionType -eq "storyteller-action"
    }

  $resolvedState = Read-JsonFile $statePath
  $remainingQueue = 0
  if ($null -ne $resolvedState.state.pendingStorytellerActions) {
    $remainingQueue = @($resolvedState.state.pendingStorytellerActions).Count
  }
  if ($remainingQueue -ge $beforeQueueCount) {
    throw "Storyteller queue did not advance. before=$beforeQueueCount after=$remainingQueue"
  }

  [PSCustomObject]@{
    StorytellerType = $storytellerType
    TargetCount = $targetCount
    ActionId = $actionId
    QueueBefore = $beforeQueueCount
    QueueAfter = $remainingQueue
    Phase = $resolvedViewModel.phase
    Day = $resolvedViewModel.day
    Night = $resolvedViewModel.night
    PendingStorytellerActionAvailable = $resolvedViewModel.pendingStorytellerAction.available
    PrivateInfoCount = @($resolvedViewModel.privateInfo).Count
    LastActionType = $resolvedViewModel.action.lastActionType
  } | Format-List
}
finally {
  if ($bridgeProcess -and -not $bridgeProcess.HasExited) {
    Stop-Process -Id $bridgeProcess.Id -Force -ErrorAction SilentlyContinue
  }
  Remove-Item -LiteralPath "$actionPath.lock" -Recurse -Force -ErrorAction SilentlyContinue
}
