"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getLeagueContext } from "@/lib/league";
import { generateProps } from "@/lib/prop-generator";
import type { ActionResult } from "@/lib/actions/feed";

const sideSchema = z.enum(["over", "under", "yes", "no"]);
const resultSchema = z.enum(["over", "under", "yes", "no", "void"]);

function revalidateProps() {
  revalidatePath("/props");
  revalidatePath("/review");
  revalidatePath("/recap");
  revalidatePath("/game-centre");
}

/** Saves or changes the member's side on a prop; the RPC enforces the lock and the side/kind fit. */
export async function savePropPick(input: { propId: string; side: string }): Promise<ActionResult> {
  const parsed = z.object({ propId: z.uuid(), side: sideSchema }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Pick a side on a real prop." };
  const ctx = await getLeagueContext();
  const { error } = await ctx.supabase.rpc("upsert_prop_pick", { p_prop: parsed.data.propId, p_side: parsed.data.side });
  if (error) {
    if (error.message.includes("locked")) return { ok: false, message: "That prop has locked. No late picks." };
    if (error.message.includes("does not fit")) return { ok: false, message: "That side does not fit this prop." };
    return { ok: false, message: error.message };
  }
  revalidateProps();
  return { ok: true, message: "Pick saved. Editable until the board locks." };
}

/** Commissioner settles a locked prop. Re-settling corrects a mistake. */
export async function settleProp(input: { propId: string; result: string }): Promise<ActionResult> {
  const parsed = z.object({ propId: z.uuid(), result: resultSchema }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Choose a result." };
  const ctx = await getLeagueContext();
  if (!ctx.isCommissioner) return { ok: false, message: "Commissioner role required." };
  const { error } = await ctx.supabase.rpc("settle_prop", { p_prop: parsed.data.propId, p_result: parsed.data.result });
  if (error) {
    if (error.message.includes("settles only after")) return { ok: false, message: "Props settle only once the board has locked." };
    return { ok: false, message: error.message };
  }
  revalidateProps();
  return { ok: true, message: parsed.data.result === "void" ? "Prop voided. Nobody scores it." : "Prop settled. Standings updated and the feed has the call." };
}

/** Commissioner builds (or rebuilds) the board from the event programme. Refused once locked or picked. */
export async function generatePropBoard(): Promise<ActionResult> {
  const ctx = await getLeagueContext();
  if (!ctx.isCommissioner) return { ok: false, message: "Commissioner role required." };
  const { data: challenges, error: loadError } = await ctx.supabase.from("challenges").select("sequence, title").eq("event_id", ctx.event.id).order("sequence");
  if (loadError) return { ok: false, message: loadError.message };
  const drafts = generateProps(ctx.event, challenges ?? []);
  const { data: count, error } = await ctx.supabase.rpc("upsert_props", { p_event: ctx.event.id, p_props: drafts });
  if (error) {
    if (error.message.includes("already picked")) return { ok: false, message: "Members have already picked. The board cannot be rewritten." };
    if (error.message.includes("has locked")) return { ok: false, message: "The board has locked." };
    return { ok: false, message: error.message };
  }
  revalidateProps();
  return { ok: true, message: `${count ?? drafts.length} props on the board, generated from the programme. Edit lines in the seed if a number looks off.` };
}
