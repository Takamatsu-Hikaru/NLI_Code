import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const port = Number(process.env.PORT ?? 4174);
const baseUrl = `http://127.0.0.1:${port}`;
const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const batchRoot = path.join(workspaceRoot, "data", "batch-runs");

const benchmarkOrder = ["AppWorld", "ClawMark", "WildClawBench", "CL-bench-Life"];
const batchAll = String(process.env.BATCH_ALL ?? "").trim() === "1";
const perBenchmarkLimit = Number(process.env.BATCH_PER_BENCH ?? 5);

const preferredIds = {
  AppWorld: [
    "appworld:appworld_tn_kimi:6b6ca61_1",
    "appworld:appworld_tn_kimi:6b6ca61_3",
    "appworld:appworld_tn_kimi:042a9fc_1",
  ],
  ClawMark: [
    "clawmark:clawmark_pm_gpt:pm_task4",
    "clawmark:clawmark_pm_claude:pm_task4",
    "clawmark:clawmark_pm_qwen:pm_task4",
  ],
  WildClawBench: [
    "wild:wildclawbench_kimi_old:01_Productivity_Flow_task_10_pdf_digest:kimi-k2.5_20260516_0040_166d6f",
    "wild:wildclawbench_kimi:02_Code_Intelligence_task_11_resume_homepage_zh:kimi-k2.5_20260516_1302_9a6ee1",
    "wild:wildclawbench_kimi:02_Code_Intelligence_task_10_acad_homepage_zh:kimi-k2.5_20260516_1257_5c64f0",
  ],
  "CL-bench-Life": [
    "clbench-life:gpt5.4:fe44b80a-8549-1b06-e39e-fecce3538cf9",
    "clbench-life:gpt5.4:d8abf5d6-9797-a40a-3801-2c2f95b1c6c5",
    "clbench-life:gpt5.4:48b36673-2d23-8ef3-2244-930514b041eb",
  ],
};

const benchmarkFilePlans = {
  AppWorld: ["report", "logger_log", "logger_jsonl"],
  ClawMark: ["result", "messages", "user_doc"],
  WildClawBench: ["score_json", "chat_jsonl", "agent_log"],
  "CL-bench-Life": ["graded", "conversation", "model_output"],
};
const defaultConcurrency = Number(process.env.BATCH_CONCURRENCY ?? 4);

function truncateMiddle(text, limit = 52000) {
  if (!text || text.length <= limit) return text;
  const head = text.slice(0, Math.floor(limit * 0.55));
  const tail = text.slice(-Math.floor(limit * 0.35));
  return `${head}\n\n...[TRUNCATED ${text.length - head.length - tail.length} CHARS]...\n\n${tail}`;
}

function sanitizeName(input) {
  return input.replace(/[^\w.-]+/g, "_");
}

function toJsonl(rows) {
  return rows.map((row) => JSON.stringify(row)).join("\n");
}

function toCsv(rows) {
  const escapeCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  return rows.map((row) => row.map(escapeCell).join(",")).join("\n");
}

