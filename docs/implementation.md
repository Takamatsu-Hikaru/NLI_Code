# Nexus Code Implementation Summary

This document summarizes the current Nexus implementation in ClawMark/OpenClaw as of 2026-05-25. It is written as a code-facing handoff and is intended to be checked into git.

## 1. What Nexus is in this repo

In this codebase, "Nexus" is not a single class. It is a runtime supervision stack assembled from:

1. `Observer`: event capture and artifact persistence
2. `Mentor map`: structured runtime state, map diffs, map context construction
3. `Mentor`: rule-based gates plus optional external LLM judgment
4. `Orchestrator hook`: the part that turns mentor output into one extra agent repair turn

The main implementation lives in:

- [nexus/agent-observer.ts](/home/admin/clawmark_latest/nexus/agent-observer.ts:1)
- [src/clawmark/orchestrator.py](/home/admin/clawmark_latest/src/clawmark/orchestrator.py:1)
- [src/clawmark/runtime.py](/home/admin/clawmark_latest/src/clawmark/runtime.py:112)
- [src/clawmark/main.py](/home/admin/clawmark_latest/src/clawmark/main.py:98)

## 2. Runtime entry points

### 2.1 Event capture

`observeAgentEvent(evt)` is the main observer entrypoint:

- [nexus/agent-observer.ts](/home/admin/clawmark_latest/nexus/agent-observer.ts:4504)

On each agent event, it updates and persists:

- `world_state.json` / `.md`
- `task_graph.json` / `.md`
- `situation_graph.json` / `.md`
- `runtime_graph.json` / `.md`
- `task_state.json` / `.md`
- `state_prompt.md`
- `state_prompts/*.md`
- `mentor_log.jsonl`
- `daemon_mentor_reviews.jsonl`
- `state_patches.jsonl`
- `runtime_graph_patches.jsonl`
- `observation_ledger.jsonl`

Artifacts are written under the observe root:

- default: `.openclaw-observe`
- configurable with `OPENCLAW_OBSERVE_DIR`

Path resolution:

- [nexus/agent-observer.ts](/home/admin/clawmark_latest/nexus/agent-observer.ts:465)

### 2.2 Prompt/context construction

The map context is built by:

- `buildNeoOpenClawPromptContext(...)`
- [nexus/agent-observer.ts](/home/admin/clawmark_latest/nexus/agent-observer.ts:4923)

This function persists the latest map files, writes a map context, audits it against the map, and optionally appends a mentor instruction via `checkNeoIntervention(...)`.

### 2.3 Orchestrator intervention

After each stage response, the orchestrator explicitly checks observe artifacts and may grant the agent one extra repair turn:

- [src/clawmark/orchestrator.py](/home/admin/clawmark_latest/src/clawmark/orchestrator.py:148)

This is the bridge from Nexus state into ClawMark scoring runs.

## 3. Component breakdown

### 3.1 Observer

Observer is implemented inside `agent-observer.ts`. It listens to the event stream and records facts without solving the task.

Core observed state:

- `ObservedRunState`
- `WorldState`
- `ObservationLedgerEntry`
- `TaskGraph`
- `SituationGraph`
- `RuntimeGraph`

Definitions:

- [nexus/agent-observer.ts](/home/admin/clawmark_latest/nexus/agent-observer.ts:25)
- [nexus/agent-observer.ts](/home/admin/clawmark_latest/nexus/agent-observer.ts:77)
- [nexus/agent-observer.ts](/home/admin/clawmark_latest/nexus/agent-observer.ts:113)
- [nexus/agent-observer.ts](/home/admin/clawmark_latest/nexus/agent-observer.ts:183)
- [nexus/agent-observer.ts](/home/admin/clawmark_latest/nexus/agent-observer.ts:222)
- [nexus/agent-observer.ts](/home/admin/clawmark_latest/nexus/agent-observer.ts:336)

Event streams the observer reacts to:

- `lifecycle`
- `plan`
- `tool`
- `assistant`
- `thinking`
- `patch`
- `approval`
- `error`

State application:

- [nexus/agent-observer.ts](/home/admin/clawmark_latest/nexus/agent-observer.ts:4224)

Important observer behavior:

1. It records tool starts/results/failures.
2. It records agent plans and assistant statements.
3. It tracks unresolved conflicts and uncertainties.
4. It persists summaries and timeline entries.
5. It computes mechanical environment changes such as command-output diffs.

The exec-output change detector is implemented here:

- [nexus/agent-observer.ts](/home/admin/clawmark_latest/nexus/agent-observer.ts:1056)

