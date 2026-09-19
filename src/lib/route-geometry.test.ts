import { describe, expect, it } from "vitest";
import { coordinateParam, distanceMetres, MAX_SNAP_METRES, osrmRouteUrl, parseCoordinate, parseOsrmRoute, parsePathKey, parseSegmentResponse, pathKey, routeSegments, segmentKey, stitchRoute, type LatLng } from "./route-geometry";

const malmesbury: LatLng = [-33.46, 18.73];
const clanwilliam: LatLng = [-32.18, 18.89];
const pofadder: LatLng = [-29.13, 19.39];

describe("routeSegments", () => {
  it("pairs consecutive check-ins into legs", () => {
    const segments = routeSegments([malmesbury, clanwilliam, pofadder]);
    expect(segments.map((s) => [s.from, s.to])).toEqual([
      [malmesbury, clanwilliam],
      [clanwilliam, pofadder],
    ]);
    expect(segments[0].key).toBe(segmentKey(malmesbury, clanwilliam));
  });

  it("skips legs too short to route", () => {
    const nudge: LatLng = [-33.46001, 18.73001];
    expect(distanceMetres(malmesbury, nudge)).toBeLessThan(30);
    expect(routeSegments([malmesbury, nudge, clanwilliam])).toHaveLength(1);
  });

  it("returns nothing for zero or one point", () => {
    expect(routeSegments([])).toEqual([]);
    expect(routeSegments([malmesbury])).toEqual([]);
  });
});

describe("segmentKey", () => {
  it("is direction-specific and stable across float noise", () => {
    expect(segmentKey(malmesbury, pofadder)).not.toBe(segmentKey(pofadder, malmesbury));
    expect(segmentKey([-33.4600000001, 18.73], pofadder)).toBe(segmentKey(malmesbury, pofadder));
  });
});

describe("stitchRoute", () => {
  it("uses routed geometry where available and straight lines elsewhere", () => {
    const routed: LatLng[] = [
      [-33.4601, 18.7301],
      [-33.0, 18.8],
      [-32.1801, 18.8901],
    ];
    const lookup = (key: string) => (key === segmentKey(malmesbury, clanwilliam) ? routed : undefined);
    const line = stitchRoute([malmesbury, clanwilliam, pofadder], lookup);
    expect(line[0]).toEqual(malmesbury);
    expect(line).toContainEqual([-33.0, 18.8]);
    expect(line).toContainEqual(clanwilliam);
    expect(line[line.length - 1]).toEqual(pofadder);
    // Routed leg (3 points) + its check-in ends + the straight leg to Pofadder.
    expect(line).toHaveLength(6);
  });

  it("falls back to the straight leg when a route is null", () => {
    expect(stitchRoute([malmesbury, pofadder], () => null)).toEqual([malmesbury, pofadder]);
  });

  it("does not duplicate a point already at the end of the line", () => {
    const routed: LatLng[] = [malmesbury, [-33.0, 18.8], pofadder];
    expect(stitchRoute([malmesbury, pofadder], () => routed)).toEqual(routed);
  });

  it("handles empty and single-point paths", () => {
    expect(stitchRoute([], () => null)).toEqual([]);
    expect(stitchRoute([pofadder], () => null)).toEqual([pofadder]);
  });
});

describe("pathKey", () => {
  it("round-trips through parsePathKey", () => {
    const path: LatLng[] = [malmesbury, clanwilliam, pofadder];
    expect(parsePathKey(pathKey(path))).toEqual(path);
    expect(parsePathKey("")).toEqual([]);
    expect(pathKey([])).toBe("");
  });
});

describe("parseCoordinate", () => {
  it("accepts lat,lng and rejects anything else", () => {
    expect(parseCoordinate("-29.13,19.39")).toEqual([-29.13, 19.39]);
    expect(parseCoordinate(" -29.13 , 19.39 ")).toEqual([-29.13, 19.39]);
    expect(parseCoordinate(coordinateParam(pofadder))).toEqual(pofadder);
    expect(parseCoordinate("")).toBeNull();
    expect(parseCoordinate(null)).toBeNull();
    expect(parseCoordinate("91,0")).toBeNull();
    expect(parseCoordinate("0,181")).toBeNull();
    expect(parseCoordinate("abc,1")).toBeNull();
    expect(parseCoordinate("1,2,3")).toBeNull();
  });
});

describe("osrmRouteUrl", () => {
  it("orders coordinates lng,lat and asks for GeoJSON", () => {
    const url = osrmRouteUrl("https://router.project-osrm.org/", malmesbury, pofadder);
    expect(url).toBe("https://router.project-osrm.org/route/v1/driving/18.73,-33.46;19.39,-29.13?overview=full&geometries=geojson&steps=false&alternatives=false");
  });
});

describe("parseOsrmRoute", () => {
  const ok = { code: "Ok", routes: [{ geometry: { coordinates: [[18.73, -33.46], [18.8, -33.0], [19.39, -29.13]] } }], waypoints: [{ distance: 12.5 }, { distance: 3 }] };

  it("returns lat,lng pairs from a successful response", () => {
    expect(parseOsrmRoute(ok)).toEqual([
      [-33.46, 18.73],
      [-33.0, 18.8],
      [-29.13, 19.39],
    ]);
  });

  it("returns null for errors, missing geometry or malformed payloads", () => {
    expect(parseOsrmRoute({ code: "NoRoute" })).toBeNull();
    expect(parseOsrmRoute({ code: "Ok", routes: [] })).toBeNull();
    expect(parseOsrmRoute({ code: "Ok", routes: [{ geometry: { coordinates: [[18.73, -33.46]] } }] })).toBeNull();
    expect(parseOsrmRoute({ code: "Ok", routes: [{ geometry: { coordinates: [[18.73, -33.46], ["x", 1]] } }] })).toBeNull();
    expect(parseOsrmRoute(null)).toBeNull();
    expect(parseOsrmRoute("Ok")).toBeNull();
  });

  it("refuses a route whose end was snapped far from the check-in", () => {
    expect(parseOsrmRoute({ ...ok, waypoints: [{ distance: MAX_SNAP_METRES + 1 }, { distance: 0 }] })).toBeNull();
  });
});

describe("parseSegmentResponse", () => {
  it("validates our own handler's payload", () => {
    expect(parseSegmentResponse({ coordinates: [[-33.46, 18.73], [-29.13, 19.39]] })).toEqual([malmesbury, pofadder]);
    expect(parseSegmentResponse({ coordinates: null })).toBeNull();
    expect(parseSegmentResponse({ coordinates: [[-33.46, 18.73]] })).toBeNull();
    expect(parseSegmentResponse({ coordinates: [[-33.46, 18.73], [1, 2, 3]] })).toBeNull();
    expect(parseSegmentResponse({ coordinates: [[-33.46, 18.73], [95, 2]] })).toBeNull();
    expect(parseSegmentResponse(undefined)).toBeNull();
  });
});
