# Project Status And Open Requirements

Updated: 2026-05-10

BOTC Solo Simulator is a public, MIT-licensed, unofficial learning/research prototype. The project currently has two coordinated runtime lines:

- Electron desktop prototype: mature JS Core rules, AI, and original UI.
- Unity prototype: fullscreen-first visual layer driven by the same JS Core state, viewmodel, and action bridge.

## Current Status

- Electron can run and package as a Windows desktop app.
- Unity can run a playable demo build with self-starting JS Core bridge support.
- JS Core remains the source of truth for rules, AI, phase progression, private/public information visibility, nominations, voting, and Storyteller queues.
- Unity consumes `scripts/unity_viewmodel.js` output and sends user actions through `scripts/unity_action_bridge.mjs`.
- The repository is prepared for public browsing with MIT source licensing, public README wording, and grouped runtime assets under `assets/`.

## Implemented Highlights

- Three base scripts are available: Trouble Brewing, Bad Moon Rising, and Sects & Violets.
- Trouble Brewing is the most complete ruleset.
- BMR and SnV have playable flows and many role hooks, with some official edge cases still simplified.
- AI agents use per-player observations and an evidence-book model rather than global omniscience.
- Evil first-night recognition and bluff knowledge are visibility-gated.
- Unity UI includes the grimoire board, token inspector, private chat panel, role picker, script handbook, complex action forms, Storyteller queue panel, voting ceremony UI, and endgame feedback.
- Unity demo acceptance covers private chat, public discussion, nomination, 15-player vote export, and real Storyteller queue types such as `sage-info`, `ravenkeeper-info`, and `barber-swap`.

## Open Requirements

- Continue tightening BMR/SnV official edge cases, especially role-specific input forms and Storyteller discretion points.
- Expand complex action schemas for roles that need role choice, player-role pairs, yes/no questions, and multi-target decisions.
- Improve Unity visual polish for private/public dialogue, voting ceremony staging, and high-player-count board readability.
- Add more automated UI screenshot assertions beyond smoke generation.
- Continue improving AI dialogue cadence, evidence summarization, and long-game consistency.
- Keep private/public information boundaries strict across Electron, Unity viewmodel export, and AI evidence retrieval.

## Verification Baseline

Run:

```powershell
npm test
```

The current test suite covers:

- role action contracts,
- passive information and Storyteller queues,
- night action completeness,
- AI agent contracts,
- Electron packaging/path contracts,
- Unity viewmodel and action bridge contracts,
- Unity asset synchronization,
- Unity playable demo acceptance,
- mojibake regression scanning for runtime text.
