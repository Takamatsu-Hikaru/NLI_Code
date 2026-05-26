# Phase 2 Protocol Rewrite (Unified Experimental Design)

## Purpose
This document rewrites the `Phase 2` intervention experiment into a clean, consistent protocol that matches the intended paper narrative while correcting the main ambiguity in the earlier implementation: intervention must not stop at a single response. After each intervention, the model must be given one explicit opportunity to continue execution or commit to a concrete next step.

The design answers two questions:

1. To what extent can common interventions mitigate narrative lock-in?
2. When interventions fail, what form does lock-in take after the intervention?

This protocol is designed to be clear enough to version in Git and to translate directly into Methods / Appendix text.

## 1. Case Selection

All `Phase 2` cases are drawn from the `Phase 1` NLI pool.

- Primary source: confirmed NLI cases
- Supplement: a small number of borderline cases
- Supplement: manually reviewed conservative NLI-like cases

Each case is a concrete `benchmark x task x model` failure instance.

Current universe:

- `AppWorld`: `216`
- `CL-bench-Life`: `288`
- `ClawMark`: `133`
- `WildClawBench`: `98`
- Total: `735`

This section should be described as a selected intervention universe over concrete failure instances, not as a full benchmark rerun.

## 2. Experimental Design

Each case serves as its own control. For every selected case, we start from the original trajectory up to the first identified lock-in evidence point from `Phase 1`, then inject one intervention. We run six intervention trajectories per case:

### Trigger
- `self_check`
- `meta_reflection`

### Correction
- `L1 - Weak Recheck`
- `L2 - Claim Only`
- `L3 - Concrete Evidence`
- `L4 - Explicit Solution Path`

These six trajectories are run independently from the same pre-lock-in source state.

## 3. Two-Stage Post-Intervention Procedure

The main correction to the earlier design is that intervention cannot end at a single textual answer.

For each trajectory, evaluation must observe two stages:

### Stage A: Immediate post-intervention response
The model first produces its direct response to the intervention:

- revised answer
- revised plan
- revised diagnosis
- explicit refusal or non-update

This stage captures whether the model linguistically acknowledges the intervention.

### Stage B: Post-intervention continuation step
Immediately after Stage A, the model is prompted to continue for one additional step.

This continuation is mandatory and benchmark-aware.

#### For behavior-oriented benchmarks (`AppWorld`, `ClawMark`, `WildClawBench`)
The model must provide either:

- one concrete executable tool or action step, or
- a structured action intention that specifies:
  - next tool or operation
  - expected observation
  - goal of the step

Preferred format:

```json
{
  "mode": "agentic_followup",
  "tool_call": {
    "tool_name": "...",
    "arguments": { "...": "..." }
  },
  "expected_observation": "...",
  "goal_of_step": "..."
}
```

#### For `CL-bench-Life`
Since the benchmark is answer-centric, the continuation step must provide:

- revised answer
- next concrete step
- brief reason for that step

Preferred format:

```json
{
  "mode": "cl_followup",
  "revised_answer": "...",
  "next_step": "...",
  "why_this_step": "..."
}
```

This second stage does not claim full recovery by itself. Its role is to reveal whether the model actually transitions into a new trajectory, remains trapped in the old one, or only performs a verbal correction.

## 4. Intervention Conditions

### Trigger

#### `self_check`
Meta-cognitive self-audit.

Goal:
- force the model to re-examine the previous path
- identify anything inappropriate, unsupported, or inconsistent

Interpretation:
- weakest behavior-preserving trigger
- intended to test whether the model can self-correct without external evidence

#### `meta_reflection`
Counterfactual reflection trigger.

Goal:
- force the model to articulate confidence, failure points, and possible disconfirming evidence

Interpretation:
- stronger than `self_check`
- still does not inject explicit corrective content

### Correction

#### `L1 - Weak Recheck`
Prompt the model to double-check the current approach.

Interpretation:
- minimal external correction
- tests whether a weak prompt is sufficient to destabilize the locked narrative

#### `L2 - Claim Only`
State that the current core claim is likely wrong, without supplying explicit evidence.

Interpretation:
- shifts the model away from naive persistence
- but still leaves the recovery path underspecified

#### `L3 - Concrete Evidence`
Provide explicit contradictory evidence from the task environment and point out the inconsistency.

