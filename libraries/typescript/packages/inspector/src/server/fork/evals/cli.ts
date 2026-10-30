import { createRequire } from "node:module";
import fs from "node:fs/promises";
import path from "node:path";
import { parseSuiteYaml } from "@/client/fork/evals/engine/suite";
import { runCase } from "@/client/fork/evals/engine/run-case";
import { evaluateIteration, computeCaseVerdict, computeRunResult } from "@/client/fork/evals/engine/verdict";
import { hashToolsSnapshot } from "@/client/fork/evals/engine/snapshot";
import type { IterationResult, CaseVerdict } from "@/client/fork/evals/engine/verdict";
import type { EvalSuite } from "@/client/fork/evals/engine/suite";

// In ESM bundles, inlined CommonJS dependencies (like `yaml`) may expect `require`.
const scope = globalThis as { require?: NodeJS.Require };
scope.require ??= createRequire(import.meta.url);

// Loaded at runtime, not bundled: the Node build of `@mcp-use/client` imports
// its stdio transport, and bundling that (cross-spawn) into dist/cli.js breaks
// both the ESM bin ("Dynamic require of child_process") and the shebang check
// in scripts/verify-package.mjs. A non-literal specifier keeps tsup from inlining it.
const MCP_USE_CLIENT = ["@mcp-use", "client"].join("/");
function loadMcpUseClient(): Promise<typeof import("@mcp-use/client")> {
  return import(MCP_USE_CLIENT);
}

interface ParsedArgs {
  help: boolean;
  suite?: string;
  url?: string;
  model: string;
  provider: string;
  apiKey?: string;
  baseUrl?: string;
  output?: string;
  iterations?: number;
  headers: Record<string, string>;
}

function parseArgs(args: string[]): ParsedArgs {
  const result: ParsedArgs = {
    help: false,
    model: process.env.LLM_MODEL || "gpt-4o",
    provider: process.env.LLM_PROVIDER || "openai",
    apiKey: process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.GOOGLE_API_KEY,
    baseUrl: process.env.OPENAI_BASE_URL,
    headers: {},
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") {
      result.help = true;
    } else if (arg === "--suite") {
      result.suite = args[++i];
    } else if (arg === "--url") {
      result.url = args[++i];
    } else if (arg === "--model") {
      result.model = args[++i];
    } else if (arg === "--provider") {
      result.provider = args[++i];
    } else if (arg === "--api-key") {
      result.apiKey = args[++i];
    } else if (arg === "--base-url") {
      result.baseUrl = args[++i];
    } else if (arg === "--output") {
      result.output = args[++i];
    } else if (arg === "--iterations") {
      const val = parseInt(args[++i], 10);
      if (!Number.isNaN(val) && val > 0) result.iterations = val;
    } else if (arg === "--header") {
      const headerStr = args[++i];
      if (headerStr) {
        const eq = headerStr.indexOf("=");
        if (eq > 0) {
          result.headers[headerStr.slice(0, eq).trim()] = headerStr.slice(eq + 1).trim();
        }
      }
    }
  }

  return result;
}

/**
 * Loads golden files located in a `golden/` folder next to the suite YAML
 * or referenced relative to the suite directory.
 */
async function loadGoldenFiles(suitePath: string, suite: EvalSuite): Promise<Record<string, string>> {
  const suiteDir = path.dirname(path.resolve(suitePath));
  const result: Record<string, string> = {};

  const goldenDir = path.join(suiteDir, "golden");
  try {
    const entries = await fs.readdir(goldenDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && !entry.name.startsWith(".")) {
        const data = await fs.readFile(path.join(goldenDir, entry.name), "utf-8");
        result[`golden/${entry.name}`] = data;
        result[entry.name] = data;
      }
    }
  } catch {
    // No golden directory
  }

  for (const c of suite.cases) {
    if (c.promptFile && !(c.promptFile in result)) {
      try {
        result[c.promptFile] = await fs.readFile(path.resolve(suiteDir, c.promptFile), "utf-8");
      } catch {}
    }
    for (const check of c.expect) {
      const goldenAnswerFile = typeof check.goldenAnswer === "string" ? check.goldenAnswer : check.goldenAnswer?.file;
      if (goldenAnswerFile && !(goldenAnswerFile in result)) {
        try {
          result[goldenAnswerFile] = await fs.readFile(path.resolve(suiteDir, goldenAnswerFile), "utf-8");
        } catch {}
      }
      const goldenResultFile = typeof check.goldenResult === "string" ? check.goldenResult : check.goldenResult?.file;
      if (goldenResultFile && !(goldenResultFile in result)) {
        try {
          result[goldenResultFile] = await fs.readFile(path.resolve(suiteDir, goldenResultFile), "utf-8");
        } catch {}
      }
    }
  }

  return result;
}

