import { useEffect, useState } from "react";

/**
 * Eval scope of one MCP connection (feat 05).
 * - defaultFolder: where new suites are created (`.evals/suites/<defaultFolder>/<name>/`).
 * - folders: extra suite folders shown for this MCP.
 * Suites outside any folder (flat files) or in `global/` are always shown.
 */
export interface EvalScope {
  defaultFolder: string;
  folders: string[];
}

const STORAGE_KEY = "fork-evals-scope";
const CHANGE_EVENT = "fork-evals-scope-change";
const EMPTY_SCOPE: EvalScope = { defaultFolder: "", folders: [] };

function readAll(): Record<string, EvalScope> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

export function readEvalScope(serverId?: string): EvalScope {
  if (!serverId) return EMPTY_SCOPE;
  return { ...EMPTY_SCOPE, ...readAll()[serverId] };
}

export function writeEvalScope(serverId: string, scope: EvalScope): void {
  const all = readAll();
  all[serverId] = scope;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Folders of a scope: default first, trimmed, unique. Empty = no filter. */
export function scopeFolders(scope: EvalScope): string[] {
  return [...new Set([scope.defaultFolder, ...scope.folders].map((f) => f.trim()).filter(Boolean))];
}

/** First path segment of a suite id, undefined for global suites. */
export function suiteFolder(suiteId: string): string | undefined {
  const folder = suiteId.includes("/") ? suiteId.split("/")[0] : undefined;
  return folder === "global" ? undefined : folder;
}

export function isSuiteInScope(suiteId: string, folders: string[]): boolean {
  if (folders.length === 0) return true;
  const folder = suiteFolder(suiteId);
  return !folder || folders.includes(folder);
}

/** Splits suites into "MCP suites" (in a folder) and "Global suites", dropping empty groups. */
export function groupByScope<T extends { id: string }>(suites: T[]) {
  return [
    { label: "MCP suites", suites: suites.filter((s) => suiteFolder(s.id)) },
    { label: "Global suites", suites: suites.filter((s) => !suiteFolder(s.id)) },
  ].filter((g) => g.suites.length > 0);
}

/** Live scope of a connection, updated when the settings card saves it. */
export function useEvalScope(serverId?: string): EvalScope {
  const [scope, setScope] = useState(() => readEvalScope(serverId));
  useEffect(() => {
    const sync = () => setScope(readEvalScope(serverId));
    sync();
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [serverId]);
  return scope;
}
