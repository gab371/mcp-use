import { describe, expect, it } from "vitest";
import {
  evaluateIteration,
  computeCaseVerdict,
  computeRunResult,
  type IterationResult,
} from "../../evals/engine/verdict";
import type { EvalCase } from "../../evals/engine/suite";
import type { Transcript } from "../../evals/engine/checks";

describe("verdict engine", () => {
  const sampleCase: EvalCase = {
    id: "test-case-1",
    prompts: ["Test prompt"],
    passThreshold: 0.67,
    expect: [{ toolCalled: "search" }],
  };

  const passingTranscript: Transcript = {
    toolCalls: [{ name: "search", args: {}, result: "ok", isError: false }],
    finalText: "found it",
    durationMs: 120,
    usage: { inputTokens: 50, outputTokens: 20, totalTokens: 70 },
  };

  const failingTranscript: Transcript = {
    toolCalls: [{ name: "other", args: {}, result: "ok", isError: false }],
    finalText: "no search",
    durationMs: 90,
    usage: { inputTokens: 40, outputTokens: 10, totalTokens: 50 },
  };

  const inconclusiveTranscript: Transcript = {
    toolCalls: [],
    finalText: "",
    durationMs: 10,
    error: "Connection timeout to provider",
    isInconclusive: true,
  };

  it("evaluates iteration correctly", () => {
    const iterPassed = evaluateIteration(0, sampleCase, passingTranscript);
    expect(iterPassed.status).toBe("passed");

    const iterFailed = evaluateIteration(1, sampleCase, failingTranscript);
    expect(iterFailed.status).toBe("failed");

    const iterInconclusive = evaluateIteration(2, sampleCase, inconclusiveTranscript);
    expect(iterInconclusive.status).toBe("inconclusive");
  });

  it("computes case verdict with passThreshold and detects flakiness", () => {
    const iter1 = evaluateIteration(0, sampleCase, passingTranscript);
    const iter2 = evaluateIteration(1, sampleCase, passingTranscript);
    const iter3 = evaluateIteration(2, sampleCase, failingTranscript);

    // 2 passed out of 3 valid iterations = passRate 0.667 >= 0.67 -> passes!
    const verdict = computeCaseVerdict(sampleCase, [iter1, iter2, iter3]);
    expect(verdict.status).toBe("passed");
    expect(verdict.passRate).toBe(0.667);
    expect(verdict.isFlaky).toBe(true);
    expect(verdict.passedIterations).toBe(2);
    expect(verdict.failedIterations).toBe(1);
    expect(verdict.performance.totalToolCalls).toBe(3);
  });

  it("leaves inconclusive iterations out of the pass rate calculation", () => {
    const iter1 = evaluateIteration(0, sampleCase, passingTranscript);
    const iter2 = evaluateIteration(1, sampleCase, inconclusiveTranscript);
    const iter3 = evaluateIteration(2, sampleCase, inconclusiveTranscript);

    // 1 passed, 2 inconclusive -> 1/1 valid passed = 100% pass rate!
    const verdict = computeCaseVerdict(sampleCase, [iter1, iter2, iter3]);
    expect(verdict.status).toBe("passed");
    expect(verdict.passRate).toBe(1.0);
    expect(verdict.inconclusiveIterations).toBe(2);
    expect(verdict.isFlaky).toBe(false);
  });

  it("marks case inconclusive if all iterations were inconclusive", () => {
    const iter1 = evaluateIteration(0, sampleCase, inconclusiveTranscript);
    const iter2 = evaluateIteration(1, sampleCase, inconclusiveTranscript);

    const verdict = computeCaseVerdict(sampleCase, [iter1, iter2]);
    expect(verdict.status).toBe("inconclusive");
    expect(verdict.passRate).toBe(0);
  });

  it("computes overall run result", () => {
    const iter1 = evaluateIteration(0, sampleCase, passingTranscript);
    const caseVerdict1 = computeCaseVerdict(sampleCase, [iter1]);

    const runResult = computeRunResult({
      runId: "run-abc-123",
      suiteName: "Test Suite",
      caseResults: [caseVerdict1],
      startedAt: 1000,
      completedAt: 2000,
      model: "gpt-4o",
      provider: "openai",
      toolsSnapshotHash: "abcd1234",
    });

    expect(runResult.id).toBe("run-abc-123");
    expect(runResult.status).toBe("passed");
    expect(runResult.totalCases).toBe(1);
    expect(runResult.passedCases).toBe(1);
    expect(runResult.failedCases).toBe(0);
    expect(runResult.performance.totalToolCalls).toBe(1);
  });
});
