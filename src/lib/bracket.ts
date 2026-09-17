/**
 * Sleeper losers bracket ("Toilet Bowl") as a view model. Pure so it can be unit tested;
 * the fetching lives in sleeper.ts and the snapshot in src/data/sleeper-losers-bracket.json.
 *
 * Sleeper bracket rows (docs.sleeper.com): { r: round, m: match, t1, t2: roster ids or null,
 * w, l: winner/loser roster ids once played, t1_from/t2_from: { w: match } | { l: match },
 * p: the place this match decides (1 = bracket final) }.
 *
 * In the losers bracket the team that LOSES on points advances, so Sleeper's `w` is the team
 * that moved on (towards last place) and scored fewer points. We keep both ideas apart:
 * `advanced` is the bracket flag, `result` is what the scoreboard said.
 */
import { z } from "zod";

/** 2024 season, 2026 consequences. */
export const SENTENCED_SEASON = "2024";

const fromSchema = z.object({ w: z.number().int().optional(), l: z.number().int().optional() }).nullable().optional();
const rowSchema = z.object({
  r: z.number().int().min(1),
  m: z.number().int().min(1),
  t1: z.number().int().nullable().optional(),
  t2: z.number().int().nullable().optional(),
  w: z.number().int().nullable().optional(),
  l: z.number().int().nullable().optional(),
  t1_from: fromSchema,
  t2_from: fromSchema,
  p: z.number().int().nullable().optional(),
});
const rosterSchema = z.object({
  roster_id: z.number().int(),
  owner_id: z.string().nullable().optional(),
  settings: z.object({ wins: z.number().optional(), losses: z.number().optional(), ties: z.number().optional(), fpts: z.number().optional() }).nullable().optional(),
});
const matchupSchema = z.object({ roster_id: z.number().int(), points: z.number().nullable().optional() });

export type BracketRow = z.infer<typeof rowSchema>;
export type Roster = z.infer<typeof rosterSchema>;
export type Manager = { user_id: string; display_name: string; username: string | null; team_name: string | null; avatar: string | null };
/** Points per roster id for one week (`/league/{id}/matchups/{week}`). */
export type WeekScores = Map<number, number>;

export type BracketTeam = { rosterId: number; teamName: string; managerName: string; username: string | null; avatar: string | null; record: string | null };
export type BracketSlot = {
  team: BracketTeam | null;
  from: string | null;
  /** Scoreboard result: from points when both sides scored, else inferred from the bracket flags. */
  result: "win" | "loss" | null;
  /** Sleeper's bracket flag: this team moved on (in the Toilet Bowl, by losing). */
  advanced: boolean;
  points: number | null;
};
export type BracketMatch = { id: number; round: number; week: number | null; place: number | null; label: string; t1: BracketSlot; t2: BracketSlot };
export type BracketItem = { kind: "match"; match: BracketMatch } | { kind: "bye"; team: BracketTeam };
export type BracketRound = { round: number; week: number | null; label: string; items: BracketItem[] };
export type Bracket = {
  /** The main tree: byes, the matches that feed the final and the final itself. */
  rounds: BracketRound[];
  /** Consolation games (3rd place, 5th place, ...), drawn under the tree. */
  placement: BracketMatch[];
  /** True when every round halves the previous one, so the tree can be drawn with connectors. */
  regular: boolean;
  sentenced: BracketTeam | null;
  teams: number;
};

/** Untrusted JSON in, typed rows out; malformed entries are dropped rather than failing the page. */
export function parseBracketRows(raw: unknown, max = 64): BracketRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, max).flatMap((r) => {
    const res = rowSchema.safeParse(r);
    return res.success ? [res.data] : [];
  });
}

export function parseRosters(raw: unknown, max = 64): Roster[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, max).flatMap((r) => {
    const res = rosterSchema.safeParse(r);
    return res.success ? [res.data] : [];
  });
}

