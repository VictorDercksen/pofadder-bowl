import "server-only";
import { cache } from "react";
import type { LeagueContext } from "@/lib/league";
import { TEAM_BY_CODE } from "@/lib/nfl";

/**
 * Franchise codes claimed by members who have signed on, one per member, in a stable
 * order (by member name). The header strip shows these instead of a fixed set of logos.
 * Cached per request: the layout and any page can ask without a second round trip.
 */
export const loadClaimedTeams = cache(async (ctx: LeagueContext): Promise<string[]> => {
  const { data } = await ctx.supabase.rpc("claimed_kits");
  const rows = (data ?? []).filter((r) => r.kit_team && TEAM_BY_CODE[r.kit_team.toLowerCase()]);
  rows.sort((a, b) => a.display_name.localeCompare(b.display_name));
  return [...new Set(rows.map((r) => r.kit_team.toLowerCase()))];
});
