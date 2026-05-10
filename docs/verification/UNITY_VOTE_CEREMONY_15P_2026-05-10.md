# Unity 15-Player Vote Ceremony Verification

Date: 2026-05-10

Scope:

- Fix Unity vote ceremony token rendering for 13-15 player games.
- Add demo acceptance coverage that proves JS Core exports 15 voters and Unity viewmodel preserves them.

## Commands

```powershell
npm run test:unity-demo-acceptance
npm run test:unity-viewmodel
npm run test:unity-assets
npm test
& 'C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe' -batchmode -quit -projectPath 'C:\Users\11507\Documents\Playground\unity-prototype' -executeMethod BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows -logFile 'C:\Users\11507\Documents\Playground\output\unity-build-vote-ceremony-15p-2026-05-10.log'
```

## Results

- `npm run test:unity-demo-acceptance`: passed.
- `npm run test:unity-viewmodel`: passed.
- `npm run test:unity-assets`: passed.
- `npm test`: passed.
- Unity batchmode build: passed. Log contains `Build Finished, Result: Success.` and `Unity prototype build succeeded`.

The demo acceptance JSON now reports:

- `maxVoteVoters: 15`
- `fifteenPlayerVoteCovered: true`

## Notes

- JS Core was already producing complete `voteCeremony.voters[]`; the bug was Unity-side visual truncation.
- Screenshot regression coverage is still tracked separately in `docs/design/UNITY_UI_ISSUE_LIST_2026-05-10.md`.
