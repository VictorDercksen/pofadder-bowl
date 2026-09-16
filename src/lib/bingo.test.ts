import { describe, expect, it } from "vitest";
import { completedLines, markedCellsFor, shuffledLayout, winningCells } from "./bingo";

describe("bingo line detection", () => {
  it("detects rows, columns and both diagonals", () => {
    expect(completedLines([0, 1, 2, 3, 4])).toEqual(["row0"]);
    expect(completedLines([2, 7, 12, 17, 22])).toEqual(["col2"]);
    expect(completedLines([0, 6, 12, 18, 24])).toEqual(["diag_main"]);
    expect(completedLines([4, 8, 12, 16, 20])).toEqual(["diag_anti"]);
  });
  it("reports nothing for four in a row", () => {
    expect(completedLines([0, 1, 2, 3])).toEqual([]);
  });
  it("reports full house together with every line", () => {
    const all = Array.from({ length: 25 }, (_, i) => i);
    const lines = completedLines(all);
    expect(lines).toHaveLength(13);
    expect(lines).toContain("full_house");
  });
  it("winning cells exclude the full-house pseudo line", () => {
    expect([...winningCells([0, 1, 2, 3, 4, 9])].sort()).toEqual([0, 1, 2, 3, 4]);
  });
  it("maps confirmed square positions to card cells through the layout", () => {
    const layout = shuffledLayout(42);
    expect(layout).toHaveLength(25);
    expect(layout[12]).toBe(12);
    expect(new Set(layout).size).toBe(25);
    const confirmed = [layout[0], layout[1], layout[2], layout[3], layout[4], 12];
    expect(markedCellsFor(layout, confirmed)).toEqual([0, 1, 2, 3, 4, 12]);
    expect(completedLines(markedCellsFor(layout, confirmed))).toEqual(["row0"]);
  });
  it("shuffle is deterministic per seed", () => {
    expect(shuffledLayout(7)).toEqual(shuffledLayout(7));
    expect(shuffledLayout(7)).not.toEqual(shuffledLayout(8));
  });
});
