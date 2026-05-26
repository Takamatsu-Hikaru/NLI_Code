export type CaseType =
  | "appworld_case"
  | "clawmark_case"
  | "wildclaw_case"
  | "clbench_case"
  | "meta_case";

export type BenchmarkName =
  | "AppWorld"
  | "ClawMark"
  | "WildClawBench"
  | "CL-bench-Life"
  | "Meta";

export type ReviewStatus = "未标注" | "待复核" | "已复核";
export type CaseClass = "clean" | "noisy" | "boundary";
export type Solvability = "yes" | "unclear" | "no";
export type SystemAgentClass = "纯系统问题" | "混合问题" | "agent主导";
export type PrimaryErrorType = "tool" | "environment" | "narrative" | "mixed";
export type PrimaryType =
  | "错误任务解释"
  | "能力误判"
  | "工具误归因"
  | "多源综合失败"
  | "替代目标漂移"
  | "分析框架污染"
  | "验证路径锁定"
  | "其他";

export type RubricKey =
  | "narrative_formation"
  | "state_adoption"
  | "counterevidence"
  | "behavioral_non_update"
  | "persistence";

export type AssistantMode = "translate" | "discuss";
export type JudgeKind = "primary" | "skeptical";
export type JudgeScope = "baseline" | "intervention";
export type InterventionType =
  | "baseline"
  | "weak_recheck"
  | "claim_only"
  | "concrete_evidence"
  | "role_trigger"
  | "reset";

export interface CaseSummary {
  id: string;
  caseType: CaseType;
  benchmark: BenchmarkName;
  taskId: string | null;
  title: string;
  model: string | null;
  conditionName: string | null;
  domain: string | null;
  scoreProxy: number | null;
  numFailedTests: number | null;
  numPassedTests: number | null;
  numTotalTests: number | null;
  reviewStatus: ReviewStatus;
  isNliCandidate: boolean | null;
  overallStrength: string | null;
  primaryType: PrimaryType | null;
  caseClass: CaseClass | null;
  primaryErrorType: PrimaryErrorType | null;
  solvability: Solvability | null;
}

export interface CaseFile {
  key: string;
  label: string;
  path?: string | null;
  exists: boolean;
  inlineContent?: string | null;
}

export interface EvidenceSpan {
  id: string;
  dimension: RubricKey;
  sourceFile: string;
  lineStart: number | null;
  lineEnd: number | null;
  quote: string;
  interpretation: string;
  confidence: string;
  turnIndex: number | null;
  evidenceType: string;
}

export interface AssistantNote {
  id: string;
  caseId: string;
  mode: AssistantMode;
  fileKey: string;
  prompt: string;
  sourceText: string;
  answer: string;
  createdAt: string;
}

export interface Annotation {
  reviewStatus: ReviewStatus;
  isNliCandidate: boolean | null;
  confidence: string;
  systemVsAgent: SystemAgentClass | null;
  primaryType: PrimaryType | null;
  primaryErrorType: PrimaryErrorType | null;
  caseClass: CaseClass | null;
  solvability: Solvability | null;
  overallStrength: string;
  reviewerNotes: string;
  rubric: Record<RubricKey, number>;
  evidence: EvidenceSpan[];
}

export interface JudgeOutput {
  id: string;
  caseId: string;
  runId: string | null;
  scope: JudgeScope;
  judgeKind: JudgeKind;
  fileKey: string | null;
  prompt: string;
  sourceText: string;
  answerText: string;
  parsedJson: Record<string, unknown> | null;
  createdAt: string;
}

export interface InterventionRun {
  id: string;
  caseId: string;
  type: InterventionType;
  title: string;
  instruction: string;
  sourceText: string;
  resultText: string;
  notes: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CaseDetail extends CaseSummary {
  rootPath: string;
  files: CaseFile[];
  annotation: Annotation;
  notes: AssistantNote[];
  judges: JudgeOutput[];
  interventions: InterventionRun[];
}
