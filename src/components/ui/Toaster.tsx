"use client";

import { useCallback, useEffect, useRef } from "react";
import { dismissToast, useToasts } from "@/lib/toast-store";
import type { Toast } from "@/lib/toasts";

/**
 * The snackbar stack at the bottom of the screen. Mounted once in the root layout; it renders
 * nothing visible until a component calls `toast()` (src/lib/toast-store.ts). Each snack has a
 * dismiss button and clears itself after its delay; the timer pauses while the pointer or
 * keyboard focus is on it so it cannot vanish mid-read.
 */
export function Toaster() {
  const toasts = useToasts();
  return (
    <div className="pb-toast-stack" role="status" aria-live="polite" aria-relevant="additions">
      {toasts.map((t) => (
        <ToastSnack key={t.id} toast={t} />
      ))}
    </div>
  );
}

const MIN_RESUME_MS = 1000;

function ToastSnack({ toast }: { toast: Toast }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remaining = useRef(toast.duration);
  const startedAt = useRef(0);
  const id = toast.id;

  const pause = useCallback(() => {
    if (timer.current === null) return;
    clearTimeout(timer.current);
    timer.current = null;
    remaining.current = Math.max(MIN_RESUME_MS, remaining.current - (Date.now() - startedAt.current));
  }, []);

  const resume = useCallback(() => {
    if (timer.current !== null) return;
    startedAt.current = Date.now();
    timer.current = setTimeout(() => dismissToast(id), remaining.current);
  }, [id]);

  useEffect(() => {
    resume();
    return pause;
  }, [pause, resume]);

  return (
    <div
      className={`pb-toast ${toast.tone}`}
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocus={pause}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) resume();
      }}
    >
      <span className="pb-toast-text">{toast.text}</span>
      <button type="button" className="pb-toast-close" onClick={() => dismissToast(id)} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}
