import assert from "node:assert/strict";

import {
  AI_QUALITY_BASELINE_THRESHOLDS,
  buildAIQualityEvaluationSet,
  evaluateAIQualityGates,
  summarizeAIQualityEvaluation,
} from "../scripts/ai_quality_eval.mjs";

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

function normalizedPrivateDeepTail(line) {
  return compactSignal(line).replace(/\d+号(?:和\d+号)?/gu, "X号");
}

const PRIVATE_SOURCE_TIMELINE_HEADING_PATTERN =
  /(?:来源和时间线一起看|来源和节奏合起来|这条线先拆来源|这票先拆来源|这边先看投票先后|这边先看回应先后|先分来源再看节奏|这条先按来源拆开|先对来源独立性|先分票源和节奏|这票先看谁先动手)/u;
const PRIVATE_SOURCE_TIMELINE_HEADING_CAPTURE =
  /(来源和时间线一起看|来源和节奏合起来|这条线先拆来源|这票先拆来源|这边先看投票先后|这边先看回应先后|先分来源再看节奏|这条先按来源拆开|先对来源独立性|先分票源和节奏|这票先看谁先动手)：([^。！？]+)/gu;
const PRIVATE_MOTIVE_BURDEN_HEADING_PATTERN =
  /(?:动机和举证一起看|动机和理由合起来|票面动机要拆开|再看票的收益|再看举证负担|再看收益和举证|收益线要拆开|再分动机和举证|最后看谁该说明|最后落到责任)/u;
const PRIVATE_MOTIVE_BURDEN_HEADING_CAPTURE =
  /(动机和举证一起看|动机和理由合起来|票面动机要拆开|再看票的收益|再看举证负担|再看收益和举证|收益线要拆开|再分动机和举证|最后看谁该说明|最后落到责任)：([^。！？]+)/gu;
const PRIVATE_REASON_OPENING_SENTENCE_CAPTURE =
  /^(先给结论：(?:我先不把话说死|我先看这条，但不锁死|我先点这条，但不把话说死|我暂时不换目标，先放主线)|我先不把话说死，先说排序|这条我先看，但不锁死|我先点这条，先别当铁证|我暂时不换目标，先放主线|先把排序说清，但不拍死|我先按主线排，不当铁证|先给你一个暂定排序|这条先当主线，不急着拍死)[。！？]/u;
const PRIVATE_REASON_OPENING_LEAD_CAPTURE =
  /^(先给结论|我先不把话说死|这条我先看|我先点这条|我暂时不换目标|先把排序说清|我先按主线排|先给你一个暂定排序|这条先当主线)/u;
const PUBLIC_VERIFICATION_LEAD_PATTERN =
  /(?:核法是(?:先听|让)|核法先交给|这条(?:先)?让|先请)\s*[0-9]+号(?:来)?/u;
const PUBLIC_VERIFICATION_LEAD_PATTERNS = [
  /核法是先听\s*[0-9]+号/u,
  /核法是让\s*[0-9]+号/u,
  /核法先交给\s*[0-9]+号来/u,
  /这条先让\s*[0-9]+号/u,
  /这条让\s*[0-9]+号/u,
  /先请\s*[0-9]+号/u,
];
const PUBLIC_PRESSURE_URGENCY_TAIL_PATTERNS = [
  /别拖到票前才解释/u,
  /这轮就要先把回应补上/u,
  /不要等到落票前才补口径/u,
  /先在讨论阶段把解释说清/u,
  /票前再补就太晚了/u,
];
const PUBLIC_PRESSURE_ACTION_LEAD_PATTERNS = [
  /我会先压\s*[0-9]+号/u,
  /这轮先压\s*[0-9]+号/u,
  /我会直接压\s*[0-9]+号/u,
  /先把\s*[0-9]+号压到桌面上/u,
  /[0-9]+号这边我先给压力/u,
  /[0-9]+号先上压力/u,
];
const PUBLIC_PRESSURE_ACTION_DUPLICATE_PATTERN =
  /(?:我会先压\s*(\d+号)[\s\S]{0,120}我(?:直说，)?先压\1|这轮先压\s*(\d+号)[\s\S]{0,120}我(?:直说，)?先压\2|我会直接压\s*(\d+号)[\s\S]{0,120}我(?:直说，)?先压\3|先把\s*(\d+号)压到桌面上[\s\S]{0,120}我(?:直说，)?先压\4|(\d+号)这边我先给压力[\s\S]{0,120}我(?:直说，)?先压\5|(\d+号)先上压力[\s\S]{0,120}我(?:直说，)?先压\6)/u;
