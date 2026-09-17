"use client";

import { useEffect, useState, useTransition } from "react";
import { signedMediaUrl } from "@/lib/actions/evidence";
import { nowMs } from "@/lib/time";

export type GalleryFile = { id: string; kind: string; name: string; mime: string };

/**
 * Plays photos/clips through short-lived signed URLs minted on demand. Documents and
 * GPS exports are offered as downloads and are never executed or inlined.
 */
export function MediaGallery({ files }: { files: GalleryFile[] }) {
  const [open, setOpen] = useState<Record<string, { url: string; expires: number }>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function load(file: GalleryFile) {
    startTransition(async () => {
      const res = await signedMediaUrl({ fileId: file.id });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setError(null);
      setOpen((prev) => ({ ...prev, [file.id]: { url: res.url, expires: nowMs() + 290_000 } }));
    });
  }

  // Signed links live five minutes; re-check freshness so an expired preview is not left on screen.
  const [now, setNow] = useState(() => nowMs());
  useEffect(() => {
    const id = window.setInterval(() => setNow(nowMs()), 15_000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div>
      {files.map((file) => {
        const entry = open[file.id];
        const fresh = entry && entry.expires > now;
        return (
          <div className="pb-media-frame" key={file.id}>
            {fresh && file.kind === "photo" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="pb-media" src={entry.url} alt={file.name} />
            ) : fresh && file.kind === "video" ? (
              <video className="pb-media" src={entry.url} controls playsInline preload="metadata" />
            ) : fresh && file.kind === "audio" ? (
              <audio style={{ width: "100%" }} src={entry.url} controls preload="metadata" />
            ) : null}
            <div className="pb-media-caption" style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
              <span>
                {file.name} · {file.kind}
              </span>
              {(file.kind === "document" || file.kind === "gps") && fresh ? (
                // A real link keeps the download inside the user's click, so popup blockers leave it alone.
                <a className="pb-play" href={entry.url} download={file.name} target="_blank" rel="noopener noreferrer">
                  ⤓ Download {file.name}
                </a>
              ) : (
                <button className="pb-play" type="button" disabled={pending} onClick={() => load(file)}>
                  {file.kind === "document" || file.kind === "gps" ? "⤓ Get download link" : fresh ? "↻ Refresh link" : "▷ Load preview"}
                </button>
              )}
            </div>
          </div>
        );
      })}
      {error ? <p className="pb-warn-text pb-inline-status" role="alert">{error}</p> : null}
    </div>
  );
}
