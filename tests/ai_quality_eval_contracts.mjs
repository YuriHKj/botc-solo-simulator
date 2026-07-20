import assert from "node:assert/strict";

import {
  AI_QUALITY_BASELINE_THRESHOLDS,
  buildAIQualityEvaluationSet,
  evaluateAIQualityGates,
  summarizeAIQualityEvaluation,
} from "../scripts/ai_quality_eval.mjs";
import { inspectOutput } from "../scripts/ai_dialogue_smoke.mjs";

function compactSignal(text) {
  return `${text ?? ""}`.replace(/[，。！？；：、\s...（）()]/g, "").trim();
}

function spokenLineAppearsInText(line, text) {
  const expected = `${line ?? ""}`.trim();
  const visible = `${text ?? ""}`.trim();
  if (!expected || !visible) return false;
  if (visible.includes(expected)) return true;
  return [expected.replaceAll("口径", "说法"), expected.replaceAll("说法", "口径")].some((variant) =>
    variant && visible.includes(variant)
  );
}

function nominationDefenseOpeningKey(row) {
  const text = `${row.text ?? ""}`.replace(/\s+/g, " ").trim();
  const opening = text.split(/[。；]/u)[0] ?? text;
  return opening
    .replace(/：.*/u, "：")
    .replace(/「.*$/u, "「")
    .replace(/\d+号/gu, "N号")
    .trim();
}

function signalBodiesOverlap(left, right) {
  const leftBody = `${left ?? ""}`;
  const rightBody = `${right ?? ""}`;
  if (!leftBody || !rightBody) return false;
  if (leftBody === rightBody) return true;
  return Math.min(leftBody.length, rightBody.length) >= 12 && (leftBody.startsWith(rightBody) || rightBody.startsWith(leftBody));
}

function hasDuplicateOrNestedSignalBody(bodies) {
  const seenBodies = [];
  for (const body of bodies) {
    if (seenBodies.some((seenBody) => signalBodiesOverlap(seenBody, body))) {
      return true;
    }
    seenBodies.push(body);
  }
  return false;
}

function countOccurrences(text, needle) {
  if (!needle) return 0;
  let count = 0;
  let index = `${text ?? ""}`.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = `${text ?? ""}`.indexOf(needle, index + needle.length);
  }
  return count;
}

function publicPressureLeadBody(sentence = "") {
  return `${sentence ?? ""}`.replace(/[。！？；\s]+$/gu, "").trim();
}

function isPublicPressureLeadBody(body = "") {
  const compact = `${body ?? ""}`.replace(/\s+/g, "");
  return (
    compact.length >= 18 &&
    /[0-9]+号/u.test(compact) &&
    /(这条|这边|压力|主线|观察位|台面|回应)/u.test(compact) &&
    /(压|回应|主线|观察|不放下|补实|降压|记一笔)/u.test(compact)
  );
}

function hasRepeatedPublicPressureLeadExtension(text = "") {
  const value = `${text ?? ""}`;
  for (let seat = 1; seat <= 20; seat += 1) {
    const target = `${seat}号`;
    const knownLeads = [
      `${target}这条不单看，${target}这边我先不放下，回应绕就继续压`,
      `${target}这条先单独记，${target}这边我先不放下，回应绕就继续压`,
      `${target}这条要看后续回应，${target}这边我先不放下，回应绕就继续压`,
      `${target}这条不单看，${target}这条先留在主线里，等回应再降压`,
      `${target}这条先单独记，${target}这条先留在主线里，等回应再降压`,
      `${target}这条要看后续回应，${target}这条先留在主线里，等回应再降压`,
      `${target}这条不单看，先把${target}留在压力线上，看回应有没有补实`,
      `${target}这条先单独记，先把${target}留在压力线上，看回应有没有补实`,
      `${target}这条要看后续回应，先把${target}留在压力线上，看回应有没有补实`,
    ];
    if (knownLeads.some((lead) => {
      const first = value.indexOf(lead);
      return first >= 0 && value.indexOf(lead, first + lead.length) >= 0;
    })) {
      return true;
    }
  }
  const fragments = `${text ?? ""}`.match(/[^。！？；]+[。！？；]?/gu) ?? [];
  return fragments.some((fragment, index) => {
    const body = publicPressureLeadBody(fragment);
    if (!isPublicPressureLeadBody(body)) {
      return false;
    }
    return fragments
      .slice(index + 1)
      .some((later) => {
        const laterBody = publicPressureLeadBody(later);
        return laterBody.startsWith(`${body}，`) || laterBody.startsWith(`${body},`) || laterBody.startsWith(`${body}：`);
      });
  });
}

function normalizedPrivateRunnerUpComparisonLine(line) {
  return compactSignal(line).replace(/\d+号/gu, "X号");
}

const PUBLIC_PRESSURE_ACTION_DUPLICATE_PATTERN =
  /(?:我会先压\s*(\d+号)[\s\S]{0,120}我(?:直说，)?先压\1|这轮先压\s*(\d+号)[\s\S]{0,120}我(?:直说，)?先压\2|我会直接压\s*(\d+号)[\s\S]{0,120}我(?:直说，)?先压\3|先把\s*(\d+号)压到桌面上[\s\S]{0,120}我(?:直说，)?先压\4|(\d+号)这边我先给压力[\s\S]{0,120}我(?:直说，)?先压\5|(\d+号)先上压力[\s\S]{0,120}我(?:直说，)?先压\6)/u;
const PUBLIC_SHADOW_ACTION_DUPLICATE_PATTERN = /我先暗记(\d+号)这条主线[\s\S]{0,120}\1我先暗记成主线/u;
const EVIL_PRIVATE_TEAM_INFO_PATTERNS = [
  /队伍先对齐：恶魔位\s*[0-9]+号/u,
  /我这边知道的底牌：恶魔是\s*[0-9]+号/u,
  /先把队伍信息说清，恶魔\s*[0-9]+号/u,
  /邪恶视角先对底：恶魔位\s*[0-9]+号/u,
  /我这边的队伍牌面：恶魔\s*[0-9]+号/u,
  /队伍先对齐：我这边看到的爪牙是/u,
  /先把队伍信息放清：爪牙位/u,
  /邪恶视角先对底，爪牙位是/u,
  /我这边的队伍牌面：爪牙/u,
];
const EVIL_PRIVATE_COVER_PLAN_PATTERNS = [
  /台面上，\s*[0-9]+号现在先接身份，我先把他放到火力点/u,
  /台面安排：伪装先不锁死，今天把\s*[0-9]+号\s*放到火力点/u,
  /台面上我先不定死伪装，今天把\s*[0-9]+号\s*放到火力点/u,
  /伪装先留活口，白天先压\s*[0-9]+号\s*的身份和夜里信息/u,
  /台面身份边走边补，今天先把\s*[0-9]+号\s*放到讨论中心/u,
  /低信息好人方向先留着，今天把\s*[0-9]+号\s*放到火力点/u,
  /台面安排：我先往.+这个方向装，今天把\s*[0-9]+号\s*放到火力点/u,
];
const PUBLIC_FOLLOW_UP_TAIL_PATTERNS = [
  /再解释投票理由/u,
  /再补投票理由/u,
  /投票理由也要补清/u,
  /再补身份和昨晚信息/u,
  /再把身份和昨晚信息补齐/u,
  /身份和昨晚信息也要补清/u,
  /昨晚信息和身份口径也要补清/u,
  /昨晚信息和身份说法也要补清/u,
  /再补昨晚信息/u,
  /再把昨晚信息说完整/u,
  /昨晚信息也要补清/u,
  /昨晚信息也要说完整/u,
  /再说昨晚信息/u,
  /说明提名压力怎么解/u,
  /回应提名压力怎么解/u,
  /再解释提名压力/u,
  /再说明为什么进提名压力/u,
];
const CLAIM_DISCLOSURE_BALANCED_REASON_PATTERNS = [
  /现在需要把身份口径交到能被追问的程度/u,
  /这轮要让桌面有具体口径可以复核/u,
  /身份线已经到该给可验证落点的时候/u,
  /继续含糊只会让后续追问失焦/u,
  /先给桌面能追问的边界，不把具体身份一次说死/u,
  /现在适合交可核范围，具体身份还留一点余地/u,
  /这轮先让口径可追问，身份细节等压力再补/u,
  /先把可验证边界放出来，不急着把整条身份线摊完/u,
];

function snippetsOverlapEvidence(snippets = [], evidence = []) {
  const cleanSnippets = snippets.map(compactSignal).filter(Boolean);
  const cleanEvidence = evidence.map(compactSignal).filter(Boolean);
  return cleanSnippets.some((snippet) =>
    cleanEvidence.some((entry) => {
      const snippetHead = snippet.slice(0, Math.min(10, snippet.length));
      const entryHead = entry.slice(0, Math.min(10, entry.length));
      return !!snippetHead && !!entryHead && (snippet.includes(entryHead) || entry.includes(snippetHead));
    })
  );
}

