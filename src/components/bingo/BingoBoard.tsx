"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Status } from "@/components/ui/TitleRow";
import { markedCellsFor, winningCells } from "@/lib/bingo";
import { proposeIncident } from "@/lib/actions/bingo";
import { decideIncident } from "@/lib/actions/review";

export type Square = { id: string; position: number; text: string; is_free: boolean };
export type Incident = { id: string; square_id: string; note: string | null; proposed_by: string; created_at: string };

/**
 * Production card: squares are marked only by commissioner-confirmed incidents.
 * Tapping a square proposes an incident (never marks it).
 */
export function BingoBoard({ layout, squares, confirmedPositions, proposedSquareIds, isCommissioner, incidents }: { layout: number[]; squares: Square[]; confirmedPositions: number[]; proposedSquareIds: string[]; isCommissioner: boolean; incidents: Incident[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Square | null>(null);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ text: string; tone: "ok" | "warn" | "error" } | null>(null);
  const [pending, startTransition] = useTransition();
  const byPosition = new Map(squares.map((s) => [s.position, s]));
  const marked = new Set(markedCellsFor(layout, confirmedPositions));
  const winning = winningCells(marked);
  const proposed = new Set(proposedSquareIds);

  function propose() {
    if (!selected) return;
    startTransition(async () => {
      const res = await proposeIncident({ squareId: selected.id, note: note.trim() || undefined });
      setMsg({ text: res.message ?? "", tone: res.ok ? "ok" : "error" });
      if (res.ok) {
        setSelected(null);
        setNote("");
      }
      router.refresh();
    });
  }

  function decide(id: string, confirm: boolean) {
    startTransition(async () => {
      const res = await decideIncident({ incidentId: id, confirm });
      setMsg({ text: res.message ?? "", tone: res.ok ? "ok" : "error" });
      router.refresh();
    });
  }

  return (
    <>
      <div className="pb-bingo-letters" aria-hidden="true">
        <span>B</span>
        <span>I</span>
        <span>N</span>
        <span>G</span>
        <span>O</span>
      </div>
      <div className="pb-bingo" role="group" aria-label="Your bingo card">
        {layout.map((position, cell) => {
          const sq = byPosition.get(position);
          if (!sq) return <button key={cell} type="button" disabled>?</button>;
          const isMarked = marked.has(cell);
          return (
            <button
              key={sq.id}
              type="button"
              aria-pressed={isMarked}
              aria-label={`${sq.text}${isMarked ? ", marked" : proposed.has(sq.id) ? ", proposed" : ""}`}
              className={`${sq.is_free ? "free" : ""} ${winning.has(cell) ? "winning" : ""} ${proposed.has(sq.id) ? "proposed" : ""}`.trim()}
              disabled={sq.is_free || isMarked}
              onClick={() => setSelected(sq)}
            >
              {sq.text}
            </button>
          );
        })}
      </div>
      {selected ? (
        <div className="pb-next" style={{ marginTop: 14 }}>
          <div className="pb-kicker">PROPOSE AN INCIDENT</div>
          <h3>“{selected.text}”</h3>
          <label className="pb-field">
            What happened? (optional)
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Where, when, who said it" />
          </label>
          <div className="pb-actions">
            <button className="pb-primary" type="button" onClick={propose} disabled={pending || proposed.has(selected.id)}>
              {proposed.has(selected.id) ? "Already proposed" : "Propose incident"}
            </button>
            <button className="pb-secondary" type="button" onClick={() => setSelected(null)}>Cancel</button>
          </div>
        </div>
      ) : null}
      {isCommissioner && incidents.length > 0 ? (
        <div style={{ marginTop: 14 }}>
          <h3>Proposed incidents</h3>
          {incidents.map((inc) => {
            const sq = squares.find((s) => s.id === inc.square_id);
            return (
              <div className="pb-challenge" key={inc.id}>
                <span className="pb-num">?</span>
                <div style={{ minWidth: 0 }}>
                  <strong>{sq?.text ?? "Square"}</strong>
                  <p>
                    {inc.proposed_by} · {inc.created_at}
                    {inc.note ? ` · ${inc.note}` : ""}
                  </p>
                </div>
                <div className="pb-actions compact" style={{ marginLeft: "auto", flexShrink: 0 }}>
                  <button className="pb-primary" type="button" disabled={pending} onClick={() => decide(inc.id, true)}>Confirm</button>
                  <button className="pb-secondary" type="button" disabled={pending} onClick={() => decide(inc.id, false)}>Reject</button>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
      <Status tone={msg?.tone}>{msg?.text}</Status>
    </>
  );
}
