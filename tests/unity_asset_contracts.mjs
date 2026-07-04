import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { getAllRoles, getRoleById, SCRIPT_MAP } from "../scripts/data.js";

const root = process.cwd();
const roleScripts = ["tb", "bmr", "snv"];
const sourceRoleRoot = path.join(root, "assets", "roles");
const unityRoleRoot = path.join(root, "unity-prototype", "Assets", "Resources", "Botc", "roles");
const sourceUiRoot = path.join(root, "assets", "ui");
const unityUiRoot = path.join(root, "unity-prototype", "Assets", "Resources", "Botc", "ui");
const sourceAudioRoot = path.join(root, "assets", "audio");
const unityAudioRoot = path.join(root, "unity-prototype", "Assets", "Resources", "Botc", "audio");
const unityBootstrapPath = path.join(root, "unity-prototype", "Assets", "Scripts", "BotcPrototypeBootstrap.cs");
const unityCoreInteropPath = path.join(root, "unity-prototype", "Assets", "Scripts", "BotcPrototypeBootstrap.CoreInterop.cs");
const unityMenuSettingsPath = path.join(root, "unity-prototype", "Assets", "Scripts", "BotcPrototypeBootstrap.MenuSettings.cs");
const unityActionFormsPath = path.join(root, "unity-prototype", "Assets", "Scripts", "BotcPrototypeBootstrap.ActionForms.cs");
const unityGrimoirePath = path.join(root, "unity-prototype", "Assets", "Scripts", "BotcPrototypeBootstrap.Grimoire.cs");
const unityStorytellerPath = path.join(root, "unity-prototype", "Assets", "Scripts", "BotcPrototypeBootstrap.Storyteller.cs");
const unityRolePickerPath = path.join(root, "unity-prototype", "Assets", "Scripts", "BotcPrototypeBootstrap.RolePicker.cs");
const unityHandbookPath = path.join(root, "unity-prototype", "Assets", "Scripts", "BotcPrototypeBootstrap.Handbook.cs");
const unityNominationVotePath = path.join(root, "unity-prototype", "Assets", "Scripts", "BotcPrototypeBootstrap.NominationVote.cs");
const unityInfoDrawerPath = path.join(root, "unity-prototype", "Assets", "Scripts", "BotcPrototypeBootstrap.InfoDrawer.cs");
const unityPrivateChatPath = path.join(root, "unity-prototype", "Assets", "Scripts", "BotcPrototypeBootstrap.PrivateChat.cs");
const unityStageDialoguePath = path.join(root, "unity-prototype", "Assets", "Scripts", "BotcPrototypeBootstrap.StageDialogue.cs");
const unitySmokeFixturePath = path.join(root, "scripts", "unity_ui_smoke_fixture.mjs");
const unitySmokeCapturePath = path.join(root, "tools", "capture_unity_ui_smoke.ps1");
const unityPlayableNodeCapturePath = path.join(root, "tools", "capture_unity_playable_path_nodes.ps1");
const unitySmokeVisualVerifierPath = path.join(root, "tools", "verify_unity_ui_smoke.ps1");
const unitySmokeFullBaselineVerifierPath = path.join(root, "tools", "verify_unity_full_ui_baseline.ps1");
const unityAiPackageScriptPath = path.join(root, "tools", "package_unity_ai_release.ps1");
const unityAiPackageVerifierPath = path.join(root, "tools", "verify_unity_ai_package.ps1");
const unityAiReleaseGatePath = path.join(root, "tools", "build_verify_unity_ai_release.ps1");
const menuSetupSourcePath = path.join(root, "assets", "data", "unity_menu_setup.json");
const menuSetupUnityPath = path.join(root, "unity-prototype", "Assets", "Resources", "Botc", "data", "menu_setup.json");

function fileExists(filePath) {
  return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
}

function listPngFiles(dir) {
  return listFilesByExtension(dir, ".png");
}

function listMp3Files(dir) {
  return listFilesByExtension(dir, ".mp3");
}

function listFilesByExtension(dir, extension) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(extension))
    .map((entry) => entry.name)
    .sort();
}

function extractPowershellStringArray(source, variableName) {
  const pattern = new RegExp(`\\$${variableName}\\s*=\\s*@\\(([\\s\\S]*?)\\)`);
  const match = source.match(pattern);
  assert.ok(match, `PowerShell source should define $${variableName} as a string array`);
  return [...match[1].matchAll(/"([^"]+)"/g)].map((item) => item[1]);
}

function testUnityHasEveryScriptRoleIcon() {
  for (const scriptId of roleScripts) {
    for (const role of getAllRoles(scriptId)) {
      assert.ok(
        fileExists(path.join(sourceRoleRoot, scriptId, `${role.id}.png`)),
        `Electron asset source should include ${scriptId}/${role.id}.png`
      );
      assert.ok(
        fileExists(path.join(unityRoleRoot, `${role.id}.png`)),
        `Unity Resources should include role icon ${role.id}.png`
      );
    }
  }
}

function testUnityHasEveryUiAsset() {
  for (const fileName of listPngFiles(sourceUiRoot)) {
    assert.ok(fileExists(path.join(unityUiRoot, fileName)), `Unity Resources should include ui asset ${fileName}`);
  }
}

function testUnityHasEveryAudioAsset() {
  for (const fileName of listMp3Files(sourceAudioRoot)) {
    assert.ok(fileExists(path.join(unityAudioRoot, fileName)), `Unity Resources should include audio asset ${fileName}`);
  }
}

function testUnityMenuSetupUsesCoreRoleIds() {
  for (const filePath of [menuSetupSourcePath, menuSetupUnityPath]) {
    assert.ok(fileExists(filePath), `Unity menu setup should exist: ${path.relative(root, filePath)}`);
    const catalog = JSON.parse(fs.readFileSync(filePath, "utf8"));
    assert.ok(Array.isArray(catalog.scripts) && catalog.scripts.length > 0, "menu setup should list scripts");
    for (const script of catalog.scripts) {
      assert.ok(SCRIPT_MAP[script.id], `menu setup script id should be known by JS Core: ${script.id}`);
      assert.ok(Array.isArray(script.roles) && script.roles.length > 0, `menu setup should list roles for ${script.id}`);
      for (const role of script.roles) {
        assert.ok(
          getRoleById(script.id, role.id),
          `menu setup role id should be a JS Core role id: ${script.id}/${role.id}`
        );
      }
    }
  }
}

function testUnityNominationDebateRendersRationaleCards() {
  const viewModelSource = fs.readFileSync(unityBootstrapPath, "utf8");
  const nominationSource = fs.readFileSync(unityNominationVotePath, "utf8");

  assert.ok(
    viewModelSource.includes("RationaleCardViewModel[] rationaleCards"),
    "Unity C# viewmodel should deserialize nomination rationale cards"
  );
  assert.ok(
    viewModelSource.includes("string evidenceModeLine") &&
      viewModelSource.includes("string responsePlanLine") &&
      viewModelSource.includes("string sourceReliabilityLine") &&
      viewModelSource.includes("string timelineConsistencyLine") &&
      viewModelSource.includes("string roleHypothesisLine"),
    "Unity C# rationale cards should deserialize raw decision-rationale lines for future drilldown"
  );
  assert.ok(
    nominationSource.includes("RenderNominationRationaleCards"),
    "Unity nomination debate panel should render rationale cards"
  );
  assert.ok(
    nominationSource.includes("RationaleCardRawLine(card)"),
    "Unity nomination rationale cards should fall back to raw rationale lines when compact detail is absent"
  );
  assert.ok(
    nominationSource.includes("RationaleCardHasVisibleText") &&
      nominationSource.includes("RationaleCardSectionLine(card, 1)") &&
      nominationSource.includes("RationaleCardSectionLine(card, 3)"),
    "Unity nomination rationale cards should surface raw rationale fields as card-level reasoning sections"
  );
  assert.ok(
    nominationSource.includes("VisibleNominationRationaleCards"),
    "Unity nomination debate panel should preserve old layout when rationale cards are absent"
  );
  assert.ok(
    nominationSource.includes("Nomination Debate Duel Rail") &&
      nominationSource.includes("RenderNominationDebateDuelRail") &&
      nominationSource.includes("NominationDebateDuelStageIndex") &&
      nominationSource.includes("NominationDebateDuelStateLabel") &&
      nominationSource.includes('AddNominationDebateDuelNode(nominationDebateDuelRoot, "Vote"'),
    "Unity nomination debate panel should expose a compact accusation-defense-vote duel rail"
  );
  assert.ok(
    viewModelSource.includes("RectTransform nominationDebateFocusRoot") &&
      nominationSource.includes("Nomination Debate Focus Strip") &&
      nominationSource.includes("RenderNominationDebateFocusStrip") &&
      nominationSource.includes("Nomination Debate Focus Route Beam") &&
      nominationSource.includes("Nomination Debate Focus Active Underline"),
    "Unity nomination debate panel should expose a header focus strip for nominator, nominee, and current duel state"
  );
}

function testUnityVoteCeremonyRendersRationaleCards() {
  const viewModelSource = fs.readFileSync(unityBootstrapPath, "utf8");
  const nominationSource = fs.readFileSync(unityNominationVotePath, "utf8");

  assert.ok(
    viewModelSource.includes("VoteRationaleViewModel") && viewModelSource.includes("VoteRationaleViewModel voteRationale"),
    "Unity C# vote ceremony viewmodel should deserialize formal AI vote rationale"
  );
  assert.ok(
    nominationSource.includes("RenderVoteRationaleCards"),
    "Unity vote ceremony should render formal vote rationale cards"
  );
  assert.ok(
    nominationSource.includes("Vote Rationale History") && nominationSource.includes("已揭示理由"),
    "Unity vote ceremony should surface revealed voter rationale history"
  );
  assert.ok(
    nominationSource.includes("Take(asked)") && nominationSource.includes("投票理由会跟随逐位询问出现"),
    "Unity vote ceremony should not reveal future voter rationale before the animation reaches that voter"
  );
  assert.ok(
    nominationSource.includes("Take(15)") &&
      nominationSource.includes("var dense = voterCount > 12") &&
      nominationSource.includes("VoteTokenLabelOffset") &&
      nominationSource.includes("Vote Tally Rail") &&
      nominationSource.includes("AddVoteTallyChip") &&
      nominationSource.includes("RenderVoteThresholdMeter") &&
      nominationSource.includes("Vote Threshold Marker"),
    "Unity vote ceremony should keep all 15 voters readable with dense labels, a tally rail, and a threshold meter"
  );
  assert.ok(
    nominationSource.includes("RenderVoteActiveVoterSpotlight") &&
      nominationSource.includes("Vote Active Voter Spotlight") &&
      nominationSource.includes("Vote Active Voter Beam") &&
      nominationSource.includes("Vote Active Voter Halo") &&
      nominationSource.includes("VoteActiveVoterAccent"),
    "Unity vote ceremony should spotlight the current voter inside the dense 15-player ring"
  );
  const voteCenterCountCall = nominationSource.match(/AddText\("Vote Center Count"[\s\S]*?\);/);
  assert.ok(
    voteCenterCountCall &&
      voteCenterCountCall[0].includes("shownYes") &&
      !voteCenterCountCall[0].includes("vote.yesVotes") &&
      nominationSource.includes("var finalRevealed = asked >= voters.Length") &&
      nominationSource.includes('var passedText = finalRevealed'),
    "Unity vote ceremony center count should use only currently revealed yes votes until the vote animation finishes"
  );
}

