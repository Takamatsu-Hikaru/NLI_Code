# NLI_Code

This repository contains a minimal open-source extraction of the Nexus supervision layer under `mentor/map` naming.

The current package is published as a small TypeScript core:

- `mentor.ts`: mentor prompt + digest + judgment parsing
- `state_prompt.ts`: map-context rendering
- `intervention.ts`: mentor instruction and extra-turn recovery message rendering
- `types.ts`: shared types for map nodes, links, claims, and judgments

Supporting notes live in:

- `docs/implementation.md`
- `docs/prompts.md`

## Package name

The package metadata currently uses:

```text
@nexus-open/mentor-map
```

You can rename that later without touching the source layout.

## What is in this package

- `renderMapContext(...)`: render the structured map context injected into the agent
- `buildMentorDigest(...)`: build the mentor-facing digest from the map
- `getMentorSystemPrompt()`: return the mentor system prompt
- `buildMentorInstruction(...)`: render a map-grounded mentor instruction for the agent
- `buildExtraTurnMessage(...)`: render the extra-turn recovery message
- shared types for map nodes, links, claims, and judgments

## Install

```bash
npm install
```

## Build

```bash
npm run build
```

## Example

```ts
import {
  buildExtraTurnMessage,
  buildMentorDigest,
  getMentorSystemPrompt,
  renderMapContext,
  type MapState,
  type MentorMap,
  type SituationMap,
} from "@nexus-open/mentor-map";

const map: MentorMap = {
  run_id: "demo",
  version: 1,
  observations: [],
  nodes: [{ id: "goal:main", type: "goal", label: "Ship the required external deliverable" }],
  links: [],
};

const state: MapState = {
  run_id: "demo",
  version: 1,
  stage: "stage0",
  mode: "execute",
  active_branch: "main",
  active_object: "deliverable",
  active_artifact: "output",
  checkpoint: "initial",
};

const situation: SituationMap = {
  run_id: "demo",
  version: 1,
  location: "/workspace",
  last_action: "",
  last_result: "",
  active_branch: "main",
};

console.log(renderMapContext(map, state, situation));
console.log(getMentorSystemPrompt());
console.log(buildMentorDigest(map, state));
console.log(
  buildExtraTurnMessage({
    instruction: "Stop relying on the failed local substitute path.",
    required_response: "Rewrite the plan and verify the external deliverable.",
  }),
);
```
