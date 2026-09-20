"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getLeagueContext } from "@/lib/league";
import { validatePrediction } from "@/lib/predictions";
import type { ActionResult } from "@/lib/actions/feed";

const schema = z.object({ hours: z.number().int(), minutes: z.number().int(), mealRating: z.number().int() });

/** Saves or updates the member's prediction; the RPC enforces the server-side lock time. */
export async function savePrediction(input: z.input<typeof schema>): Promise<ActionResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Use whole numbers." };
  const invalid = validatePrediction(parsed.data);
  if (invalid) return { ok: false, message: invalid };
  const ctx = await getLeagueContext();
  const { error } = await ctx.supabase.rpc("upsert_prediction", {
    p_event: ctx.event.id,
    p_run_seconds: parsed.data.hours * 3600 + parsed.data.minutes * 60,
    p_meal_rating: parsed.data.mealRating,
  });
  if (error) return { ok: false, message: error.message.includes("locked") ? "Predictions locked at departure. No late slips." : error.message };
  revalidatePath("/predictions");
  return { ok: true, message: "Prediction saved. Editable until departure." };
}

export async function updatePredictionRules(input: { runPoints: number; mealPoints: number }): Promise<ActionResult> {
  const parsed = z.object({ runPoints: z.number().int().min(0).max(100), mealPoints: z.number().int().min(0).max(100) }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Points must be whole numbers between 0 and 100." };
  const ctx = await getLeagueContext();
  if (!ctx.isAdmin) return { ok: false, message: "Admin role required." };
  if (Date.now() >= Date.parse(ctx.event.prediction_lock_at)) return { ok: false, message: "Rules are frozen once predictions lock." };
  const { error } = await ctx.supabase.from("prediction_rules").upsert({ event_id: ctx.event.id, run_points: parsed.data.runPoints, meal_points: parsed.data.mealPoints, complaints_points: 0, updated_at: new Date().toISOString() }, { onConflict: "event_id" });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/predictions");
  return { ok: true, message: "Rules updated." };
}
