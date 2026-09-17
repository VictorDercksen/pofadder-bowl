"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Status } from "@/components/ui/TitleRow";
import { claimSleeperIdentity, setPassword, updateProfile } from "@/lib/actions/account";

export function KitForm({ displayName, kitNumber }: { displayName: string; kitNumber: number }) {
  const router = useRouter();
  const [name, setName] = useState(displayName);
  const [number, setNumber] = useState(kitNumber);
  const [note, setNote] = useState<{ text: string; tone: "ok" | "warn" | "error" } | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div>
      <label className="pb-field">
        Nameplate
        <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="pb-field">
        Number (0–99)
        <input type="number" min={0} max={99} value={number} onChange={(e) => setNumber(Number(e.target.value))} />
      </label>
      <div className="pb-actions">
        <button
          className="pb-primary"
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await updateProfile({ displayName: name, kitNumber: number });
              setNote({ text: res.message ?? "", tone: res.ok ? "ok" : "error" });
              router.refresh();
            })
          }
        >
          Save nameplate
        </button>
      </div>
      <Status tone={note?.tone}>{note?.text}</Status>
    </div>
  );
}

export function SleeperClaim({ users, current }: { users: { id: string; label: string; taken: boolean }[]; current: string | null }) {
  const router = useRouter();
  const [value, setValue] = useState(current ?? "");
  const [note, setNote] = useState<{ text: string; tone: "ok" | "warn" | "error" } | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div>
      <label className="pb-field">
        Your Sleeper team
        <select value={value} onChange={(e) => setValue(e.target.value)}>
          <option value="">— not linked —</option>
          {users.map((u) => (
            <option key={u.id} value={u.id} disabled={u.taken && u.id !== current}>
              {u.label}
              {u.taken && u.id !== current ? " (taken)" : ""}
            </option>
          ))}
        </select>
      </label>
      <div className="pb-actions">
        <button
          className="pb-secondary"
          type="button"
          disabled={pending || value === (current ?? "")}
          onClick={() =>
            startTransition(async () => {
              const res = await claimSleeperIdentity({ sleeperUserId: value || null });
              setNote({ text: res.message ?? "", tone: res.ok ? "ok" : "error" });
              router.refresh();
            })
          }
        >
          {pending ? "Saving…" : value ? "Confirm this team" : "Clear link"}
        </button>
      </div>
      <Status tone={note?.tone}>{note?.text}</Status>
    </div>
  );
}

/**
 * Set or change the password. With `afterSave` (the /set-password gate) a success navigates on;
 * in League access it stays put and clears the fields.
 */
export function PasswordForm({ afterSave, label = "Save password" }: { afterSave?: string; label?: string } = {}) {
  const router = useRouter();
  const [password, setPasswordValue] = useState("");
  const [again, setAgain] = useState("");
  const [note, setNote] = useState<{ text: string; tone: "ok" | "warn" | "error" } | null>(null);
  const [pending, startTransition] = useTransition();
  const mismatch = again.length > 0 && again !== password;
  return (
    <div>
      <label className="pb-field">
        New password (8+ characters)
        <input type="password" autoComplete="new-password" value={password} minLength={8} maxLength={200} onChange={(e) => setPasswordValue(e.target.value)} />
      </label>
      <label className="pb-field">
        Repeat it
        <input type="password" autoComplete="new-password" value={again} maxLength={200} onChange={(e) => setAgain(e.target.value)} aria-invalid={mismatch || undefined} />
      </label>
      <div className="pb-actions">
        <button
          className="pb-primary"
          type="button"
          disabled={pending || password.length < 8 || again !== password}
          onClick={() =>
            startTransition(async () => {
              const res = await setPassword({ password });
              setNote({ text: res.message ?? "", tone: res.ok ? "ok" : "error" });
              if (res.ok) {
                setPasswordValue("");
                setAgain("");
                if (afterSave) {
                  router.push(afterSave);
                  router.refresh();
                }
              }
            })
          }
        >
          {pending ? "Saving…" : label}
        </button>
      </div>
      {mismatch ? <p className="pb-small" style={{ marginTop: 8, color: "#b3392a" }}>The two entries differ.</p> : null}
      <Status tone={note?.tone}>{note?.text}</Status>
    </div>
  );
}
