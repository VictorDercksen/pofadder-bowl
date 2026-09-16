import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Magic-link / invite landing. Supports both shapes:
 *  - token_hash + type (custom email templates, see supabase/templates)
 *  - code (PKCE flow used by default templates and signInWithOtp)
 * Verifies with Supabase Auth and sets the session cookie.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/home";
  const next = nextParam.startsWith("/") ? nextParam : "/home";

  const redirectTo = request.nextUrl.clone();
  redirectTo.search = "";

  // No verifiable parameter: Supabase's default templates put the session in the URL
  // fragment (implicit flow). The fragment survives the redirect; the client page stores it.
  if (!token_hash && !code) {
    redirectTo.pathname = "/auth/session";
    redirectTo.searchParams.set("next", next);
    return NextResponse.redirect(redirectTo);
  }

  const supabase = await createClient();
  let ok = false;
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    ok = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  }

  if (ok) {
    redirectTo.pathname = next;
    const res = NextResponse.redirect(redirectTo);
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  }
  redirectTo.pathname = "/login";
  redirectTo.searchParams.set("reason", "invalid");
  return NextResponse.redirect(redirectTo);
}
