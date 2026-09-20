import { describe, expect, it } from "vitest";
import { isLocked, resolvePredictions, validatePrediction } from "./predictions";

describe("prediction resolution", () => {
  const preds = [
    { user_id: "a", run_seconds: 5400, meal_rating: 8 },
    { user_id: "b", run_seconds: 6000, meal_rating: 7 },
    { user_id: "c", run_seconds: 5700, meal_rating: 8 },
  ];
  it("awards closest run and exact rib rating", () => {
    const awards = resolvePredictions(preds, { run_seconds: 5690, meal_rating: 8 });
    expect(awards).toEqual([
      { user_id: "c", category: "run", points: 10 },
      { user_id: "a", category: "meal", points: 5 },
      { user_id: "c", category: "meal", points: 5 },
    ]);
  });
  it("ties share the points", () => {
    const awards = resolvePredictions(preds, { run_seconds: 5850, meal_rating: 1 });
    expect(awards.filter((a) => a.category === "run").map((a) => a.user_id)).toEqual(["b", "c"]);
    expect(awards.filter((a) => a.category === "meal")).toHaveLength(0);
  });
  it("skips categories with no official result", () => {
    const awards = resolvePredictions(preds, { run_seconds: null, meal_rating: 7 });
    expect(awards).toEqual([{ user_id: "b", category: "meal", points: 5 }]);
  });
  it("respects configurable rules", () => {
    const awards = resolvePredictions(preds, { run_seconds: 5400, meal_rating: null }, { run_points: 20, meal_points: 0 });
    expect(awards).toEqual([{ user_id: "a", category: "run", points: 20 }]);
  });
  it("never awards a complaints category", () => {
    const awards = resolvePredictions(preds, { run_seconds: 5400, meal_rating: 8 });
    expect(awards.map((a) => a.category)).not.toContain("complaints");
  });
});

describe("prediction locking", () => {
  it("locks at the exact configured departure instant", () => {
    const lock = "2026-09-23T17:15:00.000Z"; // 19:15 SAST
    expect(isLocked(lock, new Date("2026-09-23T17:14:59.000Z"))).toBe(false);
    expect(isLocked(lock, new Date("2026-09-23T17:15:00.000Z"))).toBe(true);
  });
  it("validates slip values", () => {
    expect(validatePrediction({ hours: 1, minutes: 35, mealRating: 8 })).toBeNull();
    expect(validatePrediction({ hours: 9, minutes: 0, mealRating: 8 })).toMatch(/hours/);
    expect(validatePrediction({ hours: 1, minutes: 60, mealRating: 8 })).toMatch(/minutes/);
    expect(validatePrediction({ hours: 1, minutes: 5, mealRating: 11 })).toMatch(/rating/);
    expect(validatePrediction({ hours: 1, minutes: 5, mealRating: null })).toMatch(/Pick a rib rating/);
    expect(validatePrediction({ hours: 0, minutes: 0, mealRating: 5 })).toMatch(/zero/);
  });
});

describe("prediction edge cases", () => {
  it("caps the finish time at the database limit of 8 hours", () => {
    expect(validatePrediction({ hours: 8, minutes: 0, mealRating: 5 })).toBeNull();
    expect(validatePrediction({ hours: 8, minutes: 1, mealRating: 5 })).toMatch(/8 hours/);
  });
  it("treats an unparseable lock instant as locked", () => {
    expect(isLocked("", new Date("2026-09-01T00:00:00Z"))).toBe(true);
  });
  it("ignores a corrupt row when finding the closest guess", () => {
    const preds = [
      { user_id: "a", run_seconds: Number.NaN, meal_rating: 8 },
      { user_id: "b", run_seconds: 6000, meal_rating: 7 },
    ];
    const awards = resolvePredictions(preds, { run_seconds: 5900, meal_rating: null });
    expect(awards).toEqual([{ user_id: "b", category: "run", points: 10 }]);
  });
});
