/**
 * Pure helpers for showing where a check-in is. The label itself ("10 km N of Malmesbury",
 * "In Pofadder") is computed once in Postgres from the settlements gazetteer when the
 * check-in is recorded (`record_checkin` → `pb_place_label`) and stored on the row. These
 * helpers only decide what to print when that label is missing (rows older than the
 * gazetteer, or a position outside South Africa). No server-only imports so they can be
 * unit tested.
 */

export type PlacedPoint = { latitude: number; longitude: number; place_label?: string | null };

/** Coordinates as a last resort, four decimals (about 10 m), never NaN. */
export function formatCoordinates(p: { latitude: number; longitude: number }): string {
  if (!Number.isFinite(p.latitude) || !Number.isFinite(p.longitude)) return "Position unknown";
  return `${p.latitude.toFixed(4)}, ${p.longitude.toFixed(4)}`;
}

/** The stored place label, or the coordinates when there is none. */
export function placeLabel(p: PlacedPoint): string {
  const label = p.place_label?.trim();
  return label ? label : formatCoordinates(p);
}
