param(
  [int]$Players = 9,
  [int]$MaxSteps = 512,
  [int]$WindowWidth = 1280,
  [int]$WindowHeight = 720,
  [int]$StartupWaitSeconds = 4,
  [int]$ActionTimeoutSeconds = 45,
  [int]$AutoTimeoutSeconds = 140
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$unityExe = Join-Path $root "unity-build\BOTC_Unity_Prototype.exe"
$streamingAssets = Join-Path $root "unity-build\BOTC_Unity_Prototype_Data\StreamingAssets"
$actionPath = Join-Path $streamingAssets "unity_action.json"
$resultPath = Join-Path $streamingAssets "unity_action_result.json"
$viewModelPath = Join-Path $streamingAssets "unity_viewmodel.json"
$statePath = Join-Path $streamingAssets "unity_state.json"

$cases = @(
  [ordered]@{ ScriptId = "tb"; Role = "fortune-teller"; Seed = 20260610 },
  [ordered]@{ ScriptId = "bmr"; Role = "gambler"; Seed = 20260611 },
  [ordered]@{ ScriptId = "snv"; Role = "artist"; Seed = 20260612 }
)

function Write-ActionJson {
  param(
    [string]$PathValue,
    [object]$Action
  )

  $json = $Action | ConvertTo-Json -Depth 24
  [System.IO.File]::WriteAllText($PathValue, $json, [System.Text.UTF8Encoding]::new($false))
}

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
        Start-Sleep -Milliseconds 200
      }
    }
    Start-Sleep -Milliseconds 300
  }
  throw "Timed out waiting for Unity bridge result actionId=$ActionId"
}

function Count-AutoStep {
  param(
    [object]$AutoAdvance,
    [string]$Type
  )

  return @($AutoAdvance.steps | Where-Object { $_.type -eq $Type }).Count
}

function Invoke-MatrixCase {
  param([object]$Case)

  Remove-Item -LiteralPath $actionPath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $resultPath -Force -ErrorAction SilentlyContinue

  $newGameId = "matrix-newgame-$($Case.ScriptId)-$($Case.Role)-$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"
  Write-ActionJson $actionPath ([ordered]@{
    id = $newGameId
    type = "new-game"
    createdAt = [DateTime]::UtcNow.ToString("O")
    payload = [ordered]@{
      scriptId = $Case.ScriptId
      playerCount = $Players
      preferredHumanRoleId = $Case.Role
      seed = $Case.Seed
    }
  })
  $newGameResult = Wait-ResultAction $newGameId $ActionTimeoutSeconds
  if ($newGameResult.ok -ne $true) {
    throw "$($Case.ScriptId)/$($Case.Role) new-game failed: $($newGameResult.reason)"
  }

  $autoId = "matrix-auto-$($Case.ScriptId)-$($Case.Role)-$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"
  Write-ActionJson $actionPath ([ordered]@{
    id = $autoId
    type = "auto-advance"
    createdAt = [DateTime]::UtcNow.ToString("O")
    payload = [ordered]@{
      fullAuto = $true
      humanVoteYes = $true
      maxSteps = $MaxSteps
    }
  })
  $autoResult = Wait-ResultAction $autoId $AutoTimeoutSeconds
  if ($autoResult.ok -ne $true) {
    throw "$($Case.ScriptId)/$($Case.Role) auto-advance failed: $($autoResult.reason)"
  }

  $viewModel = Read-JsonFile $viewModelPath
  $state = (Read-JsonFile $statePath).state
  if ($autoResult.autoAdvance.stoppedAt -ne "ended" -or $viewModel.gameOver -ne $true -or @("good", "evil") -notcontains $viewModel.winner) {
    throw "$($Case.ScriptId)/$($Case.Role) full-auto did not reach endgame."
  }

  $humanNightActions = Count-AutoStep $autoResult.autoAdvance "human-night-action"
  if ($humanNightActions -lt 1) {
    throw "$($Case.ScriptId)/$($Case.Role) full-auto did not consume a human night action."
  }

  [PSCustomObject]@{
    ScriptId = $Case.ScriptId
    Role = $Case.Role
    Seed = $Case.Seed
    StoppedAt = $autoResult.autoAdvance.stoppedAt
    StepCount = $autoResult.autoAdvance.stepCount
    HumanNightActions = $humanNightActions
    VoteResolutions = Count-AutoStep $autoResult.autoAdvance "resolve-nomination-vote"
    DayEnds = Count-AutoStep $autoResult.autoAdvance "end-day"
    Executions = @($state.events.executions).Count
    GameOver = $viewModel.gameOver
    Winner = $viewModel.winner
    Phase = $viewModel.phase
    LastActionType = $viewModel.action.lastActionType
  }
}

if (-not (Test-Path -LiteralPath $unityExe)) {
  throw "Unity build executable not found: $unityExe"
}
if (-not (Test-Path -LiteralPath $streamingAssets)) {
  throw "Unity build StreamingAssets not found: $streamingAssets"
}

Remove-Item -LiteralPath $actionPath -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $resultPath -Force -ErrorAction SilentlyContinue

$beforeNodeIds = @(Get-Process node -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
$unityProcess = Start-Process `
  -FilePath $unityExe `
  -ArgumentList @("-screen-fullscreen", "0", "-screen-width", "$WindowWidth", "-screen-height", "$WindowHeight") `
  -WorkingDirectory (Split-Path -Parent $unityExe) `
  -PassThru

try {
  Start-Sleep -Seconds $StartupWaitSeconds
  $newNodes = @(Get-Process node -ErrorAction SilentlyContinue | Where-Object { $beforeNodeIds -notcontains $_.Id })
  if ($newNodes.Count -lt 1) {
    throw "Unity did not start a Node bridge process."
  }

  $results = foreach ($case in $cases) {
    Invoke-MatrixCase $case
  }
  $results | Format-List
}
finally {
  if ($unityProcess -and -not $unityProcess.HasExited) {
    Stop-Process -Id $unityProcess.Id -Force -ErrorAction SilentlyContinue
  }
  foreach ($node in @(Get-Process node -ErrorAction SilentlyContinue | Where-Object { $beforeNodeIds -notcontains $_.Id })) {
    Stop-Process -Id $node.Id -Force -ErrorAction SilentlyContinue
  }
}
