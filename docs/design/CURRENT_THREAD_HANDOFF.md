# BOTC Solo Simulator UI Thread Handoff

Date: 2026-05-15

This handoff is for starting a new Codex thread focused on Unity UI work. The current thread became long; use this file as the compact project context.

## Current Goal

Continue polishing the Unity prototype UI while keeping JS Core as the rule and AI engine.

Scope for the next UI thread:

- Unity UI, interaction flow, animation, readability, and user-facing feedback.
- Do not rewrite the JS Core rules or AI model logic unless a UI bug is caused by a contract mismatch.
- Preserve current uncommitted/unpushed work. Do not reset or wipe the worktree.

## Repository State To Check First

Run these at the start of the new thread:

```powershell
git status --short --branch
npm test
```

Known state at the time of this handoff:

- Local branch: `main`.
- Remote: `origin/main` at `https://github.com/YuriHKj/botc-solo-simulator.git`.
- Commit `52878eb feat: polish unity ui and ai flow` was pushed successfully.
- Two later local commits may still be ahead of origin because GitHub port 443 failed during push:
  - `f2e964d fix: sync llm speech renderer repair`
  - `72a646a fix: harden llm speech anti-copy`
- At the time this handoff was written, `git status` still showed modified AI renderer files:
  - `scripts/ai_llm_renderer.js`
  - `tests/ai_llm_renderer_contracts.mjs`
  - `unity-prototype/Assets/StreamingAssets/BotcJsCore/scripts/ai_llm_renderer.js`

Do not discard those files. Inspect and either commit/push them if they are intended, or ask before changing them.

## Recent Verification

The following passed during the previous thread:

- Full `npm test`.
- Unity Windows batch build via Unity 2022.3.62f3.
- `git diff --check` had only CRLF warnings.

Additional verification on 2026-05-15 in the continued UI thread:

- `npm run test:ai-agents`
- `npm run test:unity-viewmodel`
- `npm run test:unity-action-bridge`
- `npm test`

The latest gameplay-specific fix:

- Night storyteller information now queues before the dawn/phase transition instead of appearing only after daybreak.
- The intended flow is: night action resolves -> storyteller bottom dialogue appears -> player reads/closes it -> dawn/day transition plays.
- AI nominators now visibly vote yes for their own nominations.
- Unity viewmodel clears stale `voteCeremony` outside the current day nomination stage, so grimoire nomination/vote markers do not persist after day end.
- AI nomination text now avoids reusing low-pressure statement memory as a nomination reason and uses seat labels for human targets.
- Unity bridge pending actions now tolerate LLM latency: slow processing shows a waiting state, tracked flow actions are serialized, and JS LLM postprocess is capped per action.
- Entering public discussion now gives the human a public table claim first and advances only one conversation-clock AI speaker; it no longer triggers a full legacy AI round that pressures the silent human.
- Public discussion now has an explicit `human-public-speech` bridge action and a Unity phase-assist input/button, so the main POV can speak during public chat before asking AI to continue.
- Entering public clears same-day queued proactive private whisper offers, and Unity suppresses proactive whisper cards while a private-to-public phase exit is pending.
- Accepting an AI proactive whisper now consumes a normal human private-chat slot.
- Public day actions now have a Unity "公开发动" treatment: Slayer uses grimoire target selection plus "公开开枪", Gossip uses statement input plus "公开声明", both routed through `day-action` with `resolvedImmediately/publicAction/speechId` feedback and public timeline entries.
- Two small JS Core timing/contract fixes were included because they blocked full validation: Slayer now returns the speech id for its public shot, and simplified night no longer resolves BMR/SNV end-of-day triggers from setup before D1.
- A light Unity UI polish pass added reusable button press/hover motion, connected grimoire token buttons to that feedback, and gave the stage dialogue portrait a breathing speaker aura plus clearer storyteller/player labels.

- Unity now treats active/queued stage dialogue as higher priority than proactive whisper cards: AI private-visit invites hide while the storyteller dialogue is visible or queued, and they retry rendering one frame after the storyteller dialogue closes.
- Main menu overlay is lighter so the town background reads more clearly; the Unity information drawer now has a notebook-style parchment layout and its `intel` tab only summarizes AI role claims plus explicit reported info, not long private-chat transcript text.

Key files for that fix:

