"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getLeagueContext } from "@/lib/league";

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
    heading: "From the locker room",
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
