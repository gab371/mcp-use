// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  BUILT_IN_PROFILES,
  createMcpUseProfile,
  createClaudeProfile,
  createChatGptProfile,
  createClaudeDesktopProfile,
  getHostProfile,
  DEFAULT_CHATGPT_CLIENT_META,
} from "../host-profiles/built-ins";
import {
  HostProfileProvider,
  useHostProfile,
} from "../host-profiles/HostProfileContext";
import { HostProfileMetaBar } from "../host-profiles/HostProfileMetaBar";
import { useMcpAppsHostContext } from "../../hooks/useMcpAppsHostContext";

const mockLocalStorage = (() => {
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
})();

Object.defineProperty(window, "localStorage", {
  value: mockLocalStorage,
  writable: true,
});

describe("Host Profiles — Built-ins", () => {
  it("mcp-use profile mirrors today's default behavior exactly", () => {
    const profile = createMcpUseProfile();
    expect(profile.id).toBe("mcp-use");
    expect(profile.hostInfo.name).toBe("mcp-use-inspector");
    expect(profile.hostCapabilities).toEqual({});
    expect(profile.hostContext.availableDisplayModes).toEqual([
      "inline",
      "pip",
      "fullscreen",
    ]);
    expect(profile.hostContext.platform).toBe("web");
    expect(profile.hostContext.toolInfo).toBe(true);
    expect(profile.openaiShim).toBe(true);
    expect(profile.hostContext.fontCss).toContain("MCP Host Sans");
  });

  it("claude profile sets claude.ai web hostInfo and drops unadvertised capabilities", () => {
    const profile = createClaudeProfile();
    expect(profile.id).toBe("claude");
    expect(profile.hostInfo).toEqual({
      name: "claude-ai",
      version: "0.1.0",
    });
    expect(profile.hostCapabilities).toEqual({
      sampling: undefined,
      message: undefined,
      downloadFile: undefined,
      modelContext: undefined,
    });
    expect(profile.hostContext.availableDisplayModes).toEqual([
      "inline",
      "fullscreen",
    ]);
    expect(profile.openaiShim).toBe(false);
    expect(profile.hostContext.styleVariables("light")).toHaveProperty(
      "--color-background-primary",
      "#FAF9F5"
    );
    expect(profile.hostContext.styleVariables("dark")).toHaveProperty(
      "--color-background-primary",
      "#1F1E1D"
    );
  });

  it("chatgpt profile sets ChatGPT Apps hostInfo and enables openaiShim", () => {
    const profile = createChatGptProfile();
    expect(profile.id).toBe("chatgpt");
    expect(profile.hostInfo).toEqual({
      name: "chatgpt",
      version: "1.0.0",
    });
    expect(profile.openaiShim).toBe(true);
    expect(profile.hostContext.toolInfo).toBe(false);
    expect(profile.hostContext.availableDisplayModes).toEqual([
      "inline",
      "fullscreen",
    ]);
    expect(profile.hostContext.styleVariables("light")).toHaveProperty(
      "--color-background-primary",
      "#FFFFFF"
    );
  });

  it("claude-desktop profile sets desktop platform and inline-only display mode", () => {
    const profile = createClaudeDesktopProfile();
    expect(profile.id).toBe("claude-desktop");
    expect(profile.hostInfo).toEqual({
      name: "claude-desktop",
      version: "0.8.0",
    });
    expect(profile.hostContext.platform).toBe("desktop");
    expect(profile.hostContext.availableDisplayModes).toEqual(["inline"]);
    expect(profile.openaiShim).toBe(false);
  });

  it("getHostProfile resolves known and unknown ids safely", () => {
    expect(getHostProfile("mcp-use").id).toBe("mcp-use");
    expect(getHostProfile("claude").id).toBe("claude");
    expect(getHostProfile("chatgpt").id).toBe("chatgpt");
    expect(getHostProfile("claude-desktop").id).toBe("claude-desktop");
    expect(getHostProfile("unknown-id" as any).id).toBe("mcp-use");
    expect(getHostProfile(undefined).id).toBe("mcp-use");
  });
});

