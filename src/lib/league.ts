import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import type { Database, Tables } from "@/lib/database.types";

export type Role = "participant" | "member" | "commissioner";

export type LeagueContext = {
  supabase: SupabaseClient<Database>;
  user: User;
  profile: Tables<"profiles">;
  league: Tables<"leagues">;
  event: Tables<"events">;
  membership: Tables<"memberships">;
  /** Effective role: commissioner > participant > member. */
  role: Role;
  isCommissioner: boolean;
  isParticipant: boolean;
};

/** Verified user (or null). Uses getClaims() so the JWT is validated, not just read from the cookie. */
export const getVerifiedUser = cache(async (): Promise<{ supabase: SupabaseClient<Database>; user: User | null }> => {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return { supabase, user: null };
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user ?? null };
});

/**
 * Loads the signed-in user's league context. Redirects to /login when signed out
 * and to /no-access when the account has no active membership for the configured league.
 */
export const getLeagueContext = cache(async (): Promise<LeagueContext> => {
  const { supabase, user } = await getVerifiedUser();
  if (!user) redirect("/login?reason=session");

  // First sign-in after an invite: activate the membership.
  await supabase.rpc("activate_membership");

  const [{ data: league }, { data: profile }] = await Promise.all([
    supabase.from("leagues").select("*").eq("slug", publicEnv.leagueSlug).maybeSingle(),
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
  ]);
  if (!league || !profile) redirect("/no-access");

  const [{ data: membership }, { data: event }] = await Promise.all([
    supabase.from("memberships").select("*").eq("league_id", league.id).eq("user_id", user.id).eq("status", "active").maybeSingle(),
    supabase.from("events").select("*").eq("league_id", league.id).eq("slug", publicEnv.eventSlug).maybeSingle(),
  ]);
  if (!membership) redirect("/no-access");
  if (!event) redirect("/setup?reason=event");

  const isCommissioner = membership.is_commissioner;
  const isParticipant = event.participant_user_id === user.id;
  const role: Role = isCommissioner ? "commissioner" : isParticipant ? "participant" : "member";
  return { supabase, user, profile, league, event, membership, role, isCommissioner, isParticipant };
});

export function homeFor(ctx: Pick<LeagueContext, "role">): string {
  return ctx.role === "commissioner" ? "/review" : ctx.role === "participant" ? "/my-trip" : "/game-centre";
}

export async function requireCommissioner(): Promise<LeagueContext> {
  const ctx = await getLeagueContext();
  if (!ctx.isCommissioner) redirect(homeFor(ctx));
  return ctx;
}

export async function requireParticipant(): Promise<LeagueContext> {
  const ctx = await getLeagueContext();
  if (!ctx.isParticipant && !ctx.isCommissioner) redirect(homeFor(ctx));
  return ctx;
}

/** Score derived from the approved state of each challenge (view event_scores). */
export async function getEventScore(ctx: LeagueContext) {
  const { data } = await ctx.supabase.from("event_scores").select("*").eq("event_id", ctx.event.id).maybeSingle();
  return { approved: data?.approved_points ?? 0, max: data?.max_points ?? ctx.event.max_points, approvedChallenges: data?.approved_challenges ?? 0, total: data?.total_challenges ?? 0 };
}
