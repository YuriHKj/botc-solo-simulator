# AI Autonomous Day Flow - 2026-05-12

## Scope

This round connects the existing AI social systems to the Unity bridge without changing BOTC rules resolution, role truth, or the Unity UI layout yet.

Implemented in JS Core:

- AI proactive private chat is now an invitation flow, not an immediate pop-up.
- The player can accept or decline an AI proactive whisper.
- A pending proactive offer does not reveal the full private response and does not consume the player's private chat quota.
- Accepting an offer writes the response into the player-visible private timeline.
- Declining an offer removes it without leaking the response text.
- AI-AI private chat no longer appears in human-facing logs or Unity timeline.
- AI-AI private chat still creates weak social evidence: agents can know a private channel happened, but not the content unless they participated.

Implemented in this follow-up round:

- Public chat has a conversation-clock step action, so Unity no longer has to present numbered public rounds.
- Nomination has a soft action-budget window that can be opened, stepped by AI, resolved by human intent, or passed.
- Nomination intent can create a pending mutual debate before the vote is resolved.

## Current Bridge Interfaces

### AI Proactive Whisper Offers

Unity action:

```json
{ "type": "ai-proactive-whispers", "payload": {} }
```

Effect:

- Calls `runAIProactiveWhispers(state, rng, { queueOnly: true })`.
- Appends eligible invitations to `state.aiDialogue.pendingProactiveWhispers`.
- Does not reveal the full message body.
- Does not write a human timeline entry.

Viewmodel field:

```json
{
  "pendingProactiveWhispers": [
    {
      "id": "proactive-1-p5",
      "playerId": "p5",
      "playerName": "5号",
      "playerSeat": 5,
      "personaLabel": "稳健",
      "reason": "手里有一条可私下同步的信息",
      "prompt": "5号 想私聊：手里有一条可私下同步的信息",
      "intent": "night",
      "focusId": "p8",
      "createdAt": 1
    }
  ]
}
```

Accept action:

```json
{ "type": "accept-proactive-whisper", "payload": { "offerId": "proactive-1-p5" } }
```

Decline action:

```json
{ "type": "decline-proactive-whisper", "payload": { "offerId": "proactive-1-p5" } }
```

Acceptance commits the private reply through the same evidence/timeline path as an ordinary AI private response. Decline only records that this AI was declined for the current day, so it should not immediately re-offer.

### AI-AI Private Whisper

Unity action:

```json
{ "type": "ai-private-whispers", "payload": {} }
```

Effect:

- Runs eligible AI-AI private exchanges.
- Hides content from `events`, Unity `timeline`, and `latestDialogue`.
- Records full content only for the two participating agents.
- Records weak channel evidence for all agents:

```json
{
  "kind": "private-channel",
  "source": "social-read",
  "payload": {
    "speakerId": "p2",
    "targetId": "p7",
    "aiToAi": true,
    "contentKnown": false
  }
}
```

This weak line is intentionally not a truth oracle. It supports social reasoning such as:

- If A claims "B told me X" but there is no A-B private-channel edge, other agents may treat that claim as suspicious.
- If A and B did privately talk, the claim becomes socially plausible but not automatically true.
- The content remains invisible to non-participants.

## Public Chat Direction

The user does not want public chat to feel like fixed "round 1 / round 2" turns. The recommended design is a conversation clock: a soft stage machine driven by pressure, response needs, and nomination readiness.

Suggested clock states:

- `opening`: a few agents offer first reads or claims.
- `response`: agents who were targeted answer.
- `crossfire`: agents with linked evidence, contradictory claims, or vote pressure speak.
- `nomination-ready`: discussion has enough pressure to invite nominations.
- `cooldown`: table is repeating itself; move toward nomination window or skip.

Bridge action:

```json
{ "type": "ai-public-step", "payload": { "mode": "conversation-clock" } }
```

Result/viewmodel fields:

```json
{
  "publicConversation": {
    "clock": "crossfire",
    "speakerId": "p8",
    "focusId": "p5",
    "pressure": 0.64,
    "canContinue": true,
    "suggestedActions": ["ask-followup", "open-nomination-window"]
  }
}
```

Implementation note: the old `public-discussion` action remains for Electron/backward compatibility. Unity should prefer `ai-public-step` for the new UI.

## Timed Nomination Direction

