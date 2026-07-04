param(
  [int]$WindowWidth = 1280,
  [int]$WindowHeight = 720,
  [int]$StartupTimeoutSeconds = 18,
  [int]$ActionTimeoutSeconds = 45,
  [int]$Seed = 20260609,
  [switch]$IncludeNightAction,
  [switch]$OnlyNightAction,
  [switch]$OnlyManualNightAction,
  [switch]$OnlySocial,
  [switch]$OnlyInfoDrawer,
  [switch]$InfoDrawerPublicFixture,
  [switch]$OnlyNominationVote,
  [string]$PackageDir = "",
  [string]$UnityExe = "",
  [string]$StreamingAssets = "",
  [string]$ArtifactDir = "",
  [switch]$RestoreRuntimeState,
  [switch]$AllowVisibleWindow,
  [switch]$Fullscreen
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$script:ClickCoordinateWidth = 1280
$script:ClickCoordinateHeight = 720

if (-not $AllowVisibleWindow) {
  throw "unity_build_click_smoke opens and focuses a visible Unity window. Pass -AllowVisibleWindow only after the user explicitly allows visible click testing."
}

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
    $ArtifactDir = Join-Path $root ("output\unity-build-click-smoke-" + (Split-Path -Leaf $packagePath))
  }
}

if ([string]::IsNullOrWhiteSpace($UnityExe)) {
  $UnityExe = Join-Path $root "unity-build\BOTC_Unity_Prototype.exe"
}
if ([string]::IsNullOrWhiteSpace($StreamingAssets)) {
  $StreamingAssets = Join-Path $root "unity-build\BOTC_Unity_Prototype_Data\StreamingAssets"
}
if ([string]::IsNullOrWhiteSpace($ArtifactDir)) {
  $ArtifactDir = Join-Path $root "output\unity-build-click-smoke"
}

$unityExe = Resolve-WorkspacePath $UnityExe
$streamingAssets = Resolve-WorkspacePath $StreamingAssets
$statePath = Join-Path $streamingAssets "unity_state.json"
$actionPath = Join-Path $streamingAssets "unity_action.json"
$resultPath = Join-Path $streamingAssets "unity_action_result.json"
$viewModelPath = Join-Path $streamingAssets "unity_viewmodel.json"
$fixtureScript = Join-Path $root "scripts\unity_ui_smoke_fixture.mjs"
$bridgeScript = Join-Path $root "scripts\unity_action_bridge.mjs"
$artifactDir = Resolve-WorkspacePath $ArtifactDir
$runtimeBackupDir = Join-Path $artifactDir ("runtime-state-backup-" + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
$script:runtimeStateBackups = $null
$script:runtimeStateRestored = $false
$script:clickTrace = @()
$script:screenshotTrace = @()
$script:clickSmokeResults = @()
$script:clickSmokeFailure = $null
$script:currentFlow = "startup"

if (-not (Test-Path -LiteralPath $unityExe)) {
  throw "Unity build executable not found: $unityExe"
}
if (-not (Test-Path -LiteralPath $streamingAssets)) {
  throw "Unity build StreamingAssets not found: $streamingAssets"
}

Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class BotcClickSmokeWin32
{
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT
    {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct POINT
    {
        public int X;
        public int Y;
    }

    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);

    [DllImport("user32.dll")]
    public static extern bool SetProcessDPIAware();

    [DllImport("user32.dll")]
    public static extern bool GetClientRect(IntPtr hWnd, out RECT rect);

    [DllImport("user32.dll")]
    public static extern bool ClientToScreen(IntPtr hWnd, ref POINT point);

    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

    [DllImport("user32.dll")]
    public static extern bool SetCursorPos(int x, int y);

    [DllImport("user32.dll")]
    public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);
}
"@
[BotcClickSmokeWin32]::SetProcessDPIAware() | Out-Null

function Read-JsonFile {
  param([string]$PathValue)

  return [System.IO.File]::ReadAllText($PathValue) | ConvertFrom-Json
}

function Remove-BridgeFiles {
  Remove-Item -LiteralPath $actionPath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $resultPath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath "$actionPath.lock" -Recurse -Force -ErrorAction SilentlyContinue
}

function Set-ClickSmokeFlow {
  param([string]$Name)

  $script:currentFlow = if ([string]::IsNullOrWhiteSpace($Name)) { "unknown" } else { $Name }
}

function Copy-RuntimeJsonArtifacts {
  param([string]$BasePath)

  if ([string]::IsNullOrWhiteSpace($BasePath)) {
    return
  }

  $directory = Split-Path -Parent $BasePath
  if (-not [string]::IsNullOrWhiteSpace($directory)) {
    New-Item -ItemType Directory -Force -Path $directory | Out-Null
  }

  $pairs = @(
    @{ Source = $statePath; Suffix = "unity_state.json" },
    @{ Source = $viewModelPath; Suffix = "unity_viewmodel.json" },
    @{ Source = $actionPath; Suffix = "unity_action.json" },
    @{ Source = $resultPath; Suffix = "unity_action_result.json" }
  )
  foreach ($pair in $pairs) {
    if (Test-Path -LiteralPath $pair.Source -PathType Leaf) {
      Copy-Item -LiteralPath $pair.Source -Destination "$BasePath.$($pair.Suffix)" -Force
    }
  }
}

function Write-ClickSmokeReport {
  param(
    [object[]]$Results = @(),
    [object]$Failure = $null
  )

  New-Item -ItemType Directory -Force -Path $artifactDir | Out-Null
  $report = [pscustomobject]@{
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    unityExe = $unityExe
    streamingAssets = $streamingAssets
    window = [pscustomobject]@{
      width = $WindowWidth
      height = $WindowHeight
      fullscreen = [bool]$Fullscreen
    }
    clickCoordinates = [pscustomobject]@{
      width = $script:ClickCoordinateWidth
      height = $script:ClickCoordinateHeight
    }
    status = if ($null -eq $Failure) { "passed" } else { "failed" }
    failure = $Failure
    results = @($Results)
    clickTrace = @($script:clickTrace)
    screenshots = @($script:screenshotTrace)
  }
  $reportPath = Join-Path $artifactDir "click_smoke_report.json"
  $report | ConvertTo-Json -Depth 16 | Set-Content -LiteralPath $reportPath -Encoding UTF8
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

function Test-TextContainsPath {
  param(
    [string]$TextValue,
    [string]$PathValue
  )

  if ([string]::IsNullOrWhiteSpace($TextValue) -or [string]::IsNullOrWhiteSpace($PathValue)) {
    return $false
  }

  $needle = ([System.IO.Path]::GetFullPath($PathValue)).ToLowerInvariant()
  $needleForward = $needle.Replace("\", "/")
  $haystack = $TextValue.ToLowerInvariant()
  return $haystack.Contains($needle) -or $haystack.Contains($needleForward)
}

function Test-ProcessPathContainsPath {
  param(
    [object]$ProcessInfo,
    [string]$PathValue
  )

  return (Test-TextContainsPath $ProcessInfo.CommandLine $PathValue) -or
    (Test-TextContainsPath $ProcessInfo.ExecutablePath $PathValue)
}

function Stop-PackageLocalProcesses {
  if ([string]::IsNullOrWhiteSpace($packagePath)) {
    return
  }

  Get-CimInstance Win32_Process -Filter "name = 'node.exe' OR name = 'llama-server.exe' OR name = 'BOTC_Unity_Prototype.exe'" -ErrorAction SilentlyContinue |
    Where-Object { Test-ProcessPathContainsPath $_ $packagePath } |
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

function Wait-UnityWindow {
  param([System.Diagnostics.Process]$Process)

  $deadline = (Get-Date).AddSeconds($StartupTimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    $Process.Refresh()
    if ($Process.HasExited) {
      throw "Unity exited before opening a window. ExitCode=$($Process.ExitCode)"
    }
    if ($Process.MainWindowHandle -ne [IntPtr]::Zero) {
      return $Process.MainWindowHandle
    }
    Start-Sleep -Milliseconds 200
  }

  throw "Timed out waiting for Unity window. PID=$($Process.Id)"
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

function Focus-UnityWindow {
  param([IntPtr]$Handle)

  $topMost = [IntPtr](-1)
  $notTopMost = [IntPtr](-2)
  $noMoveNoSizeShow = [uint32](0x0001 -bor 0x0002 -bor 0x0040)
  $noMoveNoSize = [uint32](0x0001 -bor 0x0002)

  [BotcClickSmokeWin32]::ShowWindow($Handle, 9) | Out-Null
  [BotcClickSmokeWin32]::SetWindowPos($Handle, $topMost, 0, 0, 0, 0, $noMoveNoSizeShow) | Out-Null
  [BotcClickSmokeWin32]::SetForegroundWindow($Handle) | Out-Null
  Start-Sleep -Milliseconds 120
  [BotcClickSmokeWin32]::SetWindowPos($Handle, $notTopMost, 0, 0, 0, 0, $noMoveNoSize) | Out-Null
  [BotcClickSmokeWin32]::SetForegroundWindow($Handle) | Out-Null
  Start-Sleep -Milliseconds 120
}

function Click-UnityWindowPoint {
  param(
    [IntPtr]$Handle,
    [int]$X,
    [int]$Y,
    [string]$Label = ""
  )

  Focus-UnityWindow -Handle $Handle
  $rect = New-Object BotcClickSmokeWin32+RECT
  if (-not [BotcClickSmokeWin32]::GetClientRect($Handle, [ref]$rect)) {
    throw "GetClientRect failed for Unity window."
  }

  $actualWidth = [Math]::Max(1, $rect.Right - $rect.Left)
  $actualHeight = [Math]::Max(1, $rect.Bottom - $rect.Top)
  $scaledX = [int][Math]::Round($X * ($actualWidth / [double]$script:ClickCoordinateWidth))
  $scaledY = [int][Math]::Round($Y * ($actualHeight / [double]$script:ClickCoordinateHeight))
  $point = New-Object BotcClickSmokeWin32+POINT
  $point.X = $scaledX
  $point.Y = $scaledY
  if (-not [BotcClickSmokeWin32]::ClientToScreen($Handle, [ref]$point)) {
    throw "ClientToScreen failed for Unity window."
  }

  [BotcClickSmokeWin32]::SetCursorPos($point.X, $point.Y) | Out-Null
  Start-Sleep -Milliseconds 80
  [BotcClickSmokeWin32]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 70
  [BotcClickSmokeWin32]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)

  $script:clickTrace += [pscustomobject]@{
    flow = $script:currentFlow
    label = $Label
    requested = [pscustomobject]@{ x = $X; y = $Y }
    client = [pscustomobject]@{ x = $scaledX; y = $scaledY; width = $actualWidth; height = $actualHeight }
    screen = [pscustomobject]@{ x = $point.X; y = $point.Y }
    at = (Get-Date).ToUniversalTime().ToString("o")
  }
}

function Type-UnityText {
  param(
    [IntPtr]$Handle,
    [string]$Text
  )

  Focus-UnityWindow -Handle $Handle
  [System.Windows.Forms.SendKeys]::SendWait("^a")
  Start-Sleep -Milliseconds 80
  [System.Windows.Forms.SendKeys]::SendWait($Text)
  Start-Sleep -Milliseconds 180
}

function Capture-UnityWindowPng {
  param(
    [IntPtr]$Handle,
    [string]$PathValue
  )

  Focus-UnityWindow -Handle $Handle
  $rect = New-Object BotcClickSmokeWin32+RECT
  if (-not [BotcClickSmokeWin32]::GetWindowRect($Handle, [ref]$rect)) {
    throw "GetWindowRect failed for Unity window."
  }

  $width = [Math]::Max(1, $rect.Right - $rect.Left)
  $height = [Math]::Max(1, $rect.Bottom - $rect.Top)
  $directory = Split-Path -Parent $PathValue
  if (-not [string]::IsNullOrWhiteSpace($directory)) {
    New-Item -ItemType Directory -Force -Path $directory | Out-Null
  }
  $basePath = Join-Path $directory ([System.IO.Path]::GetFileNameWithoutExtension($PathValue))
  $bitmap = New-Object System.Drawing.Bitmap $width, $height
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.CopyFromScreen($rect.Left, $rect.Top, 0, 0, $bitmap.Size)
    $bitmap.Save($PathValue, [System.Drawing.Imaging.ImageFormat]::Png)
    Copy-RuntimeJsonArtifacts -BasePath $basePath
    $script:screenshotTrace += [pscustomobject]@{
      flow = $script:currentFlow
      path = $PathValue
      width = $width
      height = $height
      state = "$basePath.unity_state.json"
      viewModel = "$basePath.unity_viewmodel.json"
      action = "$basePath.unity_action.json"
      result = "$basePath.unity_action_result.json"
      at = (Get-Date).ToUniversalTime().ToString("o")
    }
  }
  finally {
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}

function Wait-ActionFile {
  param(
    [string]$ExpectedType,
    [int]$TimeoutSeconds
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-Path -LiteralPath $actionPath) {
      try {
        $action = Read-JsonFile $actionPath
        if ($action.type -eq $ExpectedType -and -not [string]::IsNullOrWhiteSpace($action.id)) {
          return $action
        }
      }
      catch {
        Start-Sleep -Milliseconds 150
      }
    }
    Start-Sleep -Milliseconds 200
  }

  throw "Timed out waiting for Unity UI to write action type=$ExpectedType"
}

function Wait-ActionFileAny {
  param(
    [string[]]$ExpectedTypes,
    [int]$TimeoutSeconds
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-Path -LiteralPath $actionPath) {
      try {
        $action = Read-JsonFile $actionPath
        if (($ExpectedTypes -contains $action.type) -and -not [string]::IsNullOrWhiteSpace($action.id)) {
          return $action
        }
      }
      catch {
        Start-Sleep -Milliseconds 150
      }
    }
    Start-Sleep -Milliseconds 200
  }

  throw "Timed out waiting for Unity UI to write one of action types=$($ExpectedTypes -join ',')"
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

function Read-ViewModelOrNull {
  if (-not (Test-Path -LiteralPath $viewModelPath -PathType Leaf)) {
    return $null
  }

  try {
    return Read-JsonFile $viewModelPath
  }
  catch {
    return $null
  }
}

function Test-NominationFlowOpen {
  param([object]$ViewModel)

  if ($null -eq $ViewModel) {
    return $false
  }

  return (
    $ViewModel.phase -eq "day" -and
    $ViewModel.dayStage -eq "nomination" -and
    (
      $ViewModel.nominationClock.active -eq $true -or
      $ViewModel.nominationDebate.active -eq $true
    )
  )
}

function Wait-NominationFlowOpen {
  param([int]$TimeoutSeconds)

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    $viewModel = Read-ViewModelOrNull
    if (Test-NominationFlowOpen -ViewModel $viewModel) {
      return $viewModel
    }
    Start-Sleep -Milliseconds 250
  }

  return $null
}

function Test-NominationDayEndComplete {
  param([object]$ViewModel)

  if ($null -eq $ViewModel) {
    return $false
  }

  return ($ViewModel.phase -ne "day" -or $ViewModel.dayStage -ne "nomination")
}

function Wait-NominationDayEndComplete {
  param([int]$TimeoutSeconds)

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    $viewModel = Read-ViewModelOrNull
    if (Test-NominationDayEndComplete -ViewModel $viewModel) {
      return $viewModel
    }
    Start-Sleep -Milliseconds 250
  }

  return $null
}

