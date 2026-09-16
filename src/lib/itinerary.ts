import "server-only";
import type { LeagueContext } from "@/lib/league";
import type { Tables } from "@/lib/database.types";

export type ItineraryItem = Tables<"itinerary_items">;
export type Challenge = Tables<"challenges">;

export async function loadItinerary(ctx: LeagueContext): Promise<ItineraryItem[]> {
  const { data } = await ctx.supabase.from("itinerary_items").select("*").eq("event_id", ctx.event.id).order("starts_at");
  return data ?? [];
}

export async function loadChallenges(ctx: LeagueContext): Promise<Challenge[]> {
  const { data } = await ctx.supabase.from("challenges").select("*").eq("event_id", ctx.event.id).order("sequence");
  return data ?? [];
}

/** Next itinerary item and the next challenge without an approved submission. */
export async function nextItinerary(ctx: LeagueContext, now: Date) {
  const [items, { data: scores }] = await Promise.all([loadItinerary(ctx), ctx.supabase.from("challenge_scores").select("*").eq("event_id", ctx.event.id).order("sequence")]);
  const item = items.find((i) => Date.parse(i.starts_at) >= now.getTime()) ?? null;
  const challenge = (scores ?? []).find((s) => !s.approved_submission_id) ?? null;
  return { item, challenge: challenge ? { id: challenge.challenge_id, title: challenge.title, points: challenge.points, sequence: challenge.sequence } : null };
}
