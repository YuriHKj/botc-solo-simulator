# Core Playable UI + AI Verification - 2026-06-13

## 17:21 CorePlayable Fix Pass

Release package:

- Folder: `output/release-unity-ai/BOTC-Solo-Unity-AI-CorePlayable-20260613-1721`
- Zip: `output/release-unity-ai/BOTC-Solo-Unity-AI-CorePlayable-20260613-1721.zip`
- Cleanup report: `output/release-unity-ai/BOTC-Solo-Unity-AI-CorePlayable-20260613-1721/release-cleanup-report.json`
- Latest cleanup report mirror: `output/release-unity-ai/release-cleanup-report-latest.json`

Fix evidence:

- Proactive whisper offers now require an explicit offer id for accept/decline; accepting one offer no longer consumes the first queued offer by default.
- Pending proactive whisper viewmodels expose only public-safe fields: offer id, seat, player name, public intent/reason, and new-offer state. Role identity, role icon identity text, private prompt, focus id, and private content are not exported before acceptance.
- Stage dialogue lifecycle is gated behind gameplay state and cleared when returning to the main menu, opening role selection, starting a new game, or resetting state. The clear path also hides pending modals and stops queued dialogue/phase/action routines.
- Public conversation steps now export structured progression: speaker, target, stance, question, reason, follow-up, nomination tendency, and final public line. Three action-bridge conversation steps produced a nomination path.
- Player-visible AI text is sanitized against internal analysis terms including `私下入口`, `定性`, `公开追问`, `自洽`, `降压`, `降权`, `主压力位`, `证据联动`, `判定标准`, `举证责任`, `世界分支`, and `角色假说`.
- Release packaging now writes a report-only retention/cleanup manifest. The policy keeps the latest 2 playable package groups and latest 1 verified package group, and only reports archive/delete candidates unless a user explicitly approves cleanup.

UI evidence:

- Screenshot manifest: `output/ui-evidence-core-playable-20260613-1721/manifest.json`
- Main menu: `output/ui-evidence-core-playable-20260613-1721/main-menu.png`
- Role picker: `output/ui-evidence-core-playable-20260613-1721/role-picker.png`
- Safe proactive whisper offer: `output/ui-evidence-core-playable-20260613-1721/proactive-whisper.png`
- Private chat: `output/ui-evidence-core-playable-20260613-1721/private-chat.png`
- Public discussion: `output/ui-evidence-core-playable-20260613-1721/phase-assist-public.png`
- Nomination debate: `output/ui-evidence-core-playable-20260613-1721/nomination-debate.png`
- Visual verifier report: `output/ui-evidence-core-playable-20260613-1721/visual-regression-report.json`

Validation commands:

- `npm run test:unity-action-bridge` passed.
- `node tests/ai_agent_contracts.mjs` passed.
- `node tests/unity_asset_contracts.mjs` passed.
- `npm run test:unity-csharp-smoke` passed with existing CS0649 warnings only.
- `npm run unity:sync-build-core` passed with 0 files copied after sync.
- `npm run test:unity-viewmodel` passed.
- `npm run test:ai-llm-renderer` passed.
- `node tests/ai_llm_dialogue_eval_contracts.mjs` passed.
- `npm run ai:llm-dialogue-eval -- --sample --mock --limit=50` passed: 50 rows, 50 passed, 0 failed, 0 final warnings.
- `powershell -ExecutionPolicy Bypass -File tools/package_unity_ai_release.ps1 -PackageName BOTC-Solo-Unity-AI-CorePlayable-20260613-1721 -OutputRoot output\release-unity-ai -VerifyPackage` passed.
- `powershell -ExecutionPolicy Bypass -File tools/capture_unity_ui_smoke.ps1 -States main-menu,role-picker,proactive-whisper,private-chat,phase-assist-public,nomination-debate -WindowWidth 1600 -WindowHeight 900 -UnityExe output\release-unity-ai\BOTC-Solo-Unity-AI-CorePlayable-20260613-1721\BOTC_Unity_Prototype.exe -StreamingAssets output\release-unity-ai\BOTC-Solo-Unity-AI-CorePlayable-20260613-1721\BOTC_Unity_Prototype_Data\StreamingAssets -RestoreRuntimeState -OutputDir output\ui-evidence-core-playable-20260613-1721` passed.
- `powershell -ExecutionPolicy Bypass -File tools/verify_unity_ui_smoke.ps1 -Manifest output\ui-evidence-core-playable-20260613-1721\manifest.json -RequiredStates main-menu,role-picker,proactive-whisper,private-chat,phase-assist-public,nomination-debate -RequiredViewports 1600x900 -ReportPath output\ui-evidence-core-playable-20260613-1721\visual-regression-report.json` passed: 6 screenshots, 0 warnings, 0 failures.

Remaining issues:

- No P0 blocker was observed in the targeted verification or release package verifier.
- The C# smoke still reports pre-existing CS0649 warnings for unused private fields; compilation exits successfully.
- Release cleanup is report-only. No old package was deleted or moved.

## Release Package

- Folder: `output/release-unity-ai/BOTC-Solo-Unity-AI-CorePlayable-20260613-1622`
- Zip: `output/release-unity-ai/BOTC-Solo-Unity-AI-CorePlayable-20260613-1622.zip`
- Build log: `output/unity-build-latest-20260613-161057.log`
- Release gate UI smoke: `output/unity-ui-smoke-release-20260613-161306/visual-regression-report.json`

