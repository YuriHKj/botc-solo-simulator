# Blood on the Clocktower Agent Implementation Plan v1

## 0. Goal

Build a practical first version of a **social-deduction player agent** that can:

1. read and normalize available corpora from related games,
2. reason over day/night game state,
3. generate plausible player dialogue,
4. take voting / nomination stances,
5. later absorb **BOTC-specific mechanics** such as dead-player speech, drunk/poisoned misinformation, madness, and Storyteller-driven uncertainty.

This plan assumes the project will start from **related public corpora** rather than a large native BOTC dialogue dataset.

---

## 1. Inputs Already Prepared

The following project assets already exist and should be treated as source documents:

- `botc_research_pack_v1.md`
- `botc_corpus_acquisition_and_mapping_v1.md`
- `botc_label_schema_v1.json`
- `botc_label_schema_v1.md`

The agent should read these first and treat `botc_label_schema_v1.json` as the schema source of truth.

---

## 2. High-Level Build Order

Implement in this order:

1. **Data acquisition layer**
2. **Normalization layer**
3. **Schema mapping layer**
4. **Dataset QA layer**
5. **Baseline agent loop**
6. **Evaluation harness**
7. **BOTC-specific extension layer**

Do **not** start by training a large model or overdesigning the dialogue engine.
The first milestone is a clean, queryable, schema-consistent dataset.

---

## 3. Phase-by-Phase Plan

## Phase 1 — Repository and Project Skeleton

### Objective
Create a clean project structure so later dataset and agent work do not become tangled.

### Tasks
- Create directories:
  - `data/raw/`
  - `data/interim/`
  - `data/processed/`
  - `schemas/`
  - `scripts/acquisition/`
  - `scripts/mapping/`
  - `scripts/qa/`
  - `agent/`
  - `eval/`
  - `docs/`
- Copy the label schema into `schemas/botc_label_schema_v1.json`
- Place project docs into `docs/`
- Add a top-level README describing pipeline stages

### Deliverables
- repository skeleton
- README
- schema copied into repo

### Exit Criteria
- repo runs without broken imports
- all expected folders exist
- schema is loadable as valid JSON

---

## Phase 2 — Data Acquisition

### Objective
Download or register all usable upstream corpora and preserve provenance.

### Priority Order
1. **Werewolf Among Us**
2. **LLMafia**
3. **AIWolf / AIWolfDial logs**
4. optional simulation corpora / supplementary deception datasets

### Tasks
- For each source, create one acquisition script:
  - `scripts/acquisition/get_werewolf_among_us.py`
  - `scripts/acquisition/get_llmafia.py`
  - `scripts/acquisition/get_aiwolf_logs.py`
- Preserve:
  - source URL
  - download date
  - license string if available
  - source-specific README / metadata
- Save raw files untouched under `data/raw/<source_name>/`
- Generate a manifest file:
  - `data/raw/source_manifest.json`

### Deliverables
- raw source data on disk
- source manifest with provenance metadata

### Exit Criteria
- each source has a raw folder
- no mapping logic is mixed into acquisition scripts
- provenance manifest exists and is human-readable

### Important Constraint
Do not rewrite, rename, or flatten raw files destructively. Raw data must remain reproducible.

---

## Phase 3 — Canonical Internal Intermediate Format

### Objective
Before full schema mapping, define one lightweight intermediate representation to simplify multi-source ingestion.

### Rationale
Different corpora expose different fields. A source-specific parser should first convert data into a **canonical intermediate event format**, then a mapper should convert events into the BOTC label schema.

### Proposed Intermediate Object
```json
{
  "source": "werewolf_among_us",
  "game_id": "...",
  "phase": "day",
  "turn_index": 1,
  "speaker": "P3",
  "audience": "public",
  "text": "...",
  "timestamp": null,
  "raw_metadata": {}
}
```

### Tasks
- Create `schemas/intermediate_event_schema.json`
- Write one parser per source to emit newline-delimited JSON:
  - `data/interim/<source>/events.jsonl`

### Deliverables
- intermediate schema
- source parsers
- normalized event streams

### Exit Criteria
- all selected sources can be parsed into JSONL events
- event records validate against intermediate schema

---

## Phase 4 — Mapping into BOTC Label Schema

### Objective
Map each source into the unified project schema.

### Tasks
- Implement:
  - `scripts/mapping/map_werewolf_among_us.py`
  - `scripts/mapping/map_llmafia.py`
  - `scripts/mapping/map_aiwolf.py`
