export type HostProfileId = "mcp-use" | "claude" | "chatgpt" | "claude-desktop";

export interface HostProfile {
  id: HostProfileId;
  label: string;
  /** Sent in the `ui/initialize` result. */
  hostInfo: { name: string; version: string };
  /** Merged over upstream's buildDefaultHostCapabilities(); `undefined` drops a key. */
  hostCapabilities: Record<string, unknown>;
  hostContext: {
    availableDisplayModes: Array<"inline" | "pip" | "fullscreen">;
    platform: "web" | "desktop" | "mobile";
    userAgent: string;
    toolInfo: boolean;
    containerDimensions?: { maxWidth?: number; maxHeight?: number };
    safeAreaInsets?: {
      top: number;
      right: number;
      bottom: number;
      left: number;
    };
    styleVariables: (theme: "light" | "dark") => Record<string, string>;
    fontCss?: string;
  };
  /** Inject the ChatGPT Apps SDK `window.openai` shim. */
  openaiShim: boolean;
  /** Capture file the values come from, e.g. `captures/chatgpt-2026-10-07.json`. */
  source: string;
}
