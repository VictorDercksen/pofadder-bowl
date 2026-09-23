/**
 * Prediction scoring rules (mirrors public.resolve_predictions()).
 * Seven calls on the slip. Closest wins the numeric ones, exact match wins the rib rating and
 * the flag count; ties share the points. A slip that skipped a call does not compete in it.
 * No money, no wagering: bragging rights only.
 */

import { minutesToClock, secondsToClock } from "@/lib/time";

export type MetricKey = "run" | "meal" | "final_score" | "sign_photo" | "flags" | "distance" | "speech";

export type PredictionRules = Record<`${MetricKey}_points`, number>;
export const DEFAULT_RULES: PredictionRules = { run_points: 10, meal_points: 5, final_score_points: 5, sign_photo_points: 5, flags_points: 5, distance_points: 5, speech_points: 5 };

/** One row of the slip and of the official results: the same column names on both tables. */
export type PredictionValues = {
  run_seconds: number | null;
  meal_rating: number | null;
  final_score: number | null;
  sign_photo_minutes: number | null;
  flag_count: number | null;
  run_distance_km: number | null;
  speech_seconds: number | null;
};
export type Prediction = { user_id: string } & PredictionValues;
export type OfficialResult = PredictionValues;
export type Award = { user_id: string; category: MetricKey; points: number };

export type Metric = {
  key: MetricKey;
  column: keyof PredictionValues;
  mode: "closest" | "exact";
  /** Short heading on the slip and the rules card. */
  label: string;
  /** How it is settled, for the rules card. */
  blurb: string;
};

export const METRICS: readonly Metric[] = [
  { key: "run", column: "run_seconds", mode: "closest", label: "Closest 10 km finish time", blurb: "Measured against the approved watch export." },
  { key: "meal", column: "meal_rating", mode: "exact", label: "Exact rib rating", blurb: "The score Victor gives the chicken and rib combo when he submits the proof. His verdict is final." },
  { key: "final_score", column: "final_score", mode: "closest", label: "Closest final score", blurb: "Victor’s punishment score out of 100 when the certificate is issued." },
  { key: "sign_photo", column: "sign_photo_minutes", mode: "closest", label: "Closest daylight sign time", blurb: "The clock time (SAST) the daylight welcome-sign photo is submitted." },
  { key: "flags", column: "flag_count", mode: "exact", label: "Exact flag count", blurb: "Versions the commissioner sends back over the whole trip." },
  { key: "distance", column: "run_distance_km", mode: "closest", label: "Closest run distance", blurb: "Kilometres on the approved GPS trace, to two decimals." },
  { key: "speech", column: "speech_seconds", mode: "closest", label: "Closest speech length", blurb: "First word to last on the approved sunset clip." },
];

