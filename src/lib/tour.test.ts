import { describe, expect, it } from "vitest";
import { navFor } from "@/components/shell/nav";
import { currentStepId, placeCard, tourStepsFor } from "./tour";

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
      for (const s of byId.values()) if (s.id !== "header" && s.id !== "nav") expect(s.menu, s.id).toBeUndefined();
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

  it("always uses the bottom sheet on a phone", () => {
    const p = placeCard({ top: 100, left: 10, width: 300, height: 80 }, { width: 358, height: 260 }, { width: 390, height: 780 });
    expect(p).toEqual({ placement: "sheet", bottom: 14, left: 16 });
  });
});
