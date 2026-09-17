"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Status } from "@/components/ui/TitleRow";
import { savePropPick, settleProp } from "@/lib/actions/props";
import { pickOutcome, sideLabel, sidesFor, type PropKind, type PropResult, type PropSide } from "@/lib/props";

export type BoardProp = {
  id: string;
  sequence: number;
  title: string;
  detail: string | null;
  kind: PropKind;
  line: string;
  locked: boolean;
  locksAt: string;
  result: PropResult | null;
  mine: PropSide | null;
  /** Names per side, only supplied once the prop has locked (RLS hides other picks before that). */
  picks: Partial<Record<PropSide, string[]>> | null;
};

/**
 * Production board: a member picks one side per prop until it locks; a commissioner settles
 * a locked prop. Everything is re-checked by the RPCs; the buttons only decide what to show.
 */
export function PropBoard({ props, isCommissioner }: { props: BoardProp[]; isCommissioner: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ text: string; tone: "ok" | "warn" | "error" } | null>(null);
  const [pending, startTransition] = useTransition();

  function pick(propId: string, side: PropSide) {
    startTransition(async () => {
      const res = await savePropPick({ propId, side });
      setMsg({ text: res.message ?? "", tone: res.ok ? "ok" : "error" });
      router.refresh();
    });
  }

  function settle(propId: string, result: PropResult) {
    startTransition(async () => {
      const res = await settleProp({ propId, result });
      setMsg({ text: res.message ?? "", tone: res.ok ? "ok" : "error" });
      router.refresh();
    });
  }

  return (
    <>
      <div className="pb-prop-board" role="list" aria-label="Prop board">
        {props.map((p) => {
          const sides = sidesFor(p.kind);
          const outcome = pickOutcome(p, p.mine);
          const settled = p.result != null;
          return (
            <div className={`pb-challenge pb-prop ${settled ? "settled" : ""}`.trim()} role="listitem" key={p.id}>
              <span className="pb-num">{p.sequence}</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <strong>
                  {p.title}
                  {p.line ? <span className="pb-prop-line">{p.line}</span> : null}
                </strong>
                {p.detail ? <p>{p.detail}</p> : null}
                <div className="pb-prop-sides" role="group" aria-label={`Your side on prop ${p.sequence}`}>
                  {sides.map((side) => {
                    const names = p.picks?.[side] ?? [];
                    const isResult = p.result === side;
                    return (
                      <button
                        key={side}
                        type="button"
                        aria-pressed={p.mine === side}
                        className={`${isResult ? "hit" : settled && p.result !== "void" ? "miss" : ""}`.trim()}
                        disabled={p.locked || pending}
                        onClick={() => pick(p.id, side)}
                        title={p.locked && names.length ? names.join(", ") : undefined}
                      >
                        {sideLabel(side)}
                        {p.locked && p.picks ? <small>{names.length}</small> : null}
                      </button>
                    );
                  })}
                </div>
                {p.locked && p.picks ? (
                  <p className="pb-small pb-prop-names">
                    {sides.map((side) => `${sideLabel(side)}: ${(p.picks?.[side] ?? []).join(", ") || "nobody"}`).join(" · ")}
                  </p>
                ) : null}
                <p className="pb-small pb-prop-state">
                  {settled
                    ? `Settled · ${sideLabel(p.result!)}${outcome === "correct" ? " · you called it" : outcome === "wrong" ? " · you missed" : outcome === "void" ? " · no points" : ""}`
                    : p.locked
                      ? p.mine
                        ? `Locked · you took ${sideLabel(p.mine)}`
                        : "Locked · no pick"
                      : p.mine
                        ? `You have ${sideLabel(p.mine)}. Tap the other side to change it.`
                        : "Pick a side."}
                </p>
                {isCommissioner && p.locked ? (
                  <div className="pb-actions compact">
                    {[...sides, "void" as const].map((r) => (
                      <button key={r} className={r === "void" ? "pb-secondary" : "pb-primary"} type="button" disabled={pending || p.result === r} onClick={() => settle(p.id, r)}>
                        {p.result === r ? `Settled ${sideLabel(r)}` : `Settle ${sideLabel(r)}`}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      <Status tone={msg?.tone}>{msg?.text}</Status>
    </>
  );
}
