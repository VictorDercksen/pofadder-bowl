"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getLeagueContext } from "@/lib/league";
import { isRevealed } from "@/lib/predictions";
import { isRating } from "@/lib/rating";
import { formatDateTime } from "@/lib/time";
import type { ActionResult } from "@/lib/actions/feed";

function revalidateReview() {
  for (const p of ["/review", "/proof", "/press", "/game-centre", "/my-trip", "/recap", "/predictions", "/props"]) revalidatePath(p);
}

const decisionSchema = z.object({
  submissionId: z.string().uuid(),
  version: z.number().int().positive(),
  decision: z.enum(["approved", "flagged", "superseded"]),
  idempotencyKey: z.string().min(8).max(120),
  reason: z.string().max(500).optional(),
  note: z.string().max(2000).optional(),
});

/**
 * Commissioner decision. The RPC is transactional and idempotent: a retried call with
 * the same key returns the original decision; a stale version is rejected.
 */
export async function reviewSubmission(input: z.input<typeof decisionSchema>): Promise<ActionResult & { decisionId?: string }> {
  const parsed = decisionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid review request." };
  if (parsed.data.decision === "flagged" && !parsed.data.reason?.trim()) return { ok: false, message: "A flag needs a reason so Victor knows what to fix." };
  const ctx = await getLeagueContext();
  if (!ctx.isCommissioner) return { ok: false, message: "Commissioner role required." };
  const { data, error } = await ctx.supabase.rpc("review_submission", {
    p_submission: parsed.data.submissionId,
    p_version: parsed.data.version,
    p_decision: parsed.data.decision,
    p_idempotency_key: parsed.data.idempotencyKey,
    p_reason: parsed.data.reason,
    p_note: parsed.data.note,
  });
  if (error) {
    if (error.code === "40001") return { ok: false, message: "This submission changed while you were reviewing. Reload and review the latest version." };
    return { ok: false, message: error.message };
  }
  revalidateReview();
  return { ok: true, decisionId: data?.id, message: parsed.data.decision === "approved" ? "Approved. The score is derived from approved challenges." : parsed.data.decision === "flagged" ? "Flagged with your reason." : "Marked superseded." };
}

export async function setPenalty(input: { penaltyId: string; applied: boolean; note?: string }): Promise<ActionResult> {
  const parsed = z.object({ penaltyId: z.string().uuid(), applied: z.boolean(), note: z.string().max(500).optional() }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid penalty request." };
  const ctx = await getLeagueContext();
  if (!ctx.isCommissioner) return { ok: false, message: "Commissioner role required." };
  const { error } = await ctx.supabase.rpc("set_penalty", { p_penalty: parsed.data.penaltyId, p_applied: parsed.data.applied, p_note: parsed.data.note });
  if (error) return { ok: false, message: error.message };
  revalidateReview();
  return { ok: true, message: parsed.data.applied ? "Penalty applied." : "Penalty cleared." };
}

const resultsSchema = z.object({
  runSeconds: z.number().int().min(0).max(8 * 3600).nullable(),
  runDistanceKm: z.number().min(0).max(100).nullable(),
  mealRating: z.number().refine(isRating).nullable(),
  finalScore: z.number().int().min(0).max(100).nullable(),
  signPhotoMinutes: z.number().int().min(0).max(1439).nullable(),
  flagCount: z.number().int().min(0).max(99).nullable(),
  speechSeconds: z.number().int().min(0).max(3600).nullable(),
});

export async function saveOfficialResults(input: z.input<typeof resultsSchema>): Promise<ActionResult> {
  const parsed = resultsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Check the result values." };
  const ctx = await getLeagueContext();
  if (!ctx.isCommissioner) return { ok: false, message: "Commissioner role required." };
  const { error } = await ctx.supabase.from("official_results").upsert(
    { event_id: ctx.event.id, run_seconds: parsed.data.runSeconds, run_distance_km: parsed.data.runDistanceKm, meal_rating: parsed.data.mealRating, complaint_count: null, final_score: parsed.data.finalScore, sign_photo_minutes: parsed.data.signPhotoMinutes, flag_count: parsed.data.flagCount, speech_seconds: parsed.data.speechSeconds, set_by: ctx.user.id, set_at: new Date().toISOString() },
    { onConflict: "event_id" },
  );
  if (error) return { ok: false, message: error.message };
  revalidateReview();
  return { ok: true, message: "Official results saved." };
}

export async function resolvePredictions(): Promise<ActionResult> {
  const ctx = await getLeagueContext();
  if (!ctx.isCommissioner) return { ok: false, message: "Commissioner role required." };
  if (!isRevealed(ctx.event.prediction_reveal_at)) return { ok: false, message: `Predictions resolve once the bus is back in Malmesbury (${formatDateTime(ctx.event.prediction_reveal_at, ctx.event.timezone)}).` };
  const { data, error } = await ctx.supabase.rpc("resolve_predictions", { p_event: ctx.event.id });
  if (error) return { ok: false, message: error.message.includes("Malmesbury") ? "Predictions resolve once the bus is back in Malmesbury." : error.message };
  revalidateReview();
  return { ok: true, message: `${data ?? 0} prediction award(s) recorded.` };
}

export async function issueCertificate(input: { isPublic: boolean }): Promise<ActionResult> {
  const ctx = await getLeagueContext();
  if (!ctx.isCommissioner) return { ok: false, message: "Commissioner role required." };
  const { error } = await ctx.supabase.rpc("issue_certificate", { p_event: ctx.event.id, p_is_public: Boolean(input.isPublic) });
  if (error) return { ok: false, message: error.message };
  revalidateReview();
  return { ok: true, message: "Certificate issued from the current approved state." };
}
