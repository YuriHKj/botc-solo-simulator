# AI Human Speech Polish - 2026-05-10

## Findings

Current AI dialogue already has three useful layers:

- `ai_speech_corpus.json` supplies persona-specific lines.
- `composePrivateResponse(...)` and `composePublicLine(...)` choose strategic content.
- `lightlyHumanizePrivateResponse(...)` wraps private replies with more natural openers.

The weak spot is that "humanized" currently mostly means changing the first sentence. Long replies can still read like a generated report: conclusion, evidence, plan, all in one smooth block with little hesitation, self-correction, or table-talk rhythm.

## Scope

This pass only changes final wording cadence. It does not:

- change suspicion scoring,
- change nomination/vote logic,
- add online LLM calls,
- alter visibility rules,
- change Unity or Electron UI.

## Design

Add a small final polish layer in `scripts/ai.js`:

- remove duplicated stock openers,
- insert one short repair/bridge phrase for private reasoning answers,
- insert one short bridge phrase for later or high-pressure public table talk,
- vary the phrase by persona where safe,
- keep original evidence text intact.

Examples of allowed additions:

- "我换个说法，"
- "说白了，"
- "我的意思是，"
- "换句话说，"

Examples of disallowed additions:

- new role information,
- new night results,
- exact private whisper quotation in public,
- hidden evil-team or demon bluff text.

## Verification

Tests should prove:

- private "why suspect" still includes the evidence summary after speech polish,
- private replies contain a human cadence marker,
- public round-two speech contains a table-talk bridge marker,
- existing hidden-info and private-leak contracts still pass.

