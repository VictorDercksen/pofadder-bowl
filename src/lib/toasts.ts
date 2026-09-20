/**
 * Pure rules for the alert snackbar ("toasts"): what a toast is, how long it stays, and how
 * the visible stack changes when one arrives or is dismissed. No React, no window: the
 * client store (src/lib/toast-store.ts) and the tests import this.
 */
export type ToastTone = "ok" | "warn" | "error";

export type Toast = {
  id: number;
  text: string;
  tone: ToastTone;
  /** Milliseconds the snack stays before it dismisses itself. */
  duration: number;
};

/** Most snacks stacked on screen at once; older ones make way. */
export const TOAST_LIMIT = 3;

const BASE_MS: Record<ToastTone, number> = { ok: 4000, warn: 6000, error: 8000 };
const MAX_MS = 12000;
/** Characters a reader gets "for free" before the delay grows. */
const FREE_CHARS = 60;
const MS_PER_EXTRA_CHAR = 35;

/** Short delay by tone, stretched for long copy so it can be read, capped at 12 s. */
export function toastDuration(tone: ToastTone, text: string): number {
  const extra = Math.max(0, text.length - FREE_CHARS) * MS_PER_EXTRA_CHAR;
  return Math.min(MAX_MS, BASE_MS[tone] + extra);
}

/**
 * Append a toast. A snack with the same text and tone already showing is replaced (its timer
 * restarts, nothing doubles up), and the oldest snacks drop off beyond the limit.
 */
export function pushToast(list: readonly Toast[], toast: Toast, limit = TOAST_LIMIT): Toast[] {
  const kept = list.filter((t) => !(t.text === toast.text && t.tone === toast.tone));
  const next = [...kept, toast];
  return next.length > limit ? next.slice(next.length - limit) : next;
}

export function removeToast(list: readonly Toast[], id: number): Toast[] {
  const next = list.filter((t) => t.id !== id);
  return next.length === list.length ? [...list] : next;
}