export function resolvePredictions(predictions: Prediction[], result: OfficialResult, rules: PredictionRules = DEFAULT_RULES): Award[] {
  const awards: Award[] = [];
  if (predictions.length === 0) return awards;
  for (const metric of METRICS) {
    const target = result[metric.column];
    if (target == null) continue;
    const points = rules[`${metric.key}_points`];
    const entered = predictions.filter((p) => p[metric.column] != null);
    if (metric.mode === "exact") {
      for (const p of entered) if (p[metric.column] === target) awards.push({ user_id: p.user_id, category: metric.key, points });
      continue;
    }
    const best = closest(entered.map((p) => Math.abs((p[metric.column] as number) - target)));
    for (const p of entered) if (Math.abs((p[metric.column] as number) - target) === best) awards.push({ user_id: p.user_id, category: metric.key, points });
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

/**
 * Other members' slips become visible, and the slips can be resolved, once the bus is back in
 * Malmesbury (events.prediction_reveal_at = home_arrival_at). Fails closed: an unparseable reveal
 * instant reads as still hidden (RLS and resolve_predictions enforce the real reveal).
 */
export function isRevealed(revealAtIso: string, now: Date = new Date()): boolean {
  const reveal = Date.parse(revealAtIso);
  return Number.isFinite(reveal) && now.getTime() >= reveal;
}

/** Matches the predictions.run_seconds check constraint (0 .. 8 h). */
export const MAX_RUN_SECONDS = 8 * 3600;

/** What the slip form holds before it becomes a row: clock parts rather than seconds and minutes. */
export type SlipInput = {
  hours: number;
  minutes: number;
  mealRating: number | null;
  finalScore: number;
  signHour: number;
  signMinute: number;
  flagCount: number;
  distanceKm: number;
  speechMinutes: number;
  speechSeconds: number;
};

export function validatePrediction(input: SlipInput): string | null {
  const { hours, minutes, mealRating, finalScore, signHour, signMinute, flagCount, distanceKm, speechMinutes, speechSeconds } = input;
  if (!Number.isInteger(hours) || hours < 0 || hours > 8) return "Use whole hours between 0 and 8.";
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 59) return "Use whole minutes between 0 and 59.";
  if (mealRating == null) return "Pick a rib rating out of ten.";
  if (!Number.isInteger(mealRating) || mealRating < 1 || mealRating > 10) return "Rib rating must be 1 to 10.";
  if (hours === 0 && minutes === 0) return "A finish time of zero is optimistic even for Victor.";
  if (hours * 3600 + minutes * 60 > MAX_RUN_SECONDS) return "Keep the finish time at 8 hours or under.";
  if (!Number.isInteger(finalScore) || finalScore < 0 || finalScore > 100) return "Final score must be a whole number from 0 to 100.";
  if (!Number.isInteger(signHour) || signHour < 0 || signHour > 23 || !Number.isInteger(signMinute) || signMinute < 0 || signMinute > 59) return "Give the sign photo a clock time (00:00 to 23:59).";
  if (!Number.isInteger(flagCount) || flagCount < 0 || flagCount > 99) return "Flag count must be a whole number from 0 to 99.";
  if (!Number.isFinite(distanceKm) || distanceKm < 0 || distanceKm > 100) return "Run distance must be between 0 and 100 km.";
  if (Math.round(distanceKm * 100) !== distanceKm * 100) return "Run distance takes two decimals at most.";
  if (!Number.isInteger(speechMinutes) || speechMinutes < 0 || !Number.isInteger(speechSeconds) || speechSeconds < 0 || speechSeconds > 59) return "Give the speech length in minutes and seconds.";
  if (speechMinutes * 60 + speechSeconds > 3600) return "Keep the speech under an hour. Nobody is that sorry.";
  return null;
}

/** The row the RPC takes from a validated slip. */
export function slipToValues(input: SlipInput): PredictionValues {
  return {
    run_seconds: input.hours * 3600 + input.minutes * 60,
    meal_rating: input.mealRating,
    final_score: input.finalScore,
    sign_photo_minutes: input.signHour * 60 + input.signMinute,
    flag_count: input.flagCount,
    run_distance_km: input.distanceKm,
    speech_seconds: input.speechMinutes * 60 + input.speechSeconds,
  };
}

/** A call printed for the reveal table and the official results line. */
export function formatMetric(key: MetricKey, value: number | null | undefined): string {
  if (value == null) return "—";
  switch (key) {
    case "run":
      return secondsToClock(value);
    case "meal":
      return `${value} / 10`;
    case "final_score":
      return `${value} / 100`;
    case "sign_photo":
      return minutesToClock(value);
    case "flags":
      return `${value} flag${value === 1 ? "" : "s"}`;
    case "distance":
      return `${Number(value).toFixed(2)} km`;
    case "speech":
      return secondsToClock(value);
  }
}

/** Short column label for the reveal table. */
export const METRIC_SHORT: Record<MetricKey, string> = { run: "Run", meal: "Ribs", final_score: "Score", sign_photo: "Sign", flags: "Flags", distance: "Trace", speech: "Speech" };
