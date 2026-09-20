"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast-store";
import { savePropPicks, settleProp } from "@/lib/actions/props";
import { pendingPicks, pickOutcome, sideLabel, sidesFor, type PropKind, type PropResult, type PropSide } from "@/lib/props";

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
 * Production board: a member drafts one side per prop and saves the lot with the button at the
 * bottom; nothing is written until then. A commissioner settles a locked prop. Everything is
 * re-checked by the RPCs; the buttons only decide what to show.
 */
export function PropBoard({ props, isCommissioner }: { props: BoardProp[]; isCommissioner: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Sides tapped but not saved, keyed by prop id. A draft equal to the saved side counts as clean,
  // so the server's picks win again after a successful save and refresh.
  const [drafts, setDrafts] = useState<Partial<Record<string, PropSide>>>({});
  const unsaved = pendingPicks(props, drafts);
  const open = props.some((p) => !p.locked);

  useEffect(() => {
    if (unsaved.length === 0) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved.length]);

  function pick(propId: string, side: PropSide) {
    setDrafts((d) => ({ ...d, [propId]: side }));
  }

  function save() {
    if (unsaved.length === 0) return;
    startTransition(async () => {
      const res = await savePropPicks({ picks: unsaved });
      toast(res.message ?? "", res.ok ? "ok" : "error");
      router.refresh();
    });
  }

  function discard() {
    setDrafts({});
  }

  function settle(propId: string, result: PropResult) {
    startTransition(async () => {
      const res = await settleProp({ propId, result });
      toast(res.message ?? "", res.ok ? "ok" : "error");
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
          const shown = p.locked ? p.mine : (drafts[p.id] ?? p.mine);
          const dirty = !p.locked && shown != null && shown !== p.mine;
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
                        aria-pressed={shown === side}
                        className={`${isResult ? "hit" : settled && p.result !== "void" ? "miss" : ""} ${dirty && shown === side ? "draft" : ""}`.trim()}
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
                      : dirty
                        ? `${sideLabel(shown!)} · not saved yet.`
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
      {open ? (
        <div className="pb-actions pb-prop-save">
          <button className="pb-primary" type="button" onClick={save} disabled={pending || unsaved.length === 0}>
            {pending ? "Saving…" : unsaved.length === 0 ? "Save picks" : `Save ${unsaved.length} ${unsaved.length === 1 ? "pick" : "picks"}`}
          </button>
          {unsaved.length > 0 ? (
            <button className="pb-secondary" type="button" onClick={discard} disabled={pending}>
              Discard changes
            </button>
          ) : null}
          <span className="pb-small pb-prop-save-note" aria-live="polite">
            {unsaved.length === 0 ? "Nothing to save." : "Your sides are not saved until you tap Save."}
          </span>
        </div>
      ) : null}
    </>
  );
}
