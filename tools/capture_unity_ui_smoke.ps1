param(
  [string[]]$States = @(
    "main-menu",
    "settings",
    "main-board",
    "phase-assist-public",
    "token-inspector",
    "more-actions",
    "proactive-whisper",
    "proactive-whisper-queue",
    "proactive-whisper-after-accept",
    "nomination-debate",
    "info-drawer",
    "information-drawer",
    "endgame",
    "recap",
    "private-chat",
    "private-chat-long",
    "action-form",
    "action-form-ready",
    "fortune-teller-action-form",
    "fortune-teller-action-form-ready",
    "action-form-guesses",
    "storyteller-queue",
    "storyteller-queue-page2",
    "script-handbook",
    "script-help",
    "vote-ceremony",
    "role-picker",
    "role-picker-paged",
    "grimoire-reminders",
    "reminder-picker",
    "stage-dialogue",
    "stage-dialogue-queued",
    "phase-transition",
    "transition-day",
    "transition-night",
    "transition-nomination"
  ),
  [int]$Seed = 20260510,
  [int]$WindowWidth = 1920,
  [int]$WindowHeight = 1080,
  [string[]]$Viewports = @(),
  [switch]$Fullscreen,
  [string]$UnityExe = "",
  [string]$StreamingAssets = "",
  [switch]$RestoreRuntimeState,
  [switch]$UseExistingState,
  [switch]$AllowWindowFallback,
  [string]$OutputDir = ""
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($UnityExe)) {
  $UnityExe = Join-Path $root "unity-build\BOTC_Unity_Prototype.exe"
}
if ([string]::IsNullOrWhiteSpace($StreamingAssets)) {
  $StreamingAssets = Join-Path $root "unity-build\BOTC_Unity_Prototype_Data\StreamingAssets"
}
$unityExe = $UnityExe
$streamingAssets = $StreamingAssets
$fixtureScript = Join-Path $root "scripts\unity_ui_smoke_fixture.mjs"

if (-not (Test-Path -LiteralPath $unityExe)) {
  throw "Unity build not found: $unityExe. Build the prototype first."
}

if (-not (Test-Path -LiteralPath $streamingAssets -PathType Container)) {
  throw "Unity StreamingAssets not found: $streamingAssets"
}

if (-not $UseExistingState -and -not (Test-Path -LiteralPath $fixtureScript)) {
  throw "Fixture script not found: $fixtureScript"
}

