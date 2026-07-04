param(
  [string]$Manifest = "",
  [string]$BaselineDir = "",
  [string[]]$RequiredStates = @(),
  [string[]]$RequiredViewports = @(),
  [int]$SampleStep = 4,
  [int]$MinSafeMarginPx = 4,
  [int]$EdgeBandPx = 24,
  [double]$MaxEdgeForegroundRate = 0.45,
  [double]$MaxDiffChangedRate = 0.18,
  [double]$MaxMeanAbsDelta = 18.0,
  [int]$PixelDeltaThreshold = 18,
  [string]$ReportPath = "",
  [switch]$FailOnWarnings
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot

Add-Type -AssemblyName System.Drawing

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
  return @($items)
}

function Resolve-SmokeManifest {
  param([string]$ManifestPath)

  if (-not [string]::IsNullOrWhiteSpace($ManifestPath)) {
    if (-not (Test-Path -LiteralPath $ManifestPath)) {
      throw "Unity UI smoke manifest not found: $ManifestPath"
    }
    return (Resolve-Path -LiteralPath $ManifestPath).Path
  }

  $outputRoot = Join-Path $root "output"
  if (-not (Test-Path -LiteralPath $outputRoot)) {
    throw "No output directory found. Run unity:ui-smoke first or pass -Manifest."
  }

  $latest = Get-ChildItem -LiteralPath $outputRoot -Directory -Filter "unity-ui-smoke*" |
    Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName "manifest.json") } |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

  if ($null -eq $latest) {
    throw "No unity-ui-smoke manifest found. Run unity:ui-smoke first or pass -Manifest."
  }

  return (Resolve-Path -LiteralPath (Join-Path $latest.FullName "manifest.json")).Path
}

function Resolve-EntryScreenshot {
  param(
    [object]$Entry,
    [string]$ManifestDir
  )

  $path = [string]$Entry.screenshot
  if ([string]::IsNullOrWhiteSpace($path)) {
    return ""
  }
  if ([System.IO.Path]::IsPathRooted($path)) {
    return $path
  }
  return Join-Path $ManifestDir $path
}

function Test-UiForegroundPixel {
  param([System.Drawing.Color]$Color)

  $r = [int]$Color.R
  $g = [int]$Color.G
  $b = [int]$Color.B
  $max = [Math]::Max($r, [Math]::Max($g, $b))
  $min = [Math]::Min($r, [Math]::Min($g, $b))
  $range = $max - $min
  $luma = (0.2126 * $r) + (0.7152 * $g) + (0.0722 * $b)

  $coolBackground = $b -gt ($r + 18) -and $b -gt ($g + 6) -and $luma -lt 185
  if ($coolBackground) { return $false }
  if ($luma -gt 205) { return $true }
  if ($r -gt 145 -and $g -gt 100 -and $b -lt 125) { return $true }
  if ($range -gt 48 -and $luma -gt 55 -and $luma -lt 220) { return $true }
  if ($luma -lt 35 -and $range -gt 14) { return $true }
  return $false
}

function Get-UiSmokeImageMetrics {
  param(
    [string]$Path,
    [int]$Step,
    [int]$SafeMarginPx,
    [int]$EdgeBand,
    [double]$MaxEdgeRate
  )

  $bitmap = New-Object System.Drawing.Bitmap $Path
  try {
    $width = [int]$bitmap.Width
    $height = [int]$bitmap.Height
    $sampleCount = 0
    $foregroundCount = 0
    $minX = $width
    $minY = $height
    $maxX = -1
    $maxY = -1
    $edgeSamples = @{
      left = 0
      top = 0
      right = 0
      bottom = 0
    }
    $edgeForeground = @{
      left = 0
      top = 0
      right = 0
      bottom = 0
    }

    for ($y = 0; $y -lt $height; $y += $Step) {
      for ($x = 0; $x -lt $width; $x += $Step) {
        $sampleCount += 1
        if ($x -lt $EdgeBand) { $edgeSamples.left += 1 }
        if ($y -lt $EdgeBand) { $edgeSamples.top += 1 }
        if ($x -ge ($width - $EdgeBand)) { $edgeSamples.right += 1 }
        if ($y -ge ($height - $EdgeBand)) { $edgeSamples.bottom += 1 }

        $pixel = $bitmap.GetPixel($x, $y)
        if (Test-UiForegroundPixel -Color $pixel) {
          $foregroundCount += 1
          $minX = [Math]::Min($minX, $x)
          $minY = [Math]::Min($minY, $y)
          $maxX = [Math]::Max($maxX, $x)
          $maxY = [Math]::Max($maxY, $y)
          if ($x -lt $EdgeBand) { $edgeForeground.left += 1 }
          if ($y -lt $EdgeBand) { $edgeForeground.top += 1 }
          if ($x -ge ($width - $EdgeBand)) { $edgeForeground.right += 1 }
          if ($y -ge ($height - $EdgeBand)) { $edgeForeground.bottom += 1 }
        }
      }
    }

    $warnings = @()
    if ($foregroundCount -eq 0) {
      $warnings += "no-ui-foreground-detected"
      return [pscustomobject]@{
        width = $width
        height = $height
        sampleStep = $Step
        sampleCount = $sampleCount
        foregroundSampleCount = 0
        foregroundSampleRate = 0
        foregroundBounds = $null
        safeMargins = $null
        edgeForegroundRates = $null
        warnings = $warnings
      }
    }

    $safeMargins = [pscustomobject]@{
      left = $minX
      top = $minY
      right = [Math]::Max(0, $width - 1 - $maxX)
      bottom = [Math]::Max(0, $height - 1 - $maxY)
    }

    $edgeRates = [pscustomobject]@{
      left = [Math]::Round($edgeForeground.left / [Math]::Max(1, $edgeSamples.left), 4)
      top = [Math]::Round($edgeForeground.top / [Math]::Max(1, $edgeSamples.top), 4)
      right = [Math]::Round($edgeForeground.right / [Math]::Max(1, $edgeSamples.right), 4)
      bottom = [Math]::Round($edgeForeground.bottom / [Math]::Max(1, $edgeSamples.bottom), 4)
    }

    foreach ($edge in @("left", "top", "right", "bottom")) {
      if ([double]$edgeRates.$edge -gt $MaxEdgeRate) {
        $warnings += "foreground-near-$edge-edge"
      }
    }

    return [pscustomobject]@{
      width = $width
      height = $height
      sampleStep = $Step
      sampleCount = $sampleCount
      foregroundSampleCount = $foregroundCount
      foregroundSampleRate = [Math]::Round($foregroundCount / [Math]::Max(1, $sampleCount), 4)
      foregroundBounds = [pscustomobject]@{
        left = $minX
        top = $minY
        right = $maxX
        bottom = $maxY
      }
      safeMargins = $safeMargins
      edgeForegroundRates = $edgeRates
      warnings = $warnings
    }
  } finally {
    $bitmap.Dispose()
  }
}

