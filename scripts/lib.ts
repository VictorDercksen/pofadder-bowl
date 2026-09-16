import { config } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/database.types";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

export function env(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) {
    console.error(`Missing ${name}. See .env.example.`);
    process.exit(1);
  }
  return v;
}

export function adminClient(): SupabaseClient<Database> {
  return createClient<Database>(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SECRET_KEY"), { auth: { autoRefreshToken: false, persistSession: false } });
}

export function anonClient(): SupabaseClient<Database> {
  return createClient<Database>(env("NEXT_PUBLIC_SUPABASE_URL"), env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"), { auth: { autoRefreshToken: false, persistSession: false } });
}

export function arg(name: string): string | undefined {
  const i = process.argv.findIndex((a) => a === `--${name}`);
  if (i >= 0) return process.argv[i + 1];
  const eq = process.argv.find((a) => a.startsWith(`--${name}=`));
  return eq?.slice(name.length + 3);
}

/** Creates (or finds) an auth user with a password, without sending email. */
export async function ensureUser(admin: SupabaseClient<Database>, email: string, password: string, displayName: string): Promise<string> {
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const existing = list?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (existing) {
    await admin.auth.admin.updateUserById(existing.id, { password, email_confirm: true });
    return existing.id;
  }
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: displayName } });
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);
  return data.user.id;
}

export async function leagueAndEvent(admin: SupabaseClient<Database>) {
  const leagueSlug = env("NEXT_PUBLIC_LEAGUE_SLUG", "show-us-your-tds");
  const eventSlug = env("NEXT_PUBLIC_EVENT_SLUG", "pofadder-bowl-2026");
  const { data: league } = await admin.from("leagues").select("*").eq("slug", leagueSlug).maybeSingle();
  if (!league) throw new Error(`League ${leagueSlug} not found. Run the seed first (supabase db reset / seed.sql).`);
  const { data: event } = await admin.from("events").select("*").eq("league_id", league.id).eq("slug", eventSlug).maybeSingle();
  if (!event) throw new Error(`Event ${eventSlug} not found. Run the seed first.`);
  return { league, event };
}
