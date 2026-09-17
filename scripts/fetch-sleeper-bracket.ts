/**
 * Snapshots the sentenced season's Sleeper losers bracket into src/data/sleeper-losers-bracket.json
 * so the game centre still shows it if the Sleeper API is unreachable. Walks previous_league_id
 * from SLEEPER_LEAGUE_ID (or the first argument) back to the season (default 2024).
 *
 *   npx tsx scripts/fetch-sleeper-bracket.ts [leagueId] [season]
 */
import { writeFileSync } from "node:fs";
import "dotenv/config";

const BASE = "https://api.sleeper.app/v1";
const start = process.argv[2] ?? process.env.SLEEPER_LEAGUE_ID ?? "1313900125680054272";
const season = process.argv[3] ?? "2024";

async function get(path: string): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

async function main() {
  type League = { league_id: string; season?: string; previous_league_id?: string | null; name?: string };
  let id: string | null = start;
  let league: League | null = null;
  for (let hop = 0; id && hop < 8; hop++) {
    const current = (await get(`/league/${id}`)) as League | null;
    if (!current) break;
    if (current.season === season) {
      league = current;
      break;
    }
    id = current.previous_league_id ?? null;
  }
  if (!league) throw new Error(`No league for season ${season} in the chain from ${start}`);
  const [bracket, rosters, users] = await Promise.all([get(`/league/${league.league_id}/losers_bracket`), get(`/league/${league.league_id}/rosters`), get(`/league/${league.league_id}/users`)]);
  const out = { season, leagueName: league.name ?? null, leagueId: league.league_id, fetchedAt: new Date().toISOString(), bracket, rosters, users };
  writeFileSync("src/data/sleeper-losers-bracket.json", JSON.stringify(out, null, 2) + "\n");
  console.log(`Wrote ${(bracket as unknown[]).length} bracket rows for ${league.name} (${season}) to src/data/sleeper-losers-bracket.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
