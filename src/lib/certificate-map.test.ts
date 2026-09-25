import { describe, expect, it } from "vitest";
import { certificateRoute, fitView, project, routeCaption, thinPath, tileUrlFor, toCanvas, viewTiles } from "./certificate-map";
import type { LatLng } from "./route-geometry";

const MALMESBURY: LatLng = [-33.46, 18.73];
const POFADDER: LatLng = [-29.13, 19.39];

const checkins = [
  { id: "c3", latitude: -33.46, longitude: 18.73, captured_at: "2026-09-25T05:30:00Z" },
  { id: "c1", latitude: -33.46, longitude: 18.73, captured_at: "2026-09-23T19:00:00Z" },
  { id: "c2", latitude: -29.13, longitude: 19.39, captured_at: "2026-09-24T04:00:00Z" },
  { id: "c4", latitude: -33.45, longitude: 18.74, captured_at: "2026-09-25T07:00:00Z" },
];

describe("certificateRoute", () => {
  it("stops at the confirmed final check-in", () => {
    const route = certificateRoute(checkins, "c3");
    expect(route.confirmed).toBe(true);
    expect(route.last?.id).toBe("c3");
    expect(route.path).toEqual([MALMESBURY, POFADDER, MALMESBURY]);
  });

  it("uses the whole trail, provisionally, without a confirmed final check-in", () => {
    const route = certificateRoute(checkins, null);
    expect(route.confirmed).toBe(false);
    expect(route.last?.id).toBe("c4");
    expect(route.path).toHaveLength(4);
  });

  it("falls back to the whole trail when the confirmed check-in is no longer on record", () => {
    const route = certificateRoute(checkins, "gone");
    expect(route.confirmed).toBe(false);
    expect(route.path).toHaveLength(4);
  });

  it("is empty without check-ins", () => {
    expect(certificateRoute([], "c1")).toEqual({ path: [], last: null, confirmed: false });
  });
});

describe("thinPath", () => {
  it("keeps the ends and drops points closer than the minimum", () => {
    const path: LatLng[] = [MALMESBURY, [-33.4601, 18.7301], [-33.3, 18.75], [-33.3001, 18.7501], POFADDER];
    expect(thinPath(path, 5000)).toEqual([MALMESBURY, [-33.3, 18.75], POFADDER]);
  });

  it("replaces a kept point that sits right next to the final one", () => {
    const path: LatLng[] = [MALMESBURY, POFADDER, [-29.1301, 19.3901]];
    expect(thinPath(path, 5000)).toEqual([MALMESBURY, [-29.1301, 19.3901]]);
  });

  it("leaves short paths alone", () => {
    expect(thinPath([MALMESBURY], 5000)).toEqual([MALMESBURY]);
  });
});

describe("fitView", () => {
  it("frames Malmesbury to Pofadder inside the box", () => {
    const view = fitView([MALMESBURY, POFADDER], 1040, 540, 40)!;
    expect(view.tileZoom).toBe(7);
    for (const p of [MALMESBURY, POFADDER]) {
      const [x, y] = toCanvas(view, p);
      expect(x).toBeGreaterThanOrEqual(39);
      expect(x).toBeLessThanOrEqual(1001);
      expect(y).toBeGreaterThanOrEqual(39);
      expect(y).toBeLessThanOrEqual(501);
    }
  });

  it("caps the zoom for a single point and centres it", () => {
    const view = fitView([MALMESBURY], 400, 200, 20, 13)!;
    expect(view.tileZoom).toBe(13);
    const [x, y] = toCanvas(view, MALMESBURY);
    expect(x).toBeCloseTo(200);
    expect(y).toBeCloseTo(100);
  });

  it("returns null without points", () => {
    expect(fitView([], 100, 100, 10)).toBeNull();
  });
});

describe("viewTiles", () => {
  it("covers the box with tiles that line up with the projection", () => {
    const view = fitView([MALMESBURY, POFADDER], 1040, 540, 40)!;
    const tiles = viewTiles(view);
    expect(tiles.length).toBeGreaterThan(0);
    for (const t of tiles) {
      expect(t.left).toBeLessThan(1040);
      expect(t.top).toBeLessThan(540);
      expect(t.left + t.size).toBeGreaterThan(0);
      expect(t.top + t.size).toBeGreaterThan(0);
    }
    const [wx, wy] = project(MALMESBURY, view.tileZoom);
    const home = tiles.find((t) => t.x === Math.floor(wx / 256) && t.y === Math.floor(wy / 256));
    expect(home).toBeDefined();
  });
});

describe("tileUrlFor", () => {
  it("fills Leaflet placeholders", () => {
    expect(tileUrlFor("https://tile.openstreetmap.org/{z}/{x}/{y}.png", 7, 70, 76)).toBe("https://tile.openstreetmap.org/7/70/76.png");
    expect(tileUrlFor("https://{s}.example.com/{z}/{x}/{y}{r}.png", 3, 1, 2)).toBe("https://a.example.com/3/1/2.png");
  });
});

describe("routeCaption", () => {
  it("names the confirmed final check-in", () => {
    expect(routeCaption({ count: 42, confirmed: true, finalPlace: "In Malmesbury", finalWhen: "Fri 25 Sep 07:35" })).toEqual({ left: "THE ROUTE · 42 CHECK-INS", right: "FINAL · In Malmesbury · Fri 25 Sep 07:35" });
  });

  it("flags an unconfirmed route as provisional", () => {
    expect(routeCaption({ count: 1, confirmed: false, finalPlace: "In Pofadder", finalWhen: null }).right).toBe("PROVISIONAL · FINAL CHECK-IN NOT CONFIRMED");
  });

  it("has no right-hand text without check-ins", () => {
    expect(routeCaption({ count: 0, confirmed: false, finalPlace: null, finalWhen: null })).toEqual({ left: "THE ROUTE · 0 CHECK-INS", right: "" });
  });
});
