import { describe, expect, it } from "vitest";
import { MB, RESUMABLE_THRESHOLD, classify, safeExtension, validateFile } from "./evidence-rules";

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
