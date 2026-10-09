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
  /** Metadata injected into client tool calls (params._meta), as specified by ChatGPT / webplus. */
  clientToolCallMeta?: HostProfileClientMeta;
  /** Capture file the values come from, e.g. `captures/chatgpt-2026-10-07.json`. */
  source: string;
}

export interface HostProfileUserLocation {
  city?: string;
  region?: string;
  country?: string;
  timezone?: string;
  latitude?: number;
  longitude?: number;
}

export interface HostProfileClientMeta {
  "openai/locale"?: string;
  "webplus/i18n"?: string;
  "openai/userAgent"?: string;
  "openai/userLocation"?: HostProfileUserLocation;
  "openai/subject"?: string;
  "openai/session"?: string;
  "openai/organization"?: string;
  [key: string]: unknown;
}
