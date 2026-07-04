param(
  [string]$ScriptId = "bmr",
  [string]$Role = "zombuul",
  [int]$Players = 9,
  [int]$Seed = 20260609,
  [int]$MaxSteps = 512,
  [int]$WindowWidth = 1280,
  [int]$WindowHeight = 720,
  [int]$StartupWaitSeconds = 4,
  [int]$ActionTimeoutSeconds = 40,
  [int]$AutoTimeoutSeconds = 120
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$unityExe = Join-Path $root "unity-build\BOTC_Unity_Prototype.exe"
$streamingAssets = Join-Path $root "unity-build\BOTC_Unity_Prototype_Data\StreamingAssets"
$actionPath = Join-Path $streamingAssets "unity_action.json"
$resultPath = Join-Path $streamingAssets "unity_action_result.json"
$viewModelPath = Join-Path $streamingAssets "unity_viewmodel.json"

function Write-ActionJson {
  param(
    [string]$PathValue,
    [object]$Action
  )

  $json = $Action | ConvertTo-Json -Depth 16
  [System.IO.File]::WriteAllText($PathValue, $json, [System.Text.UTF8Encoding]::new($false))
}

function Read-JsonFile {
  param([string]$PathValue)

  return [System.IO.File]::ReadAllText($PathValue) | ConvertFrom-Json
}

function Wait-ResultAction {
  param(
    [string]$PathValue,
    [string]$ActionId,
    [int]$TimeoutSeconds
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-Path -LiteralPath $PathValue) {
      try {
        $result = Read-JsonFile $PathValue
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

  $newGameId = "selfstart-newgame-$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"
  Write-ActionJson $actionPath ([ordered]@{
    id = $newGameId
    type = "new-game"
    createdAt = [DateTime]::UtcNow.ToString("O")
    payload = [ordered]@{
      scriptId = $ScriptId
      playerCount = $Players
      preferredHumanRoleId = $Role
      seed = $Seed
    }
  })
  $newGameResult = Wait-ResultAction $resultPath $newGameId $ActionTimeoutSeconds
  if ($newGameResult.ok -ne $true) {
    throw "new-game failed: $($newGameResult.reason)"
  }

  $autoId = "selfstart-auto-$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"
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
  $autoResult = Wait-ResultAction $resultPath $autoId $AutoTimeoutSeconds
  if ($autoResult.ok -ne $true) {
    throw "auto-advance failed: $($autoResult.reason)"
  }
  $viewModel = Read-JsonFile $viewModelPath
  if ($autoResult.autoAdvance.stoppedAt -ne "ended" -or $viewModel.gameOver -ne $true -or @("good", "evil") -notcontains $viewModel.winner) {
    throw "Unity build self-start smoke did not reach endgame."
  }

  [PSCustomObject]@{
    UnityPid = $unityProcess.Id
    NodePids = ($newNodes | Select-Object -ExpandProperty Id) -join ","
    ScriptId = $ScriptId
    Role = $Role
    Seed = $Seed
    StoppedAt = $autoResult.autoAdvance.stoppedAt
    StepCount = $autoResult.autoAdvance.stepCount
    GameOver = $viewModel.gameOver
    Winner = $viewModel.winner
    Phase = $viewModel.phase
    LastActionType = $viewModel.action.lastActionType
    LastActionId = $viewModel.action.lastActionId
  } | Format-List
}
finally {
  if ($unityProcess -and -not $unityProcess.HasExited) {
    Stop-Process -Id $unityProcess.Id -Force -ErrorAction SilentlyContinue
  }
  foreach ($node in @(Get-Process node -ErrorAction SilentlyContinue | Where-Object { $beforeNodeIds -notcontains $_.Id })) {
    Stop-Process -Id $node.Id -Force -ErrorAction SilentlyContinue
  }
}
