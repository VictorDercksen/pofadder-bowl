"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Status } from "@/components/ui/TitleRow";
import { issueCertificate, resolvePredictions, saveOfficialResults, setPenalty } from "@/lib/actions/review";
import type { Tables } from "@/lib/database.types";
import { formatDateTime } from "@/lib/time";

type Note = { text: string; tone: "ok" | "warn" | "error" } | null;

export function PenaltyList({ penalties }: { penalties: Tables<"penalties">[] }) {
  const router = useRouter();
  const [note, setNote] = useState<Note>(null);
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
                setNote({ text: res.message ?? "", tone: res.ok ? "ok" : "error" });
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
      <Status tone={note?.tone}>{note?.text}</Status>
    </div>
  );
}

export function ResultsForm({ results, timezone }: { results: Tables<"official_results"> | null; timezone: string }) {
  const router = useRouter();
  const [note, setNote] = useState<Note>(null);
  const [pending, startTransition] = useTransition();
  const [h, setH] = useState(results?.run_seconds != null ? Math.floor(results.run_seconds / 3600) : 0);
  const [m, setM] = useState(results?.run_seconds != null ? Math.floor((results.run_seconds % 3600) / 60) : 0);
  const [s, setS] = useState(results?.run_seconds != null ? results.run_seconds % 60 : 0);
  const [km, setKm] = useState(results?.run_distance_km != null ? String(results.run_distance_km) : "");
  const [meal, setMeal] = useState(results?.meal_rating != null ? String(results.meal_rating) : "");
  const [complaints, setComplaints] = useState(results?.complaint_count != null ? String(results.complaint_count) : "");
  const hasRun = h + m + s > 0;

  return (
    <div style={{ marginTop: 18 }}>
      <h3>Official results</h3>
      <p className="pb-small">Approved run stats and on-camera verdicts. Predictions resolve against these.</p>
      <label className="pb-field">
        Run finish time (h / m / s)
        <div className="pb-inline-fields" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
          <input type="number" min={0} max={8} value={h} onChange={(e) => setH(Number(e.target.value))} aria-label="Run hours" />
          <input type="number" min={0} max={59} value={m} onChange={(e) => setM(Number(e.target.value))} aria-label="Run minutes" />
          <input type="number" min={0} max={59} value={s} onChange={(e) => setS(Number(e.target.value))} aria-label="Run seconds" />
        </div>
      </label>
      <div className="pb-inline-fields">
        <label className="pb-field">
          Run distance (km)
          <input type="number" step="0.01" min={0} value={km} onChange={(e) => setKm(e.target.value)} placeholder="from the watch export" />
        </label>
        <label className="pb-field">
          Meal rating (1–10)
          <input type="number" min={1} max={10} value={meal} onChange={(e) => setMeal(e.target.value)} />
        </label>
      </div>
      <label className="pb-field">
        Recorded complaints
        <input type="number" min={0} max={999} value={complaints} onChange={(e) => setComplaints(e.target.value)} />
      </label>
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
                mealRating: meal === "" ? null : Number(meal),
                complaintCount: complaints === "" ? null : Number(complaints),
              });
              setNote({ text: res.message ?? "", tone: res.ok ? "ok" : "error" });
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
              setNote({ text: res.message ?? "", tone: res.ok ? "ok" : "error" });
              router.refresh();
            })
          }
        >
          Resolve predictions
        </button>
      </div>
      {results?.resolved_at ? <p className="pb-inline-status">Last resolved {formatDateTime(results.resolved_at, timezone)}. Resolving again recomputes awards.</p> : null}
      <Status tone={note?.tone}>{note?.text}</Status>
    </div>
  );
}

export function CertificateIssue({ certificate, approved, max, timezone }: { certificate: Tables<"certificates"> | null; approved: number; max: number; timezone: string }) {
  const router = useRouter();
  const [note, setNote] = useState<Note>(null);
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
              setNote({ text: res.message ?? "", tone: res.ok ? "ok" : "error" });
              router.refresh();
            })
          }
        >
          {certificate?.status === "issued" ? "Re-issue certificate" : "Issue certificate"}
        </button>
      </div>
      <Status tone={note?.tone}>{note?.text}</Status>
    </div>
  );
}