function testUnityNominationVoteControlsExplicitHumanVote() {
  const coreInteropSource = fs.readFileSync(unityCoreInteropPath, "utf8");
  const nominationSource = fs.readFileSync(unityNominationVotePath, "utf8");
  const stageDialogueSource = fs.readFileSync(unityStageDialoguePath, "utf8");

  assert.ok(
    coreInteropSource.includes("bool? humanVoteYes = null") &&
      coreInteropSource.includes("humanVoteYes.HasValue") &&
      coreInteropSource.includes("humanVoteYes.Value ?"),
    "Unity action writer should support explicit humanVoteYes payloads"
  );
  assert.ok(
    nominationSource.includes("投赞成") &&
      nominationSource.includes("不投票") &&
      nominationSource.includes("ResolveNominationDebateToVote(true)") &&
      nominationSource.includes("ResolveNominationDebateToVote(false)") &&
      nominationSource.includes("humanVoteYes: humanVoteYes"),
    "Unity nomination debate controls should let the player choose yes or no before resolving a vote"
  );
  assert.ok(
    stageDialogueSource.includes("RenderNominationDebatePanel();") &&
      !/mode == "nomination"\)\s*\{\s*ResolveNominationDebateToVote\(\);/.test(stageDialogueSource),
    "Unity stage-dialogue source action should reopen the vote choice panel instead of implicitly spending a vote"
  );
}

function testUnityPhaseAssistKeepsReadablePublicActionFocus() {
  const viewModelSource = fs.readFileSync(unityBootstrapPath, "utf8");
  const nominationSource = fs.readFileSync(unityNominationVotePath, "utf8");
  const smokeFixtureSource = fs.readFileSync(unitySmokeFixturePath, "utf8");
  const smokeCaptureSource = fs.readFileSync(unitySmokeCapturePath, "utf8");

  assert.ok(
    viewModelSource.includes("RectTransform phaseAssistSignalRoot"),
    "Unity phase assist should keep a compact signal strip root for nomination/debate states"
  );
  assert.ok(
    viewModelSource.includes("Image phaseAssistProgressTrack"),
    "Unity phase assist should keep a handle to the progress track so public talk can hide meter chrome"
  );
  assert.ok(
    nominationSource.includes("Phase Assist Signal Strip") &&
      nominationSource.includes("RenderPhaseAssistSignalStrip") &&
      nominationSource.includes("Phase Assist Signal Chip") &&
      nominationSource.includes("PhaseAssistPublicActionLabel"),
    "Unity phase assist should preserve compact nomination/debate status chips and shared action labels"
  );
  assert.ok(
    !viewModelSource.includes("RectTransform phaseAssistPublicRouteRoot") &&
      !nominationSource.includes("Phase Assist Public Route Strip") &&
      !nominationSource.includes("RenderPhaseAssistPublicRoute") &&
      nominationSource.includes('phaseAssistPanel = AddPanel("Phase Assist Panel"') &&
      nominationSource.includes("new Vector2(-560f, -168f)") &&
      nominationSource.includes("phaseAssistHintText = AddText") &&
      nominationSource.includes("new Vector2(24f, 64f)") &&
      nominationSource.includes("vm?.dialogueText") &&
      nominationSource.includes("SetPhaseAssistProgressVisible(false)") &&
      nominationSource.includes('phaseAssistSignalRoot.gameObject.SetActive(false)'),
    "Unity public phase assist should be a readable single-focus action table, not a narrow route/chip strip over the board"
  );
  assert.ok(
    nominationSource.includes("PhaseAssistRouteLabel") &&
      nominationSource.includes("PhaseAssistNominationStatusLabel") &&
      nominationSource.includes("NominationDebateDuelStateLabel"),
    "Unity phase assist chips should also summarize nomination and debate states"
  );
  assert.ok(
    smokeFixtureSource.includes("function preparePhaseAssistPublic") &&
      smokeFixtureSource.includes('"phase-assist-public": preparePhaseAssistPublic') &&
      smokeFixtureSource.includes("phase-assist-public smoke should expose an active public conversation"),
    "Unity UI smoke should directly cover the public phase-assist panel"
  );
  assert.ok(
    smokeCaptureSource.includes('"phase-assist-public"'),
    "Unity full UI smoke default state list should include the public phase-assist panel"
  );
}

function testUnityPhaseAssistPrimaryUsesDecisionAutoAdvance() {
  const viewModelSource = fs.readFileSync(unityBootstrapPath, "utf8");
  const nominationSource = fs.readFileSync(unityNominationVotePath, "utf8");
  const coreInteropSource = fs.readFileSync(unityCoreInteropPath, "utf8");

  assert.ok(
    nominationSource.includes('SendUnityAction("auto-advance", mode: "decision")'),
    "Unity phase assist primary action should advance to the next real player decision, not just one public line"
  );
  assert.ok(
    coreInteropSource.includes("!string.IsNullOrWhiteSpace(mode)") && coreInteropSource.includes("JsonEscape(mode)"),
    "Unity action writer should serialize the decision mode payload for auto-advance"
  );
  assert.ok(
    viewModelSource.includes("AutoAdvanceViewModel autoAdvance") &&
      viewModelSource.includes("AutoAdvanceStepViewModel[] steps") &&
      viewModelSource.includes("string stoppedAt"),
    "Unity C# viewmodel should deserialize auto-advance stop summaries for playable-flow debugging"
  );
  assert.ok(
    coreInteropSource.includes('completedType == "auto-advance"') &&
      coreInteropSource.includes("FocusAutoAdvanceStop") &&
      coreInteropSource.includes('stoppedAt == "storyteller-action"') &&
      coreInteropSource.includes("OpenStorytellerPanel()") &&
      coreInteropSource.includes('stoppedAt == "human-night-action"') &&
      coreInteropSource.includes('OpenActionFormPanel("night-action")') &&
      coreInteropSource.includes('stoppedAt == "human-day-action"') &&
      coreInteropSource.includes('OpenActionFormPanel("day-action")'),
    "Unity auto-advance should focus the panel for the next human/Storyteller decision"
  );
  assert.ok(
    coreInteropSource.includes('completedType == "night-action"') &&
      coreInteropSource.includes("FocusCompletedNightAction") &&
      coreInteropSource.includes("CloseActionFormPanel()") &&
      coreInteropSource.includes("vm.pendingStorytellerAction.available") &&
      coreInteropSource.includes("OpenStorytellerPanel()"),
    "Unity completed night actions should close stale forms and focus Storyteller gates"
  );
  assert.ok(
    coreInteropSource.includes('completedType == "storyteller-action"') &&
      coreInteropSource.includes("FocusCompletedStorytellerAction") &&
      coreInteropSource.includes("CloseStorytellerPanel()") &&
      coreInteropSource.includes('vm?.phase == "night"') &&
      coreInteropSource.includes("vm.humanNightAction.available") &&
      coreInteropSource.includes('OpenActionFormPanel("night-action")'),
    "Unity completed Storyteller actions should hand off to the next human night action when night resumes"
  );
  assert.ok(
    coreInteropSource.includes('completedType == "phase" || completedType == "pass-nomination-window"') &&
      coreInteropSource.includes("FocusCompletedFlowAdvance") &&
      coreInteropSource.includes("vm.pendingStorytellerAction.available") &&
      coreInteropSource.includes('vm?.phase == "night"') &&
      coreInteropSource.includes("vm.humanNightAction.available") &&
      coreInteropSource.includes('OpenActionFormPanel("night-action")'),
    "Unity phase/day-end flow actions should focus Storyteller gates or the next human night action"
  );
}

function testUnityEndgameRendersRecapRail() {
  const viewModelSource = fs.readFileSync(unityBootstrapPath, "utf8");
  const smokeFixtureSource = fs.readFileSync(unitySmokeFixturePath, "utf8");

  assert.ok(
    viewModelSource.includes("RectTransform endgameEventRailRoot"),
    "Unity endgame panel should keep a recap rail root above final event cards"
  );
  assert.ok(
    viewModelSource.includes("Endgame Event Recap Rail") &&
      viewModelSource.includes("RenderEndgameEventRail") &&
      viewModelSource.includes('AddEndgameEventRailNode(endgameEventRailRoot, "Review"') &&
      viewModelSource.includes("EndgameEventRailHint"),
    "Unity endgame panel should render a compact final-events-to-recap rail"
  );
  assert.ok(
    viewModelSource.includes("RectTransform endgameVerdictFocusRoot") &&
      viewModelSource.includes("Endgame Verdict Focus Strip") &&
      viewModelSource.includes("RenderEndgameVerdictFocusStrip") &&
      viewModelSource.includes("Endgame Verdict Focus Connector") &&
      viewModelSource.includes("AddEndgameVerdictFocusChip"),
    "Unity endgame panel should render a compact verdict focus strip for winner, cycle, and review count"
  );
  assert.ok(
    smokeFixtureSource.includes('"endgame": prepareEndgame') &&
      smokeFixtureSource.includes("endgame smoke should expose final events"),
    "Unity endgame smoke should continue exercising final event recap data"
  );
}

