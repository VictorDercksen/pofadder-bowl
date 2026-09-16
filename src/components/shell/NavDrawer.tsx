"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/components/shell/NavLinks";

/**
 * Mobile slide-out navigation (≤ 850 px). Opens from the left, traps focus, closes on
 * backdrop tap, Escape, or navigation. The desktop sidebar stays as is.
 */
export function NavDrawer({ items, identity, footer }: { items: NavItem[]; identity: ReactNode; footer?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const id = useId();

  // Close on navigation.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    if (open) setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const opener = openerRef.current;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const first = panelRef.current?.querySelector<HTMLElement>("a, button");
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
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
      opener?.focus();
    };
  }, [open]);

  return (
    <>
      <button ref={openerRef} type="button" className="pb-menu-btn" aria-expanded={open} aria-controls={id} aria-label="Open navigation" onClick={() => setOpen(true)}>
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
        <nav className="pb-drawer-nav" aria-label="Game Centre screens">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link key={item.href} href={item.href} className="pb-drawer-link" aria-current={active ? "page" : undefined} onClick={() => setOpen(false)}>
                <span className="pb-drawer-num">{item.n}</span>
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
