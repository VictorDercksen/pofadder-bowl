import { describe, expect, it } from "vitest";
import { generateProps, localsCount, randAmount } from "./prop-generator";
import { isSideValid } from "./props";

const event = {
  required_run_km: 10,
  departure_at: "2026-09-23T17:15:00Z",
  away_arrival_at: "2026-09-24T02:45:00Z",
  return_departure_at: "2026-09-24T20:30:00Z",
  timezone: "Africa/Johannesburg",
};
const challenges = [
  { sequence: 1, title: "Town welcome sign, in the dark, on arrival" },
  { sequence: 2, title: "10 km run, full GPS trace including the R358 leg" },
  { sequence: 4, title: "Three locals asked what Pofadder is known for" },
  { sequence: 6, title: "Chicken and rib combo, rated out of ten" },
  { sequence: 8, title: "R50 spent in Pofadder on a public holiday" },
  { sequence: 9, title: "Sunset loser's speech on the N14" },
  { sequence: 10, title: "Boarding the 22:30 bus, ticket and face in frame" },
  { sequence: 3, title: "x" },
  { sequence: 5, title: "y" },
  { sequence: 7, title: "z" },
];

describe("programme parsing", () => {
  it("reads the locals count and the rand amount from challenge titles", () => {
    expect(localsCount("Three locals asked what Pofadder is known for")).toBe(3);
    expect(localsCount("5 locals interviewed")).toBe(5);
    expect(localsCount("Oldest building")).toBeNull();
    expect(randAmount("R50 spent in Pofadder")).toBe(50);
    expect(randAmount("R 120,50 spent on snacks")).toBe(120.5);
    expect(randAmount("the R358 leg")).toBeNull();
  });
});

describe("generateProps", () => {
  const props = generateProps(event, challenges);
  it("returns ten props, numbered 1..10, all locking at departure", () => {
    expect(props.map((p) => p.sequence)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(new Set(props.map((p) => p.locks_at))).toEqual(new Set([event.departure_at]));
  });
  it("derives lines from the programme", () => {
    expect(props[0]).toMatchObject({ line: 10.25, unit: "km" });
    expect(props[3]).toMatchObject({ title: "Locals approached before 3 agree to be filmed", line: 4.5 });
    expect(props[4]).toMatchObject({ line: 8.5 });
    expect(props[8]).toMatchObject({ line: 150, unit: "rand" });
    expect(props[2].title).toBe("Chicken and rib combo finished on camera");
    expect(props[7].title).toBe("Length of the sunset loser's speech on the N14");
    expect(props[1].detail).toContain("04:45");
    expect(props[9].title).toContain("22:30");
  });
  it("every over/under prop has a line and yes/no props have none", () => {
    for (const p of props) {
      if (p.kind === "over_under") expect(typeof p.line).toBe("number");
      else expect(p.line).toBeNull();
      expect(isSideValid(p.kind, p.kind === "yes_no" ? "yes" : "over")).toBe(true);
      expect(p.title.length).toBeLessThanOrEqual(160);
      expect(p.detail.length).toBeLessThanOrEqual(400);
    }
  });
  it("falls back to house lines when the programme is thin", () => {
    const bare = generateProps({ ...event, required_run_km: 0 }, []);
    expect(bare).toHaveLength(10);
    expect(bare[0].line).toBe(10.25);
    expect(bare[2].title).toBe("The rated meal finished on camera");
    expect(bare[3].line).toBe(4.5);
    expect(bare[4].line).toBe(8.5);
    expect(bare[8].line).toBe(150);
  });
  it("is deterministic", () => {
    expect(generateProps(event, challenges)).toEqual(props);
  });
});
