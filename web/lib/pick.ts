import type { StreamRow } from "./types";

/**
 * The stream the hero shows: an open stream before a paused one, then the
 * longest record of alive periods, then a real stream before a DEMO one.
 */
export function heroStream(rows: StreamRow[]): StreamRow | undefined {
  return [...rows]
    .filter((row) => row.status !== "CLOSED")
    .sort(
      (a, b) =>
        Number(b.status === "ACTIVE") - Number(a.status === "ACTIVE") ||
        b.alive - a.alive ||
        Number(a.demo) - Number(b.demo) ||
        b.periods - a.periods ||
        b.sid - a.sid,
    )[0];
}

/** The latest resolved period of every stream, newest first: ALIVE, QUIET, OFF MISSION and lapses alike. */
export function recentChecks(rows: StreamRow[], limit = 8): StreamRow[] {
  return rows
    .filter((row) => row.last && row.last.verdict)
    .sort((a, b) => b.last.at - a.last.at)
    .slice(0, limit);
}

/** Six streams for the front page, open ones first, by pool. */
export function featured(rows: StreamRow[], limit = 6): StreamRow[] {
  return [...rows]
    .sort(
      (a, b) =>
        Number(a.status === "CLOSED") - Number(b.status === "CLOSED") ||
        (BigInt(b.pool) > BigInt(a.pool) ? 1 : BigInt(b.pool) < BigInt(a.pool) ? -1 : 0) ||
        b.alive - a.alive,
    )
    .slice(0, limit);
}
