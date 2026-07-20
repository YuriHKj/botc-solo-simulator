import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const sourcePath = path.join(
  process.cwd(),
  "unity-prototype",
  "Assets",
  "Scripts",
  "BotcPrototypeBootstrap.InfoDrawer.cs"
);
const source = fs.readFileSync(sourcePath, "utf8");

function methodBody(name) {
  const signature = new RegExp(
    `\\b(?:private|public|protected|internal)\\s+(?:static\\s+)?(?:[\\w<>\\[\\],]+\\s+)+${name}\\s*\\([^)]*\\)\\s*\\{`,
    "g"
  );
  const match = signature.exec(source);
  assert.ok(match, `InfoDrawer should expose ${name}`);
  const openBrace = source.indexOf("{", match.index);
  let depth = 0;
  for (let index = openBrace; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(match.index, index + 1);
    }
  }
  assert.fail(`InfoDrawer method ${name} should have balanced braces`);
}

function testPrivateNotebookKeepsEveryPlayerAndRecordReachable() {
  const render = methodBody("RenderWhisperInformationCards");
  const buildPlayers = methodBody("BuildWhisperNotebookCards");
  const lensEntries = methodBody("BuildWhisperNotebookLensEntries");

  assert.ok(!/BuildWhisperNotebookCards\(\)\.Take\(3\)/.test(render), "private notebook must not stop at three players");
  assert.ok(
    /vm\.players[\s\S]*!player\.human/.test(buildPlayers) && !/\.Take\s*\(/.test(buildPlayers),
    "private notebook should enumerate every non-human player without a top-N cut"
  );
  assert.ok(
    buildPlayers.includes('playerLabel = player == null ? "未知玩家" : NotebookSeatLabel(player)') &&
      !buildPlayers.includes("playerLabel = FirstNonEmpty(NameForPlayerId(group.Key)"),
    "unknown private counterparts should remain reachable without exposing their raw identifiers"
  );
  assert.ok(
    source.includes("activeWhisperNotebookPlayerIndex") &&
      source.includes("activeWhisperNotebookLensIndex") &&
      source.includes("activeWhisperNotebookRecordIndex") &&
      render.includes("NormalizeWhisperNotebookState") &&
      render.includes("AddWhisperNotebookPlayerSelector") &&
      render.includes("AddWhisperNotebookLensSelector") &&
      render.includes("AddWhisperNotebookDetail"),
    "private notebook should expose independent player, lens, and record navigation"
  );
  assert.ok(
    lensEntries.includes("IdentityClaims") &&
      lensEntries.includes("NightInformation") &&
      lensEntries.includes("RecentStatements") &&
      lensEntries.includes("ItemsToVerify") &&
      /RecentStatements[\s\S]*return entries/.test(lensEntries),
    "recent statements should be the lossless fallback while specialized lenses remain available"
  );
  assert.ok(
    buildPlayers.includes("WhisperNotebookEntryHasVisibleContent") &&
      methodBody("WhisperNotebookEntryHasVisibleContent").includes("questionToAsk") &&
      methodBody("WhisperNotebookEntryHasVisibleContent").includes("followUpPrompts") &&
      methodBody("WhisperNotebookDetailText").includes("Concat(entry.followUpPrompts") &&
      !methodBody("WhisperNotebookDetailText").includes("FirstOrDefault"),
    "question-only records and every supplied follow-up should remain reachable in the verification lens"
  );
  for (const label of ["身份声称", "夜间信息", "近期发言", "待验证"]) {
    assert.ok(source.includes(`"${label}"`), `private notebook should render the ${label} lens`);
  }
}

function testPublicNotebookBrowsesDayFocusAndOriginalSpeech() {
  const render = methodBody("RenderPublicSpeechCards");
  const filtered = methodBody("BuildFilteredPublicSpeechEntries");
  const focusKey = methodBody("PublicSpeechFocusKey");
  const detail = methodBody("AddPublicSpeechDetail");

  assert.ok(!/BuildPublicSpeechNotebookCards\(\)\.Take\(3\)/.test(render), "public notebook must not stop at three summaries");
  assert.ok(
    source.includes("activePublicSpeechDayIndex") &&
      source.includes("activePublicSpeechFocusIndex") &&
      source.includes("activePublicSpeechRecordIndex") &&
      render.includes("NormalizePublicSpeechNotebookState") &&
      render.includes("AddPublicSpeechDaySelector") &&
      render.includes("AddPublicSpeechFocusSelector") &&
      render.includes("AddPublicSpeechDetail"),
    "public notebook should expose independent day, focus, and source-record navigation"
  );
  assert.ok(
    filtered.includes("PublicSpeechDayKey") && filtered.includes("PublicSpeechFocusKey"),
    "public source selection should apply both day and focus filters"
  );
  assert.ok(
    focusKey.includes("!string.IsNullOrWhiteSpace(entry.focusId)") &&
      focusKey.includes("if (focus != null) return focus.id") &&
      focusKey.indexOf("entry.focusId") < focusKey.indexOf("entry.targetId") &&
      focusKey.indexOf("entry.targetId") < focusKey.lastIndexOf('return "table"'),
    "public focus should prefer a displayable focus, then a displayable target, then the neutral whole-table bucket"
  );
  assert.ok(
    detail.includes("原始发言") && detail.includes("匹配记录") && detail.includes("PlayerFacingClueLine"),
    "public detail should identify and sanitize the original statement with its filtered position"
  );
}

function testSelectedSourcesAreFullAndDenseSafe() {
  for (const name of ["AddWhisperNotebookDetail", "AddPublicSpeechDetail"]) {
    const body = methodBody(name);
    assert.ok(!body.includes("Ellipsize("), `${name} should not replace selected evidence with an ellipsis`);
    assert.ok(
      body.includes("NotebookTextPages") &&
      body.includes("horizontalOverflow = HorizontalWrapMode.Wrap") &&
        body.includes("resizeTextForBestFit = true") &&
        body.includes("resizeTextMinSize") &&
        body.includes("resizeTextMaxSize"),
      `${name} should wrap and fit the full selected source inside its fixed detail panel`
    );
  }
  const textPages = methodBody("NotebookTextPages");
  assert.ok(
    source.includes("activeWhisperNotebookTextPageIndex") &&
      source.includes("activePublicSpeechTextPageIndex") &&
      textPages.includes("maxChars = 180") &&
      textPages.includes("maxLines = 7") &&
      textPages.includes("pages.Add(buffer.ToString())") &&
      textPages.includes("buffer.Clear()") &&
      methodBody("AddNotebookRecordControls").includes("上一页") &&
      methodBody("AddNotebookRecordControls").includes("下一页") &&
      methodBody("AddNotebookRecordControls").includes("原文"),
    "long selected evidence should be split into reachable text pages instead of relying on minimum font size"
  );

  const buildPanel = methodBody("BuildEventPanel");
  const renderVisuals = methodBody("RenderInfoDrawerVisuals");
  assert.ok(
    buildPanel.includes("new Vector2(-720f, -330f)") &&
      buildPanel.includes("new Vector2(-18f, 330f)") &&
      buildPanel.includes("new Vector2(106f, 86f)") &&
      buildPanel.includes("new Vector2(-30f, -112f)"),
    "notebook redesign should stay inside the established fixed right-side drawer envelope"
  );
  assert.ok(
    renderVisuals.includes("queueBody.gameObject.SetActive(!showActivityCards && !showNotebookCards)"),
    "legacy drawer summary text should stay hidden on both notebook tabs so it cannot cover record navigation"
  );
}

function testSparseStatesAndPrivacyRemainPlayerFacing() {
  const privateEmpty = methodBody("WhisperNotebookEmptyGuidance");
  const publicEmpty = methodBody("PublicSpeechEmptyGuidance");
  const pending = methodBody("AddWhisperNotebookPendingDetail");

  assert.ok(privateEmpty.includes("下一步") && publicEmpty.includes("下一步"), "sparse notebook states should offer a concrete next step");
  assert.ok(
    pending.includes("publicIntent") && pending.includes("publicReason") && pending.includes("接受后") && !pending.includes("hidden"),
    "pending invitations should show only their public-facing context before acceptance"
  );

  const playerFacingSurface = source
    .replaceAll('"JS Core"', '""')
    .replaceAll('"viewmodel"', '""')
    .replaceAll('"ViewModel"', '""')
    .replaceAll('"payload"', '""')
    .replaceAll('"Payload"', '""');
  const forbiddenPlayerFacingStrings = [...playerFacingSurface.matchAll(/"(?:\\.|[^"\\])*"/g)]
    .map((match) => match[0])
    .filter((literal) => /JS Core|payload|viewmodel/i.test(literal));
  assert.deepEqual(forbiddenPlayerFacingStrings, [], "InfoDrawer player-facing strings must not expose backend vocabulary");
  assert.ok(
    methodBody("PlayerFacingClueLine").includes('Replace("JS Core", "规则服务")') &&
      methodBody("PlayerFacingClueLine").includes('Replace("viewmodel", "界面数据")') &&
      methodBody("PlayerFacingClueLine").includes('Replace("payload", "提交内容")'),
    "the shared player-facing sanitizer should continue translating backend vocabulary found in supplied text"
  );
  assert.ok(
    methodBody("AddWhisperNotebookDetail").includes("仅你可见") && methodBody("AddPublicSpeechDetail").includes("全桌可见"),
    "source detail should make private/public visibility boundaries explicit"
  );
}

testPrivateNotebookKeepsEveryPlayerAndRecordReachable();
testPublicNotebookBrowsesDayFocusAndOriginalSpeech();
testSelectedSourcesAreFullAndDenseSafe();
testSparseStatesAndPrivacyRemainPlayerFacing();

console.log("unity info drawer notebook UX contracts ok");
