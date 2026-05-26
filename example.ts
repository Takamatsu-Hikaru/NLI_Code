import {
  buildExtraTurnMessage,
  buildMentorDigest,
  buildMentorInstruction,
  getMentorSystemPrompt,
  renderMapContext,
  type MapState,
  type MentorMap,
  type SituationMap,
} from "./index";

const map: MentorMap = {
  run_id: "demo",
  version: 1,
  observations: [],
  nodes: [
    { id: "goal:main", type: "goal", label: "Ship the required external deliverable" },
    {
      id: "mentor:1",
      type: "mentor_instruction",
      label: "Unsupported local-substitute narrative detected",
      attrs: {
        map_refs: ["goal:main"],
        instruction: "Stop relying on the failed local substitute path.",
        required_response: "Rewrite the plan and verify the external deliverable.",
      },
    },
  ],
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
console.log(buildMentorInstruction(map));
console.log(
  buildExtraTurnMessage({
    instruction: "Stop relying on the failed local substitute path.",
    required_response: "Rewrite the plan and verify the external deliverable.",
  }),
);
