"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getLeagueContext } from "@/lib/league";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicEnv, sleeperLeagueId } from "@/lib/env";
import { fetchSleeperLeagueUsers } from "@/lib/sleeper";
import type { ActionResult } from "@/lib/actions/feed";

/**
 * Invite a league member by email. Uses the service-role admin API (server only) to
 * create/invite the auth user, then creates an 'invited' membership row. Only an active
 * admin can call this; the membership becomes active on the invitee's first sign-in.
 */
export async function inviteMember(input: { email: string; displayName?: string; role: "member" | "participant"; isCommissioner: boolean }): Promise<ActionResult> {
  const parsed = z.object({ email: z.string().trim().email().max(200), displayName: z.string().trim().max(40).optional(), role: z.enum(["member", "participant"]), isCommissioner: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Enter a valid email address." };
  const ctx = await getLeagueContext();
  if (!ctx.isAdmin) return { ok: false, message: "Admin role required." };

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, message: "Invites need SUPABASE_SECRET_KEY on the server. Add it to the deployment environment." };
  }
  const email = parsed.data.email.toLowerCase();
  const redirectTo = `${publicEnv.appOrigin}/auth/confirm?next=/home`;
  let userId: string | undefined;
  const invite = await admin.auth.admin.inviteUserByEmail(email, { redirectTo, data: parsed.data.displayName ? { display_name: parsed.data.displayName } : undefined });
  if (invite.error) {
    // Already registered: look the user up and (re)create the membership; send a magic link instead.
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
    userId = list?.users.find((u) => u.email?.toLowerCase() === email)?.id;
    if (!userId) return { ok: false, message: `Invite failed: ${invite.error.message}` };
    await admin.auth.admin.generateLink({ type: "magiclink", email, options: { redirectTo } }).catch(() => null);
  } else userId = invite.data.user?.id;
  if (!userId) return { ok: false, message: "Invite failed." };

  // Never overwrite an existing membership (re-inviting must not demote or deactivate anyone).
  const { data: existing } = await admin.from("memberships").select("id, status").eq("league_id", ctx.league.id).eq("user_id", userId).maybeSingle();
  if (!existing) {
    const { error } = await admin.from("memberships").insert({ league_id: ctx.league.id, user_id: userId, role: parsed.data.role, is_commissioner: parsed.data.isCommissioner, status: "invited", invited_email: email, invited_by: ctx.user.id });
    if (error) return { ok: false, message: `Membership could not be created: ${error.message}` };
  }
  revalidatePath("/review/members");
  if (existing) return { ok: true, message: `${email} already has a membership (${existing.status}); a sign-in link was sent and roles were left unchanged.` };
  return { ok: true, message: invite.error ? `${email} already had an account; membership created and a sign-in link sent.` : `Invitation emailed to ${email}.` };
}

export async function setMemberRole(input: { userId: string; role: "member" | "participant"; isCommissioner: boolean; isAdmin?: boolean; status: "invited" | "active" | "removed" }): Promise<ActionResult> {
  const parsed = z.object({ userId: z.string().uuid(), role: z.enum(["member", "participant"]), isCommissioner: z.boolean(), isAdmin: z.boolean().optional(), status: z.enum(["invited", "active", "removed"]) }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid member update." };
  const ctx = await getLeagueContext();
  if (!ctx.isAdmin) return { ok: false, message: "Admin role required." };
  const { error } = await ctx.supabase.rpc("set_member_role", { p_league: ctx.league.id, p_user: parsed.data.userId, p_role: parsed.data.role, p_is_commissioner: parsed.data.isCommissioner, p_status: parsed.data.status, p_is_admin: parsed.data.isAdmin });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/review/members");
  revalidatePath("/", "layout");
  return { ok: true, message: "Membership updated." };
}

export async function setEventParticipant(input: { userId: string | null }): Promise<ActionResult> {
  const parsed = z.object({ userId: z.string().uuid().nullable() }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid user." };
  const ctx = await getLeagueContext();
  if (!ctx.isAdmin) return { ok: false, message: "Admin role required." };
  const { error } = await ctx.supabase.rpc("set_event_participant", { p_event: ctx.event.id, p_user: parsed.data.userId ?? undefined });
  if (error) return { ok: false, message: error.message.includes("active participant") ? "Set that member’s role to participant (and active) first." : error.message };
  revalidatePath("/review/members");
  revalidatePath("/", "layout");
  return { ok: true, message: "Event participant updated." };
}

export async function importSleeperLeague(): Promise<ActionResult> {
  const ctx = await getLeagueContext();
  if (!ctx.isAdmin) return { ok: false, message: "Admin role required." };
  const leagueId = ctx.league.sleeper_league_id ?? sleeperLeagueId();
  if (!leagueId) return { ok: false, message: "No Sleeper league id configured (SLEEPER_LEAGUE_ID)." };
  let users;
  try {
    users = await fetchSleeperLeagueUsers(leagueId);
  } catch (err) {
    return { ok: false, message: `Sleeper API error: ${(err as Error).message}` };
  }
  const rows = users.map((u) => ({ league_id: ctx.league.id, sleeper_user_id: u.user_id, username: u.username, display_name: u.display_name, team_name: u.team_name, avatar: u.avatar, is_owner: u.is_owner, season: u.season, imported_at: new Date().toISOString() }));
  const { error } = await ctx.supabase.from("sleeper_league_users").upsert(rows, { onConflict: "league_id,sleeper_user_id" });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/review/members");
  revalidatePath("/account");
  return { ok: true, message: `Imported ${rows.length} Sleeper managers.` };
}

export async function confirmSleeperLink(input: { userId: string; sleeperUserId: string | null; confirmed: boolean }): Promise<ActionResult> {
  const parsed = z.object({ userId: z.string().uuid(), sleeperUserId: z.string().regex(/^\d{5,30}$/).nullable(), confirmed: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid link." };
  const ctx = await getLeagueContext();
  if (!ctx.isAdmin) return { ok: false, message: "Admin role required." };
  const { error } = await ctx.supabase.rpc("confirm_sleeper_link", { p_league: ctx.league.id, p_user: parsed.data.userId, p_sleeper_user_id: parsed.data.sleeperUserId ?? undefined, p_confirmed: parsed.data.confirmed });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/review/members");
  revalidatePath("/account");
  return { ok: true, message: parsed.data.confirmed ? "Sleeper link confirmed." : "Sleeper link updated." };
}
