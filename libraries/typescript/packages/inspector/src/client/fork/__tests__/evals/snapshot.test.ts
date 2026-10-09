import { describe, expect, it } from "vitest";
import { hashToolsSnapshot, diffToolSnapshots, type ToolSnapshotItem } from "../../evals/engine/snapshot";

describe("tool snapshot engine", () => {
  const toolsV1: ToolSnapshotItem[] = [
    { name: "faq", description: "Answers FAQs", inputSchema: { type: "object" } },
    { name: "tickets", description: "Search tickets", inputSchema: { type: "object" } },
  ];

  const toolsV2: ToolSnapshotItem[] = [
    // faq modified description
    { name: "faq", description: "Answers park FAQs and guest inquiries", inputSchema: { type: "object" } },
    // tickets unchanged
    { name: "tickets", description: "Search tickets", inputSchema: { type: "object" } },
    // newTool added
    { name: "hotels", description: "Book hotel rooms", inputSchema: { type: "object" } },
  ];

  it("produces deterministic hash regardless of tool array order", () => {
    const hash1 = hashToolsSnapshot(toolsV1);
    const hash2 = hashToolsSnapshot([toolsV1[1], toolsV1[0]]);
    expect(hash1).toBe(hash2);
    expect(typeof hash1).toBe("string");
    expect(hash1.length).toBe(8);
  });

  it("produces a different hash when descriptions change", () => {
    const hash1 = hashToolsSnapshot(toolsV1);
    const hash2 = hashToolsSnapshot(toolsV2);
    expect(hash1).not.toBe(hash2);
  });

  it("diffs tool snapshots accurately (added, removed, modified)", () => {
    const diffs = diffToolSnapshots(toolsV1, toolsV2);
    expect(diffs.length).toBe(2);

    const modified = diffs.find((d) => d.toolName === "faq");
    expect(modified?.type).toBe("modified");
    expect(modified?.descriptionChanged?.before).toBe("Answers FAQs");
    expect(modified?.descriptionChanged?.after).toBe("Answers park FAQs and guest inquiries");

    const added = diffs.find((d) => d.toolName === "hotels");
    expect(added?.type).toBe("added");
  });
});
