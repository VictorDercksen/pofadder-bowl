import { describe, expect, it } from "vitest";
import { navFor } from "@/components/shell/nav";
import { currentStepId, placeCard, scrollOffset, tourStepsFor } from "./tour";

const roles = ["member", "participant", "commissioner", "admin"] as const;

describe("tourStepsFor", () => {
  it("opens with the welcome and closes with full time for every role", () => {
    for (const role of roles) {
      const steps = tourStepsFor(role);
      expect(steps[0].id).toBe("welcome");
      expect(steps[steps.length - 1].id).toBe("done");
      expect(new Set(steps.map((s) => s.id)).size).toBe(steps.length);
    }
  });

  it("only visits screens that role's menu offers", () => {
    for (const role of roles) {
      const allowed = new Set(navFor(role, "").map((i) => i.href));
      for (const s of tourStepsFor(role)) if (s.href) expect(allowed, `${role} → ${s.href}`).toContain(s.href);
    }
  });

  it("scopes the blocks per role", () => {
    const ids = (role: (typeof roles)[number], participant?: boolean) => tourStepsFor(role, participant).map((s) => s.id);
    expect(ids("member")).not.toContain("my-trip");
    expect(ids("member")).not.toContain("review");
    expect(ids("member")).toContain("proof-view");
    expect(ids("member")).not.toContain("proof");
    expect(ids("commissioner")).toContain("proof-view");
    expect(ids("participant")).toContain("proof");
    expect(ids("participant")).not.toContain("proof-view");
    expect(ids("admin", true)).not.toContain("proof-view");
    expect(ids("participant")).not.toContain("review");
    expect(ids("commissioner")).toContain("review");
    expect(ids("commissioner")).not.toContain("members");
    expect(ids("commissioner")).not.toContain("my-trip");
    expect(ids("admin")).toEqual(expect.arrayContaining(["review", "members", "member-view", "tour-test"]));
    expect(ids("admin")).not.toContain("my-trip");
  });

  it("adds the participant screens when the commissioner or admin is the participant", () => {
    expect(tourStepsFor("admin", true).map((s) => s.id)).toEqual(expect.arrayContaining(["members", "my-trip", "proof"]));
    expect(tourStepsFor("commissioner", true).map((s) => s.id)).toContain("location");
    expect(tourStepsFor("participant").find((s) => s.id === "press")?.body).toMatch(/answer each/);
    expect(tourStepsFor("member").find((s) => s.id === "press")?.body).toMatch(/Victor answers/);
  });

  it("walks the map's member pins and fullscreen for every role, the share panel for non-participants only", () => {
    for (const role of roles) {
      const byId = new Map(tourStepsFor(role).map((s) => [s.id, s]));
      const ids = [...byId.keys()];
      expect(ids.indexOf("league-pins")).toBeGreaterThan(ids.indexOf("map"));
      expect(ids.indexOf("map-fullscreen")).toBeGreaterThan(ids.indexOf("league-pins"));
      expect(byId.get("league-pins")).toMatchObject({ href: "/map", targets: ["league-pins"] });
      expect(byId.get("map-fullscreen")).toMatchObject({ href: "/map", targets: ["map-fullscreen"] });
      expect(byId.get("map-fullscreen")!.body).toMatch(/everything/i);
    }
    expect(tourStepsFor("member").find((s) => s.id === "your-pin")).toMatchObject({ href: "/map", targets: ["member-location"] });
    expect(tourStepsFor("participant").map((s) => s.id)).not.toContain("your-pin");
    expect(tourStepsFor("admin", true).map((s) => s.id)).not.toContain("your-pin");
    expect(tourStepsFor("participant").find((s) => s.id === "league-pins")!.body).toMatch(/your check-ins/);
    expect(tourStepsFor("member").find((s) => s.id === "league-pins")!.body).toMatch(/Victor/);
  });

  it("ends every role on League access, where the replay button lives", () => {
    for (const role of roles) {
      const steps = tourStepsFor(role);
      expect(steps[steps.length - 2].href).toBe("/account");
    }
  });

  it("opens the phone menu for the colours and programme steps and spotlights the drawer first", () => {
    for (const role of roles) {
      const byId = new Map(tourStepsFor(role).map((s) => [s.id, s]));
      const header = byId.get("header")!;
      expect(header.menu).toBe(true);
      expect(header.targets[0]).toBe("drawer-identity");
      expect(header.targets).toContain("header-account");
      const nav = byId.get("nav")!;
      expect(nav.menu).toBe(true);
      expect(nav.targets[0]).toBe("drawer-nav");
      expect(nav.targets).toContain("nav");
      // Nothing else touches the drawer, so it closes as soon as the tour moves on.
      for (const s of byId.values()) if (s.id !== "header" && s.id !== "nav" && s.id !== "member-view") expect(s.menu, s.id).toBeUndefined();
    }
  });

  it("spotlights the viewer's preview card on the sideline step for every role", () => {
    for (const role of roles) {
      const sideline = tourStepsFor(role).find((s) => s.id === "sideline")!;
      expect(sideline.href).toBe("/game-centre");
      expect(sideline.targets).toEqual(["sideline-preview", "sideline"]);
      expect(sideline.body).toMatch(/preview/i);
    }
  });
});

