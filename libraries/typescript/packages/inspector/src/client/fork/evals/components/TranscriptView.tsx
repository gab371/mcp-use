import { useState } from "react";
import type { IterationResult } from "../engine/verdict";
import { addExpectationToSuiteYaml, type EvalCase } from "../engine/suite";
import { inspectorApi } from "@/client/utils/basePath";

export interface TranscriptViewProps {
  iteration: IterationResult;
  suiteId?: string;
  caseId?: string;
  caseDef?: EvalCase;
  onGoldenSaved?: () => void;
}

export function TranscriptView({
  iteration,
  suiteId,
  caseId,
  caseDef,
  onGoldenSaved,
}: TranscriptViewProps) {
  const { transcript, checkResults, error } = iteration;
  const [savingStatus, setSavingStatus] = useState<Record<string, string>>({});

  const handleSaveToolResultAsGolden = async (toolName: string, result: unknown, idx: number) => {
    if (!suiteId) return;
    const key = `tool-${idx}`;
    setSavingStatus((s) => ({ ...s, [key]: "Saving..." }));

    // 1. Extract content to save: serialize the exact tool result as shown in the UI
    const contentToSave = typeof result === "string" ? result : JSON.stringify(result, null, 2);

    // 2. Identify if this case already has a goldenResult check pointing to an existing file
    let existingRelFile: string | undefined;
    if (caseDef?.expect) {
      for (const exp of caseDef.expect) {
        if (exp.goldenResult) {
          if (typeof exp.goldenResult === "string") {
            if (!exp.toolCalled || exp.toolCalled === toolName) {
              existingRelFile = exp.goldenResult;
              break;
            }
          } else if (typeof exp.goldenResult === "object") {
            if (
              !exp.goldenResult.tool ||
              exp.goldenResult.tool === toolName ||
              exp.toolCalled === toolName
            ) {
              if (exp.goldenResult.file) {
                existingRelFile = exp.goldenResult.file;
                break;
              }
            }
          }
        }
      }
    }

    const fileName = existingRelFile
      ? existingRelFile.replace(/^golden[/\\]/, "").replace(/^[/\\]+/, "")
      : `${toolName}.result.json`;

    try {
      const res = await fetch(
        inspectorApi(`fork/evals/suites/${encodeURIComponent(suiteId)}/golden/${encodeURIComponent(fileName)}`),
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: contentToSave }),
        }
      );
      if (!res.ok) {
        setSavingStatus((s) => ({ ...s, [key]: "Failed to save file" }));
        return;
      }

      // 3. If no golden check was previously configured in the YAML, update the suite YAML
      if (!existingRelFile && caseId) {
        try {
          const suiteRes = await fetch(inspectorApi(`fork/evals/suites/${encodeURIComponent(suiteId)}`));
          if (suiteRes.ok) {
            const suiteDetail = await suiteRes.json();
            if (suiteDetail.yaml) {
              const updatedYaml = addExpectationToSuiteYaml(suiteDetail.yaml, caseId, {
                goldenResult: {
                  tool: toolName,
                  file: `golden/${fileName}`,
                  match: "partial",
                },
              });
              await fetch(inspectorApi(`fork/evals/suites/${encodeURIComponent(suiteId)}`), {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ yaml: updatedYaml }),
              });
            }
          }
        } catch (e) {
          console.warn("Failed to update suite YAML:", e);
        }
      }

      setSavingStatus((s) => ({ ...s, [key]: "Saved to golden!" }));
      setTimeout(() => setSavingStatus((s) => ({ ...s, [key]: "" })), 3000);
      onGoldenSaved?.();
    } catch {
      setSavingStatus((s) => ({ ...s, [key]: "Error" }));
    }
  };

  const handleSaveAnswerAsGolden = async () => {
    if (!suiteId || !transcript.finalText) return;
    setSavingStatus((s) => ({ ...s, answer: "Saving..." }));

    // 1. Identify if this case already has a goldenAnswer check pointing to an existing file
    let existingAnswerFile: string | undefined;
    if (caseDef?.expect) {
      for (const exp of caseDef.expect) {
        if (exp.goldenAnswer) {
          if (typeof exp.goldenAnswer === "string") {
            existingAnswerFile = exp.goldenAnswer;
            break;
          } else if (typeof exp.goldenAnswer === "object" && exp.goldenAnswer.file) {
            existingAnswerFile = exp.goldenAnswer.file;
            break;
          }
        }
      }
    }

    const fileName = existingAnswerFile
      ? existingAnswerFile.replace(/^golden[/\\]/, "").replace(/^[/\\]+/, "")
      : `${caseId || "answer"}.answer.md`;

    try {
      const res = await fetch(
        inspectorApi(`fork/evals/suites/${encodeURIComponent(suiteId)}/golden/${encodeURIComponent(fileName)}`),
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: transcript.finalText }),
        }
      );
      if (!res.ok) {
        setSavingStatus((s) => ({ ...s, answer: "Failed to save file" }));
        return;
      }

      // 2. If no golden answer was previously configured, update the suite YAML
      if (!existingAnswerFile && caseId) {
        try {
          const suiteRes = await fetch(inspectorApi(`fork/evals/suites/${encodeURIComponent(suiteId)}`));
          if (suiteRes.ok) {
            const suiteDetail = await suiteRes.json();
            if (suiteDetail.yaml) {
              const updatedYaml = addExpectationToSuiteYaml(suiteDetail.yaml, caseId, {
                goldenAnswer: {
                  file: `golden/${fileName}`,
                  match: "similarity",
                  threshold: 0.75,
                },
              });
              await fetch(inspectorApi(`fork/evals/suites/${encodeURIComponent(suiteId)}`), {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ yaml: updatedYaml }),
              });
            }
          }
        } catch (e) {
          console.warn("Failed to update suite YAML:", e);
        }
      }

      setSavingStatus((s) => ({ ...s, answer: "Saved to golden!" }));
      setTimeout(() => setSavingStatus((s) => ({ ...s, answer: "" })), 3000);
      onGoldenSaved?.();
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
