/**
 * Prediction scoring rules (mirrors public.resolve_predictions()).
 * Closest run time and exact rib rating; ties share the points.
 * No money, no wagering: bragging rights only.
 */

export type PredictionRules = { run_points: number; meal_points: number };
export const DEFAULT_RULES: PredictionRules = { run_points: 10, meal_points: 5 };

export type Prediction = { user_id: string; run_seconds: number; meal_rating: number };
export type OfficialResult = { run_seconds: number | null; meal_rating: number | null };
export type Award = { user_id: string; category: "run" | "meal"; points: number };

export function resolvePredictions(predictions: Prediction[], result: OfficialResult, rules: PredictionRules = DEFAULT_RULES): Award[] {
  const awards: Award[] = [];
  if (predictions.length === 0) return awards;

  if (result.run_seconds != null) {
    const target = result.run_seconds;
    const best = closest(predictions.map((p) => Math.abs(p.run_seconds - target)));
    for (const p of predictions) if (Math.abs(p.run_seconds - target) === best) awards.push({ user_id: p.user_id, category: "run", points: rules.run_points });
  }
  if (result.meal_rating != null) {
    for (const p of predictions) if (p.meal_rating === result.meal_rating) awards.push({ user_id: p.user_id, category: "meal", points: rules.meal_points });
  }
  return awards;
}

/** Smallest finite distance, so one corrupt row cannot turn every comparison into NaN. */
function closest(distances: number[]): number {
  const finite = distances.filter(Number.isFinite);
  return finite.length ? Math.min(...finite) : Number.NaN;
}

/** Fails closed: an unparseable lock instant reads as locked (the RPC enforces the real lock). */
export function isLocked(lockAtIso: string, now: Date = new Date()): boolean {
  const lock = Date.parse(lockAtIso);
  return !Number.isFinite(lock) || now.getTime() >= lock;
}

/** Matches the predictions.run_seconds check constraint (0 .. 8 h). */
export const MAX_RUN_SECONDS = 8 * 3600;

export function validatePrediction(input: { hours: number; minutes: number; mealRating: number | null }): string | null {
  const { hours, minutes, mealRating } = input;
  if (!Number.isInteger(hours) || hours < 0 || hours > 8) return "Use whole hours between 0 and 8.";
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 59) return "Use whole minutes between 0 and 59.";
  if (mealRating == null) return "Pick a rib rating out of ten.";
  if (!Number.isInteger(mealRating) || mealRating < 1 || mealRating > 10) return "Rib rating must be 1 to 10.";
  if (hours === 0 && minutes === 0) return "A finish time of zero is optimistic even for Victor.";
  if (hours * 3600 + minutes * 60 > MAX_RUN_SECONDS) return "Keep the finish time at 8 hours or under.";
  return null;
}
