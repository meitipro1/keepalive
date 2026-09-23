/**
 * The pulse strip: the product in one glance. One cell per period, read left to
 * right, oldest first.
 *
 *   A alive, filled green, a tranche released   Q quiet, hollow, held
 *   O off mission, hatched                      U unreadable, dotted, no strike
 *   L lapsed, struck through                    R unreadable, recheck open
 *   P reported, waiting for its check           G ended, grace open, no report
 *   N ended, no report, lapse due               C in progress, dashed
 *
 * Green is spent on A alone. Everything else is a shade of grey, because a
 * quiet period is information, not an alarm.
 */

import type { Cell } from "@/lib/types";

const WORDS: Record<Cell, string> = {
  A: "alive, tranche released",
  Q: "quiet, tranche held",
  O: "off mission, tranche held",
  U: "unreadable, no strike",
  L: "lapsed, no report",
  R: "unreadable, one recheck open",
  P: "reported, waiting for its check",
  G: "ended, report still possible in grace",
  N: "ended with no report, lapse due",
  C: "in progress",
};

const MUTED = "#7C8798";
const LINE = "#283042";
const TEXT = "#EEF3F8";
const GREEN = "#4ADE80";

export function CellMark({ cell, w = 14, h = 22 }: { cell: Cell; w?: number; h?: number }) {
  const inset = 0.5;
  const box = { x: inset, y: inset, width: w - 1, height: h - 1, rx: 2 };
  const id = `hatch-${w}-${h}`;
  switch (cell) {
    case "A":
      return (
        <svg width={w} height={h} aria-hidden>
          <rect {...box} fill={GREEN} stroke={GREEN} />
        </svg>
      );
    case "Q":
      return (
        <svg width={w} height={h} aria-hidden>
          <rect {...box} fill="none" stroke={MUTED} />
        </svg>
      );
    case "O":
      return (
        <svg width={w} height={h} aria-hidden>
          <defs>
            <pattern id={id} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="4" stroke={MUTED} strokeWidth="1.2" />
            </pattern>
          </defs>
          <rect {...box} fill={`url(#${id})`} stroke={MUTED} />
        </svg>
      );
    case "U":
      return (
        <svg width={w} height={h} aria-hidden>
          <rect {...box} fill="none" stroke={MUTED} strokeDasharray="1 2" />
        </svg>
      );
    case "R":
      return (
        <svg width={w} height={h} aria-hidden>
          <rect {...box} fill="none" stroke={MUTED} strokeDasharray="1 2" />
          <circle cx={w / 2} cy={h / 2} r="1.6" fill={TEXT} />
        </svg>
      );
    case "L":
      return (
        <svg width={w} height={h} aria-hidden>
          <rect {...box} fill="none" stroke={LINE} />
          <line x1={1.5} y1={h - 1.5} x2={w - 1.5} y2={1.5} stroke={MUTED} strokeWidth="1.2" />
        </svg>
      );
    case "N":
      return (
        <svg width={w} height={h} aria-hidden>
          <rect {...box} fill="none" stroke={MUTED} strokeDasharray="3 2" />
          <line x1={1.5} y1={h - 1.5} x2={w - 1.5} y2={1.5} stroke={MUTED} strokeWidth="1" />
        </svg>
      );
    case "G":
      return (
        <svg width={w} height={h} aria-hidden>
          <rect {...box} fill="none" stroke={LINE} strokeDasharray="3 2" />
        </svg>
      );
    case "P":
      return (
        <svg width={w} height={h} aria-hidden>
          <rect {...box} fill="none" stroke={TEXT} strokeDasharray="3 2" />
          <rect x={3} y={h - 5} width={w - 6} height={1.5} fill={TEXT} />
        </svg>
      );
    default:
      return (
        <svg width={w} height={h} aria-hidden>
          <rect {...box} fill="none" stroke={MUTED} strokeDasharray="3 2" />
        </svg>
      );
  }
}

/**
 * A strip. `cells` is the contract's pulse string; `firstNumber` is the period
 * number of its first cell, so a hover says "Period 7".
 */
export function PulseStrip({
  cells,
  firstNumber = 1,
  size = "md",
  label,
}: {
  cells: string;
  firstNumber?: number;
  size?: "sm" | "md" | "lg";
  label?: string;
}) {
  const dims = size === "lg" ? { w: 18, h: 34, gap: 5 } : size === "sm" ? { w: 9, h: 16, gap: 3 } : { w: 13, h: 22, gap: 4 };
  const list = cells.split("") as Cell[];
  const summary = label ?? `Pulse: ${list.map((c, i) => `period ${firstNumber + i} ${WORDS[c] ?? c}`).join("; ")}`;
  return (
    <div role="img" aria-label={summary} style={{ display: "flex", flexWrap: "wrap", gap: dims.gap }}>
      {list.map((cell, index) => (
        <span key={index} title={`Period ${firstNumber + index}: ${WORDS[cell] ?? cell}`} style={{ display: "inline-flex" }}>
          <CellMark cell={cell} w={dims.w} h={dims.h} />
        </span>
      ))}
    </div>
  );
}

export function PulseLegend({ cells = "AQOULC" }: { cells?: string }) {
  const names: Record<string, string> = {
    A: "alive",
    Q: "quiet",
    O: "off mission",
    U: "unreadable",
    L: "lapsed",
    R: "recheck open",
    P: "waiting for check",
    G: "in grace",
    N: "lapse due",
    C: "in progress",
  };
  return (
    <div className="row" style={{ gap: "8px 16px" }}>
      {cells.split("").map((cell) => (
        <span key={cell} className="row" style={{ gap: 6 }}>
          <CellMark cell={cell as Cell} w={9} h={14} />
          <span className="label" style={{ letterSpacing: "0.06em" }}>
            {names[cell]}
          </span>
        </span>
      ))}
    </div>
  );
}

/** The wordmark's glyph: a pulse with one filled cell. */
export function Glyph({ size = 18 }: { size?: number }) {
  return (
    <svg width={size * 1.4} height={size} viewBox="0 0 28 20" aria-hidden>
      <rect x="0.5" y="6.5" width="5" height="9" rx="1" fill="none" stroke={MUTED} />
      <rect x="7.5" y="3.5" width="5" height="13" rx="1" fill="none" stroke={MUTED} />
      <rect x="14.5" y="0.5" width="5" height="19" rx="1" fill={GREEN} stroke={GREEN} />
      <rect x="21.5" y="5.5" width="5" height="10" rx="1" fill="none" stroke={MUTED} strokeDasharray="2 1.5" />
    </svg>
  );
}
