param(
  [string[]]$States = @(
    "main-board",
    "proactive-whisper",
    "nomination-debate",
    "info-drawer",
    "information-drawer",
    "private-chat",
    "action-form",
    "storyteller-queue",
    "script-handbook",
    "vote-ceremony",
    "role-picker",
    "reminder-picker",
    "stage-dialogue",
    "phase-transition"
  ),
  [int]$Seed = 20260510,
  [int]$WindowWidth = 1920,
  [int]$WindowHeight = 1080,
  [switch]$Fullscreen,
  [string]$OutputDir = ""
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$unityExe = Join-Path $root "unity-build\BOTC_Unity_Prototype.exe"
$streamingAssets = Join-Path $root "unity-build\BOTC_Unity_Prototype_Data\StreamingAssets"
$fixtureScript = Join-Path $root "scripts\unity_ui_smoke_fixture.mjs"

if (-not (Test-Path -LiteralPath $unityExe)) {
  throw "Unity build not found: $unityExe. Build the prototype first."
}

if (-not (Test-Path -LiteralPath $fixtureScript)) {
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

$results = @()

foreach ($state in $States) {
  Write-Host "Preparing UI smoke fixture: $state"
  & $node $fixtureScript "--state=$state" "--streaming-assets=$streamingAssets" "--seed=$Seed"
  if ($LASTEXITCODE -ne 0) {
    throw "Fixture generation failed for $state"
  }

  $screenshot = Join-Path $OutputDir "$state.png"
  Remove-Item -LiteralPath $screenshot -Force -ErrorAction SilentlyContinue

  $args = @(
    "-screen-fullscreen", $(if ($Fullscreen) { "1" } else { "0" }),
    "-screen-width", "$WindowWidth",
    "-screen-height", "$WindowHeight",
    "-botc-no-bridge",
    "-botc-ui-smoke", $state,
    "-botc-ui-smoke-output", $screenshot
  )

  Write-Host "Launching Unity smoke state: $state"
  $process = Start-Process -FilePath $unityExe -ArgumentList $args -WorkingDirectory (Split-Path -Parent $unityExe) -PassThru
  try {
    $handle = [IntPtr]::Zero
    try {
      $handle = Wait-UnityWindow -Process $process
    } catch {
      if (-not (Test-Path -LiteralPath $screenshot)) {
        throw
      }
    }

    $deadline = (Get-Date).AddSeconds(12)
    while ((-not (Test-Path -LiteralPath $screenshot)) -and (Get-Date) -lt $deadline) {
      if ($process.HasExited) { break }
      Start-Sleep -Milliseconds 250
    }

    if (-not (Test-Path -LiteralPath $screenshot)) {
      if ($handle -eq [IntPtr]::Zero) {
        throw "Unity did not create an internal screenshot and no window handle is available."
      }
      Write-Host "Unity internal screenshot missing; falling back to window capture."
      Capture-WindowPng -Handle $handle -Path $screenshot
    }

    $item = Get-Item -LiteralPath $screenshot
    $results += [pscustomobject]@{
      state = $state
      screenshot = $item.FullName
      bytes = $item.Length
      width = $WindowWidth
      height = $WindowHeight
      fullscreen = [bool]$Fullscreen
    }
    Write-Host "Captured: $($item.FullName)"
  } finally {
    if (-not $process.HasExited) {
      [void]$process.CloseMainWindow()
      if (-not $process.WaitForExit(1500)) {
        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
      }
    }
  }
}

$manifestPath = Join-Path $OutputDir "manifest.json"
$results | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $manifestPath -Encoding UTF8
Write-Host "Unity UI smoke screenshots complete."
Write-Host "Manifest: $manifestPath"
