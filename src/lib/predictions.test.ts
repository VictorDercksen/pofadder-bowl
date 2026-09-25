import { describe, expect, it } from "vitest";
import { DEFAULT_RULES, formatMetric, isLocked, METRICS, resolvePredictions, slipToValues, validatePrediction, type Prediction, type SlipInput } from "./predictions";

const base = { final_score: null, sign_photo_minutes: null, flag_count: null, run_distance_km: null, speech_seconds: null };
const preds: Prediction[] = [
  { user_id: "a", run_seconds: 5400, meal_rating: 8, ...base },
  { user_id: "b", run_seconds: 6000, meal_rating: 7, ...base },
  { user_id: "c", run_seconds: 5700, meal_rating: 8, ...base },
];
const none = { run_seconds: null, meal_rating: null, ...base };
const slip: SlipInput = { hours: 1, minutes: 35, mealRating: 8, finalScore: 85, signHour: 9, signMinute: 40, flagCount: 1, distanceKm: 10.31, speechMinutes: 1, speechSeconds: 45 };

describe("prediction resolution", () => {
  it("awards closest run and exact rib rating", () => {
    const awards = resolvePredictions(preds, { ...none, run_seconds: 5690, meal_rating: 8 });
    expect(awards).toEqual([
      { user_id: "c", category: "run", points: 10 },
      { user_id: "a", category: "meal", points: 5 },
      { user_id: "c", category: "meal", points: 5 },
    ]);
  });
  it("ties share the points", () => {
    const awards = resolvePredictions(preds, { ...none, run_seconds: 5850, meal_rating: 1 });
    expect(awards.filter((a) => a.category === "run").map((a) => a.user_id)).toEqual(["b", "c"]);
    expect(awards.filter((a) => a.category === "meal")).toHaveLength(0);
  });
  it("skips categories with no official result", () => {
    const awards = resolvePredictions(preds, { ...none, meal_rating: 7 });
    expect(awards).toEqual([{ user_id: "b", category: "meal", points: 5 }]);
  });
  it("respects configurable rules", () => {
    const awards = resolvePredictions(preds, { ...none, run_seconds: 5400 }, { ...DEFAULT_RULES, run_points: 20 });
    expect(awards).toEqual([{ user_id: "a", category: "run", points: 20 }]);
  });
  it("scores the five new calls: closest score, sign time, distance and speech, exact flags", () => {
    const full: Prediction[] = [
      { user_id: "a", run_seconds: 5400, meal_rating: 8, final_score: 70, sign_photo_minutes: 560, flag_count: 1, run_distance_km: 10.2, speech_seconds: 90 },
      { user_id: "b", run_seconds: 6000, meal_rating: 7, final_score: 90, sign_photo_minutes: 600, flag_count: 2, run_distance_km: 10.6, speech_seconds: 150 },
    ];
    const awards = resolvePredictions(full, { run_seconds: null, meal_rating: null, final_score: 85, sign_photo_minutes: 575, flag_count: 2, run_distance_km: 10.35, speech_seconds: 121 });
    expect(awards).toEqual([
      { user_id: "b", category: "final_score", points: 5 },
      { user_id: "a", category: "sign_photo", points: 5 },
      { user_id: "b", category: "flags", points: 5 },
      { user_id: "a", category: "distance", points: 5 },
      { user_id: "b", category: "speech", points: 5 },
    ]);
  });
  it("a slip that skipped a call does not compete in it", () => {
    const mixed: Prediction[] = [
      { user_id: "old", run_seconds: 5400, meal_rating: 8, ...base },
      { user_id: "new", run_seconds: 5400, meal_rating: 8, final_score: 40, sign_photo_minutes: 0, flag_count: 0, run_distance_km: 9, speech_seconds: 10 },
    ];
    const awards = resolvePredictions(mixed, { ...none, final_score: 99, flag_count: 3 });
    expect(awards).toEqual([{ user_id: "new", category: "final_score", points: 5 }]);
  });
  it("covers every metric with a rules entry", () => {
    for (const m of METRICS) expect(DEFAULT_RULES[`${m.key}_points`]).toBeTypeOf("number");
  });
});

describe("prediction locking", () => {
  it("locks at the exact configured instant (Pofadder arrival)", () => {
    const lock = "2026-09-24T02:45:00.000Z"; // 04:45 SAST
    expect(isLocked(lock, new Date("2026-09-24T02:44:59.000Z"))).toBe(false);
    expect(isLocked(lock, new Date("2026-09-24T02:45:00.000Z"))).toBe(true);
  });
  it("validates slip values", () => {
    expect(validatePrediction(slip)).toBeNull();
    expect(validatePrediction({ ...slip, hours: 9 })).toMatch(/hours/);
    expect(validatePrediction({ ...slip, minutes: 60 })).toMatch(/minutes/);
    expect(validatePrediction({ ...slip, mealRating: 11 })).toMatch(/rating/);
    expect(validatePrediction({ ...slip, mealRating: null })).toMatch(/Pick a rib rating/);
    expect(validatePrediction({ ...slip, hours: 0, minutes: 0 })).toMatch(/zero/);
    expect(validatePrediction({ ...slip, finalScore: 101 })).toMatch(/Final score/);
    expect(validatePrediction({ ...slip, signHour: 24 })).toMatch(/clock time/);
    expect(validatePrediction({ ...slip, flagCount: -1 })).toMatch(/Flag count/);
    expect(validatePrediction({ ...slip, distanceKm: 10.123 })).toMatch(/two decimals/);
    expect(validatePrediction({ ...slip, speechSeconds: 60 })).toMatch(/minutes and seconds/);
    expect(validatePrediction({ ...slip, speechMinutes: 61 })).toMatch(/under an hour/);
  });
  it("turns the slip into the row the RPC takes", () => {
    expect(slipToValues(slip)).toEqual({ run_seconds: 5700, meal_rating: 8, final_score: 85, sign_photo_minutes: 580, flag_count: 1, run_distance_km: 10.31, speech_seconds: 105 });
  });
});

describe("prediction edge cases", () => {
  it("caps the finish time at the database limit of 8 hours", () => {
    expect(validatePrediction({ ...slip, hours: 8, minutes: 0 })).toBeNull();
    expect(validatePrediction({ ...slip, hours: 8, minutes: 1 })).toMatch(/8 hours/);
  });
  it("treats an unparseable lock instant as locked", () => {
    expect(isLocked("", new Date("2026-09-01T00:00:00Z"))).toBe(true);
  });
  it("ignores a corrupt row when finding the closest guess", () => {
    const corrupt: Prediction[] = [
      { user_id: "a", run_seconds: Number.NaN, meal_rating: 8, ...base },
      { user_id: "b", run_seconds: 6000, meal_rating: 7, ...base },
    ];
    const awards = resolvePredictions(corrupt, { ...none, run_seconds: 5900 });
    expect(awards).toEqual([{ user_id: "b", category: "run", points: 10 }]);
  });
});

describe("metric formatting", () => {
  it("prints each call in its own unit", () => {
    expect(formatMetric("run", 5700)).toBe("1:35:00");
    expect(formatMetric("meal", 8)).toBe("8 / 10");
    expect(formatMetric("final_score", 85)).toBe("85 / 100");
    expect(formatMetric("sign_photo", 580)).toBe("09:40");
    expect(formatMetric("flags", 1)).toBe("1 flag");
    expect(formatMetric("distance", 10.3)).toBe("10.30 km");
    expect(formatMetric("speech", 105)).toBe("1:45");
    expect(formatMetric("speech", null)).toBe("—");
  });
});
