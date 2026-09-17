import { describe, expect, it } from "vitest";
import { buildBracket, parseBracketRows, parseRosters, roundLabel } from "./bracket";

// Six-team losers bracket in Sleeper's shape: two byes, semis, then the final and the 3rd/5th place games.
const rows = parseBracketRows([
  { r: 1, m: 1, t1: 9, t2: 12, w: 9, l: 12 },
  { r: 1, m: 2, t1: 10, t2: 11, w: 11, l: 10 },
  { r: 2, m: 3, t1: 7, t2: null, t2_from: { w: 1 }, w: 7, l: 9 },
  { r: 2, m: 4, t1: 8, t2: null, t2_from: { w: 2 }, w: 11, l: 8 },
  { r: 3, m: 5, t1: null, t2: null, t1_from: { w: 3 }, t2_from: { w: 4 }, w: 11, l: 7, p: 1 },
  { r: 3, m: 6, t1: null, t2: null, t1_from: { l: 3 }, t2_from: { l: 4 }, w: 8, l: 9, p: 3 },
  { r: 3, m: 7, t1: 12, t2: 10, w: 10, l: 12, p: 5 },
  "garbage",
  { r: "x" },
]);
const rosters = parseRosters([7, 8, 9, 10, 11, 12].map((id) => ({ roster_id: id, owner_id: `u${id}`, settings: { wins: 20 - id, losses: 8 + id } })));
const managers = [7, 8, 9, 10, 11, 12].map((id) => ({ user_id: `u${id}`, display_name: `Manager ${id}`, username: id === 7 ? "VictorDercksen" : `m${id}`, team_name: id === 7 ? "Chase-ing Mahomelessness" : `Team ${id}`, avatar: null }));

describe("bracket", () => {
  it("drops malformed rows and keeps the valid ones", () => {
    expect(rows).toHaveLength(7);
    expect(parseRosters("nope")).toEqual([]);
  });

  it("orders rounds and matches, labels placement games and resolves feeder slots", () => {
    const b = buildBracket(rows, rosters, managers);
    expect(b.rounds.map((r) => r.label)).toEqual(["ROUND 1", "SEMIS", "TOILET BOWL"]);
    expect(b.rounds[2].matches.map((m) => m.label)).toEqual(["FINAL", "3RD PLACE", "5TH PLACE"]);
    const semi = b.rounds[1].matches[0];
    expect(semi.t2.from).toBe("Winner of M1");
    expect(semi.t2.team?.rosterId).toBe(9);
    expect(semi.t2.result).toBe("loss");
    const final = b.rounds[2].matches[0];
    expect(final.t1.team?.rosterId).toBe(7);
    expect(final.t2.team?.rosterId).toBe(11);
    expect(final.t2.result).toBe("win");
    expect(semi.t1.team?.teamName).toBe("Chase-ing Mahomelessness");
    expect(semi.t1.result).toBe("win");
    expect(b.rounds[0].matches[0].t2.result).toBe("loss");
    expect(b.teams).toBe(6);
  });

  it("marks the loser of the last-place game as sentenced when no override is given", () => {
    const b = buildBracket(rows, rosters, managers);
    expect(b.sentenced?.rosterId).toBe(12);
    expect(b.sentenced?.record).toBe("8-20");
  });

  it("lets the programme's sentenced manager override the bracket", () => {
    const b = buildBracket(rows, rosters, managers, "@VictorDercksen");
    expect(b.sentenced?.username).toBe("VictorDercksen");
  });

  it("leaves undecided feeder slots empty", () => {
    const b = buildBracket(parseBracketRows([{ r: 1, m: 1, t1: 1, t2: 2 }, { r: 2, m: 2, t1: 3, t2: null, t2_from: { w: 1 } }]), [], []);
    expect(b.rounds[1].matches[0].t2.team).toBeNull();
    expect(b.rounds[1].matches[0].t2.from).toBe("Winner of M1");
    expect(b.rounds[1].matches[0].t1.result).toBeNull();
  });

  it("falls back to roster placeholders for unknown owners", () => {
    const b = buildBracket(parseBracketRows([{ r: 1, m: 1, t1: 1, t2: 2, w: 1, l: 2 }]), [], []);
    expect(b.rounds[0].label).toBe("ROUND 1");
    expect(b.rounds[0].matches[0].t1.team?.teamName).toBe("Roster 1");
    expect(b.sentenced).toBeNull();
  });

  it("labels rounds by count", () => {
    expect(roundLabel(1, 1)).toBe("ROUND 1");
    expect(roundLabel(2, 2)).toBe("TOILET BOWL");
    expect(roundLabel(3, 4)).toBe("SEMIS");
  });
});
