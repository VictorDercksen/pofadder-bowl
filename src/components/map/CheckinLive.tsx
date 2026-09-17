"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Refreshes the server-rendered map when the participant's check-ins change, so league
 * members see new points and the route line without reloading. Realtime first, with a
 * bounded poll while the tab is visible in case the socket is blocked.
 */
export function CheckinLive({ eventId, pollMs = 45_000 }: { eventId: string; pollMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const supabase = createClient();
    let timer: number | null = null;
    const refresh = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => router.refresh(), 400);
    };
    const channel = supabase
      .channel(`checkins:${eventId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "checkins", filter: `event_id=eq.${eventId}` }, refresh)
      .subscribe();
    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine) router.refresh();
    }, pollMs);
    window.addEventListener("online", refresh);
    return () => {
      supabase.removeChannel(channel);
      window.clearInterval(poll);
      window.removeEventListener("online", refresh);
      if (timer) window.clearTimeout(timer);
    };
  }, [eventId, pollMs, router]);
  return null;
}
