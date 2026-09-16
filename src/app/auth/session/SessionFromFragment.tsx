"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SessionFromFragment({ next }: { next: string }) {
  const router = useRouter();

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");
    const error = hash.get("error_description") ?? hash.get("error");
    if (error || !accessToken || !refreshToken) {
      router.replace("/login?reason=invalid");
      return;
    }
    const supabase = createClient();
    supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error: e }) => {
        if (e) {
          router.replace("/login?reason=invalid");
          return;
        }
        // Remove the tokens from the address bar before continuing.
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
        router.replace(next);
        router.refresh();
      })
      .catch(() => router.replace("/login?reason=invalid"));
  }, [next, router]);

  return <p className="pb-small" role="status" aria-live="polite">Signing you in…</p>;
}
