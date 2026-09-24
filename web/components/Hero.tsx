import Link from "next/link";

import { day, gen, initials, short, span, when } from "@/lib/format";
import { trimmed } from "@/lib/pulse";
import type { PeriodRow, StreamDetail, StreamRow } from "@/lib/types";
import { PulseStrip } from "./Pulse";
import { Seal, StatusChips } from "./Seal";

/**
 * A real stream, as the hero shows it: its history in one row, and the last
 * verdict with its reason. With the stream's full history (`detail`), the
 * strip runs to the last period that has a record, and the periods that have
 * gone unreported since are counted in words rather than drawn.
 */
export function HeroStream({ stream, detail, record }: { stream: StreamRow; detail?: StreamDetail; record?: PeriodRow[] }) {
  let shown: string;
  let firstK: number;
  let unreported: number;
  if (record && record.length) {
    // The recent window holds no record at all: draw the resolved periods themselves.
    shown = record.map((p) => p.cell).join("");
    firstK = record[0].k;
    unreported = stream.current_k - record[record.length - 1].k;
  } else {
    const cells = detail?.history ?? stream.pulse;
    firstK = Math.max(0, stream.current_k - cells.length + 1);
    ({ shown, unreported } = trimmed(cells));
  }
  const lastShownK = firstK + shown.length - 1;
  const alivePeriods = stream.alive;
  const judged = stream.alive + stream.quiet + stream.off_mission + stream.unreadable + stream.lapsed;
  return (
    <Link href={`/s/${stream.sid}`} className="card" style={{ gap: 18, padding: 22 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div className="row" style={{ flexWrap: "nowrap", minWidth: 0 }}>
          <span className="badge">{initials(stream.title)}</span>
          <div style={{ minWidth: 0 }}>
            <h3>{stream.title}</h3>
            <div className="hint clamp-2">
              {stream.mission.length > 90 ? stream.mission.slice(0, 88) + "..." : stream.mission} · {span(stream.period_s)} periods
            </div>
          </div>
        </div>
        <StatusChips stream={stream} />
      </div>
      <div className="stack" style={{ gap: 8 }}>
        <PulseStrip cells={shown} firstNumber={firstK + 1} size="lg" />
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span className="label">
            P{firstK + 1} {day(stream.start + firstK * stream.period_s)}
          </span>
          <span className="label">{unreported ? `P${lastShownK + 1}` : `P${stream.current_k + 1} now`}</span>
        </div>
        {unreported ? (
          <span className="hint">
            Then {unreported} period{unreported === 1 ? "" : "s"} with no report, up to now. On a DEMO stream a period is ten minutes, so
            they add up fast once its builder stops reporting.
          </span>
        ) : null}
      </div>
      <div className="grid grid-4" style={{ gap: 12 }}>
        <div className="stat">
          <div className="n">{gen(stream.pool, 0)}</div>
          <div className="label">GEN in pool</div>
        </div>
        <div className="stat">
          <div className="n">{gen(stream.tranche, 2)}</div>
          <div className="label">GEN per period</div>
        </div>
        <div className="stat">
          <div className="n">
            {alivePeriods} / {judged}
          </div>
          <div className="label">periods alive</div>
        </div>
        <div className="stat">
          <div className="n">{stream.patrons}</div>
          <div className="label">patrons</div>
        </div>
      </div>
      {stream.last.verdict ? (
        <div className="stack" style={{ gap: 8, borderTop: "1px solid var(--line-soft)", paddingTop: 14 }}>
          <div className="row" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
            <Seal verdict={stream.last.verdict} />
            <span className="body" style={{ fontSize: 14.5 }}>
              {stream.last.reason}
            </span>
          </div>
          <span className="hint">
            Period {stream.last.k + 1} · checked {when(stream.last.at, stream.demo)} · builder {short(stream.owner)}
          </span>
        </div>
      ) : (
        <span className="hint">No period has been checked yet.</span>
      )}
    </Link>
  );
}
