import { describe, expect, it } from "vitest";
import { MB, RESUMABLE_THRESHOLD, classify, formatBytes, safeExtension, validateFile } from "./evidence-rules";

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
    expect(validateFile("video/mp4", "a.mp4", 501 * MB)).toMatchObject({ ok: false });
    expect(validateFile("video/mp4", "a.mp4", 0)).toMatchObject({ ok: false });
  });
  it("routes large files to resumable uploads", () => {
    expect(RESUMABLE_THRESHOLD).toBe(6 * MB);
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
