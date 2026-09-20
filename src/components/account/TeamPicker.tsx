"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { JerseyCard } from "@/components/ui/JerseyCard";
import { TeamLogo } from "@/components/ui/Marks";
import { toast } from "@/lib/toast-store";
import { claimKit } from "@/lib/actions/account";
import { NFL_TEAMS } from "@/lib/nfl";

export type Claimed = { team: string; by: string; mine: boolean };

/** Franchise grid: claimed teams are disabled, live jersey preview, then claim. */
export function TeamPicker({ claimed, initialNumber, current, afterClaim = "/home" }: { claimed: Claimed[]; initialNumber: number; current?: string | null; afterClaim?: string }) {
  const router = useRouter();
  const takenBy = new Map(claimed.filter((c) => !c.mine).map((c) => [c.team, c.by]));
  const [team, setTeam] = useState<string | null>(current ?? null);
  const [number, setNumber] = useState(initialNumber);
  const [name] = useState("YOUR NAME");
  const [pending, startTransition] = useTransition();

  function claim() {
    if (!team) {
      toast("Pick a franchise first.", "warn");
      return;
    }
    startTransition(async () => {
      const res = await claimKit({ kitTeam: team, kitNumber: number });
      toast(res.message ?? "", res.ok ? "ok" : "error");
      if (res.ok) {
        router.replace(afterClaim);
        router.refresh();
      } else router.refresh();
    });
  }

  return (
    <div className="pb-split">
      <div className="pb-panel">
        <div className="pb-panel-top">
          <h3>32 franchises</h3>
          <span className="pb-tag">{takenBy.size} TAKEN · {32 - takenBy.size} OPEN</span>
        </div>
        <div className="pb-team-grid" role="radiogroup" aria-label="Franchise">
          {NFL_TEAMS.map((t) => {
            const holder = takenBy.get(t.code);
            const selected = team === t.code;
            return (
              <button
                key={t.code}
                type="button"
                role="radio"
                aria-checked={selected}
                className={`pb-team-option ${selected ? "selected" : ""} ${holder ? "taken" : ""}`}
                disabled={Boolean(holder)}
                title={holder ? `${t.name} · worn by ${holder}` : t.name}
                onClick={() => setTeam(t.code)}
              >
                <TeamLogo code={t.code} decorative size={40} className="" />
                <span>{t.name.split(" ").slice(-1)[0]}</span>
                {holder ? <small>{holder}</small> : null}
              </button>
            );
          })}
        </div>
        <label className="pb-field">
          Kit number (0–99)
          <input type="number" min={0} max={99} value={number} onChange={(e) => setNumber(Math.max(0, Math.min(99, Number(e.target.value) || 0)))} />
        </label>
        <div className="pb-actions">
          <button className="pb-primary" type="button" onClick={claim} disabled={pending || !team}>
            {pending ? "Claiming…" : team ? `Claim the ${NFL_TEAMS.find((t) => t.code === team)?.name}` : "Pick a franchise"}
          </button>
        </div>
      </div>
      <div>
        <div className="pb-kicker">PREVIEW</div>
        <div className="pb-jersey-feed">
          <JerseyCard team={team ?? "nfl"} displayName={name} number={number} heading={team ? "Locked in." : "Your kit, your card."} message={team ? "Every post, call and prop pick you make wears this kit." : "Choose a franchise to see your sideline card."} time="Not posted" kind="Preview" captain={false} />
        </div>
      </div>
    </div>
  );
}