function New-ActionFromViewModelLastAction {
  param(
    [object]$ViewModel,
    [string[]]$AllowedTypes
  )

  if ($null -eq $ViewModel -or $null -eq $ViewModel.action) {
    return $null
  }
  if ([string]::IsNullOrWhiteSpace($ViewModel.action.lastActionId)) {
    return $null
  }
  if ($AllowedTypes -notcontains $ViewModel.action.lastActionType) {
    return $null
  }

  return [pscustomobject]@{
    id = $ViewModel.action.lastActionId
    type = $ViewModel.action.lastActionType
  }
}

function Invoke-ClickCandidatesUntilAction {
  param(
    [IntPtr]$Handle,
    [string]$ExpectedType,
    [object[]]$Candidates
  )

  foreach ($candidate in $Candidates) {
    $label = ""
    if ($candidate -is [hashtable] -and $candidate.ContainsKey("label")) {
      $label = $candidate["label"]
    }
    elseif ($candidate.PSObject.Properties.Name -contains "label") {
      $label = $candidate.label
    }
    Click-UnityWindowPoint -Handle $Handle -X $candidate.x -Y $candidate.y -Label $label
    try {
      return Wait-ActionFile -ExpectedType $ExpectedType -TimeoutSeconds 2
    }
    catch {
      Start-Sleep -Milliseconds 150
    }
  }

  return Wait-ActionFile -ExpectedType $ExpectedType -TimeoutSeconds $ActionTimeoutSeconds
}

function Invoke-ClickCandidatesUntilActionAny {
  param(
    [IntPtr]$Handle,
    [string[]]$ExpectedTypes,
    [object[]]$Candidates
  )

  foreach ($candidate in $Candidates) {
    $label = ""
    if ($candidate -is [hashtable] -and $candidate.ContainsKey("label")) {
      $label = $candidate["label"]
    }
    elseif ($candidate.PSObject.Properties.Name -contains "label") {
      $label = $candidate.label
    }
    Click-UnityWindowPoint -Handle $Handle -X $candidate.x -Y $candidate.y -Label $label
    try {
      return Wait-ActionFileAny -ExpectedTypes $ExpectedTypes -TimeoutSeconds 2
    }
    catch {
      Start-Sleep -Milliseconds 150
    }
  }

  return Wait-ActionFileAny -ExpectedTypes $ExpectedTypes -TimeoutSeconds $ActionTimeoutSeconds
}

