/**
 * Pure parser for watch exports (GPX and TCX) so the league can see the run as a line on
 * the map. No DOM, no server-only imports: the trusted side calls it on a downloaded
 * evidence file and the result is unit tested here. FIT is binary and is not parsed.
 */

export type LatLng = [number, number];

export type TrackPoint = { lat: number; lng: number; ele: number | null; time: number | null };

export type TrackStats = {
  /** Points in the file before thinning. */
  points: number;
  distanceKm: number;
  /** First to last timestamp, or null when the file carries no usable times. */
  durationSeconds: number | null;
  paceSecondsPerKm: number | null;
  /** Sum of climbs, or null when no elevation was recorded. */
  elevationGainM: number | null;
  startedAt: string | null;
  finishedAt: string | null;
};

export type Track = {
  /** The line to draw, oldest to newest, thinned to MAX_TRACK_POINTS. */
  line: LatLng[];
  stats: TrackStats;
};

/** Leaflet copes with far more, but a thinned line keeps the page payload small on a phone. */
export const MAX_TRACK_POINTS = 1500;

/** Climbs shorter than this are GPS noise, not a hill. */
const CLIMB_HYSTERESIS_M = 3;

const TRACK_EXT = [".gpx", ".tcx"];

/** True for files this module can read (by name, then by media type). */
export function isTrackFile(fileName: string | null | undefined, mimeType?: string | null): boolean {
  const lower = (fileName ?? "").toLowerCase();
  if (TRACK_EXT.some((ext) => lower.endsWith(ext))) return true;
  const mt = (mimeType ?? "").toLowerCase();
  return mt === "application/gpx+xml" || mt === "application/vnd.garmin.tcx+xml";
}

function num(value: string | undefined | null): number | null {
  if (value == null) return null;
  const n = Number(value.trim());
  return Number.isFinite(n) ? n : null;
}

function inner(tag: string, xml: string): string | null {
  const m = new RegExp(`<${tag}(?:\\s[^>]*)?>([^<]*)</${tag}>`, "i").exec(xml);
  return m ? m[1] : null;
}

function attr(name: string, attrs: string): string | null {
  const m = new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i").exec(attrs);
  return m ? m[1] : null;
}

function validPoint(lat: number | null, lng: number | null): lat is number {
  return lat != null && lng != null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
}

function parseTime(value: string | null): number | null {
  if (!value) return null;
  const t = Date.parse(value.trim());
  return Number.isFinite(t) ? t : null;
}

/** GPX track points (<trkpt>), falling back to route points (<rtept>) for a planned route. */
function parseGpxPoints(xml: string): TrackPoint[] {
  for (const tag of ["trkpt", "rtept"]) {
    const re = new RegExp(`<${tag}\\b([^>]*?)(?:/>|>([\\s\\S]*?)</${tag}>)`, "gi");
    const out: TrackPoint[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(xml))) {
      const lat = num(attr("lat", m[1]));
      const lng = num(attr("lon", m[1]));
      if (!validPoint(lat, lng)) continue;
      const body = m[2] ?? "";
      out.push({ lat, lng: lng as number, ele: num(inner("ele", body)), time: parseTime(inner("time", body)) });
    }
    if (out.length > 0) return out;
  }
  return [];
}

/** TCX track points: <Trackpoint> with a <Position> block; points without a position (tunnels, pauses) are skipped. */
function parseTcxPoints(xml: string): TrackPoint[] {
  const re = /<Trackpoint\b[^>]*>([\s\S]*?)<\/Trackpoint>/gi;
  const out: TrackPoint[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const body = m[1];
    const lat = num(inner("LatitudeDegrees", body));
    const lng = num(inner("LongitudeDegrees", body));
    if (!validPoint(lat, lng)) continue;
    out.push({ lat, lng: lng as number, ele: num(inner("AltitudeMeters", body)), time: parseTime(inner("Time", body)) });
  }
  return out;
}

/** Straight-line distance in metres (haversine). */
export function distanceMetres(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Keeps every n-th point plus the last one so a long trace stays a light line. */
export function thinTrack(points: readonly LatLng[], max = MAX_TRACK_POINTS): LatLng[] {
  if (points.length <= max || max < 2) return [...points];
  const stride = Math.ceil((points.length - 1) / (max - 1));
  const out: LatLng[] = [];
  for (let i = 0; i < points.length; i += stride) out.push(points[i]);
  const last = points[points.length - 1];
  const tail = out[out.length - 1];
  if (tail[0] !== last[0] || tail[1] !== last[1]) out.push(last);
  return out;
}

export function trackStats(points: readonly TrackPoint[]): TrackStats {
  let metres = 0;
  let gain = 0;
  let sawEle = false;
  let base: number | null = null;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (i > 0) metres += distanceMetres([points[i - 1].lat, points[i - 1].lng], [p.lat, p.lng]);
    if (p.ele != null) {
      sawEle = true;
      if (base == null) base = p.ele;
      else if (p.ele - base >= CLIMB_HYSTERESIS_M) {
        gain += p.ele - base;
        base = p.ele;
      } else if (p.ele < base) base = p.ele;
    }
  }
  const times = points.map((p) => p.time).filter((t): t is number => t != null);
  const first = times.length ? Math.min(...times) : null;
  const last = times.length ? Math.max(...times) : null;
  const duration = first != null && last != null && last > first ? Math.round((last - first) / 1000) : null;
  const km = metres / 1000;
  return {
    points: points.length,
    distanceKm: Math.round(km * 100) / 100,
    durationSeconds: duration,
    paceSecondsPerKm: duration != null && km >= 0.1 ? Math.round(duration / km) : null,
    elevationGainM: sawEle ? Math.round(gain) : null,
    startedAt: first != null ? new Date(first).toISOString() : null,
    finishedAt: last != null ? new Date(last).toISOString() : null,
  };
}

/** Parses a GPX or TCX document. Null when it holds no usable positions. */
export function parseTrack(text: string): Track | null {
  if (!text) return null;
  const head = text.slice(0, 4000);
  const points = /<TrainingCenterDatabase\b/i.test(head) || (/<Trackpoint\b/i.test(text) && !/<trkpt\b/i.test(text)) ? parseTcxPoints(text) : parseGpxPoints(text);
  if (points.length === 0) return null;
  return { line: thinTrack(points.map((p) => [p.lat, p.lng] as LatLng)), stats: trackStats(points) };
}

/** "5:42 /km" or "" when pace is unknown. */
export function formatPace(secondsPerKm: number | null): string {
  if (secondsPerKm == null || !Number.isFinite(secondsPerKm) || secondsPerKm <= 0) return "";
  const m = Math.floor(secondsPerKm / 60);
  const s = Math.round(secondsPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")} /km`;
}
