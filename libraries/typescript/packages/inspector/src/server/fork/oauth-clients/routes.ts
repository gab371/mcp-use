import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Hono, type Context } from "hono";
import { RateLimiterMemory } from "rate-limiter-flexible";
import {
  INSPECTOR_API_RATE_LIMIT,
  INSPECTOR_RATE_LIMIT_WINDOW_SECONDS,
  inspectorRateLimitResponse,
} from "../../rate-limit.js";
import {
  registerStaticClient,
  removeStaticClient,
  type StaticClientAuthMethod,
} from "./registry.js";

export interface StaticClientRouteOptions {
  basePath?: string;
  allowLoopback?: boolean;
  allowedOrigins?: string[];
  rateLimiter?: RateLimiterMemory;
}

function normalizeOrigin(origin: string): string {
  const url = new URL(origin);
  if (url.pathname !== "/" || url.search || url.hash) {
    throw new Error(`OAuth allowed origin must be an origin: ${origin}`);
  }
  return url.origin;
}

function isAllowedOrigin(
  origin: string,
  c: Context,
  allowed: Set<string>
): boolean {
  try {
    const normalized = normalizeOrigin(origin);
    if (normalized === new URL(c.req.url).origin || allowed.has(normalized)) {
      return true;
    }

    const originUrl = new URL(normalized);
    const forwardedHost = c.req
      .header("x-forwarded-host")
      ?.split(",")[0]
      ?.trim();
    const requestHost = forwardedHost || c.req.header("host");
    if (!requestHost || originUrl.host !== requestHost) return false;

    const forwardedProto = c.req
      .header("x-forwarded-proto")
      ?.split(",")[0]
      ?.trim();
    return !forwardedProto || `${forwardedProto}:` === originUrl.protocol;
  } catch {
    return false;
  }
}

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized === "::1" ||
    normalized.startsWith("127.")
  );
}

function isLocalHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return (
    normalized.endsWith(".local") ||
    normalized.endsWith(".internal") ||
    normalized.endsWith(".home.arpa")
  );
}

function isPublicAddress(address: string): boolean {
  if (address.includes(":")) {
    const lower = address.toLowerCase();
    if (lower.startsWith("::ffff:")) {
      return isPublicAddress(lower.slice(7));
    }
    return !(
      lower === "::" ||
      lower === "::1" ||
      lower.startsWith("fc") ||
      lower.startsWith("fd") ||
      /^fe[89ab]/.test(lower) ||
      lower.startsWith("ff") ||
      lower.startsWith("2001:db8:")
    );
  }
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return false;
  }
  const [a, b, c] = parts;
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

export async function validateUrl(
  value: unknown,
  allowLoopback: boolean
): Promise<{ url: URL } | { error: string }> {
  if (typeof value !== "string" || !value) {
    return { error: "Missing or invalid URL" };
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { error: "Invalid URL" };
  }
  if (url.username || url.password || url.hash) {
    return { error: "URL credentials and fragments are not allowed" };
  }

  const loopback = isLoopbackHostname(url.hostname);
  if (url.protocol !== "https:") {
    if (!(allowLoopback && loopback && url.protocol === "http:")) {
      return { error: "HTTPS is required" };
    }
  }
  if (loopback) {
    return allowLoopback ? { url } : { error: "Loopback URL not allowed" };
  }
  if (isLocalHostname(url.hostname)) {
    return { error: "Local network URL not allowed" };
  }

  try {
    const addresses = isIP(url.hostname)
      ? [url.hostname]
      : (await lookup(url.hostname, { all: true, verbatim: true })).map(
          ({ address }) => address
        );
    if (
      addresses.length === 0 ||
      addresses.some((address) => !isPublicAddress(address))
    ) {
      return { error: "Private or non-routable URL not allowed" };
    }
  } catch {
    return { error: "URL hostname could not be resolved" };
  }
  return { url };
}

