# Unity Night Action Completeness Check

Date: 2026-05-09

## Goal

Make the Unity prototype's night-action path auditable instead of relying on ad hoc role-by-role fixes.

The checked path is:

1. JS Core role action rule
2. `getHumanNightActionState(state)`
3. `buildUnityViewModel(state).humanNightAction`
4. `buildUnityViewModel(state).actionForms["night-action"]`
5. `setHumanNightActionPlan(state, plan)`

## Coverage

`tests/night_action_completeness_contracts.mjs` enumerates all active night-action rule definitions from:

- Trouble Brewing
- Bad Moon Rising
- Sects & Violets

It validates every concrete night action rule except Lunatic's objective role rule, because Lunatic must act through its perceived demon role. Lunatic is checked by a dedicated case.

Special cases covered:

- Non-first-night actions are checked in the next-night window.
- BMR Godfather is checked with the outsider-death trigger enabled.
- BMR Professor is checked with a dead target present.
- BMR Po is checked both as a normal action and in charged mode.
- BMR Lunatic is checked against the perceived demon descriptor.

## What The Contract Requires

Each available night action must expose:

- `roleId`, `roleName`, `inputType`, and `prompt`
- rich `interaction` metadata with `title`, `confirmText`, and `skipText`
- enough legal player options for the required target count
- role options when the input type requires a role
- full player and role options in both `humanNightAction` and the Unity `night-action` form
- mode choices for actions such as Po
- an accepted legal plan via `setHumanNightActionPlan`

## Fix From This Pass

`scripts/unity_viewmodel.js` previously truncated `actionForms[].options` and `actionForms[].roleOptions` to 8 entries.

That was unsafe after Unity action forms gained pagination:

- Fortune Teller can legally see all 9 player tokens, including self/dead options.
- Role-choice actions such as Philosopher, Courtier, Cerenovus, Pit-Hag, and Gambler need the full role list or filtered role list.

The viewmodel now exports full action form options; Unity remains responsible for pagination.

## Out Of Scope

This pass does not claim full coverage for:

- passive first-night/each-night information roles without manual input
- death-triggered Storyteller queues such as Ravenkeeper, Sage, Barber, Moonchild, and Klutz
- AI dialogue quality around night information
- official rule edge cases that are not yet implemented in JS Core

Those should stay in the rule-boundary backlog rather than being treated as UI action-form completeness.
