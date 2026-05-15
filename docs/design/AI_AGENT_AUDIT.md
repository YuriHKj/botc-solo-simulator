# AI Agent Audit - 2026-05-10

## Scope

This audit tracks the AI dialogue and strategy code paths that still read raw game truth versus the paths that already use an agent-scoped view of evidence. It is meant to guide the next migration step: passing an explicit `agentView` into dialogue and strategy helpers instead of letting those helpers inspect bare `state` and `player` objects.

This document is about AI behavior only. It does not audit the rules engine, Unity UI, or Electron UI.

## Current Summary

Implemented agent-scoped pieces:

- per-agent `evidenceBook`
- per-agent `beliefTrailByPlayerId`
- dialogue-safe evidence summaries
- private/public visibility filters for evidence
- hidden-info leak assertion for dialogue tests
- statement memory for public and private dialogue continuity
- dynamic per-player `sourceTrust`
- lightweight per-agent `knowledgeGraph`

Now partially implemented as a first-class abstraction:

- `buildAgentView(...)` in `scripts/ai_agents.js`
- dialogue-safe `evidenceForTarget(...)`, `summariesForTarget(...)`, and `trailForTarget(...)` methods on that view
- private/public audience defaults for evidence visibility
- initial private dialogue, public dialogue, and nomination proposal evidence reads through `agentView`
- `buildDialogueEvidenceContract(...)` in `scripts/ai.js`, used by private dialogue, public dialogue, and nomination proposal reasons
- KG-derived pressure via `computeGraphPressureForTarget(...)`, used as a bounded modifier for target ranking and evidence explanation

Still missing:

- a complete map of all dialogue-time direct reads guarded by contract tests
- broader use of `agentView` in voting and lower-level suspicion refresh helpers
- decay/forgiveness for `sourceTrust`
- richer personality strategies beyond the first pressure/steady/shadow split

## Already Agent-Scoped

### Evidence And Trail Storage

File: `scripts/ai_agents.js`

- `createAgent(player)`
  - Stores self-known role/team as `knownSelfRoleId` and `knownSelfTeam`.
  - This is a raw read at setup time, but it is stored as the agent's own knowledge, not exposed to other agents.

- `ensureAIAgents(state)`
  - Preserves agent-local `evidenceBook`, `beliefTrailByPlayerId`, claims, known allies, and known bluffs across refreshes.

- `getAgentEvidence(state, playerOrId, options)`
  - Reads only the selected agent's evidence.
  - Supports target filtering and public/private filtering.

- `recordSuspicionChangeFromEvidence(...)`
  - Writes belief changes to the selected agent's `beliefTrailByPlayerId`.
  - Includes evidence id, source, visibility, reliability, contamination risk, and raw/applied delta.

### Dialogue-Safe Evidence

File: `scripts/ai_agents.js`

- `buildAgentView(state, viewer, options)`
  - Creates the current viewer-scoped data object for dialogue and strategy helpers.
  - Does not enumerate raw `state`, `viewerPlayer`, or `agent`; these are kept as non-enumerable implementation references.
  - Public views default to public evidence only.
  - Private views default to participant-visible private evidence plus public evidence.
  - Good views do not expose demon bluffs, demon id, minion ids, target role ids, or target teams.

- `getDialogueEvidenceForTarget(state, viewer, targetId, options)`
  - Main viewer-aware evidence reader.
  - Uses the viewer's own `evidenceBook`.
  - `publicOnly: true` excludes private evidence.
  - Sorts by dialogue weight and recency.

- `summarizeEvidenceForDialogue(state, viewer, targetId, options)`
  - Main safe summary helper for dialogue.
  - Redacts private details into broad reasons such as private-line or night-info summaries.

- `assertNoHiddenInfoLeakForDialogue(text, state, viewer)`
  - Test helper.
  - Intentionally reads `state.demonBluffs` to detect leaks, not to generate player-facing dialogue.

