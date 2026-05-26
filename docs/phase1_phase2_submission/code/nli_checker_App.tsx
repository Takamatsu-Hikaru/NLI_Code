import { useEffect, useMemo, useState } from "react";
import {
  createAssistantNote,
  createJudgeOutput,
  createMetaCase,
  exportCase,
  exportSummaries,
  fetchCaseDetail,
  fetchCases,
  fetchFileContent,
  saveAnnotation,
  saveInterventionRun,
} from "./api";
import type {
  Annotation,
  AssistantMode,
  BenchmarkName,
  CaseClass,
  CaseDetail,
  CaseSummary,
  InterventionRun,
  InterventionType,
  JudgeKind,
  JudgeOutput,
  PrimaryErrorType,
  PrimaryType,
  ReviewStatus,
  RubricKey,
  Solvability,
  SystemAgentClass,
} from "./types";

const rubricLabels: Record<RubricKey, string> = {
  narrative_formation: "Narrative formation",
  state_adoption: "State adoption",
  counterevidence: "Counterevidence / clean check",
  behavioral_non_update: "Behavioral non-update",
  persistence: "Persistence / escalation",
};

const benchmarkOptions: Array<BenchmarkName | "全部"> = [
  "全部",
  "AppWorld",
  "ClawMark",
  "WildClawBench",
  "CL-bench-Life",
  "Meta",
];

const reviewStatuses: ReviewStatus[] = ["未标注", "待复核", "已复核"];
const caseClasses: CaseClass[] = ["clean", "noisy", "boundary"];
const primaryErrorTypes: PrimaryErrorType[] = ["tool", "environment", "narrative", "mixed"];
const solvabilityOptions: Solvability[] = ["yes", "unclear", "no"];
const strengths = ["", "弱", "中", "强"];
const primaryTypes: PrimaryType[] = [
  "错误任务解释",
  "能力误判",
  "工具误归因",
  "多源综合失败",
  "替代目标漂移",
  "分析框架污染",
  "验证路径锁定",
  "其他",
];
const systemAgentOptions: SystemAgentClass[] = ["纯系统问题", "混合问题", "agent主导"];
const interventionTypes: InterventionType[] = [
  "baseline",
  "weak_recheck",
  "claim_only",
  "concrete_evidence",
  "role_trigger",
  "reset",
];

type ViewerMode = "raw" | "translated";

function defaultAnnotation(): Annotation {
  return {
    reviewStatus: "未标注",
    isNliCandidate: null,
    confidence: "",
    systemVsAgent: null,
    primaryType: null,
    primaryErrorType: null,
    caseClass: null,
    solvability: null,
    overallStrength: "",
    reviewerNotes: "",
    rubric: {
      narrative_formation: 0,
      state_adoption: 0,
      counterevidence: 0,
      behavioral_non_update: 0,
      persistence: 0,
    },
    evidence: [],
  };
}

function defaultRun(caseId: string): InterventionRun {
  const now = new Date().toISOString();
  return {
    id: "",
    caseId,
    type: "weak_recheck",
    title: "",
    instruction: "",
    sourceText: "",
    resultText: "",
    notes: "",
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };
}

function renderJudgeJson(judge?: JudgeOutput | null): string {
  if (!judge) return "暂无";
  if (judge.parsedJson) {
    return JSON.stringify(judge.parsedJson, null, 2);
  }
  return judge.answerText || "暂无";
}