if ([string]::IsNullOrWhiteSpace($OutputDir)) {
  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $OutputDir = Join-Path $root "output\unity-ui-smoke-$stamp"
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$OutputDir = (Resolve-Path -LiteralPath $OutputDir).Path

$nodeCommand = Get-Command node -ErrorAction Stop
$node = $nodeCommand.Source

Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class BotcUiSmokeWin32
{
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT
    {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
}
"@

function Wait-UnityWindow {
  param([System.Diagnostics.Process]$Process)

  for ($attempt = 0; $attempt -lt 80; $attempt++) {
    $Process.Refresh()
    if ($Process.HasExited) {
      throw "Unity exited before opening a window. ExitCode=$($Process.ExitCode)"
    }
    if ($Process.MainWindowHandle -ne [IntPtr]::Zero) {
      return $Process.MainWindowHandle
    }
    Start-Sleep -Milliseconds 250
  }

  throw "Timed out waiting for Unity window. PID=$($Process.Id)"
}

function Capture-WindowPng {
  param(
    [IntPtr]$Handle,
    [string]$Path
  )

  $rect = New-Object BotcUiSmokeWin32+RECT
  if (-not [BotcUiSmokeWin32]::GetWindowRect($Handle, [ref]$rect)) {
    throw "GetWindowRect failed for Unity window."
  }

  $width = [Math]::Max(1, $rect.Right - $rect.Left)
  $height = [Math]::Max(1, $rect.Bottom - $rect.Top)
  $bitmap = New-Object System.Drawing.Bitmap $width, $height
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.CopyFromScreen($rect.Left, $rect.Top, 0, 0, $bitmap.Size)
    $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $graphics.Dispose()
    $bitmap.Dispose()
  }
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

function Test-ScreenshotPng {
  param(
    [string]$Path,
    [int]$ExpectedWidth,
    [int]$ExpectedHeight
  )

  if (-not (Test-Path -LiteralPath $Path)) {
    throw "Screenshot validation failed; file missing: $Path"
  }

  $item = Get-Item -LiteralPath $Path
  if ($item.Length -lt 2048) {
    throw "Screenshot validation failed; file is too small ($($item.Length) bytes): $Path"
  }

  $bitmap = New-Object System.Drawing.Bitmap $Path
  try {
    $actualWidth = [int]$bitmap.Width
    $actualHeight = [int]$bitmap.Height
    $minimumWidth = [Math]::Max(1, [int][Math]::Floor($ExpectedWidth * 0.90))
    $minimumHeight = [Math]::Max(1, [int][Math]::Floor($ExpectedHeight * 0.90))
    $maximumWidth = [Math]::Max(1, [int][Math]::Ceiling($ExpectedWidth * 1.15))
    $maximumHeight = [Math]::Max(1, [int][Math]::Ceiling($ExpectedHeight * 1.15))
    if ($actualWidth -lt $minimumWidth -or $actualHeight -lt $minimumHeight -or $actualWidth -gt $maximumWidth -or $actualHeight -gt $maximumHeight) {
      throw "Screenshot validation failed; expected near ${ExpectedWidth}x${ExpectedHeight}, got ${actualWidth}x${actualHeight}: $Path"
    }

    $minLuma = 999.0
    $maxLuma = -1.0
    $sampleColors = @{}
    $xSamples = 9
    $ySamples = 7
    for ($yi = 0; $yi -lt $ySamples; $yi++) {
      $y = [int][Math]::Round(($actualHeight - 1) * (($yi + 0.5) / $ySamples))
      for ($xi = 0; $xi -lt $xSamples; $xi++) {
        $x = [int][Math]::Round(($actualWidth - 1) * (($xi + 0.5) / $xSamples))
        $pixel = $bitmap.GetPixel($x, $y)
        $luma = (0.2126 * $pixel.R) + (0.7152 * $pixel.G) + (0.0722 * $pixel.B)
        $minLuma = [Math]::Min($minLuma, $luma)
        $maxLuma = [Math]::Max($maxLuma, $luma)
        $sampleColors["$($pixel.R),$($pixel.G),$($pixel.B),$($pixel.A)"] = $true
      }
    }

    $lumaSpread = [Math]::Round($maxLuma - $minLuma, 2)
    if ($sampleColors.Count -lt 4 -or $lumaSpread -lt 6) {
      throw "Screenshot validation failed; image looks blank or nearly uniform (colors=$($sampleColors.Count), lumaSpread=$lumaSpread): $Path"
    }

    return [pscustomobject]@{
      actualWidth = $actualWidth
      actualHeight = $actualHeight
      sampleColors = $sampleColors.Count
      lumaSpread = $lumaSpread
    }
  } finally {
    $bitmap.Dispose()
  }
}

$results = @()

function Expand-CommaList {
  param([string[]]$Values)

  $items = @()
  foreach ($value in $Values) {
    if ([string]::IsNullOrWhiteSpace($value)) { continue }
    $parts = $value -split ","
    foreach ($part in $parts) {
      $trimmed = $part.Trim()
      if (-not [string]::IsNullOrWhiteSpace($trimmed)) {
        $items += $trimmed
      }
    }
  }
  return @($items)
}

function Resolve-ViewportSpecs {
  param(
    [string[]]$ViewportValues,
    [int]$DefaultWidth,
    [int]$DefaultHeight
  )

  $entries = Expand-CommaList $ViewportValues
  if ($entries.Count -eq 0) {
    return @([pscustomobject]@{
      label = "$($DefaultWidth)x$($DefaultHeight)"
      width = $DefaultWidth
      height = $DefaultHeight
    })
  }

  $specs = @()
  foreach ($entry in $entries) {
    if ($entry -notmatch "^(?<width>\d+)\s*x\s*(?<height>\d+)$") {
      throw "Invalid viewport '$entry'. Use WIDTHxHEIGHT, for example 1366x768."
    }
    $width = [int]$Matches.width
    $height = [int]$Matches.height
    if ($width -lt 320 -or $height -lt 240) {
      throw "Viewport '$entry' is too small for Unity UI smoke capture."
    }
    $specs += [pscustomobject]@{
      label = "$($width)x$($height)"
      width = $width
      height = $height
    }
  }
  return @($specs)
}

$stateList = Expand-CommaList $States
if ($stateList.Count -eq 0) {
  throw "No UI smoke states requested."
}
$viewportSpecs = Resolve-ViewportSpecs -ViewportValues $Viewports -DefaultWidth $WindowWidth -DefaultHeight $WindowHeight
$multiViewport = $viewportSpecs.Count -gt 1

$runtimeBackupDir = Join-Path ([System.IO.Path]::GetTempPath()) ("botc-ui-smoke-" + [System.Guid]::NewGuid().ToString("N"))
$runtimeBackups = $null
if ($RestoreRuntimeState) {
  $runtimeBackups = Backup-RuntimeFiles @(
    (Join-Path $streamingAssets "unity_state.json"),
    (Join-Path $streamingAssets "unity_viewmodel.json"),
    (Join-Path $streamingAssets "unity_action.json"),
    (Join-Path $streamingAssets "unity_action_result.json")
  ) $runtimeBackupDir
}

try {
  foreach ($viewport in $viewportSpecs) {
    foreach ($state in $stateList) {
      $captureWidth = [int]$viewport.width
      $captureHeight = [int]$viewport.height
      if ($UseExistingState) {
        Write-Host "Using existing Unity runtime state for UI smoke: $state @ $($viewport.label)"
      }
      else {
        Write-Host "Preparing UI smoke fixture: $state @ $($viewport.label)"
        & $node $fixtureScript "--state=$state" "--streaming-assets=$streamingAssets" "--seed=$Seed"
        if ($LASTEXITCODE -ne 0) {
          throw "Fixture generation failed for $state"
        }
      }

      $screenshotName = if ($multiViewport) { "$state-$($viewport.label).png" } else { "$state.png" }
      $screenshot = Join-Path $OutputDir $screenshotName

      $args = @(
        "-screen-fullscreen", $(if ($Fullscreen) { "1" } else { "0" }),
        "-screen-width", "$captureWidth",
        "-screen-height", "$captureHeight",
        "-botc-no-bridge",
        "-botc-ui-smoke", $state,
        "-botc-ui-smoke-output", $screenshot
      )

      $captured = $false
      $maxCaptureAttempts = 2
      for ($captureAttempt = 1; $captureAttempt -le $maxCaptureAttempts -and -not $captured; $captureAttempt++) {
        Remove-Item -LiteralPath $screenshot -Force -ErrorAction SilentlyContinue
        $attemptSuffix = if ($captureAttempt -gt 1) { " (retry $captureAttempt of $maxCaptureAttempts)" } else { "" }
        Write-Host "Launching Unity smoke state: $state @ $($viewport.label)$attemptSuffix"
        $process = $null
        try {
          $process = Start-Process -FilePath $unityExe -ArgumentList $args -WorkingDirectory (Split-Path -Parent $unityExe) -PassThru
          $handle = [IntPtr]::Zero
          try {
            $handle = Wait-UnityWindow -Process $process
          } catch {
            if (-not (Test-Path -LiteralPath $screenshot)) {
              throw
            }
          }

          $deadline = (Get-Date).AddSeconds(24)
          while ((-not (Test-Path -LiteralPath $screenshot)) -and (Get-Date) -lt $deadline) {
            if ($process.HasExited) { break }
            Start-Sleep -Milliseconds 250
          }

          if (-not (Test-Path -LiteralPath $screenshot)) {
            if ($handle -eq [IntPtr]::Zero) {
              throw "Unity did not create an internal screenshot and no window handle is available."
            }
            if (-not $AllowWindowFallback) {
              throw "Unity did not create an internal screenshot. Refusing window fallback because it can capture unrelated desktop windows; rerun with -AllowWindowFallback only for manual debugging."
            }
            Write-Host "Unity internal screenshot missing; falling back to window capture."
            Capture-WindowPng -Handle $handle -Path $screenshot
          }

          $item = Get-Item -LiteralPath $screenshot
          $validation = Test-ScreenshotPng -Path $screenshot -ExpectedWidth $captureWidth -ExpectedHeight $captureHeight
          $results += [pscustomobject]@{
            state = $state
            viewport = $viewport.label
            screenshot = $item.FullName
            bytes = $item.Length
            width = $captureWidth
            height = $captureHeight
            actualWidth = $validation.actualWidth
            actualHeight = $validation.actualHeight
            sampleColors = $validation.sampleColors
            lumaSpread = $validation.lumaSpread
            fullscreen = [bool]$Fullscreen
            existingState = [bool]$UseExistingState
          }
          $captured = $true
          Write-Host "Captured: $($item.FullName)"
        } catch {
          if ($captureAttempt -ge $maxCaptureAttempts) {
            throw
          }
          Write-Host "Capture attempt $captureAttempt failed for $state @ $($viewport.label); retrying. $($_.Exception.Message)"
          Remove-Item -LiteralPath $screenshot -Force -ErrorAction SilentlyContinue
        } finally {
          if ($null -ne $process) {
            if (-not $process.HasExited) {
              [void]$process.CloseMainWindow()
              if (-not $process.WaitForExit(1500)) {
                Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
              }
            }
          }
        }
      }
    }
  }
} finally {
  if ($RestoreRuntimeState -and $null -ne $runtimeBackups) {
    Restore-RuntimeFiles $runtimeBackups
    Remove-Item -LiteralPath $runtimeBackupDir -Recurse -Force -ErrorAction SilentlyContinue
  }
}

$manifestPath = Join-Path $OutputDir "manifest.json"
$results | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $manifestPath -Encoding UTF8
Write-Host "Unity UI smoke screenshots complete."
Write-Host "Manifest: $manifestPath"
