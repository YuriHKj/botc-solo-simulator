param(
  [int]$Seed = 270001,
  [int]$FlowTimeoutSeconds = 180,
  [int]$MaxFlowActions = 128,
  [int]$MaxEndgameDay = 8,
  [switch]$IncludeHighRiskRoles,
  [switch]$IncludeSpecialWinRoles,
  [switch]$IncludeSpecialEventRoles,
  [switch]$IncludeDayActionRoles,
  [switch]$IncludePlayerDecisionRoles,
  [string]$PackageDir = "",
  [string]$ArtifactRoot = "",
  [switch]$RestoreRuntimeState,
  [string[]]$Cases = @()
)

$ErrorActionPreference = "Stop"

$demoScript = Join-Path $PSScriptRoot "run_unity_playable_demo.ps1"

$baseCases = @(
  [ordered]@{ Name = "tb-washerwoman"; ScriptId = "tb"; Role = "washerwoman"; Seed = $Seed },
  [ordered]@{ Name = "bmr-grandmother"; ScriptId = "bmr"; Role = "grandmother"; Seed = $Seed },
  [ordered]@{ Name = "snv-clockmaker"; ScriptId = "snv"; Role = "clockmaker"; Seed = $Seed }
)
$highRiskCases = @(
  [ordered]@{ Name = "bmr-zombuul"; ScriptId = "bmr"; Role = "zombuul"; Seed = 270001 },
  [ordered]@{ Name = "bmr-moonchild"; ScriptId = "bmr"; Role = "moonchild"; Seed = 270001; ExpectedStorytellerRole = "moonchild"; MinStorytellerActions = 1 },
  [ordered]@{ Name = "snv-pit-hag"; ScriptId = "snv"; Role = "pit-hag"; Seed = 260609; ExpectedNightActionRole = "pit-hag"; MinNightActions = 1; MinPitHagTransforms = 1 },
  [ordered]@{ Name = "snv-klutz"; ScriptId = "snv"; Role = "klutz"; Seed = 260600; ExpectedStorytellerRole = "klutz"; MinStorytellerActions = 1 }
)
$specialWinCases = @(
  [ordered]@{ Name = "tb-mayor"; ScriptId = "tb"; Role = "mayor"; Seed = 270001 },
  [ordered]@{ Name = "bmr-mastermind"; ScriptId = "bmr"; Role = "mastermind"; Seed = 270001 },
  [ordered]@{ Name = "snv-fang-gu"; ScriptId = "snv"; Role = "fang-gu"; Seed = 270001; ExpectedNightActionRole = "fang-gu"; MinNightActions = 1; MinFangGuJumps = 1 }
)
$specialEventCases = @(
  [ordered]@{ Name = "bmr-shabaloth"; ScriptId = "bmr"; Role = "shabaloth"; Seed = 270001; ExpectedNightActionRole = "shabaloth"; MinNightActions = 1; MinShabalothKills = 1 },
  [ordered]@{ Name = "bmr-professor"; ScriptId = "bmr"; Role = "professor"; Seed = 270005; MinNightActions = 1; ExpectedNightActionRole = "professor"; MinProfessorUsefulActions = 1 },
  [ordered]@{ Name = "snv-vortox"; ScriptId = "snv"; Role = "vortox"; Seed = 270001; ExpectedNightActionRole = "vortox"; MinNightActions = 1; MinVortoxPollutedInfo = 1 },
  [ordered]@{ Name = "snv-evil-twin"; ScriptId = "snv"; Role = "evil-twin"; Seed = 270001 }
)
$dayActionCases = @(
  [ordered]@{ Name = "tb-slayer"; ScriptId = "tb"; Role = "slayer"; Seed = 270001; ResolveFirstDayAction = $true; ExpectedDayActionRole = "slayer"; MinDayActions = 1 },
  [ordered]@{ Name = "bmr-gossip"; ScriptId = "bmr"; Role = "gossip"; Seed = 270001; ResolveFirstDayAction = $true; ExpectedDayActionRole = "gossip"; MinDayActions = 1 },
  [ordered]@{ Name = "snv-artist"; ScriptId = "snv"; Role = "artist"; Seed = 270001; ResolveFirstDayAction = $true; ExpectedDayActionRole = "artist"; MinDayActions = 1 },
  [ordered]@{ Name = "snv-juggler"; ScriptId = "snv"; Role = "juggler"; Seed = 270001; ResolveFirstDayAction = $true; ExpectedDayActionRole = "juggler"; MinDayActions = 1 }
)
$playerDecisionCases = @(
  [ordered]@{ Name = "tb-human-nomination"; ScriptId = "tb"; Role = "washerwoman"; Seed = 270001; ResolveFirstHumanNomination = $true; MinPlayerNominations = 1; MinPlayerVotes = 1 },
  [ordered]@{ Name = "tb-player-vote"; ScriptId = "tb"; Role = "washerwoman"; Seed = 270001; ResolveFirstPlayerVote = $true; MinPlayerVotes = 1 }
)
$allCases = @($baseCases + $highRiskCases + $specialWinCases + $specialEventCases + $dayActionCases + $playerDecisionCases)