describe("HostProfileContext & Provider", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    mockLocalStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
      root = null;
    }
    if (container) {
      container.remove();
      container = null;
    }
    mockLocalStorage.clear();
  });

  it("defaults to mcp-use when no URL param or localStorage", () => {
    let captured: ReturnType<typeof useHostProfile> | null = null;
    function Probe() {
      captured = useHostProfile();
      return null;
    }

    act(() => {
      root!.render(
        <HostProfileProvider>
          <Probe />
        </HostProfileProvider>
      );
    });

    expect(captured).not.toBeNull();
    expect(captured!.activeProfileId).toBe("mcp-use");
    expect(captured!.activeProfile.id).toBe("mcp-use");
  });

  it("persists profile switch to localStorage", () => {
    let captured: ReturnType<typeof useHostProfile> | null = null;
    function Probe() {
      captured = useHostProfile();
      return (
        <button
          onClick={() => captured?.setActiveProfileId("claude")}
          data-testid="btn"
        >
          Switch
        </button>
      );
    }

    act(() => {
      root!.render(
        <HostProfileProvider>
          <Probe />
        </HostProfileProvider>
      );
    });

    expect(captured!.activeProfileId).toBe("mcp-use");
    const btn = container!.querySelector("button");
    act(() => {
      btn?.click();
    });

    expect(captured!.activeProfileId).toBe("claude");
    expect(mockLocalStorage.getItem("mcp-inspector-host-profile")).toBe("claude");
  });

  it("initializes from localStorage if valid", () => {
    mockLocalStorage.setItem("mcp-inspector-host-profile", "chatgpt");
    let captured: ReturnType<typeof useHostProfile> | null = null;
    function Probe() {
      captured = useHostProfile();
      return null;
    }

    act(() => {
      root!.render(
        <HostProfileProvider>
          <Probe />
        </HostProfileProvider>
      );
    });

    expect(captured!.activeProfileId).toBe("chatgpt");
  });

  it("initializes from ?host= URL parameter and persists it to localStorage", () => {
    window.history.pushState({}, "", "/inspector?host=chatgpt");
    let captured: ReturnType<typeof useHostProfile> | null = null;
    function Probe() {
      captured = useHostProfile();
      return null;
    }

    act(() => {
      root!.render(
        <HostProfileProvider>
          <Probe />
        </HostProfileProvider>
      );
    });

    expect(captured!.activeProfileId).toBe("chatgpt");
    expect(mockLocalStorage.getItem("mcp-inspector-host-profile")).toBe("chatgpt");
  });

  it("returns safe fallback when hook is used outside provider", () => {
    let captured: ReturnType<typeof useHostProfile> | null = null;
    function Probe() {
      captured = useHostProfile();
      return null;
    }

    act(() => {
      root!.render(<Probe />);
    });

    expect(captured!.activeProfileId).toBe("mcp-use");
    expect(captured!.activeProfile.id).toBe("mcp-use");
  });
});

