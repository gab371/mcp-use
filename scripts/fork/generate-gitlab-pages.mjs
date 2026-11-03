#!/usr/bin/env node

/**
 * Generate GitLab Pages deployment artifacts with robust SPA redirect handling.
 *
 * Solves infinite redirection loops (`/inspector/inspector/...`) on GitLab Pages
 * during OAuth callback flows and deep-linked SPA navigation by generating:
 *  - public/index.html: Safe root redirect to /inspector/
 *  - public/404.html: Global GitLab Pages SPA 404 handler with _spa_route query forwarding
 *  - public/inspector/404.html: Subdirectory 404 fallback
 *  - public/inspector/oauth/callback/index.html: Direct HTTP 200 static endpoint for OAuth callbacks
 *  - public/inspector/auth/callback/index.html: Direct HTTP 200 static endpoint for auth callbacks
 *  - public/oauth/callback/index.html: Legacy callback alias
 *  - public/auth/callback/index.html: Legacy callback alias
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../..");

const distDir = path.resolve(
  rootDir,
  "libraries/typescript/packages/inspector/dist/web"
);
const publicDir = path.resolve(rootDir, "public");
const publicInspectorDir = path.resolve(publicDir, "inspector");

if (!fs.existsSync(distDir)) {
  console.error(`❌ Build output not found at: ${distDir}`);
  console.error("   Please run vite build first.");
  process.exit(1);
}

// 1. Ensure public/inspector directory exists and copy dist/web contents
fs.mkdirSync(publicInspectorDir, { recursive: true });
fs.cpSync(distDir, publicInspectorDir, { recursive: true });
console.log(`✅ Copied dist/web to ${publicInspectorDir}`);

// 2. HTML Templates

// Root redirect page (public/index.html)
const rootIndexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Redirecting to MCP Inspector...</title>
  <script>
    (function() {
      var pathname = window.location.pathname.replace(/\\/+$/, "").replace(/(\\/inspector)+/g, "/inspector");
      var targetBase = pathname.endsWith("/inspector") ? pathname : pathname + "/inspector";
      window.location.replace(targetBase + "/" + window.location.search + window.location.hash);
    })();
  </script>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #09090b; color: #fafafa; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
  <p>Redirecting to <a href="./inspector/" style="color: #60a5fa;">MCP Inspector</a>...</p>
</body>
</html>
`;

// Global 404 / SPA redirect page (public/404.html)
const spaRedirectHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>MCP Inspector</title>
  <script>
    (function() {
      var pathname = window.location.pathname;
      // Do not redirect missing static assets
      if (/\\.(js|css|png|jpg|jpeg|gif|svg|ico|json|woff|woff2|ttf|map)$/i.test(pathname)) {
        return;
      }

      // Collapse any repeated /inspector/ segments caused by legacy relative redirects
      var cleanPath = pathname.replace(/(\\/inspector)+/g, "/inspector");
      var marker = "/inspector";
      var idx = cleanPath.indexOf(marker);
      var projectBase = "";
      var subPath = "";

      if (idx !== -1) {
        projectBase = cleanPath.slice(0, idx).replace(/\\/+$/, "");
        subPath = cleanPath.slice(idx + marker.length);
      } else {
        var match = cleanPath.match(/^(\\/.*?)\\/(oauth\\/callback|auth\\/callback)(.*)$/);
        if (match) {
          projectBase = match[1].replace(/\\/+$/, "");
          subPath = "/" + match[2] + (match[3] || "");
        } else if (cleanPath === "/oauth/callback" || cleanPath === "/auth/callback") {
          projectBase = "";
          subPath = cleanPath;
        } else {
          projectBase = cleanPath.replace(/\\/+$/, "");
          subPath = "";
        }
      }

      subPath = subPath.replace(/^\\/+/, "");
      var inspectorBase = (projectBase ? projectBase : "") + "/inspector";

      if (!subPath) {
        window.location.replace(inspectorBase + "/" + window.location.search + window.location.hash);
        return;
      }

      var search = window.location.search;
      var rawSearch = search.startsWith("?") ? search.slice(1) : search;
      var params = new URLSearchParams(rawSearch);
      params.set("_spa_route", "/" + subPath);

      var target = inspectorBase + "/?" + params.toString() + window.location.hash;
      window.location.replace(target);
    })();
  </script>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #09090b; color: #fafafa; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
  <p>Redirecting to <a href="./inspector/" style="color: #60a5fa;">MCP Inspector</a>...</p>
</body>
</html>
`;

// Write public/index.html
fs.writeFileSync(path.join(publicDir, "index.html"), rootIndexHtml);
console.log("✅ Written public/index.html");

// Write public/404.html and public/inspector/404.html
fs.writeFileSync(path.join(publicDir, "404.html"), spaRedirectHtml);
fs.writeFileSync(path.join(publicInspectorDir, "404.html"), spaRedirectHtml);
console.log("✅ Written public/404.html and public/inspector/404.html");

// Write static callback endpoints for direct HTTP 200 hits
const callbackEndpoints = [
  path.join(publicInspectorDir, "oauth", "callback"),
  path.join(publicInspectorDir, "auth", "callback"),
  path.join(publicDir, "oauth", "callback"),
  path.join(publicDir, "auth", "callback"),
];

for (const endpointDir of callbackEndpoints) {
  fs.mkdirSync(endpointDir, { recursive: true });
  fs.writeFileSync(path.join(endpointDir, "index.html"), spaRedirectHtml);
  console.log(`✅ Written ${path.relative(rootDir, endpointDir)}/index.html`);
}

console.log("🚀 GitLab Pages SPA files successfully generated.");
