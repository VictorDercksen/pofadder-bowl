"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { CSSProperties } from "react";
import { safeInternalPath } from "@/lib/paths";

/**
 * The teaser's sign-in button. When the proxy bounced a signed-out member here from a private
 * screen it appended `next`; the button carries it to /login so sign-in returns them there.
 * Reads the query string on the client so the teaser stays prerendered.
 */
export function SignInLink({ className, style, children }: { className: string; style: CSSProperties; children: React.ReactNode }) {
  const params = useSearchParams();
  const next = safeInternalPath(params.get("next"), "");
  const href = next ? `/login?next=${encodeURIComponent(next)}` : "/login";
  return (
    <Link className={className} href={href} style={style}>
      {children}
    </Link>
  );
}
