import React from "react";
import type { IterationResult } from "../engine/verdict";

export function TranscriptView({ iteration }: { iteration: IterationResult }) {
  const { transcript, checkResults, failedChecks, error } = iteration;

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
                  check.pass ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-destructive/10 text-destructive"
                }`}
              >
                <span>{check.pass ? "✓" : "✗"}</span>
                <div className="flex-1">
                  <div className="font-semibold">{check.checkName}</div>
                  {check.reason && <div className="text-[11px] opacity-90 mt-0.5">{check.reason}</div>}
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
                  <span className="text-primary">{idx + 1}. {call.name}</span>
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
                  <div className="text-[10px] text-muted-foreground uppercase font-sans">Arguments:</div>
                  <pre className="overflow-x-auto p-1.5 rounded bg-muted/40 text-[11px]">
                    {JSON.stringify(call.args, null, 2)}
                  </pre>
                </div>
                {call.result !== undefined && (
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase font-sans">Result:</div>
                    <pre className="overflow-x-auto p-1.5 rounded bg-muted/40 text-[11px] max-h-36">
                      {typeof call.result === "string" ? call.result : JSON.stringify(call.result, null, 2)}
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
          <div className="font-semibold text-muted-foreground uppercase tracking-wider text-[11px] mb-1 font-sans">
            Assistant Answer
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
