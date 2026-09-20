import { describe, expect, it } from "vitest";
import { TOAST_LIMIT, pushToast, removeToast, toastDuration, type Toast } from "./toasts";

const make = (id: number, text: string, tone: Toast["tone"] = "ok"): Toast => ({ id, text, tone, duration: toastDuration(tone, text) });

describe("toastDuration", () => {
  it("gives errors longer than warnings, and warnings longer than confirmations", () => {
    expect(toastDuration("ok", "Saved.")).toBeLessThan(toastDuration("warn", "Saved."));
    expect(toastDuration("warn", "Saved.")).toBeLessThan(toastDuration("error", "Saved."));
  });

  it("stretches for long copy and caps at 12 s", () => {
    const short = toastDuration("ok", "Saved.");
    const long = toastDuration("ok", "x".repeat(120));
    expect(long).toBeGreaterThan(short);
    expect(toastDuration("error", "x".repeat(2000))).toBe(12000);
  });
});

describe("pushToast", () => {
  it("appends newest last", () => {
    const list = pushToast([make(1, "One")], make(2, "Two"));
    expect(list.map((t) => t.id)).toEqual([1, 2]);
  });

  it("replaces a snack with the same text and tone instead of doubling it", () => {
    const list = pushToast([make(1, "Saved."), make(2, "Other")], make(3, "Saved."));
    expect(list.map((t) => t.id)).toEqual([2, 3]);
  });

  it("keeps the same text in a different tone", () => {
    const list = pushToast([make(1, "Saved.", "ok")], make(2, "Saved.", "error"));
    expect(list).toHaveLength(2);
  });

  it("drops the oldest beyond the limit", () => {
    let list: Toast[] = [];
    for (let i = 1; i <= TOAST_LIMIT + 2; i++) list = pushToast(list, make(i, `Snack ${i}`));
    expect(list).toHaveLength(TOAST_LIMIT);
    expect(list[0].id).toBe(3);
    expect(list[list.length - 1].id).toBe(TOAST_LIMIT + 2);
  });
});

describe("removeToast", () => {
  it("removes by id and leaves the rest in order", () => {
    const list = removeToast([make(1, "One"), make(2, "Two"), make(3, "Three")], 2);
    expect(list.map((t) => t.id)).toEqual([1, 3]);
  });

  it("returns an equal list for an unknown id", () => {
    expect(removeToast([make(1, "One")], 9)).toEqual([make(1, "One")]);
  });
});
