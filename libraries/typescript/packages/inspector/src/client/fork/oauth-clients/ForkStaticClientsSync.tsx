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

interface SyncedClientEntry {
  serverUrl: string;
  clientId: string;
  clientSecret: string;
}

/**
 * Syncs confidential client secrets configured in the Inspector connection form / localStorage
 * to the server-side OAuth BFF registry (/inspector/api/fork/oauth/clients).
 *
 * Runs reactively whenever `useMcpClient().servers` changes (app load, server add, edit, or removal),
 * and automatically captures/restores client secrets typed into connection form inputs without
 * requiring any modifications or hooks in upstream form components.
 */
export function ForkStaticClientsSync(): null {
  const { servers } = useMcpClient();
  const syncedRef = useRef<Map<string, SyncedClientEntry>>(new Map());

  // Function to register a client with the BFF
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
      .catch((err) => {
        console.warn(
          "[ForkStaticClientsSync] Failed to register static OAuth client:",
          err
        );
      });
  };

  // 1. Sync stored secrets and server configurations to BFF
  useEffect(() => {
    // Check localStorage stored connections
    let storedConnections: Record<string, Record<string, unknown>> = {};
    try {
      const raw = localStorage.getItem("mcp-inspector-connections");
      if (raw) {
        storedConnections = JSON.parse(raw) as Record<string, Record<string, unknown>>;
      }
    } catch {
      // Ignore JSON storage parsing errors
    }

    // Check all secrets saved in dedicated fork storage
    const forkSecrets = getAllForkOAuthSecrets();
    for (const entry of Object.values(forkSecrets)) {
      syncToBff(entry.serverUrl, entry.clientId, entry.clientSecret);
    }

    // Check servers in memory
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

      // Check Direct mode warning (feat 04 - question 4)
      const connectionMode =
        server.connectionMode || (stored?.connectionMode as string | undefined);
      const isDirect =
        connectionMode === "direct" ||
        stored?.connectionType === "Direct";

      if (clientId && clientSecret) {
        if (isDirect) {
          toast.warning(
            `Connection "${server.displayName || server.url}" has a client secret configured, but is in Direct mode. Token requests must go through Proxy mode to apply confidential client authentication.`,
            { id: `direct-mode-secret-${server.id || server.url}` }
          );
        }

        saveForkOAuthSecret(server.url, clientId, clientSecret);
        syncToBff(server.url, clientId, clientSecret);
      }
    }

    // Remove static clients for servers that have been deleted or secrets cleared
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

  // 2. Global DOM listeners to capture typed secrets and pre-fill form
  useEffect(() => {
    if (typeof window === "undefined" || !window.document) return;

    const findCurrentContext = (
      inputEl: HTMLElement
    ): { serverUrl: string; clientId: string } => {
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

      const params = new URLSearchParams(window.location.search);
      const urlFromQuery = params.get("server") || params.get("autoConnect") || "";
      const serverUrl = (urlEl?.value || urlFromQuery || servers[0]?.url || "").trim();
      const clientId = (clientIdEl?.value || servers.find(s => s.url === serverUrl)?.oauth?.clientId || "").trim();

      return { serverUrl, clientId };
    };

    const handleSecretInput = (event: Event) => {
      const target = event.target as HTMLInputElement | null;
      if (!target || target.tagName !== "INPUT") return;

      const placeholder = target.getAttribute("placeholder") || "";
      if (!placeholder.includes("Client secret")) return;

      const clientSecret = target.value.trim();
      if (!clientSecret) return;

      const { serverUrl, clientId } = findCurrentContext(target);
      if (serverUrl && clientId) {
        saveForkOAuthSecret(serverUrl, clientId, clientSecret);
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
            const { serverUrl, clientId } = findCurrentContext(input);
            if (serverUrl && clientId) {
              saveForkOAuthSecret(serverUrl, clientId, secret);
              syncToBff(serverUrl, clientId, secret);
            }
          }
        }
      }
    };

    // Pre-fill secret input if empty when Connection Settings tab opens
    const checkAndPrefillSecretInput = () => {
      const secretInputs = document.querySelectorAll(
        'input[placeholder*="Client secret" i]'
      );
      if (secretInputs.length === 0) return;

      const params = new URLSearchParams(window.location.search);
      const urlFromQuery = params.get("server") || params.get("autoConnect") || "";
      const targetUrl = urlFromQuery || servers[0]?.url || "";
      if (!targetUrl) return;

      const stored = getForkOAuthSecret(targetUrl);
      if (!stored?.clientSecret) return;

      for (const input of Array.from(secretInputs) as HTMLInputElement[]) {
        if (!input.value) {
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
      checkAndPrefillSecretInput();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Initial check
    checkAndPrefillSecretInput();

    return () => {
      window.document.removeEventListener("input", handleSecretInput, true);
      window.document.removeEventListener("change", handleSecretInput, true);
      window.document.removeEventListener("click", handleClick, true);
      observer.disconnect();
    };
  }, [servers]);

  return null;
}