function Get-OutputField {
  param(
    [string]$Text,
    [string]$Name
  )

  $field = [regex]::Escape($Name)
  $match = [regex]::Match($Text, "(?m)^[^\S\r\n]*$field[^\S\r\n]*:[^\S\r\n]*(.*?)[^\S\r\n]*$")
  if ($match.Success) {
    return $match.Groups[1].Value.Trim()
  }
  return ""
}

function Convert-OutputBool {
  param([string]$Value)

  return $Value.Trim().ToLowerInvariant() -eq "true"
}

function Assert-MinCaseCount {
  param(
    [object]$Case,
    [string]$PropertyName,
    [int]$Actual,
    [string]$Label
  )

  if (-not $Case.Contains($PropertyName)) {
    return
  }
  $minimum = [int]$Case[$PropertyName]
  if ($Actual -lt $minimum) {
    throw "$($Case.Name) $Label was $Actual, expected at least $minimum."
  }
}

function Expand-CaseNames {
  param([string[]]$Values)

  return @(
    $Values |
      ForEach-Object { "$_".Split(",") } |
      ForEach-Object { $_.Trim() } |
      Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
  )
}

if (-not (Test-Path -LiteralPath $demoScript)) {
  throw "Unity playable demo smoke not found: $demoScript"
}

$requestedCases = Expand-CaseNames $Cases
$selectedCases = if ($requestedCases.Count -gt 0) {
  foreach ($name in $requestedCases) {
    $case = $allCases | Where-Object { $_.Name -eq $name -or "$($_.ScriptId)/$($_.Role)" -eq $name } | Select-Object -First 1
    if (-not $case) {
      throw "Unknown guided endgame matrix case: $name"
    }
    $case
  }
} else {
  $selected = @($baseCases)
  if ($IncludeHighRiskRoles) {
    $selected += $highRiskCases
  }
  if ($IncludeSpecialWinRoles) {
    $selected += $specialWinCases
  }
  if ($IncludeSpecialEventRoles) {
    $selected += $specialEventCases
  }
  if ($IncludeDayActionRoles) {
    $selected += $dayActionCases
  }
  if ($IncludePlayerDecisionRoles) {
    $selected += $playerDecisionCases
  }
  $selected
}

$results = New-Object System.Collections.Generic.List[object]

