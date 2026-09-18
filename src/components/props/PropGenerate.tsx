"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Status } from "@/components/ui/TitleRow";
import { generatePropBoard } from "@/lib/actions/props";

/** Commissioner-only: build the board from the programme. The RPC refuses once the board is locked or picked. */
export function PropGenerate({ existing }: { existing: number }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ text: string; tone: "ok" | "warn" | "error" } | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="pb-next" style={{ marginTop: 14 }}>
      <div className="pb-kicker">COMMISSIONER</div>
      <h3>{existing ? "Regenerate the board" : "Generate the board"}</h3>
      <p>
        {existing
          ? "Rebuilds all ten props from the event programme. Only possible while nobody has picked and nothing has locked."
          : "Builds ten props from the event programme: run distance, arrival delay, the rated meal, locals, approved challenges, feed comments, check-ins, the speech, receipts and the return bus."}
      </p>
      <div className="pb-actions compact">
        <button
          className={existing ? "pb-secondary" : "pb-primary"}
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await generatePropBoard();
              setMsg({ text: res.message ?? "", tone: res.ok ? "ok" : "error" });
              router.refresh();
            })
          }
        >
          {pending ? "Working…" : existing ? "Regenerate from the programme" : "Generate the board"}
        </button>
      </div>
      <Status tone={msg?.tone}>{msg?.text}</Status>
    </div>
  );
}
