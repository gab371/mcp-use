#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PORT="${PORT:-3017}"

# Trust local root CA certificate (mkcert) in .certificates/
CERT_FILE=""
for candidate in \
  "${ROOT_DIR}/.certificates/rootCA.pem" \
  "${ROOT_DIR}/.certificates/rootCert.pem" \
  "${ROOT_DIR}/.certificates/rootCA.crt"; do
  if [ -f "$candidate" ]; then
    CERT_FILE="$candidate"
    break
  fi
done

if [ -n "$CERT_FILE" ]; then
  export NODE_EXTRA_CA_CERTS="$CERT_FILE"
  echo "🔒 Using root CA certificate: $CERT_FILE"
else
  echo "⚠️  No root certificate found in ${ROOT_DIR}/.certificates/"
fi

INSPECTOR_CLI="${ROOT_DIR}/libraries/typescript/packages/inspector/dist/cli.js"

BUILD_FLAG="${BUILD:-false}"
ARGS=()
for arg in "$@"; do
  if [ "$arg" = "--build" ] || [ "$arg" = "-b" ]; then
    BUILD_FLAG="true"
  else
    ARGS+=("$arg")
  fi
done

if [ "$BUILD_FLAG" = "true" ] || [ ! -f "$INSPECTOR_CLI" ] || [ ! -f "${ROOT_DIR}/libraries/typescript/packages/inspector/dist/app/inspector.js.gz" ]; then
  echo "📦 Building packages..."
  export NPM_CONFIG_MANAGE_PACKAGE_MANAGER_VERSIONS=false
  pnpm --dir "${ROOT_DIR}/libraries/typescript" --filter @mcp-use/client build
  pnpm --dir "${ROOT_DIR}/libraries/typescript" --filter @mcp-use/agent build
  pnpm --dir "${ROOT_DIR}/libraries/typescript" --filter @mcp-use/inspector build
fi

echo "🚀 Starting MCP Inspector on http://localhost:${PORT}/inspector"
exec node "$INSPECTOR_CLI" --port "$PORT" "${ARGS[@]}"
