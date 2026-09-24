"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { gen, left, short, when } from "@/lib/format";
import { testReadable, type Readability } from "@/lib/readable";
import { autolink, checkLink } from "@/lib/sources";
import type { Current, StreamDetail } from "@/lib/types";
import { refreshReads, send, type TxState } from "@/lib/write";
import { Seal } from "./Seal";
import { TxLine, WriteGate } from "./Tx";
import { useWallet } from "./Wallet";

const MAX_SUMMARY = 800;

function LinkField({
  value,
  onChange,
  sources,
  index,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  sources: string[];
  index: number;
  disabled: boolean;
}) {
  const [test, setTest] = useState<Readability | null>(null);
  const match = value.trim() ? checkLink(value, sources) : null;
  useEffect(() => {
    setTest(null);
    if (!match || !match.ok) return;
    const timer = setTimeout(() => testReadable(match.link).then(setTest), 700);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div className="field">
      <input
        className="input mono"
        placeholder={index === 0 ? `${sources[0] ?? "github.com/you/"}...` : "optional"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-label={`Evidence link ${index + 1}`}
      />
      {match ? (
        <span className={`hint ${match.ok ? "ok" : "no"}`}>
          {match.ok ? "source match" : match.why}
          {match.ok ? (test ? ` · ${test.note}` : " · testing readability") : ""}
        </span>
      ) : null}
    </div>
  );
}

export function ReportForm({ stream, current }: { stream: StreamDetail; current: Current }) {
  const w = useWallet();
  const router = useRouter();
  const choices = current.reportable;
  const [k, setK] = useState<number>(choices[choices.length - 1] ?? current.k);
  const existing = stream.recent_periods.find((p) => p.k === k);
  const [summary, setSummary] = useState(existing?.summary ?? "");
  const [links, setLinks] = useState<string[]>(() => {
    const have = existing?.links ?? [];
    return [have[0] ?? "", have[1] ?? "", have[2] ?? ""];
  });
  const [tx, setTx] = useState<TxState | null>(null);
  const [claimTx, setClaimTx] = useState<TxState | null>(null);
  const [closeTx, setCloseTx] = useState<TxState | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);

  useEffect(() => {
    const p = stream.recent_periods.find((one) => one.k === k);
    setSummary(p?.summary ?? "");
    const have = p?.links ?? [];
    setLinks([have[0] ?? "", have[1] ?? "", have[2] ?? ""]);
  }, [k, stream.recent_periods]);

  const isOwner = !!w.address && w.address.toLowerCase() === stream.owner.toLowerCase();
  const start = stream.start + k * stream.period_s;
  const end = start + stream.period_s;
  const graceEnd = end + stream.grace_s;
  const filled = links.map((l) => l.trim()).filter(Boolean);
  const checked = filled.map((l) => checkLink(l, stream.sources));
  const good = checked.filter((c): c is { ok: true; link: string } => c.ok).map((c) => c.link);
  const auto = useMemo(() => autolink(stream.sources, good, start, end), [stream.sources, good.join("|"), start, end]); // eslint-disable-line react-hooks/exhaustive-deps
  const period = stream.recent_periods.find((p) => p.k === k);
  const busy = [tx, claimTx, closeTx].some((t) => t !== null && ["estimating", "signing", "submitted", "deciding"].includes(t.phase));
  const valid =
    summary.trim().length > 0 && summary.length <= MAX_SUMMARY && checked.every((c) => c.ok) && good.length + (auto ? 1 : 0) > 0;

  async function post() {
    if (!w.address) return;
    const done = await send(w.address, "report", [stream.sid, k, summary.trim(), good], 0n, setTx);
    if (done.phase === "decided") {
      await refreshReads(stream.sid);
      router.refresh();
    }
  }

  async function claim() {
    if (!w.address) return;
    const done = await send(w.address, "claim", [stream.sid], 0n, setClaimTx);
    if (done.phase === "decided") {
      await refreshReads(stream.sid);
      await w.refresh();
      router.refresh();
    }
  }

  async function close() {
    if (!w.address) return;
    const done = await send(w.address, "close", [stream.sid], 0n, setCloseTx);
    if (done.phase === "decided") {
      await refreshReads(stream.sid);
      router.refresh();
    }
  }

  const resolved = stream.recent_periods.filter((p) => p.status === "CHECKED" || p.status === "LAPSED").slice(0, 4);

  return (
    <div className="split">
      <div className="stack" style={{ gap: 18, minWidth: 0 }}>
        {stream.status === "CLOSED" ? (
          <div className="banner">
            <strong>This stream is closed.</strong> Nothing more can be reported. Anything already released can still be claimed.
          </div>
        ) : choices.length === 0 ? (
          <div className="banner">No period is open for a report right now.</div>
        ) : (
          <>
            <div className="row">
              {choices.length > 1 ? (
                <div className="toggle" role="group" aria-label="Period">
                  {choices.map((one) => (
                    <button key={one} aria-pressed={k === one} onClick={() => setK(one)}>
                      Period {one + 1}
                    </button>
                  ))}
                </div>
              ) : null}
              {current.now < end ? <span className="chip">{left(end, current.now)} left in period</span> : <span className="chip">period ended</span>}
              <span className="chip">grace to {when(graceEnd, stream.demo)}</span>
              <span className="chip">report window open</span>
            </div>
            {period?.status === "RECHECK" ? (
              <div className="banner">
                <strong>The first check read nothing.</strong> {period.reason} No strike. Swap the links for pages validators can read, and
                the recheck runs once.
              </div>
            ) : null}
            <div className="field">
              <label className="label" htmlFor="summary">
                What did you ship this period?
              </label>
              <textarea
                id="summary"
                className="textarea"
                value={summary}
                maxLength={MAX_SUMMARY}
                onChange={(e) => setSummary(e.target.value)}
                disabled={busy}
                placeholder="Merged the batched verifier (PR #412), published v0.10 with release notes, and fixed the two audit findings left from August."
              />
              <span className="hint" style={{ textAlign: "right" }}>
                {summary.length} / {MAX_SUMMARY}
              </span>
            </div>
            <div className="stack" style={{ gap: 10 }}>
              <span className="label">Evidence links, up to three</span>
              {links.map((value, index) => (
                <LinkField
                  key={index}
                  index={index}
                  value={value}
                  sources={stream.sources}
                  disabled={busy}
                  onChange={(v) => setLinks((all) => all.map((one, i) => (i === index ? v : one)))}
                />
              ))}
              {auto ? (
                <div className="links">
                  <span>
                    <span className="chip" style={{ height: 18, marginRight: 8 }}>
                      AUTO
                    </span>
                    {auto.replace("https://", "")}
                  </span>
                  <span className="hint">Added by the contract at check time: the repo&apos;s commits for exactly this window.</span>
                </div>
              ) : null}
            </div>
            <WriteGate>
              {isOwner ? (
                <div className="row">
                  <button className="btn solid" onClick={post} disabled={!valid || busy}>
                    {period?.status === "REPORTED" || period?.status === "RECHECK" ? "Update report" : "Post report"}
                  </button>
                  <span className="hint">Checked after {when(end, stream.demo)}. You can amend until then.</span>
                </div>
              ) : (
                <p className="body" style={{ fontSize: 14.5 }}>
                  Only the builder, {short(stream.owner)}, can post a report for this stream. Everyone can read it.
                </p>
              )}
              <TxLine state={tx} />
            </WriteGate>
          </>
        )}
      </div>

      <aside className="stack" style={{ gap: 16 }}>
        <div className="panel stack">
          <span className="label">Claimable</span>
          <div className="stat">
            <div className="n green">
              {gen(stream.claimable, 2)} <span style={{ fontSize: 14 }}>GEN</span>
            </div>
          </div>
          <span className="hint">
            Released by alive checks and not yet claimed. {gen(stream.claimed, 2)} GEN claimed so far.
          </span>
          {isOwner ? (
            <WriteGate>
              <button className="btn solid" onClick={claim} disabled={busy || BigInt(stream.claimable) === 0n}>
                Claim {gen(stream.claimable, 2)} GEN
              </button>
              <TxLine state={claimTx} />
            </WriteGate>
          ) : null}
        </div>

        <div className="panel stack">
          <span className="label">Recent checks</span>
          {resolved.length ? (
            resolved.map((p) => (
              <div key={p.k} className="row" style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
                <Seal verdict={p.status === "LAPSED" ? "LAPSED" : p.verdict} />
                <span className="hint">Period {p.number}</span>
              </div>
            ))
          ) : (
            <span className="hint">No period has been checked yet.</span>
          )}
        </div>

        <div className="panel stack">
          <span className="label">Tip</span>
          <p className="body" style={{ fontSize: 14.5 }}>
            Link the pages that show the work itself, a PR or a release, not the homepage. Dates on the page matter: GitHub pull
            request and release pages print none in text mode, so the autolink or a dated changelog carries them.
          </p>
        </div>

        {isOwner && stream.status !== "CLOSED" ? (
          <div className="panel stack">
            <span className="label">End this stream</span>
            <p className="hint">
              Closing stops all reports, checks and releases. Patrons then exit with everything left. This cannot be undone.
            </p>
            {confirmClose ? (
              <div className="row">
                <button className="btn" onClick={close} disabled={busy}>
                  Yes, close it
                </button>
                <button className="btn" onClick={() => setConfirmClose(false)} disabled={busy}>
                  Keep it open
                </button>
              </div>
            ) : (
              <button className="btn" onClick={() => setConfirmClose(true)} disabled={busy}>
                Close stream
              </button>
            )}
            <TxLine state={closeTx} />
          </div>
        ) : null}
      </aside>
    </div>
  );
}
