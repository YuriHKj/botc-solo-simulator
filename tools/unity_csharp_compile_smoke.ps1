param(
  [string]$UnityEditor = "",
  [string]$Dotnet = "",
  [string]$OutputPath = "",
  [switch]$WriteHostedEvidence,
  [switch]$ValidateHostedEvidence
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$projectRoot = Join-Path $root "unity-prototype"
$projectVersionPath = Join-Path $projectRoot "ProjectSettings\ProjectVersion.txt"
$hostedEvidenceSchema = "botc-hosted-unity-csharp-evidence"
$hostedEvidenceVersion = 1
$requiredUnityVersion = "2022.3.62f3"
$requiredProjectVersionRevision = "96770f904ca7"
$gitShaPattern = "^[a-fA-F0-9]{40}$"

function Read-RequiredEnvironment {
  param([string]$Name)

  $value = [Environment]::GetEnvironmentVariable($Name)
  if ([string]::IsNullOrWhiteSpace($value)) {
    throw "Required hosted evidence environment variable is missing: $Name"
  }
  return $value.Trim()
}

function Convert-StrictBoolean {
  param(
    [string]$Name,
    [string]$Value
  )

  if ($Value -ceq "true") { return $true }
  if ($Value -ceq "false") { return $false }
  throw "$Name must be exactly true or false."
}

function Read-ProjectUnityVersion {
  if (-not (Test-Path -LiteralPath $projectVersionPath -PathType Leaf)) {
    throw "Unity project version file not found: $projectVersionPath"
  }

  $version = $null
  $versionWithRevision = $null
  foreach ($line in Get-Content -LiteralPath $projectVersionPath) {
    if ($line -match "^m_EditorVersion:\s*(\S+)\s*$") {
      $version = $Matches[1]
    }
    if ($line -match "^m_EditorVersionWithRevision:\s*(\S+)\s+\(([a-fA-F0-9]+)\)\s*$") {
      $versionWithRevision = @{
        version = $Matches[1]
        revision = $Matches[2].ToLowerInvariant()
      }
    }
  }

  if ([string]::IsNullOrWhiteSpace($version) -or $null -eq $versionWithRevision) {
    throw "Could not read the Unity version and revision from $projectVersionPath"
  }
  if ($version -cne $versionWithRevision.version) {
    throw "Unity project version lines disagree in $projectVersionPath"
  }
  if ($version -cne $requiredUnityVersion -or $versionWithRevision.revision -cne $requiredProjectVersionRevision) {
    throw "Hosted evidence pin $requiredUnityVersion ($requiredProjectVersionRevision) does not match project version $version ($($versionWithRevision.revision))."
  }

  return [pscustomobject]@{
    version = $version
    revision = $versionWithRevision.revision
  }
}

function Assert-HostedIdentityEnvironment {
  $githubActions = Read-RequiredEnvironment "GITHUB_ACTIONS"
  if ($githubActions -cne "true") {
    throw "Hosted evidence is valid only inside GitHub Actions."
  }
  $runnerEnvironment = Read-RequiredEnvironment "RUNNER_ENVIRONMENT"
  if ($runnerEnvironment -cne "github-hosted") {
    throw "Hosted evidence requires runner.environment=github-hosted."
  }

  $testedRevision = Read-RequiredEnvironment "GITHUB_SHA"
  if ($testedRevision -notmatch $gitShaPattern) {
    throw "GITHUB_SHA must be a 40-character Git revision."
  }
  $sourceRevision = Read-RequiredEnvironment "BOTC_HOSTED_UNITY_SOURCE_REVISION"
  if ($sourceRevision -notmatch $gitShaPattern) {
    throw "BOTC_HOSTED_UNITY_SOURCE_REVISION must be a 40-character Git revision."
  }
  $runId = Read-RequiredEnvironment "GITHUB_RUN_ID"
  if ($runId -notmatch "^[1-9][0-9]*$") {
    throw "GITHUB_RUN_ID must be a positive integer string."
  }
  $runAttemptText = Read-RequiredEnvironment "GITHUB_RUN_ATTEMPT"
  if ($runAttemptText -notmatch "^[1-9][0-9]*$") {
    throw "GITHUB_RUN_ATTEMPT must be a positive integer."
  }
  $repository = Read-RequiredEnvironment "GITHUB_REPOSITORY"
  if ($repository -notmatch "^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$") {
    throw "GITHUB_REPOSITORY must be an owner/repository identifier."
  }

  return [pscustomobject]@{
    testedRevision = $testedRevision.ToLowerInvariant()
    sourceRevision = $sourceRevision.ToLowerInvariant()
    repository = $repository
    workflow = Read-RequiredEnvironment "GITHUB_WORKFLOW"
    runId = $runId
    runAttempt = [int]$runAttemptText
    runnerEnvironment = $runnerEnvironment
  }
}

function Assert-ReceiptShape {
  param([psobject]$Evidence)

  $requiredKeys = @(
    "schema", "version", "status", "testedRevision", "sourceRevision", "repository", "workflow",
    "runId", "runAttempt", "runnerEnvironment", "runnerOs", "unityVersion", "projectVersionRevision",
    "licenseReady", "licenseMode", "activationOutcome", "unityOutcome", "engineExitCode", "cleanInputs",
    "cacheUsed", "failureKind", "generatedAt"
  )
  $actualKeys = @($Evidence.PSObject.Properties.Name)
  foreach ($key in $requiredKeys) {
    if ($actualKeys -cnotcontains $key) {
      throw "Hosted Unity evidence is missing required field: $key"
    }
  }
  foreach ($key in $actualKeys) {
    if ($requiredKeys -cnotcontains $key) {
      throw "Hosted Unity evidence contains an unsupported field: $key"
    }
  }

  if ($Evidence.schema -isnot [string] -or $Evidence.schema -cne $hostedEvidenceSchema) {
    throw "Hosted Unity evidence schema is unsupported."
  }
  if (($Evidence.version -isnot [int]) -and ($Evidence.version -isnot [long])) {
    throw "Hosted Unity evidence version must be an integer."
  }
  if ([int]$Evidence.version -ne $hostedEvidenceVersion) {
    throw "Hosted Unity evidence version is unsupported."
  }
  foreach ($field in @(
    "status", "testedRevision", "sourceRevision", "repository", "workflow", "runId", "runnerEnvironment",
    "runnerOs", "unityVersion", "projectVersionRevision", "licenseMode", "activationOutcome", "unityOutcome",
    "generatedAt"
  )) {
    if ($Evidence.$field -isnot [string] -or [string]::IsNullOrWhiteSpace($Evidence.$field)) {
      throw "Hosted Unity evidence field $field must be a non-empty string."
    }
  }
  foreach ($field in @("licenseReady", "cleanInputs", "cacheUsed")) {
    if ($Evidence.$field -isnot [bool]) {
      throw "Hosted Unity evidence field $field must be a boolean."
    }
  }
  if (($Evidence.runAttempt -isnot [int]) -and ($Evidence.runAttempt -isnot [long])) {
    throw "Hosted Unity evidence runAttempt must be an integer."
  }
  if ([int]$Evidence.runAttempt -le 0) {
    throw "Hosted Unity evidence runAttempt must be positive."
  }
  if ($null -ne $Evidence.engineExitCode -and ($Evidence.engineExitCode -isnot [int]) -and ($Evidence.engineExitCode -isnot [long])) {
    throw "Hosted Unity evidence engineExitCode must be an integer or null."
  }
  if ($null -ne $Evidence.failureKind -and $Evidence.failureKind -isnot [string]) {
    throw "Hosted Unity evidence failureKind must be a string or null."
  }
  if ($Evidence.testedRevision -notmatch $gitShaPattern -or $Evidence.sourceRevision -notmatch $gitShaPattern) {
    throw "Hosted Unity evidence revisions must be 40-character Git revisions."
  }
  if ($Evidence.runId -notmatch "^[1-9][0-9]*$") {
    throw "Hosted Unity evidence runId must be a positive integer string."
  }
  try {
    $generatedAt = [DateTimeOffset]::ParseExact(
      $Evidence.generatedAt,
      "o",
      [Globalization.CultureInfo]::InvariantCulture,
      [Globalization.DateTimeStyles]::RoundtripKind
    )
  } catch {
    throw "Hosted Unity evidence generatedAt must be an ISO-8601 round-trip timestamp."
  }
  if ($generatedAt.Offset -ne [TimeSpan]::Zero) {
    throw "Hosted Unity evidence generatedAt must be UTC."
  }
}

function Assert-ReceiptOutcome {
  param([psobject]$Evidence)

  $allowedStatuses = @("pass", "fail")
  $allowedLicenseModes = @("none", "personal", "professional")
  $allowedActivationOutcomes = @("not-run", "success", "unknown")
  $allowedUnityOutcomes = @("not-run", "success", "unknown")
  if ($allowedStatuses -cnotcontains $Evidence.status) { throw "Hosted Unity evidence status is invalid." }
  if ($allowedLicenseModes -cnotcontains $Evidence.licenseMode) { throw "Hosted Unity evidence licenseMode is invalid." }
  if ($allowedActivationOutcomes -cnotcontains $Evidence.activationOutcome) { throw "Hosted Unity evidence activationOutcome is invalid." }
  if ($allowedUnityOutcomes -cnotcontains $Evidence.unityOutcome) { throw "Hosted Unity evidence unityOutcome is invalid." }

  if ($Evidence.status -ceq "pass") {
    if (-not $Evidence.licenseReady -or $Evidence.licenseMode -ceq "none") { throw "Passing evidence requires ready license inputs." }
    if ($Evidence.activationOutcome -cne "success") { throw "Passing evidence requires successful Unity activation." }
    if ($Evidence.unityOutcome -cne "success") { throw "Passing evidence requires successful Unity execution." }
    if ($null -eq $Evidence.engineExitCode -or [int]$Evidence.engineExitCode -ne 0) { throw "Passing evidence requires engineExitCode 0." }
    if (-not $Evidence.cleanInputs -or $Evidence.cacheUsed) { throw "Passing evidence requires clean, uncached Unity inputs." }
    if ($null -ne $Evidence.failureKind) { throw "Passing evidence cannot declare a failureKind." }
    return
  }

  $allowedFailureKinds = @(
    "cold-inputs-invalid",
    "licensing-unavailable",
    "unity-activation-or-execution-failed"
  )
  if ($Evidence.failureKind -isnot [string] -or $allowedFailureKinds -cnotcontains $Evidence.failureKind) {
    throw "Failing evidence requires a supported failureKind."
  }
  if ($Evidence.failureKind -ceq "licensing-unavailable") {
    if ($Evidence.licenseReady -or $Evidence.licenseMode -cne "none" -or $Evidence.activationOutcome -cne "not-run" -or $Evidence.unityOutcome -cne "not-run") {
      throw "licensing-unavailable evidence has inconsistent outcomes."
    }
  }
  if ($Evidence.failureKind -ceq "unity-activation-or-execution-failed") {
    if (-not $Evidence.licenseReady -or $Evidence.licenseMode -ceq "none" -or $Evidence.activationOutcome -cne "unknown" -or $Evidence.unityOutcome -cne "unknown") {
      throw "unity-activation-or-execution-failed evidence has inconsistent outcomes."
    }
  }
}

function Write-HostedUnityEvidence {
  $identity = Assert-HostedIdentityEnvironment
  $projectVersion = Read-ProjectUnityVersion
  $runnerOs = Read-RequiredEnvironment "RUNNER_OS"
  if ($runnerOs -cne "Linux") {
    throw "Hosted Unity evidence writer requires a Linux GitHub-hosted runner."
  }
  $status = Read-RequiredEnvironment "BOTC_HOSTED_UNITY_STATUS"
  $licenseReady = Convert-StrictBoolean "BOTC_HOSTED_UNITY_LICENSE_READY" (Read-RequiredEnvironment "BOTC_HOSTED_UNITY_LICENSE_READY")
  $cleanInputs = Convert-StrictBoolean "BOTC_HOSTED_UNITY_CLEAN_INPUTS" (Read-RequiredEnvironment "BOTC_HOSTED_UNITY_CLEAN_INPUTS")
  $cacheUsed = Convert-StrictBoolean "BOTC_HOSTED_UNITY_CACHE_USED" (Read-RequiredEnvironment "BOTC_HOSTED_UNITY_CACHE_USED")
  $engineExitCodeText = [Environment]::GetEnvironmentVariable("BOTC_HOSTED_UNITY_ENGINE_EXIT_CODE")
  $engineExitCode = $null
  if (-not [string]::IsNullOrWhiteSpace($engineExitCodeText)) {
    $parsedExitCode = 0
    if (-not [int]::TryParse($engineExitCodeText.Trim(), [ref]$parsedExitCode)) {
      throw "BOTC_HOSTED_UNITY_ENGINE_EXIT_CODE must be an integer or empty."
    }
    $engineExitCode = $parsedExitCode
  }
  $failureKindValue = [Environment]::GetEnvironmentVariable("BOTC_HOSTED_UNITY_FAILURE_KIND")
  $failureKind = $null
  if (-not [string]::IsNullOrWhiteSpace($failureKindValue)) {
    $failureKind = $failureKindValue.Trim()
  }

  $evidence = [pscustomobject][ordered]@{
    schema = $hostedEvidenceSchema
    version = $hostedEvidenceVersion
    status = $status
    testedRevision = $identity.testedRevision
    sourceRevision = $identity.sourceRevision
    repository = $identity.repository
    workflow = $identity.workflow
    runId = $identity.runId
    runAttempt = $identity.runAttempt
    runnerEnvironment = $identity.runnerEnvironment
    runnerOs = $runnerOs
    unityVersion = $projectVersion.version
    projectVersionRevision = $projectVersion.revision
    licenseReady = $licenseReady
    licenseMode = Read-RequiredEnvironment "BOTC_HOSTED_UNITY_LICENSE_MODE"
    activationOutcome = Read-RequiredEnvironment "BOTC_HOSTED_UNITY_ACTIVATION_OUTCOME"
    unityOutcome = Read-RequiredEnvironment "BOTC_HOSTED_UNITY_ACTION_OUTCOME"
    engineExitCode = $engineExitCode
    cleanInputs = $cleanInputs
    cacheUsed = $cacheUsed
    failureKind = $failureKind
    generatedAt = [DateTime]::UtcNow.ToString("o", [Globalization.CultureInfo]::InvariantCulture)
  }
  Assert-ReceiptShape $evidence
  Assert-ReceiptOutcome $evidence

  $evidencePath = Read-RequiredEnvironment "BOTC_HOSTED_UNITY_EVIDENCE_PATH"
  $evidenceDirectory = Split-Path -Parent $evidencePath
  if ([string]::IsNullOrWhiteSpace($evidenceDirectory)) {
    throw "BOTC_HOSTED_UNITY_EVIDENCE_PATH must include a parent directory."
  }
  New-Item -ItemType Directory -Force -Path $evidenceDirectory | Out-Null
  $json = $evidence | ConvertTo-Json -Depth 4
  $utf8WithoutBom = [System.Text.UTF8Encoding]::new($false)
  [System.IO.File]::WriteAllText($evidencePath, "$json`n", $utf8WithoutBom)
  Write-Host "HOSTED_UNITY_EVIDENCE_WRITTEN=$evidencePath"
  Write-Host "HOSTED_UNITY_EVIDENCE_STATUS=$status"
}

function Test-HostedUnityEvidence {
  $identity = Assert-HostedIdentityEnvironment
  $projectVersion = Read-ProjectUnityVersion
  $evidencePath = Read-RequiredEnvironment "BOTC_HOSTED_UNITY_EVIDENCE_PATH"
  if (-not (Test-Path -LiteralPath $evidencePath -PathType Leaf)) {
    throw "Hosted Unity evidence not found: $evidencePath"
  }
  try {
    $evidence = Get-Content -Raw -LiteralPath $evidencePath | ConvertFrom-Json
  } catch {
    throw "Hosted Unity evidence is not valid JSON: $($_.Exception.Message)"
  }
  if ($null -eq $evidence) { throw "Hosted Unity evidence JSON is empty." }
  Assert-ReceiptShape $evidence
  Assert-ReceiptOutcome $evidence

  if ($evidence.status -cne "pass") { throw "Hosted Unity evidence status is not pass: $($evidence.status)" }
  if ($evidence.testedRevision -cne $identity.testedRevision) { throw "Hosted Unity evidence testedRevision does not match GITHUB_SHA." }
  if ($evidence.sourceRevision -cne $identity.sourceRevision) { throw "Hosted Unity evidence sourceRevision does not match the routed source revision." }
  if ($evidence.repository -cne $identity.repository) { throw "Hosted Unity evidence repository does not match GITHUB_REPOSITORY." }
  if ($evidence.workflow -cne $identity.workflow) { throw "Hosted Unity evidence workflow does not match GITHUB_WORKFLOW." }
  if ($evidence.runId -cne $identity.runId) { throw "Hosted Unity evidence runId does not match GITHUB_RUN_ID." }
  if ([int]$evidence.runAttempt -ne $identity.runAttempt) { throw "Hosted Unity evidence runAttempt does not match GITHUB_RUN_ATTEMPT." }
  if ($evidence.runnerEnvironment -cne "github-hosted") { throw "Hosted Unity evidence was not produced by a GitHub-hosted runner." }
  if ($evidence.runnerOs -cne "Linux") { throw "Hosted Unity evidence was not produced by the required Linux runner." }
  if ($evidence.unityVersion -cne $requiredUnityVersion -or $evidence.unityVersion -cne $projectVersion.version) {
    throw "Hosted Unity evidence Unity version does not match the pinned project version."
  }
  if ($evidence.projectVersionRevision -cne $requiredProjectVersionRevision -or $evidence.projectVersionRevision -cne $projectVersion.revision) {
    throw "Hosted Unity evidence project revision does not match the pinned project revision."
  }

  Write-Host "HOSTED_UNITY_EVIDENCE=pass"
  Write-Host "TESTED_REVISION=$($evidence.testedRevision)"
  Write-Host "HOSTED_RUN=$($evidence.runId).$($evidence.runAttempt)"
}

if ($WriteHostedEvidence -and $ValidateHostedEvidence) {
  throw "Choose only one hosted evidence mode."
}
if ($WriteHostedEvidence) {
  Write-HostedUnityEvidence
  exit 0
}
if ($ValidateHostedEvidence -or [Environment]::GetEnvironmentVariable("BOTC_HOSTED_UNITY_EVIDENCE_REQUIRED") -ceq "1") {
  Test-HostedUnityEvidence
  exit 0
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

function Resolve-Dotnet {
  param([string]$DotnetPath)

  if (-not [string]::IsNullOrWhiteSpace($DotnetPath)) {
    return (Resolve-Path -LiteralPath $DotnetPath).Path
  }

  $command = Get-Command dotnet -ErrorAction Stop
  return $command.Source
}

function Resolve-CscDll {
  $sdkRoot = Join-Path (Split-Path -Parent $script:dotnetPath) "sdk"
  if (-not (Test-Path -LiteralPath $sdkRoot)) {
    throw "dotnet SDK root not found: $sdkRoot"
  }

  $sdks = Get-ChildItem -LiteralPath $sdkRoot -Directory |
    Sort-Object {
      try { [version]$_.Name } catch { [version]"0.0" }
    } -Descending

  foreach ($sdk in $sdks) {
    $candidate = Join-Path $sdk.FullName "Roslyn\bincore\csc.dll"
    if (Test-Path -LiteralPath $candidate) {
      return $candidate
    }
  }

  throw "Could not find Roslyn csc.dll under $sdkRoot"
}

function Required-Path {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    throw "Required compile reference not found: $Path"
  }
  return $Path
}

$editorRoot = Resolve-UnityEditorRoot -Editor $UnityEditor
$dotnetPath = Resolve-Dotnet -DotnetPath $Dotnet
$cscDll = Resolve-CscDll

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
  $OutputPath = Join-Path $root "output\BotcUnityRuntimeSmoke.dll"
}
$outputDir = Split-Path -Parent $OutputPath
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
$OutputPath = (Join-Path (Resolve-Path -LiteralPath $outputDir).Path (Split-Path -Leaf $OutputPath))

