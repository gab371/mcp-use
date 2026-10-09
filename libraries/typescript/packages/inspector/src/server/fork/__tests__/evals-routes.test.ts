import { describe, expect, it, beforeEach } from "vitest";
import { Hono } from "hono";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { EvalsStorage } from "../evals/storage";
import { createEvalRoutes } from "../evals/routes";
import type { RunResult } from "@/client/fork/evals/engine/verdict";

describe("evals server routes and storage", () => {
  let tmpDir: string;
  let storage: EvalsStorage;
  let app: Hono;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "evals-test-"));
    storage = new EvalsStorage(tmpDir);
    await storage.init();
    app = new Hono();
    app.route("/api", createEvalRoutes(storage));
  });

  it("lists seeded default suite", async () => {
    const res = await app.request("/api/suites");
    expect(res.status).toBe(200);
    const data = await res.json<{ suites: Array<{ id: string; name: string }> }>();
    expect(data.suites.length).toBeGreaterThan(0);
    expect(data.suites.some((s) => s.id === "tool-routing")).toBe(true);
  });

  it("gets and saves suite drafts", async () => {
    const saveRes = await app.request("/api/suites/custom-draft", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        yaml: "name: Custom Draft\ncases:\n  - id: c1\n    prompts: test\n    expect:\n      - noToolError: true\n",
      }),
    });
    expect(saveRes.status).toBe(200);

    const getRes = await app.request("/api/suites/custom-draft");
    expect(getRes.status).toBe(200);
    const data = await getRes.json<{ id: string; yaml: string }>();
    expect(data.id).toBe("custom-draft");
    expect(data.yaml).toContain("Custom Draft");
  });

  it("saves and retrieves runs", async () => {
    const mockRun: RunResult = {
      id: "run-test-1",
      suiteName: "Tool routing",
      status: "passed",
      startedAt: 1000,
      completedAt: 2000,
      model: "gpt-4o",
      provider: "openai",
      toolsSnapshotHash: "abc12345",
      totalCases: 1,
      passedCases: 1,
      failedCases: 0,
      inconclusiveCases: 0,
      flakyCases: 0,
      performance: {
        totalDurationMs: 1000,
        totalToolCalls: 2,
        totalTokens: 150,
      },
      caseResults: [],
    };

    const postRes = await app.request("/api/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mockRun),
    });
    expect(postRes.status).toBe(200);

    const listRes = await app.request("/api/runs");
    expect(listRes.status).toBe(200);
    const listData = await listRes.json<{ runs: any[] }>();
    expect(listData.runs.length).toBe(1);
    expect(listData.runs[0].id).toBe("run-test-1");

    const getRes = await app.request("/api/runs/run-test-1");
    expect(getRes.status).toBe(200);
    const getData = await getRes.json<{ run: RunResult }>();
    expect(getData.run.id).toBe("run-test-1");
    expect(getData.run.status).toBe("passed");
  });

  it("handles modular suites and golden asset resolution", async () => {
<<<<<<< HEAD
    // Create modular structure in tmpDir: demo/attractions/attractions.yaml + golden/explorer.result.json
    const suiteDir = path.join(tmpDir, "demo", "attractions");
=======
    // Create modular structure in tmpDir: suites/demo/attractions/attractions.yaml + golden/explorer.result.json
    const suiteDir = path.join(tmpDir, "suites", "demo", "attractions");
>>>>>>> 66d51038 (feat(evals): relocate modular suites to .evals/suites/ and add golden asset UI editing & 1-click capture)
    const goldenDir = path.join(suiteDir, "golden");
    await fs.mkdir(goldenDir, { recursive: true });

    const modularYaml = `name: Demo Attractions Modular\ncases:\n  - id: kids\n    prompts: test\n    expect:\n      - noToolError: true\n`;
    await fs.writeFile(path.join(suiteDir, "attractions.yaml"), modularYaml, "utf-8");

    const goldenJson = JSON.stringify({ items: [{ name: "Adventure Tour" }] });
    await fs.writeFile(path.join(goldenDir, "explorer.result.json"), goldenJson, "utf-8");

    // 1. Check listSuites
    const listRes = await app.request("/api/suites");
    expect(listRes.status).toBe(200);
    const listData = await listRes.json<{ suites: any[] }>();
    const found = listData.suites.find((s) => s.id === "demo/attractions");
    expect(found).toBeDefined();
    expect(found.mcpName).toBe("demo");
    expect(found.evalName).toBe("attractions");
    expect(found.goldenFilesCount).toBe(1);

    // 2. Check getSuiteDetail
    const detailRes = await app.request("/api/suites/demo/attractions");
    expect(detailRes.status).toBe(200);
    const detail = await detailRes.json<{ id: string; goldenFiles: Record<string, string> }>();
    expect(detail.id).toBe("demo/attractions");
    expect(detail.goldenFiles["golden/explorer.result.json"]).toBe(goldenJson);
    expect(detail.goldenFiles["explorer.result.json"]).toBe(goldenJson);

<<<<<<< HEAD
    // 3. Check direct golden file route
    const rawRes = await app.request("/api/suites/demo/attractions/golden/explorer.result.json");
=======
    // 3. Check direct golden file GET route
    const rawRes = await app.request("/api/suites/demo/attractions/golden/explorer.result.json");
>>>>>>> 66d51038 (feat(evals): relocate modular suites to .evals/suites/ and add golden asset UI editing & 1-click capture)
    expect(rawRes.status).toBe(200);
    const rawText = await rawRes.text();
    expect(rawText).toBe(goldenJson);

    // 4. Check saving a new golden answer via PUT
    const putRes = await app.request("/api/suites/demo/attractions/golden/answer.md", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "# Golden Answer Sample" }),
    });
    expect(putRes.status).toBe(200);
    const putData = await putRes.json<{ ok: boolean; file: string }>();
    expect(putData.ok).toBe(true);

    const savedContent = await fs.readFile(path.join(goldenDir, "answer.md"), "utf-8");
    expect(savedContent).toBe("# Golden Answer Sample");

    // 5. Check deleting a golden file via DELETE
    const delRes = await app.request("/api/suites/demo/attractions/golden/answer.md", {
      method: "DELETE",
    });
    expect(delRes.status).toBe(200);
    const delData = await delRes.json<{ ok: boolean; deleted: string }>();
    expect(delData.ok).toBe(true);

    const existsAfterDelete = await fs
      .access(path.join(goldenDir, "answer.md"))
      .then(() => true)
      .catch(() => false);
    expect(existsAfterDelete).toBe(false);
  });
});

