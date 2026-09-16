"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getLeagueContext } from "@/lib/league";
import type { ActionResult } from "@/lib/actions/feed";

export async function proposeIncident(input: { squareId: string; note?: string }): Promise<ActionResult> {
  const parsed = z.object({ squareId: z.string().uuid(), note: z.string().max(300).optional() }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid square." };
  const ctx = await getLeagueContext();
  const { error } = await ctx.supabase.rpc("propose_bingo_incident", { p_event: ctx.event.id, p_square: parsed.data.squareId, p_note: parsed.data.note });
  if (error) return { ok: false, message: error.code === "23505" ? "That square is already confirmed." : error.message };
  revalidatePath("/bingo");
  revalidatePath("/review");
  return { ok: true, message: "Incident proposed. A commissioner has to confirm it before cards update." };
}