- `unity-prototype/Assets/Scripts/BotcPrototypeBootstrap.InfoDrawer.cs`
- `unity-prototype/Assets/Scripts/BotcPrototypeBootstrap.MenuSettings.cs`
- `unity-prototype/Assets/Scripts/BotcPrototypeBootstrap.CoreInterop.cs`
- `unity-prototype/Assets/Scripts/BotcPrototypeBootstrap.StageDialogue.cs`
- `unity-prototype/Assets/Scripts/BotcPrototypeBootstrap.cs`
- `scripts/ai.js`
- `scripts/engine.js`
- `scripts/unity_viewmodel.js`
- `scripts/unity_action_bridge.mjs`
- `scripts/roles/tb.js`
- `scripts/roles/bmr.js`
- `scripts/ai_private_social.js`
- `scripts/ai_statement_memory.js`
- `unity-prototype/Assets/StreamingAssets/BotcJsCore/scripts/ai.js`
- `unity-prototype/Assets/StreamingAssets/BotcJsCore/scripts/engine.js`
- `unity-prototype/Assets/StreamingAssets/BotcJsCore/scripts/ai_private_social.js`
- `unity-prototype/Assets/StreamingAssets/BotcJsCore/scripts/ai_statement_memory.js`
- `unity-prototype/Assets/StreamingAssets/BotcJsCore/scripts/unity_viewmodel.js`
- `unity-prototype/Assets/StreamingAssets/BotcJsCore/scripts/unity_action_bridge.mjs`
- `unity-prototype/Assets/StreamingAssets/BotcJsCore/scripts/roles/tb.js`
- `unity-prototype/Assets/StreamingAssets/BotcJsCore/scripts/roles/bmr.js`
- `unity-prototype/Assets/Scripts/BotcPrototypeBootstrap.CoreInterop.cs`
- `unity-prototype/Assets/Scripts/BotcPrototypeBootstrap.ActionForms.cs`
- `unity-prototype/Assets/Scripts/BotcPrototypeBootstrap.StageDialogue.cs`
- `unity-prototype/Assets/Scripts/BotcPrototypeBootstrap.UiUtilities.cs`
- `unity-prototype/Assets/Scripts/BotcButtonMotionFeedback.cs`
- `unity-prototype/Assets/Scripts/BotcPrototypeBootstrap.PrivateChat.cs`

## Architecture Summary

There are two main layers:

- JS Core: authoritative rules, setup, AI behavior, bridge actions, viewmodel export.
- Unity prototype: UI, animations, input, panels, build packaging, and embedded JS Core runtime files.

Unity consumes exported state and sends actions through bridge files/scripts. The Unity copy of JS Core lives under:

```text
unity-prototype/Assets/StreamingAssets/BotcJsCore/scripts/
```

When changing JS files used by Unity, keep root `scripts/` and the embedded Unity copy synchronized.

## Important Unity UI Files

The large Unity bootstrap was split into partial classes. Start here:

- `unity-prototype/Assets/Scripts/BotcPrototypeBootstrap.cs`
- `unity-prototype/Assets/Scripts/BotcPrototypeBootstrap.CoreInterop.cs`
- `unity-prototype/Assets/Scripts/BotcPrototypeBootstrap.StageDialogue.cs`
- `unity-prototype/Assets/Scripts/BotcPrototypeBootstrap.PrivateChat.cs`
- `unity-prototype/Assets/Scripts/BotcPrototypeBootstrap.NominationVote.cs`
- `unity-prototype/Assets/Scripts/BotcPrototypeBootstrap.Reminders.cs`
- `unity-prototype/Assets/Scripts/BotcPrototypeBootstrap.RolePicker.cs`
- `unity-prototype/Assets/Scripts/BotcPrototypeBootstrap.InfoDrawer.cs`
- `unity-prototype/Assets/Scripts/BotcPrototypeBootstrap.ActionForms.cs`
- `unity-prototype/Assets/Scripts/BotcPrototypeBootstrap.Storyteller.cs`
- `unity-prototype/Assets/Scripts/BotcPrototypeBootstrap.MenuSettings.cs`
- `unity-prototype/Assets/Scripts/BotcPrototypeBootstrap.UiUtilities.cs`

Useful JS Core/UI contract files:

- `scripts/unity_viewmodel.js`
- `scripts/unity_action_bridge.mjs`
- `scripts/unity_phase_guard.mjs`
- `scripts/unity_demo_acceptance.mjs`
- `tests/unity_viewmodel_contracts.mjs`
- `tests/unity_action_bridge_contracts.mjs`
- `tests/unity_asset_contracts.mjs`

## UI Features Already Built Or Partially Built

Main menu and settings:

- Main menu separated from game screen.
- Menu background asset added.
- New game setup supports script/player/self-role options in data-driven form.
- Settings include resolution/fullscreen/audio style controls, but user-facing polish may still need work.

Main game UI:

- Fullscreen-first Unity UI baseline around 1920x1080.
- Main grimoire board, token selection, Token Inspector, bottom action area, right-side drawer buttons.
- Common actions plus more-actions drawer.
- Bottom storyteller/dialogue stage with typewriter-style direction started.
- Stage transition animations for night/day/nomination are present but not fully reliable.

Panels:

- Private chat panel redesigned toward bottom dialogue + character/token visual style.
- Info drawer/log/timeline/handbook panels exist.
- Storyteller queue panel exists.
- Complex action forms exist.
- Role picker and reminder/annotation UI exist.
- Voting ceremony was partially moved toward grimoire-centered pointer/token mode.

AI/UI integration:

