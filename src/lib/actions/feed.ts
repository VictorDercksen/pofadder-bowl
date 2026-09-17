"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getLeagueContext } from "@/lib/league";
import { loadFeed, type FeedPost } from "@/lib/feed";
import { FEED_PAGE_SIZE } from "@/lib/feed-page";

export type ActionResult = { ok: true; message?: string } | { ok: false; message: string };

const commentSchema = z.object({ body: z.string().trim().min(1, "Write a comment first.").max(1000) });

/** Any active member may add a comment to the sideline feed. */
export async function postComment(input: { body: string }): Promise<ActionResult> {
  const parsed = commentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid comment." };
  const ctx = await getLeagueContext();
  const { error } = await ctx.supabase.from("activity_posts").insert({
    event_id: ctx.event.id,
    author_id: ctx.user.id,
    kind: "comment",
    heading: "League comment",
    body: parsed.data.body,
  });
  if (error) return { ok: false, message: "Could not post the comment. Try again." };
  revalidatePath("/game-centre");
  return { ok: true, message: "Comment posted to the sideline." };
}

/** One reaction per member per post; calling again removes it. Returns the new state. */
export async function toggleReaction(input: { postId: string }): Promise<ActionResult & { pressed?: boolean }> {
  const postId = z.string().uuid().safeParse(input.postId);
  if (!postId.success) return { ok: false, message: "Invalid post." };
  const ctx = await getLeagueContext();
  const { data: existing } = await ctx.supabase.from("reactions").select("post_id").eq("post_id", postId.data).eq("user_id", ctx.user.id).maybeSingle();
  if (existing) {
    const { error } = await ctx.supabase.from("reactions").delete().eq("post_id", postId.data).eq("user_id", ctx.user.id);
    if (error) return { ok: false, message: "Could not remove the reaction." };
    return { ok: true, pressed: false };
  }
  const { error } = await ctx.supabase.from("reactions").insert({ post_id: postId.data, user_id: ctx.user.id });
  if (error) {
    if (error.code === "23505") return { ok: true, pressed: true };
    return { ok: false, message: "Could not add the reaction." };
  }
  return { ok: true, pressed: true };
}

export async function deleteOwnComment(input: { postId: string }): Promise<ActionResult> {
  const postId = z.string().uuid().safeParse(input.postId);
  if (!postId.success) return { ok: false, message: "Invalid post." };
  const ctx = await getLeagueContext();
  const { error } = await ctx.supabase.from("activity_posts").delete().eq("id", postId.data).eq("author_id", ctx.user.id).eq("kind", "comment");
  if (error) return { ok: false, message: "Could not delete the comment." };
  revalidatePath("/game-centre");
  return { ok: true };
}

const olderSchema = z.object({ before: z.object({ createdAt: z.iso.datetime({ offset: true }), id: z.uuid() }) });

/** Next page of older sideline posts for "Earlier plays". Any active member; RLS scopes the rows. */
export async function loadOlderPosts(input: { before: { createdAt: string; id: string } }): Promise<ActionResult & { posts?: FeedPost[]; hasMore?: boolean }> {
  const parsed = olderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Could not work out where the feed left off. Refresh and try again." };
  const ctx = await getLeagueContext();
  try {
    const page = await loadFeed(ctx, { limit: FEED_PAGE_SIZE, before: parsed.data.before });
    return { ok: true, posts: page.posts, hasMore: page.hasMore };
  } catch {
    return { ok: false, message: "Could not load earlier plays. Try again." };
  }
}