function Invoke-EndDayFromNominationClick {
  param(
    [object]$Scenario,
    [string]$SnapshotName = ""
  )

  $lastAction = $null
  $endDayActionTypes = @("phase", "pass-nomination-window", "auto-advance")
  $preferAdvance = $true
  for ($attempt = 0; $attempt -lt 3; $attempt++) {
    $stableViewModel = Wait-NominationDayEndComplete -TimeoutSeconds 1
    $stableAction = New-ActionFromViewModelLastAction -ViewModel $stableViewModel -AllowedTypes $endDayActionTypes
    if ($null -ne $stableAction) {
      return $stableAction
    }

    foreach ($candidate in @(
      @{ x = 1202; y = 347; label = "close-vote-ceremony" },
      @{ x = 1202; y = 333; label = "close-vote-ceremony" },
      @{ x = 1202; y = 361; label = "close-vote-ceremony" },
      @{ x = 1188; y = 347; label = "close-vote-ceremony" },
      @{ x = 1216; y = 347; label = "close-vote-ceremony" }
    )) {
      Click-UnityWindowPoint -Handle $Scenario.Handle -X $candidate.x -Y $candidate.y -Label $candidate.label
      Start-Sleep -Milliseconds 160
    }
    foreach ($candidate in @(
      @{ x = 1015; y = 574; label = "collapse-stage-dialogue" },
      @{ x = 1028; y = 574; label = "collapse-stage-dialogue" },
      @{ x = 1015; y = 536; label = "dismiss-vote-result-dialogue" },
      @{ x = 1028; y = 536; label = "dismiss-vote-result-dialogue" }
    )) {
      Click-UnityWindowPoint -Handle $Scenario.Handle -X $candidate.x -Y $candidate.y -Label $candidate.label
      Start-Sleep -Milliseconds 240
    }
    Start-Sleep -Milliseconds 700
    if ($preferAdvance) {
      Capture-UnityWindowPng -Handle $Scenario.Handle -PathValue (Join-Path $artifactDir "end-day-after-dialogue-dismiss.png")
    }
    if ($attempt -eq 0 -and -not [string]::IsNullOrWhiteSpace($SnapshotName)) {
      Capture-UnityWindowPng -Handle $Scenario.Handle -PathValue (Join-Path $artifactDir $SnapshotName)
    }
    if ($attempt -gt 0) {
      Remove-BridgeFiles
    }
    $endDayPassCandidates = @(
      @{ x = 839; y = 92; label = "end-day-pass-window" },
      @{ x = 826; y = 92; label = "end-day-pass-window" },
      @{ x = 852; y = 92; label = "end-day-pass-window" }
    )
    $endDayAdvanceCandidates = @(
      @{ x = 690; y = 92; label = "end-day-auto-advance" },
      @{ x = 677; y = 92; label = "end-day-auto-advance" },
      @{ x = 703; y = 92; label = "end-day-auto-advance" },
      @{ x = 84; y = 484; label = "end-day-left-next-phase" },
      @{ x = 72; y = 484; label = "end-day-left-next-phase" },
      @{ x = 96; y = 484; label = "end-day-left-next-phase" }
    )
    $endDaySecondaryCandidates = @(
      @{ x = 764; y = 92; label = "end-day-secondary" },
      @{ x = 751; y = 92; label = "end-day-secondary" },
      @{ x = 777; y = 92; label = "end-day-secondary" }
    )
    $candidateOrder = if ($preferAdvance) {
      @($endDayAdvanceCandidates + $endDayPassCandidates + $endDaySecondaryCandidates)
    }
    else {
      @($endDayPassCandidates + $endDayAdvanceCandidates + $endDaySecondaryCandidates)
    }
    try {
      $lastAction = Invoke-ClickCandidatesUntilActionAny `
        -Handle $Scenario.Handle `
        -ExpectedTypes $endDayActionTypes `
        -Candidates $candidateOrder
    }
    catch {
      $stableViewModel = Wait-NominationDayEndComplete -TimeoutSeconds 2
      $stableAction = New-ActionFromViewModelLastAction -ViewModel $stableViewModel -AllowedTypes $endDayActionTypes
      if ($null -ne $stableAction) {
        return $stableAction
      }
      throw
    }
    $result = Wait-ResultAction -ActionId $lastAction.id -TimeoutSeconds $ActionTimeoutSeconds
    if ($result.ok -ne $true) {
      return $lastAction
    }
    if ($lastAction.type -eq "pass-nomination-window") {
      $preferAdvance = $true
      Start-Sleep -Milliseconds 400
      Capture-UnityWindowPng -Handle $Scenario.Handle -PathValue (Join-Path $artifactDir "end-day-after-pass-window.png")
      continue
    }
    Start-Sleep -Milliseconds 400
    $viewModel = Wait-NominationDayEndComplete -TimeoutSeconds 2
    if ($null -ne $viewModel) {
      return $lastAction
    }
  }

  return $lastAction
}

function Get-GrimoireTokenClickCandidates {
  param(
    [int]$TokenIndex,
    [int]$PlayerCount
  )

  $count = [Math]::Max(1, $PlayerCount)
  $scale = [Math]::Sqrt(($script:ClickCoordinateWidth / 1920.0) * ($script:ClickCoordinateHeight / 1080.0))
  $radiusCanvas = [Math]::Min([Math]::Max([Math]::Min($script:ClickCoordinateWidth, $script:ClickCoordinateHeight) * 0.360, 348), 408)
  $radius = $radiusCanvas * $scale
  $dockSafeYOffset = 36 * $scale
  $boardCenterX = $script:ClickCoordinateWidth / 2.0
  $boardCenterY = $script:ClickCoordinateHeight / 2.0 - (-7 * $scale)
  $angle = [Math]::PI * 0.5 - [Math]::PI * 2.0 * $TokenIndex / $count
  $centerX = [int][Math]::Round($boardCenterX + [Math]::Cos($angle) * $radius)
  $centerY = [int][Math]::Round($boardCenterY - ([Math]::Sin($angle) * $radius + $dockSafeYOffset))
  return @(
    @{ x = $centerX; y = $centerY },
    @{ x = $centerX; y = $centerY + 24 },
    @{ x = $centerX; y = $centerY - 24 },
    @{ x = $centerX - 24; y = $centerY },
    @{ x = $centerX + 24; y = $centerY }
  )
}

function Get-ActionTargetBarTokenClickCandidates {
  param(
    [int]$SeatIndex,
    [int]$PlayerCount
  )

  if ($PlayerCount -eq 9) {
    $layout = @(
      @{ x = 650; y = 82 },
      @{ x = 798; y = 138 },
      @{ x = 877; y = 275 },
      @{ x = 850; y = 432 },
      @{ x = 728; y = 534 },
      @{ x = 574; y = 534 },
      @{ x = 450; y = 432 },
      @{ x = 421; y = 275 },
      @{ x = 500; y = 138 }
    )
    if ($SeatIndex -ge 0 -and $SeatIndex -lt $layout.Count) {
      $base = $layout[$SeatIndex]
      $centerX = [int][Math]::Round($base.x * ($script:ClickCoordinateWidth / 1280.0))
      $centerY = [int][Math]::Round($base.y * ($script:ClickCoordinateHeight / 720.0))
      return @(
        @{ x = $centerX; y = $centerY },
        @{ x = $centerX; y = $centerY + 28 },
        @{ x = $centerX; y = $centerY - 22 },
        @{ x = $centerX - 24; y = $centerY },
        @{ x = $centerX + 24; y = $centerY }
      )
    }
  }

  return Get-GrimoireTokenClickCandidates -TokenIndex $SeatIndex -PlayerCount $PlayerCount
}

function Stop-UnityScenario {
  param(
    [System.Diagnostics.Process]$UnityProcess,
    [int[]]$BeforeNodeIds = @()
  )

  if ($UnityProcess -and -not $UnityProcess.HasExited) {
    Stop-Process -Id $UnityProcess.Id -Force -ErrorAction SilentlyContinue
  }
  foreach ($node in @(Get-BridgeNodeProcesses -BeforeIds $BeforeNodeIds)) {
    Stop-Process -Id $node.ProcessId -Force -ErrorAction SilentlyContinue
  }
}

function Start-UnityScenario {
  param([string[]]$ExtraArgs = @())

  $beforeNodeIds = @(Get-Process node -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
  $fullscreenValue = if ($Fullscreen) { "1" } else { "0" }
  $args = @("-screen-fullscreen", $fullscreenValue, "-screen-width", "$WindowWidth", "-screen-height", "$WindowHeight") + $ExtraArgs
  $process = Start-Process `
    -FilePath $unityExe `
    -ArgumentList $args `
    -WorkingDirectory (Split-Path -Parent $unityExe) `
    -PassThru
  $handle = Wait-UnityWindow $process
  $nodes = Wait-UnityBridgeProcess -BeforeIds $beforeNodeIds

  return [pscustomobject]@{
    Process = $process
    Handle = $handle
    BeforeNodeIds = $beforeNodeIds
    NodePids = @($nodes | Select-Object -ExpandProperty ProcessId)
  }
}

function Prepare-SmokeFixture {
  param([string]$StateName)

  $node = (Get-Command node -ErrorAction Stop).Source
  & $node $fixtureScript --state $StateName --seed $Seed --streaming-assets $streamingAssets | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to prepare $StateName fixture."
  }
}

function Prepare-BridgeFreshState {
  param(
    [string]$ScriptId,
    [string]$Role,
    [int]$PlayerCount = 9,
    [int]$StateSeed = $Seed
  )

  $node = (Get-Command node -ErrorAction Stop).Source
  Remove-BridgeFiles
  & $node $bridgeScript `
    --fresh `
    "--script=$ScriptId" `
    "--role=$Role" `
    "--players=$PlayerCount" `
    "--seed=$StateSeed" `
    "--state=$statePath" `
    "--viewmodel=$viewModelPath" `
    "--action=$actionPath" `
    "--result=$resultPath" `
    --no-replay | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to prepare bridge fresh state for $ScriptId/$Role."
  }
  Remove-BridgeFiles
}

function Invoke-ContinueCurrentFromMenuClick {
  param(
    [object]$Scenario,
    [string]$SnapshotPrefix = ""
  )

  if (-not [string]::IsNullOrWhiteSpace($SnapshotPrefix)) {
    Capture-UnityWindowPng -Handle $Scenario.Handle -PathValue (Join-Path $artifactDir "$SnapshotPrefix-before-continue.png")
  }
  Click-UnityWindowPoint -Handle $Scenario.Handle -X 490 -Y 356 -Label "continue-current-game"
  Start-Sleep -Milliseconds 1200
  if (-not [string]::IsNullOrWhiteSpace($SnapshotPrefix)) {
    Capture-UnityWindowPng -Handle $Scenario.Handle -PathValue (Join-Path $artifactDir "$SnapshotPrefix-after-continue.png")
  }
}

function Invoke-DismissStageDialogueClick {
  param([object]$Scenario)

  Click-UnityWindowPoint -Handle $Scenario.Handle -X 1028 -Y 574 -Label "dismiss-stage-dialogue"
  Start-Sleep -Milliseconds 500
}

function Invoke-NewGameClickSmoke {
  Set-ClickSmokeFlow "new-game-click"
  Remove-BridgeFiles
  $scenario = Start-UnityScenario
  try {
    Start-Sleep -Milliseconds 900
    Capture-UnityWindowPng -Handle $scenario.Handle -PathValue (Join-Path $artifactDir "main-menu-before-click.png")
    $action = Invoke-ClickCandidatesUntilAction `
      -Handle $scenario.Handle `
      -ExpectedType "new-game" `
      -Candidates @(
        @{ x = 490; y = 314 },
        @{ x = 490; y = 304 },
        @{ x = 490; y = 324 },
        @{ x = 452; y = 314 },
        @{ x = 528; y = 314 },
        @{ x = 400; y = 314 },
        @{ x = 580; y = 314 }
      )
    $result = Wait-ResultAction -ActionId $action.id -TimeoutSeconds $ActionTimeoutSeconds
    if ($result.ok -ne $true) {
      throw "new-game UI click failed: $($result.message)"
    }
    $viewModel = Read-JsonFile $viewModelPath
    if ($viewModel.action.lastActionId -ne $action.id -or $viewModel.action.lastActionType -ne "new-game") {
      throw "new-game UI click did not refresh Unity viewmodel with the clicked action."
    }

    return [pscustomobject]@{
      Name = "new-game-click"
      UnityPid = $scenario.Process.Id
      NodePids = ($scenario.NodePids -join ",")
      ActionId = $action.id
      ActionType = $result.actionType
      Phase = $viewModel.phase
      Day = $viewModel.day
      Night = $viewModel.night
      GameOver = $viewModel.gameOver
    }
  }
  finally {
    Stop-UnityScenario -UnityProcess $scenario.Process -BeforeNodeIds $scenario.BeforeNodeIds
  }
}

function Invoke-NightActionClickSmoke {
  Set-ClickSmokeFlow "night-action-click"
  Prepare-BridgeFreshState -ScriptId "tb" -Role "fortune-teller" -PlayerCount 9 -StateSeed ($Seed + 1)

  $scenario = Start-UnityScenario
  try {
    Start-Sleep -Milliseconds 1800
    Invoke-ContinueCurrentFromMenuClick -Scenario $scenario -SnapshotPrefix "night-action-menu"
    Start-Sleep -Milliseconds 4800
    Click-UnityWindowPoint -Handle $scenario.Handle -X 1028 -Y 574
    Start-Sleep -Milliseconds 300
    Click-UnityWindowPoint -Handle $scenario.Handle -X 640 -Y 693
    Start-Sleep -Milliseconds 300
    Capture-UnityWindowPng -Handle $scenario.Handle -PathValue (Join-Path $artifactDir "night-action-before-primary-action.png")
    foreach ($candidate in @(
      @{ x = 884; y = 676 },
      @{ x = 884; y = 668 },
      @{ x = 884; y = 690 },
      @{ x = 860; y = 676 },
      @{ x = 910; y = 676 }
    )) {
      Click-UnityWindowPoint -Handle $scenario.Handle -X $candidate.x -Y $candidate.y
      Start-Sleep -Milliseconds 300
    }
    Start-Sleep -Milliseconds 500
    Capture-UnityWindowPng -Handle $scenario.Handle -PathValue (Join-Path $artifactDir "night-action-targetbar-before-auto.png")
    Click-UnityWindowPoint -Handle $scenario.Handle -X 1014 -Y 576
    Start-Sleep -Milliseconds 250
    Click-UnityWindowPoint -Handle $scenario.Handle -X 1014 -Y 608
    Start-Sleep -Milliseconds 500
    Capture-UnityWindowPng -Handle $scenario.Handle -PathValue (Join-Path $artifactDir "night-action-targetbar-after-dialogue.png")
    $autoActionTargets = @(
      @{ x = 1132; y = 568 },
      @{ x = 1120; y = 568 },
      @{ x = 1144; y = 568 },
      @{ x = 1132; y = 556 },
      @{ x = 1132; y = 580 }
    )
    $action = $null
    $result = $null
    try {
      $action = Invoke-ClickCandidatesUntilAction -Handle $scenario.Handle -ExpectedType "night-action" -Candidates $autoActionTargets
      $result = Wait-ResultAction -ActionId $action.id -TimeoutSeconds $ActionTimeoutSeconds
      if ($result.ok -ne $true) {
        throw "Night action click failed: $($result.message)"
      }
    }
    catch {
      $viewModel = Read-JsonFile $viewModelPath
      if ($viewModel.phase -eq "day" -and $viewModel.humanNightAction.available -eq $false) {
        return [pscustomobject]@{
          Name = "night-action-dialogue-advance-click"
          UnityPid = $scenario.Process.Id
          NodePids = ($scenario.NodePids -join ",")
          ActionId = ""
          ActionType = $viewModel.action.lastActionType
          Role = $viewModel.players.Where({ $_.human })[0].roleId
          Phase = $viewModel.phase
          DayStage = $viewModel.dayStage
          LastActionType = $viewModel.action.lastActionType
        }
      }
      throw
    }
    $viewModel = Read-JsonFile $viewModelPath
    if ($viewModel.action.lastActionId -ne $action.id -or $viewModel.action.lastActionType -ne "night-action") {
      throw "Night action click did not refresh Unity viewmodel with the clicked action."
    }
    if ($viewModel.phase -ne "day" -or $viewModel.humanNightAction.available -ne $false) {
      throw "Night action click did not resolve into day. phase=$($viewModel.phase), available=$($viewModel.humanNightAction.available)"
    }

    return [pscustomobject]@{
      Name = "night-action-click"
      UnityPid = $scenario.Process.Id
      NodePids = ($scenario.NodePids -join ",")
      ActionId = $action.id
      ActionType = $result.actionType
      Role = $viewModel.players.Where({ $_.human })[0].roleId
      Phase = $viewModel.phase
      DayStage = $viewModel.dayStage
      LastActionType = $viewModel.action.lastActionType
    }
  }
  finally {
    Stop-UnityScenario -UnityProcess $scenario.Process -BeforeNodeIds $scenario.BeforeNodeIds
  }
}

function Invoke-ManualNightActionClickSmoke {
  Set-ClickSmokeFlow "manual-night-action-click"
  Prepare-BridgeFreshState -ScriptId "tb" -Role "fortune-teller" -PlayerCount 9 -StateSeed ($Seed + 11)

  $scenario = Start-UnityScenario
  try {
    Start-Sleep -Milliseconds 1800
    Invoke-ContinueCurrentFromMenuClick -Scenario $scenario -SnapshotPrefix "manual-night-action-menu"
    Start-Sleep -Milliseconds 4800
    Invoke-DismissStageDialogueClick -Scenario $scenario
    Start-Sleep -Milliseconds 350
    Click-UnityWindowPoint -Handle $scenario.Handle -X 1216 -Y 669 -Label "open-bottom-action-dock"
    Start-Sleep -Milliseconds 350
    Click-UnityWindowPoint -Handle $scenario.Handle -X 875 -Y 672 -Label "open-night-action-target-bar"
    Start-Sleep -Milliseconds 700
    Capture-UnityWindowPng -Handle $scenario.Handle -PathValue (Join-Path $artifactDir "manual-night-action-before-targets.png")

    $targetViewModel = Read-JsonFile $viewModelPath
    $targetCount = [Math]::Max(1, [int]$targetViewModel.humanNightAction.minTargetCount)
    $playerCount = [Math]::Max(1, @($targetViewModel.players).Count)
    $playersById = @{}
    foreach ($player in @($targetViewModel.players)) {
      if (-not [string]::IsNullOrWhiteSpace($player.id)) {
        $playersById[$player.id] = $player
      }
    }
    $eligibleTargets = @($targetViewModel.humanNightAction.options) |
      Where-Object {
        $player = $playersById[$_.id]
        -not ($player -and $player.human -eq $true)
      }
    $preferredSeats = @(3, 1, 9, 8, 4, 5, 6, 7, 2)
    $targets = @()
    foreach ($seat in $preferredSeats) {
      $target = $eligibleTargets | Where-Object { [int]$_.seat -eq $seat } | Select-Object -First 1
      if ($target -and -not ($targets | Where-Object { $_.id -eq $target.id })) {
        $targets += $target
      }
      if ($targets.Count -ge $targetCount) {
        break
      }
    }
    foreach ($target in $eligibleTargets) {
      if ($targets.Count -ge $targetCount) {
        break
      }
      if (-not ($targets | Where-Object { $_.id -eq $target.id })) {
        $targets += $target
      }
    }
    $targets = @($targets | Select-Object -First $targetCount)
    if ($targets.Count -lt $targetCount) {
      throw "Manual night action fixture does not expose enough legal targets. needed=$targetCount, available=$($targets.Count)"
    }
    $finalTargetIds = @($targets | ForEach-Object { $_.id })
    $scratchTarget = @($eligibleTargets | Where-Object { $finalTargetIds -notcontains $_.id } | Select-Object -First 1)[0]
    if ($scratchTarget -and [int]$scratchTarget.seat -gt 0) {
      $scratchCandidate = @(Get-ActionTargetBarTokenClickCandidates -SeatIndex ([int]$scratchTarget.seat - 1) -PlayerCount $playerCount)[0]
      Click-UnityWindowPoint -Handle $scenario.Handle -X $scratchCandidate.x -Y $scratchCandidate.y -Label "fortune-teller-scratch-target-before-reselect"
      Start-Sleep -Milliseconds 300
      Capture-UnityWindowPng -Handle $scenario.Handle -PathValue (Join-Path $artifactDir "fortune-teller-scratch-target-selected.png")
      foreach ($candidate in @(
        @{ x = 965; y = 593 },
        @{ x = 952; y = 593 },
        @{ x = 978; y = 593 },
        @{ x = 965; y = 580 },
        @{ x = 965; y = 606 }
      )) {
        Click-UnityWindowPoint -Handle $scenario.Handle -X $candidate.x -Y $candidate.y -Label "fortune-teller-clear-targets"
        Start-Sleep -Milliseconds 160
      }
      Start-Sleep -Milliseconds 350
      Capture-UnityWindowPng -Handle $scenario.Handle -PathValue (Join-Path $artifactDir "fortune-teller-after-reselect-clear.png")
    }
    foreach ($target in $targets) {
      $seat = [int]$target.seat
      if ($seat -le 0) {
        throw "Manual night action target has no usable seat: $($target | ConvertTo-Json -Compress)"
      }
      $candidate = @(Get-ActionTargetBarTokenClickCandidates -SeatIndex ($seat - 1) -PlayerCount $playerCount)[0]
      Click-UnityWindowPoint -Handle $scenario.Handle -X $candidate.x -Y $candidate.y -Label "fortune-teller-final-target"
      Start-Sleep -Milliseconds 250
    }
    Start-Sleep -Milliseconds 500
    Capture-UnityWindowPng -Handle $scenario.Handle -PathValue (Join-Path $artifactDir "manual-night-action-targets-selected.png")
    $manualSubmitTargets = @(
      @{ x = 397; y = 610 },
      @{ x = 388; y = 610 },
      @{ x = 406; y = 610 },
      @{ x = 397; y = 598 },
      @{ x = 397; y = 622 },
      @{ x = 1028; y = 644 },
      @{ x = 1014; y = 644 },
      @{ x = 1042; y = 644 },
      @{ x = 1028; y = 632 },
      @{ x = 1028; y = 656 }
    )
    $action = Invoke-ClickCandidatesUntilAction -Handle $scenario.Handle -ExpectedType "night-action" -Candidates $manualSubmitTargets
    $actionTargetIds = @($action.payload.targetIds)
    foreach ($target in $targets) {
      if ($actionTargetIds -notcontains $target.id) {
        throw "Manual night action payload missed selected target '$($target.id)'. payload=$($action | ConvertTo-Json -Compress)"
      }
    }
    $result = Wait-ResultAction -ActionId $action.id -TimeoutSeconds $ActionTimeoutSeconds
    if ($result.ok -ne $true) {
      throw "Manual night action click failed: $($result.message)"
    }
    $viewModel = Read-JsonFile $viewModelPath
    if ($viewModel.action.lastActionId -ne $action.id -or $viewModel.action.lastActionType -ne "night-action") {
      throw "Manual night action click did not refresh Unity viewmodel with the clicked action."
    }
    if ($viewModel.phase -ne "day" -or $viewModel.humanNightAction.available -ne $false) {
      throw "Manual night action click did not resolve into day. phase=$($viewModel.phase), available=$($viewModel.humanNightAction.available)"
    }

    return [pscustomobject]@{
      Name = "manual-night-action-click"
      UnityPid = $scenario.Process.Id
      NodePids = ($scenario.NodePids -join ",")
      ActionId = $action.id
      ActionType = $result.actionType
      TargetIds = ($actionTargetIds -join ",")
      Phase = $viewModel.phase
      DayStage = $viewModel.dayStage
      LastActionType = $viewModel.action.lastActionType
    }
  }
  finally {
    Stop-UnityScenario -UnityProcess $scenario.Process -BeforeNodeIds $scenario.BeforeNodeIds
  }
}

function Invoke-FlowAdvanceClickSmoke {
  Set-ClickSmokeFlow "flow-advance-click"
  Prepare-SmokeFixture "phase-assist-public"
  Remove-BridgeFiles

  $scenario = Start-UnityScenario
  try {
    Start-Sleep -Milliseconds 1800
    Invoke-ContinueCurrentFromMenuClick -Scenario $scenario -SnapshotPrefix "flow-advance-menu"
    Invoke-DismissStageDialogueClick -Scenario $scenario
    Start-Sleep -Milliseconds 500
    Capture-UnityWindowPng -Handle $scenario.Handle -PathValue (Join-Path $artifactDir "flow-advance-before-click.png")
    $action = $null
    $viewModel = $null
    foreach ($candidate in @(
      @{ x = 764; y = 92; label = "flow-open-nomination" },
      @{ x = 752; y = 92; label = "flow-open-nomination" },
      @{ x = 776; y = 92; label = "flow-open-nomination" },
      @{ x = 764; y = 91; label = "flow-open-nomination-legacy" },
      @{ x = 752; y = 91; label = "flow-open-nomination-legacy" },
      @{ x = 776; y = 91; label = "flow-open-nomination-legacy" }
    )) {
      Click-UnityWindowPoint -Handle $scenario.Handle -X $candidate.x -Y $candidate.y -Label $candidate.label
      try {
        $action = Wait-ActionFile -ExpectedType "open-nomination-window" -TimeoutSeconds 1
        break
      }
      catch {
        $viewModel = Wait-NominationFlowOpen -TimeoutSeconds 2
        if ($null -ne $viewModel) {
          break
        }
      }
    }

    $result = $null
    if ($null -ne $action) {
      $result = Wait-ResultAction -ActionId $action.id -TimeoutSeconds $ActionTimeoutSeconds
      if ($result.ok -ne $true) {
        throw "Flow advance click failed: $($result.message)"
      }
    }
    if ($null -eq $viewModel) {
      $viewModel = Wait-NominationFlowOpen -TimeoutSeconds $ActionTimeoutSeconds
    }
    if ($null -eq $viewModel) {
      throw "Flow advance click did not enter nomination before timeout."
    }
    if ($viewModel.phase -ne "day" -or $viewModel.dayStage -ne "nomination" -or (Test-NominationFlowOpen -ViewModel $viewModel) -ne $true) {
      throw "Flow advance click did not enter nomination. phase=$($viewModel.phase), dayStage=$($viewModel.dayStage)"
    }

    return [pscustomobject]@{
      Name = "flow-advance-click"
      UnityPid = $scenario.Process.Id
      NodePids = ($scenario.NodePids -join ",")
      ActionId = if ($null -ne $action) { $action.id } else { $viewModel.action.lastActionId }
      ActionType = if ($null -ne $result) { $result.actionType } else { $viewModel.action.lastActionType }
      Phase = $viewModel.phase
      DayStage = $viewModel.dayStage
      LastActionType = $viewModel.action.lastActionType
    }
  }
  finally {
    Stop-UnityScenario -UnityProcess $scenario.Process -BeforeNodeIds $scenario.BeforeNodeIds
  }
}

function Invoke-ProactiveQueueClickSmoke {
  Set-ClickSmokeFlow "proactive-queue-click"
  Prepare-SmokeFixture "proactive-whisper-queue"
  Remove-BridgeFiles

  $scenario = Start-UnityScenario
  try {
    Start-Sleep -Milliseconds 1800
    Invoke-ContinueCurrentFromMenuClick -Scenario $scenario -SnapshotPrefix "proactive-queue-menu"
    Invoke-DismissStageDialogueClick -Scenario $scenario
    Start-Sleep -Milliseconds 700
    Capture-UnityWindowPng -Handle $scenario.Handle -PathValue (Join-Path $artifactDir "proactive-queue-before-accept.png")

    $acceptAction = Invoke-ClickCandidatesUntilAction `
      -Handle $scenario.Handle `
      -ExpectedType "accept-proactive-whisper" `
      -Candidates @(
        @{ x = 1220; y = 489; label = "accept-proactive-row-1280" },
        @{ x = 1233; y = 489; label = "accept-proactive-row-1280-right" },
        @{ x = 1208; y = 489; label = "accept-proactive-row-1280-left" },
        @{ x = 1136; y = 562; label = "accept-proactive-footer-1280" },
        @{ x = 1148; y = 562; label = "accept-proactive-footer-1280-right" },
        @{ x = 1184; y = 512; label = "accept-proactive-row-responsive" },
        @{ x = 1174; y = 512; label = "accept-proactive-row-responsive-left" },
        @{ x = 1184; y = 536; label = "accept-proactive-row-responsive-low" }
      )
    $acceptResult = Wait-ResultAction -ActionId $acceptAction.id -TimeoutSeconds $ActionTimeoutSeconds
    if ($acceptResult.ok -ne $true) {
      throw "Proactive whisper accept click failed: $($acceptResult.message)"
    }
    $acceptedViewModel = Read-JsonFile $viewModelPath
    if ($acceptedViewModel.action.lastActionId -ne $acceptAction.id -or $acceptedViewModel.action.lastActionType -ne "accept-proactive-whisper") {
      throw "Proactive accept click did not refresh Unity viewmodel with the clicked action."
    }
    if (@($acceptedViewModel.pendingProactiveWhispers).Count -ne 1) {
      throw "Proactive accept should leave exactly one pending invite. pending=$(@($acceptedViewModel.pendingProactiveWhispers).Count)"
    }
    Capture-UnityWindowPng -Handle $scenario.Handle -PathValue (Join-Path $artifactDir "proactive-queue-after-accept-private-chat.png")

    Invoke-DismissStageDialogueClick -Scenario $scenario
    foreach ($candidate in @(
      @{ x = 1047; y = 621 },
      @{ x = 1028; y = 621 },
      @{ x = 1064; y = 621 }
    )) {
      Click-UnityWindowPoint -Handle $scenario.Handle -X $candidate.x -Y $candidate.y -Label "close-private-chat-after-proactive-accept"
      Start-Sleep -Milliseconds 180
    }
    Start-Sleep -Milliseconds 500
    Capture-UnityWindowPng -Handle $scenario.Handle -PathValue (Join-Path $artifactDir "proactive-queue-before-reject-second.png")
    Remove-BridgeFiles

    $declineAction = Invoke-ClickCandidatesUntilAction `
      -Handle $scenario.Handle `
      -ExpectedType "decline-proactive-whisper" `
      -Candidates @(
        @{ x = 1266; y = 562; label = "decline-proactive-footer-1280" },
        @{ x = 1268; y = 489; label = "decline-proactive-row-1280" },
        @{ x = 1254; y = 562; label = "decline-proactive-footer-1280-left" },
        @{ x = 1276; y = 562; label = "decline-proactive-footer-1280-right" },
        @{ x = 1256; y = 489; label = "decline-proactive-row-1280-left" },
        @{ x = 1234; y = 512; label = "decline-proactive-row-responsive" },
        @{ x = 1244; y = 512; label = "decline-proactive-row-responsive-right" },
        @{ x = 1234; y = 536; label = "decline-proactive-row-responsive-low" },
        @{ x = 1220; y = 598; label = "decline-proactive-footer-responsive-center" },
        @{ x = 1234; y = 598; label = "decline-proactive-footer-responsive-center-right" },
        @{ x = 1234; y = 626; label = "decline-proactive-footer-responsive" },
        @{ x = 1218; y = 626; label = "decline-proactive-footer-responsive-left" }
      )
    $declineResult = Wait-ResultAction -ActionId $declineAction.id -TimeoutSeconds $ActionTimeoutSeconds
    if ($declineResult.ok -ne $true) {
      throw "Proactive whisper reject click failed: $($declineResult.message)"
    }
    $declinedViewModel = Read-JsonFile $viewModelPath
    if ($declinedViewModel.action.lastActionId -ne $declineAction.id -or $declinedViewModel.action.lastActionType -ne "decline-proactive-whisper") {
      throw "Proactive reject click did not refresh Unity viewmodel with the clicked action."
    }
    if (@($declinedViewModel.pendingProactiveWhispers).Count -ne 0) {
      throw "Proactive reject should clear the final pending invite. pending=$(@($declinedViewModel.pendingProactiveWhispers).Count)"
    }
    Capture-UnityWindowPng -Handle $scenario.Handle -PathValue (Join-Path $artifactDir "proactive-queue-after-reject.png")

    return [pscustomobject]@{
      Name = "proactive-queue-click"
      UnityPid = $scenario.Process.Id
      NodePids = ($scenario.NodePids -join ",")
      AcceptActionId = $acceptAction.id
      RejectActionId = $declineAction.id
      PendingAfterAccept = @($acceptedViewModel.pendingProactiveWhispers).Count
      PendingAfterReject = @($declinedViewModel.pendingProactiveWhispers).Count
      LastActionType = $declinedViewModel.action.lastActionType
    }
  }
  finally {
    Stop-UnityScenario -UnityProcess $scenario.Process -BeforeNodeIds $scenario.BeforeNodeIds
  }
}

function Invoke-ClearProactiveWhisperQueueForSmoke {
  param(
    [pscustomobject]$Scenario,
    [string]$SnapshotPrefix
  )

  $viewModel = Read-JsonFile $viewModelPath
  $remaining = @($viewModel.pendingProactiveWhispers).Count
  $cleared = 0
  while ($remaining -gt 0 -and $cleared -lt 6) {
    Capture-UnityWindowPng -Handle $Scenario.Handle -PathValue (Join-Path $artifactDir "$SnapshotPrefix-proactive-before-clear-$cleared.png")
    Remove-BridgeFiles
    $declineAction = Invoke-ClickCandidatesUntilAction `
      -Handle $Scenario.Handle `
      -ExpectedType "decline-proactive-whisper" `
      -Candidates @(
        @{ x = 1266; y = 562; label = "$SnapshotPrefix-decline-proactive-footer-1280" },
        @{ x = 1268; y = 489; label = "$SnapshotPrefix-decline-proactive-row-1280" },
        @{ x = 1254; y = 562; label = "$SnapshotPrefix-decline-proactive-footer-1280-left" },
        @{ x = 1276; y = 562; label = "$SnapshotPrefix-decline-proactive-footer-1280-right" },
        @{ x = 1256; y = 489; label = "$SnapshotPrefix-decline-proactive-row-1280-left" },
        @{ x = 1234; y = 512; label = "$SnapshotPrefix-decline-proactive-row-responsive" },
        @{ x = 1244; y = 512; label = "$SnapshotPrefix-decline-proactive-row-responsive-right" },
        @{ x = 1234; y = 536; label = "$SnapshotPrefix-decline-proactive-row-responsive-low" },
        @{ x = 1220; y = 598; label = "$SnapshotPrefix-decline-proactive-footer-responsive-center" },
        @{ x = 1234; y = 598; label = "$SnapshotPrefix-decline-proactive-footer-responsive-center-right" },
        @{ x = 1234; y = 626; label = "$SnapshotPrefix-decline-proactive-footer-responsive" },
        @{ x = 1218; y = 626; label = "$SnapshotPrefix-decline-proactive-footer-responsive-left" }
      )
    $declineResult = Wait-ResultAction -ActionId $declineAction.id -TimeoutSeconds $ActionTimeoutSeconds
    if ($declineResult.ok -ne $true) {
      throw "Smoke proactive invite cleanup failed: $($declineResult.message)"
    }
    Start-Sleep -Milliseconds 500
    $viewModel = Read-JsonFile $viewModelPath
    $remaining = @($viewModel.pendingProactiveWhispers).Count
    $cleared += 1
  }

  if ($remaining -gt 0) {
    throw "Smoke proactive invite cleanup left $remaining pending invites."
  }
  if ($cleared -gt 0) {
    Capture-UnityWindowPng -Handle $Scenario.Handle -PathValue (Join-Path $artifactDir "$SnapshotPrefix-proactive-after-clear.png")
    Remove-BridgeFiles
  }
  return $cleared
}

function Invoke-OpenPrivateChatPanelFromDockClick {
  param(
    [pscustomobject]$Scenario,
    [string]$SnapshotPrefix
  )

  foreach ($candidate in @(
    @{ x = 1207; y = 669 },
    @{ x = 1216; y = 669 },
    @{ x = 1198; y = 669 }
  )) {
    Click-UnityWindowPoint -Handle $Scenario.Handle -X $candidate.x -Y $candidate.y -Label "$SnapshotPrefix-open-action-dock"
    Start-Sleep -Milliseconds 180
  }
  Capture-UnityWindowPng -Handle $Scenario.Handle -PathValue (Join-Path $artifactDir "$SnapshotPrefix-action-dock-open.png")
  Click-UnityWindowPoint -Handle $Scenario.Handle -X 873 -Y 636 -Label "$SnapshotPrefix-open-private-chat-panel"
  Start-Sleep -Milliseconds 500
  Capture-UnityWindowPng -Handle $Scenario.Handle -PathValue (Join-Path $artifactDir "$SnapshotPrefix-panel-open.png")
}

function Invoke-SelectAlternatePrivateChatTargetClick {
  param(
    [pscustomobject]$Scenario,
    [string]$SnapshotPrefix
  )

  $viewModel = Read-JsonFile $viewModelPath
  $currentTargetId = "$($viewModel.action.selectedPlayerId)"
  $players = @($viewModel.players)
  $target = $players |
    Where-Object { $_ -ne $null -and $_.human -ne $true -and $_.alive -eq $true -and "$($_.id)" -ne $currentTargetId } |
    Sort-Object seat |
    Select-Object -First 1
  if ($null -eq $target) {
    throw "Private chat text smoke could not find an alternate living AI target."
  }

  $targetIndex = [Array]::IndexOf(@($players | ForEach-Object { "$($_.id)" }), "$($target.id)")
  if ($targetIndex -lt 0) {
    throw "Private chat text smoke could not map target '$($target.id)' into the Unity player ring."
  }
  $candidates = @(Get-GrimoireTokenClickCandidates -TokenIndex $targetIndex -PlayerCount $players.Count)
  foreach ($candidate in $candidates | Select-Object -First 3) {
    Click-UnityWindowPoint -Handle $Scenario.Handle -X $candidate.x -Y $candidate.y -Label "$SnapshotPrefix-select-text-target"
    Start-Sleep -Milliseconds 180
  }
  Start-Sleep -Milliseconds 500
  Capture-UnityWindowPng -Handle $Scenario.Handle -PathValue (Join-Path $artifactDir "$SnapshotPrefix-selected-text-target.png")
  Remove-BridgeFiles
  return $target
}

function Invoke-PrivateChatPanelClickSmoke {
  Set-ClickSmokeFlow "private-chat-panel-click"
  Prepare-SmokeFixture "private-chat"
  Remove-BridgeFiles

  $scenario = Start-UnityScenario
  try {
    Start-Sleep -Milliseconds 1800
    Invoke-ContinueCurrentFromMenuClick -Scenario $scenario -SnapshotPrefix "private-chat-menu"
    Invoke-DismissStageDialogueClick -Scenario $scenario
    Start-Sleep -Milliseconds 500
    Capture-UnityWindowPng -Handle $scenario.Handle -PathValue (Join-Path $artifactDir "private-chat-before-open.png")
    [void](Invoke-ClearProactiveWhisperQueueForSmoke -Scenario $scenario -SnapshotPrefix "private-chat")
    Invoke-OpenPrivateChatPanelFromDockClick -Scenario $scenario -SnapshotPrefix "private-chat"

    $claimAction = Invoke-ClickCandidatesUntilAction `
      -Handle $scenario.Handle `
      -ExpectedType "private-chat" `
      -Candidates @(
        @{ x = 853; y = 621 },
        @{ x = 845; y = 621 },
        @{ x = 862; y = 621 },
        @{ x = 536; y = 521 }
      )
    $claimResult = Wait-ResultAction -ActionId $claimAction.id -TimeoutSeconds $ActionTimeoutSeconds
    if ($claimResult.ok -ne $true) {
      throw "Private quick-question click failed: $($claimResult.message)"
    }
    if ($claimAction.payload.intent -ne "claim") {
      throw "Private quick question should submit claim intent. payload=$($claimAction.payload | ConvertTo-Json -Compress)"
    }
    Capture-UnityWindowPng -Handle $scenario.Handle -PathValue (Join-Path $artifactDir "private-chat-after-quick-question.png")
    Remove-BridgeFiles

    foreach ($candidate in @(
      @{ x = 1047; y = 621 },
      @{ x = 1028; y = 621 },
      @{ x = 1064; y = 621 }
    )) {
      Click-UnityWindowPoint -Handle $scenario.Handle -X $candidate.x -Y $candidate.y -Label "close-private-chat-before-text-target"
      Start-Sleep -Milliseconds 180
    }
    Start-Sleep -Milliseconds 400
    [void](Invoke-SelectAlternatePrivateChatTargetClick -Scenario $scenario -SnapshotPrefix "private-chat")
    Invoke-OpenPrivateChatPanelFromDockClick -Scenario $scenario -SnapshotPrefix "private-chat-text"

    $typedNightInfo = "BOTC"
    Click-UnityWindowPoint -Handle $scenario.Handle -X 719 -Y 558 -Label "private-chat-text-input"
    Type-UnityText -Handle $scenario.Handle -Text $typedNightInfo
    Start-Sleep -Milliseconds 220
    Capture-UnityWindowPng -Handle $scenario.Handle -PathValue (Join-Path $artifactDir "private-chat-before-send-text.png")
    $sendAction = Invoke-ClickCandidatesUntilAction `
      -Handle $scenario.Handle `
      -ExpectedType "private-chat" `
      -Candidates @(
        @{ x = 953; y = 621 },
        @{ x = 944; y = 621 },
        @{ x = 962; y = 621 }
      )
    $sendResult = Wait-ResultAction -ActionId $sendAction.id -TimeoutSeconds $ActionTimeoutSeconds
    if ($sendResult.ok -ne $true) {
      throw "Private text send click failed: $($sendResult.message)"
    }
    if ("$($sendAction.payload.nightInfo)" -notmatch $typedNightInfo) {
      throw "Private text send payload did not include typed text. payload=$($sendAction.payload | ConvertTo-Json -Compress)"
    }
    $viewModel = Read-JsonFile $viewModelPath
    Capture-UnityWindowPng -Handle $scenario.Handle -PathValue (Join-Path $artifactDir "private-chat-after-send-text.png")

    foreach ($candidate in @(
      @{ x = 1047; y = 621 },
      @{ x = 1100; y = 177 },
      @{ x = 1028; y = 621 }
    )) {
      Click-UnityWindowPoint -Handle $scenario.Handle -X $candidate.x -Y $candidate.y -Label "close-private-chat-panel"
      Start-Sleep -Milliseconds 180
    }
    Start-Sleep -Milliseconds 400
    Capture-UnityWindowPng -Handle $scenario.Handle -PathValue (Join-Path $artifactDir "private-chat-after-close.png")

    return [pscustomobject]@{
      Name = "private-chat-panel-click"
      UnityPid = $scenario.Process.Id
      NodePids = ($scenario.NodePids -join ",")
      QuickQuestionActionId = $claimAction.id
      SendActionId = $sendAction.id
      TimelineEntries = @($viewModel.timeline).Count
      LastActionType = $viewModel.action.lastActionType
    }
  }
  finally {
    Stop-UnityScenario -UnityProcess $scenario.Process -BeforeNodeIds $scenario.BeforeNodeIds
  }
}

function Invoke-PublicDiscussionClickSmoke {
  Set-ClickSmokeFlow "public-discussion-click"
  Prepare-SmokeFixture "phase-assist-public"
  Remove-BridgeFiles

  $scenario = Start-UnityScenario
  try {
    Start-Sleep -Milliseconds 1800
    Invoke-ContinueCurrentFromMenuClick -Scenario $scenario -SnapshotPrefix "public-discussion-menu"
    Invoke-DismissStageDialogueClick -Scenario $scenario
    Start-Sleep -Milliseconds 600
    Capture-UnityWindowPng -Handle $scenario.Handle -PathValue (Join-Path $artifactDir "public-discussion-before-player-input.png")

    Click-UnityWindowPoint -Handle $scenario.Handle -X 465 -Y 92 -Label "public-discussion-text-input"
    Type-UnityText -Handle $scenario.Handle -Text "BOTC"
    Start-Sleep -Milliseconds 200
    Capture-UnityWindowPng -Handle $scenario.Handle -PathValue (Join-Path $artifactDir "public-discussion-before-player-send.png")
    $humanSpeechAction = Invoke-ClickCandidatesUntilAction `
      -Handle $scenario.Handle `
      -ExpectedType "human-public-speech" `
      -Candidates @(
        @{ x = 839; y = 92 },
        @{ x = 826; y = 92 },
        @{ x = 852; y = 92 }
      )
    $humanSpeechResult = Wait-ResultAction -ActionId $humanSpeechAction.id -TimeoutSeconds $ActionTimeoutSeconds
    if ($humanSpeechResult.ok -ne $true) {
      throw "Public player speech click failed: $($humanSpeechResult.message)"
    }
    Capture-UnityWindowPng -Handle $scenario.Handle -PathValue (Join-Path $artifactDir "public-discussion-after-player-speech.png")
    Remove-BridgeFiles

    $aiSpeechAction = Invoke-ClickCandidatesUntilAction `
      -Handle $scenario.Handle `
      -ExpectedType "auto-advance" `
      -Candidates @(
        @{ x = 689; y = 92 },
        @{ x = 676; y = 92 },
        @{ x = 702; y = 92 }
      )
    $aiSpeechResult = Wait-ResultAction -ActionId $aiSpeechAction.id -TimeoutSeconds $ActionTimeoutSeconds
    if ($aiSpeechResult.ok -ne $true) {
      throw "Public AI speech click failed: $($aiSpeechResult.message)"
    }
    $aiSteps = @($aiSpeechResult.autoAdvance.steps | Where-Object { $_.type -eq "ai-public-step" })
    if ($aiSteps.Count -lt 1) {
      throw "Public AI speech click did not run an ai-public-step. result=$($aiSpeechResult | ConvertTo-Json -Depth 8 -Compress)"
    }
    Capture-UnityWindowPng -Handle $scenario.Handle -PathValue (Join-Path $artifactDir "public-discussion-after-ai-speech.png")
    Remove-BridgeFiles

    $nominationActionId = ""
    $nominationOpenedBy = "ai-auto-advance"
    $viewModel = Wait-NominationFlowOpen -TimeoutSeconds 2
    if ($null -eq $viewModel) {
      $nominationOpenedBy = "open-nomination-window"
      $nominationAction = Invoke-ClickCandidatesUntilAction `
        -Handle $scenario.Handle `
        -ExpectedType "open-nomination-window" `
        -Candidates @(
          @{ x = 764; y = 92 },
          @{ x = 752; y = 92 },
          @{ x = 776; y = 92 }
        )
      $nominationActionId = $nominationAction.id
      $nominationResult = Wait-ResultAction -ActionId $nominationAction.id -TimeoutSeconds $ActionTimeoutSeconds
      if ($nominationResult.ok -ne $true) {
        throw "Open nomination click failed from public discussion: $($nominationResult.message)"
      }
      $viewModel = Wait-NominationFlowOpen -TimeoutSeconds $ActionTimeoutSeconds
    }
    if (-not (Test-NominationFlowOpen -ViewModel $viewModel)) {
      throw "Open nomination click did not enter an active nomination window. phase=$($viewModel.phase), dayStage=$($viewModel.dayStage)"
    }
    Invoke-DismissStageDialogueClick -Scenario $scenario
    Capture-UnityWindowPng -Handle $scenario.Handle -PathValue (Join-Path $artifactDir "public-discussion-opened-nomination-window.png")

    return [pscustomobject]@{
      Name = "public-discussion-click"
      UnityPid = $scenario.Process.Id
      NodePids = ($scenario.NodePids -join ",")
      HumanSpeechActionId = $humanSpeechAction.id
      AiSpeechActionId = $aiSpeechAction.id
      NominationActionId = $nominationActionId
      NominationOpenedBy = $nominationOpenedBy
      AiPublicSteps = $aiSteps.Count
      FinalPhase = $viewModel.phase
      FinalDayStage = $viewModel.dayStage
      LastActionType = $viewModel.action.lastActionType
    }
  }
  finally {
    Stop-UnityScenario -UnityProcess $scenario.Process -BeforeNodeIds $scenario.BeforeNodeIds
  }
}

