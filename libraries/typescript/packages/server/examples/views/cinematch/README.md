# CineMatch — Reference MCP Server & Interactive Widget

CineMatch is a reference MCP application built using the `mcp-use` server framework. It illustrates:
- **`mcp-use` Server Framework:** Built with `MCPServer`, tool registration, and Zod input/output schemas.
- **ChatGPT Client Context & Logs:** Extracts and logs `openai/subject` (user ID) and `openai/session` (or `openai/sessionid`) from the request `_meta`.
- **In-Memory Mock Data:** Fully self-contained local JSON movie catalog with genres, moods, runtimes, streaming platforms, and showtimes (no external APIs).
- **Interactive MCP Apps Widget (UI):** Built with `mcp-use/react` providing dynamic mood/duration filters, movie cards with responsive layouts, and an interactive personal watchlist.
- **Automated Evals:** Comes with automated evaluation suites in `.evals/suites/cinematch/`.

## Running Locally

To start CineMatch in development mode:

```bash
pnpm --filter mcp-use-example-views-cinematch dev
```

Or from the example directory:

```bash
cd libraries/typescript/packages/server/examples/views/cinematch
pnpm dev
```
