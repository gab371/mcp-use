# Multi-stage Dockerfile for standalone web client of mcp-use inspector
FROM node:22-alpine AS builder

WORKDIR /repo

RUN npm install -g pnpm@10.28.0

# Copy TypeScript monorepo source
COPY libraries/typescript ./libraries/typescript

WORKDIR /repo/libraries/typescript

ENV NPM_CONFIG_MANAGE_PACKAGE_MANAGER_VERSIONS=false
RUN pnpm install --frozen-lockfile || pnpm install

# Build client, agent, and inspector standalone web bundle with relative base
RUN pnpm --filter @mcp-use/client build && \
    pnpm --filter @mcp-use/agent build && \
    pnpm --filter @mcp-use/inspector exec vite build --config vite.config.ts --base ./

FROM httpd:2.4-alpine

# Enable rewrite module and include custom config
RUN sed -i 's/#LoadModule rewrite_module modules\/mod_rewrite.so/LoadModule rewrite_module modules\/mod_rewrite.so/' /usr/local/apache2/conf/httpd.conf && \
    echo "Include /usr/local/apache2/conf/extra/httpd-standalone.conf" >> /usr/local/apache2/conf/httpd.conf

COPY docker/inspector-standalone/httpd-standalone.conf /usr/local/apache2/conf/extra/httpd-standalone.conf
COPY docker/inspector-standalone/index.html /usr/local/apache2/htdocs/index.html

# Copy built standalone web assets to /inspector
COPY --from=builder /repo/libraries/typescript/packages/inspector/dist/web /usr/local/apache2/htdocs/inspector

EXPOSE 80

CMD ["httpd-foreground"]
