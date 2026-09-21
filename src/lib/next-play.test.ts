import { describe, expect, it } from "vitest";
import { nextPlay } from "./next-play";

const challenges = [1, 2, 3].map((sequence) => ({ id: String(sequence), sequence }));
const sub = (challenge_id: string, status: string, version = 1) => ({ challenge_id, status, version });

describe("next actionable play", () => {
  it("skips pending proof when the next challenge needs work", () => {
    expect(nextPlay(challenges, [sub("1", "submitted")])?.challenge.id).toBe("2");
  });
  it("prioritises flags, then drafts, over programme order", () => {
    expect(nextPlay(challenges, [sub("2", "draft"), sub("3", "flagged")])?.challenge.id).toBe("3");
    expect(nextPlay(challenges, [sub("2", "draft")])?.challenge.id).toBe("2");
  });
  it("uses the latest version even when input is unsorted", () => {
    expect(nextPlay(challenges, [sub("1", "flagged"), sub("1", "approved", 2)])?.challenge.id).toBe("2");
  });
  it("offers viewing pending proof only when no actionable work remains", () => {
    expect(nextPlay(challenges, [sub("1", "approved"), sub("2", "submitted"), sub("3", "approved")])).toEqual({ challenge: challenges[1], pending: true });
    expect(nextPlay(challenges, challenges.map((c) => sub(c.id, "approved")))).toBeNull();
  });
});
