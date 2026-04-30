# BOTC Solo Current Handoff

Date: 2026-04-30

Use this file when starting a new Codex thread. It is intentionally short so the next thread does not need to reload the long chat history.

## Current Project Goal

Build and iteratively refine a local Electron/HTML single-player Blood on the Clocktower style simulator. The medium-term direction is:

- Center the UI around a grimoire-like board.
- Keep all assets local for packaged `.exe` use.
- Support the three base scripts: Trouble Brewing, Bad Moon Rising, Sects & Violets.
- Move role behavior out of the monolithic engine into reusable role modules so future custom scripts can compose roles without binding them to one script.

## Start Here

For current project status and open requirements, read:

- `docs/INDEX.md`
- `docs/PROJECT_STATUS_AND_OPEN_REQUIREMENTS.md`

These two files are now the recommended entry point before reading older plans.

## Current Refactor Status

Role module registry:

- `scripts/roles/index.js`
- `scripts/roles/tb.js`
- `scripts/roles/bmr.js`
- `scripts/roles/snv.js`

The registry exposes:

- `getScriptRoleDefinitions(scriptId)`
- `getScriptRoleActionRules(scriptId)`
- `getRoleActionRule(scriptId, roleId)`
- `getNightRunner(scriptId)`
- `getScriptRuleHandlers(scriptId)`

Current runner and handler ownership:

- TB: module-owned night runner and several rule handlers.
- BMR: module-owned action rules, role definitions, simplified night runner, setup handlers, end-of-day Gossip handler, no-execution Mastermind handler, and death/execution prevention or aftermath handlers for Tea Lady/Fool/Pacifist/Devil's Advocate/Zombuul/Grandmother/Moonchild/Mastermind/Minstrel bookkeeping.
- SnV: module-owned action rules, role definitions, simplified night runner, setup Evil Twin handler, Cerenovus/Mutant/Juggler end-of-day handlers, Mutant claim handler, Witch nomination handler, minion nomination and demon vote tracking, Vortox no-execution handler, and Sweetheart/Klutz/Sage/Barber/Evil Twin death or execution aftermath handlers.

`scripts/engine.js` still owns shared primitives and compatibility wrappers:

- `createTBRoleContext(state, rng)`
- `createBMRRoleContext(state, rng)`
- `createSNVRoleContext(state, rng)`
- public APIs used by UI such as `createNewGame()`, `runNight()`, `resolveNominationAndVote()`, and grimoire note functions.

## Latest Validation

Syntax checks passed:

- `scripts/engine.js`
- `scripts/roles/bmr.js`
- `scripts/roles/index.js`
- `scripts/roles/snv.js`

Smoke passed:

- Fixed-random 9-player `tb`, `bmr`, `snv` games can be created and advanced through `runNight()` into day/private phase after the BMR/SnV rule-handler migration.

Known warning:

- Node emits `MODULE_TYPELESS_PACKAGE_JSON` because browser scripts are ESM while `package.json` does not declare `"type": "module"`.
- Do not blindly add `"type": "module"` yet because `electron/main.js` is CommonJS.
- The major visible mojibake pass was completed on 2026-04-30, but future edits should still prefer a safer string-table/localization path for new Chinese UI strings.

## Next Good Steps

1. Continue shrinking `scripts/engine.js` by moving remaining script-specific day-start/night-start reset logic into role-module handlers where it has a clear lifecycle hook.
2. Introduce richer action schemas beyond player-target actions:
   - choose role
   - choose player plus role
   - choose zero/one/multiple kills
   - choose yes/no or text question
   - choose no-action/charge mode
3. Add regression tests for role runners, death/execution handlers, and misinformation shapes.
4. Add a proper localization/string-table path for future visible strings, so Chinese text edits do not reintroduce encoding drift.
5. Continue UI work only after the role-interface seam is stable, unless the UI change is a small isolated fix.

## Workspace Notes

Large folders currently include `.git`, `data`, `release-20260425`, `release-model`, `node_modules`, `release`, and `dist`. These take disk space, but this very long chat thread is the more likely cause of Codex client lag.

Recommended workflow if the client is slow:

1. Start a new Codex thread.
2. Tell Codex: "Read `C:\Users\11507\Documents\Playground\docs\design\CURRENT_THREAD_HANDOFF.md` and continue from there."
3. Keep old release folders unless you explicitly decide they are no longer needed.
