import { MAP_CONTEXT_RUNTIME_INSTRUCTIONS } from "./prompts";
import type { MapState, MentorMap, MentorMapNode, SituationMap, TaskMap } from "./types";

function preview(value: unknown, maxChars = 220): string {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  if (!text) return "";
  return text.length <= maxChars ? text : `${text.slice(0, maxChars - 1)}…`;
}

function getMapNode(map: MentorMap, id: string): MentorMapNode | undefined {
  return map.nodes.find((node) => node.id === id);
}

function relatedMapNodeLabels(map: MentorMap, nodeIdValue: string, linkType: string): string[] {
  return map.links
    .filter((link) => link.from === nodeIdValue && link.type === linkType)
    .map((link) => getMapNode(map, link.to)?.label)
    .filter((label): label is string => Boolean(label));
}

function hasOutgoingLink(map: MentorMap, from: string, type: string): boolean {
  return map.links.some((link) => link.from === from && link.type === type);
}

function openChangeNodes(map: MentorMap): MentorMapNode[] {
  return map.nodes.filter((node) => node.type === "change" && node.status !== "resolved");
}

function openObserverChangeNodes(map: MentorMap): MentorMapNode[] {
  return openChangeNodes(map).filter((node) => {
    if (node.attrs?.created_by === "observer") return true;
    return (node.observation_refs ?? []).some((id) => {
      const observation = map.observations.find((entry) => entry.id === id);
      return observation?.created_by === "observer";
    });
  });
}

function openMentorInstructionNodes(map: MentorMap): MentorMapNode[] {
  return map.nodes.filter(
    (node) => node.type === "mentor_instruction" && node.status !== "resolved",
  );
}

function unresolvedObserverChangeNodes(map: MentorMap): MentorMapNode[] {
  return openObserverChangeNodes(map).filter(
    (node) =>
      !hasOutgoingLink(map, node.id, "acknowledged_by") &&
      !hasOutgoingLink(map, node.id, "updates_plan") &&
      !hasOutgoingLink(map, node.id, "responded_by"),
  );
}

function unresolvedMapChangeNodes(map: MentorMap): MentorMapNode[] {
  return openChangeNodes(map).filter(
    (node) =>
      !hasOutgoingLink(map, node.id, "acknowledged_by") &&
      !hasOutgoingLink(map, node.id, "updates_plan") &&
      !hasOutgoingLink(map, node.id, "responded_by"),
  );
}

function renderMapAlignment(map: MentorMap): string[] {
  const lines: string[] = [];
  const unresolvedChanges = unresolvedObserverChangeNodes(map).slice(-8);
  const instructions = openMentorInstructionNodes(map).slice(-5);
  const activePlans = map.nodes.filter((node) => node.type === "plan").slice(-5);

  lines.push("## Mentor Map Alignment");
  lines.push("- Single map rule: observer facts, agent planning, and mentor instructions all live in this map.");
  lines.push("- Observer facts are not executor self-reports; agent cognition must acknowledge or update plan against them.");
  if (activePlans.length === 0) {
    lines.push("- Agent plan nodes: none observed yet.");
  } else {
    lines.push("- Recent agent plan nodes:");
    for (const plan of activePlans) lines.push(`  - ${plan.id}: ${plan.label}`);
  }
  if (unresolvedChanges.length === 0) {
    lines.push("- Observer changes needing agent response: none.");
  } else {
    lines.push("- Observer changes needing agent response:");
    for (const change of unresolvedChanges) lines.push(`  - ${change.id}: ${change.label}`);
  }
  if (instructions.length === 0) {
    lines.push("- Open mentor instructions: none.");
  } else {
    lines.push("- Open mentor instructions:");
    for (const instruction of instructions) {
      const refs = Array.isArray(instruction.attrs?.map_refs)
        ? (instruction.attrs.map_refs as unknown[]).filter((ref): ref is string => typeof ref === "string")
        : [];
      lines.push(`  - ${instruction.id}: ${instruction.label}`);
      if (refs.length > 0) lines.push(`    refs: ${refs.join(", ")}`);
      if (typeof instruction.attrs?.required_response === "string") {
        lines.push(`    required response: ${instruction.attrs.required_response}`);
      }
    }
  }
  lines.push("");
  return lines;
}

