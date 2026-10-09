import { getPackageVersion } from "@/client/telemetry/utils";
import type { HostProfile, HostProfileClientMeta, HostProfileId } from "./types";

export const DEFAULT_CHATGPT_CLIENT_META: HostProfileClientMeta = {
  "openai/locale": "en-US",
  "webplus/i18n": "en-US",
  "openai/userAgent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 ChatGPT/1.0",
  "openai/userLocation": {
    city: "San Francisco",
    region: "CA",
    country: "US",
    timezone: "America/Los_Angeles",
    latitude: 37.7749,
    longitude: -122.4194,
  },
  "openai/subject": "user_2tX9rQ7kLmP3nB4vC8wZ",
  "openai/session": "sess_9a8b7c6d5e4f3a2b1c",
  "openai/organization": "org_chatgpt_simulated",
};

const CLAUDE_LIGHT_VARIABLES: Record<string, string> = {
  "--color-background-primary": "#FAF9F5",
  "--color-background-secondary": "#F3F1EB",
  "--color-background-tertiary": "#E8E5DE",
  "--color-background-inverse": "#1F1E1D",
  "--color-text-primary": "#1F1E1D",
  "--color-text-secondary": "#6B6860",
  "--color-text-tertiary": "#8F8C82",
  "--color-text-inverse": "#FAF9F5",
  "--color-border-primary": "#E5E2DA",
  "--color-border-secondary": "#D4D0C5",
  "--color-border-tertiary": "#C2BDAF",
  "--font-sans": '"Anthropic Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  "--border-radius-sm": "4px",
  "--border-radius-md": "8px",
  "--border-radius-lg": "12px",
};

const CLAUDE_DARK_VARIABLES: Record<string, string> = {
  "--color-background-primary": "#1F1E1D",
  "--color-background-secondary": "#2B2A27",
  "--color-background-tertiary": "#383633",
  "--color-background-inverse": "#FAF9F5",
  "--color-text-primary": "#F3F1EB",
  "--color-text-secondary": "#ABA79C",
  "--color-text-tertiary": "#7D7A71",
  "--color-text-inverse": "#1F1E1D",
  "--color-border-primary": "#383633",
  "--color-border-secondary": "#484642",
  "--color-border-tertiary": "#5A5751",
  "--font-sans": '"Anthropic Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  "--border-radius-sm": "4px",
  "--border-radius-md": "8px",
  "--border-radius-lg": "12px",
};

const CHATGPT_LIGHT_VARIABLES: Record<string, string> = {
  "--color-background-primary": "#FFFFFF",
  "--color-background-secondary": "#F9F9F9",
  "--color-background-tertiary": "#ECECEC",
  "--color-background-inverse": "#0D0D0D",
  "--color-text-primary": "#0D0D0D",
  "--color-text-secondary": "#5D5D5D",
  "--color-text-tertiary": "#8F8F8F",
  "--color-text-inverse": "#FFFFFF",
  "--color-border-primary": "#E5E5E5",
  "--color-border-secondary": "#D4D4D4",
  "--color-border-tertiary": "#C2C2C2",
  "--font-sans": '"Söhne", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  "--border-radius-sm": "6px",
  "--border-radius-md": "10px",
  "--border-radius-lg": "16px",
};

const CHATGPT_DARK_VARIABLES: Record<string, string> = {
  "--color-background-primary": "#212121",
  "--color-background-secondary": "#171717",
  "--color-background-tertiary": "#2F2F2F",
  "--color-background-inverse": "#FFFFFF",
  "--color-text-primary": "#ECECEC",
  "--color-text-secondary": "#B4B4B4",
  "--color-text-tertiary": "#8E8E8E",
  "--color-text-inverse": "#0D0D0D",
  "--color-border-primary": "#383838",
  "--color-border-secondary": "#484848",
  "--color-border-tertiary": "#5A5A5A",
  "--font-sans": '"Söhne", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  "--border-radius-sm": "6px",
  "--border-radius-md": "10px",
  "--border-radius-lg": "16px",
};

export function createMcpUseProfile(): HostProfile {
  const version = getPackageVersion();
  return {
    id: "mcp-use",
    label: "mcp-use (default)",
    hostInfo: {
      name: "mcp-use-inspector",
      version,
    },
    hostCapabilities: {},
    hostContext: {
      availableDisplayModes: ["inline", "pip", "fullscreen"],
      platform: "web",
      userAgent: `mcp-use-inspector/${version}`,
      toolInfo: true,
      safeAreaInsets: { top: 0, right: 0, bottom: 0, left: 0 },
      styleVariables: () => ({}),
      fontCss:
        '@font-face{font-family:"MCP Host Sans";src:local("Ubuntu"),local("Arial");font-display:swap;}',
    },
    openaiShim: true,
    source: "built-in:mcp-use-inspector",
  };
}

