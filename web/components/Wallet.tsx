"use client";

/**
 * The visitor's wallet, on raw window.ethereum. eth_accounts on mount, which
 * never opens a prompt; eth_requestAccounts only on a Connect click; account
 * and chain listeners removed on unmount; a switch to the site's chain that adds
 * the chain when the wallet does not know it.
 *
 * Reading needs no wallet. Only writes do.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { CHAIN_HEX } from "@/lib/deployment";
import { balanceOf, ethereum, explain, switchNetwork } from "@/lib/write";

/* eslint-disable @typescript-eslint/no-explicit-any */

type WalletState = {
  hasWallet: boolean;
  address: string | null;
  onNetwork: boolean;
  balance: bigint | null;
  busy: string | null;
  note: string | null;
  connect: () => Promise<void>;
  switchChain: () => Promise<void>;
  faucet: () => Promise<void>;
  refresh: () => Promise<void>;
  clearNote: () => void;
};

const Ctx = createContext<WalletState | null>(null);

export function useWallet(): WalletState {
  const value = useContext(Ctx);
  if (!value) throw new Error("useWallet outside WalletProvider");
  return value;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [hasWallet, setHasWallet] = useState(true);
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    const eth = (globalThis as any).ethereum;
    if (!eth?.request) {
      setHasWallet(false);
      return;
    }
    let live = true;
    const onAccounts = (accounts: string[]) => live && setAddress(accounts?.[0] ?? null);
    const onChain = (id: string) => live && setChainId(String(id).toLowerCase());
    eth.request({ method: "eth_accounts" }).then(onAccounts).catch(() => {});
    eth.request({ method: "eth_chainId" }).then(onChain).catch(() => {});
    eth.on?.("accountsChanged", onAccounts);
    eth.on?.("chainChanged", onChain);
    return () => {
      live = false;
      eth.removeListener?.("accountsChanged", onAccounts);
      eth.removeListener?.("chainChanged", onChain);
    };
  }, []);

  const onNetwork = chainId === CHAIN_HEX.toLowerCase();

  const refresh = useCallback(async () => {
    if (!address) return;
    try {
      setBalance(await balanceOf(address));
    } catch {
      setBalance(null);
    }
  }, [address]);

  useEffect(() => {
    refresh();
  }, [refresh, chainId]);

  const run = useCallback(async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setNote(null);
    try {
      await fn();
    } catch (error) {
      setNote(explain(error));
    } finally {
      setBusy(null);
    }
  }, []);

  const switchChain = useCallback(
    () =>
      run("switch", async () => {
        await switchNetwork();
        setChainId(String(await ethereum().request({ method: "eth_chainId" })).toLowerCase());
      }),
    [run],
  );

  const connect = useCallback(
    () =>
      run("connect", async () => {
        const accounts: string[] = await ethereum().request({ method: "eth_requestAccounts" });
        setAddress(accounts?.[0] ?? null);
        await switchNetwork();
        setChainId(String(await ethereum().request({ method: "eth_chainId" })).toLowerCase());
      }),
    [run],
  );

  const faucet = useCallback(
    () =>
      run("faucet", async () => {
        if (!address) throw new Error("no_wallet");
        const response = await fetch("/api/faucet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address }),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          setNote(body?.message ?? "The faucet did not answer. Try again in a moment.");
          return;
        }
        setBalance(BigInt(body.after));
        setNote("Test GEN arrived. It has no value; it exists to try things.");
      }),
    [address, run],
  );

  const value = useMemo<WalletState>(
    () => ({
      hasWallet,
      address,
      onNetwork,
      balance,
      busy,
      note,
      connect,
      switchChain,
      faucet,
      refresh,
      clearNote: () => setNote(null),
    }),
    [hasWallet, address, onNetwork, balance, busy, note, connect, switchChain, faucet, refresh],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
