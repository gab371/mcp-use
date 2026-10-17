import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ResolvedConfig } from "vite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { forkStaticEvalsPlugin } from "../evals/static-evals-vite-plugin.js";

function writeSuite(evalsDir: string, relPath: string, yaml: string): void {
  const abs = path.join(evalsDir, "suites", relPath);
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, yaml);
}

function makeConfig(root: string): ResolvedConfig {
  return {
    root,
    build: { outDir: path.join(root, "dist", "web") },
  } as unknown as ResolvedConfig;
}

describe("fork static evals vite plugin", () => {
  let tmpDir: string;
  let previousEvalsDir: string | undefined;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), "fork-static-evals-"));
    previousEvalsDir = process.env.EVALS_DATA_DIR;
  });

  afterEach(() => {
    if (previousEvalsDir === undefined) {
      delete process.env.EVALS_DATA_DIR;
    } else {
      process.env.EVALS_DATA_DIR = previousEvalsDir;
    }
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("copies suites and generates the suites.json manifest", () => {
    const evalsDir = path.join(tmpDir, ".evals");
    writeSuite(evalsDir, "tool-routing.yaml", "name: Tool routing\ncases: []\n");
    writeSuite(evalsDir, "dlp/faq/faq.yaml", 'name: "DLP FAQ & Policy"\ncases: []\n');
    writeSuite(evalsDir, "dlp/faq/golden/faq-food.result.json", '{"ok":true}');
    process.env.EVALS_DATA_DIR = evalsDir;

    const plugin = forkStaticEvalsPlugin();
    plugin.configResolved?.(makeConfig(tmpDir));
    plugin.closeBundle?.();

    const outDir = path.join(tmpDir, "dist", "web", "evals");
    const manifest = JSON.parse(readFileSync(path.join(outDir, "suites.json"), "utf-8"));
    expect(manifest.suites).toEqual([
      { id: "dlp/faq/faq", name: "DLP FAQ & Policy" },
      { id: "tool-routing", name: "Tool routing" },
    ]);
    expect(readFileSync(path.join(outDir, "suites", "dlp", "faq", "golden", "faq-food.result.json"), "utf-8")).toBe(
      '{"ok":true}'
    );
  });

  it("falls back to id when a suite has no name field", () => {
    const evalsDir = path.join(tmpDir, ".evals");
    writeSuite(evalsDir, "anonymous.yaml", "cases: []\n");
    process.env.EVALS_DATA_DIR = evalsDir;

    const plugin = forkStaticEvalsPlugin();
    plugin.configResolved?.(makeConfig(tmpDir));
    plugin.closeBundle?.();

    const manifest = JSON.parse(
      readFileSync(path.join(tmpDir, "dist", "web", "evals", "suites.json"), "utf-8")
    );
    expect(manifest.suites).toEqual([{ id: "anonymous", name: "anonymous" }]);
  });

  it("refreshes stale output on rebuild", () => {
    const evalsDir = path.join(tmpDir, ".evals");
    writeSuite(evalsDir, "old.yaml", "name: Old\ncases: []\n");
    process.env.EVALS_DATA_DIR = evalsDir;

    const plugin = forkStaticEvalsPlugin();
    plugin.configResolved?.(makeConfig(tmpDir));
    plugin.closeBundle?.();

    rmSync(path.join(evalsDir, "suites", "old.yaml"));
    writeSuite(evalsDir, "new.yaml", "name: New\ncases: []\n");
    plugin.closeBundle?.();

    const outDir = path.join(tmpDir, "dist", "web", "evals");
    const manifest = JSON.parse(readFileSync(path.join(outDir, "suites.json"), "utf-8"));
    expect(manifest.suites).toEqual([{ id: "new", name: "New" }]);
  });

  it("is a no-op when no evals folder is found", () => {
    delete process.env.EVALS_DATA_DIR;

    const plugin = forkStaticEvalsPlugin();
    plugin.configResolved?.(makeConfig(tmpDir));
    expect(() => plugin.closeBundle?.()).not.toThrow();
    expect(existsSync(path.join(tmpDir, "dist", "web", "evals", "suites.json"))).toBe(false);
  });
});