$scriptsDir = Join-Path $projectRoot "Assets\Scripts"
$sources = Get-ChildItem -LiteralPath $scriptsDir -Filter *.cs | ForEach-Object { $_.FullName }
if ($sources.Count -eq 0) {
  throw "No C# runtime scripts found in $scriptsDir"
}

$mono = Join-Path $editorRoot "Data\MonoBleedingEdge\lib\mono\unityjit-win32"
$engine = Join-Path $editorRoot "Data\Managed\UnityEngine"
$uiDll = Get-ChildItem -Recurse (Join-Path $editorRoot "Data\Resources\PackageManager\ProjectTemplates\libcache") -Filter "UnityEngine.UI.dll" |
  Select-Object -First 1 -ExpandProperty FullName
if ([string]::IsNullOrWhiteSpace($uiDll)) {
  throw "Could not find UnityEngine.UI.dll in Unity package template cache."
}

$standardRefs = @(
  "mscorlib.dll",
  "System.dll",
  "System.Core.dll",
  "System.Xml.dll",
  "System.Xml.Linq.dll",
  "System.Runtime.Serialization.dll",
  "Microsoft.CSharp.dll"
) | ForEach-Object { Required-Path (Join-Path $mono $_) }

$facadeRefs = @(
  Required-Path (Join-Path $mono "Facades\netstandard.dll")
)

