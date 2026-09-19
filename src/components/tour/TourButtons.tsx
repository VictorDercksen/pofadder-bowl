"use client";

import { usePathname } from "next/navigation";
import type { Role } from "@/lib/roles";
import { startTour } from "@/lib/tour-store";

/** League access: run your own role's tour again. */
export function TourReplayButton({ role, isParticipant, persist }: { role: Role; isParticipant: boolean; persist: boolean }) {
  const pathname = usePathname();
  return (
    <button type="button" className="pb-secondary" onClick={() => startTour({ role, participant: isParticipant, persist, returnTo: pathname })}>
      Replay the tour
    </button>
  );
}

const TEST_ROLES: { role: Role; label: string; note: string }[] = [
  { role: "member", label: "League member", note: "Game centre, map, prop board, predictions, press, recap" },
  { role: "participant", label: "Participant", note: "Adds My trip, location sharing and the proof locker" },
  { role: "commissioner", label: "Commissioner", note: "Adds the review queue and the whistle" },
  { role: "admin", label: "Admin", note: "Adds the roster, member view and this panel" },
];

/** League admin: run any role's tour without touching the completion flag. */
export function TourTestPanel({ isParticipant }: { isParticipant: boolean }) {
  const pathname = usePathname();
  return (
    <div className="pb-tour-test">
      {TEST_ROLES.map((t) => (
        <button
          key={t.role}
          type="button"
          className="pb-tour-test-option"
          onClick={() => startTour({ role: t.role, participant: t.role === "participant" || (t.role === "admin" && isParticipant), persist: false, returnTo: pathname })}
        >
          <b>{t.label}</b>
          <small>{t.note}</small>
        </button>
      ))}
    </div>
  );
}
