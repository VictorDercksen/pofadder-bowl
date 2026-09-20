import { Suspense } from "react";
import { TitleRow } from "@/components/ui/TitleRow";
import { CheckinMap, type MapPin } from "@/components/map/CheckinMap";
import { CheckinLive } from "@/components/map/CheckinLive";
import { LocationSharing } from "@/components/map/LocationSharing";
import { RunTrack, RunTrackSkeleton } from "@/components/map/RunTrackPanel";
import { getLeagueContext } from "@/lib/league";
import { checkinPath } from "@/lib/checkin-path";
import { loadCheckins, loadLocationSettings, participantName } from "@/lib/checkins";
import { placeLabel } from "@/lib/places";
import { loadRunSubmission } from "@/lib/run-track";
import { ageLabel, formatDay, formatTime, isStale } from "@/lib/time";

export const metadata = { title: "Check-in map" };

export default async function MapPage() {
  const ctx = await getLeagueContext();
  const [checkins, settings, name, run] = await Promise.all([loadCheckins(ctx), ctx.isParticipant ? loadLocationSettings(ctx) : null, participantName(ctx), loadRunSubmission(ctx)]);
  const { data: places } = await ctx.supabase.from("itinerary_items").select("id, title, venue_text, latitude, longitude, location_verified").eq("event_id", ctx.event.id).eq("location_verified", true);
  const latest = checkins[0];
  const tz = ctx.event.timezone;
  // Oldest to newest: the line the league watches grow from Malmesbury to Pofadder and back.
  const path = checkinPath(checkins);
  const runSub = run?.submission ?? null;
  const runTag = runSub ? (runSub.status === "approved" ? "APPROVED" : runSub.status === "submitted" ? "IN REVIEW" : runSub.status.toUpperCase()) : "NOT YET RUN";

  const pins: MapPin[] = [
    ...(latest ? [{ id: latest.id, latitude: latest.latitude, longitude: latest.longitude, label: `${name} · ${placeLabel(latest)} · ${formatTime(latest.captured_at, tz)}`, kind: "current" as const }] : []),
    ...checkins.slice(1).map((c) => ({ id: c.id, latitude: c.latitude, longitude: c.longitude, label: `${placeLabel(c)} · ${formatDay(c.captured_at, tz)} ${formatTime(c.captured_at, tz)}`, kind: "history" as const })),
    ...(places ?? []).filter((p) => p.latitude != null && p.longitude != null).map((p) => ({ id: p.id, latitude: p.latitude as number, longitude: p.longitude as number, label: p.title, kind: "place" as const })),
  ];

  return (
    <>
      <TitleRow kicker="CHECK-INS · LEAGUE ONLY" title={`Where’s ${name.split(" ")[0]}?`} blurb="A fresh check-in whenever the participant returns. A timestamp everyone can trust." tag={latest ? (isStale(latest.captured_at) ? "STALE CHECK-IN" : "RECENT CHECK-IN") : "NO CHECK-INS"} team={ctx.profile.kit_team} />
      <div className="pb-split">
        <div>
          <div className="pb-panel pb-plain-map" data-tour="map-panel">
            <CheckinLive eventId={ctx.event.id} />
            <CheckinMap pins={pins} path={path} focus={latest ? { latitude: latest.latitude, longitude: latest.longitude } : undefined} />
            <div className="pb-location">
              <div>
                <b>{latest ? `${name} · ${placeLabel(latest)}` : "No device check-in yet"}</b>
                <span className="pb-small">
                  {latest
                    ? `Captured ${formatDay(latest.captured_at, tz)} ${formatTime(latest.captured_at, tz)} SAST (${ageLabel(latest.captured_at)}) · accuracy ${latest.accuracy_m != null ? `±${Math.round(latest.accuracy_m)} m` : "unknown"}${isStale(latest.captured_at) ? " · stale" : ""}`
                    : "The participant has not shared a position. Town pins are references only."}
                </span>
              </div>
              <span className={`pb-tag ${latest && !isStale(latest.captured_at) ? "" : "orange"}`}>{latest ? (isStale(latest.captured_at) ? "OLDER THAN 30 MIN" : "FRESH") : "WAITING"}</span>
            </div>
          </div>
          <div className="pb-panel pb-run-panel" style={{ marginTop: 18 }} data-tour="run-route">
            <div className="pb-panel-top">
              <h3>The run{run ? ` · ${run.challenge.points} points` : ""}</h3>
              <span className={`pb-tag ${runSub?.status === "approved" ? "" : "orange"}`}>{runTag}</span>
            </div>
            <p className="pb-small" style={{ marginBottom: 12 }}>
              {runSub ? `${name}’s watch export, version ${runSub.version}${runSub.submitted_at ? `, submitted ${formatDay(runSub.submitted_at, tz)} ${formatTime(runSub.submitted_at, tz)}` : ""}. The commissioner approves it from the same trace.` : `The 14 km trace appears here once ${name.split(" ")[0]} uploads the watch export. The check-in map above is not proof of the run.`}
            </p>
            {runSub ? (
              <Suspense fallback={<RunTrackSkeleton />}>
                <RunTrack files={runSub.files} participant={name} />
              </Suspense>
            ) : null}
          </div>
        </div>
        <div>
          {ctx.isParticipant && settings ? <LocationSharing initial={settings} checkinIds={checkins.map((c) => c.id)} /> : null}
          <div className="pb-panel" style={ctx.isParticipant && settings ? { marginTop: 18 } : undefined}>
            <h3>Check-in history{checkins.length ? ` · ${checkins.length}` : ""}</h3>
            {checkins.length === 0 ? <p className="pb-small">Nothing yet. Check-ins appear here as a place (“10 km N of Malmesbury”) with capture time, receive time and accuracy.</p> : null}
            {checkins.slice(0, 12).map((c) => (
              <div className="pb-challenge" key={c.id}>
                <span className="pb-time">{formatTime(c.captured_at, tz)}</span>
                <div>
                  <strong>{placeLabel(c)}</strong>
                  <p>
                    {formatDay(c.captured_at, tz)} · captured {formatTime(c.captured_at, tz)} · received {formatTime(c.received_at, tz)} · {c.accuracy_m != null ? `±${Math.round(c.accuracy_m)} m` : "accuracy unknown"}
                    {c.accuracy_m != null && c.accuracy_m > 250 ? " · weak accuracy" : ""}
                  </p>
                </div>
              </div>
            ))}
            <p className="pb-small" style={{ marginTop: 8 }}>Itinerary venues appear as pins only when their coordinates have been verified; otherwise the text address stands.</p>
          </div>
        </div>
      </div>
    </>
  );
}
