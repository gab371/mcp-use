import { useEffect, useRef } from "react";
import { useMcpClient } from "@mcp-use/client/react";
import { toast } from "sonner";
import { inspectorApi } from "@/client/utils/basePath";
import {
  getAllForkOAuthSecrets,
  getForkOAuthSecret,
  removeForkOAuthSecret,
  saveForkOAuthSecret,
} from "./secrets-storage";
import { installStandaloneOAuthInterceptor } from "./standalone-oauth-interceptor";

interface SyncedClientEntry {
  serverUrl: string;
  clientId: string;
  clientSecret: string;
}

/**
 * Syncs confidential client secrets configured in the Inspector connection form / localStorage
 * to the server-side OAuth BFF registry (/inspector/api/fork/oauth/clients) when a backend is available,
 * and maintains client-side sessionStorage/localStorage (with 24h expiration) and request interception
 * for standalone mode.
 */
export function ForkStaticClientsSync(): null {
  const { servers } = useMcpClient();
  const syncedRef = useRef<Map<string, SyncedClientEntry>>(new Map());

  // Install standalone client-side interceptor for direct browser requests and ensure telemetry is disabled
  useEffect(() => {
    installStandaloneOAuthInterceptor();
    try {
      if (typeof window !== "undefined") {
        (window as unknown as { __MCP_USE_ANONYMIZED_TELEMETRY__?: boolean }).__MCP_USE_ANONYMIZED_TELEMETRY__ = false;
        if (typeof localStorage !== "undefined" && typeof localStorage.setItem === "function") {
          localStorage.setItem("MCP_USE_ANONYMIZED_TELEMETRY", "false");
        }
      }
    } catch {
      // ignore
    }

    // Detect if running in standalone mode (no Node backend / BFF)
    void fetch(inspectorApi("fork/oauth/clients"), { method: "GET" })
      .then((res) => {
        const ct = res.headers.get("content-type") || "";
        if (!res.ok || ct.includes("text/html")) {
          if (typeof window !== "undefined") {
            (window as unknown as { __MCP_PROXY_URL__?: string | null }).__MCP_PROXY_URL__ = null;
          }
        }
      })
      .catch(() => {
        if (typeof window !== "undefined") {
          (window as unknown as { __MCP_PROXY_URL__?: string | null }).__MCP_PROXY_URL__ = null;
        }
      });
  }, []);

  // Function to register a client with the BFF (fails gracefully in standalone mode)
  const syncToBff = (serverUrl: string, clientId: string, clientSecret: string) => {
    if (!serverUrl || !clientId || !clientSecret) return;
    const syncKey = `${serverUrl}\u0000${clientId}`;
    const existing = syncedRef.current.get(syncKey);
    if (existing && existing.clientSecret === clientSecret) return;

    void fetch(inspectorApi("fork/oauth/clients"), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serverUrl,
        clientId,
        clientSecret,
        authMethod: "client_secret_basic",
      }),
    })
      .then((res) => {
        if (res.ok) {
          syncedRef.current.set(syncKey, {
            serverUrl,
            clientId,
            clientSecret,
          });
        }
      })
      .catch(() => {
        // Normal in standalone client mode where no backend is running
      });
  };

  // 1. Sync stored secrets and server configurations
  useEffect(() => {
    let storedConnections: Record<string, Record<string, unknown>> = {};
    try {
      const raw = localStorage.getItem("mcp-inspector-connections");
      if (raw) {
        storedConnections = JSON.parse(raw) as Record<string, Record<string, unknown>>;
      }
    } catch {
      // Ignore JSON storage parsing errors
    }

    const forkSecrets = getAllForkOAuthSecrets();
    for (const entry of Object.values(forkSecrets)) {
      syncToBff(entry.serverUrl, entry.clientId, entry.clientSecret);
    }

    for (const server of servers) {
      if (!server.url) continue;

      const stored =
        storedConnections[server.id] || storedConnections[server.url];
      const memOAuth = (server as unknown as { oauth?: { clientId?: string; clientSecret?: string } }).oauth ??
        (server as unknown as { config?: { oauth?: { clientId?: string; clientSecret?: string } } }).config?.oauth;
      const storedOAuth = stored?.oauth as
        | { clientId?: string; clientSecret?: string }
        | undefined;

      const clientId =
        memOAuth?.clientId ||
        storedOAuth?.clientId ||
        forkSecrets[server.url]?.clientId;

      const clientSecret =
        memOAuth?.clientSecret ||
        storedOAuth?.clientSecret ||
        forkSecrets[server.url]?.clientSecret;

      const connectionMode =
        server.connectionMode || (stored?.connectionMode as string | undefined);
      const isDirect =
        connectionMode === "direct" ||
        stored?.connectionType === "Direct";

      if (clientId && clientSecret) {
        if (isDirect) {
          toast.warning(
            `Connection "${server.displayName || server.url}" has a client secret configured, but is in Direct mode. Token requests must go through Proxy mode or direct CORS-compliant token endpoints.`,
            { id: `direct-mode-secret-${server.id || server.url}` }
          );
        }

        saveForkOAuthSecret(server.url, clientId, clientSecret, forkSecrets[server.url]?.persistent ?? false);
        syncToBff(server.url, clientId, clientSecret);
      }
    }

    const activeServerUrls = new Set(servers.map((s) => s.url).filter(Boolean));
    for (const [key, entry] of syncedRef.current.entries()) {
      const isServerStillActive = activeServerUrls.has(entry.serverUrl);
      const stillHasSecret = Boolean(
        servers.find((s) => s.url === entry.serverUrl && (s as unknown as { oauth?: { clientSecret?: string } }).oauth?.clientSecret) ||
        storedConnections[entry.serverUrl]?.oauth ||
        forkSecrets[entry.serverUrl]
      );

      if (!isServerStillActive || !stillHasSecret) {
        void fetch(inspectorApi("fork/oauth/clients"), {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            serverUrl: entry.serverUrl,
            clientId: entry.clientId,
          }),
        }).catch(() => {});
        syncedRef.current.delete(key);
        removeForkOAuthSecret(entry.serverUrl);
      }
    }
  }, [servers]);

  // 2. Global DOM listeners to capture typed secrets, pre-fill form and mount "Remember 24h" checkbox
  useEffect(() => {
    if (typeof window === "undefined" || !window.document) return;

    const findCurrentContext = (
      inputEl: HTMLElement
    ): { serverUrl: string; clientId: string; remember24h: boolean } => {
      const container =
        inputEl.closest("form") ||
        inputEl.closest('[role="dialog"]') ||
        inputEl.closest(".space-y-4") ||
        document;

      const clientIdEl = container.querySelector(
        'input[placeholder*="client ID" i], input[placeholder*="Client ID" i]'
      ) as HTMLInputElement | null;

      const urlEl = container.querySelector(
        'input[placeholder*="example.com/mcp" i], input[placeholder*="URL" i]'
      ) as HTMLInputElement | null;

      const rememberCheckbox = container.querySelector(
        'input[data-testid="fork-remember-secret"]'
      ) as HTMLInputElement | null;

      const params = new URLSearchParams(window.location.search);
      const urlFromQuery = params.get("server") || params.get("autoConnect") || "";
      const serverUrl = (urlEl?.value || urlFromQuery || servers[0]?.url || "").trim();
      const clientId = (clientIdEl?.value || servers.find(s => s.url === serverUrl)?.oauth?.clientId || "").trim();
      const remember24h = rememberCheckbox?.checked ?? false;

      return { serverUrl, clientId, remember24h };
    };

    const handleSecretInput = (event: Event) => {
      const target = event.target as HTMLInputElement | null;
      if (!target || target.tagName !== "INPUT") return;

      const placeholder = target.getAttribute("placeholder") || "";
      if (!placeholder.includes("Client secret")) return;

      const clientSecret = target.value.trim();
      if (!clientSecret) return;

      const { serverUrl, clientId, remember24h } = findCurrentContext(target);
      if (serverUrl && clientId) {
        saveForkOAuthSecret(serverUrl, clientId, clientSecret, remember24h);
        syncToBff(serverUrl, clientId, clientSecret);
      }
    };

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      const button = target.closest("button");
      if (!button) return;

      const buttonText = (button.textContent || "").trim();
      if (
        buttonText.includes("Connect") ||
        buttonText.includes("Save") ||
        buttonText.includes("Authenticate")
      ) {
        const secretInputs = document.querySelectorAll(
          'input[placeholder*="Client secret" i]'
        );
        for (const input of Array.from(secretInputs) as HTMLInputElement[]) {
          const secret = input.value.trim();
          if (secret) {
            const { serverUrl, clientId, remember24h } = findCurrentContext(input);
            if (serverUrl && clientId) {
              saveForkOAuthSecret(serverUrl, clientId, secret, remember24h);
              syncToBff(serverUrl, clientId, secret);
            }
          }
        }
      }
    };

    // Mount remember checkbox and pre-fill secret input if empty
    const checkAndMountRememberCheckbox = () => {
      const secretInputs = document.querySelectorAll(
        'input[placeholder*="Client secret" i]'
      );
      if (secretInputs.length === 0) return;

      const params = new URLSearchParams(window.location.search);
      const urlFromQuery = params.get("server") || params.get("autoConnect") || "";
      const targetUrl = urlFromQuery || servers[0]?.url || "";
      const stored = targetUrl ? getForkOAuthSecret(targetUrl) : undefined;

      for (const input of Array.from(secretInputs) as HTMLInputElement[]) {
        const container = input.parentElement;
        if (!container) continue;

        // Check if our remember checkbox is already injected
        let wrapper = container.querySelector('[data-fork-remember-wrapper="true"]') as HTMLElement | null;
        if (!wrapper) {
          wrapper = document.createElement("label");
          wrapper.setAttribute("data-fork-remember-wrapper", "true");
          wrapper.className = "flex items-center gap-2 mt-2 text-xs text-muted-foreground cursor-pointer select-none";

          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.setAttribute("data-testid", "fork-remember-secret");
          checkbox.className = "rounded border-border text-primary focus:ring-primary h-3.5 w-3.5";
          checkbox.checked = stored?.persistent ?? false;

          const span = document.createElement("span");
          span.innerHTML = 'Remember for 24h (localStorage) — <span class="opacity-75">default: session only</span>';

          wrapper.appendChild(checkbox);
          wrapper.appendChild(span);

          // Insert after input element
          if (input.nextSibling) {
            container.insertBefore(wrapper, input.nextSibling);
          } else {
            container.appendChild(wrapper);
          }
        }

        // Pre-fill input value if needed
        if (stored?.clientSecret && !input.value) {
          const setter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype,
            "value"
          )?.set;
          setter?.call(input, stored.clientSecret);
          input.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }
    };

    window.document.addEventListener("input", handleSecretInput, true);
    window.document.addEventListener("change", handleSecretInput, true);
    window.document.addEventListener("click", handleClick, true);

    const observer = new MutationObserver(() => {
      checkAndMountRememberCheckbox();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    checkAndMountRememberCheckbox();

    return () => {
      window.document.removeEventListener("input", handleSecretInput, true);
      window.document.removeEventListener("change", handleSecretInput, true);
      window.document.removeEventListener("click", handleClick, true);
      observer.disconnect();
    };
  }, [servers]);

  return null;
}