- Output records in the exact format defined by `botc_label_schema_v1.json`
- Mark unavailable fields explicitly rather than inventing data
- For inferred values, use a dedicated provenance field, e.g.:
  - `field_provenance.epistemic_strength = "heuristic"`
  - `field_provenance.vote_stance = "explicit_source"`

### Mapping Rules
- Preserve source truth where available
- Use `null` or `unknown` when not recoverable
- Never hallucinate hidden roles or states unless source provides them
- Keep source-native IDs in `source_metadata`
- Do not force non-BOTC corpora into fake BOTC mechanics

### Deliverables
- processed JSONL datasets per source:
  - `data/processed/werewolf_among_us.jsonl`
  - `data/processed/llmafia.jsonl`
  - `data/processed/aiwolf.jsonl`

### Exit Criteria
- processed records validate against `botc_label_schema_v1.json`
- null-rate report exists for major fields
- mapping assumptions documented in `docs/mapping_notes.md`

---

## Phase 5 — Dataset QA and Validation

### Objective
Ensure the dataset is structurally correct and analytically useful.

### Tasks
- Create QA scripts:
  - `scripts/qa/check_schema_validity.py`
  - `scripts/qa/check_enum_consistency.py`
  - `scripts/qa/check_missingness.py`
  - `scripts/qa/check_turn_order.py`
- Produce summary reports:
  - utterance count by source
  - label frequency table
  - missingness by field
  - speech_act co-occurrence matrix
  - vote-related field coverage
- Sample 100 records manually and inspect mapping quality

### Deliverables
- QA scripts
- `docs/dataset_qa_report_v1.md`

### Exit Criteria
- schema validation passes
- enum drift is resolved
- no silent field corruption
- a human can read random records and trust the mapping

---

## Phase 6 — Baseline Retrieval + Rule-Based Agent

### Objective
Build a simple, controllable agent before any heavy training.

### Baseline Architecture
Use a three-part baseline:

1. **State tracker**
   - tracks alive/dead
   - tracks claims
   - tracks accusations / defenses
   - tracks vote positions
2. **Retriever**
   - retrieves similar utterances from processed corpora
3. **Response generator**
   - generates candidate dialogue conditioned on state, role, alignment, and phase

### Tasks
- Implement `agent/state_tracker.py`
- Implement `agent/retriever.py`
- Implement `agent/prompt_builder.py`
- Implement `agent/baseline_policy.py`
- Support these actions first:
  - public statement
  - private statement
  - vote stance
  - nomination recommendation

### Deliverables
- baseline agent that can produce structured outputs

### Exit Criteria
- given a mock game state, the agent returns:
  - `utterance`
  - `speech_acts`
  - `targets`
  - `vote_stance`
  - optional `nomination_target`

### Important Constraint
Do not aim for perfect realism yet. Aim for traceability and debuggability.

---

## Phase 7 — Evaluation Harness

### Objective
Measure whether the baseline is usable.

### Evaluation Types
1. **Schema-level evaluation**
   - are outputs valid?
2. **Behavioral evaluation**
   - do outputs match role/alignment constraints?
3. **Dialogue evaluation**
   - are statements coherent, phase-appropriate, and strategically plausible?
4. **Human spot-check evaluation**
   - can a reviewer classify outputs as plausible player behavior?

### Tasks
- Create `eval/test_scenarios.json`
- Create `eval/run_eval.py`
- Build scenario suites for:
  - early-day uncertainty
  - pressure defense
  - soft claim
  - vote push
  - dead-player contribution
  - misinformation state

### Suggested Metrics
- schema validity rate
- contradiction rate
- stance consistency rate
- target consistency rate
- judged plausibility score

### Deliverables
- repeatable evaluation harness
- scenario-based report

### Exit Criteria
- agent can be evaluated offline from fixed scenarios
- output quality is measurable across versions

---

## Phase 8 — BOTC-Specific Mechanics Layer

### Objective
Add the mechanics that make BOTC distinct from generic werewolf/mafia agents.

### First BOTC-Specific Additions
1. **Dead-player speech model**
2. **Single remaining dead vote tracking**
3. **Drunk / poisoned uncertainty model**
4. **Madness-compliance speech style**
5. **Storyteller uncertainty hooks**
6. **Claim-vs-true-role split memory**

### Tasks
- extend state representation
- add BOTC-specific policy rules
- create synthetic scenarios to test these mechanics
- optionally author hand-crafted BOTC-style dialogues to fine-tune prompts or classifiers

