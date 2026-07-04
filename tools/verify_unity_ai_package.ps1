param(
  [string]$PackageDir = "",
  [int]$StartupTimeoutSeconds = 45,
  [int]$FlowTimeoutMs = 60000,
  [int]$PostFlowTimeoutSeconds = 70,
  [int]$WindowWidth = 1280,
  [int]$WindowHeight = 720,
  [string]$ScriptId = "tb",
  [string]$Role = "washerwoman",
  [int]$Players = 9,
  [int]$Seed = 20260608,
  [int]$MaxFlowAttempts = 3,
  [switch]$SkipFlowAdvance,
  [switch]$KeepRuntimeState
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot

function Resolve-AiPackagePath {
  param([string]$PathValue)

  if (-not [string]::IsNullOrWhiteSpace($PathValue)) {
    $resolved = Resolve-Path -LiteralPath $PathValue
    return $resolved.Path
  }

  $releaseRoot = Join-Path $repoRoot "output\release-unity-ai"
  if (-not (Test-Path -LiteralPath $releaseRoot)) {
    throw "AI release root not found: $releaseRoot"
  }

  $latest = Get-ChildItem -LiteralPath $releaseRoot -Directory |
    Where-Object { $_.Name -like "BOTC-Solo-Unity-AI-*" } |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

  if ($null -eq $latest) {
    throw "No AI Unity package found under $releaseRoot"
  }

  return $latest.FullName
}

function Assert-FileExists {
  param(
    [string]$PathValue,
    [string]$Label
  )

  if (-not (Test-Path -LiteralPath $PathValue -PathType Leaf)) {
    throw "$Label not found: $PathValue"
  }
}

function Assert-DirectoryExists {
  param(
    [string]$PathValue,
    [string]$Label
  )

  if (-not (Test-Path -LiteralPath $PathValue -PathType Container)) {
    throw "$Label not found: $PathValue"
  }
}

function Test-CommandLineContainsPath {
  param(
    [string]$CommandLine,
    [string]$PathValue
  )

  if ([string]::IsNullOrWhiteSpace($CommandLine)) { return $false }
  $needle = ([System.IO.Path]::GetFullPath($PathValue)).ToLowerInvariant()
  $needleForward = $needle.Replace("\", "/")
  $haystack = $CommandLine.ToLowerInvariant()
  return $haystack.Contains($needle) -or $haystack.Contains($needleForward)
}

function Get-PackageProcess {
  param(
    [string]$PackagePath,
    [string]$Name
  )

  return Get-CimInstance Win32_Process -Filter "name = '$Name'" |
    Where-Object { Test-CommandLineContainsPath $_.CommandLine $PackagePath } |
    Select-Object -First 1
}

function Stop-PackageProcesses {
  param([string]$PackagePath)

  Get-CimInstance Win32_Process -Filter "name = 'node.exe' OR name = 'llama-server.exe' OR name = 'BOTC_Unity_Prototype.exe'" |
    Where-Object { Test-CommandLineContainsPath $_.CommandLine $PackagePath } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
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
    }
    else {
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
    }
    else {
      Remove-Item -LiteralPath $pathValue -Force -ErrorAction SilentlyContinue
    }
  }
}

function Wait-PackageProcess {
  param(
    [string]$PackagePath,
    [string]$Name,
    [int]$TimeoutSeconds
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    $process = Get-PackageProcess $PackagePath $Name
    if ($null -ne $process) { return $process }
    Start-Sleep -Milliseconds 500
  }

  throw "Timed out waiting for package-local process $Name"
}

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

function Wait-ResultAction {
  param(
    [string]$PathValue,
    [string]$ActionId,
    [int]$TimeoutSeconds
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      if (Test-Path -LiteralPath $PathValue) {
        $result = Read-JsonFile $PathValue
        if ($result.actionId -eq $ActionId) {
          return $result
        }
      }
    }
    catch {
    }
    Start-Sleep -Milliseconds 300
  }

  throw "Timed out waiting for Unity bridge result actionId=$ActionId"
}

