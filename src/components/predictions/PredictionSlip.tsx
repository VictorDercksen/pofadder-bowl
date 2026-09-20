"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast-store";
import { savePrediction, updatePredictionRules } from "@/lib/actions/predictions";
import { METRICS, validatePrediction, type PredictionRules, type PredictionValues, type SlipInput } from "@/lib/predictions";
import { Countdown } from "@/components/ui/Countdown";
import { RatingSelector } from "@/components/ui/RatingSelector";

/** Sensible opening calls for a fresh slip. */
const FRESH: SlipInput = { hours: 1, minutes: 35, mealRating: null, finalScore: 75, signHour: 9, signMinute: 30, flagCount: 1, distanceKm: 10.25, speechMinutes: 1, speechSeconds: 30 };

function fromRow(row: PredictionValues | null): SlipInput {
  if (!row) return FRESH;
  const run = row.run_seconds ?? 0;
  const sign = row.sign_photo_minutes ?? FRESH.signHour * 60 + FRESH.signMinute;
  const speech = row.speech_seconds ?? FRESH.speechMinutes * 60 + FRESH.speechSeconds;
  return {
    hours: Math.floor(run / 3600),
    minutes: Math.floor((run % 3600) / 60),
    mealRating: row.meal_rating,
    finalScore: row.final_score ?? FRESH.finalScore,
    signHour: Math.floor(sign / 60),
    signMinute: sign % 60,
    flagCount: row.flag_count ?? FRESH.flagCount,
    distanceKm: row.run_distance_km ?? FRESH.distanceKm,
    speechMinutes: Math.floor(speech / 60),
    speechSeconds: speech % 60,
  };
}

export function PredictionSlip({ locked, lockAt, existing }: { locked: boolean; lockAt: string; existing: PredictionValues | null }) {
  const router = useRouter();
  const [slip, setSlip] = useState<SlipInput>(() => fromRow(existing));
  const [distance, setDistance] = useState(() => fromRow(existing).distanceKm.toFixed(2));
  const [pending, startTransition] = useTransition();
  const set = (patch: Partial<SlipInput>) => setSlip((s) => ({ ...s, ...patch }));
  const num = (key: keyof SlipInput) => (e: React.ChangeEvent<HTMLInputElement>) => set({ [key]: e.target.value === "" ? Number.NaN : Number(e.target.value) });

  function save() {
    const input = { ...slip, distanceKm: distance === "" ? Number.NaN : Number(distance) };
    const invalid = validatePrediction(input);
    if (invalid || input.mealRating == null) {
      toast(invalid ?? "Pick a rib rating out of ten.", "warn");
      return;
    }
    startTransition(async () => {
      const res = await savePrediction({ ...input, mealRating: input.mealRating ?? 0 });
      toast(res.message ?? "", res.ok ? "ok" : "error");
      router.refresh();
    });
  }

  return (
    <div>
      <label className="pb-field">
        Victor’s 10 km finish time
        <div className="pb-inline-fields">
          <input type="number" min={0} max={8} value={slip.hours} disabled={locked} onChange={num("hours")} aria-label="Run hours" />
          <input type="number" min={0} max={59} value={slip.minutes} disabled={locked} onChange={num("minutes")} aria-label="Run minutes" />
        </div>
      </label>
      <p className="pb-small" style={{ marginTop: 5 }}>Hours / minutes</p>
      <div className="pb-field">
        Chicken and rib combo rating
        <RatingSelector value={slip.mealRating} label="Chicken and rib combo rating" onChange={(n) => set({ mealRating: n })} readOnly={locked} caption={locked ? "your call" : "exact match wins"} />
        <p className="pb-small" style={{ marginTop: 6 }}>Victor scores the combo out of ten on camera when he submits the proof. Match it exactly to take the points.</p>
      </div>
      <div className="pb-inline-fields">
        <label className="pb-field">
          Final score out of 100
          <input type="number" min={0} max={100} value={slip.finalScore} disabled={locked} onChange={num("finalScore")} />
        </label>
        <label className="pb-field">
          Distance on the approved trace (km)
          <input type="number" min={0} max={100} step="0.01" inputMode="decimal" value={distance} disabled={locked} onChange={(e) => setDistance(e.target.value)} />
        </label>
      </div>
      <label className="pb-field">
        Time the daylight sign photo lands (SAST)
        <div className="pb-inline-fields">
          <input type="number" min={0} max={23} value={slip.signHour} disabled={locked} onChange={num("signHour")} aria-label="Sign photo hour" />
          <input type="number" min={0} max={59} value={slip.signMinute} disabled={locked} onChange={num("signMinute")} aria-label="Sign photo minute" />
        </div>
      </label>
      <p className="pb-small" style={{ marginTop: 5 }}>Hour / minute, 24-hour clock. Settled from the submission time of challenge #03.</p>
      <div className="pb-inline-fields">
        <label className="pb-field">
          Versions the commissioner flags
          <input type="number" min={0} max={99} value={slip.flagCount} disabled={locked} onChange={num("flagCount")} />
        </label>
        <label className="pb-field">
          Sunset speech length
          <div className="pb-inline-fields">
            <input type="number" min={0} max={60} value={slip.speechMinutes} disabled={locked} onChange={num("speechMinutes")} aria-label="Speech minutes" />
            <input type="number" min={0} max={59} value={slip.speechSeconds} disabled={locked} onChange={num("speechSeconds")} aria-label="Speech seconds" />
          </div>
        </label>
      </div>
      <p className="pb-small" style={{ marginTop: 5 }}>Flags: exact match wins. Speech: minutes / seconds on the approved N14 clip.</p>
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
  const [points, setPoints] = useState<PredictionRules>(rules);
  const [pending, startTransition] = useTransition();
  return (
    <div style={{ marginTop: 16 }}>
      <h3>Admin: rules</h3>
      <p className="pb-small">Points per call. Configurable until predictions lock.</p>
      <div className="pb-inline-fields">
        {METRICS.map((m) => (
          <label className="pb-field" key={m.key}>
            {m.label}
            <input type="number" min={0} max={100} value={points[`${m.key}_points`]} onChange={(e) => setPoints((p) => ({ ...p, [`${m.key}_points`]: Number(e.target.value) }))} />
          </label>
        ))}
      </div>
      <div className="pb-actions">
        <button
          className="pb-secondary"
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await updatePredictionRules(points);
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
