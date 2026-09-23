/**
 * Prop board helpers shared by the page, the demo and tests.
 * Mirrors public.upsert_prop_pick(), settle_prop() and prop_leaderboard() in the database.
 * One point per correct pick; void props score nothing; the top score wins.
 */

export type PropKind = "over_under" | "yes_no";
export type PropSide = "over" | "under" | "yes" | "no";
export type PropResult = PropSide | "void";

export type PropLike = { id: string; kind: PropKind; result: PropResult | null };
export type PickLike = { prop_id: string; user_id: string; side: PropSide };
export type PickScore = { correct: number; wrong: number; pending: number };

/** The two sides a member can take on a prop, in display order. */
export function sidesFor(kind: PropKind): [PropSide, PropSide] {
  return kind === "yes_no" ? ["yes", "no"] : ["over", "under"];
}

export function isSideValid(kind: PropKind, side: string): side is PropSide {
  return (sidesFor(kind) as string[]).includes(side);
}

export function sideLabel(side: PropResult): string {
  return side === "void" ? "Void" : side[0].toUpperCase() + side.slice(1);
}

/** Fails closed: an unparseable lock instant reads as locked (the RPC enforces the real lock). */
export function isPropLocked(locksAtIso: string, now: Date = new Date()): boolean {
  const lock = Date.parse(locksAtIso);
  return !Number.isFinite(lock) || now.getTime() >= lock;
}

/**
 * Props settle only once the bus is back in Malmesbury (events.home_arrival_at, the "Arrive
 * Malmesbury" stop). Fails closed: an unparseable instant reads as not yet open (settle_prop
 * enforces the real instant).
 */
export function isSettlementOpen(homeArrivalAtIso: string, now: Date = new Date()): boolean {
  const arrival = Date.parse(homeArrivalAtIso);
  return Number.isFinite(arrival) && now.getTime() >= arrival;
}

/** "10.25 km", "90 seconds", "20 min late". Trailing zeros are dropped. */
export function formatLine(line: number | string | null, unit: string | null): string {
  if (line == null) return "";
  const n = typeof line === "string" ? Number(line) : line;
  if (!Number.isFinite(n)) return "";
  const text = Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
  return unit ? `${text} ${unit}` : text;
}

/** A prop as the board draws it: the saved side and whether it still accepts picks. */
export type DraftablePropLike = { id: string; locked: boolean; mine: PropSide | null };

/** One pick the member has changed on the board and not yet saved. */
export type PendingPick = { propId: string; side: PropSide };

/**
 * The picks a save must send: drafted sides that differ from the saved side, on props that
 * are still open. Untouched props, drafts equal to the saved side and locked props drop out.
 */
export function pendingPicks(props: DraftablePropLike[], drafts: Partial<Record<string, PropSide>>): PendingPick[] {
  const out: PendingPick[] = [];
  for (const p of props) {
    const side = drafts[p.id];
    if (!side || p.locked || side === p.mine) continue;
    out.push({ propId: p.id, side });
  }
  return out;
}

/** Outcome of one pick against a prop's result. */
export function pickOutcome(prop: PropLike, side: PropSide | null | undefined): "correct" | "wrong" | "void" | "pending" | "none" {
  if (!side) return "none";
  if (prop.result == null) return "pending";
  if (prop.result === "void") return "void";
  return prop.result === side ? "correct" : "wrong";
}

/** Per-member tallies over the given props. Members without a pick are absent. */
export function scorePicks(props: PropLike[], picks: PickLike[]): Map<string, PickScore> {
  const byId = new Map(props.map((p) => [p.id, p]));
  const out = new Map<string, PickScore>();
  for (const pick of picks) {
    const prop = byId.get(pick.prop_id);
    if (!prop) continue;
    const row = out.get(pick.user_id) ?? { correct: 0, wrong: 0, pending: 0 };
    const outcome = pickOutcome(prop, pick.side);
    if (outcome === "correct") row.correct += 1;
    else if (outcome === "wrong") row.wrong += 1;
    else if (outcome === "pending") row.pending += 1;
    out.set(pick.user_id, row);
  }
  return out;
}

/** Member ids sharing the top correct count. Nobody wins on zero. */
export function propWinners(scores: Iterable<[string, PickScore]>): string[] {
  const rows = [...scores];
  const top = Math.max(0, ...rows.map(([, s]) => s.correct));
  if (top === 0) return [];
  return rows.filter(([, s]) => s.correct === top).map(([id]) => id);
}

/** Leaderboard order used by the RPC: most correct, fewest wrong, most picks, then name. */
export function sortStandings<T extends { correct: number; wrong: number; picks: number; display_name: string | null }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.correct - a.correct || a.wrong - b.wrong || b.picks - a.picks || (a.display_name ?? "").localeCompare(b.display_name ?? ""));
}
