# Phase 1 Role Module Refactor Notes

Date: 2026-04-27

## Goal

Start moving role logic out of the monolithic `scripts/engine.js` file into role-level modules that can be reused across future custom scripts. This round only wires Trouble Brewing into the new structure, while keeping the existing engine entry points compatible.

## New Interface Shape

File: `scripts/roles/tb.js`

Each role is represented by an entry in `TB_ROLE_DEFINITIONS`:

```js
[roleId]: {
  id,
  scriptAgnostic: true,
  action,             // optional UI contract for active choices
  misinformationProfile,
  phaseHooks: {
    firstNight,
    eachNight,
    otherNight,
    afterNightDeaths,
  },
}
```

This is intended to make a role callable independently from a fixed script. A future custom script should be able to select role IDs and use the same hook/action metadata instead of rewriting the role.

## Action/UI Contract

`TB_ROLE_ACTION_RULES` now describes TB active night UI in the role module. Examples:

- Butler: choose 1 living non-self player.
- Fortune Teller: choose 2 players, self and dead allowed.
- Monk: choose 1 living non-self player, other nights only.
- Poisoner: choose 1 living non-self player.
- Imp: choose 1 living player, self allowed from night 2.

Current compatibility note: `engine.js` still declares its legacy TB UI rule object, but now immediately overlays it with `TB_ROLE_ACTION_RULES` from the role module. This keeps the old call sites stable while making the role module the source of truth for TB active-choice metadata.

## Engine Integration

`engine.js` now imports the role registry:

```js
import { getNightRunner, getScriptRoleActionRules, getScriptRuleHandlers } from "./roles/index.js";
```

The old `runNightTB()` entry point remains, but delegates to:

```js
getNightRunner("tb")(createTBRoleContext(state, rng));
```

`createTBRoleContext()` is the compatibility layer. It passes narrow helpers to the role module:

- state access and RNG
- private info/log writing
- role lookup and registration checks
- target selection helpers
- death processing
- win/day/night transitions

This avoids importing the whole engine from inside the role module and keeps future role modules easier to test.

## 2026-04-27 Rule Handler Round

TB daytime and death-trigger rules are now also routed through `scripts/roles/tb.js` instead of living directly in `engine.js`.

New registry entry:

```js
getScriptRuleHandlers("tb")
```

Current TB rule handlers:

- `onDemonDeath`: Imp self-kill starpass and Scarlet Woman takeover.
- `onExecutionDeath`: Saint execution loss.
- `onNomination`: Virgin first valid nomination trigger.
- `restrictButlerVote`: Butler can only vote when the master votes.
- `useSlayerAbility`: Slayer once-per-game daytime shot.
- `onNoExecution`: Mayor three-alive no-execution win.

The engine still owns public API functions such as `resolveNominationAndVote()`, `useSlayerAbility()`, `skipDay()`, and death bookkeeping. Those functions now delegate TB-specific decisions to the role module through the context object. This keeps UI/app call sites stable while moving concrete role behavior toward reusable per-role hooks.

## 2026-04-27 BMR/SnV Registry Round

Added lightweight role modules for the other two base scripts:

- `scripts/roles/bmr.js`
- `scripts/roles/snv.js`

This round intentionally does not migrate the full BMR/SnV night engine yet. Instead, it moves their active night UI contracts and role metadata into the registry so all three scripts expose the same lookup surface:

```js
getScriptRoleDefinitions(scriptId)
getScriptRoleActionRules(scriptId)
getRoleActionRule(scriptId, roleId)
```

Current status:

- TB has real module-owned night logic and rule handlers.
- BMR has module-owned action rules, role definition shells, and a module-owned simplified night runner.
- SnV has module-owned action rules, role definition shells, and a module-owned simplified night runner.

This gives custom-script work a stable first seam: custom scripts can inspect action contracts by role ID without depending on which official script originally contained the role.

## 2026-04-28 BMR Runner Round

BMR simplified night execution was moved behind the same role-runner registry seam used by TB:

```js
getNightRunner("bmr")(createBMRRoleContext(state, rng))
```

`engine.js` still owns shared primitives such as death processing, night-window checks, target selection, logging, and ability-interference bookkeeping. `scripts/roles/bmr.js` now owns the BMR-specific night sequence. The context boundary keeps this migration reversible and prevents the BMR module from importing the whole engine.

