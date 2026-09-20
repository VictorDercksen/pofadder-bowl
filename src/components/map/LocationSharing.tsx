"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordCheckin, removeCheckins, updateLocationSettings } from "@/lib/actions/checkins";
import { Status } from "@/components/ui/TitleRow";

type Settings = { sharing_enabled: boolean; auto_update: boolean };

const MIN_INTERVAL_MS = 5 * 60_000; // auto check-ins at most every 5 minutes
const WEAK_ACCURACY_M = 250;
/** Last automatic attempt (success or failure), shared across mounts so navigating between screens does not re-poll GPS. */
let lastAutoAttempt = 0;

/**
 * Participant-only location controls. Renders only when the server confirmed the
 * participant role. Requests the browser position after explicit opt-in, on
 * return to the visible app (throttled), and on the manual button.
 */
export function LocationSharing({ initial, checkinIds }: { initial: Settings; checkinIds: string[] }) {
  const router = useRouter();
  const [settings, setSettings] = useState(initial);
  const [note, setNote] = useState<{ text: string; tone: "ok" | "warn" | "error" } | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();
  const inFlight = useRef(false);

  const capture = useCallback(
    (manual: boolean) => {
      if (!settings.sharing_enabled) {
        if (manual) setNote({ text: "Resume sharing before creating a check-in.", tone: "warn" });
        return;
      }
      if (!("geolocation" in navigator)) {
        setNote({ text: "This browser has no geolocation support. Use a phone with GPS.", tone: "error" });
        return;
      }
      if (!navigator.onLine) {
        setNote({ text: "Offline: the check-in cannot reach the league right now. Try again when you have signal.", tone: "warn" });
        return;
      }
      if (inFlight.current) return;
      if (!manual && Date.now() - lastAutoAttempt < MIN_INTERVAL_MS) return;
      if (!manual) lastAutoAttempt = Date.now();
      inFlight.current = true;
      setBusy(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const capturedAt = new Date(pos.timestamp).toISOString();
          const clientId = `${Math.round(pos.timestamp / 1000)}-${pos.coords.latitude.toFixed(5)}-${pos.coords.longitude.toFixed(5)}`;
          const weak = pos.coords.accuracy > WEAK_ACCURACY_M;
          startTransition(async () => {
            try {
              const res = await recordCheckin({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null, capturedAt, clientId });
              if (res.ok && res.duplicate) {
                setNote({ text: res.message ?? "Nothing new recorded.", tone: "warn" });
              } else if (res.ok) {
                const where = res.placeLabel ? `${res.placeLabel} · ` : "";
                setNote({ text: weak ? `${where}Check-in saved with weak accuracy (±${Math.round(pos.coords.accuracy)} m). Step outside for a better fix.` : `${where}Check-in saved (±${Math.round(pos.coords.accuracy)} m). It is on the league map now.`, tone: weak ? "warn" : "ok" });
                router.refresh();
              } else setNote({ text: res.message, tone: "error" });
            } catch {
              // Network dropped mid-request (common on the N7): leave the button usable for a retry.
              setNote({ text: "The check-in did not reach the league. Check your signal and try again.", tone: "error" });
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
          setNote({ text, tone: "error" });
        },
        // A manual press must produce a fresh fix; a cached one repeats the client id and is dropped as a duplicate.
        { enableHighAccuracy: true, timeout: 20_000, maximumAge: manual ? 0 : 60_000 },
      );
    },
    [router, settings.sharing_enabled],
  );

  // Auto-update when the participant returns to the visible app (throttled).
  useEffect(() => {
    if (!settings.sharing_enabled || !settings.auto_update) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") capture(false);
    };
    document.addEventListener("visibilitychange", onVisible);
    const initial = window.setTimeout(() => capture(false), 0);
    return () => {
      window.clearTimeout(initial);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [capture, settings.sharing_enabled, settings.auto_update]);

  function save(next: Settings) {
    setSettings(next);
    startTransition(async () => {
      const res = await updateLocationSettings({ sharingEnabled: next.sharing_enabled, autoUpdate: next.auto_update });
      setNote({ text: res.message ?? "", tone: res.ok ? "ok" : "error" });
      router.refresh();
    });
  }

  function clearHistory() {
    if (checkinIds.length === 0) return;
    startTransition(async () => {
      const res = await removeCheckins({});
      setNote({ text: res.message ?? "", tone: res.ok ? "ok" : "error" });
      router.refresh();
    });
  }

  return (
    <div className="pb-panel">
      <h3>Location controls</h3>
      <label className="pb-check-row">
        <input type="checkbox" checked={settings.sharing_enabled} onChange={(e) => save({ ...settings, sharing_enabled: e.target.checked })} />
        Share my location with league members
      </label>
      <label className="pb-check-row">
        <input type="checkbox" checked={settings.auto_update} disabled={!settings.sharing_enabled} onChange={(e) => save({ ...settings, auto_update: e.target.checked })} />
        Update when I reopen Game Centre
      </label>
      <div className="pb-actions">
        <button className="pb-primary" type="button" onClick={() => capture(true)} disabled={busy || pending || !settings.sharing_enabled}>
          {busy ? "Getting GPS fix…" : "Update location"}
        </button>
        <button className="pb-secondary" type="button" onClick={() => save({ ...settings, sharing_enabled: !settings.sharing_enabled })} disabled={pending}>
          {settings.sharing_enabled ? "Pause sharing" : "Resume sharing"}
        </button>
        <button className="pb-secondary" type="button" onClick={clearHistory} disabled={pending || checkinIds.length === 0}>
          Remove my history ({checkinIds.length})
        </button>
      </div>
      <p className="pb-small" style={{ marginTop: 12 }}>
        Check-ins, not continuous tracking. Nothing is recorded while the browser is closed or the phone is locked. Pausing stops new writes; existing timestamped check-ins stay visible until you remove them. This map is not proof of the 14 km run: upload the watch export in the proof locker.
      </p>
      <Status tone={note?.tone}>{note?.text}</Status>
    </div>
  );
}
