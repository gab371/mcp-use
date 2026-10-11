import yaml from "yaml";
import { z } from "zod";

/**
 * Golden result expectation for a tool call.
 */
export const GoldenResultCheckSchema = z
  .object({
    tool: z.string().optional(),
    file: z.string().optional(),
    content: z.unknown().optional(),
    match: z.enum(["partial", "exact", "contains"]).optional().default("partial"),
  })
  .strict();

export type GoldenResultCheck = z.infer<typeof GoldenResultCheckSchema>;

/**
 * Golden answer expectation for the agent's final response.
 */
export const GoldenAnswerCheckSchema = z
  .object({
    file: z.string().optional(),
    text: z.string().optional(),
    match: z.enum(["similarity", "contains", "exact", "regex"]).optional().default("similarity"),
    threshold: z.number().min(0).max(1).optional().default(0.75),
    ignoreCase: z.boolean().optional().default(true),
  })
  .strict();

export type GoldenAnswerCheck = z.infer<typeof GoldenAnswerCheckSchema>;

/**
 * Expected check definition in a test case.
 * Unknown keys are strictly disallowed.
 */
export const EvalCheckSchema = z
  .object({
    toolCalled: z.string().optional(),
    args: z.record(z.string(), z.unknown()).optional(),
    match: z.enum(["partial", "exact"]).optional().default("partial"),
    goldenResult: z.union([z.string(), GoldenResultCheckSchema]).optional(),
    toolNotCalled: z.string().optional(),
    onlyTools: z.array(z.string()).optional(),
    firstTool: z.string().optional(),
    toolOrder: z.array(z.string()).optional(),
    maxToolCalls: z.number().int().nonnegative().optional(),
    noToolError: z.boolean().optional(),
    argsNeverContain: z.array(z.string()).optional(),
    answerContains: z.string().optional(),
    answerMatches: z.string().optional(),
    goldenAnswer: z.union([z.string(), GoldenAnswerCheckSchema]).optional(),
  })
  .strict();

export type EvalCheckConfig = z.infer<typeof EvalCheckSchema>;

/**
 * Defaults for cases within a suite.
 */
export const EvalSuiteDefaultsSchema = z
  .object({
    iterations: z.number().int().positive().optional().default(1),
    passThreshold: z.number().min(0).max(1).optional().default(1.0),
    temperature: z.number().min(0).max(2).optional().default(0),
    maxSteps: z.number().int().positive().optional().default(5),
    systemPrompt: z.string().optional(),
    timeoutMs: z.number().int().positive().optional(),
  })
  .strict();

export type EvalSuiteDefaults = z.infer<typeof EvalSuiteDefaultsSchema>;

/**
 * An individual evaluation case.
 */
export const EvalCaseSchema = z
  .object({
    id: z.string().min(1, "Case id must not be empty"),
    description: z.string().optional(),
    prompts: z
      .union([z.string().min(1), z.array(z.string().min(1))])
      .transform((val) => (Array.isArray(val) ? val : [val]))
      .optional(),
    promptFile: z.string().optional(),
    iterations: z.number().int().positive().optional(),
    passThreshold: z.number().min(0).max(1).optional(),
    temperature: z.number().min(0).max(2).optional(),
    maxSteps: z.number().int().positive().optional(),
    systemPrompt: z.string().optional(),
    timeoutMs: z.number().int().positive().optional(),
    expect: z.array(EvalCheckSchema).min(1, "Case must have at least one expect check"),
  })
  .strict()
  .refine(
    (val) => (val.prompts && val.prompts.length > 0) || Boolean(val.promptFile),
    { message: "Case must have either prompts or promptFile defined" }
  );

export type EvalCase = z.infer<typeof EvalCaseSchema>;

/**
 * Full eval suite schema.
 */
export const EvalSuiteSchema = z
  .object({
    name: z.string().min(1, "Suite name must not be empty"),
    description: z.string().optional(),
    defaults: EvalSuiteDefaultsSchema.optional(),
    cases: z.array(EvalCaseSchema).min(1, "Suite must contain at least one case"),
  })
  .strict();

export type EvalSuite = z.infer<typeof EvalSuiteSchema>;

export interface ParseSuiteResult {
  success: boolean;
  suite?: EvalSuite;
  error?: string;
  issues?: Array<{ path: string; message: string }>;
}

/**
 * Parses and validates an eval suite from YAML text.
 * Rejects unknown keys with a clear path and explanation.
 */
export function parseSuiteYaml(yamlText: string): ParseSuiteResult {
  if (!yamlText || !yamlText.trim()) {
    return {
      success: false,
      error: "Suite YAML content is empty",
      issues: [{ path: "", message: "Content is empty" }],
    };
  }

  let rawData: unknown;
  try {
    rawData = yaml.parse(yamlText);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: `YAML syntax error: ${message}`,
      issues: [{ path: "", message }],
    };
  }

  if (typeof rawData !== "object" || rawData === null) {
    return {
      success: false,
      error: "Suite YAML must represent an object mapping",
      issues: [{ path: "", message: "Root must be an object" }],
    };
  }

  const result = EvalSuiteSchema.safeParse(rawData);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => {
      const pathStr = issue.path.join(".");
      return {
        path: pathStr,
        message: issue.message,
      };
    });
    const summary = issues.map((i) => (i.path ? `${i.path}: ${i.message}` : i.message)).join("; ");
    return {
      success: false,
      error: `Suite validation error: ${summary}`,
      issues,
    };
  }

  return {
    success: true,
    suite: result.data,
  };
}

/**
 * Injects a new expectation into a specific test case in the suite YAML,
 * preserving formatting and existing structure.
 */
export function addExpectationToSuiteYaml(
  yamlText: string,
  caseId: string,
  expectation: Record<string, unknown>
): string {
  const doc = yaml.parseDocument(yamlText);
  const cases = doc.get("cases");
  if (cases && typeof (cases as any).items === "object") {
    for (const item of (cases as any).items) {
      if (item && typeof item.get === "function" && item.get("id") === caseId) {
        const expect = item.get("expect");
        if (!expect) {
          item.set("expect", [expectation]);
        } else if (typeof (expect as any).add === "function") {
          (expect as any).add(expectation);
        }
        return doc.toString();
      }
    }
  }
  return yamlText;
}