Note: BMR/SnV action prompts were converted to ASCII text in this round because earlier Chinese prompt literals became syntax-breaking mojibake during module import. The UI can be re-localized later with a safer string table or Unicode-escaped literals.

## 2026-04-29 SnV Runner Round

SnV simplified night execution now uses the same role-runner registry seam as TB and BMR:

```js
getNightRunner("snv")(createSNVRoleContext(state, rng))
```

`scripts/roles/snv.js` now owns the SnV-specific night sequence for Witch, Cerenovus, Pit-Hag, Snake Charmer, Philosopher, No Dashii, Vigormortis neighbor poisoning, Sweetheart drunk continuation, Pit-Hag demon overflow, and Barber swap timing. `engine.js` still owns shared primitives such as player lookup, role swapping, target selection, death processing, role assignment, and logging, and passes them through `createSNVRoleContext()`.

Validation performed in this round:

- ESM syntax checks for `scripts/engine.js`, `scripts/roles/snv.js`, and `scripts/roles/index.js`.
- Fixed-random smoke for `tb`, `bmr`, and `snv`: each script can create a 9-player game and advance from setup/night into day/private phase through `runNight()`.

## 2026-04-30 TB Interaction UI Round

TB active night actions now expose role-specific UI metadata through `TB_ROLE_ACTION_RULES[*].interaction`. The engine passes this metadata through `getHumanNightActionState()`, and the night action modal renders it as a Storyteller-style interaction card.

Implemented TB interaction variants:

- Butler: oath/master selection copy and confirm text.
- Fortune Teller: two-slot divination copy with dead/self reminder.
- Monk: sanctuary/ward copy and self-target warning.
- Poisoner: venom copy with hidden-objective reminder.
- Imp: demon kill copy with self-kill/starpass reminder.

The UI contract is intentionally data-driven:

```js
interaction: {
  title,
  subtitle,
  style,
  badge,
  targetLabels,
  helper,
  confirmText,
  skipText,
}
```

This keeps the modal generic while letting each role describe its own target slots and Storyteller prompt. BMR/SnV can adopt the same shape without changing modal structure.

The same pattern now exists for daytime actions through `TB_DAY_ACTION_RULES`. The first daytime action is Slayer:

- `getHumanDayActionState()` returns whether the human can currently use a day action.
- `scripts/roles/index.js` exposes `getRoleDayActionRule()` and `getScriptRoleDayActionRules()`.
- The UI reuses the same Storyteller action modal, but the phase label becomes day-aware.

Implemented daytime interaction:

- Slayer: a one-use silver-bullet modal, available in public/nomination stages and unavailable during private chat.

TB passive prompt metadata was also added for Virgin and Mayor as `passiveInteraction` on their role definitions. That metadata is not yet rendered in a dedicated passive-trigger modal; it is ready for the next UI round.

## 2026-04-27 Deep Split Round

- Added `scripts/roles/index.js` as the first role registry.
- `engine.js` now asks the registry for TB action rules via `getScriptRoleActionRules("tb")`.
- `engine.js` now asks the registry for the TB night runner via `getNightRunner("tb")`.
- Removed the legacy TB role implementation block from `engine.js`: Washerwoman/Librarian/Investigator/Chef/Empath/Fortune Teller/Undertaker/Poisoner/Butler/Monk/Imp/Ravenkeeper/Spy logic now lives only in `scripts/roles/tb.js`.
- Kept `createTBRoleContext()` in `engine.js` for now because it still exposes engine-private primitives such as death handling, registration checks, logging, and day/night transitions.

## TB Behavior Changes In This Round

Most TB behavior is preserved. The intentional behavior refinement is Investigator misinformation:

- Normal Investigator: chooses a real minion if available, pairs that player with another player, and reports the minion role.
- Drunk/poisoned Investigator: tends to receive the common false-info shape “two good players, one is a minion”. The module chooses two good players when possible and reports a minion-role bluff.

This matches the design direction: misinformation should have storyteller-like structure, not just arbitrary random noise.

## Deferred Work

1. Add generic action schemas for non-player choices:
   - choose role
   - choose player + role
   - choose yes/no question
   - choose zero/one/multiple kills
   - choose no-action/charge mode
2. Gradually migrate BMR/SnV daytime, death, and setup rule handlers into their role modules.
3. Add small regression tests for fixed-seed TB/BMR/SnV nights, especially poisoned/drunk info generation and death-prevention chains.
4. Continue repairing legacy mojibake strings in `engine.js`; this round fixed syntax-breaking strings only.
