# SnV rule-fidelity verification — 2026-07-20

## Scope and start conditions

- Base branch: latest `origin/dev` at worktree creation, commit `0c32bf6`.
- Worktree: `C:\Users\11507\Documents\Playground-snv-rule-fidelity`.
- Branch: `codex/snv-rule-fidelity`; pull-request base is `dev`.
- GitHub prerequisite: PR #5 (X05) was merged into `dev` at 2026-07-20 08:59:30Z; Issue #4 was closed at 2026-07-20 08:59:50Z.
- Frozen files were not edited: `scripts/engine.js`, `scripts/roles/index.js`, `package.json`, Unity bridge/viewmodel, capability configuration, and existing shared tests.
- Capability maturity was not changed.

## Evidence produced

- The design ledger covers exactly 25 SnV characters across setup, night, day, death, win, character change, alignment, information, and Storyteller discretion: `docs/design/SNV_RULE_FIDELITY_MATRIX.md`.
- The dedicated contract asserts the exact 25-role inventory and an observable lifecycle seam for every entry.
- Priority interaction fixtures use seeds 70201–70213 and directly cover Mutant, Cerenovus, Snake Charmer, Fang Gu, Barber, Vortox, Philosopher, Pit-Hag, and Evil Twin, plus the focused cross-day/death-information boundaries.
- All nine priority interactions execute twice with the same seed. Their projected player state, full SnV state, relevant deaths/executions/information/claims, pending Storyteller actions, semantic rule logs, and winner are byte-equivalent after serialization.
- Seed 70201 certificate: `49ef99425be843c80616eedbcaadd86feb4db4f73ae91b5f6fa84241c4c3ba6f`.
- `scripts/roles/snv.js` contains no `Math.random`. Module-owned `chooseOne`, `sample`, `shuffle`, and random-alive selection calls pass the injected RNG.

## Canonical and Unity mirror evidence

The canonical source, tracked Unity StreamingAssets mirror, and generated `unity-build` mirror share SHA-256:

`7A7D4E82DBC587B0325CBAD2FE2F63A28677680A11BA24B1DC759E4F47FFC70C`

The repository's formal `rtk npm run unity:sync-build-core` command first populated 90 embedded-core files and copied the final SnV delta once more into `unity-build`; the required `--check` contract then passed.

The upstream Unity Editor build entry was also attempted because it normally refreshes the tracked StreamingAssets tree before building:

```text
rtk "C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe" -batchmode -quit ...
No valid Unity Editor license found. Please activate your license.
```

The Editor exited before `SyncJsCoreForSelfBootstrap()` could run. The tracked mirror was therefore reconciled to the canonical patch and byte-normalized, then the repository's available formal build-core sync and parity checks were run. This record does not claim a successful Unity build or licensed Editor sync.

## Required validation

| Command | Result |
|---|---|
| `rtk node tests/snv_rule_fidelity_contracts.mjs` | PASS — seed certificate printed; 25-role inventory, priority transitions, ambient-RNG ban, and mirror parity covered. |
| `rtk npm run test:role-actions` | PASS — `role action contracts ok`. |
| `rtk npm run test:night-actions` | PASS — `night action completeness contracts ok`. |
| `rtk npm run test:passive-info-queues` | PASS — `passive info and storyteller queue contracts ok`. |
| `rtk npm run test:full-game-loop` | PASS — `full game loop contracts ok`. |
| `rtk npm run test:unity-build-core-sync` | PASS — `Unity build JS core is in sync.` |
| `rtk npm test` | PASS — full product capability, role, AI, Electron, Unity contract, asset, acceptance, and mojibake chain completed with exit code 0. |
| `rtk git diff --check` | PASS. |

`npm test` printed existing stable-track noncompliance notices for `tb-unity-deterministic`; the capability CI runner still exited successfully. No maturity or capability files changed.

## Rule outcomes

- Madness is now evidence-first: claim registration records current-day evidence; Mutant adjudication happens once at day end with supplied RNG and never reuses a prior day's public claim; Cerenovus uses a deterministic explicit-claim mismatch boundary.
- Cerenovus can select itself or an alive/dead player and only offers good characters; execution of an already-dead target remains a frozen shared-primitive gap.
- Philosopher can choose Townsfolk or Outsider abilities and reapplies copied-role carrier drunkenness before those carriers' next action windows while the Philosopher remains active.
- Pit-Hag AI chooses a character not in play; the frozen human action contract still accepts an in-play character for shared entry-info compatibility. Alignment is preserved, entry state is reset, and a Demon-balance gate opens only when a successful transformation changes Demon status.
- Snake Charmer swaps character and alignment; Fang Gu jump changes the Outsider to evil, kills the old holder, and reconciles Evil Twin state.
- Barber target options include dead players and the acting Demon but exclude another Demon; swaps preserve alignment.
- A living Evil Twin pair that becomes same-alignment is re-paired with supplied RNG; an existing dead opposite is retained.
- Structured Vortox information must be semantically false, not merely marked polluted; focused Dreamer and Sage counterexamples plus shared Savant contracts cover representative pair/statement shapes.

## Remaining minimal interface requests

These are outside the authorized files and were not implemented:

1. Inject RNG into Storyteller action resolution and entry-info delivery.
2. Add a current-state role-option filter for human Pit-Hag selection.
3. Add source-owned poison/drunk state with safe cleanup.
4. Route Fang Gu jump through the generic character-entry/change callback.
5. Derive human Klutz loss from the Klutz's current alignment.
6. Add a semantic truth comparator for arbitrary information answers under Vortox.
7. Allow the shared execution primitive to record execution of an already-dead player without replaying death triggers, for Cerenovus madness.

The corresponding shared-interface request is [Issue #13](https://github.com/YuriHKj/botc-solo-simulator/issues/13).
