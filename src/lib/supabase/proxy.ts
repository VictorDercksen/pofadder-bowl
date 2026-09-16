import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv, isBackendConfigured } from "@/lib/env";

const PUBLIC_PREFIXES = ["/", "/teaser", "/demo", "/login", "/auth", "/recap/public", "/setup", "/_next", "/brand", "/nfl", "/maps", "/favicon"];

function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PREFIXES.some((p) => p !== "/" && (pathname === p || pathname.startsWith(p + "/")));
}

/**
 * Refreshes the Supabase session cookie on every matched request and redirects
 * anonymous visitors away from private league routes. Server Actions and pages
 * re-check membership themselves; this is only the first gate.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  if (!isBackendConfigured()) {
    // No backend: private routes explain setup instead of pretending.
    if (!isPublicPath(request.nextUrl.pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = "/setup";
      return NextResponse.redirect(url);
    }
    return response;
  }

  const supabase = createServerClient(publicEnv.supabaseUrl, publicEnv.supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Do not put logic between client creation and this call: it refreshes the token.
  const { data, error } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims) && !error;

  const { pathname } = request.nextUrl;
  if (!signedIn && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    url.searchParams.set("reason", "session");
    return NextResponse.redirect(url);
  }

  if (!isPublicPath(pathname)) {
    // Private pages and media must never land in a shared cache.
    response.headers.set("Cache-Control", "private, no-store");
  }
  return response;
}
