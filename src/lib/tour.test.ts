import { describe, expect, it } from "vitest";
import { navFor } from "@/components/shell/nav";
import { placeCard, tourStepsFor } from "./tour";

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
    expect(ids("participant")).toContain("proof");
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

  it("ends every role on League access, where the replay button lives", () => {
    for (const role of roles) {
      const steps = tourStepsFor(role);
      expect(steps[steps.length - 2].href).toBe("/account");
    }
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

  it("always uses the bottom sheet on a phone", () => {
    const p = placeCard({ top: 100, left: 10, width: 300, height: 80 }, { width: 358, height: 260 }, { width: 390, height: 780 });
    expect(p).toEqual({ placement: "sheet", bottom: 14, left: 16 });
  });
});
