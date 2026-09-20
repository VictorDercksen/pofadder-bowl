import { describe, expect, it } from "vitest";
import { formatLine, isPropLocked, isSideValid, pickOutcome, propWinners, scorePicks, sideLabel, sidesFor, sortStandings, type PropLike } from "./props";

const props: PropLike[] = [
  { id: "a", kind: "over_under", result: "over" },
  { id: "b", kind: "yes_no", result: "no" },
  { id: "c", kind: "over_under", result: "void" },
  { id: "d", kind: "over_under", result: null },
];

describe("prop sides", () => {
  it("offers over/under or yes/no per kind", () => {
    expect(sidesFor("over_under")).toEqual(["over", "under"]);
    expect(sidesFor("yes_no")).toEqual(["yes", "no"]);
    expect(isSideValid("over_under", "yes")).toBe(false);
    expect(isSideValid("yes_no", "no")).toBe(true);
    expect(isSideValid("yes_no", "toString")).toBe(false);
  });
  it("labels sides and void", () => {
    expect(sideLabel("over")).toBe("Over");
    expect(sideLabel("void")).toBe("Void");
  });
});

describe("prop lock", () => {
  it("locks at the instant and fails closed on garbage", () => {
    const at = new Date("2026-09-23T17:15:00Z");
    expect(isPropLocked("2026-09-23T17:15:00Z", new Date(at.getTime() - 1))).toBe(false);
    expect(isPropLocked("2026-09-23T17:15:00Z", at)).toBe(true);
    expect(isPropLocked("not a date", at)).toBe(true);
  });
});

describe("line formatting", () => {
  it("drops trailing zeros and appends the unit", () => {
    expect(formatLine("10.25", "km")).toBe("10.25 km");
    expect(formatLine(90, "seconds")).toBe("90 seconds");
    expect(formatLine("60.50", "comments")).toBe("60.5 comments");
    expect(formatLine(null, "km")).toBe("");
    expect(formatLine("abc", "km")).toBe("");
  });
});

describe("scoring", () => {
  it("classifies each pick", () => {
    expect(pickOutcome(props[0], "over")).toBe("correct");
    expect(pickOutcome(props[0], "under")).toBe("wrong");
    expect(pickOutcome(props[2], "over")).toBe("void");
    expect(pickOutcome(props[3], "over")).toBe("pending");
    expect(pickOutcome(props[0], null)).toBe("none");
  });
  it("tallies per member and ignores picks on unknown props", () => {
    const scores = scorePicks(props, [
      { prop_id: "a", user_id: "u1", side: "over" },
      { prop_id: "b", user_id: "u1", side: "no" },
      { prop_id: "c", user_id: "u1", side: "under" },
      { prop_id: "d", user_id: "u1", side: "under" },
      { prop_id: "a", user_id: "u2", side: "under" },
      { prop_id: "zzz", user_id: "u2", side: "under" },
    ]);
    expect(scores.get("u1")).toEqual({ correct: 2, wrong: 0, pending: 1 });
    expect(scores.get("u2")).toEqual({ correct: 0, wrong: 1, pending: 0 });
  });
  it("shares the win on a tie and awards nobody on zero", () => {
    expect(propWinners([["u1", { correct: 2, wrong: 0, pending: 0 }], ["u2", { correct: 2, wrong: 1, pending: 0 }], ["u3", { correct: 1, wrong: 0, pending: 0 }]])).toEqual(["u1", "u2"]);
    expect(propWinners([["u1", { correct: 0, wrong: 3, pending: 0 }]])).toEqual([]);
    expect(propWinners([])).toEqual([]);
  });
  it("orders standings like the RPC", () => {
    const rows = sortStandings([
      { display_name: "Zed", correct: 1, wrong: 0, picks: 5 },
      { display_name: "Amy", correct: 1, wrong: 0, picks: 5 },
      { display_name: "Bob", correct: 2, wrong: 3, picks: 5 },
      { display_name: "Cal", correct: 1, wrong: 2, picks: 9 },
    ]).map((r) => r.display_name);
    expect(rows).toEqual(["Bob", "Amy", "Zed", "Cal"]);
  });
});
