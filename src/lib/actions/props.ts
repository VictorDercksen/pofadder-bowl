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

const picksSchema = z.object({
  picks: z.array(z.object({ propId: z.uuid(), side: sideSchema })).min(1, "Pick a side first.").max(100),
});

function pickError(message: string): string {
  if (message.includes("locked")) return "locked";
  if (message.includes("does not fit")) return "side does not fit";
  return message;
}

/**
 * Saves the member's changed sides in one go, from the board's Save button. Each pick still goes
 * through upsert_prop_pick, so the lock and the side/kind fit are enforced per prop; one refused
 * pick does not undo the others, and the message names what was refused.
 */
export async function savePropPicks(input: { picks: { propId: string; side: string }[] }): Promise<ActionResult> {
  const parsed = picksSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Pick a side on a real prop." };
  const picks = Array.from(new Map(parsed.data.picks.map((k) => [k.propId, k])).values());
  const ctx = await getLeagueContext();
  const results = await Promise.all(
    picks.map(async (k) => {
      const { error } = await ctx.supabase.rpc("upsert_prop_pick", { p_prop: k.propId, p_side: k.side });
      return error ? pickError(error.message) : null;
    }),
  );
  const failed = results.filter((r): r is string => r != null);
  const saved = results.length - failed.length;
  if (saved > 0) revalidateProps();
  if (failed.length === 0) {
    return { ok: true, message: saved === 1 ? "Pick saved. Editable until the board locks." : `${saved} picks saved. Editable until the board locks.` };
  }
  const reason = failed.every((r) => r === "locked") ? "That prop has locked. No late picks." : failed.every((r) => r === "side does not fit") ? "That side does not fit this prop." : failed[0];
  return { ok: false, message: saved > 0 ? `${saved} saved, ${failed.length} refused. ${reason}` : reason };
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
