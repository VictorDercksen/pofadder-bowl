import "server-only";
import snapshot from "@/data/sleeper-losers-bracket.json";
import { buildBracket, parseBracketRows, parseRosters, parseWeekScores, type Bracket, type BracketRow, type Manager, type WeekScores } from "@/lib/bracket";

/**
 * Sleeper public API (read-only, no authentication available). Docs: https://docs.sleeper.com
 * Stay well under 1000 calls/minute. We store user_id because usernames can change.
 */
const BASE = "https://api.sleeper.app/v1";

export type SleeperLeagueUser = { user_id: string; username: string | null; display_name: string; team_name: string | null; avatar: string | null; is_owner: boolean; season: string | null };

export async function fetchSleeperLeagueUsers(leagueId: string): Promise<SleeperLeagueUser[]> {
  if (!/^\d{5,30}$/.test(leagueId)) throw new Error("invalid league id");
  const [leagueRes, usersRes] = await Promise.all([fetch(`${BASE}/league/${leagueId}`, { cache: "no-store" }), fetch(`${BASE}/league/${leagueId}/users`, { cache: "no-store" })]);
  if (!usersRes.ok) throw new Error(`league users request failed (${usersRes.status})`);
  const league = leagueRes.ok ? ((await leagueRes.json()) as { season?: string }) : {};
  const raw: unknown = await usersRes.json();
  if (!Array.isArray(raw)) throw new Error("league users response was not a list");
  const text = (v: unknown, max: number): string | null => (typeof v === "string" && v.length > 0 ? v.slice(0, max) : null);
  // Untrusted external JSON: bound the list and every string, and skip rows without a usable id.
  return raw
    .slice(0, 200)
    .filter((u): u is Record<string, unknown> => typeof u === "object" && u !== null)
    .flatMap((u) => {
      const id = typeof u.user_id === "string" || typeof u.user_id === "number" ? String(u.user_id) : "";
      if (!/^\d{1,30}$/.test(id)) return [];
      const meta = typeof u.metadata === "object" && u.metadata !== null ? (u.metadata as Record<string, unknown>) : null;
      return [
        {
          user_id: id,
          username: text(u.username, 60),
          display_name: text(u.display_name, 60) ?? text(u.username, 60) ?? "Sleeper user",
          team_name: text(meta?.team_name, 80),
          avatar: text(u.avatar, 64),
          is_owner: u.is_owner === true,
          season: typeof league.season === "string" ? league.season.slice(0, 8) : null,
        },
      ];
    });
}

export function sleeperAvatarUrl(avatar: string | null, thumb = true): string | null {
  if (!avatar || !/^[a-f0-9]{16,64}$/i.test(avatar)) return null;
  return `https://sleepercdn.com/avatars/${thumb ? "thumbs/" : ""}${avatar}`;
}

type SleeperLeague = { league_id: string; name: string; season: string | null; previous_league_id: string | null; playoffWeekStart: number | null };

/** Cached read (Next data cache, one hour). The bracket is history; nothing here changes by the minute. */
async function getCached(path: string): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`${path} failed (${res.status})`);
  return res.json();
}

function asLeague(raw: unknown): SleeperLeague | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.league_id === "string" ? o.league_id : null;
  if (!id) return null;
  const settings = typeof o.settings === "object" && o.settings !== null ? (o.settings as Record<string, unknown>) : null;
  const start = settings?.playoff_week_start;
  return {
    league_id: id,
    name: typeof o.name === "string" ? o.name.slice(0, 80) : "Sleeper league",
    season: typeof o.season === "string" ? o.season : null,
    previous_league_id: typeof o.previous_league_id === "string" ? o.previous_league_id : null,
    playoffWeekStart: typeof start === "number" && Number.isInteger(start) && start > 0 && start < 30 ? start : null,
  };
}

