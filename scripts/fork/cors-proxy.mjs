#!/usr/bin/env node

/**
 * Lightweight local CORS proxy for MCP Inspector, Ollama, and OpenAI-compatible servers.
 *
 * Runs 100% locally on Node.js without any external npm dependencies.
 * Zero data is sent to external servers. All traffic stays on loopback (127.0.0.1).
 *
 * Supported Target Formats:
 * 1. Native mcp-use header:  X-Target-URL: https://target.server/mcp
 * 2. Query parameter:        http://127.0.0.1:3001/?url=https://target.server/mcp
 * 3. Path prefix:            http://127.0.0.1:3001/https://target.server/mcp
 */

import http from "node:http";
import https from "node:https";
import { URL } from "node:url";

const args = process.argv.slice(2);
function getArg(flag, defaultValue) {
  const index = args.indexOf(flag);
  if (index !== -1 && args[index + 1]) {
    return args[index + 1];
  }
  return defaultValue;
}

const PORT = parseInt(process.env.PORT || getArg("--port", "3001"), 10);
const HOST = process.env.HOST || getArg("--host", "127.0.0.1");

function getTargetUrl(req) {
  // 1. Check X-Target-URL header (standard in mcp-use proxy transport)
  const headerTarget = req.headers["x-target-url"];
  if (typeof headerTarget === "string" && headerTarget.trim()) {
    return headerTarget.trim();
  }

  // 2. Parse request URL
  const parsed = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);

  // 2a. Query parameter: ?url=https://...
  const queryUrl = parsed.searchParams.get("url");
  if (queryUrl && queryUrl.trim()) {
    return queryUrl.trim();
  }

  // 2b. Path prefix: /https://... or /proxy/https://...
  let rawPath = parsed.pathname;
  if (rawPath.startsWith("/proxy/")) {
    rawPath = rawPath.slice(7);
  } else if (rawPath.startsWith("/")) {
    rawPath = rawPath.slice(1);
  }

  if (rawPath.startsWith("http://") || rawPath.startsWith("https://")) {
    return rawPath + parsed.search;
  }

  return null;
}

function setCorsHeaders(req, res) {
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  if (origin !== "*") {
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }

  const reqHeaders = req.headers["access-control-request-headers"];
  res.setHeader(
    "Access-Control-Allow-Headers",
    reqHeaders || "*, Content-Type, Authorization, Mcp-Session-Id, MCP-Protocol-Version, Last-Event-ID, X-Target-URL, X-Server-Id, ngrok-skip-browser-warning"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD"
  );
  res.setHeader("Access-Control-Allow-Private-Network", "true");
  res.setHeader("Access-Control-Max-Age", "86400");
  res.setHeader(
    "Access-Control-Expose-Headers",
    "*, Mcp-Session-Id, MCP-Protocol-Version, WWW-Authenticate, Location"
  );
}