function testUnityTimelineRendersRationaleSummary() {
  const viewModelSource = fs.readFileSync(unityBootstrapPath, "utf8");
  const infoDrawerSource = fs.readFileSync(unityInfoDrawerPath, "utf8");
  const smokeFixtureSource = fs.readFileSync(unitySmokeFixturePath, "utf8");

  assert.ok(
    viewModelSource.includes("string rationaleSummary"),
    "Unity C# timeline viewmodel should deserialize rationaleSummary"
  );
  assert.ok(
    infoDrawerSource.includes("InfoTimelineBody"),
    "Unity info drawer should render a timeline rationale body"
  );
  assert.ok(
    infoDrawerSource.includes("rationaleSummary"),
    "Unity info drawer should surface timeline rationale summaries"
  );
  assert.ok(
    infoDrawerSource.includes("InfoTimelineRationaleCardsLine") &&
      infoDrawerSource.includes("entry.rationaleCards") &&
      infoDrawerSource.includes("PlayerFacingRationaleLabel") &&
      infoDrawerSource.includes("补充："),
    "Unity info drawer should surface compact player-facing timeline insight summaries"
  );
  assert.ok(
    infoDrawerSource.includes("AddInfoTimelineRationaleDrilldown") &&
      infoDrawerSource.includes("Info Timeline Insight Drilldown") &&
      infoDrawerSource.includes("AddInfoTimelineRationaleCard") &&
      infoDrawerSource.includes("Info Timeline Insight Card") &&
      infoDrawerSource.includes("VisibleInfoTimelineRationaleCards") &&
      infoDrawerSource.includes("TimelineEntryHasRationaleCards") &&
      infoDrawerSource.includes("InfoTimelineRationaleAccent"),
    "Unity info drawer should render a dedicated player-facing timeline insight drilldown strip"
  );
  assert.ok(
    infoDrawerSource.includes("RationaleCardRawLine") &&
      infoDrawerSource.includes("verificationLine") &&
      infoDrawerSource.includes("roleHypothesisLine"),
    "Unity info drawer timeline rationale card recap should preserve raw rationale line fallbacks"
  );
  assert.ok(
      infoDrawerSource.includes("RationaleCardSectionLine(card, 2)") &&
      infoDrawerSource.includes("RationaleCardTimelineText") &&
      infoDrawerSource.includes("RationaleCardHasVisibleText") &&
      infoDrawerSource.includes('RationaleCardSection("依据"') &&
      infoDrawerSource.includes('RationaleCardSection("计划"') &&
      infoDrawerSource.includes('RationaleCardSection("复查"') &&
      infoDrawerSource.includes('RationaleCardSection("身份"'),
    "Unity info drawer timeline rationale cards should expose player-facing card-level reasoning sections"
  );
  assert.ok(
    infoDrawerSource.includes("InfoTimelineRationaleCardTraceLine") &&
      infoDrawerSource.includes("RationaleCardMatchupTraceLine") &&
      infoDrawerSource.includes("RationaleCardEvidenceTraceLine") &&
      infoDrawerSource.includes("RationaleCardNextCheckTraceLine") &&
      infoDrawerSource.includes("card.targetName") &&
      infoDrawerSource.includes("card.runnerUpName") &&
      infoDrawerSource.includes("card.evidenceMode") &&
      infoDrawerSource.includes("card.sourceReliabilityLine") &&
      infoDrawerSource.includes("card.verificationLine") &&
      infoDrawerSource.includes("card.responsePlanLine"),
    "Unity timeline insight drilldown cards should retain target-vs-runner, evidence source, and next-check data without exposing internal labels"
  );
  assert.ok(
    viewModelSource.includes("AiReasoningRecapViewModel[] aiReasoningRecap"),
    "Unity C# viewmodel should deserialize grouped AI reasoning recaps"
  );
  assert.ok(
    viewModelSource.includes("AiReasoningEvidenceViewModel[] evidenceSnippets"),
    "Unity C# reasoning recap should deserialize evidence snippets"
  );
  assert.ok(
    viewModelSource.includes("AiReasoningScorePointViewModel[] scoreTrail"),
    "Unity C# reasoning recap should deserialize score movement"
  );
  assert.ok(
    viewModelSource.includes("AiReasoningEvidenceRowViewModel[] evidenceRows"),
    "Unity C# reasoning score points should deserialize source evidence rows"
  );
  assert.ok(
    viewModelSource.includes("string timelineEntryId") &&
      viewModelSource.includes("int timelineIndex = -1") &&
      viewModelSource.includes("string timelineText"),
    "Unity C# reasoning evidence rows should deserialize optional per-evidence timeline anchors"
  );
  assert.ok(
    viewModelSource.includes("AiReasoningComparisonTraceViewModel") &&
      viewModelSource.includes("AiReasoningComparisonTraceViewModel comparisonTrace"),
    "Unity C# reasoning score points should deserialize target-vs-runner-up comparison traces"
  );
  assert.ok(
    viewModelSource.includes("VoteRationaleViewModel") && viewModelSource.includes("VoteRationaleViewModel voteRationale"),
    "Unity C# vote ceremony viewmodel should deserialize formal AI vote rationale"
  );
  assert.ok(
    viewModelSource.includes("ClaimDisclosureRationaleViewModel") &&
      viewModelSource.includes("ClaimDisclosureRationaleViewModel claimDisclosureRationale"),
    "Unity C# timeline viewmodel should deserialize claim-disclosure rationale"
  );
  assert.ok(
    /ClaimDisclosureRationaleViewModel\s*\{[^}]*string continuity;[^}]*string continuityLine;/.test(viewModelSource),
    "Unity C# claim-disclosure rationale should deserialize continuity metadata"
  );
  assert.ok(
    /ClaimDisclosureRationaleViewModel\s*\{[^}]*string previousRoleId;[^}]*string previousRoleName;[^}]*string previousRangeLabel;[^}]*string continuitySummary;/.test(viewModelSource),
    "Unity C# claim-disclosure rationale should deserialize previous/current claim continuity summaries"
  );
  assert.ok(
    viewModelSource.includes("CrossDayStanceViewModel") &&
      viewModelSource.includes("CrossDayStanceViewModel crossDayStance"),
    "Unity C# timeline viewmodel should deserialize cross-day stance rationale"
  );
  assert.ok(
    viewModelSource.includes("CrossDayEvidenceAnchorViewModel") &&
      viewModelSource.includes("currentEvidenceAnchors") &&
      viewModelSource.includes("previousEvidenceAnchors"),
    "Unity C# cross-day stance viewmodel should deserialize evidence anchors"
  );
  assert.ok(
    viewModelSource.includes("CrossDayEventAnchorViewModel") &&
      viewModelSource.includes("currentEventAnchors") &&
      viewModelSource.includes("timelineEntryId"),
    "Unity C# cross-day stance viewmodel should deserialize source event anchors"
  );
  assert.ok(
    viewModelSource.includes("CrossDayScoreTrailAnchorViewModel") &&
      viewModelSource.includes("currentScoreTrailAnchors") &&
      viewModelSource.includes("appliedDelta"),
    "Unity C# cross-day stance viewmodel should deserialize score-trail anchors"
  );
  assert.ok(
    /AiReasoningScorePointViewModel\s*\{[^}]*CrossDayStanceViewModel crossDayStance/.test(viewModelSource),
    "Unity C# reasoning score points should deserialize cross-day stance rationale"
  );
  assert.ok(
    /AiReasoningScorePointViewModel\s*\{[^}]*ClaimDisclosureRationaleViewModel claimDisclosureRationale/.test(viewModelSource),
    "Unity C# reasoning score points should deserialize claim-disclosure rationale"
  );
  assert.ok(
    /AiReasoningScorePointViewModel\s*\{[^}]*string timelineEntryId;[^}]*int timelineIndex;[^}]*string timelineText;[^}]*float timestamp;/.test(viewModelSource),
    "Unity C# reasoning score points should deserialize timeline anchors"
  );
  assert.ok(
    infoDrawerSource.includes("AddAiReasoningRecapCard"),
    "Unity recap tab should render grouped AI reasoning recaps"
  );
  assert.ok(
    infoDrawerSource.includes("ReasoningEvidenceLine"),
    "Unity recap tab should render reasoning evidence snippets"
  );
  assert.ok(
    infoDrawerSource.includes("ReasoningScoreDeltaLabel"),
    "Unity recap tab should render reasoning score movement"
  );
  assert.ok(
    infoDrawerSource.includes("证据行："),
    "Unity recap tab should render score-trail evidence row drilldown"
  );
  assert.ok(
    infoDrawerSource.includes("AddAiReasoningEvidenceDrilldownCard"),
    "Unity recap tab should render a dedicated reasoning evidence drilldown card"
  );
  assert.ok(
    infoDrawerSource.includes("AI Reasoning Latest Decision Snapshot") &&
      infoDrawerSource.includes("ReasoningLatestDecisionSnapshotLine") &&
      infoDrawerSource.includes("ReasoningScorePointAuditLine"),
    "Unity reasoning drilldown should render a latest decision snapshot before paged score-trail rows"
  );
  assert.ok(
    infoDrawerSource.includes("AddReasoningLatestDecisionSnapshotChips") &&
      infoDrawerSource.includes("AddReasoningAuditSectionChip") &&
      infoDrawerSource.includes("AI Reasoning Latest Decision Snapshot Chip") &&
      infoDrawerSource.includes('"score"') &&
      infoDrawerSource.includes('"compare"') &&
      infoDrawerSource.includes('"source"') &&
      infoDrawerSource.includes('"continuity"') &&
      infoDrawerSource.includes('"evidence"'),
    "Unity reasoning drilldown should render the latest decision snapshot as compact audit chips"
  );
  assert.ok(
    infoDrawerSource.includes("ReasoningScorePointAuditSections") &&
      infoDrawerSource.includes('ReasoningAuditSection("score"') &&
      infoDrawerSource.includes('ReasoningAuditSection("compare"') &&
      infoDrawerSource.includes('ReasoningAuditSection("source"') &&
      infoDrawerSource.includes('ReasoningAuditSection("continuity"') &&
      infoDrawerSource.includes('ReasoningAuditSection("evidence"'),
    "Unity reasoning drilldown should label latest-decision and score-trail audit sections explicitly"
  );
  assert.ok(
    infoDrawerSource.includes("AddAiReasoningScoreTrailRow"),
    "Unity reasoning drilldown should render multiple score-trail rows"
  );
  assert.ok(
    viewModelSource.includes("activeReasoningScoreTrailExpandedIndex") &&
      infoDrawerSource.includes("NormalizeReasoningScoreTrailExpandedIndex") &&
      infoDrawerSource.includes("SelectReasoningScoreTrailPoint") &&
      infoDrawerSource.includes("AI Reasoning Score Trail Selector Chip") &&
      infoDrawerSource.includes("AI Reasoning Score Trail Expanded Row"),
    "Unity reasoning drilldown should render selectable score-trail chips with a stable expanded detail row"
  );
  assert.ok(
    viewModelSource.includes("activeInfoTimelineAnchorId") &&
      infoDrawerSource.includes("JumpToReasoningScoreTrailTimeline") &&
      infoDrawerSource.includes("ReasoningTimelineAnchorId") &&
      infoDrawerSource.includes("TimelineEntryMatchesAnchor") &&
      infoDrawerSource.includes("Info Activity Row Timeline Anchor Glow"),
    "Unity reasoning drilldown should jump from expanded score-trail rows to highlighted source timeline anchors"
  );
  assert.ok(
    viewModelSource.includes('mode == "recap-trail-jump"') &&
      viewModelSource.includes("JumpToReasoningScoreTrailTimeline(point)") &&
      smokeFixtureSource.includes('"recap-trail-jump": prepareRecap'),
    "Unity recap smoke should include a score-trail timeline-jump state"
  );
  assert.ok(
    infoDrawerSource.includes("ReasoningTimelineAnchorLine") &&
      infoDrawerSource.includes("timelineText") &&
      infoDrawerSource.includes("timelineEntryId"),
    "Unity reasoning drilldown should render the source timeline anchor for each score-trail row"
  );
  assert.ok(
    infoDrawerSource.includes("ReasoningCrossDayEventAnchor") &&
      infoDrawerSource.includes("crossDayStance?.currentEventAnchors") &&
      infoDrawerSource.includes("eventAnchor.timelineEntryId") &&
      infoDrawerSource.includes("eventAnchor.eventId"),
    "Unity reasoning timeline jumps should fall back to cross-day event anchors when score points lack direct timeline ids"
  );
  assert.ok(
    infoDrawerSource.includes("ReasoningContinuityLine") &&
      infoDrawerSource.includes("crossDayStance?.summary") &&
      infoDrawerSource.includes("claimDisclosureRationale?.continuitySummary"),
    "Unity reasoning drilldown should render cross-day or claim-continuity context in score-trail rows"
  );
  assert.ok(
    infoDrawerSource.includes("ReasoningCrossDayAnchorLine") &&
      infoDrawerSource.includes("currentEventAnchors") &&
      infoDrawerSource.includes("currentScoreTrailAnchors") &&
      infoDrawerSource.includes("currentEvidenceAnchors"),
    "Unity reasoning drilldown should render cross-day event, score, and evidence anchors"
  );
  assert.ok(
    infoDrawerSource.includes("AddReasoningCrossDayAnchorChips") &&
      infoDrawerSource.includes("AI Reasoning Cross Day Anchor Chip") &&
      infoDrawerSource.includes("ReasoningCrossDayScoreAnchor") &&
      infoDrawerSource.includes("ReasoningCrossDayEvidenceAnchor") &&
      infoDrawerSource.includes("ReasoningCrossDayEventChipLine") &&
      infoDrawerSource.includes("ReasoningCrossDayScoreChipLine") &&
      infoDrawerSource.includes("ReasoningCrossDayEvidenceChipLine"),
    "Unity expanded score-trail rows should render cross-day event, score, and evidence anchors as compact chips"
  );
  assert.ok(
    infoDrawerSource.includes("AddReasoningCrossDayStanceBadge") &&
      infoDrawerSource.includes("AI Reasoning Cross Day Stance Badge") &&
      infoDrawerSource.includes("ReasoningCrossDayStanceBadgeLine") &&
      infoDrawerSource.includes("previousScore") &&
      infoDrawerSource.includes("currentScore") &&
      infoDrawerSource.includes("evidenceDelta") &&
      infoDrawerSource.includes("previousStance") &&
      infoDrawerSource.includes("currentStance"),
    "Unity expanded score-trail rows should render cross-day stance mode, score movement, and evidence delta as a compact badge"
  );
  assert.ok(
    infoDrawerSource.includes("AddReasoningEvidenceDrillthroughChips") &&
      infoDrawerSource.includes("AI Reasoning Evidence Drillthrough Chip") &&
      infoDrawerSource.includes("AddReasoningEvidenceExpandedRows") &&
      infoDrawerSource.includes("AI Reasoning Evidence Expanded Row") &&
      infoDrawerSource.includes("AddReasoningEvidenceExpandedRows(panel.transform, point)") &&
      infoDrawerSource.includes("ReasoningEvidenceExpandedRowLine") &&
      infoDrawerSource.includes("ReasoningEvidenceJumpPrefix") &&
      infoDrawerSource.includes("ReasoningVisibleEvidenceRows") &&
      infoDrawerSource.includes("ReasoningEvidenceDrillthroughLine") &&
      infoDrawerSource.includes("ReasoningEvidenceContextAnchorId") &&
      infoDrawerSource.includes("ReasoningEvidenceTimelineAnchorId") &&
      infoDrawerSource.includes("JumpToReasoningEvidenceTimeline") &&
      infoDrawerSource.includes("activeInfoTimelineAnchorId = anchorId") &&
      infoDrawerSource.includes("->EV") &&
      infoDrawerSource.includes("JumpToReasoningScoreTrailTimeline(contextPoint)") &&
      infoDrawerSource.includes("hasEvidenceAnchor") &&
      infoDrawerSource.includes("hasContextAnchor") &&
      infoDrawerSource.includes("->TL") &&
      infoDrawerSource.includes("row.evidenceId") &&
      infoDrawerSource.includes("row.observationId") &&
      infoDrawerSource.includes("row.timelineEntryId") &&
      infoDrawerSource.includes("row.timelineText") &&
      infoDrawerSource.includes("row.sourceName") &&
      infoDrawerSource.includes("row.reliabilityScore") &&
      infoDrawerSource.includes("row.contaminationRisk"),
    "Unity expanded score-trail rows should render fuller per-evidence rows with exact row anchors before falling back to score-point timeline context"
  );
  assert.ok(
    infoDrawerSource.includes("分数轨迹") && infoDrawerSource.includes("个分数点"),
    "Unity reasoning drilldown should label selected score trajectory points"
  );
  assert.ok(
    infoDrawerSource.includes("ReasoningScoreTrailPageSize") &&
      infoDrawerSource.includes("ChangeReasoningScoreTrailPage") &&
      infoDrawerSource.includes("Skip(pageStart).Take(ReasoningScoreTrailPageSize)"),
    "Unity reasoning drilldown should page through scoreTrail points instead of only showing a fixed first slice"
  );
  assert.ok(
    viewModelSource.includes("private const int ReasoningScoreTrailPageSize = 2"),
    "Unity reasoning drilldown should reserve room for the latest decision snapshot while preserving scoreTrail paging"
  );
  assert.ok(
    infoDrawerSource.includes("ReasoningComparisonLine") &&
      infoDrawerSource.includes("ReasoningComparisonSideLine") &&
      infoDrawerSource.includes("ReasoningComparisonMetaLine") &&
      infoDrawerSource.includes("focusReason") &&
      infoDrawerSource.includes("runnerUpReason") &&
      infoDrawerSource.includes("focusEvidenceSummary") &&
      infoDrawerSource.includes("runnerUpEvidenceSummary") &&
      infoDrawerSource.includes("compare:"),
    "Unity reasoning drilldown should render detailed target-vs-runner-up comparison traces"
  );
  assert.ok(
    viewModelSource.includes("activeReasoningRecapIndex"),
    "Unity bootstrap should track the selected reasoning recap lane"
  );
  assert.ok(
    infoDrawerSource.includes("AddReasoningTrackSelector"),
    "Unity recap tab should render reasoning-track selector controls"
  );
  assert.ok(
    infoDrawerSource.includes("CycleReasoningRecap"),
    "Unity recap tab should cycle between reasoning recap tracks"
  );
  assert.ok(
    infoDrawerSource.includes("推理轨道"),
    "Unity recap selector should label the current reasoning track"
  );
  assert.ok(
    infoDrawerSource.includes("ReasoningEvidenceRowMeta"),
    "Unity reasoning drilldown should expose reliability and contamination metadata"
  );
  assert.ok(
    smokeFixtureSource.includes('"recap-trail-page2": prepareRecap') &&
      smokeFixtureSource.includes("paged reasoning recap score trail"),
    "Unity recap smoke should include a paged score-trail state with more than one visible trail page"
  );
  assert.ok(
    infoDrawerSource.includes("可信") && infoDrawerSource.includes("污染"),
    "Unity reasoning drilldown should label evidence reliability and contamination risk"
  );
}