### Visibility-Aware Event Recording

File: `scripts/ai_agents.js`

- `recordPrivateWhisperForAgents(...)`
  - Writes private whisper evidence only to the two participants.

- `recordPublicSpeechForAgents(...)`
  - Writes public speech evidence to every AI.

- `recordPrivateClaimForAgent(...)`
  - Writes a private claim only to the viewer.

- `recordPrivateInfoClaimForAgent(...)`
  - Writes player-claimed night information as private, rumor-level evidence with high contamination risk.

- `recordPrivateInfoForAgent(...)`
  - Writes Storyteller/private night information only to the receiving AI.
  - Adds contamination metadata for drunk/poisoned recipients.

### Dialogue Entrypoints Already Using Evidence Summaries

File: `scripts/ai.js`

- `collectEvidence(stateOrView, aiPlayer, focusPlayer, options)`
  - First calls `summarizeEvidenceForDialogue(...)`.
  - If passed an `agentView`, reads summaries, visible claims, visible speeches, and evidence counts from the view.
  - Public dialogue calls it with `publicOnly: true`.
  - Falls back to visible claims/speeches and reason flags if no evidence summary exists.

- `buildDialogueEvidenceContract(...)`
  - Normalizes the evidence rule for dialogue-like outputs.
  - Returns `summaries`, `text`, `hasEvidence`, `lowEvidence`, and `publicOnly`.
  - If evidence exists, text is the first 1-2 summaries.
  - If evidence is missing, text is an explicit low-evidence fallback instead of a silent template guess.

- `ensureEvidenceContractInText(...)`
  - Forces the selected summary or low-evidence fallback into the final text.
  - Used after templating so persona/cadence variants cannot accidentally drop the evidence line.

- `composePrivateResponse(...)`
  - Uses `collectEvidence(...)` for suspicion, trust, vote, plan, and compare answers.
  - The player-facing private path now passes an `agentView` into this helper, but the helper still receives raw `state`, `aiPlayer`, and `human` for compatibility.
  - Final private responses expose `evidenceContract` and force at least one contract line into the response.

- `composePublicLine(...)`
  - Uses `collectEvidence(..., { publicOnly: true })`.
  - Public speech therefore avoids quoting private evidence.
  - The public discussion path now passes an `agentView` into this helper, but claim/disclosure subhelpers still receive raw state.
  - Public speech events now include `evidenceContract`.

- `buildNominationProposal(...)`
  - Uses `summarizeEvidenceForDialogue(..., { publicOnly: true })` for proposal reasons.
  - Nomination proposal construction now accepts an `agentView` and reads public evidence summaries through that view.
  - Proposal reasons now include either contract evidence text or an explicit low-evidence nomination fallback.
  - Supports statement-memory-derived reasons.

- `getAIInsightRows(...)`
  - Snapshots/restores AI belief fields and statement memory so inspection does not mutate reasoning state.

## Intentional Raw Truth Reads

These are currently expected because they seed legal hidden knowledge or inspect the AI's own state.

### Agent Setup

File: `scripts/ai_agents.js`

- `createAgent(player)`
  - Reads `player.apparentRoleId ?? player.roleId`.
  - Reads `player.apparentTeam ?? player.team`.
  - Purpose: initialize the agent's self-knowledge.
  - Migration target: keep this as agent setup, but expose it later through `agentView.self`.

- `ensureAIAgents(state)`
  - Refreshes `knownSelfRoleId` / `knownSelfTeam`.
  - Has a Lunatic-specific raw role check.
  - Purpose: preserve special self-perception.
  - Migration target: isolate into `buildAgentSelfKnowledge(...)`.

### Evil Recognition

File: `scripts/ai_agents.js`

