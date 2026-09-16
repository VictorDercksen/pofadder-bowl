import Link from "next/link";
import { notFound } from "next/navigation";
import { MemberBadge, Shield } from "@/components/ui/Marks";
import { TitleRow } from "@/components/ui/TitleRow";
import { MediaGallery } from "@/components/proof/MediaGallery";
import { ReviewForm } from "@/components/review/ReviewForm";
import { requireCommissioner } from "@/lib/league";
import { formatDateTime } from "@/lib/time";

export const metadata = { title: "Review submission" };

export default async function ReviewSubmissionPage(props: PageProps<"/review/[submissionId]">) {
  const { submissionId } = await props.params;
  const ctx = await requireCommissioner();
  const { data: s } = await ctx.supabase.from("evidence_submissions").select("*, files:evidence_files(*)").eq("id", submissionId).eq("event_id", ctx.event.id).maybeSingle();
  if (!s) notFound();
  const [{ data: challenge }, { data: prompt }, { data: decisions }, { data: submitter }, { data: siblings }] = await Promise.all([
    s.challenge_id ? ctx.supabase.from("challenges").select("*").eq("id", s.challenge_id).maybeSingle() : Promise.resolve({ data: null }),
    s.press_prompt_id ? ctx.supabase.from("press_prompts").select("*").eq("id", s.press_prompt_id).maybeSingle() : Promise.resolve({ data: null }),
    ctx.supabase.from("review_decisions").select("*").eq("submission_id", s.id).order("created_at", { ascending: false }),
    ctx.supabase.from("profiles").select("display_name, kit_team, kit_number").eq("id", s.submitter_id).maybeSingle(),
    ctx.supabase.from("evidence_submissions").select("id, version, status").eq("event_id", ctx.event.id).eq("submitter_id", s.submitter_id).order("version", { ascending: false }),
  ]);
  const related = (siblings ?? []).filter(() => true);
  const title = challenge ? challenge.title : `Press room · ${prompt?.slot ?? "answer"}`;
  const tz = ctx.event.timezone;

  return (
    <>
      <TitleRow kicker={`COMMISSIONER’S VIEW · ${challenge ? `CHALLENGE #${String(challenge.sequence).padStart(2, "0")}` : "PRESS ROOM"}`} title={title} blurb={<><MemberBadge code={submitter?.kit_team} name={submitter?.display_name ?? "Participant"} number={submitter?.kit_number} /> · version {s.version} · {s.status}</>} tag={challenge ? `${challenge.points} POINTS` : "MEDIA DUTY"} identity={<span className="pb-official-patch">LEAGUE<br />OFFICIAL</span>} />
      <p className="pb-small" style={{ marginBottom: 12 }}>
        <Link href="/review" className="pb-text-action">← Back to the review queue</Link>
      </p>
      <div className="pb-split">
        <div>
          <div className="pb-clip">
            <small>{challenge ? `PROOF #${String(challenge.sequence).padStart(2, "0")}` : "PRESS ROOM"} · VERSION {s.version}</small>
            <h2>{s.caption ? `“${s.caption}”` : "No caption supplied."}</h2>
            <small>
              {s.files.length} FILE(S) · {s.submitted_at ? `SUBMITTED ${formatDateTime(s.submitted_at, tz).toUpperCase()}` : "NOT SUBMITTED"}
            </small>
          </div>
          <div className="pb-panel" style={{ marginTop: 15 }}>
            <h3>Evidence</h3>
            {s.files.length === 0 ? <p className="pb-small">No files attached.</p> : <MediaGallery files={s.files.map((f) => ({ id: f.id, kind: f.kind, name: f.original_name ?? "file", mime: f.mime_type }))} />}
            {prompt ? <p className="pb-small" style={{ marginTop: 10 }}>Question: {prompt.question}</p> : null}
          </div>
          <ReviewForm submissionId={s.id} version={s.version} status={s.status} points={challenge?.points ?? 0} />
        </div>
        <div className="pb-panel">
          <div className="pb-official-strip" aria-hidden="true" />
          <div className="pb-panel-top">
            <h3>Replay checklist</h3>
            <Shield />
          </div>
          <p className="pb-small">
            {challenge ? `Required proof: ${challenge.proof_type}.` : "A real clip must exist and answer the prompt."} Does the evidence match the challenge? Is the timestamp plausible? Anything missing goes in the flag reason.
          </p>
          <h3 style={{ marginTop: 16 }}>Audit trail</h3>
          {(decisions ?? []).length === 0 ? <p className="pb-small">No decisions on this version yet.</p> : null}
          {(decisions ?? []).map((d) => (
            <div className="pb-challenge" key={d.id}>
              <span className="pb-num">{d.decision === "approved" ? "✓" : d.decision === "flagged" ? "⚑" : "↺"}</span>
              <div>
                <strong>{d.decision.toUpperCase()} · v{d.submission_version}</strong>
                <p>
                  {formatDateTime(d.created_at, tz)}
                  {d.reason ? ` · ${d.reason}` : ""}
                  {d.note ? ` · Note: ${d.note}` : ""}
                </p>
              </div>
            </div>
          ))}
          <h3 style={{ marginTop: 16 }}>Other versions</h3>
          {related.filter((r) => r.id !== s.id).length === 0 ? <p className="pb-small">This is the only version.</p> : null}
          {related
            .filter((r) => r.id !== s.id)
            .map((r) => (
              <p key={r.id} className="pb-small">
                <Link href={`/review/${r.id}`} className="pb-text-action">
                  v{r.version} · {r.status}
                </Link>
              </p>
            ))}
        </div>
      </div>
    </>
  );
}
