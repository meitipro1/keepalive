/**
 * Reads the contract. Server side only, and read only by construction: the
 * client is created without a signing account, so nothing here can submit a
 * transaction even by mistake.
 *
 * genlayer-js builds its transport with no retries and Studio drops connections
 * in bursts, so every read retries with backoff. A view that refuses (an
 * unknown stream) is not retried.
 */

import "server-only";

import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

import { DEPLOYMENT } from "./deployment";
import type { Current, Portfolio, Position, StreamDetail, StreamList } from "./types";

/**
 * Studionet, chain 61999, read with the genlayer-js 1.x line: the 2.0 release
 * candidates speak consensus v0.6 and fail every read here.
 */
const CHAIN = {
  ...studionet,
  id: DEPLOYMENT.chainId,
  rpcUrls: { default: { http: [DEPLOYMENT.rpc] } },
} as typeof studionet;

type Reader = {
  readContract: (options: { address: `0x${string}`; functionName: string; args: unknown[] }) => Promise<unknown>;
};

let reader: Reader | null = null;

function client(): Reader {
  if (!reader) reader = createClient({ chain: CHAIN }) as unknown as Reader;
  return reader;
}

function transient(error: unknown): boolean {
  const text = String((error as Error)?.message ?? error);
  if (/unknown stream|UserError|\[EXPECTED\]/.test(text)) return false;
  return true;
}

async function view<T>(functionName: string, args: unknown[] = []): Promise<T> {
  if (!DEPLOYMENT.keepalive) throw new Error("This copy of the site has no deployment on record.");
  let last: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const raw = await client().readContract({ address: DEPLOYMENT.keepalive as `0x${string}`, functionName, args });
      return (typeof raw === "string" ? JSON.parse(raw) : raw) as T;
    } catch (error) {
      last = error;
      if (!transient(error)) break;
      await new Promise((r) => setTimeout(r, Math.min(500 * 2 ** attempt, 5000)));
    }
  }
  throw new Error(`${functionName} could not be read: ${String((last as Error)?.message ?? last).slice(0, 200)}`);
}

export function listStreams(status = "", offset = 0, limit = 50): Promise<StreamList> {
  return view<StreamList>("list_streams", [status, offset, limit]);
}

export function getStream(sid: number): Promise<StreamDetail> {
  return view<StreamDetail>("get_stream", [sid]);
}

export function currentPeriod(sid: number): Promise<Current> {
  return view<Current>("current_period", [sid]);
}

export function getPosition(sid: number, address: string): Promise<Position> {
  return view<Position>("get_position", [sid, address]);
}

export function getPortfolio(address: string): Promise<Portfolio> {
  return view<Portfolio>("get_position", [0, address]);
}

/** A read that failed, said plainly, so a page can render it instead of crashing. */
export async function attempt<T>(fn: () => Promise<T>): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    return { ok: false, error: String((error as Error)?.message ?? error).slice(0, 240) };
  }
}
