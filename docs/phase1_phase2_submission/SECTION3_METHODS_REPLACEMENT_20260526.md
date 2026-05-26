# Section 3 / Phase 2 Methods Replacement

This version keeps the existing six intervention conditions but rewrites the protocol so that intervention does not terminate at a single textual response.

## 3 Narrative Lock-in: Intervention and Experiment

The previous section established that NLI can be detected across benchmarks and models and is associated with worse task outcomes. This section asks two follow-up questions: first, to what extent can common interventions mitigate NLI; and second, when interventions fail, what form does lock-in take after intervention.

### 3.1 Case Selection and Experimental Setup

All cases in this section are drawn from the `Phase 1` NLI pool. We primarily sample from confirmed NLI cases and supplement them with a small number of borderline cases and manually reviewed conservative NLI-like cases. Each case corresponds to a concrete benchmark-task-model failure instance. The current intervention universe contains 735 cases: 216 from AppWorld, 288 from CL-bench-Life, 133 from ClawMark, and 98 from WildClawBench.

Each case serves as its own control. For every case, we begin from the original trajectory up to the first lock-in evidence point identified in `Phase 1`, then inject one intervention. We run six intervention trajectories per case: two trigger conditions (`self_check`, `meta_reflection`) and four correction conditions (`L1` weak recheck, `L2` claim only, `L3` concrete evidence, `L4` explicit solution path). These trajectories are run independently from the same pre-lock-in source state.

The key design change is that intervention does not end at a single response. Instead, every trajectory is evaluated in two stages. In Stage A, the model produces its immediate post-intervention response, such as a revised answer, revised diagnosis, or revised plan. In Stage B, the model must continue for one additional step. For behavior-oriented benchmarks (`AppWorld`, `ClawMark`, `WildClawBench`), this continuation step must specify a concrete next action or tool-oriented step. For `CL-bench-Life`, which is answer-centric, the continuation step must provide a revised answer together with the next concrete step. This continuation stage is included to distinguish verbal compliance from a genuine trajectory update.

### 3.2 Evaluation

We separate three layers of evaluation.

First, we record pre-intervention severity, including persistence and outcome damage, as descriptive properties of the original locked trajectory. These fields characterize how severe the original failure was, but they are not treated as intervention success metrics.

Second, we evaluate post-intervention uptake. This layer tracks whether the model changes its narrative, action path, goal interpretation, verification behavior, or artifacts after intervention. These fields are used to distinguish verbal update from stronger trajectory update, but they are not automatically equated with full recovery.

Third, we evaluate post-intervention outcome. Under the current `Phase 2` artifact structure, we do not have uniformly available benchmark-native post-intervention scores for every run. We therefore report `outcome_improved` as the primary aggregate outcome metric, while interpreting it conservatively together with continuation-step evidence.

We define a case as strictly recovered only when three conditions hold: the model abandons the original incorrect narrative, the continuation step shows a concrete updated next action or next-step path, and the judged task outcome improves. Cases that only acknowledge the intervention verbally, rewrite the answer without changing trajectory, or produce a repair plan without transitioning into a new step are treated as partial or surface responses rather than strict recovery.