function Compare-UiSmokeImages {
  param(
    [string]$CurrentPath,
    [string]$BaselinePath,
    [int]$Step,
    [int]$DeltaThreshold
  )

  $current = New-Object System.Drawing.Bitmap $CurrentPath
  $baseline = New-Object System.Drawing.Bitmap $BaselinePath
  try {
    if ($current.Width -ne $baseline.Width -or $current.Height -ne $baseline.Height) {
      return [pscustomobject]@{
        baseline = $BaselinePath
        dimensionsMatch = $false
        sampleCount = 0
        meanAbsDelta = 999
        changedRate = 1
      }
    }

    $sampleCount = 0
    $changedCount = 0
    $sumDelta = 0.0
    for ($y = 0; $y -lt $current.Height; $y += $Step) {
      for ($x = 0; $x -lt $current.Width; $x += $Step) {
        $a = $current.GetPixel($x, $y)
        $b = $baseline.GetPixel($x, $y)
        $delta = ([Math]::Abs([int]$a.R - [int]$b.R) + [Math]::Abs([int]$a.G - [int]$b.G) + [Math]::Abs([int]$a.B - [int]$b.B)) / 3.0
        $sumDelta += $delta
        $sampleCount += 1
        if ($delta -gt $DeltaThreshold) {
          $changedCount += 1
        }
      }
    }

    return [pscustomobject]@{
      baseline = $BaselinePath
      dimensionsMatch = $true
      sampleCount = $sampleCount
      meanAbsDelta = [Math]::Round($sumDelta / [Math]::Max(1, $sampleCount), 3)
      changedRate = [Math]::Round($changedCount / [Math]::Max(1, $sampleCount), 4)
    }
  } finally {
    $baseline.Dispose()
    $current.Dispose()
  }
}

if ($SampleStep -lt 1) {
  throw "-SampleStep must be at least 1."
}

$manifestPath = Resolve-SmokeManifest -ManifestPath $Manifest
$manifestDir = Split-Path -Parent $manifestPath
$parsedManifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$entries = @($parsedManifest | ForEach-Object { $_ })
if ($entries.Count -eq 0) {
  throw "Unity UI smoke manifest has no entries: $manifestPath"
}

$requiredStates = Expand-CommaList $RequiredStates
$requiredViewports = Expand-CommaList $RequiredViewports
$failures = @()
$warnings = @()

foreach ($state in $requiredStates) {
  if (-not ($entries | Where-Object { $_.state -eq $state } | Select-Object -First 1)) {
    $failures += "missing required state '$state'"
  }
}

foreach ($viewport in $requiredViewports) {
  if (-not ($entries | Where-Object { $_.viewport -eq $viewport } | Select-Object -First 1)) {
    $failures += "missing required viewport '$viewport'"
  }
}

if ($requiredStates.Count -gt 0 -and $requiredViewports.Count -gt 0) {
  foreach ($state in $requiredStates) {
    foreach ($viewport in $requiredViewports) {
      if (-not ($entries | Where-Object { $_.state -eq $state -and $_.viewport -eq $viewport } | Select-Object -First 1)) {
        $failures += "missing required capture '$state @ $viewport'"
      }
    }
  }
}

