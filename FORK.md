# FORK.md — Extended fork of mcp-use

## Why this fork

Internal, shared mcp-use inspector with: host profiles (feat 01), evals (feat 02), no Manufact cloud (chore 02), shared deployment (tech 01).

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
| `libraries/typescript/packages/inspector/src/client/context/InspectorContext.tsx` | Disable fallback to `cloud.manufact.com` and disable free-tier upgrade prompts | chore 02 |
| `libraries/typescript/packages/inspector/src/client/components/chat/useManagedCloudModel.ts` | Skip fetching cloud models from Manufact backend | chore 02 |
| `libraries/typescript/packages/inspector/src/client/components/LayoutHeader.tsx` | Hide Manufact Deploy/Cloud button in header | chore 02 |
| `libraries/typescript/packages/inspector/src/client/components/HostedUserMenu.tsx` | Render null to hide Manufact user avatar/menu | chore 02 |
| `libraries/typescript/packages/inspector/src/client/components/layout/sidebar/InspectorSidebarFooter.tsx` | Hide Manufact deployment CTA in sidebar footer | chore 02 |
| `libraries/typescript/packages/inspector/src/client/components/layout/mobile/MobileInspectorToolbar.tsx` | Hide Manufact icon link in mobile toolbar | chore 02 |
| `libraries/typescript/packages/inspector/src/client/components/layout/TunnelPopoverPanel.tsx` | Hide Manufact tunneling docs link | chore 02 |
| `libraries/typescript/packages/inspector/src/server/inspector-shell.ts` | Default anonymized telemetry to false | chore 02 |

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
docker run -p 3000:3000 -e MCP_SERVER_PORT=8443 mcp-inspector:local
```
