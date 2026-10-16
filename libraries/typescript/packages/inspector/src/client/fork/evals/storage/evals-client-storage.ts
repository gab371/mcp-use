import type { RunResult, RunSummary } from "@/client/fork/evals/engine/verdict";
import { parseSuiteYaml } from "@/client/fork/evals/engine/suite";
import { BUNDLED_SUITES } from "./bundled-suites";

export interface SuiteListItem {
  id: string;
  name: string;
  caseCount?: number;
  isCustom?: boolean;
}

export interface SuiteDetail {
  id: string;
  name: string;
  yaml: string;
  goldenFiles?: Record<string, string>;
}

const STORAGE_KEY_SUITES = "mcp-fork-evals-browser-suites";
const STORAGE_KEY_GOLDEN = "mcp-fork-evals-browser-golden";
const STORAGE_KEY_RUNS = "mcp-fork-evals-browser-runs";
const MAX_STORED_RUNS = 50;

let backendAvailable: boolean | null = null;

// Helper to access browser storage safely
function getLocalItem<T>(key: string, fallback: T): T {
  if (typeof window === "undefined" || !window.localStorage) return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function setLocalItem<T>(key: string, value: T): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors
  }
}

// Initialise bundled suites in localStorage if not already present
function ensureBrowserSuites(): Record<string, { name: string; yaml: string; goldenFiles?: Record<string, string> }> {
  const store = getLocalItem<Record<string, { name: string; yaml: string; goldenFiles?: Record<string, string> }>>(
    STORAGE_KEY_SUITES,
    {}
  );

  let updated = false;
  for (const bundled of BUNDLED_SUITES) {
    if (!store[bundled.id]) {
      store[bundled.id] = {
        name: bundled.name,
        yaml: bundled.rawYaml,
        goldenFiles: bundled.goldenFiles || {},
      };
      updated = true;
    }
  }

  if (updated) {
    setLocalItem(STORAGE_KEY_SUITES, store);
  }

  return store;
}

