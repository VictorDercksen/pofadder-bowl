"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Status } from "@/components/ui/TitleRow";
import { claimSleeperIdentity, updateProfile } from "@/lib/actions/account";
import { NFL_TEAMS } from "@/lib/nfl";

export function KitForm({ displayName, kitTeam, kitNumber }: { displayName: string; kitTeam: string; kitNumber: number }) {
  const router = useRouter();
  const [name, setName] = useState(displayName);
  const [team, setTeam] = useState(kitTeam);
  const [number, setNumber] = useState(kitNumber);
  const [note, setNote] = useState<{ text: string; tone: "ok" | "warn" | "error" } | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div>
      <label className="pb-field">
        Nameplate
        <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="pb-inline-fields">
        <label className="pb-field">
          Franchise
          <select value={team} onChange={(e) => setTeam(e.target.value)}>
            {NFL_TEAMS.map((t) => (
              <option key={t.code} value={t.code}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="pb-field">
          Number (0–99)
          <input type="number" min={0} max={99} value={number} onChange={(e) => setNumber(Number(e.target.value))} />
        </label>
      </div>
      <div className="pb-actions">
        <button
          className="pb-primary"
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await updateProfile({ displayName: name, kitTeam: team, kitNumber: number });
              setNote({ text: res.message ?? "", tone: res.ok ? "ok" : "error" });
              router.refresh();
            })
          }
        >
          Save kit
        </button>
      </div>
      <Status tone={note?.tone}>{note?.text}</Status>
    </div>
  );
}

export function SleeperClaim({ users, current, confirmed }: { users: { id: string; label: string }[]; current: string | null; confirmed: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState(current ?? "");
  const [note, setNote] = useState<{ text: string; tone: "ok" | "warn" | "error" } | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div>
      <label className="pb-field">
        Your Sleeper manager
        <select value={value} onChange={(e) => setValue(e.target.value)} disabled={confirmed}>
          <option value="">— not linked —</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.label}
            </option>
          ))}
        </select>
      </label>
      <div className="pb-actions">
        <button
          className="pb-secondary"
          type="button"
          disabled={pending || confirmed}
          onClick={() =>
            startTransition(async () => {
              const res = await claimSleeperIdentity({ sleeperUserId: value || null });
              setNote({ text: res.message ?? "", tone: res.ok ? "ok" : "error" });
              router.refresh();
            })
          }
        >
          {confirmed ? "Confirmed by commissioner" : "Claim this identity"}
        </button>
      </div>
      <Status tone={note?.tone}>{note?.text}</Status>
    </div>
  );
}