/** Walks previous_league_id back from the configured league to the given season (max 8 hops). */
export async function resolveSeasonLeague(startId: string, season: string): Promise<SleeperLeague | null> {
  let id: string | null = startId;
  for (let hop = 0; id && hop < 8; hop++) {
    if (!/^\d{5,30}$/.test(id)) return null;
    const league = asLeague(await getCached(`/league/${id}`));
    if (!league) return null;
    if (league.season === season) return league;
    id = league.previous_league_id;
  }
  return null;
}

function toManagers(raw: unknown): Manager[] {
  if (!Array.isArray(raw)) return [];
  const text = (v: unknown, max: number): string | null => (typeof v === "string" && v.length > 0 ? v.slice(0, max) : null);
  return raw.slice(0, 200).flatMap((u) => {
    if (typeof u !== "object" || u === null) return [];
    const o = u as Record<string, unknown>;
    const id = typeof o.user_id === "string" || typeof o.user_id === "number" ? String(o.user_id) : "";
    if (!/^\d{1,30}$/.test(id)) return [];
    const meta = typeof o.metadata === "object" && o.metadata !== null ? (o.metadata as Record<string, unknown>) : null;
    return [{ user_id: id, display_name: text(o.display_name, 60) ?? text(o.username, 60) ?? "Sleeper user", username: text(o.username, 60), team_name: text(meta?.team_name, 80), avatar: text(o.avatar, 64) }];
  });
}

export type LosersBracketData = { season: string; leagueName: string; bracket: Bracket; source: "live" | "snapshot" };

/** The weeks the bracket was played in: playoff_week_start + round - 1 for every round present. */
function bracketWeeks(rows: BracketRow[], playoffWeekStart: number | null): number[] {
  if (playoffWeekStart == null) return [];
  const rounds = Array.from(new Set(rows.map((r) => r.r)));
  return rounds.map((r) => playoffWeekStart + r - 1);
}

/** Points per playoff week, fetched in parallel. A week that fails just shows no scores. */
async function fetchWeekScores(leagueId: string, weeks: number[]): Promise<Map<number, WeekScores>> {
  const entries = await Promise.all(weeks.map(async (week) => [week, parseWeekScores(await getCached(`/league/${leagueId}/matchups/${week}`).catch(() => null))] as const));
  return new Map(entries);
}

/**
 * The sentenced season's losers bracket: live from Sleeper (cached an hour), else the committed
 * snapshot (scripts/fetch-sleeper-bracket.ts), else null so the caller shows the standings.
 */
export async function loadLosersBracket(startLeagueId: string | null, season: string, sentencedUsername?: string | null): Promise<LosersBracketData | null> {
  if (startLeagueId) {
    try {
      const league = await resolveSeasonLeague(startLeagueId, season);
      if (league) {
        const [rowsRaw, rostersRaw, usersRaw] = await Promise.all([getCached(`/league/${league.league_id}/losers_bracket`), getCached(`/league/${league.league_id}/rosters`), getCached(`/league/${league.league_id}/users`)]);
        const rows = parseBracketRows(rowsRaw);
        if (rows.length) {
          const scores = await fetchWeekScores(league.league_id, bracketWeeks(rows, league.playoffWeekStart));
          return { season, leagueName: league.name, bracket: buildBracket(rows, parseRosters(rostersRaw), toManagers(usersRaw), sentencedUsername, { playoffWeekStart: league.playoffWeekStart, scores }), source: "live" };
        }
      }
    } catch {
      // Fall through to the snapshot.
    }
  }
  const rows = parseBracketRows(snapshot.bracket);
  if (snapshot.season === season && rows.length) {
    const scores = new Map(Object.entries(snapshot.matchups ?? {}).map(([week, raw]) => [Number(week), parseWeekScores(raw)] as const));
    return { season, leagueName: snapshot.leagueName ?? "Sleeper league", bracket: buildBracket(rows, parseRosters(snapshot.rosters), toManagers(snapshot.users), sentencedUsername, { playoffWeekStart: snapshot.playoffWeekStart ?? null, scores }), source: "snapshot" };
  }
  return null;
}
