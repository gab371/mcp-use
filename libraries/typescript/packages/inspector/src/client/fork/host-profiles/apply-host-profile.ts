import type { McpUiHostContext } from "@mcp-use/client/react";
import type { HostProfile } from "./types";

/**
 * Overlay host-specific profile customizations (availableDisplayModes,
 * platform, userAgent, containerDimensions, fonts, and toolInfo gating)
 * onto the base McpUiHostContext.
 */
export function applyHostProfile(
  base: McpUiHostContext,
  profile: HostProfile,
  deviceType?: "desktop" | "mobile"
): McpUiHostContext {
  const profileCtx = profile.hostContext;

  const maxWidth =
    deviceType === "mobile"
      ? base.containerDimensions.maxWidth
      : profileCtx.containerDimensions?.maxWidth
      ? Math.min(
          base.containerDimensions.maxWidth,
          profileCtx.containerDimensions.maxWidth
        )
      : base.containerDimensions.maxWidth;

  return {
    ...base,
    availableDisplayModes: profileCtx.availableDisplayModes,
    containerDimensions: {
      ...base.containerDimensions,
      maxWidth,
    },
    platform: deviceType === "mobile" ? "mobile" : profileCtx.platform,
    userAgent: profileCtx.userAgent,
    styles: {
      variables: {
        ...(base.styles?.variables || {}),
        ...profileCtx.styleVariables(base.theme),
      } as any,
      css: {
        fonts:
          profileCtx.fontCss ??
          base.styles?.css?.fonts ??
          '@font-face{font-family:"MCP Host Sans";src:local("Ubuntu"),local("Arial");font-display:swap;}',
      },
    },
    toolInfo: profileCtx.toolInfo ? base.toolInfo : undefined,
  };
}
