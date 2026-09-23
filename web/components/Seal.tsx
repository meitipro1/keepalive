import type { StreamRow } from "@/lib/types";

const SEAL: Record<string, string> = {
  ALIVE: "alive",
  QUIET: "quiet",
  OFF_MISSION: "off",
  UNREADABLE: "unreadable",
  LAPSED: "lapsed",
};

/** A verdict as a seal. Only ALIVE is filled, and only ALIVE is green. */
export function Seal({ verdict, pending }: { verdict: string; pending?: boolean }) {
  if (!verdict) return <span className="seal pending">{pending ? "WAITING" : "NO REPORT"}</span>;
  return <span className={`seal ${SEAL[verdict] ?? ""}`}>{verdict === "OFF_MISSION" ? "OFF MISSION" : verdict}</span>;
}

/** A stream's state as chips: its status, the last verdict when it was alive, and DEMO. */
export function StatusChips({ stream }: { stream: Pick<StreamRow, "status" | "demo" | "last" | "period_s"> }) {
  const alive = stream.status === "ACTIVE" && stream.last?.verdict === "ALIVE";
  return (
    <span className="row" style={{ gap: 6 }}>
      {alive ? <span className="chip alive">ALIVE</span> : <span className="chip quiet">{stream.status}</span>}
      {stream.demo ? <span className="chip">DEMO · {Math.round(stream.period_s / 60)} MIN PERIODS</span> : null}
    </span>
  );
}
