// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ForkStaticClientsSync } from "../oauth-clients/ForkStaticClientsSync";
import { getForkOAuthSecret } from "../oauth-clients/secrets-storage";
import { toast } from "sonner";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const createMockStorage = () => {
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
};

const mockLocalStorage = createMockStorage();
const mockSessionStorage = createMockStorage();

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
Object.defineProperty(window, "sessionStorage", {
  value: mockSessionStorage,
  writable: true,
  configurable: true,
});
Object.defineProperty(globalThis, "sessionStorage", {
  value: mockSessionStorage,
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
    mockSessionStorage.clear();
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
    mockSessionStorage.clear();
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

  it("does not bleed OAuth credentials to a second server without OAuth", async () => {
    mockUseMcpClient.mockReturnValue({
      servers: [
        {
          id: "server-oauth",
          url: "https://auth.example.com/mcp",
          oauth: {
            clientId: "oauth-client",
            clientSecret: "oauth-secret",
          },
        },
        {
          id: "server-no-oauth",
          url: "https://public.example.com/mcp",
          // No OAuth configured
        },
      ],
      storageLoaded: true,
    });

    await act(async () => {
      root?.render(<ForkStaticClientsSync />);
    });

    // Should only have synced credentials for server-oauth
    const putCalls = fetchMock.mock.calls.filter(
      (call) =>
        typeof call[0] === "string" &&
        call[0].includes("/inspector/api/fork/oauth/clients") &&
        call[1]?.method === "PUT"
    );

    expect(putCalls.length).toBe(1);
    expect(putCalls[0][1].body).toContain("https://auth.example.com/mcp");
    expect(putCalls[0][1].body).not.toContain("https://public.example.com/mcp");
  });

  it("intercepts POST /oauth/proxy in standalone mode, injects Basic auth, strips client_id, and falls back to direct fetch when local proxy is unreachable", async () => {
    const { saveForkOAuthSecret } = await import("../oauth-clients/secrets-storage");
    const { installStandaloneOAuthInterceptor } = await import(
      "../oauth-clients/standalone-oauth-interceptor"
    );

    saveForkOAuthSecret("https://mcp.example.com/mcp", "okta-client", "okta-secret");
    // Simulate local proxy :3020 not running, then direct fetch succeeding
    fetchMock
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "tok-123", token_type: "Bearer" }), {
          status: 200,
          statusText: "OK",
          headers: { "content-type": "application/json" },
        })
      );

    installStandaloneOAuthInterceptor();

    const res = await window.fetch("http://localhost:3017/inspector/api/oauth/proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serverUrl: "https://mcp.example.com/mcp",
        url: "https://okta.example.com/oauth2/v1/token",
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: {
          grant_type: "authorization_code",
          code: "auth-code-xyz",
          client_id: "okta-client",
        },
      }),
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://okta.example.com/oauth2/v1/token",
      expect.objectContaining({
        method: "POST",
        body: "grant_type=authorization_code&code=auth-code-xyz",
      })
    );
    const forwardedHeaders = fetchMock.mock.calls[1][1]?.headers as Headers;
    expect(forwardedHeaders.get("Authorization")).toBe(
      `Basic ${btoa("okta-client:okta-secret")}`
    );

    const envelope = await res.json();
    expect(envelope).toMatchObject({
      status: 200,
      body: { access_token: "tok-123", token_type: "Bearer" },
    });
  });

  it("routes standalone POST /oauth/proxy through configured local CORS proxy to strip Origin header", async () => {
    const { saveForkOAuthSecret } = await import("../oauth-clients/secrets-storage");
    const { installStandaloneOAuthInterceptor } = await import(
      "../oauth-clients/standalone-oauth-interceptor"
    );

    mockLocalStorage.setItem(
      "mcp-inspector-connections",
      JSON.stringify({
        "https://mcp.example.com/mcp": {
          url: "https://mcp.example.com/mcp",
          connectionMode: "proxy",
          proxyConfig: { proxyAddress: "http://localhost:3020" },
        },
      })
    );

    saveForkOAuthSecret("https://mcp.example.com/mcp", "okta-client", "okta-secret");
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ access_token: "tok-proxied", token_type: "Bearer" }), {
        status: 200,
        statusText: "OK",
        headers: { "content-type": "application/json" },
      })
    );

    installStandaloneOAuthInterceptor();

    const res = await window.fetch("http://localhost:3017/inspector/api/oauth/proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serverUrl: "https://mcp.example.com/mcp",
        url: "https://okta.example.com/oauth2/v1/token",
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: {
          grant_type: "authorization_code",
          code: "auth-code-xyz",
          code_verifier: "verifier-123",
          client_id: "okta-client",
        },
      }),
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3020/?url=https%3A%2F%2Fokta.example.com%2Foauth2%2Fv1%2Ftoken",
      expect.objectContaining({
        method: "POST",
        body: "grant_type=authorization_code&code=auth-code-xyz&code_verifier=verifier-123",
      })
    );

    const envelope = await res.json();
    expect(envelope).toMatchObject({
      status: 200,
      body: { access_token: "tok-proxied", token_type: "Bearer" },
    });
  });

  it("captures client secret typed in Authentication dialog with capital S placeholder and retains it across dialog unmount", async () => {
    mockUseMcpClient.mockReturnValue({
      servers: [],
      storageLoaded: true,
    });

    await act(async () => {
      root?.render(<ForkStaticClientsSync />);
    });

    const urlInput = document.createElement("input");
    urlInput.setAttribute("data-testid", "connection-form-url-input");
    urlInput.value = "https://localhost:8443/mcp";
    document.body.appendChild(urlInput);

    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");

    const clientIdInput = document.createElement("input");
    clientIdInput.setAttribute("data-testid", "auth-dialog-client-id-input");
    clientIdInput.setAttribute("placeholder", "Client ID (optional if server supports DCR)");
    clientIdInput.value = "okta-dialog-client";

    const secretInput = document.createElement("input");
    secretInput.setAttribute("data-testid", "auth-dialog-client-secret-input");
    secretInput.setAttribute("placeholder", "Client Secret (optional)");
    secretInput.value = "okta-dialog-secret";

    dialog.appendChild(clientIdInput);
    dialog.appendChild(secretInput);
    document.body.appendChild(dialog);

    await act(async () => {
      secretInput.dispatchEvent(new Event("input", { bubbles: true }));
    });

    // Simulate closing the Authentication modal before clicking Connect
    dialog.remove();

    expect(getForkOAuthSecret("https://localhost:8443/mcp", "okta-dialog-client")).toMatchObject({
      serverUrl: "https://localhost:8443/mcp",
      clientId: "okta-dialog-client",
      clientSecret: "okta-dialog-secret",
    });

    urlInput.remove();
  });
});
