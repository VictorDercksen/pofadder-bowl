import { describe, expect, it } from "vitest";
import { DEFAULT_MAP_TILE_URL, resolveTileUrl, DEFAULT_MAP_ROUTING_URL, resolveRoutingUrl, parseFlag } from "./env";

describe("resolveTileUrl", () => {
  it("defaults to OpenStreetMap when nothing is configured", () => {
    expect(resolveTileUrl(undefined)).toBe(DEFAULT_MAP_TILE_URL);
    expect(resolveTileUrl("")).toBe(DEFAULT_MAP_TILE_URL);
    expect(resolveTileUrl("  ")).toBe(DEFAULT_MAP_TILE_URL);
  });
  it("keeps a configured provider", () => {
    expect(resolveTileUrl("https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=k")).toContain("maptiler");
  });
  it("turns the live map off only when asked explicitly", () => {
    expect(resolveTileUrl("static")).toBe("");
    expect(resolveTileUrl("NONE")).toBe("");
  });
});

describe("resolveRoutingUrl", () => {
  it("defaults to the public OSRM router", () => {
    expect(resolveRoutingUrl(undefined)).toBe(DEFAULT_MAP_ROUTING_URL);
    expect(resolveRoutingUrl("  \r")).toBe(DEFAULT_MAP_ROUTING_URL);
  });

  it("keeps a configured router and turns routing off only when asked", () => {
    expect(resolveRoutingUrl("https://osrm.example.org/")).toBe("https://osrm.example.org/");
    expect(resolveRoutingUrl("none")).toBe("");
    expect(resolveRoutingUrl("OFF")).toBe("");
  });
});

describe("parseFlag", () => {
  it("accepts the usual spellings of on", () => {
    expect(parseFlag("true")).toBe(true);
    expect(parseFlag(" TRUE\r")).toBe(true);
    expect(parseFlag("1")).toBe(true);
    expect(parseFlag("yes")).toBe(true);
  });
  it("is off unless set explicitly", () => {
    expect(parseFlag(undefined)).toBe(false);
    expect(parseFlag("")).toBe(false);
    expect(parseFlag("false")).toBe(false);
    expect(parseFlag("0")).toBe(false);
    expect(parseFlag("production")).toBe(false);
  });
});
