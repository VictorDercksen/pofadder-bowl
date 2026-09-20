"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const TRACK_COLOUR = "#183b2f";
const START_COLOUR = "#183b2f";
const FINISH_COLOUR = "#cc542b";

function dot(colour: string, size: number) {
  return L.divIcon({
    className: "",
    html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:50%;background:${colour};border:3px solid #fffcf5;box-shadow:0 0 0 1px ${colour}"></span>`,
    iconSize: [size + 6, size + 6],
    iconAnchor: [(size + 6) / 2, (size + 6) / 2],
  });
}

/**
 * Leaflet map of one recorded track (a watch export): the line as recorded, a start and a
 * finish marker, fitted to the track once per line. Nothing is routed or snapped; the map
 * shows exactly what the file holds.
 */
export function TrackMap({ line, tileUrl, attribution, startLabel = "Start", finishLabel = "Finish" }: { line: [number, number][]; tileUrl: string; attribution: string; startLabel?: string; finishLabel?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const drawnKey = useRef<string | null>(null);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = L.map(ref.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false });
    L.tileLayer(tileUrl, { attribution, maxZoom: 19 }).addTo(map);
    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);
    drawnKey.current = null;
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, [tileUrl, attribution]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer || line.length === 0) return;
    const key = `${line.length}:${line[0].join(",")}:${line[line.length - 1].join(",")}:${startLabel}:${finishLabel}`;
    if (drawnKey.current === key) return;
    drawnKey.current = key;
    layer.clearLayers();
    if (line.length > 1) {
      L.polyline(line, { color: "#fffcf5", weight: 8, opacity: 0.9, lineJoin: "round", lineCap: "round", interactive: false }).addTo(layer);
      L.polyline(line, { color: TRACK_COLOUR, weight: 4, opacity: 0.95, lineJoin: "round", lineCap: "round", interactive: false }).addTo(layer);
    }
    L.marker(line[0], { icon: dot(START_COLOUR, 12), title: startLabel, keyboard: true }).bindPopup(startLabel).addTo(layer);
    if (line.length > 1) L.marker(line[line.length - 1], { icon: dot(FINISH_COLOUR, 16), title: finishLabel, keyboard: true, zIndexOffset: 1000 }).bindPopup(finishLabel).addTo(layer);
    if (line.length > 1) map.fitBounds(L.latLngBounds(line), { padding: [24, 24], maxZoom: 16, animate: false });
    else map.setView(line[0], 14, { animate: false });
  }, [line, startLabel, finishLabel]);

  return <div className="pb-live-map pb-track-map" ref={ref} role="region" aria-label="Recorded run route" />;
}
