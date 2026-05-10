# Unity Complex Action Form UI

Date: 2026-05-10

## Goal

Make Unity action forms readable when JS Core exports complex role actions such as multi-target choices, player+role guesses, mode selection, or question input.

## Scope

Unity-only visual polish:

- keep `actionForms[]` unchanged;
- keep `night-action`, `day-action`, and `storyteller-action` payload semantics unchanged;
- improve layout, hierarchy, target affordance, selected state, and status feedback.

## Layout

The action form becomes a centered modal:

- header: form title and close hint;
- summary strip: role, input type, prompt, instruction, current selection;
- option area: dynamic controls;
- footer: validation/status plus auto/confirm/close actions.

Control style:

- targets: card buttons in a 5 x 2 page;
- roles: official role-token grid in a 5 x 2 page;
- modes: segmented button row;
- question: full-width input field;
- info-only: centered empty-state guidance.

## Verification

- `npm test`
- `npm run test:unity-demo-acceptance`
- Unity batchmode build
