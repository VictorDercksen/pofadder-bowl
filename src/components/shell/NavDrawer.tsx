"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { NavNumber, type NavItem } from "@/components/shell/NavLinks";
import { DRAWER_EVENT, readDrawerEvent } from "@/lib/drawer-events";

/**
 * Mobile slide-out navigation (≤ 850 px). Opens from the left, traps focus, closes on
 * backdrop tap, Escape, or navigation. The desktop sidebar stays as is. The first-run tour
 * opens it through the `pb-drawer` window event to spotlight the identity block and the
 * programme; a tour-driven open moves no focus so the tour card keeps the keyboard.
 */
export function NavDrawer({ items, identity, footer }: { items: NavItem[]; identity: ReactNode; footer?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const quietRef = useRef(false);
  const id = useId();

  // Close on navigation.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    if (open) setOpen(false);
  }

  useEffect(() => {
    const onDrawer = (e: Event) => {
      const detail = readDrawerEvent(e);
      if (!detail) return;
      setOpen((prev) => {
        // Only a real change adopts the quiet flag; a redundant close must not mute the next tap on Menu.
        if (prev !== detail.open) quietRef.current = detail.quiet;
        return detail.open;
      });
    };
    window.addEventListener(DRAWER_EVENT, onDrawer);
    return () => window.removeEventListener(DRAWER_EVENT, onDrawer);
  }, []);

  useEffect(() => {
    if (!open) return;
    const opener = openerRef.current;
    const quiet = quietRef.current;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const first = panelRef.current?.querySelector<HTMLElement>("a, button");
    if (!quiet) first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (quietRef.current) return;
      if (e.key === "Escape") setOpen(false);
      if (e.key === "Tab" && panelRef.current) {
        const focusables = Array.from(panelRef.current.querySelectorAll<HTMLElement>("a, button, [tabindex]:not([tabindex='-1'])"));
        if (focusables.length === 0) return;
        const firstEl = focusables[0];
        const lastEl = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
      // A tour-driven drawer never took the focus, so it must not hand it back either.
      if (!quiet && !quietRef.current) opener?.focus();
      quietRef.current = false;
    };
  }, [open]);

  return (
    <>
      <button ref={openerRef} type="button" className="pb-menu-btn" data-tour="menu" aria-expanded={open} aria-controls={id} aria-label="Open navigation" onClick={() => setOpen(true)}>
        <span className="pb-menu-bars" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        Menu
      </button>
      <div className={`pb-drawer-backdrop ${open ? "open" : ""}`} onClick={() => setOpen(false)} aria-hidden="true" />
      <div id={id} ref={panelRef} className={`pb-drawer ${open ? "open" : ""}`} role="dialog" aria-modal="true" aria-label="Navigation" aria-hidden={!open}>
        <div className="pb-drawer-head">
          {identity}
          <button type="button" className="pb-drawer-close" aria-label="Close navigation" onClick={() => setOpen(false)}>
            ✕
          </button>
        </div>
        <nav className="pb-drawer-nav" aria-label="Game Centre screens" data-tour="drawer-nav">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link key={item.href} href={item.href} className="pb-drawer-link" aria-current={active ? "page" : undefined} onClick={() => setOpen(false)}>
                <NavNumber n={item.n} className="pb-drawer-num" />
                {item.label}
                <span className="pb-drawer-chevron" aria-hidden="true">›</span>
              </Link>
            );
          })}
        </nav>
        <div className="pb-drawer-foot">{footer}</div>
      </div>
    </>
  );
}
