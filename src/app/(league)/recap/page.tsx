import { Suspense } from "react";
import { LeaguePatch, Shield, TeamLogo } from "@/components/ui/Marks";
import { TitleRow } from "@/components/ui/TitleRow";
import { CertificateExport, ConsentToggle } from "@/components/recap/CertificateExport";
import { MediaGallery } from "@/components/proof/MediaGallery";
import { RunTrack, RunTrackSkeleton } from "@/components/map/RunTrackPanel";
import { trackFileOf } from "@/lib/run-track";
import { getEventScore, getLeagueContext } from "@/lib/league";
import { loadSubmissions } from "@/lib/evidence";
import { propWinners } from "@/lib/props";
import { loadCheckins, participantName } from "@/lib/checkins";
import { publicEnv } from "@/lib/env";
import { eventPhase, formatDateTime, formatLongDate, secondsToClock } from "@/lib/time";

export const metadata = { title: "Final whistle" };

export default async function RecapPage() {
  const ctx = await getLeagueContext();
  const tz = ctx.event.timezone;
  const [score, subs, checkins, name, { data: cert }, { data: results }, { data: standings }, { data: awards }, { data: profiles }, { data: challenges }, { data: penalties }] = await Promise.all([
    getEventScore(ctx),
    loadSubmissions(ctx),
    loadCheckins(ctx, 200),
    participantName(ctx),
    ctx.supabase.from("certificates").select("*").eq("event_id", ctx.event.id).maybeSingle(),
    ctx.supabase.from("official_results").select("*").eq("event_id", ctx.event.id).maybeSingle(),
    ctx.supabase.rpc("prop_leaderboard", { p_event: ctx.event.id }),
    ctx.supabase.from("prediction_awards").select("*").eq("event_id", ctx.event.id),
    ctx.supabase.from("profiles").select("id, display_name"),
    ctx.supabase.from("challenges").select("*").eq("event_id", ctx.event.id).order("sequence"),
    ctx.supabase.from("penalties").select("*").eq("event_id", ctx.event.id).eq("applied", true),
  ]);
  const names = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));
  const approved = subs.filter((s) => s.status === "approved" && s.challenge_id);
  const phase = eventPhase(ctx.event);
  const issued = cert?.status === "issued";
  // Most correct calls share the prize; nobody wins on zero.
  const propWinnerIds = propWinners((standings ?? []).map((r) => [r.user_id, { correct: r.correct, wrong: r.wrong, pending: 0 }]));
  const propWinnerNames = propWinnerIds.map((id) => names.get(id) ?? "member");
  const propsSettled = (standings ?? []).some((r) => r.correct + r.wrong > 0);
  const predTotals = new Map<string, number>();
  for (const a of awards ?? []) predTotals.set(a.user_id, (predTotals.get(a.user_id) ?? 0) + a.points);
  const predWinners = [...predTotals.entries()].sort((a, b) => b[1] - a[1]);
  const topPred = predWinners.length ? predWinners.filter(([, p]) => p === predWinners[0][1]).map(([id]) => names.get(id) ?? "member") : [];
  const highlightFiles = approved.flatMap((s) => s.files.filter((f) => f.kind === "photo" || f.kind === "video").slice(0, 1)).slice(0, 6);
  // The approved run trace, if the watch export was a readable GPX/TCX.
  const runProof = approved.find((s) => (challenges ?? []).find((c) => c.id === s.challenge_id)?.proof_type.toLowerCase().includes("export") && trackFileOf(s.files)) ?? null;
  const summary = {
    participant: name,
    approved: score.approved,
    max: score.max,
    approvedChallenges: score.approvedChallenges,
    total: score.total,
    runKm: results?.run_distance_km != null ? Number(results.run_distance_km) : null,
    runTime: results?.run_seconds != null ? secondsToClock(results.run_seconds) : null,
    checkins: checkins.length,
    propWinners: propWinnerNames,
    predictionWinners: topPred,
    issuedAt: cert?.issued_at ? formatLongDate(cert.issued_at, tz) : null,
    eventName: ctx.event.name,
  };
  const publicUrl = `${publicEnv.appOrigin}/recap/public/${ctx.league.slug}/${ctx.event.slug}`;

  return (
    <>
      <TitleRow kicker={`POSTGAME VIEW · ${issued ? "COMMISSIONER CERTIFIED" : phase === "postgame" ? "AWAITING CERTIFICATION" : "IN PROGRESS"}`} title={issued ? "Sentence served." : "The final whistle."} blurb={issued ? "The bus made it home. The group chat will never let this go." : "The recap builds itself from approved evidence, real check-ins and confirmed results."} tag={issued ? "CERTIFIED" : "PENDING"} team={ctx.profile.kit_team} />
      <div className="pb-certificate" id="certificate" data-tour="certificate">
        <div className="pb-kicker">SHOW US YOUR TD’S · {issued ? "COMMISSIONER CERTIFIED" : "CERTIFICATE PENDING"}</div>
        <div className="pb-champion-crest">
          <TeamLogo code={ctx.profile.kit_team} decorative size={55} />
          <Shield size={41} height={53} />
          <LeaguePatch />
        </div>
        <h2>{issued ? `${name.split(" ")[0]} survived Pofadder.` : "Not certified yet."}</h2>
        <p>
          {issued ? "Two overnight buses. Ten kilometres. Ten plays." : "The certificate stays pending until the commissioner issues it from the approved state."}
          <br />
          {issued ? "One outstanding contribution to league entertainment." : "Nothing here inherits demo values."}
        </p>
        <div className="pb-stat-row">
          <div className="pb-stat">
            <strong>
              {score.approved} / {score.max}
            </strong>
            <small>APPROVED PROOF</small>
          </div>
          <div className="pb-stat">
            <strong>{summary.runKm != null ? `${summary.runKm.toFixed(2)} km` : "—"}</strong>
            <small>RUN {summary.runTime ? `· ${summary.runTime}` : "(OFFICIAL)"}</small>
          </div>
          <div className="pb-stat">
            <strong>
              {score.approvedChallenges} / {score.total}
            </strong>
            <small>CHALLENGES SERVED</small>
          </div>
        </div>
        <div className="pb-signature">{issued ? "The Commissioner" : "Awaiting the Commissioner"}</div>
        <p className="pb-small">{issued && cert?.issued_at ? `Issued ${formatDateTime(cert.issued_at, tz)}` : `${checkins.length} check-in(s) on record · ${(penalties ?? []).length} penalt${(penalties ?? []).length === 1 ? "y" : "ies"} applied`}</p>
        <div className="pb-ticket-stub">
          <span>PB26 · {issued ? "SENTENCE CLOSED" : "SENTENCE OPEN"}</span>
          <span className="pb-bars" aria-hidden="true" />
        </div>
      </div>

      <div className="pb-photo-slots">
        {(["THE ARRIVAL", "THE RUN", "THE RETURN"] as const).map((label, i) => {
          const seq = [1, 2, 10][i];
          const s = approved.find((x) => (challenges ?? []).find((c) => c.id === x.challenge_id)?.sequence === seq);
          return (
            <div key={label}>
              {label}
              <small>{s ? `Approved v${s.version} · ${s.files.length} file(s)` : "Not yet approved"}</small>
            </div>
          );
        })}
      </div>

      <div className="pb-split">
        <div className="pb-panel">
          <h3>League honours</h3>
          <div className="pb-rank">
            <span className="pb-ranking-num">★</span>
            <div>
              Prop board winner{propWinnerNames.length === 1 ? "" : "s"} · 5 FAAB in Sleeper
              <br />
              <b>{propWinnerNames.length ? propWinnerNames.join(", ") : propsSettled ? "No correct calls" : "Not settled yet"}</b>
            </div>
          </div>
          <div className="pb-rank">
            <span className="pb-ranking-num">★</span>
            <div>
              Prediction winner{topPred.length === 1 ? "" : "s"} · 5 FAAB in Sleeper
              <br />
              <b>{topPred.length ? topPred.join(", ") : results?.resolved_at ? "No awards" : "Not resolved yet"}</b>
            </div>
          </div>
          <h3 style={{ marginTop: 16 }}>Approved plays</h3>
          {approved.length === 0 ? <p className="pb-small">No approved evidence yet.</p> : null}
          {approved.map((s) => {
            const c = (challenges ?? []).find((x) => x.id === s.challenge_id);
            return (
              <div className="pb-challenge" key={s.id}>
                <span className="pb-num">{c ? String(c.sequence).padStart(2, "0") : "—"}</span>
                <div>
                  <strong>{c?.title}</strong>
                  <p>
                    +{c?.points} · v{s.version}
                    {s.caption ? ` · “${s.caption}”` : ""}
                  </p>
                </div>
              </div>
            );
          })}
          {(penalties ?? []).length ? (
            <>
              <h3 style={{ marginTop: 16 }}>Penalties applied</h3>
              {(penalties ?? []).map((p) => (
                <p key={p.id} className="pb-small pb-warn-text">
                  ⚑ {p.text}
                  {p.note ? ` · ${p.note}` : ""}
                </p>
              ))}
            </>
          ) : null}
        </div>
        <div className="pb-panel">
          <h3>The highlight reel</h3>
          <p className="pb-small" style={{ marginTop: 10 }}>Approved clips and photos, private to the league. Links are signed for a few minutes at a time.</p>
          {highlightFiles.length ? <MediaGallery files={highlightFiles.map((f) => ({ id: f.id, kind: f.kind, name: f.original_name ?? "file", mime: f.mime_type }))} /> : <p className="pb-small">No approved media yet.</p>}
          {runProof ? (
            <div style={{ marginTop: 16 }}>
              <h3>The run, as recorded</h3>
              <p className="pb-small" style={{ margin: "6px 0 10px" }}>Approved v{runProof.version}. The watch export drawn as uploaded.</p>
              <Suspense fallback={<RunTrackSkeleton />}>
                <RunTrack files={runProof.files} participant={name} />
              </Suspense>
            </div>
          ) : null}
          <CertificateExport summary={summary} issued={issued} kitTeam={ctx.profile.kit_team} />
          {ctx.isParticipant ? <ConsentToggle consent={cert?.participant_consent ?? false} isPublic={cert?.is_public ?? false} publicUrl={publicUrl} /> : null}
          {ctx.isCommissioner ? (
            <p className="pb-small" style={{ marginTop: 10 }}>
              Public recap: {cert?.is_public ? "allowed by commissioner" : "not allowed"} · participant consent {cert?.participant_consent ? "given" : "not given"}. {cert?.is_public && cert?.participant_consent && issued ? `Live at ${publicUrl}` : "Both are required for the public page."}
            </p>
          ) : null}
        </div>
      </div>
    </>
  );
}
