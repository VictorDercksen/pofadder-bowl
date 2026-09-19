"use client";

import { useEffect, useId, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Football } from "@/components/ui/Football";
import { completeTutorial } from "@/lib/actions/tutorial";
import type { Role } from "@/lib/roles";
import { placeCard, TOUR_VERSION, tourStepsFor, type Rect } from "@/lib/tour";
import { endTour, getTourRun, goToStep, markSeen, startTour, useTourRun, wasSeen, type TourRun } from "@/lib/tour-store";

const CARD_WIDTH = 360;
const CARD_HEIGHT = 250;
const SPOT_PAD = 8;
const FIND_TRIES = 40;
const FIND_EVERY_MS = 150;

/**
 * The guided tour. Mounted once in the league layout, so it survives the navigations it
 * triggers between screens. Auto-starts on a member's first sign-in (profile flag null),
 * and can be started by the replay button or the admin test panel through the tour store.
 */
export function TutorialTour({ role, isParticipant, autoStart, home }: { role: Role; isParticipant: boolean; autoStart: boolean; home: string }) {
  const run = useTourRun();

  useEffect(() => {
    if (autoStart && !wasSeen() && !getTourRun()) startTour({ role, participant: isParticipant, persist: true, returnTo: home });
  }, [autoStart, role, isParticipant, home]);

  return run ? <TourOverlay run={run} /> : null;
}

function isVisible(el: HTMLElement): boolean {
  if (el.getClientRects().length === 0) return false;
  const style = window.getComputedStyle(el);
  return style.visibility !== "hidden" && style.display !== "none";
}

function findTarget(targets: string[]): HTMLElement | null {
  for (const name of targets) {
    for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)) if (isVisible(el)) return el;
  }
  return null;
}

function toRect(el: HTMLElement): Rect {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function TourOverlay({ run }: { run: TourRun }) {
  const pathname = usePathname();
  const router = useRouter();
  const titleId = useId();
  const cardRef = useRef<HTMLDivElement>(null);
  const steps = tourStepsFor(run.role, run.participant);
  const index = Math.min(run.step, steps.length - 1);
  const step = steps[index];
  const onPage = !step.href || pathname === step.href;
  const last = index === steps.length - 1;

  // Spotlight geometry for the current step (null while the target is not on screen yet).
  const [anchor, setAnchor] = useState<{ id: string; rect: Rect | null }>({ id: "", rect: null });
  // Client-only component (the store is null on the server), so the window is available at first render.
  const [viewport, setViewport] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));
  const rect = anchor.id === step.id ? anchor.rect : null;

  // Navigate to the step's screen once per step; the page itself may redirect if the role cannot open it.
  const pushedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!step.href || pathname === step.href || pushedFor.current === step.id) return;
    pushedFor.current = step.id;
    router.push(step.href);
  }, [step.href, step.id, pathname, router]);

  // Find and measure the target, retrying while the screen streams in; follow scroll and resize.
  useEffect(() => {
    let cancelled = false;
    let tries = 0;
    let el: HTMLElement | null = null;
    let timer = 0;
    const measure = () => {
      if (cancelled) return;
      setViewport({ width: window.innerWidth, height: window.innerHeight });
      setAnchor({ id: step.id, rect: el ? toRect(el) : null });
    };
    const tick = () => {
      if (cancelled) return;
      if (!onPage) return;
      if (step.targets.length === 0) {
        measure();
        return;
      }
      el = findTarget(step.targets);
      if (el) {
        // Bring the target into view only when it is not already, without jolting the page for tall elements.
        const r = el.getBoundingClientRect();
        if (r.top < 0 || r.bottom > window.innerHeight) el.scrollIntoView({ block: r.height > window.innerHeight * 0.8 ? "start" : "center", inline: "nearest" });
        measure();
        timer = window.setTimeout(measure, 300);
      } else if (++tries < FIND_TRIES) {
        timer = window.setTimeout(tick, FIND_EVERY_MS);
      } else {
        measure();
      }
    };
    timer = window.setTimeout(tick, 0);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [step, onPage]);

  // Keyboard: focus the card on each step; arrows move, Escape skips.
  useEffect(() => {
    cardRef.current?.focus({ preventScroll: true });
  }, [step.id]);

  const finish = () => {
    const { persist, returnTo } = run;
    markSeen();
    endTour();
    if (persist) void completeTutorial({ version: TOUR_VERSION });
    router.push(returnTo);
  };
  const next = () => (last ? finish() : goToStep(index + 1));
  const back = () => goToStep(index - 1);
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") finish();
    else if (e.key === "ArrowRight" || e.key === "Enter") {
      if ((e.target as HTMLElement).tagName !== "BUTTON" || e.key === "ArrowRight") next();
    } else if (e.key === "ArrowLeft" && index > 0) back();
    else if (e.key === "Tab" && cardRef.current) {
      // Keep focus inside the card while the rest of the screen sits behind the overlay.
      const focusables = Array.from(cardRef.current.querySelectorAll<HTMLElement>("button"));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const lastEl = focusables[focusables.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === cardRef.current)) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  const cardWidth = Math.min(CARD_WIDTH, viewport.width - 32);
  const place = placeCard(rect, { width: cardWidth, height: CARD_HEIGHT }, viewport);
  const progress = Math.round(((index + 1) / steps.length) * 100);

  return (
    <div className="pb-tour" onKeyDown={onKey}>
      <div className="pb-tour-blocker" aria-hidden="true" />
      {rect ? <div className="pb-tour-spot" aria-hidden="true" style={{ top: rect.top - SPOT_PAD, left: rect.left - SPOT_PAD, width: rect.width + SPOT_PAD * 2, height: rect.height + SPOT_PAD * 2 }} /> : <div className="pb-tour-dim" aria-hidden="true" />}
      <div
        ref={cardRef}
        className={`pb-tour-card ${place.placement}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={{ top: place.top, bottom: place.bottom, left: place.left, width: cardWidth }}
      >
        <div className="pb-tour-progress" aria-hidden="true">
          <i style={{ width: `${progress}%` }} />
        </div>
        <div className="pb-tour-head">
          <span className="pb-kicker">{step.kicker}</span>
          <span className="pb-tour-count">
            {index + 1} / {steps.length}
          </span>
        </div>
        <h3 id={titleId}>{step.title}</h3>
        <p>{step.body}</p>
        {!onPage ? (
          <p className="pb-tour-loading" role="status">
            <Football size={18} /> Opening the screen…
          </p>
        ) : null}
        <div className="pb-tour-actions">
          <button type="button" className="pb-text-action" onClick={finish}>
            {last ? "Close" : "Skip the tour"}
          </button>
          <span className="pb-tour-nav">
            {index > 0 ? (
              <button type="button" className="pb-secondary" onClick={back}>
                Back
              </button>
            ) : null}
            <button type="button" className="pb-primary orange" onClick={next}>
              {last ? "Finish" : index === 0 ? "Take the tour" : "Next"}
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
