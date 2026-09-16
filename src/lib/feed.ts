import "server-only";
import type { LeagueContext } from "@/lib/league";

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

/** Latest posts with author kit and reaction state for the signed-in member. */
export async function loadFeed(ctx: LeagueContext, limit = 24): Promise<FeedPost[]> {
  const { data: posts, error } = await ctx.supabase
    .from("activity_posts")
    .select("id, kind, heading, body, created_at, author_id")
    .eq("event_id", ctx.event.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !posts) throw new Error(error?.message ?? "feed unavailable");
  if (posts.length === 0) return [];

  const authorIds = Array.from(new Set(posts.map((p) => p.author_id).filter((id): id is string => Boolean(id))));
  const postIds = posts.map((p) => p.id);
  const [{ data: profiles }, { data: reactions }] = await Promise.all([
    authorIds.length ? ctx.supabase.from("profiles").select("id, display_name, kit_team, kit_number").in("id", authorIds) : Promise.resolve({ data: [] as { id: string; display_name: string; kit_team: string; kit_number: number }[] }),
    ctx.supabase.from("reactions").select("post_id, user_id").in("post_id", postIds),
  ]);
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
  return posts.map((p) => {
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
}
