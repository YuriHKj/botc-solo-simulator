param(
  [string]$ScriptId = "tb",
  [string]$Role = "fortune-teller",
  [int]$Players = 9,
  [int]$Seed = 20260610,
  [int]$WindowWidth = 1280,
  [int]$WindowHeight = 720,
  [int]$StartupWaitSeconds = 10,
  [int]$ActionTimeoutSeconds = 60
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
$artifactDir = Join-Path $root "output\unity-build-watch-night-actions"
$watchOutPath = Join-Path $artifactDir "watch.stdout.txt"
$watchErrPath = Join-Path $artifactDir "watch.stderr.txt"

function Read-JsonFile {
  param([string]$PathValue)

  return [System.IO.File]::ReadAllText($PathValue) | ConvertFrom-Json
}

function Write-ActionJson {
  param(
    [string]$PathValue,
    [object]$Action
  )

  $json = $Action | ConvertTo-Json -Depth 24
  [System.IO.File]::WriteAllText($PathValue, $json, [System.Text.UTF8Encoding]::new($false))
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

function Get-WatchOutput {
  $stdout = if (Test-Path -LiteralPath $watchOutPath) { [System.IO.File]::ReadAllText($watchOutPath) } else { "" }
  $stderr = if (Test-Path -LiteralPath $watchErrPath) { [System.IO.File]::ReadAllText($watchErrPath) } else { "" }
  return [ordered]@{ Stdout = $stdout; Stderr = $stderr }
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

New-Item -ItemType Directory -Force -Path $artifactDir | Out-Null
Remove-Item -LiteralPath $watchOutPath -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $watchErrPath -Force -ErrorAction SilentlyContinue

Prepare-BridgeFreshState

$beforeNodeIds = @(Get-Process node -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
$unityProcess = Start-Process `
  -FilePath $unityExe `
  -ArgumentList @("-screen-fullscreen", "0", "-screen-width", "$WindowWidth", "-screen-height", "$WindowHeight") `
  -WorkingDirectory (Split-Path -Parent $unityExe) `
  -PassThru
$watchProcess = $null

try {
  $newNodes = @(Wait-UnityBridgeProcess -BeforeIds $beforeNodeIds)

  $node = (Get-Command node -ErrorAction Stop).Source
  $watchArgs = @(
    $submitScript,
    "--streaming-assets=$streamingAssets",
    "--watch",
    "--max-actions=2",
    "--idle-timeout-ms=$($ActionTimeoutSeconds * 1000)",
    "--timeout-ms=$($ActionTimeoutSeconds * 1000)",
    "--poll-ms=250"
  )
  $watchProcess = Start-Process `
    -FilePath $node `
    -ArgumentList $watchArgs `
    -WorkingDirectory $root `
    -RedirectStandardOutput $watchOutPath `
    -RedirectStandardError $watchErrPath `
    -WindowStyle Hidden `
    -PassThru

  $firstNight = Wait-ViewModel `
    -Description "first watched night action to resolve into day" `
    -TimeoutSeconds $ActionTimeoutSeconds `
    -Predicate {
      param($vm)
      return $vm.phase -eq "day" -and
        $vm.day -ge 1 -and
        $vm.action.lastActionType -eq "night-action" -and
        $vm.humanNightAction.available -eq $false
    }

  $autoId = "watch-night-auto-$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"
  Write-ActionJson $actionPath ([ordered]@{
    id = $autoId
    type = "auto-advance"
    createdAt = [DateTime]::UtcNow.ToString("O")
    payload = [ordered]@{
      mode = "playable"
      resolveDebates = $true
      resolveStoryteller = $true
      humanVoteYes = $true
      maxSteps = 96
    }
  })

  $deadline = (Get-Date).AddSeconds($ActionTimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    $watchProcess.Refresh()
    if ($watchProcess.HasExited) {
      break
    }
    Start-Sleep -Milliseconds 300
  }
  $watchProcess.Refresh()
  if (-not $watchProcess.HasExited) {
    $output = Get-WatchOutput
    throw "Night-action watcher did not finish two actions. stdout=$($output.Stdout) stderr=$($output.Stderr)"
  }
  $watchProcess.WaitForExit()
  $watchOutput = Get-WatchOutput
  if (($null -ne $watchProcess.ExitCode) -and $watchProcess.ExitCode -ne 0) {
    throw "Night-action watcher failed with ExitCode=$($watchProcess.ExitCode). stdout=$($watchOutput.Stdout) stderr=$($watchOutput.Stderr)"
  }
  if (-not [string]::IsNullOrWhiteSpace($watchOutput.Stderr)) {
    throw "Night-action watcher wrote stderr: $($watchOutput.Stderr)"
  }

  $finalViewModel = Read-JsonFile $viewModelPath
  if ($finalViewModel.phase -ne "day" -or $finalViewModel.day -lt 2 -or $finalViewModel.humanNightAction.available -ne $false) {
    throw "Watcher did not carry the game across the second human night action. phase=$($finalViewModel.phase), day=$($finalViewModel.day), available=$($finalViewModel.humanNightAction.available)"
  }
  if ($finalViewModel.action.lastActionType -ne "night-action") {
    throw "Watcher final viewmodel was not produced by a night-action."
  }

  $submissionCount = ([regex]::Matches($watchOutput.Stdout, "Submitted Unity night action")).Count
  if ($submissionCount -ne 2) {
    throw "Expected watcher to submit exactly two night actions, got $submissionCount. stdout=$($watchOutput.Stdout)"
  }

  [PSCustomObject]@{
    UnityPid = $unityProcess.Id
    NodePids = ($newNodes | Select-Object -ExpandProperty ProcessId) -join ","
    WatcherPid = $watchProcess.Id
    ScriptId = $ScriptId
    Role = $Role
    Seed = $Seed
    FirstNightDay = $firstNight.day
    FinalDay = $finalViewModel.day
    FinalPhase = $finalViewModel.phase
    HumanNightActionAvailable = $finalViewModel.humanNightAction.available
    LastActionType = $finalViewModel.action.lastActionType
    SubmittedNightActions = $submissionCount
  } | Format-List
}
finally {
  if ($watchProcess -and -not $watchProcess.HasExited) {
    Stop-Process -Id $watchProcess.Id -Force -ErrorAction SilentlyContinue
  }
  if ($unityProcess -and -not $unityProcess.HasExited) {
    Stop-Process -Id $unityProcess.Id -Force -ErrorAction SilentlyContinue
  }
  foreach ($node in @(Get-CimInstance Win32_Process -Filter "name = 'node.exe'" -ErrorAction SilentlyContinue | Where-Object { $beforeNodeIds -notcontains $_.ProcessId })) {
    Stop-Process -Id $node.ProcessId -Force -ErrorAction SilentlyContinue
  }
}
