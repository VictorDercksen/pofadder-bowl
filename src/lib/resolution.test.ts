import { describe, expect, it } from "vitest";
import { isResolutionOpen } from "./resolution";

describe("isResolutionOpen", () => {
  it("opens only once the commissioner has pressed the button", () => {
    expect(isResolutionOpen(null)).toBe(false);
    expect(isResolutionOpen(undefined)).toBe(false);
    expect(isResolutionOpen("2026-09-25T06:10:00Z")).toBe(true);
  });

  it("fails closed on an unparseable instant", () => {
    expect(isResolutionOpen("")).toBe(false);
    expect(isResolutionOpen("not a date")).toBe(false);
  });
});