### 3.2 Mentor map

This is the most substantial part of the implementation. It is the map side of Nexus.

Important graph/state getters and initializers:

- `getWorldState(...)`
- `getTaskGraph(...)`
- `getSituationGraph(...)`
- `getRuntimeGraph(...)`
- `getTaskState(...)`

References:

- [nexus/agent-observer.ts](/home/admin/clawmark_latest/nexus/agent-observer.ts:602)
- [nexus/agent-observer.ts](/home/admin/clawmark_latest/nexus/agent-observer.ts:685)
- [nexus/agent-observer.ts](/home/admin/clawmark_latest/nexus/agent-observer.ts:736)
- [nexus/agent-observer.ts](/home/admin/clawmark_latest/nexus/agent-observer.ts:812)
- [nexus/agent-observer.ts](/home/admin/clawmark_latest/nexus/agent-observer.ts:864)

The map has explicit node and link types. Particularly important node types are:

- `observation`
- `change`
- `plan`
- `action`
- `artifact`
- `mentor_instruction`

Mentor-relevant map helpers:

- unresolved observer changes: [agent-observer.ts](/home/admin/clawmark_latest/nexus/agent-observer.ts:1541)
- open mentor instructions: [agent-observer.ts](/home/admin/clawmark_latest/nexus/agent-observer.ts:1531)
- raw mentor evidence nodes: [agent-observer.ts](/home/admin/clawmark_latest/nexus/agent-observer.ts:1585)

TaskGraph gating behavior matters because it formalizes when a claim is trusted enough to drive phase transitions or finalization:

- claim write detection: [agent-observer.ts](/home/admin/clawmark_latest/nexus/agent-observer.ts:3727)
- falsification detection: [agent-observer.ts](/home/admin/clawmark_latest/nexus/agent-observer.ts:3744)
- confidence ceilings: [agent-observer.ts](/home/admin/clawmark_latest/nexus/agent-observer.ts:3763)
- claim lifecycle: [agent-observer.ts](/home/admin/clawmark_latest/nexus/agent-observer.ts:3778)
- final gate denial / allow: [agent-observer.ts](/home/admin/clawmark_latest/nexus/agent-observer.ts:4043)

This is where the implementation is closest to an explicit formalization of NLI-like lock-in:

- early claims are stored as structured claims
- unsupported claims are downgraded
- claims without falsification are capped or rejected
- dirty branches are marked unusable for final answers
- finalization is denied if unresolved pending work, blocked actions, or unverified claims remain

### 3.3 Daemon mentor

There are two mentor layers:

1. rule-based mentor decisions generated from TaskGraph and map state
2. optional LLM mentor called from `runDaemonMentorLlm(...)`

Rule-based decisions are created in `updateTaskGraphFromEvent(...)`:

- [nexus/agent-observer.ts](/home/admin/clawmark_latest/nexus/agent-observer.ts:3868)

These decisions include:

- `write_gate`
- `phase_gate`
- `branch_gate`
- `final_gate`
- `rollback`
- `state_refresh`

The LLM mentor path starts here:

- `daemonMentorSystemPrompt()`: [agent-observer.ts](/home/admin/clawmark_latest/nexus/agent-observer.ts:1670)
- `runDaemonMentorLlm(...)`: [agent-observer.ts](/home/admin/clawmark_latest/nexus/agent-observer.ts:1737)
- Anthropic fallback: [agent-observer.ts](/home/admin/clawmark_latest/nexus/agent-observer.ts:1816)

The LLM does not read the raw full trace directly. It reads a digest built from the runtime map:

- `buildDaemonMentorDigest(...)`
- [nexus/agent-observer.ts](/home/admin/clawmark_latest/nexus/agent-observer.ts:1630)

That digest includes:

- verified environment facts
- recent plans
- recent actions
- raw tool failures and agent statements
- recent artifacts
- open mentor instructions
- finalization attempts

The LLM judgment is normalized into:

- `continue`
- `intervene`
- `force_replan`
- `request_context_reset`

Parsing:

- [nexus/agent-observer.ts](/home/admin/clawmark_latest/nexus/agent-observer.ts:1688)

Then the judgment is converted into map-resident mentor instructions:

- [nexus/agent-observer.ts](/home/admin/clawmark_latest/nexus/agent-observer.ts:4667)

Important follow-on logic:

