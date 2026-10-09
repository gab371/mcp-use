// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ForkStaticClientsSync } from "../oauth-clients/ForkStaticClientsSync";
import { toast } from "sonner";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

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
  configurable: true,
});
Object.defineProperty(globalThis, "localStorage", {
  value: mockLocalStorage,
  writable: true,
  configurable: true,
});

// Mock sonner
vi.mock("sonner", () => ({
  toast: {
    warning: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock @mcp-use/client/react
const mockUseMcpClient = vi.fn();
vi.mock("@mcp-use/client/react", () => ({
  useMcpClient: () => mockUseMcpClient(),
}));

describe("ForkStaticClientsSync", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    mockLocalStorage.clear();
    vi.clearAllMocks();

    fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    mockLocalStorage.clear();
    vi.restoreAllMocks();
  });

  it("syncs static client via PUT when server carries clientId and clientSecret", async () => {
    mockUseMcpClient.mockReturnValue({
      servers: [
        {
          id: "server-1",
          url: "https://localhost:8443/mcp",
          connectionMode: "proxy",
          oauth: {
            clientId: "okta-client",
            clientSecret: "okta-secret",
          },
        },
      ],
      storageLoaded: true,
    });

    await act(async () => {
      root?.render(<ForkStaticClientsSync />);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/inspector/api/fork/oauth/clients"),
      expect.objectContaining({
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serverUrl: "https://localhost:8443/mcp",
          clientId: "okta-client",
          clientSecret: "okta-secret",
          authMethod: "client_secret_basic",
        }),
      })
    );
  });

  it("retrieves secret from localStorage when omitted from live server memory", async () => {
    mockLocalStorage.setItem(
      "mcp-inspector-connections",
      JSON.stringify({
        "server-stored": {
          url: "https://localhost:8443/mcp",
          connectionMode: "proxy",
          oauth: {
            clientId: "stored-client",
            clientSecret: "stored-secret",
          },
        },
      })
    );

    mockUseMcpClient.mockReturnValue({
      servers: [
        {
          id: "server-stored",
          url: "https://localhost:8443/mcp",
          connectionMode: "proxy",
          oauth: {
            clientId: "stored-client",
          },
        },
      ],
      storageLoaded: true,
    });

    await act(async () => {
      root?.render(<ForkStaticClientsSync />);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/inspector/api/fork/oauth/clients"),
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          serverUrl: "https://localhost:8443/mcp",
          clientId: "stored-client",
          clientSecret: "stored-secret",
          authMethod: "client_secret_basic",
        }),
      })
    );
  });

  it("warns when connection with client secret is configured in Direct mode", async () => {
    mockUseMcpClient.mockReturnValue({
      servers: [
        {
          id: "server-direct",
          url: "https://localhost:8443/mcp",
          connectionMode: "direct",
          oauth: {
            clientId: "direct-client",
            clientSecret: "direct-secret",
          },
        },
      ],
      storageLoaded: true,
    });

    await act(async () => {
      root?.render(<ForkStaticClientsSync />);
    });

    expect(toast.warning).toHaveBeenCalledWith(
      expect.stringContaining("Direct mode"),
      expect.objectContaining({ id: "direct-mode-secret-server-direct" })
    );
  });

  it("sends DELETE when server is removed or secret cleared", async () => {
    mockUseMcpClient.mockReturnValue({
      servers: [
        {
          id: "s1",
          url: "https://localhost:8443/mcp",
          oauth: {
            clientId: "c1",
            clientSecret: "s1",
          },
        },
      ],
      storageLoaded: true,
    });

    await act(async () => {
      root?.render(<ForkStaticClientsSync />);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/inspector/api/fork/oauth/clients"),
      expect.objectContaining({ method: "PUT" })
    );

    fetchMock.mockClear();

    mockUseMcpClient.mockReturnValue({
      servers: [],
      storageLoaded: true,
    });

    await act(async () => {
      root?.render(<ForkStaticClientsSync />);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/inspector/api/fork/oauth/clients"),
      expect.objectContaining({
        method: "DELETE",
        body: JSON.stringify({
          serverUrl: "https://localhost:8443/mcp",
          clientId: "c1",
        }),
      })
    );
  });
});
