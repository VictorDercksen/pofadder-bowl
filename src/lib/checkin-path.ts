/** Pure helpers for plotting check-ins. No server-only imports so they can be unit tested. */

export type PathPoint = { latitude: number; longitude: number; captured_at: string; received_at?: string | null; id?: string };

export function validCoordinate(p: { latitude: number; longitude: number }): boolean {
  return Number.isFinite(p.latitude) && Number.isFinite(p.longitude) && Math.abs(p.latitude) <= 90 && Math.abs(p.longitude) <= 180;
}

/**
 * The line drawn through the participant's check-ins, oldest to newest, so the map shows
 * the route travelled. Accepts check-ins in any order (the loaders return newest first).
 */
export function checkinPath<T extends PathPoint>(checkins: readonly T[]): [number, number][] {
  return [...checkins]
    .filter(validCoordinate)
    .sort((a, b) => Date.parse(a.captured_at) - Date.parse(b.captured_at) || Date.parse(a.received_at ?? "") - Date.parse(b.received_at ?? "") || (a.id ?? "").localeCompare(b.id ?? ""))
    .map((c) => [c.latitude, c.longitude]);
}
