import { describe, expect, it } from "vitest";
import { buildBracket, formatPoints, parseBracketRows, parseRosters, parseWeekScores, roundLabel } from "./bracket";

// Six-team losers bracket in Sleeper's shape: two byes, semis, then the final and the 3rd/5th place games.
// In the Toilet Bowl the team that loses on points advances, so `w` is the lower scorer.
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
const scores = {
  "15": parseWeekScores([{ roster_id: 9, points: 96.34 }, { roster_id: 12, points: 144.5 }, { roster_id: 10, points: 151.3 }, { roster_id: 11, points: 115 }, "junk", { roster_id: 7 }]),
  "16": parseWeekScores([{ roster_id: 7, points: 82.62 }, { roster_id: 9, points: 119.68 }]),
  "17": parseWeekScores([{ roster_id: 11, points: 132.16 }, { roster_id: 7, points: 166.58 }]),
};

describe("bracket", () => {
  it("drops malformed rows and keeps the valid ones", () => {
    expect(rows).toHaveLength(7);
    expect(parseRosters("nope")).toEqual([]);
    expect(parseWeekScores("nope").size).toBe(0);
    expect(scores["15"].size).toBe(4);
  });

  it("splits the main tree from the placement games and labels rounds like Sleeper", () => {
    const b = buildBracket(rows, rosters, managers, null, { playoffWeekStart: 15, scores });
    expect(b.rounds.map((r) => r.label)).toEqual(["ROUND 1", "ROUND 2", "FINALS"]);
    expect(b.rounds.map((r) => r.week)).toEqual([15, 16, 17]);
    expect(b.rounds[2].items).toHaveLength(1);
    const final = b.rounds[2].items[0];
    expect(final.kind === "match" && final.match.label).toBe("LAST PLACE");
    expect(b.placement.map((m) => m.label)).toEqual(["3RD PLACE", "5TH PLACE"]);
    expect(b.placement[1].week).toBe(17);
    expect(b.teams).toBe(6);
  });

  it("puts the byes in the first column, interleaved with the round 1 matches, and marks the tree regular", () => {
    const b = buildBracket(rows, rosters, managers);
    expect(b.rounds[0].items.map((i) => (i.kind === "bye" ? `bye ${i.team.rosterId}` : `M${i.match.id}`))).toEqual(["bye 7", "M1", "bye 8", "M2"]);
    expect(b.regular).toBe(true);
  });

  it("reads the scoreboard from points and keeps Sleeper's advance flag separate", () => {
    const b = buildBracket(rows, rosters, managers, null, { playoffWeekStart: 15, scores });
    const m1 = b.rounds[0].items[1];
    if (m1.kind !== "match") throw new Error("expected a match");
    expect(m1.match.t1.points).toBe(96.34);
    expect(m1.match.t1.result).toBe("loss");
    expect(m1.match.t1.advanced).toBe(true);
    expect(m1.match.t2.result).toBe("win");
    expect(m1.match.t2.advanced).toBe(false);
    const semi = b.rounds[1].items[0];
    if (semi.kind !== "match") throw new Error("expected a match");
    expect(semi.match.t2.from).toBe("Loser of M1");
    expect(semi.match.t2.team?.rosterId).toBe(9);
    expect(semi.match.t2.result).toBe("win");
    expect(semi.match.t1.team?.teamName).toBe("Chase-ing Mahomelessness");
    expect(semi.match.t1.result).toBe("loss");
    expect(semi.match.t1.points).toBe(82.62);
  });

  it("infers the scoreboard from the bracket flags when no points are known", () => {
    const b = buildBracket(rows, rosters, managers);
    const m1 = b.rounds[0].items[1];
    if (m1.kind !== "match") throw new Error("expected a match");
    expect(m1.match.t1.points).toBeNull();
    expect(m1.match.t1.result).toBe("loss");
    expect(m1.match.t2.result).toBe("win");
    expect(m1.match.week).toBeNull();
  });

  it("marks the bracket winner of the last-place game as sentenced when no override is given", () => {
    const b = buildBracket(rows, rosters, managers);
    expect(b.sentenced?.rosterId).toBe(11);
    expect(b.sentenced?.record).toBe("9-19");
  });

  it("lets the programme's sentenced manager override the bracket", () => {
    const b = buildBracket(rows, rosters, managers, "@VictorDercksen");
    expect(b.sentenced?.username).toBe("VictorDercksen");
  });

  it("leaves undecided feeder slots empty and does not call the tree regular", () => {
    const b = buildBracket(parseBracketRows([{ r: 1, m: 1, t1: 1, t2: 2 }, { r: 1, m: 2, t1: 5, t2: 6 }, { r: 1, m: 3, t1: 7, t2: 8 }, { r: 2, m: 4, t1: 3, t2: null, t2_from: { w: 1 } }]), [], []);
    const m4 = b.rounds[1].items[0];
    if (m4.kind !== "match") throw new Error("expected a match");
    expect(m4.match.t2.team).toBeNull();
    expect(m4.match.t2.from).toBe("Loser of M1");
    expect(m4.match.t1.result).toBeNull();
    expect(m4.match.t1.advanced).toBe(false);
    expect(b.rounds[0].items.map((i) => i.kind)).toEqual(["bye", "match", "match", "match"]);
    expect(b.regular).toBe(false);
  });

  it("falls back to roster placeholders for unknown owners", () => {
    const b = buildBracket(parseBracketRows([{ r: 1, m: 1, t1: 1, t2: 2, w: 1, l: 2 }]), [], []);
    expect(b.rounds[0].label).toBe("ROUND 1");
    const m = b.rounds[0].items[0];
    expect(m.kind === "match" && m.match.t1.team?.teamName).toBe("Roster 1");
    expect(b.sentenced).toBeNull();
    expect(b.regular).toBe(true);
  });

  it("labels rounds by count and formats points", () => {
    expect(roundLabel(1, 1)).toBe("ROUND 1");
    expect(roundLabel(2, 2)).toBe("FINALS");
    expect(roundLabel(3, 4)).toBe("ROUND 3");
    expect(formatPoints(132.1)).toBe("132.10");
    expect(formatPoints(null)).toBe("–");
  });
});
