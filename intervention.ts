import type { MentorJudgment, MentorMap } from "./types";

function openMentorInstructionNodes(map: MentorMap) {
  return map.nodes.filter(
    (node) => node.type === "mentor_instruction" && node.status !== "resolved",
  );
}

export function buildMentorInstruction(
  map: MentorMap,
  instructionId?: string,
): string | undefined {
  const instruction =
    (instructionId
      ? openMentorInstructionNodes(map).find((node) => node.id === instructionId)
      : openMentorInstructionNodes(map)[0]) ?? null;
  if (!instruction) return undefined;

  const mapRefs = Array.isArray(instruction.attrs?.map_refs)
    ? (instruction.attrs.map_refs as unknown[]).filter((ref): ref is string => typeof ref === "string")
    : [];
  const refs = mapRefs.slice(0, 6).map((ref) => {
    const node = map.nodes.find((entry) => entry.id === ref);
    return node ? `${node.id}: ${node.label}` : ref;
  });

  return [
    "",
    "---",
    `Mentor instruction (initial): ${instruction.id}`,
    instruction.label,
    "",
    "Map refs requiring response:",
    ...(refs.length > 0 ? refs.map((ref) => `- ${ref}`) : ["- none"]),
    "",
    ...(typeof instruction.attrs?.instruction === "string" && instruction.attrs.instruction.trim()
      ? ["Mentor instruction:", instruction.attrs.instruction, ""]
      : []),
    "Required response:",
    typeof instruction.attrs?.required_response === "string"
      ? instruction.attrs.required_response
      : "Update plan, verify with a tool, or revise dependent claims.",
    "",
    "Do not repeat this instruction as a substitute for action.",
    "Rewrite the active plan first. The observer will mark it handled only after a later plan update, verification tool call, or claim revision is recorded in the mentor map.",
    "If this is still stage 0 and you cannot produce a coherent replan, stop and request a context reset or model switch instead of looping.",
  ].join("\n");
}

export function buildExtraTurnMessage(judgment: Pick<MentorJudgment, "instruction" | "required_response">): string {
  const parts = ["The mentor reviewed your work and found unresolved issues."];
  if (judgment.instruction) parts.push(`Mentor instruction: ${judgment.instruction}`);
  if (judgment.required_response) parts.push(`Corrective action: ${judgment.required_response}`);
  parts.push("You have ONE extra turn to fix these issues before the next stage. Address them now.");
  return parts.join("\n\n");
}
