import Link from "next/link";
import { Suspense } from "react";
import { Shield } from "@/components/ui/Marks";
import { TitleRow } from "@/components/ui/TitleRow";
import { Countdown } from "@/components/ui/Countdown";
import { CheckinMap } from "@/components/map/CheckinMap";
import { SidelineFeed } from "@/components/feed/SidelineFeed";
import { LosersBracketPanel } from "@/components/sleeper/LosersBracket";
import { LoadingPlay } from "@/components/ui/Football";
import { getEventScore, getLeagueContext } from "@/lib/league";
import { loadFeed } from "@/lib/feed";
import { checkinPath } from "@/lib/checkin-path";
import { sleeperLeagueId } from "@/lib/env";
import { loadCheckins, participantName } from "@/lib/checkins";
import { nextItinerary } from "@/lib/itinerary";
import { placeLabel } from "@/lib/places";
import { ageLabel, eventPhase, formatDay, formatTime, isStale, PHASE_HEADINGS, QUARTER_LABELS, quarterNumber } from "@/lib/time";

export const metadata = { title: "Game centre" };

export default async function GameCentrePage() {
  const ctx = await getLeagueContext();
  const now = new Date();
  const phase = eventPhase(ctx.event, now);
  const [score, checkins, name, next, feedResult] = await Promise.all([
    getEventScore(ctx),
    loadCheckins(ctx),
    participantName(ctx),
    nextItinerary(ctx, now),
    loadFeed(ctx).then((posts) => ({ posts, error: null as string | null })).catch((e: Error) => ({ posts: [], error: e.message })),
  ]);
  const latest = checkins[0];
  const tz = ctx.event.timezone;
  const q = quarterNumber(phase);
  const quarters: (keyof typeof QUARTER_LABELS)[] = ["q1", "q2", "q3", "q4"];

  return (
    <>
      <TitleRow kicker={`LEAGUE VIEW · ${formatDay(now, tz).toUpperCase()} · ${formatTime(now, tz)} SAST`} title={phase === "pregame" ? "The away game is coming." : phase === "postgame" ? "The away game is over." : "The away game is on."} blurb={`One man in ${ctx.event.away_town}. An entire league enjoying it.`} tag={QUARTER_LABELS[phase]} team="nyg" />
      <div className="pb-broadcast">
        <div>
          <div className="pb-broadcast-head">
            <Shield size={25} height={34} />
            <div className="pb-kicker">POFADDER BOWL · PUNISHMENT SERIES</div>
          </div>
          <h2>{PHASE_HEADINGS[phase].toUpperCase()}</h2>
          <p className="pb-small">{name.toUpperCase()} vs THE CONSEQUENCES</p>
          <div className="pb-quarters">
            {quarters.map((key, i) => (
              <span key={key} className={phase === key ? "active" : ""}>
                {QUARTER_LABELS[key]}
                {i + 1 < q || phase === "postgame" ? " ✓" : ""}
              </span>
            ))}
          </div>
        </div>
        <div className="pb-score">
          {score.approved}
          <small>OF {score.max} APPROVED</small>
        </div>
      </div>

      <div className="pb-centre-top">
        <div className="pb-panel pb-plain-map">
          <CheckinMap pins={latest ? [{ id: latest.id, latitude: latest.latitude, longitude: latest.longitude, label: `${name} · ${placeLabel(latest)} · ${formatTime(latest.captured_at, tz)}`, kind: "current" }] : []} path={checkinPath(checkins)} focus={latest ? { latitude: latest.latitude, longitude: latest.longitude } : undefined} />
          <div className="pb-location">
            <div>
              <b>{latest ? `${placeLabel(latest)} · ${formatTime(latest.captured_at, tz)} SAST` : "No check-in yet"}</b>
              <span className="pb-small">{latest ? `${ageLabel(latest.captured_at)} · ±${latest.accuracy_m != null ? Math.round(latest.accuracy_m) : "?"} m${isStale(latest.captured_at) ? " · stale" : ""}` : "Waiting for the participant to share a position."}</span>
            </div>
            <Link className="pb-text-action" href="/map">Open map ↗</Link>
          </div>
        </div>
        <div className="pb-next-drive">
          <div className="pb-panel-top">
            <div className="pb-kicker">{next.challenge ? `NEXT DRIVE · ${next.challenge.points} POINTS` : "NEXT DRIVE"}</div>
            <span className="pb-down-marker" aria-label={`Quarter ${q || 1}`}>{q || 1}</span>
          </div>
          <h2>{next.item ? next.item.title : phase === "postgame" ? "Sentence served." : "Kickoff pending."}</h2>
          <p className="pb-small">{next.item ? `${formatDay(next.item.starts_at, tz)} ${formatTime(next.item.starts_at, tz)} · ${next.item.description ?? ""}${next.item.venue_text ? ` · ${next.item.venue_text}` : ""}` : "The itinerary is complete."}</p>
          <div className="pb-drive-stripe" aria-hidden="true" />
          {ctx.isParticipant || ctx.isCommissioner ? (
            <Link className="pb-primary orange" href="/proof">Open the proof locker ↗</Link>
          ) : (
            <Link className="pb-primary orange" href="/bingo">Open Punishment Bingo ↗</Link>
          )}
          <div className="pb-next" style={{ marginTop: "auto" }}>
            <div className="pb-kicker">RETURN BUS · {formatTime(ctx.event.return_departure_at, tz)}</div>
            <h3>
              <Countdown targetIso={ctx.event.return_departure_at} passedLabel="Bus has departed" />
            </h3>
            <p>KLK Garage · {formatDay(ctx.event.return_departure_at, tz)} · No second bus</p>
          </div>
        </div>
      </div>

      <Suspense fallback={<LoadingPlay compact label="Pulling the losers bracket from Sleeper…" />}>
        <LosersBracketPanel leagueId={ctx.league.sleeper_league_id ?? sleeperLeagueId() ?? null} />
      </Suspense>

      {feedResult.error ? (
        <section className="pb-sideline">
          <div className="pb-status" role="alert" style={{ borderLeftColor: "#b3392a" }}>
            The sideline feed could not be loaded ({feedResult.error}). Refresh to try again.
          </div>
        </section>
      ) : (
        <SidelineFeed initialPosts={feedResult.posts} eventId={ctx.event.id} timezone={tz} />
      )}
    </>
  );
}
