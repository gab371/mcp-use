# FORK.md — Extended fork of mcp-use

> 📖 **Complete Fork Documentation:** See the [`docs/fork/`](docs/fork/README.md) directory for comprehensive user and developer guides:
> - 🧪 [Evaluations Guide (Evals)](docs/fork/evals.md)
> - 🎭 [Host Profiles Guide](docs/fork/host-profiles.md)
> - 🔐 [Enterprise OAuth & Confidential Clients Guide](docs/fork/oauth.md)
> - 🛡️ [Local CORS Proxy Guide](docs/fork/local-cors-proxy.md)
> - 📊 [Upstream Diff & Hooking Study](docs/fork/studies/upstream-diff-and-hooks-study.md)

## Why this fork

Enhanced mcp-use inspector with: host profiles emulation, evaluations testbench, removal of Manufact cloud/telemetry, confidential OAuth clients for Okta/enterprise, local CORS proxy, and containerized deployment.

## Rules

1. Our code only in `libraries/typescript/packages/inspector/src/client/fork/` and `libraries/typescript/packages/inspector/src/server/fork/`.
2. Upstream files: hook lines only, each with a `// fork: ...` comment, each listed below.
3. Never reformat or refactor upstream code.
4. Follow published inspector tags, not arbitrary `main` commits.

## Fork Flags

- `isManufactDisabled()` (`libraries/typescript/packages/inspector/src/client/fork/manufact.ts`): build-time / runtime flag, defaults to `true`. Disables Manufact cloud features and entry points.

## Hooks in upstream files

| File | What the hook does | Feature |
| ---- | ------------------ | ------- |
| `libraries/typescript/packages/inspector/src/client/App.tsx` | Provide HostProfileContext and wrap transport with active host metadata; sync confidential client secrets | Host Profiles, OAuth |
| `libraries/typescript/packages/inspector/src/client/components/ConnectionSettingsForm.tsx` | 2x2 connection buttons grid, LocalProxyAlert & LocalProxyHelpModal | Local Proxy |
| `libraries/typescript/packages/inspector/src/client/components/ConnectionSettingsTab.tsx` | Render EvalScopeSettingsCard under connection settings form | Evals |
| `libraries/typescript/packages/inspector/src/client/components/HostedUserMenu.tsx` | Render null to hide Manufact user avatar/menu | Cloud Removal |
| `libraries/typescript/packages/inspector/src/client/components/Layout.tsx` | Validate evals tab parameter | Evals |
| `libraries/typescript/packages/inspector/src/client/components/LayoutContent.tsx` | Register evals in ALL_KNOWN_TABS and mount EvalsTab | Evals |
| `libraries/typescript/packages/inspector/src/client/components/LayoutHeader.tsx` | Hide Manufact Deploy link; render HostProfileSelect in header | Cloud Removal, Host Profiles |
| `libraries/typescript/packages/inspector/src/client/components/ViewPreview.tsx` | Use profile hostInfo in bundle preview | Host Profiles |
| `libraries/typescript/packages/inspector/src/client/components/chat/useManagedCloudModel.ts` | Skip fetching cloud models from Manufact backend | Cloud Removal |
| `libraries/typescript/packages/inspector/src/client/components/layout/TunnelPopoverPanel.tsx` | Hide Manufact tunneling docs link | Cloud Removal |
| `libraries/typescript/packages/inspector/src/client/components/layout/layoutTabs.ts` | Add Evals tab definition to LAYOUT_TABS | Evals |
| `libraries/typescript/packages/inspector/src/client/components/layout/mobile/MobileInspectorToolbar.tsx` | Hide Manufact icon link in mobile toolbar | Cloud Removal |
| `libraries/typescript/packages/inspector/src/client/components/layout/sidebar/InspectorSidebarFooter.tsx` | Hide Manufact deployment CTA in sidebar footer | Cloud Removal |
| `libraries/typescript/packages/inspector/src/client/components/tools/ToolExecutionPanel.tsx` | Render HostProfileMetaBar | Host Profiles |
| `libraries/typescript/packages/inspector/src/client/context/InspectorContext.tsx` | Disable fallback to `cloud.manufact.com` and disable free-tier upgrade prompts; register evals in TabType | Cloud Removal, Evals |
| `libraries/typescript/packages/inspector/src/client/hooks/useMcpAppsHostContext.ts` | Overlay profile hostContext via `applyHostProfile` | Host Profiles |
| `libraries/typescript/packages/inspector/src/client/hooks/useViewHostProps.tsx` | Pass profile hostInfo, hostCapabilities, and openaiShim | Host Profiles |
| `libraries/typescript/packages/inspector/src/server/cli.ts` | Mount evals API routes; mount static oauth client routes | Evals, OAuth |
| `libraries/typescript/packages/inspector/src/server/create-dev-api-app.ts` | Mount evals API routes in dev mode; mount static oauth client routes | Evals, OAuth |
| `libraries/typescript/packages/inspector/src/server/inspector-shell.ts` | Default anonymized telemetry to false | Cloud Removal |
| `libraries/typescript/packages/inspector/src/server/proxy/oauth-proxy.ts` | Fall back to static client in applyConfidentialClientAuthentication and export canonicalUrl | OAuth |
| `libraries/typescript/packages/inspector/vite.config.ts` | Register forkStaticEvalsPlugin (copy eval suites + generate suites.json into web build) | Evals |

`git grep -n "fork:"` lists exactly the hook points in these 22 files.

## Update routine

```bash
scripts/fork-update.sh <inspector-tag>   # fetch, rebase, build, specs, list hooks
```

Last update: 2026-10-07, rebase onto `@mcp-use/inspector@20.3.15`, took 0m 21s (21s), conflicts: none.

## Build

### Local build from source

```bash
# From repository root
NPM_CONFIG_MANAGE_PACKAGE_MANAGER_VERSIONS=false pnpm --dir libraries/typescript install
NPM_CONFIG_MANAGE_PACKAGE_MANAGER_VERSIONS=false pnpm --dir libraries/typescript --filter @mcp-use/client build
NPM_CONFIG_MANAGE_PACKAGE_MANAGER_VERSIONS=false pnpm --dir libraries/typescript --filter @mcp-use/agent build
NPM_CONFIG_MANAGE_PACKAGE_MANAGER_VERSIONS=false pnpm --dir libraries/typescript --filter @mcp-use/inspector build

# Run inspector CLI
node libraries/typescript/packages/inspector/dist/cli.js --port 3000
```

### Local runner script (port 3017 with local root CA)

To run the inspector locally on port 3017 with the trusted root certificate in `.certificates/rootCA.pem` (supporting local HTTPS MCP servers signed by mkcert):

```bash
./scripts/fork/run-local.sh [--url <url>]
# e.g.: ./scripts/fork/run-local.sh --url https://localhost:8443/mcp
```

Alternatively, from within `libraries/typescript`:

```bash
cd libraries/typescript
pnpm install
pnpm --filter @mcp-use/client build
pnpm --filter @mcp-use/agent build
pnpm --filter @mcp-use/inspector build
cd ../..
node libraries/typescript/packages/inspector/dist/cli.js --port 3000
```

Tested with Node `v26.2.0` (engines requirement: `>=22.22.2`) and pnpm `10.28.0`.

### Local Docker image

```bash
docker build -f docker/inspector/Dockerfile -t mcp-inspector:local .
# Run with local server port forwarding and persistent evals data
docker run -p 3000:3000 \
  -e MCP_SERVER_PORT=8443 \
  -v $(pwd)/.evals:/app/.evals \
  mcp-inspector:local
```
