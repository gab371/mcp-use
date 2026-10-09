import React, { useState } from "react";
import type { IterationResult } from "../engine/verdict";

export interface TranscriptViewProps {
  iteration: IterationResult;
  suiteId?: string;
  caseId?: string;
  onGoldenSaved?: () => void;
}

export function TranscriptView({
  iteration,
  suiteId,
  caseId,
  onGoldenSaved,
}: TranscriptViewProps) {
  const { transcript, checkResults, error } = iteration;
  const [savingStatus, setSavingStatus] = useState<Record<string, string>>({});

  const handleSaveToolResultAsGolden = async (toolName: string, result: unknown, idx: number) => {
    if (!suiteId) return;
    const key = `tool-${idx}`;
    setSavingStatus((s) => ({ ...s, [key]: "Saving..." }));
    const fileName = `${toolName}.result.json`;
    let contentToSave = "";

    if (
      result &&
      typeof result === "object" &&
      Array.isArray((result as any).content) &&
      (result as any).content[0]?.text
    ) {
      try {
        const parsed = JSON.parse((result as any).content[0].text);
        contentToSave = JSON.stringify(parsed, null, 2);
      } catch {
        contentToSave = (result as any).content[0].text;
      }
    } else {
      contentToSave = typeof result === "string" ? result : JSON.stringify(result, null, 2);
    }

    try {
      const res = await fetch(
        `/inspector/api/fork/evals/suites/${encodeURIComponent(suiteId)}/golden/${encodeURIComponent(fileName)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: contentToSave }),
        }
      );
      if (res.ok) {
        setSavingStatus((s) => ({ ...s, [key]: "Saved to golden!" }));
        setTimeout(() => setSavingStatus((s) => ({ ...s, [key]: "" })), 3000);
        onGoldenSaved?.();
      } else {
        setSavingStatus((s) => ({ ...s, [key]: "Failed to save" }));
      }
    } catch {
      setSavingStatus((s) => ({ ...s, [key]: "Error" }));
    }
  };

  const handleSaveAnswerAsGolden = async () => {
    if (!suiteId || !transcript.finalText) return;
    setSavingStatus((s) => ({ ...s, answer: "Saving..." }));
    const fileName = `${caseId || "answer"}.answer.md`;
    try {
      const res = await fetch(
        `/inspector/api/fork/evals/suites/${encodeURIComponent(suiteId)}/golden/${encodeURIComponent(fileName)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: transcript.finalText }),
        }
      );
      if (res.ok) {
        setSavingStatus((s) => ({ ...s, answer: "Saved to golden!" }));
        setTimeout(() => setSavingStatus((s) => ({ ...s, answer: "" })), 3000);
        onGoldenSaved?.();
      } else {
        setSavingStatus((s) => ({ ...s, answer: "Failed to save" }));
      }
    } catch {
      setSavingStatus((s) => ({ ...s, answer: "Error" }));
    }
  };

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-border/60 bg-muted/20 p-4 text-xs font-mono">
      {error && (
        <div className="rounded border border-destructive/40 bg-destructive/10 p-2.5 text-destructive font-sans">
          <strong>Execution error:</strong> {error}
        </div>
      )}

      {/* Checks results */}
      {checkResults.length > 0 && (
        <div>
          <div className="font-semibold text-muted-foreground uppercase tracking-wider text-[11px] mb-1 font-sans">
            Checks Evaluation
          </div>
          <div className="space-y-1">
            {checkResults.map((check, idx) => (
              <div
                key={idx}
                className={`flex items-start gap-2 p-1.5 rounded ${
                  check.pass
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "bg-destructive/10 text-destructive"
                }`}
              >
                <span>{check.pass ? "✓" : "✗"}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{check.checkName}</span>
                    {check.score !== undefined && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-muted/70 font-mono">
                        Similarity: {(check.score * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                  {check.reason && <div className="text-[11px] opacity-90 mt-0.5">{check.reason}</div>}

                  {(check.goldenExpected !== undefined || check.actualReceived !== undefined) && (
                    <div className="mt-2 space-y-1.5 pt-1.5 border-t border-border/30 font-mono">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px]">
                        <div className="rounded bg-background/80 p-2 border border-border/50">
                          <div className="text-muted-foreground uppercase font-sans font-semibold mb-1">
                            Golden Expected
                          </div>
                          <pre className="overflow-x-auto max-h-48 whitespace-pre-wrap text-[11px]">
                            {typeof check.goldenExpected === "string"
                              ? check.goldenExpected
                              : JSON.stringify(check.goldenExpected, null, 2)}
                          </pre>
                        </div>
                        <div className="rounded bg-background/80 p-2 border border-border/50">
                          <div className="text-muted-foreground uppercase font-sans font-semibold mb-1">
                            Actual Received
                          </div>
                          <pre className="overflow-x-auto max-h-48 whitespace-pre-wrap text-[11px]">
                            {typeof check.actualReceived === "string"
                              ? check.actualReceived
                              : JSON.stringify(check.actualReceived, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tool calls */}
      <div>
        <div className="font-semibold text-muted-foreground uppercase tracking-wider text-[11px] mb-1 font-sans flex justify-between">
          <span>Tool Calls ({transcript.toolCalls.length})</span>
          {transcript.durationMs !== undefined && (
            <span>Latency: {transcript.durationMs}ms</span>
          )}
        </div>
        {transcript.toolCalls.length === 0 ? (
          <div className="text-muted-foreground italic py-1">No tools called</div>
        ) : (
          <div className="space-y-2">
            {transcript.toolCalls.map((call, idx) => (
              <div
                key={idx}
                className="rounded border border-border/80 bg-background/80 p-2.5 space-y-1.5"
              >
                <div className="flex items-center justify-between font-semibold">
                  <span className="text-primary">
                    {idx + 1}. {call.name}
                  </span>
                  {call.isError ? (
                    <span className="px-1.5 py-0.5 rounded bg-destructive/20 text-destructive text-[10px]">
                      ERROR
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-[10px]">
                      {call.endedAt && call.startedAt ? `${call.endedAt - call.startedAt}ms` : ""}
                    </span>
                  )}
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase font-sans">
                    Arguments:
                  </div>
                  <pre className="overflow-x-auto p-1.5 rounded bg-muted/40 text-[11px]">
                    {JSON.stringify(call.args, null, 2)}
                  </pre>
                </div>
                {call.result !== undefined && (
                  <div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground uppercase font-sans mb-1">
                      <span>Result:</span>
                      {suiteId && (
                        <button
                          onClick={() => handleSaveToolResultAsGolden(call.name, call.result, idx)}
                          className="px-2 py-0.5 rounded border border-border bg-muted/60 hover:bg-muted text-foreground transition-colors normal-case font-medium flex items-center gap-1"
                        >
                          {savingStatus[`tool-${idx}`] || "💾 Set as Golden Result"}
                        </button>
                      )}
                    </div>
                    <pre className="overflow-x-auto p-1.5 rounded bg-muted/40 text-[11px] max-h-36">
                      {typeof call.result === "string"
                        ? call.result
                        : JSON.stringify(call.result, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Final model response */}
      {transcript.finalText && (
        <div>
          <div className="font-semibold text-muted-foreground uppercase tracking-wider text-[11px] mb-1 font-sans flex items-center justify-between">
            <span>Assistant Answer</span>
            {suiteId && (
              <button
                onClick={handleSaveAnswerAsGolden}
                className="px-2 py-0.5 rounded border border-border bg-muted/60 hover:bg-muted text-foreground transition-colors normal-case font-medium flex items-center gap-1 text-[10px]"
              >
                {savingStatus.answer || "💾 Set as Golden Answer"}
              </button>
            )}
          </div>
          <div className="p-2.5 rounded border border-border/60 bg-background/70 whitespace-pre-wrap font-sans text-xs">
            {transcript.finalText}
          </div>
        </div>
      )}

      {/* Usage statistics */}
      {transcript.usage && (
        <div className="flex gap-4 text-[11px] text-muted-foreground font-sans pt-1 border-t border-border/40">
          <span>Input tokens: {transcript.usage.inputTokens ?? 0}</span>
          <span>Output tokens: {transcript.usage.outputTokens ?? 0}</span>
          <span>Total tokens: {transcript.usage.totalTokens ?? 0}</span>
        </div>
      )}
    </div>
  );
}