function testUnityReasoningRecapRendersSignalChips() {
  const infoDrawerSource = fs.readFileSync(unityInfoDrawerPath, "utf8");

  assert.ok(
    infoDrawerSource.includes("AI Reasoning Signal Chip") &&
      infoDrawerSource.includes("ReasoningSignalEvidenceLabel") &&
      infoDrawerSource.includes("ReasoningSignalConfidenceLabel"),
    "Unity reasoning recap card should surface compact score, delta, evidence, and confidence chips"
  );
}

function testUnityAiRecapRendersSuspectSnapshot() {
  const viewModelSource = fs.readFileSync(unityBootstrapPath, "utf8");
  const infoDrawerSource = fs.readFileSync(unityInfoDrawerPath, "utf8");
  const smokeFixtureSource = fs.readFileSync(unitySmokeFixturePath, "utf8");

  assert.ok(
    infoDrawerSource.includes("AI Recap Suspect Snapshot") &&
      infoDrawerSource.includes("AI Recap Suspect Card") &&
      infoDrawerSource.includes("BuildAiRecapSuspectSnapshotEntries"),
    "Unity recap tab should render a suspect-card snapshot before dense recap details"
  );
  assert.ok(
    infoDrawerSource.includes("AI Recap Suspect Evidence Chip") &&
      infoDrawerSource.includes("AI Recap Suspect Trail Chip") &&
      infoDrawerSource.includes("AI Recap Suspect Delta Chip") &&
      infoDrawerSource.includes("AI Recap Suspect Score Ring"),
    "Unity recap suspect cards should expose score rings plus evidence, trail, and score-movement chips"
  );
  assert.ok(
    infoDrawerSource.includes("AddAiRecapSuspectSnapshot(infoRecapCardRoot, recapDetails, reasoningRecap, reasoningIndex, 204f)") &&
      infoDrawerSource.includes("AddAiReasoningEvidenceDrilldownCard"),
    "Unity recap suspect snapshot should preserve the existing reasoning drilldown path below it"
  );
  assert.ok(
    infoDrawerSource.includes("SelectReasoningRecapForSuspect") &&
      infoDrawerSource.includes("activeReasoningRecapIndex = i") &&
      infoDrawerSource.includes("activeReasoningScoreTrailPage = 0") &&
      infoDrawerSource.includes("AI Recap Suspect Trail State"),
    "Unity recap suspect cards should select their matching reasoning trail and reset paging"
  );
  assert.ok(
    infoDrawerSource.includes("AI Recap Suspect Selected Glow") &&
      infoDrawerSource.includes("button.onClick.AddListener(() => SelectReasoningRecapForSuspect(entry.key))") &&
      infoDrawerSource.includes("SetRaycastTargetsExceptButtons(card.transform)"),
    "Unity recap suspect cards should be interactive and visibly mark the open trail lane"
  );
  assert.ok(
    smokeFixtureSource.includes("function prepareRecap") &&
      smokeFixtureSource.includes('"recap": prepareRecap') &&
      smokeFixtureSource.includes('"recap-suspect2": prepareRecap') &&
      smokeFixtureSource.includes("recap smoke should include multiple suspect reasoning tracks"),
    "Unity recap smoke should continue exercising suspect snapshot source data and multiple suspect lanes"
  );
  assert.ok(
    viewModelSource.includes('mode == "recap-suspect2"') && viewModelSource.includes("CycleReasoningRecap(1)"),
    "Unity recap smoke mode should be able to open the second suspect reasoning trail"
  );
}

