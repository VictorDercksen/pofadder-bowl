/** Browser-only: draws the certificate route map on a canvas (used by the PNG export and the recap preview). */
import { fitView, thinPath, tileUrlFor, toCanvas, viewTiles, type CertificateRoute } from "@/lib/certificate-map";
import { coordinateParam, distanceMetres, parseSegmentResponse, segmentKey, stitchRoute, type LatLng, type SegmentGeometry } from "@/lib/route-geometry";
import { kitFor, teamLogoSrc } from "@/lib/nfl";
import { memberInitials } from "@/lib/member-locations";
import { publicEnv } from "@/lib/env";

export type Box = { x: number; y: number; w: number; h: number };

const ROUTE_COLOUR = "#cc542b";
const GREEN = "#183b2f";
const CREAM = "#fffcf5";
/** At certificate scale a straight line is indistinguishable from the road below this. */
const ROUTE_LEG_METRES = 15_000;
const THIN_METRES = 1500;
const LEG_TIMEOUT_MS = 8000;
const TILE_TIMEOUT_MS = 10_000;

export function loadImage(src: string, crossOrigin = false, timeoutMs = TILE_TIMEOUT_MS): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    // Tiles come from another host: without CORS the canvas would be tainted and refuse to export.
    if (crossOrigin) img.crossOrigin = "anonymous";
    const timer = window.setTimeout(() => resolve(null), timeoutMs);
    img.onload = () => {
      window.clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      window.clearTimeout(timer);
      resolve(null);
    };
    img.src = src;
  });
}

/** Road geometry for the long legs (the same /api/map-route the live map uses); short or unroutable legs stay straight. */
async function routedLine(path: LatLng[]): Promise<LatLng[]> {
  const legs: { key: string; from: LatLng; to: LatLng }[] = [];
  for (let i = 1; i < path.length; i++) {
    if (distanceMetres(path[i - 1], path[i]) >= ROUTE_LEG_METRES) legs.push({ key: segmentKey(path[i - 1], path[i]), from: path[i - 1], to: path[i] });
  }
  const found = new Map<string, SegmentGeometry>();
  let next = 0;
  async function worker() {
    while (next < legs.length) {
      const leg = legs[next++];
      try {
        const res = await fetch(`/api/map-route?from=${coordinateParam(leg.from)}&to=${coordinateParam(leg.to)}`, { credentials: "same-origin", headers: { Accept: "application/json" }, signal: AbortSignal.timeout(LEG_TIMEOUT_MS) });
        if (res.ok) found.set(leg.key, parseSegmentResponse(await res.json()));
      } catch {
        // Straight line for this leg.
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, legs.length) }, worker));
  return stitchRoute(path, (k) => found.get(k) ?? undefined);
}

