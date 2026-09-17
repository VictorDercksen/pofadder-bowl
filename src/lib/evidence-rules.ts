/** Shared (client + server) upload rules. The trusted side re-validates everything. */

export type EvidenceKind = "photo" | "video" | "audio" | "document" | "gps";

export const MB = 1024 * 1024;
/** Files at or below this size use a single signed upload; larger files use resumable TUS uploads. */
export const RESUMABLE_THRESHOLD = 6 * MB;
export const TUS_CHUNK_SIZE = 6 * MB; // required by Supabase Storage

export const LIMITS: Record<EvidenceKind, { maxBytes: number; label: string }> = {
  photo: { maxBytes: 25 * MB, label: "Photos up to 25 MB" },
  video: { maxBytes: 500 * MB, label: "Clips up to 500 MB" },
  audio: { maxBytes: 50 * MB, label: "Audio up to 50 MB" },
  document: { maxBytes: 25 * MB, label: "Receipts/PDFs up to 25 MB" },
  gps: { maxBytes: 25 * MB, label: "Watch exports up to 25 MB" },
};

const IMAGE = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const VIDEO = ["video/mp4", "video/quicktime", "video/webm", "video/3gpp"];
const AUDIO = ["audio/webm", "audio/mp4", "audio/mpeg"];
const DOC = ["application/pdf", "text/plain"];
const GPS_EXT = [".gpx", ".tcx", ".fit", ".csv", ".kml", ".json"];

/** Bare lowercase media type: MediaRecorder reports `video/webm;codecs=vp9,opus`, some pickers report mixed case. */
export function normaliseMime(mimeType: string): string {
  return (mimeType ?? "").split(";")[0].trim().toLowerCase();
}

export function classify(mimeType: string, fileName: string): { kind: EvidenceKind; mime: string } | null {
  const mt = normaliseMime(mimeType);
  const lower = fileName.toLowerCase();
  const ext = lower.slice(lower.lastIndexOf("."));
  const knownMedia = IMAGE.includes(mt) || VIDEO.includes(mt) || AUDIO.includes(mt) || mt === "application/pdf";
  // Watch exports are recognised by extension, but a real photo/clip/PDF type wins over a misleading name.
  if (GPS_EXT.includes(ext) && !knownMedia) {
    const mime = ext === ".gpx" ? "application/gpx+xml" : ext === ".tcx" ? "application/vnd.garmin.tcx+xml" : ext === ".csv" ? "text/csv" : "application/octet-stream";
    return { kind: "gps", mime };
  }
  if (IMAGE.includes(mt)) return { kind: "photo", mime: mt };
  if (VIDEO.includes(mt)) return { kind: "video", mime: mt };
  if (AUDIO.includes(mt)) return { kind: "audio", mime: mt };
  if (DOC.includes(mt)) return { kind: "document", mime: mt };
  if (ext === ".zip") return { kind: "document", mime: "application/zip" };
  return null;
}

export function validateFile(mimeType: string, fileName: string, byteSize: number): { ok: true; kind: EvidenceKind; mime: string } | { ok: false; reason: string } {
  const c = classify(mimeType, fileName);
  if (!c) return { ok: false, reason: `Unsupported file type (${mimeType || "unknown"}). Use photos, MP4/MOV clips, PDFs or watch exports (GPX/TCX/FIT).` };
  if (!Number.isFinite(byteSize) || byteSize <= 0) return { ok: false, reason: "The file is empty." };
  const limit = LIMITS[c.kind];
  if (byteSize > limit.maxBytes) return { ok: false, reason: `${limit.label}. This file is ${(byteSize / MB).toFixed(1)} MB.` };
  return { ok: true, kind: c.kind, mime: c.mime };
}

export function safeExtension(fileName: string): string {
  const m = /\.([a-z0-9]{1,8})$/i.exec(fileName);
  return m ? m[1].toLowerCase() : "bin";
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1000 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / MB).toFixed(1)} MB`;
}
