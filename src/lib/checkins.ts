import "server-only";
import type { LeagueContext } from "@/lib/league";
import type { Tables } from "@/lib/database.types";
import type { MemberLocation } from "@/lib/member-locations";

export type Checkin = Tables<"checkins">;

export async function loadCheckins(ctx: LeagueContext, limit = 50): Promise<Checkin[]> {
  const participant = ctx.event.participant_user_id;
  if (!participant) return [];
  const { data } = await ctx.supabase
    .from("checkins")
    .select("*")
    .eq("event_id", ctx.event.id)
    .eq("user_id", participant)
    .is("removed_at", null)
    .order("captured_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function loadLocationSettings(ctx: LeagueContext) {
  const { data } = await ctx.supabase.from("location_settings").select("*").eq("event_id", ctx.event.id).eq("user_id", ctx.user.id).maybeSingle();
  return { sharing_enabled: data?.sharing_enabled ?? false, auto_update: data?.auto_update ?? true };
}

export async function participantName(ctx: LeagueContext): Promise<string> {
  if (!ctx.event.participant_user_id) return "Participant";
  const { data } = await ctx.supabase.from("profiles").select("display_name").eq("id", ctx.event.participant_user_id).maybeSingle();
  return data?.display_name ?? "Participant";
}

/** Every member pin of the event (latest shared position per member), newest first. Empty until the member-locations migration is applied. */
export async function loadMemberLocations(ctx: LeagueContext): Promise<MemberLocation[]> {
  const { data, error } = await ctx.supabase.rpc("event_member_locations", { p_event: ctx.event.id });
  if (error) return [];
  return data ?? [];
}

/** The viewer's own pin, or null when they have not shared one. */
export function ownMemberLocation(ctx: LeagueContext, rows: MemberLocation[]): MemberLocation | null {
  return rows.find((r) => r.user_id === ctx.user.id) ?? null;
}
