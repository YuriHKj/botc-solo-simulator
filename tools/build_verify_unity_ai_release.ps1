param(
  [string]$UnityEditor = "",
  [string]$ProjectPath = "unity-prototype",
  [string]$BuildDir = "unity-build",
  [string]$BuildMethod = "BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows",
  [string]$BuildLog = "",
  [string]$OutputRoot = "output\release-unity-ai",
  [string]$PackageName = "",
  [string]$LocalLlmSource = "third_party\LocalLLM",
  [switch]$PrepareLocalLlm,
  [ValidateSet("tiny", "balanced", "quality", "premium", "premium-max", "custom")]
  [string]$ModelTier = "tiny",
  [string]$ModelRepo = "",
  [string]$ModelFile = "",
  [string[]]$UiSmokeStates = @(
    "main-menu",
    "settings",
    "main-board",
    "phase-assist-public",
    "private-chat",
    "private-chat-long",
    "stage-dialogue",
    "stage-dialogue-queued"
  ),
  [int]$WindowWidth = 1600,
  [int]$WindowHeight = 900,
  [switch]$SkipUiSmoke,
  [switch]$NoZip
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

function Resolve-RepoPath {
  param([string]$PathValue)

  if ([string]::IsNullOrWhiteSpace($PathValue)) { return "" }
  if ([System.IO.Path]::IsPathRooted($PathValue)) { return $PathValue }
  return (Join-Path $repoRoot $PathValue)
}

function Resolve-UnityEditorRoot {
  param([string]$Editor)

  if (-not [string]::IsNullOrWhiteSpace($Editor)) {
    $resolved = (Resolve-Path -LiteralPath $Editor).Path
    if ((Split-Path -Leaf $resolved) -ieq "Unity.exe") {
      return Split-Path -Parent $resolved
    }
    return $resolved
  }

  $projectVersionPath = Join-Path (Resolve-RepoPath $ProjectPath) "ProjectSettings\ProjectVersion.txt"
  if (-not (Test-Path -LiteralPath $projectVersionPath)) {
    throw "Unity project version file not found: $projectVersionPath"
  }

  $versionLine = Get-Content -LiteralPath $projectVersionPath |
    Where-Object { $_ -match "^m_EditorVersion:\s*(.+)$" } |
    Select-Object -First 1
  if ([string]::IsNullOrWhiteSpace($versionLine)) {
    throw "Could not read m_EditorVersion from $projectVersionPath"
  }

  $version = ($versionLine -replace "^m_EditorVersion:\s*", "").Trim()
  $candidate = Join-Path "C:\Program Files\Unity\Hub\Editor\$version" "Editor"
  if (Test-Path -LiteralPath (Join-Path $candidate "Unity.exe")) {
    return $candidate
  }

  throw "Unity editor $version not found under C:\Program Files\Unity\Hub\Editor. Pass -UnityEditor."
}

function Assert-UnityBuildSucceeded {
  param(
    [string]$LogPath,
    [string]$ExePath
  )

  if (-not (Test-Path -LiteralPath $LogPath -PathType Leaf)) {
    throw "Unity build log not found: $LogPath"
  }

  $logText = Read-TextFileWithRetry $LogPath 10
  $buildSucceeded = $logText -match "Unity prototype build succeeded" -or $logText -match "Build succeeded"
  $licensePattern = "No valid Unity Editor license|No ULF license|Token not found|LicenseGroupOfflineValidityPeriodIsExpired|com\.unity\.editor\.headless was not found"
  if (-not $buildSucceeded) {
    if ($logText -match $licensePattern) {
      throw "Unity Editor build is blocked by licensing. Activate Unity Hub/Editor, then rerun this script. Log: $LogPath"
    }
    throw "Unity build did not report success. Log: $LogPath"
  }

  if (-not (Test-Path -LiteralPath $ExePath -PathType Leaf)) {
    throw "Unity build reported success but executable is missing: $ExePath"
  }
}

function Read-TextFileWithRetry {
  param(
    [string]$PathValue,
    [int]$TimeoutSeconds = 10
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  $lastError = $null
  while ((Get-Date) -lt $deadline) {
    try {
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
    catch {
      $lastError = $_
      Start-Sleep -Milliseconds 250
    }
  }

  if ($lastError) {
    throw "Could not read file after waiting: $PathValue. $($lastError.Exception.Message)"
  }
  throw "Could not read file after waiting: $PathValue"
}

function Wait-File {
  param(
    [string]$PathValue,
    [int]$TimeoutSeconds = 10
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-Path -LiteralPath $PathValue -PathType Leaf) {
      return $true
    }
    Start-Sleep -Milliseconds 250
  }
  return $false
}

$projectRoot = Resolve-RepoPath $ProjectPath
$buildPath = Resolve-RepoPath $BuildDir
$buildExePath = Join-Path $buildPath "BOTC_Unity_Prototype.exe"
$editorRoot = Resolve-UnityEditorRoot $UnityEditor
$unityExe = Join-Path $editorRoot "Unity.exe"
if (-not (Test-Path -LiteralPath $unityExe -PathType Leaf)) {
  throw "Unity executable not found: $unityExe"
}

if ([string]::IsNullOrWhiteSpace($BuildLog)) {
  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $BuildLog = "output\unity-build-latest-$stamp.log"
}
$buildLogPath = Resolve-RepoPath $BuildLog
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $buildLogPath) | Out-Null

$unityBuildArgs = @(
  "-batchmode",
  "-quit",
  "-projectPath",
  $projectRoot,
  "-executeMethod",
  $BuildMethod,
  "-logFile",
  $buildLogPath
)
$unityBuildMethodAudit = "-executeMethod $BuildMethod"
$unityProcess = Start-Process `
  -FilePath $unityExe `
  -ArgumentList $unityBuildArgs `
  -WorkingDirectory $repoRoot `
  -WindowStyle Hidden `
  -Wait `
  -PassThru
if ($unityProcess.ExitCode -ne 0) {
  Write-Warning "Unity Editor exited with code $($unityProcess.ExitCode); checking build log before failing."
}

Wait-File $buildLogPath 10 | Out-Null
Assert-UnityBuildSucceeded $buildLogPath $buildExePath

if ([string]::IsNullOrWhiteSpace($PackageName)) {
  $PackageName = "BOTC-Solo-Unity-AI-" + (Get-Date -Format "yyyyMMdd-HHmmss") + "-verified"
}

$packageScript = Join-Path $repoRoot "tools\package_unity_ai_release.ps1"
if (-not (Test-Path -LiteralPath $packageScript -PathType Leaf)) {
  throw "Unity AI package script not found: $packageScript"
}

$packageArgs = @{
  BuildDir = $BuildDir
  OutputRoot = $OutputRoot
  PackageName = $PackageName
  RequireLocalLlm = $true
  VerifyPackage = $true
}
if (-not [string]::IsNullOrWhiteSpace($LocalLlmSource)) {
  $packageArgs.LocalLlmSource = $LocalLlmSource
}
if ($PrepareLocalLlm) {
  $packageArgs.PrepareLocalLlm = $true
  $packageArgs.ModelTier = $ModelTier
  if (-not [string]::IsNullOrWhiteSpace($ModelRepo)) { $packageArgs.ModelRepo = $ModelRepo }
  if (-not [string]::IsNullOrWhiteSpace($ModelFile)) { $packageArgs.ModelFile = $ModelFile }
}
if ($NoZip) {
  $packageArgs.NoZip = $true
}

& $packageScript @packageArgs

$packagePath = Join-Path (Resolve-RepoPath $OutputRoot) $PackageName
if (-not (Test-Path -LiteralPath $packagePath -PathType Container)) {
  throw "Verified AI package was not created: $packagePath"
}
$packageUnityExe = Join-Path $packagePath "BOTC_Unity_Prototype.exe"
$packageStreamingAssets = Join-Path $packagePath "BOTC_Unity_Prototype_Data\StreamingAssets"

$uiSmokeManifest = ""
$uiSmokeReport = ""
if (-not $SkipUiSmoke) {
  $smokeStamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $uiSmokeDir = Join-Path $repoRoot "output\unity-ui-smoke-release-$smokeStamp"
  $captureScript = Join-Path $repoRoot "tools\capture_unity_ui_smoke.ps1"
  $verifyScript = Join-Path $repoRoot "tools\verify_unity_ui_smoke.ps1"
  if (-not (Test-Path -LiteralPath $captureScript -PathType Leaf)) {
    throw "Unity UI smoke capture script not found: $captureScript"
  }
  if (-not (Test-Path -LiteralPath $verifyScript -PathType Leaf)) {
    throw "Unity UI smoke verifier not found: $verifyScript"
  }

  & $captureScript `
    -States $UiSmokeStates `
    -WindowWidth $WindowWidth `
    -WindowHeight $WindowHeight `
    -UnityExe $packageUnityExe `
    -StreamingAssets $packageStreamingAssets `
    -RestoreRuntimeState `
    -OutputDir $uiSmokeDir
  $uiSmokeManifest = Join-Path $uiSmokeDir "manifest.json"
  $uiSmokeReport = Join-Path $uiSmokeDir "visual-regression-report.json"
  & $verifyScript `
    -Manifest $uiSmokeManifest `
    -RequiredStates $UiSmokeStates `
    -RequiredViewports "$($WindowWidth)x$($WindowHeight)" `
    -ReportPath $uiSmokeReport
}

[PSCustomObject]@{
  ok = $true
  buildLog = $buildLogPath
  buildExe = $buildExePath
  package = $packagePath
  uiSmokeManifest = $uiSmokeManifest
  uiSmokeReport = $uiSmokeReport
} | ConvertTo-Json -Depth 4