$unityRefs = @(
  "UnityEngine.CoreModule.dll",
  "UnityEngine.UIModule.dll",
  "UnityEngine.UIElementsModule.dll",
  "UnityEngine.TextRenderingModule.dll",
  "UnityEngine.IMGUIModule.dll",
  "UnityEngine.InputLegacyModule.dll",
  "UnityEngine.ImageConversionModule.dll",
  "UnityEngine.AudioModule.dll",
  "UnityEngine.JSONSerializeModule.dll"
) | ForEach-Object { Required-Path (Join-Path $engine $_) }
$unityRefs += Required-Path $uiDll

$refs = @($standardRefs + $facadeRefs + $unityRefs) | ForEach-Object { "/r:$($_)" }

& $dotnetPath $cscDll /nologo /nostdlib+ /target:library /out:$OutputPath /langversion:latest @refs @sources
$exit = $LASTEXITCODE
if ($exit -ne 0) {
  Write-Host "CSC_EXIT=$exit"
  exit $exit
}

if (-not (Test-Path -LiteralPath $OutputPath)) {
  throw "C# compile reported success but did not produce $OutputPath"
}

$artifact = Get-Item -LiteralPath $OutputPath
Write-Host "CSC_EXIT=0"
Write-Host "OUTPUT=$($artifact.FullName)"
Write-Host "BYTES=$($artifact.Length)"
