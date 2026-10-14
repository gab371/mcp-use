export interface ForkSecretEntry {
  serverUrl: string;
  clientId: string;
  clientSecret: string;
  updatedAt: number;
  expiresAt?: number;
  persistent?: boolean; // true = 24h localStorage, false = sessionStorage only
}

export const FORK_OAUTH_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const STORAGE_KEY = "mcp-inspector-fork-oauth-secrets";

function readSessionStorage(): Record<string, ForkSecretEntry> {
  if (typeof window === "undefined" || !window.sessionStorage) return {};
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
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

function writeSessionStorage(data: Record<string, ForkSecretEntry>): void {
  if (typeof window === "undefined" || !window.sessionStorage) return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage write errors
  }
}

function readLocalStorage(): Record<string, ForkSecretEntry> {
  if (typeof window === "undefined" || !window.localStorage) return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const records = parsed as Record<string, ForkSecretEntry>;
      const now = Date.now();
      let hasExpired = false;

      // Auto-prune entries older than 24h or past expiresAt
      for (const [key, entry] of Object.entries(records)) {
        const expiresAt = entry.expiresAt || (entry.updatedAt ? entry.updatedAt + FORK_OAUTH_TTL_MS : 0);
        if (expiresAt && now > expiresAt) {
          delete records[key];
          hasExpired = true;
        }
      }

      if (hasExpired) {
        writeLocalStorage(records);
      }
      return records;
    }
  } catch {
    // Ignore storage parse errors
  }
  return {};
}

function writeLocalStorage(data: Record<string, ForkSecretEntry>): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage write errors (e.g. quota)
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
 * Reads all active secrets, prioritizing active sessionStorage over persistent localStorage.
 */
function readStorage(): Record<string, ForkSecretEntry> {
  const localStore = readLocalStorage();
  const sessionStore = readSessionStorage();
  return { ...localStore, ...sessionStore };
}

/**
 * Saves a confidential client secret for a given server URL and clientId.
 * By default, saves to sessionStorage (secure by default, disappears on tab close).
 * If remember24h is true, saves to localStorage with a 24h TTL.
 */
export function saveForkOAuthSecret(
  serverUrl: string,
  clientId: string,
  clientSecret: string,
  remember24h: boolean = false
): void {
  if (!serverUrl || !clientId || !clientSecret) return;
  const normalizedKey = normalizeUrlKey(serverUrl);
  const now = Date.now();

  const entry: ForkSecretEntry = {
    serverUrl,
    clientId: clientId.trim(),
    clientSecret: clientSecret.trim(),
    updatedAt: now,
    persistent: remember24h,
    expiresAt: remember24h ? now + FORK_OAUTH_TTL_MS : undefined,
  };

  if (remember24h) {
    const localStore = readLocalStorage();
    localStore[normalizedKey] = entry;
    writeLocalStorage(localStore);

    // Clean any session entry so persistent one governs
    const sessionStore = readSessionStorage();
    if (sessionStore[normalizedKey]) {
      delete sessionStore[normalizedKey];
      writeSessionStorage(sessionStore);
    }
  } else {
    const sessionStore = readSessionStorage();
    sessionStore[normalizedKey] = entry;
    writeSessionStorage(sessionStore);

    // Clean any local entry so session-only governs
    const localStore = readLocalStorage();
    if (localStore[normalizedKey]) {
      delete localStore[normalizedKey];
      writeLocalStorage(localStore);
    }
  }
}

/**
 * Retrieves a confidential client secret by server URL or matching clientId.
 * Auto-filters expired entries.
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
 * Returns all active confidential client secrets.
 */
export function getAllForkOAuthSecrets(): Record<string, ForkSecretEntry> {
  return readStorage();
}

/**
 * Removes a stored confidential client secret for a given server URL from both stores.
 */
export function removeForkOAuthSecret(serverUrl: string): void {
  const normalizedKey = normalizeUrlKey(serverUrl);

  const sessionStore = readSessionStorage();
  if (sessionStore[normalizedKey]) {
    delete sessionStore[normalizedKey];
    writeSessionStorage(sessionStore);
  }

  const localStore = readLocalStorage();
  if (localStore[normalizedKey]) {
    delete localStore[normalizedKey];
    writeLocalStorage(localStore);
  }
}
