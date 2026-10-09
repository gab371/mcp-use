import fs from "node:fs/promises";
import path from "node:path";
import { MCPClient } from "@mcp-use/client";
import { parseSuiteYaml } from "@/client/fork/evals/engine/suite";
import { runCase } from "@/client/fork/evals/engine/run-case";
import { evaluateIteration, computeCaseVerdict, computeRunResult } from "@/client/fork/evals/engine/verdict";
import { hashToolsSnapshot } from "@/client/fork/evals/engine/snapshot";
import type { IterationResult } from "@/client/fork/evals/engine/verdict";

function parseArgs(args: string[]) {
  const result: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith("--")) {
        result[key] = next;
        i++;
      } else {
        result[key] = "true";
      }
    }
  }
  return result;
}

export async function runCli(argv = process.argv.slice(2)): Promise<number> {
  const flags = parseArgs(argv);

  if (flags.help || !flags.suite || !flags.url) {
    console.log(`
Usage: mcp-evals --suite <suite.yaml> --url <mcp-url> [options]

Options:
  --suite <path>       Path to suite YAML file (required)
  --url <url>          MCP server URL to evaluate (required)
  --model <model>      Model identifier (default: gpt-4o)
  --provider <prov>    LLM provider: openai, anthropic, ollama, etc. (default: openai)
  --api-key <key>      API key for LLM provider (or use env vars)
  --base-url <url>     Base URL for OpenAI-compatible providers
  --output <path>      Save run output JSON to path
  --iterations <N>     Override iteration count
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

  // 2. Setup connection
  const runId = `eval-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  let mcpClient: MCPClient;
  try {
    mcpClient = new MCPClient({
      url: flags.url,
      headers: {
        "x-eval-run-id": runId,
      },
    });
    // Initialize & discover tools
    await mcpClient.initialize();
  } catch (err: unknown) {
    console.error(`[Error] Setup/connection to MCP server failed: ${err instanceof Error ? err.message : String(err)}`);
    return 3;
  }

  // Snapshot tools
  const toolsList = mcpClient.tools || [];
  const snapshotHash = hashToolsSnapshot(toolsList);

  console.log(`\n🚀 Starting Eval Run: ${suite.name} (Run ID: ${runId})`);
  console.log(`Target: ${flags.url} (${toolsList.length} tools discovered, snapshot hash: ${snapshotHash})`);
  console.log(`Model: ${flags.provider || "openai"}:${flags.model || "gpt-4o"}\n`);

  const startedAt = Date.now();
  const caseResults = [];

  const llmConfig = {
    provider: flags.provider || process.env.LLM_PROVIDER || "openai",
    model: flags.model || process.env.LLM_MODEL || "gpt-4o",
    apiKey: flags.apiKey || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY,
    baseUrl: flags.baseUrl || process.env.OPENAI_BASE_URL,
  };

  for (const caseDef of suite.cases) {
    const iterationsCount = flags.iterations
      ? parseInt(flags.iterations, 10)
      : caseDef.iterations ?? suite.defaults?.iterations ?? 1;

    console.log(`▶ Case [${caseDef.id}] (running ${iterationsCount} iteration(s))...`);
    const iterations: IterationResult[] = [];

    for (let iter = 0; iter < iterationsCount; iter++) {
      const transcript = await runCase(caseDef, mcpClient, llmConfig, suite.defaults, {
        runId,
      });
      const iterResult = evaluateIteration(iter, caseDef, transcript);
      iterations.push(iterResult);

      const mark = iterResult.status === "passed" ? "✓" : iterResult.status === "inconclusive" ? "?" : "✗";
      process.stdout.write(`  [${iter + 1}/${iterationsCount}] ${mark} `);
      if (iterResult.failedChecks.length > 0) {
        process.stdout.write(`failed: ${iterResult.failedChecks.map((f) => f.checkName).join(", ")}`);
      }
      process.stdout.write("\n");
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
  console.log(`Duration: ${(runResult.performance.totalDurationMs / 1000).toFixed(1)}s`);
  console.log(`═══════════════════════════════════════\n`);

  if (runResult.status === "passed") return 0;
  if (runResult.status === "failed") return 1;
  return 4; // inconclusive
}

if (process.argv[1] && process.argv[1].endsWith("cli.ts")) {
  runCli().then((code) => process.exit(code));
}
