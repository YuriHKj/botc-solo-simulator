param(
  [string]$BuildDir = "unity-build",
  [string]$OutputRoot = "output\release-unity-ai",
  [string]$PackageName = "",
  [string]$LocalLlmSource = "",
  [switch]$PrepareLocalLlm,
  [ValidateSet("tiny", "balanced", "quality", "premium", "premium-max", "custom")]
  [string]$ModelTier = "balanced",
  [string]$ModelRepo = "",
  [string]$ModelFile = "",
  [string]$LlamaReleaseTag = "latest",
  [switch]$RequireLocalLlm,
  [switch]$NoDirectExeAiPolish,
  [switch]$AutoEnableTinyLocalLlm,
  [switch]$SkipBuildCoreSync,
  [switch]$SkipManagedAssemblyCompile,
  [switch]$VerifyPackage,
  [switch]$NoZip,
  [switch]$SkipTests
)

$ErrorActionPreference = "Stop"

function Resolve-RepoPath([string]$PathValue) {
  if ([string]::IsNullOrWhiteSpace($PathValue)) { return "" }
  if ([System.IO.Path]::IsPathRooted($PathValue)) { return $PathValue }
  return (Join-Path $repoRoot $PathValue)
}

function Find-LocalLlmSource() {
  $candidates = @()
  if (-not [string]::IsNullOrWhiteSpace($LocalLlmSource)) {
    $candidates += (Resolve-RepoPath $LocalLlmSource)
  }
  $candidates += @(
    (Join-Path $repoRoot "LocalLLM"),
    (Join-Path $repoRoot "third_party\LocalLLM"),
    (Join-Path $repoRoot "$BuildDir\LocalLLM")
  )
  foreach ($candidate in $candidates) {
    if (-not [string]::IsNullOrWhiteSpace($candidate) -and (Test-Path $candidate)) {
      return (Resolve-Path $candidate).Path
    }
  }
  return ""
}

function Test-LocalLlmPackage([string]$PathValue, [switch]$Strict) {
  if ([string]::IsNullOrWhiteSpace($PathValue) -or -not (Test-Path $PathValue)) {
    if ($Strict) { throw "LocalLLM package was required but not found." }
    return $false
  }
  $server = Get-ChildItem -LiteralPath $PathValue -Recurse -Filter "llama-server.exe" -File -ErrorAction SilentlyContinue | Select-Object -First 1
  $model = Get-ChildItem -LiteralPath $PathValue -Recurse -Filter "*.gguf" -File -ErrorAction SilentlyContinue | Select-Object -First 1
  $licenses = Join-Path $PathValue "licenses"
  if ($null -eq $server) {
    if ($Strict) { throw "LocalLLM is missing llama-server.exe." }
    Write-Warning "LocalLLM found but llama-server.exe is missing. AI polish will fall back."
    return $false
  }
  if ($null -eq $model) {
    if ($Strict) { throw "LocalLLM is missing a GGUF model under models/." }
    Write-Warning "LocalLLM found but no GGUF model was found. AI polish will fall back."
    return $false
  }
  if (-not (Test-Path $licenses)) {
    Write-Warning "LocalLLM has no licenses/ folder. Add llama.cpp MIT and model license notices before public release."
  }
  return $true
}

function Write-Utf8File([string]$PathValue, [string]$Content) {
  $parent = Split-Path -Parent $PathValue
  if (-not [string]::IsNullOrWhiteSpace($parent)) {
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
  }
  [System.IO.File]::WriteAllText($PathValue, $Content, [System.Text.UTF8Encoding]::new($false))
}

function Write-AsciiFile([string]$PathValue, [string]$Content) {
  $parent = Split-Path -Parent $PathValue
  if (-not [string]::IsNullOrWhiteSpace($parent)) {
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
  }
  Set-Content -LiteralPath $PathValue -Encoding ASCII -Value $Content
}

