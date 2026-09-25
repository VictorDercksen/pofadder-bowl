"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getLeagueContext } from "@/lib/league";
import { createAdminClient } from "@/lib/supabase/admin";
import { testingResetEnabled } from "@/lib/env";
import type { ActionResult } from "@/lib/actions/feed";

const BUCKET = "evidence";
const REMOVE_BATCH = 100;

export type ResetResult = ActionResult & { counts?: Record<string, number> };

/**
 * Testing deployments only: wipe every piece of activity for the configured event and put
 * the programme back to its seeded state (see reset_event_data in the migration). Refuses
 * unless PB_TESTING_RESET is on for this server, the caller is an admin, and the typed
 * confirmation matches the event slug. Storage objects are removed afterwards through the
 * storage API with the service-role client; the database rows are already gone by then, so
 * a storage failure only leaves orphaned files, which the message reports.
 */
export async function resetTestingData(input: { confirm: string; resetTours: boolean }): Promise<ResetResult> {
  const parsed = z.object({ confirm: z.string().trim().max(60), resetTours: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid reset request." };
  if (!testingResetEnabled()) return { ok: false, message: "The reset is only available on the testing deployment (PB_TESTING_RESET)." };
  const ctx = await getLeagueContext();
  if (!ctx.isAdmin) return { ok: false, message: "Admin role required." };
  if (parsed.data.confirm !== ctx.event.slug) return { ok: false, message: `Type the event slug (${ctx.event.slug}) to confirm.` };

  const { data, error } = await ctx.supabase.rpc("reset_event_data", { p_event: ctx.event.id, p_confirm_slug: parsed.data.confirm, p_reset_tours: parsed.data.resetTours });
  if (error) return { ok: false, message: error.message };
  // Props and slips are back to unsettled, so resolution closes again (the Review button reopens it).
  const { error: closeError } = await ctx.supabase.rpc("set_resolution_open", { p_event: ctx.event.id, p_open: false });
  const result = (data ?? {}) as Record<string, unknown>;
  const paths = Array.isArray(result.storage_paths) ? (result.storage_paths as string[]) : [];
  const counts: Record<string, number> = {};
  for (const [key, value] of Object.entries(result)) if (typeof value === "number") counts[key] = value;

  let storageNote = "";
  if (paths.length) {
    try {
      const admin = createAdminClient();
      let failed = 0;
      for (let i = 0; i < paths.length; i += REMOVE_BATCH) {
        const { error: removeError } = await admin.storage.from(BUCKET).remove(paths.slice(i, i + REMOVE_BATCH));
        if (removeError) failed += Math.min(REMOVE_BATCH, paths.length - i);
      }
      counts.files = paths.length - failed;
      storageNote = failed ? ` ${failed} storage object(s) could not be removed and are now orphaned.` : "";
    } catch {
      storageNote = ` ${paths.length} storage object(s) were left in place: SUPABASE_SECRET_KEY is not configured on this server.`;
    }
  }

  revalidatePath("/", "layout");
  const summary = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([key, n]) => `${n} ${key.replace(/_/g, " ")}`)
    .join(", ");
  const closeNote = closeError ? ` Resolution could not be closed: ${closeError.message}` : "";
  return { ok: true, counts, message: `Event reset.${summary ? ` Removed ${summary}.` : " Nothing to remove."}${storageNote}${closeNote}` };
}
