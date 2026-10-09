export interface ToolSnapshotItem {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface ToolDiff {
  toolName: string;
  type: "added" | "removed" | "modified";
  descriptionChanged?: {
    before?: string;
    after?: string;
  };
  schemaChanged?: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  };
}

/**
 * Deterministically sorts and serializes tool snapshot items.
 */
export function serializeToolsForHash(tools: ToolSnapshotItem[]): string {
  const sorted = [...tools].sort((a, b) => a.name.localeCompare(b.name));
  return JSON.stringify(sorted, Object.keys(sorted).sort());
}

/**
 * Computes a deterministic 32-bit hex hash (FNV-1a) for universal Browser and Node use.
 */
export function hashToolsSnapshot(tools: ToolSnapshotItem[]): string {
  const str = serializeToolsForHash(tools);
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * Compares two tool snapshots and returns the list of differences.
 */
export function diffToolSnapshots(
  before: ToolSnapshotItem[] = [],
  after: ToolSnapshotItem[] = []
): ToolDiff[] {
  const beforeMap = new Map(before.map((t) => [t.name, t]));
  const afterMap = new Map(after.map((t) => [t.name, t]));
  const diffs: ToolDiff[] = [];

  // Check added or modified
  for (const [name, afterTool] of afterMap) {
    const beforeTool = beforeMap.get(name);
    if (!beforeTool) {
      diffs.push({
        toolName: name,
        type: "added",
      });
    } else {
      const descBefore = beforeTool.description ?? "";
      const descAfter = afterTool.description ?? "";
      const descChanged = descBefore !== descAfter;

      const schemaBeforeStr = JSON.stringify(beforeTool.inputSchema ?? {});
      const schemaAfterStr = JSON.stringify(afterTool.inputSchema ?? {});
      const schemaChanged = schemaBeforeStr !== schemaAfterStr;

      if (descChanged || schemaChanged) {
        diffs.push({
          toolName: name,
          type: "modified",
          descriptionChanged: descChanged
            ? { before: beforeTool.description, after: afterTool.description }
            : undefined,
          schemaChanged: schemaChanged
            ? { before: beforeTool.inputSchema, after: afterTool.inputSchema }
            : undefined,
        });
      }
    }
  }

  // Check removed
  for (const [name] of beforeMap) {
    if (!afterMap.has(name)) {
      diffs.push({
        toolName: name,
        type: "removed",
      });
    }
  }

  return diffs;
}
