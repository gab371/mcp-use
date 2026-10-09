import { Hono } from "hono";
import { cors } from "hono/cors";
import { registerInspectorProxyRoutes } from "./proxy-routes.js";
import { mountEvalRoutes } from "./fork/evals/index.js"; // fork: feat 02 import evals routes

/** Hono app for inspector dev API routes (MCP proxy + OAuth BFF). */
export function createDevApiApp(): Hono {
  const app = new Hono();

  app.use(
    "*",
    cors({
      origin: "*",
      allowHeaders: [
        "Authorization",
        "Content-Type",
        "Accept",
        "X-Target-URL",
        "X-MCP-Target",
        "Mcp-Session-Id",
        "mcp-session-id",
        "mcp-protocol-version",
        "X-Server-Id",
        "X-Requested-With",
      ],
      exposeHeaders: ["*"],
    })
  );

  registerInspectorProxyRoutes(app, {
    oauthProxyAllowedOrigins: [],
    oauthProxyAllowLoopback: true,
  });

  mountEvalRoutes(app); // fork: feat 02 mount evals API

  return app;
}
