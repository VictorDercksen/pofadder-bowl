/**
 * Which routes are open to anonymous visitors, and where everyone else is sent.
 * Pure so the proxy's first gate can be unit tested. Pages and server actions still
 * re-check the session and role themselves (getLeagueContext); this only decides the redirect.
 */

/** Public by design: the teaser, the in-memory demo, sign-in, the auth callbacks, the consented recap, setup. */
export const PUBLIC_PREFIXES = ["/teaser", "/demo", "/login", "/auth", "/recap/public", "/setup"] as const;

/** Framework and static asset paths the proxy matcher can still see. */
const ASSET_PREFIXES = ["/_next", "/brand", "/nfl", "/maps", "/favicon"] as const;

/** Where anonymous traffic to a private route lands. */
export const ANONYMOUS_LANDING = "/teaser";

export function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return [...PUBLIC_PREFIXES, ...ASSET_PREFIXES].some((p) => pathname === p || pathname.startsWith(p + "/"));
}

/**
 * Redirect target for an anonymous request to a private path. The requested path rides
 * along as `next` so the teaser's sign-in button can bring the member back to it; the root
 * and the role home add nothing, so they are dropped.
 */
export function anonymousRedirect(pathname: string, search = ""): { pathname: string; next: string | null } {
  const wanted = pathname + (search.startsWith("?") ? search : "");
  const next = pathname === "/" || pathname === "/home" ? null : wanted;
  return { pathname: ANONYMOUS_LANDING, next };
}
