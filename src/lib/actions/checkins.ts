"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getLeagueContext } from "@/lib/league";
import type { ActionResult } from "@/lib/actions/feed";

const checkinSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(100_000).nullable(),
  capturedAt: z.iso.datetime(),
  clientId: z.string().min(8).max(80),
});

/** Participant-only. The RPC re-checks role, consent and de-duplicates by client id. */
/** `duplicate` is set when the client id was already recorded (same GPS fix sent twice): nothing new was written. */
/** `placeLabel` is the gazetteer label stored on the row ("10 km N of Malmesbury"); null outside its reach. */
export type CheckinResult = ActionResult & { id?: string; duplicate?: boolean; placeLabel?: string | null };

export async function recordCheckin(input: z.input<typeof checkinSchema>): Promise<CheckinResult> {
  const parsed = checkinSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid position payload." };
  const ctx = await getLeagueContext();
  if (!ctx.isParticipant) return { ok: false, message: "Only the participant can check in." };
  const { data, error } = await ctx.supabase.rpc("record_checkin", {
    p_event: ctx.event.id,
    p_latitude: parsed.data.latitude,
    p_longitude: parsed.data.longitude,
    p_accuracy_m: parsed.data.accuracy ?? undefined,
    p_captured_at: parsed.data.capturedAt,
    p_client_id: parsed.data.clientId,
  });
  if (error) {
    if (error.message.includes("paused")) return { ok: false, message: "Sharing is paused. Resume sharing before checking in." };
    if (error.message.includes("window")) return { ok: false, message: "The position's timestamp is outside the accepted window. Check the phone's clock and try again." };
    return { ok: false, message: "Check-in failed. Try again." };
  }
  // The RPC de-duplicates by client id and hands back the existing row for a replay.
  const duplicate = Boolean(data?.received_at) && Date.now() - Date.parse(data.received_at) > 10_000;
  if (duplicate) return { ok: true, duplicate: true, message: "Same GPS fix as the last check-in. Nothing new recorded; move or wait for a fresh fix.", id: data?.id, placeLabel: data?.place_label ?? null };
  revalidatePath("/map");
  revalidatePath("/game-centre");
  revalidatePath("/my-trip");
  revalidatePath("/recap");
  return { ok: true, message: data?.place_label ? `Check-in recorded · ${data.place_label}.` : "Check-in recorded.", id: data?.id, placeLabel: data?.place_label ?? null };
}

const settingsSchema = z.object({ sharingEnabled: z.boolean(), autoUpdate: z.boolean() });

export async function updateLocationSettings(input: z.input<typeof settingsSchema>): Promise<ActionResult> {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid settings." };
  const ctx = await getLeagueContext();
  if (!ctx.isParticipant) return { ok: false, message: "Only the participant has location settings." };
  const { error } = await ctx.supabase.from("location_settings").upsert(
    { event_id: ctx.event.id, user_id: ctx.user.id, sharing_enabled: parsed.data.sharingEnabled, auto_update: parsed.data.autoUpdate, updated_at: new Date().toISOString() },
    { onConflict: "event_id,user_id" },
  );
  if (error) return { ok: false, message: "Could not save location settings." };
  revalidatePath("/map");
  revalidatePath("/my-trip");
  return { ok: true, message: parsed.data.sharingEnabled ? "Sharing on. New check-ins will be visible to the league." : "Sharing paused. No new positions will be written. Existing timestamped check-ins stay visible until you remove them." };
}

export async function removeCheckins(input: { ids?: string[] }): Promise<ActionResult> {
  const ids = z.array(z.string().uuid()).max(500).optional().safeParse(input.ids);
  if (!ids.success) return { ok: false, message: "Invalid selection." };
  const ctx = await getLeagueContext();
  if (!ctx.isParticipant) return { ok: false, message: "Only the participant can remove check-ins." };
  const { data, error } = await ctx.supabase.rpc("remove_checkins", { p_event: ctx.event.id, p_ids: ids.data ?? undefined });
  if (error) return { ok: false, message: "Could not remove check-ins." };
  revalidatePath("/map");
  revalidatePath("/game-centre");
  revalidatePath("/my-trip");
  revalidatePath("/recap");
  return { ok: true, message: `${data ?? 0} check-in(s) removed from the league view.` };
}
