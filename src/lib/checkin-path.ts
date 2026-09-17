/** Pure helpers for plotting check-ins. No server-only imports so they can be unit tested. */

export type PathPoint = { latitude: number; longitude: number; captured_at: string };

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
    .sort((a, b) => Date.parse(a.captured_at) - Date.parse(b.captured_at))
    .map((c) => [c.latitude, c.longitude]);
}
