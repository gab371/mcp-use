import { canonicalUrl } from "../../proxy/oauth-proxy.js";

export type StaticClientAuthMethod = "client_secret_basic" | "client_secret_post";

export interface ConfidentialClient {
  clientSecret: string;
  authMethod: StaticClientAuthMethod;
  expiresAt: number;
}

export interface RegisterStaticClientOptions {
  serverUrl: string | URL;
  clientId: string;
  clientSecret: string;
  authMethod?: StaticClientAuthMethod;
}

const staticClients = new Map<string, ConfidentialClient>();

export function buildStaticClientKey(
  serverUrlOrBindingKey: string | URL,
  clientId?: string
): string {
  if (clientId === undefined) {
    return typeof serverUrlOrBindingKey === "string"
      ? serverUrlOrBindingKey
      : canonicalUrl(serverUrlOrBindingKey);
  }

  const bindingKey =
    typeof serverUrlOrBindingKey === "string"
      ? serverUrlOrBindingKey.startsWith("http://") ||
        serverUrlOrBindingKey.startsWith("https://")
        ? canonicalUrl(new URL(serverUrlOrBindingKey))
        : serverUrlOrBindingKey
      : canonicalUrl(serverUrlOrBindingKey);

  return `${bindingKey}\u0000${clientId}`;
}

/**
 * Registers an in-memory confidential OAuth client for a given MCP server URL and clientId.
 * Static clients never expire (expiresAt: Infinity) and are lost on server restart.
 */
export function registerStaticClient(options: RegisterStaticClientOptions): void {
  const {
    serverUrl,
    clientId,
    clientSecret,
    authMethod = "client_secret_basic",
  } = options;
  const key = buildStaticClientKey(serverUrl, clientId);
  staticClients.set(key, {
    clientSecret,
    authMethod,
    expiresAt: Infinity,
  });

  const displayUrl =
    typeof serverUrl === "string"
      ? serverUrl
      : canonicalUrl(serverUrl);
  console.log(
    `[OAuth BFF] Registered static confidential client for ${displayUrl} (client_id: "${clientId}")`
  );
}

/**
 * Removes an in-memory confidential OAuth client for a given MCP server URL and optional clientId.
 * If clientId is omitted, removes all static clients for that server URL.
 */
export function removeStaticClient(
  serverUrlOrBindingKey: string | URL,
  clientId?: string
): void {
  if (clientId !== undefined) {
    const key = buildStaticClientKey(serverUrlOrBindingKey, clientId);
    staticClients.delete(key);
  } else {
    const prefix =
      typeof serverUrlOrBindingKey === "string" &&
      (serverUrlOrBindingKey.startsWith("http://") ||
        serverUrlOrBindingKey.startsWith("https://"))
        ? `${canonicalUrl(new URL(serverUrlOrBindingKey))}\u0000`
        : `${String(serverUrlOrBindingKey)}\u0000`;

    for (const key of staticClients.keys()) {
      if (key.startsWith(prefix) || key === String(serverUrlOrBindingKey)) {
        staticClients.delete(key);
      }
    }
  }
}

/**
 * Retrieves a registered static confidential client by combined key or (bindingKey, clientId).
 * If an exact match is not found, attempts origin-based and client_id-based matching
 * to accommodate URL variations (e.g. /mcp path suffix or ngrok tunnel hostname).
 */
export function getStaticClient(
  bindingKeyOrKey: string,
  clientId?: string
): ConfidentialClient | undefined {
  if (clientId !== undefined) {
    const key = buildStaticClientKey(bindingKeyOrKey, clientId);
    return getStaticClient(key);
  }

  // Exact composite key match
  const directMatch = staticClients.get(bindingKeyOrKey);
  if (directMatch) return directMatch;

  // Composite key fallback
  const parts = bindingKeyOrKey.split("\u0000");
  if (parts.length === 2) {
    const [bindingKey, cid] = parts;

    // 1. Same origin + same clientId
    try {
      const bindingOrigin = new URL(bindingKey).origin;
      for (const [k, client] of staticClients) {
        const [kBinding, kCid] = k.split("\u0000");
        if (kCid === cid) {
          try {
            if (new URL(kBinding).origin === bindingOrigin) {
              return client;
            }
          } catch {
            // Ignore URL parse error
          }
        }
      }
    } catch {
      // Ignore URL parse error
    }

    // 2. Any registered client with the same clientId
    for (const [k, client] of staticClients) {
      const [, kCid] = k.split("\u0000");
      if (kCid === cid) {
        return client;
      }
    }
  }

  return undefined;
}

/**
 * Clears all registered static clients (primarily for test cleanup).
 */
export function clearStaticClients(): void {
  staticClients.clear();
}

/**
 * Initialize preset static clients from FORK_OAUTH_STATIC_CLIENTS env var if provided.
 * Format: JSON array of { serverUrl, clientId, clientSecret, authMethod? }
 */
function initFromEnv(): void {
  const envVal = process.env.FORK_OAUTH_STATIC_CLIENTS;
  if (!envVal?.trim()) return;

  try {
    const parsed = JSON.parse(envVal);
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (item.serverUrl && item.clientId && item.clientSecret) {
          registerStaticClient({
            serverUrl: item.serverUrl,
            clientId: item.clientId,
            clientSecret: item.clientSecret,
            authMethod: item.authMethod,
          });
        }
      }
    }
  } catch (err) {
    console.warn("[OAuth BFF] Failed to parse FORK_OAUTH_STATIC_CLIENTS env var:", err);
  }
}

initFromEnv();