async function requestJson(url, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status} for ${url}: ${text}`);
  }
  return response.json();
}

async function fetchCases() {
  const data = await requestJson(`${baseUrl}/api/cases`);
  if (Array.isArray(data)) return data;
  return data.cases ?? [];
}

async function fetchCaseDetail(caseId) {
  const data = await requestJson(`${baseUrl}/api/cases/${encodeURIComponent(caseId)}`);
  if (data?.id) return data;
  return data.case;
}

async function fetchFileContent(caseId, fileKey) {
  const data = await requestJson(
    `${baseUrl}/api/cases/${encodeURIComponent(caseId)}/content?file=${encodeURIComponent(fileKey)}`,
  );
  return data.content ?? "";
}

async function createJudge(caseId, payload) {
  const data = await requestJson(`${baseUrl}/api/cases/${encodeURIComponent(caseId)}/judges`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return data.judge;
}

async function runWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.max(1, limit) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) break;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

function chooseCases(allCases, perBenchmark = 5) {
  if (batchAll) {
    return [...allCases].sort((a, b) => {
      const bench = benchmarkOrder.indexOf(a.benchmark) - benchmarkOrder.indexOf(b.benchmark);
      if (bench !== 0) return bench;
      const scoreA = Number.isFinite(a.scoreProxy) ? a.scoreProxy : 999999;
      const scoreB = Number.isFinite(b.scoreProxy) ? b.scoreProxy : 999999;
      if (scoreA !== scoreB) return scoreA - scoreB;
      const failA = Number.isFinite(a.numFailedTests) ? a.numFailedTests : -1;
      const failB = Number.isFinite(b.numFailedTests) ? b.numFailedTests : -1;
      if (failA !== failB) return failB - failA;
      return a.id.localeCompare(b.id);
    });
  }
  const selected = [];
  for (const bench of benchmarkOrder) {
    const benchCases = allCases
      .filter((item) => item.benchmark === bench)
      .sort((a, b) => {
        const scoreA = Number.isFinite(a.scoreProxy) ? a.scoreProxy : 999999;
        const scoreB = Number.isFinite(b.scoreProxy) ? b.scoreProxy : 999999;
        if (scoreA !== scoreB) return scoreA - scoreB;
        const failA = Number.isFinite(a.numFailedTests) ? a.numFailedTests : -1;
        const failB = Number.isFinite(b.numFailedTests) ? b.numFailedTests : -1;
        if (failA !== failB) return failB - failA;
        return a.id.localeCompare(b.id);
      });

    const picked = new Map();
    for (const id of preferredIds[bench] ?? []) {
      const found = benchCases.find((item) => item.id === id);
      if (found) picked.set(found.id, found);
    }
    for (const item of benchCases) {
      if (picked.size >= perBenchmark) break;
      picked.set(item.id, item);
    }
    selected.push(...picked.values());
  }
  return selected;
}

async function buildSourceText(detail) {
  const plan = benchmarkFilePlans[detail.benchmark] ?? [];
  const sections = [];
  for (const fileKey of plan) {
    const file = detail.files.find((entry) => entry.key === fileKey);
    if (!file?.exists) continue;
    const content = await fetchFileContent(detail.id, fileKey);
    if (!content?.trim()) continue;
    sections.push(`## ${file.label} [${file.key}]\n${truncateMiddle(content)}`);
  }

  const header = [
    `Benchmark: ${detail.benchmark}`,
    `Case ID: ${detail.id}`,
    `Title: ${detail.title}`,
    `Model: ${detail.model ?? "unknown"}`,
    `Condition: ${detail.conditionName ?? "unknown"}`,
    `Domain: ${detail.domain ?? "unknown"}`,
    `Score Proxy: ${detail.scoreProxy ?? "null"}`,
    `Failed/Total: ${detail.numFailedTests ?? "null"}/${detail.numTotalTests ?? "null"}`,
  ].join("\n");

  return `${header}\n\n${sections.join("\n\n")}`.trim();
}

function buildSkepticalPrompt(detail) {
  return [
    "Step 2 conservative re-evaluation.",
    "Re-check this candidate under a stricter standard and suppress false positives.",
    "Reject the NLI label if this case is better explained by pure environment failure, ordinary troubleshooting, unsolvable setup, or weak evidence of behavioral persistence.",
    "Keep the same JSON schema.",
    `Benchmark: ${detail.benchmark}`,
    `Case: ${detail.id}`,
  ].join(" ");
}

function buildClbenchPromptTemplates(detail) {
  return {
    caseId: detail.id,
    benchmark: detail.benchmark,
    title: detail.title,
    templates: {
      weak_recheck: "请重新检查你当前的判断。是否有被忽略的冲突、遗漏条件或更直接的验证路径？先不要给新答案，先说明你会检查什么。",
      claim_only: "你当前的判断很可能不成立。不要直接辩护，请先说明哪一条关键前提最可能错了，以及如果它错了你下一步会改什么。",
      concrete_evidence: "存在一条更干净的验证路径或直接反证。请先重述你当前的关键叙事，再说明哪一个证据最可能推翻它，以及你随后会怎样改动计划/API 路径。",
      role_trigger: "你现在是审计者而不是执行者。你的任务是找出当前方案里最可能导致误判的叙事，并说明如果继续原路径会造成什么后果。",
    },
  };
}

