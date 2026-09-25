"use client";

import { useEffect, useRef } from "react";
import { pathKey, parsePathKey } from "@/lib/route-geometry";
import type { CertificateRoute } from "@/lib/certificate-map";
import { drawRouteMap } from "./routeMapCanvas";
import { leagueFonts } from "./CertificateExport";

const W = 1040;
const H = 540;

/**
 * The certificate's route map on the recap screen, drawn by the same code as the PNG so what
 * the participant confirms is what the image shows. Redrawn only when the route itself changes.
 */
export function RouteMapPreview({ route }: { route: CertificateRoute }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const key = pathKey(route.path);
  const { confirmed, finalPlace, finalWhen, count, kitTeam, name } = route;

  useEffect(() => {
    const canvas = ref.current;
    const c = canvas?.getContext("2d");
    if (!canvas || !c) return;
    let cancelled = false;
    const fonts = leagueFonts();
    // Draw off-screen and copy across, so a slow redraw never shows half a map.
    const off = document.createElement("canvas");
    off.width = W;
    off.height = H;
    const oc = off.getContext("2d");
    if (!oc) return;
    void drawRouteMap(oc, { x: 0, y: 0, w: W, h: H }, { path: parsePathKey(key), confirmed, finalPlace, finalWhen, count, kitTeam, name }, fonts).then(() => {
      if (cancelled) return;
      c.clearRect(0, 0, W, H);
      c.drawImage(off, 0, 0);
    });
    return () => {
      cancelled = true;
    };
  }, [key, confirmed, finalPlace, finalWhen, count, kitTeam, name]);

  return <canvas ref={ref} className="pb-route-preview" width={W} height={H} role="img" aria-label={`Route map${finalPlace ? `, ending ${finalPlace}` : ""}`} />;
}
