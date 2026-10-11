# FORK.md — Extended fork of mcp-use

> 📖 **Complete Fork Documentation:** See the [`docs/fork/`](docs/fork/README.md) directory for comprehensive user and developer guides:
> - 🧪 [Evaluations Guide (Evals)](docs/fork/evals.md)
> - 🎭 [Host Profiles Guide](docs/fork/host-profiles.md)
> - 🔐 [Enterprise OAuth & Confidential Clients Guide](docs/fork/oauth.md)

## Why this fork

Enhanced mcp-use inspector with: host profiles (feat 01), evals (feat 02), no Manufact cloud (chore 02), confidential OAuth clients for Okta/enterprise (feat 04), containerized deployment (tech 01).

## Rules

1. Our code only in `libraries/typescript/packages/inspector/src/client/fork/` and `libraries/typescript/packages/inspector/src/server/fork/`.
2. Upstream files: hook lines only, each with a `// fork: <plan id> <reason>` comment, each listed below.
3. Never reformat or refactor upstream code.
4. Follow published inspector tags, not arbitrary `main` commits.

## Fork Flags

- `isManufactDisabled()` (`libraries/typescript/packages/inspector/src/client/fork/manufact.ts`): build-time / runtime flag, defaults to `true`. Disables Manufact cloud features and entry points.

## Hooks in upstream files

| File | What the hook does | Plan |
| ---- | ------------------ | ---- |
| `libraries/typescript/packages/inspector/src/client/App.tsx` | Provide HostProfileContext and wrap transport with active host metadata (feat 01); sync confidential client secrets (feat 04) | feat 01, feat 04 |
| `libraries/typescript/packages/inspector/src/client/components/HostedUserMenu.tsx` | Render null to hide Manufact user avatar/menu | chore 02 |
| `libraries/typescript/packages/inspector/src/client/components/Layout.tsx` | Validate evals tab parameter | feat 02 |
| `libraries/typescript/packages/inspector/src/client/components/LayoutContent.tsx` | Register evals in ALL_KNOWN_TABS and mount EvalsTab | feat 02 |
| `libraries/typescript/packages/inspector/src/client/components/LayoutHeader.tsx` | Hide Manufact Deploy link (chore 02); render HostProfileSelect in header (feat 01) | chore 02, feat 01 |
| `libraries/typescript/packages/inspector/src/client/components/ViewPreview.tsx` | Use profile hostInfo in bundle preview | feat 01 |
| `libraries/typescript/packages/inspector/src/client/components/chat/useManagedCloudModel.ts` | Skip fetching cloud models from Manufact backend | chore 02 |
| `libraries/typescript/packages/inspector/src/client/components/layout/TunnelPopoverPanel.tsx` | Hide Manufact tunneling docs link | chore 02 |
| `libraries/typescript/packages/inspector/src/client/components/layout/layoutTabs.ts` | Add Evals tab definition to LAYOUT_TABS | feat 02 |
| `libraries/typescript/packages/inspector/src/client/components/layout/mobile/MobileInspectorToolbar.tsx` | Hide Manufact icon link in mobile toolbar | chore 02 |
| `libraries/typescript/packages/inspector/src/client/components/layout/sidebar/InspectorSidebarFooter.tsx` | Hide Manufact deployment CTA in sidebar footer | chore 02 |
| `libraries/typescript/packages/inspector/src/client/components/tools/ToolExecutionPanel.tsx` | Render HostProfileMetaBar | feat 01 |
| `libraries/typescript/packages/inspector/src/client/context/InspectorContext.tsx` | Disable fallback to `cloud.manufact.com` and disable free-tier upgrade prompts (chore 02); register evals in TabType (feat 02) | chore 02, feat 02 |
| `libraries/typescript/packages/inspector/src/client/hooks/useMcpAppsHostContext.ts` | Overlay profile hostContext via `applyHostProfile` | feat 01 |
| `libraries/typescript/packages/inspector/src/client/hooks/useViewHostProps.tsx` | Pass profile hostInfo, hostCapabilities, and openaiShim | feat 01 |
| `libraries/typescript/packages/inspector/src/server/cli.ts` | Mount evals API routes (feat 02); mount static oauth client routes (feat 04) | feat 02, feat 04 |
| `libraries/typescript/packages/inspector/src/server/create-dev-api-app.ts` | Mount evals API routes in dev mode (feat 02); mount static oauth client routes (feat 04) | feat 02, feat 04 |
| `libraries/typescript/packages/inspector/src/server/inspector-shell.ts` | Default anonymized telemetry to false | chore 02 |
| `libraries/typescript/packages/inspector/src/server/proxy/oauth-proxy.ts` | Fall back to static client in applyConfidentialClientAuthentication and export canonicalUrl | feat 04 |

`git grep -n "fork:"` must list exactly these lines.

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
