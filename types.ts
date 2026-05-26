export type MentorMapNodeType =
  | "goal"
  | "environment_fact"
  | "observation"
  | "change"
  | "plan"
  | "action"
  | "browser_action"
  | "artifact"
  | "claim"
  | "mentor_instruction"
  | "agent_response";

export type MentorMapNodeStatus =
  | "open"
  | "resolved"
  | "failed"
  | "superseded"
  | "dirty"
  | "supported"
  | "rejected";

export type MentorMapLinkType =
  | "affects"
  | "should_be_considered_by"
  | "acknowledged_by"
  | "updates_plan"
  | "responded_by"
  | "requires_response"
  | "action_depends_on_claim"
  | "superseded_by";

export type RuntimeEvidence = {
  run_id: string;
  seq: number;
  stream: string;
  tool_call_id?: string;
  ts: string;
};

export type MentorMapNode = {
  id: string;
  type: MentorMapNodeType;
  label: string;
  status?: MentorMapNodeStatus;
  attrs?: Record<string, unknown>;
  observation_refs?: string[];
  updated_at?: string;
};

export type MentorMapLink = {
  id: string;
  from: string;
  to: string;
  type: MentorMapLinkType;
  updated_at?: string;
};

export type ObservationLedgerEntry = {
  id: string;
  type: string;
  subject: string;
  predicate: string;
  value: string;
  status: "open" | "considered" | "resolved" | "stale" | "contradicted";
  source: RuntimeEvidence;
  created_by: "observer" | "executor_report" | "mentor";
  supports: string[];
  invalidates: string[];
  supersedes: string[];
  created_at: string;
};

export type MentorMap = {
  run_id: string;
  session_key?: string;
  version: number;
  observations: ObservationLedgerEntry[];
  nodes: MentorMapNode[];
  links: MentorMapLink[];
  updated_at?: string;
};

export type TaskClaimStatus = "unverified" | "hypothesis" | "supported" | "rejected";

export type TaskClaim = {
  id: string;
  content: string;
  status: TaskClaimStatus;
  branch: string;
  allowed_to_drive_phase_transition: boolean;
  allowed_to_enter_final: boolean;
  created_at: string;
  falsification?: string;
  confidence_ceiling?: number;
  turns_active?: number;
  mentor_review?: {
    evidence_supports: boolean;
    logical_gaps: string[];
    alternative_explanations: string[];
    recommended_verification: string;
    confidence_ceiling: number;
    reviewed_at: string;
  };
};

export type TaskBranchPhase =
  | "orient"
  | "explore"
  | "verify"
  | "execute"
  | "recover"
  | "finalize";

export type TaskBranch = {
  id: string;
  phase: TaskBranchPhase;
  status: "active" | "inactive" | "dirty" | "abandoned" | "merged";
  goal: string;
  checkpoint: string;
  dirty?: boolean;
  dirty_reason?: string;
  usable_for_final?: boolean;
  updated_at: string;
};

export type MapRef = {
  id: string;
  text: string;
  status?: string;
  evidence?: RuntimeEvidence;
};

export type TaskMap = {
  run_id: string;
  session_key?: string;
  version: number;
  goal: string;
  active_branch: string;
  current_phase: TaskBranchPhase;
  branches: Record<string, TaskBranch>;
  pending: MapRef[];
  attempted: MapRef[];
  completed: MapRef[];
  blocked: MapRef[];
  claims: TaskClaim[];
  updated_at?: string;
};

export type SituationMap = {
  run_id: string;
  session_key?: string;
  version: number;
  location: string;
  last_action: string;
  last_result: string;
  active_branch: string;
  updated_at?: string;
};

export type MapState = {
  run_id: string;
  session_key?: string;
  version: number;
  stage: string;
  mode: string;
  active_branch: string;
  active_object: string;
  active_artifact: string;
  checkpoint: string;
  map_context_id?: string;
};

export type MentorDecision =
  | "continue"
  | "intervene"
  | "force_replan"
  | "request_context_reset";

export type MentorJudgment = {
  decision: MentorDecision;
  reason: string;
  map_refs: string[];
  diagnosis: string;
  instruction: string;
  required_response: string;
  disallowed_next_steps: string[];
};
