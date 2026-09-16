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
 * Leaflet map with a configurable licensed tile provider. When no tile URL is
 * configured, shows the supplied static regional preview, explicitly labelled as a
 * fallback (town-centre reference pins only, never device check-ins).
 */
export function CheckinMap({ pins, focus }: { pins: MapPin[]; focus?: { latitude: number; longitude: number } }) {
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
  return (
    <div>
      <LiveMap pins={pins} focus={focus} tileUrl={publicEnv.mapTileUrl} attribution={publicEnv.mapTileAttribution || "Map data © OpenStreetMap contributors"} fallbackCenter={[TOWN_PINS.pofadder.latitude, TOWN_PINS.pofadder.longitude]} />
      <div className="pb-map-source">Live map · attribution shown on the map · Town pins are references, not check-ins.</div>
    </div>
  );
}
