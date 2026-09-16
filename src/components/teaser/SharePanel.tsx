"use client";

import { useState } from "react";

const POSTER = "/brand/pofadder-bowl-2026-teaser.png";
const CAPTION = "Pofadder Bowl 2026 · Show Us Your TD’s · 23–25 September. No timeouts. No appeals.";

/** Share / download panel for the full teaser poster. */
export function SharePanel() {
  const [note, setNote] = useState("");

  async function share() {
    const url = `${window.location.origin}/teaser`;
    try {
      if (navigator.share) {
        let files: File[] | undefined;
        try {
          const blob = await (await fetch(POSTER)).blob();
          const file = new File([blob], "pofadder-bowl-2026-teaser.png", { type: "image/png" });
          if (navigator.canShare?.({ files: [file] })) files = [file];
        } catch {
          files = undefined;
        }
        await navigator.share({ title: "Pofadder Bowl 2026", text: CAPTION, url, files });
        setNote("Shared.");
        return;
      }
      await navigator.clipboard.writeText(`${CAPTION} ${url}`);
      setNote("Link and caption copied to the clipboard.");
    } catch (err) {
      if ((err as Error).name !== "AbortError") setNote("Sharing is not available here. Use the download instead.");
    }
  }

  return (
    <div className="pb-panel" style={{ marginTop: 18, background: "#153428", borderColor: "#2a513e", color: "#f4f0e6" }}>
      <div className="pb-panel-top">
        <h3 style={{ color: "#fff8e9" }}>Share the teaser</h3>
        <span className="pb-tag" style={{ background: "#0f261c", color: "#cbd7c1", borderColor: "#2a513e" }}>FULL POSTER · 1254 × 1254</span>
      </div>
      <p className="pb-small" style={{ color: "#c9d5c5" }}>The complete poster is the approved artwork. It is not cropped into a logo.</p>
      <div className="pb-actions">
        <a className="pb-secondary" href={POSTER} download="pofadder-bowl-2026-teaser.png">Download poster</a>
        <button className="pb-secondary" type="button" onClick={share}>Share / copy caption</button>
      </div>
      {note ? <p className="pb-inline-status" style={{ color: "#c9d5c5" }} role="status">{note}</p> : null}
    </div>
  );
}
