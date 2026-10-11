#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PORT="${PORT:-3017}"
MCP_EXAMPLE_PORT="${MCP_EXAMPLE_PORT:-3000}"

# Disable pnpm/corepack auto-downgrade check against packageManager in package.json
export NPM_CONFIG_MANAGE_PACKAGE_MANAGER_VERSIONS=false
export PNPM_CONFIG_MANAGE_PACKAGE_MANAGER_VERSIONS=false
export COREPACK_ENABLE_PACKAGE_MANAGER=0

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
MCP_EXAMPLE=""
ARGS=()

while [ $# -gt 0 ]; do
  case "$1" in
    --build|-b)
      BUILD_FLAG="true"
      shift
      ;;
    --mcp-example)
      MCP_EXAMPLE="$2"
      shift 2
      ;;
    --mcp-example=*)
      MCP_EXAMPLE="${1#*=}"
      shift
      ;;
    *)
      ARGS+=("$1")
      shift
      ;;
  esac
done

SHOULD_BUILD=false
if [ "$BUILD_FLAG" = "true" ] || [ ! -f "$INSPECTOR_CLI" ] || [ ! -f "${ROOT_DIR}/libraries/typescript/packages/inspector/dist/app/inspector.js.gz" ] || [ ! -f "${ROOT_DIR}/libraries/typescript/packages/cli/dist/index.js" ]; then
  SHOULD_BUILD=true
elif [ -n "$(find "${ROOT_DIR}/libraries/typescript/packages/inspector/src" -newer "${ROOT_DIR}/libraries/typescript/packages/inspector/dist/app/inspector.js.gz" 2>/dev/null | head -n 1)" ]; then
  SHOULD_BUILD=true
fi

if [ "$SHOULD_BUILD" = "true" ]; then
  echo "📦 Building packages..."
  pnpm with current --dir "${ROOT_DIR}/libraries/typescript" --filter @mcp-use/client build
  pnpm with current --dir "${ROOT_DIR}/libraries/typescript" --filter @mcp-use/agent build
  pnpm with current --dir "${ROOT_DIR}/libraries/typescript" --filter @mcp-use/tunnel build
  pnpm with current --dir "${ROOT_DIR}/libraries/typescript" --filter @mcp-use/cli build
  pnpm with current --dir "${ROOT_DIR}/libraries/typescript" --filter @mcp-use/inspector build
fi

# Launch MCP Example server in background if requested
MCP_PID=""
if [ -n "$MCP_EXAMPLE" ]; then
  EXAMPLE_DIR=""
  for candidate in \
    "${ROOT_DIR}/libraries/typescript/packages/server/examples/views/${MCP_EXAMPLE}" \
    "${ROOT_DIR}/examples/typescript/${MCP_EXAMPLE}" \
    "${ROOT_DIR}/libraries/typescript/packages/server/examples/${MCP_EXAMPLE}"; do
    if [ -d "$candidate" ]; then
      EXAMPLE_DIR="$candidate"
      break
    fi
  done

  if [ -z "$EXAMPLE_DIR" ]; then
    echo "❌ MCP example '${MCP_EXAMPLE}' not found."
    exit 1
  fi

  echo "🎬 Starting MCP Example '${MCP_EXAMPLE}' on port ${MCP_EXAMPLE_PORT}..."
  (cd "$EXAMPLE_DIR" && pnpm with current dev) &
  MCP_PID=$!
  trap 'echo "🛑 Stopping MCP Example..."; kill "$MCP_PID" 2>/dev/null || true' EXIT INT TERM

  # Wait for server port to be open and accepting connections
  echo "⏳ Waiting for MCP Server on http://localhost:${MCP_EXAMPLE_PORT}/mcp..."
  for i in $(seq 1 30); do
    if ! kill -0 "$MCP_PID" 2>/dev/null; then
      echo "❌ MCP Example process died unexpectedly."
      exit 1
    fi
    if nc -z 127.0.0.1 "${MCP_EXAMPLE_PORT}" 2>/dev/null || nc -z localhost "${MCP_EXAMPLE_PORT}" 2>/dev/null; then
      echo "✅ MCP Server is ready!"
      break
    fi
    sleep 0.5
  done

  # Auto-attach --url http://localhost:3000/mcp to Inspector if not already specified
  HAS_URL=false
  for a in "${ARGS[@]+"${ARGS[@]}"}"; do
    if [ "$a" = "--url" ]; then HAS_URL=true; break; fi
  done
  if [ "$HAS_URL" = "false" ]; then
    ARGS+=("--url" "http://localhost:${MCP_EXAMPLE_PORT}/mcp")
  fi
fi

echo "🚀 Starting MCP Inspector on http://localhost:${PORT}/inspector"
if [ ${#ARGS[@]} -gt 0 ]; then
  node "$INSPECTOR_CLI" --port "$PORT" "${ARGS[@]}"
else
  node "$INSPECTOR_CLI" --port "$PORT"
fi