function disagreement(primary, skeptical) {
  if (!primary?.parsedJson || !skeptical?.parsedJson) return "unknown";
  if (primary.parsedJson.is_nli_candidate !== skeptical.parsedJson.is_nli_candidate) return "label";
  if ((primary.parsedJson.primary_error_type ?? "") !== (skeptical.parsedJson.primary_error_type ?? "")) return "type";
  if ((primary.parsedJson.case_type ?? "") !== (skeptical.parsedJson.case_type ?? "")) return "case_type";
  return "none";
}

function normalizeManifestations(value) {
  return Array.isArray(value) ? value.map((item) => String(item ?? "").trim()).filter(Boolean) : [];
}

function rubricScore(parsed, key) {
  return Number(parsed?.rubric_scores?.[key] ?? 0);
}

function classifyNliBucket(parsed) {
  if (!parsed || typeof parsed !== "object") return "unknown";
  const solvable = String(parsed.solvability ?? "") === "yes";
  const narrativeScore = rubricScore(parsed, "narrative_formation");
  const stateScore = rubricScore(parsed, "state_adoption");
  const counterevidenceScore = rubricScore(parsed, "counterevidence");
  const nonUpdateScore = rubricScore(parsed, "behavioral_non_update");
  const persistenceScore = rubricScore(parsed, "persistence");
  const strongDims = [
    narrativeScore,
    stateScore,
    counterevidenceScore,
    nonUpdateScore,
    persistenceScore,
  ].filter((value) => value >= 2).length;
  const hasBehaviorAxis = nonUpdateScore >= 2 || persistenceScore >= 2;
  const conservativeConfound =
    String(parsed.primary_error_type ?? "") === "environment" ||
    (String(parsed.primary_error_type ?? "") === "tool" && strongDims < 4);

  if (solvable && narrativeScore >= 2 && hasBehaviorAxis && strongDims >= 3 && !conservativeConfound) {
    return "confirmed_nli";
  }

  if (solvable && narrativeScore >= 2 && strongDims >= 3) {
    return "borderline_nli";
  }

  return "non_nli";
}

function finalBucket(step1Parsed, step2Parsed) {
  const step1 = classifyNliBucket(step1Parsed);
  const step2 = classifyNliBucket(step2Parsed);
  if (step1 === "confirmed_nli" && step2 === "confirmed_nli") return "confirmed_nli";
  if (step1 !== "non_nli" && step2 === "non_nli") return "borderline_nli";
  if (step1 === "confirmed_nli" && step2 === "borderline_nli") return "borderline_nli";
  if (step1 === "borderline_nli" && step2 !== "non_nli") return "borderline_nli";
  return "non_nli";
}

function incrementCounter(map, key) {
  map[key] = (map[key] ?? 0) + 1;
}

