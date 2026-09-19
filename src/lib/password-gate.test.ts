import { describe, expect, it } from "vitest";
import { claimsHaveSetPassword, isReauthenticationError, isSamePasswordError, metadataHasPassword, resolveHasPassword } from "./password-gate";

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

describe("claimsHaveSetPassword", () => {
  it("accepts the metadata flag or a password entry in amr", () => {
    expect(claimsHaveSetPassword({ user_metadata: { has_password: true } })).toBe(true);
    expect(claimsHaveSetPassword({ amr: [{ method: "password", timestamp: 1 }] })).toBe(true);
    expect(claimsHaveSetPassword({ amr: ["password"] })).toBe(true);
  });
  it("rejects otp-only sessions and missing claims", () => {
    expect(claimsHaveSetPassword({ amr: [{ method: "otp", timestamp: 1 }], user_metadata: {} })).toBe(false);
    expect(claimsHaveSetPassword({ amr: "password" })).toBe(false);
    expect(claimsHaveSetPassword(null)).toBe(false);
    expect(claimsHaveSetPassword({})).toBe(false);
  });
});

describe("GoTrue replies", () => {
  it("recognises the same-password refusal by code or wording", () => {
    expect(isSamePasswordError({ code: "same_password", message: "x" })).toBe(true);
    expect(isSamePasswordError({ message: "New password should be different from the old password." })).toBe(true);
    expect(isSamePasswordError({ code: "weak_password", message: "Password is too weak" })).toBe(false);
  });
  it("recognises the reauthentication requirement", () => {
    expect(isReauthenticationError({ code: "reauthentication_needed", message: "x" })).toBe(true);
    expect(isReauthenticationError({ message: "Password update requires reauthentication" })).toBe(true);
    expect(isReauthenticationError({ message: "Password is too weak" })).toBe(false);
  });
});
