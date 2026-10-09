import fs from "node:fs/promises";
import path from "node:path";
import type { RunResult, RunSummary } from "@/client/fork/evals/engine/verdict";

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
  mcpName?: string;
  evalName?: string;
  goldenFilesCount?: number;
}

export interface SuiteDetail extends SuiteMeta {
  goldenFiles?: Record<string, string>;
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

  private async findYamlFiles(dir: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const results: string[] = [];
      for (const entry of entries) {
        if (
          entry.name.startsWith(".") ||
          entry.name === "node_modules" ||
          entry.name === "runs" ||
          entry.name === "golden"
        ) {
          continue;
        }
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results.push(...(await this.findYamlFiles(full)));
        } else if (
          entry.isFile() &&
          (entry.name.endsWith(".yaml") || entry.name.endsWith(".yml"))
        ) {
          results.push(full);
        }
      }
      return results;
    } catch {
      return [];
    }
  }

  private async countGoldenFiles(suiteDir: string): Promise<number> {
    try {
      const goldenDir = path.join(suiteDir, "golden");
      const entries = await fs.readdir(goldenDir);
      return entries.filter((f) => !f.startsWith(".")).length;
    } catch {
      return 0;
    }
  }

  async listSuites(): Promise<SuiteMeta[]> {
    await this.init();
    const suiteFiles = await this.findYamlFiles(this.baseDir);
    const suites: SuiteMeta[] = [];

    for (const fullPath of suiteFiles) {
      try {
        const content = await fs.readFile(fullPath, "utf-8");
        const stat = await fs.stat(fullPath);
        const nameMatch = content.match(/^name:\s*(.+)$/m);

        const suiteDir = path.dirname(fullPath);
        const relDir = path.relative(this.baseDir, suiteDir);
        const filename = path.basename(fullPath);
        const filenameNoExt = filename.replace(/\.ya?ml$/, "");

        let id = filenameNoExt;
        let mcpName: string | undefined;
        let evalName: string | undefined;

        if (relDir && relDir !== "suites" && relDir !== ".") {
          const parts = relDir.split(path.sep);
          if (parts.length >= 2) {
            mcpName = parts[0];
            evalName = parts[1];
            id = `${mcpName}/${evalName}`;
          } else if (parts.length === 1) {
            mcpName = parts[0];
            id = `${mcpName}/${filenameNoExt}`;
          }
        }

        const name = nameMatch ? nameMatch[1].trim().replace(/^['"]|['"]$/g, "") : id;
        const caseMatches = content.match(/^\s*-\s*id:\s*(.+)$/gm);
        const caseCount = caseMatches ? caseMatches.length : 0;
        const goldenFilesCount = await this.countGoldenFiles(suiteDir);

        suites.push({
          id,
          name,
          yaml: content,
          caseCount,
          updatedAt: stat.mtimeMs,
          mcpName,
          evalName,
          goldenFilesCount,
        });
      } catch {
        // Skip unreadable files
      }
    }

    return suites.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async findSuiteFilePath(id: string): Promise<string | null> {
    await this.init();
    const cleanId = id.replace(/^[/\\]+/, "").replace(/\.\./g, "");

    // 1. Check flat path in suitesDir
    const flatYaml = path.join(this.suitesDir, `${cleanId}.yaml`);
    try {
      await fs.access(flatYaml);
      return flatYaml;
    } catch {}

    const flatYml = path.join(this.suitesDir, `${cleanId}.yml`);
    try {
      await fs.access(flatYml);
      return flatYml;
    } catch {}

    // 2. Check modular path: <cleanId>/<evalName>.yaml or <cleanId>.yaml
    const parts = cleanId.split(/[/\\]/);
    if (parts.length >= 2) {
      const evalName = parts[parts.length - 1];
      const modularYaml = path.join(this.baseDir, cleanId, `${evalName}.yaml`);
      try {
        await fs.access(modularYaml);
        return modularYaml;
      } catch {}

      const modularYml = path.join(this.baseDir, cleanId, `${evalName}.yml`);
      try {
        await fs.access(modularYml);
        return modularYml;
      } catch {}
    }

    // 3. Fallback search across all suite files
    const all = await this.findYamlFiles(this.baseDir);
    for (const f of all) {
      const rel = path.relative(this.baseDir, f).replace(/\.ya?ml$/, "");
      if (rel === cleanId || path.basename(rel) === cleanId) {
        return f;
      }
    }

    return null;
  }

  async getSuite(id: string): Promise<string | null> {
    const filePath = await this.findSuiteFilePath(id);
    if (!filePath) return null;
    try {
      return await fs.readFile(filePath, "utf-8");
    } catch {
      return null;
    }
  }

  async getGoldenFilesForSuite(suiteId: string): Promise<Record<string, string>> {
    const suitePath = await this.findSuiteFilePath(suiteId);
    if (!suitePath) return {};

    const suiteDir = path.dirname(suitePath);
    const goldenDir = path.join(suiteDir, "golden");
    const result: Record<string, string> = {};

    try {
      const entries = await fs.readdir(goldenDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && !entry.name.startsWith(".")) {
          const fullPath = path.join(goldenDir, entry.name);
          const relKey = `golden/${entry.name}`;
          try {
            const data = await fs.readFile(fullPath, "utf-8");
            result[relKey] = data;
            result[entry.name] = data;
          } catch {}
        }
      }
    } catch {
      // Golden directory does not exist or empty
    }

    return result;
  }

  async getGoldenFile(suiteId: string, relPath: string): Promise<string | null> {
    const suitePath = await this.findSuiteFilePath(suiteId);
    if (!suitePath) return null;

    const suiteDir = path.dirname(suitePath);
    const target = path.resolve(suiteDir, relPath);
    if (!target.startsWith(suiteDir)) return null;

    try {
      return await fs.readFile(target, "utf-8");
    } catch {
      return null;
    }
  }

  async getSuiteDetail(id: string): Promise<SuiteDetail | null> {
    const filePath = await this.findSuiteFilePath(id);
    if (!filePath) return null;

    try {
      const content = await fs.readFile(filePath, "utf-8");
      const stat = await fs.stat(filePath);
      const nameMatch = content.match(/^name:\s*(.+)$/m);
      const suiteDir = path.dirname(filePath);
      const relDir = path.relative(this.baseDir, suiteDir);
      const parts = relDir.split(path.sep);

      let mcpName: string | undefined;
      let evalName: string | undefined;
      if (parts.length >= 2) {
        mcpName = parts[0];
        evalName = parts[1];
      }

      const caseMatches = content.match(/^\s*-\s*id:\s*(.+)$/gm);
      const goldenFiles = await this.getGoldenFilesForSuite(id);

      return {
        id,
        name: nameMatch ? nameMatch[1].trim().replace(/^['"]|['"]$/g, "") : id,
        yaml: content,
        caseCount: caseMatches ? caseMatches.length : 0,
        updatedAt: stat.mtimeMs,
        mcpName,
        evalName,
        goldenFilesCount: await this.countGoldenFiles(suiteDir),
        goldenFiles,
      };
    } catch {
      return null;
    }
  }

  async saveSuite(id: string, yamlContent: string): Promise<void> {
    await this.init();
    const cleanId = id.replace(/^[/\\]+/, "").replace(/\.\./g, "");
    if (cleanId.includes("/") || cleanId.includes("\\")) {
      const parts = cleanId.split(/[/\\]/);
      const targetDir = path.join(this.baseDir, cleanId);
      await fs.mkdir(targetDir, { recursive: true });
      const evalName = parts[parts.length - 1];
      const filePath = path.join(targetDir, `${evalName}.yaml`);
      await fs.writeFile(filePath, yamlContent, "utf-8");
    } else {
      const filePath = path.join(this.suitesDir, `${cleanId}.yaml`);
      await fs.writeFile(filePath, yamlContent, "utf-8");
    }
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
