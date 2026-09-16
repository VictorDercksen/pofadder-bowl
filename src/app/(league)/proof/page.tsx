import Link from "next/link";
import { TitleRow } from "@/components/ui/TitleRow";
import { KitPanel } from "@/components/ui/KitPanel";
import { getEventScore, requireParticipant } from "@/lib/league";
import { loadChallenges } from "@/lib/itinerary";
import { latestFor, loadSubmissions, statusLabel } from "@/lib/evidence";

export const metadata = { title: "Proof locker" };

export default async function ProofPage() {
  const ctx = await requireParticipant();
  const [challenges, subs, score] = await Promise.all([loadChallenges(ctx), loadSubmissions(ctx), getEventScore(ctx)]);
  const next = challenges.find((c) => {
    const s = latestFor(subs, { challengeId: c.id });
    return !s || s.status !== "approved";
  });

  return (
    <>
      <TitleRow kicker={`${ctx.isParticipant ? "VICTOR’S VIEW" : "COMMISSIONER PREVIEW"} · ${score.approvedChallenges} OF ${score.total} APPROVED`} title="The proof locker." blurb="Every play needs evidence. Every point has to be earned." tag={`${score.approved} / ${score.max} POINTS`} team={ctx.profile.kit_team} />
      <div className="pb-split">
        <KitPanel team={ctx.profile.kit_team} name="Ten plays. One hundred points." kicker={`${ctx.profile.display_name.toUpperCase()} · PROOF LOCKER`}>
          {challenges.map((c) => {
            const s = latestFor(subs, { challengeId: c.id });
            return (
              <div className="pb-challenge" key={c.id}>
                <span className="pb-num">{String(c.sequence).padStart(2, "0")}</span>
                <div style={{ minWidth: 0 }}>
                  <strong>{c.title}</strong>
                  <p>
                    {c.proof_type} · {c.points} points · {statusLabel(s, c.points)}
                  </p>
                </div>
                <Link className={s?.status === "approved" ? "pb-secondary" : "pb-primary"} href={`/proof/${c.id}`} style={{ marginLeft: "auto", flexShrink: 0 }}>
                  {s?.status === "approved" ? "View" : s ? "Continue" : "Add proof"}
                </Link>
              </div>
            );
          })}
        </KitPanel>
        <div>
          {next ? (
            <div className="pb-next">
              <div className="pb-kicker">UP NEXT · {next.points} POINTS</div>
              <h3>{next.title}</h3>
              <p>{next.proof_type}. Submitted points only count after approval.</p>
              <div className="pb-actions">
                <Link className="pb-primary orange" href={`/proof/${next.id}`}>Open challenge ↗</Link>
              </div>
            </div>
          ) : (
            <div className="pb-next">
              <h3>All ten plays approved.</h3>
              <p>The commissioner holds the certificate whistle.</p>
            </div>
          )}
          <div className="pb-panel" style={{ marginTop: 18 }}>
            <h3>The commissioner has the whistle.</h3>
            <p className="pb-small" style={{ marginTop: 8 }}>
              Draft → submitted → approved or flagged. A replacement upload creates a new version; approved evidence is never overwritten silently. Large clips upload in resumable chunks straight to private storage, and unfinished drafts stay on this device.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
