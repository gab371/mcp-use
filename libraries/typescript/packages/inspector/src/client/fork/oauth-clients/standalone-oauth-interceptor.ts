import { getForkOAuthSecret } from "./secrets-storage";

let interceptorInstalled = false;

/**
 * Installs a client-side fetch interceptor that injects confidential client_secret
 * directly into token exchange and refresh requests when running in standalone mode (no BFF backend).
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
      const urlStr = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const method = (init?.method || (typeof input === "object" && "method" in input ? input.method : "GET")).toUpperCase();

      // Check if this looks like a token request
      const isTokenRequest =
        method === "POST" &&
        (/\/(?:oauth\/)?token\/?$/i.test(urlStr) || (typeof init?.body === "string" && init.body.includes("grant_type=")));

      if (isTokenRequest) {
        const headers = new Headers(init?.headers || (typeof input === "object" && "headers" in input ? (input.headers as HeadersInit) : undefined));

        // Only inject if Authorization is not already explicitly set
        if (!headers.has("Authorization")) {
          let clientId: string | undefined;

          // Try to extract client_id from body if application/x-www-form-urlencoded
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
    } catch {
      // Fallback silently to original fetch on any error
    }

    return originalFetch(input, init);
  };
}
