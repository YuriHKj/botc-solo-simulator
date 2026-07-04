param(
  [string]$UnityEditor = "",
  [string]$Dotnet = "",
  [string]$OutputPath = ""
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$projectRoot = Join-Path $root "unity-prototype"
$projectVersionPath = Join-Path $projectRoot "ProjectSettings\ProjectVersion.txt"

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
