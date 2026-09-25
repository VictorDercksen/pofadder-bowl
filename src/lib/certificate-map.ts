/**
 * Pure helpers for the route map drawn on the certificate PNG: which check-ins make up the
 * confirmed route, how to thin a dense path, and the Web Mercator view and tiles for a canvas
 * box. No server-only or browser imports so the logic is unit testable.
 */
import { distanceMetres, type LatLng } from "@/lib/route-geometry";
import { checkinPath, type PathPoint } from "@/lib/checkin-path";

const TILE = 256;

/** What the certificate map draws; built on the server from the confirmed final check-in. */
export type CertificateRoute = {
  /** Check-in coordinates, oldest first, up to the final check-in (thinned). */
  path: LatLng[];
  /** True once the participant confirmed the final check-in. */
  confirmed: boolean;
  /** Place and time of the last check-in drawn, for the caption. */
  finalPlace: string | null;
  finalWhen: string | null;
  /** Check-ins on the route. */
  count: number;
  /** The participant's kit (badge colours and logo) and name (initials fallback). */
  kitTeam: string | null;
  name: string;
};

/** One-line caption above the map: check-in count, then the final place or a provisional warning. */
export function routeCaption(route: Pick<CertificateRoute, "count" | "confirmed" | "finalPlace" | "finalWhen">): { left: string; right: string } {
  const left = `THE ROUTE · ${route.count} CHECK-IN${route.count === 1 ? "" : "S"}`;
  if (!route.finalPlace) return { left, right: "" };
  return { left, right: route.confirmed ? `FINAL · ${route.finalPlace}${route.finalWhen ? ` · ${route.finalWhen}` : ""}` : "PROVISIONAL · FINAL CHECK-IN NOT CONFIRMED" };
}

/**
 * The route the certificate draws: every check-in up to and including the confirmed final one,
 * oldest first. `confirmed` is false when no final check-in is set (or it is no longer on
 * record); the whole trail on record is used then, as a provisional route.
 */
export function certificateRoute<T extends PathPoint & { id: string }>(checkins: readonly T[], finalId: string | null): { path: LatLng[]; last: T | null; confirmed: boolean } {
  const ordered = [...checkins].sort((a, b) => Date.parse(a.captured_at) - Date.parse(b.captured_at) || Date.parse(a.received_at ?? "") - Date.parse(b.received_at ?? "") || a.id.localeCompare(b.id));
  const index = finalId ? ordered.findIndex((c) => c.id === finalId) : -1;
  const kept = index >= 0 ? ordered.slice(0, index + 1) : ordered;
  return { path: checkinPath(kept), last: kept.length ? kept[kept.length - 1] : null, confirmed: index >= 0 };
}

/**
 * Drops points closer than `minMetres` to the last one kept. The first and last points always
 * stay, so the line still starts and ends on the real check-ins. At certificate scale (roughly
 * half a kilometre per pixel) a five-minute trail is far denser than the image can show.
 */
export function thinPath(path: readonly LatLng[], minMetres: number): LatLng[] {
  if (path.length <= 2) return [...path];
  const out: LatLng[] = [path[0]];
  for (let i = 1; i < path.length - 1; i++) {
    if (distanceMetres(out[out.length - 1], path[i]) >= minMetres) out.push(path[i]);
  }
  const last = path[path.length - 1];
  const prev = out[out.length - 1];
  if (out.length > 1 && distanceMetres(prev, last) < minMetres / 4) out[out.length - 1] = last;
  else out.push(last);
  return out;
}

/** Web Mercator world pixel of a coordinate at a (possibly fractional) zoom. */
export function project([lat, lng]: LatLng, zoom: number): [number, number] {
  const size = TILE * 2 ** zoom;
  const clamped = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const sin = Math.sin((clamped * Math.PI) / 180);
  return [((lng + 180) / 360) * size, (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size];
}

export type MapView = {
  /** Integer zoom of the tiles fetched. */
  tileZoom: number;
  /** Canvas pixels per tile pixel (tiles are drawn at TILE * scale). */
  scale: number;
  /** World pixel (at tileZoom) of the box's top-left corner. */
  originX: number;
  originY: number;
  width: number;
  height: number;
};

/**
 * Frames the points in a width × height box with `padding` pixels to spare, zoomed in no
 * further than `maxZoom`. Tiles come from the nearest integer zoom and are scaled to fit, so
 * the picture stays sharp (scale between about 0.7 and 1.4).
 */
export function fitView(points: readonly LatLng[], width: number, height: number, padding: number, maxZoom = 13): MapView | null {
  if (points.length === 0) return null;
  const at0 = points.map((p) => project(p, 0));
  const xs = at0.map((p) => p[0]);
  const ys = at0.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const fitX = spanX > 0 ? Math.log2((width - 2 * padding) / spanX) : Infinity;
  const fitY = spanY > 0 ? Math.log2((height - 2 * padding) / spanY) : Infinity;
  const zoom = Math.max(1, Math.min(maxZoom, fitX, fitY));
  const tileZoom = Math.round(zoom);
  const scale = 2 ** (zoom - tileZoom);
  const factor = 2 ** tileZoom;
  const centreX = ((minX + maxX) / 2) * factor;
  const centreY = ((minY + maxY) / 2) * factor;
  return { tileZoom, scale, originX: centreX - width / 2 / scale, originY: centreY - height / 2 / scale, width, height };
}

/** Canvas position (relative to the box) of a coordinate in a view. */
export function toCanvas(view: MapView, point: LatLng): [number, number] {
  const [x, y] = project(point, view.tileZoom);
  return [(x - view.originX) * view.scale, (y - view.originY) * view.scale];
}

/** Tiles covering the view, with where each lands in the box. x wraps around the antimeridian; rows off the world are skipped. */
export function viewTiles(view: MapView): { z: number; x: number; y: number; left: number; top: number; size: number }[] {
  const size = TILE * view.scale;
  const count = 2 ** view.tileZoom;
  const x0 = Math.floor(view.originX / TILE);
  const y0 = Math.floor(view.originY / TILE);
  const x1 = Math.floor((view.originX + view.width / view.scale) / TILE);
  const y1 = Math.floor((view.originY + view.height / view.scale) / TILE);
  const tiles = [];
  for (let ty = y0; ty <= y1; ty++) {
    if (ty < 0 || ty >= count) continue;
    for (let tx = x0; tx <= x1; tx++) {
      tiles.push({ z: view.tileZoom, x: ((tx % count) + count) % count, y: ty, left: (tx * TILE - view.originX) * view.scale, top: (ty * TILE - view.originY) * view.scale, size });
    }
  }
  return tiles;
}

/** Fills a Leaflet-style tile template ({s}, {z}, {x}, {y}, {r}). */
export function tileUrlFor(template: string, z: number, x: number, y: number): string {
  return template.replaceAll("{s}", "a").replaceAll("{z}", String(z)).replaceAll("{x}", String(x)).replaceAll("{y}", String(y)).replaceAll("{r}", "");
}
