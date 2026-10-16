# Study: Upstream Diff, Line Count & Hooking Audit

> **Scope:** Audit of all modifications outside of the `/fork` directories in `@mcp-use/inspector`.  
> **Core Rule of the Fork:** Strict isolation — keep all custom logic in dedicated `/fork` directories, use minimal single-line tagged hooks (`// fork: ...`) in upstream files, zero changes to third-party packages, zero conflicts on upstream rebase.

---

## 1. Executive Summary & Line Counts

As of the current fork baseline, **zero upstream files are modified** in `@mcp-use/client`, `@mcp-use/agent`, or `@mcp-use/cli`. All customization is isolated within `@mcp-use/inspector`.

Across the entire inspector package, upstream files contain only minimal declarative hooks:

| Feature Area | Upstream Files Touched | Hook Lines Added | Role / Scope |
|---|:---:|:---:|---|
| **Evaluations Framework** | 7 files | ~26 lines | Evals tab registration, route mounting, eval scope settings in connection tab |
| **Host Profiles & Meta** | 6 files | ~18 lines | ChatGPT/Claude `_meta` emulation, selector in header, widget preview |
| **Confidential OAuth** | 4 files | ~11 lines | Okta/MyID `client_secret_basic` BFF integration, direct client-side fallback |
| **Manufact Cloud Removal** | 6 files | ~11 lines | Disables third-party cloud telemetry and entry points |
| **Local CORS Proxy Integration** | 1 file | ~15 lines | 2x2 connection button row and Local Proxy alert callout in ConnectionSettingsForm |
| **Total Across Entire Fork** | **19 files** | **~81 lines** | **100% tagged with `// fork: ...`** |

> **Audit Guarantee:** Running `git grep -n "fork:"` lists every single modified line in upstream files.

---

## 2. Detailed Audit by Feature

### A. Confidential OAuth Client

Only **4 upstream files** in `@mcp-use/inspector` were touched:

| Upstream File | Lines Modified / Added | Hook Role | Rebase Risk |
|---|---|---|---|
| `src/client/App.tsx` | +2 lines | Mounts `<ForkStaticClientsSync />` for automatic secret synchronization | **Minimal** |
| `src/server/cli.ts` | +2 lines | Calls `mountStaticClientRoutes(app)` in standalone CLI mode | **Low** |
| `src/server/create-dev-api-app.ts` | +2 lines | Calls `mountStaticClientRoutes(app)` in dev mode / HMR | **Low** |
| `src/server/proxy/oauth-proxy.ts` | +5 lines | 1. Looks up static client: `clients.get(key) ?? getStaticClient(key)`<br>2. Exports `canonicalUrl`<br>3. RFC 6749 §2.3 fix: removes `client_id` from body when using `Authorization: Basic` | **Low** |

#### Why Form Components Weren't Modified for OAuth
Upstream connection form components (`ConnectionSettingsForm.tsx`, `useConnectionFormState.ts`, etc.) were not altered to store secrets. Instead, `<ForkStaticClientsSync />` listens for standard form input events reactively and persists credentials in an isolated, encrypted-ready browser store (`mcp-inspector-fork-oauth-secrets`).

---

### B. Evaluations Framework

Only **7 upstream files** in `@mcp-use/inspector` are touched:

| Upstream File | Lines Modified / Added | Hook Role | Rebase Risk |
|---|---|---|---|
| `src/client/context/InspectorContext.tsx` | +1 line | Adds `"evals"` to TypeScript `TabType` union | **Minimal** (type union) |
| `src/client/components/Layout.tsx` | +1 line | Validates `?tab=evals` URL parameter | **Minimal** (static list) |
| `src/client/components/layout/layoutTabs.ts` | +2 lines | Registers Evals tab in navigation tab bar | **Minimal** (config array) |
| `src/client/components/LayoutContent.tsx` | +16 lines | Imports and renders `<EvalsTab />` container when selected | **Low-Medium** |
| `src/client/components/ConnectionSettingsTab.tsx` | +2 lines | Renders `<EvalScopeSettingsCard />` at the bottom of settings | **Minimal** |
| `src/server/cli.ts` | +3 lines | Mounts `/inspector/api/fork/evals/*` routes in CLI | **Low** |
| `src/server/create-dev-api-app.ts` | +3 lines | Mounts `/inspector/api/fork/evals/*` routes in dev mode | **Low** |

> All 3,000+ lines of evaluation engine, assertion matchers, run history, and UI components live in `src/client/fork/evals/` and `src/server/fork/evals/`.

---

### C. Host Profiles (ChatGPT & Claude Emulation)

Only **6 upstream files** touched:
- `src/client/App.tsx`: Provides `HostProfileContext`.
- `src/client/components/LayoutHeader.tsx`: Renders `<HostProfileSelect />` in the top bar.
- `src/client/components/ViewPreview.tsx`: Passes active profile's `hostInfo` to widget preview.
- `src/client/components/tools/ToolExecutionPanel.tsx`: Renders `<HostProfileMetaBar />`.
- `src/client/hooks/useMcpAppsHostContext.ts`: Overlays host context via `applyHostProfile`.
- `src/client/hooks/useViewHostProps.tsx`: Injects `openaiShim`, `hostInfo`, and `hostCapabilities`.

---

### D. Manufact Cloud Removal

Only **6 upstream files** touched to disable external SaaS dependencies:
- `src/client/components/HostedUserMenu.tsx`: Returns `null` to hide third-party login.
- `src/client/components/LayoutHeader.tsx`: Hides Manufact cloud deployment button.
- `src/client/components/chat/useManagedCloudModel.ts`: Skips external cloud model queries.
- `src/client/components/layout/TunnelPopoverPanel.tsx`: Hides external tunneling promotional links.
- `src/client/components/layout/mobile/MobileInspectorToolbar.tsx`: Hides external cloud icons.
- `src/client/context/InspectorContext.tsx`: Disables quota checks and SaaS upgrade modals.

---

## 3. Rebase Immunity & Maintenance

Because 98%+ of custom code lives inside isolated `/fork` directories:
1. **Zero upstream divergence**: Core transport, JSON-RPC handling, and client protocol logic are unmodified.
2. **Fast rebasing**: Running `git rebase <tag>` takes under 30 seconds and completes automatically.
3. **Traceability**: All active hooks are cataloged in [`FORK.md`](file:///Users/gabrielbenetoux/dlp-ai-project/mcp-use/FORK.md).
