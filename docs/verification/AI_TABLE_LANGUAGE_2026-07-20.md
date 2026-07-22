# AI Table Language Verification - 2026-07-20

## Scope and provenance

- Branch: `codex/ai-table-language`
- Base and merge-base: `origin/dev` at `0c32bf6d13ee2497305e9d4d2146b0673acfd388`
- Verification is deterministic and offline. The LLM comparison used the repository mock provider; no online model was required.
- The frozen flagship evaluator, flagship contracts, seeds, thresholds, categories, engine, bridge, viewmodel, and Unity C# have no diff from `origin/dev`.

## Warning baseline and result

The baseline was remeasured instead of relying on older zero-warning notes.

| Measurement | Lines | Warnings | Classification |
|---|---:|---:|---|
| Before | 22 | 15 | 12 `too-many-sentences`; 3 `future-script` |
| After | 22 | 0 | none |

The warning policy was not weakened. Contract fixtures still prove that three-sentence public speech, future nomination/vote scripts, report-style analysis, and repeated table actions are rejected. The implementation also adds `analysis-report` and `repeated-table-action` checks and broadens `future-script` coverage.

## Deterministic before/after samples

### Public table response

Before:

> 提名前重新看7号：我先看7号。前面发言没讲清楚，我会问7号，身份和昨晚信息，我先排7号，不是放过1号：7号这边公开线索更多。这条让7号把没讲清的点补上，昨晚信息也要说完整。

After:

> 我先回应质疑：先请7号把没讲清的点补上，昨晚信息也要补清。

The final line keeps the current event, target, public evidence, and immediate question in one sentence.

### Explicit target switch in private chat

Before:

> 嗯，我接着刚才那条说。我先看8号。前面发言没讲清楚，1号还在视野里，但 8号这条更适合先拿来校验。8号先分来源再看节奏：能单独对上的先加权，互相复述的先压低。收益线要拆开：谁因为这轮压力变轻，谁就要补公开理由。

After:

> 好，我直接答。我先把1号那条暂放一边，换到 5号，是因为你明确问到 5号。不是说前面那条作废。

The final line acknowledges the player's prompt, names the old and new targets, and explains the switch without analysis-report language.

### Nomination

Before:

> 我先提7号。这条还没到拍死，但前面发言没讲清楚，这点过不去，先听防守。不是放过4号，是7号这边公开线索更多，先上台更好验。这票不是空过，先当压力测试，票面约 0.5/5，重点看回应、站边和票型。

After:

> 我先提7号：发言没讲清，先听防守，不是放过4号，是7号公开线索更多。这票不是空过，先当压力测试，重点看回应、站边和票型。

The target, evidence, alternative target, nomination reason, and vote rationale remain explicit; the internal numeric score is gone.

## Safety and consistency evidence

The fixed quality set contains 127 rows and reports:

- `hiddenLeakCount = 0`
- `mechanicalArtifactCount = 0`
- `evilPrivateCoordinationCoverage = 1`
- `aiToAiEvilCoordinationCoverage = 1`
- `nominationDefenseAwareVoteCoverage = 1`
- `nominationReasonAnchoredDefenseVoteCoverage = 1`
- `crossScriptNominationDefenseAwareVoteCoverage = 1`
- `publicTableSpeechBrevityCoverage = 1`
- `publicSurfacePolishCoverage = 1`
- `repetitionRate = 0.122`

Dedicated contracts prove that ordinary private text cannot acquire a larger budget merely by containing identity words, allied evil truth stays inside authorized private speech, and copying the same material to public restores the two-sentence public cap. Public output retains only player-visible evidence.

## Mock, final, and fallback comparison

`rtk npm run ai:llm-dialogue-eval` used `Provider: mock` and produced 50/50 passing rows:

| Path | Result |
|---|---|
| Deterministic draft / current classification | 15 warnings |
| Mock-rendered final | 0 warnings |
| Final player-visible output | 0 warnings; 50/50 rows passed |
| Guarded fallback | 9 rows; all remained passing |

`test:ai-llm-dialogue-eval` additionally exercises accepted mock output, rejected mock output, final rendering, normal fallback, and renderer-disabled fallback without network access.

## X05 frozen replay evidence

`rtk npm run test:ai-flagship-replay` passed without changing the evaluator or its contracts:

- Seeds `260609`, `260610`, and `260611` all ended in evil wins after 4 days.
- Public duplicate reasons: 0.
- Unexplained cross-day target shifts: 0.
- Empty nomination reasons: 0.
- Stance-vote mismatches: 0.
- Information-boundary violations: 0.
- Mutation sensitivity: 13/13; harmless rewording still passes.
- Frozen `MAX_DAYS = 16`, all maximum-violation thresholds remain 0, and denominator floors remain at least 1.

The standalone replay completed in 42.6 seconds. The full suite independently reran the same three seeds and 13 sensitivity cases successfully.

## Unity mirrors

The canonical files and these project mirrors are byte-identical under contract:

- `ai_dialogue_smoke.mjs`
- `ai_public_discussion.js`
- `ai_speech_corpus.json`
- `ai_speech_renderer.js`

`rtk npm run unity:sync-build-core` copied the changed project mirrors into the existing Unity build, and `rtk npm run test:unity-build-core-sync` confirmed that build-core files are in sync.

## Validation matrix

| Command | Result |
|---|---|
| `rtk node tests/ai_table_language_contracts.mjs` | pass |
| `rtk npm run ai:dialogue-smoke -- --strict` | pass; 22 lines, 0 warnings |
| `rtk npm run test:ai-agents` | pass |
| `rtk npm run test:ai-quality-eval` | pass |
| `rtk npm run test:ai-flagship-replay` | pass; 3 seeds, 13 sensitivity cases |
| `rtk npm run test:ai-llm-dialogue-eval` | pass |
| `rtk npm run ai:llm-dialogue-eval` | pass; mock, 50/50 rows |
| `rtk npm run unity:sync-build-core` | pass |
| `rtk npm run test:unity-build-core-sync` | pass |
| `rtk npm test` | pass, including Unity demo acceptance and a second flagship replay |
| `rtk git diff --check origin/dev` | pass |

## Review notes

The multi-persona review found and fixed high-priority issues around negated claim continuity, claim-plus-continuity evidence retention, future-script corpus variants, terminal priority compaction, hidden-truth budget isolation, repeated target actions, current vote wording, and project-mirror drift. No P0/P1 issue remains after the final validation matrix. The optional cross-model shell reviewer could not run because Bash/WSL was unavailable; correctness, testing, API-contract, adversarial, maintainability, agent-native, and local learnings reviews still completed.
