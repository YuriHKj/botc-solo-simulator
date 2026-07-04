import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const unityScriptRoot = path.join(root, "unity-prototype", "Assets", "Scripts");

function readUnityBootstrapSources() {
  return fs
    .readdirSync(unityScriptRoot)
    .filter((fileName) => /^BotcPrototypeBootstrap(?:\..+)?\.cs$/.test(fileName))
    .map((fileName) => ({
      fileName,
      source: fs.readFileSync(path.join(unityScriptRoot, fileName), "utf8"),
    }));
}

function extractMethods(fileName, source) {
  const methods = [];
  const pattern = /\b(?:private|public|protected|internal)\s+(?:static\s+)?(?:[\w<>\[\],]+\s+)+(?<name>[A-Za-z_][A-Za-z0-9_]*)\s*\([^)]*\)\s*\{/g;
  let match;
  while ((match = pattern.exec(source))) {
    const openBrace = source.indexOf("{", match.index);
    let depth = 0;
    let end = openBrace;
    for (; end < source.length; end++) {
      const char = source[end];
      if (char === "{") depth += 1;
      if (char === "}") {
        depth -= 1;
        if (depth === 0) {
          end += 1;
          break;
        }
      }
    }
    methods.push({
      fileName,
      name: match.groups.name,
      body: source.slice(match.index, end),
    });
    pattern.lastIndex = end;
  }
  return methods;
}

const sources = readUnityBootstrapSources();
const allSource = sources.map((entry) => entry.source).join("\n");
const methods = sources.flatMap((entry) => extractMethods(entry.fileName, entry.source));

