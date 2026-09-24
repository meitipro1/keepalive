import Link from "next/link";
import { notFound } from "next/navigation";

import { PeriodItem } from "@/components/PeriodItem";
import { PulseLegend, PulseStrip } from "@/components/Pulse";
import { StatusChips } from "@/components/Seal";
import { CheckPanel, PositionPanel } from "@/components/StreamLive";
import { addressUrl } from "@/lib/deployment";
import { day, gen, initials, short, span, when } from "@/lib/format";
import { hasRecord, trimmed } from "@/lib/pulse";
import { attempt, currentPeriod, getStream, resolvedRecord } from "@/lib/read";
import { githubRepo } from "@/lib/sources";
import type { PeriodRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: `Stream ${id} · Keepalive` };
}

export default async function StreamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sid = Number(id);
  if (!Number.isInteger(sid) || sid < 1) notFound();
  const [streamRead, currentRead] = await Promise.all([attempt(() => getStream(sid)), attempt(() => currentPeriod(sid))]);
  if (!streamRead.ok) {
    if (/unknown stream/.test(streamRead.error)) notFound();
    return (
      <section className="wrap" style={{ padding: "48px 0" }}>
        <div className="banner">
          <strong>This stream could not be read just now.</strong> {streamRead.error}
        </div>
      </section>
    );
  }
  const stream = streamRead.data;
  const current = currentRead.ok ? currentRead.data : null;
  const judged = stream.alive + stream.quiet + stream.off_mission + stream.unreadable + stream.lapsed;
  const repo = githubRepo(stream.sources, []);
  const ownerOnly = stream.sources.some((s) => s.startsWith("github.com/")) && !repo;

  // A DEMO stream keeps ticking every ten minutes after its builder stops, so
  // its recent window can hold nothing but unreported periods. Then the page
  // reads the resolved periods themselves and counts the rest in words.
  const recentHasRecord = stream.recent_periods.some((p) => p.status !== "");
  let record: PeriodRow[] = [];
  if (!hasRecord(stream.history) && !recentHasRecord && stream.next_k > 0) {
    const read = await attempt(() => resolvedRecord(sid, stream.next_k));
    if (read.ok) record = read.data;
  }
  const historyFirstK = Math.max(0, stream.current_k - stream.history.length + 1);
  const strip = record.length
    ? { cells: record.map((p) => p.cell).join(""), firstK: record[0].k, unreported: stream.current_k - record[record.length - 1].k }
    : (() => {
        const t = trimmed(stream.history);
        return { cells: t.shown, firstK: historyFirstK, unreported: t.unreported };
      })();
  const feed = record.length ? [...record].reverse() : stream.recent_periods;

  return (
    <section style={{ padding: "40px 0 72px" }}>
      <div className="wrap stack" style={{ gap: 24 }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <div className="row" style={{ flexWrap: "nowrap", alignItems: "flex-start", minWidth: 0 }}>
            <span className="badge" style={{ width: 44, height: 44, fontSize: 14 }}>
              {initials(stream.title)}
            </span>
            <div className="stack" style={{ gap: 4, minWidth: 0 }}>
              <h1 style={{ fontSize: "clamp(30px,4vw,42px)" }}>{stream.title}</h1>
              <span className="hint">
                by{" "}
                <a href={addressUrl(stream.owner)} target="_blank" rel="noreferrer" className="mono">
                  {short(stream.owner)}
                </a>{" "}
                · opened {when(stream.opened_at, stream.demo)} · {span(stream.period_s)} periods · {span(stream.grace_s)} grace
              </span>
            </div>
          </div>
          <div className="row">
            <StatusChips stream={stream} />
            <span className="chip">
              {stream.alive} OF {judged} ALIVE
            </span>
            <span className="chip">STRIKES {stream.strikes}</span>
            <Link href="#fund" className="btn small solid">
              Fund this stream
            </Link>
          </div>
        </div>

        {stream.status === "PAUSED" ? (
          <div className="banner">
            <strong>Paused.</strong> Two quiet, off mission or lapsed periods in a row paused this stream. It takes no new deposits,
            and the first alive check lifts it without releasing that period&apos;s tranche. Patrons can exit at any time.
          </div>
        ) : null}
        {stream.status === "CLOSED" ? (
          <div className="banner">
            <strong>Closed {when(stream.closed_at, stream.demo)}.</strong> The builder ended this stream. Nothing more is reported,
            checked or released; patrons exit with everything left.
          </div>
        ) : null}
        {stream.demo ? (
          <div className="banner">
            <strong>DEMO stream.</strong> Ten-minute periods and five minutes of grace, so the whole loop fits in one sitting, on the same
            contract and the same judge. The DEMO streams on this deployment point at busy public repositories so that a ten-minute
            window has real work in it: the builder accounts are ours, the work belongs to those projects, and every report quotes what
            actually landed.
          </div>
        ) : null}

        <div className="split">
          <div className="stack" style={{ gap: 20, minWidth: 0 }}>
            <div className="panel stack">
              <span className="label">Mission</span>
              <p style={{ fontSize: 17, lineHeight: 1.55 }}>{stream.mission}</p>
              <div className="row" style={{ gap: 8 }}>
                <span className="label">Sources</span>
                {stream.sources.map((source) => (
                  <span key={source} className="chip" style={{ textTransform: "none", letterSpacing: 0 }}>
                    {source}
                  </span>
                ))}
                {repo ? <span className="chip">Repo autolink on · {repo}</span> : null}
                {ownerOnly ? <span className="chip">Repo autolink from the report&apos;s GitHub links</span> : null}
              </div>
              <span className="hint">Every evidence link in a report must start with one of these. The mission cannot change.</span>
            </div>

            <div className="panel stack">
              <PulseStrip cells={strip.cells} firstNumber={strip.firstK + 1} size="lg" />
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="label">
                  P{strip.firstK + 1} {day(stream.start + strip.firstK * stream.period_s)}
                </span>
                <span className="label">
                  {strip.unreported ? `P${strip.firstK + strip.cells.length}` : `P${stream.current_k + 1} now`}
                </span>
              </div>
              {strip.unreported ? (
                <span className="hint">
                  Then {strip.unreported} period{strip.unreported === 1 ? "" : "s"} with no report, up to period {stream.current_k + 1} now.
                  Anyone may record each as a lapse once its grace is over.
                </span>
              ) : null}
              <PulseLegend cells="AQOULRPC" />
            </div>

            <div className="stack" style={{ gap: 10 }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="label">Check-in feed</span>
                <Link href={`/s/${stream.sid}/report`} className="btn small">
                  Builder check-in
                </Link>
              </div>
              <div className="feed">
                {record.length ? (
                  <article className="stack" style={{ gap: 6 }}>
                    <strong style={{ fontWeight: 600 }}>
                      Periods {record[record.length - 1].k + 2} to {stream.current_k + 1}
                    </strong>
                    <span className="hint">No report was posted. The builder stopped reporting after period {record[record.length - 1].k + 1}.</span>
                  </article>
                ) : null}
                {feed.map((period) => (
                  <PeriodItem key={period.k} stream={stream} period={period} now={stream.now} />
                ))}
              </div>
              {record.length ? (
                <span className="hint">Showing the {record.length} periods that have a record, newest first.</span>
              ) : stream.current_k + 1 > stream.recent_periods.length ? (
                <span className="hint">The feed shows the latest {stream.recent_periods.length} periods.</span>
              ) : null}
            </div>
          </div>

          <aside className="stack" style={{ gap: 16 }}>
            <div className="panel stack">
              <span className="label">Pool</span>
              <div className="stat">
                <div className="n">
                  {gen(stream.pool, 2)} <span className="muted" style={{ fontSize: 14 }}>GEN</span>
                </div>
              </div>
              <dl className="kv">
                <dt>Tranche</dt>
                <dd>
                  {gen(stream.tranche, 2)} / {span(stream.period_s)}
                </dd>
                <dt>Runway</dt>
                <dd>
                  {stream.runway} period{stream.runway === 1 ? "" : "s"}
                </dd>
                <dt>Released so far</dt>
                <dd>{gen(stream.released, 2)}</dd>
                <dt>Waiting for the builder to claim</dt>
                <dd>{gen(stream.claimable, 2)}</dd>
                <dt>Streak</dt>
                <dd>
                  {stream.streak} (best {stream.best_streak})
                </dd>
                {current ? (
                  <>
                    <dt>Next check</dt>
                    <dd>after {when(current.pending.end, stream.demo)}</dd>
                  </>
                ) : null}
              </dl>
              <span className="hint">Runway is the pool divided by the tranche: how many alive periods the money lasts.</span>
            </div>

            <PositionPanel stream={stream} />
            {current ? <CheckPanel stream={stream} current={current} /> : null}

            <div className="panel stack">
              <span className="label">
                {stream.patrons} patron{stream.patrons === 1 ? "" : "s"}
              </span>
              {stream.top_patrons.length ? (
                <dl className="kv">
                  {stream.top_patrons.map((p) => (
                    <div key={p.address} style={{ display: "contents" }}>
                      <dt className="mono" style={{ fontSize: 12.5 }}>
                        {short(p.address)}
                      </dt>
                      <dd>{gen(p.value, 2)}</dd>
                    </div>
                  ))}
                  {stream.more_patrons.count ? (
                    <>
                      <dt>{stream.more_patrons.count} more</dt>
                      <dd>{gen(stream.more_patrons.value, 2)}</dd>
                    </>
                  ) : null}
                </dl>
              ) : (
                <p className="hint">Nobody has funded this stream yet.</p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
