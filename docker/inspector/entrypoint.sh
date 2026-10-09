#!/bin/sh
set -e

# Support mkcert CA certificate
if [ -z "$NODE_EXTRA_CA_CERTS" ] && [ -f "/certs/rootCA.pem" ]; then
  export NODE_EXTRA_CA_CERTS="/certs/rootCA.pem"
fi

if [ -n "$NODE_EXTRA_CA_CERTS" ] && [ -f "$NODE_EXTRA_CA_CERTS" ]; then
  echo "[inspector-entrypoint] Using extra CA cert: $NODE_EXTRA_CA_CERTS"
  if [ -d "/usr/local/share/ca-certificates" ]; then
    cp "$NODE_EXTRA_CA_CERTS" /usr/local/share/ca-certificates/extra-ca.crt 2>/dev/null || true
    update-ca-certificates 2>/dev/null || true
  fi
fi

# Relay traffic from container localhost to host machine if MCP_SERVER_PORT is set
if [ -n "$MCP_SERVER_PORT" ]; then
  echo "[inspector-entrypoint] Starting socat relay: 127.0.0.1:${MCP_SERVER_PORT} -> host.docker.internal:${MCP_SERVER_PORT}"
  socat TCP-LISTEN:"${MCP_SERVER_PORT}",fork,reuseaddr TCP:host.docker.internal:"${MCP_SERVER_PORT}" &
fi

exec "$@"
