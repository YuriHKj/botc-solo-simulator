param(
  [int]$Seed = 20260613,
  [int]$StartupTimeoutSeconds = 10,
  [int]$ActionTimeoutSeconds = 45,
  [string[]]$StateNames = @()
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$singleSmoke = Join-Path $PSScriptRoot "unity_build_submit_storyteller_action_smoke.ps1"
$streamingAssets = Join-Path $root "unity-build\BOTC_Unity_Prototype_Data\StreamingAssets"
$viewModelPath = Join-Path $streamingAssets "unity_viewmodel.json"

$allCases = @(
  [ordered]@{ StateName = "real-sage-storyteller-queue"; ExpectedType = "sage-info"; MustContinue = $false },
  [ordered]@{ StateName = "real-barber-storyteller-queue"; ExpectedType = "barber-swap"; MustContinue = $false },
  [ordered]@{ StateName = "real-moonchild-storyteller-queue"; ExpectedType = "moonchild-choice"; MustContinue = $false },
  [ordered]@{ StateName = "real-pit-hag-storyteller-queue"; ExpectedType = "pit-hag-demon-balance"; MustContinue = $false },
  [ordered]@{ StateName = "real-klutz-storyteller-queue"; ExpectedType = "klutz-choice"; MustContinue = $true }
)

function Read-JsonFile {
  param([string]$PathValue)

  return [System.IO.File]::ReadAllText($PathValue) | ConvertFrom-Json
}

function Get-OutputField {
  param(
    [string]$Text,
    [string]$Name
  )

  $field = [regex]::Escape($Name)
  $match = [regex]::Match($Text, "(?m)^[^\S\r\n]*$field[^\S\r\n]*:[^\S\r\n]*(.*?)[^\S\r\n]*$")
  if ($match.Success) {
    return $match.Groups[1].Value.Trim()
  }
  return ""
}

if (-not (Test-Path -LiteralPath $singleSmoke)) {
  throw "Single Storyteller smoke not found: $singleSmoke"
}
if (-not (Test-Path -LiteralPath $streamingAssets)) {
  throw "Unity build StreamingAssets not found: $streamingAssets"
}

$selectedCases = if ($StateNames.Count -gt 0) {
  foreach ($name in $StateNames) {
    $case = $allCases | Where-Object { $_.StateName -eq $name } | Select-Object -First 1
    if (-not $case) {
      throw "Unknown Storyteller gate state: $name"
    }
    $case
  }
} else {
  $allCases
}

$results = New-Object System.Collections.Generic.List[object]
$caseIndex = 0

foreach ($case in $selectedCases) {
  $caseIndex += 1
  $caseSeed = $Seed + $caseIndex - 1
  $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $singleSmoke `
    -StateName $case.StateName `
    -Seed $caseSeed `
    -StartupTimeoutSeconds $StartupTimeoutSeconds `
    -ActionTimeoutSeconds $ActionTimeoutSeconds 2>&1
  $exitCode = $LASTEXITCODE
  $outputText = ($output | Out-String).Trim()
  if ($exitCode -ne 0) {
    throw "$($case.StateName) Storyteller smoke failed: $outputText"
  }

  $storytellerType = Get-OutputField $outputText "StorytellerType"
  if ($storytellerType -ne $case.ExpectedType) {
    throw "$($case.StateName) exposed $storytellerType, expected $($case.ExpectedType)."
  }

  $viewModel = Read-JsonFile $viewModelPath
  if ($viewModel.action.lastActionType -ne "storyteller-action") {
    throw "$($case.StateName) did not finish on a storyteller-action."
  }
  if ($viewModel.pendingStorytellerAction.available -eq $true) {
    throw "$($case.StateName) still has a pending Storyteller action after submit."
  }
  if ($case.MustContinue -and ($viewModel.gameOver -eq $true -or $viewModel.phase -eq "ended")) {
    throw "$($case.StateName) should keep the playable path alive after the guided default submit."
  }

  $results.Add([PSCustomObject]@{
    StateName = $case.StateName
    StorytellerType = $storytellerType
    Seed = $caseSeed
    QueueBefore = Get-OutputField $outputText "QueueBefore"
    QueueAfter = Get-OutputField $outputText "QueueAfter"
    Phase = $viewModel.phase
    Day = $viewModel.day
    Night = $viewModel.night
    GameOver = [bool]$viewModel.gameOver
    Winner = $viewModel.winner
    PendingStorytellerActionAvailable = [bool]$viewModel.pendingStorytellerAction.available
    LastActionType = $viewModel.action.lastActionType
  }) | Out-Null
}

$results | Format-List
