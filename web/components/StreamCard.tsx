import Link from "next/link";

import { gen, initials, span } from "@/lib/format";
import type { StreamRow } from "@/lib/types";
import { PulseStrip } from "./Pulse";
import { StatusChips } from "./Seal";

/** The card every list uses: badge, title, status, mission, pulse, and the three numbers that matter. */
export function StreamCard({ stream }: { stream: StreamRow }) {
  const first = stream.current_k + 1 - stream.pulse.length + 1;
  return (
    <Link href={`/s/${stream.sid}`} className="card" aria-label={`${stream.title}, ${stream.status}`}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", flexWrap: "nowrap" }}>
        <div className="row" style={{ flexWrap: "nowrap", minWidth: 0 }}>
          <span className="badge">{initials(stream.title)}</span>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{stream.title}</h3>
            <div className="hint">{span(stream.period_s)} periods</div>
          </div>
        </div>
        <StatusChips stream={stream} />
      </div>
      <p className="body clamp-2" style={{ fontSize: 14.5 }}>
        {stream.mission}
      </p>
      <PulseStrip cells={stream.pulse} firstNumber={Math.max(1, first)} />
      <div className="row" style={{ gap: "6px 18px", fontSize: 13.5 }}>
        <span>
          <span className="amount">{gen(stream.pool, 0)}</span> <span className="muted">pool</span>
        </span>
        <span>
          <span className="amount">{gen(stream.tranche, 2)}</span> <span className="muted">/ period</span>
        </span>
        <span>
          <span className="amount">{stream.streak}</span> <span className="muted">streak</span>
        </span>
        <span>
          <span className="amount">{stream.patrons}</span> <span className="muted">patrons</span>
        </span>
      </div>
    </Link>
  );
}
