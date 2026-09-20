"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { MapPin } from "./CheckinMap";
import { useRoutedPath } from "./useRoutedPath";
import { kitFor, teamLogoSrc } from "@/lib/nfl";
import { memberInitials } from "@/lib/member-locations";

const ROUTE_COLOUR = "#cc542b";

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

/** A league member's pin: kit-coloured badge with the team logo (or initials), faded when stale. */
function memberIcon(pin: MapPin) {
  const kit = kitFor(pin.team);
  const face = pin.team ? `<img src="${teamLogoSrc(pin.team)}" alt="" width="22" height="22" loading="lazy" />` : `<b>${escapeHtml(memberInitials(pin.name ?? ""))}</b>`;
  return L.divIcon({
    className: "",
    html: `<span class="pb-member-pin${pin.stale ? " stale" : ""}" style="--kit:${kit.body};--kit-accent:${kit.accent}"><span class="pb-member-pin-head">${face}</span><span class="pb-member-pin-tail"></span></span>`,
    iconSize: [36, 44],
    iconAnchor: [18, 42],
    popupAnchor: [0, -38],
  });
}

function icon(pin: MapPin) {
  if (pin.kind === "member") return memberIcon(pin);
  const kind = pin.kind;
  const colour = kind === "current" ? ROUTE_COLOUR : kind === "history" ? "#183b2f" : "#687366";
  const size = kind === "current" ? 18 : 12;
  return L.divIcon({
    className: "",
    html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:50%;background:${colour};border:3px solid #fffcf5;box-shadow:0 0 0 1px ${colour}${kind === "current" ? ",0 0 0 9px #d8643624" : ""}"></span>`,
    iconSize: [size + 6, size + 6],
    iconAnchor: [(size + 6) / 2, (size + 6) / 2],
  });
}

/**
 * Leaflet map: one marker per pin plus a line through the check-in path (oldest to
 * newest) that follows real roads (useRoutedPath; a leg stays straight until its road
 * geometry arrives or when the router has none). The viewport is fitted when the
 * plotted set changes and once more when its road geometry settles, not on every
 * refresh, so a member who has zoomed in is not yanked back by the 45 s poll. Member pins
 * are drawn but never fitted: they move often and may sit anywhere in the country, and the
 * route is what the map is for.
 */
export function LiveMap({
  pins,
  path = [],
  focus,
  tileUrl,
  attribution,
  fallbackLatitude,
  fallbackLongitude,
}: {
  pins: MapPin[];
  /** Check-in coordinates, oldest first. Drawn as the route travelled. */
  path?: [number, number][];
  focus?: { latitude: number; longitude: number };
  tileUrl: string;
  attribution: string;
  fallbackLatitude: number;
  fallbackLongitude: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const fittedKey = useRef<string | null>(null);
  const renderedKey = useRef<string | null>(null);
  const route = useRoutedPath(path);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = L.map(ref.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false });
    L.tileLayer(tileUrl, { attribution, maxZoom: 19 }).addTo(map);
    map.setView([fallbackLatitude, fallbackLongitude], 7);
    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);
    fittedKey.current = null;
    renderedKey.current = null;
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, [tileUrl, attribution, fallbackLatitude, fallbackLongitude]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    // Server refreshes hand over fresh arrays every time; only redraw when what they describe changed.
    // Member pins are left out of the fit key on purpose (see above).
    const routePins = pins.filter((p) => p.kind !== "member");
    const key = [...path.map((p) => p.join(",")), ...routePins.map((p) => `${p.id}:${p.latitude},${p.longitude}`), focus ? `${focus.latitude},${focus.longitude}` : ""].join("|");
    const renderKey = `${key}#${route.routeKey}#${pins.map((p) => `${p.id}:${p.latitude},${p.longitude}:${p.kind}:${p.label}:${p.team ?? ""}:${p.stale ? 1 : 0}`).join("|")}`;
    if (renderedKey.current !== renderKey) {
      renderedKey.current = renderKey;
      layer.clearLayers();
      if (route.line.length > 1) {
        // Soft casing under the route so it stays readable over roads, then the route itself.
        L.polyline(route.line, { color: "#fffcf5", weight: 7, opacity: 0.9, lineJoin: "round", lineCap: "round", interactive: false }).addTo(layer);
        L.polyline(route.line, { color: ROUTE_COLOUR, weight: 3.5, opacity: 0.95, lineJoin: "round", lineCap: "round", interactive: false }).addTo(layer);
      }
      for (const pin of pins) {
        L.marker([pin.latitude, pin.longitude], { icon: icon(pin), title: pin.label, keyboard: true, zIndexOffset: pin.kind === "current" ? 1000 : pin.kind === "member" ? 500 : 0 }).bindPopup(pin.label).addTo(layer);
      }
    }

    // Fit once per plotted set, and once more when its road geometry has settled (a road
    // route can bulge well outside the box around the check-ins themselves).
    const fitKey = `${key}#${route.settled ? "routed" : "straight"}`;
    if (fittedKey.current === fitKey) return;
    fittedKey.current = fitKey;
    const checkinPoints: [number, number][] = [...(route.settled && route.line.length > 1 ? route.line : path), ...routePins.filter((p) => p.kind !== "place").map((p) => [p.latitude, p.longitude] as [number, number])];
    if (checkinPoints.length > 1) map.fitBounds(L.latLngBounds(checkinPoints), { padding: [28, 28], maxZoom: 14, animate: false });
    else if (focus) map.setView([focus.latitude, focus.longitude], 13, { animate: false });
    // No route yet: frame everything that is there (venues and any member pins) once, at mount.
    else if (pins.length > 1) map.fitBounds(L.latLngBounds(pins.map((p) => [p.latitude, p.longitude] as [number, number])), { padding: [24, 24], maxZoom: 12, animate: false });
    else if (pins.length === 1) map.setView([pins[0].latitude, pins[0].longitude], 12, { animate: false });
  }, [pins, path, focus, route]);

  return <div className="pb-live-map" ref={ref} role="region" aria-label="Check-in map" />;
}