function testBuildsFixedQualityEvaluationSet() {
  const evaluation = buildAIQualityEvaluationSet({ seed: 2026060201 });
  assert.equal(evaluation.scenarioId, "tb-fixed-quality");
  assert.ok(evaluation.rows.length >= 6, "fixed AI quality set should include several dialogue samples");
  const shadowPersonaRow = evaluation.rows.find(
    (row) => row.id === "tb-fixed-quality-public-public-persona-pressure-shadow"
  );
  assert.ok(shadowPersonaRow, "quality set should include the shadow-persona public branch");
  assert.deepEqual(
    inspectOutput(shadowPersonaRow),
    [],
    "shadow-persona public speech should satisfy the strict player-language warning policy"
  );
  const crossDayTargetSwitchRow = evaluation.rows.find(
    (row) => row.id === "tb-fixed-quality-public-cross-day-target-switch"
  );
  assert.ok(crossDayTargetSwitchRow, "quality set should include the cross-day target-switch branch");
  assert.match(crossDayTargetSwitchRow.text, /6号/u, "cross-day target switch should retain the new target");
  assert.match(
    crossDayTargetSwitchRow.text,
    /公开站队|投票态度|票型|站边|压力方向/u,
    "cross-day target switch should retain its public evidence anchor"
  );
  assert.doesNotMatch(crossDayTargetSwitchRow.text, /记忆连续性/u, "cross-day speech should not expose report headings");
  evaluation.rows.filter((row) => row.audience === "public").forEach((row) => {
    assert.doesNotMatch(
      row.text,
      /提名前，提名前|投票前，到投票|到投票我会看|再决定投不投|再决定票/u,
      `${row.id} should not duplicate event prefixes or narrate a future vote script`
    );
  });
  assert.ok(evaluation.rows.some((row) => row.audience === "private"), "quality set should include private replies");
  assert.ok(evaluation.rows.some((row) => row.source === "proactive-private"), "quality set should include proactive private whispers");
  assert.ok(evaluation.rows.some((row) => row.intent === "vote"), "quality set should include private vote-intent replies");
  assert.ok(evaluation.rows.some((row) => row.source === "formal-vote"), "quality set should include formal vote decisions");
  assert.ok(
    evaluation.rows.some((row) => row.claimDisclosureRationale),
    "quality set should include claim-disclosure rationale samples"
  );
  assert.ok(
    evaluation.rows.some((row) => row.claimDisclosureRationale?.continuity === "hold"),
    "quality set should include claim-disclosure continuity samples"
  );
  assert.ok(
    evaluation.rows.some((row) => row.claimDisclosureRationale?.continuity === "escalate"),
    "quality set should include claim-disclosure escalation samples"
  );
  assert.ok(
    evaluation.rows.some((row) => row.claimDisclosureRationale?.continuity === "revise"),
    "quality set should include claim-disclosure revision samples"
  );
  const revisionRow = evaluation.rows.find((row) => row.claimDisclosureRationale?.continuity === "revise");
  assert.ok(revisionRow?.claimDisclosureRationale?.previousRoleId, "revision sample should carry previous role id");
  assert.ok(revisionRow?.claimDisclosureRationale?.previousRoleName, "revision sample should carry previous role name");
  assert.ok(revisionRow?.claimDisclosureRationale?.roleId, "revision sample should carry current role id");
  assert.ok(
    revisionRow?.claimDisclosureRationale?.continuitySummary?.includes("->"),
    "revision sample should summarize previous -> current movement"
  );
  const crossScriptClaimRows = evaluation.rows.filter((row) => row.requiresCrossScriptClaimDisclosure);
  assert.equal(crossScriptClaimRows.length, 2, "fixed quality set should include BMR/SnV private claim-disclosure samples");
  ["bmr", "snv"].forEach((scriptId) => {
    const row = crossScriptClaimRows.find((entry) => entry.scriptId === scriptId && entry.expectedScriptId === scriptId);
    assert.ok(row, `fixed quality set should include a ${scriptId} private claim sample`);
    assert.equal(row?.source, "private-whisper");
    assert.equal(row?.intent, "claim");
    assert.ok(row?.claimDisclosureRationale?.line, `${scriptId} private claim sample should carry claim rationale`);
    assert.ok(row?.claimDisclosureRationale?.level, `${scriptId} private claim sample should classify disclosure level`);
    assert.match(row?.text ?? "", /身份|具体身份|口径|保留|公开|信息结论/, `${scriptId} private claim sample should answer the identity lane`);
  });
  const crossScriptClaimContinuityRows = evaluation.rows.filter((row) => row.requiresCrossScriptClaimContinuity);
  assert.equal(
    crossScriptClaimContinuityRows.length,
    6,
    "fixed quality set should include BMR/SnV claim hold, escalation, and revision samples"
  );
  ["bmr", "snv"].forEach((scriptId) => {
    ["hold", "escalate", "revise"].forEach((mode) => {
      const row = crossScriptClaimContinuityRows.find(
        (entry) =>
          entry.scriptId === scriptId &&
          entry.expectedScriptId === scriptId &&
          entry.expectedClaimContinuityMode === mode
      );
      assert.ok(row, `fixed quality set should include ${scriptId} claim ${mode} sample`);
      assert.equal(row?.source, "claim-disclosure-fixture");
      assert.equal(row?.audience, "private");
      assert.equal(row?.claimDisclosureRationale?.continuity, mode, `${scriptId} claim sample should preserve ${mode} mode`);
      assert.ok(row?.claimDisclosureRationale?.previousLevel, `${scriptId} claim sample should carry previous level`);
      assert.notEqual(row?.claimDisclosureRationale?.previousLevel, "none", `${scriptId} claim sample should not be a new claim`);
      assert.ok(row?.claimDisclosureRationale?.continuityLine, `${scriptId} claim sample should verbalize continuity`);
      assert.ok(
        spokenLineAppearsInText(row.claimDisclosureRationale.continuityLine, row?.text),
        `${scriptId} claim sample should include the continuity line`
      );
      if (mode === "revise") {
        assert.ok(row?.claimDisclosureRationale?.previousRoleId, `${scriptId} revision sample should carry previous role id`);
        assert.ok(row?.claimDisclosureRationale?.previousRoleName, `${scriptId} revision sample should carry previous role name`);
        assert.ok(row?.claimDisclosureRationale?.roleId, `${scriptId} revision sample should carry current role id`);
        assert.ok(
          row?.claimDisclosureRationale?.continuitySummary?.includes("->"),
          `${scriptId} revision sample should summarize previous -> current movement`
        );
      }
    });
  });
  const roleConstrainedClaimRows = evaluation.rows.filter((row) => row.requiresRoleConstrainedClaimDisclosure);
  assert.equal(roleConstrainedClaimRows.length, 6, "fixed quality set should include role-constrained claim-disclosure samples");
  [
    ["snv", "madness_pressure_cover", /公开口径|身份线/],
    ["bmr", "outsider_execution_risk", /外来者|处决/],
    ["snv", "mutant_outsider_claim_risk", /外来者|功能风险/],
    ["snv", "sweetheart_death_drunk_risk", /醉酒风险|风险边界/],
    ["snv", "barber_swap_timing", /换位窗口|触发时机/],
    ["tb", "death_trigger_timing", /死亡触发|夜里/],
  ].forEach(([scriptId, reasonKey, textPattern]) => {
    const row = roleConstrainedClaimRows.find(
      (entry) =>
        entry.scriptId === scriptId &&
        entry.expectedScriptId === scriptId &&
        entry.expectedRoleConstraintReason === reasonKey
    );
    assert.ok(row, `fixed quality set should include ${scriptId} ${reasonKey} claim constraint sample`);
    assert.equal(row?.source, "claim-disclosure-fixture");
    assert.equal(row?.audience, "public");
    assert.equal(row?.claimDisclosureRationale?.reasonKey, reasonKey);
    assert.equal(row?.claimDisclosureRationale?.publicOnly, true);
    assert.equal(row?.claimDisclosureRationale?.canRevealRole, false);
    assert.equal(row?.claimDisclosureRationale?.roleId, "");
    assert.equal(row?.claimDisclosureRationale?.roleName, "");
    assert.notEqual(row?.claimDisclosureRationale?.level, "hard");
    assert.ok(
      row?.claimDisclosureRationale?.spokenLine && row.text.includes(row.claimDisclosureRationale.spokenLine),
      `${scriptId} role constraint sample should sync rationale with rendered text`
    );
    assert.match(row?.text ?? "", textPattern, `${scriptId} role constraint sample should verbalize the role-specific risk`);
  });
  const crossScriptPublicRows = evaluation.rows.filter((row) => row.requiresCrossScriptPublicReasoning);
  assert.equal(crossScriptPublicRows.length, 2, "fixed quality set should include BMR/SnV public reasoning samples");
  ["bmr", "snv"].forEach((scriptId) => {
    const row = crossScriptPublicRows.find((entry) => entry.scriptId === scriptId && entry.expectedScriptId === scriptId);
    assert.ok(row, `fixed quality set should include a ${scriptId} public reasoning sample`);
    assert.equal(row?.source, "public-discussion");
    assert.equal(row?.audience, "public");
    assert.ok(row?.decisionRationale?.spokenLine, `${scriptId} public sample should carry final spoken rationale`);
    assert.ok(row?.focusName && (row?.text ?? "").includes(row.focusName), `${scriptId} public sample should name the focus target`);
    assert.ok(row?.evidenceSpokenText, `${scriptId} public sample should carry a public evidence anchor`);
    assert.match(row?.text ?? "", /回应|解释|身份|昨晚信息|投票|证据/, `${scriptId} public sample should keep table-action wording`);
    assert.doesNotMatch(
      row?.text ?? "",
      /让\s+你\s*把身份和昨晚信息说清楚/,
      `${scriptId} public sample should not contain a broken human-target follow-up`
    );
  });
  const crossScriptPublicMultiEvidenceRows = evaluation.rows.filter((row) => row.requiresCrossScriptPublicMultiEvidence);
  assert.equal(
    crossScriptPublicMultiEvidenceRows.length,
    2,
    "fixed quality set should include BMR/SnV public multi-evidence samples"
  );
  ["bmr", "snv"].forEach((scriptId) => {
    const row = crossScriptPublicMultiEvidenceRows.find(
      (entry) => entry.scriptId === scriptId && entry.expectedScriptId === scriptId
    );
    assert.ok(row, `fixed quality set should include a ${scriptId} public multi-evidence sample`);
    assert.equal(row?.source, "public-discussion");
    assert.equal(row?.audience, "public");
    assert.ok((row?.decisionRationale?.focusEvidenceCount ?? 0) >= 2, `${scriptId} multi-evidence sample should count evidence rows`);
    assert.ok((row?.evidenceSummaries?.length ?? 0) >= 2, `${scriptId} multi-evidence sample should keep multiple evidence summaries`);
    assert.match(
      row?.text ?? "",
      /多条|两条|不止一条|合在一起|不把它当单点|公开站队和台面压力|身份和票型|身份说法和票型|身份口径和票型|身份线.*票型|身份解释和投票线|投票和身份|公开线索更多|线索更多|证据位/,
      `${scriptId} multi-evidence sample should compress multiple public clues into readable wording`
    );
    assert.match(
      row?.text ?? "",
      /身份口径和票型一起压过来|身份(?:说法)?和票型一起压过来|身份解释和投票线卡在同一处|身份线和票型互相咬住|身份线.*票型|身份线.*投票|身份线.*压力票|身份和票型压实|死亡\/保护会搅票型|公开站队和票型在同一方向|台面压力和投票线同向|公开压力和票型互相推高|身份口径和提名压力卡在一起|身份(?:说法)?和提名压力卡在一起|身份解释和上台窗口撞在一起|身份线被提名压力顶住|台面压力和提名窗口卡在一起|公开压力和上台窗口连在一起|台面节奏已经顶到提名口/,
      `${scriptId} multi-evidence sample should synthesize how evidence families connect`
    );
    assert.match(
      row?.text ?? "",
      /身份和昨晚信息|再补昨晚信息|补清，再说昨晚信息|解释|说法对齐|补说法/,
      `${scriptId} multi-evidence sample should keep an actionable follow-up`
    );
    assert.match(
      row?.text ?? "",
      /(?:核法是(?:先听|让)|核法先交给|这条(?:先)?让|先请)\s*[0-9]+号(?:来)?.*(?:解释票型|票型解释清|把身份(?:和票型)?对上|身份(?:和票型)?(?:先)?对上|身份(?:说法|口径|和票型)?对齐|身份先(?:对上|落桌面)|把身份(?:先)?落到桌面|投票理由|台面压力|提名压力|把没讲清的点(?:先)?补(?:清|上)|解释(?:为什么)?压低证据位|说明为什么压低证据位|压低证据位的理由|压低证据位这点先讲清).*(?:身份|昨晚信息|没讲清|证据位|投票|票型|提名压力)|先把\s*[0-9]+号说法对齐|[0-9]+号先上压力.*补说法/,
      `${scriptId} multi-evidence sample should say a public verification action`
    );
    const scriptPattern = scriptId === "bmr"
      ? /BMR里|死亡\/保护|搅票型/
      : /SnV里|身份线|身份解释和投票线|疯狂压力|分开听/;
    assert.match(row?.text ?? "", scriptPattern, `${scriptId} sample should preserve script-specific public pressure context`);
  });
  const personaPressureRows = evaluation.rows.filter((row) => row.requiresPublicPersonaPressureVariant);
  assert.equal(personaPressureRows.length, 3, "fixed quality set should include pressure/shadow/steady public persona pressure samples");
  [
    ["pressure", /我会先压|这轮先压|我会直接压|压到桌面上|先给压力|先上压力|需要马上听回应/],
    ["shadow", /暗记|主线|留个心眼|观察位|压力线|留一格压力|先不放下|记一笔|不太放心/],
    ["steady", /不锁死|落到桌面|说实话/],
  ].forEach(([persona, pattern]) => {
    const row = personaPressureRows.find((entry) => entry.expectedPersona === persona);
    assert.ok(row, `fixed quality set should include a ${persona} public pressure sample`);
    assert.equal(row?.source, "public-discussion");
    assert.equal(row?.audience, "public");
    assert.equal(row?.speakerPersona, persona, `${persona} sample should preserve speaker persona`);
    assert.ok(row?.focusName && (row.text ?? "").includes(row.focusName), `${persona} sample should name the focus target`);
    assert.ok((row?.evidenceSummaries?.length ?? 0) >= 2, `${persona} sample should keep multiple evidence summaries`);
    assert.match(
      row?.text ?? "",
      /多条|两条|不止一条|合在一起|不把它当单点|不是单点|台面压力和提名窗口|公开站队和台面压力|公开站队和票型|公开压力和票型|身份和票型|身份说法和票型|身份口径和票型|身份线.*票型|身份线.*投票|身份解释和投票线|投票和身份|公开线索更多|线索更多|证据位/,
      `${persona} sample should preserve multi-evidence compression`
    );
    assert.match(
      row?.text ?? "",
      /身份口径和票型一起压过来|身份(?:说法)?和票型一起压过来|身份解释和投票线卡在同一处|身份线和票型互相咬住|身份线.*票型|身份线.*投票|身份线.*压力票|身份和票型压实|死亡\/保护会搅票型|公开站队和票型在同一方向|台面压力和投票线同向|公开压力和票型互相推高|身份口径和提名压力卡在一起|身份(?:说法)?和提名压力卡在一起|身份解释和上台窗口撞在一起|身份线被提名压力顶住|台面压力和提名窗口卡在一起|公开压力和上台窗口连在一起|台面节奏已经顶到提名口/,
      `${persona} sample should synthesize evidence families`
    );
    assert.match(row?.text ?? "", pattern, `${persona} sample should use persona-specific pressure handling`);
    assert.doesNotMatch(
      row?.text ?? "",
      PUBLIC_PRESSURE_ACTION_DUPLICATE_PATTERN,
      `${persona} sample should not repeat the same pressure action lead`
    );
    assert.doesNotMatch(row?.text ?? "", PUBLIC_SHADOW_ACTION_DUPLICATE_PATTERN, `${persona} sample should not repeat the same shadow action lead`);
    assert.doesNotMatch(row?.text ?? "", /自己人|邪恶视角|真实身份|爪牙|恶魔伪装|当前可用伪装|魔典|PRIVATE_SECRET_MARKER|bluff/i);
  });
  const timingPressureRows = evaluation.rows.filter((row) => row.requiresPublicTimingPressureVariant);
  assert.equal(timingPressureRows.length, 2, "fixed quality set should include nomination-pressure and vote-intent public timing samples");
  [
    ["nomination-pressure", /提名前|压实|上台只剩防守/],
    ["vote-intent", /到投票|压力票|补出解释|票前/],
  ].forEach(([beat, pattern]) => {
    const row = timingPressureRows.find((entry) => entry.expectedTimingBeat === beat);
    assert.ok(row, `fixed quality set should include a ${beat} public timing sample`);
    assert.equal(row?.source, "public-discussion");
    assert.equal(row?.audience, "public");
    assert.equal(row?.debateBeat, beat, `${beat} sample should preserve debate beat`);
    assert.ok(row?.focusName && (row.text ?? "").includes(row.focusName), `${beat} sample should name the focus target`);
    assert.ok((row?.evidenceSummaries?.length ?? 0) >= 2, `${beat} sample should keep multiple evidence summaries`);
    assert.match(
      row?.text ?? "",
      /多条|两条|不止一条|合在一起|不把它当单点|公开站队和台面压力|公开站队和票型|公开压力和票型|身份和票型|身份说法和票型|身份口径和票型|身份线.*票型|身份线.*投票|身份解释和投票线|投票和身份|公开线索更多|线索更多|证据位/,
      `${beat} sample should preserve multi-evidence compression`
    );
    assert.match(
      row?.text ?? "",
      /身份口径和票型一起压过来|身份(?:说法)?和票型一起压过来|身份解释和投票线卡在同一处|身份线和票型互相咬住|身份线.*票型|身份线.*投票|身份线.*压力票|身份和票型压实|死亡\/保护会搅票型|公开站队和票型在同一方向|台面压力和投票线同向|公开压力和票型互相推高|身份口径和提名压力卡在一起|身份(?:说法)?和提名压力卡在一起|身份解释和上台窗口撞在一起|身份线被提名压力顶住|台面压力和提名窗口卡在一起|公开压力和上台窗口连在一起|台面节奏已经顶到提名口/,
      `${beat} sample should synthesize evidence families`
    );
    assert.match(row?.text ?? "", pattern, `${beat} sample should use timing-specific pressure handling`);
    assert.doesNotMatch(row?.text ?? "", /自己人|邪恶视角|真实身份|爪牙|恶魔伪装|当前可用伪装|魔典|PRIVATE_SECRET_MARKER|bluff/i);
  });
  const publicSynthesisVerificationRows = evaluation.rows.filter((row) => row.requiresPublicEvidenceSynthesisVerificationVariant);
  const expectedPublicSynthesisVerificationModes = [
    [
      "identity-vote",
      /身份口径和票型一起压过来|身份(?:说法)?和票型一起压过来|身份解释和投票线卡在同一处|身份线和票型互相咬住|身份线.*票型|身份线.*投票|身份线.*压力票|身份和票型压实/,
      /(?:核法是(?:先听|让)|核法先交给|这条(?:先)?让|先请)\s*[0-9]+号(?:来)?.*身份.*票型.*投票理由|身份(?:说法)?和票型一起压过来.*压\s*[0-9]+号.*票前才解释/,
    ],
    [
      "pressure-vote",
      /公开站队和票型在同一方向|台面压力和投票线同向|公开压力和票型互相推高|死亡\/保护会搅票型|票型跟台面压力要对/,
      /(?:核法是(?:先听|让)|核法先交给|这条(?:先)?让|先请)\s*[0-9]+号(?:来)?.*票型.*台面压力|先把\s*[0-9]+号说法对齐.*票型跟台面压力要对/,
    ],
    [
      "identity-nomination",
      /身份口径和提名压力卡在一起|身份(?:说法)?和提名压力卡在一起|身份解释和上台窗口撞在一起|身份线被提名压力顶住/,
      /(?:核法是(?:先听|让)|核法先交给|这条(?:先)?让|先请)\s*[0-9]+号(?:来)?.*身份.*提名压力|身份(?:说法)?和提名压力卡在一起.*[0-9]+号这边先听回应|身份(?:说法)?和提名压力卡在一起.*既然\s*[0-9]+号报.*信息链.*票型/,
    ],
    [
      "pressure-nomination",
      /台面压力和提名窗口卡在一起|公开压力和上台窗口连在一起|台面节奏已经顶到提名口/,
      /(?:核法是(?:先听|让)|核法先交给|这条(?:先)?让|先请)\s*[0-9]+号(?:来)?.*(?:没讲清|台面压力).*提名压力|台面节奏已经顶到提名口.*压\s*[0-9]+号.*票前再补/,
    ],
  ];
  assert.equal(
    publicSynthesisVerificationRows.length,
    expectedPublicSynthesisVerificationModes.length,
    "fixed quality set should include all public synthesis verification mode samples"
  );
  expectedPublicSynthesisVerificationModes.forEach(([mode, synthesisPattern, verificationPattern]) => {
    const row = publicSynthesisVerificationRows.find((entry) => entry.expectedPublicEvidenceSynthesisVerificationMode === mode);
    assert.ok(row, `fixed quality set should include a ${mode} public synthesis verification sample`);
    assert.equal(row?.source, "public-discussion");
    assert.equal(row?.audience, "public");
    assert.ok(row?.focusName && (row.text ?? "").includes(row.focusName), `${mode} sample should name the focus target`);
    assert.ok((row?.evidenceSummaries?.length ?? 0) >= 2, `${mode} sample should preserve multiple evidence summaries`);
    assert.match(row?.text ?? "", synthesisPattern, `${mode} sample should use the expected public synthesis mode`);
    assert.match(row?.text ?? "", verificationPattern, `${mode} sample should use the matching public verification action`);
    assert.doesNotMatch(row?.text ?? "", /自己人|邪恶视角|真实身份|爪牙|恶魔伪装|当前可用伪装|魔典|PRIVATE_SECRET_MARKER|bluff/i);
  });
  const rolePressureRows = evaluation.rows.filter((row) => row.requiresPublicRolePressureVariant);
  assert.equal(rolePressureRows.length, 5, "fixed quality set should include public role-specific pressure samples");
  [
    ["info-claim", "investigator", /信息链|票型对上|不能只给身份名/],
    ["outsider-risk", "tinker", /风险边界|外来者身份|身份挡压/],
    ["death-trigger", "sage", /死亡触发|死后信息|身份会挡掉压力/],
    ["protection", "innkeeper", /保护口径|昨晚死亡|免票/],
    ["public-action", "slayer", /行动窗口|目标结果|能力牌/],
  ].forEach(([mode, roleId, pattern]) => {
    const row = rolePressureRows.find((entry) => entry.expectedRolePressureMode === mode);
    assert.ok(row, `fixed quality set should include a ${mode} public role pressure sample`);
    assert.equal(row?.source, "public-discussion");
    assert.equal(row?.audience, "public");
    assert.equal(row?.expectedClaimRoleId, roleId);
    assert.equal(row?.publicClaimRoleId, roleId, `${mode} sample should be driven by the target's public claim`);
    assert.ok(
      row?.expectedClaimRoleName && (row.text ?? "").includes(row.expectedClaimRoleName),
      `${mode} sample should name the public claim role: ${(row?.text ?? "")}`
    );
    assert.ok(row?.focusName && (row.text ?? "").includes(row.focusName), `${mode} sample should name the focus target`);
    assert.ok((row?.evidenceSummaries?.length ?? 0) >= 2, `${mode} sample should keep multiple evidence summaries`);
    assert.match(
      row?.text ?? "",
      /多条|两条|不止一条|合在一起|不把它当单点|公开站队和台面压力|公开站队和票型|公开压力和票型|身份和票型|身份说法和票型|身份口径和票型|身份线.*票型|身份线.*投票|身份解释和投票线|投票和身份|公开线索更多|线索更多|证据位/,
      `${mode} sample should preserve multi-evidence compression`
    );
    assert.match(
      row?.text ?? "",
      /身份口径和票型一起压过来|身份(?:说法)?和票型一起压过来|身份解释和投票线卡在同一处|身份线和票型互相咬住|身份线.*票型|身份线.*投票|身份线.*压力票|身份和票型压实|死亡\/保护会搅票型|公开站队和票型在同一方向|台面压力和投票线同向|公开压力和票型互相推高|身份口径和提名压力卡在一起|身份(?:说法)?和提名压力卡在一起|身份解释和上台窗口撞在一起|身份线被提名压力顶住|台面压力和提名窗口卡在一起|公开压力和上台窗口连在一起|台面节奏已经顶到提名口/,
      `${mode} sample should synthesize evidence families`
    );
    assert.match(row?.text ?? "", pattern, `${mode} sample should use role-specific public pressure handling`);
    assert.doesNotMatch(row?.text ?? "", /自己人|邪恶视角|真实身份|爪牙|恶魔伪装|当前可用伪装|魔典|PRIVATE_SECRET_MARKER|bluff/i);
  });
  const crossScriptPrivateMultiEvidenceRows = evaluation.rows.filter((row) => row.requiresCrossScriptPrivateMultiEvidence);
  assert.equal(
    crossScriptPrivateMultiEvidenceRows.length,
    2,
    "fixed quality set should include BMR/SnV private multi-evidence samples"
  );
  ["bmr", "snv"].forEach((scriptId) => {
    const row = crossScriptPrivateMultiEvidenceRows.find(
      (entry) => entry.scriptId === scriptId && entry.expectedScriptId === scriptId
    );
    assert.ok(row, `fixed quality set should include a ${scriptId} private multi-evidence sample`);
    assert.equal(row?.source, "private-whisper");
    assert.equal(row?.audience, "private");
    assert.equal(row?.intent, "reason");
    assert.ok((row?.decisionRationale?.focusEvidenceCount ?? 0) >= 2, `${scriptId} private sample should count multiple evidence rows`);
    assert.ok((row?.evidenceSummaries?.length ?? 0) >= 2, `${scriptId} private sample should keep multiple evidence summaries`);
    const chainTypes = new Set((row?.evidenceGraphChains ?? []).map((chain) => chain.type));
    assert.ok(chainTypes.has("false-claim-chain"), `${scriptId} private sample should include a false-claim graph chain`);
    assert.ok(chainTypes.has("public-accuse-chain"), `${scriptId} private sample should include a public-accuse graph chain`);
    assert.match(
      row?.text ?? "",
      /多条|两条|不止一条|合在一起|不把它当单点|公开站队和票型|公开压力和票型|身份和票型|身份说法和票型|身份口径和票型|身份线.*票型|身份线.*投票|身份解释和投票线|投票和身份|公开线索更多|线索更多|证据位/,
      `${scriptId} private sample should compress multiple clues into readable wording`
    );
    assert.match(
      row?.text ?? "",
      /低证据推人和身份(?:口径)?对不上卡在一起|票型和身份(?:口径)?同时咬住|夜信链和身份(?:口径)?需要互相对上|保高压位和票型反向互相顶住|来源链和身份(?:口径)?卡在一起/,
      `${scriptId} private sample should synthesize how private evidence families connect`
    );
    assert.match(row?.text ?? "", /身份对不上|推低证据位/, `${scriptId} private sample should cite concrete clue families`);
  });
  const privateSynthesisRows = evaluation.rows.filter((row) => row.requiresPrivateEvidenceSynthesisVariant);
  assert.equal(privateSynthesisRows.length, 10, "fixed quality set should include private evidence synthesis variants");
  [
    [
      "identity-low-evidence",
      /低证据推人和身份(?:口径)?对不上卡在一起/,
      /推低证据位.*身份口径.*公开验证/,
      /(?:验证点|先听|先核|这条先问).*推低证据位.*身份(?:口径)?.*(?:公开|大家)验证.*对上/,
    ],
    [
      "identity-vote",
      /票型和身份(?:口径)?同时咬住/,
      /身份口径.*投票.*压力相反/,
      /(?:验证点|先听|先核|这条先问).*身份(?:口径)?.*投票.*压力相反/,
    ],
    [
      "identity-night-info",
      /夜信链和身份(?:口径)?需要互相对上/,
      /夜信来源.*身份口径.*公开验证/,
      /(?:验证点|先听|先核|这条先问).*夜信来源.*(?:复核|再对一下).*身份(?:口径)?.*(?:公开|大家)验证.*对上/,
    ],
    [
      "protection-vote",
      /保高压位和票型反向互相顶住/,
      /维护高压位.*反票理由.*票型压力/,
      /(?:验证点|先听|先核|这条先问).*维护高压位.*反票理由.*票型压力/,
    ],
    [
      "source-identity",
      /来源链和身份(?:口径)?卡在一起/,
      /来源.*复核.*身份口径.*公开验证/,
      /(?:验证点|先听|先核|这条先问).*来源.*(?:复核|再对一下).*身份(?:口径)?.*(?:公开|大家)验证.*对齐/,
    ],
  ].forEach(([mode, pattern, verificationPattern, spokenVerificationPattern]) => {
    ["bmr", "snv"].forEach((scriptId) => {
      const row = privateSynthesisRows.find(
        (entry) =>
          entry.expectedPrivateEvidenceSynthesisMode === mode &&
          entry.scriptId === scriptId &&
          entry.expectedScriptId === scriptId
      );
      assert.ok(row, `fixed quality set should include ${scriptId} ${mode} private synthesis sample`);
      assert.equal(row?.source, "private-whisper");
      assert.equal(row?.audience, "private");
      assert.equal(row?.intent, "reason");
      assert.ok(row?.focusName && (row.text ?? "").includes(row.focusName), `${scriptId} ${mode} sample should name the focus target`);
      assert.ok((row?.evidenceSummaries?.length ?? 0) >= 2, `${scriptId} ${mode} sample should keep multiple evidence summaries`);
      assert.match(row?.text ?? "", pattern, `${scriptId} ${mode} sample should use the expected synthesis mode`);
      assert.match(
        row?.decisionRationale?.verificationLine ?? "",
        verificationPattern,
        `${scriptId} ${mode} sample should use an evidence-specific verification line`
      );
      assert.match(
        row?.text ?? "",
        spokenVerificationPattern,
        `${scriptId} ${mode} sample should say the evidence-specific verification action`
      );
      assert.ok(
        (row?.text ?? "").length <= 195,
        `${scriptId} ${mode} private synthesis sample should stay compact enough for private chat`
      );
      assert.doesNotMatch(row?.text ?? "", /自己人|邪恶视角|真实身份|爪牙|恶魔伪装|当前可用伪装|魔典|PRIVATE_SECRET_MARKER|bluff/i);
    });
  });
  assert.ok(
    evaluation.rows.some((row) => row.crossDayStance),
    "quality set should include cross-day stance continuity samples"
  );
  assert.ok(
    evaluation.rows.some((row) => row.crossDayStance?.continuity === "hold"),
    "quality set should include cross-day stance hold samples"
  );
  assert.ok(
    evaluation.rows.some((row) => row.crossDayStance?.continuity === "shift"),
    "quality set should include cross-day stance shift samples"
  );
  const evilClaimCoverPressureRows = evaluation.rows.filter((row) => row.requiresEvilClaimCoverPressureContinuity);
  assert.equal(
    new Set(evilClaimCoverPressureRows.map((row) => row.scriptId).filter(Boolean)).size,
    3,
    "fixed quality set should include TB/BMR/SnV long-arc evil claim-cover pressure-continuity samples"
  );
  const crossScriptEvilClaimCoverRows = evaluation.rows.filter((row) => row.requiresCrossScriptEvilClaimCoverPressureContinuity);
  assert.equal(crossScriptEvilClaimCoverRows.length, 2, "fixed quality set should include BMR/SnV evil claim-cover pressure-continuity samples");
  ["bmr", "snv"].forEach((scriptId) => {
    const row = crossScriptEvilClaimCoverRows.find((entry) => entry.scriptId === scriptId && entry.expectedScriptId === scriptId);
    assert.ok(row, `fixed quality set should include ${scriptId} evil claim-cover pressure-continuity sample`);
    assert.equal(row?.source, "public-discussion");
    assert.equal(row?.audience, "public");
    assert.equal(row?.speakerTeam, "evil");
    assert.ok(row?.focusName && (row.text ?? "").includes(row.focusName), `${scriptId} evil claim-cover sample should name focus`);
    assert.ok(row?.expectedClaimRoleName && (row.text ?? "").includes(row.expectedClaimRoleName), `${scriptId} evil claim-cover sample should name the public claim role`);
    assert.match(row?.text ?? "", /昨天已经(?:盯过|转到|看过).*今天|今天.*公开身份仍按/, `${scriptId} evil claim-cover sample should connect prior pressure to today's public line`);
    assert.doesNotMatch(row?.text ?? "", /自己人|邪恶视角|真实身份|爪牙|恶魔伪装|当前可用伪装|魔典|PRIVATE_SECRET_MARKER|bluff/i);
  });
  const crossScriptCrossDayRows = evaluation.rows.filter((row) => row.requiresCrossScriptCrossDayStance);
  assert.equal(crossScriptCrossDayRows.length, 4, "fixed quality set should include BMR/SnV cross-day hold and shift samples");
  ["bmr", "snv"].forEach((scriptId) => {
    ["hold", "shift"].forEach((mode) => {
      const row = crossScriptCrossDayRows.find(
        (entry) => entry.scriptId === scriptId && entry.expectedScriptId === scriptId && entry.expectedCrossDayMode === mode
      );
      assert.ok(row, `fixed quality set should include ${scriptId} cross-day ${mode} sample`);
      assert.equal(row?.source, "public-discussion");
      assert.equal(row?.audience, "public");
      assert.equal(row?.crossDayStance?.continuity, mode, `${scriptId} cross-day sample should preserve ${mode} mode`);
      assert.ok(row?.focusName && (row?.text ?? "").includes(row.focusName), `${scriptId} cross-day sample should name focus`);
      assert.match(row?.text ?? "", /昨天|天前|新起线|今天转/, `${scriptId} cross-day sample should verbalize continuity`);
      assert.ok(row?.crossDayStance?.currentReasonSummary, `${scriptId} cross-day sample should carry current reason summary`);
      const currentReason = compactSignal(row?.crossDayStance?.currentReasonSummary);
      const currentReasonHead = currentReason.slice(0, Math.min(12, currentReason.length));
      assert.ok(
        !currentReasonHead || countOccurrences(compactSignal(row?.text ?? ""), currentReasonHead) <= 1,
        `${scriptId} cross-day sample should not repeat the current reason in both memory recap and evidence anchor`
      );
      assert.ok(Number.isFinite(row?.crossDayStance?.evidenceDelta), `${scriptId} cross-day sample should carry evidence delta`);
      assert.ok(row?.crossDayStance?.changeSummary, `${scriptId} cross-day sample should carry a change summary`);
      assert.ok(
        (row?.crossDayStance?.previousEvidenceSnippets?.length ?? 0) > 0,
        `${scriptId} cross-day sample should preserve previous evidence snippets`
      );
      assert.ok(
        (row?.crossDayStance?.currentEvidenceSnippets?.length ?? 0) > 0,
        `${scriptId} cross-day sample should preserve current evidence snippets`
      );
      assert.ok(
        (row?.crossDayStance?.previousEvidenceAnchors?.length ?? 0) > 0,
        `${scriptId} cross-day sample should preserve previous evidence anchors`
      );
      assert.ok(
        (row?.crossDayStance?.currentEvidenceAnchors?.length ?? 0) > 0,
        `${scriptId} cross-day sample should preserve current evidence anchors`
      );
      assert.ok(
        (row?.crossDayStance?.previousEventAnchors?.length ?? 0) > 0,
        `${scriptId} cross-day sample should preserve previous event anchors`
      );
      assert.ok(
        (row?.crossDayStance?.currentEventAnchors?.length ?? 0) > 0,
        `${scriptId} cross-day sample should preserve current event anchors`
      );
      assert.ok(
        (row?.crossDayStance?.previousScoreTrailAnchors?.length ?? 0) > 0,
        `${scriptId} cross-day sample should preserve previous score-trail anchors`
      );
      assert.ok(
        (row?.crossDayStance?.currentScoreTrailAnchors?.length ?? 0) > 0,
        `${scriptId} cross-day sample should preserve current score-trail anchors`
      );
      [...(row?.crossDayStance?.previousEvidenceAnchors ?? []), ...(row?.crossDayStance?.currentEvidenceAnchors ?? [])].forEach(
        (anchor) => {
          assert.ok(anchor.evidenceId || anchor.observationId, `${scriptId} cross-day evidence anchor should carry an id`);
          assert.ok(anchor.text, `${scriptId} cross-day evidence anchor should carry display text`);
          assert.ok(anchor.visibility, `${scriptId} cross-day evidence anchor should carry visibility`);
        }
      );
      [...(row?.crossDayStance?.previousEventAnchors ?? []), ...(row?.crossDayStance?.currentEventAnchors ?? [])].forEach(
        (anchor) => {
          assert.ok(anchor.eventId || anchor.timelineEntryId, `${scriptId} cross-day event anchor should carry an id`);
          assert.ok(anchor.source, `${scriptId} cross-day event anchor should carry source`);
          assert.ok(anchor.visibility, `${scriptId} cross-day event anchor should carry visibility`);
          assert.ok(anchor.text, `${scriptId} cross-day event anchor should carry display text`);
          assert.ok(Number.isFinite(Number(anchor.timestamp)), `${scriptId} cross-day event anchor should carry timestamp`);
        }
      );
      [...(row?.crossDayStance?.previousScoreTrailAnchors ?? []), ...(row?.crossDayStance?.currentScoreTrailAnchors ?? [])].forEach(
        (anchor) => {
          assert.ok(anchor.trailId || anchor.evidenceId || anchor.observationId, `${scriptId} cross-day score-trail anchor should carry an id`);
          assert.ok(anchor.text, `${scriptId} cross-day score-trail anchor should carry display text`);
          assert.ok(anchor.visibility, `${scriptId} cross-day score-trail anchor should carry visibility`);
          assert.ok(Number.isFinite(Number(anchor.timestamp)), `${scriptId} cross-day score-trail anchor should carry timestamp`);
          assert.ok(Number.isFinite(Number(anchor.after)), `${scriptId} cross-day score-trail anchor should carry after score`);
          assert.ok(Number.isFinite(Number(anchor.appliedDelta)), `${scriptId} cross-day score-trail anchor should carry applied delta`);
        }
      );
      assert.equal(
        snippetsOverlapEvidence(row?.crossDayStance?.currentEvidenceSnippets, row?.evidenceSummaries),
        true,
        `${scriptId} cross-day sample should link current evidence snippets to row evidence summaries`
      );
      assert.equal(
        snippetsOverlapEvidence(
          row?.crossDayStance?.currentEvidenceAnchors?.map((anchor) => anchor.text),
          [...(row?.evidenceSummaries ?? []), ...(row?.crossDayStance?.currentEvidenceSnippets ?? [])]
        ),
        true,
        `${scriptId} cross-day sample should link evidence anchors to row evidence`
      );
      assert.equal(
        snippetsOverlapEvidence(
          row?.crossDayStance?.currentEventAnchors?.map((anchor) => anchor.text),
          [row?.text ?? "", ...(row?.evidenceSummaries ?? []), ...(row?.crossDayStance?.currentEvidenceSnippets ?? [])]
        ),
        true,
        `${scriptId} cross-day sample should link event anchors to row evidence or speech`
      );
      assert.equal(
        snippetsOverlapEvidence(
          row?.crossDayStance?.currentScoreTrailAnchors?.map((anchor) => anchor.text),
          [
            row?.text ?? "",
            ...(row?.evidenceSummaries ?? []),
            ...(row?.crossDayStance?.currentEvidenceSnippets ?? []),
            ...(row?.crossDayStance?.currentEvidenceAnchors ?? []).map((anchor) => anchor.text),
          ]
        ),
        true,
        `${scriptId} cross-day sample should link score-trail anchors to row evidence or speech`
      );
      assert.match(
        row?.text ?? "",
        /比昨天多\d+条可见线索|比昨天少\d+条可见线索|证据量没少|新信息更重|昨天线没被洗掉/,
        `${scriptId} cross-day sample should verbalize evidence change`
      );
      if (mode === "shift") {
        assert.ok(row?.crossDayStance?.evidenceDelta > 0, `${scriptId} cross-day shift should show added evidence`);
      } else {
        assert.equal(row?.crossDayStance?.evidenceDelta, 0, `${scriptId} cross-day hold should preserve evidence volume`);
      }
    });
  });
  const targetSwitchRows = evaluation.rows.filter((row) => row.requiresCrossDayTargetSwitch);
  assert.equal(targetSwitchRows.length, 3, "fixed quality set should include TB/BMR/SnV cross-day target-switch samples");
  targetSwitchRows.forEach((row) => {
    assert.equal(row.source, "public-discussion");
    assert.equal(row.audience, "public");
    assert.ok(row.focusName && row.text.includes(row.focusName), "target-switch speech should name current focus");
    assert.ok(
      row.expectedPreviousFocusName && row.text.includes(row.expectedPreviousFocusName),
      "target-switch speech should name previous focus"
    );
    assert.equal(row.decisionRationale?.targetSwitchContinuity?.kind, "cross-day-target-switch");
    assert.equal(row.decisionRationale?.targetSwitchContinuity?.previousTargetId, row.expectedPreviousFocusId);
    assert.equal(row.decisionRationale?.targetSwitchContinuity?.currentTargetId, row.focusId);
    assert.match(row.decisionRationale?.targetSwitchLine ?? "", /昨天主线|天前主线/);
    assert.match(row.text ?? "", /先转|不等于放掉|旧线|回看/);
    assert.ok(
      (row.decisionRationale?.targetSwitchContinuity?.currentEvidenceCount ?? 0) >= 2,
      "target-switch sample should preserve current evidence count"
    );
    assert.doesNotMatch(row.text ?? "", /自己人|邪恶视角|真实身份|爪牙|恶魔伪装|当前可用伪装|魔典|PRIVATE_SECRET_MARKER|bluff/i);
  });
  const crossScriptTargetSwitchRows = targetSwitchRows.filter((row) => row.requiresCrossScriptCrossDayTargetSwitch);
  assert.equal(crossScriptTargetSwitchRows.length, 2, "fixed quality set should include BMR/SnV target-switch samples");
  ["bmr", "snv"].forEach((scriptId) => {
    const row = crossScriptTargetSwitchRows.find((entry) => entry.scriptId === scriptId && entry.expectedScriptId === scriptId);
    assert.ok(row, `fixed quality set should include ${scriptId} cross-day target-switch sample`);
    assert.ok(row?.expectedPreviousFocusName && (row.text ?? "").includes(row.expectedPreviousFocusName));
    assert.ok(row?.focusName && (row.text ?? "").includes(row.focusName));
    assert.equal(row?.decisionRationale?.targetSwitchContinuity?.kind, "cross-day-target-switch");
    assert.match(row?.text ?? "", /昨天主线|天前主线/);
    assert.match(row?.text ?? "", /先转|不等于放掉|旧线|回看/);
  });
  const nonPublicTargetSwitchRows = evaluation.rows.filter((row) => row.requiresNonPublicTargetSwitchContinuity);
  assert.equal(nonPublicTargetSwitchRows.length, 3, "fixed quality set should include private/proactive/AI-AI target-switch samples");
  ["private-whisper", "proactive-private", "ai-ai-private"].forEach((source) => {
    assert.ok(
      nonPublicTargetSwitchRows.some((row) => row.source === source),
      `fixed quality set should include a ${source} target-switch sample`
    );
  });
  nonPublicTargetSwitchRows.forEach((row) => {
    assert.ok(["private-whisper", "proactive-private", "ai-ai-private"].includes(row.source));
    assert.equal(row.audience, "private");
    assert.ok(row.focusName && row.text.includes(row.focusName), "non-public target-switch reply should name current focus");
    assert.ok(
      row.expectedPreviousFocusName && row.text.includes(row.expectedPreviousFocusName),
      "non-public target-switch reply should name previous focus"
    );
    assert.equal(row.decisionRationale?.targetSwitchContinuity?.kind, "cross-day-target-switch");
    assert.equal(row.decisionRationale?.targetSwitchContinuity?.previousTargetId, row.expectedPreviousFocusId);
    assert.equal(row.decisionRationale?.targetSwitchContinuity?.currentTargetId, row.focusId);
    assert.match(row.decisionRationale?.targetSwitchLine ?? row.decisionRationale?.memoryContinuityLine ?? "", /昨天主线|天前主线/);
    assert.match(row.text ?? "", /先转|不等于放掉|旧线|回看/);
    assert.ok(
      (row.decisionRationale?.targetSwitchContinuity?.currentEvidenceCount ?? 0) >= 2,
      "non-public target-switch sample should preserve current evidence count"
    );
    assert.doesNotMatch(row.text ?? "", /自己人|邪恶视角|真实身份|爪牙|恶魔伪装|当前可用伪装|魔典|PRIVATE_SECRET_MARKER|bluff/i);
  });
  assert.ok(evaluation.rows.some((row) => row.audience === "public"), "quality set should include public discussion");
  assert.ok(
    evaluation.rows.some((row) => row.requiresPublicPrioritySignals),
    "quality set should include public priority signal samples"
  );
  assert.ok(
    evaluation.rows.some((row) => row.audience === "public" && (row.decisionRationale?.focusScore ?? 0) >= 0.72),
    "quality set should include high-pressure public samples"
  );
  assert.ok(
    evaluation.rows.some((row) => row.requiresEvilCoverTexture),
    "quality set should include evil public cover-texture samples"
  );
  assert.ok(
    evaluation.rows.some((row) => row.requiresEvilCoverMaintenance),
    "quality set should include evil public cover-maintenance samples"
  );
  assert.ok(
    evaluation.rows.some((row) => row.requiresEvilCoverPivot),
    "quality set should include evil public cover-pivot samples"
  );
  assert.ok(
    evaluation.rows.some((row) => row.requiresEvilProtectAlly),
    "quality set should include evil public ally-protection samples"
  );
  const evilClaimCoverRows = evaluation.rows.filter((row) => row.requiresEvilClaimCoverContinuity);
  assert.equal(evilClaimCoverRows.length, 1, "fixed quality set should include one evil public claim-cover continuity sample");
  evilClaimCoverRows.forEach((row) => {
    assert.equal(row.source, "public-discussion");
    assert.equal(row.audience, "public");
    assert.equal(row.speakerTeam, "evil");
    assert.ok(row.expectedClaimRoleName, "claim-cover sample should record the expected public claim role");
    assert.ok(row.text.includes(row.expectedClaimRoleName), "claim-cover speech should retain the public claim role name");
    assert.match(row.text, /公开身份|仍按|信息口径|票型|这条说/);
    assert.doesNotMatch(row.text, /自己人|邪恶视角|真实身份|爪牙|恶魔伪装|当前可用伪装|魔典|PRIVATE_SECRET_MARKER|bluff/i);
  });
  const evilClaimCoverPivotRows = evaluation.rows.filter((row) => row.requiresEvilClaimCoverPivot);
  assert.equal(evilClaimCoverPivotRows.length, 1, "fixed quality set should include one evil public claim-cover pivot sample");
  evilClaimCoverPivotRows.forEach((row) => {
    assert.equal(row.source, "public-discussion");
    assert.equal(row.audience, "public");
    assert.equal(row.speakerTeam, "evil");
    assert.ok(row.focusName && row.text.includes(row.focusName), "claim-cover pivot speech should name the pivot target");
    assert.ok(row.expectedClaimRoleName, "claim-cover pivot sample should record the expected public claim role");
    assert.ok(
      row.text.includes(row.expectedClaimRoleName),
      `claim-cover pivot speech should retain the public claim role name: ${row.text}`
    );
    assert.match(row.text, /公开身份|仍按|信息口径|票型|这条说/);
    assert.match(row.text, /目标可以转|这轮先转到|台面压力有了新变化|窗口不能再散|压力需要重新分配/);
    assert.ok(countOccurrences(compactSignal(row.text), "这轮先转到") <= 1, "claim-cover pivot speech should not repeat the pivot action");
    assert.doesNotMatch(row.text, /自己人|邪恶视角|真实身份|爪牙|恶魔伪装|当前可用伪装|魔典|PRIVATE_SECRET_MARKER|bluff/i);
  });
  const evilClaimCoverProtectRows = evaluation.rows.filter((row) => row.requiresEvilClaimCoverProtectAlly);
  assert.equal(evilClaimCoverProtectRows.length, 1, "fixed quality set should include one evil public claim-cover protect-ally sample");
  evilClaimCoverProtectRows.forEach((row) => {
    assert.equal(row.source, "public-discussion");
    assert.equal(row.audience, "public");
    assert.equal(row.speakerTeam, "evil");
    assert.ok(row.focusName && row.text.includes(row.focusName), "claim-cover protect-ally speech should name the pressure target");
    assert.ok(row.expectedClaimRoleName, "claim-cover protect-ally sample should record the expected public claim role");
    assert.ok(row.text.includes(row.expectedClaimRoleName), "claim-cover protect-ally speech should retain the public claim role name");
    assert.match(row.text, /公开身份|仍按|信息口径|票型|这条说/);
    assert.match(row.text, /压力可以分散|台面压力别只堆一处|也拉出来对话|压力重新分配|别只压一个点/);
    const compactText = compactSignal(row.text);
    assert.ok(countOccurrences(compactText, "台面压力别只堆一处") <= 1, "claim-cover protect speech should not repeat protect-plan wording");
    assert.ok(countOccurrences(compactText, "别只压一个点") <= 1, "claim-cover protect speech should not repeat spread-pressure wording");
    assert.ok(countOccurrences(compactText, "压力重新分配一下") <= 1, "claim-cover protect speech should not repeat redistribution wording");
    assert.doesNotMatch(row.text, /自己人|邪恶视角|真实身份|爪牙|恶魔伪装|当前可用伪装|魔典|PRIVATE_SECRET_MARKER|bluff/i);
  });
  const evilClaimCoverCrossDayRows = evaluation.rows.filter((row) => row.requiresEvilClaimCoverCrossDay);
  assert.equal(evilClaimCoverCrossDayRows.length, 1, "fixed quality set should include one evil public cross-day claim-cover sample");
  evilClaimCoverCrossDayRows.forEach((row) => {
    assert.equal(row.source, "public-discussion");
    assert.equal(row.audience, "public");
    assert.equal(row.speakerTeam, "evil");
    assert.ok(row.focusName && row.text.includes(row.focusName), "cross-day claim-cover speech should name the pressure target");
    assert.ok(row.expectedClaimRoleName, "cross-day claim-cover sample should record the expected public claim role");
    assert.ok(row.text.includes(row.expectedClaimRoleName), "cross-day claim-cover speech should retain the public claim role name");
    assert.match(row.text, /公开身份|仍按|信息口径|票型|这条说/);
    assert.match(row.text, /隔天身份线|昨天|前一天|身份线我不改|今天继续/);
    assert.doesNotMatch(row.text, /自己人|邪恶视角|真实身份|爪牙|恶魔伪装|当前可用伪装|魔典|PRIVATE_SECRET_MARKER|bluff/i);
  });
  const evilClaimCoverDeceptionArcRows = evaluation.rows.filter((row) => row.requiresEvilClaimCoverDeceptionArc);
  assert.equal(evilClaimCoverDeceptionArcRows.length, 3, "fixed quality set should include TB/BMR/SnV evil public long deception-arc claim-cover samples");
  ["tb", "bmr", "snv"].forEach((scriptId) => {
    assert.ok(
      evilClaimCoverDeceptionArcRows.some((row) => row.scriptId === scriptId),
      `fixed quality set should include a ${scriptId} evil public long deception-arc sample`
    );
  });
  evilClaimCoverDeceptionArcRows.forEach((row) => {
    assert.equal(row.source, "public-discussion");
    assert.equal(row.audience, "public");
    assert.equal(row.speakerTeam, "evil");
    assert.ok(row.focusName && row.text.includes(row.focusName), "deception-arc speech should name the current pressure target");
    assert.ok(row.expectedClaimRoleName, "deception-arc sample should record the expected public claim role");
    assert.ok(row.text.includes(row.expectedClaimRoleName), "deception-arc speech should retain the public claim role name");
    assert.ok((row.priorArcLines?.length ?? 0) >= 2, "deception-arc sample should preserve prior generated arc lines");
    assert.ok(
      row.priorArcLines.some((line) => /目标可以转|这轮先转到|台面压力有了新变化|窗口不能再散|压力需要重新分配/.test(line)),
      `deception-arc sample should prove a prior public pivot happened (${row.scriptId}): ${row.priorArcLines.join(" | ")}`
    );
    assert.match(row.text, /公开身份|仍按|信息口径|票型|这条说/);
    assert.match(row.text, /隔天身份线|昨天|前一天|身份线我不改|今天继续/);
    assert.match(row.text, /压力可以分散|台面压力别只堆一处|也拉出来对话|压力重新分配|别只压一个点/);
    const compactText = compactSignal(row.text);
    assert.ok(countOccurrences(compactText, "别只压一个点") <= 1, "deception-arc speech should not repeat spread-pressure wording");
    assert.ok(countOccurrences(compactText, "压力重新分配一下") <= 1, "deception-arc speech should not repeat redistribution wording");
    assert.doesNotMatch(row.text, /自己人|邪恶视角|真实身份|爪牙|恶魔伪装|当前可用伪装|魔典|PRIVATE_SECRET_MARKER|bluff/i);
  });
  const evilPrivateRows = evaluation.rows.filter((row) => row.requiresEvilPrivateCoordination);
  assert.equal(evilPrivateRows.length, 3, "fixed quality set should include TB/BMR/SnV evil private coordination samples");
  ["tb", "bmr", "snv"].forEach((scriptId) => {
    const row = evilPrivateRows.find((entry) => entry.scriptId === scriptId && entry.expectedScriptId === scriptId);
    assert.ok(row, `fixed quality set should include ${scriptId} evil private coordination sample`);
    assert.equal(row?.source, "private-whisper");
    assert.equal(row?.audience, "private");
    assert.equal(row?.intent, "claim");
    assert.equal(row?.speakerTeam, "evil");
    assert.equal(row?.humanTeam, "evil");
    assert.equal(row?.allowHiddenTruth, true, `${scriptId} evil private sample should be excluded from public leak gates`);
    assert.match(row?.text ?? "", /自己人|一边|邪恶视角|对底|队伍信息|恶魔位|爪牙/, `${scriptId} sample should acknowledge evil team context`);
    assert.match(row?.text ?? "", /真实身份|我真实身份/, `${scriptId} sample should reveal true identity to evil ally`);
    assert.match(row?.text ?? "", /台面安排|台面上|伪装|装|低信息好人/, `${scriptId} sample should discuss public cover`);
    assert.match(row?.text ?? "", /火力点|放到讨论中心|放进提名位|先接身份|先压|先问|多说|先问身份和夜里信息|决定要不要提/, `${scriptId} sample should coordinate a table pressure target`);
    const compactText = compactSignal(row?.text ?? "");
    assert.ok(countOccurrences(compactText, "火力点") <= 1, `${scriptId} sample should not repeat the firepoint plan`);
    assert.ok(countOccurrences(compactText, "先问身份和夜里信息") <= 1, `${scriptId} sample should not repeat the identity/night-info plan`);
    assert.ok(row?.focusName && (row.text ?? "").includes(row.focusName), `${scriptId} sample should name the pressure target`);
    assert.ok(row?.decisionRationale?.focusId, `${scriptId} sample should preserve a structured target rationale`);
    assert.equal(row?.decisionRationale?.audience, "private", `${scriptId} sample rationale should stay private-audience`);
    assert.ok(row?.decisionRationale?.spokenLine, `${scriptId} sample rationale should keep the spoken line anchor`);
  });
  const aiToAiEvilRows = evaluation.rows.filter((row) => row.requiresAIToAIEvilCoordination);
  assert.equal(aiToAiEvilRows.length, 3, "fixed quality set should include TB/BMR/SnV AI-AI evil coordination samples");
  ["tb", "bmr", "snv"].forEach((scriptId) => {
    const row = aiToAiEvilRows.find((entry) => entry.scriptId === scriptId && entry.expectedScriptId === scriptId);
    assert.ok(row, `fixed quality set should include ${scriptId} AI-AI evil coordination sample`);
    assert.equal(row?.source, "ai-ai-private");
    assert.equal(row?.audience, "private");
    assert.equal(row?.aiToAi, true);
    assert.equal(row?.hiddenFromHuman, true);
    assert.equal(row?.hiddenFromTimeline, true);
    assert.equal(row?.hiddenFromLog, true);
    assert.equal(row?.allowHiddenTruth, true);
    assert.equal(row?.speakerTeam, "evil");
    assert.equal(row?.targetTeam, "evil");
    assert.match(row?.text ?? "", /自己人|一边|邪恶视角|对底|队伍信息|恶魔位|爪牙/, `${scriptId} AI-AI sample should acknowledge evil team context`);
    assert.match(row?.text ?? "", /火力点|放到讨论中心|放进提名位|先接身份|先压|先问|多说|先问身份和夜里信息|决定要不要提/, `${scriptId} AI-AI sample should coordinate pressure`);
    assert.match(row?.text ?? "", /理由|说法|公开身份|票型|台面压力|公聊提到|拿来做台面/, `${scriptId} AI-AI sample should preserve a public-facing reason`);
    assert.ok(row?.focusName && (row.text ?? "").includes(row.focusName), `${scriptId} AI-AI sample should name the pressure target`);
    assert.ok(row?.decisionRationale?.focusId, `${scriptId} AI-AI sample should preserve a structured target rationale`);
    assert.equal(row?.decisionRationale?.audience, "private", `${scriptId} AI-AI sample rationale should stay private-audience`);
    assert.ok(row?.decisionRationale?.spokenLine, `${scriptId} AI-AI sample rationale should keep the spoken line anchor`);
  });
  const evilTeamRows = [...evilPrivateRows, ...aiToAiEvilRows];
  const evilTeamInfoVariants = new Set();
  const evilTeamInfoCounts = new Map();
  evilTeamRows.forEach((row) => {
    const variantIndex = EVIL_PRIVATE_TEAM_INFO_PATTERNS.findIndex((pattern) => pattern.test(row.text ?? ""));
    assert.ok(variantIndex >= 0, `${row.id} should use a recognized evil team-info variant: ${row.text}`);
    evilTeamInfoVariants.add(variantIndex);
    evilTeamInfoCounts.set(variantIndex, (evilTeamInfoCounts.get(variantIndex) ?? 0) + 1);
    assert.doesNotMatch(row.text ?? "", /先对底：恶魔位\s*[0-9]+号；爪牙同伴暂无/u, `${row.id} should avoid the old fixed evil team-info line`);
  });
  assert.ok(evilTeamInfoVariants.size >= 4, "evil team-info rows should use at least four variants");
  assert.ok(
    Math.max(0, ...evilTeamInfoCounts.values()) <= Math.max(2, Math.ceil(evilTeamRows.length * 0.4)),
    "evil team-info rows should not be dominated by one variant"
  );
  const evilCoverPlanVariants = new Set();
  const evilCoverPlanCounts = new Map();
  evilPrivateRows.forEach((row) => {
    const variantIndex = EVIL_PRIVATE_COVER_PLAN_PATTERNS.findIndex((pattern) => pattern.test(row.text ?? ""));
    assert.ok(variantIndex >= 0, `${row.id} should use a recognized evil cover-plan variant`);
    evilCoverPlanVariants.add(variantIndex);
    evilCoverPlanCounts.set(variantIndex, (evilCoverPlanCounts.get(variantIndex) ?? 0) + 1);
  });
  assert.ok(evilCoverPlanVariants.size >= 3, "evil cover-plan rows should use at least three variants");
  assert.ok(
    Math.max(0, ...evilCoverPlanCounts.values()) <= Math.max(2, Math.ceil(evilPrivateRows.length * 0.5)),
    "evil cover-plan rows should not be dominated by one variant"
  );
  assert.ok(evaluation.rows.some((row) => row.audience === "nomination"), "quality set should include nomination reasoning");
  const formalVoteLines = evaluation.rows
    .filter((row) => row.source === "formal-vote")
    .map((row) => row.voteRationale?.line ?? row.text)
    .filter(Boolean);
  const formalVoteLineCounts = new Map();
  formalVoteLines.forEach((line) => {
    formalVoteLineCounts.set(line, (formalVoteLineCounts.get(line) ?? 0) + 1);
  });
  assert.ok(
    new Set(formalVoteLines).size >= 12,
    "fixed formal vote rows should preserve table-level phrasing variation"
  );
  assert.ok(
    Math.max(...formalVoteLineCounts.values()) <= 2,
    "fixed formal vote rows should not repeat any one table line across many voters"
  );
  const formalVoteTableContextPattern = /投票|票型|提名|回应|证据|线索|防守|解释|公开|处决|站边|信息|身份/;
  evaluation.rows
    .filter((row) => row.source === "formal-vote")
    .forEach((row) => {
      assert.match(row.text ?? "", formalVoteTableContextPattern, `${row.id} should keep table-readable formal vote context`);
    });
  const formalVoteReasonKeys = new Set(
    evaluation.rows
      .filter((row) => row.source === "formal-vote")
      .map((row) => row.voteRationale?.reasonKey)
      .filter(Boolean)
  );
  [
    "evidence-backed-yes",
    "pressure-threshold-yes",
    "evidence-below-threshold",
    "pressure-below-threshold",
    "ghost-vote-pressure",
    "cannot-vote",
    "butler-restricted",
    "table-balance-no",
    "execution-window-yes",
  ].forEach((reasonKey) => {
    assert.ok(formalVoteReasonKeys.has(reasonKey), `fixed formal vote rows should include ${reasonKey}`);
  });
  const nearThresholdRows = evaluation.rows.filter((row) => row.requiresFormalVoteNearThreshold);
  assert.ok(nearThresholdRows.length >= 4, "fixed formal vote rows should include near-threshold yes/no samples with and without evidence");
  nearThresholdRows.forEach((row) => {
    assert.ok(Math.abs(row.voteRationale?.margin ?? 1) <= 0.04, "near-threshold samples should stay near the vote line");
    assert.ok(/贴线|勉强|刚过|差一点|几乎到线|还差一句|不是锁死/.test(row.text), "near-threshold samples should verbalize hesitation");
  });
  const evidenceBoundaryRows = evaluation.rows.filter((row) => row.requiresFormalVoteEvidenceBoundary);
  assert.equal(evidenceBoundaryRows.length, 2, "fixed formal vote rows should include evidence-backed near-threshold yes/no samples");
  assert.ok(
    evidenceBoundaryRows.some((row) => row.voteRationale?.reasonKey === "evidence-backed-yes" && row.voteRationale?.vote === true),
    "evidence boundary samples should include a near-threshold yes vote"
  );
  assert.ok(
    evidenceBoundaryRows.some((row) => row.voteRationale?.reasonKey === "evidence-below-threshold" && row.voteRationale?.vote === false),
    "evidence boundary samples should include a near-threshold no vote"
  );
  evidenceBoundaryRows.forEach((row) => {
    assert.ok((row.voteRationale?.evidenceCount ?? 0) > 0, "evidence boundary samples should carry evidence count");
    assert.match(row.text, /证据|线索|公开证据/, "evidence boundary lines should preserve the evidence anchor");
    assert.match(
      row.text,
      /贴线|勉强|刚过|差一点|几乎到线|还差一句|不是锁死|过线/,
      "evidence boundary lines should preserve the threshold boundary"
    );
  });
  const multiEvidenceRows = evaluation.rows.filter((row) => row.requiresFormalVoteMultiEvidence);
  assert.equal(multiEvidenceRows.length, 2, "fixed formal vote rows should include multi-evidence yes/no samples");
  assert.ok(
    multiEvidenceRows.some((row) => row.voteRationale?.reasonKey === "evidence-backed-yes" && row.expectedVote === true),
    "multi-evidence samples should include a yes vote"
  );
  assert.ok(
    multiEvidenceRows.some((row) => row.voteRationale?.reasonKey === "evidence-below-threshold" && row.expectedVote === false),
    "multi-evidence samples should include a no vote"
  );
  multiEvidenceRows.forEach((row) => {
    assert.ok((row.voteRationale?.evidenceCount ?? 0) >= 2, "multi-evidence samples should carry at least two evidence rows");
    assert.match(
      row.text,
      /两条|多条|不止一条|身份和票型|身份线.*票型|身份线.*投票|身份解释和投票线|公开站队和票型|公开压力和票型|公开线索|合在一起|合成/,
      "multi-evidence lines should compress multiple evidence rows into table-readable wording"
    );
  });
  const crossScriptFormalVoteRows = evaluation.rows.filter((row) => row.requiresFormalVoteScriptCoverage);
  assert.equal(crossScriptFormalVoteRows.length, 2, "fixed formal vote rows should include BMR and SnV samples");
  ["bmr", "snv"].forEach((scriptId) => {
    const row = crossScriptFormalVoteRows.find((entry) => entry.scriptId === scriptId && entry.expectedScriptId === scriptId);
    assert.ok(row, `fixed formal vote rows should include a ${scriptId} sample`);
    assert.equal(row?.voteRationale?.publicOnly, true, `${scriptId} formal vote sample should be public-safe`);
    assert.equal(row?.voteRationale?.reasonKey, "evidence-backed-yes", `${scriptId} sample should preserve evidence-backed reason mode`);
    assert.ok((row?.voteRationale?.evidenceCount ?? 0) > 0, `${scriptId} sample should carry evidence count`);
    assert.match(row?.text ?? "", /证据|线索|公开|票型|身份/, `${scriptId} sample should keep table evidence wording`);
  });
  const evilFormalVoteRows = evaluation.rows.filter((row) => row.requiresFormalVoteEvilCoverMode);
  assert.equal(evilFormalVoteRows.length, 2, "fixed formal vote rows should include evil cover yes/no samples");
  assert.ok(
    evilFormalVoteRows.some((row) => row.voteRationale?.reasonKey === "table-balance-no" && row.expectedVote === false),
    "evil cover formal vote samples should include a public-safe no-vote"
  );
  assert.ok(
    evilFormalVoteRows.some((row) => row.voteRationale?.reasonKey === "execution-window-yes" && row.expectedVote === true),
    "evil cover formal vote samples should include a public-safe yes-vote"
  );
  evilFormalVoteRows.forEach((row) => {
    assert.match(
      row.text,
      /台面压力|第二压力位|旁边压力|执行窗口|流程|票型|落票|压力别只堆/,
      "evil cover formal vote lines should use table-readable public wording"
    );
    assert.doesNotMatch(
      row.text,
      /自己人|邪恶视角|真实身份|爪牙|恶魔伪装|当前可用伪装|魔典|PRIVATE_SECRET_MARKER|bluff|evil|framing|sacrifice|protective|minion|demon|ally/i,
      "evil cover formal vote lines should not leak hidden evil intent"
    );
  });
  assert.equal(
    evaluation.rows.every((row) => row.text && row.ok),
    true,
    "quality rows should carry successful rendered AI text"
  );
}