Use a soft action-budget timer in JS Core, not wall-clock time. This keeps tests deterministic and avoids hidden real-time state in the rules engine.

State:

```json
{
  "nominationClock": {
    "active": true,
    "ticksRemaining": 4,
    "lastActorId": "p7",
    "lastIntent": "considering-nomination",
    "status": "open"
  }
}
```

Actions:

```json
{ "type": "open-nomination-window", "payload": {} }
{ "type": "ai-nomination-step", "payload": {} }
{ "type": "human-nomination-intent", "payload": { "nomineeId": "p4" } }
{ "type": "pass-nomination-window", "payload": {} }
```

Behavior:

- The player can nominate at any point while the window is open.
- AI agents can self-initiate nomination if pressure and personality thresholds allow it.
- If the window reaches zero ticks with no valid nomination, the day may pass with a clear "today no execution pressure landed" result.
- Repeated AI hesitation should decrement the clock, preventing infinite chatter.

## Post-Nomination Debate Direction

After a nomination, add a short mutual debate before vote ceremony.

Suggested sequence:

1. Nominator statement.
2. Nominee defense.
3. Optional supporter or critic interjection.
4. Vote ceremony.

Language constraints:

- Nominator cites public evidence only.
- Nominee answers the actual accusation and may claim, deny, redirect, or challenge vote timing.
- Evil agents can perform good-team reasoning, but must not leak hidden evil knowledge.
- Debate text should be short and table-like, not a report.

Action:

```json
{ "type": "nomination-debate", "payload": { "nominationId": "n1" } }
```

Viewmodel:

```json
{
  "nominationDebate": {
    "nominationId": "n1",
    "nominatorId": "p8",
    "nomineeId": "p5",
    "lines": [
      { "speakerId": "p8", "role": "nominator", "text": "我提 5号。卡点是他白天口径和票型对不上。" },
      { "speakerId": "p5", "role": "nominee", "text": "我不认这个票。先把我昨晚信息听完，再决定要不要上票。" }
    ],
    "nextAction": "vote"
  }
}
```

## UI Follow-Up Prompt

Use this prompt for the Unity UI follow-up thread:

```text
你现在接手 BOTC Solo Simulator 的 Unity UI。JS Core 已新增 AI 社交自主接口，请只改 Unity 表现层，不重写规则。

已接入的 bridge actions：
1. ai-proactive-whispers：生成 AI 主动私聊邀请，不直接显示完整私聊内容。
2. accept-proactive-whisper：玩家接受某条邀请后，才把完整私聊写入时间线。
3. decline-proactive-whisper：玩家拒绝邀请，不能泄漏完整回复，也不要消耗玩家私聊额度。
4. ai-private-whispers：触发 AI-AI 私聊；内容不显示在玩家日志中，只作为 AI 的弱社交线索。

请设计并实现：
- 私聊阶段用轻量 toast 或小抽屉显示 AI 主动私聊邀请，包含 token/头像、座位号、人格标签、来访原因。
- 每条邀请提供“接受 / 稍后 / 拒绝”三个动作；接受打开现有私聊舞台，拒绝淡出，不写入时间线。
- 主动私聊不要突脸挡住主魔典；最多同时显示 1 条，其余进入小队列。
- AI-AI 私聊不进事件日志，不弹窗；只在 AI 复盘/调试视图里用“社交线索：A 与 B 有过私聊”弱提示展示。
- 公聊不要显示“第 N 轮”，改成 conversation clock：开场、回应、交锋、提名压力、冷却。
- 提名阶段做软限时 UI：显示“提名窗口”进度，玩家或 AI 可主动提名；耗尽后提示今日空过。
- 提名后增加双方互辩面板：提名者陈述、被提名者辩解、可选第三方插话，然后进入投票仪式。
- 保持当前暗黑手绘风格，使用底部对话框 + 人物 token/角色图标，不要做新 landing page。
```

## Open Risks

- Unity C# model classes do not yet expose `pendingProactiveWhispers`; current JSON readers should ignore unknown fields, but UI work must add typed fields before rendering invitations.
- Electron still uses the immediate proactive whisper behavior by default. This is intentional for backward compatibility, but Electron can migrate to offer mode later.
- Old `nomination` still resolves immediate nomination + vote for compatibility. New UI should use `human-nomination-intent` / `ai-nomination-step` followed by `resolve-nomination-vote`.