describe("currentStepId", () => {
  it("names the step a run is on and clamps out-of-range steps", () => {
    expect(currentStepId(null)).toBeNull();
    expect(currentStepId({ role: "member", participant: false, step: 0 })).toBe("welcome");
    const sidelineIndex = tourStepsFor("member").findIndex((s) => s.id === "sideline");
    expect(currentStepId({ role: "member", participant: false, step: sidelineIndex })).toBe("sideline");
    expect(currentStepId({ role: "member", participant: false, step: 999 })).toBe("done");
    expect(currentStepId({ role: "member", participant: false, step: -3 })).toBe("welcome");
  });
});

describe("placeCard", () => {
  const card = { width: 360, height: 240 };
  const desktop = { width: 1280, height: 800 };

  it("sits below a target that leaves room", () => {
    const p = placeCard({ top: 100, left: 300, width: 400, height: 80 }, card, desktop);
    expect(p.placement).toBe("below");
    expect(p.top).toBe(194);
    expect(p.left).toBe(320);
  });

  it("moves above a target near the bottom, anchored by its bottom edge", () => {
    const p = placeCard({ top: 650, left: 300, width: 400, height: 120 }, card, desktop);
    expect(p.placement).toBe("above");
    expect(p.top).toBeUndefined();
    expect(p.bottom).toBe(800 - (650 - 14));
  });

  it("clamps the card inside the viewport horizontally", () => {
    expect(placeCard({ top: 100, left: 1200, width: 60, height: 40 }, card, desktop).left).toBe(1280 - 360 - 14);
    expect(placeCard({ top: 100, left: 0, width: 60, height: 40 }, card, desktop).left).toBe(14);
  });

  it("falls back to a sheet when the target fills the height, and centres without a target", () => {
    expect(placeCard({ top: 20, left: 100, width: 800, height: 760 }, card, desktop)).toMatchObject({ placement: "sheet", bottom: 14 });
    expect(placeCard(null, card, desktop)).toEqual({ placement: "centre", left: 460 });
  });

  it("keeps the card off the target on a phone: below, above, or the sheet that hides less", () => {
    const phone = { width: 390, height: 780 };
    const small = { width: 358, height: 260 };
    // Short target near the top: the card goes straight below it, full width.
    expect(placeCard({ top: 100, left: 10, width: 300, height: 80 }, small, phone)).toEqual({ placement: "below", top: 194, left: 16 });
    // Short target near the bottom: above it.
    expect(placeCard({ top: 600, left: 10, width: 300, height: 120 }, small, phone)).toMatchObject({ placement: "above", bottom: 780 - 586, left: 16 });
    // A target across the middle that neither side fits: the bottom sheet covers 220 px, the top sheet 24 px.
    expect(placeCard({ top: 250, left: 10, width: 300, height: 400 }, small, phone)).toEqual({ placement: "top", top: 14, left: 16 });
    // A target taller than the free zone was scrolled head first: keep the bottom sheet so the head shows.
    expect(placeCard({ top: 80, left: 10, width: 300, height: 900 }, small, phone)).toEqual({ placement: "sheet", bottom: 14, left: 16 });
    // No target: the bottom sheet.
    expect(placeCard(null, small, phone)).toEqual({ placement: "sheet", bottom: 14, left: 16 });
  });

  it("goes beside a tall target on a desktop, aligned to its top and kept on screen", () => {
    expect(placeCard({ top: 200, left: 300, width: 400, height: 420 }, card, desktop)).toEqual({ placement: "right", top: 200, left: 714 });
    // No room on the right: the left side.
    expect(placeCard({ top: 200, left: 700, width: 500, height: 420 }, card, desktop)).toEqual({ placement: "left", top: 200, left: 326 });
    // A target that starts low is still given a card that fits in the viewport.
    expect(placeCard({ top: 250, left: 300, width: 400, height: 300 }, card, { width: 1280, height: 500 })).toEqual({ placement: "right", top: 500 - 240 - 14, left: 714 });
  });

  it("uses the top sheet on a desktop only when nothing fits beside a mid-screen target", () => {
    const p = placeCard({ top: 200, left: 100, width: 1080, height: 420 }, card, desktop);
    expect(p.placement).toBe("top");
    expect(p.top).toBe(14);
  });
});

