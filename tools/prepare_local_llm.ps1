param(
  [string]$OutputDir = "third_party\LocalLLM",
  [ValidateSet("tiny", "balanced", "quality", "custom")]
  [string]$ModelTier = "balanced",
  [string]$ModelRepo = "",
  [string]$ModelFile = "",
  [string]$LlamaReleaseTag = "latest",
  [switch]$Force,
  [switch]$SkipRuntime,
  [switch]$SkipModel
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Resolve-RepoPath([string]$PathValue) {
  if ([string]::IsNullOrWhiteSpace($PathValue)) { return "" }
  if ([System.IO.Path]::IsPathRooted($PathValue)) { return $PathValue }
  return (Join-Path $repoRoot $PathValue)
}

function Write-Utf8File([string]$PathValue, [string]$Content) {
  $parent = Split-Path -Parent $PathValue
  if (-not [string]::IsNullOrWhiteSpace($parent)) {
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
  }
  Set-Content -LiteralPath $PathValue -Encoding UTF8 -Value $Content
}

function Download-File([string]$Url, [string]$Destination, [switch]$Required) {
  if ((Test-Path $Destination) -and -not $Force) {
    Write-Host "Using cached file: $Destination"
    return
  }
  $parent = Split-Path -Parent $Destination
  if (-not [string]::IsNullOrWhiteSpace($parent)) {
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
  }
  $tmp = "$Destination.tmp"
  if (Test-Path $tmp) { Remove-Item -LiteralPath $tmp -Force }
  Write-Host "Downloading: $Url"
  try {
    Invoke-WebRequest -Uri $Url -OutFile $tmp -Headers @{ "User-Agent" = "BOTC-Solo-Packager" }
    if (Test-Path $Destination) { Remove-Item -LiteralPath $Destination -Force }
    Move-Item -LiteralPath $tmp -Destination $Destination
  }
  catch {
    if (Test-Path $tmp) { Remove-Item -LiteralPath $tmp -Force }
    if ($Required) { throw }
    Write-Warning "Optional download failed: $Url ($($_.Exception.Message))"
  }
}

function Read-GitHubRelease([string]$Tag) {
  $uri = if ([string]::IsNullOrWhiteSpace($Tag) -or $Tag -eq "latest") {
    "https://api.github.com/repos/ggml-org/llama.cpp/releases/latest"
  } else {
    "https://api.github.com/repos/ggml-org/llama.cpp/releases/tags/$Tag"
  }
  return Invoke-RestMethod -Uri $uri -Headers @{ "User-Agent" = "BOTC-Solo-Packager" }
}

function Resolve-ModelPreset() {
  $presets = @{
    tiny = @{
      repo = "Qwen/Qwen2.5-0.5B-Instruct-GGUF"
      file = "qwen2.5-0.5b-instruct-q4_k_m.gguf"
      licenseFile = "qwen2.5-0.5b-instruct-APACHE-2.0.txt"
    }
    balanced = @{
      repo = "Qwen/Qwen2.5-0.5B-Instruct-GGUF"
      file = "qwen2.5-0.5b-instruct-q4_k_m.gguf"
      licenseFile = "qwen2.5-0.5b-instruct-APACHE-2.0.txt"
    }
    quality = @{
      repo = "Qwen/Qwen2.5-1.5B-Instruct-GGUF"
      file = "qwen2.5-1.5b-instruct-q4_k_m.gguf"
      licenseFile = "qwen2.5-1.5b-instruct-APACHE-2.0.txt"
    }
  }
  if ($ModelTier -eq "custom") {
    if ([string]::IsNullOrWhiteSpace($ModelRepo) -or [string]::IsNullOrWhiteSpace($ModelFile)) {
      throw "Custom model tier requires -ModelRepo and -ModelFile."
    }
    return @{
      repo = $ModelRepo
      file = $ModelFile
      licenseFile = "model-APACHE-2.0.txt"
    }
  }
  $preset = $presets[$ModelTier]
  if ([string]::IsNullOrWhiteSpace($ModelRepo)) { $script:ModelRepo = $preset.repo }
  if ([string]::IsNullOrWhiteSpace($ModelFile)) { $script:ModelFile = $preset.file }
  return @{
    repo = $script:ModelRepo
    file = $script:ModelFile
    licenseFile = $preset.licenseFile
  }
}

function Prepare-LlamaRuntime([string]$TargetDir) {
  if ($SkipRuntime) { return $null }
  $existingServer = Get-ChildItem -LiteralPath $TargetDir -Recurse -Filter "llama-server.exe" -File -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($existingServer -and -not $Force) {
    Write-Host "Using existing llama-server.exe: $($existingServer.FullName)"
    $cachedAsset = Get-ChildItem -LiteralPath (Join-Path $repoRoot ".cache\local-llm") -Filter "llama-*-bin-win-cpu-x64.zip" -File -ErrorAction SilentlyContinue |
      Sort-Object LastWriteTime -Descending |
      Select-Object -First 1
    $cachedTag = if ($cachedAsset -and $cachedAsset.Name -match "llama-(b[0-9]+)-bin") { $Matches[1] } else { "existing" }
    return @{
      tag = $cachedTag
      asset = if ($cachedAsset) { $cachedAsset.Name } else { $existingServer.Name }
      serverPath = $existingServer.FullName
    }
  }

  $release = Read-GitHubRelease $LlamaReleaseTag
  $asset = $release.assets |
    Where-Object { $_.name -match "^llama-.+-bin-win-cpu-x64\.zip$" } |
    Sort-Object name -Descending |
    Select-Object -First 1
  if ($null -eq $asset) {
    throw "Could not find a llama.cpp Windows CPU x64 release asset."
  }

  $cacheDir = Join-Path $repoRoot ".cache\local-llm"
  New-Item -ItemType Directory -Force -Path $cacheDir | Out-Null
  $zipPath = Join-Path $cacheDir $asset.name
  Download-File $asset.browser_download_url $zipPath -Required

  $extractDir = Join-Path $cacheDir ("llama-" + $release.tag_name)
  if (Test-Path $extractDir) { Remove-Item -LiteralPath $extractDir -Recurse -Force }
  New-Item -ItemType Directory -Force -Path $extractDir | Out-Null
  Expand-Archive -LiteralPath $zipPath -DestinationPath $extractDir -Force

  $server = Get-ChildItem -LiteralPath $extractDir -Recurse -Filter "llama-server.exe" -File | Select-Object -First 1
  if ($null -eq $server) {
    throw "Downloaded llama.cpp archive did not contain llama-server.exe."
  }

  Get-ChildItem -LiteralPath $server.DirectoryName -File | Where-Object {
    $_.Name -eq "llama-server.exe" -or $_.Extension -eq ".dll"
  } | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $TargetDir $_.Name) -Force
  }

  return @{
    tag = $release.tag_name
    asset = $asset.name
    serverPath = (Join-Path $TargetDir "llama-server.exe")
  }
}