export function createClaudeProfile(): HostProfile {
  return {
    id: "claude",
    label: "Claude (claude.ai)",
    hostInfo: {
      name: "claude-ai",
      version: "0.1.0",
    },
    hostCapabilities: {
      sampling: undefined,
      message: undefined,
      downloadFile: undefined,
      modelContext: undefined,
    },
    hostContext: {
      availableDisplayModes: ["inline", "fullscreen"],
      platform: "web",
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Claude/1.0",
      toolInfo: true,
      containerDimensions: { maxWidth: 768 },
      safeAreaInsets: { top: 0, right: 0, bottom: 0, left: 0 },
      styleVariables: (theme) =>
        theme === "dark" ? CLAUDE_DARK_VARIABLES : CLAUDE_LIGHT_VARIABLES,
      fontCss:
        '@font-face{font-family:"Anthropic Sans";src:local("Anthropic Sans"),local("system-ui");font-display:swap;}',
    },
    openaiShim: false,
    source: "resources/captures/claude-2026-10-07.json",
  };
}

export function createChatGptProfile(): HostProfile {
  return {
    id: "chatgpt",
    label: "ChatGPT (Apps)",
    hostInfo: {
      name: "chatgpt",
      version: "1.0.0",
    },
    hostCapabilities: {
      sampling: undefined,
      message: undefined,
      downloadFile: undefined,
    },
    hostContext: {
      availableDisplayModes: ["inline", "fullscreen"],
      platform: "web",
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 ChatGPT/1.0",
      toolInfo: false,
      containerDimensions: { maxWidth: 800 },
      safeAreaInsets: { top: 0, right: 0, bottom: 0, left: 0 },
      styleVariables: (theme) =>
        theme === "dark" ? CHATGPT_DARK_VARIABLES : CHATGPT_LIGHT_VARIABLES,
      fontCss:
        '@font-face{font-family:"Söhne";src:local("Söhne"),local("system-ui");font-display:swap;}',
    },
    openaiShim: true,
    clientToolCallMeta: DEFAULT_CHATGPT_CLIENT_META,
    source: "resources/captures/chatgpt-2026-10-07.json",
  };
}

export function createClaudeDesktopProfile(): HostProfile {
  return {
    id: "claude-desktop",
    label: "Claude Desktop",
    hostInfo: {
      name: "claude-desktop",
      version: "0.8.0",
    },
    hostCapabilities: {
      sampling: undefined,
      message: undefined,
      downloadFile: undefined,
      modelContext: undefined,
    },
    hostContext: {
      availableDisplayModes: ["inline"],
      platform: "desktop",
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ClaudeDesktop/0.8.0",
      toolInfo: true,
      containerDimensions: { maxWidth: 640 },
      safeAreaInsets: { top: 0, right: 0, bottom: 0, left: 0 },
      styleVariables: (theme) =>
        theme === "dark" ? CLAUDE_DARK_VARIABLES : CLAUDE_LIGHT_VARIABLES,
      fontCss:
        '@font-face{font-family:"Anthropic Sans";src:local("Anthropic Sans"),local("system-ui");font-display:swap;}',
    },
    openaiShim: false,
    source: "resources/captures/claude-desktop-2026-10-07.json",
  };
}

export const BUILT_IN_PROFILES: Record<HostProfileId, HostProfile> = {
  "mcp-use": createMcpUseProfile(),
  claude: createClaudeProfile(),
  chatgpt: createChatGptProfile(),
  "claude-desktop": createClaudeDesktopProfile(),
};

export const HOST_PROFILE_LIST: HostProfile[] = [
  BUILT_IN_PROFILES["mcp-use"],
  BUILT_IN_PROFILES.claude,
  BUILT_IN_PROFILES.chatgpt,
  BUILT_IN_PROFILES["claude-desktop"],
];

export function getHostProfile(id: string | null | undefined): HostProfile {
  if (id && id in BUILT_IN_PROFILES) {
    return BUILT_IN_PROFILES[id as HostProfileId];
  }
  return BUILT_IN_PROFILES["mcp-use"];
}
