import { describe, expect, it } from "vitest";
import { getDevCallbackRedirect } from "../../src/server/dev-callback-redirect.js";
import { isOpenEndedSseResponse } from "../../src/server/proxy/mcp-proxy.js";
import {
  resolveSpaRedirect,
  restoreSpaRoute,
} from "../../src/client/utils/spa-routing.js";

describe("standalone inspector routing", () => {
  it("redirects only legacy root callback aliases", () => {
    expect(getDevCallbackRedirect("/oauth/callback?code=abc&state=123")).toBe(
      "/inspector/oauth/callback?code=abc&state=123"
    );
    expect(getDevCallbackRedirect("/auth/callback?code=abc")).toBe(
      "/inspector/auth/callback?code=abc"
    );
  });

  it("does not redirect canonical callback routes into a loop", () => {
    expect(
      getDevCallbackRedirect("/inspector/oauth/callback?code=abc&state=123")
    ).toBeNull();
    expect(
      getDevCallbackRedirect("/inspector/auth/callback?code=abc")
    ).toBeNull();
  });

  it("streams open-ended SSE responses regardless of request method", () => {
    expect(isOpenEndedSseResponse("text/event-stream", null)).toBe(true);
    expect(
      isOpenEndedSseResponse("text/event-stream; charset=utf-8", null)
    ).toBe(true);
    expect(isOpenEndedSseResponse("text/event-stream", "128")).toBe(false);
    expect(isOpenEndedSseResponse("application/json", null)).toBe(false);
  });

  describe("GitLab Pages SPA static redirects", () => {
    it("resolves nested GitLab Pages OAuth callback without compounding loops", () => {
      const res = resolveSpaRedirect(
        "/GABRIEL.BENETOUX/mcp-use-fork/inspector/oauth/callback",
        "?code=auth_code_123&state=state_xyz"
      );
      expect(res.spaRoute).toBe("/oauth/callback");
      expect(res.redirectUrl).toBe(
        "/GABRIEL.BENETOUX/mcp-use-fork/inspector/?code=auth_code_123&state=state_xyz&_spa_route=%2Foauth%2Fcallback"
      );

      // Verify the client-side SPA restoration restores the exact canonical URL
      const restored = restoreSpaRoute(
        "/GABRIEL.BENETOUX/mcp-use-fork/inspector/",
        "?code=auth_code_123&state=state_xyz&_spa_route=%2Foauth%2Fcallback"
      );
      expect(restored).toBe(
        "/GABRIEL.BENETOUX/mcp-use-fork/inspector/oauth/callback?code=auth_code_123&state=state_xyz"
      );
    });

    it("breaks and heals infinite redirect loops (/inspector/inspector/...)", () => {
      const res = resolveSpaRedirect(
        "/GABRIEL.BENETOUX/mcp-use-fork/inspector/inspector/inspector/oauth/callback",
        "?code=auth_code_123"
      );
      expect(res.spaRoute).toBe("/oauth/callback");
      expect(res.redirectUrl).toBe(
        "/GABRIEL.BENETOUX/mcp-use-fork/inspector/?code=auth_code_123&_spa_route=%2Foauth%2Fcallback"
      );

      const healed = restoreSpaRoute(
        "/GABRIEL.BENETOUX/mcp-use-fork/inspector/inspector/inspector/",
        ""
      );
      expect(healed).toBe("/GABRIEL.BENETOUX/mcp-use-fork/inspector/");
    });

    it("handles legacy callbacks at GitLab Pages project root", () => {
      const res = resolveSpaRedirect(
        "/GABRIEL.BENETOUX/mcp-use-fork/oauth/callback",
        "?code=legacy_code"
      );
      expect(res.spaRoute).toBe("/oauth/callback");
      expect(res.redirectUrl).toBe(
        "/GABRIEL.BENETOUX/mcp-use-fork/inspector/?code=legacy_code&_spa_route=%2Foauth%2Fcallback"
      );
    });

    it("does not redirect missing static assets", () => {
      expect(
        resolveSpaRedirect(
          "/GABRIEL.BENETOUX/mcp-use-fork/inspector/assets/main.js"
        )
      ).toEqual({ redirectUrl: null, spaRoute: null });
      expect(
        resolveSpaRedirect(
          "/GABRIEL.BENETOUX/mcp-use-fork/inspector/favicon.ico"
        )
      ).toEqual({ redirectUrl: null, spaRoute: null });
    });

    it("redirects project root to /inspector/", () => {
      const res = resolveSpaRedirect("/GABRIEL.BENETOUX/mcp-use-fork/", "");
      expect(res.spaRoute).toBeNull();
      expect(res.redirectUrl).toBe(
        "/GABRIEL.BENETOUX/mcp-use-fork/inspector/"
      );
    });
  });
});
