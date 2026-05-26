## Phase 1: Detection Setup and Annotation

### Benchmarks and Models
We collect 6,035 trajectories across four benchmarks:

- `CL-bench-Life` (formation-stage, long-context QA)
- `AppWorld`
- `WildClawBench`
- `ClawMark`

The latter three are agent benchmarks with multi-turn action traces and are used for behavioral-stage analysis. We evaluate five models:

- `GPT-5.5`
- `Kimi-K2.5`
- `Gemini-3-Flash`
- `Qwen-Plus`
- `Claude-Sonnet-4-6`

Cross-benchmark results are reported as benchmark-macro averages. Model comparisons are reported within benchmark.

### Annotation and Scoring
Every trajectory passes through a two-step screening pipeline under a unified five-dimension rubric:

1. `Step 1` broad screening: flags candidate trajectories that exhibit narrative formation and narrative-organized behavior.
2. `Step 2` conservative re-evaluation: suppresses false positives and produces a conservative confirmed set.

The five core rubric dimensions are:

- `Narrative Formation`: Was a wrong but coherent explanation formed early in the trajectory?
- `State Adoption`: Did that explanation enter the agent's plan and action?
- `Counterevidence`: Was available contrary evidence used or ignored?
- `Behavioral Non-update`: Did the agent's behavior change after new evidence?
- `Persistence`: Did the pattern persist or escalate across turns?

The following fields are recorded as reference fields rather than core rubric dimensions:

- `damage_level`
- `nli_confidence`
- `primary_error_type`
- `solvability`
- `lockin_manifestation`

For `CL-bench-Life`, which lacks multi-turn action traces, NLI judgments rely primarily on:

- `Narrative Formation`
- `State Adoption`
- `Counterevidence`

### Bucket Definition
A trajectory is marked `confirmed_nli` when all of the following hold:

1. the task is verifiably solvable given the available tools and evidence;
2. at least three of the five rubric dimensions score `>= 2`;
3. `Narrative Formation` is one of the dimensions scoring `>= 2`;
4. at least one of `Behavioral Non-update` or `Persistence` scores `>= 2`;
5. Step 2 does not flag environmental confounding.

Cases that satisfy the Step 1 threshold but are overruled or weakened by Step 2 are marked `borderline_nli`. All remaining trajectories are marked `non_nli`.

### Public Reporting Convention
For paper-facing writing, the detection pipeline should be described as:

- `Step 1 broad screening`
- `Step 2 conservative re-evaluation`

The internal implementation may still use separate judge calls, but the public methods section should not rely on the terms `primary` or `skeptical`.