function Invoke-AiNominationClickSmoke {
  Set-ClickSmokeFlow "ai-nomination-click"
  Prepare-SmokeFixture "nomination-window-pass"
  Remove-BridgeFiles

  $scenario = Start-UnityScenario
  try {
    Start-Sleep -Milliseconds 1800
    Invoke-ContinueCurrentFromMenuClick -Scenario $scenario -SnapshotPrefix "ai-nomination-menu"
    Invoke-DismissStageDialogueClick -Scenario $scenario
    Start-Sleep -Milliseconds 600
    Capture-UnityWindowPng -Handle $scenario.Handle -PathValue (Join-Path $artifactDir "ai-nomination-before-click.png")
    $action = Invoke-ClickCandidatesUntilAction `
      -Handle $scenario.Handle `
      -ExpectedType "auto-advance" `
      -Candidates @(
        @{ x = 689; y = 92 },
        @{ x = 676; y = 92 },
        @{ x = 702; y = 92 }
      )
    $result = Wait-ResultAction -ActionId $action.id -TimeoutSeconds $ActionTimeoutSeconds
    if ($result.ok -ne $true) {
      throw "AI nomination click failed: $($result.message)"
    }
    $nominationSteps = @($result.autoAdvance.steps | Where-Object { $_.type -eq "ai-nomination-step" })
    if ($nominationSteps.Count -lt 1) {
      throw "AI nomination click did not produce an ai-nomination-step. result=$($result | ConvertTo-Json -Depth 8 -Compress)"
    }
    $viewModel = Read-JsonFile $viewModelPath
    if ($viewModel.nominationDebate.active -ne $true) {
      throw "AI nomination click did not open a nomination debate."
    }
    Capture-UnityWindowPng -Handle $scenario.Handle -PathValue (Join-Path $artifactDir "ai-nomination-after-click.png")
    return [pscustomobject]@{
      Name = "ai-nomination-click"
      UnityPid = $scenario.Process.Id
      NodePids = ($scenario.NodePids -join ",")
      ActionId = $action.id
      AiNominationSteps = $nominationSteps.Count
      Nominator = $viewModel.nominationDebate.nominatorName
      Nominee = $viewModel.nominationDebate.nomineeName
      LastActionType = $viewModel.action.lastActionType
    }
  }
  finally {
    Stop-UnityScenario -UnityProcess $scenario.Process -BeforeNodeIds $scenario.BeforeNodeIds
  }
}

function Invoke-PassNominationClickSmoke {
  Set-ClickSmokeFlow "pass-nomination-click"
  Prepare-SmokeFixture "nomination-window-pass"
  Remove-BridgeFiles

  $scenario = Start-UnityScenario
  try {
    Start-Sleep -Milliseconds 1800
    Invoke-ContinueCurrentFromMenuClick -Scenario $scenario -SnapshotPrefix "pass-nomination-menu"
    Invoke-DismissStageDialogueClick -Scenario $scenario
    Start-Sleep -Milliseconds 600
    Capture-UnityWindowPng -Handle $scenario.Handle -PathValue (Join-Path $artifactDir "pass-nomination-before-click.png")
    $action = Invoke-ClickCandidatesUntilAction `
      -Handle $scenario.Handle `
      -ExpectedType "pass-nomination-window" `
      -Candidates @(
        @{ x = 839; y = 92 },
        @{ x = 826; y = 92 },
        @{ x = 852; y = 92 }
      )
    $result = Wait-ResultAction -ActionId $action.id -TimeoutSeconds $ActionTimeoutSeconds
    if ($result.ok -ne $true) {
      throw "Pass nomination click failed: $($result.message)"
    }
    $viewModel = Read-JsonFile $viewModelPath
    if ($viewModel.nominationClock.status -ne "passed") {
      throw "Pass nomination click did not mark the window passed. status=$($viewModel.nominationClock.status)"
    }
    Capture-UnityWindowPng -Handle $scenario.Handle -PathValue (Join-Path $artifactDir "pass-nomination-after-click.png")
    return [pscustomobject]@{
      Name = "pass-nomination-click"
      UnityPid = $scenario.Process.Id
      NodePids = ($scenario.NodePids -join ",")
      ActionId = $action.id
      Status = $viewModel.nominationClock.status
      LastActionType = $viewModel.action.lastActionType
    }
  }
  finally {
    Stop-UnityScenario -UnityProcess $scenario.Process -BeforeNodeIds $scenario.BeforeNodeIds
  }
}