/** One week of Sleeper matchups into roster id → points. Rows without a numeric score are skipped. */
export function parseWeekScores(raw: unknown, max = 64): WeekScores {
  const out: WeekScores = new Map();
  if (!Array.isArray(raw)) return out;
  for (const r of raw.slice(0, max)) {
    const res = matchupSchema.safeParse(r);
    if (res.success && typeof res.data.points === "number") out.set(res.data.roster_id, res.data.points);
  }
  return out;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

/** Sleeper's own naming: ROUND 1, ROUND 2, ..., FINALS. */
export function roundLabel(round: number, total: number): string {
  if (total > 1 && round === total) return "FINALS";
  return `ROUND ${round}`;
}

export function formatPoints(points: number | null): string {
  return points == null ? "–" : points.toFixed(2);
}

export type BuildOptions = {
  /** Sleeper `settings.playoff_week_start`; round r is played in week start + r - 1. */
  playoffWeekStart?: number | null;
  /** Points per week, keyed by week number. */
  scores?: Record<string, WeekScores> | Map<number, WeekScores>;
};

/** Builds the bracket. `sentencedUsername` (from the programme) wins over the bracket's own last-place game. */
export function buildBracket(rows: BracketRow[], rosters: Roster[], managers: Manager[], sentencedUsername?: string | null, options: BuildOptions = {}): Bracket {
  const byUser = new Map(managers.map((m) => [m.user_id, m]));
  const teams = new Map<number, BracketTeam>();
  for (const r of rosters) {
    const m = r.owner_id ? byUser.get(r.owner_id) : undefined;
    const wins = r.settings?.wins;
    const losses = r.settings?.losses;
    teams.set(r.roster_id, {
      rosterId: r.roster_id,
      teamName: m?.team_name ?? m?.display_name ?? `Roster ${r.roster_id}`,
      managerName: m?.display_name ?? "Unknown manager",
      username: m?.username ?? null,
      avatar: m?.avatar ?? null,
      record: typeof wins === "number" && typeof losses === "number" ? `${wins}-${losses}${r.settings?.ties ? `-${r.settings.ties}` : ""}` : null,
    });
  }
  const team = (id: number | null | undefined): BracketTeam | null => (id == null ? null : (teams.get(id) ?? { rosterId: id, teamName: `Roster ${id}`, managerName: "Unknown manager", username: null, avatar: null, record: null }));
  const from = (f: BracketRow["t1_from"]): string | null => (f?.w != null ? `Loser of M${f.w}` : f?.l != null ? `Survivor of M${f.l}` : null);

  const sorted = [...rows].sort((a, b) => a.r - b.r || a.m - b.m);
  const byMatch = new Map(sorted.map((r) => [r.m, r]));
  // Sleeper fills t1/t2 once a feeder match is decided; resolve it ourselves for older snapshots.
  const resolve = (id: number | null | undefined, f: BracketRow["t1_from"]): number | null => {
    if (id != null) return id;
    const feeder = f?.w != null ? byMatch.get(f.w) : f?.l != null ? byMatch.get(f.l) : undefined;
    if (!feeder) return null;
    return (f?.w != null ? feeder.w : feeder.l) ?? null;
  };
  const roundNumbers = Array.from(new Set(sorted.map((r) => r.r))).sort((a, b) => a - b);
  const total = roundNumbers.length;
  const weekOf = (round: number): number | null => (options.playoffWeekStart != null ? options.playoffWeekStart + round - 1 : null);
  const scoresFor = (week: number | null): WeekScores | undefined => {
    if (week == null || !options.scores) return undefined;
    return options.scores instanceof Map ? options.scores.get(week) : options.scores[String(week)];
  };

  const toMatch = (r: BracketRow): BracketMatch => {
    const week = weekOf(r.r);
    const scores = scoresFor(week);
    const id1 = resolve(r.t1, r.t1_from);
    const id2 = resolve(r.t2, r.t2_from);
    const p1 = id1 != null ? (scores?.get(id1) ?? null) : null;
    const p2 = id2 != null ? (scores?.get(id2) ?? null) : null;
    const decided = r.w != null || r.l != null;
    const slot = (id: number | null, mine: number | null, theirs: number | null, f: BracketRow["t1_from"]): BracketSlot => {
      let result: BracketSlot["result"] = null;
      if (id != null && decided) {
        if (mine != null && theirs != null && mine !== theirs) result = mine > theirs ? "win" : "loss";
        // No scores: in the Toilet Bowl the bracket "winner" is the team that lost on points.
        else if (r.w === id) result = "loss";
        else if (r.l === id) result = "win";
      }
      return { team: team(id), from: from(f), result, advanced: id != null && r.w === id, points: mine };
    };
    return {
      id: r.m,
      round: r.r,
      week,
      place: r.p ?? null,
      label: r.p != null ? (r.p === 1 ? "LAST PLACE" : `${ordinal(r.p).toUpperCase()} PLACE`) : `MATCH ${r.m}`,
      t1: slot(id1, p1, p2, r.t1_from),
      t2: slot(id2, p2, p1, r.t2_from),
    };
  };

  const isMain = (r: BracketRow) => r.p == null || r.p === 1;
  const placement = sorted.filter((r) => !isMain(r)).map(toMatch).sort((a, b) => (a.place ?? 0) - (b.place ?? 0));
  const rounds: BracketRound[] = roundNumbers.map((round) => ({
    round,
    week: weekOf(round),
    label: roundLabel(round, total),
    items: sorted.filter((r) => r.r === round && isMain(r)).map((r) => ({ kind: "match" as const, match: toMatch(r) })),
  }));

  // Byes: teams that start in round 2 of the main tree without playing in round 1. Sleeper lists
  // them in the first column, interleaved with the round 1 matches.
  if (rounds.length >= 2) {
    const inRoundOne = new Set<number>();
    for (const r of sorted) if (r.r === roundNumbers[0]) for (const id of [r.t1, r.t2, r.w, r.l]) if (id != null) inRoundOne.add(id);
    const byes: BracketItem[] = [];
    for (const item of rounds[1].items) {
      if (item.kind !== "match") continue;
      for (const s of [item.match.t1, item.match.t2]) if (s.team && !inRoundOne.has(s.team.rosterId)) byes.push({ kind: "bye", team: s.team });
    }
    const matches = rounds[0].items;
    const merged: BracketItem[] = [];
    for (let i = 0; i < Math.max(byes.length, matches.length); i++) {
      if (byes[i]) merged.push(byes[i]);
      if (matches[i]) merged.push(matches[i]);
    }
    rounds[0].items = merged;
  }
  const leaves = rounds[0]?.items.length ?? 0;
  const regular = leaves > 0 && rounds.every((round, i) => round.items.length * 2 ** i === leaves);

  let sentenced: BracketTeam | null = null;
  if (sentencedUsername) {
    const handle = sentencedUsername.replace(/^@/, "").toLowerCase();
    sentenced = Array.from(teams.values()).find((t) => (t.username ?? "").toLowerCase() === handle || t.managerName.toLowerCase() === handle) ?? null;
  }
  if (!sentenced) {
    // The last-place game is p = 1 in the losers bracket; its bracket "winner" finishes last.
    const final = sorted.find((r) => r.p === 1 && r.w != null);
    if (final) sentenced = team(final.w);
  }
  const involved = new Set<number>();
  for (const r of sorted) for (const id of [r.t1, r.t2, r.w, r.l]) if (id != null) involved.add(id);
  return { rounds, placement, regular, sentenced, teams: involved.size };
}
