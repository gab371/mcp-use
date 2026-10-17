import { cpSync, existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Plugin, ResolvedConfig } from "vite";

interface StaticSuiteManifestEntry {
  id: string;
  name: string;
}

/**
 * Walk up from `startDir` until a `.evals` directory is found, so the build
 * works whether Vite runs from the package or the repository root.
 */
function findDefaultEvalsDir(startDir: string): string | null {
  let dir = path.resolve(startDir);
  while (true) {
    const candidate = path.join(dir, ".evals");
    if (existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * Collect the suites manifest entries by walking `suitesDir` (skipping
 * `golden` directories), reading each suite's `name:` field. Mirrors the
 * layout the standalone UI fetches: `evals/suites/<id>.yaml` plus
 * `evals/suites/<dir>/golden/<file>`.
 */
function collectSuiteManifest(suitesDir: string): StaticSuiteManifestEntry[] {
  const suites: StaticSuiteManifestEntry[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "golden") walk(abs);
      } else if (entry.isFile() && entry.name.endsWith(".yaml")) {
        const id = path
          .relative(suitesDir, abs)
          .split(path.sep)
          .join("/")
          .replace(/\.yaml$/, "");
        const yaml = readFileSync(abs, "utf-8");
        const match = yaml.match(/^name:\s*["']?([^\r\n"']+)/m);
        suites.push({ id, name: match ? match[1].trim() : id });
      }
    }
  };
  walk(suitesDir);
  suites.sort((a, b) => a.id.localeCompare(b.id));
  return suites;
}

/**
 * Fork: standalone static evals.
 *
 * At the end of every web build, copies the eval suites folder into
 * `dist/web/evals/` and generates the `suites.json` manifest the UI fetches
 * when no backend is available (GitHub/GitLab Pages, static Docker serving).
 * The source folder is `EVALS_DATA_DIR/suites` (same variable as the server
 * API, default: the repository `.evals/` directory), so a plain
 * `vite build` produces a self-contained static deployment with no extra
 * CI step.
 */
export function forkStaticEvalsPlugin(): Plugin {
  let configRoot = "";
  let webOutDir = "";

  return {
    name: "fork-static-evals",
    configResolved(config: ResolvedConfig) {
      configRoot = config.root;
      webOutDir = path.resolve(config.root, config.build.outDir || "dist");
    },
    closeBundle() {
      if (!webOutDir) return;
      const evalsDir = process.env.EVALS_DATA_DIR
        ? path.resolve(process.env.EVALS_DATA_DIR)
        : findDefaultEvalsDir(configRoot);
      const suitesDir = evalsDir ? path.join(evalsDir, "suites") : null;
      if (!suitesDir || !existsSync(suitesDir)) return;

      const evalsOutDir = path.join(webOutDir, "evals");
      rmSync(evalsOutDir, { recursive: true, force: true });
      cpSync(suitesDir, path.join(evalsOutDir, "suites"), { recursive: true });
      const suites = collectSuiteManifest(suitesDir);
      writeFileSync(path.join(evalsOutDir, "suites.json"), JSON.stringify({ suites }, null, 2));
      console.info(`[fork-static-evals] bundled ${suites.length} eval suites into ${path.relative(configRoot, evalsOutDir)}`);
    },
  };
}