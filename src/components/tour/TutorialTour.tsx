"use client";

import { useEffect, useId, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Football } from "@/components/ui/Football";
import { completeTutorial } from "@/lib/actions/tutorial";
import { setDrawerOpen } from "@/lib/drawer-events";
import type { Role } from "@/lib/roles";
import { placeCard, scrollOffset, TOUR_VERSION, tourStepsFor, type Rect } from "@/lib/tour";
import { endTour, getTourRun, goToStep, markSeen, startTour, useTourRun, wasSeen, type TourRun } from "@/lib/tour-store";

const CARD_WIDTH = 360;
/** Fallback until the card has been measured. */
const CARD_HEIGHT = 250;
const SPOT_PAD = 8;
const FIND_TRIES = 40;
const FIND_EVERY_MS = 150;
/** Keep re-measuring this long after the target is found: the drawer slides in over 220 ms and streamed content shifts the page. */
const SETTLE_MS = 700;
/** How long a screen may take to open before the card admits it is stuck. */
const STUCK_AFTER_MS = 6000;
/** Navigations attempted per step before giving up (a screen that redirects would otherwise loop). */
const MAX_PUSHES = 2;

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
  return { top: Math.round(r.top), left: Math.round(r.left), width: Math.round(r.width), height: Math.round(r.height) };
}

function sameRect(a: Rect | null, b: Rect | null): boolean {
  if (!a || !b) return a === b;
  return a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height;
}

/** Height of the sticky header, which hides anything scrolled underneath it. */
function headerHeight(): number {
  const top = document.querySelector<HTMLElement>(".pb-top");
  return top ? Math.max(0, top.getBoundingClientRect().bottom) : 0;
}

/**
 * Scroll so the target sits in the free zone (under the header, above a phone's bottom
 * sheet). Targets inside a scrolling container (the drawer's programme list) are first
 * brought into that container's view; targets inside a fixed panel (the drawer) never
 * move the window, which is locked behind the drawer anyway.
 */