- `recordEvilRecognitionForAgents(state)`
  - Reads `state.players[].team`, demon/minion categories, and `state.demonBluffs`.
  - Purpose: write legal evil-team knowledge into evil agents only.
  - Migration target: keep raw reads inside this one setup recorder, then make dialogue consume only `agent.knownAllyIds`, `agent.knownDemonId`, `agent.knownMinionIds`, and `agent.knownBluffRoleIds`.

### Leak Testing

File: `scripts/ai_agents.js`

- `assertNoHiddenInfoLeakForDialogue(...)`
  - Reads hidden demon bluffs and known bluff ids to detect forbidden text.
  - Purpose: test/audit only.
  - Migration target: no runtime migration needed; keep as a guard.

## Direct Reads Still In Dialogue Or Strategy

These are the main candidates for the `agentView` migration.

### Private Evil Alliance Dialogue

File: `scripts/ai.js`

- `composeEvilAllianceResponse(state, aiPlayer, human, analysis, rng)`
  - Reads `state.demonBluffs`, filtered by `getKnownBluffRoleIds(...)`.
  - Reads `getEffectiveRoleId(aiPlayer) ?? aiPlayer.roleId`.
  - Reads `aiPlayer.category` and `human.category`.
  - Risk: mostly intended for evil allies, but the function still has access to raw state and real categories.
  - Target: pass `agentView.knownBluffs`, `agentView.selfRoleId`, `agentView.knownAllies`, and `agentView.audienceRelation`.

### Claim Selection And Disclosure

File: `scripts/ai.js`

- `pickClaimRole(state, aiPlayer, rng, options)`
  - Reads `aiPlayer.team`, `agent.knownSelfTeam`, `state.players[].publicClaimRoleId`, `getPerceivedRoleId(...)`, `getEffectiveRoleId(...)`, and `aiPlayer.roleId`.
  - Risk: role/team decisions are mixed with raw state reads.
  - Target: use `agentView.selfTeam`, `agentView.selfRoleId`, `agentView.visibleClaimedRoleIds`, and script public role pools.

- `choosePublicClaimRole(state, aiPlayer, roundInDay, rng)`
  - Reads `roleForPlayer(...)`, `perceivedRoleForPlayer(...)`, `aiPlayer.team`, and bluff pools.
  - Risk: public claim logic can accidentally rely on actual role when perceived role should differ.
  - Target: separate `agentView.selfPerceivedRole` from `agentView.selfTrueRoleIfKnown`.

- `maybePublicDisclosureLine(...)`
  - Uses public claim and private-note disclosure rules.
  - Risk: shares old `privateNotes` strings through defensive filtering instead of structured evidence.
  - Target: replace private-note sharing with `agentView.shareableEvidence`.

- `maybePrivateClaim(...)` and `composePrivateClaimPolicy(...)`
  - Use perceived/actual role helpers and team checks.
  - Risk: private claim choices still depend on raw role/team helpers.
  - Target: claim policy should consume a prebuilt claim context from `agentView`.

### Public And Private Response Composition

File: `scripts/ai.js`

- `composePrivateResponse(state, aiPlayer, human, analysis, questionText, memory, rng)`
  - Uses evidence summaries, but also receives raw `state`, `aiPlayer`, and `human`.
  - Calls role/claim/private-note helpers that may read direct truth.
  - Target: `composePrivateResponse(agentView, analysis, questionText, memory, rng)`.

- `composePublicLine(state, aiPlayer, roundInDay, rng, options)`
  - Uses public evidence summaries, but still calls claim/disclosure helpers with raw state.
  - Target: `composePublicLine(agentView, roundInDay, rng, options)`.

- `lightlyHumanizePrivateResponse(...)`, `composeHumanizedEvilAllianceResponse(...)`, and `applyHumanSpeechCadence(...)`
  - Mostly expression-layer helpers, but can receive lines already containing raw-truth-derived claims.
  - Target: keep humanization pure: it should transform text only and not make new visibility decisions.

### Private Note Sharing

File: `scripts/ai.js`

