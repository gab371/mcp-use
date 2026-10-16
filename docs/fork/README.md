# Fork Documentation (`mcp-use`)

> Welcome to the technical documentation of the extended `mcp-use` fork.  
> This fork enriches the official MCP development and inspection toolkit with advanced capabilities tailored to enterprise engineering workflows and security constraints.

---

## 1. Why this fork?

The upstream `mcp-use` inspector is a great open-source developer tool, but has several limitations in enterprise environments:
- **No testing & evaluation framework:** Unable to automatically assess tool routing quality, argument stability, or LLM response compliance.
- **Generic execution environment:** Interactive tools and applications (MCP Apps / Views) behave differently across host clients—ChatGPT provides specific `_meta` fields, Söhne CSS variables, and a `window.openai` SDK shim, whereas Claude uses Anthropic Sans styling and distinct container constraints.
- **OAuth restricted to public clients:** Incompatible with enterprise identity providers (Okta, Ping Identity, Azure AD) that require confidential credentials (`client_secret_basic`).
- **External cloud dependency:** Includes promotional links, free-tier quotas, and telemetry targeting the third-party Manufact cloud platform, which is undesirable in isolated corporate networks.

This fork addresses each of these needs cleanly and modularly, while maintaining strict forward-compatibility with upstream `mcp-use` releases.

---

## 2. Detailed Guides

Explore the complete guides by domain:

| Guide | Description | Key Topics |
|---|---|---|
| 🧪 [**Evaluations Guide (Evals)**](evals.md) | Automated testbench for MCP servers and LLM models. | YAML suites, assertions (`toolCalled`, `goldenResult`, `goldenAnswer`, `argsNeverContain`), 1-click capture, UI runner, run history. |
| 🎭 [**Host Profiles Guide**](host-profiles.md) | High-fidelity client emulation for ChatGPT, Claude, and Claude Desktop. | Dynamic `_meta` injection (`openai/subject`, `locale`, GPS), CSS variables, widget preview, `window.openai` shim. |
| 🔐 [**OAuth & Confidential Clients Guide**](oauth.md) | Enterprise authentication with Okta, Ping Identity, and Azure AD. | `client_secret_basic` method, isolated browser secret store, BFF proxy, RFC 6749 §2.3 compliance. |
| 🛡️ [**Local CORS Proxy Guide**](local-cors-proxy.md) | Zero-dependency local proxy to bypass CORS in standalone / static mode. | Loopback execution (`127.0.0.1:3020`), Private Network Access, Ollama, macOS/Windows scripts. |
| 📊 [**Upstream Diff & Hooking Study**](studies/upstream-diff-and-hooks-study.md) | Audit of all lines of code modified outside of `/fork`. | Line count breakdown, hook locations, rebase immunity analysis. |

---

## 3. Architecture & Golden Rules of the Fork

To ensure fast, conflict-free rebases against upstream releases, this project follows four strict rules:

1. **Strict isolation:** 100% of custom logic lives in dedicated fork directories:
   - React Client: `libraries/typescript/packages/inspector/src/client/fork/`
   - Hono / CLI Server: `libraries/typescript/packages/inspector/src/server/fork/`
2. **Minimal tagged hooks:** Upstream files only contain single declarative hook lines, each tagged with `// fork: <plan_id> <reason>`.
3. **Zero modification to other packages:** `@mcp-use/client`, `@mcp-use/agent`, and `@mcp-use/cli` remain **100% identical to upstream** (zero modified files).
4. **Zero reformatting:** No blanket formatting or third-party code refactoring is applied to upstream files.

The complete registry of active hook points is tracked in [`FORK.md`](../../FORK.md).

---

## 4. Quick Start

### Option 1: Local Runner Script (Recommended with local root CA / mkcert)
To test local MCP servers secured with local HTTPS and mkcert:

```bash
# Starts the inspector on port 3017 while injecting the local root CA certificate
./scripts/fork/run-local.sh --url https://localhost:8443/mcp
```
The web interface opens automatically at `http://localhost:3017/inspector`.

---

### Option 2: Build from Source
```bash
# From the repository root
NPM_CONFIG_MANAGE_PACKAGE_MANAGER_VERSIONS=false pnpm --dir libraries/typescript install
NPM_CONFIG_MANAGE_PACKAGE_MANAGER_VERSIONS=false pnpm --dir libraries/typescript --filter @mcp-use/client build
NPM_CONFIG_MANAGE_PACKAGE_MANAGER_VERSIONS=false pnpm --dir libraries/typescript --filter @mcp-use/agent build
NPM_CONFIG_MANAGE_PACKAGE_MANAGER_VERSIONS=false pnpm --dir libraries/typescript --filter @mcp-use/inspector build

# Run the Inspector CLI
node libraries/typescript/packages/inspector/dist/cli.js --port 3000
```

---

### Option 3: Docker Container
A production-ready Docker image is available for containerized internal deployments:

```bash
# Build the container image
docker build -f docker/inspector/Dockerfile -t mcp-inspector:local .

# Run with persistent volume for evaluations
docker run -p 3000:3000 \
  -e MCP_SERVER_PORT=8443 \
  -v $(pwd)/.evals:/app/.evals \
  mcp-inspector:local
```

---

## 5. Maintenance Routine (Upstream Rebase)

To synchronize the fork with a new upstream Inspector release tag:

```bash
./scripts/fork-update.sh <inspector-tag>
# Example:
./scripts/fork-update.sh @mcp-use/inspector@20.3.15
```

This script verifies the tag, executes the git rebase, rebuilds packages, runs all unit tests, and validates the exact list of active hook lines.
