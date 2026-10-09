import type { RunSummary } from "@/client/fork/evals/engine/verdict";

export async function forwardRunToSplunk(
  summary: RunSummary,
  extraEnv?: { url?: string; token?: string }
): Promise<boolean> {
  const hecUrl = extraEnv?.url || process.env.SPLUNK_HEC_URL;
  const hecToken = extraEnv?.token || process.env.SPLUNK_HEC_TOKEN;

  if (!hecUrl || !hecToken) {
    return false; // Splunk not configured
  }

  const payload = {
    time: Math.round(summary.completedAt / 1000),
    sourcetype: "mcp:eval:run",
    event: {
      type: "mcp_eval_run",
      runId: summary.id,
      suiteName: summary.suiteName,
      status: summary.status,
      model: summary.model,
      provider: summary.provider,
      toolsSnapshotHash: summary.toolsSnapshotHash,
      totalCases: summary.totalCases,
      passedCases: summary.passedCases,
      failedCases: summary.failedCases,
      flakyCases: summary.flakyCases,
      durationMs: summary.performance.totalDurationMs,
      totalToolCalls: summary.performance.totalToolCalls,
      totalTokens: summary.performance.totalTokens,
    },
  };

  try {
    const response = await fetch(hecUrl, {
      method: "POST",
      headers: {
        Authorization: `Splunk ${hecToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    return response.ok;
  } catch (err: unknown) {
    console.warn("[Splunk HEC] Failed to forward eval run summary:", err);
    return false;
  }
}
