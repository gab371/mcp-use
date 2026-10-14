// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { evalsClientStorage } from "../../evals/storage/evals-client-storage";
import type { RunResult } from "../../evals/engine/verdict";

function createMockStorage() {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
}

const mockLocalStorage = createMockStorage();

Object.defineProperty(window, "localStorage", {
  value: mockLocalStorage,
  writable: true,
  configurable: true,
});
Object.defineProperty(globalThis, "localStorage", {
  value: mockLocalStorage,
  writable: true,
  configurable: true,
});

describe("Hybrid Evals Client Storage (Standalone Fallback)", () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    // Simulate standalone environment (fetch to /inspector/api/fork/evals fails)
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch (offline / standalone)")));
  });

  it("lists bundled suites when running in standalone mode", async () => {
    const suites = await evalsClientStorage.listSuites();
    expect(suites.length).toBeGreaterThanOrEqual(1);

    const toolRouting = suites.find((s) => s.id === "tool-routing");
    expect(toolRouting).toBeDefined();
    expect(toolRouting?.name).toBe("Tool routing");
  });

  it("retrieves bundled suite detail and raw YAML", async () => {
    const detail = await evalsClientStorage.getSuite("tool-routing");
    expect(detail).toBeDefined();
    expect(detail?.id).toBe("tool-routing");
    expect(detail?.yaml).toContain("Tool routing");
  });

  it("saves, lists, and re-reads custom suites in browser storage", async () => {
    const customYaml = `name: Custom Standalone Test\ndefaults:\n  iterations: 1\ncases:\n  - id: c1\n    prompts: ["Hi"]\n    expect:\n      - noToolError: true\n`;
    await evalsClientStorage.saveSuite("custom/my-suite", customYaml);

    const detail = await evalsClientStorage.getSuite("custom/my-suite");
    expect(detail).toBeDefined();
    expect(detail?.name).toBe("Custom Standalone Test");
    expect(detail?.yaml).toBe(customYaml);

    const all = await evalsClientStorage.listSuites();
    expect(all.some((s) => s.id === "custom/my-suite")).toBe(true);
  });

  it("imports a suite from uploaded YAML text", async () => {
    const yaml = `name: Imported Suite\ncases:\n  - id: t1\n    prompts: ["ping"]\n    expect:\n      - noToolError: true\n`;
    const suiteId = await evalsClientStorage.importSuite("my-evals-v1.yaml", yaml);

    expect(suiteId).toBe("my-evals-v1");
    const loaded = await evalsClientStorage.getSuite("my-evals-v1");
    expect(loaded?.name).toBe("Imported Suite");
  });

  it("saves, retrieves, and deletes golden assets locally", async () => {
    const content = JSON.stringify({ ok: true, data: [1, 2, 3] });
    await evalsClientStorage.saveGoldenFile("custom/my-suite", "test.result.json", content);

    const loaded = await evalsClientStorage.getGoldenFile("custom/my-suite", "test.result.json");
    expect(loaded).toBe(content);

    await evalsClientStorage.deleteGoldenFile("custom/my-suite", "test.result.json");
    const afterDelete = await evalsClientStorage.getGoldenFile("custom/my-suite", "test.result.json");
    expect(afterDelete).toBeNull();
  });

  it("saves and retrieves evaluation runs locally in standalone mode", async () => {
    const mockRun: RunResult = {
      id: "run-standalone-001",
      suiteId: "tool-routing",
      summary: {
        id: "run-standalone-001",
        suiteId: "tool-routing",
        suiteName: "Tool routing",
        status: "passed",
        startedAt: Date.now() - 5000,
        completedAt: Date.now(),
        model: "gpt-4o",
        provider: "openai",
        totalCases: 2,
        passedCases: 2,
        failedCases: 0,
        inconclusiveCases: 0,
        flakyCases: 0,
        performance: {
          totalDurationMs: 450,
          totalToolCalls: 2,
          totalTokens: 120,
        },
      },
      caseVerdicts: [],
    };

    await evalsClientStorage.saveRun(mockRun);

    const runs = await evalsClientStorage.listRuns();
    expect(runs.length).toBe(1);
    expect(runs[0].id).toBe("run-standalone-001");

    const detail = await evalsClientStorage.getRun("run-standalone-001");
    expect(detail).toBeDefined();
    expect(detail?.summary.status).toBe("passed");
  });
});
