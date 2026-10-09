import React, { useState, useEffect } from "react";
import type { RunResult, RunSummary } from "../engine/verdict";
import { diffToolSnapshots, type ToolDiff } from "../engine/snapshot";
import { TranscriptView } from "./TranscriptView";

export function EvalsHistoryView() {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [activeRunDetail, setActiveRunDetail] = useState<RunResult | null>(null);
  const [compareRunId, setCompareRunId] = useState<string | null>(null);
  const [compareRunDetail, setCompareRunDetail] = useState<RunResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchRuns = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/inspector/api/fork/evals/runs");
      if (res.ok) {
        const data = await res.json();
        setRuns(data.runs || []);
      }
    } catch (e) {
      console.warn("Failed to fetch runs:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRuns();
  }, []);

  const loadRunDetail = async (id: string, target: "active" | "compare") => {
    try {
      const res = await fetch(`/inspector/api/fork/evals/runs/${id}`);
      if (res.ok) {
        const data = await res.json();
        if (target === "active") setActiveRunDetail(data.run);
        else setCompareRunDetail(data.run);
      }
    } catch (e) {
      console.warn(`Failed to fetch run ${id}:`, e);
    }
  };

  useEffect(() => {
    if (selectedRunId) {
      loadRunDetail(selectedRunId, "active");
    } else {
      setActiveRunDetail(null);
    }
  }, [selectedRunId]);

  useEffect(() => {
    if (compareRunId) {
      loadRunDetail(compareRunId, "compare");
    } else {
      setCompareRunDetail(null);
    }
  }, [compareRunId]);

  // Compute tool diff if comparing two runs
  let toolDiffs: ToolDiff[] = [];
  if (activeRunDetail?.toolsSnapshot && compareRunDetail?.toolsSnapshot) {
    toolDiffs = diffToolSnapshots(activeRunDetail.toolsSnapshot, compareRunDetail.toolsSnapshot);
  }

  return (
    <div className="flex flex-col h-full space-y-4 p-4 overflow-y-auto">
      {/* Header controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-3">
        <div>
          <h3 className="text-sm font-semibold">Evaluation Run History</h3>
          <p className="text-xs text-muted-foreground">
            View past evaluation runs and compare tool descriptions and pass rates across runs.
          </p>
        </div>
        <button
          onClick={fetchRuns}
          className="rounded border border-border bg-muted/60 px-3 py-1 text-xs hover:bg-muted font-medium transition-colors"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Main layout: Run List & Details / Compare */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Run list */}
        <div className="space-y-2 lg:col-span-1">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Runs ({runs.length})
          </div>

          {runs.length === 0 ? (
            <div className="text-xs text-muted-foreground italic p-4 rounded border border-border/40 text-center">
              {isLoading ? "Loading runs..." : "No evaluation runs recorded yet."}
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {runs.map((run) => {
                const isSelected = run.id === selectedRunId;
                const isCompared = run.id === compareRunId;
                const statusColor =
                  run.status === "passed"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                    : run.status === "inconclusive"
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                    : "bg-destructive/10 text-destructive border-destructive/30";

                return (
                  <div
                    key={run.id}
                    className={`rounded-lg border p-3 cursor-pointer transition-all ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border/60 hover:border-border bg-background"
                    }`}
                    onClick={() => {
                      if (!selectedRunId) setSelectedRunId(run.id);
                      else if (selectedRunId === run.id) setSelectedRunId(null);
                      else if (!compareRunId) setCompareRunId(run.id);
                      else setSelectedRunId(run.id);
                    }}
                  >
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className="truncate font-semibold">{run.suiteName}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase border ${statusColor}`}>
                        {run.status}
                      </span>
                    </div>

                    <div className="text-[11px] text-muted-foreground mt-1 flex justify-between">
                      <span>{new Date(run.startedAt).toLocaleString()}</span>
                      <span>{run.model}</span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] mt-2 pt-2 border-t border-border/30">
                      <span>
                        Pass: {run.passedCases}/{run.totalCases}
                        {run.flakyCases > 0 && ` (${run.flakyCases} flaky)`}
                      </span>
                      {run.toolsSnapshotHash && (
                        <span className="font-mono text-[10px] text-muted-foreground">
                          #{run.toolsSnapshotHash}
                        </span>
                      )}
                    </div>

                    {/* Compare buttons */}
                    <div className="mt-2 flex gap-2 text-[10px]">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRunId(run.id);
                        }}
                        className={`px-2 py-0.5 rounded border ${
                          isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                        }`}
                      >
                        Inspect
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (compareRunId === run.id) setCompareRunId(null);
                          else setCompareRunId(run.id);
                        }}
                        className={`px-2 py-0.5 rounded border ${
                          isCompared ? "bg-amber-600 text-white" : "bg-muted"
                        }`}
                      >
                        {isCompared ? "Deselect Compare" : "Compare"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Details & Comparison Column */}
        <div className="lg:col-span-2 space-y-4">
          {compareRunDetail && activeRunDetail ? (
            /* Comparison View */
            <div className="rounded-lg border border-border p-4 bg-background space-y-4">
              <div className="flex items-center justify-between border-b border-border/40 pb-2">
                <h4 className="text-sm font-semibold">
                  Comparing: {activeRunDetail.id} vs {compareRunDetail.id}
                </h4>
                <button
                  onClick={() => setCompareRunId(null)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  ✕ Close Compare
                </button>
              </div>

              {/* Tool description & schema diff */}
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Tool Snapshot Differences ({toolDiffs.length})
                </div>
                {toolDiffs.length === 0 ? (
                  <div className="text-xs text-muted-foreground italic p-3 rounded bg-muted/20">
                    Both runs used identical tool definitions and schemas (Snapshot hash match: #{activeRunDetail.toolsSnapshotHash}).
                  </div>
                ) : (
                  <div className="space-y-2">
                    {toolDiffs.map((diff, idx) => (
                      <div
                        key={idx}
                        className="rounded border border-amber-500/30 bg-amber-500/5 p-3 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between font-semibold">
                          <span>Tool: {diff.toolName}</span>
                          <span className="uppercase text-[10px] text-amber-600 font-mono">
                            {diff.type}
                          </span>
                        </div>
                        {diff.descriptionChanged && (
                          <div className="space-y-1 mt-1 text-[11px]">
                            <div className="text-destructive">
                              - Before: {diff.descriptionChanged.before || "(none)"}
                            </div>
                            <div className="text-emerald-600 dark:text-emerald-400">
                              + After: {diff.descriptionChanged.after || "(none)"}
                            </div>
                          </div>
                        )}
                        {diff.schemaChanged && (
                          <div className="text-[11px] text-muted-foreground font-mono mt-1">
                            Input schema modified
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Side-by-side Case Pass Rates */}
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Case Pass Rates Comparison
                </div>
                <div className="space-y-2">
                  {activeRunDetail.caseResults.map((c) => {
                    const compCase = compareRunDetail.caseResults.find(
                      (other) => other.caseId === c.caseId
                    );
                    return (
                      <div
                        key={c.caseId}
                        className="flex items-center justify-between p-2.5 rounded border border-border/60 bg-muted/10 text-xs"
                      >
                        <span className="font-mono font-medium">{c.caseId}</span>
                        <div className="flex items-center gap-4">
                          <span className="font-medium">
                            Run 1: {(c.passRate * 100).toFixed(0)}% ({c.status})
                          </span>
                          <span className="text-muted-foreground">vs</span>
                          <span className="font-medium">
                            Run 2: {compCase ? `${(compCase.passRate * 100).toFixed(0)}% (${compCase.status})` : "N/A"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : activeRunDetail ? (
            /* Single Run Detail View */
            <div className="rounded-lg border border-border p-4 bg-background space-y-4">
              <div className="flex items-center justify-between border-b border-border/40 pb-2">
                <div>
                  <h4 className="text-sm font-semibold">{activeRunDetail.suiteName}</h4>
                  <div className="text-xs text-muted-foreground">
                    ID: {activeRunDetail.id} • {new Date(activeRunDetail.startedAt).toLocaleString()}
                  </div>
                </div>
                <div className="text-right">
                  <span className="px-2.5 py-1 rounded text-xs font-semibold uppercase bg-muted">
                    {activeRunDetail.status}
                  </span>
                </div>
              </div>

              {/* Run Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="p-2.5 rounded border bg-muted/10">
                  <div className="text-muted-foreground">Model</div>
                  <div className="font-semibold">{activeRunDetail.model}</div>
                </div>
                <div className="p-2.5 rounded border bg-muted/10">
                  <div className="text-muted-foreground">Duration</div>
                  <div className="font-semibold">
                    {(activeRunDetail.performance.totalDurationMs / 1000).toFixed(1)}s
                  </div>
                </div>
                <div className="p-2.5 rounded border bg-muted/10">
                  <div className="text-muted-foreground">Tool Calls</div>
                  <div className="font-semibold">{activeRunDetail.performance.totalToolCalls}</div>
                </div>
                <div className="p-2.5 rounded border bg-muted/10">
                  <div className="text-muted-foreground">Tokens</div>
                  <div className="font-semibold">{activeRunDetail.performance.totalTokens}</div>
                </div>
              </div>

              {/* Cases List */}
              <div className="space-y-3">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Test Cases ({activeRunDetail.caseResults.length})
                </div>
                {activeRunDetail.caseResults.map((c) => (
                  <div key={c.caseId} className="rounded border border-border/80 p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="font-mono text-primary">{c.caseId}</span>
                      <div className="flex items-center gap-2">
                        {c.isFlaky && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 text-[10px]">
                            FLAKY
                          </span>
                        )}
                        <span className="text-[11px]">
                          Pass Rate: {(c.passRate * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    {c.description && (
                      <div className="text-xs text-muted-foreground">{c.description}</div>
                    )}

                    {/* Iteration transcripts */}
                    {c.iterations.map((iter) => (
                      <div key={iter.iterationIndex} className="pt-2">
                        <div className="text-[11px] font-semibold text-muted-foreground">
                          Iteration #{iter.iterationIndex + 1} ({iter.status})
                        </div>
                        <TranscriptView iteration={iter} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-muted-foreground border border-dashed rounded-lg">
              Select an evaluation run from the list to view transcripts and results.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
