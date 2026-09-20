import { describe, expect, it } from "vitest";
import { formatPace, isTrackFile, parseTrack, thinTrack, trackStats, type LatLng } from "./gpx";

const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="watch"><trk><name>Pofadder 10 km</name><trkseg>
<trkpt lat="-29.1283" lon="19.3949"><ele>980.0</ele><time>2026-09-24T03:05:00Z</time></trkpt>
<trkpt lon="19.4049" lat="-29.1283"><ele>985.5</ele><time>2026-09-24T03:10:00Z</time></trkpt>
<trkpt lat="-29.1383" lon="19.4049"><ele>984.0</ele><time>2026-09-24T03:16:00Z</time></trkpt>
<trkpt lat="0" lon="0"><time>2026-09-24T03:17:00Z</time></trkpt>
<trkpt lat="-29.1383" lon="19.3949"/>
</trkseg></trk></gpx>`;

const tcx = `<?xml version="1.0"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"><Activities><Activity Sport="Running"><Lap>
<Track>
<Trackpoint><Time>2026-09-24T03:05:00Z</Time><Position><LatitudeDegrees>-29.1283</LatitudeDegrees><LongitudeDegrees>19.3949</LongitudeDegrees></Position><AltitudeMeters>980</AltitudeMeters></Trackpoint>
<Trackpoint><Time>2026-09-24T03:06:00Z</Time></Trackpoint>
<Trackpoint><Time>2026-09-24T03:15:00Z</Time><Position><LatitudeDegrees>-29.1383</LatitudeDegrees><LongitudeDegrees>19.3949</LongitudeDegrees></Position><AltitudeMeters>990</AltitudeMeters></Trackpoint>
</Track></Lap></Activity></Activities></TrainingCenterDatabase>`;

describe("parseTrack", () => {
  it("reads GPX track points in either attribute order, skipping the null island", () => {
    const track = parseTrack(gpx);
    expect(track).not.toBeNull();
    expect(track!.line).toEqual([
      [-29.1283, 19.3949],
      [-29.1283, 19.4049],
      [-29.1383, 19.4049],
      [-29.1383, 19.3949],
    ]);
    expect(track!.stats.points).toBe(4);
    // Two ~1.1 km east/south legs, then ~1 km west: about 3 km.
    expect(track!.stats.distanceKm).toBeGreaterThan(3);
    expect(track!.stats.distanceKm).toBeLessThan(3.3);
    expect(track!.stats.durationSeconds).toBe(11 * 60);
    expect(track!.stats.startedAt).toBe("2026-09-24T03:05:00.000Z");
    expect(track!.stats.finishedAt).toBe("2026-09-24T03:16:00.000Z");
    expect(track!.stats.elevationGainM).toBe(6);
  });

  it("reads TCX and skips trackpoints without a position", () => {
    const track = parseTrack(tcx);
    expect(track).not.toBeNull();
    expect(track!.line).toHaveLength(2);
    expect(track!.stats.durationSeconds).toBe(600);
    expect(track!.stats.elevationGainM).toBe(10);
    expect(track!.stats.paceSecondsPerKm).toBeGreaterThan(500);
  });

  it("falls back to route points and returns null for empty or foreign documents", () => {
    expect(parseTrack(`<gpx><rte><rtept lat="-33.46" lon="18.73"/><rtept lat="-33.47" lon="18.74"/></rte></gpx>`)!.line).toHaveLength(2);
    expect(parseTrack("<gpx/>")).toBeNull();
    expect(parseTrack("")).toBeNull();
    expect(parseTrack("<html><body>not a track</body></html>")).toBeNull();
  });

  it("copes with a file that carries no times or elevation", () => {
    const track = parseTrack(`<gpx><trk><trkseg><trkpt lat="-29.1" lon="19.3"/><trkpt lat="-29.2" lon="19.3"/></trkseg></trk></gpx>`)!;
    expect(track.stats.durationSeconds).toBeNull();
    expect(track.stats.paceSecondsPerKm).toBeNull();
    expect(track.stats.elevationGainM).toBeNull();
    expect(track.stats.distanceKm).toBeCloseTo(11.12, 1);
  });
});

describe("trackStats", () => {
  it("ignores climbs below the noise threshold", () => {
    const pts = [980, 981, 982, 981, 982, 983, 984, 983].map((ele, i) => ({ lat: -29 - i * 0.0001, lng: 19, ele, time: null }));
    // 980 → 983 is the only climb of 3 m or more; the 1 m wobbles around it are noise.
    expect(trackStats(pts).elevationGainM).toBe(3);
  });
});

describe("thinTrack", () => {
  it("keeps short lines whole and always keeps the last point", () => {
    const line: LatLng[] = Array.from({ length: 10 }, (_, i) => [i, i]);
    expect(thinTrack(line, 20)).toEqual(line);
    const thinned = thinTrack(line, 4);
    expect(thinned.length).toBeLessThanOrEqual(5);
    expect(thinned[0]).toEqual([0, 0]);
    expect(thinned[thinned.length - 1]).toEqual([9, 9]);
  });
});

describe("helpers", () => {
  it("recognises GPX and TCX by name or media type", () => {
    expect(isTrackFile("Run.GPX")).toBe(true);
    expect(isTrackFile("run.tcx")).toBe(true);
    expect(isTrackFile("run.fit")).toBe(false);
    expect(isTrackFile("export", "application/gpx+xml")).toBe(true);
    expect(isTrackFile(null, null)).toBe(false);
  });

  it("formats pace", () => {
    expect(formatPace(342)).toBe("5:42 /km");
    expect(formatPace(null)).toBe("");
    expect(formatPace(0)).toBe("");
  });
});
