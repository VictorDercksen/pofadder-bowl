/**
 * Pure helpers for the proof locker. Kept free of `server-only` so they can be unit tested;
 * `src/lib/evidence.ts` re-exports them next to the loaders.
 */

export type SubmissionLike = { challenge_id: string | null; press_prompt_id: string | null; status: string; version: number };

/** Highest version for a challenge or press prompt (the list is expected newest first). */
export function latestFor<S extends SubmissionLike>(subs: S[], key: { challengeId?: string; pressPromptId?: string }): S | null {
  return subs.find((s) => (key.challengeId ? s.challenge_id === key.challengeId : s.press_prompt_id === key.pressPromptId)) ?? null;
}

/** Status line for the participant and commissioners, who can see drafts. */
export function statusLabel(s: SubmissionLike | null, points?: number): string {
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

/**
 * Status line for league members. Drafts never reach them (row-level security hides
 * unsubmitted work), so the empty state reads as "nothing submitted" rather than "draft".
 */
export function leagueStatusLabel(s: SubmissionLike | null, points?: number): string {
  if (!s || s.status === "draft") return "No proof submitted yet";
  switch (s.status) {
    case "submitted":
      return `Submitted v${s.version} · with the commissioner`;
    case "approved":
      return points != null ? `Approved · +${points} points` : "Approved";
    case "flagged":
      return `Flagged v${s.version} · sent back for more proof`;
    default:
      return `Superseded v${s.version}`;
  }
}

/** Short pill text for a submission's status, used on the challenge page. */
export function statusHeading(status: string): string {
  switch (status) {
    case "submitted":
      return "Pending review";
    case "approved":
      return "Approved";
    case "flagged":
      return "Flagged";
    case "superseded":
      return "Superseded";
    default:
      return "Draft";
  }
}
