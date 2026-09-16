import Link from "next/link";
import { notFound } from "next/navigation";
import { TitleRow } from "@/components/ui/TitleRow";
import { EvidenceUploader } from "@/components/proof/EvidenceUploader";
import { MediaGallery } from "@/components/proof/MediaGallery";
import { requireParticipant } from "@/lib/league";
import { loadSubmissions } from "@/lib/evidence";
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

  const accept = challenge.proof_type.includes("photo") ? "image/*" : challenge.proof_type.includes("clip") ? "video/*" : challenge.proof_type.includes("export") ? ".gpx,.tcx,.fit,.csv,image/*,application/pdf" : "image/*,video/*,application/pdf";

  return (
    <>
      <TitleRow kicker={`VICTOR’S VIEW · CHALLENGE #${String(challenge.sequence).padStart(2, "0")}`} title={challenge.title} blurb={`${challenge.proof_type} · ${challenge.points} points.`} tag={`${challenge.points} POINTS AVAILABLE`} team="phi" />
      <p className="pb-small" style={{ marginBottom: 12 }}>
        <Link href="/proof" className="pb-text-action">← Back to the locker</Link> · <Link href="/game-centre" className="pb-text-action">Main feed</Link>
      </p>
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
              captureHint={challenge.sequence === 2 ? "Upload the watch export (GPX/TCX/FIT) plus a screenshot. The check-in map is not proof of the run." : undefined}
            />
          )}
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
