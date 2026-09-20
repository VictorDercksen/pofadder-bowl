import { Suspense } from "react";
import { notFound } from "next/navigation";
import { MemberBadge } from "@/components/ui/Marks";
import { EmptyState, TitleRow } from "@/components/ui/TitleRow";
import { IconLink } from "@/components/ui/IconButton";
import { RatingBadge, RatingSelector } from "@/components/ui/RatingSelector";
import { EvidenceUploader } from "@/components/proof/EvidenceUploader";
import { MediaGallery } from "@/components/proof/MediaGallery";
import { RunTrack, RunTrackSkeleton } from "@/components/map/RunTrackPanel";
import { getLeagueContext } from "@/lib/league";
import { loadParticipantProfile, loadSubmissions, statusHeading } from "@/lib/evidence";
import { trackFileOf } from "@/lib/run-track";
import { formatDateTime } from "@/lib/time";

export const metadata = { title: "Challenge proof" };

/**
 * One play. The participant uploads here; commissioners preview; league members get the
 * evidence and the audit trail read-only. Drafts never reach members (row-level security),
 * so their "current" version is the latest submitted one.
 */
export default async function ChallengeProofPage(props: PageProps<"/proof/[challengeId]">) {
  const { challengeId } = await props.params;
  const ctx = await getLeagueContext();
  const league = !ctx.isParticipant && !ctx.isCommissioner;
  const { data: challenge } = await ctx.supabase.from("challenges").select("*").eq("id", challengeId).eq("event_id", ctx.event.id).maybeSingle();
  if (!challenge) notFound();
  const [subs, participant] = await Promise.all([loadSubmissions(ctx).then((all) => all.filter((s) => s.challenge_id === challenge.id)), league ? loadParticipantProfile(ctx) : Promise.resolve(null)]);
  const current = subs[0] ?? null;
  const { data: decisions } = current ? await ctx.supabase.from("review_decisions").select("*").in("submission_id", subs.map((s) => s.id)).order("created_at", { ascending: false }) : { data: [] };
  const tz = ctx.event.timezone;
  const seq = String(challenge.sequence).padStart(2, "0");

  const isRun = challenge.proof_type.toLowerCase().includes("export");
  const rated = challenge.rated;
  const ratingLabel = rated ? `${challenge.title.split(",")[0]} rating` : "Rating";
  const trace = current && isRun ? trackFileOf(current.files) : null;

  const nav = (
    <nav className="pb-icon-nav" aria-label="Proof navigation">
      <IconLink icon="back" label="Back to the proof locker" href="/proof" />
      <IconLink icon="feed" label="Main feed" href="/game-centre" />
    </nav>
  );

  const versions = (
    <div className="pb-panel">
      <h3>Versions and decisions</h3>
      {subs.length === 0 ? <p className="pb-small">{league ? "Nothing submitted yet." : "No versions yet."}</p> : null}
      {subs.map((s) => (
        <div className="pb-challenge" key={s.id}>
          <span className="pb-num">v{s.version}</span>
          <div>
            <strong>{s.status.toUpperCase()}</strong>
            <p>
              {s.files.length} file(s) · {s.submitted_at ? `submitted ${formatDateTime(s.submitted_at, tz)}` : `created ${formatDateTime(s.created_at, tz)}`}
              {rated ? <> · <RatingBadge value={s.rating} /></> : null}
              {s.caption ? ` · “${s.caption}”` : ""}
            </p>
            {(decisions ?? []).filter((d) => d.submission_id === s.id).map((d) => (
              <p key={d.id} className={d.decision === "flagged" ? "pb-warn-text" : undefined}>
                {d.decision.toUpperCase()} · {formatDateTime(d.created_at, tz)}
                {d.reason ? ` · ${d.reason}` : ""}
                {d.note ? ` · Note: ${d.note}` : ""}
              </p>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  if (league) {
    const who = participant?.display_name ?? "The participant";
    return (
      <>
        <TitleRow kicker={`LEAGUE VIEW · CHALLENGE #${seq}`} title={challenge.title} blurb={<><MemberBadge code={participant?.kit_team} name={who} number={participant?.kit_number} /> · {challenge.proof_type} · {challenge.points} points.</>} tag={current ? statusHeading(current.status).toUpperCase() : "AWAITING PROOF"} team={participant?.kit_team} />
        {nav}
        <div className="pb-split">
          <div>
            {current ? (
              <>
                <div className="pb-clip">
                  <small>PROOF #{seq} · VERSION {current.version} · {statusHeading(current.status).toUpperCase()}</small>
                  <h2>{current.caption ? `“${current.caption}”` : "No caption supplied."}</h2>
                  {rated ? <RatingSelector value={current.rating} label={ratingLabel} readOnly tone="dark" caption={`${who}’s verdict`} /> : null}
                  <small>
                    {current.files.length} FILE(S) · {current.submitted_at ? `SUBMITTED ${formatDateTime(current.submitted_at, tz).toUpperCase()}` : "NOT SUBMITTED"}
                  </small>
                </div>
                {isRun && trace ? (
                  <div className="pb-panel pb-run-panel" style={{ marginTop: 15 }}>
                    <div className="pb-panel-top">
                      <h3>The route, as recorded</h3>
                      <span className={`pb-tag ${current.status === "approved" ? "" : "orange"}`}>V{current.version} · {current.status.toUpperCase()}</span>
                    </div>
                    <Suspense fallback={<RunTrackSkeleton />}>
                      <RunTrack files={current.files} participant={who} />
                    </Suspense>
                  </div>
                ) : null}
                <div className="pb-panel" style={{ marginTop: 15 }}>
                  <h3>Evidence</h3>
                  {current.files.length === 0 ? <p className="pb-small">No files on this version.</p> : <MediaGallery files={current.files.map((f) => ({ id: f.id, kind: f.kind, name: f.original_name ?? "file", mime: f.mime_type }))} />}
                  <p className="pb-small" style={{ marginTop: 10 }}>Read-only. Previews open through short-lived links; loading one changes nothing in the review.</p>
                </div>
              </>
            ) : (
              <EmptyState title="No proof yet.">{who} has not submitted anything for this play. Submitted versions appear here with their files and the commissioner’s call.</EmptyState>
            )}
          </div>
          {versions}
        </div>
      </>
    );
  }

  const accept = challenge.proof_type.includes("photo") ? "image/*" : challenge.proof_type.includes("clip") ? "video/*" : isRun ? ".gpx,.tcx,.fit,.csv,image/*,application/pdf" : "image/*,video/*,application/pdf";

  return (
    <>
      <TitleRow kicker={`VICTOR’S VIEW · CHALLENGE #${seq}`} title={challenge.title} blurb={`${challenge.proof_type} · ${challenge.points} points.`} tag={`${challenge.points} POINTS AVAILABLE`} team={ctx.profile.kit_team} />
      {nav}
      <div className="pb-split">
        <div>
          {!ctx.isParticipant ? (
            <div className="pb-status" role="status">Commissioner preview: only the participant can upload evidence.</div>
          ) : (
            <EvidenceUploader
              targetKind="challenge"
              targetId={challenge.id}
              targetTitle={challenge.title}
              accept={accept}
              current={current ? { id: current.id, version: current.version, status: current.status, caption: current.caption, rating: current.rating, files: current.files } : null}
              captureHint={isRun ? "Upload the watch export (GPX or TCX, FIT as a backup) plus a screenshot. The GPX line is what the commissioner approves and what the league sees on the map." : rated ? "Upload the rating clip, then give the score out of ten. The score goes on the record and settles the league’s rating predictions." : undefined}
              rated={rated}
              ratingLabel={ratingLabel}
            />
          )}
          {isRun && current ? (
            <div className="pb-panel pb-run-panel" style={{ marginTop: 18 }}>
              <div className="pb-panel-top">
                <h3>Your route, as the league sees it</h3>
                <span className={`pb-tag ${current.status === "approved" ? "" : "orange"}`}>V{current.version} · {current.status.toUpperCase()}</span>
              </div>
              {trace ? (
                <Suspense fallback={<RunTrackSkeleton />}>
                  <RunTrack files={current.files} participant={ctx.profile.display_name} />
                </Suspense>
              ) : (
                <p className="pb-small">No GPX or TCX file on this version yet. Attach the watch export and it is drawn here before you submit.</p>
              )}
            </div>
          ) : null}
        </div>
        <div>
          {versions}
          {current && current.files.length > 0 ? (
            <div className="pb-panel" style={{ marginTop: 18 }}>
              <h3>Preview</h3>
              <MediaGallery files={current.files.map((f) => ({ id: f.id, kind: f.kind, name: f.original_name ?? "file", mime: f.mime_type }))} />
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
