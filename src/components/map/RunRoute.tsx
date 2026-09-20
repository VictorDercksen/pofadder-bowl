"use client";

import dynamic from "next/dynamic";
import { publicEnv } from "@/lib/env";
import { formatPace, type TrackStats } from "@/lib/gpx";
import { secondsToClock } from "@/lib/time";

const TrackMap = dynamic(() => import("./TrackMap").then((m) => m.TrackMap), {
  ssr: false,
  loading: () => (
    <div className="pb-live-map pb-track-map" role="status" aria-live="polite">
      <div className="pb-skeleton" style={{ position: "absolute", inset: 0 }} />
      <span className="pb-map-fallback-label">LOADING ROUTE…</span>
    </div>
  ),
});

export type RunRouteData = { line: [number, number][]; stats: TrackStats; fileName: string };

/**
 * The recorded run as a line on the map with the numbers from the file. The map is the
 * file's own trace (no routing). Dates arrive pre-formatted from the server: Node and the
 * browser disagree on Intl punctuation ("Thu 24 Sept" vs "Thu, 24 Sept"), which would
 * otherwise fail hydration.
 */
export function RunRoute({ track, startLabel, finishLabel, started }: { track: RunRouteData; startLabel: string; finishLabel: string; /** "Started Thu 24 Sept 05:05 SAST", or null when the file has no times. */ started: string | null }) {
  const { stats } = track;
  return (
    <div className="pb-run-route">
      {publicEnv.mapTileUrl ? (
        <TrackMap line={track.line} tileUrl={publicEnv.mapTileUrl} attribution={publicEnv.mapTileAttribution} startLabel={startLabel} finishLabel={finishLabel} />
      ) : (
        <div className="pb-live-map pb-track-map" role="status">
          <span className="pb-map-fallback-label">STATIC FALLBACK · NO LIVE TILES CONFIGURED</span>
        </div>
      )}
      <div className="pb-run-stats" aria-label="Run statistics">
        <div>
          <strong>{stats.distanceKm.toFixed(2)} km</strong>
          <small>DISTANCE</small>
        </div>
        <div>
          <strong>{stats.durationSeconds != null ? secondsToClock(stats.durationSeconds) : "—"}</strong>
          <small>TIME</small>
        </div>
        <div>
          <strong>{formatPace(stats.paceSecondsPerKm) || "—"}</strong>
          <small>PACE</small>
        </div>
        <div>
          <strong>{stats.elevationGainM != null ? `${stats.elevationGainM} m` : "—"}</strong>
          <small>CLIMB</small>
        </div>
      </div>
      <div className="pb-map-source">
        {started ? `${started} · ` : ""}
        {stats.points} recorded points from {track.fileName}. The line is the watch file as uploaded, not the check-in map.
      </div>
    </div>
  );
}
