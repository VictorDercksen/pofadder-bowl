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
