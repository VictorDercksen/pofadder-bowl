import { describe, expect, it } from "vitest";
import { metadataHasPassword, resolveHasPassword } from "./password-gate";

describe("resolveHasPassword", () => {
  it("trusts the RPC answer whenever it gives one", () => {
    expect(resolveHasPassword(true, undefined)).toBe(true);
    expect(resolveHasPassword(false, { has_password: true })).toBe(false);
    expect(resolveHasPassword(true, { has_password: false })).toBe(true);
  });

  it("falls back to the metadata flag when the RPC does not report (pre-migration or legacy path)", () => {
    expect(resolveHasPassword(undefined, { has_password: true })).toBe(true);
    expect(resolveHasPassword(undefined, { has_password: false })).toBe(false);
    expect(resolveHasPassword(undefined, undefined)).toBe(false);
    expect(resolveHasPassword(null, { has_password: true })).toBe(true);
  });

  it("only accepts a boolean true in the metadata", () => {
    for (const bad of [null, undefined, "yes", 1, [], { has_password: "true" }, { has_password: 1 }, { other: true }]) {
      expect(metadataHasPassword(bad), JSON.stringify(bad)).toBe(false);
    }
    expect(metadataHasPassword({ has_password: true })).toBe(true);
  });
});
