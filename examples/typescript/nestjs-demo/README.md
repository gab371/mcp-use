# NestJS MCP Demo

> Demonstrates idiomatic **NestJS** integration for Model Context Protocol (MCP) servers using `@mcp-use/nestjs`.

---

## Features Demonstrated

1. **Dependency Injection:** `MoviesMcpService` declares `@McpTool()` methods while injecting `MoviesService`.
2. **Metadata Decorators:**
   - `@McpTool()` — Registers tools with schema validation (`zod`) and descriptions.
   - `@McpResource()` — Exposes database catalogs as MCP resources.
   - `@McpPrompt()` — Generates contextual LLM prompts.
   - `@McpContext()` — Injects the runtime `RequestContext` (`_meta`, OpenAI session ID, etc.).
3. **Dynamic Module:** Configured with `McpModule.forRoot({ basePath: '/mcp', inspector: true })`.
4. **Embedded Inspector:** Development UI accessible at `http://localhost:3000/mcp/inspector`.

---

## Running the Application

```bash
# Start in development mode with hot-reloading
pnpm dev

# Or build and run
pnpm build
pnpm start
```