function testUnityPrivateChatRendersRationaleContext() {
  const viewModelSource = fs.readFileSync(unityBootstrapPath, "utf8");
  const privateChatSource = fs.readFileSync(unityPrivateChatPath, "utf8");

  assert.ok(
    privateChatSource.includes("PrivateBubbleContextText"),
    "Unity private chat should derive a per-bubble rationale/context line"
  );
  assert.ok(
    privateChatSource.includes("Private Bubble Context"),
    "Unity private chat should render a dedicated context rail inside bubbles"
  );
  assert.ok(
    privateChatSource.includes("claimDisclosureRationale") && privateChatSource.includes("rationaleSummary"),
    "Unity private chat context should include private claim continuity and rationale summaries"
  );
  assert.ok(
    privateChatSource.includes("evidenceSummary") && privateChatSource.includes("questionToAsk"),
    "Unity private chat context should fall back to evidence summaries and follow-up questions"
  );
  assert.ok(
    privateChatSource.includes("PrivateBubbleIntentLabel"),
    "Unity private chat should label bubble intent alongside speaker and timestamp"
  );
  assert.ok(
    privateChatSource.includes("Private Rhythm Turn Track") &&
      privateChatSource.includes("RenderPrivateRhythmTurnTrack") &&
      privateChatSource.includes("AddPrivateRhythmTurnPip") &&
      privateChatSource.includes("Private Rhythm Pending Ring"),
    "Unity private chat should render a compact turn-rhythm track for recent private exchanges"
  );
  assert.ok(
    privateChatSource.includes("Private Dialogue Lane Backdrop") &&
      privateChatSource.includes("Private Dialogue Inbound Lane") &&
      privateChatSource.includes("Private Dialogue Outbound Lane") &&
      privateChatSource.includes("AddPrivateDialogueTurnCue") &&
      privateChatSource.includes("Private Dialogue Turn Tag"),
    "Unity private chat bubbles should sit in readable inbound/outbound conversation lanes"
  );
  assert.ok(
    !privateChatSource.includes("AddPrivateLatestBubbleSpotlight") &&
      !privateChatSource.includes("Private Latest Bubble Spotlight") &&
      !privateChatSource.includes("Private Latest Bubble Underlay") &&
      !privateChatSource.includes("Private Latest Bubble Rail") &&
      !privateChatSource.includes("Private Latest Bubble Focus Tag") &&
      !privateChatSource.includes('"当前焦点", false') &&
      !privateChatSource.includes('"等待回应", false'),
    "Unity private chat should not draw latest-message spotlight overlays on top of readable chat text"
  );
  assert.ok(
    viewModelSource.includes("RectTransform privateDialogueStageRoot") &&
      privateChatSource.includes("Private Dialogue Stage Frame") &&
      privateChatSource.includes("Private Dialogue Stage Floor") &&
      privateChatSource.includes("Private Dialogue Stage Vignette"),
    "Unity private chat should frame the scrollable transcript as a contained dialogue stage"
  );
  assert.ok(
    viewModelSource.includes("RectTransform privateDialogueStageBannerRoot") &&
      privateChatSource.includes("Private Dialogue Stage Banner") &&
      privateChatSource.includes("Private Dialogue Stage Track") &&
      privateChatSource.includes("Private Dialogue Stage Human Node") &&
      privateChatSource.includes("Private Dialogue Stage Target Node") &&
      privateChatSource.includes("RenderPrivateDialogueStageBanner") &&
      privateChatSource.includes("PrivateDialogueStageMetaLabel"),
    "Unity private chat should render a stage banner that frames the current private conversation route"
  );
  assert.ok(
    !viewModelSource.includes("RectTransform privateDialogueScrollRailRoot") &&
      !privateChatSource.includes("Private Dialogue Scroll Rail") &&
      !privateChatSource.includes("Private Dialogue Scroll Rail Track") &&
      !privateChatSource.includes("Private Dialogue Scroll Rail Thumb") &&
      !privateChatSource.includes("RenderPrivateDialogueScrollRail"),
    "Unity private chat should not reserve a persistent scroll rail over the transcript surface"
  );
  assert.ok(
    privateChatSource.includes("Private Target Portrait Stage") &&
      privateChatSource.includes("Private Target Portrait Halo") &&
      privateChatSource.includes("Private Target Spotlight Floor") &&
      privateChatSource.includes("PrivateTargetPressureAccent"),
    "Unity private chat should render the selected target as a stronger portrait/stage object"
  );
  assert.ok(
    viewModelSource.includes("RectTransform privateQuickPromptStripRoot") &&
      privateChatSource.includes("Private Quick Prompt Strip") &&
      privateChatSource.includes("Private Quick Prompt State Pill") &&
      privateChatSource.includes("UpdatePrivateQuickPromptStrip") &&
      privateChatSource.includes("PrivateQuickPromptStateLabel"),
    "Unity private chat should group quick questions into a compact status-aware prompt strip"
  );
  assert.ok(
      viewModelSource.includes("var privateChatOpen = privateChatPanel != null && privateChatPanel.gameObject.activeSelf") &&
      viewModelSource.includes("var dockVisible = bottomDockOpen && !voteOpen && !privateChatOpen") &&
      viewModelSource.includes("bottomDock.gameObject.SetActive(dockVisible)") &&
      privateChatSource.includes("ShowModalPanel(privateChatPanel);") &&
      privateChatSource.includes("ApplyModalBackdropVisibility();") &&
      privateChatSource.match(/ApplyBottomDockVisibility\(\);/g)?.length >= 2,
    "Unity private chat should suppress the bottom dock while the modal owns the bottom action area"
  );
  assert.ok(
    viewModelSource.includes("privateChannelOnly") &&
      viewModelSource.includes("new Color(0.002f, 0.006f, 0.010f, 0.72f)") &&
      viewModelSource.includes("new Color(0.002f, 0.006f, 0.010f, 0.46f)"),
    "Unity private chat modal should use a stronger backdrop than ordinary modals"
  );
}

function testUnityStageDialogueKeepsSingleReadableFocus() {
  const viewModelSource = fs.readFileSync(unityBootstrapPath, "utf8");
  const stageDialogueSource = fs.readFileSync(unityStageDialoguePath, "utf8");

  assert.ok(
    viewModelSource.includes("RectTransform stageDialogueContextRailRoot"),
    "Unity stage dialogue keeps the old context rail field only as dormant chrome"
  );
  assert.ok(
    viewModelSource.includes("Text stageDialogueRouteText") &&
      viewModelSource.includes("Image stageDialogueRouteAccentImage"),
    "Unity stage dialogue keeps route ribbon references while the route ribbon stays hidden"
  );
  assert.ok(
    stageDialogueSource.includes("routeRibbon.gameObject.SetActive(false)") &&
      stageDialogueSource.includes("stageDialogueContextRailRoot.gameObject.SetActive(false)") &&
      stageDialogueSource.includes("stageDialogueQueueStripRoot.gameObject.SetActive(false)") &&
      stageDialogueSource.includes("StageDialogueAuxiliaryChromeEnabled()") &&
      stageDialogueSource.includes("return false;"),
    "Unity stage dialogue should hide route/context/queue auxiliary chrome so the spoken line remains the only focus"
  );
  assert.ok(
    stageDialogueSource.includes("StageDialogueFocusLabel") &&
      stageDialogueSource.includes("StageDialogueProgressLabel") &&
      stageDialogueSource.includes("StageDialogueContextAccent"),
    "Unity stage dialogue should still be able to derive source/focus/progress labels for the compact header"
  );
  assert.ok(
    stageDialogueSource.includes("Stage Dialogue Queue Progress Track") &&
      stageDialogueSource.includes("Stage Dialogue Queue Progress Fill") &&
      stageDialogueSource.includes("Stage Dialogue Queue Progress Knob") &&
      stageDialogueSource.includes("UpdateStageDialogueQueueProgress") &&
      stageDialogueSource.includes("currentStepIndex"),
    "Unity stage dialogue can still restore queue playback chrome if the dormant auxiliary switch is re-enabled"
  );
  assert.ok(
    stageDialogueSource.includes("Stage Dialogue Speech Card") &&
      stageDialogueSource.includes("Stage Dialogue Speech Accent") &&
      stageDialogueSource.includes("Stage Dialogue Speaker Bridge") &&
      stageDialogueSource.includes("Stage Dialogue Quote Mark"),
    "Unity stage dialogue should frame the active spoken line as a readable speech card"
  );
  assert.ok(
    stageDialogueSource.includes("BuildDialoguePages(body, 3, 34)") &&
      stageDialogueSource.includes('AddText("Stage Dialogue Body"') &&
      stageDialogueSource.includes("new Vector2(204f, 54f)") &&
      stageDialogueSource.includes("new Vector2(-318f, -88f)") &&
      stageDialogueSource.match(/ApplyBottomDockVisibility\(\);/g)?.length >= 2,
    "Unity stage dialogue should keep text pages short, reserve body space, and suppress the bottom dock while active"
  );
  assert.ok(
    viewModelSource.includes("Image stageDialogueSpeakerSpotlightImage") &&
      stageDialogueSource.includes("BuildStageDialogueSpeakerSpotlight") &&
      stageDialogueSource.includes("Stage Dialogue Speaker Spotlight") &&
      stageDialogueSource.includes("Stage Dialogue Speaker Beam") &&
      stageDialogueSource.includes("stageDialogueSpeakerSpotlightImage.gameObject.SetActive(false)") &&
      stageDialogueSource.includes("stageDialogueSpeakerBeamImage.gameObject.SetActive(false)"),
    "Unity stage dialogue should keep decorative speaker beams disabled over the readable speech card"
  );
}

function testUnityPhaseTransitionRendersRouteStrip() {
  const viewModelSource = fs.readFileSync(unityBootstrapPath, "utf8");
  const stageDialogueSource = fs.readFileSync(unityStageDialoguePath, "utf8");
  const smokeCaptureSource = fs.readFileSync(unitySmokeCapturePath, "utf8");

  assert.ok(
    viewModelSource.includes("RectTransform phaseTransitionRouteRoot") &&
      viewModelSource.includes("Image phaseTransitionRouteAccent") &&
      viewModelSource.includes("Image phaseTransitionRouteConnectorA") &&
      viewModelSource.includes("Image phaseTransitionRouteConnectorB"),
    "Unity phase transition overlay should keep route-strip references for stage/action/state cues"
  );
  assert.ok(
    stageDialogueSource.includes("Phase Transition Contained Horizon") &&
      stageDialogueSource.includes("Phase Transition Horizon Core"),
    "Unity phase transition overlay should keep its light band contained inside the transition card area"
  );
  assert.ok(
    stageDialogueSource.includes("Phase Transition Route Strip") &&
      stageDialogueSource.includes("Phase Transition Route Chip") &&
      stageDialogueSource.includes("Phase Transition Route Connector") &&
      stageDialogueSource.includes("AddPhaseTransitionRouteChip"),
    "Unity phase transition overlay should render target, next-action, and sync state as route chips"
  );
  assert.ok(
    stageDialogueSource.includes("PhaseTransitionStageName(stage)") &&
      stageDialogueSource.includes("PhaseTransitionNextAction(stage)") &&
      stageDialogueSource.includes("PhaseTransitionAccentColor(stage)"),
    "Unity phase transition route should reuse existing stage labels, next-action labels, and stage accent colors"
  );
  assert.ok(
    smokeCaptureSource.includes('"phase-transition"') &&
      smokeCaptureSource.includes('"transition-day"') &&
      smokeCaptureSource.includes('"transition-night"') &&
      smokeCaptureSource.includes('"transition-nomination"'),
    "Unity phase transition polish should remain covered by all transition smoke states"
  );
}

