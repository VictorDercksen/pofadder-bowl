import { describe, expect, it } from "vitest";
import { isMemberPinStale, memberInitials, memberPins, type MemberLocation } from "./member-locations";

const now = new Date("2026-09-24T10:00:00Z");
const base: MemberLocation = { user_id: "u1", display_name: "Theo Smit", kit_team: "kc", latitude: -33.37, longitude: 18.72, accuracy_m: 12, place_label: "10 km N of Malmesbury", captured_at: "2026-09-24T09:55:00Z", updated_at: "2026-09-24T09:55:00Z" };
const time = (iso: string) => iso.slice(11, 16);

describe("memberPins", () => {
  it("builds one styled pin per member, newest first, with name, place and time", () => {
    const older: MemberLocation = { ...base, user_id: "u2", display_name: "Anna", kit_team: null, captured_at: "2026-09-24T08:00:00Z", place_label: null, latitude: -29.1283, longitude: 19.3947 };
    const pins = memberPins([older, base], time, now);
    expect(pins.map((p) => p.id)).toEqual(["member:u1", "member:u2"]);
    expect(pins[0]).toMatchObject({ kind: "member", team: "kc", name: "Theo Smit", label: "Theo Smit · 10 km N of Malmesbury · 09:55", stale: false });
    expect(pins[1].label).toBe("Anna · -29.1283, 19.3947 · 08:00");
    expect(pins[1].team).toBeNull();
  });

  it("marks pins older than six hours stale and drops pins older than three days", () => {
    const stale: MemberLocation = { ...base, user_id: "u3", captured_at: "2026-09-24T03:00:00Z" };
    const ancient: MemberLocation = { ...base, user_id: "u4", captured_at: "2026-09-20T10:00:00Z" };
    const pins = memberPins([base, stale, ancient], time, now);
    expect(pins.map((p) => p.id)).toEqual(["member:u1", "member:u3"]);
    expect(pins[1].stale).toBe(true);
    expect(isMemberPinStale(base, now)).toBe(false);
    expect(isMemberPinStale({ captured_at: "garbage" }, now)).toBe(true);
  });

  it("skips rows without a finite position", () => {
    expect(memberPins([{ ...base, latitude: Number.NaN }], time, now)).toEqual([]);
  });
});

describe("memberInitials", () => {
  it("takes the first letters of the first and last name", () => {
    expect(memberInitials("Theo Smit")).toBe("TS");
    expect(memberInitials("Anna")).toBe("A");
    expect(memberInitials("  jan  van der merwe ")).toBe("JM");
    expect(memberInitials("")).toBe("?");
  });
});
