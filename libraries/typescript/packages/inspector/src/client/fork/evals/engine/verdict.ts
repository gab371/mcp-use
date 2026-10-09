import type { EvalCase, EvalSuite } from "./suite";
import type { CheckResult, Transcript } from "./checks";
import { evaluateAllChecks } from "./checks";

export type IterationStatus = "passed" | "failed" | "inconclusive";

export interface IterationResult {
  iterationIndex: number;
  status: IterationStatus;
  transcript: Transcript;
  checkResults: CheckResult[];
  failedChecks: CheckResult[];
  error?: string;
}

export type CaseVerdictStatus = "passed" | "failed" | "inconclusive";

export interface CasePerformance {
  totalDurationMs: number;
  avgDurationMs: number;
  totalToolCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
}

export interface CaseVerdict {
  caseId: string;
  description?: string;
  status: CaseVerdictStatus;
  isFlaky: boolean;
  passRate: number;
  passedIterations: number;
  failedIterations: number;
  inconclusiveIterations: number;
  totalIterations: number;
  iterations: IterationResult[];
  performance: CasePerformance;
}

export type RunVerdictStatus = "passed" | "failed" | "inconclusive";

export interface RunPerformance {
  totalDurationMs: number;
  totalToolCalls: number;
  totalTokens: number;
}

export interface RunSummary {
  id: string;
  suiteName: string;
  status: RunVerdictStatus;
  startedAt: number;
  completedAt: number;
  model: string;
  provider: string;
  toolsSnapshotHash?: string;
  totalCases: number;
  passedCases: number;
  failedCases: number;
  inconclusiveCases: number;
  flakyCases: number;
  performance: RunPerformance;
}

export interface RunResult extends RunSummary {
  caseResults: CaseVerdict[];
  toolsSnapshot?: Array<{
    name: string;
    description?: string;
    inputSchema?: Record<string, unknown>;
  }>;
}

/**
 * Evaluates a single iteration transcript against the case checks.
 */
export function evaluateIteration(
  iterationIndex: number,
  caseDef: EvalCase,
  transcript: Transcript
): IterationResult {
  if (transcript.isInconclusive || transcript.error) {
    return {
      iterationIndex,
      status: "inconclusive",
      transcript,
      checkResults: [],
      failedChecks: [],
      error: transcript.error || "Inconclusive execution",
    };
  }

  const { passed, results, failedChecks } = evaluateAllChecks(caseDef.expect, transcript);

  return {
    iterationIndex,
    status: passed ? "passed" : "failed",
    transcript,
    checkResults: results,
    failedChecks,
  };
}

/**
 * Computes the verdict for a case across its iteration results.
 */
export function computeCaseVerdict(
  caseDef: EvalCase,
  iterations: IterationResult[],
  suiteDefaults?: EvalSuite["defaults"]
): CaseVerdict {
  const threshold =
    caseDef.passThreshold ?? suiteDefaults?.passThreshold ?? 1.0;

  let passedIterations = 0;
  let failedIterations = 0;
  let inconclusiveIterations = 0;
  let totalDurationMs = 0;
  let totalToolCalls = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (const iter of iterations) {
    if (iter.status === "passed") passedIterations++;
    else if (iter.status === "failed") failedIterations++;
    else if (iter.status === "inconclusive") inconclusiveIterations++;

    totalDurationMs += iter.transcript.durationMs ?? 0;
    totalToolCalls += iter.transcript.toolCalls.length;
    totalInputTokens += iter.transcript.usage?.inputTokens ?? 0;
    totalOutputTokens += iter.transcript.usage?.outputTokens ?? 0;
  }

  const validCount = passedIterations + failedIterations;
  const passRate = validCount > 0 ? Number((passedIterations / validCount).toFixed(3)) : 0;
  const isFlaky = passedIterations > 0 && failedIterations > 0;

  let status: CaseVerdictStatus;
  if (validCount === 0) {
    status = "inconclusive";
  } else if (passRate >= threshold || Math.abs(passRate - threshold) < 0.005) {
    status = "passed";
  } else {
    status = "failed";
  }

  return {
    caseId: caseDef.id,
    description: caseDef.description,
    status,
    isFlaky,
    passRate: Number(passRate.toFixed(3)),
    passedIterations,
    failedIterations,
    inconclusiveIterations,
    totalIterations: iterations.length,
    iterations,
    performance: {
      totalDurationMs,
      avgDurationMs: iterations.length > 0 ? Math.round(totalDurationMs / iterations.length) : 0,
      totalToolCalls,
      totalInputTokens,
      totalOutputTokens,
    },
  };
}

/**
 * Computes the run verdict and summary across all case results.
 */
export function computeRunResult(params: {
  runId: string;
  suiteName: string;
  caseResults: CaseVerdict[];
  startedAt: number;
  completedAt: number;
  model: string;
  provider: string;
  toolsSnapshot?: Array<{
    name: string;
    description?: string;
    inputSchema?: Record<string, unknown>;
  }>;
  toolsSnapshotHash?: string;
}): RunResult {
  const {
    runId,
    suiteName,
    caseResults,
    startedAt,
    completedAt,
    model,
    provider,
    toolsSnapshot,
    toolsSnapshotHash,
  } = params;

  let passedCases = 0;
  let failedCases = 0;
  let inconclusiveCases = 0;
  let flakyCases = 0;
  let totalDurationMs = 0;
  let totalToolCalls = 0;
  let totalTokens = 0;

  for (const c of caseResults) {
    if (c.status === "passed") passedCases++;
    else if (c.status === "failed") failedCases++;
    else if (c.status === "inconclusive") inconclusiveCases++;

    if (c.isFlaky) flakyCases++;

    totalDurationMs += c.performance.totalDurationMs;
    totalToolCalls += c.performance.totalToolCalls;
    totalTokens += c.performance.totalInputTokens + c.performance.totalOutputTokens;
  }

  let status: RunVerdictStatus;
  if (failedCases > 0) {
    status = "failed";
  } else if (inconclusiveCases === caseResults.length && caseResults.length > 0) {
    status = "inconclusive";
  } else {
    status = "passed";
  }

  return {
    id: runId,
    suiteName,
    status,
    startedAt,
    completedAt,
    model,
    provider,
    toolsSnapshotHash,
    totalCases: caseResults.length,
    passedCases,
    failedCases,
    inconclusiveCases,
    flakyCases,
    performance: {
      totalDurationMs,
      totalToolCalls,
      totalTokens,
    },
    caseResults,
    toolsSnapshot,
  };
}