const PUBLIC_SHADOW_ACTION_DUPLICATE_PATTERN = /我先暗记(\d+号)这条主线[\s\S]{0,120}\1我先暗记成主线/u;
const PUBLIC_SHADOW_TARGET_LINE_PATTERNS = [
  /[0-9]+号这条先留在主线里/u,
  /[0-9]+号先挂观察位/u,
  /这条先记在[0-9]+号身上/u,
  /[0-9]+号这边先留一格压力/u,
  /[0-9]+号先留在台面压力线上/u,
  /[0-9]+号这边我先不放下/u,
  /先把[0-9]+号留在压力线上/u,
  /[0-9]+号这条先记一笔/u,
];
const OLD_PUBLIC_SHADOW_TARGET_LINE_PATTERN = /我先暗记\s*[0-9]+号这条主线|[0-9]+号我先暗记成主线/u;
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
      /身份口径和票型一起压过来|身份说法和票型一起压过来|身份解释和投票线卡在同一处|身份线和票型互相咬住|身份线.*票型|身份线.*投票|身份线.*压力票|身份和票型压实|死亡\/保护会搅票型|公开站队和票型在同一方向|台面压力和投票线同向|公开压力和票型互相推高|身份口径和提名压力卡在一起|身份说法和提名压力卡在一起|身份解释和上台窗口撞在一起|身份线被提名压力顶住|台面压力和提名窗口卡在一起|公开压力和上台窗口连在一起|台面节奏已经顶到提名口/,
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
      /身份口径和票型一起压过来|身份说法和票型一起压过来|身份解释和投票线卡在同一处|身份线和票型互相咬住|身份线.*票型|身份线.*投票|身份线.*压力票|身份和票型压实|死亡\/保护会搅票型|公开站队和票型在同一方向|台面压力和投票线同向|公开压力和票型互相推高|身份口径和提名压力卡在一起|身份说法和提名压力卡在一起|身份解释和上台窗口撞在一起|身份线被提名压力顶住|台面压力和提名窗口卡在一起|公开压力和上台窗口连在一起|台面节奏已经顶到提名口/,
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
      /身份口径和票型一起压过来|身份说法和票型一起压过来|身份解释和投票线卡在同一处|身份线和票型互相咬住|身份线.*票型|身份线.*投票|身份线.*压力票|身份和票型压实|死亡\/保护会搅票型|公开站队和票型在同一方向|台面压力和投票线同向|公开压力和票型互相推高|身份口径和提名压力卡在一起|身份说法和提名压力卡在一起|身份解释和上台窗口撞在一起|身份线被提名压力顶住|台面压力和提名窗口卡在一起|公开压力和上台窗口连在一起|台面节奏已经顶到提名口/,
      `${beat} sample should synthesize evidence families`
    );
    assert.match(row?.text ?? "", pattern, `${beat} sample should use timing-specific pressure handling`);
    assert.doesNotMatch(row?.text ?? "", /自己人|邪恶视角|真实身份|爪牙|恶魔伪装|当前可用伪装|魔典|PRIVATE_SECRET_MARKER|bluff/i);
  });
  const publicSynthesisVerificationRows = evaluation.rows.filter((row) => row.requiresPublicEvidenceSynthesisVerificationVariant);
  const expectedPublicSynthesisVerificationModes = [
    [
      "identity-vote",
      /身份口径和票型一起压过来|身份说法和票型一起压过来|身份解释和投票线卡在同一处|身份线和票型互相咬住|身份线.*票型|身份线.*投票|身份线.*压力票|身份和票型压实/,
      /(?:核法是(?:先听|让)|核法先交给|这条(?:先)?让|先请)\s*[0-9]+号(?:来)?.*身份.*票型.*投票理由|身份说法和票型一起压过来.*压\s*[0-9]+号.*票前才解释/,
    ],
    [
      "pressure-vote",
      /公开站队和票型在同一方向|台面压力和投票线同向|公开压力和票型互相推高|死亡\/保护会搅票型|票型跟台面压力要对/,
      /(?:核法是(?:先听|让)|核法先交给|这条(?:先)?让|先请)\s*[0-9]+号(?:来)?.*票型.*台面压力|先把\s*[0-9]+号说法对齐.*票型跟台面压力要对/,
    ],
    [
      "identity-nomination",
      /身份口径和提名压力卡在一起|身份说法和提名压力卡在一起|身份解释和上台窗口撞在一起|身份线被提名压力顶住/,
      /(?:核法是(?:先听|让)|核法先交给|这条(?:先)?让|先请)\s*[0-9]+号(?:来)?.*身份.*提名压力|身份说法和提名压力卡在一起.*[0-9]+号这边先听回应|身份说法和提名压力卡在一起.*既然\s*[0-9]+号报.*信息链.*票型/,
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
    assert.ok(row?.expectedClaimRoleName && (row.text ?? "").includes(row.expectedClaimRoleName), `${mode} sample should name the public claim role`);
    assert.ok(row?.focusName && (row.text ?? "").includes(row.focusName), `${mode} sample should name the focus target`);
    assert.ok((row?.evidenceSummaries?.length ?? 0) >= 2, `${mode} sample should keep multiple evidence summaries`);
    assert.match(
      row?.text ?? "",
      /多条|两条|不止一条|合在一起|不把它当单点|公开站队和台面压力|公开站队和票型|公开压力和票型|身份和票型|身份说法和票型|身份口径和票型|身份线.*票型|身份线.*投票|身份解释和投票线|投票和身份|公开线索更多|线索更多|证据位/,
      `${mode} sample should preserve multi-evidence compression`
    );
    assert.match(
      row?.text ?? "",
      /身份口径和票型一起压过来|身份说法和票型一起压过来|身份解释和投票线卡在同一处|身份线和票型互相咬住|身份线.*票型|身份线.*投票|身份线.*压力票|身份和票型压实|死亡\/保护会搅票型|公开站队和票型在同一方向|台面压力和投票线同向|公开压力和票型互相推高|身份口径和提名压力卡在一起|身份说法和提名压力卡在一起|身份解释和上台窗口撞在一起|身份线被提名压力顶住|台面压力和提名窗口卡在一起|公开压力和上台窗口连在一起|台面节奏已经顶到提名口/,
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
    assert.ok(row.text.includes(row.expectedClaimRoleName), "claim-cover pivot speech should retain the public claim role name");
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
      "deception-arc sample should prove a prior public pivot happened"
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
    assert.match(row?.text ?? "", /火力点|放到讨论中心|先压|先问|多说|先问身份和夜里信息|决定要不要提/, `${scriptId} sample should coordinate a table pressure target`);
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
    assert.match(row?.text ?? "", /火力点|放到讨论中心|先压|先问|多说|先问身份和夜里信息|决定要不要提/, `${scriptId} AI-AI sample should coordinate pressure`);
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
    assert.ok(variantIndex >= 0, `${row.id} should use a recognized evil team-info variant`);
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
  assert.equal(summary.nominationActionContextCoverage, 1, "nomination rows should explain why this is not an empty pass");
  assert.equal(summary.nominationStrategyModeCoverage, 1, "fixed nomination rows should cover every strategy action-context mode");
  assert.equal(summary.nominationDefenseResponseCoverage, 1, "nominee defense rows should answer the nomination and state a vote threshold");
  assert.equal(summary.nominationDefenseResponseVariantCoverage, 1, "nominee defense rows should avoid one repeated answer opening");
  assert.equal(summary.nominationDefenseInfoDedupCoverage, 1, "nominee defense rows should not repeat the same info plan");
  assert.equal(summary.nominationDefenseReasonAnchorCoverage, 1, "nominee defense rows should answer the real nomination pressure point");
  assert.equal(
    summary.highPressureNominationDefenseCounterPressureCoverage,
    1,
    "high-pressure nominee defense rows should counter-check the nominator's push"
  );
  assert.equal(
    summary.crossScriptNominationDefenseReasonAnchorCoverage,
    1,
    "BMR/SnV nominee defense rows should answer the real nomination pressure point"
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
        return reasonAnchor && row.text.includes(reasonAnchor);
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
  assert.equal(summary.claimDisclosureHoldLeadVariantCoverage, 1, "hold claim-disclosure continuity should use varied natural leads");
  assert.equal(summary.publicClaimHoldLeadVariantCoverage, 1, "public hold claim-disclosure continuity should avoid one spoken lead dominating");
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
    assert.ok(spokenLineAppearsInText(line, row.text), `${row.id} should speak the continuity line`);
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
  assert.equal(summary.crossScriptPublicReasoningCoverage, 1, "public reasoning samples should cover BMR and SnV");
  assert.equal(summary.crossScriptPublicMultiEvidenceCoverage, 1, "public multi-evidence samples should cover BMR and SnV");
  assert.equal(summary.publicScriptPressureVariantCoverage, 1, "BMR/SnV public multi-evidence speech should preserve script-specific pressure context");
  assert.equal(summary.publicTimingPressureVariantCoverage, 1, "nomination/vote public multi-evidence speech should preserve timing-specific pressure context");
  assert.equal(summary.publicRolePressureVariantCoverage, 1, "public speech should preserve role-specific pressure context for public claims");
  assert.equal(summary.crossScriptPrivateMultiEvidenceCoverage, 1, "private multi-evidence samples should cover BMR and SnV");
  assert.equal(summary.privateSurfaceReportDisciplineCoverage, 1, "private rationale speech should not expose internal labels as report headings");
  assert.equal(summary.privateReasonOpeningRedundancyCoverage, 1, "private reason replies should not repeat the focus in the opening");
  assert.equal(summary.privateReasonOpeningVariantCoverage, 1, "private reason replies should vary direct-answer opening bridges");
  assert.equal(summary.privateReasonOpeningLeadVariantCoverage, 1, "private reason reply openings should vary the leading phrase");
  assert.equal(summary.privateReasonOpeningSentenceCoverage, 1, "private reason opening bridges should end as standalone sentences");
  assert.equal(summary.privateVerificationLeadNaturalizationCoverage, 1, "private verification lines should use natural spoken leads");
  const privateOpeningRows = evaluation.rows.filter(
    (row) =>
      row.source === "private-whisper" &&
      row.audience === "private" &&
      row.intent === "reason" &&
      PRIVATE_REASON_OPENING_SENTENCE_CAPTURE.test(row.text ?? "")
  );
  const privateOpeningLeads = new Set(
    privateOpeningRows
      .map((row) => (row.text ?? "").match(PRIVATE_REASON_OPENING_LEAD_CAPTURE)?.[1] ?? "")
      .filter(Boolean)
  );
  const privateOpeningLeadCounts = new Map();
  privateOpeningRows.forEach((row) => {
    const lead = (row.text ?? "").match(PRIVATE_REASON_OPENING_LEAD_CAPTURE)?.[1] ?? "";
    if (lead) {
      privateOpeningLeadCounts.set(lead, (privateOpeningLeadCounts.get(lead) ?? 0) + 1);
    }
  });
  assert.ok(privateOpeningLeads.size >= 5, "private reason openings should use at least five leading phrases");
  const maxPrivateOpeningLeadCount = Math.max(0, ...privateOpeningLeadCounts.values());
  assert.ok(
    maxPrivateOpeningLeadCount <= Math.max(2, Math.ceil(privateOpeningRows.length * 0.35)),
    "private reason openings should not be dominated by one repeated phrase"
  );
  assert.ok(
    privateOpeningRows.every((row) => !/^先给结论：/.test(row.text ?? "")),
    "private reason openings should not all fall back to the old fixed lead"
  );
  evaluation.rows
    .filter(
      (row) =>
        row.source === "private-whisper" &&
        row.audience === "private" &&
        row.intent === "reason" &&
        !!row.decisionRationale?.verificationLine &&
        (row.requiresPrivateEvidenceSynthesisVariant || /(?:验证点是|先听|先核|这条先问|这条先让)/u.test(row.text ?? ""))
    )
    .forEach((row) => {
      assert.doesNotMatch(row.text ?? "", /验证点是/u, `${row.id} should not expose the old verification lead`);
      assert.match(row.text ?? "", /先听|先核|这条先问|这条先让/u, `${row.id} should use a natural verification lead`);
    });
  assert.equal(summary.privateDeepReasoningSpokenCoverage, 1, "private reason replies should say source-reliability reasoning");
  assert.equal(summary.privateTimelineReasoningSpokenCoverage, 1, "private reason replies should say timeline-consistency reasoning");
  assert.equal(summary.privateSourceTimelineCompressionCoverage, 1, "private reason replies should compress source and timeline reasoning");
  assert.equal(summary.privateIncentiveReasoningSpokenCoverage, 1, "private reason replies should say incentive-alignment reasoning");
  assert.equal(summary.privateBurdenReasoningSpokenCoverage, 1, "private reason replies should say burden-of-proof reasoning");
  assert.equal(summary.privateDeepReasoningCompressionCoverage, 1, "private reason replies should compress incentive and burden reasoning");
  assert.equal(summary.privateDeepReasoningCompressionVariantCoverage, 1, "private reason compressed deep reasoning should vary phrasing");
  assert.equal(summary.privateDeepReasoningHeadingVariantCoverage, 1, "private reason compressed deep reasoning should vary heading phrasing");
  assert.equal(summary.privateDeepReasoningTailVariantCoverage, 1, "private reason compressed deep reasoning should vary tail phrasing");
  assert.equal(summary.privateDeepReasoningBrevityCoverage, 1, "private compressed deep reasoning should stay concise enough for chat");
  assert.equal(summary.privateDeepReasoningLeadDedupCoverage, 1, "private compressed deep reasoning should not repeat the same target lead twice");
  const privateDeepReasonRows = evaluation.rows.filter(
    (row) =>
      row.source === "private-whisper" &&
      row.audience === "private" &&
      row.intent === "reason" &&
      PRIVATE_SOURCE_TIMELINE_HEADING_PATTERN.test(row.text ?? "") &&
      PRIVATE_MOTIVE_BURDEN_HEADING_PATTERN.test(row.text ?? "")
  );
  const sourceDeepHeadings = new Set();
  const motiveDeepHeadings = new Set();
  const sourceDeepTails = [];
  const motiveDeepTails = [];
  privateDeepReasonRows.forEach((row) => {
    [...`${row.text ?? ""}`.matchAll(PRIVATE_SOURCE_TIMELINE_HEADING_CAPTURE)].forEach((match) => {
      sourceDeepHeadings.add(match[1]);
      sourceDeepTails.push(normalizedPrivateDeepTail(match[2] ?? ""));
    });
    [...`${row.text ?? ""}`.matchAll(PRIVATE_MOTIVE_BURDEN_HEADING_CAPTURE)].forEach((match) => {
      motiveDeepHeadings.add(match[1]);
      motiveDeepTails.push(normalizedPrivateDeepTail(match[2] ?? ""));
    });
    assert.doesNotMatch(
      row.text ?? "",
      /(\d+号(?:和\d+号)?)(?:的来源和时间线一起看|的来源和节奏合起来|这条线先拆来源|这票先拆来源|这边先看投票先后|这边先看回应先后)[\s\S]{0,140}\1(?:的动机和举证一起看|的动机和理由合起来|再看票的收益|再看收益和举证|最后看谁该说明)/u,
      `${row.id} should not repeat the same target lead before source and motive compression`
    );
  });
  assert.ok(sourceDeepHeadings.size >= 3, "private source/timeline compressed headings should use at least three variants");
  assert.ok(motiveDeepHeadings.size >= 3, "private motive/burden compressed headings should use at least three variants");
  const maxTailCount = (values) => {
    const counts = new Map();
    values.filter(Boolean).forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
    return Math.max(0, ...counts.values());
  };
  const sourceTailVariants = new Set(sourceDeepTails.filter(Boolean));
  const motiveTailVariants = new Set(motiveDeepTails.filter(Boolean));
  assert.ok(sourceTailVariants.size >= 6, "private source/timeline compressed tails should use at least six variants");
  assert.ok(motiveTailVariants.size >= 6, "private motive/burden compressed tails should use at least six variants");
  assert.ok(
    maxTailCount(sourceDeepTails) <= Math.max(3, Math.ceil(sourceDeepTails.length * 0.3)),
    "no private source/timeline compressed tail should dominate fixed rows"
  );
  assert.ok(
    maxTailCount(motiveDeepTails) <= Math.max(3, Math.ceil(motiveDeepTails.length * 0.3)),
    "no private motive/burden compressed tail should dominate fixed rows"
  );
  assert.equal(summary.privateEvidenceSynthesisCoverage, 1, "private multi-evidence speech should synthesize how evidence families connect");
  assert.equal(summary.privateEvidenceSynthesisVariantCoverage, 1, "private evidence synthesis should cover multiple evidence-family modes");
  assert.equal(summary.privateEvidenceSynthesisVerificationCoverage, 1, "private evidence synthesis should carry mode-specific verification lines");
  assert.equal(summary.privateEvidenceSynthesisSpokenVerificationCoverage, 1, "private evidence synthesis should say mode-specific verification actions");
  assert.equal(summary.privateEvidenceSynthesisSourceIdentityDedupCoverage, 1, "source-identity private synthesis should not repeat source-check wording");
  assert.equal(summary.privateEvidenceSynthesisVoteTaxonomyDedupCoverage, 1, "protection-vote private synthesis should not repeat vote-taxonomy wording");
  evaluation.rows
    .filter(
      (row) =>
        row.requiresPrivateEvidenceSynthesisVariant &&
        row.expectedPrivateEvidenceSynthesisMode === "source-identity"
    )
    .forEach((row) => {
      const compactText = compactSignal(row.text ?? "");
      assert.ok(countOccurrences(compactText, "来源不稳") <= 1, `${row.id} should not repeat unstable-source wording`);
      assert.ok(countOccurrences(compactText, "再对一下") <= 1, `${row.id} should not repeat source recheck wording`);
    });
  evaluation.rows
    .filter(
      (row) =>
        row.requiresPrivateEvidenceSynthesisVariant &&
        row.expectedPrivateEvidenceSynthesisMode === "protection-vote"
    )
    .forEach((row) => {
      const compactText = compactSignal(row.text ?? "");
      ["自保", "跟风", "主动推人"].forEach((phrase) => {
        assert.ok(countOccurrences(compactText, phrase) <= 1, `${row.id} should not repeat vote-taxonomy wording ${phrase}`);
      });
    });
  assert.ok(summary.formalVoteRationaleCoverage >= 0.8, "formal vote decisions should carry public-safe rationale");
  assert.equal(summary.formalVoteTableContextCoverage, 1, "formal vote decisions should carry table-readable vote context");
  assert.equal(summary.formalVoteLineDiversityCoverage, 1, "formal vote decisions should not collapse into repeated table lines");
  assert.equal(summary.formalVoteNormalizedLineDiversityCoverage, 1, "formal vote lines should stay distinct after seat labels are normalized");
  assert.equal(summary.formalVoteReasonModeCoverage, 1, "formal vote decisions should cover major public-safe reason modes");
  assert.equal(summary.formalVoteNearThresholdCoverage, 1, "near-threshold formal votes should verbalize hesitation");
  assert.equal(summary.formalVoteEvilCoverSafetyCoverage, 1, "evil-side formal vote cover lines should stay public-safe");
  assert.equal(summary.formalVoteEvidenceBoundaryCoverage, 1, "evidence-backed near-threshold votes should preserve evidence and boundary wording");
  assert.equal(summary.formalVoteMultiEvidenceCompressionCoverage, 1, "multi-evidence formal votes should compress multiple evidence rows");
  assert.equal(summary.formalVoteScriptCoverage, 1, "formal vote quality samples should cover TB, BMR, and SnV");
  assert.ok(summary.crossDayStanceContinuityCoverage >= 0.8, "cross-day stance samples should verbalize continuity");
  assert.ok(summary.crossDayStanceReasonCoverage >= 0.8, "cross-day stance samples should cite current evidence reasons");
  assert.equal(summary.crossDayStanceReasonRecapDedupCoverage, 1, "cross-day stance memory recaps should not repeat current evidence reasons");
  assert.equal(summary.crossDayStanceEvidenceDeltaCoverage, 1, "cross-day stance samples should carry evidence-delta explanations");
  assert.equal(summary.crossDayStanceEvidenceTraceCoverage, 1, "cross-day stance samples should preserve evidence source snippets");
  assert.equal(summary.crossDayStanceEvidenceAnchorCoverage, 1, "cross-day stance samples should preserve evidence ids and anchors");
  assert.equal(summary.crossDayStanceEventAnchorCoverage, 1, "cross-day stance samples should preserve source event anchors");
  assert.equal(summary.crossDayStanceScoreTrailAnchorCoverage, 1, "cross-day stance samples should preserve score movement anchors");
  assert.equal(summary.crossDayStanceModeCoverage, 1, "fixed samples should cover both cross-day hold and shift");
  assert.equal(summary.crossScriptCrossDayStanceCoverage, 1, "cross-day stance samples should cover BMR/SnV hold and shift");
  assert.equal(summary.crossDayTargetSwitchCoverage, 1, "cross-day target switches should explain why the main pressure moved");
  assert.equal(summary.crossScriptCrossDayTargetSwitchCoverage, 1, "cross-day target switches should cover BMR and SnV");
  assert.equal(summary.nonPublicTargetSwitchContinuityCoverage, 1, "non-public target-switch replies should verbalize the old and new pressure lanes");
  assert.ok(summary.publicPrioritySignalCoverage >= 0.8, "public speech should preserve persona/target/evidence/follow-up signals");
  assert.equal(summary.publicFollowUpDedupCoverage, 1, "public speech should not duplicate the same follow-up question cue");
  assert.equal(summary.publicFollowUpTemplateDisciplineCoverage, 1, "public speech should avoid repeated stock follow-up templates");
  assert.equal(summary.publicFollowUpSpecificityCoverage, 1, "public follow-up questions should target the cited evidence type");
  assert.equal(summary.publicEvidenceSynthesisCoverage, 1, "public multi-evidence speech should synthesize how evidence families connect");
  assert.equal(summary.publicEvidenceSynthesisDedupCoverage, 1, "public multi-evidence speech should not repeat the same synthesis phrase");
  assert.equal(summary.publicEvidenceSynthesisLabelStackCoverage, 1, "public multi-evidence speech should not stack evidence-label prefixes");
  assert.equal(summary.publicEvidenceAnchorLeadVariantCoverage, 1, "public multi-evidence anchors should use varied natural leads");
  assert.equal(summary.publicEvidenceAnchorDedupCoverage, 1, "public multi-evidence anchors should not repeat the same evidence body");
  const publicEvidenceAnchorLeadPattern =
    /(这两点合着看|我卡的是这组线索|不止一条线在指这里|桌面问题连在一起|两条线先并起来看|这组关系不能拆开看|不是单点，线索接在一起|先把这组线放到同一桌面|我先按这组矛盾追问|这里要把两边一起验|证据还薄，但两点要对|这点还没定死，先看|线索不厚，但两边要接上|先按两条弱线对账|证据不厚，先把两边接住|这组线还要补证)：/u;
  const publicEvidenceAnchorSentencePattern =
    /(这两点合着看|我卡的是这组线索|不止一条线在指这里|桌面问题连在一起|两条线先并起来看|这组关系不能拆开看|不是单点，线索接在一起|先把这组线放到同一桌面|我先按这组矛盾追问|这里要把两边一起验|证据还薄，但两点要对|这点还没定死，先看|线索不厚，但两边要接上|先按两条弱线对账|证据不厚，先把两边接住|这组线还要补证)：([^。！？；]+)/gu;
  const publicEvidenceAnchorRows = evaluation.rows.filter(
    (row) =>
      row.audience === "public" &&
      (row.evidenceSummaries?.length ?? 0) >= 2 &&
      `${row.evidenceSpokenText ?? ""}`.startsWith("两条线索合在一起：")
  );
  assert.ok(publicEvidenceAnchorRows.length >= 3, "fixed public synthesis rows should include several multi-evidence anchors");
  const publicEvidenceAnchorLeads = new Set();
  const publicEvidenceAnchorLeadCounts = new Map();
  publicEvidenceAnchorRows.forEach((row) => {
    assert.doesNotMatch(
      row.text ?? "",
      /(?:证据卡在|我过不去的是|这点还不够)：两条线索合在一起：/u,
      `${row.id} should not use the old stacked public evidence lead`
    );
    assert.doesNotMatch(
      row.text ?? "",
      /(?:这两点合着看|我卡的是这组线索|不止一条线在指这里|桌面问题连在一起|两条线先并起来看|这组关系不能拆开看|不是单点，线索接在一起|先把这组线放到同一桌面|我先按这组矛盾追问|这里要把两边一起验|证据还薄，但两点要对|这点还没定死，先看|线索不厚，但两边要接上|先按两条弱线对账|证据不厚，先把两边接住|这组线还要补证)[，,]\s*两条线索合在一起：/u,
      `${row.id} should not keep raw two-evidence wording after the natural lead`
    );
    const match = `${row.text ?? ""}`.match(publicEvidenceAnchorLeadPattern);
    assert.ok(match, `${row.id} should use a natural public evidence anchor lead`);
    const anchorBodies = [...`${row.text ?? ""}`.matchAll(publicEvidenceAnchorSentencePattern)]
      .map((anchorMatch) => compactSignal(anchorMatch[2] ?? ""))
      .filter(Boolean);
    assert.equal(
      hasDuplicateOrNestedSignalBody(anchorBodies),
      false,
      `${row.id} should not repeat the same public evidence anchor body`
    );
    publicEvidenceAnchorLeads.add(match[1]);
    publicEvidenceAnchorLeadCounts.set(match[1], (publicEvidenceAnchorLeadCounts.get(match[1]) ?? 0) + 1);
  });
  assert.ok(publicEvidenceAnchorLeads.size >= 5, "public evidence anchors should use at least five lead variants");
  const maxEvidenceAnchorLeadCount = Math.max(0, ...publicEvidenceAnchorLeadCounts.values());
  assert.ok(
    maxEvidenceAnchorLeadCount <= Math.max(4, Math.ceil(publicEvidenceAnchorRows.length * 0.35)),
    "public evidence anchor leads should not be dominated by one repeated lead"
  );
  assert.equal(summary.publicEvidenceSynthesisSpokenVerificationCoverage, 1, "public multi-evidence speech should say the verification action");
  assert.equal(
    summary.publicEvidenceSynthesisSpokenVerificationVariantCoverage,
    1,
    "public multi-evidence speech should match verification actions to evidence-family modes"
  );
  assert.equal(
    summary.publicEvidenceSynthesisExplicitModeCoverage,
    1,
    "explicit public synthesis fixtures should cover every verification mode"
  );
  assert.equal(summary.publicVerificationLeadVariantCoverage, 1, "public verification actions should vary their leading phrase");
  const publicVerificationRows = evaluation.rows.filter(
    (row) =>
      row.source === "public-discussion" &&
      row.audience === "public" &&
      (row.evidenceSummaries?.length ?? 0) >= 2 &&
      PUBLIC_VERIFICATION_LEAD_PATTERN.test(row.text ?? "")
  );
  assert.ok(publicVerificationRows.length >= 3, "fixed public synthesis rows should include several public verification prompts");
  const publicVerificationLeads = new Set();
  publicVerificationRows.forEach((row) => {
    const leadIndex = PUBLIC_VERIFICATION_LEAD_PATTERNS.findIndex((pattern) => pattern.test(row.text ?? ""));
    assert.notEqual(leadIndex, -1, `${row.id} should use a recognized public verification lead`);
    publicVerificationLeads.add(leadIndex);
  });
  assert.ok(publicVerificationLeads.size >= 3, "public verification prompts should use at least three lead variants");
  assert.equal(summary.publicFollowUpTailVariantCoverage, 1, "public verification follow-up tails should vary across fixed rows");
  const publicFollowUpTailRows = evaluation.rows.filter((row) => {
    const text = row.text ?? "";
    return (
      row.audience === "public" &&
      PUBLIC_VERIFICATION_LEAD_PATTERN.test(text) &&
      /昨晚信息|投票理由|提名压力/u.test(text)
    );
  });
  assert.ok(publicFollowUpTailRows.length >= 6, "fixed public discussion set should include several follow-up tail rows");
  const publicFollowUpTails = new Set();
  publicFollowUpTailRows.forEach((row) => {
    const tailIndex = PUBLIC_FOLLOW_UP_TAIL_PATTERNS.findIndex((pattern) => pattern.test(row.text ?? ""));
    assert.notEqual(tailIndex, -1, `${row.id} should use a recognized public follow-up tail`);
    publicFollowUpTails.add(tailIndex);
  });
  const oldNightTailCount = publicFollowUpTailRows.filter((row) => /再说昨晚信息/u.test(row.text ?? "")).length;
  assert.ok(
    oldNightTailCount <= Math.max(3, Math.floor(publicFollowUpTailRows.length * 0.25)),
    "old public follow-up tail should no longer dominate fixed rows"
  );
  assert.ok(publicFollowUpTails.size >= 6, "public verification follow-up tails should use at least six variants");
  assert.equal(summary.publicEvidenceFragmentClarityCoverage, 1, "public evidence fragments should stay readable after budget trimming");
  const publicClippedEvidencePattern = /(?:当前压|可见|刚才投票|投票和|投票理|票型跟|公开站队和|身份解释|身份)(?:\.{3,}|…)/u;
  evaluation.rows
    .filter((row) => row.audience === "public" && row.evidenceSpokenText)
    .forEach((row) => {
      assert.doesNotMatch(row.text ?? "", publicClippedEvidencePattern, `${row.id} should not expose clipped evidence fragments`);
    });
  assert.equal(summary.nonPublicEvidenceFragmentClarityCoverage, 1, "private and nomination evidence fragments should stay readable after budget trimming");
  assert.equal(summary.nonPublicSurfacePolishCoverage, 1, "private, nomination, and vote speech should avoid awkward Chinese seat spacing");
  const nonPublicSeatVerbSpacingPattern =
    /(?:让|问|看|盯|对|排|压|转到|转|沿着|把|放过|放掉|清掉|处理|验|提|举|投|跟|出|在|不跟|不投|不举)\s+[0-9]+号/u;
  evaluation.rows
    .filter((row) => row.audience !== "public")
    .forEach((row) => {
      assert.doesNotMatch(row.text ?? "", nonPublicSeatVerbSpacingPattern, `${row.id} should not keep verb-to-seat spacing`);
    });
  assert.equal(summary.publicSurfacePolishCoverage, 1, "public speech should avoid awkward seat spacing and duplicate surface wording");
  const publicDuplicateFirstPattern =
    /先请[0-9]+号先|把(?:身份和票型|没讲清的点)先(?:对上|对齐|补上)|先听[0-9]+号[^。！？；，,]{0,18}先(?:补|对|解释)/u;
  const publicAwkwardVerificationPattern =
    /台面上。还是|核法先交给[0-9]+号来(?:身份|把身份)|(?:核法是让|核法先交给|这条(?:先)?让|先请)[0-9]+号(?:来)?(?:把)?身份(?:口径)?先(?:对齐|对上|落到桌面)/u;
  evaluation.rows
    .filter((row) => row.audience === "public")
    .forEach((row) => {
      assert.doesNotMatch(row.text ?? "", publicDuplicateFirstPattern, `${row.id} should not duplicate public action-first wording`);
      assert.doesNotMatch(row.text ?? "", publicAwkwardVerificationPattern, `${row.id} should not keep awkward public verification wording`);
    });
  assert.equal(summary.publicTableSpeechBrevityCoverage, 1, "public discussion speech should stay concise enough for table chat");
  const publicDiscussionRows = evaluation.rows.filter((row) => row.source === "public-discussion" && row.audience === "public");
  assert.ok(publicDiscussionRows.length >= 10, "fixed quality set should include several public discussion rows");
  const longestPublicDiscussionRow = Math.max(0, ...publicDiscussionRows.map((row) => (row.text ?? "").replace(/\s+/g, " ").trim().length));
  assert.ok(
    longestPublicDiscussionRow <= 190,
    `fixed public discussion rows should stay within the table-chat brevity limit, got ${longestPublicDiscussionRow}`
  );
  assert.equal(summary.publicSentenceClosureCoverage, 1, "public speech should end as complete spoken sentences");
  assert.equal(summary.publicGenericOpenerDisciplineCoverage, 1, "public speech should avoid generic filler openers");
  assert.ok(summary.publicPressureTextureCoverage >= 0.8, "high-pressure public speech should carry emotional texture");
  assert.equal(summary.publicPersonaPressureVariantCoverage, 1, "high-pressure multi-evidence public speech should preserve persona-specific handling");
  assert.equal(summary.publicPersonaPressureLineDiversityCoverage, 1, "persona pressure openings should vary across high-pressure public fixtures");
  assert.equal(summary.publicShadowPressureLineDiversityCoverage, 1, "shadow high-pressure public openings should not collapse into one repeated stem");
  assert.equal(summary.publicShadowTargetLineVariantCoverage, 1, "shadow high-pressure public target tracking should use varied natural lines");
  assert.equal(summary.publicPressureActionLeadVariantCoverage, 1, "pressure high-pressure public target actions should use varied natural leads");
  assert.equal(summary.publicPressureUrgencyTailVariantCoverage, 1, "public pressure urgency tails should vary across high-pressure rows");
  assert.equal(summary.publicPressureActionLeadDedupCoverage, 1, "public pressure speech should not repeat the same action lead");
  const publicShadowTargetRows = evaluation.rows.filter(
    (row) =>
      row.audience === "public" &&
      row.speakerPersona === "shadow" &&
      (row.requiresPublicPersonaPressureVariant ||
        OLD_PUBLIC_SHADOW_TARGET_LINE_PATTERN.test(row.text ?? "") ||
        PUBLIC_SHADOW_TARGET_LINE_PATTERNS.some((pattern) => pattern.test(row.text ?? "")))
  );
  assert.ok(publicShadowTargetRows.length >= 3, "fixed public pressure set should include several shadow target-tracking rows");
  const publicShadowTargetLineVariants = new Set();
  const publicShadowTargetLineCounts = new Map();
  publicShadowTargetRows.forEach((row) => {
    assert.doesNotMatch(row.text ?? "", /我先暗记\s*[0-9]+号这条主线/u, `${row.id} should not use the old fixed shadow target line`);
    const lineIndex = PUBLIC_SHADOW_TARGET_LINE_PATTERNS.findIndex((pattern) => pattern.test(row.text ?? ""));
    assert.notEqual(lineIndex, -1, `${row.id} should use a recognized shadow target-tracking line`);
    publicShadowTargetLineVariants.add(lineIndex);
    publicShadowTargetLineCounts.set(lineIndex, (publicShadowTargetLineCounts.get(lineIndex) ?? 0) + 1);
  });
  assert.ok(publicShadowTargetLineVariants.size >= 3, "shadow target-tracking rows should use at least three line variants");
  const maxPublicShadowTargetLineCount = Math.max(...publicShadowTargetLineCounts.values());
  assert.ok(
    maxPublicShadowTargetLineCount <= Math.max(3, Math.ceil(publicShadowTargetRows.length * 0.45)),
    "shadow target-tracking rows should avoid one line dominating the fixed set"
  );
  const publicPressureActionRows = evaluation.rows.filter(
    (row) =>
      row.audience === "public" &&
      row.speakerPersona === "pressure" &&
      (row.decisionRationale?.focusScore ?? 0) >= 0.72 &&
      (row.evidenceSummaries?.length ?? 0) >= 2 &&
      ((row.requiresPublicPersonaPressureVariant && row.expectedPersona === "pressure") ||
        PUBLIC_PRESSURE_ACTION_LEAD_PATTERNS.some((pattern) => pattern.test(row.text ?? "")))
  );
  assert.ok(publicPressureActionRows.length >= 4, "fixed public pressure set should include several pressure action rows");
  const publicPressureActionLeads = new Set();
  const publicPressureActionLeadCounts = new Map();
  publicPressureActionRows.forEach((row) => {
    const leadIndex = PUBLIC_PRESSURE_ACTION_LEAD_PATTERNS.findIndex((pattern) => pattern.test(row.text ?? ""));
    assert.notEqual(leadIndex, -1, `${row.id} should use a recognized public pressure action lead`);
    assert.doesNotMatch(row.text ?? "", PUBLIC_PRESSURE_ACTION_DUPLICATE_PATTERN, `${row.id} should not repeat the pressure action lead`);
    publicPressureActionLeads.add(leadIndex);
    publicPressureActionLeadCounts.set(leadIndex, (publicPressureActionLeadCounts.get(leadIndex) ?? 0) + 1);
  });
  assert.ok(publicPressureActionLeads.size >= 4, "pressure action rows should use at least four lead variants");
  const maxPublicPressureActionLeadCount = Math.max(...publicPressureActionLeadCounts.values());
  assert.ok(
    maxPublicPressureActionLeadCount <= Math.max(3, Math.ceil(publicPressureActionRows.length * 0.45)),
    "pressure action rows should avoid one lead dominating the fixed set"
  );
  const publicPressureUrgencyRows = evaluation.rows.filter(
    (row) =>
      row.audience === "public" &&
      row.speakerPersona === "pressure" &&
      (row.decisionRationale?.focusScore ?? 0) >= 0.72 &&
      (row.evidenceSummaries?.length ?? 0) >= 2 &&
      ((row.requiresPublicPersonaPressureVariant && row.expectedPersona === "pressure") ||
        PUBLIC_PRESSURE_ACTION_LEAD_PATTERNS.some((pattern) => pattern.test(row.text ?? "")))
  );
  assert.ok(publicPressureUrgencyRows.length >= 3, "fixed public pressure set should include several urgency-tail rows");
  const publicPressureUrgencyTails = new Set();
  publicPressureUrgencyRows.forEach((row) => {
    const tailIndex = PUBLIC_PRESSURE_URGENCY_TAIL_PATTERNS.findIndex((pattern) => pattern.test(row.text ?? ""));
    assert.notEqual(tailIndex, -1, `${row.id} should use a recognized public pressure urgency tail`);
    publicPressureUrgencyTails.add(tailIndex);
  });
  assert.ok(publicPressureUrgencyTails.size >= 3, "public pressure urgency rows should use at least three tail variants");
  assert.ok(summary.evilPublicCoverTextureCoverage >= 0.8, "evil public speech should preserve cover-safe table wording");
  assert.ok(summary.evilPublicCoverMaintenanceCoverage >= 0.8, "evil public speech should maintain the same cover line across turns");
  assert.equal(summary.evilPublicCoverMaintenanceDedupCoverage, 1, "evil public maintenance cover should not repeat the same pressure lead");
  const evilMaintenanceRows = evaluation.rows.filter((row) => row.requiresEvilCoverMaintenance);
  assert.ok(evilMaintenanceRows.length >= 1, "fixed set should include an evil cover-maintenance row");
  evilMaintenanceRows.forEach((row) => {
    assert.equal(
      hasRepeatedPublicPressureLeadExtension(row.text ?? ""),
      false,
      `${row.id} should not repeat a pressure lead before an expanded verification sentence`
    );
  });
  assert.ok(summary.evilPublicCoverPivotCoverage >= 0.8, "evil public speech should explain public-safe cover pivots");
  assert.ok(summary.evilPublicProtectAllyCoverage >= 0.8, "evil public speech should explain public-safe ally-protection deflection");
  assert.equal(summary.evilPublicClaimCoverContinuityCoverage, 1, "evil public speech should continue a public claim-cover identity line");
  assert.equal(summary.evilPublicClaimCoverPivotCoverage, 1, "evil public speech should keep public claim-cover identity while pivoting targets");
  assert.equal(summary.evilPublicClaimCoverProtectAllyCoverage, 1, "evil public speech should keep public claim-cover identity while deflecting pressure from an ally");
  assert.equal(summary.evilPublicClaimCoverCrossDayCoverage, 1, "evil public speech should keep public claim-cover identity across days");
  assert.equal(summary.evilPublicClaimCoverDeceptionArcCoverage, 1, "evil public speech should preserve claim-cover identity across a longer pivot/protect/cross-day arc");
  assert.equal(summary.evilPublicClaimCoverPressureContinuityCoverage, 1, "evil public speech should connect long-arc pressure back to a prior visible target line");
  assert.equal(summary.evilPublicClaimCoverPlanDedupCoverage, 1, "evil public claim-cover speech should not repeat the same visible plan");
  assert.equal(summary.evilPrivateCoordinationCoverage, 1, "evil private coordination should cover team, identity, cover, and pressure target");
  assert.equal(summary.evilPrivateTeamInfoVariantCoverage, 1, "evil private coordination should vary team-info wording");
  assert.equal(summary.evilPrivateCoverPlanVariantCoverage, 1, "evil private coordination should vary cover/pressure plan wording");
  assert.equal(summary.evilPrivatePressurePlanDedupCoverage, 1, "evil private coordination should not repeat the same pressure plan");
  assert.equal(summary.nominationStrategyPlanDedupCoverage, 1, "nomination strategy rows should not repeat the same action plan");
  assert.equal(summary.aiToAiEvilCoordinationCoverage, 1, "AI-AI evil coordination should cover hidden team pressure planning");
  assert.ok(summary.repetitionRate <= 0.35, "fixed samples should avoid repeated sentence stems");
  assert.equal(summary.stanceContinuityRate, 1, "same-run focused samples should preserve or explain stance");
  assert.equal(summary.nominationReasonableRate, 1, "nomination reason should include decision and strategy rationale text");
  assert.deepEqual(evaluateAIQualityGates(summary), []);
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
