"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getLeagueContext } from "@/lib/league";
import { METRICS, slipToValues, validatePrediction, type PredictionRules } from "@/lib/predictions";
import type { ActionResult } from "@/lib/actions/feed";

const int = z.number().int();
const schema = z.object({
  hours: int,
  minutes: int,
  mealRating: z.number(),
  finalScore: int,
  signHour: int,
  signMinute: int,
  flagCount: int,
  distanceKm: z.number(),
  speechMinutes: int,
  speechSeconds: int,
});

/** Saves or updates the member's prediction; the RPC enforces the server-side lock time. */
export async function savePrediction(input: z.input<typeof schema>): Promise<ActionResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Use whole numbers (one decimal for the rating, two for the distance)." };
  const invalid = validatePrediction(parsed.data);
  if (invalid) return { ok: false, message: invalid };
  const v = slipToValues(parsed.data);
  const ctx = await getLeagueContext();
  const { error } = await ctx.supabase.rpc("upsert_prediction", {
    p_event: ctx.event.id,
    p_run_seconds: v.run_seconds ?? 0,
    p_meal_rating: v.meal_rating ?? 0,
    p_final_score: v.final_score ?? 0,
    p_sign_photo_minutes: v.sign_photo_minutes ?? 0,
    p_flag_count: v.flag_count ?? 0,
    p_run_distance_km: v.run_distance_km ?? 0,
    p_speech_seconds: v.speech_seconds ?? 0,
  });
  if (error) return { ok: false, message: error.message.includes("locked") ? "Predictions locked when the bus reached Pofadder. No late slips." : error.message };
  revalidatePath("/predictions");
  return { ok: true, message: "Prediction saved. Editable until the bus reaches Pofadder." };
}

const rulesSchema = z.object(Object.fromEntries(METRICS.map((m) => [`${m.key}_points`, z.number().int().min(0).max(100)])) as Record<keyof PredictionRules, z.ZodNumber>);

export async function updatePredictionRules(input: PredictionRules): Promise<ActionResult> {
  const parsed = rulesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Points must be whole numbers between 0 and 100." };
  const ctx = await getLeagueContext();
  if (!ctx.isAdmin) return { ok: false, message: "Admin role required." };
  if (Date.now() >= Date.parse(ctx.event.prediction_lock_at)) return { ok: false, message: "Rules are frozen once predictions lock." };
  const { error } = await ctx.supabase.from("prediction_rules").upsert({ event_id: ctx.event.id, ...parsed.data, complaints_points: 0, updated_at: new Date().toISOString() }, { onConflict: "event_id" });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/predictions");
  return { ok: true, message: "Rules updated." };
}
