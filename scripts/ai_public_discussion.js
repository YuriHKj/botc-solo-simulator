export function createAIPublicDiscussion(deps) {
  const {
    QUESTION_INTENT,
    PERSONA_TYPES,
    DEBATE_BEATS,
    ensureDialogueState,
    refreshAIBeliefs,
    buildAgentView,
    buildAIStrategyContext,
    buildAIThoughtFrame,
    rankTargets,
    resolveStableFocus,
    rememberDayStance,
    crossDayStanceContinuityLine,
    personaThresholdShift,
    buildDialogueEvidenceContract,
    claimDisclosurePlanner,
    publicClaimDisclosureLine,
    attachClaimDisclosureRationaleSpokenLine,
    thoughtFrameDisclosureLine,
    maybePublicDisclosureLine,
    shortReasonText,
    renderDialogueActs,
    corpusTemplateEntry,
    personaCorpusKey,
    pickCorpusTemplate,
    pickPersonaTemplate,
    pickLayeredSpeech,
    sample,
    dayStanceLabel,
    statementTargetLabel,
    roleNameById,
    summarizeShareablePrivateNotes,
    joinSpeechFragments,
    renderPublicSurfaceActReadable,
    buildPublicSurfaceAct,
    buildDecisionRationale,
    buildReasoningContrastLine,
    attachDecisionRationaleSpokenLine,
    ensureEvidenceContractInText,
    applyInGamePragmatics,
    applyHumanSpeechCadence,
    applySpeechBudget,
    sanitizePlayerVisibleText,
    appendPublicThoughtQuestion,
    shouldDeadPublicClaim,
    pickClaimRole,
    choosePublicClaimRole,
    claimRoleForContext,
    applyPublicStatementContinuityFromMemory,
    rememberStatementMemory,
    recordPublicSpeechForAgents,
    addLog,
    pushTimeline,
    predictDialogueSignals,
    recordUtteranceMVP,
    inferPublicSpeechActs,
    voteStanceFromText,
    clamp,
  } = deps;
function nextPublicRound(state) {
  const dialogue = ensureDialogueState(state);
  const dayKey = `${state.day}`;
  dialogue.publicRoundByDay[dayKey] = (dialogue.publicRoundByDay[dayKey] ?? 0) + 1;
  return dialogue.publicRoundByDay[dayKey];
}

function debateBeatForOrder(orderIndex, totalSpeakers, roundInDay) {
  if (roundInDay >= 2) {
    return orderIndex % 2 === 0 ? "challenge" : "vote-intent";
  }
  const bucket = Math.floor((orderIndex / Math.max(1, totalSpeakers)) * DEBATE_BEATS.length);
  return DEBATE_BEATS[Math.max(0, Math.min(DEBATE_BEATS.length - 1, bucket))] ?? "opening";
}

function publicComparableText(text) {
  return cleanClippedPublicEvidenceFragments(text)
    .replace(/\.{3,}/g, "...")
    .replace(/…/g, "...")
    .replace(/当前压\.{3,}/g, "台面压力")
    .replace(/可见记录：\s*([0-9]+号)\s*刚才投票\.{3,}/g, "可见记录：$1刚才投票态度要解释")
    .replace(/可见记录：\s*([0-9]+号)\s*的投票和\.{3,}/g, "可见记录：$1的投票和身份解释要对")
    .replace(/刚才投票\.{3,}/g, "刚才投票态度要解释")
    .replace(/投票和\.{3,}/g, "投票和身份解释要对")
    .replace(/可见\.{3,}/g, "可见记录还要对")
    .replace(/卡在\s+在/g, "卡在")
    .replace(/([0-9]+号)\s+(这条|这边|那条|也|的|刚才)/g, "$1$2")
    .replace(/(让|问|看|盯|对|排|压|提|转到|沿着|先把|把)\s+([0-9]+号)/g, "$1$2")
    .replace(/\s+/g, "")
    .trim();
}

function cleanClippedPublicEvidenceFragments(text) {
  return `${text ?? ""}`
    .replace(/\.{3,}/g, "...")
    .replace(/…/g, "...")
    .replace(/公开站队和\.{3,}/g, "公开站队和台面压力")
    .replace(/可见记录：\s*([0-9]+号)\s*的投票理\.{3,}/g, "可见记录：$1的投票理由要补清")
    .replace(/投票理\.{3,}/g, "投票理由要补清")
    .replace(/票型跟\.{3,}/g, "票型跟台面压力要对")
    .replace(/当前压\.{3,}/g, "台面压力")
    .replace(/可见记录：\s*([0-9]+号)\s*刚才投票\.{3,}/g, "可见记录：$1刚才投票态度要解释")
    .replace(/可见记录：\s*([0-9]+号)\s*的投票和\.{3,}/g, "可见记录：$1的投票和身份解释要对")
    .replace(/刚才投票\.{3,}/g, "刚才投票态度要解释")
    .replace(/投票和\.{3,}/g, "投票和身份解释要对")
    .replace(/身份解释\.{3,}/g, "身份解释要补清")
    .replace(/身份\.{3,}/g, "身份要对")
    .replace(/可见\.{3,}/g, "可见记录还要对");
}

function dedupePublicRepeatedPressureActionLead(text) {
  let value = `${text ?? ""}`;
  for (let seat = 1; seat <= 20; seat += 1) {
    const target = `${seat}号`;
    const pressureTargetLine = new RegExp(
      [
        `我会先压\\s*${target}`,
        `这轮先压\\s*${target}`,
        `我会直接压\\s*${target}`,
        `先把\\s*${target}压到桌面上`,
        `${target}这边我先给压力`,
        `${target}先上压力`,
      ].join("|"),
      "u"
    );
    if (pressureTargetLine.test(value)) {
      value = value
        .replace(new RegExp(`我直说，我先压\\s*${target}，需要马上听回应。`, "u"), "我直说，需要马上听回应。")
        .replace(new RegExp(`我先压\\s*${target}，需要马上听回应。`, "u"), "需要马上听回应。");
    }
    const shadowTargetLine = new RegExp(
      [
        `我先暗记\\s*${target}这条主线`,
        `${target}这条先留在主线里`,
        `${target}先挂观察位`,
        `这条先记在${target}身上`,
        `${target}这边先留一格压力`,
        `${target}先留在台面压力线上`,
        `${target}这边我先不放下`,
        `先把${target}留在压力线上`,
        `${target}这条先记一笔`,
      ].join("|"),
      "u"
    );
    if (shadowTargetLine.test(value)) {
      value = value
        .replace(new RegExp(`我有点在意，\\s*${target}我先暗记成主线，需要听回应。`, "u"), "我有点在意，需要听回应。")
        .replace(new RegExp(`${target}我先暗记成主线，需要听回应。`, "u"), "需要听回应。");
    }
  }
  return value;
}

function publicPressureLeadBody(sentence) {
  return `${sentence ?? ""}`.replace(/[。！？；\s]+$/gu, "").trim();
}

function isPublicPressureLeadBody(body) {
  const compact = `${body ?? ""}`.replace(/\s+/g, "");
  return (
    compact.length >= 18 &&
    /[0-9]+号/u.test(compact) &&
    /(这条|这边|压力|主线|观察位|台面|回应)/u.test(compact) &&
    /(压|回应|主线|观察|不放下|补实|降压|记一笔)/u.test(compact)
  );
}

function dedupePublicRepeatedPressureLeadExtensions(text) {
  let value = `${text ?? ""}`;
  for (let seat = 1; seat <= 20; seat += 1) {
    const target = `${seat}号`;
    [
      `${target}这条不单看，${target}这边我先不放下，回应绕就继续压`,
      `${target}这条先单独记，${target}这边我先不放下，回应绕就继续压`,
      `${target}这条要看后续回应，${target}这边我先不放下，回应绕就继续压`,
      `${target}这条不单看，${target}这条先留在主线里，等回应再降压`,
      `${target}这条先单独记，${target}这条先留在主线里，等回应再降压`,
      `${target}这条要看后续回应，${target}这条先留在主线里，等回应再降压`,
      `${target}这条不单看，先把${target}留在压力线上，看回应有没有补实`,
      `${target}这条先单独记，先把${target}留在压力线上，看回应有没有补实`,
      `${target}这条要看后续回应，先把${target}留在压力线上，看回应有没有补实`,
    ].forEach((lead) => {
      let first = value.indexOf(lead);
      let next = first >= 0 ? value.indexOf(lead, first + lead.length) : -1;
      while (first >= 0 && next >= 0) {
        const before = value.slice(0, first).replace(/[，,]\s*$/u, "");
        value = `${before}${value.slice(first + lead.length)}`;
        first = value.indexOf(lead);
        next = first >= 0 ? value.indexOf(lead, first + lead.length) : -1;
      }
    });
  }
  value = value
    .replace(/([。！？；])\s*([。！？；])+/gu, "$1")
    .replace(/([。！？；])\s+(?=\S)/gu, "$1")
    .replace(/\s+/g, " ")
    .trim();
  const fragments = value.match(/[^。！？；]+[。！？；]?/gu) ?? [];
  if (fragments.length <= 1) {
    return value;
  }
  const dropIndexes = new Set();
  fragments.forEach((fragment, index) => {
    const body = publicPressureLeadBody(fragment);
    if (!isPublicPressureLeadBody(body)) {
      return;
    }
    const duplicatedLater = fragments
      .slice(index + 1)
      .some((later) => {
        const laterBody = publicPressureLeadBody(later);
        return laterBody.startsWith(`${body}，`) || laterBody.startsWith(`${body},`) || laterBody.startsWith(`${body}：`);
      });
    if (duplicatedLater) {
      dropIndexes.add(index);
    }
  });
  if (dropIndexes.size === 0) {
    return value;
  }
  return fragments
    .filter((_fragment, index) => !dropIndexes.has(index))
    .join("")
    .replace(/([。！？；])\s+(?=\S)/gu, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function polishPublicLineSurface(text) {
  return dedupePublicEvidenceAnchorLine(
    cleanClippedPublicEvidenceFragments(
      dedupePublicRepeatedPressureLeadExtensions(dedupePublicRepeatedPressureActionLead(`${text ?? ""}`))
        .replace(
          /((?:这两点合着看|我卡的是这组线索|不止一条线在指这里|桌面问题连在一起|两条线先并起来看|这组关系不能拆开看|不是单点，线索接在一起|先把这组线放到同一桌面|我先按这组矛盾追问|这里要把两边一起验|证据还薄，但两点要对|这点还没定死，先看|线索不厚，但两边要接上|先按两条弱线对账|证据不厚，先把两边接住|这组线还要补证))[，,]\s*两条线索合在一起：/gu,
          "$1："
        )
        .replace(/([0-9]+)\s+号/gu, "$1号")
        .replace(/(刚才|如果|昨天|今天|明天|前面)\s+([0-9]+号)/gu, "$1$2")
        .replace(/([与和及])\s+([0-9]+号)/gu, "$1$2")
        .replace(/(是|还是|为|按|报|跳|主线在|转到|转向)\s+([0-9]+号)/gu, "$1$2")
        .replace(/(点过|给|放下|放回|放低|丢给|交给)\s+([0-9]+号)/gu, "$1$2")
        .replace(/(是|还是|为|按|报|跳)\s+([\u4e00-\u9fff]{1,12})(?=[，。；！？：、\s]|$)/gu, "$1$2")
        .replace(/理由还是\s*可见记录：/gu, "理由还是这条可见记录：")
        .replace(/来先/gu, "来")
        .replace(/先请([0-9]+号)先(?=把|解释|说明|对|补)/gu, "先请$1")
        .replace(/核法先交给([0-9]+号)来身份先对上/gu, "核法是让$1把身份对上")
        .replace(/核法先交给([0-9]+号)来身份口径先对齐/gu, "核法是让$1把身份口径对齐")
        .replace(/核法先交给([0-9]+号)来把身份先落到桌面/gu, "核法是让$1把身份口径放到桌面")
        .replace(/核法先交给([0-9]+号)来把身份和票型(对上|对齐)/gu, "核法是让$1把身份和票型$2")
        .replace(/核法是让([0-9]+号)身份口径先对齐/gu, "核法是让$1把身份口径对齐")
        .replace(/这条先让([0-9]+号)把身份先落到桌面/gu, "这条先让$1把身份口径放到桌面")
        .replace(/把身份和票型先对上/gu, "把身份和票型对上")
        .replace(/把身份和票型先对齐/gu, "把身份和票型对齐")
        .replace(/把没讲清的点先补上/gu, "把没讲清的点补上")
        .replace(/(?:这点还不够：)?公开信息还不够，先听回应和票型。\s*([0-9]+号)这边，?公开信息还不够，先听回应和票型。?/gu, "$1这边公开信息还不够，先听回应和票型。")
        .replace(/台面上。还是/gu, "台面上还是")
        .replace(/卡在\s+在/gu, "卡在")
        .replace(/卡在\s+(?=前面|推低|身份|公开|两条|[0-9]+号)/gu, "卡在")
        .replace(/换线\s+台面理由/gu, "换线。台面理由")
        .replace(/((?:我|你|大家|今天|这轮|票前)?(?:会|先|暂时|直接|继续|不)?(?:让|问|看|盯|对|排|压|转到|转|沿着|把|放过|放掉|提|举|投|跟|出|在))\s+([0-9]+号)/gu, "$1$2")
        .replace(/([0-9]+号)\s+(?=[\u4e00-\u9fff])/gu, "$1")
        .replace(/\s+([，。；！？：、])/gu, "$1")
        .replace(/([。！？；])\s+(?=\S)/gu, "$1")
        .replace(/\s+/g, " ")
        .trim()
    )
  )
    .replace(/核法先交给([0-9]+号)来身份先对上/gu, "核法是让$1把身份对上")
    .replace(/核法先交给([0-9]+号)来身份口径先对齐/gu, "核法是让$1把身份口径对齐")
    .replace(/核法先交给([0-9]+号)来把身份先落到桌面/gu, "核法是让$1把身份口径放到桌面")
    .replace(/核法先交给([0-9]+号)来把身份和票型(对上|对齐)/gu, "核法是让$1把身份和票型$2")
    .replace(/核法是让([0-9]+号)身份口径先对齐/gu, "核法是让$1把身份口径对齐")
    .replace(/这条先让([0-9]+号)把身份先落到桌面/gu, "这条先让$1把身份口径放到桌面")
    .replace(/台面上。还是/gu, "台面上还是")
    .replace(/^我的意思是，/u, "")
    .replace(/^我不太放心，台面上，([0-9]+号这条先单独记)/u, "先别急，台面上，$1")
    .replace(/核法是先听([0-9]+号)/gu, "先听$1")
    .replace(/核法先交给([0-9]+号)来/gu, "这条让$1")
    .replace(/身份口径/gu, "身份说法")
    .replace(/公开口径/g, "公开说法")
    .replace(/私下口径/g, "私下说法")
    .replace(/口径/g, "说法")
    .replace(/这条先让([0-9]+号)([^。！？；]{6,90})。这条让\1([^。！？；]{6,90})。/gu, "这条让$1$3。");
}

function publicEvidenceAnchorLabel(evidenceContract = null) {
  const spoken = `${evidenceContract?.spokenText ?? evidenceContract?.text ?? ""}`;
  if (/^两条线索合在一起：/u.test(spoken)) {
    const anchorSalt = [
      evidenceContract?.lowEvidence ? "low-evidence-anchor" : "multi-evidence-anchor",
      spoken,
      evidenceContract?.text ?? "",
      ...(evidenceContract?.summaries ?? []),
    ].join("|");
    const variants = evidenceContract?.lowEvidence
      ? [
          "证据还薄，但两点要对",
          "这点还没定死，先看",
          "线索不厚，但两边要接上",
          "先按两条弱线对账",
          "证据不厚，先把两边接住",
          "这组线还要补证",
        ]
      : [
          "这两点合着看",
          "我卡的是这组线索",
          "不止一条线在指这里",
          "桌面问题连在一起",
          "两条线先并起来看",
          "这组关系不能拆开看",
          "不是单点，线索接在一起",
          "先把这组线放到同一桌面",
          "我先按这组矛盾追问",
          "这里要把两边一起验",
        ];
    return publicPressureVariantWithSalt(spoken, variants, anchorSalt);
  }
  return evidenceContract?.lowEvidence ? "这点还不够" : "我过不去的是";
}

function expandPublicEvidenceClips(text) {
  return `${text ?? ""}`
    .replace(/公开站队和(?:\.{3,}|…)/g, "公开站队和台面压力")
    .replace(/当前压(?:\.{3,}|…)/g, "台面压力")
    .replace(/刚才投票(?:\.{3,}|…)/g, "刚才投票态度要解释")
    .replace(/投票理(?:\.{3,}|…)/g, "投票理由要补清")
    .replace(/票型跟(?:\.{3,}|…)/g, "票型跟台面压力要对")
    .replace(/投票和(?:\.{3,}|…)/g, "投票和身份解释要对")
    .replace(/身份解释(?:\.{3,}|…)/g, "身份解释要补清")
    .replace(/\s+/g, " ")
    .trim();
}

function publicEvidenceAnchorLine(evidenceContract = null) {
  const spoken = `${evidenceContract?.spokenText ?? ""}`;
  if (!spoken) {
    return "";
  }
  const expanded = expandPublicEvidenceClips(spoken);
  const anchorText = /^两条线索合在一起：/u.test(expanded)
    ? expanded.replace(/^两条线索合在一起：/u, "").trim()
    : expanded;
  return `${publicEvidenceAnchorLabel(evidenceContract)}：${anchorText || spoken}。`;
}

function ensurePublicEvidenceAnchorInLine(line, evidenceContract = null, maxChars = 190) {
  const value = `${line ?? ""}`.trim();
  const spoken = `${evidenceContract?.spokenText ?? ""}`.trim();
  if (!value || !spoken || publicLineIncludesFragment(value, spoken)) {
    return value;
  }
  const summaries = Array.isArray(evidenceContract?.summaries) ? evidenceContract.summaries : [];
  const hasSummary = summaries.some((summary) => publicLineIncludesFragment(value, summary));
  const hasNaturalAnchor =
    /这两点合着看：|我卡的是这组线索：|不止一条线在指这里：|桌面问题连在一起：|两条线先并起来看：|这组关系不能拆开看：|不是单点，线索接在一起：|先把这组线放到同一桌面：|我先按这组矛盾追问：|这里要把两边一起验：|证据还薄，但两点要对：|这点还没定死，先看：|线索不厚，但两边要接上：|先按两条弱线对账：|证据不厚，先把两边接住：|这组线还要补证：/u.test(value);
  if (hasSummary || hasNaturalAnchor || /多条证据|两条线索|不止一条公开线索/u.test(value)) {
    return value;
  }
  const anchor = publicEvidenceAnchorLine(evidenceContract);
  if (!anchor) {
    return value;
  }
  const joined = joinSpeechFragments([value, anchor]);
  if (joined.length <= maxChars) {
    return joined;
  }
  const headRoom = Math.max(0, maxChars - anchor.length - 1);
  const head = value.slice(0, headRoom).replace(/[，。！？；、\s]+$/u, "").trim();
  return joinSpeechFragments([head, anchor]);
}

function publicHasVerificationAction(line) {
  return (
    /(?:核法是(?:先听|让)|核法先交给|这条(?:先)?让|先请)\s*[0-9]+号(?:来)?/u.test(line ?? "") &&
    /解释票型|票型解释清|身份(?:和票型)?(?:先)?对上|身份(?:说法|口径|和票型)?对齐|投票理由|台面压力|提名压力|把没讲清的点(?:先)?补(?:清|上)|解释(?:为什么)?压低证据位|压低证据位的理由|压低证据位这点先讲清/u.test(line ?? "")
  );
}

function publicSynthesisSentenceFromLine(line) {
  const sentences = `${line ?? ""}`.match(/[^。！？；]+[。！？；]?/gu)?.map((entry) => entry.trim()).filter(Boolean) ?? [];
  return sentences.find((entry) =>
    /身份(?:说法|口径)和票型一起压过来|身份解释和投票线卡在同一处|身份线和票型互相咬住|公开站队和票型在同一方向|台面压力和投票线同向|公开压力和票型互相推高|身份(?:说法|口径)和提名压力卡在一起|身份解释和上台窗口撞在一起|身份线被提名压力顶住|台面压力和提名窗口卡在一起|公开压力和上台窗口连在一起|台面节奏已经顶到提名口/u.test(entry)
  ) ?? "";
}

function publicEvidenceAnchorSentenceFromLine(line) {
  const sentences = `${line ?? ""}`.match(/[^。！？；]+[。！？；]?/gu)?.map((entry) => entry.trim()).filter(Boolean) ?? [];
  return sentences.find((entry) =>
    /这两点合着看：|我卡的是这组线索：|不止一条线在指这里：|桌面问题连在一起：|两条线先并起来看：|这组关系不能拆开看：|不是单点，线索接在一起：|先把这组线放到同一桌面：|我先按这组矛盾追问：|这里要把两边一起验：|证据还薄，但两点要对：|这点还没定死，先看：|线索不厚，但两边要接上：|先按两条弱线对账：|证据不厚，先把两边接住：|这组线还要补证：/u.test(entry)
  ) ?? "";
}

function publicScriptPressureSentenceFromLine(line) {
  const sentences = `${line ?? ""}`.match(/[^。！？；]+[。！？；]?/gu)?.map((entry) => entry.trim()).filter(Boolean) ?? [];
  return sentences.find((entry) => /BMR里|SnV里/u.test(entry)) ?? "";
}

function publicLineHasPressureTexture(line) {
  return /嗯|说实话|我有点犹豫|我直说|别拖|说真的|我有点在意|我先留个心眼|我不太放心|先别急|我得防一下|这票先别锁/u.test(line ?? "");
}

function publicHasPressureActionLead(line) {
  return /我会先压\s*[0-9]+号|这轮先压\s*[0-9]+号|我会直接压\s*[0-9]+号|先把\s*[0-9]+号压到桌面上|[0-9]+号这边我先给压力|[0-9]+号先上压力/u.test(line ?? "");
}

function publicHasPressureUrgencyTail(line) {
  return /别拖到票前才解释|这轮就要先把回应补上|不要等到落票前才补口径|先在讨论阶段把解释说清|票前再补就太晚了/u.test(line ?? "");
}

function publicHasEvilCoverMarker(line) {
  return /好人视角|台面上|公开说|节奏|解围|闭眼冲|台面理由|放进流程/u.test(line ?? "");
}

function ensurePublicEvilCoverMarkerInLine(line, aiPlayer, maxChars = 190) {
  const value = `${line ?? ""}`.trim();
  if (!value || aiPlayer?.team !== "evil" || publicHasEvilCoverMarker(value)) {
    return value;
  }
  const joined = `台面上，${value}`;
  return joined.length <= maxChars ? joined : value;
}

function ensurePublicEvilProtectAllyInLine(line, strategyContext, maxChars = 190) {
  const value = `${line ?? ""}`.trim();
  if (
    !value ||
    strategyContext?.evilWorldPlan?.mode !== "protect-ally" ||
    /台面压力别只堆一处|先把\s*[0-9]+号\s*也拉出来对话|压力重新分配|别只压一个点/u.test(value)
  ) {
    return value;
  }
  const protectLine = publicEvilProtectAllyLine(strategyContext, { salt: "final-cover" });
  if (!protectLine) {
    return value;
  }
  const joined = joinSpeechFragments([protectLine, value]);
  if (joined.length <= maxChars) {
    return joined;
  }
  const firstSentence = value.match(/[^。！？；]+[。！？；]?/u)?.[0]?.trim() || "";
  const compact = joinSpeechFragments([protectLine, firstSentence]);
  return compact && compact.length <= maxChars ? compact : value;
}

function ensurePublicPressureActionInLine(line, aiPlayer, targetName, evidenceContract = null, focusScore = 0, maxChars = 190) {
  const value = `${line ?? ""}`.trim();
  const target = `${targetName ?? ""}`.trim();
  const summaries = Array.isArray(evidenceContract?.summaries) ? evidenceContract.summaries : [];
  if (
    !value ||
    !target ||
    aiPlayer?.aiPersona !== PERSONA_TYPES.PRESSURE ||
    focusScore < 0.72 ||
    summaries.length < 2
  ) {
    return value;
  }
  const synthesis = publicSynthesisSentenceFromLine(value) || publicEvidenceSynthesisFragment(summaries, target);
  const needsAction = !publicHasPressureActionLead(value);
  const needsUrgency = !publicHasPressureUrgencyTail(value);
  if (!needsAction && !needsUrgency) {
    return value;
  }
  const action = needsAction ? publicPressureActionLine(target, synthesis, summaries.length, focusScore) : "";
  const urgency = needsUrgency ? publicPressureUrgencyTail(target, synthesis, summaries.length, focusScore) : "";
  const pressureFragment = sentenceFragment([action, urgency].filter(Boolean).join("，"));
  if (!pressureFragment) {
    return value;
  }
  const joined = joinSpeechFragments([value, pressureFragment]);
  if (joined.length <= maxChars) {
    return joined;
  }
  const anchorSentence = publicEvidenceAnchorSentenceFromLine(value);
  const scriptPressureSentence = publicScriptPressureSentenceFromLine(value);
  const compact = joinSpeechFragments([scriptPressureSentence, synthesis, anchorSentence, pressureFragment].filter(Boolean));
  return compact && compact.length <= maxChars ? compact : value;
}

function ensurePublicPressureTextureInLine(line, aiPlayer, focusScore = 0, maxChars = 190) {
  const value = `${line ?? ""}`.trim();
  if (!value || focusScore < 0.72 || publicLineHasPressureTexture(value)) {
    return value;
  }
  const prefix = publicPressureVariantWithSalt(
    aiPlayer?.id ?? "",
    aiPlayer?.aiPersona === PERSONA_TYPES.SHADOW
      ? ["我有点在意，", "我先留个心眼，", "我不太放心，", "先别急，"]
      : aiPlayer?.aiPersona === PERSONA_TYPES.PRESSURE
        ? ["我直说，", "别拖，", "说真的，"]
        : ["说实话，", "嗯，", "我有点犹豫，但"],
    `${focusScore}:${value.slice(0, 64)}`
  );
  const joined = `${prefix}${value}`;
  return joined.length <= maxChars ? joined : value;
}

function ensurePublicVerificationActionInLine(line, targetName, evidenceContract = null, maxChars = 190) {
  const value = `${line ?? ""}`.trim();
  const target = `${targetName ?? ""}`.trim();
  const spoken = `${evidenceContract?.spokenText ?? ""}`.trim();
  const summaries = Array.isArray(evidenceContract?.summaries) ? evidenceContract.summaries : [];
  const isMultiEvidence = summaries.length >= 2 || /^两条线索合在一起：/u.test(spoken);
  if (!value || !target || !isMultiEvidence) {
    return value;
  }
  const generatedSynthesis = sentenceFragment(publicEvidenceSynthesisFragment(summaries, target));
  const synthesisSentence = publicSynthesisSentenceFromLine(value) || generatedSynthesis;
  const context = [value, generatedSynthesis, spoken, summaries.join("、")].filter(Boolean).join(" ");
  const action = sentenceFragment(polishPublicLineSurface(publicSpecificFollowUpQuestionText(target, context, "direct")));
  const hasDesiredAction = action && publicLineIncludesFragment(value, action);
  if (publicHasVerificationAction(value) && publicSynthesisSentenceFromLine(value) && hasDesiredAction) {
    return value;
  }
  const joined = joinSpeechFragments([
    value,
    publicSynthesisSentenceFromLine(value) ? "" : generatedSynthesis,
    hasDesiredAction ? "" : action,
  ]);
  if (joined.length <= maxChars) {
    return joined;
  }
  const anchorSentence = publicEvidenceAnchorSentenceFromLine(value);
  const scriptPressureSentence = publicScriptPressureSentenceFromLine(value);
  const compactCandidates = [
    [scriptPressureSentence, synthesisSentence, anchorSentence, action],
    [synthesisSentence, scriptPressureSentence, anchorSentence, action],
    [synthesisSentence, anchorSentence, action],
    [anchorSentence, synthesisSentence, action],
    [scriptPressureSentence, synthesisSentence, action],
    [synthesisSentence, action],
    [anchorSentence, action],
  ];
  for (const parts of compactCandidates) {
    const compact = joinSpeechFragments(parts.filter(Boolean));
    if (compact && compact.length <= maxChars && compact.includes(target)) {
      return compact;
    }
  }
  return compactPublicLineBySentences(joined, target, maxChars);
}

function publicLineIncludesFragment(line, fragment) {
  const normalizedFragment = publicComparableText(fragment);
  return !!normalizedFragment && publicComparableText(line).includes(normalizedFragment);
}

function publicDialogueActForContext(debateBeat, score, hardPressThreshold) {
  if (debateBeat === "defense") {
    return "challengeResponse";
  }
  if (debateBeat === "nomination-pressure") {
    return "nominationPressure";
  }
  if (debateBeat === "vote-intent") {
    return "voteIntent";
  }
  return score >= hardPressThreshold ? "pressure" : "probe";
}

function debateBeatLabel(beat) {
  return {
    opening: "开场发言",
    challenge: "质询",
    defense: "回应/辩护",
    "nomination-pressure": "提名压力",
    "vote-intent": "投票意向",
  }[beat] ?? "公聊";
}

function publicDialogueEventAnchor(state, aiPlayer, options = {}) {
  const timestamp = Number.isFinite(Number(options.timestamp)) ? Number(options.timestamp) : Date.now();
  const eventId =
    options.eventId ??
    `public-${state.day ?? 0}-${aiPlayer?.id ?? "ai"}-${options.roundInDay ?? 0}-${options.orderIndex ?? 0}-${timestamp}`;
  return {
    eventId,
    timelineEntryId: eventId,
    mode: "public",
    source: options.source ?? "ai_public_discussion",
    audience: "public",
    speakerId: aiPlayer?.id ?? "",
    visibility: "public",
    day: state.day ?? 0,
    night: state.night ?? 0,
    timestamp,
    text: options.text ?? "",
  };
}

function publicPersonaPriorityFragment(persona, options = {}) {
  const highPressure = !!options.highPressure;
  if (highPressure && persona !== PERSONA_TYPES.PRESSURE && persona !== PERSONA_TYPES.SHADOW) {
    return {
      key: "persona",
      text: "说实话",
      aliases: ["说实话", "嗯", "我有点犹豫"],
      appendText: "说实话，",
      placement: "prefix",
      priority: 1,
    };
  }
  if (persona === PERSONA_TYPES.PRESSURE) {
    return {
      key: "persona",
      text: highPressure ? "我直说" : "先说清楚",
      aliases: ["先说清楚，", "我直说", "别拖", "说真的"],
      appendText: highPressure ? "我直说，" : "先说清楚，",
      placement: "prefix",
      priority: 1,
    };
  }
  if (persona === PERSONA_TYPES.SHADOW) {
    const shadowText = highPressure
      ? publicPressureVariantWithSalt(
          options.targetName ?? "",
          ["我有点在意", "我先留个心眼", "我不太放心"],
          options.salt ?? "shadow"
        )
      : "换句话说";
    return {
      key: "persona",
      text: shadowText,
      aliases: ["换句话说，", "我有点在意", "我先留个心眼", "我不太放心"],
      appendText: `${shadowText}，`,
      placement: "prefix",
      priority: 1,
    };
  }
  return {
    key: "persona",
    text: "我的意思是",
    aliases: ["我的意思是，", "嗯", "说实话", "我有点犹豫"],
    appendText: "我的意思是，",
    placement: "prefix",
    priority: 1,
  };
}

function publicPressureVariantIndex(targetName, variantCount) {
  if (variantCount <= 1) {
    return 0;
  }
  const text = `${targetName ?? ""}`;
  const seat = Number(text.match(/(\d+)/u)?.[1] ?? 0);
  if (Number.isFinite(seat) && seat > 0) {
    return seat % variantCount;
  }
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash += text.charCodeAt(index) * (index + 1);
  }
  return Math.abs(hash) % variantCount;
}

function publicPressureVariant(targetName, variants) {
  return variants[publicPressureVariantIndex(targetName, variants.length)] ?? variants[0] ?? "";
}

function publicPressureVariantWithSalt(targetName, variants, salt = "") {
  if (variants.length <= 1) {
    return variants[0] ?? "";
  }
  const text = `${targetName ?? ""}:${salt ?? ""}`;
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash += text.charCodeAt(index) * (index + 1);
  }
  return variants[Math.abs(hash) % variants.length] ?? variants[0] ?? "";
}

function publicVerificationPrefix(targetName, evidenceContext = "", mode = "direct") {
  const target = `${targetName ?? ""}`.trim() || "这个位置";
  const listenVariants = [
    `核法是先听${target}`,
    `这条先让${target}`,
    `先请${target}`,
    `核法先交给${target}来`,
  ];
  const directVariants = [
    `核法是让${target}`,
    `这条让${target}`,
    `先请${target}`,
    `核法先交给${target}来`,
  ];
  const variants = mode === "listen" ? listenVariants : directVariants;
  return publicPressureVariantWithSalt(target, variants, `${mode}:${`${evidenceContext ?? ""}`.slice(0, 96)}`);
}

function publicEvidenceSynthesisFragment(evidenceSummaries = [], targetName = "") {
  const text = (evidenceSummaries ?? []).join(" ");
  const hasIdentity = /身份|口径|昨晚信息|公开身份|信息链/.test(text);
  const hasVote = /投票|票型|票/.test(text);
  const hasPublicPressure = /公开站队|台面压力|当前压力|高压/.test(text);
  const hasNomination = /提名|上台/.test(text);
  if (hasIdentity && hasVote) {
    return publicPressureVariant(targetName, [
      "身份口径和票型一起压过来",
      "身份解释和投票线卡在同一处",
      "身份线和票型互相咬住",
    ]);
  }
  if (hasPublicPressure && hasVote) {
    return publicPressureVariant(targetName, [
      "公开站队和票型在同一方向",
      "台面压力和投票线同向",
      "公开压力和票型互相推高",
    ]);
  }
  if (hasIdentity && hasNomination) {
    return publicPressureVariant(targetName, [
      "身份口径和提名压力卡在一起",
      "身份解释和上台窗口撞在一起",
      "身份线被提名压力顶住",
    ]);
  }
  if (hasPublicPressure && hasNomination) {
    return publicPressureVariant(targetName, [
      "台面压力和提名窗口卡在一起",
      "公开压力和上台窗口连在一起",
      "台面节奏已经顶到提名口",
    ]);
  }
  return "";
}

const PUBLIC_EVIDENCE_SYNTHESIS_PHRASES = [
  "身份口径和票型一起压过来",
  "身份说法和票型一起压过来",
  "身份解释和投票线卡在同一处",
  "身份线和票型互相咬住",
  "公开站队和票型在同一方向",
  "台面压力和投票线同向",
  "公开压力和票型互相推高",
  "身份口径和提名压力卡在一起",
  "身份说法和提名压力卡在一起",
  "身份解释和上台窗口撞在一起",
  "身份线被提名压力顶住",
  "台面压力和提名窗口卡在一起",
  "公开压力和上台窗口连在一起",
  "台面节奏已经顶到提名口",
];

const PUBLIC_EVIDENCE_ANCHOR_SENTENCE_PATTERN =
  /((?:这两点合着看|我卡的是这组线索|不止一条线在指这里|桌面问题连在一起|两条线先并起来看|这组关系不能拆开看|不是单点，线索接在一起|先把这组线放到同一桌面|我先按这组矛盾追问|这里要把两边一起验|证据还薄，但两点要对|这点还没定死，先看|线索不厚，但两边要接上|先按两条弱线对账|证据不厚，先把两边接住|这组线还要补证)：([^。！？；]+)[。！？；]?)/gu;

function publicEvidenceAnchorDedupKey(text) {
  return `${text ?? ""}`.replace(/\s+/g, "").replace(/[，。！？；：、,.!?;:]+$/gu, "").trim();
}

function publicEvidenceAnchorKeysOverlap(left, right) {
  const leftKey = `${left ?? ""}`;
  const rightKey = `${right ?? ""}`;
  if (!leftKey || !rightKey) return false;
  if (leftKey === rightKey) return true;
  if (Math.min(leftKey.length, rightKey.length) < 12) return false;
  if (leftKey.startsWith(rightKey)) {
    return /[，、：,.]/u.test(leftKey[rightKey.length] ?? "");
  }
  if (rightKey.startsWith(leftKey)) {
    return /[，、：,.]/u.test(rightKey[leftKey.length] ?? "");
  }
  return false;
}

function dedupePublicEvidenceAnchorLine(line) {
  const seenBodies = [];
  const value = `${line ?? ""}`.replace(PUBLIC_EVIDENCE_ANCHOR_SENTENCE_PATTERN, (sentence, _fullAnchor, body) => {
    const key = publicEvidenceAnchorDedupKey(body);
    if (!key) {
      return sentence;
    }
    if (seenBodies.some((seenKey) => publicEvidenceAnchorKeysOverlap(seenKey, key))) {
      return "";
    }
    seenBodies.push(key);
    return sentence;
  });
  return value
    .replace(/([。！？；])\s*([。！？；])+/gu, "$1")
    .replace(/([。！？；])\s+(?=\S)/gu, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupePublicEvidenceSynthesis(line) {
  let value = `${line ?? ""}`;
  PUBLIC_EVIDENCE_SYNTHESIS_PHRASES.forEach((phrase) => {
    const first = value.indexOf(phrase);
    if (first < 0) {
      return;
    }
    let next = value.indexOf(phrase, first + phrase.length);
    while (next >= 0) {
      const before = value.slice(0, next);
      const after = value.slice(next + phrase.length).replace(/^[，；,;]\s*/u, "");
      value = `${before}${after}`;
      next = value.indexOf(phrase, first + phrase.length);
    }
  });
  return value.replace(/([，；,;])\s*\1+/gu, "$1").replace(/。\s*。/gu, "。").trim();
}

function dedupePublicEvilPlanBeforeVerification(line) {
  let value = `${line ?? ""}`;
  const planPatterns = [
    /这轮先转到[0-9]+号，因为(?:台面压力有了新变化|今天窗口不能再散|台面压力需要重新分配)/gu,
    /台面压力别只堆一处，先把[0-9]+号也拉出来对话/gu,
    /别只压一个点，先把[0-9]+号拉出来一起对话/gu,
    /压力重新分配一下，先让[0-9]+号也进台面复核/gu,
  ];
  planPatterns.forEach((pattern) => {
    const seen = new Set();
    const matches = [...value.matchAll(pattern)].map((match) => match[0]);
    matches.forEach((phrase) => {
      if (seen.has(phrase)) {
        ["核法是", "核法先交给", "这条先让", "这条让", "先请"].forEach((lead) => {
          value = value
            .replace(`${phrase}，${lead}`, lead)
            .replace(`${phrase}。${lead}`, lead);
        });
      }
      seen.add(phrase);
    });
  });
  return value.replace(/([。！？；])\s*(核法是|核法先交给|这条(?:先)?让|先请)/gu, "$1$2").trim();
}

function publicPersonaMultiEvidencePressureLine(persona, targetName, evidenceCount, score, evidenceSummaries = []) {
  const name = `${targetName ?? ""}`.trim();
  if (!name || evidenceCount < 2 || score < 0.72) {
    return "";
  }
  const synthesis = publicEvidenceSynthesisFragment(evidenceSummaries, name);
  const opening = publicPressureVariantWithSalt(
    name,
    ["这不是单点感觉", "这条线不是单点", "我不把它当单点"],
    `${persona}:${synthesis}:${evidenceCount}:${Math.round(score * 100)}`
  );
  if (persona === PERSONA_TYPES.PRESSURE) {
    const urgencyTail = publicPressureUrgencyTail(name, synthesis, evidenceCount, score);
    const actionLine = publicPressureActionLine(name, synthesis, evidenceCount, score);
    return sentenceFragment(
      synthesis
        ? `${opening}，${synthesis}，${actionLine}，${urgencyTail}`
        : `${opening}，${actionLine}，${urgencyTail}`
    );
  }
  if (persona === PERSONA_TYPES.SHADOW) {
    const shadowOpening = publicPressureVariantWithSalt(
      name,
      [`${name}这条不单看`, `${name}这条先单独记`, `${name}这条要看后续回应`],
      `${persona}:${synthesis}:shadow-target:${evidenceCount}:${Math.round(score * 100)}`
    );
    const targetLine = publicShadowTargetLine(name, synthesis, evidenceCount, score);
    return sentenceFragment(`${shadowOpening}，${targetLine}`);
  }
  return sentenceFragment(
    synthesis
      ? `${opening}，我不锁死${name}，但${synthesis}，解释要落到桌面`
      : `${opening}，我不锁死${name}，但解释要落到桌面`
  );
}

function publicPressureActionLine(targetName, synthesis = "", evidenceCount = 0, score = 0) {
  const name = `${targetName ?? ""}`.trim();
  if (!name) {
    return "";
  }
  const variants = [
    `我会先压${name}`,
    `这轮先压${name}`,
    `我会直接压${name}`,
    `先把${name}压到桌面上`,
    `${name}这边我先给压力`,
    `${name}先上压力`,
  ];
  const salt = `${synthesis}:pressure-action:${evidenceCount}:${Math.round(Number(score) * 1000)}`;
  let hash = 0;
  const hashText = `${name}:${salt}`;
  for (let index = 0; index < hashText.length; index += 1) {
    hash += hashText.charCodeAt(index) * (index + 1);
  }
  const seat = Number.parseInt(name, 10);
  const synthesisOffset = /提名|上台|提名口/u.test(synthesis)
    ? 3
    : /公开|台面压力/u.test(synthesis)
      ? 2
      : /身份|票型/u.test(synthesis)
        ? 1
        : 0;
  const offset = (Number.isFinite(seat) ? seat : 0) + Number(evidenceCount || 0) + synthesisOffset;
  return variants[Math.abs(hash + offset) % variants.length] ?? variants[0];
}

function publicShadowTargetLine(targetName, synthesis = "", evidenceCount = 0, score = 0) {
  const name = `${targetName ?? ""}`.trim();
  if (!name) {
    return "";
  }
  const roundedScore = Math.round(Number(score) * 100);
  if (synthesis) {
    return publicPressureVariantWithSalt(
      name,
      [
        `${synthesis}，${name}这条先留在主线里`,
        `${synthesis}，${name}先挂观察位，不急着放下`,
        `${synthesis}，这条先记在${name}身上，等回应对账`,
        `${synthesis}，${name}这边先留一格压力`,
        `${synthesis}，${name}先留在台面压力线上`,
      ],
      `${synthesis}:shadow-target-line:${evidenceCount}:${roundedScore}`
    );
  }
  return publicPressureVariantWithSalt(
    name,
    [
      `${name}这条先留在主线里，等回应再降压`,
      `${name}先挂观察位，看回应能不能接上`,
      `${name}这边我先不放下，回应绕就继续压`,
      `先把${name}留在压力线上，看回应有没有补实`,
      `${name}这条先记一笔，后面看他怎么接`,
    ],
    `no-synthesis:shadow-target-line:${evidenceCount}:${roundedScore}`
  );
}

function publicPressureUrgencyTail(targetName, synthesis = "", evidenceCount = 0, score = 0) {
  return publicPressureVariantWithSalt(
    targetName,
    [
      "别拖到票前才解释",
      "这轮就要先把回应补上",
      "不要等到落票前才补口径",
      "先在讨论阶段把解释说清",
      "票前再补就太晚了",
    ],
    `${synthesis}:${evidenceCount}:${Math.round(Number(score) * 100)}`
  );
}

function publicPersonaMultiEvidencePressurePriorityFragment(personaPressureLine) {
  const text = `${personaPressureLine ?? ""}`.trim();
  if (!text) {
    return null;
  }
  return {
    key: "persona-pressure",
    text,
    aliases: [
      "这不是单点感觉",
      "这条线不是单点",
      "我不把它当单点",
      "直接压",
      "留个心眼",
      "不锁死",
      "落到桌面",
      "回应有没有再绕",
      "身份口径",
      "票型",
      "投票线",
      "提名压力",
      "上台窗口",
    ],
    appendText: text,
    placement: "prefix",
    priority: 3,
  };
}

function publicScriptPressureContextLine(state, targetName, evidenceCount, score) {
  const name = `${targetName ?? ""}`.trim();
  if (!name || evidenceCount < 2 || score < 0.72) {
    return "";
  }
  if (state?.scriptId === "bmr") {
    return sentenceFragment(`BMR里死亡/保护会搅票型，先请${name}解释票型，再把身份和昨晚信息补齐`);
  }
  if (state?.scriptId === "snv") {
    return sentenceFragment(`SnV里身份线和疯狂压力要分开听，先看${name}回应，再把身份和昨晚信息补清`);
  }
  return "";
}

function publicScriptPressureContextPriorityFragment(scriptPressureLine) {
  const text = `${scriptPressureLine ?? ""}`.trim();
  if (!text) {
    return null;
  }
  return {
    key: "script-pressure",
    text,
    aliases: ["BMR里", "死亡/保护", "搅票型", "SnV里", "身份线", "疯狂压力", "分开听"],
    appendText: text,
    placement: "prefix",
    priority: 3,
  };
}

function publicTimingPressureContextLine(debateBeat, targetName, evidenceCount, score) {
  const name = `${targetName ?? ""}`.trim();
  if (!name || evidenceCount < 2 || score < 0.72) {
    return "";
  }
  if (debateBeat === "nomination-pressure") {
    return sentenceFragment(`提名前先把${name}的身份和票型压实，不然上台只剩防守`);
  }
  if (debateBeat === "vote-intent") {
    return sentenceFragment(`到投票我会看${name}有没有补出解释，没补就按压力票处理`);
  }
  return "";
}

function publicTimingPressureContextPriorityFragment(timingPressureLine) {
  const text = `${timingPressureLine ?? ""}`.trim();
  if (!text) {
    return null;
  }
  return {
    key: "timing-pressure",
    text,
    aliases: ["提名前", "压实", "上台", "到投票", "压力票", "补出解释"],
    appendText: text,
    placement: "prefix",
    priority: 5,
  };
}

function ensurePublicTimingPressureInLine(line, timingPressureLine, maxChars = 190) {
  const value = `${line ?? ""}`.trim();
  const timing = `${timingPressureLine ?? ""}`.trim();
  if (!value || !timing || publicLineIncludesFragment(value, timing) || /提名前|压实|上台|到投票|压力票|补出解释|票前/u.test(value)) {
    return value;
  }
  const joined = joinSpeechFragments([timing, value]);
  if (joined.length <= maxChars) {
    return joined;
  }
  const tailRoom = Math.max(0, maxChars - timing.length - 1);
  const tail = value.slice(0, tailRoom).replace(/[，。！？；、\s]+$/u, "").trim();
  return joinSpeechFragments([timing, tail]);
}

const PUBLIC_INFO_CLAIM_ROLE_IDS = new Set([
  "washerwoman",
  "librarian",
  "investigator",
  "chef",
  "empath",
  "fortune-teller",
  "undertaker",
  "clockmaker",
  "dreamer",
  "mathematician",
  "flowergirl",
  "town-crier",
  "oracle",
  "savant",
  "seamstress",
  "artist",
  "juggler",
  "chambermaid",
]);

const PUBLIC_OUTSIDER_CLAIM_ROLE_IDS = new Set([
  "butler",
  "drunk",
  "recluse",
  "saint",
  "tinker",
  "moonchild",
  "goon",
  "lunatic",
  "mutant",
  "sweetheart",
  "barber",
  "klutz",
]);

const PUBLIC_DEATH_TRIGGER_CLAIM_ROLE_IDS = new Set(["ravenkeeper", "sage", "moonchild", "klutz"]);
const PUBLIC_PROTECTION_CLAIM_ROLE_IDS = new Set(["monk", "sailor", "innkeeper", "tea-lady", "pacifist", "fool"]);
const PUBLIC_ACTION_CLAIM_ROLE_IDS = new Set(["slayer", "virgin", "gossip", "professor", "exorcist"]);

function latestPublicClaimForTarget(state, targetId) {
  if (!targetId || !Array.isArray(state?.events?.claims)) {
    return null;
  }
  return [...state.events.claims]
    .reverse()
    .find((claim) => claim?.playerId === targetId && claim?.roleId && !claim?.private) ?? null;
}

function publicRolePressureMode(roleId) {
  if (PUBLIC_DEATH_TRIGGER_CLAIM_ROLE_IDS.has(roleId)) {
    return "death-trigger";
  }
  if (PUBLIC_PROTECTION_CLAIM_ROLE_IDS.has(roleId)) {
    return "protection";
  }
  if (PUBLIC_ACTION_CLAIM_ROLE_IDS.has(roleId)) {
    return "public-action";
  }
  if (PUBLIC_OUTSIDER_CLAIM_ROLE_IDS.has(roleId)) {
    return "outsider-risk";
  }
  if (PUBLIC_INFO_CLAIM_ROLE_IDS.has(roleId)) {
    return "info-claim";
  }
  return "";
}

function publicRolePressureContextLine(state, targetName, targetId, evidenceCount, score, evidenceSummaries = []) {
  const name = `${targetName ?? ""}`.trim();
  if (!name || evidenceCount < 2 || score < 0.72) {
    return "";
  }
  const claim = latestPublicClaimForTarget(state, targetId);
  const roleId = claim?.roleId ?? "";
  const roleName = roleNameById(state, roleId);
  const mode = publicRolePressureMode(roleId);
  if (!roleName || !mode) {
    return "";
  }
  const evidenceText = (evidenceSummaries ?? []).join(" ");
  const claimNominationSynthesis =
    /提名|上台|被推上台面/.test(evidenceText) && !/投票|票型/.test(evidenceText)
      ? publicPressureVariant(name, [
          "身份口径和提名压力卡在一起",
          "身份解释和上台窗口撞在一起",
          "身份线被提名压力顶住",
        ])
      : "";
  const synthesis = claimNominationSynthesis || publicEvidenceSynthesisFragment(evidenceSummaries, name);
  const synthesisPrefix = synthesis ? `${synthesis}；` : "";
  if (mode === "death-trigger") {
    return sentenceFragment(`${synthesisPrefix}既然${name}报${roleName}，死亡触发和死后信息要先讲清，不然身份会挡掉压力`);
  }
  if (mode === "protection") {
    return sentenceFragment(`${synthesisPrefix}既然${name}报${roleName}，保护口径要和昨晚死亡对上，别把保护当免票`);
  }
  if (mode === "public-action") {
    return sentenceFragment(`${synthesisPrefix}既然${name}报${roleName}，行动窗口和目标结果要讲清，不能只把能力牌挂出来`);
  }
  if (mode === "outsider-risk") {
    return sentenceFragment(`${synthesisPrefix}既然${name}报${roleName}，风险边界要说清，不能只靠外来者身份挡压`);
  }
  return sentenceFragment(`${synthesisPrefix}既然${name}报${roleName}，信息链就要和票型对上，不能只给身份名`);
}

function publicRolePressureContextPriorityFragment(rolePressureLine) {
  const text = `${rolePressureLine ?? ""}`.trim();
  if (!text) {
    return null;
  }
  return {
    key: "role-pressure",
    text,
    aliases: [
      "既然",
      "信息链",
      "风险边界",
      "死亡触发",
      "保护口径",
      "行动窗口",
      "目标结果",
      "能力牌",
      "身份挡压",
      "不能只给身份名",
    ],
    appendText: text,
    placement: "prefix",
    priority: 6,
  };
}

function ensurePublicRolePressureInLine(line, rolePressureLine, maxChars = 190) {
  const value = `${line ?? ""}`.trim();
  const rolePressure = `${rolePressureLine ?? ""}`.trim();
  if (
    !value ||
    !rolePressure ||
    publicLineIncludesFragment(value, rolePressure) ||
    /信息链|风险边界|外来者身份|死亡触发|死后信息|保护口径|保护说法|免票|行动窗口|目标结果|能力牌|身份挡压|不能只给身份名/u.test(value)
  ) {
    return value;
  }
  const joined = joinSpeechFragments([rolePressure, value]);
  if (joined.length <= maxChars) {
    return joined;
  }
  const tailRoom = Math.max(0, maxChars - rolePressure.length - 1);
  const tail = value.slice(0, tailRoom).replace(/[，。！？；、\s]+$/u, "").trim();
  return joinSpeechFragments([rolePressure, tail]);
}

function publicCrossDayStanceLineForComposed(state, aiPlayer, composed) {
  const crossDay = composed?.crossDayStance;
  const targetId = composed?.focusId ?? crossDay?.targetId ?? "";
  if (!crossDay || !targetId || !crossDayStanceContinuityLine) {
    return "";
  }
  const targetName = statementTargetLabel ? statementTargetLabel(state, targetId) : "";
  return crossDayStanceContinuityLine(
    state,
    aiPlayer,
    targetId,
    {
      stance: crossDay.currentStance,
      crossDayStance: crossDay,
    },
    {
      targetName,
      compact: true,
    }
  );
}

function ensurePublicCrossDayStanceInLine(line, crossDayLine, maxChars = 190) {
  const value = `${line ?? ""}`.trim();
  const continuity = `${crossDayLine ?? ""}`.trim();
  if (!value || !continuity || publicLineIncludesFragment(value, continuity) || /昨天|天前|今天转|今天证据量|证据量没少|比昨天/u.test(value)) {
    return value;
  }
  const joined = joinSpeechFragments([continuity, value]);
  if (joined.length <= maxChars) {
    return joined;
  }
  const tailRoom = Math.max(0, maxChars - continuity.length - 1);
  const tail = value.slice(0, tailRoom).replace(/[，。！？；、\s]+$/u, "").trim();
  return joinSpeechFragments([continuity, tail]);
}

function ensurePublicTargetSwitchInLine(line, targetSwitchLine, maxChars = 190) {
  const value = `${line ?? ""}`.trim();
  const targetSwitch = `${targetSwitchLine ?? ""}`.trim();
  if (!value || !targetSwitch || publicLineIncludesFragment(value, targetSwitch) || /昨天主线|今天先转|不等于放掉/u.test(value)) {
    return value;
  }
  const joined = joinSpeechFragments([targetSwitch, value]);
  if (joined.length <= maxChars) {
    return joined;
  }
  const tailRoom = Math.max(0, maxChars - targetSwitch.length - 1);
  const tail = value.slice(0, tailRoom).replace(/[，。！？；、\s]+$/u, "").trim();
  return joinSpeechFragments([targetSwitch, tail]);
}

function ensurePublicScriptPressureInLine(line, scriptPressureLine, maxChars = 190) {
  const value = `${line ?? ""}`.trim();
  const scriptPressure = `${scriptPressureLine ?? ""}`.trim();
  if (!value || !scriptPressure || publicLineIncludesFragment(value, scriptPressure) || /BMR里|SnV里|死亡\/保护|疯狂压力/u.test(value)) {
    return value;
  }
  const joined = joinSpeechFragments([value, scriptPressure]);
  if (joined.length <= maxChars) {
    return joined;
  }
  const headRoom = Math.max(0, maxChars - scriptPressure.length - 1);
  const head = value.slice(0, headRoom).replace(/[，。！？；、\s]+$/u, "").trim();
  return joinSpeechFragments([head, scriptPressure]);
}

function publicEvilCoverPriorityFragment(aiPlayer) {
  if (aiPlayer?.team !== "evil") {
    return null;
  }
  return {
    key: "evil-cover",
    text: "台面上",
    aliases: ["台面上", "公开说", "好人视角", "节奏", "解围", "闭眼冲", "台面理由"],
    appendText: "台面上，",
    placement: "prefix",
    priority: 3,
  };
}

function sentenceFragment(text) {
  const value = `${text ?? ""}`.trim();
  if (!value) {
    return "";
  }
  return /[。！？；]$/u.test(value) ? value : `${value}。`;
}

function publicEvidenceSynthesisVerificationText(targetName, evidenceContext = "", mode = "direct") {
  const target = `${targetName ?? ""}`.trim() || "这个位置";
  const context = `${evidenceContext ?? ""}`;
  if (/身份(?:说法|口径)和票型一起压过来|身份解释和投票线卡在同一处|身份线和票型互相咬住/.test(context)) {
    return publicFollowUpActionText(target, context, mode, "identity-vote");
  }
  if (/公开站队和票型在同一方向|台面压力和投票线同向|公开压力和票型互相推高/.test(context)) {
    return publicFollowUpActionText(target, context, mode, "pressure-vote");
  }
  if (/身份(?:说法|口径)和提名压力卡在一起|身份解释和上台窗口撞在一起|身份线被提名压力顶住/.test(context)) {
    return publicFollowUpActionText(target, context, mode, "identity-nomination");
  }
  if (/台面压力和提名窗口卡在一起|公开压力和上台窗口连在一起|台面节奏已经顶到提名口/.test(context)) {
    return publicFollowUpActionText(target, context, mode, "pressure-nomination");
  }
  return "";
}

function publicFollowUpActionText(targetName, evidenceContext = "", mode = "direct", actionKey = "unclear") {
  const target = `${targetName ?? ""}`.trim() || "这个位置";
  const context = `${evidenceContext ?? ""}`;
  const prefix = publicVerificationPrefix(target, context, mode);
  const variantsByAction = {
    "identity-vote": [
      "把身份和票型对上，再解释投票理由",
      "把身份和票型对齐，再补投票理由",
      "把身份和票型对上，投票理由也要补清",
    ],
    "pressure-vote": [
      "解释票型为什么跟台面压力同向，再补身份和昨晚信息",
      "先解释票型和台面压力为什么同向，再把身份和昨晚信息补齐",
      "把票型和台面压力的关系讲清，身份和昨晚信息也要补清",
      "解释票型和台面压力的关系，昨晚信息也要说完整",
    ],
    "identity-nomination": [
      "把身份对上，再说明提名压力怎么解",
      "把身份口径对齐，再说明提名压力怎么解",
      "把身份对上，再回应提名压力怎么解",
    ],
    "pressure-nomination": [
      "把没讲清的点补清，再说明为什么进提名压力",
      "把没讲清的点补上，再解释提名压力",
      "把台面压力讲清，再说明为什么进提名压力",
    ],
    vote: [
      "解释票型，再补身份和昨晚信息",
      "先解释票型，再把身份和昨晚信息补齐",
      "把票型解释清，身份和昨晚信息也要补清",
      "解释票型，昨晚信息和身份口径也要补清",
    ],
    identity: [
      "把身份对上，再补昨晚信息",
      "把身份对上，再把昨晚信息说完整",
      "把身份对上，昨晚信息也要补清",
      "把身份口径对齐，昨晚信息也要说完整",
      "把身份落到桌面，昨晚信息也要说完整",
    ],
    unclear: [
      "把没讲清的点补清，再说昨晚信息",
      "把没讲清的点补清，再把昨晚信息说完整",
      "把没讲清的点补上，昨晚信息也要补清",
      "把没讲清的点补上，昨晚信息也要说完整",
      "把没讲清的点补清，昨晚信息也要说完整",
    ],
    "evidence-position": [
      "解释为什么压低证据位，再补昨晚信息",
      "解释压低证据位的理由，再把昨晚信息说完整",
      "说明为什么压低证据位，昨晚信息也要补清",
      "压低证据位这点先讲清，昨晚信息也要补清",
      "解释压低证据位的理由，昨晚信息也要说完整",
    ],
  };
  const variants = variantsByAction[actionKey] ?? variantsByAction.unclear;
  const action = publicPressureVariantWithSalt(target, variants, `${actionKey}:${mode}:${context.slice(0, 96)}`);
  return `${prefix}${action}`;
}

function publicSpecificFollowUpQuestionText(targetName, evidenceContext = "", mode = "direct") {
  const target = `${targetName ?? ""}`.trim() || "这个位置";
  const context = `${evidenceContext ?? ""}`;
  const synthesisVerification = publicEvidenceSynthesisVerificationText(target, context, mode);
  if (synthesisVerification) {
    return synthesisVerification;
  }
  if (/投票|票型/.test(context)) {
    return publicFollowUpActionText(target, context, mode, "vote");
  }
  if (/身份对不上|身份解释|身份线|公开身份/.test(context)) {
    return publicFollowUpActionText(target, context, mode, "identity");
  }
  if (/前面发言没讲清楚|没讲清/.test(context)) {
    return publicFollowUpActionText(target, context, mode, "unclear");
  }
  if (/推低证据位|压低证据位|证据位/.test(context)) {
    return publicFollowUpActionText(target, context, mode, "evidence-position");
  }
  return publicFollowUpActionText(target, context, mode, "unclear");
}

function publicSpecificFollowUpQuestionFragment(questionToAsk, targetName, evidenceContext = "") {
  const question = `${questionToAsk ?? ""}`.replace(/\s+/g, " ").trim();
  if (!question) {
    return "";
  }
  if (!/身份和昨晚信息/.test(question) || /解释票型|把身份对上|把没讲清的点补清|解释为什么压低证据位/.test(question)) {
    return sentenceFragment(question);
  }
  const target = `${targetName ?? ""}`.trim() || question.match(/([0-9]+号)/u)?.[1] || "这个位置";
  return sentenceFragment(publicSpecificFollowUpQuestionText(target, evidenceContext));
}

function escapeRegExp(text) {
  return `${text ?? ""}`.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function specializePublicSpecificFollowUpInLine(line, targetName) {
  const target = `${targetName ?? ""}`.trim();
  if (!target) {
    return `${line ?? ""}`;
  }
  const targetPattern = escapeRegExp(target);
  const boundary = "(^|[，。！？；,;\\s])";
  return `${line ?? ""}`
    .replace(new RegExp(`${targetPattern}先补身份和昨晚信息`, "g"), (match, offset, fullText) =>
      publicSpecificFollowUpQuestionText(target, fullText.slice(0, offset))
    )
    .replace(new RegExp(`先听${targetPattern}补身份和昨晚信息`, "g"), (match, offset, fullText) =>
      publicSpecificFollowUpQuestionText(target, fullText.slice(0, offset), "listen")
    )
    .replace(new RegExp(`让\\s*${targetPattern}\\s*把身份和昨晚信息说清楚`, "g"), (match, offset, fullText) =>
      publicSpecificFollowUpQuestionText(target, fullText.slice(0, offset))
    )
    .replace(new RegExp(`接下来先问\\s*${targetPattern}\\s*：\\s*身份和昨晚信息`, "g"), (match, offset, fullText) =>
      publicSpecificFollowUpQuestionText(target, fullText.slice(0, offset), "listen")
    )
    .replace(new RegExp(`${boundary}先听${targetPattern}解释票型，再补身份和昨晚信息`, "g"), (_match, lead, offset, fullText) =>
      `${lead}${publicSpecificFollowUpQuestionText(target, fullText.slice(0, offset), "listen")}`
    )
    .replace(new RegExp(`${boundary}${targetPattern}解释票型，再补身份和昨晚信息`, "g"), (_match, lead, offset, fullText) =>
      `${lead}${publicSpecificFollowUpQuestionText(target, fullText.slice(0, offset))}`
    )
    .replace(new RegExp(`${boundary}先听${targetPattern}把身份对上，再补昨晚信息`, "g"), (_match, lead, offset, fullText) =>
      `${lead}${publicSpecificFollowUpQuestionText(target, fullText.slice(0, offset), "listen")}`
    )
    .replace(new RegExp(`${boundary}${targetPattern}把身份对上，再补昨晚信息`, "g"), (_match, lead, offset, fullText) =>
      `${lead}${publicSpecificFollowUpQuestionText(target, fullText.slice(0, offset))}`
    )
    .replace(new RegExp(`${boundary}先听${targetPattern}把没讲清的点补清，再说昨晚信息`, "g"), (_match, lead, offset, fullText) =>
      `${lead}${publicSpecificFollowUpQuestionText(target, fullText.slice(0, offset), "listen")}`
    )
    .replace(new RegExp(`${boundary}${targetPattern}把没讲清的点补清，再说昨晚信息`, "g"), (_match, lead, offset, fullText) =>
      `${lead}${publicSpecificFollowUpQuestionText(target, fullText.slice(0, offset))}`
    )
    .replace(new RegExp(`${boundary}先听${targetPattern}解释为什么压低证据位，再补昨晚信息`, "g"), (_match, lead, offset, fullText) =>
      `${lead}${publicSpecificFollowUpQuestionText(target, fullText.slice(0, offset), "listen")}`
    )
    .replace(new RegExp(`${boundary}${targetPattern}解释为什么压低证据位，再补昨晚信息`, "g"), (_match, lead, offset, fullText) =>
      `${lead}${publicSpecificFollowUpQuestionText(target, fullText.slice(0, offset))}`
    );
}

function recentEvilPivotForTarget(plan, targetId) {
  if (!plan || !targetId) {
    return null;
  }
  const history = Array.isArray(plan.history) ? plan.history : [];
  return [...history]
    .reverse()
    .find((entry) => entry?.framingTargetId === targetId && entry?.pivotReason) ?? null;
}

function publicEvilPivotLine(strategyContext) {
  const targetId = strategyContext?.target?.id ?? "";
  const targetName = strategyContext?.target?.name ?? "这个位置";
  const pivot = recentEvilPivotForTarget(strategyContext?.evilWorldPlan, targetId);
  if (!pivot) {
    return "";
  }
  if (pivot.pivotReason === "protect-ally") {
    return sentenceFragment(`这轮先转到 ${targetName}，因为台面压力需要重新分配`);
  }
  if (pivot.pivotReason === "late-window") {
    return sentenceFragment(`这轮先转到 ${targetName}，因为今天窗口不能再散`);
  }
  return sentenceFragment(`这轮先转到 ${targetName}，因为台面压力有了新变化`);
}

function publicEvilProtectAllyLine(strategyContext, options = {}) {
  const plan = strategyContext?.evilWorldPlan;
  const targetId = strategyContext?.target?.id ?? "";
  if (plan?.mode !== "protect-ally" || !targetId || plan.framingTargetId !== targetId) {
    return "";
  }
  const targetName = strategyContext?.target?.name ?? "这个位置";
  return sentenceFragment(
    publicPressureVariantWithSalt(targetName, [
      `台面压力别只堆一处，先把 ${targetName} 也拉出来对话`,
      `别只压一个点，先把 ${targetName} 拉出来一起对话`,
      `压力重新分配一下，先让 ${targetName} 也进台面复核`,
    ], `${options.salt ?? ""}:${strategyContext?.evilPlanContextLine ?? ""}`)
  );
}

function publicEvilPlanLine(aiPlayer, strategyContext, options = {}) {
  if (aiPlayer?.team !== "evil" || !strategyContext?.evilPlanContextLine) {
    return "";
  }
  const plan = strategyContext.evilWorldPlan;
  const hasPriorPublicLine = !!options.hasPriorPublicLine;
  const protectLine = !hasPriorPublicLine ? publicEvilProtectAllyLine(strategyContext, options) : "";
  if (protectLine) {
    return protectLine;
  }
  const pivotLine = !hasPriorPublicLine ? publicEvilPivotLine(strategyContext) : "";
  if (pivotLine) {
    return pivotLine;
  }
  const shouldSurface =
    (plan?.continuity === "hold" && hasPriorPublicLine) ||
    (!!plan?.pivotReason && (hasPriorPublicLine || !!plan?.previousFramingTargetId)) ||
    (!!strategyContext.target?.id && plan?.secondaryFrameTargetId === strategyContext.target.id);
  return shouldSurface ? sentenceFragment(strategyContext.evilPlanContextLine) : "";
}

function publicEvilPlanPriorityFragment(planLine) {
  const text = `${planLine ?? ""}`.trim();
  if (!text) {
    return null;
  }
  return {
    key: "evil-plan-continuity",
    text,
    aliases: ["还是沿着", "不急着换线", "这轮先转到", "台面压力有了新变化", "备选压力位"],
    appendText: text,
    placement: "prefix",
    priority: 3,
  };
}

function hasPriorPublicClaimForPlayer(state, aiPlayer) {
  return !!latestPublicClaimForPlayer(state, aiPlayer);
}

function latestPublicClaimForPlayer(state, aiPlayer) {
  const roleId = aiPlayer?.publicClaimRoleId ?? "";
  if (!state || !aiPlayer?.id || !roleId) {
    return null;
  }
  return [...(state.events?.claims ?? [])]
    .reverse()
    .find((claim) => claim?.playerId === aiPlayer.id && claim?.roleId === roleId && !claim?.private) ?? null;
}

function publicClaimAgeDays(state, claim) {
  if (!claim) {
    return 0;
  }
  return Math.max(0, Number(state?.day ?? 1) - Number(claim.day ?? state?.day ?? 1));
}

function publicEvilClaimCoverLine(state, aiPlayer, options = {}) {
  if (aiPlayer?.team !== "evil" || !aiPlayer.publicClaimRoleId || !options.hasPriorPublicClaim) {
    return "";
  }
  const roleName = roleNameById(state, aiPlayer.publicClaimRoleId);
  if (!roleName) {
    return "";
  }
  const isCrossDayClaim = (options.priorClaimAgeDays ?? 0) > 0;
  const targetName = `${options.targetName ?? ""}`.trim();
  const hasPriorTargetLine = !!options.hasPriorPublicLineForFocus && !!targetName;
  if (isCrossDayClaim && options.isProtectAlly && options.isPivot) {
    if (hasPriorTargetLine) {
      return sentenceFragment(`昨天已经转到${targetName}这条，今天压力和目标可以重新分配，公开身份仍按${roleName}这条说`);
    }
    return sentenceFragment(`昨天身份线我不改，今天目标和压力可以重新分配，公开身份仍按${roleName}这条说`);
  }
  if (isCrossDayClaim && options.isProtectAlly) {
    if (hasPriorTargetLine) {
      return sentenceFragment(`昨天已经盯过${targetName}这条，今天压力可以分散，公开身份仍按${roleName}这条说`);
    }
    return sentenceFragment(`昨天身份线我不改，今天压力可以分散，公开身份仍按${roleName}这条说`);
  }
  if (isCrossDayClaim && options.isPivot) {
    if (hasPriorTargetLine) {
      return sentenceFragment(`昨天已经转到${targetName}这条，今天目标继续看，公开身份仍按${roleName}这条说`);
    }
    return sentenceFragment(`昨天身份线我不改，今天目标可以转，公开身份仍按${roleName}这条说`);
  }
  if (options.isProtectAlly) {
    return sentenceFragment(`压力可以分散，公开身份我仍按${roleName}这条说，先看信息口径和票型怎么对`);
  }
  if (options.isPivot) {
    return sentenceFragment(`目标可以转，公开身份我仍按${roleName}这条说，先看信息口径和票型怎么对`);
  }
  if (isCrossDayClaim) {
    if (hasPriorTargetLine) {
      return sentenceFragment(`昨天已经盯过${targetName}这条，公开身份仍按${roleName}这条说，今天继续看信息口径和票型`);
    }
    return sentenceFragment(`昨天身份线我不改，公开身份仍按${roleName}这条说，今天继续看信息口径和票型`);
  }
  return sentenceFragment(`公开身份我仍按${roleName}这条说，今天先看信息口径和票型怎么对`);
}

function publicEvilClaimCoverPriorityFragment(claimCoverLine) {
  const text = `${claimCoverLine ?? ""}`.trim();
  if (!text) {
    return null;
  }
  return {
    key: "evil-claim-cover",
    text,
    aliases: ["公开身份", "仍按", "信息口径", "票型", "这条说", "目标可以转", "压力可以分散", "昨天身份线"],
    appendText: text,
    placement: "prefix",
    priority: 3,
  };
}

function publicClaimDisclosureSpeechLine(rationale, fallbackLine = "") {
  return `${rationale?.continuityLine || rationale?.line || rationale?.spokenLine || fallbackLine || ""}`
    .replace(/\s+/g, " ")
    .trim();
}

function ensurePublicClaimDisclosureInLine(line, rationale, fallbackLine = "", maxChars = 230) {
  const value = `${line ?? ""}`.replace(/\s+/g, " ").trim();
  const disclosureLine = publicClaimDisclosureSpeechLine(rationale, fallbackLine);
  if (!value || !disclosureLine || publicLineIncludesFragment(value, disclosureLine)) {
    return value;
  }
  const joined = joinSpeechFragments([disclosureLine, value]);
  return joined.length <= maxChars ? joined : value;
}

function ensureTargetMentionInPublicLine(line, targetName, maxChars = 160) {
  const value = `${line ?? ""}`.replace(/\s+/g, " ").trim();
  const target = `${targetName ?? ""}`.replace(/\s+/g, " ").trim();
  if (!value || !target) {
    return value;
  }

  const directed = value
    .replace(/接下来先问你/g, `接下来先问${target}`)
    .replace(/我会问你/g, `我会问${target}`)
    .replace(/问你：/g, `问${target}：`)
    .replace(/提名前先看\s+你：/g, `提名前先看 ${target}：`);
  if (directed !== value && directed.includes(target)) {
    return directed;
  }
  if (value.includes(target)) {
    return value;
  }

  const sentences = value.match(/[^。！？；]+[。！？；]?/gu)?.map((entry) => entry.trim()).filter(Boolean) ?? [];
  const tableStateLead = sentences.find((entry) =>
    /(我已经死了|我现在在台上|票型你们自己看|能验证的部分|我知道我自己也有压力|到这个天数|需要马上听回应)/.test(entry)
  ) ?? "";
  if (tableStateLead) {
    const evidence =
      sentences.find((entry) => /(我卡的点|我过不去的是|这点还不够|我卡在这儿|现在还不够)/.test(entry)) ??
      sentences.find((entry) => entry !== tableStateLead) ??
      "";
    const cleanEvidence = evidence
      .replace(/^我的意思是，?/, "")
      .replace(/^(我卡的点|我过不去的是|这点还不够|我卡在这儿|现在还不够)：?/, "")
      .replace(/，?接下来先问你.*/, "")
      .replace(/[。！？；]+$/u, "")
      .trim();
    const targetSentence = cleanEvidence
      ? `${target}这边，${cleanEvidence}。`
      : `${target}这边先听回应。`;
    const compact = joinSpeechFragments([tableStateLead, targetSentence]);
    return compact.length <= maxChars ? compact : joinSpeechFragments([tableStateLead, `${target}这边先听回应。`]);
  }

  if (sentences.length >= 2) {
    const opener = sentences.find((entry) => /身份|先跳|公开|我是/.test(entry)) ?? "";
    const evidence =
      sentences.find((entry) => /(我卡的点|我过不去的是|这点还不够|我卡在这儿|现在还不够)/.test(entry)) ??
      sentences.find((entry) => entry !== opener) ??
      "";
    const cleanEvidence = evidence
      .replace(/^我的意思是，?/, "")
      .replace(/^(我卡的点|我过不去的是|这点还不够|我卡在这儿|现在还不够)：?/, "")
      .replace(/，?接下来先问你.*/, "")
      .replace(/[。！？；]+$/u, "")
      .trim();
    const targetSentence = cleanEvidence
      ? `${target}这边，${cleanEvidence}。`
      : `${target}这边先听回应。`;
    const compact = opener ? joinSpeechFragments([opener, targetSentence]) : targetSentence;
    if (compact.length <= maxChars) {
      return compact;
    }
  }

  const targetLine = `${target}这边先听回应。`;
  const joined = joinSpeechFragments([value, targetLine]);
  if (joined.length <= maxChars) {
    return joined;
  }

  const opener = sentences.find((entry) => /身份|先跳|公开|我是/.test(entry)) ?? "";
  const next = sentences.find((entry) => entry !== opener) ?? "先听回应。";
  const compact = opener
    ? joinSpeechFragments([opener, `${target}这边，${next}`])
    : `${target}这边，${value}`;
  return compact.length <= maxChars ? compact : targetLine;
}

function publicFollowUpActionTags(sentence) {
  const value = `${sentence ?? ""}`;
  const tags = [];
  if (/没讲清|补清|补上|讲清|说清|解释清|回应/u.test(value)) tags.push("clarify");
  if (/昨晚信息|夜间信息|信息/u.test(value)) tags.push("night-info");
  if (/身份|身份说法|报身份/u.test(value)) tags.push("identity");
  if (/票型|投票|跟票|反票/u.test(value)) tags.push("vote");
  if (/提名|上台/u.test(value)) tags.push("nomination");
  return [...new Set(tags)];
}

function publicTagOverlap(left = [], right = []) {
  const rightSet = new Set(right);
  return left.filter((tag) => rightSet.has(tag)).length;
}

function dedupePublicTargetFollowUps(line, targetName) {
  const value = `${line ?? ""}`.replace(/\s+/g, " ").trim();
  const target = `${targetName ?? ""}`.trim();
  if (!value || !target) {
    return value;
  }
  const sentences = value.match(/[^。！？；]+[。！？；]?/gu)?.map((entry) => entry.trim()).filter(Boolean) ?? [value];
  const seen = [];
  const kept = [];
  sentences.forEach((sentence) => {
    const tags = publicFollowUpActionTags(sentence);
    const isFollowUp = sentence.includes(target) && /(先请|这条(?:先)?让|核法|追问|我会问|票前我会问|接下来|下一步|把|解释|回应)/u.test(sentence);
    const duplicate = isFollowUp && tags.length > 0 && seen.some((entry) =>
      entry.target === target &&
      publicTagOverlap(tags, entry.tags) >= Math.min(2, tags.length, entry.tags.length)
    );
    if (!duplicate) {
      kept.push(sentence);
    }
    if (isFollowUp && tags.length > 0) {
      seen.push({ target, tags });
    }
  });
  return kept.join("").replace(/([。！？；])\s+(?=\S)/gu, "$1").trim();
}

function compactPublicLineBySentences(line, targetName, maxChars) {
  const value = `${line ?? ""}`.replace(/\s+/g, " ").trim();
  if (!value || value.length <= maxChars) {
    return value;
  }
  const target = `${targetName ?? ""}`.trim();
  const sentences = value.match(/[^。！？；]+[。！？；]?/gu)?.map((entry) => entry.trim()).filter(Boolean) ?? [value];
  const claimSentence = sentences.find((entry) => /公开身份|我是|身份范围|身份暂时|身份先|不说死/u.test(entry)) ?? "";
  const targetActionSentence = sentences.find((entry) =>
    target &&
    entry.includes(target) &&
    /(先请|这条(?:先)?让|把|解释|回应|昨晚信息|身份|票型|讲清|补清)/u.test(entry)
  ) ?? "";
  const evidenceSentence = sentences.find((entry) =>
    target &&
    entry.includes(target) &&
    /(卡在|理由|可见记录|台面理由|我先排|我卡|这点|压力|线索)/u.test(entry)
  ) ?? "";
  const fallbackTargetSentence = target ? `${target}先把没讲清的点补清。` : "";
  const candidates = [
    [claimSentence, targetActionSentence],
    [evidenceSentence, targetActionSentence],
    [claimSentence, evidenceSentence],
    [sentences[0], targetActionSentence || fallbackTargetSentence],
    [targetActionSentence || fallbackTargetSentence],
  ];
  for (const parts of candidates) {
    const compact = joinSpeechFragments(parts.filter(Boolean));
    if (compact && compact.length <= maxChars && (!target || compact.includes(target))) {
      return compact;
    }
  }
  const mustKeep = targetActionSentence || fallbackTargetSentence || sentences.find((entry) => !target || entry.includes(target)) || value;
  const clipped = mustKeep.length <= maxChars
    ? mustKeep
    : `${mustKeep.slice(0, Math.max(0, maxChars - 1)).replace(/[，。！？；、\s]+$/u, "").trim()}…`;
  return target && !clipped.includes(target) ? `${target}这边先听回应。` : clipped;
}

function escapeRegexLiteral(text) {
  return `${text ?? ""}`.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function repairDanglingPublicTargetMention(line, targetName) {
  const value = `${line ?? ""}`.replace(/\s+/g, " ").trim();
  const target = `${targetName ?? ""}`.trim();
  if (!value || !target) {
    return value;
  }
  const targetPattern = new RegExp(`(^|[。！？；])\\s*${escapeRegexLiteral(target)}\\s*([。！？；])`, "gu");
  return value.replace(targetPattern, (_match, lead, punct) => `${lead}${target}这边先听回应${punct}`);
}

function repairMissingPublicTargetMention(line, targetName, maxChars) {
  const value = `${line ?? ""}`.replace(/\s+/g, " ").trim();
  const target = `${targetName ?? ""}`.trim();
  if (!value || !target || value.includes(target)) {
    return value;
  }
  const direct = value
    .replace(/^这点还不够：公开信息还不够，先听回应和票型。?$/u, `${target}这边公开信息还不够，先听回应和票型。`)
    .replace(/^公开信息还不够，先听回应和票型。?$/u, `${target}这边公开信息还不够，先听回应和票型。`);
  if (direct !== value && direct.length <= maxChars) {
    return direct;
  }
  return ensureTargetMentionInPublicLine(value, target, maxChars);
}

function dedupeGenericPublicTargetAppend(line, targetName) {
  const value = `${line ?? ""}`.replace(/\s+/g, " ").trim();
  const target = `${targetName ?? ""}`.trim();
  if (!value) {
    return value;
  }
  const genericInfo = "公开信息还不够，先听回应和票型";
  let compact = value.replace(
    new RegExp(`^(?:这点还不够：)?${genericInfo}。\\s*([0-9]+号)这边，?${genericInfo}。?$`, "u"),
    `$1这边${genericInfo}。`
  );
  if (target) {
    const targetPattern = escapeRegexLiteral(target);
    compact = compact.replace(
      new RegExp(`^(?:这点还不够：)?${genericInfo}。\\s*${targetPattern}这边，?${genericInfo}。?$`, "u"),
      `${target}这边${genericInfo}。`
    );
  }
  return compact;
}

function compactFinalPublicLine(line, {
  aiPlayer = null,
  targetName = "",
  evidenceContract = null,
  thoughtFrame = null,
  timingPressureLine = "",
  rolePressureLine = "",
} = {}) {
  const maxChars = aiPlayer?.alive === false ? 185 : 140;
  const maxSentences = aiPlayer?.alive === false ? 3 : 2;
  const target = `${targetName ?? ""}`.trim();
  let value = polishPublicLineSurface(dedupePublicTargetFollowUps(dedupePublicEvidenceSynthesis(`${line ?? ""}`), target));
  if (applySpeechBudget) {
    value = applySpeechBudget(value, {
      audience: "public",
      maxSentences,
      maxChars,
      minPriorityFragments: target ? 1 : 0,
      priorityFragments: [
        { key: "target", text: target, appendText: target ? `${target}这边先听回应。` : "", priority: 4 },
        evidenceContract?.spokenText
          ? {
              key: "evidence",
              text: evidenceContract.spokenText,
              appendText: publicEvidenceAnchorLine(evidenceContract),
              priority: 3,
            }
          : null,
        thoughtFrame?.questionToAsk
          ? {
              key: "question",
              text: thoughtFrame.questionToAsk,
              appendText: publicSpecificFollowUpQuestionFragment(thoughtFrame.questionToAsk, target, value),
              priority: 2,
            }
          : null,
        timingPressureLine
          ? publicTimingPressureContextPriorityFragment(timingPressureLine)
          : null,
        rolePressureLine
          ? publicRolePressureContextPriorityFragment(rolePressureLine)
          : null,
      ],
    });
  }
  value = dedupeGenericPublicTargetAppend(
    repairDanglingPublicTargetMention(polishPublicLineSurface(dedupePublicTargetFollowUps(value, target)), target),
    target
  );
  if (target && !value.includes(target)) {
    value = repairDanglingPublicTargetMention(repairMissingPublicTargetMention(value, target, maxChars), target);
  }
  return compactPublicLineBySentences(value, target, maxChars);
}

function conversationClockLabel(clock) {
  return {
    opening: "开场",
    response: "回应",
    crossfire: "交锋",
    "nomination-ready": "提名压力",
    cooldown: "冷却",
  }[clock] ?? "公聊";
}

function applyDebateBeatTone(line, beat, focusName, rng = Math.random) {
  const safeFocus = focusName || "这个位置";
  const prefix = pickCorpusTemplate(
    `public.debateBeat.${beat}`,
    { focusName: safeFocus },
    rng,
    [""]
  );
  return prefix ? `${prefix}${line}` : line;
}

function composePublicLine(state, aiPlayer, roundInDay, rng = Math.random, options = {}) {
  const agentView =
    options.agentView ?? buildAgentView(state, aiPlayer, { audience: "public" });
  const thoughtFrame =
    options.thoughtFrame ?? buildAIThoughtFrame(state, aiPlayer, {
      agentView,
      audience: "public",
      roundInDay,
      rng,
    });
  const ranked = rankTargets(aiPlayer, state, 3, { publicOnly: true, audience: "public" });
  const forcedFocusPlayer = options.forcedFocusId
    ? state.players.find((entry) => entry.id === options.forcedFocusId)
    : null;
  const forcedCandidate = forcedFocusPlayer
    ? ranked.find((entry) => entry.player.id === forcedFocusPlayer.id) ?? {
        player: forcedFocusPlayer,
        score: aiPlayer.suspicion?.[forcedFocusPlayer.id] ?? 0.5,
      }
    : null;
  const topCandidate =
    forcedCandidate ??
    (thoughtFrame?.primaryConcernId
      ? ranked.find((entry) => entry.player.id === thoughtFrame.primaryConcernId)
      : null) ??
    ranked[0] ??
    null;
  if (!topCandidate) {
    if (!aiPlayer.alive && aiPlayer.publicClaimRoleId) {
      const notes = summarizeShareablePrivateNotes(aiPlayer, 2, { state });
      const infoText = notes.length > 0 ? `信息是：${notes.join("；")}。` : "可验证信息不多，但身份链先给出来。";
      return {
        templateId: "dead-claim-no-target",
        line: polishPublicLineSurface(pickCorpusTemplate(
          "public.deadClaim",
          { roleName: roleNameById(state, aiPlayer.publicClaimRoleId), infoText },
          rng,
          [pickLayeredSpeech(
            {
              layer: "publicDiscussion",
              audience: "public",
              persona: aiPlayer.aiPersona,
              team: aiPlayer.team,
              act: "deadClaimNoTarget",
            },
            { roleName: roleNameById(state, aiPlayer.publicClaimRoleId), infoText },
            rng,
            [`我已经死了，先报身份：我是 ${roleNameById(state, aiPlayer.publicClaimRoleId)}。${infoText}`]
          )]
        )),
        focusId: null,
        score: 0.5,
      };
    }
    return {
      templateId: "no-target",
      line: polishPublicLineSurface(pickLayeredSpeech(
        {
          layer: "publicDiscussion",
          audience: "public",
          persona: aiPlayer.aiPersona,
          team: aiPlayer.team,
          act: "noTarget",
        },
        {},
        rng,
        ["这一轮我信息不足，先听其他人发言。"]
      )),
      focusId: null,
      score: 0.5,
    };
  }

  const stabilized = resolveStableFocus(state, aiPlayer, topCandidate, ranked, { explicitMention: false });
  const top = stabilized.focus;
  const second = ranked.find((entry) => entry.player.id !== top.player.id) ?? null;
  const targetName = statementTargetLabel ? statementTargetLabel(state, top.player.id) : top.player.name;

  const persona = aiPlayer.aiPersona ?? PERSONA_TYPES.STEADY;
  const hardPressThreshold = 0.58 + personaThresholdShift(persona);
  const evidenceContract = buildDialogueEvidenceContract(agentView ?? state, aiPlayer, top.player, {
    publicOnly: true,
  });
  const evidence = evidenceContract.summaries;
  const reasonText = evidenceContract.spokenText || evidenceContract.text;
  const stanceMemory = rememberDayStance(state, aiPlayer, top.player.id, top.score, "public", {
    reasonSummary: reasonText,
    evidenceCount: evidence.length,
    evidenceSummaries: evidence,
    evidenceAnchors: evidenceContract.evidenceAnchors,
    scoreTrailAnchors: evidenceContract.scoreTrailAnchors,
    eventAnchors: options.sourceEventAnchor
      ? [
          {
            ...options.sourceEventAnchor,
            targetId: top.player.id,
            focusId: top.player.id,
            focusScore: top.score,
            text: reasonText,
          },
        ]
      : [],
  });
  const crossDayStanceLine = crossDayStanceContinuityLine
    ? crossDayStanceContinuityLine(state, aiPlayer, top.player.id, stanceMemory, {
        targetName,
        compact: true,
      })
    : "";
  const decisionRationale = buildDecisionRationale
    ? buildDecisionRationale(agentView ?? state, aiPlayer, top, second, {
      publicOnly: true,
      audience: "public",
      debateBeat: options.debateBeat ?? "opening",
      stanceMemory,
    })
    : null;
  const reasoningLine =
    decisionRationale?.line ??
    (buildReasoningContrastLine
      ? buildReasoningContrastLine(agentView ?? state, aiPlayer, top, second, {
          publicOnly: true,
          audience: "public",
        })
      : "");
  const verificationLine = decisionRationale?.verificationLine ?? "";
  const evidenceModeLine = decisionRationale?.evidenceModeLine ?? "";
  const responsePlanLine = decisionRationale?.responsePlanLine ?? "";
  const responseCriteriaLine = decisionRationale?.responseCriteriaLine ?? "";
  const evidenceInteractionLine = decisionRationale?.evidenceInteractionLine ?? "";
  const pressureStageLine = decisionRationale?.pressureStageLine ?? "";
  const counterEvidenceLine = decisionRationale?.counterEvidenceLine ?? "";
  const tableRiskLine = decisionRationale?.tableRiskLine ?? "";
  const informationGainLine = decisionRationale?.informationGainLine ?? "";
  const tableReactionLine = decisionRationale?.tableReactionLine ?? "";
  const timingWindowLine = decisionRationale?.timingWindowLine ?? "";
  const worldBranchLine = decisionRationale?.worldBranchLine ?? "";
  const voteCoalitionLine = decisionRationale?.voteCoalitionLine ?? "";
  const sourceReliabilityLine = decisionRationale?.sourceReliabilityLine ?? "";
  const timelineConsistencyLine = decisionRationale?.timelineConsistencyLine ?? "";
  const incentiveAlignmentLine = decisionRationale?.incentiveAlignmentLine ?? "";
  const burdenOfProofLine = decisionRationale?.burdenOfProofLine ?? "";
  const questionPriorityLine = decisionRationale?.questionPriorityLine ?? "";
  const actionThresholdLine = decisionRationale?.actionThresholdLine ?? "";
  const memoryContinuityLine = decisionRationale?.memoryContinuityLine ?? "";
  const targetSwitchLine = crossDayStanceLine ? "" : decisionRationale?.targetSwitchLine ?? "";
  const expressionDisciplineLine = decisionRationale?.expressionDisciplineLine ?? "";
  const uncertaintyResolutionLine = decisionRationale?.uncertaintyResolutionLine ?? "";
  const evidenceFreshnessLine = decisionRationale?.evidenceFreshnessLine ?? "";
  const falsificationCheckLine = decisionRationale?.falsificationCheckLine ?? "";
  const causalChainLine = decisionRationale?.causalChainLine ?? "";
  const assumptionAuditLine = decisionRationale?.assumptionAuditLine ?? "";
  const mechanicSensitivityLine = decisionRationale?.mechanicSensitivityLine ?? "";
  const roleHypothesisLine = decisionRationale?.roleHypothesisLine ?? "";
  const evidenceBoundaryLine = decisionRationale?.evidenceBoundaryLine ?? "";
  const runnerUpWatchLine = decisionRationale?.runnerUpWatchLine ?? "";
  const confidenceLine = decisionRationale?.confidenceLine ?? "";
  const reconsiderationLine = decisionRationale?.reconsiderationLine ?? "";
  const strategyContext = buildAIStrategyContext
    ? buildAIStrategyContext(state, aiPlayer, {
        agentView,
        audience: "public",
        stage: "public",
        targetId: top.player.id,
      })
    : null;
  const strategyLine = strategyContext?.evilPlanContextLine && aiPlayer.team === "evil"
    ? strategyContext.evilPlanContextLine
    : "";
  const scoreMood = top.score >= 0.68 ? "压力很高" : top.score >= hardPressThreshold ? "有明显压力" : top.score >= 0.42 ? "需要解释" : "先观察";
  const suppressOptionalDisclosure = !!options.suppressOptionalDisclosure;
  const suppressSelfDisclosure = !!options.suppressSelfDisclosure;
  const claimDisclosureLine = suppressSelfDisclosure
    ? ""
    : publicClaimDisclosureLine(state, aiPlayer, options.publicClaimRoleId, rng);
  const frameDisclosureLine = suppressOptionalDisclosure ? "" : thoughtFrameDisclosureLine(state, aiPlayer, thoughtFrame, rng);
  const softDisclosureLine = suppressOptionalDisclosure || claimDisclosureLine || frameDisclosureLine ? "" : maybePublicDisclosureLine(state, aiPlayer, roundInDay, rng);
  const disclosureLine = claimDisclosureLine || frameDisclosureLine || softDisclosureLine;
  const claimDisclosurePlan =
    disclosureLine && claimDisclosurePlanner
      ? claimDisclosurePlanner(state, aiPlayer, null, rng, {
          private: false,
          audience: "public",
          intent: claimDisclosureLine ? "public-claim" : "public-disclosure",
          roleId: options.publicClaimRoleId || aiPlayer.publicClaimRoleId || undefined,
          forceHard: !!(claimDisclosureLine || options.publicClaimRoleId),
          forceRange: !claimDisclosureLine && !!softDisclosureLine,
        })
      : null;
  const claimDisclosureRationale = attachClaimDisclosureRationaleSpokenLine
    ? attachClaimDisclosureRationaleSpokenLine(claimDisclosurePlan?.claimDisclosureRationale, disclosureLine)
    : claimDisclosurePlan?.claimDisclosureRationale ?? null;
  const values = {
    targetName,
    reasonText,
    shortReason: shortReasonText(reasonText),
    scoreMood,
  };
  const publicAct = publicDialogueActForContext(options.debateBeat, top.score, hardPressThreshold);
  const layeredPublicActText = pickLayeredSpeech(
    {
      layer: "publicDiscussion",
      audience: "public",
      persona,
      team: aiPlayer.team,
      act: publicAct,
    },
    values,
    rng,
    []
  );
  const publicActText = layeredPublicActText || renderDialogueActs(
    state,
    aiPlayer,
    publicAct,
    values,
    rng,
    publicAct === "challengeResponse"
      ? [`我回应一下，{targetName} 这条先看 {shortReason}。`]
      : publicAct === "nominationPressure"
      ? [`提名前我先把话说清：${top.player.name} 这条是 ${shortReasonText(reasonText)}。`]
      : publicAct === "voteIntent"
      ? [`如果提 ${top.player.name}，我会看票型和回应。`]
      : top.score >= hardPressThreshold
      ? [`${top.player.name} 这里我放不太下，主要卡在：${reasonText}。先听回答。`]
      : [`${top.player.name} 我先记一笔，还没到硬推，但需要解释。`],
    { audience: "public" }
  );

  const templates = top.score >= hardPressThreshold
    ? [
        corpusTemplateEntry("", "public-act", {}, rng, [publicActText]),
        corpusTemplateEntry("public.pressure", "press", values, rng, [
          `${top.player.name} 这里我放不太下，主要卡在：${reasonText}。先听回答。`,
        ]),
        corpusTemplateEntry("public.pressure", "risk", values, rng, [
          `我现在最放不下 ${top.player.name}。理由是：${reasonText}。`,
        ]),
        corpusTemplateEntry("public.pressure", "nominate-ready", values, rng, [
          `如果今天要动手，我会先考虑提 ${top.player.name}。但先让 ta 把身份和信息讲完整。`,
        ]),
        corpusTemplateEntry(`persona.${personaCorpusKey(persona)}.focusPush`, "persona-focus", values, rng, [
          `我会先围绕 ${top.player.name} 追问，不急着马上定票。`,
        ]),
      ]
    : [
        corpusTemplateEntry("", "public-act", {}, rng, [publicActText]),
        corpusTemplateEntry("public.probe", "probe", values, rng, [
          `${top.player.name} 我先记一笔，还没到硬推，但需要解释。`,
        ]),
        corpusTemplateEntry("public.probe", "soft", values, rng, [
          `我对 ${top.player.name} 有点不舒服。先不砍，先问清楚。`,
        ]),
        corpusTemplateEntry("public.probe", "watch", values, rng, [
          `${top.player.name} 的回答我会重点听；如果继续绕，下一轮再加压。`,
        ]),
        corpusTemplateEntry(`persona.${personaCorpusKey(persona)}.focusPush`, "persona-focus", values, rng, [
          `我当前更关注 ${top.player.name}，但还没到铁推。`,
        ]),
      ];

  const personaTailPath =
    persona === PERSONA_TYPES.PRESSURE
      ? "public.tails.personaPressure"
      : persona === PERSONA_TYPES.SHADOW
      ? "public.tails.personaShadow"
      : "public.tails.personaSteady";
  const stanceTail =
    stanceMemory?.turns > 1
      ? pickCorpusTemplate(
          "public.tails.stanceRetained",
          { targetName, stanceLabel: dayStanceLabel(stanceMemory.stance) },
          rng,
          [`我今天对 ${top.player.name} 的口径还是“${dayStanceLabel(stanceMemory.stance)}”，暂时不换主线。`]
        )
      : "";

  const tails = [
    second
      ? pickCorpusTemplate(
          "public.tails.secondFocus",
          { targetName, secondName: second.player.name },
          rng,
          [`次级关注是 ${second.player.name}。`]
        )
      : "次级关注位暂不明确。",
    roundInDay > 1
      ? pickCorpusTemplate(
          "public.tails.laterRound",
          { roundInDay },
          rng,
          [`这是今天第 ${roundInDay} 轮公聊，我想看 ta 有没有改口。`]
        )
      : "",
    top.score >= 0.68
      ? pickCorpusTemplate("public.tails.nominationReady", {}, rng, ["这个位置今天已经可以进提名池。"])
      : pickCorpusTemplate("public.tails.hold", {}, rng, ["我还没说必出，但不能让 ta 舒服过白天。"]),
    pickPersonaTemplate(persona, "publicTails", {}, rng, ["先用信息和票型压人，别只凭一句感觉出人。"]),
    pickCorpusTemplate(personaTailPath, {}, rng, ["我先听回应，不急着把票打死。"]),
    strategyLine,
    stanceTail,
  ].filter(Boolean);

  const chosen = { id: `public-act-${publicAct}`, text: publicActText };
  const tail = sample(tails, 1, rng)[0];
  let prefix = disclosureLine ? `${disclosureLine} ` : "";
  if (!aiPlayer.alive && aiPlayer.publicClaimRoleId) {
    const notes = summarizeShareablePrivateNotes(aiPlayer, 2, { state });
    const infoText = notes.length > 0 ? `信息是：${notes.join("；")}。` : "可验证信息不多，但身份链先给出来。";
    prefix = `${pickCorpusTemplate(
      "public.deadClaim",
      { roleName: roleNameById(state, aiPlayer.publicClaimRoleId), infoText },
      rng,
      [pickLayeredSpeech(
        {
          layer: "publicDiscussion",
          audience: "public",
          persona,
          team: aiPlayer.team,
          act: "deadClaimNoTarget",
        },
        { roleName: roleNameById(state, aiPlayer.publicClaimRoleId), infoText },
        rng,
        [`我已经死了，先报身份：我是 ${roleNameById(state, aiPlayer.publicClaimRoleId)}。${infoText}`]
      )]
    )} ${prefix}`;
  }

  const rawLine = applyDebateBeatTone(
    joinSpeechFragments([prefix, chosen.text, tail]),
    options.debateBeat,
    top.player.name,
    rng
  );
  const publicSurfaceLine = renderPublicSurfaceActReadable(
    buildPublicSurfaceAct(state, aiPlayer, {
      focus: top,
      second,
      evidenceContract,
      reasonText,
      debateBeat: options.debateBeat ?? "opening",
      hardPress: top.score >= hardPressThreshold,
      disclosureLine,
      deadClaimLine: !aiPlayer.alive && aiPlayer.publicClaimRoleId ? prefix.trim() : "",
      thoughtFrame,
      reasoningLine,
      verificationLine,
      evidenceModeLine,
      responsePlanLine,
      responseCriteriaLine,
      evidenceInteractionLine,
      pressureStageLine,
      counterEvidenceLine,
      tableRiskLine,
      informationGainLine,
      tableReactionLine,
      timingWindowLine,
      worldBranchLine,
      voteCoalitionLine,
      sourceReliabilityLine,
      timelineConsistencyLine,
      incentiveAlignmentLine,
      burdenOfProofLine,
      questionPriorityLine,
      actionThresholdLine,
      memoryContinuityLine,
      expressionDisciplineLine,
      uncertaintyResolutionLine,
      evidenceFreshnessLine,
      falsificationCheckLine,
      causalChainLine,
      assumptionAuditLine,
      mechanicSensitivityLine,
      roleHypothesisLine,
      evidenceBoundaryLine,
      runnerUpWatchLine,
      confidenceLine,
      reconsiderationLine,
    })
  );
  const selectedRawLine = publicSurfaceLine || rawLine;
  let evidenceLine = ensureEvidenceContractInText(
    applyInGamePragmatics(state, aiPlayer, selectedRawLine, {
      audience: "public",
      intent: top.score >= hardPressThreshold ? QUESTION_INTENT.SUSPECT : QUESTION_INTENT.GENERIC,
      focusId: top.player.id,
      focusScore: top.score,
      lowEvidence: evidenceContract.lowEvidence && !claimDisclosureLine,
    }),
    evidenceContract,
    { label: publicEvidenceAnchorLabel(evidenceContract) }
  );
  const contractSpoken = `${evidenceContract.spokenText ?? ""}`;
  if (contractSpoken && !publicLineIncludesFragment(evidenceLine, contractSpoken)) {
    const firstSentence = `${selectedRawLine}`.match(/[^。！？；]+[。！？；]?/u)?.[0]?.trim() || selectedRawLine;
    evidenceLine = joinSpeechFragments([
      firstSentence,
      publicEvidenceAnchorLine(evidenceContract),
    ]);
  }
  const renderedPublicLine = applyHumanSpeechCadence(state, aiPlayer, evidenceLine, rng, {
    audience: "public",
    intent: top.score >= hardPressThreshold ? QUESTION_INTENT.SUSPECT : QUESTION_INTENT.GENERIC,
    focusId: top.player.id,
    focusScore: top.score,
    roundInDay,
    emotionalTexture: top.score >= 0.72 ? "force" : undefined,
    maxSentences: aiPlayer.alive ? 2 : 3,
    maxChars: aiPlayer.alive
      ? (options.debateBeat === "defense" ? 145 : 135)
      : 190,
    });
  const normalizedContract = `${contractSpoken ?? ""}`.replaceAll("…", "...");
  const finalPublicLine =
    normalizedContract && !publicLineIncludesFragment(renderedPublicLine, contractSpoken)
      ? joinSpeechFragments([
          renderedPublicLine.match(/[^。！？；]+[。！？；]?/u)?.[0]?.trim() || renderedPublicLine,
          publicEvidenceAnchorLine(evidenceContract),
        ])
      : renderedPublicLine;
  const memoryPrefixLine = crossDayStanceLine || targetSwitchLine;
  const publicLineWithCrossDay = memoryPrefixLine
    ? joinSpeechFragments([memoryPrefixLine, finalPublicLine])
    : finalPublicLine;
  const personaPressureLine = memoryPrefixLine
    ? ""
    : publicPersonaMultiEvidencePressureLine(persona, targetName, evidence.length, top.score, evidence);
  const scriptPressureLine = memoryPrefixLine
    ? ""
    : publicScriptPressureContextLine(state, targetName, evidence.length, top.score);
  const timingPressureLine = memoryPrefixLine
    ? ""
    : publicTimingPressureContextLine(options.debateBeat, targetName, evidence.length, top.score);
  const rolePressureLine = memoryPrefixLine
    ? ""
    : publicRolePressureContextLine(state, targetName, top.player.id, evidence.length, top.score, evidence);
  const publicLineWithTimingPressure = timingPressureLine
    ? joinSpeechFragments([timingPressureLine, publicLineWithCrossDay])
    : publicLineWithCrossDay;
  const publicLineWithRolePressure = rolePressureLine
    ? joinSpeechFragments([rolePressureLine, publicLineWithTimingPressure])
    : publicLineWithTimingPressure;
  const publicLineWithScriptPressure = scriptPressureLine
    ? rolePressureLine
      ? joinSpeechFragments([publicLineWithRolePressure, scriptPressureLine])
      : joinSpeechFragments([scriptPressureLine, publicLineWithRolePressure])
    : publicLineWithRolePressure;
  const publicLineWithPersonaPressure = personaPressureLine
    ? joinSpeechFragments([personaPressureLine, publicLineWithScriptPressure])
    : publicLineWithScriptPressure;
  const hasPriorPublicLineForFocus = (aiPlayer.speechHistory ?? []).some(
    (entry) => entry.day === state.day && entry.focusId === top.player.id && entry.line
  );
  const hasPriorVisiblePublicLineForFocus = (aiPlayer.speechHistory ?? []).some(
    (entry) => entry.focusId === top.player.id && entry.line
  );
  const evilPlanLine = publicEvilPlanLine(aiPlayer, strategyContext, {
    hasPriorPublicLine: hasPriorPublicLineForFocus,
    salt: state.scriptId ?? "",
  });
  const publicLineWithStrategy = evilPlanLine
    ? joinSpeechFragments([evilPlanLine, publicLineWithPersonaPressure])
    : publicLineWithPersonaPressure;
  const priorPublicClaim = latestPublicClaimForPlayer(state, aiPlayer);
  const evilClaimCoverLine = publicEvilClaimCoverLine(state, aiPlayer, {
    hasPriorPublicClaim: !!priorPublicClaim,
    priorClaimAgeDays: publicClaimAgeDays(state, priorPublicClaim),
    hasPriorPublicLineForFocus: hasPriorVisiblePublicLineForFocus,
    targetName,
    isProtectAlly: /台面压力别只堆一处|也拉出来对话|别只压一个点|压力重新分配/.test(evilPlanLine),
    isPivot: /这轮先转到|台面压力有了新变化|窗口不能再散|压力需要重新分配/.test(evilPlanLine),
  });
  const publicLineWithClaimCover = evilClaimCoverLine
    ? joinSpeechFragments([evilClaimCoverLine, publicLineWithStrategy])
    : publicLineWithStrategy;
  const publicLineWithCalibration = confidenceLine
    ? joinSpeechFragments([publicLineWithClaimCover, confidenceLine])
    : publicLineWithClaimCover;
  const publicLineWithReconsideration = reconsiderationLine
    ? joinSpeechFragments([publicLineWithCalibration, reconsiderationLine])
    : publicLineWithCalibration;
  const contextSafeLine = ensureDebateBeatContextCue(
    appendPublicThoughtQuestion(publicLineWithReconsideration, thoughtFrame, aiPlayer.alive ? 190 : 210),
    options.debateBeat ?? "opening",
    targetName,
    aiPlayer.alive ? 190 : 210
  );
  const targetSafeLine = ensureTargetMentionInPublicLine(contextSafeLine, targetName, aiPlayer.alive ? 150 : 210);
  const budgetedLine = applySpeechBudget
    ? applySpeechBudget(targetSafeLine, {
        audience: "public",
        maxSentences: aiPlayer.alive ? 3 : 3,
        maxChars: aiPlayer.alive ? 190 : 210,
        minPriorityFragments:
          (aiPlayer.team === "evil" ? 5 + (evilPlanLine ? 1 : 0) + (evilClaimCoverLine ? 1 : 0) : 4) +
          (targetSwitchLine ? 1 : 0) +
          (personaPressureLine ? 1 : 0) +
          (scriptPressureLine ? 1 : 0) +
          (timingPressureLine ? 1 : 0) +
          (rolePressureLine ? 1 : 0),
        priorityFragments: [
          { key: "target", text: targetName, priority: 4 },
          {
            key: "evidence",
            text: contractSpoken,
            appendText: publicEvidenceAnchorLine(evidenceContract),
            priority: 3,
          },
          {
            key: "question",
            text: thoughtFrame?.questionToAsk ?? "",
            appendText: publicSpecificFollowUpQuestionFragment(thoughtFrame?.questionToAsk, targetName, targetSafeLine),
            priority: 2,
          },
          targetSwitchLine
            ? {
                key: "target-switch",
                text: targetSwitchLine,
                aliases: ["昨天主线", "先转", "不等于放掉"],
                appendText: targetSwitchLine,
                priority: 3,
              }
            : null,
          confidenceLine
            ? {
                key: "confidence",
                text: confidenceLine,
                aliases: ["强压位", "不是铁证", "验证压力", "偏前", "接近"],
                appendText: confidenceLine,
                priority: 2,
              }
            : null,
          reconsiderationLine
            ? {
                key: "reconsideration",
                text: reconsiderationLine,
                aliases: ["我会降级", "我会重排", "我会降压", "不锁死"],
                appendText: reconsiderationLine,
                priority: 2,
              }
            : null,
          publicRolePressureContextPriorityFragment(rolePressureLine),
          publicTimingPressureContextPriorityFragment(timingPressureLine),
          publicPersonaMultiEvidencePressurePriorityFragment(personaPressureLine),
          publicScriptPressureContextPriorityFragment(scriptPressureLine),
          publicEvilClaimCoverPriorityFragment(evilClaimCoverLine),
          publicEvilCoverPriorityFragment(aiPlayer),
          publicEvilPlanPriorityFragment(evilPlanLine),
          publicPersonaPriorityFragment(aiPlayer.aiPersona, {
            highPressure: top.score >= 0.72,
            targetName,
            salt: `${state.scriptId ?? ""}:${evilPlanLine}:${evilClaimCoverLine}:${personaPressureLine}`,
          }),
        ],
      })
    : targetSafeLine;
  const lineWithTimingPressure = ensurePublicTimingPressureInLine(
    specializePublicSpecificFollowUpInLine(dedupePublicEvidenceSynthesis(budgetedLine), targetName),
    timingPressureLine,
    aiPlayer.alive ? 190 : 210
  );
  const lineWithRolePressure = ensurePublicRolePressureInLine(
    lineWithTimingPressure,
    rolePressureLine,
    aiPlayer.alive ? 190 : 210
  );
  const line = compactFinalPublicLine(dedupePublicEvilPlanBeforeVerification(lineWithRolePressure), {
    aiPlayer,
    targetName,
    evidenceContract,
    thoughtFrame,
    timingPressureLine,
    rolePressureLine,
  });
  return {
    templateId: chosen.id,
    line,
    focusId: top.player.id,
    score: top.score,
    debateBeat: options.debateBeat ?? "opening",
    evidenceContract,
    decisionRationale,
    claimDisclosureRationale: attachClaimDisclosureRationaleSpokenLine
      ? attachClaimDisclosureRationaleSpokenLine(claimDisclosureRationale, line)
      : claimDisclosureRationale,
    crossDayStance: stanceMemory?.crossDayStance ?? null,
    personaPressureLine,
    scriptPressureLine,
    timingPressureLine,
    rolePressureLine,
    thoughtFrame,
    strategyContext,
  };
}

function ensureDebateBeatContextCue(line, debateBeat, targetName, maxChars = 190) {
  const value = `${line ?? ""}`.trim();
  if (!value) {
    return value;
  }
  let prefix = "";
  if (debateBeat === "nomination-pressure" && !/(提名|上台|流程压力|正式压力|提名前)/u.test(value)) {
    prefix = `提名前重新看 ${targetName}：`;
  } else if (debateBeat === "vote-intent" && !/(投票|票型|如果提|跟票|反票)/u.test(value)) {
    prefix = `投票态度先说清：`;
  }
  if (!prefix) {
    return value;
  }
  const joined = joinSpeechFragments([prefix, value]);
  if (joined.length <= maxChars) {
    return joined;
  }
  const room = Math.max(0, maxChars - prefix.length - 1);
  return `${prefix}${value.slice(0, room).replace(/[，。！？；、\s]+$/u, "").trim()}`;
}
function rotateBy(arr, shift) {
  if (arr.length === 0) {
    return [];
  }
  const n = shift % arr.length;
  return [...arr.slice(n), ...arr.slice(0, n)];
}

function publicClaimCountForDay(state) {
  return (state.events?.claims ?? []).filter((claim) => !claim.private && claim.day === state.day).length;
}

function publicDisclosureCountForDay(state) {
  const publicDisclosureSpeeches = (state.events?.speeches ?? []).filter(
    (speech) =>
      !speech.private &&
      speech.day === state.day &&
      !!speech.claimDisclosureRationale
  ).length;
  return Math.max(publicDisclosureSpeeches, publicClaimCountForDay(state));
}

function publicDisclosurePacingLimit(state, roundInDay) {
  const day = Math.max(1, Number(state?.day) || 1);
  const round = Math.max(1, Number(roundInDay) || 1);
  if (day === 1 && round === 1) {
    return 2;
  }
  if (day === 1) {
    return 3;
  }
  return 4;
}

function isRequiredPublicHardClaim(state, aiPlayer) {
  if (!aiPlayer) {
    return false;
  }
  const day = Math.max(1, Number(state?.day) || 1);
  const selfHeat = Number.isFinite(aiPlayer.suspicion?.[aiPlayer.id])
    ? aiPlayer.suspicion[aiPlayer.id]
    : 0;
  return aiPlayer.alive === false || aiPlayer.beenNominatedToday || day >= 3 || selfHeat >= 0.62;
}

function shouldSuppressOptionalPublicDisclosure(state, aiPlayer, roundInDay, { forceOpeningClaim = false, deadClaim = false } = {}) {
  if (forceOpeningClaim || deadClaim || isRequiredPublicHardClaim(state, aiPlayer)) {
    return false;
  }
  return publicDisclosureCountForDay(state) >= publicDisclosurePacingLimit(state, roundInDay);
}

function shouldReserveOpeningDisclosureSlot(state, roundInDay, thoughtFrame) {
  const day = Math.max(1, Number(state?.day) || 1);
  const round = Math.max(1, Number(roundInDay) || 1);
  if (day !== 1 || round !== 1 || thoughtFrame?.selfDisclosureNeed !== "none") {
    return false;
  }
  const limit = publicDisclosurePacingLimit(state, roundInDay);
  return publicDisclosureCountForDay(state) >= Math.max(1, limit - 1);
}

function shouldForceOpeningPublicClaim(state, aiPlayer, roundInDay, orderIndex, thoughtFrame) {
  if (!state || !aiPlayer || aiPlayer.publicClaimRoleId || aiPlayer.alive === false) {
    return false;
  }
  if (roundInDay !== 1 || Math.max(1, Number(state.day) || 1) !== 1) {
    return false;
  }
  if (publicClaimCountForDay(state) > 0) {
    return false;
  }
  if (thoughtFrame?.selfDisclosureNeed === "hard_claim") {
    return true;
  }
  return thoughtFrame?.selfDisclosureNeed === "range" && orderIndex <= 2;
}

function deepFreezePublicObservation(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  Object.values(value).forEach((child) => deepFreezePublicObservation(child));
  return Object.freeze(value);
}

function immutableAgentViewSnapshot(agentView) {
  if (!agentView) {
    return null;
  }
  const snapshot = JSON.parse(JSON.stringify(agentView));
  return deepFreezePublicObservation(snapshot);
}

function publishPublicSpeech(
  state,
  aiPlayer,
  {
    roundInDay = 1,
    orderIndex = 0,
    debateBeat = "opening",
    rng = Math.random,
    source = "ai_public_discussion",
    onPublicSpeech = null,
  } = {}
) {
  const dialogue = ensureDialogueState(state);
  const sourceEventAnchor = publicDialogueEventAnchor(state, aiPlayer, {
    roundInDay,
    orderIndex,
    debateBeat,
    source,
  });
  const agentView = buildAgentView(state, aiPlayer, { audience: "public" });
  const agentViewSnapshot = typeof onPublicSpeech === "function" ? immutableAgentViewSnapshot(agentView) : null;
  const thoughtFrame = buildAIThoughtFrame(state, aiPlayer, {
    agentView,
    audience: "public",
    roundInDay,
    clock: state.dayStageMeta?.publicConversation?.clock ?? debateBeat,
    rng,
  });
  const forceOpeningClaim = shouldForceOpeningPublicClaim(state, aiPlayer, roundInDay, orderIndex, thoughtFrame);
  const suppressSelfDisclosure = !!state.dayStageMeta?.publicConversation?.suppressSelfDisclosure;
  const requiredHardClaim = suppressSelfDisclosure ? false : isRequiredPublicHardClaim(state, aiPlayer);
  const suppressOptionalDisclosure = suppressSelfDisclosure || shouldSuppressOptionalPublicDisclosure(state, aiPlayer, roundInDay, {
    forceOpeningClaim,
  }) || shouldReserveOpeningDisclosureSlot(state, roundInDay, thoughtFrame);
  const claimRoleId = suppressSelfDisclosure
    ? null
    : thoughtFrame.selfDisclosureNeed === "hard_claim" &&
    thoughtFrame.suggestedClaimRoleId &&
    (forceOpeningClaim || requiredHardClaim || !suppressOptionalDisclosure)
    ? thoughtFrame.suggestedClaimRoleId
    : forceOpeningClaim
    ? pickClaimRole(state, aiPlayer, rng, { force: true })
    : shouldDeadPublicClaim(state, aiPlayer, roundInDay, rng)
    ? pickClaimRole(state, aiPlayer, rng, { force: true })
    : suppressOptionalDisclosure
    ? null
    : choosePublicClaimRole(state, aiPlayer, roundInDay, rng);
  if (claimRoleId) {
    claimRoleForContext(state, aiPlayer, null, rng, { force: true, private: false, roleId: claimRoleId });
  }

  let composed = composePublicLine(state, aiPlayer, roundInDay, rng, {
    debateBeat,
    agentView,
    forcedFocusId: state.dayStageMeta?.publicConversation?.pendingResponseFocusId ?? "",
    publicClaimRoleId: claimRoleId,
    suppressOptionalDisclosure,
    suppressSelfDisclosure,
    thoughtFrame,
    sourceEventAnchor,
  });
  composed = applyPublicStatementContinuityFromMemory(state, aiPlayer, composed, roundInDay, {
    appendPublicThoughtQuestion,
  });
  if (composed.focusId) {
    const focusLabel = statementTargetLabel ? statementTargetLabel(state, composed.focusId) : "";
    const hasPriorPublicLineForFocus = (aiPlayer.speechHistory ?? []).some(
      (entry) => entry.day === state.day && entry.focusId === composed.focusId && entry.line
    );
    const hasPriorVisiblePublicLineForFocus = (aiPlayer.speechHistory ?? []).some(
      (entry) => entry.focusId === composed.focusId && entry.line
    );
    const evilPlanLine = publicEvilPlanLine(aiPlayer, composed.strategyContext, {
      hasPriorPublicLine: hasPriorPublicLineForFocus,
      salt: state.scriptId ?? "",
    });
    const priorPublicClaim = latestPublicClaimForPlayer(state, aiPlayer);
    const evilClaimCoverLine = publicEvilClaimCoverLine(state, aiPlayer, {
      hasPriorPublicClaim: !!priorPublicClaim,
      priorClaimAgeDays: publicClaimAgeDays(state, priorPublicClaim),
      hasPriorPublicLineForFocus: hasPriorVisiblePublicLineForFocus,
      targetName: focusLabel,
      isProtectAlly: /台面压力别只堆一处|也拉出来对话|别只压一个点|压力重新分配/.test(evilPlanLine),
      isPivot: /这轮先转到|台面压力有了新变化|窗口不能再散|压力需要重新分配/.test(evilPlanLine),
    });
    const lineWithEvilPlan = evilPlanLine && !publicLineIncludesFragment(composed.line, evilPlanLine)
      ? joinSpeechFragments([evilPlanLine, composed.line])
      : composed.line;
    const lineWithEvilClaimCover =
      evilClaimCoverLine && !publicLineIncludesFragment(lineWithEvilPlan, evilClaimCoverLine)
        ? joinSpeechFragments([evilClaimCoverLine, lineWithEvilPlan])
        : lineWithEvilPlan;
    const targetSafeLine = ensureTargetMentionInPublicLine(
      lineWithEvilClaimCover,
      focusLabel,
      aiPlayer.alive === false ? 210 : 150
    );
    composed = {
      ...composed,
      line: dedupePublicEvilPlanBeforeVerification(ensurePublicRolePressureInLine(
        ensurePublicTimingPressureInLine(
          specializePublicSpecificFollowUpInLine(
            dedupePublicEvidenceSynthesis(
              applySpeechBudget
                ? applySpeechBudget(targetSafeLine, {
                  audience: "public",
                  maxSentences: aiPlayer.alive === false ? 3 : 3,
                  maxChars: aiPlayer.alive === false ? 210 : 190,
                  minPriorityFragments:
                    (aiPlayer.team === "evil" ? 5 + (evilPlanLine ? 1 : 0) + (evilClaimCoverLine ? 1 : 0) : 4) +
                    (composed.personaPressureLine ? 1 : 0) +
                    (composed.scriptPressureLine ? 1 : 0) +
                    (composed.timingPressureLine ? 1 : 0) +
                    (composed.rolePressureLine ? 1 : 0),
                  priorityFragments: [
                    { key: "target", text: focusLabel, priority: 4 },
                    {
                      key: "evidence",
                      text: composed.evidenceContract?.spokenText ?? "",
                      appendText: composed.evidenceContract?.spokenText
                        ? publicEvidenceAnchorLine(composed.evidenceContract)
                        : "",
                      priority: 3,
                    },
                    {
                      key: "question",
                      text: thoughtFrame?.questionToAsk ?? "",
                      appendText: publicSpecificFollowUpQuestionFragment(thoughtFrame?.questionToAsk, focusLabel, targetSafeLine),
                      priority: 2,
                    },
                    publicRolePressureContextPriorityFragment(composed.rolePressureLine),
                    publicTimingPressureContextPriorityFragment(composed.timingPressureLine),
                    publicPersonaMultiEvidencePressurePriorityFragment(composed.personaPressureLine),
                    publicScriptPressureContextPriorityFragment(composed.scriptPressureLine),
                    publicEvilClaimCoverPriorityFragment(evilClaimCoverLine),
                    publicEvilCoverPriorityFragment(aiPlayer),
                    publicEvilPlanPriorityFragment(evilPlanLine),
                    publicPersonaPriorityFragment(aiPlayer.aiPersona, {
                      highPressure: (composed.score ?? 0) >= 0.72,
                      targetName: focusLabel,
                      salt: `${state.scriptId ?? ""}:${evilPlanLine}:${evilClaimCoverLine}:${composed.personaPressureLine ?? ""}`,
                    }),
                  ],
                })
                : targetSafeLine
            ),
            focusLabel
          ),
          composed.timingPressureLine,
          aiPlayer.alive === false ? 210 : 190
        ),
        composed.rolePressureLine,
        aiPlayer.alive === false ? 210 : 190
      )),
    };
  }
  if (composed.decisionRationale) {
    composed = {
      ...composed,
      decisionRationale: attachDecisionRationaleSpokenLine
        ? attachDecisionRationaleSpokenLine(composed.decisionRationale, composed.line)
        : composed.decisionRationale,
    };
  }
  if (composed.claimDisclosureRationale) {
    const lineWithClaimDisclosure = ensurePublicClaimDisclosureInLine(
      composed.line,
      composed.claimDisclosureRationale,
      "",
      aiPlayer.alive === false ? 230 : 210
    );
    composed = {
      ...composed,
      line: lineWithClaimDisclosure,
      claimDisclosureRationale: attachClaimDisclosureRationaleSpokenLine
        ? attachClaimDisclosureRationaleSpokenLine(composed.claimDisclosureRationale, lineWithClaimDisclosure)
      : composed.claimDisclosureRationale,
    };
  }
  let polishedLine = compactFinalPublicLine(composed.line, {
    aiPlayer,
    targetName: composed.focusId && statementTargetLabel ? statementTargetLabel(state, composed.focusId) : "",
    evidenceContract: composed.evidenceContract,
    thoughtFrame,
    timingPressureLine: composed.timingPressureLine,
    rolePressureLine: composed.rolePressureLine,
  });
  polishedLine = ensurePublicRolePressureInLine(
    polishedLine,
    composed.rolePressureLine,
    aiPlayer.alive === false ? 210 : 190
  );
  polishedLine = ensurePublicCrossDayStanceInLine(
    polishedLine,
    publicCrossDayStanceLineForComposed(state, aiPlayer, composed),
    aiPlayer.alive === false ? 210 : 190
  );
  polishedLine = ensurePublicTargetSwitchInLine(
    polishedLine,
    composed.decisionRationale?.targetSwitchLine ?? composed.decisionRationale?.memoryContinuityLine ?? "",
    aiPlayer.alive === false ? 210 : 190
  );
  polishedLine = ensurePublicScriptPressureInLine(
    polishedLine,
    composed.scriptPressureLine,
    aiPlayer.alive === false ? 210 : 190
  );
  polishedLine = ensurePublicEvidenceAnchorInLine(
    polishedLine,
    composed.evidenceContract,
    aiPlayer.alive === false ? 210 : 190
  );
  polishedLine = ensurePublicVerificationActionInLine(
    polishedLine,
    composed.focusId && statementTargetLabel ? statementTargetLabel(state, composed.focusId) : "",
    composed.evidenceContract,
    aiPlayer.alive === false ? 210 : 190
  );
  polishedLine = ensurePublicPressureActionInLine(
    polishedLine,
    aiPlayer,
    composed.focusId && statementTargetLabel ? statementTargetLabel(state, composed.focusId) : "",
    composed.evidenceContract,
    composed.decisionRationale?.focusScore ?? composed.score ?? 0,
    aiPlayer.alive === false ? 210 : 190
  );
  polishedLine = ensurePublicEvilProtectAllyInLine(
    polishedLine,
    composed.strategyContext,
    aiPlayer.alive === false ? 210 : 190
  );
  polishedLine = ensurePublicEvilCoverMarkerInLine(
    polishedLine,
    aiPlayer,
    aiPlayer.alive === false ? 210 : 190
  );
  polishedLine = ensurePublicPressureTextureInLine(
    polishedLine,
    aiPlayer,
    composed.decisionRationale?.focusScore ?? composed.score ?? 0,
    aiPlayer.alive === false ? 210 : 190
  );
  polishedLine = dedupePublicEvidenceSynthesis(polishedLine);
  polishedLine = sanitizePlayerVisibleText ? sanitizePlayerVisibleText(polishedLine) : polishedLine;
  polishedLine = dedupePublicEvidenceSynthesis(polishedLine);
  if (polishedLine !== composed.line) {
    composed = {
      ...composed,
      line: polishedLine,
      decisionRationale: composed.decisionRationale && attachDecisionRationaleSpokenLine
        ? attachDecisionRationaleSpokenLine(composed.decisionRationale, polishedLine)
        : composed.decisionRationale,
      claimDisclosureRationale: composed.claimDisclosureRationale && attachClaimDisclosureRationaleSpokenLine
        ? attachClaimDisclosureRationaleSpokenLine(composed.claimDisclosureRationale, polishedLine)
        : composed.claimDisclosureRationale,
    };
  }

  dialogue.lastPublicFocusBySpeaker[aiPlayer.id] = composed.focusId ?? null;
  dialogue.lastPublicTemplateBySpeaker[aiPlayer.id] = composed.templateId;

  aiPlayer.speechHistory.push({ day: state.day, line: composed.line, focusId: composed.focusId });
  const speechEvent = {
    day: state.day,
    playerId: aiPlayer.id,
    line: composed.line,
    focusId: composed.focusId,
    private: false,
    debateBeat,
    evidenceContract: composed.evidenceContract ?? null,
    decisionRationale: composed.decisionRationale ?? null,
    claimDisclosureRationale: composed.claimDisclosureRationale ?? null,
    crossDayStance: composed.crossDayStance ?? null,
    personaPressureLine: composed.personaPressureLine ?? "",
    scriptPressureLine: composed.scriptPressureLine ?? "",
    timingPressureLine: composed.timingPressureLine ?? "",
    rolePressureLine: composed.rolePressureLine ?? "",
  };
  state.events.speeches.push(speechEvent);
  if (typeof onPublicSpeech === "function") {
    const visibleEvent = deepFreezePublicObservation({
      day: state.day ?? 0,
      phase: "day/public",
      speakerId: aiPlayer.id,
      focusId: composed.focusId ?? null,
      text: composed.line,
      debateBeat,
      roundInDay,
      orderIndex,
    });
    onPublicSpeech(
      Object.freeze({
        visibleEvent,
        agentView: agentViewSnapshot,
      })
    );
  }
  rememberStatementMemory(
    state,
    aiPlayer,
    "public",
    null,
    {
      ...composed,
      response: composed.line,
      focusScore: composed.score,
      intent: composed.score >= 0.62 ? QUESTION_INTENT.SUSPECT : QUESTION_INTENT.GENERIC,
    },
    {
      source,
      intent: composed.score >= 0.62 ? QUESTION_INTENT.SUSPECT : QUESTION_INTENT.GENERIC,
      roundInDay,
    }
  );
  recordPublicSpeechForAgents(state, {
    speakerId: aiPlayer.id,
    text: composed.line,
    focusId: composed.focusId,
    roundInDay,
    orderIndex,
    debateBeat,
    polarity: composed.score >= 0.62 ? "accuse" : "neutral",
  });

  addLog(state, "speech", `${aiPlayer.name}：${composed.line}`, {
    playerId: aiPlayer.id,
    focusId: composed.focusId,
    score: composed.score,
    roundInDay,
    orderIndex,
    private: false,
    debateBeat,
  });

  pushTimeline(state, {
    id: sourceEventAnchor.eventId,
    timestamp: sourceEventAnchor.timestamp,
    mode: "public",
    roundInDay,
    orderIndex,
    speakerId: aiPlayer.id,
    targetId: composed.focusId,
    text: composed.line,
    debateBeat,
    debateBeatLabel: debateBeatLabel(debateBeat),
    decisionRationale: composed.decisionRationale ?? null,
    claimDisclosureRationale: composed.claimDisclosureRationale ?? null,
    crossDayStance: composed.crossDayStance ?? null,
  });
  const publicSignals = predictDialogueSignals(composed.line);

  recordUtteranceMVP(state, {
    speakerId: aiPlayer.id,
    audience: "public",
    text: composed.line,
    speechActs: inferPublicSpeechActs(composed),
    targets: composed.focusId ? [composed.focusId] : [],
    intent: composed.score >= 0.62 ? "suspect" : "plan",
    voteStance: voteStanceFromText(composed.line),
    evidenceSource: "social_read",
    epistemicStrength: composed.score >= 0.74 ? 3 : composed.score >= 0.58 ? 2 : 1,
    nominationRelated: /提名|nominate/i.test(composed.line),
    metadata: {
      source,
      roundInDay,
      orderIndex,
      debateBeat,
      debateBeatLabel: debateBeatLabel(debateBeat),
      templateId: composed.templateId ?? "",
      focusScore: composed.score ?? null,
      decisionRationale: composed.decisionRationale ?? null,
      claimDisclosureRationale: composed.claimDisclosureRationale ?? null,
      crossDayStance: composed.crossDayStance ?? null,
      mlVoteLabel: publicSignals.voteLabel ?? "undecided",
      mlVoteConfidence: publicSignals.voteConfidence ?? 0,
      mlSpeechActs: publicSignals.speechActs ?? [],
      mlTokenHits: publicSignals.tokenHits ?? 0,
      publicClaimRoleId: claimRoleId ?? "",
      thoughtFrame: {
        intendedAct: thoughtFrame.intendedAct,
        primaryConcernId: thoughtFrame.primaryConcernId,
        selfDisclosureNeed: thoughtFrame.selfDisclosureNeed,
        nominationReadiness: thoughtFrame.nominationReadiness,
      },
    },
  });

  return {
    ...composed,
    speechEvent,
    speakerId: aiPlayer.id,
    speakerName: aiPlayer.name,
    debateBeat,
    debateBeatLabel: debateBeatLabel(debateBeat),
    thoughtFrame,
    roundInDay,
    orderIndex,
  };
}

function ensurePublicConversationClock(state) {
  state.dayStageMeta = state.dayStageMeta ?? {};
  const existing = state.dayStageMeta.publicConversation ?? {};
  const clock = {
    step: Number(existing.step ?? 0) || 0,
    clock: existing.clock ?? "opening",
    pressure: Number(existing.pressure ?? 0) || 0,
    activeSpeakerId: existing.activeSpeakerId ?? null,
    focusId: existing.focusId ?? null,
    pendingResponseSpeakerId: existing.pendingResponseSpeakerId ?? null,
    pendingResponseFocusId: existing.pendingResponseFocusId ?? null,
    pendingQuestionText: existing.pendingQuestionText ?? "",
    suppressSelfDisclosure: !!existing.suppressSelfDisclosure,
    canContinue: existing.canContinue ?? true,
    suggestedActions: Array.isArray(existing.suggestedActions) ? existing.suggestedActions : ["continue-public"],
    lastStep: existing.lastStep ?? null,
    lastUpdatedDay: state.day ?? 0,
  };
  state.dayStageMeta.publicConversation = clock;
  return clock;
}

function tablePressure(state) {
  let pressure = 0;
  state.players
    .filter((player) => !player.isHuman)
    .forEach((aiPlayer) => {
      const top = rankTargets(aiPlayer, state, 1, { publicOnly: true, audience: "public" })[0];
      if (top?.score) {
        pressure = Math.max(pressure, top.score);
      }
    });
  return clamp(pressure, 0, 1);
}

function conversationClockForStep(step, pressure) {
  if (pressure >= 0.66 && step >= 2) return "nomination-ready";
  if (step <= 0) return "opening";
  if (step === 1) return "response";
  if (step <= 3) return "crossfire";
  return "cooldown";
}

function debateBeatForConversationClock(clock) {
  return {
    opening: "opening",
    response: "defense",
    crossfire: "challenge",
    "nomination-ready": "nomination-pressure",
    cooldown: "vote-intent",
  }[clock] ?? "opening";
}

function suggestedActionsForConversation(clock, step) {
  if (clock === "nomination-ready") {
    return ["open-nomination-window", "ask-followup", "continue-public"];
  }
  if (clock === "cooldown") {
    return ["open-nomination-window", "pass-to-nomination", "ask-followup"];
  }
  if (step <= 1) {
    return ["continue-public", "ask-followup"];
  }
  return ["continue-public", "open-nomination-window", "ask-followup"];
}

function safePublicConversationText(text, maxChars = 120) {
  let value = `${text ?? ""}`.replace(/\s+/g, " ").trim();
  if (sanitizePlayerVisibleText) {
    value = sanitizePlayerVisibleText(value);
  }
  if (shortReasonText) {
    return shortReasonText(value, maxChars);
  }
  return value.length > maxChars ? `${value.slice(0, Math.max(0, maxChars - 1)).trim()}…` : value;
}

function publicConversationPlayerLabel(state, playerId) {
  const player = state.players?.find((entry) => entry.id === playerId);
  if (!player) {
    return "";
  }
  return player.name || `${(player.seatIndex ?? 0) + 1}号`;
}

function publicConversationTargetId(composed) {
  return composed.focusId ?? composed.decisionRationale?.focusId ?? composed.evidenceContract?.targetId ?? "";
}

function publicConversationStance(composed, clock, debateBeat) {
  const score = Number(composed?.score ?? composed?.decisionRationale?.focusScore ?? 0);
  if (clock === "nomination-ready" || debateBeat === "nomination-pressure" || score >= 0.66) {
    return "nomination-pressure";
  }
  if (score >= 0.58 || debateBeat === "challenge") {
    return "press";
  }
  if (debateBeat === "defense" || clock === "response") {
    return "response";
  }
  return "question";
}

function publicConversationQuestion(composed, targetName) {
  const question =
    composed?.thoughtFrame?.questionToAsk ??
    composed?.decisionRationale?.questionPriorityLine ??
    composed?.evidenceContract?.verificationPrompt ??
    "";
  if (question) {
    return safePublicConversationText(question, 90);
  }
  return targetName ? safePublicConversationText(`请${targetName}补清身份、昨晚信息和票型。`, 90) : "";
}

function publicConversationReason(composed) {
  const reason =
    composed?.evidenceContract?.spokenText ??
    composed?.evidenceContract?.text ??
    composed?.decisionRationale?.spokenLine ??
    composed?.decisionRationale?.reasonSummary ??
    composed?.line ??
    "";
  return safePublicConversationText(reason, 120);
}

function publicConversationFollowUp(composed, targetName, clock) {
  const explicit =
    composed?.thoughtFrame?.questionToAsk ??
    composed?.decisionRationale?.questionPriorityLine ??
    composed?.decisionRationale?.actionThresholdLine ??
    "";
  if (explicit) {
    return safePublicConversationText(explicit, 100);
  }
  if (!targetName) {
    return "";
  }
  const next =
    clock === "nomination-ready"
      ? `让${targetName}回应后，决定是否开启提名。`
      : `先听${targetName}回应，再看是否进提名。`;
  return safePublicConversationText(next, 100);
}

function publicConversationNominationTendency(composed, clock) {
  const score = Number(composed?.score ?? composed?.decisionRationale?.focusScore ?? 0);
  const line = `${composed?.line ?? ""}`;
  if (clock === "nomination-ready" || /提名|上台|进提名/u.test(line) || score >= 0.66) {
    return "ready";
  }
  if (score >= 0.58) {
    return "possible";
  }
  return "hold";
}

function buildPublicConversationStepSummary(state, speaker, composed, clock, debateBeat, step) {
  const targetId = publicConversationTargetId(composed);
  const targetName = statementTargetLabel?.(state, targetId) || publicConversationPlayerLabel(state, targetId);
  const question = publicConversationQuestion(composed, targetName);
  return {
    step,
    clock,
    speakerId: speaker?.id ?? "",
    speakerName: speaker?.name ?? "",
    targetId,
    targetName,
    stance: publicConversationStance(composed, clock, debateBeat),
    question,
    reason: publicConversationReason(composed),
    followUp: publicConversationFollowUp(composed, targetName, clock),
    nominationTendency: publicConversationNominationTendency(composed, clock),
    line: safePublicConversationText(composed?.line ?? "", 190),
  };
}

function speakerForConversationStep(state, clock, step, speakers) {
  const pendingSpeakerId = state.dayStageMeta?.publicConversation?.pendingResponseSpeakerId;
  if (pendingSpeakerId) {
    const pendingSpeaker = speakers.find((entry) => entry.id === pendingSpeakerId);
    if (pendingSpeaker) {
      return pendingSpeaker;
    }
  }
  if (clock === "response") {
    const lastFocused = [...(state.events?.speeches ?? [])]
      .reverse()
      .find((entry) => !entry.private && entry.focusId)?.focusId;
    const focusedSpeaker = speakers.find((entry) => entry.id === lastFocused);
    if (focusedSpeaker) {
      return focusedSpeaker;
    }
  }
  return speakers[step % Math.max(1, speakers.length)] ?? null;
}

function runAIConversationStep(state, rng = Math.random) {
  if (state.phase !== "day" || state.dayStage !== "public" || state.gameOver) {
    return { ok: false, reason: "当前不在公聊阶段。" };
  }

  refreshAIBeliefs(state);
  const conversation = ensurePublicConversationClock(state);
  const speakers = state.players
    .filter((entry) => !entry.isHuman)
    .sort((a, b) => a.seatIndex - b.seatIndex);
  if (speakers.length === 0) {
    return { ok: false, reason: "没有可发言的 AI。" };
  }
  const step = conversation.step ?? 0;
  const pressure = tablePressure(state);
  const hasPendingResponse = !!conversation.pendingResponseSpeakerId || !!conversation.pendingResponseFocusId;
  const clock = hasPendingResponse ? "response" : conversationClockForStep(step, pressure);
  const debateBeat = debateBeatForConversationClock(clock);
  const speaker = speakerForConversationStep(state, clock, step, speakers);
  if (!speaker) {
    return { ok: false, reason: "没有可发言的 AI。" };
  }
  const composed = publishPublicSpeech(state, speaker, {
    roundInDay: step + 1,
    orderIndex: step,
    debateBeat,
    rng,
    source: "ai_public_conversation_step",
  });
  conversation.step = step + 1;
  conversation.clock = conversationClockForStep(conversation.step, Math.max(pressure, composed.score ?? 0));
  conversation.pressure = Math.max(pressure, composed.score ?? 0);
  conversation.activeSpeakerId = speaker.id;
  conversation.focusId = composed.focusId ?? null;
  conversation.pendingResponseSpeakerId = null;
  conversation.pendingResponseFocusId = null;
  conversation.pendingQuestionText = "";
  conversation.canContinue = conversation.clock !== "cooldown" || conversation.step < 6;
  conversation.suggestedActions = suggestedActionsForConversation(conversation.clock, conversation.step);
  conversation.lastStep = buildPublicConversationStepSummary(
    state,
    speaker,
    composed,
    conversation.clock,
    debateBeat,
    conversation.step
  );
  conversation.lastUpdatedDay = state.day ?? 0;
  state.dayStageMeta.publicRounds = Math.max(state.dayStageMeta.publicRounds ?? 0, conversation.step);
  addLog(state, "conversation-clock", `公聊推进：${conversationClockLabel(conversation.clock)}。`, {
    clock: conversation.clock,
    step: conversation.step,
    speakerId: speaker.id,
    focusId: composed.focusId,
    targetId: conversation.lastStep?.targetId ?? composed.focusId ?? "",
    stance: conversation.lastStep?.stance ?? "",
    nominationTendency: conversation.lastStep?.nominationTendency ?? "",
  });
  return {
    ok: true,
    message: `${speaker.name} 发言：${conversationClockLabel(conversation.clock)}`,
    publicConversation: { ...conversation },
    line: composed.line,
    speakerId: speaker.id,
    focusId: composed.focusId,
    crossDayStance: composed.crossDayStance ?? null,
    debateBeat,
  };
}

function runAIDiscussion(state, rng = Math.random, options = {}) {
  if (state.phase !== "day" || state.gameOver) {
    return;
  }

  refreshAIBeliefs(state);
  const dialogue = ensureDialogueState(state);
  const roundInDay = nextPublicRound(state);
  const onPublicSpeech = typeof options === "function" ? options : options?.onPublicSpeech;

  const speakingAIs = state.players
    .filter((entry) => !entry.isHuman)
    .sort((a, b) => a.seatIndex - b.seatIndex);
  const speakers = rotateBy(speakingAIs, Math.max(0, roundInDay - 1));

  speakers.forEach((aiPlayer, orderIndex) => {
    const debateBeat = debateBeatForOrder(orderIndex, speakers.length, roundInDay);
    publishPublicSpeech(state, aiPlayer, {
      roundInDay,
      orderIndex,
      debateBeat,
      rng,
      source: "ai_public_discussion",
      onPublicSpeech,
    });
  });
}


  return {
    runAIConversationStep,
    runAIDiscussion,
  };
}
