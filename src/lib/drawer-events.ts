/**
 * Window event that lets the first-run tour open and close the mobile navigation drawer.
 * The drawer (src/components/shell/NavDrawer.tsx) keeps its own open state; this is the
 * one way in for code that lives outside it. Pure: safe to import from tests and both sides.
 */
export const DRAWER_EVENT = "pb-drawer";

export type DrawerEventDetail = {
  open: boolean;
  /** True when the tour drives the drawer: no focus moves, so the tour card keeps the keyboard. */
  quiet: boolean;
};

export function setDrawerOpen(open: boolean, quiet = true) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<DrawerEventDetail>(DRAWER_EVENT, { detail: { open, quiet } }));
}

export function readDrawerEvent(e: Event): DrawerEventDetail | null {
  const detail = (e as CustomEvent<Partial<DrawerEventDetail>>).detail;
  if (!detail || typeof detail.open !== "boolean") return null;
  return { open: detail.open, quiet: Boolean(detail.quiet) };
}
