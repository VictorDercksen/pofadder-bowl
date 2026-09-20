import { describe, expect, it } from "vitest";
import { formatCoordinates, placeLabel } from "./places";

describe("placeLabel", () => {
  it("prefers the stored gazetteer label", () => {
    expect(placeLabel({ latitude: -33.3708, longitude: 18.72714, place_label: "10 km N of Malmesbury" })).toBe("10 km N of Malmesbury");
    expect(placeLabel({ latitude: -29.1283, longitude: 19.39492, place_label: "In Pofadder" })).toBe("In Pofadder");
  });

  it("falls back to coordinates when the label is missing or blank", () => {
    expect(placeLabel({ latitude: -29.1283, longitude: 19.39492 })).toBe("-29.1283, 19.3949");
    expect(placeLabel({ latitude: -29.1283, longitude: 19.39492, place_label: null })).toBe("-29.1283, 19.3949");
    expect(placeLabel({ latitude: -29.1283, longitude: 19.39492, place_label: "   " })).toBe("-29.1283, 19.3949");
  });
});

describe("formatCoordinates", () => {
  it("prints four decimals", () => {
    expect(formatCoordinates({ latitude: -33.4608, longitude: 18.72714 })).toBe("-33.4608, 18.7271");
  });

  it("never prints NaN", () => {
    expect(formatCoordinates({ latitude: Number.NaN, longitude: 18.7 })).toBe("Position unknown");
  });
});