### Deliverables
- BOTC-specific scenario set
- upgraded state tracker
- upgraded policy layer

### Exit Criteria
- agent can generate distinct behavior for:
  - sober vs poisoned information
  - alive vs dead speaker
  - sane vs mad presentation pressure

---

## Phase 9 — Optional Model Training / Fine-Tuning

### Objective
Only after the pipeline is stable, decide whether training is necessary.

### Recommended Order
1. retrieval-augmented prompting baseline
2. lightweight classifier heads for speech acts / vote stance
3. optional fine-tuning for style or action prediction

### Do Not Do Yet
- do not fine-tune blindly on mixed corpora before QA
- do not train on labels that are mostly heuristic noise
- do not merge BOTC-specific synthetic data without provenance tags

---

## 4. Concrete File Checklist

The agent should create these files in order:

### First Wave
- `README.md`
- `schemas/botc_label_schema_v1.json`
- `schemas/intermediate_event_schema.json`
- `scripts/acquisition/get_werewolf_among_us.py`
- `scripts/acquisition/get_llmafia.py`
- `scripts/acquisition/get_aiwolf_logs.py`
- `data/raw/source_manifest.json`

### Second Wave
- `scripts/mapping/map_werewolf_among_us.py`
- `scripts/mapping/map_llmafia.py`
- `scripts/mapping/map_aiwolf.py`
- `docs/mapping_notes.md`

### Third Wave
- `scripts/qa/check_schema_validity.py`
- `scripts/qa/check_enum_consistency.py`
- `scripts/qa/check_missingness.py`
- `docs/dataset_qa_report_v1.md`

### Fourth Wave
- `agent/state_tracker.py`
- `agent/retriever.py`
- `agent/prompt_builder.py`
- `agent/baseline_policy.py`
- `eval/test_scenarios.json`
- `eval/run_eval.py`

---

## 5. Acceptance Criteria by Milestone

## Milestone A — Data Foundation Complete
Must have:
- raw data downloaded
- provenance tracked
- intermediate format defined
- processed schema-valid JSONL generated

## Milestone B — Data Trustworthy
Must have:
- QA report
- stable enums
- documented missingness
- mapping assumptions written down

## Milestone C — Agent Baseline Works
Must have:
- state tracker
- retrieval layer
- structured action output
- offline evaluation scenarios

## Milestone D — BOTC-Aware Prototype Works
Must have:
- dead-player logic
- misinformation-aware behavior
- madness-aware speech handling
- BOTC-specific scenario tests

---

## 6. Major Risks and Mitigations

## Risk 1 — Source mismatch
Problem: related corpora are not native BOTC.

Mitigation:
- treat them as behavioral pretraining data, not as BOTC truth
- keep BOTC-specific mechanics in a later extension layer

## Risk 2 — Over-inferred labels
Problem: mapper invents fields that are not actually present upstream.

Mitigation:
- add provenance for inferred fields
- prefer `unknown` over fabricated certainty

## Risk 3 — Schema too complex too early
Problem: agent work stalls because the full schema is too heavy.

Mitigation:
- implement MVP schema path first
- add full fields incrementally

## Risk 4 — Evaluation drift
Problem: generated dialogue sounds fluent but is strategically bad.

Mitigation:
- evaluate vote stance, target consistency, and contradiction rate
- do not rely only on fluency judgments

## Risk 5 — Licensing / reuse confusion
Problem: upstream sources differ in license and provenance.

Mitigation:
- preserve source metadata
- keep a per-source license note in manifest
- separate raw and processed layers

---

## 7. Recommended Immediate Next Action

The agent should begin with exactly these tasks:

1. create repo skeleton,
2. copy schema and docs into repo,
3. implement acquisition scripts,
4. define intermediate event schema,
5. parse one source end-to-end,
6. map one source into final schema,
7. run QA,
8. only then generalize to the remaining sources.

The first end-to-end vertical slice should be:

**Werewolf Among Us → intermediate JSONL → BOTC schema JSONL → QA report**

This is the preferred pilot because it has the best combination of scale, dialogue richness, and usable annotation structure.

---

## 8. Instruction to Agent

When executing this plan:

- prefer small verifiable steps,
- keep raw data immutable,
- write mapping notes as you go,
- surface uncertainty explicitly,
- avoid premature model training,
- optimize for reproducibility over elegance.

If trade-offs are needed, prioritize:

1. schema correctness,
2. provenance,
3. QA visibility,
4. controllable baseline behavior,
5. stylistic realism.
