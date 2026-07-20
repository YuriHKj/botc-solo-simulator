# Causal Flagship Replay Lab Verification - 2026-07-13

Final execution and repository-wide verification were performed on 2026-07-14. The 2026-07-13 filename matches the implementation plan and the date on which the corpus and thresholds were locked.

## 2026-07-20 Delivery Replay And Review Closure

This section is the current delivery rerun. The locked corpus, untouched baseline, threshold formulas, 13-case sensitivity matrix, capability claim boundary, and 2026-07-14 full-report measurements in the historical sections below were not rewritten. The current run used branch `codex/x05-causal-flagship-replay`, starting from `53d6e0e57de748e215c0d814e3048cad00adcbad`, plus the two review fixes described here. The final documentation commit is intentionally created only after this record is complete.

### `dev...HEAD` code review

`compound-engineering:ce-code-review` reviewed the full branch diff with correctness, testing, maintainability, project-standards, agent-native, learnings, performance, API-contract, reliability, and adversarial lenses. The untracked verification note was excluded from code scope. Two independently validated P1 findings were fixed; no P0 or remaining actionable finding survived synthesis.

1. The continuity gate accepted a standalone generic time/current-state word such as `今天` or `继续` as a sufficient explanation for a cross-day target change. A direct controlled reproduction using `今天只核这个公开目标和票型。` therefore passed incorrectly. The gate now requires either explicit revision language or a prior-day reference paired with a continuity relation. The existing `continuity-cross-day-flip` case was strengthened with that input; its ID, category, case count, seeds, thresholds, and capability claim did not change.
2. `safeRunFlagshipReplay` collapsed a real mid-replay exception into an empty day-0 fatal record. The wrapper now retains already-produced public trace, day/phase, nearest public event, and the last safe action while exposing only the bounded error type, not the raw error message. An injected day-3 failure proves that later seeds still run and that a sensitive string in the thrown message is absent from diagnostics.

Review artifacts are disposable local workflow evidence under `/tmp/compound-engineering/ce-code-review/20260720-154838-x05/`; they are not repository source.

### Final 2026-07-20 command results

All commands below were rerun after the two review fixes unless a row explicitly describes a static repository check.

| Command | 2026-07-20 result | Current evidence |
| --- | --- | --- |
| `rtk node scripts/ai_flagship_replay_eval.mjs` | pass | `ok=true`; seeds `260609`, `260610`, and `260611` each ended evil in 4 days; both runs passed; sensitivity 13/13; zero failures; evaluator `elapsedMs=46585`. |
| `rtk npm run test:ai-flagship-replay` | pass | 3 locked seeds and the unchanged 13 sensitivity cases passed; final focused run reported 56.215 s. |
| `rtk npm run test:ai-agents` | pass | AI agent contracts passed after the review fixes. |
| `rtk npm run test:ai-quality-eval` | pass | Deterministic AI quality contracts passed after the review fixes. |
| `rtk npm run test:product-capabilities` | pass | Capability contract, generated claim-boundary text, failure continuation, and revision/hash binding contracts passed. Expected negative fixtures reported noncompliant stable-track diagnostics without failing the test. |
| `rtk npm run capabilities:check` | pass | The capability contract is structurally valid and generated README/status text is current. |
| `rtk npm run capabilities:verify -- --as-of 2026-07-20` | pass | 7/7 declared evidence commands exited 0; current stable evidence is compliant. Its final replay subcommand reported 48.719 s, below the 120-second command budget. |
| `rtk npm test` | pass | The final full JS/Electron/AI/Unity contract chain passed; replay appeared exactly once and reported 46.569 s; mojibake also passed. |

### Final static and repository-safety checks

