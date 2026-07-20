# Sects & Violets rule-fidelity matrix

Date: 2026-07-20
Scope: the 25 characters in the existing `snv` script. This document does not add characters, scripts, JSON contracts, or capability maturity.

## Reading the matrix

- **Covered**: the current JS core has an observable contract for the listed lifecycle.
- **Approximation**: the product makes a deterministic or seeded choice where a human Storyteller normally judges intent or chooses an outcome.
- **Frozen gap**: full fidelity needs a small change outside this Goal's exclusive files. These gaps are explicit and do not raise SnV capability maturity.
- “Role change” means a player's character changes. Alignment is tracked separately and is preserved unless the ability explicitly changes it.

Rule references: [Abilities](https://wiki.bloodontheclocktower.com/Abilities), [States](https://wiki.bloodontheclocktower.com/States), and the official [Sects & Violets character index](https://wiki.bloodontheclocktower.com/Category:Sects_%26_Violets). Character-specific rows link to their official pages.

## 25-character lifecycle ledger

| Character | Setup | Night | Day | Death | Win | Role change | Alignment | Information | Storyteller discretion / audit status |
|---|---|---|---|---|---|---|---|---|---|
| [Clockmaker](https://wiki.bloodontheclocktower.com/Clockmaker) | No setup modifier | First-night distance | — | — | Normal | Re-entering receives entry info | Unchanged | Numeric evil distance; Vortox must make the value false | **Covered** by entry-info and shared role-action contracts; distance remains an engine-owned calculation. |
| [Dreamer](https://wiki.bloodontheclocktower.com/Dreamer) | — | Chooses a player nightly | — | — | Normal | New Dreamer enters normal night lifecycle | Unchanged | One good and one evil character, exactly one true; under active Vortox both are false | **Covered**; strict Vortox-false and poisoned-Vortox counterexamples are shared contracts. |
| [Snake Charmer](https://wiki.bloodontheclocktower.com/Snake_Charmer) | — | Chooses a living player; Demon hit swaps characters and alignments | — | — | Normal after swap | Old Demon becomes permanently poisoned Snake Charmer; chooser becomes that Demon | Explicit two-way alignment swap | Private swap evidence is emitted | **Covered** with seeded targets and swap records; poison is tracked in `snakeCharmerPoisonedIds`. |
| [Mathematician](https://wiki.bloodontheclocktower.com/Mathematician) | — | Learns prior-window abnormal ability count | — | — | Normal | New holder joins the next observation window | Unchanged | Numeric interference count; Vortox must receive a false number | **Approximation**: interference attribution is event-based rather than full counterfactual Storyteller reasoning. |
| [Flowergirl](https://wiki.bloodontheclocktower.com/Flowergirl) | — | Learns whether a Demon voted today | Vote events supply evidence | — | Normal | New holder has no historic private memory beyond recorded events | Unchanged | Boolean; active Vortox forces false | **Covered** for recorded votes; registration and false-info policy remain engine-owned. |
| [Town Crier](https://wiki.bloodontheclocktower.com/Town_Crier) | — | Learns whether a Minion nominated today | Nomination events supply evidence | — | Normal | New holder observes subsequent windows | Unchanged | Boolean; active Vortox forces false | **Covered** for accepted nominations. |
| [Oracle](https://wiki.bloodontheclocktower.com/Oracle) | — | Learns number of dead evil players | — | Deaths feed count | Normal | New holder observes current graveyard | Unchanged | Numeric registered-team count; active Vortox forces a false count | **Covered** for recorded alignment. |
| [Savant](https://wiki.bloodontheclocktower.com/Savant) | — | — | Receives two statements daily | — | Normal | New holder receives later-day information | Unchanged | Normally one true/one false; active Vortox makes both false | **Approximation**: statement corpus is local and auditable, not free-form Storyteller invention. |
| [Seamstress](https://wiki.bloodontheclocktower.com/Seamstress) | — | Once per game, chooses two other players, alive or dead | — | — | Normal | Entry resets once-use state | Unchanged | Same-alignment boolean; active Vortox forces false | **Covered**; target domain now includes dead players. |
| [Philosopher](https://wiki.bloodontheclocktower.com/Philosopher) | — | Once per game chooses any good character ability | Copied day ability may act normally | Copied death ability uses effective role | Normal | Player remains Philosopher; copied-role carriers are drunk while the Philosopher remains active | Unchanged | Uses copied ability's information policy, including Vortox | **Covered/Approximation**: Townsfolk and Outsider choices are allowed and carrier drunkenness is reapplied each night. **Frozen gap**: poison/drunk lacks source ownership, so safe cleanup after the Philosopher loses the ability needs an engine status-source API. |
| [Artist](https://wiki.bloodontheclocktower.com/Artist) | — | — | Once per game asks a yes/no question | — | Normal | Entry resets once-use state | Unchanged | Boolean; active Vortox must be false | **Approximation**: supported local question parsing cannot prove semantic falsity for arbitrary prose. Needs a shared semantic-answer seam for complete Vortox coverage. |
| [Juggler](https://wiki.bloodontheclocktower.com/Juggler) | — | Learns correct-guess count on the following night | Makes up to five public player/character guesses | — | Normal | Entry state is reset | Unchanged | Numeric count; active Vortox forces false | **Covered**; automatic guesses and role fallbacks now consume the supplied RNG. |
| [Sage](https://wiki.bloodontheclocktower.com/Sage) | — | — | — | Demon death yields two players, one the Demon | Normal | Effective copied Sage can trigger death information | Unchanged | Normal pair includes the killing Demon; order and decoy use supplied RNG; active Vortox instead yields two non-Demons | **Covered** for queue, seed use, and Vortox semantic falsity. **Frozen compatibility gap**: an existing passive-info fixture expects the queue even in a synthetic No Dashii state, so poisoned death suppression is not certified here. |
| [Mutant](https://wiki.bloodontheclocktower.com/Mutant) | — | — | Outsider claims create per-day madness evidence | Seeded adjudication may execute | Normal | Effective Mutant is evaluated; losing the ability prevents later adjudication | Unchanged | Public claim is evidence, not truth | **Seeded approximation**: product observes explicit public Outsider claims, records one violation per player/day, and rolls once at day end. A prior-day `publicClaimRoleId` is never reused as new evidence. Intent, implication, silence, and private speech are outside the madness model. |
| [Sweetheart](https://wiki.bloodontheclocktower.com/Sweetheart) | — | — | — | On death, one living player becomes drunk | Normal | Effective copied Sweetheart is recognized | Unchanged | Target is hidden; selection uses supplied RNG | **Covered**; source ownership/cleanup shares the frozen status-source limitation. |
| [Barber](https://wiki.bloodontheclocktower.com/Barber) | — | Demon may swap two characters after Barber death | — | Creates optional Demon-controlled swap | Normal after swap | Dead players and the acting Demon may be chosen; another Demon may not; entry state resets | Each selected player keeps alignment | Entry information may be delivered for new characters | **Covered** target domain and alignment preservation. **Frozen gap**: storyteller-action resolution cannot accept an RNG, so entry-info generation is not part of the certified seed trace. |
| [Klutz](https://wiki.bloodontheclocktower.com/Klutz) | — | — | — | Chooses a living player; choosing evil makes the Klutz's current team lose | Special immediate loss | Effective copied Klutz is recognized | Current alignment determines losing team | Choice is public | **Covered** for AI resolution. **Frozen gap**: the shared human storyteller resolver hard-codes an evil win and needs the actor alignment in its outcome calculation. |
| [Evil Twin](https://wiki.bloodontheclocktower.com/Evil_Twin) | Pairs with an opposite-alignment player | Pair is repaired after audited role/alignment changes | Both twins alive block good victory | Executing the good twin gives evil victory | Special block and execution win | Holder loss clears the pair; a living same-alignment pair is seed-repaired; a dead opposite remains bound | Pair must be opposite alignment | Both sides receive private pairing evidence | **Covered** for setup, Pit-Hag, Barber, Snake Charmer, and Fang Gu reconciliation seams exposed to this module. |
| [Witch](https://wiki.bloodontheclocktower.com/Witch) | — | Curses one living other player | Cursed nominator dies | Curse death | Normal | New holder acts in later windows | Unchanged | Curse remains private until triggered | **Frozen contract gap**: official final-three exception conflicts with the existing shared Witch contract, so this Goal preserves current behavior and records the mismatch. |
| [Cerenovus](https://wiki.bloodontheclocktower.com/Cerenovus) | — | Chooses any player, including self and dead players, plus a good character | Explicit mismatch at the enforced day is madness evidence | Living mismatching target is deterministically executed at day end | Normal | Effect persists for its scheduled day even if target character changes | Unchanged | Required claim is privately delivered to a human target | **Deterministic approximation**: exact role-claim equality is the product boundary. Intent, “trying,” implication, and Storyteller mercy are not modeled. **Frozen gap**: the shared execution primitive rejects an already-dead target, so corpse execution cannot yet consume the day's execution. |
| [Pit-Hag](https://wiki.bloodontheclocktower.com/Pit-Hag) | Setup brackets do not apply to midgame creations | Chooses any player, alive/dead/self; changes character and resets entry state | — | Demon creation/removal may queue balance resolution | Normal after balance gate | Alignment is preserved; AI selects a character not in play; accepted human plans retain the frozen duplicate-character compatibility; Evil Twin state is reconciled | Preserved across the change | New-character entry information is delivered where supported | **Covered/Approximation**: balance queue opens only when a successful change alters Demon status and is seed-stable. **Frozen gaps**: human role options and validation cannot exclude in-play characters, and an existing shared entry-info contract depends on accepting one; the current balance API models extra/no-Demon resolution, not arbitrary deaths and protections for the whole night. |
| [Fang Gu](https://wiki.bloodontheclocktower.com/Fang_Gu) | Adds one Outsider through existing setup rules | Kills nightly; first actual Outsider kill jumps once | Old Fang Gu dies on jump | Normal with new Demon | Target becomes evil Fang Gu; old holder becomes dead | Target changes to evil | Jump state and death reason are recorded; Evil Twin pair is reconciled | **Covered** for jump, once-use, alignment, and pair repair. **Frozen gap**: engine-owned jump mutation bypasses the generic entry reset/callback used by Pit-Hag and Barber. |
| [Vigormortis](https://wiki.bloodontheclocktower.com/Vigormortis) | Existing setup applies its Outsider adjustment | Kills; killed Minion may retain ability and poisons nearest Townsfolk | — | Empowered Minion remains effective while dead | Normal | Role changes are reflected through effective-role checks | Unchanged | Poison is hidden | **Approximation**: neighbor poison and empowered-minion lists are explicit, but overlapping poison-source cleanup needs the shared status-source API. |
| [No Dashii](https://wiki.bloodontheclocktower.com/No_Dashii) | — | Kills and poisons nearest living Townsfolk in both directions | — | Normal | Normal | Recomputed while active | Unchanged | Poison is hidden | **Approximation**: seat-direction search is deterministic; overlapping poison-source cleanup is a frozen engine gap. |
| [Vortox](https://wiki.bloodontheclocktower.com/Vortox) | — | Kills nightly; globally constrains Townsfolk information | No execution at dusk gives evil victory | Normal | Special no-execution evil win | Active effective Vortox controls the global constraint | Unchanged | Every Townsfolk ability datum must be semantically false, even if the Townsfolk is drunk/poisoned | **Covered** for structured Dreamer, Savant, and shared info helpers plus no-execution win. **Frozen gap**: arbitrary Artist prose and any generator without a truth comparator cannot be certified semantically false. |

## Cross-character invariants

### Role changes and alignment

1. Pit-Hag and Barber change character while preserving each player's alignment.
2. Snake Charmer swaps both characters and alignments.
3. Fang Gu changes the Outsider target to evil and makes that player the new Fang Gu.
4. Entry-scoped once-use state is reset through the existing `setRole`/swap path. Setup modifiers and normal setup-only evil recognition are not rerun midgame.
5. After a relevant transition, a living Evil Twin holder must have an opposite-alignment partner. A dead existing opposite remains bound; a living same-alignment partner is reselected with supplied RNG.

### Madness product boundary

Madness is a Storyteller judgment about a player's apparent effort. The simulator deliberately narrows that judgment to auditable evidence:

- Mutant: a public claim whose selected character is an Outsider records one violation per player/day; day-end execution is a single supplied-RNG decision.
- Cerenovus: the scheduled day's final explicit public claim is compared with the demanded good character; a living mismatch is executed deterministically.
- Private chat, rhetorical implication, silence, language quality, and inferred intent do not count. Claim registration never kills immediately and never calls ambient randomness.

### Vortox false-information boundary

“Polluted” is not sufficient: the reported value must differ semantically from the true value. Structured booleans, counts, role pairs, and statement truth arrays can be compared and are certified by existing contracts. Free-form questions without a machine-computable truth value are recorded as a frozen interface gap, not claimed as faithful.

### Seed certificate

`scripts/roles/snv.js` contains no `Math.random` reference, and every module-owned call to selection/shuffle helpers passes the injected `rng`. The certified trace in `tests/snv_rule_fidelity_contracts.mjs` runs each of the nine priority interactions twice and compares player state, full SnV state, relevant events, pending Storyteller actions with envelope fields removed, semantic logs, and winner. Engine-owned Storyteller resolution paths listed as frozen gaps are outside that certificate.

## Minimal shared-interface requests

Tracking issue: [#13 — SnV: add shared rule-fidelity interface seams](https://github.com/YuriHKj/botc-solo-simulator/issues/13).

1. Add an injected `rng` parameter to Storyteller action resolution and role-entry delivery (Barber and Pit-Hag balance deaths).
2. Let player-role action descriptors filter roles against current in-play state, so the human Pit-Hag UI can reject an illegal duplicate before submission without changing JSON shape.
3. Add source-tagged drunk/poison ownership with safe removal, needed by Philosopher, Sweetheart, Vigormortis, and No Dashii overlap.
4. Route every character mutation, including Fang Gu jump, through the generic entry-reset and post-change reconciliation callback.
5. Make human Klutz resolution derive the losing team from the acting Klutz's current alignment.
6. Expose a semantic truth comparator for arbitrary information answers so Vortox can reject accidentally true prose answers.
7. Let the shared execution primitive record execution of an already-dead player without firing death triggers, so Cerenovus madness can consume that day's execution as the tabletop rule requires.
