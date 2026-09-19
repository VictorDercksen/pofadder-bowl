import { NextResponse, type NextRequest } from "next/server";
import { getVerifiedUser } from "@/lib/league";
import { mapRoutingUrl } from "@/lib/env";
import { distanceMetres, MIN_ROUTE_METRES, osrmRouteUrl, parseCoordinate, parseOsrmRoute, type SegmentGeometry } from "@/lib/route-geometry";

/** A leg is one drive between check-ins; nothing in the programme is longer than the whole trip. */
const MAX_LEG_METRES = 1500 * 1000;

/** Roads do not move: routed legs are kept in the data cache for a month, shared by every viewer. */
const ROUTE_CACHE_SECONDS = 60 * 60 * 24 * 30;

const UPSTREAM_TIMEOUT_MS = 8000;

function json(body: { coordinates: SegmentGeometry; reason?: string }, status = 200) {
  const res = NextResponse.json(body, { status });
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

/**
 * GET /api/map-route?from=lat,lng&to=lat,lng
 *
 * Road geometry between two consecutive check-ins for the live map. Signed-in league
 * accounts only (the proxy bounces anonymous callers first). Answers
 * `{ coordinates: [[lat, lng], …] }`, or `{ coordinates: null }` when routing is off,
 * the router has no road for the leg, or the router is unreachable: the map then draws
 * that leg as a straight line. Upstream answers are cached per leg so the routing
 * service sees each leg once, not once per viewer per poll.
 */
export async function GET(request: NextRequest) {
  const { user } = await getVerifiedUser();
  if (!user) return json({ coordinates: null, reason: "signed_out" }, 401);

  const from = parseCoordinate(request.nextUrl.searchParams.get("from"));
  const to = parseCoordinate(request.nextUrl.searchParams.get("to"));
  if (!from || !to) return json({ coordinates: null, reason: "bad_request" }, 400);

  const legMetres = distanceMetres(from, to);
  if (legMetres < MIN_ROUTE_METRES || legMetres > MAX_LEG_METRES) return json({ coordinates: null, reason: "leg_out_of_range" });

  const base = mapRoutingUrl();
  if (!base) return json({ coordinates: null, reason: "routing_off" });

  try {
    const res = await fetch(osrmRouteUrl(base, from, to), {
      headers: { Accept: "application/json", "User-Agent": "pofadder-bowl/1.0 (private league check-in map)" },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      next: { revalidate: ROUTE_CACHE_SECONDS },
    });
    if (!res.ok) return json({ coordinates: null, reason: `upstream_${res.status}` });
    const coordinates = parseOsrmRoute(await res.json());
    return json({ coordinates, reason: coordinates ? undefined : "no_route" });
  } catch {
    return json({ coordinates: null, reason: "upstream_unreachable" });
  }
}