function Invoke-InfoDrawerTabsClickSmoke {
  Set-ClickSmokeFlow "info-drawer-tabs-click"
  $fixtureName = if ($InfoDrawerPublicFixture) { "information-drawer-public" } else { "information-drawer" }
  Prepare-SmokeFixture $fixtureName
  Remove-BridgeFiles

  $scenario = Start-UnityScenario
  try {
    Start-Sleep -Milliseconds 1800
    Invoke-ContinueCurrentFromMenuClick -Scenario $scenario -SnapshotPrefix "info-drawer-menu"
    Invoke-DismissStageDialogueClick -Scenario $scenario
    Start-Sleep -Milliseconds 600
    Invoke-ClearProactiveWhisperQueueForSmoke -Scenario $scenario -SnapshotPrefix "info-drawer"
    Start-Sleep -Milliseconds 400
    Capture-UnityWindowPng -Handle $scenario.Handle -PathValue (Join-Path $artifactDir "info-drawer-before-open.png")
    foreach ($candidate in @(
      @{ x = 1216; y = 311 },
      @{ x = 1216; y = 298 },
      @{ x = 1204; y = 311 }
    )) {
      Click-UnityWindowPoint -Handle $scenario.Handle -X $candidate.x -Y $candidate.y -Label "open-info-drawer-events"
      Start-Sleep -Milliseconds 180
    }
    Start-Sleep -Milliseconds 600
    Capture-UnityWindowPng -Handle $scenario.Handle -PathValue (Join-Path $artifactDir "info-drawer-events-tab.png")

    $tabs = @(
      @{ Name = "whispers"; X = 958; Y = 205; File = "info-drawer-whispers-tab.png" },
      @{ Name = "public"; X = 1026; Y = 205; File = "info-drawer-public-tab.png" },
      @{ Name = "clues"; X = 1093; Y = 205; File = "info-drawer-clues-tab.png" },
      @{ Name = "events"; X = 892; Y = 205; File = "info-drawer-events-tab-return.png" }
    )
    foreach ($tab in $tabs) {
      Click-UnityWindowPoint -Handle $scenario.Handle -X $tab.X -Y $tab.Y -Label "info-drawer-tab-$($tab.Name)"
      Start-Sleep -Milliseconds 420
      Capture-UnityWindowPng -Handle $scenario.Handle -PathValue (Join-Path $artifactDir $tab.File)
    }
    $viewModel = Read-JsonFile $viewModelPath
    return [pscustomobject]@{
      Name = "info-drawer-tabs-click"
      UnityPid = $scenario.Process.Id
      NodePids = ($scenario.NodePids -join ",")
      TimelineEntries = @($viewModel.timeline).Count
      PrivateInfoLines = @($viewModel.privateInfo).Count
      LastActionType = $viewModel.action.lastActionType
    }
  }
  finally {
    Stop-UnityScenario -UnityProcess $scenario.Process -BeforeNodeIds $scenario.BeforeNodeIds
  }
}

