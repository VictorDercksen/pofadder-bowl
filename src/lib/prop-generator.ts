/**
 * Builds the prop board from the event programme, so a commissioner can generate it in
 * the app instead of running the seed. Lines are derived from the event and its challenges
 * where the data allows; the rest are fixed house lines. Pure; mirrors supabase/seed.sql.
 */
import type { PropKind } from "@/lib/props";

export type PropSourceEvent = {
  required_run_km: number;
  departure_at: string;
  away_arrival_at: string;
  return_departure_at: string;
  timezone: string;
};
export type PropSourceChallenge = { sequence: number; title: string };
export type PropDraft = { sequence: number; title: string; detail: string; kind: PropKind; line: number | null; unit: string | null; locks_at: string };

const WORD_NUMBERS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };

function find(challenges: PropSourceChallenge[], ...needles: string[]): PropSourceChallenge | undefined {
  return challenges.find((c) => needles.every((n) => c.title.toLowerCase().includes(n)));
}

function clockIn(iso: string, timezone: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  try {
    return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: timezone }).format(t);
  } catch {
    return "";
  }
}

/** Number of locals a challenge asks for ("Three locals asked…" → 3), or null. */
export function localsCount(title: string): number | null {
  const m = title.toLowerCase().match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+locals?\b/);
  if (!m) return null;
  return WORD_NUMBERS[m[1]] ?? Number(m[1]);
}

/** Rand amount a spending challenge names ("R50 spent…" → 50), or null. Road numbers like R358 are ignored. */
export function randAmount(title: string): number | null {
  if (!/\bspen[dt]/i.test(title)) return null;
  const m = title.match(/\bR\s?(\d+(?:[.,]\d+)?)\b/);
  return m ? Number(m[1].replace(",", ".")) : null;
}

/** Ten props for the event. Deterministic for the same programme. */
export function generateProps(event: PropSourceEvent, challenges: PropSourceChallenge[]): PropDraft[] {
  const locks_at = event.away_arrival_at;
  const arrive = clockIn(event.away_arrival_at, event.timezone);
  const depart = clockIn(event.return_departure_at, event.timezone);
  const runKm = Number.isFinite(event.required_run_km) && event.required_run_km > 0 ? event.required_run_km : 10;
  const combo = find(challenges, "combo") ?? find(challenges, "rib") ?? find(challenges, "meal");
  const locals = challenges.find((c) => localsCount(c.title) != null);
  const localsN = locals ? localsCount(locals.title)! : 3;
  const speech = find(challenges, "speech");
  const receipt = challenges.find((c) => randAmount(c.title) != null);
  const rand = receipt ? randAmount(receipt.title)! : 50;
  const total = challenges.length || 10;

  const drafts: Omit<PropDraft, "locks_at">[] = [
    {
      sequence: 1,
      title: "Watch distance on the approved run trace",
      detail: `The distance on the GPS export the commissioner approves for the ${runKm} km run.`,
      kind: "over_under",
      line: Math.round((runKm + 0.25) * 100) / 100,
      unit: "km",
    },
    {
      sequence: 2,
      title: "Minutes the bus arrives late at the away stop",
      detail: `Scheduled ${arrive || "arrival"}. Settled from the arrival check-in or the night sign photo timestamp.`,
      kind: "over_under",
      line: 20,
      unit: "min late",
    },
    {
      sequence: 3,
      title: combo ? `${capitalise(stripRating(combo.title))} finished on camera` : "The rated meal finished on camera",
      detail: "Plate clean in the rating clip. Bones do not count as leftovers.",
      kind: "yes_no",
      line: null,
      unit: null,
    },
    {
      sequence: 4,
      title: `Locals approached before ${localsN} agree to be filmed`,
      detail: "Victor keeps the tally and states it in the last clip. Commissioner may audit the footage.",
      kind: "over_under",
      line: localsN + 1.5,
      unit: "locals",
    },
    {
      sequence: 5,
      title: "Proof challenges approved by the final whistle",
      detail: `Out of ${total}. Counted from the commissioner scoreboard when the certificate is issued.`,
      kind: "over_under",
      line: total - 1.5,
      unit: "approved",
    },
    {
      sequence: 6,
      title: "Sideline feed comments before the sunset speech",
      detail: "Member comments on the feed posted before the sunset speech opens. System posts and reactions excluded.",
      kind: "over_under",
      line: 60.5,
      unit: "comments",
    },
    {
      sequence: 7,
      title: "Map check-ins over the whole trip",
      detail: "Every check-in on the map between departure and arrival home.",
      kind: "over_under",
      line: 15.5,
      unit: "check-ins",
    },
    {
      sequence: 8,
      title: speech ? `Length of the ${lowerFirst(speech.title)}` : "Length of the sunset speech",
      detail: "Duration of the approved clip, first word to last.",
      kind: "over_under",
      line: 90,
      unit: "seconds",
    },
    {
      sequence: 9,
      title: "Rand spent in town on receipts",
      detail: `Total of every receipt submitted as proof, including the R${rand} challenge.`,
      kind: "over_under",
      line: rand * 3,
      unit: "rand",
    },
    {
      sequence: 10,
      title: `The ${depart || "return"} bus leaves within 15 minutes of schedule`,
      detail: "Settled from the boarding clip and the departure check-in.",
      kind: "yes_no",
      line: null,
      unit: null,
    },
  ];
  return drafts.map((d) => ({ ...d, locks_at }));
}

function stripRating(title: string): string {
  return title.replace(/,?\s*rated (out of|\/)\s*(ten|10).*$/i, "").trim();
}
function capitalise(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
function lowerFirst(s: string): string {
  return s ? s[0].toLowerCase() + s.slice(1) : s;
}
