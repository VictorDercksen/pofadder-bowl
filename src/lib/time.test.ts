import { describe, expect, it } from "vitest";
import { ageLabel, countdown, eventPhase, formatDateTime, formatTime, isStale, secondsToClock } from "./time";

const times = {
  timezone: "Africa/Johannesburg",
  departure_at: "2026-09-23T17:15:00Z", // 19:15 SAST
  away_arrival_at: "2026-09-24T02:45:00Z", // 04:45 SAST
  return_departure_at: "2026-09-24T20:30:00Z", // 22:30 SAST
  home_arrival_at: "2026-09-25T05:35:00Z", // 07:35 SAST
};

describe("event phase from configured dates", () => {
  it("walks through all phases", () => {
    expect(eventPhase(times, new Date("2026-09-16T10:00:00Z"))).toBe("pregame");
    expect(eventPhase(times, new Date("2026-09-23T17:15:00Z"))).toBe("q1");
    expect(eventPhase(times, new Date("2026-09-24T03:00:00Z"))).toBe("q2");
    expect(eventPhase(times, new Date("2026-09-24T08:35:00Z"))).toBe("q3"); // 10:35 SAST
    expect(eventPhase(times, new Date("2026-09-24T16:00:00Z"))).toBe("q4"); // 18:00 SAST
    expect(eventPhase(times, new Date("2026-09-25T06:00:00Z"))).toBe("postgame");
  });
  it("formats SAST regardless of machine timezone", () => {
    expect(formatTime(times.departure_at, times.timezone)).toBe("19:15");
    expect(formatTime(times.home_arrival_at, times.timezone)).toBe("07:35");
  });
});

describe("countdown and staleness", () => {
  it("counts down to the return bus", () => {
    expect(countdown(times.return_departure_at, new Date("2026-09-24T08:35:00Z"))).toBe("11 h 55 m");
    expect(countdown(times.return_departure_at, new Date("2026-09-24T20:31:00Z"))).toBe("");
  });
  it("flags check-ins older than 30 minutes", () => {
    expect(isStale("2026-09-24T08:00:00Z", 30, new Date("2026-09-24T08:29:00Z"))).toBe(false);
    expect(isStale("2026-09-24T08:00:00Z", 30, new Date("2026-09-24T08:31:00Z"))).toBe(true);
  });
  it("formats clock strings", () => {
    expect(secondsToClock(5700)).toBe("1:35:00");
    expect(secondsToClock(605)).toBe("10:05");
  });
});

describe("unparseable instants fail closed", () => {
  it("never reports the sentence as served from a broken event row", () => {
    expect(eventPhase({ ...times, away_arrival_at: "" }, new Date("2026-09-23T18:00:00Z"))).toBe("pregame");
    expect(eventPhase({ ...times, departure_at: "not a date" }, new Date("2026-09-25T06:00:00Z"))).toBe("pregame");
  });
  it("renders a dash instead of throwing or printing NaN", () => {
    expect(formatTime("", times.timezone)).toBe("—");
    expect(formatDateTime("garbage", times.timezone)).toBe("—");
    expect(countdown("", new Date("2026-09-24T08:35:00Z"))).toBe("");
    expect(ageLabel("", new Date("2026-09-24T08:35:00Z"))).toBe("unknown");
    expect(isStale("", 30, new Date("2026-09-24T08:35:00Z"))).toBe(true);
  });
  it("clamps clock strings", () => {
    expect(secondsToClock(-5)).toBe("0:00");
    expect(secondsToClock(90.5)).toBe("1:31");
    expect(secondsToClock(Number.NaN)).toBe("0:00");
  });
});