- `isEvilPerspective(state, player)`
  - Reads `player.team` or `agent.knownSelfTeam`.

- `canSharePrivateNote(state, speaker, audience, note)`
  - Uses known allies and evil perspective to decide whether old notes can be shared.

- `summarizeShareablePrivateNotes(aiPlayer, limit, options)`
  - Reads raw `privateNotes` strings.
  - Risk: string filtering is brittle and can miss hidden information phrasing.
  - Target: remove old string-note sharing from dialogue; use structured `agentView.privateEvidenceSummaries`.

### Voting And Nomination

File: `scripts/ai.js`

- `decideAIVote(voter, nominee, state, rng)`
  - Reads `voter.team` for evil behavior.
  - Uses public statement memory and suspicion.
  - Target: `decideAIVote(agentView, nomineeView, statePublicProcedure, rng)` or a narrower `voteContext`.

- `chooseAINomination(state)`
  - Iterates raw `state.players`, then calls `rankTargets(...)` and `buildNominationProposal(...)`.
  - Proposal reasons already use safe public evidence summaries.
  - Target: build per-nominator `agentView` and pass it to target ranking and proposal construction.

- `buildNominationProposal(state, aiPlayer, candidate, threshold, rankIndex, options)`
  - Uses safe evidence summaries and statement memory.
  - Still receives raw player candidate.
  - Target: candidate should be a `targetView` with public name/alive/ghost/suspicion/evidence summary fields.

### Suspicion Heuristics

File: `scripts/ai.js`

- `initSuspicionForAI(...)`
  - Uses `evilPrior(state, viewer)`, which reads `viewer.team`.

- `applyClaimSignals(...)`
  - Uses visible claims, public claim maps, bluff ids, and role ids.
  - Mostly view-like already, but should be fed by `agentView.visibleClaims`.

- `applyNominationSignals(...)`, `applyVoteSignals(...)`, `applyObservedSpeechSignals(...)`, `applyObservedPrivateSignals(...)`, `applyNightPatternSignals(...)`
  - Mostly consume observations/evidence, but still operate on raw `state`/`aiPlayer`.
  - Target: pass `agentView` plus public procedure state.

- `enforceEvilCoordination(...)`
  - Uses known ally ids and should remain evil-view-only.
  - Target: use `agentView.knownAllies`.

- `rankTargets(aiPlayer, state, limit)`
  - Uses `state.players`, `player.isHuman`, `player.alive`, `aiPlayer.suspicion`, and reason flags.
  - Target: rank over `agentView.targets`.

## Partially Safe Helpers Needing Renaming

These helpers are useful, but their names do not make the visibility boundary obvious enough.

- `roleForPlayer(state, player)`
  - Returns effective/actual role.
  - Should be treated as rules/truth only and not called by dialogue code.

- `perceivedRoleForPlayer(state, player)`
  - Returns perceived role and falls back to actual role.
  - Safer than `roleForPlayer(...)`, but still too easy to misuse.

- `getKnownBluffRoleIds(state, viewerPlayer)`
  - Safe if the agent was correctly initialized, but should be a field on `agentView`.

- `getVisibleClaims(state, viewerPlayer)` / `getVisibleSpeeches(state, viewerPlayer)`
  - Good visibility helpers, but should become part of `agentView.visibleClaims` and `agentView.visibleSpeeches`.

## Proposed Agent View Shape

The next pass should introduce a view builder with an explicit contract:

```js
buildAgentView(state, viewer, options = {
  audience: "public" | "private" | "self",
  targetId: null,
})
```

Suggested fields:

- `viewerId`
- `day`, `night`, `phase`, `dayStage`
- `self.name`, `self.alive`, `self.teamKnownToSelf`, `self.roleKnownToSelf`, `self.perceivedRoleId`
- `knownAllies`, `knownDemonId`, `knownMinionIds`, `knownBluffRoleIds`
- `visibleClaims`, `visibleSpeeches`, `visibleVotes`, `visibleDeaths`, `visibleNominations`
- `evidenceForTarget(targetId, options)`
- `summariesForTarget(targetId, options)`
- `trailForTarget(targetId)`
- `targets[]` containing public seat/name/alive/dead/ghost-vote/suspicion/reason flags
- `audienceRelation`: self, known ally, outsider, human, unknown
- `canUsePrivateEvidence`
- `canRevealEvilKnowledge`

Rule of thumb: dialogue helpers should never call `getEffectiveRoleId(...)`, inspect `state.demonBluffs`, or read `player.team` directly. If they need that information, it should already be present in `agentView` with an explicit reason.

## Migration Order

1. Done: add `buildAgentView(...)` in `scripts/ai_agents.js`.
2. Done: add tests proving a good `agentView` does not contain demon bluffs, evil team lists, or hidden roles.
3. Done: convert `collectEvidence(...)` to accept `agentView`.
4. Partially done: convert player-facing private/public dialogue paths to pass `agentView`, while keeping wrapper compatibility.
5. Partially done: convert nomination proposal evidence reads to use `agentView`; vote still needs a narrower strategy context.
6. Remaining: remove direct dialogue-layer calls to `roleForPlayer(...)`, `state.demonBluffs`, and `player.team`.
7. Remaining: add broader regression tests that scan generated dialogue for hidden bluff labels, evil-recognition terms, and raw private whisper text.

## SourceTrust Gaps

Current status:

- `sourceTrust` exists on agents.
- Evidence weight uses `sourceTrust` if present.
- Private player claims and poisoned/drunk information carry higher contamination risk.
- `sourceTrustByPlayerId` now tracks per-player source trust.
- `trustEvents[]` records verified claims, false claims, validated votes, and abnormal votes.
- Existing evidence from a source player is updated when that player's trust changes.

Missing:

- decay or forgiveness over days
- richer role-specific lie interpretation, for example treating some evil bluffing as strategically expected rather than just lowering trust
- social trust sharing between agents

Recommended next fields:

- `agent.claimReliabilityByPlayerId[playerId]`
- `agent.voteReliabilityByPlayerId[playerId]`
- `agent.socialTrustByPlayerId[playerId]`

## Strategy Persona Gaps

Current status:

- Persona affects thresholds, prefixes, cadence, and some public pressure tone.
- Statement memory now affects later public vote/nomination consistency.
- Persona now changes strategy:
  - pressure persona ranks evidence-backed targets higher, votes earlier with evidence, and nominates at a lower threshold
  - steady persona penalizes weak-evidence targets and waits longer before voting
  - shadow persona weights vote anomalies, claim flips, bluff hits, and pattern evidence more heavily

Missing:

- information-holder persona: delays claims, asks more identity-range questions
- coalition builder persona: prioritizes trust networks and protects verified claims
- chaos/evil bluff persona: creates plausible but conflicting good-worlds when evil

These should be implemented after `agentView`, otherwise persona logic may accidentally gain access to hidden truth.

## Lightweight Knowledge Graph

Current status:

- Each AI agent now owns `knowledgeGraph: { version, nodes, edges }`.
- The graph is populated incrementally in `pushEvidence(...)`, so runtime cost is paid when evidence is written, not during every dialogue generation.
- Node count is capped at 420 and edge count is capped at 680 per AI.
- Current node types:
  - `player`
  - `role`
  - `evidence`
- Current edge types:
  - `source_of`
  - `about_player`
  - `night_info_about`
  - `claimed_role`
  - `whispered_to`
  - `nominated`
  - `voted_yes_on`
  - `voted_no_on`
  - `revealed_as`
  - `public_accused`
  - `public_defended`