function Get-PathSizeBytes([string]$PathValue) {
  if ([string]::IsNullOrWhiteSpace($PathValue) -or -not (Test-Path -LiteralPath $PathValue)) { return 0L }
  $item = Get-Item -LiteralPath $PathValue -Force
  if (-not $item.PSIsContainer) { return [int64]$item.Length }
  $sum = (Get-ChildItem -LiteralPath $PathValue -Recurse -File -Force -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum
  if ($null -eq $sum) { return 0L }
  return [int64]$sum
}

function Format-SizeMB([int64]$Bytes) {
  return [Math]::Round($Bytes / 1MB, 2)
}

function Get-ReleasePackageEntries([string]$RootPath) {
  if ([string]::IsNullOrWhiteSpace($RootPath) -or -not (Test-Path -LiteralPath $RootPath)) { return @() }
  $directories = Get-ChildItem -LiteralPath $RootPath -Directory -Force -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like "BOTC-Solo-Unity-AI*" }
  $entries = @()
  foreach ($directory in $directories) {
    $zipPath = Join-Path $RootPath ($directory.Name + ".zip")
    $zipItem = if (Test-Path -LiteralPath $zipPath -PathType Leaf) { Get-Item -LiteralPath $zipPath -Force } else { $null }
    $directorySize = Get-PathSizeBytes $directory.FullName
    $zipSize = if ($null -ne $zipItem) { [int64]$zipItem.Length } else { 0L }
    $lastWriteUtc = $directory.LastWriteTimeUtc
    if ($null -ne $zipItem -and $zipItem.LastWriteTimeUtc -gt $lastWriteUtc) {
      $lastWriteUtc = $zipItem.LastWriteTimeUtc
    }
    $kind = if ($directory.Name -match "(?i)verified") { "verified" } else { "playable" }
    $entries += [pscustomobject]@{
      name = $directory.Name
      kind = $kind
      packagePath = $directory.FullName
      zipPath = if ($null -ne $zipItem) { $zipItem.FullName } else { "" }
      lastWriteTimeUtc = $lastWriteUtc.ToString("o")
      directorySizeBytes = $directorySize
      directorySizeMB = Format-SizeMB $directorySize
      zipSizeBytes = $zipSize
      zipSizeMB = Format-SizeMB $zipSize
      totalSizeBytes = $directorySize + $zipSize
      totalSizeMB = Format-SizeMB ($directorySize + $zipSize)
    }
  }
  return $entries | Sort-Object lastWriteTimeUtc -Descending
}

function Write-ReleaseRetentionReport([string]$RootPath, [string]$CurrentPackagePath, [string]$CurrentPackageName) {
  $entries = @(Get-ReleasePackageEntries $RootPath)
  $playableKeep = @($entries | Where-Object { $_.kind -eq "playable" } | Select-Object -First 2)
  $verifiedKeep = @($entries | Where-Object { $_.kind -eq "verified" } | Select-Object -First 1)
  $keepNames = New-Object 'System.Collections.Generic.HashSet[string]'
  foreach ($entry in @($playableKeep + $verifiedKeep)) {
    [void]$keepNames.Add($entry.name)
  }
  $cleanupCandidates = @($entries | Where-Object { -not $keepNames.Contains($_.name) })
  $archivePath = Join-Path $RootPath "archive"
  $current = $entries | Where-Object { $_.name -eq $CurrentPackageName } | Select-Object -First 1
  $report = [ordered]@{
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    policy = [ordered]@{
      playablePackagesKept = 2
      verifiedPackagesKept = 1
      action = "report-only"
      archiveSuggestionPath = $archivePath
      note = "No files are deleted or moved automatically. Review cleanupCandidates before deleting or archiving."
    }
    currentPackage = $current
    keep = [ordered]@{
      playable = @($playableKeep)
      verified = @($verifiedKeep)
    }
    cleanupCandidates = $cleanupCandidates
    packages = $entries
  }
  $json = ($report | ConvertTo-Json -Depth 8)
  $packageReportPath = Join-Path $CurrentPackagePath "release-cleanup-report.json"
  $latestReportPath = Join-Path $RootPath "release-cleanup-report-latest.json"
  Write-Utf8File $packageReportPath $json
  Write-Utf8File $latestReportPath $json
  if ($null -ne $current) {
    Write-Host ("Package size: folder {0} MB; zip {1} MB; total {2} MB" -f $current.directorySizeMB, $current.zipSizeMB, $current.totalSizeMB)
  }
  Write-Host "Release retention policy: keep latest 2 playable package groups and latest 1 verified package group."
  Write-Host "Cleanup report: $packageReportPath"
  Write-Host "Latest cleanup report: $latestReportPath"
  if ($cleanupCandidates.Count -gt 0) {
    Write-Host "Cleanup candidates (report-only; no files were deleted):"
    foreach ($candidate in $cleanupCandidates) {
      Write-Host ("  - {0} ({1} MB) -> suggest archive under {2}" -f $candidate.name, $candidate.totalSizeMB, $archivePath)
    }
  }
  else {
    Write-Host "Cleanup candidates: none."
  }
}

function Clear-PackageRuntimeState([string]$PackagePath) {
  $streamingAssets = Join-Path $PackagePath "BOTC_Unity_Prototype_Data\StreamingAssets"
  $runtimeNames = @(
    "unity_state.json",
    "unity_viewmodel.json",
    "unity_action.json",
    "unity_action_result.json"
  )
  foreach ($name in $runtimeNames) {
    Remove-Item -LiteralPath (Join-Path $streamingAssets $name) -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath (Join-Path $streamingAssets "$name.lock") -Recurse -Force -ErrorAction SilentlyContinue
  }
}

