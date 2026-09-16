import { TitleRow } from "@/components/ui/TitleRow";
import { CheckinMap, type MapPin } from "@/components/map/CheckinMap";
import { LocationSharing } from "@/components/map/LocationSharing";
import { getLeagueContext } from "@/lib/league";
import { loadCheckins, loadLocationSettings, participantName } from "@/lib/checkins";
import { ageLabel, formatDay, formatTime, isStale } from "@/lib/time";

export const metadata = { title: "Check-in map" };

export default async function MapPage() {
  const ctx = await getLeagueContext();
  const [checkins, settings, name] = await Promise.all([loadCheckins(ctx), ctx.isParticipant ? loadLocationSettings(ctx) : null, participantName(ctx)]);
  const { data: places } = await ctx.supabase.from("itinerary_items").select("id, title, venue_text, latitude, longitude, location_verified").eq("event_id", ctx.event.id).eq("location_verified", true);
  const latest = checkins[0];
  const tz = ctx.event.timezone;

  const pins: MapPin[] = [
    ...(latest ? [{ id: latest.id, latitude: latest.latitude, longitude: latest.longitude, label: `${name} · ${formatTime(latest.captured_at, tz)}`, kind: "current" as const }] : []),
    ...checkins.slice(1, 20).map((c) => ({ id: c.id, latitude: c.latitude, longitude: c.longitude, label: `${formatDay(c.captured_at, tz)} ${formatTime(c.captured_at, tz)}`, kind: "history" as const })),
    ...(places ?? []).filter((p) => p.latitude != null && p.longitude != null).map((p) => ({ id: p.id, latitude: p.latitude as number, longitude: p.longitude as number, label: p.title, kind: "place" as const })),
  ];

  return (
    <>
      <TitleRow kicker="CHECK-INS · LEAGUE ONLY" title={`Where’s ${name.split(" ")[0]}?`} blurb="A fresh check-in whenever the participant returns. A timestamp everyone can trust." tag={latest ? (isStale(latest.captured_at) ? "STALE CHECK-IN" : "RECENT CHECK-IN") : "NO CHECK-INS"} team="buf" />
      <div className="pb-split">
        <div className="pb-panel pb-plain-map">
          <CheckinMap pins={pins} focus={latest ? { latitude: latest.latitude, longitude: latest.longitude } : undefined} />
          <div className="pb-location">
            <div>
              <b>{latest ? `${name} · ${latest.latitude.toFixed(4)}, ${latest.longitude.toFixed(4)}` : "No device check-in yet"}</b>
              <span className="pb-small">
                {latest
                  ? `Captured ${formatDay(latest.captured_at, tz)} ${formatTime(latest.captured_at, tz)} SAST (${ageLabel(latest.captured_at)}) · accuracy ${latest.accuracy_m != null ? `±${Math.round(latest.accuracy_m)} m` : "unknown"}${isStale(latest.captured_at) ? " · stale" : ""}`
                  : "The participant has not shared a position. Town pins are references only."}
              </span>
            </div>
            <span className={`pb-tag ${latest && !isStale(latest.captured_at) ? "" : "orange"}`}>{latest ? (isStale(latest.captured_at) ? "OLDER THAN 30 MIN" : "FRESH") : "WAITING"}</span>
          </div>
        </div>
        <div>
          {ctx.isParticipant && settings ? (
            <LocationSharing initial={settings} checkinIds={checkins.map((c) => c.id)} />
          ) : (
            <div className="pb-panel">
              <h3>Spectator view</h3>
              <p className="pb-small">Only the participant’s device shares positions. Your location is never requested.</p>
            </div>
          )}
          <div className="pb-panel" style={{ marginTop: 18 }}>
            <h3>Check-in history</h3>
            {checkins.length === 0 ? <p className="pb-small">Nothing yet. Check-ins appear here with capture time, receive time and accuracy.</p> : null}
            {checkins.slice(0, 12).map((c) => (
              <div className="pb-challenge" key={c.id}>
                <span className="pb-time">{formatTime(c.captured_at, tz)}</span>
                <div>
                  <strong>
                    {c.latitude.toFixed(4)}, {c.longitude.toFixed(4)}
                  </strong>
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
