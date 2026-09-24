/**
 * Reading a pulse string for display. No chain imports.
 *
 * A DEMO stream's periods are ten minutes long and keep coming whether anyone
 * reports or not, so a few hours after its builder stops, its last twelve
 * cells are all "ended, no report" and everything it did has scrolled out of a
 * twelve-cell strip. Trimming shows the record up to the last period that has
 * one, and says in words how many periods have gone unreported since. Nothing
 * is hidden: the count is always shown.
 */

/** Cells that carry a record: a verdict, a lapse, a recheck, or a report waiting for its check. */
const RECORDED = new Set(["A", "Q", "O", "U", "L", "R", "P"]);

export function hasRecord(cells: string): boolean {
  return cells.split("").some((cell) => RECORDED.has(cell));
}

/**
 * The cells to draw and how many trailing unreported periods were left out.
 * A run of at most three unreported periods is shown as it is.
 */
export function trimmed(cells: string): { shown: string; unreported: number } {
  let last = -1;
  for (let i = cells.length - 1; i >= 0; i--) {
    if (RECORDED.has(cells[i])) {
      last = i;
      break;
    }
  }
  const tail = cells.length - (last + 1);
  if (last < 0 || tail <= 3) return { shown: cells, unreported: 0 };
  return { shown: cells.slice(0, last + 1), unreported: tail };
}
