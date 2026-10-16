#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Usage:
#   ./scripts/fork/run-cors-proxy.sh             # default port: 3020
#   ./scripts/fork/run-cors-proxy.sh 3050        # custom port via argument
#   ./scripts/fork/run-cors-proxy.sh --port 3050 # custom port via flag
#   PORT=3050 ./scripts/fork/run-cors-proxy.sh   # custom port via env var

echo "🚀 Starting Local MCP CORS Proxy..."
exec node "${ROOT_DIR}/scripts/fork/cors-proxy.mjs" "$@"
