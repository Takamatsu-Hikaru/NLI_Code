import { MENTOR_SYSTEM_PROMPT } from "./prompts";
import type { MentorJudgment, MentorMap, MentorMapNode, MapState } from "./types";

function preview(value: unknown, maxChars = 220): string {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  if (!text) return "";
  return text.length <= maxChars ? text : `${text.slice(0, maxChars - 1)}…`;
}

function compactNodeLine(node: MentorMapNode): string {
  const attrs = node.attrs ?? {};
  const details = [
    typeof attrs.kind === "string" ? `kind=${attrs.kind}` : "",
    typeof attrs.capability === "string" ? `capability=${attrs.capability}` : "",
    typeof attrs.tool === "string" ? `tool=${attrs.tool}` : "",
    typeof attrs.path === "string" ? `path=${attrs.path}` : "",
    typeof attrs.input === "string" ? `input=${preview(attrs.input, 120)}` : "",
    typeof attrs.result === "string" ? `result=${preview(attrs.result, 180)}` : "",
  ]
    .filter(Boolean)
    .join("; ");
  return `- ${node.id} [${node.type}${node.status ? `/${node.status}` : ""}]: ${preview(node.label, 220)}${details ? ` (${details})` : ""}`;
}

function getMapNode(map: MentorMap, id: string): MentorMapNode | undefined {
  return map.nodes.find((node) => node.id === id);
}

function environmentFactNodes(map: MentorMap): MentorMapNode[] {
  return map.nodes.filter(
    (node) =>
      node.type === "observation" &&
      node.attrs?.kind === "environment_fact" &&
      node.attrs?.status === "available",
  );
}

function rawMentorEvidenceNodes(map: MentorMap): MentorMapNode[] {
  return map.nodes.filter(
    (node) =>
      node.type === "observation" &&
      node.status === "open" &&
      (node.attrs?.kind === "agent_statement" || node.attrs?.kind === "tool_failure"),
  );
}

function openMentorInstructionNodes(map: MentorMap): MentorMapNode[] {
  return map.nodes.filter(
    (node) => node.type === "mentor_instruction" && node.status !== "resolved",
  );
}

export function buildMentorDigest(map: MentorMap, mapState?: MapState): string {
  const goal = getMapNode(map, "goal:main")?.label ?? "unknown";
  const environmentFacts = environmentFactNodes(map).slice(-12);
  const plans = map.nodes.filter((node) => node.type === "plan").slice(-5);
  const actions = map.nodes
    .filter((node) => node.type === "action" || node.type === "browser_action")
    .slice(-12);
  const rawEvidence = rawMentorEvidenceNodes(map).slice(-12);
  const artifacts = map.nodes.filter((node) => node.type === "artifact").slice(-8);
  const instructions = openMentorInstructionNodes(map).slice(-5);
  const finalAttempts = map.observations
    .filter((entry) => entry.predicate === "agent_moved_toward_final")
    .slice(-5)
    .map((entry) => `- ${entry.id}: ${preview(entry.value, 220)}`);

  const section = (title: string, lines: string[]) => [
    `## ${title}`,
    ...(lines.length > 0 ? lines : ["- none"]),
    "",
  ];

  return [
    "# Mentor Review Digest",
    "",
    "You are reviewing behavior, not solving the task.",
    `Goal: ${goal}`,
    `Stage: ${mapState?.stage ?? "unknown"}`,
    `Mode: ${mapState?.mode ?? "unknown"}`,
    `Active artifact: ${mapState?.active_artifact ?? "unknown"}`,
    "",
    ...section("Verified Environment Facts", environmentFacts.map(compactNodeLine)),
    ...section("Recent Plans", plans.map(compactNodeLine)),
    ...section("Recent Actions", actions.map(compactNodeLine)),
    ...section("Raw Tool Failures And Agent Statements", rawEvidence.map(compactNodeLine)),
    ...section("Recent Artifacts", artifacts.map(compactNodeLine)),
    ...section("Open Mentor Instructions", instructions.map(compactNodeLine)),
    ...section("Finalization Attempts", finalAttempts),
  ].join("\n");
}

export function parseMentorJudgment(value: unknown): MentorJudgment | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const decision = typeof record.decision === "string" ? record.decision : "";
  if (
    decision !== "continue" &&
    decision !== "intervene" &&
    decision !== "force_replan" &&
    decision !== "request_context_reset"
  ) {
    return undefined;
  }
  return {
    decision,
    reason: preview(record.reason ?? "", 500),
    map_refs: Array.isArray(record.map_refs)
      ? record.map_refs.filter((ref): ref is string => typeof ref === "string").slice(0, 8)
      : [],
    diagnosis: preview(record.diagnosis ?? record.reason ?? "", 500),
    instruction: preview(record.instruction ?? "", 800),
    required_response: preview(record.required_response ?? "", 800),
    disallowed_next_steps: Array.isArray(record.disallowed_next_steps)
      ? record.disallowed_next_steps
          .filter((entry): entry is string => typeof entry === "string")
          .map((entry) => preview(entry, 180))
          .slice(0, 6)
      : [],
  };
}

export function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/iu)?.[1]?.trim();
  const candidate = fenced ?? trimmed.match(/\{[\s\S]*\}/u)?.[0] ?? trimmed;
  return JSON.parse(candidate);
}

export function getMentorSystemPrompt(): string {
  return MENTOR_SYSTEM_PROMPT;
}