function Get-LocalLlmModelTier([string]$PathValue) {
  if ([string]::IsNullOrWhiteSpace($PathValue)) { return "" }
  $manifestPath = Join-Path $PathValue "LOCAL_LLM_MANIFEST.json"
  if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) { return "" }
  try {
    $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
    return "$($manifest.model.tier)".Trim().ToLowerInvariant()
  }
  catch {
    Write-Warning "Could not parse LocalLLM manifest tier: $manifestPath"
    return ""
  }
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$buildPath = Resolve-RepoPath $BuildDir
if (-not (Test-Path $buildPath)) {
  throw "Unity build directory not found: $buildPath"
}

$exePath = Join-Path $buildPath "BOTC_Unity_Prototype.exe"
if (-not (Test-Path $exePath)) {
  throw "Unity executable not found: $exePath"
}

if (-not $SkipBuildCoreSync) {
  Push-Location $repoRoot
  try {
    npm run unity:sync-build-core
  }
  finally {
    Pop-Location
  }
}

if (-not $SkipManagedAssemblyCompile) {
  $managedAssemblyPath = Join-Path $buildPath "BOTC_Unity_Prototype_Data\Managed\Assembly-CSharp.dll"
  $compileScript = Join-Path $repoRoot "tools\unity_csharp_compile_smoke.ps1"
  if (-not (Test-Path $compileScript)) {
    throw "Unity C# compile script not found: $compileScript"
  }
  & $compileScript -OutputPath $managedAssemblyPath
}

if (-not $SkipTests) {
  Push-Location $repoRoot
  try {
    npm run test:ai-llm-renderer
    npm run test:unity-action-bridge
  }
  finally {
    Pop-Location
  }
}

if ([string]::IsNullOrWhiteSpace($PackageName)) {
  $PackageName = "BOTC-Solo-Unity-AI-" + (Get-Date -Format "yyyyMMdd-HHmmss")
}

if ($PrepareLocalLlm) {
  $prepareScript = Join-Path $repoRoot "tools\prepare_local_llm.ps1"
  if (-not (Test-Path $prepareScript)) {
    throw "LocalLLM preparation script not found: $prepareScript"
  }
  $prepareOutput = if ([string]::IsNullOrWhiteSpace($LocalLlmSource)) {
    "third_party\LocalLLM"
  } else {
    $LocalLlmSource
  }
  Push-Location $repoRoot
  try {
    $prepareArgs = @{
      OutputDir = $prepareOutput
      ModelTier = $ModelTier
      LlamaReleaseTag = $LlamaReleaseTag
    }
    if (-not [string]::IsNullOrWhiteSpace($ModelRepo)) {
      $prepareArgs.ModelRepo = $ModelRepo
    }
    if (-not [string]::IsNullOrWhiteSpace($ModelFile)) {
      $prepareArgs.ModelFile = $ModelFile
    }
    & $prepareScript @prepareArgs
  }
  finally {
    Pop-Location
  }
  if ([string]::IsNullOrWhiteSpace($LocalLlmSource)) {
    $LocalLlmSource = $prepareOutput
  }
}

$outputRootPath = Resolve-RepoPath $OutputRoot
New-Item -ItemType Directory -Force -Path $outputRootPath | Out-Null
$dest = Join-Path $outputRootPath $PackageName
if (Test-Path $dest) {
  throw "Output package already exists: $dest"
}
New-Item -ItemType Directory -Force -Path $dest | Out-Null

Get-ChildItem -LiteralPath $buildPath -Force | ForEach-Object {
  if ($_.Name -ne "output") {
    Copy-Item -LiteralPath $_.FullName -Destination $dest -Recurse -Force
  }
}

Clear-PackageRuntimeState $dest

$localSource = Find-LocalLlmSource
$destLocalLlm = Join-Path $dest "LocalLLM"
$localLlmReady = $false
$localLlmTier = ""
if (-not [string]::IsNullOrWhiteSpace($localSource)) {
  if (Test-Path $destLocalLlm) {
    Remove-Item -LiteralPath $destLocalLlm -Recurse -Force
  }
  Copy-Item -LiteralPath $localSource -Destination $destLocalLlm -Recurse -Force
  $localLlmReady = Test-LocalLlmPackage $destLocalLlm -Strict:$RequireLocalLlm
  if ($localLlmReady) {
    $localLlmTier = Get-LocalLlmModelTier $destLocalLlm
  }
}
elseif ($RequireLocalLlm) {
  throw "LocalLLM package was required, but no LocalLLM source was found."
}
else {
  New-Item -ItemType Directory -Force -Path $destLocalLlm | Out-Null
  Write-Utf8File (Join-Path $destLocalLlm "README_MISSING_MODEL.md") @'
# LocalLLM model not bundled

This folder is intentionally empty in this package.

To ship AI-polished dialogue without requiring Ollama, place a local llama.cpp server bundle here before packaging:

```
LocalLLM/
  llama-server.exe
  models/
    qwen2.5-1.5b-instruct-q4.gguf
  licenses/
    llama.cpp-MIT.txt
    qwen2.5-1.5b-instruct-APACHE-2.0.txt
```

The Unity launcher will auto-detect this folder when started with `-botc-llm-renderer`.
'@
}