- Private whisper edges only enter participant agents' graphs because they are created from participant-scoped evidence writes.
- `buildAgentView(...)` exposes `graphForTarget(...)`.
- `computeGraphPressureForTarget(...)` reads the viewer's graph for a target and converts selected edges into a small bounded pressure delta.
- Current graph pressure signals:
  - verified public claim reduces suspicion pressure slightly
  - contradicted claim plus reveal increases suspicion pressure
  - abnormal vote edges can increase pressure
  - validated vote edges can reduce pressure slightly
  - nomination edges add light social pressure
  - night information adds only weak pressure and is reduced when contaminated
  - role-claim conflicts add pressure when multiple visible players claim the same role
  - public defense of a high-pressure target adds social-alignment pressure
  - public accusation of a low-pressure target adds social-alignment pressure
  - low source trust adds a small pressure signal when the target has become an unreliable information source
  - high source trust slightly protects a target when the target has been a reliable information source
- `buildDialogueEvidenceContract(...)` prepends 1-2 safe KG reasons when available, so AI explanations can say why a target is being revisited without leaking hidden truth.
- `extractGraphReasonChains(...)` converts local KG motifs into top-K short chains for dialogue and nomination explanations.
  - current chain types include false claim, verified claim, role conflict, public defense of hot targets, public pressure on cold targets, night-info risk, and low source trust
  - chains are capped and visibility-filtered; public contexts request public-only chains
- `buildGraphFollowUpPrompts(...)` turns selected chains into private follow-up suggestions, so AI can say what it would ask next instead of only giving a static conclusion.
- `renderDialogueActs(...)` is now the light expression layer for private reason/plan/generic/vote replies and public pressure/probe/nomination lines:
  - it consumes structured values from evidence/KG output
  - it chooses persona-specific local corpus templates
  - it does not create new facts or alter suspicion
- Public discussion now uses `public.dialogueActs` as its main utterance body, then applies debate-beat prefixing and evidence-contract enforcement.
- Nomination proposals use the same renderer but now keep player-facing reasons conversational (`先提上台` / `正面回应`) instead of exposing internal `自动提名` / `压力提名` labels.
- `playerStyleEvidenceSummary(...)` adds `evidenceContract.spokenText`, a short player-facing summary such as "身份撞车", "票型反着走", or "夜信可能脏"; full `evidenceContract.text` is still preserved for audit and tests.
- `applySpeechBudget(...)` caps public/private/nomination utterance length and preserves the short evidence sentence when trimming.
- `public.dialogueActs.*.challengeResponse` handles defense/质询 beats, so AI can answer table pressure instead of repeating the generic push line.
- `publicDialogueActForContext(...)` maps debate context into expression acts:
  - `defense` -> `challengeResponse`
  - `nomination-pressure` -> `nominationPressure`
  - `vote-intent` -> `voteIntent`
  - other public beats still choose probe/pressure from suspicion score
- `private.dialogueActs.*.deadPrivate` adds death-context wording for dead AI private replies, so dead players speak like they are giving a readable legacy line instead of sounding fully alive.
- `public.evilPerformance.*` and `private.evilPerformance.*` are the outward-facing evil performance corpus:
  - used by `renderDialogueActs(...)` when the speaker has an evil perspective and the audience is public or non-ally private
  - covers public pressure/probe/defense/nomination/vote-intent acts, private reason/plan/generic/vote/dead-private acts, and private claim cover
  - deliberately sounds like a normal player using table evidence, and must not include evil-only terms such as ally identity, demon bluff, grimoire, or real evil role
- `private.evilAlliance.*` remains the only corpus intended to discuss true evil-team information; it is used only for known-allied private conversations.
- `state.aiDialogue.statementMemory` now keeps a bounded recent-turn history:
  - `recentTurns` stores the last few structured public/private statement summaries
  - `consecutiveFocusCount` tracks whether the AI is repeatedly holding the same target
  - `previousEvidenceSummary` and `previousStance` let continuity lines mention the earlier reason rather than only saying "same target"