function App() {
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [fileKey, setFileKey] = useState("");
  const [fileContent, setFileContent] = useState("");
  const [annotation, setAnnotation] = useState<Annotation>(defaultAnnotation());
  const [search, setSearch] = useState("");
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus | "">("");
  const [benchmark, setBenchmark] = useState<BenchmarkName | "全部">("全部");
  const [onlyFailed, setOnlyFailed] = useState(true);
  const [messages, setMessages] = useState<string[]>([]);
  const [metaTitle, setMetaTitle] = useState("");
  const [metaNote, setMetaNote] = useState("");
  const [metaContent, setMetaContent] = useState("");
  const [showEvidence, setShowEvidence] = useState(false);
  const [assistantPrompt, setAssistantPrompt] = useState("");
  const [judgePrompt, setJudgePrompt] = useState("");
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [judgeBusy, setJudgeBusy] = useState(false);
  const [viewerMode, setViewerMode] = useState<ViewerMode>("raw");
  const [selectedRunId, setSelectedRunId] = useState<string>("");
  const [runDraft, setRunDraft] = useState<InterventionRun | null>(null);

  async function loadCases() {
    const list = await fetchCases({ search, reviewStatus, benchmark, onlyFailed });
    setCases(list);
    if (!selectedId && list[0]) {
      setSelectedId(list[0].id);
    }
  }

  async function loadDetail(caseId: string) {
    const next = await fetchCaseDetail(caseId);
    setDetail(next);
    setAnnotation(next.annotation ?? defaultAnnotation());
    const firstExisting = next.files.find((file) => file.exists)?.key ?? next.files[0]?.key ?? "";
    setFileKey(firstExisting);
    const firstRun = next.interventions[0]?.id ?? "";
    setSelectedRunId(firstRun);
    setRunDraft(firstRun ? next.interventions.find((item) => item.id === firstRun) ?? null : defaultRun(next.id));
  }

  useEffect(() => {
    void loadCases();
  }, [search, reviewStatus, benchmark, onlyFailed]);

  useEffect(() => {
    if (!selectedId) return;
    void loadDetail(selectedId);
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId || !fileKey) {
      setFileContent("");
      return;
    }
    void (async () => {
      const content = await fetchFileContent(selectedId, fileKey);
      setFileContent(content.content);
    })();
  }, [selectedId, fileKey]);

  useEffect(() => {
    setViewerMode("raw");
  }, [selectedId, fileKey]);

  useEffect(() => {
    if (!detail) return;
    if (!selectedRunId) {
      setRunDraft(defaultRun(detail.id));
      return;
    }
    const run = detail.interventions.find((item) => item.id === selectedRunId) ?? null;
    setRunDraft(run);
  }, [selectedRunId, detail]);

  const translatedNote = useMemo(() => {
    if (!detail || !fileKey) return null;
    return detail.notes.find((note) => note.mode === "translate" && note.fileKey === fileKey) ?? null;
  }, [detail, fileKey]);

  const viewerText =
    viewerMode === "translated"
      ? (translatedNote?.answer ?? "还没有当前文件的中文翻译。点“翻译当前文件”即可。")
      : (fileContent || "暂无文件内容。");

  const sortedEvidence = useMemo(
    () => [...annotation.evidence].sort((a, b) => (a.lineStart ?? 0) - (b.lineStart ?? 0)),
    [annotation.evidence],
  );

  const baselinePrimaryJudge = useMemo(
    () => detail?.judges.find((item) => item.scope === "baseline" && item.judgeKind === "primary") ?? null,
    [detail],
  );
  const baselineSkepticalJudge = useMemo(
    () => detail?.judges.find((item) => item.scope === "baseline" && item.judgeKind === "skeptical") ?? null,
    [detail],
  );
  const runPrimaryJudge = useMemo(
    () =>
      detail?.judges.find(
        (item) => item.scope === "intervention" && item.judgeKind === "primary" && item.runId === selectedRunId,
      ) ?? null,
    [detail, selectedRunId],
  );
  const runSkepticalJudge = useMemo(
    () =>
      detail?.judges.find(
        (item) => item.scope === "intervention" && item.judgeKind === "skeptical" && item.runId === selectedRunId,
      ) ?? null,
    [detail, selectedRunId],
  );

  function updateEvidence(index: number, patch: Partial<Annotation["evidence"][number]>) {
    setAnnotation((prev) => {
      const evidence = [...prev.evidence];
      evidence[index] = { ...evidence[index], ...patch };
      return { ...prev, evidence };
    });
  }

  function addEvidence() {
    setAnnotation((prev) => ({
      ...prev,
      evidence: [
        ...prev.evidence,
        {
          id: crypto.randomUUID(),
          dimension: "narrative_formation",
          sourceFile: fileKey || "manual",
          lineStart: null,
          lineEnd: null,
          quote: "",
          interpretation: "",
          confidence: "",
          turnIndex: null,
          evidenceType: "claim",
        },
      ],
    }));
  }

  async function onSave() {
    if (!selectedId) return;
    await saveAnnotation(selectedId, annotation);
    setMessages(["已保存标注。"]);
    await loadCases();
    await loadDetail(selectedId);
  }

  async function onExport() {
    if (!selectedId) return;
    const result = await exportCase(selectedId);
    setMessages([`已导出 Markdown: ${result.markdownPath}`, `已导出 JSON: ${result.jsonPath}`]);
  }

  async function onExportSummaries() {
    const result = await exportSummaries();
    setMessages([`已导出 baseline summary: ${result.baselineCsvPath}`, `已导出 intervention summary: ${result.interventionCsvPath}`]);
  }

  async function onCreateMetaCase() {
    if (!metaTitle.trim() || !metaContent.trim()) {
      setMessages(["Meta-case 需要标题和正文。"]);
      return;
    }
    const result = await createMetaCase({
      title: metaTitle.trim(),
      sourceNote: metaNote.trim(),
      content: metaContent.trim(),
    });
    setMetaTitle("");
    setMetaNote("");
    setMetaContent("");
    setMessages([`已创建 meta-case: ${result.id}`]);
    await loadCases();
    setSelectedId(result.id);
  }

  async function runAssistant(mode: AssistantMode, sourceText?: string) {
    if (!selectedId) return;
    const text = (sourceText ?? fileContent.slice(0, 40000)).trim();
    if (!text) {
      setMessages(["当前内容为空，无法调用 AI。"]);
      return;
    }
    setAssistantBusy(true);
    setMessages([mode === "translate" ? "正在生成中文翻译..." : "正在生成讨论建议..."]);
    try {
      await createAssistantNote(selectedId, {
        mode,
        fileKey,
        prompt: assistantPrompt.trim(),
        sourceText: text,
      });
      await loadDetail(selectedId);
      if (mode === "translate") {
        setViewerMode("translated");
      }
      setMessages([mode === "translate" ? "已生成并保存当前文件的中文翻译。" : "已生成并保存讨论建议。"]);
    } catch (error) {
      setMessages([`AI 辅助失败: ${error instanceof Error ? error.message : String(error)}`]);
    } finally {
      setAssistantBusy(false);
    }
  }

  async function runJudge(scope: "baseline" | "intervention", judgeKind: JudgeKind) {
    if (!selectedId) return;
    const sourceText =
      scope === "baseline"
        ? fileContent.slice(0, 50000)
        : (runDraft?.resultText || runDraft?.sourceText || "").slice(0, 50000);
    if (!sourceText.trim()) {
      setMessages([scope === "baseline" ? "当前 baseline 文件为空。" : "当前 intervention run 还没有可评分文本。"]);
      return;
    }
    setJudgeBusy(true);
    setMessages([`正在运行 ${scope === "baseline" ? "baseline" : "intervention"} ${judgeKind} judge...`]);
    try {
      await createJudgeOutput(selectedId, {
        scope,
        judgeKind,
        runId: scope === "intervention" ? selectedRunId || null : null,
        fileKey: fileKey || null,
        prompt: judgePrompt.trim(),
        sourceText,
      });
      await loadDetail(selectedId);
      setMessages([`${scope === "baseline" ? "baseline" : "intervention"} ${judgeKind} judge 已更新。`]);
    } catch (error) {
      setMessages([`Judge 失败: ${error instanceof Error ? error.message : String(error)}`]);
    } finally {
      setJudgeBusy(false);
    }
  }

  async function onSaveRun() {
    if (!selectedId || !runDraft) return;
    const result = await saveInterventionRun(selectedId, runDraft);
    setSelectedRunId(result.run.id);
    setMessages([`已保存 intervention run: ${result.run.id}`]);
    await loadDetail(selectedId);
  }

  const selectedFiles = detail?.files ?? [];

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="panel">
          <div className="panel-header">
            <h2>Case 列表</h2>
            <button onClick={() => void onExportSummaries()}>导出总表</button>
          </div>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索 case / task / model" />
          <div className="filters">
            <select value={benchmark} onChange={(e) => setBenchmark(e.target.value as BenchmarkName | "全部")}>
              {benchmarkOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <select value={reviewStatus} onChange={(e) => setReviewStatus(e.target.value as ReviewStatus | "")}>
              <option value="">全部状态</option>
              {reviewStatuses.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <label className="checkbox">
            <input type="checkbox" checked={onlyFailed} onChange={(e) => setOnlyFailed(e.target.checked)} />
            只看低分 / 失败 case
          </label>
          <div className="case-list">
            {cases.map((item) => (
              <button
                key={item.id}
                className={`case-item ${item.id === selectedId ? "active" : ""}`}
                onClick={() => setSelectedId(item.id)}
              >
                <div className="case-title">{item.title}</div>
                <div className="case-meta">
                  <span>{item.benchmark}</span>
                  <span>{item.model ?? "-"}</span>
                </div>
                <div className="case-meta">
                  <span>{item.taskId ?? item.id}</span>
                  <span>
                    {item.numFailedTests ?? "-"} / {item.numTotalTests ?? "-"}
                  </span>
                </div>
                <div className="case-meta">
                  <span>{item.caseClass ?? "-"}</span>
                  <span>{item.primaryErrorType ?? "-"}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="panel">
          <h2>新建 Meta-case</h2>
          <input value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} placeholder="标题" />
          <input value={metaNote} onChange={(e) => setMetaNote(e.target.value)} placeholder="来源说明（可选）" />
          <textarea value={metaContent} onChange={(e) => setMetaContent(e.target.value)} rows={8} placeholder="粘贴聊天记录或原始文本" />
          <button onClick={() => void onCreateMetaCase()}>创建 Meta-case</button>
        </div>
      </aside>

      <main className="content">
        <div className="panel content-header">
          <div>
            <h2>{detail?.title ?? "未选择 case"}</h2>
            {detail ? (
              <p>
                {detail.benchmark} / {detail.model ?? "-"} / score {detail.scoreProxy ?? "-"} / failed {detail.numFailedTests ?? "-"} / total{" "}
                {detail.numTotalTests ?? "-"}
              </p>
            ) : null}
          </div>
          <div className="header-actions">
            {selectedFiles.map((file) => (
              <button
                key={file.key}
                className={file.key === fileKey ? "tab active" : "tab"}
                onClick={() => setFileKey(file.key)}
                disabled={!file.exists}
              >
                {file.label}
              </button>
            ))}
          </div>
        </div>

        <div className="panel viewer-toolbar">
          <div className="viewer-mode-group">
            <button className={viewerMode === "raw" ? "tab active" : "tab"} onClick={() => setViewerMode("raw")}>
              原始内容
            </button>
            <button className={viewerMode === "translated" ? "tab active" : "tab"} onClick={() => setViewerMode("translated")}>
              中文翻译
            </button>
          </div>
          <div className="viewer-mode-group">
            <button onClick={() => void runAssistant("translate")} disabled={assistantBusy}>
              翻译当前文件
            </button>
            <button onClick={() => void runJudge("baseline", "primary")} disabled={judgeBusy}>
              Step 1 Screen
            </button>
            <button onClick={() => void runJudge("baseline", "skeptical")} disabled={judgeBusy}>
              Step 2 Conservative
            </button>
          </div>
        </div>

        <div className={`panel viewer ${viewerMode === "translated" ? "viewer-translated" : ""}`}>
          <pre>{viewerText}</pre>
        </div>
      </main>

      <aside className="sidebar right">
        <div className="panel">
          <h2>AI 辅助</h2>
          <label>
            额外提示
            <textarea
              rows={3}
              value={assistantPrompt}
              onChange={(e) => setAssistantPrompt(e.target.value)}
              placeholder="例如：只做忠实翻译；或重点指出是否有行为锁定。"
            />
          </label>
          <div className="action-row">
            <button onClick={() => void runAssistant("translate")} disabled={assistantBusy}>
              翻译
            </button>
            <button onClick={() => void runAssistant("discuss")} disabled={assistantBusy}>
              讨论怎么判
            </button>
          </div>
        </div>

        <div className="panel">
          <h2>Baseline 标注</h2>
          <div className="grid2">
            <label>
              审核状态
              <select value={annotation.reviewStatus} onChange={(e) => setAnnotation({ ...annotation, reviewStatus: e.target.value as ReviewStatus })}>
                {reviewStatuses.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label>
              是否 NLI
              <select
                value={annotation.isNliCandidate === null ? "" : annotation.isNliCandidate ? "yes" : "no"}
                onChange={(e) =>
                  setAnnotation({
                    ...annotation,
                    isNliCandidate: e.target.value === "" ? null : e.target.value === "yes",
                  })
                }
              >
                <option value="">未定</option>
                <option value="yes">是</option>
                <option value="no">否</option>
              </select>
            </label>
            <label>
              case class
              <select
                value={annotation.caseClass ?? ""}
                onChange={(e) => setAnnotation({ ...annotation, caseClass: (e.target.value || null) as CaseClass | null })}
              >
                <option value="">未定</option>
                {caseClasses.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label>
              主错误类型
              <select
                value={annotation.primaryErrorType ?? ""}
                onChange={(e) => setAnnotation({ ...annotation, primaryErrorType: (e.target.value || null) as PrimaryErrorType | null })}
              >
                <option value="">未定</option>
                {primaryErrorTypes.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label>
              系统/agent
              <select
                value={annotation.systemVsAgent ?? ""}
                onChange={(e) => setAnnotation({ ...annotation, systemVsAgent: (e.target.value || null) as SystemAgentClass | null })}
              >
                <option value="">未定</option>
                {systemAgentOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label>
              可解性
              <select
                value={annotation.solvability ?? ""}
                onChange={(e) => setAnnotation({ ...annotation, solvability: (e.target.value || null) as Solvability | null })}
              >
                <option value="">未定</option>
                {solvabilityOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label>
              主 narrative 类型
              <select
                value={annotation.primaryType ?? ""}
                onChange={(e) => setAnnotation({ ...annotation, primaryType: (e.target.value || null) as PrimaryType | null })}
              >
                <option value="">未定</option>
                {primaryTypes.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label>
              强度
              <select value={annotation.overallStrength} onChange={(e) => setAnnotation({ ...annotation, overallStrength: e.target.value })}>
                {strengths.map((item) => (
                  <option key={item || "empty"} value={item}>
                    {item || "未定"}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <h3>Rubric</h3>
          {Object.entries(rubricLabels).map(([key, label]) => (
            <label key={key} className="rubric-row">
              <span>{label}</span>
              <select
                value={annotation.rubric[key as RubricKey]}
                onChange={(e) =>
                  setAnnotation({
                    ...annotation,
                    rubric: { ...annotation.rubric, [key]: Number(e.target.value) },
                  })
                }
              >
                {[0, 1, 2, 3].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          ))}

          <label>
            Reviewer Notes
            <textarea rows={6} value={annotation.reviewerNotes} onChange={(e) => setAnnotation({ ...annotation, reviewerNotes: e.target.value })} />
          </label>
          <div className="action-row">
            <button onClick={() => void onSave()}>保存标注</button>
            <button onClick={() => void onExport()}>导出本 case</button>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2>Judge 输出</h2>
            <button onClick={() => setShowEvidence((prev) => !prev)}>{showEvidence ? "收起证据" : "展开证据"}</button>
          </div>
          <label>
            Judge 额外提示
            <textarea rows={3} value={judgePrompt} onChange={(e) => setJudgePrompt(e.target.value)} placeholder="例如：严格区分口头承认与真实行动更新。" />
          </label>
          <div className="judge-block">
            <h3>Baseline Step 1</h3>
            <pre>{renderJudgeJson(baselinePrimaryJudge)}</pre>
          </div>
          <div className="judge-block">
            <h3>Baseline Step 2</h3>
            <pre>{renderJudgeJson(baselineSkepticalJudge)}</pre>
          </div>
          {showEvidence ? (
            <div className="evidence-list">
              {sortedEvidence.map((evidence) => {
                const index = annotation.evidence.findIndex((item) => item.id === evidence.id);
                return (
                  <div key={evidence.id} className="evidence-card">
                    <label>
                      维度
                      <select value={evidence.dimension} onChange={(event) => updateEvidence(index, { dimension: event.target.value as RubricKey })}>
                        {Object.entries(rubricLabels).map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="grid2">
                      <label>
                        起始行
                        <input
                          value={evidence.lineStart ?? ""}
                          onChange={(event) => updateEvidence(index, { lineStart: event.target.value ? Number(event.target.value) : null })}
                        />
                      </label>
                      <label>
                        结束行
                        <input
                          value={evidence.lineEnd ?? ""}
                          onChange={(event) => updateEvidence(index, { lineEnd: event.target.value ? Number(event.target.value) : null })}
                        />
                      </label>
                    </div>
                    <label>
                      引文
                      <textarea rows={3} value={evidence.quote} onChange={(event) => updateEvidence(index, { quote: event.target.value })} />
                    </label>
                    <label>
                      解读
                      <textarea rows={3} value={evidence.interpretation} onChange={(event) => updateEvidence(index, { interpretation: event.target.value })} />
                    </label>
                  </div>
                );
              })}
              <button onClick={addEvidence}>新增证据</button>
            </div>
          ) : null}
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2>Intervention Runs</h2>
            <button onClick={() => detail && setRunDraft(defaultRun(detail.id))}>新建 run</button>
          </div>
          <div className="run-list">
            {(detail?.interventions ?? []).map((item) => (
              <button key={item.id} className={`case-item ${item.id === selectedRunId ? "active" : ""}`} onClick={() => setSelectedRunId(item.id)}>
                <div className="case-title">{item.title || item.type}</div>
                <div className="case-meta">
                  <span>{item.type}</span>
                  <span>{item.status}</span>
                </div>
              </button>
            ))}
          </div>

          {runDraft ? (
            <>
              <div className="grid2">
                <label>
                  类型
                  <select value={runDraft.type} onChange={(e) => setRunDraft({ ...runDraft, type: e.target.value as InterventionType })}>
                    {interventionTypes.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  状态
                  <input value={runDraft.status} onChange={(e) => setRunDraft({ ...runDraft, status: e.target.value })} />
                </label>
              </div>
              <label>
                标题
                <input value={runDraft.title} onChange={(e) => setRunDraft({ ...runDraft, title: e.target.value })} />
              </label>
              <label>
                Intervention Instruction / Prompt
                <textarea rows={4} value={runDraft.instruction} onChange={(e) => setRunDraft({ ...runDraft, instruction: e.target.value })} />
              </label>
              <label>
                Source Text / Before
                <textarea rows={4} value={runDraft.sourceText} onChange={(e) => setRunDraft({ ...runDraft, sourceText: e.target.value })} />
              </label>
              <label>
                Result Text / After
                <textarea rows={6} value={runDraft.resultText} onChange={(e) => setRunDraft({ ...runDraft, resultText: e.target.value })} />
              </label>
              <label>
                Notes
                <textarea rows={3} value={runDraft.notes} onChange={(e) => setRunDraft({ ...runDraft, notes: e.target.value })} />
              </label>
              <div className="action-row">
                <button onClick={() => void onSaveRun()}>保存 run</button>
                <button onClick={() => void runJudge("intervention", "primary")} disabled={judgeBusy}>
                  Run Step 1 Screen
                </button>
              </div>
              <div className="action-row">
                <button onClick={() => void runJudge("intervention", "skeptical")} disabled={judgeBusy}>
                  Run Step 2 Conservative
                </button>
                <button onClick={() => setRunDraft({ ...runDraft, sourceText: fileContent.slice(0, 30000) })}>载入当前文件到 Before</button>
              </div>
              <div className="judge-block">
                <h3>Intervention Step 1</h3>
                <pre>{renderJudgeJson(runPrimaryJudge)}</pre>
              </div>
              <div className="judge-block">
                <h3>Intervention Step 2</h3>
                <pre>{renderJudgeJson(runSkepticalJudge)}</pre>
              </div>
            </>
          ) : null}
          {messages.length > 0 && (
            <div className="messages">
              {messages.map((message) => (
                <div key={message}>{message}</div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

export default App;
