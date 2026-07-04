param(
  [string]$Report = "",
  [string]$UnityExe = "",
  [string]$StreamingAssets = "",
  [string]$OutputRoot = "",
  [string[]]$Roles = @(),
  [string[]]$NodeIds = @(
    "first-night",
    "day-one-private",
    "day-one-public",
    "day-one-nomination",
    "day-one-vote",
    "second-night",
    "day-two-loop",
    "endgame"
  ),
  [string[]]$Viewports = @("1920x1080", "1366x768"),
  [int]$WindowWidth = 1920,
  [int]$WindowHeight = 1080,
  [switch]$IncludeProactiveRegression,
  [switch]$AllowWindowFallback
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($Report)) {
  $Report = Join-Path $root "output\unity-playable-path-smoke\playable_loop_report.json"
}
if ([string]::IsNullOrWhiteSpace($UnityExe)) {
  $UnityExe = Join-Path $root "unity-build\BOTC_Unity_Prototype.exe"
}
if ([string]::IsNullOrWhiteSpace($StreamingAssets)) {
  $StreamingAssets = Join-Path $root "unity-build\BOTC_Unity_Prototype_Data\StreamingAssets"
}
if ([string]::IsNullOrWhiteSpace($OutputRoot)) {
  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $OutputRoot = Join-Path $root "output\unity-playable-path-render-smoke-$stamp"
}

$captureScript = Join-Path $PSScriptRoot "capture_unity_ui_smoke.ps1"

if (-not (Test-Path -LiteralPath $Report -PathType Leaf)) {
  throw "Playable path report not found: $Report. Run npm run test:unity-playable-path first."
}
if (-not (Test-Path -LiteralPath $UnityExe -PathType Leaf)) {
  throw "Unity build not found: $UnityExe"
}
if (-not (Test-Path -LiteralPath $StreamingAssets -PathType Container)) {
  throw "Unity StreamingAssets not found: $StreamingAssets"
}
if (-not (Test-Path -LiteralPath $captureScript -PathType Leaf)) {
  throw "Unity UI smoke capture script not found: $captureScript"
}

New-Item -ItemType Directory -Force -Path $OutputRoot | Out-Null
$OutputRoot = (Resolve-Path -LiteralPath $OutputRoot).Path

function Expand-CommaList {
  param([string[]]$Values)

  $items = @()
  foreach ($value in $Values) {
    if ([string]::IsNullOrWhiteSpace($value)) { continue }
    foreach ($part in ($value -split ",")) {
      $trimmed = $part.Trim()
      if (-not [string]::IsNullOrWhiteSpace($trimmed)) {
        $items += $trimmed
      }
    }
  }
  return $items
}

function ConvertTo-SafeName {
  param([string]$Value)

  if ([string]::IsNullOrWhiteSpace($Value)) { return "node" }
  return ($Value -replace "[^A-Za-z0-9._-]+", "-").Trim("-")
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
      $backups[$pathValue] = $null
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

function Copy-NodeRuntimeFiles {
  param(
    [object]$Node,
    [string]$Destination
  )

  $pathMap = @{
    state = "unity_state.json"
    viewModel = "unity_viewmodel.json"
    action = "unity_action.json"
    result = "unity_action_result.json"
  }
  foreach ($key in $pathMap.Keys) {
    $source = $Node.paths.$key
    if ([string]::IsNullOrWhiteSpace($source) -or -not (Test-Path -LiteralPath $source -PathType Leaf)) {
      throw "Playable node is missing $key file for $($Node.label): $source"
    }
    Copy-Item -LiteralPath $source -Destination (Join-Path $Destination $pathMap[$key]) -Force
  }
}

function Resolve-SmokeModeForPlayableNode {
  param([object]$Node)

  if ($Node.nodeId -eq "day-one-nomination") { return "nomination-debate" }
  if ($Node.nodeId -eq "day-one-vote") { return "vote-ceremony" }
  if ($Node.nodeId -eq "endgame") { return "endgame" }
  return "main-board"
}

function Invoke-NodeCapture {
  param(
    [object]$Node,
    [string]$RoleId,
    [int]$Index,
    [string[]]$ViewportArgs
  )

  Copy-NodeRuntimeFiles -Node $Node -Destination $StreamingAssets

  $smokeState = Resolve-SmokeModeForPlayableNode -Node $Node
  $safeRole = ConvertTo-SafeName $RoleId
  $safeNode = ConvertTo-SafeName ("{0:000}-{1}" -f $Index, $Node.label)
  $nodeOutput = Join-Path (Join-Path $OutputRoot $safeRole) $safeNode
  New-Item -ItemType Directory -Force -Path $nodeOutput | Out-Null

  $captureArgs = @(
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", $captureScript,
    "-States", $smokeState,
    "-UnityExe", $UnityExe,
    "-StreamingAssets", $StreamingAssets,
    "-OutputDir", $nodeOutput,
    "-UseExistingState",
    "-WindowWidth", "$WindowWidth",
    "-WindowHeight", "$WindowHeight"
  )
  if ($ViewportArgs.Count -gt 0) {
    $captureArgs += "-Viewports"
    $captureArgs += ($ViewportArgs -join ",")
  }
  if ($AllowWindowFallback) {
    $captureArgs += "-AllowWindowFallback"
  }

  Write-Host "Rendering playable node: $RoleId / $($Node.label) [$smokeState] -> $nodeOutput"
  $captureOutput = & powershell @captureArgs
  $captureExitCode = $LASTEXITCODE
  foreach ($line in @($captureOutput)) {
    Write-Host $line
  }
  if ($captureExitCode -ne 0) {
    throw "Unity capture failed for $RoleId / $($Node.label)"
  }

  $manifestPath = Join-Path $nodeOutput "manifest.json"
  if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
    throw "Unity capture manifest missing for $RoleId / $($Node.label): $manifestPath"
  }
  $captureManifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
  $captures = @($captureManifest)
  $entries = @()
  foreach ($capture in $captures) {
    $entries += [pscustomobject]@{
      roleId = $RoleId
      nodeId = $Node.nodeId
      label = $Node.label
      smokeState = $capture.state
      viewport = $capture.viewport
      screenshot = $capture.screenshot
      bytes = $capture.bytes
      width = $capture.width
      height = $capture.height
      actualWidth = $capture.actualWidth
      actualHeight = $capture.actualHeight
      lumaSpread = $capture.lumaSpread
      sourceNodeDir = $Node.paths.dir
      sourceSvg = $Node.paths.screenshot
      outputDir = $nodeOutput
    }
  }
  return $entries
}

