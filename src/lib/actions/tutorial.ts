"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getLeagueContextRaw } from "@/lib/league";
import type { ActionResult } from "@/lib/actions/feed";

/**
 * Marks the first-run tour as done for the signed-in member (finished or skipped). The
 * layout stops auto-starting it once profiles.tutorial_completed_at is set; the tour stays
 * available to replay from League access.
 */
export async function completeTutorial(input: { version: number }): Promise<ActionResult> {
  const parsed = z.object({ version: z.number().int().min(1).max(32767) }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid tour version." };
  const ctx = await getLeagueContextRaw();
  const { error } = await ctx.supabase.from("profiles").update({ tutorial_completed_at: new Date().toISOString(), tutorial_version: parsed.data.version }).eq("id", ctx.user.id);
  if (error) return { ok: false, message: "Could not record the tour." };
  revalidatePath("/", "layout");
  return { ok: true, message: "Tour recorded." };
}
