// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { EvalsTab } from "../../evals/EvalsTab";
import type { McpServer } from "@mcp-use/client/react";

describe("EvalsTab", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    // Mock localStorage
    const store: Record<string, string> = {};
    const mockStorage = {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        for (const k of Object.keys(store)) delete store[k];
      },
      length: 0,
      key: () => null,
    };
    Object.defineProperty(window, "localStorage", {
      value: mockStorage,
      writable: true,
      configurable: true,
    });

    // Mock fetch for suites
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ suites: [] }),
    } as any);

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  const mockServer = {
    id: "srv-1",
    name: "Mock Server",
    url: "https://localhost:8443/mcp",
    state: "ready",
    tools: [
      { name: "entity_search", description: "Search entities" },
      { name: "explorer", description: "Explore details" },
    ],
    callTool: vi.fn(),
  } as unknown as McpServer;

  it("renders header and navigation buttons", async () => {
    await act(async () => {
      root.render(<EvalsTab connection={mockServer} />);
    });

    expect(container.textContent).toContain("MCP Evaluations");
    expect(container.textContent).toContain("Run");
    expect(container.textContent).toContain("History & Diff");
    expect(container.textContent).toContain("Suites & Drafts");
  });
});
