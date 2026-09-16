import "server-only";

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
  const users = (await usersRes.json()) as Array<{ user_id: string; username?: string | null; display_name?: string; avatar?: string | null; is_owner?: boolean | null; metadata?: { team_name?: string } | null }>;
  return users.map((u) => ({
    user_id: String(u.user_id),
    username: u.username ?? null,
    display_name: (u.display_name ?? u.username ?? "Sleeper user").slice(0, 60),
    team_name: u.metadata?.team_name?.slice(0, 80) ?? null,
    avatar: u.avatar ?? null,
    is_owner: Boolean(u.is_owner),
    season: league.season ?? null,
  }));
}

export function sleeperAvatarUrl(avatar: string | null, thumb = true): string | null {
  if (!avatar || !/^[a-f0-9]{16,64}$/i.test(avatar)) return null;
  return `https://sleepercdn.com/avatars/${thumb ? "thumbs/" : ""}${avatar}`;
}