describe("scrollOffset", () => {
  const phone = { width: 390, height: 780 };
  const card = { height: 260 };
  const header = 64;

  it("leaves a target alone when it already sits in the free zone", () => {
    expect(scrollOffset({ top: 100, left: 0, width: 300, height: 200 }, card, phone, header)).toBe(0);
  });

  it("scrolls a target out from under the header and the sheet, centring it in the zone", () => {
    // Zone on this phone: 78 → 492 (414 px). A 200 px target centred there starts at 185.
    expect(scrollOffset({ top: 20, left: 0, width: 300, height: 200 }, card, phone, header)).toBe(20 - 185);
    expect(scrollOffset({ top: 600, left: 0, width: 300, height: 200 }, card, phone, header)).toBe(600 - 185);
  });

  it("puts the head of a tall target at the top of the zone", () => {
    expect(scrollOffset({ top: 500, left: 0, width: 300, height: 900 }, card, phone, header)).toBe(500 - 78);
  });

  it("centres the target and the card together on a desktop when both fit", () => {
    const desktop = { width: 1280, height: 800 };
    // Zone 95 → 786 (691 px). Target 300 + gap + card 260 = 574 fits: leave it when the card fits above or below.
    expect(scrollOffset({ top: 400, left: 0, width: 300, height: 300 }, card, desktop, 81)).toBe(0);
    // Target sits in the zone but leaves no room for the card on either side: centre the pair (top 153).
    expect(scrollOffset({ top: 250, left: 0, width: 300, height: 300 }, card, desktop, 81)).toBe(Math.round(250 - (95 + (691 - 574) / 2)));
    // Off screen: same target position once scrolled.
    expect(scrollOffset({ top: 900, left: 0, width: 300, height: 300 }, card, desktop, 81)).toBe(Math.round(900 - (95 + (691 - 574) / 2)));
    // Too tall for the pair but not for the zone: centre the target alone.
    expect(scrollOffset({ top: 900, left: 0, width: 300, height: 600 }, card, desktop, 81)).toBe(Math.round(900 - (95 + (691 - 600) / 2)));
  });
});
