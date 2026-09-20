import "server-only";
import type { LeagueContext } from "@/lib/league";
import type { Tables } from "@/lib/database.types";

export { latestFor, leagueStatusLabel, statusHeading, statusLabel } from "@/lib/evidence-status";

export type Submission = Tables<"evidence_submissions"> & { files: Tables<"evidence_files">[] };

/**
 * Latest submission per challenge/press prompt for the participant, with files.
 * Row-level security decides what comes back: the participant and commissioners see
 * drafts too, league members only see submitted, approved, flagged and superseded versions.
 */
export async function loadSubmissions(ctx: LeagueContext): Promise<Submission[]> {
  const { data } = await ctx.supabase.from("evidence_submissions").select("*, files:evidence_files(*)").eq("event_id", ctx.event.id).order("version", { ascending: false });
  return (data ?? []) as Submission[];
}

export type ParticipantProfile = { id: string; display_name: string; kit_team: string | null; kit_number: number | null };

/** The event participant's name and kit, for screens that show their locker to the league. */
export async function loadParticipantProfile(ctx: LeagueContext): Promise<ParticipantProfile | null> {
  if (!ctx.event.participant_user_id) return null;
  const { data } = await ctx.supabase.from("profiles").select("id, display_name, kit_team, kit_number").eq("id", ctx.event.participant_user_id).maybeSingle();
  return data ?? null;
}
