import { describe, expect, it } from "vitest";
import { checkinPath } from "./checkin-path";

describe("checkinPath", () => {
  it("orders newest-first check-ins into a chronological line", () => {
    const path = checkinPath([
      { latitude: -29.13, longitude: 19.39, captured_at: "2026-09-24T04:00:00Z" },
      { latitude: -31.5, longitude: 18.9, captured_at: "2026-09-23T23:00:00Z" },
      { latitude: -33.46, longitude: 18.73, captured_at: "2026-09-23T19:00:00Z" },
    ]);
    expect(path).toEqual([
      [-33.46, 18.73],
      [-31.5, 18.9],
      [-29.13, 19.39],
    ]);
  });

  it("drops rows without a usable coordinate", () => {
    const path = checkinPath([
      { latitude: Number.NaN, longitude: 18.73, captured_at: "2026-09-23T19:00:00Z" },
      { latitude: -33.46, longitude: 200, captured_at: "2026-09-23T20:00:00Z" },
      { latitude: -29.13, longitude: 19.39, captured_at: "2026-09-24T04:00:00Z" },
    ]);
    expect(path).toEqual([[-29.13, 19.39]]);
  });

  it("returns an empty line when there are no check-ins", () => {
    expect(checkinPath([])).toEqual([]);
  });
});
