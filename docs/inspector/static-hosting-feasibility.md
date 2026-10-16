# Technical Feasibility Study: Running MCP Inspector on GitHub Pages (Static Standalone)

## 1. Executive Summary

**Verdict: Feasible for the UI, but with critical runtime limitations.**

The frontend of `@mcp-use/inspector` is a Single Page Application (SPA) built with React, Vite, and Tailwind CSS. The client bundle can be compiled and hosted statically on GitHub Pages.

However, GitHub Pages provides **no backend runtime (no Node.js/container)**. Removing the Inspector's companion backend server disables several core features:
* **The built-in CORS proxy** is lost.
* **Mixed Content security restrictions** prevent an HTTPS GitHub Pages site from contacting local or unsecured HTTP servers (`http://localhost:*`).
* **OAuth BFF (Backend-for-Frontend)** token exchanges fail for non-public providers.
* **Fork Evals test suites** (`/evals/api/*`) cannot execute because they require Node.js filesystem access.

---

## 2. Inspector Architecture Overview

```
┌────────────────────────────────────────────────────────┐
│                   Browser (Client)                     │
│  - React 19 + Tailwind SPA                             │
│  - Tool/Prompt/Resource UI & MCP-UI Widget Previews    │
│  - LocalStorage (Connection state & history)           │
└───────────┬────────────────────────────────┬───────────┘
            │ Direct HTTP                    │ Proxy Mode
            │ (Requires CORS)                │ (CORS bypass)
            ▼                                ▼
┌──────────────────────┐        ┌─────────────────────────┐
│ Remote MCP Server    │        │  Inspector Backend Node │
│ (HTTPS + CORS)       │        │  - Hono API / Proxy     │
└──────────────────────┘        │  - OAuth BFF            │
                                │  - Evals Test Runner    │
                                └─────────────────────────┘
                                       ▲
                                       │
                         [MISSING ON GITHUB PAGES]
```

Under normal deployment (`npx @mcp-use/inspector` or Docker), the Inspector runs both:
1. **Static UI Client** (bundled via Vite)
2. **Node.js / Hono Backend** (`src/server/`):
   - `/inspector/api/proxy`: Bypasses CORS restrictions on arbitrary MCP endpoints.
   - `/inspector/api/oauth/*`: Handles OAuth handshakes, state verification, and client secrets.
   - `/evals/api/*`: Reads/writes test suites on disk (`.evals/`) and executes automated runs.

---

## 3. What Works on a Pure Static GitHub Pages Deployment

| Feature | Status | Notes |
| :--- | :---: | :--- |
| **Complete UI Dashboard** | ✅ Works | Tool explorer, schema visualizer, prompt renderers, elicitation modal, themes, and shortcuts. |
| **Direct Streamable HTTP** | ⚠️ Conditional | Works **only** if the target MCP server: <br>1. Is served over **HTTPS** (mandatory to avoid Mixed Content).<br>2. Has **CORS enabled** (`Access-Control-Allow-Origin: *` or whitelisting the GitHub Pages domain). |
| **MCP-UI & OpenAI Widgets** | ✅ Works | Sandboxed `<iframe>` rendering for widgets operates entirely client-side. |
| **BYOK LLM Chat** | ✅ Works | Direct browser-to-API calls (OpenAI, Anthropic) using user-supplied API keys. |
| **Session Persistence** | ✅ Works | Server configurations, histories, and tokens persist in browser `localStorage`. |

---

## 4. Key Limitations on GitHub Pages

### A. Mixed Content Barrier (HTTPS ➔ `http://localhost:*`)
* **Problem:** GitHub Pages is strictly served over `https://<organization>.github.io`. Browsers block direct `fetch` requests from HTTPS pages to unsecured HTTP endpoints (`http://localhost:3000/mcp` or internal intranet services).
* **Impact:** Developers **cannot** use a GitHub Pages Inspector to test local development servers unless they route traffic through an external HTTPS tunnel (e.g., Cloudflare Tunnel, ngrok).

### B. Loss of the CORS Proxy
* **Problem:** The Inspector backend includes an HTTP proxy (`mountMcpProxy`) that routes client requests through the server to bypass browser CORS constraints.
* **Impact:** Any MCP server that does not explicitly implement permissive CORS headers cannot be connected to from the browser.

### C. OAuth BFF Unavailability
* **Problem:** The OAuth proxy (`/inspector/api/oauth`) securely exchanges authorization codes and handles client credentials.
* **Impact:** Only public OAuth providers supporting pure client-side PKCE with permissive CORS can function.

### D. Automated Evals Runner Disabled
* **Problem:** Evals require reading `.evals/suites/*.yaml`, writing results to `.evals/runs/`, and executing LLM evaluations via the Node backend.
* **Impact:** The Evals tab and testing pipeline will fail or must be disabled.

### E. No `stdio` Transport
* **Problem:** Browser sandboxes cannot spawn or pipe to local CLI processes (`npx ...`, `uvx ...`).

---

## 5. Implementation Requirements (If Pursued)

If you decide to deploy the client to GitHub Pages, the following adjustments are required:

1. **Vite Base Path:**
   Configure `base` in `vite.app.config.ts` or `vite.config.ts` to match your repository name:
   ```typescript
   base: process.env.GITHUB_PAGES ? '/<repo-name>/' : '/inspector/'
   ```
2. **SPA Routing on GitHub Pages:**
   GitHub Pages serves static files and returns a `404` error on direct access or reloads of subroutes (e.g., `/<repo>/preview/foo` or `/<repo>/oauth/callback`).
   * **Option A:** Switch `BrowserRouter` to `HashRouter` in `src/client/App.tsx`.
   * **Option B:** Add a `404.html` fallback script that redirects route paths to query parameters for `index.html`.
3. **Runtime Base Path Override:**
   Ensure `getInspectorBase()` and `window.__MCP_BASE_PATH__` correctly align with the GitHub Pages repository path.

---

## 6. Options Comparison Matrix

| Deployment Strategy | Infrastructure Cost | Localhost Debugging | CORS Proxy | OAuth BFF | Evals Runner |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **GitHub Pages (Static SPA)** | Free | ❌ (Mixed Content) | ❌ | ⚠️ (PKCE only) | ❌ |
| **Official Hosted (`inspector.mcp-use.com`)** | Free | ⚠️ (Requires Tunnel) | ✅ | ✅ | ❌ (Local files) |
| **Self-Hosted Docker (`mcpuse/inspector`)** | Low (PaaS / VM) | ✅ (Same host/VPN) | ✅ | ✅ | ✅ (Configurable) |
| **Local CLI (`npx @mcp-use/inspector`)** | None | ✅ Native | ✅ | ✅ | ✅ Full |

---

---

## 8. Update: Standalone Client Mode (Implemented in `fork/inspector-standalone`)

Following architecture review (`[feat 11]`), the Inspector now supports full client-side autonomy when the backend is absent:
1. **Secure-by-Default OAuth Secret Storage:**
   * Secrets are stored in `sessionStorage` by default (destroyed on tab close).
   * An optional *"Remember for 24h"* checkbox persists to `localStorage` with a hard 24h TTL auto-pruning.
   * Direct token request interceptor attaches the basic auth credentials client-side when contacting CORS-enabled authorization servers.
2. **Hybrid Client Evals Storage:**
   * If `/inspector/api/fork/evals/*` is unreachable, seamlessly switches to `localStorage`.
   * Ships pre-bundled test suites (`tool-routing`, `splittab`).
   * Provides UI buttons for **Import YAML** and **Export YAML** to manage test suites without local filesystem access.

