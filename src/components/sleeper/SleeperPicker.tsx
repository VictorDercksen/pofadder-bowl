"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Football } from "@/components/ui/Football";
import { Status } from "@/components/ui/TitleRow";
import { SleeperTeamCard } from "@/components/sleeper/SleeperTeam";
import { claimSleeperIdentity } from "@/lib/actions/account";

export type SleeperChoice = { id: string; teamName: string | null; displayName: string; username: string | null; avatarUrl: string | null; takenBy: string | null; isOwner: boolean };

/** Sign-on step: pick your team from the imported Sleeper league. Teams other members confirmed are locked. */
export function SleeperPicker({ choices, current, afterConfirm }: { choices: SleeperChoice[]; current: string | null; afterConfirm: string }) {
  const router = useRouter();
  const [picked, setPicked] = useState<string | null>(current);
  const [note, setNote] = useState<{ text: string; tone: "ok" | "warn" | "error" } | null>(null);
  const [pending, startTransition] = useTransition();
  const chosen = choices.find((c) => c.id === picked) ?? null;

  function confirm() {
    if (!picked) {
      setNote({ text: "Pick your team first.", tone: "warn" });
      return;
    }
    startTransition(async () => {
      const res = await claimSleeperIdentity({ sleeperUserId: picked });
      if (res.ok) {
        router.replace(afterConfirm);
        router.refresh();
      } else {
        setNote({ text: res.message ?? "", tone: "error" });
        router.refresh();
      }
    });
  }

  return (
    <div className="pb-sl-panel">
      <div className="pb-sl-panel-head">
        <span className="pb-sl-mark" aria-hidden="true">S</span>
        <div>
          <b>Which team is yours?</b>
          <small>{choices.length} managers in the Sleeper league · {choices.filter((c) => c.takenBy).length} already confirmed</small>
        </div>
      </div>
      <div className="pb-sl-grid" role="radiogroup" aria-label="Your Sleeper team">
        {choices.map((c) => (
          <button key={c.id} type="button" role="radio" aria-checked={picked === c.id} className="pb-sl-option" disabled={Boolean(c.takenBy)} onClick={() => setPicked(c.id)}>
            <SleeperTeamCard teamName={c.teamName} displayName={c.displayName} username={c.username} avatarUrl={c.avatarUrl} selected={picked === c.id} taken={c.takenBy} tag={c.isOwner ? "COMMISH" : undefined} />
          </button>
        ))}
      </div>
      <div className="pb-sl-panel-foot">
        <span className="pb-sl-muted">{chosen ? `Confirming as ${chosen.teamName ?? chosen.displayName}` : "Nothing picked yet"}</span>
        <button className="pb-sl-button" type="button" disabled={pending || !picked} onClick={confirm}>
          {pending ? <Football size={16} /> : null}
          {pending ? "Confirming…" : "Confirm my team"}
        </button>
      </div>
      <Status tone={note?.tone}>{note?.text}</Status>
    </div>
  );
}