export async function runCli(argv = process.argv.slice(2)): Promise<number> {
  const flags = parseArgs(argv);

  if (flags.help || !flags.suite || !flags.url) {
    console.log(`
Usage: mcp-inspect evals --suite <suite.yaml> --url <mcp-url> [options]

Options:
  --suite <path>       Path to suite YAML file (required)
  --url <url>          MCP server URL to evaluate (required)
  --model <model>      Model identifier (default: gpt-4o)
  --provider <prov>    LLM provider: openai, anthropic, ollama, etc. (default: openai)
  --api-key <key>      API key for LLM provider (or use env vars)
  --base-url <url>     Base URL for OpenAI-compatible providers
  --output <path>      Save run output JSON to path
  --iterations <N>     Override iteration count
  --header <k=v>       Custom HTTP header for the MCP connection (repeatable)
  -h, --help           Show this help message
    `);
    return flags.help ? 0 : 2;
  }

  // 1. Read & parse suite
  let yamlContent: string;
  try {
    yamlContent = await fs.readFile(flags.suite, "utf-8");
  } catch (err: unknown) {
    console.error(`[Error] Could not read suite file: ${err instanceof Error ? err.message : String(err)}`);
    return 2;
  }

  const parsed = parseSuiteYaml(yamlContent);
  if (!parsed.success || !parsed.suite) {
    console.error(`[Error] Invalid suite format: ${parsed.error}`);
    return 2;
  }
  const suite = parsed.suite;

  // Load any golden assets
  const goldenAssets = await loadGoldenFiles(flags.suite, suite);

  // 2. Setup connection using runtime-loaded client
  const { HttpConnector } = await loadMcpUseClient();
  const runId = `eval-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const headers: Record<string, string> = {
    "x-eval-run-id": runId,
    ...flags.headers,
  };

  let connector: InstanceType<typeof HttpConnector>;
  try {
    connector = new HttpConnector(flags.url, { headers });
    await connector.connect();
  } catch (err: unknown) {
    console.error(`[Error] Setup/connection to MCP server failed: ${err instanceof Error ? err.message : String(err)}`);
    return 3;
  }

  try {
    const toolsList = connector.tools || [];
    const snapshotHash = hashToolsSnapshot(toolsList);

    console.log(`\n🚀 Starting Eval Run: ${suite.name} (Run ID: ${runId})`);
    console.log(`Target: ${flags.url} (${toolsList.length} tools discovered, snapshot hash: ${snapshotHash})`);
    console.log(`Model: ${flags.provider}:${flags.model}\n`);

    const startedAt = Date.now();
    const caseResults: CaseVerdict[] = [];

    const llmConfig = {
      provider: flags.provider,
      model: flags.model,
      apiKey: flags.apiKey,
      baseUrl: flags.baseUrl,
    };

    for (const caseDef of suite.cases) {
      const iterationsCount = flags.iterations ?? caseDef.iterations ?? suite.defaults?.iterations ?? 1;

      console.log(`▶ Case [${caseDef.id}] (running ${iterationsCount} iteration(s))...`);
      const iterations: IterationResult[] = [];

      for (let iter = 0; iter < iterationsCount; iter++) {
        const transcript = await runCase(caseDef, connector, llmConfig, suite.defaults, {
          runId,
          resolvedGolden: goldenAssets,
        });
        const iterResult = evaluateIteration(iter, caseDef, transcript, goldenAssets);
        iterations.push(iterResult);

        const mark = iterResult.status === "passed" ? "✓" : iterResult.status === "inconclusive" ? "?" : "✗";
        let line = `  [${iter + 1}/${iterationsCount}] ${mark} `;
        if (iterResult.failedChecks.length > 0) {
          line += `failed: ${iterResult.failedChecks.map((f) => f.checkName).join(", ")}`;
        } else if (iterResult.error) {
          line += `error: ${iterResult.error}`;
        }
        console.log(line);
      }

      const caseVerdict = computeCaseVerdict(caseDef, iterations, suite.defaults);
      caseResults.push(caseVerdict);

      const verdictLabel =
        caseVerdict.status === "passed"
          ? "PASSED"
          : caseVerdict.status === "inconclusive"
          ? "INCONCLUSIVE"
          : "FAILED";
      console.log(
        `  -> Result: ${verdictLabel} (Pass rate: ${(caseVerdict.passRate * 100).toFixed(0)}%)${
          caseVerdict.isFlaky ? " [FLAKY]" : ""
        }\n`
      );
    }

    const completedAt = Date.now();
    const runResult = computeRunResult({
      runId,
      suiteName: suite.name,
      caseResults,
      startedAt,
      completedAt,
      model: llmConfig.model,
      provider: llmConfig.provider,
      toolsSnapshot: toolsList,
      toolsSnapshotHash: snapshotHash,
    });

    if (flags.output) {
      try {
        const outDir = path.dirname(flags.output);
        await fs.mkdir(outDir, { recursive: true });
        await fs.writeFile(flags.output, JSON.stringify(runResult, null, 2), "utf-8");
        console.log(`\n💾 Saved run report to ${flags.output}`);
      } catch (err: unknown) {
        console.warn(`[Warning] Failed to write output file: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    console.log(`\n═══════════════════════════════════════`);
    console.log(`VERDICT: ${runResult.status.toUpperCase()}`);
    console.log(
      `Cases: ${runResult.passedCases}/${runResult.totalCases} passed (${runResult.failedCases} failed, ${runResult.flakyCases} flaky, ${runResult.inconclusiveCases} inconclusive)`
    );
    console.log(`Tokens: ${runResult.performance.totalTokens} total`);
    console.log(`Duration: ${(runResult.performance.totalDurationMs / 1000).toFixed(1)}s`);
    console.log(`═══════════════════════════════════════\n`);

    if (runResult.status === "passed") return 0;
    if (runResult.status === "failed") return 1;
    return 4; // inconclusive
  } finally {
    await connector.disconnect().catch(() => {});
  }
}

if (process.argv[1] && process.argv[1].endsWith("cli.ts")) {
  runCli().then((code) => process.exit(code));
}
