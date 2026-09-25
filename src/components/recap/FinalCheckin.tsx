"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast-store";
import { setFinalCheckin } from "@/lib/actions/checkins";

export type FinalCheckinPoint = { id: string; place: string; when: string };

/**
 * Participant control: confirm the latest check-in as the last one of the trip. The certificate
 * PNG then draws the route up to it. Shown on the map and the recap; locked once the certificate
 * is issued (the RPC refuses too). `inline` drops the panel frame when it sits inside another panel.
 */
export function FinalCheckin({ latest, confirmed, confirmedAt, locked, inline = false }: { latest: FinalCheckinPoint | null; confirmed: FinalCheckinPoint | null; confirmedAt: string | null; locked: boolean; inline?: boolean }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const run = (checkinId: string | null) =>
    startTransition(async () => {
      const res = await setFinalCheckin({ checkinId });
      toast(res.message ?? "", res.ok ? "ok" : "error");
      setConfirming(false);
      router.refresh();
    });

  const newer = confirmed && latest && latest.id !== confirmed.id ? latest : null;

  return (
    <div className={inline ? "pb-final-checkin inline" : "pb-panel pb-final-checkin"}>
      <div className="pb-panel-top">
        <h3>Final check-in</h3>
        <span className={`pb-tag ${confirmed ? "" : "orange"}`}>{confirmed ? "ROUTE SET" : "NOT CONFIRMED"}</span>
      </div>
      {confirmed ? (
        <p className="pb-small">
          <b>{confirmed.place}</b> · {confirmed.when}. The certificate draws the route from the first check-in to this one, with your badge on it.
          {confirmedAt ? ` Confirmed ${confirmedAt}.` : ""}
        </p>
      ) : latest ? (
        <p className="pb-small">
          Latest: <b>{latest.place}</b> · {latest.when}. Confirm it as the last check-in of the trip to set the route on the certificate. Until then the certificate shows the trail on record as provisional.
        </p>
      ) : (
        <p className="pb-small">No check-in on record yet. Check in at the finish, then confirm it here.</p>
      )}
      {newer && !locked ? <p className="pb-small pb-warn-text">Newer check-in since: {newer.place} · {newer.when}.</p> : null}
      {locked ? (
        <p className="pb-inline-status">The certificate is issued. The route is set.</p>
      ) : (
        <div className="pb-actions">
          {confirming && latest ? (
            <>
              <button className="pb-primary" type="button" disabled={pending} onClick={() => run(latest.id)}>
                Confirm: end the route here
              </button>
              <button className="pb-secondary" type="button" disabled={pending} onClick={() => setConfirming(false)}>
                Cancel
              </button>
            </>
          ) : (
            <>
              {latest && (!confirmed || newer) ? (
                <button className="pb-primary" type="button" disabled={pending} onClick={() => setConfirming(true)}>
                  {newer ? "Use the latest check-in instead" : "Confirm as final check-in"}
                </button>
              ) : null}
              {confirmed ? (
                <button className="pb-secondary" type="button" disabled={pending} onClick={() => run(null)}>
                  Clear
                </button>
              ) : null}
            </>
          )}
        </div>
      )}
    </div>
  );
}
