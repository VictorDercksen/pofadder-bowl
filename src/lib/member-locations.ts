/**
 * Pure helpers for league members' shared positions. A member shares one pin (the latest
 * position, upserted by `share_member_location`); only the participant's check-ins form a
 * route. No server-only imports so the module can be unit tested.
 */
import { placeLabel } from "@/lib/places";

export type MemberLocation = {
  user_id: string;
  display_name: string;
  kit_team: string | null;
  latitude: number;
  longitude: number;
  accuracy_m: number | null;
  place_label: string | null;
  captured_at: string;
  updated_at: string;
};

/** A member pin older than this is drawn faded: the member has probably moved on. */
export const MEMBER_PIN_STALE_MS = 6 * 60 * 60_000;

/** A pin older than this is not plotted at all (the list still shows it). */
export const MEMBER_PIN_MAX_AGE_MS = 3 * 24 * 60 * 60_000;

export type MemberPin = {
  id: string;
  latitude: number;
  longitude: number;
  label: string;
  kind: "member";
  team: string | null;
  name: string;
  stale: boolean;
};

export function memberPinAgeMs(row: Pick<MemberLocation, "captured_at">, now: Date = new Date()): number {
  const parsed = Date.parse(row.captured_at);
  if (!Number.isFinite(parsed)) return Number.POSITIVE_INFINITY;
  return Math.max(0, now.getTime() - parsed);
}

export function isMemberPinStale(row: Pick<MemberLocation, "captured_at">, now: Date = new Date()): boolean {
  return memberPinAgeMs(row, now) > MEMBER_PIN_STALE_MS;
}

/**
 * Pins for the map: one per member with a plottable position, newest first, the label
 * pre-formatted by the caller's clock (`timeLabel`) so client and server agree. Pins beyond
 * `MEMBER_PIN_MAX_AGE_MS` are dropped; the list panel still names them.
 */
export function memberPins(rows: MemberLocation[], timeLabel: (iso: string) => string, now: Date = new Date()): MemberPin[] {
  return rows
    .filter((r) => Number.isFinite(r.latitude) && Number.isFinite(r.longitude))
    .filter((r) => memberPinAgeMs(r, now) <= MEMBER_PIN_MAX_AGE_MS)
    .sort((a, b) => Date.parse(b.captured_at) - Date.parse(a.captured_at))
    .map((r) => ({
      id: `member:${r.user_id}`,
      latitude: r.latitude,
      longitude: r.longitude,
      label: `${r.display_name} · ${placeLabel(r)} · ${timeLabel(r.captured_at)}`,
      kind: "member" as const,
      team: r.kit_team,
      name: r.display_name,
      stale: isMemberPinStale(r, now),
    }));
}

/** Short initials for the pin when a member has no kit yet ("Theo Smit" → "TS"). */
export function memberInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return `${first}${last}`.toUpperCase();
}
