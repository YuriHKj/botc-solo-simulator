# BMR rule-fidelity verification — 2026-07-20

## Scope and prerequisite evidence

- Base branch: `origin/dev`
- Recorded base SHA after `rtk git fetch origin`: `0c32bf6d13ee2497305e9d4d2146b0673acfd388`
- X05 merge evidence: [PR #5](https://github.com/YuriHKj/botc-solo-simulator/pull/5), merged into `dev` at the recorded SHA.
- Prior issue evidence: [Issue #4](https://github.com/YuriHKj/botc-solo-simulator/issues/4), closed 2026-07-20.
- Worktree: `C:\Users\11507\Documents\Playground-bmr-rule-fidelity`
- Branch: `codex/bmr-rule-fidelity`
- Frozen shared engine, role registry, package scripts, viewmodel, action bridge, capability files, and existing tests were not edited.

## Reproduction before implementation

The focused contract was added before its runtime audit exports and run with:

```text
rtk node tests/bmr_rule_fidelity_contracts.mjs
```

Expected red result:

```text
SyntaxError: The requested module '../scripts/roles/bmr.js' does not provide an export named 'BMR_NIGHT_ORDER'
exit_code=1
```

This reproduced the absence of an auditable official-order ledger before implementation. The same contract subsequently exposed old behavior for Pukka ordering, probabilistic Shabaloth revival, charged Po target count, Pacifist/Tinker hidden chance, Moonchild alignment timing, Innkeeper death coverage, and Chambermaid static wake inference.

## Implemented local changes

- Exported a 25-role `BMR_RULE_FIDELITY` ledger and official first/other-night order oracle.
- Exported named Storyteller and AI policy registries; focused tests reject inline random probability thresholds and `Math.random` in the BMR module.
- Pukka now acts first night, accepts dead targets, selects/poisons before resolving the previous poison, makes the previous target healthy after the death attempt, preserves continuation through Exorcist, and suspends it while Pukka is blocked.
- Shabaloth accepts dead targets, resolves named lowest-seat regurgitation before new attacks, and processes its two death attempts sequentially.
- Charged Po preserves charge through an Exorcist skip and completes three sequential local selections when enough targets exist, supplementing the legacy two-target human plan shape.
- Zombuul, Mastermind, Fool, Tea Lady, Devil's Advocate, Innkeeper, and Sailor death/protection paths re-check actual source state and strict protection before consumable saves.
- Pacifist uses a logged first-eligible-good-execution policy; Tinker uses explicit scheduled checkpoints only; Gossip unparsed statements are explicitly false instead of randomly adjudicated.
- Moonchild AI/persisted local records snapshot target alignment and check Moonchild ability at resolution.
- Grandmother grief is queued to its late-night slot, and Chambermaid information is computed from actual own-ability wake receipts after night callbacks.
- Assassin and Po AI optional-use choices use named state predicates instead of hidden probability thresholds.

The full per-role status, official clauses, policy boundaries, and remaining gaps are in `docs/design/BMR_RULE_FIDELITY_MATRIX.md`.

## Shared interface requests

No shared implementation was duplicated locally. The remaining seams are tracked as:

- [#7 — sequential target-selection reaction hooks](https://github.com/YuriHKj/botc-solo-simulator/issues/7)
- [#8 — source-aware suspension for ongoing effects](https://github.com/YuriHKj/botc-solo-simulator/issues/8)
- [#9 — fresh-entry revival lifecycle](https://github.com/YuriHKj/botc-solo-simulator/issues/9)
- [#10 — deterministic Storyteller checkpoint context](https://github.com/YuriHKj/botc-solo-simulator/issues/10)
- [#11 — script-owned setup count modifiers](https://github.com/YuriHKj/botc-solo-simulator/issues/11)
- [#12 — execute script-defined night order](https://github.com/YuriHKj/botc-solo-simulator/issues/12)

## Validation results

| Command | Result | Evidence |
|---|---|---|
| `rtk node tests/bmr_rule_fidelity_contracts.mjs` | PASS | 14 focused contracts, including exact 25-row matrix and shared-boundary coverage |
| `rtk npm run test:role-actions` | PASS | `role action contracts ok` |
| `rtk npm run test:night-actions` | PASS | `night action completeness contracts ok` |
| `rtk npm run test:passive-info-queues` | PASS | `passive info and storyteller queue contracts ok` |
| `rtk npm run test:full-game-loop` | PASS | `full game loop contracts ok` |
| `rtk npm run unity:sync-build-core` | PASS | Generated build runtime refreshed; the final incremental refresh copied 2 project-mirror files |
| `rtk npm run test:unity-build-core-sync` | PASS after generation | `Unity build JS core is in sync.` |
| `rtk npm test` | PASS | All product, role, AI, Electron, Unity contract, acceptance, asset, audio, and mojibake stages completed with exit 0 |

`npm test` printed pre-existing stable-track noncompliance notices for `tb-unity-deterministic`; this change did not edit capability configuration or maturity evidence.

## Formal Unity root-to-project sync and build

After Unity 2022.3.62f3 was activated, the required formal command completed:

```text
rtk powershell -NoProfile -Command "& 'C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe' -batchmode -quit -projectPath 'C:\Users\11507\Documents\Playground-bmr-rule-fidelity\unity-prototype' -executeMethod BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows"
```

Unity `Editor.log` ended with:

```text
Exiting batchmode successfully now!
Exiting without the bug reporter. Application will terminate with return code 0
```

`SyncJsCoreForSelfBootstrap` formally generated the tracked BMR mirror and `BuildWindows` produced the ignored playable at:

```text
C:\Users\11507\Documents\Playground-bmr-rule-fidelity\unity-build\BOTC_Unity_Prototype.exe
```

The root module, tracked project mirror, and built StreamingAssets copy all contain the synchronized BMR implementation. The root and tracked project mirror SHA-256 values are identical:

```text
DB0E6C04C4938AD8B833AB6EB2C7486320389710453FEB746638E0B7C739B572
```

The formal command also refreshed unrelated Unity metadata and mirrored three unrelated root scripts. Those command-generated side effects were removed after verification so the tracked change remains within the exclusive BMR mirror scope; the BMR mirror itself was not copied manually.