| Check | 2026-07-20 result |
| --- | --- |
| `rtk node --check scripts/ai_flagship_replay_eval.mjs` | pass |
| `rtk node --check scripts/ai_public_discussion.js` | pass |
| `rtk node --check scripts/product_capability_contract.mjs` | pass |
| `rtk node --check scripts/run_product_capability_ci.mjs` | pass |
| `rtk node --check tests/ai_flagship_replay_eval_contracts.mjs` | pass |
| `rtk git diff --check` | pass; no whitespace errors |
| `rtk npm run test:unity-build-core-sync` | pass; root and StreamingAssets JS core mirrors are synchronized |
| `rtk npm run test:mojibake` | pass |
| `rtk git diff --exit-code dev...HEAD -- package-lock.json` | pass; no dependency or lockfile change |
| `rtk git check-ignore -v output/ai_flagship_replay/flagship_replay_evaluation_2026-07-14.json` | pass via `.gitignore:21:output/` |

The 2026-07-14 full report remains 72,546,868 bytes (approximately 69.19 MiB) with its original 2026-07-14 timestamp. It was checked for existence, size, and ignore coverage on 2026-07-20 but was not regenerated or staged. The 2026-07-20 replay command emitted only the compact stdout summary; current capability and Unity acceptance outputs remained under ignored `output/` paths.

The final capability boundary is unchanged: this evidence certifies only the eight locked replay invariants for the three fixed seeds. It still does not certify general natural-language quality, the known sentence-density or scripted-future-action warning families, or generalization to unseen seeds. Issue #2 remains unrelated and open for hosted Unity C# compile evidence.

## Scope And Authority Boundary

This verification covers a fixed-seed Trouble Brewing replay evaluator, its deterministic-AI behavior gates, controlled defect-sensitivity contracts, and revision-bound stable capability evidence.

The JS core remains the source of truth for rules, AI decisions, permissions, and information visibility. The evaluator consumes the real JS lifecycle and does not transfer authority to Unity or to test fixtures. The implementation made no Unity UI or C# change, no bridge JSON-contract change, no role or BOTC script addition, no dependency or `package-lock.json` change, and no packaging or release change.

The only runtime behavior correction was a narrow JS public-discussion continuity repair. The matching root and Unity StreamingAssets JS mirrors are synchronized. No screenshot or Unity batch build was required because this is a non-UI diff; hosted Unity C# compilation is discussed separately under Remaining Evidence.

## Locked Corpus And Human Policy

The ordered candidate list was predeclared as `[260609, 260610, 260611, 260612, 260613]`. The first three candidates satisfying journey-only coverage were selected in that order, before coherence threshold inspection: `[260609, 260610, 260611]`. Neither the candidate list nor the selected seeds changed after behavior evaluation began.

| Property | Locked value |
| --- | --- |
| Script | Trouble Brewing (`tb`) |
| Main corpus | Exactly 3 games, seeds `260609`, `260610`, `260611` |
| Player count | 9 |
| Day bound | `MAX_DAYS = 16` |
| Human role | Washerwoman |
| Human vote policy | Always yes |
| Human nomination policy | None; nominations are AI-only |
| Human public speech | None |
| Quality denominators | AI-only; the human harness is excluded |
| Determinism comparison | Two fresh runs per seed over semantic `deterministicIdentity` |

Every selected game covered four public discussion days, real AI nominations, AI voting, day-end execution handling, and a declared winner.

## Threshold Freeze And Untouched Baseline

The source constant records the freeze point as `untouched-u1-ai-before-runtime-correction`. Raw metrics were captured from the selected seeds before the runtime correction. The seeds, maximum violations, minimum denominators, and formulas were never replaced or relaxed after the locked defect was observed.

### Raw pre-fix baseline

| Seed | Winner | Days | AI speech | AI nominations | AI votes | Boundary observations | Duplicate reasons | Cross-day transitions | Changes | Unexplained changes | Nomination reasons / empty | Visible vote statements | Comparable votes / mismatches |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | --- |
| `260609` | evil | 4 | 32 | 7 | 54 | 32 | 0 | 24 | 20 | 1 | 7 / 0 | 47 | 45 / 0 |
| `260610` | evil | 4 | 32 | 7 | 53 | 32 | 0 | 24 | 8 | 1 | 7 / 0 | 46 | 38 / 0 |
| `260611` | evil | 4 | 32 | 6 | 45 | 32 | 0 | 24 | 8 | 1 | 6 / 0 | 39 | 32 / 0 |

