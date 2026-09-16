"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Status } from "@/components/ui/TitleRow";
import { TeamLogo } from "@/components/ui/Marks";
import { confirmSleeperLink, importSleeperLeague, inviteMember, setEventParticipant, setMemberRole } from "@/lib/actions/members";

type Note = { text: string; tone: "ok" | "warn" | "error" } | null;

export function InviteForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"member" | "participant">("member");
  const [commish, setCommish] = useState(false);
  const [note, setNote] = useState<Note>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div>
      <label className="pb-field">
        Email
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="member@example.com" />
      </label>
      <label className="pb-field">
        Display name (optional)
        <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="pb-field">
        Role
        <select value={role} onChange={(e) => setRole(e.target.value as "member" | "participant")}>
          <option value="member">League member</option>
          <option value="participant">Participant</option>
        </select>
      </label>
      <label className="pb-check-row">
        <input type="checkbox" checked={commish} onChange={(e) => setCommish(e.target.checked)} />
        Also a commissioner
      </label>
      <div className="pb-actions">
        <button
          className="pb-primary"
          type="button"
          disabled={pending || !email}
          onClick={() =>
            startTransition(async () => {
              const res = await inviteMember({ email, displayName: name || undefined, role, isCommissioner: commish });
              setNote({ text: res.message ?? "", tone: res.ok ? "ok" : "error" });
              if (res.ok) {
                setEmail("");
                setName("");
              }
              router.refresh();
            })
          }
        >
          Send invitation
        </button>
      </div>
      <Status tone={note?.tone}>{note?.text}</Status>
    </div>
  );
}

export function MemberRow({ membership, profile, isSelf, isEventParticipant, sleeperUsers }: { membership: { user_id: string; role: "member" | "participant"; is_commissioner: boolean; status: "invited" | "active" | "removed"; invited_email: string | null; sleeper_user_id: string | null; sleeper_confirmed: boolean; created: string }; profile: { display_name: string; kit_team: string; kit_number: number } | null; isSelf: boolean; isEventParticipant: boolean; sleeperUsers: { id: string; label: string }[] }) {
  const router = useRouter();
  const [role, setRole] = useState(membership.role);
  const [commish, setCommish] = useState(membership.is_commissioner);
  const [status, setStatus] = useState(membership.status);
  const [sleeper, setSleeper] = useState(membership.sleeper_user_id ?? "");
  const [note, setNote] = useState<Note>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const res = await setMemberRole({ userId: membership.user_id, role, isCommissioner: commish, status });
      setNote({ text: res.message ?? "", tone: res.ok ? "ok" : "error" });
      router.refresh();
    });
  }

  return (
    <div className="pb-challenge" style={{ flexWrap: "wrap" }}>
      {profile ? <TeamLogo code={profile.kit_team} decorative size={30} /> : <span className="pb-num">?</span>}
      <div style={{ flex: 1, minWidth: 200 }}>
        <strong>
          {profile?.display_name ?? membership.invited_email ?? membership.user_id}
          {isSelf ? " (you)" : ""}
          {isEventParticipant ? <span className="pb-tag orange" style={{ marginLeft: 6 }}>EVENT PARTICIPANT</span> : null}
        </strong>
        <p>
          {membership.invited_email ?? ""} · {membership.status} · added {membership.created}
          {membership.sleeper_user_id ? ` · Sleeper ${membership.sleeper_confirmed ? "confirmed" : "claimed"}` : ""}
        </p>
        <div className="pb-inline-list">
          <label>
            Role{" "}
            <select value={role} onChange={(e) => setRole(e.target.value as "member" | "participant")}>
              <option value="member">member</option>
              <option value="participant">participant</option>
            </select>
          </label>
          <label>
            <input type="checkbox" checked={commish} disabled={isSelf} onChange={(e) => setCommish(e.target.checked)} /> commissioner
          </label>
          <label>
            Status{" "}
            <select value={status} onChange={(e) => setStatus(e.target.value as "invited" | "active" | "removed")}>
              <option value="invited">invited</option>
              <option value="active">active</option>
              <option value="removed">removed</option>
            </select>
          </label>
          <button className="pb-text-action" type="button" disabled={pending} onClick={save}>Save</button>
          {role === "participant" && status === "active" && !isEventParticipant ? (
            <button
              className="pb-text-action"
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await setEventParticipant({ userId: membership.user_id });
                  setNote({ text: res.message ?? "", tone: res.ok ? "ok" : "error" });
                  router.refresh();
                })
              }
            >
              Make event participant
            </button>
          ) : null}
        </div>
        {sleeperUsers.length ? (
          <div className="pb-inline-list">
            <label>
              Sleeper{" "}
              <select value={sleeper} onChange={(e) => setSleeper(e.target.value)}>
                <option value="">— none —</option>
                {sleeperUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="pb-text-action"
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await confirmSleeperLink({ userId: membership.user_id, sleeperUserId: sleeper || null, confirmed: Boolean(sleeper) });
                  setNote({ text: res.message ?? "", tone: res.ok ? "ok" : "error" });
                  router.refresh();
                })
              }
            >
              {sleeper ? "Confirm link" : "Clear link"}
            </button>
          </div>
        ) : null}
        <Status tone={note?.tone}>{note?.text}</Status>
      </div>
    </div>
  );
}

export function SleeperImport() {
  const router = useRouter();
  const [note, setNote] = useState<Note>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div>
      <div className="pb-actions">
        <button
          className="pb-secondary"
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await importSleeperLeague();
              setNote({ text: res.message ?? "", tone: res.ok ? "ok" : "error" });
              router.refresh();
            })
          }
        >
          {pending ? "Importing…" : "Import Sleeper managers"}
        </button>
      </div>
      <Status tone={note?.tone}>{note?.text}</Status>
    </div>
  );
}
