/**
 * Pure helper for the three photo slots on the final-whistle certificate. Each slot names a
 * moment of the trip and is matched to a challenge by what it asks for, not by its number, so
 * re-ordering the programme does not silently point a slot at the wrong play.
 */
export type SlotChallenge = { id: string; sequence: number; title: string; proof_type: string };

export const PHOTO_SLOTS = ["THE ARRIVAL", "THE RUN", "THE RETURN"] as const;

const MATCHERS: ((c: SlotChallenge) => boolean)[] = [
  // The arrival: the welcome sign in the dark, the first proof in Pofadder.
  (c) => /welcome sign/i.test(c.title) && /dark|arrival/i.test(c.title),
  // The run: the watch export.
  (c) => /export/i.test(c.proof_type),
  // The return: boarding the bus home (the 22:30 out of Pofadder), not the outbound boarding.
  (c) => /boarding/i.test(c.title) && /22:30|home|return/i.test(c.title),
];

/** The challenge whose approved proof fills slot `index` (0 = arrival, 1 = run, 2 = return). */
export function photoSlotChallenge<T extends SlotChallenge>(challenges: readonly T[], index: number): T | undefined {
  const match = MATCHERS[index];
  if (!match) return undefined;
  const hit = challenges.find(match);
  if (hit) return hit;
  // Fallback: the last boarding challenge for the return, otherwise the slot's usual sequence.
  if (index === 2) return [...challenges].reverse().find((c) => /boarding/i.test(c.title));
  return undefined;
}