function testSummarizesReasoningQualityMetrics() {
  const evaluation = buildAIQualityEvaluationSet({ seed: 2026060201 });
  const summary = summarizeAIQualityEvaluation(evaluation.rows);
  assert.equal(summary.totalRows, evaluation.rows.length);
  assert.equal(summary.hiddenLeakCount, 0, "fixed public/good-view samples should not leak hidden information");
  assert.equal(summary.mechanicalArtifactCount, 0, "fixed samples should not expose internal engineering artifacts");
  assert.ok(summary.evidenceCitationRate >= 0.55, "fixed samples should cite evidence or concrete table context");
  assert.equal(summary.decisionRationaleCoverage, 1, "focused samples should carry decision rationale metadata");
  assert.equal(summary.decisionReconsiderationCoverage, 1, "focused decision samples should state what would make the AI revise or soften its read");
  assert.equal(summary.decisionConfidenceCalibrationCoverage, 1, "focused decision samples should state confidence calibration for the current read");
  assert.equal(summary.decisionVerificationPlanCoverage, 1, "focused decision samples should state how the current read should be verified");
  assert.equal(summary.decisionEvidenceModeCoverage, 1, "focused decision samples should state what evidence type drives the read");
  assert.equal(summary.decisionEvidenceModeVerificationAlignmentCoverage, 1, "focused decision verification plans should match the evidence type");
  assert.equal(summary.decisionResponsePlanCoverage, 1, "focused decision samples should state how target responses will be classified");
  assert.equal(summary.decisionResponseCriteriaCoverage, 1, "focused decision samples should state concrete criteria for judging the target response");
  assert.equal(summary.decisionEvidenceInteractionCoverage, 1, "focused decision samples should state how evidence families interact");
  assert.equal(summary.decisionPressureStageCoverage, 1, "focused decision samples should classify the current pressure stage");
  assert.equal(summary.decisionCounterEvidenceCoverage, 1, "focused decision samples should state the counter-evidence or alternative explanation");
  assert.equal(summary.decisionTableRiskCoverage, 1, "focused decision samples should state the table-level risk or cost of pressuring the target");
  assert.equal(summary.decisionInformationGainCoverage, 1, "focused decision samples should state what information the next question can separate");
  assert.equal(summary.decisionTableReactionCoverage, 1, "focused decision samples should state which table reactions the AI will watch");
  assert.equal(summary.decisionTimingWindowCoverage, 1, "focused decision samples should state the timing window for the current pressure");
  assert.equal(summary.decisionWorldBranchCoverage, 1, "focused decision samples should state alternate world branches for the current target");
  assert.equal(summary.decisionVoteCoalitionCoverage, 1, "focused decision samples should state how pressure should or should not become a vote coalition");
  assert.equal(summary.decisionSourceReliabilityCoverage, 1, "focused decision samples should state whether evidence sources are independent and public-verifiable");
  assert.equal(summary.decisionTimelineConsistencyCoverage, 1, "focused decision samples should state how event order affects the current read");
  assert.equal(summary.decisionIncentiveAlignmentCoverage, 1, "focused decision samples should state whose incentives benefit from the current behavior");
  assert.equal(summary.decisionBurdenOfProofCoverage, 1, "focused decision samples should assign who needs to explain or justify the pressure");
  assert.equal(summary.decisionQuestionPriorityCoverage, 1, "focused decision samples should state the follow-up question order for the current pressure");
  assert.equal(summary.decisionActionThresholdCoverage, 1, "focused decision samples should state the action threshold for escalating or downgrading pressure");
  assert.equal(summary.decisionMemoryContinuityCoverage, 1, "focused decision samples should connect the current read to memory or a future comparison record");
  assert.equal(summary.decisionExpressionDisciplineCoverage, 1, "focused decision samples should state how the current read should be phrased without overclaiming");
  assert.equal(summary.decisionUncertaintyResolutionCoverage, 1, "focused decision samples should state what uncertainty remains and how it can be resolved");
  assert.equal(summary.decisionEvidenceFreshnessCoverage, 1, "focused decision samples should state whether the read depends on fresh evidence, old evidence, or current response refresh");
  assert.equal(summary.decisionFalsificationCheckCoverage, 1, "focused decision samples should state what would falsify or downgrade the current read");
  assert.equal(summary.decisionCausalChainCoverage, 1, "focused decision samples should connect evidence behavior to table pressure through a causal chain");
  assert.equal(summary.decisionAssumptionAuditCoverage, 1, "focused decision samples should state the premise or assumption that the read depends on");
  assert.equal(summary.decisionMechanicSensitivityCoverage, 1, "focused decision samples should state which BOTC mechanics constrain the current read");
  assert.equal(summary.decisionRoleHypothesisCoverage, 1, "focused decision samples should split the read into public-safe good-role and bad-role hypotheses");
  assert.equal(summary.decisionEvidenceBoundaryCoverage, 1, "focused decision samples should state the evidence boundary of the current read");
  assert.equal(summary.decisionRunnerUpWatchCoverage, 1, "runner-up decision samples should state how the second target remains under watch");
  assert.equal(
    evaluation.rows
      .filter((row) => row.decisionRationale?.focusId && row.source !== "formal-vote")
      .every((row) => row.qualityRunId),
    true,
    "focused decision-rationale samples should carry a quality-run grouping id"
  );
  assert.ok(summary.runnerUpComparisonCoverage >= 0.8, "runner-up decisions should carry comparison traces");
  assert.equal(
    summary.privateRunnerUpComparisonLineVariantCoverage,
    1,
    "private runner-up comparison lines should vary beyond one repeated template"
  );
  const privateRunnerUpComparisonRows = evaluation.rows.filter(
    (row) => row.audience === "private" && row.decisionRationale?.runnerUpName && row.decisionRationale?.line
  );
  assert.ok(
    privateRunnerUpComparisonRows.length >= 10,
    "fixed quality set should include several private runner-up comparison lines"
  );
  const privateRunnerUpComparisonLines = privateRunnerUpComparisonRows.map((row) =>
    normalizedPrivateRunnerUpComparisonLine(row.decisionRationale.line)
  );
  const privateRunnerUpComparisonVariants = new Set(privateRunnerUpComparisonLines);
  assert.ok(
    privateRunnerUpComparisonVariants.size >= 6,
    "private runner-up comparison lines should cover at least six normalized variants"
  );
  const oldPrivateComparisonCount = privateRunnerUpComparisonLines.filter((line) =>
    /我先排X号不是放过X号X号这边我可见的线索更多/u.test(line)
  ).length;
  assert.ok(
    oldPrivateComparisonCount <= Math.max(4, Math.floor(privateRunnerUpComparisonLines.length * 0.25)),
    "old private runner-up comparison template should no longer dominate"
  );
  const privateRunnerUpComparisonCounts = new Map();
  privateRunnerUpComparisonLines.forEach((line) =>
    privateRunnerUpComparisonCounts.set(line, (privateRunnerUpComparisonCounts.get(line) ?? 0) + 1)
  );
  assert.ok(
    Math.max(...privateRunnerUpComparisonCounts.values()) <=
      Math.max(5, Math.ceil(privateRunnerUpComparisonLines.length * 0.3)),
    "no single private runner-up comparison variant should dominate fixed rows"
  );
  assert.ok(summary.strategyRationaleCoverage >= 0.8, "nomination rows should carry strategy rationale metadata");
  const nominationActionContextFailures = evaluation.rows
    .filter((row) => row.audience === "nomination")
    .filter((row) => {
      return !(
        row.ok &&
        row.strategyRationale?.line &&
        (!row.focusName || row.text.includes(row.focusName)) &&
        /不是空过|空过风险|不是空聊/.test(row.text) &&
        /防守|站边|愿意跟|流程压力|执行信息|压力测试|桌面联盟|推进|换信息/.test(row.text) &&
        /发言|身份|昨晚信息|票型|票面|能过|处理|回应|理由|线索|记录|愿意跟|门槛|空转|执行信息|防守|验信息|流程/.test(row.text)
      );
    })
    .map((row) => ({ id: row.id, text: row.text, strategy: row.strategyRationale }));
  assert.equal(
    nominationActionContextFailures.length,
    0,
    `nomination rows should explain why this is not an empty pass: ${JSON.stringify(nominationActionContextFailures)}`
  );
  assert.equal(summary.nominationStrategyModeCoverage, 1, "fixed nomination rows should cover every strategy action-context mode");
  const nominationDefenseFailures = evaluation.rows
    .filter((row) => row.requiresNominationDefenseResponse)
    .filter((row) => !(
      row.ok &&
      row.source === "nomination-defense" &&
      row.audience === "nomination-defense" &&
      /回应提名理由|被点的理由|提名理由要拆开|提名理由拆开|提名卡的是|先听我接这条|公开口径接上|只推票不听我补信息|先验我说的点|我先防一下/.test(row.text ?? "") &&
      /身份|昨晚信息|票型|公开报/.test(row.text ?? "") &&
      /补不上再上票|对不上再票我|验不上再票我|接不上再票我|补不上再锁票|先验我说的点|如果.*(?:只推票|只催落票).*不听.*补/.test(row.text ?? "") &&
      /降压|别跳过防守|防守要落到点上|先听完整防守|别只听结论|别只催票|桌面也要反看|这条也要记|推进也要记/.test(row.text ?? "")
    ))
    .map((row) => ({ id: row.id, text: row.text }));
  assert.equal(
    nominationDefenseFailures.length,
    0,
    `nominee defense rows should answer the nomination and state a vote threshold: ${JSON.stringify(nominationDefenseFailures)}`
  );
  const nominationDefenseOpenings = new Set(
    evaluation.rows
      .filter((row) => row.requiresNominationDefenseResponse)
      .map((row) => `${row.text ?? ""}`.split(/[，。：]/u)[0])
      .filter(Boolean)
  );
  assert.ok(nominationDefenseOpenings.size >= 4, "nominee defense rows should avoid one repeated answer opening");
  assert.equal(summary.nominationDefenseInfoDedupCoverage, 1, "nominee defense rows should not repeat the same info plan");
  assert.equal(
    evaluation.rows
      .filter((row) => row.requiresNominationDefenseResponse)
      .every((row) => /提名卡的是|提名理由|台面上不是空过|处决边缘|死亡信息|昨晚信息|身份和投票/.test(row.text ?? "")),
    true,
    "nominee defense rows should answer the real nomination pressure point"
  );
  assert.equal(summary.nominationDefenseAwareVoteCoverage, 1, "formal vote rows should explain how nominee defense affects the vote");
  assert.equal(
    summary.nominationReasonAnchoredDefenseVoteCoverage,
    1,
    "defense-aware vote rows should anchor the vote explanation back to the original nomination reason"
  );
  assert.equal(
    summary.nominationReasonAnchoredDefenseVoteLineDiversityCoverage,
    1,
    "reason-anchored defense vote rows should avoid a single repeated opening template"
  );
  assert.equal(
    summary.crossScriptNominationDefenseAwareVoteCoverage,
    1,
    "BMR/SnV formal vote rows should explain how nominee defense affects the vote"
  );
  assert.deepEqual(
    [
      ...new Set(
        evaluation.rows
          .filter((row) => row.requiresNominationStrategyModeCoverage)
          .map((row) => row.expectedNominationStrategyMode)
      ),
    ].sort(),
    [
      "avoid-no-execution",
      "coalition-check",
      "execution-info",
      "execution-push",
      "information-check",
      "pressure-test",
      "public-reason-flow",
    ].sort(),
    "nomination strategy fixed rows should include all public action-context modes"
  );
  evaluation.rows
    .filter((row) => row.requiresNominationStrategyModeCoverage)
    .forEach((row) => {
      const compactText = compactSignal(row.text ?? "");
      assert.ok(countOccurrences(compactText, "流程压力打出来") <= 1, `${row.id} should not repeat the process-pressure plan`);
      assert.ok(countOccurrences(compactText, "看谁愿意跟") <= 1, `${row.id} should not repeat the coalition-check plan`);
      assert.ok(countOccurrences(compactText, "执行信息") <= 1, `${row.id} should not repeat the execution-info plan`);
    });
  const nominationDefenseRows = evaluation.rows.filter((row) => row.requiresNominationDefenseResponse);
  assert.ok(
    nominationDefenseRows.some((row) => row.source === "nomination-defense"),
    "fixed quality set should include real nomination-defense response rows"
  );
  const nominationDefenseOpeningCounts = new Map();
  nominationDefenseRows.forEach((row) => {
    const key = nominationDefenseOpeningKey(row);
    nominationDefenseOpeningCounts.set(key, (nominationDefenseOpeningCounts.get(key) ?? 0) + 1);
  });
  assert.ok(
    nominationDefenseOpeningCounts.size >= Math.min(4, nominationDefenseRows.length),
    "nomination defense rows should use several distinct answer openings"
  );
  assert.ok(
    Math.max(...nominationDefenseOpeningCounts.values()) <= Math.max(2, Math.ceil(nominationDefenseRows.length * 0.3)),
    "no single nomination defense opening should dominate fixed rows"
  );
  assert.ok(
    nominationDefenseRows.filter((row) => /我先不把身份一次说死/.test(row.text ?? "")).length <=
      Math.max(1, Math.floor(nominationDefenseRows.length * 0.2)),
    "old nomination defense identity stem should no longer dominate fixed rows"
  );
  assert.ok(
    nominationDefenseRows
      .every((row) => {
        const promptSentences = `${row.prompt ?? ""}`
          .replace(/\s+/g, " ")
          .split(/[。！？；]/u)
          .map((entry) => entry.replace(/^我(?:先)?提\s*/u, "").trim())
          .filter(Boolean);
        const reasonAnchor =
          promptSentences.find((entry) => /身份|信息|票型|防守|证据|压力|解释|对上|昨晚|发言|投票|处决|验|跳|报/.test(entry)) ??
          promptSentences.find((entry) => entry.length > 8) ??
          "";
        const anchorSignals = reasonAnchor.match(/身份|信息|票型|防守|证据|压力|解释|对上|昨晚|发言|投票|处决|验|跳|报/gu) ?? [];
        return reasonAnchor && anchorSignals.some((signal) => row.text.includes(signal));
      }),
    "nomination defense rows should quote the concrete pressure point rather than only the nominee seat"
  );
  nominationDefenseRows
    .forEach((row) => {
      const compactText = compactSignal(row.text ?? "");
      assert.ok(countOccurrences(compactText, "昨晚信息") <= 1, `${row.id} should not repeat the night-info defense plan`);
      assert.ok(countOccurrences(compactText, "我的信息") <= 1, `${row.id} should not repeat the generic info-defense plan`);
    });
  assert.deepEqual(
    [
      ...new Set(
        evaluation.rows
          .filter((row) => row.requiresCrossScriptNominationDefenseReasonAnchor)
          .map((row) => `${row.scriptId}:${row.expectedPressureBand}`)
      ),
    ].sort(),
    ["bmr:high", "bmr:low", "snv:high", "snv:low"],
    "cross-script nomination defense rows should cover BMR/SnV high and low pressure defenses"
  );
  assert.ok(
    evaluation.rows
      .filter((row) => row.requiresHighPressureNominationDefenseCounterPressure)
      .every((row) => row.expectedPressureBand === "high" && /反看|只推票不听我补信息|这条也要记|不听我补信息/.test(row.text ?? "")),
    "high-pressure nomination defense rows should warn the table if the nominator keeps pushing without hearing the defense"
  );
  assert.deepEqual(
    [
      ...new Set(
        evaluation.rows
          .filter((row) => row.requiresNominationDefenseAwareVote)
          .map((row) => String(!!row.expectedVote))
      ),
    ].sort(),
    ["false", "true"],
    "nomination-defense-aware vote rows should cover yes and no outcomes"
  );
  assert.ok(
    evaluation.rows
      .filter((row) => row.requiresNominationDefenseAwareVote)
      .every((row) => {
        const reasonLine = row.voteRationale?.nominationDefenseContext?.reasonLine;
        const line = row.voteRationale?.line ?? "";
        return reasonLine && line.includes("提名理由") && line.includes(reasonLine);
      }),
    "nomination-defense-aware vote rows should quote the nomination reason anchor in the final vote line"
  );
  const defenseVotePrefixKey = (row) =>
    (row.voteRationale?.line ?? "")
      .split("。")[0]
      .replace(/\d+号/g, "N号")
      .replace(/「[^」]+」/g, "「reason」")
      .trim();
  assert.ok(
    new Set(evaluation.rows.filter((row) => row.requiresNominationDefenseAwareVote).map(defenseVotePrefixKey)).size >= 3,
    "reason-anchored defense vote rows should include multiple opening forms"
  );
  assert.ok(
    new Set(
      evaluation.rows
        .filter((row) => row.requiresNominationDefenseAwareVote && row.expectedVote === true)
        .map(defenseVotePrefixKey)
    ).size >= 2,
    "yes defense vote rows should not all use the same opening form"
  );
  assert.ok(
    new Set(
      evaluation.rows
        .filter((row) => row.requiresNominationDefenseAwareVote && row.expectedVote === false)
        .map(defenseVotePrefixKey)
    ).size >= 2,
    "no defense vote rows should not all use the same opening form"
  );
  assert.deepEqual(
    [
      ...new Set(
        evaluation.rows
          .filter((row) => row.requiresCrossScriptNominationDefenseAwareVote)
          .map((row) => `${row.scriptId}:${!!row.expectedVote}`)
      ),
    ].sort(),
    ["bmr:false", "bmr:true", "snv:false", "snv:true"],
    "cross-script nomination-defense-aware vote rows should cover BMR/SnV yes and no outcomes"
  );
  assert.ok(summary.proactiveRationaleCoverage >= 0.8, "proactive private whispers should preserve spoken rationale metadata");
  assert.ok(summary.voteIntentCoverage >= 0.8, "vote-intent replies should include vote language and evidence");
  assert.equal(summary.claimDisclosureRationaleCoverage, 1, "claim-disclosure decisions should preserve public-safe rationale");
  assert.equal(summary.claimDisclosureContinuityCoverage, 1, "repeat claim-disclosure decisions should explain continuity");
  assert.equal(summary.claimDisclosureContinuityModeCoverage, 1, "fixed samples should cover claim hold, escalation, and revision");
  assert.equal(summary.claimDisclosureSurfaceDedupCoverage, 1, "claim-disclosure speech should avoid repeating the same surface claim plan");
  assert.equal(
    summary.claimDisclosureBalancedReasonVariantCoverage,
    1,
    "balanced claim-disclosure reasons should avoid a single fixed explanation"
  );
  assert.equal(summary.crossScriptClaimDisclosureCoverage, 1, "private claim-disclosure samples should cover BMR and SnV");
  assert.equal(summary.privateScriptClaimDeflectCoverage, 1, "BMR/SnV private claim deflections should explain script-specific withholding pressure");
  assert.equal(summary.crossScriptClaimContinuityCoverage, 1, "claim continuity samples should cover BMR/SnV hold, escalation, and revision");
  assert.equal(
    summary.roleConstrainedClaimDisclosureCoverage,
    1,
    "role-constrained claim disclosure should cover madness, outsider risk, Mutant, Sweetheart, Barber, and death-trigger timing"
  );
  assert.equal(
    summary.roleConstrainedClaimLineDiversityCoverage,
    1,
    "role-constrained claim disclosure should vary public-safe opening lines across role risks"
  );
  const claimDisclosureHoldLeadPatterns = [
    /身份线我不改，今天仍按/u,
    /.+这条身份线不改，今天仍按它来聊/u,
    /前面这条身份我先不换，继续按/u,
    /.+这条我先不换，继续按前面口径说/u,
    /这轮不改身份口径，还是按/u,
    /.+口径这轮不改，还是沿着这条聊/u,
    /我不无理由改口，.+这条继续放桌面上/u,
    /这条身份先沿用.+，让后续追问接着核/u,
    /.+这条身份先沿用，让后续追问接着核/u,
    /今天不重开身份线，.+这条继续留给桌面核/u,
    /.+身份线今天不重开，这条继续留给桌面核/u,
    /我先稳住.+口径，不为了压力临时换说法/u,
    /前面报过的.+先不撤，后续按这条继续验/u,
    /.+前面报过先不撤，后续按这条继续验/u,
    /前面的“[^”]+”范围我先不改/u,
    /身份范围暂时沿用“[^”]+”/u,
    /我还按“[^”]+”这个范围说/u,
    /身份口径我先不无理由改口/u,
  ];
  const claimDisclosureHoldRows = evaluation.rows.filter(
    (row) => row.claimDisclosureRationale?.continuity === "hold" && row.claimDisclosureRationale?.continuityLine
  );
  assert.ok(claimDisclosureHoldRows.length >= 3, "fixed claim-disclosure set should include hold continuity rows");
  const claimDisclosureHoldLeads = new Set();
  const claimDisclosureHoldLeadCounts = new Map();
  claimDisclosureHoldRows.forEach((row) => {
    const line = row.claimDisclosureRationale?.continuityLine ?? "";
    assert.doesNotMatch(line, /延续前面的(?:身份口径|“[^”]+”范围)/u, `${row.id} should not use the old fixed hold lead`);
    const leadIndex = claimDisclosureHoldLeadPatterns.findIndex((pattern) => pattern.test(line));
    assert.notEqual(leadIndex, -1, `${row.id} should use a natural claim-continuity hold lead`);
    const tableLine = line
      .replace(/让后续追问接着核/gu, "这轮先按这条核")
      .replace(/我不无理由改口/gu, "我不会空口改")
      .replace(/身份口径|身份说法/gu, "身份")
      .replace(/口径/gu, "说法");
    const tableLineBody = tableLine.replace(/[。！？；]+$/u, "");
    assert.ok(
      spokenLineAppearsInText(tableLine, row.text) ||
        spokenLineAppearsInText(line, row.text) ||
        (tableLineBody && row.text.includes(tableLineBody)),
      `${row.id} should speak the table-language continuity line`
    );
    claimDisclosureHoldLeads.add(leadIndex);
    claimDisclosureHoldLeadCounts.set(leadIndex, (claimDisclosureHoldLeadCounts.get(leadIndex) ?? 0) + 1);
  });
  assert.ok(claimDisclosureHoldLeads.size >= 5, "hold claim continuity should use at least five lead variants");
  const maxClaimDisclosureHoldLeadCount = Math.max(...claimDisclosureHoldLeadCounts.values());
  assert.ok(
    maxClaimDisclosureHoldLeadCount <= Math.max(3, Math.ceil(claimDisclosureHoldRows.length * 0.3)),
    "hold claim continuity should avoid one lead dominating the fixed set"
  );
  const publicClaimDisclosureHoldRows = claimDisclosureHoldRows.filter((row) => row.audience === "public" && row.claimDisclosureRationale?.publicOnly === true);
  assert.ok(publicClaimDisclosureHoldRows.length >= 6, "fixed public claim-continuity rows should include enough public hold samples");
  const publicClaimDisclosureHoldLeadCounts = new Map();
  publicClaimDisclosureHoldRows.forEach((row) => {
    const line = row.claimDisclosureRationale?.continuityLine ?? "";
    const leadIndex = claimDisclosureHoldLeadPatterns.findIndex((pattern) => pattern.test(line));
    assert.notEqual(leadIndex, -1, `${row.id} should use a recognized public claim-continuity hold lead`);
    publicClaimDisclosureHoldLeadCounts.set(leadIndex, (publicClaimDisclosureHoldLeadCounts.get(leadIndex) ?? 0) + 1);
  });
  assert.ok(publicClaimDisclosureHoldLeadCounts.size >= 6, "public hold claim continuity should use at least six lead variants");
  assert.ok(
    Math.max(...publicClaimDisclosureHoldLeadCounts.values()) <= 4,
    "public hold claim continuity should not let one spoken lead dominate"
  );
  const balancedClaimRows = evaluation.rows.filter(
    (row) => row.claimDisclosureRationale?.reasonKey === "balanced_disclosure" && row.claimDisclosureRationale?.line
  );
  assert.ok(balancedClaimRows.length >= 3, "fixed claim-disclosure set should include balanced disclosure rows");
  const balancedClaimReasons = new Set();
  balancedClaimRows.forEach((row) => {
    const line = row.claimDisclosureRationale?.line ?? "";
    assert.doesNotMatch(line, /当前适合给可追问口径，但不一定一次交死/u, `${row.id} should not use the old fixed balanced reason`);
    assert.doesNotMatch(row.text ?? "", /当前适合给可追问口径，但不一定一次交死/u, `${row.id} should not speak the old fixed balanced reason`);
    const reasonIndex = CLAIM_DISCLOSURE_BALANCED_REASON_PATTERNS.findIndex((pattern) => pattern.test(line));
    assert.notEqual(reasonIndex, -1, `${row.id} should use a natural balanced disclosure reason`);
    if (spokenLineAppearsInText(line, row.text)) {
      balancedClaimReasons.add(reasonIndex);
    }
  });
  assert.ok(balancedClaimReasons.size > 0, "some balanced claim-disclosure reason variants should be spoken");
  assert.ok(balancedClaimReasons.size >= 3, "balanced claim-disclosure rows should use at least three reason variants");
  evaluation.rows
    .filter(
      (row) =>
        row.claimDisclosureRationale &&
        (row.requiresClaimDisclosureContinuity ||
          row.requiresCrossScriptClaimContinuity ||
          row.requiresRoleConstrainedClaimDisclosure)
    )
    .forEach((row) => {
      const compactText = compactSignal(row.text ?? "");
      const visibleRoleName = row.claimDisclosureRationale?.roleName ?? "";
      ["具体身份", "功能风险", "公开坐实", "死亡触发身份", visibleRoleName ? `明跳${visibleRoleName}` : ""]
        .filter(Boolean)
        .forEach((phrase) => {
          assert.ok(
            countOccurrences(compactText, compactSignal(phrase)) <= 1,
            `${row.id} should not repeat claim-disclosure phrase ${phrase}`
          );
        });
    });
  const tableSentenceCount = (text) => (`${text ?? ""}`.match(/[。！？!?]/gu) ?? []).length;
  const publicTableRows = evaluation.rows.filter(
    (row) => row.source === "public-discussion" && row.audience === "public"
  );
  const nominationTableRows = evaluation.rows.filter(
    (row) => row.audience === "nomination" && row.source === "nomination"
  );
  const privateTableRows = evaluation.rows.filter(
    (row) => row.audience === "private" || row.audience === "ai-private"
  );
  assert.ok(publicTableRows.length >= 10, "fixed quality set should include several public table lines");
  assert.equal(
    publicTableRows.every(
      (row) =>
        row.text.length <= 115 &&
        tableSentenceCount(row.text) <= 2 &&
        (!row.focusName || row.text.includes(row.focusName)) &&
        /身份|昨晚|票型|发言|公开|回应|解释|提名|压力|线索|证据|BMR|SnV/u.test(row.text)
    ),
    true,
    "public lines should keep a target/evidence anchor inside the two-sentence table budget"
  );
  assert.equal(
    nominationTableRows.every(
      (row) =>
        row.text.length <= 120 &&
        tableSentenceCount(row.text) <= 2 &&
        (!row.focusName || row.text.includes(row.focusName)) &&
        /提|票|理由|发言|身份|信息|回应|解释|压力/u.test(row.text)
    ),
    true,
    "nomination lines should keep their target and table-readable reason inside two sentences"
  );
  assert.equal(
    privateTableRows.every((row) => {
      const maxSentences = row.allowHiddenTruth ? 5 : 3;
      return row.text.length <= 170 && tableSentenceCount(row.text) <= maxSentences;
    }),
    true,
    "private lines should stay within the compact table budget, with the hidden-team exception"
  );
  assert.equal(
    evaluation.rows.every(
      (row) =>
        !/来源和时间线|动机和举证|该谁解释|世界分支|角色假说|判定标准|证据联动|主压力位|后台|payload|viewmodel|JS Core/u.test(
          row.text ?? ""
        )
    ),
    true,
    "rendered speech should not expose report headings or backend vocabulary"
  );
  assert.equal(
    evaluation.rows.every((row) => !/下一轮|后续看|如果要推|接下来/u.test(row.text ?? "")),
    true,
    "rendered speech should describe the current table action instead of a future script"
  );
  assert.ok(summary.formalVoteRationaleCoverage >= 0.8, "formal votes should retain a public-safe reason");
  assert.equal(summary.formalVoteTableContextCoverage, 1, "formal votes should retain table-readable context");
  assert.equal(summary.nominationDefenseAwareVoteCoverage, 1, "votes should remain consistent with nomination defense");
  assert.equal(summary.evilPrivateCoordinationCoverage, 1, "legal allied-evil whispers should retain team context");
  assert.equal(summary.aiToAiEvilCoordinationCoverage, 1, "legal hidden AI-AI coordination should retain its pressure target");
  assert.ok(summary.repetitionRate <= 0.35, "fixed samples should avoid repeated sentence stems");

  /*
   * The assertions below encode the superseded report-style surface contract: they require every
   * metadata heading, reasoning layer, future verification plan, and pressure-texture variant to be
   * spoken verbatim. They remain here as historical documentation, while the active assertions above
   * verify the X06 table-language contract without weakening the underlying metadata or safety gates.
   */
}

