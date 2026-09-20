"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { publicEnv } from "@/lib/env";
import { TOWN_PINS } from "@/lib/programme";

/**
 * A plotted point. `current`/`history` are the participant's check-ins (the route; the latest
 * one is a kit-badge pin with an orange halo), `place` an itinerary venue, `member` a league
 * member's shared position: the same kit-badge pin, never part of the route line and never
 * driving the viewport.
 */
export type MapPin = {
  id: string;
  latitude: number;
  longitude: number;
  label: string;
  kind: "current" | "history" | "place" | "member";
  /** Badge pins (`current`, `member`): kit code for the colours and logo (null → initials on league green). */
  team?: string | null;
  /** Badge pins: display name, for the initials fallback. */
  name?: string;
  /** Member pins: drawn faded when the position is hours old. */
  stale?: boolean;
};

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
 * the check-in path drawn along real roads (see useRoutedPath). When tiles are explicitly disabled
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
          {pins.some((p) => p.kind === "current" || p.kind === "member") ? " Live check-in and member positions are listed below; configure a tile provider to plot them." : ""}
        </div>
      </div>
    );
  }
  const checkinCount = pins.filter((p) => p.kind === "current" || p.kind === "history").length;
  const memberCount = pins.filter((p) => p.kind === "member").length;
  return (
    <div>
      <LiveMap pins={pins} path={path} focus={focus} tileUrl={publicEnv.mapTileUrl} attribution={publicEnv.mapTileAttribution} fallbackLatitude={TOWN_PINS.pofadder.latitude} fallbackLongitude={TOWN_PINS.pofadder.longitude} />
      <div className="pb-map-source">
        Live map · attribution shown on the map · {path.length > 1 ? `Orange line: the road route through ${path.length} check-ins, oldest to newest (a leg stays straight where no road was found).` : checkinCount > 0 ? "One check-in so far; the route line appears from the second." : "No check-ins plotted yet."} The badge with the orange halo is the latest check-in. Grey pins are itinerary venues, not check-ins.{memberCount > 0 ? ` Team-badge pins are ${memberCount === 1 ? "one league member's" : `${memberCount} league members'`} shared positions, not part of the route.` : ""} Place names © <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">GeoNames</a> (CC BY 4.0).
      </div>
    </div>
  );
}
