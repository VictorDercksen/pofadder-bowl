"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast-store";
import { resetTestingData } from "@/lib/actions/testing";

/** Testing deployments only: the admin's "start again" button (see reset_event_data). */
export function TestingReset({ eventSlug }: { eventSlug: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState("");
  const [resetTours, setResetTours] = useState(false);
  const [pending, startTransition] = useTransition();
  const ready = confirm.trim() === eventSlug;
  return (
    <div>
      <p className="pb-small">
        Wipes every submission, upload, comment, reaction, check-in, pin, pick, prediction, result and penalty for this event, and puts the certificate back to pending. Members, kits, Sleeper links and the programme stay. Cannot be undone.
      </p>
      <label className="pb-check-row">
        <input type="checkbox" checked={resetTours} onChange={(e) => setResetTours(e.target.checked)} />
        Also reset every member’s first-run tour
      </label>
      <label className="pb-field">
        Type <b>{eventSlug}</b> to confirm
        <input value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" spellCheck={false} placeholder={eventSlug} />
      </label>
      <div className="pb-actions">
        <button
          type="button"
          className="pb-primary orange"
          disabled={pending || !ready}
          onClick={() =>
            startTransition(async () => {
              const res = await resetTestingData({ confirm: confirm.trim(), resetTours });
              toast(res.message ?? "", res.ok ? "ok" : "error");
              if (res.ok) setConfirm("");
              router.refresh();
            })
          }
        >
          {pending ? "Resetting…" : "Reset the event"}
        </button>
      </div>
    </div>
  );
}