- expired mentor instructions escalate to context reset: [agent-observer.ts](/home/admin/clawmark_latest/nexus/agent-observer.ts:4725)
- candidate responses are reviewed and either resolve or supersede instructions: [agent-observer.ts](/home/admin/clawmark_latest/nexus/agent-observer.ts:4783)

### 3.4 Orchestrator bridge

The orchestrator does not directly call TypeScript functions. Instead, it reads observe artifacts in the sandbox output and decides whether to give the agent one extra turn.

Relevant logic:

- [src/clawmark/orchestrator.py](/home/admin/clawmark_latest/src/clawmark/orchestrator.py:148)

What it checks:

1. latest `mentor_log.jsonl` entry: did rule-based mentor deny?
2. latest `daemon_mentor_reviews.jsonl` entry: did the LLM select `intervene`?

If yes, it sends a repair message:

- "The mentor reviewed your work and found unresolved issues."
- optional `Mentor instruction: ...`
- optional `Corrective action: ...`
- "You have ONE extra turn to fix these issues before the next stage. Address them now."

So there are two forms of intervention in the current repo:

1. prompt-context level intervention inside OpenClaw (`map context` + `mentor instruction`)
2. stage-level extra-turn intervention in ClawMark orchestrator

## 4. Environment flags and how they interact

Main flags:

- `OPENCLAW_OBSERVE=1`: turns on observe artifacts and observer persistence
- `OPENCLAW_OBSERVE_DIR=...`: observe artifact root
- `OPENCLAW_NEO_STATE=1`: enables mentor-map logic
- `OPENCLAW_NEO_PROMPT=1`: enables state prompt injection
- `OPENCLAW_DAEMON_MENTOR_LLM=1`: enables LLM mentor

Mentor provider config:

- `OPENCLAW_DAEMON_MENTOR_API_KEY`
- `OPENCLAW_DAEMON_MENTOR_BASE_URL`
- `OPENCLAW_DAEMON_MENTOR_MODEL`
- `OPENCLAW_DAEMON_MENTOR_TIMEOUT_SEC`
- `OPENCLAW_DAEMON_MENTOR_TEMPERATURE`

Runtime passes these env vars into the sandboxed `openclaw agent` invocation:

- [src/clawmark/runtime.py](/home/admin/clawmark_latest/src/clawmark/runtime.py:128)

When the task finishes, ClawMark downloads the observe directory into results:

- [src/clawmark/main.py](/home/admin/clawmark_latest/src/clawmark/main.py:98)

Docker sandbox exec also surfaces stderr more aggressively when Nexus flags are enabled:

- [src/clawmark/sandbox/docker.py](/home/admin/clawmark_latest/src/clawmark/sandbox/docker.py:87)

## 5. What the three prompt-bearing components are

The repo has many strings, but the three prompt-bearing Nexus components that materially affect behavior are:

1. `State prompt` for the supervised agent context
2. `Daemon mentor LLM prompt` for out-of-band judgment
3. `Intervention injection` prompt that pushes the agent to replan/fix

Their prompt text is collected in:

- [docs/nexus-prompts-20260525.md](/home/admin/clawmark_latest/docs/nexus-prompts-20260525.md:1)

## 6. Important implementation details and caveats

### 6.1 `OPENCLAW_OBSERVE` is the broadest switch

Several downstream behaviors are gated off `OPENCLAW_OBSERVE`, not only off `OPENCLAW_NEO_STATE`. This matters because a wrapper can accidentally enable map persistence but still fail to enable the LLM mentor if `OPENCLAW_DAEMON_MENTOR_LLM` is missing.

### 6.2 The LLM mentor is optional and failure-tolerant

If the LLM path is disabled or times out, reviews are logged as `llm_unavailable` and rule-based logic still continues. This is why a run can have "Nexus" artifacts without actually having a working LLM mentor.

### 6.3 The mentor does not directly solve the task

The system prompt explicitly forbids task solving. The mentor is judging alignment and recovery potential, not producing deliverables.

### 6.4 The most operationally important files

Per run, the most useful files for debugging are:

- `state_prompt.md`
- `runtime_graph.json`
- `runtime_graph.md`
- `task_graph.json`
- `mentor_log.jsonl`
- `daemon_mentor_reviews.jsonl`
- `state_prompt_history.jsonl`

## 7. Current best short description

If we need one short, code-accurate description for this repo:

> Nexus in ClawMark is an external supervision layer over OpenClaw: the observer records runtime facts, the mentor-map layer turns them into a structured world/task/runtime map plus a map context, the mentor judges misalignment from map evidence, and the orchestrator converts mentor output into one extra repair turn.
