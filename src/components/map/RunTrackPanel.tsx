import { RunRoute } from "@/components/map/RunRoute";
import { loadRunTrack, trackFileOf, type TrackFile } from "@/lib/run-track";
import { getLeagueContext } from "@/lib/league";
import type { TrackStats } from "@/lib/gpx";
import { formatDay, formatTime } from "@/lib/time";

/** Marker and source-line text, formatted on the server in the event timezone. */
export function runRouteLabels(stats: TrackStats, timezone: string, participant = "Participant") {
  return {
    startLabel: `${participant} · start${stats.startedAt ? ` · ${formatTime(stats.startedAt, timezone)}` : ""}`,
    finishLabel: `${participant} · finish${stats.finishedAt ? ` · ${formatTime(stats.finishedAt, timezone)}` : ""}`,
    started: stats.startedAt ? `Started ${formatDay(stats.startedAt, timezone)} ${formatTime(stats.startedAt, timezone)} SAST` : null,
  };
}

/**
 * Server component: downloads and parses the watch export on the given submission and
 * renders the route. Render it under Suspense so the screen never waits on storage.
 * The context is the request-cached one, so the caller's RLS decides what is readable.
 */
export async function RunTrack({ files, participant, empty }: { files: readonly TrackFile[]; participant?: string; empty?: string }) {
  const file = trackFileOf(files);
  if (!file) return <p className="pb-small">{empty ?? "No GPX or TCX file on this version. FIT files cannot be drawn; ask for a GPX export as well."}</p>;
  const ctx = await getLeagueContext();
  const track = await loadRunTrack(ctx, files);
  if (!track) return <p className="pb-small pb-warn-text">{file.original_name ?? "The watch export"} could not be read as a track. Open the file itself to check it.</p>;
  return <RunRoute track={{ line: track.line, stats: track.stats, fileName: track.fileName }} {...runRouteLabels(track.stats, ctx.event.timezone, participant)} />;
}

export function RunTrackSkeleton() {
  return (
    <div className="pb-live-map pb-track-map" role="status" aria-live="polite">
      <div className="pb-skeleton" style={{ position: "absolute", inset: 0 }} />
      <span className="pb-map-fallback-label">READING THE WATCH EXPORT…</span>
    </div>
  );
}
