// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  saveForkOAuthSecret,
  getForkOAuthSecret,
  getAllForkOAuthSecrets,
  removeForkOAuthSecret,
} from "../oauth-clients/secrets-storage";

function createMockStorage() {
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
}

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

describe("OAuth Secrets Storage Lifecycle", () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    mockSessionStorage.clear();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("saves to sessionStorage by default (secure by default)", () => {
    saveForkOAuthSecret("https://mcp.example.com", "client-123", "secret-xyz");

    // SessionStorage should contain the entry
    const sessionRaw = mockSessionStorage.getItem("mcp-inspector-fork-oauth-secrets");
    expect(sessionRaw).toBeTruthy();
    expect(sessionRaw).toContain("secret-xyz");

    // LocalStorage should be clean
    const localRaw = mockLocalStorage.getItem("mcp-inspector-fork-oauth-secrets");
    expect(localRaw).toBeFalsy();

    const stored = getForkOAuthSecret("https://mcp.example.com");
    expect(stored?.clientSecret).toBe("secret-xyz");
    expect(stored?.persistent).toBe(false);
  });

  it("saves to localStorage when remember24h is true", () => {
    saveForkOAuthSecret("https://mcp.example.com", "client-123", "secret-xyz", true);

    const localRaw = mockLocalStorage.getItem("mcp-inspector-fork-oauth-secrets");
    expect(localRaw).toBeTruthy();
    expect(localRaw).toContain("secret-xyz");

    const sessionRaw = mockSessionStorage.getItem("mcp-inspector-fork-oauth-secrets");
    expect(sessionRaw).toBeFalsy();

    const stored = getForkOAuthSecret("https://mcp.example.com");
    expect(stored?.clientSecret).toBe("secret-xyz");
    expect(stored?.persistent).toBe(true);
    expect(stored?.expiresAt).toBeGreaterThan(Date.now());
  });

  it("automatically prunes secrets after 24 hours in localStorage", () => {
    vi.useFakeTimers();
    const now = 1700000000000;
    vi.setSystemTime(now);

    saveForkOAuthSecret("https://mcp.example.com", "client-123", "secret-xyz", true);

    // Active immediately
    expect(getForkOAuthSecret("https://mcp.example.com")?.clientSecret).toBe("secret-xyz");

    // Advance 23 hours -> still active
    vi.advanceTimersByTime(23 * 3600 * 1000);
    expect(getForkOAuthSecret("https://mcp.example.com")?.clientSecret).toBe("secret-xyz");

    // Advance 2 more hours (total 25 hours) -> expired!
    vi.advanceTimersByTime(2 * 3600 * 1000);
    expect(getForkOAuthSecret("https://mcp.example.com")).toBeUndefined();

    // Storage is cleaned up
    const all = getAllForkOAuthSecrets();
    expect(Object.keys(all).length).toBe(0);
  });

  it("removes secrets from both stores when removeForkOAuthSecret is called", () => {
    saveForkOAuthSecret("https://mcp.example.com", "client-1", "sec-1", false);
    saveForkOAuthSecret("https://mcp2.example.com", "client-2", "sec-2", true);

    expect(getForkOAuthSecret("https://mcp.example.com")).toBeDefined();
    expect(getForkOAuthSecret("https://mcp2.example.com")).toBeDefined();

    removeForkOAuthSecret("https://mcp.example.com");
    removeForkOAuthSecret("https://mcp2.example.com");

    expect(getForkOAuthSecret("https://mcp.example.com")).toBeUndefined();
    expect(getForkOAuthSecret("https://mcp2.example.com")).toBeUndefined();
  });
});
