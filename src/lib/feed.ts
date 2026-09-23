import "server-only";
import { checkQuery } from "@/lib/query-error";
import type { LeagueContext } from "@/lib/league";
import { FEED_PAGE_SIZE, type FeedCursor } from "@/lib/feed-page";

export type FeedPost = {
  id: string;
  kind: string;
  heading: string;
  body: string;
  created_at: string;
  author_id: string | null;
  author_name: string;
  kit_team: string | null;
  kit_number: number;
  reaction_count: number;
  reacted: boolean;
  own: boolean;
};

export type FeedPage = { posts: FeedPost[]; hasMore: boolean };

/**
 * One page of posts (newest first) with author kit and reaction state for the signed-in
 * member. `before` continues from the oldest post already shown; `hasMore` says whether
 * another page exists so the client can offer "Earlier plays".
 *
 * Positional check-ins (`kind = 'checkin'`, written by `record_checkin`) are left out: the map
 * and the "Where's Victor?" panel already show position, so the sideline stays about plays.
 * The filter is applied in the query so paging cursors stay consistent.
 */
export async function loadFeed(ctx: LeagueContext, { limit = FEED_PAGE_SIZE, before }: { limit?: number; before?: FeedCursor | null } = {}): Promise<FeedPage> {
  let query = ctx.supabase
    .from("activity_posts")
    .select("id, kind, heading, body, created_at, author_id")
    .eq("event_id", ctx.event.id)
    .neq("kind", "checkin")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);
  if (before) query = query.or(`created_at.lt.${before.createdAt},and(created_at.eq.${before.createdAt},id.lt.${before.id})`);
  const { data: rows, error } = await query;
  checkQuery(error, "sideline feed");
  if (!rows) throw new Error("The feed is unavailable.");
  const hasMore = rows.length > limit;
  const posts = hasMore ? rows.slice(0, limit) : rows;
  if (posts.length === 0) return { posts: [], hasMore: false };

  const authorIds = Array.from(new Set(posts.map((p) => p.author_id).filter((id): id is string => Boolean(id))));
  const postIds = posts.map((p) => p.id);
  const [{ data: profiles, error: profileError }, { data: reactions, error: reactionError }] = await Promise.all([
    authorIds.length ? ctx.supabase.from("profiles").select("id, display_name, kit_team, kit_number").in("id", authorIds) : Promise.resolve({ data: [] as { id: string; display_name: string; kit_team: string; kit_number: number }[], error: null }),
    ctx.supabase.from("reactions").select("post_id, user_id").in("post_id", postIds),
  ]);
  checkQuery(profileError, "feed profiles");
  checkQuery(reactionError, "feed reactions");
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
  const shaped: FeedPost[] = posts.map((p) => {
    const author = p.author_id ? byId.get(p.author_id) : undefined;
    const rs = (reactions ?? []).filter((r) => r.post_id === p.id);
    return {
      id: p.id,
      kind: p.kind,
      heading: p.heading,
      body: p.body,
      created_at: p.created_at,
      author_id: p.author_id,
      author_name: author?.display_name ?? (p.kind === "system" ? "The League" : "League member"),
      kit_team: author?.kit_team ?? null,
      kit_number: author?.kit_number ?? 9,
      reaction_count: rs.length,
      reacted: rs.some((r) => r.user_id === ctx.user.id),
      own: p.author_id === ctx.user.id,
    };
  });
  return { posts: shaped, hasMore };
}
