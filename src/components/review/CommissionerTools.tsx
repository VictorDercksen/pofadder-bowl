"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast-store";
import { RatingSelector } from "@/components/ui/RatingSelector";
import { issueCertificate, resolvePredictions, saveOfficialResults, setPenalty } from "@/lib/actions/review";
import type { Tables } from "@/lib/database.types";
import { formatDateTime, minutesToClock } from "@/lib/time";
import { NumberInput } from "@/components/ui/NumberInput";

export function PenaltyList({ penalties }: { penalties: Tables<"penalties">[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div style={{ marginTop: 18 }}>
      <h3>Flag on the play</h3>
      <p className="pb-small">Penalties are commissioner decisions, never automatic GPS guesses.</p>
      {penalties.map((p) => (
        <label className="pb-check-row" key={p.id}>
          <input
            type="checkbox"
            checked={p.applied}
            disabled={pending}
            onChange={(e) =>
              startTransition(async () => {
                const res = await setPenalty({ penaltyId: p.id, applied: e.target.checked });
                toast(res.message ?? "", res.ok ? "ok" : "error");
                router.refresh();
              })
            }
          />
          <span>
            {p.text}
            {p.applied ? <span className="pb-tag orange" style={{ marginLeft: 6 }}>APPLIED</span> : null}
          </span>
        </label>
      ))}
    </div>
  );
}

/** What the record already says, offered as defaults: the approved rating, the scoreboard, the sign photo's submit time and the flag tally. */
export type ResultDefaults = { rating: number | null; finalScore: number | null; signPhotoMinutes: number | null; flagCount: number | null };

export function ResultsForm({ results, timezone, defaults, revealAt, revealed }: { results: Tables<"official_results"> | null; timezone: string; defaults: ResultDefaults; revealAt: string; revealed: boolean }) {
  const approvedRating = defaults.rating;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [h, setH] = useState(results?.run_seconds != null ? Math.floor(results.run_seconds / 3600) : 0);
  const [m, setM] = useState(results?.run_seconds != null ? Math.floor((results.run_seconds % 3600) / 60) : 0);
  const [s, setS] = useState(results?.run_seconds != null ? results.run_seconds % 60 : 0);
  const [km, setKm] = useState(results?.run_distance_km != null ? String(results.run_distance_km) : "");
  const [meal, setMeal] = useState<number | null>(results?.meal_rating ?? approvedRating ?? null);
  const [finalScore, setFinalScore] = useState(results?.final_score != null ? String(results.final_score) : defaults.finalScore != null ? String(defaults.finalScore) : "");
  const sign = results?.sign_photo_minutes ?? defaults.signPhotoMinutes;
  const [signH, setSignH] = useState(sign != null ? String(Math.floor(sign / 60)) : "");
  const [signM, setSignM] = useState(sign != null ? String(sign % 60) : "");
  const [flags, setFlags] = useState(results?.flag_count != null ? String(results.flag_count) : defaults.flagCount != null ? String(defaults.flagCount) : "");
  const [speechM, setSpeechM] = useState(results?.speech_seconds != null ? String(Math.floor(results.speech_seconds / 60)) : "");
  const [speechS, setSpeechS] = useState(results?.speech_seconds != null ? String(results.speech_seconds % 60) : "");
  const hasRun = h + m + s > 0;
  const hasSign = signH !== "" || signM !== "";
  const hasSpeech = speechM !== "" || speechS !== "";

  return (
    <div style={{ marginTop: 18 }}>
      <h3>Official results</h3>
      <p className="pb-small">Approved run stats, the on-camera verdict and the trip’s tallies. Predictions resolve against these; an empty field leaves that call unscored.</p>
      <label className="pb-field">
        Run finish time (h / m / s)
        <div className="pb-inline-fields" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
          <NumberInput min={0} max={8} value={h} onChange={(n) => setH(n ?? 0)} aria-label="Run hours" />
          <NumberInput min={0} max={59} value={m} onChange={(n) => setM(n ?? 0)} aria-label="Run minutes" />
          <NumberInput min={0} max={59} value={s} onChange={(n) => setS(n ?? 0)} aria-label="Run seconds" />
        </div>
      </label>
      <label className="pb-field">
        Run distance (km)
        <input type="number" step="0.01" min={0} value={km} onChange={(e) => setKm(e.target.value)} placeholder="from the watch export" />
      </label>
      <div className="pb-field">
        Chicken and rib combo rating
        <RatingSelector value={meal} label="Chicken and rib combo rating" onChange={setMeal} caption="official" />
        <p className="pb-small" style={{ marginTop: 6 }}>
          {approvedRating != null ? `Prefilled from the approved proof (${approvedRating} / 10). Change it only if the clip says otherwise.` : "Defaults to the score on the approved rating clip once it is in. Leave it unset and the rating category is not scored."}
          {meal != null ? (
            <>
              {" "}
              <button type="button" className="pb-linklike" onClick={() => setMeal(null)}>Clear</button>
            </>
          ) : null}
        </p>
      </div>
      <div className="pb-inline-fields">
        <label className="pb-field">
          Final score out of 100
          <input type="number" min={0} max={100} value={finalScore} onChange={(e) => setFinalScore(e.target.value)} placeholder="from the scoreboard" />
        </label>
        <label className="pb-field">
          Versions flagged
          <input type="number" min={0} max={99} value={flags} onChange={(e) => setFlags(e.target.value)} placeholder="from the audit trail" />
        </label>
      </div>
      <p className="pb-small" style={{ marginTop: 5 }}>
        {defaults.finalScore != null ? `Scoreboard now: ${defaults.finalScore} / ${100}.` : ""} {defaults.flagCount != null ? `Flags on record: ${defaults.flagCount}.` : ""} Enter these at the final whistle.
      </p>
      <label className="pb-field">
        Daylight sign photo submitted at (SAST, h / m)
        <div className="pb-inline-fields">
          <input type="number" min={0} max={23} value={signH} onChange={(e) => setSignH(e.target.value)} aria-label="Sign photo hour" />
          <input type="number" min={0} max={59} value={signM} onChange={(e) => setSignM(e.target.value)} aria-label="Sign photo minute" />
        </div>
      </label>
      <p className="pb-small" style={{ marginTop: 5 }}>{defaults.signPhotoMinutes != null ? `Challenge #03 was first submitted at ${minutesToClock(defaults.signPhotoMinutes)}.` : "Prefilled from the first submitted version of challenge #03 once it is in."}</p>
      <label className="pb-field">
        Sunset speech length (m / s)
        <div className="pb-inline-fields">
          <input type="number" min={0} max={60} value={speechM} onChange={(e) => setSpeechM(e.target.value)} aria-label="Speech minutes" />
          <input type="number" min={0} max={59} value={speechS} onChange={(e) => setSpeechS(e.target.value)} aria-label="Speech seconds" />
        </div>
      </label>
      <p className="pb-small" style={{ marginTop: 5 }}>First word to last on the approved N14 clip.</p>
      <div className="pb-actions">
        <button
          className="pb-secondary"
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await saveOfficialResults({
                runSeconds: hasRun ? h * 3600 + m * 60 + s : null,
                runDistanceKm: km === "" ? null : Number(km),
                mealRating: meal,
                finalScore: finalScore === "" ? null : Number(finalScore),
                signPhotoMinutes: hasSign ? Number(signH || 0) * 60 + Number(signM || 0) : null,
                flagCount: flags === "" ? null : Number(flags),
                speechSeconds: hasSpeech ? Number(speechM || 0) * 60 + Number(speechS || 0) : null,
              });
              toast(res.message ?? "", res.ok ? "ok" : "error");
              router.refresh();
            })
          }
        >
          Save results
        </button>
        <button
          className="pb-primary"
          type="button"
          disabled={pending || !results || !revealed}
          onClick={() =>
            startTransition(async () => {
              const res = await resolvePredictions();
              toast(res.message ?? "", res.ok ? "ok" : "error");
              router.refresh();
            })
          }
        >
          Resolve predictions
        </button>
      </div>
      {!revealed ? <p className="pb-inline-status">Slips resolve once the bus is back in Malmesbury ({formatDateTime(revealAt, timezone)}). Results can be entered now.</p> : null}
      {results?.resolved_at ? <p className="pb-inline-status">Last resolved {formatDateTime(results.resolved_at, timezone)}. Resolving again recomputes awards.</p> : null}
    </div>
  );
}

export function CertificateIssue({ certificate, approved, max, timezone }: { certificate: Tables<"certificates"> | null; approved: number; max: number; timezone: string }) {
  const router = useRouter();
  const [isPublic, setIsPublic] = useState(certificate?.is_public ?? false);
  const [pending, startTransition] = useTransition();
  return (
    <div style={{ marginTop: 18 }}>
      <h3>Certificate of sentence served</h3>
      <p className="pb-small">
        Status: <b>{certificate?.status === "issued" ? `issued ${certificate.issued_at ? formatDateTime(certificate.issued_at, timezone) : ""}` : "pending"}</b> · current score {approved}/{max}. Issuing snapshots the approved state; it never inherits demo values.
      </p>
      <label className="pb-check-row">
        <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
        Allow a public recap page (also needs the participant’s consent)
      </label>
      <div className="pb-actions">
        <button
          className="pb-primary"
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await issueCertificate({ isPublic });
              toast(res.message ?? "", res.ok ? "ok" : "error");
              router.refresh();
            })
          }
        >
          {certificate?.status === "issued" ? "Re-issue certificate" : "Issue certificate"}
        </button>
      </div>
    </div>
  );
}