### Frozen formulas

- Hard blockers: `required invariant: observed failures must equal 0`.
- Repetition: `max(untouched baseline duplicate reasons=0, required invariant=0) => 0`.
- Continuity: `unexplained target/decisive-stance change is categorical => 0; baseline defects require correction`.
- Nomination: `max(untouched baseline empty reasons=0, required invariant=0) => 0`.
- Vote alignment: `max(untouched baseline parsed mismatches=0, required invariant=0) => 0`.
- Non-vacuity: `untouched minimum denominator > 0 => locked floor of 1`.

All maximum-violation thresholds are zero: completion, determinism, action legality, public-information safety, duplicate public reasons, unexplained cross-day changes, empty nomination reasons, and stance-vote mismatches. All minimum denominator floors are one: public reasons, cross-day transitions, nomination reasons, comparable votes, and information-boundary observations.

## Locked Defect And Smallest Correction

The untouched corpus exposed one real continuity failure in each seed, all on day 4:

- `260609`: player `p5` switched focus to `p2` without a visible revision explanation.
- `260610`: player `p7` switched focus to `p3` without a visible revision explanation.
- `260611`: player `p7` switched focus to `p5` without a visible revision explanation.

The owning-boundary correction is `ensureCrossDayTargetSwitchExplanation` in `scripts/ai_public_discussion.js`. After composing a public line, the discussion layer compares the latest prior-day focus with the current focus. Only a true cross-day target switch whose rendered line lacks existing revision language receives a short continuity prefix; the original public reason is preserved within the existing character budget, and already-explained lines are unchanged. This repaired the player-visible cause at speech emission rather than weakening the gate or editing the corpus. `scripts/ai.js` and `scripts/ai_public_discussion.js` remain synchronized with their Unity StreamingAssets mirrors.

The test-first history also preserved useful red evidence: the replay contract first failed because the evaluator module did not exist; U2 next failed on the absent frozen-threshold export; the locked healthy corpus then failed only the three continuity events above; the focused owning-module contract failed before the repair helper was exported; and the utterance-time oracle contract exposed an undefined `legalKnowledge` sidecar before real speaker-scoped knowledge was wired. None of those failures were resolved by changing a seed or relaxing a threshold.

## Final Healthy Replay Results

| Seed | Winner | Days | AI speech | AI nominations | AI votes | Executions | Identity match | Winner match | Comparison run |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |
| `260609` | evil | 4 | 32 | 7 | 54 | 3 | yes | yes | pass, evil in 4 days |
| `260610` | evil | 4 | 32 | 7 | 53 | 2 | yes | yes | pass, evil in 4 days |
| `260611` | evil | 4 | 32 | 6 | 45 | 2 | yes | yes | pass, evil in 4 days |

The primary and comparison runs had the same metrics and no failures for every seed.

| Seed | Completion / legality / journey failures | Public reasons / duplicates | Cross-day transitions / changes / unexplained | Nomination reasons / empty | Vote statements / comparable / mismatches | Boundary observations / assertions / violations |
| --- | --- | --- | --- | --- | --- | --- |
| `260609` | 0 / 0 / 0 | 32 / 0 | 24 / 20 / 0 | 7 / 0 | 47 / 45 / 0 | 32 / 0 / 0 |
| `260610` | 0 / 0 / 0 | 32 / 0 | 24 / 8 / 0 | 7 / 0 | 46 / 38 / 0 | 32 / 0 / 0 |
| `260611` | 0 / 0 / 0 | 32 / 0 | 24 / 8 / 0 | 6 / 0 | 39 / 32 / 0 | 32 / 0 / 0 |

Paired semantic identities and winners matched for all three seeds. Rendered text is retained in `publicTrace` for diagnosis but excluded from `deterministicIdentity`; exact transcript equality and text hashes are not gates.

