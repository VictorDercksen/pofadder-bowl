import { describe, expect, it } from "vitest";
import { describeRole, resolveAccess } from "./roles";
import { navFor } from "@/components/shell/nav";

const victor = { isAdmin: true, isCommissioner: true, isParticipant: true };
const theo = { isAdmin: false, isCommissioner: true, isParticipant: false };
const member = { isAdmin: false, isCommissioner: false, isParticipant: false };

describe("resolveAccess", () => {
  it("keeps every hat for the admin participant", () => {
    const a = resolveAccess(victor, false);
    expect(a.role).toBe("admin");
    expect(a.isParticipant).toBe(true);
    expect(a.canViewAsMember).toBe(true);
    expect(a.viewingAsMember).toBe(false);
    expect(describeRole(a)).toBe("ADMIN · PARTICIPANT");
  });

  it("admins inherit the commissioner role", () => {
    expect(resolveAccess({ ...victor, isCommissioner: false }, false).isCommissioner).toBe(true);
  });

  it("member view removes every capability but remembers it can be exited", () => {
    const a = resolveAccess(victor, true);
    expect(a).toMatchObject({ role: "member", isAdmin: false, isCommissioner: false, isParticipant: false, canViewAsMember: true, viewingAsMember: true });
    expect(describeRole(a)).toBe("LEAGUE MEMBER VIEW");
  });

  it("does nothing for a plain member with the cookie set", () => {
    const a = resolveAccess(member, true);
    expect(a).toMatchObject({ role: "member", canViewAsMember: false, viewingAsMember: false });
    expect(describeRole(a)).toBe("LEAGUE MEMBER");
  });

  it("labels a commissioner without the participant hat", () => {
    expect(describeRole(resolveAccess(theo, false))).toBe("COMMISSIONER");
  });
});

describe("navFor", () => {
  const labels = (role: Parameters<typeof navFor>[0]) => navFor(role, "").map((i) => i.label);

  it("gives the participant a trip screen the league never sees, and everyone the proof locker", () => {
    const admin = labels("admin");
    const participant = labels("participant");
    const plain = labels("member");
    expect(participant).toContain("My trip");
    expect(admin).toContain("My trip");
    expect(plain).not.toContain("My trip");
    for (const role of [admin, participant, plain]) expect(role).toContain("Proof locker");
    expect(admin).toContain("Commissioner");
    expect(admin).toContain("League admin");
    expect(participant).not.toContain("Commissioner");
  });

  it("member view shows exactly the member screens", () => {
    expect(labels(resolveAccess(victor, true).role)).toEqual(labels("member"));
  });
});
