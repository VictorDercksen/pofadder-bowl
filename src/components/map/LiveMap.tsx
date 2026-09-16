"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { MapPin } from "./CheckinMap";

function icon(kind: MapPin["kind"]) {
  const colour = kind === "current" ? "#cc542b" : kind === "history" ? "#183b2f" : "#687366";
  const size = kind === "current" ? 18 : 12;
  return L.divIcon({
    className: "",
    html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:50%;background:${colour};border:3px solid #fffcf5;box-shadow:0 0 0 1px ${colour}${kind === "current" ? ",0 0 0 9px #d8643624" : ""}"></span>`,
    iconSize: [size + 6, size + 6],
    iconAnchor: [(size + 6) / 2, (size + 6) / 2],
  });
}

export function LiveMap({ pins, focus, tileUrl, attribution, fallbackCenter }: { pins: MapPin[]; focus?: { latitude: number; longitude: number }; tileUrl: string; attribution: string; fallbackCenter: [number, number] }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = L.map(ref.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false });
    L.tileLayer(tileUrl, { attribution, maxZoom: 19 }).addTo(map);
    map.setView(fallbackCenter, 7);
    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, [tileUrl, attribution, fallbackCenter]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    for (const pin of pins) {
      L.marker([pin.latitude, pin.longitude], { icon: icon(pin.kind), title: pin.label, keyboard: true }).bindPopup(pin.label).addTo(layer);
    }
    if (focus) map.setView([focus.latitude, focus.longitude], 13, { animate: false });
    else if (pins.length > 1) map.fitBounds(L.latLngBounds(pins.map((p) => [p.latitude, p.longitude] as [number, number])), { padding: [24, 24] });
    else if (pins.length === 1) map.setView([pins[0].latitude, pins[0].longitude], 12, { animate: false });
  }, [pins, focus]);

  return <div className="pb-live-map" ref={ref} role="region" aria-label="Check-in map" />;
}
