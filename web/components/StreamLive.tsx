"use client";

/**
 * The parts of the stream page that write: a patron's position with Add and
 * Exit, and the check or lapse that anybody may run once it is due. After any
 * decided write the page re-reads the chain, so every number on it stays the
 * chain's own.
 */

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { gen, left, parseGen, when } from "@/lib/format";
import type { Current, Position, StreamDetail } from "@/lib/types";
import { refreshReads, send, type TxState } from "@/lib/write";
import { TxLine, WriteGate } from "./Tx";
import { useWallet } from "./Wallet";

export function PositionPanel({ stream }: { stream: StreamDetail }) {
  const w = useWallet();
  const router = useRouter();
  const [position, setPosition] = useState<Position | null>(null);
  const [amount, setAmount] = useState("");
  const [tx, setTx] = useState<TxState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!w.address) return setPosition(null);
    try {
      const response = await fetch(`/api/position?sid=${stream.sid}&addr=${w.address}`, { cache: "no-store" });
      if (response.ok) setPosition(await response.json());
    } catch {
      // the panel just shows no position until the next read
    }
  }, [w.address, stream.sid]);

  useEffect(() => {
    load();
  }, [load, stream.pool, stream.shares]);

  const busy = tx !== null && ["estimating", "signing", "submitted", "deciding"].includes(tx.phase);
  const closedToDeposits = stream.status !== "ACTIVE";

  async function run(method: "fund" | "exit", args: unknown[], value: bigint) {
    if (!w.address) return;
    setError(null);
    const done = await send(w.address, method, args, value, setTx);
    if (done.phase === "decided") {
      setAmount("");
      await refreshReads(stream.sid);
      await w.refresh();
      await load();
      router.refresh();
    }
  }

  function add() {
    try {
      const wei = parseGen(amount);
      if (wei <= 0n) throw new Error("Enter more than zero.");
      run("fund", [stream.sid], wei);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function exitPart() {
    if (!position) return;
    try {
      const wei = parseGen(amount);
      const shares = BigInt(position.shares);
      const pool = BigInt(stream.pool);
      const total = BigInt(stream.shares);
      if (pool === 0n || total === 0n) throw new Error("The pool is empty.");
      let burn = (wei * total) / pool;
      if (burn > shares) burn = shares;
      if (burn <= 0n) throw new Error("That is less than one share.");
      run("exit", [stream.sid, burn], 0n);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const held = position ? BigInt(position.shares) : 0n;

  return (
    <div className="panel stack" id="fund">
      <span className="label">Your position</span>
      {w.address && position ? (
        <>
          <div className="stat">
            <div className="n">
              {gen(position.value, 2)} <span className="muted" style={{ fontSize: 14 }}>GEN</span>
            </div>
          </div>
          <dl className="kv">
            <dt>Deposited</dt>
            <dd>{gen(position.paid_in, 2)}</dd>
            <dt>Released to the builder since you joined</dt>
            <dd>{gen(position.released_while_in, 2)}</dd>
            <dt>Taken back</dt>
            <dd>{gen(position.paid_out, 2)}</dd>
          </dl>
        </>
      ) : (
        <p className="hint">Connect a wallet to see your share of the pool.</p>
      )}
      <hr className="divider" style={{ margin: "4px 0" }} />
      <WriteGate>
        <div className="field">
          <label className="label" htmlFor="amount">
            Amount in GEN
          </label>
          <input
            id="amount"
            className="input mono"
            inputMode="decimal"
            placeholder="500"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={busy}
          />
        </div>
        <div className="row">
          <button className="btn solid" onClick={add} disabled={busy || closedToDeposits || !amount}>
            Add
          </button>
          <button className="btn" onClick={exitPart} disabled={busy || held === 0n || !amount}>
            Exit this amount
          </button>
          <button className="btn" onClick={() => run("exit", [stream.sid, held], 0n)} disabled={busy || held === 0n}>
            Exit everything
          </button>
        </div>
        {closedToDeposits ? (
          <span className="hint">
            {stream.status === "PAUSED" ? "Paused streams take no new deposits." : "Closed streams take no deposits."} Exit is always open.
          </span>
        ) : null}
        {error ? <span className="hint no">{error}</span> : null}
        <TxLine state={tx} />
      </WriteGate>
    </div>
  );
}

export function CheckPanel({ stream, current }: { stream: StreamDetail; current: Current }) {
  const w = useWallet();
  const router = useRouter();
  const [tx, setTx] = useState<TxState | null>(null);
  const pending = current.pending;
  const period = stream.recent_periods.find((p) => p.k === pending.k);
  const pages = period ? Math.min(4, period.links.length + (stream.sources.some((s) => s.startsWith("github.com/")) ? 1 : 0)) : 0;
  const busy = tx !== null && ["estimating", "signing", "submitted", "deciding"].includes(tx.phase);

  if (stream.status === "CLOSED") return null;

  async function run(method: "check" | "lapse") {
    if (!w.address) return;
    const done = await send(w.address, method, [stream.sid, pending.k], 0n, setTx);
    if (done.phase === "decided" || done.phase === "refused") {
      await refreshReads(stream.sid);
      router.refresh();
    }
  }

  let text: string;
  if (pending.checkable) {
    text = `Period ${pending.k + 1} has ended and has a report. Anyone may run its check now.`;
  } else if (pending.lapsable) {
    text = `Period ${pending.k + 1} ended with no report and its grace is over. Anyone may record the lapse.`;
  } else if (pending.status === "RECHECK") {
    text = `Period ${pending.k + 1} read as unreadable. The builder may swap links until ${when(pending.grace_end, stream.demo)}; the recheck runs after that.`;
  } else if (current.now < pending.end) {
    text = `Period ${pending.k + 1} is in progress. Its check can run after ${when(pending.end, stream.demo)}, in ${left(pending.end, current.now)}.`;
  } else {
    text = `Period ${pending.k + 1} has no report yet. The builder can still post one until ${when(pending.grace_end, stream.demo)}.`;
  }

  return (
    <div className="panel stack">
      <span className="label">Next check</span>
      <p className="body" style={{ fontSize: 14.5 }}>
        {text}
      </p>
      {pending.checkable || pending.lapsable ? (
        <WriteGate>
          <button className="btn" onClick={() => run(pending.checkable ? "check" : "lapse")} disabled={busy}>
            {pending.checkable ? `Run the check for period ${pending.k + 1}` : `Record the lapse of period ${pending.k + 1}`}
          </button>
          <TxLine
            state={tx}
            deciding={pending.checkable ? `Validators are reading ${pages || "the"} page${pages === 1 ? "" : "s"}` : undefined}
          />
          {pending.checkable ? <span className="hint">A check reads the web and asks a model on every validator. It can take a minute or two.</span> : null}
        </WriteGate>
      ) : null}
    </div>
  );
}
