#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DIST_WEB="${ROOT_DIR}/libraries/typescript/packages/inspector/dist/web"
COMPOSE_FILE="${ROOT_DIR}/docker/inspector-standalone/docker-compose.yml"

BUILD_FLAG=false
while [ $# -gt 0 ]; do
  case "$1" in
    --build|-b)
      BUILD_FLAG=true
      shift
      ;;
    *)
      shift
      ;;
  esac
done

if [ "$BUILD_FLAG" = "true" ] || [ ! -f "${DIST_WEB}/index.html" ]; then
  echo "📦 Building standalone Inspector web bundle..."
  MCP_USE_ANONYMIZED_TELEMETRY=false pnpm --dir "${ROOT_DIR}/libraries/typescript/packages/inspector" exec vite build --config vite.config.ts --base ./
fi

echo "🐳 Starting Apache2 container..."
docker compose -f "$COMPOSE_FILE" up -d --force-recreate

if ! lsof -i :3020 >/dev/null 2>&1; then
  echo "🔒 Starting Local CORS Proxy on http://127.0.0.1:3020..."
  nohup node "${ROOT_DIR}/scripts/fork/cors-proxy.mjs" >/tmp/mcp-cors-proxy.log 2>&1 &
fi

echo ""
echo "🚀 MCP Inspector Standalone is running:"
echo "👉 http://localhost:8085/inspector/"
echo "👉 http://localhost:8085/ (redirects to /inspector/)"
echo "🔒 Local CORS Proxy: http://localhost:3020"