foreach ($case in $selectedCases) {
  $demoArgs = @(
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", $demoScript,
    "-ScriptId", $case.ScriptId,
    "-Role", $case.Role,
    "-Seed", $case.Seed,
    "-ExternalBridge",
    "-StopAtEndgame",
    "-FlowTimeoutSeconds", $FlowTimeoutSeconds,
    "-MaxFlowActions", $MaxFlowActions
  )
  $useAutoFlow = $true
  if ($case.Contains("ResolveFirstHumanNomination") -and $case.ResolveFirstHumanNomination) {
    $useAutoFlow = $false
  }
  if ($useAutoFlow) {
    $demoArgs += "-AutoFlow"
  }
  $useResolvePlayerDecisions = $true
  if (($case.Contains("ResolveFirstHumanNomination") -and $case.ResolveFirstHumanNomination) -or
      ($case.Contains("ResolveFirstPlayerVote") -and $case.ResolveFirstPlayerVote)) {
    $useResolvePlayerDecisions = $false
  }
  if ($useResolvePlayerDecisions) {
    $demoArgs += "-ResolvePlayerDecisions"
  }
  if (-not [string]::IsNullOrWhiteSpace($PackageDir)) {
    $demoArgs += @("-PackageDir", $PackageDir)
  }
  if ($RestoreRuntimeState -or -not [string]::IsNullOrWhiteSpace($PackageDir)) {
    $demoArgs += "-RestoreRuntimeState"
  }
  if ($case.Contains("ResolveFirstDayAction") -and $case.ResolveFirstDayAction) {
    $demoArgs += "-ResolveFirstDayAction"
  }
  if ($case.Contains("ResolveFirstHumanNomination") -and $case.ResolveFirstHumanNomination) {
    $demoArgs += "-ResolveFirstHumanNomination"
  }
  if ($case.Contains("ResolveFirstPlayerVote") -and $case.ResolveFirstPlayerVote) {
    $demoArgs += "-ResolveFirstPlayerVote"
  }
  if (-not [string]::IsNullOrWhiteSpace($ArtifactRoot)) {
    $demoArgs += @("-ArtifactDir", (Join-Path $ArtifactRoot $case.Name))
  }
  $output = & powershell @demoArgs 2>&1
  $exitCode = $LASTEXITCODE
  $outputText = ($output | Out-String).Trim()
  if ($exitCode -ne 0) {
    throw "$($case.Name) guided endgame smoke failed: $outputText"
  }

  $phase = Get-OutputField $outputText "Phase"
  $winner = Get-OutputField $outputText "Winner"
  $day = [int](Get-OutputField $outputText "Day")
  $gameOver = Convert-OutputBool (Get-OutputField $outputText "GameOver")
  $stoppedAt = Get-OutputField $outputText "AutoAdvanceStoppedAt"
  $lastActionType = Get-OutputField $outputText "LastActionType"
  $nightActionCount = [int](Get-OutputField $outputText "NightActionCount")
  $nightActionRoles = Get-OutputField $outputText "NightActionRoles"
  $dayActionCount = [int](Get-OutputField $outputText "DayActionCount")
  $dayActionRoles = Get-OutputField $outputText "DayActionRoles"
  $professorReviveCount = [int](Get-OutputField $outputText "ProfessorReviveCount")
  $professorWaitCount = [int](Get-OutputField $outputText "ProfessorWaitCount")
  $professorUsefulActionCount = [int](Get-OutputField $outputText "ProfessorUsefulActionCount")
  $shabalothReviveCount = [int](Get-OutputField $outputText "ShabalothReviveCount")
  $shabalothKillCount = [int](Get-OutputField $outputText "ShabalothKillCount")
  $pitHagTransformCount = [int](Get-OutputField $outputText "PitHagTransformCount")
  $pitHagBalanceDeathCount = [int](Get-OutputField $outputText "PitHagBalanceDeathCount")
  $fangGuJumpCount = [int](Get-OutputField $outputText "FangGuJumpCount")
  $vortoxPollutedInfoCount = [int](Get-OutputField $outputText "VortoxPollutedInfoCount")
  $pendingStoryteller = Convert-OutputBool (Get-OutputField $outputText "FinalPendingStorytellerAvailable")
  $storytellerQueueCount = [int](Get-OutputField $outputText "FinalStorytellerQueueCount")
  $storytellerActionCount = [int](Get-OutputField $outputText "StorytellerActionCount")
  $storytellerActionRoles = Get-OutputField $outputText "StorytellerActionRoles"
  $playerNominationActionId = Get-OutputField $outputText "PlayerNominationActionId"
  $playerVoteActionId = Get-OutputField $outputText "PlayerVoteActionId"
  $humanNightAction = Convert-OutputBool (Get-OutputField $outputText "HumanNightActionAvailable")
  $humanDayAction = Convert-OutputBool (Get-OutputField $outputText "HumanDayActionAvailable")

  if ($phase -ne "ended" -or $gameOver -ne $true -or @("good", "evil") -notcontains $winner) {
    throw "$($case.Name) did not reach a concrete endgame. phase=$phase gameOver=$gameOver winner=$winner"
  }
  if (-not [string]::IsNullOrWhiteSpace($stoppedAt) -and $stoppedAt -ne "ended") {
    throw "$($case.Name) auto-advance stopped at $stoppedAt instead of ended."
  }
  if ([string]::IsNullOrWhiteSpace($stoppedAt) -and @("night-action", "day-action", "storyteller-action", "resolve-nomination-vote", "auto-advance") -notcontains $lastActionType) {
    throw "$($case.Name) reached endgame after an unexpected final action: $lastActionType"
  }
  if ($day -gt $MaxEndgameDay) {
    throw "$($case.Name) reached endgame too slowly for the guided smoke. day=$day max=$MaxEndgameDay"
  }
  if ($pendingStoryteller -or $storytellerQueueCount -ne 0) {
    throw "$($case.Name) ended with unresolved Storyteller work. pending=$pendingStoryteller queue=$storytellerQueueCount"
  }
  if ($humanNightAction -or $humanDayAction) {
    throw "$($case.Name) ended with a pending human action. night=$humanNightAction day=$humanDayAction"
  }
  $minNightActions = 0
  if ($case.Contains("MinNightActions")) {
    $minNightActions = [int]$case.MinNightActions
  }
  if ($nightActionCount -lt $minNightActions) {
    throw "$($case.Name) submitted $nightActionCount night action(s), expected at least $minNightActions."
  }
  $expectedNightActionRole = ""
  if ($case.Contains("ExpectedNightActionRole")) {
    $expectedNightActionRole = $case.ExpectedNightActionRole
  }
  if (-not [string]::IsNullOrWhiteSpace($expectedNightActionRole) -and $nightActionRoles -notmatch "(^|,)$([regex]::Escape($expectedNightActionRole))(,|$)") {
    throw "$($case.Name) night action roles did not include $expectedNightActionRole`: $nightActionRoles"
  }
  $minDayActions = 0
  if ($case.Contains("MinDayActions")) {
    $minDayActions = [int]$case.MinDayActions
  }
  if ($dayActionCount -lt $minDayActions) {
    throw "$($case.Name) submitted $dayActionCount day action(s), expected at least $minDayActions."
  }
  $expectedDayActionRole = ""
  if ($case.Contains("ExpectedDayActionRole")) {
    $expectedDayActionRole = $case.ExpectedDayActionRole
  }
  if (-not [string]::IsNullOrWhiteSpace($expectedDayActionRole) -and $dayActionRoles -notmatch "(^|,)$([regex]::Escape($expectedDayActionRole))(,|$)") {
    throw "$($case.Name) day action roles did not include $expectedDayActionRole`: $dayActionRoles"
  }
  $minPlayerNominations = 0
  if ($case.Contains("MinPlayerNominations")) {
    $minPlayerNominations = [int]$case.MinPlayerNominations
  }
  if ($minPlayerNominations -gt 0 -and [string]::IsNullOrWhiteSpace($playerNominationActionId)) {
    throw "$($case.Name) did not submit a player nomination action."
  }
  $minPlayerVotes = 0
  if ($case.Contains("MinPlayerVotes")) {
    $minPlayerVotes = [int]$case.MinPlayerVotes
  }
  if ($minPlayerVotes -gt 0 -and [string]::IsNullOrWhiteSpace($playerVoteActionId)) {
    throw "$($case.Name) did not submit a player vote action."
  }
  Assert-MinCaseCount $case "MinProfessorRevives" $professorReviveCount "ProfessorReviveCount"
  Assert-MinCaseCount $case "MinProfessorWaits" $professorWaitCount "ProfessorWaitCount"
  Assert-MinCaseCount $case "MinProfessorUsefulActions" $professorUsefulActionCount "ProfessorUsefulActionCount"
  Assert-MinCaseCount $case "MinShabalothRevives" $shabalothReviveCount "ShabalothReviveCount"
  Assert-MinCaseCount $case "MinShabalothKills" $shabalothKillCount "ShabalothKillCount"
  Assert-MinCaseCount $case "MinPitHagTransforms" $pitHagTransformCount "PitHagTransformCount"
  Assert-MinCaseCount $case "MinPitHagBalanceDeaths" $pitHagBalanceDeathCount "PitHagBalanceDeathCount"
  Assert-MinCaseCount $case "MinFangGuJumps" $fangGuJumpCount "FangGuJumpCount"
  Assert-MinCaseCount $case "MinVortoxPollutedInfo" $vortoxPollutedInfoCount "VortoxPollutedInfoCount"
  $minStorytellerActions = 0
  if ($case.Contains("MinStorytellerActions")) {
    $minStorytellerActions = [int]$case.MinStorytellerActions
  }
  if ($storytellerActionCount -lt $minStorytellerActions) {
    throw "$($case.Name) submitted $storytellerActionCount Storyteller action(s), expected at least $minStorytellerActions."
  }
  $expectedStorytellerRole = ""
  if ($case.Contains("ExpectedStorytellerRole")) {
    $expectedStorytellerRole = $case.ExpectedStorytellerRole
  }
  if (-not [string]::IsNullOrWhiteSpace($expectedStorytellerRole) -and $storytellerActionRoles -notmatch "(^|,)$([regex]::Escape($expectedStorytellerRole))(,|$)") {
    throw "$($case.Name) Storyteller roles did not include $expectedStorytellerRole`: $storytellerActionRoles"
  }

  $results.Add([PSCustomObject]@{
    Name = $case.Name
    ScriptId = $case.ScriptId
    Role = $case.Role
    Seed = $case.Seed
    Phase = $phase
    Day = $day
    GameOver = $gameOver
    Winner = $winner
    AutoAdvanceStoppedAt = $stoppedAt
    LastActionType = $lastActionType
    NightActionCount = $nightActionCount
    NightActionRoles = $nightActionRoles
    DayActionCount = $dayActionCount
    DayActionRoles = $dayActionRoles
    PlayerNominationActionId = $playerNominationActionId
    PlayerVoteActionId = $playerVoteActionId
    ProfessorReviveCount = $professorReviveCount
    ProfessorWaitCount = $professorWaitCount
    ProfessorUsefulActionCount = $professorUsefulActionCount
    ShabalothReviveCount = $shabalothReviveCount
    ShabalothKillCount = $shabalothKillCount
    PitHagTransformCount = $pitHagTransformCount
    PitHagBalanceDeathCount = $pitHagBalanceDeathCount
    FangGuJumpCount = $fangGuJumpCount
    VortoxPollutedInfoCount = $vortoxPollutedInfoCount
    StorytellerActionCount = $storytellerActionCount
    StorytellerActionRoles = $storytellerActionRoles
    FinalStorytellerQueueCount = $storytellerQueueCount
    HumanNightActionAvailable = $humanNightAction
    HumanDayActionAvailable = $humanDayAction
  }) | Out-Null
}

$results | Format-List
