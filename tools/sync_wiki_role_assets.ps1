$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$root = Split-Path -Parent $PSScriptRoot
$dataPath = Join-Path $root "scripts\data.js"
$cacheDir = Join-Path $root "docs\research\wiki_cache"
$assetRoot = Join-Path $root "assets\roles"
$modulePath = Join-Path $root "scripts\role_localization.js"

$wikiPages = [ordered]@{
  tb = "https://clocktower-wiki.gstonegames.com/index.php?title=%E6%9A%97%E6%B5%81%E6%B6%8C%E5%8A%A8"
  bmr = "https://clocktower-wiki.gstonegames.com/index.php?title=%E9%BB%AF%E6%9C%88%E5%88%9D%E5%8D%87"
  snv = "https://clocktower-wiki.gstonegames.com/index.php?title=%E6%A2%A6%E6%AE%92%E6%98%A5%E5%AE%B5"
}

$wikiBase = "https://clocktower-wiki.gstonegames.com"

function Normalize-Stem([string] $text) {
  return ($text.ToLowerInvariant() -replace "[^a-z0-9]", "")
}

function To-RoleId([string] $text) {
  return (($text.ToLowerInvariant() -replace "[^a-z0-9]+", "-").Trim("-"))
}

function Escape-JsString([string] $text) {
  return (($text -replace "\\", "\\\\") -replace "'", "\\'")
}

New-Item -ItemType Directory -Force -Path $cacheDir | Out-Null
New-Item -ItemType Directory -Force -Path $assetRoot | Out-Null

$scriptRoles = @{
  tb = New-Object System.Collections.Generic.List[string]
  bmr = New-Object System.Collections.Generic.List[string]
  snv = New-Object System.Collections.Generic.List[string]
}

$currentScript = $null
Get-Content -Path $dataPath | ForEach-Object {
  $line = $_
  if ($line -match "const troubleBrewing\s*=") {
    $currentScript = "tb"
    return
  }
  if ($line -match "const badMoonRising\s*=") {
    $currentScript = "bmr"
    return
  }
  if ($line -match "const sectsAndViolets\s*=") {
    $currentScript = "snv"
    return
  }
  if ($line -match "export const SCRIPT_DEFINITIONS") {
    $currentScript = $null
    return
  }
  if ($null -ne $currentScript -and $line -match 'role\("([^"]+)"') {
    $scriptRoles[$currentScript].Add($Matches[1])
  }
}

$expectByScript = @{}
foreach ($scriptId in $scriptRoles.Keys) {
  $byStem = @{}
  foreach ($englishName in $scriptRoles[$scriptId]) {
    $stem = Normalize-Stem $englishName
    $byStem[$stem] = [ordered]@{
      id = To-RoleId $englishName
      english = $englishName
    }
  }
  $expectByScript[$scriptId] = $byStem
}

$entryRegex = [regex]::new(
  '<a href="/index\.php\?title=[^"]+"><img alt="" src="(?<src>/images/thumb/[^"]+?/(?<file>[A-Za-z0-9]+)\.png/[^"]+)"[^>]*></a>\s*</div></div>\s*<div class="gallerytext">\s*<p><a href="/index\.php\?title=[^"]+" title="(?<cn>[^"]+)">',
  [System.Text.RegularExpressions.RegexOptions]::Singleline
)

$localization = @{}
$missing = @{}

foreach ($scriptId in $wikiPages.Keys) {
  $url = $wikiPages[$scriptId]
  $htmlFile = Join-Path $cacheDir "$scriptId.html"

  $resp = Invoke-WebRequest -UseBasicParsing -Uri $url
  $resp.Content | Set-Content -Path $htmlFile -Encoding utf8

  $content = Get-Content -Path $htmlFile -Raw
  $found = @{}

  foreach ($match in $entryRegex.Matches($content)) {
    $stem = Normalize-Stem $match.Groups["file"].Value
    if (-not $expectByScript[$scriptId].ContainsKey($stem)) {
      continue
    }
    $roleDef = $expectByScript[$scriptId][$stem]
    $roleId = $roleDef.id
    if ($found.ContainsKey($roleId)) {
      continue
    }
    $found[$roleId] = [ordered]@{
      id = $roleId
      english = $roleDef.english
      name = $match.Groups["cn"].Value
      src = $match.Groups["src"].Value
    }
  }

  $localization[$scriptId] = $found

  $missingIds = New-Object System.Collections.Generic.List[string]
  foreach ($englishName in $scriptRoles[$scriptId]) {
    $roleId = To-RoleId $englishName
    if (-not $found.ContainsKey($roleId)) {
      $missingIds.Add($roleId)
    }
  }
  $missing[$scriptId] = $missingIds
}

foreach ($scriptId in $wikiPages.Keys) {
  $outDir = Join-Path $assetRoot $scriptId
  New-Item -ItemType Directory -Force -Path $outDir | Out-Null

  foreach ($entry in $localization[$scriptId].Values) {
    $outPath = Join-Path $outDir "$($entry.id).png"
    $imgUrl = "$wikiBase$($entry.src)"
    Invoke-WebRequest -UseBasicParsing -Uri $imgUrl -OutFile $outPath
  }
}

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add("export const ROLE_LOCALIZATION = {")

$orderedScripts = @("tb", "bmr", "snv")
foreach ($scriptId in $orderedScripts) {
  $lines.Add("  ${scriptId}: {")
  foreach ($englishName in $scriptRoles[$scriptId]) {
    $roleId = To-RoleId $englishName
    $entry = $null
    if ($localization[$scriptId].ContainsKey($roleId)) {
      $entry = $localization[$scriptId][$roleId]
    }

    $name = if ($null -ne $entry) { $entry.name } else { $englishName }
    $icon = if ($null -ne $entry) { "./assets/roles/$scriptId/$roleId.png" } else { "" }

    $safeName = Escape-JsString $name
    if ([string]::IsNullOrWhiteSpace($icon)) {
      $lines.Add("    '$roleId': { name: '$safeName', icon: null },")
    } else {
      $safeIcon = Escape-JsString $icon
      $lines.Add("    '$roleId': { name: '$safeName', icon: '$safeIcon' },")
    }
  }
  $lines.Add("  },")
}

$lines.Add("};")
$lines.Add("")

$lines | Set-Content -Path $modulePath -Encoding utf8

Write-Output "Role icon sync complete."
foreach ($scriptId in $orderedScripts) {
  $total = $scriptRoles[$scriptId].Count
  $ok = $localization[$scriptId].Count
  $miss = $missing[$scriptId].Count
  if ($miss -eq 0) {
    Write-Output "$scriptId : $ok/$total mapped"
  } else {
    Write-Output "$scriptId : $ok/$total mapped, missing -> $($missing[$scriptId] -join ', ')"
  }
}
