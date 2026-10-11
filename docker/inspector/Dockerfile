# Multi-stage Dockerfile for extended fork of mcp-use inspector
# Stage 1: Build the inspector from repository source
FROM node:22-alpine AS builder

WORKDIR /repo

# Install pnpm matching repo tooling
RUN npm install -g pnpm@10.28.0

# Copy TypeScript monorepo source
COPY libraries/typescript ./libraries/typescript

WORKDIR /repo/libraries/typescript

# Configure pnpm and install dependencies
ENV NPM_CONFIG_MANAGE_PACKAGE_MANAGER_VERSIONS=false
RUN pnpm install --frozen-lockfile || pnpm install

# Build internal dependencies then inspector
RUN pnpm --filter @mcp-use/client build && \
    pnpm --filter @mcp-use/agent build && \
    pnpm --filter @mcp-use/inspector build

# Stage 2: Minimal runtime image
FROM node:22-alpine

RUN apk add --no-cache socat ca-certificates

WORKDIR /app

# Copy built inspector artifacts
COPY --from=builder /repo/libraries/typescript/packages/inspector/dist ./dist
COPY --from=builder /repo/libraries/typescript/packages/inspector/package.json ./package.json

# Ensure eval directories exist for persistent volume mounts
RUN mkdir -p .evals/suites .evals/runs

# Copy entrypoint script
COPY docker/inspector/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV NODE_ENV=production
ENV MCP_USE_ANONYMIZED_TELEMETRY=false
ENV PORT=3000

EXPOSE 3000

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "dist/cli.js", "--port", "3000", "--no-open"]
