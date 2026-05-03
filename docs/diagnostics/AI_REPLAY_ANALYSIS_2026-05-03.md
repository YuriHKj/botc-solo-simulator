# AI Replay Diagnostic - 2026-05-03

## Source

- Raw user run log: `docs/diagnostics/AI_REPLAY_RAW_MOJIBAKE_2026-05-03.txt`
- The raw file is kept for traceability, but its contents are mojibake due to an earlier encoding issue.

## What The Run Exposed

The run showed an AI player appearing to identify and execute the demon on Day 1. After inspection, this was not
true deduction. It came from the old AI scoring path:

- suspicion was recomputed from global state rather than each AI player's personal information;
- small score differences were normalized into very high percentages;
- private/public information boundaries were not strict enough;
- AI recap rendering could refresh and mutate belief fields.

## Follow-up Implemented

The AI Agent MVP addresses the most dangerous part of this behavior:

- each AI now has `state.aiAgents[playerId]`;
- first-night evil recognition is stored as private agent knowledge;
- demon bluffs are known only by the demon agent;
- private claims and private whispers are visibility-gated;
- evil coordination uses known allies rather than direct global team checks;
- AI recap now snapshots and restores player belief fields.

See `docs/design/AI_AGENT_MVP.md` for the design notes.

## Remaining Risk

The AI still needs a fuller observation-driven belief updater. In the current MVP, the dialogue system is constrained
by visibility, but suspicion is still largely recomputed from visible event history instead of being a durable,
incremental memory model.
