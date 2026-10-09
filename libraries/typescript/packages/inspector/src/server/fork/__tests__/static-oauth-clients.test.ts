import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import { Hono } from "hono";
import { RateLimiterMemory } from "rate-limiter-flexible";
import {
  registerStaticClient,
  getStaticClient,
  removeStaticClient,
  clearStaticClients,
  buildStaticClientKey,
} from "../oauth-clients/registry.js";
import {
  createStaticClientRoutes,
  mountStaticClientRoutes,
} from "../oauth-clients/routes.js";
import { mountOAuthProxy, canonicalUrl } from "../../proxy/oauth-proxy.js";

describe("static confidential oauth clients", () => {
  beforeEach(() => {
    clearStaticClients();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    clearStaticClients();
    vi.restoreAllMocks();
  });

  describe("registry", () => {
    it("registers and retrieves static client with basic auth by default", () => {
      registerStaticClient({
        serverUrl: "https://my-server.example.com/mcp",
        clientId: "client-123",
        clientSecret: "secret-abc",
      });

      const bindingKey = canonicalUrl(new URL("https://my-server.example.com/mcp"));
      const retrieved = getStaticClient(bindingKey, "client-123");
      expect(retrieved).toBeDefined();
      expect(retrieved?.clientSecret).toBe("secret-abc");
      expect(retrieved?.authMethod).toBe("client_secret_basic");
      expect(retrieved?.expiresAt).toBe(Infinity);

      // Retrieval with combined key
      const directKey = `${bindingKey}\u0000client-123`;
      expect(getStaticClient(directKey)).toEqual(retrieved);
    });

    it("supports client_secret_post authMethod", () => {
      registerStaticClient({
        serverUrl: "https://my-server.example.com/mcp",
        clientId: "client-post",
        clientSecret: "secret-xyz",
        authMethod: "client_secret_post",
      });

      const client = getStaticClient("https://my-server.example.com/mcp", "client-post");
      expect(client?.authMethod).toBe("client_secret_post");
    });

    it("removes client by serverUrl and clientId", () => {
      registerStaticClient({
        serverUrl: "https://my-server.example.com/mcp",
        clientId: "client-123",
        clientSecret: "secret-abc",
      });

      removeStaticClient("https://my-server.example.com/mcp", "client-123");
      expect(getStaticClient("https://my-server.example.com/mcp", "client-123")).toBeUndefined();
    });

    it("removes all clients for a serverUrl when clientId is omitted", () => {
      registerStaticClient({
        serverUrl: "https://my-server.example.com/mcp",
        clientId: "client-1",
        clientSecret: "secret-1",
      });
      registerStaticClient({
        serverUrl: "https://my-server.example.com/mcp",
        clientId: "client-2",
        clientSecret: "secret-2",
      });

      removeStaticClient("https://my-server.example.com/mcp");
      expect(getStaticClient("https://my-server.example.com/mcp", "client-1")).toBeUndefined();
      expect(getStaticClient("https://my-server.example.com/mcp", "client-2")).toBeUndefined();
    });

    it("normalizes canonical URLs with ports and trailing slashes", () => {
      registerStaticClient({
        serverUrl: "https://my-server.example.com:443/mcp/",
        clientId: "c1",
        clientSecret: "s1",
      });

      const client = getStaticClient("https://my-server.example.com/mcp", "c1");
      expect(client).toBeDefined();
      expect(client?.clientSecret).toBe("s1");
    });
  });

  describe("routes", () => {
    let app: Hono;

    beforeEach(() => {
      app = new Hono();
      mountStaticClientRoutes(app, {
        allowLoopback: true,
        allowedOrigins: ["https://trusted-origin.example.com"],
      });
    });

    it("registers client via PUT /inspector/api/fork/oauth/clients without echoing secret", async () => {
      const res = await app.request("/inspector/api/fork/oauth/clients", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serverUrl: "https://localhost:8443/mcp",
          clientId: "client-abc",
          clientSecret: "top-secret",
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json<Record<string, unknown>>();
      expect(data).toEqual({ ok: true });
      expect(JSON.stringify(data)).not.toContain("top-secret");

      // Verify registry has it
      const client = getStaticClient("https://localhost:8443/mcp", "client-abc");
      expect(client?.clientSecret).toBe("top-secret");
    });

    it("rejects invalid serverUrl on PUT", async () => {
      const res = await app.request("/inspector/api/fork/oauth/clients", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serverUrl: "not-a-valid-url",
          clientId: "client-abc",
          clientSecret: "top-secret",
        }),
      });

      expect(res.status).toBe(400);
      const data = await res.json<{ error: string }>();
      expect(data.error).toBeDefined();
    });

    it("rejects non-HTTPS URL on PUT when loopback is disallowed", async () => {
      const strictApp = new Hono();
      mountStaticClientRoutes(strictApp, { allowLoopback: false });

      const res = await strictApp.request("/inspector/api/fork/oauth/clients", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serverUrl: "http://localhost:8080/mcp",
          clientId: "c",
          clientSecret: "s",
        }),
      });

      expect(res.status).toBe(400);
    });

    it("rejects missing clientId or clientSecret on PUT", async () => {
      const resNoId = await app.request("/inspector/api/fork/oauth/clients", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serverUrl: "https://localhost:8443/mcp",
          clientSecret: "top-secret",
        }),
      });
      expect(resNoId.status).toBe(400);

      const resNoSecret = await app.request("/inspector/api/fork/oauth/clients", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serverUrl: "https://localhost:8443/mcp",
          clientId: "client-abc",
        }),
      });
      expect(resNoSecret.status).toBe(400);
    });

    it("deletes client via DELETE /inspector/api/fork/oauth/clients", async () => {
      registerStaticClient({
        serverUrl: "https://localhost:8443/mcp",
        clientId: "client-del",
        clientSecret: "secret-del",
      });

      const res = await app.request("/inspector/api/fork/oauth/clients", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serverUrl: "https://localhost:8443/mcp",
          clientId: "client-del",
        }),
      });

      expect(res.status).toBe(200);
      expect(getStaticClient("https://localhost:8443/mcp", "client-del")).toBeUndefined();
    });

    it("enforces allowed origin check", async () => {
      // Disallowed origin returns 403
      const forbiddenRes = await app.request("/inspector/api/fork/oauth/clients", {
        method: "PUT",
        headers: {
          Origin: "https://evil-attacker.example.com",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          serverUrl: "https://localhost:8443/mcp",
          clientId: "c",
          clientSecret: "s",
        }),
      });
      expect(forbiddenRes.status).toBe(403);

      // Allowed origin succeeds and sets CORS headers
      const allowedRes = await app.request("/inspector/api/fork/oauth/clients", {
        method: "PUT",
        headers: {
          Origin: "https://trusted-origin.example.com",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          serverUrl: "https://localhost:8443/mcp",
          clientId: "c",
          clientSecret: "s",
        }),
      });
      expect(allowedRes.status).toBe(200);
      expect(allowedRes.headers.get("access-control-allow-origin")).toBe(
        "https://trusted-origin.example.com"
      );
    });

    it("handles OPTIONS preflight requests", async () => {
      const res = await app.request("/inspector/api/fork/oauth/clients", {
        method: "OPTIONS",
        headers: {
          Origin: "https://trusted-origin.example.com",
        },
      });
      expect(res.status).toBe(204);
      expect(res.headers.get("access-control-allow-origin")).toBe(
        "https://trusted-origin.example.com"
      );
      expect(res.headers.get("access-control-allow-methods")).toContain("PUT");
    });

    it("applies rate limiting and returns 429 when budget is exhausted", async () => {
      const rateLimitedApp = new Hono();
      const limiter = new RateLimiterMemory({ points: 2, duration: 60 });
      mountStaticClientRoutes(rateLimitedApp, {
        allowLoopback: true,
        rateLimiter: limiter,
      });

      const makeReq = () =>
        rateLimitedApp.request("/inspector/api/fork/oauth/clients", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            serverUrl: "https://localhost:8443/mcp",
            clientId: "c",
            clientSecret: "s",
          }),
        });

      const r1 = await makeReq();
      expect(r1.status).toBe(200);
      const r2 = await makeReq();
      expect(r2.status).toBe(200);
      const r3 = await makeReq();
      expect(r3.status).toBe(429);
      expect(r3.headers.get("retry-after")).toBeDefined();
    });
  });

  describe("BFF OAuth proxy integration", () => {
    let proxyApp: Hono;
    const serverUrl = "https://localhost:8443/mcp";
    const authIssuer = "https://localhost:9000";
    const tokenUrl = "https://localhost:9000/oauth/v1/token";

    beforeEach(() => {
      proxyApp = new Hono();
      mountOAuthProxy(proxyApp, {
        basePath: "/oauth",
        allowLoopback: true,
        allowedOrigins: [],
      });
    });

    function setupMetadataMocks() {
      const fetchMock = vi.fn(async (input: unknown, init?: RequestInit) => {
        const urlStr = String(input);

        // Protected resource metadata
        if (urlStr.includes(".well-known/oauth-protected-resource")) {
          return new Response(
            JSON.stringify({
              resource: serverUrl,
              authorization_servers: [authIssuer],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }

        // Auth server metadata
        if (urlStr.includes(".well-known/oauth-authorization-server") || urlStr.includes(".well-known/openid-configuration")) {
          return new Response(
            JSON.stringify({
              issuer: authIssuer,
              token_endpoint: tokenUrl,
              registration_endpoint: `${authIssuer}/oauth/register`,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }

        // Token endpoint upstream response
        if (urlStr === tokenUrl) {
          return new Response(
            JSON.stringify({
              access_token: "mock-access-token",
              token_type: "Bearer",
              expires_in: 3600,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }

        return new Response("Not found", { status: 404 });
      });

      vi.stubGlobal("fetch", fetchMock);
      return fetchMock;
    }

    it("injects Basic Authorization header and strips client_secret from body when static client is registered", async () => {
      const fetchMock = setupMetadataMocks();

      registerStaticClient({
        serverUrl,
        clientId: "okta-client-app",
        clientSecret: "okta-super-secret",
      });

      const tokenBody = new URLSearchParams({
        grant_type: "authorization_code",
        code: "sample-auth-code",
        client_id: "okta-client-app",
        redirect_uri: "http://localhost:3000/oauth/callback",
      }).toString();

      const res = await proxyApp.request("/oauth/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serverUrl,
          url: tokenUrl,
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: tokenBody,
        }),
      });

      expect(res.status).toBe(200);

      // Verify what was sent to the upstream token endpoint
      const upstreamCall = fetchMock.mock.calls.find(
        (call) => String(call[0]) === tokenUrl
      );
      expect(upstreamCall).toBeDefined();

      const headers = upstreamCall![1]?.headers as Headers;
      const expectedBasic = Buffer.from("okta-client-app:okta-super-secret", "utf8").toString("base64");
      expect(headers.get("authorization")).toBe(`Basic ${expectedBasic}`);

      const bodyStr = String(upstreamCall![1]?.body);
      const parsedParams = new URLSearchParams(bodyStr);
      expect(parsedParams.get("client_secret")).toBeNull();
      // RFC 6749 §2.3 / Okta: client_id MUST NOT be in the POST body when HTTP Basic Auth is used
      expect(parsedParams.get("client_id")).toBeNull();
      expect(parsedParams.get("code")).toBe("sample-auth-code");
    });

    it("supports client_secret_post and places secret into the body without Basic Authorization", async () => {
      const fetchMock = setupMetadataMocks();

      registerStaticClient({
        serverUrl,
        clientId: "post-client",
        clientSecret: "post-secret",
        authMethod: "client_secret_post",
      });

      const tokenBody = new URLSearchParams({
        grant_type: "authorization_code",
        code: "post-auth-code",
        client_id: "post-client",
      }).toString();

      const res = await proxyApp.request("/oauth/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serverUrl,
          url: tokenUrl,
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: tokenBody,
        }),
      });

      expect(res.status).toBe(200);

      const upstreamCall = fetchMock.mock.calls.find(
        (call) => String(call[0]) === tokenUrl
      );
      expect(upstreamCall).toBeDefined();

      const headers = upstreamCall![1]?.headers as Headers;
      expect(headers.get("authorization")).toBeNull();

      const bodyStr = String(upstreamCall![1]?.body);
      const parsedParams = new URLSearchParams(bodyStr);
      expect(parsedParams.get("client_id")).toBe("post-client");
      expect(parsedParams.get("client_secret")).toBe("post-secret");
    });

    it("leaves token request unchanged when no static or DCR client exists", async () => {
      const fetchMock = setupMetadataMocks();

      const tokenBody = new URLSearchParams({
        grant_type: "authorization_code",
        code: "public-code",
        client_id: "public-client-without-secret",
      }).toString();

      const res = await proxyApp.request("/oauth/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serverUrl,
          url: tokenUrl,
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: tokenBody,
        }),
      });

      expect(res.status).toBe(200);

      const upstreamCall = fetchMock.mock.calls.find(
        (call) => String(call[0]) === tokenUrl
      );
      expect(upstreamCall).toBeDefined();

      const headers = upstreamCall![1]?.headers as Headers;
      expect(headers.get("authorization")).toBeNull();

      const bodyStr = String(upstreamCall![1]?.body);
      const parsedParams = new URLSearchParams(bodyStr);
      expect(parsedParams.get("client_id")).toBe("public-client-without-secret");
      expect(parsedParams.get("client_secret")).toBeNull();
    });

    it("gives priority to DCR clients over static clients", async () => {
      const registrationUrl = `${authIssuer}/oauth/register`;
      const fetchMock = vi.fn(async (input: unknown, init?: RequestInit) => {
        const urlStr = String(input);

        if (urlStr.includes(".well-known/oauth-protected-resource")) {
          return new Response(
            JSON.stringify({
              resource: serverUrl,
              authorization_servers: [authIssuer],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }

        if (urlStr.includes(".well-known/oauth-authorization-server") || urlStr.includes(".well-known/openid-configuration")) {
          return new Response(
            JSON.stringify({
              issuer: authIssuer,
              token_endpoint: tokenUrl,
              registration_endpoint: registrationUrl,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }

        // DCR registration response
        if (urlStr === registrationUrl) {
          return new Response(
            JSON.stringify({
              client_id: "shared-client-id",
              client_secret: "dcr-secret-wins",
              token_endpoint_auth_method: "client_secret_basic",
            }),
            { status: 201, headers: { "Content-Type": "application/json" } }
          );
        }

        // Token endpoint
        if (urlStr === tokenUrl) {
          return new Response(
            JSON.stringify({
              access_token: "dcr-token",
              token_type: "Bearer",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }

        return new Response("Not found", { status: 404 });
      });

      vi.stubGlobal("fetch", fetchMock);

      // Register static client with same ID
      registerStaticClient({
        serverUrl,
        clientId: "shared-client-id",
        clientSecret: "static-secret-loses",
      });

      // 1. Perform DCR registration request through proxy
      const regRes = await proxyApp.request("/oauth/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serverUrl,
          url: registrationUrl,
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ redirect_uris: ["http://localhost:3000/oauth/callback"] }),
        }),
      });
      expect(regRes.status).toBe(200);
      const regJson = await regRes.json<{ status: number }>();
      expect(regJson.status).toBe(201);

      // 2. Perform token request with that client ID
      const tokenRes = await proxyApp.request("/oauth/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serverUrl,
          url: tokenUrl,
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            code: "xyz",
            client_id: "shared-client-id",
          }).toString(),
        }),
      });
      expect(tokenRes.status).toBe(200);

      // Upstream token call must have used dcr-secret-wins, not static-secret-loses
      const upstreamTokenCall = fetchMock.mock.calls.find(
        (call) => String(call[0]) === tokenUrl
      );
      expect(upstreamTokenCall).toBeDefined();
      const headers = upstreamTokenCall![1]?.headers as Headers;
      const expectedDcrBasic = Buffer.from("shared-client-id:dcr-secret-wins", "utf8").toString("base64");
      expect(headers.get("authorization")).toBe(`Basic ${expectedDcrBasic}`);
    });
  });
});
