"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { publicEnv } from "@/lib/env";
import { TOWN_PINS } from "@/lib/programme";

export type MapPin = { id: string; latitude: number; longitude: number; label: string; kind: "current" | "history" | "place" };

const LiveMap = dynamic(() => import("./LiveMap").then((m) => m.LiveMap), {
  ssr: false,
  loading: () => (
    <div className="pb-live-map" role="status" aria-live="polite">
      <div className="pb-skeleton" style={{ position: "absolute", inset: 0 }} />
      <span className="pb-map-fallback-label">LOADING MAP…</span>
    </div>
  ),
});

/**
 * Leaflet map on the configured tile provider (OpenStreetMap unless overridden), with
 * the check-in path drawn as a line. When tiles are explicitly disabled
 * (NEXT_PUBLIC_MAP_TILE_URL=static) the supplied regional preview is shown instead,
 * clearly labelled, with town-centre reference pins only; check-ins are then listed
 * rather than plotted.
 */
export function CheckinMap({ pins, path = [], focus }: { pins: MapPin[]; path?: [number, number][]; focus?: { latitude: number; longitude: number } }) {
  if (!publicEnv.mapTileUrl) {
    return (
      <div>
        <div className="pb-map">
          <Image src="/maps/pofadder-region-preview.webp" alt="Static regional map of the Western and Northern Cape showing Malmesbury and Pofadder" width={510} height={375} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <span className="pb-map-fallback-label">STATIC FALLBACK · NO LIVE TILES CONFIGURED</span>
          <span className="pb-map-pin" style={{ left: "43.195%", top: "78.027%" }}>
            <b>Malmesbury · town centre</b>
          </span>
          <span className="pb-map-pin" style={{ left: "49.152%", top: "16.473%" }}>
            <b>Pofadder · town centre</b>
          </span>
        </div>
        <div className="pb-map-source">
          Static preview from OpenStreetMap tiles · Map © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors · Pins are approximate town centres, not device check-ins.
          {pins.some((p) => p.kind === "current") ? " Live check-in positions are listed below; configure a tile provider to plot them." : ""}
        </div>
      </div>
    );
  }
  const checkinCount = pins.filter((p) => p.kind !== "place").length;
  return (
    <div>
      <LiveMap pins={pins} path={path} focus={focus} tileUrl={publicEnv.mapTileUrl} attribution={publicEnv.mapTileAttribution} fallbackLatitude={TOWN_PINS.pofadder.latitude} fallbackLongitude={TOWN_PINS.pofadder.longitude} />
      <div className="pb-map-source">
        Live map · attribution shown on the map · {path.length > 1 ? `Orange line: the route through ${path.length} check-ins, oldest to newest.` : checkinCount > 0 ? "One check-in so far; the route line appears from the second." : "No check-ins plotted yet."} Grey pins are itinerary venues, not check-ins. Place names © <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">GeoNames</a> (CC BY 4.0).
      </div>
    </div>
  );
}
