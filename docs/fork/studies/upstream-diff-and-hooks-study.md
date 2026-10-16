# Study: Upstream Diff, Line Count & Hooking Audit

> **Scope:** Comprehensive audit of all modifications outside of the `/fork` directories in `@mcp-use/inspector` against the upstream release tag `@mcp-use/inspector@20.3.15`.  
> **Core Architecture:** Strict isolation — over 97% of custom business logic is kept in dedicated `/fork` directories, minimal declarative hooks (`// fork: ...`) are placed in upstream files, zero modifications exist in peer packages (`client`, `agent`, `cli`), guaranteeing clean and automated upstream rebases.

---

## 1. Executive Summary & Diff Metrics

Comparing the current fork (`fork/main`) against the official upstream tag `@mcp-use/inspector@20.3.15`:

- **Peer Packages:** **0 modified files** in `@mcp-use/client`, `@mcp-use/agent`, or `@mcp-use/cli`.
- **Inspector Package:** Exactly **21 upstream files** touched outside of `/fork/` directories (out of 79 total source files in `@mcp-use/inspector/src`).
- **Isolation Ratio:** **58 completely new isolated files** live inside `src/client/fork/` and `src/server/fork/`, containing the full business logic.
- **Hook Footprint in Upstream Files:** **+117 lines added**, **-18 lines removed/replaced** across the 21 upstream files (total churn of only 135 lines). Every insertion is explicitly tagged with `// fork: ...`.

### Breakdown by Functional Domain

| Feature Domain | Upstream Files Touched | Role & Scope | Rebase Risk |
|---|:---:|---|:---:|
| **Evaluations Framework** | 7 files | Evals tab registration, route mounting, eval scope settings in connection tab | **Low** |
| **Host Profiles & Meta Emulation** | 6 files | ChatGPT/Claude `_meta` emulation, selector in header, widget preview | **Low** |
| **Confidential OAuth Client** | 4 files | Enterprise OAuth BFF proxy, static client fallback, RFC 6749 §2.3 compliance | **Low** |
| **Cloud Telemetry & SaaS Removal** | 6 files | Disables third-party cloud telemetry, quota modals, and external entry points | **Low** |
| **Local CORS Proxy & Connection Workflow** | 1 file | 2x2 connection action grid, Local Proxy trigger button, and alert in connection form | **Low** |
| **Total Distinct Upstream Files** | **21 files** | **All changes declarative and tagged with `// fork: ...`** | **Minimal** |

*(Note: The sum of files per domain exceeds 21 because a few files such as `App.tsx`, `cli.ts`, and `InspectorContext.tsx` host hooks for more than one domain).*

---

## 2. Master Inventory: All 21 Upstream Files

Here is the exhaustive inventory of all 21 modified upstream files in `libraries/typescript/packages/inspector/src/`:

| # | Upstream File Path | Lines Added | Lines Deleted | Primary Role |
|:---:|---|:---:|:---:|---|
| 1 | `client/App.tsx` | +8 | -2 | Mounts `HostProfileContext` provider and `ForkStaticClientsSync` secret sync component |
| 2 | `client/components/ConnectionSettingsForm.tsx` | +17 | -1 | 2x2 grid layout for connection actions; mounts `LocalProxyAlert` and `LocalProxyButton` |
| 3 | `client/components/ConnectionSettingsTab.tsx` | +3 | -0 | Mounts `EvalScopeSettingsCard` at the bottom of the connection tab |
| 4 | `client/components/HostedUserMenu.tsx` | +2 | -0 | Returns `null` to hide third-party SaaS user avatar and login popover |
| 5 | `client/components/Layout.tsx` | +1 | -0 | Adds `"evals"` to the list of accepted URL tab query parameters |
| 6 | `client/components/LayoutContent.tsx` | +16 | -0 | Registers `"evals"` in `ALL_KNOWN_TABS` and mounts the `<EvalsTab />` container |
| 7 | `client/components/LayoutHeader.tsx` | +10 | -2 | Renders `<HostProfileSelect />` in desktop/mobile header; hides external cloud deploy CTA |
| 8 | `client/components/ViewPreview.tsx` | +3 | -1 | Forwards active host profile `hostInfo` to MCP Apps / View iframe bundle preview |
| 9 | `client/components/chat/useManagedCloudModel.ts` | +2 | -1 | Disables third-party cloud model query fallback when SaaS features are disabled |
| 10 | `client/components/layout/TunnelPopoverPanel.tsx` | +4 | -0 | Hides external SaaS tunneling documentation links |
| 11 | `client/components/layout/layoutTabs.ts` | +2 | -0 | Imports `FlaskConical` icon and registers the "Evals" tab in the main tab navigation |
| 12 | `client/components/layout/mobile/MobileInspectorToolbar.tsx` | +4 | -0 | Hides external cloud shortcut icon in mobile view |
| 13 | `client/components/layout/sidebar/InspectorSidebarFooter.tsx` | +5 | -1 | Hides third-party cloud deployment call-to-action button in sidebar footer |
| 14 | `client/components/tools/ToolExecutionPanel.tsx` | +3 | -0 | Mounts `<HostProfileMetaBar />` to display active injected metadata |
| 15 | `client/context/InspectorContext.tsx` | +10 | -4 | Adds `"evals"` to `TabType` union; disables cloud chat fallback & free-tier upgrade prompts |
| 16 | `client/hooks/useMcpAppsHostContext.ts` | +7 | -1 | Overlays active host profile parameters via `applyHostProfile` without re-indenting upstream block |
| 17 | `client/hooks/useViewHostProps.tsx` | +5 | -2 | Injects profile `hostInfo`, `hostCapabilities`, and `openaiShim` into widget views |
| 18 | `server/cli.ts` | +5 | -0 | Mounts evaluations API routes and static confidential OAuth client routes in CLI |
| 19 | `server/create-dev-api-app.ts` | +5 | -0 | Mounts evaluations API routes and static confidential OAuth client routes in HMR dev mode |
| 20 | `server/inspector-shell.ts` | +1 | -1 | Sets default anonymized telemetry to `false` |
| 21 | `server/proxy/oauth-proxy.ts` | +4 | -2 | Resolves static confidential credentials, exports `canonicalUrl`, and enforces RFC 6749 §2.3 |
| **Total** | **21 upstream files** | **+117** | **-18** | **Zero business logic embedded in upstream files** |

---

## 3. Detailed Audit by Functional Domain

### A. Evaluations Framework

**7 upstream files touched:**

| Upstream File | Diff | Role |
|---|:---:|---|
| `src/client/context/InspectorContext.tsx` | +1 line | Adds `"evals"` to TypeScript `TabType` union. |
| `src/client/components/Layout.tsx` | +1 line | Validates `?tab=evals` URL query parameter. |
| `src/client/components/layout/layoutTabs.ts` | +2 lines | Registers the Evals navigation tab and icon. |
| `src/client/components/LayoutContent.tsx` | +16 lines | Imports and renders `<EvalsTab />` container when selected. |
| `src/client/components/ConnectionSettingsTab.tsx` | +3 lines | Mounts `<EvalScopeSettingsCard />` at the bottom of the connection tab. |
| `src/server/cli.ts` | +3 lines | Mounts `/inspector/api/fork/evals/*` routes in CLI mode. |
| `src/server/create-dev-api-app.ts` | +3 lines | Mounts `/inspector/api/fork/evals/*` routes in dev/Vite mode. |

> **Architectural Isolation:** All 3,000+ lines of evaluation engine logic, assertion matchers (`toolCalled`, `goldenResult`, `goldenAnswer`, `argsNeverContain`), 1-click test capture, YAML persistence, and run history UI reside strictly in `src/client/fork/evals/` and `src/server/fork/evals/`.

---

### B. Host Profiles (ChatGPT & Claude Emulation)

**6 upstream files touched:**

