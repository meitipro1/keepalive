import { day, gen, short, when } from "@/lib/format";
import type { PeriodRow, StreamDetail } from "@/lib/types";
import { CellMark } from "./Pulse";
import { Seal } from "./Seal";

function span(stream: StreamDetail, p: PeriodRow): string {
  return stream.demo ? `${when(p.start, true)} to ${when(p.end, true)}` : `${day(p.start)} to ${day(p.end - 1)}`;
}

/** One period in the check-in feed: the builder's words, the links, the autolink, and the validators' reason, together. */
export function PeriodItem({ stream, period, now }: { stream: StreamDetail; period: PeriodRow; now: number }) {
  const open = period.cell === "C" || period.cell === "G";
  const status =
    period.cell === "C"
      ? `report window open · check after ${when(period.end, stream.demo)}`
      : period.cell === "G"
        ? `ended · report possible until ${when(period.grace_end, stream.demo)}`
        : period.cell === "P"
          ? "reported · waiting for its check"
          : period.cell === "R"
            ? `unreadable · recheck open until ${when(period.grace_end, stream.demo)}`
            : period.cell === "N"
              ? "no report · lapse due"
              : "";
  return (
    <article className="stack" style={{ gap: 10 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="row" style={{ gap: 10 }}>
          <CellMark cell={period.cell} w={10} h={16} />
          <strong style={{ fontWeight: 600 }}>Period {period.number}</strong>
          <span className="hint">{span(stream, period)}</span>
          {status ? <span className="hint">· {status}</span> : null}
        </div>
        {period.released && period.released !== "0" ? (
          <span className="amount green" style={{ fontSize: 13.5 }}>
            {gen(period.released, 2)} GEN released
          </span>
        ) : null}
      </div>
      {period.summary ? (
        <p className="body" style={{ fontSize: 14.5 }}>
          {period.summary}
        </p>
      ) : open ? null : period.status === "LAPSED" ? null : (
        <p className="hint">No report was posted.</p>
      )}
      {period.links.length || period.autolinks.length ? (
        <div className="links">
          {period.links.map((link) => (
            <a key={link} href={link} target="_blank" rel="noreferrer nofollow">
              {link.replace(/^https?:\/\//, "")}
            </a>
          ))}
          {period.autolinks.map((link) => (
            <a key={link} href={link} target="_blank" rel="noreferrer nofollow">
              <span className="chip" style={{ height: 18, marginRight: 8 }}>
                AUTO
              </span>
              {link.replace(/^https?:\/\//, "")}
            </a>
          ))}
        </div>
      ) : null}
      {period.status === "CHECKED" || period.status === "LAPSED" || period.status === "RECHECK" ? (
        <div className="stack" style={{ gap: 6 }}>
          <div className="row" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
            <Seal verdict={period.status === "LAPSED" ? "LAPSED" : period.verdict} />
            <span className="body" style={{ fontSize: 14.5 }}>
              {period.reason}
            </span>
          </div>
          {period.status === "RECHECK" ? (
            <span className="hint">No strike. The builder may swap links once; the recheck then runs.</span>
          ) : null}
          {period.first_reason && period.status === "CHECKED" && period.first_reason !== period.reason ? (
            <span className="hint">First check read nothing: {period.first_reason}</span>
          ) : null}
          <span className="hint">
            {period.status === "LAPSED" ? "Recorded" : "Checked"} {period.checked_at ? when(period.checked_at, stream.demo) : ""}
            {period.checker ? ` by ${short(period.checker)}` : ""}
            {period.pages ? ` · ${period.readable} of ${period.pages} pages readable` : ""}
          </span>
        </div>
      ) : null}
      {period.cell === "P" && now >= period.end ? <Seal verdict="" pending /> : null}
    </article>
  );
}
