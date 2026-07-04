param(
  [int]$Seed = 20260610
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$streamingAssets = Join-Path $root "unity-build\BOTC_Unity_Prototype_Data\StreamingAssets"
$fixtureScript = Join-Path $root "scripts\unity_ui_smoke_fixture.mjs"
$submitScript = Join-Path $root "scripts\submit_unity_night_action.mjs"
$bridgeScript = Join-Path $root "scripts\unity_action_bridge.mjs"
$statePath = Join-Path $streamingAssets "unity_state.json"
$viewModelPath = Join-Path $streamingAssets "unity_viewmodel.json"
$actionPath = Join-Path $streamingAssets "unity_action.json"
$resultPath = Join-Path $streamingAssets "unity_action_result.json"
$artifactDir = Join-Path $root "output\unity-status-smoke"
$bridgeOutPath = Join-Path $artifactDir "action-bridge.stdout.txt"
$bridgeErrPath = Join-Path $artifactDir "action-bridge.stderr.txt"

if (-not (Test-Path -LiteralPath $streamingAssets)) {
  throw "Unity build StreamingAssets not found: $streamingAssets"
}
foreach ($required in @($fixtureScript, $submitScript, $bridgeScript)) {
  if (-not (Test-Path -LiteralPath $required)) {
    throw "Required script not found: $required"
  }
}

$node = (Get-Command node -ErrorAction Stop).Source
New-Item -ItemType Directory -Force -Path $artifactDir | Out-Null

function Prepare-Fixture {
  param([string]$StateName)

  Remove-Item -LiteralPath "$actionPath.lock" -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $actionPath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $resultPath -Force -ErrorAction SilentlyContinue
  & $node $fixtureScript "--state=$StateName" "--seed=$Seed" "--streaming-assets=$streamingAssets" | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to prepare $StateName fixture."
  }
}

function Read-Status {
  $output = & $node $submitScript "--streaming-assets=$streamingAssets" "--status" 2>&1
  $exitCode = $LASTEXITCODE
  $text = ($output | Out-String).Trim()
  if ($exitCode -ne 0) {
    throw "unity status failed: $text"
  }
  return $text
}

function Wait-BridgeReady {
  $deadline = (Get-Date).AddSeconds(15)
  while ((Get-Date) -lt $deadline) {
    if (Test-Path -LiteralPath $resultPath) {
      try {
        $result = [System.IO.File]::ReadAllText($resultPath) | ConvertFrom-Json
        if ($result.actionId -eq "" -and $result.ok -eq $true) {
          return
        }
      }
      catch {
        Start-Sleep -Milliseconds 150
      }
    }
    Start-Sleep -Milliseconds 250
  }
  throw "Timed out waiting for status smoke bridge readiness."
}

function Read-SharedText {
  param([string]$PathValue)

  if (-not (Test-Path -LiteralPath $PathValue)) {
    return ""
  }
  $stream = [System.IO.File]::Open(
    $PathValue,
    [System.IO.FileMode]::Open,
    [System.IO.FileAccess]::Read,
    [System.IO.FileShare]::ReadWrite
  )
  try {
    $reader = [System.IO.StreamReader]::new($stream)
    try {
      return $reader.ReadToEnd()
    }
    finally {
      $reader.Dispose()
    }
  }
  finally {
    $stream.Dispose()
  }
}

Prepare-Fixture "storyteller-queue"
$storytellerStatus = Read-Status
if ($storytellerStatus -notmatch "PendingStorytellerType=ravenkeeper-info") {
  throw "Status did not identify the Ravenkeeper Storyteller queue.`n$storytellerStatus"
}
if ($storytellerStatus -notmatch "NextCommand1=npm run unity:submit-storyteller-action") {
  throw "Status did not recommend the Storyteller submit command.`n$storytellerStatus"
}

Prepare-Fixture "nomination-debate"
$voteStatus = Read-Status
if ($voteStatus -notmatch "NominationDebateActive=True") {
  throw "Status did not identify active nomination debate.`n$voteStatus"
}
if ($voteStatus -notmatch "NextCommand1=npm run unity:submit-vote") {
  throw "Status did not recommend the vote command.`n$voteStatus"
}

Prepare-Fixture "phase-assist-public"
$flowStatus = Read-Status
if ($flowStatus -notmatch "Phase=day") {
  throw "Status did not identify the day phase for the flow fixture.`n$flowStatus"
}
if ($flowStatus -notmatch "NextCommand[0-9]+=npm run unity:advance-flow") {
  throw "Status did not recommend the current-game flow advance command.`n$flowStatus"
}
if ($flowStatus -match "NextCommand[0-9]+=npm run unity:playable:flow") {
  throw "Status should not recommend starting a new playable flow runner for the current game.`n$flowStatus"
}

$bridgeProcess = $null
try {
  foreach ($artifactPath in @($bridgeOutPath, $bridgeErrPath)) {
    Remove-Item -LiteralPath $artifactPath -Force -ErrorAction SilentlyContinue
  }
  $bridgeArgs = @(
    $bridgeScript,
    "--watch",
    "--state=$statePath",
    "--viewmodel=$viewModelPath",
    "--action=$actionPath",
    "--result=$resultPath",
    "--no-replay"
  )
  $bridgeProcess = Start-Process `
    -FilePath $node `
    -ArgumentList $bridgeArgs `
    -WorkingDirectory $root `
    -RedirectStandardOutput $bridgeOutPath `
    -RedirectStandardError $bridgeErrPath `
    -WindowStyle Hidden `
    -PassThru
  Wait-BridgeReady

  $advanceOutput = & $node $submitScript "--streaming-assets=$streamingAssets" "--advance-flow" 2>&1
  $advanceExitCode = $LASTEXITCODE
  $advanceText = ($advanceOutput | Out-String).Trim()
  if ($advanceExitCode -ne 0) {
    throw "unity advance-flow failed: $advanceText"
  }
  if ($advanceText -notmatch "Submitted Unity flow advance") {
    throw "advance-flow did not submit a current-game flow action.`n$advanceText"
  }
  if ($advanceText -notmatch "LastActionType=auto-advance") {
    throw "advance-flow did not resolve through auto-advance.`n$advanceText"
  }
  $bridgeError = Read-SharedText $bridgeErrPath
  if (-not [string]::IsNullOrWhiteSpace($bridgeError)) {
    throw "Status smoke bridge wrote stderr: $bridgeError"
  }
}
finally {
  if ($bridgeProcess -and -not $bridgeProcess.HasExited) {
    Stop-Process -Id $bridgeProcess.Id -Force -ErrorAction SilentlyContinue
  }
  Remove-Item -LiteralPath "$actionPath.lock" -Recurse -Force -ErrorAction SilentlyContinue
}

[PSCustomObject]@{
  StorytellerRecommendation = "npm run unity:submit-storyteller-action"
  VoteRecommendation = "npm run unity:submit-vote"
  FlowRecommendation = "npm run unity:advance-flow"
  AdvanceFlowSubmitted = $true
  StreamingAssets = $streamingAssets
} | Format-List