- Private and public continuity lines now distinguish same-focus persistence from focus switching:
  - same focus: "still on this line" plus the previous evidence summary when available
  - explicit private switch: acknowledges the previous target and says the user asked about the new one
  - public switch: frames it as pressure shifting, not as forgetting or silently washing the previous line
- Private player-facing answers now use a lightweight Q&A wrapper before the longer persona/evidence line:
  - `directAnswerForPrivateQuestion(...)` emits a short `短答：...` sentence based on detected intent
  - `followUpQuestionForPrivateAnswer(...)` adds a concrete next question for reason/plan/vote style replies
  - the wrapper uses the existing evidence contract and focus selection; it does not add hidden facts or change suspicion
- The in-game pragmatics layer is a post-expression tone pass:
  - `pragmaticPressureContext(...)` reads public/current state pressure such as dead/alive, nomination status, day stage, focus score, low-evidence state, and self heat
  - `pragmaticLineForSpeech(...)` chooses a short defensive/urgent/hedging line
  - `applyInGamePragmatics(...)` prepends that line before speech budget and evidence-contract enforcement
  - this layer changes how a line is framed, not who the AI suspects or what evidence it can see
- The conversational polish layer removes template/debug artifacts after expression rendering:
  - `polishConversationalText(...)` rewrites phrases such as "分两层看", "核心还是", private-evidence boilerplate, and parenthesized suspicion labels
  - `formatFocus(..., false)` now uses only the player label in conversational contexts, avoiding outputs like `5号（暂时偏清白）`
  - dialogue evidence summaries now use shorter table-talk wording such as "有人私下提到 5 号"
- `applyHumanSpeechCadence(...)` now tracks per-AI `speechStyleMemory` and cools down repeated stock phrases such as "证据线", "口径", and "复核".
- `personaAdjustedTargetScore(...)` applies the same bounded KG pressure, so KG can affect target selection and nomination focus.
- Persona now scales KG pressure:
  - pressure persona uses KG slightly more aggressively
  - shadow persona weights graph patterns most strongly
  - steady persona treats KG as useful but weaker supporting context
- `updateAgentSourceTrustForPlayer(...)` now refreshes affected KG edge trust values, so graph pressure uses current source reliability instead of stale write-time values.
- Evil AI can use public KG chains as a weak framing opportunity:
  - known evil allies are still filtered out
  - framing only adds a small ranking bonus
  - nomination proposals expose `framing: true` when the proposal is backed by a public KG chain

Performance note:

- The graph is intentionally a lightweight local structure, not a global graph database.
- For a normal single game, the graph remains small enough for simple array scans.
- Graph lookup is local to one agent and one target, and the score delta is capped at `[-0.14, 0.16]`.
- The graph is not a truth solver: it only reflects the agent's visible evidence writes, and public dialogue asks for `publicOnly` graph pressure.

Fun/fairness guardrails:

- Each AI owns its own graph; there is no shared perfect table graph.
- Private edges only reach participants.
- Good AI graphs do not receive demon bluff truth or evil-recognition truth unless the rules made it visible to that agent.
- Contaminated night information is explicitly down-weighted.
- KG pressure is small compared with suspicion, persona, public memory, and procedural constraints.
- Low-evidence pressure must still be labelled as weak pressure rather than hard proof.
- Different persona profiles weight the same KG pattern differently, so agents do not converge on identical optimal play.
- Evil framing uses public chains and does not receive hidden good-role truth from the graph.

## Current Risk Rating

- Hidden-info leak risk in final dialogue: low-to-medium.
- Hidden-info leak risk through evidence summary helpers: low.
- Public use of private raw text: low-to-medium, mostly guarded but old `privateNotes` remain brittle.
- Strategy inconsistency risk: medium, improved by statement memory but not fully persona-driven.
- Direct truth read sprawl: medium; `agentView` has landed for evidence reads, but claim and evil-alliance helpers still need migration.
