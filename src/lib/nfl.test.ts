import { describe, expect, it } from "vitest";
import { KITS, NFL_TEAMS, kitFor, teamLogoSrc, teamName } from "./nfl";

describe("team lookups", () => {
  it("resolve regardless of case or padding", () => {
    expect(teamName("KC")).toBe(teamName("kc"));
    expect(teamLogoSrc(" Kc ")).toBe(teamLogoSrc("kc"));
    expect(kitFor("CIN")).toBe(KITS.cin);
  });
  it("fall back to the league kit", () => {
    expect(kitFor(null)).toBe(KITS.nfl);
    expect(kitFor("zzz")).toBe(KITS.nfl);
    expect(teamName("zzz")).toBe("NFL team");
  });
  it("cover every franchise", () => {
    for (const t of NFL_TEAMS) expect(KITS[t.code], t.code).toBeDefined();
  });
});
