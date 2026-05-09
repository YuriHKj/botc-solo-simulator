# Passive Night Info And Death Trigger Queue

## Goal

Close the remaining migration gap where Unity could look playable while JS Core information was incomplete:

- Passive night/setup information must arrive in the same data channels used by Electron and Unity.
- On-death abilities that require a player or Storyteller decision must pause in `pendingStorytellerActions` instead of being silently auto-resolved.
- The contract must catch missing information shape, not only missing UI text.

## Data Contract

Every human-facing passive information delivery now needs:

- `player.privateNotes[]`: durable per-player private record.
- `state.pendingHumanInfo[]`: immediate human/Unity private info feed.
- `state.events.infoPings[]`: typed evidence for AI review, recap, timeline, and tests.
- `unity_viewmodel.privateInfo[]`: Unity-facing private info text.

`events.infoPings[].type` is part of the contract. Passive generic clues use the effective role id, while role-module clues use explicit role ids such as `spy`, `grandmother`, `chambermaid`, `ravenkeeper`, and `sage`.

## Passive Info Coverage

| Script | Role | Timing | Expected JS Core Source | Unity Surface |
| --- | --- | --- | --- | --- |
| TB | Spy | each night | private notes + typed `infoPings[type=spy]` | `privateInfo` |
| BMR | Grandmother | setup / first night equivalent | private notes + typed `infoPings[type=grandmother]` | `privateInfo` |
| BMR | Chambermaid | each night | private notes + typed `infoPings[type=chambermaid]` | `privateInfo` |
| SnV | Clockmaker / Dreamer / Mathematician / Flowergirl / Town Crier / Oracle | night order driven passive clue | private notes + typed `infoPings[type=<roleId>]` | `privateInfo` |
| SnV | Sage | death only | no generic alive passive clue | Storyteller info queue on demon kill |

SnV passive information is emitted before demon kills in the simplified runner, matching the local night-order table where these info roles wake before demons. This fixes the user-visible case where Oracle could be killed before seeing the expected other-night information.

## Death Trigger Queue Coverage

| Script | Role | Trigger | Queue Type | Resolver |
| --- | --- | --- | --- | --- |
| TB | Ravenkeeper | killed at night | `ravenkeeper-info` | choose one player, write private role info |
| BMR | Moonchild | dies | `moonchild-choice` | choose one living player, schedule night death if good |
| SnV | Sage | killed by demon | `sage-info` | acknowledge precomputed two-player demon clue |
| SnV | Klutz | dies | `klutz-choice` | choose one living player, evil wins if target is evil |
| SnV | Barber | dies with human demon alive | `barber-swap` | human demon chooses two non-demon players to swap |

Unity must receive the queue head through both `pendingStorytellerAction` and the `storyteller-action` entry in `actionForms[]`. The viewmodel now preserves `type` on role-action exports so UI code does not need to infer the queue kind from prompt text.

## Verification

New contract:

```powershell
npm run test:passive-info-queues
```

Covered assertions:

- TB Spy, BMR Grandmother, BMR Chambermaid, and SnV Oracle write all human/Unity information channels.
- SnV Sage does not receive generic passive information while alive.
- TB Ravenkeeper and SnV Sage queue and resolve death-trigger information.
- BMR Moonchild, SnV Klutz, and SnV Barber expose deterministic Storyteller queue actions.
- Unity viewmodel carries `pendingStorytellerAction.type` and an available `storyteller-action` form for queued death triggers.
