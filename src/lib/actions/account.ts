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
  kitTeam: z.string().refine((c) => c in KITS && c !== "nfl", "Unknown franchise"),
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

export async function claimSleeperIdentity(input: { sleeperUserId: string | null }): Promise<ActionResult> {
  const parsed = z.object({ sleeperUserId: z.string().regex(/^\d{5,30}$/).nullable() }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid Sleeper user." };
  const ctx = await getLeagueContext();
  const { error } = await ctx.supabase.rpc("claim_sleeper_identity", { p_league: ctx.league.id, p_sleeper_user_id: parsed.data.sleeperUserId ?? undefined });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/account");
  revalidatePath("/review/members");
  return { ok: true, message: parsed.data.sleeperUserId ? "Claimed. A commissioner will confirm the link." : "Sleeper link cleared." };
}

export async function setCertificateConsent(input: { consent: boolean }): Promise<ActionResult> {
  const ctx = await getLeagueContext();
  if (!ctx.isParticipant) return { ok: false, message: "Participant only." };
  const { error } = await ctx.supabase.rpc("set_certificate_consent", { p_event: ctx.event.id, p_consent: Boolean(input.consent) });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/recap");
  return { ok: true, message: input.consent ? "Consent recorded." : "Consent withdrawn." };
}
