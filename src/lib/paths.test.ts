import { describe, expect, it } from "vitest";
import { safeInternalPath } from "./paths";

describe("safeInternalPath", () => {
  it("keeps ordinary in-app paths", () => {
    expect(safeInternalPath("/map", "/home")).toBe("/map");
    expect(safeInternalPath("/proof/abc?x=1#top", "/home")).toBe("/proof/abc?x=1#top");
  });
  it("falls back for anything that could leave the origin", () => {
    for (const bad of ["//evil.com", "/\\evil.com", "https://evil.com", "evil.com", "/\\\\evil.com", "/ map", "/map\r\nLocation: x", "", null, undefined, 42]) {
      expect(safeInternalPath(bad, "/home"), String(bad)).toBe("/home");
    }
  });
});