## Controlled Sensitivity Matrix

The unchanged healthy control remained green. Every mutation changed only its intended defect class, produced its expected category, produced no unrelated category, and passed its sensitivity assertion.

| Case ID | Intended category | Observed category | Result |
| --- | --- | --- | --- |
| `completion-no-winner` | completion | completion | pass |
| `determinism-identity-drift` | determinism | determinism | pass |
| `action-legality-rejected` | action-legality | action-legality | pass |
| `journey-coverage-zero-speech` | journey-coverage | journey-coverage | pass |
| `information-demon-bluff` | public-information-safety | public-information-safety | pass |
| `information-evil-recognition` | public-information-safety | public-information-safety | pass |
| `information-actual-role` | public-information-safety | public-information-safety | pass |
| `information-actual-team` | public-information-safety | public-information-safety | pass |
| `information-forbidden-marker` | public-information-safety | public-information-safety | pass |
| `repetition-duplicate-visible-reason` | repeated-public-reasoning | repeated-public-reasoning | pass |
| `continuity-cross-day-flip` | cross-day-continuity | cross-day-continuity | pass |
| `nomination-empty-reason` | nomination-justification | nomination-justification | pass |
| `vote-alignment-contradiction` | stance-vote-alignment | stance-vote-alignment | pass |

Result: 13/13 controlled cases passed, the healthy control was unchanged, and the aggregate sensitivity report had zero failures. A harmless rewording that preserves actor, target, stance, action, and outcome remains green, which proves that exact-text equality is not a hidden gate.

## Information Oracle V1 Boundary

The bounded utterance-time oracle covers exactly five finite fact families:

- `demon-bluff:<roleId>` for explicit bluff-disclosure markers paired with a role.
- `evil-recognition:<playerId>` for explicit demon, minion, or ally recognition paired with a player.
- `actual-role:<playerId>:<roleId>` for an unambiguous actual/true-role assertion naming one subject and one value.
- `actual-team:<playerId>:<team>` for an unambiguous actual/true-team assertion naming one subject and one value.
- `forbidden-marker:<tokenId>` for the fixed player-visible backend/private-token denylist.

Authorization is evaluated immediately at speech time against the speaker-scoped knowledge snapshot. Diagnostics expose only an opaque fact-family identifier and safe public event location. V1 intentionally does not detect arbitrary paraphrase, indirect inference, or general semantic leakage; plain role mentions, accusations, hypotheses, legal bluffs, and repetitions of public claims are outside an actual-fact assertion unless they match the finite forms above.

## Stable Capability Claim Boundary

The fixed-seed replay-invariant evidence certifies only these eight declared invariants for the locked corpus:

1. completion;
2. deterministic semantic identity;
3. action legality;
4. bounded v1 public-information safety;
5. repeated-public-reasoning control;
6. cross-day stance continuity;
7. nomination justification; and
8. public-stance-to-vote alignment.

It does not certify general natural-language quality, the known sentence-density or scripted-future-action warning families, or generalization to unseen seeds. Journey coverage is a required non-vacuity prerequisite for the evidence, not an expansion of those eight capability claims.

The final capability runner manifest is bound to revision `worktree:53d6e0e57de748e215c0d814e3048cad00adcbad` and contract hash `sha256:7fc8792f4f7fafebf2fd2d3d0af8b6f00a1135d2fb64e048258139c727e56647`. It recorded all seven reviewed commands with exit code 0.

## Disposable Full Evidence

The full report is `output/ai_flagship_replay/flagship_replay_evaluation_2026-07-14.json` (72,546,868 bytes, approximately 69.19 MiB). It contains the corpus configuration, both fresh runs for every seed, per-game public traces and semantic identities, action checks, information observations, primary and comparison evaluations, aggregate metrics and failures, and all sensitivity cases.

`git check-ignore -v` resolves the file through `.gitignore:21:output/`. It does not appear in `git status --short`, remains disposable generated evidence, and must not be staged. The capability runner manifest and Unity demo acceptance outputs are likewise ignored under `output/`.

