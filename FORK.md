# FORK.md — Extended fork of mcp-use

## Why this fork

Internal, shared mcp-use inspector with: host profiles (feat 01), evals (feat 02), no Manufact cloud (chore 02), shared deployment (tech 01).

## Rules

1. Our code only in `libraries/typescript/packages/inspector/src/client/fork/` and `libraries/typescript/packages/inspector/src/server/fork/`.
2. Upstream files: hook lines only, each with a `// fork: <plan id> <reason>` comment, each listed below.
3. Never reformat or refactor upstream code.
4. Follow published inspector tags, not arbitrary `main` commits.

## Hooks in upstream files

| File | What the hook does | Plan |
| ---- | ------------------ | ---- |

`git grep -n "fork:"` must list exactly these lines. Currently 0 hooks (clean baseline).

## Update routine

```bash
scripts/fork-update.sh <inspector-tag>   # fetch, rebase, build, specs, list hooks
```

Last update: 2026-10-07, initial base on `@mcp-use/inspector@20.3.15`, took ~15s, conflicts: none.

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
