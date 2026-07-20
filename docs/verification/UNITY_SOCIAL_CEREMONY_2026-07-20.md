# Unity Social Ceremony Verification — 2026-07-20

## Scope

This change refactors the Unity presentation of public discussion, nomination debate, voting, and the execution handoff. It does not change action names, payloads, vote counts, execution rules, or phase advancement.

Changed source files:

- `unity-prototype/Assets/Scripts/BotcPrototypeBootstrap.StageDialogue.cs`
- `unity-prototype/Assets/Scripts/BotcPrototypeBootstrap.NominationVote.cs`
- `tests/unity_social_ceremony_ux_contracts.mjs`

`BotcPrototypeBootstrap.Grimoire.cs` was not changed because the existing ceremony surfaces provide enough focus without a board-token spotlight. All frozen files remained unchanged.

## Player-facing result

- Public discussion now presents the current speaker, focus player, and table question together, with one suggested action.
- Dialogue and phase-transition surfaces suspend the underlying public/nomination controls and restore them when dismissed, avoiding competing CTAs or blocked queues.
- The public-to-nomination handoff keeps the current table matter visible instead of presenting nomination as an unrelated panel.
- Nomination debate is ordered as nominator and reason, nominee response, then ballot. Ballot controls remain hidden while a required human response is pending.
- Vote ceremony uses exported facts for threshold, the human player's recorded choice, final tally/result, and the current execution candidate.
- Vote-result dialogue retains its return-to-vote intent across queued dialogue entries.
- Vote animation uses realtime timing and converges immediately when motion is disabled.

## Frozen-semantics contract

The new contract test pins the existing action calls and payload shapes:

- `auto-advance` with `mode: "decision"`
- `open-nomination-window`
- `pass-nomination-window` with `toNight: false`
- `human-public-speech`
- `human-nomination-intent`
- `nomination-debate-response`
- `resolve-nomination-vote` with the existing `humanVoteYes` field

Before the production changes, this firewall passed while all eight presentation categories failed. After implementation and review fixes, both the firewall and presentation checks pass.

## Automated validation

All requested non-window validation commands passed from `codex/unity-social-ceremony`:

| Command | Result |
| --- | --- |
| `rtk node tests/unity_social_ceremony_ux_contracts.mjs` | PASS — frozen action firewall and UX contracts |
| `rtk npm run test:unity-csharp-smoke` | PASS — `CSC_EXIT=0`, `Assembly-CSharp.dll` 618,496 bytes; existing CS0649 warnings only |
| `rtk npm run test:unity-ui-audio` | PASS |
| `rtk npm run test:unity-viewmodel` | PASS |
| `rtk npm run test:unity-action-bridge` | PASS |
| `rtk npm run test:unity-playable-path` | PASS — all six scenarios; report `output/unity-playable-path-smoke/playable_loop_report.json` |
| `rtk npm run test:unity-demo-acceptance` | PASS — fresh output `output/unity_demo_acceptance_1784550671794` |

## Review findings resolved

- Kept the timeline control available as a secondary action instead of leaving it permanently hidden.
- Made vote-result return intent cumulative so later queued dialogue cannot erase the handoff to the vote ceremony.
- Removed newly introduced dormant dismiss state while retaining the pre-existing hidden dismiss control.
- Retained the existing partial-class architecture because the task explicitly limits implementation to the two ceremony partials.

## Fresh verified package

Command:

```text
rtk npm run release:unity-ai:verified -- -PackageName BOTC-Solo-Unity-AI-20260720-social-ceremony-verified -PrepareLocalLlm -ModelTier tiny
```

Result: PASS.

- Package: `output/release-unity-ai/BOTC-Solo-Unity-AI-20260720-social-ceremony-verified`
- Zip: `output/release-unity-ai/BOTC-Solo-Unity-AI-20260720-social-ceremony-verified.zip`
- Build log: `output/unity-build-latest-20260720-210047.log`
- Release UI smoke: `output/unity-ui-smoke-release-20260720-210307/visual-regression-report.json`
- Release UI smoke result: 8 screenshots, 0 warnings, 0 failures
- Local LLM verification: enabled, two successful timeline entries, zero fallbacks
- Package size: folder 691.7 MB; zip 545.12 MB

The first package attempt was blocked by the absent managed LocalLLM dependency. The official tiny Qwen model and llama.cpp runtime were then prepared under ignored `third_party/LocalLLM`, and the verified release command completed successfully from that managed cache.

## Visible-window and screenshot status

Not completed, by latest user instruction: **do not launch the game**.

A 1280×720 attempt had already started before that instruction and produced `output/unity-social-ceremony-2026-07-20/full-1280/click_smoke_report.json`. It failed in `proactive-queue-click` with `GetClientRect failed for Unity window` before reaching the requested social-ceremony evidence, so it is not accepted as verification. No game or bridge process remained active after the instruction.

Consequently:

- 1280×720 complete click sweep: NOT RUN TO COMPLETION
- 1366×768 complete click sweep: NOT RUN
- 1920×1080 complete click sweep: NOT RUN
- Required social/nomination/vote/execution screenshot set: NOT CAPTURED

These are the only remaining manual verification gaps. They require a future run in which launching the visible Unity player is explicitly allowed.
