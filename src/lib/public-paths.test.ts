import { describe, expect, it } from "vitest";
import { anonymousRedirect, isPublicPath } from "./public-paths";

describe("isPublicPath", () => {
  it("opens the teaser, demo, sign-in, auth callbacks, consented recap and setup", () => {
    for (const p of ["/", "/teaser", "/demo", "/demo/map", "/login", "/auth/confirm", "/auth/session", "/auth/signout", "/recap/public/l/e", "/setup"]) {
      expect(isPublicPath(p), p).toBe(true);
    }
  });

  it("keeps every league screen, gate page and API route private", () => {
    for (const p of ["/home", "/game-centre", "/my-trip", "/map", "/proof", "/proof/abc", "/review", "/review/members", "/props", "/predictions", "/press", "/recap", "/account", "/choose-team", "/choose-sleeper", "/set-password", "/no-access", "/api/map-route"]) {
      expect(isPublicPath(p), p).toBe(false);
    }
  });

  it("does not treat a prefix lookalike as public", () => {
    expect(isPublicPath("/teaserx")).toBe(false);
    expect(isPublicPath("/demonstration")).toBe(false);
    expect(isPublicPath("/recap/publicity")).toBe(false);
    expect(isPublicPath("/loginx")).toBe(false);
  });
});

describe("anonymousRedirect", () => {
  it("sends strangers to the teaser and remembers the deep link", () => {
    expect(anonymousRedirect("/proof/abc", "?v=2")).toEqual({ pathname: "/teaser", next: "/proof/abc?v=2" });
    expect(anonymousRedirect("/review")).toEqual({ pathname: "/teaser", next: "/review" });
  });

  it("drops next for the root and the role home", () => {
    expect(anonymousRedirect("/").next).toBeNull();
    expect(anonymousRedirect("/home").next).toBeNull();
  });
});
