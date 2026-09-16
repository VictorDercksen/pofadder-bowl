import "server-only";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicEnv, serverSecretKey } from "@/lib/env";
import type { Database } from "@/lib/database.types";

/**
 * Service-role client. Bypasses RLS. Only for trusted server steps:
 * inviting members (auth admin API) and the documented bootstrap script.
 * Never import this from a client component.
 */
export function createAdminClient(): SupabaseClient<Database> {
  return createSupabaseClient<Database>(publicEnv.supabaseUrl, serverSecretKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
