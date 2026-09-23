"use client";

import Link from "next/link";

import { DEPLOYMENT, NETWORK_NAME, NETWORK_SHORT } from "@/lib/deployment";
import { gen, short } from "@/lib/format";
import { Glyph } from "./Pulse";
import { useWallet } from "./Wallet";

export function Nav() {
  const w = useWallet();
  return (
    <header className="nav">
      <div className="wrap nav-inner">
        <Link href="/" className="wordmark" aria-label="Keepalive home">
          <Glyph size={16} />
          KEEPALIVE
        </Link>
        <nav className="nav-links" aria-label="Main">
          <Link href="/streams">Streams</Link>
          <Link href="/#how">How it works</Link>
          <Link href="/#builders">For builders</Link>
          <Link href="/#programs">For programs</Link>
          <Link href="/me">Portfolio</Link>
        </nav>
        <div className="nav-right">
          <span className="pill hide-sm" title={`Every read and write goes to ${NETWORK_NAME}, chain ${DEPLOYMENT.chainId}`}>
            <span className={`dot ${w.address && w.onNetwork ? "on" : ""}`} />
            {NETWORK_SHORT}
          </span>
          {!w.hasWallet ? null : !w.address ? (
            <button className="btn small" onClick={w.connect} disabled={w.busy !== null}>
              {w.busy === "connect" ? "Connecting" : "Connect wallet"}
            </button>
          ) : !w.onNetwork ? (
            <button className="btn small" onClick={w.switchChain} disabled={w.busy !== null}>
              Switch to {NETWORK_SHORT}
            </button>
          ) : (
            <span className="pill hide-sm" title={w.address}>
              {short(w.address)}
              {w.balance !== null ? <span className="muted">{gen(w.balance, 1)} GEN</span> : null}
            </span>
          )}
          <Link href="/new" className="btn small solid hide-sm">
            Start a stream
          </Link>
        </div>
      </div>
    </header>
  );
}
