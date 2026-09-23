"use client";

/**
 * Writes, signed in the visitor's own wallet. No key ever exists on a server.
 *
 * The TypeScript half of scripts/chain.py, for Studionet (chain 61999), which
 * runs consensus without fee deposits, so a write is just the call and its
 * value. The genlayer-js 1.x client takes the wallet as its provider and asks
 * it to sign through eth_sendTransaction.
 *
 * Accepted is not success: validators can agree that a refusal is the right
 * result. Success is an accepted status AND a leader execution that returned;
 * anything else carries the contract's own sentence out of the leader receipt.
 */

import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

import { CHAIN_HEX, DEPLOYMENT, NETWORK_NAME, NETWORK_SHORT } from "./deployment";

/* eslint-disable @typescript-eslint/no-explicit-any */

export const CHAIN: any = {
  ...studionet,
  id: DEPLOYMENT.chainId,
  rpcUrls: { default: { http: [DEPLOYMENT.rpc] } },
};

export type Phase = "signing" | "submitted" | "deciding" | "decided" | "refused" | "error";

export type TxState = {
  phase: Phase;
  method: string;
  hash?: string;
  message?: string;
  result?: unknown;
};

/** The judge reads the web and asks a model on every validator, so a check waits longer. */
const NONDET = new Set(["check"]);

export function ethereum(): any {
  const eth = (globalThis as any).ethereum;
  if (!eth?.request) throw new Error("no_wallet");
  return eth;
}

function codeOf(error: any): number | undefined {
  return error?.code === -32603 ? (error?.data?.originalError?.code ?? error?.data?.code) : error?.code;
}

export async function switchNetwork(): Promise<void> {
  const eth = ethereum();
  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_HEX }] });
  } catch (error: any) {
    if (codeOf(error) !== 4902) throw error;
    await eth.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: CHAIN_HEX,
          chainName: NETWORK_NAME,
          rpcUrls: [DEPLOYMENT.rpc],
          blockExplorerUrls: [`${DEPLOYMENT.explorer}/`],
          nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
        },
      ],
    });
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_HEX }] });
  }
}

export async function balanceOf(address: string): Promise<bigint> {
  const response = await fetch(DEPLOYMENT.rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getBalance", params: [address, "latest"] }),
  });
  const body = await response.json();
  return BigInt(body?.result ?? "0x0");
}

function writer(address: string): any {
  return createClient({ chain: CHAIN, account: address as `0x${string}`, provider: ethereum() } as any);
}

function transient(error: unknown): boolean {
  return /fetch failed|ECONNRESET|socket|network|timed out|timeout|Server busy|-32029|rate limit|429|502|503|504/i.test(
    String((error as Error)?.message ?? error),
  );
}

async function retried<T>(fn: () => Promise<T>, attempts = 5): Promise<T> {
  let wait = 1500;
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i >= attempts || !transient(error)) throw error;
      await new Promise((r) => setTimeout(r, wait));
      wait = Math.min(Math.round(wait * 1.8), 12000);
    }
  }
}

function leaderOf(receipt: any): any {
  const rounds = receipt?.consensus_data?.leader_receipt;
  if (Array.isArray(rounds)) return rounds.find((r: any) => String(r?.mode ?? "").toLowerCase() === "leader") ?? rounds[0];
  return rounds;
}

/** The sentence a contract refused with, out of the leader's receipt. */
export function refusalOf(receipt: any): string {
  const result = leaderOf(receipt)?.result;
  if (!result || typeof result !== "object") return "";
  const payload = (result as any).payload;
  if (typeof payload === "string") return payload.replace(/^\[EXPECTED\]\s*/, "");
  if (payload && typeof payload === "object" && "readable" in payload) return String(payload.readable).replace(/^"|"$/g, "");
  return "";
}

export function returnedOf(receipt: any): unknown {
  const result = leaderOf(receipt)?.result;
  if (result && typeof result === "object" && String((result as any).status).toLowerCase() === "return") {
    const readable = (result as any).payload?.readable;
    if (typeof readable === "string") {
      try {
        return JSON.parse(readable);
      } catch {
        return readable;
      }
    }
  }
  return undefined;
}

function statusOf(receipt: any): string {
  const name = receipt?.statusName ?? receipt?.status_name;
  if (typeof name === "string" && name) return name.toUpperCase();
  const code = Number(receipt?.status);
  return code === 5 ? "ACCEPTED" : code === 7 ? "FINALIZED" : String(receipt?.status ?? "").toUpperCase();
}

/** Turn a wallet or network error into one sentence a person can act on. */
export function explain(error: unknown): string {
  const text = String((error as any)?.shortMessage ?? (error as any)?.message ?? error);
  if (text === "no_wallet") return "No wallet was found in this browser. Install one such as MetaMask, then reload.";
  if (/User rejected|denied|4001/i.test(text)) return "You declined the request in your wallet. Nothing was sent.";
  if (/insufficient funds|exceeds balance/i.test(text)) return "Not enough GEN for this. Use the faucet, then try again.";
  if (/chain|network/i.test(text) && /mismatch|wrong|switch/i.test(text)) return `Switch your wallet to ${NETWORK_SHORT} and try again.`;
  return text.slice(0, 240);
}

/**
 * Sign one write in the wallet, report each phase as it happens, and wait for
 * the validators' decision. Resolves with the final state; never throws.
 */
export async function send(
  address: string,
  method: string,
  args: unknown[],
  value: bigint,
  onState: (state: TxState) => void,
): Promise<TxState> {
  let state: TxState = { phase: "signing", method };
  const emit = (next: Partial<TxState>) => {
    state = { ...state, ...next };
    onState(state);
    return state;
  };
  emit({});
  try {
    const client = writer(address);
    const hash: string = await client.writeContract({
      address: DEPLOYMENT.keepalive,
      functionName: method,
      args,
      value,
    });
    emit({ phase: "submitted", hash });
    emit({ phase: "deciding" });
    const receipt: any = await retried(
      () =>
        client.waitForTransactionReceipt({
          hash,
          status: "ACCEPTED",
          interval: 4000,
          retries: NONDET.has(method) ? 150 : 75,
        }),
      4,
    );
    const status = statusOf(receipt);
    const leader = leaderOf(receipt);
    const execution = String(leader?.execution_result ?? "").toUpperCase();
    const kind = String(leader?.result?.status ?? "").toLowerCase();
    if ((status === "ACCEPTED" || status === "FINALIZED") && execution === "SUCCESS" && kind === "return") {
      return emit({ phase: "decided", result: returnedOf(receipt) });
    }
    const why = refusalOf(receipt);
    return emit({ phase: "refused", message: why || `The validators decided ${status || "without an outcome"}${execution ? `, ${execution}` : ""}.` });
  } catch (error) {
    return emit({ phase: "error", message: explain(error) });
  }
}
