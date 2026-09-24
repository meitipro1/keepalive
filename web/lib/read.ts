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
import { unstable_cache } from "next/cache";

import { DEPLOYMENT } from "./deployment";
import type { Current, PeriodRow, Portfolio, Position, StreamDetail, StreamList } from "./types";

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

function rateLimited(error: unknown): boolean {
  return /rate limit|-32029|429/i.test(String((error as Error)?.message ?? error));
}

/**
 * One view, retried on a dropped connection. Studio allows thirty requests a
 * minute from one address, and a retry spends from that budget, so a rate
 * limit gets one slow retry rather than five quick ones.
 */
async function view<T>(functionName: string, args: unknown[] = []): Promise<T> {
  if (!DEPLOYMENT.keepalive) throw new Error("This copy of the site has no deployment on record.");
  let last: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const raw = await client().readContract({ address: DEPLOYMENT.keepalive as `0x${string}`, functionName, args });
      return (typeof raw === "string" ? JSON.parse(raw) : raw) as T;
    } catch (error) {
      last = error;
      if (!transient(error)) break;
      if (rateLimited(error)) {
        if (attempt >= 1) break;
        await new Promise((r) => setTimeout(r, 4000));
        continue;
      }
      await new Promise((r) => setTimeout(r, Math.min(500 * 2 ** attempt, 4000)));
    }
  }
  const text = String((last as Error)?.message ?? last);
  throw new Error(
    rateLimited(last)
      ? "Studionet is rate limiting reads from this server (30 a minute). Reload in a minute."
      : `${functionName} could not be read: ${text.slice(0, 200)}`,
  );
}

/**
 * The shared reads are cached for twenty seconds, so a page seen by many
 * visitors costs a few requests a minute rather than a few per visitor. A write
 * that is decided clears its stream's tag through /api/refresh, so the person
 * who wrote sees their own write at once. If a refresh fails, the last good
 * answer keeps being served until one succeeds.
 */
const SHARED_SECONDS = 20;

export function listStreams(status = "", offset = 0, limit = 50): Promise<StreamList> {
  return unstable_cache(() => view<StreamList>("list_streams", [status, offset, limit]), ["ka-list", status, String(offset), String(limit)], {
    revalidate: SHARED_SECONDS,
    tags: ["streams"],
  })();
}

export function getStream(sid: number): Promise<StreamDetail> {
  return unstable_cache(() => view<StreamDetail>("get_stream", [sid]), ["ka-stream", String(sid)], {
    revalidate: SHARED_SECONDS,
    tags: ["streams", `stream-${sid}`],
  })();
}

export function currentPeriod(sid: number): Promise<Current> {
  return unstable_cache(() => view<Current>("current_period", [sid]), ["ka-current", String(sid)], {
    revalidate: SHARED_SECONDS,
    tags: ["streams", `stream-${sid}`],
  })();
}

export function getPosition(sid: number, address: string): Promise<Position> {
  return view<Position>("get_position", [sid, address]);
}

export function getPortfolio(address: string): Promise<Portfolio> {
  return view<Portfolio>("get_position", [0, address]);
}

/**
 * A resolved period, read once and then cached for an hour. CHECKED and LAPSED
 * are final, so the answer cannot change; only a resolved period is cached.
 */
const resolvedPeriod = unstable_cache(
  async (sid: number, k: number) => view<PeriodRow>("get_period", [sid, k]),
  ["keepalive-resolved-period"],
  { revalidate: 3600 },
);

/**
 * The last `limit` resolved periods of a stream, oldest first: everything
 * below next_k is resolved. Used when a DEMO stream's recent window holds only
 * unreported periods, so its page can still show what actually happened.
 */
export async function resolvedRecord(sid: number, nextK: number, limit = 12): Promise<PeriodRow[]> {
  const rows: PeriodRow[] = [];
  for (let k = Math.max(0, nextK - limit); k < nextK; k++) {
    const row = await resolvedPeriod(sid, k);
    if (row.status === "CHECKED" || row.status === "LAPSED") rows.push(row);
  }
  return rows;
}

/** A read that failed, said plainly, so a page can render it instead of crashing. */
export async function attempt<T>(fn: () => Promise<T>): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    return { ok: false, error: String((error as Error)?.message ?? error).slice(0, 240) };
  }
}