export function createStaticClientRoutes(options?: StaticClientRouteOptions): Hono {
  const router = new Hono();
  const allowLoopback =
    options?.allowLoopback ??
    (process.env.INSPECTOR_ALLOW_LOOPBACK
      ? process.env.INSPECTOR_ALLOW_LOOPBACK === "true"
      : process.env.NODE_ENV !== "production");

  const allowedOriginsSet = new Set(
    (options?.allowedOrigins ?? []).map(normalizeOrigin)
  );

  const rateLimiter =
    options?.rateLimiter ??
    new RateLimiterMemory({
      points: INSPECTOR_API_RATE_LIMIT,
      duration: INSPECTOR_RATE_LIMIT_WINDOW_SECONDS,
    });

  // Origin check, CORS, and rate limiting middleware
  router.use("/*", async (c, next) => {
    const origin = c.req.header("Origin");
    if (origin && !isAllowedOrigin(origin, c, allowedOriginsSet)) {
      return c.json({ error: "Origin not allowed" }, 403);
    }
    if (c.req.method === "OPTIONS") {
      const headers = new Headers();
      if (origin) {
        headers.set("Access-Control-Allow-Origin", origin);
        headers.append("Vary", "Origin");
      }
      headers.set("Access-Control-Allow-Methods", "PUT, DELETE, OPTIONS");
      headers.set(
        "Access-Control-Allow-Headers",
        "Accept, Authorization, Content-Type"
      );
      headers.set("Access-Control-Max-Age", "600");
      return new Response(null, { status: 204, headers });
    }

    try {
      await rateLimiter.consume(c.req as unknown as string);
    } catch (error) {
      return inspectorRateLimitResponse(c, error);
    }

    await next();

    if (origin) {
      c.header("Access-Control-Allow-Origin", origin);
      c.header("Vary", "Origin");
    }
  });

  const handlePut = async (c: Context) => {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const urlResult = await validateUrl(body.serverUrl, allowLoopback);
    if ("error" in urlResult) {
      return c.json({ error: urlResult.error }, 400);
    }

    if (typeof body.clientId !== "string" || !body.clientId.trim()) {
      return c.json({ error: "Missing or invalid clientId" }, 400);
    }

    if (typeof body.clientSecret !== "string" || !body.clientSecret.trim()) {
      return c.json({ error: "Missing or invalid clientSecret" }, 400);
    }

    if (
      body.authMethod !== undefined &&
      body.authMethod !== "client_secret_basic" &&
      body.authMethod !== "client_secret_post"
    ) {
      return c.json(
        {
          error:
            "Invalid authMethod: must be client_secret_basic or client_secret_post",
        },
        400
      );
    }

    const authMethod: StaticClientAuthMethod =
      body.authMethod ?? "client_secret_basic";

    registerStaticClient({
      serverUrl: urlResult.url,
      clientId: body.clientId.trim(),
      clientSecret: body.clientSecret.trim(),
      authMethod,
    });

    // Never log or return the client secret
    return c.json({ ok: true });
  };

  const handleDelete = async (c: Context) => {
    const body = await c.req.json().catch(() => null);
    const rawServerUrl =
      body && typeof body.serverUrl === "string"
        ? body.serverUrl
        : c.req.query("serverUrl");
    const rawClientId =
      body && typeof body.clientId === "string"
        ? body.clientId
        : c.req.query("clientId");

    if (!rawServerUrl) {
      return c.json({ error: "Missing serverUrl" }, 400);
    }

    const urlResult = await validateUrl(rawServerUrl, allowLoopback);
    if ("error" in urlResult) {
      return c.json({ error: urlResult.error }, 400);
    }

    const clientId =
      typeof rawClientId === "string" && rawClientId.trim()
        ? rawClientId.trim()
        : undefined;

    removeStaticClient(urlResult.url, clientId);

    // Never log or return the client secret
    return c.json({ ok: true });
  };

  router.put("/clients", handlePut);
  router.put("/clients/", handlePut);
  router.delete("/clients", handleDelete);
  router.delete("/clients/", handleDelete);

  return router;
}

/**
 * Mounts the static confidential OAuth client routes onto a Hono application instance.
 */
export function mountStaticClientRoutes(
  app: Hono,
  options?: StaticClientRouteOptions
): void {
  const router = createStaticClientRoutes(options);
  const basePath = options?.basePath ?? "";
  const mountPrefix = `${basePath}/inspector/api/fork/oauth`;
  app.route(mountPrefix, router);
}
