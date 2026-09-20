import { describe, expect, it } from "vitest";
import { latestFor, leagueStatusLabel, statusHeading, statusLabel } from "./evidence-status";

const sub = (status: string, version: number, challenge_id = "c1") => ({ challenge_id, press_prompt_id: null, status, version });

describe("latestFor", () => {
  it("returns the first (newest) submission for the key and null otherwise", () => {
    const subs = [sub("approved", 2), sub("superseded", 1), sub("submitted", 1, "c2")];
    expect(latestFor(subs, { challengeId: "c1" })?.version).toBe(2);
    expect(latestFor(subs, { challengeId: "c2" })?.status).toBe("submitted");
    expect(latestFor(subs, { challengeId: "c3" })).toBeNull();
    expect(latestFor(subs, { pressPromptId: "p1" })).toBeNull();
  });
});

describe("statusLabel", () => {
  it("describes every state for the participant", () => {
    expect(statusLabel(null)).toBe("Draft · No proof submitted");
    expect(statusLabel(sub("draft", 1))).toBe("Draft v1 · not yet submitted");
    expect(statusLabel(sub("submitted", 2))).toBe("Submitted v2 · pending review");
    expect(statusLabel(sub("approved", 2), 10)).toBe("Approved · +10 points");
    expect(statusLabel(sub("flagged", 3))).toBe("Flagged v3 · needs more proof");
    expect(statusLabel(sub("superseded", 1))).toBe("Superseded v1");
  });
});

describe("leagueStatusLabel", () => {
  it("never mentions a draft to the league", () => {
    expect(leagueStatusLabel(null)).toBe("No proof submitted yet");
    expect(leagueStatusLabel(sub("draft", 1))).toBe("No proof submitted yet");
    expect(leagueStatusLabel(sub("draft", 1))).not.toMatch(/draft/i);
  });

  it("reads the reviewed states the same way the scoreboard does", () => {
    expect(leagueStatusLabel(sub("submitted", 2))).toBe("Submitted v2 · with the commissioner");
    expect(leagueStatusLabel(sub("approved", 2), 10)).toBe("Approved · +10 points");
    expect(leagueStatusLabel(sub("approved", 2))).toBe("Approved");
    expect(leagueStatusLabel(sub("flagged", 3))).toBe("Flagged v3 · sent back for more proof");
    expect(leagueStatusLabel(sub("superseded", 1))).toBe("Superseded v1");
  });
});

describe("statusHeading", () => {
  it("maps each status to its pill text", () => {
    expect(statusHeading("submitted")).toBe("Pending review");
    expect(statusHeading("approved")).toBe("Approved");
    expect(statusHeading("flagged")).toBe("Flagged");
    expect(statusHeading("superseded")).toBe("Superseded");
    expect(statusHeading("draft")).toBe("Draft");
  });
});
