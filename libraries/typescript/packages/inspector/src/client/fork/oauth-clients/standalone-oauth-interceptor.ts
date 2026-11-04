import { getAllForkOAuthSecrets, getForkOAuthSecret } from "./secrets-storage";

type ForkFetchFn = typeof window.fetch & { __forkOAuthInterceptor?: boolean };

const DEFAULT_LOCAL_CORS_PROXY = "http://localhost:3020";

function encodeOAuthClientCredential(value: string): string {
  return new URLSearchParams({ value }).toString().slice("value=".length);
}

function getConfiguredProxyAddress(serverUrl?: string): string | undefined {
  if (typeof window === "undefined" || !window.localStorage) return undefined;
  try {
    const raw = localStorage.getItem("mcp-inspector-connections");
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Record<
      string,
      {
        url?: string;
        proxyConfig?: { proxyAddress?: string };
        autoProxyFallback?: { enabled?: boolean; proxyAddress?: string };
      }
    >;
    if (!parsed || typeof parsed !== "object") return undefined;

    const entries = Object.values(parsed);
    if (serverUrl) {
      const normalizedTarget = serverUrl.replace(/\/+$/, "");
      const matching = entries.find(
        (c) => typeof c?.url === "string" && c.url.replace(/\/+$/, "") === normalizedTarget
      );
      const addr =
        matching?.proxyConfig?.proxyAddress ||
        (matching?.autoProxyFallback?.enabled ? matching?.autoProxyFallback?.proxyAddress : undefined);
      if (addr && addr.trim()) return addr.trim();
    }

    for (const entry of entries) {
      const addr =
        entry?.proxyConfig?.proxyAddress ||
        (entry?.autoProxyFallback?.enabled ? entry?.autoProxyFallback?.proxyAddress : undefined);
      if (addr && addr.trim()) return addr.trim();
    }
  } catch {
    // Ignore storage read errors
  }
  return undefined;
}

function buildProxiedUrl(proxyBase: string, targetUrl: string): string {
  return `${proxyBase.replace(/\/+$/, "")}/?url=${encodeURIComponent(targetUrl)}`;
}

async function fetchWithLocalProxyFallback(
  originalFetch: typeof window.fetch,
  targetUrl: string,
  init: RequestInit,
  serverUrl?: string,
  preferProxyForConfidentialClient: boolean = false
): Promise<Response> {
  const configuredProxy = getConfiguredProxyAddress(serverUrl);
  const proxyToTryFirst =
    configuredProxy ||
    (preferProxyForConfidentialClient ? DEFAULT_LOCAL_CORS_PROXY : undefined);

  if (proxyToTryFirst) {
    try {
      return await originalFetch(buildProxiedUrl(proxyToTryFirst, targetUrl), init);
    } catch {
      // Local CORS proxy not reachable; fall back to direct fetch
    }
  }

  try {
    return await originalFetch(targetUrl, init);
  } catch (err) {
    if (!proxyToTryFirst) {
      try {
        return await originalFetch(buildProxiedUrl(DEFAULT_LOCAL_CORS_PROXY, targetUrl), init);
      } catch {
        // Fall through and throw original error
      }
    }
    throw err;
  }
}

function applyBasicAuthToFormBody(
  bodyStr: string,
  headers: Headers,
  serverUrlOrTarget: string,
  fallbackTargetUrl?: string
): { body: string; applied: boolean } {
  const params = new URLSearchParams(bodyStr);
  const clientId = params.get("client_id") || undefined;
  let secretEntry =
    getForkOAuthSecret(serverUrlOrTarget, clientId) ||
    (fallbackTargetUrl ? getForkOAuthSecret(fallbackTargetUrl, clientId) : undefined);

  if (!secretEntry) {
    const allSecrets = Object.values(getAllForkOAuthSecrets());
    if (clientId) {
      secretEntry = allSecrets.find((s) => s.clientId === clientId);
    } else if (allSecrets.length === 1) {
      secretEntry = allSecrets[0];
    }
  }

  if (secretEntry?.clientSecret && secretEntry.clientId) {
    const encodedId = encodeOAuthClientCredential(secretEntry.clientId);
    const encodedSecret = encodeOAuthClientCredential(secretEntry.clientSecret);
    headers.set("Authorization", `Basic ${btoa(`${encodedId}:${encodedSecret}`)}`);
    // RFC 6749 §2.3 (Okta): do not duplicate client credentials in both Authorization header and POST body
    params.delete("client_id");
    params.delete("client_secret");
    return { body: params.toString(), applied: true };
  }
  return { body: bodyStr, applied: false };
}

