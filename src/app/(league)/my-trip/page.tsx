import Link from "next/link";
import { LeaguePatch, Shield, TeamLogo } from "@/components/ui/Marks";
import { TitleRow } from "@/components/ui/TitleRow";
import { Countdown } from "@/components/ui/Countdown";
import { OriginStory } from "@/components/trip/OriginStory";
import { LocationSharing } from "@/components/map/LocationSharing";
import { getEventScore, requireParticipant } from "@/lib/league";
import { loadChallenges, loadItinerary } from "@/lib/itinerary";
import { latestFor, loadSubmissions, statusLabel } from "@/lib/evidence";
import { loadCheckins, loadLocationSettings } from "@/lib/checkins";
import { ageLabel, eventPhase, formatDay, formatTime, quarterNumber } from "@/lib/time";

export const metadata = { title: "My trip" };

const QUARTER_NAMES = ["", "Outbound", "The run", "Town duty", "Homebound"];

export default async function MyTripPage() {
  const ctx = await requireParticipant();
  const now = new Date();
  const tz = ctx.event.timezone;
  const [score, itinerary, challenges, subs, settings, checkins] = await Promise.all([getEventScore(ctx), loadItinerary(ctx), loadChallenges(ctx), loadSubmissions(ctx), loadLocationSettings(ctx), loadCheckins(ctx, 1)]);
  const phase = eventPhase(ctx.event, now);
  const q = quarterNumber(phase);
  const nextChallenge = challenges.find((c) => latestFor(subs, { challengeId: c.id })?.status !== "approved");
  const drafts = subs.filter((s) => s.status === "draft").length;
  const pendingReview = subs.filter((s) => s.status === "submitted").length;
  const flagged = subs.filter((s) => s.status === "flagged").length;
  const latest = checkins[0];
  const firstName = ctx.profile.display_name.split(" ")[0];

  return (
    <>
      <TitleRow kicker="VICTOR’S VIEW · MOBILE FIRST" title="Your next play." blurb="Check in. Get the proof. Survive the group chat." tag={ctx.isParticipant ? "PARTICIPANT" : "COMMISSIONER PREVIEW"} team={ctx.profile.kit_team} />
      <div className="pb-split">
        <div className="pb-phone" data-tour="trip-phone">
          <div className="pb-phone-top">
            <b>{formatTime(now, tz)}</b>
            <span>{formatDay(now, tz)} · SAST</span>
          </div>
          <div className="pb-kicker">{phase === "pregame" ? "PREGAME" : phase === "postgame" ? "FULL TIME" : `QUARTER ${["", "ONE", "TWO", "THREE", "FOUR"][q]} · ${QUARTER_NAMES[q].toUpperCase()}`}</div>
          <div className="pb-logo-stage">
            <TeamLogo code={ctx.profile.kit_team} size={44} />
            <LeaguePatch />
            <Shield size={35} height={44} />
          </div>
          <h2>
            {phase === "pregame" ? `Pack the bag, ${firstName}.` : `Morning, ${firstName}.`}
            <br />
            No appeals today.
          </h2>
          <div className="pb-broadcast">
            <div>
              <div className="pb-kicker">APPROVED</div>
              <h3>
                Sentence
                <br />
                {phase === "postgame" ? "served" : "in progress"}
              </h3>
            </div>
            <div className="pb-score">
              {score.approved}
              <small>/ {score.max} POINTS</small>
            </div>
          </div>
          {nextChallenge ? (
            <>
              <div className="pb-kicker">UP NEXT · {nextChallenge.points} POINTS</div>
              <h3>{nextChallenge.title}</h3>
              <p className="pb-small" style={{ marginTop: 8 }}>
                {nextChallenge.proof_type} · {statusLabel(latestFor(subs, { challengeId: nextChallenge.id }), nextChallenge.points)}
              </p>
            </>
          ) : (
            <h3>All ten plays approved.</h3>
          )}
          <div className="pb-actions">
            <Link className="pb-primary orange" href={nextChallenge ? `/proof/${nextChallenge.id}` : "/proof"}>Add challenge proof ↗</Link>
            <Link className="pb-secondary" href="/map">Check in on the map ↗</Link>
          </div>
          <p className="pb-small" style={{ marginTop: 12 }}>
            {latest ? `Last shared ${formatTime(latest.captured_at, tz)} (${ageLabel(latest.captured_at)})` : "No check-in shared yet"} · {settings.sharing_enabled ? "League can view" : "Sharing paused"}
          </p>
          <div className="pb-chip-row" aria-label="Upload status">
            <span className={`pb-chip ${drafts ? "warn" : ""}`}>{drafts} draft{drafts === 1 ? "" : "s"}</span>
            <span className={`pb-chip ${pendingReview ? "on" : ""}`}>{pendingReview} in review</span>
            <span className={`pb-chip ${flagged ? "warn" : ""}`}>{flagged} flagged</span>
          </div>
          <div className="pb-next">
            <h3>{formatTime(ctx.event.return_departure_at, tz)}. Don’t miss it.</h3>
            <p>
              Return bus · KLK Garage · <Countdown targetIso={ctx.event.return_departure_at} passedLabel="departed" />
            </p>
          </div>
          <div className="pb-phone-tabs">
            <Link href="/my-trip" className="pb-text-action" style={{ color: "var(--pb-ink)", textDecoration: "none" }}>My trip</Link>
            <Link href="/proof" className="pb-text-action" style={{ color: "var(--pb-ink)", textDecoration: "none" }}>Proof</Link>
            <Link href="/props" className="pb-text-action" style={{ color: "var(--pb-ink)", textDecoration: "none" }}>Props</Link>
            <Link href="/game-centre" className="pb-text-action" style={{ color: "var(--pb-ink)", textDecoration: "none" }}>Main feed</Link>
          </div>
        </div>
        <div>
          <div className="pb-panel">
            <h3>Your game plan</h3>
            {[1, 2, 3, 4].map((quarter) => (
              <div className="pb-quarter-block" key={quarter}>
                <h3>
                  Q{quarter} · {QUARTER_NAMES[quarter]}
                </h3>
                {itinerary
                  .filter((i) => i.quarter === quarter)
                  .map((i) => (
                    <div className="pb-challenge" key={i.id}>
                      <span className="pb-time">{formatTime(i.starts_at, tz)}</span>
                      <div>
                        <strong>{i.title}</strong>
                        <p>
                          {formatDay(i.starts_at, tz)} · {i.description}
                          {i.venue_text ? ` · ${i.venue_text}` : ""}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            ))}
          </div>
          {ctx.isParticipant ? (
            <div style={{ marginTop: 18 }}>
              <LocationSharing initial={settings} checkinIds={[]} />
            </div>
          ) : null}
        </div>
      </div>
      <OriginStory />
    </>
  );
}
