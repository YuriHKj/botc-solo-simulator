# Unity Public Entry Flow Verification

Date: 2026-05-15

## Checks

- `npm run test:unity-action-bridge`
- `npm test`
- `git diff --check`
- Manual Node smoke: new game -> day -> `public-discussion`.
- Unity batch build:
  - log: `output/unity-build-public-entry-flow-2026-05-15.log`

## Smoke Result

The exported public timeline contained exactly:

- human public claim: `公开身份：洗衣妇。我先把自己的口径放上桌。`
- one AI public line.

The bridge no longer emits a full AI public round when entering public discussion.

## Result

- All JS tests passed.
- `git diff --check` reported only existing LF/CRLF warnings and no whitespace errors.
- Unity batch build passed with `Build Finished, Result: Success.`
- Root, Unity project embedded, and built exe embedded `unity_action_bridge.mjs` hashes match.

## Notes

For drunk/lunatic-like player perspective, the automatic public claim uses `apparentRoleId` before `roleId`, so it follows the player's perceived identity rather than hidden truth.
