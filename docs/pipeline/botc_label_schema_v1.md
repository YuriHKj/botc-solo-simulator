# BOTC Label Schema v1

This document is the human-readable companion to `botc_label_schema_v1.json`.

## Purpose

This schema is for utterance-level annotation of **Blood on the Clocktower** and related social deduction corpora.
It is designed for:

- data labeling
- corpus normalization
- retrieval and search
- agent prompting
- behavior modeling
- downstream model training

It preserves BOTC-specific mechanics while staying compatible with Werewolf, Mafia, and AIWolf style corpora.

## Core design choices

1. **One utterance = one record**
2. **Speech acts are multi-label**
3. **Objective truth and speaker-believed truth are separate**
4. **Public vs private channel is explicit**
5. **Dead-player speech is preserved**
6. **BOTC state flags are first-class fields**

## Two operating modes

### MVP mode
Use this to bootstrap quickly.

Required fields:

- `game_id`
- `script`
- `phase`
- `day_index`
- `speaker`
- `audience`
- `speaker_alive`
- `speaker_public_claim`
- `text`
- `speech_acts`
- `targets`
- `vote_stance`

### Full mode
Use this for serious training and simulation.

Required fields:

- `game_id`
- `script`
- `phase`
- `day_index`
- `utterance_id`
- `speaker`
- `audience`
- `speaker_alive`
- `speaker_private_role`
- `speaker_alignment`
- `speaker_public_claim`
- `speaker_state`
- `text`
- `speech_acts`
- `targets`
- `epistemic_strength`
- `intent`
- `truth_status_objective`
- `truth_status_subjective`
- `evidence_source`
- `vote_stance`
- `nomination_related`

## Field notes

### `script`
Use BOTC script names for native BOTC data.
Use transfer-source tags for non-BOTC corpora:
- `werewolf_transfer`
- `mafia_transfer`
- `aiwolf_transfer`

### `speaker_state`
Keep these four subfields explicit whenever possible:

- `alive_dead`
- `sober_drunk`
- `healthy_poisoned`
- `sane_mad`

When the source corpus does not expose them, use `unknown`.

### `speech_acts`
This is the main behavior layer.
One utterance can carry multiple labels.

Examples:
- `["hard_claim"]`
- `["soft_claim", "withhold_info"]`
- `["accuse", "coordinate_vote"]`

### `truth_status_objective`
Truth from omniscient replay perspective.

Values:
- `true`
- `false`
- `mixed`
- `unverifiable`
- `unknown`

### `truth_status_subjective`
What the speaker likely believes.

Values:
- `believed_true`
- `known_false`
- `strategic_uncertain`
- `unknown`

This split is critical for BOTC because poisoned/drunk/mad interactions can produce statements that are **objectively false but subjectively sincere**.

## Recommended speech act usage

### Identity and information
- `hard_claim`
- `soft_claim`
- `role_explain`
- `info_dump`
- `withhold_info`
- `partial_reveal`
- `mechanical_check`

### Inquiry and testing
- `probe`
- `cross_check`
- `trap_question`
- `consistency_check`
- `private_pull`

### Persuasion and execution pressure
- `accuse`
- `soft_accuse`
- `defend`
- `pressure`
- `coordinate_vote`
- `anti_execute`
- `nominate`
- `second_push`

### Deception and table management
- `fake_claim`
- `bait`
- `frame`
- `distance`
- `pocket`
- `hedge`
- `mad_play`
- `self_preservation`
- `table_read`
- `meta_comment`
- `appeal_for_trust`
- `appeal_to_logic`
- `appeal_to_emotion`
- `role_pairing`
- `world_building`
- `reputation_repair`

## Mapping advice for existing corpora

### Werewolf Among Us
Best fit for:
- persuasion strategy
- accusations and defenses
- role-claim behavior

Likely missing:
- BOTC state flags
- storyteller signals
- dead-vote semantics

Use:
- `script = "werewolf_transfer"`
- unknown defaults for BOTC-only state fields

### LLMafia
Best fit for:
- timing
- day/night separation
- asynchronous group chat patterns

Likely missing:
- BOTC nomination semantics
- BOTC state flags

Use:
- `script = "mafia_transfer"`

### AIWolf
Best fit for:
- state machine modeling
- role constraints
- vote and execution structure

Likely missing:
- whisper structure
- storyteller interventions
- BOTC-specific status effects

Use:
- `script = "aiwolf_transfer"`

## Minimal engineering plan

1. Freeze the enum sets in `botc_label_schema_v1.json`
2. Build converters for Werewolf Among Us, LLMafia, and AIWolf
3. Normalize all imported corpora into one schema
4. Start with MVP mode
5. Backfill full-mode fields on high-value subsets
6. Add native BOTC samples later for dead-speaking, drunk/poisoned, madness, and storyteller-driven uncertainty

## Suggested filenames

- `botc_label_schema_v1.json`
- `botc_label_schema_v1.md`
- `map_werewolf_among_us.py`
- `map_llmafia.py`
- `map_aiwolf.py`

## Example full record

```json
{
  "game_id": "botc_tb_001",
  "script": "Trouble Brewing",
  "phase": "day",
  "day_index": 2,
  "utterance_id": "d2_u17",
  "speaker": "P4",
  "audience": "public",
  "speaker_alive": true,
  "speaker_private_role": "Fortune Teller",
  "speaker_alignment": "good",
  "speaker_public_claim": "Empath",
  "speaker_state": {
    "alive_dead": "alive",
    "sober_drunk": "sober",
    "healthy_poisoned": "healthy",
    "sane_mad": "sane"
  },
  "action_capability": ["has_ability"],
  "text": "I do not want to fully out this yet, but my information points away from 1 being clean.",
  "speech_acts": ["soft_claim", "withhold_info", "soft_accuse"],
  "targets": ["P1"],
  "epistemic_strength": 2,
  "intent": "set_up_future_push",
  "truth_status_objective": "mixed",
  "truth_status_subjective": "believed_true",
  "deception_type": "cover_true_role",
  "evidence_source": "night_info",
  "vote_stance": "lean_execute_target",
  "nomination_related": false,
  "rhetorical_style": "hedged",
  "pressure_level": "low"
}
```