| Upstream File | Diff | Role |
|---|:---:|---|
| `src/client/App.tsx` | +6 lines | Wraps the application with `<HostProfileProvider>`. |
| `src/client/components/LayoutHeader.tsx` | +7 lines | Mounts `<HostProfileSelect />` in desktop and mobile header bars. |
| `src/client/components/ViewPreview.tsx` | +3 lines | Injects active profile `hostInfo` into the MCP View iframe preview. |
| `src/client/components/tools/ToolExecutionPanel.tsx` | +3 lines | Displays `<HostProfileMetaBar />` showing active metadata overrides. |
| `src/client/hooks/useMcpAppsHostContext.ts` | +7 lines | Overlays profile settings (`openai/subject`, container styles) via secondary `useMemo` wrapper. |
| `src/client/hooks/useViewHostProps.tsx` | +5 lines | Provides `openaiShim`, `hostInfo`, and `hostCapabilities` to views. |

> **Architectural Isolation:** All profile definitions (ChatGPT, Claude Desktop, Claude Web, Generic), CSS design tokens, and ChatGPT window shims reside in `src/client/fork/host-profiles/`.

---

### C. Confidential OAuth & Enterprise Identity Providers

**4 upstream files touched:**

| Upstream File | Diff | Role |
|---|:---:|---|
| `src/client/App.tsx` | +2 lines | Mounts `<ForkStaticClientsSync />` to automatically synchronize confidential secrets. |
| `src/server/cli.ts` | +2 lines | Calls `mountStaticClientRoutes(app)` in CLI mode. |
| `src/server/create-dev-api-app.ts` | +2 lines | Calls `mountStaticClientRoutes(app)` in dev/HMR mode. |
| `src/server/proxy/oauth-proxy.ts` | +4 lines | Resolves static confidential client fallback, exports `canonicalUrl`, and enforces RFC 6749 §2.3. |

> **Architectural Isolation:** Credential storage, standalone interceptors, PKCE generation, and static client registry are isolated in `src/client/fork/oauth-clients/` and `src/server/fork/oauth-clients/`.

---

### D. Cloud Telemetry & Third-Party SaaS Removal

**6 upstream files touched:**

| Upstream File | Diff | Role |
|---|:---:|---|
| `src/client/components/HostedUserMenu.tsx` | +2 lines | Returns `null` to hide cloud login and avatar. |
| `src/client/components/LayoutHeader.tsx` | +3 lines | Hides third-party cloud deployment CTA. |
| `src/client/components/chat/useManagedCloudModel.ts` | +2 lines | Skips external SaaS model fetching. |
| `src/client/components/layout/TunnelPopoverPanel.tsx` | +4 lines | Hides third-party tunneling marketing links. |
| `src/client/components/layout/mobile/MobileInspectorToolbar.tsx` | +4 lines | Hides SaaS cloud icon in mobile toolbar. |
| `src/client/components/layout/sidebar/InspectorSidebarFooter.tsx` | +5 lines | Hides SaaS cloud deployment card in sidebar footer. |
| `src/server/inspector-shell.ts` | +1 line | Defaults telemetry to `false`. |

> **Architectural Isolation:** Feature flags and disable toggles live in `src/client/fork/manufact.ts`.

---

### E. Local CORS Proxy & Connection Workflow

**1 upstream file touched:**

| Upstream File | Diff | Role |
|---|:---:|---|
| `src/client/components/ConnectionSettingsForm.tsx` | +17 / -1 lines | 1. Configures 2x2 responsive grid container (`grid grid-cols-2`).<br>2. Mounts `<LocalProxyAlert />` callout when connecting to local/private servers.<br>3. Mounts `<LocalProxyButton />` cleanly in the button grid. |

> **Architectural Isolation:** The zero-dependency Node.js CORS proxy script lives in `scripts/fork/cors-proxy.mjs`, OS launchers live in `scripts/fork/run-cors-proxy.*`, and UI components live in `src/client/fork/proxy/`.

---

## 4. Rebase Immunity & Maintenance Verification

Because modifications outside of `/fork` directories are strictly declarative hooks:
1. **Zero Core Divergence:** Core JSON-RPC transport, MCP protocol negotiation, tool dispatch, and client management remain 100% upstream-identical.
2. **Instant Rebase:** Running `git rebase <tag>` completes cleanly without conflicts.
3. **Automated Auditability:** Running `git grep -n "fork:"` instantly verifies that every single line touched outside `/fork/` is documented and accounted for.
