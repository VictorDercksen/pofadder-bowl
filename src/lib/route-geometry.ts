/**
 * Pure helpers for drawing the check-in path along real roads. No server-only or
 * browser imports so the logic is unit testable. The map asks a routing service
 * (OSRM by default) for the road between each pair of consecutive check-ins and
 * stitches the answers into one line; any leg the service cannot route stays a
 * straight line so the map never goes blank.
 */

export type LatLng = [number, number];

/** A leg between two consecutive check-ins. */
export type RouteSegment = { key: string; from: LatLng; to: LatLng };

/** Routed geometry for a leg, or null when the leg has to stay a straight line. */
export type SegmentGeometry = LatLng[] | null;

/** Six decimals is roughly 10 cm: precise enough to identify a leg, coarse enough to share a cache entry. */
const KEY_PRECISION = 6;

/** Legs shorter than this are drawn straight; a road query would only snap to the same kerb twice. */
export const MIN_ROUTE_METRES = 30;

/** A waypoint the router had to move further than this is not on a road we trust; keep the straight line. */
export const MAX_SNAP_METRES = 5000;

function round(value: number): number {
  return Number(value.toFixed(KEY_PRECISION));
}

function pointKey(p: LatLng): string {
  return `${round(p[0])},${round(p[1])}`;
}

/** Stable identifier for a leg (used as the cache key on both the client and the server). */
export function segmentKey(from: LatLng, to: LatLng): string {
  return `${pointKey(from)};${pointKey(to)}`;
}

/** Straight-line distance in metres between two coordinates (haversine). */
export function distanceMetres(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/**
 * Splits a check-in path (oldest first) into the legs worth routing. Legs shorter than
 * MIN_ROUTE_METRES are left out: they are drawn straight without a request.
 */
export function routeSegments(path: readonly LatLng[]): RouteSegment[] {
  const segments: RouteSegment[] = [];
  for (let i = 1; i < path.length; i++) {
    const from = path[i - 1];
    const to = path[i];
    if (distanceMetres(from, to) < MIN_ROUTE_METRES) continue;
    segments.push({ key: segmentKey(from, to), from, to });
  }
  return segments;
}

/**
 * Builds the line to draw: routed geometry where the lookup has it, the straight leg
 * elsewhere. Every leg starts and ends exactly on its check-ins so the line always
 * touches the pins even when the router snapped the ends to the nearest road.
 */
export function stitchRoute(path: readonly LatLng[], lookup: (key: string) => SegmentGeometry | undefined): LatLng[] {
  if (path.length === 0) return [];
  const out: LatLng[] = [path[0]];
  for (let i = 1; i < path.length; i++) {
    const from = path[i - 1];
    const to = path[i];
    const routed = distanceMetres(from, to) >= MIN_ROUTE_METRES ? lookup(segmentKey(from, to)) : undefined;
    if (routed && routed.length > 0) {
      for (const p of routed) {
        const last = out[out.length - 1];
        if (last[0] !== p[0] || last[1] !== p[1]) out.push(p);
      }
    }
    const last = out[out.length - 1];
    if (last[0] !== to[0] || last[1] !== to[1]) out.push(to);
  }
  return out;
}

/** Serialises a path so React effects can depend on a string instead of a fresh array. */
export function pathKey(path: readonly LatLng[]): string {
  return path.map(pointKey).join("|");
}

/** Inverse of pathKey. */
export function parsePathKey(key: string): LatLng[] {
  if (!key) return [];
  return key.split("|").map((pair) => {
    const [lat, lng] = pair.split(",").map(Number);
    return [lat, lng] as LatLng;
  });
}

/** Parses a `lat,lng` query value; null unless both numbers are finite and in range. */
export function parseCoordinate(value: string | null | undefined): LatLng | null {
  if (!value) return null;
  const parts = value.split(",");
  if (parts.length !== 2) return null;
  const lat = Number(parts[0].trim());
  const lng = Number(parts[1].trim());
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return [lat, lng];
}

/** Query value for parseCoordinate. */
export function coordinateParam(p: LatLng): string {
  return `${round(p[0])},${round(p[1])}`;
}

/** OSRM route request for one leg: full GeoJSON geometry, no turn-by-turn steps. */
export function osrmRouteUrl(base: string, from: LatLng, to: LatLng): string {
  const root = base.replace(/\/+$/, "");
  return `${root}/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson&steps=false&alternatives=false`;
}

type OsrmResponse = {
  code?: string;
  routes?: { geometry?: { coordinates?: unknown } }[];
  waypoints?: { distance?: unknown }[];
};

/**
 * Reads the first route out of an OSRM response as [lat, lng] pairs. Returns null when
 * the service found no road, a waypoint had to be snapped further than MAX_SNAP_METRES,
 * or the payload is not shaped like an OSRM answer.
 */
export function parseOsrmRoute(payload: unknown): SegmentGeometry {
  if (!payload || typeof payload !== "object") return null;
  const body = payload as OsrmResponse;
  if (body.code !== "Ok") return null;
  const coords = body.routes?.[0]?.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  for (const wp of body.waypoints ?? []) {
    if (typeof wp?.distance === "number" && wp.distance > MAX_SNAP_METRES) return null;
  }
  const out: LatLng[] = [];
  for (const c of coords) {
    if (!Array.isArray(c) || c.length < 2) return null;
    const lng = Number(c[0]);
    const lat = Number(c[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    out.push([lat, lng]);
  }
  return out;
}

/**
 * Validates a segment payload coming back from our own /api/map-route handler.
 * Anything malformed reads as "no route" rather than a crash in the map.
 */
export function parseSegmentResponse(payload: unknown): SegmentGeometry {
  if (!payload || typeof payload !== "object") return null;
  const coords = (payload as { coordinates?: unknown }).coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const out: LatLng[] = [];
  for (const c of coords) {
    if (!Array.isArray(c) || c.length !== 2) return null;
    const lat = Number(c[0]);
    const lng = Number(c[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    out.push([lat, lng]);
  }
  return out;
}
