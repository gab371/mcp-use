import type { EvalCheckConfig } from "./suite";

export interface ToolCallRecord {
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
  isError?: boolean;
  startedAt?: number;
  endedAt?: number;
}

export interface Transcript {
  toolCalls: ToolCallRecord[];
  finalText: string;
  durationMs?: number;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  error?: string;
  isInconclusive?: boolean;
}

export interface CheckResult {
  checkName: string;
  pass: boolean;
  reason?: string;
  score?: number;
  goldenExpected?: unknown;
  actualReceived?: unknown;
}

/**
 * Checks whether an argument value satisfies the expected criteria.
 * Supports special wildcard keywords: 'any-string', 'any-number', 'any'.
 */
function matchesValue(actual: unknown, expected: unknown): boolean {
  if (expected === "any-string") {
    return typeof actual === "string";
  }
  if (expected === "any-uuid") {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return typeof actual === "string" && uuidRegex.test(actual);
  }
  if (expected === "any-number") {
    return typeof actual === "number" && !Number.isNaN(actual);
  }
  if (expected === "any") {
    return actual !== undefined && actual !== null;
  }

  if (typeof expected === "object" && expected !== null) {
    if (typeof actual !== "object" || actual === null) {
      return false;
    }
    if (Array.isArray(expected)) {
      if (!Array.isArray(actual) || actual.length !== expected.length) {
        return false;
      }
      return expected.every((expItem, idx) => matchesValue(actual[idx], expItem));
    }
    // Object comparison
    const expObj = expected as Record<string, unknown>;
    const actObj = actual as Record<string, unknown>;
    return Object.keys(expObj).every((key) => matchesValue(actObj[key], expObj[key]));
  }

  return actual === expected;
}

/**
 * Checks if actualArgs matches expectedArgs according to match mode ('partial' | 'exact').
 */
function matchesArgs(
  actualArgs: Record<string, unknown>,
  expectedArgs: Record<string, unknown>,
  matchMode: "partial" | "exact"
): boolean {
  if (matchMode === "exact") {
    const actKeys = Object.keys(actualArgs);
    const expKeys = Object.keys(expectedArgs);
    if (actKeys.length !== expKeys.length) return false;
    for (const key of expKeys) {
      if (!Object.prototype.hasOwnProperty.call(actualArgs, key)) return false;
      if (!matchesValue(actualArgs[key], expectedArgs[key])) return false;
    }
    return true;
  }

  // Partial match: every key in expectedArgs must match in actualArgs
  for (const [key, expVal] of Object.entries(expectedArgs)) {
    if (!matchesValue(actualArgs[key], expVal)) {
      return false;
    }
  }
  return true;
}

/**
 * Recursively scans an object/value to see if it contains any of the forbidden substrings.
 */
function containsForbiddenString(value: unknown, forbiddenLower: string[]): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") {
    const lower = value.toLowerCase();
    return forbiddenLower.some((f) => lower.includes(f));
  }
  if (typeof value === "number" || typeof value === "boolean") {
    const str = String(value).toLowerCase();
    return forbiddenLower.some((f) => str.includes(f));
  }
  if (Array.isArray(value)) {
    return value.some((item) => containsForbiddenString(item, forbiddenLower));
  }
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some((val) =>
      containsForbiddenString(val, forbiddenLower)
    );
  }
  return false;
}

/**
 * Recursively checks if an actual data structure matches an expected subset.
 */
