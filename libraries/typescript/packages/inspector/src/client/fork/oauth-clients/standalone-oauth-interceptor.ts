import { getForkOAuthSecret } from "./secrets-storage";

let interceptorInstalled = false;

/**
 * Installs a client-side fetch interceptor that:
 * 1. Resolves OAuth metadata and proxy requests client-side when no backend BFF is running (standalone mode).
 * 2. Injects confidential client_secret (HTTP Basic auth) directly into token requests.
 * 3. Bypasses ngrok free-tier warning page by injecting ngrok-skip-browser-warning header.
 */
export function installStandaloneOAuthInterceptor(): void {
  if (typeof window === "undefined" || interceptorInstalled) return;
  interceptorInstalled = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async function forkOAuthFetch(
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

      // Case 1: Intercept phantom OAuth BFF proxy requests (e.g. /inspector/api/oauth/metadata or /oauth/proxy)
      // When running on static hosting / Apache, these endpoints don't exist and would return HTML (404/index.html).
      // We unpack the target ?url=... parameter and fetch it directly in the browser.
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

            // Auto-bypass ngrok browser warning on target
            if (targetUrl.includes(".ngrok") && !headers.has("ngrok-skip-browser-warning")) {
              headers.set("ngrok-skip-browser-warning", "true");
            }

            // Check if this proxied call is a token exchange / refresh request
            const isToken =
              method === "POST" &&
              (/\/(?:oauth\/)?token\/?$/i.test(targetUrl) ||
                (typeof init?.body === "string" && init.body.includes("grant_type=")));

            if (isToken && !headers.has("Authorization")) {
              let clientId: string | undefined;
              if (typeof init?.body === "string") {
                const params = new URLSearchParams(init.body);
                clientId = params.get("client_id") || undefined;
              }
              const secretEntry = getForkOAuthSecret(serverUrl || targetUrl, clientId);
              if (secretEntry?.clientSecret && secretEntry.clientId) {
                headers.set(
                  "Authorization",
                  `Basic ${btoa(`${secretEntry.clientId}:${secretEntry.clientSecret}`)}`
                );
              }
            }

            const modifiedInit: RequestInit = {
              ...init,
              headers,
              cache: "no-store",
            };

            return await originalFetch(targetUrl, modifiedInit);
          }
        } catch {
          // Fall through on parsing error
        }
      }

      // Case 2: Direct token requests in standalone mode
      const isTokenRequest =
        method === "POST" &&
        (/\/(?:oauth\/)?token\/?$/i.test(urlStr) ||
          (typeof init?.body === "string" && init.body.includes("grant_type=")));

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

        if (!headers.has("Authorization")) {
          let clientId: string | undefined;
          if (typeof init?.body === "string") {
            const params = new URLSearchParams(init.body);
            clientId = params.get("client_id") || undefined;
          }

          const secretEntry = getForkOAuthSecret(urlStr, clientId);
          if (secretEntry?.clientSecret && secretEntry.clientId) {
            headers.set(
              "Authorization",
              `Basic ${btoa(`${secretEntry.clientId}:${secretEntry.clientSecret}`)}`
            );

            const modifiedInit: RequestInit = {
              ...init,
              headers,
            };

            return await originalFetch(input, modifiedInit);
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
}
