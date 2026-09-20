"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clearMemberLocation, shareMemberLocation } from "@/lib/actions/checkins";
import { toast } from "@/lib/toast-store";

const WEAK_ACCURACY_M = 250;

/**
 * League member location controls: one pin, placed or moved on demand ("where everyone
 * is"). Pressing Share is the consent; nothing is recorded in the background and there is
 * no history. Labels for the current pin arrive pre-formatted from the server so the
 * client never formats a date (Node and Chromium disagree on en-GB punctuation).
 */
export function MemberLocationShare({ own }: { own: { place: string; captured: string; age: string } | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();
  const inFlight = useRef(false);

  function share() {
    if (!("geolocation" in navigator)) {
      toast("This browser has no geolocation support. Use a phone with GPS.", "error");
      return;
    }
    if (!navigator.onLine) {
      toast("Offline: your pin cannot reach the league right now. Try again when you have signal.", "warn");
      return;
    }
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const weak = pos.coords.accuracy > WEAK_ACCURACY_M;
        startTransition(async () => {
          try {
            const res = await shareMemberLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null, capturedAt: new Date(pos.timestamp).toISOString() });
            if (res.ok) {
              const where = res.placeLabel ? `${res.placeLabel} · ` : "";
              toast(weak ? `${where}Pin placed with weak accuracy (±${Math.round(pos.coords.accuracy)} m).` : `${where}Your pin is on the league map.`, weak ? "warn" : "ok");
              router.refresh();
            } else toast(res.message, "error");
          } catch {
            toast("Your pin did not reach the league. Check your signal and try again.", "error");
          } finally {
            inFlight.current = false;
            setBusy(false);
          }
        });
      },
      (err) => {
        inFlight.current = false;
        setBusy(false);
        const text =
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied. Allow location for this site in your browser settings, then try again."
            : err.code === err.POSITION_UNAVAILABLE
              ? "GPS position unavailable. Move somewhere with a clearer sky or signal."
              : "Timed out waiting for a GPS fix. Try again.";
        toast(text, "error");
      },
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 },
    );
  }

  function clear() {
    startTransition(async () => {
      const res = await clearMemberLocation();
      toast(res.message ?? "", res.ok ? "ok" : "error");
      router.refresh();
    });
  }

  return (
    <div className="pb-panel" data-tour="member-location">
      <h3>Your pin</h3>
      <p className="pb-small" style={{ marginTop: 6 }}>{own ? `On the map at ${own.place} · shared ${own.captured} SAST (${own.age}).` : "Not on the map. Share once and the league sees a team-badge pin where you are."}</p>
      <div className="pb-actions">
        <button className="pb-primary" type="button" onClick={share} disabled={busy || pending}>
          {busy ? "Getting GPS fix…" : own ? "Update my pin" : "Share my location"}
        </button>
        <button className="pb-secondary" type="button" onClick={clear} disabled={pending || !own}>
          Remove my pin
        </button>
      </div>
      <p className="pb-small" style={{ marginTop: 12 }}>One pin, moved only when you press the button. No tracking, no history, no feed post. Remove it whenever you like.</p>
    </div>
  );
}
