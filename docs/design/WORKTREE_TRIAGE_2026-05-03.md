# Worktree Triage - 2026-05-03

This document records the accumulated uncommitted work after interrupted development sessions.

## Workstream A - Generic Role Action Interface

Files:

- `scripts/engine.js`
- `scripts/roles/index.js`
- `scripts/roles/bmr.js`
- `scripts/roles/snv.js`
- `scripts/ui.js`
- `index.html`
- `styles.css`
- `tests/role_action_contracts.mjs`
- `docs/design/ROLE_MODULE_REFACTOR_PHASE1.md`

Purpose:

- Replace the old fixed player-target night modal with a generic action payload.
- Support action input types such as player target, role choice, player + role, question, guesses, and charge-or-targets.
- Give BMR/SnV roles room for distinct operation UIs without hard-coding every role in UI code.

Validation:

- `node --check scripts/ui.js`
- `node --check scripts/app.js`
- `node --check scripts/engine.js`
- `node --check scripts/roles/bmr.js`
- `node --check scripts/roles/snv.js`
- `node --check scripts/roles/index.js`
- `npm run test:role-actions`

## Workstream B - AI Agent MVP

Files:

- `scripts/ai.js`
- `scripts/ai_agents.js`
- `scripts/app.js`
- `scripts/engine.js`
- `tests/ai_agent_contracts.mjs`
- `docs/design/AI_AGENT_MVP.md`

Purpose:

- Add per-AI perspective state.
- Record first-night evil recognition as private agent knowledge.
- Prevent demon bluffs and private claims from leaking globally.
- Mirror public chat, private chat, night information, nominations, and votes into per-agent observations.
- Avoid AI recap rendering mutating belief state.

Validation:

- `npm run test:ai-agents`
- `npm test`

## Workstream C - Diagnostics And Documentation Cleanup

Files:

- `docs/INDEX.md`
- `docs/diagnostics/AI_REPLAY_ANALYSIS_2026-05-03.md`
- `docs/diagnostics/AI_REPLAY_RAW_MOJIBAKE_2026-05-03.txt`

Purpose:

- Move the temporary user replay log out of the docs root.
- Keep the raw mojibake log for traceability.
- Add a readable analysis document explaining why the old AI appeared to identify the demon immediately.
- Restore `docs/INDEX.md` to readable Chinese and add the new AI Agent MVP docs.

## Current State

All current checks pass, but these workstreams are still mixed in one worktree. Before pushing or making a release,
commit them together only if the target branch is allowed to contain both role-interface and AI-agent work. Otherwise,
split them into separate commits/branches.