function Wait-ViewModel {
  param(
    [string]$PathValue,
    [int]$TimeoutSeconds,
    [switch]$RequireLlmEnabled
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  $lastError = $null
  while ((Get-Date) -lt $deadline) {
    try {
      if (Test-Path -LiteralPath $PathValue) {
        $viewModel = Read-JsonFile $PathValue
        if (-not $RequireLlmEnabled -or $viewModel.llmRenderer.enabled -eq $true) {
          return $viewModel
        }
      }
    }
    catch {
      $lastError = $_
    }
    Start-Sleep -Milliseconds 750
  }

  if ($lastError) {
    throw "Timed out waiting for readable Unity viewmodel: $($lastError.Exception.Message)"
  }
  throw "Timed out waiting for Unity viewmodel: $PathValue"
}

$packagePath = Resolve-AiPackagePath $PackageDir
$unityExe = Join-Path $packagePath "BOTC_Unity_Prototype.exe"
$streamingAssets = Join-Path $packagePath "BOTC_Unity_Prototype_Data\StreamingAssets"
$viewModelPath = Join-Path $streamingAssets "unity_viewmodel.json"
$statePath = Join-Path $streamingAssets "unity_state.json"
$actionPath = Join-Path $streamingAssets "unity_action.json"
$resultPath = Join-Path $streamingAssets "unity_action_result.json"
$localLlmPath = Join-Path $packagePath "LocalLLM"
$markerPath = Join-Path $packagePath "botc_ai_polish.enabled"
$flagPath = Join-Path $localLlmPath "enable_ai_polish.flag"
$submitScript = Join-Path $repoRoot "scripts\submit_unity_night_action.mjs"

Assert-FileExists $unityExe "Unity executable"
Assert-DirectoryExists $streamingAssets "Unity StreamingAssets"
Assert-DirectoryExists $localLlmPath "LocalLLM directory"
Assert-FileExists $submitScript "Unity flow submitter"

$directAiPolishMarkerPresent = (Test-Path -LiteralPath $markerPath -PathType Leaf) -or (Test-Path -LiteralPath $flagPath -PathType Leaf)
$llamaServer = Get-ChildItem -LiteralPath $localLlmPath -Recurse -Filter "llama-server.exe" -File |
  Select-Object -First 1
$model = Get-ChildItem -LiteralPath $localLlmPath -Recurse -Filter "*.gguf" -File |
  Select-Object -First 1
if ($null -eq $llamaServer) { throw "LocalLLM is missing llama-server.exe" }
if ($null -eq $model) { throw "LocalLLM is missing a GGUF model" }

Stop-PackageProcesses $packagePath
$runtimeBackupDir = Join-Path ([System.IO.Path]::GetTempPath()) ("botc-ai-package-verify-" + [System.Guid]::NewGuid().ToString("N"))
$runtimeBackups = Backup-RuntimeFiles @($statePath, $viewModelPath, $actionPath, $resultPath) $runtimeBackupDir
Remove-Item -LiteralPath $actionPath -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $resultPath -Force -ErrorAction SilentlyContinue

$unityProcess = $null
$submitOutput = @()
$viewModel = $null
$verifiedAttempt = 0
$verifiedSeed = $Seed

try {
  $unityArgs = @("-screen-fullscreen", "0", "-screen-width", "$WindowWidth", "-screen-height", "$WindowHeight")
  if (-not $directAiPolishMarkerPresent) {
    $unityArgs += "-botc-llm-renderer"
  }
  $unityProcess = Start-Process `
    -FilePath $unityExe `
    -ArgumentList $unityArgs `
    -WorkingDirectory $packagePath `
    -WindowStyle Hidden `
    -PassThru

  $llamaProcess = Wait-PackageProcess $packagePath "llama-server.exe" $StartupTimeoutSeconds
  $bridgeProcess = Wait-PackageProcess $packagePath "node.exe" $StartupTimeoutSeconds

  if (-not $SkipFlowAdvance) {
    $attemptErrors = @()
    $attemptLimit = [Math]::Max(1, $MaxFlowAttempts)
    for ($attempt = 1; $attempt -le $attemptLimit; $attempt++) {
      try {
        $attemptSeed = $Seed + $attempt - 1
        $newGameId = "verify-ai-newgame-$attempt-$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"
        Write-ActionJson $actionPath ([ordered]@{
          id = $newGameId
          type = "new-game"
          createdAt = [DateTime]::UtcNow.ToString("O")
          payload = [ordered]@{
            scriptId = $ScriptId
            playerCount = $Players
            preferredHumanRoleId = $Role
            seed = $attemptSeed
          }
        })
        $newGameResult = Wait-ResultAction $resultPath $newGameId ([Math]::Max(30, [Math]::Ceiling($FlowTimeoutMs / 1000)))
        if ($newGameResult.ok -ne $true) {
          throw "new-game failed: $($newGameResult.reason)"
        }

        $submitOutput = & node $submitScript --streaming-assets $streamingAssets --advance-flow --timeout-ms $FlowTimeoutMs 2>&1
        if ($LASTEXITCODE -ne 0) {
          throw "Flow advance failed: $($submitOutput -join "`n")"
        }
        if (($submitOutput -join "`n") -match "StepCount=0") {
          throw "Flow advance did not process a fresh gameplay step."
        }

        $candidateViewModel = Wait-ViewModel $viewModelPath $PostFlowTimeoutSeconds -RequireLlmEnabled
        if ($candidateViewModel.llmRenderer.provider -ne "openai-compatible" -or $candidateViewModel.llmRenderer.source -ne "openai-compatible") {
          throw "LLM renderer did not use the embedded OpenAI-compatible path."
        }
        $timeline = @($candidateViewModel.timeline)
        $llmTimelineEntries = @($timeline | Where-Object {
          $_.llmRender -and $_.llmRender.source -eq "openai-compatible"
        })
        $llmEntries = @($llmTimelineEntries | Where-Object {
          $_.llmRender -and $_.llmRender.source -eq "openai-compatible" -and $_.llmRender.fallbackUsed -ne $true
        })
        if ($llmTimelineEntries.Count -lt 1) {
          throw "No timeline entry attempted embedded LLM rendering."
        }

        $timelineText = ($timeline | ForEach-Object { $_.text }) -join "`n"
        $unsafeTimelinePattern = "Public claim|I am maintaining|I am putting|\u4F60\u662F(?:\u4E00\u540D)?\u73A9\u5BB6|\u6B63\u5728\u8BA8\u8BBA\u67D0\u53F7|\u73B0\u5728\u4F60\u9700\u8981|\u6709\u53D1\u8A00\u9700\u8981\u5417|\u53D1\u8A00\u9700\u8981\u5417|\u63D0\u540D\u6216\u4E92\u8FA9|\u8BED\u6C14\u53EF\u4EE5\u66F4\u96C6\u4E2D|\u6295\u7968\u5224\u65AD\u7A7A\u95F4|Contract nomination|ghost vote control|self-protection vote|ally protection vote"
        if ($timelineText -match $unsafeTimelinePattern) {
          throw "Unsafe prompt/template text leaked into Unity timeline."
        }

        $viewModel = $candidateViewModel
        $verifiedAttempt = $attempt
        $verifiedSeed = $attemptSeed
        break
      }
      catch {
        $attemptErrors += "attempt $attempt seed $($Seed + $attempt - 1): $($_.Exception.Message)"
        Remove-Item -LiteralPath $actionPath -Force -ErrorAction SilentlyContinue
        Remove-Item -LiteralPath $resultPath -Force -ErrorAction SilentlyContinue
      }
    }

    if ($null -eq $viewModel) {
      throw "Embedded LLM verification failed after $attemptLimit attempt(s):`n- $($attemptErrors -join "`n- ")"
    }
  }
  else {
    $viewModel = Wait-ViewModel $viewModelPath $PostFlowTimeoutSeconds
  }

  [PSCustomObject]@{
    ok = $true
    package = $packagePath
    unityPid = $unityProcess.Id
    bridgePid = $bridgeProcess.ProcessId
    llamaPid = $llamaProcess.ProcessId
    model = $model.Name
    scriptId = $ScriptId
    role = $Role
    seed = $verifiedSeed
    verificationAttempt = $verifiedAttempt
    runtimeStateRestored = (-not $KeepRuntimeState)
    directAiPolishMarkerPresent = $directAiPolishMarkerPresent
    llm = $viewModel.llmRenderer
    llmSuccessfulTimelineEntries = @($viewModel.timeline | Where-Object {
      $_.llmRender -and $_.llmRender.source -eq "openai-compatible" -and $_.llmRender.fallbackUsed -ne $true
    }).Count
    llmFallbackTimelineEntries = @($viewModel.timeline | Where-Object {
      $_.llmRender -and $_.llmRender.source -eq "openai-compatible" -and $_.llmRender.fallbackUsed -eq $true
    }).Count
    dialogueTitle = $viewModel.dialogueTitle
    submitOutput = ($submitOutput -join "`n")
    timelineTail = @($viewModel.timeline | Select-Object -Last 5 | ForEach-Object {
      [PSCustomObject]@{
        mode = $_.mode
        speakerId = $_.speakerId
        text = $_.text
        llmSource = $_.llmRender.source
        llmFallback = $_.llmRender.fallbackUsed
      }
    })
  } | ConvertTo-Json -Depth 10
}
finally {
  if ($unityProcess -and -not $unityProcess.HasExited) {
    Stop-Process -Id $unityProcess.Id -Force -ErrorAction SilentlyContinue
  }
  Stop-PackageProcesses $packagePath
  if (-not $KeepRuntimeState) {
    Restore-RuntimeFiles $runtimeBackups
  }
  Remove-Item -LiteralPath $runtimeBackupDir -Recurse -Force -ErrorAction SilentlyContinue
}