function roundedRect(c: CanvasRenderingContext2D, { x, y, w, h }: Box, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/** The participant's kit-badge pin (as on the live map, larger), tip on the point. */
function drawBadge(c: CanvasRenderingContext2D, px: number, py: number, kitTeam: string | null, name: string, logo: HTMLImageElement | null, condensed: string) {
  const kit = kitFor(kitTeam);
  const hx = px;
  const hy = py - 46;
  const r = 29;
  c.save();
  c.fillStyle = "rgba(216, 100, 54, 0.18)";
  c.beginPath();
  c.arc(hx, hy, r + 13, 0, Math.PI * 2);
  c.fill();
  c.shadowColor = "rgba(24, 59, 47, 0.35)";
  c.shadowBlur = 8;
  c.shadowOffsetY = 3;
  // Tail: a rotated square under the head.
  c.save();
  c.translate(px, py - 15);
  c.rotate(Math.PI / 4);
  c.fillStyle = kit.body;
  c.fillRect(-10, -10, 20, 20);
  c.strokeStyle = ROUTE_COLOUR;
  c.lineWidth = 3;
  c.strokeRect(-10, -10, 20, 20);
  c.restore();
  c.fillStyle = kit.body;
  c.beginPath();
  c.arc(hx, hy, r, 0, Math.PI * 2);
  c.fill();
  c.restore();
  c.strokeStyle = CREAM;
  c.lineWidth = 5;
  c.beginPath();
  c.arc(hx, hy, r - 2.5, 0, Math.PI * 2);
  c.stroke();
  c.strokeStyle = ROUTE_COLOUR;
  c.lineWidth = 3;
  c.beginPath();
  c.arc(hx, hy, r + 1, 0, Math.PI * 2);
  c.stroke();
  if (logo) {
    c.drawImage(logo, hx - 19, hy - 19, 38, 38);
  } else {
    c.fillStyle = kit.accent;
    c.font = `700 22px ${condensed}, Impact, sans-serif`;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(memberInitials(name), hx, hy + 1);
    c.textBaseline = "alphabetic";
  }
}

/**
 * Draws the route map into `box`: map tiles (when a provider is configured and allows CORS),
 * the route along real roads, a start dot and the participant's badge on the final check-in.
 * Anything that fails to load is left out rather than failing the image.
 */
export async function drawRouteMap(c: CanvasRenderingContext2D, box: Box, route: CertificateRoute, fonts: { barlow: string; condensed: string }): Promise<void> {
  c.save();
  roundedRect(c, box, 10);
  c.clip();
  c.fillStyle = "#e5e8df";
  c.fillRect(box.x, box.y, box.w, box.h);

  const path = thinPath(route.path, THIN_METRES);
  if (path.length === 0) {
    c.fillStyle = "#687366";
    c.font = `600 24px ${fonts.barlow}, Arial, sans-serif`;
    c.textAlign = "center";
    c.fillText("No check-ins on record yet", box.x + box.w / 2, box.y + box.h / 2);
    c.restore();
    return;
  }

  const [line, logo] = await Promise.all([routedLine(path), route.kitTeam ? loadImage(teamLogoSrc(route.kitTeam)) : Promise.resolve(null)]);
  // Room above the top point for the badge; the fit keeps the route clear of the frame.
  const view = fitView([...line, ...path], box.w, box.h - 60, 50, 12);
  if (!view) {
    c.restore();
    return;
  }
  const at = (p: LatLng): [number, number] => {
    const [x, y] = toCanvas(view, p);
    return [box.x + x, box.y + 60 + y];
  };

  let tilesDrawn = 0;
  if (publicEnv.mapTileUrl) {
    // The view is 60 px shorter than the box (badge headroom); cover the whole box with tiles.
    const cover = { ...view, originY: view.originY - 60 / view.scale, height: box.h };
    const tiles = viewTiles(cover);
    const images = await Promise.all(tiles.map((t) => loadImage(tileUrlFor(publicEnv.mapTileUrl, t.z, t.x, t.y), true)));
    tiles.forEach((t, i) => {
      const img = images[i];
      if (!img) return;
      // Half a pixel of overlap hides the seams between scaled tiles.
      c.drawImage(img, box.x + t.left, box.y + t.top, t.size + 0.5, t.size + 0.5);
      tilesDrawn += 1;
    });
    if (tilesDrawn) {
      c.fillStyle = "rgba(244, 240, 230, 0.22)";
      c.fillRect(box.x, box.y, box.w, box.h);
    }
  }

  const points = line.map(at);
  if (points.length > 1) {
    c.lineJoin = "round";
    c.lineCap = "round";
    for (const [colour, width] of [
      [CREAM, 11],
      [ROUTE_COLOUR, 5.5],
    ] as const) {
      c.strokeStyle = colour;
      c.lineWidth = width;
      c.beginPath();
      points.forEach(([x, y], i) => (i === 0 ? c.moveTo(x, y) : c.lineTo(x, y)));
      c.stroke();
    }
  }

  // Start dot, unless the badge sits on it (a round trip that ends where it began).
  if (distanceMetres(path[0], path[path.length - 1]) > 2000) {
    const [sx, sy] = at(path[0]);
    c.fillStyle = GREEN;
    c.strokeStyle = CREAM;
    c.lineWidth = 4;
    c.beginPath();
    c.arc(sx, sy, 9, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  }

  const [fx, fy] = at(path[path.length - 1]);
  drawBadge(c, fx, fy, route.kitTeam, route.name, logo, fonts.condensed);

  if (tilesDrawn) {
    const credit = publicEnv.mapTileAttribution.replace(/<[^>]+>/g, "").replace(/&copy;/g, "©").replace(/&amp;/g, "&").trim();
    c.font = `400 14px ${fonts.barlow}, Arial, sans-serif`;
    const width = c.measureText(credit).width;
    c.fillStyle = "rgba(255, 252, 245, 0.85)";
    c.fillRect(box.x + box.w - width - 16, box.y + box.h - 24, width + 16, 24);
    c.fillStyle = "#44503f";
    c.textAlign = "right";
    c.fillText(credit, box.x + box.w - 8, box.y + box.h - 7);
  }
  c.restore();

  c.strokeStyle = GREEN;
  c.lineWidth = 3;
  roundedRect(c, box, 10);
  c.stroke();
}