export function isDeepSubset(
  actual: unknown,
  expected: unknown
): { pass: boolean; reason?: string } {
  if (expected === actual) return { pass: true };

  if (expected === null || expected === undefined) {
    return { pass: actual === expected, reason: `Expected ${expected}, got ${actual}` };
  }

  if (typeof expected !== "object") {
    if (expected === "any") {
      const pass = actual !== undefined && actual !== null;
      return { pass, reason: pass ? undefined : `Expected any non-null value, got ${actual}` };
    }
    if (expected === "any-string") {
      const pass = typeof actual === "string";
      return { pass, reason: pass ? undefined : `Expected any string, got ${typeof actual}` };
    }
    if (expected === "any-uuid") {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const pass = typeof actual === "string" && uuidRegex.test(actual);
      return {
        pass,
        reason: pass ? undefined : `Expected valid UUID string, got ${JSON.stringify(actual)}`,
      };
    }
    if (expected === "any-number") {
      const pass = typeof actual === "number" && !Number.isNaN(actual);
      return { pass, reason: pass ? undefined : `Expected any number, got ${typeof actual}` };
    }

    const pass = String(actual) === String(expected);
    return {
      pass,
      reason: pass ? undefined : `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    };
  }

  // Array comparison
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) {
      return { pass: false, reason: `Expected array, got ${typeof actual}` };
    }
    for (let i = 0; i < expected.length; i++) {
      const expItem = expected[i];
      const found = actual.some((actItem) => isDeepSubset(actItem, expItem).pass);
      if (!found) {
        return {
          pass: false,
          reason: `Array element at index ${i} not found in actual array: ${JSON.stringify(expItem)}`,
        };
      }
    }
    return { pass: true };
  }

  // Object comparison
  if (typeof actual !== "object" || actual === null || Array.isArray(actual)) {
    return { pass: false, reason: `Expected object, got ${Array.isArray(actual) ? "array" : typeof actual}` };
  }

  const actObj = actual as Record<string, unknown>;
  const expObj = expected as Record<string, unknown>;

  for (const [key, expVal] of Object.entries(expObj)) {
    if (!(key in actObj)) {
      return { pass: false, reason: `Missing key "${key}" in actual object` };
    }
    const child = isDeepSubset(actObj[key], expVal);
    if (!child.pass) {
      return { pass: false, reason: `Key "${key}": ${child.reason}` };
    }
  }

  return { pass: true };
}

/**
 * Evaluates whether an MCP tool call result matches expected golden data.
 * Tests multiple candidate interpretations:
 * 1. `actual` directly as-is (e.g. root CallToolResult with _meta and content)
 * 2. Parsed JSON from each text block in `actual.content`
 * 3. Text content or data fields in `actual.content`
 */
export function evaluateToolResultMatch(
  actual: unknown,
  expected: unknown,
  mode: "partial" | "exact" | "contains" = "partial"
): { pass: boolean; reason?: string } {
  const candidates: unknown[] = [actual];

  if (actual && typeof actual === "object") {
    if ((actual as any).structuredContent !== undefined) {
      candidates.push((actual as any).structuredContent);
    }
    const content = (actual as { content?: unknown }).content;
    if (Array.isArray(content)) {
      for (const item of content) {
        if (item && typeof item === "object") {
          if (item.type === "text" && typeof item.text === "string") {
            try {
              candidates.push(JSON.parse(item.text));
            } catch {
              candidates.push(item.text);
            }
          } else if ("data" in item) {
            candidates.push((item as any).data);
          }
        }
      }
    }
  }

  const testCandidate = (candidate: unknown): { pass: boolean; reason?: string } => {
    if (mode === "exact") {
      const pass = JSON.stringify(candidate) === JSON.stringify(expected);
      return {
        pass,
        reason: pass ? undefined : "Tool result does not match expected result exactly",
      };
    }

    if (mode === "contains") {
      if (typeof candidate === "string" && typeof expected === "string") {
        const pass = candidate.includes(expected);
        return { pass, reason: pass ? undefined : `Tool result string did not contain "${expected}"` };
      }
      if (Array.isArray(candidate)) {
        const pass = candidate.some((item) => isDeepSubset(item, expected).pass);
        return { pass, reason: pass ? undefined : "Array does not contain expected element" };
      }
    }

    return isDeepSubset(candidate, expected);
  };

  let bestFailure: { pass: boolean; reason?: string } | undefined;

  for (const candidate of candidates) {
    const res = testCandidate(candidate);
    if (res.pass) {
      return res;
    }

    if (!bestFailure) {
      bestFailure = res;
    } else {
      const expIsObj = typeof expected === "object" && expected !== null;
      const candIsObj = typeof candidate === "object" && candidate !== null;
      const bestWasTypeMismatch = bestFailure.reason?.startsWith("Expected object, got");

      if (expIsObj && candIsObj && bestWasTypeMismatch) {
        bestFailure = res;
      } else if (
        res.reason &&
        bestFailure.reason &&
        res.reason.includes("Key ") &&
        !bestFailure.reason.includes("Key ")
      ) {
        bestFailure = res;
      }
    }
  }

  return bestFailure ?? { pass: false, reason: "No tool result matched" };
}

/**
 * Computes token-overlap text similarity (Dice-Sørensen coefficient) between 0.0 and 1.0.
 */
export function computeTextSimilarity(actualText: string, expectedText: string): number {
  const tokenize = (str: string) =>
    str
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter(Boolean);

  const tokens1 = tokenize(actualText);
  const tokens2 = tokenize(expectedText);

  if (tokens1.length === 0 && tokens2.length === 0) return 1.0;
  if (tokens1.length === 0 || tokens2.length === 0) return 0.0;

  const freq1 = new Map<string, number>();
  for (const t of tokens1) freq1.set(t, (freq1.get(t) || 0) + 1);

  let intersection = 0;
  for (const t of tokens2) {
    const count = freq1.get(t) || 0;
    if (count > 0) {
      intersection++;
      freq1.set(t, count - 1);
    }
  }

  return (2 * intersection) / (tokens1.length + tokens2.length);
}

/**
 * Executes a single check against a transcript.
 */
export function evaluateCheck(
  check: EvalCheckConfig,
  transcript: Transcript,
  resolvedGolden?: Record<string, string>
): CheckResult {
  const calls = transcript.toolCalls;

  // 1. toolCalled
  if (check.toolCalled !== undefined) {
    const target = check.toolCalled;
    const matchingToolCalls = calls.filter((c) => c.name === target);
    if (matchingToolCalls.length === 0) {
      return {
        checkName: `toolCalled: ${target}`,
        pass: false,
        reason: `Expected tool "${target}" to be called, but it was never called. Called tools: [${calls.map((c) => c.name).join(", ")}]`,
      };
    }

    if (check.args !== undefined) {
      const mode = check.match ?? "partial";
      const matchesAnyCall = matchingToolCalls.some((c) =>
        matchesArgs(c.args ?? {}, check.args!, mode)
      );
      if (!matchesAnyCall) {
        return {
          checkName: `toolCalled: ${target} with args`,
          pass: false,
          reason: `Tool "${target}" was called ${matchingToolCalls.length} time(s), but none matched expected args (${mode}): ${JSON.stringify(
            check.args
          )}. Actual calls: ${JSON.stringify(matchingToolCalls.map((c) => c.args))}`,
        };
      }
    }

    if (check.goldenResult !== undefined) {
      const goldenCfg =
        typeof check.goldenResult === "string"
          ? { file: check.goldenResult, match: "partial" as const }
          : check.goldenResult;

      let expectedData: unknown = goldenCfg.content;
      if (expectedData === undefined && goldenCfg.file) {
        const raw = resolvedGolden?.[goldenCfg.file];
        if (raw !== undefined) {
          try {
            expectedData = JSON.parse(raw);
          } catch {
            expectedData = raw;
          }
        }
      }

      if (expectedData === undefined) {
        return {
          checkName: `toolCalled: ${target} with goldenResult`,
          pass: false,
          reason: `Golden result reference could not be resolved: ${goldenCfg.file || "no content"}`,
        };
      }

      const matchMode = goldenCfg.match ?? "partial";
      let bestMismatchReason = "No result matched golden expectation";
      let matchedCall: ToolCallRecord | undefined;

      for (const call of matchingToolCalls) {
        const checkSub = evaluateToolResultMatch(call.result, expectedData, matchMode);
        if (checkSub.pass) {
          matchedCall = call;
          break;
        } else {
          bestMismatchReason = checkSub.reason || bestMismatchReason;
        }
      }

      if (!matchedCall) {
        return {
          checkName: `toolCalled: ${target} with goldenResult`,
          pass: false,
          reason: `Tool "${target}" result did not match golden expectation (${matchMode}): ${bestMismatchReason}`,
          goldenExpected: expectedData,
          actualReceived: matchingToolCalls[0]?.result,
        };
      }

      return {
        checkName: `toolCalled: ${target} with goldenResult`,
        pass: true,
        goldenExpected: expectedData,
        actualReceived: matchedCall.result,
      };
    }

    return { checkName: `toolCalled: ${target}`, pass: true };
  }

  // Standalone goldenResult check
  if (check.goldenResult !== undefined) {
    const goldenCfg =
      typeof check.goldenResult === "string"
        ? { file: check.goldenResult, match: "partial" as const }
        : check.goldenResult;

    const targetTool = goldenCfg.tool;
    const targetCalls = targetTool ? calls.filter((c) => c.name === targetTool) : calls;

    if (targetTool && targetCalls.length === 0) {
      return {
        checkName: `goldenResult: ${targetTool}`,
        pass: false,
        reason: `Expected tool "${targetTool}" to be called for golden result evaluation, but it was not called.`,
      };
    }

    if (targetCalls.length === 0) {
      return {
        checkName: "goldenResult",
        pass: false,
        reason: "No tool calls found in transcript to evaluate golden result against.",
      };
    }

    let expectedData: unknown = goldenCfg.content;
    if (expectedData === undefined && goldenCfg.file) {
      const raw = resolvedGolden?.[goldenCfg.file];
      if (raw !== undefined) {
        try {
          expectedData = JSON.parse(raw);
        } catch {
          expectedData = raw;
        }
      }
    }

    if (expectedData === undefined) {
      return {
        checkName: `goldenResult${targetTool ? `: ${targetTool}` : ""}`,
        pass: false,
        reason: `Golden result reference could not be resolved: ${goldenCfg.file || "no content"}`,
      };
    }

    const matchMode = goldenCfg.match ?? "partial";
    let bestMismatchReason = "No result matched golden expectation";
    let matchedCall: ToolCallRecord | undefined;

    for (const call of targetCalls) {
      const checkSub = evaluateToolResultMatch(call.result, expectedData, matchMode);
      if (checkSub.pass) {
        matchedCall = call;
        break;
      } else {
        bestMismatchReason = checkSub.reason || bestMismatchReason;
      }
    }

    if (!matchedCall) {
      return {
        checkName: `goldenResult${targetTool ? `: ${targetTool}` : ""}`,
        pass: false,
        reason: `Tool result did not match golden expectation (${matchMode}): ${bestMismatchReason}`,
        goldenExpected: expectedData,
        actualReceived: targetCalls[0]?.result,
      };
    }

    return {
      checkName: `goldenResult${targetTool ? `: ${targetTool}` : ""}`,
      pass: true,
      goldenExpected: expectedData,
      actualReceived: matchedCall.result,
    };
  }

  // 2. toolNotCalled
  if (check.toolNotCalled !== undefined) {
    const target = check.toolNotCalled;
    const called = calls.some((c) => c.name === target);
    if (called) {
      return {
        checkName: `toolNotCalled: ${target}`,
        pass: false,
        reason: `Tool "${target}" was expected not to be called, but was called`,
      };
    }
    return { checkName: `toolNotCalled: ${target}`, pass: true };
  }

  // 3. onlyTools
  if (check.onlyTools !== undefined) {
    const allowed = new Set(check.onlyTools);
    const forbiddenCalls = calls.filter((c) => !allowed.has(c.name));
    if (forbiddenCalls.length > 0) {
      return {
        checkName: `onlyTools: [${check.onlyTools.join(", ")}]`,
        pass: false,
        reason: `Calls made to tools outside the allowed list: [${forbiddenCalls
          .map((c) => c.name)
          .join(", ")}]`,
      };
    }
    return { checkName: `onlyTools: [${check.onlyTools.join(", ")}]`, pass: true };
  }

  // 4. firstTool
  if (check.firstTool !== undefined) {
    const firstCall = calls[0];
    if (!firstCall) {
      return {
        checkName: `firstTool: ${check.firstTool}`,
        pass: false,
        reason: `Expected first tool to be "${check.firstTool}", but no tools were called`,
      };
    }
    if (firstCall.name !== check.firstTool) {
      return {
        checkName: `firstTool: ${check.firstTool}`,
        pass: false,
        reason: `Expected first tool to be "${check.firstTool}", but was "${firstCall.name}"`,
      };
    }
    return { checkName: `firstTool: ${check.firstTool}`, pass: true };
  }

  // 5. toolOrder
  if (check.toolOrder !== undefined) {
    const expectedSequence = check.toolOrder;
    let expectedIdx = 0;
    for (const call of calls) {
      if (call.name === expectedSequence[expectedIdx]) {
        expectedIdx++;
        if (expectedIdx === expectedSequence.length) break;
      }
    }
    if (expectedIdx < expectedSequence.length) {
      return {
        checkName: `toolOrder: [${expectedSequence.join(", ")}]`,
        pass: false,
        reason: `Tool order not matched. Expected sequence: [${expectedSequence.join(
          ", "
        )}]. Actual call sequence: [${calls.map((c) => c.name).join(", ")}]`,
      };
    }
    return { checkName: `toolOrder: [${expectedSequence.join(", ")}]`, pass: true };
  }

  // 6. maxToolCalls
  if (check.maxToolCalls !== undefined) {
    if (calls.length > check.maxToolCalls) {
      return {
        checkName: `maxToolCalls: ${check.maxToolCalls}`,
        pass: false,
        reason: `Total tool calls (${calls.length}) exceeded maximum (${check.maxToolCalls})`,
      };
    }
    return { checkName: `maxToolCalls: ${check.maxToolCalls}`, pass: true };
  }

  // 7. noToolError
  if (check.noToolError !== undefined && check.noToolError) {
    const erroredCalls = calls.filter((c) => c.isError === true);
    if (erroredCalls.length > 0) {
      return {
        checkName: "noToolError: true",
        pass: false,
        reason: `Tool call(s) failed with error: [${erroredCalls
          .map((c) => `${c.name}: ${JSON.stringify(c.result)}`)
          .join("; ")}]`,
      };
    }
    return { checkName: "noToolError: true", pass: true };
  }

  // 8. argsNeverContain
  if (check.argsNeverContain !== undefined) {
    const forbiddenLower = check.argsNeverContain.map((s) => s.toLowerCase());
    for (const call of calls) {
      if (containsForbiddenString(call.args, forbiddenLower)) {
        return {
          checkName: `argsNeverContain: [${check.argsNeverContain.join(", ")}]`,
          pass: false,
          reason: `Tool call "${call.name}" arguments contained forbidden content. Args: ${JSON.stringify(
            call.args
          )}`,
        };
      }
    }
    return {
      checkName: `argsNeverContain: [${check.argsNeverContain.join(", ")}]`,
      pass: true,
    };
  }

  // 9. answerContains
  if (check.answerContains !== undefined) {
    const target = check.answerContains.toLowerCase();
    const actual = (transcript.finalText || "").toLowerCase();
    if (!actual.includes(target)) {
      return {
        checkName: `answerContains: "${check.answerContains}"`,
        pass: false,
        reason: `Final answer did not contain "${check.answerContains}". Actual answer: "${transcript.finalText}"`,
      };
    }
    return { checkName: `answerContains: "${check.answerContains}"`, pass: true };
  }

  // 10. answerMatches
  if (check.answerMatches !== undefined) {
    try {
      const regex = new RegExp(check.answerMatches, "i");
      if (!regex.test(transcript.finalText || "")) {
        return {
          checkName: `answerMatches: /${check.answerMatches}/`,
          pass: false,
          reason: `Final answer did not match regex /${check.answerMatches}/. Actual answer: "${transcript.finalText}"`,
        };
      }
      return { checkName: `answerMatches: /${check.answerMatches}/`, pass: true };
    } catch (e: unknown) {
      return {
        checkName: `answerMatches: /${check.answerMatches}/`,
        pass: false,
        reason: `Invalid regex pattern: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  }

  // 11. goldenAnswer
  if (check.goldenAnswer !== undefined) {
    const goldenCfg =
      typeof check.goldenAnswer === "string"
        ? { file: check.goldenAnswer, match: "similarity" as const, threshold: 0.75 }
        : check.goldenAnswer;

    let expectedText = goldenCfg.text;
    if (!expectedText && goldenCfg.file && resolvedGolden) {
      expectedText = resolvedGolden[goldenCfg.file];
    }

    if (!expectedText) {
      return {
        checkName: "goldenAnswer",
        pass: false,
        reason: `Golden answer reference could not be resolved: ${goldenCfg.file || "no text"}`,
      };
    }

    const matchMode = goldenCfg.match ?? "similarity";
    const actualText = transcript.finalText || "";

    if (matchMode === "exact") {
      const pass = actualText.trim() === expectedText.trim();
      return {
        checkName: "goldenAnswer (exact)",
        pass,
        reason: pass ? undefined : "Final answer did not match golden answer exactly.",
        goldenExpected: expectedText,
        actualReceived: actualText,
      };
    }

    if (matchMode === "contains") {
      const pass = actualText.toLowerCase().includes(expectedText.toLowerCase().trim());
      return {
        checkName: "goldenAnswer (contains)",
        pass,
        reason: pass ? undefined : "Final answer did not contain expected golden text.",
        goldenExpected: expectedText,
        actualReceived: actualText,
      };
    }

    if (matchMode === "regex") {
      try {
        const regex = new RegExp(expectedText, goldenCfg.ignoreCase !== false ? "i" : "");
        const pass = regex.test(actualText);
        return {
          checkName: "goldenAnswer (regex)",
          pass,
          reason: pass ? undefined : `Final answer did not match regex /${expectedText}/.`,
          goldenExpected: expectedText,
          actualReceived: actualText,
        };
      } catch (err) {
        return {
          checkName: "goldenAnswer (regex)",
          pass: false,
          reason: `Invalid regex pattern in golden answer: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    }

    // Default: "similarity"
    const threshold = goldenCfg.threshold ?? 0.75;
    const score = computeTextSimilarity(actualText, expectedText);
    const pass = score >= threshold;
    return {
      checkName: `goldenAnswer (similarity: ${(score * 100).toFixed(0)}% >= ${(threshold * 100).toFixed(0)}%)`,
      pass,
      score,
      reason: pass
        ? undefined
        : `Answer similarity score of ${(score * 100).toFixed(1)}% is below threshold of ${(threshold * 100).toFixed(1)}%.`,
      goldenExpected: expectedText,
      actualReceived: actualText,
    };
  }

  return { checkName: "unknown-check", pass: true };
}

/**
 * Runs all expect checks for a case against a transcript.
 */
export function evaluateAllChecks(
  checks: EvalCheckConfig[],
  transcript: Transcript,
  resolvedGolden?: Record<string, string>
): {
  passed: boolean;
  results: CheckResult[];
  failedChecks: CheckResult[];
} {
  const results = checks.map((c) => evaluateCheck(c, transcript, resolvedGolden));
  const failedChecks = results.filter((r) => !r.pass);
  return {
    passed: failedChecks.length === 0,
    results,
    failedChecks,
  };
}
