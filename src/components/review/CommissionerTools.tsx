"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast-store";
import { RatingSelector } from "@/components/ui/RatingSelector";
import { issueCertificate, resolvePredictions, saveOfficialResults, setPenalty } from "@/lib/actions/review";
import type { Tables } from "@/lib/database.types";
import { formatDateTime } from "@/lib/time";

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

export function ResultsForm({ results, timezone, approvedRating }: { results: Tables<"official_results"> | null; timezone: string; /** Score on the approved rated proof, offered as the default. */ approvedRating: number | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [h, setH] = useState(results?.run_seconds != null ? Math.floor(results.run_seconds / 3600) : 0);
  const [m, setM] = useState(results?.run_seconds != null ? Math.floor((results.run_seconds % 3600) / 60) : 0);
  const [s, setS] = useState(results?.run_seconds != null ? results.run_seconds % 60 : 0);
  const [km, setKm] = useState(results?.run_distance_km != null ? String(results.run_distance_km) : "");
  const [meal, setMeal] = useState<number | null>(results?.meal_rating ?? approvedRating ?? null);
  const hasRun = h + m + s > 0;

  return (
    <div style={{ marginTop: 18 }}>
      <h3>Official results</h3>
      <p className="pb-small">Approved run stats and the on-camera verdict. Predictions resolve against these.</p>
      <label className="pb-field">
        Run finish time (h / m / s)
        <div className="pb-inline-fields" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
          <input type="number" min={0} max={8} value={h} onChange={(e) => setH(Number(e.target.value))} aria-label="Run hours" />
          <input type="number" min={0} max={59} value={m} onChange={(e) => setM(Number(e.target.value))} aria-label="Run minutes" />
          <input type="number" min={0} max={59} value={s} onChange={(e) => setS(Number(e.target.value))} aria-label="Run seconds" />
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
          disabled={pending || !results}
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
