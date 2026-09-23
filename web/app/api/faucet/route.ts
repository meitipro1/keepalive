import { DEPLOYMENT } from "@/lib/deployment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Test GEN for a visitor's own wallet on the site's Studio network.
 *
 * Server side because Studio's RPC does not reliably send CORS headers, and
 * because the amount must not be something the page can edit. The amount goes
 * as a decimal string and the RPC's answer is ignored: measured by Recourse, a
 * number is answered with a hash and credits nothing, and a string is answered
 * with an error after the credit has landed. Success is the balance moving.
 *
 * Limits live in this process's memory, per address and per IP: they slow a
 * loop on one instance and enforce nothing across instances. Studio GEN has
 * no value.
 */

const FAUCET_WEI = 100n * 10n ** 18n;
const PER_ADDRESS_MS = 10 * 60 * 1000;
const PER_IP_MS = 60 * 1000;
const lastByAddress = new Map<string, number>();
const lastByIp = new Map<string, number>();

async function rpc(method: string, params: unknown[]) {
  const response = await fetch(DEPLOYMENT.rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    cache: "no-store",
  });
  return response.json();
}

async function balance(address: string): Promise<bigint> {
  try {
    return BigInt((await rpc("eth_getBalance", [address, "latest"]))?.result ?? "0x0");
  } catch {
    return 0n;
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const address = String((body as { address?: unknown })?.address ?? "");
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return Response.json({ message: "That is not a wallet address." }, { status: 400 });
  }
  const ip = (request.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  const now = Date.now();
  const key = address.toLowerCase();
  const wait = Math.max((lastByAddress.get(key) ?? 0) + PER_ADDRESS_MS - now, (lastByIp.get(ip) ?? 0) + PER_IP_MS - now);
  if (wait > 0) {
    return Response.json(
      { message: `The faucet funded this wallet or connection recently. Try again in ${Math.ceil(wait / 1000)} seconds.` },
      { status: 429 },
    );
  }
  lastByAddress.set(key, now);
  lastByIp.set(ip, now);
  if (lastByAddress.size > 5000) lastByAddress.clear();
  if (lastByIp.size > 5000) lastByIp.clear();

  const before = await balance(address);
  await rpc("sim_fundAccount", [address, FAUCET_WEI.toString()]).catch(() => null);
  let after = before;
  for (let i = 0; i < 16 && after <= before; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    after = await balance(address);
  }
  if (after <= before) {
    lastByAddress.delete(key);
    lastByIp.delete(ip);
    return Response.json({ message: "Studio's faucet was asked, but the balance has not moved yet. Try again in a moment." }, { status: 502 });
  }
  return Response.json({ before: before.toString(), after: after.toString() });
}
