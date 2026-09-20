"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast-store";
import { savePrediction, updatePredictionRules } from "@/lib/actions/predictions";
import { validatePrediction, type PredictionRules } from "@/lib/predictions";
import { Countdown } from "@/components/ui/Countdown";
import { RatingSelector } from "@/components/ui/RatingSelector";

export function PredictionSlip({ locked, lockAt, existing }: { locked: boolean; lockAt: string; existing: { run_seconds: number; meal_rating: number } | null }) {
  const router = useRouter();
  const [hours, setHours] = useState(existing ? Math.floor(existing.run_seconds / 3600) : 1);
  const [minutes, setMinutes] = useState(existing ? Math.floor((existing.run_seconds % 3600) / 60) : 35);
  const [meal, setMeal] = useState<number | null>(existing?.meal_rating ?? null);
  const [pending, startTransition] = useTransition();

  function save() {
    const invalid = validatePrediction({ hours, minutes, mealRating: meal });
    if (invalid || meal == null) {
      toast(invalid ?? "Pick a rib rating out of ten.", "warn");
      return;
    }
    startTransition(async () => {
      const res = await savePrediction({ hours, minutes, mealRating: meal });
      toast(res.message ?? "", res.ok ? "ok" : "error");
      router.refresh();
    });
  }

  return (
    <div>
      <label className="pb-field">
        Victor’s 10 km finish time
        <div className="pb-inline-fields">
          <input type="number" min={0} max={8} value={hours} disabled={locked} onChange={(e) => setHours(Number(e.target.value))} aria-label="Run hours" />
          <input type="number" min={0} max={59} value={minutes} disabled={locked} onChange={(e) => setMinutes(Number(e.target.value))} aria-label="Run minutes" />
        </div>
      </label>
      <p className="pb-small" style={{ marginTop: 5 }}>Hours / minutes</p>
      <div className="pb-field">
        Chicken and rib combo rating
        <RatingSelector value={meal} label="Chicken and rib combo rating" onChange={setMeal} readOnly={locked} caption={locked ? "your call" : "exact match wins"} />
        <p className="pb-small" style={{ marginTop: 6 }}>Victor scores the combo out of ten on camera when he submits the proof. Match it exactly to take the points.</p>
      </div>
      <div className="pb-actions">
        <button className="pb-primary" type="button" onClick={save} disabled={locked || pending}>
          {locked ? "Locked at departure" : existing ? "Update predictions" : "Lock in my predictions"}
        </button>
      </div>
      <p className="pb-small" style={{ marginTop: 12 }}>
        {locked ? "The slip is closed." : <>You can edit until departure (<Countdown targetIso={lockAt} passedLabel="locked" />). No cash stakes.</>}
        {existing ? " Your current slip is saved." : ""}
      </p>
    </div>
  );
}

export function RulesEditor({ rules }: { rules: PredictionRules }) {
  const router = useRouter();
  const [run, setRun] = useState(rules.run_points);
  const [meal, setMeal] = useState(rules.meal_points);
  const [pending, startTransition] = useTransition();
  return (
    <div style={{ marginTop: 16 }}>
      <h3>Admin: rules</h3>
      <p className="pb-small">Configurable until predictions lock.</p>
      <div className="pb-inline-fields">
        <label className="pb-field">
          Run
          <input type="number" min={0} max={100} value={run} onChange={(e) => setRun(Number(e.target.value))} />
        </label>
        <label className="pb-field">
          Rib rating
          <input type="number" min={0} max={100} value={meal} onChange={(e) => setMeal(Number(e.target.value))} />
        </label>
      </div>
      <div className="pb-actions">
        <button
          className="pb-secondary"
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await updatePredictionRules({ runPoints: run, mealPoints: meal });
              toast(res.message ?? "", res.ok ? "ok" : "error");
              router.refresh();
            })
          }
        >
          Save rules
        </button>
      </div>
    </div>
  );
}
