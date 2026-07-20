# Hosted Unity C# Compile Evidence - 2026-07-20

## Scope

This record covers GitHub Issue #2: revision-bound Unity 2022.3 C# compile evidence produced on GitHub-hosted infrastructure and consumed by the flagship capability gate. It changes CI/evidence plumbing only. It does not change gameplay rules, AI behavior, Unity UI, viewmodel/action bridge contracts, capability engineering maturity, or distribution posture.

The authoritative editor pin is `2022.3.62f3 (96770f904ca7)` from `unity-prototype/ProjectSettings/ProjectVersion.txt`.

## Evidence Contract

For a compile-affecting pull request or push, the always-present workflow:

1. compares the relevant event revisions and routes conservatively when the diff cannot be established;
2. starts from a fresh GitHub-hosted checkout with no restored Unity `Library`, prior build, or prior evidence artifact;
3. checks for a personal `UNITY_LICENSE` or the professional `UNITY_SERIAL` + `UNITY_EMAIL` + `UNITY_PASSWORD` set;
4. runs commit-pinned GameCI Unity Builder directly at exactly `2022.3.62f3`;
5. uploads `hosted-unity-csharp-evidence/hosted-unity-csharp.json`; and
6. requires the terminal `capability-contract` job to consume that same-run artifact.

The receipt binds `GITHUB_SHA`, the source revision, repository, workflow, run ID, run attempt, GitHub-hosted Linux identity, exact Unity version/revision, license readiness/mode, activation and Unity outcomes, engine exit code, clean-input/cache assertions, status, failure kind, and generation time. The validator rejects missing, malformed, stale, mismatched, locally produced, cached, or non-pass receipts before local Roslyn discovery can run.

A successful Builder action with `engineExitCode=0` records both activation and Unity outcomes as `success`. Once credential inputs are ready, a failed Builder cannot reliably reveal whether activation, import, compilation, or a later build stage failed, so the receipt records both outcomes as `unknown` and uses `unity-activation-or-execution-failed`. Missing inputs remain the distinct `licensing-unavailable` case with both outcomes `not-run`.

The `hosted_unity` job selects the GitHub environment `hosted-unity-compile`. All Unity credentials must exist only as environment secrets behind required trusted reviewers with self-review disabled. The workflow YAML only names the environment; it does not create or enforce those protection settings. Therefore external repository configuration remains a blocker until a maintainer configures and verifies the environment boundary.

The direct command `npm run test:unity-csharp-smoke` remains a local Roslyn diagnostic. A local success is not Hosted Unity evidence.

## Local Verification

| Command or check | Result | Evidence boundary |
| --- | --- | --- |
| `rtk node tests/product_capability_ci_runner.mjs` before the receipt implementation | expected fail | The new proof-first test failed because no hosted receipt was written. |
| `rtk npm run test:product-capabilities` before capability binding | expected fail | The flagship contract did not yet declare `npm run test:unity-csharp-smoke`. |
| `rtk node tests/product_capability_ci_runner.mjs` after workflow implementation | pass | Receipt adversarial cases, exact allowlist/env overlay, Unity failure injection, and workflow static contracts passed. |
| `rtk E:\Anaconda\python.exe -c "import yaml, pathlib; ..."` | pass | PyYAML accepted `.github/workflows/ci.yml` as syntactically valid YAML; GitHub remains authoritative for Actions expression/action validation. |
| `rtk npm run test:product-capabilities` | pass | Contract shape, receipt adversarial cases, exact allowlist/env overlay, hosted failure injection, workflow static contracts, and generated docs passed. |
| `rtk npm run capabilities:check` | pass | Static contract and generated capability documentation are current without requiring an ephemeral hosted receipt. |
| `rtk npm run test:unity-csharp-smoke` | pass (local diagnostic only) | Existing Roslyn compilation produced `CSC_EXIT=0`; this result is explicitly not hosted evidence. |
| `rtk npm run capabilities:verify -- --as-of 2026-07-20` without hosted identity/receipt | expected fail, exit 1 | The runner recorded `npm run test:unity-csharp-smoke` as exit 1, continued all later evidence, and failed `automated-contracts`; contract hash was `sha256:36794ad1f997471d61479e52922908ef859a226b71b308c5a3a479387b91cd14`. |
| `rtk npm test` | pass | Full JS/Electron/AI/Unity contract suite passed, including asset sync and mojibake checks. |
| `rtk node --check scripts/run_product_capability_ci.mjs` | pass | Capability runner syntax accepted. |
| PowerShell `[scriptblock]::Create(...)` parse | pass | `tools/unity_csharp_compile_smoke.ps1` parsed successfully. |
| `rtk git diff --check` | pass | No whitespace errors. |
| `rtk git diff --exit-code -- package-lock.json` | pass | No dependency or lockfile change. |
| Capability declaration audit | pass | `config/product_capabilities.json` adds only the hosted evidence entry; maturity, default selection, distribution class/status, and blockers are unchanged. |

## Hosted Run Observation

Status before the pull request is opened: **pending**. No hosted compile success is claimed by this record.

`rtk gh secret list` returned no repository-level Actions secrets during preflight. Repository-level Unity credentials are intentionally not an acceptable substitute for the protected environment boundary. The observation does not prove that organization or environment secrets are unavailable, or that `hosted-unity-compile` has the required protection; the first real hosted run and repository environment settings are authoritative. If GameCI credentials are unavailable, the expected machine result is `licensing-unavailable`, both producer and terminal gate remain red, and Issue #2 remains open.

The first hosted run will be recorded here once. That documentation commit necessarily creates a second run because the pull request's full base-to-head diff still includes compile-certification changes. The second run is the authority for the final documented PR revision and will be reported through its immutable artifact, PR check, and delivery summary without another self-invalidating commit.

| Field | First observed hosted run |
| --- | --- |
| Pull request | pending |
| Workflow run URL | pending |
| Run ID / attempt | pending |
| Tested revision (`GITHUB_SHA`) | pending |
| Source revision | pending |
| Receipt artifact/status | pending |
| License mode/outcome | pending |
| Terminal `capability-contract` | pending |

## Closure And Release Guard

- The pull request targets `dev` and links Issue #2 without an auto-closing keyword.
- Issue #2 stays open unless the final pull-request revision receives a real passing Hosted Unity receipt and the same run's terminal capability gate accepts it.
- A missing secret, unprotected/misconfigured environment, combined activation-or-execution error, absent artifact, or identity mismatch is a blocker, not a waivable success.
- No result in this work promotes the capability or changes its public-distribution block.
- No build or cached Unity directory is committed or treated as evidence.