$roleFilter = Expand-CommaList $Roles
$nodeFilter = Expand-CommaList $NodeIds
$viewportArgs = Expand-CommaList $Viewports
if ($nodeFilter.Count -eq 0) {
  throw "No playable node ids requested."
}

$reportObject = Get-Content -LiteralPath $Report -Raw -Encoding UTF8 | ConvertFrom-Json
$runtimeBackupDir = Join-Path ([System.IO.Path]::GetTempPath()) ("botc-playable-node-render-" + [System.Guid]::NewGuid().ToString("N"))
$runtimeBackups = Backup-RuntimeFiles @(
  (Join-Path $StreamingAssets "unity_state.json"),
  (Join-Path $StreamingAssets "unity_viewmodel.json"),
  (Join-Path $StreamingAssets "unity_action.json"),
  (Join-Path $StreamingAssets "unity_action_result.json")
) $runtimeBackupDir

$results = @()
$index = 0
try {
  foreach ($scenario in @($reportObject.scenarios)) {
    $roleId = $scenario.scenario.roleId
    if ($roleFilter.Count -gt 0 -and -not ($roleFilter -contains $roleId)) { continue }
    foreach ($nodeId in $nodeFilter) {
      $matches = @($scenario.nodes | Where-Object { $_.nodeId -eq $nodeId })
      if ($matches.Count -eq 0) {
        throw "Scenario $roleId is missing playable node id: $nodeId"
      }
      $index += 1
      $results += Invoke-NodeCapture -Node $matches[0] -RoleId $roleId -Index $index -ViewportArgs $viewportArgs
    }
  }

  if ($IncludeProactiveRegression -and $null -ne $reportObject.proactiveRegression) {
    foreach ($node in @($reportObject.proactiveRegression.nodes)) {
      $index += 1
      $results += Invoke-NodeCapture -Node $node -RoleId "proactive-whisper" -Index $index -ViewportArgs $viewportArgs
    }
  }
}
finally {
  Restore-RuntimeFiles $runtimeBackups
  Remove-Item -LiteralPath $runtimeBackupDir -Recurse -Force -ErrorAction SilentlyContinue
}

$manifestPath = Join-Path $OutputRoot "playable-node-render-manifest.json"
$summary = [pscustomobject]@{
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
  report = (Resolve-Path -LiteralPath $Report).Path
  unityExe = (Resolve-Path -LiteralPath $UnityExe).Path
  streamingAssets = (Resolve-Path -LiteralPath $StreamingAssets).Path
  outputRoot = $OutputRoot
  roles = @($roleFilter)
  nodeIds = $nodeFilter
  viewports = @($viewportArgs)
  includeProactiveRegression = [bool]$IncludeProactiveRegression
  captures = $results
}
$summary | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $manifestPath -Encoding UTF8

Write-Host "Unity playable node render screenshots complete."
Write-Host "Manifest: $manifestPath"
