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
}

/**
 * Checks whether an argument value satisfies the expected criteria.
 * Supports special wildcard keywords: 'any-string', 'any-number', 'any'.
 */
function matchesValue(actual: unknown, expected: unknown): boolean {
  if (expected === "any-string") {
    return typeof actual === "string";
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
 * Executes a single check against a transcript.
 */
export function evaluateCheck(check: EvalCheckConfig, transcript: Transcript): CheckResult {
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

    return { checkName: `toolCalled: ${target}`, pass: true };
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

  return { checkName: "unknown-check", pass: true };
}

/**
 * Runs all expect checks for a case against a transcript.
 */
export function evaluateAllChecks(
  checks: EvalCheckConfig[],
  transcript: Transcript
): {
  passed: boolean;
  results: CheckResult[];
  failedChecks: CheckResult[];
} {
  const results = checks.map((c) => evaluateCheck(c, transcript));
  const failedChecks = results.filter((r) => !r.pass);
  return {
    passed: failedChecks.length === 0,
    results,
    failedChecks,
  };
}
