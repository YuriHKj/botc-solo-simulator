# Unity AI Social And Nomination Flow

Date: 2026-05-12

## Goals

- Surface AI proactive private-chat invitations without interrupting the grimoire.
- Keep declined proactive whispers private: no timeline entry and no quota consumption.
- Keep AI-AI whispers out of player logs while exposing weak social-read clues in recap/debug UI.
- Replace public-discussion "round" wording with a conversation clock.
- Make nomination feel like a window with pressure and a pre-vote debate beat.

## Data Flow

Unity consumes these JS Core bridge actions:

- `ai-proactive-whispers`: create queued invitations only.
- `accept-proactive-whisper`: accept one invitation, then the full whisper enters timeline.
- `decline-proactive-whisper`: remove one invitation without leaking content.
- `ai-private-whispers`: run AI-AI private exchanges; only social-read evidence remains.

Unity viewmodel additions:

- `pendingProactiveWhispers[]`: already exported by JS Core; Unity adds a C# DTO and toast UI.
- `aiSocialClues[]`: new lightweight strings derived from AI evidence books, shown only in recap/debug UI.
- `conversationClock`: public-stage UI label/progress/beat names.
- `nominationWindow`: nomination-stage UI label/progress/soft-expired flag.
- `nominationDebate`: pre-vote debate lines derived from latest nomination/vote metadata.

## UI Behavior

### Proactive Whisper Toast

- Only visible during day/private stage.
- Anchored near lower-right but above the bottom action dock.
- Displays one invitation at a time: token, seat, persona label, reason, and queue count.
- Actions:
  - Accept: sends `accept-proactive-whisper` with `offerId`, selects/open the existing private-chat stage for the speaker.
  - Later: hides this toast locally for the current view until viewmodel refresh changes the queue.
  - Decline: sends `decline-proactive-whisper`; the offer fades/clears after JS Core refresh.

### AI-AI Social Clues

- No player event log entry.
- Recap/debug drawer appends `社交线索：A 与 B 有过私聊` style lines from `aiSocialClues`.

### Conversation Clock

- Public stage labels: 开场 -> 回应 -> 交锋 -> 提名压力 -> 冷却.
- Uses public timeline count as a presentation proxy.
- UI wording avoids "第 N 轮" for public discussion.

### Nomination Window

- Nomination stage shows a soft progress bar and "提名窗口".
- It is not a rules timer; it gives the player a clear sense of urgency.
- When visually expired and no vote exists, the UI suggests ending the day /空过.

### Debate Panel

- When the latest vote/nomination data exists, show a pre-vote debate panel before/alongside the vote ceremony:
  - nominator statement
  - nominee defense
  - optional third-party interjection
- Uses bottom dialogue-panel styling and token portrait conventions.

## Verification

- Existing JS bridge contracts must continue to pass.
- Unity build must compile after adding DTOs.
- UI smoke should cover main board/public/nomination/vote-style views once fixtures support these states.
