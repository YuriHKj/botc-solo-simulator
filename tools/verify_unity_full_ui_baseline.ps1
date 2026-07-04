param(
  [string]$Manifest = "",
  [string]$ReportPath = "",
  [string]$BaselineDir = "",
  [switch]$AllowWarnings
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$verifier = Join-Path $PSScriptRoot "verify_unity_ui_smoke.ps1"

if (-not (Test-Path -LiteralPath $verifier)) {
  throw "Unity UI verifier not found: $verifier"
}

if ([string]::IsNullOrWhiteSpace($Manifest)) {
  $Manifest = Join-Path $root "output\unity-ui-smoke-full-baseline-phase-assist-public-route-2026-06-05\manifest.json"
}

if (-not (Test-Path -LiteralPath $Manifest)) {
  throw "Full Unity UI baseline manifest not found: $Manifest. Run npm run unity:ui-smoke with the 31-state matrix, or pass -Manifest."
}

$Manifest = (Resolve-Path -LiteralPath $Manifest).Path
$manifestDir = Split-Path -Parent $Manifest

if ([string]::IsNullOrWhiteSpace($ReportPath)) {
  $ReportPath = Join-Path $manifestDir "full-baseline-verify-report.json"
}

$RequiredStates = @(
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
)

$RequiredViewports = @(
  "1920x1080",
  "1600x900",
  "1366x768"
)

$verifyArgs = @{
  Manifest = $Manifest
  RequiredStates = $RequiredStates
  RequiredViewports = $RequiredViewports
  ReportPath = $ReportPath
}

if (-not [string]::IsNullOrWhiteSpace($BaselineDir)) {
  $verifyArgs.BaselineDir = $BaselineDir
}

if (-not $AllowWarnings) {
  $verifyArgs.FailOnWarnings = $true
}

& $verifier @verifyArgs
