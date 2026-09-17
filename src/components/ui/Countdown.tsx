"use client";

import { useEffect, useState } from "react";
import { countdown } from "@/lib/time";

/** Live countdown to a UTC instant; renders `passedLabel` once reached. */
export function Countdown({ targetIso, passedLabel = "Departed" }: { targetIso: string; passedLabel?: string }) {
  const [label, setLabel] = useState(() => countdown(targetIso));
  useEffect(() => {
    const tick = () => setLabel(countdown(targetIso));
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, [targetIso]);
  return <span suppressHydrationWarning>{label ? `${label} to go` : passedLabel}</span>;
}