- Public/private AI speech can be exported into timeline/dialogue structures.
- Proactive whisper bridge actions exist on JS side.
- AI-AI whispers should not be shown to player logs; only weak social clues/debug/recap.
- LLM speech renderer has tests and local fallback behavior.

## Known UI Problems And Next Work

Highest-priority UI flow problems:

1. Player-facing information timing and visibility
   - Night information should appear immediately through storyteller dialogue.
   - Confirm this for all player roles with night info/actions, not just the latest fix path.
   - After a player action, the result should be visible in the main flow, not hidden only in a drawer.

2. Day/night/nomination phase clarity
   - User sometimes cannot tell what happened when day starts.
   - "Previous phase" is confusing and may be unnecessary because gameplay is linear.
   - Suggested next step: create a clear phase task panel: current stage, why user is waiting, next recommended action.

3. Dialogue sequencing
   - User wants public/private AI dialogue to appear asynchronously in order, not dump several log entries while the dialogue box only shows the last line.
   - Storyteller information should use the same bottom dialogue treatment.
   - Need a central UI dialogue queue that handles storyteller, public chat, private chat invitations, private replies, nomination debate, and vote result lines.

4. Private chat
   - Current private panel can still feel modal/window-like.
   - Accepted proactive whisper can jump into the wrong target-selection state.
   - Long private text needs reliable scrolling and no truncation.

5. Voting
   - User dislikes the voting popup window.
   - Target direction: voting directly on the grimoire, with center pointer/clock-hand style and token vote markers, similar to official grimoire reference.

6. Role marking and reminders
   - User wants official-like composition: role icon + reminder tokens, not decorative text badges.
   - Marked role should visibly appear on the target token.
   - Death shroud should sit directly above the role token, official-style.
   - Too many miscellaneous badges currently clutter the token; simplify and prioritize visible layers.

7. Information window
   - Add a clean "Information" window separate from dialogue logs.
   - It should record only:
     - other players' claimed roles,
     - reported information,
     - player's own confirmed information.
   - Do not mix general chat transcript into this window.

8. Main board density and readability
   - Continue increasing common button and role-name font sizes.
   - Avoid top bar overlap with top token.
   - Consider moving script/setup/alive count into the center grimoire area, closer to official reference.

## User's Current UI Direction

The user wants the Unity version to feel more like a real grimoire, less like a stack of debug windows:

- More direct manipulation on the main grimoire.
- Fewer blocking modal windows.
- Bottom dialogue box for conversation/storyteller lines.
- AI and storyteller should feel like entities speaking into the scene.
- More atmosphere and time flow: night should last a few seconds even if the player has no action.
- Animations and audio should make stage changes obvious.
- Official-style token/reminder/role icon visual language is preferred.

## Suggested Next Implementation Order

1. Build a single dialogue queue/controller for bottom dialogue.
   - Inputs: storyteller info, public AI lines, private AI lines, proactive whisper accepted line, nomination debate, vote result.
   - Output: one line at a time with typewriter/audio, next/skip/close controls, and no lost lines.

2. Make player action results surface through that dialogue queue.
   - Example: 占卜师 selects two players -> storyteller dialogue immediately reports the result before phase changes.

3. Replace voting popup with grimoire-centered vote ceremony.
   - Use existing token positions.
   - Show central pointer, nominee/accuser text, vote count, pass/fail threshold.
   - Keep controls small and attached to center, not as a large window.

4. Rework reminder/role mark rendering.
   - Marked role icon should appear clearly on token.
   - Death shroud above token.
   - Only show role-specific reminders if that role is claimed or marked; keep good/evil/custom global reminders always available.

5. Add the dedicated Information window.
   - Feed it from claims, public reports, private reports, and player night info.
   - Do not include full chat logs.

6. Polish phase task guidance.
   - Replace ambiguous previous/next phase controls with contextual recommended action.
   - Highlight the correct button, for example "End Night" when no night action remains.

## Commands To Use

Core tests:

```powershell
npm test
npm run test:unity-viewmodel
npm run test:unity-action-bridge
npm run test:unity-assets
```

Unity build example:

```powershell
& "C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe" -batchmode -quit -projectPath "C:\Users\11507\Documents\Playground\unity-prototype" -executeMethod BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows -logFile "C:\Users\11507\Documents\Playground\output\unity-build.log"
```

UI smoke if needed:

```powershell
npm run unity:ui-smoke
```

## Suggested Opening Prompt For New Thread

```text
请先阅读 C:\Users\11507\Documents\Playground\docs\design\CURRENT_THREAD_HANDOFF.md，恢复 BOTC Solo Simulator 的 Unity UI 线程上下文。
不要 reset 或清理未提交改动。
先运行 git status --short --branch 和 npm test，确认当前状态。
本线程只继续 UI 方向：优先做底部对话队列、说书人信息即时反馈、投票魔典化、角色标记/reminder 官方化、独立信息窗口。
JS Core 规则和 AI 内部逻辑只在 UI 契约需要时小改，并同步 root scripts 和 Unity embedded scripts。
```