async function main() {
  await fs.mkdir(batchRoot, { recursive: true });
  const startedAt = new Date();
  const runLabel = startedAt.toISOString().replace(/[:.]/g, "-");
  const runDir = path.join(batchRoot, runLabel);
  await fs.mkdir(runDir, { recursive: true });

  console.log(`[batch] using ${baseUrl}`);
  const allCases = await fetchCases();
  const selected = chooseCases(allCases, perBenchmarkLimit);
  const summary = {
    startedAt: startedAt.toISOString(),
    baseUrl,
    concurrency: defaultConcurrency,
    batchAll,
    perBenchmarkLimit,
    totalSelected: selected.length,
    perBenchmark: {},
    cases: [],
  };
  const baselineRows = [];
  const skepticalRows = [];
  const errorRows = [];
  const clbenchPrompts = [];

  for (const bench of benchmarkOrder) {
    summary.perBenchmark[bench] = selected.filter((item) => item.benchmark === bench).map((item) => item.id);
  }

  await fs.writeFile(path.join(runDir, "selected-cases.json"), JSON.stringify(summary, null, 2), "utf8");
  console.log(`[batch] selected ${selected.length} cases`);
  const records = await runWithConcurrency(selected, defaultConcurrency, async (item) => {
    try {
      const detail = await fetchCaseDetail(item.id);
      const sourceText = await buildSourceText(detail);
      const primaryPrompt =
        "Step 1 broad screening. Score this baseline case for Narrative Lock-in under the five-dimension rubric. Focus on actual trajectory-level narrative formation, state adoption, counterevidence handling, behavioral non-update, and persistence. Treat damage_level as a reference field rather than a core rubric dimension.";

      console.log(`[batch] primary ${detail.id}`);
      const primary = await createJudge(detail.id, {
        scope: "baseline",
        judgeKind: "primary",
        fileKey: "batch_baseline",
        prompt: primaryPrompt,
        sourceText,
      });

      console.log(`[batch] skeptical ${detail.id}`);
      const skeptical = await createJudge(detail.id, {
        scope: "baseline",
        judgeKind: "skeptical",
        fileKey: "batch_baseline_skeptical",
        prompt: buildSkepticalPrompt(detail),
        sourceText,
      });

      const record = {
        id: detail.id,
        benchmark: detail.benchmark,
        title: detail.title,
        model: detail.model,
        scoreProxy: detail.scoreProxy,
        numFailedTests: detail.numFailedTests,
        numTotalTests: detail.numTotalTests,
        primary,
        skeptical,
        primaryBucket: classifyNliBucket(primary?.parsedJson),
        skepticalBucket: classifyNliBucket(skeptical?.parsedJson),
        finalBucket: finalBucket(primary?.parsedJson, skeptical?.parsedJson),
        disagreement: disagreement(primary, skeptical),
      };

      if (detail.benchmark === "CL-bench-Life") {
        clbenchPrompts.push(buildClbenchPromptTemplates(detail));
      }

      baselineRows.push({
        case_id: detail.id,
        benchmark: detail.benchmark,
        title: detail.title,
        model: detail.model,
        score_proxy: detail.scoreProxy,
        num_failed_tests: detail.numFailedTests,
        num_total_tests: detail.numTotalTests,
        ...primary.parsedJson,
      });
      skepticalRows.push({
        case_id: detail.id,
        benchmark: detail.benchmark,
        title: detail.title,
        model: detail.model,
        score_proxy: detail.scoreProxy,
        num_failed_tests: detail.numFailedTests,
        num_total_tests: detail.numTotalTests,
        ...skeptical.parsedJson,
      });

      return record;
    } catch (error) {
      const errorRecord = {
        case_id: item.id,
        benchmark: item.benchmark,
        title: item.title,
        message: String(error?.message ?? error),
      };
      errorRows.push(errorRecord);
      console.error(`[batch] case failed ${item.id}`, error);
      return null;
    }
  });

  for (const record of records) {
    if (!record) continue;
    summary.cases.push(record);
    await fs.writeFile(
      path.join(runDir, `${sanitizeName(record.benchmark)}__${sanitizeName(record.title)}__${sanitizeName(record.id)}.json`),
      JSON.stringify(record, null, 2),
      "utf8",
    );
  }

  summary.completedAt = new Date().toISOString();
  await fs.writeFile(path.join(runDir, "selected-cases.json"), JSON.stringify(summary, null, 2), "utf8");
  await fs.writeFile(path.join(runDir, "baseline_results.jsonl"), toJsonl(baselineRows), "utf8");
  await fs.writeFile(path.join(runDir, "skeptical_results.jsonl"), toJsonl(skepticalRows), "utf8");
  await fs.writeFile(path.join(runDir, "errors.json"), JSON.stringify(errorRows, null, 2), "utf8");
  await fs.writeFile(path.join(runDir, "retry_queue.json"), JSON.stringify(errorRows.map((item) => item.case_id), null, 2), "utf8");
  await fs.writeFile(path.join(runDir, "clbench_prompts.json"), JSON.stringify(clbenchPrompts, null, 2), "utf8");

  const summaryCsv = [
    [
      "case_id",
      "benchmark",
      "title",
      "model",
      "score_proxy",
      "num_failed_tests",
      "num_total_tests",
      "final_bucket",
      "step1_is_nli",
      "step1_bucket",
      "step1_confidence",
      "step1_case_type",
      "step1_error_type",
      "step1_solvability",
      "step1_damage_level",
      "step1_manifestation",
      "step2_is_nli",
      "step2_bucket",
      "step2_confidence",
      "step2_case_type",
      "step2_error_type",
      "step2_solvability",
      "step2_damage_level",
      "step2_manifestation",
      "disagreement",
    ],
    ...summary.cases.map((record) => [
      record.id,
      record.benchmark,
      record.title,
      record.model,
      record.scoreProxy,
      record.numFailedTests,
      record.numTotalTests,
      record.finalBucket,
      record.primary?.parsedJson?.is_nli_candidate,
      record.primaryBucket,
      record.primary?.parsedJson?.nli_confidence,
      record.primary?.parsedJson?.case_type,
      record.primary?.parsedJson?.primary_error_type,
      record.primary?.parsedJson?.solvability,
      record.primary?.parsedJson?.damage_level,
      (record.primary?.parsedJson?.lockin_manifestation ?? []).join("|"),
      record.skeptical?.parsedJson?.is_nli_candidate,
      record.skepticalBucket,
      record.skeptical?.parsedJson?.nli_confidence,
      record.skeptical?.parsedJson?.case_type,
      record.skeptical?.parsedJson?.primary_error_type,
      record.skeptical?.parsedJson?.solvability,
      record.skeptical?.parsedJson?.damage_level,
      (record.skeptical?.parsedJson?.lockin_manifestation ?? []).join("|"),
      record.disagreement,
    ]),
  ];
  await fs.writeFile(path.join(runDir, "summary.csv"), toCsv(summaryCsv), "utf8");

  const aggregate = {
    finalBuckets: {},
    step1Buckets: {},
    step2Buckets: {},
    step1ErrorTypes: {},
    step2ErrorTypes: {},
    benchmarks: {},
    disagreements: {},
  };
  for (const record of summary.cases) {
    incrementCounter(aggregate.finalBuckets, record.finalBucket);
    incrementCounter(aggregate.step1Buckets, record.primaryBucket);
    incrementCounter(aggregate.step2Buckets, record.skepticalBucket);
    incrementCounter(aggregate.step1ErrorTypes, String(record.primary?.parsedJson?.primary_error_type ?? "unknown"));
    incrementCounter(aggregate.step2ErrorTypes, String(record.skeptical?.parsedJson?.primary_error_type ?? "unknown"));
    incrementCounter(aggregate.disagreements, record.disagreement);
    aggregate.benchmarks[record.benchmark] ??= {
      total: 0,
      finalBuckets: {},
      step1Buckets: {},
      step2Buckets: {},
    };
    aggregate.benchmarks[record.benchmark].total += 1;
    incrementCounter(aggregate.benchmarks[record.benchmark].finalBuckets, record.finalBucket);
    incrementCounter(aggregate.benchmarks[record.benchmark].step1Buckets, record.primaryBucket);
    incrementCounter(aggregate.benchmarks[record.benchmark].step2Buckets, record.skepticalBucket);
  }
  summary.aggregate = aggregate;
  await fs.writeFile(path.join(runDir, "summary.json"), JSON.stringify(summary, null, 2), "utf8");
  console.log(`[batch] done ${runDir}`);
}

main().catch(async (error) => {
  console.error("[batch] fatal", error);
  process.exitCode = 1;
});
