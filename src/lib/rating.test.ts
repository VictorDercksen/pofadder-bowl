import { describe, expect, it } from "vitest";
import { composeRating, formatRating, isRating, roundRating, splitRating } from "@/lib/rating";

describe("rating", () => {
  it("accepts 1.0 to 10.0 in tenths", () => {
    expect(isRating(1)).toBe(true);
    expect(isRating(7.5)).toBe(true);
    expect(isRating(0.1 + 0.2 + 6.9)).toBe(true);
    expect(isRating(10)).toBe(true);
    expect(isRating(0.9)).toBe(false);
    expect(isRating(10.1)).toBe(false);
    expect(isRating(7.25)).toBe(false);
    expect(isRating(Number.NaN)).toBe(false);
    expect(isRating("8")).toBe(false);
  });

  it("formats whole scores without a decimal", () => {
    expect(formatRating(8)).toBe("8");
    expect(formatRating(7.5)).toBe("7.5");
    expect(formatRating(7.199999)).toBe("7.2");
    expect(formatRating(10)).toBe("10");
  });

  it("splits and composes", () => {
    expect(splitRating(7.5)).toEqual({ whole: 7, tenth: 5 });
    expect(splitRating(7.3)).toEqual({ whole: 7, tenth: 3 });
    expect(splitRating(10)).toEqual({ whole: 10, tenth: 0 });
    expect(composeRating(7, 3)).toBe(7.3);
    expect(composeRating(10, 5)).toBe(10);
    expect(composeRating(0, 4)).toBe(1.4);
    expect(roundRating(0.1 + 0.2)).toBe(0.3);
  });
});
