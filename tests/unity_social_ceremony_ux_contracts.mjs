import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const scriptRoot = path.join(root, "unity-prototype", "Assets", "Scripts");
const stagePath = path.join(scriptRoot, "BotcPrototypeBootstrap.StageDialogue.cs");
const nominationPath = path.join(scriptRoot, "BotcPrototypeBootstrap.NominationVote.cs");
const stageSource = fs.readFileSync(stagePath, "utf8");
const nominationSource = fs.readFileSync(nominationPath, "utf8");
const allSource = `${stageSource}\n${nominationSource}`;

function extractMethods(source) {
  const methods = new Map();
  const pattern = /\b(?:private|public|protected|internal)\s+(?:static\s+)?(?:[\w<>\[\],?]+\s+)+(?<name>[A-Za-z_][A-Za-z0-9_]*)\s*\([^)]*\)\s*\{/g;
  let match;
  while ((match = pattern.exec(source))) {
    const openBrace = source.indexOf("{", match.index);
    let depth = 0;
    let end = openBrace;
    for (; end < source.length; end += 1) {
      if (source[end] === "{") depth += 1;
      if (source[end] === "}") {
        depth -= 1;
        if (depth === 0) {
          end += 1;
          break;
        }
      }
    }
    methods.set(match.groups.name, source.slice(match.index, end));
    pattern.lastIndex = end;
  }
  return methods;
}

const methods = new Map([
  ...extractMethods(stageSource),
  ...extractMethods(nominationSource),
]);

function methodBody(name) {
  const body = methods.get(name);
  assert.ok(body, `Unity social ceremony should expose ${name}`);
  return body;
}

function testFrozenActionFirewall() {
  const primary = methodBody("PhaseAssistPrimaryAction");
  const secondary = methodBody("PhaseAssistSecondaryAction");
  const tertiary = methodBody("PhaseAssistTertiaryAction");
  const publicSpeech = methodBody("SubmitHumanPublicSpeech");
  const humanNomination = methodBody("SendHumanNominationIntent");
  const response = methodBody("SubmitNominationDebateResponse");
  const resolve = methodBody("ResolveNominationDebateToVote");

  assert.ok(primary.includes('SendUnityAction("auto-advance", mode: "decision")'));
  assert.ok(secondary.includes('SendUnityAction("open-nomination-window")'));
  assert.ok(tertiary.includes('SendUnityAction("pass-nomination-window", toNight: false)'));
  assert.ok(publicSpeech.includes('SendUnityAction("human-public-speech", focusId, "", text, "human-public")'));
  assert.ok(humanNomination.includes('SendUnityAction("human-nomination-intent", playerId: target.id, text: reason)'));
  assert.ok(response.includes('SendUnityAction("nomination-debate-response", text: text)'));
  assert.ok(resolve.includes('SendUnityAction("resolve-nomination-vote", humanVoteYes: humanVoteYes)'));
  assert.ok(nominationSource.includes("ResolveNominationDebateToVote(true)"));
  assert.ok(nominationSource.includes("ResolveNominationDebateToVote(false)"));
}