function Invoke-NominationVoteClickSmoke {
  Set-ClickSmokeFlow "nomination-vote-click"
  Prepare-SmokeFixture "nomination-debate"
  Remove-BridgeFiles

  $scenario = Start-UnityScenario
  try {
    Start-Sleep -Milliseconds 1800
    Invoke-ContinueCurrentFromMenuClick -Scenario $scenario -SnapshotPrefix "nomination-vote-menu"
    Click-UnityWindowPoint -Handle $scenario.Handle -X 1028 -Y 574
    Start-Sleep -Milliseconds 500
    Capture-UnityWindowPng -Handle $scenario.Handle -PathValue (Join-Path $artifactDir "nomination-vote-before-click.png")
    Click-UnityWindowPoint -Handle $scenario.Handle -X 1060 -Y 365
    $action = Wait-ActionFile -ExpectedType "resolve-nomination-vote" -TimeoutSeconds $ActionTimeoutSeconds
    $result = Wait-ResultAction -ActionId $action.id -TimeoutSeconds $ActionTimeoutSeconds
    if ($result.ok -ne $true) {
      throw "Nomination vote click failed: $($result.message)"
    }
    $viewModel = Read-JsonFile $viewModelPath
    if ($viewModel.action.lastActionId -ne $action.id -or $viewModel.action.lastActionType -ne "resolve-nomination-vote") {
      throw "Nomination vote click did not refresh Unity viewmodel with the clicked action."
    }
    if ($null -eq $viewModel.voteCeremony -or [string]::IsNullOrWhiteSpace($viewModel.voteCeremony.nomineeId)) {
      throw "Nomination vote click did not create a vote ceremony."
    }
    $votePassed = $viewModel.voteCeremony.passed
    $yesVotes = $viewModel.voteCeremony.yesVotes
    $nomineeName = $viewModel.voteCeremony.nomineeName

    Start-Sleep -Milliseconds 700
    $nightAction = Invoke-EndDayFromNominationClick -Scenario $scenario -SnapshotName "end-day-before-click.png"
    $nightResult = Wait-ResultAction -ActionId $nightAction.id -TimeoutSeconds $ActionTimeoutSeconds
    if ($nightResult.ok -ne $true) {
      throw "End-day flow click failed: $($nightResult.message)"
    }
    $nightViewModel = Read-JsonFile $viewModelPath
    if ($nightViewModel.action.lastActionId -ne $nightAction.id -or @("phase", "pass-nomination-window", "auto-advance") -notcontains $nightViewModel.action.lastActionType) {
      throw "End-day flow click did not refresh Unity viewmodel with the clicked action."
    }
    if ($nightViewModel.phase -ne "night") {
      throw "End-day flow click did not enter night. phase=$($nightViewModel.phase), dayStage=$($nightViewModel.dayStage)"
    }

    return [pscustomobject]@{
      Name = "nomination-vote-click"
      UnityPid = $scenario.Process.Id
      NodePids = ($scenario.NodePids -join ",")
      ActionId = $action.id
      ActionType = $result.actionType
      Nominee = $nomineeName
      VotePassed = $votePassed
      YesVotes = $yesVotes
      EndDayActionId = $nightAction.id
      FinalPhase = $nightViewModel.phase
      FinalDayStage = $nightViewModel.dayStage
      LastActionType = $nightViewModel.action.lastActionType
    }
  }
  finally {
    Stop-UnityScenario -UnityProcess $scenario.Process -BeforeNodeIds $scenario.BeforeNodeIds
  }
}