Interpretation:
- directly challenges the current narrative
- intended to test whether lock-in survives clear counterevidence

#### `L4 - Explicit Solution Path`
Provide:

- corrected claim
- supporting evidence
- concrete next action

Interpretation:
- strongest intervention
- intended to test whether an explicit recovery path can break lock-in

## 5. Evaluation Axes

The earlier implementation mixed pre-intervention severity and post-intervention outcome too aggressively. The rewritten protocol separates them.

### 5.1 Pre-Intervention Severity
These fields characterize how severe the original lock-in was before the intervention:

- narrative formation
- state adoption
- counterevidence resistance
- behavioral non-update
- persistence
- outcome damage

Use:
- descriptive analysis
- severity stratification

Do not use pre-intervention severity fields as direct intervention success metrics.

### 5.2 Post-Intervention Uptake
These fields describe whether the model absorbed the intervention:

- `narrative_changed`
- `action_changed`
- `goal_realigned`
- `verification_changed`
- `artifact_changed`

Use:
- response-type analysis
- to distinguish verbal update from stronger trajectory update

Do not automatically equate these fields with full recovery.

### 5.3 Post-Intervention Outcome
This axis captures whether the intervention trajectory actually moved toward a better task state.

Recommended use:

- `outcome_improved` as the primary reported outcome under the existing `Phase 2` implementation
- with an explicit note that it is a response-level or judged outcome rather than a uniformly benchmark-native rerun score

Under the current artifact structure, `Phase 2` does not provide stable benchmark-native post-score for all runs. Therefore:

- `outcome_improved` remains the reportable aggregate outcome metric
- continuation-step evidence is used to refine interpretation of what "improved" means

## 6. Recovery Definition

To remain compatible with the original paper structure while avoiding overclaiming, recovery should be defined conservatively.

### Strict recovery
A case is counted as strictly recovered only if all three hold:

1. the model breaks the original incorrect narrative and moves toward the correct direction;
2. the post-intervention continuation shows a concrete updated next step or action path;
3. the judged task outcome improves.

### Partial or surface response
A case is not strict recovery if it only:

- acknowledges the intervention verbally,
- rewrites the answer without changing trajectory,
- produces a repair plan without transition into execution,
- or remains in a purely narrative or planning loop.

This distinction should be emphasized in the text:

- `outcome_improved` can be reported as the main aggregate metric;
- but strict interpretation must note that some "improved" cases are only partial or response-level corrections.

## 7. Behavioral Failure Modes After Intervention

The main post-intervention failure categories to report are:

### A. Wrong-but-polished answer
The model produces a more complete, cleaner, or better-structured answer, but the core judgment remains wrong.

### B. Continued old narrative
The model continues the same mistaken interpretation despite correction or counterevidence.

### C. Verbal acknowledgment without trajectory update
The model accepts criticism or says it will revise, but does not transition into a materially different next step.

### D. Plan-only recovery
The model produces a detailed repair plan but remains at the level of description, checklist, or meta-explanation.

### E. Empty or stalled response
The model produces no meaningful update after intervention.

These categories are especially important when discussing why one-shot intervention is not equivalent to full recovery.

## 8. Recommended Reporting Structure

### Main text
Report:

1. intervention effectiveness by `outcome_improved`
2. split by:
   - `CL-bench-Life`
   - `AppWorld + ClawMark + WildClawBench`
3. conservative interpretation:
   - intervention is useful but limited
   - response-level improvement can overestimate full recovery

### Appendix or analysis section
Add:

1. response-pattern breakdown using:
   - no clear uptake
   - narrative-only or weak-action uptake
   - both narrative and action updated
2. continuation-step analysis
3. qualitative examples of the failure categories above

## 9. What This Fixes

This protocol fixes the main ambiguity in the earlier `Phase 2` design:

- earlier: the intervention often ended at a single answer, making it difficult to tell verbal correction from real trajectory change;
- now: every intervention leaves room for one additional continuation step;
- result: the experiment can better separate:
  - surface compliance,
  - planning-only response,
  - concrete next-step update,
  - and full judged improvement.

This makes `Phase 2` a cleaner bridge into `Nexus`: reset and correction may expose a more recoverable path, while `Nexus` is responsible for keeping the model on that path during continued execution.
