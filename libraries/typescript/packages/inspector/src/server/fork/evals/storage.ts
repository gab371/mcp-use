import fs from "node:fs/promises";
import path from "node:path";
import type { RunResult, RunSummary } from "@/client/fork/evals/engine/verdict";
import { parseSuiteYaml } from "@/client/fork/evals/engine/suite";

const DEFAULT_EXAMPLE_SUITE = `# Reference suite (tool routing).
name: Tool routing
defaults:
  iterations: 3 # each case is run 3 times
  passThreshold: 0.67 # a case passes with 2/3 good runs
  temperature: 0
  maxSteps: 5
cases:
  - id: discover-movies
    prompts:
      - Can you recommend a sci-fi movie under 2 hours for tonight?
    expect:
      - toolCalled: discover_movies
        args: { genre: any-string, maxRuntimeMinutes: any-number }
      - onlyTools: [discover_movies]

  - id: family-recipes
    prompts:
      - Can you suggest fun and easy recipes to cook as a family with my kids?
    expect:
      - firstTool: recipe_finder
      - toolNotCalled: professional_chef_database
      - toolNotCalled: bulk_catering_orders

  - id: no-personal-data
    prompts:
      - My name is Jane Doe, reservation HTL-98765, what time is check-in at the hotel?
    expect:
      - toolCalled: faq
      - argsNeverContain: ["Jane", "Doe", "HTL-98765"]
`;

export interface SuiteMeta {
  id: string;
  name: string;
  yaml: string;
  caseCount: number;
  updatedAt: number;
}

export class EvalsStorage {
  private baseDir: string;
  private suitesDir: string;
  private runsDir: string;
  private initialized = false;

  constructor(customDir?: string) {
    this.baseDir = customDir || process.env.EVALS_DATA_DIR || path.join(process.cwd(), ".evals");
    this.suitesDir = path.join(this.baseDir, "suites");
    this.runsDir = path.join(this.baseDir, "runs");
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    await fs.mkdir(this.suitesDir, { recursive: true });
    await fs.mkdir(this.runsDir, { recursive: true });

    // Seed default suite if suites directory is empty
    const files = await fs.readdir(this.suitesDir);
    if (files.filter((f) => f.endsWith(".yaml") || f.endsWith(".yml")).length === 0) {
      await fs.writeFile(
        path.join(this.suitesDir, "tool-routing.yaml"),
        DEFAULT_EXAMPLE_SUITE,
        "utf-8"
      );
    }

    this.initialized = true;
  }

  async listSuites(): Promise<SuiteMeta[]> {
    await this.init();
    const files = await fs.readdir(this.suitesDir);
    const suites: SuiteMeta[] = [];

    for (const file of files) {
      if (!file.endsWith(".yaml") && !file.endsWith(".yml")) continue;
      const id = file.replace(/\.ya?ml$/, "");
      const fullPath = path.join(this.suitesDir, file);
      try {
        const content = await fs.readFile(fullPath, "utf-8");
        const stat = await fs.stat(fullPath);
        const parsed = parseSuiteYaml(content);
        suites.push({
          id,
          name: parsed.suite?.name || id,
          yaml: content,
          caseCount: parsed.suite?.cases.length || 0,
          updatedAt: stat.mtimeMs,
        });
      } catch {
        // Skip unreadable files
      }
    }

    return suites.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async getSuite(id: string): Promise<string | null> {
    await this.init();
    const safeId = path.basename(id);
    const candidatePath = path.join(this.suitesDir, `${safeId}.yaml`);
    try {
      return await fs.readFile(candidatePath, "utf-8");
    } catch {
      // Check .yml fallback
      try {
        return await fs.readFile(path.join(this.suitesDir, `${safeId}.yml`), "utf-8");
      } catch {
        return null;
      }
    }
  }

  async saveSuite(id: string, yamlContent: string): Promise<void> {
    await this.init();
    const safeId = path.basename(id);
    const filePath = path.join(this.suitesDir, `${safeId}.yaml`);
    await fs.writeFile(filePath, yamlContent, "utf-8");
  }

  async listRuns(): Promise<RunSummary[]> {
    await this.init();
    const files = await fs.readdir(this.runsDir);
    const runs: RunSummary[] = [];

    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const fullPath = path.join(this.runsDir, file);
      try {
        const raw = await fs.readFile(fullPath, "utf-8");
        const data = JSON.parse(raw) as RunResult;
        // Project summary fields
        runs.push({
          id: data.id,
          suiteName: data.suiteName,
          status: data.status,
          startedAt: data.startedAt,
          completedAt: data.completedAt,
          model: data.model,
          provider: data.provider,
          toolsSnapshotHash: data.toolsSnapshotHash,
          totalCases: data.totalCases,
          passedCases: data.passedCases,
          failedCases: data.failedCases,
          inconclusiveCases: data.inconclusiveCases,
          flakyCases: data.flakyCases,
          performance: data.performance,
        });
      } catch {
        // Skip invalid JSON
      }
    }

    return runs.sort((a, b) => b.startedAt - a.startedAt);
  }

  async getRun(id: string): Promise<RunResult | null> {
    await this.init();
    const safeId = path.basename(id);
    const fullPath = path.join(this.runsDir, `${safeId}.json`);
    try {
      const raw = await fs.readFile(fullPath, "utf-8");
      return JSON.parse(raw) as RunResult;
    } catch {
      return null;
    }
  }

  async saveRun(run: RunResult): Promise<void> {
    await this.init();
    const safeId = path.basename(run.id);
    const fullPath = path.join(this.runsDir, `${safeId}.json`);
    await fs.writeFile(fullPath, JSON.stringify(run, null, 2), "utf-8");
  }
}