function Invoke-PassingNominationVoteClickSmoke {
  Set-ClickSmokeFlow "passing-nomination-vote-click"
  Prepare-SmokeFixture "nomination-debate-pass"
  Remove-BridgeFiles
  $beforeStateEnvelope = Read-JsonFile $statePath
  $debate = $beforeStateEnvelope.state.dayStageMeta.nominationDebate
  if ($null -eq $debate -or $debate.active -ne $true -or [string]::IsNullOrWhiteSpace($debate.nomineeId)) {
    throw "Passing nomination fixture did not create an active debate."
  }

  $scenario = Start-UnityScenario
  try {
    Start-Sleep -Milliseconds 1800
    Invoke-ContinueCurrentFromMenuClick -Scenario $scenario -SnapshotPrefix "passing-nomination-menu"
    Click-UnityWindowPoint -Handle $scenario.Handle -X 1028 -Y 574
    Start-Sleep -Milliseconds 500
    Capture-UnityWindowPng -Handle $scenario.Handle -PathValue (Join-Path $artifactDir "passing-nomination-before-click.png")
    $passingVoteYesTargets = @(
      @{ x = 1060; y = 365 },
      @{ x = 1060; y = 352 },
      @{ x = 1060; y = 378 },
      @{ x = 1040; y = 365 },
      @{ x = 1080; y = 365 }
    )
    $action = Invoke-ClickCandidatesUntilAction -Handle $scenario.Handle -ExpectedType "resolve-nomination-vote" -Candidates $passingVoteYesTargets
    $result = Wait-ResultAction -ActionId $action.id -TimeoutSeconds $ActionTimeoutSeconds
    if ($result.ok -ne $true) {
      throw "Passing nomination vote click failed: $($result.message)"
    }
    $viewModel = Read-JsonFile $viewModelPath
    if ($viewModel.action.lastActionId -ne $action.id -or $viewModel.action.lastActionType -ne "resolve-nomination-vote") {
      throw "Passing nomination vote click did not refresh Unity viewmodel with the clicked action."
    }
    if ($null -eq $viewModel.voteCeremony -or $viewModel.voteCeremony.passed -ne $true) {
      throw "Passing nomination vote click did not produce a passed vote ceremony."
    }
    if ($null -eq $viewModel.executionCandidate -or $viewModel.executionCandidate.nomineeId -ne $debate.nomineeId) {
      throw "Passing nomination vote click did not put the nominee on the execution block."
    }
    $yesVotes = $viewModel.voteCeremony.yesVotes
    $threshold = $viewModel.voteCeremony.threshold
    if ($yesVotes -lt $threshold) {
      throw "Passing nomination vote click reported insufficient yes votes. yes=$yesVotes threshold=$threshold"
    }
    $nomineeId = $viewModel.executionCandidate.nomineeId
    $nomineeName = $viewModel.executionCandidate.nomineeName

    Start-Sleep -Milliseconds 700
    $endDayAction = Invoke-EndDayFromNominationClick -Scenario $scenario
    $endDayResult = Wait-ResultAction -ActionId $endDayAction.id -TimeoutSeconds $ActionTimeoutSeconds
    $afterStateEnvelope = Read-JsonFile $statePath
    $afterViewModel = Read-JsonFile $viewModelPath
    if ($endDayResult.ok -ne $true) {
      $message = $endDayResult.message
      if ([string]::IsNullOrWhiteSpace($message)) { $message = $endDayResult.reason }
      if ($afterViewModel.gameOver -ne $true -or $afterViewModel.winner -ne "good") {
        throw "Passing nomination day-end click failed: $message"
      }
    }
    $nomineeAfter = @($afterStateEnvelope.state.players | Where-Object { $_.id -eq $nomineeId } | Select-Object -First 1)[0]
    if ($null -eq $nomineeAfter -or $nomineeAfter.alive -ne $false) {
      throw "Passing nomination day-end click did not execute the on-block nominee."
    }
    $executionEvents = @($afterStateEnvelope.state.events.executions | Where-Object { $_.nomineeId -eq $nomineeId -and $_.reason -eq "vote-execution" })
    if ($executionEvents.Count -lt 1) {
      throw "Passing nomination day-end click did not persist a vote-execution event."
    }
    if ($afterViewModel.gameOver -ne $true -or $afterViewModel.winner -ne "good") {
      throw "Passing nomination day-end click should end the final-three game with good winning. gameOver=$($afterViewModel.gameOver), winner=$($afterViewModel.winner)"
    }

    return [pscustomobject]@{
      Name = "passing-nomination-vote-click"
      UnityPid = $scenario.Process.Id
      NodePids = ($scenario.NodePids -join ",")
      ActionId = $action.id
      ActionType = $result.actionType
      Nominee = $viewModel.voteCeremony.nomineeName
      VotePassed = $viewModel.voteCeremony.passed
      YesVotes = $yesVotes
      Threshold = $threshold
      ExecutionCandidate = $nomineeName
      EndDayActionId = $endDayAction.id
      ExecutedNomineeAlive = $nomineeAfter.alive
      ExecutionEvents = $executionEvents.Count
      FinalPhase = $afterViewModel.phase
      GameOver = $afterViewModel.gameOver
      Winner = $afterViewModel.winner
      LastActionType = $afterViewModel.action.lastActionType
    }
  }
  finally {
    Stop-UnityScenario -UnityProcess $scenario.Process -BeforeNodeIds $scenario.BeforeNodeIds
  }
}

