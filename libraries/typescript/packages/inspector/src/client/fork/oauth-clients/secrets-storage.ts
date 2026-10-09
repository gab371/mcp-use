export interface ForkSecretEntry {
  serverUrl: string;
  clientId: string;
  clientSecret: string;
  updatedAt: number;
}

const STORAGE_KEY = "mcp-inspector-fork-oauth-secrets";

function readStorage(): Record<string, ForkSecretEntry> {
  if (typeof window === "undefined" || !window.localStorage) return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, ForkSecretEntry>;
    }
  } catch {
    // Ignore storage parse errors
  }
  return {};
}

function writeStorage(data: Record<string, ForkSecretEntry>): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage write errors (e.g. private browsing quota)
  }
}

function normalizeUrlKey(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    if (
      (parsed.protocol === "https:" && parsed.port === "443") ||
      (parsed.protocol === "http:" && parsed.port === "80")
    ) {
      parsed.port = "";
    }
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return url.trim().replace(/\/$/, "");
  }
}

/**
 * Saves a confidential client secret for a given server URL and clientId.
 */
export function saveForkOAuthSecret(
  serverUrl: string,
  clientId: string,
  clientSecret: string
): void {
  if (!serverUrl || !clientId || !clientSecret) return;
  const store = readStorage();
  const normalizedKey = normalizeUrlKey(serverUrl);
  store[normalizedKey] = {
    serverUrl,
    clientId: clientId.trim(),
    clientSecret: clientSecret.trim(),
    updatedAt: Date.now(),
  };
  writeStorage(store);
}

/**
 * Retrieves a confidential client secret by server URL or matching clientId.
 */
export function getForkOAuthSecret(
  serverUrl: string,
  clientId?: string
): ForkSecretEntry | undefined {
  const store = readStorage();
  const normalizedKey = normalizeUrlKey(serverUrl);

  // 1. Direct key match
  if (store[normalizedKey]) {
    if (!clientId || store[normalizedKey].clientId === clientId) {
      return store[normalizedKey];
    }
  }

  // 2. Same origin match
  try {
    const targetOrigin = new URL(serverUrl).origin;
    for (const entry of Object.values(store)) {
      try {
        if (new URL(entry.serverUrl).origin === targetOrigin) {
          if (!clientId || entry.clientId === clientId) {
            return entry;
          }
        }
      } catch {
        // Ignore URL parse error
      }
    }
  } catch {
    // Ignore URL parse error
  }

  // 3. ClientId fallback if provided
  if (clientId) {
    for (const entry of Object.values(store)) {
      if (entry.clientId === clientId) {
        return entry;
      }
    }
  }

  return undefined;
}

/**
 * Returns all saved confidential client secrets.
 */
export function getAllForkOAuthSecrets(): Record<string, ForkSecretEntry> {
  return readStorage();
}

/**
 * Removes a stored confidential client secret for a given server URL.
 */
export function removeForkOAuthSecret(serverUrl: string): void {
  const store = readStorage();
  const normalizedKey = normalizeUrlKey(serverUrl);
  delete store[normalizedKey];
  writeStorage(store);
}
