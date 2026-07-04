param(
  [string]$ScriptId = "tb",
  [string]$Role = "fortune-teller",
  [int]$Players = 9,
  [int]$Seed = 20260610,
  [int]$WindowWidth = 1280,
  [int]$WindowHeight = 720,
  [int]$StartupTimeoutSeconds = 15,
  [int]$ActionTimeoutSeconds = 45,
  [switch]$ContinueCurrent,
  [switch]$ExternalBridge,
  [switch]$StopAfterFirstNightAction,
  [switch]$AutoFlow,
  [switch]$ResolveVotes,
  [switch]$ResolvePlayerDecisions,
  [switch]$StopAtHumanDayAction,
  [switch]$ResolveFirstDayAction,
  [switch]$ResolveFirstHumanNomination,
  [switch]$PassAfterHumanNominationVote,
  [switch]$ResolveNextNightAfterHumanNominationPass,
  [switch]$StopAtNominationDebate,
  [switch]$ResolveFirstPlayerVote,
  [switch]$HumanVoteNo,
  [int]$StopAfterDay = 0,
  [switch]$StopAtEndgame,
  [int]$FlowTimeoutSeconds = 180,
  [int]$MaxFlowActions = 128,
  [string]$PackageDir = "",
  [string]$UnityExe = "",
  [string]$StreamingAssets = "",
  [string]$ArtifactDir = "",
  [switch]$RestoreRuntimeState
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot

function Resolve-WorkspacePath {
  param([string]$PathValue)

  if ([System.IO.Path]::IsPathRooted($PathValue)) {
    return [System.IO.Path]::GetFullPath($PathValue)
  }

  return [System.IO.Path]::GetFullPath((Join-Path $root $PathValue))
}

$packagePath = ""
if (-not [string]::IsNullOrWhiteSpace($PackageDir)) {
  $packagePath = Resolve-WorkspacePath $PackageDir
  if (-not (Test-Path -LiteralPath $packagePath -PathType Container)) {
    throw "Unity package directory not found: $packagePath"
  }

  if ([string]::IsNullOrWhiteSpace($UnityExe)) {
    $UnityExe = Join-Path $packagePath "BOTC_Unity_Prototype.exe"
  }
  if ([string]::IsNullOrWhiteSpace($StreamingAssets)) {
    $StreamingAssets = Join-Path $packagePath "BOTC_Unity_Prototype_Data\StreamingAssets"
  }
  if ([string]::IsNullOrWhiteSpace($ArtifactDir)) {
    $ArtifactDir = Join-Path $root ("output\unity-playable-demo-" + (Split-Path -Leaf $packagePath))
  }
}

if ([string]::IsNullOrWhiteSpace($UnityExe)) {
  $UnityExe = Join-Path $root "unity-build\BOTC_Unity_Prototype.exe"
}
if ([string]::IsNullOrWhiteSpace($StreamingAssets)) {
  $StreamingAssets = Join-Path $root "unity-build\BOTC_Unity_Prototype_Data\StreamingAssets"
}
if ([string]::IsNullOrWhiteSpace($ArtifactDir)) {
  $ArtifactDir = Join-Path $root "output\unity-playable-demo"
}

$unityExe = Resolve-WorkspacePath $UnityExe
$streamingAssets = Resolve-WorkspacePath $StreamingAssets
$statePath = Join-Path $streamingAssets "unity_state.json"
$actionPath = Join-Path $streamingAssets "unity_action.json"
$resultPath = Join-Path $streamingAssets "unity_action_result.json"
$viewModelPath = Join-Path $streamingAssets "unity_viewmodel.json"
$submitScript = Join-Path $root "scripts\submit_unity_night_action.mjs"
$artifactDir = Resolve-WorkspacePath $ArtifactDir
$watchOutPath = Join-Path $artifactDir "night-watcher.stdout.txt"
$watchErrPath = Join-Path $artifactDir "night-watcher.stderr.txt"
$bridgeOutPath = Join-Path $artifactDir "action-bridge.stdout.txt"
$bridgeErrPath = Join-Path $artifactDir "action-bridge.stderr.txt"
$runtimeBackupDir = Join-Path $artifactDir ("runtime-state-backup-" + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
$script:runtimeStateBackups = $null
$script:runtimeStateRestored = $false

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
  Remove-Item -LiteralPath "$actionPath.lock" -Recurse -Force -ErrorAction SilentlyContinue
}

function Backup-RuntimeFiles {
  param(
    [string[]]$Paths,
    [string]$BackupDir
  )

  New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
  $backups = @{}
  foreach ($pathValue in $Paths) {
    $backupPath = Join-Path $BackupDir ([System.IO.Path]::GetFileName($pathValue))
    if (Test-Path -LiteralPath $pathValue -PathType Leaf) {
      Copy-Item -LiteralPath $pathValue -Destination $backupPath -Force
      $backups[$pathValue] = $backupPath
    } else {
      $backups[$pathValue] = ""
    }
  }
  return $backups
}

function Restore-RuntimeFiles {
  param([hashtable]$Backups)

  foreach ($pathValue in $Backups.Keys) {
    $backupPath = $Backups[$pathValue]
    if (-not [string]::IsNullOrWhiteSpace($backupPath) -and (Test-Path -LiteralPath $backupPath -PathType Leaf)) {
      Copy-Item -LiteralPath $backupPath -Destination $pathValue -Force
    } else {
      Remove-Item -LiteralPath $pathValue -Force -ErrorAction SilentlyContinue
    }
  }
}

function Restore-RuntimeStateOnce {
  if ($RestoreRuntimeState -and -not $script:runtimeStateRestored -and $null -ne $script:runtimeStateBackups) {
    Restore-RuntimeFiles -Backups $script:runtimeStateBackups
    $script:runtimeStateRestored = $true
  }
}

function Test-CommandLineContainsPath {
  param(
    [string]$CommandLine,
    [string]$PathValue
  )

  if ([string]::IsNullOrWhiteSpace($CommandLine) -or [string]::IsNullOrWhiteSpace($PathValue)) {
    return $false
  }

  $needle = ([System.IO.Path]::GetFullPath($PathValue)).ToLowerInvariant()
  $needleForward = $needle.Replace("\", "/")
  $haystack = $CommandLine.ToLowerInvariant()
  return $haystack.Contains($needle) -or $haystack.Contains($needleForward)
}

function Stop-PackageLocalProcesses {
  if ([string]::IsNullOrWhiteSpace($packagePath)) {
    return
  }

  Get-CimInstance Win32_Process -Filter "name = 'node.exe' OR name = 'llama-server.exe' OR name = 'BOTC_Unity_Prototype.exe'" -ErrorAction SilentlyContinue |
    Where-Object { Test-CommandLineContainsPath $_.CommandLine $packagePath } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
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

  $deadline = (Get-Date).AddSeconds($StartupTimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    $nodes = @(Get-BridgeNodeProcesses -BeforeIds $BeforeIds)
    if ($nodes.Count -gt 0) {
      return $nodes
    }
    Start-Sleep -Milliseconds 250
  }

  throw "Unity did not start a Node bridge process."
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

function Wait-BridgeReady {
  param([int]$TimeoutSeconds)

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-Path -LiteralPath $resultPath) {
      try {
        $result = Read-JsonFile $resultPath
        if ($result.actionId -eq "" -and $result.ok -eq $true) {
          return $result
        }
      }
      catch {
        Start-Sleep -Milliseconds 150
      }
    }
    Start-Sleep -Milliseconds 250
  }

  throw "Timed out waiting for Unity bridge to finish its initial idle pass."
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

function Get-StorytellerQueueCount {
  param([object]$ViewModel)

  if ($ViewModel.PSObject.Properties.Name -contains "storytellerQueueDetails" -and $null -ne $ViewModel.storytellerQueueDetails) {
    return @($ViewModel.storytellerQueueDetails).Count
  }
  if ($ViewModel.PSObject.Properties.Name -contains "storytellerQueue" -and $null -ne $ViewModel.storytellerQueue) {
    return @($ViewModel.storytellerQueue).Count
  }
  return 0
}

function Test-PlayableEndgameSettled {
  param([object]$ViewModel)

  if (-not ($ViewModel.gameOver -eq $true -or $ViewModel.phase -eq "ended")) {
    return $false
  }
  if ($ViewModel.pendingStorytellerAction.available -eq $true -or (Get-StorytellerQueueCount $ViewModel) -gt 0) {
    return $false
  }
  if ($ViewModel.humanNightAction.available -eq $true -or $ViewModel.humanDayAction.available -eq $true) {
    return $false
  }
  if ($ViewModel.nominationDebate.active -eq $true) {
    return $false
  }
  return $true
}

function Safe-Array {
  param([object]$Value)

  if ($null -eq $Value) {
    return @()
  }
  return @($Value)
}

function Count-LogMessage {
  param(
    [object]$State,
    [string]$Pattern
  )

  return @(
    Safe-Array $State.logs |
      Where-Object { "$($_.message)" -match $Pattern }
  ).Count
}

function Count-NightDeathsByReason {
  param(
    [object]$State,
    [string]$Reason
  )

  return @(
    Safe-Array $State.events.nightDeaths |
      Where-Object { $_.reason -eq $Reason }
  ).Count
}

function Count-InfoPingsWhere {
  param(
    [object]$State,
    [scriptblock]$Predicate
  )

  return @(
    Safe-Array $State.events.infoPings |
      Where-Object { & $Predicate $_ }
  ).Count
}

function Start-FollowUpEndgameWatcher {
  if ($watchProcess -and -not $watchProcess.HasExited) {
    Stop-Process -Id $watchProcess.Id -Force -ErrorAction SilentlyContinue
    $watchProcess.WaitForExit(5000) | Out-Null
  }
  $followUpWatchArgs = @(
    $submitScript,
    "--streaming-assets=$streamingAssets",
    "--poll-ms=500",
    "--timeout-ms=$($ActionTimeoutSeconds * 1000)",
    "--watch-flow",
    "--resolve-votes",
    "--resolve-player-decisions",
    "--max-actions=$MaxFlowActions"
  )
  return Start-Process `
    -FilePath $node `
    -ArgumentList $followUpWatchArgs `
    -WorkingDirectory $root `
    -RedirectStandardOutput $watchOutPath `
    -RedirectStandardError $watchErrPath `
    -WindowStyle Hidden `
    -PassThru
}

function Get-WatchOutput {
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

  $stdout = Read-SharedText $watchOutPath
  $stderr = Read-SharedText $watchErrPath
  return [ordered]@{ Stdout = $stdout; Stderr = $stderr }
}

if (-not (Test-Path -LiteralPath $unityExe)) {
  throw "Unity playable executable not found: $unityExe"
}
if (-not (Test-Path -LiteralPath $streamingAssets)) {
  throw "Unity playable StreamingAssets not found: $streamingAssets"
}
if (-not (Test-Path -LiteralPath $submitScript)) {
  throw "Night action submitter not found: $submitScript"
}
$shouldStopProcessesAfterTarget = $StopAfterFirstNightAction -or
  $StopAfterDay -gt 0 -or
  $StopAtEndgame -or
  $StopAtNominationDebate -or
  $ResolveFirstPlayerVote -or
  $StopAtHumanDayAction -or
  $ResolveFirstDayAction -or
  $ResolveFirstHumanNomination
if ($RestoreRuntimeState -and -not $shouldStopProcessesAfterTarget) {
  throw "-RestoreRuntimeState requires a stop target that closes Unity after the run."
}
if ($ResolveFirstPlayerVote -and -not $AutoFlow) {
  throw "-ResolveFirstPlayerVote requires -AutoFlow so the copilot can resume after the player vote."
}
if ($ResolvePlayerDecisions -and -not $AutoFlow) {
  throw "-ResolvePlayerDecisions requires -AutoFlow so the copilot can resume between player command decisions."
}
if ($ResolveFirstDayAction -and -not $AutoFlow) {
  throw "-ResolveFirstDayAction requires -AutoFlow so the copilot can resume after the player day action."
}
if ($ResolveFirstHumanNomination -and $AutoFlow) {
  throw "-ResolveFirstHumanNomination uses the night watcher path; omit -AutoFlow so the player can nominate before AI auto-nominates."
}
if ($PassAfterHumanNominationVote -and -not $ResolveFirstHumanNomination) {
  throw "-PassAfterHumanNominationVote requires -ResolveFirstHumanNomination."
}
if ($ResolveNextNightAfterHumanNominationPass -and (-not $ResolveFirstHumanNomination -or -not $PassAfterHumanNominationVote)) {
  throw "-ResolveNextNightAfterHumanNominationPass requires -ResolveFirstHumanNomination and -PassAfterHumanNominationVote."
}
if ($ResolveFirstPlayerVote -and $ResolveVotes) {
  throw "Use either -ResolveFirstPlayerVote or -ResolveVotes; ResolveVotes skips the player decision stop."
}

$playableRunMutex = [System.Threading.Mutex]::new($false, "Global\BOTC_Unity_Playable_Demo_Smoke")
$playableRunMutexAcquired = $false
$playableRunMutexTimeoutSeconds = [Math]::Max(30, $FlowTimeoutSeconds + $StartupTimeoutSeconds + $ActionTimeoutSeconds)
$playableRunMutexAcquired = $playableRunMutex.WaitOne([TimeSpan]::FromSeconds($playableRunMutexTimeoutSeconds))
if (-not $playableRunMutexAcquired) {
  $playableRunMutex.Dispose()
  throw "Another Unity playable demo smoke is already using the selected Unity bridge files."
}

New-Item -ItemType Directory -Force -Path $artifactDir | Out-Null
foreach ($artifactPath in @($watchOutPath, $watchErrPath, $bridgeOutPath, $bridgeErrPath)) {
  if (Test-Path -LiteralPath $artifactPath) {
    Remove-Item -LiteralPath $artifactPath -Force -ErrorAction SilentlyContinue
  }
}
if ($RestoreRuntimeState) {
  $script:runtimeStateBackups = Backup-RuntimeFiles `
    -Paths @($statePath, $viewModelPath, $actionPath, $resultPath) `
    -BackupDir $runtimeBackupDir
}
if (-not $ContinueCurrent) {
  Remove-BridgeFiles
}

$beforeNodeIds = @(Get-Process node -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
$unityProcess = Start-Process `
  -FilePath $unityExe `
  -ArgumentList @("-screen-fullscreen", "0", "-screen-width", "$WindowWidth", "-screen-height", "$WindowHeight") `
  -WorkingDirectory (Split-Path -Parent $unityExe) `
  -WindowStyle Hidden `
  -PassThru
$watchProcess = $null
$externalBridgeProcess = $null
$playerVoteActionId = ""
$playerDayActionId = ""
$playerNominationActionId = ""
$playerPassNominationActionId = ""
$playerSecondNightActionId = ""
$preVoteNominationId = ""
$resumedAfterPlayerVote = $false
$resumedAfterPlayerDayAction = $false
$resolvedAfterHumanNominationVote = $false
$passedAfterHumanNominationVote = $false
$resumedAfterSecondNightAction = $false
$humanDayActionRole = ""
$humanNominationNomineeId = ""

try {
  $bridgeNodes = @(Wait-UnityBridgeProcess -BeforeIds $beforeNodeIds)
  $node = (Get-Command node -ErrorAction Stop).Source
  if ($ExternalBridge) {
    foreach ($nodeProcess in $bridgeNodes) {
      Stop-Process -Id $nodeProcess.ProcessId -Force -ErrorAction SilentlyContinue
    }
    $externalBridgeArgs = @(
      (Join-Path $root "scripts\unity_action_bridge.mjs"),
      "--watch",
      "--state=$statePath",
      "--viewmodel=$viewModelPath",
      "--action=$actionPath",
      "--result=$resultPath",
      "--script=$ScriptId",
      "--players=$Players",
      "--role=$Role",
      "--seed=$Seed",
      "--no-replay"
    )
    $externalBridgeProcess = Start-Process `
      -FilePath $node `
      -ArgumentList $externalBridgeArgs `
      -WorkingDirectory $root `
      -RedirectStandardOutput $bridgeOutPath `
      -RedirectStandardError $bridgeErrPath `
      -WindowStyle Hidden `
      -PassThru
    $bridgeNodes = @()
  }
  Wait-BridgeReady -TimeoutSeconds $StartupTimeoutSeconds | Out-Null

  if (-not $ContinueCurrent) {
    $newGameId = "playable-newgame-$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"
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
    $newGameResult = Wait-ResultAction -ActionId $newGameId -TimeoutSeconds $ActionTimeoutSeconds
    if ($newGameResult.ok -ne $true) {
      throw "new-game failed: $($newGameResult.message)"
    }
  }

  $watchArgs = @(
    $submitScript,
    "--streaming-assets=$streamingAssets",
    "--poll-ms=500",
    "--timeout-ms=$($ActionTimeoutSeconds * 1000)"
  )
  if ($AutoFlow -or $ResolveFirstHumanNomination) {
    $watchArgs += "--watch-flow"
    $watchArgs += "--max-actions=$MaxFlowActions"
    if ($ResolveVotes) {
      $watchArgs += "--resolve-votes"
    }
    if ($ResolvePlayerDecisions) {
      $watchArgs += "--resolve-player-decisions"
    }
  } else {
    $watchArgs += "--watch"
  }
  if ($StopAfterFirstNightAction -or $ResolveFirstHumanNomination) {
    $watchArgs += "--max-actions=1"
    $watchArgs += "--idle-timeout-ms=$($ActionTimeoutSeconds * 1000)"
  }
  if ($ResolveFirstHumanNomination) {
    $watchArgs += "--max-steps=1"
  }
  $watchProcess = Start-Process `
    -FilePath $node `
    -ArgumentList $watchArgs `
    -WorkingDirectory $root `
    -RedirectStandardOutput $watchOutPath `
    -RedirectStandardError $watchErrPath `
    -WindowStyle Hidden `
    -PassThru

  $viewModel = if ($ResolveFirstHumanNomination) {
    Wait-ViewModel `
      -Description "night watcher to resolve into the first day before human nomination" `
      -TimeoutSeconds $ActionTimeoutSeconds `
      -Predicate {
        param($vm)
        return $vm.phase -eq "day" -and
          $vm.humanNightAction.available -eq $false
      } | Out-Null

    $nominationArgs = @(
      $submitScript,
      "--streaming-assets=$streamingAssets",
      "--timeout-ms=$($ActionTimeoutSeconds * 1000)",
      "--nominate"
    )
    $nominationOutput = & $node @nominationArgs 2>&1
    $nominationExitCode = $LASTEXITCODE
    $nominationOutputText = ($nominationOutput | Out-String).Trim()
    if ($nominationExitCode -ne 0) {
      throw "unity submit nomination failed: $nominationOutputText"
    }
    $nominationActionMatch = [regex]::Match($nominationOutputText, "(?m)^ActionId=(\S+)")
    if (-not $nominationActionMatch.Success) {
      throw "unity submit nomination did not print an ActionId: $nominationOutputText"
    }
    $playerNominationActionId = $nominationActionMatch.Groups[1].Value

    $debateAfterNomination = Wait-ViewModel `
      -Description "human nomination to create an active debate" `
      -TimeoutSeconds $ActionTimeoutSeconds `
      -Predicate {
        param($vm)
        return $vm.phase -eq "day" -and
          $vm.dayStage -eq "nomination" -and
          $vm.nominationDebate.active -eq $true -and
          $vm.action.lastActionType -eq "human-nomination-intent"
      }
    $humanNominationNomineeId = $debateAfterNomination.nominationDebate.nomineeId

    $voteArgs = @(
      $submitScript,
      "--streaming-assets=$streamingAssets",
      "--timeout-ms=$($ActionTimeoutSeconds * 1000)",
      "--vote",
      "--vote-yes"
    )
    $voteOutput = & $node @voteArgs 2>&1
    $voteExitCode = $LASTEXITCODE
    $voteOutputText = ($voteOutput | Out-String).Trim()
    if ($voteExitCode -ne 0) {
      throw "unity submit human nomination vote failed: $voteOutputText"
    }
    $voteActionMatch = [regex]::Match($voteOutputText, "(?m)^ActionId=(\S+)")
    if (-not $voteActionMatch.Success) {
      throw "unity submit human nomination vote did not print an ActionId: $voteOutputText"
    }
    $playerVoteActionId = $voteActionMatch.Groups[1].Value

    $voteResolved = Wait-ViewModel `
      -Description "human nomination vote to resolve" `
      -TimeoutSeconds $ActionTimeoutSeconds `
      -Predicate {
        param($vm)
        return $vm.phase -eq "day" -and
          $vm.dayStage -eq "nomination" -and
          $vm.voteCeremony -ne $null -and
          $vm.voteCeremony.nomineeId -eq $humanNominationNomineeId -and
          $vm.nominationDebate.active -ne $true
    }
    $resolvedAfterHumanNominationVote = $true
    if (-not $PassAfterHumanNominationVote) {
      if ($StopAtEndgame) {
        $watchProcess = Start-FollowUpEndgameWatcher
        Wait-ViewModel `
          -Description "playable flow to reach endgame after the human nomination vote" `
          -TimeoutSeconds $FlowTimeoutSeconds `
          -Predicate {
            param($vm)
            return Test-PlayableEndgameSettled $vm
          }
      } else {
        $voteResolved
      }
    } else {
      $passArgs = @(
        $submitScript,
        "--streaming-assets=$streamingAssets",
        "--timeout-ms=$($ActionTimeoutSeconds * 1000)",
        "--pass-nomination"
      )
      $passOutput = & $node @passArgs 2>&1
      $passExitCode = $LASTEXITCODE
      $passOutputText = ($passOutput | Out-String).Trim()
      if ($passExitCode -ne 0) {
        throw "unity pass nomination failed: $passOutputText"
      }
      $passActionMatch = [regex]::Match($passOutputText, "(?m)^ActionId=(\S+)")
      if (-not $passActionMatch.Success) {
        throw "unity pass nomination did not print an ActionId: $passOutputText"
      }
      $playerPassNominationActionId = $passActionMatch.Groups[1].Value

      $passedViewModel = Wait-ViewModel `
        -Description "human nomination pass to leave the nomination day" `
        -TimeoutSeconds $ActionTimeoutSeconds `
        -Predicate {
          param($vm)
          return ($vm.gameOver -eq $true -or $vm.phase -eq "ended") -or
            ($vm.phase -eq "night") -or
            ($vm.phase -eq "day" -and $vm.day -gt $voteResolved.day -and $vm.humanNightAction.available -eq $false)
      }
      $passedAfterHumanNominationVote = $true
      if (-not $ResolveNextNightAfterHumanNominationPass) {
        if ($StopAtEndgame) {
          $watchProcess = Start-FollowUpEndgameWatcher
          Wait-ViewModel `
            -Description "playable flow to reach endgame after the human nomination pass" `
            -TimeoutSeconds $FlowTimeoutSeconds `
            -Predicate {
              param($vm)
              return Test-PlayableEndgameSettled $vm
            }
        } else {
          $passedViewModel
        }
      } elseif ($passedViewModel.gameOver -eq $true -or $passedViewModel.phase -eq "ended") {
        $resumedAfterSecondNightAction = $true
        $passedViewModel
      } elseif ($passedViewModel.phase -eq "day" -and $passedViewModel.day -gt $voteResolved.day -and $passedViewModel.humanNightAction.available -eq $false) {
        $resumedAfterSecondNightAction = $true
        if ($StopAtEndgame) {
          $watchProcess = Start-FollowUpEndgameWatcher
          Wait-ViewModel `
            -Description "playable flow to reach endgame after the human nomination pass resumes to day" `
            -TimeoutSeconds $FlowTimeoutSeconds `
            -Predicate {
              param($vm)
              return Test-PlayableEndgameSettled $vm
            }
        } else {
          $passedViewModel
        }
      } else {
        if ($passedViewModel.phase -ne "night" -or $passedViewModel.humanNightAction.available -ne $true) {
          throw "Expected a second human night action after passing nominations; phase=$($passedViewModel.phase), humanNightAction=$($passedViewModel.humanNightAction.available)"
        }

        $secondNightArgs = @(
          $submitScript,
          "--streaming-assets=$streamingAssets",
          "--timeout-ms=$($ActionTimeoutSeconds * 1000)"
        )
        $secondNightOutput = & $node @secondNightArgs 2>&1
        $secondNightExitCode = $LASTEXITCODE
        $secondNightOutputText = ($secondNightOutput | Out-String).Trim()
        if ($secondNightExitCode -ne 0) {
          throw "unity submit second night action failed: $secondNightOutputText"
        }
        $secondNightActionMatch = [regex]::Match($secondNightOutputText, "(?m)^ActionId=(\S+)")
        if (-not $secondNightActionMatch.Success) {
          throw "unity submit second night action did not print an ActionId: $secondNightOutputText"
        }
        $playerSecondNightActionId = $secondNightActionMatch.Groups[1].Value

        $secondNightResolved = Wait-ViewModel `
          -Description "second human night action to resolve into the next playable state" `
          -TimeoutSeconds $ActionTimeoutSeconds `
          -Predicate {
            param($vm)
            return ($vm.gameOver -eq $true -or $vm.phase -eq "ended") -or
              ($vm.action.lastActionId -eq $playerSecondNightActionId -and
                $vm.humanNightAction.available -eq $false -and
                (($vm.pendingStorytellerAction.available -eq $true) -or
                  ($vm.phase -eq "day" -and $vm.day -gt $voteResolved.day)))
        }
        $resumedAfterSecondNightAction = $true
        if ($StopAtEndgame) {
          $watchProcess = Start-FollowUpEndgameWatcher
          Wait-ViewModel `
            -Description "playable flow to reach endgame after the post-nomination night action" `
            -TimeoutSeconds $FlowTimeoutSeconds `
            -Predicate {
              param($vm)
              return Test-PlayableEndgameSettled $vm
            }
        } else {
          $secondNightResolved
        }
      }
    }
  } elseif ($ResolveFirstDayAction) {
    $dayActionViewModel = Wait-ViewModel `
      -Description "playable flow to stop before the first human day action" `
      -TimeoutSeconds $ActionTimeoutSeconds `
      -Predicate {
        param($vm)
        return $vm.phase -eq "day" -and
          $vm.humanDayAction.available -eq $true -and
          $vm.action.autoAdvance.stoppedAt -eq "human-day-action"
      }
    $preDayActionAutoActionId = $dayActionViewModel.action.lastActionId
    $humanDayActionRole = $dayActionViewModel.humanDayAction.roleId

    $dayArgs = @(
      $submitScript,
      "--streaming-assets=$streamingAssets",
      "--timeout-ms=$($ActionTimeoutSeconds * 1000)",
      "--day-action"
    )
    $dayOutput = & $node @dayArgs 2>&1
    $dayExitCode = $LASTEXITCODE
    $dayOutputText = ($dayOutput | Out-String).Trim()
    if ($dayExitCode -ne 0) {
      throw "unity submit day action failed: $dayOutputText"
    }
    $actionMatch = [regex]::Match($dayOutputText, "(?m)^ActionId=(\S+)")
    if (-not $actionMatch.Success) {
      throw "unity submit day action did not print an ActionId: $dayOutputText"
    }
    $playerDayActionId = $actionMatch.Groups[1].Value

    $resumed = Wait-ViewModel `
      -Description "playable flow to resume after the player day action" `
      -TimeoutSeconds $ActionTimeoutSeconds `
      -Predicate {
        param($vm)
        return ($vm.gameOver -eq $true -or $vm.phase -eq "ended") -or
          ($vm.action.lastActionType -eq "auto-advance" -and $vm.action.lastActionId -ne $preDayActionAutoActionId)
      }
    $resumedAfterPlayerDayAction = $true
    if ($StopAtEndgame) {
      Wait-ViewModel `
        -Description "playable flow to reach endgame after the player day action" `
        -TimeoutSeconds $FlowTimeoutSeconds `
        -Predicate {
          param($vm)
          return Test-PlayableEndgameSettled $vm
        }
    } else {
      $resumed
    }
  } elseif ($ResolveFirstPlayerVote) {
    $debateViewModel = Wait-ViewModel `
      -Description "playable flow to stop before the first player vote" `
      -TimeoutSeconds $ActionTimeoutSeconds `
      -Predicate {
        param($vm)
        return $vm.phase -eq "day" -and
          $vm.dayStage -eq "nomination" -and
          $vm.nominationDebate.active -eq $true -and
          $vm.action.autoAdvance.stoppedAt -eq "nomination-debate"
    }
    $preVoteAutoActionId = $debateViewModel.action.lastActionId
    $preVoteNominationId = $debateViewModel.nominationDebate.nominationId

    $voteArgs = @(
      $submitScript,
      "--streaming-assets=$streamingAssets",
      "--timeout-ms=$($ActionTimeoutSeconds * 1000)",
      "--vote"
    )
    if ($HumanVoteNo) {
      $voteArgs += "--vote-no"
    } else {
      $voteArgs += "--vote-yes"
    }
    $voteOutput = & $node @voteArgs 2>&1
    $voteExitCode = $LASTEXITCODE
    $voteOutputText = ($voteOutput | Out-String).Trim()
    if ($voteExitCode -ne 0) {
      throw "unity submit vote failed: $voteOutputText"
    }
    $actionMatch = [regex]::Match($voteOutputText, "(?m)^ActionId=(\S+)")
    if (-not $actionMatch.Success) {
      throw "unity submit vote did not print an ActionId: $voteOutputText"
    }
    $playerVoteActionId = $actionMatch.Groups[1].Value

    $resumed = if ($StopAfterDay -gt 0) {
      Wait-ViewModel `
        -Description "playable flow to resume after the player vote" `
        -TimeoutSeconds $ActionTimeoutSeconds `
        -Predicate {
          param($vm)
          return ($vm.gameOver -eq $true -or $vm.phase -eq "ended") -or
            ($vm.phase -eq "day" -and $vm.day -ge $StopAfterDay -and $vm.humanNightAction.available -eq $false)
        }
    } else {
      Wait-ViewModel `
        -Description "playable flow to resume to the next decision after the player vote" `
        -TimeoutSeconds $ActionTimeoutSeconds `
        -Predicate {
          param($vm)
          return ($vm.gameOver -eq $true -or $vm.phase -eq "ended") -or
            ($vm.action.lastActionType -eq "auto-advance" -and $vm.action.lastActionId -ne $preVoteAutoActionId)
        }
    }
    $resumedAfterPlayerVote = $true
    if ($StopAtEndgame) {
      if ($watchProcess -and -not $watchProcess.HasExited) {
        Stop-Process -Id $watchProcess.Id -Force -ErrorAction SilentlyContinue
        $watchProcess.WaitForExit(5000) | Out-Null
      }
      $followUpWatchArgs = @(
        $submitScript,
        "--streaming-assets=$streamingAssets",
        "--poll-ms=500",
        "--timeout-ms=$($ActionTimeoutSeconds * 1000)",
        "--watch-flow",
        "--resolve-votes",
        "--resolve-player-decisions",
        "--max-actions=$MaxFlowActions"
      )
      $watchProcess = Start-Process `
        -FilePath $node `
        -ArgumentList $followUpWatchArgs `
        -WorkingDirectory $root `
        -RedirectStandardOutput $watchOutPath `
        -RedirectStandardError $watchErrPath `
        -WindowStyle Hidden `
        -PassThru
      Wait-ViewModel `
        -Description "playable flow to reach endgame after the player vote" `
        -TimeoutSeconds $FlowTimeoutSeconds `
        -Predicate {
          param($vm)
          return Test-PlayableEndgameSettled $vm
        }
    } else {
      $resumed
    }
  } elseif ($StopAtEndgame) {
    Wait-ViewModel `
      -Description "playable flow to reach endgame" `
      -TimeoutSeconds $FlowTimeoutSeconds `
      -Predicate {
        param($vm)
        return Test-PlayableEndgameSettled $vm
      }
  } elseif ($StopAtNominationDebate) {
    Wait-ViewModel `
      -Description "playable flow to stop at a nomination debate decision" `
      -TimeoutSeconds $ActionTimeoutSeconds `
      -Predicate {
        param($vm)
        return $vm.phase -eq "day" -and
          $vm.dayStage -eq "nomination" -and
          $vm.nominationDebate.active -eq $true -and
          $vm.action.autoAdvance.stoppedAt -eq "nomination-debate"
      }
  } elseif ($StopAtHumanDayAction) {
    Wait-ViewModel `
      -Description "playable flow to stop at a human day action decision" `
      -TimeoutSeconds $ActionTimeoutSeconds `
      -Predicate {
        param($vm)
        return $vm.phase -eq "day" -and
          $vm.humanDayAction.available -eq $true -and
          $vm.action.autoAdvance.stoppedAt -eq "human-day-action"
      }
  } elseif ($StopAfterDay -gt 0) {
    Wait-ViewModel `
      -Description "playable flow to reach requested day" `
      -TimeoutSeconds $ActionTimeoutSeconds `
      -Predicate {
        param($vm)
        return $vm.phase -eq "day" -and
          $vm.day -ge $StopAfterDay -and
          $vm.humanNightAction.available -eq $false
      }
  } elseif ($StopAfterFirstNightAction) {
    Wait-ViewModel `
      -Description "night watcher to resolve the first human night action" `
      -TimeoutSeconds $ActionTimeoutSeconds `
      -Predicate {
        param($vm)
        return $vm.phase -eq "day" -and
          $vm.action.lastActionType -eq "night-action" -and
          $vm.humanNightAction.available -eq $false
      }
  } else {
    Wait-ViewModel `
      -Description "playable Unity viewmodel after startup" `
      -TimeoutSeconds $ActionTimeoutSeconds `
      -Predicate {
        param($vm)
        return -not [string]::IsNullOrWhiteSpace($vm.phase)
      }
  }

  $watchOutput = Get-WatchOutput
  if (-not [string]::IsNullOrWhiteSpace($watchOutput.Stderr)) {
    throw "Night-action watcher wrote stderr: $($watchOutput.Stderr)"
  }
  $storytellerActionMatches = @(
    [regex]::Matches(
      $watchOutput.Stdout,
      "Submitted Unity storyteller action\r?\nActionId=(?<id>\S+)\r?\nRole=(?<role>[^\r\n]*)",
      [System.Text.RegularExpressions.RegexOptions]::Multiline
    )
  )
  $storytellerActionIds = @($storytellerActionMatches | ForEach-Object { $_.Groups["id"].Value } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
  $storytellerActionRoles = @(
    $storytellerActionMatches |
      ForEach-Object { $_.Groups["role"].Value } |
      Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
      Select-Object -Unique
  )
  $nightActionMatches = @(
    [regex]::Matches(
      $watchOutput.Stdout,
      "Submitted Unity night action\r?\nActionId=(?<id>\S+)\r?\nRole=(?<role>[^\r\n]*)",
      [System.Text.RegularExpressions.RegexOptions]::Multiline
    )
  )
  $nightActionIds = @($nightActionMatches | ForEach-Object { $_.Groups["id"].Value } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
  $nightActionRoles = @(
    $nightActionMatches |
      ForEach-Object { $_.Groups["role"].Value } |
      Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
      Select-Object -Unique
  )
  $dayActionMatches = @(
    [regex]::Matches(
      $watchOutput.Stdout,
      "Submitted Unity day action\r?\nActionId=(?<id>\S+)\r?\nRole=(?<role>[^\r\n]*)",
      [System.Text.RegularExpressions.RegexOptions]::Multiline
    )
  )
  $dayActionIds = @($dayActionMatches | ForEach-Object { $_.Groups["id"].Value } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
  if (-not [string]::IsNullOrWhiteSpace($playerDayActionId) -and $dayActionIds -notcontains $playerDayActionId) {
    $dayActionIds = @($playerDayActionId) + $dayActionIds
  }
  $dayActionRoles = @(
    $dayActionMatches |
      ForEach-Object { $_.Groups["role"].Value } |
      Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
      Select-Object -Unique
  )
  if (-not [string]::IsNullOrWhiteSpace($humanDayActionRole) -and $dayActionRoles -notcontains $humanDayActionRole) {
    $dayActionRoles = @($humanDayActionRole) + $dayActionRoles
  }
  $finalStorytellerQueueDetails = @()
  if ($viewModel.PSObject.Properties.Name -contains "storytellerQueueDetails" -and $null -ne $viewModel.storytellerQueueDetails) {
    $finalStorytellerQueueDetails = @($viewModel.storytellerQueueDetails)
  }
  $finalStorytellerQueueCount = $finalStorytellerQueueDetails.Count
  if ($finalStorytellerQueueCount -eq 0 -and
      $viewModel.PSObject.Properties.Name -contains "storytellerQueue" -and
      $null -ne $viewModel.storytellerQueue) {
    $finalStorytellerQueueCount = @($viewModel.storytellerQueue).Count
  }
  $finalStorytellerQueueRoles = @(
    $finalStorytellerQueueDetails |
      ForEach-Object {
        if (-not [string]::IsNullOrWhiteSpace($_.roleId)) {
          $_.roleId
        } elseif (-not [string]::IsNullOrWhiteSpace($_.roleName)) {
          $_.roleName
        } elseif (-not [string]::IsNullOrWhiteSpace($_.type)) {
          $_.type
        } else {
          ""
        }
      } |
      Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
      Select-Object -Unique
  )
  $finalState = (Read-JsonFile $statePath).state
  $professorReviveCount = Count-LogMessage $finalState ("Professor " + [char]0x590d + [char]0x6d3b)
  $professorWaitCount = Count-LogMessage $finalState "Professor waits"
  $professorUsefulActionCount = $professorReviveCount + $professorWaitCount
  $shabalothReviveCount = Count-LogMessage $finalState ("Shabaloth " + [char]0x53cd + [char]0x520d)
  $shabalothKillCount = Count-NightDeathsByReason $finalState "shabaloth-kill"
  $pitHagTransformHistoryCount = @(Safe-Array ($finalState.snv.pitHagTransformHistory)).Count
  $pitHagTransformCount = if ($pitHagTransformHistoryCount -gt 0) {
    $pitHagTransformHistoryCount
  } else {
    @(Safe-Array ($finalState.snv.pitHagTransforms)).Count
  }
  $pitHagBalanceDeathCount = Count-NightDeathsByReason $finalState "pit-hag-demon-balance"
  $fangGuJumpCount = Count-NightDeathsByReason $finalState "fang-gu-jump"
  $vortoxPollutedInfoCount = Count-InfoPingsWhere $finalState { param($entry) $entry.polluted -eq $true }

  [PSCustomObject]@{
    UnityPid = $unityProcess.Id
    BridgeNodePids = ($bridgeNodes | Select-Object -ExpandProperty ProcessId) -join ","
    ExternalBridge = [bool]$ExternalBridge
    ExternalBridgePid = if ($externalBridgeProcess) { $externalBridgeProcess.Id } else { "" }
    WatcherPid = $watchProcess.Id
    PackageDir = $packagePath
    UnityExe = $unityExe
    StreamingAssets = $streamingAssets
    ArtifactDir = $artifactDir
    RestoreRuntimeState = [bool]$RestoreRuntimeState
    RuntimeBackupDir = if ($RestoreRuntimeState) { $runtimeBackupDir } else { "" }
    ScriptId = $ScriptId
    Role = $Role
    Seed = $Seed
    ContinueCurrent = [bool]$ContinueCurrent
    AutoFlow = [bool]$AutoFlow
    ResolveVotes = [bool]$ResolveVotes
    ResolvePlayerDecisions = [bool]$ResolvePlayerDecisions
    StopAtHumanDayAction = [bool]$StopAtHumanDayAction
    ResolveFirstDayAction = [bool]$ResolveFirstDayAction
    ResolveFirstHumanNomination = [bool]$ResolveFirstHumanNomination
    PassAfterHumanNominationVote = [bool]$PassAfterHumanNominationVote
    ResolveNextNightAfterHumanNominationPass = [bool]$ResolveNextNightAfterHumanNominationPass
    StopAtNominationDebate = [bool]$StopAtNominationDebate
    ResolveFirstPlayerVote = [bool]$ResolveFirstPlayerVote
    HumanVoteNo = [bool]$HumanVoteNo
    PlayerDayActionId = $playerDayActionId
    HumanDayActionRole = $humanDayActionRole
    ResumedAfterPlayerDayAction = $resumedAfterPlayerDayAction
    PlayerNominationActionId = $playerNominationActionId
    HumanNominationNomineeId = $humanNominationNomineeId
    ResolvedAfterHumanNominationVote = $resolvedAfterHumanNominationVote
    PlayerPassNominationActionId = $playerPassNominationActionId
    PassedAfterHumanNominationVote = $passedAfterHumanNominationVote
    PlayerSecondNightActionId = $playerSecondNightActionId
    ResumedAfterSecondNightAction = $resumedAfterSecondNightAction
    PlayerVoteActionId = $playerVoteActionId
    PreVoteNominationId = $preVoteNominationId
    ResumedAfterPlayerVote = $resumedAfterPlayerVote
    NightActionCount = $nightActionMatches.Count
    NightActionRoles = $nightActionRoles -join ","
    NightActionIds = $nightActionIds -join ","
    DayActionCount = $dayActionIds.Count
    DayActionRoles = $dayActionRoles -join ","
    DayActionIds = $dayActionIds -join ","
    ProfessorReviveCount = $professorReviveCount
    ProfessorWaitCount = $professorWaitCount
    ProfessorUsefulActionCount = $professorUsefulActionCount
    ShabalothReviveCount = $shabalothReviveCount
    ShabalothKillCount = $shabalothKillCount
    PitHagTransformCount = $pitHagTransformCount
    PitHagBalanceDeathCount = $pitHagBalanceDeathCount
    FangGuJumpCount = $fangGuJumpCount
    VortoxPollutedInfoCount = $vortoxPollutedInfoCount
    StorytellerActionCount = $storytellerActionMatches.Count
    StorytellerActionRoles = $storytellerActionRoles -join ","
    StorytellerActionIds = $storytellerActionIds -join ","
    FinalPendingStorytellerAvailable = [bool]$viewModel.pendingStorytellerAction.available
    FinalPendingStorytellerType = $viewModel.pendingStorytellerAction.type
    FinalStorytellerQueueCount = $finalStorytellerQueueCount
    FinalStorytellerQueueRoles = $finalStorytellerQueueRoles -join ","
    StopAtEndgame = [bool]$StopAtEndgame
    Phase = $viewModel.phase
    Day = $viewModel.day
    DayStage = $viewModel.dayStage
    GameOver = $viewModel.gameOver
    Winner = $viewModel.winner
    LlmRendererEnabled = [bool]$viewModel.llmRenderer.enabled
    LlmRendererProvider = $viewModel.llmRenderer.provider
    LlmRendererSource = $viewModel.llmRenderer.source
    LlmRendererTouched = $viewModel.llmRenderer.touched
    NominationDebateActive = $viewModel.nominationDebate.active
    AutoAdvanceStoppedAt = $viewModel.action.autoAdvance.stoppedAt
    HumanNightActionAvailable = $viewModel.humanNightAction.available
    HumanDayActionAvailable = $viewModel.humanDayAction.available
    LastActionType = $viewModel.action.lastActionType
    ViewModel = $viewModelPath
    WatcherStdout = $watchOutPath
    WatcherStderr = $watchErrPath
    BridgeStdout = $bridgeOutPath
    BridgeStderr = $bridgeErrPath
  } | Format-List
}
catch {
  if ($watchProcess -and -not $watchProcess.HasExited) {
    Stop-Process -Id $watchProcess.Id -Force -ErrorAction SilentlyContinue
  }
  if ($externalBridgeProcess -and -not $externalBridgeProcess.HasExited) {
    Stop-Process -Id $externalBridgeProcess.Id -Force -ErrorAction SilentlyContinue
  }
  if ($unityProcess -and -not $unityProcess.HasExited) {
    Stop-Process -Id $unityProcess.Id -Force -ErrorAction SilentlyContinue
  }
  foreach ($nodeProcess in @(Get-CimInstance Win32_Process -Filter "name = 'node.exe'" -ErrorAction SilentlyContinue | Where-Object { $beforeNodeIds -notcontains $_.ProcessId })) {
    Stop-Process -Id $nodeProcess.ProcessId -Force -ErrorAction SilentlyContinue
  }
  Stop-PackageLocalProcesses
  Remove-Item -LiteralPath "$actionPath.lock" -Recurse -Force -ErrorAction SilentlyContinue
  try {
    Restore-RuntimeStateOnce
  }
  catch {
    Write-Warning "Failed to restore Unity runtime state after error: $($_.Exception.Message)"
  }
  if ($playableRunMutexAcquired) {
    $playableRunMutex.ReleaseMutex()
    $playableRunMutexAcquired = $false
  }
  if ($playableRunMutex) {
    $playableRunMutex.Dispose()
  }
  throw
}

if ($StopAfterFirstNightAction -or $StopAfterDay -gt 0 -or $StopAtEndgame -or $StopAtNominationDebate -or $ResolveFirstPlayerVote -or $StopAtHumanDayAction -or $ResolveFirstDayAction -or $ResolveFirstHumanNomination) {
  if ($watchProcess -and -not $watchProcess.HasExited) {
    Stop-Process -Id $watchProcess.Id -Force -ErrorAction SilentlyContinue
  }
  if ($externalBridgeProcess -and -not $externalBridgeProcess.HasExited) {
    Stop-Process -Id $externalBridgeProcess.Id -Force -ErrorAction SilentlyContinue
  }
  if ($unityProcess -and -not $unityProcess.HasExited) {
    Stop-Process -Id $unityProcess.Id -Force -ErrorAction SilentlyContinue
  }
  foreach ($nodeProcess in @(Get-CimInstance Win32_Process -Filter "name = 'node.exe'" -ErrorAction SilentlyContinue | Where-Object { $beforeNodeIds -notcontains $_.ProcessId })) {
    Stop-Process -Id $nodeProcess.ProcessId -Force -ErrorAction SilentlyContinue
  }
  Stop-PackageLocalProcesses
  Remove-Item -LiteralPath "$actionPath.lock" -Recurse -Force -ErrorAction SilentlyContinue
}

Restore-RuntimeStateOnce

if ($playableRunMutexAcquired) {
  $playableRunMutex.ReleaseMutex()
  $playableRunMutexAcquired = $false
}
if ($playableRunMutex) {
  $playableRunMutex.Dispose()
}