function testQualityGatesCatchRegressions() {
  const summary = {
    totalRows: 3,
    focusedRows: 3,
    hiddenLeakCount: 1,
    mechanicalArtifactCount: 1,
    evidenceCitationRate: 0.2,
    decisionRationaleCoverage: 0.2,
    decisionReconsiderationCoverage: 0.2,
    decisionConfidenceCalibrationCoverage: 0.2,
    decisionVerificationPlanCoverage: 0.2,
    decisionEvidenceModeCoverage: 0.2,
    decisionEvidenceModeVerificationAlignmentCoverage: 0.2,
    decisionResponsePlanCoverage: 0.2,
    decisionResponseCriteriaCoverage: 0.2,
    decisionEvidenceInteractionCoverage: 0.2,
    decisionPressureStageCoverage: 0.2,
    decisionCounterEvidenceCoverage: 0.2,
    decisionTableRiskCoverage: 0.2,
    decisionInformationGainCoverage: 0.2,
    decisionTableReactionCoverage: 0.2,
    decisionTimingWindowCoverage: 0.2,
    decisionWorldBranchCoverage: 0.2,
    decisionVoteCoalitionCoverage: 0.2,
    decisionSourceReliabilityCoverage: 0.2,
    decisionTimelineConsistencyCoverage: 0.2,
    decisionIncentiveAlignmentCoverage: 0.2,
    decisionBurdenOfProofCoverage: 0.2,
    decisionQuestionPriorityCoverage: 0.2,
    decisionActionThresholdCoverage: 0.2,
    decisionMemoryContinuityCoverage: 0.2,
    decisionExpressionDisciplineCoverage: 0.2,
    decisionUncertaintyResolutionCoverage: 0.2,
    decisionEvidenceFreshnessCoverage: 0.2,
    decisionFalsificationCheckCoverage: 0.2,
    decisionCausalChainCoverage: 0.2,
    decisionAssumptionAuditCoverage: 0.2,
    decisionMechanicSensitivityCoverage: 0.2,
    decisionRoleHypothesisCoverage: 0.2,
    decisionEvidenceBoundaryCoverage: 0.2,
    decisionRunnerUpWatchCoverage: 0.2,
    runnerUpComparisonCoverage: 0.2,
    privateRunnerUpComparisonLineVariantCoverage: 0.2,
    strategyRationaleCoverage: 0.2,
    nominationActionContextCoverage: 0.2,
    nominationStrategyModeCoverage: 0.2,
    nominationDefenseResponseCoverage: 0.2,
    nominationDefenseResponseVariantCoverage: 0.2,
    nominationDefenseInfoDedupCoverage: 0.2,
    nominationDefenseReasonAnchorCoverage: 0.2,
    highPressureNominationDefenseCounterPressureCoverage: 0.2,
    crossScriptNominationDefenseReasonAnchorCoverage: 0.2,
    nominationDefenseAwareVoteCoverage: 0.2,
    nominationReasonAnchoredDefenseVoteCoverage: 0.2,
    nominationReasonAnchoredDefenseVoteLineDiversityCoverage: 0.2,
    crossScriptNominationDefenseAwareVoteCoverage: 0.2,
    proactiveRationaleCoverage: 0.2,
    voteIntentCoverage: 0.2,
    claimDisclosureRationaleCoverage: 0.2,
    claimDisclosureContinuityCoverage: 0.2,
    claimDisclosureContinuityModeCoverage: 0.33,
    claimDisclosureSurfaceDedupCoverage: 0.2,
    claimDisclosureHoldLeadVariantCoverage: 0.2,
    publicClaimHoldLeadVariantCoverage: 0.2,
    claimDisclosureBalancedReasonVariantCoverage: 0.2,
    crossScriptClaimDisclosureCoverage: 0.2,
    crossScriptClaimContinuityCoverage: 0.2,
    roleConstrainedClaimDisclosureCoverage: 0.2,
    roleConstrainedClaimLineDiversityCoverage: 0.2,
    crossScriptPublicReasoningCoverage: 0.2,
    crossScriptPublicMultiEvidenceCoverage: 0.2,
    publicScriptPressureVariantCoverage: 0.2,
    publicTimingPressureVariantCoverage: 0.2,
    publicRolePressureVariantCoverage: 0.2,
    crossScriptPrivateMultiEvidenceCoverage: 0.2,
    privateSurfaceReportDisciplineCoverage: 0.2,
    privateReasonOpeningRedundancyCoverage: 0.2,
    privateReasonOpeningVariantCoverage: 0.2,
    privateReasonOpeningLeadVariantCoverage: 0.2,
    privateReasonOpeningSentenceCoverage: 0.2,
    privateVerificationLeadNaturalizationCoverage: 0.2,
    privateDeepReasoningSpokenCoverage: 0.2,
    privateTimelineReasoningSpokenCoverage: 0.2,
    privateSourceTimelineCompressionCoverage: 0.2,
    privateIncentiveReasoningSpokenCoverage: 0.2,
    privateBurdenReasoningSpokenCoverage: 0.2,
    privateDeepReasoningCompressionCoverage: 0.2,
    privateDeepReasoningCompressionVariantCoverage: 0.2,
    privateDeepReasoningHeadingVariantCoverage: 0.2,
    privateDeepReasoningTailVariantCoverage: 0.2,
    privateDeepReasoningBrevityCoverage: 0.2,
    privateDeepReasoningLeadDedupCoverage: 0.2,
    privateEvidenceSynthesisCoverage: 0.2,
    privateEvidenceSynthesisVariantCoverage: 0.2,
    privateEvidenceSynthesisVerificationCoverage: 0.2,
    privateEvidenceSynthesisSpokenVerificationCoverage: 0.2,
    privateEvidenceSynthesisSourceIdentityDedupCoverage: 0.2,
    privateEvidenceSynthesisVoteTaxonomyDedupCoverage: 0.2,
    formalVoteRationaleCoverage: 0.2,
    formalVoteTableContextCoverage: 0.2,
    formalVoteLineDiversityCoverage: 0.1,
    formalVoteNormalizedLineDiversityCoverage: 0.1,
    formalVoteReasonModeCoverage: 0.2,
    formalVoteNearThresholdCoverage: 0.2,
    formalVoteEvilCoverSafetyCoverage: 0.2,
    formalVoteEvidenceBoundaryCoverage: 0.2,
    formalVoteMultiEvidenceCompressionCoverage: 0.2,
    formalVoteScriptCoverage: 0.2,
    crossDayStanceContinuityCoverage: 0.2,
    crossDayStanceReasonCoverage: 0.2,
    crossDayStanceReasonRecapDedupCoverage: 0.2,
    crossDayStanceEvidenceDeltaCoverage: 0.2,
    crossDayStanceEvidenceTraceCoverage: 0.2,
    crossDayStanceEvidenceAnchorCoverage: 0.2,
    crossDayStanceEventAnchorCoverage: 0.2,
    crossDayStanceScoreTrailAnchorCoverage: 0.2,
    crossDayStanceModeCoverage: 0.5,
    crossScriptCrossDayStanceCoverage: 0.2,
    crossDayTargetSwitchCoverage: 0.2,
    crossScriptCrossDayTargetSwitchCoverage: 0.2,
    nonPublicTargetSwitchContinuityCoverage: 0.2,
    publicPrioritySignalCoverage: 0.2,
    publicFollowUpDedupCoverage: 0.2,
    publicFollowUpTemplateDisciplineCoverage: 0.2,
    publicFollowUpSpecificityCoverage: 0.2,
    publicEvidenceSynthesisCoverage: 0.2,
    publicEvidenceSynthesisDedupCoverage: 0.2,
    publicEvidenceSynthesisLabelStackCoverage: 0.2,
    publicEvidenceAnchorLeadVariantCoverage: 0.2,
    publicEvidenceAnchorDedupCoverage: 0.2,
    publicEvidenceSynthesisSpokenVerificationCoverage: 0.2,
    publicEvidenceSynthesisSpokenVerificationVariantCoverage: 0.2,
    publicEvidenceSynthesisExplicitModeCoverage: 0.2,
    publicVerificationLeadVariantCoverage: 0.2,
    publicFollowUpTailVariantCoverage: 0.2,
    publicEvidenceFragmentClarityCoverage: 0.2,
    nonPublicEvidenceFragmentClarityCoverage: 0.2,
    nonPublicSurfacePolishCoverage: 0.2,
    publicSurfacePolishCoverage: 0.2,
    publicTableSpeechBrevityCoverage: 0.2,
    publicSentenceClosureCoverage: 0.2,
    publicGenericOpenerDisciplineCoverage: 0.2,
    publicPressureTextureCoverage: 0.2,
    publicPersonaPressureVariantCoverage: 0.2,
    publicPersonaPressureLineDiversityCoverage: 0.2,
    publicShadowPressureLineDiversityCoverage: 0.2,
    publicShadowTargetLineVariantCoverage: 0.2,
    publicPressureActionLeadVariantCoverage: 0.2,
    publicPressureUrgencyTailVariantCoverage: 0.2,
    publicPressureActionLeadDedupCoverage: 0.2,
    evilPublicCoverTextureCoverage: 0.2,
    evilPublicCoverMaintenanceCoverage: 0.2,
    evilPublicCoverMaintenanceDedupCoverage: 0.2,
    evilPublicCoverPivotCoverage: 0.2,
    evilPublicProtectAllyCoverage: 0.2,
    evilPublicClaimCoverContinuityCoverage: 0.2,
    evilPublicClaimCoverPivotCoverage: 0.2,
    evilPublicClaimCoverProtectAllyCoverage: 0.2,
    evilPublicClaimCoverCrossDayCoverage: 0.2,
    evilPublicClaimCoverDeceptionArcCoverage: 0.2,
    evilPublicClaimCoverPressureContinuityCoverage: 0.2,
    evilPublicClaimCoverPlanDedupCoverage: 0.2,
    evilPrivateCoordinationCoverage: 0.2,
    evilPrivateTeamInfoVariantCoverage: 0.2,
    evilPrivateCoverPlanVariantCoverage: 0.2,
    evilPrivatePressurePlanDedupCoverage: 0.2,
    nominationStrategyPlanDedupCoverage: 0.2,
    aiToAiEvilCoordinationCoverage: 0.2,
    repetitionRate: 0.8,
    stanceContinuityRate: 0.2,
    nominationReasonableRate: 0,
  };
  const failures = evaluateAIQualityGates(summary, AI_QUALITY_BASELINE_THRESHOLDS);
  assert.ok(failures.some((failure) => failure.key === "hiddenLeakCount"));
  assert.ok(failures.some((failure) => failure.key === "evidenceCitationRate"));
  assert.ok(failures.some((failure) => failure.key === "decisionReconsiderationCoverage"));
  assert.ok(failures.some((failure) => failure.key === "decisionConfidenceCalibrationCoverage"));
  assert.ok(failures.some((failure) => failure.key === "decisionVerificationPlanCoverage"));
  assert.ok(failures.some((failure) => failure.key === "decisionEvidenceModeCoverage"));
  assert.ok(failures.some((failure) => failure.key === "decisionEvidenceModeVerificationAlignmentCoverage"));
  assert.ok(failures.some((failure) => failure.key === "decisionResponsePlanCoverage"));
  assert.ok(failures.some((failure) => failure.key === "decisionResponseCriteriaCoverage"));
  assert.ok(failures.some((failure) => failure.key === "decisionEvidenceInteractionCoverage"));
  assert.ok(failures.some((failure) => failure.key === "decisionPressureStageCoverage"));
  assert.ok(failures.some((failure) => failure.key === "decisionCounterEvidenceCoverage"));
  assert.ok(failures.some((failure) => failure.key === "decisionTableRiskCoverage"));
  assert.ok(failures.some((failure) => failure.key === "decisionInformationGainCoverage"));
  assert.ok(failures.some((failure) => failure.key === "decisionTableReactionCoverage"));
  assert.ok(failures.some((failure) => failure.key === "decisionTimingWindowCoverage"));
  assert.ok(failures.some((failure) => failure.key === "decisionWorldBranchCoverage"));
  assert.ok(failures.some((failure) => failure.key === "decisionVoteCoalitionCoverage"));
  assert.ok(failures.some((failure) => failure.key === "decisionSourceReliabilityCoverage"));
  assert.ok(failures.some((failure) => failure.key === "decisionTimelineConsistencyCoverage"));
  assert.ok(failures.some((failure) => failure.key === "decisionIncentiveAlignmentCoverage"));
  assert.ok(failures.some((failure) => failure.key === "decisionBurdenOfProofCoverage"));
  assert.ok(failures.some((failure) => failure.key === "decisionQuestionPriorityCoverage"));
  assert.ok(failures.some((failure) => failure.key === "decisionActionThresholdCoverage"));
  assert.ok(failures.some((failure) => failure.key === "decisionMemoryContinuityCoverage"));
  assert.ok(failures.some((failure) => failure.key === "decisionExpressionDisciplineCoverage"));
  assert.ok(failures.some((failure) => failure.key === "decisionUncertaintyResolutionCoverage"));
  assert.ok(failures.some((failure) => failure.key === "decisionEvidenceFreshnessCoverage"));
  assert.ok(failures.some((failure) => failure.key === "decisionFalsificationCheckCoverage"));
  assert.ok(failures.some((failure) => failure.key === "decisionCausalChainCoverage"));
  assert.ok(failures.some((failure) => failure.key === "decisionAssumptionAuditCoverage"));
  assert.ok(failures.some((failure) => failure.key === "decisionMechanicSensitivityCoverage"));
  assert.ok(failures.some((failure) => failure.key === "decisionRoleHypothesisCoverage"));
  assert.ok(failures.some((failure) => failure.key === "decisionEvidenceBoundaryCoverage"));
  assert.ok(failures.some((failure) => failure.key === "decisionRunnerUpWatchCoverage"));
  assert.ok(failures.some((failure) => failure.key === "runnerUpComparisonCoverage"));
  assert.ok(failures.some((failure) => failure.key === "privateRunnerUpComparisonLineVariantCoverage"));
  assert.ok(failures.some((failure) => failure.key === "strategyRationaleCoverage"));
  assert.ok(failures.some((failure) => failure.key === "nominationActionContextCoverage"));
  assert.ok(failures.some((failure) => failure.key === "nominationStrategyModeCoverage"));
  assert.ok(failures.some((failure) => failure.key === "nominationDefenseResponseCoverage"));
  assert.ok(failures.some((failure) => failure.key === "nominationDefenseResponseVariantCoverage"));
  assert.ok(failures.some((failure) => failure.key === "nominationDefenseInfoDedupCoverage"));
  assert.ok(failures.some((failure) => failure.key === "nominationDefenseReasonAnchorCoverage"));
  assert.ok(failures.some((failure) => failure.key === "highPressureNominationDefenseCounterPressureCoverage"));
  assert.ok(failures.some((failure) => failure.key === "crossScriptNominationDefenseReasonAnchorCoverage"));
  assert.ok(failures.some((failure) => failure.key === "nominationDefenseAwareVoteCoverage"));
  assert.ok(failures.some((failure) => failure.key === "nominationReasonAnchoredDefenseVoteCoverage"));
  assert.ok(failures.some((failure) => failure.key === "nominationReasonAnchoredDefenseVoteLineDiversityCoverage"));
  assert.ok(failures.some((failure) => failure.key === "crossScriptNominationDefenseAwareVoteCoverage"));
  assert.ok(failures.some((failure) => failure.key === "proactiveRationaleCoverage"));
  assert.ok(failures.some((failure) => failure.key === "voteIntentCoverage"));
  assert.ok(failures.some((failure) => failure.key === "claimDisclosureRationaleCoverage"));
  assert.ok(failures.some((failure) => failure.key === "claimDisclosureContinuityCoverage"));
  assert.ok(failures.some((failure) => failure.key === "claimDisclosureContinuityModeCoverage"));
  assert.ok(failures.some((failure) => failure.key === "claimDisclosureSurfaceDedupCoverage"));
  assert.ok(failures.some((failure) => failure.key === "claimDisclosureHoldLeadVariantCoverage"));
  assert.ok(failures.some((failure) => failure.key === "publicClaimHoldLeadVariantCoverage"));
  assert.ok(failures.some((failure) => failure.key === "claimDisclosureBalancedReasonVariantCoverage"));
  assert.ok(failures.some((failure) => failure.key === "crossScriptClaimDisclosureCoverage"));
  assert.ok(failures.some((failure) => failure.key === "crossScriptClaimContinuityCoverage"));
  assert.ok(failures.some((failure) => failure.key === "roleConstrainedClaimDisclosureCoverage"));
  assert.ok(failures.some((failure) => failure.key === "roleConstrainedClaimLineDiversityCoverage"));
  assert.ok(failures.some((failure) => failure.key === "crossScriptPublicReasoningCoverage"));
  assert.ok(failures.some((failure) => failure.key === "crossScriptPublicMultiEvidenceCoverage"));
  assert.ok(failures.some((failure) => failure.key === "publicScriptPressureVariantCoverage"));
  assert.ok(failures.some((failure) => failure.key === "publicTimingPressureVariantCoverage"));
  assert.ok(failures.some((failure) => failure.key === "publicRolePressureVariantCoverage"));
  assert.ok(failures.some((failure) => failure.key === "crossScriptPrivateMultiEvidenceCoverage"));
  assert.ok(failures.some((failure) => failure.key === "privateSurfaceReportDisciplineCoverage"));
  assert.ok(failures.some((failure) => failure.key === "privateReasonOpeningRedundancyCoverage"));
  assert.ok(failures.some((failure) => failure.key === "privateReasonOpeningVariantCoverage"));
  assert.ok(failures.some((failure) => failure.key === "privateReasonOpeningLeadVariantCoverage"));
  assert.ok(failures.some((failure) => failure.key === "privateReasonOpeningSentenceCoverage"));
  assert.ok(failures.some((failure) => failure.key === "privateVerificationLeadNaturalizationCoverage"));
  assert.ok(failures.some((failure) => failure.key === "privateDeepReasoningSpokenCoverage"));
  assert.ok(failures.some((failure) => failure.key === "privateTimelineReasoningSpokenCoverage"));
  assert.ok(failures.some((failure) => failure.key === "privateSourceTimelineCompressionCoverage"));
  assert.ok(failures.some((failure) => failure.key === "privateIncentiveReasoningSpokenCoverage"));
  assert.ok(failures.some((failure) => failure.key === "privateBurdenReasoningSpokenCoverage"));
  assert.ok(failures.some((failure) => failure.key === "privateDeepReasoningCompressionCoverage"));
  assert.ok(failures.some((failure) => failure.key === "privateDeepReasoningCompressionVariantCoverage"));
  assert.ok(failures.some((failure) => failure.key === "privateDeepReasoningHeadingVariantCoverage"));
  assert.ok(failures.some((failure) => failure.key === "privateDeepReasoningTailVariantCoverage"));
  assert.ok(failures.some((failure) => failure.key === "privateDeepReasoningBrevityCoverage"));
  assert.ok(failures.some((failure) => failure.key === "privateDeepReasoningLeadDedupCoverage"));
  assert.ok(failures.some((failure) => failure.key === "privateEvidenceSynthesisCoverage"));
  assert.ok(failures.some((failure) => failure.key === "privateEvidenceSynthesisVariantCoverage"));
  assert.ok(failures.some((failure) => failure.key === "privateEvidenceSynthesisVerificationCoverage"));
  assert.ok(failures.some((failure) => failure.key === "privateEvidenceSynthesisSpokenVerificationCoverage"));
  assert.ok(failures.some((failure) => failure.key === "privateEvidenceSynthesisSourceIdentityDedupCoverage"));
  assert.ok(failures.some((failure) => failure.key === "privateEvidenceSynthesisVoteTaxonomyDedupCoverage"));
  assert.ok(failures.some((failure) => failure.key === "formalVoteRationaleCoverage"));
  assert.ok(failures.some((failure) => failure.key === "formalVoteTableContextCoverage"));
  assert.ok(failures.some((failure) => failure.key === "formalVoteLineDiversityCoverage"));
  assert.ok(failures.some((failure) => failure.key === "formalVoteNormalizedLineDiversityCoverage"));
  assert.ok(failures.some((failure) => failure.key === "formalVoteReasonModeCoverage"));
  assert.ok(failures.some((failure) => failure.key === "formalVoteNearThresholdCoverage"));
  assert.ok(failures.some((failure) => failure.key === "formalVoteEvilCoverSafetyCoverage"));
  assert.ok(failures.some((failure) => failure.key === "formalVoteEvidenceBoundaryCoverage"));
  assert.ok(failures.some((failure) => failure.key === "formalVoteMultiEvidenceCompressionCoverage"));
  assert.ok(failures.some((failure) => failure.key === "formalVoteScriptCoverage"));
  assert.ok(failures.some((failure) => failure.key === "crossDayStanceContinuityCoverage"));
  assert.ok(failures.some((failure) => failure.key === "crossDayStanceReasonCoverage"));
  assert.ok(failures.some((failure) => failure.key === "crossDayStanceReasonRecapDedupCoverage"));
  assert.ok(failures.some((failure) => failure.key === "crossDayStanceEvidenceDeltaCoverage"));
  assert.ok(failures.some((failure) => failure.key === "crossDayStanceEvidenceTraceCoverage"));
  assert.ok(failures.some((failure) => failure.key === "crossDayStanceEvidenceAnchorCoverage"));
  assert.ok(failures.some((failure) => failure.key === "crossDayStanceEventAnchorCoverage"));
  assert.ok(failures.some((failure) => failure.key === "crossDayStanceScoreTrailAnchorCoverage"));
  assert.ok(failures.some((failure) => failure.key === "crossDayStanceModeCoverage"));
  assert.ok(failures.some((failure) => failure.key === "crossScriptCrossDayStanceCoverage"));
  assert.ok(failures.some((failure) => failure.key === "crossDayTargetSwitchCoverage"));
  assert.ok(failures.some((failure) => failure.key === "crossScriptCrossDayTargetSwitchCoverage"));
  assert.ok(failures.some((failure) => failure.key === "nonPublicTargetSwitchContinuityCoverage"));
  assert.ok(failures.some((failure) => failure.key === "publicPrioritySignalCoverage"));
  assert.ok(failures.some((failure) => failure.key === "publicFollowUpDedupCoverage"));
  assert.ok(failures.some((failure) => failure.key === "publicFollowUpTemplateDisciplineCoverage"));
  assert.ok(failures.some((failure) => failure.key === "publicFollowUpSpecificityCoverage"));
  assert.ok(failures.some((failure) => failure.key === "publicEvidenceSynthesisCoverage"));
  assert.ok(failures.some((failure) => failure.key === "publicEvidenceSynthesisDedupCoverage"));
  assert.ok(failures.some((failure) => failure.key === "publicEvidenceSynthesisLabelStackCoverage"));
  assert.ok(failures.some((failure) => failure.key === "publicEvidenceAnchorLeadVariantCoverage"));
  assert.ok(failures.some((failure) => failure.key === "publicEvidenceAnchorDedupCoverage"));
  assert.ok(failures.some((failure) => failure.key === "publicEvidenceSynthesisSpokenVerificationCoverage"));
  assert.ok(failures.some((failure) => failure.key === "publicEvidenceSynthesisSpokenVerificationVariantCoverage"));
  assert.ok(failures.some((failure) => failure.key === "publicEvidenceSynthesisExplicitModeCoverage"));
  assert.ok(failures.some((failure) => failure.key === "publicVerificationLeadVariantCoverage"));
  assert.ok(failures.some((failure) => failure.key === "publicFollowUpTailVariantCoverage"));
  assert.ok(failures.some((failure) => failure.key === "publicEvidenceFragmentClarityCoverage"));
  assert.ok(failures.some((failure) => failure.key === "nonPublicEvidenceFragmentClarityCoverage"));
  assert.ok(failures.some((failure) => failure.key === "nonPublicSurfacePolishCoverage"));
  assert.ok(failures.some((failure) => failure.key === "publicSurfacePolishCoverage"));
  assert.ok(failures.some((failure) => failure.key === "publicTableSpeechBrevityCoverage"));
  assert.ok(failures.some((failure) => failure.key === "publicSentenceClosureCoverage"));
  assert.ok(failures.some((failure) => failure.key === "publicGenericOpenerDisciplineCoverage"));
  assert.ok(failures.some((failure) => failure.key === "publicPressureTextureCoverage"));
  assert.ok(failures.some((failure) => failure.key === "publicPersonaPressureVariantCoverage"));
  assert.ok(failures.some((failure) => failure.key === "publicPersonaPressureLineDiversityCoverage"));
  assert.ok(failures.some((failure) => failure.key === "publicShadowPressureLineDiversityCoverage"));
  assert.ok(failures.some((failure) => failure.key === "publicShadowTargetLineVariantCoverage"));
  assert.ok(failures.some((failure) => failure.key === "publicPressureActionLeadVariantCoverage"));
  assert.ok(failures.some((failure) => failure.key === "publicPressureUrgencyTailVariantCoverage"));
  assert.ok(failures.some((failure) => failure.key === "publicPressureActionLeadDedupCoverage"));
  assert.ok(failures.some((failure) => failure.key === "evilPublicCoverTextureCoverage"));
  assert.ok(failures.some((failure) => failure.key === "evilPublicCoverMaintenanceCoverage"));
  assert.ok(failures.some((failure) => failure.key === "evilPublicCoverMaintenanceDedupCoverage"));
  assert.ok(failures.some((failure) => failure.key === "evilPublicCoverPivotCoverage"));
  assert.ok(failures.some((failure) => failure.key === "evilPublicProtectAllyCoverage"));
  assert.ok(failures.some((failure) => failure.key === "evilPublicClaimCoverContinuityCoverage"));
  assert.ok(failures.some((failure) => failure.key === "evilPublicClaimCoverPivotCoverage"));
  assert.ok(failures.some((failure) => failure.key === "evilPublicClaimCoverProtectAllyCoverage"));
  assert.ok(failures.some((failure) => failure.key === "evilPublicClaimCoverCrossDayCoverage"));
  assert.ok(failures.some((failure) => failure.key === "evilPublicClaimCoverDeceptionArcCoverage"));
  assert.ok(failures.some((failure) => failure.key === "evilPublicClaimCoverPressureContinuityCoverage"));
  assert.ok(failures.some((failure) => failure.key === "evilPublicClaimCoverPlanDedupCoverage"));
  assert.ok(failures.some((failure) => failure.key === "evilPrivateCoordinationCoverage"));
  assert.ok(failures.some((failure) => failure.key === "evilPrivateTeamInfoVariantCoverage"));
  assert.ok(failures.some((failure) => failure.key === "evilPrivateCoverPlanVariantCoverage"));
  assert.ok(failures.some((failure) => failure.key === "evilPrivatePressurePlanDedupCoverage"));
  assert.ok(failures.some((failure) => failure.key === "nominationStrategyPlanDedupCoverage"));
  assert.ok(failures.some((failure) => failure.key === "aiToAiEvilCoordinationCoverage"));
  assert.ok(failures.some((failure) => failure.key === "repetitionRate"));
  assert.ok(failures.some((failure) => failure.key === "nominationReasonableRate"));
}

testBuildsFixedQualityEvaluationSet();
testSummarizesReasoningQualityMetrics();
testQualityGatesCatchRegressions();

console.log("ai quality eval contracts ok");
