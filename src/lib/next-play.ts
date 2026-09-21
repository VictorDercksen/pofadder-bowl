type Challenge = { id: string; sequence: number };
type Submission = { challenge_id: string | null; version: number; status: string };

/** Repair flagged proof first, finish drafts, then follow programme order. Pending proof is read-only. */
export function nextPlay<C extends Challenge>(challenges: C[], submissions: Submission[]): { challenge: C; pending: boolean } | null {
  const latest = new Map<string, Submission>();
  for (const submission of submissions) {
    if (!submission.challenge_id) continue;
    const previous = latest.get(submission.challenge_id);
    if (!previous || submission.version > previous.version) latest.set(submission.challenge_id, submission);
  }
  const rank = (c: C) => {
    const status = latest.get(c.id)?.status;
    return status === "flagged" ? 0 : status === "draft" ? 1 : !status || status === "superseded" ? 2 : status === "submitted" ? 3 : 4;
  };
  const challenge = [...challenges].filter((c) => rank(c) < 4).sort((a, b) => rank(a) - rank(b) || a.sequence - b.sequence)[0];
  return challenge ? { challenge, pending: latest.get(challenge.id)?.status === "submitted" } : null;
}