describe("useMcpAppsHostContext with host profiles", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
      root = null;
    }
    if (container) {
      container.remove();
      container = null;
    }
  });

  const baseParams = {
    theme: "light" as const,
    displayMode: "inline" as const,
    maxWidth: 1024,
    maxHeight: 768,
    playground: {
      theme: "light" as const,
      deviceType: "desktop",
      locale: "en-US",
      timeZone: "UTC",
      cspMode: "permissive" as const,
      capabilities: {},
      safeAreaInsets: { top: 0, right: 0, bottom: 0, left: 0 },
    },
    deviceType: "desktop",
    toolCallId: "call-1",
    toolName: "test_tool",
    tool: {
      name: "test_tool",
      description: "A test tool",
      inputSchema: { type: "object" },
    } as any,
  };

  it("provides mcp-use host context by default", () => {
    let hostContext: ReturnType<typeof useMcpAppsHostContext> | null = null;
    function Probe() {
      hostContext = useMcpAppsHostContext(baseParams);
      return null;
    }

    act(() => {
      root!.render(
        <HostProfileProvider initialProfileId="mcp-use">
          <Probe />
        </HostProfileProvider>
      );
    });

    expect(hostContext).not.toBeNull();
    expect(hostContext!.availableDisplayModes).toEqual([
      "inline",
      "pip",
      "fullscreen",
    ]);
    expect(hostContext!.platform).toBe("web");
    expect(hostContext!.toolInfo).toBeDefined();
    expect(hostContext!.toolInfo?.id).toBe("call-1");
  });

  it("gates toolInfo off for chatgpt profile", () => {
    let hostContext: ReturnType<typeof useMcpAppsHostContext> | null = null;
    function Probe() {
      hostContext = useMcpAppsHostContext(baseParams);
      return null;
    }

    act(() => {
      root!.render(
        <HostProfileProvider initialProfileId="chatgpt">
          <Probe />
        </HostProfileProvider>
      );
    });

    expect(hostContext).not.toBeNull();
    expect(hostContext!.availableDisplayModes).toEqual([
      "inline",
      "fullscreen",
    ]);
    expect(hostContext!.toolInfo).toBeUndefined();
    expect(hostContext!.styles?.variables).toHaveProperty(
      "--color-background-primary",
      "#FFFFFF"
    );
  });

  it("applies Claude style variables and constraints for claude profile", () => {
    let hostContext: ReturnType<typeof useMcpAppsHostContext> | null = null;
    function Probe() {
      hostContext = useMcpAppsHostContext(baseParams);
      return null;
    }

    act(() => {
      root!.render(
        <HostProfileProvider initialProfileId="claude">
          <Probe />
        </HostProfileProvider>
      );
    });

    expect(hostContext).not.toBeNull();
    expect(hostContext!.availableDisplayModes).toEqual([
      "inline",
      "fullscreen",
    ]);
    expect(hostContext!.toolInfo).toBeDefined();
    expect(hostContext!.styles?.variables).toHaveProperty(
      "--color-background-primary",
      "#FAF9F5"
    );
    expect(hostContext!.styles?.css?.fonts).toContain("Anthropic Sans");
    expect(hostContext!.containerDimensions?.maxWidth).toBe(768);
  });

  it("initializes from ?host=<id> URL parameter when present", () => {
    const originalLocation = window.location;
    delete (window as any).location;
    window.location = new URL("http://localhost:3000/inspector?host=claude") as any;

    let captured: ReturnType<typeof useHostProfile> | null = null;
    function Probe() {
      captured = useHostProfile();
      return null;
    }

    act(() => {
      root!.render(
        <HostProfileProvider>
          <Probe />
        </HostProfileProvider>
      );
    });

    expect(captured!.activeProfileId).toBe("claude");
    window.location = originalLocation;
  });

  describe("Client Tool Call Metadata (_meta fields)", () => {
    it("DEFAULT_CHATGPT_CLIENT_META includes all OpenAI client metadata fields", () => {
      expect(DEFAULT_CHATGPT_CLIENT_META["openai/locale"]).toBe("en-US");
      expect(DEFAULT_CHATGPT_CLIENT_META["webplus/i18n"]).toBe("en-US");
      expect(DEFAULT_CHATGPT_CLIENT_META["openai/userAgent"]).toContain("ChatGPT");
      expect(DEFAULT_CHATGPT_CLIENT_META["openai/userLocation"]).toEqual({
        city: "San Francisco",
        region: "CA",
        country: "US",
        timezone: "America/Los_Angeles",
        latitude: 37.7749,
        longitude: -122.4194,
      });
      expect(DEFAULT_CHATGPT_CLIENT_META["openai/subject"]).toBeDefined();
      expect(DEFAULT_CHATGPT_CLIENT_META["openai/session"]).toBeDefined();
      expect(DEFAULT_CHATGPT_CLIENT_META["openai/organization"]).toBeDefined();
    });

    it("attaches clientToolCallMeta to ChatGPT profile and leaves it undefined for others", () => {
      const chatgpt = createChatGptProfile();
      expect(chatgpt.clientToolCallMeta).toEqual(DEFAULT_CHATGPT_CLIENT_META);

      const claude = createClaudeProfile();
      expect(claude.clientToolCallMeta).toBeUndefined();

      const mcpUse = createMcpUseProfile();
      expect(mcpUse.clientToolCallMeta).toBeUndefined();

      const claudeDesktop = createClaudeDesktopProfile();
      expect(claudeDesktop.clientToolCallMeta).toBeUndefined();
    });

    it("provides getToolCallMeta returning ChatGPT defaults when chatgpt is active", () => {
      let captured: ReturnType<typeof useHostProfile> | null = null;
      function Probe() {
        captured = useHostProfile();
        return null;
      }

      act(() => {
        root!.render(
          <HostProfileProvider initialProfileId="chatgpt">
            <Probe />
          </HostProfileProvider>
        );
      });

      expect(captured!.getToolCallMeta()).toEqual(DEFAULT_CHATGPT_CLIENT_META);
    });

    it("returns undefined for getToolCallMeta when claude or mcp-use is active", () => {
      let captured: ReturnType<typeof useHostProfile> | null = null;
      function Probe() {
        captured = useHostProfile();
        return null;
      }

      act(() => {
        root!.render(
          <HostProfileProvider initialProfileId="claude">
            <Probe />
          </HostProfileProvider>
        );
      });

      expect(captured!.getToolCallMeta()).toBeUndefined();
    });

    it("supports updating client metadata and toggling userLocation on/off", () => {
      let captured: ReturnType<typeof useHostProfile> | null = null;
      function Probe() {
        captured = useHostProfile();
        return null;
      }

      act(() => {
        root!.render(
          <HostProfileProvider initialProfileId="chatgpt">
            <Probe />
          </HostProfileProvider>
        );
      });

      // Update locale
      act(() => {
        captured!.updateClientToolCallMeta({
          "openai/locale": "fr-FR",
        });
      });

      const updated = captured!.getToolCallMeta();
      expect(updated!["openai/locale"]).toBe("fr-FR");
      expect(updated!["webplus/i18n"]).toBe("fr-FR");

      // Toggle location off
      act(() => {
        captured!.setLocationEnabled(false);
      });

      const withoutLocation = captured!.getToolCallMeta();
      expect(withoutLocation!["openai/userLocation"]).toBeUndefined();
      expect(withoutLocation!["openai/locale"]).toBe("fr-FR");

      // Reset defaults
      act(() => {
        captured!.resetClientToolCallMeta();
      });

      const restored = captured!.getToolCallMeta();
      expect(restored).toEqual(DEFAULT_CHATGPT_CLIENT_META);
    });

    it("renders HostProfileMetaBar when chatgpt profile is active and hides it for claude", () => {
      act(() => {
        root!.render(
          <HostProfileProvider key="chatgpt" initialProfileId="chatgpt">
            <HostProfileMetaBar />
          </HostProfileProvider>
        );
      });

      expect(container!.querySelector('[data-testid="host-profile-meta-bar"]')).not.toBeNull();
      expect(container!.textContent).toContain("ChatGPT (Apps) Client Metadata");
      expect(container!.textContent).toContain("_meta");

      act(() => {
        root!.render(
          <HostProfileProvider key="claude" initialProfileId="claude">
            <HostProfileMetaBar />
          </HostProfileProvider>
        );
      });

      expect(container!.querySelector('[data-testid="host-profile-meta-bar"]')).toBeNull();
    });
  });
});
