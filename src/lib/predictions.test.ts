import { describe, expect, it } from "vitest";
import { isLocked, resolvePredictions, validatePrediction } from "./predictions";

describe("prediction resolution", () => {
  const preds = [
    { user_id: "a", run_seconds: 5400, meal_rating: 8, complaint_count: 12 },
    { user_id: "b", run_seconds: 6000, meal_rating: 7, complaint_count: 20 },
    { user_id: "c", run_seconds: 5700, meal_rating: 8, complaint_count: 16 },
  ];
  it("awards closest run, exact meal and closest complaints", () => {
    const awards = resolvePredictions(preds, { run_seconds: 5690, meal_rating: 8, complaint_count: 15 });
    expect(awards).toEqual([
      { user_id: "c", category: "run", points: 10 },
      { user_id: "a", category: "meal", points: 5 },
      { user_id: "c", category: "meal", points: 5 },
      { user_id: "c", category: "complaints", points: 5 },
    ]);
  });
  it("ties share the points", () => {
    const awards = resolvePredictions(preds, { run_seconds: 5850, meal_rating: 1, complaint_count: 16 });
    expect(awards.filter((a) => a.category === "run").map((a) => a.user_id)).toEqual(["b", "c"]);
    expect(awards.filter((a) => a.category === "meal")).toHaveLength(0);
  });
  it("skips categories with no official result", () => {
    const awards = resolvePredictions(preds, { run_seconds: null, meal_rating: null, complaint_count: 12 });
    expect(awards).toEqual([{ user_id: "a", category: "complaints", points: 5 }]);
  });
  it("respects configurable rules", () => {
    const awards = resolvePredictions(preds, { run_seconds: 5400, meal_rating: null, complaint_count: null }, { run_points: 20, meal_points: 0, complaints_points: 0 });
    expect(awards).toEqual([{ user_id: "a", category: "run", points: 20 }]);
  });
});

describe("prediction locking", () => {
  it("locks at the exact configured departure instant", () => {
    const lock = "2026-09-23T17:15:00.000Z"; // 19:15 SAST
    expect(isLocked(lock, new Date("2026-09-23T17:14:59.000Z"))).toBe(false);
    expect(isLocked(lock, new Date("2026-09-23T17:15:00.000Z"))).toBe(true);
  });
  it("validates slip values", () => {
    expect(validatePrediction({ hours: 1, minutes: 35, mealRating: 8, complaints: 12 })).toBeNull();
    expect(validatePrediction({ hours: 9, minutes: 0, mealRating: 8, complaints: 12 })).toMatch(/hours/);
    expect(validatePrediction({ hours: 1, minutes: 60, mealRating: 8, complaints: 12 })).toMatch(/minutes/);
    expect(validatePrediction({ hours: 1, minutes: 5, mealRating: 11, complaints: 12 })).toMatch(/rating/);
    expect(validatePrediction({ hours: 1, minutes: 5, mealRating: 5, complaints: 1000 })).toMatch(/Complaints/);
    expect(validatePrediction({ hours: 0, minutes: 0, mealRating: 5, complaints: 1 })).toMatch(/zero/);
  });
});
