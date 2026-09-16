import "server-only";
import type { LeagueContext } from "@/lib/league";
import type { Tables } from "@/lib/database.types";

export type Submission = Tables<"evidence_submissions"> & { files: Tables<"evidence_files">[] };

/** Latest submission per challenge/press prompt for the participant, with files. */
export async function loadSubmissions(ctx: LeagueContext): Promise<Submission[]> {
  const { data } = await ctx.supabase.from("evidence_submissions").select("*, files:evidence_files(*)").eq("event_id", ctx.event.id).order("version", { ascending: false });
  return (data ?? []) as Submission[];
}

export function latestFor(subs: Submission[], key: { challengeId?: string; pressPromptId?: string }): Submission | null {
  return subs.find((s) => (key.challengeId ? s.challenge_id === key.challengeId : s.press_prompt_id === key.pressPromptId)) ?? null;
}

export function statusLabel(s: Submission | null, points?: number): string {
  if (!s) return "Draft · No proof submitted";
  switch (s.status) {
    case "draft":
      return `Draft v${s.version} · not yet submitted`;
    case "submitted":
      return `Submitted v${s.version} · pending review`;
    case "approved":
      return points != null ? `Approved · +${points} points` : "Approved";
    case "flagged":
      return `Flagged v${s.version} · needs more proof`;
    default:
      return `Superseded v${s.version}`;
  }
}