function testUnityTokenInspectorRendersSignalChips() {
  const viewModelSource = fs.readFileSync(unityBootstrapPath, "utf8");
  const grimoireSource = fs.readFileSync(unityGrimoirePath, "utf8");
  const smokeFixtureSource = fs.readFileSync(unitySmokeFixturePath, "utf8");

  assert.ok(
    viewModelSource.includes("RectTransform tokenInspectorSignalRoot"),
    "Unity token inspector should keep a signal strip root for compact target chips"
  );
  assert.ok(
    viewModelSource.includes("RectTransform tokenInspectorFocusRoot"),
    "Unity token inspector should keep a focus rail root for the selected target path"
  );
  assert.ok(
    grimoireSource.includes("Token Inspector Signal Strip") &&
      grimoireSource.includes("Token Inspector Signal Chip") &&
      grimoireSource.includes("RenderTokenInspectorSignalStrip"),
    "Unity token inspector should render a compact signal chip strip above the detail cards"
  );
  assert.ok(
    grimoireSource.includes("Token Inspector Target Focus Rail") &&
      grimoireSource.includes("RenderTokenInspectorTargetFocus") &&
      grimoireSource.includes("Token Inspector Target Route Track") &&
      grimoireSource.includes("TokenInspectorFocusAccent"),
    "Unity token inspector should render a non-interactive selected-target focus route"
  );
  assert.ok(
    grimoireSource.includes("TokenInspectorIdentitySignalLabel") &&
      grimoireSource.includes("TokenInspectorActionSignalLabel") &&
      grimoireSource.includes("AddTokenInspectorMetaCard"),
    "Unity token inspector chips should summarize identity, recommended action, and card details"
  );
  assert.ok(
    grimoireSource.includes("Inspector Suggested Glow") && grimoireSource.includes("TokenInspectorRecommendedAction"),
    "Unity token inspector should continue highlighting the recommended quick action"
  );
  assert.ok(
    smokeFixtureSource.includes("function prepareTokenInspector") &&
      smokeFixtureSource.includes('"token-inspector": prepareTokenInspector') &&
      smokeFixtureSource.includes("token-inspector smoke should expose a high pressure card"),
    "Unity token-inspector smoke should exercise marked role, reminders, and pressure card density"
  );
}

function testUnityMoreActionsRendersSignalChips() {
  const viewModelSource = fs.readFileSync(unityBootstrapPath, "utf8");
  const smokeFixtureSource = fs.readFileSync(unitySmokeFixturePath, "utf8");

  assert.ok(
    viewModelSource.includes("RectTransform moreActionsSignalRoot"),
    "Unity more actions drawer should keep a signal strip root for compact context chips"
  );
  assert.ok(
    viewModelSource.includes("RectTransform moreActionsRouteRoot"),
    "Unity more actions drawer should keep a route strip root for target-to-tool guidance"
  );
  assert.ok(
    viewModelSource.includes("More Actions Signal Strip") &&
      viewModelSource.includes("More Actions Signal Chip") &&
      viewModelSource.includes("RenderMoreActionsSignalStrip"),
    "Unity more actions drawer should render compact phase, target, recommendation, and view chips"
  );
  assert.ok(
    viewModelSource.includes("More Actions Route Strip") &&
      viewModelSource.includes("RenderMoreActionsRouteStrip") &&
      viewModelSource.includes("More Actions Route Chip") &&
      viewModelSource.includes("More Actions Route Connector") &&
      viewModelSource.includes("MoreActionsPrimarySuggestedLabel"),
    "Unity more actions drawer should render a compact target-to-recommended-tool route"
  );
  assert.ok(
    viewModelSource.includes("MoreActionsSignalPhaseLabel") &&
      viewModelSource.includes("MoreActionsSignalTargetLabel") &&
      viewModelSource.includes("MoreActionsSignalToolsLabel") &&
      viewModelSource.includes("MoreActionsSignalViewLabel"),
    "Unity more actions chips should derive phase, target, recommended tool count, and grimoire view labels"
  );
  assert.ok(
    viewModelSource.includes("More Action Suggested Glow") &&
      viewModelSource.includes("MoreActionSuggestedKeys"),
    "Unity more actions drawer should preserve suggested tile highlights"
  );
  assert.ok(
    smokeFixtureSource.includes('"more-actions": prepareTokenInspector'),
    "Unity more-actions smoke should exercise a selected marked-role target instead of a plain role-picker target"
  );
}

function testUnityActionFormsRenderReadinessSignals() {
  const viewModelSource = fs.readFileSync(unityBootstrapPath, "utf8");
  const actionFormsSource = fs.readFileSync(unityActionFormsPath, "utf8");

  assert.ok(
    viewModelSource.includes("RectTransform actionFormSignalRoot"),
    "Unity action forms should keep a signal strip root for compact form status chips"
  );
  assert.ok(
    actionFormsSource.includes("Action Form Signal Strip") &&
      actionFormsSource.includes("Action Form Signal Chip") &&
      actionFormsSource.includes("RenderActionFormSignalStrip"),
    "Unity action forms should render compact role, input, requirement, progress, and submit chips"
  );
  assert.ok(
    actionFormsSource.includes("ActionFormRoleSignalLabel") &&
      actionFormsSource.includes("ActionFormProgressSignalLabel") &&
      actionFormsSource.includes("ActionFormSubmitSignalLabel"),
    "Unity action form chips should derive role, progress, and submit readiness labels"
  );
  assert.ok(
    actionFormsSource.includes("CanSubmitActionForm") &&
      actionFormsSource.includes("SetToolButtonEnabled(actionFormSubmitButton, canSubmit)") &&
      actionFormsSource.includes("ActionFormSubmitButtonLabel"),
    "Unity action forms should disable and relabel submit until required inputs are ready"
  );
  assert.ok(
    actionFormsSource.includes("ActionTargetProgressLabel") &&
      actionFormsSource.includes("已选 {selected} / 需要 {min} / 最多 {max}") &&
      actionFormsSource.includes("targetIds: selectedActionTargetIds"),
    "Unity target action forms should show multi-target progress and submit all selected targetIds"
  );
  assert.ok(
    actionFormsSource.includes("Action Guess Readiness") &&
      actionFormsSource.includes("Action Guess Rows") &&
      actionFormsSource.includes("guesses: selectedActionGuesses"),
    "Unity guess action forms should keep the multi-guess builder and send guesses[]"
  );
  assert.ok(
    actionFormsSource.includes("AutomaticActionTargetIds") &&
      actionFormsSource.includes("selectedActionTargetIds.AddRange(autoTargets)") &&
      actionFormsSource.includes("return ids.Take(targetCount).ToList()"),
    "Unity auto target helper should fill visible selected targets instead of silently submitting hidden defaults"
  );
  assert.ok(
    /private bool TrySendDefaultNightAction\(\)\s*\{[\s\S]*OpenActionFormPanel\("night-action"\);[\s\S]*return true;[\s\S]*\}/.test(viewModelSource),
    "Unity phase advance should open the human night action form instead of silently submitting a default night action"
  );
  assert.ok(
    /RenderActionTargetBar\(\);\s*if \(actionTargetBar != null\) actionTargetBar\.gameObject\.SetActive\(true\);\s*RenderGrimoire\(\);\s*ApplyModalBackdropVisibility\(\);\s*if \(actionTargetBar != null\) actionTargetBar\.SetAsLastSibling\(\);/.test(actionFormsSource),
    "Unity grimoire-target action forms should keep the target bar above modal/grimoire layers when opened"
  );
  assert.ok(
    /if \(actionTargetBar != null && actionTargetBar\.gameObject\.activeSelf\)\s*\{\s*RenderActionTargetBar\(\);\s*actionTargetBar\.SetAsLastSibling\(\);\s*return;\s*\}/.test(actionFormsSource),
    "Unity grimoire-target action forms should keep the target bar above modal/grimoire layers after re-render"
  );
}

function testUnityStorytellerQueueRendersSignalChips() {
  const viewModelSource = fs.readFileSync(unityBootstrapPath, "utf8");
  const storytellerSource = fs.readFileSync(unityStorytellerPath, "utf8");
  const smokeFixtureSource = fs.readFileSync(unitySmokeFixturePath, "utf8");

  assert.ok(
    viewModelSource.includes("RectTransform storytellerSignalRoot"),
    "Unity storyteller queue should keep a signal strip root for compact queue chips"
  );
  assert.ok(
    storytellerSource.includes("Storyteller Signal Strip") &&
      storytellerSource.includes("Storyteller Signal Chip") &&
      storytellerSource.includes("RenderStorytellerSignalStrip"),
    "Unity storyteller queue should render compact queue, page, head action, input, and target chips"
  );
  assert.ok(
    storytellerSource.includes("StorytellerQueuePageSignalLabel") &&
      storytellerSource.includes("StorytellerCurrentInputSignalLabel") &&
      storytellerSource.includes("StorytellerCurrentTargetSignalLabel"),
    "Unity storyteller chips should derive page, input, and target readiness labels"
  );
  assert.ok(
    storytellerSource.includes("ChangeStorytellerQueuePage") &&
      viewModelSource.includes("StorytellerQueuePageSize") &&
      smokeFixtureSource.includes('"storyteller-queue-page2": prepareStorytellerQueue'),
    "Unity storyteller queue should preserve pagination and page-2 smoke coverage"
  );
}

function testUnityRolePickerRendersPagingSignals() {
  const viewModelSource = fs.readFileSync(unityBootstrapPath, "utf8");
  const rolePickerSource = fs.readFileSync(unityRolePickerPath, "utf8");
  const smokeFixtureSource = fs.readFileSync(unitySmokeFixturePath, "utf8");

  assert.ok(
    viewModelSource.includes("RectTransform rolePickerSignalRoot"),
    "Unity role picker should keep a signal strip root for compact picker state chips"
  );
  assert.ok(
    rolePickerSource.includes("Role Picker Signal Strip") &&
      rolePickerSource.includes("Role Picker Signal Chip") &&
      rolePickerSource.includes("RenderRolePickerSignalStrip"),
    "Unity role picker should render compact mode, filter, page, and selection chips"
  );
  assert.ok(
    rolePickerSource.includes("RolePickerModeSignalLabel") &&
      rolePickerSource.includes("RolePickerPageSignalLabel") &&
      rolePickerSource.includes("RolePickerSelectionSignalLabel"),
    "Unity role picker chips should derive mode, page, and selection labels"
  );
  assert.ok(
    viewModelSource.includes("RolePickerPageSize") &&
      rolePickerSource.includes("ChangeRolePickerPage") &&
      smokeFixtureSource.includes("function preparePagedRolePicker") &&
      smokeFixtureSource.includes('"role-picker-paged": preparePagedRolePicker'),
    "Unity role picker should preserve paged large-role-pool smoke coverage"
  );
}

