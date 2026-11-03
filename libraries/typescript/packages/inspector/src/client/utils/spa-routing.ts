/**
 * Single Page Application (SPA) routing helpers for static hosting (GitLab Pages, GitHub Pages).
 *
 * When hosting a static build on GitLab Pages (e.g. at `/<namespace>/<project>/inspector`),
 * deep paths such as `/inspector/oauth/callback` or `/oauth/callback` are not actual files
 * on disk and GitLab Pages returns the root `/404.html`.
 *
 * These helpers resolve the target inspector base path without compounding relative segments
 * into infinite redirect loops (`/inspector/inspector/...`), preserve all query parameters
 * (such as OAuth `code` and `state`), and restore the canonical SPA URL in the browser's history.
 */

export interface SpaRedirectResult {
  redirectUrl: string | null;
  spaRoute: string | null;
}

/**
 * Determine the redirect destination for an incoming 404 path.
 *
 * @param pathname - The current window.location.pathname
 * @param search - The current window.location.search (e.g. `?code=abc&state=123`)
 * @param hash - The current window.location.hash
 */
export function resolveSpaRedirect(
  pathname: string,
  search: string = "",
  hash: string = ""
): SpaRedirectResult {
  // Never redirect missing static assets (scripts, stylesheets, images, fonts)
  if (
    /\.(js|css|png|jpg|jpeg|gif|svg|ico|json|woff|woff2|ttf|map)$/i.test(
      pathname
    )
  ) {
    return { redirectUrl: null, spaRoute: null };
  }

  // 1. Collapse any repeated /inspector/ segments caused by legacy relative redirects
  const cleanPath = pathname.replace(/(\/inspector)+/g, "/inspector");

  const inspectorMarker = "/inspector";
  const inspIdx = cleanPath.indexOf(inspectorMarker);

  let projectBase = "";
  let subPath = "";

  if (inspIdx !== -1) {
    projectBase = cleanPath.slice(0, inspIdx).replace(/\/+$/, "");
    subPath = cleanPath.slice(inspIdx + inspectorMarker.length);
  } else {
    // Check for legacy callback paths outside /inspector (e.g. /<project>/oauth/callback)
    const oauthMatch = cleanPath.match(
      /^(\/.*?)\/(oauth\/callback|auth\/callback)(.*)$/
    );
    if (oauthMatch) {
      projectBase = oauthMatch[1].replace(/\/+$/, "");
      subPath = "/" + oauthMatch[2] + (oauthMatch[3] || "");
    } else if (
      cleanPath === "/oauth/callback" ||
      cleanPath === "/auth/callback"
    ) {
      projectBase = "";
      subPath = cleanPath;
    } else {
      projectBase = cleanPath.replace(/\/+$/, "");
      subPath = "";
    }
  }

  subPath = subPath.replace(/^\/+/, "");
  const inspectorBase = (projectBase ? projectBase : "") + "/inspector";

  if (!subPath) {
    return {
      redirectUrl: `${inspectorBase}/${search}${hash}`,
      spaRoute: null,
    };
  }

  const spaRoute = "/" + subPath;
  const rawSearch = search.startsWith("?") ? search.slice(1) : search;
  const params = new URLSearchParams(rawSearch);
  params.set("_spa_route", spaRoute);

  return {
    redirectUrl: `${inspectorBase}/?${params.toString()}${hash}`,
    spaRoute,
  };
}

/**
 * Restore the canonical SPA route from query parameters and heal looped paths.
 *
 * @param pathname - Current window.location.pathname
 * @param search - Current window.location.search
 * @param hash - Current window.location.hash
 * @returns The restored canonical URL, or null if no restoration is needed
 */
export function restoreSpaRoute(
  pathname: string,
  search: string = "",
  hash: string = ""
): string | null {
  const rawSearch = search.startsWith("?") ? search.slice(1) : search;
  const params = new URLSearchParams(rawSearch);
  const spaRoute = params.get("_spa_route");

  if (!spaRoute) {
    // Heal any repeated /inspector/ segments in the current address bar
    if (/\/inspector\/inspector/.test(pathname)) {
      const healed = pathname.replace(/(\/inspector)+/g, "/inspector");
      const s = params.toString();
      return healed + (s ? "?" + s : "") + hash;
    }
    return null;
  }

  params.delete("_spa_route");
  const remainingSearch = params.toString();
  const targetPath = spaRoute.startsWith("/") ? spaRoute : "/" + spaRoute;

  let currentBase = pathname
    .replace(/\/+$/, "")
    .replace(/(\/inspector)+/g, "/inspector");
  if (!currentBase.endsWith("/inspector")) {
    currentBase += "/inspector";
  }

  return (
    currentBase + targetPath + (remainingSearch ? "?" + remainingSearch : "") + hash
  );
}
