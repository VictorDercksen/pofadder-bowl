/**
 * Out-of-ten ratings with one decimal place (1.0 .. 10.0). Matches the numeric(3,1) columns
 * evidence_submissions.rating, predictions.meal_rating and official_results.meal_rating.
 */
export const RATING_MIN = 1;
export const RATING_MAX = 10;

/** Rounds to one decimal, clearing float noise such as 7.1999999. */
export function roundRating(value: number): number {
  return Math.round(value * 10) / 10;
}

/** True for 1.0 .. 10.0 in steps of 0.1. */
export function isRating(value: unknown): value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) return false;
  if (value < RATING_MIN || value > RATING_MAX) return false;
  return Math.abs(value * 10 - Math.round(value * 10)) < 1e-9;
}

/** "8" for a whole score, "7.5" otherwise. */
export function formatRating(value: number): string {
  const r = roundRating(value);
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

/** Whole part and tenths digit: 7.5 → { whole: 7, tenth: 5 }. */
export function splitRating(value: number): { whole: number; tenth: number } {
  const tenths = Math.round(value * 10);
  return { whole: Math.floor(tenths / 10), tenth: tenths % 10 };
}

/** Joins a whole number and a tenths digit, clamped to the scale (10 takes no decimal). */
export function composeRating(whole: number, tenth: number): number {
  const w = Math.min(RATING_MAX, Math.max(RATING_MIN, Math.trunc(whole)));
  const t = w >= RATING_MAX ? 0 : Math.min(9, Math.max(0, Math.trunc(tenth)));
  return roundRating(w + t / 10);
}
