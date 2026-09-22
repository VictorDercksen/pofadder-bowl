import Link from "next/link";
import { MemberBadge } from "@/components/ui/Marks";
import { IconLink } from "@/components/ui/IconButton";
import { RatingBadge } from "@/components/ui/RatingSelector";
import { TitleRow } from "@/components/ui/TitleRow";
import { KitPanel } from "@/components/ui/KitPanel";
import { getEventScore, getLeagueContext } from "@/lib/league";
import { loadChallenges } from "@/lib/itinerary";
import { latestFor, leagueStatusLabel, loadParticipantProfile, loadSubmissions, statusLabel } from "@/lib/evidence";
import { formatDateTime } from "@/lib/time";

export const metadata = { title: "Proof locker" };

/**
 * The participant works the locker; commissioners preview it; every other member gets the
 * same list read-only (status per play, the evidence behind it, the commissioner's calls).
 * Row-level security already hides unsubmitted drafts from the league, and every write action
 * re-checks the participant role, so this page only decides what to show.
 */
export default async function ProofPage() {
  const ctx = await getLeagueContext();
  const league = !ctx.isParticipant && !ctx.isCommissioner;
  const [challenges, subs, score, participant] = await Promise.all([loadChallenges(ctx), loadSubmissions(ctx), getEventScore(ctx), league ? loadParticipantProfile(ctx) : Promise.resolve(null)]);
  const next = challenges.find((c) => {
    const s = latestFor(subs, { challengeId: c.id });
    return !s || s.status !== "approved";
  });

  if (league) {
    const byId = new Map(challenges.map((c) => [c.id, c]));
    const { data: decisions } = await ctx.supabase
      .from("review_decisions")
      .select("id, decision, reason, created_at, submission_version, submission:evidence_submissions!inner(challenge_id, event_id)")
      .eq("submission.event_id", ctx.event.id)
      .order("created_at", { ascending: false })
      .limit(6);
    const who = participant?.display_name ?? "The participant";
    const kit = participant?.kit_team ?? null;
    return (
      <>
        <TitleRow kicker={`LEAGUE VIEW · ${score.approvedChallenges} OF ${score.total} APPROVED`} title="The proof locker." blurb="Every play needs evidence. Watch it land, then watch the call." tag={`${score.approved} / ${score.max} POINTS`} team={kit} />
        <div className="pb-split">
          <KitPanel team={kit} name="Eleven plays. One hundred points." kicker={`${who.toUpperCase()} · PROOF LOCKER · READ ONLY`} tour="proof-list">
            {challenges.map((c) => {
              const s = latestFor(subs, { challengeId: c.id });
              return (
                <div className="pb-challenge" key={c.id}>
                  <span className="pb-num">{String(c.sequence).padStart(2, "0")}</span>
                  <div style={{ minWidth: 0 }}>
                    <strong>{c.title}</strong>
                    <p>
                      {c.proof_type} · {c.points} points · {leagueStatusLabel(s, c.points)}
                      {c.rated && s ? <> · <RatingBadge value={s.rating} /></> : null}
                    </p>
                  </div>
                  {s ? (
                    <Link className="pb-secondary" href={`/proof/${c.id}`} style={{ marginLeft: "auto", flexShrink: 0 }}>
                      View
                    </Link>
                  ) : (
                    <span className="pb-small pb-locker-wait">Awaiting proof</span>
                  )}
                </div>
              );
            })}
          </KitPanel>
          <div>
            {next ? (
              <div className="pb-next">
                <div className="pb-kicker">UP NEXT · {next.points} POINTS</div>
                <h3>{next.title}</h3>
                <p>
                  {next.proof_type}. {leagueStatusLabel(latestFor(subs, { challengeId: next.id }), next.points)}. Points count only after approval.
                </p>
                {latestFor(subs, { challengeId: next.id }) ? (
                  <div className="pb-actions">
                    <Link className="pb-secondary" href={`/proof/${next.id}`}>View the evidence ↗</Link>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="pb-next">
                <h3>All eleven plays approved.</h3>
                <p>The commissioner holds the certificate whistle.</p>
              </div>
            )}
            <div className="pb-panel" style={{ marginTop: 18 }}>
              <h3>Latest calls</h3>
              {(decisions ?? []).length === 0 ? <p className="pb-small">No decisions yet. Approvals and flags land here as the commissioner makes them.</p> : null}
              {(decisions ?? []).map((d) => {
                const c = d.submission.challenge_id ? byId.get(d.submission.challenge_id) : undefined;
                return (
                  <div className="pb-challenge" key={d.id}>
                    <span className="pb-num">{d.decision === "approved" ? "✓" : d.decision === "flagged" ? "⚑" : "↺"}</span>
                    <div style={{ minWidth: 0 }}>
                      <strong>
                        {c ? c.title : "Press room answer"} · v{d.submission_version} {d.decision}
                      </strong>
                      <p>
                        {formatDateTime(d.created_at, ctx.event.timezone)}
                        {d.reason ? ` · ${d.reason}` : ""}
                      </p>
                    </div>
                    {c ? <IconLink icon="versions" label={`Open ${c.title}`} href={`/proof/${c.id}`} small className="pb-locker-open" /> : null}
                  </div>
                );
              })}
            </div>
            <div className="pb-panel" style={{ marginTop: 18 }} data-tour="proof-flow">
              <h3>How the locker works.</h3>
              <p className="pb-small" style={{ marginTop: 8 }}>
                <MemberBadge code={kit} name={who} number={participant?.kit_number} size={20} /> uploads the proof for each play. Drafts stay private until submitted; from then on every version, its files and the commissioner’s call are on record here. Approved puts the points on the board. Flagged sends it back for a new version. This screen is read-only: nothing you open or play here changes the review.
              </p>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <TitleRow kicker={`${ctx.isParticipant ? "VICTOR’S VIEW" : "COMMISSIONER PREVIEW"} · ${score.approvedChallenges} OF ${score.total} APPROVED`} title="The proof locker." blurb="Every play needs evidence. Every point has to be earned." tag={`${score.approved} / ${score.max} POINTS`} team={ctx.profile.kit_team} />
      <div className="pb-split">
        <KitPanel team={ctx.profile.kit_team} name="Eleven plays. One hundred points." kicker={`${ctx.profile.display_name.toUpperCase()} · PROOF LOCKER`} tour="proof-list">
          {challenges.map((c) => {
            const s = latestFor(subs, { challengeId: c.id });
            return (
              <div className="pb-challenge" key={c.id}>
                <span className="pb-num">{String(c.sequence).padStart(2, "0")}</span>
                <div style={{ minWidth: 0 }}>
                  <strong>{c.title}</strong>
                  <p>
                    {c.proof_type} · {c.points} points · {statusLabel(s, c.points)}
                    {c.rated && s ? <> · <RatingBadge value={s.rating} /></> : null}
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
              <h3>All eleven plays approved.</h3>
              <p>The commissioner holds the certificate whistle.</p>
            </div>
          )}
          <div className="pb-panel" style={{ marginTop: 18 }} data-tour="proof-flow">
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
