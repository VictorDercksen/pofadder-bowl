import { checkQuery } from "@/lib/query-error";
import Link from "next/link";
import { MemberBadge, Shield } from "@/components/ui/Marks";
import { IconLink } from "@/components/ui/IconButton";
import { TitleRow } from "@/components/ui/TitleRow";
import { PenaltyList, ResultsForm, CertificateIssue, ResolutionControl } from "@/components/review/CommissionerTools";
import { getEventScore, requireCommissioner } from "@/lib/league";
import { loadSubmissions } from "@/lib/evidence";
import { isResolutionOpen } from "@/lib/resolution";
import { formatDateTime, minuteOfDay, nowMs } from "@/lib/time";

export const metadata = { title: "Commissioner" };

export default async function ReviewPage() {
  const ctx = await requireCommissioner();
  const tz = ctx.event.timezone;
  const [subs, score, { data: challenges, error: challengesError }, { data: penalties, error: penaltiesError }, { data: results, error: resultsError }, { data: certificate, error: certificateError }, { data: props, error: propsError }, { data: decisions, error: decisionsError }, { data: profiles, error: profilesError }, { count: flagCount }] = await Promise.all([
    loadSubmissions(ctx),
    getEventScore(ctx),
    ctx.supabase.from("challenges").select("id, sequence, title, points").eq("event_id", ctx.event.id),
    ctx.supabase.from("penalties").select("*").eq("event_id", ctx.event.id).order("sequence"),
    ctx.supabase.from("official_results").select("*").eq("event_id", ctx.event.id).maybeSingle(),
    ctx.supabase.from("certificates").select("*").eq("event_id", ctx.event.id).maybeSingle(),
    ctx.supabase.from("props").select("id, sequence, locks_at, result").eq("event_id", ctx.event.id).order("sequence"),
    ctx.supabase.from("review_decisions").select("*, submission:evidence_submissions!inner(event_id)").eq("submission.event_id", ctx.event.id).order("created_at", { ascending: false }).limit(8),
    ctx.supabase.from("profiles").select("id, display_name, kit_team"),
    ctx.supabase.from("review_decisions").select("id, submission:evidence_submissions!inner(event_id)", { count: "exact", head: true }).eq("submission.event_id", ctx.event.id).eq("decision", "flagged"),
  ]);
  checkQuery(challengesError, "review challenges");
  checkQuery(penaltiesError, "review penalties");
  checkQuery(resultsError, "review results");
  checkQuery(certificateError, "review certificate");
  checkQuery(propsError, "review props");
  checkQuery(decisionsError, "review decisions");
  checkQuery(profilesError, "review profiles");
  const byChallenge = new Map((challenges ?? []).map((c) => [c.id, c]));
  const names = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));
  const kits = new Map((profiles ?? []).map((p) => [p.id, p.kit_team]));
  const queue = subs.filter((s) => s.status === "submitted");
  const resolutionOpen = isResolutionOpen(ctx.event.resolution_opened_at);
  const canCloseResolution = !(props ?? []).some((p) => p.result != null) && !results?.resolved_at;
  const openProps = resolutionOpen ? (props ?? []).filter((p) => p.result == null && Date.parse(p.locks_at) <= nowMs()) : [];
  const others = subs.filter((s) => s.status !== "submitted" && s.status !== "draft");
  const approvedRating = subs.find((s) => s.status === "approved" && s.rating != null)?.rating ?? null;
  // Defaults for the official results: the daylight sign photo (#04) settles on its first submission time.
  const signChallenge = (challenges ?? []).find((c) => /daylight/i.test(c.title)) ?? (challenges ?? []).find((c) => c.sequence === 4);
  const signSubmittedAt = subs.filter((s) => s.challenge_id === signChallenge?.id && s.submitted_at).map((s) => s.submitted_at as string).sort()[0];
  const defaults = { rating: approvedRating, finalScore: score.approvedChallenges > 0 ? score.approved : null, signPhotoMinutes: signSubmittedAt ? minuteOfDay(signSubmittedAt, tz) : null, flagCount: flagCount ?? null };

  return (
    <>
      <TitleRow kicker="COMMISSIONER’S VIEW" title="Under review." blurb="Watch the evidence. Make the call. Put the points on the board." tag="REVIEW ACCESS" identity={<span className="pb-official-patch">LEAGUE<br />OFFICIAL</span>} />
      <div className="pb-split">
        <div>
          <div className="pb-panel" data-tour="review-queue">
            <div className="pb-panel-top">
              <h3>
                Awaiting review
                {queue.length ? <span className="pb-badge-count">{queue.length}</span> : null}
              </h3>
              {ctx.isAdmin ? <IconLink icon="members" label="Members and invites" href="/review/members" /> : <span className="pb-small">Roster changes: admin only</span>}
            </div>
            {queue.length === 0 ? <p className="pb-small">Nothing waiting. Submitted proof lands here with its version number.</p> : null}
            {queue.map((s) => {
              const c = s.challenge_id ? byChallenge.get(s.challenge_id) : undefined;
              return (
                <div className="pb-challenge" key={s.id}>
                  <span className="pb-num">{c ? String(c.sequence).padStart(2, "0") : "PR"}</span>
                  <div style={{ minWidth: 0 }}>
                    <strong>{c ? c.title : "Press room answer"}</strong>
                    <p>
                      v{s.version} · {s.files.length} file(s) · <MemberBadge code={kits.get(s.submitter_id)} name={names.get(s.submitter_id) ?? "participant"} size={20} /> · submitted {s.submitted_at ? formatDateTime(s.submitted_at, tz) : "—"}
                      {c ? ` · ${c.points} points` : ""}
                    </p>
                  </div>
                  <Link className="pb-primary" href={`/review/${s.id}`} style={{ marginLeft: "auto", flexShrink: 0 }}>Review</Link>
                </div>
              );
            })}
          </div>
          <div className="pb-panel" style={{ marginTop: 15 }}>
            <h3>Reviewed</h3>
            {others.length === 0 ? <p className="pb-small">No decisions yet.</p> : null}
            {others.slice(0, 12).map((s) => {
              const c = s.challenge_id ? byChallenge.get(s.challenge_id) : undefined;
              return (
                <div className="pb-challenge" key={s.id}>
                  <span className="pb-num">{s.status === "approved" ? "✓" : s.status === "flagged" ? "⚑" : "↺"}</span>
                  <div style={{ minWidth: 0 }}>
                    <strong>{c ? c.title : "Press room answer"}</strong>
                    <p>
                      v{s.version} · {s.status}
                    </p>
                  </div>
                  <Link className="pb-secondary" href={`/review/${s.id}`} style={{ marginLeft: "auto", flexShrink: 0 }}>Open</Link>
                </div>
              );
            })}
          </div>
          <div className="pb-panel" style={{ marginTop: 15 }}>
            <h3>Resolve props and predictions</h3>
            <ResolutionControl openedAt={ctx.event.resolution_opened_at} canClose={canCloseResolution} locked={nowMs() >= Date.parse(ctx.event.prediction_lock_at)} timezone={tz} />
          </div>
          <div className="pb-panel" style={{ marginTop: 15 }}>
            <h3>
              Props to settle
              {openProps.length ? <span className="pb-badge-count">{openProps.length}</span> : null}
            </h3>
            {openProps.length > 0 ? (
              <p className="pb-small" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span>{openProps.length} locked and unsettled.</span>
                <IconLink icon="board" label="Settle on the prop board" href="/props" small />
              </p>
            ) : (props ?? []).some((p) => p.result == null) ? (
              <p className="pb-small">Props settle once you press Resolve props and predictions.</p>
            ) : (
              <p className="pb-small">Every prop is settled.</p>
            )}
          </div>
        </div>
        <div className="pb-panel" data-tour="review-tools">
          <div className="pb-official-strip" aria-hidden="true" />
          <div className="pb-panel-top">
            <h3>Scoreboard</h3>
            <Shield />
          </div>
          <div className="pb-stat-row">
            <div className="pb-stat">
              <strong>{score.approved}</strong>
              <small>APPROVED POINTS</small>
            </div>
            <div className="pb-stat">
              <strong>{queue.length}</strong>
              <small>AWAITING REVIEW</small>
            </div>
            <div className="pb-stat">
              <strong>
                {score.approvedChallenges}/{score.total}
              </strong>
              <small>PLAYS APPROVED</small>
            </div>
          </div>
          <h3>Latest decisions</h3>
          {(decisions ?? []).length === 0 ? <p className="pb-small">No decisions recorded.</p> : null}
          {(decisions ?? []).map((d) => {
            const s = subs.find((x) => x.id === d.submission_id);
            const c = s?.challenge_id ? byChallenge.get(s.challenge_id) : undefined;
            return (
              <div className="pb-challenge" key={d.id}>
                <span className="pb-num">{d.decision === "approved" ? "✓" : d.decision === "flagged" ? "⚑" : "↺"}</span>
                <div>
                  <strong>
                    {c ? c.title : "Press room answer"} · v{d.submission_version} {d.decision}
                  </strong>
                  <p>
                    <MemberBadge code={kits.get(d.actor_id)} name={names.get(d.actor_id) ?? "commissioner"} size={20} /> · {formatDateTime(d.created_at, tz)}
                    {d.reason ? ` · ${d.reason}` : ""}
                  </p>
                </div>
              </div>
            );
          })}
          <PenaltyList penalties={penalties ?? []} />
          <ResultsForm results={results ?? null} timezone={tz} defaults={defaults} resolutionOpen={resolutionOpen} />
          <CertificateIssue certificate={certificate ?? null} approved={score.approved} max={score.max} timezone={tz} />
        </div>
      </div>
    </>
  );
}
