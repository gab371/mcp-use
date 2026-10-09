import React, { useState, useEffect, useRef } from "react";
import type { McpServer } from "@mcp-use/client/react";
import type { LLMConfig } from "@/client/components/chat/types";
import { parseSuiteYaml, type EvalSuite } from "../engine/suite";
import { runCase } from "../engine/run-case";
import {
  evaluateIteration,
  computeCaseVerdict,
  computeRunResult,
  type CaseVerdict,
  type IterationResult,
  type RunResult,
} from "../engine/verdict";
import { hashToolsSnapshot } from "../engine/snapshot";
import { TranscriptView } from "./TranscriptView";

interface EvalsRunViewProps {
  connection?: McpServer;
  llmConfig?: LLMConfig | null;
  onNavigateToHistory?: () => void;
  onNavigateToEditor?: () => void;
}

export function EvalsRunView({
  connection,
  llmConfig,
  onNavigateToHistory,
  onNavigateToEditor,
}: EvalsRunViewProps) {
  const [suites, setSuites] = useState<Array<{ id: string; name: string; yaml: string }>>([]);
  const [selectedSuiteId, setSelectedSuiteId] = useState<string>("");
  const [currentSuite, setCurrentSuite] = useState<EvalSuite | null>(null);
  const [goldenFiles, setGoldenFiles] = useState<Record<string, string>>({});

  // Execution states
  const [isRunning, setIsRunning] = useState(false);
  const [currentRunningCaseId, setCurrentRunningCaseId] = useState<string | null>(null);
  const [currentIterationIndex, setCurrentIterationIndex] = useState<number>(0);
  const [caseResults, setCaseResults] = useState<CaseVerdict[]>([]);
  const [completedRun, setCompletedRun] = useState<RunResult | null>(null);
  const [activeExpandedCaseId, setActiveExpandedCaseId] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const loadSuiteDetails = async (suiteId: string) => {
    try {
      const res = await fetch(`/inspector/api/fork/evals/suites/${encodeURIComponent(suiteId)}`);
      if (res.ok) {
        const detail = await res.json();
        setGoldenFiles(detail.goldenFiles || {});
        if (detail.yaml) {
          const parsed = parseSuiteYaml(detail.yaml);
          if (parsed.success && parsed.suite) {
            setCurrentSuite(parsed.suite);
          }
        }
      }
    } catch (e) {
      console.warn("Failed to load suite detail:", e);
    }
  };

  // Load available suites from server
  useEffect(() => {
    fetch("/inspector/api/fork/evals/suites")
      .then((res) => res.json())
      .then((data) => {
        if (data.suites?.length > 0) {
          setSuites(data.suites);
          const firstId = data.suites[0].id;
          setSelectedSuiteId(firstId);
          loadSuiteDetails(firstId);
        }
      })
      .catch((e) => console.warn("Failed to load suites:", e));
  }, []);

  const handleSuiteChange = (suiteId: string) => {
    setSelectedSuiteId(suiteId);
    loadSuiteDetails(suiteId);
  };

  const handleStartRun = async () => {
    if (!currentSuite) return;
    if (!connection) {
      setRunError("Please connect to an MCP server first.");
      return;
    }
    if (!llmConfig || !llmConfig.provider || !llmConfig.model) {
      setRunError("Please configure LLM provider settings in the Chat tab first.");
      return;
    }

    setIsRunning(true);
    setRunError(null);
    setCompletedRun(null);
    setCaseResults([]);
    setCurrentRunningCaseId(null);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const startedAt = Date.now();
    const evaluatedCases: CaseVerdict[] = [];

    // Tools snapshot
    const toolsSnapshot = connection.tools ? [...connection.tools] : [];
    const snapshotHash = hashToolsSnapshot(toolsSnapshot);

    try {
      for (const caseDef of currentSuite.cases) {
        if (abortController.signal.aborted) break;

        setCurrentRunningCaseId(caseDef.id);
        const iterationsCount =
          caseDef.iterations ?? currentSuite.defaults?.iterations ?? 1;
        const iterations: IterationResult[] = [];

        for (let iter = 0; iter < iterationsCount; iter++) {
          if (abortController.signal.aborted) break;
          setCurrentIterationIndex(iter + 1);

          const transcript = await runCase(
            caseDef,
            connection,
            {
              provider: llmConfig.provider,
              model: llmConfig.model,
              apiKey: llmConfig.apiKey,
              baseUrl: llmConfig.baseUrl,
              credentials: llmConfig.credentials,
              temperature: llmConfig.temperature,
            },
            currentSuite.defaults,
            {
              signal: abortController.signal,
              runId,
              resolvedGolden: goldenFiles,
            }
          );

          const iterResult = evaluateIteration(iter, caseDef, transcript, goldenFiles);
          iterations.push(iterResult);
        }

        const caseVerdict = computeCaseVerdict(caseDef, iterations, currentSuite.defaults);
        evaluatedCases.push(caseVerdict);
        setCaseResults([...evaluatedCases]);
      }

      if (!abortController.signal.aborted) {
        const completedAt = Date.now();
        const runResult = computeRunResult({
          runId,
          suiteName: currentSuite.name,
          caseResults: evaluatedCases,
          startedAt,
          completedAt,
          model: llmConfig.model,
          provider: llmConfig.provider,
          toolsSnapshot,
          toolsSnapshotHash: snapshotHash,
        });

        setCompletedRun(runResult);

        // Save run to server
        fetch("/inspector/api/fork/evals/runs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(runResult),
        }).catch((e) => console.warn("Failed to persist run on server:", e));
      }
    } catch (e: unknown) {
      setRunError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsRunning(false);
      setCurrentRunningCaseId(null);
    }
  };

  const handleStopRun = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsRunning(false);
      setCurrentRunningCaseId(null);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4 p-4 overflow-y-auto">
      {/* Top Configuration & Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/80 bg-background/95 p-3.5 backdrop-blur">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Suite:</label>
            <select
              disabled={isRunning}
              value={selectedSuiteId}
              onChange={(e) => handleSuiteChange(e.target.value)}
              className="rounded border border-input bg-background px-3 py-1.5 text-xs focus:ring-1 focus:ring-ring"
            >
              {suites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.id})
                </option>
              ))}
            </select>
          </div>

          <div className="text-xs text-muted-foreground border-l border-border/60 pl-3 flex items-center gap-2">
            <div>
              <span>Model: </span>
              <span className="font-semibold text-foreground">
                {llmConfig?.provider || "none"}:{llmConfig?.model || "not configured"}
              </span>
            </div>
            {Object.keys(goldenFiles).length > 0 && (
              <span className="rounded bg-primary/10 text-primary text-[10px] px-2 py-0.5 font-medium border border-primary/20">
                {Object.keys(goldenFiles).filter((k) => !k.startsWith("golden/")).length} golden assets
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isRunning ? (
            <button
              onClick={handleStopRun}
              className="rounded bg-destructive px-3.5 py-1.5 text-xs text-destructive-foreground hover:bg-destructive/90 font-medium transition-colors"
            >
              ■ Abort Run
            </button>
          ) : (
            <button
              onClick={handleStartRun}
              disabled={!currentSuite || !connection}
              className="rounded bg-primary px-4 py-1.5 text-xs text-primary-foreground hover:bg-primary/90 font-medium transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
            >
              <span>▶</span> Run Suite
            </button>
          )}
        </div>
      </div>

      {runError && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive flex items-center justify-between">
          <span>{runError}</span>
          <button onClick={() => setRunError(null)} className="text-destructive font-bold ml-2">✕</button>
        </div>
      )}

      {/* Run Summary Banner if completed */}
      {completedRun && (
        <div
          className={`rounded-lg border p-4 flex flex-wrap items-center justify-between gap-4 ${
            completedRun.status === "passed"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-950 dark:text-emerald-200"
              : completedRun.status === "inconclusive"
              ? "border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-200"
              : "border-destructive/40 bg-destructive/10 text-destructive-foreground"
          }`}
        >
          <div>
            <div className="flex items-center gap-2 font-bold text-sm uppercase">
              <span>{completedRun.status === "passed" ? "✓" : "✗"}</span>
              <span>VERDICT: {completedRun.status}</span>
            </div>
            <div className="text-xs opacity-90 mt-1">
              {completedRun.passedCases} of {completedRun.totalCases} cases passed (
              {completedRun.failedCases} failed, {completedRun.flakyCases} flaky,{" "}
              {completedRun.inconclusiveCases} inconclusive)
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div>Duration: {(completedRun.performance.totalDurationMs / 1000).toFixed(1)}s</div>
            <div>Tool Calls: {completedRun.performance.totalToolCalls}</div>
            <div>Tokens: {completedRun.performance.totalTokens}</div>
          </div>
        </div>
      )}

      {/* Cases List & Progress */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <span>Test Cases ({currentSuite?.cases.length ?? 0})</span>
          {isRunning && currentRunningCaseId && (
            <span className="text-primary font-mono lowercase animate-pulse">
              Running {currentRunningCaseId} (iteration {currentIterationIndex})...
            </span>
          )}
        </div>

        {currentSuite?.cases.map((caseDef) => {
          const isCurrent = isRunning && currentRunningCaseId === caseDef.id;
          const result = caseResults.find((c) => c.caseId === caseDef.id);
          const isExpanded = activeExpandedCaseId === caseDef.id;

          const statusBadge = isCurrent
            ? "bg-primary/20 text-primary border-primary/40 animate-pulse"
            : !result
            ? "bg-muted text-muted-foreground border-border/40"
            : result.status === "passed"
            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
            : result.status === "inconclusive"
            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
            : "bg-destructive/10 text-destructive border-destructive/30";

          return (
            <div
              key={caseDef.id}
              className="rounded-lg border border-border/80 bg-background p-3.5 space-y-2 transition-all hover:border-border"
            >
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase border ${statusBadge}`}>
                    {isCurrent ? "RUNNING" : result ? result.status : "PENDING"}
                  </span>
                  <span className="font-mono font-semibold text-foreground">{caseDef.id}</span>
                </div>

                <div className="flex items-center gap-3">
                  {result && (
                    <div className="flex items-center gap-2 text-xs">
                      {result.isFlaky && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-semibold">
                          FLAKY
                        </span>
                      )}
                      <span className="font-medium">
                        {(result.passRate * 100).toFixed(0)}% ({result.passedIterations}/{result.totalIterations})
                      </span>
                    </div>
                  )}

                  {result && (
                    <button
                      onClick={() => setActiveExpandedCaseId(isExpanded ? null : caseDef.id)}
                      className="text-xs text-muted-foreground hover:text-foreground font-medium"
                    >
                      {isExpanded ? "▲ Hide Details" : "▼ Inspect Transcript"}
                    </button>
                  )}
                </div>
              </div>

              {caseDef.description && (
                <p className="text-xs text-muted-foreground">{caseDef.description}</p>
              )}

              {/* Prompts preview */}
              <div className="text-[11px] text-muted-foreground/80 font-mono bg-muted/20 p-2 rounded truncate">
                Prompt: {caseDef.prompts && caseDef.prompts.length > 0 ? caseDef.prompts.join(" → ") : (caseDef.promptFile ? `File: ${caseDef.promptFile}` : "(No prompt)")}
              </div>

              {/* Expanded transcript and check evaluations */}
              {isExpanded && result && (
                <div className="space-y-3 pt-2 border-t border-border/40">
                  {result.iterations.map((iter) => (
                    <div key={iter.iterationIndex}>
                      <div className="text-[11px] font-semibold text-muted-foreground font-sans">
                        Iteration #{iter.iterationIndex + 1} ({iter.status.toUpperCase()})
                      </div>
                      <TranscriptView iteration={iter} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
