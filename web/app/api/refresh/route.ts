import { revalidateTag } from "next/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Called by the page after a write is decided: drops the cached reads for
 * that stream and the stream list, so the next render reads the chain again
 * and the person who wrote sees the result of their own transaction.
 *
 * It changes nothing on chain and returns nothing. It is limited per IP only
 * because every call makes the next page view spend reads from the site's
 * thirty-a-minute budget.
 */

const PER_IP_MS = 2000;
const lastByIp = new Map<string, number>();

export async function POST(request: Request) {
  const ip = (request.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  const now = Date.now();
  if ((lastByIp.get(ip) ?? 0) + PER_IP_MS > now) return Response.json({ refreshed: false }, { status: 429 });
  lastByIp.set(ip, now);
  if (lastByIp.size > 5000) lastByIp.clear();

  const body = await request.json().catch(() => ({}));
  const sid = Number((body as { sid?: unknown })?.sid ?? 0);
  if (Number.isInteger(sid) && sid > 0) revalidateTag(`stream-${sid}`);
  revalidateTag("streams");
  return Response.json({ refreshed: true });
}
