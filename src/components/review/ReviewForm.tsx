"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { newId } from "@/lib/ids";
import { toast } from "@/lib/toast-store";
import { reviewSubmission } from "@/lib/actions/review";

/** Approve / flag / supersede with a per-page idempotency key so retries never double-award. */
export function ReviewForm({ submissionId, version, status, points }: { submissionId: string; version: number; status: string; points: number }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  // One key per (submission, version, decision) per page load: a double-click or retry replays the same decision.
  const keyBase = useRef(newId());

  function decide(decision: "approved" | "flagged" | "superseded") {
    if (decision === "flagged" && !reason.trim()) {
      toast("Add a reason so Victor knows what needs fixing.", "warn");
      return;
    }
    startTransition(async () => {
      const res = await reviewSubmission({ submissionId, version, decision, idempotencyKey: `${keyBase.current}:${decision}:${version}`, reason: reason.trim() || undefined, note: note.trim() || undefined });
      // The server replays an identical request for this key; a later, different decision needs a new one.
      keyBase.current = newId();
      toast(res.message ?? "", res.ok ? "ok" : "error");
      router.refresh();
    });
  }

  const canApprove = status === "submitted" || status === "flagged";
  const canFlag = status === "submitted" || status === "approved";
  const canSupersede = status === "approved";

  return (
    <div className="pb-panel" style={{ marginTop: 15 }}>
      <div className="pb-panel-top">
        <h3>Make the call</h3>
        <span className={`pb-tag ${status === "submitted" || status === "flagged" ? "orange" : ""}`}>{status.toUpperCase()}</span>
      </div>
      <label className="pb-field">
        Review note (optional, visible to the participant)
        <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} placeholder="What you saw. What convinced you." />
      </label>
      <label className="pb-field">
        Flag reason (required to flag)
        <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="e.g. Only two interviews are audible" />
      </label>
      <div className="pb-actions">
        <button className="pb-primary" type="button" disabled={pending || !canApprove} onClick={() => decide("approved")}>
          Approve{points ? ` · +${points} points` : ""}
        </button>
        <button className="pb-secondary" type="button" disabled={pending || !canFlag} onClick={() => decide("flagged")}>
          Flag the proof
        </button>
        {canSupersede ? (
          <button className="pb-secondary" type="button" disabled={pending} onClick={() => decide("superseded")}>
            Mark superseded
          </button>
        ) : null}
      </div>
      <p className="pb-small" style={{ marginTop: 10 }}>
        Approving is transactional and idempotent: repeated clicks and concurrent reviews cannot double-award. Approving a newer version explicitly supersedes an earlier approved one and records both decisions.
      </p>
    </div>
  );
}
