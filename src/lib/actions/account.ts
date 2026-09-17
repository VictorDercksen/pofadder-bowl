"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getLeagueContext, getLeagueContextRaw } from "@/lib/league";
import { KITS } from "@/lib/nfl";
import type { ActionResult } from "@/lib/actions/feed";

const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(40),
  kitNumber: z.number().int().min(0).max(99),
});

export async function updateProfile(input: z.input<typeof profileSchema>): Promise<ActionResult> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid profile." };
  const ctx = await getLeagueContext();
  const { error } = await ctx.supabase.from("profiles").update({ display_name: parsed.data.displayName, kit_number: parsed.data.kitNumber }).eq("id", ctx.user.id);
  if (error) return { ok: false, message: "Could not save your details." };
  revalidatePath("/", "layout");
  return { ok: true, message: "Saved. Your jersey cards now show it." };
}

const kitSchema = z.object({
  kitTeam: z.string().refine((c) => Object.hasOwn(KITS, c) && c !== "nfl", "Unknown franchise"),
  kitNumber: z.number().int().min(0).max(99),
});

/**
 * Claim a franchise. The database enforces that a franchise is worn by only one member
 * (unique index + locked RPC), so two members cannot pick the same team.
 */
export async function claimKit(input: z.input<typeof kitSchema>): Promise<ActionResult> {
  const parsed = kitSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Pick a franchise and a number." };
  const ctx = await getLeagueContextRaw();
  const { error } = await ctx.supabase.rpc("claim_kit", { p_team: parsed.data.kitTeam, p_number: parsed.data.kitNumber });
  if (error) return { ok: false, message: error.code === "23505" ? error.message.replace(/^.*?The /, "The") : error.message };
  revalidatePath("/", "layout");
  return { ok: true, message: "Kit claimed. This franchise is yours for the league." };
}

/**
 * Confirm which Sleeper manager this member is (picked from the imported league list at
 * sign-on or in League access). The database keeps a Sleeper team to one member.
 */
export async function claimSleeperIdentity(input: { sleeperUserId: string | null }): Promise<ActionResult> {
  const parsed = z.object({ sleeperUserId: z.string().regex(/^\d{5,30}$/).nullable() }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid Sleeper user." };
  const ctx = await getLeagueContextRaw();
  const { error } = await ctx.supabase.rpc("claim_sleeper_identity", { p_league: ctx.league.id, p_sleeper_user_id: parsed.data.sleeperUserId ?? undefined });
  if (error) return { ok: false, message: error.code === "23505" || error.code === "22023" ? error.message : "Could not save your Sleeper team." };
  revalidatePath("/", "layout");
  return { ok: true, message: parsed.data.sleeperUserId ? "Confirmed. Your Sleeper team now rides in the header." : "Sleeper link cleared." };
}

const passwordSchema = z.object({ password: z.string().min(8, "Use at least 8 characters.").max(200) });

/**
 * Set or change the account password. Every member must hold one (the /set-password gate in
 * getLeagueContext), so after the first email link nobody waits for another.
 * `user_metadata.has_password` mirrors the fact into the JWT for the pre-migration gate check;
 * the session is refreshed so the very next request carries the new claims.
 */
export async function setPassword(input: { password: string }): Promise<ActionResult> {
  const parsed = passwordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Use at least 8 characters." };
  const ctx = await getLeagueContextRaw();
  const { error } = await ctx.supabase.auth.updateUser({ password: parsed.data.password, data: { has_password: true } });
  if (error) {
    if (/weak|pwned|leaked|easy to guess/i.test(error.message)) return { ok: false, message: "That password is too easy to guess. Try a longer one." };
    if (/same password/i.test(error.message)) return { ok: false, message: "That is already your password." };
    return { ok: false, message: "Could not set the password. Sign in again with an email link and retry." };
  }
  // Reissue the access token so the has_password claim is visible before the hourly refresh.
  await ctx.supabase.auth.refreshSession().catch(() => undefined);
  revalidatePath("/", "layout");
  return { ok: true, message: "Password set. Next time, sign in with your email and password." };
}

export async function setCertificateConsent(input: { consent: boolean }): Promise<ActionResult> {
  const ctx = await getLeagueContext();
  if (!ctx.isParticipant) return { ok: false, message: "Participant only." };
  const { error } = await ctx.supabase.rpc("set_certificate_consent", { p_event: ctx.event.id, p_consent: Boolean(input.consent) });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/recap");
  return { ok: true, message: input.consent ? "Consent recorded." : "Consent withdrawn." };
}