function renderChangeDigest(map: MentorMap): string[] {
  const lines: string[] = [];
  const unresolvedChanges = unresolvedMapChangeNodes(map).slice(-6);
  const instructions = openMentorInstructionNodes(map).slice(-4);

  lines.push("## Change Digest");
  if (unresolvedChanges.length === 0 && instructions.length === 0) {
    lines.push("- No open change requires a replan right now.");
    lines.push("");
    return lines;
  }

  if (unresolvedChanges.length > 0) {
    lines.push("- Open changes that must be handled first:");
    for (const change of unresolvedChanges) {
      lines.push(`  - ${change.label}`);
      if (change.observation_refs?.length) {
        lines.push(`    proof observations: ${change.observation_refs.join(", ")}`);
      }
      const impact = preview(change.attrs?.impact ?? change.attrs?.reason ?? "", 260);
      if (impact) lines.push(`    impact: ${impact}`);
      const related = [
        ...relatedMapNodeLabels(map, change.id, "affects"),
        ...relatedMapNodeLabels(map, change.id, "should_be_considered_by"),
      ].filter(Boolean);
      if (related.length > 0) lines.push(`    related: ${[...new Set(related)].join(", ")}`);
    }
  }

  if (instructions.length > 0) {
    lines.push("- Open mentor instructions:");
    for (const instruction of instructions) {
      lines.push(`  - ${instruction.label}`);
      if (typeof instruction.attrs?.required_response === "string") {
        lines.push(`    required response: ${instruction.attrs.required_response}`);
      }
    }
  }

  lines.push("- Replan requirement:");
  lines.push("  - Rewrite the active plan before returning to the previous path.");
  lines.push("  - The next observable action must reflect the change digest above.");
  lines.push("  - Do not answer with acknowledgement only; change the plan, tool choice, or claim.");
  lines.push("  - If this is still stage 0 and you cannot produce a coherent replan, stop and request a context reset or model switch.");
  lines.push("");
  return lines;
}

export function renderMapContext(
  map: MentorMap,
  state: MapState,
  situation: SituationMap,
  task?: TaskMap,
): string {
  const goal = getMapNode(map, "goal:main")?.label ?? "unknown";
  const changes = openChangeNodes(map).slice(-8);
  const lines: string[] = [];

  lines.push("## Mentor Map Context");
  lines.push(`State versions: map=${map.version}, map_state=${state.version}`);
  lines.push("");
  lines.push("Global position:");
  lines.push(`- Goal: ${goal}`);
  lines.push(`- Stage: ${state.stage}`);
  lines.push(`- Active branch: ${state.active_branch}`);
  lines.push(`- Mode: ${state.mode}`);
  lines.push("");
  lines.push("Current focus:");
  lines.push(`- Active object: ${state.active_object}`);
  lines.push(`- Active artifact: ${state.active_artifact}`);
  lines.push(`- Checkpoint: ${state.checkpoint}`);
  lines.push("");

  if (task) {
    lines.push("## Active Claims");
    if (task.claims.length === 0) {
      lines.push("- none");
    } else {
      for (const claim of task.claims.slice(-8)) lines.push(`- [${claim.status}] ${claim.content}`);
    }
    lines.push("");
  }

  for (const line of renderMapAlignment(map)) lines.push(line);
  for (const line of renderChangeDigest(map)) lines.push(line);

  lines.push("Map changes to verify or consider:");
  if (changes.length === 0) {
    lines.push("- none");
  } else {
    for (const change of changes) {
      const affects = relatedMapNodeLabels(map, change.id, "affects");
      const considers = relatedMapNodeLabels(map, change.id, "should_be_considered_by");
      lines.push(`- ${change.id}: ${change.label}`);
      if (change.observation_refs?.length) lines.push(`  proof observations: ${change.observation_refs.join(", ")}`);
      if (affects.length > 0) lines.push(`  affects: ${affects.join(", ")}`);
      if (considers.length > 0) lines.push(`  should be considered by: ${considers.join(", ")}`);
    }
  }
  lines.push("");

  lines.push("Local situation:");
  lines.push(`- Location: ${situation.location}`);
  lines.push(`- Last action: ${situation.last_action || "none"}`);
  lines.push(`- Last result: ${situation.last_result || "none"}`);
  lines.push("");
  lines.push("Runtime instruction:");
  for (const instruction of MAP_CONTEXT_RUNTIME_INSTRUCTIONS) lines.push(`- ${instruction}`);
  lines.push("");

  return lines.join("\n");
}