## Commands And Results

| Command | Result | Observed runtime or evidence |
| --- | --- | --- |
| Programmatic `runFlagshipReplayEvaluation()` JSON write | pass | Full report written; `report.ok=true`, seeds `[260609,260610,260611]`, sensitivity 13/13, zero failures; observed command wall time about 26.75 s. |
| `node scripts/ai_flagship_replay_eval.mjs` | pass | Compact report: all three seeds and comparison runs passed, sensitivity 13/13, zero failures; evaluator reported `elapsedMs=46851`, below 120 s. |
| `npm run test:ai-flagship-replay` | pass | 3 seeds and 13 cases passed; contract reported 24.525 s, observed process wall time about 29.16 s. |
| `npm run test:product-capabilities` | pass | Contract declaration, exact command pinning, failure continuation, revision/hash binding, generated claim boundary, and doc drift contracts passed in about 4.83 s. |
| `npm run capabilities:write` then `npm run capabilities:check` | pass | First write/check took about 1.12 s / 1.07 s. Second write/check took about 1.12 s / 1.05 s. |
| Second generated-doc write | byte-stable | README SHA-256 stayed `20B16048E84221F542CB191503D6BE7E50A44FFC79A5448E2F6A41D97C01F6B1`; status SHA-256 stayed `05FC27968599989F45C9E3F1FD233ABCFB22D7FF741AC20BBBA9CA8F818C0BEE`. |
| `npm run capabilities:verify -- --as-of 2026-07-14` | pass | About 62.4 s observed; 7/7 evidence commands exited 0 and current stable evidence was compliant. The replay subcommand reported 27.084 s. |
| `npm test` | pass | About 90.0 s observed; complete JS/Electron/AI/Unity contract chain passed and `test:ai-flagship-replay` appeared exactly once, reporting 25.356 s. |
| `npm run test:ai-agents` | pass | Focused runtime-AI contracts passed in about 6.33 s. |
| `npm run test:ai-quality-eval` | pass | Deterministic quality contracts passed in about 8.52 s. |
| `npm run test:unity-build-core-sync` | pass | Root and StreamingAssets JS core copies matched; about 1.25 s. |
| `npm run test:mojibake` | pass | Encoding contracts passed in about 1.30 s. |
| `node --check scripts/ai_flagship_replay_eval.mjs` | pass | Syntax accepted; about 0.45 s. |
| `node --check scripts/product_capability_contract.mjs` | pass | Syntax accepted; about 0.44 s. |
| `node --check scripts/run_product_capability_ci.mjs` | pass | Syntax accepted; about 0.46 s. |
| `git diff --check` | pass | No whitespace errors. |
| `git diff --exit-code -- package-lock.json` | pass | No dependency or lockfile change. |
| `git check-ignore -v output/ai_flagship_replay/flagship_replay_evaluation_2026-07-14.json` | pass | Artifact is ignored by the repository-wide `output/` rule. |
| `git status --short` after generation and validation | pass | Ignored generated artifacts were absent and the worktree was clean before this verification note was added. |

The capability runner executed these reviewed commands in deterministic order, all with exit code 0: `test:role-actions`, `test:unity-demo-acceptance`, `test:unity-viewmodel`, `test:ai-flagship-replay`, `test:full-game-loop`, `test:electron-build`, and `test:ai-llm-renderer`.

## Remaining Evidence And Non-Claims

Hosted Unity C# compile evidence remains [issue #2](https://github.com/YuriHKj/botc-solo-simulator/issues/2). It requires a real Unity Editor, licensing, and path-aware hosted CI. This iteration changed neither Unity C# nor player-facing UI, so issue #2 is unrelated to the replay result and is not claimed as satisfied here.

No visual screenshot, Unity batchmode build, package, or release artifact was produced or required. The verified conclusion is limited to the locked deterministic JS replay corpus, its named invariants, the synchronized embedded JS core, and the revision-bound capability evidence described above.
