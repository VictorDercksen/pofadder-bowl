"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Status } from "@/components/ui/TitleRow";
import { savePrediction, updatePredictionRules } from "@/lib/actions/predictions";
import { validatePrediction, type PredictionRules } from "@/lib/predictions";
import { Countdown } from "@/components/ui/Countdown";

export function PredictionSlip({ locked, lockAt, existing }: { locked: boolean; lockAt: string; existing: { run_seconds: number; meal_rating: number; complaint_count: number } | null }) {
  const router = useRouter();
  const [hours, setHours] = useState(existing ? Math.floor(existing.run_seconds / 3600) : 1);
  const [minutes, setMinutes] = useState(existing ? Math.floor((existing.run_seconds % 3600) / 60) : 35);
  const [meal, setMeal] = useState(existing?.meal_rating ?? 8);
  const [complaints, setComplaints] = useState(existing?.complaint_count ?? 12);
  const [msg, setMsg] = useState<{ text: string; tone: "ok" | "warn" | "error" } | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    const invalid = validatePrediction({ hours, minutes, mealRating: meal, complaints });
    if (invalid) {
      setMsg({ text: invalid, tone: "warn" });
      return;
    }
    startTransition(async () => {
      const res = await savePrediction({ hours, minutes, mealRating: meal, complaints });
      setMsg({ text: res.message ?? "", tone: res.ok ? "ok" : "error" });
      router.refresh();
    });
  }

  return (
    <div>
      <label className="pb-field">
        Victor’s 14 km finish time
        <div className="pb-inline-fields">
          <input type="number" min={0} max={8} value={hours} disabled={locked} onChange={(e) => setHours(Number(e.target.value))} aria-label="Run hours" />
          <input type="number" min={0} max={59} value={minutes} disabled={locked} onChange={(e) => setMinutes(Number(e.target.value))} aria-label="Run minutes" />
        </div>
      </label>
      <p className="pb-small" style={{ marginTop: 5 }}>Hours / minutes</p>
      <label className="pb-field">
        Chicken &amp; rib combo rating
        <select value={meal} disabled={locked} onChange={(e) => setMeal(Number(e.target.value))}>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n} / 10
            </option>
          ))}
        </select>
      </label>
      <label className="pb-field">
        Recorded complaints
        <input type="number" min={0} max={999} value={complaints} disabled={locked} onChange={(e) => setComplaints(Number(e.target.value))} />
      </label>
      <div className="pb-actions">
        <button className="pb-primary" type="button" onClick={save} disabled={locked || pending}>
          {locked ? "Locked at departure" : existing ? "Update predictions" : "Lock in my predictions"}
        </button>
      </div>
      <p className="pb-small" style={{ marginTop: 12 }}>
        {locked ? "The slip is closed." : <>You can edit until departure (<Countdown targetIso={lockAt} passedLabel="locked" />). No cash stakes.</>}
        {existing ? " Your current slip is saved." : ""}
      </p>
      <Status tone={msg?.tone}>{msg?.text}</Status>
    </div>
  );
}

export function RulesEditor({ rules }: { rules: PredictionRules }) {
  const router = useRouter();
  const [run, setRun] = useState(rules.run_points);
  const [meal, setMeal] = useState(rules.meal_points);
  const [complaints, setComplaints] = useState(rules.complaints_points);
  const [msg, setMsg] = useState<{ text: string; tone: "ok" | "warn" | "error" } | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div style={{ marginTop: 16 }}>
      <h3>Admin: rules</h3>
      <p className="pb-small">Configurable until predictions lock.</p>
      <div className="pb-inline-fields" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
        <label className="pb-field">
          Run
          <input type="number" min={0} max={100} value={run} onChange={(e) => setRun(Number(e.target.value))} />
        </label>
        <label className="pb-field">
          Meal
          <input type="number" min={0} max={100} value={meal} onChange={(e) => setMeal(Number(e.target.value))} />
        </label>
        <label className="pb-field">
          Complaints
          <input type="number" min={0} max={100} value={complaints} onChange={(e) => setComplaints(Number(e.target.value))} />
        </label>
      </div>
      <div className="pb-actions">
        <button
          className="pb-secondary"
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await updatePredictionRules({ runPoints: run, mealPoints: meal, complaintsPoints: complaints });
              setMsg({ text: res.message ?? "", tone: res.ok ? "ok" : "error" });
              router.refresh();
            })
          }
        >
          Save rules
        </button>
      </div>
      <Status tone={msg?.tone}>{msg?.text}</Status>
    </div>
  );
}
