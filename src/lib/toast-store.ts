"use client";

import { useSyncExternalStore } from "react";
import { pushToast, removeToast, toastDuration, type Toast, type ToastTone } from "@/lib/toasts";

/**
 * The alert service. Any client component calls `toast(text, tone)` after an action; the
 * snackbar in the root layout (src/components/ui/Toaster.tsx) shows the stack at the bottom
 * of the screen, dismissible, and each snack clears itself after a short delay.
 *
 * A tiny external store, like the tour store: module-level state read with
 * useSyncExternalStore (empty on the server, no hydration mismatch), so a snack survives
 * router.refresh() and the navigation that often follows a successful action.
 */
const EMPTY: readonly Toast[] = [];
const listeners = new Set<() => void>();
let current: readonly Toast[] = EMPTY;
let nextId = 1;

function set(next: readonly Toast[]) {
  current = next;
  for (const l of listeners) l();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Show a snack. Empty text is ignored so `toast(res.message ?? "")` is safe. */
export function toast(text: string, tone: ToastTone = "ok"): number | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const item: Toast = { id: nextId++, text: trimmed, tone, duration: toastDuration(tone, trimmed) };
  set(pushToast(current, item));
  return item.id;
}

export function dismissToast(id: number) {
  set(removeToast(current, id));
}

export function clearToasts() {
  if (current.length) set(EMPTY);
}

export function getToasts(): readonly Toast[] {
  return current;
}

export function useToasts(): readonly Toast[] {
  return useSyncExternalStore(subscribe, getToasts, () => EMPTY);
}