function Prepare-Model([string]$TargetDir) {
  $modelsDir = Join-Path $TargetDir "models"
  New-Item -ItemType Directory -Force -Path $modelsDir | Out-Null
  $modelPath = Join-Path $modelsDir $ModelFile
  if (-not $SkipModel) {
    $modelUrl = "https://huggingface.co/$ModelRepo/resolve/main/$ModelFile"
    Download-File $modelUrl $modelPath -Required
  }
  if (-not (Test-Path $modelPath)) {
    throw "Model file missing after preparation: $modelPath"
  }
  return $modelPath
}

function Prepare-Licenses([string]$TargetDir) {
  $licensesDir = Join-Path $TargetDir "licenses"
  New-Item -ItemType Directory -Force -Path $licensesDir | Out-Null
  Download-File "https://raw.githubusercontent.com/ggml-org/llama.cpp/master/LICENSE" (Join-Path $licensesDir "llama.cpp-MIT.txt")
  Download-File "https://huggingface.co/$ModelRepo/raw/main/LICENSE" (Join-Path $licensesDir $modelPreset.licenseFile)
  Download-File "https://huggingface.co/$ModelRepo/raw/main/README.md" (Join-Path $TargetDir "MODEL_CARD.md")
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$modelPreset = Resolve-ModelPreset
$target = Resolve-RepoPath $OutputDir
New-Item -ItemType Directory -Force -Path $target | Out-Null

$runtime = Prepare-LlamaRuntime $target
$modelPath = Prepare-Model $target
Prepare-Licenses $target

$serverPath = Get-ChildItem -LiteralPath $target -Recurse -Filter "llama-server.exe" -File -ErrorAction SilentlyContinue | Select-Object -First 1
if ($null -eq $serverPath) {
  throw "LocalLLM preparation failed: llama-server.exe is missing."
}

$manifest = [ordered]@{
  preparedAt = (Get-Date).ToUniversalTime().ToString("o")
  runtime = @{
    provider = "llama.cpp"
    release = $runtime.tag
    asset = $runtime.asset
    license = "MIT"
    server = "llama-server.exe"
  }
  model = @{
    tier = $ModelTier
    repo = $ModelRepo
    file = $ModelFile
    license = "Apache-2.0"
    path = "models/$ModelFile"
  }
  layout = @{
    openAICompatibleEndpoint = "http://127.0.0.1:18080/v1/chat/completions"
    unityAutoEnableMarker = "botc_ai_polish.enabled"
  }
}
Write-Utf8File (Join-Path $target "LOCAL_LLM_MANIFEST.json") (($manifest | ConvertTo-Json -Depth 6) + "`n")

Write-Host "LocalLLM ready: $target"
Write-Host "Runtime: $($serverPath.FullName)"
Write-Host "Model: $modelPath"