/**
 * Installs a client-side fetch interceptor that:
 * 1. Resolves OAuth metadata and proxy requests client-side when no backend BFF is running (standalone mode).
 * 2. Injects confidential client_secret (HTTP Basic auth) directly into token requests.
 * 3. Bypasses ngrok free-tier warning page by injecting ngrok-skip-browser-warning header.
 */
export function installStandaloneOAuthInterceptor(): void {
  if (typeof window === "undefined" || typeof window.fetch !== "function") return;
  if ((window.fetch as ForkFetchFn).__forkOAuthInterceptor) return;

  const originalFetch = window.fetch.bind(window);

  const forkOAuthFetch: ForkFetchFn = async function forkOAuthFetch(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    try {
      const urlStr =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      const method = (
        init?.method ||
        (typeof input === "object" && "method" in input ? input.method : "GET")
      ).toUpperCase();

      // Case 1a: Intercept OAuth BFF metadata / query-based proxy requests (e.g. /inspector/api/oauth/metadata?url=...)
      if (urlStr.includes("/oauth/metadata?") || urlStr.includes("/oauth/proxy?")) {
        try {
          const parsed = new URL(urlStr, window.location.origin);
          const targetUrl = parsed.searchParams.get("url");
          const serverUrl = parsed.searchParams.get("serverUrl");

          if (targetUrl) {
            const headers = new Headers(
              init?.headers ||
                (typeof input === "object" && "headers" in input
                  ? (input.headers as HeadersInit)
                  : undefined)
            );

            if (targetUrl.includes(".ngrok") && !headers.has("ngrok-skip-browser-warning")) {
              headers.set("ngrok-skip-browser-warning", "true");
            }

            let body = init?.body;
            const rawBodyStr =
              typeof body === "string"
                ? body
                : body instanceof URLSearchParams
                  ? body.toString()
                  : undefined;

            const isToken =
              method === "POST" &&
              (/\/(?:oauth2?\/)?token\/?$/i.test(targetUrl) ||
                Boolean(rawBodyStr && rawBodyStr.includes("grant_type=")));

            let authApplied = false;
            if (isToken && !headers.has("Authorization") && rawBodyStr !== undefined) {
              const authResult = applyBasicAuthToFormBody(
                rawBodyStr,
                headers,
                serverUrl || targetUrl,
                targetUrl
              );
              if (authResult.applied) {
                body = authResult.body;
                authApplied = true;
              }
            }

            return await fetchWithLocalProxyFallback(
              originalFetch,
              targetUrl,
              {
                ...init,
                body,
                headers,
                cache: "no-store",
              },
              serverUrl || targetUrl,
              authApplied
            );
          }
        } catch {
          // Fall through on parsing error
        }
      }

      // Case 1b: Intercept OAuth BFF JSON POST proxy requests (POST .../oauth/proxy)
      // BrowserOAuthClientProvider.getProxyFetch() sends { serverUrl, url, method, headers, body }
      // and expects { status, statusText, headers, body } JSON envelope back.
      if (method === "POST" && /\/oauth\/proxy\/?$/.test(urlStr)) {
        try {
          const rawInitBody =
            typeof init?.body === "string"
              ? init.body
              : input instanceof Request
                ? await input.clone().text()
                : undefined;

          if (rawInitBody) {
            const proxyReq = JSON.parse(rawInitBody) as {
              serverUrl?: string;
              url?: string;
              method?: string;
              headers?: Record<string, string>;
              body?: unknown;
            };

            if (typeof proxyReq.url === "string" && proxyReq.url) {
              const targetUrl = proxyReq.url;
              const serverUrl = proxyReq.serverUrl || targetUrl;
              const targetMethod = (proxyReq.method || "POST").toUpperCase();
              const headers = new Headers(proxyReq.headers || {});

              if (targetUrl.includes(".ngrok") && !headers.has("ngrok-skip-browser-warning")) {
                headers.set("ngrok-skip-browser-warning", "true");
              }

              let bodyStr: string | undefined;
              if (typeof proxyReq.body === "string") {
                bodyStr = proxyReq.body;
                if (!headers.has("content-type")) {
                  headers.set(
                    "content-type",
                    bodyStr.trim().startsWith("{")
                      ? "application/json"
                      : "application/x-www-form-urlencoded"
                  );
                }
              } else if (
                proxyReq.body &&
                typeof proxyReq.body === "object" &&
                !Array.isArray(proxyReq.body)
              ) {
                if ((headers.get("content-type") || "").includes("application/json")) {
                  bodyStr = JSON.stringify(proxyReq.body);
                } else {
                  const params = new URLSearchParams();
                  for (const [k, v] of Object.entries(proxyReq.body as Record<string, unknown>)) {
                    if (v !== undefined && v !== null) params.append(k, String(v));
                  }
                  bodyStr = params.toString();
                  if (!headers.has("content-type")) {
                    headers.set("content-type", "application/x-www-form-urlencoded");
                  }
                }
              }

              let authApplied = false;
              if (
                targetMethod === "POST" &&
                bodyStr !== undefined &&
                !(headers.get("content-type") || "").includes("application/json") &&
                !headers.has("Authorization")
              ) {
                const authResult = applyBasicAuthToFormBody(
                  bodyStr,
                  headers,
                  serverUrl,
                  targetUrl
                );
                bodyStr = authResult.body;
                authApplied = authResult.applied;
              }

              const upstream = await fetchWithLocalProxyFallback(
                originalFetch,
                targetUrl,
                {
                  method: targetMethod,
                  headers,
                  body: targetMethod === "GET" || targetMethod === "HEAD" ? undefined : bodyStr,
                  cache: "no-store",
                },
                serverUrl,
                authApplied
              );

              const rawText = await upstream.text();
              let responseBody: unknown = rawText;
              try {
                const parsedBody = JSON.parse(rawText) as Record<string, unknown>;
                if (
                  parsedBody &&
                  typeof parsedBody === "object" &&
                  typeof parsedBody.error_description === "string" &&
                  parsedBody.error_description.includes(
                    "Browser requests to the token endpoint must use Proof Key for Code Exchange"
                  )
                ) {
                  parsedBody.error_description = `${parsedBody.error_description} (Start ./scripts/fork/run-cors-proxy.sh so confidential client token requests strip the browser Origin header)`;
                }
                responseBody = parsedBody;
              } catch {
                // Keep raw text when response is not JSON
              }

              const responseHeaders: Record<string, string> = {};
              upstream.headers.forEach((value, key) => {
                responseHeaders[key] = value;
              });
              if (!responseHeaders["content-type"]) {
                responseHeaders["content-type"] = "application/json";
              }

              return new Response(
                JSON.stringify({
                  status: upstream.status,
                  statusText: upstream.statusText,
                  headers: responseHeaders,
                  body: responseBody,
                }),
                {
                  status: 200,
                  headers: { "Content-Type": "application/json" },
                }
              );
            }
          }
        } catch {
          // Fall through on parsing error
        }
      }

      // Case 2: Direct token requests in standalone mode
      const rawDirectBody =
        typeof init?.body === "string"
          ? init.body
          : init?.body instanceof URLSearchParams
            ? init.body.toString()
            : undefined;

      const isTokenRequest =
        method === "POST" &&
        (/\/(?:oauth2?\/)?token\/?$/i.test(urlStr) ||
          Boolean(rawDirectBody && rawDirectBody.includes("grant_type=")));

      if (isTokenRequest) {
        const headers = new Headers(
          init?.headers ||
            (typeof input === "object" && "headers" in input
              ? (input.headers as HeadersInit)
              : undefined)
        );

        if (urlStr.includes(".ngrok") && !headers.has("ngrok-skip-browser-warning")) {
          headers.set("ngrok-skip-browser-warning", "true");
        }

        if (!headers.has("Authorization") && rawDirectBody !== undefined) {
          const authResult = applyBasicAuthToFormBody(rawDirectBody, headers, urlStr);
          if (authResult.applied) {
            if (!headers.has("content-type")) {
              headers.set("content-type", "application/x-www-form-urlencoded");
            }
            return await fetchWithLocalProxyFallback(
              originalFetch,
              urlStr,
              {
                ...init,
                body: authResult.body,
                headers,
              },
              urlStr,
              true
            );
          }
        }
      }

      // Case 3: Any other direct request to ngrok
      if (urlStr.includes(".ngrok")) {
        const headers = new Headers(
          init?.headers ||
            (typeof input === "object" && "headers" in input
              ? (input.headers as HeadersInit)
              : undefined)
        );
        if (!headers.has("ngrok-skip-browser-warning")) {
          headers.set("ngrok-skip-browser-warning", "true");
          return await originalFetch(input, { ...init, headers });
        }
      }
    } catch {
      // Fallback silently to original fetch on any error
    }

    return originalFetch(input, init);
  };

  forkOAuthFetch.__forkOAuthInterceptor = true;
  window.fetch = forkOAuthFetch;
}