$directExeAiPolish = $localLlmReady -and -not $NoDirectExeAiPolish -and ($AutoEnableTinyLocalLlm -or $localLlmTier -ne "tiny")
if ($directExeAiPolish) {
  Write-AsciiFile (Join-Path $dest "botc_ai_polish.enabled") "Direct exe launch enables local LLM dialogue polish when LocalLLM is bundled."
  Write-AsciiFile (Join-Path $destLocalLlm "enable_ai_polish.flag") "enabled"
}
else {
  Remove-Item -LiteralPath (Join-Path $dest "botc_ai_polish.enabled") -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath (Join-Path $destLocalLlm "enable_ai_polish.flag") -Force -ErrorAction SilentlyContinue
  if ($localLlmReady -and $localLlmTier -eq "tiny" -and -not $NoDirectExeAiPolish -and -not $AutoEnableTinyLocalLlm) {
    Write-Host "Tiny LocalLLM tier detected; direct exe AI polish is left off by default. Use Start AI Polished.bat to opt in."
  }
}

Write-AsciiFile (Join-Path $dest "Start AI Polished.bat") @"
@echo off
set BOTC_LLM_TIMEOUT_MS=4000
start "" "%~dp0BOTC_Unity_Prototype.exe" -botc-llm-renderer
"@

Write-AsciiFile (Join-Path $dest "Start Basic.bat") @"
@echo off
start "" "%~dp0BOTC_Unity_Prototype.exe" -botc-no-llm-renderer
"@

Write-Utf8File (Join-Path $dest "README_AI_POLISH.md") @'
# BOTC Solo Unity AI-polished build

## How to run

- Double-click `BOTC_Unity_Prototype.exe`: starts the playable build. Quality/premium packages may include an auto-enable marker; tiny/default packages leave dialogue deterministic by default.
- `Start AI Polished.bat`: opt-in launcher that forces local LLM dialogue polish enabled.
- `Start Basic.bat`: starts Unity with deterministic local dialogue only.

## Local model layout

The polished launcher looks for this sibling folder:

```
LocalLLM/
  llama-server.exe
  models/*.gguf
  licenses/
```

If that folder is absent or incomplete, gameplay still works. The JS Core bridge falls back to the deterministic renderer or to an external provider configured by environment variables.

## Recommended license-safe bundle

- Runtime: `llama.cpp` server, MIT license.
- Model: an Apache-2.0 Chinese-capable GGUF. Check `LocalLLM/LOCAL_LLM_MANIFEST.json` for the exact bundled tier and file.
- Default tier: `Qwen2.5-0.5B-Instruct-GGUF`, smaller and faster.
- Quality tier: `Qwen2.5-1.5B-Instruct-GGUF` Q4_K_M, larger but usually better for dialogue polish.
- Premium tier: `Qwen3-4B-GGUF` Q4_K_M, targets a 2-3GB release.

Do not bundle the previous Ollama `qwen2.5:3b` package unless you have separately verified its model license and distribution terms.

## Important boundary

The model only rewrites already-safe AI speech. It does not decide rules, read hidden information, nominate, vote, or alter JS Core state.
'@

if ($VerifyPackage) {
  $verifyScript = Join-Path $repoRoot "tools\verify_unity_ai_package.ps1"
  if (-not (Test-Path $verifyScript)) {
    throw "Unity AI package verifier not found: $verifyScript"
  }
  & $verifyScript -PackageDir $dest
}

$zipPath = ""
if (-not $NoZip) {
  $zipPath = Join-Path $outputRootPath ($PackageName + ".zip")
  if (Test-Path $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
  $tar = Get-Command tar.exe -ErrorAction SilentlyContinue
  if ($tar) {
    & $tar.Source -a -c -f $zipPath -C $outputRootPath $PackageName
    if ($LASTEXITCODE -ne 0) {
      throw "tar.exe failed to create zip: $zipPath"
    }
  }
  else {
    Compress-Archive -LiteralPath $dest -DestinationPath $zipPath -Force
  }
  Write-Host "Package ready: $dest"
  Write-Host "Zip ready: $zipPath"
}
else {
  Write-Host "Package ready: $dest"
}

Write-ReleaseRetentionReport $outputRootPath $dest $PackageName