const server = http.createServer((req, res) => {
  setCorsHeaders(req, res);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const targetUrl = getTargetUrl(req);

  // Home status page if no target URL is specified
  if (!targetUrl) {
    if (req.url === "/" || req.url === "") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>MCP Local CORS Proxy</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #09090b; color: #f4f4f5; max-width: 800px; margin: 40px auto; padding: 0 20px; line-height: 1.6; }
    h1 { color: #38bdf8; font-size: 1.8rem; }
    code { background: #27272a; padding: 2px 6px; border-radius: 4px; color: #a5f3fc; }
    pre { background: #18181b; padding: 16px; border-radius: 8px; overflow-x: auto; border: 1px solid #27272a; }
    .badge { display: inline-block; padding: 4px 8px; border-radius: 9999px; font-size: 0.8rem; font-weight: 600; background: #065f46; color: #a7f3d0; margin-bottom: 12px; }
    .card { background: #18181b; border: 1px solid #27272a; border-radius: 8px; padding: 16px; margin: 16px 0; }
  </style>
</head>
<body>
  <div class="badge">● Proxy Active & Running</div>
  <h1>MCP Local CORS Proxy</h1>
  <p>100% local — zero data is sent outside your machine (bound to <code>127.0.0.1:${PORT}</code>).</p>
  
  <div class="card">
    <h3>👉 How to use in MCP Inspector</h3>
    <ol>
      <li>In the Inspector Connection form, set <strong>Connection Mode</strong> to <strong>Proxy</strong> (or Auto).</li>
      <li>Set <strong>Proxy Address</strong> to: <code>http://localhost:${PORT}</code></li>
      <li>Enter your target MCP server URL (e.g., <code>https://localhost:8443/mcp</code> or <code>http://localhost:11434</code>).</li>
    </ol>
  </div>

  <div class="card">
    <h3>🔗 Generic HTTP / Curl usage</h3>
    <pre>curl "http://127.0.0.1:${PORT}/?url=https://localhost:8443/mcp"</pre>
    <p>Or with mcp-use header:</p>
    <pre>curl -H "X-Target-URL: https://localhost:8443/mcp" http://127.0.0.1:${PORT}</pre>
  </div>
</body>
</html>`);
      return;
    }

    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: "Missing target URL",
        usage: [
          `Header: X-Target-URL: https://target-url`,
          `Query:  http://127.0.0.1:${PORT}/?url=https://target-url`,
          `Path:   http://127.0.0.1:${PORT}/https://target-url`,
        ],
      })
    );
    return;
  }

  let parsedTarget;
  try {
    parsedTarget = new URL(targetUrl);
  } catch (err) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: `Invalid target URL: ${targetUrl}` }));
    return;
  }

  // Prepare forwarded headers
  const forwardedHeaders = { ...req.headers };
  delete forwardedHeaders.host;
  delete forwardedHeaders["x-target-url"];
  // Strip client origin so target server does not reject on its own CORS filter
  delete forwardedHeaders.origin;

  forwardedHeaders.host = parsedTarget.host;

  // Auto-bypass ngrok browser warning if target is ngrok
  if (parsedTarget.hostname.includes("ngrok") && !forwardedHeaders["ngrok-skip-browser-warning"]) {
    forwardedHeaders["ngrok-skip-browser-warning"] = "true";
  }

  const isHttps = parsedTarget.protocol === "https:";
  const clientLib = isHttps ? https : http;

  const isLocalHost =
    parsedTarget.hostname === "localhost" ||
    parsedTarget.hostname === "127.0.0.1" ||
    parsedTarget.hostname.endsWith(".local");

  const options = {
    protocol: parsedTarget.protocol,
    hostname: parsedTarget.hostname,
    port: parsedTarget.port || (isHttps ? 443 : 80),
    path: parsedTarget.pathname + parsedTarget.search,
    method: req.method,
    headers: forwardedHeaders,
    // Allow self-signed certificates for local development servers
    rejectUnauthorized: !isLocalHost,
  };

  const proxyReq = clientLib.request(options, (proxyRes) => {
    setCorsHeaders(req, res);

    // Forward status and headers
    const responseHeaders = { ...proxyRes.headers };
    // Remove headers handled directly
    delete responseHeaders["access-control-allow-origin"];
    delete responseHeaders["access-control-allow-credentials"];
    delete responseHeaders["access-control-allow-headers"];
    delete responseHeaders["access-control-allow-methods"];

    res.writeHead(proxyRes.statusCode || 200, responseHeaders);

    // Stream response directly to client (supports SSE chunks and long polling)
    proxyRes.pipe(res);
  });

  proxyReq.on("error", (err) => {
    setCorsHeaders(req, res);
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: "Bad Gateway",
        message: `Failed to proxy request to ${targetUrl}: ${err.message}`,
      })
    );
  });

  // Forward request body stream to target
  req.pipe(proxyReq);
});

server.listen(PORT, HOST, () => {
  console.log(`
🚀 MCP Local CORS Proxy running at http://${HOST}:${PORT}
🔒 100% local — zero data sent outside
👉 Use in Inspector Proxy Address: http://localhost:${PORT}
`);
});
