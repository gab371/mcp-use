#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

echo "🚀 Starting Local MCP CORS Proxy..."
exec node "${ROOT_DIR}/scripts/fork/cors-proxy.mjs" "$@"