The package verifier reported `runtimeStateRestored = true`, embedded OpenAI-compatible local LLM rendering touched 2 timeline entries with 0 fallback entries, and the final release UI smoke captured 8 screenshots with 0 warnings and 0 failures.

## UI Evidence

Before/reference screenshots from the previous package smoke:

- Night/action form reference: `output/unity-ui-smoke-action-form-ready-focus-package-20260610/action-form-ready.png`
- Private chat reference: `output/unity-ui-smoke-private-chat-readable-package-20260610/private-chat.png`
- Public flow reference: `output/unity-ui-smoke-phase-assist-public-compact-package-final-20260610/phase-assist-public.png`
- Nomination reference: `output/unity-ui-smoke-nomination-debate-compact-package-20260610/nomination-debate.png`

After/final screenshots from the new package:

- Fortune Teller night double-target flow: `output/ui-evidence-core-playable-20260613-final/fortune-teller-action-form-ready.png`
- Day private chat flow: `output/ui-evidence-core-playable-20260613-final/private-chat.png`
- Day public discussion entry: `output/ui-evidence-core-playable-20260613-final/phase-assist-public.png`
- Day nomination/debate entry: `output/ui-evidence-core-playable-20260613-final/nomination-debate.png`
- Visual verifier report: `output/ui-evidence-core-playable-20260613-final/visual-regression-report.json`

The final evidence set was verified with 4 screenshots, 0 warnings, and 0 failures.

## Fortune Teller Double-Target Record

Command:

```powershell
node scripts/unity_core_package_smoke.mjs --package-dir output\release-unity-ai\BOTC-Solo-Unity-AI-CorePlayable-20260613-1622 --out output\unity-core-package-smoke-20260613-final
```

Result:

- Fresh package runtime files were clean: `unity_state.json`, `unity_viewmodel.json`, `unity_action.json`, and `unity_action_result.json` all started at 0 bytes.
- Fortune Teller action exported `minTargetCount = 2`, `maxTargetCount = 2`, and `targetCount = 2`.
- Empty payload and one-target payload were rejected.
- Accepted payload submitted exactly two target IDs: `["p1", "p2"]`.
- Settled info ping preserved the same two target IDs: `["p1", "p2"]`.
- Result visible in private info: `[第1夜] 你查验 你 与 1号，结果：否。`
- After submit: `phase = day`, `dayStage = private`.
- Evidence file: `output/unity-core-package-smoke-20260613-final/BOTC-Solo-Unity-AI-CorePlayable-20260613-1622-core-smoke/core_playable_evidence.json`

## AI Dialogue Eval

Command:

```powershell
node scripts/ai_llm_dialogue_eval.mjs --mock --sample --limit=30
```

Report:

- Markdown: `output/ai_llm_dialogue_eval/latest.md`
- JSON: `output/ai_llm_dialogue_eval/latest.json`
- Rows: 30
- Passed: 30
- Failed: 0
- Current deterministic warnings: 10
- Final/LLM warnings: 0
- Improved rows: 10
- Worsened rows: 0
- Fallback rows: 3

The report includes deterministic draft, LLM/mock final, fallback reason, and final player-visible text for every row.

## Validation Commands

Passed:

- `npm test`
- `npm run test:unity-csharp-smoke`
- `npm run test:unity-build-core-sync`
- `npm run test:ai-quality-eval`
- `npm run test:ai-llm-dialogue-eval`
- `npm run release:unity-ai:verified -- -PackageName BOTC-Solo-Unity-AI-CorePlayable-20260613-1622 -OutputRoot output\release-unity-ai`
- `powershell -ExecutionPolicy Bypass -File tools\capture_unity_ui_smoke.ps1 -States fortune-teller-action-form-ready,private-chat,phase-assist-public,nomination-debate -WindowWidth 1600 -WindowHeight 900 -UnityExe output\release-unity-ai\BOTC-Solo-Unity-AI-CorePlayable-20260613-1622\BOTC_Unity_Prototype.exe -StreamingAssets output\release-unity-ai\BOTC-Solo-Unity-AI-CorePlayable-20260613-1622\BOTC_Unity_Prototype_Data\StreamingAssets -RestoreRuntimeState -OutputDir output\ui-evidence-core-playable-20260613-final`
- `powershell -ExecutionPolicy Bypass -File tools\verify_unity_ui_smoke.ps1 -Manifest output\ui-evidence-core-playable-20260613-final\manifest.json -RequiredStates fortune-teller-action-form-ready,private-chat,phase-assist-public,nomination-debate -RequiredViewports 1600x900 -ReportPath output\ui-evidence-core-playable-20260613-final\visual-regression-report.json`
- `node scripts/unity_core_package_smoke.mjs --package-dir output\release-unity-ai\BOTC-Solo-Unity-AI-CorePlayable-20260613-1622 --out output\unity-core-package-smoke-20260613-final`

## Remaining Issues

- No remaining P0 blocker was observed in the final package checks.
- `test:unity-csharp-smoke` still emits CS0649 warnings for unused private compose preview/readiness fields. They do not fail compilation, but they should be either wired up or removed in a later cleanup.
- The 30-row dialogue eval used the deterministic mock renderer for broad classification; the release package separately verified the embedded OpenAI-compatible local LLM path on a smaller live package flow.
- The bundled LocalLLM tier is `tiny`; direct AI polish remains opt-in through `Start AI Polished.bat` for this package tier.
