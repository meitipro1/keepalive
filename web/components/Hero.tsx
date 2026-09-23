import Link from "next/link";

import { day, gen, initials, short, span, when } from "@/lib/format";
import type { StreamRow } from "@/lib/types";
import { PulseStrip } from "./Pulse";
import { Seal, StatusChips } from "./Seal";

/** A real stream, as the hero shows it: its whole recent history in one row, and the last verdict with its reason. */
export function HeroStream({ stream }: { stream: StreamRow }) {
  const firstK = stream.current_k - stream.pulse.length + 1;
  const firstStart = stream.start + Math.max(0, firstK) * stream.period_s;
  const alivePeriods = stream.pulse.split("").filter((c) => c === "A").length;
  const judged = stream.pulse.split("").filter((c) => "AQOUL".includes(c)).length;
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
        <PulseStrip cells={stream.pulse} firstNumber={Math.max(1, firstK + 1)} size="lg" />
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span className="label">
            P{Math.max(1, firstK + 1)} {day(firstStart)}
          </span>
          <span className="label">P{stream.current_k + 1} now</span>
        </div>
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
