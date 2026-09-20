import { describe, expect, it } from "vitest";
import { DRAWER_EVENT, readDrawerEvent } from "./drawer-events";

describe("readDrawerEvent", () => {
  it("reads open and quiet from the tour's drawer event", () => {
    expect(readDrawerEvent(new CustomEvent(DRAWER_EVENT, { detail: { open: true, quiet: true } }))).toEqual({ open: true, quiet: true });
    expect(readDrawerEvent(new CustomEvent(DRAWER_EVENT, { detail: { open: false } }))).toEqual({ open: false, quiet: false });
  });

  it("ignores events without a boolean open flag", () => {
    expect(readDrawerEvent(new Event(DRAWER_EVENT))).toBeNull();
    expect(readDrawerEvent(new CustomEvent(DRAWER_EVENT, { detail: { open: "yes" } }))).toBeNull();
  });
});