function Invoke-HumanNominationFullClickSmoke {
  Set-ClickSmokeFlow "human-nomination-full-click"
  Prepare-SmokeFixture "nomination-window-pass"
  Remove-BridgeFiles
  $beforeStateEnvelope = Read-JsonFile $statePath
  $target = @($beforeStateEnvelope.state.players | Where-Object { $_.alive -eq $true -and $_.category -eq "demon" -and $_.isHuman -ne $true } | Select-Object -First 1)[0]
  if ($null -eq $target) {
    throw "Human nomination fixture did not expose a living demon target."
  }

  $scenario = Start-UnityScenario
  try {
    Start-Sleep -Milliseconds 1800
    Invoke-ContinueCurrentFromMenuClick -Scenario $scenario -SnapshotPrefix "human-nomination-menu"
    Click-UnityWindowPoint -Handle $scenario.Handle -X 1028 -Y 574
    Start-Sleep -Milliseconds 500
    Capture-UnityWindowPng -Handle $scenario.Handle -PathValue (Join-Path $artifactDir "human-nomination-window-before-token.png")
    $beforeTokenViewModel = Read-JsonFile $viewModelPath
    $ringPlayers = @($beforeTokenViewModel.players)
    $targetIndex = [Array]::IndexOf(@($ringPlayers | ForEach-Object { "$($_.id)" }), "$($target.id)")
    if ($targetIndex -lt 0) {
      throw "Human nomination fixture target '$($target.id)' was not present in the Unity player ring."
    }
    $selectAction = Invoke-ClickCandidatesUntilAction -Handle $scenario.Handle -ExpectedType "select-token" -Candidates (Get-GrimoireTokenClickCandidates -TokenIndex $targetIndex -PlayerCount $ringPlayers.Count)
    $selectResult = Wait-ResultAction -ActionId $selectAction.id -TimeoutSeconds $ActionTimeoutSeconds
    $selectedViewModel = Read-JsonFile $viewModelPath
    if ($selectResult.ok -ne $true -or $selectedViewModel.action.selectedPlayerId -ne $target.id) {
      throw "Human nomination target click selected '$($selectedViewModel.action.selectedPlayerId)' instead of '$($target.id)'."
    }

    Start-Sleep -Milliseconds 500
    Capture-UnityWindowPng -Handle $scenario.Handle -PathValue (Join-Path $artifactDir "human-nomination-token-selected.png")
    $nominationButtonTargets = @(
      @{ x = 228; y = 572 },
      @{ x = 236; y = 572 },
      @{ x = 228; y = 566 },
      @{ x = 236; y = 566 },
      @{ x = 1060; y = 638 },
      @{ x = 952; y = 146 }
    )
    $nominationAction = Invoke-ClickCandidatesUntilAction -Handle $scenario.Handle -ExpectedType "human-nomination-intent" -Candidates $nominationButtonTargets
    $nominationResult = Wait-ResultAction -ActionId $nominationAction.id -TimeoutSeconds $ActionTimeoutSeconds
    if ($nominationResult.ok -ne $true) {
      throw "Human nomination click failed: $($nominationResult.message)"
    }
    $debateViewModel = Read-JsonFile $viewModelPath
    if ($debateViewModel.nominationDebate.active -ne $true -or $debateViewModel.nominationDebate.nomineeId -ne $target.id) {
      throw "Human nomination click did not create an active debate for the selected target."
    }

    Start-Sleep -Milliseconds 700
    Click-UnityWindowPoint -Handle $scenario.Handle -X 1028 -Y 574
    Start-Sleep -Milliseconds 300
    $humanNominationVoteYesTargets = @(
      @{ x = 1060; y = 365 },
      @{ x = 1060; y = 352 },
      @{ x = 1060; y = 378 },
      @{ x = 1040; y = 365 },
      @{ x = 1080; y = 365 }
    )
    $voteAction = Invoke-ClickCandidatesUntilAction -Handle $scenario.Handle -ExpectedType "resolve-nomination-vote" -Candidates $humanNominationVoteYesTargets
    $voteResult = Wait-ResultAction -ActionId $voteAction.id -TimeoutSeconds $ActionTimeoutSeconds
    if ($voteResult.ok -ne $true) {
      throw "Human nomination vote click failed: $($voteResult.message)"
    }
    $voteViewModel = Read-JsonFile $viewModelPath
    if ($voteViewModel.voteCeremony.passed -ne $true -or $voteViewModel.executionCandidate.nomineeId -ne $target.id) {
      throw "Human nomination vote click did not pass and put the target on the block."
    }
    $yesVotes = $voteViewModel.voteCeremony.yesVotes
    $threshold = $voteViewModel.voteCeremony.threshold

    Start-Sleep -Milliseconds 700
    $endDayAction = Invoke-EndDayFromNominationClick -Scenario $scenario
    $endDayResult = Wait-ResultAction -ActionId $endDayAction.id -TimeoutSeconds $ActionTimeoutSeconds
    $afterStateEnvelope = Read-JsonFile $statePath
    $afterViewModel = Read-JsonFile $viewModelPath
    if ($endDayResult.ok -ne $true) {
      $message = $endDayResult.message
      if ([string]::IsNullOrWhiteSpace($message)) { $message = $endDayResult.reason }
      if ($afterViewModel.gameOver -ne $true -or $afterViewModel.winner -ne "good") {
        throw "Human nomination endgame click failed: $message"
      }
    }
    $targetAfter = @($afterStateEnvelope.state.players | Where-Object { $_.id -eq $target.id } | Select-Object -First 1)[0]
    if ($null -eq $targetAfter -or $targetAfter.alive -ne $false) {
      throw "Human nomination endgame click did not execute the selected target."
    }
    if ($afterViewModel.gameOver -ne $true -or $afterViewModel.winner -ne "good") {
      throw "Human nomination endgame click should finish with good winning. gameOver=$($afterViewModel.gameOver), winner=$($afterViewModel.winner)"
    }

    return [pscustomobject]@{
      Name = "human-nomination-full-click"
      UnityPid = $scenario.Process.Id
      NodePids = ($scenario.NodePids -join ",")
      SelectedTarget = $target.name
      SelectActionId = $selectAction.id
      NominationActionId = $nominationAction.id
      VoteActionId = $voteAction.id
      VotePassed = $voteViewModel.voteCeremony.passed
      YesVotes = $yesVotes
      Threshold = $threshold
      EndDayActionId = $endDayAction.id
      ExecutedTargetAlive = $targetAfter.alive
      FinalPhase = $afterViewModel.phase
      GameOver = $afterViewModel.gameOver
      Winner = $afterViewModel.winner
      LastActionType = $afterViewModel.action.lastActionType
    }
  }
  finally {
    Stop-UnityScenario -UnityProcess $scenario.Process -BeforeNodeIds $scenario.BeforeNodeIds
  }
}

function Invoke-ExecutionCandidateClickSmoke {
  Set-ClickSmokeFlow "execution-death-click"
  Prepare-SmokeFixture "execution-candidate"
  Remove-BridgeFiles
  $beforeStateEnvelope = Read-JsonFile $statePath
  $candidate = $beforeStateEnvelope.state.dayStageMeta.executionCandidate
  if ($null -eq $candidate -or [string]::IsNullOrWhiteSpace($candidate.nomineeId)) {
    throw "Execution fixture did not create an on-block nominee."
  }
  $nomineeBefore = @($beforeStateEnvelope.state.players | Where-Object { $_.id -eq $candidate.nomineeId } | Select-Object -First 1)[0]
  if ($null -eq $nomineeBefore -or $nomineeBefore.alive -ne $true) {
    throw "Execution fixture nominee should start alive."
  }

  $scenario = Start-UnityScenario
  try {
    Start-Sleep -Milliseconds 1800
    Invoke-ContinueCurrentFromMenuClick -Scenario $scenario -SnapshotPrefix "execution-candidate-menu"
    $action = Invoke-EndDayFromNominationClick -Scenario $scenario -SnapshotName "execution-candidate-before-click.png"
    $result = Wait-ResultAction -ActionId $action.id -TimeoutSeconds $ActionTimeoutSeconds
    if ($result.ok -ne $true) {
      $message = $result.message
      if ([string]::IsNullOrWhiteSpace($message)) { $message = $result.reason }
      throw "Execution day-end click failed: $message"
    }
    $afterStateEnvelope = Read-JsonFile $statePath
    $viewModel = Read-JsonFile $viewModelPath
    $nomineeAfter = @($afterStateEnvelope.state.players | Where-Object { $_.id -eq $candidate.nomineeId } | Select-Object -First 1)[0]
    if ($null -eq $nomineeAfter -or $nomineeAfter.alive -ne $false) {
      throw "Execution day-end click did not kill the on-block nominee."
    }
    $executionEvents = @($afterStateEnvelope.state.events.executions | Where-Object { $_.nomineeId -eq $candidate.nomineeId -and $_.reason -eq "vote-execution" })
    if ($executionEvents.Count -lt 1) {
      throw "Execution day-end click did not persist a vote-execution event."
    }
    if ($null -ne $viewModel.executionCandidate) {
      throw "Execution day-end click did not clear the Unity execution candidate."
    }
    if ($viewModel.phase -ne "night" -and $viewModel.phase -ne "ended") {
      throw "Execution day-end click did not leave nomination. phase=$($viewModel.phase), dayStage=$($viewModel.dayStage)"
    }

    return [pscustomobject]@{
      Name = "execution-death-click"
      UnityPid = $scenario.Process.Id
      NodePids = ($scenario.NodePids -join ",")
      ActionId = $action.id
      ActionType = $result.actionType
      ExecutedNominee = $nomineeBefore.name
      NomineeAlive = $nomineeAfter.alive
      ExecutionEvents = $executionEvents.Count
      FinalPhase = $viewModel.phase
      FinalDayStage = $viewModel.dayStage
      GameOver = $viewModel.gameOver
      Winner = $viewModel.winner
    }
  }
  finally {
    Stop-UnityScenario -UnityProcess $scenario.Process -BeforeNodeIds $scenario.BeforeNodeIds
  }
}

if ($RestoreRuntimeState) {
  $script:runtimeStateBackups = Backup-RuntimeFiles `
    -Paths @($statePath, $viewModelPath, $actionPath, $resultPath) `
    -BackupDir $runtimeBackupDir
}

try {
  if ($OnlyManualNightAction) {
    $results = @(
      Invoke-ManualNightActionClickSmoke
    )
  }
  elseif ($OnlySocial) {
    $results = @(
      Invoke-ProactiveQueueClickSmoke
      Invoke-PrivateChatPanelClickSmoke
      Invoke-PublicDiscussionClickSmoke
      Invoke-AiNominationClickSmoke
      Invoke-PassNominationClickSmoke
    )
  }
  elseif ($OnlyInfoDrawer) {
    $results = @(
      Invoke-InfoDrawerTabsClickSmoke
    )
  }
  elseif ($OnlyNominationVote) {
    $results = @(
      Invoke-NominationVoteClickSmoke
    )
  }
  elseif ($OnlyNightAction) {
    $results = @(
      Invoke-NightActionClickSmoke
      Invoke-ManualNightActionClickSmoke
    )
  }
  else {
    $newGame = Invoke-NewGameClickSmoke
    $results = @($newGame)
    if ($IncludeNightAction) {
      $results += Invoke-NightActionClickSmoke
      $results += Invoke-ManualNightActionClickSmoke
    }
    $proactiveQueue = Invoke-ProactiveQueueClickSmoke
    $privateChat = Invoke-PrivateChatPanelClickSmoke
    $publicDiscussion = Invoke-PublicDiscussionClickSmoke
    $flowAdvance = Invoke-FlowAdvanceClickSmoke
    $aiNomination = Invoke-AiNominationClickSmoke
    $passNomination = Invoke-PassNominationClickSmoke
    $nominationVote = Invoke-NominationVoteClickSmoke
    $passingNominationVote = Invoke-PassingNominationVoteClickSmoke
    $humanNominationFull = Invoke-HumanNominationFullClickSmoke
    $executionDeath = Invoke-ExecutionCandidateClickSmoke
    $infoDrawerTabs = Invoke-InfoDrawerTabsClickSmoke
    $results += $proactiveQueue
    $results += $privateChat
    $results += $publicDiscussion
    $results += $flowAdvance
    $results += $aiNomination
    $results += $passNomination
    $results += $nominationVote
    $results += $passingNominationVote
    $results += $humanNominationFull
    $results += $executionDeath
    $results += $infoDrawerTabs
  }

  $script:clickSmokeResults = @($results)
  Write-ClickSmokeReport -Results $script:clickSmokeResults
  $results | Format-List
}
catch {
  $script:clickSmokeFailure = [pscustomobject]@{
    message = $_.Exception.Message
    flow = $script:currentFlow
    scriptStackTrace = $_.ScriptStackTrace
  }
  Write-ClickSmokeReport -Results $script:clickSmokeResults -Failure $script:clickSmokeFailure
  throw
}
finally {
  Stop-PackageLocalProcesses
  Restore-RuntimeStateOnce
}
