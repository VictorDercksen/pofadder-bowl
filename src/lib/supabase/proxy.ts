import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv, isBackendConfigured } from "@/lib/env";
import { anonymousRedirect, isPublicPath } from "@/lib/public-paths";

/**
 * Refreshes the Supabase session cookie on every matched request and sends anonymous
 * visitors on private league routes to the public teaser. Server Actions and pages
 * re-check membership and role themselves; this is only the first gate.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  if (!isBackendConfigured()) {
    // No backend: private routes explain setup instead of pretending.
    if (!isPublicPath(request.nextUrl.pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = "/setup";
      url.search = "";
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

  const { pathname, search } = request.nextUrl;
  if (!signedIn && !isPublicPath(pathname)) {
    // Unauthenticated traffic lands on the teaser; its sign-in button carries the deep link.
    const target = anonymousRedirect(pathname, search);
    const url = request.nextUrl.clone();
    url.pathname = target.pathname;
    url.search = "";
    if (target.next) url.searchParams.set("next", target.next);
    const redirect = NextResponse.redirect(url);
    redirect.headers.set("Cache-Control", "private, no-store");
    return redirect;
  }

  if (!isPublicPath(pathname)) {
    // Private pages and media must never land in a shared cache.
    response.headers.set("Cache-Control", "private, no-store");
  }
  return response;
}
