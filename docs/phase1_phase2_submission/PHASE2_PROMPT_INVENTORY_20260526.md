# Phase 2 Prompt Inventory (Interventions + Continuation)

This file extracts a clean prompt inventory for the rewritten `Phase 2` protocol.

## 1. Trigger Prompts

### `self_check`
Review the trajectory above. Identify anything inappropriate, unsupported, or inconsistent in your current approach. Do not assume your current interpretation is correct; explicitly point to what may be wrong.

### `meta_reflection`
Pause and reflect: are you confident in your current approach? What evidence would disprove it? What assumptions are you relying on, and which of them may be unsupported by the task environment?

## 2. Correction Prompts

### `L1 - Weak Recheck`
Double-check your current approach. Return to the available evidence and verify each key assumption before continuing.

### `L2 - Claim Only`
Your current core claim is likely wrong or inconsistent with the available evidence. Abandon your current assumption and re-evaluate the task.

### `L3 - Concrete Evidence`
Your current narrative is contradicted by the following evidence:

`{evidence}`

Re-evaluate the task based on this counterevidence and change your subsequent reasoning accordingly.

### `L4 - Explicit Solution Path`
Use the following corrected path:

`{solution}`

Counterevidence:

`{evidence}`

Abandon the original path and continue using the corrected path above. Your next step must follow this new path concretely.

## 3. Continuation Prompt (Benchmark-Aware)

After the intervention response, run one continuation step.

### Shared system instruction
You are continuing a prior intervention run. The goal is to observe your very next concrete move, not another vague promise.

## 4. `CL-bench-Life` Continuation Prompt

You are continuing a previously corrected `CL-bench-Life` case.

Do not apologize or summarize. Do not explain what you would do in general terms.

Produce exactly one JSON object with these keys:

```json
{
  "mode": "cl_followup",
  "revised_answer": "...",
  "next_step": "...",
  "why_this_step": "..."
}
```

Requirements:

- `revised_answer` must directly address the original task.
- `next_step` must be the very next concrete thing you would do.
- `why_this_step` must briefly justify why that next step is necessary.

## 5. Behavior-Oriented Continuation Prompt

You are continuing a previously corrected agentic task.

Do not apologize or summarize. You must commit to exactly one next action.

Produce exactly one JSON object with these keys:

```json
{
  "mode": "agentic_followup",
  "tool_call": {
    "tool_name": "inspect_artifact|verify_fact|search_workspace|edit_artifact|send_message|run_check|open_file",
    "arguments": { "arg1": "value" }
  },
  "expected_observation": "...",
  "goal_of_step": "..."
}
```

Requirements:

- `tool_call` must represent the immediate next action.
- `expected_observation` must state what the model expects to learn or see.
- `goal_of_step` must specify why this step helps recover from the locked trajectory.

## 6. Recommended Judge Wording

The judge should not treat all post-intervention change as recovery.

It should distinguish:

- verbal acknowledgment,
- answer rewrite,
- plan-only repair,
- concrete next-step update,
- and actual judged improvement.

Suggested judge instruction:

> Do not count wording changes alone as successful recovery. A case should only be interpreted as strict recovery if the original incorrect narrative is abandoned, the post-intervention continuation shows a materially updated next step or action path, and the final judged outcome improves.

## 7. Suggested Paper-Facing Terminology

Use these names in the paper:

- `self_check`
- `meta_reflection`
- `L1 - Weak Recheck`
- `L2 - Claim Only`
- `L3 - Concrete Evidence`
- `L4 - Explicit Solution Path`

Use these continuation labels:

- `cl_followup`
- `agentic_followup`

Avoid automatically calling any response pattern "Recovered" unless the strict recovery definition is met.
