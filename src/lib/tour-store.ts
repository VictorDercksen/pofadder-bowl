"use client";

import { useSyncExternalStore } from "react";
import type { Role } from "@/lib/roles";

/**
 * The running tour, shared between the overlay in the league layout and the buttons that
 * start it (League access, the admin test panel). A tiny external store so the overlay can
 * read it with useSyncExternalStore (null on the server, no hydration mismatch), mirrored
 * to sessionStorage so a reload mid-tour resumes at the same step.
 */
export type TourRun = {
  role: Role;
  participant: boolean;
  step: number;
  /** Record completion on the profile when the tour ends (first run only). */
  persist: boolean;
  /** Where to go when the tour finishes. */
  returnTo: string;
};

const RUN_KEY = "pb-tour";
const SEEN_KEY = "pb-tour-seen";
const listeners = new Set<() => void>();
let current: TourRun | null = null;
let loaded = false;

function load() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = window.sessionStorage.getItem(RUN_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<TourRun>;
      if (typeof parsed.role === "string" && typeof parsed.step === "number") {
        current = { role: parsed.role, participant: Boolean(parsed.participant), step: parsed.step, persist: Boolean(parsed.persist), returnTo: typeof parsed.returnTo === "string" ? parsed.returnTo : "/game-centre" };
      }
    }
  } catch {
    current = null;
  }
}

function set(next: TourRun | null) {
  current = next;
  try {
    if (next) window.sessionStorage.setItem(RUN_KEY, JSON.stringify(next));
    else window.sessionStorage.removeItem(RUN_KEY);
  } catch {
    // Private mode or blocked storage: the tour still runs in memory.
  }
  for (const l of listeners) l();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function getTourRun(): TourRun | null {
  load();
  return current;
}

export function startTour(run: Omit<TourRun, "step">) {
  set({ ...run, step: 0 });
}

export function goToStep(step: number) {
  if (current) set({ ...current, step: Math.max(0, step) });
}

export function endTour() {
  set(null);
}

/** Once the first run ends, do not auto-start again in this browser session even if the profile flag lags. */
export function markSeen() {
  try {
    window.sessionStorage.setItem(SEEN_KEY, "1");
  } catch {
    // ignore
  }
}

export function wasSeen(): boolean {
  try {
    return window.sessionStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function useTourRun(): TourRun | null {
  return useSyncExternalStore(subscribe, getTourRun, () => null);
}