$baselineRoot = ""
if (-not [string]::IsNullOrWhiteSpace($BaselineDir)) {
  if (-not (Test-Path -LiteralPath $BaselineDir)) {
    throw "Baseline directory not found: $BaselineDir"
  }
  $baselineRoot = (Resolve-Path -LiteralPath $BaselineDir).Path
}

$screenshots = @()
Write-Host "Checking Unity UI smoke screenshots: $($entries.Count)"
foreach ($entry in $entries) {
  $screenshot = Resolve-EntryScreenshot -Entry $entry -ManifestDir $manifestDir
  $entryWarnings = @()
  $entryFailures = @()
  Write-Host "Checking: $($entry.state) @ $($entry.viewport)"
  if ([string]::IsNullOrWhiteSpace($screenshot) -or -not (Test-Path -LiteralPath $screenshot)) {
    $entryFailures += "screenshot missing"
    $failures += "$($entry.state) @ $($entry.viewport): screenshot missing"
    $screenshots += [pscustomobject]@{
      state = $entry.state
      viewport = $entry.viewport
      screenshot = $screenshot
      failures = $entryFailures
      warnings = $entryWarnings
    }
    continue
  }

  $metrics = Get-UiSmokeImageMetrics -Path $screenshot -Step $SampleStep -SafeMarginPx $MinSafeMarginPx -EdgeBand $EdgeBandPx -MaxEdgeRate $MaxEdgeForegroundRate
  foreach ($warning in @($metrics.warnings)) {
    $entryWarnings += $warning
    $warnings += "$($entry.state) @ $($entry.viewport): $warning"
  }

  $baselineComparison = $null
  if (-not [string]::IsNullOrWhiteSpace($baselineRoot)) {
    $baselinePath = Join-Path $baselineRoot (Split-Path -Leaf $screenshot)
    if (-not (Test-Path -LiteralPath $baselinePath)) {
      $entryFailures += "baseline screenshot missing"
      $failures += "$($entry.state) @ $($entry.viewport): baseline screenshot missing"
    } else {
      $baselineComparison = Compare-UiSmokeImages -CurrentPath $screenshot -BaselinePath $baselinePath -Step $SampleStep -DeltaThreshold $PixelDeltaThreshold
      if (-not $baselineComparison.dimensionsMatch) {
        $entryFailures += "baseline dimensions mismatch"
        $failures += "$($entry.state) @ $($entry.viewport): baseline dimensions mismatch"
      }
      if ($baselineComparison.meanAbsDelta -gt $MaxMeanAbsDelta -or $baselineComparison.changedRate -gt $MaxDiffChangedRate) {
        $entryFailures += "visual diff exceeds threshold"
        $failures += "$($entry.state) @ $($entry.viewport): visual diff exceeds threshold (mean=$($baselineComparison.meanAbsDelta), changed=$($baselineComparison.changedRate))"
      }
    }
  }

  $screenshots += [pscustomobject]@{
    state = $entry.state
    viewport = $entry.viewport
    screenshot = $screenshot
    metrics = $metrics
    baseline = $baselineComparison
    failures = $entryFailures
    warnings = $entryWarnings
  }
}

if ([string]::IsNullOrWhiteSpace($ReportPath)) {
  $ReportPath = Join-Path $manifestDir "visual-regression-report.json"
}

$report = [pscustomobject]@{
  manifest = $manifestPath
  baselineDir = $baselineRoot
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
  sampleStep = $SampleStep
  minSafeMarginPx = $MinSafeMarginPx
  edgeBandPx = $EdgeBandPx
  thresholds = [pscustomobject]@{
    maxEdgeForegroundRate = $MaxEdgeForegroundRate
    maxDiffChangedRate = $MaxDiffChangedRate
    maxMeanAbsDelta = $MaxMeanAbsDelta
    pixelDeltaThreshold = $PixelDeltaThreshold
  }
  requiredStates = $requiredStates
  requiredViewports = $requiredViewports
  screenshotCount = $screenshots.Count
  failureCount = $failures.Count
  warningCount = $warnings.Count
  failures = $failures
  warnings = $warnings
  screenshots = $screenshots
}

$report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $ReportPath -Encoding UTF8

Write-Host "Unity UI visual smoke check complete."
Write-Host "Manifest: $manifestPath"
Write-Host "Report: $ReportPath"
Write-Host "Screenshots: $($screenshots.Count), warnings=$($warnings.Count), failures=$($failures.Count)"

if ($failures.Count -gt 0 -or ($FailOnWarnings -and $warnings.Count -gt 0)) {
  if ($failures.Count -gt 0) {
    foreach ($failure in $failures) {
      Write-Host "FAIL: $failure"
    }
  }
  if ($FailOnWarnings -and $warnings.Count -gt 0) {
    foreach ($warning in $warnings) {
      Write-Host "WARN: $warning"
    }
  }
  exit 1
}