const forbiddenMusicOps = [
  /\bSetMood\s*\(/,
  /\bmusicSource\s*\.\s*Play\s*\(/,
  /\bmusicSource\s*\.\s*Stop\s*\(/,
  /\bmusicSource\s*\.\s*clip\s*=/,
  /\bResources\s*\.\s*Load\s*<\s*AudioClip\s*>/,
];

function isUiModalMethod(method) {
  if (method.name === "SetMood" || method.name.includes("Audio")) return false;
  if (!/^(Open|Close|Show|Apply|Toggle)/.test(method.name)) return false;
  if (/(Display|Mood|Audio|Bridge|Smoke|SyncStatus|SetupBadge)/.test(method.name)) return false;
  return (
    /(Panel|Modal|Drawer|Picker|Chat|Vote|Actions|Settings|Handbook|Storyteller|Endgame|Backdrop|Dock|Menu)/.test(method.name) ||
    /ShowModalPanel|ApplyModalBackdropVisibility|gameObject\.SetActive/.test(method.body)
  );
}

function testMoodChangesAreCentralized() {
  const callers = methods
    .filter((method) => method.name !== "SetMood" && /\bSetMood\s*\(/.test(method.body))
    .map((method) => `${method.fileName}:${method.name}`)
    .sort();

  assert.deepEqual(
    callers,
    ["BotcPrototypeBootstrap.cs:RenderAllAndMood", "BotcPrototypeBootstrap.cs:Start"],
    "Unity BGM mood changes should only happen during initialization or full state re-render"
  );
}

function testSetMoodDoesNotRestartSameClip() {
  const setMood = methods.find((method) => method.name === "SetMood");
  assert.ok(setMood, "Unity bootstrap should expose SetMood for BGM mood switching");
  assert.ok(
    /currentMood\s*==\s*nextMood\s*&&\s*musicSource\.clip\s*==\s*clip/.test(setMood.body) &&
      /if\s*\(\s*!musicSource\.isPlaying\s*\)\s*musicSource\.Play\s*\(\s*\)\s*;\s*return\s*;/.test(setMood.body),
    "SetMood should keep the current clip instead of restarting BGM when the phase mood is unchanged"
  );
}

function testModalMethodsDoNotRestartBgm() {
  const modalMethods = methods.filter(isUiModalMethod);
  assert.ok(modalMethods.length >= 10, "Unity modal audio regression contract should inspect common UI modal methods");

  const violations = [];
  for (const method of modalMethods) {
    for (const pattern of forbiddenMusicOps) {
      if (pattern.test(method.body)) {
        violations.push(`${method.fileName}:${method.name} matched ${pattern}`);
      }
    }
  }

  assert.deepEqual(
    violations,
    [],
    "Opening or closing UI modals should not call SetMood, reload AudioClip resources, or directly restart musicSource"
  );
}

function testModalBackdropOnlyControlsVisualState() {
  const backdrop = methods.find((method) => method.name === "ApplyModalBackdropVisibility");
  assert.ok(backdrop, "Unity bootstrap should centralize modal backdrop visibility");
  assert.ok(
    backdrop.body.includes("modalBackdrop.gameObject.SetActive") &&
      !/\bmusicSource\b|\bSetMood\b|\bResources\s*\.\s*Load\s*<\s*AudioClip\s*>/.test(backdrop.body),
    "Modal backdrop updates should remain visual-only and not touch BGM"
  );
}

function testAudioAssetsStillUseDedicatedSources() {
  assert.ok(
    allSource.includes("musicSource.loop = true") &&
      allSource.includes("uiAudioSource.loop = false") &&
      allSource.includes("uiAudioSource.playOnAwake = false"),
    "Unity should keep looping BGM and one-shot UI audio on separate AudioSource instances"
  );
}

function methodBody(name) {
  const method = methods.find((entry) => entry.name === name);
  assert.ok(method, `Unity bootstrap should expose ${name}`);
  return method.body;
}

function testProactiveWhisperPanelRendersEveryQueuedOffer() {
  const render = methodBody("RenderProactiveWhisperPanel");
  const queue = methodBody("RenderProactiveWhisperQueueList");
  assert.ok(
    allSource.includes("proactiveWhisperQueueListRoot") &&
      render.includes("RenderProactiveWhisperQueueList(offers, offer)") &&
      queue.includes("for (var i = 0; i < offers.Length; i++)") &&
      queue.includes("AddProactiveWhisperQueueRow") &&
      allSource.includes("AcceptProactiveWhisperOffer(ProactiveWhisperViewModel offer)") &&
      allSource.includes("DeclineProactiveWhisperOffer(ProactiveWhisperViewModel offer)"),
    "Unity proactive whisper UI should render a visible row for every queued offer with per-offer accept/decline actions"
  );
  assert.ok(
    render.includes("有人想私聊你") && !/proactiveWhisperTitleText\.text\s*=\s*\$"\{playerName\}/.test(render),
    "pending proactive whisper titles should avoid leaking claimed role/persona before acceptance"
  );
}

function testProactiveWhisperReturnsAfterPrivateChatClose() {
  const closePrivateChat = methodBody("ClosePrivateChatPanel");
  const delayedRender = methodBody("RenderProactiveWhisperAfterDialogueSettles");
  assert.ok(
    closePrivateChat.includes("ScheduleProactiveWhisperRenderAfterDialogue()") &&
      delayedRender.includes("!ProactiveWhisperBlockedByDialogue()") &&
      delayedRender.includes("!GameplayOverlayOpen()") &&
      delayedRender.includes("RenderProactiveWhisperPanel()"),
    "closing private chat after accepting one proactive invite should re-check and reveal any remaining queued invite"
  );
}

function testPassNominationButtonOnlyClosesWindow() {
  const tertiaryAction = methodBody("PhaseAssistTertiaryAction");
  const sendAction = methodBody("SendUnityAction");
  assert.ok(
    tertiaryAction.includes('SendUnityAction("pass-nomination-window", toNight: false)') &&
      sendAction.includes("bool? toNight = null") &&
      sendAction.includes('\\"toNight\\"'),
    "Unity pass-nomination button should close the nomination window before a separate day advance, not jump straight to night"
  );
}

function testBottomActionDockHasSafeGrimoireLayout() {
  const render = methodBody("RenderGrimoire");
  const toggle = methodBody("ToggleBottomDock");
  assert.ok(
    allSource.includes('new Vector2(1810f, 76f), new Vector2(172f, 38f), ToggleBottomDock') &&
      render.includes("dockSafeYOffset") &&
      render.includes("bottomDockOpen ? 146f : 36f") &&
      render.includes("bottomDockOpen ? 0.335f : 0.360f") &&
      toggle.includes("RenderGrimoire()"),
    "bottom action controls should sit outside the bottom-center player card area and force the grimoire ring to re-layout when opened"
  );
}

function testTopHudUsesLightweightChrome() {
  const topHud = methodBody("BuildTopHud");
  assert.ok(
    topHud.includes('new Vector2(-830f, -78f), new Vector2(830f, -14f)') &&
      topHud.includes('new Vector2(454f, 64f), new Color(0.010f, 0.012f, 0.014f, 0.36f)') &&
      topHud.includes('new Vector2(1128f, 6f), new Vector2(1660f, 64f), new Color(0.010f, 0.012f, 0.014f, 0.34f)') &&
      allSource.includes("AddHudToolButton") &&
      topHud.includes('AddHudToolButton("新局"') &&
      !topHud.includes('AddButton("新局"') &&
      !topHud.includes('new Vector2(560f, 64f), new Color(0.010f, 0.012f, 0.014f, 0.50f)') &&
      !topHud.includes('new Vector2(1014f, 0f), new Vector2(1660f, 64f), new Color(0.010f, 0.012f, 0.014f, 0.50f)') &&
      !topHud.includes('new Vector2(560f, 74f), new Color(0.010f, 0.012f, 0.014f, 0.78f)') &&
      !topHud.includes('new Vector2(1660f, 74f), new Color(0.010f, 0.012f, 0.014f, 0.78f)'),
    "top HUD should stay compact and lightweight instead of returning to wide opaque black pods or full-size menu buttons"
  );
}

function testFlowRailUsesCompactPlayerFacingCards() {
  const sideControls = methodBody("BuildSideControls");
  const updateFlowGuide = methodBody("UpdateFlowGuideUi");
  const flowNextHint = methodBody("FlowNextHint");
  assert.ok(
    sideControls.includes('new Vector2(18f, -248f), new Vector2(230f, 248f), new Color(0.006f, 0.013f, 0.020f, 0.10f)') &&
      sideControls.includes('"阶段", 21') &&
      sideControls.includes('AddFlowTaskCard(phaseDock, "Current", "当前"') &&
      sideControls.includes('AddFlowTaskCard(phaseDock, "State", "状态"') &&
      sideControls.includes('AddFlowTaskCard(phaseDock, "Next", "下一步"') &&
      !sideControls.includes('"当前阶段"') &&
      !sideControls.includes('"等待原因"') &&
      !sideControls.includes('"推荐下一步"'),
    "left flow rail should use short player-facing labels and lighter chrome"
  );
  assert.ok(
    updateFlowGuide.includes('stateTitle = "畅通"') &&
      updateFlowGuide.includes('stateTitle = "阻塞"') &&
      updateFlowGuide.includes("ClampTextBlock(currentHint, 1, 22)") &&
      updateFlowGuide.includes("ClampTextBlock(stateHint, 2, 22)") &&
      updateFlowGuide.includes("ClampTextBlock(nextHint, 1, 22)") &&
      flowNextHint.includes('"按主按钮继续。"') &&
      !flowNextHint.includes("点击下方主按钮推进流程。"),
    "left flow rail should keep current/stalled/next hints compact instead of showing tutorial-length copy"
  );
}

function testPlayerTokenPlateDoesNotOverlayRoleIcon() {
  const token = methodBody("RenderPlayerToken");
  assert.ok(
    token.includes("rt.sizeDelta = new Vector2(176f, 220f)") &&
      token.includes('AddPanel("Name Plate"') &&
      token.includes("new Vector2(-74f, 26f), new Vector2(74f, 54f)") &&
      token.includes('AddText("Role Label"') &&
      token.includes("new Vector2(-112f, 0f), new Vector2(112f, 24f)") &&
      token.includes('AddText("Unknown Token Mark"'),
    "player token seat plate, role label, and unknown marker should live below or inside the token art without covering the role icon"
  );
}

function testInfoDrawerPublicTabsAvoidInternalTimelineTerms() {
  assert.ok(
    ["\"events\"", "\"whispers\"", "\"public\"", "\"clues\""].every((term) => allSource.includes(term)) &&
      ["BuildWhisperTabText", "BuildPublicSpeechTabText", "BuildClueSummaryTabText"].every((term) => allSource.includes(term)),
    "information drawer should expose logs, private chat, public speech, and clue summary tabs"
  );
  const publicTimelineSurface = [
    methodBody("InfoTimelineBody"),
    methodBody("InfoTimelineRationaleCardsLine"),
    methodBody("AddInfoTimelineRationaleDrilldown"),
    methodBody("RationaleCardMatchupTraceLine"),
    methodBody("RationaleCardEvidenceTraceLine"),
    methodBody("RationaleCardNextCheckTraceLine"),
    methodBody("RationaleCardSectionLine"),
    methodBody("RationaleCardSection"),
  ].join("\n");
  for (const term of ["Timeline Rationale", "Structured rationale", "reason:", "cards:", "target:", "runner:", "evidence:", "source:", "next:"]) {
    assert.equal(
      publicTimelineSurface.includes(term),
      false,
      `info drawer public timeline should not expose internal field wording: ${term}`
    );
  }
  assert.ok(
    publicTimelineSurface.includes("PlayerFacingRationaleLabel"),
    "info drawer public timeline should map rationale cards to player-facing labels"
  );
}

testMoodChangesAreCentralized();
testSetMoodDoesNotRestartSameClip();
testModalMethodsDoNotRestartBgm();
testModalBackdropOnlyControlsVisualState();
testAudioAssetsStillUseDedicatedSources();
testProactiveWhisperPanelRendersEveryQueuedOffer();
testProactiveWhisperReturnsAfterPrivateChatClose();
testPassNominationButtonOnlyClosesWindow();
testBottomActionDockHasSafeGrimoireLayout();
testTopHudUsesLightweightChrome();
testFlowRailUsesCompactPlayerFacingCards();
testPlayerTokenPlateDoesNotOverlayRoleIcon();
testInfoDrawerPublicTabsAvoidInternalTimelineTerms();

console.log("unity UI audio regression contracts ok");