export const evalsClientStorage = {
  /**
   * Lists all available evaluation suites.
   * Tries backend first; if unavailable, falls back to browser storage + bundled suites.
   */
  async listSuites(): Promise<SuiteListItem[]> {
    if (backendAvailable !== false) {
      try {
        const res = await fetch("/inspector/api/fork/evals/suites");
        if (res.ok) {
          backendAvailable = true;
          const data = await res.json();
          return data.suites || [];
        }
        if (res.status === 404) {
          backendAvailable = false;
        }
      } catch {
        backendAvailable = false;
      }
    }

    // Static Pages fallback: fetch published evals manifest
    try {
      const staticRes = await fetch("./evals/suites.json");
      if (staticRes.ok) {
        const data = await staticRes.json();
        const store = ensureBrowserSuites();
        const published: SuiteListItem[] = (data.suites || []).map((s: { id: string; name?: string; caseCount?: number }) => ({
          id: s.id,
          name: s.name || s.id,
          caseCount: s.caseCount,
          isCustom: false,
        }));
        const publishedIds = new Set(published.map((p) => p.id));
        const localCustom = Object.entries(store)
          .filter(([id]) => !publishedIds.has(id))
          .map(([id, item]) => ({
            id,
            name: item.name || id,
            isCustom: true,
          }));
        return [...published, ...localCustom];
      }
    } catch {
      // Ignore network errors on static check
    }

    // Fallback: Browser storage
    const store = ensureBrowserSuites();
    return Object.entries(store).map(([id, item]) => {
      let caseCount: number | undefined;
      const parsed = parseSuiteYaml(item.yaml);
      if (parsed.success && parsed.suite) {
        caseCount = parsed.suite.cases.length;
      }
      return {
        id,
        name: item.name || id,
        caseCount,
        isCustom: true,
      };
    });
  },

  /**
   * Retrieves suite detail by ID (YAML and golden files).
   */
  async getSuite(id: string): Promise<SuiteDetail | null> {
    if (backendAvailable !== false) {
      try {
        const res = await fetch(`/inspector/api/fork/evals/suites/${encodeURIComponent(id)}`);
        if (res.ok) {
          backendAvailable = true;
          return await res.json();
        }
        if (res.status === 404) {
          // If server returns 404, check static / local storage
        }
      } catch {
        backendAvailable = false;
      }
    }

    // 1. Check local storage if the user modified/created this suite locally
    const store = ensureBrowserSuites();
    if (store[id]?.yaml) {
      return {
        id,
        name: store[id].name,
        yaml: store[id].yaml,
        goldenFiles: store[id].goldenFiles || {},
      };
    }

    // 2. Fetch published static YAML from Pages
    try {
      const yamlRes = await fetch(`./evals/suites/${id}.yaml`);
      if (yamlRes.ok) {
        const yaml = await yamlRes.text();
        const parsed = parseSuiteYaml(yaml);
        return {
          id,
          name: (parsed.success && parsed.suite?.name) ? parsed.suite.name : id,
          yaml,
          goldenFiles: {},
        };
      }
    } catch {
      // Ignore fetch errors
    }

    const item = store[id];
    if (!item) return null;

    return {
      id,
      name: item.name,
      yaml: item.yaml,
      goldenFiles: item.goldenFiles || {},
    };
  },

  /**
   * Saves an updated or newly created YAML suite.
   */
  async saveSuite(id: string, yamlContent: string): Promise<void> {
    const parsed = parseSuiteYaml(yamlContent);
    const suiteName = (parsed.success && parsed.suite?.name) ? parsed.suite.name : id;

    if (backendAvailable !== false) {
      try {
        const res = await fetch(`/inspector/api/fork/evals/suites/${encodeURIComponent(id)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ yaml: yamlContent }),
        });
        if (res.ok) {
          backendAvailable = true;
          return;
        }
        if (res.status === 404) {
          backendAvailable = false;
        }
      } catch {
        backendAvailable = false;
      }
    }

    // Fallback to browser storage
    const store = ensureBrowserSuites();
    const existing = store[id] || {};
    store[id] = {
      ...existing,
      name: suiteName,
      yaml: yamlContent,
    };
    setLocalItem(STORAGE_KEY_SUITES, store);
  },

  /**
   * Retrieves golden file contents.
   */
  async getGoldenFile(suiteId: string, relPath: string): Promise<string | null> {
    if (backendAvailable !== false) {
      try {
        const res = await fetch(
          `/inspector/api/fork/evals/suites/${encodeURIComponent(suiteId)}/golden/${encodeURIComponent(relPath)}`
        );
        if (res.ok) {
          backendAvailable = true;
          return await res.text();
        }
      } catch {
        backendAvailable = false;
      }
    }

    const goldenKey = `${suiteId}:${relPath}`;
    const goldenStore = getLocalItem<Record<string, string>>(STORAGE_KEY_GOLDEN, {});
    if (goldenStore[goldenKey] !== undefined) {
      return goldenStore[goldenKey];
    }

    // Static Pages fallback: fetch published golden file
    try {
      const suiteDir = suiteId.includes("/") ? suiteId.substring(0, suiteId.lastIndexOf("/")) : suiteId;
      const res = await fetch(`./evals/suites/${suiteDir}/golden/${encodeURIComponent(relPath)}`);
      if (res.ok) return await res.text();
    } catch {
      // Ignore fetch error
    }

    const store = ensureBrowserSuites();
    return store[suiteId]?.goldenFiles?.[relPath] ?? null;
  },

  /**
   * Saves a golden result or answer file.
   */
  async saveGoldenFile(suiteId: string, relPath: string, content: string): Promise<void> {
    if (backendAvailable !== false) {
      try {
        const res = await fetch(
          `/inspector/api/fork/evals/suites/${encodeURIComponent(suiteId)}/golden/${encodeURIComponent(relPath)}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content }),
          }
        );
        if (res.ok) {
          backendAvailable = true;
          return;
        }
      } catch {
        backendAvailable = false;
      }
    }

    // Save locally
    const goldenKey = `${suiteId}:${relPath}`;
    const goldenStore = getLocalItem<Record<string, string>>(STORAGE_KEY_GOLDEN, {});
    goldenStore[goldenKey] = content;
    setLocalItem(STORAGE_KEY_GOLDEN, goldenStore);

    const store = ensureBrowserSuites();
    if (store[suiteId]) {
      if (!store[suiteId].goldenFiles) store[suiteId].goldenFiles = {};
      store[suiteId].goldenFiles![relPath] = content;
      setLocalItem(STORAGE_KEY_SUITES, store);
    }
  },

  /**
   * Deletes a golden file.
   */
  async deleteGoldenFile(suiteId: string, relPath: string): Promise<void> {
    if (backendAvailable !== false) {
      try {
        const res = await fetch(
          `/inspector/api/fork/evals/suites/${encodeURIComponent(suiteId)}/golden/${encodeURIComponent(relPath)}`,
          { method: "DELETE" }
        );
        if (res.ok) {
          backendAvailable = true;
          return;
        }
      } catch {
        backendAvailable = false;
      }
    }

    const goldenKey = `${suiteId}:${relPath}`;
    const goldenStore = getLocalItem<Record<string, string>>(STORAGE_KEY_GOLDEN, {});
    delete goldenStore[goldenKey];
    setLocalItem(STORAGE_KEY_GOLDEN, goldenStore);

    const store = ensureBrowserSuites();
    if (store[suiteId]?.goldenFiles?.[relPath]) {
      delete store[suiteId].goldenFiles![relPath];
      setLocalItem(STORAGE_KEY_SUITES, store);
    }
  },

  /**
   * Lists past evaluation run summaries.
   */
  async listRuns(): Promise<RunSummary[]> {
    if (backendAvailable !== false) {
      try {
        const res = await fetch("/inspector/api/fork/evals/runs");
        if (res.ok) {
          backendAvailable = true;
          const data = await res.json();
          return data.runs || [];
        }
      } catch {
        backendAvailable = false;
      }
    }

    const runs = getLocalItem<RunResult[]>(STORAGE_KEY_RUNS, []);
    return runs.map((r) => r.summary).sort((a, b) => b.startedAt - a.startedAt);
  },

  /**
   * Retrieves detailed run result by run ID.
   */
  async getRun(id: string): Promise<RunResult | null> {
    if (backendAvailable !== false) {
      try {
        const res = await fetch(`/inspector/api/fork/evals/runs/${encodeURIComponent(id)}`);
        if (res.ok) {
          backendAvailable = true;
          const data = await res.json();
          return data.run || null;
        }
      } catch {
        backendAvailable = false;
      }
    }

    const runs = getLocalItem<RunResult[]>(STORAGE_KEY_RUNS, []);
    return runs.find((r) => r.id === id || r.summary.id === id) || null;
  },

  /**
   * Saves a newly completed evaluation run.
   */
  async saveRun(run: RunResult): Promise<void> {
    if (backendAvailable !== false) {
      try {
        const res = await fetch("/inspector/api/fork/evals/runs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(run),
        });
        if (res.ok) {
          backendAvailable = true;
        }
      } catch {
        backendAvailable = false;
      }
    }

    // Always keep in local browser storage as well for resilience
    const runs = getLocalItem<RunResult[]>(STORAGE_KEY_RUNS, []);
    const filtered = runs.filter((r) => r.id !== run.id && r.summary.id !== run.summary.id);
    filtered.unshift(run);

    if (filtered.length > MAX_STORED_RUNS) {
      filtered.length = MAX_STORED_RUNS;
    }

    setLocalItem(STORAGE_KEY_RUNS, filtered);
  },

  /**
   * Imports a suite from an uploaded YAML file.
   */
  async importSuite(filename: string, yamlContent: string): Promise<string> {
    const cleanId = filename
      .replace(/\.(yaml|yml)$/i, "")
      .replace(/[^a-zA-Z0-9_\-\/]/g, "_")
      .toLowerCase();

    await this.saveSuite(cleanId, yamlContent);
    return cleanId;
  },

  /**
   * Downloads a suite YAML content as a file.
   */
  downloadSuiteYaml(id: string, yamlContent: string): void {
    if (typeof window === "undefined" || !window.document) return;
    const blob = new Blob([yamlContent], { type: "text/yaml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${id.replace(/\//g, "-")}.yaml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};
