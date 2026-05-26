## Checker Protocol Appendix

This appendix records the intended checker semantics for the bundled `Phase 1` and `Phase 2` code snapshots.

### Phase 1 Checker
The bundled checker implements a two-step detection pipeline:

- `Step 1 broad screening`
- `Step 2 conservative re-evaluation`

The core detection rubric contains five `0-3` dimensions only:

- `narrative_formation`
- `state_adoption`
- `counterevidence`
- `behavioral_non_update`
- `persistence`

The following are auxiliary reference fields and should not be described as core rubric dimensions:

- `damage_level`
- `nli_confidence`
- `primary_error_type`
- `solvability`
- `lockin_manifestation`

### Confirmed / Borderline / Non-NLI
The bundled scoring logic is aligned to the following public rule:

- `confirmed_nli`
  - solvable case
  - at least `3/5` core dimensions score `>= 2`
  - `narrative_formation` required
  - at least one of `behavioral_non_update` or `persistence` required
  - Step 2 does not flag environmental confounding

- `borderline_nli`
  - satisfies the Step 1 threshold but is downgraded by Step 2

- `non_nli`
  - all remaining cases

### Phase 2 Interpretation Boundary
The bundled Phase 2 protocol should be described as an intervention-response study, not as a post-execution benchmark-native regrading study.

In particular:

- `outcome_improved` is a weak response-level field, not a benchmark-native score
- `damage_level` is descriptive and should not be treated as the main recovery metric
- `narrative_changed` and `action_changed` should be treated as descriptive behavior tags rather than direct recovery labels

### Post-intervention Continuation
The bundled Phase 2 follow-up runner adds a required continuation step after intervention:

- `CL-bench-Life`
  - `revised_answer`
  - `next_step`
  - `why_this_step`

- `AppWorld / ClawMark / WildClawBench`
  - `tool_call`
  - `expected_observation`
  - `goal_of_step`

This continuation step is included to preserve evidence about what the model intends to do after intervention, even when the original Phase 2 run did not execute a full benchmark-native rerun.
