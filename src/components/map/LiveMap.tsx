"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { MapPin } from "./CheckinMap";

const ROUTE_COLOUR = "#cc542b";

function icon(kind: MapPin["kind"]) {
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
 * newest). The viewport is fitted when the plotted set changes, not on every refresh,
 * so a member who has zoomed in is not yanked back by the 45 s poll.
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

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = L.map(ref.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false });
    L.tileLayer(tileUrl, { attribution, maxZoom: 19 }).addTo(map);
    map.setView([fallbackLatitude, fallbackLongitude], 7);
    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);
    fittedKey.current = null;
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
    layer.clearLayers();

    if (path.length > 1) {
      // Soft casing under the route so it stays readable over roads, then the route itself.
      L.polyline(path, { color: "#fffcf5", weight: 7, opacity: 0.9, lineJoin: "round", lineCap: "round", interactive: false }).addTo(layer);
      L.polyline(path, { color: ROUTE_COLOUR, weight: 3.5, opacity: 0.95, lineJoin: "round", lineCap: "round", interactive: false }).addTo(layer);
    }
    for (const pin of pins) {
      L.marker([pin.latitude, pin.longitude], { icon: icon(pin.kind), title: pin.label, keyboard: true, zIndexOffset: pin.kind === "current" ? 1000 : 0 }).bindPopup(pin.label).addTo(layer);
    }

    const key = [...path.map((p) => p.join(",")), ...pins.map((p) => p.id), focus ? `${focus.latitude},${focus.longitude}` : ""].join("|");
    if (fittedKey.current === key) return;
    fittedKey.current = key;
    const checkinPoints: [number, number][] = [...path, ...pins.filter((p) => p.kind !== "place").map((p) => [p.latitude, p.longitude] as [number, number])];
    if (checkinPoints.length > 1) map.fitBounds(L.latLngBounds(checkinPoints), { padding: [28, 28], maxZoom: 14, animate: false });
    else if (focus) map.setView([focus.latitude, focus.longitude], 13, { animate: false });
    else if (pins.length > 1) map.fitBounds(L.latLngBounds(pins.map((p) => [p.latitude, p.longitude] as [number, number])), { padding: [24, 24], animate: false });
    else if (pins.length === 1) map.setView([pins[0].latitude, pins[0].longitude], 12, { animate: false });
  }, [pins, path, focus]);

  return <div className="pb-live-map" ref={ref} role="region" aria-label="Check-in map" />;
}