function testUnityHandbookRendersMentalModelSignals() {
  const viewModelSource = fs.readFileSync(unityBootstrapPath, "utf8");
  const handbookSource = fs.readFileSync(unityHandbookPath, "utf8");
  const smokeFixtureSource = fs.readFileSync(unitySmokeFixturePath, "utf8");

  assert.ok(
    viewModelSource.includes("RectTransform handbookSignalRoot"),
    "Unity script handbook should keep a signal strip root for compact scope/reference chips"
  );
  assert.ok(
    handbookSource.includes("Handbook Signal Strip") &&
      handbookSource.includes("Handbook Signal Chip") &&
      handbookSource.includes("RenderHandbookSignalStrip"),
    "Unity script handbook should render compact atlas, script, filter, order, and notes chips"
  );
  assert.ok(
    handbookSource.includes("HandbookSignalScriptLabel") &&
      handbookSource.includes("HandbookSignalFilterLabel") &&
      handbookSource.includes("HandbookSignalOrderLabel") &&
      handbookSource.includes("HandbookSignalNotesLabel"),
    "Unity script handbook chips should derive script scope, filter scope, order counts, and notes-drawer labels"
  );
  assert.ok(
    handbookSource.includes("AddHandbookModeChip") &&
      handbookSource.includes("OpenHandbookInformationSummary") &&
      handbookSource.includes("Handbook Order Wash"),
    "Unity script handbook should preserve atlas mode, notes drawer handoff, and official-order reference panel"
  );
  assert.ok(
    viewModelSource.includes("activeHandbookMode") &&
      handbookSource.includes("RenderHandbookHelpMode") &&
      handbookSource.includes("blocker") &&
      handbookSource.includes("hint") &&
      handbookSource.includes("debug/internal"),
    "Unity script handbook should include a dedicated tutorial/help mode with blocker, hint, and debug/internal guidance"
  );
  assert.ok(
    smokeFixtureSource.includes("function prepareScriptHandbook") &&
      smokeFixtureSource.includes('"script-handbook": prepareScriptHandbook') &&
      smokeFixtureSource.includes("function prepareScriptHelp") &&
      smokeFixtureSource.includes('"script-help": prepareScriptHelp'),
    "Unity script-handbook and script-help smokes should continue exercising the handbook/help modal"
  );
}

function testUnityUiSmokeHasVisualRegressionVerifier() {
  const packageJson = fs.readFileSync(path.join(root, "package.json"), "utf8");
  const verifierSource = fs.readFileSync(unitySmokeVisualVerifierPath, "utf8");
  const captureSource = fs.readFileSync(unitySmokeCapturePath, "utf8");
  const playableNodeCaptureSource = fs.readFileSync(unityPlayableNodeCapturePath, "utf8");
  const fullBaselineVerifierSource = fs.readFileSync(unitySmokeFullBaselineVerifierPath, "utf8");

  assert.ok(
    packageJson.includes("unity:ui-smoke:verify") &&
      packageJson.includes("tools/verify_unity_ui_smoke.ps1"),
    "Unity UI smoke should expose a visual verification script"
  );
  assert.ok(
    verifierSource.includes("Resolve-SmokeManifest") &&
      verifierSource.includes("visual-regression-report.json") &&
      verifierSource.includes("RequiredStates") &&
      verifierSource.includes("RequiredViewports"),
    "Unity UI visual verifier should read smoke manifests, write reports, and enforce requested coverage"
  );
  assert.ok(
    verifierSource.includes("Get-UiSmokeImageMetrics") &&
      verifierSource.includes("Test-UiForegroundPixel") &&
      verifierSource.includes("MinSafeMarginPx") &&
      verifierSource.includes("foreground-near-$edge-edge"),
    "Unity UI visual verifier should compute foreground safe margins to flag cropping risk"
  );
  assert.ok(
    verifierSource.includes("Compare-UiSmokeImages") &&
      verifierSource.includes("BaselineDir") &&
      verifierSource.includes("MaxDiffChangedRate") &&
      verifierSource.includes("MaxMeanAbsDelta"),
    "Unity UI visual verifier should support baseline screenshot diff thresholds"
  );
  assert.ok(
    packageJson.includes("unity:ui-smoke:verify:full") &&
      packageJson.includes("tools/verify_unity_full_ui_baseline.ps1"),
    "Unity UI smoke should expose a fixed full-baseline verification gate"
  );
  assert.deepEqual(
    extractPowershellStringArray(fullBaselineVerifierSource, "RequiredStates"),
    extractPowershellStringArray(captureSource, "States"),
    "Unity full-baseline gate should require every default smoke capture state"
  );
  assert.deepEqual(
    extractPowershellStringArray(fullBaselineVerifierSource, "RequiredViewports"),
    ["1920x1080", "1600x900", "1366x768"],
    "Unity full-baseline gate should require the accepted three viewport matrix"
  );
  assert.ok(
    fullBaselineVerifierSource.includes("FailOnWarnings") &&
      fullBaselineVerifierSource.includes("unity-ui-smoke-full-baseline-phase-assist-public-route-2026-06-05"),
    "Unity full-baseline gate should fail warnings by default and point at the accepted 31-state baseline"
  );
  assert.ok(
    captureSource.includes("$maxCaptureAttempts = 2") &&
      captureSource.includes("Capture attempt $captureAttempt failed") &&
      captureSource.includes("retrying"),
    "Unity UI smoke capture should retry a single state/viewport after transient screenshot validation failures"
  );
  assert.ok(
    captureSource.includes('[string]$UnityExe = ""') &&
      captureSource.includes('[string]$StreamingAssets = ""') &&
      captureSource.includes("[switch]$RestoreRuntimeState") &&
      captureSource.includes("[switch]$UseExistingState") &&
      captureSource.includes("Backup-RuntimeFiles") &&
      captureSource.includes("Restore-RuntimeFiles") &&
      captureSource.includes('"--streaming-assets=$streamingAssets"'),
    "Unity UI smoke capture should be able to verify a packaged Unity exe and restore package runtime state"
  );
  assert.ok(
    captureSource.includes("Using existing Unity runtime state for UI smoke") &&
      captureSource.includes("existingState = [bool]$UseExistingState"),
    "Unity UI smoke capture should be able to render screenshots from preloaded playable runtime state"
  );
  assert.ok(
    playableNodeCaptureSource.includes("playable_loop_report.json") &&
      playableNodeCaptureSource.includes("Copy-NodeRuntimeFiles") &&
      playableNodeCaptureSource.includes("unity_state.json") &&
      playableNodeCaptureSource.includes("unity_viewmodel.json") &&
      playableNodeCaptureSource.includes("unity_action.json") &&
      playableNodeCaptureSource.includes("unity_action_result.json") &&
      playableNodeCaptureSource.includes("-UseExistingState") &&
      playableNodeCaptureSource.includes("Resolve-SmokeModeForPlayableNode") &&
      playableNodeCaptureSource.includes('"nomination-debate"') &&
      playableNodeCaptureSource.includes('"vote-ceremony"') &&
      playableNodeCaptureSource.includes('"endgame"') &&
      playableNodeCaptureSource.includes("IncludeProactiveRegression") &&
      playableNodeCaptureSource.includes("playable-node-render-manifest.json"),
    "Unity playable node capture should replay saved path nodes through the real Unity screenshot pipeline"
  );
}

function testUnityPlayerFacingEventsHideInternalPrivatePlaceholders() {
  const viewModelSource = fs.readFileSync(unityBootstrapPath, "utf8");
  const infoDrawerSource = fs.readFileSync(unityInfoDrawerPath, "utf8");
  const stageDialogueSource = fs.readFileSync(unityStageDialoguePath, "utf8");

  assert.ok(
      viewModelSource.includes("PlayerFacingEventLine") &&
      viewModelSource.includes("PlayerFacingEventLines(vm.events)") &&
      viewModelSource.includes("tickerText.text = Ellipsize(LatestEvent(), 30)") &&
      viewModelSource.includes('text.EndsWith("->", StringComparison.Ordinal)') &&
      viewModelSource.includes('text.Substring(0, separator).Contains("->")') &&
      viewModelSource.includes('lower.Contains("secret-response-")') &&
      viewModelSource.includes("私聊回应已记录。"),
    "Unity HUD event text should replace internal private-chat placeholders with player-facing copy"
  );
  assert.ok(
      viewModelSource.includes("ApplyProactiveWhisperPanelResponsiveLayout") &&
      viewModelSource.includes("Screen.width <= 1200") &&
      viewModelSource.includes("proactiveWhisperPanel.localScale = new Vector3(0.84f, 0.84f, 1f)") &&
      viewModelSource.includes("proactiveWhisperPanel.offsetMin = new Vector2(-610f, 188f)"),
    "Unity proactive whisper queue should compact itself on narrow screenshots instead of covering bottom player tokens"
  );
  assert.ok(
    infoDrawerSource.includes(".Select(PlayerFacingEventLine)") &&
      stageDialogueSource.includes(".Select(PlayerFacingEventLine)"),
    "Unity event drawers and phase summaries should share the player-facing event sanitizer"
  );
}

