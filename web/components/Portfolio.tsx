"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { gen, span, when } from "@/lib/format";
import type { Portfolio as Folio } from "@/lib/types";
import { refreshReads, send, type TxState } from "@/lib/write";
import { PulseStrip } from "./Pulse";
import { Seal } from "./Seal";
import { TxLine, WriteGate } from "./Tx";
import { useWallet } from "./Wallet";

export function Portfolio() {
  const w = useWallet();
  const [folio, setFolio] = useState<Folio | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tx, setTx] = useState<TxState | null>(null);

  const load = useCallback(async () => {
    if (!w.address) return;
    setError(null);
    try {
      const response = await fetch(`/api/position?addr=${w.address}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error ?? "read failed");
      setFolio(body);
    } catch (e) {
      setError(String((e as Error).message));
    }
  }, [w.address]);

  useEffect(() => {
    load();
  }, [load]);

  const busy = tx !== null && ["estimating", "signing", "submitted", "deciding"].includes(tx.phase);

  async function exitAll(sid: number, shares: string) {
    if (!w.address) return;
    const done = await send(w.address, "exit", [sid, BigInt(shares)], 0n, setTx);
    if (done.phase === "decided") {
      await refreshReads(sid);
      await w.refresh();
      await load();
    }
  }

  if (!w.address || !w.onNetwork) {
    return (
      <div className="panel stack" style={{ maxWidth: 560 }}>
        <p className="body">Connect the wallet you fund streams from to see every stream it backs.</p>
        <WriteGate need={0n}>
          <span />
        </WriteGate>
      </div>
    );
  }
  if (error) return <div className="banner">The portfolio could not be read: {error}</div>;
  if (!folio) return <p className="hint reading">Reading your positions from the chain</p>;

  const rows = folio.positions;
  if (rows.length === 0) {
    return (
      <div className="panel stack" style={{ maxWidth: 560 }}>
        <p className="body">This wallet has not funded any stream yet.</p>
        <Link href="/streams" className="btn solid" style={{ justifySelf: "start" }}>
          Find a stream
        </Link>
      </div>
    );
  }

  const total = (key: "paid_in" | "value" | "released_while_in" | "paid_out") =>
    rows.reduce((sum, row) => sum + BigInt(row[key]), 0n);
  const paused = rows.filter((row) => row.stream.status === "PAUSED" && BigInt(row.shares) > 0n);
  const checks = rows
    .filter((row) => row.stream.last.verdict)
    .sort((a, b) => b.stream.last.at - a.stream.last.at)
    .slice(0, 6);

  return (
    <div className="stack" style={{ gap: 24 }}>
      {paused.map((row) => (
        <div key={row.sid} className="banner row" style={{ justifyContent: "space-between" }}>
          <span>
            <strong>{row.stream.title}</strong> missed two periods in a row and is paused. Your {gen(row.value, 2)} GEN has not been
            released. Exit now, or wait for an alive check.
          </span>
          <span className="row">
            <button className="btn small" onClick={() => exitAll(row.sid, row.shares)} disabled={busy}>
              Exit {gen(row.value, 2)} GEN
            </button>
            <Link href={`/s/${row.sid}`} className="btn small">
              View stream
            </Link>
          </span>
        </div>
      ))}
      <TxLine state={tx} />

      <div className="grid grid-4">
        <div className="stat panel tight">
          <div className="n">{rows.length}</div>
          <div className="label">streams backed</div>
        </div>
        <div className="stat panel tight">
          <div className="n">{gen(total("paid_in"), 2)}</div>
          <div className="label">GEN deposited</div>
        </div>
        <div className="stat panel tight">
          <div className="n">{gen(total("value"), 2)}</div>
          <div className="label">GEN current value</div>
        </div>
        <div className="stat panel tight">
          <div className="n green">{gen(total("released_while_in"), 2)}</div>
          <div className="label">GEN released to builders</div>
        </div>
      </div>
      <p className="hint">
        Current value {gen(total("value"), 2)} + released {gen(total("released_while_in"), 2)} + taken back {gen(total("paid_out"), 2)} ={" "}
        {gen(total("value") + total("released_while_in") + total("paid_out"), 2)} GEN, what this wallet deposited.
      </p>

      <div className="scroll-x panel" style={{ padding: 0 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Stream</th>
              <th>Last 12 periods</th>
              <th>Status</th>
              <th>Your value</th>
              <th>Released while in</th>
              <th>Strikes</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.sid}>
                <td>
                  <Link href={`/s/${row.sid}`} style={{ textDecoration: "none" }}>
                    <strong style={{ fontWeight: 600 }}>{row.stream.title}</strong>
                  </Link>
                  <div className="hint">{span(row.stream.period_s)}</div>
                </td>
                <td>
                  <PulseStrip cells={row.stream.pulse} size="sm" firstNumber={Math.max(1, row.stream.current_k - row.stream.pulse.length + 2)} />
                </td>
                <td>
                  <span className={`chip ${row.stream.status === "ACTIVE" && row.stream.last.verdict === "ALIVE" ? "alive" : "quiet"}`}>
                    {row.stream.status === "ACTIVE" && row.stream.last.verdict === "ALIVE" ? "ALIVE" : row.stream.status}
                  </span>
                </td>
                <td className="amount">{gen(row.value, 2)}</td>
                <td className="amount">{gen(row.released_while_in, 2)}</td>
                <td className="amount">{row.stream.strikes}</td>
                <td>
                  <span className="row" style={{ flexWrap: "nowrap", gap: 6 }}>
                    <Link
                      href={`/s/${row.sid}#fund`}
                      className="btn small"
                      aria-disabled={row.stream.status !== "ACTIVE"}
                      style={row.stream.status !== "ACTIVE" ? { pointerEvents: "none", opacity: 0.45 } : undefined}
                    >
                      Add
                    </Link>
                    <button className="btn small" onClick={() => exitAll(row.sid, row.shares)} disabled={busy || BigInt(row.shares) === 0n}>
                      Exit
                    </button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="stack">
        <span className="label">Recent checks on your streams</span>
        <div className="feed">
          {checks.length ? (
            checks.map((row) => (
              <div key={row.sid} className="row" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
                <Seal verdict={row.stream.last.verdict} />
                <div className="stack" style={{ gap: 2, minWidth: 0 }}>
                  <span>
                    <strong style={{ fontWeight: 600 }}>{row.stream.title}</strong>{" "}
                    <span className="body">{row.stream.last.reason}</span>
                  </span>
                  <span className="hint">
                    Period {row.stream.last.k + 1} · {when(row.stream.last.at, row.stream.demo)}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <span className="hint">No period on your streams has been checked yet.</span>
          )}
        </div>
      </div>
    </div>
  );
}
