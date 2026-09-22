import { describe, expect, it } from "vitest";
import { photoSlotChallenge } from "./photo-slots";
import programme from "@/data/league-programme.json";

const challenges = programme.challenges.map((c) => ({ id: `id-${c.sequence}`, sequence: c.sequence, title: c.title, proof_type: c.proofType }));

describe("photoSlotChallenge", () => {
  it("maps the certificate slots to the arrival sign, the run and the return boarding", () => {
    expect(photoSlotChallenge(challenges, 0)?.sequence).toBe(2);
    expect(photoSlotChallenge(challenges, 1)?.sequence).toBe(3);
    expect(photoSlotChallenge(challenges, 2)?.sequence).toBe(11);
  });
  it("does not confuse the Malmesbury boarding with the return", () => {
    const outbound = challenges.find((c) => c.sequence === 1)!;
    expect(/Malmesbury/.test(outbound.title)).toBe(true);
    expect(photoSlotChallenge(challenges, 2)?.id).not.toBe(outbound.id);
  });
  it("returns undefined for an unknown slot or an empty programme", () => {
    expect(photoSlotChallenge(challenges, 3)).toBeUndefined();
    expect(photoSlotChallenge([], 1)).toBeUndefined();
  });
});

describe("programme", () => {
  it("has eleven challenges worth exactly 100 points", () => {
    expect(programme.challenges).toHaveLength(11);
    expect(programme.challenges.reduce((n, c) => n + c.points, 0)).toBe(100);
    expect(programme.challenges.map((c) => c.sequence)).toEqual(Array.from({ length: 11 }, (_, i) => i + 1));
  });
});