function testUnityEmbeddedLlmDefaultsAreUserControllable() {
  const coreInteropSource = fs.readFileSync(unityCoreInteropPath, "utf8");
  const menuSettingsSource = fs.readFileSync(unityMenuSettingsPath, "utf8");
  const packageScriptSource = fs.readFileSync(unityAiPackageScriptPath, "utf8");

  assert.ok(
    menuSettingsSource.includes("var packageRequiresExplicitLocalLlmOptIn = PackageRequiresExplicitLocalLlmOptIn()") &&
      menuSettingsSource.includes("var defaultLocalLlmRenderer = !packageRequiresExplicitLocalLlmOptIn && PackageEnablesLocalLlmRenderer() ? 1 : 0") &&
      menuSettingsSource.includes("PlayerPrefs.GetInt(SettingsLocalLlmRendererKey, defaultLocalLlmRenderer)"),
    "Unity settings should default local LLM polish on for marked packages while leaving tiny opt-in packages off"
  );
  assert.ok(
    coreInteropSource.includes('CommandLineFlag("-botc-no-llm-renderer")') &&
      coreInteropSource.includes('CommandLineFlag("-botc-llm-renderer") || CommandLineFlag("-botc-ai-polish")') &&
      coreInteropSource.includes("if (PackageRequiresExplicitLocalLlmOptIn()) return false") &&
      coreInteropSource.includes("PlayerPrefs.HasKey(SettingsLocalLlmRendererKey)") &&
      coreInteropSource.includes("return PackageEnablesLocalLlmRenderer();"),
    "Unity bridge should allow explicit off/on, ignore stale saved prefs for tiny opt-in packages, and keep package-marker defaults"
  );
  assert.ok(
    coreInteropSource.includes("Path.Combine(root, \"botc_ai_polish.enabled\")") &&
      coreInteropSource.includes("Path.Combine(root, \"LocalLLM\", \"enable_ai_polish.flag\")") &&
      coreInteropSource.includes("JsonUtility.FromJson<LocalLlmManifest>") &&
      coreInteropSource.includes("PackageLocalLlmTier()") &&
      coreInteropSource.includes("StartEmbeddedLocalLlmIfAvailable()") &&
      coreInteropSource.includes("WaitForEmbeddedLocalLlmReady(port, readyTimeoutMs)") &&
      coreInteropSource.includes("private const int DefaultEmbeddedLocalLlmTimeoutMs = 4000"),
    "Unity direct launch should auto-detect package markers, identify tiny opt-in packages, wait for embedded LocalLLM readiness, and use a playable timeout"
  );
  assert.ok(
    packageScriptSource.includes("set BOTC_LLM_TIMEOUT_MS=4000"),
    "AI polished launcher should use the same playable embedded LLM timeout as direct launch"
  );
  assert.ok(
    packageScriptSource.includes("[switch]$AutoEnableTinyLocalLlm") &&
      packageScriptSource.includes("Get-LocalLlmModelTier") &&
      packageScriptSource.includes('$localLlmTier -ne "tiny"') &&
      packageScriptSource.includes("Tiny LocalLLM tier detected"),
    "AI release packaging should leave tiny LocalLLM opt-in by default while allowing explicit auto-enable"
  );
  assert.ok(
    packageScriptSource.includes("[switch]$SkipBuildCoreSync") &&
      packageScriptSource.includes("npm run unity:sync-build-core") &&
      packageScriptSource.indexOf("npm run unity:sync-build-core") < packageScriptSource.indexOf("Get-ChildItem -LiteralPath $buildPath"),
    "AI release packaging should sync the latest Unity JS core into the build before copying package assets"
  );
  assert.ok(
    packageScriptSource.includes("[switch]$SkipManagedAssemblyCompile") &&
      packageScriptSource.includes("tools\\unity_csharp_compile_smoke.ps1") &&
      packageScriptSource.includes("BOTC_Unity_Prototype_Data\\Managed\\Assembly-CSharp.dll") &&
      packageScriptSource.indexOf("tools\\unity_csharp_compile_smoke.ps1") < packageScriptSource.indexOf("Get-ChildItem -LiteralPath $buildPath"),
    "AI release packaging should compile the latest Unity managed assembly into the build before copying package assets"
  );
  assert.ok(
    packageScriptSource.includes("Clear-PackageRuntimeState") &&
      packageScriptSource.includes("unity_state.json") &&
      packageScriptSource.includes("unity_viewmodel.json") &&
      packageScriptSource.includes("unity_action.json") &&
      packageScriptSource.includes("unity_action_result.json") &&
      packageScriptSource.indexOf("Clear-PackageRuntimeState $dest") > packageScriptSource.indexOf("Get-ChildItem -LiteralPath $buildPath"),
    "AI release packaging should strip stale Unity runtime state/action files from the final package"
  );
  assert.ok(
    packageScriptSource.includes("[switch]$VerifyPackage") &&
      packageScriptSource.includes("tools\\verify_unity_ai_package.ps1") &&
      packageScriptSource.includes("& $verifyScript -PackageDir $dest") &&
      packageScriptSource.indexOf("tools\\verify_unity_ai_package.ps1") < packageScriptSource.indexOf("if (-not $NoZip)"),
    "AI release packaging should optionally run the direct-exe embedded LLM verifier before creating the zip"
  );
}

function testUnitySmokeDialogueFixtureIsLocalized() {
  const smokeFixtureSource = fs.readFileSync(unitySmokeFixturePath, "utf8");
  const forbiddenVisibleEnglish = [
    "The human is probing vote thresholds",
    "The outgoing whisper keeps the information scoped",
    "Continues the private information-role line",
    "Vote threshold is framed around explanation quality",
    "The reply nominates a concrete comparison lane",
    "Ask how the vote changes",
    "What would make you lift the vote",
    "Who should speak before the vote",
    "Confirm whether this private line",
    "Keeps the same private information-role lane",
    "Hold the exact role for now",
    "Vote stance depends on whether",
    "Focuses on seat 5 and seat 8",
    "Ask both seats to separate",
  ];
  for (const phrase of forbiddenVisibleEnglish) {
    assert.ok(!smokeFixtureSource.includes(phrase), `Unity smoke dialogue fixture should not expose English QA rationale: ${phrase}`);
  }
}

function testUnityAiPackageVerifierCoversEmbeddedDefaultLlm() {
  const packageJson = fs.readFileSync(path.join(root, "package.json"), "utf8");
  const verifierSource = fs.readFileSync(unityAiPackageVerifierPath, "utf8");
  const releaseGateSource = fs.readFileSync(unityAiReleaseGatePath, "utf8");
  const packageScriptSource = fs.readFileSync(unityAiPackageScriptPath, "utf8");
  const bridgeSource = fs.readFileSync(path.join(root, "scripts", "unity_action_bridge.mjs"), "utf8");

  assert.ok(
    packageJson.includes("verify:unity-ai-package") &&
      packageJson.includes("tools/verify_unity_ai_package.ps1") &&
      packageJson.includes("package:unity-ai:embedded:verified") &&
      packageJson.includes("-VerifyPackage") &&
      packageJson.includes("release:unity-ai:verified") &&
      packageJson.includes("tools/build_verify_unity_ai_release.ps1"),
    "Package scripts should expose repeatable embedded Unity AI package and full release verifiers"
  );
  assert.ok(
    verifierSource.includes("directAiPolishMarkerPresent") &&
      verifierSource.includes('"-botc-llm-renderer"') &&
      verifierSource.includes("llama-server.exe") &&
      verifierSource.includes("*.gguf"),
    "AI package verifier should detect direct-polish markers or verify explicit opt-in, plus llama.cpp runtime and a bundled GGUF model"
  );
  assert.ok(
      verifierSource.includes("BOTC_Unity_Prototype.exe") &&
      verifierSource.includes("submit_unity_night_action.mjs") &&
      verifierSource.includes('type = "new-game"') &&
      verifierSource.includes("--advance-flow") &&
      verifierSource.includes("StepCount=0") &&
      verifierSource.includes("MaxFlowAttempts") &&
      verifierSource.includes("Embedded LLM verification failed after") &&
      verifierSource.includes("Backup-RuntimeFiles") &&
      verifierSource.includes("Restore-RuntimeFiles") &&
      verifierSource.includes("KeepRuntimeState") &&
      verifierSource.includes("llmRenderer.provider") &&
      verifierSource.includes("openai-compatible"),
    "AI package verifier should launch the direct exe, seed a fresh game, advance real flow, restore package runtime state, and prove embedded OpenAI-compatible LLM rendering"
  );
  assert.ok(
    verifierSource.includes("Public claim|I am maintaining|I am putting") &&
      !bridgeSource.includes("Public claim:") &&
      !bridgeSource.includes("I am putting my role path on the table"),
    "Unity public claim dialogue should stay localized and the package verifier should fail English template leaks"
  );
  assert.ok(
    releaseGateSource.includes("-executeMethod $BuildMethod") &&
      releaseGateSource.includes("Assert-UnityBuildSucceeded") &&
      releaseGateSource.includes("Read-TextFileWithRetry $LogPath 10") &&
      releaseGateSource.includes("function Wait-File") &&
      releaseGateSource.includes("Wait-File $buildLogPath 10") &&
      releaseGateSource.includes("No valid Unity Editor license|No ULF license|Token not found") &&
      releaseGateSource.includes("package_unity_ai_release.ps1") &&
      releaseGateSource.includes("VerifyPackage = $true") &&
      releaseGateSource.includes('$packageUnityExe = Join-Path $packagePath "BOTC_Unity_Prototype.exe"') &&
      releaseGateSource.includes('$packageStreamingAssets = Join-Path $packagePath "BOTC_Unity_Prototype_Data\\StreamingAssets"') &&
      releaseGateSource.includes("-UnityExe $packageUnityExe") &&
      releaseGateSource.includes("-StreamingAssets $packageStreamingAssets") &&
      releaseGateSource.includes("-RestoreRuntimeState") &&
      releaseGateSource.includes("capture_unity_ui_smoke.ps1") &&
      releaseGateSource.includes("verify_unity_ui_smoke.ps1"),
    "Full release gate should rebuild Unity, fail clearly on license blockers, package with embedded LLM verification, and run targeted UI smoke on the final package"
  );
  assert.ok(
    packageScriptSource.includes("Write-ReleaseRetentionReport") &&
      packageScriptSource.includes("playablePackagesKept = 2") &&
      packageScriptSource.includes("verifiedPackagesKept = 1") &&
      packageScriptSource.includes("release-cleanup-report.json") &&
      packageScriptSource.includes("report-only") &&
      packageScriptSource.includes("No files are deleted or moved automatically"),
    "Unity AI packager should produce a non-destructive retention cleanup report for old playable and verified package groups"
  );
}

testUnityHasEveryScriptRoleIcon();
testUnityHasEveryUiAsset();
testUnityHasEveryAudioAsset();
testUnityMenuSetupUsesCoreRoleIds();
testUnityNominationDebateRendersRationaleCards();
testUnityVoteCeremonyRendersRationaleCards();
testUnityNominationVoteControlsExplicitHumanVote();
testUnityPhaseAssistKeepsReadablePublicActionFocus();
testUnityPhaseAssistPrimaryUsesDecisionAutoAdvance();
testUnityEndgameRendersRecapRail();
testUnityTimelineRendersRationaleSummary();
testUnityReasoningRecapRendersSignalChips();
testUnityAiRecapRendersSuspectSnapshot();
testUnityPrivateChatRendersRationaleContext();
testUnityStageDialogueKeepsSingleReadableFocus();
testUnityPhaseTransitionRendersRouteStrip();
testUnityTokenInspectorRendersSignalChips();
testUnityMoreActionsRendersSignalChips();
testUnityActionFormsRenderReadinessSignals();
testUnityStorytellerQueueRendersSignalChips();
testUnityRolePickerRendersPagingSignals();
testUnityHandbookRendersMentalModelSignals();
testUnityUiSmokeHasVisualRegressionVerifier();
testUnityPlayerFacingEventsHideInternalPrivatePlaceholders();
testUnityEmbeddedLlmDefaultsAreUserControllable();
testUnitySmokeDialogueFixtureIsLocalized();
testUnityAiPackageVerifierCoversEmbeddedDefaultLlm();

console.log("unity asset contracts ok");
