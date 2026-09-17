/**
 * Sleeper losers bracket ("Toilet Bowl") as a view model. Pure so it can be unit tested;
 * the fetching lives in sleeper.ts and the snapshot in src/data/sleeper-losers-bracket.json.
 *
 * Sleeper bracket rows (docs.sleeper.com): { r: round, m: match, t1, t2: roster ids or null,
 * w, l: winner/loser roster ids once played, t1_from/t2_from: { w: match } | { l: match },
 * p: the place this match decides (1 = bracket final) }.
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

export type BracketRow = z.infer<typeof rowSchema>;
export type Roster = z.infer<typeof rosterSchema>;
export type Manager = { user_id: string; display_name: string; username: string | null; team_name: string | null; avatar: string | null };

export type BracketTeam = { rosterId: number; teamName: string; managerName: string; username: string | null; avatar: string | null; record: string | null };
export type BracketSlot = { team: BracketTeam | null; from: string | null; result: "win" | "loss" | null };
export type BracketMatch = { id: number; round: number; place: number | null; label: string; t1: BracketSlot; t2: BracketSlot };
export type BracketRound = { round: number; label: string; matches: BracketMatch[] };
export type Bracket = { rounds: BracketRound[]; sentenced: BracketTeam | null; teams: number };

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

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

export function roundLabel(round: number, total: number): string {
  if (total > 1 && round === total) return "TOILET BOWL";
  if (total > 2 && round === total - 1) return "SEMIS";
  return `ROUND ${round}`;
}

/** Builds the bracket. `sentencedUsername` (from the programme) wins over the bracket's own last-place game. */
export function buildBracket(rows: BracketRow[], rosters: Roster[], managers: Manager[], sentencedUsername?: string | null): Bracket {
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
  const from = (f: BracketRow["t1_from"]): string | null => (f?.w != null ? `Winner of M${f.w}` : f?.l != null ? `Loser of M${f.l}` : null);
  const result = (id: number | null | undefined, row: BracketRow): "win" | "loss" | null => (id == null ? null : row.w === id ? "win" : row.l === id ? "loss" : null);

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
  const rounds: BracketRound[] = roundNumbers.map((round) => ({
    round,
    label: roundLabel(round, total),
    matches: sorted
      .filter((r) => r.r === round)
      .map((r) => ({
        id: r.m,
        round: r.r,
        place: r.p ?? null,
        label: r.p != null ? (r.p === 1 && round === total ? "FINAL" : `${ordinal(r.p).toUpperCase()} PLACE`) : `MATCH ${r.m}`,
        t1: { team: team(resolve(r.t1, r.t1_from)), from: from(r.t1_from), result: result(resolve(r.t1, r.t1_from), r) },
        t2: { team: team(resolve(r.t2, r.t2_from)), from: from(r.t2_from), result: result(resolve(r.t2, r.t2_from), r) },
      })),
  }));

  let sentenced: BracketTeam | null = null;
  if (sentencedUsername) {
    const handle = sentencedUsername.replace(/^@/, "").toLowerCase();
    sentenced = Array.from(teams.values()).find((t) => (t.username ?? "").toLowerCase() === handle || t.managerName.toLowerCase() === handle) ?? null;
  }
  if (!sentenced) {
    // The last-place game is the placement match with the largest place number; its loser is last.
    const placed = sorted.filter((r) => r.p != null && r.l != null);
    if (placed.length) {
      const last = placed.reduce((a, b) => ((b.p ?? 0) > (a.p ?? 0) ? b : a));
      sentenced = team(last.l);
    }
  }
  const involved = new Set<number>();
  for (const r of sorted) for (const id of [r.t1, r.t2, r.w, r.l]) if (id != null) involved.add(id);
  return { rounds, sentenced, teams: involved.size };
}
