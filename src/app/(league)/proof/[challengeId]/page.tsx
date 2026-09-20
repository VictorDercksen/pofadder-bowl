import { Suspense } from "react";
import { notFound } from "next/navigation";
import { TitleRow } from "@/components/ui/TitleRow";
import { IconLink } from "@/components/ui/IconButton";
import { EvidenceUploader } from "@/components/proof/EvidenceUploader";
import { MediaGallery } from "@/components/proof/MediaGallery";
import { RunTrack, RunTrackSkeleton } from "@/components/map/RunTrackPanel";
import { requireParticipant } from "@/lib/league";
import { loadSubmissions } from "@/lib/evidence";
import { trackFileOf } from "@/lib/run-track";
import { formatDateTime } from "@/lib/time";

export const metadata = { title: "Challenge proof" };

export default async function ChallengeProofPage(props: PageProps<"/proof/[challengeId]">) {
  const { challengeId } = await props.params;
  const ctx = await requireParticipant();
  const { data: challenge } = await ctx.supabase.from("challenges").select("*").eq("id", challengeId).eq("event_id", ctx.event.id).maybeSingle();
  if (!challenge) notFound();
  const subs = (await loadSubmissions(ctx)).filter((s) => s.challenge_id === challenge.id);
  const current = subs[0] ?? null;
  const { data: decisions } = current ? await ctx.supabase.from("review_decisions").select("*").in("submission_id", subs.map((s) => s.id)).order("created_at", { ascending: false }) : { data: [] };

  const isRun = challenge.proof_type.toLowerCase().includes("export");
  const accept = challenge.proof_type.includes("photo") ? "image/*" : challenge.proof_type.includes("clip") ? "video/*" : isRun ? ".gpx,.tcx,.fit,.csv,image/*,application/pdf" : "image/*,video/*,application/pdf";
  const trace = current && isRun ? trackFileOf(current.files) : null;

  return (
    <>
      <TitleRow kicker={`VICTOR’S VIEW · CHALLENGE #${String(challenge.sequence).padStart(2, "0")}`} title={challenge.title} blurb={`${challenge.proof_type} · ${challenge.points} points.`} tag={`${challenge.points} POINTS AVAILABLE`} team={ctx.profile.kit_team} />
      <nav className="pb-icon-nav" aria-label="Proof navigation">
        <IconLink icon="back" label="Back to the proof locker" href="/proof" />
        <IconLink icon="feed" label="Main feed" href="/game-centre" />
      </nav>
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
              current={current ? { id: current.id, version: current.version, status: current.status, caption: current.caption, files: current.files } : null}
              captureHint={isRun ? "Upload the watch export (GPX or TCX, FIT as a backup) plus a screenshot. The GPX line is what the commissioner approves and what the league sees on the map." : undefined}
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
          <div className="pb-panel">
            <h3>Versions and decisions</h3>
            {subs.length === 0 ? <p className="pb-small">No versions yet.</p> : null}
            {subs.map((s) => (
              <div className="pb-challenge" key={s.id}>
                <span className="pb-num">v{s.version}</span>
                <div>
                  <strong>{s.status.toUpperCase()}</strong>
                  <p>
                    {s.files.length} file(s) · {s.submitted_at ? `submitted ${formatDateTime(s.submitted_at, ctx.event.timezone)}` : `created ${formatDateTime(s.created_at, ctx.event.timezone)}`}
                    {s.caption ? ` · “${s.caption}”` : ""}
                  </p>
                  {(decisions ?? []).filter((d) => d.submission_id === s.id).map((d) => (
                    <p key={d.id} className={d.decision === "flagged" ? "pb-warn-text" : undefined}>
                      {d.decision.toUpperCase()} · {formatDateTime(d.created_at, ctx.event.timezone)}
                      {d.reason ? ` · ${d.reason}` : ""}
                      {d.note ? ` · Note: ${d.note}` : ""}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
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
