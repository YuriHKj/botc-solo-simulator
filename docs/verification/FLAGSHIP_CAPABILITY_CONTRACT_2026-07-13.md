# Flagship Capability Contract Verification - 2026-07-13

## Scope

This verification covers the product-capability contract introduced for the repository's maintained product promise. The change classifies product tracks, renders checked status documentation, and binds current CI evidence to a revision and contract hash. It does not change JS Core rules, AI decisions, Unity viewmodels/actions, Unity C# UI, roles, or runtime assets.

## Initial Product Contract

| Track | Engineering maturity | Default | Public distribution |
| --- | --- | --- | --- |
| Unity + Trouble Brewing + deterministic AI | stable | yes | blocked |
| Bad Moon Rising | laboratory | no | blocked |
| Sects & Violets | laboratory | no | blocked |
| Electron player UI | laboratory | no | blocked |
| LocalLLM dialogue renderer | laboratory | no | blocked |

The contract hash observed during final verification was `sha256:774b223ad083f47d172b3086e5bc237a187f848747422b1b9785f8cddc20c0fd`.

Tracked status intentionally renders without ephemeral execution results. Consequently, `ci-run` evidence appears as `unverified` in `docs/CAPABILITY_STATUS.md`; this is not inherited from script existence. `npm run capabilities:verify` executes the declared evidence and supplies a separate manifest bound to the current revision and contract hash.

## Commands And Results

| Command | Result | Observed evidence |
| --- | --- | --- |
| `node tests/product_capability_contracts.mjs` | pass | Schema, five initial tracks, expiring-evidence boundaries, evidence-gated distribution, non-default stable rendering, strict result manifests, malformed-container JSON diagnostics, generated status/README drift, no-write behavior, and one-line/multiline English/Chinese claim rejection passed. |
| `node tests/product_capability_ci_runner.mjs` | pass | Distinct command collection, exact reviewed script definitions, npm lifecycle-hook rejection, bare inspect invocation, Windows argv construction, explicit as-of forwarding, command timeout/continuation, pass/fail manifests, diagnostic bounds, and revision/hash rejection passed. |
| `node --check scripts/product_capability_contract.mjs` | pass | Evaluator/generator syntax accepted. |
| `node --check scripts/run_product_capability_ci.mjs` | pass | Evidence-runner syntax accepted. |
| `npm run capabilities:check` | pass | Contract references, generated status, README managed block, and registered maintained surfaces were current without writes. |
| `npm run capabilities:verify -- --as-of 2026-07-13` | pass | Six distinct declared commands ran exactly once; all returned exit 0. The ignored, versioned manifest used the current dirty-worktree revision identity and the contract hash above. |
| `npm test` | pass | Full repository JS/Electron/AI/Unity contract baseline passed, including Unity bridge/viewmodel/assets/demo acceptance and mojibake checks. |
| `npm run test:mojibake` | pass | No new encoding regression was detected. |
| `git diff --check` | pass | No whitespace errors; Git emitted only expected local LF-to-CRLF checkout warnings. |
| `git diff --exit-code -- package-lock.json` | pass | No dependency or lockfile change. |
| `git check-ignore -v output/product-capability-ci-results.json` | pass | The ephemeral result manifest is ignored through `output/`. |

The real evidence runner also exercised the Windows launch boundary. Running through npm uses `process.execPath` plus `npm_execpath`; direct Node invocation uses a constrained `ComSpec` transport for `npm.cmd`. Both paths keep `shell: false`, accept only the six reviewed script names, and completed successfully.

## Review Hardening

The structured review found fourteen actionable contract/runner gaps. Thirteen were remediated in this change: public-release review now requires a satisfied intended-distribution gate; expiring evidence rejects dates before observation and receives an explicit CI as-of date; parseable malformed containers stay in the JSON diagnostic channel; result manifests enforce schema, version, revision, and contract hash; npm pre/post hooks are rejected; each command has a two-minute timeout and later evidence still runs; entry command and claim aliases live in the contract; non-default stable tracks remain rendered; the maintained June progress baseline links to the current status authority; and README plus multiline classification drift have negative tests.

The one intentionally unresolved review item is hosted Unity C# compilation. It requires a real editor, licensing, and path-aware CI design rather than a fabricated JS-only pass. This is tracked in [issue #2](https://github.com/YuriHKj/botc-solo-simulator/issues/2).

## Behavior-Boundary Audit

- Changed implementation paths are limited to capability metadata/evaluation, generated documentation, runner tests, npm command registration, Git attributes, and GitHub Actions.
- No file under runtime gameplay rules, Unity C# UI, `assets/`, Unity resource mirrors, or StreamingAssets JS mirrors changed.
- No build, model, package, release, or non-ignored output artifact is included.
- `docs/CAPABILITY_STATUS.md` is pinned to LF through `.gitattributes`, so byte-level drift checks remain stable on a clean Windows checkout; the README managed block preserves the README's existing line endings.

## Reconciled Pre-existing Status

The development worktree was clean before this plan began. Two May 15 change requests were still labeled in progress even though their verification records already documented completion. They now point to:

- `docs/verification/UNITY_BOTTOM_DIALOGUE_QUEUE_2026-05-15.md`
- `docs/verification/AI_LLM_RENDERER_QUALITY_2026-05-15.md`

This reconciliation changes status documentation only; it does not claim new runtime work in this change.

## Known Limits And Release Posture

- The checked-in GitHub Actions workflow targets pull requests and pushes on `dev` and `main`, but its hosted run is not proven by this local note. The pull request must supply that external evidence.
- No branch-protection setting was changed or inspected as an enforcement claim.
- Unity Editor/batchmode and visual screenshot checks were not run because no Unity C# or player-facing UI changed. The existing Node/PowerShell-independent Unity contracts and demo acceptance did run through `npm test`; hosted C# evidence remains [issue #2](https://github.com/YuriHKj/botc-solo-simulator/issues/2).
- No release package was produced. Engineering maturity remains independent from distribution permission; every initial track remains blocked for public distribution pending separate rights and release review.
- Laboratory gaps remain visible rather than waived: BMR and SnV lack declared rules-fidelity evidence, Electron lacks a declared player-journey gate, and LocalLLM lacks declared rules-fidelity and player-journey evidence.
