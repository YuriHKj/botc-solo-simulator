param(
  [string]$BuildDir = "unity-build",
  [string]$OutputRoot = "output\release-unity-ai",
  [string]$PackageName = "",
  [string]$LocalLlmSource = "",
  [switch]$PrepareLocalLlm,
  [ValidateSet("tiny", "balanced", "quality", "custom")]
  [string]$ModelTier = "balanced",
  [string]$ModelRepo = "",
  [string]$ModelFile = "",
  [string]$LlamaReleaseTag = "latest",
  [switch]$RequireLocalLlm,
  [switch]$NoDirectExeAiPolish,
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
  Set-Content -LiteralPath $PathValue -Encoding UTF8 -Value $Content
}

function Write-AsciiFile([string]$PathValue, [string]$Content) {
  $parent = Split-Path -Parent $PathValue
  if (-not [string]::IsNullOrWhiteSpace($parent)) {
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
  }
  Set-Content -LiteralPath $PathValue -Encoding ASCII -Value $Content
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
    $prepareArgs = @(
      "-OutputDir", $prepareOutput,
      "-ModelTier", $ModelTier,
      "-LlamaReleaseTag", $LlamaReleaseTag
    )
    if (-not [string]::IsNullOrWhiteSpace($ModelRepo)) {
      $prepareArgs += @("-ModelRepo", $ModelRepo)
    }
    if (-not [string]::IsNullOrWhiteSpace($ModelFile)) {
      $prepareArgs += @("-ModelFile", $ModelFile)
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

$localSource = Find-LocalLlmSource
$destLocalLlm = Join-Path $dest "LocalLLM"
$localLlmReady = $false
if (-not [string]::IsNullOrWhiteSpace($localSource)) {
  if (Test-Path $destLocalLlm) {
    Remove-Item -LiteralPath $destLocalLlm -Recurse -Force
  }
  Copy-Item -LiteralPath $localSource -Destination $destLocalLlm -Recurse -Force
  $localLlmReady = Test-LocalLlmPackage $destLocalLlm -Strict:$RequireLocalLlm
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

if ($localLlmReady -and -not $NoDirectExeAiPolish) {
  Write-AsciiFile (Join-Path $dest "botc_ai_polish.enabled") "Direct exe launch enables local LLM dialogue polish when LocalLLM is bundled."
  Write-AsciiFile (Join-Path $destLocalLlm "enable_ai_polish.flag") "enabled"
}

Write-AsciiFile (Join-Path $dest "Start AI Polished.bat") @"
@echo off
set BOTC_LLM_TIMEOUT_MS=2200
start "" "%~dp0BOTC_Unity_Prototype.exe" -botc-llm-renderer
"@

Write-AsciiFile (Join-Path $dest "Start Basic.bat") @"
@echo off
start "" "%~dp0BOTC_Unity_Prototype.exe" -botc-no-llm-renderer
"@

Write-Utf8File (Join-Path $dest "README_AI_POLISH.md") @'
# BOTC Solo Unity AI-polished build

## How to run

- Double-click `BOTC_Unity_Prototype.exe`: starts the playable build. If `botc_ai_polish.enabled` is present and `LocalLLM` is complete, local LLM dialogue polish starts automatically.
- `Start AI Polished.bat`: fallback launcher that forces local LLM dialogue polish enabled.
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
- Model: an Apache-2.0 small Chinese-capable GGUF. The default packager uses `Qwen2.5-0.5B-Instruct-GGUF` to keep the release lightweight.

Do not bundle the previous Ollama `qwen2.5:3b` package unless you have separately verified its model license and distribution terms.

## Important boundary

The model only rewrites already-safe AI speech. It does not decide rules, read hidden information, nominate, vote, or alter JS Core state.
'@

if (-not $NoZip) {
  $zipPath = Join-Path $outputRootPath ($PackageName + ".zip")
  if (Test-Path $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
  Compress-Archive -LiteralPath $dest -DestinationPath $zipPath -Force
  Write-Host "Package ready: $dest"
  Write-Host "Zip ready: $zipPath"
}
else {
  Write-Host "Package ready: $dest"
}