function visibleStringLiterals(source) {
  return source
    .split(/\r?\n/)
    .filter((line) =>
      /AddText\(|AddButton\(|AddToolActionButton\(|AddInputField\(|AddPhaseTransitionRouteChip\(|\.text\s*=|QueueStageDialogue\(|publicSpeechStatus\s*=/.test(line)
    )
    .flatMap((line) => [...line.matchAll(/"(?:\\.|[^"\\])*"/g)].map((match) => match[0].slice(1, -1)));
}

const presentationChecks = [
  ["public speaker/focus/question signal", () => {
    const publicSignal = methodBody("RenderPublicCeremonySignal");
    const question = methodBody("CurrentPublicQuestion");
    assert.ok(publicSignal.includes("speaker") && publicSignal.includes("focus") && publicSignal.includes("question"));
    assert.ok(question.includes("lastStep") && question.includes("CeremonyFallback"));
    assert.ok(methodBody("RenderPhaseAssistPanel").includes("RenderPublicCeremonySignal"));
  }],
  ["single primary emphasis", () => {
    const primary = methodBody("SetSocialCeremonyPrimaryAction");
    assert.ok(primary.includes("SetButtonSuggested") && primary.includes("false") && primary.includes("true"));
    assert.ok(methodBody("ConfigureNominationDebateBeat").includes("SetSocialCeremonyPrimaryAction"));
    assert.ok(methodBody("ApplyVoteResultPrimaryAction").includes("SetSocialCeremonyPrimaryAction"));
  }],
  ["mutually exclusive stage ownership and restoration", () => {
    const suspend = methodBody("SuspendSocialCeremonySurfaces");
    const restore = methodBody("RestoreSocialCeremonySurfaces");
    assert.ok(suspend.includes("phaseAssistPanel") && suspend.includes("nominationDebatePanel"));
    assert.ok(restore.includes("RenderPhaseAssistPanel") && restore.includes("RenderNominationDebatePanel"));
    assert.ok(methodBody("BeginPhaseTransition").includes("SuspendSocialCeremonySurfaces"));
    assert.ok(methodBody("ShowStageDialogue").includes("PrepareStageDialogue"));
    assert.ok(methodBody("PrepareStageDialogue").includes("SuspendSocialCeremonySurfaces"));
    assert.ok(methodBody("HideStageDialogue").includes("RestoreSocialCeremonySurfaces"));
  }],
  ["dialogue pending matter and vote-result handoff", () => {
    assert.ok(methodBody("UpdateStageDialogueMeta").includes("StageDialoguePendingQuestion"));
    assert.ok(methodBody("PrepareStageDialogue").includes("stageDialogueReturnsToVoteCeremony = stageDialogueReturnsToVoteCeremony"));
    assert.ok(methodBody("HideStageDialogue").includes("OpenVotePanel"));
  }],
  ["response then ballot gating", () => {
    const beat = methodBody("ConfigureNominationDebateBeat");
    assert.ok(beat.includes("canRespond"));
    assert.ok(beat.includes("nominationVoteYesButton.gameObject.SetActive(!canRespond)"));
    assert.ok(beat.includes("nominationVoteNoButton.gameObject.SetActive(!canRespond)"));
    assert.ok(beat.includes("nominationDebateResponseButton.gameObject.SetActive(canRespond)"));
    assert.ok(beat.includes("nominationTimelineButton.gameObject.SetActive(true)"));
  }],
  ["live vote instruments and exported result facts", () => {
    const render = methodBody("RenderVoteTokenCeremony");
    const summary = methodBody("BuildVoteResultSummary");
    assert.ok(render.includes("RenderVoteTallyRail") && render.includes("RenderVoteProgressStrip"));
    assert.ok(summary.includes("vote.threshold") && summary.includes("vote.yesVotes") && summary.includes("vote.resultText"));
    assert.ok(summary.includes("VoteHumanChoiceLabel") && summary.includes("VotePendingExecutionLabel"));
    assert.ok(methodBody("UpdateVotePanelText").includes("BuildVoteResultSummary"));
  }],
  ["realtime and reduced-motion vote convergence", () => {
    const restart = methodBody("RestartVoteAnimation");
    const update = methodBody("UpdateVoteAnimationFrame");
    assert.ok(restart.includes("Time.realtimeSinceStartup") && restart.includes("UiMotionDisabled()"));
    assert.ok(update.includes("Time.realtimeSinceStartup") && update.includes("UiMotionDisabled()"));
    assert.equal(/\bTime\.time\b/.test(`${restart}\n${update}`), false);
  }],
  ["player-facing copy avoids implementation terminology", () => {
    const visible = visibleStringLiterals(allSource).join("\n");
    const forbidden = [/\bbridge\b/i, /\bcore\b/i, /\bpayload\b/i, /\bviewmodel\b/i, /同步/i, /同步状态/i];
    const matches = forbidden.filter((pattern) => pattern.test(visible)).map(String);
    assert.deepEqual(matches, [], `player-facing ceremony copy matched ${matches.join(", ")}`);
  }],
];

testFrozenActionFirewall();
console.log("unity social ceremony frozen action firewall passed");

const failures = [];
for (const [label, check] of presentationChecks) {
  try {
    check();
  } catch (error) {
    failures.push(`${label}: ${error.message}`);
  }
}

assert.deepEqual(
  failures,
  [],
  `Unity social ceremony presentation contracts failed:\n- ${failures.join("\n- ")}`
);

console.log("unity social ceremony UX contracts passed");
