import { describe, expect, it } from "vitest";
import { DEFAULT_MAP_TILE_URL, resolveTileUrl } from "./env";

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
