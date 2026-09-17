import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import type { Database, Tables } from "@/lib/database.types";
import { MEMBER_VIEW_COOKIE, resolveAccess, type Role } from "@/lib/roles";

export type { Role } from "@/lib/roles";
export { describeRole, MEMBER_VIEW_COOKIE } from "@/lib/roles";

/** The signed-in account, taken from the verified JWT claims (no round trip to the Auth server). */
export type SessionUser = { id: string; email: string | null };

/** The member's linked Sleeper manager, from the imported league list. */
export type SleeperLink = { sleeperUserId: string; username: string | null; displayName: string; teamName: string | null; avatar: string | null };

export type LeagueContext = {
  supabase: SupabaseClient<Database>;
  user: SessionUser;
  profile: Tables<"profiles">;
  league: Tables<"leagues">;
  event: Tables<"events">;
  membership: Tables<"memberships">;
  /** Linked Sleeper manager, or null until the member confirms one. */
  sleeper: SleeperLink | null;
  /** True once the admin has imported the Sleeper league (members are then asked to confirm their team). */
  sleeperImported: boolean;
  /** Effective role: admin > commissioner > participant > member. */
  role: Role;
  /** App administration: invites, roles, participant, Sleeper links, event settings. */
  isAdmin: boolean;
  /** Refereeing: review, penalties, results, prop settlement, certificate. Admins are commissioners too. */
  isCommissioner: boolean;
  isParticipant: boolean;
  /** True when the account holds more than plain membership (admin, commissioner or participant). */
  canViewAsMember: boolean;
  /** True when an elevated account has switched to the league member view (cookie). Every flag above is then false. */
  viewingAsMember: boolean;
};

/**
 * Verified user (or null). getClaims() validates the JWT signature (against the project's
 * JWKS, cached in memory) instead of calling the Auth server on every request.
 */
export const getVerifiedUser = cache(async (): Promise<{ supabase: SupabaseClient<Database>; user: SessionUser | null }> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return { supabase, user: null };
  return { supabase, user: { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null } };
});

/**
 * Loads the signed-in user's league context. Redirects to /login when signed out
 * and to /no-access when the account has no active membership for the configured league.
 * Sign-on gates: confirm the Sleeper team (once the league is imported), then pick a kit.
 */
export const getLeagueContext = cache(async (): Promise<LeagueContext> => {
  const ctx = await getLeagueContextRaw();
  if (ctx.sleeperImported && !ctx.membership.sleeper_user_id) redirect("/choose-sleeper");
  // Every member wears a franchise: first sign-in goes to the kit picker.
  if (!ctx.profile.kit_team) redirect("/choose-team");
  return ctx;
});

type Loaded = {
  league: Tables<"leagues">;
  event: Tables<"events">;
  membership: Tables<"memberships">;
  profile: Tables<"profiles">;
  sleeper: SleeperLink | null;
  sleeperImported: boolean;
};

type ContextPayload = {
  status?: string;
  league?: Tables<"leagues">;
  event?: Tables<"events">;
  membership?: Tables<"memberships">;
  profile?: Tables<"profiles">;
  sleeper?: { sleeper_user_id: string; username: string | null; display_name: string; team_name: string | null; avatar: string | null } | null;
  sleeper_imported?: boolean;
};

function redirectFor(status: string | undefined): never {
  if (status === "no_event") redirect("/setup?reason=event");
  if (status === "signed_out") redirect("/login?reason=session");
  redirect("/no-access");
}

/** One round trip: the league_context RPC (migration 20260917000800). */
async function loadContext(supabase: SupabaseClient<Database>): Promise<Loaded | "missing"> {
  const { data, error } = await supabase.rpc("league_context", { p_league_slug: publicEnv.leagueSlug, p_event_slug: publicEnv.eventSlug });
  if (error) {
    // Migration not applied yet: fall back to the per-table path so a deploy never depends on db:push order.
    if (error.code === "PGRST202" || error.code === "42883" || /league_context/.test(error.message)) return "missing";
    redirect("/no-access");
  }
  const payload = (data ?? {}) as ContextPayload;
  if (payload.status !== "ok" || !payload.league || !payload.event || !payload.membership || !payload.profile) redirectFor(payload.status);
  const s = payload.sleeper;
  return {
    league: payload.league,
    event: payload.event,
    membership: payload.membership,
    profile: payload.profile,
    sleeper: s ? { sleeperUserId: s.sleeper_user_id, username: s.username, displayName: s.display_name, teamName: s.team_name, avatar: s.avatar } : null,
    sleeperImported: Boolean(payload.sleeper_imported),
  };
}

/** Pre-migration path: several round trips. Kept only until league_context exists in production. */
async function loadContextLegacy(supabase: SupabaseClient<Database>, user: SessionUser): Promise<Loaded> {
  await supabase.rpc("activate_membership");
  const [{ data: league }, { data: profile }] = await Promise.all([
    supabase.from("leagues").select("*").eq("slug", publicEnv.leagueSlug).maybeSingle(),
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
  ]);
  if (!league || !profile) redirect("/no-access");
  const [{ data: membership }, { data: event }, { count }] = await Promise.all([
    supabase.from("memberships").select("*").eq("league_id", league.id).eq("user_id", user.id).eq("status", "active").maybeSingle(),
    supabase.from("events").select("*").eq("league_id", league.id).eq("slug", publicEnv.eventSlug).maybeSingle(),
    supabase.from("sleeper_league_users").select("sleeper_user_id", { count: "exact", head: true }).eq("league_id", league.id),
  ]);
  if (!membership) redirect("/no-access");
  if (!event) redirect("/setup?reason=event");
  let sleeper: SleeperLink | null = null;
  if (membership.sleeper_user_id) {
    const { data: s } = await supabase.from("sleeper_league_users").select("*").eq("league_id", league.id).eq("sleeper_user_id", membership.sleeper_user_id).maybeSingle();
    if (s) sleeper = { sleeperUserId: s.sleeper_user_id, username: s.username, displayName: s.display_name, teamName: s.team_name, avatar: s.avatar };
  }
  return { league, event, membership, profile, sleeper, sleeperImported: (count ?? 0) > 0 };
}

/** Same as getLeagueContext but without the sign-on gates (used by the gate pages themselves). */
export const getLeagueContextRaw = cache(async (): Promise<LeagueContext> => {
  const { supabase, user } = await getVerifiedUser();
  if (!user) redirect("/login?reason=session");

  const first = await loadContext(supabase);
  const loaded = first === "missing" ? await loadContextLegacy(supabase, user) : first;

  const memberView = (await cookies()).get(MEMBER_VIEW_COOKIE)?.value === "1";
  const access = resolveAccess({ isAdmin: loaded.membership.is_admin, isCommissioner: loaded.membership.is_commissioner, isParticipant: loaded.event.participant_user_id === user.id }, memberView);
  return { supabase, user, ...loaded, ...access };
});

export function homeFor(ctx: Pick<LeagueContext, "role">): string {
  return ctx.role === "admin" || ctx.role === "commissioner" ? "/review" : ctx.role === "participant" ? "/my-trip" : "/game-centre";
}

export async function requireCommissioner(): Promise<LeagueContext> {
  const ctx = await getLeagueContext();
  if (!ctx.isCommissioner) redirect(homeFor(ctx));
  return ctx;
}

export async function requireAdmin(): Promise<LeagueContext> {
  const ctx = await getLeagueContext();
  if (!ctx.isAdmin) redirect(homeFor(ctx));
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
