/**
 * Pure bingo helpers shared by the demo store, the UI and tests.
 * Mirrors public.bingo_lines() in the database.
 */

export const BINGO_LINES: Record<string, number[]> = (() => {
  const lines: Record<string, number[]> = {};
  for (let r = 0; r < 5; r++) lines[`row${r}`] = Array.from({ length: 5 }, (_, c) => r * 5 + c);
  for (let c = 0; c < 5; c++) lines[`col${c}`] = Array.from({ length: 5 }, (_, r) => r * 5 + c);
  lines.diag_main = [0, 6, 12, 18, 24];
  lines.diag_anti = [4, 8, 12, 16, 20];
  lines.full_house = Array.from({ length: 25 }, (_, i) => i);
  return lines;
})();

/** Returns the keys of all complete lines for a set of marked card-cell indexes (0..24). */
export function completedLines(markedCells: Iterable<number>): string[] {
  const marked = new Set(markedCells);
  return Object.entries(BINGO_LINES)
    .filter(([, cells]) => cells.every((c) => marked.has(c)))
    .map(([key]) => key);
}

/** Card-cell indexes covered by any completed (non full-house) line. */
export function winningCells(markedCells: Iterable<number>): Set<number> {
  const out = new Set<number>();
  for (const key of completedLines(markedCells)) {
    if (key === "full_house") continue;
    for (const c of BINGO_LINES[key]) out.add(c);
  }
  return out;
}

/**
 * Given a card layout (cell -> square position) and the confirmed square positions,
 * return the marked cell indexes.
 */
export function markedCellsFor(layout: number[], confirmedPositions: Iterable<number>): number[] {
  const confirmed = new Set(confirmedPositions);
  const cells: number[] = [];
  layout.forEach((pos, cell) => {
    if (confirmed.has(pos)) cells.push(cell);
  });
  return cells;
}

/** Deterministic shuffle for demo layouts (not used for production cards, which are created server-side). */
export function shuffledLayout(seed: number): number[] {
  let s = seed >>> 0 || 1;
  const rnd = () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
  const positions = Array.from({ length: 25 }, (_, i) => i).filter((p) => p !== 12);
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }
  positions.splice(12, 0, 12);
  return positions;
}
