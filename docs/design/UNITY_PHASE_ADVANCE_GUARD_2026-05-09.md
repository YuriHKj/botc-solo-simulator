# Unity Phase Advance Guard

## Goal

Make Unity phase buttons safe by treating JS Core as the only source of truth for phase transitions.

Before this change, Unity could optimistically mutate `vm.phase` / `vm.dayStage` and then send a `phase` action. That made the UI briefly show a stage that JS Core might reject, and it made accidental skips easy.

## Contract

The guard is exported from JS Core via:

- `scripts/unity_phase_guard.mjs`
- `buildUnityViewModel(state).phaseAdvance`
- `applyUnityAction(... type: "phase" ...)`

Unity consumes:

- `phaseAdvance.targetStage`
- `phaseAdvance.blocked`
- `phaseAdvance.requiresConfirm`
- `phaseAdvance.reason`
- `phaseAdvance.hint`
- `phaseAdvance.blockers[]`
- `phaseAdvance.warnings[]`

Unity no longer mutates `vm.phase` or `vm.dayStage` locally. It sends a phase request, then waits for the bridge-refresh viewmodel.

## Current Rules

- Stage order is forward-only: private -> public -> nomination -> night/day resolution.
- Storyteller queue blocks all phase advance.
- Public -> nomination requires at least one public discussion round.
- Night resolution requires pending human night action to be planned first.
- Nomination -> night warns before ending the day with no execution.
- Optional private-chat quota is shown as a warning, not a hard blocker.
- Warnings require a second click within the Unity confirmation window.

## Unity Behavior

- `下一阶段` asks JS Core for the next safe target stage.
- `上一阶段` is disabled behaviorally and shows a message instead of rewinding state.
- Clicking `提名` before nomination stage requests phase advance first; only after JS Core reaches nomination does the same action nominate the selected token.
- Guard blockers open the most relevant panel when possible:
  - Storyteller blocker -> Storyteller panel
  - night blocker -> night action form
  - day-action blocker -> day action form

## Tests

- `tests/unity_viewmodel_contracts.mjs`
  - checks `phaseAdvance` shape
  - checks private warning
  - checks Storyteller queue blocker
  - checks public-discussion blocker
  - checks next-night action blocker
- `tests/unity_action_bridge_contracts.mjs`
  - checks Unity cannot skip private -> nomination
  - checks nomination still exports vote ceremony through the safe path
- `scripts/unity_demo_acceptance.mjs`
  - checks playable demo path still reaches vote ceremony

## Remaining Work

- A richer confirmation modal would be nicer than the current two-click status text.
- The guard can later absorb more official edge cases, such as mandatory death-triggered queues and script-specific end-of-day penalties.
