"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { coordinateParam, parsePathKey, parseSegmentResponse, pathKey, routeSegments, stitchRoute, type LatLng, type RouteSegment, type SegmentGeometry } from "@/lib/route-geometry";

/**
 * Browser-side store of routed legs, shared by every map on the page and kept for the
 * life of the tab. A leg is fetched once from /api/map-route; while it is pending (or
 * when the router has no road for it) the map draws the straight line instead.
 */
const cache = new Map<string, SegmentGeometry>();
const pending = new Set<string>();
const attempts = new Map<string, number>();
const queue: RouteSegment[] = [];
const listeners = new Set<() => void>();
let active = 0;

const MAX_ACTIVE = 4;
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 20_000;

function emit() {
  for (const cb of listeners) cb();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

async function fetchSegment(segment: RouteSegment) {
  const tries = (attempts.get(segment.key) ?? 0) + 1;
  attempts.set(segment.key, tries);
  let geometry: SegmentGeometry = null;
  let transient = false;
  try {
    const res = await fetch(`/api/map-route?from=${coordinateParam(segment.from)}&to=${coordinateParam(segment.to)}`, { credentials: "same-origin", headers: { Accept: "application/json" } });
    if (res.ok) {
      const body: unknown = await res.json();
      geometry = parseSegmentResponse(body);
      // The handler answers 200 with a reason when the router itself was unreachable; worth one more go later.
      transient = geometry === null && typeof body === "object" && body !== null && /^upstream_/.test(String((body as { reason?: unknown }).reason ?? ""));
    } else {
      transient = res.status === 429 || res.status >= 500;
    }
  } catch {
    transient = true;
  }
  pending.delete(segment.key);
  if (transient && tries < MAX_ATTEMPTS) {
    window.setTimeout(() => enqueue([segment]), RETRY_DELAY_MS * tries);
    return;
  }
  cache.set(segment.key, geometry);
  emit();
}

function pump() {
  while (active < MAX_ACTIVE && queue.length > 0) {
    const next = queue.shift()!;
    active += 1;
    void fetchSegment(next).finally(() => {
      active -= 1;
      pump();
    });
  }
}

function enqueue(segments: RouteSegment[]) {
  for (const s of segments) {
    if (cache.has(s.key) || pending.has(s.key)) continue;
    pending.add(s.key);
    queue.push(s);
  }
  pump();
}

/** One character per leg: routed, straight (no road) or still pending. Changes exactly when the line should be redrawn. */
function statusKey(key: string): string {
  return routeSegments(parsePathKey(key))
    .map((s) => (cache.has(s.key) ? (cache.get(s.key) ? "r" : "s") : "?"))
    .join("");
}

export type RoutedPath = {
  /** The line to draw: road geometry where known, straight legs elsewhere. */
  line: LatLng[];
  /** Identifies the drawn geometry; include it in any "did the plot change" key. */
  routeKey: string;
  /** True once every leg has an answer (routed or not). */
  settled: boolean;
};

/**
 * Turns a check-in path (oldest first) into the line to draw along real roads. Legs are
 * requested in the background; the hook re-renders as they arrive.
 */
export function useRoutedPath(path: readonly LatLng[]): RoutedPath {
  const key = pathKey(path);
  const status = useSyncExternalStore(
    subscribe,
    () => statusKey(key),
    () => statusKey(key),
  );

  useEffect(() => {
    enqueue(routeSegments(parsePathKey(key)));
  }, [key]);

  return useMemo(() => {
    const points = parsePathKey(key);
    return { line: stitchRoute(points, (k) => cache.get(k)), routeKey: `${key}#${status}`, settled: !status.includes("?") };
  }, [key, status]);
}
