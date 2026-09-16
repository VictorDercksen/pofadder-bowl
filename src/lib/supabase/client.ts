"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import type { Database } from "@/lib/database.types";

let browserClient: SupabaseClient<Database> | undefined;

/** Browser Supabase client (cookie-backed session shared with the server). */
export function createClient(): SupabaseClient<Database> {
  if (!browserClient) {
    browserClient = createBrowserClient<Database>(publicEnv.supabaseUrl, publicEnv.supabasePublishableKey);
  }
  return browserClient;
}
