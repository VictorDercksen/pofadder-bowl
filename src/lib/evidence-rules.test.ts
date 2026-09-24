import { describe, expect, it } from "vitest";
import { MB, RESUMABLE_THRESHOLD, STORAGE_MAX_BYTES, acceptForProofType, classify, formatBytes, safeExtension, validateFile } from "./evidence-rules";

describe("upload validation", () => {
  it("classifies by mime and extension", () => {
    expect(classify("image/jpeg", "a.jpg")?.kind).toBe("photo");
    expect(classify("video/mp4", "a.mp4")?.kind).toBe("video");
    expect(classify("application/octet-stream", "run.gpx")).toEqual({ kind: "gps", mime: "application/gpx+xml" });
    expect(classify("application/pdf", "receipt.pdf")?.kind).toBe("document");
    expect(classify("text/html", "evil.html")).toBeNull();
    expect(classify("application/x-msdownload", "evil.exe")).toBeNull();
  });
  it("enforces size limits per kind", () => {
    expect(validateFile("image/png", "a.png", 26 * MB)).toMatchObject({ ok: false });
    expect(validateFile("image/png", "a.png", 2 * MB)).toMatchObject({ ok: true, kind: "photo" });
    expect(validateFile("video/mp4", "a.mp4", 0)).toMatchObject({ ok: false });
  });
  it("refuses clips over the storage cap with a hint, before any upload", () => {
    const res = validateFile("video/quicktime", "IMG_7280.mov", 72 * MB);
    expect(res).toMatchObject({ ok: false });
    expect(res.ok ? "" : res.reason).toMatch(/50 MB.*72\.0 MB.*Trim/);
    expect(validateFile("video/quicktime", "IMG_7281.mov", 49 * MB)).toMatchObject({ ok: true, kind: "video" });
  });
  it("uses resumable uploads for accepted large clips below the cap", () => {
    expect(STORAGE_MAX_BYTES).toBe(50 * MB);
    expect(RESUMABLE_THRESHOLD).toBe(6 * MB);
    expect(RESUMABLE_THRESHOLD).toBeLessThan(STORAGE_MAX_BYTES);
    expect(validateFile("video/mp4", "clip.mp4", RESUMABLE_THRESHOLD + 1).ok).toBe(true);
  });
  it("sanitises extensions", () => {
    expect(safeExtension("clip.MOV")).toBe("mov");
    expect(safeExtension("noext")).toBe("bin");
    expect(safeExtension("../../x.php%00.png")).toBe("png");
  });
});

describe("real-world file types", () => {
  it("accepts MediaRecorder types with codec parameters and mixed case", () => {
    expect(classify('video/webm;codecs="vp8, opus"', "press-answer.webm")).toEqual({ kind: "video", mime: "video/webm" });
    expect(classify("audio/webm;codecs=opus", "answer.webm")?.kind).toBe("audio");
    expect(classify("IMAGE/JPEG", "photo.JPG")?.kind).toBe("photo");
  });
  it("lets a real media type win over a watch-export extension", () => {
    expect(classify("image/jpeg", "sign.json")?.kind).toBe("photo");
    expect(classify("", "run.gpx")?.kind).toBe("gps");
    expect(classify("text/plain", "laps.csv")).toEqual({ kind: "gps", mime: "text/csv" });
  });
  it("rejects non-finite sizes", () => {
    expect(validateFile("image/jpeg", "a.jpg", Number.NaN)).toMatchObject({ ok: false });
    expect(validateFile("image/jpeg", "a.jpg", Number.POSITIVE_INFINITY)).toMatchObject({ ok: false });
  });
  it("never prints 1024 KB", () => {
    expect(formatBytes(MB - 1)).toBe("1.0 MB");
    expect(formatBytes(500 * 1024)).toBe("500 KB");
  });
});

describe("file picker per proof type", () => {
  it("narrows the picker to what the challenge asks for", () => {
    expect(acceptForProofType("photo")).toBe("image/*");
    expect(acceptForProofType("clip")).toBe("video/*");
    expect(acceptForProofType("3 clips")).toBe("video/*");
    expect(acceptForProofType("watch export")).toBe(".gpx,.tcx,.fit,.csv,image/*,application/pdf");
    expect(acceptForProofType("receipt")).toBe("image/*,video/*,application/pdf");
  });
  it("takes a picture or a clip when the challenge accepts either", () => {
    expect(acceptForProofType("clip or photo")).toBe("image/*,video/*");
    expect(acceptForProofType("Photo or clip")).toBe("image/*,video/*");
  });
});
