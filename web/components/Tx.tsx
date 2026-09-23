"use client";

/**
 * The pieces every write shares: the gate in front of it (wallet, network,
 * GEN) and the line that says what the transaction is doing. Submitted,
 * deciding, decided and refused are different states and are said differently.
 */

import type { ReactNode } from "react";

import { CHAIN_HEX, DEPLOYMENT, NETWORK_NAME, NETWORK_SHORT, txUrl } from "@/lib/deployment";
import type { TxState } from "@/lib/write";
import { useWallet } from "./Wallet";

export function TxLink({ hash }: { hash: string }) {
  return (
    <a className="mono" href={txUrl(hash)} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, color: "var(--body)" }}>
      tx {hash.slice(0, 10)}...{hash.slice(-4)}
    </a>
  );
}

export function TxLine({ state, deciding }: { state: TxState | null; deciding?: string }) {
  if (!state) return null;
  const text: Record<TxState["phase"], string> = {
    signing: "Confirm in your wallet",
    submitted: "Submitted",
    deciding: deciding ?? "Validators are deciding",
    decided: "Decided and accepted",
    refused: "Refused",
    error: "Not sent",
  };
  const live = ["signing", "submitted", "deciding"].includes(state.phase);
  return (
    <div role="status" aria-live="polite" className="stack" style={{ gap: 6, fontSize: 14 }}>
      <div className="row" style={{ gap: 10 }}>
        <span className={live ? "reading" : ""} style={{ color: state.phase === "decided" ? "var(--text)" : "var(--body)" }}>
          {text[state.phase]}
        </span>
        {state.hash ? <TxLink hash={state.hash} /> : null}
      </div>
      {state.message ? <span className="body">{state.message}</span> : null}
    </div>
  );
}

/**
 * Renders its children only when a write can actually be signed: a wallet,
 * connected, on the site's network, holding some GEN. Otherwise it says which of
 * those is missing and offers the one button that fixes it.
 */
export function WriteGate({ children, need = 1n }: { children: ReactNode; need?: bigint }) {
  const w = useWallet();
  if (!w.hasWallet) {
    return (
      <p className="body" style={{ fontSize: 14.5 }}>
        Reading needs no wallet. To sign, install a browser wallet such as{" "}
        <a href="https://metamask.io/download/" target="_blank" rel="noreferrer">
          MetaMask
        </a>{" "}
        and reload.
      </p>
    );
  }
  if (!w.address) {
    return (
      <button className="btn solid" onClick={w.connect} disabled={w.busy !== null}>
        {w.busy === "connect" ? "Connecting" : "Connect wallet"}
      </button>
    );
  }
  if (!w.onNetwork) {
    return (
      <div className="stack">
        <p className="body" style={{ fontSize: 14.5 }}>
          Your wallet is on another network. Keepalive runs on {NETWORK_NAME}, chain {DEPLOYMENT.chainId} ({CHAIN_HEX.toUpperCase().replace("0X", "0x")}).
        </p>
        <button className="btn solid" onClick={w.switchChain} disabled={w.busy !== null}>
          Switch to {NETWORK_SHORT}
        </button>
      </div>
    );
  }
  const low = w.balance !== null && w.balance < need * 10n ** 18n;
  return (
    <div className="stack">
      {low ? (
        <div className="banner">
          <strong>No GEN yet.</strong> Test GEN is free on {NETWORK_SHORT}.{" "}
          <button className="btn small" onClick={w.faucet} disabled={w.busy !== null} style={{ marginLeft: 6 }}>
            {w.busy === "faucet" ? "Funding" : "Get test GEN"}
          </button>
        </div>
      ) : null}
      {children}
      {w.note ? <span className="hint">{w.note}</span> : null}
    </div>
  );
}
