// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  readEvalScope,
  writeEvalScope,
  scopeFolders,
  suiteFolder,
  isSuiteInScope,
  groupByScope,
} from "../../evals/scope";
import { EvalScopeSettingsCard } from "../../evals/components/EvalScopeSettingsCard";
import { EvalsTab } from "../../evals/EvalsTab";
import type { McpServer } from "@mcp-use/client/react";

describe("eval scope module (feat 05)", () => {
  let store: Record<string, string> = {};

  beforeEach(() => {
    store = {};
    const mockStorage = {
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
      length: 0,
      key: () => null,
    };
    Object.defineProperty(window, "localStorage", {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
  });

  describe("scope logic", () => {
    it("reads and writes eval scope per serverId", () => {
      expect(readEvalScope("srv-1")).toEqual({ defaultFolder: "", folders: [] });

      writeEvalScope("srv-1", { defaultFolder: "catalog", folders: ["offers", "faq"] });
      expect(readEvalScope("srv-1")).toEqual({ defaultFolder: "catalog", folders: ["offers", "faq"] });
      expect(readEvalScope("other")).toEqual({ defaultFolder: "", folders: [] });
    });

    it("scopeFolders puts defaultFolder first and deduplicates", () => {
      expect(scopeFolders({ defaultFolder: "catalog", folders: ["catalog", "offers", " "] })).toEqual([
        "catalog",
        "offers",
      ]);
      expect(scopeFolders({ defaultFolder: "", folders: [] })).toEqual([]);
    });

    it("suiteFolder extracts folder and treats global as undefined", () => {
      expect(suiteFolder("catalog/products")).toBe("catalog");
      expect(suiteFolder("offers/tickets")).toBe("offers");
      expect(suiteFolder("tool-routing")).toBeUndefined();
      expect(suiteFolder("global/standard")).toBeUndefined();
    });

    it("isSuiteInScope allows all suites when folders is empty", () => {
      expect(isSuiteInScope("catalog/products", [])).toBe(true);
      expect(isSuiteInScope("tool-routing", [])).toBe(true);
    });

    it("isSuiteInScope filters by folder but always allows global suites", () => {
      const allowed = ["catalog", "offers"];
      expect(isSuiteInScope("catalog/products", allowed)).toBe(true);
      expect(isSuiteInScope("offers/tickets", allowed)).toBe(true);
      expect(isSuiteInScope("internal/admin", allowed)).toBe(false);
      // Flat or global/ suites are always in scope
      expect(isSuiteInScope("tool-routing", allowed)).toBe(true);
      expect(isSuiteInScope("global/standard", allowed)).toBe(true);
    });

    it("groupByScope groups suites and drops empty groups", () => {
      const suites = [
        { id: "catalog/products", name: "Catalog Products" },
        { id: "tool-routing", name: "Tool Routing" },
      ];
      const groups = groupByScope(suites);
      expect(groups).toHaveLength(2);
      expect(groups[0].label).toBe("MCP suites");
      expect(groups[0].suites).toHaveLength(1);
      expect(groups[1].label).toBe("Global suites");
      expect(groups[1].suites).toHaveLength(1);
    });
  });

  describe("EvalScopeSettingsCard", () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
      container = document.createElement("div");
      document.body.appendChild(container);
      root = createRoot(container);
    });

    afterEach(() => {
      act(() => {
        root.unmount();
      });
      container.remove();
    });

    it("renders and updates localStorage when inputs change", async () => {
      await act(async () => {
        root.render(<EvalScopeSettingsCard serverId="srv-test" />);
      });

      const defaultInput = container.querySelector("#fork-eval-default-folder") as HTMLInputElement;
      const foldersInput = container.querySelector("#fork-eval-folders") as HTMLInputElement;
      expect(defaultInput).not.toBeNull();
      expect(foldersInput).not.toBeNull();

      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      )?.set;

      await act(async () => {
        setter?.call(defaultInput, "catalog");
        defaultInput.dispatchEvent(new Event("input", { bubbles: true }));
        defaultInput.dispatchEvent(new Event("change", { bubbles: true }));
      });

      await act(async () => {
        setter?.call(foldersInput, "discovery, boundaries");
        foldersInput.dispatchEvent(new Event("input", { bubbles: true }));
        foldersInput.dispatchEvent(new Event("change", { bubbles: true }));
      });

      const saved = readEvalScope("srv-test");
      expect(saved.defaultFolder).toBe("catalog");
      expect(saved.folders).toEqual(["discovery", "boundaries"]);
    });
  });

  describe("EvalsTab scope integration", () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
      container = document.createElement("div");
      document.body.appendChild(container);
      root = createRoot(container);

      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes("/suites")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              suites: [
                { id: "catalog/products", name: "Catalog Products", yaml: "name: Catalog Products\ncases: []\n" },
                { id: "other/tools", name: "Other Tools", yaml: "name: Other Tools\ncases: []\n" },
                { id: "tool-routing", name: "Tool Routing", yaml: "name: Tool Routing\ncases: []\n" },
              ],
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({}),
        });
      });
    });

    afterEach(() => {
      act(() => {
        root.unmount();
      });
      container.remove();
      vi.restoreAllMocks();
    });

    const mockServer = {
      id: "srv-catalog",
      name: "Catalog Server",
      url: "https://localhost:8443/mcp",
    } as unknown as McpServer;

    it("filters visible suites when a scope is configured and allows toggling to all suites", async () => {
      writeEvalScope("srv-catalog", { defaultFolder: "catalog", folders: [] });

      await act(async () => {
        root.render(<EvalsTab connection={mockServer} />);
      });

      // Scope button in header
      const toggle = container.querySelector('[data-testid="evals-scope-toggle"]') as HTMLButtonElement;
      expect(toggle).not.toBeNull();
      expect(toggle.textContent).toContain("Scope: catalog + global");

      // Verify suite dropdown contains catalog/products and tool-routing, but NOT other/tools
      const select = container.querySelector("select") as HTMLSelectElement;
      expect(select).not.toBeNull();
      const options = Array.from(select.options).map((o) => o.value);
      expect(options).toContain("catalog/products");
      expect(options).toContain("tool-routing");
      expect(options).not.toContain("other/tools");

      // Toggle to show all suites
      await act(async () => {
        toggle.click();
      });

      expect(toggle.textContent).toBe("All suites");
      const allOptions = Array.from(select.options).map((o) => o.value);
      expect(allOptions).toContain("catalog/products");
      expect(allOptions).toContain("tool-routing");
      expect(allOptions).toContain("other/tools");
    });
  });
});
