/**
 * Event-time helpers. Instants are UTC ISO strings; display is in the event timezone.
 */

export type EventTimes = {
  timezone: string;
  departure_at: string;
  away_arrival_at: string;
  return_departure_at: string;
  home_arrival_at: string;
};

export type EventPhase = "pregame" | "q1" | "q2" | "q3" | "q4" | "postgame";

export const QUARTER_LABELS: Record<EventPhase, string> = {
  pregame: "PREGAME",
  q1: "Q1 · BUS",
  q2: "Q2 · RUN",
  q3: "Q3 · TOWN",
  q4: "Q4 · HOME",
  postgame: "FULL TIME",
};

export const PHASE_HEADINGS: Record<EventPhase, string> = {
  pregame: "Kickoff is coming.",
  q1: "The sentence begins.",
  q2: "Pofadder has home advantage.",
  q3: "Pofadder has home advantage.",
  q4: "Homebound. No second bus.",
  postgame: "Sentence served.",
};

/**
 * Phase from configured event dates. Q2 (the run) starts at away arrival; Q3 (town duty)
 * is the 09:30 local checkpoint block, derived as away arrival + 4h45 (04:45 → 09:30);
 * Q4 (homebound) begins at 17:30 local, derived as return departure − 5h.
 */
export function eventPhase(times: EventTimes, now: Date = new Date()): EventPhase {
  const t = now.getTime();
  const dep = Date.parse(times.departure_at);
  const arr = Date.parse(times.away_arrival_at);
  const ret = Date.parse(times.return_departure_at);
  const home = Date.parse(times.home_arrival_at);
  // An unparseable instant must not read as "sentence served": fail closed to pregame.
  if (![dep, arr, ret, home].every(Number.isFinite)) return "pregame";
  const q3 = arr + 4.75 * 3600_000;
  const q4 = ret - 5 * 3600_000;
  if (t < dep) return "pregame";
  if (t < arr) return "q1";
  if (t < q3) return "q2";
  if (t < q4) return "q3";
  if (t < home) return "q4";
  return "postgame";
}

export function quarterNumber(phase: EventPhase): number {
  return { pregame: 0, q1: 1, q2: 2, q3: 3, q4: 4, postgame: 4 }[phase];
}

function toDate(iso: string | Date): Date | null {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return Number.isFinite(d.getTime()) ? d : null;
}

export function formatTime(iso: string | Date, timezone: string): string {
  const d = toDate(iso);
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-ZA", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: timezone }).format(d);
}

export function formatDay(iso: string | Date, timezone: string): string {
  const d = toDate(iso);
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: timezone }).format(d);
}

export function formatDateTime(iso: string | Date, timezone: string): string {
  if (!toDate(iso)) return "—";
  return `${formatDay(iso, timezone)} · ${formatTime(iso, timezone)} SAST`;
}

export function formatLongDate(iso: string | Date, timezone: string): string {
  const d = toDate(iso);
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: timezone }).format(d);
}

/** "11 h 55 m", "3 m", "0 m" or "" when the target has passed. */
export function countdown(targetIso: string, now: Date = new Date()): string {
  const diff = Date.parse(targetIso) - now.getTime();
  if (!Number.isFinite(diff) || diff <= 0) return "";
  const totalMinutes = Math.floor(diff / 60_000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days} d ${hours} h ${minutes} m`;
  if (hours > 0) return `${hours} h ${minutes} m`;
  return `${minutes} m`;
}

/** Age of a timestamp in words, e.g. "4 min ago", "2 h ago". */
export function ageLabel(iso: string, now: Date = new Date()): string {
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return "unknown";
  const diff = Math.max(0, now.getTime() - parsed);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
}

/** Unparseable timestamps count as stale rather than fresh. */
export function isStale(iso: string, maxAgeMinutes = 30, now: Date = new Date()): boolean {
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return true;
  return now.getTime() - parsed > maxAgeMinutes * 60_000;
}

export function secondsToClock(seconds: number): string {
  const total = Number.isFinite(seconds) ? Math.max(0, Math.round(seconds)) : 0;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

/** Current time in ms. Wrapped so server components can read the clock without the purity lint. */
export function nowMs(): number {
  return Date.now();
}
