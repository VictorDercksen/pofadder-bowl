"use client";

import { useEffect, useState } from "react";

type Parts = { days: number; hours: number; minutes: number; seconds: number };

function partsUntil(targetMs: number, now: number): Parts | null {
  const diff = targetMs - now;
  if (diff <= 0) return null;
  const s = Math.floor(diff / 1000);
  return { days: Math.floor(s / 86400), hours: Math.floor((s % 86400) / 3600), minutes: Math.floor((s % 3600) / 60), seconds: s % 60 };
}

/**
 * Live countdown on the public teaser. Counts to departure; once the bus has left,
 * counts to the home arrival; afterwards shows "sentence served".
 */
export function KickoffTimer({ departureIso, homeArrivalIso }: { departureIso: string; homeArrivalIso: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = window.setInterval(tick, 1000);
    const first = window.setTimeout(tick, 0);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(first);
    };
  }, []);

  const dep = Date.parse(departureIso);
  const home = Date.parse(homeArrivalIso);
  const phase = now == null ? "loading" : now < dep ? "pregame" : now < home ? "away" : "served";
  const parts = now == null ? null : partsUntil(phase === "pregame" ? dep : home, now);

  return (
    <div className="pb-timer" role="timer" aria-live="off" aria-label={phase === "pregame" ? "Countdown to departure" : phase === "away" ? "Countdown to home arrival" : "Sentence served"}>
      <div className="pb-timer-label">{phase === "pregame" ? "KICKOFF · BUS DEPARTS MALMESBURY" : phase === "away" ? "SENTENCE IN PROGRESS · HOME IN" : "FULL TIME"}</div>
      {phase === "served" ? (
        <div className="pb-timer-done">SENTENCE SERVED.</div>
      ) : (
        <div className="pb-timer-grid">
          {(["days", "hours", "minutes", "seconds"] as const).map((k) => (
            <div className="pb-timer-cell" key={k}>
              <strong>{parts ? String(parts[k]).padStart(2, "0") : "--"}</strong>
              <small>{k.toUpperCase()}</small>
            </div>
          ))}
        </div>
      )}
      <div className="pb-timer-foot">WED 23 SEPT · 19:15 SAST · NO TIMEOUTS. NO APPEALS.</div>
    </div>
  );
}
