# Host Profiles Guide

> The **Host Profiles** system provides high-fidelity emulation of leading MCP client environments (**ChatGPT**, **Claude.ai**, **Claude Desktop**) directly within the Inspector.

---

## 1. Why Host Profiles?

In production, an MCP server or interactive widget (MCP App / View) never runs in a vacuum:
1. **Tool Call Metadata (`_meta`):** ChatGPT passes rich contextual information inside `params._meta` on every tool call (session ID, preferred locale, user's approximate geographic location).
2. **Declared Host Capabilities:** Certain clients do not support advanced features such as sampling (LLM completion delegation) or direct file uploads.
3. **Container Layout & Typography:** Claude and ChatGPT use distinct fonts (Anthropic Sans vs. Söhne), light/dark themes, and container viewport constraints.
4. **Browser APIs & SDK Shims:** ChatGPT exposes a `window.openai` object in the iframe hosting interactive widgets.

With Host Profiles, you can validate servers and views against real platform constraints without deploying to external cloud platforms.

---

## 2. Built-in Profiles

The profile picker, located directly in the Inspector header toolbar, offers 4 preconfigured environments derived from network captures:

### 1. `chatgpt` — ChatGPT (Apps & Connectors)
*Capture source: `resources/captures/chatgpt-2026-10-07.json`*
- **Injected `params._meta` metadata:**
  ```json
  {
    "openai/locale": "en-US",
    "webplus/i18n": "en-US",
    "openai/userAgent": "Mozilla/5.0 ... ChatGPT/1.0",
    "openai/userLocation": {
      "city": "San Francisco",
      "region": "CA",
      "country": "US",
      "timezone": "America/Los_Angeles",
      "latitude": 37.7749,
      "longitude": -122.4194
    },
    "openai/subject": "user_2tX9rQ7kLmP3nB4vC8wZ",
    "openai/session": "sess_9a8b7c6d5e4f3a2b1c",
    "openai/organization": "org_chatgpt_simulated"
  }
  ```
- **Viewport & Layout:** Max-width 800px, supports `inline` and `fullscreen` view modes.
- **Typography & Theme:** *Söhne* font family, authentic OpenAI color tokens and borders.
- **SDK Shim:** Enables automatic injection of the `window.openai` bridge object inside view iframes.
- **Capabilities:** Disables sampling and direct messaging unsupported by ChatGPT.

---

### 2. `claude` — Claude (claude.ai)
*Capture source: `resources/captures/claude-2026-10-07.json`*
- **Viewport & Layout:** Narrower 768px max-width, supports `inline` and `fullscreen` modes.
- **Typography & Theme:** *Anthropic Sans* font family, official light and dark palette tokens.
- **SDK Shim:** Disabled (`openaiShim: false`), emulating a standard web sandbox without third-party bridges.
- **Capabilities:** Does not declare sampling or direct file upload capabilities.

---

### 3. `claude-desktop` — Claude Desktop
*Capture source: `resources/captures/claude-desktop-2026-10-07.json`*
- **Viewport & Layout:** Compact 640px max-width, `inline` mode only.
- **Platform:** Declared as `"desktop"`.
- **User-Agent:** Emulates the official desktop client (`ClaudeDesktop/0.8.0`).
- **Typography & Theme:** Anthropic style tokens tailored for compact desktop client windows.

---

### 4. `mcp-use` — Inspector Default Environment
- **Behavior:** Unrestricted profile with no viewport boundaries or capability filters.
- **Use Case:** Ideal for initial development and exploratory prototyping without host constraints.

---

## 3. Interactive Metadata Bar (`HostProfileMetaBar`)

When the **ChatGPT** profile is active, an interactive metadata bar automatically appears above the tool test form in the **Tools** tab:

- **Live Editing:** Adjust the language (`openai/locale`), simulated user ID (`openai/subject`), or geographic coordinates (`openai/userLocation`) with a single click.
- **Context Testing:** Instantly verify how your MCP tools respond to locale changes (e.g. switching from `en-US` to `fr-FR`) or coordinates without restarting the server.
- **Transparency:** Custom metadata is immediately merged into the payload dispatched across the MCP transport.

---

## 4. Architecture & Non-Intrusive Injection

To maintain clean forward-compatibility with upstream releases, the Host Profiles implementation relies on decoupled layers:

1. **Transport Wrapper (`meta-transport.ts`):**
   Rather than patching every tool invocation site, the active profile decorates the MCP transport via a clean interceptor:
   ```ts
   // Intercepts outgoing "tools/call" messages and merges _meta
   if (message.method === "tools/call") {
     const meta = getActiveToolCallMeta();
     if (meta) {
       message.params._meta = { ...meta, ...message.params?._meta };
     }
   }
   ```
2. **Context Provider (`HostProfileContext.tsx`):**
   Broadcasts profile state, syncs selection with URL parameters (`?host=chatgpt`), and applies CSS variables directly to the view preview container without mutating global application state.