function bringIntoView(el: HTMLElement, cardHeight: number) {
  let fixed = false;
  let scroller: HTMLElement | null = null;
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const cs = window.getComputedStyle(p);
    if (cs.position === "fixed") fixed = true;
    if (!scroller && /(auto|scroll)/.test(cs.overflowY) && p.scrollHeight > p.clientHeight) scroller = p;
  }
  if (scroller) el.scrollIntoView({ block: "nearest", inline: "nearest" });
  if (fixed) return;
  const delta = scrollOffset(toRect(el), { height: cardHeight }, { width: window.innerWidth, height: window.innerHeight }, headerHeight());
  if (Math.abs(delta) > 1) window.scrollBy(0, delta);
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
  // The rendered card height, so placement never lands the card on the target it describes.
  const [cardHeight, setCardHeight] = useState(CARD_HEIGHT);
  // Step whose screen did not open in time (a redirect, or a screen this account cannot see).
  const [stuckFor, setStuckFor] = useState<string | null>(null);
  const rect = anchor.id === step.id ? anchor.rect : null;
  const stuck = !onPage && stuckFor === step.id;

  // Navigate to the step's screen, again if the browser's Back button took the tour elsewhere,
  // but only a couple of times per step so a screen that redirects away does not loop.
  const pushes = useRef<{ id: string; count: number }>({ id: "", count: 0 });
  useEffect(() => {
    if (!step.href || pathname === step.href) return;
    if (pushes.current.id !== step.id) pushes.current = { id: step.id, count: 0 };
    if (pushes.current.count >= MAX_PUSHES) return;
    pushes.current.count += 1;
    router.push(step.href);
  }, [step.href, step.id, pathname, router]);

  // Admit it when the screen does not open, so the member can carry on with Next.
  useEffect(() => {
    if (onPage) return;
    const id = step.id;
    const timer = window.setTimeout(() => setStuckFor(id), STUCK_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [step.id, onPage]);

  // Steps that talk about the Menu open the phone drawer so its identity block and programme
  // can be spotlighted; every other step closes it again. On a desktop the Menu button is
  // hidden and the same things sit in the header and sidebar, so the drawer stays shut.
  useEffect(() => {
    if (!onPage) return;
    const phone = findTarget(["menu"]) !== null;
    setDrawerOpen(Boolean(step.menu) && phone);
  }, [step, onPage]);
  useEffect(() => () => setDrawerOpen(false), []);

  // Track the card's real height (the copy length varies per step and per viewport width).
  useEffect(() => {
    const card = cardRef.current;
    if (!card || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setCardHeight(Math.round(card.getBoundingClientRect().height) || CARD_HEIGHT));
    ro.observe(card);
    return () => ro.disconnect();
  }, []);

  // Find and measure the target, retrying while the screen streams in. Keep measuring for a
  // settle window after it is found (drawer slide, images, streamed panels), then follow
  // scroll, resize, layout changes and DOM replacement so the ring never drifts off the target.
  useEffect(() => {
    let cancelled = false;
    let tries = 0;
    let el: HTMLElement | null = null;
    let timer = 0;
    let raf = 0;
    let lastRect: Rect | null = null;
    let lastViewport = { width: -1, height: -1 };
    let bodyObserver: ResizeObserver | null = null;
    let domObserver: MutationObserver | null = null;

    const measure = () => {
      if (cancelled) return;
      // A refresh can replace the node under the ring: find it again rather than measure a detached element.
      if (el && !el.isConnected) el = findTarget(step.targets);
      const next = el ? toRect(el) : null;
      const vp = { width: window.innerWidth, height: window.innerHeight };
      if (sameRect(lastRect, next) && vp.width === lastViewport.width && vp.height === lastViewport.height) return;
      lastRect = next;
      lastViewport = vp;
      setViewport(vp);
      setAnchor({ id: step.id, rect: next });
    };
    const scheduleMeasure = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        measure();
      });
    };
    const settle = (until: number) => {
      const loop = () => {
        if (cancelled) return;
        measure();
        if (performance.now() < until) raf = window.requestAnimationFrame(loop);
        else raf = 0;
      };
      window.cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(loop);
    };
    const follow = () => {
      window.addEventListener("resize", scheduleMeasure);
      window.addEventListener("scroll", scheduleMeasure, true);
      window.visualViewport?.addEventListener("resize", scheduleMeasure);
      window.visualViewport?.addEventListener("scroll", scheduleMeasure);
      if (typeof ResizeObserver !== "undefined") {
        bodyObserver = new ResizeObserver(scheduleMeasure);
        bodyObserver.observe(document.body);
        if (el) bodyObserver.observe(el);
      }
      if (typeof MutationObserver !== "undefined") {
        domObserver = new MutationObserver((records) => {
          // The overlay repositions itself on every measure; only changes to the page count.
          if (records.some((r) => !(r.target as Element).closest?.(".pb-tour"))) scheduleMeasure();
        });
        domObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style"] });
      }
    };
    const tick = () => {
      if (cancelled || !onPage) return;
      if (step.targets.length === 0) {
        measure();
        follow();
        return;
      }
      el = findTarget(step.targets);
      if (el) {
        bringIntoView(el, cardRef.current?.getBoundingClientRect().height ?? CARD_HEIGHT);
        measure();
        follow();
        settle(performance.now() + SETTLE_MS);
      } else if (++tries < FIND_TRIES) {
        timer = window.setTimeout(tick, FIND_EVERY_MS);
      } else {
        measure();
        follow();
      }
    };
    timer = window.setTimeout(tick, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", scheduleMeasure);
      window.removeEventListener("scroll", scheduleMeasure, true);
      window.visualViewport?.removeEventListener("resize", scheduleMeasure);
      window.visualViewport?.removeEventListener("scroll", scheduleMeasure);
      bodyObserver?.disconnect();
      domObserver?.disconnect();
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
  const place = placeCard(rect, { width: cardWidth, height: cardHeight }, viewport);
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
            {stuck ? "This screen did not open for your account. Next carries on with the tour." : <><Football size={18} /> Opening the screen…</>}
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
