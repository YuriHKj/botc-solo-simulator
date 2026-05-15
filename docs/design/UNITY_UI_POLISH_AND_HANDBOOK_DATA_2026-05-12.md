# Unity UI Polish and Handbook Data

Date: 2026-05-12

## Goal

Smooth the Unity game flow without changing rules or AI behavior. This pass focuses on transition reliability, readability, feedback, and richer handbook content.

## Scope

- Unity UI animation, typography, drawer layout, button highlight hints, and dialogue typing sound.
- JS viewmodel enrichment for handbook data sourced from existing script JSON.
- No rule-engine, AI strategy, or phase-guard logic changes.

## Design

### Phase Transitions

Phase transition overlays should not be stopped mid-animation when JS Core returns a refreshed viewmodel quickly. If a transition is already playing, a new transition request is queued and starts after the current overlay completes. Pending overlays do not narrate; the final confirmed phase overlay does.

### Typography

Button labels, tool buttons, navigation buttons, and role token labels are scaled up slightly. The increase is conservative to preserve current 1920x1080 layout and avoid reintroducing overflow.

### Dialogue Sound

The existing generated UI tick clip is reused for typed dialogue. Playback becomes a little more audible and frequent, still controlled by the UI sound volume setting and disabled in reduced-motion/UI-smoke mode.

### Right Drawer

The right-side information drawer becomes wider and taller. It uses the existing drawer animation path, but the start offset is moved beyond the right screen edge so the panel visibly slides in from offscreen.

### Suggested Actions

Suggested actions are represented by a subtle gold pulse on actionable buttons. The first target is the phase advance button, which should call attention to “处理事项 / 确认推进 / 结算夜晚 / 下一阶段” without forcing the user path.

### Handbook Data

`scripts/grimoire_reference.js` is regenerated from `assets/data/official_tb.json`, `official_bmr.json`, and `official_snv.json`. The Unity viewmodel exports role ability, first-night reminder, other-night reminder, and reminder tokens. Unity renders those fields in the formal handbook detail pane.

## Verification

- Unity batch build.
- `npm run test:unity-viewmodel`.
- `npm run test:unity-action-bridge`.
- `npm run test:unity-assets`.
- `npm run test:unity-demo-acceptance`.
- `npm test`.
- UI smoke screenshots for `stage-dialogue`, `info-drawer`, and `script-handbook`.

